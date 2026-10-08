"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, FileText, TrendingUp, TrendingDown, Loader2, Sparkles, CalendarDays,
  Pencil, Check, X, Plus, Copy, Printer, Clock, BarChart3, ChevronDown, Trash2,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"
import ShareButton from "@/components/reports/ShareButton"

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
// Report text → readable document
//
// Agents write plain text: "1. РОЗМІР І СТАН ПОПИТУ" headings, "•" bullets,
// "———" separators. normalizeReport() turns that into markdown so it renders
// with real headings, lists and spacing (proper markdown passes through).
// ---------------------------------------------------------------------------

type TocItem = { id: string; text: string }
type KeyFigure = { value: string; label: string; source?: string }

const SEP_RE     = /^\s*[─—–\-_=]{5,}\s*$/
const CAPS_HEAD  = /^\s*(\d+[.)]\s+)?[A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9 ,.&/()«»'’\-–—:]{3,90}$/
const BULLET_RE  = /^\s*[•·▪◦●]\s+/

function isAllCaps(s: string) {
  const letters = s.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ]/g, "")
  return letters.length >= 4 && letters === letters.toUpperCase()
}

function normalizeReport(src: string): string {
  return src.split("\n").map(line => {
    if (SEP_RE.test(line)) return "\n---\n"
    if (CAPS_HEAD.test(line) && isAllCaps(line)) return `\n## ${line.trim()}\n`
    if (BULLET_RE.test(line)) return line.replace(BULLET_RE, "- ")
    // short line ending with ":" → small bold sub-heading
    const t = line.trim()
    if (t.length > 3 && t.length < 90 && t.endsWith(":") && !t.startsWith("-") && !/^Дата:|^Date:/i.test(t)) return `\n**${t}**\n`
    return line
  }).join("\n")
}

function slug(text: string) {
  return "sec-" + text.trim().toLowerCase().replace(/[^a-zа-яіїєґ0-9]+/gi, "-").replace(/^-|-$/g, "").slice(0, 48)
}

function headingText(children: React.ReactNode): string {
  if (typeof children === "string") return children
  if (Array.isArray(children)) return children.map(headingText).join("")
  if (children && typeof children === "object" && "props" in (children as any)) return headingText((children as any).props.children)
  return ""
}

function extractToc(md: string): TocItem[] {
  const out: TocItem[] = []
  md.split("\n").forEach(l => {
    const m = /^##\s+(.+)$/.exec(l.trim())
    if (m) out.push({ id: slug(m[1]), text: m[1].replace(/^\d+[.)]\s*/, "") })
  })
  return out
}

// "Дата: 28.09.2026. Джерела: ČSÚ, Eurostat, ..." → ["ČSÚ", "Eurostat", ...]
function extractSources(src: string): string[] {
  const m = /(?:Джерела|Sources)\s*:\s*([^\n]+)/i.exec(src)
  if (!m) return []
  const parts: string[] = []
  let depth = 0, cur = ""
  for (const ch of m[1].replace(/\.\s*$/, "")) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts.filter(p => p && p.length < 60).slice(0, 12)
}

// Bullets with a percentage → "key figures" cards (taken from the text itself).
function extractFigures(src: string): KeyFigure[] {
  const out: KeyFigure[] = []
  for (const raw of src.split("\n")) {
    if (!BULLET_RE.test(raw) && !/^\s*-\s+/.test(raw)) continue
    const line = raw.replace(BULLET_RE, "").replace(/^\s*-\s+/, "").trim()
    const pm = /(\d+(?:[.,]\d+)?\s?%)/.exec(line)
    if (!pm) continue
    const srcM = /\(([^()]{2,40})\)\s*$/.exec(line)
    let label = line.replace(srcM ? srcM[0] : "", "").trim()
    label = label.replace(/\s+/g, " ")
    if (label.length > 110) label = label.slice(0, 107).trimEnd() + "…"
    out.push({ value: pm[1].replace(/\s/, ""), label, source: srcM?.[1] })
    if (out.length === 4) break
  }
  return out
}

