"use client"

import {
  useState, useEffect, useRef, useCallback, memo,
  forwardRef, useImperativeHandle, useLayoutEffect,
} from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Send, Bot, Zap, Brain,
  Activity, RotateCcw, Copy, Check,
  ChevronDown, AlertCircle, Paperclip,
  Image as ImageIcon, X, BookOpen, Plus,
  Mic, Smile, FileText,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"
import VoiceComposer, { fmtDuration, type VoiceDraft } from "@/components/chat/VoiceComposer"
import VoiceMessage, { type VoiceInfo } from "@/components/chat/VoiceMessage"
import { PhotoGrid, splitImages, compressImage } from "@/components/chat/Photos"
import ReactMarkdown, { defaultUrlTransform } from "react-markdown"
import remarkGfm from "remark-gfm"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.10)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  t4:    "#585878",
  red:   "#E8002A",
  green: "#22C55E",
}

// ─── Local types ─────────────────────────────────────────────────

type Message = {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  createdAt: string
  // Client-only marker for a reply that's still being streamed in —
  // never persisted, just tells MessageBubble to show a typing
  // indicator instead of an empty bubble while content is still "".
  streaming?: boolean
  // Reply is being produced by an OpenClaw agent in the background
  // (chat_messages.status = "pending"). It's filled in via Realtime.
  jobPending?: boolean
  // Voice message (Telegram-style). content = its transcript.
  voice?: VoiceInfo
}

type DBMessage = {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
  status?: string | null
  audio_path?: string | null
  audio_duration?: number | null
  audio_peaks?: number[] | null
}

// Max characters of Memory sent to the agent with each message (newest first).
const MEMORY_CHAR_BUDGET = 12_000

// What the model sees for a voice message: a short marker + the transcript.
function historyContent(m: Message, lang: Language): string {
  if (!m.voice) return m.content
  const label = lang === "uk" ? "Голосове повідомлення" : "Voice message"
  return `[🎤 ${label}, ${fmtDuration(m.voice.duration)}]\n${m.content}`
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
  description: string
  provider_id: string | null
  system_prompt: string
  avatar_color: string
}

type Provider = {
  id: string
  name: string
  slug: string
  api_key: string
  model: string
  is_active: boolean
  // "pull" = connected through the AsCore connector (background jobs),
  // "push" / missing = old HTTPS + stream setup.
  transport?: string | null
  last_seen_at?: string | null
}

const TEXT_EXTENSIONS = new Set([
  "txt","md","json","csv","tsx","ts","js","jsx","css","html","htm",
  "xml","yaml","yml","sh","py","rb","go","rs","php","sql","env",
])

function timeStr(iso: string, lang: Language): string {
  if (!iso) return ""
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })
}

function getExt(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? ""
}

// Merges a chat_messages row (from Realtime or polling) into a local message.
function applyDbRow(m: Message, row: { content?: string | null; status?: string | null; audio_path?: string | null; audio_duration?: number | null; audio_peaks?: number[] | null }): Message {
  const pending = row.status === "pending"
  // An agent can attach a voice reply (connector → /api/agent/voice).
  const voice = row.audio_path && row.audio_path !== m.voice?.path
    ? { path: row.audio_path, duration: Number(row.audio_duration) || 0, peaks: Array.isArray(row.audio_peaks) ? row.audio_peaks : [] }
    : m.voice
  return {
    ...m,
    content:    typeof row.content === "string" ? row.content : m.content,
    streaming:  pending,
    jobPending: pending,
    voice,
  }
}

// ─── Icon button ──────────────────────────────────────────────────

function IconBtn({ icon: Icon, onClick, title, active, pulse }: {
  icon: React.ElementType; onClick?: () => void; title?: string
  active?: boolean; pulse?: boolean
}) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 30, height: 30, borderRadius: 8, border: "none",
      background: active ? "rgba(232,0,42,0.14)" : "transparent",
      cursor: "pointer",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: active ? T.red : T.t4,
      flexShrink: 0, position: "relative",
      transition: "background 120ms ease, color 120ms ease",
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"
        if (!active) (e.currentTarget as HTMLElement).style.color = T.t2
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = active ? "rgba(232,0,42,0.14)" : "transparent"
        ;(e.currentTarget as HTMLElement).style.color = active ? T.red : T.t4
      }}
    >
      <Icon size={15} />
      {pulse && (
        <span style={{
          position: "absolute", top: 4, right: 4,
          width: 6, height: 6, borderRadius: "50%",
          background: T.red,
          boxShadow: "0 0 6px rgba(232,0,42,0.9)",
          animation: "redpulse 1.2s ease infinite",
        }} />
      )}
    </button>
  )
}

// ─── Copy button ──────────────────────────────────────────────────

function CopyBtn({ text, t }: { text: string; t: ReturnType<typeof useLanguage>["t"] }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
    }} title={t.chatSession.copy} style={{
      padding: "3px 7px", borderRadius: 6, border: "none", background: "none",
      cursor: "pointer", color: T.t4, display: "flex", alignItems: "center", gap: 4,
      fontSize: 10.5, transition: "color 130ms ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
    >
      {copied ? <Check size={12} style={{ color: T.green }} /> : <Copy size={12} />}
    </button>
  )
}

function SaveVaultBtn({ content, t, lang }: { content: string; t: ReturnType<typeof useLanguage>["t"]; lang: Language }) {
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSave() {
    if (status === "loading" || status === "success") return
    setStatus("loading")
    setErrorMsg("")
    try {
      const firstLine = content.split("\n").find(l => l.trim())?.trim() ?? ""
      const locale = lang === "uk" ? "uk-UA" : "en-US"
      const title = firstLine ? firstLine.slice(0, 60) : `${t.chatSession.aiReplyFallback} — ${new Date().toLocaleString(locale)}`

      const res = await fetch("/api/vault/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || t.chatSession.vaultSaveError)

      setStatus("success")
      setTimeout(() => setStatus("idle"), 2000)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t.chatSession.serverError)
      setStatus("error")
      setTimeout(() => setStatus("idle"), 2500)
    }
  }

  const isLoading = status === "loading"
  const isSuccess = status === "success"
  const isError   = status === "error"

  return (
    <button onClick={handleSave} disabled={isLoading || isSuccess}
      title={isError ? errorMsg : t.chatSession.saveToVault}
      style={{
        padding: "3px 7px", borderRadius: 6, border: "none", background: "none",
        cursor: isLoading || isSuccess ? "default" : "pointer",
        color: isError ? "#FF4D6A" : isSuccess ? T.green : T.t4,
        display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, transition: "color 130ms ease",
      }}
      onMouseEnter={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.color = "#A78BFA" }}
      onMouseLeave={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.color = T.t4 }}
    >
      {isLoading ? (
        <RotateCcw size={12} style={{ animation: "spin 0.8s linear infinite" }} />
      ) : isSuccess ? (
        <Check size={12} style={{ color: T.green }} />
      ) : isError ? (
        <AlertCircle size={12} />
      ) : (
        <BookOpen size={12} />
      )}
      {isLoading ? t.chatSession.savingEllipsis : isSuccess ? t.chatSession.saved : isError ? t.chatSession.errorLabel : t.chatSession.vault}
    </button>
  )
}
function SaveGalleryBtn({ content, t, lang }: { content: string; t: ReturnType<typeof useLanguage>["t"]; lang: Language }) {
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSave() {
    if (status === "loading" || status === "success") return
    setStatus("loading")
    setErrorMsg("")
    try {
      const firstLine = content.split("\n").find(l => l.trim())?.trim() ?? ""
      const locale = lang === "uk" ? "uk-UA" : "en-US"
      const title = firstLine ? firstLine.slice(0, 60) : `${t.chatSession.aiReplyFallback} — ${new Date().toLocaleString(locale)}`

      const res = await fetch("/api/gallery/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, type: "text", tags: ["chat"] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || t.chatSession.gallerySaveError)

      setStatus("success")
      setTimeout(() => setStatus("idle"), 2000)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t.chatSession.serverError)
      setStatus("error")
      setTimeout(() => setStatus("idle"), 2500)
    }
  }

  const isLoading = status === "loading"
  const isSuccess = status === "success"
  const isError   = status === "error"

  return (
    <button onClick={handleSave} disabled={isLoading || isSuccess}
      title={isError ? errorMsg : t.chatSession.saveToGallery}
      style={{
        padding: "3px 7px", borderRadius: 6, border: "none", background: "none",
        cursor: isLoading || isSuccess ? "default" : "pointer",
        color: isError ? "#FF4D6A" : isSuccess ? T.green : T.t4,
        display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, transition: "color 130ms ease",
      }}
      onMouseEnter={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.color = "#7DD3FC" }}
      onMouseLeave={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.color = T.t4 }}
    >
      {isLoading ? (
        <RotateCcw size={12} style={{ animation: "spin 0.8s linear infinite" }} />
      ) : isSuccess ? (
        <Check size={12} style={{ color: T.green }} />
      ) : isError ? (
        <AlertCircle size={12} />
      ) : (
        <ImageIcon size={12} />
      )}
      {isLoading ? t.chatSession.savingEllipsis : isSuccess ? t.chatSession.saved : isError ? t.chatSession.errorLabel : t.chatSession.gallery}
    </button>
  )
}

