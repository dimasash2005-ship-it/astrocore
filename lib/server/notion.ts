// lib/server/notion.ts
//
// Notion integration (server-only).
//  - OAuth: the user clicks "Connect Notion", picks which pages AstroCore may use,
//    Notion sends us a token. We keep it ENCRYPTED in `user_integrations`.
//  - Export: a report becomes a Notion page inside the page the user picked.
//  - Auto export: new reports can be sent to Notion automatically.
//
// Env (server only):
//   NOTION_CLIENT_ID, NOTION_CLIENT_SECRET   from notion.so/profile/integrations (Public integration)
//   NOTION_REDIRECT_URI                      optional, default: <site>/api/integrations/notion/callback
//   PROVIDER_ENCRYPTION_KEY                  already used for provider keys

import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"
import { encryptSecret, decryptSecret } from "@/lib/server/encryption"

export const NOTION_VERSION = "2026-03-11"
const API = "https://api.notion.com/v1"
const SITE = "https://astrocore.one"
const PAGE_ICON = `${SITE}/icon.png`

export type Lang = "uk" | "en"

export type NotionSettings = {
  parent_id?: string | null
  parent_title?: string | null
  parent_icon?: string | null
  auto_export?: boolean
  lang?: Lang
}

export type NotionConn = {
  id: string
  userId: string
  accessToken: string
  refreshToken: string | null
  workspaceName: string | null
  workspaceIcon: string | null
  settings: NotionSettings
  createdAt: string
}

export type NotionPageLite = { id: string; title: string; icon: string | null; url: string; editedAt: string | null }

export class NotionError extends Error {
  status: number
  code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

// ── Config / OAuth ───────────────────────────────────────────────

export const NOTION_STATE_COOKIE = "ac_notion_state"

export function requestOrigin(req: { headers: Headers }): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "astrocore.one"
  const proto = req.headers.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https")
  return `${proto}://${host}`
}

/** Only allow coming back to our own pages ("/x", never "//evil.com" or "https://…"). */
export function safeNext(v: string | null | undefined): string {
  return v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v.slice(0, 300) : "/integrations"
}

export function withParam(path: string, key: string, value: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}${key}=${encodeURIComponent(value)}`
}

export function notionConfigured(): boolean {
  return !!(process.env.NOTION_CLIENT_ID && process.env.NOTION_CLIENT_SECRET)
}

export function notionRedirectUri(origin: string): string {
  return process.env.NOTION_REDIRECT_URI || `${origin}/api/integrations/notion/callback`
}

export function notionAuthorizeUrl(origin: string, state: string): string {
  const u = new URL(`${API}/oauth/authorize`)
  u.searchParams.set("client_id", process.env.NOTION_CLIENT_ID ?? "")
  u.searchParams.set("response_type", "code")
  u.searchParams.set("owner", "user")
  u.searchParams.set("redirect_uri", notionRedirectUri(origin))
  u.searchParams.set("state", state)
  return u.toString()
}

type TokenResponse = {
  access_token: string
  refresh_token?: string | null
  bot_id?: string
  workspace_id?: string
  workspace_name?: string | null
  workspace_icon?: string | null
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${process.env.NOTION_CLIENT_ID}:${process.env.NOTION_CLIENT_SECRET}`).toString("base64")
  const res = await fetch(`${API}/oauth/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  })
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok || typeof data.access_token !== "string") {
    throw new NotionError(res.status || 500, String(data.error ?? data.code ?? "oauth_error"), String(data.error_description ?? data.message ?? "Notion OAuth failed"))
  }
  return data as unknown as TokenResponse
}

export function exchangeNotionCode(code: string, redirectUri: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri })
}

function refreshNotionToken(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken })
}

// ── Storage ──────────────────────────────────────────────────────

/** Service-role client: only for background work (auto export), never for user input. */
export function notionServiceClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error("Supabase service role is not configured.")
  return createServiceClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function loadNotion(sb: SupabaseClient, userId: string): Promise<NotionConn | null> {
  const { data, error } = await sb.from("user_integrations").select("*")
    .eq("user_id", userId).eq("provider", "notion").maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    id: data.id as string,
    userId,
    accessToken: decryptSecret(data.access_token_enc as string),
    refreshToken: data.refresh_token_enc ? decryptSecret(data.refresh_token_enc as string) : null,
    workspaceName: (data.workspace_name as string | null) ?? null,
    workspaceIcon: (data.workspace_icon as string | null) ?? null,
    settings: (data.settings as NotionSettings | null) ?? {},
    createdAt: data.created_at as string,
  }
}

export async function saveNotionConnection(sb: SupabaseClient, userId: string, tok: TokenResponse, settings: NotionSettings) {
  const { error } = await sb.from("user_integrations").upsert({
    user_id: userId,
    provider: "notion",
    access_token_enc: encryptSecret(tok.access_token),
    refresh_token_enc: tok.refresh_token ? encryptSecret(tok.refresh_token) : null,
    workspace_id: tok.workspace_id ?? null,
    workspace_name: tok.workspace_name ?? null,
    workspace_icon: tok.workspace_icon ?? null,
    bot_id: tok.bot_id ?? null,
    settings,
    updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,provider" })
  if (error) throw new Error(error.message)
}

export async function updateNotionSettings(sb: SupabaseClient, conn: NotionConn, patch: NotionSettings) {
  const settings = { ...conn.settings, ...patch }
  const { error } = await sb.from("user_integrations")
    .update({ settings, updated_at: new Date().toISOString() }).eq("id", conn.id)
  if (error) throw new Error(error.message)
  conn.settings = settings
  return settings
}

// ── API calls ────────────────────────────────────────────────────

function rawCall(token: string, path: string, init?: { method?: string; body?: unknown }) {
  return fetch(`${API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "Notion-Version": NOTION_VERSION,
    },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
    cache: "no-store",
  })
}

