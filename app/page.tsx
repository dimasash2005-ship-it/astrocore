"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Bot, MessageSquare, BookOpen, Image as ImageIcon,
  Brain, Plus, ArrowRight, Key,
} from "lucide-react"
import {
  agentStore, chatStore, providerStore,
  vaultStore, galleryStore,
  type Agent, type ChatSession,
  type Provider, type VaultItem,
} from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.11)",
  b2:    "rgba(255,255,255,0.18)",
  bRed:  "rgba(232,0,42,0.32)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  red:   "#E8002A",
  green: "#22C55E",
}

function ago(iso: string) {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return "щойно"
  if (m < 60) return `${m}хв`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}год`
  const dy = Math.floor(h / 24)
  return dy === 1 ? "вчора" : `${dy}д`
}

function cut(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "…" : (s || "")
}

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#12121E 0%,#0F0F1A 100%)",
      border: `0.5px solid ${T.b1}`,
      borderRadius: 14,
      padding: "18px 16px",
      ...style,
    }}>
      {children}
    </div>
  )
}

function SH({ label, action, al }: { label: string; action?: () => void; al?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.09em" }}>
        {label}
      </span>
      {action && (
        <button
          onClick={action}
          style={{ fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 3, opacity: 0.75, transition: "opacity 140ms ease" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.75" }}
        >
          {al ?? "Всі"} <ArrowRight size={10} />
        </button>
      )}
    </div>
  )
}

function StatCard({ icon: Icon, label, value, sub, accent, onClick }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; accent?: boolean; onClick?: () => void
}) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? T.s2 : T.s1,
        border: `0.5px solid ${accent && hov ? T.bRed : hov ? T.b2 : T.b1}`,
        borderRadius: 13, padding: "18px 20px",
        cursor: onClick ? "pointer" : "default",
        transition: "background 150ms ease, border-color 150ms ease",
        position: "relative", overflow: "hidden",
      }}
    >
      {accent && (
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, width: 140, height: 100, pointerEvents: "none",
          background: "radial-gradient(ellipse at 0% 0%,rgba(232,0,42,0.14) 0%,transparent 72%)",
        }} />
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 13 }}>
        <div style={{
          width: 33, height: 33, borderRadius: 8,
          background: accent ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.07)",
          border: `0.5px solid ${accent ? "rgba(232,0,42,0.30)" : "rgba(255,255,255,0.10)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={15} style={{ color: accent ? T.red : "#7070A8" }} />
        </div>
        {onClick && (
          <ArrowRight size={12} style={{ color: hov ? T.red : T.t3, transition: "color 150ms ease", marginTop: 2 }} />
        )}
      </div>
      <div style={{ fontSize: 28, fontWeight: 500, color: T.t1, lineHeight: 1, marginBottom: 4, letterSpacing: "-0.03em" }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: T.t3, fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </div>
      {sub && <div style={{ fontSize: 11, color: "#4A4A6A", marginTop: 3 }}>{sub}</div>}
    </div>
  )
}

function AgentRow({ agent, provider, onClick }: { agent: Agent; provider?: Provider; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "10px 11px", borderRadius: 9, cursor: "pointer",
        background: hov ? T.s2 : "rgba(255,255,255,0.03)",
        border: `0.5px solid ${hov ? T.b2 : "rgba(255,255,255,0.08)"}`,
        transition: "background 130ms ease, border-color 130ms ease",
        marginBottom: 7,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: agent.avatarColor ?? T.red,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 700, color: "#fff",
      }}>
        {agent.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {agent.name}
        </div>
        {provider && <div style={{ fontSize: 11, color: T.t3, marginTop: 1 }}>{provider.model}</div>}
      </div>
      <ArrowRight size={13} style={{ color: hov ? T.red : "#2C2C48", flexShrink: 0, transition: "color 130ms ease" }} />
    </div>
  )
}

