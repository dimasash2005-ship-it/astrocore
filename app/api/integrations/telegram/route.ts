// app/api/integrations/telegram/route.ts
//
//   GET    -> connection status
//   PATCH  -> { notifyReports }   reports to Telegram on/off
//   DELETE -> disconnect

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { telegramConfigured, botUsername, loadTelegram, sendMessage, TXT, type TelegramConn } from "@/lib/server/telegram"

export const dynamic = "force-dynamic"

const NO_STORE = { headers: { "Cache-Control": "no-store" } }

function shape(conn: TelegramConn | null) {
  return {
    configured: telegramConfigured(),
    bot: telegramConfigured() ? botUsername() : null,
    connected: !!conn,
    username: conn?.username ?? null,
    notifyReports: conn ? conn.settings.notify_reports !== false : true,
    connectedAt: conn?.createdAt ?? null,
  }
}

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(shape(await loadTelegram(supabase, user.id)), NO_STORE)
  } catch (err) {
    console.error("[telegram status]", err instanceof Error ? err.message : err)
    return NextResponse.json({ ...shape(null), setupError: true }, NO_STORE)
  }
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const body = await req.json().catch(() => null) as { notifyReports?: unknown; timezone?: unknown } | null
  const conn = await loadTelegram(supabase, user.id).catch(() => null)
  if (!conn) return NextResponse.json({ error: "not_connected" }, { status: 400 })
  const tz = typeof body?.timezone === "string" && body.timezone.length < 64 ? body.timezone : null
  if (typeof body?.notifyReports === "boolean" || (tz && tz !== conn.settings.tz)) {
    const settings = {
      ...conn.settings,
      ...(typeof body?.notifyReports === "boolean" ? { notify_reports: body.notifyReports } : {}),
      ...(tz ? { tz } : {}),
    }
    const { error } = await supabase.from("user_integrations").update({ settings, updated_at: new Date().toISOString() }).eq("id", conn.id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    conn.settings = settings
  }
  return NextResponse.json(shape(conn), NO_STORE)
}

export async function DELETE() {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const conn = await loadTelegram(supabase, user.id).catch(() => null)
  const { error } = await supabase.from("user_integrations").delete().eq("user_id", user.id).eq("provider", "telegram")
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (conn?.chatId && telegramConfigured()) {
    await sendMessage(conn.chatId, TXT[conn.settings.lang ?? "en"].stopped).catch(() => {})
  }
  return NextResponse.json(shape(null), NO_STORE)
}
