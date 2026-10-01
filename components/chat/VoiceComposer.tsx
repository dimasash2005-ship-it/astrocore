"use client"

// components/chat/VoiceComposer.tsx
//
// Telegram-style voice recorder that replaces the message box while
// recording.
//
//  • tap the mic        → recording stays on ("locked"), send with ➤
//  • hold the mic       → release sends right away (like TG)
//  • live waveform + timer, pause / resume
//  • live speech-to-text while you talk (browser Web Speech API,
//    auto-restarted so long recordings keep being transcribed)
//  • up to MAX_SECONDS per message
//
// It only records. Uploading / server transcription / sending is done
// by the chat page in onSend().

import { useEffect, useRef, useState, useCallback } from "react"
import { Trash2, Pause, Play, Send, Type } from "lucide-react"

export type VoiceDraft = {
  blob:     Blob
  mimeType: string
  duration: number   // seconds
  peaks:    number[] // 0..1, PEAK_COUNT values — the bubble waveform
  liveText: string   // what the browser recognised while recording
}

export const PEAK_COUNT  = 56
export const MAX_SECONDS = 30 * 60
const MIN_SECONDS        = 0.7   // shorter = accidental tap, dropped like in TG
const HOLD_MS            = 450   // pressed longer than this = hold mode

const C = {
  s1:  "#11111C",
  t1:  "#F0EDF8",
  t3:  "#A8A4BC",
  t4:  "#585878",
  red: "#E8002A",
}

type SpeechRec = {
  lang: string
  interimResults: boolean
  continuous: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort?: () => void
  onresult: ((event: any) => void) | null
  onerror:  ((event: any) => void) | null
  onend:    (() => void) | null
}
type SpeechCtor = new () => SpeechRec

