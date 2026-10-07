// app/api/cron/missions/route.ts
//
// Runs scheduled Missions. Called every 5 minutes by Supabase Cron (pg_cron + pg_net),
// with header  Authorization: Bearer <CRON_SECRET>.
//
// Each call does two things:
//  1. Finish: for scheduled runs still marked "running", check whether the agent's reply
//     has arrived. If yes, save it to Reports and mark the mission done (or failed).
//  2. Start: for missions whose next_run_at has passed, open a new chat with the agent,
//     post the task and queue an agent job (same path as /api/chat/jobs), then move
//     next_run_at to the next occurrence.
//
// Scheduled runs work for OpenClaw agents connected through the AsCore connector
// (providers.slug = "openclaw", transport = "pull"): the job waits on the owner's
// server, so no Vercel time limit applies.

import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { nextRunAt, type MissionSchedule } from "@/lib/missions/schedule"

export const dynamic = "force-dynamic"

const ONLINE_WINDOW_MS = 60_000             // same rule as /api/chat/jobs
const GIVE_UP_IF_OFFLINE_MS = 2 * 3600_000  // agent offline for 2h after due time → skip this run
const MAX_STARTS_PER_CALL = 20

type Mission = {
  id: string
  user_id: string
  agent_id: string | null
  title: string
  instructions: string
  schedule: MissionSchedule
  run_time: string | null
  run_weekday: number | null
  timezone: string | null
  status: string
  next_run_at: string | null
  last_session_id: string | null
  last_message_id: string | null
  run_source: string | null
}

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service_role credentials are not configured on the server.")
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// Same wording as the chat page's buildMissionPrompt (Ukrainian by default for now).
function missionPrompt(title: string, instructions: string): string {
  return `🎯 Місія: ${title}\n\n${instructions}\n\n` +
    "Виконай це завдання повністю. Дай відповідь одним готовим результатом у Markdown: " +
    "заголовки, списки, таблиці, джерела з посиланнями, якщо вони є. " +
    "AstroCore автоматично збереже цю відповідь у Звіти, тому окремо нічого зберігати не треба."
}

async function finishRunning(svc: SupabaseClient) {
  const { data: running } = await svc
    .from("missions")
    .select("id, user_id, title, last_message_id")
    .eq("status", "running")
    .eq("run_source", "schedule")
    .not("last_message_id", "is", null)
    .limit(50)

  let finished = 0
  for (const m of (running ?? []) as Pick<Mission, "id" | "user_id" | "title" | "last_message_id">[]) {
    const { data: msg } = await svc
      .from("chat_messages")
      .select("content, status")
      .eq("id", m.last_message_id as string)
      .maybeSingle()
    if (!msg || msg.status === "pending") continue

    const content = (msg.content as string | null)?.trim() || ""
    const failed = msg.status === "error" || !content
    let reportId: string | null = null
    if (!failed) {
      const { data: rep } = await svc
        .from("reports")
        .insert({ user_id: m.user_id, company_name: m.title, summary: content })
        .select("id")
        .single()
      reportId = (rep?.id as string | undefined) ?? null
    }
    await svc.from("missions").update({
      status: failed ? "failed" : "done",
      last_report_id: reportId,
      updated_at: new Date().toISOString(),
    }).eq("id", m.id)
    finished++
  }
  return finished
}

