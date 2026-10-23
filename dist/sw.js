const VERSION = 'a7f09516b4'
const PRECACHE = [
  "assets/index-BK2kBeJN.js",
  "assets/index-Cg9R_ZQw.css",
  "icons/apple-touch-icon.png",
  "icons/icon-192.png",
  "icons/icon-512.png",
  "icons/icon-maskable-512.png",
  "index.html",
  "manifest.webmanifest"
]

const PRECACHE_CACHE = `marcenaria-precache-${VERSION}`
const RUNTIME_CACHE = `marcenaria-runtime-${VERSION}`
const scope = self.registration.scope
const indexUrl = new URL('index.html', scope).href
const toUrl = (path) => new URL(path, scope).href

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE_CACHE)
      await Promise.all(
        PRECACHE.map(async (path) => {
          try {
            await cache.add(new Request(toUrl(path), { cache: 'reload' }))
          } catch {
            // Keep installing even if one optional asset cannot be fetched.
          }
        }),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((key) => key.startsWith('marcenaria-') && key !== PRECACHE_CACHE && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request)
          if (response.ok) {
            const cache = await caches.open(PRECACHE_CACHE)
            await cache.put(indexUrl, response.clone())
            return response
          }
        } catch {
          // Offline: serve the cached app shell below.
        }
        return (await caches.match(indexUrl, { ignoreVary: true })) || (await caches.match(request, { ignoreVary: true })) || Response.error()
      })(),
    )
    return
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request, { ignoreVary: true })
      if (cached) return cached
      try {
        const response = await fetch(request)
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE)
          await cache.put(request, response.clone())
        }
        return response
      } catch {
        return Response.error()
      }
    })(),
  )
})
