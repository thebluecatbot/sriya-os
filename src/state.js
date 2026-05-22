// State + persistence layer.
// localStorage is the working store. Postgres mirror via /api/state.
// One STATE blob, modules are slots underneath.

import { todayKey } from './utils/format.js';
import { namespaceKey } from './auth.js';

// Both real users share Sriya's namespace so they see the same data.
// Guest-name URL param kept as an escape hatch for read-only previews.
const URL_PARAMS = new URLSearchParams(location.search);
const GUEST = URL_PARAMS.get('guest');
const NS = GUEST ? `guest.${slug(GUEST)}.v3` : namespaceKey();
export const IS_GUEST = !!GUEST;
export const GUEST_NAME = GUEST || null;

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 32); }

// ──────────────────────────────────────────────────────────────
// Default empty state · every module gets a slot, even if Wave 1 doesn't fill it.
// (Schema sketched from §16 of the spec; freely extended in later waves.)
// ──────────────────────────────────────────────────────────────
function defaults() {
  return {
    schemaVersion: 1,
    createdAt: new Date().toISOString(),
    settings: {
      theme: 'blush',           // blush | lavender | peachy | sakura
      mode: 'auto',             // auto | light | dark
      petalsOn: true,
      fontSize: 'md',           // md | lg | xl
      contrast: 'normal',       // normal | high
      dyslexiaFont: false,
      language: 'en',           // en | hi | te
      motion: 'auto',           // auto | reduce
      cycleTrackingOn: false,
    },
    today: { lastSeenDate: null, oneMainThingId: null },
    mino: {
      chattiness: 'balanced',   // chatty | balanced | quiet
      quietHours: { from: '22:30', to: '07:00' },
      snoozedUntil: null,       // ISO string
      checkins: [],             // {date, part, prompt, answered}
      unlocks: ['default'],
      lastSuggestionAt: null,
      pushEnabled: false,       // set true once the Web Push subscription is registered
    },
    tasks: {
      negotiable: [],           // see §16
      categories: ['Today', 'Soon', 'Someday'],
      mainThingByDate: {},      // {YYYY-MM-DD: taskId}
      recurring: [],            // {id, title, emoji, schedule, estMins, priority, energy, person, linkedModule, lastSpawnedDate}
      lastTick: null,           // YYYY-MM-DD; recurrence + carry-over run once per day
    },
    nonNegotiables: {
      categories: seedNonNegotiableCategories(),
      tickLog: {},              // {YYYY-MM-DD: {taskId: true}}
    },
    timer: { active: null, log: [], categories: seedTimerCategories() },
    calendar: { events: [] },
    health: {
      meds: [], medLog: [],
      skincare: { am: [], pm: [], products: [], log: [] },
      meditationLog: [], workoutLog: [], exerciseLibrary: [],
      sleepLog: [], moodLog: [], mealLog: [],
      water: { byDate: {} },
      cycleLog: [],
    },
    reading: { items: [], quotes: [], notes: [] },
    upsc: {
      syllabusTree: null, sources: [], revisions: [], pyq: [],
      mockTests: [], answerWriting: [], currentAffairs: [],
      topicNotes: [], essayBank: [], weakAreas: [], plannerConfig: {},
    },
    substack: { ideas: [], pieces: [], calendar: [], swipeFile: [] },
    journal: { entries: [], pin: null },
    doneJar: { byDate: {} },
    thoughtPark: { items: [] },
    doomscroll: { urges: [], dailyLog: {}, budgetMins: 30, noScrollWindows: [] },
    places: { items: [], outings: [] },
    people: [
      { id: 'sriya',   name: 'Sriya',   color: '#E66B95', emoji: '✿' },
      { id: 'prakhar', name: 'Prakhar', color: '#A684E4', emoji: '★' },
      { id: 'amma',    name: 'Amma',    color: '#ED8E6A', emoji: '♡' },
    ],
    rewards: [
      { id: '1', label: 'a long bath', emoji: '🛁' },
      { id: '2', label: 'an episode of comfort tv', emoji: '📺' },
      { id: '3', label: 'a tiny treat from the canteen', emoji: '🍫' },
    ],
    block: { label: '', endsOn: '', focus: '' },
    onboarded: false,
  };
}

