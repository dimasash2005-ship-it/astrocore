"use client"

// "Marketing analysis" button on the Reports page: drop a CSV / paste a table / start empty,
// and a new report is created with the numbers already in its Marketing tab.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { useRouter } from "next/navigation"
import { X, Upload, PencilLine, ClipboardPaste, FileSpreadsheet, Loader2, TrendingUp } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { emptyMarketing, parseTable, summary, applyParsed, type Channel, type Marketing } from "@/lib/marketing"
import { SheetInput, type ParsedSheet } from "@/components/reports/SheetConnect"

type Lang = "uk" | "en"

const CH: { key: Channel; label: string; color: string }[] = [
  { key: "facebook", label: "Facebook / Instagram", color: "#3B82F6" },
  { key: "google", label: "Google Ads", color: "#22C55E" },
  { key: "tiktok", label: "TikTok", color: "#EC4899" },
  { key: "affiliate", label: "Affiliate", color: "#F5B13B" },
  { key: "other", label: "Other", color: "#8B5CF6" },
]

const L = {
  uk: {
    btn: "Маркетинг-аналіз", title: "Швидкий маркетинг-аналіз", sub: "Закинь цифри реклами, і за секунду буде звіт з ROI, ROAS, CTR, CPM, воронкою та прогнозом.",
    name: "Назва звіту", namePh: (d: string) => `Аналіз реклами · ${d}`, channel: "Канал",
    drop: "Перетягни CSV з Ads Manager", choose: "Обрати файл", paste: "або скопіюй таблицю (Ads Manager, Google Таблиці) і натисни Ctrl+V",
    manual: "Почати з нуля, введу цифри сам", bad: "Не знайшов колонок з цифрами. У першому рядку мають бути назви: Amount spent / Витрати, Impressions / Покази, Clicks / Кліки…",
    busy: "Створюю звіт…", err: "Не вдалося створити звіт. Перевір, що SQL «report_marketing» виконано.",
  },
  en: {
    btn: "Marketing analysis", title: "Quick marketing analysis", sub: "Drop in your ad numbers and get a report with ROI, ROAS, CTR, CPM, a funnel and a forecast in a second.",
    name: "Report name", namePh: (d: string) => `Ad analysis · ${d}`, channel: "Channel",
    drop: "Drop a CSV from Ads Manager", choose: "Choose a file", paste: "or copy a table (Ads Manager, Google Sheets) and press Ctrl+V",
    manual: "Start empty, I'll type the numbers", bad: "Couldn't find number columns. The first row should have names like Amount spent, Impressions, Clicks…",
    busy: "Creating the report…", err: "Couldn't create the report. Make sure the \"report_marketing\" SQL was run.",
  },
}

export function MarketingQuickButton({ lang }: { lang: Lang }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button className="mqb" onClick={() => setOpen(true)}>
        <style>{BTN_CSS}</style>
        <span className="mqb-ic"><TrendingUp size={14} /></span> {L[lang].btn}
      </button>
      {open && <MarketingQuickStart lang={lang} onClose={() => setOpen(false)} />}
    </>
  )
}