function ChatRow({ session, agent, onClick }: { session: ChatSession; agent?: Agent; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  const last = session.messages[session.messages.length - 1]
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 9px", borderRadius: 8, cursor: "pointer",
        background: hov ? "rgba(255,255,255,0.05)" : "transparent",
        transition: "background 120ms ease", marginBottom: 2,
      }}
    >
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: agent?.avatarColor ?? "#242438",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 700, color: "#fff",
      }}>
        {agent ? agent.name.charAt(0).toUpperCase() : <MessageSquare size={12} />}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cut(session.title, 48)}
        </div>
        {last && (
          <div style={{ fontSize: 11, color: T.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {last.role === "user" ? "Ви: " : "AI: "}{cut(last.content, 50)}
          </div>
        )}
      </div>
      <span style={{ fontSize: 10, color: T.t3, flexShrink: 0 }}>
        {ago(last?.createdAt ?? session.createdAt)}
      </span>
    </div>
  )
}

function VaultRow({ item }: { item: VaultItem }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 9px", borderRadius: 8,
        background: hov ? "rgba(255,255,255,0.05)" : "transparent",
        transition: "background 120ms ease", marginBottom: 2,
      }}
    >
      <div style={{
        width: 27, height: 27, borderRadius: 6, flexShrink: 0,
        background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <BookOpen size={11} style={{ color: T.red, opacity: 0.85 }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cut(item.title, 44)}
        </div>
        <div style={{ fontSize: 11, color: T.t3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {cut(item.content, 52)}
        </div>
      </div>
      <span style={{ fontSize: 10, color: T.t3, flexShrink: 0 }}>{ago(item.createdAt)}</span>
    </div>
  )
}

function Empty({ icon: Icon, text, sub, cta, onCta }: {
  icon: React.ElementType; text: string; sub?: string; cta?: string; onCta?: () => void
}) {
  return (
    <div style={{ padding: "20px 0", textAlign: "center" }}>
      <Icon size={22} style={{ color: "#24243A", margin: "0 auto 8px" }} />
      <div style={{ fontSize: 12, color: T.t3 }}>{text}</div>
      {sub && <div style={{ fontSize: 11, color: "#3A3A5A", marginTop: 3 }}>{sub}</div>}
      {cta && (
        <button onClick={onCta} style={{
          marginTop: 10, fontSize: 12, color: T.red, background: "none", border: "none",
          cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 5,
        }}>
          <Plus size={11} />{cta}
        </button>
      )}
    </div>
  )
}

function RBtn({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        background: hov ? "#FF1A3E" : T.red, color: "#fff",
        border: "none", borderRadius: 8, padding: "9px 18px",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
        transition: "background 130ms ease",
        boxShadow: hov ? "0 0 22px rgba(232,0,42,0.38)" : "none",
      }}>
      <Icon size={14} />{label}
    </button>
  )
}

function GBtn({ icon: Icon, label, onClick }: { icon: React.ElementType; label: string; onClick: () => void }) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 7,
        background: hov ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.05)",
        border: `0.5px solid ${hov ? T.b2 : T.b1}`,
        color: hov ? T.t1 : T.t2, borderRadius: 8,
        padding: "9px 18px", fontSize: 13, fontWeight: 500,
        cursor: "pointer", transition: "all 130ms ease",
      }}>
      <Icon size={14} />{label}
    </button>
  )
}

