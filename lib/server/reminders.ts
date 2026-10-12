// lib/server/reminders.ts
//
// Reminders on the server: send due ones to Telegram (called every minute by
// /api/cron/reminders) and handle the buttons under a reminder message
// (✅ Done · ⏰ +10 min · ⏰ +1 h · 🌅 Tomorrow).

import type { SupabaseClient } from "@supabase/supabase-js"
import { nextOccurrence, formatWhen, repeatLabel, safeTz, localParts, zonedToUtc, type Repeat } from "@/lib/reminders/core"
import { loadTelegram, tg, esc, type Lang, type TelegramConn } from "@/lib/server/telegram"

export type ReminderRow = {
  id: string
  user_id: string
  text: string
  remind_at: string
  repeat: Repeat
  timezone: string
  status: string
  source: string
  sent_count: number
}

const SITE = "https://astrocore.one"

export const RTXT = {
  uk: {
    title: "⏰ <b>Нагадування</b>",
    done: "✅ Готово", snooze10: "⏰ 10 хв", snooze60: "⏰ 1 год", tomorrow: "🌅 Завтра",
    markedDone: "✅ Виконано", snoozedTo: "⏰ Відкладено:", next: "Наступне:",
    created: "⏰ <b>Нагадаю</b>", cancel: "Скасувати", cancelled: "🗑 Скасовано",
    howto: "⏰ <b>Нагадування</b>\n\nНапиши мені, наприклад:\n• <i>нагадай завтра о 9 зустріч</i>\n• <i>нагадай через 20 хв перевірити духовку</i>\n• <i>нагадай щодня о 8:30 випити воду</i>\n• <i>нагадай у пʼятницю о 18 відправити звіт</i>\n\n/reminders — список нагадувань",
    notUnderstood: "🤔 Не зрозумів, коли нагадати. Спробуй так: <i>нагадай завтра о 9 зустріч</i>",
    none: "Нагадувань поки немає. Напиши: <i>нагадай завтра о 9 …</i>",
    list: "⏰ <b>Найближчі нагадування</b>",
    openList: "Усі нагадування",
    tooMany: "Забагато активних нагадувань (максимум 200).",
  },
  en: {
    title: "⏰ <b>Reminder</b>",
    done: "✅ Done", snooze10: "⏰ 10 min", snooze60: "⏰ 1 hour", tomorrow: "🌅 Tomorrow",
    markedDone: "✅ Done", snoozedTo: "⏰ Snoozed to", next: "Next:",
    created: "⏰ <b>I'll remind you</b>", cancel: "Cancel", cancelled: "🗑 Cancelled",
    howto: "⏰ <b>Reminders</b>\n\nJust write to me, for example:\n• <i>remind me tomorrow at 9 meeting</i>\n• <i>remind me in 20 minutes to check the oven</i>\n• <i>remind me every day at 8:30 to drink water</i>\n• <i>remind me friday at 6pm to send the report</i>\n\n/reminders — list of reminders",
    notUnderstood: "🤔 I didn't get when to remind you. Try: <i>remind me tomorrow at 9 meeting</i>",
    none: "No reminders yet. Write: <i>remind me tomorrow at 9 …</i>",
    list: "⏰ <b>Upcoming reminders</b>",
    openList: "All reminders",
    tooMany: "Too many active reminders (200 max).",
  },
}

type Btn = { text: string; callback_data?: string; url?: string }

function reminderButtons(id: string, lang: Lang): Btn[][] {
  const t = RTXT[lang]
  return [
    [{ text: t.done, callback_data: `r:d:${id}` }],
    [{ text: t.snooze10, callback_data: `r:s:${id}:10` }, { text: t.snooze60, callback_data: `r:s:${id}:60` }, { text: t.tomorrow, callback_data: `r:s:${id}:tm` }],
  ]
}

export function reminderMessage(r: Pick<ReminderRow, "text" | "repeat">, lang: Lang): string {
  const rep = repeatLabel(r.repeat, lang)
  return `${RTXT[lang].title}\n\n${esc(r.text)}${rep ? `\n\n<i>🔁 ${rep}</i>` : ""}`
}

/** Text shown after creating a reminder (bot reply). */
export function createdMessage(r: Pick<ReminderRow, "text" | "repeat" | "remind_at" | "timezone">, lang: Lang): string {
  const when = formatWhen(new Date(r.remind_at), safeTz(r.timezone), lang)
  const rep = repeatLabel(r.repeat, lang)
  return `${RTXT[lang].created} ${when}${rep ? ` (🔁 ${rep})` : ""}:\n${esc(r.text)}`
}

// ── Cron: send everything that's due ────────────────────────────

