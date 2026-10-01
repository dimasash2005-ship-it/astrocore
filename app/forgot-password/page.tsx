"use client";

// app/forgot-password/page.tsx
//
// "Забули пароль?" — the user types their email, Supabase sends a link.
// The link goes to /auth/callback → logs them in → /reset-password,
// where they set a new password.

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Loader2, MailCheck } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";

const T = {
  bg:  "#08080F",
  t1:  "#F0EDF8",
  t3:  "#A8A4BC",
  t4:  "#585878",
  red: "#E8002A",
  green: "#22C55E",
}

export default function ForgotPasswordPage() {
  const { language } = useLanguage()
  const uk = language !== "en"

  const [email,   setEmail]   = useState("")
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")
  const [sent,    setSent]    = useState(false)

  async function send() {
    const value = email.trim()
    if (!/^\S+@\S+\.\S+$/.test(value)) {
      setError(uk ? "Введіть правильний email." : "Enter a valid email.")
      return
    }
    setLoading(true); setError("")
    const { error: e } = await getSupabase().auth.resetPasswordForEmail(value, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    })
    setLoading(false)
    if (e) {
      const tooMany = /rate|too many|seconds/i.test(e.message)
      setError(tooMany
        ? (uk ? "Забагато спроб. Зачекайте хвилину й спробуйте знову." : "Too many attempts. Wait a minute and try again.")
        : (uk ? "Не вдалося надіслати лист. Спробуйте ще раз." : "Couldn't send the email. Please try again."))
      return
    }
    // Same message whether the account exists or not — don't reveal who is registered.
    setSent(true)
  }

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      padding: "48px 20px",
      background: "radial-gradient(ellipse 80% 50% at 50% 0%,rgba(232,0,42,0.10) 0%,transparent 70%), linear-gradient(180deg,#0D0D1A 0%,#08080F 100%)",
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        <Link href="/login" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.t3, textDecoration: "none", marginBottom: 28 }}>
          <ArrowLeft size={14} /> {uk ? "Назад до входу" : "Back to sign in"}
        </Link>

        {sent ? (
          <div>
            <div style={{
              width: 48, height: 48, borderRadius: 14, marginBottom: 20,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(34,197,94,0.12)", border: "0.5px solid rgba(34,197,94,0.35)",
            }}>
              <MailCheck size={22} style={{ color: T.green }} />
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 10 }}>
              {uk ? "Перевірте пошту" : "Check your email"}
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.65, color: T.t3 }}>
              {uk
                ? <>Якщо акаунт з <b style={{ color: T.t1 }}>{email.trim()}</b> існує, ми надіслали туди посилання для нового пароля. Відкрийте його в цьому ж браузері. Не бачите листа — перевірте «Спам».</>
                : <>If an account with <b style={{ color: T.t1 }}>{email.trim()}</b> exists, we&apos;ve sent a link to set a new password. Open it in this same browser. Can&apos;t see it? Check your spam folder.</>}
            </div>
            <button onClick={() => { setSent(false); setError("") }} style={{
              marginTop: 24, background: "none", border: "none", padding: 0, cursor: "pointer",
              color: T.red, fontSize: 13, fontWeight: 600,
            }}>
              {uk ? "Надіслати ще раз" : "Send again"}
            </button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 6 }}>
              {uk ? "Забули пароль?" : "Forgot your password?"}
            </div>
            <div style={{ fontSize: 13, color: T.t4, marginBottom: 28 }}>
              {uk ? "Введіть email — надішлемо посилання, щоб створити новий пароль." : "Enter your email and we'll send you a link to set a new password."}
            </div>

            <label style={{ fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
              Email
            </label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="operator@astrocore.ai" autoComplete="email" autoFocus
              onKeyDown={e => { if (e.key === "Enter") send() }}
              style={{
                background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 10, padding: "12px 14px", fontSize: 14,
                color: T.t1, outline: "none", width: "100%",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }}
            />

            {error && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 12.5, color: "#FF4D6A", padding: "9px 12px", borderRadius: 9, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
                <AlertCircle size={13} /> {error}
              </div>
            )}

            <button onClick={send} disabled={loading} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: 13, borderRadius: 11, fontSize: 14, fontWeight: 600, marginTop: 18,
              background: loading ? "rgba(232,0,42,0.3)" : T.red,
              border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 0 24px rgba(232,0,42,0.30)",
            }}>
              {loading && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
              {loading ? (uk ? "Надсилаю…" : "Sending…") : (uk ? "Надіслати посилання" : "Send reset link")}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}