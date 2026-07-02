// Self-destructing service worker. The previous version cached stale
// builds and left users on a blank page after redeploys. This version
// takes over, deletes all caches, unregisters itself, and reloads open
// tabs so everyone ends up on a clean, freshly-fetched app.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});

// Always go to the network; never serve from cache.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