// Real backend-backed save — unlike SaveVaultBtn/SaveGalleryBtn above
// (which write to a local-storage store), this hits the real
// POST /api/memory/save endpoint (session-authenticated).
function SaveMemoryBtn({ content, t }: { content: string; t: ReturnType<typeof useLanguage>["t"] }) {
  const [status, setStatus]     = useState<"idle" | "loading" | "success" | "error">("idle")
  const [errorMsg, setErrorMsg] = useState("")

  async function handleSave() {
    if (status === "loading" || status === "success") return
    setStatus("loading")
    setErrorMsg("")
    try {
      const firstLine = content.split("\n").find(l => l.trim())?.trim() ?? ""
      const title = firstLine ? firstLine.slice(0, 60) : t.chatSession.memoryChatTitleFallback

      const res = await fetch("/api/memory/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content, source: "chat", tags: ["chat"] }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || t.chatSession.memorySaveError)

      setStatus("success")
      setTimeout(() => setStatus("idle"), 2000)
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : t.chatSession.serverError)
      setStatus("error")
      setTimeout(() => setStatus("idle"), 2500)
    }
  }

  const isLoading = status === "loading"
  const isSuccess = status === "success"
  const isError   = status === "error"

  return (
    <button onClick={handleSave} disabled={isLoading || isSuccess}
      title={isError ? errorMsg : t.chatSession.saveToMemory}
      style={{
        padding: "3px 7px", borderRadius: 6, border: "none", background: "none",
        cursor: isLoading || isSuccess ? "default" : "pointer",
        color: isError ? "#FF4D6A" : isSuccess ? T.green : T.t4,
        display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, transition: "color 130ms ease",
      }}
      onMouseEnter={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.color = "#FBBF24" }}
      onMouseLeave={e => { if (status === "idle") (e.currentTarget as HTMLElement).style.color = T.t4 }}
    >
      {isLoading ? (
        <RotateCcw size={12} style={{ animation: "spin 0.8s linear infinite" }} />
      ) : isSuccess ? (
        <Check size={12} style={{ color: T.green }} />
      ) : isError ? (
        <AlertCircle size={12} />
      ) : (
        <Brain size={12} />
      )}
      {isLoading ? t.chatSession.savingEllipsis : isSuccess ? t.chatSession.saved : isError ? t.chatSession.errorLabel : t.chatSession.memory}
    </button>
  )
}

// ─── Markdown rendering ────────────────────────────────────────────

const mdComponents: Record<string, (props: any) => React.ReactElement> = {
  p:  ({ children }) => <p style={{ margin: "0 0 10px" }}>{children}</p>,
  strong: ({ children }) => <strong style={{ color: "#fff", fontWeight: 600 }}>{children}</strong>,
  em: ({ children }) => <em style={{ color: "inherit" }}>{children}</em>,
  h1: ({ children }) => <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 19, fontWeight: 600, margin: "16px 0 8px", color: T.t1 }}>{children}</h1>,
  h2: ({ children }) => <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 17, fontWeight: 600, margin: "14px 0 8px", color: T.t1 }}>{children}</h2>,
  h3: ({ children }) => <h3 style={{ fontSize: 15, fontWeight: 600, margin: "12px 0 6px", color: T.t1 }}>{children}</h3>,
  ul: ({ children }) => <ul style={{ margin: "4px 0 10px", paddingLeft: 22 }}>{children}</ul>,
  ol: ({ children }) => <ol style={{ margin: "4px 0 10px", paddingLeft: 22 }}>{children}</ol>,
  li: ({ children }) => <li style={{ marginBottom: 4, lineHeight: 1.65 }}>{children}</li>,
  a:  ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: "#FF7A90", textDecoration: "underline" }}>{children}</a>,
  blockquote: ({ children }) => <blockquote style={{ margin: "8px 0", padding: "2px 14px", borderLeft: "2px solid rgba(232,0,42,0.4)", color: T.t3 }}>{children}</blockquote>,
  hr: () => <div style={{ height: 1, background: "rgba(255,255,255,0.08)", margin: "14px 0" }} />,
  img: ({ src, alt }) => <img src={src} alt={alt} style={{ maxWidth: "100%", maxHeight: 360, borderRadius: 12, display: "block", margin: "8px 0", border: "0.5px solid rgba(255,255,255,0.10)" }} />,
  table: ({ children }) => <div style={{ overflowX: "auto", margin: "8px 0" }}><table style={{ borderCollapse: "collapse", fontSize: 13 }}>{children}</table></div>,
  th: ({ children }) => <th style={{ border: "0.5px solid rgba(255,255,255,0.12)", padding: "6px 10px", textAlign: "left", color: T.t2, background: "rgba(255,255,255,0.04)" }}>{children}</th>,
  td: ({ children }) => <td style={{ border: "0.5px solid rgba(255,255,255,0.10)", padding: "6px 10px", color: T.t2 }}>{children}</td>,
  code: ({ children }: any) => (
    <code style={{ background: "rgba(255,255,255,0.08)", padding: "1.5px 5px", borderRadius: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: "0.88em", color: "#FFB4C4" }}>
      {children}
    </code>
  ),
  pre: ({ children }: any) => {
    const codeChild = Array.isArray(children) ? children[0] : children
    const className = codeChild?.props?.className || ""
    const match = /language-(\w+)/.exec(className)
    const codeText = codeChild?.props?.children
    return (
      <div style={{ marginTop: 10, marginBottom: 10 }}>
        {match && (
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#7DD3FC", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>
            {match[1]}
          </div>
        )}
        <pre style={{ background: "rgba(0,0,0,0.40)", border: "0.5px solid rgba(125,211,252,0.12)", borderRadius: 8, padding: "12px 14px", fontSize: 12.5, color: "#7DD3FC", overflow: "auto", margin: 0, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
          <code>{codeText}</code>
        </pre>
      </div>
    )
  },
}

// react-markdown drops data: URLs by default — keep inline images.
function keepImageUrls(url: string): string {
  return url.startsWith("data:image/") ? url : defaultUrlTransform(url)
}

// PERF: memo — markdown is only re-parsed when the text itself changes,
// not on every render of the parent.
const Markdown = memo(function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents} urlTransform={keepImageUrls}>
      {content}
    </ReactMarkdown>
  )
})

