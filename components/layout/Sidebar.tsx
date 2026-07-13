"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  Home, Bot, MessageSquare, BookOpen,
  Image as ImageIcon, Brain, Settings, Key,
  ArrowLeft, Send, Mail, AtSign, X, User, Puzzle,
  ChevronDown, LogOut,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/useLanguage"
import { LANGUAGES, translations } from "@/lib/language"

// Collapsed (rail) width — this is what other pages reserve as margin.
export const SIDEBAR_W = 76
// Expanded width on hover, per the design reference (~270px).
const EXP_W = 270

const SPD = "200ms cubic-bezier(0.4,0,0.2,1)"

// The set of valid keys into t.sidebar, derived directly from the
// dictionary itself — if a key is renamed/removed in lib/language.ts,
// this (and anything using it below) will fail to compile instead of
// silently indexing with `any` at runtime.
type SidebarKey = keyof typeof translations.uk.sidebar

// Single flat list, matching the reference layout/order. `/providers`
// isn't shown in the design reference — kept at the end so the route
// stays reachable (not removing existing navigation/logic). `labelKey`
// looks up the actual text from lib/language.ts at render time, so the
// list itself never hardcodes a language.
const NAV_ITEMS: { href: string; icon: React.ElementType; labelKey: SidebarKey }[] = [
  { href: "/",             icon: Home,          labelKey: "center"        },
  { href: "/chat",         icon: MessageSquare, labelKey: "chat"          },
  { href: "/agents",       icon: Bot,           labelKey: "agents"        },
  { href: "/memory",       icon: Brain,         labelKey: "memory"        },
  { href: "/vault",        icon: BookOpen,      labelKey: "vault"         },
  { href: "/gallery",      icon: ImageIcon,     labelKey: "gallery"       },
  { href: "/integrations", icon: Puzzle,        labelKey: "integrations"  },
  { href: "/settings",     icon: Settings,      labelKey: "settings"      },
  { href: "/providers",    icon: Key,           labelKey: "providers"     },
]

