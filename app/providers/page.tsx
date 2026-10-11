"use client"

import { useState, useEffect } from "react"
import {
  Key, Plus, Trash2, Eye, EyeOff, Check,
  Shield, X, Loader2, AlertCircle, Globe, Sparkles, Bot, Webhook, Terminal, Link2, LifeBuoy,
} from "lucide-react"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import { ConnectAgentButton, AgentStatusBadge } from "@/components/agents/ConnectAgentButton"
import HelpModal from "@/components/feedback/HelpModal"

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

type ProviderSlug = "openai" | "anthropic" | "google" | "custom" | "openclaw"

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
  // OpenClaw agents only (set by connect-agent.sh register + heartbeat)
  last_seen_at?:  string | null
  agent_version?: string | null
}

// Brand-ish icon + color per provider — used for the card's identity
// chip and its ambient corner glow, so cards read as distinct
// providers at a glance instead of identical grey boxes with a name.
const BRAND: Record<ProviderSlug, { icon: React.ElementType; color: string }> = {
  openai:    { icon: Sparkles, color: "#10A37F" },
  anthropic: { icon: Bot,      color: "#D97757" },
  google:    { icon: Globe,    color: "#4285F4" },
  custom:    { icon: Webhook,  color: "#8B5CF6" },
  openclaw:  { icon: Terminal, color: "#F97316" },
}

// ─── Add provider modal ───────────────────────────────────────────

// Ready-made OpenAI-compatible services for the Custom provider: one click fills the URL
// and a suggested model (the user can change the model). Test the connection after filling.
const CUSTOM_QUICK: { name: string; url: string; model: string; keyHint: string }[] = [
  { name: "OpenRouter", url: "https://openrouter.ai/api/v1",          model: "openrouter/auto",          keyHint: "sk-or-..." },
  { name: "Groq",       url: "https://api.groq.com/openai/v1",        model: "llama-3.3-70b-versatile",  keyHint: "gsk_..." },
  { name: "DeepSeek",   url: "https://api.deepseek.com/v1",           model: "deepseek-chat",            keyHint: "sk-..." },
  { name: "Mistral",    url: "https://api.mistral.ai/v1",             model: "mistral-small-latest",     keyHint: "..." },
  { name: "Together",   url: "https://api.together.xyz/v1",           model: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyHint: "..." },
  // OpenCode Zen with a paid API key (opencode.ai/zen). Works for its chat-completions models
  // (GLM, Kimi, Qwen…). Its free tier only works inside the OpenCode app, so it can't be used here.
  { name: "OpenCode Zen", url: "https://opencode.ai/zen/v1",          model: "kimi-k2",                  keyHint: "..." },
]

