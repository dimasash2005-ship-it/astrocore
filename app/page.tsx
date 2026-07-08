"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Bot, MessageSquare, BookOpen, Image as ImageIcon,
  Plus, ArrowRight, Key, Brain, Sparkles,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.09)",
  b2:    "rgba(255,255,255,0.16)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#D8D4EC",
  t3:    "#BEB8D4",
  t4:    "#6A6A8A",
  red:   "#E8002A",
  green: "#22C55E",
}

type Agent = {
  id: string
  name: string
  description: string
  provider_id: string | null
  avatar_color: string
  created_at: string
}

type Session = {
  id: string
  agent_id: string | null
  title: string
  updated_at: string
  created_at: string
}

type Provider = {
  id: string
  name: string
  model: string
  is_active: boolean
}

type VaultItem = {
  id: string
  title: string
  content: string
  created_at: string
}

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

function ago(iso: string): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return "щойно"
  if (m < 60) return `${m} хв тому`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} год тому`
  const dy = Math.floor(h / 24)
  if (dy === 1) return "вчора"
  return `${dy}д тому`
}

// ── Glass card shell — shared premium treatment for every panel ──
function GlassCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(160deg,#121220 0%,#0D0D16 100%)",
      border: `0.5px solid ${T.b1}`,
      borderRadius: 16,
      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05), 0 12px 30px rgba(0,0,0,0.25)",
      overflow: "hidden",
      ...style,
    }}>
      {children}
    </div>
  )
}

function PanelHeader({ title, actionLabel, onAction }: { title: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "15px 17px 13px", borderBottom: `0.5px solid ${T.b1}`,
    }}>
      <span style={{ fontSize: 10.5, fontWeight: 700, color: "#82829E", textTransform: "uppercase", letterSpacing: "0.09em" }}>{title}</span>
      {actionLabel && (
        <button onClick={onAction} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, fontWeight: 500 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.red }}
        >
          {actionLabel} <ArrowRight size={10} />
        </button>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, value, label, sub, href, color }: {
  icon: React.ElementType
  value: number | string
  label: string
  sub?: string
  href?: string
  color?: string
}) {
  const router = useRouter()
  const [hov, setHov] = useState(false)
  const c = color ?? T.red

  return (
    <div
      onClick={() => href && router.push(href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? "linear-gradient(160deg,#151526 0%,#0F0F1C 100%)"
          : "linear-gradient(160deg,#121220 0%,#0D0D16 100%)",
        border: `0.5px solid ${hov ? `${c}4A` : T.b1}`,
        boxShadow: hov
          ? `0 0 0 1px ${c}22, 0 10px 28px ${c}18, inset 0 1px 0 rgba(255,255,255,0.06)`
          : "inset 0 1px 0 rgba(255,255,255,0.04)",
        borderRadius: 16, padding: "18px 20px",
        cursor: href ? "pointer" : "default",
        transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease",
        transform: hov ? "translateY(-1px)" : "translateY(0)",
        display: "flex", flexDirection: "column", gap: 12,
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${c}1C`,
        border: `0.5px solid ${c}40`,
        boxShadow: `0 0 12px ${c}1E`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={17} style={{ color: c, opacity: 0.9 }} />
      </div>

      <div>
        <div style={{ fontSize: 27, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 12.5, fontWeight: 500, color: T.t2, marginTop: 5 }}>{label}</div>
        {sub && <div style={{ fontSize: 10.5, color: T.t4, marginTop: 1 }}>{sub}</div>}
      </div>

      {href && (
        <div style={{ position: "absolute", right: 16, top: 16, opacity: hov ? 1 : 0, transition: "opacity 150ms ease" }}>
          <ArrowRight size={14} style={{ color: T.t4 }} />
        </div>
      )}
    </div>
  )
}