function seedNonNegotiableCategories() {
  return [
    { id: 'morning', label: 'morning', emoji: '🌅', tasks: [
      { id: 'mn-1', label: 'brush teeth', emoji: '🪥' },
      { id: 'mn-2', label: 'take morning meds', emoji: '💊' },
      { id: 'mn-3', label: 'breakfast', emoji: '🥣' },
      { id: 'mn-4', label: 'drink water', emoji: '💧' },
    ]},
    { id: 'body', label: 'body', emoji: '🌸', tasks: [
      { id: 'bd-1', label: 'skincare AM', emoji: '✨' },
      { id: 'bd-2', label: 'milk', emoji: '🥛' },
      { id: 'bd-3', label: 'move 30 min', emoji: '🤸‍♀️' },
    ]},
    { id: 'night', label: 'night', emoji: '🌙', tasks: [
      { id: 'nt-1', label: 'evening meds', emoji: '💊' },
      { id: 'nt-2', label: 'dinner', emoji: '🍲' },
      { id: 'nt-3', label: 'skincare PM', emoji: '✨' },
      { id: 'nt-4', label: 'journal', emoji: '📓' },
      { id: 'nt-5', label: 'sleep on time', emoji: '😴' },
    ]},
  ];
}

function seedTimerCategories() {
  return [
    { id: 'upsc',       label: 'UPSC',        emoji: '📚', color: '#A684E4' },
    { id: 'mtp',        label: 'MTP',         emoji: '🎓', color: '#7C5BC8' },
    { id: 'substack',   label: 'Substack',    emoji: '✍️', color: '#ED8E6A' },
    { id: 'exercise',   label: 'Exercise',    emoji: '🤸', color: '#6BB89A' },
    { id: 'class',      label: 'Class',       emoji: '📝', color: '#94B3E0' },
    { id: 'lab',        label: 'Lab',         emoji: '🔬', color: '#79C2B0' },
    { id: 'reading',    label: 'Reading',     emoji: '📖', color: '#F4D58D' },
    { id: 'social',     label: 'Social',      emoji: '💞', color: '#F47BA7' },
    { id: 'rest',       label: 'Rest',        emoji: '☁️', color: '#C9A6E6' },
    { id: 'doomscroll', label: 'Doomscroll',  emoji: '📱', color: '#E8A861', budgetMins: 30 },
    { id: 'other',      label: 'Other',       emoji: '◌', color: '#9D8090' },
  ];
}

// ──────────────────────────────────────────────────────────────
// In-memory store
// ──────────────────────────────────────────────────────────────
const subs = new Set();
let _state = null;
let _pendingPersist = null;
let _pendingSync = null;

// Deep merge that UNIONS arrays of objects by their `id` field.
// Keyed-object structures (tickLog, byDate, mainThingByDate) are still merged
// as plain objects — the keys themselves are the identifiers there.
function deepMerge(a, b) {
  // Both arrays · union by id, newer wins on conflict
  if (Array.isArray(a) && Array.isArray(b)) {
    return unionArraysById(a, b);
  }
  // One is array, other missing · take whichever exists (prefer b)
  if (Array.isArray(a) || Array.isArray(b)) {
    return b ?? a;
  }
  // Both objects · recurse on union of keys
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  // Primitives · b wins unless undefined
  return b === undefined ? a : b;
}

// Pick the latest known timestamp on an item (createdAt / completedAt / etc).
function itemTimestamp(item) {
  if (!item || typeof item !== 'object') return 0;
  const candidates = [item.updatedAt, item.editedAt, item.completedAt,
                      item.modifiedAt, item.at, item.time, item.createdAt, item.date];
  for (const c of candidates) {
    if (!c) continue;
    const ts = Date.parse(c);
    if (Number.isFinite(ts)) return ts;
  }
  return 0;
}

