// app/api/c/[slug]/unlock/route.ts
//
// Password for a client portal. On success sets an httpOnly cookie for /c/<slug>.
// A small delay on every attempt makes guessing slow.

import { NextRequest, NextResponse } from "next/server"
import { loadPortal, checkPassword, portalCookie, portalToken } from "@/lib/server/portal"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const b = await req.json().catch(() => null) as { password?: unknown } | null
  const pw = typeof b?.password === "string" ? b.password.trim().slice(0, 100) : ""
  await new Promise(r => setTimeout(r, 600))

  const c = await loadPortal(slug)
  if (!c || !c.is_active || !c.password_hash) return NextResponse.json({ ok: false }, { status: 404 })
  if (!pw || !checkPassword(pw, c.password_hash)) return NextResponse.json({ ok: false }, { status: 401 })

  const res = NextResponse.json({ ok: true })
  res.cookies.set(portalCookie(c.slug), portalToken(c.slug, c.password_hash), {
    httpOnly: true, sameSite: "lax", secure: req.nextUrl.protocol === "https:", path: `/c/${c.slug}`, maxAge: 60 * 60 * 24 * 30,
  })
  return res
}
