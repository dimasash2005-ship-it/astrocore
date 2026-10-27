"use client"

// components/feedback/HelpModal.tsx
//
// "Help & feedback" window: the user picks what it is about (problem, idea, likes it, other),
// writes a message and sends it to the AstroCore team (POST /api/feedback).
// The current page is attached automatically so problems are easier to reproduce.
// Opened from the sidebar (components/layout/Sidebar.tsx).

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePathname } from "next/navigation"
import { LifeBuoy, X, Bug, Lightbulb, Heart, MessageCircle, Loader2, Check, Send, BookOpen } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

const DISCORD = "https://discord.gg/aQevqZxPqc"
const TELEGRAM = "https://t.me/AstroCore_Manager"

type Kind = "bug" | "idea" | "love" | "other"

const KINDS: { id: Kind; icon: React.ElementType; color: string; uk: string; en: string; phUk: string; phEn: string }[] = [
  { id: "bug",   icon: Bug,           color: "#FF4D6A", uk: "Проблема",      en: "Problem",
    phUk: "Що сталося? Що ти робив перед цим і що очікував побачити? Наприклад: «підключив провайдера, написав агенту, отримав помилку…»",
    phEn: "What happened? What did you do before it and what did you expect? E.g. \"connected a provider, messaged the agent, got an error…\"" },
  { id: "idea",  icon: Lightbulb,     color: "#F59E0B", uk: "Ідея",          en: "Idea",
    phUk: "Чого тобі не вистачає в AstroCore? Що агент мав би вміти?",
    phEn: "What's missing in AstroCore? What should your agent be able to do?" },
  { id: "love",  icon: Heart,         color: "#22C55E", uk: "Подобається",   en: "Love it",
    phUk: "Що сподобалось? Навіть одне речення дуже допомагає зрозуміти, що робити далі.",
    phEn: "What did you like? Even one sentence helps a lot." },
  { id: "other", icon: MessageCircle, color: "#A78BFA", uk: "Інше",          en: "Other",
    phUk: "Пиши як є: питання, скарга, побажання.",
    phEn: "Anything: a question, a complaint, a wish." },
]

