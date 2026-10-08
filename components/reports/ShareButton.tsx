"use client"

// "Share" button for a report: turns a public link on/off, copies it,
// chooses what the public page shows, and shows view count.
// Usage: <ShareButton reportId={report.id} />

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Share2, Check, Copy, Loader2, X, Eye, Globe, Lock, BarChart3, Link2, User, ExternalLink } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

type ShareState = {
  shareId: string | null
  isPublic: boolean
  showCharts: boolean
  showSources: boolean
  showAuthor: boolean
  views: number
  url: string | null
}

const L = {
  uk: {
    share: "Поділитися", title: "Поділитися звітом",
    sub: "Чат, памʼять та інші звіти лишаються приватними.",
    on: "Публічне посилання увімкнено", off: "Звіт приватний",
    copy: "Копіювати", copied: "Скопійовано",
    charts: "Показувати графіки", sources: "Показувати джерела", author: "Показувати моє імʼя",
    views: "переглядів", open: "Відкрити сторінку", error: "Не вдалося зберегти. Спробуй ще раз.",
    loadError: "Не вдалося завантажити налаштування. Перевір, що SQL для звітів виконано в Supabase.",
    onHint: "Будь-хто з посиланням може відкрити", offHint: "Бачиш тільки ти", linkLabel: "Посилання", showLabel: "Що показувати",
    shareText: "Звіт мого OpenClaw-агента в AstroCore",
  },
  en: {
    share: "Share", title: "Share report",
    sub: "Chat, memory and other reports stay private.",
    on: "Public link is on", off: "Report is private",
    copy: "Copy", copied: "Copied",
    charts: "Show charts", sources: "Show sources", author: "Show my name",
    views: "views", open: "Open page", error: "Couldn't save. Try again.",
    loadError: "Couldn't load share settings. Check that the reports SQL was run in Supabase.",
    onHint: "Anyone with the link can open it", offHint: "Only you can see it", linkLabel: "Link", showLabel: "What to show",
    shareText: "A report by my OpenClaw agent in AstroCore",
  },
}

