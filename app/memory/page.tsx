"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Brain, Plus, Search, Trash2, X,
  Edit3, Check, Save, Clock, Zap,
  Activity, ChevronDown, ChevronUp,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

type MemoryItem = {
  id: string
  user_id: string
  title: string
  content: string
  created_at: string
  updated_at: string
}

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

function ago(iso: string, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return t.memory.justNow
  if (m < 60) return `${m} ${t.memory.minAgo}`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.memory.hourAgo}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return t.memory.yesterday
  if (dy < 7)  return `${dy}${t.memory.daysAgo}`
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13,
  color: T.t1,
  outline: "none",
  width: "100%",
}

// ─── Modal wrapper ────────────────────────────────────────────────

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
  const [error,   setError]   = useState("")

  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!title.trim())   { setError(t.memory.enterTitleError); return }
    if (!content.trim()) { setError(t.memory.enterContentError); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.memory.notAuthorizedError); setLoading(false); return }
    const { error: dbErr } = await sb.from("memory_items").insert({
      user_id: user.id,
      title:   title.trim(),
      content: content.trim(),
    })
    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    onAdded()
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div style={{
        width: "100%", maxWidth: 500, borderRadius: 16,
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
            <Brain size={15} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.memory.newEntryTitle}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: T.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>{t.memory.layerLabel}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.memory.nameField}
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t.memory.namePlaceholder}
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.memory.contentField}
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={t.memory.contentPlaceholder}
              rows={5}
              style={{ ...inp, resize: "vertical", lineHeight: 1.65 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
            <div style={{ fontSize: 10.5, color: T.t4, marginTop: 5 }}>
              {t.memory.contentHint}
            </div>
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
            >{t.memory.cancel}</button>
            <button onClick={handleAdd} disabled={loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: loading ? "rgba(232,0,42,0.3)" : T.red, border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >{loading ? t.memory.saving : t.memory.saveToMemory}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Memory card ──────────────────────────────────────────────────

function MemoryCard({ item, onDelete, onUpdate, t, lang }: {
  item: MemoryItem
  onDelete: () => void
  onUpdate: (title: string, content: string) => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language
}) {
  const [editing,   setEditing]   = useState(false)
  const [expanded,  setExpanded]  = useState(false)
  const [title,     setTitle]     = useState(item.title)
  const [content,   setContent]   = useState(item.content)
  const [saved,     setSaved]     = useState(false)

  const isLong = item.content.length > 220

  function handleSave() {
    if (!title.trim() || !content.trim()) return
    onUpdate(title.trim(), content.trim())
    setSaved(true)
    setTimeout(() => { setSaved(false); setEditing(false) }, 1200)
  }

  function handleCancel() {
    setTitle(item.title)
    setContent(item.content)
    setEditing(false)
  }

  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${editing ? "rgba(232,0,42,0.30)" : T.b1}`,
      borderRadius: 14,
      transition: "background 150ms ease, border-color 150ms ease",
      overflow: "hidden",
      position: "relative",
    }}
      onMouseEnter={e => {
        if (editing) return
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#13132A 0%,#0F0F1E 100%)"
        el.style.borderColor = "rgba(232,0,42,0.20)"
        const act = el.querySelector(".mem-actions") as HTMLElement
        if (act) act.style.opacity = "1"
      }}
      onMouseLeave={e => {
        if (editing) return
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)"
        el.style.borderColor = T.b1
        const act = el.querySelector(".mem-actions") as HTMLElement
        if (act) act.style.opacity = "0"
      }}
    >
      {/* red left accent */}
      <div style={{
        position: "absolute", left: 0, top: 0, bottom: 0, width: 2,
        background: "linear-gradient(180deg,transparent,rgba(232,0,42,0.6),transparent)",
      }} />

      <div style={{ padding: "16px 18px 16px 22px" }}>
        {editing ? (
          /* ── Edit mode ── */
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input value={title} onChange={e => setTitle(e.target.value)}
              style={{ ...inp, fontSize: 14, fontWeight: 500 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
            <textarea value={content} onChange={e => setContent(e.target.value)}
              rows={5}
              style={{ ...inp, resize: "vertical", lineHeight: 1.65 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />

            {saved && (
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                fontSize: 12, color: "#22C55E",
                padding: "6px 10px", borderRadius: 7,
                background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.2)",
              }}>
                <Check size={12} /> {t.memory.saved}
              </div>
            )}

            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={handleCancel} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, cursor: "pointer",
                background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.09)", color: T.t2,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.07)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
              >
                {t.memory.cancel}
              </button>
              <button onClick={handleSave} style={{
                flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
                background: T.red, border: "none", color: "#fff", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Save size={12} /> {t.memory.saving.replace("...", "")}
              </button>
            </div>
          </div>
        ) : (
          /* ── View mode ── */
          <>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
                <div style={{
                  width: 26, height: 26, borderRadius: 7, flexShrink: 0,
                  background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <Brain size={12} style={{ color: T.red, opacity: 0.85 }} />
                </div>
                <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 14, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.title}
                </span>
              </div>

              {/* actions */}
              <div className="mem-actions" style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 140ms ease", flexShrink: 0 }}>
                <button onClick={() => setEditing(true)} style={{
                  padding: 5, borderRadius: 6, border: "none",
                  background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0, color: T.t4,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}>
                  <Edit3 size={12} />
                </button>
                <button onClick={() => { if (window.confirm(`${t.memory.deleteConfirmPrefix}${item.title}${t.memory.deleteConfirmSuffix}`)) onDelete() }} style={{
                  padding: 5, borderRadius: 6, border: "none",
                  background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0, color: T.t4,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}>
                  <Trash2 size={12} />
                </button>
              </div>
            </div>

            {/* content */}
            <div style={{
              fontSize: 12.5, color: T.t2, lineHeight: 1.7,
              padding: "10px 12px", borderRadius: 9,
              background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
              overflow: isLong && !expanded ? "hidden" : "visible",
              display: isLong && !expanded ? "-webkit-box" : "block",
              WebkitLineClamp: isLong && !expanded ? 4 : undefined,
              WebkitBoxOrient: isLong && !expanded ? "vertical" : undefined,
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {item.content}
            </div>

            {/* expand toggle */}
            {isLong && (
              <button onClick={() => setExpanded(e => !e)} style={{
                display: "flex", alignItems: "center", gap: 4,
                marginTop: 7, fontSize: 11, color: T.red,
                background: "none", border: "none", cursor: "pointer", opacity: 0.8,
              }}>
                {expanded ? <><ChevronUp size={12} /> {t.memory.collapse}</> : <><ChevronDown size={12} /> {t.memory.expand}</>}
              </button>
            )}

            {/* footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, padding: "2px 8px", borderRadius: 5,
                background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
                color: T.red, opacity: 0.85, textTransform: "uppercase", letterSpacing: "0.06em",
              }}>
                <Zap size={8} /> {t.memory.activeContext}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4 }}>
                <Clock size={10} />
                {ago(item.updated_at ?? item.created_at, t, lang)}
              </div>
            </div>
          </>
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
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
      width: "100%",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Brain size={30} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>
        {t.memory.emptyTitle}
      </div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 360, marginBottom: 8 }}>
        {t.memory.emptyDesc}
      </div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 10, color: T.t4, marginBottom: 28,
        padding: "5px 12px", borderRadius: 8,
        background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.14)",
        display: "inline-block",
      }}>
        {t.memory.persistentContext}
      </div>
      <button onClick={onAdd} style={{
        display: "flex", alignItems: "center", gap: 7,
        background: T.red, color: "#fff", border: "none",
        borderRadius: 10, padding: "10px 22px",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
        transition: "background 140ms ease, box-shadow 140ms ease, transform 140ms ease",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 24px rgba(232,0,42,0.35)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red; (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)" }}
      >
        <Plus size={14} /> {t.memory.addMemory}
      </button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function MemoryPage() {
  const { t, language } = useLanguage()
  const [items,     setItems]     = useState<MemoryItem[]>([])
  const [search,    setSearch]    = useState("")
  const [showModal, setShowModal] = useState(false)

  async function load() {
    const sb = getSupabase()
    const { data } = await sb
      .from("memory_items")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setItems(data as MemoryItem[])
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    const sb = getSupabase()
    await sb.from("memory_items").delete().eq("id", id)
    load()
  }

  async function handleUpdate(id: string, title: string, content: string) {
    const sb = getSupabase()
    await sb.from("memory_items").update({ title, content }).eq("id", id)
    load()
  }

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      i.content.toLowerCase().includes(q)
    )
  }, [items, search])

  const totalChars = items.reduce((s, i) => s + i.content.length, 0)

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
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
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 140, pointerEvents: "none", background: "radial-gradient(ellipse 100% 100% at 50% 0%,rgba(232,0,42,0.06) 0%,transparent 100%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              {/* status pill */}
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(232,0,42,0.09)", border: `0.5px solid ${T.bRed}`,
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
                  Memory Layer
                </span>
              </div>

              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
                {t.memory.title}
              </h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {t.memory.subtitle}
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {/* context status */}
              {items.length > 0 && (
                <div style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "7px 13px", borderRadius: 9, fontSize: 12,
                  background: "rgba(34,197,94,0.07)", border: "0.5px solid rgba(34,197,94,0.18)",
                  color: "#22C55E",
                }}>
                  <Activity size={12} />
                  {t.memory.injectedIntoAgents}
                </div>
              )}
              <button onClick={() => setShowModal(true)} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
                transition: "background 130ms ease, box-shadow 130ms ease, transform 130ms ease",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 20px rgba(232,0,42,0.35)"; (e.currentTarget as HTMLElement).style.transform = "translateY(-1px)" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red; (e.currentTarget as HTMLElement).style.boxShadow = "none"; (e.currentTarget as HTMLElement).style.transform = "translateY(0)" }}
              >
                <Plus size={14} /> {t.memory.newMemory}
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {items.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} t={t} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1100 }}>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {[
                { label: t.memory.statEntries, value: items.length,                  icon: Brain    },
                { label: t.memory.statChars, value: totalChars.toLocaleString(), icon: Zap      },
                { label: t.memory.statInjectedInto,    value: t.memory.statAllAgents,                 icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 9,
                  padding: "8px 14px", borderRadius: 9,
                  background: T.s1, border: `0.5px solid ${T.b1}`,
                }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>

            <div aria-hidden style={{
              position: "relative", height: 1.5, marginBottom: 20,
              background: "rgba(255,255,255,0.06)", overflow: "hidden", borderRadius: 1,
            }}>
              <div className="astrocore-hero-sweep" style={{
                position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
                background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
                boxShadow: "0 0 8px rgba(232,0,42,0.75)",
                animationDelay: "0.5s",
              }} />
            </div>

            {/* How it works banner */}
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              padding: "13px 16px", borderRadius: 11, marginBottom: 22,
              background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.18)",
            }}>
              <Brain size={15} style={{ color: T.red, opacity: 0.8, flexShrink: 0, marginTop: 1 }} />
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: T.red, opacity: 0.9, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                  {t.memory.howItWorksTitle}
                </div>
                <div style={{ fontSize: 12, color: T.t3, lineHeight: 1.6 }}>
                  {t.memory.howItWorksDesc}
                </div>
              </div>
            </div>

            {/* Search */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              background: T.s1, border: `0.5px solid ${T.b1}`,
              borderRadius: 11, padding: "0 14px",
              marginBottom: 20, height: 42,
            }}>
              <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t.memory.searchPlaceholder}
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }}
              />
              {search && (
                <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Results info */}
            {search && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {t.memory.foundOfPrefix}{filtered.length}{t.memory.foundOfMid}{items.length}{t.memory.foundOfSuffix}
              </div>
            )}

            {/* Memory cards */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4 }}>{t.memory.nothingFound}</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {filtered.map(item => (
                  <MemoryCard
                    key={item.id}
                    item={item}
                    onDelete={() => handleDelete(item.id)}
                    onUpdate={(title, content) => handleUpdate(item.id, title, content)}
                    t={t}
                    lang={language}
                  />
                ))}
              </div>
            )}
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