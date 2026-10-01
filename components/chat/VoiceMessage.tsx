"use client"

// components/chat/VoiceMessage.tsx
//
// Voice bubble in the chat (Telegram-style): play / pause, waveform
// with progress you can click to seek, 1× / 1.5× / 2× speed, and the
// text that was sent to the agent behind a "Текст" toggle.
//
// The audio lives in the private Supabase Storage bucket "voice".
// A short-lived signed URL is requested only on the first play.

import { useEffect, useRef, useState } from "react"
import { Play, Pause, RotateCcw, AlertCircle } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { fmtDuration } from "./VoiceComposer"

export type VoiceInfo = {
  path?:         string | null   // storage path in bucket "voice"
  localUrl?:     string          // blob: URL right after recording
  duration:      number          // seconds
  peaks:         number[]        // 0..1
  transcribing?: boolean
  failed?:       boolean
}

const RATES = [1, 1.5, 2]

export default function VoiceMessage({ voice, text, lang }: { voice: VoiceInfo; text: string; lang: "uk" | "en" }) {
  const uk = lang === "uk"
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef   = useRef(0)

  const [playing,  setPlaying]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState("")
  const [pos,      setPos]      = useState(0)       // seconds
  const [rate,     setRate]     = useState(1)
  const [showText, setShowText] = useState(false)

  const duration = voice.duration > 0 ? voice.duration : 1
  const progress = Math.min(1, pos / duration)
  const peaks = voice.peaks?.length ? voice.peaks : Array(40).fill(0.2)

  useEffect(() => () => {
    cancelAnimationFrame(rafRef.current)
    audioRef.current?.pause()
  }, [])

  async function ensureAudio(): Promise<HTMLAudioElement | null> {
    if (audioRef.current) return audioRef.current
    let src = voice.localUrl
    if (!src && voice.path) {
      setLoading(true)
      const { data, error: e } = await getSupabase().storage.from("voice").createSignedUrl(voice.path, 60 * 60)
      setLoading(false)
      if (e || !data?.signedUrl) { setError(uk ? "Не вдалося завантажити аудіо" : "Couldn't load audio"); return null }
      src = data.signedUrl
    }
    if (!src) return null
    const a = new Audio(src)
    a.preload = "auto"
    a.playbackRate = rate
    a.onended = () => { setPlaying(false); setPos(0); cancelAnimationFrame(rafRef.current) }
    a.onpause = () => setPlaying(false)
    a.onplay  = () => setPlaying(true)
    a.onerror = () => { setPlaying(false); setError(uk ? "Аудіо недоступне" : "Audio unavailable") }
    audioRef.current = a
    return a
  }

  function tick() {
    const a = audioRef.current
    if (!a) return
    setPos(a.currentTime)
    if (!a.paused) rafRef.current = requestAnimationFrame(tick)
  }

  async function toggle() {
    setError("")
    const a = await ensureAudio()
    if (!a) return
    if (a.paused) {
      // Pause any other voice message that's playing.
      window.dispatchEvent(new CustomEvent("astrocore-voice-play", { detail: a }))
      try { await a.play() } catch { setError(uk ? "Не вдалося відтворити" : "Couldn't play"); return }
      rafRef.current = requestAnimationFrame(tick)
    } else {
      a.pause()
    }
  }

  useEffect(() => {
    function other(e: Event) {
      const a = audioRef.current
      if (a && (e as CustomEvent).detail !== a && !a.paused) a.pause()
    }
    window.addEventListener("astrocore-voice-play", other)
    return () => window.removeEventListener("astrocore-voice-play", other)
  }, [])

  async function seek(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    const a = await ensureAudio()
    if (!a) return
    const target = frac * duration
    try { a.currentTime = target } catch {}
    setPos(target)
    if (a.paused) {
      window.dispatchEvent(new CustomEvent("astrocore-voice-play", { detail: a }))
      try { await a.play(); rafRef.current = requestAnimationFrame(tick) } catch {}
    }
  }

  function cycleRate() {
    const next = RATES[(RATES.indexOf(rate) + 1) % RATES.length]
    setRate(next)
    if (audioRef.current) audioRef.current.playbackRate = next
  }

  const hasText = !!text.trim() && !voice.transcribing

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 240, maxWidth: 380 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
        <button onClick={toggle} title={playing ? (uk ? "Пауза" : "Pause") : (uk ? "Слухати" : "Play")} style={{
          width: 38, height: 38, borderRadius: "50%", flexShrink: 0, border: "none", cursor: "pointer",
          background: "#E8002A", boxShadow: "0 0 14px rgba(232,0,42,0.45)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {loading
            ? <RotateCcw size={15} style={{ color: "#fff", animation: "spin 0.8s linear infinite" }} />
            : playing
              ? <Pause size={16} style={{ color: "#fff" }} fill="#fff" />
              : <Play size={16} style={{ color: "#fff", marginLeft: 2 }} fill="#fff" />}
        </button>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 4 }}>
          <div onClick={seek} style={{ height: 26, display: "flex", alignItems: "center", gap: 2, cursor: "pointer" }}>
            {peaks.map((p, i) => {
              const played = (i + 0.5) / peaks.length <= progress
              return (
                <span key={i} style={{
                  flex: 1, minWidth: 1.5, maxWidth: 3.5, borderRadius: 2,
                  height: `${Math.max(12, p * 100)}%`,
                  background: played ? "#FF5A74" : "rgba(240,237,248,0.32)",
                  transition: "background 80ms linear",
                }} />
              )
            })}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5, color: "#A8A4BC" }}>
            <span>{playing || pos > 0 ? fmtDuration(pos) : fmtDuration(voice.duration)}</span>
            {voice.transcribing && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#C8C4D8" }}>
                <RotateCcw size={10} style={{ animation: "spin 0.9s linear infinite" }} />
                {uk ? "розпізнаю…" : "transcribing…"}
              </span>
            )}
            {error && <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#FF4D6A" }}><AlertCircle size={10} />{error}</span>}
          </div>
        </div>

        <button onClick={cycleRate} title={uk ? "Швидкість" : "Speed"} style={pill(rate !== 1)}>
          {rate}×
        </button>
        {hasText && (
          <button onClick={() => setShowText(v => !v)} title={uk ? "Показати текст, який отримав агент" : "Show the text the agent received"} style={pill(showText)}>
            {uk ? "Текст" : "Text"}
          </button>
        )}
      </div>

      {showText && hasText && (
        <div style={{
          fontSize: 13.5, lineHeight: 1.6, color: "#E4E0F0", whiteSpace: "pre-wrap", wordBreak: "break-word",
          padding: "8px 2px 2px", borderTop: "0.5px solid rgba(255,255,255,0.10)",
        }}>
          {text}
        </div>
      )}
    </div>
  )
}

function pill(active: boolean): React.CSSProperties {
  return {
    flexShrink: 0, padding: "3px 8px", borderRadius: 8, cursor: "pointer",
    fontFamily: "'JetBrains Mono', monospace", fontSize: 10.5,
    background: active ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.06)",
    border: "0.5px solid rgba(255,255,255,0.12)",
    color: active ? "#F0EDF8" : "#A8A4BC",
  }
}