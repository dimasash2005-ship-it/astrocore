"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  MessageSquare, Plus, Bot, Clock, Search,
  Trash2, X, AlertCircle,
  Edit3, ChevronDown, Zap, ArrowRight, Loader2,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

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

function ago(iso: string, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return t.chat.justNow
  if (m < 60) return `${m} ${t.chat.minAgo}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.chat.hourAgo}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return t.chat.yesterday
  if (dy < 7)  return `${dy}${t.chat.daysAgo}`
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })
}

// ─── Rename modal ─────────────────────────────────────────────────

function RenameModal({ session, onClose, onRenamed, t }: {
  session: Session; onClose: () => void; onRenamed: (id: string, title: string) => void
  t: ReturnType<typeof useLanguage>["t"]
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
    <div className="ch-overlay" style={{ zIndex: 200 }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ch-modal" style={{ maxWidth: 400, padding: 20 }}>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 14 }}>{t.chat.renameChat}</div>
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
            {t.chat.cancel}
          </button>
          <button onClick={save} disabled={loading || !title.trim()} style={{ flex: 1, padding: "8px", borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: "pointer", background: T.red, border: "none", color: "#fff" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
          >
            {loading ? t.chat.saving : t.chat.save}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── New Chat Modal ───────────────────────────────────────────────

function NewChatModal({ onClose, onCreated, t }: {
  onClose: () => void; onCreated: (id: string) => void
  t: ReturnType<typeof useLanguage>["t"]
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

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])

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
      user_id: user.id, agent_id: agent.id, title: `${t.chat.chatWithPrefix}${agent.name}`,
    }).select().single()
    if (error || !data) { setLoading(false); return }
    onCreated(data.id)
  }

  const selAgent = agents.find(a => a.id === selected)
  const canCreate = !!selected && !!getProv(selAgent?.provider_id ?? null)

  return (
    <div className="ch-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ch-modal" style={{ maxWidth: 500, overflow: "hidden", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px 13px", borderBottom: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.chat.newChat}</div>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: "rgba(255,255,255,0.06)", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={13} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "14px 20px 20px", flex: 1 }}>
          {providers.length === 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 13px", borderRadius: 9, marginBottom: 12, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
              <AlertCircle size={13} style={{ color: T.red, flexShrink: 0 }} />
              <div>
                <span style={{ fontSize: 12, color: "#FF4D6A" }}>{t.chat.noApiKeys}</span>
                <button onClick={() => { onClose(); router.push("/providers") }} style={{ fontSize: 12, color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  {t.chat.add}
                </button>
              </div>
            </div>
          )}

          {agents.length === 0 ? (
            <div style={{ padding: "28px 0", textAlign: "center" }}>
              <Bot size={22} style={{ color: T.red, opacity: 0.6, margin: "0 auto 10px" }} />
              <div style={{ fontSize: 13, fontWeight: 600, color: T.t1, marginBottom: 14 }}>{t.chat.noAgents}</div>
              <button onClick={() => { onClose(); router.push("/agents") }} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 9, border: "none", background: T.red, color: "#fff", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                <Plus size={13} /> {t.chat.createAgent}
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 6 }}>{t.chat.chooseAgent}</div>
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
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: T.t4 }}>{prov.model}</span>
                          </>
                        ) : (
                          <span style={{ fontSize: 10.5, color: "#FF4D6A" }}>{t.chat.providerNotFound}</span>
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
              {t.chat.cancel}
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
              {loading ? t.chat.creating : canCreate ? `${t.chat.chatWithPrefix}${selAgent?.name}` : t.chat.chooseAgentBtn}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Session row ──────────────────────────────────────────────────

function SessionRow({ session, agent, provider, msgCount, onOpen, onDelete, onRename, t, lang, index }: {
  session: Session; agent?: Agent; provider?: Provider; msgCount: number
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
  onRename: (e: React.MouseEvent) => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language; index: number
}) {
  const color = agent?.avatar_color ?? T.red
  return (
    <div role="button" tabIndex={0} className="ch-row" onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen() }}
      style={{ ["--c" as string]: color, animationDelay: `${Math.min(index, 14) * 25}ms` } as React.CSSProperties}>
      <div className="ch-av" style={{ background: agent ? color : "rgba(232,0,42,0.12)" }}>
        {agent ? agent.name.charAt(0).toUpperCase() : <MessageSquare size={14} style={{ color: T.red }} />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ch-title">{session.title}</div>
        <div className="ch-sub">
          {agent && <span style={{ color: T.t3 }}>{agent.name}</span>}
          {provider && <><span className="ch-dot" /><span className="mono">{provider.model}</span></>}
        </div>
      </div>

      <div className="ch-right">
        {msgCount > 0 && <span className="ch-count"><MessageSquare size={9} /> {msgCount}</span>}
        <span className="ch-time"><Clock size={10} />{ago(session.updated_at ?? session.created_at, t, lang)}</span>
        <div className="ch-actions">
          <button onClick={onRename} title={t.chat.rename} className="ch-icon"><Edit3 size={12} /></button>
          <button onClick={onDelete} title={t.chat.delete} className="ch-icon del"><Trash2 size={12} /></button>
        </div>
        <ArrowRight size={14} className="ch-go" />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

type SortOpt = "newest" | "oldest" | "title"
type DateFilter = "all" | "today" | "week" | "month"

export default function ChatPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const uk = language === "uk"

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
  const [starting,     setStarting]     = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  async function load() {
    try {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const [{ data: sessData }, { data: agentsData }, { data: provsData }] = await Promise.all([
        sb.from("chat_sessions").select("id,user_id,agent_id,title,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }),
        sb.from("agents").select("id,name,avatar_color,provider_id").eq("user_id", user.id),
        sb.from("providers").select("id,name,model,is_active").eq("user_id", user.id),
      ])
      setSessions((sessData ?? []) as Session[])
      setAgents((agentsData ?? []) as Agent[])
      setProviders((provsData ?? []) as Provider[])

      if (sessData && sessData.length > 0) {
        const counts: Record<string, number> = {}
        await Promise.all(sessData.map(async s => {
          const { count } = await sb.from("chat_messages").select("id", { count: "exact", head: true }).eq("session_id", s.id)
          counts[s.id] = count ?? 0
        }))
        setMsgCounts(counts)
      }
    } catch (err) {
      console.error("Chat page load error:", err)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => { load() }, [])

  // "/" focuses search, "n" opens new chat
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "/") { e.preventDefault(); searchRef.current?.focus() }
      if (e.key.toLowerCase() === "n" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); setShowModal(true) }
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [])

  function getAgent(id: string | null)    { return agents.find(a => a.id === id) }
  function getProvider(id: string | null) { return providers.find(p => p.id === id) }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    if (!window.confirm(t.chat.deleteSessionConfirm)) return
    await getSupabase().from("chat_sessions").delete().eq("id", id)
    setSessions(prev => prev.filter(s => s.id !== id))
  }

  // one-click chat with an agent (same insert as NewChatModal)
  async function quickStart(agent: Agent) {
    if (starting) return
    setStarting(agent.id)
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setStarting(null); return }
    const { data, error } = await sb.from("chat_sessions").insert({
      user_id: user.id, agent_id: agent.id, title: `${t.chat.chatWithPrefix}${agent.name}`,
    }).select().single()
    if (error || !data) { setStarting(null); return }
    router.push(`/chat/${data.id}`)
  }

  const agentsWithSessions = useMemo(() => {
    const ids = new Set(sessions.map(s => s.agent_id).filter(Boolean))
    return agents.filter(a => ids.has(a.id))
  }, [sessions, agents])

  const provsWithSessions = useMemo(() => {
    const provIds = new Set(sessions.map(s => agents.find(a => a.id === s.agent_id)?.provider_id).filter(Boolean))
    return providers.filter(p => provIds.has(p.id))
  }, [sessions, agents, providers])

  const readyAgents = useMemo(() => agents.filter(a => providers.some(p => p.id === a.provider_id)), [agents, providers])

  const DAY = 86400000

  const filtered = useMemo(() => {
    const now = Date.now()
    let result = [...sessions]
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(s => s.title.toLowerCase().includes(q) || (agents.find(a => a.id === s.agent_id)?.name ?? "").toLowerCase().includes(q))
    }
    if (agentFilter) result = result.filter(s => s.agent_id === agentFilter)
    if (provFilter)  result = result.filter(s => agents.find(a => a.id === s.agent_id)?.provider_id === provFilter)
    if (dateFilter !== "all") {
      const span = dateFilter === "today" ? DAY : dateFilter === "week" ? DAY * 7 : DAY * 30
      result = result.filter(s => now - new Date(s.updated_at ?? s.created_at).getTime() < span)
    }
    const localeCode = language === "uk" ? "uk" : "en"
    result.sort((a, b) => {
      if (sort === "newest") return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      if (sort === "oldest") return new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()
      return a.title.localeCompare(b.title, localeCode)
    })
    return result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions, search, agentFilter, provFilter, dateFilter, sort, agents, language])

  // group by date bucket (only for time-based sorting)
  const groups = useMemo(() => {
    if (sort === "title") return [{ key: "all", label: "", items: filtered }]
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const today = start.getTime()
    const buckets: { key: string; label: string; test: (t: number) => boolean }[] = [
      { key: "today", label: uk ? "Сьогодні" : "Today",         test: x => x >= today },
      { key: "yday",  label: uk ? "Вчора" : "Yesterday",        test: x => x >= today - DAY && x < today },
      { key: "week",  label: uk ? "Цей тиждень" : "This week",  test: x => x >= today - DAY * 7 && x < today - DAY },
      { key: "month", label: uk ? "Цей місяць" : "This month",  test: x => x >= today - DAY * 30 && x < today - DAY * 7 },
      { key: "older", label: uk ? "Раніше" : "Earlier",         test: x => x < today - DAY * 30 },
    ]
    const out = buckets.map(b => ({ key: b.key, label: b.label, items: filtered.filter(s => b.test(new Date(s.updated_at ?? s.created_at).getTime())) }))
      .filter(g => g.items.length > 0)
    return sort === "oldest" ? out.reverse() : out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, sort, uk])

  const hasFilters = !!search || !!agentFilter || !!provFilter || dateFilter !== "all"

  function clearFilters() {
    setSearch(""); setAgentFilter(null); setProvFilter(null); setDateFilter("all"); setSort("newest")
  }

  function sessionCountLabel(n: number) {
    if (n === 1) return t.chat.sessionSingular
    if (n < 5) return t.chat.sessionFew
    return t.chat.sessionMany
  }

  const totalMsgs = Object.values(msgCounts).reduce((a, b) => a + b, 0)
  let rowIndex = 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        select option { background: #111118; }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes chIn   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes chFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes chPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes chShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        @keyframes chSpin { to { transform: rotate(360deg); } }
        .ch-spin { animation: chSpin 1s linear infinite; }

        .ch-primary { display: flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
        .ch-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .ch-kbd { font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(255,255,255,.15); }

        /* quick start strip */
        .ch-quick { display: flex; align-items: center; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 20px; scrollbar-width: none; }
        .ch-quick::-webkit-scrollbar { display: none; }
        .ch-quick-l { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.t4}; text-transform: uppercase; letter-spacing: .08em; flex-shrink: 0; margin-right: 4px; }
        .ch-agent { display: flex; align-items: center; gap: 9px; flex-shrink: 0; height: 40px; padding: 0 14px 0 5px; border-radius: 12px; cursor: pointer;
          font-family: inherit; font-size: 12.5px; color: ${T.t2}; background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%);
          border: 0.5px solid ${T.b1}; transition: transform .18s cubic-bezier(.3,1.4,.5,1), border-color .18s, box-shadow .18s, color .18s; }
        .ch-agent:hover { transform: translateY(-2px); color: ${T.t1}; border-color: color-mix(in srgb, var(--c) 55%, transparent);
          box-shadow: 0 8px 22px rgba(0,0,0,.4), 0 0 18px color-mix(in srgb, var(--c) 18%, transparent); }
        .ch-agent i { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 12.5px; color: #fff;
          font-family: 'Space Grotesk', sans-serif; background: var(--c); box-shadow: 0 0 12px color-mix(in srgb, var(--c) 40%, transparent); }
        .ch-agent .ch-plus { color: ${T.t4}; transition: color .15s, transform .2s; }
        .ch-agent:hover .ch-plus { color: var(--c); transform: rotate(90deg); }

        /* toolbar */
        .ch-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 10px; }
        .ch-search { flex: 1 1 260px; display: flex; align-items: center; gap: 9px; height: 38px; padding: 0 12px; border-radius: 10px;
          background: ${T.s1}; border: 0.5px solid ${T.b1}; transition: border-color .15s, box-shadow .15s; }
        .ch-search:focus-within { border-color: rgba(232,0,42,.45); box-shadow: 0 0 0 3px rgba(232,0,42,.1); }
        .ch-search input { flex: 1; background: none; border: none; outline: none; font-size: 13px; color: ${T.t1}; font-family: inherit; }
        .ch-seg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: ${T.s1}; border: 0.5px solid ${T.b1}; }
        .ch-seg button { height: 30px; padding: 0 11px; border-radius: 7px; border: none; cursor: pointer; font-size: 12px; font-family: inherit;
          background: transparent; color: ${T.t3}; transition: background .15s, color .15s; }
        .ch-seg button:hover { color: ${T.t1}; }
        .ch-seg button.on { background: rgba(232,0,42,.14); color: #fff; box-shadow: inset 0 0 0 0.5px rgba(232,0,42,.4); }
        .ch-sel { position: relative; }
        .ch-sel select { height: 38px; padding: 0 28px 0 12px; border-radius: 10px; font-size: 12px; font-family: inherit; outline: none; cursor: pointer; appearance: none;
          background: ${T.s1}; border: 0.5px solid ${T.b1}; color: ${T.t3}; max-width: 170px; }
        .ch-sel select.on { color: ${T.t1}; border-color: rgba(232,0,42,.35); background: rgba(232,0,42,.08); }
        .ch-sel svg { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: ${T.t4}; pointer-events: none; }

        .ch-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 18px; }
        .ch-tag { display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 6px; border-radius: 8px; cursor: pointer; font-size: 11.5px; font-family: inherit;
          background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.07); color: ${T.t3}; transition: all .15s; }
        .ch-tag:hover { color: ${T.t1}; border-color: rgba(255,255,255,.16); }
        .ch-tag.on { color: #fff; background: color-mix(in srgb, var(--c) 18%, transparent); border-color: color-mix(in srgb, var(--c) 50%, transparent); }
        .ch-tag span.d { width: 8px; height: 8px; border-radius: 3px; background: var(--c); }
        .ch-tag b { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; opacity: .55; }

        /* list */
        .ch-list { border-radius: 14px; overflow: hidden; background: linear-gradient(160deg,#0F0F1A 0%,#0C0C15 100%); border: 0.5px solid ${T.b1}; }
        .ch-group { display: flex; align-items: center; gap: 10px; padding: 12px 16px 8px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600;
          color: ${T.t4}; text-transform: uppercase; letter-spacing: .09em; position: sticky; top: 0; background: #0E0E18; z-index: 1; }
        .ch-group::after { content: ""; flex: 1; height: 0.5px; background: rgba(255,255,255,.06); }
        .ch-group b { font-weight: 500; color: ${T.t4}; opacity: .7; }

        .ch-row { position: relative; display: flex; align-items: center; gap: 13px; padding: 11px 16px; cursor: pointer; outline: none;
          border-top: 0.5px solid rgba(255,255,255,.04); animation: chIn .35s cubic-bezier(.2,.8,.2,1) both; transition: background .15s; }
        .ch-group + .ch-row { border-top: 0; }
        .ch-row::before { content: ""; position: absolute; left: 0; top: 50%; width: 2.5px; height: 0; border-radius: 0 3px 3px 0; transform: translateY(-50%);
          background: var(--c); box-shadow: 0 0 10px var(--c); transition: height .2s cubic-bezier(.3,1.4,.5,1); }
        .ch-row:hover, .ch-row:focus-visible { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 9%, transparent), transparent 60%); }
        .ch-row:hover::before, .ch-row:focus-visible::before { height: 60%; }
        .ch-av { width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0; display: grid; place-items: center; font-family: 'Space Grotesk', sans-serif;
          font-size: 14px; font-weight: 700; color: #fff; transition: transform .2s, box-shadow .2s; }
        .ch-row:hover .ch-av { transform: scale(1.06); box-shadow: 0 0 16px color-mix(in srgb, var(--c) 45%, transparent); }
        .ch-title { font-size: 13.5px; font-weight: 500; color: ${T.t1}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 3px; }
        .ch-sub { display: flex; align-items: center; gap: 6px; font-size: 11px; color: ${T.t4}; overflow: hidden; white-space: nowrap; }
        .ch-sub .mono { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; }
        .ch-dot { width: 3px; height: 3px; border-radius: 50%; background: #34344E; }
        .ch-right { display: flex; align-items: center; gap: 10px; flex-shrink: 0; }
        .ch-count { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; padding: 2px 7px; border-radius: 5px;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.07); color: ${T.t4}; }
        .ch-time { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; min-width: 70px; justify-content: flex-end; }
        .ch-actions { display: flex; gap: 2px; width: 0; overflow: hidden; opacity: 0; transition: opacity .15s, width .2s; }
        .ch-row:hover .ch-actions, .ch-row:focus-within .ch-actions { width: 56px; opacity: 1; }
        .ch-icon { padding: 6px; border-radius: 7px; border: none; background: rgba(255,255,255,.05); cursor: pointer; line-height: 0; color: ${T.t3}; transition: all .12s; }
        .ch-icon:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .ch-icon.del:hover { color: #FF4D6A; background: rgba(232,0,42,.14); }
        .ch-go { color: ${T.t4}; opacity: 0; transform: translateX(-4px); transition: all .2s; }
        .ch-row:hover .ch-go { opacity: 1; transform: none; color: var(--c); }

        .ch-skel { height: 58px; border-top: 0.5px solid rgba(255,255,255,.04);
          background: linear-gradient(90deg, transparent 0px, rgba(255,255,255,.035) 200px, transparent 400px); background-size: 800px 100%; animation: chShimmer 1.4s linear infinite; }

        .ch-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: chFade .18s ease-out; }
        .ch-modal { width: 100%; border-radius: 16px; background: linear-gradient(160deg,#111120 0%,#0C0C18 100%); border: 0.5px solid rgba(232,0,42,.28);
          box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 50px rgba(232,0,42,.07); animation: chPop .24s cubic-bezier(.2,.9,.3,1.2); }

        @media (max-width: 760px) { .ch-count, .ch-go { display: none; } .ch-time { min-width: 0; } }
        @media (prefers-reduced-motion: reduce) { .ch-row, .ch-modal { animation: none; } }
      `}</style>

      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px" }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 180, pointerEvents: "none", background: "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(232,0,42,0.07) 0%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px 4px 10px", marginBottom: 14 }}>
                <span aria-hidden style={{ position: "relative", width: 18, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                  <span className="astrocore-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Chat Layer</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.chat.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {loaded && sessions.length > 0
                  ? <>{sessions.length} {sessionCountLabel(sessions.length)} · {agentsWithSessions.length} {t.chat.agentsLabel.toLowerCase()} · {totalMsgs} {t.chat.messagesLabel.toLowerCase()}</>
                  : t.chat.subtitle}
              </p>
            </div>
            <button onClick={() => setShowModal(true)} className="ch-primary">
              <Plus size={14} /> {t.chat.newChat} <span className="ch-kbd">N</span>
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {loaded && sessions.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 20, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.08)" }}>
              <MessageSquare size={28} style={{ color: T.red, opacity: 0.7 }} />
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.chat.noChatsYet}</div>
            <div style={{ fontSize: 13, color: T.t3, maxWidth: 320, marginBottom: 24, lineHeight: 1.65 }}>{t.chat.noChatsHint}</div>
            {readyAgents.length > 0 ? (
              <div className="ch-quick" style={{ justifyContent: "center", flexWrap: "wrap", overflow: "visible" }}>
                {readyAgents.slice(0, 6).map(a => (
                  <button key={a.id} className="ch-agent" style={{ ["--c" as string]: a.avatar_color ?? T.red } as React.CSSProperties} onClick={() => quickStart(a)}>
                    <i>{starting === a.id ? <Loader2 size={13} className="ch-spin" /> : a.name.charAt(0).toUpperCase()}</i>{a.name}<Plus size={13} className="ch-plus" />
                  </button>
                ))}
              </div>
            ) : (
              <button onClick={() => setShowModal(true)} className="ch-primary"><Plus size={14} /> {t.chat.createNewChat}</button>
            )}
          </div>
        ) : (
          <div style={{ padding: "22px 48px 60px", maxWidth: 1240 }}>

            {/* Quick start */}
            {readyAgents.length > 0 && (
              <div className="ch-quick">
                <span className="ch-quick-l"><Zap size={10} style={{ verticalAlign: -1, color: T.red }} /> {uk ? "Швидкий старт" : "Quick start"}</span>
                {readyAgents.map(a => (
                  <button key={a.id} className="ch-agent" style={{ ["--c" as string]: a.avatar_color ?? T.red } as React.CSSProperties}
                    onClick={() => quickStart(a)} disabled={!!starting}>
                    <i>{starting === a.id ? <Loader2 size={13} className="ch-spin" /> : a.name.charAt(0).toUpperCase()}</i>
                    {a.name}
                    <Plus size={13} className="ch-plus" />
                  </button>
                ))}
              </div>
            )}

            {/* Toolbar */}
            <div className="ch-bar">
              <div className="ch-search">
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input ref={searchRef} value={search} onChange={e => setSearch(e.target.value)} placeholder={t.chat.searchPlaceholder} />
                {search
                  ? <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={12} /></button>
                  : <span className="ch-kbd" style={{ color: T.t4, background: "rgba(255,255,255,.06)" }}>/</span>}
              </div>

              <div className="ch-seg">
                {([
                  { v: "all",   l: uk ? "Все" : "All" },
                  { v: "today", l: t.chat.periodToday },
                  { v: "week",  l: t.chat.periodWeek },
                  { v: "month", l: t.chat.periodMonth },
                ] as const).map(o => (
                  <button key={o.v} className={dateFilter === o.v ? "on" : ""} onClick={() => setDateFilter(o.v)}>{o.l}</button>
                ))}
              </div>

              {provsWithSessions.length > 1 && (
                <div className="ch-sel">
                  <select value={provFilter ?? ""} onChange={e => setProvFilter(e.target.value || null)} className={provFilter ? "on" : ""}>
                    <option value="">{t.chat.providerFilterLabel}</option>
                    {provsWithSessions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown size={11} />
                </div>
              )}

              <div className="ch-sel">
                <select value={sort} onChange={e => setSort(e.target.value as SortOpt)}>
                  <option value="newest">{t.chat.sortNewest}</option>
                  <option value="oldest">{t.chat.sortOldest}</option>
                  <option value="title">{t.chat.sortByTitle}</option>
                </select>
                <ChevronDown size={11} />
              </div>
            </div>

            {/* Agent tags */}
            {agentsWithSessions.length > 1 && (
              <div className="ch-tags">
                {agentsWithSessions.map(agent => {
                  const count = sessions.filter(s => s.agent_id === agent.id).length
                  const on = agentFilter === agent.id
                  return (
                    <button key={agent.id} className={`ch-tag${on ? " on" : ""}`}
                      style={{ ["--c" as string]: agent.avatar_color ?? T.red } as React.CSSProperties}
                      onClick={() => setAgentFilter(on ? null : agent.id)}>
                      <span className="d" />{agent.name} <b>{count}</b>
                    </button>
                  )
                })}
                {hasFilters && (
                  <button className="ch-tag" onClick={clearFilters} style={{ color: T.red, borderColor: "rgba(232,0,42,.25)" }}>
                    <X size={11} style={{ marginLeft: 2 }} /> {t.chat.clear}
                  </button>
                )}
              </div>
            )}

            {/* List */}
            {!loaded ? (
              <div className="ch-list">{[0, 1, 2, 3, 4].map(i => <div key={i} className="ch-skel" style={{ animationDelay: `${i * 0.1}s` }} />)}</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4, marginBottom: 10 }}>{t.chat.nothingFound}</div>
                <button onClick={clearFilters} style={{ fontSize: 12, color: T.red, background: "none", border: "none", cursor: "pointer" }}>{t.chat.clearFilters}</button>
              </div>
            ) : (
              <>
                {hasFilters && (
                  <div style={{ fontSize: 11.5, color: T.t4, marginBottom: 10 }}>
                    {filtered.length} {sessionCountLabel(filtered.length)} ({t.chat.filtered})
                  </div>
                )}
                <div className="ch-list">
                  {groups.map(g => (
                    <div key={g.key}>
                      {g.label && <div className="ch-group">{g.label} <b>{g.items.length}</b></div>}
                      {g.items.map(session => {
                        const agent    = getAgent(session.agent_id)
                        const provider = agent ? getProvider(agent.provider_id) : undefined
                        return (
                          <SessionRow
                            key={session.id}
                            index={rowIndex++}
                            session={session}
                            agent={agent}
                            provider={provider}
                            msgCount={msgCounts[session.id] ?? 0}
                            onOpen={() => router.push(`/chat/${session.id}`)}
                            onDelete={e => handleDelete(e, session.id)}
                            onRename={e => { e.stopPropagation(); setRenameTarget(session) }}
                            t={t}
                            lang={language}
                          />
                        )
                      })}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <NewChatModal
          onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push(`/chat/${id}`) }}
          t={t}
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
          t={t}
        />
      )}
    </>
  )
}