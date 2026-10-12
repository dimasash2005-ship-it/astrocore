// app/api/integrations/telegram/test/route.ts
// POST -> sends a test message to the user's connected Telegram chat.

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { loadTelegram, sendMessage, telegramConfigured, TXT } from "@/lib/server/telegram"

export const dynamic = "force-dynamic"

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const conn = await loadTelegram(supabase, user.id).catch(() => null)
  if (!conn || !telegramConfigured()) return NextResponse.json({ ok: false, error: "not_connected" }, { status: 400 })
  try {
    await sendMessage(conn.chatId, TXT[conn.settings.lang ?? "en"].test)
    return NextResponse.json({ ok: true })
  } catch (err) {
    // Usually: the user blocked the bot or deleted the chat.
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 400 })
  }
}
