"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Building2, FileText, TrendingUp, TrendingDown, Loader2, Sparkles, CalendarDays,
  Pencil, Check, X, Plus,
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
}

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.10)",
  b2:    "rgba(255,255,255,0.16)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  t4:    "#585878",
  red:   "#E8002A",
  teal:  "#0D9488",
  violet:"#8B5CF6",
  amber: "#D97706",
}

// fixed categorical order — never cycled/reassigned per filter
const CATS = [T.red, T.teal, T.violet, T.amber]

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

// ---------------------------------------------------------------------------
// Demo data — used ONLY as a placeholder until an agent (or manual edit)
// fills report.chart_data with real numbers. Seeded so it stays stable
// across reloads instead of reshuffling every render.
//
// Expected shape of report.chart_data once an agent writes it:
// {
//   stats:       [{ label, value, delta?, up? }, ...]   (exactly 4 tiles)
//   trendLabels: ["Mon", "Tue", ...]
//   trend:       [{ name, color?, values: number[] }, ...]
//   breakdown:   [{ label, value, color? }, ...]
//   bars:        [{ label, value }, ...]
// }
// ---------------------------------------------------------------------------

type BreakdownItem = { label: string; value: number; color: string }

type ChartData = {
  stats: { label: string; value: string; delta?: string; up?: boolean }[]
  trendLabels: string[]
  trend: { name: string; color: string; values: number[] }[]
  breakdown: BreakdownItem[]
  bars: { label: string; value: number }[]
}

