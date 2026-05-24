// State + persistence layer.
// localStorage is the working store. Postgres mirror via /api/state.
// One STATE blob, modules are slots underneath.

import { todayKey } from './utils/format.js';
import { namespaceKey } from './auth.js';
import { subscribeStateChanges } from './utils/realtime.js';

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

// ──────────────────────────────────────────────────────────────
// Recency-aware merge.
//
// Bug fixed here (v25): the previous deepMerge always preferred `b` on a
// primitive conflict, and unionArraysById broke timestamp ties by preferring
// `b`. Every sync path called deepMerge(_state, remote) with `_state` as `a`
// and `remote` as `b` — so a freshly edited LOCAL value would lose to the
// STALE remote copy that hadn't seen the edit yet, snapping the UI back.
//
// New rules (mergeStates(local, remote)):
//   · Objects carrying their own `updatedAt`: the side with the newer
//     updatedAt wins for primitive fields; objects/arrays still recurse.
//   · Arrays of objects with `id`: union by id; on the same id, mergeNode
//     resolves field-by-field (newer wins). On a genuine tie, LOCAL wins.
//   · Primitive arrays (no id-bearing objects): union with dedup, never
//     drop a value present on either side.
//   · Primitives with no timestamp context: prefer LOCAL, never silently
//     prefer remote.
//   · Items/keys present on only one side are always kept.
//
// Edits stop reverting because update() now stamps a fresh updatedAt on the
// section + item that changed (see stampChanges). The stale remote copy has
// an older updatedAt, so local wins by recency, not by tie-break.
// ──────────────────────────────────────────────────────────────

// Pick the latest known timestamp on an item / section.
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

// Entry point: merge our local state with a remote state, recency-aware,
// then apply soft-delete tombstones. local-wins-on-tie throughout.
function mergeStates(local, remote) {
  if (local == null) return remote;
  if (remote == null) return local;
  const merged = mergeNode(local, remote, 'local');
  // Merge tombstone dicts (newer ISO string wins per key).
  const lt = local._tombstones || {};
  const rt = remote._tombstones || {};
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

  // Null is treated as "absent" only when the other side has an object/array
  // (so re-setting a field back to null on one device requires that side to
  // be the newer one — same rule as any other field update).
  if (local === null && remote === null) return null;
  if (local === null && (Array.isArray(remote) || (typeof remote === 'object'))) {
    return inheritedSide === 'remote' ? remote : local;
  }
  if (remote === null && (Array.isArray(local) || (typeof local === 'object'))) {
    return inheritedSide === 'remote' ? remote : local;
  }

  if (Array.isArray(local) && Array.isArray(remote)) {
    return mergeArraysById(local, remote);
  }
  if (Array.isArray(local) || Array.isArray(remote)) {
    return local;  // type mismatch — keep local
  }

  if (local && typeof local === 'object' && remote && typeof remote === 'object') {
    const lTs = tsOf(local);
    const rTs = tsOf(remote);
    let newer;
    if (lTs > rTs) newer = 'local';
    else if (rTs > lTs) newer = 'remote';
    else newer = inheritedSide;            // tie → inherit (defaults to 'local')

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
        // primitive conflict: pick by `newer`. tie/no-info default = local.
        out[k] = newer === 'remote' ? rv : lv;
      }
    }
    return out;
  }

  // Both primitives at this depth (no parent updatedAt info): keep local.
  return local;
}

function mergeArraysById(local, remote) {
  // Both sides id-bearing? Use byId union with per-item recency merge.
  const anyIds = (arr) => arr.some((x) => x && typeof x === 'object' && 'id' in x);
  if (!anyIds(local) && !anyIds(remote)) {
    // Primitive arrays (strings/numbers): union with dedup so additions
    // from either device survive.
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
    // remote orphans (id-less): drop — no way to dedupe safely
  }
  return [...byId.values(), ...orphans];
}

// After a recency-aware merge, filter out items whose id has a tombstone
// that's newer than the item itself. (An edit newer than the delete wins.)
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
            if (itemTs <= Date.parse(tombTs)) continue;  // tombstone wins → drop
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

// Per-device "live" state that should never be clobbered by a remote merge
// just because the other device didn't know about it. Currently: the running
// timer.active. With recency-aware merge this is largely a belt-and-braces.
function preserveLiveLocalState(localState, mergedCandidate, incomingState) {
  if (localState?.timer?.active && !incomingState?.timer?.active) {
    mergedCandidate.timer = mergedCandidate.timer || {};
    mergedCandidate.timer.active = localState.timer.active;
  }
  return mergedCandidate;
}

