const CACHE_NAME = 'sideline-pwa-v14';
const IMAGE_CACHE = 'sideline-img-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== IMAGE_CACHE)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Stale-While-Revalidate image cache for flagcdn.com & espncdn.com team/league logos
  if (
    url.hostname.includes('flagcdn.com') ||
    url.hostname.includes('espncdn.com') ||
    req.destination === 'image'
  ) {
    event.respondWith(
      caches.open(IMAGE_CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const networkFetch = fetch(req)
            .then((res) => {
              if (res && (res.status === 200 || res.type === 'opaque')) {
                cache.put(req, res.clone());
              }
              return res;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Network-first for live score & news APIs with offline fallback
  if (
    url.hostname.includes('espn.com') ||
    url.hostname.includes('onrender.com') ||
    url.hostname.includes('rss2json.com')
  ) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

  // Network-first for HTML/SW shell so GitHub updates apply immediately
  if (url.pathname.endsWith('index.html') || url.pathname.endsWith('sw.js') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req).then((res) => {
        if (res && res.status === 200) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});
