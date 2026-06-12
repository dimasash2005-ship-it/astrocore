"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Bot, Trash2, MessageSquare,
  Settings, ChevronRight, Zap, Activity,
} from "lucide-react"
import {
  agentStore, providerStore, chatStore,
  type Agent, type Provider,
} from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  s3:    "#0E0E18",
  b1:    "rgba(255,255,255,0.10)",
  b2:    "rgba(255,255,255,0.16)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  red:   "#E8002A",
  green: "#22C55E",
}

const COLORS = [
  "#E8002A","#10A37F","#D97757",
  "#4285F4","#8B5CF6","#F59E0B",
  "#06B6D4","#EC4899",
]

function RBtn({ icon: Icon, label, onClick, small }: {
  icon: React.ElementType; label: string; onClick: () => void; small?: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: hov ? "#FF1A3E" : T.red, color: "#fff",
        border: "none", borderRadius: 9,
        padding: small ? "7px 14px" : "9px 18px",
        fontSize: small ? 12 : 13, fontWeight: 500, cursor: "pointer",
        transition: "background 130ms ease",
        boxShadow: hov ? "0 0 22px rgba(232,0,42,0.40)" : "none",
      }}>
      <Icon size={small ? 13 : 14} />{label}
    </button>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      {children}
    </div>
  )
}

