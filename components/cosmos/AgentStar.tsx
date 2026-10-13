"use client"

// Agent avatar as a living star system.
// Star colour = agent colour. Planets appear as the agent levels up:
// L2 1 planet · L3 rays · L4 2 planets · L5 moon · L6 3 planets · L7+ or 7-day streak corona · L8 4 planets.

import { memo, useId } from "react"
import { accentFor, hashStr } from "@/lib/cosmos"
import "./cosmos.css"

type Props = {
  name: string
  color?: string | null
  level?: number
  streak?: number
  size?: number
  thinking?: boolean
  online?: boolean
  tile?: boolean       // dark rounded tile behind the star (lists)
  title?: string
  className?: string
  still?: boolean      // no animation (long lists, e.g. every chat message)
}

const ORBITS = [24, 32, 39, 45]

function AgentStarBase({ name, color, level = 1, streak = 0, size = 36, thinking, online, tile = true, title, className, still }: Props) {
  const raw = useId()
  const id = "as" + raw.replace(/[^a-zA-Z0-9]/g, "")
  const c = color || "#E8002A"
  const c2 = accentFor(name, c)
  const h = hashStr(name || "agent")
  const small = size < 44

  let planets = level >= 8 ? 4 : level >= 6 ? 3 : level >= 4 ? 2 : level >= 2 ? 1 : 0
  if (small) planets = Math.min(planets, 2)
  const rays = level >= 3
  const moon = level >= 5
  const corona = level >= 7 || streak >= 7
  const coreR = 9 + Math.min(level, 10) * 0.55

  return (
    <span
      className={`acs${tile ? " acs-tile" : ""}${thinking ? " acs-thinking" : ""}${still && !thinking ? " acs-still" : ""}${className ? " " + className : ""}`}
      style={{ width: size, height: size, ["--c" as string]: c } as React.CSSProperties}
      title={title}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <svg viewBox="-50 -50 100 100" width={size} height={size}>
        <defs>
          <radialGradient id={`${id}g`}>
            <stop offset="0" stopColor={c} stopOpacity=".55" />
            <stop offset="1" stopColor={c} stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}k`} cx=".4" cy=".38">
            <stop offset="0" stopColor="#fff" />
            <stop offset=".55" stopColor="#fff" />
            <stop offset="1" stopColor={c} />
          </radialGradient>
        </defs>

        <circle r={coreR * 3} fill={`url(#${id}g)`} className="acs-glow" />

        {corona && (
          <g className="acs-spin acs-slow">
            <circle r="47" fill="none" stroke={c} strokeOpacity=".35" strokeWidth="1.2" strokeDasharray="2 5" />
          </g>
        )}

        {planets === 0 && (
          <circle r="22" fill="none" stroke={c} strokeOpacity=".22" strokeWidth="1" strokeDasharray="1.5 4" />
        )}

        {ORBITS.slice(0, planets).map((r, i) => {
          const a = ((h >>> (i * 5)) % 360) * (Math.PI / 180)
          const px = Math.cos(a) * r, py = Math.sin(a) * r
          const pr = i === 1 ? 4.4 : 3.4
          return (
            <g key={i} className="acs-spin" style={{ animationDuration: `${14 + i * 7 + (h % 5)}s`, animationDirection: i % 2 ? "reverse" : "normal" }}>
              <circle r={r} fill="none" stroke={c} strokeOpacity={small ? 0.3 : 0.26} strokeWidth={small ? 1.4 : 1} strokeDasharray={i % 2 && !small ? "3 4" : undefined} />
              <circle cx={px} cy={py} r={small ? pr + 1 : pr} fill={i % 2 ? c2 : "#ECE9F5"} />
              {moon && i === 1 && <circle cx={px + 7} cy={py - 5} r={1.8} fill="#fff" />}
            </g>
          )
        })}

        {rays && (
          <g className="acs-rays">
            {Array.from({ length: 8 }, (_, k) => {
              const a = (k * Math.PI) / 4, long = k % 2 === 0
              return (
                <line key={k} x1={Math.cos(a) * coreR * 1.15} y1={Math.sin(a) * coreR * 1.15}
                  x2={Math.cos(a) * coreR * (long ? 2.1 : 1.65)} y2={Math.sin(a) * coreR * (long ? 2.1 : 1.65)}
                  stroke={c} strokeWidth={small ? 2 : 1.4} strokeLinecap="round" strokeOpacity=".85" />
              )
            })}
          </g>
        )}

        <circle r={coreR} fill={`url(#${id}k)`} className="acs-core" />
      </svg>
      {online && <i className="acs-online" />}
    </span>
  )
}

const AgentStar = memo(AgentStarBase)
export default AgentStar
