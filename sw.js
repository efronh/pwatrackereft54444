const CACHE_NAME = 'tracker-pwa-v26';
const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=12',
  './app.js?v=14',
  './db.js?v=1',
  './manifest.json',
  './mood-happy.png?v=3',
  './mood-sad.png?v=3',
  './mood-tired.png?v=3',
  './mood-angry.png?v=3',
  './mood-nervous.png?v=3',
  './mood-proud.png?v=3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Keep SPA shell bootable while offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const isHttp = request.url.startsWith('http');
          if (isHttp && (request.url.includes(location.origin) || request.destination === 'script' || request.destination === 'style')) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
