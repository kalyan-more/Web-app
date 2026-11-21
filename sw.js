const CACHE_NAME = 'sideline-pwa-v14';
const LOGO_CACHE_NAME = 'sideline-logos-swr-v1';
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
          .filter((k) => k !== CACHE_NAME && k !== LOGO_CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Stale-while-revalidate for flagcdn.com and espncdn.com team/league logos
  if (url.hostname === 'flagcdn.com' || url.hostname.endsWith('.flagcdn.com') || url.hostname.endsWith('.espncdn.com') || url.hostname === 'a.espncdn.com') {
    event.respondWith(
      caches.open(LOGO_CACHE_NAME).then((logoCache) =>
        logoCache.match(req).then((cached) => {
          const networkUpdate = fetch(req).then((res) => {
            if (res && (res.status === 200 || res.type === 'opaque')) {
              logoCache.put(req, res.clone());
            }
            return res;
          }).catch(() => cached);
          return cached || networkUpdate;
        })
      )
    );
    return;
  }

  if (url.hostname.includes('espn.com') || url.hostname.includes('onrender.com') || url.hostname.includes('rss2json.com')) {
    event.respondWith(
      fetch(req).catch(() => caches.match(req))
    );
    return;
  }

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
