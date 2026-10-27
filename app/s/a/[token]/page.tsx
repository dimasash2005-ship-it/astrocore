// app/s/a/[token]/page.tsx
//
// Public "agent card" page: astrocore.one/s/a/<token>
// Works without signing in. Shows the agent's star system, level and stats from the
// signed snapshot in the link, plus an invite to create your own agent.
// The link preview (X / Threads / Telegram) is the picture from /api/agents/card.

import type { Metadata } from "next"
import Link from "next/link"
import { decodeCard, CARD_TEXT } from "@/lib/server/agent-card"
import { unlockLabel, xpForLevel, MAX_LEVEL } from "@/lib/cosmos"
import AgentStar from "@/components/cosmos/AgentStar"
import CoreEye from "@/components/cosmos/CoreEye"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params
  const card = decodeCard(token)
  if (!card) return { title: "AstroCore", robots: { index: false } }
  const tx = CARD_TEXT[card.g]
  const image = { url: `/api/agents/card?t=${token}`, width: 1200, height: 630, alt: tx.pageTitle(card.n, card.l) }
  return {
    title: { absolute: tx.pageTitle(card.n, card.l) },
    description: tx.pageDesc(card),
    robots: { index: false },
    openGraph: { type: "website", siteName: "AstroCore AI", title: tx.pageTitle(card.n, card.l), description: tx.pageDesc(card), images: [image] },
    twitter: { card: "summary_large_image", title: tx.pageTitle(card.n, card.l), description: tx.pageDesc(card), images: [image.url] },
  }
}

export default async function AgentCardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const card = decodeCard(token)

  if (!card) {
    const tx = CARD_TEXT.en
    return (
      <main className="sa sa-bad">
        <style>{CSS}</style>
        <CoreEye size={150} mood="error" />
        <h1>{tx.invalid}</h1>
        <p>{tx.invalidD}</p>
        <Link href="/" className="sa-btn">{tx.home}</Link>
      </main>
    )
  }

  const tx = CARD_TEXT[card.g]
  const next = card.l < MAX_LEVEL ? xpForLevel(card.l + 1) : null
  const base = xpForLevel(card.l)
  const pct = next === null ? 100 : Math.max(5, Math.min(100, Math.round(((card.x - base) / (next - base)) * 100)))

  return (
    <main className="sa" style={{ ["--c" as string]: card.c } as React.CSSProperties}>
      <style>{CSS}</style>
      <span className="sa-line" aria-hidden />
      <header className="sa-top">
        <Link href="/" className="sa-brand">ASTRO<span>CORE</span></Link>
        <Link href="/register?ref=agent-card" className="sa-btn sm">{tx.cta}</Link>
      </header>

      <section className="sa-card">
        <div className="sa-star"><AgentStar name={card.n} color={card.c} level={card.l} streak={card.s} size={320} tile={false} /></div>
        <div className="sa-info">
          <span className="sa-kick">ASTROCORE · {tx.kicker}</span>
          <h1>{card.n}</h1>
          <div className="sa-lv"><b>LV {card.l}</b><span>{unlockLabel(card.l, card.g)}</span></div>
          <div className="sa-bar"><i style={{ width: `${pct}%` }} /></div>
          <small className="sa-xp">{next === null ? `${card.x} XP · MAX` : `${card.x} / ${next} XP`}{card.s >= 2 ? ` · 🔥 ${card.s} ${tx.streak}` : ""}</small>
          <div className="sa-stats">
            <div><b>{card.r}</b><span>{tx.replies}</span></div>
            <div><b>{card.m}</b><span>{tx.missions}</span></div>
            <div><b>{card.d}</b><span>{tx.days}</span></div>
          </div>
        </div>
      </section>

      <section className="sa-cta">
        <CoreEye size={96} track />
        <div>
          <h2>{tx.ctaTitle}</h2>
          <p>{tx.ctaText}</p>
          <div className="sa-row">
            <Link href="/register?ref=agent-card" className="sa-btn">{tx.cta} →</Link>
            <span className="sa-free">{tx.free}</span>
          </div>
        </div>
      </section>
    </main>
  )
}

