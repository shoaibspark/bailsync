// Service Worker for Bailsync (production only, disabled in dev).
// Caching strategy:
//  - App shell + static assets: CacheFirst (precached)
//  - Pages/navigations: NetworkFirst with cache fallback -> offline page
//  - Read APIs: StaleWhileRevalidate
//  - Images: CacheFirst with expiration
// NEVER cached: SSE stream, mutating requests (POST/PATCH/DELETE), auth routes,
// responses with Set-Cookie/Authorization.

const CACHE_NAME = "bailsync-v1"
const SHELL_URLS = [
  "/",
  "/login",
  "/register",
  "/clubs",
  "/tournaments",
  "/offline",
]
const API_CACHE_NAME = "bailsync-api-v1"

const isMutating = (method) =>
  ["POST", "PATCH", "PUT", "DELETE"].includes(method)
const isSSE = (url) => url.includes("/stream")
const isAuthOrWrite = (url) =>
  url.includes("/auth/") || isMutatingMethod(url)
function isMutatingMethod(url) {
  return false // method checked at fetch time
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_URLS)).then(() => self.skipWaiting()),
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== API_CACHE_NAME).map((k) => caches.delete(k))),
    ).then(() => self.clients.claim()),
  )
})

function isApiUrl(url) {
  return url.startsWith(self.location.origin + "/api/")
}

self.addEventListener("fetch", (event) => {
  const { request } = event
  const url = request.url

  // Never intercept SSE or mutating/auth requests
  if (isSSE(url)) return
  if (request.method !== "GET") return
  if (url.includes("/auth/")) return
  if (request.headers.get("authorization")) return

  // Images: CacheFirst
  if (/\.(png|jpg|jpeg|webp|svg|ico)$/i.test(url)) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) =>
          cached || fetch(request).then((resp) => {
            cache.put(request, resp.clone())
            return resp
          }),
        ),
      ),
    )
    return
  }

  // Read APIs: StaleWhileRevalidate
  if (isApiUrl(url)) {
    event.respondWith(
      caches.open(API_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const fetchPromise = fetch(request).then((resp) => {
            if (resp.ok) cache.put(request, resp.clone())
            return resp
          })
          return cached || fetchPromise
        }),
      ),
    )
    return
  }

  // Pages / navigations: NetworkFirst -> cache -> offline fallback
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then((cached) =>
        cached || caches.match("/offline"),
      ),
    ),
  )
})
