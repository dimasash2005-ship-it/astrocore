"use client"

import { useState, useEffect } from "react"
import {
  Key, Plus, Trash2, Eye, EyeOff, Check,
  Zap, Activity, Shield, ChevronDown, ChevronUp, X,
  Loader2, AlertCircle, Globe,
} from "lucide-react"
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
  amber:"#F59E0B",
}

// ─── Provider shape as returned by /api/providers ──────────────────
// No secret material — api_key/encrypted_api_key/auth_header/
// custom_headers never leave the server after being saved.

type ProviderSlug = "openai" | "anthropic" | "google" | "custom"

type Provider = {
  id:          string
  name:        string
  slug:        ProviderSlug
  model:       string
  is_active:   boolean
  status:      "unverified" | "connected" | "failed"
  key_preview: string | null
  webhook_url: string | null
  created_at:  string
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: T.t1, outline: "none", width: "100%",
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)"
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"
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

  const [slug,          setSlug]          = useState<ProviderSlug>("openai")
  const [apiKey,        setApiKey]        = useState("")
  const [model,         setModel]         = useState(PRESETS[0].models[0])
  const [customModel,   setCustomModel]   = useState("")
  const [name,          setName]          = useState("")
  const [webhookUrl,    setWebhookUrl]    = useState("")
  const [authHeader,    setAuthHeader]    = useState("")
  const [customHeaders, setCustomHeaders] = useState("")
  const [showKey,       setShowKey]       = useState(false)
  const [error,         setError]         = useState("")
  const [loading,       setLoading]       = useState(false)

  const [testState, setTestState]   = useState<"idle" | "testing" | "success" | "error">("idle")
  const [testMsg,   setTestMsg]     = useState("")

  const preset = PRESETS.find(p => p.slug === slug)!
  const effectiveModel = slug === "custom" ? customModel.trim() : model

  function handleSlugChange(s: ProviderSlug) {
    setSlug(s)
    setModel(PRESETS.find(p => p.slug === s)!.models[0])
    setError("")
    setTestState("idle")
  }

  async function handleTest() {
    if (slug !== "custom") return
    if (!webhookUrl.trim() || !effectiveModel || !apiKey.trim()) {
      setTestState("error")
      setTestMsg(t.providers.testMissingFields)
      return
    }
    setTestState("testing")
    setTestMsg("")
    try {
      const res = await fetch("/api/providers/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl: webhookUrl.trim(),
          model: effectiveModel,
          apiKey: apiKey.trim(),
          customHeaders: customHeaders.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setTestState("success")
        setTestMsg(data.latencyMs ? `${t.providers.testSuccess} (${data.latencyMs}ms)` : t.providers.testSuccess)
      } else {
        setTestState("error")
        setTestMsg(data.message || t.providers.testFailed)
      }
    } catch {
      setTestState("error")
      setTestMsg(t.providers.testFailed)
    }
  }

  async function handleAdd() {
    if (!apiKey.trim()) { setError(t.providers.enterApiKeyError); return }
    if (slug === "custom" && !webhookUrl.trim()) { setError(t.providers.webhookRequiredError); return }
    if (slug === "custom" && !customModel.trim()) { setError(t.providers.modelRequiredError); return }

    setLoading(true)
    setError("")

    try {
      const res = await fetch("/api/providers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || preset.name,
          slug,
          model: effectiveModel,
          apiKey: apiKey.trim(),
          webhookUrl: slug === "custom" ? webhookUrl.trim() : undefined,
          authHeader: slug === "custom" ? authHeader.trim() || undefined : undefined,
          customHeaders: slug === "custom" ? customHeaders.trim() || undefined : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data?.error || t.providers.saveFailedError); setLoading(false); return }

      onAdded()
      onClose()
    } catch {
      setError(t.providers.saveFailedError)
      setLoading(false)
    }
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
                style={inp} onFocus={focusBorder} onBlur={blurBorder}
              />
            </div>
          )}

          {slug === "custom" ? (
            <>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {t.providers.webhookUrlField}
                </label>
                <input value={webhookUrl} onChange={e => { setWebhookUrl(e.target.value); setTestState("idle") }}
                  placeholder="https://your-agent.example.com/v1"
                  style={inp} onFocus={focusBorder} onBlur={blurBorder}
                />
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>{t.providers.webhookUrlHint}</div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {t.providers.modelField}
                </label>
                <input value={customModel} onChange={e => { setCustomModel(e.target.value); setTestState("idle") }}
                  placeholder="my-agent-v1"
                  style={inp} onFocus={focusBorder} onBlur={blurBorder}
                />
              </div>
            </>
          ) : (
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                {t.providers.modelField}
              </label>
              <select value={model} onChange={e => setModel(e.target.value)}
                style={{ ...inp, cursor: "pointer" }} onFocus={focusBorder} onBlur={blurBorder}>
                {preset.models.map(m => (
                  <option key={m} value={m} style={{ background: "#111118" }}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.providers.apiKeyField}
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setTestState("idle") }}
                type={showKey ? "text" : "password"}
                placeholder={preset.placeholder}
                style={{ ...inp, paddingRight: 40 }}
                onFocus={focusBorder} onBlur={blurBorder}
              />
              <button onClick={() => setShowKey(v => !v)} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0,
              }}>
                {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>

          {slug === "custom" && (
            <>
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {t.providers.authHeaderField}
                </label>
                <input value={authHeader} onChange={e => setAuthHeader(e.target.value)}
                  placeholder="Bearer sk-..."
                  style={inp} onFocus={focusBorder} onBlur={blurBorder}
                />
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>{t.providers.authHeaderHint}</div>
              </div>

              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {t.providers.customHeadersField}
                </label>
                <textarea value={customHeaders} onChange={e => setCustomHeaders(e.target.value)}
                  placeholder={`{\n  "X-Org-Id": "12345"\n}`}
                  rows={3}
                  style={{ ...inp, resize: "vertical", fontFamily: "monospace", lineHeight: 1.5 }}
                  onFocus={focusBorder} onBlur={blurBorder}
                />
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>{t.providers.customHeadersHint}</div>
              </div>

              <div>
                <button onClick={handleTest} disabled={testState === "testing"} style={{
                  width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  padding: "9px", borderRadius: 9, fontSize: 12.5, fontWeight: 500,
                  cursor: testState === "testing" ? "default" : "pointer",
                  background: "rgba(139,92,246,0.10)", border: "0.5px solid rgba(139,92,246,0.24)",
                  color: "#A78BFA",
                }}>
                  {testState === "testing" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Globe size={13} />}
                  {testState === "testing" ? t.providers.testing : t.providers.testConnectionBtn}
                </button>
                {testState === "success" && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.green }}>
                    <Check size={13} /> {testMsg}
                  </div>
                )}
                {testState === "error" && (
                  <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: "#FF4D6A" }}>
                    <AlertCircle size={13} /> {testMsg}
                  </div>
                )}
              </div>
            </>
          )}

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
  const [expanded, setExpanded] = useState(false)

  const colorMap: Record<string, string> = { openai: "#10A37F", anthropic: "#D97757", google: "#4285F4", custom: "#8B5CF6" }
  const color = colorMap[provider.slug] ?? T.t4

  const statusColor = provider.status === "connected" ? T.green : provider.status === "failed" ? "#FF4D6A" : T.amber
  const statusLabel = provider.status === "connected" ? t.providers.statusConnected
    : provider.status === "failed" ? t.providers.statusFailed
    : t.providers.statusUnverified

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
                  {provider.key_preview ?? "••••••••"}
                </div>
              </div>
              <span style={{
                fontSize: 10, padding: "2px 8px", borderRadius: 5, fontWeight: 500,
                color: statusColor, background: `${statusColor}18`, border: `0.5px solid ${statusColor}40`,
              }}>
                {statusLabel}
              </span>
            </div>

            {provider.slug === "custom" && provider.webhook_url && (
              <div style={{
                padding: "8px 12px", borderRadius: 8,
                background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
              }}>
                <div style={{ fontSize: 9.5, color: T.t4, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{t.providers.webhookUrlField}</div>
                <div style={{ fontSize: 11.5, color: T.t2, wordBreak: "break-all" }}>{provider.webhook_url}</div>
              </div>
            )}

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
  const [loaded,    setLoaded]    = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    try {
      const res = await fetch("/api/providers")
      const data = await res.json()
      if (res.ok) setProviders(data.providers ?? [])
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    await fetch(`/api/providers/${id}`, { method: "DELETE" })
    load()
  }

  async function handleToggle(id: string) {
    const p = providers.find(x => x.id === id)
    if (!p) return
    await fetch(`/api/providers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: !p.is_active }),
    })
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
        @keyframes spin { to { transform: rotate(360deg) } }
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
        {!loaded ? null : providers.length === 0 ? (
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