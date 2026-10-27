// public/sw.js — AstroCore service worker.
//
// Deliberately tiny: it caches nothing of the app (so updates are never stale).
// Its only job is a friendly offline screen when a page can't load
// (phone without signal), instead of the browser's dinosaur.

const CACHE = "astrocore-offline-v1"
const OFFLINE_URL = "/offline.html"

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.add(new Request(OFFLINE_URL, { cache: "reload" }))))
  self.skipWaiting()
})

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith("astrocore-") && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Only page navigations are touched; API calls, images and scripts go straight to the network.
self.addEventListener("fetch", event => {
  if (event.request.mode !== "navigate") return
  event.respondWith(
    fetch(event.request).catch(() => caches.open(CACHE).then(c => c.match(OFFLINE_URL))),
  )
})
