// lib/server/levelups.ts
//
// "🌟 Level up!" messages in Telegram. The last level we told the user about is kept
// in their Telegram settings (settings.levels), so each level is announced once.
// Called after /api/agents/levels has counted the levels. Never throws.

import { loadTelegram, sendMessage, esc, telegramConfigured, telegramServiceClient, type Lang } from "@/lib/server/telegram"
import { unlockLabel, type AgentLevel } from "@/lib/cosmos"

const SITE = "https://astrocore.one"

type Info = AgentLevel & { name?: string }

export async function notifyLevelUpsTelegram(userId: string, levels: Record<string, Info>): Promise<void> {
  if (!telegramConfigured()) return
  try {
    const sb = telegramServiceClient()
    const conn = await loadTelegram(sb, userId)
    if (!conn?.chatId) return
    const settings = conn.settings as typeof conn.settings & { levels?: Record<string, number> }
    const known = settings.levels
    const next: Record<string, number> = { ...(known ?? {}) }
    const ups: { id: string; lv: Info; from: number }[] = []
    for (const [id, lv] of Object.entries(levels)) {
      const before = known?.[id]
      if (typeof before === "number" && lv.level > before) ups.push({ id, lv, from: before })
      next[id] = Math.max(lv.level, before ?? 0)
    }
    const changed = !known || Object.keys(next).some(k => next[k] !== known[k])
    if (!changed) return
    // Save first, so a second request at the same moment doesn't announce the same level again.
    await sb.from("user_integrations").update({ settings: { ...settings, levels: next }, updated_at: new Date().toISOString() }).eq("id", conn.id)

    if (settings.notify_reports === false) return
    const lang: Lang = settings.lang ?? "en"
    for (const { id, lv } of ups.slice(0, 3)) {
      const uk = lang === "uk"
      const html =
        `🌟 <b>Level up!</b>\n\n<b>${esc(lv.name ?? "Agent")}</b> → <b>LV ${lv.level}</b>\n` +
        `✨ ${uk ? "Відкрито" : "Unlocked"}: ${unlockLabel(lv.level, lang)}\n\n` +
        `<i>${lv.replies} ${uk ? "відповідей" : "replies"} · ${lv.chats} ${uk ? "чатів" : "chats"} · ${lv.missions} ${uk ? "місій" : "missions"}</i>`
      await sendMessage(conn.chatId, html, [[
        { text: uk ? "🪐 Подивитися агента" : "🪐 View agent", url: `${SITE}/agents/${id}` },
        { text: uk ? "🚀 Поділитися" : "🚀 Share", url: `${SITE}/agents/${id}?share=1` },
      ]])
    }
  } catch (err) {
    console.error("[levelups]", err instanceof Error ? err.message : err)
  }
}
