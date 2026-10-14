// lib/marketing.ts
//
// "Marketing lab" of a report: raw campaign numbers in, every marketing metric out.
// Pure code (no AI, no tokens): metrics, rough benchmarks, funnel, what-if forecast,
// reading CSV / pasted tables from ad managers and Google Sheets, and a plain-words summary.
// Works on the server and in the browser.

export type Channel = "facebook" | "google" | "tiktok" | "affiliate" | "other"

export type Nums = {
  spend: number
  impressions: number
  clicks: number
  leads: number      // affiliate: conversions
  sales: number      // affiliate: approved
  revenue: number
}

export type MktRow = Nums & { name: string }

export type Marketing = {
  v: 1
  channel: Channel
  currency: string          // "$", "€", "₴", "zł", "Kč"…
  totals: Nums
  rows: MktRow[]            // campaigns / ad sets / creatives (optional)
  payout?: number           // affiliate: payout per approved conversion
  source: "manual" | "csv" | "paste" | "agent" | "sheet"
  updatedAt: string
  sheet?: SheetLink         // connected Google Sheet: numbers are re-read from it automatically
}

export type SheetLink = { url: string; syncedAt: string; error?: SheetError }
export type SheetError = "badurl" | "private" | "notfound" | "empty" | "nocolumns" | "network" | "toolarge"

export const EMPTY_NUMS: Nums = { spend: 0, impressions: 0, clicks: 0, leads: 0, sales: 0, revenue: 0 }

export function emptyMarketing(channel: Channel = "facebook", currency = "$"): Marketing {
  return { v: 1, channel, currency, totals: { ...EMPTY_NUMS }, rows: [], source: "manual", updatedAt: new Date().toISOString() }
}

/** Revenue actually used: affiliate with a payout counts approved × payout when revenue is empty. */
export function effectiveRevenue(m: Pick<Marketing, "channel" | "payout">, n: Nums): number {
  if (m.channel === "affiliate" && !n.revenue && m.payout) return n.sales * m.payout
  return n.revenue
}

// ── Metrics ──────────────────────────────────────────────────────

export type Metrics = {
  ctr: number | null      // % clicks / impressions
  cpc: number | null
  cpm: number | null
  crLead: number | null   // % leads / clicks
  crSale: number | null   // % sales / leads
  cpl: number | null
  cpa: number | null
  aov: number | null      // revenue per sale
  roas: number | null     // revenue / spend
  roi: number | null      // % (revenue - spend) / spend
  profit: number | null
  epc: number | null      // revenue / click
}

const div = (a: number, b: number) => (b > 0 && Number.isFinite(a) ? a / b : null)
const pct = (a: number, b: number) => { const d = div(a, b); return d === null ? null : d * 100 }

export function computeMetrics(n: Nums, revenue = n.revenue): Metrics {
  const hasRev = revenue > 0
  return {
    ctr: pct(n.clicks, n.impressions),
    cpc: div(n.spend, n.clicks),
    cpm: n.impressions > 0 ? (n.spend / n.impressions) * 1000 : null,
    crLead: pct(n.leads, n.clicks),
    crSale: pct(n.sales, n.leads),
    cpl: div(n.spend, n.leads),
    cpa: div(n.spend, n.sales),
    aov: hasRev ? div(revenue, n.sales) : null,
    roas: hasRev ? div(revenue, n.spend) : null,
    roi: hasRev && n.spend > 0 ? ((revenue - n.spend) / n.spend) * 100 : null,
    profit: hasRev ? revenue - n.spend : null,
    epc: hasRev ? div(revenue, n.clicks) : null,
  }
}

// ── Benchmarks (rough, so the dots mean something) ───────────────

export type Grade = "good" | "ok" | "bad" | "none"
export type MetricKey = keyof Metrics

