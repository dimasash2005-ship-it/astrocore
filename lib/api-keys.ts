import { randomBytes, createHash } from "crypto"
import { createClient as createServiceRoleClient } from "@supabase/supabase-js"
import { createClient as createServerClient } from "@/lib/supabase/server"

// ─────────────────────────────────────────────────────────────
// This file is server-only. It must never be imported from a
// client component ("use client"), since verifyApiKey() uses the
// Supabase service_role key to look up keys across all users
// (bypassing RLS by design — that's the only place allowed to do so).
// ─────────────────────────────────────────────────────────────

export const API_KEY_PREFIX = "ac_live_"

export const DEFAULT_PERMISSIONS = [
  "chat",
  "vault",
  "memory",
  "agents",
  "integrations",
] as const

export interface ApiKeyRecord {
  id: string
  user_id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface CreatedApiKey {
  id: string
  name: string
  key: string // full raw key — only ever returned once, at creation
  key_prefix: string
  permissions: string[]
  created_at: string
}

export interface VerifiedApiKey {
  id: string
  userId: string
  permissions: string[]
}

// Lazily-created service_role client. Never import/export this for
// use outside this file — it bypasses Row Level Security entirely.
function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase service_role credentials are not configured on the server.")
  }

  return createServiceRoleClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * Generates a new random API key, e.g. "ac_live_9f2c...".
 * The raw key is never stored — only its SHA-256 hash is persisted.
 */
export function generateApiKey(): string {
  const secret = randomBytes(32).toString("hex")
  return `${API_KEY_PREFIX}${secret}`
}

/**
 * Hashes a raw API key with SHA-256. This is what gets stored/compared
 * in the database — the raw key itself is never persisted.
 */
export function hashApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex")
}

/**
 * Derives the short, non-secret prefix stored alongside the hash so the
 * UI can show something like "ac_live_9f2c1a3b••••••" without ever
 * persisting or re-displaying the full key.
 */
function derivePrefix(rawKey: string): string {
  return rawKey.slice(0, API_KEY_PREFIX.length + 8)
}

/**
 * Creates a new API key for a user. Must be called from a context with
 * an authenticated session (e.g. an API route) — it uses the session
 * bound Supabase client, so Row Level Security naturally enforces that
 * the key is created for the calling user.
 *
 * Returns the full raw key — this is the ONLY time it is ever available.
 */
export async function createApiKey(
  userId: string,
  name: string,
  permissions: string[] = [...DEFAULT_PERMISSIONS]
): Promise<CreatedApiKey> {
  if (!userId) throw new Error("createApiKey: userId is required.")
  if (!name || !name.trim()) throw new Error("createApiKey: name is required.")

  const rawKey = generateApiKey()
  const key_hash = hashApiKey(rawKey)
  const key_prefix = derivePrefix(rawKey)

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      user_id: userId,
      name: name.trim(),
      key_hash,
      key_prefix,
      permissions,
    })
    .select("id, name, key_prefix, permissions, created_at")
    .single()

  if (error || !data) {
    throw new Error(`createApiKey: failed to create key (${error?.message ?? "unknown error"})`)
  }

  return {
    id: data.id,
    name: data.name,
    key: rawKey,
    key_prefix: data.key_prefix,
    permissions: data.permissions,
    created_at: data.created_at,
  }
}

/**
 * Verifies a raw API key (e.g. from an Authorization: Bearer header).
 * Uses the service_role client since the caller has no Supabase session
 * (external integrations like Obsidian). Returns null if the key is
 * missing, malformed, unknown, or revoked.
 *
 * On success, updates last_used_at (best-effort, does not block or throw
 * on failure) and returns the owning userId + permissions.
 */
export async function verifyApiKey(rawKey: string | null | undefined): Promise<VerifiedApiKey | null> {
  if (!rawKey || !rawKey.startsWith(API_KEY_PREFIX)) return null

  const key_hash = hashApiKey(rawKey)
  const supabase = getServiceRoleClient()

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, permissions, revoked_at")
    .eq("key_hash", key_hash)
    .is("revoked_at", null)
    .single()

  if (error || !data) return null

  // Best-effort last_used_at update — never let this block verification.
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id)
    .then(undefined, () => {})

  return {
    id: data.id,
    userId: data.user_id,
    permissions: Array.isArray(data.permissions) ? data.permissions : [],
  }
}

/**
 * Revokes a key. Must be called from a context with an authenticated
 * session. Scoped to userId both explicitly and via RLS, so a user can
 * never revoke another user's key.
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<boolean> {
  if (!userId) throw new Error("revokeApiKey: userId is required.")
  if (!keyId) throw new Error("revokeApiKey: keyId is required.")

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("api_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", keyId)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .select("id")
    .single()

  if (error || !data) return false
  return true
}

/**
 * Lists all API keys belonging to a user. Never returns key_hash.
 * Relies on the session-bound client + RLS to scope to the caller.
 */
export async function listApiKeys(userId: string): Promise<ApiKeyRecord[]> {
  if (!userId) throw new Error("listApiKeys: userId is required.")

  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from("api_keys")
    .select("id, user_id, name, key_prefix, permissions, last_used_at, revoked_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    throw new Error(`listApiKeys: failed to load keys (${error.message})`)
  }

  return data ?? []
}