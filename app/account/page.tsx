"use client"

import React, { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  User, Shield, LogOut, Key, Mail,
  Edit3, Check, X, Eye, EyeOff,
  Activity, ChevronRight, AlertCircle,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  b1:    "rgba(255,255,255,0.10)",
  b2:    "rgba(255,255,255,0.16)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  t4:    "#585878",
  red:   "#E8002A",
  green: "#22C55E",
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: T.t1, outline: "none", width: "100%",
}

// ─── Section card ─────────────────────────────────────────────────

function Card({ title, icon: Icon, children, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: boolean
}) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.20)" : T.b1}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "13px 18px 11px",
        borderBottom: `0.5px solid ${T.b1}`,
        background: accent ? "rgba(232,0,42,0.04)" : "transparent",
      }}>
        <Icon size={13} style={{ color: accent ? T.red : T.t4, opacity: 0.9 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
          {title}
        </span>
      </div>
      <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontSize: 12, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: T.t2, fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
}

// ─── Inline editable field ────────────────────────────────────────

function EditableField({
  label, value, onSave, type = "text", editLabel, cancelLabel, saveLabel,
}: {
  label: string; value: string; onSave: (v: string) => void; type?: string
  editLabel: string; cancelLabel: string; saveLabel: string
}) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(value)
  const [show,    setShow]    = useState(false)

  function save() {
    if (val.trim()) { onSave(val.trim()); setEditing(false) }
  }

  if (!editing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600, marginBottom: 3 }}>{label}</div>
          <div style={{ fontSize: 13, color: T.t2 }}>
            {type === "password" ? "••••••••••" : value || "—"}
          </div>
        </div>
        <button onClick={() => setEditing(true)} style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
          background: "rgba(255,255,255,0.05)", color: T.t3, fontSize: 11,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}
        >
          <Edit3 size={11} /> {editLabel}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <label style={{ fontSize: 10.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 600 }}>{label}</label>
      <div style={{ position: "relative" }}>
        <input
          value={val}
          onChange={e => setVal(e.target.value)}
          type={type === "password" ? (show ? "text" : "password") : type}
          onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") setEditing(false) }}
          autoFocus
          style={{ ...inp, paddingRight: type === "password" ? 40 : 12 }}
          onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
          onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
        />
        {type === "password" && (
          <button onClick={() => setShow(v => !v)} style={{
            position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
            background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0,
          }}>
            {show ? <EyeOff size={13} /> : <Eye size={13} />}
          </button>
        )}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setEditing(false); setVal(value) }} style={{
          flex: 1, padding: "7px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t3,
        }}>{cancelLabel}</button>
        <button onClick={save} style={{
          flex: 1, padding: "7px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
          background: T.red, border: "none", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
        >
          <Check size={12} /> {saveLabel}
        </button>
      </div>
    </div>
  )
}

// ─── Logout confirm ───────────────────────────────────────────────