export default function HelpModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { language } = useLanguage()
  const uk = language === "uk"
  const pathname = usePathname()

  const [mounted, setMounted] = useState(false)
  const [kind, setKind] = useState<Kind>("bug")
  const [text, setText] = useState("")
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle")
  const [err, setErr] = useState("")
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setMounted(true) }, [])

  // Keep the latest onClose without re-running the effect on every parent render.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    setState("idle"); setErr("")
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") closeRef.current() }
    window.addEventListener("keydown", fn)
    const t = setTimeout(() => taRef.current?.focus(), 60)
    return () => { window.removeEventListener("keydown", fn); clearTimeout(t) }
  }, [open])

  if (!mounted || !open) return null

  const k = KINDS.find(x => x.id === kind)!

  async function send() {
    const message = text.trim()
    if (message.length < 3) { setErr(uk ? "Напиши хоча б кілька слів." : "Please write at least a few words."); return }
    setState("sending"); setErr("")
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, message, page: pathname }),
      })
      if (res.ok) { setState("sent"); setText(""); return }
      const data = await res.json().catch(() => ({}))
      setState("error")
      setErr(data?.error === "too_many"
        ? (uk ? "Забагато повідомлень за короткий час. Спробуй за кілька хвилин." : "Too many messages in a short time. Try again in a few minutes.")
        : (uk ? "Не вдалося надіслати. Спробуй ще раз або напиши в Discord." : "Couldn't send. Try again or write in Discord."))
    } catch {
      setState("error")
      setErr(uk ? "Немає з'єднання. Спробуй ще раз." : "No connection. Try again.")
    }
  }

  return createPortal(
    <div className="hm-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}>
      <style>{`
        .hm-overlay { position: fixed; inset: 0; z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: hmFade .16s ease-out; }
        .hm { width: 100%; max-width: 500px; max-height: 92vh; overflow-y: auto; border-radius: 18px; padding: 20px;
          background: linear-gradient(160deg,#111120 0%,#0C0C18 100%); border: 0.5px solid rgba(232,0,42,.28);
          box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 50px rgba(232,0,42,.08); animation: hmPop .22s cubic-bezier(.2,.9,.3,1.2);
          font-family: inherit; color: #F0EDF8; }
        @keyframes hmFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes hmPop { from { opacity: 0; transform: translateY(10px) scale(.97) } to { opacity: 1; transform: none } }
        .hm-ic { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0;
          background: #E8002A; color: #fff; box-shadow: 0 0 16px rgba(232,0,42,.4); }
        .hm-x { margin-left: auto; width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; cursor: pointer;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.08); color: #8A8AAA; }
        .hm-x:hover { color: #fff; background: rgba(255,255,255,.08); }
        .hm-kinds { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 7px; margin-top: 16px; }
        .hm-kind { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 10px 6px; border-radius: 11px; cursor: pointer;
          font-size: 12px; font-family: inherit; color: #B4B0C8; background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); transition: all .15s; }
        .hm-kind:hover { color: #fff; border-color: color-mix(in srgb, var(--c) 45%, transparent); }
        .hm-kind.on { color: #fff; background: color-mix(in srgb, var(--c) 13%, transparent); border-color: color-mix(in srgb, var(--c) 60%, transparent);
          box-shadow: 0 0 18px color-mix(in srgb, var(--c) 16%, transparent); }
        .hm-ta { width: 100%; min-height: 130px; margin-top: 12px; padding: 12px; border-radius: 12px; resize: vertical; outline: none;
          font-family: inherit; font-size: 13.5px; line-height: 1.55; color: #F0EDF8; background: #07070D; border: 0.5px solid rgba(255,255,255,.10); }
        .hm-ta:focus { border-color: rgba(232,0,42,.5); box-shadow: 0 0 0 3px rgba(232,0,42,.12); }
        .hm-meta { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: #8A8AAA; }
        .hm-send { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; height: 40px; margin-top: 12px; border-radius: 11px;
          border: none; cursor: pointer; font-family: inherit; font-size: 13.5px; font-weight: 600; color: #fff; background: #E8002A; transition: background .15s, box-shadow .15s; }
        .hm-send:hover:not(:disabled) { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); }
        .hm-send:disabled { opacity: .6; cursor: default; }
        .hm-err { margin-top: 10px; font-size: 12px; color: #FF4D6A; }
        .hm-links { display: flex; flex-wrap: wrap; gap: 7px; margin-top: 16px; padding-top: 14px; border-top: 0.5px solid rgba(255,255,255,.07); }
        .hm-link { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; font-size: 12px; text-decoration: none;
          color: #C8C4D8; background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); }
        .hm-link:hover { color: #fff; border-color: rgba(255,255,255,.18); }
        .hm-ok { text-align: center; padding: 18px 6px 6px; }
        .hm-ok i { width: 48px; height: 48px; margin: 0 auto 12px; border-radius: 50%; display: grid; place-items: center;
          background: rgba(34,197,94,.14); border: 0.5px solid rgba(34,197,94,.45); color: #22C55E; }
        .hm-spin { animation: hmSpin .8s linear infinite; } @keyframes hmSpin { to { transform: rotate(360deg) } }
        @media (max-width: 440px) { .hm-kinds { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (prefers-reduced-motion: reduce) { .hm, .hm-overlay { animation: none; } }
      `}</style>

      <div className="hm" role="dialog" aria-modal="true" aria-labelledby="hm-title">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="hm-ic"><LifeBuoy size={18} /></span>
          <div>
            <div id="hm-title" style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>
              {uk ? "Допомога і відгуки" : "Help & feedback"}
            </div>
            <div style={{ fontSize: 12, color: "#A8A4BC", marginTop: 2, lineHeight: 1.45 }}>
              {uk
                ? "Пиши все: проблеми з агентом, ідеї, що подобається і що ні. Я читаю кожне повідомлення."
                : "Tell us anything: agent problems, ideas, what you like and what you don't. Every message is read."}
            </div>
          </div>
          <button className="hm-x" onClick={onClose} aria-label={uk ? "Закрити" : "Close"}><X size={14} /></button>
        </div>

        {state === "sent" ? (
          <div className="hm-ok">
            <i><Check size={22} /></i>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600 }}>{uk ? "Дякую, отримали!" : "Thanks, got it!"}</div>
            <div style={{ fontSize: 12.5, color: "#A8A4BC", marginTop: 6, lineHeight: 1.55 }}>
              {uk
                ? "Якщо це проблема, відповімо на пошту твого акаунта. Швидше за все, можна отримати відповідь у Discord."
                : "If it's a problem, we'll reply to your account email. The fastest way to get an answer is Discord."}
            </div>
            <button className="hm-send" style={{ marginTop: 16 }} onClick={() => setState("idle")}>
              {uk ? "Написати ще" : "Write another"}
            </button>
          </div>
        ) : (
          <>
            <div className="hm-kinds" role="radiogroup" aria-label={uk ? "Тема" : "Topic"}>
              {KINDS.map(x => {
                const I = x.icon
                return (
                  <button key={x.id} type="button" role="radio" aria-checked={kind === x.id}
                    className={`hm-kind${kind === x.id ? " on" : ""}`}
                    style={{ ["--c" as string]: x.color } as React.CSSProperties}
                    onClick={() => setKind(x.id)}>
                    <I size={16} style={{ color: x.color }} />
                    {uk ? x.uk : x.en}
                  </button>
                )
              })}
            </div>

            <textarea ref={taRef} className="hm-ta" value={text} maxLength={3000}
              onChange={e => { setText(e.target.value); if (err) setErr("") }}
              placeholder={uk ? k.phUk : k.phEn}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send() }} />
            <div className="hm-meta">
              <span>{uk ? "Сторінка" : "Page"}: {pathname}</span>
              <span>{text.length}/3000</span>
            </div>

            <button className="hm-send" onClick={send} disabled={state === "sending"}>
              {state === "sending" ? <Loader2 size={15} className="hm-spin" /> : <Send size={15} />}
              {state === "sending" ? (uk ? "Надсилаю…" : "Sending…") : (uk ? "Надіслати" : "Send")}
            </button>
            {err && <div className="hm-err">{err}</div>}
          </>
        )}

        <div className="hm-links">
          <a className="hm-link" href={DISCORD} target="_blank" rel="noopener noreferrer">💬 Discord</a>
          <a className="hm-link" href={TELEGRAM} target="_blank" rel="noopener noreferrer">✈️ Telegram</a>
          <a className="hm-link" href="/guides" target="_blank" rel="noopener noreferrer"><BookOpen size={12} /> {uk ? "Гайди" : "Guides"}</a>
        </div>
      </div>
    </div>,
    document.body,
  )
}