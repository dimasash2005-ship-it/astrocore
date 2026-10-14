"use client"

import { useEffect, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Sidebar } from "@/components/layout/Sidebar"
import { getSupabase } from "@/lib/supabase/client"
import Landing from "@/components/landing/Landing"
import CosmosLoader from "@/components/cosmos/CosmosLoader"
import LevelUpToast from "@/components/cosmos/LevelUpToast"

// The galaxy intro plays fully once per browser session; after that it only shows while loading.
const BOOT_KEY = "astrocore_boot_seen"
const BOOT_MIN_MS = 1500

const PUBLIC_ROUTES = new Set(["/login", "/register"])
// Pages open to everyone (logged in or not) — no redirects at all
const OPEN_ROUTES = new Set(["/terms", "/privacy-policy"])


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router   = useRouter()
  const pathname = usePathname()

  const [ready,  setReady]  = useState(false)
  const [authed, setAuthed] = useState(false)
  const [boot,   setBoot]   = useState<"on" | "out" | "off">("on")
  const [bootStart] = useState(() => (typeof performance !== "undefined" ? performance.now() : 0))

  const isHome      = pathname === "/"
  const isOpen      = OPEN_ROUTES.has(pathname) || pathname === "/guides" || pathname.startsWith("/guides/") || pathname.startsWith("/r/") || pathname.startsWith("/s/") || pathname.startsWith("/c/")
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

  // Keep the intro on screen for a moment the first time, then fade it out over the app.
  useEffect(() => {
    if (!ready || boot !== "on") return
    let seen = false
    try { seen = window.sessionStorage.getItem(BOOT_KEY) === "1"; window.sessionStorage.setItem(BOOT_KEY, "1") } catch { /* private mode */ }
    const wait = seen ? 0 : Math.max(0, BOOT_MIN_MS - (performance.now() - bootStart))
    const t1 = setTimeout(() => setBoot("out"), wait)
    const t2 = setTimeout(() => setBoot("off"), wait + 450)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps

  const gate = !ready && !isPublic && !isOpen
  // The loader always sits in the same slot, so it doesn't restart when the app appears under it.
  const loader = (gate || (boot !== "off" && !isPublic && !isOpen))
    ? <CosmosLoader exiting={!gate && boot === "out"} />
    : null

  let content: React.ReactNode = null
  if (gate) content = null
  else if (isHome && !authed) content = <Landing /> // guest on "/" → landing instead of the dashboard
  else content = (
    <>
      {showSidebar && <Sidebar />}
      {children}
      {showSidebar && <LevelUpToast />}
    </>
  )

  return (
    <>
      {content}
      {loader}
    </>
  )
}