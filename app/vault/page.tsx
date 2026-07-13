"use client"

import { useState, useEffect, useMemo } from "react"
import {
  BookOpen, Plus, Search, Trash2, X,
  Tag, Clock, Database, FileText, Zap, Copy, Check,
  Download, Send, Loader2, ExternalLink,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { getStoredVaultName, setStoredVaultName, openInObsidian } from "@/lib/obsidian-uri"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

type VaultItem = {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[]
  source: string
  created_at: string
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
  green:"#22C55E",
}

function ago(iso: string, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return t.vault.justNow
  if (m < 60) return `${m} ${t.vault.minAgo}`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.vault.hourAgo}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return t.vault.yesterday
  if (dy < 7)  return `${dy}${t.vault.daysAgo}`
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })
}

function formatFullDate(iso: string, lang: Language): string {
  if (!iso) return ""
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

function cut(s: string, n: number) {
  return s && s.length > n ? s.slice(0, n) + "…" : (s || "")
}

function sanitizeFilename(name: string): string {
  return (name || "vault-item").replace(/[\\/:*?"<>|]/g, "-").trim() || "vault-item"
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

function AddModal({ onClose, onAdded, t }: { onClose: () => void; onAdded: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
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
    const tg = tag.trim()
    if (tg && !tags.includes(tg)) setTags(prev => [...prev, tg])
    setTag("")
  }

  function removeTag(tg: string) {
    setTags(prev => prev.filter(x => x !== tg))
  }

  const [loading, setLoading] = useState(false)

  async function handleAdd() {
    if (!title.trim())   { setError(t.vault.enterTitleError); return }
    if (!content.trim()) { setError(t.vault.enterContentError); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.vault.notAuthorizedError); setLoading(false); return }

    const { error: dbErr } = await sb.from("vault_items").insert({
      user_id: user.id,
      title:   title.trim(),
      content: content.trim(),
      tags:    tags,
      source:  "manual",
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
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.vault.newEntryTitle}</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>{t.vault.knowledgeVaultLabel}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Title */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.vault.nameField}
            </label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder={t.vault.namePlaceholder}
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {/* Content */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.vault.contentField}
            </label>
            <textarea value={content} onChange={e => setContent(e.target.value)}
              placeholder={t.vault.contentPlaceholder}
              rows={5}
              style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {/* Tags */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.vault.tagsField}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input value={tag} onChange={e => setTag(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag() } }}
                placeholder={t.vault.tagsPlaceholder}
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
                {tags.map(tg => (
                  <span key={tg} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    fontSize: 11, padding: "3px 9px", borderRadius: 6,
                    background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
                    color: T.t2,
                  }}>
                    #{tg}
                    <button onClick={() => removeTag(tg)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 0 }}>
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
              {t.vault.cancel}
            </button>
            <button onClick={handleAdd} disabled={loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              background: loading ? "rgba(232,0,42,0.3)" : T.red, border: "none", color: "#fff", cursor: loading ? "not-allowed" : "pointer",
            }}
              onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >
              {loading ? t.vault.saving : t.vault.saveEntry}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Preview modal ────────────────────────────────────────────────

function PreviewModal({ item, onClose, t, lang }: { item: VaultItem; onClose: () => void; t: ReturnType<typeof useLanguage>["t"]; lang: Language }) {
  const [titleCopied,   setTitleCopied]   = useState(false)
  const [contentCopied, setContentCopied] = useState(false)
  const [obsidianState, setObsidianState] = useState<"idle" | "sending" | "sent" | "error">("idle")

  function copyTitle() {
    navigator.clipboard.writeText(item.title).then(() => {
      setTitleCopied(true); setTimeout(() => setTitleCopied(false), 1800)
    })
  }

  function copyContent() {
    navigator.clipboard.writeText(item.content).then(() => {
      setContentCopied(true); setTimeout(() => setContentCopied(false), 1800)
    })
  }

  function downloadMd() {
    const body = `# ${item.title}\n\n${item.content}\n`
    const blob = new Blob([body], { type: "text/markdown;charset=utf-8" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href = url
    a.download = `${sanitizeFilename(item.title)}.md`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  function sendToObsidian() {
    setObsidianState("sending")
    let vaultName = getStoredVaultName()
    if (!vaultName) {
      const entered = window.prompt(t.vault.obsidianVaultPrompt)
      if (!entered || !entered.trim()) { setObsidianState("idle"); return }
      vaultName = entered.trim()
      setStoredVaultName(vaultName)
    }
    const ok = openInObsidian(vaultName, {
      title: item.title,
      content: item.content,
      folder: "AstroCore",
      source: "AstroCore",
    })
    if (ok) {
      setObsidianState("sent")
      setTimeout(() => setObsidianState("idle"), 2000)
    } else {
      setObsidianState("error")
      setTimeout(() => setObsidianState("idle"), 2500)
    }
  }

  return (
    <Modal onClose={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 680, maxHeight: "86vh",
          borderRadius: 18,
          background: "linear-gradient(160deg,#12121E 0%,#0B0B14 100%)",
          border: "1px solid rgba(232,0,42,0.26)",
          boxShadow: "0 0 0 1px rgba(232,0,42,0.06), 0 40px 90px rgba(0,0,0,0.85)",
          display: "flex", flexDirection: "column", overflow: "hidden",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "20px 22px 16px", borderBottom: `0.5px solid ${T.b1}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.24)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <FileText size={14} style={{ color: T.red }} />
              </div>
              <div style={{
                fontSize: 17, fontWeight: 700, color: T.t1,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.title}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 9 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: T.t4 }}>
                <Clock size={11} /> {formatFullDate(item.created_at, lang)}
              </span>
              {item.source && (
                <span style={{
                  fontSize: 10.5, padding: "2px 8px", borderRadius: 5,
                  background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)",
                  color: T.t3, textTransform: "capitalize",
                }}>
                  {item.source}
                </span>
              )}
            </div>
            {(item.tags ?? []).length > 0 && (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 9 }}>
                {(item.tags ?? []).map(tg => (
                  <span key={tg} style={{
                    fontSize: 10.5, padding: "2px 8px", borderRadius: 5,
                    background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
                    color: T.t3,
                  }}>
                    #{tg}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={onClose} style={{
            flexShrink: 0, width: 30, height: 30, borderRadius: 8, border: "none",
            background: "rgba(255,255,255,0.05)", cursor: "pointer", color: T.t4, lineHeight: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable content */}
        <div style={{ padding: "20px 22px", overflowY: "auto", flex: 1 }}>
          <div style={{
            fontSize: 13.5, color: T.t2, lineHeight: 1.75,
            whiteSpace: "pre-wrap", wordBreak: "break-word",
            padding: "14px 16px", borderRadius: 10,
            background: "rgba(255,255,255,0.02)", border: `0.5px solid ${T.b1}`,
          }}>
            {item.content}
          </div>
        </div>

        {/* Actions */}
        <div style={{
          padding: "14px 22px", borderTop: `0.5px solid ${T.b1}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap",
          flexShrink: 0,
        }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={copyContent} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 13px", borderRadius: 9, border: "none", cursor: "pointer",
              background: contentCopied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
              color: contentCopied ? T.green : T.t2, fontSize: 12.5, fontWeight: 500,
              transition: "background 130ms ease, color 130ms ease",
            }}>
              {contentCopied ? <Check size={13} /> : <Copy size={13} />}
              {contentCopied ? t.vault.copied : t.vault.copyContent}
            </button>
            <button onClick={copyTitle} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 13px", borderRadius: 9, border: "none", cursor: "pointer",
              background: titleCopied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
              color: titleCopied ? T.green : T.t2, fontSize: 12.5, fontWeight: 500,
              transition: "background 130ms ease, color 130ms ease",
            }}>
              {titleCopied ? <Check size={13} /> : <Copy size={13} />}
              {titleCopied ? t.vault.copied : t.vault.copyTitle}
            </button>
            <button onClick={downloadMd} style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "8px 13px", borderRadius: 9, border: "none", cursor: "pointer",
              background: "rgba(255,255,255,0.06)", color: T.t2, fontSize: 12.5, fontWeight: 500,
            }}>
              <Download size={13} /> {t.vault.downloadMd}
            </button>
            <button onClick={sendToObsidian} disabled={obsidianState === "sending"} title={t.vault.sendToObsidianTooltip}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 13px", borderRadius: 9, border: "none",
                cursor: obsidianState === "sending" ? "default" : "pointer",
                background: obsidianState === "sent" ? "rgba(34,197,94,0.12)"
                  : obsidianState === "error" ? "rgba(232,0,42,0.12)"
                  : "rgba(139,92,246,0.12)",
                color: obsidianState === "sent" ? T.green
                  : obsidianState === "error" ? "#FF6B6B"
                  : "#A78BFA",
                fontSize: 12.5, fontWeight: 500,
              }}>
              {obsidianState === "sending" ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} />
                : obsidianState === "sent" ? <Check size={13} />
                : obsidianState === "error" ? <X size={13} />
                : <Send size={13} />}
              {obsidianState === "sending" ? t.vault.openingEllipsis
                : obsidianState === "sent" ? t.vault.sent
                : obsidianState === "error" ? t.vault.failed
                : t.vault.sendToObsidian}
            </button>
          </div>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 9, border: `0.5px solid ${T.b1}`,
            background: "transparent", color: T.t3, fontSize: 12.5, fontWeight: 500, cursor: "pointer",
          }}>
            {t.vault.close}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Vault card ───────────────────────────────────────────────────

