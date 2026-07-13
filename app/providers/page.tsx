"use client"

import { useState, useEffect } from "react"
import {
  Key, Plus, Trash2, Eye, EyeOff, Check,
  Zap, Activity, Shield, ChevronDown, ChevronUp, X,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { type ProviderSlug } from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"

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

// ─── Local Provider type (from Supabase rows) ─────────────────────

type Provider = {
  id:             string
  user_id:        string
  name:           string
  slug:           ProviderSlug
  api_key:        string
  model:          string
  is_active:      boolean
  created_at:     string
  webhook_url?:   string | null
  auth_header?:   string | null
  custom_headers?: Record<string, string> | null
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: T.t1, outline: "none", width: "100%",
}

// ─── Add provider modal ───────────────────────────────────────────

function AddModal({ onClose, onAdded, t }: { onClose: () => void; onAdded: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  const PRESETS: {
    slug: ProviderSlug
    name: string
    models: string[]
    color: string
    desc: string
    placeholder: string
  }[] = [
    { slug: "openai", name: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-3.5-turbo"], color: "#10A37F", desc: t.providers.openaiDesc, placeholder: "sk-..." },
    { slug: "anthropic", name: "Anthropic Claude", models: ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5", "claude-3-5-sonnet-20241022"], color: "#D97757", desc: t.providers.anthropicDesc, placeholder: "sk-ant-..." },
    { slug: "google", name: "Google Gemini", models: ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"], color: "#4285F4", desc: t.providers.googleDesc, placeholder: "AIza..." },
    { slug: "custom", name: "Custom / Webhook", models: ["custom"], color: "#8B5CF6", desc: t.providers.customDesc, placeholder: "sk-..." },
  ]

  const [slug,    setSlug]    = useState<ProviderSlug>("openai")
  const [apiKey,  setApiKey]  = useState("")
  const [model,   setModel]   = useState(PRESETS[0].models[0])
  const [name,    setName]    = useState("")
  const [showKey, setShowKey] = useState(false)
  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const preset = PRESETS.find(p => p.slug === slug)!

  function handleSlugChange(s: ProviderSlug) {
    setSlug(s)
    setModel(PRESETS.find(p => p.slug === s)!.models[0])
    setError("")
  }

  async function handleAdd() {
    if (!apiKey.trim()) { setError(t.providers.enterApiKeyError); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.providers.notAuthorizedError); setLoading(false); return }

    const { error: dbErr } = await sb.from("providers").insert({
      user_id:   user.id,
      slug,
      name:      name.trim() || preset.name,
      api_key:   apiKey.trim(),
      model,
      is_active: true,
    })

    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    onAdded()
    onClose()
  }

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div style={{
        width: "100%", maxWidth: 520, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        padding: "24px 24px 20px",
        maxHeight: "92vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Key size={15} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.providers.connectProviderTitle}</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.providers.apiControlLayer}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
              {t.providers.providerField}
            </label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {PRESETS.map(p => (
                <button key={p.slug} onClick={() => handleSlugChange(p.slug)} style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "9px 12px", borderRadius: 9, border: "none", cursor: "pointer",
                  background: slug === p.slug ? `${p.color}18` : "rgba(255,255,255,0.03)",
                  outline: slug === p.slug ? `1px solid ${p.color}44` : "1px solid rgba(255,255,255,0.07)",
                  textAlign: "left",
                }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 12, fontWeight: slug === p.slug ? 500 : 400, color: slug === p.slug ? T.t1 : T.t3 }}>
                    {p.name}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: T.t4, marginTop: 7 }}>{preset.desc}</div>
          </div>

          {slug === "custom" && (
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                {t.providers.providerNameField}
              </label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={t.providers.providerNamePlaceholder}
                style={inp}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
              />
            </div>
          )}

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.providers.modelField}
            </label>
            <select value={model} onChange={e => setModel(e.target.value)}
              style={{ ...inp, cursor: "pointer" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}>
              {preset.models.map(m => (
                <option key={m} value={m} style={{ background: "#111118" }}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.providers.apiKeyField}
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                type={showKey ? "text" : "password"}
                placeholder={preset.placeholder}
                style={{ ...inp, paddingRight: 40 }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
              />
              <button onClick={() => setShowKey(v => !v)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0,
              }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          <div style={{
            display: "flex", alignItems: "flex-start", gap: 8,
            padding: "9px 12px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)",
          }}>
            <Shield size={12} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 11, color: T.t4, lineHeight: 1.5 }}>
              {t.providers.keysStoredNote}
            </span>
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)", color: T.t2,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
            >{t.providers.cancel}</button>
            <button onClick={handleAdd} disabled={loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: loading ? "rgba(232,0,42,0.3)" : T.red,
              border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >{loading ? t.providers.saving : t.providers.connect}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Provider card ────────────────────────────────────────────────

function ProviderCard({ provider, onDelete, onToggle, t }: {
  provider: Provider
  onDelete: () => void
  onToggle: () => void
  t: ReturnType<typeof useLanguage>["t"]
}) {
  const [showKey,  setShowKey]  = useState(false)
  const [expanded, setExpanded] = useState(false)

  const colorMap: Record<string, string> = { openai: "#10A37F", anthropic: "#D97757", google: "#4285F4", custom: "#8B5CF6" }
  const color = colorMap[provider.slug] ?? T.t4

  function maskKey(key: string) {
    if (!key) return "—"
    if (key.length <= 8) return "•".repeat(key.length)
    return key.slice(0, 6) + "•".repeat(Math.min(key.length - 8, 16)) + key.slice(-4)
  }

  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${provider.is_active ? `${color}33` : T.b1}`,
      borderRadius: 14, overflow: "hidden",
      transition: "border-color 200ms ease",
      position: "relative",
    }}>
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 2,
        background: provider.is_active
          ? `linear-gradient(90deg,transparent,${color},transparent)`
          : "transparent",
        transition: "background 300ms ease",
      }} />

      <div style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <div style={{
              width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
              background: provider.is_active ? T.green : "#2E2E4A",
              boxShadow: provider.is_active ? `0 0 8px ${T.green}80` : "none",
              transition: "background 200ms ease, box-shadow 200ms ease",
            }} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.t1 }}>{provider.name}</div>
              <div style={{ fontSize: 11, color: T.t4, marginTop: 1 }}>{provider.model}</div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 5, fontWeight: 500,
              background: provider.is_active ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
              color: provider.is_active ? T.green : T.t4,
              border: `0.5px solid ${provider.is_active ? "rgba(34,197,94,0.25)" : "rgba(255,255,255,0.08)"}`,
            }}>
              {provider.is_active ? t.providers.active : t.providers.disabled}
            </span>
            <button onClick={() => setExpanded(v => !v)} style={{
              padding: 5, borderRadius: 6, border: "none",
              background: "rgba(255,255,255,0.05)", cursor: "pointer", lineHeight: 0, color: T.t4,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
            >
              {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </button>
          </div>
        </div>

        {expanded && (
          <div style={{ borderTop: `0.5px solid ${T.b1}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 12px", borderRadius: 8,
              background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
            }}>
              <div>
                <div style={{ fontSize: 9.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{t.providers.apiKeyLabel}</div>
                <div style={{ fontSize: 12, color: T.t2, fontFamily: "monospace", letterSpacing: "0.05em" }}>
                  {showKey ? provider.api_key : maskKey(provider.api_key)}
                </div>
              </div>
              <button onClick={() => setShowKey(v => !v)} style={{
                padding: 5, borderRadius: 6, border: "none",
                background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0, color: T.t4,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
              >
                {showKey ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={onToggle} style={{
                flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: "pointer",
                background: provider.is_active ? "rgba(255,255,255,0.05)" : "rgba(34,197,94,0.10)",
                border: `0.5px solid ${provider.is_active ? "rgba(255,255,255,0.09)" : "rgba(34,197,94,0.25)"}`,
                color: provider.is_active ? T.t2 : T.green,
              }}>
                {provider.is_active ? t.providers.disable : <><Check size={12} /> {t.providers.enable}</>}
              </button>
              <button onClick={() => { if (window.confirm(`${t.providers.deleteConfirmPrefix}${provider.name}${t.providers.deleteConfirmSuffix}`)) onDelete() }}
                style={{
                  padding: "8px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                  background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)",
                  color: T.t4, display: "flex", alignItems: "center", gap: 6,
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.color = "#FF4D6A"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.25)"
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.color = T.t4
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"
                }}
              >
                <Trash2 size={12} /> {t.providers.delete}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd, t }: { onAdd: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center", width: "100%",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Key size={28} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>
        {t.providers.emptyTitle}
      </div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 360, marginBottom: 8 }}>
        {t.providers.emptyDesc}
      </div>
      <div style={{
        fontSize: 11, color: T.t4, marginBottom: 28,
        padding: "5px 12px", borderRadius: 8,
        background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.14)",
      }}>
        {t.providers.modelGateway}
      </div>
      <button onClick={onAdd} style={{
        display: "flex", alignItems: "center", gap: 7,
        background: T.red, color: "#fff", border: "none",
        borderRadius: 10, padding: "10px 22px",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
      >
        <Plus size={14} /> {t.providers.connectProvider}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const { t } = useLanguage()
  const [providers, setProviders] = useState<Provider[]>([])
  const [showModal, setShowModal] = useState(false)
  const [pulse,     setPulse]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    const sb = getSupabase()
    const { data } = await sb
      .from("providers")
      .select("*")
      .order("created_at", { ascending: true })
    if (data) setProviders(data as Provider[])
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    const sb = getSupabase()
    await sb.from("providers").delete().eq("id", id)
    load()
  }

  async function handleToggle(id: string) {
    const p = providers.find(x => x.id === id)
    if (!p) return
    const sb = getSupabase()
    await sb.from("providers").update({ is_active: !p.is_active }).eq("id", id)
    load()
  }

  const active = providers.filter(p => p.is_active)

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
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{
          position: "relative", padding: "36px 48px 28px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 120, pointerEvents: "none", background: "radial-gradient(ellipse 100% 100% at 50% 0%,rgba(232,0,42,0.055) 0%,transparent 100%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block",
                  opacity: pulse ? 1 : 0.3,
                  transition: "opacity 900ms ease, box-shadow 900ms ease",
                  boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  {active.length > 0 ? t.providers.providerGatewayActive : t.providers.noActiveProviders} · {providers.length} {t.providers.connectedSuffix}
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.providers.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {t.providers.subtitle}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {active.length > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 13px", borderRadius: 9, fontSize: 12,
                  background: "rgba(34,197,94,0.07)", border: "0.5px solid rgba(34,197,94,0.18)",
                  color: T.green,
                }}>
                  <Activity size={12} /> {active.length} {t.providers.activeSuffix}
                </div>
              )}
              <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Plus size={14} /> {t.providers.connectBtn}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        {providers.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} t={t} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1100 }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              {[
                { label: t.providers.totalProviders, value: providers.length, icon: Key      },
                { label: t.providers.activeLabel,            value: active.length,   icon: Zap      },
                { label: t.providers.disabledLabel,           value: providers.length - active.length, icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 14px", borderRadius: 9,
                  background: T.s1, border: `0.5px solid ${T.b1}`,
                }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>

            <div style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              padding: "11px 14px", borderRadius: 10, marginBottom: 20,
              background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
            }}>
              <Shield size={13} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.55 }}>
                {t.providers.securityNote}
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {providers.map(p => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  onDelete={() => handleDelete(p.id)}
                  onToggle={() => handleToggle(p.id)}
                  t={t}
                />
              ))}
            </div>

            <div onClick={() => setShowModal(true)} style={{
              marginTop: 14, borderRadius: 14, padding: "18px",
              border: "0.5px dashed rgba(232,0,42,0.22)",
              background: "rgba(232,0,42,0.03)",
              cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", gap: 8,
            }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.07)"
                ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.40)"
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.03)"
                ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.22)"
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Plus size={14} style={{ color: T.red }} />
              </div>
              <span style={{ fontSize: 12.5, color: T.t3 }}>{t.providers.connectAnother}</span>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <AddModal
          onClose={() => setShowModal(false)}
          onAdded={load}
          t={t}
        />
      )}
    </>
  )
}