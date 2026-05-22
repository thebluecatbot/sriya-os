// /api/entities · per-row CRUD on sriya_entities
//   GET    ?ns=user.sriya.v3&kind=task[&since=ISO]   → list
//   POST   { ns, kind, id?, payload, addedBy }       → upsert (id auto if absent)
//   PATCH  { ns, id, payload?, addedBy? }            → patch single row
//   DELETE { ns, id }                                 → soft-delete (sets deleted_at)
//
// Designed so concurrent edits to *different* rows never conflict.
// Last-writer-wins on the same row (Postgres tx atomic, updated_at = now()).

import postgres from 'postgres';

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
const sql = (() => { try { return makeClient(); } catch (e) { console.error('makeClient', e?.message); return null; } })();

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS sriya_entities (
      id text PRIMARY KEY,
      ns text NOT NULL,
      kind text NOT NULL,
      payload jsonb NOT NULL,
      added_by text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now(),
      deleted_at timestamptz
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sriya_entities_ns_kind_idx ON sriya_entities(ns, kind, updated_at DESC)`;
  await sql`CREATE INDEX IF NOT EXISTS sriya_entities_ns_active_idx ON sriya_entities(ns) WHERE deleted_at IS NULL`;
  // Best-effort: add table to supabase_realtime publication so INSERT/UPDATE/DELETE
  // events are broadcast to subscribed clients. Idempotent — silent if already added.
  try { await sql`ALTER PUBLICATION supabase_realtime ADD TABLE sriya_entities`; }
  catch (e) { /* already added or no permission · ignore */ }
  tableReady = true;
}

function sanitizeNs(ns) { return typeof ns === 'string' && /^[a-z0-9._-]{1,64}$/.test(ns) ? ns : null; }
function sanitizeId(id) { return typeof id === 'string' && /^[a-zA-Z0-9._:-]{1,128}$/.test(id) ? id : null; }
function sanitizeKind(k) { return typeof k === 'string' && /^[a-z][a-z0-9_]{0,32}$/.test(k) ? k : null; }

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!sql) return res.status(503).json({ offline: true });

  try { await ensureTable(); }
  catch (e) { console.error('ensureTable', e); return res.status(500).json({ error: 'db init failed' }); }

  // -------- GET (list) -------- //
  if (req.method === 'GET') {
    const ns = sanitizeNs(req.query?.ns);
    const kind = req.query?.kind ? sanitizeKind(req.query.kind) : null;
    const since = req.query?.since || null;
    if (!ns) return res.status(400).json({ error: 'missing ns' });
    try {
      let rows;
      if (kind && since) rows = await sql`SELECT * FROM sriya_entities WHERE ns = ${ns} AND kind = ${kind} AND updated_at > ${since} ORDER BY updated_at`;
      else if (kind)     rows = await sql`SELECT * FROM sriya_entities WHERE ns = ${ns} AND kind = ${kind} ORDER BY updated_at`;
      else if (since)    rows = await sql`SELECT * FROM sriya_entities WHERE ns = ${ns} AND updated_at > ${since} ORDER BY updated_at`;
      else               rows = await sql`SELECT * FROM sriya_entities WHERE ns = ${ns} ORDER BY updated_at`;
      return res.status(200).json({ entities: rows });
    } catch (e) {
      console.error('entities GET', e);
      return res.status(500).json({ error: 'db read failed' });
    }
  }

  // -------- POST (upsert) -------- //
  if (req.method === 'POST') {
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
    const ns = sanitizeNs(body?.ns);
    const kind = sanitizeKind(body?.kind);
    let id = body?.id ? sanitizeId(body.id) : null;
    const payload = body?.payload;
    const addedBy = typeof body?.addedBy === 'string' ? body.addedBy.slice(0, 32) : null;
    if (!ns || !kind || !payload || typeof payload !== 'object') return res.status(400).json({ error: 'bad payload' });
    if (!id) id = kind[0] + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    try {
      const rows = await sql`
        INSERT INTO sriya_entities (id, ns, kind, payload, added_by)
        VALUES (${id}, ${ns}, ${kind}, ${sql.json(payload)}, ${addedBy})
        ON CONFLICT (id) DO UPDATE
          SET payload = EXCLUDED.payload,
              added_by = COALESCE(EXCLUDED.added_by, sriya_entities.added_by),
              updated_at = now(),
              deleted_at = NULL
        RETURNING *
      `;
      return res.status(200).json({ entity: rows[0] });
    } catch (e) {
      console.error('entities POST', e);
      return res.status(500).json({ error: 'db write failed' });
    }
  }

  // -------- PATCH (partial update of payload) -------- //
  if (req.method === 'PATCH') {
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
    const ns = sanitizeNs(body?.ns);
    const id = sanitizeId(body?.id);
    const patch = body?.patch;
    if (!ns || !id || !patch || typeof patch !== 'object') return res.status(400).json({ error: 'bad payload' });
    try {
      const rows = await sql`
        UPDATE sriya_entities
        SET payload = payload || ${sql.json(patch)},
            updated_at = now()
        WHERE id = ${id} AND ns = ${ns}
        RETURNING *
      `;
      if (rows.length === 0) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ entity: rows[0] });
    } catch (e) {
      console.error('entities PATCH', e);
      return res.status(500).json({ error: 'db write failed' });
    }
  }

  // -------- DELETE (soft) -------- //
  if (req.method === 'DELETE') {
    const ns = sanitizeNs(req.query?.ns) || sanitizeNs(req.body?.ns);
    const id = sanitizeId(req.query?.id) || sanitizeId(req.body?.id);
    if (!ns || !id) return res.status(400).json({ error: 'missing ns/id' });
    try {
      const rows = await sql`UPDATE sriya_entities SET deleted_at = now(), updated_at = now() WHERE id = ${id} AND ns = ${ns} RETURNING id`;
      if (rows.length === 0) return res.status(404).json({ error: 'not found' });
      return res.status(200).json({ ok: true, id });
    } catch (e) {
      console.error('entities DELETE', e);
      return res.status(500).json({ error: 'db delete failed' });
    }
  }

  return res.status(405).json({ error: 'method not allowed' });
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }
