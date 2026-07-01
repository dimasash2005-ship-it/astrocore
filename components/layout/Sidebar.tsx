"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  Home, Bot, MessageSquare, BookOpen,
  Image as ImageIcon, Brain, Settings, Key,
  ArrowLeft, HelpCircle, Send, Mail, X, Puzzle,
} from "lucide-react"

export const SIDEBAR_W = 84
const EXP_W = 260
const SPEED = "260ms cubic-bezier(0.4,0,0.2,1)"

const NAV_MAIN = [
  { href: "/",             icon: Home,          label: "Головна"      },
  { href: "/agents",       icon: Bot,           label: "Агенти"       },
  { href: "/chat",         icon: MessageSquare, label: "Чат"          },
]
const NAV_VAULT = [
  { href: "/vault",        icon: BookOpen,      label: "Сховище"      },
  { href: "/gallery",      icon: ImageIcon,     label: "Галерея"      },
  { href: "/memory",       icon: Brain,         label: "Пам'ять"      },
]
const NAV_SYS = [
  { href: "/providers",    icon: Key,           label: "Провайдери"   },
  { href: "/integrations", icon: Puzzle,        label: "Інтеграції"   },
  { href: "/settings",     icon: Settings,      label: "Налаштування" },
]

/* ── Support popup ─────────────────────────────────────────────── */
function SupportPanel({ onClose }: { onClose: () => void }) {
  return (
    <div style={{
      position: "fixed",
      bottom: 56,
      left: EXP_W + 12,
      zIndex: 300,
      width: 228,
      borderRadius: 14,
      overflow: "hidden",
      background: "#0F0F1E",
      border: "1px solid rgba(232,0,42,0.35)",
      boxShadow: "0 24px 64px rgba(0,0,0,0.8), 0 0 48px rgba(232,0,42,0.08)",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 14px 9px",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        background: "rgba(232,0,42,0.06)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            width: 6, height: 6, borderRadius: "50%",
            background: "#E8002A",
            boxShadow: "0 0 8px rgba(232,0,42,1)",
            flexShrink: 0, display: "block",
          }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: "#E0DCF8" }}>
            Потрібна допомога?
          </span>
        </div>
        <button onClick={onClose} style={{
          background: "none", border: "none", cursor: "pointer",
          padding: 3, borderRadius: 5, color: "#555570", lineHeight: 0,
        }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ padding: 8 }}>
        {[
          {
            href: "https://t.me/astrocore_support",
            Icon: Send, iconColor: "#0088CC",
            iconBg: "rgba(0,136,204,0.14)", iconBd: "rgba(0,136,204,0.28)",
            title: "Telegram", sub: "Швидка відповідь",
          },
          {
            href: "mailto:support@astrocore.ai",
            Icon: Mail, iconColor: "#E8002A",
            iconBg: "rgba(232,0,42,0.12)", iconBd: "rgba(232,0,42,0.28)",
            title: "Email", sub: "support@astrocore.ai",
          },
        ].map(({ href, Icon, iconColor, iconBg, iconBd, title, sub }) => (
          <a
            key={href}
            href={href}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel="noopener noreferrer"
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 10px", borderRadius: 9, textDecoration: "none" }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent" }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 8, flexShrink: 0,
              background: iconBg, border: `1px solid ${iconBd}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={14} style={{ color: iconColor }} />
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#E0DCF8" }}>{title}</div>
              <div style={{ fontSize: 11, color: "#50506A" }}>{sub}</div>
            </div>
          </a>
        ))}
      </div>
    </div>
  )
}

/* ── Label (fades/slides in when expanded) ─────────────────────── */
function Label({ text, open }: { text: string; open: boolean }) {
  return (
    <span style={{
      fontSize: 13, fontWeight: 400, letterSpacing: "-0.01em",
      color: "#C8C5DC",
      whiteSpace: "nowrap",
      overflow: "hidden",
      opacity: open ? 1 : 0,
      transform: open ? "translateX(0)" : "translateX(-10px)",
      transition: `opacity ${SPEED} 40ms, transform ${SPEED} 40ms`,
      pointerEvents: "none",
    }}>
      {text}
    </span>
  )
}

/* ── Nav link item ─────────────────────────────────────────────── */
function NavItem({
  href, icon: Icon, label, active, open,
}: {
  href: string; icon: React.ElementType
  label: string; active: boolean; open: boolean
}) {
  const [hov, setHov] = useState(false)

  return (
    <Link
      href={href}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: "relative",
        display: "flex", alignItems: "center",
        gap: 12,
        height: 48,
        borderRadius: 12,
        padding: "0 13px",
        textDecoration: "none",
        overflow: "hidden",
        flexShrink: 0,
        /* active → red tinted; hover → slight lift; else → dim border */
        background: active
          ? "linear-gradient(100deg,rgba(232,0,42,0.22) 0%,rgba(232,0,42,0.06) 100%)"
          : hov
          ? "rgba(255,255,255,0.07)"
          : "rgba(255,255,255,0.025)",
        border: active
          ? "1px solid rgba(232,0,42,0.40)"
          : hov
          ? "1px solid rgba(255,255,255,0.12)"
          : "1px solid rgba(255,255,255,0.06)",
        boxShadow: active ? "0 0 18px rgba(232,0,42,0.18)" : "none",
        transition: `background ${SPEED}, border-color ${SPEED}, box-shadow ${SPEED}`,
      }}
    >
      {/* red left bar on active */}
      {active && (
        <span style={{
          position: "absolute", left: 0, top: "50%", transform: "translateY(-50%)",
          width: 3, height: 20, borderRadius: "0 3px 3px 0",
          background: "#E8002A",
          boxShadow: "0 0 10px rgba(232,0,42,1), 0 0 22px rgba(232,0,42,0.5)",
        }} />
      )}

      <Icon
        size={22}
        style={{
          flexShrink: 0,
          color: active ? "#FFFFFF" : hov ? "#E0DCF8" : "#B8B5C8",
          filter: active ? "drop-shadow(0 0 6px rgba(232,0,42,0.9))" : "none",
          transition: `color ${SPEED}`,
        }}
      />

      <Label text={label} open={open} />
    </Link>
  )
}

/* ── Section separator ─────────────────────────────────────────── */
function Sep({ open, label }: { open: boolean; label?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 13px", flexShrink: 0 }}>
      <div style={{ height: 1, width: 12, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />
      {label && (
        <span style={{
          fontSize: 9.5, fontWeight: 700, letterSpacing: "0.12em",
          textTransform: "uppercase", color: "#38385C",
          whiteSpace: "nowrap", overflow: "hidden",
          opacity: open ? 1 : 0,
          transform: open ? "translateX(0)" : "translateX(-8px)",
          transition: `opacity ${SPEED}, transform ${SPEED}`,
        }}>
          {label}
        </span>
      )}
      <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg,rgba(255,255,255,0.08),transparent)" }} />
    </div>
  )
}

/* ── Main sidebar ──────────────────────────────────────────────── */
export function Sidebar() {
  const pathname = usePathname()
  const router   = useRouter()
  const [open,    setOpen]    = useState(false)
  const [support, setSupport] = useState(false)
  const [logoErr, setLogoErr] = useState(false)

  const ref   = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const onEnter = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    setOpen(true)
  }, [])

  const onLeave = useCallback(() => {
    timer.current = setTimeout(() => {
      setOpen(false)
      setSupport(false)
    }, 90)
  }, [])

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setSupport(false)
    }
    document.addEventListener("mousedown", fn)
    return () => document.removeEventListener("mousedown", fn)
  }, [])

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href)

  return (
    <div
      ref={ref}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        position: "fixed", top: 0, left: 0,
        height: "100vh", zIndex: 50,
        width: open ? EXP_W : SIDEBAR_W,
        transition: `width ${SPEED}`,
        display: "flex", flexDirection: "column",
        overflow: "visible",
        /* strong visible background so sidebar doesn't disappear */
        background: "linear-gradient(180deg,#0E0E1C 0%,#0B0B17 60%,#09091440 100%)",
        borderRight: "1px solid rgba(255,255,255,0.10)",
        /* subtle glow on the right edge when expanded */
        boxShadow: open
          ? "4px 0 32px rgba(0,0,0,0.6)"
          : "2px 0 16px rgba(0,0,0,0.4)",
      }}
    >
      {/* top ambient red glow */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 220,
        pointerEvents: "none",
        background: "radial-gradient(ellipse 140% 90% at 50% 0%,rgba(232,0,42,0.12) 0%,transparent 100%)",
      }} />

      {/* primary vertical red signal line — right edge */}
      <div aria-hidden style={{
        position: "absolute", top: 48, right: 0,
        width: 2, height: 120,
        pointerEvents: "none",
        background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.7),transparent)",
        borderRadius: 1,
      }} />

      {/* secondary shorter line */}
      <div aria-hidden style={{
        position: "absolute", top: 260, right: 0,
        width: 1, height: 72,
        pointerEvents: "none",
        background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.28),transparent)",
      }} />

      {/* bottom fade */}
      <div aria-hidden style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: 64,
        pointerEvents: "none", zIndex: 1,
        background: "linear-gradient(0deg,rgba(9,9,20,0.97),transparent)",
      }} />

      {/* ── inner column ── */}
      <div style={{
        position: "relative", zIndex: 2,
        display: "flex", flexDirection: "column",
        height: "100%",
        padding: "16px 10px 14px",
        overflow: "hidden",
        gap: 2,
      }}>

        {/* Logo */}
        <div style={{
          display: "flex", alignItems: "center",
          height: 52, flexShrink: 0,
          padding: "0 3px", marginBottom: 8,
          overflow: "hidden",
        }}>
          {/* mark: always visible */}
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            flexShrink: 0,
            background: "linear-gradient(145deg,#C4001C 0%,#720012 100%)",
            boxShadow: "0 0 0 1.5px rgba(232,0,42,0.40), 0 0 20px rgba(232,0,42,0.28), inset 0 1px 0 rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {!logoErr ? (
              <Image
                src="/astrocore-logo.png"
                alt="AstroCore"
                width={22} height={22}
                style={{ objectFit: "contain" }}
                onError={() => setLogoErr(true)}
              />
            ) : (
              <span style={{ color: "#fff", fontWeight: 800, fontSize: 17, letterSpacing: "-0.05em" }}>
                A
              </span>
            )}
          </div>

          {/* wordmark */}
          <div style={{
            marginLeft: 11, overflow: "hidden",
            opacity: open ? 1 : 0,
            transform: open ? "translateX(0)" : "translateX(-12px)",
            transition: `opacity ${SPEED} 30ms, transform ${SPEED} 30ms`,
            pointerEvents: open ? "auto" : "none",
            whiteSpace: "nowrap",
          }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#ECE8FF", letterSpacing: "-0.03em", lineHeight: 1.1 }}>
              Astro<span style={{ color: "#E8002A" }}>Core</span>
            </div>
            <div style={{ fontSize: 9.5, color: "#35355A", fontWeight: 600, letterSpacing: "0.10em", textTransform: "uppercase", marginTop: 2 }}>
              AI Workspace
            </div>
          </div>
        </div>

        {/* Back button — hidden on / */}
        {pathname !== "/" && (
          <button
            onClick={() => router.back()}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              height: 44, borderRadius: 11, padding: "0 13px",
              border: "1px solid rgba(255,255,255,0.07)",
              background: "rgba(255,255,255,0.03)",
              cursor: "pointer", marginBottom: 4, flexShrink: 0, overflow: "hidden",
              transition: `background ${SPEED}, border-color ${SPEED}`,
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)"
              ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)"
              ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"
            }}
          >
            <ArrowLeft size={20} style={{ flexShrink: 0, color: "#9090B0" }} />
            <Label text="Назад" open={open} />
          </button>
        )}

        <Sep open={open} />

        {/* Primary nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {NAV_MAIN.map(item => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} open={open} />
          ))}
        </nav>

        <Sep open={open} label="Бібліотека" />

        {/* Vault nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
          {NAV_VAULT.map(item => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} open={open} />
          ))}
        </nav>

        <div style={{ flex: 1, minHeight: 8 }} />

        <Sep open={open} label="Система" />

        {/* System nav */}
        <nav style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, marginBottom: 6 }}>
          {NAV_SYS.map(item => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} open={open} />
          ))}
        </nav>

        {/* Support button */}
        <div style={{ position: "relative", flexShrink: 0 }}>
          <button
            onClick={() => setSupport(v => !v)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              height: 48, width: "100%", borderRadius: 12,
              padding: "0 13px", border: "none", cursor: "pointer",
              overflow: "hidden",
              background: support
                ? "linear-gradient(100deg,rgba(232,0,42,0.20) 0%,rgba(232,0,42,0.06) 100%)"
                : "rgba(255,255,255,0.025)",
              border: support
                ? "1px solid rgba(232,0,42,0.38)"
                : "1px solid rgba(255,255,255,0.07)",
              transition: `background ${SPEED}, border-color ${SPEED}`,
            }}
            onMouseEnter={e => {
              if (!support) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)"
                ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.12)"
              }
            }}
            onMouseLeave={e => {
              if (!support) {
                (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"
                ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.07)"
              }
            }}
          >
            <HelpCircle
              size={22}
              style={{
                flexShrink: 0,
                color: support ? "#FFFFFF" : "#B8B5C8",
                filter: support ? "drop-shadow(0 0 6px rgba(232,0,42,0.9))" : "none",
                transition: `color ${SPEED}`,
              }}
            />
            <span style={{
              fontSize: 13, fontWeight: support ? 500 : 400,
              color: support ? "#FFFFFF" : "#C8C5DC",
              whiteSpace: "nowrap", overflow: "hidden",
              opacity: open ? 1 : 0,
              transform: open ? "translateX(0)" : "translateX(-10px)",
              transition: `opacity ${SPEED} 40ms, transform ${SPEED} 40ms`,
              pointerEvents: "none",
            }}>
              Підтримка
            </span>
          </button>

          {support && <SupportPanel onClose={() => setSupport(false)} />}
        </div>

      </div>
    </div>
  )
}