"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Image as ImageIcon, Plus, Search, Trash2, X,
  Code2, FileText, Layers, Clock, Copy, Check,
  Sparkles, Download, Video, Wand2, Loader2,
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

function cut(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "…" : (s || "")
}

// ─── Modal ────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      {children}
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
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.gallery.saveOutputTitle}</div>
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
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>
              {isUk ? "Згенерувати за допомогою AI" : "Generate with AI"}
            </div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
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

// ─── Gallery card ─────────────────────────────────────────────────

function GalleryCard({ item, onDelete, t, lang }: {
  item: GalleryItem; onDelete: () => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language
}) {
  const [copied, setCopied] = useState(false)
  const TYPE_META = getTypeMeta(t, lang)
  const meta = TYPE_META[item.type ?? "text"] ?? TYPE_META.text
  const Icon = meta.icon

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(item.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`${t.gallery.deleteConfirmPrefix}${item.title}${t.gallery.deleteConfirmSuffix}`)) onDelete()
  }

  const isCode  = item.type === "code"
  const isImage = item.type === "image"
  const isVideo = item.type === "video"
  const isUrl   = (isImage || isVideo) && item.content.startsWith("http")

  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${T.b1}`,
      borderRadius: 14,
      display: "flex", flexDirection: "column",
      transition: "background 150ms ease, border-color 150ms ease, box-shadow 150ms ease",
      overflow: "hidden",
      position: "relative",
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#14142A 0%,#0F0F1E 100%)"
        el.style.borderColor = "rgba(232,0,42,0.22)"
        el.style.boxShadow = "0 0 24px rgba(232,0,42,0.07)"
        const act = el.querySelector(".gal-actions") as HTMLElement
        if (act) act.style.opacity = "1"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)"
        el.style.borderColor = T.b1
        el.style.boxShadow = "none"
        const act = el.querySelector(".gal-actions") as HTMLElement
        if (act) act.style.opacity = "0"
      }}
    >
      {/* image preview */}
      {isImage && isUrl && (
        <div style={{
          height: 160, overflow: "hidden", position: "relative",
          background: "rgba(255,255,255,0.02)",
        }}>
          <img src={item.content} alt={item.title}
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
            onError={e => { (e.currentTarget as HTMLElement).style.display = "none" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(0deg,rgba(8,8,15,0.6) 0%,transparent 60%)",
          }} />
        </div>
      )}

      {/* video preview — plays on hover, muted */}
      {isVideo && isUrl && (
        <div style={{
          height: 160, overflow: "hidden", position: "relative",
          background: "rgba(255,255,255,0.02)",
        }}>
          <video src={item.content} muted loop playsInline
            style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.9 }}
            onMouseEnter={e => { (e.currentTarget as HTMLVideoElement).play().catch(() => {}) }}
            onMouseLeave={e => { (e.currentTarget as HTMLVideoElement).pause() }}
            onError={e => { (e.currentTarget as HTMLElement).style.display = "none" }}
          />
          <div style={{
            position: "absolute", inset: 0,
            background: "linear-gradient(0deg,rgba(8,8,15,0.6) 0%,transparent 60%)",
            pointerEvents: "none",
          }} />
        </div>
      )}

      {/* card body */}
      <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>

        {/* header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            {/* type badge */}
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 4,
              fontSize: 10, padding: "2px 7px", borderRadius: 5, flexShrink: 0,
              background: meta.bg, border: `0.5px solid ${meta.border}`, color: meta.color,
            }}>
              <Icon size={9} />{meta.label}
            </span>
            <span style={{ fontSize: 13, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {cut(item.title, 40)}
            </span>
          </div>
          <div className="gal-actions" style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 140ms ease", flexShrink: 0 }}>
            <button onClick={handleCopy} style={{ padding: 5, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0, color: copied ? T.red : T.t4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = copied ? T.red : T.t4 }}>
              {copied ? <Check size={12} /> : <Copy size={12} />}
            </button>
            <button onClick={handleDelete} style={{ padding: 5, borderRadius: 6, border: "none", background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0, color: T.t4 }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}>
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {/* content preview (text/code, and image/video fallback when content isn't a URL) */}
        {!isImage && !isVideo && (
          <div style={{
            fontSize: isCode ? 11.5 : 12, color: isCode ? "#7DD3FC" : T.t3,
            lineHeight: 1.65, padding: "9px 11px", borderRadius: 8,
            background: isCode ? "rgba(125,211,252,0.04)" : "rgba(255,255,255,0.025)",
            border: isCode ? "0.5px solid rgba(125,211,252,0.10)" : "0.5px solid rgba(255,255,255,0.06)",
            fontFamily: isCode ? "monospace" : "inherit",
            overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 5, WebkitBoxOrient: "vertical",
          }}>
            {item.content}
          </div>
        )}

        {(isImage || isVideo) && !isUrl && (
          <div style={{
            fontSize: 12, color: T.t3, lineHeight: 1.65, padding: "9px 11px", borderRadius: 8,
            background: "rgba(167,139,250,0.04)", border: "0.5px solid rgba(167,139,250,0.10)",
            overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical",
          }}>
            {item.content}
          </div>
        )}

        {/* footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto", paddingTop: 2 }}>
          <span style={{ fontSize: 10, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.07em" }}>
            {t.gallery.aiOutputLabel}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: T.t4 }}>
            <Clock size={10} />
            {ago(item.created_at, t, lang)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd, t }: { onAdd: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
      width: "100%",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Sparkles size={28} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.gallery.emptyTitle}</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 340, marginBottom: 28 }}>
        {t.gallery.emptyDesc}
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
        <Plus size={14} /> {t.gallery.addOutput}
      </button>
      <div style={{ marginTop: 18, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.10em" }}>
        {t.gallery.savedGenerations}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function GalleryPage() {
  const { t, language } = useLanguage()
  const [items,     setItems]     = useState<GalleryItem[]>([])
  const [search,    setSearch]    = useState("")
  const [typeFilter, setTypeFilter] = useState<FilterType>("all")
  const [showModal, setShowModal] = useState(false)
  const [showGenerateModal, setShowGenerateModal] = useState(false)
  const [pulse,     setPulse]     = useState(false)

  const isUk = language === "uk"
  const TYPE_META = getTypeMeta(t, language)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    const sb = getSupabase()
    const { data } = await sb
      .from("gallery_items")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setItems(data as GalleryItem[])
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    const sb = getSupabase()
    await sb.from("gallery_items").delete().eq("id", id)
    load()
  }

  const filtered = useMemo(() => items.filter(item => {
    const matchSearch = !search ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.content.toLowerCase().includes(search.toLowerCase())
    const matchType = typeFilter === "all" || (item.type ?? "text") === typeFilter
    return matchSearch && matchType
  }), [items, search, typeFilter])

  const counts = useMemo(() => ({
    text:  items.filter(i => (i.type ?? "text") === "text").length,
    code:  items.filter(i => i.type === "code").length,
    image: items.filter(i => i.type === "image").length,
    video: items.filter(i => i.type === "video").length,
  }), [items])

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>

        {/* scan line */}
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* ── Hero ── */}
        <div style={{
          position: "relative",
          padding: "36px 48px 28px",
          borderBottom: `0.5px solid ${T.b1}`,
          overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 120, pointerEvents: "none", background: "radial-gradient(ellipse 100% 100% at 50% 0%,rgba(232,0,42,0.05) 0%,transparent 100%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.red,
                  display: "inline-block",
                  opacity: pulse ? 1 : 0.3,
                  transition: "opacity 900ms ease, box-shadow 900ms ease",
                  boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Output Gallery · {items.length} {t.gallery.outputsSuffix}
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.gallery.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {t.gallery.subtitle}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setShowGenerateModal(true)} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: "rgba(232,0,42,0.10)", color: T.red, border: `0.5px solid ${T.bRed}`,
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "background 130ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.18)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.10)" }}
              >
                <Wand2 size={14} /> {isUk ? "Згенерувати AI" : "Generate AI"}
              </button>
              <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "background 130ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Plus size={14} /> {t.gallery.addOutput}
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {items.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} t={t} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1500 }}>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              {[
                { label: t.gallery.totalOutputs, value: items.length,   icon: Layers   },
                { label: t.gallery.textsLabel,         value: counts.text,   icon: FileText },
                { label: t.gallery.codesLabel,           value: counts.code,   icon: Code2    },
                { label: t.gallery.imagesLabel,       value: counts.image,  icon: ImageIcon },
                { label: isUk ? "Відео" : "Video",       value: counts.video,  icon: Video },
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

            {/* Search + type filter */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: T.s1, border: `0.5px solid ${T.b1}`,
                borderRadius: 11, padding: "0 14px",
                height: 40, flex: "1 1 220px", minWidth: 180,
              }}>
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={t.gallery.searchPlaceholder}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Type filters */}
              <div style={{ display: "flex", gap: 6 }}>
                {([
                  { value: "all",   label: t.gallery.filterAll     },
                  { value: "text",  label: t.gallery.typeText   },
                  { value: "code",  label: t.gallery.typeCode     },
                  { value: "image", label: t.gallery.typeImage },
                  { value: "video", label: isUk ? "Відео" : "Video" },
                ] as const).map(f => {
                  const active = typeFilter === f.value
                  const meta   = f.value !== "all" ? TYPE_META[f.value] : null
                  return (
                    <button key={f.value} onClick={() => setTypeFilter(f.value)} style={{
                      fontSize: 11, padding: "5px 12px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: active
                        ? (meta ? meta.bg : T.red)
                        : "rgba(255,255,255,0.05)",
                      color: active
                        ? (meta ? meta.color : "#fff")
                        : T.t3,
                      outline: active
                        ? `1px solid ${meta ? meta.border : "rgba(232,0,42,0.35)"}`
                        : "1px solid transparent",
                      transition: "background 130ms ease",
                    }}>
                      {f.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Results info */}
            {(search || typeFilter !== "all") && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {t.gallery.foundOfPrefix}{filtered.length}{t.gallery.foundOfMid}{items.length}
                <button onClick={() => { setSearch(""); setTypeFilter("all") }} style={{
                  marginLeft: 10, fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer",
                }}>{t.gallery.clear}</button>
              </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4 }}>{t.gallery.nothingFound}</div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                gap: 14,
              }}>
                {filtered.map(item => (
                  <GalleryCard key={item.id} item={item} onDelete={() => handleDelete(item.id)} t={t} lang={language} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <AddModal onClose={() => setShowModal(false)} onAdded={load} t={t} />
      )}
      {showGenerateModal && (
        <GenerateModal onClose={() => setShowGenerateModal(false)} onAdded={load} t={t} language={language} />
      )}
    </>
  )
}