/** Calls Notion. If the token expired, refreshes it once, saves the new pair and retries. */
export async function notionCall<T = Record<string, unknown>>(
  sb: SupabaseClient, conn: NotionConn, path: string, init?: { method?: string; body?: unknown },
): Promise<T> {
  let res = await rawCall(conn.accessToken, path, init)
  if (res.status === 401 && conn.refreshToken) {
    const tok = await refreshNotionToken(conn.refreshToken)
    conn.accessToken = tok.access_token
    conn.refreshToken = tok.refresh_token ?? conn.refreshToken
    await sb.from("user_integrations").update({
      access_token_enc: encryptSecret(conn.accessToken),
      refresh_token_enc: conn.refreshToken ? encryptSecret(conn.refreshToken) : null,
      updated_at: new Date().toISOString(),
    }).eq("id", conn.id)
    res = await rawCall(conn.accessToken, path, init)
  }
  const data = await res.json().catch(() => ({})) as Record<string, unknown>
  if (!res.ok) throw new NotionError(res.status, String(data.code ?? "error"), String(data.message ?? `Notion error ${res.status}`))
  return data as T
}

function pageLite(p: Record<string, unknown>): NotionPageLite {
  const props = (p.properties ?? {}) as Record<string, { type?: string; title?: { plain_text?: string }[] }>
  const titleProp = Object.values(props).find(v => v?.type === "title")
  const title = (titleProp?.title ?? []).map(t => t.plain_text ?? "").join("").trim()
  const icon = p.icon as { type?: string; emoji?: string } | null
  return {
    id: String(p.id),
    title: title || "Untitled",
    icon: icon?.type === "emoji" ? icon.emoji ?? null : null,
    url: String(p.url ?? ""),
    editedAt: (p.last_edited_time as string | undefined) ?? null,
  }
}

/** Pages the user shared with AstroCore (newest first). */
export async function searchNotionPages(sb: SupabaseClient, conn: NotionConn, query = ""): Promise<NotionPageLite[]> {
  const data = await notionCall<{ results?: Record<string, unknown>[] }>(sb, conn, "/search", {
    method: "POST",
    body: {
      query: query.slice(0, 100),
      filter: { property: "object", value: "page" },
      sort: { direction: "descending", timestamp: "last_edited_time" },
      page_size: 25,
    },
  })
  return (data.results ?? []).filter(p => !p.in_trash && !p.archived).map(pageLite)
}

export async function getNotionPage(sb: SupabaseClient, conn: NotionConn, pageId: string): Promise<NotionPageLite> {
  return pageLite(await notionCall(sb, conn, `/pages/${encodeURIComponent(pageId)}`))
}

// ── Markdown → Notion markdown ───────────────────────────────────
// Notion's API accepts markdown directly, with a few differences from GitHub markdown:
// tables must be HTML, blank lines are dropped, and < > $ { } ^ | have meaning.

