"use client"

// Notion on the Integrations page: a compact card + a side panel with the settings
// (page for reports, auto export, change access, disconnect).

import { useCallback, useEffect, useState } from "react"
import { Check, Loader2, Link2, Unlink, Search, FileText, AlertTriangle, ExternalLink, Settings2 } from "lucide-react"
import { useLanguage } from "@/lib/useLanguage"
import { IntegrationCard, IntegrationDrawer } from "@/components/integrations/IntegrationUI"

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
type Page = { id: string; title: string; icon: string | null; url?: string }

const COLOR = "#F4F2EE"
const EMPTY: Status = { configured: false, connected: false, workspaceName: null, workspaceIcon: null, parent: null, autoExport: false, connectedAt: null }

const L = {
  uk: {
    connected: "Підключено", notConnected: "Не підключено", soon: "Скоро",
    desc: "Звіти агента в Notion в один клік або автоматично",
    connect: "Підключити Notion", settings: "Налаштувати", openNotion: "Відкрити в Notion", auto: "Авто-експорт",
    disconnect: "Відключити", disconnectConfirm: "Відключити Notion? Уже надіслані сторінки залишаться в Notion.",
    drawerSub: "Налаштування інтеграції",
    workspace: "Робочий простір", target: "Куди надсилати звіти", change: "змінити", pick: "Вибери сторінку", search: "Пошук сторінки…",
    noPages: "AstroCore не бачить жодної сторінки. Натисни «Змінити доступ до сторінок» і познач хоча б одну.",
    autoTitle: "Автоматично надсилати нові звіти", autoHint: "Звіти місій і звіти від агента самі з'являтимуться в Notion",
    reconnect: "Змінити доступ до сторінок",
    stepsTitle: "Як підключити",
    steps: ["Натисни «Підключити Notion»", "У вікні Notion дай доступ до будь-якої сторінки: AstroCore сам створить у ній «AstroCore Reports»", "Готово: у кожному звіті кнопка «Експорт → Notion»"],
    caps: "Що вміє",
    capList: ["Звіт → сторінка Notion в один клік", "Заголовки, списки, таблиці й код зберігаються", "Авто-режим: звіти місій самі з'являються в Notion", "AstroCore бачить лише сторінки, які ти вибрав"],
    okConnected: "Notion підключено! Звіти підуть у сторінку нижче.",
    errConnect: "Не вдалося підключити Notion. Спробуй ще раз.",
    notConfigured: "Notion ще не налаштований на сервері.",
    setupError: "Інтеграція ще не готова: виконай SQL для Notion у Supabase.",
  },
  en: {
    connected: "Connected", notConnected: "Not connected", soon: "Soon",
    desc: "Agent reports to Notion in one click or automatically",
    connect: "Connect Notion", settings: "Settings", openNotion: "Open in Notion", auto: "Auto export",
    disconnect: "Disconnect", disconnectConfirm: "Disconnect Notion? Pages already sent stay in Notion.",
    drawerSub: "Integration settings",
    workspace: "Workspace", target: "Where reports go", change: "change", pick: "Choose a page", search: "Search pages…",
    noPages: "AstroCore can't see any page. Click “Change page access” and select at least one.",
    autoTitle: "Send new reports automatically", autoHint: "Mission and agent reports will appear in Notion by themselves",
    reconnect: "Change page access",
    stepsTitle: "How to connect",
    steps: ["Click “Connect Notion”", "In Notion, give access to any page: AstroCore creates “AstroCore Reports” inside it", "Done: every report gets an “Export → Notion” button"],
    caps: "What it does",
    capList: ["Report → Notion page in one click", "Headings, lists, tables and code are kept", "Auto mode: mission reports appear in Notion by themselves", "AstroCore only sees the pages you choose"],
    okConnected: "Notion is connected! Reports will go to the page below.",
    errConnect: "Couldn't connect Notion. Please try again.",
    notConfigured: "Notion is not set up on the server yet.",
    setupError: "Integration isn't ready yet: run the Notion SQL in Supabase.",
  },
}

export function NotionLogo({ size = 44 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, display: "grid", placeItems: "center", background: COLOR, color: "#111",
      boxShadow: "inset 0 0 0 1.5px #111", fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, fontSize: size * 0.43 }}>N</span>
  )
}

