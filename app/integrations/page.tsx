"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  HelpCircle, Plus, Copy, Check, RefreshCw, Settings,
  CheckCircle2, Loader2, Unlink, X, Lock,
  Code2, Globe, Search, Zap, Workflow, Puzzle,
  Clock, KeyRound, Shield, CalendarDays, ArrowUpRight, Link2,
} from "lucide-react"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  s2:   "#16162A",
  b1:   "rgba(255,255,255,0.10)",
  b2:   "rgba(255,255,255,0.16)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
  green:"#22C55E",
}

const OBSIDIAN_KEY_NAME = "Obsidian Plugin"

type IntegrationDef = {
  id: string
  name: string
  emoji?: string
  icon?: React.ElementType
  color: string
  category: "notes" | "dev" | "productivity" | "automation"
  soon: boolean
}

const INTEGRATIONS: IntegrationDef[] = [
  { id: "obsidian", name: "Obsidian",          emoji: "🔮",              color: "#8B5CF6", category: "notes",         soon: false },
  { id: "vscode",   name: "VS Code",           icon: Code2,              color: "#007ACC", category: "dev",           soon: true  },
  { id: "browser",  name: "Browser Extension", icon: Globe,              color: "#F59E0B", category: "productivity",  soon: true  },
  { id: "raycast",  name: "Raycast",           icon: Search,             color: "#FF6363", category: "productivity",  soon: true  },
  { id: "zapier",   name: "Zapier",            icon: Zap,                color: "#FF4A00", category: "automation",    soon: true  },
  { id: "n8n",      name: "n8n",               icon: Workflow,           color: "#EA4B71", category: "automation",    soon: true  },
  { id: "make",     name: "Make",              icon: Puzzle,             color: "#6D00CC", category: "automation",    soon: true  },
]

type ApiKeyRecord = {
  id: string
  name: string
  revoked_at: string | null
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  created_at: string
}

function formatDate(iso: string | null, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return t.integrations.neverUsed
  try {
    const locale = lang === "uk" ? "uk-UA" : "en-US"
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button className={`ig-copy${copied ? " ok" : ""}`} onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1800) })
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

