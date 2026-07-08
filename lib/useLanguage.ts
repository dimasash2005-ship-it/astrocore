"use client"

import { useCallback, useEffect, useState } from "react"
import { translations, DEFAULT_LANGUAGE, type Language } from "@/lib/language"

const STORAGE_KEY = "astrocore_language"
const EVENT_NAME = "astrocore:language-change"

function readStoredLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === "uk" || stored === "en" ? stored : DEFAULT_LANGUAGE
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
    setLanguageState(readStoredLanguage())

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
    window.dispatchEvent(new Event(EVENT_NAME))
  }, [])

  return {
    language,
    setLanguage,
    t: translations[language],
  }
}