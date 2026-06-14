"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, Send, Bot, Zap, Brain,
  Activity, RotateCcw, Copy, Check,
  ChevronDown, AlertCircle, Paperclip, Image as ImageIcon, X,
} from "lucide-react"
import {
  chatStore, agentStore, providerStore,
  type ChatSession, type Agent, type Provider, type Message,
} from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.10)",
  b2:    "rgba(255,255,255,0.16)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  t4:    "#585878",
  red:   "#E8002A",
  green: "#22C55E",
}

function timeStr(iso: string): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })
}

// ─── Copy button ──────────────────────────────────────────────────

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }
  return (
    <button onClick={handleCopy} style={{
      padding: 4, borderRadius: 5, border: "none", background: "none",
      cursor: "pointer", lineHeight: 0, color: T.t4,
      transition: "color 130ms ease",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
    >
      {copied ? <Check size={12} style={{ color: T.green }} /> : <Copy size={12} />}
    </button>
  )
}

// ─── Message bubble ───────────────────────────────────────────────

function MessageBubble({ msg, agentColor }: { msg: Message; agentColor?: string }) {
  const isUser = msg.role === "user"
  const isError = msg.content.startsWith("Помилка") || msg.content.startsWith("Error")

  // Simple code block detection
  const parts = msg.content.split(/(```[\s\S]*?```)/g)

  return (
    <div style={{
      display: "flex",
      flexDirection: isUser ? "row-reverse" : "row",
      gap: 10, alignItems: "flex-end",
      marginBottom: 16,
    }}>
      {/* Avatar */}
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: agentColor ?? "rgba(232,0,42,0.15)",
          border: agentColor ? "none" : "0.5px solid rgba(232,0,42,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 700, color: "#fff",
          marginBottom: 2,
        }}>
          <Bot size={14} style={{ color: agentColor ? "#fff" : T.red, opacity: 0.9 }} />
        </div>
      )}

      <div style={{
        maxWidth: "72%",
        display: "flex", flexDirection: "column",
        alignItems: isUser ? "flex-end" : "flex-start",
        gap: 4,
      }}>
        {/* Bubble */}
        <div style={{
          padding: "10px 14px",
          borderRadius: isUser ? "14px 14px 4px 14px" : "4px 14px 14px 14px",
          background: isUser
            ? "linear-gradient(135deg,rgba(232,0,42,0.22) 0%,rgba(232,0,42,0.12) 100%)"
            : isError
            ? "rgba(232,0,42,0.08)"
            : "linear-gradient(160deg,#14141F 0%,#111118 100%)",
          border: isUser
            ? "0.5px solid rgba(232,0,42,0.30)"
            : isError
            ? "0.5px solid rgba(232,0,42,0.22)"
            : "0.5px solid rgba(255,255,255,0.08)",
          fontSize: 13.5, lineHeight: 1.65,
          color: isUser ? T.t1 : isError ? "#FF4D6A" : T.t2,
          wordBreak: "break-word",
          position: "relative",
        }}>
          {parts.map((part, i) => {
            if (part.startsWith("```") && part.endsWith("```")) {
              const lines = part.slice(3, -3).split("\n")
              const lang = lines[0].trim()
              const code = lines.slice(1).join("\n")
              return (
                <div key={i} style={{ marginTop: 8, marginBottom: 4 }}>
                  {lang && (
                    <div style={{ fontSize: 10, color: T.t4, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                      {lang}
                    </div>
                  )}
                  <pre style={{
                    background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(255,255,255,0.07)",
                    borderRadius: 7, padding: "10px 12px", fontSize: 12,
                    color: "#7DD3FC", overflow: "auto", margin: 0,
                    fontFamily: "monospace", lineHeight: 1.6,
                  }}>
                    {code}
                  </pre>
                </div>
              )
            }
            return <span key={i} style={{ whiteSpace: "pre-wrap" }}>{part}</span>
          })}
        </div>

        {/* Meta row */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          flexDirection: isUser ? "row-reverse" : "row",
        }}>
          <span style={{ fontSize: 10, color: T.t4 }}>{timeStr(msg.createdAt)}</span>
          {!isUser && <CopyBtn text={msg.content} />}
        </div>
      </div>
    </div>
  )
}

// ─── Typing indicator ─────────────────────────────────────────────

