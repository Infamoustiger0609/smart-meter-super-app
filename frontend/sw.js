const CACHE = 'intellismart-v3';

// During development — always go to network first, cache as fallback
self.addEventListener('install', e => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Never cache API calls
  if (e.request.url.includes('/auth/') || 
      e.request.url.includes('/billing/') ||
      e.request.url.includes('/payment/') ||
      e.request.url.includes('/schedule') ||
      e.request.url.includes('/appliance/') ||
      e.request.url.includes('/system/') ||
      e.request.url.includes('/tariff/') ||
      e.request.url.includes('/meter/') ||
      e.request.url.includes('/service/') ||
      e.request.url.includes('/solar/') ||
      e.request.url.includes('/carbon/') ||
      e.request.url.includes('/cost/') ||
      e.request.url.includes('/optimize') ||
      e.request.url.includes('/balance/') ||
      e.request.url.includes('/chat/') ||
      e.request.url.includes('/consumption/') ||
      e.request.url.includes('/subscriptions/')) {
    return; // let these go straight to network, no caching
  }

  // For everything else — network first, cache as fallback
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
