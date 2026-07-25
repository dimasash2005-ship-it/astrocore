"use client"

import { useCallback, useEffect, useState } from "react"
import { translations, DEFAULT_LANGUAGE, type Language } from "@/lib/language"

const STORAGE_KEY = "astrocore_language"
const COOKIE_KEY = "astrocore_language"
const EVENT_NAME = "astrocore:language-change"

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "uk" || stored === "en" ? stored : DEFAULT_LANGUAGE
}

function writeCookie(lang: Language) {
  // Mirrors the language into a cookie (in addition to localStorage) so
  // server-side API routes — which can't read localStorage — can still
  // localize error messages via lib/server-language.ts. 1 year expiry,
  // readable on every path.
  document.cookie = `${COOKIE_KEY}=${lang}; path=/; max-age=31536000; SameSite=Lax`
}

/**
 * Reads/writes the interface language. No Context/Provider required —
 * every component using this hook independently reads localStorage on
 * mount and re-syncs whenever any component calls setLanguage(), via a
 * plain window event. Simple, no extra libraries, easy to scale: adding
 * a language is just adding it to lib/language.ts.
 */
export function useLanguage() {
  // Start with the default on both server and first client render to
  // avoid a hydration mismatch, then sync to the real stored value
  // right after mount.
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE)

  useEffect(() => {
    const initial = readStoredLanguage()
    setLanguageState(initial)
    writeCookie(initial) // keep the cookie in sync even if it drifted

    function handleChange() {
      setLanguageState(readStoredLanguage())
    }
    window.addEventListener(EVENT_NAME, handleChange)
    window.addEventListener("storage", handleChange) // keep tabs in sync
    return () => {
      window.removeEventListener(EVENT_NAME, handleChange)
      window.removeEventListener("storage", handleChange)
    }
  }, [])

  const setLanguage = useCallback((lang: Language) => {
    window.localStorage.setItem(STORAGE_KEY, lang)
    writeCookie(lang)
    window.dispatchEvent(new Event(EVENT_NAME))
  }, [])

  return {
    language,
    setLanguage,
    t: translations[language],
  }
}