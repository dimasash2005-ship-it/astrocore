"use client"

// components/integrations/PushPanel.tsx
//
// "Notifications on this device" card on the Integrations page.
// Like Telegram, but native: agent replies, reports and reminders pop up on the phone
// (or computer), even when AstroCore is closed. Each device is turned on separately.

import { useCallback, useEffect, useState } from "react"
import { BellRing, BellOff, Loader2, Smartphone, Check } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { IntegrationCard, Chip } from "@/components/integrations/IntegrationUI"

const COLOR = "#E8002A"
const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || ""

type State = "loading" | "unsupported" | "ios-install" | "no-server" | "denied" | "off" | "on"

const L = {
  uk: {
    name: "Сповіщення на телефон",
    desc: "Відповіді агента, нові звіти й нагадування спливають прямо на екрані — навіть коли AstroCore закритий.",
    on: "Увімкнено", off: "Вимкнено",
    enable: "Увімкнути на цьому пристрої", disable: "Вимкнути", test: "Надіслати тест",
    testOk: "Надіслано — подивись на екран 🔔", testFail: "Не вдалося надіслати. Спробуй вимкнути й увімкнути ще раз.",
    device: "Цей пристрій",
    unsupported: "Цей браузер не підтримує сповіщення. Спробуй Chrome на Android або комп'ютері.",
    ios: "На iPhone: спершу додай AstroCore на початковий екран (Поділитися → На початковий екран), відкрий з іконки і увімкни тут.",
    noServer: "Сповіщення ще не налаштовані на сервері.",
    denied: "Сповіщення заблоковані в браузері. Натисни 🔒 біля адреси сайту → Дозволи → Сповіщення → Дозволити.",
    perDevice: "Кожен телефон чи комп'ютер вмикається окремо.",
  },
  en: {
    name: "Phone notifications",
    desc: "Agent replies, new reports and reminders pop up right on your screen — even when AstroCore is closed.",
    on: "On", off: "Off",
    enable: "Turn on for this device", disable: "Turn off", test: "Send a test",
    testOk: "Sent — check your screen 🔔", testFail: "Couldn't send. Try turning it off and on again.",
    device: "This device",
    unsupported: "This browser doesn't support notifications. Try Chrome on Android or a computer.",
    ios: "On iPhone: first add AstroCore to the Home Screen (Share → Add to Home Screen), open it from the icon and turn this on.",
    noServer: "Notifications aren't set up on the server yet.",
    denied: "Notifications are blocked in the browser. Tap 🔒 next to the address → Permissions → Notifications → Allow.",
    perDevice: "Each phone or computer is turned on separately.",
  },
}

function keyBytes(b64u: string): Uint8Array {
  const s = atob(b64u.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64u.length + 3) % 4))
  return Uint8Array.from(s, c => c.charCodeAt(0))
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const reg = await navigator.serviceWorker.getRegistration("/") ?? await navigator.serviceWorker.register("/sw.js")
  await navigator.serviceWorker.ready
  return reg
}

function BellLogo() {
  return (
    <span style={{ width: 40, height: 40, borderRadius: 11, display: "grid", placeItems: "center", color: "#fff",
      background: "linear-gradient(145deg,#FF2D55 0%,#B0001F 100%)", boxShadow: "0 0 18px rgba(232,0,42,.35)" }}>
      <BellRing size={18} />
    </span>
  )
}

export default function PushPanel({ delay = 0 }: { delay?: number }) {
  const { language } = useLanguage()
  const tx = L[language === "uk" ? "uk" : "en"]
  const [state, setState] = useState<State>("loading")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const check = useCallback(async () => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setState(ios && !standalone ? "ios-install" : "unsupported"); return
    }
    if (!VAPID) { setState("no-server"); return }
    if (Notification.permission === "denied") { setState("denied"); return }
    try {
      const sub = await (await registration()).pushManager.getSubscription()
      setState(sub ? "on" : "off")
    } catch { setState("off") }
  }, [])

  useEffect(() => { check() }, [check])

  async function test() {
    const r = await fetch("/api/push/test", { method: "POST" }).then(x => x.json()).catch(() => ({ sent: 0 }))
    setMsg(r.sent > 0 ? { ok: true, text: tx.testOk } : { ok: false, text: tx.testFail })
  }

  async function enable() {
    setBusy(true); setMsg(null)
    try {
      const perm = await Notification.requestPermission()
      if (perm !== "granted") { setState(perm === "denied" ? "denied" : "off"); return }
      const reg = await registration()
      const sub = await reg.pushManager.getSubscription() ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(VAPID) as BufferSource })
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subscription: sub.toJSON() }) })
      if (!r.ok) throw new Error(String(r.status))
      setState("on")
      await test()
    } catch {
      setMsg({ ok: false, text: tx.testFail })
    } finally { setBusy(false) }
  }

  async function disable() {
    setBusy(true); setMsg(null)
    try {
      const sub = await (await registration()).pushManager.getSubscription()
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(() => {})
        await sub.unsubscribe()
      }
      setState("off")
    } finally { setBusy(false) }
  }

  const on = state === "on"
  const note =
    state === "unsupported" ? tx.unsupported :
    state === "ios-install" ? tx.ios :
    state === "no-server" ? tx.noServer :
    state === "denied" ? tx.denied : null

  return (
    <IntegrationCard color={COLOR} logo={<BellLogo />} name={tx.name} desc={note ?? tx.desc} on={on}
      statusLabel={state === "loading" ? "…" : on ? tx.on : tx.off} delay={delay}
      chips={on ? <><Chip mono={false}><Smartphone size={11} /> {tx.device}</Chip><Chip mono={false}>{tx.perDevice}</Chip></> : undefined}
      actions={state === "loading" ? <span className="ic-note"><Loader2 size={12} className="ic-spin" /></span>
        : on ? <>
          <button className="ic-btn primary" onClick={() => { setBusy(true); test().finally(() => setBusy(false)) }} disabled={busy}>
            {busy ? <Loader2 size={13} className="ic-spin" /> : <BellRing size={13} />} {tx.test}
          </button>
          <button className="ic-btn" onClick={disable} disabled={busy}><BellOff size={13} /> {tx.disable}</button>
        </>
        : state === "off" ? (
          <button className="ic-btn primary" onClick={enable} disabled={busy}>
            {busy ? <Loader2 size={13} className="ic-spin" /> : <BellRing size={13} />} {tx.enable}
          </button>
        ) : undefined}
      right={msg ? <span className="ic-note" style={{ color: msg.ok ? "#22C55E" : "#FF6B85" }}>{msg.ok && <Check size={11} />} {msg.text}</span> : undefined}
    />
  )
}
