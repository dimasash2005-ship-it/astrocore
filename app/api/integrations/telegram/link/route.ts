// app/api/integrations/telegram/link/route.ts
//
// POST -> { url: "https://t.me/<bot>?start=<one-time code>" }
// The user opens it, presses Start, and the bot links that chat to this account.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { telegramConfigured, botUsername, createLinkCode, telegramServiceClient } from "@/lib/server/telegram"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const lang = getServerLanguage(req) === "uk" ? "uk" : "en"

  if (!telegramConfigured()) {
    return NextResponse.json({ error: lang === "uk" ? "Telegram ще не налаштований на сервері." : "Telegram is not set up on the server yet." }, { status: 400 })
  }
  try {
    const code = await createLinkCode(telegramServiceClient(), user.id, lang)
    return NextResponse.json({ url: `https://t.me/${botUsername()}?start=${code}` }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[telegram link]", err instanceof Error ? err.message : err)
    return NextResponse.json({ error: lang === "uk" ? "Не вдалося створити посилання. Перевір, що SQL для Telegram виконано." : "Couldn't create the link." }, { status: 500 })
  }
}
