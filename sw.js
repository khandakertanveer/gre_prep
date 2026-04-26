/* GRE Prep Service Worker
   Cache strategy: cache-first for shell, network-first for content.
   Bump CACHE_VERSION when you deploy changes so clients pick them up.
*/
const CACHE_VERSION = 'gre-v2';
const SHELL = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Content JSONs: network-first so you see new sets immediately
  if (url.pathname.includes('/content/')) {
    event.respondWith(
      fetch(req).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Everything else: cache-first
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req).then((res) => {
      if (res.ok && (url.origin === location.origin || url.origin.includes('fonts'))) {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((c) => c.put(req, clone));
      }
      return res;
    }).catch(() => cached))
  );
});
