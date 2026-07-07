import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyApiKey } from "@/lib/api-keys"

// ─── Types ────────────────────────────────────────────────────────

interface ObsidianRequestBody {
  prompt: string
  noteTitle?: string
  selectedText?: string
  fullNote?: string
}

// ─── Helpers reused from app/api/chat/route.ts logic ──────────────

function getDefaultModel(slug: string): string {
  switch (slug) {
    case "anthropic": return "claude-sonnet-4-5"
    case "openai":    return "gpt-4o"
    case "google":    return "gemini-2.0-flash"
    default:          return "gpt-4o"
  }
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const filtered = messages.filter(m => m.role === "user" || m.role === "assistant")
  const body: Record<string, unknown> = { model, max_tokens: 4096, messages: filtered }
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
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`)

  if (Array.isArray(data.content)) {
    const textBlocks = data.content
      .filter((b: { type: string; text?: string }) => b.type === "text" && b.text)
      .map((b: { type: string; text?: string }) => b.text as string)
    if (textBlocks.length > 0) return textBlocks.join("\n")
  }
  throw new Error(`Anthropic returned no text. Raw: ${JSON.stringify(data).slice(0, 300)}`)
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const msgs: { role: string; content: string }[] = []
  if (systemPrompt) msgs.push({ role: "system", content: systemPrompt })
  msgs.push(...messages.filter(m => m.role === "user" || m.role === "assistant"))

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages: msgs, max_tokens: 4096 }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`)
  const text = data.choices?.[0]?.message?.content
  if (!text) throw new Error(`OpenAI returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  return text
}

async function callGoogle(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const contents = messages
    .filter(m => m.role === "user" || m.role === "assistant")
    .map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }))

  const body: Record<string, unknown> = { contents }
  if (systemPrompt) body.systemInstruction = { parts: [{ text: systemPrompt }] }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(`Google error ${res.status}: ${data?.error?.message ?? JSON.stringify(data)}`)
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error(`Google returned no content. Raw: ${JSON.stringify(data).slice(0, 300)}`)
  return text
}

async function callProvider(
  slug: string,
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt: string
): Promise<string> {
  const finalModel = model || getDefaultModel(slug)
  switch (slug) {
    case "anthropic": return callAnthropic(apiKey, finalModel, messages, systemPrompt)
    case "openai":    return callOpenAI(apiKey, finalModel, messages, systemPrompt)
    case "google":    return callGoogle(apiKey, finalModel, messages, systemPrompt)
    default:          throw new Error(`Unsupported provider for Obsidian integration: ${slug}`)
  }
}

// Looks up the caller's active provider by user_id, using the
// service_role client (there is no Supabase session here — the
// caller authenticated via an API key, not cookies).
async function resolveProviderForUser(userId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service credentials не налаштовані на сервері.")
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  return supabase
    .from("providers")
    .select("slug, api_key, model")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
}

// Legacy dev-only lookup: first active provider across the workspace,
// with no user scoping. Kept ONLY for local development, so working
// against Obsidian doesn't require issuing yourself an API key on
// every reset of the dev database.
async function resolveProviderDevFallback() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service credentials не налаштовані на сервері.")
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  return supabase
    .from("providers")
    .select("slug, api_key, model")
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()
}

// ─── Route handler ─────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    // ── Authenticate the caller via API key ──
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization")
    const bearerMatch = authHeader?.match(/^Bearer\s+(.+)$/i)
    const rawKey = bearerMatch?.[1]?.trim()

    let userId: string | null = null
    let usedDevFallback = false

    if (rawKey) {
      const verified = await verifyApiKey(rawKey)
      if (!verified) {
        return NextResponse.json({ error: "Недійсний або відкликаний API ключ." }, { status: 401 })
      }
      if (!verified.permissions.includes("chat") && !verified.permissions.includes("integrations")) {
        return NextResponse.json(
          { error: "Цей API ключ не має дозволу 'chat' або 'integrations'." },
          { status: 403 }
        )
      }
      userId = verified.userId
    } else if (process.env.NODE_ENV === "development") {
      // No Authorization header — allowed only in local development,
      // so existing dev workflows keep working without an API key.
      usedDevFallback = true
    } else {
      return NextResponse.json(
        { error: "Відсутній або невірний Authorization header. Очікується: Bearer ac_live_..." },
        { status: 401 }
      )
    }

    const body = (await req.json()) as ObsidianRequestBody
    const { prompt, noteTitle, selectedText, fullNote } = body

    if (!prompt || !prompt.trim()) {
      return NextResponse.json({ error: "Поле prompt є обов'язковим." }, { status: 400 })
    }

    // Build context-aware user message from Obsidian note data
    const contextParts: string[] = []
    if (noteTitle)    contextParts.push(`Назва нотатки: ${noteTitle}`)
    if (selectedText) contextParts.push(`Виділений текст:\n${selectedText}`)
    if (fullNote)      contextParts.push(`Повний текст нотатки:\n${fullNote}`)

    const finalContent = contextParts.length > 0
      ? `${contextParts.join("\n\n")}\n\nЗапит: ${prompt}`
      : prompt

    // Convert simple prompt into the messages[] shape used by /api/chat
    const messages = [{ role: "user", content: finalContent }]

    const { data: provider, error: providerError } = usedDevFallback
      ? await resolveProviderDevFallback()
      : await resolveProviderForUser(userId as string)

    if (providerError || !provider) {
      return NextResponse.json(
        { error: "Активний провайдер не знайдений. Підключіть провайдера в AstroCore." },
        { status: 400 }
      )
    }

    const systemPrompt =
      "Ти — AI асистент AstroCore, інтегрований в Obsidian. Відповідай чітко, структуровано і по суті, враховуючи контекст нотатки користувача."

    const reply = await callProvider(
      provider.slug,
      provider.api_key,
      provider.model,
      messages,
      systemPrompt
    )

    return NextResponse.json({ reply })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[API/integrations/obsidian/chat] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}