function ListRow({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
        borderRadius: 10, cursor: "pointer",
        background: hov ? "rgba(232,0,42,0.055)" : "rgba(255,255,255,0.02)",
        border: `0.5px solid ${hov ? "rgba(232,0,42,0.20)" : "rgba(255,255,255,0.05)"}`,
        transition: "background 140ms ease, border-color 140ms ease",
      }}
    >
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const { t }  = useLanguage()

  const [agents,    setAgents]    = useState<Agent[]>([])
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vault,     setVault]     = useState<VaultItem[]>([])
  const [gallery,   setGallery]   = useState<{ id: string }[]>([])
  const [memory,    setMemory]    = useState<{ id: string }[]>([])
  const [userName,  setUserName]  = useState("Оператор")
  const [pulse,     setPulse]     = useState(false)
  const [ready,     setReady]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    async function load() {
      const sb = getSupabase()

      const { data: { user } } = await sb.auth.getUser()
      if (user) {
        const name = user.user_metadata?.full_name || user.email?.split("@")[0] || "Оператор"
        setUserName(name)
      }

      const [
        { data: agentsData },
        { data: sessionsData },
        { data: providersData },
        { data: vaultData },
        { data: galleryData },
        { data: memoryData },
      ] = await Promise.all([
        sb.from("agents").select("id,name,description,provider_id,avatar_color,created_at").order("created_at", { ascending: false }),
        sb.from("chat_sessions").select("id,agent_id,title,updated_at,created_at").order("updated_at", { ascending: false }),
        sb.from("providers").select("id,name,model,is_active"),
        sb.from("vault_items").select("id,title,content,created_at").order("created_at", { ascending: false }),
        sb.from("gallery_items").select("id").order("created_at", { ascending: false }),
        sb.from("memory_items").select("id").order("created_at", { ascending: false }),
      ])

      if (agentsData)    setAgents(agentsData as Agent[])
      if (sessionsData)  setSessions(sessionsData as Session[])
      if (providersData) setProviders(providersData as Provider[])
      if (vaultData)     setVault(vaultData as VaultItem[])
      if (galleryData)   setGallery(galleryData)
      if (memoryData)    setMemory(memoryData)
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

  const activeProviders = providers.filter(p => p.is_active)
  const recentSessions  = sessions.slice(0, 4)
  const recentAgents    = agents.slice(0, 3)
  const recentVault     = vault.slice(0, 3)

  function getAgent(id: string | null) { return agents.find(a => a.id === id) }
  function getProvider(id: string | null) { return providers.find(p => p.id === id) }

  // Activity feed — composed client-side from data already fetched above
  // (agents/sessions/vault). No new backend calls, no new tables.
  const activity = useMemo<ActivityItem[]>(() => {
    const items: ActivityItem[] = []

    agents.forEach(a => items.push({
      id: `agent-${a.id}`, kind: "agent",
      title: a.name, subtitle: t.dashboard.activityNewAgent,
      time: a.created_at, agentColor: a.avatar_color, agentInitial: a.name.charAt(0).toUpperCase(),
      href: `/agents/${a.id}`,
    }))

    sessions.forEach(s => {
      const agent = getAgent(s.agent_id)
      items.push({
        id: `session-${s.id}`, kind: "session",
        title: agent?.name ?? t.dashboard.newChat, subtitle: `${t.dashboard.activityNewSession} · ${s.title}`,
        time: s.created_at, agentColor: agent?.avatar_color, agentInitial: (agent?.name ?? "?").charAt(0).toUpperCase(),
        href: `/chat/${s.id}`,
      })
    })

    vault.forEach(v => items.push({
      id: `vault-${v.id}`, kind: "vault",
      title: t.dashboard.statVault, subtitle: `${t.dashboard.activitySavedVault} · ${v.title}`,
      time: v.created_at,
      href: "/vault",
    }))

    return items
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 5)
  }, [agents, sessions, vault])

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(200%);opacity:0}
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>

        {/* scan line */}
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* ── Hero ── */}
        <div style={{
          position: "relative", padding: "42px 48px 34px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          {/* soft top glow */}
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, pointerEvents: "none", background: "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(232,0,42,0.09) 0%,transparent 100%)" }} />

          {/* ── "rising sun" ── real sunrise color gradation, bigger + rounder + softer */}

          {/* outermost deep-red ambient bloom, heavily blurred, near-circular */}
          <div aria-hidden style={{
            position: "absolute", left: "50%", bottom: -340, transform: "translateX(-50%)",
            width: 1000, height: 560, borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle at 50% 100%, rgba(220,10,45,0.55) 0%, rgba(160,0,35,0.30) 40%, transparent 72%)",
            filter: "blur(26px)",
          }} />

          {/* mid layer — red, rounder proportions, softer edge */}
          <div aria-hidden style={{
            position: "absolute", left: "50%", bottom: -210, transform: "translateX(-50%)",
            width: 680, height: 380, borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle at 50% 100%, rgba(255,50,60,0.65) 0%, rgba(232,0,42,0.45) 35%, rgba(232,0,42,0.20) 58%, transparent 78%)",
            filter: "blur(16px)",
          }} />

          {/* hot core — near-white/pink center, rounder, softly blurred (no hard edge) */}
          <div aria-hidden style={{
            position: "absolute", left: "50%", bottom: -110, transform: "translateX(-50%)",
            width: 340, height: 190, borderRadius: "50%", pointerEvents: "none",
            background: "radial-gradient(circle at 50% 100%, rgba(255,225,220,0.9) 0%, rgba(255,110,110,0.7) 30%, rgba(232,0,42,0.5) 55%, transparent 80%)",
            filter: "blur(10px)",
          }} />

          {/* soft fanning glow — wide blurred wedges instead of sharp ray lines */}
          <div aria-hidden style={{ position: "absolute", left: "50%", bottom: -40, transform: "translateX(-50%)", width: 1000, height: 260, pointerEvents: "none", filter: "blur(18px)" }}>
            {[-30, -18, -8, 8, 18, 30].map(deg => (
              <div key={deg} style={{
                position: "absolute", left: "50%", bottom: 0,
                width: 26, height: 230,
                transform: `translateX(-50%) rotate(${deg}deg)`,
                transformOrigin: "50% 100%",
                borderRadius: "50% 50% 0 0",
                background: "linear-gradient(0deg, rgba(255,90,90,0.35) 0%, rgba(232,0,42,0.16) 40%, transparent 78%)",
              }} />
            ))}
          </div>

          {/* thin bright horizon line, warm white-pink at the center fading to red at the edges */}
          <div aria-hidden style={{
            position: "absolute", bottom: -1, left: "15%", right: "15%", height: 1.5, pointerEvents: "none",
            background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.55) 30%,rgba(255,225,215,0.95) 50%,rgba(232,0,42,0.55) 70%,transparent 100%)",
            boxShadow: "0 0 16px rgba(255,140,120,0.55), 0 0 30px rgba(232,0,42,0.35)",
          }} />
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.45) 40%,rgba(232,0,42,0.45) 60%,transparent 100%)" }} />

          {/* AI Core badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
            borderRadius: 20, padding: "3px 10px", marginBottom: 20,
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block",
              opacity: pulse ? 1 : 0.3,
              transition: "opacity 900ms ease, box-shadow 900ms ease",
              boxShadow: pulse ? "0 0 8px rgba(232,0,42,1), 0 0 16px rgba(232,0,42,0.5)" : "none",
            }} />
            <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              {t.dashboard.onlineBadge}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: T.t1, margin: 0, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                {greeting()}, <span style={{ color: T.red }}>{userName}</span>.
              </h1>
              <div style={{ fontSize: 13, color: T.t4, marginTop: 10 }}>
                {agents.length} {t.dashboard.statAgents.toLowerCase()} · {sessions.length} {t.dashboard.statSessions.toLowerCase()} · {activeProviders.length} {t.dashboard.statProviders.toLowerCase()}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {activeProviders.length === 0 && (
                <button onClick={() => router.push("/providers")} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 10, fontSize: 12.5, cursor: "pointer",
                  background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", color: "#FF4D6A",
                }}>
                  <Key size={13} /> {t.dashboard.addApiKey}
                </button>
              )}
              <button onClick={() => router.push("/agents")} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 10, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                boxShadow: "0 4px 16px rgba(232,0,42,0.25)",
                transition: "background 140ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Bot size={14} /> {t.dashboard.newAgent}
              </button>
              <button onClick={() => router.push("/chat")} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.06)", color: T.t1, border: `0.5px solid ${T.b1}`,
                borderRadius: 10, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "background 140ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
              >
                <MessageSquare size={14} /> {t.dashboard.openChat}
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "30px 48px 56px" }}>

          {/* No provider warning */}
          {ready && activeProviders.length === 0 && (
            <div onClick={() => router.push("/providers")} style={{
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              padding: "12px 16px", borderRadius: 12, marginBottom: 26,
              background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)",
            }}>
              <Key size={14} style={{ color: T.red }} />
              <span style={{ fontSize: 13, color: "#FF4D6A" }}>
                {t.dashboard.addApiKeyBanner}
              </span>
              <ArrowRight size={13} style={{ color: T.red, marginLeft: "auto" }} />
            </div>
          )}

          {/* Stat cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
            gap: 16, marginBottom: 30,
          }}>
            <StatCard icon={Bot}           value={agents.length}           label={t.dashboard.statAgents}    sub={t.dashboard.statAgentsSub}    href="/agents"    color="#E8002A" />
            <StatCard icon={MessageSquare} value={sessions.length}         label={t.dashboard.statSessions}  sub={t.dashboard.statSessionsSub}  href="/chat"      color="#22C55E" />
            <StatCard icon={Key}           value={activeProviders.length}  label={t.dashboard.statProviders} sub={t.dashboard.statProvidersSub} href="/providers" color="#4285F4" />
            <StatCard icon={BookOpen}      value={vault.length}            label={t.dashboard.statVault}     sub={t.dashboard.statVaultSub}     href="/vault"     color="#F59E0B" />
            <StatCard icon={Brain}         value={memory.length}           label={t.dashboard.statMemory}    sub={t.dashboard.statMemorySub}    href="/memory"    color="#8B5CF6" />
            <StatCard icon={ImageIcon}     value={gallery.length}          label={t.dashboard.statGallery}   sub={t.dashboard.statGallerySub}   href="/gallery"   color="#EC4899" />
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18 }}>

            {/* Agents */}
            <GlassCard>
              <PanelHeader title={t.dashboard.agentsPanel} actionLabel={t.dashboard.allAgents} onAction={() => router.push("/agents")} />
              <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {recentAgents.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: T.t4, marginBottom: 10 }}>{t.dashboard.noAgents}</div>
                    <button onClick={() => router.push("/agents")} style={{
                      fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 7,
                      background: "rgba(232,0,42,0.09)", border: "0.5px solid rgba(232,0,42,0.20)",
                      color: T.red, cursor: "pointer",
                    }}>
                      <Plus size={11} /> {t.dashboard.createAgent}
                    </button>
                  </div>
                ) : recentAgents.map(agent => {
                  const prov = getProvider(agent.provider_id)
                  return (
                    <ListRow key={agent.id} onClick={() => router.push(`/agents/${agent.id}`)}>
                      <div style={{
                        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
                        background: agent.avatar_color ?? T.red,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#fff",
                      }}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {agent.name}
                        </div>
                        {prov && <div style={{ fontSize: 10.5, color: T.t4, marginTop: 1 }}>{prov.name} · {prov.model}</div>}
                      </div>
                      <ArrowRight size={12} style={{ color: T.t4, flexShrink: 0 }} />
                    </ListRow>
                  )
                })}
                <button onClick={() => router.push("/agents")} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px", borderRadius: 9, marginTop: 2,
                  border: `0.5px dashed ${T.b1}`, background: "transparent", cursor: "pointer",
                  color: T.t4, fontSize: 12,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; (e.currentTarget as HTMLElement).style.borderColor = T.b2 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; (e.currentTarget as HTMLElement).style.borderColor = T.b1 }}
                >
                  <Plus size={12} /> {t.dashboard.createNewAgent}
                </button>
              </div>
            </GlassCard>

            {/* Recent chats */}
            <GlassCard>
              <PanelHeader title={t.dashboard.recentChats} actionLabel={t.dashboard.allSessions} onAction={() => router.push("/chat")} />
              <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {recentSessions.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: T.t4, marginBottom: 10 }}>{t.dashboard.noSessions}</div>
                    <button onClick={() => router.push("/chat")} style={{
                      fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 7,
                      background: "rgba(232,0,42,0.09)", border: "0.5px solid rgba(232,0,42,0.20)",
                      color: T.red, cursor: "pointer",
                    }}>
                      <Plus size={11} /> {t.dashboard.newChat}
                    </button>
                  </div>
                ) : recentSessions.map(s => {
                  const agent = getAgent(s.agent_id)
                  return (
                    <ListRow key={s.id} onClick={() => router.push(`/chat/${s.id}`)}>
                      {agent ? (
                        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: agent.avatar_color ?? T.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: "rgba(232,0,42,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MessageSquare size={13} style={{ color: T.red, opacity: 0.7 }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                        <div style={{ fontSize: 10.5, color: T.t4, marginTop: 1 }}>{ago(s.updated_at ?? s.created_at)}</div>
                      </div>
                      <ArrowRight size={12} style={{ color: T.t4, flexShrink: 0 }} />
                    </ListRow>
                  )
                })}
                <button onClick={() => router.push("/chat")} style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px", borderRadius: 9, marginTop: 2,
                  border: `0.5px dashed ${T.b1}`, background: "transparent", cursor: "pointer",
                  color: T.t4, fontSize: 12,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2; (e.currentTarget as HTMLElement).style.borderColor = T.b2 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; (e.currentTarget as HTMLElement).style.borderColor = T.b1 }}
                >
                  <MessageSquare size={12} /> {t.dashboard.openNewChat}
                </button>
              </div>
            </GlassCard>

            {/* Right column: Vault + Providers + Quick actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

              {/* Vault */}
              <GlassCard style={{ flex: 1 }}>
                <PanelHeader title={t.dashboard.knowledgeVault} actionLabel={t.dashboard.open} onAction={() => router.push("/vault")} />
                <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {recentVault.length === 0 ? (
                    <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: T.t4 }}>{t.dashboard.emptyVault}</div>
                  ) : recentVault.map(item => (
                    <div key={item.id}
                      onClick={() => router.push("/vault")}
                      style={{
                        padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                        background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.05)",
                        transition: "background 130ms ease, border-color 130ms ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.055)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.18)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"; (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.05)" }}
                    >
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 10.5, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.content.slice(0, 60)}
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Providers */}
              <GlassCard>
                <PanelHeader title={t.dashboard.providersPanel} actionLabel={t.dashboard.manage} onAction={() => router.push("/providers")} />
                <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {providers.length === 0 ? (
                    <div style={{ padding: "12px 0", textAlign: "center", fontSize: 12, color: T.t4 }}>{t.dashboard.noProviders}</div>
                  ) : providers.slice(0, 3).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: p.is_active ? T.green : "#2E2E4A",
                        boxShadow: p.is_active ? `0 0 7px ${T.green}90` : "none",
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: T.t2 }}>{p.name}</span>
                        <span style={{ fontSize: 10.5, color: T.t4, marginLeft: 6 }}>{p.model}</span>
                      </div>
                      <span style={{
                        fontSize: 9.5, padding: "1px 6px", borderRadius: 5,
                        background: p.is_active ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                        border: `0.5px solid ${p.is_active ? "rgba(34,197,94,0.24)" : "rgba(255,255,255,0.07)"}`,
                        color: p.is_active ? T.green : T.t4,
                      }}>
                        {p.is_active ? t.dashboard.active : t.dashboard.inactive}
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Quick actions */}
              <GlassCard>
                <div style={{ padding: "15px 17px 13px", borderBottom: `0.5px solid ${T.b1}` }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#82829E", textTransform: "uppercase", letterSpacing: "0.09em" }}>{t.dashboard.quickActions}</span>
                </div>
                <div style={{ padding: "10px 10px 12px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                  {[
                    { icon: Bot,           label: t.dashboard.newAgent,    href: "/agents",    color: "#E8002A" },
                    { icon: MessageSquare, label: t.dashboard.newChat,     href: "/chat",      color: "#22C55E" },
                    { icon: BookOpen,      label: t.dashboard.statVault,   href: "/vault",     color: "#F59E0B" },
                    { icon: Brain,         label: t.dashboard.statMemory,  href: "/memory",    color: "#8B5CF6" },
                    { icon: Key,           label: t.dashboard.statProviders, href: "/providers", color: "#4285F4" },
                    { icon: ImageIcon,     label: t.dashboard.statGallery, href: "/gallery",   color: "#EC4899" },
                  ].map(({ icon: Icon, label, href, color }) => (
                    <button key={href}
                      onClick={() => router.push(href)}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "9px 10px", borderRadius: 9, border: `0.5px solid ${T.b1}`,
                        background: "rgba(255,255,255,0.02)", cursor: "pointer",
                        color: T.t2, fontSize: 12, textAlign: "left",
                        transition: "background 130ms ease, border-color 130ms ease",
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.06)"
                        ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.20)"
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
                        ;(e.currentTarget as HTMLElement).style.borderColor = T.b1
                      }}
                    >
                      <Icon size={13} style={{ color, opacity: 0.9, flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
                      <ArrowRight size={10} style={{ color: T.t4, marginLeft: "auto", flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </GlassCard>
            </div>

          </div>

          {/* ── Recent activity — computed client-side from data above ── */}
          {activity.length > 0 && (
            <GlassCard style={{ marginTop: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "15px 17px 13px", borderBottom: `0.5px solid ${T.b1}` }}>
                <Sparkles size={13} style={{ color: T.red, opacity: 0.8 }} />
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#82829E", textTransform: "uppercase", letterSpacing: "0.09em" }}>{t.dashboard.recentActivity}</span>
              </div>
              <div style={{ padding: "6px 8px" }}>
                {activity.map(item => (
                  <div key={item.id}
                    onClick={() => router.push(item.href)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 10px", borderRadius: 10, cursor: "pointer",
                      transition: "background 130ms ease",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, flexShrink: 0, boxShadow: `0 0 6px ${T.green}80` }} />
                    {item.agentInitial ? (
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: item.agentColor ?? T.red,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, color: "#fff",
                      }}>
                        {item.agentInitial}
                      </div>
                    ) : (
                      <div style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: "rgba(245,158,11,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <BookOpen size={13} style={{ color: "#F59E0B" }} />
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: T.t1 }}>{item.title}</div>
                      <div style={{ fontSize: 11, color: T.t4, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.subtitle}</div>
                    </div>
                    <div style={{ fontSize: 10.5, color: T.t4, flexShrink: 0 }}>{ago(item.time)}</div>
                  </div>
                ))}
              </div>
            </GlassCard>
          )}
        </div>
      </div>
    </>
  )
}