function useTypewriter(fullText: string, active: boolean): string {
  const [revealed, setRevealed] = useState(active ? "" : fullText)

  useEffect(() => {
    if (!active) { setRevealed(fullText); return }
    setRevealed("")
    const total = Math.min(1800, Math.max(250, fullText.length * 7))
    const start = Date.now()
    const id = setInterval(() => {
      const progress = Math.min(1, (Date.now() - start) / total)
      setRevealed(fullText.slice(0, Math.floor(fullText.length * progress)))
      if (progress >= 1) clearInterval(id)
    }, 35)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullText, active])

  return revealed
}

// "Агент працює · 2:14" under a background reply that isn't finished yet.
function WorkingLabel({ since, lang }: { since: string; lang: Language }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  const startedAt = Date.parse(since)
  const sec = Number.isFinite(startedAt) ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0
  const mm = Math.floor(sec / 60)
  const ss = String(sec % 60).padStart(2, "0")
  return (
    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4 }}>
      {lang === "uk" ? "Агент працює" : "Agent is working"} · {mm}:{ss}
    </span>
  )
}

// PERF: the browser skips layout & paint for messages that are off
// screen, so a long chat costs about the same as a short one.
const OFFSCREEN_SKIP = {
  contentVisibility: "auto",
  containIntrinsicSize: "auto 160px",
} as React.CSSProperties

// PERF: memo — an existing message never re-renders unless its own
// props change (it used to re-render on every keystroke in the input).
const MessageBubble = memo(function MessageBubble({ msg, agentColor, t, lang, isNew }: { msg: Message; agentColor?: string; t: ReturnType<typeof useLanguage>["t"]; lang: Language; isNew?: boolean }) {
  const isUser  = msg.role === "user"
  const isError = msg.content.startsWith("Помилка") || msg.content.startsWith("Error") || msg.content.startsWith("Провайдер") || msg.content.startsWith("Provider")
  const isStreamingEmpty = !!msg.streaming && !msg.content

  // A streamed reply already arrives piece by piece — no typewriter on top of it,
  // and no copy/save buttons until it's complete.
  const revealed = useTypewriter(msg.content, !!isNew && !isUser && !isError && !msg.streaming)
  const displayContent = msg.streaming ? msg.content : (!isUser && !isError) ? revealed : msg.content

  const actionsRow = !msg.streaming && !isUser && (
    <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4, padding: "0 4px" }}>{timeStr(msg.createdAt, lang)}</span>
      <div className="astrocore-msg-actions" style={{ display: "flex", alignItems: "center", gap: 2 }}>
        <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />
        <CopyBtn text={msg.content} t={t} />
        <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />
        <SaveVaultBtn content={msg.content} t={t} lang={lang} />
        <SaveGalleryBtn content={msg.content} t={t} lang={lang} />
        <SaveMemoryBtn content={msg.content} t={t} />
      </div>
    </div>
  )

  if (isUser) {
    const { text: userText, images: userImages } = msg.voice ? { text: msg.content, images: [] } : splitImages(msg.content)
    return (
      <div className="astrocore-msg" style={{
        display: "flex", flexDirection: "row-reverse",
        marginBottom: 20,
        ...OFFSCREEN_SKIP,
        animation: isNew ? "msgIn 240ms ease-out" : undefined,
      }}>
        <div style={{ maxWidth: "68%", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          {userImages.length > 0 && <PhotoGrid images={userImages} />}
          {(msg.voice || userText) && <div style={{
            padding: "10px 15px",
            borderRadius: "16px 16px 4px 16px",
            background: "linear-gradient(135deg,rgba(232,0,42,0.22) 0%,rgba(232,0,42,0.12) 100%)",
            border: "0.5px solid rgba(232,0,42,0.32)",
            boxShadow: "0 4px 16px rgba(232,0,42,0.10), inset 0 1px 0 rgba(255,255,255,0.05)",
            fontSize: 14, lineHeight: 1.7, color: T.t1, wordBreak: "break-word",
          }}>
            {msg.voice
              ? <VoiceMessage voice={msg.voice} text={msg.content} lang={lang === "uk" ? "uk" : "en"} />
              : <Markdown content={userText} />}
          </div>}
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4, padding: "0 4px" }}>{timeStr(msg.createdAt, lang)}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="astrocore-msg" style={{
      display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 24,
      animation: isNew ? "msgIn 240ms ease-out" : undefined,
      ...OFFSCREEN_SKIP,
    }}>
      <div style={{
        width: 32, height: 32, borderRadius: 9, flexShrink: 0,
        background: agentColor ?? "rgba(232,0,42,0.15)",
        border: agentColor ? "none" : "0.5px solid rgba(232,0,42,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
      }}>
        <Bot size={15} style={{ color: agentColor ? "#fff" : T.red, opacity: 0.9 }} />
      </div>

      <div style={{ maxWidth: 960, minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
        {msg.voice && (
          <div style={{
            alignSelf: "flex-start", padding: "10px 14px", borderRadius: "16px 16px 16px 4px",
            background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)",
          }}>
            <VoiceMessage voice={msg.voice} text="" lang={lang === "uk" ? "uk" : "en"} />
          </div>
        )}
        {msg.voice && !msg.content.trim() && !msg.streaming ? null : isStreamingEmpty ? (
          <div style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 1px" }}>
            <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.t3, animation: "dot 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
            {msg.jobPending && <WorkingLabel since={msg.createdAt} lang={lang} />}
          </div>
        ) : (
          <div style={{
            fontSize: 15, lineHeight: 1.75,
            color: isError ? "#FF4D6A" : T.t1,
            wordBreak: "break-word",
          }}>
            <Markdown content={isError ? msg.content : displayContent} />
          </div>
        )}
        {msg.jobPending && !isStreamingEmpty && <WorkingLabel since={msg.createdAt} lang={lang} />}
        {actionsRow}
      </div>
    </div>
  )
})

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.20)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bot size={15} style={{ color: T.red, opacity: 0.8 }} />
      </div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.t3, animation: "dot 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />
        ))}
      </div>
    </div>
  )
}

function Badge({ icon: Icon, label, color, bg, border }: { icon: React.ElementType; label: string; color: string; bg: string; border: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 7, background: bg, border: `0.5px solid ${border}`, fontSize: 10.5, color, fontWeight: 500, flexShrink: 0 }}>
      <Icon size={10} />{label}
    </div>
  )
}

// ─── "+" menu and emoji picker ───────────────────────────────────

const POPOVER: React.CSSProperties = {
  position: "absolute", bottom: "calc(100% + 10px)", zIndex: 50,
  borderRadius: 14, background: "linear-gradient(160deg,#16141F 0%,#0F0F1A 100%)",
  border: "0.5px solid rgba(255,255,255,0.12)",
  boxShadow: "0 18px 50px rgba(0,0,0,0.7), 0 0 0 1px rgba(0,0,0,0.4)",
  animation: "popIn 160ms cubic-bezier(.2,.9,.3,1.2)",
}

function MenuItem({ icon: Icon, label, hint, onClick }: { icon: React.ElementType; label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 12, width: "100%", textAlign: "left",
      padding: "9px 10px", borderRadius: 10, border: "none", background: "none", cursor: "pointer", color: T.t1,
      transition: "background 120ms ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none" }}
    >
      <span style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.25)" }}>
        <Icon size={15} style={{ color: "#FF5A74" }} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 11, color: T.t4 }}>{hint}</span>
      </span>
    </button>
  )
}

