// Shared schedule math for Missions (used by the Missions page and the cron route).
// Works in the mission's own time zone, so "daily at 09:00" means 09:00 for the owner.

export type MissionSchedule = "manual" | "daily" | "weekly"

// Offset (ms) between UTC and the given time zone at a given instant.
function tzOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(new Date(instant))
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"))
  return asUtc - instant
}

// Local wall-clock time in `timeZone` → UTC instant (ms). Two passes handle DST edges.
function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, timeZone: string): number {
  const guess = Date.UTC(y, m, d, h, mi)
  let utc = guess - tzOffsetMs(guess, timeZone)
  utc = guess - tzOffsetMs(utc, timeZone)
  return utc
}

// Calendar date (y, m, d) and weekday of an instant, as seen in `timeZone`.
function localDate(instant: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date(instant))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ""
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"))
  return { y: Number(get("year")), m: Number(get("month")) - 1, d: Number(get("day")), wd }
}

/**
 * Next run time (ISO string) strictly after `from`, or null for manual missions.
 * runTime: "HH:MM" or "HH:MM:SS"; runWeekday: 0 = Sunday … 6 = Saturday.
 */
export function nextRunAt(
  schedule: MissionSchedule,
  runTime: string | null,
  runWeekday: number | null,
  timeZone: string | null,
  from: Date = new Date(),
): string | null {
  if (schedule === "manual") return null
  const tz = timeZone || "Europe/Prague"
  const [hh, mm] = (runTime || "09:00").split(":").map(n => Number(n) || 0)
  const start = from.getTime()

  for (let i = 0; i <= 8; i++) {
    const day = localDate(start + i * 86_400_000, tz)
    if (schedule === "weekly" && day.wd !== (runWeekday ?? 1)) continue
    const at = zonedToUtc(day.y, day.m, day.d, hh, mm, tz)
    if (at > start) return new Date(at).toISOString()
  }
  return null
}