"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare, Plus, Bot, Clock,
  Search, Trash2, Zap, X, AlertCircle, ArrowRight,
} from "lucide-react"
import {
  chatStore, agentStore, providerStore,
  type ChatSession, type Agent, type Provider,
} from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

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
  green:"#22C55E",
}

function ago(iso: string): string {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return "щойно"
  if (m < 60) return `${m} хв`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} год`
  const dy = Math.floor(h / 24)
  if (dy === 1) return "вчора"
  if (dy < 7)  return `${dy}д`
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
}

function cut(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "…" : (s || "")
}

function groupByDate(sessions: ChatSession[]): { label: string; items: ChatSession[] }[] {
  const now       = new Date()
  const today     = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterday = today - 86400000
  const week      = today - 6 * 86400000
  const groups: Record<string, ChatSession[]> = {
    "Сьогодні": [], "Вчора": [], "Цей тиждень": [], "Раніше": [],
  }
  for (const s of sessions) {
    const t = new Date(s.updatedAt ?? s.createdAt).getTime()
    if (t >= today)          groups["Сьогодні"].push(s)
    else if (t >= yesterday) groups["Вчора"].push(s)
    else if (t >= week)      groups["Цей тиждень"].push(s)
    else                     groups["Раніше"].push(s)
  }
  return Object.entries(groups)
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }))
}

// ─── New Chat Modal ───────────────────────────────────────────────

function NewChatModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (sessionId: string) => void
}) {
  const router = useRouter()
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)

  useEffect(() => {
    setAgents(agentStore.getAll())
    setProviders(providerStore.getAll())
  }, [])

  function getProvider(id: string) {
    return providers.find(p => p.id === id)
  }

  function handleCreate() {
    if (!selected) return
    const agent = agents.find(a => a.id === selected)
    if (!agent) return
    const session = chatStore.create(agent.id, `Чат з ${agent.name}`)
    onCreated(session.id)
  }

  const selectedAgent = agents.find(a => a.id === selected)
  const selectedProvider = selectedAgent ? getProvider(selectedAgent.providerId) : null
  const canCreate = !!selected && !!selectedProvider

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.80)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 520,
        borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        overflow: "hidden",
        maxHeight: "90vh",
        display: "flex", flexDirection: "column",
      }}>

        {/* Header */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 20px 14px",
          borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: T.t1 }}>Новий чат</div>
            <div style={{ fontSize: 11, color: T.t4, marginTop: 2 }}>Оберіть агента для розмови</div>
          </div>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer", color: T.t4, lineHeight: 0,
          }}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", padding: "14px 20px 20px", flex: 1 }}>

          {/* No providers warning */}
          {providers.length === 0 && (
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "11px 14px", borderRadius: 10, marginBottom: 14,
              background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)",
            }}>
              <AlertCircle size={14} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontSize: 12.5, color: "#FF4D6A", fontWeight: 500, marginBottom: 4 }}>
                  Немає API ключів
                </div>
                <div style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.5 }}>
                  Щоб агенти могли відповідати, потрібен API ключ.
                </div>
                <button onClick={() => { onClose(); router.push("/providers") }} style={{
                  marginTop: 8, fontSize: 11.5, color: T.red, background: "none", border: "none",
                  cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4,
                }}>
                  Додати API ключ <ArrowRight size={10} />
                </button>
              </div>
            </div>
          )}

          {/* No agents */}
          {agents.length === 0 ? (
            <div style={{ padding: "32px 0", textAlign: "center" }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16, margin: "0 auto 14px",
                background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Bot size={24} style={{ color: T.red, opacity: 0.7 }} />
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 6 }}>
                Немає агентів
              </div>
              <div style={{ fontSize: 12.5, color: T.t3, marginBottom: 18, lineHeight: 1.55 }}>
                Спочатку створіть AI агента з підключеним провайдером.
              </div>
              <button onClick={() => { onClose(); router.push("/agents") }} style={{
                display: "inline-flex", alignItems: "center", gap: 7,
                padding: "9px 20px", borderRadius: 9, border: "none",
                background: T.red, color: "#fff", fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}>
                <Plus size={14} /> Створити агента
              </button>
            </div>
          ) : (
            <>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
                Оберіть агента
              </div>

              {/* Agent cards */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {agents.map(agent => {
                  const prov    = getProvider(agent.providerId)
                  const active  = selected === agent.id
                  const noProv  = !prov

                  return (
                    <div
                      key={agent.id}
                      onClick={() => !noProv && setSelected(agent.id)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "12px 14px", borderRadius: 12,
                        cursor: noProv ? "not-allowed" : "pointer",
                        background: active
                          ? "linear-gradient(100deg,rgba(232,0,42,0.18) 0%,rgba(232,0,42,0.06) 100%)"
                          : "rgba(255,255,255,0.03)",
                        border: active
                          ? "1px solid rgba(232,0,42,0.38)"
                          : "0.5px solid rgba(255,255,255,0.08)",
                        boxShadow: active ? "0 0 18px rgba(232,0,42,0.12)" : "none",
                        opacity: noProv ? 0.5 : 1,
                        transition: "background 140ms ease, border-color 140ms ease",
                      }}
                      onMouseEnter={e => {
                        if (!noProv && !active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"
                      }}
                      onMouseLeave={e => {
                        if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"
                      }}
                    >
                      {/* Avatar */}
                      <div style={{
                        width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                        background: agent.avatarColor ?? T.red,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 16, fontWeight: 700, color: "#fff",
                        boxShadow: active ? `0 0 14px ${agent.avatarColor ?? T.red}50` : "none",
                      }}>
                        {agent.name.charAt(0).toUpperCase()}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 500, color: active ? T.t1 : T.t2, marginBottom: 3 }}>
                          {agent.name}
                        </div>
                        {agent.description && (
                          <div style={{ fontSize: 11.5, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 5 }}>
                            {agent.description}
                          </div>
                        )}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {prov ? (
                            <>
                              <span style={{
                                fontSize: 10.5, padding: "2px 7px", borderRadius: 5,
                                background: active ? "rgba(232,0,42,0.12)" : "rgba(255,255,255,0.05)",
                                border: `0.5px solid ${active ? "rgba(232,0,42,0.25)" : "rgba(255,255,255,0.08)"}`,
                                color: active ? T.t2 : T.t4,
                              }}>
                                {prov.name}
                              </span>
                              <span style={{
                                fontSize: 10.5, padding: "2px 7px", borderRadius: 5,
                                background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)",
                                color: T.t4,
                              }}>
                                {prov.model}
                              </span>
                              <span style={{
                                fontSize: 10.5, padding: "2px 7px", borderRadius: 5,
                                background: prov.isActive ? "rgba(34,197,94,0.09)" : "rgba(255,255,255,0.04)",
                                border: `0.5px solid ${prov.isActive ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.07)"}`,
                                color: prov.isActive ? T.green : T.t4,
                              }}>
                                {prov.isActive ? "Активний" : "Вимкнено"}
                              </span>
                            </>
                          ) : (
                            <span style={{
                              fontSize: 10.5, padding: "2px 7px", borderRadius: 5,
                              background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
                              color: "#FF4D6A", display: "flex", alignItems: "center", gap: 4,
                            }}>
                              <AlertCircle size={9} /> Провайдер не знайдено
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Radio indicator */}
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", flexShrink: 0,
                        border: active ? "2px solid rgba(232,0,42,0.8)" : "1.5px solid rgba(255,255,255,0.15)",
                        background: active ? "rgba(232,0,42,0.25)" : "transparent",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        transition: "all 140ms ease",
                      }}>
                        {active && <div style={{ width: 7, height: 7, borderRadius: "50%", background: T.red }} />}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {agents.length > 0 && (
          <div style={{
            padding: "12px 20px 16px",
            borderTop: "0.5px solid rgba(255,255,255,0.07)",
            display: "flex", gap: 10,
          }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)", color: T.t2,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
            >
              Скасувати
            </button>
            <button onClick={handleCreate} disabled={!canCreate} style={{
              flex: 2, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              cursor: canCreate ? "pointer" : "not-allowed",
              background: canCreate ? T.red : "rgba(232,0,42,0.12)",
              border: "none", color: canCreate ? "#fff" : "#FF4D6A",
              transition: "background 130ms ease",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}
              onMouseEnter={e => { if (canCreate) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (canCreate) (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              <MessageSquare size={14} />
              {canCreate
                ? `Почати чат з ${selectedAgent?.name}`
                : selected
                ? "Провайдер не підключено"
                : "Оберіть агента"
              }
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Session card ─────────────────────────────────────────────────

function SessionCard({ session, agent, onOpen, onDelete }: {
  session: ChatSession; agent?: Agent
  onOpen: () => void; onDelete: (e: React.MouseEvent) => void
}) {
  const last   = session.messages[session.messages.length - 1]
  const isUser = last?.role === "user"
  const count  = session.messages.length

  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 14,
      padding: "13px 16px", borderRadius: 12, cursor: "pointer",
      background: "transparent", border: "0.5px solid transparent",
      transition: "background 140ms ease, border-color 140ms ease",
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "rgba(255,255,255,0.04)"
        el.style.borderColor = "rgba(255,255,255,0.08)"
        const del = el.querySelector(".del-btn") as HTMLElement
        if (del) del.style.opacity = "1"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "transparent"
        el.style.borderColor = "transparent"
        const del = el.querySelector(".del-btn") as HTMLElement
        if (del) del.style.opacity = "0"
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: agent?.avatarColor ?? "rgba(232,0,42,0.12)",
        border: agent ? "none" : "0.5px solid rgba(232,0,42,0.22)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 15, fontWeight: 700, color: "#fff",
      }}>
        {agent
          ? agent.name.charAt(0).toUpperCase()
          : <MessageSquare size={16} style={{ color: T.red, opacity: 0.7 }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
          <span style={{ fontSize: 13, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 320 }}>
            {cut(session.title, 60)}
          </span>
          {agent && (
            <span style={{
              fontSize: 10, padding: "1px 6px", borderRadius: 4, flexShrink: 0,
              background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.08)", color: T.t4,
            }}>
              {agent.name}
            </span>
          )}
        </div>
        {last ? (
          <div style={{ fontSize: 11.5, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <span style={{ color: isUser ? T.t3 : T.t4, fontWeight: isUser ? 500 : 400 }}>
              {isUser ? "Ви: " : "AI: "}
            </span>
            {cut(last.content, 80)}
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: T.t4, fontStyle: "italic" }}>Порожня сесія</div>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: T.t4 }}>
          <Clock size={10} />
          {ago(last?.createdAt ?? session.createdAt)}
        </div>
        {count > 0 && (
          <span style={{
            fontSize: 10, padding: "1px 6px", borderRadius: 4,
            background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", color: T.t4,
          }}>
            {count}
          </span>
        )}
        <button className="del-btn" onClick={onDelete} style={{
          opacity: 0, padding: 4, borderRadius: 6, border: "none",
          background: "none", cursor: "pointer", lineHeight: 0,
          transition: "opacity 140ms ease, color 140ms ease", color: T.t4,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center", width: "100%",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <MessageSquare size={28} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Чатів ще немає</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 340, marginBottom: 28 }}>
        Оберіть агента і почніть розмову. Всі сесії зберігаються автоматично.
      </div>
      <button onClick={onNew} style={{
        display: "flex", alignItems: "center", gap: 7,
        background: T.red, color: "#fff", border: "none",
        borderRadius: 10, padding: "10px 22px",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
      >
        <Plus size={14} /> Новий чат
      </button>
      <div style={{ marginTop: 18, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.10em" }}>
        Chat Layer · AI Conversations
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ChatPage() {
  const router = useRouter()
  const [sessions,   setSessions]   = useState<ChatSession[]>([])
  const [agents,     setAgents]     = useState<Agent[]>([])
  const [search,     setSearch]     = useState("")
  const [showModal,  setShowModal]  = useState(false)
  const [pulse,      setPulse]      = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  function load() {
    const all = chatStore.getAll()
    const sorted = [...all].sort((a, b) => {
      const ta = new Date(a.updatedAt ?? a.createdAt).getTime()
      const tb = new Date(b.updatedAt ?? b.createdAt).getTime()
      return tb - ta
    })
    setSessions(sorted)
    setAgents(agentStore.getAll())
  }

  useEffect(() => { load() }, [])

  function getAgent(agentId: string) { return agents.find(a => a.id === agentId) }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (window.confirm("Видалити цю сесію?")) { chatStore.remove(id); load() }
  }

  const filtered = sessions.filter(s =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  )
  const groups = groupByDate(filtered)

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{
          position: "relative", padding: "36px 48px 28px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block",
                  opacity: pulse ? 1 : 0.3,
                  transition: "opacity 900ms ease, box-shadow 900ms ease",
                  boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Chat Layer · {sessions.length} сесій
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>Чати</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                AI Conversations · всі розмови з агентами в одному місці
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {agents.length === 0 && (
                <div onClick={() => router.push("/agents")} style={{
                  display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                  padding: "7px 12px", borderRadius: 9, fontSize: 12,
                  background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)", color: "#FF4D6A",
                }}>
                  Спочатку створіть агента
                </div>
              )}
              <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "background 130ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Plus size={14} /> Новий чат
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        {sessions.length === 0 ? (
          <EmptyState onNew={() => setShowModal(true)} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1100 }}>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              {[
                { label: "Всього сесій",  value: sessions.length,                                     icon: MessageSquare },
                { label: "Агентів",        value: agents.length,                                       icon: Bot           },
                { label: "Повідомлень",    value: sessions.reduce((s, c) => s + c.messages.length, 0), icon: Zap           },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 14px", borderRadius: 9, background: T.s1, border: `0.5px solid ${T.b1}`,
                }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: T.s1, border: `0.5px solid ${T.b1}`,
              borderRadius: 11, padding: "0 14px",
              marginBottom: 24, height: 42,
            }}>
              <Search size={15} style={{ color: T.t4, flexShrink: 0 }} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Пошук по чатах..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 2 }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Groups */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4 }}>Нічого не знайдено за "{search}"</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
                {groups.map(({ label, items }) => (
                  <div key={label}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                      <span style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.10em" }}>
                        {label}
                      </span>
                      <div style={{ flex: 1, height: "0.5px", background: "rgba(255,255,255,0.06)" }} />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {items.map(session => (
                        <SessionCard
                          key={session.id}
                          session={session}
                          agent={getAgent(session.agentId)}
                          onOpen={() => router.push(`/chat/${session.id}`)}
                          onDelete={e => handleDelete(e, session.id)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push(`/chat/${id}`) }}
        />
      )}
    </>
  )
}