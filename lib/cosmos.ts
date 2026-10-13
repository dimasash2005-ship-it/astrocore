// lib/cosmos.ts
//
// AstroCore "cosmos": every agent is a star system that grows while it works.
// Pure helpers, safe on the server and in the browser.

export type AgentStats = {
  chats: number      // chat sessions with this agent
  replies: number    // assistant messages
  missions: number   // mission runs (sessions created by missions)
  days: number       // distinct days with activity
  streak: number     // consecutive active days up to today (or yesterday)
}

export type AgentLevel = AgentStats & {
  level: number      // 1..MAX_LEVEL
  xp: number
  levelXp: number    // XP where the current level starts
  nextXp: number | null // XP for the next level (null at max)
}

export const MAX_LEVEL = 10

/** XP needed to reach a level: 0, 10, 40, 90, 160, 250 … */
export function xpForLevel(level: number): number {
  return 10 * (level - 1) ** 2
}

export function xpFromStats(s: AgentStats): number {
  return s.replies + s.chats * 3 + s.missions * 8 + s.days * 5
}

export function levelFromStats(s: AgentStats): AgentLevel {
  const xp = xpFromStats(s)
  let level = 1
  while (level < MAX_LEVEL && xp >= xpForLevel(level + 1)) level++
  return {
    ...s, xp, level,
    levelXp: xpForLevel(level),
    nextXp: level < MAX_LEVEL ? xpForLevel(level + 1) : null,
  }
}

export const EMPTY_LEVEL: AgentLevel = levelFromStats({ chats: 0, replies: 0, missions: 0, days: 0, streak: 0 })

/** Stable 32-bit hash (FNV-1a) — same name, same star. */
export function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

export const COSMOS_PALETTE = ["#5CC4F5", "#A78BFA", "#F5B13B", "#22C55E", "#FF4D6A", "#14B8A6", "#F472B6", "#E8002A"]

/** A second colour for planets, different from the main one. */
export function accentFor(seed: string, main: string): string {
  const h = hashStr(seed)
  const list = COSMOS_PALETTE.filter(c => c.toLowerCase() !== main.toLowerCase())
  return list[h % list.length]
}

/** Agent counts as online when its OpenClaw heartbeat is fresh. */
export function isOnline(lastSeenAt?: string | null): boolean {
  if (!lastSeenAt) return false
  const t = Date.parse(lastSeenAt)
  return Number.isFinite(t) && Date.now() - t < 120_000
}

/** Days are counted in the browser's / server's local calendar (good enough for a streak). */
export function dayKey(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export function streakFrom(days: Set<string>, now = new Date()): number {
  const d = new Date(now)
  // A streak survives until the end of today: start from yesterday if today has nothing yet.
  if (!days.has(dayKey(d.toISOString()))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d.toISOString())) && n < 3650) { n++; d.setDate(d.getDate() - 1) }
  return n
}

/** What a new level adds to the star system (for the level-up toast / Telegram). */
export function unlockLabel(level: number, lang: "uk" | "en"): string {
  const uk: Record<number, string> = {
    2: "перша планета", 3: "промені зірки", 4: "друга планета", 5: "супутник",
    6: "третя планета", 7: "корона світіння", 8: "четверта планета", 9: "яскравіше ядро", 10: "максимальний рівень",
  }
  const en: Record<number, string> = {
    2: "first planet", 3: "star rays", 4: "second planet", 5: "a moon",
    6: "third planet", 7: "glowing corona", 8: "fourth planet", 9: "a brighter core", 10: "max level",
  }
  return (lang === "uk" ? uk : en)[Math.min(level, MAX_LEVEL)] ?? (lang === "uk" ? "новий рівень" : "new level")
}
