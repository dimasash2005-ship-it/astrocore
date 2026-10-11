// app/api/admin/overview/route.ts
//
// All numbers for the admin panel in one request. Admin only (ADMIN_EMAILS).
// GET /api/admin/overview?range=24h|7d|30d|all
//
// Reads with the service role (bypasses RLS), so it can see every user's counts.
// It never returns chat texts or API keys: only counts, dates, provider types
// and the short system error messages shown when an agent failed to reply.

import { NextRequest, NextResponse } from "next/server"
import { getAdminUser, adminEmails, adminServiceClient } from "@/lib/server/admin"
import { classifyProviderError } from "@/lib/server/provider-errors"

export const dynamic = "force-dynamic"

const RANGES: Record<string, number | null> = { "24h": 1, "7d": 7, "30d": 30, all: null }
const DAY = 86_400_000

// Messages AstroCore writes into the chat when a reply fails (old raw format and new friendly one).
const ERROR_FILTER =
  "status.eq.error,content.ilike.*provider error*,content.ilike.Помилка*,content.ilike.*Технічні деталі*,content.ilike.*Technical details*,content.ilike.*returned no*"

const isTestEmail = (e: string) => /@pentest-mail\.com$|@example\.com$/i.test(e)

type Status = "active" | "returning" | "sleeping" | "no_provider" | "no_message" | "stuck_error" | "test" | "admin"

export async function GET(req: NextRequest) {
  const admin = await getAdminUser().catch(() => null)
  if (!admin) return NextResponse.json({ error: "forbidden" }, { status: 403 })

  try {
    const range = req.nextUrl.searchParams.get("range") ?? "7d"
    const days = range in RANGES ? RANGES[range] : 7
    const since = days ? Date.now() - days * DAY : 0
    const sb = adminServiceClient()
    const admins = new Set(adminEmails())

    // ── Users ──
    const { data: usersPage, error: usersErr } = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 })
    if (usersErr) throw new Error(usersErr.message)
    const users = usersPage.users

    // ── Activity data (only ids, dates and types) ──
    const [prov, msgs, errIds, reps, miss, fb, recentErr] = await Promise.all([
      sb.from("providers").select("user_id, slug, is_active").limit(5000),
      sb.from("chat_messages").select("user_id, role, created_at").limit(50000),
      sb.from("chat_messages").select("id, user_id").eq("role", "assistant").or(ERROR_FILTER).limit(5000),
      sb.from("reports").select("user_id, is_public, created_at").limit(20000),
      sb.from("missions").select("user_id").limit(5000),
      sb.from("feedback").select("kind, message, page, email, created_at, status").order("created_at", { ascending: false }).limit(12),
      sb.from("chat_messages").select("user_id, content, created_at").eq("role", "assistant").or(ERROR_FILTER)
        .order("created_at", { ascending: false }).limit(12),
    ])

    type Agg = { providers: Set<string>; userMsgs: number; replies: number; errors: number; lastMsg: number; days: Set<string>; reports: number; missions: number }
    const agg = new Map<string, Agg>()
    const A = (id: string) => {
      let a = agg.get(id)
      if (!a) { a = { providers: new Set(), userMsgs: 0, replies: 0, errors: 0, lastMsg: 0, days: new Set(), reports: 0, missions: 0 }; agg.set(id, a) }
      return a
    }

    for (const p of prov.data ?? []) if (p.slug !== "leonardo") A(p.user_id).providers.add(p.slug as string)
    for (const m of msgs.data ?? []) {
      const a = A(m.user_id), t = Date.parse(m.created_at as string)
      if (m.role === "user") { a.userMsgs++; a.days.add((m.created_at as string).slice(0, 10)); if (t > a.lastMsg) a.lastMsg = t }
      else a.replies++
    }
    for (const e of errIds.data ?? []) A(e.user_id).errors++
    let publicReports = 0, reportsTotal = 0
    for (const r of reps.data ?? []) { A(r.user_id).reports++; reportsTotal++; if (r.is_public) publicReports++ }
    for (const m of miss.data ?? []) A(m.user_id).missions++

    const emailById = new Map(users.map(u => [u.id, u.email ?? ""]))

    // ── Per-user rows ──
    const rows = users.map(u => {
      const a = A(u.id)
      const email = u.email ?? ""
      const okReplies = Math.max(0, a.replies - a.errors)
      const lastSignIn = u.last_sign_in_at ? Date.parse(u.last_sign_in_at) : 0
      const last = Math.max(a.lastMsg, lastSignIn)
      let status: Status
      if (admins.has(email.toLowerCase())) status = "admin"
      else if (isTestEmail(email)) status = "test"
      else if (a.providers.size === 0) status = "no_provider"
      else if (a.userMsgs === 0) status = "no_message"
      else if (okReplies === 0) status = "stuck_error"
      else if (a.days.size >= 2 && Date.now() - last < 7 * DAY) status = "returning"
      else if (Date.now() - last < 7 * DAY) status = "active"
      else status = "sleeping"
      return {
        id: u.id,
        email,
        name: (u.user_metadata?.full_name as string | undefined) || (u.user_metadata?.name as string | undefined) || email.split("@")[0],
        avatar: (u.user_metadata?.avatar_url as string | undefined) ?? null,
        ref: (u.user_metadata?.ref as string | undefined) ?? null,
        createdAt: u.created_at,
        lastActivity: last ? new Date(last).toISOString() : null,
        providers: [...a.providers],
        messages: a.userMsgs,
        okReplies,
        errors: a.errors,
        reports: a.reports,
        missions: a.missions,
        activeDays: a.days.size,
        status,
      }
    }).sort((x, y) => Date.parse(y.lastActivity ?? y.createdAt) - Date.parse(x.lastActivity ?? x.createdAt))

    // Real users only (no admin, no test accounts) for the numbers.
    const real = rows.filter(r => r.status !== "admin" && r.status !== "test")
    const cohort = real.filter(r => !since || Date.parse(r.createdAt) >= since)

    const kpis = {
      users: real.length,
      newUsers: real.filter(r => since && Date.parse(r.createdAt) >= since).length,
      connected: real.filter(r => r.providers.length > 0).length,
      gotReply: real.filter(r => r.okReplies > 0).length,
      active: real.filter(r => r.lastActivity && (!since || Date.parse(r.lastActivity) >= since)).length,
      reports: reportsTotal,
      publicReports,
      missions: (miss.data ?? []).length,
    }

    const funnel = [
      { key: "registered", value: cohort.length },
      { key: "provider",   value: cohort.filter(r => r.providers.length > 0).length },
      { key: "wrote",      value: cohort.filter(r => r.messages > 0).length },
      { key: "reply",      value: cohort.filter(r => r.okReplies > 0).length },
      { key: "report",     value: cohort.filter(r => r.reports > 0).length },
      { key: "returned",   value: cohort.filter(r => r.activeDays >= 2).length },
    ]

    const stuck = real
      .filter(r => r.status === "no_provider" || r.status === "no_message" || r.status === "stuck_error")
      .slice(0, 12)

    const errors = (recentErr.data ?? []).map(e => {
      const text = String(e.content ?? "")
      const firstLine = text.replace(/[*_`⚠️]/g, "").split("\n").map(s => s.trim()).filter(Boolean)[0] ?? ""
      return {
        email: emailById.get(e.user_id) ?? "",
        createdAt: e.created_at,
        kind: classifyProviderError(text),
        text: firstLine.slice(0, 160),
      }
    })

    return NextResponse.json(
      { range, kpis, funnel, stuck, users: rows, feedback: fb.data ?? [], errors, feedbackMissing: !!fb.error },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[admin/overview]", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}