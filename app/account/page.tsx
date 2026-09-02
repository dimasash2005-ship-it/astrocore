"use client"

import React, { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  User, Shield, LogOut, Key, Mail,
  Edit3, Check, X, Eye, EyeOff,
  Activity, ChevronRight, AlertCircle,
  Camera, Loader2,
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
// `variant="system"` switches to the same grid-textured, mono-caps
// treatment used for Dashboard's system panels (Providers, Activity) —
// reserved here for Account Info, since that card shows genuine raw
// backend data (user id, auth provider). Everything else (Profile,
// Security, Quick Access) is content/settings, not a data readout, so
// it keeps a normal-case Space Grotesk title instead of the tracked
// uppercase eyebrow the whole page used to have on every single card.

function Card({ title, icon: Icon, children, accent, variant = "content" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; accent?: boolean
  variant?: "content" | "system"
}) {
  const isSystem = variant === "system"
  return (
    <div style={{
      position: "relative",
      background: isSystem ? "#0A0A10" : "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      backgroundImage: isSystem
        ? "linear-gradient(rgba(255,255,255,0.045) 0.5px, transparent 0.5px), linear-gradient(90deg, rgba(255,255,255,0.045) 0.5px, transparent 0.5px)"
        : undefined,
      backgroundSize: isSystem ? "14px 14px" : undefined,
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.20)" : T.b1}`,
      borderRadius: isSystem ? 10 : 14,
      overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: isSystem ? "11px 16px 10px" : "13px 18px 11px",
        borderBottom: `0.5px solid ${T.b1}`,
        background: accent ? "rgba(232,0,42,0.04)" : isSystem ? "rgba(10,10,16,0.55)" : "transparent",
      }}>
        <Icon size={isSystem ? 12 : 13} style={{ color: accent ? T.red : T.t4, opacity: 0.9 }} />
        <span style={{
          fontFamily: isSystem ? "'JetBrains Mono', monospace" : "'Space Grotesk', sans-serif",
          fontSize: isSystem ? 10 : 13,
          fontWeight: 600,
          color: isSystem ? T.t4 : T.t2,
          textTransform: isSystem ? "uppercase" : "none",
          letterSpacing: isSystem ? "0.07em" : "-0.005em",
        }}>
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
      <span style={{ fontSize: 13, color: T.t2, fontFamily: mono ? "'JetBrains Mono', monospace" : "inherit" }}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", margin: "2px 0" }} />
}

// Thin impulse-line divider between major blocks — same motif as
// Sidebar's rail and Dashboard's stat-card frame, so the whole app
// reads as one consistent visual language rather than each page
// inventing its own way to separate sections.
function SectionDivider({ delay = "0s" }: { delay?: string }) {
  return (
    <div aria-hidden style={{
      position: "relative", height: 1.5,
      background: "rgba(255,255,255,0.06)", overflow: "hidden", borderRadius: 1,
    }}>
      <div className="astrocore-hero-sweep" style={{
        position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
        background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
        boxShadow: "0 0 8px rgba(232,0,42,0.75)",
        animationDelay: delay,
      }} />
    </div>
  )
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

  const [showLogout,   setShowLogout]   = useState(false)
  const [displayName,  setDisplayName]  = useState("")
  const [email,        setEmail]        = useState("")
  const [savedName,    setSavedName]    = useState(false)
  const [user,         setUser]         = useState<{ email: string; id: string } | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError,     setAvatarError]     = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

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
          setAvatarUrl((u.user_metadata?.avatar_url as string | undefined) ?? null)
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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    if (!file.type.startsWith("image/")) {
      setAvatarError(language === "uk" ? "Файл має бути зображенням." : "File must be an image.")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setAvatarError(language === "uk" ? "Максимальний розмір — 5MB." : "Max size is 5MB.")
      return
    }

    setAvatarError("")
    setUploadingAvatar(true)
    try {
      const sb = getSupabase()
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await sb.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" })
      if (uploadError) throw uploadError

      const { data: urlData } = sb.storage.from("avatars").getPublicUrl(path)
      // Cache-bust so the new image shows immediately instead of a
      // browser-cached copy of whatever used to be at that path.
      const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`

      const { error: updateError } = await sb.auth.updateUser({ data: { avatar_url: bustedUrl } })
      if (updateError) throw updateError

      setAvatarUrl(bustedUrl)
    } catch (err) {
      setAvatarError(err instanceof Error ? err.message : (language === "uk" ? "Не вдалося завантажити аватар." : "Failed to upload avatar."))
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : email
    ? email[0].toUpperCase()
    : "?"

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        /* fixes a skeleton loader that previously referenced this
           keyframe by name without it existing anywhere — it was
           silently doing nothing while "loading" */
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50%      { opacity: 1; }
        }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep {
          0%   { left: -20%; }
          100% { left: 100%; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }

        /* two columns on wide screens, one column once it gets tight */
        .astrocore-account-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 340px;
          gap: 20px;
          align-items: start;
        }
        @media (max-width: 880px) {
          .astrocore-account-grid { grid-template-columns: 1fr; }
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
          <div aria-hidden style={{
            position: "absolute", bottom: -1, left: 0, right: 0, height: 1.5,
            background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none",
          }}>
            <div className="astrocore-hero-sweep" style={{
              position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
              background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
              boxShadow: "0 0 8px rgba(232,0,42,0.75)",
            }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              {/* Session badge — impulse line instead of a JS-timer
                  blinking dot, same motif as Sidebar/Dashboard. Text
                  simplified to one fact instead of a dot-joined list. */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "4px 12px 4px 10px", marginBottom: 14,
              }}>
                <span aria-hidden style={{
                  position: "relative", width: 18, height: 1.5, borderRadius: 1,
                  background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block",
                }}>
                  <span className="astrocore-badge-sweep" style={{
                    position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%",
                    background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
                  }} />
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>
                  Session Active
                </span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
                {t.account.title}
              </h1>
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

        {/* ── Body — now a wide, responsive two-column layout instead
            of a single 780px column stranded on the left. Main column:
            profile identity + settings. Side column: navigation +
            danger zone, narrower and fixed-width like a utility rail. ── */}
        <div style={{ padding: "24px 48px 56px", maxWidth: 1360, margin: "0 auto" }}>

          {/* Loading */}
          {loading && (
            <div className="astrocore-account-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {[1, 2, 3].map(i => (
                  <div key={i} style={{
                    height: 100, borderRadius: 14, background: T.s1,
                    border: `0.5px solid ${T.b1}`,
                    animation: "pulse 2s ease infinite",
                  }} />
                ))}
              </div>
              <div style={{
                height: 220, borderRadius: 14, background: T.s1,
                border: `0.5px solid ${T.b1}`,
                animation: "pulse 2s ease infinite",
              }} />
            </div>
          )}

          {!loading && (
            <div className="astrocore-account-grid">

              {/* ── Main column ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* ── Profile card ── */}
                <div style={{
                  background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                  border: `0.5px solid ${T.b1}`,
                  borderRadius: 14, padding: "20px 20px",
                  display: "flex", alignItems: "center", gap: 18,
                  position: "relative", overflow: "hidden", flexWrap: "wrap",
                }}>
                  {/* ambient glow */}
                  <div aria-hidden style={{
                    position: "absolute", top: 0, left: 0, width: 200, height: 120, pointerEvents: "none",
                    background: "radial-gradient(ellipse at 0% 0%,rgba(232,0,42,0.07) 0%,transparent 70%)",
                  }} />

                  {/* Avatar — click to upload. Shows the real photo
                      once one exists, falls back to initials. */}
                  <div
                    onClick={() => !uploadingAvatar && fileInputRef.current?.click()}
                    onMouseEnter={e => {
                      const overlay = e.currentTarget.querySelector(".astrocore-avatar-overlay") as HTMLElement | null
                      if (overlay) overlay.style.opacity = "1"
                    }}
                    onMouseLeave={e => {
                      const overlay = e.currentTarget.querySelector(".astrocore-avatar-overlay") as HTMLElement | null
                      if (overlay) overlay.style.opacity = "0"
                    }}
                    style={{
                      position: "relative",
                      width: 64, height: 64, borderRadius: 18, flexShrink: 0,
                      background: avatarUrl ? "#000" : "linear-gradient(145deg,#C2001A 0%,#760012 100%)",
                      boxShadow: "0 0 0 2px rgba(232,0,42,0.30), 0 0 24px rgba(232,0,42,0.20)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 22, fontWeight: 700, color: "#fff",
                      cursor: "pointer", overflow: "hidden",
                    }}
                  >
                    {avatarUrl ? (
                      // Externally hosted (Supabase Storage), uploaded
                      // at runtime — a plain <img> avoids having to add
                      // the storage domain to next.config's image
                      // allowlist just for this.
                      <img src={avatarUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      initials
                    )}

                    <div className="astrocore-avatar-overlay" style={{
                      position: "absolute", inset: 0,
                      background: "rgba(0,0,0,0.55)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      opacity: 0, transition: "opacity 140ms ease",
                    }}>
                      {uploadingAvatar ? (
                        <Loader2 size={18} style={{ color: "#fff", animation: "spin 1s linear infinite" }} />
                      ) : (
                        <Camera size={18} style={{ color: "#fff" }} />
                      )}
                    </div>

                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarChange}
                      style={{ display: "none" }}
                    />
                  </div>

                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 4 }}>
                      {displayName || t.account.operatorFallback}
                    </div>
                    <div style={{ fontSize: 13, color: T.t3, marginBottom: 8 }}>
                      {email || t.account.emailNotSet}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

                {avatarError && (
                  <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
                    {avatarError}
                  </div>
                )}

                {/* ── Profile info + Account info side by side once
                    there's room, since the main column is wide enough
                    now to hold two cards abreast instead of always
                    stacking everything vertically. ── */}
                <SectionDivider delay="0.2s" />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="astrocore-account-subgrid">
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

                  {user && (
                    <Card title={t.account.accountInfoCard} icon={Mail} variant="system">
                      <Row label={t.account.userId}  value={user.id.slice(0, 16) + "..."} mono />
                      <Divider />
                      <Row label={t.account.emailLabel}    value={user.email} />
                      <Divider />
                      <Row label={t.account.providerLabel} value={t.account.emailPasswordProvider} />
                    </Card>
                  )}
                </div>

                <SectionDivider delay="1.4s" />

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
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
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
              </div>

              {/* ── Side column: navigation + danger zone ── */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

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

                <SectionDivider delay="0.8s" />

                {/* ── Logout danger zone ── */}
                <div style={{
                  background: "rgba(232,0,42,0.04)",
                  border: "0.5px solid rgba(232,0,42,0.18)",
                  borderRadius: 14, padding: "16px 18px",
                  display: "flex", flexDirection: "column", gap: 12,
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 3 }}>{t.account.dangerZoneTitle}</div>
                    <div style={{ fontSize: 12, color: T.t4 }}>{t.account.dangerZoneDesc}</div>
                  </div>
                  <button onClick={() => setShowLogout(true)} style={{
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                    background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.28)",
                    color: "#FF4D6A", borderRadius: 9, padding: "9px 16px",
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

            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 700px) {
          .astrocore-account-subgrid { grid-template-columns: 1fr !important; }
        }
      `}</style>

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