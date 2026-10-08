// app/api/agent/missions/route.ts
//
// Missions API for the agent (and AstroCore's own frontend).
// Same auth as reports/memory/gallery: X-Api-Key, Bearer session or cookie,
// see ../_lib/auth. Every query goes through scoped(auth, ...) — the mandatory
// user_id filter.
//
// Required API-key scope: "reports" (a mission's whole job is to produce
// reports, so existing agent keys work without re-issuing them).
//
//   GET    /api/agent/missions            -> list the owner's missions
//   GET    /api/agent/missions?id=...     -> one mission
//   POST   /api/agent/missions            -> create { title, instructions, schedule?, run_time?, run_weekday?, timezone?, agent_id?, run_now? }
//   PATCH  /api/agent/missions            -> update { id, ...fields, run_now?, paused? }
//   DELETE /api/agent/missions            -> delete { id }
//
// Scheduled and run_now missions are started by /api/cron/missions (every 5 min).

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, scoped, type AuthOk } from '../_lib/auth'
import { nextRunAt, type MissionSchedule } from '@/lib/missions/schedule'

const SCOPE = 'reports'

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d$/

const createSchema = z.object({
  title: z.string().min(1).max(80),
  instructions: z.string().min(1).max(8000),
  schedule: z.enum(['manual', 'daily', 'weekly']).optional().default('manual'),
  run_time: z.string().regex(timeRe, 'run_time must be HH:MM').optional(),
  run_weekday: z.number().int().min(0).max(6).optional(),
  timezone: z.string().min(1).max(64).optional(),
  agent_id: z.string().uuid().optional(),
  run_now: z.boolean().optional(),
})

const updateSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(80).optional(),
  instructions: z.string().min(1).max(8000).optional(),
  schedule: z.enum(['manual', 'daily', 'weekly']).optional(),
  run_time: z.string().regex(timeRe, 'run_time must be HH:MM').optional(),
  run_weekday: z.number().int().min(0).max(6).optional(),
  timezone: z.string().min(1).max(64).optional(),
  paused: z.boolean().optional(),
  run_now: z.boolean().optional(),
})

const deleteSchema = z.object({ id: z.string().uuid() })

const PUBLIC_COLUMNS =
  'id, agent_id, title, instructions, schedule, run_time, run_weekday, timezone, status, next_run_at, last_run_at, last_report_id, created_at'

function validTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true } catch { return false }
}

