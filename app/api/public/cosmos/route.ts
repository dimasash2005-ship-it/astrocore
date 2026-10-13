// app/api/public/cosmos/route.ts
//
// Public numbers for the landing "galaxy": how many agents exist and how many are
// online right now, plus their colours for the stars. Only aggregates — no names,
// no users, nothing personal. Cached for a minute on Vercel's edge.

import { NextResponse } from "next/server"
import { adminServiceClient } from "@/lib/server/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const sb = adminServiceClient()
    const since = new Date(Date.now() - 120_000).toISOString()
    const [{ count: agents }, { count: online }, { data: colors }] = await Promise.all([
      sb.from("agents").select("id", { count: "exact", head: true }),
      sb.from("providers").select("id", { count: "exact", head: true }).gte("last_seen_at", since),
      sb.from("agents").select("avatar_color").order("created_at", { ascending: false }).limit(240),
    ])
    const list = (colors ?? [])
      .map(r => (typeof r.avatar_color === "string" && /^#[0-9a-f]{6}$/i.test(r.avatar_color) ? r.avatar_color : "#E8002A"))
    return NextResponse.json(
      { agents: agents ?? 0, online: online ?? 0, colors: list },
      { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
    )
  } catch (err) {
    console.error("[cosmos]", err instanceof Error ? err.message : err)
    return NextResponse.json({ agents: 0, online: 0, colors: [] }, { headers: { "Cache-Control": "no-store" } })
  }
}
