// /api/state · GET ?ns=...  POST { ns, state, ts }
// Stores a single JSON blob per namespace in Postgres (Supabase / Neon / any pg).
// Free-tier friendly: one table, JSONB column.

import postgres from 'postgres';

const url = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;
// `postgres` package supports Supabase's pooler URL out of the box.
const sql = url ? postgres(url, { prepare: false, ssl: 'require', max: 1, idle_timeout: 20 }) : null;

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
    const state = body?.state;
    if (!ns || !state || typeof state !== 'object') return res.status(400).json({ error: 'bad payload' });
    try {
      await sql`
        INSERT INTO sriya_state (ns, state, updated_at) VALUES (${ns}, ${sql.json(state)}, now())
        ON CONFLICT (ns) DO UPDATE SET state = EXCLUDED.state, updated_at = now()
      `;
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
