import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, scoped } from '../_lib/auth'

// ---------------------------------------------------------------------------
// Same pattern as app/api/agent/reports/route.ts. Every query goes through
// scoped(auth, 'memory_items') — see ../_lib/auth for why. Required scope
// for an API key: "memory".
// ---------------------------------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
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
  const auth = await authenticate(req, 'memory')
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

  const table = scoped(auth, 'memory_items')

  let query = table.select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (id) {
    query = table.select('*').eq('id', id)
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
  const auth = await authenticate(req, 'memory')
  if (!auth.ok) return jsonError(auth.message, auth.status)

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

  const { data, error } = await scoped(auth, 'memory_items').insert(parsed.data).single()

  if (error) return jsonError(error.message, 400)
  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/agent/memory -> update one of the caller's memory items
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req, 'memory')
  if (!auth.ok) return jsonError(auth.message, auth.status)

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

  const { data, error } = await scoped(auth, 'memory_items').update(
    { ...updates, updated_at: new Date().toISOString() },
    id
  )

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Memory item not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}

// ---------------------------------------------------------------------------
// DELETE /api/agent/memory -> delete one of the caller's memory items
// Body: { "id": "<uuid>" }
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req, 'memory')
  if (!auth.ok) return jsonError(auth.message, auth.status)

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

  const { data, error } = await scoped(auth, 'memory_items').delete(parsed.data.id)

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Memory item not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}