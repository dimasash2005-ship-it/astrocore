// app/api/reports/share/route.ts
//
// Turns public sharing of one report on/off and changes what the public page shows.
// Only the signed-in owner can do this (cookie session, RLS on `reports`).
//
//   GET  /api/reports/share?reportId=…   -> current share state
//   POST /api/reports/share               -> { reportId, enabled?, showCharts?, showSources?, showAuthor? }

import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

const COLUMNS = "id, share_id, is_public, share_show_charts, share_show_sources, share_show_author, share_views, shared_at"
const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789" // no look-alikes (l/1, o/0)

function newShareId(): string {
  const bytes = randomBytes(10)
  let out = ""
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
  return out
}

function shape(row: Record<string, unknown>, origin: string) {
  return {
    shareId: row.share_id ?? null,
    isPublic: !!row.is_public,
    showCharts: row.share_show_charts !== false,
    showSources: row.share_show_sources !== false,
    showAuthor: !!row.share_show_author,
    views: Number(row.share_views ?? 0),
    url: row.share_id ? `${origin}/r/${row.share_id}` : null,
  }
}

function originOf(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "astrocore.one"
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const reportId = new URL(req.url).searchParams.get("reportId") || ""
  const { data, error } = await supabase.from("reports").select(COLUMNS)
    .eq("id", reportId).eq("user_id", user.id).maybeSingle()
  if (error || !data) return NextResponse.json({ error: "Report not found" }, { status: 404 })
  return NextResponse.json(shape(data, originOf(req)))
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = (await req.json().catch(() => null)) as {
    reportId?: unknown; enabled?: unknown; showCharts?: unknown; showSources?: unknown; showAuthor?: unknown
  } | null
  const reportId = typeof body?.reportId === "string" ? body.reportId : ""
  if (!reportId) return NextResponse.json({ error: "reportId is required" }, { status: 400 })

  const { data: current } = await supabase.from("reports").select(COLUMNS)
    .eq("id", reportId).eq("user_id", user.id).maybeSingle()
  if (!current) return NextResponse.json({ error: "Report not found" }, { status: 404 })

  const update: Record<string, unknown> = {}
  if (typeof body?.enabled === "boolean") {
    update.is_public = body.enabled
    if (body.enabled) {
      if (!current.share_id) update.share_id = newShareId()
      update.shared_at = new Date().toISOString()
    }
  }
  if (typeof body?.showCharts === "boolean")  update.share_show_charts = body.showCharts
  if (typeof body?.showSources === "boolean") update.share_show_sources = body.showSources
  if (typeof body?.showAuthor === "boolean")  update.share_show_author = body.showAuthor
  if (Object.keys(update).length === 0) return NextResponse.json(shape(current, originOf(req)))

  const { data, error } = await supabase.from("reports").update(update)
    .eq("id", reportId).eq("user_id", user.id).select(COLUMNS).single()
  if (error || !data) return NextResponse.json({ error: error?.message || "Update failed" }, { status: 400 })
  return NextResponse.json(shape(data, originOf(req)))
}