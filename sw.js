/*
 * sw.js — Mafia Game Moderator
 * Rev 17 — asset caching ONLY. This service worker must never modify,
 * rewrite, or inject <script> tags into any response. Application logic
 * lives entirely in app.js, loaded directly and deterministically by
 * index.html. See legacy/README.md for why an earlier version of this
 * file used to inject extra scripts, and why that approach was removed.
 */
const CACHE_NAME = 'mafia-rev17-app-shell-v4';
const APP_FILES = ['/', '/index.html', '/app.js', '/auth.js', '/styles.css', '/manifest.json', '/icon.svg', '/mafia-emblem.png', '/background.svg', '/background-setup.svg', '/background-day.svg', '/background-night.svg', '/background-complete.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;

  // Access checks are security-sensitive and must always reach the server.
  if (new URL(request.url).pathname.startsWith('/api/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Navigation requests: serve the real network response verbatim
  // (no rewriting), falling back to the cached app shell if offline.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(request);
        if (fresh.ok) return fresh;
      } catch (e) {}
      const cached = await caches.match('/index.html');
      if (cached) return cached;
      return new Response('App unavailable offline until opened once online.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    })());
    return;
  }

  // Everything else (app.js, styles baked into index.html, icons, etc.):
  // network-first, cache as a fallback for offline use.
  event.respondWith((async () => {
    try {
      const fresh = await fetch(request);
      if (fresh.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, fresh.clone());
        return fresh;
      }
    } catch (e) {}
    return (await caches.match(request)) || new Response('', { status: 504 });
  })());
});
