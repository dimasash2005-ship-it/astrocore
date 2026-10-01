// app/api/voice/transcribe/route.ts
//
// Turns a recorded voice message into text for the agent.
//
// The browser uploads the audio straight to Supabase Storage (bucket
// "voice", folder = user id) and sends only the path here — so long
// recordings never hit Vercel's 4.5 MB request-body limit.
//
// Engine, first one available wins:
//   1. GROQ_API_KEY   (server env) → whisper-large-v3-turbo — fast & cheap
//   2. OPENAI_API_KEY (server env) → whisper-1
//   3. the user's own active OpenAI provider key → whisper-1
// If none is set, returns 501 { code: "no_engine" } and the chat falls
// back to the live text the browser recognised while recording.

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { decryptSecret } from "@/lib/server/encryption"

export const dynamic = "force-dynamic"
export const maxDuration = 120

const MAX_BYTES = 25 * 1024 * 1024 // Whisper API limit

type Engine = { name: string; url: string; key: string; model: string }

function extFor(mime: string): string {
  if (mime.includes("ogg")) return "ogg"
  if (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac")) return "m4a"
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3"
  if (mime.includes("wav")) return "wav"
  return "webm"
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as { path?: unknown; lang?: unknown } | null
    const path = typeof body?.path === "string" ? body.path : ""
    const lang = body?.lang === "uk" || body?.lang === "en" ? body.lang : undefined
    if (!path) return NextResponse.json({ error: "Не вказано файл." }, { status: 400 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Only the caller's own folder. (Storage RLS enforces this too.)
    if (!path.startsWith(`${user.id}/`) || path.includes("..")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // ── pick an engine ──────────────────────────────────────────
    let engine: Engine | null = null
    if (process.env.GROQ_API_KEY) {
      engine = { name: "groq", url: "https://api.groq.com/openai/v1/audio/transcriptions", key: process.env.GROQ_API_KEY, model: "whisper-large-v3-turbo" }
    } else if (process.env.OPENAI_API_KEY) {
      engine = { name: "openai", url: "https://api.openai.com/v1/audio/transcriptions", key: process.env.OPENAI_API_KEY, model: "whisper-1" }
    } else {
      const { data: rows } = await supabase
        .from("providers")
        .select("api_key, encrypted_api_key, is_active")
        .eq("user_id", user.id)
        .eq("slug", "openai")
        .order("is_active", { ascending: false })
        .limit(1)
      const row = rows?.[0]
      if (row) {
        let key = ""
        try { key = row.encrypted_api_key ? decryptSecret(row.encrypted_api_key) : (row.api_key ?? "") } catch {}
        if (key) engine = { name: "openai-user", url: "https://api.openai.com/v1/audio/transcriptions", key, model: "whisper-1" }
      }
    }
    if (!engine) {
      return NextResponse.json({ error: "Сервер не має ключа для розпізнавання мовлення.", code: "no_engine" }, { status: 501 })
    }

    // ── fetch the audio ─────────────────────────────────────────
    const { data: file, error: dlError } = await supabase.storage.from("voice").download(path)
    if (dlError || !file) return NextResponse.json({ error: "Аудіо не знайдено." }, { status: 404 })
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Запис завеликий для розпізнавання (макс. 25 МБ)." }, { status: 413 })

    const mime = file.type || "audio/webm"
    const form = new FormData()
    form.append("file", new File([file], `voice.${extFor(mime)}`, { type: mime.split(";")[0] }))
    form.append("model", engine.model)
    form.append("response_format", "json")
    form.append("temperature", "0")
    // A hint only — Whisper still handles mixed UA/EN speech.
    if (lang) form.append("prompt", lang === "uk" ? "Голосове повідомлення українською." : "A voice message in English.")

    const res = await fetch(engine.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${engine.key}` },
      body: form,
      signal: AbortSignal.timeout(110_000),
    })
    const raw = await res.text()
    if (!res.ok) {
      console.error("[voice/transcribe]", engine.name, res.status, raw.slice(0, 400))
      return NextResponse.json({ error: `Розпізнавання не вдалося (${engine.name} ${res.status}).` }, { status: 502 })
    }
    let text = ""
    try { text = String(JSON.parse(raw)?.text ?? "") } catch { text = raw }

    return NextResponse.json({ text: text.trim(), engine: engine.name })
  } catch (e) {
    console.error("[voice/transcribe]", e)
    return NextResponse.json({ error: "Помилка сервера під час розпізнавання." }, { status: 500 })
  }
}