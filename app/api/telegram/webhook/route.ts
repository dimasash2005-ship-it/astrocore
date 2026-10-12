// app/api/telegram/webhook/route.ts
//
// Telegram sends every message (and every button tap) for the AstroCore bot here.
// Protected by TELEGRAM_WEBHOOK_SECRET (Telegram puts it in a header on each call).
// Always answers 200 so Telegram doesn't retry the same update.

import { NextRequest, NextResponse } from "next/server"
import {
  telegramConfigured, telegramServiceClient, findByChat, linkChat, sendMessage, reportMessage, esc, tg, TXT, type Lang,
} from "@/lib/server/telegram"
import { parseReminder, formatWhen, safeTz } from "@/lib/reminders/core"
import { RTXT, createdMessage, cancelButton, listButtons, handleReminderCallback } from "@/lib/server/reminders"

export const dynamic = "force-dynamic"

const SITE = "https://astrocore.one"

type TgMessage = {
  text?: string
  chat: { id: number; type: string; username?: string; first_name?: string }
  from?: { language_code?: string }
}
type TgCallback = { id: string; data?: string; from?: { language_code?: string }; message?: { message_id: number; chat: { id: number } } }

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  if (!telegramConfigured()) return NextResponse.json({ ok: true })

  const update = await req.json().catch(() => null) as { message?: TgMessage; callback_query?: TgCallback } | null
  try {
    if (update?.callback_query) await onButton(update.callback_query)
    const msg = update?.message
    if (msg?.chat?.id && msg.chat.type === "private" && typeof msg.text === "string") await onMessage(msg)
  } catch (err) {
    console.error("[telegram webhook]", err instanceof Error ? err.message : err)
  }
  return NextResponse.json({ ok: true })
}

// ── Buttons under messages ──
async function onButton(q: TgCallback) {
  const chatId = q.message?.chat.id
  if (!chatId) return
  const sb = telegramServiceClient()
  const conn = await findByChat(sb, chatId)
  if (!conn) { await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {}); return }
  const lang: Lang = conn.settings.lang ?? ((q.from?.language_code ?? "").startsWith("uk") ? "uk" : "en")
  if ((q.data ?? "").startsWith("r:")) await handleReminderCallback(sb, q, conn.userId, lang)
  else await tg("answerCallbackQuery", { callback_query_id: q.id }).catch(() => {})
}

// ── Text messages ──
async function onMessage(msg: TgMessage) {
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
  const rt = RTXT[lang]

  if (!conn) {
    return sendMessage(chatId, t.welcome, [[{ text: t.openSite, url: `${SITE}/integrations` }]])
  }

  // Reminders: "/remind …", "нагадай …", "remind me …"
  if (cmd === "/remind" || /^(нагадай|нагадайте|нагадати|remind)(?=\s|$)/iu.test(text)) {
    if (cmd === "/remind" && args.length === 0) return sendMessage(chatId, rt.howto)
    const tz = safeTz(conn.settings.tz ?? (await lastTimezone(sb, conn.userId)))
    const parsed = parseReminder(text, tz)
    if (!parsed) return sendMessage(chatId, rt.notUnderstood)
    const { count } = await sb.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", conn.userId).eq("status", "pending")
    if ((count ?? 0) >= 200) return sendMessage(chatId, rt.tooMany)
    const { data: row, error } = await sb.from("reminders").insert({
      user_id: conn.userId, text: parsed.text.slice(0, 500), remind_at: parsed.at.toISOString(),
      repeat: parsed.repeat, timezone: tz, source: "telegram",
    }).select("*").single()
    if (error || !row) return sendMessage(chatId, rt.notUnderstood)
    return tg("sendMessage", {
      chat_id: chatId, text: createdMessage(row, lang), parse_mode: "HTML",
      reply_markup: { inline_keyboard: cancelButton(row.id, lang) },
    })
  }

  switch (cmd) {
    case "/start":
    case "/help":
      return sendMessage(chatId, t.help)

    case "/reminders": {
      const { data: list } = await sb.from("reminders").select("id, text, remind_at, repeat, timezone")
        .eq("user_id", conn.userId).eq("status", "pending").order("remind_at").limit(10)
      if (!list?.length) return sendMessage(chatId, rt.none)
      const lines = list.map((r, i) => {
        const when = formatWhen(new Date(r.remind_at as string), safeTz(r.timezone as string), lang)
        return `${i + 1}. <b>${esc(when)}</b>${r.repeat !== "none" ? " 🔁" : ""}\n    ${esc(String(r.text).slice(0, 120))}`
      })
      return tg("sendMessage", {
        chat_id: chatId, text: `${rt.list}\n\n${lines.join("\n")}`, parse_mode: "HTML",
        reply_markup: { inline_keyboard: listButtons(list as { id: string }[], lang) },
      })
    }

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

async function lastTimezone(sb: ReturnType<typeof telegramServiceClient>, userId: string): Promise<string | null> {
  const { data } = await sb.from("reminders").select("timezone").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle()
  return (data?.timezone as string | undefined) ?? null
}
