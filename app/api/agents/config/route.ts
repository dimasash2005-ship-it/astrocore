// app/api/agents/config/route.ts
//
// Public settings the AsCore connector needs to reach the job queue:
// the Supabase URL and the PUBLIC anon/publishable key (the same values that
// already ship in the website's JS bundle, so nothing secret here).
// The connector authenticates every call with its own ac_live_ key, which the
// agent_claim / agent_report functions check inside the database.

import { NextResponse } from "next/server"

export const dynamic = "force-dynamic"

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "AsCore is not configured." }, { status: 500 })
  }
  return NextResponse.json(
    { supabaseUrl, supabaseKey },
    { headers: { "Cache-Control": "public, max-age=300" } }
  )
}