// [good, ok] thresholds; "hi" = higher is better, "lo" = lower is better.
const NORMS: Record<Channel, Partial<Record<MetricKey, { dir: "hi" | "lo"; good: number; ok: number }>>> = {
  facebook:  { ctr: { dir: "hi", good: 1.5, ok: 0.9 }, cpm: { dir: "lo", good: 10, ok: 18 }, cpc: { dir: "lo", good: 0.8, ok: 1.6 } },
  google:    { ctr: { dir: "hi", good: 4, ok: 2 },     cpm: { dir: "lo", good: 8, ok: 15 },  cpc: { dir: "lo", good: 1.5, ok: 3 } },
  tiktok:    { ctr: { dir: "hi", good: 1.2, ok: 0.7 }, cpm: { dir: "lo", good: 8, ok: 14 },  cpc: { dir: "lo", good: 0.8, ok: 1.5 } },
  affiliate: { ctr: { dir: "hi", good: 1.5, ok: 0.8 }, cpm: { dir: "lo", good: 6, ok: 12 },  cpc: { dir: "lo", good: 0.3, ok: 0.7 } },
  other:     { ctr: { dir: "hi", good: 1.5, ok: 0.8 }, cpm: { dir: "lo", good: 10, ok: 20 }, cpc: { dir: "lo", good: 1, ok: 2 } },
}
const COMMON: Partial<Record<MetricKey, { dir: "hi" | "lo"; good: number; ok: number }>> = {
  roas: { dir: "hi", good: 3, ok: 1.5 },
  roi: { dir: "hi", good: 50, ok: 0 },
  crLead: { dir: "hi", good: 10, ok: 4 },
  crSale: { dir: "hi", good: 25, ok: 12 },
}
// Money norms are in dollars/euros; for other currencies we don't colour CPM/CPC.
const MONEY_OK = new Set(["$", "€", "£", "USD", "EUR", "GBP"])

export function grade(key: MetricKey, value: number | null, m: Pick<Marketing, "channel" | "currency">, x?: Metrics): Grade {
  if (value === null || !Number.isFinite(value)) return "none"
  if (key === "cpa" && x?.aov) return value <= x.aov * 0.5 ? "good" : value <= x.aov ? "ok" : "bad"
  if (key === "cpc" && x?.epc) return value <= x.epc * 0.6 ? "good" : value <= x.epc ? "ok" : "bad"
  if (key === "profit") return value > 0 ? "good" : value === 0 ? "ok" : "bad"
  if ((key === "cpm" || key === "cpc") && !MONEY_OK.has(m.currency)) return "none"
  const n = COMMON[key] ?? NORMS[m.channel]?.[key]
  if (!n) return "none"
  if (n.dir === "hi") return value >= n.good ? "good" : value >= n.ok ? "ok" : "bad"
  return value <= n.good ? "good" : value <= n.ok ? "ok" : "bad"
}

// ── Funnel ───────────────────────────────────────────────────────

export type FunnelStep = { key: "impressions" | "clicks" | "leads" | "sales"; value: number; rateFromPrev: number | null }

export function funnel(n: Nums): { steps: FunnelStep[]; worst: number | null } {
  const order: FunnelStep["key"][] = ["impressions", "clicks", "leads", "sales"]
  const steps = order.filter(k => n[k] > 0).map((k, i, arr) => ({
    key: k, value: n[k], rateFromPrev: i === 0 ? null : pct(n[k], n[arr[i - 1]]),
  }))
  // The biggest loss, judged against what's normal for each step (CTR is naturally tiny).
  const normal: Record<string, number> = { clicks: 1.2, leads: 8, sales: 20 }
  let worst: number | null = null, worstScore = Infinity
  steps.forEach((s, i) => {
    if (i === 0 || s.rateFromPrev === null) return
    const score = s.rateFromPrev / (normal[s.key] ?? 10)
    if (score < worstScore) { worstScore = score; worst = i }
  })
  return { steps, worst }
}

// ── What-if ──────────────────────────────────────────────────────

/** Same CPM, CTR and click→lead rate; new budget and (optionally) a new lead→sale rate. */
export function forecast(n: Nums, revenue: number, budget: number, crSale?: number) {
  const k = n.spend > 0 ? budget / n.spend : 0
  const leads = n.leads * k
  const rate = crSale !== undefined ? crSale / 100 : n.leads > 0 ? n.sales / n.leads : 0
  const sales = leads * rate
  const aov = n.sales > 0 ? revenue / n.sales : 0
  const rev = sales * aov
  return { leads, sales, revenue: rev, profit: rev - budget, clicks: n.clicks * k }
}