const CSS = `
  .sa { min-height: 100vh; background: radial-gradient(ellipse 60% 50% at 30% 30%, color-mix(in srgb, var(--c, #E8002A) 14%, transparent), transparent 70%), #08080F;
    color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif; padding: 0 20px 60px; position: relative; overflow: hidden; }
  .sa-line { position: absolute; left: 0; right: 0; top: 0; height: 2px; background: linear-gradient(90deg, transparent, #E8002A 30%, #fff 50%, #E8002A 70%, transparent); }
  .sa-top { max-width: 1040px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; padding: 22px 0; }
  .sa-brand { font: 600 13px 'JetBrains Mono', monospace; letter-spacing: .4em; color: #F0EDF8; text-decoration: none; }
  .sa-brand span { color: #E8002A; }
  .sa-btn { display: inline-flex; align-items: center; gap: 6px; padding: 11px 20px; border-radius: 10px; background: #E8002A; color: #fff; text-decoration: none;
    font-size: 14px; font-weight: 600; box-shadow: 0 0 24px rgba(232,0,42,.35); transition: background .15s, transform .15s; }
  .sa-btn:hover { background: #FF1A3E; transform: translateY(-1px); }
  .sa-btn.sm { padding: 8px 14px; font-size: 13px; }
  .sa-card { max-width: 1040px; margin: 20px auto 0; display: grid; grid-template-columns: 360px 1fr; gap: 40px; align-items: center; padding: 36px;
    border-radius: 24px; background: linear-gradient(150deg, rgba(255,255,255,.035), rgba(255,255,255,.01)); border: .5px solid rgba(232,0,42,.25);
    box-shadow: 0 30px 90px rgba(0,0,0,.5); }
  .sa-star { display: grid; place-items: center; }
  .sa-kick { font: 600 12px 'JetBrains Mono', monospace; letter-spacing: .25em; color: #E8002A; }
  .sa h1 { font-size: clamp(40px, 6vw, 68px); line-height: 1.02; margin: 10px 0 16px; letter-spacing: -.03em; overflow-wrap: anywhere; }
  .sa-lv { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .sa-lv b { font: 700 18px 'JetBrains Mono', monospace; color: #0B0A12; background: #F5B13B; padding: 4px 12px; border-radius: 9px; }
  .sa-lv span { color: #C8C4D8; font-size: 16px; }
  .sa-bar { height: 7px; border-radius: 7px; background: rgba(255,255,255,.08); margin-top: 18px; max-width: 460px; overflow: hidden; }
  .sa-bar i { display: block; height: 100%; border-radius: 7px; background: linear-gradient(90deg, var(--c), #F5B13B); }
  .sa-xp { display: block; margin-top: 8px; font: 500 12.5px 'JetBrains Mono', monospace; color: #8A8AAA; }
  .sa-stats { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 24px; max-width: 520px; }
  .sa-stats div { padding: 14px 16px; border-radius: 14px; background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.09); display: flex; flex-direction: column; gap: 3px; }
  .sa-stats b { font-size: 30px; line-height: 1; }
  .sa-stats span { font-size: 12.5px; color: #8A8AAA; }
  .sa-cta { max-width: 1040px; margin: 24px auto 0; display: flex; gap: 26px; align-items: center; padding: 28px 32px; border-radius: 20px;
    background: rgba(232,0,42,.05); border: .5px solid rgba(232,0,42,.22); }
  .sa-cta h2 { margin: 0 0 6px; font-size: 22px; }
  .sa-cta p { margin: 0 0 16px; color: #A8A4BC; font-size: 14.5px; line-height: 1.6; max-width: 620px; }
  .sa-row { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
  .sa-free { font: 500 12px 'JetBrains Mono', monospace; color: #8A8AAA; }
  .sa-bad { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; }
  .sa-bad h1 { font-size: 28px; margin: 14px 0 0; } .sa-bad p { color: #A8A4BC; margin: 0 0 18px; }
  @media (max-width: 760px) {
    .sa-card { grid-template-columns: minmax(0, 1fr); padding: 24px 18px; gap: 10px; text-align: left; }
    .sa-star { transform: scale(.8); margin: -30px 0; }
    .sa-cta { flex-direction: column; align-items: flex-start; padding: 22px 18px; }
  }
`