function TypingDots() {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 16 }}>
      <div style={{
        width: 30, height: 30, borderRadius: 9, flexShrink: 0,
        background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.20)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Bot size={14} style={{ color: T.red, opacity: 0.8 }} />
      </div>
      <div style={{
        padding: "12px 16px", borderRadius: "4px 14px 14px 14px",
        background: "linear-gradient(160deg,#14141F 0%,#111118 100%)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        display: "flex", gap: 5, alignItems: "center",
      }}>
        <style>{`
          @keyframes dot { 0%,80%,100%{opacity:.2;transform:scale(.8)} 40%{opacity:1;transform:scale(1)} }
        `}</style>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 5, height: 5, borderRadius: "50%", background: T.t3,
            animation: `dot 1.2s ease infinite`,
            animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Badge ────────────────────────────────────────────────────────

function Badge({ icon: Icon, label, color, bg, border }: {
  icon: React.ElementType; label: string
  color: string; bg: string; border: string
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 5,
      padding: "3px 9px", borderRadius: 7,
      background: bg, border: `0.5px solid ${border}`,
      fontSize: 10.5, color, fontWeight: 500, flexShrink: 0,
    }}>
      <Icon size={10} />
      {label}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SessionPage() {
  const params    = useParams()
  const router    = useRouter()
  const sessionId = params.sessionId as string

  const [session,   setSession]   = useState<ChatSession | null>(null)
  const [agent,     setAgent]     = useState<Agent | undefined>()
  const [provider,  setProvider]  = useState<Provider | undefined>()
  const [messages,  setMessages]  = useState<Message[]>([])
  const [input,     setInput]     = useState("")
  const [loading,   setLoading]   = useState(false)
  const [notFound,  setNotFound]  = useState(false)
  const [pulse,     setPulse]     = useState(false)
  const [showScroll,setShowScroll]= useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)
  const fileRef    = useRef<HTMLInputElement>(null)

  const [attachments, setAttachments] = useState<{ name: string; url: string; type: string }[]>([])

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  const loadSession = useCallback(() => {
    const s = chatStore.getById(sessionId)
    if (!s) { setNotFound(true); return }
    setSession(s)
    setMessages(s.messages)
    if (s.agentId) {
      const a = agentStore.getById(s.agentId)
      setAgent(a)
      if (a?.providerId) setProvider(providerStore.getById(a.providerId))
    }
  }, [sessionId])

  useEffect(() => { loadSession() }, [loadSession])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, loading])

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setShowScroll(el.scrollHeight - el.scrollTop - el.clientHeight > 200)
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  async function handleSend() {
    const text = input.trim()
    const hasAttachments = attachments.length > 0
    if ((!text && !hasAttachments) || loading || !session) return

    const attachmentText = hasAttachments
      ? "\n\n📎 Вкладення:\n" + attachments.map(a => `• ${a.name}`).join("\n")
      : ""
    const fullText = (text + attachmentText).trim()

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: fullText,
      createdAt: new Date().toISOString(),
    }

    const updatedWithUser = [...messages, userMsg]
    setMessages(updatedWithUser)
    chatStore.addMessage(sessionId, userMsg)
    setInput("")
    setAttachments([])
    setLoading(true)

    // Update session title if first message
    if (messages.length === 0) {
      chatStore.updateTitle(sessionId, (text || attachments[0]?.name || "Новий чат").slice(0, 60))
    }

    try {
      // Resolve provider from agent
      const currentAgent = agent ?? (session.agentId ? agentStore.getById(session.agentId) : undefined)
      const currentProvider = currentAgent?.providerId
        ? providerStore.getById(currentAgent.providerId)
        : undefined

      if (!currentProvider) {
        const errMsg: Message = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "Провайдер для цього агента не знайдений. Перевірте API ключі у розділі Провайдери.",
          createdAt: new Date().toISOString(),
        }
        setMessages(prev => [...prev, errMsg])
        chatStore.addMessage(sessionId, errMsg)
        setLoading(false)
        return
      }

      const memoryRaw = localStorage.getItem("astrocore_memory")
      const memoryItems = memoryRaw ? JSON.parse(memoryRaw) : []
      const memoryContext = memoryItems.length > 0
        ? memoryItems.map((m: { title: string; content: string }) => `[${m.title}]: ${m.content}`).join("\n\n")
        : null

      const systemPrompt = [
        currentAgent?.systemPrompt || "",
        memoryContext ? `\n\n[Контекст workspace]:\n${memoryContext}` : "",
      ].filter(Boolean).join("")

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: updatedWithUser.map(m => ({ role: m.role, content: m.content })),
          systemPrompt,
          provider: {
            slug:           currentProvider.slug,
            apiKey:         currentProvider.apiKey,
            model:          currentProvider.model,
          },
        }),
      })

      const data = await res.json()
      const reply: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content ?? data.error ?? "Немає відповіді",
        createdAt: new Date().toISOString(),
      }

      setMessages(prev => [...prev, reply])
      chatStore.addMessage(sessionId, reply)
    } catch {
      const errMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "Помилка: не вдалося отримати відповідь. Перевірте API ключ у Провайдерах.",
        createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, errMsg])
      chatStore.addMessage(sessionId, errMsg)
    } finally {
      setLoading(false)
      inputRef.current?.focus()
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // Auto-resize textarea
  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value)
    e.target.style.height = "auto"
    e.target.style.height = Math.min(e.target.scrollHeight, 200) + "px"
  }

  if (notFound) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={26} style={{ color: T.red, opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Сесію не знайдено</div>
          <div style={{ fontSize: 13, color: T.t3, marginBottom: 22 }}>Можливо, її було видалено</div>
          <button onClick={() => router.push("/chat")} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>
            <ArrowLeft size={14} /> До всіх чатів
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
            <div key={i} style={{
              width: 6, height: 6, borderRadius: "50%", background: T.red, opacity: 0.5,
              animation: `dot 1.2s ease infinite`,
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        @keyframes dot {
          0%,80%,100%{opacity:.2;transform:scale(.8)}
          40%{opacity:1;transform:scale(1)}
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.032) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
        overflow: "hidden",
      }}>

        {/* scan line */}
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* ── Header ── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 12,
          padding: "12px 24px",
          borderBottom: `0.5px solid ${T.b1}`,
          background: "linear-gradient(180deg,rgba(11,11,18,0.98) 0%,rgba(8,8,15,0.95) 100%)",
          backdropFilter: "blur(12px)",
          flexShrink: 0, zIndex: 5,
          position: "relative",
        }}>
          {/* ambient glow */}
          <div aria-hidden style={{
            position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none",
            background: "radial-gradient(ellipse 60% 100% at 0% 50%,rgba(232,0,42,0.04) 0%,transparent 100%)",
          }} />

          {/* back */}
          <button onClick={() => router.push("/chat")} style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
            cursor: "pointer", color: T.t3,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}
          >
            <ArrowLeft size={15} />
          </button>

          {/* agent avatar */}
          {agent && (
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: agent.avatarColor ?? T.red,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#fff",
              boxShadow: `0 0 12px ${agent.avatarColor ?? T.red}40`,
            }}>
              {agent.name.charAt(0).toUpperCase()}
            </div>
          )}

          {/* session info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.title || "Новий чат"}
            </div>
            {agent && (
              <div style={{ fontSize: 11, color: T.t4, marginTop: 1 }}>
                {agent.name}{provider ? ` · ${provider.model}` : ""}
              </div>
            )}
          </div>

          {/* status badges */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <Badge icon={Activity} label="AI Core Online"
              color={T.red} bg="rgba(232,0,42,0.09)" border="rgba(232,0,42,0.25)" />
            {provider && (
              <Badge icon={Zap} label="Provider Connected"
                color={T.green} bg="rgba(34,197,94,0.08)" border="rgba(34,197,94,0.22)" />
            )}
            <Badge icon={Brain} label="Memory Layer"
              color="#A78BFA" bg="rgba(167,139,250,0.08)" border="rgba(167,139,250,0.22)" />
          </div>
        </div>

        {/* ── Messages area ── */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            flex: 1, overflowY: "auto", overflowX: "hidden",
            padding: "24px 48px",
            scrollbarWidth: "thin",
            scrollbarColor: "rgba(255,255,255,0.08) transparent",
          }}
        >
          <div style={{ maxWidth: 780, margin: "0 auto" }}>

            {/* Empty state */}
            {messages.length === 0 && !loading && (
              <div style={{
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", padding: "80px 24px", textAlign: "center",
              }}>
                <div style={{
                  width: 68, height: 68, borderRadius: 20, marginBottom: 20,
                  background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  boxShadow: "0 0 32px rgba(232,0,42,0.07)",
                }}>
                  {agent ? (
                    <span style={{ fontSize: 26, fontWeight: 700, color: "#fff" }}>
                      {agent.name.charAt(0).toUpperCase()}
                    </span>
                  ) : (
                    <Bot size={28} style={{ color: T.red, opacity: 0.7 }} />
                  )}
                </div>
                <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>
                  {agent ? `Чат з ${agent.name}` : "Новий чат"}
                </div>
                <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 340, marginBottom: 16 }}>
                  {agent?.systemPrompt
                    ? `${agent.systemPrompt.slice(0, 100)}...`
                    : "Напишіть перше повідомлення щоб розпочати розмову з AI агентом."
                  }
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                  {["Привіт! Хто ти?", "Що ти вмієш?", "Допоможи мені"].map(q => (
                    <button key={q} onClick={() => setInput(q)} style={{
                      fontSize: 12, padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                      background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t3,
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1; (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.25)" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3; (e.currentTarget as HTMLElement).style.borderColor = T.b1 }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: 20, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.10em" }}>
                  Agent Conversation Layer · AI Command Chat
                </div>
              </div>
            )}

            {/* Messages */}
            {messages.map(msg => (
              <MessageBubble key={msg.id} msg={msg} agentColor={agent?.avatarColor} />
            ))}

            {/* Typing */}
            {loading && <TypingDots />}

            <div ref={bottomRef} />
          </div>
        </div>

        {/* Scroll to bottom button */}
        {showScroll && (
          <button onClick={scrollToBottom} style={{
            position: "absolute", bottom: 100, right: 32,
            width: 36, height: 36, borderRadius: "50%",
            background: T.s1, border: `0.5px solid ${T.b1}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: T.t3, zIndex: 10,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}>
            <ChevronDown size={16} />
          </button>
        )}

        {/* ── Composer ── */}
        <div style={{
          flexShrink: 0, padding: "12px 24px 20px",
          borderTop: `0.5px solid ${T.b1}`,
          background: "linear-gradient(0deg,rgba(8,8,15,0.98) 0%,rgba(8,8,15,0.90) 100%)",
          backdropFilter: "blur(12px)",
        }}>
          <div style={{ maxWidth: 780, margin: "0 auto" }}>

            {/* Provider warning */}
            {!provider && (
              <div style={{
                display: "flex", alignItems: "center", gap: 8, marginBottom: 10,
                padding: "8px 12px", borderRadius: 9,
                background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)",
                fontSize: 12, color: "#FF4D6A",
              }}>
                <AlertCircle size={13} />
                Немає підключеного провайдера.{" "}
                <button onClick={() => router.push("/providers")} style={{ color: T.red, background: "none", border: "none", cursor: "pointer", textDecoration: "underline", fontSize: 12 }}>
                  Налаштувати
                </button>
              </div>
            )}

            {/* Input box */}
            <div style={{
              display: "flex", alignItems: "flex-end", gap: 10,
              background: T.s1,
              border: `0.5px solid ${T.b1}`,
              borderRadius: 14, padding: "10px 10px 10px 16px",
              transition: "border-color 150ms ease",
            }}
              onFocus={() => {}}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.25)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = T.b1 }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={loading ? "AI відповідає..." : "Напишіть повідомлення..."}
                disabled={loading}
                rows={1}
                style={{
                  flex: 1, background: "none", border: "none", outline: "none",
                  fontSize: 13.5, color: T.t1, resize: "none",
                  lineHeight: 1.6, maxHeight: 200, overflow: "auto",
                  fontFamily: "inherit",
                }}
              />

              {/* File attach button */}
              <button
                onClick={() => fileRef.current?.click()}
                title="Прикріпити файл або фото"
                style={{
                  width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                  background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                  color: T.t4, transition: "color 130ms ease, background 130ms ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.09)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4; (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
              >
                <Paperclip size={15} />
              </button>

              {/* Send button */}
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: !input.trim() || loading ? "rgba(232,0,42,0.12)" : T.red,
                  border: "none", cursor: !input.trim() || loading ? "not-allowed" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  transition: "background 150ms ease, box-shadow 150ms ease",
                  boxShadow: !input.trim() || loading ? "none" : "0 0 16px rgba(232,0,42,0.35)",
                }}
                onMouseEnter={e => {
                  if (input.trim() && !loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E"
                }}
                onMouseLeave={e => {
                  if (input.trim() && !loading) (e.currentTarget as HTMLElement).style.background = T.red
                }}
              >
                {loading
                  ? <RotateCcw size={15} style={{ color: T.red, opacity: 0.7, animation: "spin 1s linear infinite" }} />
                  : <Send size={15} style={{ color: !input.trim() ? T.red : "#fff", opacity: !input.trim() ? 0.4 : 1 }} />
                }
              </button>
            </div>

            {/* Hidden file input */}
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,.pdf,.txt,.md,.csv,.json,.ts,.tsx,.js,.jsx,.py"
              style={{ display: "none" }}
              onChange={e => {
                const files = Array.from(e.target.files ?? [])
                files.forEach(file => {
                  const url = URL.createObjectURL(file)
                  setAttachments(prev => [...prev, { name: file.name, url, type: file.type }])
                })
                e.target.value = ""
              }}
            />

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                {attachments.map((a, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 10px", borderRadius: 8,
                    background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
                    fontSize: 11.5, color: T.t2, maxWidth: 200,
                  }}>
                    {a.type.startsWith("image/")
                      ? <ImageIcon size={12} style={{ color: "#A78BFA", flexShrink: 0 }} />
                      : <Paperclip size={12} style={{ color: T.t4, flexShrink: 0 }} />
                    }
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.name}</span>
                    <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))} style={{
                      background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, flexShrink: 0, padding: 0,
                    }}>
                      <X size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Footer hint — centered */}
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <span style={{ fontSize: 10.5, color: T.t4 }}>
                Enter — надіслати · Shift+Enter — новий рядок · 📎 — файл або фото
              </span>
            </div>
          </div>
        </div>

      </div>
    </>
  )
}