// ── One-time reveal modal after (re)generating a key ──
function RevealKeyModal({ fullKey, onClose, t }: { fullKey: string; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])
  return (
    <div className="ig-overlay" onClick={onClose}>
      <div className="ig-modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "18px 20px 0" }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "rgba(34,197,94,.1)", border: "0.5px solid rgba(34,197,94,.3)", boxShadow: "0 0 18px rgba(34,197,94,.15)" }}>
            <Check size={16} style={{ color: T.green }} />
          </div>
          <span style={{ flex: 1, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15.5, fontWeight: 600, color: T.t1 }}>{t.integrations.newKeyGenerated}</span>
          <button onClick={onClose} className="ig-x"><X size={15} /></button>
        </div>
        <div style={{ padding: "18px 20px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "11px 14px", borderRadius: 10, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.25)" }}>
            <Lock size={13} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.55 }}>
              {t.integrations.revealKeyWarningPrefix}<strong style={{ color: T.t1 }}>{t.integrations.revealKeyWarningStrong}</strong>{t.integrations.revealKeyWarningSuffix}
            </div>
          </div>
          <div className="ig-code big">
            <code>{fullKey}</code>
            <CopyBtn text={fullKey} />
          </div>
          <button onClick={onClose} className="ig-primary" style={{ justifyContent: "center" }}>{t.integrations.done}</button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { t, language } = useLanguage()
  const uk = language === "uk"
  const [origin, setOrigin] = useState("")
  const [showInstall, setShowInstall] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const [connLoading, setConnLoading] = useState(true)
  const [obsidianKey, setObsidianKey] = useState<ApiKeyRecord | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)

  useEffect(() => { setOrigin(window.location.origin) }, [])

  const endpoint = origin ? `${origin}/api/integrations/obsidian/chat` : "/api/integrations/obsidian/chat"

  const INSTALL_STEPS = [t.integrations.installStep1, t.integrations.installStep2, t.integrations.installStep3, t.integrations.installStep4]
  const CAPABILITIES = [t.integrations.cap1, t.integrations.cap2, t.integrations.cap3, t.integrations.cap4, t.integrations.cap5]

  const categoryLabels: Record<string, string> = {
    notes: t.integrations.catNotes,
    dev: t.integrations.catDev,
    productivity: t.integrations.catProductivity,
    automation: t.integrations.catAutomation,
  }
  const descriptions: Record<string, string> = {
    obsidian: t.integrations.obsidianDesc,
    vscode: t.integrations.vscodeDesc,
    browser: t.integrations.browserDesc,
    raycast: t.integrations.raycastDesc,
    zapier: t.integrations.zapierDesc,
    n8n: t.integrations.n8nDesc,
    make: t.integrations.makeDesc,
  }

  const loadConnection = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setConnLoading(true)
    try {
      const res = await fetch("/api/developer/api-keys")
      const data = await res.json()
      const keys = (data?.keys ?? []) as ApiKeyRecord[]
      setObsidianKey(keys.find(k => k.name === OBSIDIAN_KEY_NAME && !k.revoked_at) ?? null)
    } catch {
      setObsidianKey(null)
    } finally {
      setConnLoading(false)
      setChecking(false)
      setCheckedAt(Date.now())
    }
  }, [])

  useEffect(() => { loadConnection() }, [loadConnection])

  async function handleDisconnect() {
    if (!obsidianKey) return
    if (!window.confirm(t.integrations.disconnectConfirm)) return
    setDisconnecting(true)
    try {
      await fetch(`/api/developer/api-keys/${obsidianKey.id}`, { method: "DELETE" })
      setObsidianKey(null)
    } finally {
      setDisconnecting(false)
    }
  }

  async function handleRegenerate() {
    if (!window.confirm(t.integrations.regenerateConfirm)) return
    setRegenerating(true)
    try {
      const res = await fetch("/api/integrations/obsidian/connect", { method: "POST" })
      const data = await res.json()
      if (res.ok && data?.key) {
        setRevealKey(data.key as string)
        await loadConnection({ silent: true })
      }
    } finally {
      setRegenerating(false)
    }
  }

  function handleCheckAgain() {
    setChecking(true)
    loadConnection({ silent: true })
  }

  function scrollTo(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const connected = !connLoading && !!obsidianKey

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    INTEGRATIONS.forEach(i => counts.set(i.category, (counts.get(i.category) ?? 0) + 1))
    return Array.from(counts.entries())
  }, [])

  const filtered = useMemo(() => activeCategory ? INTEGRATIONS.filter(i => i.category === activeCategory) : INTEGRATIONS, [activeCategory])
  const availableNow = useMemo(() => filtered.filter(i => !i.soon), [filtered])
  const comingSoon   = useMemo(() => filtered.filter(i => i.soon), [filtered])

  const closeReveal = useCallback(() => setRevealKey(null), [])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        @keyframes driftGlow { 0%{transform:translate(-8%,-8%);opacity:.45} 50%{transform:translate(8%,6%);opacity:.85} 100%{transform:translate(-8%,-8%);opacity:.45} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .astrocore-spin { animation: spin .8s linear infinite; }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes igIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes igFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes igPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes igPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 50% { box-shadow: 0 0 0 6px rgba(34,197,94,0); } }
        @keyframes igFlow { 0% { background-position: 0 0; } 100% { background-position: 40px 0; } }

        .ig-primary { display: inline-flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px; text-decoration: none;
          padding: 10px 18px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
        .ig-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .ig-ghost { display: inline-flex; align-items: center; gap: 7px; padding: 10px 16px; border-radius: 10px; text-decoration: none; cursor: pointer;
          font-size: 13px; font-weight: 500; font-family: inherit; background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t2}; transition: all .15s; }
        .ig-ghost:hover:not(:disabled) { background: rgba(255,255,255,.09); color: ${T.t1}; }
        .ig-ghost.warn { color: #FF6B6B; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.25); }
        .ig-ghost.warn:hover:not(:disabled) { background: rgba(232,0,42,.16); }
        .ig-ghost.flat { background: transparent; border-color: transparent; color: ${T.t4}; }
        .ig-ghost.flat:hover { color: #FF4D6A; background: rgba(232,0,42,.06); }
        .ig-ghost:disabled { opacity: .6; cursor: default; }

        /* obsidian panel */
        .ig-hero { position: relative; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr); border-radius: 18px; margin-bottom: 36px;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1}; transition: border-color .3s; animation: igIn .45s ease both; }
        .ig-hero.on { border-color: rgba(34,197,94,.3); box-shadow: 0 0 60px rgba(34,197,94,.04); }
        @media (max-width: 1050px) { .ig-hero { grid-template-columns: 1fr; } .ig-hero-r { border-left: 0 !important; border-top: 0.5px solid ${T.b1}; } }
        .ig-hero-l { padding: 32px 36px; display: flex; flex-direction: column; gap: 22px; }
        .ig-hero-r { position: relative; padding: 32px 30px; border-left: 0.5px solid ${T.b1}; overflow: hidden;
          background: linear-gradient(160deg, rgba(139,92,246,.07) 0%, rgba(232,0,42,.03) 50%, transparent 80%); display: flex; flex-direction: column; gap: 20px; }

        .ig-status { display: inline-flex; align-items: center; gap: 8px; padding: 4px 11px 4px 9px; border-radius: 20px; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; font-weight: 600; letter-spacing: .03em; }
        .ig-status.on { background: rgba(34,197,94,.1); border: 0.5px solid rgba(34,197,94,.3); color: ${T.green}; }
        .ig-status.off { background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t4}; }
        .ig-live { width: 7px; height: 7px; border-radius: 50%; background: ${T.green}; animation: igPulse 2s infinite; }

        /* connection flow  AstroCore ⟷ Obsidian */
        .ig-flow { display: flex; align-items: center; gap: 0; }
        .ig-node { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; flex-shrink: 0; font-size: 21px; }
        .ig-line { flex: 1; min-width: 40px; height: 2px; border-radius: 2px; background: rgba(255,255,255,.08); position: relative; overflow: hidden; }
        .ig-line.on { background: repeating-linear-gradient(90deg, rgba(34,197,94,.9) 0 8px, transparent 8px 20px); animation: igFlow 1s linear infinite; box-shadow: 0 0 10px rgba(34,197,94,.35); }

        .ig-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); border-radius: 12px; overflow: hidden; border: 0.5px solid ${T.b1}; background: ${T.b1}; gap: 0.5px; }
        @media (max-width: 1300px) { .ig-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .ig-stat { background: #0E0E17; padding: 11px 13px; }
        .ig-stat-l { display: flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9px; color: ${T.t4}; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
        .ig-stat-v { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; font-weight: 600; color: ${T.t1}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

        .ig-code { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-radius: 10px; background: #07070D; border: 0.5px solid rgba(125,211,252,.16); }
        .ig-code code { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #7DD3FC; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ig-code.big { padding: 11px 10px 11px 13px; border-color: rgba(125,211,252,.3); }
        .ig-code.big code { white-space: normal; word-break: break-all; }
        .ig-copy { width: 28px; height: 28px; border-radius: 7px; border: none; cursor: pointer; display: grid; place-items: center; flex-shrink: 0;
          background: rgba(255,255,255,.05); color: ${T.t3}; transition: all .12s; }
        .ig-copy:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .ig-copy.ok { color: ${T.green}; }
        .ig-label { font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.t4}; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 8px; }

        .ig-steps { display: flex; flex-direction: column; gap: 0; padding: 4px 0; animation: igIn .3s ease both; }
        .ig-step { position: relative; display: flex; gap: 12px; padding: 0 0 14px; }
        .ig-step:not(:last-child)::before { content: ""; position: absolute; left: 11px; top: 24px; bottom: 2px; width: 1px; background: rgba(232,0,42,.25); }
        .ig-step b { width: 23px; height: 23px; border-radius: 50%; display: grid; place-items: center; flex-shrink: 0; font-family: 'JetBrains Mono', monospace;
          font-size: 11px; color: ${T.red}; background: rgba(232,0,42,.1); border: 0.5px solid rgba(232,0,42,.35); }
        .ig-step span { font-size: 12.5px; color: ${T.t3}; line-height: 1.6; padding-top: 2px; }

        .ig-ok { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; background: rgba(34,197,94,.07); border: 0.5px solid rgba(34,197,94,.22); flex-wrap: wrap; }

        /* marketplace */
        .ig-seg { display: flex; gap: 2px; padding: 3px; border-radius: 11px; background: ${T.s1}; border: 0.5px solid ${T.b1}; flex-wrap: wrap; width: fit-content; margin-bottom: 26px; }
        .ig-seg button { display: flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 8px; border: none; cursor: pointer;
          font-size: 12.5px; font-family: inherit; background: transparent; color: ${T.t3}; transition: background .15s, color .15s; }
        .ig-seg button:hover { color: ${T.t1}; }
        .ig-seg button.on { background: rgba(232,0,42,.14); color: #fff; box-shadow: inset 0 0 0 0.5px rgba(232,0,42,.4); }
        .ig-seg b { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; color: ${T.t4}; }
        .ig-seg button.on b { color: ${T.red}; }

        .ig-gtitle { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600;
          color: ${T.t3}; text-transform: uppercase; letter-spacing: .08em; }
        .ig-gtitle::after { content: ""; flex: 1; max-width: 320px; height: 0.5px; background: rgba(255,255,255,.08); }
        .ig-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 14px; }

        .ig-card { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px; text-align: left; font-family: inherit;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1}; overflow: hidden; min-height: 150px;
          animation: igIn .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s; }
        .ig-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--c), transparent); opacity: .6; transition: opacity .2s; }
        .ig-card::after { content: ""; position: absolute; right: -50px; top: -50px; width: 140px; height: 140px; border-radius: 50%;
          background: radial-gradient(closest-side, var(--c), transparent); opacity: .07; transition: opacity .3s; pointer-events: none; }
        .ig-card.live { cursor: pointer; }
        .ig-card.live:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--c) 50%, transparent); box-shadow: 0 14px 34px rgba(0,0,0,.45); }
        .ig-card.live:hover::after { opacity: .2; }
        .ig-card.soon { background: rgba(255,255,255,.012); border-style: dashed; border-color: rgba(255,255,255,.12); }
        .ig-card.soon::before { opacity: .2; }
        .ig-card.soon:hover { border-color: rgba(255,255,255,.22); }
        .ig-card.soon:hover .ig-ico { filter: none; opacity: 1; }
        .ig-ico { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; font-size: 19px; transition: filter .25s, opacity .25s;
          background: color-mix(in srgb, var(--c) 13%, transparent); border: 0.5px solid color-mix(in srgb, var(--c) 32%, transparent); color: var(--c); }
        .ig-card.soon .ig-ico { filter: grayscale(.8); opacity: .6; }
        .ig-name { font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: ${T.t1}; margin-bottom: 4px; }
        .ig-desc { font-size: 12px; color: ${T.t4}; line-height: 1.5; }
        .ig-pill { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9px; padding: 2px 8px; border-radius: 20px;
          font-weight: 600; text-transform: uppercase; letter-spacing: .05em; }
        .ig-arr { color: ${T.t4}; opacity: 0; transform: translate(-3px,3px); transition: all .2s; }
        .ig-card.live:hover .ig-arr { opacity: 1; transform: none; color: var(--c); }

        .ig-overlay { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: igFade .18s ease-out; }
        .ig-modal { width: 100%; max-width: 460px; border-radius: 16px; overflow: hidden; background: linear-gradient(160deg,#13131F 0%,#0E0E18 100%);
          border: 0.5px solid rgba(34,197,94,.25); box-shadow: 0 30px 80px rgba(0,0,0,.8); animation: igPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .ig-x { background: rgba(255,255,255,.04); border: none; cursor: pointer; color: ${T.t4}; line-height: 0; padding: 6px; border-radius: 8px; }
        .ig-x:hover { color: ${T.t1}; background: rgba(255,255,255,.08); }
        @media (prefers-reduced-motion: reduce) { .ig-card, .ig-hero, .ig-modal, .ig-line.on { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px 4px 10px", marginBottom: 14 }}>
                <span aria-hidden style={{ position: "relative", width: 18, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                  <span className="astrocore-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
                </span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Integration Layer</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.integrations.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.integrations.subtitle}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setShowInstall(true); scrollTo("obsidian-hero") }} className="ig-ghost"><HelpCircle size={14} /> {t.integrations.help}</button>
              <button onClick={() => scrollTo("marketplace")} className="ig-primary"><Plus size={14} /> {t.integrations.addIntegration}</button>
            </div>
          </div>
        </div>

        <div style={{ padding: "28px 48px 72px" }}>

          {/* ── Obsidian ── */}
          <div id="obsidian-hero" className={`ig-hero${connected ? " on" : ""}`} style={{ scrollMarginTop: 20 }}>
            <div className="ig-hero-l">
              {/* flow: AstroCore ⟷ Obsidian */}
              <div className="ig-flow">
                <div className="ig-node" style={{ background: "rgba(232,0,42,.12)", border: "0.5px solid rgba(232,0,42,.35)", boxShadow: "0 0 22px rgba(232,0,42,.2)",
                  fontFamily: "'Space Grotesk', sans-serif", fontWeight: 800, color: T.red, fontSize: 20 }}>A</div>
                <div className={`ig-line${connected ? " on" : ""}`} style={{ margin: "0 12px" }} />
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  {connLoading ? (
                    <span className="ig-status off"><Loader2 size={11} className="astrocore-spin" /> {t.integrations.checkingStatus}</span>
                  ) : connected ? (
                    <span className="ig-status on"><span className="ig-live" /> {t.integrations.connected}</span>
                  ) : (
                    <span className="ig-status off"><Link2 size={11} /> {t.integrations.notConnected}</span>
                  )}
                </div>
                <div className={`ig-line${connected ? " on" : ""}`} style={{ margin: "0 12px" }} />
                <div className="ig-node" style={{ background: "linear-gradient(145deg,#6C3FA0 0%,#3D2260 100%)", boxShadow: "0 0 26px rgba(139,92,246,0.35)" }}>🔮</div>
              </div>

              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Obsidian</div>
                <p style={{ fontSize: 14, color: T.t2, lineHeight: 1.7, margin: 0, maxWidth: 520 }}>
                  {connected ? t.integrations.obsidianDescConnected : t.integrations.obsidianDescDisconnected}
                </p>
              </div>

              {connected && obsidianKey && (
                <>
                  <div className="ig-stats">
                    {[
                      { icon: CheckCircle2, label: t.integrations.connectionState, value: t.integrations.active, green: true },
                      { icon: Clock,        label: t.integrations.lastUsed,        value: formatDate(obsidianKey.last_used_at, t, language) },
                      { icon: CalendarDays, label: t.integrations.connectedSince,  value: formatDate(obsidianKey.created_at, t, language) },
                      { icon: Shield,       label: t.integrations.permissions,     value: `${obsidianKey.permissions?.length ?? 0} ${t.integrations.permissionsOf}` },
                    ].map(s => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className="ig-stat">
                          <div className="ig-stat-l"><Icon size={10} />{s.label}</div>
                          <div className="ig-stat-v" style={{ color: s.green ? T.green : undefined }}>{s.value}</div>
                        </div>
                      )
                    })}
                  </div>

                  <div>
                    <div className="ig-label">{t.integrations.apiKey}</div>
                    <div className="ig-code">
                      <KeyRound size={13} style={{ color: "#7DD3FC", flexShrink: 0 }} />
                      <code>{obsidianKey.key_prefix}••••••••••••••••</code>
                      <CopyBtn text={obsidianKey.key_prefix} />
                    </div>
                  </div>

                  <div className="ig-ok">
                    <CheckCircle2 size={18} style={{ color: T.green, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{t.integrations.integrationWorking}</div>
                      <div style={{ fontSize: 11.5, color: T.t3, marginTop: 1 }}>
                        {t.integrations.dataExchangeSuccess}
                        {checkedAt && <span style={{ fontFamily: "'JetBrains Mono', monospace", color: T.t4 }}> · {new Date(checkedAt).toLocaleTimeString(uk ? "uk-UA" : "en-US", { hour: "2-digit", minute: "2-digit" })}</span>}
                      </div>
                    </div>
                    <button onClick={handleCheckAgain} disabled={checking} className="ig-ghost" style={{ padding: "7px 12px", fontSize: 12 }}>
                      {checking ? <Loader2 size={13} className="astrocore-spin" /> : <RefreshCw size={13} />} {t.integrations.checkAgain}
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button onClick={handleRegenerate} disabled={regenerating} className="ig-ghost warn">
                      {regenerating ? <Loader2 size={14} className="astrocore-spin" /> : <RefreshCw size={14} />} {t.integrations.regenerateKey}
                    </button>
                    <a href="/settings/developer" className="ig-ghost"><Settings size={14} /> {t.integrations.changeSettings}</a>
                    <button onClick={handleDisconnect} disabled={disconnecting} className="ig-ghost flat">
                      {disconnecting ? <Loader2 size={14} className="astrocore-spin" /> : <Unlink size={14} />} {t.integrations.disconnect}
                    </button>
                  </div>
                </>
              )}

              {!connected && !connLoading && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href="/connect/obsidian" className="ig-primary"><KeyRound size={14} /> {t.integrations.connectAstroCore}</a>
                  <button onClick={() => setShowInstall(v => !v)} className="ig-ghost">{t.integrations.howToInstall}</button>
                </div>
              )}

              {(showInstall || (!connected && !connLoading)) && (
                <div className="ig-steps">
                  {INSTALL_STEPS.map((s, i) => (
                    <div key={i} className="ig-step"><b>{i + 1}</b><span>{s}</span></div>
                  ))}
                </div>
              )}
            </div>

            {/* Right — capabilities */}
            <div className="ig-hero-r">
              <div aria-hidden style={{ position: "absolute", top: "15%", right: "5%", width: 220, height: 220, borderRadius: "50%",
                background: "radial-gradient(circle,rgba(139,92,246,0.16) 0%,transparent 70%)", filter: "blur(8px)", animation: "driftGlow 10s ease-in-out infinite", pointerEvents: "none" }} />
              <div className="ig-label" style={{ position: "relative", marginBottom: 0 }}>{t.integrations.whatObsidianCanDo}</div>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 12 }}>
                {CAPABILITIES.map((cap, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, animation: `igIn .4s ease ${i * 60}ms both` }}>
                    <span style={{ width: 20, height: 20, borderRadius: 6, display: "grid", placeItems: "center", flexShrink: 0, background: "rgba(34,197,94,.1)", border: "0.5px solid rgba(34,197,94,.28)" }}>
                      <Check size={11} style={{ color: T.green }} />
                    </span>
                    <span style={{ fontSize: 13, color: T.t2, lineHeight: 1.5 }}>{cap}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: "relative", marginTop: "auto" }}>
                <div className="ig-label">{t.integrations.endpointLabel.replace(/:\s*$/, "")}</div>
                <div className="ig-code">
                  <code>{endpoint}</code>
                  <CopyBtn text={endpoint} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Marketplace ── */}
          <div id="marketplace" style={{ scrollMarginTop: 20 }}>
            <div style={{ marginBottom: 16 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 20, fontWeight: 600, color: T.t1, margin: 0 }}>{t.integrations.availableIntegrations}</h2>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.integrations.availableIntegrationsDesc}</p>
            </div>

            <div className="ig-seg">
              <button className={activeCategory === null ? "on" : ""} onClick={() => setActiveCategory(null)}>
                {t.integrations.all} <b>{INTEGRATIONS.length}</b>
              </button>
              {categories.map(([cat, count]) => (
                <button key={cat} className={activeCategory === cat ? "on" : ""} onClick={() => setActiveCategory(cat)}>
                  {categoryLabels[cat]} <b>{count}</b>
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
              {availableNow.length > 0 && (
                <div>
                  <div className="ig-gtitle"><span className="ig-live" style={{ animation: "none" }} />{uk ? "Доступно зараз" : "Available now"}</div>
                  <div className="ig-grid">
                    {availableNow.map((item, i) => {
                      const isConnected = item.id === "obsidian" && connected
                      const Icon = item.icon
                      return (
                        <button key={item.id} className="ig-card live" onClick={() => scrollTo("obsidian-hero")}
                          style={{ ["--c" as string]: item.color, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div className="ig-ico" style={item.emoji ? { background: "linear-gradient(145deg,#6C3FA0 0%,#3D2260 100%)", border: "none", boxShadow: "0 0 18px rgba(139,92,246,.3)" } : undefined}>
                              {item.emoji ?? (Icon && <Icon size={17} />)}
                            </div>
                            {isConnected
                              ? <span className="ig-pill" style={{ background: "rgba(34,197,94,0.10)", color: T.green, border: "0.5px solid rgba(34,197,94,0.28)" }}><span className="ig-live" style={{ width: 5, height: 5 }} />{t.integrations.connected}</span>
                              : <ArrowUpRight size={15} className="ig-arr" />}
                          </div>
                          <div>
                            <div className="ig-name">{item.name}</div>
                            <div className="ig-desc">{descriptions[item.id]}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {comingSoon.length > 0 && (
                <div>
                  <div className="ig-gtitle"><span style={{ width: 7, height: 7, borderRadius: "50%", background: T.t4 }} />{uk ? "У розробці" : "In development"}</div>
                  <div className="ig-grid">
                    {comingSoon.map((item, i) => {
                      const Icon = item.icon
                      return (
                        <div key={item.id} className="ig-card soon" style={{ ["--c" as string]: item.color, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div className="ig-ico">{Icon && <Icon size={17} />}</div>
                            <span className="ig-pill" style={{ background: "rgba(255,255,255,0.05)", color: T.t4, border: `0.5px solid ${T.b1}` }}>{t.integrations.soon}</span>
                          </div>
                          <div>
                            <div className="ig-name" style={{ color: T.t3 }}>{item.name}</div>
                            <div className="ig-desc">{descriptions[item.id]}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {revealKey && <RevealKeyModal fullKey={revealKey} onClose={closeReveal} t={t} />}
    </>
  )
}