function AddModal({ onClose, onAdded, onHelp, t }: { onClose: () => void; onAdded: () => void; onHelp: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  const { language } = useLanguage()
  const uk = language === "uk"
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
  const [testHint,  setTestHint]    = useState("")

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose])

  const preset = PRESETS.find(p => p.slug === slug)!
  const effectiveModel = slug === "custom" ? customModel.trim() : model

  function handleSlugChange(s: ProviderSlug) {
    setSlug(s)
    setModel(PRESETS.find(p => p.slug === s)!.models[0])
    setError("")
    setTestState("idle")
  }

  // Sends one tiny "ping" to the provider (works for every provider type) and explains
  // the result in plain words: /api/providers/check returns { ok, ms } or { ok:false, title, hint }.
  async function handleTest() {
    if (!apiKey.trim() || !effectiveModel || (slug === "custom" && !webhookUrl.trim())) {
      setTestState("error")
      setTestMsg(t.providers.testMissingFields)
      setTestHint("")
      return
    }
    setTestState("testing")
    setTestMsg("")
    setTestHint("")
    try {
      const res = await fetch("/api/providers/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          model: effectiveModel,
          apiKey: apiKey.trim(),
          webhookUrl: slug === "custom" ? webhookUrl.trim() : undefined,
          authHeader: slug === "custom" ? authHeader.trim() || undefined : undefined,
          customHeaders: slug === "custom" ? customHeaders.trim() || undefined : undefined,
        }),
      })
      const data = await res.json()
      if (data.ok) {
        setTestState("success")
        setTestMsg(data.ms ? `${t.providers.testSuccess} (${data.ms}ms)` : t.providers.testSuccess)
      } else {
        setTestState("error")
        setTestMsg(data.title || t.providers.testFailed)
        setTestHint(data.hint || "")
      }
    } catch {
      setTestState("error")
      setTestMsg(t.providers.testFailed)
    }
  }

  function applyQuick(q: typeof CUSTOM_QUICK[number]) {
    setWebhookUrl(q.url)
    setCustomModel(q.model)
    if (!name.trim() || CUSTOM_QUICK.some(x => x.name === name.trim())) setName(q.name)
    setTestState("idle")
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

      // Quick background check of the saved provider: marks it "connected" if it answers.
      if (data?.provider?.id) {
        fetch("/api/providers/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ providerId: data.provider.id }),
        }).then(() => onAdded()).catch(() => {})
      }

      onAdded()
      onClose()
    } catch {
      setError(t.providers.saveFailedError)
      setLoading(false)
    }
  }

  return (
    <div className="pv-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="pv-modal" role="dialog" aria-modal="true" aria-labelledby="pv-mt">
        {/* ── Header ── */}
        <div className="pv-mh">
          <span className="pv-mh-ic"><Key size={17} /></span>
          <div style={{ minWidth: 0 }}>
            <div id="pv-mt" className="pv-mh-t">{t.providers.connectProviderTitle}</div>
            <div className="pv-mh-s">{uk ? "Підключи свого агента або AI-модель, і вона стане його мозком" : "Connect your agent or an AI model to power it"}</div>
          </div>
          <button onClick={onClose} className="pv-x" style={{ marginLeft: "auto" }} aria-label={uk ? "Закрити" : "Close"}><X size={15} /></button>
          <span className="pv-mh-line" aria-hidden><i /></span>
        </div>

        <div className="pv-mb">
          {/* OpenClaw first: the main way to use AstroCore */}
          <div className="pv-oc">
            <span className="pv-oc-ic"><Terminal size={17} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: T.t1 }}>{uk ? "OpenClaw-агент" : "OpenClaw agent"}</span>
                <span className="pv-tag">{uk ? "Рекомендовано" : "Recommended"}</span>
              </div>
              <div style={{ fontSize: 11.5, color: T.t3, marginTop: 3, lineHeight: 1.45 }}>
                {uk ? "Твій агент з пам'яттю та інструментами. Одна команда на сервері, приблизно хвилина." : "Your agent with its memory and tools. One command on your server, about a minute."}
              </div>
            </div>
            <ConnectAgentButton variant="primary" onConnected={() => { onAdded(); onClose() }} />
          </div>

          <div className="pv-or"><span>{uk ? "або підключи модель напряму" : "or connect a model directly"}</span></div>

          <div>
            <label className="pv-label"><b className="pv-step">1</b>{t.providers.providerField}</label>
            <div className="pv-presets">
              {PRESETS.map(p => {
                const BIcon = BRAND[p.slug].icon
                return (
                  <button key={p.slug} onClick={() => handleSlugChange(p.slug)} className={`pv-preset${slug === p.slug ? " on" : ""}`}
                    style={{ ["--c" as string]: p.color } as React.CSSProperties} aria-pressed={slug === p.slug}>
                    <span className="pv-ico sm"><BIcon size={14} /></span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="pv-preset-n">{p.name}</span>
                      <span className="pv-preset-d">{p.desc}</span>
                    </span>
                    {slug === p.slug && <Check size={14} style={{ color: p.color, flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>

          <label className="pv-label" style={{ marginBottom: -6 }}><b className="pv-step">2</b>{uk ? "Налаштування" : "Settings"}</label>

          {slug === "custom" && (
            <div>
              <label className="pv-label">
                {t.providers.providerNameField}
              </label>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={t.providers.providerNamePlaceholder}
                className="pv-input"
              />
            </div>
          )}

          {slug === "custom" ? (
            <>
              <div>
                <label className="pv-label">{uk ? "Швидке заповнення" : "Quick fill"}</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {CUSTOM_QUICK.map(q => (
                    <button key={q.name} type="button" onClick={() => applyQuick(q)}
                      className={`pv-chip${webhookUrl.trim() === q.url ? " on" : ""}`}>{q.name}</button>
                  ))}
                </div>
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 6, lineHeight: 1.5 }}>
                  {uk
                    ? "Підходить будь-який OpenAI-сумісний API з власним ключем. Безкоштовні тарифи, що працюють лише у своїй програмі (наприклад, безкоштовні моделі OpenCode), не підключаються."
                    : "Any OpenAI-compatible API with your own key works. Free tiers that only work inside their own app (e.g. OpenCode free models) can't be connected."}
                </div>
              </div>

              <div>
                <label className="pv-label">
                  {t.providers.webhookUrlField}
                </label>
                <input value={webhookUrl} onChange={e => { setWebhookUrl(e.target.value); setTestState("idle") }}
                  placeholder="https://your-agent.example.com/v1"
                  className="pv-input"
                />
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>{t.providers.webhookUrlHint}</div>
              </div>

              <div>
                <label className="pv-label">
                  {t.providers.modelField}
                </label>
                <input value={customModel} onChange={e => { setCustomModel(e.target.value); setTestState("idle") }}
                  placeholder="my-agent-v1"
                  className="pv-input"
                />
              </div>
            </>
          ) : (
            <div>
              <label className="pv-label">
                {t.providers.modelField}
              </label>
              <select value={model} onChange={e => setModel(e.target.value)}
                className="pv-input" style={{ cursor: "pointer" }}>
                {preset.models.map(m => (
                  <option key={m} value={m} style={{ background: "#111118" }}>{m}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="pv-label">
              {t.providers.apiKeyField}
            </label>
            <div style={{ position: "relative" }}>
              <input
                value={apiKey}
                onChange={e => { setApiKey(e.target.value); setTestState("idle") }}
                type={showKey ? "text" : "password"}
                placeholder={preset.placeholder}
                className="pv-input" style={{ paddingRight: 40, fontFamily: "'JetBrains Mono', monospace" }}
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
                <label className="pv-label">
                  {t.providers.authHeaderField}
                </label>
                <input value={authHeader} onChange={e => setAuthHeader(e.target.value)}
                  placeholder="Bearer sk-..."
                  className="pv-input" style={{ fontFamily: "'JetBrains Mono', monospace" }}
                />
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>{t.providers.authHeaderHint}</div>
              </div>

              <div>
                <label className="pv-label">
                  {t.providers.customHeadersField}
                </label>
                <textarea value={customHeaders} onChange={e => setCustomHeaders(e.target.value)}
                  placeholder={`{\n  "X-Org-Id": "12345"\n}`}
                  rows={3}
                  className="pv-input" style={{ resize: "vertical", fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.5 }}
                />
                <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>{t.providers.customHeadersHint}</div>
              </div>

            </>
          )}

          <div>
            <label className="pv-label"><b className="pv-step">3</b>{uk ? "Перевірка (необов'язково)" : "Check (optional)"}</label>
            <button onClick={handleTest} disabled={testState === "testing"} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              padding: "9px", borderRadius: 9, fontSize: 12.5, fontWeight: 500,
              cursor: testState === "testing" ? "default" : "pointer",
              background: "rgba(139,92,246,0.10)", border: "0.5px solid rgba(139,92,246,0.24)",
              color: "#A78BFA",
            }}>
              {testState === "testing" ? <Loader2 size={13} className="pv-spin" /> : <Globe size={13} />}
              {testState === "testing" ? t.providers.testing : t.providers.testConnectionBtn}
            </button>
            {testState === "success" && (
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 7, fontSize: 12, color: T.green }}>
                <Check size={13} /> {testMsg}
              </div>
            )}
            {testState === "error" && (
              <div style={{ marginTop: 8, padding: "9px 11px", borderRadius: 9, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.22)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, color: "#FF4D6A" }}>
                  <AlertCircle size={13} style={{ flexShrink: 0 }} /> {testMsg}
                </div>
                {testHint && <div style={{ fontSize: 11.5, color: T.t2, marginTop: 5, lineHeight: 1.5 }}>{testHint}</div>}
              </div>
            )}
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

        </div>

        {/* ── Footer ── */}
        <div className="pv-mf">
          <button type="button" className="pv-help" onClick={onHelp}>
            <LifeBuoy size={14} />
            <span>{uk ? "Не виходить? Напиши нам" : "Stuck? Message us"}</span>
          </button>
          <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
            <button onClick={onClose} className="pv-btn" style={{ height: 38, padding: "0 16px" }}>{t.providers.cancel}</button>
            <button onClick={handleAdd} disabled={loading} className="pv-primary" style={{ justifyContent: "center", minWidth: 150 }}>
              {loading ? <Loader2 size={14} className="pv-spin" /> : <Link2 size={14} />} {loading ? t.providers.saving : t.providers.connect}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Provider card ────────────────────────────────────────────────

function ProviderCard({ provider, onDelete, onToggle, t, index }: {
  provider: Provider
  onDelete: () => void
  onToggle: () => void
  t: ReturnType<typeof useLanguage>["t"]
  index: number
}) {
  const brand = BRAND[provider.slug] ?? BRAND.custom
  const color = brand.color
  const Icon = brand.icon
  const [busy, setBusy] = useState(false)

  const statusColor = provider.status === "connected" ? T.green : provider.status === "failed" ? "#FF4D6A" : T.amber
  const statusLabel = provider.status === "connected" ? t.providers.statusConnected
    : provider.status === "failed" ? t.providers.statusFailed
    : t.providers.statusUnverified

  async function toggle() {
    setBusy(true)
    try { await onToggle() } finally { setBusy(false) }
  }

  return (
    <div className={`pv-card${provider.is_active ? " on" : ""}`}
      style={{ ["--c" as string]: color, animationDelay: `${Math.min(index, 10) * 45}ms` } as React.CSSProperties}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span className="pv-ico"><Icon size={17} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="pv-name">{provider.name}</div>
          {provider.slug === "openclaw" ? (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
              <AgentStatusBadge lastSeenAt={provider.last_seen_at} />
              {provider.agent_version && <span className="pv-mono">v{provider.agent_version}</span>}
            </div>
          ) : (
            <div className="pv-mono" style={{ marginTop: 2 }}>{provider.model}</div>
          )}
        </div>
        <button className={`pv-switch${provider.is_active ? " on" : ""}`} onClick={toggle} disabled={busy}
          title={provider.is_active ? t.providers.disable : t.providers.enable} aria-pressed={provider.is_active}>
          <i>{busy && <Loader2 size={10} className="pv-spin" />}</i>
        </button>
      </div>

      <div className="pv-keyrow">
        <Key size={12} style={{ color: T.t4, flexShrink: 0 }} />
        <span className="pv-key">{provider.key_preview ?? "••••••••"}</span>
        <span className="pv-status" style={{ color: statusColor, background: `${statusColor}14`, borderColor: `${statusColor}40` }}>
          <span className={provider.status === "connected" && provider.is_active ? "pv-live" : ""} style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor }} />
          {statusLabel}
        </span>
      </div>

      {(provider.slug === "custom" || provider.slug === "openclaw") && provider.webhook_url && (
        <div className="pv-url" title={provider.webhook_url}>
          <Globe size={11} style={{ flexShrink: 0 }} />
          <span>{provider.webhook_url}</span>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", marginTop: "auto", paddingTop: 2 }}>
        <span style={{ fontSize: 11.5, color: provider.is_active ? T.green : T.t4, display: "flex", alignItems: "center", gap: 6 }}>
          {provider.is_active ? t.providers.active : t.providers.disabled}
        </span>
        <button className="pv-del"
          onClick={() => { if (window.confirm(`${t.providers.deleteConfirmPrefix}${provider.name}${t.providers.deleteConfirmSuffix}`)) onDelete() }}>
          <Trash2 size={12} /> {t.providers.delete}
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ProvidersPage() {
  const { t } = useLanguage()
  const [providers, setProviders] = useState<Provider[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loaded,    setLoaded]    = useState(false)
  const [help,      setHelp]      = useState(false)

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
    setProviders(prev => prev.filter(p => p.id !== id))
    await fetch(`/api/providers/${id}`, { method: "DELETE" })
    load()
  }

  async function handleToggle(id: string) {
    const p = providers.find(x => x.id === id)
    if (!p) return
    setProviders(prev => prev.map(x => x.id === id ? { ...x, is_active: !x.is_active } : x))
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
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        @keyframes spin { to { transform: rotate(360deg) } }
        .pv-spin { animation: spin .8s linear infinite; }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes pvIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes pvFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pvPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes pvPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
        @keyframes pvShimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }
        @keyframes pvTop { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }

        .pv-primary { display: inline-flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
        .pv-primary:hover:not(:disabled) { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .pv-primary:disabled { opacity: .6; cursor: default; }
        .pv-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 0 12px; border-radius: 9px; cursor: pointer;
          font-size: 13px; font-family: inherit; background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t2}; transition: all .15s; }
        .pv-btn:hover { background: rgba(255,255,255,.09); color: ${T.t1}; }

        .pv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 14px; }

        .pv-card { position: relative; display: flex; flex-direction: column; gap: 12px; padding: 16px; border-radius: 14px; overflow: hidden; min-height: 170px;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: pvIn .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .25s, box-shadow .25s, opacity .25s; }
        .pv-card::before { content: ""; position: absolute; top: 0; left: 0; right: 0; height: 2px; opacity: 0; transition: opacity .3s;
          background: linear-gradient(90deg, transparent, var(--c), transparent); background-size: 200% 100%; animation: pvTop 4s linear infinite; }
        .pv-card::after { content: ""; position: absolute; right: -40px; top: -40px; width: 140px; height: 140px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(closest-side, var(--c), transparent); opacity: .05; transition: opacity .3s; }
        .pv-card.on { border-color: color-mix(in srgb, var(--c) 32%, transparent); }
        .pv-card.on::before { opacity: 1; }
        .pv-card.on::after { opacity: .14; }
        .pv-card:not(.on) .pv-ico, .pv-card:not(.on) .pv-name { opacity: .6; }
        .pv-card:hover { transform: translateY(-3px); box-shadow: 0 14px 34px rgba(0,0,0,.45); }

        .pv-ico { width: 40px; height: 40px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0; color: var(--c); transition: opacity .25s;
          background: color-mix(in srgb, var(--c) 13%, transparent); border: 0.5px solid color-mix(in srgb, var(--c) 35%, transparent); }
        .pv-ico.sm { width: 26px; height: 26px; border-radius: 8px; }
        .pv-name { font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: ${T.t1}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; transition: opacity .25s; }
        .pv-mono { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: ${T.t4}; }

        .pv-switch { position: relative; width: 38px; height: 22px; border-radius: 11px; border: 0.5px solid rgba(255,255,255,.14); cursor: pointer; flex-shrink: 0;
          background: rgba(255,255,255,.08); transition: background .2s, border-color .2s, box-shadow .2s; padding: 0; }
        .pv-switch i { position: absolute; top: 2px; left: 2px; width: 17px; height: 17px; border-radius: 50%; background: #C8C4D8; display: grid; place-items: center; color: #111;
          transition: transform .22s cubic-bezier(.3,1.4,.5,1), background .2s; box-shadow: 0 2px 6px rgba(0,0,0,.4); }
        .pv-switch.on { background: ${T.green}; border-color: ${T.green}; box-shadow: 0 0 14px rgba(34,197,94,.35); }
        .pv-switch.on i { transform: translateX(16px); background: #fff; }
        .pv-switch:disabled { cursor: default; }

        .pv-keyrow { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: 9px; background: #07070D; border: 0.5px solid rgba(255,255,255,.07); }
        .pv-key { flex: 1; min-width: 0; font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: ${T.t2}; letter-spacing: .04em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pv-status { display: inline-flex; align-items: center; gap: 5px; font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600;
          padding: 2px 7px; border-radius: 5px; border: 0.5px solid; text-transform: uppercase; letter-spacing: .05em; flex-shrink: 0; }
        .pv-live { animation: pvPulse 2s infinite; }
        .pv-url { display: flex; align-items: center; gap: 7px; font-family: 'JetBrains Mono', monospace; font-size: 10.5px; color: ${T.t4}; min-width: 0; }
        .pv-url span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pv-del { margin-left: auto; display: inline-flex; align-items: center; gap: 5px; height: 26px; padding: 0 9px; border-radius: 7px; cursor: pointer;
          font-size: 11px; font-family: inherit; background: transparent; border: 0.5px solid transparent; color: ${T.t4}; opacity: 0; transition: all .15s; }
        .pv-card:hover .pv-del, .pv-card:focus-within .pv-del { opacity: 1; }
        .pv-del:hover { color: #FF4D6A; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.25); }

        .pv-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 170px; border-radius: 14px; cursor: pointer;
          border: 1px dashed rgba(255,255,255,.12); background: transparent; color: ${T.t4}; font-family: inherit; font-size: 12.5px; transition: all .2s; }
        .pv-new:hover { border-color: rgba(232,0,42,.45); background: rgba(232,0,42,.04); color: ${T.t1}; }
        .pv-new i { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; background: rgba(232,0,42,.10); color: ${T.red}; transition: transform .2s; }
        .pv-new:hover i { transform: rotate(90deg); }

        .pv-skel { height: 170px; border-radius: 14px; border: 0.5px solid ${T.b1};
          background: linear-gradient(90deg, #0F0F19 0px, #16162A 200px, #0F0F19 400px); background-size: 800px 100%; animation: pvShimmer 1.4s linear infinite; }

        /* modal */
        .pv-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: pvFade .18s ease-out; }
        .pv-modal { width: 100%; max-width: 600px; max-height: 92vh; display: flex; flex-direction: column; overflow: hidden; border-radius: 18px;
          background: linear-gradient(160deg,#111120 0%,#0C0C18 100%); border: 0.5px solid rgba(232,0,42,.28);
          box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 60px rgba(232,0,42,.08); animation: pvPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .pv-mh { position: relative; display: flex; align-items: center; gap: 12px; padding: 18px 20px 16px; flex-shrink: 0;
          background: radial-gradient(ellipse 70% 120% at 0% 0%, rgba(232,0,42,.10), transparent 70%); border-bottom: 0.5px solid ${T.b1}; }
        .pv-mh-ic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; color: #fff;
          background: linear-gradient(135deg, #E8002A, #8A0019); box-shadow: 0 0 18px rgba(232,0,42,.4), inset 0 1px 0 rgba(255,255,255,.18); }
        .pv-mh-t { font-family: 'Space Grotesk', sans-serif; font-size: 17px; font-weight: 600; color: ${T.t1}; letter-spacing: -.01em; }
        .pv-mh-s { font-size: 12px; color: ${T.t3}; margin-top: 2px; }
        .pv-mh-line { position: absolute; left: 0; right: 0; bottom: -1px; height: 1px; overflow: hidden; }
        .pv-mh-line i { position: absolute; top: 0; left: 0; width: 30%; height: 100%; background: linear-gradient(90deg, transparent, ${T.red}, transparent);
          animation: pvSweep 3.2s linear infinite; }
        @keyframes pvSweep { from { transform: translateX(-100%); } to { transform: translateX(340%); } }
        .pv-mb { flex: 1; overflow-y: auto; padding: 18px 20px 20px; display: flex; flex-direction: column; gap: 16px; }
        .pv-mb > * { flex-shrink: 0; }
        .pv-mf { flex-shrink: 0; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 20px; border-top: 0.5px solid ${T.b1}; background: rgba(6,6,12,.6); }
        .pv-help { display: inline-flex; align-items: center; gap: 7px; padding: 7px 10px; border-radius: 9px; cursor: pointer; font-family: inherit; font-size: 12.5px;
          color: #FF7A8F; background: transparent; border: 0.5px solid transparent; transition: all .15s; }
        .pv-help:hover { background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.25); color: #fff; }
        .pv-step { display: inline-grid; place-items: center; width: 16px; height: 16px; margin-right: 7px; border-radius: 5px; font-size: 9.5px;
          color: #fff; background: rgba(232,0,42,.8); vertical-align: 1px; }
        .pv-or { display: flex; align-items: center; gap: 10px; font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; color: ${T.t4}; }
        .pv-or::before, .pv-or::after { content: ""; flex: 1; height: 0.5px; background: rgba(255,255,255,.10); }
        .pv-presets { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .pv-x { background: rgba(255,255,255,.04); border: none; cursor: pointer; color: ${T.t4}; line-height: 0; padding: 6px; border-radius: 8px; }
        .pv-x:hover { color: ${T.t1}; background: rgba(255,255,255,.08); }
        .pv-label { display: block; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; font-weight: 600; color: ${T.t4}; text-transform: uppercase; letter-spacing: .07em; margin-bottom: 7px; }
        .pv-input { width: 100%; padding: 10px 12px; border-radius: 10px; outline: none; font-size: 13px; font-family: inherit; color: ${T.t1};
          background: #07070D; border: 0.5px solid ${T.b1}; transition: border-color .15s, box-shadow .15s; }
        .pv-input:focus { border-color: rgba(232,0,42,.5); box-shadow: 0 0 0 3px rgba(232,0,42,.12); }
        .pv-input option { background: #111118; }
        .pv-preset { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 11px 10px 13px; border-radius: 12px; cursor: pointer; text-align: left;
          font-size: 13px; font-family: inherit; overflow: hidden;
          background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); color: ${T.t3}; transition: all .15s; }
        .pv-preset::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 2px; border-radius: 0 2px 2px 0; background: var(--c); opacity: 0; transition: opacity .15s; }
        .pv-preset.on::before { opacity: 1; }
        .pv-preset-n { display: block; font-weight: 600; color: ${T.t1}; }
        .pv-preset-d { display: block; font-size: 10.5px; color: ${T.t4}; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pv-preset:hover { border-color: color-mix(in srgb, var(--c) 40%, transparent); color: ${T.t1}; }
        .pv-preset.on { background: color-mix(in srgb, var(--c) 12%, transparent); border-color: color-mix(in srgb, var(--c) 55%, transparent); color: ${T.t1}; font-weight: 500;
          box-shadow: 0 0 18px color-mix(in srgb, var(--c) 15%, transparent); }
        .pv-oc { position: relative; display: flex; align-items: center; gap: 12px; padding: 14px 14px 14px 16px; border-radius: 14px; overflow: hidden;
          background: linear-gradient(120deg, rgba(249,115,22,.12), rgba(249,115,22,.02) 60%), #0E0E18; border: 0.5px solid rgba(249,115,22,.38); }
        .pv-oc::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; background: #F97316; box-shadow: 0 0 12px rgba(249,115,22,.7); }
        .pv-oc::after { content: ""; position: absolute; right: -40px; top: -40px; width: 130px; height: 130px; border-radius: 50%; pointer-events: none;
          background: radial-gradient(closest-side, rgba(249,115,22,.22), transparent); }
        .pv-oc > * { position: relative; z-index: 1; }
        .pv-oc button { flex-shrink: 0; }
        .pv-oc-ic { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; flex-shrink: 0; color: #FDBA74;
          background: rgba(249,115,22,.14); border: 0.5px solid rgba(249,115,22,.4); }
        .pv-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 5px; color: #FDBA74; background: rgba(249,115,22,.12); border: 0.5px solid rgba(249,115,22,.4); }
        .pv-chip { padding: 5px 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.10); color: ${T.t2}; transition: all .15s; }
        .pv-chip:hover { border-color: rgba(139,92,246,.5); color: ${T.t1}; }
        .pv-chip.on { background: rgba(139,92,246,.14); border-color: rgba(139,92,246,.6); color: ${T.t1}; }
        @media (max-width: 520px) {
          .pv-oc { flex-wrap: wrap; } .pv-oc button { width: 100%; justify-content: center; }
          .pv-presets { grid-template-columns: 1fr; }
          .pv-mf > div { width: 100%; } .pv-mf .pv-primary { flex: 1; }
        }
        @media (prefers-reduced-motion: reduce) { .pv-mh-line i { animation: none; } }
        @media (prefers-reduced-motion: reduce) { .pv-card, .pv-card::before, .pv-modal { animation: none; } }
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
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Provider Gateway</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.providers.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {loaded && providers.length > 0 ? (
                  <>
                    <span style={{ color: T.green }}>● {active.length} {t.providers.activeSuffix}</span>
                    <span style={{ color: T.t4 }}> · {providers.length - active.length} {t.providers.disabledLabel.toLowerCase()} · </span>
                    {t.providers.subtitle}
                  </>
                ) : t.providers.subtitle}
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <ConnectAgentButton variant="secondary" onConnected={load} />
              <button onClick={() => setShowModal(true)} className="pv-primary"><Plus size={14} /> {t.providers.connectBtn}</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {!loaded ? (
          <div style={{ padding: "26px 48px" }}>
            <div className="pv-grid"><div className="pv-skel" /><div className="pv-skel" /><div className="pv-skel" /></div>
          </div>
        ) : providers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center" }}>
            <div style={{ display: "flex", gap: 10, marginBottom: 22 }}>
              {(["openai", "anthropic", "google", "openclaw"] as ProviderSlug[]).map((s, i) => {
                const B = BRAND[s]; const BI = B.icon
                return (
                  <span key={s} className="pv-ico" style={{ ["--c" as string]: B.color, animation: `pvIn .5s ease ${i * 80}ms both`, width: 48, height: 48, borderRadius: 14 } as React.CSSProperties}>
                    <BI size={20} />
                  </span>
                )
              })}
            </div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.providers.emptyTitle}</div>
            <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 380, marginBottom: 24 }}>{t.providers.emptyDesc}</div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
              <button onClick={() => setShowModal(true)} className="pv-primary"><Plus size={14} /> {t.providers.connectProvider}</button>
              <ConnectAgentButton variant="secondary" onConnected={load} />
            </div>
          </div>
        ) : (
          <div style={{ padding: "26px 48px 60px" }}>
            <div className="pv-grid">
              {providers.map((p, i) => (
                <ProviderCard key={p.id} index={i} provider={p} t={t}
                  onDelete={() => handleDelete(p.id)}
                  onToggle={() => handleToggle(p.id)} />
              ))}
              <button className="pv-new" onClick={() => setShowModal(true)}>
                <i><Plus size={16} /></i>{t.providers.connectAnother}
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "flex-start", gap: 9, marginTop: 20, fontSize: 11.5, color: T.t4, lineHeight: 1.55, maxWidth: 760 }}>
              <Shield size={13} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{t.providers.securityNote}</span>
            </div>
          </div>
        )}
      </div>

      {showModal && <AddModal onClose={() => setShowModal(false)} onAdded={load} onHelp={() => setHelp(true)} t={t} />}
      <HelpModal open={help} onClose={() => setHelp(false)} />
    </>
  )
}