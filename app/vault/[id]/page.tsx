"use client"

// One vault entry, full screen: read, edit, tag, copy, export, save, delete.
// /vault/new opens an empty entry; after the first save it moves to /vault/<id>.

import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, FileText, Check, Clock, Loader2, Save, Trash2, Eye, PenLine, AlertCircle,
  Copy, Download, Send, X, Hash,
} from "lucide-react"
import { getStoredVaultName, setStoredVaultName, openInObsidian } from "@/lib/obsidian-uri"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"

type VaultItem = {
  id: string
  user_id: string
  title: string
  content: string
  tags: string[] | null
  source: string | null
  created_at: string
}

function sanitizeFilename(name: string): string {
  return (name || "vault-item").replace(/[\\/:*?"<>|]/g, "-").trim() || "vault-item"
}

const sameTags = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

const T = {
  bg: "#08080F", s1: "#11111C", s2: "#16162A",
  b1: "rgba(255,255,255,0.10)", b2: "rgba(255,255,255,0.16)",
  t1: "#F0EDF8", t2: "#C8C4D8", t3: "#A8A4BC", t4: "#585878",
  red: "#E8002A", green: "#22C55E",
}

const SOURCE_LABEL: Record<string, { uk: string; en: string }> = {
  chat:     { uk: "з чату",   en: "from chat" },
  agent:    { uk: "агент",    en: "agent" },
  obsidian: { uk: "Obsidian", en: "Obsidian" },
  manual:   { uk: "вручну",   en: "manual" },
}

function fmtDate(iso: string, uk: boolean) {
  if (!iso) return ""
  return new Date(iso).toLocaleString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
}

export default function VaultEntryPage() {
  const params = useParams()
  const router = useRouter()
  const { language } = useLanguage()
  const uk = language === "uk"
  const rawId = (params?.id as string) ?? ""
  const isNew = rawId === "new"

  const [item,    setItem]    = useState<VaultItem | null>(null)
  const [title,   setTitle]   = useState("")
  const [content, setContent] = useState("")
  const [tags,    setTags]    = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState("")
  const [flash,   setFlash]   = useState("")
  const [mode,    setMode]    = useState<"write" | "preview">(isNew ? "write" : "preview")
  const [loading, setLoading] = useState(!isNew)
  const [missing, setMissing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [error,   setError]   = useState("")
  const [confirmDel, setConfirmDel] = useState(false)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const dirty = isNew
    ? (title.trim() !== "" || content.trim() !== "" || tags.length > 0)
    : !!item && (title !== item.title || content !== item.content || !sameTags(tags, item.tags ?? []))

  // load
  useEffect(() => {
    if (isNew) return
    ;(async () => {
      const { data, error: e } = await getSupabase().from("vault_items").select("*").eq("id", rawId).maybeSingle()
      if (e || !data) { setMissing(true); setLoading(false); return }
      const it = data as VaultItem
      setItem(it); setTitle(it.title); setContent(it.content); setTags(it.tags ?? []); setLoading(false)
    })()
  }, [rawId, isNew])

  // warn before closing the tab with unsaved changes
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = "" } }
    window.addEventListener("beforeunload", h)
    return () => window.removeEventListener("beforeunload", h)
  }, [dirty])

  const save = useCallback(async () => {
    if (!title.trim()) { setError(uk ? "Вкажи назву запису." : "Add a title."); return }
    if (!content.trim()) { setError(uk ? "Запис порожній — напиши щось." : "The entry is empty."); return }
    setSaving(true); setError("")
    const sb = getSupabase()
    if (isNew) {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) { setSaving(false); setError(uk ? "Потрібно увійти в акаунт." : "Please sign in."); return }
      const { data, error: e } = await sb.from("vault_items")
        .insert({ user_id: user.id, title: title.trim(), content: content.trim(), tags, source: "manual" })
        .select("*").single()
      setSaving(false)
      if (e || !data) { setError(e?.message ?? (uk ? "Не вдалося зберегти." : "Couldn't save.")); return }
      setItem(data as VaultItem)
      router.replace(`/vault/${(data as VaultItem).id}`)
      return
    }
    const { error: e } = await sb.from("vault_items")
      .update({ title: title.trim(), content: content.trim(), tags })
      .eq("id", rawId)
    setSaving(false)
    if (e) { setError(e.message); return }
    setItem(prev => prev ? { ...prev, title: title.trim(), content: content.trim(), tags } : prev)
    setTitle(t => t.trim()); setContent(c => c.trim())
    setSavedAt(Date.now())
  }, [title, content, tags, isNew, rawId, router, uk])

  // ⌘S / Ctrl+S saves
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); if (dirty && !saving) save() }
    }
    window.addEventListener("keydown", h)
    return () => window.removeEventListener("keydown", h)
  }, [dirty, saving, save])

  async function remove() {
    if (isNew) { router.push("/vault"); return }
    const { error: e } = await getSupabase().from("vault_items").delete().eq("id", rawId)
    if (e) { setError(e.message); setConfirmDel(false); return }
    router.push("/vault")
  }

  function back() {
    if (dirty && !window.confirm(uk ? "Є незбережені зміни. Вийти без збереження?" : "You have unsaved changes. Leave without saving?")) return
    router.push("/vault")
  }

  // tags
  function addTag() {
    const tg = tagDraft.trim().replace(/^#/, "")
    if (tg && !tags.includes(tg)) setTags([...tags, tg])
    setTagDraft("")
  }

  // copy / export
  function toast(msg: string) { setFlash(msg); setTimeout(() => setFlash(""), 1800) }
  async function copyContent() {
    try { await navigator.clipboard.writeText(content); toast(uk ? "Текст скопійовано" : "Text copied") } catch {}
  }
  function downloadMd() {
    const blob = new Blob([`# ${title}\n\n${content}\n`], { type: "text/markdown;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url; a.download = `${sanitizeFilename(title)}.md`
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }
  function sendToObsidian() {
    let vaultName = getStoredVaultName()
    if (!vaultName) {
      const entered = window.prompt(uk ? "Назва твого Obsidian vault:" : "Your Obsidian vault name:")
      if (!entered || !entered.trim()) return
      vaultName = entered.trim()
      setStoredVaultName(vaultName)
    }
    const ok = openInObsidian(vaultName, { title, content, folder: "AstroCore", source: "AstroCore" })
    toast(ok ? (uk ? "Відкриваю в Obsidian…" : "Opening in Obsidian…") : (uk ? "Не вдалося відкрити Obsidian" : "Couldn't open Obsidian"))
  }

  // toolbar helpers
  function wrap(w: string) {
    const el = taRef.current; if (!el) return
    const s = el.selectionStart, e = el.selectionEnd
    const sel = content.slice(s, e) || (uk ? "текст" : "text")
    setContent(content.slice(0, s) + w + sel + w + content.slice(e))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + w.length, s + w.length + sel.length) })
  }
  function prefix(p: string) {
    const el = taRef.current; if (!el) return
    const s = el.selectionStart
    const ls = content.lastIndexOf("\n", s - 1) + 1
    setContent(content.slice(0, ls) + p + content.slice(ls))
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + p.length, s + p.length) })
  }

  const words = content.trim() ? content.trim().split(/\s+/).length : 0
  const justSaved = savedAt > 0 && Date.now() - savedAt < 2500 && !dirty

  if (loading) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 size={22} className="animate-spin" style={{ color: T.t3 }} />
      </div>
    )
  }
  if (missing) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <div style={{ color: T.t2 }}>{uk ? "Запис не знайдено" : "Entry not found"}</div>
        <button onClick={() => router.push("/vault")} style={{ background: T.s1, border: `0.5px solid ${T.b1}`, color: T.t2, borderRadius: 9, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>
          {uk ? "← До сховища" : "← Back to vault"}
        </button>
      </div>
    )
  }

  const src = item?.source ? SOURCE_LABEL[item.source] : undefined

  return (
    <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
      backgroundImage: "radial-gradient(rgba(255,255,255,0.03) 1px,transparent 1px)", backgroundSize: "24px 24px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        @keyframes me-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        .me-in { animation: me-in .45s cubic-bezier(.2,.8,.2,1) both; }
        .me-title { width: 100%; background: none; border: none; outline: none; color: ${T.t1};
          font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; letter-spacing: -0.03em; line-height: 1.2;
          resize: none; padding: 0; field-sizing: content; }
        .me-title::placeholder { color: ${T.t4}; }
        .me-editor { border-radius: 16px; padding: 1px; background: ${T.b1}; transition: background .3s, box-shadow .3s; }
        .me-editor:focus-within { background: linear-gradient(135deg, rgba(232,0,42,.7), rgba(167,139,250,.45), rgba(232,0,42,.35)); box-shadow: 0 0 34px rgba(232,0,42,.12); }
        .me-in-box { border-radius: 15px; background: #0B0B15; overflow: hidden; }
        .me-bar { display: flex; align-items: center; gap: 2px; padding: 7px 10px; border-bottom: 0.5px solid rgba(255,255,255,.06); background: rgba(255,255,255,.02); flex-wrap: wrap; }
        .me-tab { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 500; font-family: inherit; color: ${T.t3}; background: none; border: 0; padding: 6px 11px; border-radius: 8px; cursor: pointer; }
        .me-tab[aria-pressed="true"] { color: ${T.t1}; background: rgba(255,255,255,.08); }
        .me-tool { width: 30px; height: 30px; border: 0; border-radius: 8px; background: none; color: ${T.t3}; cursor: pointer; font-size: 13px; font-weight: 600; display: grid; place-items: center; }
        .me-tool:hover, .me-tab:hover { color: ${T.t1}; background: rgba(255,255,255,.07); }
        .me-ta { display: block; width: 100%; min-height: 52vh; resize: none; border: 0; outline: none; background: transparent; color: ${T.t1};
          font-size: 15px; line-height: 1.75; font-family: inherit; padding: 20px 22px; field-sizing: content; }
        .me-prev { min-height: 52vh; padding: 20px 26px; font-size: 15px; line-height: 1.75; color: ${T.t2}; max-width: 78ch; }
        .me-prev h1, .me-prev h2, .me-prev h3 { font-family: 'Space Grotesk', sans-serif; color: ${T.t1}; margin: 22px 0 10px; line-height: 1.3; }
        .me-prev h1 { font-size: 22px; } .me-prev h2 { font-size: 19px; } .me-prev h3 { font-size: 16px; }
        .me-prev p { margin: 0 0 12px; } .me-prev strong { color: ${T.t1}; }
        .me-prev ul { padding-left: 0; list-style: none; display: flex; flex-direction: column; gap: 8px; margin: 6px 0 14px; }
        .me-prev ul li { position: relative; padding-left: 20px; }
        .me-prev ul li::before { content: ""; position: absolute; left: 4px; top: .7em; width: 6px; height: 6px; border-radius: 50%; background: ${T.red}; }
        .me-prev ol { padding-left: 22px; }
        .me-prev hr { border: 0; height: 1px; margin: 24px 0; background: linear-gradient(90deg, rgba(232,0,42,.5), ${T.b1} 40%, transparent); }
        .me-prev code { font-family: 'JetBrains Mono', monospace; font-size: .88em; background: rgba(255,255,255,.07); padding: 1px 5px; border-radius: 4px; color: #FFB4C4; }
        .me-prev pre { background: rgba(0,0,0,.4); padding: 14px; border-radius: 10px; overflow: auto; border: 0.5px solid rgba(125,211,252,.12); }
        .me-prev pre code { background: none; color: #9AD8FF; padding: 0; }
        .me-prev a { color: #FF7A90; }
        .me-prev blockquote { margin: 14px 0; padding: 10px 16px; border-left: 2px solid ${T.red}; background: rgba(232,0,42,.05); border-radius: 0 10px 10px 0; }
        .me-btn { display: flex; align-items: center; gap: 7px; border-radius: 10px; padding: 9px 15px; font-size: 13px; cursor: pointer; font-family: inherit; transition: background .15s, color .15s, border-color .15s, box-shadow .15s; }
        .me-ghost { background: ${T.s1}; border: 0.5px solid ${T.b1}; color: ${T.t2}; }
        .me-ghost:hover { background: rgba(255,255,255,.07); color: ${T.t1}; }
        .me-save { background: ${T.red}; border: none; color: #fff; font-weight: 600; box-shadow: 0 6px 18px rgba(232,0,42,.22); }
        .me-save:hover:not(:disabled) { background: #FF1A3E; }
        .me-save:disabled { opacity: .45; cursor: default; box-shadow: none; }
        .me-del:hover { color: #FF4D6A !important; border-color: rgba(232,0,42,.4) !important; }
        .ve-tag { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; padding: 4px 6px 4px 10px; border-radius: 7px;
          background: rgba(232,0,42,.09); border: 0.5px solid rgba(232,0,42,.22); color: ${T.t2}; }
        .ve-tag button { background: none; border: 0; cursor: pointer; color: ${T.t4}; line-height: 0; padding: 2px; border-radius: 4px; }
        .ve-tag button:hover { color: ${T.t1}; background: rgba(255,255,255,.08); }
        .ve-tag-add { display: inline-flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 7px; border: 0.5px dashed ${T.b1}; color: ${T.t4}; }
        .ve-tag-add input { width: 90px; background: none; border: 0; outline: none; color: ${T.t1}; font-size: 12px; font-family: inherit; }
        @media (prefers-reduced-motion: reduce) { .me-in { animation: none; } }
      `}</style>

      {/* ── Sticky top bar ── */}
      <div style={{ position: "sticky", top: 0, zIndex: 20, background: "rgba(8,8,15,0.92)", borderBottom: `0.5px solid ${T.b1}`,
        padding: "12px 40px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button onClick={back} className="me-btn me-ghost" style={{ padding: "7px 12px" }}>
          <ArrowLeft size={14} /> {uk ? "Сховище" : "Vault"}
        </button>

        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4, display: "flex", alignItems: "center", gap: 8 }}>
          {dirty
            ? <span style={{ color: "#FBBF24", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: "#FBBF24" }} />{uk ? "є незбережені зміни" : "unsaved changes"}</span>
            : justSaved
              ? <span style={{ color: T.green, display: "flex", alignItems: "center", gap: 5 }}><Check size={12} />{uk ? "збережено" : "saved"}</span>
              : !isNew && <span>{uk ? "усе збережено" : "all saved"}</span>}
        </div>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          {confirmDel ? (
            <>
              <span style={{ fontSize: 12, color: T.t3 }}>{uk ? "Видалити назавжди?" : "Delete for good?"}</span>
              <button className="me-btn me-ghost" onClick={() => setConfirmDel(false)}>{uk ? "Ні" : "No"}</button>
              <button className="me-btn" onClick={remove} style={{ background: "rgba(232,0,42,.15)", border: "0.5px solid rgba(232,0,42,.45)", color: "#FF4D6A" }}>
                <Trash2 size={13} /> {uk ? "Так, видалити" : "Yes, delete"}
              </button>
            </>
          ) : (
            <button className="me-btn me-ghost me-del" onClick={() => setConfirmDel(true)} title={uk ? "Видалити запис" : "Delete entry"}>
              <Trash2 size={13} />
            </button>
          )}
          <button className="me-btn me-save" onClick={save} disabled={!dirty || saving} title="⌘S">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
            {saving ? (uk ? "Зберігаю…" : "Saving…") : (uk ? "Зберегти" : "Save")}
          </button>
        </div>
      </div>

      <div style={{ padding: "34px 40px 80px", maxWidth: 1040 }}>
        {/* meta */}
        <div className="me-in" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14,
          fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4, letterSpacing: ".05em" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.red, textTransform: "uppercase", letterSpacing: ".1em" }}>
            <FileText size={12} /> {isNew ? (uk ? "Новий запис сховища" : "New vault entry") : (uk ? "Запис сховища" : "Vault entry")}
          </span>
          {src && <span style={{ padding: "2px 8px", borderRadius: 5, border: `0.5px solid ${T.b1}`, color: T.t3 }}>{uk ? src.uk : src.en}</span>}
          {item && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Clock size={10} />{uk ? "створено" : "created"} {fmtDate(item.created_at, uk)}</span>}
        </div>

        {/* title */}
        <textarea className="me-title me-in" rows={1} value={title} onChange={e => { setTitle(e.target.value.replace(/\n/g, " ")); setError("") }}
          placeholder={uk ? "Назва запису…" : "Entry title…"} autoFocus={isNew} style={{ animationDelay: ".05s" }} />

        {/* tags + quick actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", margin: "14px 0 22px" }}>
          {tags.map(tg => (
            <span key={tg} className="ve-tag">#{tg}
              <button onClick={() => setTags(tags.filter(x => x !== tg))} aria-label={uk ? "Прибрати тег" : "Remove tag"}><X size={10} /></button>
            </span>
          ))}
          <span className="ve-tag-add">
            <Hash size={11} />
            <input value={tagDraft} onChange={e => setTagDraft(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag() } }}
              onBlur={addTag} placeholder={uk ? "додати тег" : "add tag"} />
          </span>

          <span style={{ flex: 1 }} />
          <button className="me-btn me-ghost" onClick={copyContent} style={{ padding: "7px 12px", fontSize: 12 }}><Copy size={13} /> {uk ? "Копіювати" : "Copy"}</button>
          <button className="me-btn me-ghost" onClick={downloadMd} style={{ padding: "7px 12px", fontSize: 12 }}><Download size={13} /> .md</button>
          <button className="me-btn" onClick={sendToObsidian} style={{ padding: "7px 12px", fontSize: 12, background: "rgba(139,92,246,.12)", border: "0.5px solid rgba(139,92,246,.3)", color: "#A78BFA" }}>
            <Send size={13} /> Obsidian
          </button>
        </div>

        {error && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#FF4D6A", padding: "9px 12px", borderRadius: 10, background: "rgba(232,0,42,.08)", border: "0.5px solid rgba(232,0,42,.25)", marginBottom: 14 }}>
            <AlertCircle size={13} /> {error}
          </div>
        )}

        {/* editor */}
        <div className="me-editor me-in" style={{ animationDelay: ".1s" }}>
          <div className="me-in-box">
            <div className="me-bar">
              <button className="me-tab" aria-pressed={mode === "preview"} onClick={() => setMode("preview")}><Eye size={13} /> {uk ? "Перегляд" : "Preview"}</button>
              <button className="me-tab" aria-pressed={mode === "write"} onClick={() => { setMode("write"); setTimeout(() => taRef.current?.focus(), 0) }}><PenLine size={13} /> {uk ? "Редагувати" : "Edit"}</button>
              {mode === "write" && <>
                <span style={{ width: 1, height: 18, background: T.b1, margin: "0 6px" }} />
                <button className="me-tool" title={uk ? "Жирний" : "Bold"} onClick={() => wrap("**")}>B</button>
                <button className="me-tool" title={uk ? "Курсив" : "Italic"} onClick={() => wrap("_")}><i>I</i></button>
                <button className="me-tool" title={uk ? "Заголовок" : "Heading"} onClick={() => prefix("## ")}>H</button>
                <button className="me-tool" title={uk ? "Список" : "List"} onClick={() => prefix("- ")}>•</button>
                <button className="me-tool" title={uk ? "Код" : "Code"} onClick={() => wrap("`")}>{"</>"}</button>
              </>}
              <span style={{ marginLeft: "auto", fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4 }}>
                {words} {uk ? "слів" : "words"} · {content.length.toLocaleString(uk ? "uk-UA" : "en-US")} {uk ? "симв." : "chars"}
              </span>
            </div>

            {mode === "write" ? (
              <textarea ref={taRef} className="me-ta" value={content} onChange={e => { setContent(e.target.value); setError("") }}
                placeholder={uk ? "Текст, ідея, результат агента, нотатка…" : "Text, idea, agent output, note…"} />
            ) : (
              <div className="me-prev" onDoubleClick={() => setMode("write")} title={uk ? "Подвійний клік — редагувати" : "Double-click to edit"}>
                {content.trim()
                  ? <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
                  : <span style={{ color: T.t4 }}>{uk ? "Порожньо. Натисни «Редагувати», щоб написати." : "Empty. Click “Edit” to write."}</span>}
              </div>
            )}
          </div>
        </div>

        <div style={{ marginTop: 12, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: T.t4 }}>
          ⌘S / Ctrl+S — {uk ? "зберегти" : "save"}
        </div>
      </div>

      {flash && (
        <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 60, background: T.s2,
          border: `0.5px solid ${T.b1}`, color: T.t1, fontSize: 13, borderRadius: 10, padding: "9px 14px", boxShadow: "0 10px 30px rgba(0,0,0,.5)" }}>
          <Check size={13} style={{ color: T.green, verticalAlign: -2, marginRight: 6 }} />{flash}
        </div>
      )}
    </div>
  )
}