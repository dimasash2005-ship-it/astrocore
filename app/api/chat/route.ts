import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { messages, systemPrompt, provider } = body

    if (!provider?.slug || !provider?.apiKey) {
      return NextResponse.json(
        { error: "Провайдер не вказано або відсутній API ключ." },
        { status: 400 }
      )
    }

    const { slug, apiKey, model } = provider
    const finalModel = model || getDefaultModel(slug)
    const finalSystemPrompt = systemPrompt || ""

    let content: string

    switch (slug) {
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
        content = await callCustom(provider, messages, finalSystemPrompt)
        break
      default:
        return NextResponse.json({ error: `Невідомий провайдер: ${slug}` }, { status: 400 })
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
  // Filter out any system messages — Anthropic takes system separately
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

  // Robust parsing: collect all text blocks
  if (Array.isArray(data.content)) {
    const textBlocks = data.content
      .filter((block: { type: string; text?: string }) => block.type === "text" && block.text)
      .map((block: { type: string; text?: string }) => block.text as string)

    if (textBlocks.length > 0) {
      // Defensive: if the response ever comes back as multiple text
      // blocks that repeat the exact same content (seen intermittently
      // with multimodal/image requests), collapse the repeats instead
      // of concatenating duplicate text into the reply.
      const uniqueBlocks = textBlocks.filter((text, i) => textBlocks.indexOf(text) === i)
      return uniqueBlocks.join("\n")
    }

    // No text blocks found — throw with raw preview
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

async function callCustom(
  provider: { apiKey: string; model: string; webhookUrl?: string; authHeader?: string; customHeaders?: Record<string, string> },
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const endpoint = provider.webhookUrl || "https://api.openai.com/v1/chat/completions"

  // Custom endpoints are assumed to be OpenAI-compatible, so images use
  // the same image_url block shape as callOpenAI above.
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

  if (provider.authHeader) {
    headers["Authorization"] = provider.authHeader
  } else {
    headers["Authorization"] = `Bearer ${provider.apiKey}`
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      messages: msgs,
      max_tokens: 4096,
    }),
  })

  const data = await res.json()

  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`Custom provider error ${res.status}: ${errMsg}`)
  }

  const text = data.choices?.[0]?.message?.content
  if (!text) {
    throw new Error(`Custom provider returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  }
  return text
}