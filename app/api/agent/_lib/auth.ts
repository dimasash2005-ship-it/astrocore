import { NextRequest } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// Shared auth helper for every /api/agent/* route (reports, memory,
// gallery, ...). NEVER build a client here with SUPABASE_SERVICE_ROLE_KEY:
// that key bypasses RLS, which is the only thing keeping one user's rows
// from another's. Every client this file returns is scoped to the caller's
// own identity, so RLS (auth.uid() = user_id) does the actual isolation —
// user_id is never read from a request body, only ever derived from
// whichever of the two auth paths below actually authenticated the caller.
//
// Two supported callers:
//
// 1. External agent (e.g. a process on a VPS, no browser, no cookies):
//    sends `Authorization: Bearer <supabase access_token>`. We build a
//    plain supabase-js client with that token forwarded on every request.
//
// 2. AstroCore's own frontend calling same-origin with `credentials:
//    'include'` (no manual token wrangling): no Authorization header, but
//    the browser's Supabase cookies ride along. We build an @supabase/ssr
//    server client that reads/refreshes the session from those cookies.
//
// Bearer is checked first and wins if present, so an external agent can
// always override with an explicit token even when called from a context
// that also happens to carry cookies.
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function getBearerClient(req: NextRequest): SupabaseClient | null {
  const authHeader = req.headers.get('authorization') ?? req.headers.get('Authorization')
  if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
    return null
  }
  const accessToken = authHeader.slice(7).trim()
  if (!accessToken) return null

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

async function getCookieClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        // Route Handlers (unlike Server Components) can set cookies, which
        // lets @supabase/ssr silently refresh an expiring session. If this
        // throws in some runtime, it's non-fatal — the request still gets
        // authenticated with the cookies it already had.
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // no-op
        }
      },
    },
  })
}

/**
 * Resolves a Supabase client scoped to the caller's identity, trying
 * Authorization: Bearer first, then falling back to the browser's cookie
 * session. Returns null only when NEITHER path is even present — a
 * present-but-invalid token/session is a 401 decided by requireUser(),
 * not here.
 */
export async function getSupabaseForRequest(req: NextRequest): Promise<SupabaseClient | null> {
  const bearerClient = getBearerClient(req)
  if (bearerClient) return bearerClient

  // No Authorization header at all — try the cookie session. If there's no
  // Supabase cookie either, auth.getUser() below will simply fail and the
  // route returns 401, so it's safe to always return a client here.
  return getCookieClient()
}

/**
 * Confirms the resolved client actually has a valid, current user and
 * returns it. A syntactically-present but expired/garbage token or an
 * absent cookie session must both 401 here, not fall through to a query
 * that RLS happens to return zero rows for.
 */
export async function requireUser(supabase: SupabaseClient) {
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user
}