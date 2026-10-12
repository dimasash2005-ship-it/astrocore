// lib/reminders/core.ts
//
// Reminders: time-zone math + a small natural-language parser.
// Works in the browser and on the server (no dependencies).
//
//   parseReminder("завтра о 9 подзвонити Кіру", "Europe/Prague")
//     -> { text: "подзвонити Кіру", at: <Date>, repeat: "none" }
//   parseReminder("щодня о 8:30 випити воду") -> repeat "daily"
//   parseReminder("через 20 хв перевірити духовку")

export type Repeat = "none" | "daily" | "weekdays" | "weekly"
export const REPEATS: Repeat[] = ["none", "daily", "weekdays", "weekly"]

// ── Time zones ───────────────────────────────────────────────────

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

/** Wall-clock time in `tz` -> UTC instant (ms). */
export function zonedToUtc(y: number, m: number, d: number, h: number, mi: number, tz: string): number {
  const guess = Date.UTC(y, m, d, h, mi)
  let utc = guess - tzOffsetMs(guess, tz)
  utc = guess - tzOffsetMs(utc, tz)
  return utc
}

/** Calendar parts of an instant as seen in `tz`. m is 0-based, wd 0 = Sunday. */
export function localParts(instant: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", weekday: "short",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(new Date(instant))
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? ""
  return {
    y: Number(get("year")), m: Number(get("month")) - 1, d: Number(get("day")),
    h: Number(get("hour")), mi: Number(get("minute")),
    wd: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday")),
  }
}

export function safeTz(tz: string | null | undefined): string {
  if (!tz) return "Europe/Prague"
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return tz } catch { return "Europe/Prague" }
}

/** Next time a repeating reminder fires, strictly after `after`. null for one-off reminders. */
export function nextOccurrence(current: Date, repeat: Repeat, tz: string, after: Date = new Date()): Date | null {
  if (repeat === "none") return null
  const { h, mi } = localParts(current.getTime(), tz)
  const start = Math.max(current.getTime(), after.getTime())
  for (let i = 0; i <= 9; i++) {
    const day = localParts(start + i * 86_400_000, tz)
    if (repeat === "weekdays" && (day.wd === 0 || day.wd === 6)) continue
    if (repeat === "weekly" && day.wd !== localParts(current.getTime(), tz).wd) continue
    const at = zonedToUtc(day.y, day.m, day.d, h, mi, tz)
    if (at > start) return new Date(at)
  }
  return null
}

// ── Parser ───────────────────────────────────────────────────────

const WEEKDAYS: [RegExp, number][] = [
  [/\b(?:в|у)\s+неділю\b|\bнеділ[яію]\b|\bsunday\b/, 0],
  [/\b(?:в|у)\s+понеділок\b|\bпонеділ[окка]+\b|\bmonday\b/, 1],
  [/\b(?:в|у)\s+вівторок\b|\bвівтор[ока]+\b|\btuesday\b/, 2],
  [/\b(?:в|у)\s+середу\b|\bсеред[ауи]\b|\bwednesday\b/, 3],
  [/\b(?:в|у)\s+четвер\b|\bчетвер[га]*\b|\bthursday\b/, 4],
  [/\b(?:в|у)\s+п['’ʼ]?ятницю\b|\bп['’ʼ]?ятниц[яію]\b|\bfriday\b/, 5],
  [/\b(?:в|у)\s+суботу\b|\bсубот[аиу]\b|\bsaturday\b/, 6],
]

const MONTHS: [RegExp, number][] = [
  [/січня|january|jan\b/, 0], [/лютого|february|feb\b/, 1], [/березня|march|mar\b/, 2], [/квітня|april|apr\b/, 3],
  [/травня|may\b/, 4], [/червня|june|jun\b/, 5], [/липня|july|jul\b/, 6], [/серпня|august|aug\b/, 7],
  [/вересня|september|sep\b/, 8], [/жовтня|october|oct\b/, 9], [/листопада|november|nov\b/, 10], [/грудня|december|dec\b/, 11],
]

// \b doesn't understand Cyrillic in JS, so every \b becomes a Unicode-aware word edge.
const WB = "(?:(?<![\\p{L}\\d])(?=[\\p{L}\\d])|(?<=[\\p{L}\\d])(?![\\p{L}\\d]))"
const re = (src: string) => new RegExp(src.replace(/\\b/g, WB), "iu")

export type Parsed = { text: string; at: Date; repeat: Repeat }

