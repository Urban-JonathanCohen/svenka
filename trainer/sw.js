// Service worker: offline support.
// - App shell (HTML/CSS/JS/vendor): cache-first, refreshed when VERSION changes.
// - Content JSON: network-first, so new exercises show up immediately when
//   online, with the cached copy as the offline fallback.
// Bump VERSION whenever shell files change.

const VERSION = 'v1';
const SHELL_CACHE = `svenka-shell-${VERSION}`;
const CONTENT_CACHE = 'svenka-content';

const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/style.css',
  'icons/icon.svg',
  'vendor/d3.min.js',
  'js/app.js',
  'js/core/storage.js',
  'js/core/state.js',
  'js/core/exams.js',
  'js/core/content.js',
  'js/core/llm.js',
  'js/core/ui.js',
  'js/core/quiz.js',
  'js/core/srs.js',
  'js/modules/home.js',
  'js/modules/level.js',
  'js/modules/reading.js',
  'js/modules/listening.js',
  'js/modules/writing.js',
  'js/modules/vocab.js',
  'js/modules/civics.js',
  'js/modules/picture.js',
  'js/modules/conversation.js',
  'js/modules/settings.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('svenka-shell-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // never touch API calls

  if (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.webmanifest')) {
    event.respondWith(networkFirst(req));
  } else {
    event.respondWith(cacheFirst(req));
  }
});

async function networkFirst(req) {
  const cache = await caches.open(CONTENT_CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const cached = await cache.match(req);
    if (cached) return cached;
    throw new Error('offline and not cached');
  }
}

async function cacheFirst(req) {
  const cached = await caches.match(req, { ignoreSearch: true });
  if (cached) return cached;
  const res = await fetch(req);
  if (res.ok && new URL(req.url).pathname.includes('/trainer/')) {
    const cache = await caches.open(SHELL_CACHE);
    cache.put(req, res.clone());
  }
  return res;
}
