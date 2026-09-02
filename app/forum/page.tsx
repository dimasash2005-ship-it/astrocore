"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  MessageSquare, Bot, Zap, Sparkles, HelpCircle,
  Plus, Clock, X, AlertCircle, ChevronRight,
  Radio, Lock, Pin,
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

type Category = {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  color: string | null
  position: number
}

type Topic = {
  id: string
  category_id: string
  user_id: string
  title: string
  content: string
  author_name: string | null
  is_pinned: boolean
  is_locked: boolean
  reply_count: number
  last_reply_at: string
  created_at: string
}

// Category icons are stored in the DB as lucide-react component names
// (rather than as imported components, which can't be serialized), so
// this maps the stored string back to the actual component.
const ICON_MAP: Record<string, React.ElementType> = {
  MessageSquare, Bot, Zap, Sparkles, HelpCircle,
}

// A topic counts as "recently active" if its last reply landed within
// this window — that's the only thing that earns the animated signal
// line instead of a plain static dot. Otherwise every topic would get
// the same "live" treatment regardless of whether anything is actually
// happening, which is exactly the kind of decoration-with-no-meaning
// this app has been steadily removing everywhere else.
const RECENT_WINDOW_MS = 10 * 60 * 1000

function ago(iso: string, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return t.forum.justNow
  if (m < 60) return `${m} ${t.forum.minAgo}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.forum.hourAgo}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return t.forum.yesterday
  if (dy < 7)  return `${dy}${t.forum.daysAgo}`
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })
}

function initials(name: string | null): string {
  if (!name) return "?"
  return name.trim().charAt(0).toUpperCase()
}

function excerpt(text: string, n: number): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim()
  return clean.length > n ? clean.slice(0, n) + "…" : clean
}

// ─── New topic modal ──────────────────────────────────────────────

function NewTopicModal({ categories, defaultCategoryId, onClose, onCreated, t }: {
  categories: Category[]
  defaultCategoryId?: string | null
  onClose: () => void
  onCreated: (topicId: string) => void
  t: ReturnType<typeof useLanguage>["t"]
}) {
  const [title,      setTitle]      = useState("")
  const [content,    setContent]    = useState("")
  const [categoryId, setCategoryId] = useState(defaultCategoryId ?? categories[0]?.id ?? "")
  const [error,      setError]      = useState("")
  const [loading,    setLoading]    = useState(false)

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  async function handleCreate() {
    if (!title.trim())   { setError(t.forum.titleRequiredError); return }
    if (!content.trim()) { setError(t.forum.contentRequiredError); return }
    if (!categoryId)     { setError(t.forum.categoryRequiredError); return }

    setLoading(true)
    setError("")

    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.forum.loginToPost); setLoading(false); return }

    const authorName =
      (user.user_metadata?.full_name as string | undefined)
      || (user.user_metadata?.name as string | undefined)
      || user.email?.split("@")[0]
      || t.forum.anonymousUser

    const { data, error: dbErr } = await sb.from("forum_topics").insert({
      category_id: categoryId,
      user_id:     user.id,
      title:       title.trim(),
      content:     content.trim(),
      author_name: authorName,
    }).select("id").single()

    if (dbErr || !data) { setError(dbErr?.message || t.forum.postError); setLoading(false); return }
    onCreated(data.id)
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div style={{
        width: "100%", maxWidth: 560, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        padding: "24px 24px 20px", maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <MessageSquare size={15} style={{ color: T.red }} />
          </div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.forum.newTopicTitle}</div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.forum.categoryField}
            </label>
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              style={{ ...inp, cursor: "pointer" }}>
              {categories.map(c => (
                <option key={c.id} value={c.id} style={{ background: "#111118" }}>{c.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.forum.topicTitleField}
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t.forum.topicTitlePlaceholder} style={inp} maxLength={200}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.forum.topicContentField}
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={t.forum.topicContentPlaceholder} rows={6}
              style={{ ...inp, resize: "vertical", lineHeight: 1.65 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2,
            }}>{t.forum.cancel}</button>
            <button onClick={handleCreate} disabled={loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: loading ? "rgba(232,0,42,0.3)" : T.red,
              border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >{loading ? t.forum.publishing : t.forum.publish}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Recency indicator ──────────────────────────────────────────────
// A thin signal line for topics active in the last 10 minutes (the
// same motif as Sidebar's rail and Dashboard's status panels); a quiet
// static dot for everything else. The animation is reserved for
// something that's actually true right now, not decoration.

function RecencyDot({ recent, color }: { recent: boolean; color: string }) {
  if (!recent) {
    return <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: T.t4, flexShrink: 0, opacity: 0.6 }} />
  }
  return (
    <span aria-hidden style={{
      position: "relative", width: 16, height: 1.5, borderRadius: 1, flexShrink: 0,
      background: `${color}30`, overflow: "hidden", display: "inline-block",
    }}>
      <span className="astrocore-badge-sweep" style={{
        position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%",
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      }} />
    </span>
  )
}

// ─── Topic row ────────────────────────────────────────────────────

function TopicRow({ topic, category, isNew, t, lang }: {
  topic: Topic; category?: Category; isNew?: boolean
  t: ReturnType<typeof useLanguage>["t"]; lang: Language
}) {
  const accent = category?.color ?? T.red
  const isRecent = Date.now() - new Date(topic.last_reply_at).getTime() < RECENT_WINDOW_MS

  return (
    <Link href={`/forum/topic/${topic.id}`} style={{ textDecoration: "none" }}>
      <div
        className={isNew ? "astrocore-topic-new" : undefined}
        style={{
          display: "flex", alignItems: "flex-start", gap: 13,
          padding: "14px 16px 14px 18px", borderRadius: 11, position: "relative",
          background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)",
          transition: "background 130ms ease, border-color 130ms ease",
          cursor: "pointer", overflow: "hidden",
        }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = `${accent}0D`
          ;(e.currentTarget as HTMLElement).style.borderColor = `${accent}33`
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
          ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"
        }}
      >
        <span aria-hidden style={{ position: "absolute", left: 0, top: 10, bottom: 10, width: 2.5, borderRadius: "0 3px 3px 0", background: accent }} />

        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0, marginTop: 1,
          background: `${accent}22`, border: `0.5px solid ${accent}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, color: accent,
        }}>
          {initials(topic.author_name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4, flexWrap: "wrap" }}>
            {topic.is_pinned && <Pin size={11} style={{ color: T.red, flexShrink: 0 }} />}
            {topic.is_locked && <Lock size={11} style={{ color: T.t4, flexShrink: 0 }} />}
            <span style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>
              {topic.title}
            </span>
            {category && (
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9.5, padding: "1.5px 7px", borderRadius: 5, fontWeight: 600, letterSpacing: "0.02em",
                background: `${accent}18`, color: accent,
              }}>{category.name}</span>
            )}
          </div>

          {topic.content && (
            <div style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.5, marginBottom: 7, maxWidth: 620 }}>
              {excerpt(topic.content, 120)}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <RecencyDot recent={isRecent} color={accent} />
            <span style={{ fontSize: 11, color: T.t4 }}>{topic.author_name ?? t.forum.anonymousUser}</span>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4 }}>{ago(topic.last_reply_at, t, lang)}</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0, marginTop: 2 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10.5, padding: "2px 8px", borderRadius: 5,
            background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`,
            color: T.t3, display: "flex", alignItems: "center", gap: 4,
          }}>
            <MessageSquare size={10} />{topic.reply_count}
          </span>
          <ChevronRight size={14} style={{ color: T.t4 }} />
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ForumPage() {
  const router = useRouter()
  const { t, language } = useLanguage()

  const [categories, setCategories]   = useState<Category[]>([])
  const [topics,     setTopics]       = useState<Topic[]>([])
  const [loaded,     setLoaded]       = useState(false)
  const [showModal,  setShowModal]    = useState(false)
  const [isAuthed,   setIsAuthed]     = useState(false)
  const [activeCat,  setActiveCat]    = useState<string | null>(null)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const sb = getSupabase()
      const [{ data: cats }, { data: tops }, { data: userData }] = await Promise.all([
        sb.from("forum_categories").select("*").order("position", { ascending: true }),
        // Capped at 100 rather than paginated — comfortably covers a
        // young forum's whole recent history in one request. If this
        // ever fills up regularly, category filtering below should
        // switch to a direct server-side query instead of filtering
        // this capped list client-side.
        sb.from("forum_topics").select("*").order("last_reply_at", { ascending: false }).limit(100),
        sb.auth.getUser(),
      ])
      if (cats) setCategories(cats as Category[])
      if (tops) setTopics(tops as Topic[])
      setIsAuthed(!!userData?.user)
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // Live updates: any new topic anywhere shows up at the top of the
  // feed without a refresh, with a brief entrance animation so it's
  // visible that something just happened rather than silently
  // appearing. Updates (reply_count / last_reply_at bumps from the DB
  // trigger) are merged in place so activity ordering stays correct.
  useEffect(() => {
    const sb = getSupabase()
    const channel = sb
      .channel("forum-home")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "forum_topics" },
        payload => {
          const incoming = payload.new as Topic
          setTopics(prev => [incoming, ...prev].slice(0, 100))
          setJustAddedId(incoming.id)
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "forum_topics" },
        payload => {
          const updated = payload.new as Topic
          setTopics(prev => {
            const next = prev.map(x => x.id === updated.id ? updated : x)
            return [...next].sort((a, b) =>
              new Date(b.last_reply_at).getTime() - new Date(a.last_reply_at).getTime())
          })
        })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [])

  function getCategory(id: string) { return categories.find(c => c.id === id) }

  const visible = activeCat ? topics.filter(x => x.category_id === activeCat) : topics
  const pinned  = visible.filter(x => x.is_pinned)
  const regular = visible.filter(x => !x.is_pinned)
  const activeCategory = activeCat ? getCategory(activeCat) : undefined

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0}
        }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
        .astrocore-topic-new { animation: astrocoreTopicIn 420ms ease-out; }
        @keyframes astrocoreTopicIn {
          from { opacity: 0; transform: translateY(-8px); background: rgba(232,0,42,0.10); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.25)",
                borderRadius: 20, padding: "4px 11px 4px 9px", marginBottom: 14,
              }}>
                <span aria-hidden style={{
                  position: "relative", width: 16, height: 1.5, borderRadius: 1,
                  background: "rgba(34,197,94,0.25)", overflow: "hidden", display: "inline-block",
                }}>
                  <span style={{
                    position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%",
                    background: "linear-gradient(90deg, transparent, #22C55E, transparent)",
                    animation: "astrocoreBadgeSweep 1.8s linear infinite",
                  }} />
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.green, fontWeight: 600, letterSpacing: "0.06em" }}>
                  {t.forum.liveIndicator}
                </span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.forum.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.forum.subtitle}</p>
            </div>

            {isAuthed ? (
              <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Plus size={14} /> {t.forum.newTopic}
              </button>
            ) : (
              <button onClick={() => router.push("/login")} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(255,255,255,0.05)", color: T.t2,
                border: `0.5px solid ${T.b1}`, borderRadius: 9, padding: "9px 18px",
                fontSize: 13, cursor: "pointer",
              }}>
                {t.forum.loginToPost}
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 48px 56px", maxWidth: 1100 }}>

          {/* Category filter chips */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 22 }}>
            <button onClick={() => setActiveCat(null)} style={{
              fontSize: 12.5, fontWeight: 500, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
              background: activeCat === null ? "rgba(232,0,42,0.14)" : "rgba(255,255,255,0.045)",
              color: activeCat === null ? "#fff" : T.t3,
              border: `0.5px solid ${activeCat === null ? "rgba(232,0,42,0.35)" : "rgba(255,255,255,0.08)"}`,
            }}>
              {language === "uk" ? "Усі" : "All"}
            </button>
            {categories.map(cat => {
              const accent = cat.color ?? T.red
              const active = activeCat === cat.id
              const count = topics.filter(x => x.category_id === cat.id).length
              return (
                <button key={cat.id} onClick={() => setActiveCat(active ? null : cat.id)} style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  fontSize: 12.5, fontWeight: 500, padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                  background: active ? `${accent}22` : "rgba(255,255,255,0.045)",
                  color: active ? accent : T.t3,
                  border: `0.5px solid ${active ? `${accent}55` : "rgba(255,255,255,0.08)"}`,
                }}>
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  {cat.name}
                  <span style={{ opacity: 0.6, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5 }}>{count}</span>
                </button>
              )
            })}
          </div>

          {/* Pinned */}
          {pinned.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <Pin size={11} style={{ color: T.red }} /> {t.forum.pinnedLabel}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {pinned.map(topic => (
                  <TopicRow key={topic.id} topic={topic} category={getCategory(topic.category_id)} isNew={topic.id === justAddedId} t={t} lang={language} />
                ))}
              </div>
            </div>
          )}

          {/* Feed */}
          {!loaded ? null : visible.length === 0 ? (
            activeCategory ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, flexWrap: "wrap",
                padding: "16px 18px", borderRadius: 11,
                background: `${activeCategory.color ?? T.red}0D`,
                border: `0.5px dashed ${activeCategory.color ?? T.red}44`,
              }}>
                <span style={{ fontSize: 13, color: T.t2 }}>
                  {t.forum.noTopicsHint}
                </span>
                {isAuthed && (
                  <button onClick={() => setShowModal(true)} style={{
                    display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
                    background: `${activeCategory.color ?? T.red}22`, color: activeCategory.color ?? T.red,
                    border: `0.5px solid ${activeCategory.color ?? T.red}44`,
                    borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer",
                  }}>
                    <Plus size={13} /> {t.forum.newTopic}
                  </button>
                )}
              </div>
            ) : (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <MessageSquare size={24} style={{ color: T.t4, opacity: 0.4, margin: "0 auto 12px" }} />
                <div style={{ fontSize: 13, color: T.t4, marginBottom: 6 }}>{t.forum.noTopicsYet}</div>
                <div style={{ fontSize: 12, color: T.t4, opacity: 0.7 }}>{t.forum.noTopicsHint}</div>
              </div>
            )
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {regular.map(topic => (
                <TopicRow key={topic.id} topic={topic} category={getCategory(topic.category_id)} isNew={topic.id === justAddedId} t={t} lang={language} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewTopicModal
          categories={categories}
          defaultCategoryId={activeCat}
          onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push(`/forum/topic/${id}`) }}
          t={t}
        />
      )}
    </>
  )
}