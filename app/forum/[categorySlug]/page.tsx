"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  MessageSquare, Bot, Zap, Sparkles, HelpCircle,
  Plus, Clock, X, ArrowLeft, ChevronRight,
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

// ─── New topic modal (category is fixed to the current one) ───────

function NewTopicModal({ category, onClose, onCreated, t }: {
  category: Category
  onClose: () => void
  onCreated: (topicId: string) => void
  t: ReturnType<typeof useLanguage>["t"]
}) {
  const [title,   setTitle]   = useState("")
  const [content, setContent] = useState("")
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  async function handleCreate() {
    if (!title.trim())   { setError(t.forum.titleRequiredError); return }
    if (!content.trim()) { setError(t.forum.contentRequiredError); return }

    setLoading(true); setError("")

    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.forum.loginToPost); setLoading(false); return }

    const authorName =
      (user.user_metadata?.full_name as string | undefined)
      || (user.user_metadata?.name as string | undefined)
      || user.email?.split("@")[0]
      || t.forum.anonymousUser

    const { data, error: dbErr } = await sb.from("forum_topics").insert({
      category_id: category.id,
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
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.forum.newTopicTitle}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4 }}>{category.name}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            }}>{loading ? t.forum.publishing : t.forum.publish}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ForumCategoryPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.categorySlug as string
  const { t, language } = useLanguage()

  const [category,  setCategory]  = useState<Category | null>(null)
  const [topics,    setTopics]    = useState<Topic[]>([])
  const [loaded,    setLoaded]    = useState(false)
  const [showModal, setShowModal] = useState(false)
  const [isAuthed,  setIsAuthed]  = useState(false)

  const load = useCallback(async () => {
    try {
      const sb = getSupabase()
      const { data: cat } = await sb
        .from("forum_categories").select("*").eq("slug", slug).single()

      if (!cat) { setLoaded(true); return }
      setCategory(cat as Category)

      const [{ data: tops }, { data: userData }] = await Promise.all([
        sb.from("forum_topics").select("*")
          .eq("category_id", cat.id)
          .order("is_pinned", { ascending: false })
          .order("last_reply_at", { ascending: false }),
        sb.auth.getUser(),
      ])

      if (tops) setTopics(tops as Topic[])
      setIsAuthed(!!userData?.user)
    } finally {
      setLoaded(true)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  // Live topic updates scoped to this category.
  useEffect(() => {
    if (!category) return
    const sb = getSupabase()
    const channel = sb
      .channel(`forum-category-${category.id}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "forum_topics", filter: `category_id=eq.${category.id}` },
        payload => setTopics(prev => [payload.new as Topic, ...prev]))
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "forum_topics", filter: `category_id=eq.${category.id}` },
        payload => {
          const updated = payload.new as Topic
          setTopics(prev => {
            const next = prev.map(x => x.id === updated.id ? updated : x)
            return [...next].sort((a, b) => {
              if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1
              return new Date(b.last_reply_at).getTime() - new Date(a.last_reply_at).getTime()
            })
          })
        })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [category])

  const accent = category?.color ?? T.red
  const Icon = ICON_MAP[category?.icon ?? "MessageSquare"] ?? MessageSquare

  if (loaded && !category) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 15, color: T.t2, marginBottom: 16 }}>404</div>
          <button onClick={() => router.push("/forum")} style={{
            display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px",
            borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>
            <ArrowLeft size={14} /> {t.forum.backToForum}
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

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
        <div style={{ position: "relative", padding: "32px 48px 26px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: `linear-gradient(90deg,transparent 0%,${accent}80 40%,${accent}80 60%,transparent 100%)` }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <button onClick={() => router.push("/forum")} style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 18,
              fontSize: 12, color: T.t4, background: "none", border: "none", cursor: "pointer",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
            >
              <ArrowLeft size={13} /> {t.forum.backToForum}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${accent}18`, border: `0.5px solid ${accent}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Icon size={20} style={{ color: accent }} />
                </div>
                <div>
                  <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
                    {category?.name}
                  </h1>
                  {category?.description && (
                    <p style={{ fontSize: 12.5, color: T.t3, margin: "4px 0 0" }}>{category.description}</p>
                  )}
                </div>
              </div>

              {isAuthed ? (
                <button onClick={() => setShowModal(true)} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  background: T.red, color: "#fff", border: "none",
                  borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer",
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
                }}>{t.forum.loginToPost}</button>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "22px 48px 56px", maxWidth: 1000 }}>
          {!loaded ? null : topics.length === 0 ? (
            <div style={{ padding: "64px 24px", textAlign: "center" }}>
              <MessageSquare size={26} style={{ color: T.t4, opacity: 0.4, margin: "0 auto 14px" }} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1, marginBottom: 6 }}>{t.forum.noTopicsYet}</div>
              <div style={{ fontSize: 12.5, color: T.t4, marginBottom: 22 }}>{t.forum.noTopicsHint}</div>
              {isAuthed && (
                <button onClick={() => setShowModal(true)} style={{
                  display: "inline-flex", alignItems: "center", gap: 7,
                  background: T.red, color: "#fff", border: "none",
                  borderRadius: 10, padding: "10px 22px", fontSize: 13, fontWeight: 500, cursor: "pointer",
                }}>
                  <Plus size={14} /> {t.forum.createFirstTopic}
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {topics.map(topic => (
                <Link key={topic.id} href={`/forum/topic/${topic.id}`} style={{ textDecoration: "none" }}>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 13,
                    padding: "13px 16px", borderRadius: 11,
                    background: "rgba(255,255,255,0.02)", border: "0.5px solid rgba(255,255,255,0.06)",
                    cursor: "pointer", transition: "background 130ms ease, border-color 130ms ease",
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
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: `${accent}22`, border: `0.5px solid ${accent}44`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 700, color: accent,
                    }}>
                      {initials(topic.author_name)}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                        {topic.is_pinned && <Pin size={11} style={{ color: T.red, flexShrink: 0 }} />}
                        {topic.is_locked && <Lock size={11} style={{ color: T.t4, flexShrink: 0 }} />}
                        <span style={{ fontSize: 14, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {topic.title}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ fontSize: 11, color: T.t4 }}>
                          {t.forum.startedBy} {topic.author_name ?? t.forum.anonymousUser}
                        </span>
                        <span style={{ fontSize: 11, color: "#252540" }}>·</span>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4, display: "flex", alignItems: "center", gap: 3 }}>
                          <Clock size={9} />{ago(topic.last_reply_at, t, language)}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10.5, padding: "2px 9px", borderRadius: 5,
                        background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`,
                        color: T.t3, display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <MessageSquare size={10} />{topic.reply_count}
                      </span>
                      <ChevronRight size={14} style={{ color: T.t4 }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && category && (
        <NewTopicModal
          category={category}
          onClose={() => setShowModal(false)}
          onCreated={id => { setShowModal(false); router.push(`/forum/topic/${id}`) }}
          t={t}
        />
      )}
    </>
  )
}