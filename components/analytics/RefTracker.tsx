"use client"

// Remembers where a visitor came from (?ref=clawhub, ?utm_source=...) and,
// when that visitor signs up, saves it to their Supabase profile
// (user_metadata.ref) and sends a "sign_up" event to Google Analytics.
// Renders nothing. Mounted once in app/layout.tsx.

import { useEffect } from "react"
import { getSupabase } from "@/lib/supabase/client"

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}

const KEY = "ac_ref"
const NEW_USER_WINDOW_MS = 24 * 60 * 60 * 1000 // signed up in the last 24 h
let busy = false

function readRef(): string | null {
  try {
    const v = localStorage.getItem(KEY)
    return v ? (JSON.parse(v).ref as string) : null
  } catch { return null }
}

export default function RefTracker() {
  useEffect(() => {
    // 1. Remember the source from the URL (first touch wins)
    try {
      const p = new URLSearchParams(window.location.search)
      const r = p.get("ref") || p.get("utm_source")
      if (r && /^[a-z0-9_.-]{1,40}$/i.test(r) && !localStorage.getItem(KEY)) {
        localStorage.setItem(KEY, JSON.stringify({ ref: r.toLowerCase(), at: Date.now() }))
      }
    } catch { /* storage blocked: nothing to remember */ }

    const sb = getSupabase()

    // 2. When a user is signed in, record the signup once
    async function check(user: { created_at?: string; user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> } | null | undefined) {
      if (!user || busy) return
      const meta = user.user_metadata || {}
      if (meta.signup_tracked) return
      busy = true
      try {
        const created = user.created_at ? new Date(user.created_at).getTime() : 0
        const isNew = Date.now() - created < NEW_USER_WINDOW_MS
        const ref = readRef() || "direct"

        if (isNew) {
          window.gtag?.("event", "sign_up", {
            method: String(user.app_metadata?.provider || "email"),
            ref,
          })
        }
        await sb.auth.updateUser({
          data: isNew ? { signup_tracked: true, ref } : { signup_tracked: true },
        })
        try { localStorage.removeItem(KEY) } catch {}
      } catch { /* never break the app because of analytics */ }
      finally { busy = false }
    }

    // IMPORTANT: never call Supabase auth methods directly inside
    // onAuthStateChange — it deadlocks the whole auth client. Defer with setTimeout.
    let timer: ReturnType<typeof setTimeout> | undefined
    const { data: { subscription } } = sb.auth.onAuthStateChange((event, session) => {
      if (event !== "INITIAL_SESSION" && event !== "SIGNED_IN") return
      const user = session?.user
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => { check(user) }, 1500)
    })
    return () => { if (timer) clearTimeout(timer); subscription.unsubscribe() }
  }, [])

  return null
}