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

// ─── Anthropic ────────────────────────────────────────────────────

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  // Filter out any system messages — Anthropic takes system separately
  const filtered = messages.filter(m => m.role === "user" || m.role === "assistant")

  const body: Record<string, unknown> = {
    model,
    max_tokens: 4096,
    messages: filtered,
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
      return textBlocks.join("\n")
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
  const msgs: { role: string; content: string }[] = []

  if (systemPrompt) {
    msgs.push({ role: "system", content: systemPrompt })
  }

  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      msgs.push(m)
    }
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
    .map(m => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }))

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

  const msgs: { role: string; content: string }[] = []
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt })
  msgs.push(...messages.filter(m => m.role === "user" || m.role === "assistant"))

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