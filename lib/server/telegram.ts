// lib/server/telegram.ts
//
// AstroCore Telegram bot (server-only).
//  - Linking: "Connect Telegram" on the site -> t.me/<bot>?start=<one-time code>
//    -> the bot gets "/start <code>" and remembers this chat for that user.
//  - Notifications: a new report is sent to the user's Telegram.
//  - Commands: /report, /reports, /help, /stop.
//
// Env (server only):
//   TELEGRAM_BOT_TOKEN       from @BotFather
//   TELEGRAM_BOT_USERNAME    e.g. AstroCoreAgentBot (without @)
//   TELEGRAM_WEBHOOK_SECRET  any long random string; Telegram sends it back on every update

import { randomBytes } from "crypto"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { encryptSecret } from "@/lib/server/encryption"

const SITE = "https://astrocore.one"
export type Lang = "uk" | "en"

export type TelegramSettings = { notify_reports?: boolean; lang?: Lang; tz?: string }
export type TelegramConn = {
  id: string
  userId: string
  chatId: string
  username: string | null
  settings: TelegramSettings
  createdAt: string
}

// ── Config / API ─────────────────────────────────────────────────

export function telegramConfigured(): boolean {
  return !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_BOT_USERNAME)
}

export function botUsername(): string {
  return (process.env.TELEGRAM_BOT_USERNAME ?? "").trim().replace(/^@/, "")
}

export async function tg<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({})) as { ok?: boolean; result?: T; description?: string }
  if (!data.ok) throw new Error(`Telegram ${method}: ${data.description ?? res.status}`)
  return data.result as T
}

type Button = { text: string; url: string }

export function sendMessage(chatId: string | number, html: string, buttons?: Button[][]) {
  return tg("sendMessage", {
    chat_id: chatId,
    text: html.slice(0, 4000),
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(buttons?.length ? { reply_markup: { inline_keyboard: buttons } } : {}),
  })
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

/** Markdown report -> short plain-text preview for a Telegram message. */
export function excerpt(md: string, max = 600): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n")
  const out: string[] = []
  let fence = false
  for (const raw of lines) {
    if (/^\s*(```|~~~)/.test(raw)) { fence = !fence; continue }
    if (fence) continue
    if (/^\s*\|?\s*:?-{2,}/.test(raw)) continue                    // table separator
    let l = raw
      .replace(/^\s{0,3}#{1,6}\s+/, "")                           // headings
      .replace(/^\s*>\s?/, "")                                     // quotes
      .replace(/^\s*[-*+]\s+/, "• ")                               // bullets
      .replace(/!\[[^\]]*\]\([^)]*\)/g, "")                        // images
      .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")                     // links -> text
      .replace(/(\*\*|__|\*|_|~~|`)/g, "")                         // emphasis / code
    if (l.includes("|")) l = l.split("|").map(c => c.trim()).filter(Boolean).join(" · ")
    l = l.trim()
    if (/^([-*_])\1{2,}$/.test(l)) continue                        // hr
    out.push(l)
  }
  const text = out.join("\n").replace(/\n{3,}/g, "\n\n").trim()
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 40)).trimEnd() + "…"
}

// ── Storage ──────────────────────────────────────────────────────

export function telegramServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role is not configured.")
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

function rowToConn(row: Record<string, unknown>): TelegramConn {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    chatId: String(row.workspace_id ?? ""),
    username: (row.workspace_name as string | null) ?? null,
    settings: (row.settings as TelegramSettings | null) ?? {},
    createdAt: row.created_at as string,
  }
}

export async function loadTelegram(sb: SupabaseClient, userId: string): Promise<TelegramConn | null> {
  const { data, error } = await sb.from("user_integrations").select("id, user_id, workspace_id, workspace_name, settings, created_at")
    .eq("user_id", userId).eq("provider", "telegram").maybeSingle()
  if (error) throw new Error(error.message)
  return data ? rowToConn(data) : null
}

export async function findByChat(sb: SupabaseClient, chatId: string | number): Promise<TelegramConn | null> {
  const { data } = await sb.from("user_integrations").select("id, user_id, workspace_id, workspace_name, settings, created_at")
    .eq("provider", "telegram").eq("workspace_id", String(chatId)).limit(1).maybeSingle()
  return data ? rowToConn(data) : null
}

/** One-time code for t.me/<bot>?start=<code>. Valid 15 minutes. */
export async function createLinkCode(sb: SupabaseClient, userId: string, lang: Lang, timezone?: string | null): Promise<string> {
  const code = randomBytes(12).toString("base64url")
  await sb.from("telegram_link_codes").delete().eq("user_id", userId)
  const row: Record<string, unknown> = { code, user_id: userId, lang }
  if (timezone) row.timezone = timezone
  let { error } = await sb.from("telegram_link_codes").insert(row)
  if (error && timezone) ({ error } = await sb.from("telegram_link_codes").insert({ code, user_id: userId, lang }))  // before the reminders SQL
  if (error) throw new Error(error.message)
  return code
}

type TgChat = { id: number; username?: string; first_name?: string }

