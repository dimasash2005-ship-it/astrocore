// app/api/agents/levels/route.ts
//
// Levels of the user's agents for the "star system" avatars.
// Counted from data that already exists (chats, replies, mission runs, active days),
// so it costs no AI tokens and needs no new tables.

import { NextResponse, after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { levelFromStats, dayKey, streakFrom, type AgentLevel } from "@/lib/cosmos"
import { notifyLevelUpsTelegram } from "@/lib/server/levelups"

export const dynamic = "force-dynamic"

const PAGE = 1000      // Supabase returns at most 1000 rows per request
const MAX_PAGES = 30   // up to 30k replies per user is plenty for levels

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const [{ data: agents }, { data: sessions }] = await Promise.all([
      supabase.from("agents").select("id, name, avatar_color").eq("user_id", user.id),
      supabase.from("chat_sessions").select("id, agent_id, title").eq("user_id", user.id).limit(5000),
    ])

    const sessionAgent = new Map<string, string>()
    const acc = new Map<string, { chats: number; replies: number; missions: number; days: Set<string> }>()
    for (const a of agents ?? []) acc.set(a.id, { chats: 0, replies: 0, missions: 0, days: new Set() })
    for (const s of sessions ?? []) {
      if (!s.agent_id || !acc.has(s.agent_id)) continue
      sessionAgent.set(s.id, s.agent_id)
      const a = acc.get(s.agent_id)!
      a.chats++
      if (typeof s.title === "string" && s.title.startsWith("🎯")) a.missions++
    }

    for (let page = 0; page < MAX_PAGES; page++) {
      const { data, error } = await supabase.from("chat_messages")
        .select("session_id, created_at")
        .eq("user_id", user.id).eq("role", "assistant")
        .order("created_at", { ascending: false })
        .range(page * PAGE, page * PAGE + PAGE - 1)
      if (error) throw new Error(error.message)
      for (const m of data ?? []) {
        const agentId = sessionAgent.get(m.session_id)
        if (!agentId) continue
        const a = acc.get(agentId)!
        a.replies++
        a.days.add(dayKey(m.created_at))
      }
      if (!data || data.length < PAGE) break
    }

    const meta = new Map<string, { name: string | null; avatar_color: string | null }>(
      (agents ?? []).map(a => [a.id as string, { name: (a.name as string | null) ?? null, avatar_color: (a.avatar_color as string | null) ?? null }]),
    )
    const levels: Record<string, AgentLevel & { name?: string; color?: string | null }> = {}
    for (const [id, a] of acc) {
      levels[id] = {
        ...levelFromStats({ chats: a.chats, replies: a.replies, missions: a.missions, days: a.days.size, streak: streakFrom(a.days) }),
        name: meta.get(id)?.name ?? undefined,
        color: meta.get(id)?.avatar_color ?? null,
      }
    }
    // "🌟 Level up!" in Telegram, after the response is sent.
    after(() => notifyLevelUpsTelegram(user.id, levels))
    return NextResponse.json({ levels }, { headers: { "Cache-Control": "private, max-age=30" } })
  } catch (err) {
    console.error("[agents levels]", err instanceof Error ? err.message : err)
    return NextResponse.json({ levels: {} }, { headers: { "Cache-Control": "no-store" } })
  }
}
