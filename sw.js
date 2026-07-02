// ── Service Worker ──
// Offline support and installability for a fully static site. Same-origin
// GETs are served stale-while-revalidate: the cached copy answers
// immediately while a background fetch refreshes it for next time, so one
// deploy of staleness is the worst case and the whole sky works offline.
// Cross-origin traffic (fonts, analytics, weather) is left untouched.
//
// Classic (non-module) worker on purpose — it must register in every
// engine that supports service workers at all, without a build step.

const CACHE_NAME = "cloudbreeze-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  event.respondWith(staleWhileRevalidate(event.request));
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || refresh;
}
