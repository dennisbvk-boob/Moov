// Minimal offline shell. Network first, cache as a fallback, so you always get
// the newest build when there is signal and a working app when there isn't.
//
// Paths are resolved against the worker's own location rather than the domain
// root, so this works both at https://moov.nl/ and at
// https://<user>.github.io/<repo>/ without a build step.
const CACHE = 'moov-v2';
const ROOT = new URL('./', self.location).href;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll([ROOT, ROOT + 'manifest.webmanifest', ROOT + 'icon-192.png'])),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Never cache API traffic — task state must come from the database.
  if (url.origin !== self.location.origin) return;
  // Leave anything outside our own scope alone (other apps on the same Pages domain).
  if (!url.href.startsWith(ROOT)) return;

  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((hit) => hit || caches.match(ROOT))),
  );
});
