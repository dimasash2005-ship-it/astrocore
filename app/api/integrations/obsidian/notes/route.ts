import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyApiKey } from "@/lib/api-keys"

interface NotesRequestBody {
  title?: string
  content: string
  path?: string
}

export async function POST(req: NextRequest) {
  try {
    // ── Auth: same Bearer API-key pattern as the chat endpoint ──
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
    const rawKey = bearerMatch?.[1]?.trim()

    const verified = await verifyApiKey(rawKey)
    if (!verified) {
      return NextResponse.json({ error: "Недійсний або відкликаний API ключ." }, { status: 401 })
    }
    if (!verified.permissions.includes("vault") && !verified.permissions.includes("integrations")) {
      return NextResponse.json(
        { error: "Цей API ключ не має дозволу 'vault' або 'integrations'." },
        { status: 403 }
      )
    }

    const body = (await req.json().catch(() => null)) as NotesRequestBody | null
    const content = body?.content

    if (!content || !content.trim()) {
      return NextResponse.json({ error: "Поле content є обов'язковим." }, { status: 400 })
    }

    const title = body?.title?.trim() || "Без назви"
    const path = body?.path?.trim() || null

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Supabase service credentials не налаштовані на сервері." },
        { status: 500 }
      )
    }
    const supabase = createClient(supabaseUrl, serviceKey)

    // Tag with "obsidian" (and the note's vault path, if given) so these
    // entries are easy to find/filter in the Vault UI without a schema change.
    const tags = ["obsidian"]
    if (path) tags.push(path)

    const { data, error } = await supabase
      .from("vault_items")
      .insert({
        user_id: verified.userId,
        title,
        content: content.trim(),
        tags,
        source: "obsidian",
      })
      .select("id, created_at")
      .single()

    if (error || !data) {
      throw new Error(error?.message || "Не вдалося зберегти нотатку у Vault.")
    }

    return NextResponse.json(
      { success: true, id: data.id, created_at: data.created_at },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/integrations/obsidian/notes] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}