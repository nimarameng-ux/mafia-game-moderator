const CACHE_NAME = 'red-gold-app-v1';
const APP_FILES = ['/index.html', '/manifest.json', '/icon.svg'];

self.addEventListener('install', function(event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function(cache) {
    return cache.addAll(APP_FILES);
  }));
});

self.addEventListener('activate', function(event) {
  event.waitUntil(caches.keys().then(function(keys) {
    return Promise.all(keys.map(function(key) {
      if (key !== CACHE_NAME) return caches.delete(key);
    }));
  }));
});

self.addEventListener('fetch', function(event) {
  event.respondWith(caches.match(event.request).then(function(cached) {
    return cached || fetch(event.request);
  }));
});