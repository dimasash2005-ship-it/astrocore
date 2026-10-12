// app/api/telegram/webhook/route.ts
//
// Telegram sends every message to the AstroCore bot here.
// Protected by TELEGRAM_WEBHOOK_SECRET (Telegram puts it in a header on each call).
// Always answers 200 so Telegram doesn't retry the same update.

import { NextRequest, NextResponse } from "next/server"
import {
  telegramConfigured, telegramServiceClient, findByChat, linkChat, sendMessage, reportMessage, esc, TXT, type Lang,
} from "@/lib/server/telegram"

export const dynamic = "force-dynamic"

const SITE = "https://astrocore.one"

type TgMessage = {
  text?: string
  chat: { id: number; type: string; username?: string; first_name?: string }
  from?: { language_code?: string }
}

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  if (!telegramConfigured()) return NextResponse.json({ ok: true })

  const update = await req.json().catch(() => null) as { message?: TgMessage } | null
  const msg = update?.message
  if (msg?.chat?.id && msg.chat.type === "private" && typeof msg.text === "string") {
    try { await handle(msg) } catch (err) {
      console.error("[telegram webhook]", err instanceof Error ? err.message : err)
    }
  }
  return NextResponse.json({ ok: true })
}

async function handle(msg: TgMessage) {
  const sb = telegramServiceClient()
  const chatId = msg.chat.id
  const text = (msg.text ?? "").trim()
  const [rawCmd, ...args] = text.split(/\s+/)
  const cmd = rawCmd.toLowerCase().replace(/@\w+$/, "")   // "/report@MyBot" -> "/report"
  const guess: Lang = (msg.from?.language_code ?? "").startsWith("uk") ? "uk" : "en"

  // /start <code> -> connect this chat
  if (cmd === "/start" && args[0]) {
    const linked = await linkChat(sb, args[0], msg.chat)
    const t = TXT[linked?.lang ?? guess]
    if (!linked) return sendMessage(chatId, t.expired, [[{ text: t.openSite, url: `${SITE}/integrations` }]])
    return sendMessage(chatId, `${t.linked}\n\n${t.help}`)
  }

  const conn = await findByChat(sb, chatId)
  const lang: Lang = conn?.settings.lang ?? guess
  const t = TXT[lang]

  if (!conn) {
    return sendMessage(chatId, t.welcome, [[{ text: t.openSite, url: `${SITE}/integrations` }]])
  }

  switch (cmd) {
    case "/start":
    case "/help":
      return sendMessage(chatId, t.help)

    case "/report": {
      const { data: r } = await sb.from("reports").select("id, company_name, summary, notion_url")
        .eq("user_id", conn.userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
      if (!r) return sendMessage(chatId, t.noReports)
      const m = reportMessage(r, lang)
      return sendMessage(chatId, m.html, m.buttons)
    }

    case "/reports": {
      const { data: list } = await sb.from("reports").select("id, company_name, created_at")
        .eq("user_id", conn.userId).order("created_at", { ascending: false }).limit(5)
      if (!list?.length) return sendMessage(chatId, t.noReports)
      const locale = lang === "uk" ? "uk-UA" : "en-US"
      const lines = list.map((r, i) => {
        const d = new Date(r.created_at as string).toLocaleDateString(locale, { day: "numeric", month: "short" })
        return `${i + 1}. <a href="${SITE}/reports/${r.id}">${esc(String(r.company_name || "Report").slice(0, 80))}</a> · ${d}`
      })
      return sendMessage(chatId, `${t.lastReports}\n\n${lines.join("\n")}`)
    }

    case "/stop":
      await sb.from("user_integrations").delete().eq("id", conn.id)
      return sendMessage(chatId, t.stopped)

    default:
      return sendMessage(chatId, t.soonChat, [[{ text: t.openChat, url: SITE }]])
  }
}
