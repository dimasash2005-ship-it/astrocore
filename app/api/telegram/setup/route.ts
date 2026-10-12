// app/api/telegram/setup/route.ts
//
// Admin only. Open https://astrocore.one/api/telegram/setup once after deploying:
// it tells Telegram where to send messages (webhook) and sets the bot's command menu.

import { NextRequest, NextResponse } from "next/server"
import { getAdminUser } from "@/lib/server/admin"
import { tg, telegramConfigured, botUsername } from "@/lib/server/telegram"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const admin = await getAdminUser().catch(() => null)
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  if (!telegramConfigured() || !process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET first." }, { status: 400 })
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "astrocore.one"
  if (host.startsWith("localhost") || host.startsWith("127.")) {
    return NextResponse.json({ error: "Run this on the live site (https://astrocore.one/api/telegram/setup): Telegram can't reach localhost." }, { status: 400 })
  }
  const url = `https://${host}/api/telegram/webhook`

  try {
    await tg("setWebhook", {
      url,
      secret_token: process.env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["message"],
      drop_pending_updates: true,
    })
    await tg("setMyCommands", { commands: [
      { command: "report",  description: "Latest report" },
      { command: "reports", description: "Last 5 reports" },
      { command: "help",    description: "Help" },
      { command: "stop",    description: "Disconnect Telegram" },
    ] })
    await tg("setMyCommands", { language_code: "uk", commands: [
      { command: "report",  description: "Останній звіт" },
      { command: "reports", description: "5 останніх звітів" },
      { command: "help",    description: "Підказка" },
      { command: "stop",    description: "Відключити Telegram" },
    ] })
    await tg("setMyDescription", { description: "AstroCore: reports from your OpenClaw agent, right in Telegram." }).catch(() => {})
    await tg("setMyDescription", { language_code: "uk", description: "AstroCore: звіти твого OpenClaw-агента прямо в Telegram." }).catch(() => {})
    const info = await tg("getWebhookInfo", {})
    return NextResponse.json({ ok: true, bot: `@${botUsername()}`, webhook: url, info })
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}