// ──────────────────────────────────────────────────────────────
// Auto-stamp updatedAt on the section / item / array that just changed,
// and auto-tombstone any item that vanished from an array. Runs inside
// update() so existing UI handlers don't need to know about timestamps.
// ──────────────────────────────────────────────────────────────

const STAMP_SKIP_KEYS = new Set([
  'updatedAt', 'createdAt', 'lastTouched', 'schemaVersion', '_tombstones',
]);

function stampChanges(before, draft, now) {
  if (!draft || typeof draft !== 'object') return;
  if (!before || typeof before !== 'object') {
    // First materialisation — stamp every section we have.
    for (const k of Object.keys(draft)) {
      const v = draft[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && !v.updatedAt) v.updatedAt = now;
    }
    return;
  }
  walkAndStamp(before, draft, draft, now);
}

function walkAndStamp(beforeObj, draftObj, top, now) {
  // Track if any key under draftObj changed; caller stamps own updatedAt.
  for (const k of Object.keys(draftObj)) {
    if (STAMP_SKIP_KEYS.has(k)) continue;
    const bv = beforeObj?.[k];
    const dv = draftObj[k];
    if (Array.isArray(dv)) {
      if (!Array.isArray(bv)) continue;          // brand-new array — leave as-is
      if (JSON.stringify(bv) === JSON.stringify(dv)) continue;
      stampArrayChanges(bv, dv, top, now);
      // Find the containing object (draftObj) and bump its updatedAt too
      if (draftObj !== top && !STAMP_SKIP_KEYS.has('updatedAt')) {
        draftObj.updatedAt = now;
      }
    } else if (dv && typeof dv === 'object') {
      if (!bv || typeof bv !== 'object') {
        // brand new sub-object
        dv.updatedAt = now;
        continue;
      }
      if (JSON.stringify(bv) === JSON.stringify(dv)) continue;
      // Stamp this object then recurse for deeper nested ones.
      dv.updatedAt = now;
      walkAndStamp(bv, dv, top, now);
    } else {
      // primitive — if it differs, bump the parent's updatedAt
      if (bv !== dv && draftObj !== top) {
        draftObj.updatedAt = now;
      }
    }
  }
  // Keys removed from draftObj entirely (rare): bump parent updatedAt
  for (const k of Object.keys(beforeObj)) {
    if (STAMP_SKIP_KEYS.has(k)) continue;
    if (!(k in draftObj) && draftObj !== top) {
      draftObj.updatedAt = now;
    }
  }
}

