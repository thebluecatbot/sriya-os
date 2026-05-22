// /api/push-subscribe · POST { ns, subscription, user_agent?, unsubscribe? }
// Stores or removes a Web Push subscription tied to a namespace (e.g. user.sriya.v3).

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
const sql = (() => { try { return makeClient(); } catch (e) { console.error('makeClient failed', e?.message); return null; } })();

let tableReady = false;
async function ensureTable() {
  if (tableReady) return;
  await sql`
    CREATE TABLE IF NOT EXISTS sriya_push_subs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      ns text NOT NULL,
      endpoint text NOT NULL UNIQUE,
      p256dh text NOT NULL,
      auth text NOT NULL,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      last_seen_at timestamptz NOT NULL DEFAULT now()
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS sriya_push_subs_ns_idx ON sriya_push_subs(ns)`;
  tableReady = true;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!sql) return res.status(503).json({ error: 'db not configured' });

  try { await ensureTable(); }
  catch (e) { console.error('push table init failed', e); return res.status(500).json({ error: 'db init failed' }); }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }

  const ns = sanitizeNs(body?.ns);
  const sub = body?.subscription;
  const ua = String(body?.user_agent || '').slice(0, 300);
  const isUnsub = !!body?.unsubscribe;

  if (!ns) return res.status(400).json({ error: 'missing ns' });

  if (isUnsub) {
    const endpoint = sub?.endpoint || body?.endpoint;
    if (!endpoint) return res.status(400).json({ error: 'missing endpoint' });
    try {
      await sql`DELETE FROM sriya_push_subs WHERE endpoint = ${endpoint}`;
      return res.status(200).json({ ok: true, removed: true });
    } catch (e) {
      console.error('push unsubscribe failed', e);
      return res.status(500).json({ error: 'db delete failed' });
    }
  }

  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'bad subscription' });
  }

  try {
    await sql`
      INSERT INTO sriya_push_subs (ns, endpoint, p256dh, auth, user_agent, last_seen_at)
      VALUES (${ns}, ${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${ua || null}, now())
      ON CONFLICT (endpoint) DO UPDATE
        SET ns = EXCLUDED.ns, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth,
            user_agent = EXCLUDED.user_agent, last_seen_at = now()
    `;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('push subscribe failed', e);
    return res.status(500).json({ error: 'db write failed' });
  }
}

function sanitizeNs(ns) {
  if (typeof ns !== 'string') return null;
  if (!/^[a-z0-9._-]{1,64}$/.test(ns)) return null;
  return ns;
}
