// app/api/integrations/notion/callback/route.ts
//
// Notion sends the user back here after "Allow access".
// We swap the one-time code for a token, store it encrypted, pick a default page
// for reports, and return the user to where they started.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import {
  exchangeNotionCode, notionRedirectUri, loadNotion, saveNotionConnection, searchNotionPages,
  updateNotionSettings, requestOrigin, safeNext, withParam, NOTION_STATE_COOKIE, type NotionSettings,
} from "@/lib/server/notion"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const origin = requestOrigin(req)
  const [savedState, savedNext] = (req.cookies.get(NOTION_STATE_COOKIE)?.value ?? "").split("|")
  const next = safeNext(savedNext)
  const back = (status: string) => {
    const res = NextResponse.redirect(origin + withParam(next, "notion", status))
    res.cookies.set(NOTION_STATE_COOKIE, "", { path: "/api/integrations/notion", maxAge: 0 })
    return res
  }

  const params = req.nextUrl.searchParams
  if (params.get("error")) {
    console.error("[notion callback] Notion returned error:", params.get("error"))
    return back("cancelled")
  }
  const code = params.get("code")
  const state = params.get("state")
  if (!code || !state || !savedState || state !== savedState) {
    console.error("[notion callback] state check failed:", { hasCode: !!code, hasState: !!state, hasCookie: !!savedState, match: state === savedState })
    return back("error")
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(`${origin}/login?next=${encodeURIComponent(next)}`)

  try {
    const previous = await loadNotion(supabase, user.id).catch(() => null)
    let tok
    try {
      tok = await exchangeNotionCode(code, notionRedirectUri(origin))
    } catch (err) {
      console.error("[notion callback] token exchange failed:", err instanceof Error ? err.message : err, "| redirect_uri =", notionRedirectUri(origin))
      return back("error")
    }
    const settings: NotionSettings = {
      auto_export: previous?.settings.auto_export ?? false,
      parent_id: previous?.settings.parent_id ?? null,
      parent_title: previous?.settings.parent_title ?? null,
      parent_icon: previous?.settings.parent_icon ?? null,
      lang: getServerLanguage(req) === "uk" ? "uk" : "en",
    }
    try {
      await saveNotionConnection(supabase, user.id, tok, settings)
    } catch (err) {
      console.error("[notion callback] saving to Supabase failed:", err instanceof Error ? err.message : err)
      return back("error")
    }

    // Default page for reports: keep the old one if still shared, otherwise the newest shared page.
    const conn = await loadNotion(supabase, user.id)
    if (conn) {
      const pages = await searchNotionPages(supabase, conn).catch(() => [])
      const keep = pages.find(p => p.id === settings.parent_id)
      const pick = keep ?? pages[0]
      await updateNotionSettings(supabase, conn, pick
        ? { parent_id: pick.id, parent_title: pick.title, parent_icon: pick.icon }
        : { parent_id: null, parent_title: null, parent_icon: null })
    }
    return back("connected")
  } catch (err) {
    console.error("[notion callback]", err instanceof Error ? err.message : err)
    return back("error")
  }
}