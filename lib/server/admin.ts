// lib/server/admin.ts
//
// Who is the AstroCore admin. Only accounts whose email is listed in the
// ADMIN_EMAILS environment variable (comma-separated) and is confirmed.
// If ADMIN_EMAILS is not set, nobody is admin (safe default).
// Server-only: the list never reaches the browser.

import { createClient } from "@/lib/supabase/server"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"

export function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean)
}

/** The signed-in user if they are an admin, otherwise null. */
export async function getAdminUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user?.email || !user.email_confirmed_at) return null
  return adminEmails().includes(user.email.toLowerCase()) ? user : null
}

/** Supabase client that bypasses RLS. Use ONLY after getAdminUser() passed. */
export function adminServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role is not configured.")
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}