// Escapes Notion's special characters, but leaves `inline code` as it is.
const escapeInline = (s: string) =>
  s.split(/(`[^`]*`)/).map((part, i) => i % 2 ? part : part.replace(/[<>${}^|]/g, m => `\\${m}`)).join("")

function splitRow(line: string): string[] {
  let s = line.trim()
  if (s.startsWith("|")) s = s.slice(1)
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, "|"))
}

const isTableSep = (line: string) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line)

function tableToHtml(rows: string[][]): string[] {
  const width = Math.max(...rows.map(r => r.length))
  const out = [`<table header-row="true">`]
  for (const r of rows) {
    out.push("\t<tr>")
    for (let i = 0; i < width; i++) out.push(`\t\t<td>${escapeInline(r[i] ?? "")}</td>`)
    out.push("\t</tr>")
  }
  out.push("</table>")
  return out
}

export function toNotionMarkdown(md: string, title?: string): string {
  const lines = md.replace(/\r\n?/g, "\n").split("\n")
  // Drop a leading "# Title" if it repeats the page title.
  const first = lines.findIndex(l => l.trim() !== "")
  if (first >= 0 && title && /^#\s+/.test(lines[first]) && lines[first].replace(/^#\s+/, "").trim().toLowerCase() === title.trim().toLowerCase()) {
    lines.splice(first, 1)
  }

  const out: string[] = []
  let fence: string | null = null
  let quote: string[] = []
  const flushQuote = () => { if (quote.length) { out.push(`> ${quote.join("<br>")}`); quote = [] } }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const fenceMatch = line.match(/^\s*(```+|~~~+)/)
    if (fence) {
      out.push(line)
      if (fenceMatch && fenceMatch[1][0] === fence[0] && fenceMatch[1].length >= fence.length) fence = null
      continue
    }
    if (fenceMatch) { flushQuote(); fence = fenceMatch[1]; out.push(line.trimStart()); continue }

    // GitHub table: header row + separator row
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      flushQuote()
      const rows = [splitRow(line)]
      i += 2
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") { rows.push(splitRow(lines[i])); i++ }
      i--
      out.push(...tableToHtml(rows))
      continue
    }

    const q = line.match(/^\s*>\s?(.*)$/)
    if (q) { if (q[1].trim()) quote.push(escapeInline(q[1])); continue }
    flushQuote()

    if (line.trim() === "") continue
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("---"); continue }

    const h = line.match(/^\s*(#{1,6})\s+(.*)$/)
    if (h) { out.push(`${"#".repeat(Math.min(h[1].length, 4))} ${escapeInline(h[2].replace(/\s+#+\s*$/, ""))}`); continue }

    const li = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (li) {
      const depth = Math.min(Math.floor(li[1].replace(/\t/g, "  ").length / 2), 4)
      const marker = /\d/.test(li[2]) ? `${li[2].replace(")", ".")}` : "-"
      out.push(`${"\t".repeat(depth)}${marker} ${escapeInline(li[3])}`)
      continue
    }

    out.push(escapeInline(line.trim()))
  }
  flushQuote()
  if (fence) out.push(fence)
  return out.join("\n")
}

/** Splits long markdown into parts at line boundaries, never inside a code block or table. */
function chunkMarkdown(md: string, max = 40_000): string[] {
  if (md.length <= max) return [md]
  const parts: string[] = []
  let cur: string[] = [], size = 0, inFence = false, inTable = false
  for (const line of md.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) inFence = !inFence
    if (line.startsWith("<table")) inTable = true
    if (size + line.length > max && cur.length && !inFence && !inTable) { parts.push(cur.join("\n")); cur = []; size = 0 }
    cur.push(line); size += line.length + 1
    if (line.startsWith("</table>")) inTable = false
  }
  if (cur.length) parts.push(cur.join("\n"))
  return parts
}

// ── Export ───────────────────────────────────────────────────────

export type ExportResult = { pageId: string; url: string }

const FOOTER: Record<Lang, (link: string) => string> = {
  uk: link => `---\n*Звіт створив OpenClaw-агент в AstroCore · [Відкрити в AstroCore](${link})*`,
  en: link => `---\n*Report created by an OpenClaw agent in AstroCore · [Open in AstroCore](${link})*`,
}

/**
 * Sends one report to Notion as a new page and remembers the link on the report.
 * `sb` must be able to read this user's report + integration (their own session or service role).
 */
