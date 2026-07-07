// Builds/opens native Obsidian "new note" URIs — no plugin-side code
// needed for this direction, Obsidian itself handles obsidian://new.
// Client-only (uses window/localStorage) — import from a "use client" component.

const VAULT_NAME_STORAGE_KEY = "astrocore:obsidianVaultName"

export function getStoredVaultName(): string {
  if (typeof window === "undefined") return ""
  return window.localStorage.getItem(VAULT_NAME_STORAGE_KEY) || ""
}

export function setStoredVaultName(name: string): void {
  if (typeof window === "undefined") return
  window.localStorage.setItem(VAULT_NAME_STORAGE_KEY, name.trim())
}

export interface SaveToObsidianOptions {
  title: string
  content: string
  /** Defaults to "AstroCore" per the MVP spec. */
  folder?: string
  /** Defaults to "AstroCore" per the MVP spec. */
  source?: string
}

function sanitizeTitle(title: string): string {
  // Strip characters that are invalid in filenames across OSes.
  return title.replace(/[\\/:*?"<>|]/g, "-").trim() || "Untitled"
}

function buildFrontmatter(source: string, createdAt: string): string {
  return `---\nsource: ${source}\ncreatedAt: ${createdAt}\n---\n\n`
}

export function buildObsidianSaveUri(vaultName: string, opts: SaveToObsidianOptions): string {
  const folder = (opts.folder ?? "AstroCore").replace(/^\/+|\/+$/g, "")
  const createdAt = new Date().toISOString()
  const body = `${buildFrontmatter(opts.source ?? "AstroCore", createdAt)}${opts.content}`
  const filePath = `${folder}/${sanitizeTitle(opts.title)}`

  const params = new URLSearchParams({
    vault: vaultName,
    file: filePath,
    content: body,
  })
  return `obsidian://new?${params.toString()}`
}

/**
 * Attempts to hand the note off to the Obsidian desktop app via the
 * native obsidian://new URI. Returns false (and does nothing) if no
 * vault name is known yet — the caller should prompt for one first.
 */
export function openInObsidian(vaultName: string, opts: SaveToObsidianOptions): boolean {
  if (!vaultName.trim()) return false
  window.location.href = buildObsidianSaveUri(vaultName, opts)
  return true
}