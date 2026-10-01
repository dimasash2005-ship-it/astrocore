"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { getSupabase } from "@/lib/supabase/client"

const PUBLIC_ROUTES = new Set(["/login", "/register"])
// Pages open to everyone (logged in or not) — no redirects at all
// /forgot-password and /reset-password: reachable logged out (forgot) and
// right after the email link logs the user in (reset) — so never redirect.
const OPEN_ROUTES = new Set(["/terms", "/privacy-policy", "/forgot-password", "/reset-password"])

function Spinner() {
  return (
    <div style={{
      position: "fixed", inset: 0, background: "#08080F",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
    }}>
      <style>{`@keyframes aspin { to { transform: rotate(360deg) } }`}</style>
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        border: "2px solid rgba(232,0,42,0.15)",
        borderTop: "2px solid #E8002A",
        animation: "aspin 0.8s linear infinite",
      }} />
    </div>
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [ready,  setReady]  = useState(false)
  const [authed, setAuthed] = useState(false)

  const isOpen      = OPEN_ROUTES.has(pathname)
  const isPublic    = PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/auth/")
  const showSidebar = authed && !isPublic && !isOpen

  useEffect(() => {
    const sb = getSupabase()

    sb.auth.getSession().then(({ data: { session } }) => {
      const loggedIn = !!session?.user
      setAuthed(loggedIn)
      setReady(true)
      if (isOpen) return
      if (loggedIn && isPublic) router.replace("/")
      else if (!loggedIn && !isPublic) router.replace("/login")
    })

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      const loggedIn = !!session?.user
      setAuthed(loggedIn)
      setReady(true)
      if (isOpen) return
      if (loggedIn && isPublic) router.replace("/")
      else if (!loggedIn && !isPublic) router.replace("/login")
    })

    return () => subscription.unsubscribe()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready && !isPublic && !isOpen) return <Spinner />

  return (
    <>
      {showSidebar && <Sidebar />}
      {children}
    </>
  )
}