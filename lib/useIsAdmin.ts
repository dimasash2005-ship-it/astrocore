"use client"

// WHERE TO PUT THIS FILE: lib/useIsAdmin.ts
//
// Checks the `admins` table (see forum_admin_and_delete.sql) for the
// currently logged-in user. `checked` lets callers avoid a flash of
// "not admin" UI before the check has actually resolved.

import { useState, useEffect } from "react"
import { getSupabase } from "@/lib/supabase/client"

export function useIsAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      const sb = getSupabase()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) {
        if (!cancelled) { setIsAdmin(false); setChecked(true) }
        return
      }
      const { data } = await sb.from("admins").select("id").eq("id", user.id).maybeSingle()
      if (!cancelled) { setIsAdmin(!!data); setChecked(true) }
    }
    check()
    return () => { cancelled = true }
  }, [])

  return { isAdmin, checked }
}