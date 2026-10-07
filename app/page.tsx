"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Bot, MessageSquare, BookOpen, Image as ImageIcon,
  Plus, ArrowRight, ArrowUpRight, Key, Brain, Sparkles, BarChart3, Zap, Clock,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { chatStore } from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import AwayBrief from "@/components/dashboard/AwayBrief"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  b1:    "rgba(255,255,255,0.09)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#D8D4EC",
  t3:    "#BEB8D4",
  t4:    "#6A6A8A",
  red:   "#E8002A",
  green: "#22C55E",
}

type Agent    = { id: string; name: string; description: string; provider_id: string | null; avatar_color: string; created_at: string }
type Session  = { id: string; agent_id: string | null; title: string; updated_at: string; created_at: string }
type Provider = { id: string; name: string; model: string; is_active: boolean }
type VaultItem = { id: string; title: string; content: string; created_at: string }

type ActivityItem = {
  id: string
  kind: "agent" | "session" | "vault"
  title: string
  subtitle: string
  time: string
  agentColor?: string
  agentInitial?: string
  href: string
}

function ago(iso: string, uk: boolean): string {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return uk ? "щойно" : "just now"
  if (m < 60) return uk ? `${m} хв тому` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return uk ? `${h} год тому` : `${h}h ago`
  const dy = Math.floor(h / 24)
  if (dy === 1) return uk ? "вчора" : "yesterday"
  if (dy < 7) return uk ? `${dy} дн тому` : `${dy}d ago`
  return new Date(iso).toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short" })
}

