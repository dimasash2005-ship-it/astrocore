// app/api/push/subscribe/route.ts
//
// Turns notifications on / off for the current device.
// POST   { subscription: { endpoint, keys: { p256dh, auth } } }  → save (or move to this user)
// DELETE { endpoint }                                            → forget this device

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { pushService, pushConfigured } from "@/lib/server/push"

export const dynamic = "force-dynamic"

async function me() {
  const sb = await createClient()
  const { data: { user } } = await sb.auth.getUser()
  return user
}

export async function POST(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!pushConfigured()) return NextResponse.json({ error: "push_not_configured" }, { status: 503 })
  const body = await req.json().catch(() => ({})) as { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } }
  const s = body.subscription
  const endpoint = String(s?.endpoint ?? "")
  const p256dh = String(s?.keys?.p256dh ?? ""), auth = String(s?.keys?.auth ?? "")
  let ok = false
  try { ok = new URL(endpoint).protocol === "https:" } catch {}
  if (!ok || endpoint.length > 1000 || !/^[\w-]{80,100}$/.test(p256dh) || !/^[\w-]{16,30}$/.test(auth)) {
    return NextResponse.json({ error: "bad_subscription" }, { status: 400 })
  }
  const { error } = await pushService().from("push_subscriptions").upsert(
    { user_id: user.id, endpoint, p256dh, auth, user_agent: (req.headers.get("user-agent") ?? "").slice(0, 200) },
    { onConflict: "endpoint" },
  )
  if (error) return NextResponse.json({ error: "setup" }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const { endpoint } = await req.json().catch(() => ({})) as { endpoint?: string }
  if (endpoint) await pushService().from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id)
  return NextResponse.json({ ok: true })
}
