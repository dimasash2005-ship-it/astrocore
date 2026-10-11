"use client"

// Notion block on the Integrations page: connect, choose the page for reports,
// auto export on/off, disconnect.

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Link2, Unlink, Search, FileText, AlertTriangle, ExternalLink, Sparkles } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"

type Status = {
  configured: boolean
  connected: boolean
  workspaceName: string | null
  workspaceIcon: string | null
  parent: { id: string; title: string; icon: string | null } | null
  autoExport: boolean
  connectedAt: string | null
  setupError?: boolean
}
type Page = { id: string; title: string; icon: string | null }

const L = {
  uk: {
    connected: "Підключено", notConnected: "Не підключено", checking: "Перевірка…", soon: "Скоро",
    descOff: "Надсилай звіти агента в Notion в один клік, а звіти місій можуть потрапляти туди автоматично.",
    descOn: "Звіти можна надіслати в Notion кнопкою «Експорт» на сторінці звіту.",
    connect: "Підключити Notion", disconnect: "Відключити", disconnectConfirm: "Відключити Notion? Уже надіслані сторінки залишаться в Notion.",
    workspace: "Робочий простір", target: "Куди надсилати звіти", pick: "Вибери сторінку", search: "Пошук сторінки…",
    noPages: "AstroCore не бачить жодної сторінки. Натисни «Підключити Notion» ще раз і познач хоча б одну сторінку.",
    auto: "Автоматично надсилати нові звіти", autoHint: "Звіти місій і звіти від агента самі з'являтимуться в Notion",
    reconnect: "Змінити доступ до сторінок",
    steps: ["Натисни «Підключити Notion»", "У вікні Notion познач сторінку, куди складати звіти", "Готово: у кожному звіті кнопка «Експорт → Notion»"],
    caps: "Що вміє Notion + AstroCore",
    capList: [
      "Звіт → сторінка Notion в один клік",
      "Заголовки, списки, таблиці й код зберігаються",
      "Авто-режим: звіти місій самі з'являються в Notion",
      "AstroCore бачить лише сторінки, які ти вибрав",
      "Відключити можна будь-коли",
    ],
    okConnected: "Notion підключено! Тепер вибери, куди надсилати звіти.",
    errConnect: "Не вдалося підключити Notion. Спробуй ще раз.",
    notConfigured: "Notion ще не налаштований на сервері.",
    setupError: "Інтеграція ще не готова: виконай SQL для Notion у Supabase.",
  },
  en: {
    connected: "Connected", notConnected: "Not connected", checking: "Checking…", soon: "Soon",
    descOff: "Send your agent's reports to Notion in one click, and mission reports can land there automatically.",
    descOn: "Send any report to Notion with the “Export” button on the report page.",
    connect: "Connect Notion", disconnect: "Disconnect", disconnectConfirm: "Disconnect Notion? Pages already sent stay in Notion.",
    workspace: "Workspace", target: "Where reports go", pick: "Choose a page", search: "Search pages…",
    noPages: "AstroCore can't see any page. Click “Connect Notion” again and select at least one page.",
    auto: "Send new reports automatically", autoHint: "Mission and agent reports will appear in Notion by themselves",
    reconnect: "Change page access",
    steps: ["Click “Connect Notion”", "In Notion, select the page where reports should go", "Done: every report gets an “Export → Notion” button"],
    caps: "What Notion + AstroCore can do",
    capList: [
      "Report → Notion page in one click",
      "Headings, lists, tables and code are kept",
      "Auto mode: mission reports appear in Notion by themselves",
      "AstroCore only sees the pages you choose",
      "Disconnect any time",
    ],
    okConnected: "Notion is connected! Now choose where reports go.",
    errConnect: "Couldn't connect Notion. Please try again.",
    notConfigured: "Notion is not set up on the server yet.",
    setupError: "Integration isn't ready yet: run the Notion SQL in Supabase.",
  },
}

