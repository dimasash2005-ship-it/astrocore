import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// This route is called by the AI agent on behalf of a logged-in AstroCore
// user. It must NEVER use SUPABASE_SERVICE_ROLE_KEY: that key bypasses RLS,
// which is the only thing keeping one user's reports from another's. Instead
// every request is authenticated with the caller's own Supabase access
// token, forwarded as `Authorization: Bearer <token>`, and a Supabase client
// is built with that token so Postgres RLS (auth.uid() = user_id) does the
// actual isolation. user_id is therefore never read from the request body —
// only ever derived from the token via auth.uid() inside the database.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

/**
 * Builds a Supabase client scoped to the caller's own access token.
 * Returns null if there is no (or a malformed) Authorization header.
 *
 * Using the anon key + the user's bearer token (rather than the service
 * role key) means every query this client runs is subject to RLS as that
 * user — exactly the same as if the user's own browser had made the call.
 */
function getSupabaseForRequest(req: NextRequest): SupabaseClient | null {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const accessToken = authHeader.slice(7).trim()
  if (!accessToken) return null

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

/**
 * Confirms the token is actually valid and returns the authenticated user.
 * A syntactically-present but expired/garbage token must still 401, not
 * fall through to a query that RLS happens to return zero rows for.
 */
async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

// Matches the actual `reports` table:
//   id uuid, user_id uuid, company_name text, summary text,
//   chart_data jsonb, created_at timestamptz
// user_id is deliberately NOT part of any input schema — it must never be
// settable from the request body. id/created_at are server/db-generated.
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
  const supabase = getSupabaseForRequest(req)
  if (!supabase) return jsonError('Missing or invalid Authorization header', 401)

  const user = await requireUser(supabase)
  if (!user) return jsonError('Invalid or expired token', 401)

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

  // No .eq('user_id', ...) here on purpose: RLS already restricts every row
  // to auth.uid() = user_id for this token. Adding a manual filter would be
  // redundant, not a security boundary — the database is the boundary.
  let query = supabase
    .from('reports')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (id) {
    query = supabase.from('reports').select('*').eq('id', id)
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
  const supabase = getSupabaseForRequest(req)
  if (!supabase) return jsonError('Missing or invalid Authorization header', 401)

  const user = await requireUser(supabase)
  if (!user) return jsonError('Invalid or expired token', 401)

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

  // user_id is set here, server-side, from the authenticated user — never
  // from the request body. Even if a client sent a user_id field, the
  // schema above doesn't accept it, so it's silently dropped before this
  // point.
  const { data, error } = await supabase
    .from('reports')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return jsonError(error.message, 400)
  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/agent/reports -> update one of the caller's reports
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const supabase = getSupabaseForRequest(req)
  if (!supabase) return jsonError('Missing or invalid Authorization header', 401)

  const user = await requireUser(supabase)
  if (!user) return jsonError('Invalid or expired token', 401)

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

  // RLS's USING clause restricts which row this can even target
  // (auth.uid() = user_id), and WITH CHECK blocks the update from ever
  // reassigning the row to another user_id. We still scope by id here for
  // a precise, single-row update; ownership enforcement is the database's
  // job, not this filter's.
  const { data, error } = await supabase
    .from('reports')
    .update(updates)
    .eq('id', id)
    .select()

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    // Either the report doesn't exist, or it belongs to someone else and
    // RLS silently excluded it — both look identical from the outside,
    // which is the correct behavior (no existence oracle for other users'
    // data).
    return jsonError('Report not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}

// ---------------------------------------------------------------------------
// DELETE /api/agent/reports -> delete one of the caller's reports
// Body: { "id": "<uuid>" }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const supabase = getSupabaseForRequest(req)
  if (!supabase) return jsonError('Missing or invalid Authorization header', 401)

  const user = await requireUser(supabase)
  if (!user) return jsonError('Invalid or expired token', 401)

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

  const { data, error } = await supabase
    .from('reports')
    .delete()
    .eq('id', parsed.data.id)
    .select()

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Report not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}