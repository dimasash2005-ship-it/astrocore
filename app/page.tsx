"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bot, MessageSquare, BookOpen, Image as ImageIcon,
  Plus, ArrowRight, Key, Brain, Zap,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.10)",
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

  return (
    <div
      onClick={() => href && router.push(href)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? "linear-gradient(160deg,#14142A 0%,#0F0F1E 100%)"
          : "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
        border: `0.5px solid ${hov ? `${color ?? T.red}44` : T.b1}`,
        boxShadow: hov ? `0 0 24px ${color ?? T.red}14` : "none",
        borderRadius: 14, padding: "18px 20px",
        cursor: href ? "pointer" : "default",
        transition: "all 160ms ease",
        display: "flex", flexDirection: "column", gap: 10,
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: `${color ?? T.red}1C`,
        border: `0.5px solid ${color ?? T.red}40`,
        boxShadow: `0 0 10px ${color ?? T.red}18`,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={17} style={{ color: color ?? T.red, opacity: 0.85 }} />
      </div>

      <div>
        <div style={{ fontSize: 28, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", lineHeight: 1 }}>
          {value}
        </div>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t2, marginTop: 4 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: T.t4, marginTop: 2 }}>{sub}</div>}
      </div>

      {href && (
        <div style={{
          position: "absolute", right: 16, top: 16,
          opacity: hov ? 1 : 0, transition: "opacity 150ms ease",
        }}>
          <ArrowRight size={14} style={{ color: T.t4 }} />
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const router = useRouter()

  const [agents,    setAgents]    = useState<Agent[]>([])
  const [sessions,  setSessions]  = useState<Session[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vault,     setVault]     = useState<VaultItem[]>([])
  const [gallery,   setGallery]   = useState<{ id: string }[]>([])
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
      ] = await Promise.all([
        sb.from("agents").select("id,name,description,provider_id,avatar_color,created_at").order("created_at", { ascending: false }),
        sb.from("chat_sessions").select("id,agent_id,title,updated_at,created_at").order("updated_at", { ascending: false }),
        sb.from("providers").select("id,name,model,is_active"),
        sb.from("vault_items").select("id,title,content,created_at").order("created_at", { ascending: false }),
        sb.from("gallery_items").select("id").order("created_at", { ascending: false }),
      ])

      if (agentsData)   setAgents(agentsData as Agent[])
      if (sessionsData) setSessions(sessionsData as Session[])
      if (providersData) setProviders(providersData as Provider[])
      if (vaultData)    setVault(vaultData as VaultItem[])
      if (galleryData)  setGallery(galleryData)
      setReady(true)
    }
    load()
  }, [])

  const greeting = () => {
    const h = new Date().getHours()
    if (h < 6)  return "Добрий вечір"
    if (h < 12) return "Добрий ранок"
    if (h < 18) return "Добрий день"
    return "Добрий вечір"
  }

  const activeProviders = providers.filter(p => p.is_active)
  const recentSessions  = sessions.slice(0, 4)
  const recentAgents    = agents.slice(0, 3)
  const recentVault     = vault.slice(0, 3)

  function getAgent(id: string | null) { return agents.find(a => a.id === id) }
  function getProvider(id: string | null) { return providers.find(p => p.id === id) }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(200%);opacity:0}
        }
        @keyframes aipulse {
          0%,100%{opacity:.4;transform:scale(.85)} 50%{opacity:1;transform:scale(1)}
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
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
          position: "relative", padding: "40px 48px 32px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, pointerEvents: "none", background: "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(232,0,42,0.07) 0%,transparent 100%)" }} />
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
              AI CORE — ОНЛАЙН
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <h1 style={{ fontSize: 36, fontWeight: 700, color: T.t1, margin: 0, letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                {greeting()},
              </h1>
              <h2 style={{ fontSize: 34, fontWeight: 700, color: T.t3, margin: "4px 0 12px", letterSpacing: "-0.03em", lineHeight: 1.15 }}>
                {userName}.
              </h2>
              <div style={{ fontSize: 13, color: T.t4 }}>
                {agents.length} агентів · {sessions.length} сесій · {providers.filter(p => p.is_active).length} провайдерів
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {activeProviders.length === 0 && (
                <button onClick={() => router.push("/providers")} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "9px 16px", borderRadius: 9, fontSize: 12.5, cursor: "pointer",
                  background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", color: "#FF4D6A",
                }}>
                  <Key size={13} /> Додайте API ключ
                </button>
              )}
              <button onClick={() => router.push("/agents")} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Bot size={14} /> Новий агент
              </button>
              <button onClick={() => router.push("/chat")} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.07)", color: T.t1, border: `0.5px solid ${T.b1}`,
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.11)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)" }}
              >
                <MessageSquare size={14} /> Відкрити чат
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "28px 48px 56px" }}>

          {/* No provider warning */}
          {ready && activeProviders.length === 0 && (
            <div onClick={() => router.push("/providers")} style={{
              display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
              padding: "12px 16px", borderRadius: 11, marginBottom: 24,
              background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)",
            }}>
              <Key size={14} style={{ color: T.red }} />
              <span style={{ fontSize: 13, color: "#FF4D6A" }}>
                Додайте API ключ, щоб агенти могли відповідати
              </span>
              <ArrowRight size={13} style={{ color: T.red, marginLeft: "auto" }} />
            </div>
          )}

          {/* Stat cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: 14, marginBottom: 28,
          }}>
            <StatCard icon={Bot}           value={agents.length}    label="Агенти"     sub="активних"     href="/agents"    color="#E8002A" />
            <StatCard icon={MessageSquare} value={sessions.length}  label="Сесії"      sub="розмов"       href="/chat"      color="#22C55E" />
            <StatCard icon={Key}           value={providers.length} label="Провайдери" sub="підключено"    href="/providers" color="#4285F4" />
            <StatCard icon={BookOpen}      value={vault.length}     label="Сховище"    sub="записів"      href="/vault"     color="#F59E0B" />
            <StatCard icon={ImageIcon}     value={gallery.length}   label="Галерея"    sub="виводів"      href="/gallery"   color="#8B5CF6" />
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 }}>

            {/* Agents */}
            <div style={{
              background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
              border: `0.5px solid ${T.b1}`, borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: `0.5px solid ${T.b1}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7A7A9A", textTransform: "uppercase", letterSpacing: "0.09em" }}>Агенти</span>
                <button onClick={() => router.push("/agents")} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  Всі агенти <ArrowRight size={10} />
                </button>
              </div>
              <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
                {recentAgents.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: T.t4, marginBottom: 10 }}>Агентів ще немає</div>
                    <button onClick={() => router.push("/agents")} style={{
                      fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 7,
                      background: "rgba(232,0,42,0.09)", border: "0.5px solid rgba(232,0,42,0.20)",
                      color: T.red, cursor: "pointer",
                    }}>
                      <Plus size={11} /> Створити агента
                    </button>
                  </div>
                ) : recentAgents.map(agent => {
                  const prov = getProvider(agent.provider_id)
                  return (
                    <div key={agent.id}
                      onClick={() => router.push(`/agents/${agent.id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                        borderRadius: 9, cursor: "pointer",
                        background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
                        transition: "background 130ms ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)" }}
                    >
                      <div style={{
                        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
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
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Recent chats */}
            <div style={{
              background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
              border: `0.5px solid ${T.b1}`, borderRadius: 14, overflow: "hidden",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: `0.5px solid ${T.b1}` }}>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7A7A9A", textTransform: "uppercase", letterSpacing: "0.09em" }}>Останні чати</span>
                <button onClick={() => router.push("/chat")} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                  Всі сесії <ArrowRight size={10} />
                </button>
              </div>
              <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                {recentSessions.length === 0 ? (
                  <div style={{ padding: "20px 0", textAlign: "center" }}>
                    <div style={{ fontSize: 12, color: T.t4, marginBottom: 10 }}>Сесій ще немає</div>
                    <button onClick={() => router.push("/chat")} style={{
                      fontSize: 11.5, display: "inline-flex", alignItems: "center", gap: 5,
                      padding: "6px 12px", borderRadius: 7,
                      background: "rgba(232,0,42,0.09)", border: "0.5px solid rgba(232,0,42,0.20)",
                      color: T.red, cursor: "pointer",
                    }}>
                      <Plus size={11} /> Новий чат
                    </button>
                  </div>
                ) : recentSessions.map(s => {
                  const agent = getAgent(s.agent_id)
                  return (
                    <div key={s.id}
                      onClick={() => router.push(`/chat/${s.id}`)}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "8px 10px",
                        borderRadius: 9, cursor: "pointer",
                        background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
                        transition: "background 130ms ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)" }}
                    >
                      {agent ? (
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: agent.avatar_color ?? T.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "#fff" }}>
                          {agent.name.charAt(0).toUpperCase()}
                        </div>
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 7, flexShrink: 0, background: "rgba(232,0,42,0.12)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <MessageSquare size={13} style={{ color: T.red, opacity: 0.7 }} />
                        </div>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                        <div style={{ fontSize: 10.5, color: T.t4, marginTop: 1 }}>{ago(s.updated_at ?? s.created_at)}</div>
                      </div>
                      <ArrowRight size={12} style={{ color: T.t4, flexShrink: 0 }} />
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Vault + quick actions */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Vault */}
              <div style={{
                background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                border: `0.5px solid ${T.b1}`, borderRadius: 14, overflow: "hidden", flex: 1,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: `0.5px solid ${T.b1}` }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7A7A9A", textTransform: "uppercase", letterSpacing: "0.09em" }}>Сховище знань</span>
                  <button onClick={() => router.push("/vault")} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    Відкрити <ArrowRight size={10} />
                  </button>
                </div>
                <div style={{ padding: "10px 14px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {recentVault.length === 0 ? (
                    <div style={{ padding: "16px 0", textAlign: "center", fontSize: 12, color: T.t4 }}>Сховище порожнє</div>
                  ) : recentVault.map(item => (
                    <div key={item.id}
                      onClick={() => router.push("/vault")}
                      style={{
                        padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                        background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
                        transition: "background 130ms ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)" }}
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
              </div>

              {/* Providers */}
              <div style={{
                background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                border: `0.5px solid ${T.b1}`, borderRadius: 14, overflow: "hidden",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 12px", borderBottom: `0.5px solid ${T.b1}` }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7A7A9A", textTransform: "uppercase", letterSpacing: "0.09em" }}>Провайдери</span>
                  <button onClick={() => router.push("/providers")} style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}>
                    Керувати <ArrowRight size={10} />
                  </button>
                </div>
                <div style={{ padding: "10px 14px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
                  {providers.length === 0 ? (
                    <div style={{ padding: "12px 0", textAlign: "center", fontSize: 12, color: T.t4 }}>Провайдерів немає</div>
                  ) : providers.slice(0, 3).map(p => (
                    <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                        background: p.is_active ? T.green : "#2E2E4A",
                        boxShadow: p.is_active ? `0 0 6px ${T.green}80` : "none",
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: 12, color: T.t2 }}>{p.name}</span>
                        <span style={{ fontSize: 10.5, color: T.t4, marginLeft: 6 }}>{p.model}</span>
                      </div>
                      <span style={{
                        fontSize: 9.5, padding: "1px 6px", borderRadius: 4,
                        background: p.is_active ? "rgba(34,197,94,0.09)" : "rgba(255,255,255,0.04)",
                        border: `0.5px solid ${p.is_active ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.07)"}`,
                        color: p.is_active ? T.green : T.t4,
                      }}>
                        {p.is_active ? "Активний" : "Вимкнено"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Quick actions */}
              <div style={{
                background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                border: `0.5px solid ${T.b1}`, borderRadius: 14, overflow: "hidden",
              }}>
                <div style={{ padding: "14px 16px 12px", borderBottom: `0.5px solid ${T.b1}` }}>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: "#7A7A9A", textTransform: "uppercase", letterSpacing: "0.09em" }}>Швидкі дії</span>
                </div>
                <div style={{ padding: "10px 12px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                  {[
                    { icon: Bot,           label: "Новий агент",    href: "/agents",    color: "#E8002A" },
                    { icon: MessageSquare, label: "Новий чат",      href: "/chat",      color: "#22C55E" },
                    { icon: BookOpen,      label: "Сховище",        href: "/vault",     color: "#F59E0B" },
                    { icon: Brain,         label: "Пам'ять",        href: "/memory",    color: "#8B5CF6" },
                    { icon: Key,           label: "Провайдери",     href: "/providers", color: "#4285F4" },
                  ].map(({ icon: Icon, label, href, color }) => (
                    <button key={href}
                      onClick={() => router.push(href)}
                      style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "8px 10px", borderRadius: 8, border: "none",
                        background: "transparent", cursor: "pointer",
                        color: T.t2, fontSize: 12.5, textAlign: "left",
                        transition: "background 120ms ease",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
                    >
                      <Icon size={14} style={{ color: color, opacity: 0.85, flexShrink: 0 }} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  )
}