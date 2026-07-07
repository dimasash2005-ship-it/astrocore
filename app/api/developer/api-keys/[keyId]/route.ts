import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { revokeApiKey } from "@/lib/api-keys"

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { keyId } = await params
    if (!keyId) {
      return NextResponse.json({ error: "keyId є обов'язковим." }, { status: 400 })
    }

    const revoked = await revokeApiKey(user.id, keyId)

    if (!revoked) {
      return NextResponse.json(
        { error: "Ключ не знайдено, вже відкликаний, або не належить вам." },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[DELETE /api/developer/api-keys/[keyId]] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}