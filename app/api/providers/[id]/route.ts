import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

interface PatchBody {
  is_active?: boolean
  name?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    const body = (await req.json().catch(() => ({}))) as PatchBody

    const update: Record<string, unknown> = {}
    if (typeof body.is_active === "boolean") update.is_active = body.is_active
    if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim().slice(0, 100)

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Немає полів для оновлення." }, { status: 400 })
    }

    // RLS (`providers: update own`) already scopes this to the caller's
    // own rows, but the explicit .eq keeps intent obvious and gives a
    // clean 404 instead of a silent no-op when the id doesn't belong to
    // this user.
    const { data, error } = await supabase
      .from("providers")
      .update(update)
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, name, slug, model, is_active, status, key_preview, webhook_url, created_at")
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Провайдера не знайдено." }, { status: 404 })
    }

    return NextResponse.json({ provider: data })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[PATCH /api/providers/[id]] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const { error } = await supabase
      .from("providers")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)

    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[DELETE /api/providers/[id]] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}