// Union of two arrays of objects keyed by `id`. Newer wins where both have
// the same id. Arrays whose items have no `id` fall back to old behaviour.
function unionArraysById(a, b) {
  const aIdable = a.some((x) => x && typeof x === 'object' && 'id' in x);
  const bIdable = b.some((x) => x && typeof x === 'object' && 'id' in x);
  if (!aIdable && !bIdable) return b ?? a;

  const byId = new Map();
  const orphans = [];
  const pushItem = (item, side) => {
    if (item && typeof item === 'object' && 'id' in item) {
      const existing = byId.get(item.id);
      if (!existing) {
        byId.set(item.id, item);
      } else {
        // Pick newer by timestamp; tie · prefer b (later-arriving) for deterministic merge.
        const tA = itemTimestamp(existing);
        const tB = itemTimestamp(item);
        byId.set(item.id, tB >= tA ? item : existing);
      }
    } else {
      orphans.push(item);
    }
  };
  for (const item of a) pushItem(item, 'a');
  for (const item of b) pushItem(item, 'b');
  return [...byId.values(), ...orphans];
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(`${NS}.state`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { console.warn('state: localStorage read failed', e); return null; }
}

function saveLocal(snapshot) {
  try {
    localStorage.setItem(`${NS}.state`, JSON.stringify(snapshot));
  } catch (e) { console.warn('state: localStorage write failed', e); }
}

export function getState() { return _state; }
export function snapshot() { return JSON.parse(JSON.stringify(_state)); }

export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

function notify() {
  for (const fn of subs) { try { fn(_state); } catch (e) { console.error(e); } }
}

// mutator: pass a function that mutates a draft (Immer-lite, copy first)
// IMPORTANT: only adopt the mutator's return value if it's a real object ·
// arrow expressions like `(d) => d.x.push(y)` return a number (push() length)
// and would otherwise corrupt state.
export function update(mutator, { silent = false } = {}) {
  const draft = JSON.parse(JSON.stringify(_state));
  const res = mutator(draft);
  _state = (res && typeof res === 'object' && !Array.isArray(res)) ? res : draft;
  // Auto-stamp every change so remote-vs-local merge is reliable.
  _state.updatedAt = new Date().toISOString();
  if (!silent) notify();
  schedulePersist();
}

function schedulePersist() {
  if (_pendingPersist) return;
  _pendingPersist = setTimeout(() => {
    _pendingPersist = null;
    saveLocal(_state);
    scheduleSync();
  }, 80);
}

function scheduleSync() {
  if (IS_GUEST) return; // guests don't sync
  if (!_initialMergeDone) {
    // Queue: we'll flush once init's remote pull lands.
    if (_syncQueue.length === 0) _syncQueue.push(1);
    return;
  }
  if (_pendingSync) clearTimeout(_pendingSync);
  _pendingSync = setTimeout(syncToNeon, 800);
}

// Flush any pending write immediately, e.g. before the tab closes
export function flushSync() {
  if (_pendingSync) { clearTimeout(_pendingSync); _pendingSync = null; }
  syncToNeon();
}

// Beacon a final sync when the tab is being closed or hidden
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    try {
      if (IS_GUEST || !_state) return;
      const payload = JSON.stringify({ ns: NS, state: _state, ts: Date.now() });
      // sendBeacon is fire-and-forget, won't be cancelled by navigation
      if (navigator.sendBeacon) navigator.sendBeacon('/api/state', new Blob([payload], { type: 'application/json' }));
    } catch {}
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSync(); });
}

// Single-flight guard · prevents concurrent merge-then-write loops.
let _isSyncing = false;
// Snapshot of last-pushed body so we don't echo identical writes.
let _lastPushedJSON = '';

// ── Sync status broadcast · 'ok' | 'syncing' | 'offline' ── //
const _syncStatusSubs = new Set();
let _lastSyncStatus = 'syncing';
export function subscribeSyncStatus(fn) {
  _syncStatusSubs.add(fn);
  try { fn(_lastSyncStatus); } catch {}
  return () => _syncStatusSubs.delete(fn);
}
function emitSyncStatus(status) {
  _lastSyncStatus = status;
  for (const fn of _syncStatusSubs) { try { fn(status); } catch {} }
}

