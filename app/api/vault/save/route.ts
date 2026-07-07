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

    const { data, error } = await supabase
      .from("vault_items")
      .insert({
        user_id: user.id,
        title,
        content,
        tags: ["chat"],
        source: "chat",
      })
      .select("id, created_at")
      .single()

    if (error || !data) {
      throw new Error(error?.message || "Не вдалося зберегти в Vault.")
    }

    return NextResponse.json(
      { success: true, id: data.id, created_at: data.created_at },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/vault/save] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}