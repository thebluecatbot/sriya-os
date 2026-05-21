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

function deepMerge(a, b) {
  if (Array.isArray(a) || Array.isArray(b)) return b ?? a;
  if (a && typeof a === 'object' && b && typeof b === 'object') {
    const out = { ...a };
    for (const k of Object.keys(b)) out[k] = deepMerge(a[k], b[k]);
    return out;
  }
  return b === undefined ? a : b;
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
  if (_pendingSync) clearTimeout(_pendingSync);
  _pendingSync = setTimeout(syncToNeon, 1500);
}

async function syncToNeon() {
  _pendingSync = null;
  if (!navigator.onLine) return;
  try {
    const res = await fetch('/api/state', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ns: NS, state: _state, ts: Date.now() }),
    });
    if (!res.ok) console.warn('state: sync POST failed', res.status);
  } catch (e) { /* offline · keep going */ }
}

async function loadFromNeon() {
  if (IS_GUEST) return null;
  if (!navigator.onLine) return null;
  try {
    const res = await fetch(`/api/state?ns=${encodeURIComponent(NS)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.state && typeof data.state === 'object') return data.state;
  } catch (e) { /* offline or 404 · fine */ }
  return null;
}

// ──────────────────────────────────────────────────────────────
// Init: localStorage first (instant), then Neon merge in background.
// ──────────────────────────────────────────────────────────────
export async function initState() {
  const local = loadLocal();
  _state = local ? deepMerge(defaults(), local) : defaults();
  notify();

  loadFromNeon().then((remote) => {
    if (!remote) return;
    const localTs = local ? Date.parse(local.lastTouched || 0) : 0;
    const remoteTs = Date.parse(remote.lastTouched || 0);
    if (remoteTs > localTs) {
      _state = deepMerge(defaults(), remote);
      saveLocal(_state);
      notify();
    }
  }).catch(() => {});

  return _state;
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
