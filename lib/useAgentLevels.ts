"use client"

// Loads /api/agents/levels once and shares it between pages (chat list, chat, agents).

import { useEffect, useState } from "react"
import { EMPTY_LEVEL, type AgentLevel } from "@/lib/cosmos"

type Levels = Record<string, AgentLevel>

let cache: { at: number; data: Levels } | null = null
let inflight: Promise<Levels> | null = null

function fetchLevels(): Promise<Levels> {
  if (cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.data)
  if (!inflight) {
    inflight = fetch("/api/agents/levels", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : { levels: {} }))
      .then(d => {
        const data = (d?.levels ?? {}) as Levels
        cache = { at: Date.now(), data }
        return data
      })
      .catch(() => ({} as Levels))
      .finally(() => { inflight = null })
  }
  return inflight
}

export function useAgentLevels() {
  const [levels, setLevels] = useState<Levels>(() => cache?.data ?? {})
  useEffect(() => {
    let alive = true
    fetchLevels().then(d => { if (alive) setLevels(d) })
    return () => { alive = false }
  }, [])
  return {
    levels,
    levelOf: (agentId?: string | null): AgentLevel => (agentId && levels[agentId]) || EMPTY_LEVEL,
  }
}
