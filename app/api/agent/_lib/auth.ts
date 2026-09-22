import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { verifyApiKey } from '@/lib/api-keys'

// =============================================================================
// Shared auth for every /api/agent/* route (reports, memory, gallery, ...).
//
// Three supported callers, tried in this order:
//
// 1. X-Api-Key: <ac_live_...>
//    A long-lived key from the `api_keys` table (e.g. an external agent on
//    a VPS, no browser, no Supabase session ever). Verified via
//    verifyApiKey() in lib/api-keys.ts, which hashes the raw key and looks
//    it up by key_hash. That key has NO Supabase JWT, so RLS's auth.uid()
//    is NULL for it. We deliberately do NOT try to fake a session for it
//    (see note below on why not) — instead every query for this caller
//    MUST go through scoped() at the bottom of this file, which is the
//    single mandatory .eq('user_id', ...) choke point. This is the ONE
//    place in the whole /api/agent/* surface where a service-role client
//    is used, and it is used ONLY inside scoped()'s query builders.
//
// 2. Authorization: Bearer <supabase access_token>
//    A real Supabase session token (e.g. copied from a logged-in
//    session). RLS (auth.uid() = user_id) does the isolation natively —
//    no service role involved.
//
// 3. Cookie session (AstroCore's own frontend, same-origin, credentials:
//    'include', no manual token handling). Also plain RLS, via
//    @supabase/ssr reading/refreshing the session from cookies.
//
// Why not mint a short-lived Supabase JWT for path 1 instead? That would
// let RLS handle isolation uniformly for all three paths. It needs the
// project's JWT signing secret. This project's CURRENT signing key is
// asymmetric (ECC P-256) — Supabase does not expose that private key to
// project owners, so we cannot sign with it. The only signable secret
// still available is the LEGACY HS256 secret, and Supabase's own
// dashboard flags it for revocation once real tokens signed with it have
// expired — i.e. it is explicitly temporary. Building the security model
// on a secret that's scheduled for removal is fragile: revoking it later
// (as Supabase's UI recommends) would silently break every self-minted
// token with no warning. So: no JWT minting. Service-role + mandatory
// user_id filtering, confined to one audited function, is the honest
// choice here — not a shortcut.
// =============================================================================

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

export type AuthOk = {
  ok: true
  supabase: SupabaseClient
  userId: string
  /** null for session-based callers (paths 2/3) — they aren't scoped. */
  permissions: string[] | null
  /** true only for path 1 (X-Api-Key). Routes use this only for logging/
   *  diagnostics — it must never change which filters get applied, since
   *  scoped() always filters regardless of this flag. */
  viaApiKey: boolean
}

export type AuthResult = AuthOk | { ok: false; status: number; message: string }

let _serviceRoleClient: SupabaseClient | null = null

/**
 * Lazily-created service_role client, used ONLY inside this file, and
 * ONLY ever queried through scoped() below. Never export this client
 * itself, and never call .from(...) on it directly anywhere else in the
 * /api/agent/* surface — that would skip the mandatory user_id filter
 * that is the actual security boundary once this client is in play.
 */
function getServiceRoleClient(): SupabaseClient {
  if (_serviceRoleClient) return _serviceRoleClient
  if (!SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured on the server.')
  }
  _serviceRoleClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _serviceRoleClient
}

async function getCookieClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // Non-fatal — request still gets authenticated with the
          // cookies it already had.
        }
      },
    },
  })
}

/**
 * Resolves who is calling and how, trying X-Api-Key, then Authorization:
 * Bearer, then the cookie session. requiredScope is checked ONLY for the
 * X-Api-Key path (session-based callers act as the full logged-in user,
 * same as using the AstroCore UI directly).
 */
export async function authenticate(req: NextRequest, requiredScope: string): Promise<AuthResult> {
  // 1. X-Api-Key — long-lived key, no Supabase session.
  const apiKey = req.headers.get('x-api-key')
  if (apiKey) {
    const verified = await verifyApiKey(apiKey)
    if (!verified) {
      return { ok: false, status: 401, message: 'Invalid or revoked API key' }
    }
    if (!verified.permissions.includes(requiredScope)) {
      return {
        ok: false,
        status: 403,
        message: `API key is missing the "${requiredScope}" scope`,
      }
    }
    return {
      ok: true,
      supabase: getServiceRoleClient(),
      userId: verified.userId,
      permissions: verified.permissions,
      viaApiKey: true,
    }
  }

  // 2. Authorization: Bearer <supabase access_token>
  const authHeader = req.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await supabase.auth.getUser()
      if (error || !data.user) {
        return { ok: false, status: 401, message: 'Invalid or expired token' }
      }
      return { ok: true, supabase, userId: data.user.id, permissions: null, viaApiKey: false }
    }
  }

  // 3. Cookie session (AstroCore's own frontend).
  const supabase = await getCookieClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) {
    return { ok: false, status: 401, message: 'Missing or invalid credentials' }
  }
  return { ok: true, supabase, userId: data.user.id, permissions: null, viaApiKey: false }
}

// =============================================================================
// SECURITY-CRITICAL CHOKE POINT
//
// This is the ONLY sanctioned way any /api/agent/* route reads or writes
// reports / memory_items / gallery_items. It is used for EVERY auth path
// (api-key, bearer, cookie) uniformly — not just the api-key one — so
// there is exactly one place to audit instead of filters scattered across
// three route files, one of which could be missed.
//
// For the bearer/cookie paths, RLS (auth.uid() = user_id) is ALSO
// enforcing this at the database level, so the explicit filter here is
// redundant-but-harmless defense in depth.
//
// For the api-key path, RLS is NOT enforcing anything — the client is
// service-role and bypasses it entirely. The .eq('user_id', userId) calls
// below are therefore not a convenience: they are THE security boundary.
// If you add a new query path for /api/agent/* that does not go through
// this function, you have almost certainly introduced a cross-user data
// leak for API-key callers. Do not do that — extend this function
// instead.
// =============================================================================
export function scoped(auth: AuthOk, table: string) {
  const { supabase, userId } = auth
  return {
    select: (columns: string) => supabase.from(table).select(columns).eq('user_id', userId),
    insert: (row: Record<string, unknown>) =>
      supabase
        .from(table)
        .insert({ ...row, user_id: userId })
        .select(),
    update: (row: Record<string, unknown>, id: string) =>
      supabase.from(table).update(row).eq('id', id).eq('user_id', userId).select(),
    delete: (id: string) => supabase.from(table).delete().eq('id', id).eq('user_id', userId).select(),
  }
}