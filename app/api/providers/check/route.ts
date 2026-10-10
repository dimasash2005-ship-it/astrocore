// app/api/providers/check/route.ts
//
// "Test connection" for a provider: sends one tiny message ("ping", up to 5 tokens)
// and tells the user, in plain words, whether it works and what to fix if not.
//
// POST body, one of:
//   { providerId }                                              → test a saved provider
//   { slug, model, apiKey, webhookUrl?, authHeader?, customHeaders? } → test before saving
//
// Response: { ok: true, ms, reply } or { ok: false, kind, title, hint, detail }
// Keys never leave the server: a saved provider's key is decrypted here only.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { decryptSecret } from "@/lib/server/encryption"
import { assertSafeProviderUrl, joinProviderPath, UnsafeProviderUrlError } from "@/lib/server/ssrf-guard"
import { safeFetch, readCappedText, SafeFetchError } from "@/lib/server/safe-fetch"
import { explainProviderError, pickLang } from "@/lib/server/provider-errors"

export const maxDuration = 30

type Cfg = {
  slug: string
  model: string
  apiKey: string
  webhookUrl?: string | null
  authHeader?: string | null
  customHeaders?: Record<string, string> | null
}

const DEFAULT_MODEL: Record<string, string> = {
  anthropic: "claude-sonnet-4-5",
  openai: "gpt-4o-mini",
  google: "gemini-2.0-flash",
}

const PING = "ping"
const TIMEOUT_MS = 20_000

async function withTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: ctrl.signal })
  } catch (e) {
    throw new Error(ctrl.signal.aborted ? "timeout" : `fetch failed: ${e instanceof Error ? e.message : e}`)
  } finally {
    clearTimeout(timer)
  }
}

