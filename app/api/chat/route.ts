import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { decryptSecret } from "@/lib/server/encryption"
import { assertSafeProviderUrl, joinProviderPath, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"
import { safeFetch, readCappedText, SafeFetchError } from "@/lib/server/safe-fetch"

type ProviderRow = {
  id: string
  slug: string
  model: string
  api_key: string | null
  encrypted_api_key: string | null
  webhook_url: string | null
  auth_header: string | null
  custom_headers: Record<string, string> | null
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, systemPrompt, providerId } = body

    if (!providerId || typeof providerId !== "string") {
      return NextResponse.json({ error: "Провайдер не вказано." }, { status: 400 })
    }

    // The API key never travels through the browser: the client only
    // ever sends a providerId, and this route is the only place that
    // looks the row up (RLS-scoped to the caller) and decrypts the
    // secret, entirely server-side.
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, slug, model, api_key, encrypted_api_key, webhook_url, auth_header, custom_headers")
      .eq("id", providerId)
      .eq("user_id", user.id)
      .single()

    if (providerError || !provider) {
      return NextResponse.json({ error: "Провайдера не знайдено або він вам не належить." }, { status: 404 })
    }

    const row = provider as ProviderRow

    let apiKey: string
    try {
      apiKey = row.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : (row.api_key ?? "")
    } catch {
      return NextResponse.json({ error: "Не вдалося розшифрувати ключ провайдера." }, { status: 500 })
    }
    if (!apiKey) {
      return NextResponse.json({ error: "У провайдера відсутній API ключ." }, { status: 400 })
    }

    const finalModel = row.model || getDefaultModel(row.slug)
    const finalSystemPrompt = systemPrompt || ""

    let content: string

    switch (row.slug) {
      case "anthropic":
        content = await callAnthropic(apiKey, finalModel, messages, finalSystemPrompt)
        break
      case "openai":
        content = await callOpenAI(apiKey, finalModel, messages, finalSystemPrompt)
        break
      case "google":
        content = await callGoogle(apiKey, finalModel, messages, finalSystemPrompt)
        break
      case "custom":
        content = await callCustom(
          { apiKey, model: finalModel, webhookUrl: row.webhook_url, authHeader: row.auth_header, customHeaders: row.custom_headers ?? undefined },
          messages, finalSystemPrompt
        )
        break
      default:
        return NextResponse.json({ error: `Невідомий провайдер: ${row.slug}` }, { status: 400 })
    }

    return NextResponse.json({ content })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[API/chat] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── Default models ───────────────────────────────────────────────

function getDefaultModel(slug: string): string {
  switch (slug) {
    case "anthropic": return "claude-sonnet-4-5"
    case "openai":    return "gpt-4o"
    case "google":    return "gemini-2.0-flash"
    default:          return "gpt-4o"
  }
}

// ─── Image extraction ──────────────────────────────────────────────
//
// The chat UI embeds attached images directly into a message's plain
// text content as standard markdown image syntax pointing at a base64
// data URL: ![filename](data:image/png;base64,AAAA...). This keeps the
// chat_messages table (and every other consumer of message content —
// history rendering, copy-to-vault, etc.) as plain text with zero
// schema changes.
//
// Right before a request actually goes out to a model provider, we
// pull those data URLs back out of the text and turn them into the
// image content blocks each provider's API actually expects, so the
// model can see the image instead of just getting a wall of base64
// text. The stored/displayed message content is never touched.

type ExtractedImage = { mediaType: string; base64: string }

const IMAGE_MD_REGEX = /!\[[^\]]*\]\((data:image\/[a-zA-Z0-9+.\-]+;base64,[A-Za-z0-9+/=]+)\)/g

function extractImages(content: string): { text: string; images: ExtractedImage[] } {
  if (!content || !content.includes("data:image/")) {
    return { text: content, images: [] }
  }

  const images: ExtractedImage[] = []
  const text = content.replace(IMAGE_MD_REGEX, (_match, dataUrl: string) => {
    const commaIdx = dataUrl.indexOf(",")
    const meta     = dataUrl.slice(5, dataUrl.indexOf(";")) // "image/png"
    const base64   = dataUrl.slice(commaIdx + 1)
    images.push({ mediaType: meta, base64 })
    return ""
  }).trim()

  return { text, images }
}

