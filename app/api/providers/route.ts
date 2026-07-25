import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { encryptSecret, maskSecret } from "@/lib/server/encryption"
import { assertSafeProviderUrl, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"

const VALID_SLUGS = ["openai", "anthropic", "google", "custom"] as const
type ProviderSlug = (typeof VALID_SLUGS)[number]

interface CreateBody {
  name?: string
  slug?: string
  model?: string
  apiKey?: string
  webhookUrl?: string
  authHeader?: string
  customHeaders?: string // raw JSON text from the UI's textarea
}

// ─── Validation (no Zod in this project — kept intentionally light) ──

function validateName(raw: string | undefined, fallback: string): string {
  const name = (raw ?? "").trim() || fallback
  return name.slice(0, 100)
}

function validateSlug(raw: string | undefined): ProviderSlug | null {
  return (VALID_SLUGS as readonly string[]).includes(raw ?? "") ? (raw as ProviderSlug) : null
}

function validateModel(raw: string | undefined): string | null {
  const model = (raw ?? "").trim()
  if (!model || model.length > 100) return null
  return model
}

function validateApiKey(raw: string | undefined): string | null {
  const key = (raw ?? "").trim()
  if (!key || key.length > 500) return null
  return key
}

/** Parses+validates the "custom headers" textarea JSON. Returns null on any problem. */
function validateCustomHeaders(raw: string | undefined): Record<string, string> | null | "invalid" {
  const text = (raw ?? "").trim()
  if (!text) return null
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return "invalid"
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return "invalid"
  const entries = Object.entries(parsed as Record<string, unknown>)
  if (entries.length > 20) return "invalid"
  const result: Record<string, string> = {}
  for (const [key, value] of entries) {
    if (typeof value !== "string") return "invalid"
    if (key.length > 100 || value.length > 500) return "invalid"
    result[key] = value
  }
  return result
}

// ─── GET /api/providers — list the current user's providers ───────
// Never selects encrypted_api_key, api_key, auth_header, or
// custom_headers — those never leave the server after being saved.

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("providers")
      .select("id, name, slug, model, is_active, status, key_preview, webhook_url, created_at")
      .order("created_at", { ascending: true })

    if (error) throw new Error(error.message)

    return NextResponse.json({ providers: data ?? [] })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[GET /api/providers] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// ─── POST /api/providers — create a provider, encrypting the secret ──

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as CreateBody | null
    if (!body) {
      return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 })
    }

    const slug = validateSlug(body.slug)
    if (!slug) {
      return NextResponse.json({ error: "Невідомий тип провайдера." }, { status: 400 })
    }

    const model = validateModel(body.model)
    if (!model) {
      return NextResponse.json({ error: "Вкажіть модель." }, { status: 400 })
    }

    const apiKey = validateApiKey(body.apiKey)
    if (!apiKey) {
      return NextResponse.json({ error: "Введіть коректний API ключ." }, { status: 400 })
    }

    const presetNames: Record<ProviderSlug, string> = {
      openai: "OpenAI", anthropic: "Anthropic Claude", google: "Google Gemini", custom: "Custom / Webhook",
    }
    const name = validateName(body.name, presetNames[slug])

    let webhookUrl: string | null = null
    if (slug === "custom") {
      const raw = (body.webhookUrl ?? "").trim()
      if (!raw) {
        return NextResponse.json({ error: "Вкажіть Endpoint URL для Custom провайдера." }, { status: 400 })
      }
      try {
        webhookUrl = assertSafeProviderUrl(raw).toString()
      } catch (e) {
        const msg = e instanceof UnsafeProviderUrlError ? e.message : "Некоректний Endpoint URL."
        return NextResponse.json({ error: msg }, { status: 400 })
      }
    }

    const authHeader = (body.authHeader ?? "").trim().slice(0, 500) || null

    const customHeadersResult = validateCustomHeaders(body.customHeaders)
    if (customHeadersResult === "invalid") {
      return NextResponse.json({ error: "Додаткові заголовки мають бути коректним JSON-об'єктом (рядок → рядок, до 20 полів)." }, { status: 400 })
    }

    const { data, error } = await supabase
      .from("providers")
      .insert({
        user_id:           user.id,
        name,
        slug,
        model,
        is_active:         true,
        api_key:           null, // legacy column — new rows never use it
        encrypted_api_key: encryptSecret(apiKey),
        key_preview:       maskSecret(apiKey),
        status:            "unverified",
        webhook_url:       webhookUrl,
        auth_header:       authHeader,
        custom_headers:    customHeadersResult,
      })
      .select("id, name, slug, model, is_active, status, key_preview, webhook_url, created_at")
      .single()

    if (error || !data) {
      throw new Error(error?.message || "Не вдалося зберегти провайдера.")
    }

    return NextResponse.json({ provider: data }, { status: 201 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/providers] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}