async function startDue(svc: SupabaseClient) {
  const nowIso = new Date().toISOString()

  // Missions saved with a schedule but no next_run_at yet: fill it in, don't run.
  const { data: unplanned } = await svc
    .from("missions")
    .select("id, schedule, run_time, run_weekday, timezone")
    .neq("schedule", "manual")
    .is("next_run_at", null)
    .neq("status", "paused")
    .limit(100)
  for (const m of (unplanned ?? []) as Mission[]) {
    await svc.from("missions").update({
      next_run_at: nextRunAt(m.schedule, m.run_time, m.run_weekday, m.timezone),
    }).eq("id", m.id)
  }

  // A run that never finished (tab closed, agent crashed) shouldn't block the schedule forever.
  await svc.from("missions")
    .update({ status: "failed", updated_at: nowIso })
    .eq("status", "running")
    .lt("last_run_at", new Date(Date.now() - 2 * 3600_000).toISOString())

  const { data: due } = await svc
    .from("missions")
    .select("*")
    .neq("schedule", "manual")
    .neq("status", "paused")
    .neq("status", "running")
    .lte("next_run_at", nowIso)
    .order("next_run_at", { ascending: true })
    .limit(MAX_STARTS_PER_CALL)

  let started = 0
  const skipped: string[] = []

  for (const m of (due ?? []) as Mission[]) {
    const next = nextRunAt(m.schedule, m.run_time, m.run_weekday, m.timezone)
    const overdueMs = Date.now() - Date.parse(m.next_run_at as string)

    const skip = async (reason: string, giveUp: boolean) => {
      skipped.push(`${m.id}: ${reason}`)
      if (giveUp) {
        await svc.from("missions").update({ status: "failed", next_run_at: next, updated_at: nowIso }).eq("id", m.id)
      }
    }

    if (!m.agent_id) { await skip("no agent", true); continue }

    const { data: agent } = await svc
      .from("agents")
      .select("id, provider_id, system_prompt")
      .eq("id", m.agent_id)
      .eq("user_id", m.user_id)
      .maybeSingle()
    if (!agent?.provider_id) { await skip("agent or provider missing", true); continue }

    const { data: provider } = await svc
      .from("providers")
      .select("id, slug, model, transport, last_seen_at")
      .eq("id", agent.provider_id as string)
      .eq("user_id", m.user_id)
      .maybeSingle()
    if (!provider || provider.slug !== "openclaw" || provider.transport !== "pull") {
      await skip("scheduled runs need an OpenClaw agent connected through AstroCore", true)
      continue
    }

    const lastSeen = provider.last_seen_at ? Date.parse(provider.last_seen_at as string) : 0
    if (!lastSeen || Date.now() - lastSeen > ONLINE_WINDOW_MS) {
      // Wait for the agent to come back; give up on this run after 2 hours.
      await skip("agent offline", overdueMs > GIVE_UP_IF_OFFLINE_MS)
      continue
    }

    const prompt = missionPrompt(m.title, m.instructions || "")

    const { data: chat, error: chatErr } = await svc
      .from("chat_sessions")
      .insert({ user_id: m.user_id, agent_id: m.agent_id, title: `🎯 ${m.title}`.slice(0, 60) })
      .select("id")
      .single()
    if (chatErr || !chat) { await skip(`chat: ${chatErr?.message}`, false); continue }

    await svc.from("chat_messages").insert({
      user_id: m.user_id, session_id: chat.id, role: "user", content: prompt,
    })

    const { data: reply, error: replyErr } = await svc
      .from("chat_messages")
      .insert({ user_id: m.user_id, session_id: chat.id, role: "assistant", content: "", status: "pending" })
      .select("id")
      .single()
    if (replyErr || !reply) { await skip(`reply: ${replyErr?.message}`, false); continue }

    const messages: Record<string, unknown>[] = []
    if (agent.system_prompt) messages.push({ role: "system", content: agent.system_prompt as string })
    messages.push({ role: "user", content: prompt })

    const { error: jobErr } = await svc.from("agent_jobs").insert({
      user_id:          m.user_id,
      provider_id:      provider.id,
      session_id:       chat.id,
      reply_message_id: reply.id,
      payload: { model: (provider.model as string) || "openclaw", messages, sessionId: chat.id },
    })
    if (jobErr) {
      await svc.from("chat_messages").update({ content: "Помилка: не вдалося поставити задачу агенту.", status: "error" }).eq("id", reply.id)
      await skip(`job: ${jobErr.message}`, false)
      continue
    }

    await svc.from("missions").update({
      status: "running",
      run_source: "schedule",
      last_run_at: nowIso,
      last_session_id: chat.id,
      last_message_id: reply.id,
      next_run_at: next,
      updated_at: nowIso,
    }).eq("id", m.id)
    started++
  }

  return { started, skipped }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  try {
    const svc = service()
    await svc.rpc("expire_agent_jobs")
    const finished = await finishRunning(svc)
    const { started, skipped } = await startDue(svc)
    return NextResponse.json({ ok: true, finished, started, skipped })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[cron/missions] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}