type Period = "week" | "month" | "quarter" | "half" | "year"
const PERIOD_POINTS: Record<Period, number> = { week: 7, month: 30, quarter: 13, half: 26, year: 12 }

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed
  return function rnd() {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function dayLabels(lang: Language): string[] {
  return lang === "uk"
    ? ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
}

function buildPeriodLabels(period: Period, n: number, lang: Language): string[] {
  if (period === "week") return dayLabels(lang)
  if (period === "year") {
    return lang === "uk"
      ? ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"]
      : ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  }
  if (period === "month") return Array.from({ length: n }, (_, i) => String(i + 1))
  return Array.from({ length: n }, (_, i) => `${lang === "uk" ? "Тиж" : "W"}${i + 1}`)
}

function buildDemo(seed: string, lang: Language): ChartData {
  const rnd = mulberry32(hashStr(seed))
  const days = dayLabels(lang)
  const base = 40 + rnd() * 40
  const values  = days.map((_, i) => Math.max(5, Math.round(base       + Math.sin(i * 1.3 + rnd() * 6) * 18 + rnd() * 10)))

  const score    = Math.round(60 + rnd() * 35)
  const mentions = Math.round(200 + rnd() * 900)
  const growth   = Math.round((rnd() - 0.35) * 40)
  const alerts   = Math.round(rnd() * 6)

  return {
    stats: [
      { label: lang === "uk" ? "Оцінка" : "Score",       value: `${score}/100`, delta: `${growth >= 0 ? "+" : ""}${growth}%`, up: growth >= 0 },
      { label: lang === "uk" ? "Згадування" : "Mentions", value: mentions.toLocaleString(lang === "uk" ? "uk-UA" : "en-US"), delta: `${rnd() > 0.5 ? "+" : "-"}${Math.round(rnd() * 20)}%`, up: rnd() > 0.5 },
      { label: lang === "uk" ? "Динаміка" : "Trend",      value: `${growth >= 0 ? "+" : ""}${growth}%`, delta: lang === "uk" ? "за тиждень" : "this week", up: growth >= 0 },
      { label: lang === "uk" ? "Сповіщення" : "Alerts",   value: String(alerts), delta: alerts === 0 ? (lang === "uk" ? "усе чисто" : "all clear") : (lang === "uk" ? "потребує уваги" : "needs review"), up: alerts === 0 },
    ],
    trendLabels: days,
    trend: [
      { name: lang === "uk" ? "Активність" : "Activity", color: T.red,  values },
      { name: lang === "uk" ? "Охоплення" : "Reach",     color: T.teal, values: days.map((_, i) => Math.max(3, Math.round(base * 0.5 + Math.cos(i * 1.1 + rnd() * 6) * 12 + rnd() * 8))) },
    ],
    breakdown: [
      { label: lang === "uk" ? "Позитив" : "Positive",    value: Math.round(30 + rnd() * 40), color: T.teal },
      { label: lang === "uk" ? "Нейтрально" : "Neutral",  value: Math.round(15 + rnd() * 25), color: T.violet },
      { label: lang === "uk" ? "Негатив" : "Negative",    value: Math.round(5 + rnd() * 15),  color: T.red },
    ],
    bars: days.map((d, i) => ({ label: d, value: values[i] })),
  }
}

// trend line data for a chosen time range (demo only)
function buildTrendForPeriod(seed: string, period: Period, lang: Language): { labels: string[]; trend: { name: string; color: string; values: number[] }[] } {
  const rnd = mulberry32(hashStr(`${seed}|${period}`))
  const n = PERIOD_POINTS[period]
  const base = 40 + rnd() * 40
  const values  = Array.from({ length: n }, (_, i) => Math.max(5, Math.round(base       + Math.sin(i * 0.8 + rnd() * 6) * 18 + rnd() * 10)))
  const values2 = Array.from({ length: n }, (_, i) => Math.max(3, Math.round(base * 0.5 + Math.cos(i * 0.6 + rnd() * 6) * 12 + rnd() * 8)))
  return {
    labels: buildPeriodLabels(period, n, lang),
    trend: [
      { name: lang === "uk" ? "Активність" : "Activity", color: T.red,  values },
      { name: lang === "uk" ? "Охоплення" : "Reach",     color: T.teal, values: values2 },
    ],
  }
}

// bars for a specific chosen date (demo only) — lets the calendar picker
// show a different-looking week without touching the rest of the report
function buildBarsForDate(seed: string, dateISO: string, lang: Language): { label: string; value: number }[] {
  const rnd = mulberry32(hashStr(`${seed}|${dateISO}`))
  const days = dayLabels(lang)
  const base = 30 + rnd() * 50
  return days.map((d, i) => ({
    label: d,
    value: Math.max(4, Math.round(base + Math.sin(i * 1.4 + rnd() * 6) * 16 + rnd() * 12)),
  }))
}

function toChartData(raw: unknown, seed: string, lang: Language): { data: ChartData; demo: boolean } {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>
    if (Array.isArray(r.stats) && Array.isArray(r.trend) && Array.isArray(r.trendLabels)) {
      const trend = (r.trend as Array<Record<string, unknown>>).map((s, i) => ({
        name: String(s.name ?? ""),
        color: typeof s.color === "string" ? s.color : CATS[i % CATS.length],
        values: Array.isArray(s.values) ? (s.values as number[]) : [],
      }))
      const breakdown = Array.isArray(r.breakdown)
        ? (r.breakdown as Array<Record<string, unknown>>).map((b, i) => ({
            label: String(b.label ?? ""),
            value: Number(b.value ?? 0),
            color: typeof b.color === "string" ? b.color : CATS[i % CATS.length],
          }))
        : []
      const bars = Array.isArray(r.bars)
        ? (r.bars as Array<Record<string, unknown>>).map((b) => ({ label: String(b.label ?? ""), value: Number(b.value ?? 0) }))
        : []
      return {
        demo: false,
        data: {
          stats: r.stats as ChartData["stats"],
          trendLabels: r.trendLabels as string[],
          trend,
          breakdown,
          bars,
        },
      }
    }
  }
  return { demo: true, data: buildDemo(seed, lang) }
}

// ---------------------------------------------------------------------------
// A small round color swatch that doubles as a native color picker.
// ---------------------------------------------------------------------------

function ColorPick({ value, onChange, size = 12 }: { value: string; onChange: (c: string) => void; size?: number }) {
  return (
    <input
      type="color"
      className="astrocore-color-dot"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      title="Змінити колір"
      style={{ width: size, height: size, flexShrink: 0 }}
    />
  )
}

