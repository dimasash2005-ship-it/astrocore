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
  updateNotionSettings, getNotionPage, createReportsPage, REPORTS_PAGE_TITLE, requestOrigin, safeNext, withParam, NOTION_STATE_COOKIE, type NotionSettings,
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

    // Where reports go. The user doesn't have to prepare anything in Notion:
    //  1. They chose "Use a template" in Notion's window -> the copied template page.
    //  2. Their previous page is still shared -> keep it.
    //  3. A shared page is already called "AstroCore Reports" -> use it.
    //  4. Otherwise create "AstroCore Reports" inside the newest shared page.
    const conn = await loadNotion(supabase, user.id)
    if (conn) {
      let target: { id: string; title: string; icon: string | null } | null = null
      if (tok.duplicated_template_id) {
        target = await getNotionPage(supabase, conn, tok.duplicated_template_id).catch(() => null)
      }
      if (!target) {
        const pages = await searchNotionPages(supabase, conn).catch(() => [])
        target = pages.find(p => p.id === settings.parent_id)
          ?? pages.find(p => p.title.trim().toLowerCase() === REPORTS_PAGE_TITLE.toLowerCase())
          ?? null
        if (!target && pages[0]) {
          target = await createReportsPage(supabase, conn, pages[0].id).catch(err => {
            console.error("[notion callback] couldn't create reports page:", err instanceof Error ? err.message : err)
            return pages[0]
          })
        }
      }
      await updateNotionSettings(supabase, conn, target
        ? { parent_id: target.id, parent_title: target.title, parent_icon: target.icon }
        : { parent_id: null, parent_title: null, parent_icon: null })
    }
    return back("connected")
  } catch (err) {
    console.error("[notion callback]", err instanceof Error ? err.message : err)
    return back("error")
  }
}