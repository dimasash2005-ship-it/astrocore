// app/api/reminders/route.ts
//
//   GET                         -> { upcoming, past }
//   POST   { input, timezone }  -> create from a phrase ("завтра о 9 подзвонити Кіру")
//   POST   { text, remindAt, repeat, timezone } -> create with exact fields
//   PATCH  { id, status?, remindAt?, text?, repeat? }
//   DELETE ?id=…

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { parseReminder, safeTz, REPEATS, type Repeat } from "@/lib/reminders/core"

export const dynamic = "force-dynamic"

const NO_STORE = { headers: { "Cache-Control": "no-store" } }
const COLS = "id, text, remind_at, repeat, timezone, status, source, last_sent_at, sent_count, created_at"

async function telegramConnected(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<boolean> {
  const { data } = await supabase.from("user_integrations").select("id").eq("user_id", userId).eq("provider", "telegram").maybeSingle()
  return !!data
}

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const [up, past, tg] = await Promise.all([
    supabase.from("reminders").select(COLS).eq("user_id", user.id).in("status", ["pending", "sending"]).order("remind_at").limit(200),
    supabase.from("reminders").select(COLS).eq("user_id", user.id).in("status", ["sent", "done"]).order("updated_at", { ascending: false }).limit(15),
    telegramConnected(supabase, user.id),
  ])
  if (up.error) return NextResponse.json({ error: up.error.message, setupError: true, telegramConnected: tg }, { status: 500 })
  return NextResponse.json({ upcoming: up.data ?? [], past: past.data ?? [], telegramConnected: tg }, NO_STORE)
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uk = getServerLanguage(req) === "uk"
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const tz = safeTz(typeof b?.timezone === "string" ? b.timezone : null)

  let text = "", at: Date | null = null, repeat: Repeat = "none"
  if (typeof b?.input === "string" && !b?.remindAt) {
    const p = parseReminder(b.input, tz)
    if (!p) return NextResponse.json({ error: uk ? "Не зрозумів, коли нагадати. Напр.: «завтра о 9 подзвонити Кіру»." : "Couldn't tell when. E.g. “tomorrow at 9 call John”." }, { status: 400 })
    text = p.text; at = p.at; repeat = p.repeat
  } else {
    text = typeof b?.text === "string" ? b.text.trim() : ""
    at = typeof b?.remindAt === "string" ? new Date(b.remindAt) : null
    repeat = REPEATS.includes(b?.repeat as Repeat) ? b!.repeat as Repeat : "none"
  }
  if (!text || text.length > 500) return NextResponse.json({ error: uk ? "Напиши, про що нагадати." : "Write what to remind you about." }, { status: 400 })
  if (!at || Number.isNaN(at.getTime()) || at.getTime() < Date.now() - 60_000) {
    return NextResponse.json({ error: uk ? "Цей час уже минув." : "That time has already passed." }, { status: 400 })
  }

  const { count } = await supabase.from("reminders").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("status", "pending")
  if ((count ?? 0) >= 200) return NextResponse.json({ error: uk ? "Максимум 200 активних нагадувань." : "200 active reminders max." }, { status: 400 })

  const { data, error } = await supabase.from("reminders")
    .insert({ user_id: user.id, text, remind_at: at.toISOString(), repeat, timezone: tz, source: "web" })
    .select(COLS).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ reminder: data, telegramConnected: await telegramConnected(supabase, user.id) }, NO_STORE)
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const id = typeof b?.id === "string" ? b.id : ""
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b?.status === "done" || b?.status === "cancelled" || b?.status === "pending") patch.status = b.status
  if (typeof b?.text === "string" && b.text.trim()) patch.text = b.text.trim().slice(0, 500)
  if (REPEATS.includes(b?.repeat as Repeat)) patch.repeat = b!.repeat
  if (typeof b?.remindAt === "string" && !Number.isNaN(Date.parse(b.remindAt))) { patch.remind_at = b.remindAt; patch.status = "pending" }

  const { data, error } = await supabase.from("reminders").update(patch).eq("id", id).eq("user_id", user.id).select(COLS).maybeSingle()
  if (error || !data) return NextResponse.json({ error: error?.message ?? "Not found" }, { status: 400 })
  return NextResponse.json({ reminder: data }, NO_STORE)
}

export async function DELETE(req: NextRequest) {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const id = req.nextUrl.searchParams.get("id") ?? ""
  const { error } = await supabase.from("reminders").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true }, NO_STORE)
}
