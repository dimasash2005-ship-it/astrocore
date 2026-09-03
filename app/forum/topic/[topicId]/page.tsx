"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  MessageSquare, Send, ArrowLeft, Clock, Lock, Pin,
  Trash2, Radio, AlertCircle, Loader2,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"
import { useIsAdmin } from "@/lib/useIsAdmin"

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
  created_at: string
}

type Post = {
  id: string
  topic_id: string
  user_id: string
  content: string
  author_name: string | null
  created_at: string
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

// ─── Message bubble ───────────────────────────────────────────────

function PostBubble({ post, accent, isOwn, isAdmin, isOriginal, onDelete, t, lang }: {
  post: { user_id: string; content: string; author_name: string | null; created_at: string }
  accent: string
  isOwn: boolean
  isAdmin?: boolean
  isOriginal?: boolean
  onDelete?: () => void
  t: ReturnType<typeof useLanguage>["t"]
  lang: Language
}) {
  return (
    <div style={{
      display: "flex", gap: 12, alignItems: "flex-start",
      padding: isOriginal ? "16px 18px" : "13px 16px",
      borderRadius: 13,
      background: isOriginal
        ? "linear-gradient(160deg,#13131F 0%,#0F0F19 100%)"
        : "rgba(255,255,255,0.02)",
      border: isOriginal ? `0.5px solid ${accent}33` : "0.5px solid rgba(255,255,255,0.06)",
      position: "relative",
    }}
      onMouseEnter={e => {
        const del = (e.currentTarget as HTMLElement).querySelector(".post-del") as HTMLElement | null
        if (del) del.style.opacity = "1"
      }}
      onMouseLeave={e => {
        const del = (e.currentTarget as HTMLElement).querySelector(".post-del") as HTMLElement | null
        if (del) del.style.opacity = "0"
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
        background: `${accent}22`, border: `0.5px solid ${accent}44`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Space Grotesk', sans-serif", fontSize: 13, fontWeight: 700, color: accent,
      }}>
        {initials(post.author_name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>
            {post.author_name ?? t.forum.anonymousUser}
          </span>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4, display: "flex", alignItems: "center", gap: 3 }}>
            <Clock size={9} />{ago(post.created_at, t, lang)}
          </span>
        </div>
        <div style={{
          fontSize: 13.5, color: T.t2, lineHeight: 1.7,
          whiteSpace: "pre-wrap", wordBreak: "break-word",
        }}>
          {post.content}
        </div>
      </div>

      {(isOwn || isAdmin) && onDelete && (
        <button className="post-del" onClick={onDelete} style={{
          opacity: 0, transition: "opacity 130ms ease",
          padding: 5, borderRadius: 6, border: "none", background: "none",
          cursor: "pointer", color: T.t4, lineHeight: 0, flexShrink: 0,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
        >
          <Trash2 size={12} />
        </button>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ForumTopicPage() {
  const params  = useParams()
  const router  = useRouter()
  const topicId = params.topicId as string
  const { t, language } = useLanguage()
  const { isAdmin } = useIsAdmin()

  const [topic,    setTopic]    = useState<Topic | null>(null)
  const [category, setCategory] = useState<Category | null>(null)
  const [posts,    setPosts]    = useState<Post[]>([])
  const [loaded,   setLoaded]   = useState(false)
  const [notFound, setNotFound] = useState(false)

  const [reply,    setReply]    = useState("")
  const [sending,  setSending]  = useState(false)
  const [error,    setError]    = useState("")
  const [userId,   setUserId]   = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)

  const load = useCallback(async () => {
    try {
      const sb = getSupabase()
      const { data: top } = await sb
        .from("forum_topics").select("*").eq("id", topicId).single()

      if (!top) { setNotFound(true); return }
      setTopic(top as Topic)

      const [{ data: cat }, { data: pos }, { data: userData }] = await Promise.all([
        sb.from("forum_categories").select("id, slug, name, color").eq("id", top.category_id).single(),
        sb.from("forum_posts").select("*").eq("topic_id", topicId).order("created_at", { ascending: true }),
        sb.auth.getUser(),
      ])

      if (cat) setCategory(cat as Category)
      if (pos) setPosts(pos as Post[])
      setUserId(userData?.user?.id ?? null)
    } finally {
      setLoaded(true)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  // Live replies: new posts from any user appear instantly. The guard
  // against duplicates matters because the sender also receives their
  // own insert event, and it may arrive before or after the optimistic
  // local append below.
  useEffect(() => {
    const sb = getSupabase()
    const channel = sb
      .channel(`forum-topic-${topicId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "forum_posts", filter: `topic_id=eq.${topicId}` },
        payload => {
          const incoming = payload.new as Post
          setPosts(prev => prev.some(p => p.id === incoming.id) ? prev : [...prev, incoming])
        })
      .on("postgres_changes",
        { event: "DELETE", schema: "public", table: "forum_posts", filter: `topic_id=eq.${topicId}` },
        payload => {
          const removed = payload.old as { id: string }
          setPosts(prev => prev.filter(p => p.id !== removed.id))
        })
      .subscribe()

    return () => { sb.removeChannel(channel) }
  }, [topicId])

  // Scroll to the newest reply as it arrives.
  useEffect(() => {
    if (posts.length > 0) bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [posts.length])

  async function handleSend() {
    if (sendingRef.current) return
    const text = reply.trim()
    if (!text || !topic) return
    if (topic.is_locked) return

    sendingRef.current = true
    setSending(true)
    setError("")

    try {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setError(t.forum.loginToPost); return }

      const authorName =
        (user.user_metadata?.full_name as string | undefined)
        || (user.user_metadata?.name as string | undefined)
        || user.email?.split("@")[0]
        || t.forum.anonymousUser

      const { data, error: dbErr } = await sb.from("forum_posts").insert({
        topic_id:    topic.id,
        user_id:     user.id,
        content:     text,
        author_name: authorName,
      }).select("*").single()

      if (dbErr || !data) { setError(dbErr?.message || t.forum.postError); return }

      // Optimistic append; the realtime handler dedupes by id if its
      // event arrives afterwards.
      setPosts(prev => prev.some(p => p.id === data.id) ? prev : [...prev, data as Post])
      setReply("")
    } catch {
      setError(t.forum.postError)
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  async function handleDeletePost(id: string) {
    if (!window.confirm(t.forum.deleteConfirm)) return
    const sb = getSupabase()
    await sb.from("forum_posts").delete().eq("id", id)
    setPosts(prev => prev.filter(p => p.id !== id))
  }

  async function handleDeleteTopic() {
    if (!topic) return
    if (!window.confirm(t.forum.deleteConfirm)) return
    const sb = getSupabase()
    await sb.from("forum_posts").delete().eq("topic_id", topic.id)
    await sb.from("forum_topics").delete().eq("id", topic.id)
    router.push(category ? `/forum/${category.slug}` : "/forum")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const accent = category?.color ?? T.red

  if (notFound) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <AlertCircle size={26} style={{ color: T.red, opacity: 0.7, margin: "0 auto 14px" }} />
          <div style={{ fontSize: 15, color: T.t2, marginBottom: 18 }}>404</div>
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
        @keyframes spin { to { transform: rotate(360deg) } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep {
          0%   { left: -20%; }
          100% { left: 100%; }
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

        {/* Header */}
        <div style={{ position: "relative", padding: "28px 48px 22px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5,
            background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none",
          }}>
            <div className="astrocore-hero-sweep" style={{
              position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
              background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
              boxShadow: `0 0 10px ${accent}D9`,
            }} />
          </div>

          <div style={{ position: "relative", zIndex: 1 }}>
            <button onClick={() => router.push(category ? `/forum/${category.slug}` : "/forum")} style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 14,
              fontSize: 12, color: T.t4, background: "none", border: "none", cursor: "pointer",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
            >
              <ArrowLeft size={13} /> {category ? category.name : t.forum.backToForum}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
              {topic?.is_pinned && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 10, padding: "2px 8px", borderRadius: 5,
                  background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.25)", color: T.red,
                }}><Pin size={9} />{t.forum.pinnedLabel}</span>
              )}
              {topic?.is_locked && (
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  fontSize: 10, padding: "2px 8px", borderRadius: 5,
                  background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t4,
                }}><Lock size={9} />{t.forum.lockedLabel}</span>
              )}
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 4,
                fontSize: 10, padding: "2px 8px", borderRadius: 5,
                background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.22)", color: T.green,
              }}><Radio size={9} />{t.forum.liveIndicator}</span>
            </div>

            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 22, fontWeight: 600, color: T.t1, margin: "10px 0 0", letterSpacing: "-0.02em", lineHeight: 1.35 }}>
              {topic?.title}
            </h1>
          </div>
        </div>

        {/* Thread */}
        <div style={{ padding: "20px 48px 32px", maxWidth: 1240 }}>
          {!loaded ? null : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {topic && (
                <PostBubble
                  post={topic}
                  accent={accent}
                  isOwn={topic.user_id === userId}
                  isAdmin={isAdmin}
                  isOriginal
                  onDelete={handleDeleteTopic}
                  t={t}
                  lang={language}
                />
              )}

              {posts.length === 0 ? (
                <div style={{ padding: "36px 0", textAlign: "center" }}>
                  <MessageSquare size={22} style={{ color: T.t4, opacity: 0.4, margin: "0 auto 10px" }} />
                  <div style={{ fontSize: 13, color: T.t4 }}>{t.forum.noRepliesYet}</div>
                  <div style={{ fontSize: 11.5, color: T.t4, opacity: 0.7, marginTop: 4 }}>{t.forum.noRepliesHint}</div>
                </div>
              ) : (
                <>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4, margin: "10px 0 2px" }}>
                    {posts.length} {t.forum.repliesLabel}
                  </div>
                  {posts.map(post => (
                    <PostBubble
                      key={post.id}
                      post={post}
                      accent={accent}
                      isOwn={post.user_id === userId}
                      isAdmin={isAdmin}
                      onDelete={() => handleDeletePost(post.id)}
                      t={t}
                      lang={language}
                    />
                  ))}
                </>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Composer */}
        <div style={{
          position: "sticky", bottom: 0,
          padding: "12px 48px 22px",
          background: "rgba(8,8,15,0.97)", backdropFilter: "blur(16px)",
          borderTop: `0.5px solid ${T.b1}`,
        }}>
          <div style={{ maxWidth: 1240 }}>
            {topic?.is_locked ? (
              <div style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "11px 14px", borderRadius: 10,
                background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
                fontSize: 12.5, color: T.t4,
              }}>
                <Lock size={13} /> {t.forum.lockedNotice}
              </div>
            ) : !userId ? (
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                padding: "11px 14px", borderRadius: 10,
                background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.18)",
              }}>
                <span style={{ fontSize: 12.5, color: T.t3 }}>{t.forum.loginToPost}</span>
                <button onClick={() => router.push("/login")} style={{
                  padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: T.red, color: "#fff", fontSize: 12.5, fontWeight: 500,
                }}>{t.forum.loginBtn}</button>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 7, marginBottom: 8,
                    padding: "7px 12px", borderRadius: 8, fontSize: 12, color: "#FF4D6A",
                    background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)",
                  }}>
                    <AlertCircle size={12} /> {error}
                  </div>
                )}
                <div style={{
                  display: "flex", alignItems: "flex-end", gap: 8,
                  background: T.s1, border: `1px solid ${T.b1}`,
                  borderRadius: 16, padding: "8px 8px 8px 14px",
                }}>
                  <textarea
                    value={reply}
                    onChange={e => {
                      setReply(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = Math.min(e.target.scrollHeight, 160) + "px"
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={t.forum.replyPlaceholder}
                    rows={1}
                    style={{
                      flex: 1, background: "none", border: "none", outline: "none",
                      fontSize: 13.5, color: T.t1, resize: "none",
                      lineHeight: 1.6, maxHeight: 160, overflow: "auto",
                      fontFamily: "inherit", padding: "5px 0",
                    }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!reply.trim() || sending}
                    style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: reply.trim() && !sending ? T.red : "rgba(255,255,255,0.07)",
                      border: "none", cursor: reply.trim() && !sending ? "pointer" : "not-allowed",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {sending
                      ? <Loader2 size={14} style={{ color: T.t4, animation: "spin 0.8s linear infinite" }} />
                      : <Send size={14} style={{ color: reply.trim() ? "#fff" : T.t4, marginLeft: 1 }} />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}