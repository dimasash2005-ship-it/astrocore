// app/api/clients/[id]/route.ts
//
// PATCH  → update { name?, color?, logoUrl?, intro?, password? ("" = remove), isActive?, showPowered?, newLink? }
// DELETE → remove the client (its reports stay, they just lose the client tag)

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getServerLanguage } from "@/lib/server-language"
import { hashPassword, newSlug, safeLogo, COLOR_RE } from "@/lib/server/portal"

export const dynamic = "force-dynamic"

async function auth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return { supabase, user }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const uk = getServerLanguage(req) === "uk"
  const b = await req.json().catch(() => null) as Record<string, unknown> | null
  if (!b) return NextResponse.json({ error: "Bad request" }, { status: 400 })

  const upd: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof b.name === "string") {
    const name = b.name.trim().slice(0, 80)
    if (!name) return NextResponse.json({ error: uk ? "Вкажи назву клієнта." : "Enter the client's name." }, { status: 400 })
    upd.name = name
  }
  if (typeof b.color === "string" && COLOR_RE.test(b.color)) upd.color = b.color
  if ("logoUrl" in b) upd.logo_url = safeLogo(b.logoUrl)
  if (typeof b.intro === "string") upd.intro = b.intro.trim().slice(0, 600) || null
  if (typeof b.password === "string") upd.password_hash = b.password.trim() ? hashPassword(b.password.trim().slice(0, 100)) : null
  if (typeof b.isActive === "boolean") upd.is_active = b.isActive
  if (typeof b.showPowered === "boolean") upd.show_powered = b.showPowered
  if (b.newLink === true) upd.slug = newSlug()

  const { data, error } = await supabase.from("clients").update(upd).eq("id", id).eq("user_id", user.id)
    .select("id, name, slug, color, logo_url, intro, password_hash, is_active, show_powered, views, created_at, updated_at").maybeSingle()
  if (error || !data) return NextResponse.json({ error: uk ? "Не вдалося зберегти." : "Couldn't save." }, { status: 400 })
  const { password_hash, ...rest } = data as { password_hash: string | null } & Record<string, unknown>
  return NextResponse.json({ client: { ...rest, hasPassword: !!password_hash } }, { headers: { "Cache-Control": "no-store" } })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user } = await auth()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { error } = await supabase.from("clients").delete().eq("id", id).eq("user_id", user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ ok: true })
}