// Picks which of the owner's agents runs the mission when agent_id isn't given:
// the OpenClaw agent (connected through AstroCore) seen online most recently.
async function pickAgent(auth: AuthOk): Promise<string | null> {
  const { data: providers } = await scoped(auth, 'providers')
    .select('id, slug, transport, last_seen_at')
  const openclaw = ((providers ?? []) as unknown as { id: string; slug: string; transport: string | null; last_seen_at: string | null }[])
    .filter(p => p.slug === 'openclaw' && p.transport === 'pull')
    .sort((a, b) => Date.parse(b.last_seen_at ?? '0') - Date.parse(a.last_seen_at ?? '0'))
  if (openclaw.length === 0) return null

  const { data: agents } = await scoped(auth, 'agents').select('id, provider_id, created_at')
  const list = (agents ?? []) as unknown as { id: string; provider_id: string | null; created_at: string }[]
  for (const p of openclaw) {
    const match = list.find(a => a.provider_id === p.id)
    if (match) return match.id
  }
  return null
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req, SCOPE)
  if (!auth.ok) return jsonError(auth.message, auth.status)

  const id = new URL(req.url).searchParams.get('id')
  let query = scoped(auth, 'missions').select(PUBLIC_COLUMNS).order('created_at', { ascending: false }).limit(100)
  if (id) query = scoped(auth, 'missions').select(PUBLIC_COLUMNS).eq('id', id)

  const { data, error } = await query
  if (error) return jsonError(error.message, 400)
  if (id && (!data || data.length === 0)) return jsonError('Mission not found', 404)
  return NextResponse.json({ data: id ? data![0] : data })
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req, SCOPE)
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try { body = await req.json() } catch { return jsonError('Request body must be valid JSON', 400) }
  const parsed = createSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.issues.map(i => i.message).join('; '), 400)
  const m = parsed.data

  const timezone = m.timezone && validTimeZone(m.timezone) ? m.timezone : 'Europe/Prague'
  if (m.schedule === 'weekly' && m.run_weekday === undefined) {
    return jsonError('run_weekday (0=Sunday … 6=Saturday) is required for weekly missions', 400)
  }

  let agentId = m.agent_id ?? null
  if (agentId) {
    const { data: own } = await scoped(auth, 'agents').select('id').eq('id', agentId)
    if (!own || own.length === 0) return jsonError('Agent not found', 404)
  } else {
    agentId = await pickAgent(auth)
    if (!agentId) return jsonError('No OpenClaw agent connected to AstroCore for this account', 400)
  }

  const runTime = m.schedule === 'manual' ? null : (m.run_time ?? '09:00')
  const runWeekday = m.schedule === 'weekly' ? (m.run_weekday ?? 1) : null
  const next = m.run_now
    ? new Date().toISOString()
    : nextRunAt(m.schedule as MissionSchedule, runTime, runWeekday, timezone)

  const { data, error } = await scoped(auth, 'missions').insert({
    title: m.title.trim(),
    instructions: m.instructions.trim(),
    agent_id: agentId,
    schedule: m.schedule,
    run_time: runTime,
    run_weekday: runWeekday,
    timezone,
    next_run_at: next,
  })
  if (error) return jsonError(error.message, 400)

  return NextResponse.json({
    data: data?.[0],
    url: 'https://astrocore.one/missions',
  }, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req, SCOPE)
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try { body = await req.json() } catch { return jsonError('Request body must be valid JSON', 400) }
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.issues.map(i => i.message).join('; '), 400)
  const { id, paused, run_now, ...fields } = parsed.data

  const { data: rows } = await scoped(auth, 'missions')
    .select('id, schedule, run_time, run_weekday, timezone, status').eq('id', id)
  const current = (rows?.[0] ?? null) as unknown as
    { schedule: MissionSchedule; run_time: string | null; run_weekday: number | null; timezone: string | null; status: string } | null
  if (!current) return jsonError('Mission not found', 404)

  const schedule = fields.schedule ?? current.schedule
  const runTime = schedule === 'manual' ? null : (fields.run_time ?? current.run_time ?? '09:00')
  const runWeekday = schedule === 'weekly' ? (fields.run_weekday ?? current.run_weekday ?? 1) : null
  const timezone = fields.timezone && validTimeZone(fields.timezone) ? fields.timezone : (current.timezone ?? 'Europe/Prague')

  const update: Record<string, unknown> = {
    ...fields,
    schedule,
    run_time: runTime,
    run_weekday: runWeekday,
    timezone,
    updated_at: new Date().toISOString(),
  }
  if (paused === true) update.status = 'paused'
  if (paused === false && current.status === 'paused') update.status = 'scheduled'
  update.next_run_at = run_now
    ? new Date().toISOString()
    : nextRunAt(schedule, runTime, runWeekday, timezone)

  const { data, error } = await scoped(auth, 'missions').update(update, id)
  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) return jsonError('Mission not found', 404)
  return NextResponse.json({ data: data[0] })
}

export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req, SCOPE)
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try { body = await req.json() } catch { return jsonError('Request body must be valid JSON', 400) }
  const parsed = deleteSchema.safeParse(body)
  if (!parsed.success) return jsonError(parsed.error.issues.map(i => i.message).join('; '), 400)

  const { data, error } = await scoped(auth, 'missions').delete(parsed.data.id)
  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) return jsonError('Mission not found', 404)
  return NextResponse.json({ data: data[0] })
}