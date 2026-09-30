"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  MessageSquare, Bot, Zap, Sparkles, HelpCircle,
  Plus, Clock, X, AlertCircle, ChevronRight,
  Lock, Pin, Trash2, Search, Flame, TrendingUp, Loader2, Users, Layers,
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

function hashColor(s: string): string {
  const palette = ["#E8002A", "#8B5CF6", "#06B6D4", "#F59E0B", "#22C55E", "#EC4899", "#4285F4", "#F97316"]
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
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

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && !loading) onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose, loading])

  async function handleCreate() {
    if (!title.trim())   { setError(t.forum.titleRequiredError); return }
    if (!content.trim()) { setError(t.forum.contentRequiredError); return }
    if (!categoryId)     { setError(t.forum.categoryRequiredError); return }
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
      category_id: categoryId, user_id: user.id,
      title: title.trim(), content: content.trim(), author_name: authorName,
    }).select("id").single()

    if (dbErr || !data) { setError(dbErr?.message || t.forum.postError); setLoading(false); return }
    onCreated(data.id)
  }

  return (
    <div className="fm-overlay" onClick={e => { if (e.target === e.currentTarget && !loading) onClose() }}>
      <div className="fm-modal">
        <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 20 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.3)", boxShadow: "0 0 18px rgba(232,0,42,0.15)" }}>
            <MessageSquare size={16} style={{ color: T.red }} />
          </div>
          <div style={{ flex: 1, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5, fontWeight: 600, color: T.t1 }}>{t.forum.newTopicTitle}</div>
          <button onClick={onClose} className="fm-x"><X size={15} /></button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label className="fm-label">{t.forum.categoryField}</label>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {categories.map(c => {
                const Icon = (c.icon && ICON_MAP[c.icon]) || MessageSquare
                const on = categoryId === c.id
                return (
                  <button key={c.id} type="button" onClick={() => setCategoryId(c.id)} className={`fm-chip${on ? " on" : ""}`}
                    style={{ ["--c" as string]: c.color ?? T.red } as React.CSSProperties}>
                    <Icon size={12} /> {c.name}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="fm-label" style={{ display: "flex", justifyContent: "space-between" }}>
              <span>{t.forum.topicTitleField}</span><span style={{ textTransform: "none", letterSpacing: 0 }}>{title.length}/200</span>
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)} autoFocus
              placeholder={t.forum.topicTitlePlaceholder} className="fm-input" maxLength={200} style={{ fontSize: 14, fontWeight: 500 }} />
          </div>

          <div>
            <label className="fm-label">{t.forum.topicContentField}</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              onKeyDown={e => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") handleCreate() }}
              placeholder={t.forum.topicContentPlaceholder} rows={7} className="fm-input" style={{ resize: "vertical", lineHeight: 1.65 }} />
            <div style={{ fontSize: 10.5, color: T.t4, marginTop: 6, fontFamily: "'JetBrains Mono', monospace" }}>⌘/Ctrl + Enter</div>
          </div>

          {error && (
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#FF4D6A", padding: "8px 11px", borderRadius: 8, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} className="fm-btn" style={{ flex: 1 }}>{t.forum.cancel}</button>
            <button onClick={handleCreate} disabled={loading} className="fm-primary" style={{ flex: 2, justifyContent: "center" }}>
              {loading ? <Loader2 size={14} className="fm-spin" /> : <Plus size={14} />} {loading ? t.forum.publishing : t.forum.publish}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────

function TopicRow({ topic, category, isNew, canDelete, onDelete, t, lang, index }: {
  topic: Topic; category?: Category; isNew?: boolean
  canDelete?: boolean; onDelete?: (id: string) => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language; index: number
}) {
  const accent = category?.color ?? T.red
  const isRecent = Date.now() - new Date(topic.last_reply_at).getTime() < RECENT_WINDOW_MS
  const hot = topic.reply_count >= 10
  const avColor = hashColor(topic.author_name ?? "?")

  return (
    <Link href={`/forum/topic/${topic.id}`} className={`fm-row${isNew ? " is-new" : ""}${topic.is_pinned ? " pinned" : ""}`}
      style={{ ["--c" as string]: accent, animationDelay: `${Math.min(index, 14) * 25}ms` } as React.CSSProperties}>
      <div className="fm-av" style={{ background: `linear-gradient(145deg, ${avColor}, ${avColor}AA)` }}>
        {initials(topic.author_name)}
        {isRecent && <span className="fm-av-live" />}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fm-title">
          {topic.is_pinned && <Pin size={12} style={{ color: T.red, flexShrink: 0 }} />}
          {topic.is_locked && <Lock size={12} style={{ color: T.t4, flexShrink: 0 }} />}
          {hot && <Flame size={12} style={{ color: "#F97316", flexShrink: 0 }} />}
          <span>{topic.title}</span>
        </div>
        {topic.content && <div className="fm-excerpt">{excerpt(topic.content, 150)}</div>}
        <div className="fm-meta">
          {category && <span className="fm-cat"><span className="d" />{category.name}</span>}
          <span>{topic.author_name ?? t.forum.anonymousUser}</span>
          <span className="dot" />
          <span className="mono">{ago(topic.last_reply_at, t, lang)}</span>
          {isRecent && <span className="fm-now">{lang === "uk" ? "активна зараз" : "active now"}</span>}
        </div>
      </div>

      <div className="fm-right">
        {canDelete && onDelete && (
          <button className="fm-del" title={t.forum.deleteConfirm}
            onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(topic.id) }}>
            <Trash2 size={12} />
          </button>
        )}
        <div className={`fm-replies${topic.reply_count > 0 ? " has" : ""}`}>
          <b>{topic.reply_count}</b>
          <span>{lang === "uk" ? "відп." : "replies"}</span>
        </div>
        <ChevronRight size={15} className="fm-go" />
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

type SortMode = "active" | "new" | "top"

export default function ForumPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const uk = language === "uk"
  const { isAdmin } = useIsAdmin()

  const [categories, setCategories]   = useState<Category[]>([])
  const [topics,     setTopics]       = useState<Topic[]>([])
  const [loaded,     setLoaded]       = useState(false)
  const [showModal,  setShowModal]    = useState(false)
  const [isAuthed,   setIsAuthed]     = useState(false)
  const [userId,     setUserId]       = useState<string | null>(null)
  const [activeCat,  setActiveCat]    = useState<string | null>(null)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)
  const [search,     setSearch]       = useState("")
  const [sort,       setSort]         = useState<SortMode>("active")

  const load = useCallback(async () => {
    try {
      const sb = getSupabase()
      const [{ data: cats }, { data: tops }, { data: userData }] = await Promise.all([
        sb.from("forum_categories").select("*").order("position", { ascending: true }),
        sb.from("forum_topics").select("*").order("last_reply_at", { ascending: false }).limit(100),
        sb.auth.getUser(),
      ])
      if (cats) setCategories(cats as Category[])
      if (tops) setTopics(tops as Topic[])
      setIsAuthed(!!userData?.user)
      setUserId(userData?.user?.id ?? null)
    } finally {
      setLoaded(true)
    }
  }, [])

  async function handleDeleteTopic(id: string) {
    if (!window.confirm(t.forum.deleteConfirm)) return
    const sb = getSupabase()
    await sb.from("forum_posts").delete().eq("topic_id", id)
    await sb.from("forum_topics").delete().eq("id", id)
    setTopics(prev => prev.filter(x => x.id !== id))
  }

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const sb = getSupabase()
    const channel = sb
      .channel("forum-home")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "forum_topics" },
        payload => {
          const incoming = payload.new as Topic
          setTopics(prev => [incoming, ...prev.filter(x => x.id !== incoming.id)].slice(0, 100))
          setJustAddedId(incoming.id)
        })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "forum_topics" },
        payload => {
          const updated = payload.new as Topic
          setTopics(prev => prev.map(x => x.id === updated.id ? updated : x))
        })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "forum_topics" },
        payload => {
          const gone = payload.old as { id?: string }
          if (gone?.id) setTopics(prev => prev.filter(x => x.id !== gone.id))
        })
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [])

  function getCategory(id: string) { return categories.find(c => c.id === id) }

  const visible = useMemo(() => {
    let list = activeCat ? topics.filter(x => x.category_id === activeCat) : topics
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(x => x.title.toLowerCase().includes(q) || (x.content ?? "").toLowerCase().includes(q) || (x.author_name ?? "").toLowerCase().includes(q))
    }
    const sorted = [...list]
    if (sort === "active") sorted.sort((a, b) => new Date(b.last_reply_at).getTime() - new Date(a.last_reply_at).getTime())
    if (sort === "new")    sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    if (sort === "top")    sorted.sort((a, b) => b.reply_count - a.reply_count)
    return sorted
  }, [topics, activeCat, search, sort])

  const pinned  = visible.filter(x => x.is_pinned)
  const regular = visible.filter(x => !x.is_pinned)
  const activeCategory = activeCat ? getCategory(activeCat) : undefined

  const totalReplies = topics.reduce((s, x) => s + x.reply_count, 0)
  const activeNow = topics.filter(x => Date.now() - new Date(x.last_reply_at).getTime() < RECENT_WINDOW_MS).length

  const topAuthors = useMemo(() => {
    const m = new Map<string, number>()
    topics.forEach(x => { const n = x.author_name ?? "?"; m.set(n, (m.get(n) ?? 0) + 1) })
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [topics])

  let idx = 0

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .astrocore-live-dot { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; animation: astrocoreLivePulse 1.8s ease-in-out infinite; }
        @keyframes astrocoreLivePulse { 0%, 100% { opacity: 1; box-shadow: 0 0 7px rgba(34,197,94,0.9), 0 0 14px rgba(34,197,94,0.4); } 50% { opacity: 0.35; box-shadow: none; } }
        @keyframes fmIn   { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes fmNew  { from { opacity: 0; transform: translateY(-8px); background: rgba(232,0,42,0.14); } to { opacity: 1; transform: none; } }
        @keyframes fmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fmPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes fmSpin { to { transform: rotate(360deg); } }
        @keyframes fmShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        .fm-spin { animation: fmSpin 1s linear infinite; }

        .fm-primary { display: inline-flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
        .fm-primary:hover:not(:disabled) { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .fm-primary:disabled { opacity: .6; cursor: default; }
        .fm-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 38px; padding: 0 14px; border-radius: 10px; cursor: pointer;
          font-size: 13px; font-family: inherit; background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t2}; transition: all .15s; }
        .fm-btn:hover { background: rgba(255,255,255,.09); color: ${T.t1}; }

        .fm-grid { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 24px; align-items: start; }
        .fm-side { display: flex; flex-direction: column; gap: 22px; position: sticky; top: 20px; }
        @media (max-width: 1100px) { .fm-grid { grid-template-columns: 1fr; } .fm-side { position: static; order: -1; } }
        .fm-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .fm-head span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }

        /* toolbar */
        .fm-bar { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 14px; }
        .fm-search { flex: 1 1 240px; display: flex; align-items: center; gap: 9px; height: 38px; padding: 0 12px; border-radius: 10px;
          background: ${T.s1}; border: 0.5px solid ${T.b1}; transition: border-color .15s, box-shadow .15s; }
        .fm-search:focus-within { border-color: rgba(232,0,42,.45); box-shadow: 0 0 0 3px rgba(232,0,42,.1); }
        .fm-search input { flex: 1; background: none; border: none; outline: none; font-size: 13px; color: ${T.t1}; font-family: inherit; }
        .fm-seg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: ${T.s1}; border: 0.5px solid ${T.b1}; }
        .fm-seg button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 7px; border: none; cursor: pointer; font-size: 12px; font-family: inherit;
          background: transparent; color: ${T.t3}; transition: background .15s, color .15s; }
        .fm-seg button:hover { color: ${T.t1}; }
        .fm-seg button.on { background: rgba(232,0,42,.14); color: #fff; box-shadow: inset 0 0 0 0.5px rgba(232,0,42,.4); }

        .fm-active-cat { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; padding: 10px 14px; border-radius: 11px;
          background: color-mix(in srgb, var(--c) 8%, transparent); border: 0.5px solid color-mix(in srgb, var(--c) 30%, transparent); }

        /* feed */
        .fm-list { border-radius: 14px; overflow: hidden; background: linear-gradient(160deg,#0F0F1A 0%,#0C0C15 100%); border: 0.5px solid ${T.b1}; }
        .fm-group { display: flex; align-items: center; gap: 8px; padding: 11px 16px 7px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600;
          color: ${T.t4}; text-transform: uppercase; letter-spacing: .09em; }
        .fm-group::after { content: ""; flex: 1; height: 0.5px; background: rgba(255,255,255,.06); }

        .fm-row { position: relative; display: flex; align-items: flex-start; gap: 13px; padding: 14px 16px; text-decoration: none; cursor: pointer;
          border-top: 0.5px solid rgba(255,255,255,.04); animation: fmIn .35s cubic-bezier(.2,.8,.2,1) both; transition: background .15s; }
        .fm-group + .fm-row { border-top: 0; }
        .fm-row.is-new { animation: fmNew .5s ease-out both; }
        .fm-row.pinned { background: linear-gradient(90deg, rgba(232,0,42,.05), transparent 50%); }
        .fm-row::before { content: ""; position: absolute; left: 0; top: 50%; width: 2.5px; height: 0; border-radius: 0 3px 3px 0; transform: translateY(-50%);
          background: var(--c); box-shadow: 0 0 10px var(--c); transition: height .2s cubic-bezier(.3,1.4,.5,1); }
        .fm-row:hover { background: linear-gradient(90deg, color-mix(in srgb, var(--c) 8%, transparent), transparent 65%); }
        .fm-row:hover::before { height: 64%; }
        .fm-av { position: relative; width: 36px; height: 36px; border-radius: 11px; flex-shrink: 0; display: grid; place-items: center;
          font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 700; color: #fff; transition: transform .2s; }
        .fm-row:hover .fm-av { transform: scale(1.06); }
        .fm-av-live { position: absolute; right: -2px; bottom: -2px; width: 10px; height: 10px; border-radius: 50%; background: ${T.green}; border: 2px solid #0E0E18;
          animation: astrocoreLivePulse 1.8s ease-in-out infinite; }
        .fm-title { display: flex; align-items: center; gap: 6px; font-size: 14px; font-weight: 600; color: ${T.t1}; margin-bottom: 4px; min-width: 0; }
        .fm-title span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fm-excerpt { font-size: 12.5px; color: ${T.t3}; line-height: 1.55; margin-bottom: 8px; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .fm-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; font-size: 11px; color: ${T.t4}; }
        .fm-meta .mono { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; }
        .fm-meta .dot { width: 3px; height: 3px; border-radius: 50%; background: #34344E; }
        .fm-cat { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
          color: var(--c); background: color-mix(in srgb, var(--c) 12%, transparent); }
        .fm-cat .d { width: 5px; height: 5px; border-radius: 50%; background: var(--c); }
        .fm-now { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.green}; padding: 1px 6px; border-radius: 5px; background: rgba(34,197,94,.1); }
        .fm-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; align-self: center; }
        .fm-replies { display: flex; flex-direction: column; align-items: center; min-width: 46px; padding: 5px 8px; border-radius: 9px;
          background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.07); }
        .fm-replies b { font-family: 'JetBrains Mono', monospace; font-size: 14px; font-weight: 600; color: ${T.t4}; line-height: 1.1; }
        .fm-replies span { font-size: 9.5px; color: ${T.t4}; }
        .fm-replies.has b { color: ${T.t1}; }
        .fm-del { padding: 6px; border-radius: 7px; border: none; background: rgba(255,255,255,.05); cursor: pointer; line-height: 0; color: ${T.t4}; opacity: 0; transition: all .15s; }
        .fm-row:hover .fm-del { opacity: 1; }
        .fm-del:hover { color: #FF4D6A; background: rgba(232,0,42,.14); }
        .fm-go { color: ${T.t4}; transition: all .2s; }
        .fm-row:hover .fm-go { color: var(--c); transform: translateX(2px); }

        /* side */
        .fm-panel { border-radius: 13px; overflow: hidden; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .fm-catrow { display: flex; align-items: center; gap: 11px; width: 100%; padding: 10px 13px; border: none; border-bottom: 0.5px solid rgba(255,255,255,.05);
          background: transparent; cursor: pointer; text-align: left; font-family: inherit; position: relative; transition: background .15s; }
        .fm-catrow:last-child { border-bottom: 0; }
        .fm-catrow:hover { background: color-mix(in srgb, var(--c) 6%, transparent); }
        .fm-catrow.on { background: color-mix(in srgb, var(--c) 12%, transparent); }
        .fm-catrow.on::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2.5px; border-radius: 0 3px 3px 0; background: var(--c); box-shadow: 0 0 8px var(--c); }
        .fm-catico { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center; flex-shrink: 0; color: var(--c);
          background: color-mix(in srgb, var(--c) 13%, transparent); border: 0.5px solid color-mix(in srgb, var(--c) 32%, transparent); }
        .fm-catname { font-size: 13px; font-weight: 500; color: ${T.t1}; }
        .fm-catdesc { font-size: 11px; color: ${T.t4}; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .fm-catcount { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: ${T.t4}; padding: 1px 7px; border-radius: 5px; background: rgba(255,255,255,.04); }

        .fm-stats { display: grid; grid-template-columns: repeat(3, 1fr); border-radius: 13px; overflow: hidden; border: 0.5px solid rgba(255,255,255,.07); background: rgba(255,255,255,.07); gap: 0.5px; }
        .fm-stat { background: #0D0D15; padding: 12px; text-align: center; }
        .fm-stat b { display: block; font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 600; color: ${T.t1}; }
        .fm-stat span { font-size: 10.5px; color: ${T.t4}; }

        .fm-author { display: flex; align-items: center; gap: 10px; padding: 9px 13px; border-bottom: 0.5px solid rgba(255,255,255,.05); }
        .fm-author:last-child { border-bottom: 0; }

        .fm-skel { height: 88px; border-top: 0.5px solid rgba(255,255,255,.04);
          background: linear-gradient(90deg, transparent 0px, rgba(255,255,255,.035) 200px, transparent 400px); background-size: 800px 100%; animation: fmShimmer 1.4s linear infinite; }

        /* modal */
        .fm-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: fmFade .18s ease-out; }
        .fm-modal { width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; border-radius: 16px; padding: 22px;
          background: linear-gradient(160deg,#111120 0%,#0C0C18 100%); border: 0.5px solid rgba(232,0,42,.28);
          box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 50px rgba(232,0,42,.07); animation: fmPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .fm-x { background: rgba(255,255,255,.04); border: none; cursor: pointer; color: ${T.t4}; line-height: 0; padding: 6px; border-radius: 8px; }
        .fm-x:hover { color: ${T.t1}; background: rgba(255,255,255,.08); }
        .fm-label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.t4}; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 8px; }
        .fm-input { width: 100%; padding: 11px 13px; border-radius: 10px; outline: none; font-size: 13.5px; font-family: inherit; color: ${T.t1};
          background: #07070D; border: 0.5px solid ${T.b1}; transition: border-color .15s, box-shadow .15s; }
        .fm-input:focus { border-color: rgba(232,0,42,.5); box-shadow: 0 0 0 3px rgba(232,0,42,.12); }
        .fm-chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 9px; cursor: pointer; font-size: 12.5px; font-family: inherit;
          background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.09); color: ${T.t3}; transition: all .15s; }
        .fm-chip:hover { color: ${T.t1}; border-color: color-mix(in srgb, var(--c) 40%, transparent); }
        .fm-chip.on { color: #fff; background: color-mix(in srgb, var(--c) 18%, transparent); border-color: color-mix(in srgb, var(--c) 60%, transparent);
          box-shadow: 0 0 16px color-mix(in srgb, var(--c) 20%, transparent); }
        .fm-chip svg { color: var(--c); }
        @media (max-width: 700px) { .fm-replies span, .fm-go { display: none; } }
        @media (prefers-reduced-motion: reduce) { .fm-row, .fm-modal { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.25)", borderRadius: 20, padding: "5px 11px 5px 9px", marginBottom: 14 }}>
                <span aria-hidden className="astrocore-live-dot" />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.green, fontWeight: 600, letterSpacing: "0.06em" }}>
                  {t.forum.liveIndicator}{activeNow > 0 ? ` · ${activeNow} ${uk ? "активних" : "active"}` : ""}
                </span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.forum.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.forum.subtitle}</p>
            </div>
            {isAuthed ? (
              <button onClick={() => setShowModal(true)} className="fm-primary"><Plus size={14} /> {t.forum.newTopic}</button>
            ) : (
              <button onClick={() => router.push("/login")} className="fm-btn">{t.forum.loginToPost}</button>
            )}
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "26px 48px 60px" }}>
          <div className="fm-grid">
            {/* Feed */}
            <div style={{ minWidth: 0 }}>
              <div className="fm-bar">
                <div className="fm-search">
                  <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder={uk ? "Пошук по темах…" : "Search topics…"} />
                  {search && <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={12} /></button>}
                </div>
                <div className="fm-seg">
                  <button className={sort === "active" ? "on" : ""} onClick={() => setSort("active")}><Clock size={12} /> {uk ? "Активні" : "Active"}</button>
                  <button className={sort === "new" ? "on" : ""} onClick={() => setSort("new")}><Sparkles size={12} /> {uk ? "Нові" : "New"}</button>
                  <button className={sort === "top" ? "on" : ""} onClick={() => setSort("top")}><TrendingUp size={12} /> {uk ? "Популярні" : "Top"}</button>
                </div>
              </div>

              {activeCategory && (
                <div className="fm-active-cat" style={{ ["--c" as string]: activeCategory.color ?? T.red } as React.CSSProperties}>
                  {(() => { const I = (activeCategory.icon && ICON_MAP[activeCategory.icon]) || MessageSquare; return <span className="fm-catico"><I size={14} /></span> })()}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fm-catname">{activeCategory.name}</div>
                    {activeCategory.description && <div className="fm-catdesc">{activeCategory.description}</div>}
                  </div>
                  <button onClick={() => setActiveCat(null)} className="fm-x"><X size={13} /></button>
                </div>
              )}

              {!loaded ? (
                <div className="fm-list">{[0, 1, 2, 3].map(i => <div key={i} className="fm-skel" style={{ animationDelay: `${i * 0.1}s` }} />)}</div>
              ) : visible.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "56px 20px", borderRadius: 14,
                  border: `1px dashed ${activeCategory?.color ?? "rgba(255,255,255,0.12)"}55`, background: "rgba(255,255,255,0.012)" }}>
                  <div style={{ width: 56, height: 56, borderRadius: 16, marginBottom: 16, display: "grid", placeItems: "center", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
                    <MessageSquare size={24} style={{ color: T.red, opacity: 0.8 }} />
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: T.t1 }}>{search ? (uk ? "Нічого не знайдено" : "Nothing found") : t.forum.noTopicsYet}</div>
                  <div style={{ fontSize: 12.5, color: T.t4, marginTop: 6, marginBottom: 18 }}>{t.forum.noTopicsHint}</div>
                  {isAuthed && !search && <button onClick={() => setShowModal(true)} className="fm-primary"><Plus size={14} /> {t.forum.newTopic}</button>}
                </div>
              ) : (
                <div className="fm-list">
                  {pinned.length > 0 && (
                    <>
                      <div className="fm-group"><Pin size={10} style={{ color: T.red }} /> {t.forum.pinnedLabel}</div>
                      {pinned.map(topic => (
                        <TopicRow key={topic.id} index={idx++} topic={topic} category={getCategory(topic.category_id)} isNew={topic.id === justAddedId}
                          canDelete={isAdmin || topic.user_id === userId} onDelete={handleDeleteTopic} t={t} lang={language} />
                      ))}
                    </>
                  )}
                  {regular.length > 0 && pinned.length > 0 && <div className="fm-group">{uk ? "Обговорення" : "Discussions"}</div>}
                  {regular.map(topic => (
                    <TopicRow key={topic.id} index={idx++} topic={topic} category={getCategory(topic.category_id)} isNew={topic.id === justAddedId}
                      canDelete={isAdmin || topic.user_id === userId} onDelete={handleDeleteTopic} t={t} lang={language} />
                  ))}
                </div>
              )}
            </div>

            {/* Side */}
            <aside className="fm-side">
              <div className="fm-stats">
                <div className="fm-stat"><b>{topics.length}</b><span>{uk ? "Тем" : "Topics"}</span></div>
                <div className="fm-stat"><b>{totalReplies}</b><span>{uk ? "Відповідей" : "Replies"}</span></div>
                <div className="fm-stat"><b style={{ color: activeNow > 0 ? T.green : undefined }}>{activeNow}</b><span>{uk ? "Зараз" : "Now"}</span></div>
              </div>

              <section>
                <div className="fm-head"><Layers size={13} style={{ color: T.red }} /><span>{uk ? "Категорії" : "Categories"}</span></div>
                <div className="fm-panel">
                  <button className={`fm-catrow${activeCat === null ? " on" : ""}`} style={{ ["--c" as string]: T.red } as React.CSSProperties} onClick={() => setActiveCat(null)}>
                    <span className="fm-catico"><Layers size={14} /></span>
                    <div style={{ flex: 1, minWidth: 0 }}><div className="fm-catname">{uk ? "Усі теми" : "All topics"}</div></div>
                    <span className="fm-catcount">{topics.length}</span>
                  </button>
                  {categories.map(cat => {
                    const Icon = (cat.icon && ICON_MAP[cat.icon]) || MessageSquare
                    const count = topics.filter(x => x.category_id === cat.id).length
                    const on = activeCat === cat.id
                    return (
                      <button key={cat.id} className={`fm-catrow${on ? " on" : ""}`} style={{ ["--c" as string]: cat.color ?? T.red } as React.CSSProperties}
                        onClick={() => setActiveCat(on ? null : cat.id)}>
                        <span className="fm-catico"><Icon size={14} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="fm-catname">{cat.name}</div>
                          {cat.description && <div className="fm-catdesc">{cat.description}</div>}
                        </div>
                        <span className="fm-catcount">{count}</span>
                      </button>
                    )
                  })}
                </div>
              </section>

              {topAuthors.length > 0 && (
                <section>
                  <div className="fm-head"><Users size={13} style={{ color: T.red }} /><span>{uk ? "Найактивніші" : "Top authors"}</span></div>
                  <div className="fm-panel">
                    {topAuthors.map(([name, n], i) => {
                      const c = hashColor(name)
                      return (
                        <div key={name} className="fm-author">
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: i === 0 ? "#F59E0B" : T.t4, width: 14 }}>{i + 1}</span>
                          <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, color: "#fff", background: `linear-gradient(145deg, ${c}, ${c}AA)` }}>{initials(name)}</span>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4 }}>{n} {uk ? "тем" : "topics"}</span>
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}
            </aside>
          </div>
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