export default function MarketingQuickStart({ lang, onClose }: { lang: Lang; onClose: () => void }) {
  const tx = L[lang]
  const router = useRouter()
  const date = new Date().toLocaleDateString(lang === "uk" ? "uk-UA" : "en-US", { day: "numeric", month: "long" })
  const [name, setName] = useState("")
  const [channel, setChannel] = useState<Channel>("facebook")
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState("")
  const [mounted, setMounted] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setMounted(true) }, [])

  async function create(m: Marketing) {
    setBusy(true); setErr("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setBusy(false); return }
    const title = name.trim() || tx.namePh(date)
    const lines = m.totals.spend > 0 || m.totals.clicks > 0 ? summary(m, lang) : []
    const md = lines.length ? `## ${lang === "uk" ? "Висновок" : "Summary"}\n\n${lines.map(l => `- ${l}`).join("\n")}\n` : null
    const { data, error } = await sb.from("reports").insert({ user_id: user.id, company_name: title, summary: md, marketing: m }).select("id").single()
    if (error || !data) { setBusy(false); setErr(tx.err); return }
    router.push(`/reports/${data.id}?tab=marketing`)
  }

  function fromText(text: string, source: "csv" | "paste") {
    const r = parseTable(text)
    if (r.error) { setErr(tx.bad); return }
    const base = emptyMarketing(channel, r.currency ?? "$")
    create(applyParsed(base, r, source))
  }

  async function fromSheet(url: string, p: ParsedSheet) {
    const base = emptyMarketing(channel, p.currency ?? "$")
    await create({ ...applyParsed(base, p, "sheet"), sheet: { url, syncedAt: new Date().toISOString() } })
  }

  async function readFile(f: File | undefined) {
    if (!f) return
    if (f.size > 5 * 1024 * 1024) { setErr("5 MB max"); return }
    fromText(await f.text(), "csv")
  }

  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const el = e.target as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return
      const text = e.clipboardData?.getData("text/plain") ?? ""
      if (text.includes("\n") && /[\t,;]/.test(text)) { e.preventDefault(); fromText(text, "paste") }
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("paste", onPaste)
    window.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("paste", onPaste); window.removeEventListener("keydown", onKey) }
  }) // re-bind each render so the latest name / channel are used

  if (!mounted) return null
  const cc = CH.find(c => c.key === channel)!.color
  return createPortal(
    <div className="mqs-back" onClick={onClose}>
      <style>{CSS}</style>
      <div className="mqs" onClick={e => e.stopPropagation()} style={{ ["--cc" as string]: cc } as React.CSSProperties} role="dialog" aria-modal="true">
        <span className="mqs-glow" aria-hidden />
        <button className="mqs-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
        <div className="mqs-h"><span className="mqs-ic"><TrendingUp size={18} /></span><div><b>{tx.title}</b><small>{tx.sub}</small></div></div>

        <label className="mqs-f"><span>{tx.name}</span>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={tx.namePh(date)} maxLength={120} />
        </label>
        <div className="mqs-f"><span>{tx.channel}</span>
          <div className="mqs-chips">
            {CH.map(c => <button key={c.key} className={channel === c.key ? "on" : ""} style={{ ["--c" as string]: c.color } as React.CSSProperties} onClick={() => setChannel(c.key)}>{c.label}</button>)}
          </div>
        </div>

        <div className={`mqs-drop${drag ? " drag" : ""}`}
          onDragOver={e => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); readFile(e.dataTransfer.files?.[0]) }}>
          {busy ? (
            <div className="mqs-busy"><Loader2 size={22} className="mqs-spin" /> {tx.busy}</div>
          ) : (
            <>
              <span className="mqs-file"><FileSpreadsheet size={24} /></span>
              <b>{tx.drop}</b>
              <button className="mqs-btn pri" onClick={() => fileRef.current?.click()}><Upload size={14} /> {tx.choose}</button>
              <small><ClipboardPaste size={12} /> {tx.paste}</small>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,text/csv" hidden onChange={e => { readFile(e.target.files?.[0]); e.target.value = "" }} />
        </div>
        {!busy && <SheetInput lang={lang} onParsed={fromSheet} compact />}
        {err && <div className="mqs-err">{err}</div>}
        <button className="mqs-btn manual" disabled={busy} onClick={() => create(emptyMarketing(channel, "$"))}><PencilLine size={14} /> {tx.manual}</button>
      </div>
    </div>,
    document.body,
  )
}

