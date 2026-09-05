"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Sparkles, HelpCircle, Plus, Copy, Check, RefreshCw, Settings,
  CheckCircle2, Circle, Loader2, Unlink, X, Lock,
  Code2, Globe, Search, Zap, Workflow, Puzzle,
  Clock, KeyRound, Shield, CalendarDays,
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

function CopyBtn({ text, subtle }: { text: string; subtle?: boolean }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 1800)
      })
    }} style={{
      display: "flex", alignItems: "center", justifyContent: "center",
      width: 30, height: 30, borderRadius: 8, border: "none", cursor: "pointer",
      background: subtle ? "transparent" : "rgba(255,255,255,0.05)",
      color: copied ? T.green : T.t3, transition: "color 130ms ease, background 130ms ease",
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function StatusCard({ icon: Icon, label, value, tone }: { icon: React.ElementType; label: string; value: string; tone?: "green" }) {
  return (
    <div style={{
      flex: "1 1 180px", minWidth: 160,
      padding: "14px 16px", borderRadius: 12,
      background: "rgba(255,255,255,0.02)", border: `0.5px solid ${T.b1}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
        <Icon size={12} style={{ color: T.t4 }} />
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</span>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13.5, fontWeight: 600, color: tone === "green" ? T.green : T.t1, display: "flex", alignItems: "center", gap: 6 }}>
        {tone === "green" && <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.green, display: "inline-block" }} />}
        {value}
      </div>
    </div>
  )
}

// ── One-time reveal modal after (re)generating a key ──
function RevealKeyModal({ fullKey, onClose, t }: { fullKey: string; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 300,
      background: "rgba(4,4,8,0.75)", backdropFilter: "blur(2px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 460, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: `1px solid ${T.b2}`, boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 22px", borderBottom: `0.5px solid ${T.b1}` }}>
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.integrations.newKeyGenerated}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={16} /></button>
        </div>
        <div style={{ padding: 22, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{
            display: "flex", alignItems: "flex-start", gap: 10,
            padding: "11px 14px", borderRadius: 10,
            background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.25)",
          }}>
            <Lock size={13} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.55 }}>
              {t.integrations.revealKeyWarningPrefix}<strong style={{ color: T.t1 }}>{t.integrations.revealKeyWarningStrong}</strong>{t.integrations.revealKeyWarningSuffix}
            </div>
          </div>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "11px 13px", borderRadius: 10,
            background: "rgba(0,0,0,0.4)", border: "0.5px solid rgba(125,211,252,0.18)",
          }}>
            <code style={{ fontSize: 12, color: "#7DD3FC", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all", flex: 1 }}>{fullKey}</code>
            <CopyBtn text={fullKey} />
          </div>
          <button onClick={onClose} style={{
            padding: "11px", borderRadius: 10, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.06)", color: T.t1, fontSize: 13.5, fontWeight: 500,
          }}>{t.integrations.done}</button>
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const { t, language } = useLanguage()
  const [origin, setOrigin] = useState("")
  const [showInstall, setShowInstall] = useState(false)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const [connLoading, setConnLoading] = useState(true)
  const [obsidianKey, setObsidianKey] = useState<ApiKeyRecord | null>(null)
  const [disconnecting, setDisconnecting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [revealKey, setRevealKey] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

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
      const active = keys.find(k => k.name === OBSIDIAN_KEY_NAME && !k.revoked_at) ?? null
      setObsidianKey(active)
    } catch {
      setObsidianKey(null)
    } finally {
      setConnLoading(false)
      setChecking(false)
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

  const categories = useMemo(() => {
    const counts = new Map<string, number>()
    INTEGRATIONS.forEach(i => counts.set(i.category, (counts.get(i.category) ?? 0) + 1))
    return Array.from(counts.entries())
  }, [])

  const filtered = useMemo(() => {
    if (!activeCategory) return INTEGRATIONS
    return INTEGRATIONS.filter(i => i.category === activeCategory)
  }, [activeCategory])

  // Split so the marketplace reads as two honest groups — what
  // actually works today vs what's being built — instead of one grid
  // where a tiny "Soon" pill was the only thing telling them apart.
  const availableNow = useMemo(() => filtered.filter(i => !i.soon), [filtered])
  const comingSoon   = useMemo(() => filtered.filter(i => i.soon), [filtered])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes scanline { 0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0} }
        @keyframes driftGlow { 0%{transform:translate(-8%,-8%);opacity:.45} 50%{transform:translate(8%,6%);opacity:.85} 100%{transform:translate(-8%,-8%);opacity:.45} }
        @keyframes spin { to { transform: rotate(360deg) } }
        .astrocore-spin { animation: spin .8s linear infinite; }
        .ac-card { transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease; }
        .ac-card:hover { transform: translateY(-2px); }
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
        /* Deliberately slow — a gentle drift, not the snappy 1.6-3s
           sweep used for "this is live right now" indicators elsewhere. */
        .astrocore-slow-sweep { animation: astrocoreSlowSweep 12s linear infinite; }
        @keyframes astrocoreSlowSweep {
          0%   { left: -25%; }
          100% { left: 100%; }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{ position: "relative", padding: "36px 56px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5,
            background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none",
          }}>
            <div className="astrocore-hero-sweep" style={{
              position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
              background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
              boxShadow: "0 0 10px rgba(232,0,42,0.85)",
            }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
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
                  Integration Layer
                </span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 30, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.integrations.title}</h1>
              <p style={{ fontSize: 14, color: T.t3, marginTop: 8, marginBottom: 0 }}>
                {t.integrations.subtitle}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowInstall(v => !v)} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 10, border: `0.5px solid ${T.b1}`,
                background: T.s1, color: T.t2, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                transition: "background 130ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.s1 }}
              >
                <HelpCircle size={15} /> {t.integrations.help}
              </button>
              <a href="#marketplace" style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 10, border: "none", textDecoration: "none",
                background: T.red, color: "#fff", fontSize: 13.5, fontWeight: 600,
                transition: "background 140ms ease, box-shadow 140ms ease, transform 140ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(232,0,42,0.35)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red; (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)" }}
              >
                <Plus size={15} /> {t.integrations.addIntegration}
              </a>
            </div>
          </div>
        </div>

        <div style={{ padding: "28px 56px 72px", maxWidth: 1500 }}>

          {/* ── Hero: Obsidian ── */}
          <div id="obsidian-hero" style={{
            position: "relative", overflow: "hidden",
            background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
            border: `1px solid ${connected ? "rgba(34,197,94,0.22)" : T.b1}`,
            borderRadius: 18, marginBottom: 28,
            display: "grid", gridTemplateColumns: "1.3fr 1fr",
          }}>
            {/* Left */}
            <div style={{ padding: "36px 40px", display: "flex", flexDirection: "column", gap: 26 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 16, fontSize: 30,
                  background: "linear-gradient(145deg,#6C3FA0 0%,#3D2260 100%)",
                  boxShadow: "0 0 28px rgba(139,92,246,0.30)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>🔮</div>
                <div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, fontWeight: 600, color: T.t1, marginBottom: 6 }}>Obsidian</div>
                  {connLoading ? (
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: T.t4 }}>
                      <Loader2 size={12} className="astrocore-spin" /> {t.integrations.checkingStatus}
                    </div>
                  ) : connected ? (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 7,
                      padding: "3px 10px 3px 8px", borderRadius: 20, background: "rgba(34,197,94,0.10)",
                      border: "0.5px solid rgba(34,197,94,0.28)", fontSize: 11.5, color: T.green, fontWeight: 600,
                    }}>
                      <span aria-hidden style={{
                        position: "relative", width: 14, height: 1.5, borderRadius: 1,
                        background: "rgba(34,197,94,0.25)", overflow: "hidden", display: "inline-block",
                      }}>
                        <span className="astrocore-badge-sweep" style={{
                          position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%",
                          background: "linear-gradient(90deg, transparent, #22C55E, transparent)",
                        }} />
                      </span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.03em" }}>{t.integrations.connected}</span>
                    </div>
                  ) : (
                    <div style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "3px 10px", borderRadius: 20, background: "rgba(255,255,255,0.05)",
                      border: `0.5px solid ${T.b1}`, fontSize: 11.5, color: T.t4, fontWeight: 600,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: T.t4, display: "inline-block" }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", letterSpacing: "0.03em" }}>{t.integrations.notConnected}</span>
                    </div>
                  )}
                </div>
              </div>

              <p style={{ fontSize: 14.5, color: T.t2, lineHeight: 1.7, margin: 0, maxWidth: 480 }}>
                {connected ? t.integrations.obsidianDescConnected : t.integrations.obsidianDescDisconnected}
              </p>

              {connected && obsidianKey && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <StatusCard icon={Circle} label={t.integrations.connectionState} value={t.integrations.active} tone="green" />
                  <StatusCard icon={Clock} label={t.integrations.lastUsed} value={formatDate(obsidianKey.last_used_at, t, language)} />
                  <StatusCard icon={CalendarDays} label={t.integrations.connectedSince} value={formatDate(obsidianKey.created_at, t, language)} />
                  <StatusCard icon={Shield} label={t.integrations.permissions} value={`${obsidianKey.permissions?.length ?? 0} ${t.integrations.permissionsOf}`} />
                </div>
              )}

              {connected && obsidianKey && (
                <div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                    {t.integrations.apiKey}
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap",
                    padding: "12px 16px", borderRadius: 12,
                    background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(125,211,252,0.14)",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <KeyRound size={13} style={{ color: "#7DD3FC" }} />
                      <code style={{ fontSize: 12.5, color: "#7DD3FC", fontFamily: "'JetBrains Mono', monospace" }}>
                        {obsidianKey.key_prefix}••••••••••••••••
                      </code>
                    </div>
                    <CopyBtn text={obsidianKey.key_prefix} subtle />
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
                    <button onClick={handleRegenerate} disabled={regenerating} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "10px 16px", borderRadius: 10, border: "none",
                      background: "rgba(232,0,42,0.10)", color: "#FF6B6B", fontSize: 13, fontWeight: 600,
                      cursor: regenerating ? "default" : "pointer", opacity: regenerating ? 0.7 : 1,
                    }}>
                      {regenerating ? <Loader2 size={14} className="astrocore-spin" /> : <RefreshCw size={14} />}
                      {t.integrations.regenerateKey}
                    </button>
                    <a href="/settings/developer" style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "10px 16px", borderRadius: 10, textDecoration: "none",
                      background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
                      color: T.t2, fontSize: 13, fontWeight: 500,
                    }}>
                      <Settings size={14} /> {t.integrations.changeSettings}
                    </a>
                    <button onClick={handleDisconnect} disabled={disconnecting} style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "10px 16px", borderRadius: 10, border: "none",
                      background: "transparent", color: T.t4, fontSize: 13, fontWeight: 500,
                      cursor: disconnecting ? "default" : "pointer",
                    }}>
                      {disconnecting ? <Loader2 size={14} className="astrocore-spin" /> : <Unlink size={14} />}
                      {t.integrations.disconnect}
                    </button>
                  </div>
                </div>
              )}

              {!connected && !connLoading && (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <a href="/connect/obsidian" style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "11px 20px", borderRadius: 10, textDecoration: "none",
                    background: T.red, color: "#fff", fontSize: 13.5, fontWeight: 600,
                    transition: "background 140ms ease, box-shadow 140ms ease",
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(232,0,42,0.35)" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red; (e.currentTarget as HTMLElement).style.boxShadow = "none" }}
                  >
                    <KeyRound size={14} /> {t.integrations.connectAstroCore}
                  </a>
                  <button onClick={() => setShowInstall(v => !v)} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "11px 20px", borderRadius: 10, border: `0.5px solid ${T.b1}`,
                    background: "transparent", color: T.t2, fontSize: 13.5, fontWeight: 500, cursor: "pointer",
                  }}>
                    {t.integrations.howToInstall}
                  </button>
                </div>
              )}

              {showInstall && (
                <div style={{ padding: "16px 18px", borderRadius: 12, background: "rgba(0,0,0,0.25)", border: `0.5px solid ${T.b1}` }}>
                  <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 7 }}>
                    {INSTALL_STEPS.map((s, i) => (
                      <li key={i} style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.6 }}>{s}</li>
                    ))}
                  </ol>
                </div>
              )}
            </div>

            {/* Right — capability panel with subtle red glow */}
            <div style={{
              position: "relative", padding: "36px 34px",
              borderLeft: `1px solid ${T.b1}`,
              background: "linear-gradient(160deg,rgba(232,0,42,0.05) 0%,transparent 60%)",
              display: "flex", flexDirection: "column", justifyContent: "center", gap: 24,
              overflow: "hidden",
            }}>
              <div aria-hidden style={{
                position: "absolute", top: "20%", right: "10%", width: 200, height: 200, borderRadius: "50%",
                background: "radial-gradient(circle,rgba(232,0,42,0.14) 0%,transparent 70%)",
                filter: "blur(6px)", animation: "driftGlow 10s ease-in-out infinite", pointerEvents: "none",
              }} />
              <div style={{ position: "relative", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                {t.integrations.whatObsidianCanDo}
              </div>
              <div style={{ position: "relative", display: "flex", flexDirection: "column", gap: 14 }}>
                {CAPABILITIES.map((cap, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <CheckCircle2 size={15} style={{ color: T.green, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 13, color: T.t2, lineHeight: 1.5 }}>{cap}</span>
                  </div>
                ))}
              </div>
              <div style={{ position: "relative", fontSize: 11.5, color: T.t4, marginTop: 4 }}>
                {t.integrations.endpointLabel} <code style={{ fontFamily: "'JetBrains Mono', monospace", color: "#7DD3FC" }}>{endpoint}</code>
              </div>
            </div>
          </div>

          {/* ── Success banner ── */}
          {connected && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap",
              padding: "20px 26px", borderRadius: 16, marginBottom: 48,
              background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.24)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <CheckCircle2 size={22} style={{ color: T.green, flexShrink: 0 }} />
                <div>
                  <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.integrations.integrationWorking}</div>
                  <div style={{ fontSize: 12.5, color: T.t3, marginTop: 2 }}>{t.integrations.dataExchangeSuccess}</div>
                </div>
              </div>
              <button onClick={handleCheckAgain} disabled={checking} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 16px", borderRadius: 10, border: `0.5px solid ${T.b1}`,
                background: "rgba(255,255,255,0.04)", color: T.t2, fontSize: 12.5, fontWeight: 500,
                cursor: checking ? "default" : "pointer",
              }}>
                {checking ? <Loader2 size={13} className="astrocore-spin" /> : <RefreshCw size={13} />}
                {t.integrations.checkAgain}
              </button>
            </div>
          )}

          {/* ── Marketplace ── */}
          <div id="marketplace">
            <div style={{ marginBottom: 20 }}>
              <h2 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 21, fontWeight: 600, color: T.t1, margin: 0 }}>{t.integrations.availableIntegrations}</h2>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {t.integrations.availableIntegrationsDesc}
              </p>
            </div>

            {/* Filter row — horizontal pills instead of a side column,
                so the card grid below gets the full page width. */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
              <button onClick={() => setActiveCategory(null)} style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer",
                background: activeCategory === null ? "rgba(232,0,42,0.14)" : "rgba(255,255,255,0.045)",
                color: activeCategory === null ? T.t1 : T.t3,
                fontSize: 13, fontWeight: activeCategory === null ? 600 : 400,
                transition: "background 130ms ease",
              }}>
                {t.integrations.all} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4 }}>{INTEGRATIONS.length}</span>
              </button>
              {categories.map(([cat, count]) => (
                <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 15px", borderRadius: 9, border: "none", cursor: "pointer",
                  background: activeCategory === cat ? "rgba(232,0,42,0.14)" : "rgba(255,255,255,0.045)",
                  color: activeCategory === cat ? T.t1 : T.t3,
                  fontSize: 13, fontWeight: activeCategory === cat ? 600 : 400,
                  transition: "background 130ms ease",
                }}>
                  {categoryLabels[cat]} <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4 }}>{count}</span>
                </button>
              ))}
            </div>

            <div>
              {/* Two honest groups instead of one mixed grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: 36 }}>

                {availableNow.length > 0 && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {language === "uk" ? "Доступно зараз" : "Available now"}
                      </span>
                    </div>
                    <div aria-hidden style={{
                      position: "relative", height: 1.5, marginBottom: 14, maxWidth: 340,
                      background: "rgba(34,197,94,0.08)", overflow: "hidden", borderRadius: 1,
                    }}>
                      <div className="astrocore-slow-sweep" style={{
                        position: "absolute", top: 0, left: "-25%", width: "25%", height: "100%",
                        background: "linear-gradient(90deg, transparent, #22C55E, transparent)",
                        boxShadow: "0 0 6px rgba(34,197,94,0.6)",
                      }} />
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                      {availableNow.map(item => {
                        const isObsidian = item.id === "obsidian"
                        const isConnected = isObsidian && connected
                        const Icon = item.icon

                        const card = (
                          <div className="ac-card" style={{
                            background: T.s1,
                            border: `1px solid ${isConnected ? "rgba(34,197,94,0.30)" : "rgba(232,0,42,0.30)"}`,
                            borderRadius: 14, padding: "18px 18px 20px",
                            display: "flex", flexDirection: "column", gap: 12,
                            cursor: "pointer",
                          }}
                            onMouseEnter={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.45)"
                              ;(e.currentTarget as HTMLElement).style.boxShadow = "0 12px 32px rgba(232,0,42,0.10)"
                            }}
                            onMouseLeave={e => {
                              (e.currentTarget as HTMLElement).style.borderColor = isConnected ? "rgba(34,197,94,0.30)" : "rgba(232,0,42,0.30)"
                              ;(e.currentTarget as HTMLElement).style.boxShadow = "none"
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: 10, fontSize: 19,
                                background: item.emoji ? "linear-gradient(145deg,#6C3FA0 0%,#3D2260 100%)" : `${item.color}18`,
                                border: item.emoji ? "none" : `0.5px solid ${item.color}30`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                              }}>
                                {item.emoji ?? (Icon && <Icon size={17} style={{ color: item.color }} />)}
                              </div>
                              {isConnected && (
                                <span style={{
                                  display: "flex", alignItems: "center", gap: 4,
                                  fontFamily: "'JetBrains Mono', monospace",
                                  fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                                  background: "rgba(34,197,94,0.10)", color: T.green, border: "0.5px solid rgba(34,197,94,0.28)",
                                }}>
                                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, display: "inline-block" }} />
                                  {t.integrations.connected}
                                </span>
                              )}
                            </div>
                            <div>
                              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, color: T.t1, marginBottom: 4 }}>{item.name}</div>
                              <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.5 }}>{descriptions[item.id]}</div>
                            </div>
                          </div>
                        )

                        return (
                          <a key={item.id} href="#obsidian-hero" style={{ textDecoration: "none" }}>{card}</a>
                        )
                      })}
                    </div>
                  </div>
                )}

                {comingSoon.length > 0 && (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span aria-hidden style={{ width: 6, height: 6, borderRadius: "50%", background: T.t4 }} />
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                        {language === "uk" ? "У розробці" : "In development"}
                      </span>
                    </div>
                    <div aria-hidden style={{
                      position: "relative", height: 1.5, marginBottom: 14, maxWidth: 340,
                      background: "rgba(255,255,255,0.06)", overflow: "hidden", borderRadius: 1,
                    }}>
                      <div className="astrocore-slow-sweep" style={{
                        position: "absolute", top: 0, left: "-25%", width: "25%", height: "100%",
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
                        animationDelay: "5s",
                      }} />
                    </div>
                    {/* Dashed borders reuse the same "not built yet" language
                        as the add-new tiles on Agents/Providers — a preview
                        slot, not a broken card. */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
                      {comingSoon.map(item => {
                        const Icon = item.icon
                        return (
                          <div key={item.id} style={{
                            background: "rgba(255,255,255,0.015)",
                            border: `1px dashed ${T.b2}`,
                            borderRadius: 14, padding: "18px 18px 20px",
                            display: "flex", flexDirection: "column", gap: 12,
                          }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <div style={{
                                width: 40, height: 40, borderRadius: 10,
                                background: `${item.color}12`,
                                border: `0.5px solid ${item.color}22`,
                                display: "flex", alignItems: "center", justifyContent: "center",
                                opacity: 0.75,
                              }}>
                                {Icon && <Icon size={17} style={{ color: item.color, opacity: 0.75 }} />}
                              </div>
                              <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                fontSize: 9, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                                background: "rgba(255,255,255,0.05)", color: T.t4, border: `0.5px solid ${T.b1}`,
                                textTransform: "uppercase", letterSpacing: "0.05em",
                              }}>{t.integrations.soon}</span>
                            </div>
                            <div>
                              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, color: T.t3, marginBottom: 4 }}>{item.name}</div>
                              <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.5 }}>{descriptions[item.id]}</div>
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
      </div>

      {revealKey && <RevealKeyModal fullKey={revealKey} onClose={() => setRevealKey(null)} t={t} />}
    </>
  )
}