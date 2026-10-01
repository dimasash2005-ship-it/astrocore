"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  MessageSquare, Send, ArrowLeft, Clock, Lock, Pin,
  Trash2, AlertCircle, Loader2, Copy, Check, Reply, Users, CornerDownLeft,
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

function hashColor(s: string): string {
  const palette = ["#E8002A", "#8B5CF6", "#06B6D4", "#F59E0B", "#22C55E", "#EC4899", "#4285F4", "#F97316"]
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

function initials(name: string | null): string {
  if (!name) return "?"
  return name.trim().charAt(0).toUpperCase()
}

// ─── Post ─────────────────────────────────────────────────────────

function PostItem({ post, isOwn, isAdmin, isOriginal, isOP, onDelete, onQuote, t, lang, uk, index, isNew }: {
  post: { user_id: string; content: string; author_name: string | null; created_at: string }
  isOwn: boolean
  isAdmin?: boolean
  isOriginal?: boolean
  isOP?: boolean
  onDelete?: () => void
  onQuote?: () => void
  t: ReturnType<typeof useLanguage>["t"]
  lang: Language
  uk: boolean
  index: number
  isNew?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const c = hashColor(post.author_name ?? "?")
  const full = new Date(post.created_at).toLocaleString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })

  return (
    <div className={`tp-post${isOriginal ? " original" : ""}${isOwn ? " own" : ""}${isNew ? " is-new" : ""}`}
      style={{ ["--a" as string]: c, animationDelay: `${Math.min(index, 12) * 30}ms` } as React.CSSProperties}>
      <div className="tp-av">{initials(post.author_name)}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="tp-head">
          <span className="tp-name">{post.author_name ?? t.forum.anonymousUser}</span>
          {isOP && <span className="tp-tag op">{uk ? "Автор" : "OP"}</span>}
          {isOwn && <span className="tp-tag you">{uk ? "Ви" : "You"}</span>}
          <span className="tp-time" title={full}><Clock size={9} />{ago(post.created_at, t, lang)}</span>
          <div className="tp-actions">
            {onQuote && <button className="tp-icon" title={uk ? "Відповісти з цитатою" : "Quote reply"} onClick={onQuote}><Reply size={12} /></button>}
            <button className="tp-icon" title={uk ? "Копіювати" : "Copy"} onClick={() => { navigator.clipboard.writeText(post.content); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
              {copied ? <Check size={12} style={{ color: T.green }} /> : <Copy size={12} />}
            </button>
            {(isOwn || isAdmin) && onDelete && <button className="tp-icon del" title={t.forum.deleteConfirm} onClick={onDelete}><Trash2 size={12} /></button>}
          </div>
        </div>
        <div className="tp-body">
          {post.content.split("\n").map((line, i) =>
            line.startsWith("> ")
              ? <div key={i} className="tp-quote">{line.slice(2)}</div>
              : <span key={i}>{line}{"\n"}</span>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ForumTopicPage() {
  const params  = useParams()
  const router  = useRouter()
  const topicId = params.topicId as string
  const { t, language } = useLanguage()
  const uk = language === "uk"
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
  const [newIds,   setNewIds]   = useState<Set<string>>(new Set())

  const bottomRef  = useRef<HTMLDivElement>(null)
  const sendingRef = useRef(false)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const prevLen    = useRef<number | null>(null)

  const load = useCallback(async () => {
    try {
      const sb = getSupabase()
      const { data: top } = await sb.from("forum_topics").select("*").eq("id", topicId).single()
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

  useEffect(() => {
    const sb = getSupabase()
    const channel = sb
      .channel(`forum-topic-${topicId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "forum_posts", filter: `topic_id=eq.${topicId}` },
        payload => {
          const incoming = payload.new as Post
          setPosts(prev => prev.some(p => p.id === incoming.id) ? prev : [...prev, incoming])
          setNewIds(prev => new Set(prev).add(incoming.id))
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

  // Scroll down only when a NEW reply arrives — not on first open,
  // so the topic is read from the top.
  useEffect(() => {
    if (!loaded) return
    if (prevLen.current !== null && posts.length > prevLen.current) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
    }
    prevLen.current = posts.length
  }, [posts.length, loaded])

  async function handleSend() {
    if (sendingRef.current) return
    const text = reply.trim()
    if (!text || !topic || topic.is_locked) return
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
        topic_id: topic.id, user_id: user.id, content: text, author_name: authorName,
      }).select("*").single()
      if (dbErr || !data) { setError(dbErr?.message || t.forum.postError); return }
      setPosts(prev => prev.some(p => p.id === data.id) ? prev : [...prev, data as Post])
      setNewIds(prev => new Set(prev).add(data.id))
      setReply("")
      if (inputRef.current) inputRef.current.style.height = "auto"
    } catch {
      setError(t.forum.postError)
    } finally {
      setSending(false)
      sendingRef.current = false
    }
  }

  async function handleDeletePost(id: string) {
    if (!window.confirm(t.forum.deleteConfirm)) return
    await getSupabase().from("forum_posts").delete().eq("id", id)
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

  function quote(p: { content: string; author_name: string | null }) {
    const firstLines = p.content.split("\n").filter(l => !l.startsWith("> ")).join(" ").slice(0, 180)
    const q = `> ${p.author_name ?? t.forum.anonymousUser}: ${firstLines}${p.content.length > 180 ? "…" : ""}\n`
    setReply(prev => q + prev)
    setTimeout(() => {
      const el = inputRef.current
      if (!el) return
      el.focus()
      el.style.height = "auto"
      el.style.height = Math.min(el.scrollHeight, 180) + "px"
      el.setSelectionRange(el.value.length, el.value.length)
    }, 0)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const accent = category?.color ?? T.red

  const participants = useMemo(() => {
    const m = new Map<string, { name: string; count: number }>()
    if (topic) m.set(topic.user_id, { name: topic.author_name ?? "?", count: 1 })
    posts.forEach(p => {
      const cur = m.get(p.user_id)
      m.set(p.user_id, { name: p.author_name ?? cur?.name ?? "?", count: (cur?.count ?? 0) + 1 })
    })
    return Array.from(m.entries()).map(([id, v]) => ({ id, ...v })).sort((a, b) => b.count - a.count)
  }, [topic, posts])

  if (notFound) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ width: 60, height: 60, borderRadius: 18, margin: "0 auto 16px", display: "grid", placeItems: "center", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.25)" }}>
            <AlertCircle size={24} style={{ color: T.red }} />
          </div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 28, fontWeight: 600, color: T.t1, marginBottom: 6 }}>404</div>
          <div style={{ fontSize: 13, color: T.t4, marginBottom: 20 }}>{uk ? "Тему не знайдено або її видалили" : "Topic not found or deleted"}</div>
          <button onClick={() => router.push("/forum")} className="tp-btn"><ArrowLeft size={14} /> {t.forum.backToForum}</button>
        </div>
        <style>{`.tp-btn{display:inline-flex;align-items:center;gap:7px;padding:9px 18px;border-radius:10px;font-size:13px;cursor:pointer;background:rgba(255,255,255,.05);border:.5px solid ${T.b1};color:${T.t2}}`}</style>
      </div>
    )
  }

  const topicCreated = topic ? new Date(topic.created_at).toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "long", year: "numeric" }) : ""

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .tp-spin { animation: spin .8s linear infinite; }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .astrocore-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; animation: tpLive 1.8s ease-in-out infinite; }
        @keyframes tpLive { 0%, 100% { opacity: 1; box-shadow: 0 0 7px rgba(34,197,94,0.9); } 50% { opacity: 0.35; box-shadow: none; } }
        @keyframes tpIn  { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes tpNew { from { opacity: 0; transform: translateY(10px); background: rgba(232,0,42,.10); } to { opacity: 1; transform: none; } }
        @keyframes tpShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }

        .tp-back { display: inline-flex; align-items: center; gap: 6px; margin-bottom: 16px; font-size: 12px; color: ${T.t4}; background: none; border: none; cursor: pointer; padding: 0; transition: color .15s; }
        .tp-back:hover { color: ${T.t1}; }
        .tp-badge { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600;
          padding: 3px 9px; border-radius: 6px; text-transform: uppercase; letter-spacing: .05em; }

        .tp-grid { display: grid; grid-template-columns: minmax(0, 1fr) 280px; gap: 28px; align-items: start; }
        .tp-side { position: sticky; top: 20px; display: flex; flex-direction: column; gap: 18px; }
        @media (max-width: 1100px) { .tp-grid { grid-template-columns: 1fr; } .tp-side { display: none; } }

        /* thread with timeline */
        .tp-thread { position: relative; display: flex; flex-direction: column; gap: 4px; }
        .tp-thread::before { content: ""; position: absolute; left: 33px; top: 40px; bottom: 30px; width: 1px;
          background: linear-gradient(180deg, color-mix(in srgb, ${accent} 50%, transparent), rgba(255,255,255,.06) 40%, rgba(255,255,255,.04)); }

        .tp-post { position: relative; display: flex; gap: 13px; align-items: flex-start; padding: 14px 16px; border-radius: 14px;
          border: 0.5px solid transparent; animation: tpIn .4s cubic-bezier(.2,.8,.2,1) both; transition: background .15s, border-color .15s; }
        .tp-post.is-new { animation: tpNew .6s ease-out both; }
        .tp-post:hover { background: rgba(255,255,255,.02); border-color: rgba(255,255,255,.06); }
        .tp-post.own { background: linear-gradient(90deg, rgba(232,0,42,.04), transparent 60%); }
        .tp-post.original { padding: 20px 20px 18px; margin-bottom: 10px; background: linear-gradient(160deg,#13131F 0%,#0F0F19 100%);
          border-color: color-mix(in srgb, ${accent} 30%, transparent); box-shadow: 0 0 40px color-mix(in srgb, ${accent} 5%, transparent); }
        .tp-post.original::before { content: ""; position: absolute; left: 0; top: 16px; bottom: 16px; width: 2.5px; border-radius: 0 3px 3px 0; background: ${accent}; box-shadow: 0 0 10px ${accent}; }
        .tp-av { position: relative; z-index: 1; width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0; display: grid; place-items: center;
          font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #fff;
          background: linear-gradient(145deg, var(--a), color-mix(in srgb, var(--a) 65%, #000)); box-shadow: 0 0 0 3px ${T.bg}; }
        .tp-post.original .tp-av { width: 42px; height: 42px; border-radius: 13px; font-size: 16px; box-shadow: 0 0 18px color-mix(in srgb, var(--a) 40%, transparent); }
        .tp-head { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; min-height: 22px; }
        .tp-name { font-size: 13.5px; font-weight: 600; color: ${T.t1}; }
        .tp-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600; padding: 1px 6px; border-radius: 5px; text-transform: uppercase; letter-spacing: .05em; }
        .tp-tag.op { color: ${accent}; background: color-mix(in srgb, ${accent} 14%, transparent); border: 0.5px solid color-mix(in srgb, ${accent} 35%, transparent); }
        .tp-tag.you { color: ${T.t3}; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.1); }
        .tp-time { display: inline-flex; align-items: center; gap: 3px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; }
        .tp-actions { margin-left: auto; display: flex; gap: 2px; opacity: 0; transition: opacity .15s; }
        .tp-post:hover .tp-actions, .tp-post:focus-within .tp-actions { opacity: 1; }
        .tp-icon { padding: 5px; border-radius: 7px; border: none; background: rgba(255,255,255,.05); cursor: pointer; line-height: 0; color: ${T.t4}; transition: all .12s; }
        .tp-icon:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .tp-icon.del:hover { color: #FF4D6A; background: rgba(232,0,42,.14); }
        .tp-body { font-size: 14px; color: ${T.t2}; line-height: 1.75; white-space: pre-wrap; word-break: break-word; }
        .tp-post.original .tp-body { font-size: 14.5px; color: ${T.t1}; }
        .tp-quote { margin: 2px 0 8px; padding: 6px 12px; border-left: 2px solid ${accent}; border-radius: 0 8px 8px 0;
          background: rgba(255,255,255,.03); color: ${T.t3}; font-size: 12.5px; line-height: 1.55; white-space: normal; }

        .tp-divider { display: flex; align-items: center; gap: 10px; margin: 8px 0 6px 64px; font-family: 'JetBrains Mono', monospace; font-size: 10px;
          color: ${T.t4}; text-transform: uppercase; letter-spacing: .08em; }
        .tp-divider::after { content: ""; flex: 1; height: 0.5px; background: rgba(255,255,255,.07); }

        .tp-empty { margin-left: 64px; padding: 26px; border-radius: 14px; text-align: center; border: 1px dashed rgba(255,255,255,.1); }

        /* side */
        .tp-panel { border-radius: 13px; overflow: hidden; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .tp-sh { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 600; color: ${T.t1}; }
        .tp-kv { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 0.5px solid rgba(255,255,255,.05); font-size: 12.5px; color: ${T.t3}; }
        .tp-kv:last-child { border-bottom: 0; }
        .tp-kv b { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; font-weight: 600; color: ${T.t1}; }
        .tp-person { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 0.5px solid rgba(255,255,255,.05); }
        .tp-person:last-child { border-bottom: 0; }

        /* composer */
        .tp-composer { position: sticky; bottom: 0; z-index: 5; padding: 12px 48px 20px;
          background: linear-gradient(180deg, rgba(8,8,15,0) 0%, rgba(8,8,15,.92) 30%, rgba(8,8,15,.98) 100%); backdrop-filter: blur(10px); }
        .tp-box { display: flex; align-items: flex-end; gap: 10px; padding: 8px 8px 8px 12px; border-radius: 18px;
          background: ${T.s1}; border: 1px solid ${T.b1}; transition: border-color .2s, box-shadow .2s; }
        .tp-box:focus-within { border-color: rgba(232,0,42,.45); box-shadow: 0 0 0 4px rgba(232,0,42,.08), 0 10px 30px rgba(0,0,0,.4); }
        .tp-box textarea { flex: 1; background: none; border: none; outline: none; font-size: 14px; color: ${T.t1}; resize: none;
          line-height: 1.6; max-height: 180px; overflow: auto; font-family: inherit; padding: 6px 0; }
        .tp-me { width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0; display: grid; place-items: center; font-size: 12px; font-weight: 700; color: #fff; margin-bottom: 3px; }
        .tp-send { width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0; border: none; display: grid; place-items: center; transition: all .15s; }
        .tp-send.ready { background: ${T.red}; color: #fff; cursor: pointer; box-shadow: 0 0 16px rgba(232,0,42,.35); }
        .tp-send.ready:hover { background: #FF1A3E; transform: translateY(-1px); }
        .tp-send:disabled { background: rgba(255,255,255,.07); color: ${T.t4}; cursor: not-allowed; }
        .tp-hint { display: flex; align-items: center; gap: 6px; margin-top: 7px; padding-left: 4px; font-size: 10.5px; color: ${T.t4}; font-family: 'JetBrains Mono', monospace; }
        .tp-skel { height: 90px; border-radius: 14px; border: 0.5px solid ${T.b1};
          background: linear-gradient(90deg, #0F0F19 0px, #16162A 200px, #0F0F19 400px); background-size: 800px 100%; animation: tpShimmer 1.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .tp-post { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Header ── */}
        <div style={{ position: "relative", padding: "28px 48px 24px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, boxShadow: `0 0 10px ${accent}D9` }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: -60, right: -40, width: 420, height: 260, pointerEvents: "none", background: `radial-gradient(ellipse at 70% 30%, ${accent}1A 0%, transparent 65%)` }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <button className="tp-back" onClick={() => router.push(category ? `/forum/${category.slug}` : "/forum")}>
              <ArrowLeft size={13} /> {t.forum.backToForum}
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              {category && (
                <span className="tp-badge" style={{ color: accent, background: `${accent}18`, border: `0.5px solid ${accent}44` }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />{category.name}
                </span>
              )}
              {topic?.is_pinned && <span className="tp-badge" style={{ color: T.red, background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.28)" }}><Pin size={9} />{t.forum.pinnedLabel}</span>}
              {topic?.is_locked && <span className="tp-badge" style={{ color: T.t4, background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}` }}><Lock size={9} />{t.forum.lockedLabel}</span>}
              <span className="tp-badge" style={{ color: T.green, background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.24)" }}>
                <span className="astrocore-live-dot" style={{ width: 6, height: 6 }} />{t.forum.liveIndicator}
              </span>
            </div>

            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, fontWeight: 600, color: T.t1, margin: "12px 0 0", letterSpacing: "-0.02em", lineHeight: 1.3, maxWidth: 900 }}>
              {topic?.title ?? "…"}
            </h1>
            {topic && (
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, flexWrap: "wrap", fontSize: 12, color: T.t4 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 18, height: 18, borderRadius: 6, display: "grid", placeItems: "center", fontSize: 9.5, fontWeight: 700, color: "#fff", background: hashColor(topic.author_name ?? "?") }}>{initials(topic.author_name)}</span>
                  <span style={{ color: T.t2 }}>{topic.author_name ?? t.forum.anonymousUser}</span>
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Clock size={11} />{topicCreated}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><MessageSquare size={11} />{posts.length} {t.forum.repliesLabel}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Users size={11} />{participants.length}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Thread ── */}
        <div style={{ flex: 1, padding: "24px 48px 24px" }}>
          <div className="tp-grid">
            <div style={{ minWidth: 0, maxWidth: 940 }}>
              {!loaded ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div className="tp-skel" style={{ height: 140 }} /><div className="tp-skel" /><div className="tp-skel" />
                </div>
              ) : (
                <div className="tp-thread">
                  {topic && (
                    <PostItem post={topic} isOwn={topic.user_id === userId} isAdmin={isAdmin} isOriginal isOP
                      onDelete={handleDeleteTopic} onQuote={!topic.is_locked && userId ? () => quote(topic) : undefined}
                      t={t} lang={language} uk={uk} index={0} />
                  )}

                  {posts.length === 0 ? (
                    <div className="tp-empty">
                      <MessageSquare size={20} style={{ color: T.t4, opacity: 0.5, margin: "0 auto 8px", display: "block" }} />
                      <div style={{ fontSize: 13, color: T.t3 }}>{t.forum.noRepliesYet}</div>
                      <div style={{ fontSize: 11.5, color: T.t4, marginTop: 4 }}>{t.forum.noRepliesHint}</div>
                    </div>
                  ) : (
                    <>
                      <div className="tp-divider">{posts.length} {t.forum.repliesLabel}</div>
                      {posts.map((post, i) => (
                        <PostItem key={post.id} post={post}
                          isOwn={post.user_id === userId} isAdmin={isAdmin} isOP={!!topic && post.user_id === topic.user_id}
                          onDelete={() => handleDeletePost(post.id)}
                          onQuote={!topic?.is_locked && userId ? () => quote(post) : undefined}
                          isNew={newIds.has(post.id)}
                          t={t} lang={language} uk={uk} index={i + 1} />
                      ))}
                    </>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>

            {/* Side */}
            <aside className="tp-side">
              <div>
                <div className="tp-sh"><MessageSquare size={13} style={{ color: accent }} />{uk ? "Про тему" : "About"}</div>
                <div className="tp-panel">
                  <div className="tp-kv"><span>{t.forum.repliesLabel}</span><b>{posts.length}</b></div>
                  <div className="tp-kv"><span>{uk ? "Учасників" : "Participants"}</span><b>{participants.length}</b></div>
                  <div className="tp-kv"><span>{uk ? "Створено" : "Created"}</span><b>{topic ? ago(topic.created_at, t, language) : "—"}</b></div>
                  <div className="tp-kv"><span>{uk ? "Остання відповідь" : "Last reply"}</span><b>{posts.length ? ago(posts[posts.length - 1].created_at, t, language) : "—"}</b></div>
                </div>
              </div>
              {participants.length > 0 && (
                <div>
                  <div className="tp-sh"><Users size={13} style={{ color: accent }} />{uk ? "Учасники" : "Participants"}</div>
                  <div className="tp-panel">
                    {participants.slice(0, 8).map(p => {
                      const c = hashColor(p.name)
                      return (
                        <div key={p.id} className="tp-person">
                          <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(145deg, ${c}, ${c}AA)` }}>{initials(p.name)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p.name}{p.id === userId && <span style={{ color: T.t4 }}> · {uk ? "ви" : "you"}</span>}
                          </span>
                          {topic && p.id === topic.user_id && <span className="tp-tag op">{uk ? "Автор" : "OP"}</span>}
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4 }}>{p.count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </aside>
          </div>
        </div>

        {/* ── Composer ── */}
        <div className="tp-composer">
          <div style={{ maxWidth: 940 }}>
            {topic?.is_locked ? (
              <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "12px 15px", borderRadius: 13, background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`, fontSize: 12.5, color: T.t4 }}>
                <Lock size={13} /> {t.forum.lockedNotice}
              </div>
            ) : !userId ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "11px 14px", borderRadius: 13, background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
                <span style={{ fontSize: 12.5, color: T.t3 }}>{t.forum.loginToPost}</span>
                <button onClick={() => router.push("/login")} style={{ padding: "8px 16px", borderRadius: 9, border: "none", cursor: "pointer", background: T.red, color: "#fff", fontSize: 12.5, fontWeight: 500 }}>{t.forum.loginBtn}</button>
              </div>
            ) : (
              <>
                {error && (
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, padding: "8px 12px", borderRadius: 9, fontSize: 12, color: "#FF4D6A", background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
                    <AlertCircle size={12} /> {error}
                  </div>
                )}
                <div className="tp-box">
                  <textarea
                    ref={inputRef}
                    value={reply}
                    onChange={e => {
                      setReply(e.target.value)
                      e.target.style.height = "auto"
                      e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={t.forum.replyPlaceholder}
                    rows={1}
                  />
                  <button onClick={handleSend} disabled={!reply.trim() || sending} className={`tp-send${reply.trim() && !sending ? " ready" : ""}`}>
                    {sending ? <Loader2 size={15} className="tp-spin" /> : <Send size={15} style={{ marginLeft: 1 }} />}
                  </button>
                </div>
                <div className="tp-hint"><CornerDownLeft size={10} /> Enter — {uk ? "надіслати" : "send"} · Shift+Enter — {uk ? "новий рядок" : "new line"}</div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}