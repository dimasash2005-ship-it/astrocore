"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  Home, Bot, MessageSquare, BookOpen,
  Image as ImageIcon, Brain, Settings, Key,
  ArrowLeft, Send, Mail, AtSign, X, User,
} from "lucide-react"

export const SIDEBAR_W = 64

const EXP_W = 220
const SPD = "220ms cubic-bezier(0.4,0,0.2,1)"

const NAV_MAIN = [
  { href: "/",          icon: Home,          label: "Головна"      },
  { href: "/agents",    icon: Bot,           label: "Агенти"       },
  { href: "/chat",      icon: MessageSquare, label: "Чат"          },
]
const NAV_VAULT = [
  { href: "/vault",     icon: BookOpen,      label: "Сховище"      },
  { href: "/gallery",   icon: ImageIcon,     label: "Галерея"      },
  { href: "/memory",    icon: Brain,         label: "Пам'ять"      },
]
const NAV_SYS = [
  { href: "/providers", icon: Key,           label: "Провайдери"   },
  { href: "/settings",  icon: Settings,      label: "Налаштування" },
]

function ContactPanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 56,
      left: EXP_W + 8,
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
          <div style={{ fontSize: 13, fontWeight: 600, color: "#EAE6FF" }}>Зв'язок</div>
          <div style={{ fontSize: 10.5, color: "#44446A", marginTop: 1 }}>Напишіть нам у зручному каналі</div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: 3, borderRadius: 5, color: "#484868", lineHeight: 0 }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: "8px 8px 10px" }}>
        {[
          { href: "https://t.me/astrocore_support", target: "_blank", Icon: Send,    ic: "#0088CC", ib: "rgba(0,136,204,0.14)",   ibd: "rgba(0,136,204,0.28)",   title: "Telegram",  sub: "Швидка відповідь"   },
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
        height: 40, borderRadius: 12,
        padding: "0 10px", gap: 0,
        textDecoration: "none", overflow: "hidden", flexShrink: 0,
        background: active
          ? "linear-gradient(100deg,rgba(232,0,42,0.20) 0%,rgba(232,0,42,0.05) 100%)"
          : hov ? "rgba(255,255,255,0.07)" : "rgba(255,255,255,0.03)",
        border: active
          ? "0.5px solid rgba(232,0,42,0.35)"
          : hov ? "0.5px solid rgba(255,255,255,0.11)" : "0.5px solid rgba(255,255,255,0.05)",
        transition: `background ${SPD}, border-color ${SPD}`,
      }}>
      {active && (
        <span style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 2.5, height: 16, borderRadius: "0 3px 3px 0",
          background: "#E8002A",
          boxShadow: "0 0 8px rgba(232,0,42,1), 0 0 16px rgba(232,0,42,0.5)",
        }} />
      )}
      <Icon size={17} style={{
        flexShrink: 0,
        color: active ? "#FFFFFF" : hov ? "#E0DCF8" : "#B8B4D4",
        filter: active ? "drop-shadow(0 0 4px rgba(232,0,42,0.9))" : "none",
        transition: `color ${SPD}`,
      }} />
      <span style={{
        marginLeft: 10,
        opacity: open ? 1 : 0,
        transform: open ? "translateX(0)" : "translateX(-8px)",
        transition: `opacity ${SPD} 30ms, transform ${SPD} 30ms`,
        pointerEvents: open ? "auto" : "none",
        whiteSpace: "nowrap", overflow: "hidden",
        fontSize: 13, fontWeight: active ? 500 : 400,
        color: active ? "#F4F0FF" : hov ? "#D0CCEC" : "#B0AACC",
        letterSpacing: "-0.01em",
      }}>
        {label}
      </span>
    </Link>
  )
}

