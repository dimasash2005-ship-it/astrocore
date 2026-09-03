"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Key, Shield, Zap, Brain, Bot,
  BookOpen, Puzzle, Eye, EyeOff,
  Copy, Check, Plus, Trash2, Clock,
  AlertCircle, Activity, Lock, X, Loader2,
} from "lucide-react"
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
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10.5, padding: "2px 8px", borderRadius: 5,
      background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)",
      color: T.t3,
    }}>
      <Icon size={10} style={{ color: T.t4 }} />{p.label}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1800) })
    }} style={{
      padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", lineHeight: 0,
      background: "none", color: ok ? T.green : T.t4, transition: "color 120ms ease",
    }}>
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Toast({ msg, tone = "amber", onHide }: { msg: string; tone?: "amber" | "red" | "green"; onHide: () => void }) {
  useEffect(() => { const t = setTimeout(onHide, 3000); return () => clearTimeout(t) }, [onHide])
  const color = tone === "red" ? T.red : tone === "green" ? T.green : T.amber
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, display: "flex", alignItems: "center", gap: 9,
      padding: "10px 18px", borderRadius: 11,
      background: "#0F0F1E", border: `0.5px solid ${color}59`,
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      fontSize: 13, color,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      {msg}
    </div>
  )
}

// This whole page is inherently technical (keys, permissions, usage
// telemetry), so unlike Settings — which splits by section — Developer
// Center keeps the mono-caps "system register" treatment throughout,
// just formalized with the real font instead of a generic sans fallback.
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.22)" : T.b1}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {children}
    </div>
  )
}

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(4,4,10,0.72)", backdropFilter: "blur(2px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20,
      }}
    >
      <div onClick={e => e.stopPropagation()} style={{
        width: "100%", maxWidth: 440,
        background: "linear-gradient(160deg,#13131F 0%,#0E0E18 100%)",
        border: `0.5px solid ${T.b1}`, borderRadius: 16,
        boxShadow: "0 24px 64px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}>
        {children}
      </div>
    </div>
  )
}

function GenerateKeyModal({
  onClose, onCreated, t,
}: { onClose: () => void; onCreated: (fullKey: string, record: ApiKeyRecord) => void; t: ReturnType<typeof useLanguage>["t"] }) {
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
      const record: ApiKeyRecord = {
        id: created.id,
        name: created.name,
        key_prefix: created.key_prefix,
        permissions: created.permissions,
        last_used_at: null,
        revoked_at: null,
        created_at: created.created_at,
      }
      onCreated(created.key, record)
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.developer.serverError)
    } finally {
      setBusy(false)
    }
  }

  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `0.5px solid ${T.b1}` }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{t.developer.modalNewKeyTitle}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
        <label style={{ fontSize: 11.5, color: T.t3 }}>{t.developer.modalNewKeyLabel}</label>
        <input
          autoFocus
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder={t.developer.modalNewKeyPlaceholder}
          style={{
            padding: "10px 12px", borderRadius: 9, outline: "none",
            background: "rgba(0,0,0,0.3)", border: `0.5px solid ${T.b1}`,
            color: T.t1, fontSize: 13.5,
          }}
        />
        {err && <div style={{ fontSize: 12, color: T.red }}>{err}</div>}
        <button
          onClick={submit}
          disabled={busy}
          style={{
            marginTop: 6, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            padding: "10px 14px", borderRadius: 9, border: "none",
            cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
            background: "rgba(232,0,42,0.14)", color: T.red, fontSize: 13, fontWeight: 600,
          }}
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          {busy ? t.developer.modalCreating : t.developer.modalCreateBtn}
        </button>
      </div>
    </ModalShell>
  )
}

function RevealKeyModal({ fullKey, onClose, t }: { fullKey: string; onClose: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <ModalShell onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: `0.5px solid ${T.b1}` }}>
        <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14.5, fontWeight: 600, color: T.t1 }}>{t.developer.modalKeyCreatedTitle}</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
          <X size={16} />
        </button>
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{
          display: "flex", alignItems: "flex-start", gap: 10,
          padding: "11px 14px", borderRadius: 10,
          background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)",
        }}>
          <Lock size={13} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: T.t3, lineHeight: 1.55 }}>
            {t.developer.modalRevealWarningPrefix}<strong style={{ color: T.t1 }}>{t.developer.modalRevealWarningStrong}</strong>{t.developer.modalRevealWarningSuffix}
          </div>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "10px 12px", borderRadius: 9,
          background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(125,211,252,0.18)",
        }}>
          <code style={{ fontSize: 12, color: "#7DD3FC", fontFamily: "'JetBrains Mono', monospace", wordBreak: "break-all", flex: 1 }}>
            {fullKey}
          </code>
          <CopyBtn text={fullKey} />
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "10px 14px", borderRadius: 9, border: "none", cursor: "pointer",
            background: "rgba(255,255,255,0.06)", color: T.t1, fontSize: 13, fontWeight: 500,
          }}
        >
          {t.developer.modalDoneBtn}
        </button>
      </div>
    </ModalShell>
  )
}

