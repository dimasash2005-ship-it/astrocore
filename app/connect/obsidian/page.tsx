"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Check, ExternalLink, Loader2, Lock, ShieldCheck, Copy } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"

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

type Stage =
  | "checking-session"
  | "signed-out"
  | "ready"
  | "connecting"
  | "redirecting"
  | "done"
  | "error"

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: "100vh", background: T.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 20,
      backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
      backgroundSize: "24px 24px",
    }}>
      <div style={{
        width: "100%", maxWidth: 420, borderRadius: 16,
        background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
        border: `0.5px solid ${T.b1}`, boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        padding: "28px 26px", textAlign: "center",
      }}>
        {children}
      </div>
    </div>
  )
}

function Logo() {
  return (
    <div style={{
      width: 52, height: 52, borderRadius: 14, margin: "0 auto 18px",
      background: "rgba(232,0,42,0.10)", border: `0.5px solid ${T.bRed}`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <Lock size={22} style={{ color: T.red }} />
    </div>
  )
}

function spinnerStyle() {
  return (
    <style>{`.astrocore-spin{animation:astrocore-spin .8s linear infinite}@keyframes astrocore-spin{to{transform:rotate(360deg)}}`}</style>
  )
}

// The plugin may open this page with no callback at all (current MVP:
// it just opens http://localhost:3002/connect/obsidian). If a callback
// IS present, we only ever trust/forward it when it's an obsidian://
// URI — never an arbitrary URL from the query string.
function validCallback(url: string | null): string | null {
  return url && url.startsWith("obsidian://") ? url : null
}

function appendToken(callback: string, token: string, state: string | null): string {
  const separator = callback.includes("?") ? "&" : "?"
  let uri = `${callback}${separator}token=${encodeURIComponent(token)}&status=success`
  if (state) uri += `&state=${encodeURIComponent(state)}`
  return uri
}

function ConnectObsidianContent() {
  const params = useSearchParams()
  const callback = validCallback(params.get("callback"))
  const state = params.get("state")

  const [stage, setStage] = useState<Stage>("checking-session")
  const [error, setError] = useState("")
  const [manualToken, setManualToken] = useState("")
  const [copied, setCopied] = useState(false)
  const unmountedRef = useRef(false)
  useEffect(() => () => { unmountedRef.current = true }, [])

  // Check session on mount. No callback validation gate here — an
  // absent or non-obsidian:// callback just means we fall back to
  // showing the token manually instead of auto-redirecting.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (cancelled) return
      setStage(user ? "ready" : "signed-out")
    })()
    return () => { cancelled = true }
  }, [])

  async function handleConnect() {
    setStage("connecting")
    setError("")
    try {
      const res = await fetch("/api/integrations/obsidian/connect", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || "Не вдалося створити з'єднання.")

      const token = data.key as string
      setManualToken(token)

      if (callback) {
        setStage("redirecting")
        window.location.href = appendToken(callback, token, state)
        // If Obsidian doesn't intercept the URI (not installed, or the
        // browser blocked it), the user is still here after a couple
        // seconds — fall back to the manual token screen.
        setTimeout(() => {
          if (!unmountedRef.current) setStage(prev => (prev === "redirecting" ? "done" : prev))
        }, 2500)
      } else {
        // No callback to redirect to yet — show the token straight away.
        setStage("done")
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка сервера.")
      setStage("error")
    }
  }

  function handleSignIn() {
    const redirectTarget = `/connect/obsidian?${params.toString()}`
    window.location.href = `/login?redirect=${encodeURIComponent(redirectTarget)}`
  }

  function copyToken() {
    navigator.clipboard.writeText(manualToken).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  if (stage === "checking-session") {
    return (
      <Shell>
        <Loader2 size={22} style={{ color: T.t3 }} className="astrocore-spin" />
        {spinnerStyle()}
      </Shell>
    )
  }

  if (stage === "signed-out") {
    return (
      <Shell>
        <Logo />
        <h1 style={{ fontSize: 17, fontWeight: 600, color: T.t1, margin: "0 0 8px" }}>Увійди в AstroCore</h1>
        <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, margin: "0 0 18px" }}>
          Щоб підключити Obsidian, спершу увійди у свій акаунт AstroCore.
        </p>
        <button onClick={handleSignIn} style={{
          width: "100%", padding: "11px", borderRadius: 10, border: "none", cursor: "pointer",
          background: T.red, color: "#fff", fontSize: 13.5, fontWeight: 600,
        }}>
          Увійти
        </button>
      </Shell>
    )
  }

  if (stage === "error") {
    return (
      <Shell>
        <Logo />
        <h1 style={{ fontSize: 17, fontWeight: 600, color: T.t1, margin: "0 0 8px" }}>Щось пішло не так</h1>
        <p style={{ fontSize: 13, color: T.red, lineHeight: 1.6, margin: "0 0 18px" }}>{error}</p>
        <button onClick={handleConnect} style={{
          width: "100%", padding: "11px", borderRadius: 10, border: "none", cursor: "pointer",
          background: "rgba(255,255,255,0.06)", color: T.t1, fontSize: 13.5, fontWeight: 500,
        }}>
          Спробувати ще раз
        </button>
      </Shell>
    )
  }

  if (stage === "connecting" || stage === "redirecting") {
    return (
      <Shell>
        <Loader2 size={22} style={{ color: T.red }} className="astrocore-spin" />
        {spinnerStyle()}
        <h1 style={{ fontSize: 16, fontWeight: 600, color: T.t1, margin: "16px 0 6px" }}>
          {stage === "connecting" ? "Підключаємо…" : "Повертаємось в Obsidian…"}
        </h1>
        <p style={{ fontSize: 12.5, color: T.t4, margin: 0 }}>
          {stage === "connecting" ? "Це займе секунду." : "Якщо Obsidian не відкрився автоматично, зачекай секунду."}
        </p>
      </Shell>
    )
  }

  if (stage === "done") {
    return (
      <Shell>
        <div style={{
          width: 44, height: 44, borderRadius: 12, margin: "0 auto 14px",
          background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.25)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Check size={20} style={{ color: T.green }} />
        </div>
        <h1 style={{ fontSize: 16, fontWeight: 600, color: T.t1, margin: "0 0 8px" }}>Токен готовий</h1>
        <p style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.6, margin: "0 0 14px" }}>
          {callback
            ? "Obsidian не відкрився автоматично. Скопіюй токен нижче і встав його вручну в налаштуваннях плагіна."
            : "Скопіюй токен нижче і встав його в Obsidian → Налаштування AstroCore → Advanced: API Key."}
        </p>
        <div style={{
          display: "flex", alignItems: "center", gap: 6, marginBottom: 16,
          padding: "10px 12px", borderRadius: 9,
          background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(125,211,252,0.18)",
        }}>
          <code style={{ fontSize: 11.5, color: "#7DD3FC", fontFamily: "monospace", wordBreak: "break-all", flex: 1, textAlign: "left" }}>
            {manualToken}
          </code>
          <button onClick={copyToken} style={{ background: "none", border: "none", cursor: "pointer", color: copied ? T.green : T.t4, lineHeight: 0 }}>
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
        {callback && (
          <a href={callback} style={{
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            padding: "10px", borderRadius: 9, textDecoration: "none",
            background: "rgba(232,0,42,0.10)", color: T.red, fontSize: 13, fontWeight: 500,
          }}>
            <ExternalLink size={13} /> Спробувати відкрити Obsidian знову
          </a>
        )}
      </Shell>
    )
  }

  // stage === "ready"
  return (
    <Shell>
      <Logo />
      <h1 style={{ fontSize: 17, fontWeight: 600, color: T.t1, margin: "0 0 8px" }}>Підключити Obsidian</h1>
      <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, margin: "0 0 18px" }}>
        Плагін Obsidian отримає доступ до AstroCore: чат, vault, memory, agents та integrations від твого імені.
      </p>

      <div style={{
        display: "flex", alignItems: "flex-start", gap: 9, textAlign: "left",
        padding: "11px 13px", borderRadius: 10, marginBottom: 18,
        background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
      }}>
        <ShieldCheck size={14} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.55 }}>
          AstroCore створить окремий ключ доступу для цього плагіна. Його завжди можна відкликати
          в Developer Center → Advanced: API Key.
        </span>
      </div>

      <button onClick={handleConnect} style={{
        width: "100%", padding: "11px", borderRadius: 10, border: "none", cursor: "pointer",
        background: T.red, color: "#fff", fontSize: 13.5, fontWeight: 600,
      }}>
        Connect AstroCore
      </button>
    </Shell>
  )
}

export default function ConnectObsidianPage() {
  return (
    <Suspense fallback={<Shell><Loader2 size={22} style={{ color: T.t3 }} /></Shell>}>
      <ConnectObsidianContent />
    </Suspense>
  )
}