export default function NotionPanel({ onStatus, delay = 0 }: { onStatus?: (connected: boolean) => void; delay?: number }) {
  const { language } = useLanguage()
  const tx = L[language === "uk" ? "uk" : "en"]

  const [st, setSt] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)
  const [pages, setPages] = useState<Page[] | null>(null)
  const [query, setQuery] = useState("")
  const [picking, setPicking] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [parentUrl, setParentUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/integrations/notion", { cache: "no-store" })
      setSt(r.ok ? await r.json() : EMPTY)
    } catch { setSt(EMPTY) }
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (st) onStatus?.(st.connected) }, [st, onStatus])

  // Back from Notion: open the panel with the result.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = p.get("notion")
    if (!s) return
    p.delete("notion")
    const q = p.toString()
    window.history.replaceState(null, "", window.location.pathname + (q ? `?${q}` : ""))
    if (s === "connected") setMsg({ ok: true, text: tx.okConnected })
    else if (s === "not_configured") setMsg({ ok: false, text: tx.notConfigured })
    else if (s === "error") setMsg({ ok: false, text: tx.errConnect })
    if (s !== "cancelled") setOpen(true)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const showPicker = open && !!st?.connected && (picking || !st.parent)

  // Pages list for the picker, and the link behind "Open in Notion".
  useEffect(() => {
    if (!st?.connected) return
    if (!showPicker && parentUrl !== null) return
    const id = setTimeout(async () => {
      try {
        const r = await fetch(`/api/integrations/notion/pages?q=${encodeURIComponent(showPicker ? query : "")}`, { cache: "no-store" })
        const d = await r.json()
        const list: Page[] = r.ok ? d.pages ?? [] : []
        if (showPicker) setPages(list)
        const parent = list.find(p => p.id === st.parent?.id)
        if (parent?.url) setParentUrl(parent.url)
        else setParentUrl(u => u ?? "")
        if (!r.ok && d.error && showPicker) setMsg({ ok: false, text: d.error })
      } catch { if (showPicker) setPages([]) }
    }, query ? 300 : 0)
    return () => clearTimeout(id)
  }, [showPicker, query, st?.connected, st?.parent?.id]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if (await patch({ parentId: p.id })) { setPicking(false); setParentUrl(p.url ?? "") }
    setSaving(null)
  }

  async function toggleAuto() {
    if (!st) return
    const prev = st
    setSt({ ...st, autoExport: !st.autoExport })
    if (!(await patch({ autoExport: !prev.autoExport }))) setSt(prev)
  }

  async function disconnect() {
    if (!window.confirm(tx.disconnectConfirm)) return
    setBusy(true)
    try {
      const r = await fetch("/api/integrations/notion", { method: "DELETE" })
      if (r.ok) { setSt(await r.json()); setPages(null); setMsg(null); setParentUrl(null); setOpen(false) }
    } finally { setBusy(false) }
  }

  const connectHref = "/api/integrations/notion/connect?next=/integrations"
  const on = !!st?.connected
  const ready = !!st?.configured && !st?.setupError
  const workspace = `${st?.workspaceIcon && !st.workspaceIcon.startsWith("http") ? st.workspaceIcon + " " : ""}${st?.workspaceName ?? "Notion"}`
  const parentLabel = st?.parent ? `${st.parent.icon ? st.parent.icon + " " : ""}${st.parent.title}` : null

  // ── Card ──
  let card: React.ReactNode
  if (!st) {
    card = <IntegrationCard color={COLOR} logo={<NotionLogo />} name="Notion" desc={tx.desc} on={false}
      statusLabel="…" actions={<span className="ic-note"><Loader2 size={12} className="ic-spin" /></span>} delay={delay} />
  } else if (on) {
    card = (
      <IntegrationCard color={COLOR} logo={<NotionLogo />} name="Notion" on statusLabel={tx.connected} delay={delay}
        onOpen={() => setOpen(true)}
        desc={<>{workspace}{parentLabel ? <> → {parentLabel}</> : null}</>}
        actions={<>
          <button className="ic-btn primary" onClick={() => setOpen(true)}><Settings2 size={14} /> {tx.settings}</button>
          {parentUrl && <a className="ic-btn" href={parentUrl} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {tx.openNotion}</a>}
        </>}
        right={
          <button className={`ic-tgl${st.autoExport ? " on" : ""}`} onClick={toggleAuto} aria-pressed={st.autoExport}>
            <span className={`ic-sw${st.autoExport ? " on" : ""}`}><i /></span>{tx.auto}
          </button>
        } />
    )
  } else {
    card = (
      <IntegrationCard color={COLOR} logo={<NotionLogo />} name="Notion" desc={tx.desc} on={false} delay={delay}
        statusLabel={ready ? tx.notConnected : tx.soon} onOpen={() => setOpen(true)}
        actions={<>
          {ready && <a className="ic-btn primary" href={connectHref}><Link2 size={14} /> {tx.connect}</a>}
          <button className="ic-btn" onClick={() => setOpen(true)}>{tx.stepsTitle}</button>
        </>} />
    )
  }

  return (
    <>
      <style>{STYLES}</style>
      {card}
      <IntegrationDrawer open={open} onClose={() => { setOpen(false); setPicking(false) }} color={COLOR} logo={<NotionLogo size={48} />}
        title="Notion" subtitle={tx.drawerSub}
        footer={on ? <>
          <a href={connectHref} className="ic-btn"><ExternalLink size={13} /> {tx.reconnect}</a>
          <button onClick={disconnect} disabled={busy} className="ic-btn warn push">
            {busy ? <Loader2 size={13} className="ic-spin" /> : <Unlink size={13} />} {tx.disconnect}
          </button>
        </> : ready ? <a href={connectHref} className="ic-btn primary"><Link2 size={14} /> {tx.connect}</a> : undefined}>

        <div className="idr-flow">
          <div className="idr-node a">A</div>
          <div className={`idr-line${on ? " on" : ""}`} />
          <span className={`icd-pill${on ? " on" : ""}`}>{on && <span className="icd-live" />}{on ? tx.connected : ready ? tx.notConnected : tx.soon}</span>
          <div className={`idr-line${on ? " on" : ""}`} />
          <NotionLogo size={38} />
        </div>

        {msg && <div className={`idr-msg${msg.ok ? " ok" : ""}`}>{msg.ok ? <Check size={14} /> : <AlertTriangle size={14} />} {msg.text}</div>}
        {st?.setupError && <div className="idr-msg"><AlertTriangle size={14} /> {tx.setupError}</div>}

        {on && st && (
          <>
            <div>
              <div className="idr-label">{tx.workspace}</div>
              <div className="idr-field"><span>{workspace}</span></div>
            </div>

            <div>
              <div className="idr-label">{tx.target}</div>
              <button className="idr-field np-target" onClick={() => setPicking(v => !v)}>
                {st.parent ? <span>{parentLabel}</span> : <span style={{ color: "#E8002A" }}>{tx.pick}</span>}
                <em>{picking ? "✕" : tx.change}</em>
              </button>
              {showPicker && (
                <div className="np-pick">
                  <label className="np-search"><Search size={13} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={tx.search} autoFocus /></label>
                  {pages === null ? <div className="np-load"><Loader2 size={14} className="ic-spin" /></div>
                    : pages.length === 0 ? <p className="np-note">{tx.noPages}</p>
                    : <div className="np-pages">
                        {pages.map(p => (
                          <button key={p.id} className={`np-page${st.parent?.id === p.id ? " on" : ""}`} onClick={() => choose(p)} disabled={!!saving}>
                            <span className="np-pi">{p.icon ?? <FileText size={13} />}</span>
                            <span className="np-pt">{p.title}</span>
                            {saving === p.id ? <Loader2 size={13} className="ic-spin" /> : st.parent?.id === p.id ? <Check size={13} /> : null}
                          </button>
                        ))}
                      </div>}
                </div>
              )}
            </div>

            <button className={`np-auto${st.autoExport ? " on" : ""}`} onClick={toggleAuto} aria-pressed={st.autoExport}>
              <span className="np-auto-tx"><b>{tx.autoTitle}</b><small>{tx.autoHint}</small></span>
              <span className={`ic-sw big${st.autoExport ? " on" : ""}`}><i /></span>
            </button>
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

        <div>
          <div className="idr-label">{tx.caps}</div>
          <div className="idr-caps">
            {tx.capList.map((c, i) => <div key={i} className="idr-cap"><span><Check size={11} /></span>{c}</div>)}
          </div>
        </div>
      </IntegrationDrawer>
    </>
  )
}

const STYLES = `
  .np-target { width: 100%; cursor: pointer; text-align: left; font-family: 'JetBrains Mono', monospace; }
  .np-target em { font: 500 11.5px 'IBM Plex Sans', system-ui, sans-serif; font-style: normal; color: #E8002A; flex: none; }
  .np-target:hover { border-color: rgba(232,0,42,.4); }
  .np-pick { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; padding: 10px; border-radius: 12px; background: #0A0A12; border: 0.5px solid rgba(255,255,255,.08); }
  .np-search { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; border-radius: 9px; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.1); color: #6A6A8A; }
  .np-search:focus-within { border-color: rgba(232,0,42,.45); }
  .np-search input { flex: 1; min-width: 0; background: none; border: none; outline: none; color: #F0EDF8; font: inherit; font-size: 13px; }
  .np-pages { display: flex; flex-direction: column; max-height: 240px; overflow-y: auto; }
  .np-page { display: flex; align-items: center; gap: 9px; padding: 9px 8px; border-radius: 8px; border: none; background: none; cursor: pointer; text-align: left; font: inherit; font-size: 13px; color: #C8C4D8; }
  .np-page:hover { background: rgba(255,255,255,.05); color: #fff; }
  .np-page.on { color: #22C55E; }
  .np-pi { width: 20px; display: grid; place-items: center; flex: none; color: #6A6A8A; font-size: 14px; }
  .np-pt { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .np-load { display: flex; justify-content: center; padding: 10px; color: #A8A4BC; }
  .np-note { margin: 4px 2px; font-size: 12.5px; line-height: 1.5; color: #A8A4BC; }
  .np-auto { display: flex; align-items: center; gap: 12px; width: 100%; padding: 13px 14px; border-radius: 12px; cursor: pointer; text-align: left; font-family: inherit;
    background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.1); transition: background .2s, border-color .2s; }
  .np-auto.on { background: rgba(34,197,94,.06); border-color: rgba(34,197,94,.3); }
  .np-auto-tx { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .np-auto-tx b { font-size: 13.5px; font-weight: 600; color: #F0EDF8; }
  .np-auto-tx small { font-size: 12px; color: #8C8AA6; }
  .ic-sw.big { width: 36px; height: 20px; border-radius: 10px; }
  .ic-sw.big i { width: 16px; height: 16px; }
  .ic-sw.big.on i { transform: translateX(16px); }
`