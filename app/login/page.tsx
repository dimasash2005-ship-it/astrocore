"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function login() {
    if (!email.trim() || !password.trim()) {
      setError("Заповніть email і пароль");
      return;
    }
    setLoading(true);
    setError("");

    const sb = getSupabase();
    const { error: authError } = await sb.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      setError("Невірний email або пароль");
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#08080F",
      backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px,transparent 1px)",
      backgroundSize: "24px 24px",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }}>
      <div style={{
        width: "100%", maxWidth: 400,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.20)",
        borderRadius: 18,
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        padding: "36px 32px 30px",
        position: "relative", overflow: "hidden",
      }}>
        <div aria-hidden style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 160, pointerEvents: "none",
          background: "radial-gradient(ellipse 100% 100% at 50% 0%,rgba(232,0,42,0.08) 0%,transparent 100%)",
        }} />

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 15, margin: "0 auto 14px",
            background: "linear-gradient(145deg,#C0001A 0%,#720010 100%)",
            boxShadow: "0 0 0 1.5px rgba(232,0,42,0.40), 0 0 24px rgba(232,0,42,0.30)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontWeight: 800, color: "#fff",
          }}>
            A
          </div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#F0EDF8", letterSpacing: "-0.03em" }}>
            Astro<span style={{ color: "#E8002A" }}>Core</span>
          </div>
          <div style={{ fontSize: 11, color: "#585878", marginTop: 3, textTransform: "uppercase", letterSpacing: "0.09em" }}>
            AI Workspace
          </div>
        </div>

        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#F0EDF8", marginBottom: 4 }}>Вхід в акаунт</div>
          <div style={{ fontSize: 12, color: "#585878" }}>Operator Authentication Layer</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            style={{
              background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
              borderRadius: 10, padding: "11px 14px", fontSize: 14,
              color: "#F0EDF8", outline: "none", width: "100%",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
            onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
          />

          <div style={{ position: "relative" }}>
            <input
              type={showPw ? "text" : "password"}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Пароль"
              autoComplete="current-password"
              onKeyDown={e => { if (e.key === "Enter") login() }}
              style={{
                background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
                borderRadius: 10, padding: "11px 44px 11px 14px", fontSize: 14,
                color: "#F0EDF8", outline: "none", width: "100%",
              }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
            <button
              type="button"
              onClick={() => setShowPw(v => !v)}
              style={{
                position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: "#585878", lineHeight: 0,
              }}
            >
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              fontSize: 12.5, color: "#FF4D6A", padding: "8px 12px", borderRadius: 8,
              background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)",
            }}>
              <AlertCircle size={13} /> {error}
            </div>
          )}

          <button
            onClick={login}
            disabled={loading}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "12px", borderRadius: 11, fontSize: 14, fontWeight: 600,
              background: loading ? "rgba(232,0,42,0.3)" : "#E8002A",
              border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
              boxShadow: loading ? "none" : "0 0 20px rgba(232,0,42,0.30)",
              marginTop: 4,
            }}
            onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
            onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#E8002A" }}
          >
            {loading && <Loader2 size={14} style={{ animation: "aspin 0.8s linear infinite" }} />}
            {loading ? "Входимо..." : "Увійти"}
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 20, fontSize: 12.5, color: "#585878" }}>
          Немає акаунта?{" "}
          <Link href="/register" style={{ color: "#E8002A", textDecoration: "none", fontWeight: 500 }}>
            Зареєструватись
          </Link>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}