function LogoutModal({ onConfirm, onClose, t }: { onConfirm: () => void; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div style={{
        width: "100%", maxWidth: 380, borderRadius: 14,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.25)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
        padding: "22px 22px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
          <LogOut size={17} style={{ color: T.red, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.account.logoutTitle}</span>
        </div>
        <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, marginBottom: 18 }}>
          {t.account.logoutDesc}
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>{t.common.cancel}</button>
          <button onClick={() => { onConfirm(); onClose() }} style={{
            flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: "pointer",
            background: "rgba(232,0,42,0.14)", border: "0.5px solid rgba(232,0,42,0.28)",
            color: "#FF4D6A", display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.24)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.14)" }}
          >
            <LogOut size={13} /> {t.account.signOut}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AccountPage() {
  const router = useRouter()
  const { t, language } = useLanguage()

  const [pulse,        setPulse]        = useState(false)
  const [showLogout,   setShowLogout]   = useState(false)
  const [displayName,  setDisplayName]  = useState("")
  const [email,        setEmail]        = useState("")
  const [savedName,    setSavedName]    = useState(false)
  const [user,         setUser]         = useState<{ email: string; id: string } | null>(null)
  const [loading,      setLoading]      = useState(true)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  // Load user from Supabase
  useEffect(() => {
    async function load() {
      try {
        const sb = getSupabase()
        const { data: { user: u } } = await sb.auth.getUser()
        if (u) {
          setUser({ email: u.email ?? "", id: u.id })
          setEmail(u.email ?? "")
          setDisplayName(u.user_metadata?.full_name ?? "")
        }
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  function saveName(name: string) {
    setDisplayName(name)
    const current = JSON.parse(localStorage.getItem("astrocore_profile") ?? "{}")
    localStorage.setItem("astrocore_profile", JSON.stringify({ ...current, name, email }))
    setSavedName(true)
    setTimeout(() => setSavedName(false), 2000)
  }

  function saveEmail(e: string) {
    setEmail(e)
    const current = JSON.parse(localStorage.getItem("astrocore_profile") ?? "{}")
    localStorage.setItem("astrocore_profile", JSON.stringify({ ...current, name: displayName, email: e }))
  }

  async function handleLogout() {
    try {
      const sb = getSupabase()
      await sb.auth.signOut()
    } catch {}

    const keys = [
      "astro:providers", "astro:agents", "astro:chats",
      "astro:vault", "astro:gallery", "astrocore_profile",
    ]
    keys.forEach(k => localStorage.removeItem(k))

    window.location.href = "/login"
  }

  async function handlePasswordChange(newPassword: string) {
    try {
      const sb = getSupabase()
      await sb.auth.updateUser({ password: newPassword })
    } catch {}
  }

  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : email
    ? email[0].toUpperCase()
    : "?"

  const dateLocale = language === "uk" ? "uk-UA" : "en-US"
  const joinedDate = user
    ? new Date().toLocaleDateString(dateLocale, { day: "numeric", month: "long", year: "numeric" })
    : null

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>

        {/* scan line */}
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* ── Hero ── */}
        <div style={{
          position: "relative", padding: "36px 48px 28px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.red,
                  display: "inline-block",
                  opacity: pulse ? 1 : 0.3,
                  transition: "opacity 900ms ease, box-shadow 900ms ease",
                  boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Account Active · Operator Profile
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
                {t.account.title}
              </h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                Security Layer · Account Control · Operator Profile
              </p>
            </div>

            <button onClick={() => setShowLogout(true)} style={{
              display: "flex", alignItems: "center", gap: 7,
              background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)",
              color: "#FF4D6A", borderRadius: 9, padding: "9px 16px",
              fontSize: 13, fontWeight: 500, cursor: "pointer",
              transition: "background 130ms ease",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.16)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)" }}
            >
              <LogOut size={14} /> {t.account.signOut}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "24px 48px 56px", maxWidth: 780 }}>

          {/* Loading */}
          {loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  height: 100, borderRadius: 14, background: T.s1,
                  border: `0.5px solid ${T.b1}`,
                  animation: "pulse 2s ease infinite",
                }} />
              ))}
            </div>
          )}

          {!loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* ── Profile card ── */}
              <div style={{
                background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                border: `0.5px solid ${T.b1}`,
                borderRadius: 14, padding: "20px 20px",
                display: "flex", alignItems: "center", gap: 18,
                position: "relative", overflow: "hidden",
              }}>
                {/* ambient glow */}
                <div aria-hidden style={{
                  position: "absolute", top: 0, left: 0, width: 200, height: 120, pointerEvents: "none",
                  background: "radial-gradient(ellipse at 0% 0%,rgba(232,0,42,0.07) 0%,transparent 70%)",
                }} />

                {/* Avatar */}
                <div style={{
                  width: 64, height: 64, borderRadius: 18, flexShrink: 0,
                  background: "linear-gradient(145deg,#C2001A 0%,#760012 100%)",
                  boxShadow: "0 0 0 2px rgba(232,0,42,0.30), 0 0 24px rgba(232,0,42,0.20)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, color: "#fff",
                }}>
                  {initials}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 4 }}>
                    {displayName || t.account.operatorFallback}
                  </div>
                  <div style={{ fontSize: 13, color: T.t3, marginBottom: 8 }}>
                    {email || t.account.emailNotSet}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 5,
                      background: "rgba(34,197,94,0.09)", border: "0.5px solid rgba(34,197,94,0.24)",
                      color: T.green, fontWeight: 500,
                    }}>
                      {t.account.activeBadge}
                    </span>
                    <span style={{
                      fontSize: 10, padding: "2px 8px", borderRadius: 5,
                      background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
                      color: T.t4,
                    }}>
                      {t.account.operatorTag}
                    </span>
                    {user && (
                      <span style={{
                        fontSize: 10, padding: "2px 8px", borderRadius: 5,
                        background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`,
                        color: T.t4, display: "flex", alignItems: "center", gap: 4,
                      }}>
                        <Activity size={8} /> {t.account.supabaseAuthTag}
                      </span>
                    )}
                  </div>
                </div>

                {savedName && (
                  <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 10px", borderRadius: 7,
                    background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.24)",
                    color: T.green, fontSize: 12,
                  }}>
                    <Check size={12} /> {t.account.savedIndicator}
                  </div>
                )}
              </div>

              {/* ── Profile info ── */}
              <Card title={t.account.profileCard} icon={User}>
                <EditableField
                  label={t.account.nameLabel}
                  value={displayName}
                  onSave={saveName}
                  editLabel={t.account.edit}
                  cancelLabel={t.common.cancel}
                  saveLabel={t.common.save}
                />
                <Divider />
                <EditableField
                  label={t.account.emailLabel}
                  value={email}
                  onSave={saveEmail}
                  type="email"
                  editLabel={t.account.edit}
                  cancelLabel={t.common.cancel}
                  saveLabel={t.common.save}
                />
              </Card>

              {/* ── Account info (Supabase) ── */}
              {user && (
                <Card title={t.account.accountInfoCard} icon={Mail}>
                  <Row label={t.account.userId}  value={user.id.slice(0, 16) + "..."} mono />
                  <Divider />
                  <Row label={t.account.emailLabel}    value={user.email} />
                  <Divider />
                  <Row label={t.account.providerLabel} value={t.account.emailPasswordProvider} />
                </Card>
              )}

              {/* ── Security ── */}
              <Card title={t.account.securityCard} icon={Shield}>
                {user ? (
                  <EditableField
                    label={t.account.passwordLabel}
                    value=""
                    onSave={handlePasswordChange}
                    type="password"
                    editLabel={t.account.edit}
                    cancelLabel={t.common.cancel}
                    saveLabel={t.common.save}
                  />
                ) : (
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 9,
                    padding: "10px 12px", borderRadius: 9,
                    background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
                  }}>
                    <AlertCircle size={13} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 12, color: T.t4, lineHeight: 1.55 }}>
                      {t.account.supabaseNotConfigured}
                    </span>
                  </div>
                )}
                <Divider />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 2 }}>{t.account.dataStorageTitle}</div>
                    <div style={{ fontSize: 11.5, color: T.t4 }}>{t.account.dataStorageDesc}</div>
                  </div>
                  <span style={{
                    fontSize: 11, padding: "2px 9px", borderRadius: 5,
                    background: "rgba(34,197,94,0.09)", border: "0.5px solid rgba(34,197,94,0.22)",
                    color: T.green,
                  }}>
                    {t.account.secureBadge}
                  </span>
                </div>
              </Card>

              {/* ── Quick navigation ── */}
              <Card title={t.account.quickAccessCard} icon={Key}>
                {[
                  { label: t.sidebar.providers,  desc: t.account.quickProvidersDesc,  href: "/providers", icon: Key      },
                  { label: t.sidebar.agents,      desc: t.account.quickAgentsDesc,     href: "/agents",   icon: User     },
                  { label: t.sidebar.settings,    desc: t.account.quickSettingsDesc,   href: "/settings", icon: Shield   },
                ].map(({ label, desc, href, icon: Icon }, i) => (
                  <React.Fragment key={href}>
                    {i > 0 && <Divider />}
                    <div key={href} onClick={() => router.push(href)} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "4px 0", cursor: "pointer", borderRadius: 8,
                      transition: "opacity 130ms ease",
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.7" }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
                    >
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={14} style={{ color: T.t3 }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{label}</div>
                        <div style={{ fontSize: 11.5, color: T.t4, marginTop: 1 }}>{desc}</div>
                      </div>
                      <ChevronRight size={14} style={{ color: T.t4, flexShrink: 0 }} />
                    </div>
                  </React.Fragment>
                ))}
              </Card>

              {/* ── Logout danger zone ── */}
              <div style={{
                background: "rgba(232,0,42,0.04)",
                border: "0.5px solid rgba(232,0,42,0.18)",
                borderRadius: 14, padding: "16px 18px",
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
              }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 3 }}>{t.account.dangerZoneTitle}</div>
                  <div style={{ fontSize: 12, color: T.t4 }}>{t.account.dangerZoneDesc}</div>
                </div>
                <button onClick={() => setShowLogout(true)} style={{
                  display: "flex", alignItems: "center", gap: 7, flexShrink: 0,
                  background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.28)",
                  color: "#FF4D6A", borderRadius: 9, padding: "8px 16px",
                  fontSize: 13, fontWeight: 500, cursor: "pointer",
                  transition: "background 130ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.20)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.10)" }}
                >
                  <LogOut size={14} /> {t.account.signOut}
                </button>
              </div>

            </div>
          )}
        </div>
      </div>

      {showLogout && (
        <LogoutModal
          onConfirm={handleLogout}
          onClose={() => setShowLogout(false)}
          t={t}
        />
      )}
    </>
  )
}