export async function sendDueReminders(svc: SupabaseClient): Promise<{ sent: number; skipped: number }> {
  const nowIso = new Date().toISOString()
  // A run that crashed mid-way leaves rows in "sending": give them back after 5 minutes.
  await svc.from("reminders").update({ status: "pending" })
    .eq("status", "sending").lt("updated_at", new Date(Date.now() - 5 * 60_000).toISOString())

  const { data: due, error } = await svc.from("reminders").select("*")
    .eq("status", "pending").lte("remind_at", nowIso).order("remind_at").limit(200)
  if (error) throw new Error(error.message)

  const conns = new Map<string, TelegramConn | null>()
  let sent = 0, skipped = 0

  for (const r of (due ?? []) as ReminderRow[]) {
    // Claim it first, so two overlapping cron calls never send the same reminder twice.
    const { data: claimed } = await svc.from("reminders").update({ status: "sending", updated_at: nowIso })
      .eq("id", r.id).eq("status", "pending").select("id")
    if (!claimed?.length) continue

    if (!conns.has(r.user_id)) conns.set(r.user_id, await loadTelegram(svc, r.user_id).catch(() => null))
    const conn = conns.get(r.user_id)
    const lang: Lang = conn?.settings.lang ?? "uk"

    let delivered = false
    if (conn?.chatId) {
      try {
        await tg("sendMessage", {
          chat_id: conn.chatId,
          text: reminderMessage(r, lang),
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: reminderButtons(r.id, lang) },
        })
        delivered = true
        sent++
      } catch (err) {
        console.error("[reminders] send failed", r.id, err instanceof Error ? err.message : err)
      }
    }
    if (!delivered) skipped++

    const tz = safeTz(r.timezone)
    const next = nextOccurrence(new Date(r.remind_at), r.repeat, tz, new Date())
    await svc.from("reminders").update({
      status: next ? "pending" : "sent",
      remind_at: next ? next.toISOString() : r.remind_at,
      last_sent_at: new Date().toISOString(),
      sent_count: (r.sent_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    }).eq("id", r.id)
  }
  return { sent, skipped }
}

// ── Telegram buttons ────────────────────────────────────────────

type CallbackQuery = {
  id: string
  data?: string
  message?: { message_id: number; chat: { id: number }; text?: string }
}

/** Handles taps on reminder buttons. `userId` = owner of this Telegram chat. */
export async function handleReminderCallback(svc: SupabaseClient, q: CallbackQuery, userId: string, lang: Lang): Promise<void> {
  const t = RTXT[lang]
  const [, action, id, arg] = (q.data ?? "").split(":")
  const answer = (text: string) => tg("answerCallbackQuery", { callback_query_id: q.id, text }).catch(() => {})

  const { data: r } = await svc.from("reminders").select("*").eq("id", id).eq("user_id", userId).maybeSingle()
  if (!r) { await answer("—"); return }
  const row = r as ReminderRow
  const tz = safeTz(row.timezone)
  const now = new Date()
  let footer = ""

  if (action === "d") {
    if (row.repeat === "none") await svc.from("reminders").update({ status: "done", updated_at: now.toISOString() }).eq("id", row.id)
    footer = row.repeat === "none" ? t.markedDone : `${t.markedDone} · ${t.next} ${formatWhen(new Date(row.remind_at), tz, lang, now)}`
    await answer(t.markedDone)
  } else if (action === "s") {
    let at: Date
    if (arg === "tm") {
      const p = localParts(now.getTime(), tz)
      const orig = localParts(new Date(row.remind_at).getTime(), tz)
      const tomorrow = localParts(zonedToUtc(p.y, p.m, p.d, 12, 0, tz) + 86_400_000, tz)
      at = new Date(zonedToUtc(tomorrow.y, tomorrow.m, tomorrow.d, row.repeat === "none" ? orig.h : 9, row.repeat === "none" ? orig.mi : 0, tz))
    } else {
      at = new Date(now.getTime() + Math.min(Math.max(Number(arg) || 10, 1), 1440) * 60_000)
    }
    if (row.repeat === "none") {
      await svc.from("reminders").update({ status: "pending", remind_at: at.toISOString(), updated_at: now.toISOString() }).eq("id", row.id)
    } else {
      // Keep the repeating series as it is; snooze is a one-off copy.
      await svc.from("reminders").insert({ user_id: userId, text: row.text, remind_at: at.toISOString(), repeat: "none", timezone: tz, source: "telegram" })
    }
    footer = `${t.snoozedTo} ${formatWhen(at, tz, lang, now)}`
    await answer(footer)
  } else if (action === "c") {
    await svc.from("reminders").update({ status: "cancelled", updated_at: now.toISOString() }).eq("id", row.id)
    footer = t.cancelled
    await answer(t.cancelled)
  } else {
    await answer("—")
    return
  }

  if (q.message) {
    const body = action === "c" ? createdMessage(row, lang) : reminderMessage(row, lang)
    await tg("editMessageText", {
      chat_id: q.message.chat.id,
      message_id: q.message.message_id,
      text: `${body}\n\n<b>${esc(footer)}</b>`,
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] },
    }).catch(() => {})
  }
}

export function cancelButton(id: string, lang: Lang): Btn[][] {
  return [[{ text: `🗑 ${RTXT[lang].cancel}`, callback_data: `r:c:${id}` }], [{ text: RTXT[lang].openList, url: `${SITE}/reminders` }]]
}

export function listButtons(rows: { id: string }[], lang: Lang): Btn[][] {
  const out: Btn[][] = []
  for (let i = 0; i < rows.length; i += 4) {
    out.push(rows.slice(i, i + 4).map((r, j) => ({ text: `🗑 ${i + j + 1}`, callback_data: `r:c:${r.id}` })))
  }
  out.push([{ text: RTXT[lang].openList, url: `${SITE}/reminders` }])
  return out
}
