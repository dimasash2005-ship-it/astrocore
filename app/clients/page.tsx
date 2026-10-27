"use client"

// Client portals: an agency / marketer creates a branded page for each client
// (astrocore.one/c/<code>) where the client sees the reports made for them.
// Reports get there when you pick the client on a report page or in a mission.
// The logo is uploaded here; its main colour becomes the portal's brand colour.

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { createPortal } from "react-dom"
import {
  Users, Plus, Copy, Check, ExternalLink, Settings, Lock, FileText, Eye, X, Loader2,
  Trash2, RefreshCw, Target, AlertCircle, Upload, Sparkles, ImagePlus,
} from "lucide-react"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import { fileToLogo } from "@/lib/logoColor"

type Client = {
  id: string; name: string; slug: string; color: string; logo_url: string | null; intro: string | null
  is_active: boolean; show_powered: boolean; views: number; hasPassword: boolean; reports: number; lastReportAt: string | null
}

const COLORS = ["#E8002A", "#F59E0B", "#22C55E", "#06B6D4", "#3B82F6", "#8B5CF6", "#EC4899", "#14B8A6"]

const L = {
  uk: {
    title: "Кабінети клієнтів", sub: "Гарна сторінка для кожного клієнта зі звітами, які агент робить для нього. Клієнт бачить роботу, а ти не збираєш звіти руками.",
    kicker: "Для маркетологів і агенцій", add: "Новий клієнт", reports: "звітів", views: "переглядів", open: "Відкрити кабінет", settings: "Налаштування", copy: "Копіювати", copied: "Скопійовано",
    off: "вимкнено", pass: "з паролем", last: "останній звіт", never: "звітів ще немає",
    sClients: "клієнтів", sReports: "звітів у кабінетах", sViews: "переглядів",
    emptyT: "Поки жодного клієнта", emptyD: "Створи кабінет для першого клієнта, і за хвилину в нього буде своя сторінка в його кольорах.",
    s1: "Створи клієнта", s1d: "Логотип, і колір підбереться сам.", s2: "Прив'яжи звіти", s2d: "На сторінці звіту або в місії обери клієнта.", s3: "Надішли посилання", s3d: "Клієнт бачить звіти у своєму кабінеті.",
    how: "Звіти потрапляють у кабінет, коли ти обираєш клієнта на сторінці звіту або в місії: тоді кожен запуск місії сам додає звіт клієнту.",
    setup: "Таблиці для клієнтів ще немає. Виконай SQL «client_portals» у Supabase і онови сторінку.",
    newT: "Новий клієнт", editT: "Налаштування кабінету", name: "Назва клієнта", namePh: "Кав'ярня Brew",
    logo: "Логотип", logoDrop: "Перетягни логотип сюди або натисни", logoHint: "PNG, JPG, WebP або SVG", logoChange: "Змінити", logoRemove: "Прибрати",
    logoBad: "Це не схоже на картинку (PNG, JPG, WebP, SVG до 8 МБ).", fromLogo: "Колір підібрано з логотипа",
    color: "Колір бренду", intro: "Привітання в кабінеті", introPh: "Привіт! Тут ми щотижня викладаємо звіти про ваші соцмережі та конкурентів.",
    pw: "Пароль", pwPh: "Залиш порожнім: вхід за посиланням", pwSet: "Пароль встановлено", pwChange: "Змінити", pwRemove: "Прибрати",
    powered: "Показувати «Працює на AstroCore»", active: "Кабінет увімкнено", newLink: "Нове посилання", newLinkHint: "Старе посилання перестане працювати.",
    save: "Зберегти", create: "Створити кабінет", cancel: "Скасувати", del: "Видалити", delQ: (n: string) => `Видалити клієнта «${n}»? Звіти залишаться, але зникнуть з його кабінету.`,
    err: "Не вдалося зберегти.", missions: "Місії", preview: "Так побачить клієнт", pKick: "Кабінет клієнта", pLatest: "Останній звіт", pRep: "Тижневий звіт: соцмережі", pRead: "Читати",
    pStats: ["Звітів", "Цього місяця", "Оновлено"],
  },
  en: {
    title: "Client portals", sub: "A clean page for each client with the reports your agent makes for them. The client sees the work, and you stop assembling reports by hand.",
    kicker: "For marketers & agencies", add: "New client", reports: "reports", views: "views", open: "Open portal", settings: "Settings", copy: "Copy", copied: "Copied",
    off: "off", pass: "password", last: "last report", never: "no reports yet",
    sClients: "clients", sReports: "reports in portals", sViews: "views",
    emptyT: "No clients yet", emptyD: "Create a portal for your first client, and in a minute they have their own page in their colours.",
    s1: "Create a client", s1d: "Upload a logo, the colour is picked for you.", s2: "Link reports", s2d: "Pick the client on a report or in a mission.", s3: "Send the link", s3d: "The client sees the reports in their portal.",
    how: "Reports land in a portal when you pick the client on a report page or in a mission: then every mission run adds a report for that client by itself.",
    setup: "The clients table doesn't exist yet. Run the \"client_portals\" SQL in Supabase and reload.",
    newT: "New client", editT: "Portal settings", name: "Client name", namePh: "Brew Coffee",
    logo: "Logo", logoDrop: "Drop the logo here or click", logoHint: "PNG, JPG, WebP or SVG", logoChange: "Change", logoRemove: "Remove",
    logoBad: "That doesn't look like an image (PNG, JPG, WebP, SVG up to 8 MB).", fromLogo: "Colour picked from the logo",
    color: "Brand colour", intro: "Greeting in the portal", introPh: "Hi! Every week we post reports on your social media and competitors here.",
    pw: "Password", pwPh: "Leave empty: open by link", pwSet: "Password is set", pwChange: "Change", pwRemove: "Remove",
    powered: "Show \"Powered by AstroCore\"", active: "Portal is on", newLink: "New link", newLinkHint: "The old link will stop working.",
    save: "Save", create: "Create portal", cancel: "Cancel", del: "Delete", delQ: (n: string) => `Delete client "${n}"? Reports stay, but leave their portal.`,
    err: "Couldn't save.", missions: "Missions", preview: "What the client sees", pKick: "Client portal", pLatest: "Latest report", pRep: "Weekly report: social media", pRead: "Read",
    pStats: ["Reports", "This month", "Updated"],
  },
}
type TX = typeof L.uk