function readingMinutes(src: string) {
  const words = src.trim() ? src.trim().split(/\s+/).length : 0
  return Math.max(1, Math.round(words / 200))
}

// Thin reading-progress bar. Lives in its own component so scrolling only
// re-renders this bar, not the whole report text.
function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    function onScroll() {
      const h = document.documentElement
      const max = h.scrollHeight - h.clientHeight
      setProgress(max > 0 ? Math.min(1, h.scrollTop / max) : 0)
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])
  return (
    <div className="rp-noprint" style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 2, zIndex: 30 }}>
      <div style={{ height: "100%", width: `${progress * 100}%`, background: `linear-gradient(90deg, ${T.red}, #FF5A74)`, boxShadow: "0 0 10px rgba(232,0,42,.6)", transition: "width 80ms linear" }} />
    </div>
  )
}

// Smooth-scroll to a section heading and put it in the URL (#sec-…),
// so a link to the report can point straight at that section.
function goToSection(id: string, text?: string) {
  let el = document.getElementById(id)
  if (!el && text) {
    const want = text.trim().toLowerCase()
    el = Array.from(document.querySelectorAll<HTMLElement>(".rp-h2"))
      .find(h => (h.textContent ?? "").toLowerCase().includes(want)) ?? null
  }
  if (!el) return
  el.scrollIntoView({ behavior: "smooth", block: "start" })
  try { history.replaceState(null, "", `#${id}`) } catch {}
}

// ---------------------------------------------------------------------------

