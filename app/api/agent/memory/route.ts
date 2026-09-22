import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

// ---------------------------------------------------------------------------
// Same pattern as app/api/agent/reports/route.ts. This route is called by
// the AI agent on behalf of a logged-in AstroCore user. It must NEVER use
// SUPABASE_SERVICE_ROLE_KEY: that key bypasses RLS, which is the only thing
// keeping one user's memory items from another's. Every request is
// authenticated with the caller's own Supabase access token, forwarded as
// `Authorization: Bearer <token>`, and a Supabase client is built with that
// token so Postgres RLS (auth.uid() = user_id) does the actual isolation.
// user_id is therefore never read from the request body — only ever
// derived from the token via auth.uid() inside the database.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

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

async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}

// ---------------------------------------------------------------------------
// Zod schemas — matches the actual `memory_items` table:
//   id uuid, user_id uuid, title text, content text, source text,
//   tags text[], agent_id uuid (nullable), created_at timestamptz,
//   updated_at timestamptz
// user_id is deliberately NOT part of any input schema. id/created_at are
// db-generated; updated_at is set here, server-side, on every PATCH.
// ---------------------------------------------------------------------------
const memoryCreateSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  source: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  agent_id: z.string().uuid().nullable().optional(),
})

const memoryUpdateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(300).optional(),
    content: z.string().min(1).optional(),
    source: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    agent_id: z.string().uuid().nullable().optional(),
  })
  .refine(
    (body) => Object.keys(body).some((k) => k !== 'id'),
    { message: 'At least one field besides id must be provided' }
  )

const memoryDeleteSchema = z.object({
  id: z.string().uuid(),
})

const listQuerySchema = z.object({
  id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

// ---------------------------------------------------------------------------
// GET /api/agent/memory        -> list caller's memory items
// GET /api/agent/memory?id=... -> fetch one of caller's memory items
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

  // No .eq('user_id', ...) on purpose: RLS already restricts every row to
  // auth.uid() = user_id for this token — the database is the boundary,
  // not a filter here.
  let query = supabase
    .from('memory_items')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (id) {
    query = supabase.from('memory_items').select('*').eq('id', id)
  }

  const { data, error } = await query

  if (error) return jsonError(error.message, 400)
  if (id && (!data || data.length === 0)) {
    return jsonError('Memory item not found', 404)
  }

  return NextResponse.json({ data: id ? data[0] : data })
}

// ---------------------------------------------------------------------------
// POST /api/agent/memory -> create a memory item owned by the caller
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

  const parsed = memoryCreateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  // user_id is set here, server-side, from the authenticated user — never
  // from the request body. The schema above doesn't even accept a user_id
  // field, so one can't be smuggled in.
  const { data, error } = await supabase
    .from('memory_items')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return jsonError(error.message, 400)
  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/agent/memory -> update one of the caller's memory items
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

  const parsed = memoryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }
  const { id, ...updates } = parsed.data

  // RLS's USING clause restricts which row this can even target
  // (auth.uid() = user_id). We still scope by id for a precise, single-row
  // update; ownership enforcement is the database's job, not this filter's.
  const { data, error } = await supabase
    .from('memory_items')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    // Either it doesn't exist, or it belongs to someone else and RLS
    // silently excluded it — both look identical from the outside.
    return jsonError('Memory item not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}

// ---------------------------------------------------------------------------
// DELETE /api/agent/memory -> delete one of the caller's memory items
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

  const parsed = memoryDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const { data, error } = await supabase
    .from('memory_items')
    .delete()
    .eq('id', parsed.data.id)
    .select()

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Memory item not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}