// Opens from the small "+" button to the left of the message box.
function AttachMenu({ lang, onFile, onPhoto }: { lang: Language; onFile: () => void; onPhoto: () => void }) {
  const uk = lang === "uk"
  return (
    <div style={{ ...POPOVER, left: 0, width: 250, padding: 6 }}>
      <MenuItem icon={ImageIcon} label={uk ? "Фото або зображення" : "Photo or image"} hint="PNG, JPG, WEBP, GIF" onClick={onPhoto} />
      <MenuItem icon={FileText}  label={uk ? "Завантажити файл" : "Upload a file"} hint={uk ? "PDF, TXT, код, таблиці" : "PDF, TXT, code, CSV"} onClick={onFile} />
    </div>
  )
}

const EMOJIS = [
  "😀","😂","🤣","🙂","😉","😊","😍","🥰","😘","😎","🤩","🥳","🤔","🤨","😏","😅",
  "🥲","😢","😭","😤","😡","🤯","😴","🤗","🙏","👍","👎","👌","✌️","🤝","👏","🙌",
  "💪","👀","🔥","✨","⚡","💥","🚀","🎯","🏆","🎉","✅","❌","⚠️","❓","💡","📌",
  "📝","📊","📈","💰","💬","🧠","🤖","💻","📱","☕","❤️","💔","💯","🙈","😇","🫡",
]

function EmojiPicker({ onPick }: { onPick: (e: string) => void }) {
  return (
    <div style={{ ...POPOVER, right: 0, padding: 8, display: "grid", gridTemplateColumns: "repeat(8, 34px)", gap: 2, maxHeight: 260, overflowY: "auto" }}>
      {EMOJIS.map(e => (
        <button key={e} onClick={() => onPick(e)} style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "none", cursor: "pointer", fontSize: 19, lineHeight: 1 }}
          onMouseEnter={ev => { (ev.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
          onMouseLeave={ev => { (ev.currentTarget as HTMLElement).style.background = "none" }}
        >{e}</button>
      ))}
    </div>
  )
}

// Small round button that sits outside the message box ("+" and emoji).
function RoundBtn({ active, title, onClick, children }: { active: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} title={title} style={{
      width: 38, height: 38, borderRadius: "50%", flexShrink: 0, marginBottom: 7,
      display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
      background: active ? "rgba(232,0,42,0.16)" : T.s1,
      border: `1px solid ${active ? "rgba(232,0,42,0.45)" : "rgba(255,255,255,0.10)"}`,
      color: active ? T.red : T.t3,
      transition: "background 150ms ease, color 150ms ease, border-color 150ms ease",
    }}
      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t1 }}
      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = T.t3 }}
    >
      {children}
    </button>
  )
}

// Mic: tap = locked recording, hold & release = send (like Telegram).
function MicBtn({ onStart, title, disabled }: { onStart: (pressedAt: number) => void; title: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onPointerDown={e => {
        if (disabled || e.button !== 0) return
        e.preventDefault()
        onStart(Date.now())
      }}
      onKeyDown={e => {
        if (disabled) return
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStart(0) }
      }}
      onContextMenu={e => e.preventDefault()}
      style={{
        userSelect: "none", WebkitUserSelect: "none",
        width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent",
        cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center",
        color: T.t4, flexShrink: 0, touchAction: "none",
        transition: "background 120ms ease, color 120ms ease",
      }}
      onMouseEnter={e => { if (!disabled) { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.12)"; (e.currentTarget as HTMLElement).style.color = T.red } }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = T.t4 }}
    >
      <Mic size={15} />
    </button>
  )
}

// ─── Composer input ──────────────────────────────────────────────
//
// PERF: the text being typed lives ONLY here. Typing re-renders this
// small component, not the whole page with every message in it —
// that was the source of the input lag. The page talks to it through
// a ref (setText / append / clear / focus).

const SUPPORTS_FIELD_SIZING =
  typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("field-sizing", "content")

type ComposerHandle = {
  setText: (v: string) => void
  append:  (v: string, sep?: string) => void
  clear:   () => void
  focus:   () => void
  insert:  (v: string) => void
}

type ComposerInputProps = {
  onSend:         (text: string) => void
  loading:        boolean
  hasAttachments: boolean
  placeholder:    string
  sendTitle:      string
  rightSlot:      React.ReactNode   // inside the box, next to "Send"
  outsideLeft?:   React.ReactNode   // separate button left of the box
  outsideRight?:  React.ReactNode   // separate button right of the box
}

const ComposerInput = forwardRef<ComposerHandle, ComposerInputProps>(function ComposerInput(
  { onSend, loading, hasAttachments, placeholder, sendTitle, rightSlot, outsideLeft, outsideRight },
  ref,
) {
  const [text,    setText]    = useState("")
  const [focused, setFocused] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useImperativeHandle(ref, () => ({
    setText: v => setText(v),
    append:  (v, sep = " ") => setText(prev => (prev.trim() ? prev + sep + v : v)),
    clear:   () => setText(""),
    focus:   () => taRef.current?.focus(),
    // insert at the cursor (used by the emoji picker)
    insert:  v => {
      const el = taRef.current
      const val = el?.value ?? ""
      const s0 = el?.selectionStart ?? val.length
      const e0 = el?.selectionEnd ?? val.length
      setText(val.slice(0, s0) + v + val.slice(e0))
      requestAnimationFrame(() => { el?.focus(); el?.setSelectionRange(s0 + v.length, s0 + v.length) })
    },
  }), [])

  // Auto-grow. PERF: modern Chrome/Safari grow the textarea natively via
  // CSS `field-sizing: content`, with zero JS. The old trick (height=auto
  // → read scrollHeight) forced a full-page reflow of the whole chat on
  // EVERY keystroke. It's kept only as a fallback for old browsers.
  useLayoutEffect(() => {
    if (SUPPORTS_FIELD_SIZING) return
    const el = taRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 240) + "px"
  }, [text])

  const canSend = (text.trim().length > 0 || hasAttachments) && !loading
  // Short text: a slim one-line pill. Longer / multi-line text: the box
  // grows and the buttons drop to their own row under the text.
  const multiline = text.includes("\n") || text.length > 90

  // Layout like ChatGPT / Claude. "+" and emoji live outside the box.
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 10 }}>
      {outsideLeft}

      <div
        onClick={e => { if (e.target === e.currentTarget) taRef.current?.focus() }}
        style={{
          flex: 1, minWidth: 0,
          display: "flex",
          flexDirection: multiline ? "column" : "row",
          alignItems: multiline ? "stretch" : "flex-end",
          gap: multiline ? 6 : 8,
          background: focused ? "rgba(17,17,28,0.99)" : T.s1,
          border: `1px solid ${focused ? "rgba(232,0,42,0.28)" : "rgba(255,255,255,0.10)"}`,
          borderRadius: multiline ? 22 : 26,
          padding: multiline ? "14px 8px 8px 18px" : "8px 8px 8px 18px",
          boxShadow: focused ? "0 0 0 3px rgba(232,0,42,0.06), 0 8px 32px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.3)",
          transition: "border-color 180ms ease, box-shadow 180ms ease, border-radius 180ms ease",
          cursor: "text",
        }}>
        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend) onSend(text)
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          disabled={loading}
          rows={1}
          style={{
            flex: 1, width: "100%", minWidth: 0, background: "none", border: "none", outline: "none",
            fontSize: 15, color: T.t1, resize: "none",
            lineHeight: 1.6, minHeight: 24, maxHeight: 240, overflow: "auto",
            fontFamily: "inherit", padding: multiline ? "0 10px 0 0" : "6px 0",
            ...({ fieldSizing: "content" } as React.CSSProperties),
          }}
        />

        <div style={{ display: "flex", gap: 6, alignItems: "center", alignSelf: multiline ? "flex-end" : "auto", cursor: "default", flexShrink: 0 }}>
          {rightSlot}
          <button
            onClick={() => { if (canSend) onSend(text) }}
            disabled={!canSend}
            title={sendTitle}
            style={{
              width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
              background: canSend ? T.red : "rgba(255,255,255,0.07)",
              border: "none", cursor: canSend ? "pointer" : "not-allowed",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "background 150ms ease, box-shadow 150ms ease",
              boxShadow: canSend ? "0 0 18px rgba(232,0,42,0.40)" : "none",
            }}
            onMouseEnter={e => { if (canSend) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
            onMouseLeave={e => { if (canSend) (e.currentTarget as HTMLElement).style.background = T.red }}
          >
            {loading
              ? <RotateCcw size={14} style={{ color: T.t4, animation: "spin 1s linear infinite" }} />
              : <Send size={14} style={{ color: canSend ? "#fff" : T.t4, marginLeft: 1 }} />
            }
          </button>
        </div>
      </div>

      {outsideRight}
    </div>
  )
})

