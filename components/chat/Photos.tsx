"use client"

// components/chat/Photos.tsx
//
// Photos in chat, Telegram-style:
//  • splitImages()   — pulls ![name](data:image/…) out of a message so the
//                      photos are shown as photos and the text as text
//  • PhotoGrid       — 1 photo = big, 2+ = tidy grid; tap → full screen
//  • PhotoViewer     — full-screen viewer: ← → / swipe, Esc / tap to close
//  • compressImage() — shrinks a picked photo before sending (max 1600px,
//                      JPEG) so messages stay light and the agent reads them fast
//
// The message format doesn't change (images stay as markdown data URLs), so
// the server keeps turning them into real image input for the model.

import { useEffect, useState, useCallback } from "react"
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react"

export type ChatImage = { alt: string; src: string }

const IMG_RE = /!\[([^\]]*)\]\((data:image\/[a-zA-Z0-9+.\-]+;base64,[A-Za-z0-9+/=]+|https?:\/\/[^\s)]+)\)/g

export function splitImages(content: string): { text: string; images: ChatImage[] } {
  if (!content || !content.includes("![")) return { text: content, images: [] }
  const images: ChatImage[] = []
  const text = content.replace(IMG_RE, (_m, alt: string, src: string) => {
    images.push({ alt, src })
    return ""
  }).replace(/\n{3,}/g, "\n\n").trim()
  return { text, images }
}

// ── grid ─────────────────────────────────────────────────────────

export function PhotoGrid({ images }: { images: ChatImage[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const n = images.length
  const cols = n === 1 ? 1 : n === 2 || n === 4 ? 2 : 3

  return (
    <>
      <div style={{
        display: "grid", gap: 3, gridTemplateColumns: `repeat(${cols}, 1fr)`,
        width: n === 1 ? "auto" : "min(420px, 100%)",
        borderRadius: 14, overflow: "hidden",
      }}>
        {images.map((img, i) => (
          <button key={i} type="button" onClick={() => setOpen(i)} title={img.alt}
            style={{ padding: 0, border: "none", background: "rgba(255,255,255,0.04)", cursor: "zoom-in", display: "block", lineHeight: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.src} alt={img.alt} loading="lazy" draggable={false} style={n === 1
              ? { display: "block", maxWidth: "min(420px, 100%)", maxHeight: 460, width: "auto", height: "auto", objectFit: "contain" }
              : { display: "block", width: "100%", aspectRatio: "1 / 1", objectFit: "cover" }} />
          </button>
        ))}
      </div>
      {open !== null && <PhotoViewer images={images} start={open} onClose={() => setOpen(null)} />}
    </>
  )
}

// ── full screen viewer ───────────────────────────────────────────

export function PhotoViewer({ images, start, onClose }: { images: ChatImage[]; start: number; onClose: () => void }) {
  const [i, setI] = useState(start)
  const [touchX, setTouchX] = useState<number | null>(null)
  const many = images.length > 1
  const prev = useCallback(() => setI(v => (v - 1 + images.length) % images.length), [images.length])
  const next = useCallback(() => setI(v => (v + 1) % images.length), [images.length])

  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
      else if (e.key === "ArrowLeft" && many) prev()
      else if (e.key === "ArrowRight" && many) next()
    }
    window.addEventListener("keydown", key)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", key); document.body.style.overflow = overflow }
  }, [many, next, prev, onClose])

  const img = images[i]
  const btn: React.CSSProperties = {
    width: 42, height: 42, borderRadius: "50%", border: "none", cursor: "pointer",
    background: "rgba(255,255,255,0.10)", color: "#fff",
    display: "flex", alignItems: "center", justifyContent: "center",
  }

  return (
    <div onClick={onClose}
      onTouchStart={e => setTouchX(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (touchX === null || !many) return
        const dx = e.changedTouches[0].clientX - touchX
        if (Math.abs(dx) > 50) { dx > 0 ? prev() : next() }
        setTouchX(null)
      }}
      style={{
        position: "fixed", inset: 0, zIndex: 1000, background: "rgba(4,4,8,0.94)",
        display: "flex", alignItems: "center", justifyContent: "center",
        animation: "popIn 160ms ease-out",
      }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={img.src} alt={img.alt} onClick={e => e.stopPropagation()}
        style={{ maxWidth: "94vw", maxHeight: "86vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 20px 80px rgba(0,0,0,0.6)" }} />

      <div style={{ position: "absolute", top: 14, right: 14, display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
        <a href={img.src} download={img.alt || "photo"} style={{ ...btn, textDecoration: "none" }} title="Download">
          <Download size={18} />
        </a>
        <button type="button" onClick={onClose} style={btn} title="Close (Esc)"><X size={20} /></button>
      </div>

      {many && (
        <>
          <button type="button" onClick={e => { e.stopPropagation(); prev() }} style={{ ...btn, position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)" }}><ChevronLeft size={22} /></button>
          <button type="button" onClick={e => { e.stopPropagation(); next() }} style={{ ...btn, position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}><ChevronRight size={22} /></button>
          <div style={{ position: "absolute", bottom: 18, left: 0, right: 0, textAlign: "center", fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#C8C4D8" }}>
            {i + 1} / {images.length}
          </div>
        </>
      )}
    </div>
  )
}

// ── shrink before sending ────────────────────────────────────────

const MAX_SIDE = 1600

export async function compressImage(file: File): Promise<string> {
  const original = await new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
  // GIFs (animation) and SVGs stay as they are.
  if (/image\/(gif|svg)/.test(file.type)) return original
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = reject
      el.src = original
    })
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))
    const canvas = document.createElement("canvas")
    canvas.width = w; canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) return original
    // PNGs with transparency keep it; everything else becomes a light JPEG.
    const keepPng = file.type === "image/png" && file.size < 600_000
    if (!keepPng) { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h) }
    ctx.drawImage(img, 0, 0, w, h)
    const out = keepPng ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.85)
    return out.length < original.length ? out : original
  } catch {
    return original
  }
}