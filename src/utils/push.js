// Mino Web Push helpers — subscribe / unsubscribe / status check.
// Public-key safe: VAPID public key comes from /api/push-vapid.

const NS = 'user.sriya.v3';
let cachedKey = null;

export function pushSupported() {
  return ('serviceWorker' in navigator) && ('PushManager' in window) && ('Notification' in window);
}

export async function getStatus() {
  if (!pushSupported()) return { supported: false };
  const perm = Notification.permission;
  let subscribed = false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    subscribed = !!sub;
  } catch {}
  return { supported: true, permission: perm, subscribed };
}

async function getVapidKey() {
  if (cachedKey) return cachedKey;
  const res = await fetch('/api/push-vapid', { cache: 'force-cache' });
  if (!res.ok) throw new Error('vapid key unavailable');
  const { publicKey } = await res.json();
  if (!publicKey) throw new Error('vapid key empty');
  cachedKey = publicKey;
  return publicKey;
}

function urlBase64ToUint8Array(b64) {
  const padding = '='.repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function subscribeMino() {
  if (!pushSupported()) throw new Error('push not supported on this device');

  // Ask permission only if needed.
  let perm = Notification.permission;
  if (perm === 'default') perm = await Notification.requestPermission();
  if (perm !== 'granted') throw new Error('permission denied');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();

  const key = await getVapidKey();
  const expectedAppKey = urlBase64ToUint8Array(key);

  // If an existing sub uses a different VAPID key (e.g., we rotated keys), drop it.
  if (sub) {
    const existingKey = new Uint8Array(sub.options?.applicationServerKey || new ArrayBuffer(0));
    let same = existingKey.length === expectedAppKey.length;
    if (same) for (let i = 0; i < existingKey.length; i++) { if (existingKey[i] !== expectedAppKey[i]) { same = false; break; } }
    if (!same) { try { await sub.unsubscribe(); } catch {} sub = null; }
  }

  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: expectedAppKey });
  }

  await fetch('/api/push-subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ns: NS,
      subscription: sub.toJSON(),
      user_agent: navigator.userAgent || null,
    }),
  });

  return sub;
}

export async function unsubscribeMino() {
  if (!pushSupported()) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return true;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ns: NS, unsubscribe: true, endpoint }),
    });
    return true;
  } catch (e) {
    console.warn('unsubscribe failed', e);
    return false;
  }
}

// Local "test ping" — shows a notification immediately from the SW
// without needing the server. Useful for confirming the permission/SW
// path is wired up.
export async function showLocalTest(text = 'hi ♡ this is what a check-in feels like') {
  if (!pushSupported()) throw new Error('not supported');
  if (Notification.permission !== 'granted') throw new Error('permission not granted');
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification('mino ✿', {
    body: text,
    icon: '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: 'mino-test',
    renotify: true,
    vibrate: [80, 40, 80],
    data: { url: '/#/mino' },
  });
}