function VaultCard({ item, onDelete, onPreview, t, lang }: {
  item: VaultItem; onDelete: () => void; onPreview: () => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language
}) {
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
    if (window.confirm(`${t.vault.deleteConfirmPrefix}${item.title}${t.vault.deleteConfirmSuffix}`)) onDelete()
  }

  return (
    <div
      onClick={onPreview}
      style={{
        background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
        border: `0.5px solid ${T.b1}`,
        borderRadius: 14, padding: "16px 18px",
        display: "flex", flexDirection: "column", gap: 11,
        transition: "background 150ms ease, border-color 150ms ease",
        position: "relative", overflow: "hidden", cursor: "pointer",
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
          {ago(item.created_at, t, lang)}
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
        {t.vault.emptyTitle}
      </div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 340, marginBottom: 28 }}>
        {t.vault.emptyDesc}
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
        <Plus size={14} /> {t.vault.addEntry}
      </button>
      <div style={{ marginTop: 18, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.10em" }}>
        {t.vault.knowledgeBase}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function VaultPage() {
  const { t, language } = useLanguage()
  const [items,     setItems]     = useState<VaultItem[]>([])
  const [search,    setSearch]    = useState("")
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [previewItem, setPreviewItem] = useState<VaultItem | null>(null)
  const [pulse,     setPulse]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  async function load() {
    const sb = getSupabase()
    const { data } = await sb
      .from("vault_items")
      .select("*")
      .order("created_at", { ascending: false })
    if (data) setItems(data as VaultItem[])
  }
  useEffect(() => { load() }, [])

  async function handleDelete(id: string) {
    const sb = getSupabase()
    await sb.from("vault_items").delete().eq("id", id)
    load()
  }

  // Collect all unique tags
  const allTags = useMemo(() => {
    const set = new Set<string>()
    items.forEach(item => (item.tags ?? []).forEach(tg => set.add(tg)))
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
        @keyframes spin { to { transform: rotate(360deg) } }
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
                  Knowledge Vault · {items.length} {t.vault.entriesSuffix}
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
                {t.vault.title}
              </h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                {t.vault.subtitle}
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
              <Plus size={14} /> {t.vault.newEntry}
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {items.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} t={t} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1400 }}>

            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 22, flexWrap: "wrap" }}>
              {[
                { label: t.vault.statTotal, value: items.length,              icon: Database  },
                { label: t.vault.statUniqueTags, value: allTags.length,         icon: Tag       },
                { label: t.vault.statCharsSaved, value: totalChars.toLocaleString(), icon: Zap },
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
                  placeholder={t.vault.searchPlaceholder}
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
                    {t.vault.all}
                  </button>
                  {allTags.map(tg => (
                    <button key={tg}
                      onClick={() => setActiveTag(activeTag === tg ? null : tg)}
                      style={{
                        fontSize: 11, padding: "5px 11px", borderRadius: 7, cursor: "pointer",
                        background: activeTag === tg ? "rgba(232,0,42,0.18)" : "rgba(255,255,255,0.05)",
                        color: activeTag === tg ? T.t1 : T.t3,
                        border: activeTag === tg ? "0.5px solid rgba(232,0,42,0.30)" : "0.5px solid transparent",
                        transition: "background 130ms ease",
                      }}>
                      #{tg}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Results count */}
            {(search || activeTag) && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {t.vault.foundOfPrefix}{filtered.length}{t.vault.foundOfMid}{items.length}{t.vault.foundOfSuffix}
                <button onClick={() => { setSearch(""); setActiveTag(null) }} style={{
                  marginLeft: 10, fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer",
                }}>
                  {t.vault.clear}
                </button>
              </div>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
              <div style={{ padding: "48px 0", textAlign: "center" }}>
                <div style={{ fontSize: 13, color: T.t4 }}>{t.vault.nothingFound}</div>
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
                    onPreview={() => setPreviewItem(item)}
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
          onAdded={() => { load() }}
          t={t}
        />
      )}

      {previewItem && (
        <PreviewModal
          item={previewItem}
          onClose={() => setPreviewItem(null)}
          t={t}
          lang={language}
        />
      )}
    </>
  )
}