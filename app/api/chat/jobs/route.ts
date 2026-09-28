// app/api/chat/jobs/route.ts
//
// Background chat for OpenClaw agents connected through the AsCore
// connector (providers.transport = "pull").
//
// This route never waits for the agent. It creates an empty "pending"
// assistant message, puts a job into agent_jobs and returns in ~1s.
// The connector on the user's own server picks the job up (Supabase RPC
// agent_claim), runs it on its OpenClaw and writes the reply straight into
// that message (agent_report). The chat page sees it via Realtime.
// No Vercel timeout is involved at any point, however long the agent works.

import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import { extractImages } from "@/lib/server/ai-providers"

export const dynamic = "force-dynamic"

// The connector checks in every ~2s (and every 20s while busy), so an agent
// silent for longer than this is treated as offline.
const ONLINE_WINDOW_MS = 60_000

type ChatMsg = { role: string; content: string }

let _service: SupabaseClient | null = null
function service(): SupabaseClient {
  if (_service) return _service
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service_role credentials are not configured on the server.")
  _service = createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
  return _service
}

// Same conversion as /api/chat/stream: markdown data-URL images become
// OpenAI image blocks, so the connector can pass messages through as-is.
function toOpenAIMessages(messages: ChatMsg[], systemPrompt: string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  if (systemPrompt) out.push({ role: "system", content: systemPrompt })
  for (const m of messages) {
    if (m?.role !== "user" && m?.role !== "assistant") continue
    if (typeof m.content !== "string" || !m.content.trim()) continue
    const { text, images } = extractImages(m.content)
    if (images.length === 0) { out.push({ role: m.role, content: m.content }); continue }
    const blocks: Record<string, unknown>[] = []
    if (text) blocks.push({ type: "text", text })
    images.forEach(img => blocks.push({ type: "image_url", image_url: { url: `data:${img.mediaType};base64,${img.base64}` } }))
    out.push({ role: m.role, content: blocks })
  }
  return out
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | { messages?: unknown; systemPrompt?: unknown; providerId?: unknown; sessionId?: unknown }
      | null
    if (!body) return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 })

    const providerId = typeof body.providerId === "string" ? body.providerId : ""
    const sessionId  = typeof body.sessionId === "string" ? body.sessionId : ""
    if (!providerId) return NextResponse.json({ error: "Провайдер не вказано." }, { status: 400 })
    if (!sessionId)  return NextResponse.json({ error: "Чат не вказано." }, { status: 400 })
    if (!Array.isArray(body.messages)) return NextResponse.json({ error: "messages має бути масивом." }, { status: 400 })

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { data: session } = await supabase
      .from("chat_sessions")
      .select("id")
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (!session) return NextResponse.json({ error: "Чат не знайдено." }, { status: 404 })

    const { data: provider, error: providerError } = await supabase
      .from("providers")
      .select("id, slug, model, transport, last_seen_at")
      .eq("id", providerId)
      .eq("user_id", user.id)
      .maybeSingle()
    if (providerError || !provider) {
      return NextResponse.json({ error: "Провайдера не знайдено або він вам не належить." }, { status: 404 })
    }
    if (provider.slug !== "openclaw" || provider.transport !== "pull") {
      return NextResponse.json(
        { error: "Цей агент підключений за старою схемою. Запусти команду підключення на сервері ще раз." },
        { status: 400 }
      )
    }

    const svc = service()

    // Closes stuck jobs even if pg_cron isn't enabled. Best-effort.
    await svc.rpc("expire_agent_jobs")

    const lastSeen = provider.last_seen_at ? Date.parse(provider.last_seen_at as string) : 0
    if (!lastSeen || Date.now() - lastSeen > ONLINE_WINDOW_MS) {
      return NextResponse.json(
        { error: "Агент офлайн: сервер з агентом зараз не на зв'язку. Перевір, що він увімкнений (systemctl status ascore-connector)." },
        { status: 409 }
      )
    }

    const { data: openJobs } = await svc
      .from("agent_jobs")
      .select("id")
      .eq("session_id", sessionId)
      .eq("user_id", user.id)
      .in("status", ["queued", "running"])
      .limit(1)
    if (openJobs && openJobs.length > 0) {
      return NextResponse.json({ error: "Агент ще відповідає на попереднє повідомлення в цьому чаті." }, { status: 409 })
    }

    const systemPrompt = typeof body.systemPrompt === "string" ? body.systemPrompt : ""
    const messages = toOpenAIMessages(body.messages as ChatMsg[], systemPrompt)
    if (!messages.some(m => m.role === "user")) {
      return NextResponse.json({ error: "Немає повідомлення для агента." }, { status: 400 })
    }

    // Empty placeholder the agent will fill in. Inserted as the user (RLS).
    const { data: reply, error: replyError } = await supabase
      .from("chat_messages")
      .insert({ user_id: user.id, session_id: sessionId, role: "assistant", content: "", status: "pending" })
      .select("id, created_at")
      .single()
    if (replyError || !reply) {
      return NextResponse.json({ error: `Не вдалося створити повідомлення: ${replyError?.message ?? "невідома помилка"}` }, { status: 500 })
    }

    const { data: job, error: jobError } = await svc
      .from("agent_jobs")
      .insert({
        user_id:          user.id,
        provider_id:      provider.id,
        session_id:       sessionId,
        reply_message_id: reply.id,
        payload: {
          model: (provider.model as string) || "openclaw",
          messages,
          sessionId,
        },
      })
      .select("id")
      .single()

    if (jobError || !job) {
      await svc
        .from("chat_messages")
        .update({ content: "Помилка: не вдалося поставити задачу агенту.", status: "error" })
        .eq("id", reply.id)
        .eq("user_id", user.id)
      return NextResponse.json({ error: `Не вдалося поставити задачу: ${jobError?.message ?? "невідома помилка"}` }, { status: 500 })
    }

    return NextResponse.json({ jobId: job.id, messageId: reply.id, createdAt: reply.created_at })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[API/chat/jobs] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}