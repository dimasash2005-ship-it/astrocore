import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, scoped } from '../_lib/auth'

// ---------------------------------------------------------------------------
// This route is called by the AI agent on behalf of an AstroCore user, via
// one of three auth paths (X-Api-Key / Bearer session token / cookie
// session) — see ../_lib/auth for the full explanation. Every query in this
// file goes through scoped(auth, 'reports'), the single mandatory
// .eq('user_id', ...) choke point — required as the actual security
// boundary for the API-key path (service role, no RLS), and redundant but
// harmless defense-in-depth for the session paths (RLS already enforces
// it there). Required scope for an API key: "reports".
// ---------------------------------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ---------------------------------------------------------------------------
// Zod schemas — matches the actual `reports` table:
//   id uuid, user_id uuid, company_name text, summary text,
//   chart_data jsonb, created_at timestamptz
// user_id is deliberately NOT part of any input schema — it must never be
// settable from the request body. id/created_at are server/db-generated.
// ---------------------------------------------------------------------------
const reportCreateSchema = z.object({
  company_name: z.string().min(1).max(300),
  summary: z.string().min(1),
  chart_data: z.record(z.string(), z.unknown()).optional(),
})

const reportUpdateSchema = z
  .object({
    id: z.string().uuid(),
    company_name: z.string().min(1).max(300).optional(),
    summary: z.string().min(1).optional(),
    chart_data: z.record(z.string(), z.unknown()).optional(),
  })
  .refine(
    (body) => Object.keys(body).some((k) => k !== 'id'),
    { message: 'At least one field besides id must be provided' }
  )

const reportDeleteSchema = z.object({
  id: z.string().uuid(),
})

const listQuerySchema = z.object({
  id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

// ---------------------------------------------------------------------------
// GET /api/agent/reports        -> list caller's reports
// GET /api/agent/reports?id=... -> fetch one of caller's reports
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'reports')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  const { searchParams } = new URL(req.url)
  const parsed = listQuerySchema.safeParse({
    id: searchParams.get('id') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    offset: searchParams.get('offset') ?? undefined,
  })
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }
  const { id, limit, offset } = parsed.data

  const table = scoped(auth, 'reports')

  let query = table.select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (id) {
    query = table.select('*').eq('id', id)
  }

  const { data, error } = await query

  if (error) return jsonError(error.message, 400)
  if (id && (!data || data.length === 0)) {
    return jsonError('Report not found', 404)
  }

  return NextResponse.json({ data: id ? data[0] : data })
}

// ---------------------------------------------------------------------------
// POST /api/agent/reports -> create a report owned by the caller
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'reports')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be valid JSON', 400)
  }

  const parsed = reportCreateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  // user_id is injected inside scoped().insert() from the authenticated
  // caller — never from the request body. The schema above doesn't even
  // accept a user_id field, so one can't be smuggled in either way.
  const { data, error } = await scoped(auth, 'reports').insert(parsed.data).single()

  if (error) return jsonError(error.message, 400)
  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/agent/reports -> update one of the caller's reports
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req, 'reports')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be valid JSON', 400)
  }

  const parsed = reportUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }
  const { id, ...updates } = parsed.data

  const { data, error } = await scoped(auth, 'reports').update(updates, id)

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    // Either the report doesn't exist, or it belongs to someone else and
    // the user_id filter silently excluded it — both look identical from
    // the outside, which is the correct behavior (no existence oracle for
    // other users' data).
    return jsonError('Report not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}

// ---------------------------------------------------------------------------
// DELETE /api/agent/reports -> delete one of the caller's reports
// Body: { "id": "<uuid>" }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req, 'reports')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be valid JSON', 400)
  }

  const parsed = reportDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const { data, error } = await scoped(auth, 'reports').delete(parsed.data.id)

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Report not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}