const BTN_CSS = `
.mqb { display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px 8px 8px; border-radius: 10px; cursor: pointer; font-size: 13px; font-weight: 600; color: #F0EDF8;
  background: linear-gradient(120deg, rgba(34,197,94,.14), rgba(245,177,59,.10)); border: .5px solid rgba(34,197,94,.45); transition: transform .15s, box-shadow .15s; }
.mqb:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,0,0,.4), 0 0 20px rgba(34,197,94,.25); }
.mqb-ic { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; color: #fff; background: linear-gradient(140deg, #22C55E, #0E7A3B); box-shadow: 0 0 12px rgba(34,197,94,.5); }
`
const CSS = `
.mqs-back { position: fixed; inset: 0; z-index: 9500; display: grid; place-items: center; padding: 16px; background: rgba(4,4,10,.78); backdrop-filter: blur(6px); }
.mqs { position: relative; overflow: hidden; width: 560px; max-width: 100%; max-height: calc(100vh - 32px); overflow-y: auto; display: flex; flex-direction: column; gap: 14px; padding: 22px; border-radius: 20px; box-sizing: border-box;
  background: linear-gradient(160deg, #16141F, #0D0C16); border: .5px solid color-mix(in srgb, var(--cc) 50%, transparent); color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif;
  box-shadow: 0 30px 90px rgba(0,0,0,.75), 0 0 50px color-mix(in srgb, var(--cc) 16%, transparent); animation: mqsIn .3s cubic-bezier(.2,1.1,.3,1); transition: border-color .3s, box-shadow .3s; }
@keyframes mqsIn { from { opacity: 0; transform: translateY(12px) scale(.97); } }
.mqs-glow { position: absolute; top: -180px; right: -140px; width: 420px; height: 420px; border-radius: 50%; pointer-events: none; background: radial-gradient(closest-side, var(--cc), transparent 72%); opacity: .18; transition: background .3s; }
.mqs-x { position: absolute; top: 14px; right: 14px; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; cursor: pointer; color: #A8A4BC; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.12); z-index: 1; }
.mqs-h { position: relative; display: flex; gap: 12px; align-items: flex-start; padding-right: 36px; }
.mqs-ic { width: 40px; height: 40px; border-radius: 12px; flex: none; display: grid; place-items: center; color: #fff; background: linear-gradient(140deg, #22C55E, #0E7A3B); box-shadow: 0 0 20px rgba(34,197,94,.45); }
.mqs-h b { display: block; font-size: 18px; } .mqs-h small { display: block; font-size: 12.5px; color: #8A8AAA; line-height: 1.5; margin-top: 3px; }
.mqs-f { position: relative; display: flex; flex-direction: column; gap: 6px; }
.mqs-f > span { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #8A8AAA; }
.mqs-f input { width: 100%; box-sizing: border-box; padding: 10px 12px; border-radius: 10px; font: 14px system-ui, sans-serif; color: #F0EDF8; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.13); outline: none; }
.mqs-f input:focus { border-color: var(--cc); }
.mqs-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.mqs-chips button { padding: 7px 11px; border-radius: 9px; cursor: pointer; font-size: 12.5px; color: #C8C4D8; background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.12); }
.mqs-chips button.on { color: #fff; background: color-mix(in srgb, var(--c) 28%, transparent); border-color: var(--c); }
.mqs-drop { position: relative; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 26px 16px; border-radius: 16px; min-height: 170px; justify-content: center; box-sizing: border-box;
  background: rgba(255,255,255,.02); border: 1.5px dashed color-mix(in srgb, var(--cc) 45%, rgba(255,255,255,.16)); transition: all .2s; }
.mqs-drop.drag { background: color-mix(in srgb, var(--cc) 10%, transparent); border-color: var(--cc); }
.mqs-file { width: 52px; height: 52px; border-radius: 15px; display: grid; place-items: center; color: #fff; background: linear-gradient(140deg, var(--cc), color-mix(in srgb, var(--cc) 40%, #000)); box-shadow: 0 0 24px color-mix(in srgb, var(--cc) 50%, transparent); }
.mqs-drop b { font-size: 15.5px; } .mqs-drop small { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #8A8AAA; }
.mqs-busy { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #C8C4D8; }
.mqs-spin { animation: mqsSpin .8s linear infinite; } @keyframes mqsSpin { to { transform: rotate(360deg); } }
.mqs-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 10px 16px; border-radius: 10px; cursor: pointer; font: 600 13px 'Space Grotesk', system-ui, sans-serif;
  color: #E8E4F4; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.14); }
.mqs-btn.pri { color: #fff; background: #E8002A; border-color: #E8002A; box-shadow: 0 0 20px rgba(232,0,42,.35); }
.mqs-btn.manual { width: 100%; background: transparent; color: #C8C4D8; }
.mqs-btn:hover:not(:disabled) { filter: brightness(1.15); }
.mqs-btn:disabled { opacity: .5; }
.mqs-err { padding: 10px 12px; border-radius: 10px; font-size: 13px; color: #FF8A9C; background: rgba(232,0,42,.08); border: .5px solid rgba(232,0,42,.3); }
`
