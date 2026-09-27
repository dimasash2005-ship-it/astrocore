// app/api/agents/heartbeat/route.ts
//
// Pinged periodically by the user's server (a timer set up by
// connect-agent.sh) so AsCore can show the agent as online/offline
// from providers.last_seen_at.
//
// Body (optional): { agentVersion?: "2026.9.5" }

import { NextRequest, NextResponse } from "next/server"
import { verifyApiKey, touchAgentHeartbeat } from "@/lib/api-keys"

export async function POST(req: NextRequest) {
  try {
    const verified = await verifyApiKey(req.headers.get("x-api-key"))
    if (!verified) {
      return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 })
    }
    if (!verified.permissions.includes("agents")) {
      return NextResponse.json({ error: 'API key is missing the "agents" scope' }, { status: 403 })
    }

    const body = (await req.json().catch(() => null)) as { agentVersion?: unknown } | null
    const agentVersion =
      typeof body?.agentVersion === "string" && body.agentVersion.trim()
        ? body.agentVersion.trim().slice(0, 50)
        : null

    const ok = await touchAgentHeartbeat(verified.id, verified.userId, agentVersion)
    if (!ok) {
      return NextResponse.json({ error: "Цей ключ не прив'язаний до підключення агента." }, { status: 409 })
    }

    return new NextResponse(null, { status: 204 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/agents/heartbeat] error:", msg)
    return NextResponse.json({ error: "Heartbeat failed." }, { status: 500 })
  }
}