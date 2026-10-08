// app/r/[id]/page.tsx
//
// Public page of a shared report: astrocore.one/r/<share_id>
// Works without signing in. Shows only that one report, and only while the owner
// keeps sharing on. Never exposes chat, memory, other reports or the owner's email.
// Language follows the visitor's browser (Ukrainian or English).

import type { Metadata } from "next"
import Link from "next/link"
import { cache, Children, isValidElement, type ReactNode } from "react"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

export const dynamic = "force-dynamic"

type SharedReport = {
  id: string
  user_id: string
  company_name: string
  summary: string | null
  chart_data: unknown
  created_at: string
  is_public: boolean
  share_show_charts: boolean
  share_show_sources: boolean
  share_show_author: boolean
  share_views: number
}

const TX = {
  uk: {
    badge: "Звіт AI-агента", madeBy: "Зроблено агентом OpenClaw", read: "хв читання", contents: "Зміст",
    sources: "Джерела", figures: "Ключові цифри", empty: "У цьому звіті поки немає тексту.",
    try: "Спробувати безкоштовно", tryShort: "Спробувати",
    ctaKicker: "AstroCore", ctaTitle: "Твій агент теж може так працювати",
    ctaText: "AstroCore — дім для твого OpenClaw-агента. Він сам виконує задачі за розкладом і кладе результат у гарні звіти, як цей.",
    f1t: "Місії щоранку", f1d: "Агент сам робить дайджест, огляд чи аналіз у потрібний час.",
    f2t: "Звіти з графіками", f2d: "Текст, цифри й джерела в одному місці. Ділишся одним посиланням.",
    f3t: "Памʼять між сесіями", f3d: "Агент памʼятає контекст і не починає щоразу з нуля.",
    free: "Безкоштовно під час бети", hiddenT: "Звіт приховано", hiddenD: "Власник більше не ділиться цим звітом.",
    home: "Що таке AstroCore", locale: "uk-UA",
  },
  en: {
    badge: "AI agent report", madeBy: "Made by an OpenClaw agent", read: "min read", contents: "Contents",
    sources: "Sources", figures: "Key figures", empty: "This report has no text yet.",
    try: "Try it free", tryShort: "Try free",
    ctaKicker: "AstroCore", ctaTitle: "Your agent can work like this too",
    ctaText: "AstroCore is the home for your OpenClaw agent. It runs tasks on a schedule and puts the results into clean reports like this one.",
    f1t: "Morning missions", f1d: "Your agent makes a digest, review or analysis at the time you set.",
    f2t: "Reports with charts", f2d: "Text, numbers and sources in one place. Share with one link.",
    f3t: "Memory between sessions", f3d: "Your agent keeps context instead of starting from zero.",
    free: "Free during beta", hiddenT: "Report hidden", hiddenD: "The owner stopped sharing this report.",
    home: "What is AstroCore", locale: "en-US",
  },
}

function service(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// One DB read per request, shared by generateMetadata and the page.
const loadReport = cache(async (shareId: string): Promise<SharedReport | null> => {
  if (!/^[a-z0-9]{6,32}$/.test(shareId)) return null
  const { data } = await service()
    .from("reports")
    .select("id, user_id, company_name, summary, chart_data, created_at, is_public, share_show_charts, share_show_sources, share_show_author, share_views")
    .eq("share_id", shareId)
    .maybeSingle()
  return (data as SharedReport | null) ?? null
})

async function lang(): Promise<"uk" | "en"> {
  const h = await headers()
  const al = (h.get("accept-language") || "").toLowerCase()
  return /^(uk|ru)|,\s*(uk|ru)/.test(al) ? "uk" : "en"
}

// ─── Text helpers ─────────────────────────────────────────────────
// Agents often write plain text: "1. РИНОК І КОНКУРЕНТИ" headings, "•" bullets,
// "———" separators. normalizeReport() turns that into Markdown (same rules as
// the Reports page in the app), and ALL-CAPS headings become sentence case so
// they read calmly. Short acronyms (AI, API, SMM, BYOK) stay upper case.

const SEP_RE    = /^\s*[─━═—–\-_=▬]{5,}\s*$/
const CAPS_HEAD = /^\s*(\d+[.)]\s+)?[A-ZА-ЯІЇЄҐ0-9][A-ZА-ЯІЇЄҐ0-9 ,.&/()«»'’\-–—:]{3,90}$/
const BULLET_RE = /^\s*[•·▪◦●]\s+/

function isAllCaps(s: string) {
  const letters = s.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ]/g, "")
  return letters.length >= 4 && letters === letters.toUpperCase()
}

function sentenceCase(s: string): string {
  const words = s.trim().replace(/^\d+[.)]\s*/, "").split(/(\s+|-)/)
  const out = words.map(w => {
    const letters = w.replace(/[^A-Za-zА-Яа-яІіЇїЄєҐґ]/g, "")
    if (letters.length > 0 && letters.length <= 4 && /[A-Z]/.test(letters) && letters === letters.toUpperCase()) return w // acronym
    return w.toLowerCase()
  }).join("")
  return out.charAt(0).toUpperCase() + out.slice(1)
}

