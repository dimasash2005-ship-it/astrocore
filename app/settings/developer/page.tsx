"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Key, Shield, Zap, Brain, Bot,
  BookOpen, Puzzle,
  Copy, Check, Plus, Trash2, Clock,
  AlertCircle, Activity, Lock, X, Loader2, ArrowLeft,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  b1:   "rgba(255,255,255,0.10)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
  green:"#22C55E",
  amber:"#F59E0B",
}

type Permission = { id: string; icon: React.ElementType; label: string }

const PERMISSIONS: Permission[] = [
  { id: "chat",         icon: Zap,      label: "Chat"         },
  { id: "vault",        icon: BookOpen, label: "Vault"        },
  { id: "memory",       icon: Brain,    label: "Memory"       },
  { id: "agents",       icon: Bot,      label: "Agents"       },
  { id: "integrations", icon: Puzzle,   label: "Integrations" },
]

type ApiKeyRecord = {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

function formatDate(iso: string | null, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return t.developer.neverLabel
  try {
    const locale = lang === "uk" ? "uk-UA" : "en-US"
    return new Date(iso).toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" })
  } catch {
    return iso
  }
}

function maskedFromPrefix(prefix: string): string {
  return `${prefix}••••••••••••••••`
}

function PermBadge({ id }: { id: string }) {
  const p = PERMISSIONS.find(x => x.id === id)
  if (!p) return null
  const Icon = p.icon
  return <span className="dv-chip"><Icon size={9} />{p.label}</span>
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button className={`dv-copy${ok ? " ok" : ""}`} onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1800) })
    }}>
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Toast({ msg, tone = "amber", onHide }: { msg: string; tone?: "amber" | "red" | "green"; onHide: () => void }) {
  useEffect(() => { const id = setTimeout(onHide, 3000); return () => clearTimeout(id) }, [onHide])
  const color = tone === "red" ? "#FF4D6A" : tone === "green" ? T.green : T.amber
  return (
    <div className="dv-toast" style={{ color, borderColor: `${color}59` }}>
      {tone === "green" ? <Check size={14} /> : <AlertCircle size={14} />} {msg}
    </div>
  )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])
  return (
    <div className="dv-overlay" onClick={onClose}>
      <div className="dv-modal" onClick={e => e.stopPropagation()}>{children}</div>
    </div>
  )
}

function ModalHead({ icon: Icon, title, onClose, tone = "red" }: { icon: React.ElementType; title: string; onClose: () => void; tone?: "red" | "green" }) {
  const c = tone === "green" ? T.green : T.red
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "18px 20px 0" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: `${c}1A`, border: `0.5px solid ${c}4D`, boxShadow: `0 0 18px ${c}26` }}>
        <Icon size={16} style={{ color: c }} />
      </div>
      <span style={{ flex: 1, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5, fontWeight: 600, color: T.t1 }}>{title}</span>
      <button onClick={onClose} className="dv-x"><X size={15} /></button>
    </div>
  )
}

function GenerateKeyModal({
  onClose, onCreated, t, uk,
}: { onClose: () => void; onCreated: (fullKey: string, record: ApiKeyRecord) => void; t: ReturnType<typeof useLanguage>["t"]; uk: boolean }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [err, setErr]   = useState("")

  async function submit() {
    if (!name.trim()) { setErr(t.developer.modalNewKeyNameError); return }
    setBusy(true); setErr("")
    try {
      const res = await fetch("/api/developer/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t.developer.modalCreateError)
      const created = data.key as { id: string; name: string; key: string; key_prefix: string; permissions: string[]; created_at: string }
      onCreated(created.key, {
        id: created.id, name: created.name, key_prefix: created.key_prefix, permissions: created.permissions,
        last_used_at: null, revoked_at: null, created_at: created.created_at,
      })
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.developer.serverError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <ModalHead icon={Key} title={t.developer.modalNewKeyTitle} onClose={onClose} />
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="dv-label">{t.developer.modalNewKeyLabel}</label>
        <input autoFocus value={name} className="dv-input"
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder={t.developer.modalNewKeyPlaceholder} />
        {err && <div style={{ fontSize: 12, color: "#FF4D6A" }}>{err}</div>}
        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
          <button onClick={onClose} className="dv-btn" style={{ flex: 1, justifyContent: "center", height: 38 }}>{uk ? "Скасувати" : "Cancel"}</button>
          <button onClick={submit} disabled={busy} className="dv-primary" style={{ flex: 3, justifyContent: "center" }}>
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {busy ? t.developer.modalCreating : t.developer.modalCreateBtn}
          </button>
        </div>
      </div>
    </ModalShell>
  )
}

function RevealKeyModal({ fullKey, onClose, t }: { fullKey: string; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <ModalShell onClose={onClose}>
      <ModalHead icon={Check} tone="green" title={t.developer.modalKeyCreatedTitle} onClose={onClose} />
      <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 10, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
          <Lock size={13} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: T.t3, lineHeight: 1.55 }}>
            {t.developer.modalRevealWarningPrefix}<strong style={{ color: T.t1 }}>{t.developer.modalRevealWarningStrong}</strong>{t.developer.modalRevealWarningSuffix}
          </div>
        </div>
        <div className="dv-keybox big">
          <code>{fullKey}</code>
          <CopyBtn text={fullKey} />
        </div>
        <button onClick={onClose} className="dv-primary" style={{ justifyContent: "center" }}>{t.developer.modalDoneBtn}</button>
      </div>
    </ModalShell>
  )
}