async function syncToNeon() {
  _pendingSync = null;
  if (!navigator.onLine) { emitSyncStatus('offline'); return; }
  if (_isSyncing) return;
  _isSyncing = true;
  emitSyncStatus('syncing');
  try {
    // Merge-before-write: pull remote, union with local, then push the union.
    // This is what prevents "user A overwrites user B" data loss.
    const remote = await loadFromNeon();
    if (remote) {
      const merged = deepMerge(_state, remote);
      const before = JSON.stringify(_state);
      const after = JSON.stringify(merged);
      if (before !== after) {
        _state = merged;
        // Keep updatedAt as max of both sides (or now, if we are publishing)
        const lTs = Date.parse(before && JSON.parse(before).updatedAt || 0) || 0;
        const rTs = Date.parse(remote.updatedAt || 0) || 0;
        _state.updatedAt = new Date(Math.max(lTs, rTs, Date.now())).toISOString();
        saveLocal(_state);
        notify();
      }
    }
    // Skip the POST if nothing has actually changed since last push.
    const payloadBody = JSON.stringify({ ns: NS, state: _state, ts: Date.now() });
    const stateOnly = JSON.stringify(_state);
    if (stateOnly === _lastPushedJSON) return;

    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payloadBody,
    });
    let pushedOK = false;
    if (!res.ok) {
      console.warn('[sync] POST failed', res.status);
    } else {
      // Vercel function returns 200 + { offline: true } when DB is unreachable —
      // treat that as a sync failure, not a success.
      try {
        const body = await res.clone().json();
        if (body && body.offline) {
          emitSyncStatus('offline');
          console.warn('[sync] POST returned offline:true · DB unreachable');
        } else {
          pushedOK = true;
        }
      } catch { pushedOK = true; }
    }
    if (pushedOK) { _lastPushedJSON = stateOnly; emitSyncStatus('ok'); }
    else if (!res.ok) { emitSyncStatus('offline'); }
  } catch (e) {
    console.warn('[sync] write error', e?.message || e);
    emitSyncStatus('offline');
  } finally {
    _isSyncing = false;
  }
}

// Background pull: every 5s while tab is visible + online + init done.
// Merges remote into local. Does NOT scheduleSync (no echo loops).
let _pullInterval = null;
function startPeriodicPull() {
  stopPeriodicPull();
  if (IS_GUEST) return;
  _pullInterval = setInterval(async () => {
    if (document.visibilityState !== 'visible') return;
    if (!navigator.onLine) return;
    if (!_initialMergeDone) return;
    if (_isSyncing) return;
    try {
      const remote = await loadFromNeon();
      if (!remote) return;
      const merged = deepMerge(_state, remote);
      const before = JSON.stringify(_state);
      const after = JSON.stringify(merged);
      if (before === after) return; // nothing new from remote · no loop
      _state = merged;
      const lTs = Date.parse(JSON.parse(before).updatedAt || 0) || 0;
      const rTs = Date.parse(remote.updatedAt || 0) || 0;
      _state.updatedAt = new Date(Math.max(lTs, rTs)).toISOString();
      saveLocal(_state);
      notify();
      // Remember we've effectively "received" this · prevents redundant push echo.
      _lastPushedJSON = JSON.stringify(_state);
      console.log('[sync] background pull merged remote changes');
    } catch (e) { /* offline / timeout · ignore */ }
  }, 5_000);
}
function stopPeriodicPull() {
  if (_pullInterval) { clearInterval(_pullInterval); _pullInterval = null; }
}
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') startPeriodicPull();
    else stopPeriodicPull();
  });
}

// Same-browser instant propagation: when another tab writes to the same
// localStorage key, re-read and notify(). Cross-tab feels real-time.
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (ev) => {
    if (!ev.key || ev.key !== `${NS}.state`) return;
    if (!ev.newValue) return;
    try {
      const incoming = JSON.parse(ev.newValue);
      const merged = deepMerge(_state, incoming);
      if (JSON.stringify(_state) !== JSON.stringify(merged)) {
        _state = merged;
        notify();
      }
    } catch {}
  });
}