const textInput: React.CSSProperties = {
  background: "transparent", border: "none", outline: "none",
  color: T.t2, fontSize: 13, fontFamily: "inherit", flex: 1, minWidth: 0, padding: 0,
}

const ghostBtn: React.CSSProperties = {
  background: "transparent", border: "none", color: T.t4, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center", padding: 2,
}

// ---------------------------------------------------------------------------
// Chart primitives — plain inline SVG, no charting library.
// ---------------------------------------------------------------------------

function TrendChart({
  series, labels, onColorChange,
}: {
  series: { name: string; color: string; values: number[] }[]
  labels: string[]
  onColorChange?: (name: string, color: string) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 700, H = 260, padL = 8, padR = 8, padT = 10, padB = 26
  const n = labels.length
  const all = series.flatMap((s) => s.values)
  const max = Math.max(...all, 1)
  const min = Math.min(0, ...all)
  const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * (W - padL - padR))
  const y = (v: number) => padT + (1 - (v - min) / (max - min || 1)) * (H - padT - padB)
  const labelStep = Math.max(1, Math.ceil(n / 8))

  function pathFor(values: number[]) {
    return values.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  }
  function areaFor(values: number[]) {
    const line = pathFor(values)
    return `${line} L ${x(n - 1).toFixed(1)} ${y(min).toFixed(1)} L ${x(0).toFixed(1)} ${y(min).toFixed(1)} Z`
  }
  function onMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const px = ((e.clientX - rect.left) / rect.width) * W
    let idx = Math.round(((px - padL) / (W - padL - padR)) * (n - 1))
    idx = Math.max(0, Math.min(n - 1, idx))
    setHover(idx)
  }

  return (
    <div style={{ position: "relative" }}>
      {(series.length > 1 || onColorChange) && (
        <div style={{ display: "flex", gap: 18, marginBottom: 12, flexWrap: "wrap" }}>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.t3 }}>
              {onColorChange ? (
                <ColorPick value={s.color} onChange={(c) => onColorChange(s.name, c)} size={11} />
              ) : (
                <span style={{ width: 8, height: 8, borderRadius: 4, background: s.color, display: "inline-block" }} />
              )}
              {s.name}
            </div>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: 260, overflow: "visible" }}
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s, i) => (
            <linearGradient id={`astrocore-grad-${i}`} key={i} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {[0, 0.5, 1].map((g, i) => (
          <line key={i} x1={padL} x2={W - padR} y1={padT + g * (H - padT - padB)} y2={padT + g * (H - padT - padB)} stroke={T.b1} strokeWidth={1} />
        ))}

        {series.length === 1 && <path d={areaFor(series[0].values)} fill="url(#astrocore-grad-0)" stroke="none" />}

        {series.map((s) => (
          <path key={s.name} d={pathFor(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {labels.map((l, i) => {
          if (i !== n - 1 && i % labelStep !== 0) return null
          return (
            <text key={i} x={x(i)} y={H - 8} fontSize={10} fill={T.t4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
              {l}
            </text>
          )
        })}

        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke={T.b2} strokeWidth={1} />
            {series.map((s) => (
              <circle key={s.name} cx={x(hover)} cy={y(s.values[hover] ?? 0)} r={4} fill={s.color} stroke={T.bg} strokeWidth={2} />
            ))}
          </>
        )}
      </svg>

      {hover !== null && (
        <div style={{
          position: "absolute",
          left: `${(x(hover) / W) * 100}%`,
          top: 0,
          transform: `translateX(${hover < n / 2 ? "8px" : "calc(-100% - 8px)"})`,
          background: T.s2, border: `0.5px solid ${T.b1}`, borderRadius: 8,
          padding: "8px 10px", fontSize: 11, color: T.t2, pointerEvents: "none", whiteSpace: "nowrap",
        }}>
          <div style={{ color: T.t4, marginBottom: 4, fontFamily: "'JetBrains Mono', monospace" }}>{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: s.color, display: "inline-block" }} />
              {s.name}: <b style={{ color: T.t1 }}>{s.values[hover]}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DonutChart({
  data, totalLabel, addLabel, emptyLabel, onColorChange, onLabelChange, onValueChange, onAdd, onRemove,
}: {
  data: BreakdownItem[]
  totalLabel: string
  addLabel: string
  emptyLabel?: string
  onColorChange?: (i: number, color: string) => void
  onLabelChange?: (i: number, label: string) => void
  onValueChange?: (i: number, value: number) => void
  onAdd?: () => void
  onRemove?: (i: number) => void
}) {
  const [hover, setHover] = useState<number | null>(null)
  // if an item gets deleted while it (or a later one) is hovered, the stale
  // index would point past the end of the (now shorter) array — clamp it
  useEffect(() => {
    if (hover !== null && hover >= data.length) setHover(null)
  }, [data.length, hover])
  const activeIdx = hover !== null && hover < data.length ? hover : null
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const r = 74, sw = 26, C = 2 * Math.PI * r
  const gapLen = (2 / 360) * C
  let cum = 0

  if (data.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-start" }}>
        <div style={{ color: T.t4, fontSize: 13 }}>{emptyLabel}</div>
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "transparent",
              border: `0.5px dashed ${T.b1}`, borderRadius: 8, padding: "6px 10px",
              color: T.t3, fontSize: 12, cursor: "pointer",
            }}
          >
            <Plus size={13} /> {addLabel}
          </button>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 28, flexWrap: "wrap" }}>
      <svg width={190} height={190} viewBox="0 0 190 190" style={{ flexShrink: 0 }}>
        <g transform="translate(95,95) rotate(-90)">
          {data.map((d, i) => {
            const segLen = (d.value / total) * C
            const dash = `${Math.max(segLen - gapLen, 0)} ${C}`
            const offset = -((cum / total) * C)
            cum += d.value
            const active = activeIdx === i
            return (
              <circle
                key={i}
                r={r} cx={0} cy={0} fill="none"
                stroke={d.color} strokeWidth={active ? sw + 4 : sw}
                strokeDasharray={dash} strokeDashoffset={offset}
                strokeLinecap="round"
                style={{ transition: "stroke-width 0.15s", cursor: "pointer" }}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            )
          })}
        </g>
        <text x={95} y={90} textAnchor="middle" fontSize={24} fontWeight={700} fill={T.t1} fontFamily="'Space Grotesk', sans-serif">
          {activeIdx !== null ? data[activeIdx].value : total}
        </text>
        <text x={95} y={110} textAnchor="middle" fontSize={11} fill={T.t4}>
          {activeIdx !== null ? data[activeIdx].label : totalLabel}
        </text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 220, flex: 1 }}>
        {data.map((d, i) => (
          <div
            key={i}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: activeIdx === i ? T.t1 : T.t3 }}
          >
            {onColorChange ? (
              <ColorPick value={d.color} onChange={(c) => onColorChange(i, c)} />
            ) : (
              <span style={{ width: 9, height: 9, borderRadius: 5, background: d.color, display: "inline-block", flexShrink: 0 }} />
            )}
            {onLabelChange ? (
              <input value={d.label} onChange={(e) => onLabelChange(i, e.target.value)} style={textInput} />
            ) : (
              <span style={{ flex: 1 }}>{d.label}</span>
            )}
            {onValueChange && (
              <input
                type="number"
                value={d.value}
                onChange={(e) => onValueChange(i, Number(e.target.value))}
                style={{
                  width: 52, background: "#09090F", border: `0.5px solid ${T.b1}`, borderRadius: 6,
                  color: T.t2, fontSize: 12, padding: "3px 6px", textAlign: "right",
                }}
              />
            )}
            <b style={{ color: T.t2, flexShrink: 0, width: 34, textAlign: "right" }}>{Math.round((d.value / total) * 100)}%</b>
            {onRemove && (
              <button onClick={() => onRemove(i)} title="Видалити" style={{ ...ghostBtn, flexShrink: 0 }}>
                <X size={13} />
              </button>
            )}
          </div>
        ))}
        {onAdd && (
          <button
            onClick={onAdd}
            style={{
              display: "flex", alignItems: "center", gap: 6, background: "transparent",
              border: `0.5px dashed ${T.b1}`, borderRadius: 8, padding: "6px 10px",
              color: T.t3, fontSize: 12, cursor: "pointer", alignSelf: "flex-start",
            }}
          >
            <Plus size={13} /> {addLabel}
          </button>
        )}
      </div>
    </div>
  )
}

