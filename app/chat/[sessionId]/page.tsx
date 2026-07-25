"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Send, Bot, Zap, Brain,
  Activity, RotateCcw, Copy, Check,
  ChevronDown, AlertCircle, Paperclip,
  Image as ImageIcon, X, BookOpen, Plus,
  Mic, MicOff, Globe, Wrench,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { QuickActions } from "@/components/agents/QuickActions"
import { getAgentSkills } from "@/components/agents/skillRegistry"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

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
}

type DBMessage = {
  id: string
  session_id: string
  role: string
  content: string
  created_at: string
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
}

type SpeechRecognitionConstructor = new () => {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  onresult: ((event: any) => void) | null
  onerror:  ((event: Event) => void) | null
  onend:    (() => void) | null
}

type SpeechWindow = Window & typeof globalThis & {
  SpeechRecognition?:       SpeechRecognitionConstructor
  webkitSpeechRecognition?: SpeechRecognitionConstructor
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

// ─── Message bubble ───────────────────────────────────────────────

function MessageBubble({ msg, agentColor, t, lang }: { msg: Message; agentColor?: string; t: ReturnType<typeof useLanguage>["t"]; lang: Language }) {
  const isUser  = msg.role === "user"
  const isError = msg.content.startsWith("Помилка") || msg.content.startsWith("Error") || msg.content.startsWith("Провайдер") || msg.content.startsWith("Provider")
  const isStreamingEmpty = !!msg.streaming && !msg.content
  const parts   = msg.content.split(/(```[\s\S]*?```|!\[[^\]]*\]\(data:image\/[^)]+\))/g)

  return (
    <div style={{
      display: "flex", flexDirection: isUser ? "row-reverse" : "row",
      gap: 12, alignItems: "flex-start", marginBottom: 20,
    }}>
      {!isUser && (
        <div style={{
          width: 32, height: 32, borderRadius: 9, flexShrink: 0,
          background: agentColor ?? "rgba(232,0,42,0.15)",
          border: agentColor ? "none" : "0.5px solid rgba(232,0,42,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center", marginTop: 2,
        }}>
          <Bot size={15} style={{ color: agentColor ? "#fff" : T.red, opacity: 0.9 }} />
        </div>
      )}
      <div style={{
        maxWidth: isUser ? "68%" : "82%",
        display: "flex", flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start", gap: 6,
      }}>
        <div style={{
          padding: isUser ? "10px 15px" : "12px 16px",
          borderRadius: isUser ? "16px 16px 4px 16px" : "4px 16px 16px 16px",
          background: isUser
            ? "linear-gradient(135deg,rgba(232,0,42,0.22) 0%,rgba(232,0,42,0.12) 100%)"
            : isError ? "rgba(232,0,42,0.07)"
            : "linear-gradient(160deg,#15151F 0%,#111118 100%)",
          border: isUser ? "0.5px solid rgba(232,0,42,0.32)"
            : isError ? "0.5px solid rgba(232,0,42,0.22)"
            : "0.5px solid rgba(255,255,255,0.08)",
          fontSize: 14, lineHeight: 1.7,
          color: isUser ? T.t1 : isError ? "#FF4D6A" : T.t1,
          wordBreak: "break-word",
        }}>
          {isStreamingEmpty ? (
            <div style={{ display: "flex", gap: 5, alignItems: "center", padding: "3px 1px" }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 5, height: 5, borderRadius: "50%", background: T.t3, animation: "dot 1.2s ease infinite", animationDelay: `${i * 0.2}s` }} />
              ))}
            </div>
          ) : parts.map((part, i) => {
            if (part.startsWith("```") && part.endsWith("```")) {
              const lines = part.slice(3, -3).split("\n")
              const lang  = lines[0].trim()
              const code  = lines.slice(1).join("\n")
              return (
                <div key={i} style={{ marginTop: 10, marginBottom: 4 }}>
                  {lang && <div style={{ fontSize: 10, color: "#7DD3FC", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em", opacity: 0.7 }}>{lang}</div>}
                  <pre style={{ background: "rgba(0,0,0,0.40)", border: "0.5px solid rgba(125,211,252,0.12)", borderRadius: 8, padding: "12px 14px", fontSize: 12.5, color: "#7DD3FC", overflow: "auto", margin: 0, fontFamily: "monospace", lineHeight: 1.6 }}>
                    {code}
                  </pre>
                </div>
              )
            }
            const imgMatch = part.match(/^!\[([^\]]*)\]\((data:image\/[^)]+)\)$/)
            if (imgMatch) {
              const [, alt, src] = imgMatch
              return (
                <div key={i} style={{ marginTop: 8, marginBottom: 4 }}>
                  <img src={src} alt={alt}
                    style={{ maxWidth: "100%", maxHeight: 340, borderRadius: 12, display: "block", border: "0.5px solid rgba(255,255,255,0.10)" }}
                  />
                </div>
              )
            }
            return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>
          })}
        </div>
        {!isStreamingEmpty && (
        <div style={{ display: "flex", alignItems: "center", gap: 2, flexDirection: isUser ? "row-reverse" : "row" }}>
          <span style={{ fontSize: 10, color: T.t4, padding: "0 4px" }}>{timeStr(msg.createdAt, lang)}</span>
          {!isUser && (
            <>
              <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />
              <CopyBtn text={msg.content} t={t} />
              <div style={{ width: 1, height: 12, background: "rgba(255,255,255,0.08)", margin: "0 2px" }} />
              <SaveVaultBtn content={msg.content} t={t} lang={lang} />
              <SaveGalleryBtn content={msg.content} t={t} lang={lang} />
              <SaveMemoryBtn content={msg.content} t={t} />
            </>
          )}
        </div>
        )}
      </div>
    </div>
  )
}

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 20 }}>
      <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.20)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Bot size={15} style={{ color: T.red, opacity: 0.8 }} />
      </div>
      <div style={{ padding: "12px 18px", borderRadius: "4px 16px 16px 16px", background: "linear-gradient(160deg,#15151F 0%,#111118 100%)", border: "0.5px solid rgba(255,255,255,0.08)", display: "flex", gap: 5, alignItems: "center", marginTop: 2 }}>
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