function ContactPanel({ onClose }: { onClose: () => void }) {
  const { t } = useLanguage()
  return (
    <div style={{
      position: "absolute",
      bottom: "calc(100% + 8px)",
      left: 0,
      zIndex: 300,
      width: 232,
      borderRadius: 16,
      overflow: "hidden",
      background: "linear-gradient(160deg,#111124 0%,#0C0C1C 100%)",
      border: "1px solid rgba(232,0,42,0.28)",
      boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px 10px",
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
        background: "rgba(232,0,42,0.05)",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#EAE6FF" }}>{t.sidebar.contact}</div>
          <div style={{ fontSize: 10.5, color: "#44446A", marginTop: 1 }}>{t.sidebar.contactSubtitle}</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 5, color: "#484868", lineHeight: 0 }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: "8px 8px 10px" }}>
        {[
          { href: "https://t.me/astrocore_support", target: "_blank", Icon: Send,    ic: "#0088CC", ib: "rgba(0,136,204,0.14)",   ibd: "rgba(0,136,204,0.28)",   title: "Telegram",  sub: t.sidebar.telegramSubtitle },
          { href: "mailto:support@astrocore.ai",    target: undefined, Icon: Mail,   ic: "#E8002A", ib: "rgba(232,0,42,0.12)",    ibd: "rgba(232,0,42,0.28)",    title: "Email",     sub: "support@astrocore.ai" },
          { href: "https://instagram.com/astrocore", target: "_blank", Icon: AtSign, ic: "#C13584", ib: "rgba(193,53,132,0.12)",  ibd: "rgba(193,53,132,0.28)",  title: "Instagram", sub: "@astrocore"          },
        ].map(({ href, target, Icon, ic, ib, ibd, title, sub }) => (
          <a key={href} href={href} target={target} rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 10px", borderRadius: 10, textDecoration: "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.055)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0, background: ib, border: `1px solid ${ibd}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon size={14} style={{ color: ic }} />
            </div>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: "#E8E4F8" }}>{title}</div>
              <div style={{ fontSize: 10.5, color: "#4A4A6A", marginTop: 1 }}>{sub}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

function Label({ open, children, style }: { open: boolean; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span style={{
      opacity: open ? 1 : 0,
      transform: open ? "translateX(0)" : "translateX(-8px)",
      transition: `opacity ${SPD} 30ms, transform ${SPD} 30ms`,
      pointerEvents: open ? "auto" : "none",
      whiteSpace: "nowrap", overflow: "hidden",
      ...style,
    }}>
      {children}
    </span>
  )
}

function NavLink({ href, icon: Icon, label, active, open }: {
  href: string; icon: React.ElementType; label: string; active: boolean; open: boolean
}) {
  const [hov, setHov] = useState(false)
  return (
    <Link href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        display: "flex", alignItems: "center",
        height: 44, borderRadius: 14,
        padding: "0 14px", gap: 12,
        textDecoration: "none", overflow: "hidden", flexShrink: 0,
        cursor: "pointer",
        background: active
          ? "linear-gradient(135deg,rgba(140,4,26,0.55) 0%,rgba(90,2,17,0.35) 100%)"
          : hov ? "rgba(255,255,255,0.055)" : "transparent",
        boxShadow: active
          ? "0 0 0 1px rgba(232,0,42,0.35), 0 4px 18px rgba(232,0,42,0.22), inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -6px 14px rgba(0,0,0,0.25)"
          : "none",
        transition: `background ${SPD}, box-shadow ${SPD}`,
      }}>
      <Icon size={18} style={{
        flexShrink: 0,
        color: active ? "#FFFFFF" : hov ? "#E4E0F8" : "#ADA9C8",
        filter: active ? "drop-shadow(0 0 5px rgba(232,0,42,0.85))" : "none",
        transition: `color ${SPD}`,
      }} />
      <Label open={open} style={{ fontSize: 13.5, fontWeight: active ? 600 : 400, color: active ? "#FFFFFF" : hov ? "#DAD6F0" : "#ABA7C6", letterSpacing: "-0.01em" }}>
        {label}
      </Label>
    </Link>
  )
}

// Small language toggle — cycles through lib/language.ts's LANGUAGES
// list on click. Collapsed rail shows just the flag; expanded shows
// the language code too.
function LanguageSwitch({ open }: { open: boolean }) {
  const { language, setLanguage } = useLanguage()
  const current = LANGUAGES.find(l => l.code === language) ?? LANGUAGES[0]

  function cycle() {
    const idx = LANGUAGES.findIndex(l => l.code === language)
    const next = LANGUAGES[(idx + 1) % LANGUAGES.length]
    setLanguage(next.code)
  }

  return (
    <button onClick={cycle} title={current.label} style={{
      display: "flex", alignItems: "center", justifyContent: open ? "flex-start" : "center",
      height: 36, width: "100%",
      borderRadius: 11, padding: "0 12px", gap: 10,
      border: "0.5px solid rgba(255,255,255,0.07)",
      background: "rgba(255,255,255,0.03)", cursor: "pointer",
      overflow: "hidden", flexShrink: 0,
      transition: `background ${SPD}`,
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
    >
      <span style={{ fontSize: 15, lineHeight: 1, flexShrink: 0 }}>{current.flag}</span>
      <Label open={open} style={{ fontSize: 12.5, color: "#ABA7C6", fontWeight: 500 }}>
        {current.label}
      </Label>
    </button>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router    = useRouter()
  const { t }     = useLanguage()
  const [open,     setOpen]     = useState(false)
  const [contact,  setContact]  = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoErr,  setLogoErr]  = useState(false)
  const [pulse,    setPulse]    = useState(false)
  const [account,  setAccount]  = useState<{ name: string; email: string } | null>(null)
  const ref   = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Red pulse animation cycle
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1800)
    return () => clearInterval(id)
  }, [])

  // Real account info for the bottom profile row.
  useEffect(() => {
    const sb = getSupabase()
    sb.auth.getUser().then(({ data }) => {
      const user = data?.user
      if (!user) return
      const name = (user.user_metadata?.full_name as string | undefined)
        || (user.user_metadata?.name as string | undefined)
        || user.email?.split("@")[0]
        || "Користувач"
      setAccount({ name, email: user.email ?? "" })
    })
  }, [])

  const onEnter = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }, [])

  const onLeave = useCallback(() => {
    timer.current = setTimeout(() => { setOpen(false); setContact(false); setMenuOpen(false) }, 90)
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setContact(false)
        setMenuOpen(false)
      }
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  async function handleSignOut() {
    const sb = getSupabase()
    await sb.auth.signOut()
    router.push("/login")
  }

  const avatarLetter = (account?.name?.charAt(0) || "U").toUpperCase()

  return (
    <div ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{
      position: "fixed", top: 0, left: 0,
      height: "100vh", zIndex: 50,
      width: open ? EXP_W : SIDEBAR_W,
      transition: `width ${SPD}`,
      display: "flex", flexDirection: "column",
      overflow: "visible",
      background: "linear-gradient(180deg,#0C0C16 0%,#08080F 55%,#06060C 100%)",
      backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px,transparent 1px), linear-gradient(180deg,#0C0C16 0%,#08080F 55%,#06060C 100%)",
      backgroundSize: "22px 22px, auto",
      borderRight: "0.5px solid rgba(255,255,255,0.09)",
      boxShadow: open ? "6px 0 32px rgba(0,0,0,0.55)" : "2px 0 12px rgba(0,0,0,0.35)",
    }}>

      {/* top glow */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, pointerEvents: "none", background: "radial-gradient(ellipse 140% 90% at 50% 0%,rgba(232,0,42,0.10) 0%,transparent 100%)" }} />

      {/* bottom glow */}
      <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 160, pointerEvents: "none", background: "radial-gradient(ellipse 140% 90% at 50% 100%,rgba(232,0,42,0.07) 0%,transparent 100%)" }} />

      {/* right separator glow accents, layered on top of the hairline border */}
      <div aria-hidden style={{ position: "absolute", top: 60, right: 0, width: 1.5, height: 120, pointerEvents: "none", background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.55),transparent)" }} />
      <div aria-hidden style={{ position: "absolute", top: "60%", right: 0, width: 1, height: 90, pointerEvents: "none", background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.20),transparent)" }} />

      {/* animated red pulse dot — vertical center-left, visible even collapsed */}
      <div aria-hidden style={{
        position: "absolute", top: "50%", left: 8,
        width: 3, height: 3, borderRadius: "50%",
        background: "#E8002A", transform: "translateY(-50%)",
        transition: "opacity 900ms ease, box-shadow 900ms ease",
        opacity: pulse ? 1 : 0.2,
        boxShadow: pulse ? "0 0 8px rgba(232,0,42,1), 0 0 16px rgba(232,0,42,0.5)" : "none",
        pointerEvents: "none",
      }} />

      {/* inner column */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column",
        height: "100%",
        padding: "20px 14px 16px",
        overflow: "hidden",
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", flexShrink: 0, marginBottom: 22, gap: 12, overflow: "hidden" }}>
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              overflow: "hidden",
              background: "#000",
              boxShadow: "0 0 0 1.5px rgba(232,0,42,0.42), 0 0 22px rgba(232,0,42,0.30), inset 0 1px 0 rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {!logoErr ? (
                <Image src="/astrocore-logo.png" alt="AstroCore" width={40} height={40}
                  style={{ objectFit: "cover", objectPosition: "center 18%" }}
                  onError={() => setLogoErr(true)} />
              ) : (
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 16, letterSpacing: "-0.05em" }}>A</span>
              )}
            </div>
            <div style={{
              position: "absolute", inset: -3, borderRadius: 15,
              border: "1px solid rgba(232,0,42,0.5)",
              transition: "opacity 900ms ease",
              opacity: pulse ? 0.8 : 0.2,
              pointerEvents: "none",
            }} />
          </div>
          <Label open={open}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#EEE8FF", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Astro<span style={{ color: "#E8002A" }}>Core</span>
            </div>
            <div style={{ fontSize: 9.5, color: "#3A3A5E", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", marginTop: 2 }}>
              AI Workspace
            </div>
          </Label>
        </div>

        {/* Language switch */}
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <LanguageSwitch open={open} />
        </div>

        {/* Back */}
        {pathname !== "/" && (
          <button onClick={() => router.back()} style={{
            display: "flex", alignItems: "center", height: 38, width: "100%",
            borderRadius: 12, padding: "0 12px", gap: 10,
            border: "0.5px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)", cursor: "pointer",
            marginBottom: 14, flexShrink: 0, overflow: "hidden",
            transition: `background ${SPD}`,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
          >
            <ArrowLeft size={16} style={{ flexShrink: 0, color: "#9490B4" }} />
            <Label open={open} style={{ fontSize: 12.5, color: "#9490B4" }}>{t.sidebar.back}</Label>
          </button>
        )}

        {/* Navigation — flat list, generous spacing */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0, overflowY: "auto" }}>
          {NAV_ITEMS.map(item => (
            <NavLink key={item.href} href={item.href} icon={item.icon} label={t.sidebar[item.labelKey]} active={isActive(item.href)} open={open} />
          ))}
        </nav>

        <div style={{ flex: 1, minHeight: 12 }} />

        {/* Contact */}
        <div style={{ position: "relative", flexShrink: 0, marginBottom: 12 }}>
          <button onClick={() => setContact(v => !v)} style={{
            display: "flex", alignItems: "center", height: 40, width: "100%",
            borderRadius: 12, padding: "0 12px", gap: 10, border: "none", cursor: "pointer",
            overflow: "hidden",
            background: contact ? "rgba(232,0,42,0.14)" : "rgba(255,255,255,0.03)",
            outline: contact ? "0.5px solid rgba(232,0,42,0.35)" : "0.5px solid rgba(255,255,255,0.05)",
            transition: `background ${SPD}`,
          }}
            onMouseEnter={e => { if (!contact) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={e => { if (!contact) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
          >
            <Send size={16} style={{ flexShrink: 0, color: contact ? "#FFFFFF" : "#ADA9C8" }} />
            <Label open={open} style={{ fontSize: 13, color: contact ? "#F4F0FF" : "#ABA7C6" }}>{t.sidebar.contact}</Label>
          </button>
          {contact && open && <ContactPanel onClose={() => setContact(false)} />}
        </div>

        {/* Subscription card — only when expanded, too much text for the rail */}
        {open && (
          <div style={{
            borderRadius: 16, padding: "14px 15px", marginBottom: 12, flexShrink: 0,
            background: "linear-gradient(160deg,rgba(232,0,42,0.10) 0%,rgba(20,10,16,0.6) 100%)",
            border: "0.5px solid rgba(232,0,42,0.20)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
          }}>
            <div style={{ fontSize: 10.5, color: "#8A86A8", marginBottom: 6 }}>{t.sidebar.yourPlan}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#F4F0FF" }}>Operator</span>
              <span style={{
                fontSize: 10, fontWeight: 700, color: "#fff",
                background: "linear-gradient(135deg,#E8002A,#B4001F)",
                padding: "2px 9px", borderRadius: 6, letterSpacing: "0.04em",
              }}>PRO</span>
            </div>
            <Link href="/account" style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              height: 34, borderRadius: 9, textDecoration: "none",
              background: "rgba(255,255,255,0.06)", color: "#E4E0F4",
              fontSize: 12.5, fontWeight: 500,
              transition: `background ${SPD}`,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.10)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            >
              {t.sidebar.upgrade}
            </Link>
          </div>
        )}

        {/* User profile */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => open && setMenuOpen(v => !v)} style={{
            display: "flex", alignItems: "center", width: "100%",
            gap: 10, padding: "8px 10px", borderRadius: 12, border: "none", cursor: "pointer",
            overflow: "hidden",
            background: menuOpen ? "rgba(255,255,255,0.06)" : "transparent",
            transition: `background ${SPD}`,
          }}
            onMouseEnter={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
            onMouseLeave={e => { if (!menuOpen) (e.currentTarget as HTMLElement).style.background = "transparent" }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg,#3A3A5C,#222238)",
              border: "0.5px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 13, fontWeight: 700, color: "#D6D2F0",
            }}>
              {avatarLetter}
            </div>
            <Label open={open} style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#E8E4F8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {account?.name ?? "…"}
              </div>
              <div style={{ fontSize: 10.5, color: "#5C5A78", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {account?.email ?? ""}
              </div>
            </Label>
            {open && (
              <ChevronDown size={14} style={{
                flexShrink: 0, color: "#6A6890",
                transform: menuOpen ? "rotate(180deg)" : "rotate(0deg)",
                transition: `transform ${SPD}`,
              }} />
            )}
          </button>

          {menuOpen && open && (
            <div style={{
              position: "absolute", bottom: "calc(100% + 8px)", left: 0, right: 0,
              borderRadius: 12, overflow: "hidden", zIndex: 300,
              background: "linear-gradient(160deg,#111124 0%,#0C0C1C 100%)",
              border: "1px solid rgba(232,0,42,0.24)",
              boxShadow: "0 20px 56px rgba(0,0,0,0.8)",
              padding: 6,
            }}>
              <Link href="/account" onClick={() => setMenuOpen(false)} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px",
                borderRadius: 8, textDecoration: "none", color: "#D6D2F0", fontSize: 12.5,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                <User size={14} style={{ color: "#8A86A8" }} /> {t.sidebar.account}
              </Link>
              <button onClick={handleSignOut} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", width: "100%",
                borderRadius: 8, border: "none", background: "none", cursor: "pointer",
                color: "#FF8A8A", fontSize: 12.5,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.10)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
              >
                <LogOut size={14} /> {t.sidebar.signOut}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}