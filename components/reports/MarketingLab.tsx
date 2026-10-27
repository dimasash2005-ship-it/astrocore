"use client"

// "Marketing" tab of a report: drop a CSV export from Facebook / Google / TikTok Ads,
// paste a table copied from Ads Manager or Google Sheets (Ctrl+V), or type 6 numbers.
// All metrics, the funnel, the what-if forecast and the summary are computed by code (no AI).
// Saved to reports.marketing, so the client portal shows the same dashboard.

import { useCallback, useEffect, useRef, useState } from "react"
import { Upload, ClipboardPaste, PencilLine, Save, Loader2, Check, Trash2, FileSpreadsheet, ChevronDown, Sparkles } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import MarketingView, { metricLabel } from "@/components/reports/MarketingView"
import { SheetInput, SheetBar, sheetErrText, type ParsedSheet } from "@/components/reports/SheetConnect"
import {
  emptyMarketing, parseTable, isMarketing, applyParsed, sheetStale, withSnapshot, forecast, effectiveRevenue, computeMetrics, fmtMoney, fmtNum,
  type Marketing, type Channel, type Nums,
} from "@/lib/marketing"

type Lang = "uk" | "en"

const CHANNELS: { key: Channel; label: string; color: string }[] = [
  { key: "facebook", label: "Facebook / Instagram", color: "#3B82F6" },
  { key: "google", label: "Google Ads", color: "#22C55E" },
  { key: "tiktok", label: "TikTok", color: "#EC4899" },
  { key: "affiliate", label: "Affiliate", color: "#F5B13B" },
  { key: "other", label: "Other", color: "#8B5CF6" },
]
const CURRENCIES = ["$", "€", "₴", "£", "zł", "Kč"]

const L = {
  uk: {
    title: "Маркетинг-лабораторія", sub: "Закинь цифри кампанії, і всі метрики, воронка та прогноз порахуються самі.",
    drop: "Перетягни сюди CSV з Ads Manager", or: "або", choose: "Обрати файл", paste: "Скопіюй таблицю (Ads Manager, Google Таблиці) і натисни Ctrl+V тут",
    manual: "Ввести 6 цифр вручну", how: "Як вивантажити з Facebook Ads?",
    howSteps: ["Ads Manager → потрібні кампанії → кнопка «Експорт» (стрілка вниз)", "Обери «Експорт таблиці даних» → формат CSV", "Перетягни файл сюди. Колонки розпізнаються самі"],
    spend: "Витрати", impressions: "Покази", clicks: "Кліки", leads: "Ліди", sales: "Продажі", revenue: "Дохід", payout: "Payout за апрув",
    channel: "Канал", currency: "Валюта", save: "Зберегти у звіт", saved: "Збережено", update: "Оновити з файлу", clear: "Очистити",
    found: "Знайдено колонки", notFound: "Не знайшов колонок з цифрами. Перевір, що в першому рядку є назви: Amount spent / Витрати, Impressions / Покази, Clicks / Кліки…",
    loaded: (n: number) => `Завантажено ${n} ${n === 1 ? "рядок" : n < 5 ? "рядки" : "рядків"}`, fromFile: "Підсумок з файлу, можна поправити",
    whatIf: "Що буде, якщо…", budget: "Бюджет", crSale: "Конверсія лід → продаж", fcSales: "продажів", fcRev: "дохід", fcProfit: "прибуток", now: "зараз",
    same: "За тих самих CPM, CTR і конверсії в лід.", needData: "Додай витрати, ліди й продажі, щоб побачити прогноз.",
    setup: "Не вдалося зберегти. Виконай SQL «report_marketing» у Supabase.", clearQ: "Прибрати маркетингові дані з цього звіту?",
    unsaved: "Є незбережені зміни", showsClient: "Після збереження це бачить і клієнт у своєму кабінеті.",
  },
  en: {
    title: "Marketing lab", sub: "Drop in campaign numbers and every metric, the funnel and a forecast are calculated for you.",
    drop: "Drop a CSV from Ads Manager here", or: "or", choose: "Choose a file", paste: "Copy a table (Ads Manager, Google Sheets) and press Ctrl+V here",
    manual: "Type 6 numbers by hand", how: "How to export from Facebook Ads?",
    howSteps: ["Ads Manager → select campaigns → the Export button (down arrow)", "Choose “Export table data” → CSV", "Drop the file here. Columns are detected automatically"],
    spend: "Spend", impressions: "Impressions", clicks: "Clicks", leads: "Leads", sales: "Sales", revenue: "Revenue", payout: "Payout per approve",
    channel: "Channel", currency: "Currency", save: "Save to report", saved: "Saved", update: "Update from file", clear: "Clear",
    found: "Columns found", notFound: "Couldn't find number columns. Make sure the first row has names like Amount spent, Impressions, Clicks…",
    loaded: (n: number) => `Loaded ${n} row${n === 1 ? "" : "s"}`, fromFile: "Totals from the file, you can adjust them",
    whatIf: "What if…", budget: "Budget", crSale: "Lead → sale rate", fcSales: "sales", fcRev: "revenue", fcProfit: "profit", now: "now",
    same: "With the same CPM, CTR and click → lead rate.", needData: "Add spend, leads and sales to see a forecast.",
    setup: "Couldn't save. Run the \"report_marketing\" SQL in Supabase.", clearQ: "Remove marketing data from this report?",
    unsaved: "Unsaved changes", showsClient: "Once saved, the client sees this in their portal too.",
  },
}

