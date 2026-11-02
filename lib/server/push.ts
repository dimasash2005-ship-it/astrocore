// lib/server/push.ts
//
// Web Push (notifications on the phone / desktop, like Telegram), with no extra
// libraries: VAPID signing (RFC 8292) + payload encryption aes128gcm (RFC 8291)
// built on Node's crypto. Works for Android Chrome, desktop browsers and iPhone
// (iOS 16.4+, only when AstroCore is added to the Home Screen).
//
// Env (set once in Vercel and .env.local):
//   VAPID_PUBLIC_KEY / NEXT_PUBLIC_VAPID_PUBLIC_KEY  — same value, base64url, 65 bytes
//   VAPID_PRIVATE_KEY                                — base64url, 32 bytes (secret!)
//   VAPID_SUBJECT                                    — mailto:you@example.com (optional)

import { createCipheriv, createECDH, createHmac, createPrivateKey, randomBytes, sign } from "crypto"
import { createClient as createServiceClient, type SupabaseClient } from "@supabase/supabase-js"

export type PushPayload = {
  title: string
  body: string
  url?: string        // page to open on tap
  tag?: string        // same tag replaces the previous notification (one per chat)
  icon?: string
}
export type PushSub = { endpoint: string; p256dh: string; auth: string }

const b64u = (b: Buffer) => b.toString("base64url")
const fromB64u = (s: string) => Buffer.from(s, "base64url")
const hmac = (key: Buffer, data: Buffer) => createHmac("sha256", key).update(data).digest()

export function pushConfigured(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
}

// ── RFC 8291: encrypt the payload for one subscription ──────────────────────
export function encryptPayload(
  plaintext: Buffer, uaPublicB64: string, authB64: string,
  fixed?: { asPrivate: Buffer; salt: Buffer },   // only for tests
): Buffer {
  const uaPublic = fromB64u(uaPublicB64)
  const authSecret = fromB64u(authB64)
  if (uaPublic.length !== 65 || authSecret.length !== 16) throw new Error("bad subscription keys")

  const ecdh = createECDH("prime256v1")
  if (fixed) ecdh.setPrivateKey(fixed.asPrivate); else ecdh.generateKeys()
  const asPublic = ecdh.getPublicKey()
  const ecdhSecret = ecdh.computeSecret(uaPublic)
  const salt = fixed?.salt ?? randomBytes(16)

  const prkKey = hmac(authSecret, ecdhSecret)
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic])
  const ikm = hmac(prkKey, Buffer.concat([keyInfo, Buffer.from([1])]))
  const prk = hmac(salt, ikm)
  const cek = hmac(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01")).subarray(0, 16)
  const nonce = hmac(prk, Buffer.from("Content-Encoding: nonce\0\x01")).subarray(0, 12)

  const cipher = createCipheriv("aes-128-gcm", cek, nonce)
  const body = Buffer.concat([cipher.update(Buffer.concat([plaintext, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()])

  const header = Buffer.alloc(16 + 4 + 1)
  salt.copy(header, 0)
  header.writeUInt32BE(4096, 16)
  header.writeUInt8(65, 20)
  return Buffer.concat([header, asPublic, body])
}

// ── RFC 8292: VAPID JWT for the push service ────────────────────────────────
function vapidAuth(endpoint: string): string {
  const pub = fromB64u(process.env.VAPID_PUBLIC_KEY!)
  const d = Buffer.concat([Buffer.alloc(32), fromB64u(process.env.VAPID_PRIVATE_KEY!)]).subarray(-32)
  const key = createPrivateKey({
    format: "jwk",
    key: { kty: "EC", crv: "P-256", d: b64u(d), x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
  })
  const aud = new URL(endpoint).origin
  const head = b64u(Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })))
  const claims = b64u(Buffer.from(JSON.stringify({
    aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: process.env.VAPID_SUBJECT || "mailto:astrocore.one@outlook.cz",
  })))
  const sig = sign("sha256", Buffer.from(`${head}.${claims}`), { key, dsaEncoding: "ieee-p1363" })
  return `vapid t=${head}.${claims}.${b64u(sig)}, k=${process.env.VAPID_PUBLIC_KEY}`
}

/** Sends to one device. Returns "gone" when the subscription is dead (unsubscribed / app removed). */
export async function sendPush(sub: PushSub, payload: PushPayload): Promise<"ok" | "gone" | "error"> {
  try {
    const u = new URL(sub.endpoint)
    if (u.protocol !== "https:") return "gone"
    const body = encryptPayload(Buffer.from(JSON.stringify(payload).slice(0, 3500)), sub.p256dh, sub.auth)
    const res = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        Authorization: vapidAuth(sub.endpoint),
        "Content-Encoding": "aes128gcm",
        "Content-Type": "application/octet-stream",
        TTL: "86400",
        Urgency: "high",
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })
    if (res.status === 404 || res.status === 410) return "gone"
    if (!res.ok) { console.error("[push]", res.status, (await res.text().catch(() => "")).slice(0, 200)); return "error" }
    return "ok"
  } catch (e) {
    console.error("[push]", e instanceof Error ? e.message : e)
    return "error"
  }
}

let _svc: SupabaseClient | null = null
export function pushService(): SupabaseClient {
  if (_svc) return _svc
  _svc = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  return _svc
}

/** Sends to every device of the user that turned notifications on. Never throws. */
export async function pushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushConfigured()) return 0
  try {
    const sb = pushService()
    const { data } = await sb.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).limit(20)
    let sent = 0
    for (const s of data ?? []) {
      const r = await sendPush(s as PushSub, { icon: "/icons/icon-192.png", ...payload })
      if (r === "ok") sent++
      if (r === "gone") await sb.from("push_subscriptions").delete().eq("id", s.id)
    }
    return sent
  } catch (e) {
    console.error("[push] pushToUser", e instanceof Error ? e.message : e)
    return 0
  }
}

/** Short plain text from markdown, for the notification body. */
export function pushExcerpt(md: string, max = 160): string {
  const t = String(md || "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "🖼")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/[#>*_`~|]/g, "")
    .replace(/\s+/g, " ")
    .trim()
  return t.length > max ? t.slice(0, max - 1) + "…" : t
}
