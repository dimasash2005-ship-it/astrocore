"use client"

// components/pwa/InstallPrompt.tsx
//
// 1) Registers the service worker (public/sw.js: offline screen only).
// 2) On phones, offers to install AstroCore as an app:
//    - Android / Chrome: a real "Install" button (browser's beforeinstallprompt);
//    - iPhone / Safari: a hint "Share → Add to Home Screen" (Apple has no install API).
// Shown once to signed-in users, never inside an open chat, never when already installed.
// "Not now" hides it for 14 days.

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useLanguage } from "@/lib/useLanguage"

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> }

const KEY = "astrocore_install_dismissed"
const SNOOZE_MS = 14 * 24 * 3600_000

const TX = {
  uk: {
    title: "Встанови AstroCore на телефон",
    sub: "Відкривається як застосунок: на весь екран, з іконкою на робочому столі.",
    install: "Встановити", later: "Не зараз",
    ios: "Натисни «Поділитися» ⬆️ внизу Safari, потім «На початковий екран».",
  },
  en: {
    title: "Install AstroCore on your phone",
    sub: "Opens like an app: full screen, with its own icon on your home screen.",
    install: "Install", later: "Not now",
    ios: "Tap Share ⬆️ at the bottom of Safari, then “Add to Home Screen”.",
  },
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
}
function snoozed() {
  try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < SNOOZE_MS } catch { return false }
}
function signedIn() {
  return /(^|;\s*)sb-[^=]*-auth-token/.test(document.cookie)
}

export default function InstallPrompt() {
  const { language } = useLanguage()
  const t = TX[language === "en" ? "en" : "uk"]
  const pathname = usePathname() || "/"
  const [evt, setEvt] = useState<BIPEvent | null>(null)
  const [ios, setIos] = useState(false)
  const [show, setShow] = useState(false)

  // Service worker (offline screen). Same file for every visitor.
  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {})
  }, [])

  useEffect(() => {
    if (isStandalone() || snoozed()) return
    const onPrompt = (e: Event) => { e.preventDefault(); setEvt(e as BIPEvent) }
    const onInstalled = () => { setShow(false); setEvt(null) }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    const ua = navigator.userAgent
    setIos(/iPhone|iPad|iPod/.test(ua) && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua))
    return () => { window.removeEventListener("beforeinstallprompt", onPrompt); window.removeEventListener("appinstalled", onInstalled) }
  }, [])

  // Appear a few seconds after the page opens — only on phones, only for signed-in users, never over a chat.
  useEffect(() => {
    if (!(evt || ios)) return
    const phone = window.matchMedia("(max-width: 767px)").matches
    if (!phone || !signedIn() || pathname.startsWith("/chat/") || isStandalone() || snoozed()) return
    const id = setTimeout(() => setShow(true), 6000)
    return () => clearTimeout(id)
  }, [evt, ios, pathname])

  if (!show) return null

  const later = () => { try { localStorage.setItem(KEY, String(Date.now())) } catch {} ; setShow(false) }
  const install = async () => {
    if (!evt) return
    await evt.prompt()
    const { outcome } = await evt.userChoice.catch(() => ({ outcome: "dismissed" as const }))
    if (outcome === "dismissed") later()
    setEvt(null); setShow(false)
  }

  return (
    <div className="aip" role="dialog" aria-live="polite">
      <style>{CSS}</style>
      <span className="aip-ic"><img src="/icons/icon-192.png" alt="" /></span>
      <div className="aip-t">
        <b>{t.title}</b>
        <span>{evt ? t.sub : t.ios}</span>
        <div className="aip-a">
          {evt && <button className="aip-go" onClick={install}>{t.install}</button>}
          <button className="aip-no" onClick={later}>{t.later}</button>
        </div>
      </div>
    </div>
  )
}

const CSS = `
.aip { position: fixed; left: 12px; right: 12px; bottom: calc(12px + env(safe-area-inset-bottom)); z-index: 9600;
  display: flex; gap: 12px; padding: 14px; border-radius: 16px; font-family: 'Space Grotesk', system-ui, sans-serif;
  background: linear-gradient(160deg, #1A0F16, #0E0D17 70%); border: .5px solid rgba(232,0,42,.4);
  box-shadow: 0 18px 50px rgba(0,0,0,.7), 0 0 30px rgba(232,0,42,.15); animation: aipIn .35s cubic-bezier(.2,.8,.2,1); }
.aip-ic { width: 46px; height: 46px; flex: none; border-radius: 12px; overflow: hidden; box-shadow: 0 0 18px rgba(232,0,42,.35); }
.aip-ic img { width: 100%; height: 100%; display: block; }
.aip-t { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.aip-t b { font-size: 14.5px; color: #fff; }
.aip-t span { font-size: 12.5px; line-height: 1.45; color: #A8A4BC; }
.aip-a { display: flex; gap: 8px; margin-top: 6px; }
.aip-a button { padding: 8px 14px; border-radius: 10px; cursor: pointer; font: 600 13px 'Space Grotesk', system-ui, sans-serif; }
.aip-go { color: #fff; background: #E8002A; border: none; box-shadow: 0 0 16px rgba(232,0,42,.4); }
.aip-no { color: #C8C4D8; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.14); }
@keyframes aipIn { from { opacity: 0; transform: translateY(16px); } }
@media (prefers-reduced-motion: reduce) { .aip { animation: none; } }
`
