"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2, Bot, Brain, Zap, Shield, Globe, Check, Mail } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";
import { LANGUAGES, type Language } from "@/lib/language";

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

const PROVIDERS = [
  { label: "Claude",  color: "#D97757", bg: "rgba(217,119,87,0.12)"  },
  { label: "OpenAI",  color: "#10A37F", bg: "rgba(16,163,127,0.12)"  },
  { label: "Gemini",  color: "#4285F4", bg: "rgba(66,133,244,0.12)"  },
  { label: "Custom",  color: "#8B5CF6", bg: "rgba(139,92,246,0.12)"  },
]

// Small pill in the corner showing both languages at once — click
// either side to switch immediately, no menu/cycling needed.
function LanguageBadge({ language, setLanguage }: { language: Language; setLanguage: (l: Language) => void }) {
  return (
    <div style={{
      position: "fixed", top: 22, right: 26, zIndex: 50,
      display: "flex", alignItems: "center", gap: 2,
      padding: 3, borderRadius: 999,
      background: "rgba(17,17,28,0.75)",
      border: "0.5px solid rgba(255,255,255,0.12)",
      backdropFilter: "blur(10px)",
      boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
    }}>
      {LANGUAGES.map(l => {
        const active = l.code === language
        return (
          <button key={l.code} onClick={() => setLanguage(l.code)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 12px", borderRadius: 999, border: "none", cursor: "pointer",
            background: active ? "rgba(232,0,42,0.20)" : "transparent",
            color: active ? "#F4F0FF" : "#8A86A8",
            fontSize: 12, fontWeight: active ? 600 : 400,
            transition: "background 150ms ease, color 150ms ease",
          }}
            onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#C8C4D8" }}
            onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = "#8A86A8" }}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>{l.flag}</span>
            {l.code.toUpperCase()}
          </button>
        )
      })}
    </div>
  )
}