const FIELDS: (keyof Nums)[] = ["spend", "impressions", "clicks", "leads", "sales", "revenue"]

export default function MarketingLab({ reportId, initial, lang, onSaved }: { reportId: string; initial: unknown; lang: Lang; onSaved?: (m: Marketing | null) => void }) {
  const tx = L[lang]
  const [m, setM] = useState<Marketing | null>(isMarketing(initial) ? initial : null)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState("")
  const [note, setNote] = useState<string>("")
  const [drag, setDrag] = useState(false)
  const [howOpen, setHowOpen] = useState(false)
  const [budget, setBudget] = useState<number | null>(null)
  const [crSale, setCrSale] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [syncing, setSyncing] = useState(false)

  const change = useCallback((next: Marketing) => { setM({ ...next, updatedAt: new Date().toISOString() }); setDirty(true); setSaved(false) }, [])

  const load = useCallback((text: string, source: "csv" | "paste") => {
    const r = parseTable(text)
    if (r.error) { setErr(tx.notFound); return false }
    setErr("")
    const base = m ?? emptyMarketing()
    change({ ...applyParsed(base, r, source), sheet: undefined })
    setNote(`${tx.loaded(r.rows.length)} · ${tx.found}: ${r.found.map(k => tx[k]).join(", ")}`)
    setBudget(null); setCrSale(null)
    return true
  }, [m, change, tx])

  async function readFile(f: File | undefined) {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setErr("5 MB max"); return }
    const text = await f.text()
    load(text, "csv")
  }

  // Ctrl+V anywhere on the tab (except inside inputs) loads a copied table.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return
      const text = e.clipboardData?.getData("text/plain") ?? ""
      if (text.includes("\n") && /[\t,;]/.test(text)) { e.preventDefault(); load(text, "paste") }
    }
    document.addEventListener("paste", onPaste)
    return () => document.removeEventListener("paste", onPaste)
  }, [load])

  async function save(raw: Marketing | null = m) {
    if (!raw) return
    const mm = withSnapshot(raw)
    setM(mm)
    setSaving(true); setErr("")
    const { error } = await getSupabase().from("reports").update({ marketing: mm }).eq("id", reportId)
    setSaving(false)
    if (error) { setErr(tx.setup); return }
    setDirty(false); setSaved(true)
    onSaved?.(mm)
  }

  // ── Google Sheets ──
  async function connectSheet(url: string, p: ParsedSheet) {
    const next: Marketing = { ...applyParsed(m ?? emptyMarketing(), p, "sheet"), sheet: { url, syncedAt: new Date().toISOString() } }
    setM(next); setSheetOpen(false); setBudget(null); setCrSale(null)
    setNote(`${tx.loaded(p.rows.length)} · ${tx.found}: ${p.found.map(k => tx[k]).join(", ")}`)
    await save(next)
  }

  const refreshSheet = useCallback(async () => {
    setSyncing(true); setErr("")
    try {
      const r = await fetch("/api/marketing/sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reportId }) })
      const d = await r.json() as { marketing?: Marketing; error?: string | null }
      if (d.marketing && isMarketing(d.marketing)) { setM(d.marketing); setDirty(false); onSaved?.(d.marketing) }
      if (d.error) setErr(sheetErrText(d.error, lang))
    } catch { setErr(sheetErrText("network", lang)) }
    setSyncing(false)
  }, [reportId, lang, onSaved])

  async function disconnectSheet() {
    if (!m) return
    const next: Marketing = { ...m, sheet: undefined, source: "manual" }
    setM(next)
    await save(next)
  }

  // Opening a report with a connected sheet re-reads it when the numbers are older than 30 min.
  const autoSynced = useRef(false)
  useEffect(() => {
    if (autoSynced.current || !m || dirty || !sheetStale(m)) return
    autoSynced.current = true
    refreshSheet()
  }, [m, dirty, refreshSheet])

  async function clear() {
    if (!window.confirm(tx.clearQ)) return
    const { error } = await getSupabase().from("reports").update({ marketing: null }).eq("id", reportId)
    if (error) { setErr(tx.setup); return }
    setM(null); setDirty(false); setNote("")
    onSaved?.(null)
  }

  const setNum = (k: keyof Nums, v: string) => {
    if (!m) return
    const n = Math.max(0, Number(v.replace(",", ".")) || 0)
    change({ ...m, totals: { ...m.totals, [k]: n }, source: m.source === "agent" ? "manual" : m.source })
  }

  // ── Empty state ──
  if (!m) {
    return (
      <section className="mkl">
        <style>{CSS}</style>
        <div className="mkl-h"><b>💹 {tx.title}</b><span>{tx.sub}</span></div>
        <div className={`mkl-drop${drag ? " drag" : ""}`}
          onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]) }}>
          <span className="mkl-drop-ic"><FileSpreadsheet size={26} /></span>
          <b>{tx.drop}</b>
          <div className="mkl-drop-row">
            <button className="mkl-btn pri" onClick={() => fileRef.current?.click()}><Upload size={14} /> {tx.choose}</button>
            <span>{tx.or}</span>
            <button className="mkl-btn" onClick={() => change(emptyMarketing())}><PencilLine size={14} /> {tx.manual}</button>
          </div>
          <small><ClipboardPaste size={12} /> {tx.paste}</small>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={e => { readFile(e.target.files?.[0]); e.target.value = "" }} />
        </div>
        <SheetInput lang={lang} onParsed={connectSheet} />
        {err && <div className="mkl-err">{err}</div>}
        <button className="mkl-how" onClick={() => setHowOpen(o => !o)}>{tx.how} <ChevronDown size={13} style={{ transform: howOpen ? "rotate(180deg)" : "none" }} /></button>
        {howOpen && <ol className="mkl-steps">{tx.howSteps.map(s => <li key={s}>{s}</li>)}</ol>}
      </section>
    )
  }

  const rev = effectiveRevenue(m, m.totals)
  const x = computeMetrics(m.totals, rev)
  const canForecast = m.totals.spend > 0 && m.totals.leads > 0 && m.totals.sales > 0 && rev > 0
  const b = budget ?? m.totals.spend
  const cr = crSale ?? (x.crSale ?? 0)
  const fc = canForecast ? forecast(m.totals, rev, b, cr) : null
  const chColor = CHANNELS.find(c => c.key === m.channel)?.color ?? "#E8002A"

  return (
    <section className="mkl" style={{ ["--ch" as string]: chColor } as React.CSSProperties}>
      <style>{CSS}</style>
      <div className="mkl-top">
        <div className="mkl-h"><b>💹 {tx.title}</b><span>{dirty ? `● ${tx.unsaved}` : tx.showsClient}</span></div>
        <div className="mkl-acts">
          {!m.sheet && <button className={`mkl-btn${sheetOpen ? " on" : ""}`} onClick={() => setSheetOpen(o => !o)}><FileSpreadsheet size={13} /> Google {lang === "uk" ? "Таблиця" : "Sheet"}</button>}
          <button className="mkl-btn" onClick={() => fileRef.current?.click()}><Upload size={13} /> {tx.update}</button>
          <button className="mkl-btn ghost" onClick={clear}><Trash2 size={13} /> {tx.clear}</button>
          <button className="mkl-btn pri" onClick={() => save()} disabled={saving || !dirty}>
            {saving ? <Loader2 size={13} className="mkl-spin" /> : saved && !dirty ? <Check size={13} /> : <Save size={13} />}
            {saved && !dirty ? tx.saved : tx.save}
          </button>
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={e => { readFile(e.target.files?.[0]); e.target.value = "" }} />
        </div>
      </div>
      {err && <div className="mkl-err">{err}</div>}
      {m.sheet && <SheetBar sheet={m.sheet} lang={lang} busy={syncing} onRefresh={refreshSheet} onDisconnect={disconnectSheet} />}
      {!m.sheet && sheetOpen && <SheetInput lang={lang} onParsed={connectSheet} compact />}

      <div className="mkl-grid">
        <aside className="mkl-side">
          <div className="mkl-f"><span>{tx.channel}</span>
            <div className="mkl-chips">
              {CHANNELS.map(c => (
                <button key={c.key} className={m.channel === c.key ? "on" : ""} style={{ ["--cc" as string]: c.color } as React.CSSProperties}
                  onClick={() => change({ ...m, channel: c.key })}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="mkl-f"><span>{tx.currency}</span>
            <div className="mkl-chips cur">
              {CURRENCIES.map(c => <button key={c} className={m.currency === c ? "on" : ""} onClick={() => change({ ...m, currency: c })}>{c}</button>)}
            </div>
          </div>
          <div className="mkl-nums">
            {FIELDS.map(k => (
              <label key={k}>
                <span>{k === "leads" || k === "sales" ? metricLabel(k, m, lang) : tx[k]}</span>
                <input type="number" min={0} step="any" inputMode="decimal" value={m.totals[k] || ""} placeholder="0" onChange={e => setNum(k, e.target.value)} />
              </label>
            ))}
            {m.channel === "affiliate" && (
              <label><span>{tx.payout}</span>
                <input type="number" min={0} step="any" value={m.payout || ""} placeholder="0" onChange={e => change({ ...m, payout: Math.max(0, Number(e.target.value) || 0) })} />
              </label>
            )}
          </div>
          {(note || m.rows.length > 0) && <div className="mkl-note"><Sparkles size={11} /> {note || tx.fromFile}</div>}
          <small className="mkl-hint"><ClipboardPaste size={11} /> {tx.paste}</small>
        </aside>

        <div className="mkl-main">
          <div className="mkl-wi">
            <div className="mkl-wi-h">{tx.whatIf}</div>
            {fc ? (
              <>
                <label className="mkl-sl"><span>{tx.budget}<b>{fmtMoney(b, m.currency)}</b></span>
                  <input type="range" min={Math.max(1, Math.round(m.totals.spend * 0.25))} max={Math.round(m.totals.spend * 4)} step={Math.max(1, Math.round(m.totals.spend / 100))}
                    value={b} onChange={e => setBudget(Number(e.target.value))} />
                </label>
                <label className="mkl-sl"><span>{metricLabel("crSale", m, lang)}<b>{fmtNum(cr, 1)}%</b></span>
                  <input type="range" min={1} max={80} step={0.5} value={cr} onChange={e => setCrSale(Number(e.target.value))} />
                </label>
                <div className={`mkl-fc${fc.profit >= 0 ? "" : " neg"}`}>
                  <div><b>{fmtNum(fc.sales)}</b><span>{tx.fcSales}</span></div>
                  <div><b>{fmtMoney(fc.revenue, m.currency)}</b><span>{tx.fcRev}</span></div>
                  <div><b>{fc.profit >= 0 ? "+" : "−"}{fmtMoney(Math.abs(fc.profit), m.currency)}</b><span>{tx.fcProfit} · {tx.now} {fmtMoney(x.profit ?? 0, m.currency)}</span></div>
                </div>
                <small>{tx.same}</small>
              </>
            ) : <small>{tx.needData}</small>}
          </div>
          <MarketingView m={m} lang={lang} />
        </div>
      </div>
    </section>
  )
}

const CSS = `
.mkl { --ch: #E8002A; display: flex; flex-direction: column; gap: 14px; color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif; }
.mkl-top { display: flex; justify-content: space-between; align-items: flex-end; gap: 12px; flex-wrap: wrap; }
.mkl-h { display: flex; flex-direction: column; gap: 4px; }
.mkl-h b { font-size: 19px; } .mkl-h span { font-size: 12.5px; color: #8A8AAA; }
.mkl-acts { display: flex; gap: 8px; flex-wrap: wrap; }
.mkl-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 14px; border-radius: 10px; cursor: pointer; font: 600 12.5px 'Space Grotesk', system-ui, sans-serif;
  color: #E8E4F4; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.14); transition: all .15s; }
.mkl-btn:hover:not(:disabled) { background: rgba(255,255,255,.09); }
.mkl-btn.pri { color: #fff; background: #E8002A; border-color: #E8002A; box-shadow: 0 0 20px rgba(232,0,42,.35); }
.mkl-btn.pri:hover:not(:disabled) { background: #FF1A3E; }
.mkl-btn.on { color: #fff; border-color: #0F9D58; background: rgba(15,157,88,.16); }
.mkl-btn.ghost { color: #A8A4BC; background: transparent; }
.mkl-btn:disabled { opacity: .5; cursor: default; }
.mkl-spin { animation: mklSpin .8s linear infinite; } @keyframes mklSpin { to { transform: rotate(360deg); } }
.mkl-drop { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; padding: 40px 20px; border-radius: 18px;
  background: radial-gradient(ellipse 60% 70% at 50% 0%, rgba(232,0,42,.08), transparent 70%), rgba(255,255,255,.02); border: 1.5px dashed rgba(255,255,255,.16); transition: all .2s; }
.mkl-drop.drag { border-color: #E8002A; background: rgba(232,0,42,.08); }
.mkl-drop-ic { width: 58px; height: 58px; border-radius: 17px; display: grid; place-items: center; color: #fff; background: linear-gradient(140deg, #22C55E, #0E7A3B); box-shadow: 0 0 28px rgba(34,197,94,.4); }
.mkl-drop > b { font-size: 17px; }
.mkl-drop-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; color: #8A8AAA; font-size: 12.5px; }
.mkl-drop small, .mkl-hint { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #8A8AAA; }
.mkl-how { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; background: none; border: none; cursor: pointer; color: #A8A4BC; font-size: 13px; padding: 0; }
.mkl-steps { margin: 0; padding-left: 20px; color: #C8C4D8; font-size: 13px; line-height: 1.8; }
.mkl-err { padding: 10px 12px; border-radius: 10px; font-size: 13px; color: #FF8A9C; background: rgba(232,0,42,.08); border: .5px solid rgba(232,0,42,.3); }
.mkl-grid { display: grid; grid-template-columns: 300px minmax(0, 1fr); gap: 16px; align-items: start; }
.mkl-side { display: flex; flex-direction: column; gap: 14px; padding: 16px; border-radius: 16px; position: sticky; top: 16px;
  background: linear-gradient(170deg, color-mix(in srgb, var(--ch) 10%, #12101B), #0E0D17 70%); border: .5px solid color-mix(in srgb, var(--ch) 35%, rgba(255,255,255,.08)); }
.mkl-f { display: flex; flex-direction: column; gap: 7px; }
.mkl-f > span { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #8A8AAA; }
.mkl-chips { display: flex; flex-wrap: wrap; gap: 5px; }
.mkl-chips button { padding: 6px 10px; border-radius: 8px; cursor: pointer; font-size: 12px; color: #C8C4D8; background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.12); }
.mkl-chips button.on { color: #fff; background: color-mix(in srgb, var(--cc, #E8002A) 30%, transparent); border-color: var(--cc, #E8002A); }
.mkl-chips.cur button { min-width: 36px; }
.mkl-nums { display: flex; flex-direction: column; gap: 6px; }
.mkl-nums label { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 4px 4px 11px; border-radius: 10px; background: rgba(0,0,0,.25); border: .5px solid rgba(255,255,255,.08); }
.mkl-nums span { font-size: 12.5px; color: #C8C4D8; }
.mkl-nums input { width: 120px; padding: 7px 9px; border-radius: 7px; text-align: right; font: 600 13px 'JetBrains Mono', monospace; color: #fff; background: rgba(255,255,255,.05); border: .5px solid transparent; outline: none; }
.mkl-nums input:focus { border-color: var(--ch); }
.mkl-note { display: flex; gap: 6px; font-size: 11.5px; color: #A8A4BC; line-height: 1.45; }
.mkl-main { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.mkl-wi { display: flex; flex-direction: column; gap: 10px; padding: 16px 18px; border-radius: 14px; background: rgba(255,255,255,.025); border: .5px solid rgba(255,255,255,.09); }
.mkl-wi-h { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: #8A8AAA; }
.mkl-wi small { font-size: 11.5px; color: #6A6A8A; }
.mkl-sl { display: flex; flex-direction: column; gap: 6px; }
.mkl-sl span { display: flex; justify-content: space-between; font-size: 13px; color: #C8C4D8; } .mkl-sl b { font-family: 'JetBrains Mono', monospace; color: #fff; }
.mkl-sl input { width: 100%; accent-color: #F5B13B; }
.mkl-fc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; padding: 12px; border-radius: 12px; background: rgba(34,197,94,.08); border: .5px solid rgba(34,197,94,.3); }
.mkl-fc.neg { background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.3); }
.mkl-fc div { display: flex; flex-direction: column; gap: 2px; } .mkl-fc b { font-size: 18px; } .mkl-fc span { font-size: 11px; color: #8A8AAA; }
@media (max-width: 980px) { .mkl-grid { grid-template-columns: minmax(0, 1fr); } .mkl-side { position: static; } }
`
