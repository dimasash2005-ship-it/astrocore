"use client"

// Telegram on the Integrations page: compact card + side panel.
// Connect = open t.me/<bot>?start=<code>, press Start, and the page notices by itself.

import { useCallback, useEffect, useRef, useState } from "react"
import { Check, Loader2, Unlink, AlertTriangle, ExternalLink, Settings2, Send, BellRing } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { IntegrationCard, IntegrationDrawer } from "@/components/integrations/IntegrationUI"

type Status = {
  configured: boolean
  bot: string | null
  connected: boolean
  username: string | null
  notifyReports: boolean
  connectedAt: string | null
  setupError?: boolean
}

const COLOR = "#2AABEE"
const EMPTY: Status = { configured: false, bot: null, connected: false, username: null, notifyReports: true, connectedAt: null }

const L = {
  uk: {
    connected: "Підключено", notConnected: "Не підключено", soon: "Скоро",
    desc: "Звіти агента й нагадування приходять у Telegram",
    connect: "Підключити Telegram", settings: "Налаштувати", openBot: "Відкрити бота", reports: "Звіти в Telegram",
    waiting: "Відкрий Telegram і натисни «Start» у боті…", reopen: "Відкрити Telegram ще раз",
    linked: "Telegram підключено! Нові звіти приходитимуть у бот.",
    drawerSub: "Звіти агента прямо в телефоні",
    chat: "Чат", notifyTitle: "Надсилати нові звіти в Telegram", notifyHint: "Звіти місій і звіти від агента приходитимуть повідомленням",
    test: "Надіслати тест", testOk: "Тестове повідомлення надіслано", testFail: "Не вдалося надіслати. Можливо, бот заблоковано: відкрий бота і натисни Start.",
    disconnect: "Відключити", disconnectConfirm: "Відключити Telegram? Звіти перестануть приходити в бот.",
    stepsTitle: "Як підключити",
    steps: ["Натисни «Підключити Telegram»", "Відкриється бот AstroCore: натисни «Start»", "Готово: нові звіти приходитимуть сюди"],
    cmdsTitle: "Команди бота",
    cmds: [["нагадай …", "нагадування: «нагадай завтра о 9 …»"], ["/reminders", "мої нагадування"], ["/report", "останній звіт"], ["/reports", "5 останніх звітів"], ["/stop", "відключити"]],
    soonChat: "Скоро: писати агенту прямо з Telegram",
    notConfigured: "Telegram ще не налаштований на сервері.",
    setupError: "Інтеграція ще не готова: виконай SQL для Telegram у Supabase.",
  },
  en: {
    connected: "Connected", notConnected: "Not connected", soon: "Soon",
    desc: "Your agent's reports and reminders arrive in Telegram",
    connect: "Connect Telegram", settings: "Settings", openBot: "Open bot", reports: "Reports to Telegram",
    waiting: "Open Telegram and press “Start” in the bot…", reopen: "Open Telegram again",
    linked: "Telegram is connected! New reports will arrive in the bot.",
    drawerSub: "Your agent's reports right on your phone",
    chat: "Chat", notifyTitle: "Send new reports to Telegram", notifyHint: "Mission and agent reports will arrive as a message",
    test: "Send a test", testOk: "Test message sent", testFail: "Couldn't send. The bot may be blocked: open it and press Start.",
    disconnect: "Disconnect", disconnectConfirm: "Disconnect Telegram? Reports will stop arriving in the bot.",
    stepsTitle: "How to connect",
    steps: ["Click “Connect Telegram”", "The AstroCore bot opens: press “Start”", "Done: new reports will arrive there"],
    cmdsTitle: "Bot commands",
    cmds: [["remind …", "reminder: “remind me tomorrow at 9 …”"], ["/reminders", "my reminders"], ["/report", "latest report"], ["/reports", "last 5 reports"], ["/stop", "disconnect"]],
    soonChat: "Soon: chat with your agent right from Telegram",
    notConfigured: "Telegram is not set up on the server yet.",
    setupError: "Integration isn't ready yet: run the Telegram SQL in Supabase.",
  },
}

export function TelegramLogo({ size = 44 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, display: "grid", placeItems: "center",
      background: "linear-gradient(145deg,#37BBFE 0%,#1E96D6 100%)", color: "#fff" }}>
      <Send size={size * 0.44} style={{ transform: "translateX(-1px) rotate(-8deg)" }} />
    </span>
  )
}

