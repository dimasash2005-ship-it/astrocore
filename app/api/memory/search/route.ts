import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const VALID_SOURCES = ["chat", "agent", "obsidian", "manual"] as const

const MAX_RESULTS = 50

// GET /api/memory/search?q=...&agent_id=...&source=...
// Session-authenticated only (no service_role). RLS on memory_items
// already scopes rows to the calling user; the explicit .eq("user_id", ...)
// below is defense in depth, not a replacement for RLS.
export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const q = searchParams.get("q")?.trim()
    const agentId = searchParams.get("agent_id")?.trim()
    const source = searchParams.get("source")?.trim()

    if (source && !(VALID_SOURCES as readonly string[]).includes(source)) {
      return NextResponse.json(
        { error: `Невірне значення source. Очікується одне з: ${VALID_SOURCES.join(", ")}.` },
        { status: 400 }
      )
    }

    let query = supabase
      .from("memory_items")
      .select("id, title, content, source, tags, agent_id, created_at, updated_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(MAX_RESULTS)

    if (q) {
      const escaped = q.replace(/[%_]/g, m => `\\${m}`)
      query = query.or(`title.ilike.%${escaped}%,content.ilike.%${escaped}%`)
    }
    if (agentId) {
      query = query.eq("agent_id", agentId)
    }
    if (source) {
      query = query.eq("source", source)
    }

    const { data, error } = await query

    if (error) {
      throw new Error(error.message)
    }

    return NextResponse.json({ items: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[GET /api/memory/search] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}