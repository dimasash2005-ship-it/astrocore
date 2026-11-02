// app/api/push/test/route.ts — "Send a test notification" button.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { pushToUser } from "@/lib/server/push"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uk = getServerLanguage(req) === "uk"
  const sent = await pushToUser(user.id, {
    title: "AstroCore 🛰️",
    body: uk ? "Сповіщення працюють! Сюди прийдуть відповіді агента, звіти й нагадування." : "Notifications work! Agent replies, reports and reminders will arrive here.",
    url: "/", tag: "astrocore-test",
  })
  return NextResponse.json({ sent })
}
