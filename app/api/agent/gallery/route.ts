import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticate, scoped } from '../_lib/auth'

// ---------------------------------------------------------------------------
// Same pattern as app/api/agent/reports/route.ts. Every query goes through
// scoped(auth, 'gallery_items') — see ../_lib/auth for why. Required scope
// for an API key: "gallery".
// ---------------------------------------------------------------------------

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status })
}

// ---------------------------------------------------------------------------
// Zod schemas — matches the actual `gallery_items` table:
//   id uuid, user_id uuid, title text, content text, type text,
//   tags text[], created_at timestamptz, provider_id uuid (nullable),
//   generation_id text (nullable), media_type text, status text,
//   prompt text (nullable), media_url text (nullable),
//   error_message text (nullable)
// user_id is deliberately NOT part of any input schema. id/created_at are
// db-generated.
//
// NOTE: `status` is left as free text (real allowed values unknown). Tell
// me the real set and I'll switch it to z.enum([...]).
// ---------------------------------------------------------------------------
const galleryCreateSchema = z.object({
  title: z.string().min(1).max(300),
  content: z.string().min(1),
  type: z.string().min(1),
  tags: z.array(z.string()).optional().default([]),
  media_type: z.string().min(1),
  status: z.string().min(1),
  prompt: z.string().nullable().optional(),
  media_url: z.string().url().nullable().optional(),
  error_message: z.string().nullable().optional(),
  provider_id: z.string().uuid().nullable().optional(),
  generation_id: z.string().nullable().optional(),
})

const galleryUpdateSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string().min(1).max(300).optional(),
    content: z.string().min(1).optional(),
    type: z.string().min(1).optional(),
    tags: z.array(z.string()).optional(),
    media_type: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    prompt: z.string().nullable().optional(),
    media_url: z.string().url().nullable().optional(),
    error_message: z.string().nullable().optional(),
    provider_id: z.string().uuid().nullable().optional(),
    generation_id: z.string().nullable().optional(),
  })
  .refine(
    (body) => Object.keys(body).some((k) => k !== 'id'),
    { message: 'At least one field besides id must be provided' }
  )

const galleryDeleteSchema = z.object({
  id: z.string().uuid(),
})

const listQuerySchema = z.object({
  id: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
})

// ---------------------------------------------------------------------------
// GET /api/agent/gallery        -> list caller's gallery items
// GET /api/agent/gallery?id=... -> fetch one of caller's gallery items
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  const auth = await authenticate(req, 'gallery')
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

  const table = scoped(auth, 'gallery_items')

  let query = table.select('*').order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  if (id) {
    query = table.select('*').eq('id', id)
  }

  const { data, error } = await query

  if (error) return jsonError(error.message, 400)
  if (id && (!data || data.length === 0)) {
    return jsonError('Gallery item not found', 404)
  }

  return NextResponse.json({ data: id ? data[0] : data })
}

// ---------------------------------------------------------------------------
// POST /api/agent/gallery -> create a gallery item owned by the caller
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  const auth = await authenticate(req, 'gallery')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be valid JSON', 400)
  }

  const parsed = galleryCreateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const { data, error } = await scoped(auth, 'gallery_items').insert(parsed.data).single()

  if (error) return jsonError(error.message, 400)
  return NextResponse.json({ data }, { status: 201 })
}

// ---------------------------------------------------------------------------
// PATCH /api/agent/gallery -> update one of the caller's gallery items
// ---------------------------------------------------------------------------
export async function PATCH(req: NextRequest) {
  const auth = await authenticate(req, 'gallery')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be valid JSON', 400)
  }

  const parsed = galleryUpdateSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }
  const { id, ...updates } = parsed.data

  const { data, error } = await scoped(auth, 'gallery_items').update(updates, id)

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Gallery item not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}

// ---------------------------------------------------------------------------
// DELETE /api/agent/gallery -> delete one of the caller's gallery items
// Body: { "id": "<uuid>" }
//
// NOTE: this only deletes the DB row. If media_url points at a Supabase
// Storage object, that file is NOT removed by this route.
// ---------------------------------------------------------------------------
export async function DELETE(req: NextRequest) {
  const auth = await authenticate(req, 'gallery')
  if (!auth.ok) return jsonError(auth.message, auth.status)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return jsonError('Request body must be valid JSON', 400)
  }

  const parsed = galleryDeleteSchema.safeParse(body)
  if (!parsed.success) {
    return jsonError(parsed.error.issues.map((i) => i.message).join('; '), 400)
  }

  const { data, error } = await scoped(auth, 'gallery_items').delete(parsed.data.id)

  if (error) return jsonError(error.message, 400)
  if (!data || data.length === 0) {
    return jsonError('Gallery item not found', 404)
  }

  return NextResponse.json({ data: data[0] })
}