/** "/start <code>": connects this chat to the account that created the code. */
export async function linkChat(sb: SupabaseClient, code: string, chat: TgChat): Promise<{ userId: string; lang: Lang } | null> {
  const { data: row } = await sb.from("telegram_link_codes").select("*").eq("code", code).maybeSingle()
  if (!row) return null
  await sb.from("telegram_link_codes").delete().eq("code", code)
  if (Date.parse(row.expires_at as string) < Date.now()) return null

  const chatId = String(chat.id)
  const lang: Lang = row.lang === "uk" ? "uk" : "en"
  // One Telegram chat <-> one AstroCore account.
  await sb.from("user_integrations").delete().eq("provider", "telegram").eq("workspace_id", chatId).neq("user_id", row.user_id)
  const { error } = await sb.from("user_integrations").upsert({
    user_id: row.user_id,
    provider: "telegram",
    access_token_enc: encryptSecret(chatId),
    workspace_id: chatId,
    workspace_name: chat.username ? `@${chat.username}` : (chat.first_name ?? "Telegram"),
    settings: { notify_reports: true, lang, ...(row.timezone ? { tz: row.timezone as string } : {}) },
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" })
  if (error) throw new Error(error.message)
  return { userId: row.user_id as string, lang }
}

// ── Messages ─────────────────────────────────────────────────────

export const TXT = {
  uk: {
    welcome: "👋 Привіт! Я бот <b>AstroCore</b>.\n\nСюди можуть приходити звіти твого агента: ранкові огляди, результати місій та інше.\n\nЩоб підключити, відкрий AstroCore → <b>Інтеграції → Telegram</b> і натисни «Підключити».",
    openSite: "Відкрити AstroCore",
    linked: "✅ <b>Готово!</b> Telegram підключено до AstroCore.\n\nТепер сюди приходитимуть нові звіти твого агента.",
    expired: "⏳ Посилання застаріло. Натисни «Підключити Telegram» на сайті ще раз.",
    help: "<b>Команди</b>\n/report — останній звіт\n/reports — 5 останніх звітів\n/reminders — мої нагадування\n/remind — як створити нагадування\n/stop — відключити Telegram\n\n⏰ Просто напиши: <i>нагадай завтра о 9 подзвонити Кіру</i>",
    noReports: "Звітів поки немає. Дай агенту задачу або запусти місію на сайті.",
    newReport: "📊 <b>Новий звіт агента</b>",
    lastReports: "🗂 <b>Останні звіти</b>",
    openReport: "Відкрити звіт",
    stopped: "👋 Telegram відключено. Підключити знову можна в AstroCore → Інтеграції.",
    soonChat: "💬 Писати агенту прямо тут — уже скоро. Поки що відкрий чат на сайті.\n\n⏰ А нагадування вже працюють: <i>нагадай завтра о 9 …</i>",
    openChat: "Відкрити чат",
    test: "🔔 <b>Тест від AstroCore</b>\n\nУсе працює: сюди приходитимуть нові звіти твого агента.",
  },
  en: {
    welcome: "👋 Hi! I'm the <b>AstroCore</b> bot.\n\nYour agent's reports can arrive here: morning briefs, mission results and more.\n\nTo connect, open AstroCore → <b>Integrations → Telegram</b> and press “Connect”.",
    openSite: "Open AstroCore",
    linked: "✅ <b>Done!</b> Telegram is connected to AstroCore.\n\nNew reports from your agent will arrive here.",
    expired: "⏳ This link has expired. Press “Connect Telegram” on the site again.",
    help: "<b>Commands</b>\n/report — latest report\n/reports — last 5 reports\n/reminders — my reminders\n/remind — how to create a reminder\n/stop — disconnect Telegram\n\n⏰ Just write: <i>remind me tomorrow at 9 to call John</i>",
    noReports: "No reports yet. Give your agent a task or run a mission on the site.",
    newReport: "📊 <b>New report from your agent</b>",
    lastReports: "🗂 <b>Latest reports</b>",
    openReport: "Open report",
    stopped: "👋 Telegram disconnected. You can connect again in AstroCore → Integrations.",
    soonChat: "💬 Chatting with your agent right here is coming soon. For now, open the chat on the site.\n\n⏰ Reminders already work: <i>remind me tomorrow at 9 …</i>",
    openChat: "Open chat",
    test: "🔔 <b>Test from AstroCore</b>\n\nAll good: new reports from your agent will arrive here.",
  },
}

type ReportRow = { id: string; company_name: string | null; summary: string | null; notion_url?: string | null }

export function reportMessage(r: ReportRow, lang: Lang): { html: string; buttons: Button[][] } {
  const t = TXT[lang]
  const title = esc(String(r.company_name || "Report").slice(0, 200))
  const body = esc(excerpt(String(r.summary ?? ""), 650))
  const buttons: Button[][] = [[{ text: t.openReport, url: `${SITE}/reports/${r.id}` }]]
  if (r.notion_url) buttons[0].push({ text: "Notion", url: r.notion_url })
  return { html: `${t.newReport}\n\n<b>${title}</b>${body ? `\n\n${body}` : ""}`, buttons }
}

/**
 * Sends a fresh report to the user's Telegram, if they connected it and kept
 * "reports to Telegram" on. Never throws.
 */
export async function notifyReportTelegram(userId: string, reportId: string | null | undefined): Promise<void> {
  if (!reportId || !telegramConfigured()) return
  try {
    const sb = telegramServiceClient()
    const conn = await loadTelegram(sb, userId)
    if (!conn || conn.settings.notify_reports === false || !conn.chatId) return
    const { data: r } = await sb.from("reports").select("id, company_name, summary, notion_url")
      .eq("id", reportId).eq("user_id", userId).maybeSingle()
    if (!r) return
    const { html, buttons } = reportMessage(r as ReportRow, conn.settings.lang ?? "en")
    await sendMessage(conn.chatId, html, buttons)
  } catch (err) {
    console.error("[telegram notify]", err instanceof Error ? err.message : err)
  }
}
