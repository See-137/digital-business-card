/**
 * Offline support for the card (conference Wi-Fi is where business cards get
 * opened). Bump VERSION on every deploy that changes a cached file.
 *
 * - Immutable files (fonts, vendored three r186, icons): cache first, filled
 *   on first use (the 3D files are cached once the portal has been seen).
 * - Everything else, pages included: network first with the cache as the
 *   offline fallback, so a deploy never pairs new HTML with stale JS.
 */
const IMMUTABLE = /\/(fonts|vendor|icons)\//;
const VERSION = 'c137-v1';
const CORE = [
  './',
  'index.html',
  'js/app.js',
  'manifest.webmanifest',
  'fonts/instrument-serif-400.woff2',
  'fonts/instrument-serif-400-italic.woff2',
  'fonts/ibm-plex-mono-400.woff2',
  'fonts/ibm-plex-mono-500.woff2',
  'fonts/ibm-plex-mono-600.woff2',
  'icons/icon-192.png',
  'assets/qr.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Only complete 200s are stored (no opaque, redirected or 206 partials),
  // and the put is kept alive with waitUntil.
  const store = (key, res) => {
    if (res.status === 200 && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(caches.open(VERSION).then((c) => c.put(key, copy)).catch(() => {}));
    }
    return res;
  };

  if (IMMUTABLE.test(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }

  // The card page itself (with any ?pins or #hash) shares the 'index.html'
  // entry; any other URL opened as a page keeps its own key, so it can never
  // overwrite the cached card. no-cache skips the 10 min HTTP cache Pages
  // sends, so "network first" really means the latest deploy.
  const scope = new URL(self.registration.scope).pathname;
  const isCard = req.mode === 'navigate' && (url.pathname === scope || url.pathname === `${scope}index.html`);
  const key = isCard ? 'index.html' : req;
  event.respondWith(
    fetch(req, { cache: 'no-cache' })
      .then((res) => store(key, res))
      .catch(() => caches.match(key).then((hit) => hit || Response.error())),
  );
});
