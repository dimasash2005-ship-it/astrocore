"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BookOpen, Plus, Search, Trash2, X,
  Tag, Clock, Database, FileText, Zap, Copy, Check,
} from "lucide-react"
import { vaultStore, type VaultItem } from "@/lib/store"
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

function ago(iso: string): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return "щойно"
  if (m < 60) return `${m} хв тому`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} год тому`
  const dy = Math.floor(h / 24)
  if (dy === 1) return "вчора"
  if (dy < 7)  return `${dy}д тому`
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
}

function cut(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "…" : (s || "")
}

// ─── Modal ────────────────────────────────────────────────────────

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      {children}
    </div>
  )
}

// ─── Add item modal ───────────────────────────────────────────────

function AddModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [title,   setTitle]   = useState("")
  const [content, setContent] = useState("")
  const [tag,     setTag]     = useState("")
  const [tags,    setTags]    = useState<string[]>([])
  const [error,   setError]   = useState("")

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  function addTag() {
    const t = tag.trim()
    if (t && !tags.includes(t)) setTags(prev => [...prev, t])
    setTag("")
  }

  function removeTag(t: string) {
    setTags(prev => prev.filter(x => x !== t))
  }

  function handleAdd() {
    if (!title.trim())   { setError("Введіть назву запису"); return }
    if (!content.trim()) { setError("Введіть вміст запису"); return }
    vaultStore.add({ title: title.trim(), content: content.trim(), tags, source: "" })
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
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <BookOpen size={15} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>Новий запис</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Knowledge Vault</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              Назва *
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Назва знання або теми..."
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              Вміст *
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder="Текст, нотатка, відповідь AI, інформація..."
              rows={5}
              style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              Теги
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={tag} onChange={e => setTag(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                placeholder="Додати тег і натиснути Enter..."
                style={{ ...inp, flex: 1 }}
                onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
                onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
              />
              <button onClick={addTag} style={{
                padding: "9px 14px", borderRadius: 9, border: "none",
                background: "rgba(255,255,255,0.06)", cursor: "pointer", color: T.t2, fontSize: 13,
              }}>
                +
              </button>
            </div>
            {tags.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {tags.map(t => (
                  <span key={t} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, padding: "3px 9px", borderRadius: 6,
                    background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
                    color: T.t2,
                  }}>
                    #{t}
                    <button onClick={() => removeTag(t)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 0 }}>
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)",
              color: T.t2,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
            >
              Скасувати
            </button>
            <button onClick={handleAdd} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: T.red, border: "none", color: "#fff", cursor: "pointer",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              Зберегти запис
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Vault card ───────────────────────────────────────────────────

function VaultCard({ item, onDelete }: { item: VaultItem; onDelete: () => void }) {
  const [copied, setCopied] = useState(false)

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation()
    navigator.clipboard.writeText(item.content).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation()
    if (window.confirm(`Видалити "${item.title}"?`)) onDelete()
  }

  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${T.b1}`,
      borderRadius: 14, padding: "16px 18px",
      display: "flex", flexDirection: "column", gap: 11,
      transition: "background 150ms ease, border-color 150ms ease",
      position: "relative", overflow: "hidden",
    }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#14142A 0%,#0F0F1E 100%)"
        el.style.borderColor = "rgba(232,0,42,0.22)"
        const actions = el.querySelector(".vault-actions") as HTMLElement
        if (actions) actions.style.opacity = "1"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)"
        el.style.borderColor = T.b1
        const actions = el.querySelector(".vault-actions") as HTMLElement
        if (actions) actions.style.opacity = "0"
      }}
    >
      {/* subtle corner glow */}
      <div aria-hidden style={{
        position: "absolute", top: 0, left: 0, width: 80, height: 60, pointerEvents: "none",
        background: "radial-gradient(ellipse at 0% 0%,rgba(232,0,42,0.06) 0%,transparent 70%)",
      }} />

      {/* Header row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, minWidth: 0 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7, flexShrink: 0,
            background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.20)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <FileText size={13} style={{ color: T.red, opacity: 0.8 }} />
          </div>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {item.title}
          </span>
        </div>

        {/* action buttons */}
        <div className="vault-actions" style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 140ms ease", flexShrink: 0 }}>
          <button onClick={handleCopy} style={{
            padding: 5, borderRadius: 6, border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0,
            color: copied ? T.red : T.t4,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = copied ? T.red : T.t4 }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
          <button onClick={handleDelete} style={{
            padding: 5, borderRadius: 6, border: "none",
            background: "rgba(255,255,255,0.06)", cursor: "pointer", lineHeight: 0, color: T.t4,
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* Content preview */}
      <div style={{
        fontSize: 12, color: T.t3, lineHeight: 1.65,
        padding: "9px 11px", borderRadius: 8,
        background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
        overflow: "hidden",
        display: "-webkit-box",
        WebkitLineClamp: 4,
        WebkitBoxOrient: "vertical",
      }}>
        {item.content}
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        {/* Tags */}
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
          {(item.tags ?? []).slice(0, 4).map(tag => (
            <span key={tag} style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 5,
              background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
              color: T.t3,
            }}>
              #{tag}
            </span>
          ))}
          {(item.tags ?? []).length > 4 && (
            <span style={{ fontSize: 10, color: T.t4 }}>+{(item.tags ?? []).length - 4}</span>
          )}
        </div>

        {/* Time */}
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10.5, color: T.t4, flexShrink: 0 }}>
          <Clock size={10} />
          {ago(item.createdAt)}
        </div>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Database size={28} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>
        Сховище порожнє
      </div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 340, marginBottom: 28 }}>
        Зберігайте знання, відповіді AI, нотатки та будь-яку корисну інформацію.
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
        <Plus size={14} /> Додати запис
      </button>
      <div style={{ marginTop: 18, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.10em" }}>
        AI Knowledge Vault · Knowledge Base
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function VaultPage() {
  const [items,     setItems]     = useState<VaultItem[]>([])
  const [search,    setSearch]    = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [pulse,     setPulse]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  function load() { setItems(vaultStore.getAll()) }
  useEffect(() => { load() }, [])

  function handleDelete(id: string) {
    vaultStore.remove(id)
    load()
  }

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach(item => (item.tags ?? []).forEach(t => set.add(t)))
    return [...set].sort()
  }, [items])

  // Filter
  const filtered = useMemo(() => {
    return items.filter(item => {
      const matchSearch = !search ||
        item.title.toLowerCase().includes(search.toLowerCase()) ||
        item.content.toLowerCase().includes(search.toLowerCase())
      const matchTag = !activeTag || (item.tags ?? []).includes(activeTag)
      return matchSearch && matchTag
    })
  }, [items, search, activeTag])

  const totalChars = items.reduce((s, i) => s + i.content.length, 0)

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
            position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none",
            background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)",
          }} />
          <div aria-hidden style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none",
            background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)",
          }} />
          <div aria-hidden style={{
            position: "absolute", top: 0, left: "20%", right: "20%", height: 120, pointerEvents: "none",
            background: "radial-gradient(ellipse 100% 100% at 50% 0%,rgba(232,0,42,0.05) 0%,transparent 100%)",
          }} />

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
                  Knowledge Vault · {items.length} записів
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
                Сховище знань
              </h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                AI Knowledge Base · зберігайте і переглядайте знання
              </p>
            </div>
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
              <Plus size={14} /> Новий запис
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {items.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1400 }}>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              {[
                { label: "Всього записів", value: items.length,              icon: Database  },
                { label: "Унікальних тегів", value: allTags.length,         icon: Tag       },
                { label: "Символів збережено", value: totalChars.toLocaleString(), icon: Zap },
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

            {/* Search + filters */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              {/* Search */}
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                background: T.s1, border: `0.5px solid ${T.b1}`,
                borderRadius: 11, padding: "0 14px",
                height: 40, flex: "1 1 240px", minWidth: 200,
              }}>
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Пошук по назві та вмісту..."
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Tag filters */}
              {allTags.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => setActiveTag(null)}
                    style={{
                      fontSize: 11, padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer",
                      background: activeTag === null ? T.red : "rgba(255,255,255,0.05)",
                      color: activeTag === null ? "#fff" : T.t3,
                      transition: "background 130ms ease",
                    }}>
                    Всі
                  </button>
                  {allTags.map(t => (
                    <button key={t}
                      onClick={() => setActiveTag(activeTag === t ? null : t)}
                      style={{
                        fontSize: 11, padding: "5px 11px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: activeTag === t ? "rgba(232,0,42,0.18)" : "rgba(255,255,255,0.05)",
                        color: activeTag === t ? T.t1 : T.t3,
                        transition: "background 130ms ease",
                      }}>
                      #{t}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results count */}
            {(search || activeTag) && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                Знайдено {filtered.length} із {items.length} записів
                {(search || activeTag) && (
                  <button onClick={() => { setSearch(""); setActiveTag(null) }} style={{
                    marginLeft: 10, fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer",
                  }}>
                    Очистити
                  </button>
                )}
              </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4 }}>Нічого не знайдено</div>
              </div>
            ) : (
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
                gap: 14,
              }}>
                {filtered.map(item => (
                  <VaultCard
                    key={item.id}
                    item={item}
                    onDelete={() => handleDelete(item.id)}
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
          onAdded={() => { load() }}
        />
      )}
    </>
  )
}