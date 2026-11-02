"use client"

// components/chat/MessageSearch.tsx
//
// Search inside every message of every chat (not just chat titles).
// Shown on the Chats page under the search box once 2+ letters are typed.
// Tap a result → the chat opens scrolled to that exact message, highlighted.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, MessageSquareText } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"

type Hit = { id: string; session_id: string; role: string; content: string; created_at: string }
type SessionLite = { id: string; title: string; agent_id: string | null }
type AgentLite = { id: string; name: string; avatar_color?: string | null }

const TX = {
  uk: { found: "Знайдено в повідомленнях", none: "У повідомленнях нічого не знайдено", you: "Ти", more: "Показано перші 30" },
  en: { found: "Found in messages", none: "Nothing found in messages", you: "You", more: "Showing the first 30" },
}

/** Text around the first match, with the match marked. */
function snippet(text: string, q: string): { before: string; hit: string; after: string } {
  const plain = text.replace(/!\[[^\]]*]\([^)]*\)/g, "🖼").replace(/[#>*_`~]/g, "").replace(/\s+/g, " ").trim()
  const i = plain.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return { before: plain.slice(0, 140), hit: "", after: "" }
  const start = Math.max(0, i - 50)
  return {
    before: (start > 0 ? "…" : "") + plain.slice(start, i),
    hit: plain.slice(i, i + q.length),
    after: plain.slice(i + q.length, i + q.length + 90) + (i + q.length + 90 < plain.length ? "…" : ""),
  }
}

export default function MessageSearch({ query, sessions, agents, lang, onCount }: {
  query: string
  sessions: SessionLite[]
  agents: AgentLite[]
  lang: "uk" | "en"
  onCount?: (n: number) => void
}) {
  const t = TX[lang]
  const router = useRouter()
  const q = query.trim()
  const [hits, setHits] = useState<Hit[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (q.length < 2) { setHits(null); onCount?.(0); return }
    let alive = true
    setBusy(true)
    const id = setTimeout(async () => {
      const like = `%${q.replace(/[\\%_]/g, m => "\\" + m)}%`
      const { data } = await getSupabase().from("chat_messages")
        .select("id, session_id, role, content, created_at")
        .ilike("content", like)
        .neq("content", "")
        .order("created_at", { ascending: false })
        .limit(30)
      if (!alive) return
      const list = (data ?? []) as Hit[]
      setHits(list); setBusy(false); onCount?.(list.length)
    }, 300)
    return () => { alive = false; clearTimeout(id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  if (q.length < 2) return null
  const fmt = new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", { day: "numeric", month: "short" })

  return (
    <div className="mss">
      <style>{CSS}</style>
      <div className="mss-h">
        <MessageSquareText size={13} /> {t.found}
        {busy ? <Loader2 size={12} className="mss-spin" /> : hits && <b>{hits.length}</b>}
      </div>
      {hits && hits.length === 0 && !busy && <div className="mss-none">{t.none}</div>}
      {hits && hits.length > 0 && (
        <div className="mss-list">
          {hits.map(h => {
            const s = sessions.find(x => x.id === h.session_id)
            const a = s?.agent_id ? agents.find(x => x.id === s.agent_id) : undefined
            const sn = snippet(h.content, q)
            return (
              <button key={h.id} className="mss-it" style={{ ["--c" as string]: a?.avatar_color || "#E8002A" } as React.CSSProperties}
                onClick={() => router.push(`/chat/${h.session_id}?m=${h.id}`)}>
                <div className="mss-top">
                  <span className="mss-dot" />
                  <span className="mss-title">{s?.title || "Chat"}</span>
                  <span className="mss-date">{fmt.format(new Date(h.created_at))}</span>
                </div>
                <div className="mss-text">
                  <em>{h.role === "user" ? t.you : (a?.name ?? "AI")}:</em> {sn.before}<mark>{sn.hit}</mark>{sn.after}
                </div>
              </button>
            )
          })}
          {hits.length === 30 && <div className="mss-none">{t.more}</div>}
        </div>
      )}
    </div>
  )
}

const CSS = `
.mss { margin: 4px 0 18px; padding: 12px; border-radius: 14px; background: rgba(255,255,255,.025); border: .5px solid rgba(232,0,42,.22); }
.mss-h { display: flex; align-items: center; gap: 7px; margin-bottom: 8px; font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #A8A4BC; }
.mss-h b { color: #fff; } .mss-h svg { color: #E8002A; }
.mss-spin { animation: mssSpin .8s linear infinite; } @keyframes mssSpin { to { transform: rotate(360deg); } }
.mss-none { padding: 8px 4px; font-size: 12.5px; color: #6A6A8A; }
.mss-list { display: flex; flex-direction: column; gap: 4px; max-height: 420px; overflow-y: auto; }
.mss-it { display: flex; flex-direction: column; gap: 4px; width: 100%; min-width: 0; padding: 10px 12px; border-radius: 10px; text-align: left; cursor: pointer;
  background: #0E0D17; border: .5px solid rgba(255,255,255,.07); font-family: inherit; transition: border-color .15s, background .15s; }
.mss-it:hover { border-color: color-mix(in srgb, var(--c) 50%, transparent); background: #12101B; }
.mss-top { display: flex; align-items: center; gap: 7px; min-width: 0; }
.mss-dot { width: 7px; height: 7px; border-radius: 50%; flex: none; background: var(--c); box-shadow: 0 0 8px var(--c); }
.mss-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 600; color: #F0EDF8; }
.mss-date { flex: none; font: 500 10.5px 'JetBrains Mono', monospace; color: #6A6A8A; }
.mss-text { font-size: 12.5px; line-height: 1.5; color: #A8A4BC; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.mss-text em { font-style: normal; color: #C8C4D8; }
.mss-text mark { background: rgba(232,0,42,.28); color: #fff; border-radius: 3px; padding: 0 2px; }
`
