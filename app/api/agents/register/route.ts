// app/api/agents/register/route.ts
//
// Step 3 of "connect your OpenClaw agent in 3 steps".
// Called by connect-agent.sh on the user's server, with the ac_live_ key
// from step 1 in X-Api-Key. Records where the agent lives and its gateway
// token (encrypted). Which row gets updated is decided by the key alone.
//
// Body: { endpointUrl: "https://host/v1", gatewayToken: "...", agentVersion?: "2026.9.5" }

import { NextRequest, NextResponse } from "next/server"
import { verifyApiKey, registerAgentForKey } from "@/lib/api-keys"
import { assertSafeProviderUrl, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"

interface RegisterBody {
  endpointUrl?: unknown
  gatewayToken?: unknown
  agentVersion?: unknown
}

/** Accepts ".../v1", ".../v1/" or ".../v1/chat/completions"; stores the base without trailing slash. */
function normalizeEndpoint(raw: string): string | { error: string } {
  let url: URL
  try {
    url = assertSafeProviderUrl(raw)
  } catch (e) {
    return { error: e instanceof UnsafeProviderUrlError ? e.message : "Некоректний endpointUrl." }
  }
  if (url.protocol !== "https:") {
    return { error: "endpointUrl має бути HTTPS." }
  }
  url.search = ""
  url.hash = ""
  url.pathname = url.pathname.replace(/\/chat\/completions\/?$/, "").replace(/\/+$/, "")
  return url.toString().replace(/\/+$/, "")
}

export async function POST(req: NextRequest) {
  try {
    const verified = await verifyApiKey(req.headers.get("x-api-key"))
    if (!verified) {
      return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 })
    }
    if (!verified.permissions.includes("agents")) {
      return NextResponse.json({ error: 'API key is missing the "agents" scope' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as RegisterBody | null
    if (!body) {
      return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 })
    }

    const rawEndpoint = typeof body.endpointUrl === "string" ? body.endpointUrl.trim() : ""
    if (!rawEndpoint || rawEndpoint.length > 500) {
      return NextResponse.json({ error: "Вкажіть endpointUrl." }, { status: 400 })
    }
    const endpoint = normalizeEndpoint(rawEndpoint)
    if (typeof endpoint !== "string") {
      return NextResponse.json({ error: endpoint.error }, { status: 400 })
    }

    const gatewayToken = typeof body.gatewayToken === "string" ? body.gatewayToken.trim() : ""
    if (gatewayToken.length < 16 || gatewayToken.length > 500) {
      return NextResponse.json({ error: "Некоректний gatewayToken." }, { status: 400 })
    }

    const agentVersion =
      typeof body.agentVersion === "string" && body.agentVersion.trim()
        ? body.agentVersion.trim().slice(0, 50)
        : null

    const result = await registerAgentForKey(verified.id, verified.userId, {
      endpointUrl: endpoint,
      gatewayToken,
      agentVersion,
    })

    if (!result) {
      return NextResponse.json(
        { error: "Цей ключ не прив'язаний до підключення агента. Створіть нове підключення в AsCore." },
        { status: 409 }
      )
    }

    return NextResponse.json({ ok: true, providerId: result.providerId })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/agents/register] error:", msg)
    return NextResponse.json({ error: "Не вдалося зареєструвати агента." }, { status: 500 })
  }
}