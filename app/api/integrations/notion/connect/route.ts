// app/api/integrations/notion/connect/route.ts
//
// GET /api/integrations/notion/connect?next=/reports/123
// Sends the signed-in user to Notion to approve access. Notion then returns to /callback.

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { createClient } from "@/lib/supabase/server"
import {
  notionAuthorizeUrl, notionConfigured, requestOrigin, safeNext, withParam, NOTION_STATE_COOKIE,
} from "@/lib/server/notion"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req)
  const next = safeNext(req.nextUrl.searchParams.get("next"))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`)

  if (!notionConfigured()) return NextResponse.redirect(origin + withParam(next, "notion", "not_configured"))

  const state = randomBytes(16).toString("hex")
  const res = NextResponse.redirect(notionAuthorizeUrl(origin, state))
  res.cookies.set(NOTION_STATE_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https"),
    path: "/api/integrations/notion",
    maxAge: 600,
  })
  return res
}