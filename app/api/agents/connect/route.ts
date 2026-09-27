// app/api/agents/connect/route.ts
//
// Step 1 of "connect your OpenClaw agent in 3 steps".
// Called by the "Підключити агента" button (logged-in user, cookie session).
// Creates a pending providers row + an ac_live_ key tied to it, and returns
// the one-line install command with that key already filled in.
// The raw key is returned ONLY here, once.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createApiKey, AGENT_CONNECT_PERMISSIONS } from "@/lib/api-keys"

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as { name?: unknown } | null
    const rawName = typeof body?.name === "string" ? body.name.trim() : ""
    const name = (rawName || "OpenClaw агент").slice(0, 100)

    // 1. Pending provider row. Inactive until the installer registers it,
    //    so it can never be picked by getActiveProviderForUser() half-done.
    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .insert({
        user_id:           user.id,
        name,
        slug:              "openclaw",
        model:             "openclaw",
        is_active:         false,
        api_key:           null,
        encrypted_api_key: null,
        key_preview:       null,
        status:            "unverified",
        webhook_url:       null,
        auth_header:       null,
        custom_headers:    null,
      })
      .select("id")
      .single()

    if (providerError || !provider) {
      throw new Error(providerError?.message || "Не вдалося створити підключення.")
    }

    // 2. Key for this connection only (used by the installer, MCP and heartbeat).
    let created
    try {
      created = await createApiKey(user.id, `${name} (підключення)`, [...AGENT_CONNECT_PERMISSIONS])
    } catch (e) {
      await supabase.from("providers").delete().eq("id", provider.id).eq("user_id", user.id)
      throw e
    }

    // 3. Tie the key to the provider row.
    const { error: linkError } = await supabase
      .from("api_keys")
      .update({ provider_id: provider.id })
      .eq("id", created.id)
      .eq("user_id", user.id)

    if (linkError) {
      await supabase.from("api_keys").update({ revoked_at: new Date().toISOString() }).eq("id", created.id).eq("user_id", user.id)
      await supabase.from("providers").delete().eq("id", provider.id).eq("user_id", user.id)
      throw new Error(`Не вдалося прив'язати ключ до підключення (${linkError.message}).`)
    }

    // Env vars go on the `bash` side of the pipe — that's the process that
    // runs the script. (`VAR=x curl ... | bash` would give them to curl only.)
    const origin = req.nextUrl.origin
    const command =
      `curl -fsSL ${origin}/connect-agent.sh | ` +
      `ASTROCORE_URL=${origin} ASTROCORE_API_KEY=${created.key} bash`

    return NextResponse.json(
      { providerId: provider.id, key: created.key, command },
      { status: 201 }
    )
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/agents/connect] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}