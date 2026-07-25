import type { NextRequest } from "next/server"
import { translations, DEFAULT_LANGUAGE, type Language } from "@/lib/language"

const COOKIE_KEY = "astrocore_language"

/**
 * Reads the user's language preference inside a route handler.
 * useLanguage.ts (client-side) mirrors the language into a
 * `astrocore_language` cookie on every change, specifically so this can
 * work — API routes have no access to localStorage. Falls back to
 * DEFAULT_LANGUAGE if the cookie is missing (e.g. the request came from
 * something other than the browser, like a plugin using a Bearer API
 * key with no cookies attached).
 */
export function getServerLanguage(req: NextRequest): Language {
  const cookie = req.cookies.get(COOKIE_KEY)?.value
  return cookie === "uk" || cookie === "en" ? cookie : DEFAULT_LANGUAGE
}

/** Convenience wrapper — returns the full translation object for the request's language. */
export function getServerT(req: NextRequest) {
  return translations[getServerLanguage(req)]
}