// app/api/cron/reminders/route.ts
//
// Called every minute by Supabase Cron (pg_cron + pg_net) with
// header  Authorization: Bearer <CRON_SECRET>  (same secret as /api/cron/missions).
// Sends every reminder that is due to the owner's Telegram.

import { NextRequest, NextResponse } from "next/server"
import { telegramServiceClient } from "@/lib/server/telegram"
import { sendDueReminders } from "@/lib/server/reminders"
import { notifyAdmin } from "@/lib/server/alert"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const result = await sendDueReminders(telegramServiceClient())
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron/reminders]", msg)
    await notifyAdmin({ title: "Нагадування: помилка", key: "cron:reminders", lines: [`❌ ${msg.slice(0, 400)}`] })
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
