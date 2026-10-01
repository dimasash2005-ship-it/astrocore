"use client"

// components/auth/GoogleButton.tsx
//
// "Continue with Google" for the login and register pages.
// Google → Supabase → /auth/callback (exchanges the code, logs in) → next.
// Works for new and existing users alike: Supabase creates the account on
// the first Google sign-in.

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"

export default function GoogleButton({ language, next = "/" }: { language: string; next?: string }) {
  const uk = language !== "en"
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  async function go() {
    setLoading(true); setError("")
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/"
    const { error: e } = await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext)}`,
        queryParams: { prompt: "select_account" },
      },
    })
    // On success the browser is already leaving for Google.
    if (e) {
      setLoading(false)
      setError(uk ? "Не вдалося увійти через Google. Спробуйте ще раз." : "Couldn't sign in with Google. Please try again.")
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 11, color: "#585878", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        <span style={{ flex: 1, height: 0.5, background: "rgba(255,255,255,0.10)" }} />
        {uk ? "або" : "or"}
        <span style={{ flex: 1, height: 0.5, background: "rgba(255,255,255,0.10)" }} />
      </div>

      <button type="button" onClick={go} disabled={loading} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
        padding: 12, borderRadius: 11, fontSize: 14, fontWeight: 600,
        background: "#F4F2F8", color: "#1F1F2A", border: "none",
        cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
        transition: "background 130ms ease",
      }}
        onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FFFFFF" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "#F4F2F8" }}
      >
        {loading
          ? <Loader2 size={16} style={{ animation: "spin 0.8s linear infinite" }} />
          : <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
              <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
              <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
              <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>
            </svg>}
        {uk ? "Продовжити з Google" : "Continue with Google"}
      </button>

      {error && <div style={{ fontSize: 12.5, color: "#FF4D6A", textAlign: "center" }}>{error}</div>}
    </div>
  )
}