// /api/state · GET ?ns=...  POST { ns, state, ts }
// Stores a single JSON blob per namespace in Postgres (Supabase / Neon / any pg).
// Free-tier friendly: one table, JSONB column.
//
// POST does server-side recency-aware merge inside a row-locked transaction so
// two devices that race their POSTs don't full-overwrite each other. The merge
// logic mirrors src/state.js mergeStates exactly (last edited timestamp wins;
// tie → existing row).

import postgres from 'postgres';

// Two ways to configure DB:
//   A) DATABASE_URL — full connection string. Requires URL-encoded password if
//      it contains @ : / ? # % & = + space.
//   B) SUPABASE_DB_PASSWORD — just the raw password. SAFER. We build the URL
//      from the known host/db/user. No URL-encoding needed.
function makeClient() {
  const opts = { prepare: false, ssl: 'require', max: 1, idle_timeout: 20 };
  const pwd = process.env.SUPABASE_DB_PASSWORD;
  if (pwd) {
    return postgres({
      host: process.env.SUPABASE_DB_HOST || 'aws-1-ap-south-1.pooler.supabase.com',
      port: Number(process.env.SUPABASE_DB_PORT || 6543),
      database: process.env.SUPABASE_DB_NAME || 'postgres',
      username: process.env.SUPABASE_DB_USER || 'postgres.kcvhlmquqkoxrkhcablc',
      password: pwd,
      ...opts,
    });
  }
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
  if (url) return postgres(url, opts);
  return null;
}

