const CACHE_NAME = 'tracker-pwa-v43';

const APP_SHELL = [
  './',
  './index.html',
  './style.css?v=18',
  './app.js?v=1018',
  './db.js?v=100',
  './manifest.json?v=5',
  './app-icon.png?v=5',
  './mood-happy.png?v=3',
  './mood-sad.png?v=3',
  './mood-tired.png?v=3',
  './mood-angry.png?v=3',
  './mood-nervous.png?v=3',
  './mood-proud.png?v=3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
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

  const origin = self.location.origin;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        try {
          const url = new URL(request.url);
          if (url.origin === origin && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
        } catch (_) {
          /* ignore */
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