export default function DeveloperPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const uk = language === "uk"
  const [toast, setToast] = useState<{ msg: string; tone?: "amber" | "red" | "green" } | null>(null)
  const [keys, setKeys] = useState<ApiKeyRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showGenerate, setShowGenerate] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/developer/api-keys")
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t.developer.loadKeysError)
      setKeys((data.keys ?? []).filter((k: ApiKeyRecord) => !k.revoked_at))
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : t.developer.loadKeysErrorGeneric, tone: "red" })
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => { loadKeys() }, [loadKeys])

  const hideToast = useCallback(() => setToast(null), [])

  function handleCreated(fullKey: string, record: ApiKeyRecord) {
    setKeys(prev => [record, ...prev])
    setShowGenerate(false)
    setRevealKey(fullKey)
  }

  async function handleRevoke(id: string) {
    if (!window.confirm(t.developer.revokeConfirm)) return
    try {
      const res = await fetch(`/api/developer/api-keys/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || t.developer.revokeError)
      setKeys(prev => prev.filter(k => k.id !== id))
      setToast({ msg: t.developer.revokeSuccessToast, tone: "green" })
    } catch (e) {
      setToast({ msg: e instanceof Error ? e.message : t.developer.serverError, tone: "red" })
    }
  }

  const lastUsed = keys.map(k => k.last_used_at).filter(Boolean).sort().pop() ?? null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .animate-spin { animation: spin 0.8s linear infinite; }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes dvIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes dvFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dvPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes dvPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
        @keyframes dvShimmer { 0% { background-position: -300px 0; } 100% { background-position: 300px 0; } }

        .dv-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
        .dv-side { display: flex; flex-direction: column; gap: 22px; position: sticky; top: 20px; }
        @media (max-width: 1100px) { .dv-grid { grid-template-columns: 1fr; } .dv-side { position: static; } }

        .dv-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .dv-head > span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }
        .dv-count { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; padding: 2px 7px; border-radius: 5px;
          color: ${T.t3}; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.09); }

        .dv-primary { display: inline-flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 16px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
        .dv-primary:hover:not(:disabled) { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .dv-primary:disabled { opacity: .6; cursor: default; }
        .dv-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 500; font-family: inherit; flex-shrink: 0;
          background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t2}; transition: all .15s; }
        .dv-btn:hover { background: rgba(255,255,255,.09); color: ${T.t1}; }
        .dv-btn-danger:hover { background: rgba(232,0,42,.14); border-color: rgba(232,0,42,.4); color: #FF4D6A; }

        /* key cards */
        .dv-keys { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
        .dv-key { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 15px 16px 14px; border-radius: 14px; overflow: hidden;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: dvIn .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s; }
        .dv-key::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px;
          background: linear-gradient(180deg, transparent, ${T.green}, transparent); opacity: .6; }
        .dv-key:hover { transform: translateY(-2px); border-color: rgba(34,197,94,.3); box-shadow: 0 14px 34px rgba(0,0,0,.45); }
        .dv-key .dv-revoke { opacity: 0; transition: opacity .15s; }
        .dv-key:hover .dv-revoke, .dv-key:focus-within .dv-revoke { opacity: 1; }
        .dv-live { width: 7px; height: 7px; border-radius: 50%; background: ${T.green}; animation: dvPulse 2s infinite; flex-shrink: 0; }
        .dv-meta { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; display: flex; align-items: center; gap: 4px; }

        .dv-keybox { display: flex; align-items: center; gap: 6px; padding: 7px 8px 7px 11px; border-radius: 9px;
          background: #07070D; border: 0.5px solid rgba(125,211,252,.14); }
        .dv-keybox code { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: ${T.t3}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dv-keybox.big { padding: 11px 10px 11px 13px; border-color: rgba(125,211,252,.3); box-shadow: 0 0 20px rgba(125,211,252,.06); }
        .dv-keybox.big code { color: #7DD3FC; white-space: normal; word-break: break-all; font-size: 12.5px; }
        .dv-copy { padding: 5px; border-radius: 6px; border: none; cursor: pointer; line-height: 0; background: rgba(255,255,255,.05); color: ${T.t4}; transition: all .12s; }
        .dv-copy:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .dv-copy.ok { color: ${T.green}; }

        .dv-chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          padding: 2px 7px; border-radius: 5px; text-transform: uppercase; letter-spacing: .06em;
          color: ${T.t3}; background: rgba(255,255,255,.04); border: 0.5px solid ${T.b1}; }

        .dv-skel { height: 150px; border-radius: 14px; border: 0.5px solid ${T.b1};
          background: linear-gradient(90deg, #0F0F19 0px, #16162A 150px, #0F0F19 300px); background-size: 600px 100%; animation: dvShimmer 1.4s linear infinite; }

        .dv-empty { display: flex; flex-direction: column; align-items: center; text-align: center; padding: 46px 20px; border-radius: 14px;
          border: 1px dashed rgba(232,0,42,.28); background: rgba(232,0,42,.025); }

        /* side */
        .dv-panel { border-radius: 13px; overflow: hidden; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .dv-kv { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: 0.5px solid rgba(255,255,255,.05); }
        .dv-kv:last-child { border-bottom: 0; }
        .dv-kv > span:first-child { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: ${T.t3}; }
        .dv-kv b { font-family: 'JetBrains Mono', monospace; font-size: 12px; font-weight: 600; color: ${T.t1}; }
        .dv-perm { display: flex; align-items: center; gap: 10px; padding: 9px 14px; border-bottom: 0.5px solid rgba(255,255,255,.05); font-size: 12.5px; color: ${T.t2}; }
        .dv-perm:last-child { border-bottom: 0; }
        .dv-perm i { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0;
          background: rgba(232,0,42,.09); border: 0.5px solid rgba(232,0,42,.22); color: ${T.red}; }

        /* modal */
        .dv-overlay { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: dvFade .18s ease-out; }
        .dv-modal { width: 100%; max-width: 460px; border-radius: 16px; overflow: hidden;
          background: linear-gradient(160deg,#13131F 0%,#0E0E18 100%); border: 0.5px solid rgba(232,0,42,.25);
          box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 50px rgba(232,0,42,.07); animation: dvPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .dv-x { background: rgba(255,255,255,.04); border: none; cursor: pointer; color: ${T.t4}; line-height: 0; padding: 6px; border-radius: 8px; }
        .dv-x:hover { color: ${T.t1}; background: rgba(255,255,255,.08); }
        .dv-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.t4}; text-transform: uppercase; letter-spacing: .07em; }
        .dv-input { padding: 11px 13px; border-radius: 10px; outline: none; font-size: 13.5px; font-family: inherit; color: ${T.t1};
          background: #07070D; border: 0.5px solid ${T.b1}; transition: border-color .15s, box-shadow .15s; }
        .dv-input:focus { border-color: rgba(232,0,42,.5); box-shadow: 0 0 0 3px rgba(232,0,42,.12); }

        .dv-toast { position: fixed; bottom: 26px; left: 50%; transform: translateX(-50%); z-index: 400; display: flex; align-items: center; gap: 9px;
          padding: 10px 16px; border-radius: 11px; font-size: 13px; background: #0F0F1E; border: 0.5px solid;
          box-shadow: 0 14px 40px rgba(0,0,0,.6); animation: dvPop .24s ease-out; }
        @media (prefers-reduced-motion: reduce) { .dv-key, .dv-modal, .dv-skel { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "30px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <button onClick={() => router.push("/settings")} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16, fontSize: 12, color: T.t4, background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <ArrowLeft size={13} /> {t.sidebar.settings}
            </button>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px 4px 10px" }}>
                    <span aria-hidden style={{ position: "relative", width: 18, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                      <span className="astrocore-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
                    </span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Developer Center</span>
                  </div>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, padding: "2px 8px", borderRadius: 5, fontWeight: 700, background: "rgba(245,158,11,0.12)", color: T.amber, border: "0.5px solid rgba(245,158,11,0.28)" }}>BETA</span>
                </div>
                <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>API Keys</h1>
                <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.developer.subtitle}</p>
              </div>
              <button onClick={() => setShowGenerate(true)} className="dv-primary"><Plus size={14} /> Generate API Key</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "26px 48px 60px" }}>
          <div className="dv-grid">

            {/* Main: keys */}
            <section style={{ minWidth: 0 }}>
              <div className="dv-head">
                <Key size={13} style={{ color: T.red }} />
                <span>{t.developer.sectionApiKeys}</span>
                {!loading && <span className="dv-count">{keys.length}</span>}
              </div>

              {loading ? (
                <div className="dv-keys"><div className="dv-skel" /><div className="dv-skel" /></div>
              ) : keys.length === 0 ? (
                <div className="dv-empty">
                  <div style={{ width: 56, height: 56, borderRadius: 16, marginBottom: 16, display: "grid", placeItems: "center", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", boxShadow: "0 0 28px rgba(232,0,42,0.1)" }}>
                    <Key size={24} style={{ color: T.red, opacity: 0.8 }} />
                  </div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: T.t1 }}>{t.developer.noKeysYet}</div>
                  <div style={{ fontSize: 12.5, color: T.t4, marginTop: 6, marginBottom: 20, maxWidth: 360, lineHeight: 1.6 }}>{t.developer.noKeysHint}</div>
                  <button onClick={() => setShowGenerate(true)} className="dv-primary"><Plus size={14} /> Generate API Key</button>
                </div>
              ) : (
                <div className="dv-keys">
                  {keys.map((k, i) => (
                    <div key={k.id} className="dv-key" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                        <div style={{ width: 34, height: 34, borderRadius: 10, flexShrink: 0, display: "grid", placeItems: "center", background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.24)" }}>
                          <Key size={15} style={{ color: T.green }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{k.name}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                            <span className="dv-live" />
                            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 600, color: T.green, textTransform: "uppercase", letterSpacing: ".06em" }}>{t.developer.activeLabel}</span>
                          </div>
                        </div>
                        <button onClick={() => handleRevoke(k.id)} className="dv-btn dv-btn-danger dv-revoke">
                          <Trash2 size={12} /> {t.developer.revokeBtn}
                        </button>
                      </div>

                      <div className="dv-keybox">
                        <code>{maskedFromPrefix(k.key_prefix)}</code>
                        <CopyBtn text={k.key_prefix} />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
                        <span className="dv-meta"><Clock size={10} /> {t.developer.createdPrefix}{formatDate(k.created_at, t, language)}</span>
                        <span className="dv-meta"><Activity size={10} /> {t.developer.lastUsedLabel}{formatDate(k.last_used_at, t, language)}</span>
                      </div>

                      {k.permissions.length > 0 && (
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {k.permissions.map(p => <PermBadge key={p} id={p} />)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Side */}
            <aside className="dv-side">
              <section>
                <div className="dv-head"><Activity size={13} style={{ color: T.red }} /><span>{t.developer.sectionUsage}</span></div>
                <div className="dv-panel">
                  {[
                    { label: t.developer.usageRequestsToday, value: "—",  icon: Activity },
                    { label: t.developer.usageRequestsMonth, value: "—",  icon: Zap },
                    { label: t.developer.usageLastRequest,   value: lastUsed ? formatDate(lastUsed, t, language) : t.developer.neverLabel, icon: Clock },
                    { label: t.developer.usageCurrentPlan,   value: "Beta", icon: Shield },
                  ].map(r => {
                    const Icon = r.icon
                    return (
                      <div key={r.label} className="dv-kv">
                        <span><Icon size={12} style={{ color: T.t4 }} />{r.label}</span>
                        <b>{r.value}</b>
                      </div>
                    )
                  })}
                </div>
              </section>

              <section>
                <div className="dv-head"><Shield size={13} style={{ color: T.red }} /><span>{t.developer.sectionPermissions}</span></div>
                <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.55, marginBottom: 10 }}>{t.developer.permissionsDesc}</div>
                <div className="dv-panel">
                  {PERMISSIONS.map(({ id, icon: Icon, label }) => (
                    <div key={id} className="dv-perm">
                      <i><Icon size={12} /></i>
                      <span style={{ flex: 1 }}>{label}</span>
                      <Check size={12} style={{ color: T.green, opacity: 0.8 }} />
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="dv-head"><Lock size={13} style={{ color: T.red }} /><span>{t.developer.sectionSecurity}</span></div>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 11, padding: "13px 15px", borderRadius: 13,
                  background: "repeating-linear-gradient(135deg, rgba(232,0,42,.05) 0 1px, transparent 1px 8px), #110C12",
                  border: "0.5px solid rgba(232,0,42,0.22)" }}>
                  <Lock size={14} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
                  <div style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.65 }}>
                    <strong style={{ color: T.t1 }}>{t.developer.securityBold}</strong>
                    {t.developer.securityRest}
                  </div>
                </div>
                <div style={{ fontSize: 11, color: T.t4, marginTop: 8 }}>
                  {uk ? "Ключ показується лише один раз — одразу після створення." : "A key is shown only once — right after it's created."}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {showGenerate && <GenerateKeyModal onClose={() => setShowGenerate(false)} onCreated={handleCreated} t={t} uk={uk} />}
      {revealKey && <RevealKeyModal fullKey={revealKey} onClose={() => setRevealKey(null)} t={t} />}
      {toast && <Toast msg={toast.msg} tone={toast.tone} onHide={hideToast} />}
    </>
  )
}