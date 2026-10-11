// app/api/integrations/notion/export/route.ts
//
// POST { reportId, parentId? }      -> send the report to Notion now, returns { ok, url }
// POST { reportId, auto: true }     -> only if the user turned on auto export (used right after a report is created)

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { exportReportToNotion, autoExportReport, notionErrorInfo, notionConfigured } from "@/lib/server/notion"

export const dynamic = "force-dynamic"

// Small guard against double clicks: one export per user every 3 seconds.
const lastCall = new Map<string, number>()

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const lang = getServerLanguage(req) === "uk" ? "uk" : "en"

  const body = await req.json().catch(() => null) as { reportId?: unknown; parentId?: unknown; auto?: unknown } | null
  const reportId = typeof body?.reportId === "string" ? body.reportId : ""
  if (!/^[0-9a-f-]{36}$/i.test(reportId)) return NextResponse.json({ error: "reportId is required" }, { status: 400 })

  if (body?.auto === true) {
    // Make sure the report is really this user's before doing background work for it.
    const { data: own } = await supabase.from("reports").select("id").eq("id", reportId).eq("user_id", user.id).maybeSingle()
    if (own) await autoExportReport(user.id, reportId)
    return NextResponse.json({ ok: true })
  }

  if (!notionConfigured()) {
    return NextResponse.json({ ok: false, code: "not_configured", error: lang === "uk" ? "Notion ще не налаштований на сервері." : "Notion is not set up on the server yet." }, { status: 400 })
  }

  const now = Date.now()
  if (now - (lastCall.get(user.id) ?? 0) < 3000) {
    return NextResponse.json({ ok: false, code: "rate_limit", error: lang === "uk" ? "Зачекай кілька секунд." : "Wait a few seconds." }, { status: 429 })
  }
  lastCall.set(user.id, now)

  try {
    const parentId = typeof body?.parentId === "string" && /^[0-9a-f-]{32,36}$/i.test(body.parentId) ? body.parentId : null
    const result = await exportReportToNotion({ sb: supabase, userId: user.id, reportId, parentId, lang })
    return NextResponse.json({ ok: true, url: result.url })
  } catch (err) {
    console.error("[notion export]", err instanceof Error ? err.message : err)
    const info = notionErrorInfo(err, lang)
    return NextResponse.json({ ok: false, code: info.code, error: info.message }, { status: 400 })
  }
}