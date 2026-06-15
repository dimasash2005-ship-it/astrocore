"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, MessageSquare, Trash2, Save,
  Plus, Clock, Edit3, X, Check, AlertCircle,
  ChevronRight, Bot,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { chatStore, type ChatSession } from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  b1:   "rgba(255,255,255,0.10)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
  green:"#22C55E",
}

const AVATAR_COLORS = [
  "#E8002A","#10A37F","#D97757",
  "#4285F4","#8B5CF6","#F59E0B",
  "#06B6D4","#EC4899",
]

type Agent = {
  id: string
  user_id: string
  name: string
  description: string
  provider_id: string | null
  system_prompt: string
  avatar_color: string
  created_at: string
}

type Provider = {
  id: string
  name: string
  slug: string
  model: string
  is_active: boolean
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: T.t1, outline: "none", width: "100%",
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)"
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"
}

function formatTime(iso: string): string {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return "щойно"
  if (m < 60) return `${m} хв тому`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} год тому`
  const dy = Math.floor(h / 24)
  if (dy === 1) return "вчора"
  if (dy < 7)  return `${dy}д тому`
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
}

function Card({ title, icon: Icon, children, action, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode
  action?: React.ReactNode; accent?: boolean
}) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.20)" : T.b1}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 18px 11px", borderBottom: `0.5px solid ${T.b1}`,
        background: accent ? "rgba(232,0,42,0.04)" : "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={13} style={{ color: accent ? T.red : T.t4 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
            {title}
          </span>
        </div>
        {action}
      </div>
      <div style={{ padding: "18px 18px" }}>{children}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.t2 }}>{value || "—"}</div>
    </div>
  )
}

function EditForm({ agent, providers, onSaved, onCancel }: {
  agent: Agent; providers: Provider[]; onSaved: () => void; onCancel: () => void
}) {
  const [name,         setName]         = useState(agent.name)
  const [description,  setDescription]  = useState(agent.description ?? "")
  const [providerId,   setProviderId]   = useState(agent.provider_id ?? "")
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt ?? "")
  const [avatarColor,  setAvatarColor]  = useState(agent.avatar_color ?? AVATAR_COLORS[0])
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)

  async function handleSave() {
    if (!name.trim()) { setError("Назва не може бути порожньою"); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { error: dbErr } = await sb.from("agents").update({
      name:          name.trim(),
      description:   description.trim(),
      provider_id:   providerId || null,
      system_prompt: systemPrompt.trim(),
      avatar_color:  avatarColor,
    }).eq("id", agent.id)

    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); onSaved() }, 1200)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
          Колір аватара
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {AVATAR_COLORS.map(c => (
            <button key={c} onClick={() => setAvatarColor(c)} style={{
              width: 28, height: 28, borderRadius: 8, background: c, border: "none", cursor: "pointer",
              outline: avatarColor === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2,
            }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {name ? name.charAt(0).toUpperCase() : "A"}
          </div>
          <span style={{ fontSize: 13, color: T.t2 }}>{name || "Назва агента"}</span>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Назва *</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inp} onFocus={focusBorder} onBlur={blurBorder} />
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Опис</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Коротко — що вміє цей агент" style={inp} onFocus={focusBorder} onBlur={blurBorder} />
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Провайдер</label>
        {providers.length === 0 ? (
          <div style={{ padding: "9px 12px", borderRadius: 9, fontSize: 12, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)", color: "#FF4D6A" }}>
            Немає провайдерів. <a href="/providers" style={{ textDecoration: "underline", color: T.red }}>Додайте API ключ</a>
          </div>
        ) : (
          <select value={providerId} onChange={e => setProviderId(e.target.value)} style={{ ...inp, cursor: "pointer" }} onFocus={focusBorder} onBlur={blurBorder}>
            <option value="">— не вибрано —</option>
            {providers.map(p => (
              <option key={p.id} value={p.id} style={{ background: "#111118" }}>{p.name} — {p.model}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Системний промпт</label>
        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
          placeholder="Ти — досвідчений AI агент. Відповідай чітко і по суті..."
          rows={5} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
          onFocus={focusBorder} onBlur={blurBorder} />
        <div style={{ fontSize: 11, color: T.t4, marginTop: 5 }}>Визначає поведінку агента. Зміни застосовуються до нових сесій.</div>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)", display: "flex", alignItems: "center", gap: 7 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
      {saved && (
        <div style={{ fontSize: 12, color: T.green, padding: "7px 10px", borderRadius: 7, background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.22)", display: "flex", alignItems: "center", gap: 7 }}>
          <Check size={12} /> Зміни збережено
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
        >Скасувати</button>
        <button onClick={handleSave} disabled={loading} style={{
          flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "rgba(232,0,42,0.3)" : T.red, border: "none", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
        >
          <Save size={13} /> {loading ? "Зберігаємо..." : "Зберегти зміни"}
        </button>
      </div>
    </div>
  )
}

function SessionList({ sessions, onOpen, onDelete }: {
  sessions: ChatSession[]; onOpen: (id: string) => void; onDelete: (id: string) => void
}) {
  if (sessions.length === 0) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center" }}>
        <MessageSquare size={22} style={{ color: "#252540", margin: "0 auto 8px" }} />
        <div style={{ fontSize: 12, color: T.t4 }}>Чат-сесій ще немає</div>
        <div style={{ fontSize: 11, color: "#2E2E4A", marginTop: 4 }}>Натисніть «Новий чат» вгорі щоб розпочати</div>
      </div>
    )
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sessions.map(session => {
        const lastMsg = session.messages[session.messages.length - 1]
        const preview = lastMsg
          ? (lastMsg.role === "user" ? "Ви: " : "AI: ") + lastMsg.content.slice(0, 72)
          : "Порожня сесія"
        const time = lastMsg?.createdAt ?? session.createdAt
        return (
          <div key={session.id}
            onClick={() => onOpen(session.id)}
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, cursor: "pointer", background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)", transition: "background 130ms ease" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"
              const del = (e.currentTarget as HTMLElement).querySelector(".del-btn") as HTMLElement
              if (del) del.style.opacity = "1"
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"
              const del = (e.currentTarget as HTMLElement).querySelector(".del-btn") as HTMLElement
              if (del) del.style.opacity = "0"
            }}
          >
            <MessageSquare size={13} style={{ color: T.t4, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</div>
              <div style={{ fontSize: 11, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{preview}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: T.t4 }}>
                <Clock size={9} />{formatTime(time)}
              </div>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", color: T.t4 }}>
                {session.messages.length}
              </span>
              <button className="del-btn"
                onClick={e => { e.stopPropagation(); if (window.confirm("Видалити цю сесію?")) onDelete(session.id) }}
                style={{ opacity: 0, padding: 4, borderRadius: 5, border: "none", background: "none", cursor: "pointer", color: T.t4, lineHeight: 0, transition: "opacity 130ms ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
              >
                <Trash2 size={12} />
              </button>
              <ChevronRight size={12} style={{ color: T.t4 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DangerZone({ agentName, onDelete }: { agentName: string; onDelete: () => void }) {
  const [confirming, setConfirming] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const isMatch = inputValue.trim() === agentName.trim()

  if (!confirming) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 3 }}>Видалити агента</div>
          <div style={{ fontSize: 11.5, color: T.t4 }}>Агент буде видалений назавжди. Чат-сесії залишаться.</div>
        </div>
        <button onClick={() => setConfirming(true)} style={{
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          padding: "7px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", color: "#FF4D6A",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.16)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)" }}
        >
          <Trash2 size={12} /> Видалити
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.20)" }}>
        <div style={{ fontSize: 12, color: "#FF4D6A", marginBottom: 8 }}>Для підтвердження введіть назву агента:</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{agentName}</div>
        <input value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder="Введіть назву..." autoFocus
          style={{ ...inp, borderColor: isMatch ? "rgba(34,197,94,0.4)" : "rgba(232,0,42,0.3)" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setConfirming(false); setInputValue("") }} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2,
        }}>Скасувати</button>
        <button onClick={onDelete} disabled={!isMatch} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          cursor: isMatch ? "pointer" : "not-allowed",
          background: isMatch ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.03)",
          border: `0.5px solid ${isMatch ? "rgba(232,0,42,0.30)" : "rgba(255,255,255,0.06)"}`,
          color: isMatch ? "#FF4D6A" : T.t4,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Trash2 size={12} /> Підтвердити видалення
        </button>
      </div>
    </div>
  )
}

export default function AgentDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const agentId = params.agentId as string

  const [agent,        setAgent]        = useState<Agent | null>(null)
  const [provider,     setProvider]     = useState<Provider | undefined>()
  const [allProviders, setAllProviders] = useState<Provider[]>([])
  const [sessions,     setSessions]     = useState<ChatSession[]>([])
  const [isEditing,    setIsEditing]    = useState(false)
  const [notFound,     setNotFound]     = useState(false)
  const [pulse,        setPulse]        = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  const loadData = useCallback(async () => {
    const sb = getSupabase()
    const [{ data: agentData }, { data: providersData }] = await Promise.all([
      sb.from("agents").select("*").eq("id", agentId).single(),
      sb.from("providers").select("id,name,slug,model,is_active"),
    ])

    if (!agentData) { setNotFound(true); return }
    setAgent(agentData as Agent)
    setAllProviders((providersData ?? []) as Provider[])
    if (agentData.provider_id) {
      setProvider((providersData ?? []).find((p: Provider) => p.id === agentData.provider_id))
    }
    setSessions(chatStore.getAll().filter(s => s.agentId === agentId))
  }, [agentId])

  useEffect(() => { loadData() }, [loadData])

  function handleNewChat() {
    if (!agent) return
    const session = chatStore.create(agent.id, `Чат з ${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  function handleSaved() { setIsEditing(false); loadData() }
  function handleDeleteSession(id: string) { chatStore.remove(id); loadData() }

  async function handleDeleteAgent() {
    if (!agent) return
    const sb = getSupabase()
    await sb.from("agents").delete().eq("id", agent.id)
    router.push("/agents")
  }

  if (notFound) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={26} style={{ color: T.red, opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Агента не знайдено</div>
          <div style={{ fontSize: 13, color: T.t3, marginBottom: 22 }}>Можливо, він був видалений</div>
          <button onClick={() => router.push("/agents")} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>
            <ArrowLeft size={14} /> Повернутись до агентів
          </button>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, padding: "36px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          {[120, 280, 200].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: T.s1, border: `0.5px solid ${T.b1}` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(200%);opacity:0}
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
        <div style={{ position: "relative", padding: "32px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <button onClick={() => router.push("/agents")} style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 20,
              fontSize: 12, color: T.t4, background: "none", border: "none", cursor: "pointer",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
            >
              <ArrowLeft size={13} /> Всі агенти
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                  background: agent.avatar_color ?? T.red,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, color: "#fff",
                  boxShadow: `0 0 20px ${agent.avatar_color ?? T.red}40`,
                }}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                    borderRadius: 20, padding: "2px 8px", marginBottom: 6,
                  }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: "50%", background: T.red, display: "inline-block",
                      opacity: pulse ? 1 : 0.3,
                      transition: "opacity 900ms ease, box-shadow 900ms ease",
                      boxShadow: pulse ? "0 0 5px rgba(232,0,42,1)" : "none",
                    }} />
                    <span style={{ fontSize: 9.5, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      AI Agent · Active
                    </span>
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{agent.name}</h1>
                  {agent.description && (
                    <p style={{ fontSize: 13, color: T.t3, margin: "4px 0 0" }}>{agent.description}</p>
                  )}
                </div>
              </div>
              <button onClick={handleNewChat} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
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
        <div style={{ padding: "24px 48px 56px", maxWidth: 900 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Overview */}
            <div style={{
              background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
              border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: "18px 20px",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20,
            }}>
              <InfoRow label="Провайдер" value={provider ? provider.name : "Не знайдено"} />
              <InfoRow label="Модель"    value={provider ? provider.model : "—"} />
              <InfoRow label="Сесій"     value={`${sessions.length} чатів`} />
            </div>

            {/* Settings */}
            <Card title="Налаштування агента" icon={Bot}
              action={
                !isEditing ? (
                  <button onClick={() => setIsEditing(true)} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", opacity: 0.8,
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8" }}
                  >
                    <Edit3 size={11} /> Редагувати
                  </button>
                ) : undefined
              }
            >
              {isEditing ? (
                <EditForm agent={agent} providers={allProviders} onSaved={handleSaved} onCancel={() => setIsEditing(false)} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: agent.avatar_color ?? T.red, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: T.t3 }}>{agent.avatar_color ?? "—"}</span>
                  </div>
                  <Divider />
                  <InfoRow label="Назва" value={agent.name} />
                  <Divider />
                  <InfoRow label="Опис" value={agent.description || "—"} />
                  <Divider />
                  <InfoRow label="Провайдер" value={provider ? `${provider.name} — ${provider.model}` : "Провайдер не знайдено"} />
                  {agent.system_prompt && (
                    <>
                      <Divider />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>Системний промпт</div>
                        <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.65, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {agent.system_prompt}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* Sessions */}
            <Card title={`Чат-сесії (${sessions.length})`} icon={MessageSquare}
              action={
                <button onClick={handleNewChat} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", opacity: 0.8,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8" }}
                >
                  <Plus size={11} /> Новий чат
                </button>
              }
            >
              <SessionList sessions={sessions} onOpen={id => router.push(`/chat/${id}`)} onDelete={handleDeleteSession} />
            </Card>

            {/* Danger */}
            <Card title="Небезпечна зона" icon={Trash2} accent>
              <DangerZone agentName={agent.name} onDelete={handleDeleteAgent} />
            </Card>

          </div>
        </div>
      </div>
    </>
  )
}