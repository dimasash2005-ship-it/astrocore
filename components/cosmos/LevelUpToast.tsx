"use client"

// "🌟 Level up!" card: appears bottom-right when an agent reaches a new level.
// Listens to the "astrocore:levelup" event from lib/useAgentLevels.

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { X } from "lucide-react"
import AgentStar from "@/components/cosmos/AgentStar"
import { LEVELUP_EVENT, type LevelUpEvent } from "@/lib/useAgentLevels"
import { unlockLabel } from "@/lib/cosmos"
import { useLanguage } from "@/lib/useLanguage"
import "./cosmos.css"

const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const a = (i / 14) * Math.PI * 2
  const d = 46 + (i % 3) * 14
  return { x: Math.cos(a) * d, y: Math.sin(a) * d, c: ["#F5B13B", "#FF4D6A", "#fff", "#A78BFA"][i % 4], delay: (i % 4) * 40 }
})

export default function LevelUpToast() {
  const router = useRouter()
  const { language } = useLanguage()
  const lang = language === "uk" ? "uk" : "en"
  const [queue, setQueue] = useState<LevelUpEvent[]>([])
  const [leaving, setLeaving] = useState(false)
  const cur = queue[0]

  useEffect(() => {
    const on = (e: Event) => {
      const ups = (e as CustomEvent<LevelUpEvent[]>).detail ?? []
      if (ups.length) setQueue(q => [...q, ...ups].slice(0, 6))
    }
    window.addEventListener(LEVELUP_EVENT, on)
    return () => window.removeEventListener(LEVELUP_EVENT, on)
  }, [])

  const close = useCallback(() => {
    setLeaving(true)
    setTimeout(() => { setQueue(q => q.slice(1)); setLeaving(false) }, 260)
  }, [])

  useEffect(() => {
    if (!cur) return
    const t = setTimeout(close, 7000)
    return () => clearTimeout(t)
  }, [cur, close])

  if (!cur) return null
  const uk = lang === "uk"
  const color = cur.color || "#E8002A"

  return (
    <div key={`${cur.agentId}-${cur.to}`} className={`alu${leaving ? " out" : ""}`} role="status" aria-live="polite"
      style={{ ["--c" as string]: color } as React.CSSProperties}
      onClick={() => { router.push(`/agents/${cur.agentId}`); close() }}>
      <span className="alu-sweep" aria-hidden />
      <div className="alu-star" aria-hidden>
        <span className="alu-ring" /><span className="alu-ring r2" />
        {SPARKS.map((s, i) => (
          <i key={i} className="alu-spark" style={{ ["--x" as string]: `${s.x}px`, ["--y" as string]: `${s.y}px`, background: s.c, animationDelay: `${s.delay}ms` } as React.CSSProperties} />
        ))}
        <AgentStar name={cur.name} color={color} level={cur.to} size={76} tile={false} />
      </div>
      <div className="alu-tx">
        <span className="alu-k">LEVEL UP</span>
        <b>{cur.name} <span>LV {cur.from} → <em>LV {cur.to}</em></span></b>
        <small>✨ {uk ? "Відкрито" : "Unlocked"}: {unlockLabel(cur.to, lang)}</small>
        <div className="alu-row">
          <button className="alu-share" onClick={e => { e.stopPropagation(); router.push(`/agents/${cur.agentId}?share=1`); close() }}>
            🚀 {uk ? "Похизуватися" : "Show it off"}
          </button>
        </div>
        <div className="alu-bar"><i /></div>
      </div>
      <button className="alu-x" aria-label={uk ? "Закрити" : "Close"} onClick={e => { e.stopPropagation(); close() }}><X size={13} /></button>
    </div>
  )
}
