import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listApiKeys } from "@/lib/api-keys"

// Same fixed name used by the "Connect AstroCore" flow
// (see app/api/integrations/obsidian/connect/route.ts).
const CONNECT_KEY_NAME = "Obsidian Plugin"

// This endpoint does NOT create the note itself — AstroCore's server
// has no way to reach a user's local Obsidian app. It only confirms
// the user has an active connection; the actual note creation happens
// client-side via the obsidian://new URI (see lib/obsidian-uri.ts),
// which the browser hands off to the locally installed Obsidian app.
export async function POST() {
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
    const connected = keys.some(k => k.name === CONNECT_KEY_NAME && !k.revoked_at)

    if (!connected) {
      return NextResponse.json(
        { connected: false, error: "Підключіть Obsidian в Integrations." },
        { status: 409 }
      )
    }

    return NextResponse.json({ connected: true }, { status: 200 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/integrations/obsidian/save] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}