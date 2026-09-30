"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  User, Shield, LogOut, Mail,
  Edit3, Check, Eye, EyeOff,
  AlertCircle, Camera, Loader2, Copy, Clock, CalendarDays, Fingerprint, Lock,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  b1:    "rgba(255,255,255,0.10)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  t4:    "#585878",
  red:   "#E8002A",
  green: "#22C55E",
  amber: "#F59E0B",
}

type Tone = "green" | "red" | "amber"

// ─── Inline editable field ────────────────────────────────────────

function EditableField({
  icon: Icon, label, value, onSave, type = "text", editLabel, cancelLabel, saveLabel, hint,
}: {
  icon: React.ElementType
  label: string; value: string; onSave: (v: string) => Promise<boolean> | boolean | void; type?: string
  editLabel: string; cancelLabel: string; saveLabel: string; hint?: string
}) {
  const [editing, setEditing] = useState(false)
  const [val,     setVal]     = useState(value)
  const [show,    setShow]    = useState(false)
  const [busy,    setBusy]    = useState(false)

  useEffect(() => { if (!editing) setVal(value) }, [value, editing])

  async function save() {
    if (!val.trim() || busy) return
    setBusy(true)
    const ok = await onSave(val.trim())
    setBusy(false)
    if (ok !== false) { setEditing(false); if (type === "password") setVal("") }
  }

  // password strength (0..4)
  const strength = type === "password" && val
    ? [val.length >= 8, /[A-Z]/.test(val) && /[a-z]/.test(val), /\d/.test(val), /[^A-Za-z0-9]/.test(val)].filter(Boolean).length
    : 0
  const sColor = strength <= 1 ? "#FF4D6A" : strength === 2 ? T.amber : T.green

  return (
    <div className={`ac-field${editing ? " editing" : ""}`}>
      <span className="ac-fico"><Icon size={14} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="ac-flabel">{label}</div>
        {!editing ? (
          <div className="ac-fval">{type === "password" ? "••••••••••" : value || "—"}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 6 }}>
            <div style={{ position: "relative" }}>
              <input
                className="ac-input"
                value={val}
                onChange={e => setVal(e.target.value)}
                type={type === "password" ? (show ? "text" : "password") : type}
                onKeyDown={e => { if (e.key === "Enter") save(); if (e.key === "Escape") { setEditing(false); setVal(value) } }}
                autoFocus
                style={{ paddingRight: type === "password" ? 40 : 12 }}
              />
              {type === "password" && (
                <button onClick={() => setShow(v => !v)} className="ac-eye">{show ? <EyeOff size={13} /> : <Eye size={13} />}</button>
              )}
            </div>
            {type === "password" && val && (
              <div style={{ display: "flex", gap: 4 }}>
                {[0, 1, 2, 3].map(i => (
                  <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i < strength ? sColor : "rgba(255,255,255,.08)", transition: "background .2s" }} />
                ))}
              </div>
            )}
            {hint && <div style={{ fontSize: 11, color: T.t4, lineHeight: 1.5 }}>{hint}</div>}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => { setEditing(false); setVal(value) }} className="ac-btn">{cancelLabel}</button>
              <button onClick={save} disabled={busy || !val.trim()} className="ac-btn primary">
                {busy ? <Loader2 size={12} className="ac-spin" /> : <Check size={12} />} {saveLabel}
              </button>
            </div>
          </div>
        )}
      </div>
      {!editing && (
        <button onClick={() => setEditing(true)} className="ac-btn ghost"><Edit3 size={11} /> {editLabel}</button>
      )}
    </div>
  )
}

// ─── Logout confirm ───────────────────────────────────────────────

