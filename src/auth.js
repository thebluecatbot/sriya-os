// Auth: simple two-user system.
// Sriya is the owner; Prakhar is a co-pilot who sees most things and can add.
// Both users share Sriya's data namespace, so anything Prakhar adds appears
// for Sriya too. Prakhar is locked out of the journal.

const STORAGE_KEY = 'sriya.os.user';

const USERS = {
  sriya:   { password: 'sriya',   displayName: 'sriya',   role: 'owner',   accent: '#F47BA7' },
  prakhar: { password: 'prakhar', displayName: 'prakhar', role: 'copilot', accent: '#F5C945' },
};

let _current = null;

export function init() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && USERS[raw]) _current = raw;
  } catch {}
}

export function currentUser() { return _current; }
export function currentUserDisplay() { return _current ? USERS[_current].displayName : null; }
export function isLoggedIn() { return !!_current; }
export function isOwner() { return _current === 'sriya'; }
export function isCopilot() { return _current === 'prakhar'; }

// Modules Prakhar cannot reach (UI hides + router redirects).
const PRIVATE_FOR_COPILOT = new Set(['/journal']);
export function canAccess(path) {
  if (isOwner()) return true;
  if (!_current) return false;
  return !PRIVATE_FOR_COPILOT.has(path);
}

// canWrite(domain, mode) → bool. Single source of truth for permission gates.
// Sriya: always true. Prakhar: per the matrix below. Use this both in UI
// (greying out controls) and at every state-mutation site (early-return).
//
// domain examples: 'task' | 'calendar' | 'timer' | 'journal' | 'health' |
//                  'nonneg' | 'thoughtpark' | 'reading' | 'substack' | 'upsc'
//                  'mino' | 'settings' | 'places' | 'people' | 'doomscroll'
// mode    examples: 'add' | 'edit' | 'edit-own' | 'edit-others' | 'delete'
//                   'tick' | 'start' | 'stop' | 'log' | 'write'
const COPILOT_RULES = {
  // shared / collaborative
  'task:add':         true,
  'task:edit-own':    true,
  'task:edit-others': false,
  'task:tick':        true,            // prakhar can mark sriya's tasks done
  'task:delete':      false,
  'task:schedule':    true,            // schedule on calendar
  'calendar:add':     true,
  'calendar:edit-own':true,
  'calendar:delete-own': true,
  'calendar:edit-others': false,
  'calendar:delete-others': false,
  'places:add':       true,
  'places:edit':      true,
  'people:add':       true,
  'people:edit':      true,
  // personal · view-only for prakhar
  'timer:start':      false,
  'timer:stop':       false,
  'timer:log':        false,
  'journal:write':    false,
  'health:log':       false,
  'health:meds':      false,
  'health:skincare':  false,
  'nonneg:tick':      false,
  'nonneg:edit':      false,
  'thoughtpark:write': false,
  'reading:write':    false,
  'substack:write':   false,
  'upsc:write':       false,
  'mino:chat':        false,
  'mino:settings':    false,
  'settings:write':   false,
  'doomscroll:write': false,
  // dangerous / destructive · prakhar never
  'data:reset':       false,
  'data:export':      false,
};

export function canWrite(domain, mode = 'add') {
  if (isOwner()) return true;
  if (!isCopilot()) return false;
  return COPILOT_RULES[`${domain}:${mode}`] === true;
}

// Convenience checks
export function isCopilotReadOnly(domain) {
  // True if prakhar has zero write modes on this domain.
  if (isOwner()) return false;
  return !Object.keys(COPILOT_RULES).some((k) => k.startsWith(`${domain}:`) && COPILOT_RULES[k] === true);
}

// One-line guard for write handlers. Returns true if write is allowed.
// If not, fires a toast and returns false. Use at the top of every handler:
//   if (!writeGate('health', 'log')) return;
// Avoids importing toast everywhere; module-level dynamic import keeps the
// auth module dependency-free.
export function writeGate(domain, mode = 'add', reason = null) {
  if (canWrite(domain, mode)) return true;
  const msg = reason || (isCopilot() ? `view-only · sriya's ${domain}` : 'sign in first');
  // Lazy import to avoid a cycle; dom.js does not import auth.
  import('./utils/dom.js').then((m) => m.toast(msg)).catch(() => {});
  return false;
}

export function login(username, password) {
  const u = (username || '').trim().toLowerCase();
  const p = (password || '').trim();
  if (!USERS[u] || USERS[u].password !== p) return { ok: false, error: 'wrong username or password' };
  _current = u;
  try { localStorage.setItem(STORAGE_KEY, u); } catch {}
  return { ok: true };
}

export function logout() {
  _current = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

// Used to stamp every CREATE so we can highlight Prakhar's additions in yellow.
export function stamp(obj = {}) {
  if (!_current) return obj;
  return { ...obj, addedBy: _current };
}

// The shared namespace key for state + cloud sync.
// Both users read/write the same row so they see the same world.
export function namespaceKey() {
  return 'user.sriya.v3';
}
