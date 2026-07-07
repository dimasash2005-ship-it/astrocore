import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface SaveBody {
  title?: string
  content: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as SaveBody | null
    const content = body?.content?.trim()

    if (!content) {
      return NextResponse.json({ error: "Поле content є обов'язковим." }, { status: 400 })
    }

    const title = body?.title?.trim() || content.slice(0, 60) || "Без назви"

    // NOTE: memory_items (id, user_id, title, content, created_at,
    // updated_at) has no "source" column in the current schema, so
    // "source: chat" isn't persisted here — only title + content are.
    // If provenance needs to be queryable later, that's a migration
    // (adding a source column), not something to fake into this table.
    const { data, error } = await supabase
      .from("memory_items")
      .insert({ user_id: user.id, title, content })
      .select("id, created_at")
      .single()

    if (error || !data) {
      throw new Error(error?.message || "Не вдалося зберегти в Memory.")
    }

    return NextResponse.json(
      { success: true, id: data.id, created_at: data.created_at },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/memory/save] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}