function BarChart({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(...data.map((d) => d.value), 1)
  const W = 700, H = 220, padB = 26, padT = 18
  const n = Math.max(data.length, 1)
  const bw = (W / n) * 0.5
  const gap = (W / n) * 0.5

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 220, overflow: "visible" }}>
      <line x1={0} x2={W} y1={H - padB} y2={H - padB} stroke={T.b1} strokeWidth={1} />
      {data.map((d, i) => {
        const bh = (d.value / max) * (H - padT - padB)
        const bx = i * (bw + gap) + gap / 2
        const by = H - padB - bh
        const active = hover === i
        return (
          <g key={`${d.label}-${i}`} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} style={{ cursor: "pointer" }}>
            <rect x={bx} y={by} width={bw} height={Math.max(bh, 2)} rx={5} fill={color} opacity={active ? 1 : 0.72} />
            <text x={bx + bw / 2} y={H - padB + 16} fontSize={10} fill={T.t4} textAnchor="middle" fontFamily="'JetBrains Mono', monospace">
              {d.label}
            </text>
            {active && (
              <text x={bx + bw / 2} y={by - 7} fontSize={11} fill={T.t1} textAnchor="middle" fontWeight={700}>
                {d.value}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function StatTile({ label, value, delta, up }: { label: string; value: string; delta?: string; up?: boolean }) {
  return (
    <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 12, color: T.t3, marginBottom: 10 }}>{label}</div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 700, color: T.t1 }}>{value}</div>
      {delta && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 10, fontSize: 12, color: up ? T.teal : T.red }}>
          {up ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {delta}
        </div>
      )}
    </div>
  )
}