function CreateAgentModal({ providers, onClose, onCreated }: {
  providers: Provider[]
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const [name, setName]           = useState("")
  const [desc, setDesc]           = useState("")
  const [providerId, setProvider] = useState(providers[0]?.id ?? "")
  const [prompt, setPrompt]       = useState("")
  const [color, setColor]         = useState(COLORS[0])
  const [error, setError]         = useState("")

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  function handleCreate() {
    if (!name.trim()) { setError("Введіть назву агента"); return }
    if (!providerId)  { setError("Оберіть провайдера"); return }
    const agent = agentStore.add({
      name: name.trim(), description: desc.trim(),
      providerId, systemPrompt: prompt.trim(), avatarColor: color,
    })
    onCreated(agent.id)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div style={{
        width: "100%", maxWidth: 460, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        padding: "24px 24px 20px",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={16} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>Новий агент</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Agent Layer</div>
          </div>
        </div>

        {/* color picker */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
            Колір аватара
          </label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {COLORS.map(c => (
              <button key={c} onClick={() => setColor(c)} style={{
                width: 26, height: 26, borderRadius: 7, background: c, border: "none", cursor: "pointer",
                outline: color === c ? "2px solid #fff" : "2px solid transparent",
                outlineOffset: 2, transition: "outline 120ms ease",
              }} />
            ))}
          </div>
          {/* live preview */}
          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "8px 12px", borderRadius: 9,
            background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)",
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, background: color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
            }}>
              {name ? name.charAt(0).toUpperCase() : "A"}
            </div>
            <span style={{ fontSize: 13, color: T.t2 }}>{name || "Назва агента"}</span>
          </div>
        </div>

        {/* fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Назва *
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Копірайтер, Аналітик, SEO..."
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Опис
            </label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Коротко — що вміє цей агент"
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Провайдер *
            </label>
            {providers.length === 0 ? (
              <div style={{
                padding: "9px 12px", borderRadius: 9, fontSize: 12,
                background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)",
                color: "#FF4D6A",
              }}>
                Спочатку додайте API ключ у{" "}
                <a href="/providers" style={{ textDecoration: "underline", color: T.red }}>Провайдерах</a>
              </div>
            ) : (
              <select value={providerId} onChange={e => setProvider(e.target.value)}
                style={{ ...inp, cursor: "pointer" }}>
                {providers.map(p => (
                  <option key={p.id} value={p.id} style={{ background: "#111118" }}>
                    {p.name} — {p.model}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Системний промпт
            </label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Ти — досвідчений AI агент. Відповідай чітко і по суті..."
              rows={4}
              style={{ ...inp, resize: "vertical", lineHeight: 1.55 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)",
              color: T.t2, transition: "background 120ms ease",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
            >
              Скасувати
            </button>
            <button onClick={handleCreate} disabled={providers.length === 0} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              cursor: providers.length === 0 ? "not-allowed" : "pointer",
              background: providers.length === 0 ? "rgba(232,0,42,0.3)" : T.red,
              border: "none", color: "#fff", transition: "background 130ms ease",
            }}
              onMouseEnter={e => { if (providers.length > 0) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (providers.length > 0) (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              Створити агента
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function AgentCard({ agent, provider, sessionCount, onChat, onOpen, onDelete }: {
  agent: Agent; provider?: Provider; sessionCount: number
  onChat: (e: React.MouseEvent) => void
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  const [hov, setHov] = useState(false)

  return (
    <div onClick={onOpen}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? "linear-gradient(160deg,#14142A 0%,#0F0F1E 100%)"
          : "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
        border: `0.5px solid ${hov ? "rgba(232,0,42,0.28)" : "rgba(255,255,255,0.09)"}`,
        borderRadius: 14, padding: "18px 18px 14px",
        cursor: "pointer",
        transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
        boxShadow: hov ? "0 0 28px rgba(232,0,42,0.08)" : "none",
        display: "flex", flexDirection: "column", gap: 12,
        position: "relative", overflow: "hidden",
      }}>

      {/* subtle top glow on hover */}
      {hov && (
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 60,
          background: "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(232,0,42,0.07) 0%,transparent 100%)",
          pointerEvents: "none",
        }} />
      )}

      {/* top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: agent.avatarColor ?? T.red,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff",
            boxShadow: `0 0 16px ${agent.avatarColor ?? T.red}40`,
          }}>
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 2 }}>
              {agent.name}
            </div>
            {agent.description && (
              <div style={{ fontSize: 11.5, color: T.t3, lineHeight: 1.4 }}>
                {agent.description}
              </div>
            )}
          </div>
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 4, opacity: hov ? 1 : 0, transition: "opacity 150ms ease" }}>
          <button onClick={e => { e.stopPropagation(); onOpen() }}
            style={{ padding: "5px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}>
            <Settings size={13} />
          </button>
          <button onClick={onDelete}
            style={{ padding: "5px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* badges */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {provider ? (
          <>
            <span style={{
              fontSize: 10.5, padding: "3px 8px", borderRadius: 6,
              background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)",
              color: T.t2,
            }}>
              {provider.name}
            </span>
            <span style={{
              fontSize: 10.5, padding: "3px 8px", borderRadius: 6,
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)",
              color: T.t3,
            }}>
              {provider.model}
            </span>
          </>
        ) : (
          <span style={{
            fontSize: 10.5, padding: "3px 8px", borderRadius: 6,
            background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
            color: "#FF4D6A",
          }}>
            Провайдер не знайдено
          </span>
        )}
        {sessionCount > 0 && (
          <span style={{
            fontSize: 10.5, padding: "3px 8px", borderRadius: 6,
            background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)",
            color: T.t3, display: "flex", alignItems: "center", gap: 4,
          }}>
            <MessageSquare size={9} />{sessionCount} сесій
          </span>
        )}
      </div>

      {/* system prompt preview */}
      {agent.systemPrompt && (
        <div style={{
          fontSize: 11, color: T.t3, lineHeight: 1.5,
          padding: "7px 10px", borderRadius: 8,
          background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
          fontStyle: "italic",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          "{agent.systemPrompt}"
        </div>
      )}

      {/* chat button */}
      <button onClick={onChat} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        height: 36, borderRadius: 9, fontSize: 12.5, fontWeight: 500,
        background: hov ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.04)",
        border: hov ? "0.5px solid rgba(232,0,42,0.30)" : "0.5px solid rgba(255,255,255,0.08)",
        color: hov ? "#FF6680" : T.t2,
        cursor: "pointer", transition: "all 150ms ease",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.20)"
          ;(e.currentTarget as HTMLElement).style.color = "#fff"
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = hov ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.04)"
          ;(e.currentTarget as HTMLElement).style.color = hov ? "#FF6680" : T.t2
        }}>
        <MessageSquare size={13} />
        Розпочати чат
      </button>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.08)",
      }}>
        <Bot size={30} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>
        Агентів ще немає
      </div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
        Створіть першого AI агента. Задайте йому ім'я, особистість та системний промпт.
      </div>
      <RBtn icon={Plus} label="Створити агента" onClick={onAdd} />
      <div style={{ marginTop: 16, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        AI Agent Layer · Workspace Agents
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const router = useRouter()
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [sessions,  setSessions]  = useState<ReturnType<typeof chatStore.getAll>>([])
  const [showModal, setShowModal] = useState(false)
  const [pulse,     setPulse]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  function refresh() {
    setAgents(agentStore.getAll())
    setProviders(providerStore.getAll())
    setSessions(chatStore.getAll())
  }

  useEffect(() => { refresh() }, [])

  function handleChat(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation()
    const session = chatStore.create(agent.id, `Чат з ${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const agent = agents.find(a => a.id === id)
    if (!agent) return
    if (window.confirm(`Видалити агента "${agent.name}"?`)) {
      agentStore.remove(id)
      refresh()
    }
  }

  function handleCreated(agentId: string) {
    refresh()
    router.push(`/agents/${agentId}`)
  }

  function getProvider(id: string) { return providers.find(p => p.id === id) }
  function getSessionCount(id: string) { return sessions.filter(s => s.agentId === id).length }

  const allProviders = providers

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>

        {/* animated scan line */}
        <div aria-hidden style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{
          position: "relative",
          padding: "36px 48px 30px",
          borderBottom: `0.5px solid ${T.b1}`,
          overflow: "hidden",
        }}>
          <div aria-hidden style={{
            position: "absolute", bottom: -1, left: 0, right: 0, height: 1,
            background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)",
            pointerEvents: "none",
          }} />
          <div aria-hidden style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 300,
            background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)",
            pointerEvents: "none",
          }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              {/* status badge */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.red,
                  display: "inline-block",
                  transition: "box-shadow 900ms ease, opacity 900ms ease",
                  opacity: pulse ? 1 : 0.3,
                  boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Agent Control · {agents.length} активних
                </span>
              </div>

              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>
                Агенти
              </h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                Workspace Agents · AI Agent Layer · ваші персональні AI помічники
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {allProviders.length === 0 && (
                <div onClick={() => router.push("/providers")} style={{
                  display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                  padding: "7px 12px", borderRadius: 9, fontSize: 12,
                  background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)",
                  color: "#FF4D6A",
                }}>
                  <Zap size={12} /> Додайте API ключ
                </div>
              )}
              <RBtn icon={Plus} label="Новий агент" onClick={() => setShowModal(true)} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 48px 56px", maxWidth: 1560 }}>

          {/* stats row */}
          {agents.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { label: "Всього агентів",  value: agents.length,                                icon: Bot },
                { label: "Активні сесії",   value: sessions.length,                              icon: MessageSquare },
                { label: "Провайдери",       value: providers.length,                             icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px", borderRadius: 10,
                  background: T.s1, border: `0.5px solid ${T.b1}`,
                }}>
                  <Icon size={14} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {/* agents grid */}
          {agents.length === 0 ? (
            <EmptyState onAdd={() => setShowModal(true)} />
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 14,
            }}>
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  provider={getProvider(agent.providerId)}
                  sessionCount={getSessionCount(agent.id)}
                  onChat={e => handleChat(e, agent)}
                  onOpen={() => router.push(`/agents/${agent.id}`)}
                  onDelete={e => handleDelete(e, agent.id)}
                />
              ))}

              {/* add card */}
              <div onClick={() => setShowModal(true)} style={{
                borderRadius: 14, padding: "18px",
                border: "0.5px dashed rgba(232,0,42,0.22)",
                background: "rgba(232,0,42,0.03)",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: 160, transition: "background 150ms ease, border-color 150ms ease",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.07)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.40)"
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.03)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.22)"
                }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Plus size={18} style={{ color: T.red }} />
                </div>
                <span style={{ fontSize: 12.5, color: T.t3 }}>Додати агента</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateAgentModal
          providers={allProviders}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}