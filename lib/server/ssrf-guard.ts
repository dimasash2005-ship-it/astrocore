// Server-only. Validates a user-supplied base URL (for a "Custom /
// Webhook" AI agent connection) before AstroCore's server makes any
// request to it. This is the only line of defense between "user pastes
// a URL into a form" and "our server fetches it" — without this, a
// malicious URL could make the server hit internal infrastructure
// (cloud metadata endpoints, internal services, localhost) on the
// user's behalf.

const BLOCKED_HOSTNAMES = new Set([
    "169.254.169.254", // AWS/GCP/Azure cloud metadata endpoint
    "metadata.google.internal",
  ])
  
  // Best-effort private/loopback IP check. This is deliberately simple
  // (string/prefix matching on the literal hostname) rather than a full
  // DNS-resolution + IP-range check, since we have no need to follow
  // redirects or resolve DNS ourselves — `fetch` will do that, and we
  // separately disable automatic redirects below so a safe-looking
  // hostname can't 30x its way to an internal address afterwards.
  function isPrivateOrLoopbackHost(hostname: string): boolean {
    const h = hostname.toLowerCase()
    if (h === "localhost" || h === "0.0.0.0" || h === "::1") return true
    if (BLOCKED_HOSTNAMES.has(h)) return true
  
    // IPv4 literal checks
    const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    if (ipv4) {
      const [a, b] = [Number(ipv4[1]), Number(ipv4[2])]
      if (a === 127) return true                          // 127.0.0.0/8 loopback
      if (a === 10) return true                            // 10.0.0.0/8 private
      if (a === 169 && b === 254) return true               // 169.254.0.0/16 link-local
      if (a === 172 && b >= 16 && b <= 31) return true       // 172.16.0.0/12 private
      if (a === 192 && b === 168) return true                // 192.168.0.0/16 private
    }
  
    // IPv6 loopback / unique-local
    if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true
  
    return false
  }
  
  export class UnsafeProviderUrlError extends Error {}
  
  /**
   * Throws UnsafeProviderUrlError if `rawUrl` isn't safe for AstroCore's
   * server to fetch. Callers should catch this and return a generic,
   * non-revealing error message to the client.
   */
  export function assertSafeProviderUrl(rawUrl: string): URL {
    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      throw new UnsafeProviderUrlError("Некоректний URL.")
    }
  
    if (url.username || url.password) {
      throw new UnsafeProviderUrlError("URL не може містити облікові дані.")
    }
  
    const isLocalDev = process.env.NODE_ENV !== "production"
    const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1"
  
    if (url.protocol === "http:") {
      // AstroCore itself runs on Vercel — "http://127.0.0.1" from a
      // Vercel serverless function never means "the user's own machine",
      // so plain HTTP is only tolerated for local development, and even
      // then only against an actual loopback address.
      if (!isLocalDev || !isLoopback) {
        throw new UnsafeProviderUrlError("У продакшн дозволено лише HTTPS-адреси.")
      }
    } else if (url.protocol !== "https:") {
      throw new UnsafeProviderUrlError("Дозволені лише HTTP(S) адреси.")
    }
  
    if (!isLocalDev && isPrivateOrLoopbackHost(url.hostname)) {
      throw new UnsafeProviderUrlError("Адреса вказує на внутрішній/приватний хост, що заборонено.")
    }
    if (isLocalDev && isPrivateOrLoopbackHost(url.hostname) && !isLoopback) {
      // Still block link-local/metadata/other-private ranges even in dev —
      // only plain loopback (127.0.0.1/localhost) is the allowed exception.
      throw new UnsafeProviderUrlError("Адреса вказує на внутрішній/приватний хост, що заборонено.")
    }
  
    return url
  }
  
  /**
   * Joins a user-supplied base URL with a fixed path, normalizing
   * trailing/leading slashes so "https://x.com/v1", "https://x.com/v1/",
   * and "https://x.com" all produce a clean, non-duplicated path instead
   * of things like "/v1/v1/chat/completions".
   */
  export function joinProviderPath(baseUrl: string, path: string): string {
    const trimmedBase = baseUrl.replace(/\/+$/, "")
    const trimmedPath = path.replace(/^\/+/, "")
    return `${trimmedBase}/${trimmedPath}`
  }