export default function DeveloperPage() {
  const { t, language } = useLanguage()
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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0}
        }
        @keyframes spin { to { transform: rotate(360deg) } }
        .animate-spin { animation: spin 0.8s linear infinite; }
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
        <div style={{
          position: "relative", padding: "36px 48px 28px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
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

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "4px 12px 4px 10px",
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
                  Developer Center
                </span>
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9.5, padding: "2px 8px", borderRadius: 5, fontWeight: 700,
                background: "rgba(245,158,11,0.12)", color: T.amber, border: "0.5px solid rgba(245,158,11,0.28)",
              }}>BETA</span>
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
              API Keys
            </h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
              {t.developer.subtitle}
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 48px 56px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 28 }}>

          <Section title={t.developer.sectionApiKeys}>
            <Card>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.b1}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Key size={13} style={{ color: T.red, opacity: 0.75 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    {loading ? t.developer.loadingKeys : `${keys.length} ${keys.length === 1 ? t.developer.keySingular : t.developer.keyPlural}`}
                  </span>
                </div>
                <button onClick={() => setShowGenerate(true)} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "rgba(232,0,42,0.10)", color: T.red,
                  fontSize: 12.5, fontWeight: 500, transition: "background 130ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.18)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.10)" }}
                >
                  <Plus size={13} /> Generate API Key
                </button>
              </div>

              <div style={{ padding: "8px 0" }}>
                {!loading && keys.length === 0 ? (
                  <div style={{ padding: "36px 18px", textAlign: "center" }}>
                    <Key size={24} style={{ color: T.t4, opacity: 0.4, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: T.t4 }}>{t.developer.noKeysYet}</div>
                    <div style={{ fontSize: 12, color: T.t4, opacity: 0.6, marginTop: 4 }}>
                      {t.developer.noKeysHint}
                    </div>
                  </div>
                ) : keys.map(k => {
                  const isActive = !k.revoked_at
                  return (
                    <div key={k.id} style={{
                      display: "flex", alignItems: "flex-start", gap: 14,
                      padding: "14px 18px",
                      borderBottom: `0.5px solid ${T.b1}`,
                      opacity: isActive ? 1 : 0.45,
                    }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: isActive ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                        border: `0.5px solid ${isActive ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.07)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Key size={15} style={{ color: isActive ? T.green : T.t4 }} />
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 13.5, fontWeight: 600, color: T.t1 }}>{k.name}</span>
                          <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, padding: "2px 7px", borderRadius: 5, fontWeight: 600,
                            background: isActive ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                            color: isActive ? T.green : T.t4,
                            border: `0.5px solid ${isActive ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.08)"}`,
                            textTransform: "uppercase",
                          }}>
                            {isActive ? t.developer.activeLabel : t.developer.revokedLabel}
                          </span>
                        </div>

                        <div style={{
                          display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                          padding: "6px 10px", borderRadius: 7,
                          background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(125,211,252,0.12)",
                          width: "fit-content",
                        }}>
                          <code style={{ fontSize: 12, color: T.t3, fontFamily: "'JetBrains Mono', monospace" }}>
                            {maskedFromPrefix(k.key_prefix)}
                          </code>
                          <CopyBtn text={k.key_prefix} />
                        </div>

                        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4, display: "flex", alignItems: "center", gap: 4 }}>
                            <Clock size={10} /> {t.developer.createdPrefix}{formatDate(k.created_at, t, language)}
                          </span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4 }}>
                            {t.developer.lastUsedLabel}{formatDate(k.last_used_at, t, language)}
                          </span>
                        </div>

                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                          {k.permissions.map(p => <PermBadge key={p} id={p} />)}
                        </div>
                      </div>

                      {isActive && (
                        <button onClick={() => handleRevoke(k.id)} style={{
                          padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                          background: "rgba(255,255,255,0.04)", color: T.t4, fontSize: 11.5,
                          display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                          transition: "color 120ms ease, background 120ms ease",
                        }}
                          onMouseEnter={e => {
                            (e.currentTarget as HTMLElement).style.color = "#FF4D6A"
                            ;(e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)"
                          }}
                          onMouseLeave={e => {
                            (e.currentTarget as HTMLElement).style.color = T.t4
                            ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
                          }}
                        >
                          <Trash2 size={12} /> {t.developer.revokeBtn}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </Card>
          </Section>

          <Section title={t.developer.sectionPermissions}>
            <Card>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12.5, color: T.t3, marginBottom: 4, lineHeight: 1.55 }}>
                  {t.developer.permissionsDesc}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                  {PERMISSIONS.map(({ id, icon: Icon, label }) => (
                    <div key={id} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "9px 12px", borderRadius: 9,
                      background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: "rgba(232,0,42,0.09)", border: "0.5px solid rgba(232,0,42,0.20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={13} style={{ color: T.red, opacity: 0.75 }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: T.t2 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Section>

          <Section title={t.developer.sectionUsage}>
            <Card>
              <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
                {[
                  { label: t.developer.usageRequestsToday, value: "—",      icon: Activity },
                  { label: t.developer.usageRequestsMonth, value: "—",      icon: Zap      },
                  { label: t.developer.usageLastRequest,   value: t.developer.neverLabel, icon: Clock    },
                  { label: t.developer.usageCurrentPlan,   value: "Beta",   icon: Shield   },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={12} style={{ color: T.t4 }} />
                      <span style={{ fontSize: 10.5, color: T.t4 }}>{label}</span>
                    </div>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: T.t1, letterSpacing: "-0.02em" }}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          <Section title={t.developer.sectionSecurity}>
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 11,
              padding: "13px 16px", borderRadius: 11,
              background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.20)",
            }}>
              <Lock size={14} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.65 }}>
                <strong style={{ color: T.t1 }}>{t.developer.securityBold}</strong>
                {t.developer.securityRest}
              </div>
            </div>
          </Section>

        </div>
      </div>

      {showGenerate && (
        <GenerateKeyModal onClose={() => setShowGenerate(false)} onCreated={handleCreated} t={t} />
      )}
      {revealKey && (
        <RevealKeyModal fullKey={revealKey} onClose={() => setRevealKey(null)} t={t} />
      )}
      {toast && <Toast msg={toast.msg} tone={toast.tone} onHide={() => setToast(null)} />}
    </>
  )
}