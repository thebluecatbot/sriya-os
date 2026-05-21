// Sriya's webOS — service worker
// Offline-first for the shell; network-first for state APIs.

const VERSION = 'sriya-v4-2026-05-21-more-tab';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
  '/icons/icon-maskable.svg',
  '/icons/mino.svg',
  '/src/design/tokens.css',
  '/src/design/components.css',
  '/src/design/petals.css',
  '/src/app.js',
  '/src/router.js',
  '/src/state.js',
  '/src/ui/shell.js',
  '/src/ui/today.js',
  '/src/ui/me.js',
  '/src/ui/capture.js',
  '/src/ui/placeholder.js',
  '/src/mino/mascot.js',
  '/src/mino/panel.js',
  '/src/mino/voice.js',
  '/src/utils/dom.js',
  '/src/utils/format.js'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // API routes: network-first, no cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(req).catch(() => new Response(JSON.stringify({ offline: true }), {
      headers: { 'content-type': 'application/json' }, status: 503
    })));
    return;
  }

  // Navigation: shell fallback (SPA hash routing).
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(SHELL_CACHE);
        cache.put('/index.html', fresh.clone());
        return fresh;
      } catch {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match('/index.html')) || (await cache.match('/'));
      }
    })());
    return;
  }

  // Static: cache-first, then network, then runtime cache.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const fresh = await fetch(req);
      if (fresh.ok) {
        const cache = await caches.open(RUNTIME_CACHE);
        cache.put(req, fresh.clone());
      }
      return fresh;
    } catch (err) {
      return cached || Response.error();
    }
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip-waiting') self.skipWaiting();
});
