"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  MessageSquare, Bot, Zap, Sparkles, HelpCircle,
  Plus, Clock, X, AlertCircle, ChevronRight,
  Users, Radio, Lock, Pin,
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

// ─── New topic modal ──────────────────────────────────────────────

function NewTopicModal({ categories, defaultCategoryId, onClose, onCreated, t }: {
  categories: Category[]
  defaultCategoryId?: string
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
          <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.forum.newTopicTitle}</div>
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

// ─── Topic row ────────────────────────────────────────────────────

function TopicRow({ topic, category, t, lang }: {
  topic: Topic; category?: Category
  t: ReturnType<typeof useLanguage>["t"]; lang: Language
}) {
  const accent = category?.color ?? T.red

  return (
    <Link href={`/forum/topic/${topic.id}`} style={{ textDecoration: "none" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 13,
        padding: "12px 15px", borderRadius: 11,
        background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)",
        transition: "background 130ms ease, border-color 130ms ease",
        cursor: "pointer",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.05)"
          ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.20)"
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.02)"
          ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.06)"
        }}
      >
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: `${accent}22`, border: `0.5px solid ${accent}44`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: accent,
        }}>
          {initials(topic.author_name)}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
            {topic.is_pinned && <Pin size={11} style={{ color: T.red, flexShrink: 0 }} />}
            {topic.is_locked && <Lock size={11} style={{ color: T.t4, flexShrink: 0 }} />}
            <span style={{ fontSize: 13.5, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {topic.title}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
            {category && (
              <span style={{
                fontSize: 10, padding: "1px 7px", borderRadius: 4,
                background: `${accent}18`, color: accent,
              }}>{category.name}</span>
            )}
            <span style={{ fontSize: 11, color: T.t4 }}>{topic.author_name ?? t.forum.anonymousUser}</span>
            <span style={{ fontSize: 11, color: "#252540" }}>·</span>
            <span style={{ fontSize: 11, color: T.t4, display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9} />{ago(topic.last_reply_at, t, lang)}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 5, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, padding: "2px 8px", borderRadius: 5,
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

  const [categories, setCategories] = useState<Category[]>([])
  const [topics,     setTopics]     = useState<Topic[]>([])
  const [loaded,     setLoaded]     = useState(false)
  const [showModal,  setShowModal]  = useState(false)
  const [isAuthed,   setIsAuthed]   = useState(false)
  const [pulse,      setPulse]      = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  const load = useCallback(async () => {
    try {
      const sb = getSupabase()
      const [{ data: cats }, { data: tops }, { data: userData }] = await Promise.all([
        sb.from("forum_categories").select("*").order("position", { ascending: true }),
        sb.from("forum_topics").select("*").order("last_reply_at", { ascending: false }).limit(20),
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
  // recent list without a refresh. Updates (reply_count / last_reply_at
  // bumps from the DB trigger) are merged in place so activity ordering
  // stays correct.
  useEffect(() => {
    const sb = getSupabase()
    const channel = sb
      .channel("forum-home")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "forum_topics" },
        payload => {
          setTopics(prev => [payload.new as Topic, ...prev].slice(0, 20))
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

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0}
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
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.25)",
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.green, display: "inline-block",
                  opacity: pulse ? 1 : 0.3,
                  transition: "opacity 900ms ease, box-shadow 900ms ease",
                  boxShadow: pulse ? "0 0 6px rgba(34,197,94,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.green, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  <Radio size={9} style={{ display: "inline", verticalAlign: "-1px", marginRight: 4 }} />
                  {t.forum.liveIndicator}
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.forum.title}</h1>
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

          {/* Categories */}
          <div style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
            {t.forum.categoriesTitle}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12, marginBottom: 32 }}>
            {categories.map(cat => {
              const Icon = ICON_MAP[cat.icon ?? "MessageSquare"] ?? MessageSquare
              const accent = cat.color ?? T.red
              const count = topics.filter(x => x.category_id === cat.id).length
              return (
                <Link key={cat.id} href={`/forum/${cat.slug}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                    border: `0.5px solid ${T.b1}`, borderRadius: 14,
                    padding: "16px 18px", cursor: "pointer",
                    display: "flex", flexDirection: "column", gap: 10,
                    transition: "border-color 150ms ease, box-shadow 150ms ease",
                  }}
                    onMouseEnter={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = `${accent}55`
                      ;(e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${accent}14`
                    }}
                    onMouseLeave={e => {
                      (e.currentTarget as HTMLElement).style.borderColor = T.b1
                      ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                        background: `${accent}18`, border: `0.5px solid ${accent}33`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={15} style={{ color: accent }} />
                      </div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{cat.name}</div>
                    </div>
                    {cat.description && (
                      <div style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.5 }}>{cat.description}</div>
                    )}
                    <div style={{ fontSize: 10.5, color: T.t4, display: "flex", alignItems: "center", gap: 4 }}>
                      <Users size={9} />{count} {t.forum.topicsCount}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Recent topics */}
          <div style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
            {t.forum.lastActivity}
          </div>

          {!loaded ? null : topics.length === 0 ? (
            <div style={{ padding: "48px 0", textAlign: "center" }}>
              <MessageSquare size={24} style={{ color: T.t4, opacity: 0.4, margin: "0 auto 12px" }} />
              <div style={{ fontSize: 13, color: T.t4, marginBottom: 6 }}>{t.forum.noTopicsYet}</div>
              <div style={{ fontSize: 12, color: T.t4, opacity: 0.7 }}>{t.forum.noTopicsHint}</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {topics.map(topic => (
                <TopicRow key={topic.id} topic={topic} category={getCategory(topic.category_id)} t={t} lang={language} />
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <NewTopicModal
          categories={categories}
          onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push(`/forum/topic/${id}`) }}
          t={t}
        />
      )}
    </>
  )
}