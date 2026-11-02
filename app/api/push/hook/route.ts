// app/api/push/hook/route.ts
//
// Called by the database (trigger chat_messages_push, see the push_and_search SQL) the moment
// an agent finishes a reply. Sends a push like Telegram: agent name + start of the reply,
// tap → opens that chat on that message.
// Mission replies are skipped: the mission's report sends its own notification.

import { NextRequest, NextResponse } from "next/server"
import { pushService, pushToUser, pushExcerpt, pushConfigured } from "@/lib/server/push"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!pushConfigured()) return NextResponse.json({ ok: true, skipped: "not_configured" })
  const { message_id } = await req.json().catch(() => ({})) as { message_id?: string }
  if (!message_id || !/^[0-9a-f-]{36}$/i.test(message_id)) return NextResponse.json({ error: "bad_request" }, { status: 400 })

  const sb = pushService()
  const { data: msg } = await sb.from("chat_messages").select("id, user_id, session_id, role, content, status").eq("id", message_id).maybeSingle()
  if (!msg || msg.role !== "assistant") return NextResponse.json({ ok: true, skipped: "no_message" })

  const { data: mission } = await sb.from("missions").select("id").eq("last_session_id", msg.session_id).eq("status", "running").limit(1)
  if (mission?.length) return NextResponse.json({ ok: true, skipped: "mission" })

  const { data: session } = await sb.from("chat_sessions").select("title, agent_id").eq("id", msg.session_id).maybeSingle()
  let agentName = "AstroCore"
  if (session?.agent_id) {
    const { data: a } = await sb.from("agents").select("name").eq("id", session.agent_id).maybeSingle()
    if (a?.name) agentName = String(a.name)
  }
  const failed = msg.status === "error"
  const sent = await pushToUser(msg.user_id, {
    title: failed ? `⚠️ ${agentName}` : agentName,
    body: pushExcerpt(msg.content) || "…",
    url: `/chat/${msg.session_id}?m=${msg.id}`,
    tag: `chat-${msg.session_id}`,
  })
  return NextResponse.json({ ok: true, sent })
}
