import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { assertSafeProviderUrl, joinProviderPath, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"
import { safeFetch, readCappedText, SafeFetchError } from "@/lib/server/safe-fetch"

interface TestBody {
  baseUrl?: string
  model?: string
  apiKey?: string
  customHeaders?: Record<string, string> | string
}

function parseCustomHeaders(raw: TestBody["customHeaders"]): Record<string, string> {
  if (!raw) return {}
  if (typeof raw === "object") return raw
  try {
    const parsed = JSON.parse(raw)
    if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) return parsed
  } catch {
    // ignore malformed input here — the save endpoint is the one that
    // rejects it outright; the test endpoint just skips bad headers
    // rather than blocking the connection check over them
  }
  return {}
}

export async function POST(req: NextRequest) {
  try {
    // Require an authenticated AstroCore user so this route can't be
    // used as an open SSRF probe by anyone who finds the endpoint.
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as TestBody | null
    const baseUrlRaw = body?.baseUrl?.trim()
    const model = body?.model?.trim()
    const apiKey = body?.apiKey?.trim()

    if (!baseUrlRaw || !model || !apiKey) {
      return NextResponse.json({ success: false, message: "Вкажіть Endpoint URL, модель і API ключ." }, { status: 400 })
    }

    let safeUrl: URL
    try {
      safeUrl = assertSafeProviderUrl(baseUrlRaw)
    } catch (e) {
      const msg = e instanceof UnsafeProviderUrlError ? e.message : "Некоректний Endpoint URL."
      return NextResponse.json({ success: false, message: msg })
    }

    const target = joinProviderPath(safeUrl.toString(), "chat/completions")
    const customHeaders = parseCustomHeaders(body?.customHeaders)

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      ...customHeaders,
    }

    const startedAt = Date.now()

    let res: Response
    try {
      res = await safeFetch(target, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Reply with exactly: AstroCore connection successful" }],
          temperature: 0,
        }),
        timeoutMs: 25_000,
      })
    } catch (e) {
      const msg = e instanceof SafeFetchError ? e.message : "Не вдалося з'єднатися з ендпоінтом."
      return NextResponse.json({ success: false, message: msg })
    }

    const latencyMs = Date.now() - startedAt
    const rawText = await readCappedText(res).catch(() => "")

    if (!res.ok) {
      // Deliberately generic — never echo the remote server's raw body
      // (could contain internal details) back to the client.
      return NextResponse.json({
        success: false,
        message: `Ендпоінт повернув помилку (HTTP ${res.status}).`,
      })
    }

    let data: unknown
    try {
      data = JSON.parse(rawText)
    } catch {
      return NextResponse.json({ success: false, message: "Ендпоінт повернув некоректну відповідь (не JSON)." })
    }

    const replyText = extractReplyText(data)
    if (!replyText) {
      return NextResponse.json({ success: false, message: "Ендпоінт відповів, але без розпізнаваного тексту повідомлення." })
    }

    return NextResponse.json({
      success: true,
      message: "Підключення успішне",
      latencyMs,
    })
  } catch (err: unknown) {
    console.error("[POST /api/providers/test] error:", err instanceof Error ? err.message : String(err))
    return NextResponse.json({ success: false, message: "Помилка сервера під час перевірки підключення." }, { status: 500 })
  }
}

// OpenAI-compatible response shape, with a fallback for a couple of
// alternative shapes some self-hosted agent servers use.
function extractReplyText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) return null
  const obj = data as Record<string, unknown>

  const choices = obj.choices as { message?: { content?: unknown } }[] | undefined
  const fromChoices = choices?.[0]?.message?.content
  if (typeof fromChoices === "string" && fromChoices) return fromChoices

  const directContent = obj.content
  if (typeof directContent === "string" && directContent) return directContent

  return null
}