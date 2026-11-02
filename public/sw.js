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

// ── Push notifications (agent replies, reports, reminders) ──
// The server sends { title, body, url, tag }. If that exact chat is already open
// and visible, no banner is shown — you're looking at it anyway.
self.addEventListener("push", event => {
  let d = {}
  try { d = event.data ? event.data.json() : {} } catch { d = { body: event.data ? event.data.text() : "" } }
  const title = d.title || "AstroCore"
  const url = d.url || "/"
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    const path = url.split("?")[0]
    const watching = wins.some(w => w.visibilityState === "visible" && w.focused && new URL(w.url).pathname === path)
    if (watching && path.startsWith("/chat/")) return
    await self.registration.showNotification(title, {
      body: d.body || "",
      icon: d.icon || "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: d.tag || undefined,
      renotify: !!d.tag,
      data: { url },
      vibrate: [80, 40, 80],
    })
  })())
})

// Tap on a notification → focus AstroCore (or open it) on the right page.
self.addEventListener("notificationclick", event => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const w of wins) {
      if (new URL(w.url).origin === self.location.origin && "focus" in w) {
        await w.focus()
        if ("navigate" in w) return w.navigate(url)
        return
      }
    }
    return self.clients.openWindow(url)
  })())
})