function speechCtor(): SpeechCtor | undefined {
  if (typeof window === "undefined") return undefined
  const w = window as any
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

function pickMime(): string {
  if (typeof MediaRecorder === "undefined") return ""
  const list = ["audio/webm;codecs=opus", "audio/ogg;codecs=opus", "audio/mp4", "audio/webm"]
  return list.find(m => { try { return MediaRecorder.isTypeSupported(m) } catch { return false } }) ?? ""
}

export function fmtDuration(sec: number): string {
  const s = Math.max(0, Math.floor(sec))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

// Squash every level sampled during recording into PEAK_COUNT bars, normalised.
function toPeaks(levels: number[]): number[] {
  if (levels.length === 0) return Array(PEAK_COUNT).fill(0.08)
  const out: number[] = []
  for (let i = 0; i < PEAK_COUNT; i++) {
    const a = Math.floor((i * levels.length) / PEAK_COUNT)
    const b = Math.max(a + 1, Math.floor(((i + 1) * levels.length) / PEAK_COUNT))
    let m = 0
    for (let j = a; j < b && j < levels.length; j++) m = Math.max(m, levels[j])
    out.push(m)
  }
  const max = Math.max(...out, 0.0001)
  return out.map(v => Math.round(Math.max(0.08, Math.min(1, v / max)) * 100) / 100)
}

type Props = {
  lang:      "uk" | "en"
  /** Date.now() of the pointerdown that opened the recorder, 0 if opened by keyboard. */
  pressedAt: number
  onSend:    (draft: VoiceDraft) => void
  onToText:  (draft: VoiceDraft) => void
  onCancel:  () => void
  onError:   (message: string) => void
}

export default function VoiceComposer({ lang, pressedAt, onSend, onToText, onCancel, onError }: Props) {
  const uk = lang === "uk"

  const [phase,   setPhase]   = useState<"starting" | "recording" | "paused" | "finishing">("starting")
  const [elapsed, setElapsed] = useState(0)
  const [holding, setHolding] = useState(pressedAt > 0)
  const [live,    setLive]    = useState({ final: "", interim: "" })
  const [liveOn,  setLiveOn]  = useState(!!speechCtor())

  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const recRef      = useRef<MediaRecorder | null>(null)
  const chunksRef   = useRef<Blob[]>([])
  const ctxRef      = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef      = useRef(0)
  const levelsRef   = useRef<number[]>([])    // everything, for the final peaks
  const recentRef   = useRef<number[]>([])    // last bars on screen
  const speechRef   = useRef<SpeechRec | null>(null)
  const finalTxtRef = useRef("")
  const interimRef  = useRef("")
  const phaseRef    = useRef(phase)
  const doneRef     = useRef(false)           // finished or cancelled — stop everything
  const pendingRef  = useRef<null | "send" | "text">(null)

  // Recording time excluding pauses.
  const accRef      = useRef(0)               // ms recorded before the current run
  const runStartRef = useRef(0)               // when the current run started (0 = paused)

  phaseRef.current = phase

  const currentMs = useCallback(
    () => accRef.current + (runStartRef.current ? performance.now() - runStartRef.current : 0),
    [],
  )

  // ── live transcription ────────────────────────────────────────
  const startSpeech = useCallback(() => {
    const Ctor = speechCtor()
    if (!Ctor || doneRef.current) return
    try {
      const rec = new Ctor()
      rec.lang = uk ? "uk-UA" : "en-US"
      rec.continuous = true
      rec.interimResults = true
      rec.maxAlternatives = 1
      rec.onresult = (ev: any) => {
        if (speechRef.current !== rec) return // stopped: its interim words were already kept
        let interim = ""
        for (let i = ev.resultIndex; i < ev.results.length; i++) {
          const r = ev.results[i]
          const txt = r[0]?.transcript ?? ""
          if (r.isFinal) finalTxtRef.current = (finalTxtRef.current + " " + txt).replace(/\s+/g, " ").trim()
          else interim += txt
        }
        interimRef.current = interim.trim()
        setLive({ final: finalTxtRef.current, interim: interimRef.current })
      }
      rec.onerror = (ev: any) => {
        const err = ev?.error
        if (err === "not-allowed" || err === "service-not-allowed" || err === "audio-capture" || err === "language-not-supported") {
          speechRef.current = null
          setLiveOn(false)
        }
      }
      // Chrome stops recognition after silence / ~1 min — restart while we still record.
      rec.onend = () => {
        if (speechRef.current !== rec) return
        speechRef.current = null
        // keep words that never became "final" before the restart
        if (interimRef.current) {
          finalTxtRef.current = (finalTxtRef.current + " " + interimRef.current).trim()
          interimRef.current = ""
        }
        setLive({ final: finalTxtRef.current, interim: "" })
        if (!doneRef.current && phaseRef.current === "recording") setTimeout(startSpeech, 150)
      }
      speechRef.current = rec
      rec.start()
    } catch {
      speechRef.current = null
    }
  }, [uk])

  const stopSpeech = useCallback(() => {
    const rec = speechRef.current
    speechRef.current = null
    try { rec?.stop() } catch {}
    if (interimRef.current) {
      finalTxtRef.current = (finalTxtRef.current + " " + interimRef.current).trim()
      interimRef.current = ""
      setLive({ final: finalTxtRef.current, interim: "" })
    }
  }, [])

  // ── teardown ──────────────────────────────────────────────────
  const releaseAll = useCallback(() => {
    doneRef.current = true
    cancelAnimationFrame(rafRef.current)
    stopSpeech()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    ctxRef.current?.close().catch(() => {})
    ctxRef.current = null
  }, [stopSpeech])

  // ── finish: build the draft ───────────────────────────────────
  const finish = useCallback((mode: "send" | "text") => {
    if (doneRef.current || phaseRef.current === "finishing") return
    const rec = recRef.current
    if (!rec || phaseRef.current === "starting") { pendingRef.current = mode; return }

    const duration = currentMs() / 1000
    runStartRef.current = 0
    setPhase("finishing")

    // Give recognition a moment to flush its last words.
    const textBeforeStop = [finalTxtRef.current, interimRef.current].filter(Boolean).join(" ").trim()

    rec.onstop = () => {
      const mimeType = rec.mimeType || chunksRef.current[0]?.type || "audio/webm"
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const liveText = (finalTxtRef.current.length >= textBeforeStop.length ? finalTxtRef.current : textBeforeStop).trim()
      releaseAll()
      if (duration < MIN_SECONDS || blob.size === 0) { onCancel(); return }
      const draft: VoiceDraft = { blob, mimeType, duration, peaks: toPeaks(levelsRef.current), liveText }
      if (mode === "text") onToText(draft)
      else onSend(draft)
    }
    try { if (rec.state === "paused") rec.resume() } catch {}
    try { rec.requestData() } catch {}
    stopSpeech()
    // small delay so the recogniser can deliver its final result
    setTimeout(() => { try { rec.stop() } catch { rec.onstop?.(new Event("stop")) } }, 250)
  }, [currentMs, onCancel, onSend, onToText, releaseAll, stopSpeech])

  const cancel = useCallback(() => {
    const rec = recRef.current
    if (rec) { rec.onstop = null; try { rec.stop() } catch {} }
    releaseAll()
    onCancel()
  }, [onCancel, releaseAll])

  const togglePause = useCallback(() => {
    const rec = recRef.current
    if (!rec) return
    if (phaseRef.current === "recording") {
      try { rec.pause() } catch { return }
      accRef.current = currentMs()
      runStartRef.current = 0
      stopSpeech()
      setPhase("paused")
    } else if (phaseRef.current === "paused") {
      try { rec.resume() } catch { return }
      runStartRef.current = performance.now()
      setPhase("recording")
      phaseRef.current = "recording"
      startSpeech()
    }
  }, [currentMs, startSpeech, stopSpeech])

  // ── start on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    // React dev (Strict Mode) mounts twice: reset so the 2nd mount really starts.
    doneRef.current = false
    chunksRef.current = []

    async function start() {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
        onError(uk ? "Запис голосу не підтримується у цьому браузері." : "Voice recording isn't supported in this browser.")
        return
      }
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } catch (e: any) {
        const denied = e?.name === "NotAllowedError" || e?.name === "SecurityError"
        onError(denied
          ? (uk ? "Немає доступу до мікрофона. Дозвольте його в налаштуваннях браузера." : "No microphone access. Allow it in your browser settings.")
          : (uk ? "Не вдалося увімкнути мікрофон." : "Couldn't start the microphone."))
        return
      }
      if (cancelled || doneRef.current) { stream.getTracks().forEach(t => t.stop()); return }
      streamRef.current = stream

      const mimeType = pickMime()
      let rec: MediaRecorder
      try {
        rec = new MediaRecorder(stream, { ...(mimeType ? { mimeType } : {}), audioBitsPerSecond: 32_000 })
      } catch {
        rec = new MediaRecorder(stream)
      }
      rec.ondataavailable = e => { if (e.data && e.data.size > 0) chunksRef.current.push(e.data) }
      recRef.current = rec

      // Level meter for the waveform.
      try {
        const Ctx = window.AudioContext ?? (window as any).webkitAudioContext
        const ctx: AudioContext = new Ctx()
        const src = ctx.createMediaStreamSource(stream)
        const an = ctx.createAnalyser()
        an.fftSize = 1024
        src.connect(an)
        ctxRef.current = ctx
        analyserRef.current = an
      } catch {}

      rec.start(1000)
      runStartRef.current = performance.now()
      phaseRef.current = "recording"
      setPhase("recording")
      startSpeech()

      if (pendingRef.current) { const m = pendingRef.current; pendingRef.current = null; finish(m) }
    }

    start()
    return () => {
      cancelled = true
      if (!doneRef.current) {
        const rec = recRef.current
        if (rec) { rec.onstop = null; try { rec.stop() } catch {} }
        releaseAll()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── hold-to-record: release sends ─────────────────────────────
  useEffect(() => {
    if (!pressedAt) return
    function up() {
      setHolding(false)
      if (Date.now() - pressedAt >= HOLD_MS) finish("send")
      // short tap → stays recording (locked), like TG
    }
    window.addEventListener("pointerup", up, { once: true })
    window.addEventListener("pointercancel", up, { once: true })
    return () => {
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── keyboard: Enter = send, Esc = cancel, Space = pause ───────
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (e.key === "Escape")      { e.preventDefault(); cancel() }
      else if (e.key === "Enter")  { e.preventDefault(); finish("send") }
      else if (e.key === " " && !(e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement)) {
        e.preventDefault(); togglePause()
      }
    }
    window.addEventListener("keydown", key)
    return () => window.removeEventListener("keydown", key)
  }, [cancel, finish, togglePause])

  // ── timer + waveform loop (component-local, the page doesn't re-render) ──
  useEffect(() => {
    let lastSample = 0
    let lastTick = 0
    const buf = new Uint8Array(1024)

    function frame(now: number) {
      if (doneRef.current) return
      const an = analyserRef.current
      const recording = phaseRef.current === "recording"

      if (an && recording && now - lastSample > 70) {
        lastSample = now
        an.getByteTimeDomainData(buf)
        let sum = 0
        for (let i = 0; i < buf.length; i++) { const v = (buf[i] - 128) / 128; sum += v * v }
        const rms = Math.sqrt(sum / buf.length)
        const level = Math.min(1, rms * 4.5)
        levelsRef.current.push(level)
        recentRef.current.push(level)
        if (recentRef.current.length > 200) recentRef.current.shift()
      }

      if (now - lastTick > 200) {
        lastTick = now
        const sec = currentMs() / 1000
        setElapsed(sec)
        if (sec >= MAX_SECONDS) finish("send")
      }

      const cv = canvasRef.current
      if (cv) {
        const dpr = window.devicePixelRatio || 1
        const w = cv.clientWidth, h = cv.clientHeight
        if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
          cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr)
        }
        const g = cv.getContext("2d")
        if (g) {
          g.setTransform(dpr, 0, 0, dpr, 0, 0)
          g.clearRect(0, 0, w, h)
          const step = 4, bw = 2.5
          const n = Math.floor(w / step)
          const data = recentRef.current.slice(-n)
          const offset = w - data.length * step
          for (let i = 0; i < data.length; i++) {
            const bh = Math.max(3, data[i] * (h - 4))
            const x = offset + i * step
            const age = (data.length - i) / n
            g.fillStyle = recording ? `rgba(232,0,42,${0.95 - age * 0.55})` : `rgba(168,164,188,${0.7 - age * 0.4})`
            g.beginPath()
            if (typeof g.roundRect === "function") g.roundRect(x, (h - bh) / 2, bw, bh, 1.25)
            else g.rect(x, (h - bh) / 2, bw, bh)
            g.fill()
          }
        }
      }
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [currentMs, finish])

  const recording = phase === "recording"
  const paused    = phase === "paused"
  const busy      = phase === "starting" || phase === "finishing"
  const locked    = phase === "finishing"
  const liveText  = [live.final, live.interim].filter(Boolean).join(" ")
  const nearLimit = elapsed > MAX_SECONDS - 60

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, animation: "popIn 160ms cubic-bezier(.2,.9,.3,1.2)" }}>
      <style>{`.vc-btn:hover:not(:disabled){filter:brightness(1.6)} .vc-btn:active:not(:disabled){transform:scale(.92)} .vc-btn:disabled{opacity:.45;cursor:default}`}</style>
      {/* Live transcript */}
      {liveOn && liveText && (
        <div style={{
          padding: "9px 14px", borderRadius: 14,
          background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.08)",
          fontSize: 13, lineHeight: 1.55, color: C.t3, maxHeight: 92, overflowY: "auto",
          display: "flex", flexDirection: "column-reverse",
        }}>
          <div>
            <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: recording ? C.red : C.t4, marginRight: 8 }}>
              {uk ? "Наживо" : "Live"}
            </span>
            <span style={{ color: "#D8D4E8" }}>{live.final}</span>
            {live.interim && <span style={{ color: C.t4 }}> {live.interim}</span>}
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {/* Cancel */}
        <button type="button" onClick={cancel} title={uk ? "Скасувати (Esc)" : "Cancel (Esc)"} style={roundBtn(false)} className="vc-btn"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = C.t3 }}
        >
          <Trash2 size={16} />
        </button>

        <div style={{
          flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: 10,
          background: C.s1, border: "1px solid rgba(232,0,42,0.30)", borderRadius: 26,
          padding: "8px 8px 8px 16px",
          boxShadow: "0 0 0 3px rgba(232,0,42,0.06), 0 8px 32px rgba(0,0,0,0.4)",
        }}>
          <span style={{
            width: 9, height: 9, borderRadius: "50%", flexShrink: 0,
            background: recording ? C.red : C.t4,
            boxShadow: recording ? "0 0 8px rgba(232,0,42,0.9)" : "none",
            animation: recording ? "redpulse 1.2s ease infinite" : undefined,
          }} />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: nearLimit ? "#FF4D6A" : C.t1, minWidth: 40, flexShrink: 0 }}>
            {fmtDuration(elapsed)}
          </span>

          <div style={{ flex: 1, minWidth: 0, height: 30, position: "relative" }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
            {(holding || busy) && (
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                <span style={{ fontSize: 11.5, color: C.t3, background: "rgba(17,17,28,0.85)", padding: "2px 10px", borderRadius: 10 }}>
                  {phase === "starting" ? (uk ? "вмикаю мікрофон…" : "starting mic…")
                    : phase === "finishing" ? (uk ? "готую…" : "preparing…")
                    : (uk ? "відпустіть — надішлеться" : "release to send")}
                </span>
              </div>
            )}
          </div>

          <button type="button" onClick={togglePause} disabled={locked || phase === "starting"} title={paused ? (uk ? "Продовжити" : "Resume") : (uk ? "Пауза" : "Pause")} style={smallBtn(paused)} className="vc-btn">
            {paused ? <Play size={15} /> : <Pause size={15} />}
          </button>
          <button type="button" onClick={() => finish("text")} disabled={locked} title={uk ? "Перетворити на текст (відредагувати перед відправкою)" : "Turn into text (edit before sending)"} style={smallBtn(false)} className="vc-btn">
            <Type size={15} />
          </button>
          <button type="button" onClick={() => finish("send")} disabled={locked} title={uk ? "Надіслати (Enter)" : "Send (Enter)"} className="vc-btn" style={{
            width: 34, height: 34, borderRadius: "50%", flexShrink: 0, border: "none",
            background: C.red, cursor: locked ? "default" : "pointer", opacity: locked ? 0.6 : 1,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 18px rgba(232,0,42,0.40)",
          }}>
            <Send size={14} style={{ color: "#fff", marginLeft: 1 }} />
          </button>
        </div>
      </div>
    </div>
  )
}

function roundBtn(active: boolean): React.CSSProperties {
  return {
    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
    background: active ? "rgba(232,0,42,0.16)" : C.s1,
    border: "1px solid rgba(255,255,255,0.10)", color: C.t3,
    transition: "color 150ms ease",
  }
}

function smallBtn(active: boolean): React.CSSProperties {
  return {
    width: 34, height: 34, borderRadius: "50%", flexShrink: 0, cursor: "pointer",
    border: "1px solid rgba(255,255,255,0.12)",
    background: active ? "rgba(232,0,42,0.22)" : "rgba(255,255,255,0.07)",
    color: active ? "#FF5A74" : C.t1,
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 120ms ease, transform 80ms ease",
  }
}