// ─── Tools panel ─────────────────────────────────────────────────

function ToolsPanel({ onAction, onClose, t }: { onAction: (text: string) => void; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  const QUICK_ACTIONS = [
    t.chatSession.quickAction1,
    t.chatSession.quickAction2,
    t.chatSession.quickAction3,
    t.chatSession.quickAction4,
  ]
  return (
    <div style={{
      position: "absolute", bottom: "calc(100% + 8px)", left: 0,
      width: 220, borderRadius: 12,
      background: "linear-gradient(160deg,#14141F 0%,#0F0F1A 100%)",
      border: "0.5px solid rgba(232,0,42,0.22)",
      boxShadow: "0 16px 48px rgba(0,0,0,0.7)",
      zIndex: 50, overflow: "hidden",
    }}>
      <div style={{ padding: "9px 12px 7px", borderBottom: "0.5px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.chatSession.quickActions}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 2 }}>
          <X size={12} />
        </button>
      </div>
      <div style={{ padding: "6px 6px 8px" }}>
        {QUICK_ACTIONS.map(action => (
          <button key={action} onClick={() => { onAction(action); onClose() }} style={{
            display: "block", width: "100%", textAlign: "left",
            padding: "8px 10px", borderRadius: 8, fontSize: 12.5,
            background: "none", border: "none", cursor: "pointer", color: T.t2,
            transition: "background 120ms ease",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none" }}
          >
            {action}
          </button>
        ))}
      </div>
    </div>
  )
}

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
  const [input,       setInput]       = useState("")
  const [loading,     setLoading]     = useState(false)
  const [notFound,    setNotFound]    = useState(false)
  const [showScroll,  setShowScroll]  = useState(false)
  const [focused,     setFocused]     = useState(false)

  // Attachments: name + optional text content
  const [attachments, setAttachments] = useState<{ name: string; content?: string; imageDataUrl?: string }[]>([])

  // Microphone
  const [isListening, setIsListening] = useState(false)
  const [micError,    setMicError]    = useState("")
  const recognitionRef = useRef<{ stop: () => void } | null>(null)

  // Web mode toggle
  const [webMode, setWebMode] = useState(false)

  // Tools panel
  const [showTools, setShowTools] = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)
  // Synchronous re-entrancy guard for handleSend. `loading` (React state)
  // updates asynchronously, so if handleSend fires twice in the same tick
  // — double Enter, IME composition sending a duplicate keydown, a fast
  // double-click — the second call can read the still-stale `loading`
  // value and slip through, firing a second AI request/insert. A ref is
  // checked and set synchronously, so the second call is blocked
  // immediately regardless of what triggered it.
  const sendingRef = useRef(false)

  // On first opening a session, jump straight to the bottom with no
  // visible animation — nobody wants to watch the page glide down past
  // old messages every time they open a chat. Once that first jump has
  // happened, later message updates (sending, receiving a reply) still
  // scroll smoothly, since those really do benefit from the animation.
  // Reset inside loadSession (not just on mount) so switching to a
  // different chat also gets the instant jump, not just the first one
  // ever opened.
  const hasScrolledInitially = useRef(false)

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
      id:        m.id,
      role:      m.role as "user" | "assistant",
      content:   m.content,
      createdAt: m.created_at,
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

  useEffect(() => {
    if (messages.length === 0) return
    if (!hasScrolledInitially.current) {
      hasScrolledInitially.current = true
      bottomRef.current?.scrollIntoView({ behavior: "auto" })
      return
    }
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  // Close tools panel on outside click
  useEffect(() => {
    if (!showTools) return
    function handler(e: MouseEvent) {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        setShowTools(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [showTools])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
  }

  // ── File attachment ──────────────────────────────────────────────

  function handleFiles(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach(file => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader()
        reader.onload = ev => {
          const dataUrl = ev.target?.result as string
          setAttachments(prev => [...prev, { name: file.name, imageDataUrl: dataUrl }])
        }
        reader.readAsDataURL(file)
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

  // ── Microphone ───────────────────────────────────────────────────

  function toggleMic() {
    setMicError("")

    const SpeechRecognitionClass = typeof window !== "undefined"
      ? (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition
      : undefined

    if (!SpeechRecognitionClass) {
      setMicError(t.chatSession.micNotSupported)
      return
    }

    if (isListening) {
      recognitionRef.current?.stop()
      setIsListening(false)
      return
    }

    const rec = new SpeechRecognitionClass()
    rec.lang = language === "uk" ? "uk-UA" : "en-US"
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (ev: any) => {
      const transcript = ev.results[0]?.[0]?.transcript ?? ""
      if (transcript) {
        setInput(prev => (prev ? prev + " " + transcript : transcript))
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.style.height = "auto"
            inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px"
          }
        }, 0)
      }
    }
    rec.onerror = () => { setIsListening(false) }
    rec.onend   = () => { setIsListening(false) }
    rec.start()
    recognitionRef.current = rec
    setIsListening(true)
  }

  // ── Send ─────────────────────────────────────────────────────────

  async function handleSend() {
    if (sendingRef.current) return
    const text = input.trim()
    const hasAttachments = attachments.length > 0
    if ((!text && !hasAttachments) || loading || !session) return
    sendingRef.current = true

    const attachmentLines = attachments.map(a => {
      if (a.imageDataUrl) return `![${a.name}](${a.imageDataUrl})`
      if (a.content !== undefined) return `${t.chatSession.fileLabel}: ${a.name}\n${a.content}`
      return `${t.chatSession.attachedFileLabel}: ${a.name}`
    })

    const webNote = webMode
      ? "\n\n[Note: The user enabled Web mode, but real web search isn't connected yet.]"
      : ""

    const fullText = [text, ...attachmentLines, webNote].filter(Boolean).join("\n\n").trim()

    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) return

    // Insert user message
    const { data: userMsgData } = await sb.from("chat_messages").insert({
      user_id:    user.id,
      session_id: sessionId,
      role:       "user",
      content:    fullText,
    }).select().single()

    const userMsg: Message = {
      id:        userMsgData?.id ?? crypto.randomUUID(),
      role:      "user",
      content:   fullText,
      createdAt: userMsgData?.created_at ?? new Date().toISOString(),
    }

    const updatedWithUser = [...messages, userMsg]
    setMessages(updatedWithUser)
    setInput("")
    setAttachments([])
    setLoading(true)

    // Update title on first message
    if (messages.length === 0) {
      await sb.from("chat_sessions").update({
        title:      (text || attachments[0]?.name || t.chatSession.newChatFallback).slice(0, 60),
        updated_at: new Date().toISOString(),
      }).eq("id", sessionId)
    }

    try {
      const currentAgent    = agent
      const currentProvider = provider

      if (!currentProvider) {
        const errContent = t.chatSession.providerNotFoundError
        const { data: errMsgData } = await sb.from("chat_messages").insert({
          user_id: user.id, session_id: sessionId, role: "assistant", content: errContent,
        }).select().single()
        setMessages(prev => [...prev, { id: errMsgData?.id ?? crypto.randomUUID(), role: "assistant", content: errContent, createdAt: errMsgData?.created_at ?? new Date().toISOString() }])
        setLoading(false)
        sendingRef.current = false
        return
      }

      const memoryRaw     = localStorage.getItem("astrocore_memory")
      const memoryItems   = memoryRaw ? JSON.parse(memoryRaw) : []
      const memoryContext = memoryItems.length > 0
        ? memoryItems.map((m: { title: string; content: string }) => `[${m.title}]: ${m.content}`).join("\n\n")
        : null

      const systemPrompt = [
        currentAgent?.system_prompt || "",
        memoryContext ? `\n\n[Workspace context]:\n${memoryContext}` : "",
      ].filter(Boolean).join("")

      // Belt-and-braces client-side timeout: if some hosting layer
      // stalls the stream without ever closing the connection or
      // erroring, this guarantees the request still fails loudly
      // instead of leaving the UI stuck "loading" forever.
      const abortController = new AbortController()
      const abortTimer = setTimeout(() => abortController.abort(), 55000)

      let res: Response
      try {
        res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedWithUser.map(m => ({ role: m.role, content: m.content })),
            systemPrompt,
            providerId: currentProvider.id,
          }),
          signal: abortController.signal,
        })
      } finally {
        clearTimeout(abortTimer)
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}))
        const errContent = errData?.error || t.chatSession.noReply

        const { data: errMsgData } = await sb.from("chat_messages").insert({
          user_id: user.id, session_id: sessionId, role: "assistant", content: errContent,
        }).select().single()

        setMessages(prev => [...prev, {
          id: errMsgData?.id ?? crypto.randomUUID(),
          role: "assistant",
          content: errContent,
          createdAt: errMsgData?.created_at ?? new Date().toISOString(),
        }])
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
      }
    } catch {
      const errContent = t.chatSession.sendError
      await sb.from("chat_messages").insert({ user_id: user.id, session_id: sessionId, role: "assistant", content: errContent })
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: errContent, createdAt: new Date().toISOString() }])
    } finally {
      setLoading(false)
      sendingRef.current = false
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 180) + "px"
  }

  function insertQuickAction(text: string) {
    setInput(prev => (prev.trim() ? prev + "\n" + text : text))
    setTimeout(() => inputRef.current?.focus(), 50)
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

  const canSend = (input.trim().length > 0 || attachments.length > 0) && !loading

  return (
    <>
      <style>{`
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(200%);opacity:0} }
        @keyframes dot { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
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
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.55),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 20 }} />

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 24px", borderBottom: `0.5px solid ${T.b1}`, background: "rgba(8,8,15,0.96)", backdropFilter: "blur(16px)", flexShrink: 0, zIndex: 5, position: "relative" }}>
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
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title || t.chatSession.newChatFallback}</div>
            {agent && <div style={{ fontSize: 11, color: T.t4, marginTop: 1 }}>{agent.name}{provider ? ` · ${provider.model}` : ""}</div>}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge icon={Activity} label={t.chatSession.aiCoreOnline} color={T.red} bg="rgba(232,0,42,0.09)" border="rgba(232,0,42,0.25)" />
            {provider && <Badge icon={Zap} label={t.chatSession.providerConnected} color={T.green} bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.22)" />}
            <Badge icon={Brain} label={t.chatSession.memoryLayer} color="#A78BFA" bg="rgba(167,139,250,0.08)" border="rgba(167,139,250,0.22)" />
            {webMode && <Badge icon={Globe} label={t.chatSession.webMode} color="#7DD3FC" bg="rgba(125,211,252,0.08)" border="rgba(125,211,252,0.22)" />}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "28px 24px 12px" }}>
          <div style={{ maxWidth: 900, margin: "0 auto", width: "100%" }}>
            {messages.length === 0 && !loading && (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "64px 24px", textAlign: "center" }}>
                <div style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 20, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.07)" }}>
                  {agent ? <span style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>{agent.name.charAt(0).toUpperCase()}</span> : <Bot size={28} style={{ color: T.red, opacity: 0.7 }} />}
                </div>
                <div style={{ fontSize: 20, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{agent ? `${t.chatSession.chatWithPrefix}${agent.name}` : t.chatSession.newChatFallback}</div>
                <div style={{ fontSize: 13.5, color: T.t3, lineHeight: 1.65, maxWidth: 380, marginBottom: 24 }}>
                  {agent?.system_prompt ? agent.system_prompt.slice(0, 120) + (agent.system_prompt.length > 120 ? "..." : "") : t.chatSession.startConversationHint}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {[t.chatSession.suggestion1, t.chatSession.suggestion2, t.chatSession.suggestion3].map(q => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus() }} style={{ fontSize: 12.5, padding: "7px 14px", borderRadius: 8, cursor: "pointer", background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t3, transition: "all 130ms ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1; (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.28)"; (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.07)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3; (e.currentTarget as HTMLElement).style.borderColor = T.b1; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
                    >{q}</button>
                  ))}
                </div>
                <div style={{ marginTop: 24, fontSize: 10.5, color: "#2E2E4A", textTransform: "uppercase", letterSpacing: "0.10em" }}>Agent Conversation Layer · AI Command Chat</div>
              </div>
            )}
            {messages.map(msg => <MessageBubble key={msg.id} msg={msg} agentColor={agent?.avatar_color} t={t} lang={language} />)}
            {loading && <TypingDots />}
            <div ref={bottomRef} />
          </div>
        </div>

        {showScroll && (
          <button onClick={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })} style={{ position: "absolute", bottom: 130, right: 28, width: 34, height: 34, borderRadius: "50%", background: T.s1, border: `0.5px solid ${T.b1}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.t3, zIndex: 10, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
            <ChevronDown size={16} />
          </button>
        )}

        {/* Quick Actions */}
        {agent && (
          <QuickActions
            skills={getAgentSkills(agent.name, agent.system_prompt ?? "")}
            onSelect={prompt => {
              setInput(prompt)
              setTimeout(() => {
                if (inputRef.current) {
                  inputRef.current.focus()
                  inputRef.current.style.height = "auto"
                  inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 180) + "px"
                }
              }, 0)
            }}
          />
        )}

        {/* Composer */}
        <div style={{ flexShrink: 0, padding: "10px 24px 18px", background: "rgba(8,8,15,0.97)", backdropFilter: "blur(16px)" }}>
          <div ref={composerRef} style={{ maxWidth: 900, margin: "0 auto", width: "100%", position: "relative" }}>

            {/* Provider warning */}
            {!provider && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "8px 12px", borderRadius: 9, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)", fontSize: 12, color: "#FF4D6A" }}>
                <AlertCircle size={13} />
                {t.chatSession.noProviderConnected}{" "}
                <button onClick={() => router.push("/providers")} style={{ color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>{t.chatSession.configure}</button>
              </div>
            )}

            {/* Mic error */}
            {micError && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, padding: "7px 12px", borderRadius: 8, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)", fontSize: 11.5, color: "#FF4D6A" }}>
                <AlertCircle size={12} /> {micError}
                <button onClick={() => setMicError("")} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={11} /></button>
              </div>
            )}

            {/* Listening indicator */}
            {isListening && (
              <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, padding: "6px 12px", borderRadius: 8, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", fontSize: 11.5, color: T.red }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.red, display: "inline-block", animation: "redpulse 1.2s ease infinite" }} />
                {t.chatSession.listening}
              </div>
            )}

            {/* Attachments */}
            {attachments.length > 0 && (
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 8 }}>
                {attachments.map((a, i) => (
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

            {/* Tools panel */}
            {showTools && (
              <ToolsPanel onAction={insertQuickAction} onClose={() => setShowTools(false)} t={t} />
            )}

            {/* Main pill */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 6,
              background: focused ? "rgba(17,17,28,0.99)" : T.s1,
              border: `1px solid ${focused ? "rgba(232,0,42,0.28)" : "rgba(255,255,255,0.10)"}`,
              borderRadius: 20,
              padding: "8px 8px 8px 10px",
              boxShadow: focused ? "0 0 0 3px rgba(232,0,42,0.06), 0 8px 32px rgba(0,0,0,0.4)" : "0 4px 20px rgba(0,0,0,0.3)",
              transition: "border-color 180ms ease, box-shadow 180ms ease",
            }}>

              {/* Left icons */}
              <div style={{ display: "flex", gap: 1, alignItems: "center", paddingBottom: 2 }}>
                <IconBtn icon={Plus} title={t.chatSession.actions} onClick={() => setShowTools(v => !v)} active={showTools} />
                <IconBtn
                  icon={Paperclip}
                  title={t.chatSession.attachFile}
                  onClick={() => fileRef.current?.click()}
                />
                <IconBtn
                  icon={Globe}
                  title={webMode ? t.chatSession.webModeOn : t.chatSession.webMode}
                  active={webMode}
                  onClick={() => setWebMode(v => !v)}
                />
                <IconBtn
                  icon={Wrench}
                  title={t.chatSession.quickActions}
                  active={showTools}
                  onClick={() => setShowTools(v => !v)}
                />
              </div>

              {/* Textarea */}
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={isListening ? t.chatSession.listeningPlaceholder : loading ? t.chatSession.aiRespondingPlaceholder : t.chatSession.messagePlaceholder}
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontSize: 14, color: T.t1, resize: "none",
                  lineHeight: 1.6, maxHeight: 180, overflow: "auto",
                  fontFamily: "inherit", padding: "4px 0",
                  alignSelf: "flex-end",
                }}
              />

              {/* Right icons */}
              <div style={{ display: "flex", gap: 5, alignItems: "center", paddingBottom: 2 }}>
                <IconBtn
                  icon={isListening ? MicOff : Mic}
                  title={isListening ? t.chatSession.stopRecording : t.chatSession.voiceInput}
                  active={isListening}
                  pulse={isListening}
                  onClick={toggleMic}
                />
                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  title={t.chatSession.send}
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

            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.json,.csv,.tsx,.ts,.js,.jsx,.css,.html,.xml,.yaml,.yml,.sh,.py,.rb,.go,.rs,.php,.sql,.env"
              style={{ display: "none" }}
              onChange={e => { handleFiles(e.target.files); e.target.value = "" }}
            />

            {/* Centered hint */}
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={{ fontSize: 10.5, color: "#2E2E4A" }}>
                {t.chatSession.hint}
              </span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}