export default function NotionPanel({ onStatus }: { onStatus?: (connected: boolean) => void }) {
  const { language } = useLanguage()
  const tx = L[language === "uk" ? "uk" : "en"]

  const [st, setSt] = useState<Status | null>(null)
  const [pages, setPages] = useState<Page[] | null>(null)
  const [query, setQuery] = useState("")
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/notion", { cache: "no-store" })
      const d = await r.json()
      setSt(r.ok ? d : { configured: false, connected: false, workspaceName: null, workspaceIcon: null, parent: null, autoExport: false, connectedAt: null })
    } catch {
      setSt({ configured: false, connected: false, workspaceName: null, workspaceIcon: null, parent: null, autoExport: false, connectedAt: null })
    }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (st) onStatus?.(st.connected) }, [st, onStatus])

  // Back from Notion
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = p.get("notion")
    if (!s) return
    p.delete("notion")
    const q = p.toString()
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""))
    if (s === "connected") { setMsg({ ok: true, text: tx.okConnected }); setPicking(true) }
    else if (s === "not_configured") setMsg({ ok: false, text: tx.notConfigured })
    else if (s === "error") setMsg({ ok: false, text: tx.errConnect })
    setTimeout(() => document.getElementById("notion-hero")?.scrollIntoView({ behavior: "smooth", block: "start" }), 300)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showPicker = !!st?.connected && (picking || !st.parent)

  useEffect(() => {
    if (!showPicker) return
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/integrations/notion/pages?q=${encodeURIComponent(query)}`, { cache: "no-store" })
        const d = await r.json()
        setPages(r.ok ? d.pages ?? [] : [])
        if (!r.ok && d.error) setMsg({ ok: false, text: d.error })
      } catch { setPages([]) }
    }, query ? 300 : 0)
    return () => clearTimeout(id)
  }, [showPicker, query])

  async function patch(body: Record<string, unknown>) {
    const r = await fetch("/api/integrations/notion", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    const d = await r.json().catch(() => ({}))
    if (!r.ok) { setMsg({ ok: false, text: d.error ?? "Error" }); return false }
    setSt(d)
    return true
  }

  async function choose(p: Page) {
    setSaving(p.id); setMsg(null)
    if (await patch({ parentId: p.id })) setPicking(false)
    setSaving(null)
  }

  async function toggleAuto() {
    if (!st) return
    setSt({ ...st, autoExport: !st.autoExport })
    if (!(await patch({ autoExport: !st.autoExport }))) setSt(st)
  }

  async function disconnect() {
    if (!window.confirm(tx.disconnectConfirm)) return
    setBusy(true)
    try {
      const r = await fetch("/api/integrations/notion", { method: "DELETE" })
      if (r.ok) { setSt(await r.json()); setPages(null); setMsg(null) }
    } finally { setBusy(false) }
  }

  const connectHref = "/api/integrations/notion/connect?next=/integrations"
  const on = !!st?.connected
  const ready = !!st?.configured && !st?.setupError

  return (
    <div id="notion-hero" className={`np${on ? " on" : ""}`}>
      <style>{STYLES}</style>
      <div className="np-l">
        <div className="np-flow">
          <div className="np-node a">A</div>
          <div className={`np-line${on ? " on" : ""}`} />
          {!st ? <span className="np-status off"><Loader2 size={11} className="np-spin" /> {tx.checking}</span>
            : on ? <span className="np-status on"><span className="np-live" /> {tx.connected}</span>
            : !ready ? <span className="np-status off">{tx.soon}</span>
            : <span className="np-status off"><Link2 size={11} /> {tx.notConnected}</span>}
          <div className={`np-line${on ? " on" : ""}`} />
          <div className="np-node n">N</div>
        </div>

        <div>
          <div className="np-title">Notion <span className="np-new"><Sparkles size={10} /> New</span></div>
          <p className="np-desc">{on ? tx.descOn : tx.descOff}</p>
        </div>

        {msg && <div className={`np-msg${msg.ok ? " ok" : ""}`}>{msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {msg.text}</div>}
        {st?.setupError && <div className="np-msg"><AlertTriangle size={14} /> {tx.setupError}</div>}

        {on && st && (
          <>
            <div className="np-grid">
              <div className="np-cell">
                <div className="np-label">{tx.workspace}</div>
                <div className="np-val">{st.workspaceIcon && !st.workspaceIcon.startsWith("http") ? `${st.workspaceIcon} ` : ""}{st.workspaceName ?? "Notion"}</div>
              </div>
              <div className="np-cell">
                <div className="np-label">{tx.target}</div>
                <button className="np-target" onClick={() => setPicking(v => !v)}>
                  {st.parent ? <>{st.parent.icon ?? <FileText size={13} />} <span>{st.parent.title}</span></> : <span className="dim">{tx.pick}</span>}
                </button>
              </div>
            </div>

            {showPicker && (
              <div className="np-pick">
                <label className="np-search"><Search size={13} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx.search} /></label>
                {pages === null ? <div className="np-load"><Loader2 size={14} className="np-spin" /></div>
                  : pages.length === 0 ? <p className="np-note">{tx.noPages}</p>
                  : <div className="np-pages">
                      {pages.map(p => (
                        <button key={p.id} className={`np-page${st.parent?.id === p.id ? " on" : ""}`} onClick={() => choose(p)} disabled={!!saving}>
                          <span className="np-pi">{p.icon ?? <FileText size={13} />}</span>
                          <span className="np-pt">{p.title}</span>
                          {saving === p.id ? <Loader2 size={13} className="np-spin" /> : st.parent?.id === p.id ? <Check size={13} /> : null}
                        </button>
                      ))}
                    </div>}
              </div>
            )}

            <button className={`np-auto${st.autoExport ? " on" : ""}`} onClick={toggleAuto} aria-pressed={st.autoExport}>
              <span className={`np-sw${st.autoExport ? " on" : ""}`}><i /></span>
              <span className="np-auto-tx"><b>{tx.auto}</b><small>{tx.autoHint}</small></span>
            </button>

            <div className="np-actions">
              <a href={connectHref} className="np-ghost"><ExternalLink size={14} /> {tx.reconnect}</a>
              <button onClick={disconnect} disabled={busy} className="np-ghost flat">
                {busy ? <Loader2 size={14} className="np-spin" /> : <Unlink size={14} />} {tx.disconnect}
              </button>
            </div>
          </>
        )}

        {st && !on && (
          <>
            {ready && <div><a href={connectHref} className="np-primary"><Link2 size={14} /> {tx.connect}</a></div>}
            <div className="np-steps">
              {tx.steps.map((s, i) => <div key={i} className="np-step"><b>{i + 1}</b><span>{s}</span></div>)}
            </div>
          </>
        )}
      </div>

      <div className="np-r">
        <div aria-hidden className="np-glow" />
        <div className="np-label" style={{ position: "relative" }}>{tx.caps}</div>
        <div className="np-caps">
          {tx.capList.map((c, i) => (
            <div key={i} className="np-cap" style={{ animationDelay: `${i * 60}ms` }}>
              <span><Check size={11} /></span>{c}
            </div>
          ))}
        </div>
        <div className="np-preview" aria-hidden>
          <div className="np-pv-top"><span className="np-pv-ico" />AstroCore · Reports</div>
          <div className="np-pv-h" />
          <div className="np-pv-l w1" /><div className="np-pv-l w2" /><div className="np-pv-l w3" />
          <div className="np-pv-tbl"><i /><i /><i /><i /><i /><i /></div>
        </div>
      </div>
    </div>
  )
}

const STYLES = `
  @keyframes npIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes npSpin { to { transform: rotate(360deg); } }
  @keyframes npPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
  @keyframes npFlow { 0% { background-position: 0 0; } 100% { background-position: 40px 0; } }
  @keyframes npDrift { 0% { transform: translate(-8%,-8%); opacity: .45 } 50% { transform: translate(8%,6%); opacity: .85 } 100% { transform: translate(-8%,-8%); opacity: .45 } }
  .np-spin { animation: npSpin .8s linear infinite; }
  .np { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); border-radius: 18px; margin-bottom: 36px; scroll-margin-top: 20px;
    background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid rgba(255,255,255,0.10); transition: border-color .3s; animation: npIn .45s ease both; }
  .np.on { border-color: rgba(34,197,94,.3); box-shadow: 0 0 60px rgba(34,197,94,.04); }
  @media (max-width: 1050px) { .np { grid-template-columns: 1fr; } .np-r { border-left: 0 !important; border-top: 0.5px solid rgba(255,255,255,0.10); } }
  .np-l { padding: 32px 36px; display: flex; flex-direction: column; gap: 20px; min-width: 0; }
  @media (max-width: 640px) { .np-l, .np-r { padding: 22px 18px !important; } }
  .np-r { position: relative; padding: 32px 30px; border-left: 0.5px solid rgba(255,255,255,0.10); overflow: hidden; display: flex; flex-direction: column; gap: 18px;
    background: linear-gradient(160deg, rgba(255,255,255,.04) 0%, rgba(232,0,42,.03) 50%, transparent 80%); }
  .np-glow { position: absolute; top: 15%; right: 5%; width: 220px; height: 220px; border-radius: 50%; pointer-events: none; filter: blur(8px);
    background: radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 70%); animation: npDrift 10s ease-in-out infinite; }

  .np-flow { display: flex; align-items: center; }
  .np-node { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0; font: 800 20px 'Space Grotesk', sans-serif; }
  .np-node.a { background: rgba(232,0,42,.12); border: 0.5px solid rgba(232,0,42,.35); box-shadow: 0 0 22px rgba(232,0,42,.2); color: #E8002A; }
  .np-node.n { background: #F4F2EE; color: #111; box-shadow: inset 0 0 0 2px #111, 0 0 26px rgba(255,255,255,.15); }
  .np-line { flex: 1; min-width: 30px; height: 2px; margin: 0 12px; border-radius: 2px; background: rgba(255,255,255,.08); }
  .np-line.on { background: repeating-linear-gradient(90deg, rgba(34,197,94,.9) 0 8px, transparent 8px 20px); animation: npFlow 1s linear infinite; box-shadow: 0 0 10px rgba(34,197,94,.35); }
  .np-status { display: inline-flex; align-items: center; gap: 8px; padding: 4px 11px 4px 9px; border-radius: 20px; font: 600 11px 'JetBrains Mono', monospace; letter-spacing: .03em; white-space: nowrap; }
  .np-status.on { background: rgba(34,197,94,.1); border: 0.5px solid rgba(34,197,94,.3); color: #22C55E; }
  .np-status.off { background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,0.10); color: #8A8AAA; }
  .np-live { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; animation: npPulse 2s infinite; }

  .np-title { display: flex; align-items: center; gap: 10px; font: 600 24px 'Space Grotesk', sans-serif; color: #F0EDF8; margin-bottom: 8px; }
  .np-new { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 20px; font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: .06em;
    text-transform: uppercase; color: #E8002A; background: rgba(232,0,42,.1); border: 0.5px solid rgba(232,0,42,.32); }
  .np-desc { font-size: 14px; color: #C8C4D8; line-height: 1.7; margin: 0; max-width: 520px; }

  .np-msg { display: flex; align-items: center; gap: 9px; padding: 10px 13px; border-radius: 11px; font-size: 13px; color: #FF8095;
    background: rgba(232,0,42,.07); border: 0.5px solid rgba(232,0,42,.25); }
  .np-msg.ok { color: #22C55E; background: rgba(34,197,94,.07); border-color: rgba(34,197,94,.25); }
  .np-msg svg { flex: none; }

  .np-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 12px; overflow: hidden; border: 0.5px solid rgba(255,255,255,0.10); background: rgba(255,255,255,0.10); gap: 0.5px; }
  @media (max-width: 640px) { .np-grid { grid-template-columns: 1fr; } }
  .np-cell { background: #0E0E17; padding: 12px 14px; min-width: 0; }
  .np-label { font: 600 9.5px 'JetBrains Mono', monospace; color: #8A8AAA; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 7px; }
  .np-val { font: 600 13px 'JetBrains Mono', monospace; color: #F0EDF8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .np-target { display: flex; align-items: center; gap: 7px; width: 100%; padding: 0; background: none; border: none; cursor: pointer; font: 600 13px 'JetBrains Mono', monospace;
    color: #F0EDF8; text-align: left; min-width: 0; }
  .np-target span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: underline; text-decoration-color: rgba(255,255,255,.2); text-underline-offset: 4px; }
  .np-target:hover span { text-decoration-color: #E8002A; }
  .np-target .dim { color: #E8002A; }

  .np-pick { display: flex; flex-direction: column; gap: 6px; padding: 10px; border-radius: 12px; background: #0A0A12; border: 0.5px solid rgba(255,255,255,.08); animation: npIn .25s ease both; }
  .np-search { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; border-radius: 9px; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.1); color: #6A6A8A; }
  .np-search:focus-within { border-color: rgba(232,0,42,.45); }
  .np-search input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #F0EDF8; font: inherit; font-size: 13px; }
  .np-pages { display: flex; flex-direction: column; max-height: 230px; overflow-y: auto; }
  .np-page { display: flex; align-items: center; gap: 9px; padding: 9px 8px; border-radius: 8px; border: none; background: none; cursor: pointer; text-align: left; font: inherit; font-size: 13px; color: #C8C4D8; }
  .np-page:hover { background: rgba(255,255,255,.05); color: #fff; }
  .np-page.on { color: #22C55E; }
  .np-pi { width: 20px; display: grid; place-items: center; flex: none; color: #6A6A8A; font-size: 14px; }
  .np-pt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .np-load { display: flex; justify-content: center; padding: 10px; color: #A8A4BC; }
  .np-note { margin: 4px 2px; font-size: 12.5px; line-height: 1.5; color: #A8A4BC; }

  .np-auto { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 14px; border-radius: 12px; cursor: pointer; text-align: left; font-family: inherit;
    background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.1); transition: background .2s, border-color .2s; }
  .np-auto.on { background: rgba(34,197,94,.06); border-color: rgba(34,197,94,.3); }
  .np-auto-tx { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .np-auto-tx b { font-size: 13.5px; font-weight: 600; color: #F0EDF8; }
  .np-auto-tx small { font-size: 12px; color: #8C8AA6; }
  .np-sw { position: relative; width: 36px; height: 20px; border-radius: 10px; flex: none; background: rgba(255,255,255,.12); transition: background .2s; order: 2; }
  .np-sw i { position: absolute; top: 2px; left: 2px; width: 16px; height: 16px; border-radius: 50%; background: #C8C4D8; transition: transform .2s, background .2s; }
  .np-sw.on { background: #22C55E; box-shadow: 0 0 12px rgba(34,197,94,.35); }
  .np-sw.on i { transform: translateX(16px); background: #fff; }

  .np-actions { display: flex; gap: 8px; flex-wrap: wrap; }
  .np-primary { display: inline-flex; align-items: center; gap: 7px; background: #E8002A; color: #fff; border: none; border-radius: 10px; text-decoration: none;
    padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
  .np-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
  .np-ghost { display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 10px; text-decoration: none; cursor: pointer;
    font-size: 13px; font-weight: 500; font-family: inherit; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,0.10); color: #C8C4D8; transition: all .15s; }
  .np-ghost:hover:not(:disabled) { background: rgba(255,255,255,.09); color: #F0EDF8; }
  .np-ghost.flat { background: transparent; border-color: transparent; color: #8A8AAA; }
  .np-ghost.flat:hover { color: #FF4D6A; background: rgba(232,0,42,.06); }

  .np-steps { display: flex; flex-direction: column; padding: 4px 0; }
  .np-step { position: relative; display: flex; gap: 12px; padding: 0 0 14px; }
  .np-step:not(:last-child)::before { content: ""; position: absolute; left: 11px; top: 24px; bottom: 2px; width: 1px; background: rgba(232,0,42,.25); }
  .np-step b { width: 23px; height: 23px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font: 11px 'JetBrains Mono', monospace;
    color: #E8002A; background: rgba(232,0,42,.1); border: 0.5px solid rgba(232,0,42,.35); }
  .np-step span { font-size: 12.5px; color: #A8A4BC; line-height: 1.6; padding-top: 2px; }

  .np-caps { position: relative; display: flex; flex-direction: column; gap: 12px; }
  .np-cap { display: flex; align-items: flex-start; gap: 10px; font-size: 13px; color: #C8C4D8; line-height: 1.5; animation: npIn .4s ease both; }
  .np-cap > span { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; flex-shrink: 0; color: #22C55E;
    background: rgba(34,197,94,.1); border: 0.5px solid rgba(34,197,94,.28); }

  /* tiny "Notion page" sketch */
  .np-preview { position: relative; margin-top: auto; padding: 14px; border-radius: 12px; background: #F4F2EE; display: flex; flex-direction: column; gap: 7px;
    box-shadow: 0 18px 40px rgba(0,0,0,.45); transform: rotate(-1.2deg); }
  .np-pv-top { display: flex; align-items: center; gap: 6px; font: 600 9.5px 'JetBrains Mono', monospace; color: #8A8780; margin-bottom: 2px; }
  .np-pv-ico { width: 12px; height: 12px; border-radius: 3px; background: #E8002A; }
  .np-pv-h { height: 12px; width: 62%; border-radius: 3px; background: #2B2A28; }
  .np-pv-l { height: 6px; border-radius: 3px; background: #CFCBC3; }
  .np-pv-l.w1 { width: 92%; } .np-pv-l.w2 { width: 78%; } .np-pv-l.w3 { width: 55%; }
  .np-pv-tbl { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; margin-top: 4px; }
  .np-pv-tbl i { height: 12px; border-radius: 2px; background: #E4E0D8; }
  .np-pv-tbl i:nth-child(-n+3) { background: #D3CEC4; }

  @media (prefers-reduced-motion: reduce) { .np, .np-cap, .np-line.on, .np-glow, .np-pick { animation: none; } }
`