import { createCipheriv, createDecipheriv, randomBytes, createHash } from "crypto"

// Server-only. Never import this from a "use client" file or ship it
// to the browser — it reads PROVIDER_ENCRYPTION_KEY straight from the
// server environment.
//
// Format of an encrypted string: base64(iv) + "." + base64(authTag) + "." + base64(ciphertext)
// AES-256-GCM: 12-byte random IV per encryption, 16-byte auth tag.

const ALGO = "aes-256-gcm"
const IV_LENGTH = 12

function getKey(): Buffer {
  const raw = process.env.PROVIDER_ENCRYPTION_KEY
  if (!raw) {
    throw new Error("PROVIDER_ENCRYPTION_KEY is not set on the server.")
  }
  // Accept the key as-is if it's already 32 bytes (hex/base64), or
  // derive a stable 32-byte key from whatever string was provided —
  // this means literally any secret string works as the env var
  // without the deploy needing to generate a perfectly-formatted key.
  const asHex = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : null
  if (asHex) return asHex
  return createHash("sha256").update(raw).digest()
}

export function encryptSecret(plainText: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString("base64")}.${authTag.toString("base64")}.${encrypted.toString("base64")}`
}

export function decryptSecret(encrypted: string): string {
  const key = getKey()
  const parts = encrypted.split(".")
  if (parts.length !== 3) {
    throw new Error("Malformed encrypted secret.")
  }
  const [ivB64, authTagB64, dataB64] = parts
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const data = Buffer.from(dataB64, "base64")

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString("utf8")
}

// Safe-for-client display: never sends the real key anywhere.
export function maskSecret(plainText: string): string {
  if (!plainText) return "—"
  if (plainText.length <= 8) return "•".repeat(plainText.length)
  return plainText.slice(0, 6) + "•".repeat(Math.min(plainText.length - 8, 16)) + plainText.slice(-4)
}