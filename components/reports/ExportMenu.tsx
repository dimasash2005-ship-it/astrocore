"use client"

// "Export" button for a report: Notion, Google Docs, PDF, Markdown, copy text.
// Usage: <ExportMenu reportId={report.id} title={report.company_name} markdown={md} notionUrl={report.notion_url} />

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  Download, X, Loader2, Check, ExternalLink, FileText, Printer, FileCode2, Copy, ChevronRight, Search, RefreshCw, AlertTriangle,
} from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

type NotionStatus = {
  configured: boolean
  connected: boolean
  workspaceName: string | null
  parent: { id: string; title: string; icon: string | null } | null
  autoExport: boolean
}
type NotionPage = { id: string; title: string; icon: string | null }

const L = {
  uk: {
    export: "Експорт", title: "Експорт звіту", sub: "Відправ звіт туди, де ти працюєш.",
    notion: "Notion", notionConnect: "Підключити й надіслати", notionSend: "Надіслати в", notionPick: "Вибери сторінку для звітів",
    notionSoon: "Скоро", change: "змінити", sending: "Надсилаю…", sent: "Надіслано в Notion", open: "Відкрити",
    already: "Уже є в Notion", again: "Надіслати ще раз", reconnect: "Підключити знову",
    search: "Пошук сторінки…", noPages: "Немає доступних сторінок. Підключи Notion ще раз і дай доступ хоча б до однієї сторінки.",
    gdocs: "Google Docs", gdocsSub: "Скопіювати з форматуванням", gdocsDone: "Скопійовано!", gdocsPaste: "Відкрий Google Docs і встав:", gdocsOpen: "Відкрити",
    pdf: "PDF", pdfSub: "Зберегти або надрукувати",
    md: "Markdown", mdSub: "Файл .md для Obsidian та інших",
    copy: "Копіювати текст", copySub: "Звичайний текст у буфер", copied: "Скопійовано",
    auto: "Автоматично надсилати нові звіти", autoHint: "Звіти місій самі з'являтимуться в Notion",
  },
  en: {
    export: "Export", title: "Export report", sub: "Send the report where you work.",
    notion: "Notion", notionConnect: "Connect and send", notionSend: "Send to", notionPick: "Choose a page for reports",
    notionSoon: "Soon", change: "change", sending: "Sending…", sent: "Sent to Notion", open: "Open",
    already: "Already in Notion", again: "Send again", reconnect: "Connect again",
    search: "Search pages…", noPages: "No pages available. Connect Notion again and share at least one page.",
    gdocs: "Google Docs", gdocsSub: "Copy with formatting", gdocsDone: "Copied!", gdocsPaste: "Open Google Docs and paste:", gdocsOpen: "Open",
    pdf: "PDF", pdfSub: "Save or print",
    md: "Markdown", mdSub: ".md file for Obsidian and others",
    copy: "Copy text", copySub: "Plain text to clipboard", copied: "Copied",
    auto: "Send new reports automatically", autoHint: "Mission reports will appear in Notion by themselves",
  },
}

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

function fileName(title: string) {
  return (title || "report").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 80) || "report"
}