function stampArrayChanges(beforeArr, draftArr, top, now) {
  // Build before-by-id and draft-by-id.
  const beforeById = new Map();
  for (const it of beforeArr) {
    if (it && typeof it === 'object' && 'id' in it) beforeById.set(it.id, it);
  }
  const draftIds = new Set();
  for (const it of draftArr) {
    if (it && typeof it === 'object' && 'id' in it) {
      draftIds.add(it.id);
      const prev = beforeById.get(it.id);
      if (!prev) {
        if (!it.createdAt) it.createdAt = now;
        if (!it.updatedAt) it.updatedAt = now;
      } else if (JSON.stringify(prev) !== JSON.stringify(it)) {
        it.updatedAt = now;
      }
    }
  }
  // Items that disappeared from the array → tombstone.
  for (const [id] of beforeById) {
    if (!draftIds.has(id)) {
      top._tombstones = top._tombstones || {};
      top._tombstones[id] = now;
    }
  }
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
  const before = _state ? JSON.parse(JSON.stringify(_state)) : null;
  const draft = _state ? JSON.parse(JSON.stringify(_state)) : {};
  const res = mutator(draft);
  const next = (res && typeof res === 'object' && !Array.isArray(res)) ? res : draft;
  const now = new Date().toISOString();
  // Stamp section/item updatedAts + auto-tombstone deletions BEFORE we set
  // the top-level updatedAt — the merge layer needs that per-section info.
  stampChanges(before, next, now);
  next.updatedAt = now;
  _state = next;
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
      let merged = mergeStates(_state, remote);
      merged = preserveLiveLocalState(_state, merged, remote);
      const before = JSON.stringify(_state);
      const after = JSON.stringify(merged);
      if (before !== after) {
        _state = merged;
        // Keep updatedAt as max of both sides (we may be about to publish).
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

// Background pull: schedules itself with setTimeout (not setInterval) so a
// slow pull can never pile up. Single-flight via _isPulling.  Exponential
// backoff on errors so a flapping API doesn't lock the event loop.
let _pullTimer = null;
let _isPulling = false;
let _pullBackoffMs = 12_000;   // base interval — relaxed from 5s
const PULL_MIN_MS = 12_000;
const PULL_MAX_MS = 120_000;

function startPeriodicPull() {
  stopPeriodicPull();
  if (IS_GUEST) return;
  schedulePull(PULL_MIN_MS);
  // Subscribe to Supabase Realtime for push-based updates · server pings us
  // within ~100ms of another device's write. Polling continues as a safety
  // net in case the Realtime channel drops.
  ensureRealtimeSubscription();
}
function stopPeriodicPull() {
  if (_pullTimer) { clearTimeout(_pullTimer); _pullTimer = null; }
}

// One subscription per session. Realtime sends the full new row in the
// payload — we apply it DIRECTLY, no refetch. That's the difference between
// ~100ms (push only) and ~1s (push + re-fetch).
let _realtimeUnsub = null;
async function ensureRealtimeSubscription() {
  if (_realtimeUnsub) return;
  try {
    _realtimeUnsub = await subscribeStateChanges(NS, (payload) => {
      const incoming = payload?.new?.state;
      if (!incoming || typeof incoming !== 'object') return;
      // Recency-aware merge. Local wins on ties so a freshly-edited local
      // value is never reverted by a stale incoming payload.
      let merged = mergeStates(_state, incoming);
      merged = preserveLiveLocalState(_state, merged, incoming);
      const before = JSON.stringify(_state);
      const after = JSON.stringify(merged);
      if (before === after) return;
      _state = merged;
      // Take the newer of local/remote updated_at so subsequent pulls can short-circuit.
      const remoteTs = payload?.new?.updated_at;
      const lTs = Date.parse(_state.updatedAt) || 0;
      const rTs = Date.parse(remoteTs) || 0;
      if (rTs > lTs) _state.updatedAt = remoteTs;
      saveLocal(_state);
      notify();
      // Mark this version as already-pushed so we don't echo it back up.
      _lastPushedJSON = JSON.stringify(_state);
      emitSyncStatus('ok');
    });
  } catch (e) {
    console.warn('[realtime] subscribe failed', e?.message);
  }
}
function schedulePull(delay) {
  if (_pullTimer) clearTimeout(_pullTimer);
  _pullTimer = setTimeout(runPull, Math.max(2000, delay));
}
async function runPull() {
  _pullTimer = null;
  if (IS_GUEST) return;
  if (document.visibilityState !== 'visible') { schedulePull(PULL_MIN_MS); return; }
  if (!navigator.onLine) { schedulePull(PULL_MIN_MS); return; }
  if (!_initialMergeDone) { schedulePull(PULL_MIN_MS); return; }
  if (_isSyncing || _isPulling) { schedulePull(PULL_MIN_MS); return; }
  _isPulling = true;
  let ok = true;
  try {
    const remote = await loadFromNeon();
    if (remote) {
      let merged = mergeStates(_state, remote);
      merged = preserveLiveLocalState(_state, merged, remote);
      const before = JSON.stringify(_state);
      const after = JSON.stringify(merged);
      if (before !== after) {
        _state = merged;
        const lTs = Date.parse(JSON.parse(before).updatedAt || 0) || 0;
        const rTs = Date.parse(remote.updatedAt || 0) || 0;
        _state.updatedAt = new Date(Math.max(lTs, rTs)).toISOString();
        saveLocal(_state);
        notify();
        _lastPushedJSON = JSON.stringify(_state);
      }
      emitSyncStatus('ok');
    } else {
      ok = false;
    }
  } catch (e) {
    ok = false;
  } finally {
    _isPulling = false;
    _pullBackoffMs = ok
      ? PULL_MIN_MS
      : Math.min(PULL_MAX_MS, Math.max(PULL_MIN_MS, _pullBackoffMs * 2));
    schedulePull(_pullBackoffMs);
  }
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
      const merged = mergeStates(_state, incoming);
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
  //    mergeStates(local, defaults) keeps local on every conflict; defaults
  //    only fills in missing keys (e.g. a new section added in a later release).
  const local = loadLocal();
  _state = local ? mergeStates(local, defaults()) : defaults();
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
      // Always merge against the CURRENT _state (not just defaults) so any
      // edits the user made during the init pull window survive.
      const merged = mergeStates(_state, remote);
      if (JSON.stringify(merged) !== JSON.stringify(_state)) {
        _state = merged;
        saveLocal(_state);
        notify();
        console.log(`[sync] merged remote · tasks=${_state.tasks?.negotiable?.length || 0}`);
      } else {
        console.log('[sync] remote matches local · no change');
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
    const merged = mergeStates(_state, remote);
    if (JSON.stringify(merged) !== JSON.stringify(_state)) {
      _state = merged;
      saveLocal(_state);
      notify();
      return { ok: true, action: 'merged remote' };
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
  // Import wins: treat payload as "local" so it beats defaults on every conflict.
  _state = mergeStates(payload.state, defaults());
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
