"use client"

import { Zap } from "lucide-react"
import type { Skill } from "./skillRegistry"

const T = {
  t1: "#F0EDF8",
  t2: "#C8C4D8",
  t3: "#A8A4BC",
  t4: "#585878",
  red: "#E8002A",
}

export function QuickActions({
  skills,
  onSelect,
}: {
  skills: Skill[]
  onSelect: (prompt: string) => void
}) {
  if (!skills.length) return null

  return (
    <div
      style={{
        padding: "8px 12px",
        borderTop: "0.5px solid rgba(255,255,255,0.07)",
        background: "rgba(8,8,15,0.95)",
        display: "flex",
        alignItems: "center",
        gap: 8,
        flexWrap: "wrap",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          flexShrink: 0,
        }}
      >
        <Zap size={11} style={{ color: T.red, opacity: 0.7 }} />
        <span
          style={{
            fontSize: 10,
            color: T.t4,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            fontWeight: 600,
          }}
        >
          Швидкі дії
        </span>
      </div>

      {skills.slice(0, 5).map((skill) => (
        <button
          key={skill.label}
          onClick={() => onSelect(skill.prompt)}
          style={{
            fontSize: 11.5,
            padding: "4px 10px",
            borderRadius: 7,
            border: "0.5px solid rgba(255,255,255,0.09)",
            cursor: "pointer",
            background: "rgba(255,255,255,0.05)",
            color: T.t3,
            transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(232,0,42,0.14)"
            e.currentTarget.style.color = T.t1
            e.currentTarget.style.borderColor = "rgba(232,0,42,0.28)"
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "rgba(255,255,255,0.05)"
            e.currentTarget.style.color = T.t3
            e.currentTarget.style.borderColor = "rgba(255,255,255,0.09)"
          }}
        >
          {skill.label}
        </button>
      ))}
    </div>
  )
}