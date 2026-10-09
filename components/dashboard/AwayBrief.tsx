"use client"

// "While you were away" strip for the top of the dashboard.
// Shows what appeared in the account since the owner's previous visit:
// new reports, memory items, finished missions and active chats.
// Standalone: reads its own counts from Supabase, stores the last visit in localStorage.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { BarChart3, Brain, Target, MessageSquare, ArrowRight, Sparkles } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/useLanguage"

const LAST_SEEN = "ac_last_seen"      // localStorage: when the previous visit happened
const SINCE     = "ac_brief_since"    // sessionStorage: keeps the same "since" during this visit

type Counts = { reports: number | null; memory: number | null; missions: number | null; chats: number | null }
type LatestReport = { id: string; company_name: string | null; created_at: string } | null

function getSince(): string {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  try {
    const kept = sessionStorage.getItem(SINCE)
    if (kept) return kept
    const prev = localStorage.getItem(LAST_SEEN)
    const since = prev || dayAgo
    sessionStorage.setItem(SINCE, since)
    localStorage.setItem(LAST_SEEN, new Date().toISOString())
    return since
  } catch {
    return dayAgo
  }
}

function sinceLabel(iso: string, uk: boolean): string {
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString(uk ? "uk-UA" : "en-US", { hour: "2-digit", minute: "2-digit" })
  const sameDay = d.toDateString() === now.toDateString()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (sameDay) return uk ? `з ${time}` : `since ${time}`
  if (d.toDateString() === y.toDateString()) return uk ? `з учора, ${time}` : `since yesterday, ${time}`
  const date = d.toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short" })
  return uk ? `з ${date}` : `since ${date}`
}

const AB_CSS = `
        .ab { display: flex; align-items: center; flex-wrap: wrap; gap: 6px 4px; width: fit-content; max-width: 100%;
          margin-bottom: 20px; padding: 6px 8px 6px 12px; border-radius: 11px;
          background: rgba(255,255,255,.025); border: 0.5px solid rgba(255,255,255,.07); }
        .ab-title { display: inline-flex; align-items: center; gap: 7px; margin-right: 6px;
          font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; font-weight: 600; color: #D8D4EC; white-space: nowrap; }
        .ab-since { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: #8A8AAA; font-weight: 500; }
        .ab-sep { width: 1px; height: 16px; background: rgba(255,255,255,.08); margin: 0 4px; }
        .ab-chip { display: inline-flex; align-items: center; gap: 6px; padding: 4px 9px; border-radius: 7px; white-space: nowrap;
          font-family: inherit; font-size: 12px; color: #BEB8D4; background: transparent; border: 0.5px solid transparent;
          cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
        .ab-chip:hover { background: rgba(255,255,255,.04); border-color: color-mix(in srgb, var(--c) 40%, transparent); color: #F0EDF8; }
        .ab-chip b { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 600; color: #F0EDF8; }
        .ab-chip.zero b { color: #4A4A66; }
        .ab-chip.soon { cursor: default; color: #8A8AAA; }
        .ab-chip.soon:hover { background: transparent; border-color: transparent; color: #8A8AAA; }
        .ab-chip.soon em { font-style: normal; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; letter-spacing: .05em;
          text-transform: uppercase; padding: 2px 5px; border-radius: 4px; border: 0.5px dashed rgba(245,158,11,.4); color: #F59E0B; }
        .ab-latest { max-width: 260px; }
        .ab-latest span { overflow: hidden; text-overflow: ellipsis; }
        .ab-quiet { font-size: 12px; color: #8C8AA6; padding: 4px 6px; }
        .ab-go { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 7px; font-family: inherit;
          font-size: 12px; font-weight: 500; cursor: pointer; color: #FF4D6A; background: rgba(232,0,42,.08);
          border: 0.5px solid rgba(232,0,42,.25); white-space: nowrap; transition: background .15s; }
        .ab-go:hover { background: rgba(232,0,42,.16); }
              /* placeholder while counts load: same size as the real strip, so nothing below jumps */
        .ab-skel { box-sizing: border-box; min-height: 39px; pointer-events: none; }
        @media (max-width: 640px) { .ab-skel { min-height: 70px; width: 100%; align-content: flex-start; } }
        .ab-sk { display: inline-block; height: 14px; border-radius: 5px; background: rgba(255,255,255,.06); animation: abPulse 1.4s ease-in-out infinite; }
        @keyframes abPulse { 0%,100% { opacity: .5; } 50% { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .ab-sk { animation: none; } }
`

