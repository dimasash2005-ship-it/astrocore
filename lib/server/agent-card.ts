// lib/server/agent-card.ts
//
// "Share your agent" cards. The card is a snapshot: name, colour, level and stats
// at the moment of sharing, packed into the link and signed, so nobody can forge
// a card with fake numbers and no database table is needed.
// Nothing private goes into the card: no email, no chats, no ids.

import { createHmac, timingSafeEqual } from "crypto"

export type AgentCard = {
  n: string       // agent name
  c: string       // colour #RRGGBB
  l: number       // level
  x: number       // xp
  r: number       // replies
  m: number       // mission runs
  d: number       // active days
  s: number       // streak (days)
  g: "uk" | "en"  // language of the card
  t: number       // created, unix seconds
}

function secret(): string {
  const s = process.env.SHARE_SECRET || process.env.PROVIDER_ENCRYPTION_KEY || process.env.CRON_SECRET
  if (!s) throw new Error("No secret for share cards (set SHARE_SECRET).")
  return "agent-card:" + s
}

const b64 = (b: Buffer) => b.toString("base64url")

function sign(body: string): string {
  return b64(createHmac("sha256", secret()).update(body).digest().subarray(0, 16))
}

export function encodeCard(card: AgentCard): string {
  const body = b64(Buffer.from(JSON.stringify(card), "utf8"))
  return `${body}.${sign(body)}`
}

const int = (v: unknown, max: number) => Math.max(0, Math.min(max, Math.floor(Number(v) || 0)))

export function decodeCard(token: string): AgentCard | null {
  try {
    if (!token || token.length > 1200) return null
    const [body, sig] = token.split(".")
    if (!body || !sig) return null
    const want = Buffer.from(sign(body)), got = Buffer.from(sig)
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null
    const raw = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Partial<AgentCard>
    return {
      n: String(raw.n ?? "Agent").slice(0, 40) || "Agent",
      c: /^#[0-9a-f]{6}$/i.test(String(raw.c)) ? String(raw.c) : "#E8002A",
      l: Math.max(1, int(raw.l, 10)),
      x: int(raw.x, 1e7), r: int(raw.r, 1e7), m: int(raw.m, 1e6), d: int(raw.d, 1e5), s: int(raw.s, 1e5),
      g: raw.g === "uk" ? "uk" : "en",
      t: int(raw.t, 4e9),
    }
  } catch {
    return null
  }
}

export { CARD_TEXT } from "@/lib/card-text"