export default function ShareButton({ reportId, title }: { reportId: string; title?: string }) {
  const { language } = useLanguage()
  const tx = L[language === "uk" ? "uk" : "en"]

  const [open, setOpen]     = useState(false)
  const [state, setState]   = useState<ShareState | null>(null)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState("")
  const [copied, setCopied] = useState(false)
  const [loadError, setLoadError] = useState("")
  const boxRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  // The popup is rendered into <body> (portal) so nothing on the page can cover it.
  useLayoutEffect(() => {
    if (!open) return
    const place = () => {
      const r = boxRef.current?.getBoundingClientRect()
      if (r) setPos({ top: r.bottom + 10, right: Math.max(16, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener("resize", place)
    window.addEventListener("scroll", place, true)
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true) }
  }, [open])

  useEffect(() => {
    if (!open) return
    setLoadError("")
    fetch(`/api/reports/share?reportId=${encodeURIComponent(reportId)}`, { cache: "no-store" })
      .then(async r => {
        const d = await r.json().catch(() => ({}))
        if (!r.ok || d.error) setLoadError(`${r.status}: ${d.error || "error"}`)
        else setState(d)
      })
      .catch(() => setLoadError("network"))
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown) }
  }, [open, reportId])

  async function save(patch: Partial<{ enabled: boolean; showCharts: boolean; showSources: boolean; showAuthor: boolean }>) {
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/reports/share", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId, ...patch }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d?.error)
      setState(d)
    } catch {
      setError(tx.error)
    } finally {
      setBusy(false)
    }
  }

  function copy() {
    if (!state?.url) return
    navigator.clipboard.writeText(state.url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) }).catch(() => {})
  }

  const url = state?.url ?? ""
  const text = title ? `${title} · ${tx.shareText}` : tx.shareText
  const socials = [
    { name: "Telegram", color: "#2AABEE", icon: "M9.78 18.65l.28-4.23 7.68-6.92c.34-.31-.07-.46-.52-.19L7.74 13.3 3.64 12c-.88-.25-.89-.86.2-1.3l15.97-6.16c.73-.33 1.43.18 1.15 1.3l-2.72 12.81c-.19.91-.74 1.13-1.5.71L12.6 16.3l-1.99 1.93c-.23.23-.42.42-.83.42z", href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
    { name: "Threads", color: "#FFFFFF", icon: "M12.19 22h-.01c-3.02-.02-5.34-1.01-6.9-2.95C3.9 17.33 3.18 14.94 3.16 12c.02-2.95.74-5.33 2.12-7.06C6.84 3.01 9.17 2.02 12.18 2h.01c2.31.02 4.25.61 5.75 1.77 1.42 1.09 2.42 2.64 2.97 4.6l-1.73.48c-.93-3.33-3.3-5.04-7-5.07-2.45.02-4.3.79-5.5 2.28C5.56 7.46 4.98 9.47 4.96 12c.02 2.53.6 4.54 1.72 5.94 1.2 1.5 3.05 2.27 5.5 2.28 2.2-.02 3.66-.53 4.88-1.71 1.39-1.35 1.36-3.01.92-4.02-.26-.6-.73-1.1-1.37-1.48-.16 1.13-.52 2.05-1.08 2.74-.75.93-1.81 1.44-3.15 1.51-1.01.06-1.99-.18-2.75-.68-.9-.6-1.43-1.5-1.48-2.55-.11-2.07 1.53-3.56 4.09-3.71.91-.05 1.76-.01 2.54.12-.1-.63-.31-1.13-.63-1.49-.44-.5-1.12-.76-2.02-.76h-.03c-.72 0-1.7.2-2.32 1.13l-1.5-1.01c.84-1.24 2.2-1.92 3.82-1.92h.04c2.71.02 4.32 1.68 4.48 4.58.09.04.18.08.27.12 1.26.59 2.18 1.49 2.67 2.6.68 1.55.74 4.07-1.31 6.08-1.57 1.53-3.47 2.22-6.17 2.24z", href: `https://www.threads.net/intent/post?text=${encodeURIComponent(`${text} ${url}`)}` },
    { name: "X", color: "#FFFFFF", icon: "M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23zm-1.16 17.52h1.83L7.08 4.13H5.12z", href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}` },
  ]

  return (
    <div ref={boxRef} className="shr">
      <style>{STYLES}</style>
      <button className={`shr-btn${state?.isPublic ? " live" : ""}`} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <Share2 size={14} /> {tx.share}
        {state?.isPublic && <span className="shr-dot" aria-hidden />}
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popRef} className="shr-pop" role="dialog" aria-label={tx.title} style={{ top: pos.top, right: pos.right }}>
          <style>{STYLES}</style>
          <div className="shr-head">
            <span className="shr-ic"><Share2 size={16} /></span>
            <div style={{ minWidth: 0 }}>
              <h4>{tx.title}</h4>
              <p className="shr-sub">{tx.sub}</p>
            </div>
            <button className="shr-x" onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button>
          </div>

          {!state && loadError ? (
            <div className="shr-err">{tx.loadError} <code>{loadError}</code></div>
          ) : !state ? (
            <div className="shr-load"><Loader2 size={16} className="shr-spin" /></div>
          ) : (
            <>
              <button className={`shr-tgl${state.isPublic ? " on" : ""}`} onClick={() => save({ enabled: !state.isPublic })} disabled={busy} aria-pressed={state.isPublic}>
                <span className="shr-tgl-ic">{state.isPublic ? <Globe size={15} /> : <Lock size={15} />}</span>
                <span className="shr-tgl-tx">
                  <b>{state.isPublic ? tx.on : tx.off}</b>
                  <small>{state.isPublic ? tx.onHint : tx.offHint}</small>
                </span>
                {busy ? <Loader2 size={14} className="shr-spin" /> : <span className={`shr-sw${state.isPublic ? " on" : ""}`}><i /></span>}
              </button>

              {state.isPublic && url && (
                <>
                  <div className="shr-sec">{tx.linkLabel}</div>
                  <div className="shr-link">
                    <Link2 size={13} style={{ color: "#6A6A8A", flexShrink: 0 }} />
                    <span>{url.replace(/^https?:\/\//, "")}</span>
                    <button className={copied ? "ok" : ""} onClick={copy}>{copied ? <><Check size={12} /> {tx.copied}</> : <><Copy size={12} /> {tx.copy}</>}</button>
                  </div>

                  <div className="shr-sec">{tx.showLabel}</div>
                  <div className="shr-opts">
                    {([
                      ["showCharts", tx.charts, state.showCharts, BarChart3],
                      ["showSources", tx.sources, state.showSources, ExternalLink],
                      ["showAuthor", tx.author, state.showAuthor, User],
                    ] as const).map(([k, label, val, Icon]) => (
                      <button key={k} type="button" className="shr-opt" disabled={busy} aria-pressed={val}
                        onClick={() => save({ [k]: !val } as Record<string, boolean>)}>
                        <Icon size={14} className="shr-opt-ic" />
                        <span>{label}</span>
                        <span className={`shr-sw sm${val ? " on" : ""}`}><i /></span>
                      </button>
                    ))}
                  </div>

                  <div className="shr-soc">
                    {socials.map(s => (
                      <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" style={{ ["--b" as string]: s.color } as React.CSSProperties}>
                        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden><path d={s.icon} fill="currentColor" /></svg>
                        {s.name}
                      </a>
                    ))}
                  </div>

                  <div className="shr-foot">
                    <span className="shr-views"><Eye size={13} /> <b>{state.views}</b> {tx.views}</span>
                    <a className="shr-open" href={url} target="_blank" rel="noopener noreferrer">{tx.open} <ExternalLink size={12} /></a>
                  </div>
                </>
              )}
              {error && <div className="shr-err">{error}</div>}
            </>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

const STYLES = `
  .shr { position: relative; display: inline-block; }
  .shr-btn { position: relative; display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; cursor: pointer;
    font-size: 13px; font-weight: 500; font-family: inherit; color: #fff; background: #E8002A; border: none; transition: background .13s, box-shadow .13s, transform .13s; }
  .shr-btn:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
  .shr-btn.live { background: rgba(34,197,94,.12); color: #22C55E; border: 0.5px solid rgba(34,197,94,.4); }
  .shr-btn.live:hover { background: rgba(34,197,94,.2); box-shadow: 0 0 18px rgba(34,197,94,.25); }
  .shr-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 8px rgba(34,197,94,.9); }
  .shr-pop { position: fixed; z-index: 1000; width: 390px; max-width: calc(100vw - 32px); max-height: calc(100vh - 40px); overflow-y: auto;
    border-radius: 18px; padding: 18px; display: flex; flex-direction: column; gap: 10px;
    background: linear-gradient(160deg, #151526 0%, #0D0D18 100%); border: 0.5px solid rgba(232,0,42,.32);
    box-shadow: 0 24px 60px rgba(0,0,0,.75), 0 0 40px rgba(232,0,42,.07); animation: shrIn .18s ease-out; }
  @keyframes shrIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @keyframes shrSpin { to { transform: rotate(360deg); } }
  .shr-spin { animation: shrSpin .8s linear infinite; }
  .shr-head { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 6px; }
  .shr-ic { width: 36px; height: 36px; border-radius: 11px; flex: none; display: grid; place-items: center; color: #fff;
    background: linear-gradient(135deg, #E8002A, #9E001D); box-shadow: 0 0 18px rgba(232,0,42,.4); }
  .shr-head h4 { margin: 1px 0 0; font: 600 16px 'Space Grotesk', sans-serif; color: #F0EDF8; }
  .shr-x { margin-left: auto; width: 30px; height: 30px; flex: none; padding: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    background: transparent; border: 0.5px solid rgba(255,255,255,.08); color: #6A6A8A; cursor: pointer; }
  .shr-x:hover { color: #fff; border-color: rgba(232,0,42,.35); }
  .shr-sub { margin: 3px 0 0; font-size: 12px; line-height: 1.45; color: #8C8AA6; }
  .shr-sec { margin-top: 6px; font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #6A6A8A; }
  .shr-load { display: flex; justify-content: center; padding: 14px; color: #A8A4BC; }
  .shr-tgl { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border-radius: 13px; cursor: pointer; text-align: left; transition: border-color .2s, background .2s;
    font-size: 13px; font-weight: 500; font-family: inherit; color: #F0EDF8; background: rgba(255,255,255,.035); border: 0.5px solid rgba(255,255,255,.1); }
  .shr-tgl:disabled { cursor: default; }
  .shr-tgl.on { background: rgba(34,197,94,.07); border-color: rgba(34,197,94,.35); }
  .shr-tgl-ic { width: 32px; height: 32px; border-radius: 10px; flex: none; display: grid; place-items: center; color: #8C8AA6; background: rgba(255,255,255,.05); }
  .shr-tgl.on .shr-tgl-ic { color: #22C55E; background: rgba(34,197,94,.14); }
  .shr-tgl-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .shr-tgl-tx b { font-size: 13.5px; font-weight: 600; color: #F0EDF8; }
  .shr-tgl-tx small { font-size: 11.5px; color: #8C8AA6; }
  .shr-sw { position: relative; width: 36px; height: 20px; border-radius: 10px; flex: none; background: rgba(255,255,255,.12); transition: background .2s; }
  .shr-sw i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #C8C4D8; transition: transform .2s, background .2s; }
  .shr-sw.on { background: #22C55E; box-shadow: 0 0 12px rgba(34,197,94,.35); }
  .shr-sw.on i { transform: translateX(16px); background: #fff; }
  .shr-sw.sm { width: 30px; height: 17px; }
  .shr-sw.sm i { width: 13px; height: 13px; }
  .shr-sw.sm.on i { transform: translateX(13px); }
  .shr-link { display: flex; align-items: center; gap: 9px; padding: 7px 7px 7px 12px; border-radius: 11px; background: #07070D; border: 0.5px solid rgba(255,255,255,.1); }
  .shr-link span { flex: 1; min-width: 0; font: 12px 'JetBrains Mono', monospace; color: #7DD3FC; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .shr-link button { display: inline-flex; align-items: center; gap: 5px; padding: 5px 9px; border-radius: 7px; cursor: pointer; font-size: 11.5px; font-weight: 500; font-family: inherit;
    color: #fff; background: #E8002A; border: none; white-space: nowrap; transition: background .15s; }
  .shr-link button:hover { background: #FF1A3E; }
  .shr-link button.ok { background: #16A34A; }
  .shr-opts { display: flex; flex-direction: column; border-radius: 12px; overflow: hidden; background: rgba(255,255,255,.025); border: 0.5px solid rgba(255,255,255,.08); }
  .shr-opt { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; cursor: pointer; text-align: left; font-size: 13px; font-family: inherit;
    color: #C8C4D8; background: transparent; border: none; border-top: 0.5px solid rgba(255,255,255,.06); transition: background .13s; }
  .shr-opt:first-child { border-top: none; }
  .shr-opt:hover { background: rgba(255,255,255,.03); }
  .shr-opt span:not(.shr-sw) { flex: 1; }
  .shr-opt-ic { color: #6A6A8A; flex: none; }
  .shr-soc { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 4px; }
  .shr-soc a { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 9px 0; border-radius: 10px; font-size: 12.5px; font-weight: 500; color: #C8C4D8; text-decoration: none;
    background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.1); transition: all .13s; }
  .shr-soc a svg { color: var(--b); }
  .shr-soc a:hover { color: #fff; border-color: color-mix(in srgb, var(--b) 50%, transparent); background: color-mix(in srgb, var(--b) 10%, transparent); }
  .shr-foot { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; padding-top: 12px; border-top: 0.5px solid rgba(255,255,255,.07); }
  .shr-views { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #8C8AA6; }
  .shr-views b { font: 600 13px 'JetBrains Mono', monospace; color: #F0EDF8; }
  .shr-open { display: inline-flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px; font-size: 12.5px; font-weight: 500; text-decoration: none;
    color: #F0EDF8; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.12); transition: all .13s; }
  .shr-open:hover { border-color: rgba(232,0,42,.45); background: rgba(232,0,42,.08); }
  .shr-err { font-size: 12px; line-height: 1.5; color: #FF6B85; }
  .shr-err code { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #FFB4C0; overflow-wrap: anywhere; }
  @media (prefers-reduced-motion: reduce) { .shr-pop { animation: none; } }
`