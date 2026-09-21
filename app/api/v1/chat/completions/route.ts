import { NextRequest, NextResponse } from "next/server"
import { verifyApiKey, getActiveProviderForUser } from "@/lib/api-keys"
import { decryptSecret } from "@/lib/server/encryption"
import { callProvider } from "@/lib/server/ai-providers"

// Public, OpenAI-compatible endpoint. Any external tool that speaks the
// standard "Custom / OpenAI-compatible" provider shape — OpenClaw included —
// can point its Endpoint URL at this route and its API key field at an
// ac_live_ key generated on /settings/developer. AstroCore authenticates the
// key, finds THAT USER's own connected provider (their own Anthropic/OpenAI/
// Google/Custom key — never AstroCore's), and forwards the call to it.
export const maxDuration = 60

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization") || ""
    const rawKey = authHeader.replace(/^Bearer\s+/i, "").trim()

    const verified = await verifyApiKey(rawKey)
    if (!verified) {
      return NextResponse.json(
        { error: { message: "Invalid or revoked API key.", type: "invalid_request_error" } },
        { status: 401 }
      )
    }

    if (!verified.permissions.includes("chat")) {
      return NextResponse.json(
        { error: { message: "This API key does not have the 'chat' permission.", type: "permission_denied" } },
        { status: 403 }
      )
    }

    const body = await req.json().catch(() => ({}))
    const messages = Array.isArray(body?.messages) ? body.messages : null
    if (!messages) {
      return NextResponse.json(
        { error: { message: "'messages' array is required.", type: "invalid_request_error" } },
        { status: 400 }
      )
    }

    // OpenAI-style requests put the system prompt as a "system" role
    // message inside the array — pull it out, the shared call-functions
    // expect it separately.
    const systemMsg = messages.find((m: { role?: string }) => m?.role === "system")
    const chatMessages = messages.filter((m: { role?: string }) => m?.role === "user" || m?.role === "assistant")
    const systemPrompt = typeof systemMsg?.content === "string" ? systemMsg.content : ""

    const providerRow = await getActiveProviderForUser(verified.userId)
    if (!providerRow) {
      return NextResponse.json(
        {
          error: {
            message: "No active AI provider connected for this account. Connect one at /providers first.",
            type: "invalid_request_error",
          },
        },
        { status: 400 }
      )
    }

    let apiKey: string
    try {
      apiKey = providerRow.encrypted_api_key ? decryptSecret(providerRow.encrypted_api_key) : (providerRow.api_key ?? "")
    } catch {
      return NextResponse.json(
        { error: { message: "Failed to decrypt provider key.", type: "server_error" } },
        { status: 500 }
      )
    }
    if (!apiKey) {
      return NextResponse.json(
        { error: { message: "Connected provider has no API key configured.", type: "invalid_request_error" } },
        { status: 400 }
      )
    }

    const content = await callProvider(providerRow, apiKey, chatMessages, systemPrompt)

    // OpenAI Chat Completions response shape — this is what makes any
    // "OpenAI-compatible" client (OpenClaw included) work with zero
    // extra configuration beyond Endpoint URL + API key.
    return NextResponse.json({
      id: `chatcmpl-${verified.id}-${Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: providerRow.model || "astrocore",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content },
          finish_reason: "stop",
        },
      ],
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[API/v1/chat/completions] error:", msg)
    return NextResponse.json({ error: { message: msg, type: "server_error" } }, { status: 500 })
  }
}