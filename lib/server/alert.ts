// lib/server/alert.ts
//
// Sends you a Telegram message when something breaks on the server.
// Uses the same bot as feedback (TELEGRAM_FEEDBACK_BOT_TOKEN / TELEGRAM_FEEDBACK_CHAT_ID).
// Optional: TELEGRAM_ALERTS_BOT_TOKEN / TELEGRAM_ALERTS_CHAT_ID to send alerts to a separate chat.
//
// Only sends from production (astrocore.one), so testing on localhost doesn't spam you.
// Set ALERTS_IN_DEV=1 in .env.local if you want alerts locally too.
// The same alert (same `key`) is sent at most once per 10 minutes.

const recent = new Map<string, number>()
const COOLDOWN_MS = 10 * 60_000

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function notifyAdmin(opts: { title: string; lines?: string[]; key?: string; emoji?: string }): Promise<void> {
  try {
    const isProd = process.env.VERCEL_ENV === "production"
    if (!isProd && process.env.ALERTS_IN_DEV !== "1") return

    const token = process.env.TELEGRAM_ALERTS_BOT_TOKEN || process.env.TELEGRAM_FEEDBACK_BOT_TOKEN
    const chat = process.env.TELEGRAM_ALERTS_CHAT_ID || process.env.TELEGRAM_FEEDBACK_CHAT_ID
    if (!token || !chat) return

    const key = opts.key ?? opts.title
    const now = Date.now()
    if ((recent.get(key) ?? 0) > now - COOLDOWN_MS) return
    recent.set(key, now)
    if (recent.size > 500) recent.clear()

    const time = new Date().toLocaleString("uk-UA", { timeZone: "Europe/Prague", dateStyle: "short", timeStyle: "short" })
    const text =
      `${opts.emoji ?? "🚨"} <b>${esc(opts.title)}</b>\n\n` +
      (opts.lines ?? []).filter(Boolean).map(l => esc(l).slice(0, 600)).join("\n") +
      `\n\n🕒 ${esc(time)}`

    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 4000)
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text: text.slice(0, 4000), parse_mode: "HTML", disable_web_page_preview: true }),
      signal: ctrl.signal,
    }).catch(() => {})
    clearTimeout(timer)
  } catch {
    /* alerts must never break the app */
  }
}