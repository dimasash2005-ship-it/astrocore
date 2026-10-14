"use client"

// Google Sheets link for the Marketing lab: paste a link, the numbers are read from the sheet.
// The sheet must be shared as "Anyone with the link: Viewer" (no Google login, no API key).
// Exports: <SheetInput/> (link field), <SheetBar/> (connected state), sheetErrText(), agoText().

import { useState } from "react"
import { Link2, Loader2, RefreshCw, Unlink, ChevronDown, ExternalLink } from "lucide-react"
import type { Nums, MktRow, SheetError, SheetLink } from "@/lib/marketing"

type Lang = "uk" | "en"
export type ParsedSheet = { rows: MktRow[]; totals: Nums; currency: string | null; found: (keyof Nums)[] }

const T = {
  uk: {
    label: "Google Таблиця", ph: "Встав посилання на Google Таблицю…", connect: "Підключити",
    how: "Як відкрити доступ?",
    steps: [
      "У таблиці натисни «Поділитися» (Share) у правому верхньому куті",
      "«Загальний доступ» → «Усі, хто має посилання» → роль «Читач»",
      "Відкрий потрібну вкладку і скопіюй посилання з адресного рядка",
      "Перший рядок — назви колонок: Витрати, Покази, Кліки, Ліди, Продажі, Дохід (можна англійською)",
    ],
    synced: "Підключено Google Таблицю", updated: "оновлено", refresh: "Оновити", off: "Відключити", open: "Відкрити",
    auto: "Цифри оновлюються самі: коли відкриваєш звіт і коли клієнт заходить у кабінет.",
    err: {
      badurl: "Це не схоже на посилання Google Таблиці (docs.google.com/spreadsheets/…).",
      private: "Таблиця закрита. «Поділитися» → «Усі, хто має посилання» → «Читач», і спробуй ще раз.",
      notfound: "Таблицю не знайдено. Перевір посилання.",
      empty: "Таблиця (ця вкладка) порожня.",
      nocolumns: "Не знайшов колонок з цифрами. Перший рядок має містити назви: Витрати, Покази, Кліки…",
      network: "Google не відповів. Спробуй ще раз за хвилину.",
      toolarge: "Таблиця завелика (до 3 MB).",
    } as Record<SheetError, string>,
    ago: (min: number) => min < 1 ? "щойно" : min < 60 ? `${min} хв тому` : min < 1440 ? `${Math.round(min / 60)} год тому` : `${Math.round(min / 1440)} дн тому`,
  },
  en: {
    label: "Google Sheet", ph: "Paste a Google Sheets link…", connect: "Connect",
    how: "How to share it?",
    steps: [
      "In the sheet click «Share» in the top right corner",
      "«General access» → «Anyone with the link» → role «Viewer»",
      "Open the right tab and copy the link from the address bar",
      "First row = column names: Spend, Impressions, Clicks, Leads, Sales, Revenue",
    ],
    synced: "Google Sheet connected", updated: "updated", refresh: "Refresh", off: "Disconnect", open: "Open",
    auto: "Numbers update on their own: when you open the report and when the client opens their portal.",
    err: {
      badurl: "That doesn't look like a Google Sheets link (docs.google.com/spreadsheets/…).",
      private: "The sheet is private. Share → «Anyone with the link» → «Viewer», then try again.",
      notfound: "Sheet not found. Check the link.",
      empty: "This sheet (tab) is empty.",
      nocolumns: "Couldn't find number columns. The first row should have names like Spend, Impressions, Clicks…",
      network: "Google didn't answer. Try again in a minute.",
      toolarge: "The sheet is too big (3 MB max).",
    } as Record<SheetError, string>,
    ago: (min: number) => min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`,
  },
}

export const sheetErrText = (e: string | null | undefined, lang: Lang) => e ? (T[lang].err[e as SheetError] ?? T[lang].err.network) : ""
export const agoText = (iso: string, lang: Lang) => T[lang].ago(Math.max(0, Math.round((Date.now() - (Date.parse(iso) || Date.now())) / 60000)))

/** Reads a sheet through our API. Returns parsed numbers or an error code. */
export async function fetchSheet(url: string): Promise<{ parsed?: ParsedSheet; error?: string }> {
  try {
    const r = await fetch("/api/marketing/sheet", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
    return await r.json()
  } catch {
    return { error: "network" }
  }
}

export function SheetInput({ lang, onParsed, compact }: { lang: Lang; onParsed: (url: string, p: ParsedSheet) => void | Promise<void>; compact?: boolean }) {
  const t = T[lang]
  const [url, setUrl] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [how, setHow] = useState(false)

  async function go() {
    const u = url.trim()
    if (!u) return
    setBusy(true); setErr("")
    const r = await fetchSheet(u)
    if (r.parsed) await onParsed(u, r.parsed)
    else setErr(sheetErrText(r.error ?? "network", lang))
    setBusy(false)
  }

  return (
    <div className={`gsc${compact ? " compact" : ""}`}>
      <style>{CSS}</style>
      <div className="gsc-row">
        <span className="gsc-ic"><SheetsIcon /></span>
        <input value={url} onChange={e => { setUrl(e.target.value); setErr("") }} placeholder={t.ph} spellCheck={false}
          onKeyDown={e => { if (e.key === "Enter") go() }} onPaste={e => e.stopPropagation()} />
        <button className="gsc-btn" onClick={go} disabled={busy || !url.trim()}>
          {busy ? <Loader2 size={13} className="gsc-spin" /> : <Link2 size={13} />} {t.connect}
        </button>
      </div>
      {err && <div className="gsc-err">{err}</div>}
      <button className="gsc-how" onClick={() => setHow(h => !h)}>{t.how} <ChevronDown size={12} style={{ transform: how ? "rotate(180deg)" : "none" }} /></button>
      {how && <ol className="gsc-steps">{t.steps.map(s => <li key={s}>{s}</li>)}</ol>}
    </div>
  )
}

export function SheetBar({ sheet, lang, busy, onRefresh, onDisconnect }: { sheet: SheetLink; lang: Lang; busy: boolean; onRefresh: () => void; onDisconnect: () => void }) {
  const t = T[lang]
  return (
    <div className={`gsb${sheet.error ? " bad" : ""}`}>
      <style>{CSS}</style>
      <span className="gsc-ic"><SheetsIcon /></span>
      <div className="gsb-t">
        <b>{t.synced}<i className="gsb-live" /></b>
        <span>{sheet.error ? sheetErrText(sheet.error, lang) : `${t.updated} ${agoText(sheet.syncedAt, lang)} · ${t.auto}`}</span>
      </div>
      <div className="gsb-a">
        <a className="gsc-btn ghost" href={sheet.url} target="_blank" rel="noopener noreferrer"><ExternalLink size={13} /> {t.open}</a>
        <button className="gsc-btn" onClick={onRefresh} disabled={busy}>{busy ? <Loader2 size={13} className="gsc-spin" /> : <RefreshCw size={13} />} {t.refresh}</button>
        <button className="gsc-btn ghost" onClick={onDisconnect} disabled={busy}><Unlink size={13} /> {t.off}</button>
      </div>
    </div>
  )
}

function SheetsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path d="M6 2h9l5 5v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" fill="#0F9D58" />
      <path d="M15 2v5h5" fill="#87CEAC" />
      <path d="M7.5 11h9v7h-9z" fill="#fff" /><path d="M8.5 12h3v1.6h-3zm4 0h3v1.6h-3zm-4 2.6h3v1.6h-3zm4 0h3v1.6h-3z" fill="#0F9D58" />
    </svg>
  )
}

const CSS = `
.gsc { display: flex; flex-direction: column; gap: 8px; padding: 14px; border-radius: 14px; text-align: left;
  background: linear-gradient(160deg, rgba(15,157,88,.10), rgba(255,255,255,.02)); border: .5px solid rgba(15,157,88,.35); }
.gsc.compact { padding: 12px; }
.gsc-row { display: flex; align-items: center; gap: 8px; }
.gsc-ic { width: 34px; height: 34px; flex: none; display: grid; place-items: center; border-radius: 10px; background: rgba(15,157,88,.14); box-shadow: 0 0 16px rgba(15,157,88,.25); }
.gsc-row input { flex: 1; min-width: 0; padding: 10px 12px; border-radius: 10px; font: 13px 'JetBrains Mono', monospace; color: #fff;
  background: rgba(0,0,0,.35); border: .5px solid rgba(255,255,255,.14); outline: none; }
.gsc-row input:focus { border-color: #0F9D58; box-shadow: 0 0 0 3px rgba(15,157,88,.18); }
.gsc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 13px; border-radius: 10px; cursor: pointer; white-space: nowrap; text-decoration: none;
  font: 600 12.5px 'Space Grotesk', system-ui, sans-serif; color: #fff; background: linear-gradient(135deg, #0F9D58, #0B7A44); border: .5px solid rgba(255,255,255,.18); }
.gsc-btn:disabled { opacity: .5; cursor: default; }
.gsc-btn.ghost { color: #C8C4D8; background: rgba(255,255,255,.04); }
.gsc-btn.ghost:hover { color: #fff; }
.gsc-err { font-size: 12.5px; color: #FF6B85; line-height: 1.45; }
.gsc-how { align-self: flex-start; display: inline-flex; align-items: center; gap: 5px; padding: 0; cursor: pointer; font-size: 12px; color: #8FD4B0; background: none; border: none; }
.gsc-steps { margin: 0; padding-left: 20px; display: flex; flex-direction: column; gap: 4px; font-size: 12.5px; color: #C8C4D8; line-height: 1.45; }
.gsc-spin { animation: gscSpin .8s linear infinite; } @keyframes gscSpin { to { transform: rotate(360deg); } }
.gsb { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; flex-wrap: wrap;
  background: linear-gradient(100deg, rgba(15,157,88,.13), rgba(255,255,255,.02) 70%); border: .5px solid rgba(15,157,88,.4); }
.gsb.bad { background: linear-gradient(100deg, rgba(232,0,42,.12), rgba(255,255,255,.02) 70%); border-color: rgba(232,0,42,.4); }
.gsb-t { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 3px; }
.gsb-t b { display: flex; align-items: center; gap: 8px; font-size: 13.5px; color: #fff; }
.gsb-t span { font-size: 12px; color: #A8A4BC; line-height: 1.4; }
.gsb.bad .gsb-t span { color: #FF8FA3; }
.gsb-live { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 8px #22C55E; animation: gsbPulse 1.8s ease-in-out infinite; }
.gsb.bad .gsb-live { background: #E8002A; box-shadow: 0 0 8px #E8002A; }
@keyframes gsbPulse { 50% { opacity: .35; } }
.gsb-a { display: flex; gap: 6px; flex-wrap: wrap; }
`
