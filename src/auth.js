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
