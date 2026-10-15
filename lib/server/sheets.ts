// lib/server/sheets.ts
//
// Reads a Google Sheet as CSV (no OAuth, no API key, no AI tokens).
// Works for sheets shared as "Anyone with the link: Viewer" or published to the web.
// Only docs.google.com URLs are ever fetched (see sheetCsvUrl).

import { parseTable, applyParsed, sheetCsvUrl, withSnapshot, type Marketing, type ParseResult, type SheetError } from "@/lib/marketing"

const MAX_BYTES = 3 * 1024 * 1024

export async function fetchSheetCsv(url: string): Promise<{ ok: true; text: string } | { ok: false; error: SheetError }> {
  const csv = sheetCsvUrl(url)
  if (!csv) return { ok: false, error: "badurl" }
  let res: Response
  try {
    res = await fetch(csv, { redirect: "follow", cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { accept: "text/csv,text/plain;q=0.9" } })
  } catch {
    return { ok: false, error: "network" }
  }
  if (res.status === 404 || res.status === 400) return { ok: false, error: "notfound" }
  if (res.status === 401 || res.status === 403) return { ok: false, error: "private" }
  if (!res.ok) return { ok: false, error: "network" }
  // A private sheet answers with Google's sign-in page (HTML) instead of CSV.
  const type = res.headers.get("content-type") ?? ""
  if (type.includes("text/html") || /accounts\.google\.com/.test(res.url)) return { ok: false, error: "private" }
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, error: "toolarge" }
  const text = await res.text()
  if (text.length > MAX_BYTES) return { ok: false, error: "toolarge" }
  if (/^\s*<(!doctype|html)/i.test(text)) return { ok: false, error: "private" }
  return { ok: true, text }
}

export async function readSheet(url: string): Promise<{ ok: true; parsed: ParseResult } | { ok: false; error: SheetError }> {
  const f = await fetchSheetCsv(url)
  if (!f.ok) return f
  const parsed = parseTable(f.text)
  if (parsed.error) return { ok: false, error: parsed.error }
  return { ok: true, parsed }
}

/** Re-reads the connected sheet. On failure keeps the old numbers and records the error. */
export async function syncMarketingSheet(m: Marketing, url = m.sheet?.url): Promise<Marketing> {
  const now = new Date().toISOString()
  if (!url) return m
  const r = await readSheet(url)
  if (!r.ok) return { ...m, sheet: { url, syncedAt: now, error: r.error } }
  return withSnapshot({ ...applyParsed(m, r.parsed, "sheet"), sheet: { url, syncedAt: now } })
}

/** Same as syncMarketingSheet, but never waits longer than `ms` (for page renders). */
export async function syncWithTimeout(m: Marketing, ms = 6000): Promise<Marketing | null> {
  return Promise.race([syncMarketingSheet(m), new Promise<null>(r => setTimeout(() => r(null), ms))])
}
