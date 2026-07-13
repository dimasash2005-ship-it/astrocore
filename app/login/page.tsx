"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2, Bot, Brain, Zap, Shield, Globe } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { useLanguage } from "@/lib/useLanguage";

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

function LeftPanel({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  const [pulse, setPulse] = useState(false)
  const [scan,  setScan]  = useState(0)

  useEffect(() => {
    const p = setInterval(() => setPulse(v => !v), 1800)
    const s = setInterval(() => setScan(v => (v + 1) % 3), 3000)
    return () => { clearInterval(p); clearInterval(s) }
  }, [])

  const FEATURES = [
    { icon: Bot,    title: t.loginPage.feature1Title, desc: t.loginPage.feature1Desc },
    { icon: Brain,  title: t.loginPage.feature2Title, desc: t.loginPage.feature2Desc },
    { icon: Zap,    title: t.loginPage.feature3Title, desc: t.loginPage.feature3Desc },
    { icon: Globe,  title: t.loginPage.feature4Title, desc: t.loginPage.feature4Desc },
  ]

  return (
    <div style={{
      flex: 1, display: "flex", flexDirection: "column",
      padding: "48px 52px",
      background: "linear-gradient(160deg,#0C0C18 0%,#08080F 60%,#0A0812 100%)",
      position: "relative", overflow: "hidden",
      borderRight: "0.5px solid rgba(255,255,255,0.06)",
    }}>
      {/* animated background lines */}
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

      {/* top glow */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 280,
        background: "radial-gradient(ellipse 100% 80% at 50% 0%,rgba(232,0,42,0.10) 0%,transparent 100%)",
        pointerEvents: "none",
      }} />
      <div aria-hidden style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 180,
        background: "radial-gradient(ellipse 100% 80% at 30% 100%,rgba(232,0,42,0.07) 0%,transparent 100%)",
        pointerEvents: "none",
      }} />

      {/* dot grid */}
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
        }}>
          A
        </div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", lineHeight: 1 }}>
            Astro<span style={{ color: T.red }}>Core</span>
          </div>
          <div style={{ fontSize: 9.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.10em", marginTop: 2 }}>
            AI Workspace
          </div>
        </div>

        {/* AI Core indicator */}
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
          <span style={{ fontSize: 9.5, color: T.red, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{t.loginPage.online}</span>
        </div>
      </div>

      {/* Headline */}
      <div style={{ position: "relative", zIndex: 1, marginBottom: 36 }}>
        <h1 style={{
          fontSize: 38, fontWeight: 800, color: T.t1,
          letterSpacing: "-0.04em", lineHeight: 1.12, margin: 0, marginBottom: 14,
        }}>
          {t.loginPage.headline1}<br />
          <span style={{ color: T.red }}>{t.loginPage.headline2}</span> {t.loginPage.headline3}<br />
          {t.loginPage.headline4}
        </h1>
        <p style={{ fontSize: 14, color: T.t3, lineHeight: 1.65, margin: 0, maxWidth: 360 }}>
          {t.loginPage.subhead}
        </p>
      </div>

      {/* Features */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 36, position: "relative", zIndex: 1 }}>
        {FEATURES.map(({ icon: Icon, title, desc }) => (
          <div key={title} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={14} style={{ color: T.red, opacity: 0.85 }} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.t1, marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.5 }}>{desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Provider badges */}
      <div style={{ position: "relative", zIndex: 1 }}>
        <div style={{ fontSize: 10, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
          {t.loginPage.connectedProviders}
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

      {/* Memory indicator */}
      <div style={{
        position: "absolute", bottom: 32, left: 52,
        display: "flex", alignItems: "center", gap: 7,
        background: "rgba(139,92,246,0.10)", border: "0.5px solid rgba(139,92,246,0.25)",
        borderRadius: 8, padding: "5px 10px",
      }}>
        <Brain size={12} style={{ color: "#A78BFA" }} />
        <span style={{ fontSize: 10.5, color: "#A78BFA", fontWeight: 500 }}>{t.loginPage.memoryLayerActive}</span>
      </div>
    </div>
  )
}

function LoginForm({ t }: { t: ReturnType<typeof useLanguage>["t"] }) {
  const searchParams = useSearchParams()
  const nextPath = searchParams.get("next") ?? "/"

  const [email,   setEmail]   = useState("")
  const [password,setPassword]= useState("")
  const [showPw,  setShowPw]  = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function login() {
    if (!email.trim() || !password.trim()) { setError(t.loginPage.fillFieldsError); return }
    setLoading(true); setError("")
    const sb = getSupabase()
    const { error: authError } = await sb.auth.signInWithPassword({ email: email.trim(), password })
    if (authError) { setError(t.loginPage.wrongCredentialsError); setLoading(false); return }
    window.location.href = nextPath
  }

  return (
    <div style={{
      width: 420, display: "flex", flexDirection: "column",
      padding: "0 8px",
    }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em", marginBottom: 6 }}>
          {t.loginPage.title}
        </div>
        <div style={{ fontSize: 13, color: T.t4 }}>{t.loginPage.subtitle}</div>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
            {t.loginPage.email}
          </label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            placeholder="operator@astrocore.ai"
            autoComplete="email"
            style={{
              background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 10, padding: "12px 14px", fontSize: 14,
              color: T.t1, outline: "none", width: "100%",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }}
          />
        </div>

        <div>
          <label style={{ fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em", display: "block", marginBottom: 7 }}>
            {t.loginPage.password}
          </label>
          <div style={{ position: "relative" }}>
            <input type={showPw ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              autoComplete="current-password"
              onKeyDown={e => { if (e.key === "Enter") login() }}
              style={{
                background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 10, padding: "12px 44px 12px 14px", fontSize: 14,
                color: T.t1, outline: "none", width: "100%",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.45)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(232,0,42,0.06)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"; e.currentTarget.style.boxShadow = "none" }}
            />
            <button type="button" onClick={() => setShowPw(v => !v)} style={{
              position: "absolute", right: 13, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0,
            }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#FF4D6A", padding: "9px 12px", borderRadius: 9, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        <button onClick={login} disabled={loading} style={{
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
          {loading ? t.loginPage.signingIn : t.loginPage.signIn}
        </button>
      </div>

      {/* Security note */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginTop: 20,
        padding: "9px 12px", borderRadius: 9,
        background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
        fontSize: 11.5, color: T.t4,
      }}>
        <Shield size={12} style={{ flexShrink: 0, color: T.green }} />
        {t.loginPage.securityNote}
      </div>

      {/* Register link */}
      <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: T.t4 }}>
        {t.loginPage.noAccount}{" "}
        <Link href="/register" style={{ color: T.red, textDecoration: "none", fontWeight: 600 }}>
          {t.loginPage.signUp}
        </Link>
      </div>
    </div>
  )
}

function LoginPage() {
  const { t } = useLanguage()
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      background: T.bg,
    }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>

      {/* Left side — only on large screens */}
      <div style={{ display: "flex", flex: 1 }} className="auth-left">
        <LeftPanel t={t} />
      </div>

      {/* Right side — form */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "48px 32px",
        background: "linear-gradient(180deg,#0D0D1A 0%,#08080F 100%)",
        minWidth: 480,
        position: "relative",
      }}>
        {/* subtle vertical red line on left */}
        <div aria-hidden style={{
          position: "absolute", left: 0, top: "20%", bottom: "20%", width: 1,
          background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.35),transparent)",
          pointerEvents: "none",
        }} />
        <Suspense fallback={null}>
          <LoginForm t={t} />
        </Suspense>
      </div>
    </div>
  )
}

export default LoginPage