// ─── Page ─────────────────────────────────────────────────────────

export default function SessionPage() {
  const params    = useParams()
  const router    = useRouter()
  const sessionId = params.sessionId as string
  const { t, language } = useLanguage()

  const [session,     setSession]     = useState<Session | null>(null)
  const [agent,       setAgent]       = useState<Agent | undefined>()
  const [provider,    setProvider]    = useState<Provider | undefined>()
  const [messages,    setMessages]    = useState<Message[]>([])
  const [loading,     setLoading]     = useState(false)
  const [notFound,    setNotFound]    = useState(false)
  const [showScroll,  setShowScroll]  = useState(false)
  const [justAddedId, setJustAddedId] = useState<string | null>(null)

  const [attachments, setAttachments] = useState<{ name: string; content?: string; imageDataUrl?: string }[]>([])

  // Voice recorder open above the composer (pressedAt = for hold-to-send).
  const [voiceOpen,   setVoiceOpen]   = useState<null | { pressedAt: number }>(null)
  const [voiceNote,   setVoiceNote]   = useState("")
  const [micError,    setMicError]    = useState("")

  // which popover is open above the composer: "+" menu or emoji picker
  const [menu, setMenu] = useState<null | "attach" | "emoji">(null)

  const bottomRef   = useRef<HTMLDivElement>(null)
  const inputApi    = useRef<ComposerHandle>(null)
  const scrollRef   = useRef<HTMLDivElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const photoRef    = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  const sendingRef  = useRef(false)
  const hasScrolledInitially = useRef(false)

  // A background agent reply is still in progress in this chat.
  const hasPendingJob = messages.some(m => m.jobPending)

  const loadSession = useCallback(async () => {
    hasScrolledInitially.current = false
    const sb = getSupabase()
    const [{ data: sessionData }, { data: messagesData }] = await Promise.all([
      sb.from("chat_sessions").select("*").eq("id", sessionId).single(),
      sb.from("chat_messages").select("*").eq("session_id", sessionId).order("created_at", { ascending: true }),
    ])

    if (!sessionData) { setNotFound(true); return }
    setSession(sessionData as Session)

    const msgs: Message[] = (messagesData ?? []).map((m: DBMessage) => ({
      id:         m.id,
      role:       m.role as "user" | "assistant",
      content:    m.content,
      createdAt:  m.created_at,
      streaming:  m.status === "pending",
      jobPending: m.status === "pending",
      voice: m.audio_path ? {
        path:     m.audio_path,
        duration: Number(m.audio_duration) || 0,
        peaks:    Array.isArray(m.audio_peaks) ? m.audio_peaks : [],
      } : undefined,
    }))
    setMessages(msgs)

    if (sessionData.agent_id) {
      const { data: agentData } = await sb.from("agents").select("*").eq("id", sessionData.agent_id).single()
      if (agentData) {
        setAgent(agentData as Agent)
        if (agentData.provider_id) {
          const { data: providerData } = await sb.from("providers").select("*").eq("id", agentData.provider_id).single()
          if (providerData) setProvider(providerData as Provider)
        }
      }
    }
  }, [sessionId])

  useEffect(() => { loadSession() }, [loadSession])

  // Live updates of background agent replies (partial text, final text, errors).
  useEffect(() => {
    const sb = getSupabase()
    const channel = sb
      .channel(`chat-messages-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_messages", filter: `session_id=eq.${sessionId}` },
        payload => {
          const row = payload.new as Partial<DBMessage>
          if (!row?.id) return
          setMessages(prev => prev.map(m => (m.id === row.id ? applyDbRow(m, row) : m)))
        },
      )
      .subscribe()
    return () => { sb.removeChannel(channel) }
  }, [sessionId])

  // Safety net: if the Realtime connection drops (sleeping laptop, bad
  // network), re-read pending replies every few seconds.
  const pendingKey = messages.filter(m => m.jobPending).map(m => m.id).join(",")
  useEffect(() => {
    if (!pendingKey) return
    const ids = pendingKey.split(",")
    const timer = setInterval(async () => {
      const { data } = await getSupabase().from("chat_messages").select("id, content, status, audio_path, audio_duration, audio_peaks").in("id", ids)
      if (!data) return
      setMessages(prev => prev.map(m => {
        const row = data.find((r: { id: string }) => r.id === m.id)
        return row ? applyDbRow(m, row) : m
      }))
    }, 8000)
    return () => clearInterval(timer)
  }, [pendingKey])

  useEffect(() => {
    if (messages.length === 0) return
    if (!hasScrolledInitially.current) {
      hasScrolledInitially.current = true
      bottomRef.current?.scrollIntoView({ behavior: "auto" })
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  useEffect(() => {
    if (!menu) return
    function handler(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setMenu(null)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [menu])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
  }

  // ── File attachment ──────────────────────────────────────────────

  // Paste a screenshot (Cmd/Ctrl+V) or drop photos/files anywhere on the chat.
  const handleFilesRef = useRef<(f: FileList | null) => void>(() => {})
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = e.clipboardData?.files
      if (files && files.length > 0 && Array.from(files).some(f => f.type.startsWith("image/"))) {
        e.preventDefault()
        handleFilesRef.current(files)
      }
    }
    function onDragOver(e: DragEvent) {
      if (e.dataTransfer?.types?.includes("Files")) e.preventDefault()
    }
    function onDrop(e: DragEvent) {
      if (!e.dataTransfer?.files?.length) return
      e.preventDefault()
      handleFilesRef.current(e.dataTransfer.files)
    }
    window.addEventListener("paste", onPaste)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("paste", onPaste)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("drop", onDrop)
    }
  }, [])

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        compressImage(file)
          .then(dataUrl => setAttachments(prev => [...prev, { name: file.name || "photo.jpg", imageDataUrl: dataUrl }]))
          .catch(() => {})
        return
      }
      const ext = getExt(file.name)
      if (TEXT_EXTENSIONS.has(ext)) {
        const reader = new FileReader()
        reader.onload = ev => {
          const text = ev.target?.result as string
          setAttachments(prev => [...prev, { name: file.name, content: text }])
        }
        reader.readAsText(file, "utf-8")
      } else {
        setAttachments(prev => [...prev, { name: file.name }])
      }
    })
  }
  handleFilesRef.current = handleFiles


  // ── Voice messages ───────────────────────────────────────────

  const uk = language === "uk"

  function openRecorder(pressedAt: number) {
    if (voiceOpen) return
    setMicError("")
    setMenu(null)
    setVoiceOpen({ pressedAt })
  }

  // Upload the recording to Storage: voice/<user>/<session>/<uuid>.<ext>
  async function uploadVoice(draft: VoiceDraft, userId: string): Promise<string> {
    const ext = draft.mimeType.includes("mp4") ? "m4a" : draft.mimeType.includes("ogg") ? "ogg" : "webm"
    const path = `${userId}/${sessionId}/${crypto.randomUUID()}.${ext}`
    const { error } = await getSupabase().storage.from("voice").upload(path, draft.blob, {
      contentType: draft.mimeType.split(";")[0] || "audio/webm",
      upsert: false,
    })
    if (error) throw new Error(error.message)
    return path
  }

  // Server Whisper if configured, otherwise the browser's live text.
  async function transcribeVoice(path: string, liveText: string): Promise<string> {
    try {
      const res = await fetch("/api/voice/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path, lang: language }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && typeof data?.text === "string" && data.text.trim()) return data.text.trim()
    } catch {}
    return liveText.trim()
  }

  async function sendVoice(draft: VoiceDraft) {
    setVoiceOpen(null)
    if (sendingRef.current || loading || hasPendingJob || !session) return
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    sendingRef.current = true

    const localUrl = URL.createObjectURL(draft.blob)
    const tempId = `voice-${crypto.randomUUID()}`
    setMessages(prev => [...prev, {
      id: tempId, role: "user", content: "", createdAt: new Date().toISOString(),
      voice: { localUrl, duration: draft.duration, peaks: draft.peaks, transcribing: true },
    }])
    setJustAddedId(tempId)
    setLoading(true)

    let path: string | null = null
    try {
      path = await uploadVoice(draft, user.id)
    } catch (e) {
      // Don't lose what was said: put the live text into the box.
      setMessages(prev => prev.filter(m => m.id !== tempId))
      if (draft.liveText) inputApi.current?.append(draft.liveText, " ")
      setMicError((uk ? "Не вдалося завантажити голосове" : "Couldn't upload the voice message")
        + (e instanceof Error && e.message ? `: ${e.message}` : "")
        + (draft.liveText ? (uk ? " — текст вставлено в поле." : " — the text is in the box.") : ""))
      setLoading(false)
      sendingRef.current = false
      return
    }

    const text = await transcribeVoice(path, draft.liveText)
    if (!text) {
      setMessages(prev => prev.filter(m => m.id !== tempId))
      await sb.storage.from("voice").remove([path]).catch(() => {})
      setMicError(uk
        ? "Не вдалося розпізнати мовлення. Спробуйте ще раз або в Chrome / Safari (або додайте GROQ_API_KEY на сервері)."
        : "Couldn't recognise speech. Try again, or use Chrome / Safari (or add GROQ_API_KEY on the server).")
      setLoading(false)
      sendingRef.current = false
      return
    }

    sendingRef.current = false
    await handleSend(text, { path, localUrl, duration: draft.duration, peaks: draft.peaks })
  }

  // "Aa" in the recorder: just put the words into the box to edit.
  async function voiceToText(draft: VoiceDraft) {
    setVoiceOpen(null)
    if (draft.liveText) {
      inputApi.current?.append(draft.liveText, " ")
      inputApi.current?.focus()
      return
    }
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return
    setVoiceNote(uk ? "Розпізнаю…" : "Transcribing…")
    try {
      const path = await uploadVoice(draft, user.id)
      const text = await transcribeVoice(path, "")
      sb.storage.from("voice").remove([path]).catch(() => {})
      if (text) { inputApi.current?.append(text, " "); inputApi.current?.focus() }
      else setMicError(uk ? "Не вдалося розпізнати мовлення." : "Couldn't recognise speech.")
    } catch {
      setMicError(uk ? "Не вдалося розпізнати мовлення." : "Couldn't recognise speech.")
    } finally {
      setVoiceNote("")
    }
  }

  // ── Send ─────────────────────────────────────────────────────────

  async function handleSend(rawText: string, voice?: VoiceInfo) {
    if (sendingRef.current) return
    const text = rawText.trim()
    // A voice message goes alone; attachments stay for the next message.
    const usedAttachments = voice ? [] : attachments
    const hasAttachments = usedAttachments.length > 0
    if ((!text && !hasAttachments) || loading || hasPendingJob || !session) return
    sendingRef.current = true

    const attachmentLines = usedAttachments.map(a => {
      if (a.imageDataUrl) return `![${a.name.replace(/[\[\]()]/g, "")}](${a.imageDataUrl})`
      if (a.content !== undefined) return `${t.chatSession.fileLabel}: ${a.name}\n${a.content}`
      return `${t.chatSession.attachedFileLabel}: ${a.name}`
    })

    const fullText = [text, ...attachmentLines].filter(Boolean).join("\n\n").trim()

    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { sendingRef.current = false; return }

    const { data: userMsgData } = await sb.from("chat_messages").insert({
      user_id:    user.id,
      session_id: sessionId,
      role:       "user",
      content:    fullText,
      ...(voice ? {
        audio_path:     voice.path,
        audio_duration: Math.round(voice.duration * 10) / 10,
        audio_peaks:    voice.peaks,
      } : {}),
    }).select().single()

    const userMsg: Message = {
      id:        userMsgData?.id ?? crypto.randomUUID(),
      role:      "user",
      content:   fullText,
      createdAt: userMsgData?.created_at ?? new Date().toISOString(),
      voice,
    }

    const updatedWithUser = [...messages, userMsg]
    // History sent to the model: never include replies that are still in progress.
    const history = updatedWithUser
      .filter(m => !m.streaming)
      .map(m => ({ role: m.role, content: historyContent(m, language) }))

    setMessages(updatedWithUser)
    if (!voice) {
      setJustAddedId(userMsg.id)
      inputApi.current?.clear()
      setAttachments([])
    }
    setLoading(true)

    if (messages.length === 0) {
      await sb.from("chat_sessions").update({
        title:      ((voice ? "🎤 " : "") + (text || usedAttachments[0]?.name || t.chatSession.newChatFallback)).slice(0, 60),
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId)
    }

    async function addErrorReply(errContent: string) {
      const { data: errMsgData } = await sb.from("chat_messages").insert({
        user_id: user!.id, session_id: sessionId, role: "assistant", content: errContent,
      }).select().single()
      const errId = errMsgData?.id ?? crypto.randomUUID()
      setMessages(prev => [...prev, { id: errId, role: "assistant", content: errContent, createdAt: errMsgData?.created_at ?? new Date().toISOString() }])
      setJustAddedId(errId)
    }

    try {
      const currentAgent    = agent
      const currentProvider = provider

      if (!currentProvider) {
        await addErrorReply(t.chatSession.providerNotFoundError)
        return // `finally` below resets loading / focus
      }

      // Memory lives in the database (the Memory page), so the agent sees the
      // same context on every device. Shared items (no agent) + this agent's own.
      let memoryContext: string | null = null
      try {
        let memQuery = sb.from("memory_items")
          .select("title, content")
          .eq("user_id", user!.id)
          .order("updated_at", { ascending: false })
          .limit(40)
        memQuery = currentAgent?.id
          ? memQuery.or(`agent_id.is.null,agent_id.eq.${currentAgent.id}`)
          : memQuery.is("agent_id", null)
        const { data: memRows } = await memQuery
        const parts: string[] = []
        let used = 0
        for (const m of (memRows ?? []) as { title: string | null; content: string | null }[]) {
          const block = `[${m.title || "—"}]: ${m.content ?? ""}`.trim()
          if (used + block.length > MEMORY_CHAR_BUDGET) break
          parts.push(block)
          used += block.length + 2
        }
        if (parts.length) memoryContext = parts.join("\n\n")
      } catch {
        memoryContext = null // memory is a bonus — never block the reply
      }

      const systemPrompt = [
        currentAgent?.system_prompt || "",
        memoryContext ? `\n\n[Workspace context]:\n${memoryContext}` : "",
      ].filter(Boolean).join("")

      // ── OpenClaw via the AsCore connector: background job, no time limit ──
      // The route returns immediately; the agent fills in the reply later and
      // it arrives through Realtime (see the effects above).
      if (currentProvider.slug === "openclaw" && currentProvider.transport === "pull") {
        const jobRes = await fetch("/api/chat/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            systemPrompt,
            providerId: currentProvider.id,
            sessionId,
          }),
        })
        const jobData = await jobRes.json().catch(() => ({}))

        if (!jobRes.ok || !jobData?.messageId) {
          await addErrorReply(jobData?.error || t.chatSession.sendError)
          return
        }

        setJustAddedId(null)
        setMessages(prev => prev.some(m => m.id === jobData.messageId) ? prev : [...prev, {
          id:         jobData.messageId as string,
          role:       "assistant",
          content:    "",
          createdAt:  (jobData.createdAt as string) ?? new Date().toISOString(),
          streaming:  true,
          jobPending: true,
        }])
        return
      }

      // ── OpenClaw, old HTTPS setup: streamed reply, up to ~5 min ───────────
      // Every other provider keeps the original non-streaming path below.
      if (currentProvider.slug === "openclaw") {
        const replyId   = crypto.randomUUID()
        const startedAt = new Date().toISOString()
        setJustAddedId(null)
        setMessages(prev => [...prev, { id: replyId, role: "assistant", content: "", createdAt: startedAt, streaming: true }])

        const streamAbort = new AbortController()
        const streamTimer = setTimeout(() => streamAbort.abort(), 310_000)
        let acc = ""
        let failed: string | null = null
        let flushTimer: ReturnType<typeof setTimeout> | null = null
        const flush = () => {
          flushTimer = null
          const snapshot = acc
          setMessages(prev => prev.map(m => (m.id === replyId ? { ...m, content: snapshot } : m)))
        }

        try {
          const streamRes = await fetch("/api/chat/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: history,
              systemPrompt,
              providerId: currentProvider.id,
              sessionId,
            }),
            signal: streamAbort.signal,
          })

          if (!streamRes.ok || !streamRes.body) {
            const errData = await streamRes.json().catch(() => ({}))
            failed = errData?.error || t.chatSession.noReply
          } else {
            const reader  = streamRes.body.getReader()
            const decoder = new TextDecoder()
            for (;;) {
              const { done, value } = await reader.read()
              if (done) break
              acc += decoder.decode(value, { stream: true })
              // Batch UI updates (~16/s) instead of re-rendering on every chunk.
              if (!flushTimer) flushTimer = setTimeout(flush, 60)
            }
            acc += decoder.decode()
          }
        } catch {
          if (acc) {
            acc += language === "uk" ? "\n\n_(відповідь обірвалась)_" : "\n\n_(reply was cut off)_"
          } else {
            failed = t.chatSession.sendError
          }
        } finally {
          clearTimeout(streamTimer)
          if (flushTimer) clearTimeout(flushTimer)
        }

        const finalContent = failed ?? (acc.trim() ? acc : t.chatSession.noReply)
        setMessages(prev => prev.map(m => (m.id === replyId ? { ...m, content: finalContent, streaming: false } : m)))

        await sb.from("chat_messages").insert({
          user_id: user.id, session_id: sessionId, role: "assistant", content: finalContent,
        })
        await sb.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId)
        return // `finally` below still resets loading / focus
      }

      const abortController = new AbortController()
      const abortTimer = setTimeout(() => abortController.abort(), 55000)

      let res: Response
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history,
            systemPrompt,
            providerId: currentProvider.id,
            sessionId,
          }),
          signal: abortController.signal,
        })
      } finally {
        clearTimeout(abortTimer)
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        await addErrorReply(errData?.error || t.chatSession.noReply)
      } else {
        const data = await res.json()
        const replyContent = data.content ?? data.error ?? t.chatSession.noReply

        const { data: replyMsgData } = await sb.from("chat_messages").insert({
          user_id: user.id, session_id: sessionId, role: "assistant", content: replyContent,
        }).select().single()

        await sb.from("chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId)

        const reply: Message = {
          id:        replyMsgData?.id ?? crypto.randomUUID(),
          role:      "assistant",
          content:   replyContent,
          createdAt: replyMsgData?.created_at ?? new Date().toISOString(),
        }
        setMessages(prev => [...prev, reply])
        setJustAddedId(reply.id)
      }
    } catch {
      const errContent = t.chatSession.sendError
      await sb.from("chat_messages").insert({ user_id: user.id, session_id: sessionId, role: "assistant", content: errContent })
      const errId = crypto.randomUUID()
      setMessages(prev => [...prev, { id: errId, role: "assistant", content: errContent, createdAt: new Date().toISOString() }])
      setJustAddedId(errId)
    } finally {
      setLoading(false)
      sendingRef.current = false
      setTimeout(() => inputApi.current?.focus(), 0)
    }
  }

  if (notFound) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={26} style={{ color: T.red, opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.chatSession.sessionNotFound}</div>
          <div style={{ fontSize: 13, color: T.t3, marginBottom: 22 }}>{t.chatSession.sessionNotFoundHint}</div>
          <button onClick={() => router.push("/chat")} style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2 }}>
            <ArrowLeft size={14} /> {t.chatSession.backToAllChats}
          </button>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, height: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          {[0,1,2].map(i => (
            <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, opacity: 0.5, animation: "dot 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>
      </div>
    )
  }

  const busy = loading || hasPendingJob
  const placeholder = busy ? t.chatSession.aiRespondingPlaceholder : t.chatSession.messagePlaceholder

  return (
    <>
      <style>{`
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(200%);opacity:0} }
        @keyframes dot { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @keyframes popIn { from{opacity:0;transform:translateY(6px) scale(.97)} to{opacity:1;transform:none} }
        @keyframes redpulse { 0%,100%{box-shadow:0 0 4px rgba(232,0,42,0.8)} 50%{box-shadow:0 0 10px rgba(232,0,42,1)} }
        ::-webkit-scrollbar{width:5px} ::-webkit-scrollbar-track{background:transparent} ::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, height: "100vh",
        display: "flex", flexDirection: "column",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.028) 1px,transparent 1px)",
        backgroundSize: "28px 28px", overflow: "hidden",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.55),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 20, willChange: "transform" }} />

        {/* Header — PERF: backdropFilter removed, the background is already ~opaque so blur was invisible but costly */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 24px", borderBottom: `0.5px solid ${T.b1}`, background: "rgba(8,8,15,0.98)", flexShrink: 0, zIndex: 5, position: "relative" }}>
          <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", background: "radial-gradient(ellipse 50% 100% at 0% 50%,rgba(232,0,42,0.035) 0%,transparent 100%)" }} />
          <button onClick={() => router.push("/chat")} style={{ width: 32, height: 32, borderRadius: 8, flexShrink: 0, background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, cursor: "pointer", color: T.t3, display: "flex", alignItems: "center", justifyContent: "center" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}
          >
            <ArrowLeft size={15} />
          </button>
          {agent && (
            <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, background: agent.avatar_color ?? T.red, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", boxShadow: `0 0 12px ${agent.avatar_color ?? T.red}40` }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title || t.chatSession.newChatFallback}</div>
            {agent && <div style={{ fontSize: 11, color: T.t4, marginTop: 1 }}>{agent.name}{provider ? <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{` · ${provider.model}`}</span> : ""}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge icon={Activity} label={t.chatSession.aiCoreOnline} color={T.red} bg="rgba(232,0,42,0.09)" border="rgba(232,0,42,0.25)" />
            {provider && <Badge icon={Zap} label={t.chatSession.providerConnected} color={T.green} bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.22)" />}
            <Badge icon={Brain} label={t.chatSession.memoryLayer} color="#A78BFA" bg="rgba(167,139,250,0.08)" border="rgba(167,139,250,0.22)" />
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "28px 24px 12px" }}>
          <div style={{ maxWidth: 1240, margin: "0 auto", width: "100%" }}>
            {messages.length === 0 && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 20, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.07)" }}>
                  {agent ? <span style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{agent.name.charAt(0).toUpperCase()}</span> : <Bot size={28} style={{ color: T.red, opacity: 0.7 }} />}
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{agent ? `${t.chatSession.chatWithPrefix}${agent.name}` : t.chatSession.newChatFallback}</div>
                <div style={{ fontSize: 13.5, color: T.t3, lineHeight: 1.65, maxWidth: 380, marginBottom: 24 }}>
                  {agent?.system_prompt ? agent.system_prompt.slice(0, 120) + (agent.system_prompt.length > 120 ? "..." : "") : t.chatSession.startConversationHint}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {[t.chatSession.suggestion1, t.chatSession.suggestion2, t.chatSession.suggestion3].map(q => (
                    <button key={q} onClick={() => { inputApi.current?.setText(q); inputApi.current?.focus() }} style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t3, transition: "all 130ms ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1; (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.28)"; (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.07)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3; (e.currentTarget as HTMLElement).style.borderColor = T.b1; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} agentColor={agent?.avatar_color} t={t} lang={language} isNew={msg.id === justAddedId} />)}
            {loading && !messages.some(m => m.streaming) && <TypingDots />}
            <div ref={bottomRef} />
          </div>
        </div>

        {showScroll && (
          <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })} style={{ position: "absolute", bottom: 130, right: 28, width: 34, height: 34, borderRadius: "50%", background: T.s1, border: `0.5px solid ${T.b1}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.t3, zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
            <ChevronDown size={16} />
          </button>
        )}

        {/* Composer — PERF: backdropFilter removed (background is 97% opaque, blur was invisible but repainted on every keystroke) */}
        <div style={{ flexShrink: 0, padding: "10px 24px 18px", background: "rgba(8,8,15,0.99)" }}>
          <div ref={composerRef} style={{ maxWidth: 1240, margin: "0 auto", width: "100%", position: "relative" }}>

            {!provider && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", borderRadius: 9, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)", fontSize: 12, color: "#FF4D6A" }}>
                <AlertCircle size={13} />
                {t.chatSession.noProviderConnected}{" "}
                <button onClick={() => router.push("/providers")} style={{ color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>{t.chatSession.configure}</button>
              </div>
            )}

            {micError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "7px 12px", borderRadius: 8, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)", fontSize: 11.5, color: "#FF4D6A" }}>
                <AlertCircle size={12} /> {micError}
                <button onClick={() => setMicError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={11} /></button>
              </div>
            )}

            {voiceNote && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", fontSize: 11.5, color: T.red }}>
                <RotateCcw size={11} style={{ animation: "spin 0.9s linear infinite" }} />
                {voiceNote}
              </div>
            )}

            {attachments.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                {attachments.map((a, i) => a.imageDataUrl ? (
                  <div key={i} style={{ position: "relative", width: 64, height: 64, borderRadius: 10, overflow: "hidden", border: `0.5px solid ${T.b1}`, flexShrink: 0 }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.imageDataUrl} alt={a.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} title={language === "uk" ? "Прибрати" : "Remove"} style={{
                      position: "absolute", top: 3, right: 3, width: 20, height: 20, borderRadius: "50%", border: "none", cursor: "pointer",
                      background: "rgba(0,0,0,0.65)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                    }}><X size={11} /></button>
                  </div>
                ) : (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, fontSize: 11.5, color: T.t2, maxWidth: 220 }}>
                    {a.imageDataUrl ? (
                      <img src={a.imageDataUrl} alt={a.name} style={{ width: 18, height: 18, borderRadius: 4, objectFit: "cover", flexShrink: 0 }} />
                    ) : (
                      <Paperclip size={11} style={{ color: T.t4, flexShrink: 0 }} />
                    )}
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    {a.content !== undefined && <span style={{ fontSize: 9.5, color: T.t4, flexShrink: 0 }}>txt</span>}
                    {a.imageDataUrl && <span style={{ fontSize: 9.5, color: T.t4, flexShrink: 0 }}>img</span>}
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 0, flexShrink: 0 }}><X size={10} /></button>
                  </div>
                ))}
              </div>
            )}

            {menu === "attach" && (
              <AttachMenu
                lang={language}
                onPhoto={() => { setMenu(null); photoRef.current?.click() }}
                onFile={() => { setMenu(null); fileRef.current?.click() }}
              />
            )}
            {menu === "emoji" && (
              <EmojiPicker onPick={e => inputApi.current?.insert(e)} />
            )}

            {voiceOpen && (
              <VoiceComposer
                lang={uk ? "uk" : "en"}
                pressedAt={voiceOpen.pressedAt}
                onSend={sendVoice}
                onToText={voiceToText}
                onCancel={() => setVoiceOpen(null)}
                onError={msg => { setVoiceOpen(null); setMicError(msg) }}
              />
            )}

            {/* Kept mounted while recording so typed text isn't lost. */}
            <div style={{ display: voiceOpen ? "none" : "block" }}>
            <ComposerInput
              ref={inputApi}
              onSend={handleSend}
              loading={busy}
              hasAttachments={attachments.length > 0}
              placeholder={placeholder}
              sendTitle={t.chatSession.send}
              outsideLeft={
                <RoundBtn
                  active={menu === "attach"}
                  title={language === "uk" ? "Додати фото або файл" : "Add photo or file"}
                  onClick={() => setMenu(m => m === "attach" ? null : "attach")}
                >
                  <Plus size={17} style={{ transition: "transform 200ms ease", transform: menu === "attach" ? "rotate(45deg)" : "none" }} />
                </RoundBtn>
              }
              outsideRight={
                <RoundBtn
                  active={menu === "emoji"}
                  title={language === "uk" ? "Смайлики" : "Emoji"}
                  onClick={() => setMenu(m => m === "emoji" ? null : "emoji")}
                >
                  <Smile size={17} />
                </RoundBtn>
              }
              rightSlot={
                <MicBtn
                  disabled={busy}
                  title={uk ? "Голосове повідомлення — натисніть, або утримуйте і відпустіть, щоб одразу надіслати" : "Voice message — tap, or hold and release to send right away"}
                  onStart={openRecorder}
                />
              }
            />
            </div>

            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv,.tsx,.ts,.js,.jsx,.css,.html,.xml,.yaml,.yml,.sh,.py,.rb,.go,.rs,.php,.sql,.env"
              style={{ display: "none" }}
              onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
            />
            <input
              ref={photoRef}
              type="file"
              multiple
              accept="image/*"
              style={{ display: "none" }}
              onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
            />

          </div>
        </div>
      </div>
    </>
  )
}