export default function TelegramPanel({ onStatus, delay = 0 }: { onStatus?: (connected: boolean) => void; delay?: number }) {
  const { language } = useLanguage()
  const tx = L[language === "uk" ? "uk" : "en"]

  const [st, setSt] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState<"" | "link" | "test" | "off">("")
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/telegram", { cache: "no-store" })
      const d: Status = r.ok ? await r.json() : EMPTY
      setSt(d)
      return d
    } catch { setSt(EMPTY); return EMPTY }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (st) onStatus?.(st.connected) }, [st, onStatus])
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current) }, [])

  // Wait until the bot confirms the link (user pressed Start in Telegram).
  function startPolling() {
    if (pollRef.current) clearInterval(pollRef.current)
    const started = Date.now()
    pollRef.current = setInterval(async () => {
      const d = await load()
      if (d.connected || Date.now() - started > 15 * 60_000) {
        if (pollRef.current) clearInterval(pollRef.current)
        pollRef.current = null
        if (d.connected) { setLinkUrl(null); setMsg({ ok: true, text: tx.linked }); setOpen(true) }
      }
    }, 2500)
  }

  async function connect() {
    setBusy("link"); setMsg(null)
    // Open the tab right away (inside the click) so the browser doesn't block it.
    const win = window.open("about:blank", "_blank")
    try {
      const r = await fetch("/api/integrations/telegram/link", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.url) { win?.close(); setMsg({ ok: false, text: d.error ?? "Error" }); setOpen(true); return }
      setLinkUrl(d.url)
      if (win) win.location.href = d.url
      else window.location.href = d.url
      startPolling()
    } finally { setBusy("") }
  }

  async function toggleNotify() {
    if (!st) return
    const prev = st
    setSt({ ...st, notifyReports: !st.notifyReports })
    const r = await fetch("/api/integrations/telegram", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notifyReports: !prev.notifyReports }),
    }).catch(() => null)
    if (!r?.ok) setSt(prev)
  }

  async function sendTest() {
    setBusy("test"); setMsg(null)
    const r = await fetch("/api/integrations/telegram/test", { method: "POST" }).catch(() => null)
    setMsg(r?.ok ? { ok: true, text: tx.testOk } : { ok: false, text: tx.testFail })
    setBusy("")
  }

  async function disconnect() {
    if (!window.confirm(tx.disconnectConfirm)) return
    setBusy("off")
    try {
      const r = await fetch("/api/integrations/telegram", { method: "DELETE" })
      if (r.ok) { setSt(await r.json()); setMsg(null); setOpen(false) }
    } finally { setBusy("") }
  }

  const on = !!st?.connected
  const ready = !!st?.configured && !st?.setupError
  const botUrl = st?.bot ? `https://t.me/${st.bot}` : null
  const waiting = !!linkUrl && !on

  const connectBtn = (
    <button className="ic-btn primary" onClick={connect} disabled={busy === "link"}>
      {busy === "link" ? <Loader2 size={14} className="ic-spin" /> : <Send size={14} />} {tx.connect}
    </button>
  )

  let card: React.ReactNode
  if (!st) {
    card = <IntegrationCard color={COLOR} logo={<TelegramLogo />} name="Telegram" desc={tx.desc} on={false}
      statusLabel="…" actions={<span className="ic-note"><Loader2 size={12} className="ic-spin" /></span>} delay={delay} />
  } else if (on) {
    card = (
      <IntegrationCard color={COLOR} logo={<TelegramLogo />} name="Telegram" on statusLabel={tx.connected} delay={delay}
        onOpen={() => setOpen(true)}
        desc={<>{st.username ?? "Telegram"}{st.bot ? <> → @{st.bot}</> : null}</>}
        actions={<>
          <button className="ic-btn primary" onClick={() => setOpen(true)}><Settings2 size={14} /> {tx.settings}</button>
          {botUrl && <a className="ic-btn" href={botUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {tx.openBot}</a>}
        </>}
        right={
          <button className={`ic-tgl${st.notifyReports ? " on" : ""}`} onClick={toggleNotify} aria-pressed={st.notifyReports}>
            <span className={`ic-sw${st.notifyReports ? " on" : ""}`}><i /></span>{tx.reports}
          </button>
        } />
    )
  } else {
    card = (
      <IntegrationCard color={COLOR} logo={<TelegramLogo />} name="Telegram" on={false} delay={delay}
        statusLabel={ready ? tx.notConnected : tx.soon} onOpen={() => setOpen(true)}
        desc={waiting ? tx.waiting : tx.desc}
        actions={<>
          {ready && (waiting
            ? <a className="ic-btn primary" href={linkUrl!} target="_blank" rel="noopener noreferrer"><Loader2 size={14} className="ic-spin" /> {tx.reopen}</a>
            : connectBtn)}
          <button className="ic-btn" onClick={() => setOpen(true)}>{tx.stepsTitle}</button>
        </>} />
    )
  }

  return (
    <>
      {card}
      <IntegrationDrawer open={open} onClose={() => setOpen(false)} color={COLOR} logo={<TelegramLogo size={48} />}
        title="Telegram" subtitle={tx.drawerSub}
        footer={on ? <>
          <button className="ic-btn" onClick={sendTest} disabled={busy === "test"}>
            {busy === "test" ? <Loader2 size={13} className="ic-spin" /> : <BellRing size={13} />} {tx.test}
          </button>
          {botUrl && <a className="ic-btn" href={botUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {tx.openBot}</a>}
          <button onClick={disconnect} disabled={busy === "off"} className="ic-btn warn push">
            {busy === "off" ? <Loader2 size={13} className="ic-spin" /> : <Unlink size={13} />} {tx.disconnect}
          </button>
        </> : ready ? (waiting
          ? <a className="ic-btn primary" href={linkUrl!} target="_blank" rel="noopener noreferrer"><Loader2 size={14} className="ic-spin" /> {tx.reopen}</a>
          : connectBtn) : undefined}>

        <div className="idr-flow">
          <div className="idr-node a">A</div>
          <div className={`idr-line${on ? " on" : ""}`} />
          <span className={`icd-pill${on ? " on" : ""}`}>{on && <span className="icd-live" />}{on ? tx.connected : ready ? tx.notConnected : tx.soon}</span>
          <div className={`idr-line${on ? " on" : ""}`} />
          <TelegramLogo size={38} />
        </div>

        {msg && <div className={`idr-msg${msg.ok ? " ok" : ""}`}>{msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {msg.text}</div>}
        {waiting && <div className="idr-msg ok" style={{ color: "#7DD3FC", borderColor: "rgba(42,171,238,.3)", background: "rgba(42,171,238,.07)" }}><Loader2 size={14} className="ic-spin" /> {tx.waiting}</div>}
        {st && !st.configured && <div className="idr-msg"><AlertTriangle size={14} /> {tx.notConfigured}</div>}
        {st?.setupError && <div className="idr-msg"><AlertTriangle size={14} /> {tx.setupError}</div>}

        {on && st && (
          <>
            <div>
              <div className="idr-label">{tx.chat}</div>
              <div className="idr-field"><span>{st.username ?? "Telegram"}{st.bot ? `  →  @${st.bot}` : ""}</span></div>
            </div>
            <button className={`np-auto${st.notifyReports ? " on" : ""}`} onClick={toggleNotify} aria-pressed={st.notifyReports}>
              <span className="np-auto-tx"><b>{tx.notifyTitle}</b><small>{tx.notifyHint}</small></span>
              <span className={`ic-sw big${st.notifyReports ? " on" : ""}`}><i /></span>
            </button>
            <div>
              <div className="idr-label">{tx.cmdsTitle}</div>
              <div className="idr-caps">
                {tx.cmds.map(([c, d]) => (
                  <div key={c} className="idr-cap"><code style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#7DD3FC", minWidth: 72 }}>{c}</code>{d}</div>
                ))}
              </div>
            </div>
          </>
        )}

        {st && !on && (
          <div>
            <div className="idr-label">{tx.stepsTitle}</div>
            <div className="idr-steps">
              {tx.steps.map((s, i) => <div key={i} className="idr-step"><b>{i + 1}</b><span>{s}</span></div>)}
            </div>
          </div>
        )}

        <div className="idr-msg" style={{ color: "#A8A4BC", background: "rgba(255,255,255,.03)", borderColor: "rgba(255,255,255,.08)" }}>
          <Send size={13} /> {tx.soonChat}
        </div>
      </IntegrationDrawer>
      <style>{`
        .np-auto { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 14px; border-radius: 12px; cursor: pointer; text-align: left; font-family: inherit;
          background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.1); transition: background .2s, border-color .2s; }
        .np-auto.on { background: rgba(34,197,94,.06); border-color: rgba(34,197,94,.3); }
        .np-auto-tx { flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .np-auto-tx b { font-size: 13.5px; font-weight: 600; color: #F0EDF8; }
        .np-auto-tx small { font-size: 12px; color: #8C8AA6; }
        .ic-sw.big { width: 36px; height: 20px; border-radius: 10px; }
        .ic-sw.big i { width: 16px; height: 16px; }
        .ic-sw.big.on i { transform: translateX(16px); }
      `}</style>
    </>
  )
}
