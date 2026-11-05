/* KampusOps service worker — makes the app installable and quick to open.
 *
 * - Never caches API, uploads or backend static files: data is always live.
 * - App pages: network first, falls back to the last saved copy when offline.
 * - Built JS/CSS/images under /assets/ have hashed names, so cache-first is safe.
 */
const VERSION = 'kampusops-v1'; // bump to refresh cached app files and icons
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL).then(c => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png'])).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (/^\/(api|uploads|static)\//.test(url.pathname)) return; // live data only

  // Page loads: try the network, fall back to the saved app shell when offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(SHELL).then(c => c.put('/', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('/').then(r => r || Response.error()))
    );
    return;
  }

  // Hashed build files: cache first
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(ASSETS).then(c => c.put(req, copy)).catch(() => {});
        }
        return res;
      }))
    );
  }
});
