import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const VALID_TYPES = ["text", "code", "image"] as const
type GalleryType = (typeof VALID_TYPES)[number]

interface SaveBody {
  title?: string
  content: string
  type?: string
  tags?: string[]
}

function normalizeType(value: string | undefined): GalleryType {
  return (VALID_TYPES as readonly string[]).includes(value ?? "") ? (value as GalleryType) : "text"
}

function normalizeTags(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is string => typeof t === "string")
    .map(t => t.trim())
    .filter(Boolean)
    .slice(0, 20)
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
    const type = normalizeType(body?.type)
    const tags = normalizeTags(body?.tags)

    const { data, error } = await supabase
      .from("gallery_items")
      .insert({ user_id: user.id, title, content, type, tags })
      .select("id, created_at")
      .single()

    if (error || !data) {
      throw new Error(error?.message || "Не вдалося зберегти в Галерею.")
    }

    return NextResponse.json(
      { success: true, id: data.id, created_at: data.created_at },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/gallery/save] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}