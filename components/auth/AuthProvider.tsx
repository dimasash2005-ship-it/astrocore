"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { getSupabase } from "@/lib/supabase/client"
import Landing from "@/components/landing/Landing"

const PUBLIC_ROUTES = new Set(["/login", "/register"])
// Pages open to everyone (logged in or not) — no redirects at all
const OPEN_ROUTES = new Set(["/terms", "/privacy-policy"])

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

  const isHome      = pathname === "/"
  const isOpen      = OPEN_ROUTES.has(pathname)
  const isPublic    = PUBLIC_ROUTES.has(pathname) || pathname.startsWith("/auth/")
  const showSidebar = authed && !isPublic && !isOpen

  useEffect(() => {
    const sb = getSupabase()

    function route(loggedIn: boolean) {
      setAuthed(loggedIn)
      setReady(true)
      if (isOpen) return
      if (isHome && !loggedIn) return // guests see the landing page on "/"
      if (loggedIn && isPublic) router.replace("/")
      else if (!loggedIn && !isPublic) router.replace("/login")
    }

    sb.auth.getSession().then(({ data: { session } }) => route(!!session?.user))

    const { data: { subscription } } = sb.auth.onAuthStateChange((_event, session) => {
      route(!!session?.user)
    })

    return () => subscription.unsubscribe()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready && !isPublic && !isOpen) return <Spinner />

  // Guest on the home page → landing instead of the dashboard
  if (isHome && !authed) return <Landing />

  return (
    <>
      {showSidebar && <Sidebar />}
      {children}
    </>
  )
}