// ── Reading CSV / pasted tables ──────────────────────────────────

const HEAD: Record<keyof Nums | "name", RegExp[]> = {
  name: [/^(campaign|ad set|adset|ad|creative|кампан|креатив|оголош|объявл|назва|name|offer|оффер|гео|geo)/i],
  spend: [/amount spent|^spend|^cost|^витрат|^сума витрат|потрачен|расход|затрат|^cost \(|cost$/i],
  impressions: [/^impr|impressions|^покази|^показы|^покази/i],
  clicks: [/link clicks|^clicks|^кліки|^клики|^переход|outbound clicks|^кліків/i],
  leads: [/^leads|^лід|^лид|заявк|^results$|^conversions$|^conv\.?$|^конверс|registrations|^реєстрац|^регистрац/i],
  sales: [/purchases$|^purchases|^sales|^продаж|^покупк|^orders|^замовл|^заказ|approved|^апрув|^підтвердж|^подтвержд/i],
  revenue: [/conversion value|purchase.*value|^revenue|^conv\. value|^дохід|^доход|^виручк|^выручк|^income|^payout|^виплат|^выплат|^профіт|^profit$/i],
}

export function toNumber(raw: string): number {
  let s = String(raw ?? "").trim().replace(/[\s ]/g, "").replace(/[^\d.,\-]/g, "")
  if (!s) return 0
  const lastComma = s.lastIndexOf(","), lastDot = s.lastIndexOf(".")
  if (lastComma > -1 && lastDot > -1) {
    s = lastComma > lastDot ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "")
  } else if (lastComma > -1) {
    // "1,234" (thousands) vs "12,5" (decimal)
    s = /,\d{3}$/.test(s) && s.split(",").length > 1 && s.length > 4 ? s.replace(/,/g, "") : s.replace(",", ".")
  }
  const n = parseFloat(s)
  return Number.isFinite(n) ? n : 0
}

function splitLine(line: string, d: string): string[] {
  const out: string[] = []
  let cur = "", q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
      else if (c === '"') q = false
      else cur += c
    } else if (c === '"') q = true
    else if (c === d) { out.push(cur); cur = "" }
    else cur += c
  }
  out.push(cur)
  return out.map(x => x.trim())
}

export type ParseResult = { rows: MktRow[]; totals: Nums; found: (keyof Nums)[]; currency: string | null; error?: "empty" | "nocolumns" }

function headerCols(head: string[]): Partial<Record<keyof Nums | "name", number>> {
  const col: Partial<Record<keyof Nums | "name", number>> = {}
  head.forEach((h, i) => {
    const t = h.replace(/\s*\(.*?\)\s*$/, "").trim()
    for (const k of Object.keys(HEAD) as (keyof Nums | "name")[]) {
      if (col[k] === undefined && HEAD[k].some(re => re.test(t) || re.test(h))) { col[k] = i; break }
    }
  })
  return col
}

const NUM_KEYS: (keyof Nums)[] = ["spend", "impressions", "clicks", "leads", "sales", "revenue"]