export default function ExportMenu({ reportId, title, markdown, notionUrl: initialNotionUrl, buttonStyle }: {
  reportId: string
  title: string
  markdown: string
  notionUrl?: string | null
  buttonStyle?: React.CSSProperties
}) {
  const { language } = useLanguage()
  const uk = language === "uk"
  const tx = L[uk ? "uk" : "en"]

  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const popRef = useRef<HTMLDivElement>(null)
  const htmlRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null)

  const [notion, setNotion] = useState<NotionStatus | null>(null)
  const [notionUrl, setNotionUrl] = useState<string | null>(initialNotionUrl ?? null)
  const [sending, setSending] = useState(false)
  const [justSent, setJustSent] = useState(false)
  const [notionErr, setNotionErr] = useState<{ code: string; message: string } | null>(null)
  const [picking, setPicking] = useState(false)
  const [pages, setPages] = useState<NotionPage[] | null>(null)
  const [query, setQuery] = useState("")
  const [savingParent, setSavingParent] = useState<string | null>(null)

  const [done, setDone] = useState<"" | "gdocs" | "copy" | "md">("")

  useEffect(() => { setNotionUrl(initialNotionUrl ?? null) }, [initialNotionUrl])

  // Popup is rendered into <body> so nothing on the page can cover it.
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
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node
      if (boxRef.current?.contains(t) || popRef.current?.contains(t)) return
      setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("mousedown", onDown)
    return () => { window.removeEventListener("keydown", onKey); document.removeEventListener("mousedown", onDown) }
  }, [open])

  const loadNotion = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/notion", { cache: "no-store" })
      const d = await r.json()
      if (r.ok) setNotion(d)
      else setNotion({ configured: false, connected: false, workspaceName: null, parent: null, autoExport: false })
    } catch {
      setNotion({ configured: false, connected: false, workspaceName: null, parent: null, autoExport: false })
    }
  }, [])

  useEffect(() => { if (open && !notion) loadNotion() }, [open, notion, loadNotion])

  const sendToNotion = useCallback(async () => {
    setSending(true); setNotionErr(null); setJustSent(false)
    try {
      const r = await fetch("/api/integrations/notion/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId }),
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok || !d.ok) {
        setNotionErr({ code: d.code ?? "unknown", message: d.error ?? "Error" })
        if (d.code === "choose_parent") setPicking(true)
        return
      }
      setNotionUrl(d.url)
      setJustSent(true)
    } catch {
      setNotionErr({ code: "unknown", message: uk ? "Немає зв'язку. Спробуй ще раз." : "Network error. Try again." })
    } finally {
      setSending(false)
    }
  }, [reportId, uk])

  // Back from Notion's "Allow access" screen: open the menu and send right away.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const status = p.get("notion")
    if (!status || p.get("export") !== "notion") return
    p.delete("notion"); p.delete("export")
    const q = p.toString()
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : "") + window.location.hash)
    setOpen(true)
    if (status === "connected") {
      loadNotion().then(() => sendToNotion())
    } else if (status === "not_configured") {
      setNotionErr({ code: "not_configured", message: uk ? "Notion ще не налаштований на сервері." : "Notion is not set up on the server yet." })
    } else if (status === "error") {
      setNotionErr({ code: "reconnect", message: uk ? "Не вдалося підключити Notion. Спробуй ще раз." : "Couldn't connect Notion. Try again." })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function connectNotion() {
    const next = `${window.location.pathname}?export=notion`
    window.location.href = `/api/integrations/notion/connect?next=${encodeURIComponent(next)}`
  }

  // Page picker
  useEffect(() => {
    if (!picking || !notion?.connected) return
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/integrations/notion/pages?q=${encodeURIComponent(query)}`, { cache: "no-store" })
        const d = await r.json()
        if (!r.ok) { setNotionErr({ code: d.code ?? "unknown", message: d.error ?? "Error" }); setPages([]); return }
        setPages(d.pages ?? [])
      } catch { setPages([]) }
    }, query ? 300 : 0)
    return () => clearTimeout(id)
  }, [picking, query, notion?.connected])

  async function chooseParent(page: NotionPage) {
    setSavingParent(page.id); setNotionErr(null)
    try {
      const r = await fetch("/api/integrations/notion", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parentId: page.id }),
      })
      const d = await r.json()
      if (!r.ok) { setNotionErr({ code: d.code ?? "unknown", message: d.error ?? "Error" }); return }
      setNotion(d)
      setPicking(false)
    } finally {
      setSavingParent(null)
    }
  }

  async function toggleAuto() {
    if (!notion) return
    const next = !notion.autoExport
    setNotion({ ...notion, autoExport: next })
    const r = await fetch("/api/integrations/notion", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ autoExport: next }),
    }).catch(() => null)
    if (!r?.ok) setNotion(n => n ? { ...n, autoExport: !next } : n)
  }

  // ── Other formats ──
  function flash(kind: typeof done) { setDone(kind); setTimeout(() => setDone(d => (d === kind ? "" : d)), kind === "gdocs" ? 12000 : 2000) }

  function copyForDocs() {
    const el = htmlRef.current
    if (!el) return
    const html = `<meta charset="utf-8"><h1>${title.replace(/</g, "&lt;")}</h1>` + el.innerHTML
      .replace(/<table>/g, '<table border="1" style="border-collapse:collapse">')
      .replace(/<(td|th)([^>]*)>/g, '<$1$2 style="padding:6px 10px;border:1px solid #bbb">')
    const plain = `${title}\n\n${markdown}`
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        navigator.clipboard.write([new ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([plain], { type: "text/plain" }),
        })]).then(() => flash("gdocs")).catch(() => legacyCopy(el))
        return
      }
    } catch { /* fall through */ }
    legacyCopy(el)
  }

  function legacyCopy(el: HTMLElement) {
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges(); sel?.addRange(range)
    try { document.execCommand("copy"); flash("gdocs") } catch { /* ignore */ }
    sel?.removeAllRanges()
  }

  function downloadMd() {
    const blob = new Blob([`# ${title}\n\n${markdown}\n`], { type: "text/markdown;charset=utf-8" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${fileName(title)}.md`
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    flash("md")
  }

  function copyText() {
    navigator.clipboard.writeText(markdown).then(() => flash("copy")).catch(() => {})
  }

  function printPdf() {
    setOpen(false)
    setTimeout(() => window.print(), 80)
  }

  // ── Notion row ──
  const n = notion
  let notionBody: React.ReactNode
  if (!n) {
    notionBody = <div className="exm-row static"><NotionMark /><span className="exm-tx"><b>{tx.notion}</b><small><Loader2 size={11} className="exm-spin" /></small></span></div>
  } else if (!n.configured) {
    notionBody = <div className="exm-row static off"><NotionMark /><span className="exm-tx"><b>{tx.notion}</b><small>{tx.notionSoon}</small></span></div>
  } else if (!n.connected || notionErr?.code === "reconnect") {
    notionBody = (
      <button className="exm-row" onClick={connectNotion}>
        <NotionMark />
        <span className="exm-tx"><b>{tx.notion}</b><small>{notionErr?.code === "reconnect" ? tx.reconnect : tx.notionConnect}</small></span>
        <ChevronRight size={15} className="exm-chev" />
      </button>
    )
  } else {
    const parentLabel = n.parent ? `${n.parent.icon ? n.parent.icon + " " : ""}${n.parent.title}` : null
    notionBody = (
      <div className="exm-notion">
        {notionUrl && !sending ? (
          <div className="exm-row static ok">
            <NotionMark />
            <span className="exm-tx"><b>{justSent ? tx.sent : tx.already}</b>
              <small><button className="exm-link" onClick={sendToNotion}><RefreshCw size={10} /> {tx.again}</button></small>
            </span>
            <a className="exm-open" href={notionUrl} target="_blank" rel="noopener noreferrer">{tx.open} <ExternalLink size={12} /></a>
          </div>
        ) : (
          <button className="exm-row" onClick={() => (n.parent ? sendToNotion() : setPicking(true))} disabled={sending}>
            <NotionMark />
            <span className="exm-tx">
              <b>{sending ? tx.sending : n.parent ? `${tx.notionSend} Notion` : tx.notion}</b>
              <small>{n.parent ? <>{"→ "}{parentLabel}</> : tx.notionPick}</small>
            </span>
            {sending ? <Loader2 size={15} className="exm-spin" /> : <ChevronRight size={15} className="exm-chev" />}
          </button>
        )}

        <div className="exm-sub">
          {n.parent && <button className="exm-link" onClick={() => setPicking(v => !v)}>{picking ? "✕" : tx.change}: {parentLabel}</button>}
          <button className={`exm-auto${n.autoExport ? " on" : ""}`} onClick={toggleAuto} title={tx.autoHint} aria-pressed={n.autoExport}>
            <span className={`exm-sw${n.autoExport ? " on" : ""}`}><i /></span>{tx.auto}
          </button>
        </div>

        {picking && (
          <div className="exm-pick">
            <label className="exm-search"><Search size={13} /><input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder={tx.search} /></label>
            {pages === null ? (
              <div className="exm-load"><Loader2 size={14} className="exm-spin" /></div>
            ) : pages.length === 0 ? (
              <p className="exm-note">{tx.noPages}</p>
            ) : (
              <div className="exm-pages">
                {pages.map(p => (
                  <button key={p.id} className={`exm-page${n.parent?.id === p.id ? " on" : ""}`} onClick={() => chooseParent(p)} disabled={!!savingParent}>
                    <span className="exm-pi">{p.icon ?? <FileText size={13} />}</span>
                    <span className="exm-pt">{p.title}</span>
                    {savingParent === p.id ? <Loader2 size={13} className="exm-spin" /> : n.parent?.id === p.id ? <Check size={13} /> : null}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div ref={boxRef} className="exm">
      <style>{STYLES}</style>
      <button className="exm-btn" style={buttonStyle} onClick={() => setOpen(v => !v)} aria-expanded={open}>
        <Download size={13} /> {tx.export}
        {notionUrl && <span className="exm-dot" aria-hidden title={tx.already} />}
      </button>

      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={popRef} className="exm-pop" role="dialog" aria-label={tx.title} style={{ top: pos.top, right: pos.right }}>
          <style>{STYLES}</style>
          <div className="exm-head">
            <span className="exm-ic"><Download size={16} /></span>
            <div style={{ minWidth: 0 }}>
              <h4>{tx.title}</h4>
              <p>{tx.sub}</p>
            </div>
            <button className="exm-x" onClick={() => setOpen(false)} aria-label="Close"><X size={14} /></button>
          </div>

          {notionBody}
          {notionErr && notionErr.code !== "reconnect" && (
            <div className="exm-err"><AlertTriangle size={13} /> {notionErr.message}</div>
          )}

          <div className="exm-list">
            {done === "gdocs" ? (
              <div className="exm-row static ok">
                <span className="exm-logo gd"><FileText size={16} /></span>
                <span className="exm-tx"><b>{tx.gdocsDone}</b><small>{tx.gdocsPaste} {isMac() ? "⌘ V" : "Ctrl + V"}</small></span>
                <a className="exm-open" href="https://docs.new" target="_blank" rel="noopener noreferrer">{tx.gdocsOpen} <ExternalLink size={12} /></a>
              </div>
            ) : (
              <button className="exm-row" onClick={copyForDocs}>
                <span className="exm-logo gd"><FileText size={16} /></span>
                <span className="exm-tx"><b>{tx.gdocs}</b><small>{tx.gdocsSub}</small></span>
                <ChevronRight size={15} className="exm-chev" />
              </button>
            )}
            <button className="exm-row" onClick={printPdf}>
              <span className="exm-logo pdf"><Printer size={16} /></span>
              <span className="exm-tx"><b>{tx.pdf}</b><small>{tx.pdfSub}</small></span>
              <ChevronRight size={15} className="exm-chev" />
            </button>
            <button className="exm-row" onClick={downloadMd}>
              <span className="exm-logo md"><FileCode2 size={16} /></span>
              <span className="exm-tx"><b>{tx.md}</b><small>{tx.mdSub}</small></span>
              {done === "md" ? <Check size={15} className="exm-okc" /> : <ChevronRight size={15} className="exm-chev" />}
            </button>
            <button className="exm-row" onClick={copyText}>
              <span className="exm-logo cp"><Copy size={15} /></span>
              <span className="exm-tx"><b>{done === "copy" ? tx.copied : tx.copy}</b><small>{tx.copySub}</small></span>
              {done === "copy" ? <Check size={15} className="exm-okc" /> : <ChevronRight size={15} className="exm-chev" />}
            </button>
          </div>

          {/* Hidden formatted copy of the report, used for "Google Docs" */}
          <div ref={htmlRef} className="exm-html" aria-hidden>
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// Simple "N" tile (not the Notion logo).
function NotionMark() {
  return <span className="exm-logo nt">N</span>
}

const STYLES = `
  .exm { position: relative; display: inline-block; }
  .exm-btn { position: relative; display: flex; align-items: center; gap: 6px; background: #11111C; border: 0.5px solid rgba(255,255,255,0.10);
    color: #C8C4D8; border-radius: 10px; padding: 8px 12px; font-size: 12px; cursor: pointer; font-family: inherit; transition: border-color .15s, color .15s; }
  .exm-btn:hover { border-color: rgba(232,0,42,.4); color: #F0EDF8; }
  .exm-dot { width: 6px; height: 6px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 8px rgba(34,197,94,.9); }
  .exm-pop { position: fixed; z-index: 1000; width: 380px; max-width: calc(100vw - 32px); max-height: calc(100vh - 40px); overflow-y: auto;
    border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 10px;
    background: linear-gradient(160deg, #151526 0%, #0D0D18 100%); border: 0.5px solid rgba(232,0,42,.32);
    box-shadow: 0 24px 60px rgba(0,0,0,.75), 0 0 40px rgba(232,0,42,.07); animation: exmIn .18s ease-out; }
  .exm-pop::before { content: ""; position: absolute; top: 0; left: 18px; right: 18px; height: 1px;
    background: linear-gradient(90deg, transparent, rgba(232,0,42,.8), transparent); }
  @keyframes exmIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
  @keyframes exmSpin { to { transform: rotate(360deg); } }
  .exm-spin { animation: exmSpin .8s linear infinite; }
  .exm-head { display: flex; align-items: flex-start; gap: 11px; margin-bottom: 2px; }
  .exm-head h4 { margin: 0; font: 600 15px 'Space Grotesk', sans-serif; color: #F0EDF8; }
  .exm-head p { margin: 3px 0 0; font-size: 12px; color: #8C8AA6; }
  .exm-ic { width: 34px; height: 34px; border-radius: 10px; flex: none; display: grid; place-items: center; color: #E8002A;
    background: rgba(232,0,42,.1); border: 0.5px solid rgba(232,0,42,.32); box-shadow: 0 0 18px rgba(232,0,42,.15); }
  .exm-x { margin-left: auto; width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; flex: none;
    background: transparent; border: 0.5px solid rgba(255,255,255,.08); color: #6A6A8A; cursor: pointer; }
  .exm-x:hover { color: #fff; border-color: rgba(232,0,42,.35); }

  .exm-row { position: relative; display: flex; align-items: center; gap: 12px; width: 100%; padding: 10px 12px; border-radius: 12px; text-align: left;
    font-family: inherit; color: #F0EDF8; background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); cursor: pointer;
    transition: background .15s, border-color .15s; overflow: hidden; }
  .exm-row::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 2px; border-radius: 2px; background: #E8002A; opacity: 0; transition: opacity .15s; }
  .exm-row:hover:not(.static):not(:disabled) { background: rgba(255,255,255,.055); border-color: rgba(232,0,42,.32); }
  .exm-row:hover:not(.static):not(:disabled)::before { opacity: 1; }
  .exm-row:disabled { cursor: default; }
  .exm-row.static { cursor: default; }
  .exm-row.off { opacity: .55; }
  .exm-row.ok { background: rgba(34,197,94,.06); border-color: rgba(34,197,94,.3); }
  .exm-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .exm-tx b { font-size: 13.5px; font-weight: 600; color: #F0EDF8; }
  .exm-tx small { font-size: 11.5px; color: #8C8AA6; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: flex; align-items: center; gap: 4px; }
  .exm-row.ok .exm-tx small { white-space: normal; }
  .exm-chev { color: #585878; flex: none; transition: transform .15s, color .15s; }
  .exm-row:hover .exm-chev { color: #E8002A; transform: translateX(2px); }
  .exm-okc { color: #22C55E; flex: none; }

  .exm-logo { width: 32px; height: 32px; border-radius: 9px; flex: none; display: grid; place-items: center; }
  .exm-logo.nt { background: #F4F2EE; color: #111; font: 700 16px 'Space Grotesk', sans-serif; box-shadow: inset 0 0 0 1.5px #111; }
  .exm-logo.gd { background: rgba(66,133,244,.14); color: #6FA2FF; border: 0.5px solid rgba(66,133,244,.35); }
  .exm-logo.pdf { background: rgba(232,0,42,.12); color: #FF4D6A; border: 0.5px solid rgba(232,0,42,.32); }
  .exm-logo.md { background: rgba(139,92,246,.13); color: #A78BFA; border: 0.5px solid rgba(139,92,246,.33); }
  .exm-logo.cp { background: rgba(255,255,255,.05); color: #A8A4BC; border: 0.5px solid rgba(255,255,255,.1); }

  .exm-open { display: inline-flex; align-items: center; gap: 5px; padding: 6px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; white-space: nowrap;
    text-decoration: none; color: #fff; background: #E8002A; transition: background .13s, box-shadow .13s; flex: none; }
  .exm-open:hover { background: #FF1A3E; box-shadow: 0 0 16px rgba(232,0,42,.35); }
  .exm-link { display: inline-flex; align-items: center; gap: 4px; padding: 0; background: none; border: none; cursor: pointer; font: inherit; font-size: 11.5px;
    color: #A8A4BC; text-decoration: underline; text-decoration-color: rgba(255,255,255,.2); text-underline-offset: 3px; max-width: 100%;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exm-link:hover { color: #F0EDF8; }

  .exm-notion { display: flex; flex-direction: column; gap: 8px; }
  .exm-sub { display: flex; flex-direction: column; align-items: flex-start; gap: 8px; padding: 0 4px; }
  .exm-auto { display: inline-flex; align-items: center; gap: 7px; padding: 0; background: none; border: none; cursor: pointer; font: inherit; font-size: 11.5px; color: #8C8AA6; }
  .exm-auto.on { color: #22C55E; }
  .exm-sw { position: relative; width: 26px; height: 15px; border-radius: 8px; flex: none; background: rgba(255,255,255,.12); transition: background .2s; }
  .exm-sw i { position: absolute; top: 2px; left: 2px; width: 11px; height: 11px; border-radius: 50%; background: #C8C4D8; transition: transform .2s, background .2s; }
  .exm-sw.on { background: #22C55E; box-shadow: 0 0 10px rgba(34,197,94,.35); }
  .exm-sw.on i { transform: translateX(11px); background: #fff; }

  .exm-pick { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 12px; background: #0A0A12; border: 0.5px solid rgba(255,255,255,.08); }
  .exm-search { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 34px; border-radius: 9px; background: rgba(255,255,255,.04);
    border: 0.5px solid rgba(255,255,255,.1); color: #6A6A8A; }
  .exm-search:focus-within { border-color: rgba(232,0,42,.45); }
  .exm-search input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #F0EDF8; font: inherit; font-size: 12.5px; }
  .exm-pages { display: flex; flex-direction: column; max-height: 200px; overflow-y: auto; }
  .exm-page { display: flex; align-items: center; gap: 9px; padding: 8px 8px; border-radius: 8px; border: none; background: none; cursor: pointer; text-align: left;
    font: inherit; font-size: 12.5px; color: #C8C4D8; }
  .exm-page:hover { background: rgba(255,255,255,.05); color: #fff; }
  .exm-page.on { color: #22C55E; }
  .exm-pi { width: 20px; display: grid; place-items: center; flex: none; color: #6A6A8A; font-size: 14px; }
  .exm-pt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .exm-load { display: flex; justify-content: center; padding: 10px; color: #A8A4BC; }
  .exm-note { margin: 4px 2px; font-size: 12px; line-height: 1.5; color: #8C8AA6; }
  .exm-err { display: flex; align-items: flex-start; gap: 7px; font-size: 12px; line-height: 1.5; color: #FF6B85; padding: 0 4px; }
  .exm-err svg { flex: none; margin-top: 2px; }

  .exm-list { display: flex; flex-direction: column; gap: 6px; margin-top: 2px; padding-top: 10px; border-top: 0.5px solid rgba(255,255,255,.07); }
  .exm-html { position: fixed; left: -10000px; top: 0; width: 700px; color: #000; background: #fff; pointer-events: none; }
  @media (prefers-reduced-motion: reduce) { .exm-pop { animation: none; } }
`