function LogoutModal({ onConfirm, onClose, t }: { onConfirm: () => void; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])
  return (
    <div className="ac-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ac-modal">
        <div style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14, display: "grid", placeItems: "center",
          background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.3)", boxShadow: "0 0 24px rgba(232,0,42,0.18)" }}>
          <LogOut size={18} style={{ color: T.red }} />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.account.logoutTitle}</div>
        <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, margin: "0 0 20px" }}>{t.account.logoutDesc}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} className="ac-btn" style={{ flex: 1, height: 38 }}>{t.common.cancel}</button>
          <button onClick={() => { onConfirm(); onClose() }} className="ac-btn danger-solid" style={{ flex: 1, height: 38 }}>
            <LogOut size={13} /> {t.account.signOut}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AccountPage() {
  const { t, language } = useLanguage()
  const uk = language === "uk"

  const [showLogout,   setShowLogout]   = useState(false)
  const [displayName,  setDisplayName]  = useState("")
  const [email,        setEmail]        = useState("")
  const [user,         setUser]         = useState<{ email: string; id: string; created_at?: string; last_sign_in_at?: string; provider?: string } | null>(null)
  const [loading,      setLoading]      = useState(true)
  const [avatarUrl,       setAvatarUrl]       = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [toast,        setToast]        = useState<{ msg: string; tone: Tone } | null>(null)
  const [idCopied,     setIdCopied]     = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const notify = useCallback((msg: string, tone: Tone = "green") => {
    setToast({ msg, tone })
    setTimeout(() => setToast(null), 3200)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const { data: { user: u } } = await getSupabase().auth.getUser()
        if (u) {
          setUser({
            email: u.email ?? "", id: u.id,
            created_at: u.created_at, last_sign_in_at: u.last_sign_in_at ?? undefined,
            provider: (u.app_metadata?.provider as string | undefined) ?? "email",
          })
          setEmail(u.email ?? "")
          setDisplayName(u.user_metadata?.full_name ?? "")
          setAvatarUrl((u.user_metadata?.avatar_url as string | undefined) ?? null)
        }
      } catch {}
      finally { setLoading(false) }
    }
    load()
  }, [])

  // Name is now stored in Supabase user_metadata (the sidebar reads it from
  // there), not only in localStorage as before.
  async function saveName(name: string) {
    const { error } = await getSupabase().auth.updateUser({ data: { full_name: name } })
    if (error) { notify(error.message, "red"); return false }
    setDisplayName(name)
    try {
      const current = JSON.parse(localStorage.getItem("astrocore_profile") ?? "{}")
      localStorage.setItem("astrocore_profile", JSON.stringify({ ...current, name, email }))
    } catch {}
    notify(t.account.savedIndicator)
    return true
  }

  // Supabase sends a confirmation link to the new address; the email only
  // changes after the user clicks it.
  async function saveEmail(next: string) {
    if (next === email) return true
    const { error } = await getSupabase().auth.updateUser({ email: next })
    if (error) { notify(error.message, "red"); return false }
    notify(uk ? `Лист з підтвердженням надіслано на ${next}` : `Confirmation sent to ${next}`, "amber")
    return true
  }

  async function handlePasswordChange(newPassword: string) {
    if (newPassword.length < 6) { notify(uk ? "Мінімум 6 символів" : "At least 6 characters", "red"); return false }
    const { error } = await getSupabase().auth.updateUser({ password: newPassword })
    if (error) { notify(error.message, "red"); return false }
    notify(uk ? "Пароль змінено" : "Password updated")
    return true
  }

  async function handleLogout() {
    try { await getSupabase().auth.signOut() } catch {}
    ;["astro:providers", "astro:agents", "astro:chats", "astro:vault", "astro:gallery", "astrocore_profile"].forEach(k => localStorage.removeItem(k))
    window.location.href = "/login"
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (!file.type.startsWith("image/")) { notify(uk ? "Файл має бути зображенням." : "File must be an image.", "red"); return }
    if (file.size > 5 * 1024 * 1024)    { notify(uk ? "Максимальний розмір — 5MB." : "Max size is 5MB.", "red"); return }

    setUploadingAvatar(true)
    try {
      const sb = getSupabase()
      const ext = file.name.split(".").pop() || "jpg"
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await sb.storage.from("avatars").upload(path, file, { upsert: true, cacheControl: "3600" })
      if (uploadError) throw uploadError
      const { data: urlData } = sb.storage.from("avatars").getPublicUrl(path)
      const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await sb.auth.updateUser({ data: { avatar_url: bustedUrl } })
      if (updateError) throw updateError
      setAvatarUrl(bustedUrl)
      notify(uk ? "Аватар оновлено" : "Avatar updated")
    } catch (err) {
      notify(err instanceof Error ? err.message : (uk ? "Не вдалося завантажити аватар." : "Failed to upload avatar."), "red")
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  function fmt(iso?: string) {
    if (!iso) return "—"
    return new Date(iso).toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short", year: "numeric" })
  }
  function fmtFull(iso?: string) {
    if (!iso) return "—"
    return new Date(iso).toLocaleString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
  }

  const initials = displayName
    ? displayName.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2)
    : email ? email[0].toUpperCase() : "?"

  const toastColor = toast?.tone === "red" ? "#FF4D6A" : toast?.tone === "amber" ? T.amber : T.green

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes acSpin { to { transform: rotate(360deg); } }
        .ac-spin { animation: acSpin 1s linear infinite; }
        @keyframes acIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes acFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes acPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes acRing { to { transform: rotate(360deg); } }
        @keyframes acPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
        @keyframes acShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }

        /* avatar with spinning red ring */
        .ac-av-wrap { position: relative; width: 92px; height: 92px; flex-shrink: 0; cursor: pointer; }
        .ac-av-ring { position: absolute; inset: -4px; border-radius: 28px; padding: 1.5px;
          background: conic-gradient(from 0deg, transparent 0 55%, rgba(232,0,42,.9) 75%, transparent 95%);
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0); -webkit-mask-composite: xor; mask-composite: exclude;
          animation: acRing 4s linear infinite; }
        .ac-av { position: absolute; inset: 0; border-radius: 24px; overflow: hidden; display: grid; place-items: center;
          font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 700; color: #fff;
          background: linear-gradient(145deg,#C2001A 0%,#760012 100%); box-shadow: 0 0 0 1px rgba(232,0,42,.35), 0 10px 40px rgba(232,0,42,.25); }
        .ac-av img { width: 100%; height: 100%; object-fit: cover; }
        .ac-av-over { position: absolute; inset: 0; display: grid; place-items: center; background: rgba(0,0,0,.55); opacity: 0; transition: opacity .15s; color: #fff; }
        .ac-av-wrap:hover .ac-av-over { opacity: 1; }
        .ac-av-cam { position: absolute; right: -4px; bottom: -4px; width: 28px; height: 28px; border-radius: 9px; display: grid; place-items: center;
          background: ${T.red}; color: #fff; border: 2px solid ${T.bg}; box-shadow: 0 4px 12px rgba(232,0,42,.4); }

        .ac-badge { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600;
          padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: .06em; }
        .ac-live { width: 6px; height: 6px; border-radius: 50%; background: ${T.green}; animation: acPulse 2s infinite; }

        .ac-grid { display: grid; grid-template-columns: minmax(0, 1fr) 360px; gap: 24px; align-items: start; }
        .ac-side { display: flex; flex-direction: column; gap: 22px; position: sticky; top: 20px; }
        @media (max-width: 1050px) { .ac-grid { grid-template-columns: 1fr; } .ac-side { position: static; } }
        .ac-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .ac-head span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }

        .ac-card { border-radius: 14px; overflow: hidden; background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1}; animation: acIn .4s ease both; }
        .ac-field { display: flex; align-items: flex-start; gap: 13px; padding: 15px 16px; border-bottom: 0.5px solid rgba(255,255,255,.06); transition: background .15s; }
        .ac-field:last-child { border-bottom: 0; }
        .ac-field:hover { background: rgba(255,255,255,.015); }
        .ac-field.editing { background: rgba(232,0,42,.035); }
        .ac-fico { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex-shrink: 0; color: ${T.t3};
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.08); }
        .ac-field.editing .ac-fico { color: ${T.red}; background: rgba(232,0,42,.1); border-color: rgba(232,0,42,.3); }
        .ac-flabel { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.t4}; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 3px; }
        .ac-fval { font-size: 14px; color: ${T.t1}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ac-input { width: 100%; padding: 10px 12px; border-radius: 10px; outline: none; font-size: 13.5px; font-family: inherit; color: ${T.t1};
          background: #07070D; border: 0.5px solid ${T.b1}; transition: border-color .15s, box-shadow .15s; }
        .ac-input:focus { border-color: rgba(232,0,42,.5); box-shadow: 0 0 0 3px rgba(232,0,42,.12); }
        .ac-eye { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: ${T.t4}; line-height: 0; }

        .ac-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; height: 32px; padding: 0 12px; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 500; font-family: inherit; flex: 1; flex-shrink: 0;
          background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t2}; transition: all .15s; }
        .ac-btn:hover:not(:disabled) { background: rgba(255,255,255,.09); color: ${T.t1}; }
        .ac-btn:disabled { opacity: .5; cursor: default; }
        .ac-btn.ghost { flex: 0 0 auto; height: 28px; font-size: 11px; }
        .ac-btn.primary { background: ${T.red}; border-color: ${T.red}; color: #fff; }
        .ac-btn.primary:hover:not(:disabled) { background: #FF1A3E; color: #fff; box-shadow: 0 0 16px rgba(232,0,42,.35); }
        .ac-btn.danger { color: #FF4D6A; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.28); }
        .ac-btn.danger:hover { background: rgba(232,0,42,.18); color: #FF6B84; }
        .ac-btn.danger-solid { background: ${T.red}; border-color: ${T.red}; color: #fff; }
        .ac-btn.danger-solid:hover { background: #FF1A3E; color: #fff; box-shadow: 0 0 18px rgba(232,0,42,.4); }

        .ac-panel { border-radius: 13px; overflow: hidden; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .ac-kv { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 11px 14px; border-bottom: 0.5px solid rgba(255,255,255,.05); }
        .ac-kv:last-child { border-bottom: 0; }
        .ac-kv > span:first-child { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: ${T.t3}; }
        .ac-kv > span:last-child { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: ${T.t2}; display: flex; align-items: center; gap: 6px; }
        .ac-copy { padding: 4px; border-radius: 6px; border: none; cursor: pointer; line-height: 0; background: rgba(255,255,255,.05); color: ${T.t4}; }
        .ac-copy:hover { color: ${T.t1}; }

        .ac-danger { border-radius: 14px; padding: 16px; position: relative; overflow: hidden;
          background: repeating-linear-gradient(135deg, rgba(232,0,42,.05) 0 1px, transparent 1px 8px), #110C12; border: 0.5px solid rgba(232,0,42,.22); }

        .ac-skel { border-radius: 14px; border: 0.5px solid ${T.b1};
          background: linear-gradient(90deg, #0F0F19 0px, #16162A 200px, #0F0F19 400px); background-size: 800px 100%; animation: acShimmer 1.4s linear infinite; }

        .ac-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: acFade .18s ease-out; }
        .ac-modal { width: 100%; max-width: 390px; border-radius: 16px; padding: 22px; background: linear-gradient(160deg,#111120 0%,#0C0C18 100%);
          border: 0.5px solid rgba(232,0,42,.3); box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 50px rgba(232,0,42,.08); animation: acPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .ac-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 200; display: flex; align-items: center; gap: 8px; max-width: 90vw;
          padding: 10px 16px; border-radius: 11px; font-size: 13px; background: #0F0F1E; border: 0.5px solid; box-shadow: 0 14px 40px rgba(0,0,0,.6); animation: acPop .24s ease-out; }
        @media (prefers-reduced-motion: reduce) { .ac-av-ring, .ac-card, .ac-modal { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero = profile ── */}
        <div style={{ position: "relative", padding: "36px 48px 30px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: -80, left: -40, width: 420, height: 300, pointerEvents: "none", background: "radial-gradient(ellipse at 30% 40%,rgba(232,0,42,0.12) 0%,transparent 65%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 22, minWidth: 0 }}>
              {loading ? (
                <div className="ac-skel" style={{ width: 92, height: 92, borderRadius: 24 }} />
              ) : (
                <div className="ac-av-wrap" onClick={() => !uploadingAvatar && fileInputRef.current?.click()} title={uk ? "Змінити фото" : "Change photo"}>
                  <div className="ac-av-ring" />
                  <div className="ac-av">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : initials}
                    <div className="ac-av-over">{uploadingAvatar ? <Loader2 size={20} className="ac-spin" /> : <Camera size={20} />}</div>
                  </div>
                  <span className="ac-av-cam"><Camera size={13} /></span>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} style={{ display: "none" }} />
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "3px 11px 3px 9px", marginBottom: 10 }}>
                  <span aria-hidden style={{ position: "relative", width: 16, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                    <span className="astrocore-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Session Active</span>
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {loading ? "…" : displayName || t.account.operatorFallback}
                </h1>
                <div style={{ fontSize: 13, color: T.t3, marginTop: 4 }}>{email || t.account.emailNotSet}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                  <span className="ac-badge" style={{ background: "rgba(34,197,94,0.09)", border: "0.5px solid rgba(34,197,94,0.25)", color: T.green }}><span className="ac-live" />{t.account.activeBadge}</span>
                  <span className="ac-badge" style={{ background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t3 }}>{t.account.operatorTag}</span>
                </div>
              </div>
            </div>

            <button onClick={() => setShowLogout(true)} className="ac-btn danger" style={{ flex: "0 0 auto", height: 38, padding: "0 16px", fontSize: 13 }}>
              <LogOut size={14} /> {t.account.signOut}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "26px 48px 60px" }}>
          {loading ? (
            <div className="ac-grid">
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div className="ac-skel" style={{ height: 150 }} /><div className="ac-skel" style={{ height: 110 }} />
              </div>
              <div className="ac-skel" style={{ height: 220 }} />
            </div>
          ) : (
            <div className="ac-grid">
              {/* Main */}
              <div style={{ display: "flex", flexDirection: "column", gap: 28, minWidth: 0 }}>
                <section>
                  <div className="ac-head"><User size={13} style={{ color: T.red }} /><span>{t.account.profileCard}</span></div>
                  <div className="ac-card">
                    <EditableField icon={User} label={t.account.nameLabel} value={displayName} onSave={saveName}
                      editLabel={t.account.edit} cancelLabel={t.common.cancel} saveLabel={t.common.save} />
                    <EditableField icon={Mail} label={t.account.emailLabel} value={email} onSave={saveEmail} type="email"
                      editLabel={t.account.edit} cancelLabel={t.common.cancel} saveLabel={t.common.save}
                      hint={uk ? "На нову адресу прийде лист — пошта зміниться після підтвердження." : "We'll send a confirmation link — the email changes after you confirm."} />
                  </div>
                </section>

                <section>
                  <div className="ac-head"><Shield size={13} style={{ color: T.red }} /><span>{t.account.securityCard}</span></div>
                  <div className="ac-card" style={{ animationDelay: "60ms" }}>
                    {user ? (
                      <EditableField icon={Lock} label={t.account.passwordLabel} value="" onSave={handlePasswordChange} type="password"
                        editLabel={t.account.edit} cancelLabel={t.common.cancel} saveLabel={t.common.save}
                        hint={uk ? "Мінімум 6 символів. Краще — 8+, з великими літерами, цифрами і символами." : "At least 6 characters. Better: 8+, with upper case, digits and symbols."} />
                    ) : (
                      <div className="ac-field">
                        <span className="ac-fico"><AlertCircle size={14} /></span>
                        <span style={{ fontSize: 12, color: T.t4, lineHeight: 1.55 }}>{t.account.supabaseNotConfigured}</span>
                      </div>
                    )}
                    <div className="ac-field" style={{ alignItems: "center" }}>
                      <span className="ac-fico" style={{ color: T.green, background: "rgba(34,197,94,.08)", borderColor: "rgba(34,197,94,.22)" }}><Shield size={14} /></span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 2 }}>{t.account.dataStorageTitle}</div>
                        <div style={{ fontSize: 11.5, color: T.t4 }}>{t.account.dataStorageDesc}</div>
                      </div>
                      <span className="ac-badge" style={{ background: "rgba(34,197,94,0.09)", border: "0.5px solid rgba(34,197,94,0.22)", color: T.green }}>{t.account.secureBadge}</span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Side */}
              <aside className="ac-side">
                {user && (
                  <section>
                    <div className="ac-head"><Fingerprint size={13} style={{ color: T.red }} /><span>{t.account.accountInfoCard}</span></div>
                    <div className="ac-panel">
                      <div className="ac-kv">
                        <span><Fingerprint size={12} style={{ color: T.t4 }} />{t.account.userId}</span>
                        <span>
                          {user.id.slice(0, 8)}…{user.id.slice(-4)}
                          <button className="ac-copy" onClick={() => { navigator.clipboard.writeText(user.id); setIdCopied(true); setTimeout(() => setIdCopied(false), 1500) }}>
                            {idCopied ? <Check size={11} style={{ color: T.green }} /> : <Copy size={11} />}
                          </button>
                        </span>
                      </div>
                      <div className="ac-kv"><span><Mail size={12} style={{ color: T.t4 }} />{t.account.providerLabel}</span><span>{user.provider === "email" ? t.account.emailPasswordProvider : user.provider}</span></div>
                      <div className="ac-kv"><span><CalendarDays size={12} style={{ color: T.t4 }} />{uk ? "З нами з" : "Member since"}</span><span>{fmt(user.created_at)}</span></div>
                      <div className="ac-kv"><span><Clock size={12} style={{ color: T.t4 }} />{uk ? "Останній вхід" : "Last sign-in"}</span><span>{fmtFull(user.last_sign_in_at)}</span></div>
                    </div>
                  </section>
                )}

                <section>
                  <div className="ac-head"><LogOut size={13} style={{ color: T.red }} /><span>{t.account.dangerZoneTitle}</span></div>
                  <div className="ac-danger">
                    <div style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.55, marginBottom: 12 }}>{t.account.dangerZoneDesc}</div>
                    <button onClick={() => setShowLogout(true)} className="ac-btn danger-solid" style={{ width: "100%", height: 36 }}>
                      <LogOut size={13} /> {t.account.signOut}
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="ac-toast" style={{ color: toastColor, borderColor: `${toastColor}59` }}>
          {toast.tone === "red" ? <AlertCircle size={14} /> : toast.tone === "amber" ? <Mail size={14} /> : <Check size={14} />} {toast.msg}
        </div>
      )}

      {showLogout && <LogoutModal onConfirm={handleLogout} onClose={() => setShowLogout(false)} t={t} />}
    </>
  )
}