export default function AwayBrief() {
  const router = useRouter()
  const { language } = useLanguage()
  const uk = language === "uk"

  const [since, setSince]   = useState<string | null>(null)
  const [counts, setCounts] = useState<Counts | null>(null)
  const [latest, setLatest] = useState<LatestReport>(null)

  useEffect(() => {
    const s = getSince()
    setSince(s)
    const sb = getSupabase()

    async function count(table: string, column: string): Promise<number | null> {
      const { count, error } = await sb.from(table).select("id", { count: "exact", head: true }).gte(column, s)
      return error ? null : (count ?? 0)
    }

    async function load() {
      const [reports, memory, missions, chats, last] = await Promise.all([
        count("reports", "created_at"),
        count("memory_items", "created_at"),
        // "missions" table comes with the Missions feature; until then this returns null → "soon"
        count("missions", "last_run_at"),
        count("chat_sessions", "updated_at"),
        sb.from("reports").select("id,company_name,created_at").gte("created_at", s)
          .order("created_at", { ascending: false }).limit(1),
      ])
      setCounts({ reports, memory, missions, chats })
      if (!last.error && last.data && last.data.length) setLatest(last.data[0] as LatestReport)
    }
    load()
  }, [])

  // Reserve the strip's space from the very first paint (also on the server),
  // so the dashboard below doesn't jump when the counts arrive.
  if (!since || !counts) return (
    <>
      <style>{AB_CSS}</style>
      <div className="ab ab-skel" aria-hidden>
        <span className="ab-sk" style={{ width: 150 }} />
        <span className="ab-sep" />
        <span className="ab-sk" style={{ width: 70 }} />
        <span className="ab-sk" style={{ width: 80 }} />
        <span className="ab-sk" style={{ width: 70 }} />
        <span className="ab-sk" style={{ width: 64 }} />
      </div>
    </>
  )

  const items = [
    { key: "reports", n: counts.reports, icon: BarChart3,     color: "#06B6D4", href: "/reports", label: uk ? "звітів" : "reports" },
    { key: "memory",  n: counts.memory,  icon: Brain,         color: "#8B5CF6", href: "/memory",  label: uk ? "у пам'ять" : "memory" },
    { key: "missions", n: counts.missions, icon: Target,      color: "#F59E0B", href: "/missions", label: uk ? "місій" : "missions", soon: counts.missions === null },
    { key: "chats",   n: counts.chats,   icon: MessageSquare, color: "#22C55E", href: "/chat",    label: uk ? "чатів" : "chats" },
  ].filter(i => i.n !== null || i.key === "missions")


  return (
    <>
      <style>{AB_CSS}</style>

      <section className="ab" aria-label={uk ? "Поки тебе не було" : "While you were away"}>
        <span className="ab-title">
          <Sparkles size={12} style={{ color: "#E8002A" }} />
          {uk ? "Поки тебе не було" : "While you were away"}
          <span className="ab-since">{sinceLabel(since, uk)}</span>
        </span>
        <span className="ab-sep" aria-hidden />

        {items.map(i => {
          const Icon = i.icon
          if (i.soon) return (
            <span key={i.key} className="ab-chip soon" style={{ ["--c" as string]: i.color } as React.CSSProperties}>
              <Icon size={13} style={{ color: i.color, opacity: .6 }} />
              {uk ? "Місії" : "Missions"} <em>{uk ? "скоро" : "soon"}</em>
            </span>
          )
          return (
            <button key={i.key} className={`ab-chip${i.n ? "" : " zero"}`} onClick={() => router.push(i.href)}
              style={{ ["--c" as string]: i.color } as React.CSSProperties}>
              <Icon size={13} style={{ color: i.color }} />
              <b>{i.n}</b> {i.label}
            </button>
          )
        })}

        {latest && (
          <>
            <span className="ab-sep" aria-hidden />
            <button className="ab-chip ab-latest" onClick={() => router.push("/reports")}
              style={{ ["--c" as string]: "#06B6D4" } as React.CSSProperties}>
              <BarChart3 size={13} style={{ color: "#06B6D4", flexShrink: 0 }} />
              <span>{latest.company_name || (uk ? "Новий звіт" : "New report")}</span>
              <ArrowRight size={12} style={{ flexShrink: 0 }} />
            </button>
          </>
        )}
      </section>
    </>
  )
}