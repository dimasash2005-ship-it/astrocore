// Shared pieces of the public client portal (/c/<slug>): texts, header, footer, styles.
// Server components (no "use client").

import Link from "next/link"
import { headers } from "next/headers"
import type { PortalClient } from "@/lib/server/portal"

export const PTX = {
  uk: {
    kicker: "Кабінет клієнта", reports: "Звітів", updated: "Оновлено", month: "Цього місяця", latest: "Останній звіт",
    read: "Читати", all: "Усі звіти", empty: "Звітів поки немає", emptyD: "Як тільки команда підготує перший звіт, він з'явиться тут.",
    back: "До всіх звітів", powered: "Працює на", off: "Кабінет вимкнено", offD: "Власник тимчасово закрив цю сторінку.",
    locale: "uk-UA", min: "хв читання", never: "ще ні",
  },
  en: {
    kicker: "Client portal", reports: "Reports", updated: "Updated", month: "This month", latest: "Latest report",
    read: "Read", all: "All reports", empty: "No reports yet", emptyD: "As soon as the team prepares the first report, it will show up here.",
    back: "All reports", powered: "Powered by", off: "Portal is off", offD: "The owner has closed this page for now.",
    locale: "en-US", min: "min read", never: "not yet",
  },
}
export type PT = typeof PTX.uk

export async function portalLang(): Promise<"uk" | "en"> {
  const al = ((await headers()).get("accept-language") || "").toLowerCase()
  return /^(uk|ru)|,\s*(uk|ru)/.test(al) ? "uk" : "en"
}

export function fmtDate(iso: string, t: PT, withYear = false) {
  return new Date(iso).toLocaleDateString(t.locale, { day: "numeric", month: "long", ...(withYear ? { year: "numeric" } : {}) })
}

export function PortalHeader({ c, t, small }: { c: PortalClient; t: PT; small?: boolean }) {
  return (
    <header className={`cp-head${small ? " sm" : ""}`}>
      <Link href={`/c/${c.slug}`} className="cp-id">
        {c.logo_url
          ? <img src={c.logo_url} alt="" className="cp-logo" />
          : <span className="cp-logo cp-init">{c.name.charAt(0).toUpperCase()}</span>}
        <span className="cp-idtx"><b>{c.name}</b><small>{t.kicker}</small></span>
      </Link>
    </header>
  )
}

export function PortalFooter({ c, t }: { c: PortalClient; t: PT }) {
  if (!c.show_powered) return <footer className="cp-foot" />
  return (
    <footer className="cp-foot">
      <a href="https://astrocore.one/?ref=client-portal" target="_blank" rel="noopener" className="cp-pow">
        {t.powered} <b>ASTRO<span>CORE</span></b>
      </a>
    </footer>
  )
}

