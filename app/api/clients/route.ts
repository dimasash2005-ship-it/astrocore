// app/api/clients/route.ts
//
// Client portals of the signed-in user.
// GET  → list with report counts
// POST → create { name, color?, logoUrl?, intro?, password?, showPowered? }

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { newSlug, hashPassword, safeLogo, COLOR_RE } from "@/lib/server/portal"

export const dynamic = "force-dynamic"
const NO_STORE = { headers: { "Cache-Control": "no-store" } }
const COLUMNS = "id, name, slug, color, logo_url, intro, password_hash, is_active, show_powered, views, created_at, updated_at"

type Row = { id: string; password_hash: string | null; [k: string]: unknown }
type ClientDTO = Omit<Row, "password_hash"> & { hasPassword: boolean; reports: number; lastReportAt: string | null }

function toDTO(r: Row, counts: Map<string, { n: number; last: string | null }>): ClientDTO {
  const { password_hash, ...rest } = r
  const c = counts.get(r.id)
  return { ...rest, id: r.id, hasPassword: !!password_hash, reports: c?.n ?? 0, lastReportAt: c?.last ?? null }
}

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function GET() {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { data, error } = await supabase.from("clients").select(COLUMNS).eq("user_id", user.id).order("created_at", { ascending: false })
  if (error) return NextResponse.json({ clients: [], setupError: true }, NO_STORE)
  const { data: reps } = await supabase.from("reports").select("client_id, created_at").eq("user_id", user.id).not("client_id", "is", null).limit(5000)
  const counts = new Map<string, { n: number; last: string | null }>()
  for (const r of reps ?? []) {
    const c = counts.get(r.client_id) ?? { n: 0, last: null }
    c.n++
    if (!c.last || r.created_at > c.last) c.last = r.created_at
    counts.set(r.client_id, c)
  }
  return NextResponse.json({ clients: (data as Row[]).map(r => toDTO(r, counts)) }, NO_STORE)
}

export async function POST(req: NextRequest) {
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uk = getServerLanguage(req) === "uk"
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  const name = typeof b?.name === "string" ? b.name.trim().slice(0, 80) : ""
  if (!name) return NextResponse.json({ error: uk ? "Вкажи назву клієнта." : "Enter the client's name." }, { status: 400 })

  const { count } = await supabase.from("clients").select("id", { count: "exact", head: true }).eq("user_id", user.id)
  if ((count ?? 0) >= 100) return NextResponse.json({ error: uk ? "Максимум 100 клієнтів." : "100 clients max." }, { status: 400 })

  const password = typeof b?.password === "string" ? b.password.trim() : ""
  const row = {
    user_id: user.id,
    name,
    slug: newSlug(),
    color: typeof b?.color === "string" && COLOR_RE.test(b.color) ? b.color : "#E8002A",
    logo_url: safeLogo(b?.logoUrl),
    intro: typeof b?.intro === "string" ? b.intro.trim().slice(0, 600) || null : null,
    password_hash: password ? hashPassword(password.slice(0, 100)) : null,
    show_powered: b?.showPowered !== false,
  }
  const { data, error } = await supabase.from("clients").insert(row).select(COLUMNS).single()
  if (error) {
    console.error("[clients create]", error.message)
    return NextResponse.json({ error: uk ? "Не вдалося створити. Перевір, що SQL для клієнтів виконано в Supabase." : "Couldn't create the client." }, { status: 400 })
  }
  return NextResponse.json({ client: toDTO(data as Row, new Map()) }, NO_STORE)
}