const sql = (() => { try { return makeClient(); } catch (e) { console.error('makeClient failed', e?.message); return null; } })();

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS sriya_state (
      ns text PRIMARY KEY,
      state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  tableReady = true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (!sql) {
    // No DB configured · return soft response so the app keeps working offline.
    if (req.method === 'GET') return res.status(200).json({ state: null, offline: true });
    return res.status(200).json({ ok: true, offline: true });
  }

  try { await ensureTable(); }
  catch (e) { console.error('ensureTable failed', e); return res.status(500).json({ error: 'db init failed' }); }

  if (req.method === 'GET') {
    const ns = sanitizeNs(req.query?.ns);
    if (!ns) return res.status(400).json({ error: 'missing ns' });
    try {
      const rows = await sql`SELECT state, updated_at FROM sriya_state WHERE ns = ${ns} LIMIT 1`;
      if (rows.length === 0) return res.status(200).json({ state: null });
      return res.status(200).json({ state: rows[0].state, updatedAt: rows[0].updated_at });
    } catch (e) {
      console.error('state GET failed', e);
      return res.status(500).json({ error: 'db read failed' });
    }
  }

  if (req.method === 'POST') {
    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
    const ns = sanitizeNs(body?.ns);
    const incoming = body?.state;
    if (!ns || !incoming || typeof incoming !== 'object') return res.status(400).json({ error: 'bad payload' });
    try {
      // Transaction + SELECT … FOR UPDATE so two concurrent POSTs to the same
      // ns serialize. Inside, we merge incoming into the locked row and write
      // the union back. This eliminates the brief overwrite-window where a
      // late-arriving POST could clobber an earlier one's edits.
      await sql.begin(async (tx) => {
        const rows = await tx`SELECT state FROM sriya_state WHERE ns = ${ns} FOR UPDATE`;
        const existing = rows.length > 0 ? rows[0].state : null;
        const merged = existing ? mergeStates(existing, incoming) : incoming;
        await tx`
          INSERT INTO sriya_state (ns, state, updated_at) VALUES (${ns}, ${tx.json(merged)}, now())
          ON CONFLICT (ns) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
        `;
      });
      return res.status(200).json({ ok: true });
    } catch (e) {
      console.error('state POST failed', e);
      return res.status(500).json({ error: 'db write failed' });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}

function sanitizeNs(ns) {
  if (typeof ns !== 'string') return null;
  if (!/^[a-z0-9._-]{1,64}$/.test(ns)) return null;
  return ns;
}

// ──────────────────────────────────────────────────────────────
// Recency-aware merge — mirrors src/state.js mergeStates. Pure JS, no I/O.
// Kept inline so this serverless function has zero non-`postgres` imports.
// If the rules change here, change them in src/state.js too (and vice versa).
// ──────────────────────────────────────────────────────────────

function tsOf(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  const candidates = [obj.updatedAt, obj.editedAt, obj.modifiedAt,
                      obj.completedAt, obj.at, obj.time, obj.createdAt, obj.date];
  for (const c of candidates) {
    if (!c) continue;
    const ts = Date.parse(c);
    if (Number.isFinite(ts)) return ts;
  }
  return 0;
}

// "existing" is the row in the DB. "incoming" is the client's payload.
// Treat existing as local (it's the row's current truth on the server).
// Tie → existing wins; this matches the client's local-wins-on-tie rule
// from the perspective of whoever owns the lock right now.
function mergeStates(existing, incoming) {
  if (existing == null) return incoming;
  if (incoming == null) return existing;
  const merged = mergeNode(existing, incoming, 'local');
  // Merge tombstone dicts (newer ISO string wins per key).
  const lt = existing._tombstones || {};
  const rt = incoming._tombstones || {};
  const tomb = { ...lt };
  for (const k of Object.keys(rt)) {
    if (!tomb[k] || rt[k] > tomb[k]) tomb[k] = rt[k];
  }
  if (Object.keys(tomb).length > 0) merged._tombstones = tomb;
  return applyTombstones(merged);
}

function mergeNode(local, remote, inheritedSide) {
  if (local === undefined) return remote;
  if (remote === undefined) return local;
  if (local === null && remote === null) return null;
  if (local === null && (Array.isArray(remote) || typeof remote === 'object')) {
    return inheritedSide === 'remote' ? remote : local;
  }
  if (remote === null && (Array.isArray(local) || typeof local === 'object')) {
    return inheritedSide === 'remote' ? remote : local;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    return mergeArraysById(local, remote);
  }
  if (Array.isArray(local) || Array.isArray(remote)) {
    return local;
  }
  if (local && typeof local === 'object' && remote && typeof remote === 'object') {
    const lTs = tsOf(local);
    const rTs = tsOf(remote);
    let newer;
    if (lTs > rTs) newer = 'local';
    else if (rTs > lTs) newer = 'remote';
    else newer = inheritedSide;
    const out = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const k of keys) {
      const lv = local[k];
      const rv = remote[k];
      if (lv === undefined) { out[k] = rv; continue; }
      if (rv === undefined) { out[k] = lv; continue; }
      const lIsObj = lv && typeof lv === 'object';
      const rIsObj = rv && typeof rv === 'object';
      if (lIsObj || rIsObj) {
        out[k] = mergeNode(lv, rv, newer);
      } else {
        out[k] = newer === 'remote' ? rv : lv;
      }
    }
    return out;
  }
  return local;
}

function mergeArraysById(local, remote) {
  const anyIds = (arr) => arr.some((x) => x && typeof x === 'object' && 'id' in x);
  if (!anyIds(local) && !anyIds(remote)) {
    if (local.every((x) => typeof x !== 'object') && remote.every((x) => typeof x !== 'object')) {
      const seen = new Set();
      const out = [];
      for (const v of local) if (!seen.has(v)) { seen.add(v); out.push(v); }
      for (const v of remote) if (!seen.has(v)) { seen.add(v); out.push(v); }
      return out;
    }
    return local;
  }
  const byId = new Map();
  const orphans = [];
  for (const it of local) {
    if (it && typeof it === 'object' && 'id' in it) byId.set(it.id, it);
    else orphans.push(it);
  }
  for (const it of remote) {
    if (it && typeof it === 'object' && 'id' in it) {
      const existing = byId.get(it.id);
      if (!existing) byId.set(it.id, it);
      else byId.set(it.id, mergeNode(existing, it, 'local'));
    }
  }
  return [...byId.values(), ...orphans];
}

function applyTombstones(state) {
  const tomb = state._tombstones;
  if (!tomb || Object.keys(tomb).length === 0) return state;
  function walk(node) {
    if (Array.isArray(node)) {
      const kept = [];
      for (const it of node) {
        if (it && typeof it === 'object' && 'id' in it) {
          const tombTs = tomb[it.id];
          if (tombTs) {
            const itemTs = tsOf(it);
            if (itemTs <= Date.parse(tombTs)) continue;
          }
        }
        kept.push(walk(it));
      }
      return kept;
    }
    if (node && typeof node === 'object') {
      const out = {};
      for (const k of Object.keys(node)) out[k] = walk(node[k]);
      return out;
    }
    return node;
  }
  return walk(state);
}