function LeftPanel({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  const [pulse, setPulse] = useState(false)
  const [scan,  setScan]  = useState(0)

  useEffect(() => {
    const p = setInterval(() => setPulse(v => !v), 1800)
    const s = setInterval(() => setScan(v => (v + 1) % 3), 3000)
    return () => { clearInterval(p); clearInterval(s) }
  }, [])

  const BENEFITS = [
    { icon: Bot,    text: t.registerPage.benefit1 },
    { icon: Brain,  text: t.registerPage.benefit2 },
    { icon: Globe,  text: t.registerPage.benefit3 },
    { icon: Shield, text: t.registerPage.benefit4 },
    { icon: Zap,    text: t.registerPage.benefit5 },
  ]

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "48px 52px",
      background: "linear-gradient(160deg,#0C0C18 0%,#08080F 60%,#0A0812 100%)",
      position: "relative", overflow: "hidden",
      borderRight: "0.5px solid rgba(255,255,255,0.06)",
    }}>
      {[...Array(3)].map((_, i) => (
        <div key={i} aria-hidden style={{
          position: "absolute",
          top: `${20 + i * 28}%`,
          left: scan === i ? "-10%" : "110%",
          width: "40%", height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.35),transparent)",
          transition: "left 2.5s ease-in-out",
          pointerEvents: "none",
        }} />
      ))}

      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 280,
        background: "radial-gradient(ellipse 100% 80% at 50% 0%,rgba(232,0,42,0.10) 0%,transparent 100%)",
        pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "radial-gradient(rgba(255,255,255,0.028) 1px,transparent 1px)",
        backgroundSize: "28px 28px",
      }} />

      {/* Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 52, position: "relative", zIndex: 1 }}>
        <div style={{
          width: 42, height: 42, borderRadius: 12,
          background: "linear-gradient(145deg,#C0001A 0%,#720010 100%)",
          boxShadow: "0 0 0 1.5px rgba(232,0,42,0.40), 0 0 20px rgba(232,0,42,0.28)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 18, fontWeight: 800, color: "#fff",
        }}>A</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Astro<span style={{ color: T.red }}>Core</span>
          </div>
          <div style={{ fontSize: 9.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.10em", marginTop: 2 }}>
            AI Workspace
          </div>
        </div>
        <div style={{
          marginLeft: "auto",
          display: "flex", alignItems: "center", gap: 5,
          background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.25)",
          borderRadius: 20, padding: "3px 9px",
        }}>
          <span style={{
            width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block",
            opacity: pulse ? 1 : 0.25,
            transition: "opacity 900ms ease, box-shadow 900ms ease",
            boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
          }} />
          <span style={{ fontSize: 9.5, color: T.red, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{t.registerPage.online}</span>
        </div>
      </div>

      {/* Headline */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: 36 }}>
        <h1 style={{ fontSize: 38, fontWeight: 800, color: T.t1, letterSpacing: "-0.04em", lineHeight: 1.12, margin: 0, marginBottom: 14 }}>
          {t.registerPage.headline1}<br />
          <span style={{ color: T.red }}>{t.registerPage.headline2}</span><br />
          {t.registerPage.headline3}
        </h1>
        <p style={{ fontSize: 14, color: T.t3, lineHeight: 1.65, margin: 0, maxWidth: 360 }}>
          {t.registerPage.subhead}
        </p>
      </div>

      {/* Benefits */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 36, position: "relative", zIndex: 1 }}>
        {BENEFITS.map(({ icon: Icon, text }) => (
          <div key={text} style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 7, flexShrink: 0,
              background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Check size={12} style={{ color: T.green }} />
            </div>
            <span style={{ fontSize: 13, color: T.t2 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Providers */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
          {t.registerPage.supportedProviders}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PROVIDERS.map(p => (
            <div key={p.label} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "5px 10px", borderRadius: 8,
              background: p.bg, border: `0.5px solid ${p.color}33`,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
              <span style={{ fontSize: 11, color: p.color, fontWeight: 500 }}>{p.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        position: "absolute", bottom: 32, left: 52,
        display: "flex", alignItems: "center", gap: 7,
        background: "rgba(139,92,246,0.10)", border: "0.5px solid rgba(139,92,246,0.25)",
        borderRadius: 8, padding: "5px 10px",
      }}>
        <Brain size={12} style={{ color: "#A78BFA" }} />
        <span style={{ fontSize: 10.5, color: "#A78BFA", fontWeight: 500 }}>{t.registerPage.memoryLayerActive}</span>
      </div>
    </div>
  )
}

// Shown after signUp() returns with no active session — meaning
// Supabase is waiting on email confirmation before this account can
// actually sign in. Without this screen the person just gets bounced
// back to a login-ish state with no explanation of why.
function ConfirmEmailPanel({ email, language, onBack }: { email: string; language: Language; onBack: () => void }) {
  const [resending, setResending] = useState(false)
  const [resent,    setResent]    = useState(false)
  const [error,     setError]     = useState("")

  async function handleResend() {
    if (resending) return
    setResending(true)
    setError("")
    const sb = getSupabase()
    const { error: resendError } = await sb.auth.resend({ type: "signup", email })
    setResending(false)
    if (resendError) { setError(resendError.message); return }
    setResent(true)
    setTimeout(() => setResent(false), 4000)
  }

  return (
    <div style={{ width: 420, display: "flex", flexDirection: "column", padding: "0 8px" }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16, marginBottom: 24,
        background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.25)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Mail size={24} style={{ color: T.red }} />
      </div>

      <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 10 }}>
        {language === "uk" ? "Перевірте пошту" : "Check your email"}
      </div>
      <p style={{ fontSize: 14, color: T.t3, lineHeight: 1.6, margin: "0 0 4px" }}>
        {language === "uk" ? "Ми надіслали лист із підтвердженням на" : "We sent a confirmation link to"}
      </p>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 22, wordBreak: "break-all" }}>{email}</div>

      <div style={{
        display: "flex", alignItems: "flex-start", gap: 10,
        padding: "13px 15px", borderRadius: 10, marginBottom: 20,
        background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
      }}>
        <AlertCircle size={14} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
        <span style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.55 }}>
          {language === "uk"
            ? "Перейдіть за посиланням у листі, щоб підтвердити акаунт — без цього увійти не вийде. Не бачите листа? Перевірте папку Спам."
            : "Click the link in the email to confirm your account — you won't be able to sign in without it. Don't see it? Check your Spam folder."}
        </span>
      </div>

      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#FF4D6A", padding: "9px 12px", borderRadius: 9, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", marginBottom: 16 }}>
          <AlertCircle size={13} /> {error}
        </div>
      )}

      <button onClick={handleResend} disabled={resending} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        padding: "12px", borderRadius: 11, fontSize: 13.5, fontWeight: 500,
        background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
        color: resent ? T.green : T.t2, cursor: resending ? "default" : "pointer",
        transition: "background 130ms ease, color 130ms ease",
      }}
        onMouseEnter={e => { if (!resending) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)" }}
      >
        {resending ? <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
          : resent ? <Check size={14} /> : null}
        {resending
          ? (language === "uk" ? "Надсилаємо..." : "Sending...")
          : resent
          ? (language === "uk" ? "Лист надіслано ще раз" : "Email resent")
          : (language === "uk" ? "Надіслати лист ще раз" : "Resend email")}
      </button>

      <div style={{ textAlign: "center", marginTop: 22, fontSize: 13, color: T.t4 }}>
        <button onClick={onBack} style={{ background: "none", border: "none", cursor: "pointer", color: T.red, fontWeight: 600, fontSize: 13, padding: 0 }}>
          {language === "uk" ? "← Використати іншу пошту" : "← Use a different email"}
        </button>
      </div>
    </div>
  )
}

