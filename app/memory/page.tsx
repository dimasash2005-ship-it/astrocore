"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Brain, Plus, Search, X, Clock, Zap, Activity, ArrowUpRight,
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
  source?: string | null
  tags?: string[] | null
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

// Plain-text preview for cards: drop markdown symbols, separators and empty lines.
function preview(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, " ")
    .split("\n")
    .map(l => l.replace(/^#+\s*|^[-*•]\s+|^>\s*/g, "").replace(/[*_`]/g, "").trim())
    .filter(l => l && !/^[-—─_=]{3,}$/.test(l))
    .join(" · ")
}

const SOURCE_LABEL: Record<string, { uk: string; en: string }> = {
  chat:     { uk: "з чату",    en: "from chat" },
  agent:    { uk: "агент",     en: "agent" },
  obsidian: { uk: "Obsidian",  en: "Obsidian" },
  manual:   { uk: "вручну",    en: "manual" },
}

// ─── Compact memory card (click → /memory/[id]) ────────────────────

function MemoryCard({ item, onOpen, t, lang, index }: {
  item: MemoryItem; onOpen: () => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language; index: number
}) {
  const src = item.source ? SOURCE_LABEL[item.source] : undefined
  return (
    <button onClick={onOpen} className="mem-card" style={{ animationDelay: `${Math.min(index, 12) * 40}ms` }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 9, flexShrink: 0,
          background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Brain size={14} style={{ color: T.red, opacity: 0.9 }} />
        </div>
        <div className="mem-title">{item.title}</div>
        <ArrowUpRight size={15} className="mem-arrow" />
      </div>

      <div className="mem-preview">{preview(item.content)}</div>

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto", paddingTop: 14, flexWrap: "wrap" }}>
        <span className="mem-chip mem-chip-red"><Zap size={9} /> {t.memory.activeContext}</span>
        {src && <span className="mem-chip">{lang === "uk" ? src.uk : src.en}</span>}
        <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10, fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4 }}>
          <span>{item.content.length.toLocaleString(lang === "uk" ? "uk-UA" : "en-US")} {lang === "uk" ? "симв." : "chars"}</span>
          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={10} />{ago(item.updated_at ?? item.created_at, t, lang)}</span>
        </span>
      </div>
    </button>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd, t }: { onAdd: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center", width: "100%" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Brain size={30} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.memory.emptyTitle}</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 360, marginBottom: 28 }}>{t.memory.emptyDesc}</div>
      <button onClick={onAdd} className="mem-primary"><Plus size={14} /> {t.memory.addMemory}</button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function MemoryPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const uk = language === "uk"
  const [items,   setItems]   = useState<MemoryItem[]>([])
  const [loaded,  setLoaded]  = useState(false)
  const [search,  setSearch]  = useState("")

  useEffect(() => {
    (async () => {
      const { data } = await getSupabase().from("memory_items").select("*").order("updated_at", { ascending: false })
      if (data) setItems(data as MemoryItem[])
      setLoaded(true)
    })()
  }, [])

  const filtered = useMemo(() => {
    if (!search) return items
    const q = search.toLowerCase()
    return items.filter(i => i.title.toLowerCase().includes(q) || i.content.toLowerCase().includes(q))
  }, [items, search])

  const totalChars = items.reduce((s, i) => s + i.content.length, 0)
  const openNew = () => router.push("/memory/new")

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        @keyframes memIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        .mem-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
        .mem-card {
          position: relative; display: flex; flex-direction: column; text-align: left; cursor: pointer;
          min-height: 172px; padding: 16px 16px 14px; border-radius: 14px; font-family: inherit;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          color: ${T.t2}; overflow: hidden; animation: memIn .45s cubic-bezier(.2,.8,.2,1) both;
          transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s;
        }
        .mem-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px;
          background: linear-gradient(180deg, transparent, rgba(232,0,42,.65), transparent); opacity: .6; transition: opacity .2s; }
        .mem-card:hover { transform: translateY(-3px); border-color: rgba(232,0,42,.35);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(232,0,42,.08); }
        .mem-card:hover::before { opacity: 1; }
        .mem-card:focus-visible { outline: 2px solid ${T.red}; outline-offset: 2px; }
        .mem-title { flex: 1; min-width: 0; font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: ${T.t1};
          line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mem-arrow { flex-shrink: 0; color: ${T.t4}; opacity: 0; transform: translate(-4px, 4px); transition: all .2s; }
        .mem-card:hover .mem-arrow { opacity: 1; transform: none; color: ${T.red}; }
        .mem-preview { margin-top: 10px; font-size: 12.5px; line-height: 1.6; color: ${T.t3};
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .mem-chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          padding: 2px 7px; border-radius: 5px; text-transform: uppercase; letter-spacing: .06em;
          color: ${T.t3}; background: rgba(255,255,255,.04); border: 0.5px solid ${T.b1}; }
        .mem-chip-red { color: ${T.red}; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.18); }

        .mem-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 172px;
          border-radius: 14px; border: 1px dashed rgba(232,0,42,.3); background: rgba(232,0,42,.03); color: ${T.t3};
          cursor: pointer; font-family: inherit; font-size: 13px; transition: background .2s, border-color .2s, color .2s; }
        .mem-new:hover { background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.55); color: ${T.t1}; }
        .mem-new span { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: rgba(232,0,42,.12); color: ${T.red}; }

        .mem-primary { display: flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s, box-shadow .13s, transform .13s; }
        .mem-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { .mem-card { animation: none; } }
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
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Memory Layer</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.memory.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.memory.subtitle}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {items.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 13px", borderRadius: 9, fontSize: 12, background: "rgba(34,197,94,0.07)", border: "0.5px solid rgba(34,197,94,0.18)", color: "#22C55E" }}>
                  <Activity size={12} /> {t.memory.injectedIntoAgents}
                </div>
              )}
              <button onClick={openNew} className="mem-primary"><Plus size={14} /> {t.memory.newMemory}</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {loaded && items.length === 0 ? (
          <EmptyState onAdd={openNew} t={t} />
        ) : (
          <div style={{ padding: "24px 48px 56px", maxWidth: 1400 }}>
            {/* stats + search in one row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { label: t.memory.statEntries,      value: items.length,                  icon: Brain },
                { label: t.memory.statChars,        value: totalChars.toLocaleString(),   icon: Zap },
                { label: t.memory.statInjectedInto, value: t.memory.statAllAgents,         icon: Activity },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", borderRadius: 9, background: T.s1, border: `0.5px solid ${T.b1}` }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}

              <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 10, background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 10, padding: "0 14px", height: 38 }}>
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.memory.searchPlaceholder}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={13} /></button>
                )}
              </div>
            </div>

            <div style={{ fontSize: 12, color: T.t4, marginBottom: 18, lineHeight: 1.6 }}>
              <Brain size={12} style={{ color: T.red, opacity: 0.8, verticalAlign: -2, marginRight: 6 }} />
              {t.memory.howItWorksDesc}
            </div>

            {search && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {t.memory.foundOfPrefix}{filtered.length}{t.memory.foundOfMid}{items.length}{t.memory.foundOfSuffix}
              </div>
            )}

            {filtered.length === 0 && search ? (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: T.t4 }}>{t.memory.nothingFound}</div>
            ) : (
              <div className="mem-grid">
                {!search && (
                  <button className="mem-new" onClick={openNew}>
                    <span><Plus size={17} /></span>
                    {uk ? "Новий запис" : "New entry"}
                  </button>
                )}
                {filtered.map((item, i) => (
                  <MemoryCard key={item.id} item={item} index={i} t={t} lang={language}
                    onOpen={() => router.push(`/memory/${item.id}`)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}