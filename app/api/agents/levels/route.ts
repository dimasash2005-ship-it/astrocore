// app/api/agents/levels/route.ts
//
// Levels of the user's agents for the "star system" avatars.
// Counted from data that already exists (chats, replies, mission runs, active days),
// so it costs no AI tokens and needs no new tables.

import { NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { computeAgentLevels } from "@/lib/server/agent-levels"
import { notifyLevelUpsTelegram } from "@/lib/server/levelups"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const levels = await computeAgentLevels(supabase, user.id)
    // "🌟 Level up!" in Telegram, after the response is sent.
    after(() => notifyLevelUpsTelegram(user.id, levels))
    return NextResponse.json({ levels }, { headers: { "Cache-Control": "private, max-age=30" } })
  } catch (err) {
    console.error("[agents levels]", err instanceof Error ? err.message : err)
    return NextResponse.json({ levels: {} }, { headers: { "Cache-Control": "no-store" } })
  }
}
