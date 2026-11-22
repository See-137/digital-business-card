/**
 * Offline support for the card (conference Wi-Fi is where business cards get
 * opened). Bump VERSION on every deploy that changes a cache-first file or
 * the CORE list.
 *
 * - Immutable files (fonts, icons): cache first, filled on first use. A changed
 *   font or icon gets a NEW filename, never new bytes under an old name.
 * - Everything else, pages included: network first with a 3 s budget. A
 *   network that hangs (connected, no data) falls back to the cache after 3 s
 *   instead of the TCP timeout; the slow response still refreshes the cache.
 *
 * The origin see-137.github.io is shared with other projects, so this worker
 * only ever reads, writes and deletes caches named PREFIX*.
 */
const PREFIX = 'c137-card-';
const VERSION = `${PREFIX}v16`;
const LEGACY = ['c137-v1']; // this card's own pre-prefix cache name
const NETWORK_BUDGET_MS = 3000;
// After one request blows the budget, the network is treated as degraded for a
// short window: cached files are served at once (the page and its scripts then
// come from the same cached generation), and still refreshed in the background.
const DEGRADED_MS = 20000;
let degradedUntil = 0;
const IMMUTABLE = /\/(fonts|vendor|icons)\//;
const CORE = [
  './',
  'index.html',
  'js/site.js',
  'manifest.webmanifest',
  'fonts/archivo-expanded-latin.woff2',
  'fonts/hanken-grotesk-latin-400.woff2',
  'fonts/hanken-grotesk-latin-600.woff2',
  'fonts/geist-mono-latin-400.woff2',
  'icons/card-192.png',
  'assets/qr-card.svg',
  'assets/oleg-hanukayev.vcf',
  // small project stills only (the YouTube thumbnail is cross-origin and never cached here; the two
  // assistant screenshots in the agentic case study are larger and load on demand)
  'assets/work/editorial-queue.webp',
  'assets/work/cma-dashboard.webp',
  'assets/work/freekick-match-720.webp',
  'assets/work/bakery-v2.webp',
  'assets/work/finpulse.webp',
  'assets/work/aegis-console.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION)
    .then((c) => c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((k) => (k.startsWith(PREFIX) && k !== VERSION) || LEGACY.includes(k))
        .map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Look up only in this card's cache (never another project's on the origin). */
const fromCache = (key) => caches.open(VERSION).then((c) => c.match(key));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scope)) return;
  // Video is streamed with Range requests; the browser handles those best
  // untouched (a cached 200 answering a range breaks Safari playback).
  if (req.headers.has('range') || /\.(mp4|m4v|mov|webm|ogv)$/i.test(url.pathname)) return;

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
    event.respondWith(fromCache(req).then((hit) => hit || fetch(req).then((res) => store(req, res))));
    return;
  }

  // The card page itself (with any ?pins or #hash) shares the 'index.html'
  // entry; any other URL opened as a page keeps its own key, so it can never
  // overwrite the cached card. no-cache skips the 10 min HTTP cache Pages
  // sends, so "network first" really means the latest deploy.
  const isCard = req.mode === 'navigate' && (url.pathname === scope || url.pathname === `${scope}index.html`);
  const key = isCard ? 'index.html' : req;
  const network = fetch(req, { cache: 'no-cache' }).then((res) => store(key, res));
  event.waitUntil(network.catch(() => {})); // a slow answer still refreshes the cache

  event.respondWith(new Promise((resolve, reject) => {
    let settled = false;
    const finish = (res) => { if (!settled && res) { settled = true; resolve(res); } };
    const budget = Date.now() < degradedUntil ? 0 : NETWORK_BUDGET_MS;
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      degradedUntil = Date.now() + DEGRADED_MS;
      fromCache(key).then(finish);
    }, budget);
    network.then((res) => {
      clearTimeout(timer);
      // Only an answer within budget proves the network healthy; a late one
      // must not end degraded mode (it would pair cached and fresh files).
      if (!timedOut) degradedUntil = 0;
      finish(res);
    }).catch(() => {
      clearTimeout(timer);
      fromCache(key).then((hit) => {
        if (hit) finish(hit);
        else if (!settled) { settled = true; reject(new TypeError('offline and not cached')); }
      });
    });
  }));
});