// a thin animated "floating" red line, used as a divider under panel titles
function SweepLine() {
  return <div className="astrocore-panel-sweep" style={{ height: 1, background: T.b1, margin: "12px 0 18px" }} />
}

type ReportPrefs = {
  trendColors?: Record<string, string>
  barsColor?: string
  breakdown?: BreakdownItem[]   // once set, this fully replaces the generated/real breakdown
  period?: Period
  barsDate?: string
}

// ---------------------------------------------------------------------------

export default function ReportDetailPage() {
  const params = useParams()
  const id = (params?.id as string) ?? ""
  const router = useRouter()
  const { language } = useLanguage()
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [prefs, setPrefs] = useState<ReportPrefs>({})

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState("")
  const [savingSummary, setSavingSummary] = useState(false)
  const [committing, setCommitting] = useState(false)

  useEffect(() => {
    load()
    if (id) {
      try {
        const raw = localStorage.getItem(`astrocore-report-prefs-${id}`)
        if (raw) {
          const parsed = JSON.parse(raw)
          // older saved data stored breakdown as {0: {...}, 1: {...}} instead
          // of an array — drop it if so, rather than crash on it
          if (parsed && parsed.breakdown && !Array.isArray(parsed.breakdown)) {
            delete parsed.breakdown
          }
          setPrefs(parsed)
        }
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function load() {
    setLoading(true)
    setNotFound(false)
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await sb
      .from("reports")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle()
    if (error || !data) {
      setNotFound(true)
      setLoading(false)
      return
    }
    setReport(data as Report)
    setLoading(false)
  }

  function patchPrefs(patch: Partial<ReportPrefs> | ((p: ReportPrefs) => ReportPrefs)) {
    setPrefs((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch }
      try { localStorage.setItem(`astrocore-report-prefs-${id}`, JSON.stringify(next)) } catch {}
      return next
    })
  }
  const setTrendColor = (name: string, color: string) =>
    patchPrefs((p) => ({ ...p, trendColors: { ...(p.trendColors || {}), [name]: color } }))
  const setBarsColor = (color: string) => patchPrefs({ barsColor: color })
  const setPeriod = (period: Period) => patchPrefs({ period })
  const setBarsDate = (barsDate: string) => patchPrefs({ barsDate })

  // breakdown editing works on a full local copy — once you touch it, it's
  // fully yours (renaming, recoloring, adding or removing categories)
  function currentBreakdown(base: BreakdownItem[]): BreakdownItem[] {
    return Array.isArray(prefs.breakdown) ? prefs.breakdown : base
  }
  function setBreakdownField(base: BreakdownItem[], i: number, field: keyof BreakdownItem, value: string | number) {
    const next = currentBreakdown(base).map((b, idx) => (idx === i ? { ...b, [field]: value } : b))
    patchPrefs({ breakdown: next })
  }
  function addBreakdownItem(base: BreakdownItem[]) {
    const cur = currentBreakdown(base)
    const next = [...cur, {
      label: language === "uk" ? "Нова категорія" : "New category",
      value: 10,
      color: CATS[cur.length % CATS.length],
    }]
    patchPrefs({ breakdown: next })
  }
  function removeBreakdownItem(base: BreakdownItem[], i: number) {
    const next = currentBreakdown(base).filter((_, idx) => idx !== i)
    patchPrefs({ breakdown: next })
  }

  async function saveSummary() {
    if (!report) return
    setSavingSummary(true)
    const sb = getSupabase()
    const value = summaryDraft.trim() || null
    const { error } = await sb.from("reports").update({ summary: value }).eq("id", report.id)
    setSavingSummary(false)
    if (!error) {
      setReport({ ...report, summary: value })
      setEditingSummary(false)
    }
  }

  const tr = {
    back: language === "uk" ? "Усі звіти" : "All reports",
    summary: language === "uk" ? "Текст звіту" : "Report summary",
    breakdown: language === "uk" ? "Розподіл" : "Breakdown",
    activity: language === "uk" ? "Активність за період" : "Activity over time",
    weekly: language === "uk" ? "По днях" : "By day",
    demo: language === "uk" ? "приклад — очікує на дані агента" : "example — waiting on agent data",
    notFound: language === "uk" ? "Звіт не знайдено" : "Report not found",
    total: language === "uk" ? "Всього" : "Total",
    thisWeek: language === "uk" ? "цей тиждень" : "this week",
    addCategory: language === "uk" ? "додати категорію" : "add category",
    emptyBreakdown: language === "uk" ? "Категорій ще немає" : "No categories yet",
    edit: language === "uk" ? "Редагувати" : "Edit",
    save: language === "uk" ? "Зберегти" : "Save",
    cancel: language === "uk" ? "Скасувати" : "Cancel",
    empty: language === "uk" ? "Тексту ще немає — натисни «Редагувати»" : "No text yet — click “Edit”",
    commit: language === "uk" ? "Зробити реальним звітом" : "Make this real",
    committing: language === "uk" ? "Зберігаю…" : "Saving…",
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: "week",    label: language === "uk" ? "Тиждень"  : "Week" },
    { key: "month",   label: language === "uk" ? "Місяць"   : "Month" },
    { key: "quarter", label: language === "uk" ? "3 місяці" : "3 months" },
    { key: "half",    label: language === "uk" ? "Півроку"  : "6 months" },
    { key: "year",    label: language === "uk" ? "Рік"      : "Year" },
  ]

  if (loading) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: T.t3 }} />
      </div>
    )
  }

  if (notFound || !report) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ color: T.t2 }}>{tr.notFound}</div>
        <button
          onClick={() => router.push("/reports")}
          style={{ background: T.s1, border: `0.5px solid ${T.b1}`, color: T.t2, borderRadius: 9, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}
        >
          {tr.back}
        </button>
      </div>
    )
  }

  const { data: cdRaw, demo } = toChartData(report.chart_data, report.company_name, language)

  const period = prefs.period ?? "week"
  const barsDate = prefs.barsDate ?? new Date().toISOString().slice(0, 10)

  const periodData = demo ? buildTrendForPeriod(report.company_name, period, language) : null
  const trendLabels = demo ? periodData!.labels : cdRaw.trendLabels
  const trendSeries = (demo ? periodData!.trend : cdRaw.trend).map((s) => ({
    ...s, color: prefs.trendColors?.[s.name] ?? s.color,
  }))

  const breakdown = currentBreakdown(cdRaw.breakdown)
  const barsColor = prefs.barsColor ?? T.violet
  const bars = demo ? buildBarsForDate(report.company_name, barsDate, language) : cdRaw.bars

  // takes whatever is currently on screen (generated + your edits) and writes
  // it into reports.chart_data as one real, shared record — from that point
  // on this report is no longer "example" data: anyone reading this row from
  // Supabase (including an agent) sees exactly this. Colors and the period /
  // date pickers stay local display preferences and are not part of this.
  async function commitAsReal() {
    if (!report) return
    setCommitting(true)
    const payload: ChartData = {
      stats: cdRaw.stats,
      trendLabels,
      trend: trendSeries.map(({ name, color, values }) => ({ name, color, values })),
      breakdown,
      bars,
    }
    const sb = getSupabase()
    const { error } = await sb.from("reports").update({ chart_data: payload }).eq("id", report.id)
    setCommitting(false)
    if (!error) setReport({ ...report, chart_data: payload })
  }

  return (
    <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes astrocore-sweep {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .astrocore-panel-sweep {
          position: relative;
          overflow: hidden;
        }
        .astrocore-panel-sweep::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, ${T.red}, transparent);
          animation: astrocore-sweep 4.5s ease-in-out infinite;
        }

        .astrocore-color-dot {
          -webkit-appearance: none;
          appearance: none;
          border: none;
          border-radius: 50%;
          padding: 0;
          cursor: pointer;
          background: none;
        }
        .astrocore-color-dot::-webkit-color-swatch-wrapper { padding: 0; border-radius: 50%; }
        .astrocore-color-dot::-webkit-color-swatch { border: none; border-radius: 50%; }
        .astrocore-color-dot::-moz-color-swatch { border: none; border-radius: 50%; }

        input[type="date"] { color-scheme: dark; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }

        input[type="number"]::-webkit-outer-spin-button,
        input[type="number"]::-webkit-inner-spin-button { opacity: 0.5; }
      `}</style>

      <div style={{ padding: "32px 44px 70px", maxWidth: 1600 }}>
        <button
          onClick={() => router.push("/reports")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.t3, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 18 }}
        >
          <ArrowLeft size={15} /> {tr.back}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4, flexWrap: "wrap" }}>
          <div style={{ width: 44, height: 44, borderRadius: 11, background: T.s2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Building2 size={20} style={{ color: T.red }} />
          </div>
          <div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 700, color: T.t1, margin: 0 }}>
              {report.company_name}
            </h1>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4 }}>
              {ago(report.created_at, language)}
            </div>
          </div>
          {demo && (
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: T.t4,
                background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 20, padding: "5px 10px",
              }}>
                <Sparkles size={12} /> {tr.demo}
              </div>
              <button
                onClick={commitAsReal}
                disabled={committing}
                title={language === "uk"
                  ? "Запише те, що зараз на екрані, в базу — назавжди і для всіх (і для агента)"
                  : "Writes what's on screen now into the database — permanently, for everyone (including the agent)"}
                style={{
                  background: T.red, border: "none", color: "#fff", borderRadius: 20,
                  padding: "6px 14px", fontSize: 11, fontWeight: 600, cursor: "pointer",
                  opacity: committing ? 0.6 : 1,
                }}
              >
                {committing ? tr.committing : tr.commit}
              </button>
            </div>
          )}
        </div>

        <SweepLine />

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
          {cdRaw.stats.map((s) => (
            <StatTile key={s.label} label={s.label} value={s.value} delta={s.delta} up={s.up} />
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>
          <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{tr.activity}</div>
              {demo && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PERIODS.map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      style={{
                        background: period === p.key ? T.red : "transparent",
                        border: `0.5px solid ${period === p.key ? T.red : T.b1}`,
                        color: period === p.key ? "#fff" : T.t3,
                        borderRadius: 20, padding: "5px 12px", fontSize: 11,
                        fontWeight: period === p.key ? 600 : 400, cursor: "pointer",
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <SweepLine />
            <TrendChart series={trendSeries} labels={trendLabels} onColorChange={setTrendColor} />
          </div>

          <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24, display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: T.t3, fontSize: 12 }}>
                <FileText size={13} /> {tr.summary}
              </div>
              {!editingSummary && (
                <button
                  onClick={() => { setSummaryDraft(report.summary ?? ""); setEditingSummary(true) }}
                  style={{ ...ghostBtn, gap: 5, fontSize: 11, color: T.t3 }}
                >
                  <Pencil size={12} /> {tr.edit}
                </button>
              )}
            </div>
            <SweepLine />

            {editingSummary ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <textarea
                  value={summaryDraft}
                  onChange={(e) => setSummaryDraft(e.target.value)}
                  autoFocus
                  style={{
                    background: "#09090F", border: `0.5px solid ${T.b1}`, borderRadius: 9,
                    padding: "10px 12px", fontSize: 13, color: T.t1, outline: "none",
                    minHeight: 200, resize: "vertical", fontFamily: "inherit", lineHeight: 1.6,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button
                    onClick={() => setEditingSummary(false)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t3, borderRadius: 8, padding: "7px 12px", fontSize: 12, cursor: "pointer" }}
                  >
                    <X size={13} /> {tr.cancel}
                  </button>
                  <button
                    onClick={saveSummary}
                    disabled={savingSummary}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: T.red, border: "none", color: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: savingSummary ? 0.6 : 1 }}
                  >
                    <Check size={13} /> {savingSummary ? "..." : tr.save}
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => { setSummaryDraft(report.summary ?? ""); setEditingSummary(true) }}
                style={{ color: report.summary ? T.t2 : T.t4, fontSize: 13, lineHeight: 1.6, whiteSpace: "pre-wrap", overflowY: "auto", maxHeight: 280, cursor: "text" }}
              >
                {report.summary || tr.empty}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{tr.breakdown}</div>
            <SweepLine />
            <DonutChart
              data={breakdown}
              totalLabel={tr.total}
              addLabel={tr.addCategory}
              emptyLabel={tr.emptyBreakdown}
              onColorChange={(i, c) => setBreakdownField(cdRaw.breakdown, i, "color", c)}
              onLabelChange={(i, l) => setBreakdownField(cdRaw.breakdown, i, "label", l)}
              onValueChange={(i, v) => setBreakdownField(cdRaw.breakdown, i, "value", v)}
              onAdd={() => addBreakdownItem(cdRaw.breakdown)}
              onRemove={(i) => removeBreakdownItem(cdRaw.breakdown, i)}
            />
          </div>
          <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{tr.weekly}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {demo && (
                  <>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <CalendarDays size={13} style={{ color: T.t4 }} />
                      <input
                        type="date"
                        value={barsDate}
                        onChange={(e) => setBarsDate(e.target.value)}
                        style={{
                          background: "#09090F", border: `0.5px solid ${T.b1}`, borderRadius: 8,
                          padding: "5px 8px", fontSize: 11, color: T.t2, fontFamily: "'JetBrains Mono', monospace",
                        }}
                      />
                    </div>
                    <button
                      onClick={() => setBarsDate(new Date().toISOString().slice(0, 10))}
                      style={{ background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t3, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}
                    >
                      {tr.thisWeek}
                    </button>
                  </>
                )}
                <ColorPick value={barsColor} onChange={setBarsColor} size={13} />
              </div>
            </div>
            <SweepLine />
            <BarChart data={bars} color={barsColor} />
          </div>
        </div>
      </div>
    </div>
  )
}