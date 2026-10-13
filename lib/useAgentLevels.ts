"use client"

// Loads /api/agents/levels and shares it between pages (chat list, chat, agents, dashboard).
// Also notices level-ups: when an agent's level is higher than the one this browser saw
// last time, it fires a window event "astrocore:levelup" that <LevelUpToast/> shows.

import { useEffect, useState } from "react"
import { EMPTY_LEVEL, type AgentLevel } from "@/lib/cosmos"

export type AgentLevelInfo = AgentLevel & { name?: string; color?: string | null }
type Levels = Record<string, AgentLevelInfo>

export type LevelUpEvent = { agentId: string; name: string; color: string | null; from: number; to: number }
export const LEVELUP_EVENT = "astrocore:levelup"

const SEEN_KEY = "astrocore_agent_levels"

let cache: { at: number; data: Levels } | null = null
let inflight: Promise<Levels> | null = null
const listeners = new Set<(d: Levels) => void>()

function readSeen(): Record<string, number> | null {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY)
    return raw ? (JSON.parse(raw) as Record<string, number>) : null
  } catch { return null }
}
function writeSeen(map: Record<string, number>) {
  try { window.localStorage.setItem(SEEN_KEY, JSON.stringify(map)) } catch { /* private mode */ }
}

function detectLevelUps(data: Levels) {
  if (typeof window === "undefined") return
  const seen = readSeen()
  const next: Record<string, number> = { ...(seen ?? {}) }
  const ups: LevelUpEvent[] = []
  for (const [id, lv] of Object.entries(data)) {
    const before = seen?.[id]
    // First time we see an agent: remember silently, no fireworks for old progress.
    if (typeof before === "number" && lv.level > before) {
      ups.push({ agentId: id, name: lv.name ?? "Agent", color: lv.color ?? null, from: before, to: lv.level })
    }
    next[id] = Math.max(lv.level, before ?? 0)
  }
  writeSeen(next)
  if (ups.length) window.dispatchEvent(new CustomEvent<LevelUpEvent[]>(LEVELUP_EVENT, { detail: ups }))
}

function fetchLevels(force = false): Promise<Levels> {
  if (!force && cache && Date.now() - cache.at < 60_000) return Promise.resolve(cache.data)
  if (!inflight) {
    inflight = fetch("/api/agents/levels", { cache: "no-store" })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d?.levels) return cache?.data ?? {}
        const data = d.levels as Levels
        cache = { at: Date.now(), data }
        detectLevelUps(data)
        listeners.forEach(fn => fn(data))
        return data
      })
      .catch(() => cache?.data ?? ({} as Levels))
      .finally(() => { inflight = null })
  }
  return inflight
}

/** Re-count levels now (e.g. after the agent finished a reply). */
export function refreshAgentLevels() {
  return fetchLevels(true)
}

export function useAgentLevels() {
  const [levels, setLevels] = useState<Levels>(() => cache?.data ?? {})
  useEffect(() => {
    let alive = true
    const fn = (d: Levels) => { if (alive) setLevels(d) }
    listeners.add(fn)
    fetchLevels().then(fn)
    return () => { alive = false; listeners.delete(fn) }
  }, [])
  return {
    levels,
    levelOf: (agentId?: string | null): AgentLevelInfo => (agentId && levels[agentId]) || EMPTY_LEVEL,
  }
}
