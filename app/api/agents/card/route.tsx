// app/api/agents/card/route.tsx
//
// The "agent card" picture (1200×630): the agent's star system, level and stats.
// Used as the link preview in X / Threads / Telegram and for "Download PNG".
// GET /api/agents/card?t=<signed token>

import { ImageResponse } from "next/og"
import { NextRequest } from "next/server"
import { decodeCard, CARD_TEXT } from "@/lib/server/agent-card"
import { unlockLabel } from "@/lib/cosmos"
import AgentCardImage, { CARD_W, CARD_H } from "@/components/cosmos/AgentCardImage"

export const dynamic = "force-dynamic"

// Google Fonts with only the letters we need (works for Cyrillic names too).
async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)
    if (!src) return null
    const res = await fetch(src[1])
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const card = decodeCard(req.nextUrl.searchParams.get("t") ?? "")
  if (!card) return new Response("Not found", { status: 404 })

  const tx = CARD_TEXT[card.g]
  const words = `${card.n}${tx.replies}${tx.missions}${tx.days}${tx.streak}${tx.tagline}${unlockLabel(card.l, card.g)}0123456789kMAX`
  const mono = `ASTROCORE·${tx.kicker}LV0123456789/XPMAX·${tx.streak}astrocore.one${tx.tagline} `
  const [bold, regular, monoBold, monoReg] = await Promise.all([
    font("Manrope", 800, words), font("Manrope", 500, words),
    font("JetBrains Mono", 700, mono), font("JetBrains Mono", 500, mono),
  ])
  const fonts = [
    bold && { name: "Manrope", data: bold, weight: 800 as const, style: "normal" as const },
    regular && { name: "Manrope", data: regular, weight: 500 as const, style: "normal" as const },
    monoBold && { name: "JetBrains Mono", data: monoBold, weight: 700 as const, style: "normal" as const },
    monoReg && { name: "JetBrains Mono", data: monoReg, weight: 500 as const, style: "normal" as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 500 | 700 | 800; style: "normal" }[]

  return new ImageResponse(<AgentCardImage card={card} />, {
    width: CARD_W, height: CARD_H, fonts,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  })
}
