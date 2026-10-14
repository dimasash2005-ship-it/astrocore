// app/api/marketing/sheet/route.ts
//
// Google Sheets for the Marketing lab.
// POST { url }            → read the sheet and return the parsed numbers (nothing saved)
// POST { reportId, url? } → re-read the report's connected sheet (or connect `url`) and save it

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { isMarketing } from "@/lib/marketing"
import { readSheet, syncMarketingSheet } from "@/lib/server/sheets"

export const dynamic = "force-dynamic"
const NO_STORE = { headers: { "Cache-Control": "no-store" } }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json().catch(() => ({})) as { url?: unknown; reportId?: unknown }
  const url = typeof body.url === "string" ? body.url.slice(0, 2000) : undefined
  const reportId = typeof body.reportId === "string" && /^[0-9a-f-]{36}$/i.test(body.reportId) ? body.reportId : null

  if (!reportId) {
    if (!url) return NextResponse.json({ error: "badurl" }, { status: 400 })
    const r = await readSheet(url)
    if (!r.ok) return NextResponse.json({ error: r.error }, NO_STORE)
    const { rows, totals, currency, found } = r.parsed
    return NextResponse.json({ parsed: { rows, totals, currency, found } }, NO_STORE)
  }

  const { data, error } = await supabase.from("reports").select("marketing").eq("id", reportId).eq("user_id", user.id).maybeSingle()
  if (error || !data || !isMarketing(data.marketing)) return NextResponse.json({ error: "notfound" }, { status: 404 })
  const m = data.marketing
  if (!url && !m.sheet) return NextResponse.json({ error: "badurl" }, { status: 400 })

  const next = await syncMarketingSheet(m, url ?? m.sheet!.url)
  // A failed first connect is not saved; a failed refresh keeps old numbers and stores the error.
  if (next.sheet?.error && !m.sheet) return NextResponse.json({ error: next.sheet.error }, NO_STORE)
  const { error: upErr } = await supabase.from("reports").update({ marketing: next }).eq("id", reportId).eq("user_id", user.id)
  if (upErr) return NextResponse.json({ error: "network" }, { status: 500 })
  return NextResponse.json({ marketing: next, error: next.sheet?.error ?? null }, NO_STORE)
}
