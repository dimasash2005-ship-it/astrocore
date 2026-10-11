// app/api/integrations/notion/route.ts
//
//   GET    -> connection status (never returns tokens)
//   PATCH  -> { parentId?, autoExport? }  change the page for reports / auto export
//   DELETE -> disconnect (removes the stored token)

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import {
  loadNotion, notionConfigured, getNotionPage, updateNotionSettings, notionErrorInfo, type NotionConn, type NotionSettings,
} from "@/lib/server/notion"

export const dynamic = "force-dynamic"

const NO_STORE = { headers: { "Cache-Control": "no-store" } }

function shape(conn: NotionConn | null) {
  return {
    configured: notionConfigured(),
    connected: !!conn,
    workspaceName: conn?.workspaceName ?? null,
    workspaceIcon: conn?.workspaceIcon ?? null,
    parent: conn?.settings.parent_id
      ? { id: conn.settings.parent_id, title: conn.settings.parent_title ?? "Untitled", icon: conn.settings.parent_icon ?? null }
      : null,
    autoExport: !!conn?.settings.auto_export,
    connectedAt: conn?.createdAt ?? null,
  }
}

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  try {
    return NextResponse.json(shape(await loadNotion(supabase, user.id)), NO_STORE)
  } catch (err) {
    // Table not created yet, or encryption key missing: show as "not connected" instead of breaking the page.
    console.error("[notion status]", err instanceof Error ? err.message : err)
    return NextResponse.json({ ...shape(null), setupError: true }, NO_STORE)
  }
}

export async function PATCH(req: NextRequest) {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const lang = getServerLanguage(req) === "uk" ? "uk" : "en"

  const body = await req.json().catch(() => null) as { parentId?: unknown; autoExport?: unknown } | null
  try {
    const conn = await loadNotion(supabase, user.id)
    if (!conn) return NextResponse.json({ error: lang === "uk" ? "Notion не підключено." : "Notion is not connected." }, { status: 400 })

    const patch: NotionSettings = { lang }
    if (typeof body?.parentId === "string" && /^[0-9a-f-]{32,36}$/i.test(body.parentId)) {
      // Ask Notion for the page: proves AstroCore can use it and gives the real title.
      const page = await getNotionPage(supabase, conn, body.parentId)
      patch.parent_id = page.id
      patch.parent_title = page.title
      patch.parent_icon = page.icon
    }
    if (typeof body?.autoExport === "boolean") patch.auto_export = body.autoExport

    await updateNotionSettings(supabase, conn, patch)
    return NextResponse.json(shape(conn), NO_STORE)
  } catch (err) {
    const info = notionErrorInfo(err, lang)
    return NextResponse.json({ error: info.message, code: info.code }, { status: 400 })
  }
}

export async function DELETE() {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { error } = await supabase.from("user_integrations").delete().eq("user_id", user.id).eq("provider", "notion")
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(shape(null), NO_STORE)
}