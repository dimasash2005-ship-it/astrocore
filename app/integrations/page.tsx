"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  HelpCircle, Plus, Copy, Check, RefreshCw, Settings, Settings2,
  CheckCircle2, Loader2, Unlink, X, Lock,
  Code2, Globe, Search, Zap, Workflow, Puzzle,
  Clock, KeyRound, Shield, CalendarDays,
} from "lucide-react"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"
import NotionPanel from "@/components/integrations/NotionPanel"
import TelegramPanel from "@/components/integrations/TelegramPanel"
import { IntegrationCard, IntegrationDrawer, Chip } from "@/components/integrations/IntegrationUI"

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
}

const OBSIDIAN_KEY_NAME = "Obsidian Plugin"
const OBSIDIAN_COLOR = "#8B5CF6"

type SoonDef = {
  id: string
  name: string
  icon: React.ElementType
  color: string
  category: "notes" | "dev" | "productivity" | "automation"
}

// Live integrations (Obsidian, Notion) have their own cards above; this is the "coming soon" catalog.
const SOON: SoonDef[] = [
  { id: "vscode",   name: "VS Code",           icon: Code2,    color: "#007ACC", category: "dev" },
  { id: "browser",  name: "Browser Extension", icon: Globe,    color: "#F59E0B", category: "productivity" },
  { id: "raycast",  name: "Raycast",           icon: Search,   color: "#FF6363", category: "productivity" },
  { id: "zapier",   name: "Zapier",            icon: Zap,      color: "#FF4A00", category: "automation" },
  { id: "n8n",      name: "n8n",               icon: Workflow, color: "#EA4B71", category: "automation" },
  { id: "make",     name: "Make",              icon: Puzzle,   color: "#6D00CC", category: "automation" },
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

function ObsidianLogo({ size = 44 }: { size?: number }) {
  return (
    <span style={{ width: size, height: size, borderRadius: size * 0.27, display: "grid", placeItems: "center", fontSize: size * 0.45,
      background: "linear-gradient(145deg,#6C3FA0 0%,#3D2260 100%)" }}>🔮</span>
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
          <button onClick={onClose} className="ic-btn primary" style={{ justifyContent: "center", padding: "10px 16px" }}>{t.integrations.done}</button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { t, language } = useLanguage()
  const uk = language === "uk"
  const [origin, setOrigin] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [obsidianOpen, setObsidianOpen] = useState(false)

  const [connLoading, setConnLoading] = useState(true)
  const [obsidianKey, setObsidianKey] = useState<ApiKeyRecord | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)
  const [checkedAt, setCheckedAt] = useState<number | null>(null)
  const [notionOn, setNotionOn] = useState(false)
  const [telegramOn, setTelegramOn] = useState(false)

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

  const connected = !connLoading && !!obsidianKey
  const connectedCount = (connected ? 1 : 0) + (notionOn ? 1 : 0) + (telegramOn ? 1 : 0)

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    SOON.forEach(i => counts.set(i.category, (counts.get(i.category) ?? 0) + 1))
    return Array.from(counts.entries())
  }, [])
  const soonFiltered = useMemo(() => activeCategory ? SOON.filter(i => i.category === activeCategory) : SOON, [activeCategory])

  const closeReveal = useCallback(() => setRevealKey(null), [])
  const closeObsidian = useCallback(() => setObsidianOpen(false), [])
  const checkedTime = checkedAt ? new Date(checkedAt).toLocaleTimeString(uk ? "uk-UA" : "en-US", { hour: "2-digit", minute: "2-digit" }) : ""

  return (
    <>
      <style>{`
        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes igIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes igFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes igPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }

        .ig-head { position: relative; padding: 32px 44px 24px; border-bottom: 0.5px solid ${T.b1}; overflow: hidden; }
        .ig-head-row { position: relative; z-index: 1; display: flex; align-items: flex-end; justify-content: space-between; flex-wrap: wrap; gap: 18px; }
        .ig-stats { display: flex; gap: 10px; flex-wrap: wrap; }
        .ig-stat { padding: 10px 16px; border-radius: 12px; background: ${T.s1}; border: 0.5px solid ${T.b1}; min-width: 112px; }
        .ig-stat b { display: block; font: 600 20px 'Space Grotesk', sans-serif; color: ${T.t1}; line-height: 1.2; }
        .ig-stat.g b { color: ${T.green}; }
        .ig-stat span { font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: .07em; text-transform: uppercase; color: #8A8AAA; }
        .ig-actions { display: flex; gap: 10px; }
        .ig-body { padding: 26px 44px 72px; }
        @media (max-width: 760px) { .ig-head { padding: 24px 16px 20px; } .ig-body { padding: 20px 16px 60px; } }

        .ig-gtitle { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; font: 600 10px 'JetBrains Mono', monospace;
          color: ${T.t3}; text-transform: uppercase; letter-spacing: .08em; }
        .ig-gtitle::after { content: ""; flex: 1; max-width: 320px; height: 0.5px; background: rgba(255,255,255,.08); }
        .ig-dot { width: 7px; height: 7px; border-radius: 50%; background: ${T.green}; box-shadow: 0 0 8px rgba(34,197,94,.8); }
        .ig-mine { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 380px), 1fr)); gap: 14px; margin-bottom: 36px; }

        .ig-seg { display: flex; gap: 2px; padding: 3px; border-radius: 11px; background: ${T.s1}; border: 0.5px solid ${T.b1}; flex-wrap: wrap; width: fit-content; max-width: 100%; margin-bottom: 18px; }
        .ig-seg button { display: flex; align-items: center; gap: 7px; height: 32px; padding: 0 13px; border-radius: 8px; border: none; cursor: pointer;
          font-size: 12.5px; font-family: inherit; background: transparent; color: ${T.t3}; transition: background .15s, color .15s; }
        .ig-seg button:hover { color: ${T.t1}; }
        .ig-seg button.on { background: rgba(232,0,42,.14); color: #fff; box-shadow: inset 0 0 0 0.5px rgba(232,0,42,.4); }
        .ig-seg b { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 500; color: ${T.t4}; }
        .ig-seg button.on b { color: ${T.red}; }

        .ig-soon { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 1250px) { .ig-soon { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 900px)  { .ig-soon { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 560px)  { .ig-soon { grid-template-columns: minmax(0, 1fr); } }
        .ig-sc { position: relative; overflow: hidden; display: flex; align-items: center; gap: 12px; padding: 14px 15px; border-radius: 14px; min-width: 0;
          background: rgba(255,255,255,.012); border: 0.5px dashed rgba(255,255,255,.12); animation: igIn .4s ease both; transition: border-color .2s; }
        .ig-sc::after { content: ""; position: absolute; right: -40px; top: -40px; width: 110px; height: 110px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(closest-side, var(--c), transparent); opacity: 0; transition: opacity .3s; }
        .ig-sc:hover { border-color: rgba(255,255,255,.22); }
        .ig-sc:hover::after { opacity: .14; }
        .ig-sc-ico { width: 36px; height: 36px; border-radius: 10px; flex: none; display: grid; place-items: center; transition: filter .25s, opacity .25s;
          background: color-mix(in srgb, var(--c) 13%, transparent); border: 0.5px solid color-mix(in srgb, var(--c) 32%, transparent); color: var(--c);
          filter: grayscale(.8); opacity: .65; }
        .ig-sc:hover .ig-sc-ico { filter: none; opacity: 1; }
        .ig-sc-tx { flex: 1; min-width: 0; }
        .ig-sc-name { font: 600 14px 'Space Grotesk', sans-serif; color: ${T.t2}; }
        .ig-sc-desc { font-size: 11.5px; color: #6A6A8A; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ig-sc-pill { flex: none; font: 600 9px 'JetBrains Mono', monospace; letter-spacing: .05em; text-transform: uppercase; color: #6A6A8A;
          padding: 2px 8px; border-radius: 20px; border: 0.5px solid rgba(255,255,255,.1); background: rgba(255,255,255,.04); }

        .ig-code { display: flex; align-items: center; gap: 8px; padding: 8px 8px 8px 12px; border-radius: 10px; background: #07070D; border: 0.5px solid rgba(125,211,252,.16); }
        .ig-code code { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 12px; color: #7DD3FC; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ig-code.big { padding: 11px 10px 11px 13px; border-color: rgba(125,211,252,.3); }
        .ig-code.big code { white-space: normal; word-break: break-all; }
        .ig-copy { width: 28px; height: 28px; border-radius: 7px; border: none; cursor: pointer; display: grid; place-items: center; flex-shrink: 0;
          background: rgba(255,255,255,.05); color: ${T.t3}; transition: all .12s; }
        .ig-copy:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .ig-copy.ok { color: ${T.green}; }
        .ig-dstats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-radius: 12px; overflow: hidden; border: 0.5px solid ${T.b1}; background: ${T.b1}; gap: 0.5px; }
        .ig-dstat { background: #0E0E17; padding: 11px 13px; min-width: 0; }
        .ig-dstat-l { display: flex; align-items: center; gap: 5px; font: 600 9px 'JetBrains Mono', monospace; color: #8A8AAA; text-transform: uppercase; letter-spacing: .06em; margin-bottom: 6px; }
        .ig-dstat-v { font: 600 12.5px 'JetBrains Mono', monospace; color: ${T.t1}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .ig-ok { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 12px; background: rgba(34,197,94,.07); border: 0.5px solid rgba(34,197,94,.22); flex-wrap: wrap; }

        .ig-overlay { position: fixed; inset: 0; z-index: 500; display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: igFade .18s ease-out; }
        .ig-modal { width: 100%; max-width: 460px; border-radius: 16px; overflow: hidden; background: linear-gradient(160deg,#13131F 0%,#0E0E18 100%);
          border: 0.5px solid rgba(34,197,94,.25); box-shadow: 0 30px 80px rgba(0,0,0,.8); animation: igPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .ig-x { background: rgba(255,255,255,.04); border: none; cursor: pointer; color: ${T.t4}; line-height: 0; padding: 6px; border-radius: 8px; }
        .ig-x:hover { color: ${T.t1}; background: rgba(255,255,255,.08); }
        @media (prefers-reduced-motion: reduce) { .ig-sc, .ig-modal { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Header ── */}
        <div className="ig-head">
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />

          <div className="ig-head-row">
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
            <div style={{ display: "flex", alignItems: "flex-end", gap: 14, flexWrap: "wrap" }}>
              <div className="ig-stats">
                <div className="ig-stat g"><b>{connectedCount}</b><span>{uk ? "підключено" : "connected"}</span></div>
                <div className="ig-stat"><b>{SOON.length}</b><span>{uk ? "скоро" : "coming soon"}</span></div>
              </div>
              <div className="ig-actions">
                <button onClick={() => setObsidianOpen(true)} className="ic-btn"><HelpCircle size={14} /> {t.integrations.help}</button>
                <button onClick={() => document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" })} className="ic-btn primary">
                  <Plus size={14} /> {t.integrations.addIntegration}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="ig-body">
          {/* ── My integrations ── */}
          <div className="ig-gtitle"><span className="ig-dot" />{uk ? "Мої інтеграції" : "My integrations"}</div>
          <div className="ig-mine">
            {connLoading ? (
              <IntegrationCard color={OBSIDIAN_COLOR} logo={<ObsidianLogo />} name="Obsidian" desc={t.integrations.checkingStatus} on={false}
                statusLabel="…" actions={<span className="ic-note"><Loader2 size={12} className="ic-spin" /></span>} />
            ) : connected && obsidianKey ? (
              <IntegrationCard color={OBSIDIAN_COLOR} logo={<ObsidianLogo />} name="Obsidian" on statusLabel={t.integrations.active}
                desc={t.integrations.obsidianDescConnected} onOpen={() => setObsidianOpen(true)}
                chips={<>
                  <Chip tone="key"><KeyRound size={11} /> {obsidianKey.key_prefix}…</Chip>
                  <Chip label={t.integrations.lastUsed}>{formatDate(obsidianKey.last_used_at, t, language)}</Chip>
                  <Chip label={t.integrations.permissions}>{obsidianKey.permissions?.length ?? 0}/5</Chip>
                </>}
                actions={<>
                  <button className="ic-btn primary" onClick={() => setObsidianOpen(true)}><Settings2 size={14} /> {uk ? "Налаштувати" : "Settings"}</button>
                  <button className="ic-btn" onClick={handleCheckAgain} disabled={checking}>
                    {checking ? <Loader2 size={13} className="ic-spin" /> : <RefreshCw size={13} />} {t.integrations.checkAgain}
                  </button>
                </>}
                right={checkedTime ? <span className="ic-note"><Check size={11} style={{ color: T.green }} /> {checkedTime}</span> : undefined} />
            ) : (
              <IntegrationCard color={OBSIDIAN_COLOR} logo={<ObsidianLogo />} name="Obsidian" on={false} statusLabel={t.integrations.notConnected}
                desc={t.integrations.obsidianDesc} onOpen={() => setObsidianOpen(true)}
                actions={<>
                  <a href="/connect/obsidian" className="ic-btn primary"><KeyRound size={14} /> {t.integrations.connectAstroCore}</a>
                  <button className="ic-btn" onClick={() => setObsidianOpen(true)}>{t.integrations.howToInstall}</button>
                </>} />
            )}
            <NotionPanel onStatus={setNotionOn} delay={60} />
            <TelegramPanel onStatus={setTelegramOn} delay={120} />
          </div>

          {/* ── Coming soon ── */}
          <div id="catalog" style={{ scrollMarginTop: 20 }}>
            <div className="ig-gtitle">{uk ? "У розробці" : "In development"}</div>
            <div className="ig-seg">
              <button className={activeCategory === null ? "on" : ""} onClick={() => setActiveCategory(null)}>
                {t.integrations.all} <b>{SOON.length}</b>
              </button>
              {categories.map(([cat, count]) => (
                <button key={cat} className={activeCategory === cat ? "on" : ""} onClick={() => setActiveCategory(cat)}>
                  {categoryLabels[cat]} <b>{count}</b>
                </button>
              ))}
            </div>
            <div className="ig-soon">
              {soonFiltered.map((item, i) => {
                const Icon = item.icon
                return (
                  <div key={item.id} className="ig-sc" style={{ ["--c" as string]: item.color, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                    <div className="ig-sc-ico"><Icon size={16} /></div>
                    <div className="ig-sc-tx">
                      <div className="ig-sc-name">{item.name}</div>
                      <div className="ig-sc-desc" title={descriptions[item.id]}>{descriptions[item.id]}</div>
                    </div>
                    <span className="ig-sc-pill">{t.integrations.soon}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Obsidian side panel ── */}
      <IntegrationDrawer open={obsidianOpen} onClose={closeObsidian} color={OBSIDIAN_COLOR} logo={<ObsidianLogo size={48} />}
        title="Obsidian" subtitle={connected ? t.integrations.obsidianDescConnected : t.integrations.obsidianDescDisconnected}
        footer={connected ? <>
          <button onClick={handleRegenerate} disabled={regenerating} className="ic-btn">
            {regenerating ? <Loader2 size={13} className="ic-spin" /> : <RefreshCw size={13} />} {t.integrations.regenerateKey}
          </button>
          <a href="/settings/developer" className="ic-btn"><Settings size={13} /> {t.integrations.changeSettings}</a>
          <button onClick={handleDisconnect} disabled={disconnecting} className="ic-btn warn push">
            {disconnecting ? <Loader2 size={13} className="ic-spin" /> : <Unlink size={13} />} {t.integrations.disconnect}
          </button>
        </> : !connLoading ? <a href="/connect/obsidian" className="ic-btn primary"><KeyRound size={14} /> {t.integrations.connectAstroCore}</a> : undefined}>

        <div className="idr-flow">
          <div className="idr-node a">A</div>
          <div className={`idr-line${connected ? " on" : ""}`} />
          <span className={`icd-pill${connected ? " on" : ""}`}>{connected && <span className="icd-live" />}{connected ? t.integrations.connected : t.integrations.notConnected}</span>
          <div className={`idr-line${connected ? " on" : ""}`} />
          <ObsidianLogo size={38} />
        </div>

        {connected && obsidianKey && (
          <>
            <div className="ig-dstats">
              {[
                { icon: CheckCircle2, label: t.integrations.connectionState, value: t.integrations.active, green: true },
                { icon: Clock,        label: t.integrations.lastUsed,        value: formatDate(obsidianKey.last_used_at, t, language) },
                { icon: CalendarDays, label: t.integrations.connectedSince,  value: formatDate(obsidianKey.created_at, t, language) },
                { icon: Shield,       label: t.integrations.permissions,     value: `${obsidianKey.permissions?.length ?? 0} ${t.integrations.permissionsOf}` },
              ].map(s => {
                const Icon = s.icon
                return (
                  <div key={s.label} className="ig-dstat">
                    <div className="ig-dstat-l"><Icon size={10} />{s.label}</div>
                    <div className="ig-dstat-v" style={{ color: s.green ? T.green : undefined }}>{s.value}</div>
                  </div>
                )
              })}
            </div>

            <div>
              <div className="idr-label">{t.integrations.apiKey}</div>
              <div className="ig-code">
                <KeyRound size={13} style={{ color: "#7DD3FC", flexShrink: 0 }} />
                <code>{obsidianKey.key_prefix}••••••••••••••••</code>
                <CopyBtn text={obsidianKey.key_prefix} />
              </div>
            </div>

            <div className="ig-ok">
              <CheckCircle2 size={18} style={{ color: T.green, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.t1 }}>{t.integrations.integrationWorking}</div>
                <div style={{ fontSize: 11.5, color: T.t3, marginTop: 1 }}>
                  {t.integrations.dataExchangeSuccess}
                  {checkedTime && <span style={{ fontFamily: "'JetBrains Mono', monospace", color: T.t4 }}> · {checkedTime}</span>}
                </div>
              </div>
              <button onClick={handleCheckAgain} disabled={checking} className="ic-btn" style={{ padding: "7px 11px", fontSize: 12 }}>
                {checking ? <Loader2 size={13} className="ic-spin" /> : <RefreshCw size={13} />} {t.integrations.checkAgain}
              </button>
            </div>
          </>
        )}

        <div>
          <div className="idr-label">{t.integrations.endpointLabel.replace(/:\s*$/, "")}</div>
          <div className="ig-code">
            <code>{endpoint}</code>
            <CopyBtn text={endpoint} />
          </div>
        </div>

        <div>
          <div className="idr-label">{t.integrations.howToInstall}</div>
          <div className="idr-steps">
            {INSTALL_STEPS.map((s, i) => <div key={i} className="idr-step"><b>{i + 1}</b><span>{s}</span></div>)}
          </div>
        </div>

        <div>
          <div className="idr-label">{t.integrations.whatObsidianCanDo}</div>
          <div className="idr-caps">
            {CAPABILITIES.map((c, i) => <div key={i} className="idr-cap"><span><Check size={11} /></span>{c}</div>)}
          </div>
        </div>
      </IntegrationDrawer>

      {revealKey && <RevealKeyModal fullKey={revealKey} onClose={closeReveal} t={t} />}
    </>
  )
}