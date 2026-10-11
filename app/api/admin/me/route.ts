// app/api/admin/me/route.ts
// Tells the sidebar whether to show the "Admin" link. Returns only true/false.

import { NextResponse } from "next/server"
import { getAdminUser } from "@/lib/server/admin"

export const dynamic = "force-dynamic"

export async function GET() {
  const admin = await getAdminUser().catch(() => null)
  return NextResponse.json({ admin: !!admin }, { headers: { "Cache-Control": "no-store" } })
}