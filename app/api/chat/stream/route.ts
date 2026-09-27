// app/api/chat/stream/route.ts
//
// Streaming chat for OpenClaw agents (providers.slug = "openclaw").
// Browser → here → the agent's Gateway (/v1/chat/completions, stream: true)
// → text is piped back to the browser chunk by chunk as plain text.
//
// The old non-streaming /api/chat is untouched and still used for every
// other provider type. Same auth model as /api/chat: the browser only
// sends a providerId; the gateway token is decrypted here, server-side.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { decryptSecret } from "@/lib/server/encryption"
import { assertSafeProviderUrl, joinProviderPath, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"
import { safeFetch, readCappedText, SafeFetchError } from "@/lib/server/safe-fetch"
import { extractImages } from "@/lib/server/ai-providers"

// Agent turns run tools and can take minutes. 300s needs Fluid Compute
// on Vercel Hobby (Project → Settings → Functions).
export const maxDuration = 300
export const dynamic = "force-dynamic"

type ChatMsg = { role: string; content: string }

function toOpenAIMessages(messages: ChatMsg[], systemPrompt: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  if (systemPrompt) out.push({ role: "system", content: systemPrompt })
  for (const m of messages) {
    if (m?.role !== "user" && m?.role !== "assistant") continue
    if (typeof m.content !== "string") continue
    const { text, images } = extractImages(m.content)
    if (images.length === 0) { out.push({ role: m.role, content: m.content }); continue }
    const blocks: Record<string, unknown>[] = []
    if (text) blocks.push({ type: "text", text })
    images.forEach(img => blocks.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } }))
    out.push({ role: m.role, content: blocks })
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { messages?: unknown; systemPrompt?: unknown; providerId?: unknown; sessionId?: unknown }
      | null
    if (!body) return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 })

    const providerId = typeof body.providerId === "string" ? body.providerId : ""
    if (!providerId) return NextResponse.json({ error: "Провайдер не вказано." }, { status: 400 })
    if (!Array.isArray(body.messages)) return NextResponse.json({ error: "messages має бути масивом." }, { status: 400 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: row, error: providerError } = await supabase
      .from("providers")
      .select("id, slug, model, api_key, encrypted_api_key, webhook_url")
      .eq("id", providerId)
      .eq("user_id", user.id)
      .single()

    if (providerError || !row) {
      return NextResponse.json({ error: "Провайдера не знайдено або він вам не належить." }, { status: 404 })
    }
    if (row.slug !== "openclaw") {
      return NextResponse.json({ error: "Стрім доступний лише для OpenClaw агента." }, { status: 400 })
    }
    if (!row.webhook_url) {
      return NextResponse.json({ error: "Агент ще не підключений: немає адреси. Запусти команду підключення на сервері." }, { status: 400 })
    }

    let token: string
    try {
      token = row.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : (row.api_key ?? "")
    } catch {
      return NextResponse.json({ error: "Не вдалося розшифрувати токен агента." }, { status: 500 })
    }
    if (!token) return NextResponse.json({ error: "У агента відсутній токен." }, { status: 400 })

    let endpoint: string
    try {
      endpoint = joinProviderPath(assertSafeProviderUrl(row.webhook_url).toString(), "chat/completions")
    } catch (e) {
      return NextResponse.json({ error: e instanceof UnsafeProviderUrlError ? e.message : "Некоректна адреса агента." }, { status: 400 })
    }

    const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : ""
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : ""

    let upstream: Response
    try {
      upstream = await safeFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Accept":        "text/event-stream",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          model: row.model || "openclaw",
          messages: toOpenAIMessages(body.messages as ChatMsg[], systemPrompt),
          stream: true,
          // Per-session context on the agent side (same as /api/chat).
          user: sessionId ? `astrocore-${sessionId}` : "astrocore:openclaw",
        }),
        timeoutMs: 290_000,
      })
    } catch (e) {
      const msg = e instanceof SafeFetchError ? e.message : "Не вдалося з'єднатися з агентом."
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    if (!upstream.ok || !upstream.body) {
      const text = upstream.ok ? "" : await readCappedText(upstream).catch(() => "")
      return NextResponse.json(
        { error: `OpenClaw error ${upstream.status}: ${text.slice(0, 300)}` },
        { status: 502 }
      )
    }

    // SSE ("data: {...}\n\n") → plain text deltas for the browser.
    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        let buf = ""
        try {
          for (;;) {
            const { done, value } = await reader.read()
            if (done) break
            buf += decoder.decode(value, { stream: true })

            let nl: number
            while ((nl = buf.indexOf("\n")) >= 0) {
              const line = buf.slice(0, nl).trim()
              buf = buf.slice(nl + 1)
              if (!line.startsWith("data:")) continue
              const data = line.slice(5).trim()
              if (data === "[DONE]") {
                controller.close()
                reader.cancel().catch(() => {})
                return
              }
              try {
                const json = JSON.parse(data)
                const piece = json?.choices?.[0]?.delta?.content
                if (typeof piece === "string" && piece) controller.enqueue(encoder.encode(piece))
                const errMsg = json?.error?.message
                if (typeof errMsg === "string" && errMsg) controller.enqueue(encoder.encode(`\n\n⚠️ ${errMsg}`))
              } catch {
                // Ignore keep-alives / partial non-JSON lines.
              }
            }
          }
          controller.close()
        } catch (e) {
          controller.error(e)
        }
      },
      cancel() {
        // Browser closed the tab / aborted → stop reading from the agent too.
        reader.cancel().catch(() => {})
      },
    })

    return new Response(stream, {
      headers: {
        "Content-Type":      "text/plain; charset=utf-8",
        "Cache-Control":     "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[API/chat/stream] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}