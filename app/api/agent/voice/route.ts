// app/api/agent/voice/route.ts
//
// Lets a connected agent (OpenClaw via ascore-connector) post a VOICE reply.
// The agent makes the audio itself (e.g. ElevenLabs, configured by the owner
// in OpenClaw); the connector uploads the file here and it appears in the
// chat as a voice message from the agent — same player as user voice notes.
//
//   POST multipart/form-data
//     X-Api-Key: ac_live_…           (the connector's key)
//     job_id:    <agent_jobs.id>     (the job being answered)
//     file:      audio (mp3/ogg/opus/m4a/wav/webm), ≤ 4 MB
//     duration:  seconds (optional)
//
// Security: the key → user + provider; the job must belong to BOTH, so an
// agent can only attach audio to replies of its own owner's chats.

import { NextRequest, NextResponse } from "next/server"
import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { verifyApiKey } from "@/lib/api-keys"

export const dynamic = "force-dynamic"
export const maxDuration = 60

// Vercel caps request bodies at 4.5 MB.
const MAX_BYTES = 4 * 1024 * 1024

const EXT: Record<string, string> = {
  "audio/mpeg": "mp3", "audio/mp3": "mp3",
  "audio/ogg": "ogg", "audio/opus": "ogg",
  "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/aac": "m4a",
  "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav",
  "audio/webm": "webm",
}

let _svc: SupabaseClient | null = null
function svc(): SupabaseClient {
  if (_svc) return _svc
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured on the server.")
  _svc = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _svc
}

function guessType(name: string, type: string): string {
  if (type && EXT[type.split(";")[0]]) return type.split(";")[0]
  const ext = name.toLowerCase().split(".").pop() || ""
  return ({ mp3: "audio/mpeg", ogg: "audio/ogg", opus: "audio/ogg", oga: "audio/ogg", m4a: "audio/mp4",
            aac: "audio/aac", wav: "audio/wav", webm: "audio/webm" } as Record<string, string>)[ext] || ""
}

export async function POST(req: NextRequest) {
  try {
    const verified = await verifyApiKey(req.headers.get("x-api-key"))
    if (!verified) return NextResponse.json({ error: "invalid_key" }, { status: 401 })

    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 })
    const jobId = String(form.get("job_id") ?? "")
    const file = form.get("file")
    const durationRaw = Number(form.get("duration"))
    if (!jobId || !(file instanceof File)) {
      return NextResponse.json({ error: "job_id and file are required." }, { status: 400 })
    }
    if (file.size === 0 || file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Audio must be between 1 byte and 4 MB." }, { status: 413 })
    }
    const mime = guessType(file.name, file.type)
    if (!mime) return NextResponse.json({ error: "Unsupported audio type." }, { status: 415 })

    const db = svc()

    // key → provider
    const { data: keyRow } = await db
      .from("api_keys").select("provider_id")
      .eq("id", verified.id).eq("user_id", verified.userId).is("revoked_at", null)
      .maybeSingle()
    if (!keyRow?.provider_id) return NextResponse.json({ error: "This key is not an agent connection." }, { status: 403 })

    // job must belong to this user AND this agent
    const { data: job } = await db
      .from("agent_jobs").select("id, session_id, reply_message_id")
      .eq("id", jobId).eq("user_id", verified.userId).eq("provider_id", keyRow.provider_id)
      .maybeSingle()
    if (!job?.reply_message_id) return NextResponse.json({ error: "Job not found." }, { status: 404 })

    const path = `${verified.userId}/${job.session_id}/agent-${crypto.randomUUID()}.${EXT[mime]}`
    const bytes = new Uint8Array(await file.arrayBuffer())
    const { error: upErr } = await db.storage.from("voice").upload(path, bytes, { contentType: mime, upsert: false })
    if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 })

    const { error: updErr } = await db
      .from("chat_messages")
      .update({
        audio_path: path,
        audio_duration: Number.isFinite(durationRaw) && durationRaw > 0 ? Math.round(durationRaw * 10) / 10 : null,
      })
      .eq("id", job.reply_message_id).eq("user_id", verified.userId)
    if (updErr) {
      await db.storage.from("voice").remove([path]).catch(() => {})
      return NextResponse.json({ error: `Couldn't attach audio: ${updErr.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, path })
  } catch (e) {
    console.error("[agent/voice]", e)
    return NextResponse.json({ error: "Server error." }, { status: 500 })
  }
}