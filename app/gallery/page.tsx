"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Image as ImageIcon, Plus, Search, Trash2, X,
  Code2, FileText, Layers, Clock, Copy, Check,
  Sparkles, Download, Video, Wand2, Loader2,
  ChevronLeft, ChevronRight, ExternalLink, Play,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

type GalleryItem = {
  id: string
  user_id: string
  title: string
  content: string
  type: "text" | "code" | "image" | "video"
  tags: string[]
  created_at: string
}
import { SIDEBAR_W } from "@/components/layout/Sidebar"

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
}

type FilterType = "all" | "text" | "code" | "image" | "video"

function getTypeMeta(t: ReturnType<typeof useLanguage>["t"], lang: Language = "uk"): Record<string, { label: string; icon: React.ElementType; color: string; bg: string; border: string }> {
  return {
    text:  { label: t.gallery.typeText,  icon: FileText,  color: "#C8C4D8", bg: "rgba(255,255,255,0.06)",  border: "rgba(255,255,255,0.10)" },
    code:  { label: t.gallery.typeCode,  icon: Code2,     color: "#7DD3FC", bg: "rgba(125,211,252,0.09)",  border: "rgba(125,211,252,0.22)" },
    image: { label: t.gallery.typeImage, icon: ImageIcon, color: "#A78BFA", bg: "rgba(167,139,250,0.09)", border: "rgba(167,139,250,0.22)" },
    video: { label: lang === "uk" ? "Відео" : "Video", icon: Video, color: "#F59E0B", bg: "rgba(245,158,11,0.09)", border: "rgba(245,158,11,0.22)" },
  }
}

function ago(iso: string, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return t.gallery.justNow
  if (m < 60) return `${m} ${t.gallery.minAgo}`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.gallery.hourAgo}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return t.gallery.yesterday
  if (dy < 7)  return `${dy}${t.gallery.daysAgo}`
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })
}

// ─── Modal ────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(4,4,10,0.72)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
        animation: "galFade .18s ease-out",
      }}>
      <div style={{ width: "100%", display: "flex", justifyContent: "center", animation: "galPop .24s cubic-bezier(.2,.9,.3,1.2)" }}>
        {children}
      </div>
    </div>
  )
}

// ─── Add modal ────────────────────────────────────────────────────