// ─── Anthropic ────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const filtered = messages.filter(m => m.role === "user" || m.role === "assistant")

  const anthropicMessages = filtered.map(m => {
    const { text, images } = extractImages(m.content)
    if (images.length === 0) {
      return { role: m.role, content: m.content }
    }
    const blocks: Record<string, unknown>[] = images.map(img => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    }))
    if (text) blocks.push({ type: "text", text })
    return { role: m.role, content: blocks }
  })

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: anthropicMessages,
  }

  if (systemPrompt) {
    body.system = systemPrompt
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":         "application/json",
      "x-api-key":            apiKey,
      "anthropic-version":    "2023-06-01",
    },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`Anthropic error ${res.status}: ${errMsg}`)
  }

  if (Array.isArray(data.content)) {
    const textBlocks: string[] = data.content
      .filter((block: { type: string; text?: string }) => block.type === "text" && block.text)
      .map((block: { type: string; text?: string }) => block.text as string)

    if (textBlocks.length > 0) {
      // Defensive: if the response ever comes back as multiple text
      // blocks that repeat the exact same content (seen intermittently
      // with multimodal/image requests), collapse the repeats instead
      // of concatenating duplicate text into the reply.
      const uniqueBlocks = textBlocks.filter((text: string, i: number) => textBlocks.indexOf(text) === i)
      return uniqueBlocks.join("\n")
    }

    throw new Error(
      `Anthropic returned no text blocks. Raw: ${JSON.stringify(data).slice(0, 300)}`
    )
  }

  throw new Error(
    `Unexpected Anthropic response format. Raw: ${JSON.stringify(data).slice(0, 300)}`
  )
}

// ─── OpenAI ───────────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const msgs: Record<string, unknown>[] = []

  if (systemPrompt) {
    msgs.push({ role: "system", content: systemPrompt })
  }

  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue

    const { text, images } = extractImages(m.content)
    if (images.length === 0) {
      msgs.push({ role: m.role, content: m.content })
      continue
    }

    const blocks: Record<string, unknown>[] = []
    if (text) blocks.push({ type: "text", text })
    images.forEach(img => {
      blocks.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } })
    })
    msgs.push({ role: m.role, content: blocks })
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 4096 }),
  })

  const data = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`OpenAI error ${res.status}: ${errMsg}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error(`OpenAI returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return text
}

// ─── Google Gemini ────────────────────────────────────────────────

async function callGoogle(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const contents = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => {
      const { text, images } = extractImages(m.content)
      const parts: Record<string, unknown>[] = []
      if (images.length === 0) {
        parts.push({ text: m.content })
      } else {
        if (text) parts.push({ text })
        images.forEach(img => {
          parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } })
        })
      }
      return {
        role: m.role === "assistant" ? "model" : "user",
        parts,
      }
    })

  const body: Record<string, unknown> = { contents }

  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] }
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  const data = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`Google error ${res.status}: ${errMsg}`)
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) {
    throw new Error(`Google returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return text
}

// ─── Custom / webhook ─────────────────────────────────────────────
//
// Unlike the fixed anthropic.com/openai.com/googleapis.com hosts above,
// this one is a user-supplied URL, so it goes through the SSRF guard +
// safeFetch (timeout, no redirects, capped response size) rather than
// a bare fetch().

async function callCustom(
  provider: { apiKey: string; model: string; webhookUrl: string | null; authHeader?: string | null; customHeaders?: Record<string, string> },
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  if (!provider.webhookUrl) {
    throw new Error("У цього провайдера не вказано Endpoint URL.")
  }

  let safeUrl: URL
  try {
    safeUrl = assertSafeProviderUrl(provider.webhookUrl)
  } catch (e) {
    throw new Error(e instanceof UnsafeProviderUrlError ? e.message : "Некоректний Endpoint URL провайдера.")
  }
  const endpoint = joinProviderPath(safeUrl.toString(), "chat/completions")

  const msgs: Record<string, unknown>[] = []
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt })

  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue

    const { text, images } = extractImages(m.content)
    if (images.length === 0) {
      msgs.push({ role: m.role, content: m.content })
      continue
    }

    const blocks: Record<string, unknown>[] = []
    if (text) blocks.push({ type: "text", text })
    images.forEach(img => {
      blocks.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } })
    })
    msgs.push({ role: m.role, content: blocks })
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(provider.customHeaders ?? {}),
  }
  headers["Authorization"] = provider.authHeader || `Bearer ${provider.apiKey}`

  let res: Response
  try {
    res = await safeFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: provider.model,
        messages: msgs,
        max_tokens: 4096,
        user: `astrocore:${provider.model}`,
      }),
      timeoutMs: 30_000,
    })
  } catch (e) {
    throw new Error(e instanceof SafeFetchError ? e.message : "Не вдалося з'єднатися з Custom провайдером.")
  }

  const rawText = await readCappedText(res)

  if (!res.ok) {
    throw new Error(`Custom provider error ${res.status}: ${rawText.slice(0, 300)}`)
  }

  let data: unknown
  try {
    data = JSON.parse(rawText)
  } catch {
    throw new Error("Custom provider returned non-JSON response.")
  }

  const obj = data as Record<string, unknown>
  const choices = obj.choices as { message?: { content?: unknown } }[] | undefined
  const fromChoices = choices?.[0]?.message?.content
  if (typeof fromChoices === "string" && fromChoices) return fromChoices

  const directContent = obj.content
  if (typeof directContent === "string" && directContent) return directContent

  throw new Error(`Custom provider returned no recognizable content. Raw: ${rawText.slice(0, 300)}`)
}