/** Does the message start like a reminder request? ("нагадай …", "remind me …") */
export function isReminderPhrase(text: string): boolean {
  return /^\s*(?:нагадай|нагадайте|нагадати|remind)(?=\s|$)/iu.test(text)
}

/**
 * Understands (Ukrainian + English): "завтра о 9", "сьогодні о 18:30", "у пʼятницю о 10",
 * "15.10 о 12", "20 жовтня о 8", "через 20 хв / 2 год / 3 дні", "щодня / по буднях / щотижня о 8:00",
 * "tomorrow at 9am", "in 15 minutes", "every day at 7". Without a time: 9:00.
 * Returns null if there's no date/time in the text or nothing left to remind about.
 */
export function parseReminder(input: string, tzIn?: string | null, now: Date = new Date()): Parsed | null {
  const tz = safeTz(tzIn)
  let s = " " + input.trim().replace(/\s+/g, " ") + " "
  const cut = (r: RegExp) => { s = s.replace(r, " ") }
  const take = (r: RegExp) => { const m = s.match(r); if (m) cut(r); return m }

  // Lead-in words
  cut(re("^\\s*/remind(?:@\\w+)?\\s"))
  cut(re("^\\s*(?:нагадай(?:те)?|нагадати|remind)\\s+(?:мені\\s+|me\\s+)?(?:(?:to|що|щоб|про)\\s+)?"))

  // Relative: "через 20 хв", "in 2 hours"
  const rel = take(re("\\b(?:через|in)\\s+(\\d{1,4})\\s*(хв(?:илин[уи]?)?|min(?:ute)?s?|m|год(?:ин[уи]?)?|hours?|h|дн(?:і|ів|я)?|день|days?|d)\\b"))
  if (rel) {
    const n = Number(rel[1]); const u = rel[2].toLowerCase()
    const ms = /^(хв|min|m)/.test(u) ? 60_000 : /^(год|h)/.test(u) ? 3_600_000 : 86_400_000
    const text = clean(s)
    return text && n > 0 ? { text, at: new Date(now.getTime() + n * ms), repeat: "none" } : null
  }

  // Repeat
  let repeat: Repeat = "none"
  if (take(re("\\b(?:щодня|щоденно|кожн(?:ий|ого) день|every ?day|daily)\\b"))) repeat = "daily"
  else if (take(re("\\b(?:по буднях|у будні|в будні|щобудня|weekdays|every weekday)\\b"))) repeat = "weekdays"
  else if (take(re("\\b(?:щотижня|кожн(?:ий|ого) тиждень|every ?week|weekly)\\b"))) repeat = "weekly"
  const every = !!take(re("\\b(?:кожн(?:ий|ого|ої|у|ою)|every)\\b"))   // "кожної середи", "every friday"

  // Time: "о 9", "о 18:30", "at 9pm", "9:30"
  let hh: number | null = null, mm = 0
  const t = take(re("\\b(?:о|об|at|в|у)\\s+(\\d{1,2})(?:[:.](\\d{2}))?\\s*(am|pm|ранку|вечора|дня)?\\b"))
    ?? take(re("\\b(\\d{1,2})[:](\\d{2})\\s*(am|pm)?\\b"))
    ?? take(re("\\b(\\d{1,2})\\s*(am|pm)\\b"))
  if (t) {
    hh = Number(t[1]); mm = Number(t[2] ?? 0)
    const ap = (t[3] ?? "").toLowerCase()
    if ((ap === "pm" || ap === "вечора" || ap === "дня") && hh < 12) hh += 12
    if ((ap === "am" || ap === "ранку") && hh === 12) hh = 0
    if (hh > 23 || mm > 59) return null
  } else if (take(re("\\b(?:вранці|зранку|in the morning)\\b"))) hh = 9
  else if (take(re("\\b(?:ввечері|увечері|in the evening|tonight)\\b"))) hh = 19
  else if (take(re("\\b(?:вдень|опівдні|at noon|noon)\\b"))) hh = 12

  // Day
  const today = localParts(now.getTime(), tz)
  let day: { y: number; m: number; d: number } | null = null
  let weekdayTarget: number | null = null
  if (take(re("\\b(?:післязавтра|day after tomorrow)\\b"))) day = shift(today, 2, tz)
  else if (take(re("\\b(?:завтра|tomorrow)\\b"))) day = shift(today, 1, tz)
  else if (take(re("\\b(?:сьогодні|today)\\b"))) day = { y: today.y, m: today.m, d: today.d }
  else {
    const dm = take(re("\\b(\\d{1,2})[./](\\d{1,2})(?:[./](\\d{2,4}))?\\b"))
    if (dm) {
      let y = dm[3] ? Number(dm[3]) : today.y
      if (y < 100) y += 2000
      day = { y, m: Number(dm[2]) - 1, d: Number(dm[1]) }
    } else {
      for (const [mr, mi] of MONTHS) {
        const mrx = re(`\\b(\\d{1,2})\\s+(?:${mr.source})`)
        const named = s.match(mrx)
        if (named) { cut(mrx); day = { y: today.y, m: mi, d: Number(named[1]) }; break }
      }
      if (!day) for (const [wr, wd] of WEEKDAYS) {
        const r = re(wr.source)
        if (r.test(s)) {
          cut(r); cut(re("\\b(?:on)\\b")); weekdayTarget = wd
          const ahead = (wd - today.wd + 7) % 7
          day = shift(today, ahead, tz)
          if (repeat === "none" && every) repeat = "weekly"
          break
        }
      }
    }
  }

  if (hh === null && !day && repeat === "none") return null
  if (hh === null) hh = 9

  let base = day ?? { y: today.y, m: today.m, d: today.d }
  let at = zonedToUtc(base.y, base.m, base.d, hh, mm, tz)
  if (at <= now.getTime()) {
    if (!day || day.d === today.d && day.m === today.m && day.y === today.y && !weekdayTarget) {
      base = shift(today, 1, tz)                      // "о 9" when it's already 10 -> tomorrow
      at = zonedToUtc(base.y, base.m, base.d, hh, mm, tz)
    } else if (weekdayTarget !== null) {
      base = shift(base, 7, tz)                       // "у понеділок о 9" when it's Monday 10:00 -> next week
      at = zonedToUtc(base.y, base.m, base.d, hh, mm, tz)
    } else if (day && !/\d{4}/.test(input) && (day.m < today.m || (day.m === today.m && day.d < today.d))) {
      at = zonedToUtc(base.y + 1, base.m, base.d, hh, mm, tz) // "5.01" in October -> next year
    }
  }
  if (repeat === "weekdays") {
    let p = localParts(at, tz)
    while (p.wd === 0 || p.wd === 6) { const n = shift(p, 1, tz); at = zonedToUtc(n.y, n.m, n.d, hh, mm, tz); p = localParts(at, tz) }
  }

  const text = clean(s)
  if (!text || Number.isNaN(at)) return null
  return { text, at: new Date(at), repeat }
}

