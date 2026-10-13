"use client"

// "LV 4 · 120 / 160 XP" with a progress bar and what the XP is made of.

import type { AgentLevel } from "@/lib/cosmos"
import "./cosmos.css"

export default function LevelBar({ lv, lang, color }: { lv: AgentLevel; lang: "uk" | "en"; color?: string | null }) {
  const uk = lang === "uk"
  const pct = lv.nextXp === null ? 100 : Math.max(4, Math.round(((lv.xp - lv.levelXp) / (lv.nextXp - lv.levelXp)) * 100))
  const parts = [
    `${lv.replies} ${uk ? "відповідей" : "replies"}`,
    `${lv.chats} ${uk ? "чатів" : "chats"}`,
    `${lv.missions} ${uk ? "місій" : "missions"}`,
    `${lv.days} ${uk ? "активних днів" : "active days"}`,
  ]
  return (
    <div className="alb" style={{ ["--c" as string]: color || "#E8002A" } as React.CSSProperties} title={parts.join(" · ")}>
      <div className="alb-top">
        <b>LV {lv.level}</b>
        <span>{lv.nextXp === null ? (uk ? `${lv.xp} XP · максимум` : `${lv.xp} XP · max level`) : `${lv.xp} / ${lv.nextXp} XP`}</span>
        {lv.streak >= 2 && <span className="alb-streak">🔥 {lv.streak} {uk ? "дн. поспіль" : "day streak"}</span>}
      </div>
      <div className="alb-bar"><i style={{ width: `${pct}%` }} /></div>
      <small>{parts.join(" · ")}</small>
    </div>
  )
}
