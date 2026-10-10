// app/api/feedback/route.ts
//
// Saves a "Help & feedback" message from a signed-in user to the `feedback` table
// and notifies you right away (each one is optional, set the env vars you want):
//   Telegram: TELEGRAM_FEEDBACK_BOT_TOKEN + TELEGRAM_FEEDBACK_CHAT_ID
//   Discord:  DISCORD_FEEDBACK_WEBHOOK

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const KINDS = ["bug", "idea", "love", "other"] as const
type Kind = (typeof KINDS)[number]

const KIND_LABEL: Record<Kind, { emoji: string; title: string; color: number }> = {
  bug:   { emoji: "🐞", title: "Problem",  color: 0xE8002A },
  idea:  { emoji: "💡", title: "Idea",     color: 0xF59E0B },
  love:  { emoji: "❤️", title: "Likes it", color: 0x22C55E },
  other: { emoji: "💬", title: "Message",  color: 0x8B5CF6 },
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json().catch(() => null) as { kind?: string; message?: string; page?: string } | null
    const kind = (KINDS as readonly string[]).includes(body?.kind ?? "") ? (body!.kind as Kind) : "other"
    const message = (body?.message ?? "").trim()
    const page = (body?.page ?? "").slice(0, 300) || null
    if (message.length < 3 || message.length > 3000) {
      return NextResponse.json({ error: "message_length" }, { status: 400 })
    }

    // Simple spam guard: at most 5 messages per 10 minutes per user.
    const { count } = await supabase
      .from("feedback")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", new Date(Date.now() - 10 * 60_000).toISOString())
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "too_many" }, { status: 429 })

    const { error } = await supabase.from("feedback").insert({
      user_id: user.id,
      email: user.email ?? null,
      kind,
      message,
      page,
      user_agent: (req.headers.get("user-agent") ?? "").slice(0, 300) || null,
    })
    if (error) throw new Error(error.message)

    const k = KIND_LABEL[kind]
    const name = (user.user_metadata?.full_name as string | undefined) || user.email || user.id

    // Instant notification to your Telegram (optional).
    const tgToken = process.env.TELEGRAM_FEEDBACK_BOT_TOKEN
    const tgChat = process.env.TELEGRAM_FEEDBACK_CHAT_ID
    if (tgToken && tgChat) {
      const text =
        `${k.emoji} <b>${k.title}</b>\n\n` +
        `${escapeHtml(message.slice(0, 3500))}\n\n` +
        `👤 ${escapeHtml(String(name).slice(0, 200))}${user.email && user.email !== name ? ` (${escapeHtml(user.email)})` : ""}\n` +
        `📄 ${escapeHtml(page ?? "-")}`
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: tgChat, text, parse_mode: "HTML", disable_web_page_preview: true }),
      }).catch(() => { /* never fail the user's request because of Telegram */ })
    }

    // Instant notification to your private Discord channel (optional).
    const hook = process.env.DISCORD_FEEDBACK_WEBHOOK
    if (hook) {
      await fetch(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: "AstroCore Feedback",
          allowed_mentions: { parse: [] },
          embeds: [{
            title: `${k.emoji} ${k.title}`,
            description: message.slice(0, 3500),
            color: k.color,
            fields: [
              { name: "User", value: String(name).slice(0, 200), inline: true },
              { name: "Page", value: page ?? "-", inline: true },
            ],
            timestamp: new Date().toISOString(),
          }],
        }),
      }).catch(() => { /* never fail the user's request because of Discord */ })
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/feedback] error:", msg)
    return NextResponse.json({ error: "server" }, { status: 500 })
  }
}