async function pingOpenAI(c: Cfg): Promise<string> {
  const res = await withTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${c.apiKey}` },
    body: JSON.stringify({ model: c.model, messages: [{ role: "user", content: PING }], max_tokens: 5 }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)?.choices?.[0]?.message?.content ?? ""
}

async function pingAnthropic(c: Cfg): Promise<string> {
  const res = await withTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": c.apiKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({ model: c.model, max_tokens: 5, messages: [{ role: "user", content: PING }] }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)?.content?.[0]?.text ?? ""
}

async function pingGoogle(c: Cfg): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(c.model)}:generateContent?key=${encodeURIComponent(c.apiKey)}`
  const res = await withTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: PING }] }], generationConfig: { maxOutputTokens: 5 } }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Google error ${res.status}: ${text.slice(0, 300)}`)
  return JSON.parse(text)?.candidates?.[0]?.content?.parts?.[0]?.text ?? ""
}

// Same request shape as callCustom in app/api/chat/route.ts (SSRF guard + safeFetch).
async function pingCustom(c: Cfg): Promise<string> {
  if (!c.webhookUrl) throw new Error("error 404: endpoint url is empty")
  let safeUrl: URL
  try {
    safeUrl = assertSafeProviderUrl(c.webhookUrl)
  } catch (e) {
    throw new Error(e instanceof UnsafeProviderUrlError ? e.message : "error 404: invalid endpoint url")
  }
  const endpoint = joinProviderPath(safeUrl.toString(), "chat/completions")
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(c.customHeaders ?? {}) }
  headers["Authorization"] = c.authHeader || `Bearer ${c.apiKey}`

  let res: Response
  try {
    res = await safeFetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ model: c.model, messages: [{ role: "user", content: PING }], max_tokens: 5 }),
      timeoutMs: TIMEOUT_MS,
    })
  } catch (e) {
    throw new Error(e instanceof SafeFetchError ? `fetch failed: ${e.message}` : "Не вдалося з'єднатися з Custom провайдером.")
  }
  const raw = await readCappedText(res)
  if (!res.ok) throw new Error(`Custom provider error ${res.status}: ${raw.slice(0, 300)}`)
  let data: Record<string, unknown>
  try { data = JSON.parse(raw) } catch { throw new Error("Custom provider returned non-JSON response.") }
  const choices = data.choices as { message?: { content?: unknown } }[] | undefined
  const reply = choices?.[0]?.message?.content ?? data.content
  if (typeof reply !== "string") throw new Error(`Custom provider returned no recognizable content. Raw: ${raw.slice(0, 200)}`)
  return reply
}

export async function POST(req: NextRequest) {
  const lang = pickLang(req.headers.get("accept-language"))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ ok: false, title: "Unauthorized", hint: "", detail: "" }, { status: 401 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { body = {} }

  let cfg: Cfg | null = null

  if (typeof body.providerId === "string") {
    const { data: row } = await supabase
      .from("providers")
      .select("slug, model, api_key, encrypted_api_key, webhook_url, auth_header, custom_headers, transport, last_seen_at")
      .eq("id", body.providerId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!row) return NextResponse.json({ ok: false, title: "Provider not found", hint: "", detail: "" }, { status: 404 })

    // OpenClaw agents connected through the AstroCore connector don't take direct requests:
    // they pull jobs. "Works" here means the connector checked in recently.
    if (row.transport === "pull") {
      const seen = row.last_seen_at ? Date.parse(row.last_seen_at as string) : 0
      if (seen && Date.now() - seen < 90_000) return NextResponse.json({ ok: true, ms: 0, reply: "online" })
      const e = explainProviderError("timeout: agent offline", lang)
      return NextResponse.json({ ok: false, ...e })
    }

    let apiKey = ""
    try { apiKey = row.encrypted_api_key ? decryptSecret(row.encrypted_api_key as string) : ((row.api_key as string) ?? "") } catch { /* handled below */ }
    cfg = {
      slug: row.slug as string,
      model: (row.model as string) || DEFAULT_MODEL[row.slug as string] || "gpt-4o-mini",
      apiKey,
      webhookUrl: row.webhook_url as string | null,
      authHeader: row.auth_header as string | null,
      customHeaders: row.custom_headers as Record<string, string> | null,
    }
  } else if (typeof body.slug === "string") {
    let customHeaders: Record<string, string> | null = null
    if (body.customHeaders && typeof body.customHeaders === "object") customHeaders = body.customHeaders as Record<string, string>
    else if (typeof body.customHeaders === "string" && body.customHeaders.trim()) {
      try { customHeaders = JSON.parse(body.customHeaders) } catch { customHeaders = null }
    }
    cfg = {
      slug: body.slug,
      model: (typeof body.model === "string" && body.model.trim()) || DEFAULT_MODEL[body.slug] || "gpt-4o-mini",
      apiKey: typeof body.apiKey === "string" ? body.apiKey.trim() : "",
      webhookUrl: typeof body.webhookUrl === "string" ? body.webhookUrl.trim() : null,
      authHeader: typeof body.authHeader === "string" && body.authHeader.trim() ? body.authHeader.trim() : null,
      customHeaders,
    }
  }

  if (!cfg) return NextResponse.json({ ok: false, title: "Nothing to test", hint: "", detail: "" }, { status: 400 })
  if (!cfg.apiKey && !cfg.authHeader) {
    const e = explainProviderError("error 401: empty api key", lang)
    return NextResponse.json({ ok: false, ...e })
  }

  const started = Date.now()
  try {
    let reply = ""
    switch (cfg.slug) {
      case "openai":    reply = await pingOpenAI(cfg); break
      case "anthropic": reply = await pingAnthropic(cfg); break
      case "google":    reply = await pingGoogle(cfg); break
      case "custom":
      case "openclaw":  reply = await pingCustom(cfg); break
      default:
        // Providers we can't ping (e.g. image generators): don't block saving.
        return NextResponse.json({ ok: true, ms: 0, reply: "", skipped: true })
    }
    // A saved provider that answered is marked as verified (removes the "UNVERIFIED" badge).
    if (typeof body.providerId === "string") {
      await supabase.from("providers").update({ status: "verified" }).eq("id", body.providerId).eq("user_id", user.id)
    }
    return NextResponse.json({ ok: true, ms: Date.now() - started, reply: reply.slice(0, 80) })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, ...explainProviderError(msg, lang) })
  }
}