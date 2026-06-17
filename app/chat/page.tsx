"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare, Plus, Bot, Clock, Search,
  Trash2, X, AlertCircle, ArrowRight,
  Edit3, ChevronDown, Zap,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
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

type Session = {
  id: string
  user_id: string
  agent_id: string | null
  title: string
  created_at: string
  updated_at: string
}

type Agent = {
  id: string
  name: string
  avatar_color: string
  provider_id: string | null
}

type Provider = {
  id: string
  name: string
  model: string
  is_active: boolean
}

type MessageCount = { session_id: string; count: number }

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

// ─── Rename modal ─────────────────────────────────────────────────

function RenameModal({ session, onClose, onRenamed }: {
  session: Session; onClose: () => void; onRenamed: (id: string, title: string) => void
}) {
  const [title,   setTitle]   = useState(session.title)
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!title.trim()) return
    setLoading(true)
    const sb = getSupabase()
    const { error } = await sb
      .from("chat_sessions")
      .update({ title: title.trim() })
      .eq("id", session.id)
    if (!error) {
      onRenamed(session.id, title.trim())
      onClose()
    }
    setLoading(false)
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 200,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div style={{
        width: "100%", maxWidth: 400, borderRadius: 14,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
        padding: "20px",
      }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 14 }}>Перейменувати чат</div>
        <input value={title} onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") onClose() }}
          autoFocus
          style={{
            width: "100%", background: "#09090F",
            border: "0.5px solid rgba(232,0,42,0.4)",
            borderRadius: 9, padding: "9px 12px", fontSize: 13,
            color: T.t1, outline: "none", marginBottom: 14,
          }}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12.5, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2 }}>
            Скасувати
          </button>
          <button onClick={save} disabled={loading || !title.trim()} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: T.red, border: "none", color: "#fff" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
          >
            {loading ? "Зберігаємо..." : "Зберегти"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New Chat Modal ───────────────────────────────────────────────

function NewChatModal({ onClose, onCreated }: {
  onClose: () => void; onCreated: (id: string) => void
}) {
  const router = useRouter()
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [selected,  setSelected]  = useState<string | null>(null)
  const [loading,   setLoading]   = useState(false)

  useEffect(() => {
    async function load() {
      const sb = getSupabase()
      const [{ data: a }, { data: p }] = await Promise.all([
        sb.from("agents").select("id,name,avatar_color,provider_id").order("created_at"),
        sb.from("providers").select("id,name,model,is_active"),
      ])
      if (a) setAgents(a as Agent[])
      if (p) setProviders(p as Provider[])
    }
    load()
  }, [])

  function getProv(id: string | null) { return providers.find(p => p.id === id) }

  async function handleCreate() {
    if (!selected) return
    const agent = agents.find(a => a.id === selected)
    if (!agent) return
    setLoading(true)
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data, error } = await sb.from("chat_sessions").insert({
      user_id: user.id, agent_id: agent.id, title: `Чат з ${agent.name}`,
    }).select().single()
    if (error || !data) { setLoading(false); return }
    onCreated(data.id)
  }

  const selAgent = agents.find(a => a.id === selected)
  const canCreate = !!selected && !!getProv(selAgent?.provider_id ?? null)

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.80)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{
        width: "100%", maxWidth: 500, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 13px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>Новий чат</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.06)", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "14px 20px 20px", flex: 1 }}>
          {providers.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 9, marginBottom: 12, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
              <AlertCircle size={13} style={{ color: T.red, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: "#FF4D6A" }}>Немає API ключів. </span>
                <button onClick={() => { onClose(); router.push("/providers") }} style={{ fontSize: 12, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Додати
                </button>
              </div>
            </div>
          )}

          {agents.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center" }}>
              <Bot size={22} style={{ color: T.red, opacity: 0.6, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, marginBottom: 14 }}>Немає агентів</div>
              <button onClick={() => { onClose(); router.push("/agents") }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "none", background: T.red, color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                <Plus size={13} /> Створити агента
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>Оберіть агента</div>
              {agents.map(agent => {
                const prov   = getProv(agent.provider_id)
                const active = selected === agent.id
                const noProv = !prov
                return (
                  <div key={agent.id}
                    onClick={() => !noProv && setSelected(agent.id)}
                    style={{
                      display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", borderRadius: 11,
                      cursor: noProv ? "not-allowed" : "pointer", opacity: noProv ? 0.5 : 1,
                      background: active ? "rgba(232,0,42,0.14)" : "rgba(255,255,255,0.03)",
                      border: active ? "1px solid rgba(232,0,42,0.35)" : "0.5px solid rgba(255,255,255,0.08)",
                    }}
                    onMouseEnter={e => { if (!noProv && !active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                  >
                    <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: agent.avatar_color ?? T.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 700, color: "#fff" }}>
                      {agent.name.charAt(0).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: active ? T.t1 : T.t2 }}>{agent.name}</div>
                      <div style={{ display: "flex", gap: 5, marginTop: 3 }}>
                        {prov ? (
                          <>
                            <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.05)", color: T.t4 }}>{prov.name}</span>
                            <span style={{ fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: T.t4 }}>{prov.model}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 10.5, color: "#FF4D6A" }}>Провайдер не знайдено</span>
                        )}
                      </div>
                    </div>
                    <div style={{ width: 16, height: 16, borderRadius: "50%", border: active ? "2px solid rgba(232,0,42,0.8)" : "1.5px solid rgba(255,255,255,0.15)", background: active ? "rgba(232,0,42,0.25)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {active && <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.red }} />}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {agents.length > 0 && (
          <div style={{ padding: "11px 20px 15px", borderTop: "0.5px solid rgba(255,255,255,0.07)", display: "flex", gap: 9 }}>
            <button onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2 }}>
              Скасувати
            </button>
            <button onClick={handleCreate} disabled={!canCreate || loading} style={{
              flex: 2, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              cursor: canCreate && !loading ? "pointer" : "not-allowed",
              background: canCreate && !loading ? T.red : "rgba(232,0,42,0.12)",
              border: "none", color: canCreate && !loading ? "#fff" : "#FF4D6A",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
            }}
              onMouseEnter={e => { if (canCreate && !loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (canCreate && !loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              <MessageSquare size={13} />
              {loading ? "Створюємо..." : canCreate ? `Чат з ${selAgent?.name}` : "Оберіть агента"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Session card ─────────────────────────────────────────────────

function SessionCard({ session, agent, provider, msgCount, onOpen, onDelete, onRename }: {
  session: Session; agent?: Agent; provider?: Provider; msgCount: number
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
  onRename: (e: React.MouseEvent) => void
}) {
  return (
    <div onClick={onOpen} style={{
      display: "flex", alignItems: "center", gap: 13, padding: "11px 14px", borderRadius: 12,
      cursor: "pointer", background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)",
      transition: "background 130ms ease, border-color 130ms ease",
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "rgba(255,255,255,0.05)"
        el.style.borderColor = "rgba(255,255,255,0.10)";
        (el.querySelector(".actions") as HTMLElement | null)?.style.setProperty("opacity", "1")
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "rgba(255,255,255,0.02)"
        el.style.borderColor = "rgba(255,255,255,0.06)";
        (el.querySelector(".actions") as HTMLElement | null)?.style.setProperty("opacity", "0")
      }}
    >
      <div style={{
        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
        background: agent?.avatar_color ?? "rgba(232,0,42,0.12)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color: "#fff",
      }}>
        {agent ? agent.name.charAt(0).toUpperCase() : <MessageSquare size={15} style={{ color: T.red, opacity: 0.7 }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 3 }}>
          {cut(session.title, 60)}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
          {agent && <span style={{ fontSize: 11, color: T.t4 }}>{agent.name}</span>}
          {provider && <>
            <span style={{ fontSize: 11, color: "#252540" }}>·</span>
            <span style={{ fontSize: 11, color: T.t4 }}>{provider.model}</span>
          </>}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10.5, color: T.t4 }}>
          <Clock size={10} />
          {ago(session.updated_at ?? session.created_at)}
        </div>
        {msgCount > 0 && (
          <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", color: T.t4 }}>
            {msgCount}
          </span>
        )}
        <div className="actions" style={{ display: "flex", gap: 2, opacity: 0, transition: "opacity 130ms ease" }}>
          <button onClick={onRename} title="Перейменувати" style={{ padding: 5, borderRadius: 6, border: "none", background: "none", cursor: "pointer", lineHeight: 0, color: T.t4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}>
            <Edit3 size={12} />
          </button>
          <button onClick={onDelete} title="Видалити" style={{ padding: 5, borderRadius: 6, border: "none", background: "none", cursor: "pointer", lineHeight: 0, color: T.t4 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

type SortOpt = "newest" | "oldest" | "title"
type DateFilter = "all" | "today" | "week" | "month"

export default function ChatPage() {
  const router = useRouter()

  const [sessions,     setSessions]     = useState<Session[]>([])
  const [agents,       setAgents]       = useState<Agent[]>([])
  const [providers,    setProviders]    = useState<Provider[]>([])
  const [msgCounts,    setMsgCounts]    = useState<Record<string, number>>({})
  const [loaded,       setLoaded]       = useState(false)

  const [search,       setSearch]       = useState("")
  const [agentFilter,  setAgentFilter]  = useState<string | null>(null)
  const [provFilter,   setProvFilter]   = useState<string | null>(null)
  const [dateFilter,   setDateFilter]   = useState<DateFilter>("all")
  const [sort,         setSort]         = useState<SortOpt>("newest")

  const [showModal,    setShowModal]    = useState(false)
  const [renameTarget, setRenameTarget] = useState<Session | null>(null)
  const [pulse,        setPulse]        = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    try {
      const sb = getSupabase()

      // 1. Get user
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return

      // 2. Load all data in parallel with simple separate queries
      const [
        { data: sessData },
        { data: agentsData },
        { data: provsData },
      ] = await Promise.all([
        sb.from("chat_sessions")
          .select("id,user_id,agent_id,title,created_at,updated_at")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        sb.from("agents")
          .select("id,name,avatar_color,provider_id")
          .eq("user_id", user.id),
        sb.from("providers")
          .select("id,name,model,is_active")
          .eq("user_id", user.id),
      ])

      setSessions((sessData ?? []) as Session[])
      setAgents((agentsData ?? []) as Agent[])
      setProviders((provsData ?? []) as Provider[])

      // 3. Load message counts per session (batch)
      if (sessData && sessData.length > 0) {
        const counts: Record<string, number> = {}
        await Promise.all(
          sessData.map(async s => {
            const { count } = await sb
              .from("chat_messages")
              .select("id", { count: "exact", head: true })
              .eq("session_id", s.id)
            counts[s.id] = count ?? 0
          })
        )
        setMsgCounts(counts)
      }
    } catch (err) {
      console.error("Chat page load error:", err)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => { load() }, [])

  function getAgent(id: string | null)    { return agents.find(a => a.id === id) }
  function getProvider(id: string | null) { return providers.find(p => p.id === id) }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm("Видалити цю сесію?")) return
    const sb = getSupabase()
    await sb.from("chat_sessions").delete().eq("id", id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  // ── Filtering + sorting ──

  const agentsWithSessions = useMemo(() => {
    const ids = new Set(sessions.map(s => s.agent_id).filter(Boolean))
    return agents.filter(a => ids.has(a.id))
  }, [sessions, agents])

  const provsWithSessions = useMemo(() => {
    const provIds = new Set(
      sessions.map(s => getAgent(s.agent_id)?.provider_id).filter(Boolean)
    )
    return providers.filter(p => provIds.has(p.id))
  }, [sessions, agents, providers])

  const now   = Date.now()
  const DAY   = 86400000
  const WEEK  = DAY * 7
  const MONTH = DAY * 30

  const filtered = useMemo(() => {
    let result = [...sessions]

    // search
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s => {
        const agent = getAgent(s.agent_id)
        return s.title.toLowerCase().includes(q) ||
          (agent?.name ?? "").toLowerCase().includes(q)
      })
    }

    // agent filter
    if (agentFilter) {
      result = result.filter(s => s.agent_id === agentFilter)
    }

    // provider filter
    if (provFilter) {
      result = result.filter(s => {
        const agent = getAgent(s.agent_id)
        return agent?.provider_id === provFilter
      })
    }

    // date filter
    if (dateFilter !== "all") {
      result = result.filter(s => {
        const t = new Date(s.updated_at ?? s.created_at).getTime()
        if (dateFilter === "today") return now - t < DAY
        if (dateFilter === "week")  return now - t < WEEK
        if (dateFilter === "month") return now - t < MONTH
        return true
      })
    }

    // sort
    result.sort((a, b) => {
      if (sort === "newest") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      if (sort === "oldest") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      if (sort === "title")  return a.title.localeCompare(b.title, "uk")
      return 0
    })

    return result
  }, [sessions, search, agentFilter, provFilter, dateFilter, sort, agents])

  const hasFilters = !!search || !!agentFilter || !!provFilter || dateFilter !== "all"

  function clearFilters() {
    setSearch("")
    setAgentFilter(null)
    setProvFilter(null)
    setDateFilter("all")
    setSort("newest")
  }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0}
        }
        select option { background: #111118; }
      `}</style>

      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px" }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "3px 10px", marginBottom: 14 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block", opacity: pulse ? 1 : 0.3, transition: "opacity 900ms ease, box-shadow 900ms ease", boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none" }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Chat Layer · {sessions.length} сесій
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>Чати</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>AI Conversations · всі розмови з агентами</p>
            </div>
            <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: T.red, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              <Plus size={14} /> Новий чат
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {!loaded ? (
          <div style={{ padding: "64px 48px", textAlign: "center" }}>
            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, opacity: 0.5, animation: "dot 1.2s ease infinite", animationDelay: `${i*0.2}s` }} />
              ))}
            </div>
            <style>{`@keyframes dot{0%,80%,100%{opacity:.2;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}`}</style>
          </div>
        ) : sessions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 20, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <MessageSquare size={28} style={{ color: T.red, opacity: 0.7 }} />
            </div>
            <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Чатів ще немає</div>
            <div style={{ fontSize: 13, color: T.t3, maxWidth: 320, marginBottom: 24, lineHeight: 1.65 }}>
              Оберіть агента і почніть розмову.
            </div>
            <button onClick={() => setShowModal(true)} style={{ display: "flex", alignItems: "center", gap: 7, background: T.red, color: "#fff", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              <Plus size={14} /> Створити новий чат
            </button>
          </div>
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1100 }}>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: "Всього сесій",  value: sessions.length,                                   icon: MessageSquare },
                { label: "Агентів",        value: agentsWithSessions.length,                         icon: Bot           },
                { label: "Повідомлень",    value: Object.values(msgCounts).reduce((a,b)=>a+b,0),     icon: Zap           },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", borderRadius: 9, background: T.s1, border: `0.5px solid ${T.b1}` }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* ── Filters bar ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 18, padding: "12px 14px", borderRadius: 12, background: T.s1, border: `0.5px solid ${T.b1}` }}>

              {/* Row 1: search + dropdowns */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>

                {/* Search */}
                <div style={{ flex: 1, minWidth: 160, display: "flex", alignItems: "center", gap: 8, background: "#09090F", border: "0.5px solid rgba(255,255,255,0.09)", borderRadius: 8, padding: "0 11px", height: 34 }}>
                  <Search size={13} style={{ color: T.t4, flexShrink: 0 }} />
                  <input value={search} onChange={e => setSearch(e.target.value)}
                    placeholder="Пошук чатів..."
                    style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 12.5, color: T.t1 }}
                  />
                  {search && (
                    <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 0 }}>
                      <X size={11} />
                    </button>
                  )}
                </div>

                {/* Agent dropdown */}
                <div style={{ position: "relative" }}>
                  <select value={agentFilter ?? ""} onChange={e => setAgentFilter(e.target.value || null)} style={{
                    background: agentFilter ? "rgba(232,0,42,0.10)" : "#09090F",
                    border: `0.5px solid ${agentFilter ? "rgba(232,0,42,0.30)" : "rgba(255,255,255,0.09)"}`,
                    borderRadius: 8, padding: "0 26px 0 10px", height: 34,
                    fontSize: 12, color: agentFilter ? T.t1 : T.t3,
                    outline: "none", cursor: "pointer", appearance: "none", maxWidth: 140,
                  }}>
                    <option value="">Агент</option>
                    {agentsWithSessions.map(a => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({sessions.filter(s => s.agent_id === a.id).length})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: T.t4, pointerEvents: "none" }} />
                </div>

                {/* Provider dropdown */}
                <div style={{ position: "relative" }}>
                  <select value={provFilter ?? ""} onChange={e => setProvFilter(e.target.value || null)} style={{
                    background: provFilter ? "rgba(34,197,94,0.08)" : "#09090F",
                    border: `0.5px solid ${provFilter ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.09)"}`,
                    borderRadius: 8, padding: "0 26px 0 10px", height: 34,
                    fontSize: 12, color: provFilter ? T.green : T.t3,
                    outline: "none", cursor: "pointer", appearance: "none", maxWidth: 140,
                  }}>
                    <option value="">Провайдер</option>
                    {provsWithSessions.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({sessions.filter(s => getAgent(s.agent_id)?.provider_id === p.id).length})
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: T.t4, pointerEvents: "none" }} />
                </div>

                {/* Period dropdown */}
                <div style={{ position: "relative" }}>
                  <select value={dateFilter} onChange={e => setDateFilter(e.target.value as DateFilter)} style={{
                    background: dateFilter !== "all" ? "rgba(232,0,42,0.08)" : "#09090F",
                    border: `0.5px solid ${dateFilter !== "all" ? "rgba(232,0,42,0.25)" : "rgba(255,255,255,0.09)"}`,
                    borderRadius: 8, padding: "0 26px 0 10px", height: 34,
                    fontSize: 12, color: dateFilter !== "all" ? T.t1 : T.t3,
                    outline: "none", cursor: "pointer", appearance: "none",
                  }}>
                    <option value="all">Період</option>
                    <option value="today">Сьогодні</option>
                    <option value="week">7 днів</option>
                    <option value="month">30 днів</option>
                  </select>
                  <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: T.t4, pointerEvents: "none" }} />
                </div>

                {/* Sort dropdown */}
                <div style={{ position: "relative" }}>
                  <select value={sort} onChange={e => setSort(e.target.value as SortOpt)} style={{
                    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.09)",
                    borderRadius: 8, padding: "0 26px 0 10px", height: 34,
                    fontSize: 12, color: T.t3, outline: "none", cursor: "pointer", appearance: "none",
                  }}>
                    <option value="newest">Новіші</option>
                    <option value="oldest">Старіші</option>
                    <option value="title">За назвою</option>
                  </select>
                  <ChevronDown size={10} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", color: T.t4, pointerEvents: "none" }} />
                </div>

                {hasFilters && (
                  <button onClick={clearFilters} style={{
                    fontSize: 11, color: T.t4, background: "none", border: "none",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 3, marginLeft: "auto",
                    whiteSpace: "nowrap",
                  }}>
                    <X size={10} /> Очистити
                  </button>
                )}
              </div>

              {/* Row 2: compact hashtag agent chips */}
              {agentsWithSessions.length > 0 && (
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#3A3A5A", flexShrink: 0 }}>агенти:</span>
                  {agentsWithSessions.map(agent => {
                    const count    = sessions.filter(s => s.agent_id === agent.id).length
                    const isActive = agentFilter === agent.id
                    return (
                      <button key={agent.id}
                        onClick={() => setAgentFilter(isActive ? null : agent.id)}
                        style={{
                          fontSize: 10.5, padding: "2px 8px", borderRadius: 5, border: "none",
                          cursor: "pointer",
                          background: isActive ? `${agent.avatar_color}20` : "rgba(255,255,255,0.04)",
                          color: isActive ? agent.avatar_color : T.t4,
                          outline: isActive ? `1px solid ${agent.avatar_color}40` : "none",
                        }}>
                        #{agent.name.replace(/\s+/g, "")} <span style={{ opacity: 0.5 }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Results */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4, marginBottom: 10 }}>Нічого не знайдено</div>
                <button onClick={clearFilters} style={{ fontSize: 12, color: T.red, background: "none", border: "none", cursor: "pointer" }}>
                  Очистити фільтри
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11, color: T.t4, marginBottom: 8 }}>
                  {filtered.length} {filtered.length === 1 ? "сесія" : filtered.length < 5 ? "сесії" : "сесій"}
                  {hasFilters && " · відфільтровано"}
                </div>
                {filtered.map(session => {
                  const agent    = getAgent(session.agent_id)
                  const provider = agent ? getProvider(agent.provider_id) : undefined
                  return (
                    <SessionCard
                      key={session.id}
                      session={session}
                      agent={agent}
                      provider={provider}
                      msgCount={msgCounts[session.id] ?? 0}
                      onOpen={() => router.push(`/chat/${session.id}`)}
                      onDelete={e => handleDelete(e, session.id)}
                      onRename={e => { e.stopPropagation(); setRenameTarget(session) }}
                    />
                  )
                })}
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

      {renameTarget && (
        <RenameModal
          session={renameTarget}
          onClose={() => setRenameTarget(null)}
          onRenamed={(id, newTitle) => {
            setSessions(prev => prev.map(s => s.id === id ? { ...s, title: newTitle } : s))
            setRenameTarget(null)
          }}
        />
      )}
    </>
  )
}