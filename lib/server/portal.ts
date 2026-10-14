// lib/server/portal.ts
//
// Client portals (astrocore.one/c/<slug>): password hashing, the "unlocked" cookie,
// and reading a portal with the service role (visitors aren't signed in).
// Only the client's own reports are ever read; nothing else of the owner's account.

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"

export type PortalClient = {
  id: string
  user_id: string
  name: string
  slug: string
  color: string
  logo_url: string | null
  intro: string | null
  password_hash: string | null
  is_active: boolean
  show_powered: boolean
  views: number
}

export type PortalReport = { id: string; company_name: string; summary: string | null; created_at: string }

export function portalService(): SupabaseClient {
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export function newSlug(): string {
  const abc = "abcdefghijkmnpqrstuvwxyz23456789"
  const b = randomBytes(10)
  return Array.from(b, x => abc[x % abc.length]).join("")
}

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex")
  return `scrypt$${salt}$${scryptSync(pw, salt, 32).toString("hex")}`
}

export function checkPassword(pw: string, stored: string | null): boolean {
  if (!stored) return true
  const [kind, salt, hash] = stored.split("$")
  if (kind !== "scrypt" || !salt || !hash) return false
  const got = scryptSync(pw, salt, 32), want = Buffer.from(hash, "hex")
  return got.length === want.length && timingSafeEqual(got, want)
}

function secret(): string {
  return "portal:" + (process.env.SHARE_SECRET || process.env.PROVIDER_ENCRYPTION_KEY || process.env.CRON_SECRET || "")
}

export const portalCookie = (slug: string) => `ac_portal_${slug}`

/** Cookie value that proves the visitor typed the current password (changes when the password changes). */
export function portalToken(slug: string, passwordHash: string): string {
  return createHmac("sha256", secret()).update(`${slug}:${passwordHash}`).digest("base64url")
}

export function isUnlocked(c: PortalClient, cookieValue: string | undefined): boolean {
  if (!c.password_hash) return true
  if (!cookieValue) return false
  const want = Buffer.from(portalToken(c.slug, c.password_hash)), got = Buffer.from(cookieValue)
  return want.length === got.length && timingSafeEqual(want, got)
}

export async function loadPortal(slug: string): Promise<PortalClient | null> {
  if (!/^[a-z0-9]{6,32}$/.test(slug)) return null
  const { data } = await portalService().from("clients")
    .select("id, user_id, name, slug, color, logo_url, intro, password_hash, is_active, show_powered, views")
    .eq("slug", slug).maybeSingle()
  return (data as PortalClient | null) ?? null
}

export async function portalReports(c: PortalClient): Promise<PortalReport[]> {
  const { data } = await portalService().from("reports")
    .select("id, company_name, summary, created_at")
    .eq("client_id", c.id).eq("user_id", c.user_id)
    .order("created_at", { ascending: false }).limit(200)
  return (data as PortalReport[] | null) ?? []
}

/** Plain-text preview of a markdown report. */
export function excerpt(md: string | null, max = 220): string {
  const t = (md ?? "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/^#+\s*/gm, "").replace(/[*_`>|#-]+/g, " ")
    .replace(/\s+/g, " ").trim()
  return t.length > max ? t.slice(0, max).replace(/\s+\S*$/, "") + "…" : t
}

export const COLOR_RE = /^#[0-9a-f]{6}$/i
export function safeLogo(url: unknown): string | null {
  if (typeof url !== "string" || !url.trim()) return null
  // Uploaded logo: a small image squeezed in the browser (see lib/logoColor.ts).
  if (url.startsWith("data:")) {
    return /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(url) && url.length <= 300_000 ? url : null
  }
  try {
    const u = new URL(url.trim())
    return u.protocol === "https:" ? u.toString().slice(0, 500) : null
  } catch { return null }
}
