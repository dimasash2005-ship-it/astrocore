// app/api/reports/created/route.ts
//
// POST { reportId } — called by the browser right after it saved a new report
// (mission run from the chat). Runs the report hooks: Notion auto export + Telegram.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { onReportCreated } from "@/lib/server/report-hooks"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => null) as { reportId?: unknown } | null
  const reportId = typeof body?.reportId === "string" ? body.reportId : ""
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return NextResponse.json({ error: "reportId is required" }, { status: 400 })

  // Only for the user's own, freshly created report.
  const { data: own } = await supabase.from("reports").select("id, created_at").eq("id", reportId).eq("user_id", user.id).maybeSingle()
  if (!own || Date.now() - Date.parse(own.created_at as string) > 10 * 60_000) return NextResponse.json({ ok: true })

  await onReportCreated(user.id, reportId)
  return NextResponse.json({ ok: true })
}
