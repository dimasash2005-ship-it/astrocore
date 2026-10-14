// app/api/agents/share/route.ts
//
// Makes a public "agent card" link for one of the user's agents:
// astrocore.one/s/a/<token>. The card is a signed snapshot of the agent's level and stats.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { computeAgentLevels } from "@/lib/server/agent-levels"
import { encodeCard } from "@/lib/server/agent-card"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uk = getServerLanguage(req) === "uk"

  const body = await req.json().catch(() => null) as { agentId?: unknown } | null
  const agentId = typeof body?.agentId === "string" ? body.agentId : ""
  try {
    const levels = await computeAgentLevels(supabase, user.id)
    const lv = levels[agentId]
    if (!lv) return NextResponse.json({ error: uk ? "Агента не знайдено." : "Agent not found." }, { status: 404 })

    const token = encodeCard({
      n: (lv.name ?? "Agent").slice(0, 40),
      c: /^#[0-9a-f]{6}$/i.test(lv.color ?? "") ? lv.color! : "#E8002A",
      l: lv.level, x: lv.xp, r: lv.replies, m: lv.missions, d: lv.days, s: lv.streak,
      g: uk ? "uk" : "en",
      t: Math.floor(Date.now() / 1000),
    })
    const origin = req.nextUrl.origin
    return NextResponse.json(
      { url: `${origin}/s/a/${token}`, image: `${origin}/api/agents/card?t=${token}`, level: lv.level, name: lv.name, replies: lv.replies, missions: lv.missions },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    console.error("[agent share]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: uk ? "Не вдалося створити картку." : "Couldn't create the card." }, { status: 500 })
  }
}
