import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys"

// Fixed name used for the key AstroCore manages automatically via the
// "Connect AstroCore" flow. Kept separate from user-named keys created
// manually in Developer Center (Advanced: API Key).
const CONNECT_KEY_NAME = "Obsidian Plugin"

// ── GET: connection status (used by the connect page to show
//    "Already connected" vs the initial connect prompt) ──
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
    const active = keys.find(k => k.name === CONNECT_KEY_NAME && !k.revoked_at)

    return NextResponse.json({
      connected: Boolean(active),
      key_prefix: active?.key_prefix ?? null,
      created_at: active?.created_at ?? null,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[GET /api/integrations/obsidian/connect] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ── POST: (re)connect — revokes any existing auto-managed key for
//    this integration, then issues a fresh one. This keeps "Connect"
//    idempotent: clicking it again after already connecting just
//    rotates the token instead of piling up dead keys. ──
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

    const existing = await listApiKeys(user.id)
    const toRevoke = existing.filter(k => k.name === CONNECT_KEY_NAME && !k.revoked_at)
    for (const k of toRevoke) {
      await revokeApiKey(user.id, k.id)
    }

    const created = await createApiKey(user.id, CONNECT_KEY_NAME)

    return NextResponse.json({
      key: created.key, // full raw key — returned once, handed straight to the plugin
      key_prefix: created.key_prefix,
      created_at: created.created_at,
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/integrations/obsidian/connect] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}