function normalizeReport(src: string): string {
  return src.split("\n").map(line => {
    if (SEP_RE.test(line)) return "\n---\n"
    if (CAPS_HEAD.test(line) && isAllCaps(line)) return `\n## ${sentenceCase(line)}\n`
    if (BULLET_RE.test(line)) return line.replace(BULLET_RE, "- ")
    const md = /^(#{1,3})\s+(.+)$/.exec(line.trim())
    if (md && isAllCaps(md[2])) return `${md[1]} ${sentenceCase(md[2])}`
    const t = line.trim()
    if (t.length > 3 && t.length < 90 && t.endsWith(":") && !t.startsWith("-") && !/^Дата:|^Date:/i.test(t)) return `\n**${t}**\n`
    return line
  }).join("\n")
}

// "Дата: 28.09.2026. Джерела: ČSÚ, Eurostat, ..." → ["ČSÚ", "Eurostat", ...]
function inlineSources(src: string): string[] {
  const m = /(?:Джерела|Sources)\s*:\s*([^\n]+)/i.exec(src)
  if (!m) return []
  const parts: string[] = []
  let depth = 0, cur = ""
  for (const ch of m[1].replace(/\.\s*$/, "")) {
    if (ch === "(") depth++
    if (ch === ")") depth--
    if (ch === "," && depth === 0) { parts.push(cur.trim()); cur = ""; continue }
    cur += ch
  }
  if (cur.trim()) parts.push(cur.trim())
  return parts.filter(p => p && p.length < 80).slice(0, 12)
}

type KeyFigure = { value: string; label: string; source?: string }

// Bullets with a percentage → "key figures" cards (taken from the text itself).
function extractFigures(src: string): KeyFigure[] {
  const out: KeyFigure[] = []
  for (const raw of src.split("\n")) {
    if (!BULLET_RE.test(raw) && !/^\s*-\s+/.test(raw)) continue
    const line = raw.replace(BULLET_RE, "").replace(/^\s*-\s+/, "").replace(/[*_`]/g, "").trim()
    const pm = /(\d+(?:[.,]\d+)?\s?%)/.exec(line)
    if (!pm) continue
    const srcM = /\(([^()]{2,40})\)\s*$/.exec(line)
    let label = line.replace(srcM ? srcM[0] : "", "").trim().replace(/\s+/g, " ")
    if (label.length > 110) label = label.slice(0, 107).trimEnd() + "…"
    out.push({ value: pm[1].replace(/\s/, ""), label, source: srcM?.[1] })
    if (out.length === 4) break
  }
  return out
}

const SOURCES_RE = /^\s*(#{1,6}\s*)?(\*\*)?\s*(Джерела|Sources|Источники)\s*(\*\*)?\s*:?\s*$/i

function splitSources(summary: string): { body: string; sources: string[] } {
  const lines = summary.split("\n")
  const idx = lines.findIndex(l => SOURCES_RE.test(l))
  if (idx === -1) return { body: summary, sources: [] }
  const sources = lines.slice(idx + 1).map(l => l.replace(/^[-*•\d.)\s]+/, "").trim()).filter(Boolean)
  return { body: lines.slice(0, idx).join("\n"), sources }
}

function plain(text: string, max = 180): string {
  const s = text.replace(/```[\s\S]*?```/g, " ").replace(/[#*_`>[\]()|]/g, "").replace(/\s+/g, " ").trim()
  return s.length > max ? s.slice(0, max - 1) + "…" : s
}

function slug(text: string): string {
  return "s-" + text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 60)
}

function textOf(node: ReactNode): string {
  return Children.toArray(node).map(c => {
    if (typeof c === "string" || typeof c === "number") return String(c)
    if (isValidElement<{ children?: ReactNode }>(c)) return textOf(c.props.children)
    return ""
  }).join("")
}

function headingsOf(md: string): { id: string; text: string }[] {
  return md.split("\n")
    .map(l => /^#{1,2}\s+(.+)$/.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m)
    .map(m => {
      const text = m[1].replace(/[*_`]/g, "").trim()
      return { id: slug(text), text: text.replace(/^\d+[.)]\s*/, "") }
    })
    .slice(0, 16)
}

function readingMinutes(s: string) {
  const w = s.trim() ? s.trim().split(/\s+/).length : 0
  return Math.max(1, Math.round(w / 200))
}

function sourceParts(s: string): { label: string; href: string | null; host: string } {
  const md = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/.exec(s)
  const url = md?.[2] ?? /(https?:\/\/[^\s)]+)/.exec(s)?.[1] ?? null
  let host = ""
  try { if (url) host = new URL(url).hostname.replace(/^www\./, "") } catch { host = "" }
  const label = (md?.[1] ?? s.replace(/https?:\/\/[^\s)]+/g, "")).replace(/[*_`]/g, "").replace(/[—–:-]\s*$/, "").trim() || host || s
  return { label, href: url, host }
}

// ─── Charts (same shape the Reports page checks: stats / trend / trendLabels) ──

function hasStats(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false
  const r = raw as Record<string, unknown>
  return Array.isArray(r.stats) && r.stats.length > 0
}

function Charts({ raw, title }: { raw: unknown; title: string }) {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const stats = Array.isArray(r.stats) ? (r.stats as Record<string, unknown>[]) : []
  const trend = Array.isArray(r.trend) ? (r.trend as unknown[]).map(Number).filter(n => Number.isFinite(n)) : []
  const labels = Array.isArray(r.trendLabels) ? (r.trendLabels as unknown[]).map(String) : []
  if (stats.length === 0 && trend.length === 0) return null
  const max = Math.max(1, ...trend)
  return (
    <section className="rs-block">
      <div className="rs-kicker">{title}</div>
      {stats.length > 0 && (
        <div className="rs-stats">
          {stats.slice(0, 4).map((s, i) => (
            <div key={i} className="rs-stat" style={{ ["--c" as string]: ["#E8002A", "#06B6D4", "#8B5CF6", "#F59E0B"][i % 4] } as React.CSSProperties}>
              <b>{String(s.value ?? s.v ?? "")}</b>
              <span>{String(s.label ?? s.name ?? "")}</span>
            </div>
          ))}
        </div>
      )}
      {trend.length > 0 && (
        <div className="rs-bars" role="img" aria-label="Trend">
          {trend.slice(0, 24).map((v, i) => (
            <div key={i} className="rs-bar">
              <em>{v}</em>
              <i style={{ height: `${Math.max(4, (v / max) * 100)}%` }} />
              <span>{labels[i] ?? ""}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Metadata (link previews in Telegram / Threads / X) ──────────

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const r = await loadReport(id)
  if (!r || !r.is_public) return { title: "Report", robots: { index: false, follow: false } }
  const description = plain(r.summary ?? "", 160) || "A report made by an OpenClaw agent in AstroCore."
  return {
    title: r.company_name,
    description,
    robots: { index: false, follow: true },
    openGraph: { type: "article", title: r.company_name, description, url: `https://astrocore.one/r/${id}`, siteName: "AstroCore AI" },
    twitter: { card: "summary", title: r.company_name, description },
  }
}

// ─── Page ─────────────────────────────────────────────────────────

function TopBar({ t }: { t: typeof TX.uk }) {
  return (
    <header className="rs-top">
      <div className="rs-top-in">
        <Link href="/?ref=share" className="rs-brand">
          <img src="/astrocore-logo.png" alt="" className="rs-logo-img" width={32} height={32} />
          <span>Astro<em>Core</em></span>
        </Link>
        <Link href="/register?ref=share" className="rs-btn rs-btn-sm">{t.tryShort} →</Link>
      </div>
    </header>
  )
}

function Heading({ level, children }: { level: 2 | 3; children?: ReactNode }) {
  const id = slug(textOf(children))
  return level === 2 ? <h2 id={id}>{children}</h2> : <h3 id={id}>{children}</h3>
}

export default async function SharedReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await loadReport(id)
  if (!r) notFound()
  const t = TX[await lang()]

  if (!r.is_public) {
    return (
      <main className="rs">
        <style>{SHARE_CSS}</style>
        <TopBar t={t} />
        <div className="rs-hidden">
          <img src="/astrocore-logo.png" alt="AstroCore" className="rs-logo-img big" width={56} height={56} />
          <h1>{t.hiddenT}</h1>
          <p>{t.hiddenD}</p>
          <Link className="rs-btn" href="/?ref=share">{t.home} →</Link>
        </div>
      </main>
    )
  }

  // Count the view (best effort; never blocks the page).
  service().from("reports").update({ share_views: (r.share_views ?? 0) + 1 }).eq("id", r.id).then(() => {}, () => {})

  let author: string | null = null
  if (r.share_show_author) {
    const { data } = await service().auth.admin.getUserById(r.user_id)
    const meta = data?.user?.user_metadata as Record<string, unknown> | undefined
    author = (meta?.full_name as string) || (meta?.name as string) || null
  }

  const { body, sources: blockSources } = splitSources(r.summary ?? "")
  const md = normalizeReport(body)
  const toc = headingsOf(md)
  const sources = blockSources.length ? blockSources : inlineSources(r.summary ?? "")
  const figures = extractFigures(body)
  const date = new Date(r.created_at).toLocaleDateString(t.locale, { day: "numeric", month: "long", year: "numeric" })
  const minutes = readingMinutes(md)

  return (
    <main className="rs">
      <style>{SHARE_CSS}</style>
      <div className="rs-progress" aria-hidden />
      <TopBar t={t} />

      {/* Hero */}
      <section className="rs-hero">
        <div className="rs-hero-glow" aria-hidden />
        <div className="rs-hero-in">
          <div className="rs-badge">
            <span className="rs-badge-line" aria-hidden><i /></span>
            {t.badge}
          </div>
          <h1>{r.company_name}</h1>
          <div className="rs-meta">
            <span className="rs-chip"><span className="rs-av" aria-hidden>{(author || "A").charAt(0).toUpperCase()}</span>{author || t.madeBy}</span>
            <span className="rs-chip">{date}</span>
            <span className="rs-chip">{minutes} {t.read}</span>
          </div>
        </div>
        <div className="rs-hero-line" aria-hidden><i /></div>
      </section>

      {/* Body */}
      <div className={`rs-layout${toc.length >= 2 ? " has-toc" : ""}`}>
        {toc.length >= 2 && (
          <aside className="rs-toc" aria-label={t.contents}>
            <div className="rs-kicker">{t.contents}</div>
            <ol>{toc.map((h, i) => <li key={h.id + i}><a href={`#${h.id}`}><span>{String(i + 1).padStart(2, "0")}</span>{h.text}</a></li>)}</ol>
          </aside>
        )}

        <article className="rs-article">
          {toc.length >= 2 && (
            <details className="rs-toc-m">
              <summary>{t.contents} · {toc.length}</summary>
              <ol>{toc.map((h, i) => <li key={h.id + i}><a href={`#${h.id}`}><span>{String(i + 1).padStart(2, "0")}</span>{h.text}</a></li>)}</ol>
            </details>
          )}

          {r.share_show_charts && <Charts raw={r.chart_data} title={t.figures} />}

          {r.share_show_charts && figures.length > 0 && !hasStats(r.chart_data) && (
            <section className="rs-block">
              <div className="rs-kicker">{t.figures}</div>
              <div className={`rs-figs n${Math.min(figures.length, 4)}`}>
                {figures.map((f, i) => (
                  <div key={i} className="rs-fig" style={{ ["--c" as string]: ["#E8002A", "#06B6D4", "#8B5CF6", "#F59E0B"][i % 4] } as React.CSSProperties}>
                    <b>{f.value}</b>
                    <span>{f.label}</span>
                    {f.source && <em>{f.source}</em>}
                  </div>
                ))}
              </div>
            </section>
          )}

          {body.trim() ? (
            <div className="rs-md">
              <ReactMarkdown remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <Heading level={2}>{children}</Heading>,
                  h2: ({ children }) => <Heading level={2}>{children}</Heading>,
                  h3: ({ children }) => <Heading level={3}>{children}</Heading>,
                  a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
                  table: ({ children }) => <div className="rs-table"><table>{children}</table></div>,
                }}>
                {md}
              </ReactMarkdown>
            </div>
          ) : <p className="rs-empty">{t.empty}</p>}

          {r.share_show_sources && sources.length > 0 && (
            <section className="rs-block rs-block-end">
              <div className="rs-kicker">{t.sources}</div>
              <ul className="rs-sources">
                {sources.map((s, i) => {
                  const p = sourceParts(s)
                  const inner = (<>
                    <span className="rs-src-n">{String(i + 1).padStart(2, "0")}</span>
                    <span className="rs-src-t">{p.label}</span>
                    {p.host && <span className="rs-src-h">{p.host} ↗</span>}
                  </>)
                  return (
                    <li key={i}>
                      {p.href
                        ? <a href={p.href} target="_blank" rel="noopener noreferrer nofollow">{inner}</a>
                        : <div>{inner}</div>}
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </article>
      </div>

      {/* CTA */}
      <section className="rs-cta">
        <div className="rs-cta-card">
          <div className="rs-cta-glow" aria-hidden />
          <div className="rs-cta-head">
            <img src="/astrocore-logo.png" alt="AstroCore" className="rs-logo-img big" width={52} height={52} />
            <div>
              <div className="rs-kicker">{t.ctaKicker}</div>
              <h2>{t.ctaTitle}</h2>
            </div>
          </div>
          <p className="rs-cta-text">{t.ctaText}</p>
          <div className="rs-feats">
            {[[t.f1t, t.f1d, "#F59E0B"], [t.f2t, t.f2d, "#06B6D4"], [t.f3t, t.f3d, "#8B5CF6"]].map(([ft, fd, c]) => (
              <div key={ft} className="rs-feat" style={{ ["--c" as string]: c } as React.CSSProperties}>
                <b>{ft}</b><span>{fd}</span>
              </div>
            ))}
          </div>
          <div className="rs-cta-row">
            <Link className="rs-btn rs-btn-lg" href="/register?ref=share">{t.try} →</Link>
            <span className="rs-free"><i aria-hidden />{t.free}</span>
          </div>
        </div>
        <footer className="rs-foot">
          <Link href="/?ref=share">astrocore.one</Link>
          <span>·</span>
          <Link href="/terms">Terms</Link>
          <span>·</span>
          <Link href="/privacy-policy">Privacy</Link>
        </footer>
      </section>
    </main>
  )
}

// Styles live here (not in a separate .css file), like the other AstroCore pages.
const SHARE_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');

.rs { --red:#E8002A; --t1:#F0EDF8; --t2:#D8D4EC; --t3:#A8A4BC; --t4:#6A6A8A; --line:rgba(255,255,255,.09);
  min-height: 100vh; background: #08080F; color: var(--t2); position: relative; overflow-x: clip;
  background-image: radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px); background-size: 24px 24px;
  font-family: 'Inter', system-ui, -apple-system, "Segoe UI", sans-serif; font-feature-settings: "cv11", "ss01"; -webkit-font-smoothing: antialiased; }
.rs ::selection { background: rgba(232,0,42,.35); color: #fff; }
.rs-progress { position: fixed; top: 0; left: 0; right: 0; height: 2px; z-index: 40; transform-origin: 0 50%; transform: scaleX(0);
  background: linear-gradient(90deg, #E8002A, #FF4D6A); box-shadow: 0 0 10px rgba(232,0,42,.7);
  animation: rsProgress linear both; animation-timeline: scroll(root); }
@keyframes rsProgress { to { transform: scaleX(1); } }
@supports not (animation-timeline: scroll()) { .rs-progress { display: none; } }
.rs-logo-img { width: 32px; height: 32px; border-radius: 9px; object-fit: cover; object-position: center 18%; background: #000; flex: none;
  box-shadow: 0 0 0 1.5px rgba(232,0,42,.42), 0 0 20px rgba(232,0,42,.3); }
.rs-logo-img.big { width: 52px; height: 52px; border-radius: 14px; }
.rs a { color: inherit; }
.rs-scan { position: fixed; top: 0; left: 0; right: 0; height: 1px; z-index: 30; pointer-events: none;
  background: linear-gradient(90deg, transparent, rgba(232,0,42,.6), transparent); animation: rsScan 6s linear infinite; }
@keyframes rsScan { 0% { transform: translateX(-100%); opacity: 0 } 10% { opacity: 1 } 90% { opacity: 1 } 100% { transform: translateX(100%); opacity: 0 } }

.rs-top { position: sticky; top: 0; z-index: 20; background: rgba(8,8,15,.78); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  border-bottom: 0.5px solid var(--line); }
.rs-top-in { max-width: 1380px; margin: 0 auto; padding: 12px 20px; display: flex; align-items: center; gap: 12px; }
.rs-brand { display: inline-flex; align-items: center; gap: 10px; text-decoration: none;
  font: 700 17px 'Space Grotesk', system-ui, sans-serif; color: var(--t1) !important; letter-spacing: -.02em; }
.rs-brand em { font-style: normal; color: var(--red); }
.rs-logo { width: 26px; height: 26px; border-radius: 50%; display: inline-block; flex: none;
  background: radial-gradient(circle at 35% 35%, #FF4D6A, #E8002A 55%, #5A0012); box-shadow: 0 0 16px rgba(232,0,42,.5), inset 0 1px 0 rgba(255,255,255,.25); }
.rs-logo.big { width: 44px; height: 44px; }

.rs-btn { display: inline-flex; align-items: center; gap: 8px; padding: 11px 20px; border-radius: 11px; text-decoration: none;
  font: 600 14px system-ui, sans-serif; color: #fff !important; background: var(--red);
  box-shadow: 0 0 0 1px rgba(255,255,255,.06) inset, 0 8px 24px rgba(232,0,42,.25); transition: background .15s, box-shadow .15s, transform .15s; }
.rs-btn:hover { background: #FF1A3E; box-shadow: 0 0 28px rgba(232,0,42,.45); transform: translateY(-1px); }
.rs-btn-sm { margin-left: auto; padding: 8px 14px; font-size: 13px; }
.rs-btn-lg { padding: 13px 24px; font-size: 15px; }

.rs-hero { position: relative; border-bottom: 0.5px solid var(--line); overflow: hidden; }
.rs-hero-glow { position: absolute; inset: 0; pointer-events: none;
  background: radial-gradient(ellipse 60% 90% at 50% 0%, rgba(232,0,42,.14), transparent 70%), radial-gradient(ellipse 40% 80% at 100% 50%, rgba(232,0,42,.07), transparent 70%); }
.rs-hero-in { position: relative; max-width: 1380px; margin: 0 auto; padding: 56px 20px 40px; }
.rs-badge { display: inline-flex; align-items: center; gap: 9px; padding: 5px 13px 5px 11px; border-radius: 20px;
  background: rgba(232,0,42,.08); border: 0.5px solid rgba(232,0,42,.3);
  font: 600 10.5px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--red); }
.rs-badge-line { position: relative; width: 20px; height: 1.5px; border-radius: 1px; background: rgba(232,0,42,.25); overflow: hidden; }
.rs-badge-line i { position: absolute; top: 0; left: -40%; width: 40%; height: 100%; background: linear-gradient(90deg, transparent, #E8002A, transparent); animation: rsBadge 1.6s linear infinite; }
@keyframes rsBadge { to { left: 100%; } }
.rs-hero h1 { margin: 18px 0; max-width: 30ch; font: 700 clamp(28px, 4.6vw, 46px)/1.1 'Space Grotesk', system-ui, sans-serif;
  letter-spacing: -.03em; color: var(--t1); text-wrap: balance; }
.rs-meta { display: flex; flex-wrap: wrap; gap: 8px; }
.rs-chip { display: inline-flex; align-items: center; gap: 8px; padding: 6px 12px; border-radius: 9px; font-size: 12.5px; color: var(--t3);
  background: rgba(255,255,255,.035); border: 0.5px solid var(--line); }
.rs-av { width: 20px; height: 20px; border-radius: 6px; display: grid; place-items: center; background: var(--red); color: #fff; font: 700 10.5px 'Space Grotesk', sans-serif; }
.rs-hero-line { position: absolute; left: 0; right: 0; bottom: 0; height: 1.5px; background: rgba(255,255,255,.06); overflow: hidden; }
.rs-hero-line i { position: absolute; top: 0; left: -20%; width: 20%; height: 100%; background: linear-gradient(90deg, transparent, #E8002A, transparent);
  box-shadow: 0 0 10px rgba(232,0,42,.85); animation: rsLine 3s linear infinite; }
@keyframes rsLine { to { left: 100%; } }

.rs-layout { max-width: 1380px; margin: 0 auto; padding: 40px 20px 20px; display: grid; grid-template-columns: minmax(0, 1fr); gap: 44px; }
.rs-layout.has-toc { grid-template-columns: 250px minmax(0, 1fr); gap: 64px; }
@media (max-width: 900px) { .rs-layout.has-toc { grid-template-columns: minmax(0, 1fr); } .rs-toc { display: none; } }
.rs-article { min-width: 0; max-width: 900px; }
.rs-kicker { font: 600 10.5px 'JetBrains Mono', ui-monospace, monospace; letter-spacing: .12em; text-transform: uppercase; color: var(--t4); margin-bottom: 12px; }

.rs-toc { position: sticky; top: 80px; align-self: start; max-height: calc(100vh - 110px); overflow-y: auto; padding-right: 6px; scrollbar-width: thin; }
.rs-toc ol { list-style: none; margin: 0; padding: 0 0 0 12px; border-left: 1px solid var(--line); display: flex; flex-direction: column; gap: 2px; }
.rs-toc a { display: flex; gap: 10px; padding: 6px 8px; border-radius: 8px; text-decoration: none; font-size: 13px; line-height: 1.4; color: var(--t3); transition: background .15s, color .15s; }
.rs-toc a:hover { color: var(--t1); background: rgba(232,0,42,.06); }
.rs-toc-m { display: none; margin: 0 0 28px; border-radius: 12px; background: #0D0D15; border: 0.5px solid var(--line); }
.rs-toc-m summary { cursor: pointer; padding: 12px 14px; font: 600 12px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--t3); list-style: none; }
.rs-toc-m summary::after { content: "+"; float: right; color: var(--red); }
.rs-toc-m[open] summary::after { content: "–"; }
.rs-toc-m ol { list-style: none; margin: 0; padding: 0 8px 10px; }
.rs-toc-m a { display: flex; gap: 10px; padding: 8px; border-radius: 8px; text-decoration: none; font-size: 14px; color: var(--t2); }
.rs-toc-m a span { font: 600 11px 'JetBrains Mono', monospace; color: var(--red); padding-top: 3px; }
@media (max-width: 900px) { .rs-toc-m { display: block; } }
.rs-toc a span { font: 600 10.5px 'JetBrains Mono', monospace; color: var(--red); padding-top: 2px; }

.rs-md { font-size: 17px; line-height: 1.78; color: #CFCBE2; counter-reset: rsH; letter-spacing: -.003em; }
.rs-md > :first-child { margin-top: 0; }
.rs-md > p:first-child { font-size: 19px; line-height: 1.7; color: var(--t1); }
.rs-md h2 { counter-increment: rsH; display: flex; align-items: center; gap: 14px; margin: 56px 0 18px; padding-top: 22px; scroll-margin-top: 90px;
  border-top: 0.5px solid var(--line); font: 600 22px/1.3 'Space Grotesk', system-ui, sans-serif; letter-spacing: -.015em; color: var(--t1); }
.rs-md h2::before { content: counter(rsH, decimal-leading-zero); flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 10px;
  font: 600 12px 'JetBrains Mono', monospace; color: var(--red); background: rgba(232,0,42,.09); border: 0.5px solid rgba(232,0,42,.3); }
.rs-md hr + h2, .rs-md > h2:first-child { border-top: 0; padding-top: 0; }
.rs-md h3 { margin: 32px 0 10px; scroll-margin-top: 90px; font: 600 17px/1.4 'Space Grotesk', system-ui, sans-serif; color: var(--t1); }
.rs-md p { margin: 0 0 18px; }
.rs-md p > strong:only-child { display: block; margin-top: 26px; font: 600 12px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: var(--t3); }
.rs-md ul, .rs-md ol { margin: 0 0 22px; padding-left: 0; list-style: none; }
.rs-md ol { counter-reset: rsLi; }
.rs-md li { position: relative; margin: 10px 0; padding-left: 26px; }
.rs-md ul > li::before { content: ""; position: absolute; left: 6px; top: .72em; width: 6px; height: 6px; border-radius: 50%; background: var(--red); box-shadow: 0 0 8px rgba(232,0,42,.6); }
.rs-md ol > li { counter-increment: rsLi; }
.rs-md ol > li::before { content: counter(rsLi); position: absolute; left: 0; top: .2em; width: 19px; height: 19px; border-radius: 6px; display: grid; place-items: center;
  font: 600 10.5px 'JetBrains Mono', monospace; color: var(--red); background: rgba(232,0,42,.09); }
.rs-md li > ul, .rs-md li > ol { margin: 8px 0 0; }
.rs-md strong { color: var(--t1); font-weight: 600; }
.rs-md a { color: #7DD3FC; text-decoration: none; border-bottom: 1px solid rgba(125,211,252,.3); }
.rs-md a:hover { border-color: #7DD3FC; }
.rs-md hr { border: 0; height: 1px; margin: 32px 0; background: linear-gradient(90deg, rgba(232,0,42,.5), transparent); }
.rs-md code { font-family: 'JetBrains Mono', monospace; font-size: .86em; background: #16162A; padding: 2px 6px; border-radius: 5px; color: #FFB4C0; }
.rs-md pre { background: #0D0D15; border: 0.5px solid var(--line); padding: 14px; border-radius: 12px; overflow-x: auto; }
.rs-md pre code { background: none; padding: 0; color: var(--t2); }
.rs-md blockquote { margin: 0 0 18px; padding: 12px 16px; border-radius: 0 12px 12px 0; border-left: 2px solid var(--red);
  background: linear-gradient(90deg, rgba(232,0,42,.08), transparent); color: var(--t2); }
.rs-md blockquote p:last-child { margin: 0; }
.rs-table { margin: 0 0 20px; overflow-x: auto; border-radius: 12px; border: 0.5px solid var(--line); background: #0D0D15; }
.rs-table table { width: 100%; border-collapse: collapse; font-size: 14px; }
.rs-table th, .rs-table td { padding: 10px 14px; text-align: left; border-bottom: 0.5px solid var(--line); }
.rs-table th { font: 600 11px 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: var(--t3); background: rgba(255,255,255,.03); }
.rs-table tr:last-child td { border-bottom: 0; }
.rs-empty { color: var(--t4); }

.rs-block { margin: 0 0 40px; }
.rs-figs { display: grid; gap: 12px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
.rs-figs.n1 { grid-template-columns: 1fr; }
@media (max-width: 600px) { .rs-figs { grid-template-columns: 1fr; } }
.rs-fig { position: relative; overflow: hidden; padding: 18px 18px 16px; border-radius: 14px; display: flex; flex-direction: column; gap: 6px;
  background: linear-gradient(160deg, #11111C, #0E0E18); border: 0.5px solid var(--line); }
.rs-fig::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px; background: linear-gradient(180deg, transparent, var(--c), transparent); }
.rs-fig::after { content: ""; position: absolute; right: -40px; top: -40px; width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(closest-side, var(--c), transparent); opacity: .14; }
.rs-fig b { font: 700 34px/1 'Space Grotesk', system-ui, sans-serif; letter-spacing: -.03em; color: var(--t1); }
.rs-fig span { font-size: 14px; line-height: 1.5; color: var(--t3); }
.rs-fig em { font: normal 10.5px 'JetBrains Mono', monospace; color: var(--t4); }
.rs-block-end { margin-top: 44px; }
.rs-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-bottom: 12px; }
.rs-stat { position: relative; overflow: hidden; padding: 16px; border-radius: 14px; display: flex; flex-direction: column; gap: 6px;
  background: linear-gradient(160deg, #11111C, #0E0E18); border: 0.5px solid var(--line); }
.rs-stat::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px; background: linear-gradient(180deg, transparent, var(--c), transparent); }
.rs-stat::after { content: ""; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(closest-side, var(--c), transparent); opacity: .12; }
.rs-stat b { font: 700 26px 'Space Grotesk', system-ui, sans-serif; color: var(--t1); letter-spacing: -.02em; }
.rs-stat span { font-size: 12.5px; color: var(--t3); line-height: 1.4; }
.rs-bars { display: flex; align-items: flex-end; gap: 10px; height: 200px; padding: 18px 16px 10px; border-radius: 14px; overflow-x: auto;
  background: linear-gradient(160deg, #11111C, #0E0E18); border: 0.5px solid var(--line); }
.rs-bar { flex: 1; min-width: 26px; height: 100%; display: flex; flex-direction: column; justify-content: flex-end; align-items: center; gap: 6px; }
.rs-bar em { font: normal 600 10.5px 'JetBrains Mono', monospace; color: var(--t3); }
.rs-bar i { width: 100%; border-radius: 7px 7px 2px 2px; display: block; background: linear-gradient(180deg, #FF4D6A, rgba(232,0,42,.25)); box-shadow: 0 0 14px rgba(232,0,42,.2); }
.rs-bar span { font: 10px 'JetBrains Mono', monospace; color: var(--t4); white-space: nowrap; }

.rs-sources { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rs-sources a, .rs-sources li > div { display: flex; align-items: center; gap: 12px; padding: 11px 14px; border-radius: 11px; text-decoration: none;
  background: #0D0D15; border: 0.5px solid var(--line); transition: border-color .15s, background .15s; }
.rs-sources a:hover { border-color: rgba(232,0,42,.4); background: rgba(232,0,42,.05); }
.rs-src-n { font: 600 11px 'JetBrains Mono', monospace; color: var(--red); flex: none; }
.rs-src-t { flex: 1; min-width: 0; font-size: 14px; color: var(--t2); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.rs-src-h { flex: none; font: 11px 'JetBrains Mono', monospace; color: #7DD3FC; }

.rs-cta { max-width: 1380px; margin: 0 auto; padding: 40px 20px 30px; }
.rs-cta-card { position: relative; overflow: hidden; border-radius: 20px; padding: 32px; display: flex; flex-direction: column; gap: 18px;
  background: linear-gradient(150deg, rgba(232,0,42,.12), #0E0E18 45%, #0B0B14); border: 0.5px solid rgba(232,0,42,.32);
  box-shadow: 0 30px 80px rgba(0,0,0,.5), 0 0 60px rgba(232,0,42,.08); }
.rs-cta-glow { position: absolute; right: -80px; top: -80px; width: 280px; height: 280px; border-radius: 50%; pointer-events: none;
  background: radial-gradient(closest-side, rgba(232,0,42,.22), transparent); }
.rs-cta-head { position: relative; display: flex; align-items: center; gap: 16px; }
.rs-cta-head .rs-kicker { margin: 0 0 4px; color: var(--red); }
.rs-cta-head h2 { margin: 0; font: 700 clamp(22px, 3.4vw, 30px)/1.15 'Space Grotesk', system-ui, sans-serif; letter-spacing: -.02em; color: var(--t1); }
.rs-cta-text { position: relative; margin: 0; max-width: 62ch; font-size: 15.5px; line-height: 1.65; color: var(--t3); }
.rs-feats { position: relative; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
@media (max-width: 760px) { .rs-feats { grid-template-columns: 1fr; } .rs-cta-card { padding: 24px 20px; } }
.rs-feat { position: relative; overflow: hidden; padding: 14px 16px; border-radius: 13px; display: flex; flex-direction: column; gap: 5px;
  background: rgba(8,8,15,.6); border: 0.5px solid var(--line); }
.rs-feat::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2px; background: linear-gradient(180deg, transparent, var(--c), transparent); }
.rs-feat b { font: 600 14.5px 'Space Grotesk', system-ui, sans-serif; color: var(--t1); }
.rs-feat span { font-size: 13px; line-height: 1.5; color: var(--t3); }
.rs-cta-row { position: relative; display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.rs-free { display: inline-flex; align-items: center; gap: 8px; font-size: 13px; color: var(--t3); }
.rs-free i { width: 7px; height: 7px; border-radius: 50%; background: #22C55E; box-shadow: 0 0 0 4px rgba(34,197,94,.15); }
.rs-foot { display: flex; justify-content: center; gap: 10px; padding: 24px 0 10px; font-size: 12.5px; color: var(--t4); }
.rs-foot a { color: var(--t4); text-decoration: none; }
.rs-foot a:hover { color: var(--t1); }

.rs-hidden { max-width: 480px; margin: 0 auto; padding: 120px 20px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 14px; }
.rs-hidden h1 { margin: 6px 0 0; font: 700 28px 'Space Grotesk', system-ui, sans-serif; color: var(--t1); }
.rs-hidden p { margin: 0 0 8px; color: var(--t3); font-size: 15px; }

@media (prefers-reduced-motion: reduce) { .rs-scan, .rs-badge-line i, .rs-hero-line i { animation: none; } }
`