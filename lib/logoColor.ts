// lib/logoColor.ts
//
// Browser helpers for client logos:
//  - squeeze an uploaded image into a small square PNG/WebP (stored right in the database)
//  - find the logo's main brand colour, so the portal's colour matches the logo by itself.

export type LogoResult = { dataUrl: string; color: string | null }

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => res(img)
    img.onerror = () => rej(new Error("bad image"))
    img.src = src
  })
}

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("").toUpperCase()

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min, s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4
  return [h * 60, s, l]
}
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l)
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [f(0) * 255, f(8) * 255, f(4) * 255]
}

/** Main brand colour of an image, tuned to look good on a dark background. */
export function dominantColor(img: HTMLImageElement | HTMLCanvasElement): string | null {
  const N = 48
  const c = document.createElement("canvas")
  c.width = N; c.height = N
  const ctx = c.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(img, 0, 0, N, N)
  const px = ctx.getImageData(0, 0, N, N).data
  const bins = Array.from({ length: 24 }, () => ({ w: 0, r: 0, g: 0, b: 0 }))
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue
    const [h, s, l] = rgbToHsl(px[i], px[i + 1], px[i + 2])
    if (s < 0.22 || l < 0.12 || l > 0.92) continue          // skip greys, black, white
    const w = s * (1 - Math.abs(l - 0.5))
    const bin = bins[Math.floor(h / 15) % 24]
    bin.w += w; bin.r += px[i] * w; bin.g += px[i + 1] * w; bin.b += px[i + 2] * w
  }
  const best = bins.reduce((a, b) => (b.w > a.w ? b : a))
  if (best.w < 2) return null                                // logo is black/white only
  const [h, s, l] = rgbToHsl(best.r / best.w, best.g / best.w, best.b / best.w)
  const [r, g, b] = hslToRgb(h, Math.max(s, 0.55), Math.min(Math.max(l, 0.45), 0.6))
  return hex(r, g, b)
}

/** Reads a file, fits it into a 256×256 square and returns a small data URL + its colour. */
export async function fileToLogo(file: File): Promise<LogoResult> {
  if (!/^image\/(png|jpe?g|webp|gif|svg\+xml)$/.test(file.type)) throw new Error("type")
  if (file.size > 8 * 1024 * 1024) throw new Error("size")
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    const S = 256
    const c = document.createElement("canvas")
    c.width = S; c.height = S
    const ctx = c.getContext("2d")!
    const k = Math.min(S / img.naturalWidth, S / img.naturalHeight)
    const w = img.naturalWidth * k, h = img.naturalHeight * k
    ctx.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
    let dataUrl = c.toDataURL("image/webp", 0.9)
    if (!dataUrl.startsWith("data:image/webp")) dataUrl = c.toDataURL("image/png")
    return { dataUrl, color: dominantColor(c) }
  } finally {
    URL.revokeObjectURL(url)
  }
}
