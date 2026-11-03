const cacheName = 'ublmanager-app-v2'

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.add('/')))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== cacheName).map(key => caches.delete(key)))))
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url)
  if (event.request.method !== 'GET' || requestUrl.pathname.startsWith('/api/')) return
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      const copy = response.clone()
      caches.open(cacheName).then(cache => cache.put(event.request, copy))
      return response
    }).catch(() => caches.match('/')))
  )
})