var CACHE_NAME = 'bytefisher-' + Date.now();
var urlsToCache = [
  '/',
  '/css/main.css',
  '/js/utils.js',
  '/js/next-boot.js',
  '/js/motion.js'
];

self.addEventListener('install', function(event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(urlsToCache).catch(function() {});
    })
  );
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; }).map(function(k) { return caches.delete(k); })
      );
    })
  );
});

self.addEventListener('fetch', function(event) {
  var req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  // Ignore non-http/https requests (chrome-extension, data, blob, etc.)
  if (req.url.indexOf('http') !== 0) return;

  // Passthrough cross-origin requests (CDN images, external resources)
  if (req.url.indexOf(self.location.origin) !== 0) return;

  // Determine strategy by file type
  var isCSS = /\.css(\?|$)/.test(req.url);
  var isHTML = req.headers.get('Accept') && req.headers.get('Accept').indexOf('text/html') !== -1;
  var isAIAssistant = /\/js\/ai-assistant\.js(\?|$)/.test(req.url);

  // Network-first for HTML, CSS, and AI assistant script (fresh UI after deploy)
  if (isHTML || isCSS || isAIAssistant) {
    event.respondWith(
      fetch(req).then(function(res) {
        var copy = res.clone();
        caches.open(CACHE_NAME).then(function(cache) { cache.put(req, copy); });
        return res;
      }).catch(function() {
        return caches.match(req);
      })
    );
    return;
  }

  // Stale-while-revalidate for JS, images, fonts (non-critical assets)
  event.respondWith(
    caches.match(req).then(function(cached) {
      var fetchPromise = fetch(req).then(function(res) {
        return caches.open(CACHE_NAME).then(function(cache) {
          cache.put(req, res.clone());
          return res;
        });
      }).catch(function() {
        return cached;
      });
      return cached || fetchPromise;
    })
  );
});