export default function DashboardPage() {
  const router = useRouter()
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [sessions,  setSessions]  = useState<ChatSession[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [vault,     setVault]     = useState<VaultItem[]>([])
  const [gallery,   setGallery]   = useState<ReturnType<typeof galleryStore.getAll>>([])

  useEffect(() => {
    setAgents(agentStore.getAll())
    setSessions(chatStore.getAll())
    setProviders(providerStore.getAll())
    setVault(vaultStore.getAll())
    setGallery(galleryStore.getAll())
  }, [])

  const h = new Date().getHours()
  const greeting = h < 6 ? "Добрий вечір" : h < 12 ? "Доброго ранку" : h < 18 ? "Добрий день" : "Добрий вечір"
  const active      = providers.filter(p => p.isActive)
  const totalMsg    = sessions.reduce((s, c) => s + c.messages.length, 0)
  const getProvider = (id: string) => providers.find(p => p.id === id)
  const getAgent    = (id: string) => agents.find(a => a.id === id)

  const quickActions = [
    { icon: Bot,           label: "Новий агент",  href: "/agents"    },
    { icon: MessageSquare, label: "Новий чат",     href: "/chat"      },
    { icon: BookOpen,      label: "Сховище",       href: "/vault"     },
    { icon: Brain,         label: "Пам'ять",       href: "/memory"    },
    { icon: Key,           label: "Провайдери",    href: "/providers" },
  ]

  return (
    <>
      <style>{`
        @keyframes aipulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(232,0,42,0.7); }
          50%      { box-shadow: 0 0 0 5px rgba(232,0,42,0); }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.042) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        {/* Hero */}
        <div style={{ position: "relative", padding: "38px 48px 34px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.55) 35%,rgba(232,0,42,0.55) 65%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 380, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, left: "22%", right: "22%", height: 140, pointerEvents: "none", background: "radial-gradient(ellipse 100% 100% at 50% 0%,rgba(232,0,42,0.08) 0%,transparent 100%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "rgba(232,0,42,0.09)", border: `0.5px solid ${T.bRed}`,
              borderRadius: 20, padding: "4px 12px", marginBottom: 18,
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%", background: T.red,
                display: "inline-block", animation: "aipulse 2s ease-in-out infinite",
              }} />
              <span style={{ fontSize: 10.5, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                AI Core — онлайн
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <h1 style={{ fontSize: 32, fontWeight: 500, color: T.t1, margin: 0, lineHeight: 1.18, letterSpacing: "-0.03em" }}>
                  {greeting},<br />
                  <span style={{ color: "rgba(220,216,244,0.32)" }}>Оператор.</span>
                </h1>
                <p style={{ fontSize: 13, color: T.t3, marginTop: 10, marginBottom: 0 }}>
                  {agents.length} агентів · {sessions.length} сесій · {totalMsg} повідомлень
                </p>
              </div>
              <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
                <RBtn icon={Bot}           label="Новий агент"  onClick={() => router.push("/agents")} />
                <GBtn icon={MessageSquare} label="Відкрити чат" onClick={() => router.push("/chat")} />
              </div>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "30px 48px 56px", maxWidth: 1580 }}>

          {providers.length === 0 && (
            <div onClick={() => router.push("/providers")} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(232,0,42,0.07)", border: `0.5px solid ${T.bRed}`,
              borderRadius: 10, padding: "12px 16px", cursor: "pointer", marginBottom: 24,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Key size={15} style={{ color: T.red }} />
                <span style={{ fontSize: 13, color: T.t1 }}>Додайте API ключ, щоб агенти могли відповідати</span>
              </div>
              <span style={{ fontSize: 12, color: T.red, display: "flex", alignItems: "center", gap: 4 }}>
                Налаштувати <ArrowRight size={12} />
              </span>
            </div>
          )}

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 22 }}>
            <StatCard icon={Bot}           label="Агенти"     value={agents.length}   sub={agents.length ? "активних" : "Немає агентів"} accent onClick={() => router.push("/agents")} />
            <StatCard icon={MessageSquare} label="Сесії"      value={sessions.length} sub={`${totalMsg} повідомлень`}                        onClick={() => router.push("/chat")} />
            <StatCard icon={Key}           label="Провайдери" value={active.length}   sub={`${providers.length} підключено`}                  onClick={() => router.push("/providers")} />
            <StatCard icon={BookOpen}      label="Сховище"    value={vault.length}    sub="записів"                                           onClick={() => router.push("/vault")} />
            <StatCard icon={ImageIcon}     label="Галерея"    value={gallery.length}  sub="виводів"                                           onClick={() => router.push("/gallery")} />
          </div>

          {/* Main 3-col */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 16 }}>
            <Panel>
              <SH label="Агенти" action={() => router.push("/agents")} al="Всі агенти" />
              {agents.length === 0 ? (
                <Empty icon={Bot} text="Агентів ще немає" cta="Створити агента" onCta={() => router.push("/agents")} />
              ) : (
                <>
                  {agents.slice(0, 4).map(a => (
                    <AgentRow key={a.id} agent={a} provider={getProvider(a.providerId)} onClick={() => router.push(`/agents/${a.id}`)} />
                  ))}
                  {agents.length > 4 && (
                    <button onClick={() => router.push("/agents")} style={{ fontSize: 11, color: T.t3, background: "none", border: "none", cursor: "pointer", paddingTop: 4, width: "100%", textAlign: "center" }}>
                      + ще {agents.length - 4}
                    </button>
                  )}
                </>
              )}
            </Panel>

            <Panel>
              <SH label="Останні чати" action={() => router.push("/chat")} al="Всі сесії" />
              {sessions.length === 0 ? (
                <Empty icon={MessageSquare} text="Сесій ще немає" sub="Оберіть агента і почніть розмову" />
              ) : (
                sessions.slice(0, 6).map(s => (
                  <ChatRow key={s.id} session={s} agent={getAgent(s.agentId)} onClick={() => router.push(`/chat/${s.id}`)} />
                ))
              )}
            </Panel>

            <Panel>
              <SH label="Сховище знань" action={() => router.push("/vault")} al="Відкрити" />
              {vault.length === 0 ? (
                <Empty icon={BookOpen} text="Сховище порожнє" sub="Зберігайте відповіді AI прямо з чату" />
              ) : (
                vault.slice(0, 6).map(item => <VaultRow key={item.id} item={item} />)
              )}
            </Panel>
          </div>

          {/* Bottom row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr 0.75fr", gap: 16 }}>
            <Panel>
              <SH label="Провайдери" action={() => router.push("/providers")} al="Керувати" />
              {providers.length === 0 ? (
                <Empty icon={Key} text="Немає підключених провайдерів" />
              ) : (
                providers.slice(0, 5).map(p => (
                  <div key={p.id} style={{
                    display: "flex", alignItems: "center", gap: 11,
                    padding: "9px 11px", borderRadius: 8, marginBottom: 6,
                    background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: p.isActive ? T.green : "#2E2E4A",
                      boxShadow: p.isActive ? "0 0 6px rgba(34,197,94,0.65)" : "none",
                    }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: T.t1 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: T.t3 }}>{p.model}</div>
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 500, padding: "2px 7px", borderRadius: 4,
                      background: p.isActive ? "rgba(34,197,94,0.11)" : "rgba(255,255,255,0.04)",
                      color: p.isActive ? T.green : T.t3,
                      border: `0.5px solid ${p.isActive ? "rgba(34,197,94,0.24)" : "rgba(255,255,255,0.07)"}`,
                    }}>
                      {p.isActive ? "Активний" : "Вимкнено"}
                    </span>
                  </div>
                ))
              )}
            </Panel>

            <Panel>
              <SH label="Пам'ять" action={() => router.push("/memory")} al="Редагувати" />
              <div style={{
                background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.18)",
                borderRadius: 9, padding: "12px 13px",
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <Brain size={14} style={{ color: T.red, opacity: 0.85, flexShrink: 0, marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 600, color: T.red, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 5 }}>
                    Контекст активний
                  </div>
                  <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.55 }}>
                    Пам'ять автоматично інжектується в кожен запит агента.
                  </div>
                  <button onClick={() => router.push("/memory")} style={{
                    marginTop: 10, fontSize: 11, color: T.red, background: "none", border: "none",
                    cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, opacity: 0.8,
                  }}>
                    Переглянути <ArrowRight size={10} />
                  </button>
                </div>
              </div>
            </Panel>

            <Panel>
              <SH label="Швидкі дії" />
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {quickActions.map(({ icon: Icon, label, href }) => {
                  const [hov, setHov] = useState(false)
                  return (
                    <button key={href} onClick={() => router.push(href)}
                      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
                      style={{
                        display: "flex", alignItems: "center", gap: 9,
                        padding: "8px 9px", borderRadius: 7, border: "none",
                        background: hov ? "rgba(255,255,255,0.06)" : "transparent",
                        cursor: "pointer", width: "100%", textAlign: "left",
                        transition: "background 120ms ease",
                      }}>
                      <Icon size={14} style={{ color: hov ? T.red : T.t3, transition: "color 120ms ease", flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: hov ? T.t1 : T.t2, transition: "color 120ms ease" }}>
                        {label}
                      </span>
                    </button>
                  )
                })}
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  )
}