function Avatar({ name, color, size = 30 }: { name: string; color?: string | null; size?: number }) {
  const c = color ?? T.red
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.3), flexShrink: 0, background: c,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Space Grotesk', sans-serif", fontSize: Math.round(size * 0.42), fontWeight: 700, color: "#fff",
      boxShadow: `0 0 14px ${c}40`,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function SectionHead({ title, action, onAction, onAdd, icon: Icon }: { title: string; action?: string; onAction?: () => void; onAdd?: () => void; icon: React.ElementType }) {
  return (
    <div className="db-head">
      <Icon size={13} style={{ color: T.red }} />
      <span>{title}</span>
      {action && <button onClick={onAction}>{action} <ArrowRight size={11} /></button>}
      {onAdd && <button className="db-add" onClick={onAdd} title="+"><Plus size={13} /></button>}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const uk = language === "uk"

  const [agents,    setAgents]    = useState<Agent[]>([])
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vault,     setVault]     = useState<VaultItem[]>([])
  const [gallery,   setGallery]   = useState<{ id: string }[]>([])
  const [memory,    setMemory]    = useState<{ id: string }[]>([])
  const [reports,   setReports]   = useState<{ id: string }[]>([])
  const [userName,  setUserName]  = useState("Operator")
  const [ready,     setReady]     = useState(false)

  useEffect(() => {
    async function load() {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Operator"
        setUserName(name)
      }
      const [
        { data: agentsData }, { data: sessionsData }, { data: providersData },
        { data: vaultData }, { data: galleryData }, { data: memoryData }, { data: reportsData },
      ] = await Promise.all([
        sb.from("agents").select("id,name,description,provider_id,avatar_color,created_at").order("created_at", { ascending: false }),
        sb.from("chat_sessions").select("id,agent_id,title,updated_at,created_at").order("updated_at", { ascending: false }),
        sb.from("providers").select("id,name,model,is_active"),
        sb.from("vault_items").select("id,title,content,created_at").order("created_at", { ascending: false }),
        sb.from("gallery_items").select("id"),
        sb.from("memory_items").select("id"),
        sb.from("reports").select("id"),
      ])
      if (agentsData)    setAgents(agentsData as Agent[])
      if (sessionsData)  setSessions(sessionsData as Session[])
      if (providersData) setProviders(providersData as Provider[])
      if (vaultData)     setVault(vaultData as VaultItem[])
      if (galleryData)   setGallery(galleryData)
      if (memoryData)    setMemory(memoryData)
      if (reportsData)   setReports(reportsData)
      setReady(true)
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6)  return t.dashboard.greetingEvening
    if (h < 12) return t.dashboard.greetingMorning
    if (h < 18) return t.dashboard.greetingDay
    return t.dashboard.greetingEvening
  }

  const today = new Date().toLocaleDateString(uk ? "uk-UA" : "en-US", { weekday: "long", day: "numeric", month: "long" })

  const activeProviders = providers.filter(p => p.is_active)
  const recentSessions  = sessions.slice(0, 4)
  const recentAgents    = agents.slice(0, 4)
  const recentVault     = vault.slice(0, 4)

  function getAgent(id: string | null) { return agents.find(a => a.id === id) }
  function getProvider(id: string | null) { return providers.find(p => p.id === id) }
  function sessionCount(agentId: string) { return sessions.filter(s => s.agent_id === agentId).length }

  function startChat(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation()
    const session = chatStore.create(agent.id, `${t.agents.chatWithPrefix}${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []
    agents.forEach(a => items.push({
      id: `agent-${a.id}`, kind: "agent", title: a.name, subtitle: t.dashboard.activityNewAgent,
      time: a.created_at, agentColor: a.avatar_color, agentInitial: a.name.charAt(0).toUpperCase(), href: `/agents/${a.id}`,
    }))
    sessions.forEach(s => {
      const agent = agents.find(a => a.id === s.agent_id)
      items.push({
        id: `session-${s.id}`, kind: "session", title: agent?.name ?? t.dashboard.newChat,
        subtitle: `${t.dashboard.activityNewSession} · ${s.title}`, time: s.created_at,
        agentColor: agent?.avatar_color, agentInitial: (agent?.name ?? "?").charAt(0).toUpperCase(), href: `/chat/${s.id}`,
      })
    })
    vault.forEach(v => items.push({
      id: `vault-${v.id}`, kind: "vault", title: t.dashboard.statVault,
      subtitle: `${t.dashboard.activitySavedVault} · ${v.title}`, time: v.created_at, href: `/vault/${v.id}`,
    }))
    return items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 6)
  }, [agents, sessions, vault, t])

  const stats = [
    { icon: Bot,           value: agents.length,          label: t.dashboard.statAgents,    href: "/agents",    color: "#E8002A" },
    { icon: MessageSquare, value: sessions.length,        label: t.dashboard.statSessions,  href: "/chat",      color: "#22C55E" },
    { icon: Brain,         value: memory.length,          label: t.dashboard.statMemory,    href: "/memory",    color: "#8B5CF6" },
    { icon: BarChart3,     value: reports.length,         label: uk ? "Звіти" : "Reports",   href: "/reports",   color: "#06B6D4" },
    { icon: BookOpen,      value: vault.length,           label: t.dashboard.statVault,     href: "/vault",     color: "#F59E0B" },
    { icon: ImageIcon,     value: gallery.length,         label: t.dashboard.statGallery,   href: "/gallery",   color: "#EC4899" },
    { icon: Key,           value: activeProviders.length, label: t.dashboard.statProviders, href: "/providers", color: "#4285F4" },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes dbIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes dbPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }

        .db-primary { display: flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s, box-shadow .13s, transform .13s; }
        .db-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .db-ghost { display: flex; align-items: center; gap: 7px; background: rgba(255,255,255,.05); color: ${T.t1}; border: 0.5px solid ${T.b1};
          border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s, border-color .13s; }
        .db-ghost:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.18); }

        /* stats strip */
        .db-stats { display: grid; grid-template-columns: repeat(7, minmax(0, 1fr)); gap: 12px; margin-bottom: 28px; }
        @media (max-width: 1400px) { .db-stats { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        @media (max-width: 800px)  { .db-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .db-stat { position: relative; display: flex; flex-direction: column; gap: 8px; padding: 13px 14px 12px; border-radius: 13px; cursor: pointer;
          text-align: left; font-family: inherit; overflow: hidden;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: dbIn .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s; }
        .db-stat::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--c), transparent); opacity: .6; transition: opacity .2s; }
        .db-stat::after { content: ""; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%;
          background: radial-gradient(closest-side, var(--c), transparent); opacity: .08; transition: opacity .25s; }
        .db-stat:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--c) 45%, transparent); box-shadow: 0 12px 28px rgba(0,0,0,.4); }
        .db-stat:hover::before { opacity: 1; }
        .db-stat:hover::after { opacity: .2; }
        .db-stat-top { display: flex; align-items: center; justify-content: space-between; }
        .db-stat-num { font-family: 'JetBrains Mono', monospace; font-size: 22px; font-weight: 600; color: ${T.t1}; line-height: 1; }
        .db-stat-lbl { font-size: 12px; color: ${T.t3}; }
        .db-stat .db-arr { color: ${T.t4}; opacity: 0; transform: translate(-3px,3px); transition: all .2s; }
        .db-stat:hover .db-arr { opacity: 1; transform: none; color: var(--c); }

        /* layout */
        .db-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
        .db-side { display: flex; flex-direction: column; gap: 22px; position: sticky; top: 20px; }
        @media (max-width: 1150px) { .db-grid { grid-template-columns: 1fr; } .db-side { position: static; } }
        .db-main { display: flex; flex-direction: column; gap: 28px; min-width: 0; }

        .db-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .db-head span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }
        .db-head button { margin-left: auto; display: flex; align-items: center; gap: 4px; font-size: 11.5px; color: ${T.t4};
          background: none; border: none; cursor: pointer; transition: color .15s; }
        .db-head button:hover { color: ${T.red}; }

        /* cards */
        .db-cards { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 1500px) {
          .db-cards { grid-template-columns: repeat(3, minmax(0, 1fr)); }
          /* keep exactly one full row: no lonely 4th tile */
          .db-cards > :nth-child(4) { display: none; }
        }
        @media (max-width: 900px)  { .db-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); } .db-cards > :nth-child(4) { display: flex; } }
        .db-card { position: relative; display: flex; flex-direction: column; gap: 9px; min-height: 108px; padding: 13px 14px 11px; border-radius: 13px;
          cursor: pointer; text-align: left; font-family: inherit; overflow: hidden;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: dbIn .45s cubic-bezier(.2,.8,.2,1) both;
          transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s; }
        .db-card::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--c, ${T.red}), transparent); opacity: .55; transition: opacity .2s; }
        .db-card:hover { transform: translateY(-3px); border-color: rgba(232,0,42,.35);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45); }
        .db-card:hover::before { opacity: 1; }
        .db-card-title { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 600; color: ${T.t1}; line-height: 1.35;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .db-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; display: flex; align-items: center; gap: 4px; }
        .db-card .db-arr { flex-shrink: 0; color: ${T.t4}; opacity: 0; transform: translate(-3px,3px); transition: all .2s; }
        .db-card:hover .db-arr { opacity: 1; transform: none; color: ${T.red}; }
        .db-chat { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 10px; border-radius: 7px;
          font-size: 11px; font-weight: 500; font-family: inherit; cursor: pointer;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.09); color: ${T.t2}; transition: all .15s; }
        .db-chat:hover { background: ${T.red}; border-color: ${T.red}; color: #fff; box-shadow: 0 0 14px rgba(232,0,42,.35); }
        .db-new { display: flex; align-items: center; justify-content: center; gap: 9px; min-height: 108px;
          border-radius: 13px; border: 1px dashed rgba(255,255,255,.10); background: transparent; color: ${T.t4};
          cursor: pointer; font-family: inherit; font-size: 12.5px; transition: background .2s, border-color .2s, color .2s; }
        .db-new:hover { background: rgba(232,0,42,.05); border-color: rgba(232,0,42,.45); color: ${T.t1}; }
        .db-new i { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: rgba(232,0,42,.10); color: ${T.red}; transition: transform .2s; }
        .db-new:hover i { transform: rotate(90deg); }
        .db-add { margin-left: 8px !important; width: 24px; height: 24px; border-radius: 7px; justify-content: center; padding: 0;
          background: rgba(232,0,42,.10) !important; border: 0.5px solid rgba(232,0,42,.3) !important; color: ${T.red} !important; }
        .db-add:hover { background: ${T.red} !important; color: #fff !important; }

        /* side panels */
        .db-panel { border-radius: 13px; overflow: hidden; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .db-row { display: flex; align-items: center; gap: 10px; padding: 10px 13px; cursor: pointer; transition: background .15s;
          border-bottom: 0.5px solid rgba(255,255,255,.05); }
        .db-row:last-child { border-bottom: 0; }
        .db-row:hover { background: rgba(232,0,42,.05); }
        .db-row-t { font-size: 12.5px; font-weight: 500; color: ${T.t1}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .db-row-s { font-size: 10.5px; color: ${T.t4}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px; }

        .db-quick { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .db-quick button { display: flex; align-items: center; gap: 9px; padding: 11px 12px; border-radius: 11px; cursor: pointer; text-align: left;
          font-size: 12px; font-family: inherit; color: ${T.t2}; background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%);
          border: 0.5px solid ${T.b1}; transition: transform .15s, border-color .15s, background .15s; }
        .db-quick button:hover { transform: translateY(-2px); border-color: color-mix(in srgb, var(--c) 50%, transparent); color: ${T.t1}; }
        .db-quick i { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0;
          background: color-mix(in srgb, var(--c) 14%, transparent); color: var(--c); }

        .db-live { width: 7px; height: 7px; border-radius: 50%; background: ${T.green}; animation: dbPulse 2s infinite; flex-shrink: 0; }

        /* activity timeline */
        .db-tl { position: relative; padding-left: 18px; }
        .db-tl::before { content: ""; position: absolute; left: 5px; top: 6px; bottom: 6px; width: 1px;
          background: linear-gradient(180deg, rgba(232,0,42,.5), rgba(255,255,255,.06)); }
        .db-tl-item { position: relative; display: flex; align-items: center; gap: 11px; padding: 8px 10px; border-radius: 10px; cursor: pointer; transition: background .15s; }
        .db-tl-item:hover { background: rgba(255,255,255,.03); }
        .db-tl-item::before { content: ""; position: absolute; left: -16px; top: 50%; width: 7px; height: 7px; margin-top: -3.5px; border-radius: 50%;
          background: #0D0D15; border: 1.5px solid ${T.red}; }
        .db-tl-item:first-child::before { background: ${T.red}; box-shadow: 0 0 8px rgba(232,0,42,.8); }

        @media (prefers-reduced-motion: reduce) { .db-stat, .db-card { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, position: "relative",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "38px 48px 30px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, pointerEvents: "none", background: "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(232,0,42,0.07) 0%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 340, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px 4px 10px" }}>
                  <span aria-hidden style={{ position: "relative", width: 20, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                    <span className="astrocore-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>{t.dashboard.onlineBadge}</span>
                </div>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4, textTransform: "capitalize" }}>{today}</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                {greeting()}, <span style={{ color: T.red }}>{userName}</span>.
              </h1>
              <p style={{ fontSize: 13, color: T.t3, margin: "8px 0 0" }}>
                {uk
                  ? `${agents.length} агент(ів) на зв'язку · ${sessions.length} розмов · ${activeProviders.length} активних провайдерів`
                  : `${agents.length} agents online · ${sessions.length} conversations · ${activeProviders.length} active providers`}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => router.push("/chat")} className="db-ghost"><MessageSquare size={14} /> {t.dashboard.openChat}</button>
              <button onClick={() => router.push("/agents")} className="db-primary"><Bot size={14} /> {t.dashboard.newAgent}</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "26px 48px 60px" }}>

          {/* While you were away */}
          <AwayBrief />

          {ready && activeProviders.length === 0 && (
            <button onClick={() => router.push("/providers")} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left",
              padding: "12px 16px", borderRadius: 12, marginBottom: 22,
              background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.25)",
            }}>
              <Key size={14} style={{ color: T.red }} />
              <span style={{ fontSize: 13, color: "#FF4D6A" }}>{t.dashboard.addApiKeyBanner}</span>
              <ArrowRight size={13} style={{ color: T.red, marginLeft: "auto" }} />
            </button>
          )}

          {/* Stats strip */}
          <div className="db-stats">
            {stats.map((s, i) => {
              const Icon = s.icon
              return (
                <button key={s.href} onClick={() => router.push(s.href)} className="db-stat"
                  style={{ ["--c" as string]: s.color, animationDelay: `${i * 35}ms` } as React.CSSProperties}>
                  <div className="db-stat-top">
                    <Icon size={15} style={{ color: s.color }} />
                    <ArrowUpRight size={13} className="db-arr" />
                  </div>
                  <div className="db-stat-num">{ready ? s.value : "—"}</div>
                  <div className="db-stat-lbl">{s.label}</div>
                </button>
              )
            })}
          </div>

          <div className="db-grid">
            {/* ── Main column ── */}
            <div className="db-main">

              {/* Continue working: recent chats */}
              <section>
                <SectionHead icon={MessageSquare} title={uk ? "Продовжити роботу" : "Continue working"} action={t.dashboard.allSessions} onAction={() => router.push("/chat")} onAdd={() => router.push("/chat")} />
                <div className="db-cards">
                  {recentSessions.map((s, i) => {
                    const agent = getAgent(s.agent_id)
                    return (
                      <div key={s.id} role="button" tabIndex={0} className="db-card"
                        onClick={() => router.push(`/chat/${s.id}`)}
                        onKeyDown={e => { if (e.key === "Enter") router.push(`/chat/${s.id}`) }}
                        style={{ ["--c" as string]: agent?.avatar_color ?? T.red, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                          {agent
                            ? <Avatar name={agent.name} color={agent.avatar_color} size={24} />
                            : <div style={{ width: 24, height: 24, borderRadius: 7, display: "grid", placeItems: "center", background: "rgba(232,0,42,.12)" }}><MessageSquare size={12} style={{ color: T.red }} /></div>}
                          <span style={{ fontSize: 11.5, color: T.t3, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{agent?.name ?? t.dashboard.newChat}</span>
                          <ArrowUpRight size={14} className="db-arr" />
                        </div>
                        <div className="db-card-title">{s.title}</div>
                        <div className="db-meta" style={{ marginTop: "auto" }}><Clock size={10} />{ago(s.updated_at ?? s.created_at, uk)}</div>
                      </div>
                    )
                  })}
                  {recentSessions.length < 4 && (
                    <button className="db-new" onClick={() => router.push("/chat")}>
                      <i><Plus size={14} /></i>{t.dashboard.openNewChat}
                    </button>
                  )}
                </div>
              </section>

              {/* Agents */}
              <section>
                <SectionHead icon={Bot} title={t.dashboard.agentsPanel} action={t.dashboard.allAgents} onAction={() => router.push("/agents")} onAdd={() => router.push("/agents")} />
                <div className="db-cards">
                  {recentAgents.map((a, i) => {
                    const prov = getProvider(a.provider_id)
                    const n = sessionCount(a.id)
                    return (
                      <div key={a.id} role="button" tabIndex={0} className="db-card"
                        onClick={() => router.push(`/agents/${a.id}`)}
                        onKeyDown={e => { if (e.key === "Enter") router.push(`/agents/${a.id}`) }}
                        style={{ ["--c" as string]: a.avatar_color ?? T.red, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <Avatar name={a.name} color={a.avatar_color} size={32} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="db-card-title" style={{ WebkitLineClamp: 1 }}>{a.name}</div>
                            <div className="db-meta" style={{ marginTop: 2 }}>{prov ? prov.model : (uk ? "без провайдера" : "no provider")}</div>
                          </div>
                        </div>
                        {a.description && (
                          <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.description}</div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", marginTop: "auto" }}>
                          <span className="db-meta"><MessageSquare size={10} /> {n}</span>
                          <button className="db-chat" onClick={e => startChat(e, a)}><MessageSquare size={11} /> {uk ? "Чат" : "Chat"}</button>
                        </div>
                      </div>
                    )
                  })}
                  {recentAgents.length < 4 && (
                    <button className="db-new" onClick={() => router.push("/agents")}>
                      <i><Plus size={14} /></i>{t.dashboard.createNewAgent}
                    </button>
                  )}
                </div>
              </section>

              {/* Activity timeline */}
              {activity.length > 0 && (
                <section>
                  <SectionHead icon={Sparkles} title={t.dashboard.recentActivity} />
                  <div className="db-panel" style={{ padding: "8px 8px 8px 10px" }}>
                    <div className="db-tl">
                      {activity.map(item => (
                        <div key={item.id} className="db-tl-item" onClick={() => router.push(item.href)}>
                          {item.kind === "vault" ? (
                            <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "rgba(245,158,11,0.14)", display: "grid", placeItems: "center" }}>
                              <BookOpen size={12} style={{ color: "#F59E0B" }} />
                            </div>
                          ) : (
                            <Avatar name={item.agentInitial ?? "?"} color={item.agentColor} size={26} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div className="db-row-t">{item.title}</div>
                            <div className="db-row-s">{item.subtitle}</div>
                          </div>
                          <span className="db-meta" style={{ flexShrink: 0 }}>{ago(item.time, uk)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* ── Side column ── */}
            <aside className="db-side">
              {/* Quick actions */}
              <section>
                <SectionHead icon={Zap} title={t.dashboard.quickActions} />
                <div className="db-quick">
                  {[
                    { icon: MessageSquare, label: t.dashboard.newChat,    href: "/chat",          color: "#22C55E" },
                    { icon: Brain,         label: uk ? "Новий запис" : "New memory", href: "/memory/new", color: "#8B5CF6" },
                    { icon: BarChart3,     label: uk ? "Звіти" : "Reports", href: "/reports",      color: "#06B6D4" },
                    { icon: BookOpen,      label: t.dashboard.statVault,  href: "/vault",         color: "#F59E0B" },
                    { icon: ImageIcon,     label: t.dashboard.statGallery, href: "/gallery",      color: "#EC4899" },
                    { icon: Key,           label: t.dashboard.statProviders, href: "/providers",  color: "#4285F4" },
                  ].map(q => {
                    const Icon = q.icon
                    return (
                      <button key={q.href} onClick={() => router.push(q.href)} style={{ ["--c" as string]: q.color } as React.CSSProperties}>
                        <i><Icon size={13} /></i>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.label}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {/* Providers */}
              <section>
                <SectionHead icon={Key} title={t.dashboard.providersPanel} action={t.dashboard.manage} onAction={() => router.push("/providers")} />
                <div className="db-panel">
                  {providers.length === 0 ? (
                    <div style={{ padding: "18px 0", textAlign: "center", fontSize: 12, color: T.t4 }}>{t.dashboard.noProviders}</div>
                  ) : providers.slice(0, 4).map(p => (
                    <div key={p.id} className="db-row" onClick={() => router.push("/providers")}>
                      {p.is_active ? <span className="db-live" /> : <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2E2E4A", flexShrink: 0 }} />}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="db-row-t">{p.name}</div>
                        <div className="db-row-s" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10 }}>{p.model}</div>
                      </div>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 9, padding: "2px 7px", borderRadius: 5, textTransform: "uppercase", letterSpacing: ".05em",
                        background: p.is_active ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                        border: `0.5px solid ${p.is_active ? "rgba(34,197,94,0.24)" : "rgba(255,255,255,0.07)"}`,
                        color: p.is_active ? T.green : T.t4,
                      }}>
                        {p.is_active ? t.dashboard.active : t.dashboard.inactive}
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              {/* Vault */}
              <section>
                <SectionHead icon={BookOpen} title={t.dashboard.knowledgeVault} action={t.dashboard.open} onAction={() => router.push("/vault")} />
                <div className="db-panel">
                  {recentVault.length === 0 ? (
                    <div style={{ padding: "18px 0", textAlign: "center", fontSize: 12, color: T.t4 }}>{t.dashboard.emptyVault}</div>
                  ) : recentVault.map(v => (
                    <div key={v.id} className="db-row" onClick={() => router.push(`/vault/${v.id}`)}>
                      <div style={{ width: 26, height: 26, borderRadius: 8, flexShrink: 0, background: "rgba(245,158,11,0.12)", display: "grid", placeItems: "center" }}>
                        <BookOpen size={12} style={{ color: "#F59E0B" }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="db-row-t">{v.title}</div>
                        <div className="db-row-s">{v.content.replace(/[#*_`>]/g, "").slice(0, 70)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>
    </>
  )
}