function Sep({ label, open }: { label?: string; open: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 10px", flexShrink: 0, height: 26, overflow: "hidden" }}>
      <div style={{ height: "0.5px", width: 10, background: "rgba(255,255,255,0.09)", flexShrink: 0 }} />
      {label && (
        <span style={{
          fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
          color: "#36365A", whiteSpace: "nowrap", overflow: "hidden",
          opacity: open ? 1 : 0,
          transform: open ? "translateX(0)" : "translateX(-6px)",
          transition: `opacity ${SPD}, transform ${SPD}`,
        }}>{label}</span>
      )}
      <div style={{ height: "0.5px", flex: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.08),transparent)" }} />
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [open,    setOpen]    = useState(false)
  const [contact, setContact] = useState(false)
  const [logoErr, setLogoErr] = useState(false)
  const [pulse,   setPulse]   = useState(false)
  const ref   = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Red pulse animation cycle
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 1800)
    return () => clearInterval(id)
  }, [])

  const onEnter = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }, [])

  const onLeave = useCallback(() => {
    timer.current = setTimeout(() => { setOpen(false); setContact(false) }, 90)
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setContact(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <div ref={ref} onMouseEnter={onEnter} onMouseLeave={onLeave} style={{
      position: "fixed", top: 0, left: 0,
      height: "100vh", zIndex: 50,
      width: open ? EXP_W : SIDEBAR_W,
      transition: `width ${SPD}`,
      display: "flex", flexDirection: "column",
      overflow: "visible",
      background: "linear-gradient(180deg,#0D0D1A 0%,#090914 55%,#070710 100%)",
      borderRight: "0.5px solid rgba(255,255,255,0.08)",
      boxShadow: open ? "6px 0 32px rgba(0,0,0,0.55)" : "2px 0 12px rgba(0,0,0,0.35)",
    }}>

      {/* top glow */}
      <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 200, pointerEvents: "none", background: "radial-gradient(ellipse 140% 90% at 50% 0%,rgba(232,0,42,0.11) 0%,transparent 100%)" }} />

      {/* bottom glow */}
      <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 130, pointerEvents: "none", background: "radial-gradient(ellipse 140% 90% at 50% 100%,rgba(232,0,42,0.08) 0%,transparent 100%)" }} />

      {/* right signal line */}
      <div aria-hidden style={{ position: "absolute", top: 50, right: 0, width: 1.5, height: 100, pointerEvents: "none", background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.65),transparent)", borderRadius: 1 }} />
      <div aria-hidden style={{ position: "absolute", top: 260, right: 0, width: 1, height: 80, pointerEvents: "none", background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.25),transparent)" }} />

      {/* animated red pulse dot — vertical center-left */}
      <div aria-hidden style={{
        position: "absolute",
        top: "50%", left: 6,
        width: 3, height: 3,
        borderRadius: "50%",
        background: "#E8002A",
        transform: "translateY(-50%)",
        transition: "opacity 900ms ease, box-shadow 900ms ease",
        opacity: pulse ? 1 : 0.2,
        boxShadow: pulse ? "0 0 8px rgba(232,0,42,1), 0 0 16px rgba(232,0,42,0.5)" : "none",
        pointerEvents: "none",
      }} />

      {/* bottom vignette */}
      <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 56, pointerEvents: "none", zIndex: 1, background: "linear-gradient(0deg,rgba(7,7,16,0.97),transparent)" }} />

      {/* inner column */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column",
        height: "100%",
        padding: "14px 8px 12px",
        overflow: "hidden", gap: 1,
      }}>

        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", height: 48, flexShrink: 0, padding: "0 1px", marginBottom: 8, overflow: "hidden" }}>
          {/* mark with pulse ring */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: "linear-gradient(145deg,#C0001A 0%,#720010 100%)",
              boxShadow: "0 0 0 1.5px rgba(232,0,42,0.40), 0 0 20px rgba(232,0,42,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {!logoErr ? (
                <Image src="/astrocore-logo.png" alt="AstroCore" width={20} height={20}
                  style={{ objectFit: "contain" }} onError={() => setLogoErr(true)} />
              ) : (
                <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.05em" }}>A</span>
              )}
            </div>
            {/* animated ring */}
            <div style={{
              position: "absolute", inset: -3, borderRadius: 15,
              border: "1px solid rgba(232,0,42,0.5)",
              transition: "opacity 900ms ease",
              opacity: pulse ? 0.8 : 0.2,
              pointerEvents: "none",
            }} />
          </div>

          {/* wordmark */}
          <div style={{
            marginLeft: 10, overflow: "hidden", flexShrink: 0,
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-10px)",
            transition: `opacity ${SPD} 20ms, transform ${SPD} 20ms`,
            pointerEvents: open ? "auto" : "none", whiteSpace: "nowrap",
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#EEE8FF", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Astro<span style={{ color: "#E8002A" }}>Core</span>
            </div>
            <div style={{ fontSize: 9, color: "#32325A", fontWeight: 600, letterSpacing: "0.09em", textTransform: "uppercase", marginTop: 1.5 }}>AI Workspace</div>
          </div>
        </div>

        {/* Back */}
        {pathname !== "/" && (
          <button onClick={() => router.back()} style={{
            display: "flex", alignItems: "center", height: 38, width: "100%",
            borderRadius: 11, padding: "0 10px",
            border: "0.5px solid rgba(255,255,255,0.07)",
            background: "rgba(255,255,255,0.03)", cursor: "pointer",
            marginBottom: 3, flexShrink: 0, overflow: "hidden", gap: 0,
            transition: `background ${SPD}`,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
          >
            <ArrowLeft size={17} style={{ flexShrink: 0, color: "#9494B8" }} />
            <span style={{ marginLeft: 10, fontSize: 12.5, color: "#9494B8", opacity: open ? 1 : 0, transform: open ? "translateX(0)" : "translateX(-8px)", transition: `opacity ${SPD} 25ms, transform ${SPD} 25ms`, pointerEvents: open ? "auto" : "none", whiteSpace: "nowrap", overflow: "hidden" }}>Назад</span>
          </button>
        )}

        <Sep open={open} />

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          {NAV_MAIN.map(item => <NavLink key={item.href} {...item} active={isActive(item.href)} open={open} />)}
        </nav>

        <Sep label="Бібліотека" open={open} />

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          {NAV_VAULT.map(item => <NavLink key={item.href} {...item} active={isActive(item.href)} open={open} />)}
        </nav>

        <div style={{ flex: 1, minHeight: 4 }} />

        <Sep label="Система" open={open} />

        <nav style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0 }}>
          {NAV_SYS.map(item => <NavLink key={item.href} {...item} active={isActive(item.href)} open={open} />)}
        </nav>

        {/* divider before account/contact */}
        <div style={{ height: "0.5px", background: "rgba(255,255,255,0.07)", margin: "6px 2px 5px", flexShrink: 0 }} />

        {/* Account button */}
        <Link href="/account" style={{
          display: "flex", alignItems: "center",
          height: 40, borderRadius: 12,
          padding: "0 10px", gap: 0,
          textDecoration: "none", overflow: "hidden", flexShrink: 0,
          background: pathname.startsWith("/account")
            ? "linear-gradient(100deg,rgba(232,0,42,0.20) 0%,rgba(232,0,42,0.05) 100%)"
            : "rgba(255,255,255,0.03)",
          border: pathname.startsWith("/account")
            ? "0.5px solid rgba(232,0,42,0.35)"
            : "0.5px solid rgba(255,255,255,0.05)",
          transition: `background ${SPD}`,
          marginBottom: 3,
        }}
          onMouseEnter={e => { if (!pathname.startsWith("/account")) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)" }}
          onMouseLeave={e => { if (!pathname.startsWith("/account")) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
        >
          {/* mini avatar */}
          <div style={{
            width: 24, height: 24, borderRadius: 8, flexShrink: 0,
            background: "linear-gradient(135deg,#3A3A5C,#222238)",
            border: "0.5px solid rgba(255,255,255,0.15)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <User size={13} style={{ color: "#B0AACC" }} />
          </div>
          <span style={{
            marginLeft: 10, fontSize: 13, fontWeight: 400,
            color: "#C0BCDC",
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-8px)",
            transition: `opacity ${SPD} 30ms, transform ${SPD} 30ms`,
            pointerEvents: open ? "auto" : "none",
            whiteSpace: "nowrap", overflow: "hidden",
          }}>
            Акаунт
          </span>
        </Link>

        {/* Contact button */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button onClick={() => setContact(v => !v)} style={{
            display: "flex", alignItems: "center", height: 40, width: "100%",
            borderRadius: 12, padding: "0 10px", border: "none", cursor: "pointer",
            overflow: "hidden", gap: 0,
            background: contact
              ? "linear-gradient(100deg,rgba(232,0,42,0.20) 0%,rgba(232,0,42,0.05) 100%)"
              : "rgba(255,255,255,0.03)",
            outline: contact ? "0.5px solid rgba(232,0,42,0.35)" : "0.5px solid rgba(255,255,255,0.05)",
            transition: `background ${SPD}`,
          }}
            onMouseEnter={e => { if (!contact) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)" }}
            onMouseLeave={e => { if (!contact) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
          >
            <Send size={17} style={{
              flexShrink: 0,
              color: contact ? "#FFFFFF" : "#B8B4D4",
              filter: contact ? "drop-shadow(0 0 5px rgba(232,0,42,0.9))" : "none",
              transition: `color ${SPD}`,
            }} />
            <span style={{
              marginLeft: 10, fontSize: 13, fontWeight: contact ? 500 : 400,
              color: contact ? "#F4F0FF" : "#B0AACC",
              opacity: open ? 1 : 0,
              transform: open ? "translateX(0)" : "translateX(-8px)",
              transition: `opacity ${SPD} 30ms, transform ${SPD} 30ms`,
              pointerEvents: "none", whiteSpace: "nowrap", overflow: "hidden",
            }}>
              Зв'язок
            </span>
          </button>
          {contact && <ContactPanel onClose={() => setContact(false)} />}
        </div>

      </div>
    </div>
  )
}