"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  FileText, Plus, Search, X, Clock, BarChart3, ArrowUpRight, Loader2, Globe, Trash2,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

type Report = {
  id: string
  user_id: string
  company_name: string
  summary: string | null
  chart_data: unknown
  created_at: string
  is_public?: boolean | null
}

// true when the agent has written real chart numbers into chart_data
function hasCharts(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false
  const r = raw as Record<string, unknown>
  return Array.isArray(r.stats) && Array.isArray(r.trend) && Array.isArray(r.trendLabels)
}

function readingMinutes(s: string) {
  const w = s.trim() ? s.trim().split(/\s+/).length : 0
  return Math.max(1, Math.round(w / 200))
}

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  s2:   "#16162A",
  b1:   "rgba(255,255,255,0.10)",
  b2:   "rgba(255,255,255,0.16)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
}

function ago(iso: string, lang: Language): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return lang === "uk" ? "щойно" : "just now"
  if (m < 60) return `${m} ${lang === "uk" ? "хв тому" : "min ago"}`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} ${lang === "uk" ? "год тому" : "h ago"}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return lang === "uk" ? "вчора" : "yesterday"
  if (dy < 7)  return `${dy}${lang === "uk" ? " дн тому" : "d ago"}`
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })
}

// Plain-text preview for cards: drop markdown symbols, separators and empty lines.
function preview(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map(l => l.replace(/^#+\s*|^[-*•]\s+|^>\s*/g, "").replace(/[*_`]/g, "").trim())
    .filter(l => !/^(Дата|Date|Джерела|Sources)\s*:/i.test(l))
    .filter(l => l && !/^[-—─_=]{3,}$/.test(l))
    .join(" · ")
}

// ─── Compact report card (click → /reports/[id]) ─────────────────

function ReportCard({ r, onOpen, onDelete, lang, index }: { r: Report; onOpen: () => void; onDelete: () => void; lang: Language; index: number }) {
  const uk = lang === "uk"
  const text = r.summary ?? ""
  const charts = hasCharts(r.chart_data)
  return (
    <div className="rc-wrap">
    <button onClick={onOpen} className="mem-card" style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <FileText size={14} style={{ color: T.red, opacity: 0.9 }} />
        </div>
        <div className="mem-title">{r.company_name}</div>
        <ArrowUpRight size={15} className="mem-arrow" />
      </div>

      <div className="mem-preview">
        {text ? preview(text) : <span style={{ color: T.t4 }}>{uk ? "Тексту ще немає" : "No text yet"}</span>}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 14, flexWrap: "wrap" }}>
        {charts
          ? <span className="mem-chip mem-chip-green"><BarChart3 size={9} /> {uk ? "є графіки" : "charts"}</span>
          : <span className="mem-chip">{uk ? "лише текст" : "text only"}</span>}
        {r.is_public && <span className="mem-chip mem-chip-green"><Globe size={9} /> {uk ? "публічний" : "public"}</span>}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4 }}>
          {text && <span>{readingMinutes(text)} {uk ? "хв читання" : "min read"}</span>}
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{ago(r.created_at, lang)}</span>
        </span>
      </div>
    </button>
    <button className="rc-del" onClick={onDelete} title={uk ? "Видалити звіт" : "Delete report"} aria-label={uk ? "Видалити звіт" : "Delete report"}>
      <Trash2 size={13} />
    </button>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd, uk }: { onAdd: () => void; uk: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center", width: "100%" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <FileText size={28} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{uk ? "Звітів поки немає" : "No reports yet"}</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 380, marginBottom: 28 }}>
        {uk ? "Створи перший звіт вручну або попроси агента зробити ресерч і зберегти звіт сюди." : "Create your first report manually, or ask an agent to research something and save a report here."}
      </div>
      <button onClick={onAdd} className="mem-primary"><Plus size={14} /> {uk ? "Новий звіт" : "New report"}</button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ReportsPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const uk = language === "uk"
  const [reports, setReports] = useState<Report[]>([])
  const [loaded,  setLoaded]  = useState(false)
  const [search,  setSearch]  = useState("")
  const [onlyCharts, setOnlyCharts] = useState(false)

  // "new report" dialog
  const [showNew,  setShowNew]  = useState(false)
  const [newName,  setNewName]  = useState("")
  const [creating, setCreating] = useState(false)
  const [newError, setNewError] = useState("")

  useEffect(() => {
    (async () => {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setLoaded(true); return }
      const { data } = await sb.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false })
      setReports((data as Report[]) ?? [])
      setLoaded(true)
    })()
  }, [])

  async function createReport() {
    if (!newName.trim()) { setNewError(uk ? "Вкажи назву звіту." : "Add a report name."); return }
    setCreating(true); setNewError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setCreating(false); setNewError(uk ? "Потрібно увійти в акаунт." : "Please sign in."); return }
    const { data, error } = await sb.from("reports").insert({ user_id: user.id, company_name: newName.trim(), summary: null }).select("id").single()
    setCreating(false)
    if (error || !data?.id) { setNewError(error?.message ?? (uk ? "Не вдалося створити звіт." : "Couldn't create the report.")); return }
    router.push(`/reports/${data.id}`)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return reports.filter(r =>
      (!q || r.company_name.toLowerCase().includes(q) || (r.summary ?? "").toLowerCase().includes(q)) &&
      (!onlyCharts || hasCharts(r.chart_data)))
  }, [reports, search, onlyCharts])

  async function deleteReport(r: Report) {
    if (!window.confirm(uk ? `Видалити звіт «${r.company_name}»? Це не можна скасувати.` : `Delete report "${r.company_name}"? This can't be undone.`)) return
    const { error } = await getSupabase().from("reports").delete().eq("id", r.id)
    if (error) { window.alert(error.message); return }
    setReports(prev => prev.filter(x => x.id !== r.id))
  }

  const withCharts = reports.filter(r => hasCharts(r.chart_data)).length
  const openNew = () => { setNewName(""); setNewError(""); setShowNew(true) }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes memIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        .mem-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
        .mem-card {
          position: relative; display: flex; flex-direction: column; text-align: left; cursor: pointer;
          min-height: 172px; padding: 16px 16px 14px; border-radius: 14px; font-family: inherit;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          color: ${T.t2}; overflow: hidden; animation: memIn .45s cubic-bezier(.2,.8,.2,1) both;
          transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s;
        }
        .mem-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px;
          background: linear-gradient(180deg, transparent, rgba(232,0,42,.65), transparent); opacity: .6; transition: opacity .2s; }
        .mem-card:hover { transform: translateY(-3px); border-color: rgba(232,0,42,.35);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(232,0,42,.08); }
        .mem-card:hover::before { opacity: 1; }
        .mem-card:focus-visible { outline: 2px solid ${T.red}; outline-offset: 2px; }
        .mem-title { flex: 1; min-width: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: ${T.t1};
          line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mem-arrow { flex-shrink: 0; color: ${T.t4}; opacity: 0; transform: translate(-4px, 4px); transition: all .2s; }
        .mem-card:hover .mem-arrow { opacity: 1; transform: none; color: ${T.red}; }
        .mem-preview { margin-top: 10px; font-size: 12.5px; line-height: 1.6; color: ${T.t3};
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .mem-chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          padding: 2px 7px; border-radius: 5px; text-transform: uppercase; letter-spacing: .06em;
          color: ${T.t3}; background: rgba(255,255,255,.04); border: 0.5px solid ${T.b1}; }
        .mem-chip-red { color: ${T.red}; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.18); }
        .mem-chip-green { color: #22C55E; background: rgba(34,197,94,.08); border-color: rgba(34,197,94,.25); }

        .rc-wrap { position: relative; display: flex; }
        .rc-wrap > .mem-card { flex: 1; }
        .rc-del { position: absolute; top: 12px; right: 12px; width: 28px; height: 28px; padding: 0; border-radius: 8px; z-index: 2;
          display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${T.t4};
          background: rgba(8,8,15,.85); border: 0.5px solid rgba(255,255,255,.1); opacity: 0; transition: opacity .15s, color .15s, border-color .15s; }
        .rc-wrap:hover .rc-del, .rc-del:focus-visible { opacity: 1; }
        .rc-del:hover { color: #FF4D6A; border-color: rgba(232,0,42,.45); }
        @media (hover: none) { .rc-del { opacity: 1; } }
        .rc-wrap .mem-arrow { margin-right: 30px; }
        .mem-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 172px;
          border-radius: 14px; border: 1px dashed rgba(232,0,42,.3); background: rgba(232,0,42,.03); color: ${T.t3};
          cursor: pointer; font-family: inherit; font-size: 13px; transition: background .2s, border-color .2s, color .2s; }
        .mem-new:hover { background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.55); color: ${T.t1}; }
        .mem-new span { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: rgba(232,0,42,.12); color: ${T.red}; }

        .mem-primary { display: flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s, box-shadow .13s, transform .13s; }
        .mem-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .vt-tag { font-size: 11px; padding: 5px 11px; border-radius: 7px; cursor: pointer; font-family: inherit;
          background: rgba(255,255,255,.05); color: ${T.t3}; border: 0.5px solid transparent; transition: background .13s, color .13s; }
        .vt-tag:hover { color: ${T.t1}; }
        .vt-tag.on { background: rgba(232,0,42,.18); color: ${T.t1}; border-color: rgba(232,0,42,.3); }
        .rn-modal { width: 100%; max-width: 460px; border-radius: 20px; padding: 22px;
          background: linear-gradient(160deg, rgba(30,24,50,0.9), rgba(12,12,24,0.95)); border: 0.5px solid rgba(232,0,42,.3);
          box-shadow: 0 30px 80px rgba(0,0,0,.6), 0 0 50px rgba(232,0,42,.1); animation: memIn .35s cubic-bezier(.2,1.2,.3,1) both; }
        .rn-input { width: 100%; font-size: 14px; font-family: inherit; color: ${T.t1}; background: rgba(8,8,16,.7); border: 1px solid rgba(255,255,255,.1);
          border-radius: 12px; padding: 12px 14px; outline: none; transition: border-color .2s, box-shadow .2s; }
        .rn-input:focus { border-color: rgba(255,90,116,.6); box-shadow: 0 0 0 4px rgba(232,0,42,.1); }
        @media (prefers-reduced-motion: reduce) { .mem-card { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.09)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px", marginBottom: 14 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Agent Reports</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{uk ? "Звіти" : "Reports"}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{uk ? "Ресерчі й аналітика, які зробили твої агенти" : "Research and analytics produced by your agents"}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button onClick={openNew} className="mem-primary"><Plus size={14} /> {uk ? "Новий звіт" : "New report"}</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {!loaded ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60, color: T.t3 }}><Loader2 size={22} className="animate-spin" /></div>
        ) : reports.length === 0 ? (
          <EmptyState onAdd={openNew} uk={uk} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1400 }}>
            {/* stats + search in one row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { label: uk ? "звітів" : "reports",            value: reports.length, icon: FileText },
                { label: uk ? "з графіками" : "with charts",   value: withCharts,     icon: BarChart3 },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", borderRadius: 9, background: T.s1, border: `0.5px solid ${T.b1}` }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}

              <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 10, background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 10, padding: "0 14px", height: 38 }}>
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={uk ? "Пошук у звітах…" : "Search reports…"}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={13} /></button>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
              <button onClick={() => setOnlyCharts(false)} className={`vt-tag${!onlyCharts ? " on" : ""}`}>{uk ? "Усі" : "All"}</button>
              <button onClick={() => setOnlyCharts(true)} className={`vt-tag${onlyCharts ? " on" : ""}`}>{uk ? "З графіками" : "With charts"}</button>
            </div>

            {(search || onlyCharts) && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {uk ? `Знайдено ${filtered.length} з ${reports.length}` : `Found ${filtered.length} of ${reports.length}`}
                <button onClick={() => { setSearch(""); setOnlyCharts(false) }} style={{ marginLeft: 10, fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer" }}>{uk ? "Очистити" : "Clear"}</button>
              </div>
            )}

            {filtered.length === 0 && (search || onlyCharts) ? (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: T.t4 }}>{uk ? "Нічого не знайдено" : "Nothing found"}</div>
            ) : (
              <div className="mem-grid">
                {!search && !onlyCharts && (
                  <button className="mem-new" onClick={openNew}>
                    <span><Plus size={17} /></span>
                    {uk ? "Новий звіт" : "New report"}
                  </button>
                )}
                {filtered.map((r, i) => (
                  <ReportCard key={r.id} r={r} index={i} lang={language} onOpen={() => router.push(`/reports/${r.id}`)} onDelete={() => deleteReport(r)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showNew && (
        <div onMouseDown={e => { if (e.target === e.currentTarget) setShowNew(false) }}
          style={{ position: "fixed", inset: 0, zIndex: 100, display: "grid", placeItems: "center", padding: 16,
            background: "rgba(5,5,10,0.6)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" }}>
          <form className="rn-modal" onSubmit={e => { e.preventDefault(); createReport() }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, display: "grid", placeItems: "center", background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.3)" }}>
                <FileText size={17} style={{ color: T.red }} />
              </div>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 700, color: T.t1 }}>{uk ? "Новий звіт" : "New report"}</div>
                <div style={{ fontSize: 12, color: T.t4 }}>{uk ? "Текст додаси на сторінці звіту" : "You'll add the text on the report page"}</div>
              </div>
              <button type="button" onClick={() => setShowNew(false)} aria-label={uk ? "Закрити" : "Close"}
                style={{ marginLeft: "auto", width: 32, height: 32, borderRadius: 9, border: "none", background: "rgba(255,255,255,0.05)", color: T.t3, cursor: "pointer", display: "grid", placeItems: "center" }}>
                <X size={15} />
              </button>
            </div>
            <label htmlFor="rn-name" style={{ display: "block", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: T.t3, marginBottom: 8 }}>
              {uk ? "Назва звіту" : "Report name"}
            </label>
            <input id="rn-name" autoFocus value={newName} onChange={e => { setNewName(e.target.value); setNewError("") }}
              placeholder={uk ? "Напр. «Ринок AI-агентів у Чехії»" : "e.g. “AI agent market in Czechia”"} className="rn-input" />
            {newError && <div style={{ marginTop: 10, fontSize: 12.5, color: "#FF4D6A" }}>{newError}</div>}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 20 }}>
              <button type="button" onClick={() => setShowNew(false)} style={{ background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t2, borderRadius: 10, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>
                {uk ? "Скасувати" : "Cancel"}
              </button>
              <button type="submit" disabled={creating} className="mem-primary" style={{ opacity: creating ? 0.6 : 1 }}>
                {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />} {uk ? "Створити" : "Create"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  )
}