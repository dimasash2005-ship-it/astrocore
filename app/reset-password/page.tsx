"use client";

// app/reset-password/page.tsx
//
// Opened from the "reset password" email (via /auth/callback, which has
// already logged the user in). Here they set the new password.

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";

const T = {
  t1:  "#F0EDF8",
  t3:  "#A8A4BC",
  t4:  "#585878",
  red: "#E8002A",
  green: "#22C55E",
}

const MIN_LEN = 8

export default function ResetPasswordPage() {
  const { language } = useLanguage()
  const uk = language !== "en"

  const [status,   setStatus]   = useState<"checking" | "ready" | "no-session" | "done">("checking")
  const [password, setPassword] = useState("")
  const [confirm,  setConfirm]  = useState("")
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")

  // The link must have logged us in; otherwise it's expired or opened in another browser.
  useEffect(() => {
    const sb = getSupabase()
    let alive = true
    sb.auth.getSession().then(({ data }) => {
      if (alive) setStatus(data.session ? "ready" : "no-session")
    })
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) setStatus(s => (s === "done" ? s : "ready"))
    })
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [])

  async function save() {
    if (password.length < MIN_LEN) {
      setError(uk ? `Пароль має бути щонайменше ${MIN_LEN} символів.` : `Password must be at least ${MIN_LEN} characters.`)
      return
    }
    if (password !== confirm) {
      setError(uk ? "Паролі не збігаються." : "Passwords don't match.")
      return
    }
    setLoading(true); setError("")
    const { error: e } = await getSupabase().auth.updateUser({ password })
    setLoading(false)
    if (e) {
      const same = /different from the old|same/i.test(e.message)
      setError(same
        ? (uk ? "Новий пароль має відрізнятися від старого." : "The new password must be different from the old one.")
        : (uk ? "Не вдалося змінити пароль. Спробуйте ще раз." : "Couldn't change the password. Please try again."))
      return
    }
    setStatus("done")
    setTimeout(() => { window.location.href = "/" }, 1800)
  }

  const inputStyle: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 10, padding: "12px 44px 12px 14px", fontSize: 14,
    color: T.t1, outline: "none", width: "100%",
  }
  const labelStyle: React.CSSProperties = {
    fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase",
    letterSpacing: "0.07em", display: "block", marginBottom: 7,
  }
  const focus = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }
  const blur  = (e: React.FocusEvent<HTMLInputElement>) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "48px 20px",
      background: "radial-gradient(ellipse 80% 50% at 50% 0%,rgba(232,0,42,0.10) 0%,transparent 70%), linear-gradient(180deg,#0D0D1A 0%,#08080F 100%)",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {status === "checking" && (
          <div style={{ display: "flex", justifyContent: "center", color: T.t3 }}>
            <Loader2 size={20} style={{ animation: "spin 0.8s linear infinite" }} />
          </div>
        )}

        {status === "no-session" && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 10 }}>
              {uk ? "Посилання не діє" : "This link isn't valid"}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: T.t3, marginBottom: 24 }}>
              {uk
                ? "Воно застаріло, вже використане або відкрите в іншому браузері. Запросіть нове посилання й відкрийте його в цьому браузері."
                : "It has expired, was already used, or was opened in a different browser. Request a new link and open it in this browser."}
            </div>
            <Link href="/forgot-password" style={{
              display: "flex", justifyContent: "center", padding: 13, borderRadius: 11,
              fontSize: 14, fontWeight: 600, background: T.red, color: "#fff", textDecoration: "none",
              boxShadow: "0 0 24px rgba(232,0,42,0.30)",
            }}>
              {uk ? "Надіслати нове посилання" : "Send a new link"}
            </Link>
          </div>
        )}

        {status === "done" && (
          <div>
            <CheckCircle2 size={40} style={{ color: T.green, marginBottom: 16 }} />
            <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 10 }}>
              {uk ? "Пароль змінено" : "Password changed"}
            </div>
            <div style={{ fontSize: 14, color: T.t3 }}>
              {uk ? "Переходимо в робочий простір…" : "Taking you to your workspace…"}
            </div>
          </div>
        )}

        {status === "ready" && (
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 6 }}>
              {uk ? "Новий пароль" : "Set a new password"}
            </div>
            <div style={{ fontSize: 13, color: T.t4, marginBottom: 28 }}>
              {uk ? `Мінімум ${MIN_LEN} символів.` : `At least ${MIN_LEN} characters.`}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={labelStyle}>{uk ? "Новий пароль" : "New password"}</label>
                <div style={{ position: "relative" }}>
                  <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••••" autoComplete="new-password" autoFocus
                    style={inputStyle} onFocus={focus} onBlur={blur}
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)} style={{
                    position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0,
                  }}>
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <label style={labelStyle}>{uk ? "Повторіть пароль" : "Repeat password"}</label>
                <input type={showPw ? "text" : "password"} value={confirm} onChange={e => setConfirm(e.target.value)}
                  placeholder="••••••••••" autoComplete="new-password"
                  onKeyDown={e => { if (e.key === "Enter") save() }}
                  style={inputStyle} onFocus={focus} onBlur={blur}
                />
              </div>

              {error && (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#FF4D6A", padding: "9px 12px", borderRadius: 9, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
                  <AlertCircle size={13} /> {error}
                </div>
              )}

              <button onClick={save} disabled={loading} style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 600, marginTop: 4,
                background: loading ? "rgba(232,0,42,0.3)" : T.red,
                border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
                boxShadow: loading ? "none" : "0 0 24px rgba(232,0,42,0.30)",
              }}>
                {loading && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
                {loading ? (uk ? "Зберігаю…" : "Saving…") : (uk ? "Зберегти пароль" : "Save password")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}