export function parseTable(text: string): ParseResult {
  // Drop empty rows and rows of empty cells (",,,,," from Google Sheets).
  let lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(l => l.replace(/[,;\t"\s]/g, ""))
  // A CSV pasted into Google Sheets often stays in column A, and the sheet is then exported
  // as one quoted cell per row ("Campaign,Spend,…"). Unwrap it and read the inner CSV.
  if (lines.length && !text.includes("\t")) {
    const cells = lines.map(l => splitLine(l, ",").filter(Boolean))
    if (cells.every(c => c.length <= 1) && cells.some(c => /[,;]/.test(c[0] ?? ""))) lines = cells.map(c => c[0] ?? "").filter(Boolean)
  }
  if (lines.length < 2) return { rows: [], totals: { ...EMPTY_NUMS }, found: [], currency: null, error: "empty" }
  // The header is the first row (among the first 10) that names at least two number columns.
  const delim = (l: string) => l.includes("\t") ? "\t" : (l.split(";").length > l.split(",").length ? ";" : ",")
  let hi = -1, d = ",", col: Partial<Record<keyof Nums | "name", number>> = {}
  for (let i = 0; i < Math.min(10, lines.length - 1); i++) {
    const di = delim(lines[i]), ci = headerCols(splitLine(lines[i], di))
    const n = NUM_KEYS.filter(k => ci[k] !== undefined).length
    if (n >= 2 || (n === 1 && hi < 0)) { hi = i; d = di; col = ci; if (n >= 2) break }
  }
  const found = NUM_KEYS.filter(k => col[k] !== undefined)
  if (hi < 0 || found.length === 0) return { rows: [], totals: { ...EMPTY_NUMS }, found: [], currency: null, error: "nocolumns" }

  const cur = text.match(/[$€£₴]|\b(USD|EUR|UAH|PLN|CZK|GBP)\b/)?.[0] ?? null
  const rows: MktRow[] = []
  for (const line of lines.slice(hi + 1)) {
    const cells = splitLine(line, d)
    const name = col.name !== undefined ? cells[col.name] ?? "" : ""
    if (/^(total|всього|разом|итого|усього|results?)(?=$|[\s:.,])/iu.test(name.trim())) continue
    const r: MktRow = { name: name || `#${rows.length + 1}`, ...EMPTY_NUMS }
    for (const k of found) r[k] = toNumber(cells[col[k]!] ?? "")
    if (found.every(k => r[k] === 0)) continue
    rows.push(r)
  }
  const totals = rows.reduce<Nums>((a, r) => ({
    spend: a.spend + r.spend, impressions: a.impressions + r.impressions, clicks: a.clicks + r.clicks,
    leads: a.leads + r.leads, sales: a.sales + r.sales, revenue: a.revenue + r.revenue,
  }), { ...EMPTY_NUMS })
  const currency = cur === "USD" ? "$" : cur === "EUR" ? "€" : cur === "UAH" ? "₴" : cur === "GBP" ? "£" : cur === "PLN" ? "zł" : cur === "CZK" ? "Kč" : cur
  return { rows: rows.slice(0, 200), totals, found, currency }
}

/** Puts freshly parsed numbers into a marketing block, keeping channel, payout and settings. */
export function applyParsed(base: Marketing, r: Pick<ParseResult, "rows" | "totals" | "currency">, source: Marketing["source"]): Marketing {
  return { ...base, totals: r.totals, rows: r.rows.length >= 2 ? r.rows : [], currency: r.currency ?? base.currency, source, updatedAt: new Date().toISOString() }
}

// ── Google Sheets ────────────────────────────────────────────────
// A sheet shared as "Anyone with the link: Viewer" (or "Published to the web") can be read
// as CSV without any Google login or API key. Only docs.google.com links are accepted.

export function sheetCsvUrl(raw: string): string | null {
  let u: URL
  try { u = new URL(String(raw).trim()) } catch { return null }
  if (u.protocol !== "https:" || u.hostname !== "docs.google.com") return null
  const gid = /(?:^|[#&?])gid=(\d+)/.exec(u.hash + "&" + u.search)?.[1]
  const pub = /^\/spreadsheets\/d\/e\/([\w-]{20,})(?:\/|$)/.exec(u.pathname)
  if (pub) return `https://docs.google.com/spreadsheets/d/e/${pub[1]}/pub?output=csv${gid ? `&single=true&gid=${gid}` : ""}`
  const id = /^\/spreadsheets\/d\/([\w-]{20,})(?:\/|$)/.exec(u.pathname)?.[1]
  if (!id) return null
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv${gid ? `&gid=${gid}` : ""}`
}

/** Older than `ms` → time to re-read the sheet. */
export function sheetStale(m: Marketing, ms = 30 * 60 * 1000): boolean {
  if (!m.sheet) return false
  const t = Date.parse(m.sheet.syncedAt)
  return !t || Date.now() - t > ms
}

// ── Summary in plain words ───────────────────────────────────────

const STEP_UK: Record<string, string> = { clicks: "показ → клік", leads: "клік → лід", sales: "лід → продаж" }
const STEP_EN: Record<string, string> = { clicks: "impression → click", leads: "click → lead", sales: "lead → sale" }

export function rowScore(r: MktRow, m: Pick<Marketing, "channel" | "payout">): number | null {
  const rev = effectiveRevenue(m, r)
  if (rev > 0 && r.spend > 0) return rev / r.spend                       // ROAS
  if (r.leads > 0 && r.spend > 0) return -(r.spend / r.leads)             // cheaper lead = better
  if (r.clicks > 0 && r.impressions > 0) return r.clicks / r.impressions  // CTR
  return null
}

export function bestWorst(m: Marketing): { best: number | null; worst: number | null } {
  if (m.rows.length < 2) return { best: null, worst: null }
  let best: number | null = null, worst: number | null = null, bs = -Infinity, ws = Infinity
  m.rows.forEach((r, i) => {
    const s = rowScore(r, m)
    if (s === null) return
    if (s > bs) { bs = s; best = i }
    if (s < ws) { ws = s; worst = i }
  })
  return best === worst ? { best, worst: null } : { best, worst }
}

export function summary(m: Marketing, lang: "uk" | "en"): string[] {
  const uk = lang === "uk"
  const rev = effectiveRevenue(m, m.totals)
  const x = computeMetrics(m.totals, rev)
  const out: string[] = []
  const money = (v: number) => fmtMoney(v, m.currency)
  if (x.roi !== null && x.profit !== null) {
    out.push(x.profit >= 0
      ? (uk ? `Кампанія прибуткова: ROI ${fmtNum(x.roi, 0)}%, прибуток ${money(x.profit)}.` : `The campaign is profitable: ROI ${fmtNum(x.roi, 0)}%, profit ${money(x.profit)}.`)
      : (uk ? `Кампанія поки збиткова: мінус ${money(-x.profit)} (ROI ${fmtNum(x.roi, 0)}%).` : `The campaign is losing money: ${money(-x.profit)} down (ROI ${fmtNum(x.roi, 0)}%).`))
  } else if (x.cpl !== null) {
    out.push(uk ? `Ліди коштують ${money(x.cpl)}. Додай дохід, щоб порахувати ROI.` : `Leads cost ${money(x.cpl)}. Add revenue to see ROI.`)
  }
  const f = funnel(m.totals)
  if (f.worst !== null) {
    const s = f.steps[f.worst]
    out.push(uk ? `Найбільша втрата на етапі «${STEP_UK[s.key]}»: лише ${fmtNum(s.rateFromPrev ?? 0, 1)}%.`
      : `The biggest loss is at "${STEP_EN[s.key]}": only ${fmtNum(s.rateFromPrev ?? 0, 1)}%.`)
  }
  if (grade("ctr", x.ctr, m) === "bad") out.push(uk ? "CTR низький: спробуй нові креативи або заголовки." : "CTR is low: try new creatives or headlines.")
  if (grade("cpm", x.cpm, m) === "bad") out.push(uk ? "CPM дорогий: розшир аудиторію або зміни плейсменти." : "CPM is expensive: widen the audience or change placements.")
  const bw = bestWorst(m)
  if (bw.best !== null && bw.worst !== null) {
    out.push(uk ? `Найкраще працює «${m.rows[bw.best].name}», найгірше «${m.rows[bw.worst].name}»: варто перекинути бюджет.`
      : `"${m.rows[bw.best].name}" works best and "${m.rows[bw.worst].name}" worst: consider moving budget.`)
  }
  return out
}

// ── Formatting ───────────────────────────────────────────────────

export function fmtNum(v: number, digits = 0): string {
  return v.toLocaleString("uk-UA", { minimumFractionDigits: digits, maximumFractionDigits: digits }).replace(/ /g, " ")
}
export function fmtMoney(v: number, cur: string): string {
  const d = Math.abs(v) < 10 ? 2 : Math.abs(v) < 1000 ? 1 : 0
  const s = (Math.round(v * 100) / 100).toLocaleString("uk-UA", { minimumFractionDigits: Math.abs(v) < 10 ? 2 : 0, maximumFractionDigits: d }).replace(/\u00a0/g, " ")
  return /^[$€£]$/.test(cur) ? `${cur}${s}` : `${s} ${cur}`
}

export function isMarketing(x: unknown): x is Marketing {
  const m = x as Marketing | null
  return !!m && typeof m === "object" && m.v === 1 && !!m.totals && typeof m.totals.spend === "number"
}
