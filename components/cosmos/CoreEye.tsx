"use client"

// The living AstroCore Core: a glowing red eye in orbit rings.
// mood: idle · thinking (rings speed up, pupil narrows) · done (flash + smile) · error (dims and shakes)
// track: the pupil follows the cursor.

import { memo, useEffect, useId, useRef } from "react"
import "./cosmos.css"

export type CoreMood = "idle" | "thinking" | "done" | "error"

type Props = { size?: number; mood?: CoreMood; track?: boolean; className?: string; title?: string }

const RINGS: { rx: number; ry: number; rot: number; col: string; op: number; dur: number }[] = [
  { rx: 40, ry: 17, rot: -18, col: "#FF4D6A", op: 0.38, dur: 9 },
  { rx: 33, ry: 12, rot: 26, col: "#F5B13B", op: 0.55, dur: 6.5 },
  { rx: 44, ry: 8, rot: 72, col: "#FF4D6A", op: 0.3, dur: 12 },
]

function ellipsePath(rx: number, ry: number) {
  return `M ${rx} 0 A ${rx} ${ry} 0 1 1 ${-rx} 0 A ${rx} ${ry} 0 1 1 ${rx} 0`
}

function CoreEyeBase({ size = 120, mood = "idle", track = false, className, title }: Props) {
  const raw = useId()
  const id = "ce" + raw.replace(/[^a-zA-Z0-9]/g, "")
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!track || !el) return
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return
    let raf = 0
    const onMove = (e: PointerEvent) => {
      if (raf) return
      raf = requestAnimationFrame(() => {
        raf = 0
        const r = el.getBoundingClientRect()
        const dx = e.clientX - (r.left + r.width / 2)
        const dy = e.clientY - (r.top + r.height / 2)
        const d = Math.hypot(dx, dy) || 1
        const k = Math.min(1, d / 400) * 6.5
        el.style.setProperty("--ex", `${(dx / d) * k}px`)
        el.style.setProperty("--ey", `${(dy / d) * k}px`)
      })
    }
    window.addEventListener("pointermove", onMove, { passive: true })
    return () => { window.removeEventListener("pointermove", onMove); if (raf) cancelAnimationFrame(raf) }
  }, [track])

  const speed = mood === "thinking" ? 0.35 : mood === "error" ? 2.5 : 1
  const red = mood === "error" ? "#8A1428" : "#E8002A"

  return (
    <span ref={ref} className={`ace ace-${mood}${className ? " " + className : ""}`} style={{ width: size, height: size }}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <svg viewBox="-50 -50 100 100" width={size} height={size} overflow="visible">
        <defs>
          <radialGradient id={`${id}g`}>
            <stop offset="0" stopColor={red} stopOpacity=".6" />
            <stop offset="1" stopColor={red} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}b`} cx=".36" cy=".32">
            <stop offset="0" stopColor={mood === "done" ? "#FFE3E9" : "#FF7A93"} />
            <stop offset=".45" stopColor={red} />
            <stop offset="1" stopColor="#36000E" />
          </radialGradient>
          <radialGradient id={`${id}p`} cx=".4" cy=".4">
            <stop offset="0" stopColor="#22000A" />
            <stop offset="1" stopColor="#000" />
          </radialGradient>
        </defs>

        <circle r="50" fill={`url(#${id}g)`} className="ace-glow" />

        {RINGS.map((r, i) => {
          const d = ellipsePath(r.rx, r.ry)
          return (
            <g key={i} transform={`rotate(${r.rot})`}>
              <path d={d} fill="none" stroke={r.col} strokeOpacity={r.op} strokeWidth="0.8" />
              <circle r={i === 1 ? 1.9 : 1.5} fill={i === 1 ? "#F5B13B" : "#fff"}>
                <animateMotion dur={`${r.dur * speed}s`} repeatCount="indefinite" path={d} begin={`-${i * 2.3}s`} />
              </circle>
            </g>
          )
        })}

        <g className="ace-ball">
          <circle r="18" fill={`url(#${id}b)`} />
          <g className="ace-look">
            {mood === "done" ? (
              <path d="M -7 2 Q 0 -7 7 2" fill="none" stroke="#1A0006" strokeWidth="3.2" strokeLinecap="round" />
            ) : (
              <g className="ace-pupil">
                <circle r={mood === "thinking" ? 5.2 : mood === "error" ? 7.5 : 6.6} fill={`url(#${id}p)`} />
                <circle cx="2.6" cy="-2.8" r="1.6" fill="#fff" opacity=".9" />
              </g>
            )}
          </g>
          <circle r="18" fill="none" stroke="#FF9AAE" strokeOpacity=".45" strokeWidth=".5" />
        </g>
      </svg>
    </span>
  )
}

const CoreEye = memo(CoreEyeBase)
export default CoreEye
