"use client"

// components/agents/ConnectAgentButton.tsx
//
// "Connect your OpenClaw agent in 3 steps":
//   1. click the button → POST /api/agents/connect creates a pending
//      connection + key and returns the one-line install command
//   2. copy the command
//   3. paste it on the server → this modal polls /api/providers and
//      flips to "connected" by itself when the installer registers.
//
// Also exports <AgentStatusBadge> for showing online/offline on a
// provider card from providers.last_seen_at.

import { useEffect, useRef, useState } from "react"
import { Bot, Check, Copy, Loader2, Terminal, X, AlertCircle } from "lucide-react"

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

type Stage = "name" | "creating" | "command" | "connected" | "error"

// ─── Online / offline badge ───────────────────────────────────────
// Heartbeat runs every 5 min, so "online" = seen within the last 12 min.

export function isAgentOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false
  return Date.now() - new Date(lastSeenAt).getTime() < 12 * 60 * 1000
}

export function AgentStatusBadge({ lastSeenAt }: { lastSeenAt: string | null | undefined }) {
  const online = isAgentOnline(lastSeenAt)
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      padding: "3px 9px", borderRadius: 7, fontSize: 11, fontWeight: 500,
      color: online ? T.green : T.t3,
      background: online ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.04)",
      border: `0.5px solid ${online ? "rgba(34,197,94,0.25)" : T.b1}`,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? T.green : T.t4 }} />
      {online ? "Онлайн" : "Офлайн"}
    </span>
  )
}

// ─── Button + modal ───────────────────────────────────────────────

export function ConnectAgentButton({ onConnected, variant = "primary" }: {
  onConnected?: () => void
  // "secondary" = outlined, for placing next to another primary (red) button
  variant?: "primary" | "secondary"
}) {
  const [open, setOpen] = useState(false)
  const secondary = variant === "secondary"
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          padding: "9px 16px", borderRadius: 9, cursor: "pointer",
          background: secondary ? "rgba(232,0,42,0.08)" : T.red,
          border: secondary ? "0.5px solid rgba(232,0,42,0.30)" : "none",
          color: secondary ? "#FF7A90" : "#fff",
          fontSize: 13, fontWeight: 500,
        }}
      >
        <Bot size={15} /> Підключити OpenClaw агента
      </button>
      {open && (
        <ConnectAgentModal
          onClose={() => setOpen(false)}
          onConnected={() => { onConnected?.() }}
        />
      )}
    </>
  )
}