function shift(p: { y: number; m: number; d: number }, days: number, tz: string) {
  const noon = zonedToUtc(p.y, p.m, p.d, 12, 0, tz) + days * 86_400_000
  const q = localParts(noon, tz)
  return { y: q.y, m: q.m, d: q.d }
}

function clean(s: string): string {
  return s.replace(/\s+/g, " ").trim()
    .replace(/^(?:[,.:;—–-]|що|щоб|to|про)\s+/iu, "")
    .replace(/[,.:;—–-]+$/u, "")
    .trim()
    .replace(/^\p{Ll}/u, c => c.toUpperCase())
}

// ── Formatting ───────────────────────────────────────────────────

const REPEAT_LABEL = {
  uk: { none: "", daily: "щодня", weekdays: "по буднях", weekly: "щотижня" },
  en: { none: "", daily: "daily", weekdays: "on weekdays", weekly: "weekly" },
}

export function repeatLabel(r: Repeat, lang: "uk" | "en"): string {
  return REPEAT_LABEL[lang][r] ?? ""
}

/** "сьогодні о 18:30", "завтра о 09:00", "пт, 17 жовт. о 10:00" */
export function formatWhen(at: Date, tz: string, lang: "uk" | "en", now: Date = new Date()): string {
  const p = localParts(at.getTime(), tz)
  const n = localParts(now.getTime(), tz)
  const tmr = shift(n, 1, tz)
  const time = `${String(p.h).padStart(2, "0")}:${String(p.mi).padStart(2, "0")}`
  const sameDay = (a: { y: number; m: number; d: number }) => a.y === p.y && a.m === p.m && a.d === p.d
  const word = lang === "uk" ? "о" : "at"
  if (sameDay(n)) return `${lang === "uk" ? "сьогодні" : "today"} ${word} ${time}`
  if (sameDay(tmr)) return `${lang === "uk" ? "завтра" : "tomorrow"} ${word} ${time}`
  const date = new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", {
    timeZone: tz, weekday: "short", day: "numeric", month: "short", ...(p.y !== n.y ? { year: "numeric" } : {}),
  }).format(at)
  return `${date} ${word} ${time}`
}