function AddModal({ onClose, onAdded, t }: { onClose: () => void; onAdded: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  const [title,   setTitle]   = useState("")
  const [content, setContent] = useState("")
  const [type,    setType]    = useState<"text" | "code" | "image">("text")

  const [error,   setError]   = useState("")
  const [loading, setLoading] = useState(false)

  const TYPE_META = getTypeMeta(t)

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  async function handleAdd() {
    if (!title.trim())   { setError(t.gallery.enterTitleError); return }
    if (!content.trim()) { setError(t.gallery.enterContentError); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.gallery.notAuthorizedError); setLoading(false); return }

    const { error: dbErr } = await sb.from("gallery_items").insert({
      user_id: user.id,
      title:   title.trim(),
      content: content.trim(),
      type,
      tags:    [],
    })

    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    onAdded()
    onClose()
  }

  const contentPlaceholder = type === "code" ? t.gallery.contentPlaceholderCode
    : type === "image" ? t.gallery.contentPlaceholderImage
    : t.gallery.contentPlaceholderText

  return (
    <Modal onClose={onClose}>
      <div style={{
        width: "100%", maxWidth: 520, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        padding: "24px 24px 20px",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Sparkles size={15} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.gallery.saveOutputTitle}</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.gallery.layerLabel}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type selector */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
              {t.gallery.typeOfOutput}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["text", "code", "image"] as const).map(tp => {
                const meta = TYPE_META[tp]
                const Icon = meta.icon
                const active = type === tp
                return (
                  <button key={tp} onClick={() => setType(tp)} style={{
                    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    padding: "10px 8px", borderRadius: 9, border: "none", cursor: "pointer",
                    background: active ? meta.bg : "rgba(255,255,255,0.03)",
                    outline: active ? `1px solid ${meta.border}` : "1px solid rgba(255,255,255,0.07)",
                    transition: "background 130ms ease",
                  }}>
                    <Icon size={16} style={{ color: active ? meta.color : T.t4 }} />
                    <span style={{ fontSize: 11, color: active ? meta.color : T.t4, fontWeight: active ? 500 : 400 }}>{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{t.gallery.nameField}</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t.gallery.namePlaceholder}
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{t.gallery.contentField}</label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={contentPlaceholder}
              rows={6}
              style={{ ...inp, resize: "vertical", lineHeight: 1.6, fontFamily: type === "code" ? "monospace" : "inherit" }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
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
            >{t.gallery.cancel}</button>
            <button onClick={handleAdd} disabled={loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: loading ? "rgba(232,0,42,0.3)" : T.red, border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >{loading ? t.gallery.saving : t.gallery.save}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Generate (AI) modal ────────────────────────────────────────────
// Calls /api/generate-media (Leonardo, via lib/server/media-generation.ts),
// then inserts the result into gallery_items exactly like AddModal does —
// same table, same shape, just content = the generated URL.

type LeonardoProviderOption = { id: string; name: string }

function GenerateModal({ onClose, onAdded, t, language }: {
  onClose: () => void; onAdded: () => void
  t: ReturnType<typeof useLanguage>["t"]; language: Language
}) {
  const isUk = language === "uk"

  const [providers, setProviders]             = useState<LeonardoProviderOption[]>([])
  const [providerId, setProviderId]           = useState("")
  const [loadingProviders, setLoadingProviders] = useState(true)

  const [prompt, setPrompt]       = useState("")
  const [mediaType, setMediaType] = useState<"image" | "video">("image")
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState("")

  useEffect(() => {
    fetch("/api/providers")
      .then(res => res.json())
      .then(data => {
        const leo: LeonardoProviderOption[] = (data.providers ?? [])
          .filter((p: { slug: string }) => p.slug === "leonardo")
          .map((p: { id: string; name: string }) => ({ id: p.id, name: p.name }))
        setProviders(leo)
        if (leo.length > 0) setProviderId(leo[0].id)
      })
      .catch(() => {})
      .finally(() => setLoadingProviders(false))
  }, [])

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  async function handleGenerate() {
    if (!prompt.trim()) { setError(isUk ? "Введіть опис." : "Enter a description."); return }
    if (!providerId)    { setError(isUk ? "Немає підключеного Leonardo AI." : "No Leonardo AI provider connected."); return }

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/generate-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), mediaType, providerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Generation failed.")

      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error(isUk ? "Не авторизовано." : "Not authorized.")

      const { error: dbErr } = await sb.from("gallery_items").insert({
        user_id: user.id,
        title:   prompt.trim().slice(0, 80),
        content: data.url,
        type:    data.mediaType,
        tags:    ["ai"],
      })
      if (dbErr) throw new Error(dbErr.message)

      onAdded()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal onClose={loading ? () => {} : onClose}>
      <div style={{
        width: "100%", maxWidth: 520, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.85)",
        padding: "24px 24px 20px",
        maxHeight: "90vh", overflowY: "auto",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Wand2 size={15} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>
              {isUk ? "Згенерувати за допомогою AI" : "Generate with AI"}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: T.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Leonardo AI
            </div>
          </div>
          {!loading && (
            <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
              <X size={16} />
            </button>
          )}
        </div>

        {!loadingProviders && providers.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 14, alignItems: "flex-start" }}>
            <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.6 }}>
              {isUk
                ? "Спершу підключіть Leonardo AI як провайдера на сторінці Провайдери — там же отримаєте API-ключ."
                : "First connect Leonardo AI as a provider on the Providers page — that's where you get an API key."}
            </div>
            <a href="/providers" style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: T.red, color: "#fff", textDecoration: "none",
              borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 500,
            }}>
              {isUk ? "Перейти до провайдерів" : "Go to Providers"}
            </a>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Media type toggle */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
                {isUk ? "Тип" : "Type"}
              </label>
              <div style={{ display: "flex", gap: 8 }}>
                {([
                  { value: "image" as const, label: isUk ? "Зображення" : "Image", Icon: ImageIcon },
                  { value: "video" as const, label: isUk ? "Відео" : "Video", Icon: Video },
                ]).map(opt => {
                  const active = mediaType === opt.value
                  return (
                    <button key={opt.value} disabled={loading} onClick={() => setMediaType(opt.value)} style={{
                      flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                      padding: "10px 8px", borderRadius: 9, border: "none", cursor: loading ? "not-allowed" : "pointer",
                      background: active ? "rgba(232,0,42,0.10)" : "rgba(255,255,255,0.03)",
                      outline: active ? "1px solid rgba(232,0,42,0.30)" : "1px solid rgba(255,255,255,0.07)",
                    }}>
                      <opt.Icon size={16} style={{ color: active ? T.red : T.t4 }} />
                      <span style={{ fontSize: 11, color: active ? T.red : T.t4, fontWeight: active ? 500 : 400 }}>{opt.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Provider select — only shown if the user has more than one Leonardo provider */}
            {providers.length > 1 && (
              <div>
                <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                  {isUk ? "Провайдер" : "Provider"}
                </label>
                <select value={providerId} disabled={loading} onChange={e => setProviderId(e.target.value)} style={inp}>
                  {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}

            {/* Prompt */}
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
                {isUk ? "Опис (промпт)" : "Prompt"}
              </label>
              <textarea value={prompt} disabled={loading} onChange={e => setPrompt(e.target.value)}
                placeholder={isUk ? "Наприклад: неонове місто вночі, кіберпанк, дощ…" : "e.g. a neon city at night, cyberpunk, rain…"}
                rows={4}
                style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
              />
            </div>

            {loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: T.t3 }}>
                <Loader2 size={14} style={{ color: T.red, animation: "spin 1s linear infinite" }} />
                {mediaType === "video"
                  ? (isUk ? "Генерація відео може тривати 1–2 хвилини…" : "Video generation can take 1–2 minutes…")
                  : (isUk ? "Генерація зображення, зазвичай ~15–30 секунд…" : "Generating image, usually ~15–30 seconds…")}
              </div>
            )}

            {error && (
              <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
                {error}
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onClose} disabled={loading} style={{
                flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: loading ? "not-allowed" : "pointer",
                background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)", color: T.t2,
              }}>{t.gallery.cancel}</button>
              <button onClick={handleGenerate} disabled={loading} style={{
                flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
                background: loading ? "rgba(232,0,42,0.3)" : T.red, border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
              }}>
                {loading ? (isUk ? "Генерується…" : "Generating…") : (isUk ? "Згенерувати" : "Generate")}
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

// ─── helpers ──────────────────────────────────────────────────────

function isUrlItem(item: GalleryItem) {
  return (item.type === "image" || item.type === "video") && item.content.startsWith("http")
}

function textPreview(s: string) {
  return (s || "").replace(/[#*_`>]+/g, "").replace(/\n{2,}/g, "\n").trim()
}

function downloadItem(item: GalleryItem) {
  if (isUrlItem(item)) { window.open(item.content, "_blank", "noopener"); return }
  const ext = item.type === "code" ? "txt" : "md"
  const blob = new Blob([item.content], { type: "text/plain;charset=utf-8" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = `${(item.title || "output").replace(/[\\/:*?"<>|]+/g, "").slice(0, 60) || "output"}.${ext}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

// ─── Gallery card (compact, same style as Memory / Vault) ────────

function GalleryCard({ item, onOpen, onDelete, t, lang, index }: {
  item: GalleryItem; onOpen: () => void; onDelete: () => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language; index: number
}) {
  const [copied, setCopied] = useState(false)
  const TYPE_META = getTypeMeta(t, lang)
  const meta = TYPE_META[item.type ?? "text"] ?? TYPE_META.text
  const Icon = meta.icon
  const media = isUrlItem(item)
  const isCode = item.type === "code"

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(item.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`${t.gallery.deleteConfirmPrefix}${item.title}${t.gallery.deleteConfirmSuffix}`)) onDelete()
  }

  return (
    <div role="button" tabIndex={0} onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen() }}
      className={`gal-card${media ? " is-media" : ""}`}
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, ["--tc" as string]: meta.color } as React.CSSProperties}
    >
      {media && (
        <div className="gal-thumb">
          {item.type === "image" ? (
            <img src={item.content} alt={item.title} loading="lazy"
              onError={e => { (e.currentTarget as HTMLElement).style.display = "none" }} />
          ) : (
            <>
              <video src={item.content} muted loop playsInline preload="metadata"
                onMouseEnter={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}) }}
                onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause() }} />
              <span className="gal-play"><Play size={14} fill="currentColor" /></span>
            </>
          )}
          <span className="gal-thumb-shade" />
        </div>
      )}

      <div className="gal-body">
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          {!media && (
            <div style={{
              width: 30, height: 30, borderRadius: 9, flexShrink: 0,
              background: meta.bg, border: `0.5px solid ${meta.border}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Icon size={14} style={{ color: meta.color }} />
            </div>
          )}
          <div className="gal-title">{item.title}</div>
          <div className="gal-actions">
            <button title="Copy" onClick={handleCopy} className="gal-icon">{copied ? <Check size={12} /> : <Copy size={12} />}</button>
            <button title="Delete" onClick={handleDelete} className="gal-icon gal-icon-del"><Trash2 size={12} /></button>
          </div>
        </div>

        {!media && (
          <div className={`gal-preview${isCode ? " is-code" : ""}`}>
            {isCode ? item.content : textPreview(item.content)}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", paddingTop: 12, flexWrap: "wrap" }}>
          <span className="gal-chip" style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}>
            <Icon size={9} /> {meta.label}
          </span>
          {item.tags?.includes("ai") && <span className="gal-chip gal-chip-red"><Sparkles size={9} /> AI</span>}
          <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4 }}>
            <Clock size={10} />{ago(item.created_at, t, lang)}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Preview (lightbox) ───────────────────────────────────────────

function Preview({ item, onClose, onPrev, onNext, onDelete, t, lang, pos }: {
  item: GalleryItem; onClose: () => void; onPrev?: () => void; onNext?: () => void
  onDelete: () => void; t: ReturnType<typeof useLanguage>["t"]; lang: Language; pos: string
}) {
  const [copied, setCopied] = useState(false)
  const TYPE_META = getTypeMeta(t, lang)
  const meta = TYPE_META[item.type ?? "text"] ?? TYPE_META.text
  const Icon = meta.icon
  const media = isUrlItem(item)
  const uk = lang === "uk"

  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
      if (e.key === "ArrowLeft"  && onPrev) onPrev()
      if (e.key === "ArrowRight" && onNext) onNext()
    }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose, onPrev, onNext])

  function copy() {
    navigator.clipboard.writeText(item.content).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600) })
  }
  function del() {
    if (window.confirm(`${t.gallery.deleteConfirmPrefix}${item.title}${t.gallery.deleteConfirmSuffix}`)) onDelete()
  }

  return (
    <div className="gal-lb" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      {onPrev && <button className="gal-nav" style={{ left: 18 }} onClick={onPrev} aria-label="Previous"><ChevronLeft size={20} /></button>}
      {onNext && <button className="gal-nav" style={{ right: 18 }} onClick={onNext} aria-label="Next"><ChevronRight size={20} /></button>}

      <div className={`gal-lb-box${media ? " is-media" : ""}`} key={item.id}>
        {/* top bar */}
        <div className="gal-lb-top">
          <span className="gal-chip" style={{ color: meta.color, background: meta.bg, borderColor: meta.border }}>
            <Icon size={9} /> {meta.label}
          </span>
          <div style={{ flex: 1, minWidth: 0, fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </div>
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4 }}>{pos}</span>
          <button className="gal-btn" onClick={copy}>{copied ? <Check size={13} /> : <Copy size={13} />}<span>{copied ? (uk ? "Скопійовано" : "Copied") : (media ? (uk ? "Посилання" : "Link") : (uk ? "Копіювати" : "Copy"))}</span></button>
          <button className="gal-btn" onClick={() => downloadItem(item)}>{media ? <ExternalLink size={13} /> : <Download size={13} />}<span>{media ? (uk ? "Відкрити" : "Open") : (uk ? "Завантажити" : "Download")}</span></button>
          <button className="gal-btn gal-btn-del" onClick={del} title="Delete"><Trash2 size={13} /></button>
          <button className="gal-btn" onClick={onClose} title="Esc"><X size={14} /></button>
        </div>

        {/* content */}
        <div className="gal-lb-content">
          {media && item.type === "image" && <img src={item.content} alt={item.title} />}
          {media && item.type === "video" && <video src={item.content} controls autoPlay loop playsInline />}
          {!media && (
            <pre className={item.type === "code" ? "is-code" : ""}>{item.content}</pre>
          )}
        </div>

        <div className="gal-lb-foot">
          <Clock size={10} /> {ago(item.created_at, t, lang)}
          {!media && <span>· {item.content.length.toLocaleString(uk ? "uk-UA" : "en-US")} {uk ? "симв." : "chars"}</span>}
          <span style={{ marginLeft: "auto" }}>{uk ? "← → гортати · Esc закрити" : "← → browse · Esc close"}</span>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd, onGenerate, t, isUk }: { onAdd: () => void; onGenerate: () => void; t: ReturnType<typeof useLanguage>["t"]; isUk: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center", width: "100%" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Sparkles size={28} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.gallery.emptyTitle}</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 360, marginBottom: 28 }}>{t.gallery.emptyDesc}</div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onGenerate} className="gal-ghost"><Wand2 size={14} /> {isUk ? "Згенерувати AI" : "Generate AI"}</button>
        <button onClick={onAdd} className="gal-primary"><Plus size={14} /> {t.gallery.addOutput}</button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function GalleryPage() {
  const { t, language } = useLanguage()
  const [items,      setItems]      = useState<GalleryItem[]>([])
  const [loaded,     setLoaded]     = useState(false)
  const [search,     setSearch]     = useState("")
  const [typeFilter, setTypeFilter] = useState<FilterType>("all")
  const [showModal,  setShowModal]  = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [openId,     setOpenId]     = useState<string | null>(null)

  const isUk = language === "uk"
  const TYPE_META = getTypeMeta(t, language)

  async function load() {
    const { data } = await getSupabase().from("gallery_items").select("*").order("created_at", { ascending: false })
    if (data) setItems(data as GalleryItem[])
    setLoaded(true)
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    await getSupabase().from("gallery_items").delete().eq("id", id)
    setItems(prev => prev.filter(i => i.id !== id))
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return items.filter(item => {
      const matchSearch = !q || item.title.toLowerCase().includes(q) || item.content.toLowerCase().includes(q)
      const matchType = typeFilter === "all" || (item.type ?? "text") === typeFilter
      return matchSearch && matchType
    })
  }, [items, search, typeFilter])

  const counts = useMemo(() => ({
    all:   items.length,
    text:  items.filter(i => (i.type ?? "text") === "text").length,
    code:  items.filter(i => i.type === "code").length,
    image: items.filter(i => i.type === "image").length,
    video: items.filter(i => i.type === "video").length,
  }), [items])

  const openIdx  = openId ? filtered.findIndex(i => i.id === openId) : -1
  const openItem = openIdx >= 0 ? filtered[openIdx] : null

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes galIn  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes galFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes galPop { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }

        .gal-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(270px, 1fr)); gap: 14px; }

        .gal-card {
          position: relative; display: flex; flex-direction: column; text-align: left; cursor: pointer;
          min-height: 172px; border-radius: 14px; overflow: hidden;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: galIn .45s cubic-bezier(.2,.8,.2,1) both;
          transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s;
        }
        .gal-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px; z-index: 2;
          background: linear-gradient(180deg, transparent, var(--tc, ${T.red}), transparent); opacity: .55; transition: opacity .2s; }
        .gal-card.is-media::before { display: none; }
        .gal-card:hover { transform: translateY(-3px); border-color: rgba(232,0,42,.35);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(232,0,42,.08); }
        .gal-card:hover::before { opacity: 1; }
        .gal-card:focus-visible { outline: 2px solid ${T.red}; outline-offset: 2px; }

        .gal-thumb { position: relative; height: 170px; overflow: hidden; background: #0A0A12; }
        .gal-thumb img, .gal-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform .5s cubic-bezier(.2,.8,.2,1); }
        .gal-card:hover .gal-thumb img, .gal-card:hover .gal-thumb video { transform: scale(1.05); }
        .gal-thumb-shade { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(0deg, rgba(10,10,18,.85) 0%, transparent 55%); }
        .gal-play { position: absolute; top: 10px; left: 10px; z-index: 1; width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center;
          color: #fff; background: rgba(0,0,0,.5); border: 0.5px solid rgba(255,255,255,.2); backdrop-filter: blur(4px); pointer-events: none; }

        .gal-body { display: flex; flex-direction: column; flex: 1; padding: 14px 16px 13px; }
        .gal-card.is-media .gal-body { padding-top: 11px; }
        .gal-title { flex: 1; min-width: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1};
          line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .gal-preview { margin-top: 10px; font-size: 12.5px; line-height: 1.6; color: ${T.t3}; white-space: pre-line;
          display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .gal-preview.is-code { white-space: pre; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #7DD3FC; line-height: 1.55;
          padding: 8px 10px; border-radius: 8px; background: rgba(125,211,252,.04); border: 0.5px solid rgba(125,211,252,.10); -webkit-line-clamp: 5; }

        .gal-actions { display: flex; gap: 4px; flex-shrink: 0; opacity: 0; transition: opacity .15s; }
        .gal-card:hover .gal-actions, .gal-card:focus-within .gal-actions { opacity: 1; }
        .gal-icon { padding: 5px; border-radius: 7px; border: none; background: rgba(255,255,255,.06); color: ${T.t3}; cursor: pointer; line-height: 0; transition: color .12s, background .12s; }
        .gal-icon:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .gal-icon-del:hover { color: #FF4D6A; background: rgba(232,0,42,.12); }

        .gal-chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          padding: 2px 7px; border-radius: 5px; text-transform: uppercase; letter-spacing: .06em;
          color: ${T.t3}; background: rgba(255,255,255,.04); border: 0.5px solid ${T.b1}; flex-shrink: 0; }
        .gal-chip-red { color: ${T.red}; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.2); }

        .gal-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 172px;
          border-radius: 14px; border: 1px dashed rgba(232,0,42,.3); background: rgba(232,0,42,.03); color: ${T.t3};
          font-family: inherit; font-size: 13px; }
        .gal-new-row { display: flex; gap: 8px; }
        .gal-new-row button { display: flex; align-items: center; gap: 6px; padding: 7px 12px; border-radius: 9px; cursor: pointer; font-size: 12px; font-family: inherit;
          border: 0.5px solid rgba(232,0,42,.3); background: rgba(232,0,42,.08); color: ${T.t2}; transition: background .15s, color .15s; }
        .gal-new-row button:hover { background: ${T.red}; color: #fff; }

        .gal-primary { display: flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s, box-shadow .13s, transform .13s; }
        .gal-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .gal-ghost { display: flex; align-items: center; gap: 7px; background: rgba(232,0,42,.08); color: ${T.red}; border: 0.5px solid ${T.bRed};
          border-radius: 10px; padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s; }
        .gal-ghost:hover { background: rgba(232,0,42,.16); }

        .gal-seg { display: flex; gap: 2px; padding: 3px; border-radius: 10px; background: ${T.s1}; border: 0.5px solid ${T.b1}; flex-wrap: wrap; }
        .gal-seg button { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 7px; border: none; cursor: pointer;
          font-size: 12px; font-family: inherit; background: transparent; color: ${T.t3}; transition: background .15s, color .15s; }
        .gal-seg button:hover { color: ${T.t1}; background: rgba(255,255,255,.04); }
        .gal-seg button.on { background: rgba(232,0,42,.14); color: #fff; box-shadow: inset 0 0 0 0.5px rgba(232,0,42,.4); }
        .gal-seg b { font-family: 'JetBrains Mono', monospace; font-size: 10px; font-weight: 600; color: ${T.t4}; }
        .gal-seg button.on b { color: ${T.red}; }

        /* lightbox */
        .gal-lb { position: fixed; inset: 0; z-index: 120; display: flex; align-items: center; justify-content: center; padding: 28px 80px;
          background: rgba(4,4,10,.82); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); animation: galFade .18s ease-out; }
        .gal-lb-box { width: 100%; max-width: 900px; max-height: calc(100vh - 56px); display: flex; flex-direction: column; overflow: hidden;
          border-radius: 16px; background: linear-gradient(160deg,#111120 0%,#0B0B16 100%); border: 0.5px solid rgba(232,0,42,.25);
          box-shadow: 0 30px 90px rgba(0,0,0,.8), 0 0 60px rgba(232,0,42,.06); animation: galPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .gal-lb-box.is-media { max-width: 1200px; }
        .gal-lb-top { display: flex; align-items: center; gap: 8px; padding: 12px 14px; border-bottom: 0.5px solid ${T.b1}; }
        .gal-btn { display: flex; align-items: center; gap: 6px; height: 30px; padding: 0 10px; border-radius: 8px; cursor: pointer; font-size: 12px; font-family: inherit;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.09); color: ${T.t2}; transition: background .12s, color .12s, border-color .12s; flex-shrink: 0; }
        .gal-btn:hover { background: rgba(255,255,255,.08); color: ${T.t1}; }
        .gal-btn-del:hover { background: rgba(232,0,42,.14); border-color: rgba(232,0,42,.35); color: #FF4D6A; }
        .gal-lb-content { flex: 1; min-height: 0; overflow: auto; display: flex; align-items: flex-start; justify-content: center; }
        .gal-lb-box.is-media .gal-lb-content { align-items: center; background: #06060C; }
        .gal-lb-content img, .gal-lb-content video { max-width: 100%; max-height: calc(100vh - 170px); display: block; object-fit: contain; }
        .gal-lb-content pre { margin: 0; width: 100%; padding: 22px 26px; white-space: pre-wrap; word-break: break-word;
          font-family: inherit; font-size: 14px; line-height: 1.75; color: ${T.t2}; }
        .gal-lb-content pre.is-code { font-family: 'JetBrains Mono', monospace; font-size: 12.5px; line-height: 1.65; color: #BFE6FF; white-space: pre; background: #07070D; }
        .gal-lb-foot { display: flex; align-items: center; gap: 6px; padding: 9px 16px; border-top: 0.5px solid ${T.b1};
          font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; }
        .gal-nav { position: fixed; top: 50%; transform: translateY(-50%); z-index: 2; width: 44px; height: 44px; border-radius: 50%; cursor: pointer;
          display: grid; place-items: center; color: ${T.t2}; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.12); transition: all .15s; }
        .gal-nav:hover { background: ${T.red}; border-color: ${T.red}; color: #fff; box-shadow: 0 0 20px rgba(232,0,42,.45); }
        @media (max-width: 760px) { .gal-lb { padding: 12px; } .gal-nav { display: none; } .gal-btn span { display: none; } }
        @media (prefers-reduced-motion: reduce) { .gal-card, .gal-lb-box { animation: none; } }
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
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.09)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px", marginBottom: 14 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Output Gallery</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.gallery.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.gallery.subtitle}</p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowGenerateModal(true)} className="gal-ghost"><Wand2 size={14} /> {isUk ? "Згенерувати AI" : "Generate AI"}</button>
              <button onClick={() => setShowModal(true)} className="gal-primary"><Plus size={14} /> {t.gallery.addOutput}</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {loaded && items.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} onGenerate={() => setShowGenerateModal(true)} t={t} isUk={isUk} />
        ) : (
          <div style={{ padding: "24px 48px 56px" }}>
            {/* filters (with counts) + search in one row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <div className="gal-seg">
                {([
                  { value: "all",   label: t.gallery.filterAll, icon: Layers },
                  { value: "text",  label: t.gallery.typeText,  icon: FileText },
                  { value: "code",  label: t.gallery.typeCode,  icon: Code2 },
                  { value: "image", label: t.gallery.typeImage, icon: ImageIcon },
                  { value: "video", label: isUk ? "Відео" : "Video", icon: Video },
                ] as const).map(f => {
                  const Ico = f.icon
                  const col = f.value !== "all" ? TYPE_META[f.value].color : T.red
                  return (
                    <button key={f.value} onClick={() => setTypeFilter(f.value)} className={typeFilter === f.value ? "on" : ""}>
                      <Ico size={12} style={{ color: typeFilter === f.value ? col : undefined }} />
                      {f.label} <b>{counts[f.value]}</b>
                    </button>
                  )
                })}
              </div>

              <div style={{ flex: "1 1 240px", display: "flex", alignItems: "center", gap: 10, background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 10, padding: "0 14px", height: 38 }}>
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.gallery.searchPlaceholder}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={13} /></button>
                )}
              </div>
            </div>

            {(search || typeFilter !== "all") && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {t.gallery.foundOfPrefix}{filtered.length}{t.gallery.foundOfMid}{items.length}
                <button onClick={() => { setSearch(""); setTypeFilter("all") }} style={{ marginLeft: 10, fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer" }}>{t.gallery.clear}</button>
              </div>
            )}

            {filtered.length === 0 && (search || typeFilter !== "all") ? (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: T.t4 }}>{t.gallery.nothingFound}</div>
            ) : (
              <div className="gal-grid">
                {!search && typeFilter === "all" && (
                  <div className="gal-new">
                    <span style={{ width: 36, height: 36, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(232,0,42,.12)", color: T.red }}><Plus size={17} /></span>
                    {isUk ? "Новий результат" : "New output"}
                    <div className="gal-new-row">
                      <button onClick={() => setShowGenerateModal(true)}><Wand2 size={12} /> AI</button>
                      <button onClick={() => setShowModal(true)}><Plus size={12} /> {isUk ? "Вручну" : "Manual"}</button>
                    </div>
                  </div>
                )}
                {filtered.map((item, i) => (
                  <GalleryCard key={item.id} item={item} index={i} t={t} lang={language}
                    onOpen={() => setOpenId(item.id)}
                    onDelete={() => handleDelete(item.id)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {openItem && (
        <Preview
          item={openItem}
          t={t} lang={language}
          pos={`${openIdx + 1} / ${filtered.length}`}
          onClose={() => setOpenId(null)}
          onPrev={openIdx > 0 ? () => setOpenId(filtered[openIdx - 1].id) : undefined}
          onNext={openIdx < filtered.length - 1 ? () => setOpenId(filtered[openIdx + 1].id) : undefined}
          onDelete={() => { handleDelete(openItem.id); setOpenId(null) }}
        />
      )}

      {showModal && (
        <AddModal onClose={() => setShowModal(false)} onAdded={load} t={t} />
      )}
      {showGenerateModal && (
        <GenerateModal onClose={() => setShowGenerateModal(false)} onAdded={load} t={t} language={language} />
      )}
    </>
  )
}