export default function ReportDetailPage() {
  const params = useParams()
  const id = (params?.id as string) ?? ""
  const router = useRouter()
  const { language } = useLanguage()
  const uk = language === "uk"
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [prefs, setPrefs] = useState<ReportPrefs>({})

  const [editingSummary, setEditingSummary] = useState(false)
  const [summaryDraft, setSummaryDraft] = useState("")
  const [savingSummary, setSavingSummary] = useState(false)
  const [committing, setCommitting] = useState(false)

  const [showDemo, setShowDemo]   = useState(false)
  const [tab, setTab]             = useState<"report" | "analytics">("report")
  const [activeSec, setActiveSec] = useState<string>("")
  const [flash, setFlash]         = useState("")

  useEffect(() => {
    load()
    if (id) {
      try {
        const raw = localStorage.getItem(`astrocore-report-prefs-${id}`)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && parsed.breakdown && !Array.isArray(parsed.breakdown)) delete parsed.breakdown
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
    const { data, error } = await sb.from("reports").select("*").eq("id", id).eq("user_id", user.id).maybeSingle()
    if (error || !data) { setNotFound(true); setLoading(false); return }
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

  function currentBreakdown(base: BreakdownItem[]): BreakdownItem[] {
    return Array.isArray(prefs.breakdown) ? prefs.breakdown : base
  }
  function setBreakdownField(base: BreakdownItem[], i: number, field: keyof BreakdownItem, value: string | number) {
    patchPrefs({ breakdown: currentBreakdown(base).map((b, idx) => (idx === i ? { ...b, [field]: value } : b)) })
  }
  function addBreakdownItem(base: BreakdownItem[]) {
    const cur = currentBreakdown(base)
    patchPrefs({ breakdown: [...cur, { label: uk ? "Нова категорія" : "New category", value: 10, color: CATS[cur.length % CATS.length] }] })
  }
  function removeBreakdownItem(base: BreakdownItem[], i: number) {
    patchPrefs({ breakdown: currentBreakdown(base).filter((_, idx) => idx !== i) })
  }

  async function saveSummary() {
    if (!report) return
    setSavingSummary(true)
    const value = summaryDraft.trim() || null
    const { error } = await getSupabase().from("reports").update({ summary: value }).eq("id", report.id)
    setSavingSummary(false)
    if (!error) { setReport({ ...report, summary: value }); setEditingSummary(false) }
  }

  function toast(msg: string) { setFlash(msg); setTimeout(() => setFlash(""), 1800) }
  async function copyText() {
    try { await navigator.clipboard.writeText(report?.summary ?? ""); toast(uk ? "Текст скопійовано" : "Text copied") } catch {}
  }

  // derived report content (hooks must run before early returns)
  const text    = report?.summary ?? ""
  const md      = useMemo(() => normalizeReport(text), [text])
  const toc     = useMemo(() => extractToc(md), [md])
  const sources = useMemo(() => extractSources(text), [text])
  const figures = useMemo(() => extractFigures(text), [text])

  // highlight the section currently on screen in the table of contents
  useEffect(() => {
    if (!toc.length || editingSummary) return
    const els = toc.map(t => document.getElementById(t.id)).filter(Boolean) as HTMLElement[]
    const io = new IntersectionObserver(entries => {
      const vis = entries.filter(e => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (vis[0]) setActiveSec(vis[0].target.id)
    }, { rootMargin: "-10% 0px -70% 0px" })
    els.forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [toc, editingSummary, md, tab])

  // opening a link like /reports/123#sec-2-... jumps to that section
  useEffect(() => {
    if (!text) return
    const h = typeof window !== "undefined" ? window.location.hash.slice(1) : ""
    if (h.startsWith("sec-")) setTimeout(() => goToSection(h), 300)
  }, [text])

  const tr = {
    back: uk ? "Усі звіти" : "All reports",
    breakdown: uk ? "Розподіл" : "Breakdown",
    activity: uk ? "Активність за період" : "Activity over time",
    weekly: uk ? "По днях" : "By day",
    notFound: uk ? "Звіт не знайдено" : "Report not found",
    total: uk ? "Всього" : "Total",
    thisWeek: uk ? "цей тиждень" : "this week",
    addCategory: uk ? "додати категорію" : "add category",
    emptyBreakdown: uk ? "Категорій ще немає" : "No categories yet",
    edit: uk ? "Редагувати" : "Edit",
    save: uk ? "Зберегти" : "Save",
    cancel: uk ? "Скасувати" : "Cancel",
    empty: uk ? "Тексту ще немає — натисни «Редагувати»" : "No text yet — click “Edit”",
    commit: uk ? "Зберегти як реальні дані" : "Save as real data",
    committing: uk ? "Зберігаю…" : "Saving…",
  }

  const PERIODS: { key: Period; label: string }[] = [
    { key: "week",    label: uk ? "Тиждень"  : "Week" },
    { key: "month",   label: uk ? "Місяць"   : "Month" },
    { key: "quarter", label: uk ? "3 місяці" : "3 months" },
    { key: "half",    label: uk ? "Півроку"  : "6 months" },
    { key: "year",    label: uk ? "Рік"      : "Year" },
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
        <button onClick={() => router.push("/reports")}
          style={{ background: T.s1, border: `0.5px solid ${T.b1}`, color: T.t2, borderRadius: 9, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
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
  const trendSeries = (demo ? periodData!.trend : cdRaw.trend).map((s) => ({ ...s, color: prefs.trendColors?.[s.name] ?? s.color }))
  const breakdown = currentBreakdown(cdRaw.breakdown)
  const barsColor = prefs.barsColor ?? T.violet
  const bars = demo ? buildBarsForDate(report.company_name, barsDate, language) : cdRaw.bars
  const showCharts = !demo || showDemo

  async function commitAsReal() {
    if (!report) return
    setCommitting(true)
    const payload: ChartData = {
      stats: cdRaw.stats, trendLabels,
      trend: trendSeries.map(({ name, color, values }) => ({ name, color, values })),
      breakdown, bars,
    }
    const { error } = await getSupabase().from("reports").update({ chart_data: payload }).eq("id", report.id)
    setCommitting(false)
    if (!error) setReport({ ...report, chart_data: payload })
  }

  // markdown components for the article; each h2 gets the same id as its
  // entry in the table of contents (built from the same text), so clicking
  // "Зміст" jumps right to it
  const articleMd: Record<string, (p: any) => React.ReactElement> = {
    h1: ({ children }) => <h2 className="rp-h2">{children}</h2>,
    h2: ({ children }) => {
      const txt = headingText(children)
      const sid = slug(txt)
      const m = /^(\d+)[.)]\s*(.*)$/.exec(txt)
      return (
        <h2 id={sid} className="rp-h2">
          {m && <span className="rp-num">{m[1].padStart(2, "0")}</span>}
          <span>{m ? m[2] : txt}</span>
        </h2>
      )
    },
    h3: ({ children }) => <h3 className="rp-h3">{children}</h3>,
    p:  ({ children }) => <p className="rp-p">{children}</p>,
    ul: ({ children }) => <ul className="rp-ul">{children}</ul>,
    ol: ({ children }) => <ol className="rp-ol">{children}</ol>,
    li: ({ children }) => <li>{children}</li>,
    strong: ({ children }) => <strong className="rp-strong">{children}</strong>,
    hr: () => <hr className="rp-hr" />,
    a:  ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="rp-a">{children}</a>,
    blockquote: ({ children }) => <blockquote className="rp-quote">{children}</blockquote>,
    table: ({ children }) => <div className="rp-table"><table>{children}</table></div>,
    code: ({ children }) => <code className="rp-code">{children}</code>,
  }

  const actionBtn: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 6, background: T.s1, border: `0.5px solid ${T.b1}`,
    color: T.t2, borderRadius: 10, padding: "8px 12px", fontSize: 12, cursor: "pointer",
  }

  return (
    <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes astrocore-sweep { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(100%); opacity: 0; } }
        .astrocore-panel-sweep { position: relative; overflow: hidden; }
        .astrocore-panel-sweep::after { content: ""; position: absolute; top: 0; left: 0; width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, ${T.red}, transparent); animation: astrocore-sweep 4.5s ease-in-out infinite; }
        .astrocore-color-dot { -webkit-appearance: none; appearance: none; border: none; border-radius: 50%; padding: 0; cursor: pointer; background: none; }
        .astrocore-color-dot::-webkit-color-swatch-wrapper { padding: 0; border-radius: 50%; }
        .astrocore-color-dot::-webkit-color-swatch { border: none; border-radius: 50%; }
        .astrocore-color-dot::-moz-color-swatch { border: none; border-radius: 50%; }
        input[type="date"] { color-scheme: dark; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.7); cursor: pointer; }

        @keyframes rp-rise { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .rp-rise { animation: rp-rise .5s cubic-bezier(.2,.8,.2,1) both; }

        .rp-article { font-size: 16px; line-height: 1.75; color: ${T.t2}; max-width: 72ch; }
        .rp-article > *:first-child { margin-top: 0; }
        .rp-h2 { display: flex; align-items: baseline; gap: 14px; font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 700;
          color: ${T.t1}; letter-spacing: -0.02em; margin: 48px 0 16px; scroll-margin-top: 24px; text-wrap: balance; }
        .rp-num { font-family: 'JetBrains Mono', monospace; font-size: 13px; font-weight: 500; color: ${T.red}; letter-spacing: .06em; }
        .rp-h3 { font-size: 17px; font-weight: 600; color: ${T.t1}; margin: 28px 0 10px; }
        .rp-p { margin: 0 0 14px; }
        .rp-strong { color: ${T.t1}; font-weight: 600; }
        .rp-ul, .rp-ol { margin: 6px 0 18px; padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 10px; }
        .rp-ul li { position: relative; padding-left: 22px; }
        .rp-ul li::before { content: ""; position: absolute; left: 4px; top: .72em; width: 6px; height: 6px; border-radius: 50%;
          background: ${T.red}; box-shadow: 0 0 8px rgba(232,0,42,.6); }
        .rp-ol { counter-reset: rp; padding-left: 0; }
        .rp-ol li { counter-increment: rp; position: relative; padding-left: 30px; }
        .rp-ol li::before { content: counter(rp); position: absolute; left: 0; top: .15em; font: 500 11px 'JetBrains Mono', monospace; color: ${T.red};
          width: 20px; height: 20px; border-radius: 6px; background: rgba(232,0,42,.1); display: grid; place-items: center; }
        .rp-hr { border: 0; height: 1px; margin: 36px 0; background: linear-gradient(90deg, rgba(232,0,42,.5), ${T.b1} 40%, transparent); }
        .rp-a { color: #FF7A90; text-decoration: underline; text-underline-offset: 3px; }
        .rp-quote { margin: 18px 0; padding: 14px 18px; border-left: 2px solid ${T.red}; background: rgba(232,0,42,.05); border-radius: 0 10px 10px 0; color: ${T.t2}; }
        .rp-code { font-family: 'JetBrains Mono', monospace; font-size: .88em; background: rgba(255,255,255,.07); padding: 1px 5px; border-radius: 4px; color: #FFB4C4; }
        .rp-table { overflow-x: auto; margin: 18px 0; border: 0.5px solid ${T.b1}; border-radius: 12px; }
        .rp-table table { border-collapse: collapse; width: 100%; font-size: 14px; }
        .rp-table th { text-align: left; color: ${T.t1}; background: rgba(255,255,255,.04); font-weight: 600; }
        .rp-table th, .rp-table td { padding: 10px 14px; border-bottom: 0.5px solid ${T.b1}; font-variant-numeric: tabular-nums; }

        .rp-toc a { display: block; padding: 7px 12px; border-left: 2px solid ${T.b1}; color: ${T.t4}; font-size: 13px; line-height: 1.4;
          text-decoration: none; transition: color .15s, border-color .15s; }
        .rp-toc a:hover { color: ${T.t2}; }
        .rp-toc a.on { color: ${T.t1}; border-left-color: ${T.red}; }

        .rp-fig { background: linear-gradient(160deg, rgba(232,0,42,.07), rgba(17,17,28,1) 55%); border: 0.5px solid ${T.b1}; border-radius: 14px; padding: 18px; }
        .rp-fig b { display: block; font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; color: ${T.t1};
          letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
        .rp-chip { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: ${T.t3}; background: ${T.s1};
          border: 0.5px solid ${T.b1}; border-radius: 999px; padding: 5px 11px; }
        .rp-chip i { width: 5px; height: 5px; border-radius: 50%; background: ${T.teal}; }

        @media (max-width: 1100px) {
          .rp-grid { grid-template-columns: 1fr !important; gap: 12px !important; }
          .rp-toc-col { position: sticky !important; top: 0 !important; z-index: 6; background: ${T.bg}; padding: 10px 0; margin: 0 -4px; }
          .rp-toc-col > div:first-child { display: none; }
          .rp-toc { display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; }
          .rp-toc::-webkit-scrollbar { display: none; }
          .rp-toc a { border: 0.5px solid ${T.b1}; border-radius: 999px; padding: 6px 12px; white-space: nowrap; }
          .rp-toc a.on { border-color: ${T.red}; background: rgba(232,0,42,.1); }
          .rp-h2 { scroll-margin-top: 72px; }
        }
        @media print {
          .rp-noprint { display: none !important; }
          body { background: #fff !important; }
        }
        @media (prefers-reduced-motion: reduce) { .rp-rise { animation: none; } }
      `}</style>

      <ReadingProgress />

      <div style={{ padding: "32px 44px 90px", maxWidth: 1400, margin: "0 auto" }}>
        <button className="rp-noprint" onClick={() => router.push("/reports")}
          style={{ display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: T.t3, fontSize: 13, cursor: "pointer", padding: 0, marginBottom: 22 }}>
          <ArrowLeft size={15} /> {tr.back}
        </button>

        {/* ── Header ── */}
        <header className="rp-rise" style={{ display: "flex", gap: 20, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ flex: 1, minWidth: 280 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4, letterSpacing: ".08em", textTransform: "uppercase" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.red }}><FileText size={12} /> {uk ? "Звіт агента" : "Agent report"}</span>
              <span>·</span><span>{ago(report.created_at, language)}</span>
              {text && <><span>·</span><span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Clock size={11} /> {readingMinutes(text)} {uk ? "хв читання" : "min read"}</span></>}
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 34, lineHeight: 1.15, fontWeight: 700, color: T.t1, margin: 0, letterSpacing: "-0.03em", maxWidth: "26ch", textWrap: "balance" as any }}>
              {report.company_name}
            </h1>
          </div>

          <div className="rp-noprint" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button style={actionBtn} onClick={copyText}><Copy size={13} /> {uk ? "Копіювати" : "Copy"}</button>
            <button style={actionBtn} onClick={() => window.print()}><Printer size={13} /> PDF</button>
            <button style={{ ...actionBtn, background: T.red, border: "none", color: "#fff", fontWeight: 600 }}
              onClick={() => { setSummaryDraft(report.summary ?? ""); setEditingSummary(true); setTab("report") }}>
              <Pencil size={13} /> {tr.edit}
            </button>
            <ShareButton reportId={report.id} title={report.company_name} />
            <button style={{ ...actionBtn, color: "#FF6B85", border: "0.5px solid rgba(232,0,42,0.30)" }} title={uk ? "Видалити звіт" : "Delete report"}
              onClick={async () => {
                if (!window.confirm(uk ? `Видалити звіт «${report.company_name}»? Це не можна скасувати.` : `Delete report "${report.company_name}"? This can't be undone.`)) return
                const { error } = await getSupabase().from("reports").delete().eq("id", report.id)
                if (error) { window.alert(error.message); return }
                router.push("/reports")
              }}>
              <Trash2 size={13} /> {uk ? "Видалити" : "Delete"}
            </button>
          </div>
        </header>

        {sources.length > 0 && (
          <div className="rp-rise" style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", margin: "16px 0 0", animationDelay: ".05s" }}>
            <span style={{ fontSize: 11, color: T.t4, marginRight: 4, fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".08em", textTransform: "uppercase" }}>{uk ? "Джерела" : "Sources"}</span>
            {sources.map(s => <span key={s} className="rp-chip"><i />{s}</span>)}
          </div>
        )}

        {/* ── Tabs: Report / Analytics ── */}
        <div className="rp-noprint" role="tablist" style={{ display: "flex", gap: 4, marginTop: 22, borderBottom: `0.5px solid ${T.b1}` }}>
          {([
            { key: "report",    icon: FileText,  label: uk ? "Звіт" : "Report" },
            { key: "analytics", icon: BarChart3, label: uk ? "Аналітика й графіки" : "Analytics & charts" },
          ] as const).map(t => {
            const on = tab === t.key
            return (
              <button key={t.key} role="tab" aria-selected={on} onClick={() => setTab(t.key)}
                style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer",
                  padding: "10px 14px", marginBottom: -1, fontSize: 14, fontWeight: on ? 600 : 500,
                  color: on ? T.t1 : T.t3, borderBottom: `2px solid ${on ? T.red : "transparent"}`, transition: "color .15s, border-color .15s" }}>
                <t.icon size={15} style={{ color: on ? T.red : T.t4 }} />
                {t.label}
                {t.key === "analytics" && (
                  <span style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", padding: "2px 7px", borderRadius: 20,
                    color: demo ? T.t4 : "#22C55E", background: demo ? "rgba(255,255,255,.05)" : "rgba(34,197,94,.1)",
                    border: `0.5px solid ${demo ? T.b1 : "rgba(34,197,94,.3)"}` }}>
                    {demo ? (uk ? "немає даних" : "no data") : (uk ? "є дані" : "has data")}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        <div style={{ height: 24 }} />

        {tab === "report" && <>
        {/* ── Key figures pulled from the text ── */}
        {figures.length > 0 && !editingSummary && (
          <section className="rp-rise" style={{ marginBottom: 28, animationDelay: ".1s" }}>
            <div style={{ fontSize: 11, color: T.t4, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".08em", textTransform: "uppercase" }}>
              {uk ? "Ключові цифри зі звіту" : "Key figures from the report"}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              {figures.map((f, i) => (
                <div key={i} className="rp-fig">
                  <b>{f.value}</b>
                  <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.5, marginTop: 6 }}>{f.label}</div>
                  {f.source && <div style={{ fontSize: 11, color: T.t4, marginTop: 10, fontFamily: "'JetBrains Mono', monospace" }}>{f.source}</div>}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Document: table of contents + text ── */}
        <div className="rp-grid" style={{ display: "grid", gridTemplateColumns: toc.length && !editingSummary ? "220px 1fr" : "1fr", gap: 40, alignItems: "start" }}>
          {toc.length > 0 && !editingSummary && (
            <nav className="rp-toc-col rp-noprint" style={{ position: "sticky", top: 24 }}>
              <div style={{ fontSize: 11, color: T.t4, marginBottom: 10, fontFamily: "'JetBrains Mono', monospace", letterSpacing: ".08em", textTransform: "uppercase" }}>
                {uk ? "Зміст" : "Contents"}
              </div>
              <div className="rp-toc">
                {toc.map(t => (
                  <a key={t.id} href={`#${t.id}`} className={activeSec === t.id ? "on" : undefined}
                    onClick={e => { e.preventDefault(); setActiveSec(t.id); goToSection(t.id, t.text) }}>
                    {t.text.charAt(0) + t.text.slice(1).toLowerCase()}
                  </a>
                ))}
              </div>
            </nav>
          )}

          <main className="rp-rise" style={{ animationDelay: ".15s", minWidth: 0 }}>
            {editingSummary ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 900 }}>
                <textarea value={summaryDraft} onChange={(e) => setSummaryDraft(e.target.value)} autoFocus
                  style={{ background: "#09090F", border: `0.5px solid ${T.b1}`, borderRadius: 12, padding: "16px 18px", fontSize: 14,
                    color: T.t1, outline: "none", minHeight: "60vh", resize: "vertical", fontFamily: "inherit", lineHeight: 1.7 }} />
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                  <button onClick={() => setEditingSummary(false)}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t3, borderRadius: 8, padding: "8px 14px", fontSize: 12, cursor: "pointer" }}>
                    <X size={13} /> {tr.cancel}
                  </button>
                  <button onClick={saveSummary} disabled={savingSummary}
                    style={{ display: "flex", alignItems: "center", gap: 5, background: T.red, border: "none", color: "#fff", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer", opacity: savingSummary ? 0.6 : 1 }}>
                    <Check size={13} /> {savingSummary ? "..." : tr.save}
                  </button>
                </div>
              </div>
            ) : text ? (
              <article className="rp-article">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={articleMd}>{md}</ReactMarkdown>
              </article>
            ) : (
              <button onClick={() => { setSummaryDraft(""); setEditingSummary(true) }}
                style={{ width: "100%", maxWidth: 720, textAlign: "left", background: T.s1, border: `0.5px dashed ${T.b1}`, borderRadius: 14, padding: 28, color: T.t4, fontSize: 14, cursor: "pointer" }}>
                {tr.empty}
              </button>
            )}
          </main>
        </div>

        </>}

        {/* ── Data / charts: only real agent data, demo is opt-in ── */}
        {tab === "analytics" && (
        <section className="rp-noprint">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 700, color: T.t1 }}>
              <BarChart3 size={17} style={{ color: T.red }} /> {uk ? "Дані й графіки" : "Data & charts"}
            </div>
            {demo && (
              <>
                <span style={{ fontSize: 12, color: T.t4 }}>
                  {uk ? "Агент ще не передав числові дані для графіків." : "The agent hasn't sent chart data yet."}
                </span>
                <button onClick={() => setShowDemo(v => !v)}
                  style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t3, borderRadius: 20, padding: "6px 12px", fontSize: 11, cursor: "pointer" }}>
                  <Sparkles size={12} /> {showDemo ? (uk ? "Сховати приклад" : "Hide example") : (uk ? "Показати приклад дашборда" : "Show example dashboard")}
                  <ChevronDown size={12} style={{ transform: showDemo ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
                </button>
              </>
            )}
          </div>

          {showCharts && (
            <div className="rp-rise">
              {demo && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "12px 0 16px", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "#FBBF24", background: "rgba(251,191,36,.08)", border: "0.5px solid rgba(251,191,36,.25)", borderRadius: 20, padding: "5px 10px" }}>
                    {uk ? "Це вигадані приклад-дані, не з цього звіту" : "These are made-up example numbers, not from this report"}
                  </span>
                  <button onClick={commitAsReal} disabled={committing}
                    title={uk ? "Запише те, що зараз на екрані, в базу як дані звіту" : "Writes what's on screen into the database as this report's data"}
                    style={{ background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t3, borderRadius: 20, padding: "5px 12px", fontSize: 11, cursor: "pointer", opacity: committing ? 0.6 : 1 }}>
                    {committing ? tr.committing : tr.commit}
                  </button>
                </div>
              )}
              <SweepLine />

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 16 }}>
                {cdRaw.stats.map((s) => <StatTile key={s.label} label={s.label} value={s.value} delta={s.delta} up={s.up} />)}
              </div>

              <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{tr.activity}</div>
                  {demo && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {PERIODS.map((p) => (
                        <button key={p.key} onClick={() => setPeriod(p.key)}
                          style={{ background: period === p.key ? T.red : "transparent", border: `0.5px solid ${period === p.key ? T.red : T.b1}`,
                            color: period === p.key ? "#fff" : T.t3, borderRadius: 20, padding: "5px 12px", fontSize: 11, fontWeight: period === p.key ? 600 : 400, cursor: "pointer" }}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <SweepLine />
                <TrendChart series={trendSeries} labels={trendLabels} onColorChange={setTrendColor} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gap: 16 }}>
                <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{tr.breakdown}</div>
                  <SweepLine />
                  <DonutChart data={breakdown} totalLabel={tr.total} addLabel={tr.addCategory} emptyLabel={tr.emptyBreakdown}
                    onColorChange={(i, c) => setBreakdownField(cdRaw.breakdown, i, "color", c)}
                    onLabelChange={(i, l) => setBreakdownField(cdRaw.breakdown, i, "label", l)}
                    onValueChange={(i, v) => setBreakdownField(cdRaw.breakdown, i, "value", v)}
                    onAdd={() => addBreakdownItem(cdRaw.breakdown)}
                    onRemove={(i) => removeBreakdownItem(cdRaw.breakdown, i)} />
                </div>
                <div style={{ background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{tr.weekly}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {demo && (
                        <>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <CalendarDays size={13} style={{ color: T.t4 }} />
                            <input type="date" value={barsDate} onChange={(e) => setBarsDate(e.target.value)}
                              style={{ background: "#09090F", border: `0.5px solid ${T.b1}`, borderRadius: 8, padding: "5px 8px", fontSize: 11, color: T.t2, fontFamily: "'JetBrains Mono', monospace" }} />
                          </div>
                          <button onClick={() => setBarsDate(new Date().toISOString().slice(0, 10))}
                            style={{ background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t3, borderRadius: 8, padding: "5px 10px", fontSize: 11, cursor: "pointer" }}>
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
          )}
        </section>
        )}
      </div>

      {flash && (
        <div className="rp-noprint" style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 60,
          background: T.s2, border: `0.5px solid ${T.b1}`, color: T.t1, fontSize: 13, borderRadius: 10, padding: "9px 14px",
          boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
          <Check size={13} style={{ color: "#22C55E", verticalAlign: -2, marginRight: 6 }} />{flash}
        </div>
      )}
    </div>
  )
}