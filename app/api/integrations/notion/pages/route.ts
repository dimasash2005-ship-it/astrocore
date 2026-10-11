// app/api/integrations/notion/pages/route.ts
//
// GET /api/integrations/notion/pages?q=text
// Notion pages the user shared with AstroCore, to choose where reports go.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { loadNotion, searchNotionPages, notionErrorInfo } from "@/lib/server/notion"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const lang = getServerLanguage(req) === "uk" ? "uk" : "en"

  try {
    const conn = await loadNotion(supabase, user.id)
    if (!conn) return NextResponse.json({ error: "not_connected", code: "reconnect" }, { status: 400 })
    const pages = await searchNotionPages(supabase, conn, req.nextUrl.searchParams.get("q") ?? "")
    return NextResponse.json({ pages }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    const info = notionErrorInfo(err, lang)
    return NextResponse.json({ error: info.message, code: info.code }, { status: 400 })
  }
}