export async function exportReportToNotion(opts: {
  sb: SupabaseClient
  userId: string
  reportId: string
  parentId?: string | null
  lang?: Lang
  conn?: NotionConn | null
}): Promise<ExportResult> {
  const { sb, userId, reportId } = opts
  const conn = opts.conn ?? await loadNotion(sb, userId)
  if (!conn) throw new NotionError(401, "not_connected", "Notion is not connected")
  const parentId = opts.parentId || conn.settings.parent_id
  if (!parentId) throw new NotionError(400, "no_parent", "Choose a Notion page first")

  const { data: report, error } = await sb.from("reports").select("id, company_name, summary")
    .eq("id", reportId).eq("user_id", userId).maybeSingle()
  if (error) throw new Error(error.message)
  if (!report) throw new NotionError(404, "report_not_found", "Report not found")

  const title = String(report.company_name || "AstroCore report").slice(0, 200)
  const lang: Lang = opts.lang ?? conn.settings.lang ?? "en"
  const body = toNotionMarkdown(String(report.summary ?? ""), title)
  const markdown = `${body}\n${FOOTER[lang](`${SITE}/reports/${report.id}`)}`
  const [firstPart, ...rest] = chunkMarkdown(markdown)

  const page = await notionCall<{ id: string; url: string }>(sb, conn, "/pages", {
    method: "POST",
    body: {
      parent: { page_id: parentId },
      icon: { type: "external", external: { url: PAGE_ICON } },
      properties: { title: { title: [{ type: "text", text: { content: title } }] } },
      markdown: firstPart,
    },
  })
  for (const part of rest) {
    await notionCall(sb, conn, `/pages/${page.id}/markdown`, {
      method: "PATCH",
      body: { type: "insert_content", insert_content: { content: part, position: { type: "end" } } },
    })
  }

  await sb.from("reports").update({
    notion_page_id: page.id,
    notion_url: page.url,
    notion_exported_at: new Date().toISOString(),
  }).eq("id", report.id).eq("user_id", userId)

  return { pageId: page.id, url: page.url }
}

/**
 * Background export for a freshly created report. Does nothing unless the user
 * connected Notion, picked a page and turned on auto export. Never throws.
 */
export async function autoExportReport(userId: string, reportId: string | null | undefined): Promise<void> {
  if (!reportId || !notionConfigured()) return
  try {
    const sb = notionServiceClient()
    const conn = await loadNotion(sb, userId)
    if (!conn || !conn.settings.auto_export || !conn.settings.parent_id) return
    const { data: rep } = await sb.from("reports").select("notion_page_id").eq("id", reportId).eq("user_id", userId).maybeSingle()
    if (!rep || rep.notion_page_id) return
    await exportReportToNotion({ sb, userId, reportId, conn })
  } catch (err) {
    console.error("[notion auto export]", err instanceof Error ? err.message : err)
  }
}

// ── Friendly errors ──────────────────────────────────────────────

export type NotionErrorInfo = { code: "reconnect" | "choose_parent" | "rate_limit" | "too_big" | "not_configured" | "unknown"; message: string }

export function notionErrorInfo(err: unknown, lang: Lang): NotionErrorInfo {
  const uk = lang === "uk"
  const e = err instanceof NotionError ? err : null
  const code = e?.code ?? ""
  if (code === "not_connected" || code === "unauthorized" || code === "invalid_grant" || e?.status === 401) {
    return { code: "reconnect", message: uk ? "Доступ до Notion закінчився. Підключи Notion ще раз." : "Notion access has expired. Please connect Notion again." }
  }
  if (code === "no_parent" || code === "object_not_found" || code === "restricted_resource" || e?.status === 403) {
    return { code: "choose_parent", message: uk
      ? "AstroCore не має доступу до цієї сторінки в Notion. Вибери іншу сторінку або дай доступ під час підключення."
      : "AstroCore can't access this Notion page. Pick another page or share it when connecting." }
  }
  if (code === "rate_limited" || e?.status === 429) {
    return { code: "rate_limit", message: uk ? "Notion просить трохи зачекати. Спробуй за хвилину." : "Notion asks to slow down. Try again in a minute." }
  }
  if (code === "validation_error") {
    return { code: "too_big", message: uk ? "Notion не зміг прийняти цей звіт (завеликий або складне форматування)." : "Notion couldn't accept this report (too large or complex formatting)." }
  }
  return { code: "unknown", message: uk ? "Не вдалося надіслати в Notion. Спробуй ще раз." : "Couldn't send to Notion. Please try again." }
}