function RegisterForm({ t, language }: { t: ReturnType<typeof useLanguage>["t"]; language: Language }) {
  const [name,    setName]    = useState("")
  const [email,   setEmail]   = useState("")
  const [password,setPassword]= useState("")
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  // Set once signUp() succeeds but comes back with no session — i.e.
  // Supabase is holding the account pending email confirmation.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null)

  async function register() {
    if (!email.trim() || !password.trim()) { setError(t.registerPage.fillFieldsError); return }
    if (password.length < 6) { setError(t.registerPage.passwordTooShortError); return }
    setLoading(true); setError("")
    const sb = getSupabase()
    const { data, error: authError } = await sb.auth.signUp({
      email: email.trim(), password,
      options: { data: { full_name: name.trim() } },
    })
    setLoading(false)
    if (authError) { setError(authError.message); return }

    if (data.session) {
      // Email confirmation is off (or this address was pre-confirmed) —
      // there's already a live session, so go straight in.
      window.location.href = "/"
      return
    }
    // No session back means the account exists but can't sign in until
    // the confirmation link is clicked.
    setPendingEmail(email.trim())
  }

  if (pendingEmail) {
    return <ConfirmEmailPanel email={pendingEmail} language={language} onBack={() => setPendingEmail(null)} />
  }

  return (
    <div style={{ width: 420, display: "flex", flexDirection: "column", padding: "0 8px" }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 6 }}>
          {t.registerPage.title}
        </div>
        <div style={{ fontSize: 13, color: T.t4 }}>{t.registerPage.subtitle}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>{t.registerPage.nameLabel}</label>
          <input type="text" value={name} onChange={e => setName(e.target.value)}
            placeholder={t.registerPage.namePlaceholder}
            style={{ background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.t1, outline: "none", width: "100%" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>{t.registerPage.emailLabel}</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="operator@astrocore.ai"
            autoComplete="email"
            style={{ background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "12px 14px", fontSize: 14, color: T.t1, outline: "none", width: "100%" }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>{t.registerPage.passwordLabel}</label>
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t.registerPage.passwordPlaceholder}
              autoComplete="new-password"
              onKeyDown={e => { if (e.key === "Enter") register() }}
              style={{ background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)", borderRadius: 10, padding: "12px 44px 12px 14px", fontSize: 14, color: T.t1, outline: "none", width: "100%" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#FF4D6A", padding: "9px 12px", borderRadius: 9, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <button onClick={register} disabled={loading} style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          padding: "13px", borderRadius: 11, fontSize: 14, fontWeight: 600, marginTop: 4,
          background: loading ? "rgba(232,0,42,0.3)" : T.red,
          border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
          boxShadow: loading ? "none" : "0 0 24px rgba(232,0,42,0.30)",
          transition: "background 130ms ease",
        }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
        >
          {loading && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
          {loading ? t.registerPage.registering : t.registerPage.join}
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 20, padding: "9px 12px", borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)", fontSize: 11.5, color: T.t4 }}>
        <Shield size={12} style={{ flexShrink: 0, color: T.green }} />
        {t.registerPage.securityNote}
      </div>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.t4 }}>
        {t.registerPage.alreadyHaveAccount}{" "}
        <Link href="/login" style={{ color: T.red, textDecoration: "none", fontWeight: 600 }}>{t.registerPage.signIn}</Link>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const { t, language, setLanguage } = useLanguage()
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: T.bg }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      <LanguageBadge language={language} setLanguage={setLanguage} />

      <div style={{ display: "flex", flex: 1 }}>
        <LeftPanel t={t} />
      </div>

      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 32px",
        background: "linear-gradient(180deg,#0D0D1A 0%,#08080F 100%)",
        minWidth: 480, position: "relative",
      }}>
        <div aria-hidden style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%", width: 1,
          background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.35),transparent)",
          pointerEvents: "none",
        }} />
        <Suspense fallback={null}>
          <RegisterForm t={t} language={language} />
        </Suspense>
      </div>
    </div>
  )
}