function ago(iso: string | null, uk: boolean) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short" })
}

function Logo({ name, url, size, radius }: { name: string; url: string | null; size: number; radius: number }) {
  return url
    ? <img src={url} alt="" className="cl-logo img" style={{ width: size, height: size, borderRadius: radius }} />
    : <span className="cl-logo init" style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.44 }}>{(name.trim().charAt(0) || "A").toUpperCase()}</span>
}

export default function ClientsPage() {
  const { language } = useLanguage()
  const uk = language === "uk"
  const tx = L[uk ? "uk" : "en"]
  const [list, setList] = useState<Client[] | null>(null)
  const [setupError, setSetupError] = useState(false)
  const [edit, setEdit] = useState<Client | "new" | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [origin, setOrigin] = useState("https://astrocore.one")

  const load = useCallback(async () => {
    const r = await fetch("/api/clients", { cache: "no-store" }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setSetupError(!!d.setupError)
    setList(d.clients ?? [])
  }, [])
  useEffect(() => { setOrigin(window.location.origin); load() }, [load])

  async function copy(c: Client) {
    try { await navigator.clipboard.writeText(`${origin}/c/${c.slug}`); setCopied(c.id); setTimeout(() => setCopied(null), 1600) } catch { /* ignore */ }
  }

  const totals = (list ?? []).reduce((a, c) => ({ r: a.r + c.reports, v: a.v + c.views }), { r: 0, v: 0 })

  return (
    <div className="cl" style={{ marginLeft: SIDEBAR_W }}>
      <style>{CSS}</style>
      <span className="cl-scan" aria-hidden />
      <div className="cl-in">
        <header className="cl-head">
          <div className="cl-head-tx">
            <span className="cl-kick"><Users size={12} /> {tx.kicker}</span>
            <h1>{tx.title}</h1>
            <p>{tx.sub}</p>
            {list && list.length > 0 && (
              <div className="cl-totals">
                <span><b>{list.length}</b> {tx.sClients}</span>
                <span><b>{totals.r}</b> {tx.sReports}</span>
                <span><b>{totals.v}</b> {tx.sViews}</span>
              </div>
            )}
          </div>
          <button className="cl-btn pri big" onClick={() => setEdit("new")} disabled={setupError}><Plus size={16} /> {tx.add}</button>
        </header>

        {setupError && <div className="cl-warn"><AlertCircle size={15} /> {tx.setup}</div>}

        {list === null ? (
          <div className="cl-load"><Loader2 size={18} className="cl-spin" /></div>
        ) : list.length === 0 ? (
          <div className="cl-empty">
            <div className="cl-orbs" aria-hidden>
              {COLORS.slice(0, 5).map((c, i) => <i key={c} style={{ ["--c" as string]: c, ["--i" as string]: i } as React.CSSProperties} />)}
            </div>
            <b>{tx.emptyT}</b><span>{tx.emptyD}</span>
            <div className="cl-steps">
              {[[tx.s1, tx.s1d], [tx.s2, tx.s2d], [tx.s3, tx.s3d]].map(([a, b], i) => (
                <div key={i} style={{ ["--c" as string]: COLORS[[1, 3, 5][i]] } as React.CSSProperties}><i>{i + 1}</i><b>{a}</b><small>{b}</small></div>
              ))}
            </div>
            {!setupError && <button className="cl-btn pri big" onClick={() => setEdit("new")}><Plus size={16} /> {tx.add}</button>}
          </div>
        ) : (
          <>
            <div className="cl-grid">
              {list.map((c, i) => (
                <div key={c.id} className={`cl-card${c.is_active ? "" : " off"}`} style={{ ["--c" as string]: c.color, animationDelay: `${i * 50}ms` } as React.CSSProperties}>
                  <div className="cl-banner">
                    <span className="cl-glow" aria-hidden />
                    <span className="cl-sweep" aria-hidden />
                    <div className="cl-logo-wrap"><Logo name={c.name} url={c.logo_url} size={64} radius={18} /></div>
                    <div className="cl-nm">
                      <b>{c.name}</b>
                      <span>
                        {!c.is_active && <em className="cl-tag">{tx.off}</em>}
                        {c.hasPassword && <em className="cl-tag"><Lock size={9} /> {tx.pass}</em>}
                        {c.lastReportAt ? `${tx.last}: ${ago(c.lastReportAt, uk)}` : tx.never}
                      </span>
                    </div>
                    <button className="cl-ic" onClick={() => setEdit(c)} title={tx.settings} aria-label={tx.settings}><Settings size={15} /></button>
                  </div>
                  <div className="cl-body">
                    <div className="cl-stats">
                      <div><FileText size={13} /><b>{c.reports}</b><span>{tx.reports}</span></div>
                      <div><Eye size={13} /><b>{c.views}</b><span>{tx.views}</span></div>
                    </div>
                    <div className="cl-link">
                      <code>{origin.replace(/^https?:\/\//, "")}/c/{c.slug}</code>
                      <button onClick={() => copy(c)}>{copied === c.id ? <><Check size={12} /> {tx.copied}</> : <><Copy size={12} /> {tx.copy}</>}</button>
                    </div>
                    <a className="cl-btn brand" href={`/c/${c.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={14} /> {tx.open}</a>
                  </div>
                </div>
              ))}
              <button className="cl-card cl-add" onClick={() => setEdit("new")} disabled={setupError}>
                <span><Plus size={22} /></span><b>{tx.add}</b>
              </button>
            </div>
            <p className="cl-how"><Target size={13} /> {tx.how} <Link href="/missions">{tx.missions} →</Link></p>
          </>
        )}
      </div>

      {edit && <ClientEditor tx={tx} client={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load() }} />}
    </div>
  )
}

function ClientEditor({ tx, client, onClose, onSaved }: { tx: TX; client: Client | null; onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState(client?.name ?? "")
  const [color, setColor] = useState(client?.color ?? COLORS[0])
  const [logo, setLogo] = useState<string | null>(client?.logo_url ?? null)
  const [fromLogo, setFromLogo] = useState(false)
  const [drag, setDrag] = useState(false)
  const [intro, setIntro] = useState(client?.intro ?? "")
  const [pw, setPw] = useState("")
  const [pwMode, setPwMode] = useState<"keep" | "set" | "remove">(client?.hasPassword ? "keep" : "set")
  const [powered, setPowered] = useState(client?.show_powered ?? true)
  const [active, setActive] = useState(client?.is_active ?? true)
  const [newLink, setNewLink] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [mounted, setMounted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])

  async function takeFile(f: File | undefined) {
    if (!f) return
    setErr("")
    try {
      const r = await fileToLogo(f)
      setLogo(r.dataUrl)
      if (r.color) { setColor(r.color); setFromLogo(true) }
    } catch { setErr(tx.logoBad) }
  }

  async function save() {
    if (!name.trim()) { setErr(tx.name); return }
    setBusy(true); setErr("")
    const body: Record<string, unknown> = { name, color, logoUrl: logo ?? "", intro, showPowered: powered }
    if (client) {
      body.isActive = active
      if (newLink) body.newLink = true
      if (pwMode === "remove") body.password = ""
      else if (pwMode === "set" && pw.trim()) body.password = pw
    } else if (pw.trim()) body.password = pw
    const r = await fetch(client ? `/api/clients/${client.id}` : "/api/clients", {
      method: client ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    }).catch(() => null)
    const d = r ? await r.json().catch(() => ({})) : {}
    setBusy(false)
    if (!r?.ok) { setErr(d.error || tx.err); return }
    onSaved()
  }

  async function remove() {
    if (!client || !window.confirm(tx.delQ(client.name))) return
    setBusy(true)
    await fetch(`/api/clients/${client.id}`, { method: "DELETE" }).catch(() => null)
    setBusy(false)
    onSaved()
  }

  if (!mounted) return null
  const shownName = name.trim() || tx.namePh
  return createPortal(
    <div className="cle-back" onClick={onClose}>
      <style>{CSS}</style>
      <div className="cle" onClick={e => e.stopPropagation()} style={{ ["--c" as string]: color } as React.CSSProperties} role="dialog" aria-modal="true">
        <span key={color} className="cle-glow" aria-hidden />
        <button className="cl-ic cle-x" onClick={onClose} aria-label={tx.cancel}><X size={15} /></button>

        {/* ── form ── */}
        <div className="cle-form">
          <b className="cle-title">{client ? tx.editT : tx.newT}</b>

          <div className="cle-f"><span>{tx.logo}</span>
            <div className={`cle-drop${drag ? " drag" : ""}${logo ? " has" : ""}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); takeFile(e.dataTransfer.files?.[0]) }}
              role="button" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") fileRef.current?.click() }}>
              <div className="cle-drop-logo">
                {logo ? <img src={logo} alt="" /> : <ImagePlus size={22} />}
              </div>
              <div className="cle-drop-tx">
                {logo ? (
                  <>
                    <b>{tx.logoChange}</b>
                    <button type="button" onClick={e => { e.stopPropagation(); setLogo(null); setFromLogo(false) }}>{tx.logoRemove}</button>
                  </>
                ) : (<><b><Upload size={13} /> {tx.logoDrop}</b><small>{tx.logoHint}</small></>)}
              </div>
              <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden onChange={e => { takeFile(e.target.files?.[0]); e.target.value = "" }} />
            </div>
          </div>

          <label className="cle-f"><span>{tx.name}</span>
            <input value={name} onChange={e => setName(e.target.value)} placeholder={tx.namePh} maxLength={80} autoFocus={!client} />
          </label>

          <div className="cle-f"><span>{tx.color} {fromLogo && <em className="cle-auto"><Sparkles size={10} /> {tx.fromLogo}</em>}</span>
            <div className="cle-colors">
              {COLORS.map(cc => <button key={cc} type="button" className={color.toUpperCase() === cc ? "on" : ""} style={{ background: cc }} onClick={() => { setColor(cc); setFromLogo(false) }} aria-label={cc} />)}
              <label className={`cle-custom${COLORS.includes(color.toUpperCase()) ? "" : " on"}`} style={{ background: color }}>
                <input type="color" value={color} onChange={e => { setColor(e.target.value.toUpperCase()); setFromLogo(false) }} aria-label="custom" />
              </label>
            </div>
          </div>

          <label className="cle-f"><span>{tx.intro}</span>
            <textarea value={intro} onChange={e => setIntro(e.target.value)} placeholder={tx.introPh} rows={3} maxLength={600} />
          </label>

          <div className="cle-f"><span>{tx.pw}</span>
            {client?.hasPassword && pwMode === "keep" ? (
              <div className="cle-pw"><Lock size={13} /> {tx.pwSet}
                <button type="button" onClick={() => setPwMode("set")}>{tx.pwChange}</button>
                <button type="button" onClick={() => setPwMode("remove")}>{tx.pwRemove}</button>
              </div>
            ) : pwMode === "remove" ? (
              <div className="cle-pw">{tx.pwPh} <button type="button" onClick={() => setPwMode("keep")}>{tx.cancel}</button></div>
            ) : (
              <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder={tx.pwPh} maxLength={100} autoComplete="off" />
            )}
          </div>

          <label className="cle-sw"><input type="checkbox" checked={powered} onChange={e => setPowered(e.target.checked)} /> {tx.powered}</label>
          {client && <label className="cle-sw"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} /> {tx.active}</label>}
          {client && <label className="cle-sw"><input type="checkbox" checked={newLink} onChange={e => setNewLink(e.target.checked)} /> <RefreshCw size={12} /> {tx.newLink} <small>{tx.newLinkHint}</small></label>}

          {err && <div className="cle-err">{err}</div>}

          <div className="cle-act">
            {client && <button className="cl-btn del" onClick={remove} disabled={busy}><Trash2 size={14} /> {tx.del}</button>}
            <span style={{ flex: 1 }} />
            <button className="cl-btn" onClick={onClose}>{tx.cancel}</button>
            <button className="cl-btn brand" onClick={save} disabled={busy || !name.trim()}>{busy ? <Loader2 size={14} className="cl-spin" /> : null}{client ? tx.save : tx.create}</button>
          </div>
        </div>

        {/* ── live preview of the portal ── */}
        <div className="cle-prev">
          <span className="cle-prev-k">{tx.preview}</span>
          <div className="pv">
            <span className="pv-line" />
            <div className="pv-head">
              <Logo name={shownName} url={logo} size={40} radius={11} />
              <div><b>{shownName}</b><small>{tx.pKick}</small></div>
            </div>
            <p className="pv-intro">{intro.trim() || tx.introPh}</p>
            <div className="pv-stats">{tx.pStats.map((s, i) => <div key={s}><b>{["12", "4", "14.10"][i]}</b><span>{s}</span></div>)}</div>
            <div className="pv-k">{tx.pLatest}</div>
            <div className="pv-feat"><small>14.10.2026</small><b>{tx.pRep}</b><i /><i /><em>{tx.pRead} →</em></div>
            {powered && <div className="pv-pow">Powered by <b>ASTRO<span>CORE</span></b></div>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
.cl { position: relative; min-height: 100vh; background: radial-gradient(ellipse 50% 35% at 20% -5%, rgba(232,0,42,.10), transparent 70%), radial-gradient(ellipse 40% 30% at 90% 0%, rgba(139,92,246,.07), transparent 70%), #08080F;
  color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif; overflow-x: hidden; }
.cl-scan { position: fixed; top: 0; right: 0; height: 1px; width: 100%; pointer-events: none; z-index: 5; background: linear-gradient(90deg, transparent, rgba(232,0,42,.6), transparent); animation: clScan 6s linear infinite; }
@keyframes clScan { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
.cl-in { padding: 34px 48px 70px; }
.cl-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; flex-wrap: wrap; margin-bottom: 28px; }
.cl-kick { display: inline-flex; align-items: center; gap: 6px; font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .14em; text-transform: uppercase; color: #E8002A; }
.cl-head h1 { margin: 8px 0 6px; font-size: 32px; letter-spacing: -.02em; }
.cl-head p { margin: 0; max-width: 640px; color: #A8A4BC; font-size: 14px; line-height: 1.6; }
.cl-totals { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
.cl-totals span { padding: 6px 12px; border-radius: 999px; font-size: 12.5px; color: #A8A4BC; background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.1); }
.cl-totals b { color: #F0EDF8; margin-right: 3px; }
.cl-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 11px; cursor: pointer; text-decoration: none; box-sizing: border-box;
  font: 600 13.5px 'Space Grotesk', system-ui, sans-serif; color: #E8E4F4; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.14); transition: all .15s; }
.cl-btn:hover:not(:disabled) { background: rgba(255,255,255,.09); }
.cl-btn.big { padding: 12px 20px; font-size: 14.5px; }
.cl-btn.pri { color: #fff; background: #E8002A; border-color: #E8002A; box-shadow: 0 0 24px rgba(232,0,42,.38); }
.cl-btn.pri:hover:not(:disabled) { background: #FF1A3E; transform: translateY(-1px); }
.cl-btn.brand { color: #fff; background: var(--c); border-color: var(--c); box-shadow: 0 0 22px color-mix(in srgb, var(--c) 45%, transparent); text-shadow: 0 1px 2px rgba(0,0,0,.35); }
.cl-btn.brand:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
.cl-btn.del { color: #FF6B85; border-color: rgba(232,0,42,.3); background: transparent; }
.cl-btn:disabled { opacity: .5; cursor: default; }
.cl-warn { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-radius: 12px; margin-bottom: 18px; font-size: 13.5px; color: #FBBF24; background: rgba(245,158,11,.08); border: .5px solid rgba(245,158,11,.3); }
.cl-load { display: grid; place-items: center; padding: 80px; color: #8A8AAA; }
.cl-spin { animation: clSpin .8s linear infinite; } @keyframes clSpin { to { transform: rotate(360deg); } }

.cl-empty { position: relative; overflow: hidden; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px; padding: 56px 24px 46px; border-radius: 24px;
  background: radial-gradient(ellipse 60% 70% at 50% 0%, rgba(232,0,42,.09), transparent 70%), rgba(255,255,255,.015); border: .5px solid rgba(255,255,255,.1); }
.cl-orbs { position: relative; width: 210px; height: 70px; margin-bottom: 14px; }
.cl-orbs i { position: absolute; top: 10px; left: calc(var(--i) * 36px + 10px); width: 50px; height: 50px; border-radius: 15px; background: linear-gradient(140deg, var(--c), color-mix(in srgb, var(--c) 40%, #000));
  box-shadow: 0 0 26px color-mix(in srgb, var(--c) 55%, transparent); border: 2px solid #08080F; animation: clBob 3.2s ease-in-out infinite; animation-delay: calc(var(--i) * .25s); }
@keyframes clBob { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
.cl-empty > b { font-size: 22px; } .cl-empty > span { color: #A8A4BC; font-size: 14px; max-width: 480px; }
.cl-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 260px)); gap: 12px; margin: 24px 0 26px; }
.cl-steps div { position: relative; display: flex; flex-direction: column; gap: 5px; padding: 18px; border-radius: 16px; text-align: left; overflow: hidden;
  background: radial-gradient(ellipse 80% 70% at 0% 0%, color-mix(in srgb, var(--c) 14%, transparent), transparent 70%), rgba(255,255,255,.03); border: .5px solid color-mix(in srgb, var(--c) 30%, rgba(255,255,255,.08)); }
.cl-steps i { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; font: 700 12px 'JetBrains Mono', monospace; font-style: normal; color: #fff; background: var(--c); box-shadow: 0 0 14px color-mix(in srgb, var(--c) 50%, transparent); margin-bottom: 4px; }
.cl-steps b { font-size: 14.5px; } .cl-steps small { color: #8A8AAA; font-size: 12.5px; line-height: 1.5; }

.cl-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.cl-card { position: relative; display: flex; flex-direction: column; border-radius: 20px; overflow: hidden; background: #0E0D17;
  border: .5px solid color-mix(in srgb, var(--c) 38%, rgba(255,255,255,.08)); animation: clIn .45s cubic-bezier(.2,.9,.3,1.1) both; transition: transform .25s, box-shadow .25s; }
@keyframes clIn { from { opacity: 0; transform: translateY(12px); } }
.cl-card:hover { transform: translateY(-3px); box-shadow: 0 24px 60px rgba(0,0,0,.5), 0 0 40px color-mix(in srgb, var(--c) 20%, transparent); }
.cl-card.off { filter: saturate(.4); opacity: .7; }
.cl-banner { position: relative; display: flex; align-items: center; gap: 14px; padding: 22px 18px 20px; overflow: hidden;
  background: linear-gradient(160deg, color-mix(in srgb, var(--c) 22%, #12101B), #0E0D17 80%);
  border-bottom: .5px solid color-mix(in srgb, var(--c) 25%, transparent); }
.cl-banner::after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
  background-image: repeating-linear-gradient(0deg, rgba(255,255,255,.04) 0 1px, transparent 1px 18px), repeating-linear-gradient(90deg, rgba(255,255,255,.04) 0 1px, transparent 1px 18px);
  mask-image: linear-gradient(90deg, transparent, #000 60%); -webkit-mask-image: linear-gradient(90deg, transparent, #000 60%); }
.cl-glow { position: absolute; left: -70px; top: -90px; width: 260px; height: 260px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, var(--c), transparent 72%); opacity: .38; transition: opacity .3s, transform .3s; }
.cl-card:hover .cl-glow { opacity: .55; transform: scale(1.1); }
.cl-sweep { position: absolute; top: 0; left: -40%; width: 40%; height: 1.5px; background: linear-gradient(90deg, transparent, var(--c), #fff, var(--c), transparent); animation: clSweep 3.5s linear infinite; }
@keyframes clSweep { to { left: 100%; } }
.cl-logo-wrap { position: relative; z-index: 1; flex: none; }
.cl-logo { display: grid; place-items: center; box-sizing: border-box; flex: none; border: 1px solid color-mix(in srgb, var(--c) 60%, transparent);
  box-shadow: 0 0 30px color-mix(in srgb, var(--c) 50%, transparent), 0 8px 20px rgba(0,0,0,.4); }
.cl-logo.img { object-fit: contain; padding: 7px; background: color-mix(in srgb, var(--c) 12%, #0E0C16); }
.cl-logo.init { font-weight: 700; color: #fff; background: linear-gradient(140deg, var(--c), color-mix(in srgb, var(--c) 42%, #000)); text-shadow: 0 2px 6px rgba(0,0,0,.3); }
.cl-nm { position: relative; z-index: 1; flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
.cl-nm b { font-size: 19px; letter-spacing: -.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cl-nm span { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 12px; color: #A8A4BC; }
.cl-tag { display: inline-flex; align-items: center; gap: 3px; font-style: normal; font: 600 9.5px 'JetBrains Mono', monospace; text-transform: uppercase; padding: 2px 7px; border-radius: 6px; color: #F0EDF8; background: rgba(0,0,0,.35); border: .5px solid rgba(255,255,255,.12); }
.cl-ic { position: relative; z-index: 1; width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; flex: none; cursor: pointer; color: #C8C4D8; background: rgba(0,0,0,.3); border: .5px solid rgba(255,255,255,.14); }
.cl-ic:hover { color: #fff; background: rgba(0,0,0,.5); }
.cl-body { display: flex; flex-direction: column; gap: 12px; padding: 16px 18px 18px; }
.cl-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.cl-stats div { display: flex; align-items: center; gap: 7px; padding: 10px 12px; border-radius: 12px; background: rgba(255,255,255,.03); border: .5px solid rgba(255,255,255,.07); color: #8A8AAA; font-size: 12px; }
.cl-stats svg { color: var(--c); } .cl-stats b { color: #F0EDF8; font-size: 17px; }
.cl-link { display: flex; align-items: center; gap: 8px; padding: 7px 7px 7px 12px; border-radius: 11px; background: rgba(0,0,0,.35); border: .5px solid rgba(255,255,255,.08); }
.cl-link code { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 500 11.5px 'JetBrains Mono', monospace; color: #C8C4D8; }
.cl-link button { display: inline-flex; align-items: center; gap: 4px; flex: none; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 11.5px; color: #fff;
  background: color-mix(in srgb, var(--c) 30%, rgba(255,255,255,.05)); border: .5px solid color-mix(in srgb, var(--c) 50%, transparent); }
.cl-link button:hover { background: color-mix(in srgb, var(--c) 50%, transparent); }
.cl-body .cl-btn.brand { width: 100%; padding: 11px; }
.cl-add { align-items: center; justify-content: center; gap: 10px; min-height: 260px; cursor: pointer; color: #8A8AAA; font: inherit; --c: #E8002A;
  background: rgba(255,255,255,.015); border: 1px dashed rgba(255,255,255,.16); }
.cl-add span { width: 54px; height: 54px; border-radius: 16px; display: grid; place-items: center; color: #fff; background: rgba(232,0,42,.15); border: .5px solid rgba(232,0,42,.4); transition: all .2s; }
.cl-add b { font-size: 14.5px; color: #C8C4D8; }
.cl-add:hover span { background: #E8002A; box-shadow: 0 0 26px rgba(232,0,42,.5); }
.cl-add:hover { border-color: rgba(232,0,42,.45); }
.cl-how { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin: 24px 0 0; font-size: 13px; color: #8A8AAA; }
.cl-how a { color: #F0EDF8; }

.cle-back { position: fixed; inset: 0; z-index: 9500; display: grid; place-items: center; padding: 16px; background: rgba(4,4,10,.78); backdrop-filter: blur(6px); animation: cleFade .2s ease-out; }
@keyframes cleFade { from { opacity: 0; } }
.cle { position: relative; width: 980px; max-width: 100%; max-height: calc(100vh - 32px); overflow: hidden; display: grid; grid-template-columns: 1fr 400px; border-radius: 22px;
  background: linear-gradient(160deg, #16141F, #0D0C16); border: .5px solid color-mix(in srgb, var(--c) 50%, transparent);
  box-shadow: 0 30px 90px rgba(0,0,0,.75), 0 0 60px color-mix(in srgb, var(--c) 16%, transparent); color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif;
  animation: cleIn .35s cubic-bezier(.2,1.1,.3,1); transition: border-color .4s, box-shadow .4s; }
@keyframes cleIn { from { opacity: 0; transform: translateY(14px) scale(.97); } }
.cle-glow { position: absolute; top: -200px; left: -160px; width: 560px; height: 560px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, var(--c), transparent 72%); opacity: 0; animation: cleGlow 1s cubic-bezier(.2,.8,.2,1) forwards; }
@keyframes cleGlow { 0% { opacity: 0; transform: scale(.3); } 100% { opacity: .24; transform: scale(1); } }
.cle-x { position: absolute; top: 14px; right: 14px; z-index: 3; }
.cle-form { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; padding: 24px; overflow-y: auto; max-height: calc(100vh - 32px); box-sizing: border-box; }
.cle-title { font-size: 20px; }
.cle-f { display: flex; flex-direction: column; gap: 7px; }
.cle-f > span { display: flex; align-items: center; gap: 8px; font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: #8A8AAA; }
.cle-auto { display: inline-flex; align-items: center; gap: 4px; font-style: normal; text-transform: none; letter-spacing: 0; color: var(--c); filter: brightness(1.25); }
.cle input:not([type=checkbox]):not([type=color]):not([type=file]), .cle textarea { width: 100%; box-sizing: border-box; padding: 11px 13px; border-radius: 11px; font: 14px system-ui, sans-serif; color: #F0EDF8;
  background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.13); outline: none; resize: vertical; }
.cle input:focus, .cle textarea:focus { border-color: var(--c); box-shadow: 0 0 0 3px color-mix(in srgb, var(--c) 18%, transparent); }
.cle-drop { display: flex; align-items: center; gap: 14px; padding: 12px; border-radius: 14px; cursor: pointer; outline: none;
  background: rgba(255,255,255,.03); border: 1px dashed color-mix(in srgb, var(--c) 45%, rgba(255,255,255,.15)); transition: all .2s; }
.cle-drop:hover, .cle-drop.drag, .cle-drop:focus-visible { background: color-mix(in srgb, var(--c) 9%, transparent); border-color: var(--c); }
.cle-drop-logo { width: 64px; height: 64px; border-radius: 17px; flex: none; display: grid; place-items: center; color: #C8C4D8; overflow: hidden; box-sizing: border-box;
  background: color-mix(in srgb, var(--c) 14%, #0E0C16); border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow: 0 0 32px color-mix(in srgb, var(--c) 50%, transparent); transition: box-shadow .4s, border-color .4s; }
.cle-drop-logo img { width: 100%; height: 100%; object-fit: contain; padding: 7px; box-sizing: border-box; }
.cle-drop-tx { display: flex; flex-direction: column; gap: 4px; align-items: flex-start; }
.cle-drop-tx b { display: inline-flex; align-items: center; gap: 6px; font-size: 13.5px; }
.cle-drop-tx small { font-size: 12px; color: #8A8AAA; }
.cle-drop-tx button { padding: 0; background: none; border: none; cursor: pointer; font-size: 12px; color: #FF6B85; }
.cle-colors { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cle-colors button, .cle-custom { width: 30px; height: 30px; border-radius: 9px; border: 2px solid transparent; cursor: pointer; box-sizing: border-box; transition: transform .15s; }
.cle-colors button:hover { transform: scale(1.1); }
.cle-colors button.on, .cle-custom.on { border-color: #fff; box-shadow: 0 0 14px rgba(255,255,255,.35); }
.cle-custom { position: relative; display: grid; place-items: center; background-image: conic-gradient(red, yellow, lime, cyan, blue, magenta, red) !important; }
.cle-custom.on { background-image: none !important; }
.cle-custom input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
.cle-pw { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13px; color: #C8C4D8; }
.cle-pw button { padding: 5px 10px; border-radius: 7px; cursor: pointer; font-size: 12px; color: #E8E4F4; background: rgba(255,255,255,.06); border: .5px solid rgba(255,255,255,.14); }
.cle-sw { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 13.5px; color: #D8D4EC; cursor: pointer; }
.cle-sw input { accent-color: var(--c); width: 16px; height: 16px; }
.cle-sw small { width: 100%; padding-left: 24px; color: #6A6A8A; font-size: 11.5px; }
.cle-err { font-size: 13px; color: #FF6B85; }
.cle-act { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; padding-top: 6px; }

.cle-prev { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 10px; padding: 24px 22px; border-left: .5px solid rgba(255,255,255,.08);
  background: linear-gradient(180deg, rgba(0,0,0,.25), rgba(0,0,0,.4)); }
.cle-prev-k { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .14em; text-transform: uppercase; color: #8A8AAA; margin-top: 30px; }
.pv { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 10px; padding: 18px 16px; border-radius: 16px;
  background: radial-gradient(ellipse 90% 50% at 50% -10%, color-mix(in srgb, var(--c) 28%, transparent), transparent 70%), #08080F;
  border: .5px solid rgba(255,255,255,.1); box-shadow: 0 20px 50px rgba(0,0,0,.5); transition: background .4s; }
.pv-line { position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--c), #fff, var(--c), transparent); }
.pv-head { display: flex; align-items: center; gap: 10px; }
.pv-head .cl-logo { box-shadow: 0 0 18px color-mix(in srgb, var(--c) 50%, transparent); }
.pv-head .cl-logo.img { padding: 4px; }
.pv-head div { display: flex; flex-direction: column; min-width: 0; }
.pv-head b { font-size: 15px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-head small { font: 600 8.5px 'JetBrains Mono', monospace; letter-spacing: .18em; text-transform: uppercase; color: var(--c); filter: brightness(1.3); }
.pv-intro { margin: 0; font-size: 11.5px; line-height: 1.5; color: #A8A4BC; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.pv-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; }
.pv-stats div { display: flex; flex-direction: column; padding: 7px 8px; border-radius: 8px; background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.08); }
.pv-stats b { font-size: 14px; } .pv-stats span { font-size: 9px; color: #8A8AAA; }
.pv-k { font: 600 8.5px 'JetBrains Mono', monospace; letter-spacing: .18em; text-transform: uppercase; color: #8A8AAA; margin-top: 4px; }
.pv-feat { display: flex; flex-direction: column; gap: 5px; padding: 12px; border-radius: 12px; background: linear-gradient(150deg, color-mix(in srgb, var(--c) 16%, #12101B), #0D0C16);
  border: .5px solid color-mix(in srgb, var(--c) 45%, transparent); }
.pv-feat small { font: 500 9px 'JetBrains Mono', monospace; color: #8A8AAA; } .pv-feat b { font-size: 13px; }
.pv-feat i { display: block; height: 5px; border-radius: 4px; background: rgba(255,255,255,.1); } .pv-feat i + i { width: 70%; }
.pv-feat em { align-self: flex-start; margin-top: 4px; font-style: normal; font-size: 10px; font-weight: 600; color: #fff; padding: 4px 8px; border-radius: 6px; background: var(--c); }
.pv-pow { text-align: center; font: 500 8.5px 'JetBrains Mono', monospace; color: #6A6A8A; margin-top: 4px; }
.pv-pow b { color: #C8C4D8; letter-spacing: .25em; margin-left: 3px; } .pv-pow b span { color: #E8002A; }

@media (max-width: 900px) { .cle { grid-template-columns: minmax(0, 1fr); overflow-y: auto; } .cle-prev { display: none; } .cle-form { max-height: none; } }
@media (max-width: 760px) { .cl-in { padding: 22px 16px 60px; } .cl-steps { grid-template-columns: minmax(0, 1fr); } .cl-grid { grid-template-columns: minmax(0, 1fr); } }
@media (prefers-reduced-motion: reduce) { .cl-scan, .cl-sweep, .cl-orbs i, .cl-card, .cle, .cle-glow { animation: none; } .cle-glow { opacity: .24; } }
`