async function loadFromNeon() {
  if (IS_GUEST) return null;
  if (!navigator.onLine) { emitSyncStatus('offline'); return null; }
  // Hard 6s timeout so login never freezes if the API cold-starts slowly.
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(`/api/state?ns=${encodeURIComponent(NS)}`, { cache: 'no-store', signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) { emitSyncStatus('offline'); return null; }
    const data = await res.json();
    if (data && data.offline) { emitSyncStatus('offline'); return null; }
    if (data && data.state && typeof data.state === 'object') {
      if (data.updatedAt && !data.state.updatedAt) data.state.updatedAt = data.updatedAt;
      return data.state;
    }
  } catch (e) {
    clearTimeout(t);
    console.warn('[sync] loadFromNeon failed:', e?.message || e);
    emitSyncStatus('offline');
  }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Init: localStorage first (instant), then Neon merge in background.
// ──────────────────────────────────────────────────────────────
// Gate: until init has settled (local read + remote pull), nothing is allowed
// to POST to the server. Otherwise an auto-stamped empty `defaults()` would
// race ahead of the remote load and OVERWRITE real data on Supabase.
let _initialMergeDone = false;
const _syncQueue = [];

export async function initState() {
  // 1) Load local instantly so the UI can paint right away (never freeze).
  const local = loadLocal();
  _state = local ? deepMerge(defaults(), local) : defaults();
  const lTs0 = Date.parse(local?.updatedAt || local?.lastTouched || 0) || 0;
  notify();

  // 2) Pull from remote in the background. The sync gate stays closed until
  //    this resolves OR the safety timeout fires, so any auto-stamped local
  //    update can't race to overwrite remote with an empty defaults.
  const safetyOpen = setTimeout(() => {
    if (_initialMergeDone) return;
    console.warn('[sync] init timed out · opening gate (will reconcile later)');
    _initialMergeDone = true;
    flushSyncQueueIfAny();
    startPeriodicPull();
  }, 7000);

  loadFromNeon().then((remote) => {
    clearTimeout(safetyOpen);
    if (remote) {
      const rTs = Date.parse(remote.updatedAt || remote.lastTouched || 0) || 0;
      // Take remote when it's at least as new as the local we already loaded.
      if (rTs >= lTs0) {
        _state = deepMerge(defaults(), remote);
        saveLocal(_state);
        notify();
        console.log(`[sync] merged remote · tasks=${_state.tasks?.negotiable?.length || 0}`);
      } else {
        console.log('[sync] local newer · pushing up');
        _initialMergeDone = true;
        scheduleSync();
        flushSyncQueueIfAny();
        return;
      }
    } else {
      console.log('[sync] no remote · keeping local');
    }
    _initialMergeDone = true;
    flushSyncQueueIfAny();
    startPeriodicPull();
  }).catch((e) => {
    clearTimeout(safetyOpen);
    console.warn('[sync] init load errored', e);
    _initialMergeDone = true;
    flushSyncQueueIfAny();
    startPeriodicPull();
  });

  return _state;
}

function flushSyncQueueIfAny() {
  if (_syncQueue.length > 0) { _syncQueue.length = 0; scheduleSync(); }
}

// Manual sync trigger — exposed for a "sync now" button in Me
export async function syncNow() {
  console.log('[sync] manual sync triggered');
  flushSync();
  await new Promise(r => setTimeout(r, 800));
  const remote = await loadFromNeon();
  if (remote) {
    const localTs = Date.parse(_state?.updatedAt || 0) || 0;
    const remoteTs = Date.parse(remote.updatedAt || 0) || 0;
    if (remoteTs > localTs) {
      _state = deepMerge(defaults(), remote);
      saveLocal(_state);
      notify();
      return { ok: true, action: 'pulled remote' };
    }
  }
  return { ok: true, action: 'pushed local' };
}

// Mark "touched" before every persist so timestamps stay honest.
const originalUpdate = update;
export function touch() {
  originalUpdate((d) => { d.lastTouched = new Date().toISOString(); });
}

// ──────────────────────────────────────────────────────────────
// Helpers for modules
// ──────────────────────────────────────────────────────────────
export function uid(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export const TODAY = () => todayKey();

export function exportAll() {
  return {
    exportedAt: new Date().toISOString(),
    namespace: NS,
    state: _state,
  };
}

export function importAll(payload) {
  if (!payload || !payload.state) throw new Error('Bad import: missing .state');
  _state = deepMerge(defaults(), payload.state);
  saveLocal(_state);
  notify();
  scheduleSync();
}

export function resetAll() {
  _state = defaults();
  saveLocal(_state);
  notify();
  scheduleSync();
}
