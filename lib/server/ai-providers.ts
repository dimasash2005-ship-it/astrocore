// lib/server/ai-providers.ts
//
// Shared AI-provider calling logic, extracted from app/api/chat/route.ts
// so it can be reused by both the browser-facing chat route and the
// public /api/v1/chat/completions endpoint (external API key auth).

import { assertSafeProviderUrl, joinProviderPath, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"
import { safeFetch, readCappedText, SafeFetchError } from "@/lib/server/safe-fetch"

export type ProviderRow = {
  id: string
  slug: string
  model: string
  api_key: string | null
  encrypted_api_key: string | null
  webhook_url: string | null
  auth_header: string | null
  custom_headers: Record<string, string> | null
}

export function getDefaultModel(slug: string): string {
  switch (slug) {
    case "anthropic": return "claude-sonnet-4-5"
    case "openai":    return "gpt-4o"
    case "google":    return "gemini-2.0-flash"
    default:          return "gpt-4o"
  }
}

type ExtractedImage = { mediaType: string; base64: string }

const IMAGE_MD_REGEX = /!\[[^\]]*\]\((data:image\/[a-zA-Z0-9+.\-]+;base64,[A-Za-z0-9+/=]+)\)/g

export function extractImages(content: string): { text: string; images: ExtractedImage[] } {
  if (!content || !content.includes("data:image/")) {
    return { text: content, images: [] }
  }
  const images: ExtractedImage[] = []
  const text = content.replace(IMAGE_MD_REGEX, (_match, dataUrl: string) => {
    const commaIdx = dataUrl.indexOf(",")
    const meta     = dataUrl.slice(5, dataUrl.indexOf(";"))
    const base64   = dataUrl.slice(commaIdx + 1)
    images.push({ mediaType: meta, base64 })
    return ""
  }).trim()
  return { text, images }
}

export async function callAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const filtered = messages.filter(m => m.role === "user" || m.role === "assistant")

  const anthropicMessages = filtered.map(m => {
    const { text, images } = extractImages(m.content)
    if (images.length === 0) return { role: m.role, content: m.content }
    const blocks: Record<string, unknown>[] = images.map(img => ({
      type: "image",
      source: { type: "base64", media_type: img.mediaType, data: img.base64 },
    }))
    if (text) blocks.push({ type: "text", text })
    return { role: m.role, content: blocks }
  })

  const body: Record<string, unknown> = { model, max_tokens: 4096, messages: anthropicMessages }
  if (systemPrompt) body.system = systemPrompt

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
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
    const uniqueTextBlocks = textBlocks.filter((text: string, i: number) => textBlocks.indexOf(text) === i)
    const finalText = uniqueTextBlocks.join("\n")
    if (finalText) return finalText
    throw new Error(`Anthropic returned no text blocks. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  }
  throw new Error(`Unexpected Anthropic response format. Raw: ${JSON.stringify(data).slice(0, 300)}`)
}

export async function callOpenAI(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const msgs: Record<string, unknown>[] = []
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt })

  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue
    const { text, images } = extractImages(m.content)
    if (images.length === 0) { msgs.push({ role: m.role, content: m.content }); continue }
    const blocks: Record<string, unknown>[] = []
    if (text) blocks.push({ type: "text", text })
    images.forEach(img => blocks.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } }))
    msgs.push({ role: m.role, content: blocks })
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 4096 }),
  })

  const data = await res.json()
  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`OpenAI error ${res.status}: ${errMsg}`)
  }
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error(`OpenAI returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  return text
}

export async function callGoogle(
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
        images.forEach(img => parts.push({ inlineData: { mimeType: img.mediaType, data: img.base64 } }))
      }
      return { role: m.role === "assistant" ? "model" : "user", parts }
    })

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  const data = await res.json()
  if (!res.ok) {
    const errMsg = data?.error?.message ?? JSON.stringify(data)
    throw new Error(`Google error ${res.status}: ${errMsg}`)
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`Google returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  return text
}

export async function callCustom(
  provider: { apiKey: string; model: string; webhookUrl: string | null; authHeader?: string | null; customHeaders?: Record<string, string> },
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  if (!provider.webhookUrl) throw new Error("У цього провайдера не вказано Endpoint URL.")

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
    if (images.length === 0) { msgs.push({ role: m.role, content: m.content }); continue }
    const blocks: Record<string, unknown>[] = []
    if (text) blocks.push({ type: "text", text })
    images.forEach(img => blocks.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } }))
    msgs.push({ role: m.role, content: blocks })
  }

  const headers: Record<string, string> = { "Content-Type": "application/json", ...(provider.customHeaders ?? {}) }
  headers["Authorization"] = provider.authHeader || `Bearer ${provider.apiKey}`

  let res: Response
  try {
    res = await safeFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: provider.model, messages: msgs, max_tokens: 4096, user: `astrocore:${provider.model}` }),
      timeoutMs: 30_000,
    })
  } catch (e) {
    throw new Error(e instanceof SafeFetchError ? e.message : "Не вдалося з'єднатися з Custom провайдером.")
  }

  const rawText = await readCappedText(res)
  if (!res.ok) throw new Error(`Custom provider error ${res.status}: ${rawText.slice(0, 300)}`)

  let data: unknown
  try { data = JSON.parse(rawText) } catch { throw new Error("Custom provider returned non-JSON response.") }

  const obj = data as Record<string, unknown>
  const choices = obj.choices as { message?: { content?: unknown } }[] | undefined
  const fromChoices = choices?.[0]?.message?.content
  if (typeof fromChoices === "string" && fromChoices) return fromChoices

  const directContent = obj.content
  if (typeof directContent === "string" && directContent) return directContent

  throw new Error(`Custom provider returned no recognizable content. Raw: ${rawText.slice(0, 300)}`)
}

export async function callProvider(
  row: ProviderRow,
  apiKey: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const model = row.model || getDefaultModel(row.slug)
  switch (row.slug) {
    case "anthropic": return callAnthropic(apiKey, model, messages, systemPrompt)
    case "openai":    return callOpenAI(apiKey, model, messages, systemPrompt)
    case "google":    return callGoogle(apiKey, model, messages, systemPrompt)
    case "custom":
      return callCustom(
        { apiKey, model, webhookUrl: row.webhook_url, authHeader: row.auth_header, customHeaders: row.custom_headers ?? undefined },
        messages, systemPrompt
      )
    default:
      throw new Error(`Невідомий провайдер: ${row.slug}`)
  }
}