function ConnectAgentModal({ onClose, onConnected }: { onClose: () => void; onConnected: () => void }) {
  const [stage, setStage]           = useState<Stage>("name")
  const [name, setName]             = useState("Мій OpenClaw")
  const [command, setCommand]       = useState("")
  const [providerId, setProviderId] = useState("")
  const [error, setError]           = useState("")
  const [copied, setCopied]         = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  // Step 3: wait for the installer to register (status → "connected").
  useEffect(() => {
    if (stage !== "command" || !providerId) return
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch("/api/providers", { cache: "no-store" })
        const data = await res.json().catch(() => ({}))
        const row  = (data?.providers ?? []).find((p: { id: string }) => p.id === providerId)
        if (row?.status === "connected") {
          setStage("connected")
          onConnected()
        }
      } catch {
        // keep polling
      }
    }, 3000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [stage, providerId, onConnected])

  async function createCommand() {
    const trimmed = name.trim()
    if (!trimmed) { setError("Вкажи назву агента."); return }
    setError("")
    setStage("creating")
    try {
      const res  = await fetch("/api/agents/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.command) throw new Error(data?.error || "Не вдалося створити підключення.")
      setCommand(data.command)
      setProviderId(data.providerId)
      setStage("command")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не вдалося створити підключення.")
      setStage("error")
    }
  }

  function copyCommand() {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  const stepStyle = (active: boolean, done: boolean): React.CSSProperties => ({
    width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 11, fontWeight: 700,
    background: done ? "rgba(34,197,94,0.15)" : active ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.05)",
    color: done ? T.green : active ? T.red : T.t4,
    border: `0.5px solid ${done ? "rgba(34,197,94,0.35)" : active ? "rgba(232,0,42,0.35)" : T.b1}`,
  })

  const s1Done = stage === "command" || stage === "connected"
  const s3Done = stage === "connected"

  return (
    <div
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.65)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}
    >
      <div style={{
        width: "100%", maxWidth: 560, borderRadius: 16,
        background: T.s1, border: `0.5px solid ${T.b1}`,
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)", padding: 22, color: T.t1,
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Bot size={16} style={{ color: T.red }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>Підключити OpenClaw агента</div>
            <div style={{ fontSize: 12, color: T.t3 }}>3 кроки, близько хвилини</div>
          </div>
          <button onClick={onClose} aria-label="Закрити" style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Step 1 */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={stepStyle(stage === "name" || stage === "creating" || stage === "error", s1Done)}>{s1Done ? <Check size={12} /> : 1}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 8 }}>Назви агента</div>
            {(stage === "name" || stage === "creating" || stage === "error") ? (
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  value={name}
                  onChange={e => { setName(e.target.value); setError("") }}
                  maxLength={100}
                  placeholder="Мій OpenClaw"
                  style={{ flex: 1, padding: "9px 12px", borderRadius: 9, fontSize: 13.5, background: T.bg, border: `0.5px solid ${T.b1}`, color: T.t1, outline: "none" }}
                />
                <button
                  onClick={createCommand}
                  disabled={stage === "creating"}
                  style={{ padding: "9px 14px", borderRadius: 9, border: "none", cursor: stage === "creating" ? "default" : "pointer", background: T.red, color: "#fff", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}
                >
                  {stage === "creating" ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null}
                  Створити команду
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 13, color: T.t3 }}>{name}</div>
            )}
            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 12, color: "#FF4D6A" }}>
                <AlertCircle size={12} /> {error}
              </div>
            )}
          </div>
        </div>

        {/* Step 2 */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, opacity: s1Done ? 1 : 0.45 }}>
          <div style={stepStyle(stage === "command", s3Done)}>{s3Done ? <Check size={12} /> : 2}</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Скопіюй команду і встав у термінал сервера з OpenClaw</div>
            <div style={{ fontSize: 12, color: T.t3, marginBottom: 8 }}>Потрібен root. Команда показується лише зараз — у ній твій особистий ключ.</div>
            {command && (
              <div style={{ position: "relative", background: T.bg, border: `0.5px solid ${T.b1}`, borderRadius: 10, padding: "10px 44px 10px 12px" }}>
                <Terminal size={12} style={{ position: "absolute", top: 12, left: 12, color: T.t4 }} />
                <code style={{ display: "block", paddingLeft: 20, fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: "#7DD3FC", wordBreak: "break-all", lineHeight: 1.6 }}>
                  {command}
                </code>
                <button onClick={copyCommand} aria-label="Скопіювати команду" style={{ position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 7, border: `0.5px solid ${T.b1}`, background: T.s2, cursor: "pointer", color: copied ? T.green : T.t2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Step 3 */}
        <div style={{ display: "flex", gap: 12, opacity: s1Done ? 1 : 0.45 }}>
          <div style={stepStyle(stage === "command", s3Done)}>{s3Done ? <Check size={12} /> : 3}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>Агент з'явиться тут сам</div>
            {stage === "command" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.t3 }}>
                <Loader2 size={13} style={{ animation: "spin 1s linear infinite" }} /> Чекаю, поки скрипт на сервері завершиться…
              </div>
            )}
            {stage === "connected" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: T.green }}>
                <Check size={14} /> Агента підключено. Обери його як провайдера для потрібного агента в AsCore.
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 9, cursor: "pointer", fontSize: 13, background: stage === "connected" ? T.red : "rgba(255,255,255,0.05)", color: stage === "connected" ? "#fff" : T.t2, border: stage === "connected" ? "none" : `0.5px solid ${T.b1}` }}>
            {stage === "connected" ? "Готово" : "Закрити"}
          </button>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}