export const PORTAL_CSS = `
.cp { min-height: 100vh; color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif; padding: 0 20px 40px; position: relative; overflow-x: hidden;
  background: radial-gradient(ellipse 70% 45% at 50% -5%, color-mix(in srgb, var(--c) 26%, transparent), transparent 70%), #08080F; }
.cp::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, var(--c) 30%, #fff 50%, var(--c) 70%, transparent); }
.cp-wrap { max-width: 980px; margin: 0 auto; position: relative; }
.cp-head { padding: 34px 0 10px; display: flex; align-items: center; }
.cp-head.sm { padding: 22px 0 6px; }
.cp-id { display: flex; align-items: center; gap: 14px; text-decoration: none; color: inherit; }
.cp-logo { width: 54px; height: 54px; border-radius: 14px; object-fit: cover; background: #111; border: 1px solid color-mix(in srgb, var(--c) 50%, transparent);
  box-shadow: 0 0 26px color-mix(in srgb, var(--c) 35%, transparent); }
.cp-head.sm .cp-logo { width: 38px; height: 38px; border-radius: 10px; }
img.cp-logo { object-fit: contain; padding: 6px; box-sizing: border-box; background: color-mix(in srgb, var(--c) 12%, #0E0C16); }
.cp-head.sm img.cp-logo { padding: 4px; }
.cp-init { display: grid; place-items: center; font-size: 24px; font-weight: 700; color: #fff; background: linear-gradient(140deg, var(--c), color-mix(in srgb, var(--c) 50%, #000)); }
.cp-head.sm .cp-init { font-size: 17px; }
.cp-idtx { display: flex; flex-direction: column; gap: 2px; }
.cp-idtx b { font-size: 24px; letter-spacing: -.02em; } .cp-head.sm .cp-idtx b { font-size: 17px; }
.cp-idtx small { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .2em; text-transform: uppercase; color: var(--c); filter: brightness(1.3); }
.cp-intro { margin: 14px 0 0; max-width: 680px; color: #B8B4CC; font-size: 15px; line-height: 1.65; white-space: pre-line; }
.cp-stats { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 26px 0 0; }
.cp-stat { padding: 16px 18px; border-radius: 14px; background: rgba(255,255,255,.035); border: .5px solid rgba(255,255,255,.09); display: flex; flex-direction: column; gap: 4px; }
.cp-stat b { font-size: 26px; line-height: 1.1; } .cp-stat span { font-size: 12px; color: #8A8AAA; }
.cp-k { font: 600 11px 'JetBrains Mono', monospace; letter-spacing: .2em; text-transform: uppercase; color: #8A8AAA; margin: 34px 0 12px; }
.cp-feat { display: block; text-decoration: none; color: inherit; padding: 26px 28px; border-radius: 20px; position: relative; overflow: hidden;
  background: linear-gradient(150deg, color-mix(in srgb, var(--c) 14%, #12101B), #0D0C16); border: .5px solid color-mix(in srgb, var(--c) 45%, transparent);
  box-shadow: 0 24px 70px rgba(0,0,0,.45); transition: transform .2s, box-shadow .2s; }
.cp-feat:hover { transform: translateY(-2px); box-shadow: 0 28px 80px rgba(0,0,0,.55), 0 0 40px color-mix(in srgb, var(--c) 22%, transparent); }
.cp-feat small { font: 500 12px 'JetBrains Mono', monospace; color: #8A8AAA; }
.cp-feat h2 { margin: 8px 0 10px; font-size: clamp(22px, 3.4vw, 30px); letter-spacing: -.02em; line-height: 1.15; }
.cp-feat p { margin: 0; color: #B8B4CC; line-height: 1.6; font-size: 14.5px; }
.cp-go { display: inline-flex; margin-top: 16px; font-weight: 600; font-size: 14px; color: #fff; padding: 9px 16px; border-radius: 10px; background: var(--c); }
.cp-list { display: flex; flex-direction: column; border-radius: 16px; overflow: hidden; border: .5px solid rgba(255,255,255,.08); background: rgba(255,255,255,.02); }
.cp-row { display: grid; grid-template-columns: 110px 1fr auto; gap: 16px; align-items: center; padding: 16px 18px; text-decoration: none; color: inherit;
  border-top: .5px solid rgba(255,255,255,.06); transition: background .15s; position: relative; }
.cp-row:first-child { border-top: 0; }
.cp-row:hover { background: color-mix(in srgb, var(--c) 7%, transparent); }
.cp-row::before { content: ""; position: absolute; left: 0; top: 30%; bottom: 30%; width: 2px; border-radius: 2px; background: var(--c); opacity: 0; transition: opacity .15s; }
.cp-row:hover::before { opacity: 1; }
.cp-date { font: 500 12px 'JetBrains Mono', monospace; color: #8A8AAA; }
.cp-row b { display: block; font-size: 15px; margin-bottom: 3px; }
.cp-row p { margin: 0; color: #8A8AAA; font-size: 13px; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
.cp-row i { font-style: normal; color: var(--c); font-size: 18px; }
.cp-empty { text-align: center; padding: 60px 20px; border-radius: 18px; border: .5px dashed rgba(255,255,255,.14); color: #8A8AAA; }
.cp-empty b { display: block; color: #F0EDF8; font-size: 18px; margin-bottom: 6px; }
.cp-foot { margin-top: 50px; display: flex; justify-content: center; min-height: 20px; }
.cp-pow { font: 500 11.5px 'JetBrains Mono', monospace; color: #6A6A8A; text-decoration: none; letter-spacing: .06em; }
.cp-pow b { color: #C8C4D8; letter-spacing: .3em; margin-left: 6px; } .cp-pow b span { color: #E8002A; }
.cp-pow:hover b { color: #fff; }
.cp-back { display: inline-flex; gap: 6px; margin: 18px 0 6px; font-size: 13px; color: #A8A4BC; text-decoration: none; }
.cp-back:hover { color: #fff; }
.cp-doc { margin-top: 10px; padding: 34px 38px; border-radius: 20px; background: #0D0C16; border: .5px solid rgba(255,255,255,.09); }
.cp-doc h1.cp-title { font-size: clamp(26px, 4vw, 38px); letter-spacing: -.03em; line-height: 1.12; margin: 6px 0 8px; }
.cp-meta { font: 500 12px 'JetBrains Mono', monospace; color: #8A8AAA; }
.cp-md { margin-top: 26px; font-family: system-ui, sans-serif; font-size: 16px; line-height: 1.75; color: #D8D4EC; overflow-wrap: anywhere; }
.cp-md h2 { font-family: 'Space Grotesk', sans-serif; font-size: 22px; color: #F0EDF8; margin: 30px 0 10px; letter-spacing: -.01em; }
.cp-md h3 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; color: #F0EDF8; margin: 24px 0 8px; }
.cp-md a { color: color-mix(in srgb, var(--c) 60%, #fff); }
.cp-md ul, .cp-md ol { padding-left: 22px; } .cp-md li { margin: 4px 0; }
.cp-md blockquote { margin: 16px 0; padding: 10px 16px; border-left: 3px solid var(--c); background: rgba(255,255,255,.03); border-radius: 0 10px 10px 0; color: #B8B4CC; }
.cp-md code { font-family: 'JetBrains Mono', monospace; font-size: 13.5px; background: rgba(255,255,255,.06); padding: 2px 6px; border-radius: 5px; }
.cp-md pre { background: rgba(255,255,255,.04); padding: 14px; border-radius: 10px; overflow-x: auto; }
.cp-md pre code { background: none; padding: 0; }
.cp-tbl { overflow-x: auto; margin: 16px 0; border-radius: 12px; border: .5px solid rgba(255,255,255,.1); }
.cp-md table { width: 100%; border-collapse: collapse; font-size: 14px; }
.cp-md th { text-align: left; font-weight: 600; color: #F0EDF8; background: color-mix(in srgb, var(--c) 12%, transparent); }
.cp-md th, .cp-md td { padding: 10px 12px; border-bottom: .5px solid rgba(255,255,255,.08); }
.cp-md hr { border: 0; border-top: .5px solid rgba(255,255,255,.1); margin: 26px 0; }
.cp-gate { margin: 70px auto 0; max-width: 380px; display: flex; flex-direction: column; align-items: center; gap: 10px; text-align: center; padding: 30px 26px; border-radius: 20px;
  background: #0D0C16; border: .5px solid color-mix(in srgb, var(--c) 40%, transparent); box-shadow: 0 24px 70px rgba(0,0,0,.5); }
.cp-gate-ic { width: 46px; height: 46px; border-radius: 13px; display: grid; place-items: center; color: #fff; background: var(--c); box-shadow: 0 0 24px color-mix(in srgb, var(--c) 45%, transparent); }
.cp-gate b { font-size: 18px; } .cp-gate small { color: #8A8AAA; font-size: 13px; margin-bottom: 6px; }
.cp-gate input { width: 100%; padding: 12px 14px; border-radius: 11px; font-size: 15px; color: #F0EDF8; background: rgba(255,255,255,.05); border: .5px solid rgba(255,255,255,.14); outline: none; }
.cp-gate input:focus { border-color: var(--c); }
.cp-gate em { font-style: normal; color: #FF6B85; font-size: 13px; }
.cp-gate button { width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 12px; border-radius: 11px; border: none; cursor: pointer;
  font-size: 15px; font-weight: 600; color: #fff; background: var(--c); }
.cp-gate button:disabled { opacity: .55; cursor: default; }
.cp-spin { animation: cpSpin .8s linear infinite; } @keyframes cpSpin { to { transform: rotate(360deg); } }
@media (max-width: 640px) {
  .cp-stats { grid-template-columns: 1fr 1fr 1fr; gap: 6px; } .cp-stat { padding: 12px; } .cp-stat b { font-size: 20px; }
  .cp-row { grid-template-columns: 1fr auto; gap: 4px 10px; } .cp-date { grid-column: 1 / -1; }
  .cp-doc { padding: 22px 18px; } .cp-feat { padding: 20px; }
}
`
