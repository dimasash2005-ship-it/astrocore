import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createApiKey, listApiKeys } from "@/lib/api-keys"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const keys = await listApiKeys(user.id)
    return NextResponse.json({ keys })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[GET /api/developer/api-keys] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
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

    const body = await req.json().catch(() => ({}))
    const name = typeof body?.name === "string" ? body.name.trim() : ""

    if (!name) {
      return NextResponse.json({ error: "Поле 'name' є обов'язковим." }, { status: 400 })
    }

    const created = await createApiKey(user.id, name)

    // Full raw key is returned here ONLY — never persisted, never retrievable again.
    return NextResponse.json({ key: created }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/developer/api-keys] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}