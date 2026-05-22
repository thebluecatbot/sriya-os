// Supabase Realtime · subscribes to row changes on the user's sriya_state row.
// When the server-side row updates (because another device wrote), we get a push
// within ~100ms instead of polling every 12s.
//
// Falls back to silent no-op if SUPABASE_URL or anon key aren't configured —
// the rest of the sync stack still works via /api/state and periodic pull.
//
// Loaded from CDN to avoid a build step. ESM module.

let _client = null;
let _channel = null;
let _config = null;

async function getConfig() {
  if (_config) return _config;
  try {
    const r = await fetch('/api/realtime-config', { cache: 'force-cache' });
    if (!r.ok) return null;
    _config = await r.json();
    return _config;
  } catch { return null; }
}

async function getClient() {
  if (_client) return _client;
  const cfg = await getConfig();
  if (!cfg?.url || !cfg?.anonKey) return null;
  try {
    // Pull SDK from CDN. No build step, no npm install on the client.
    const mod = await import('https://esm.sh/@supabase/supabase-js@2.46.1');
    _client = mod.createClient(cfg.url, cfg.anonKey, {
      realtime: { params: { eventsPerSecond: 5 } },
      auth: { persistSession: false },
    });
    return _client;
  } catch (e) {
    console.warn('[realtime] SDK load failed', e?.message);
    return null;
  }
}

/**
 * Subscribe to live changes on the user's sriya_state row.
 * @param {string} ns                       e.g. 'user.sriya.v3'
 * @param {(payload) => void} onRowChange   called on every row change
 * @returns {Promise<() => void>}           unsubscribe function
 */
export async function subscribeStateChanges(ns, onRowChange) {
  const c = await getClient();
  if (!c) return () => {};
  if (_channel) { try { c.removeChannel(_channel); } catch {} _channel = null; }
  _channel = c
    .channel('sriya_state_' + ns)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sriya_state', filter: `ns=eq.${ns}` },
      (payload) => { try { onRowChange(payload); } catch (e) { console.warn('[realtime] handler', e); } },
    )
    .subscribe((status) => {
      // status: 'SUBSCRIBED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED'
      // No-op — sync-status dot reflects this via its own polling.
    });
  return () => { try { c.removeChannel(_channel); _channel = null; } catch {} };
}

/**
 * Subscribe to live changes on the entities table for the user.
 * Reserved for Phase 2 — the entity-based persistence rewrite.
 */
export async function subscribeEntityChanges(ns, onRowChange) {
  const c = await getClient();
  if (!c) return () => {};
  const channel = c
    .channel('sriya_entities_' + ns)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sriya_entities', filter: `ns=eq.${ns}` },
      (payload) => { try { onRowChange(payload); } catch (e) { console.warn('[realtime] entity handler', e); } },
    )
    .subscribe();
  return () => { try { c.removeChannel(channel); } catch {} };
}
