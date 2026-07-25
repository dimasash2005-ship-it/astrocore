// Server-only. A thin wrapper around fetch() for requests AstroCore's
// server makes to a user-supplied external endpoint (a "Custom /
// Webhook" AI agent). Bundles the three defensive measures the SSRF
// checklist calls for beyond URL validation itself:
//   1. A hard timeout (the endpoint is untrusted — it must not be able
//      to hang a request indefinitely).
//   2. No automatic redirect following (a safe-looking URL shouldn't be
//      able to 30x its way to an internal address after the fact).
//   3. A response size cap (an untrusted endpoint must not be able to
//      exhaust memory by streaming back gigabytes of data).

const DEFAULT_TIMEOUT_MS = 25_000
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024 // 2MB is generous for a chat completion

export class SafeFetchError extends Error {}

export async function safeFetch(
  url: string,
  init: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...rest } = init

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  let res: Response
  try {
    res = await fetch(url, {
      ...rest,
      redirect: "manual", // a 3xx comes back as an opaqueredirect response instead of being followed
      signal: controller.signal,
    })
  } catch (err) {
    if (controller.signal.aborted) {
      throw new SafeFetchError("Час очікування відповіді вичерпано.")
    }
    throw new SafeFetchError("Не вдалося з'єднатися з ендпоінтом.")
  } finally {
    clearTimeout(timer)
  }

  if (res.type === "opaqueredirect" || (res.status >= 300 && res.status < 400)) {
    throw new SafeFetchError("Ендпоінт повернув редирект, що заборонено з міркувань безпеки.")
  }

  return res
}

/** Reads a Response body as text, enforcing a hard byte cap. */
export async function readCappedText(res: Response, maxBytes = MAX_RESPONSE_BYTES): Promise<string> {
  const reader = res.body?.getReader()
  if (!reader) return res.text()

  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    if (value) {
      total += value.byteLength
      if (total > maxBytes) {
        reader.cancel()
        throw new SafeFetchError("Відповідь ендпоінта перевищує допустимий розмір.")
      }
      chunks.push(value)
    }
  }
  return Buffer.concat(chunks.map(c => Buffer.from(c))).toString("utf8")
}