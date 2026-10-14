// components/cosmos/AgentCardImage.tsx
//
// Layout of the "agent card" picture, rendered by next/og (Satori) in
// app/api/agents/card. Satori rules: every element with several children
// needs display:flex, only inline styles, no SVG filters.

import { hashStr, xpForLevel, MAX_LEVEL, unlockLabel } from "@/lib/cosmos"
import type { AgentCard } from "@/lib/server/agent-card"
import { CARD_TEXT } from "@/lib/card-text"

export const CARD_W = 1200
export const CARD_H = 630
const W = CARD_W, H = CARD_H

function Star({ card }: { card: AgentCard }) {
  const S = 440, C = S / 2, k = S / 100
  const c = card.c, lvl = card.l
  const h = hashStr(card.n)
  const planets = lvl >= 8 ? 4 : lvl >= 6 ? 3 : lvl >= 4 ? 2 : lvl >= 2 ? 1 : 0
  const orbits = [24, 32, 39, 45]
  const coreR = (9 + Math.min(lvl, 10) * 0.55) * k
  const accent = ["#5CC4F5", "#A78BFA", "#F5B13B", "#22C55E", "#FF4D6A", "#14B8A6"][h % 6]

  return (
    <div style={{ position: "relative", width: S, height: S, display: "flex" }}>
      <div style={{ position: "absolute", left: C - 210, top: C - 210, width: 420, height: 420, borderRadius: 999, background: `radial-gradient(circle, ${c}AA 0%, ${c}33 35%, transparent 68%)` }} />
      {(lvl >= 7 || card.s >= 7) && (
        <div style={{ position: "absolute", left: C - 212, top: C - 212, width: 424, height: 424, borderRadius: 999, border: `2px dashed ${c}88` }} />
      )}
      {planets === 0 && (
        <div style={{ position: "absolute", left: C - 22 * k, top: C - 22 * k, width: 44 * k, height: 44 * k, borderRadius: 999, border: `2px dashed ${c}55` }} />
      )}
      {orbits.slice(0, planets).map((r, i) => {
        const R = r * k, a = ((h >>> (i * 5)) % 360) * (Math.PI / 180)
        const px = C + Math.cos(a) * R, py = C + Math.sin(a) * R, ps = i === 1 ? 22 : 17
        return (
          <div key={i} style={{ position: "absolute", left: 0, top: 0, width: S, height: S, display: "flex" }}>
            <div style={{ position: "absolute", left: C - R, top: C - R, width: R * 2, height: R * 2, borderRadius: 999, border: `2px ${i % 2 ? "dashed" : "solid"} ${c}55` }} />
            <div style={{ position: "absolute", left: px - ps / 2, top: py - ps / 2, width: ps, height: ps, borderRadius: 999, background: i % 2 ? accent : "#ECE9F5", boxShadow: `0 0 18px ${i % 2 ? accent : "#ffffff"}` }} />
            {lvl >= 5 && i === 1 && (
              <div style={{ position: "absolute", left: px + 26, top: py - 26, width: 9, height: 9, borderRadius: 999, background: "#fff" }} />
            )}
          </div>
        )
      })}
      {lvl >= 3 && [0, 45, 90, 135].map(deg => (
        <div key={deg} style={{
          position: "absolute", left: C - coreR * 2.2, top: C - 2, width: coreR * 4.4, height: 4, borderRadius: 4,
          transform: `rotate(${deg}deg)`,
          background: `linear-gradient(90deg, transparent 0%, ${c} 22%, transparent 42%, transparent 58%, ${c} 78%, transparent 100%)`,
        }} />
      ))}
      <div style={{
        position: "absolute", left: C - coreR, top: C - coreR, width: coreR * 2, height: coreR * 2, borderRadius: 999,
        background: `radial-gradient(circle at 40% 38%, #ffffff 0%, #ffffff 52%, ${c} 100%)`,
        boxShadow: `0 0 70px ${c}, 0 0 140px ${c}88`,
      }} />
    </div>
  )
}

export default function AgentCardImage({ card }: { card: AgentCard }) {
  const tx = CARD_TEXT[card.g]
  const lvl = card.l
  const next = lvl < MAX_LEVEL ? xpForLevel(lvl + 1) : null
  const base = xpForLevel(lvl)
  const pct = next === null ? 100 : Math.max(5, Math.min(100, Math.round(((card.x - base) / (next - base)) * 100)))
  const stats: [number, string][] = [[card.r, tx.replies], [card.m, tx.missions], [card.d, tx.days]]
  const fmt = (n: number) => (n >= 10000 ? `${Math.round(n / 1000)}k` : String(n))

  return (
    <div style={{ width: W, height: H, display: "flex", position: "relative", background: "#08080F", fontFamily: "Manrope", color: "#F0EDF8" }}>
      <div style={{ position: "absolute", left: -120, top: -120, width: 800, height: 860, display: "flex", background: `radial-gradient(circle at 45% 50%, ${card.c}30 0%, transparent 60%)` }} />
      <div style={{ position: "absolute", right: -200, bottom: -260, width: 700, height: 600, display: "flex", background: "radial-gradient(circle, rgba(232,0,42,.16) 0%, transparent 65%)" }} />
      <div style={{ position: "absolute", left: 0, top: 0, width: W, height: 3, display: "flex", background: "linear-gradient(90deg, transparent, #E8002A 30%, #ffffff 50%, #E8002A 70%, transparent)" }} />
      <div style={{ position: "absolute", left: 24, top: 24, right: 24, bottom: 24, display: "flex", borderRadius: 28, border: "1px solid rgba(232,0,42,.22)" }} />
      {[[140, 90, 2], [1080, 120, 3], [980, 520, 2], [620, 70, 2], [80, 540, 3], [560, 580, 2], [1130, 330, 2]].map(([x, y, s], i) => (
        <div key={i} style={{ position: "absolute", left: x, top: y, width: s, height: s, borderRadius: 9, background: "#fff", opacity: 0.6 }} />
      ))}

      <div style={{ position: "absolute", left: 70, top: 95, display: "flex" }}>
        <Star card={card} />
      </div>

      <div style={{ position: "absolute", left: 560, top: 82, width: 580, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 20, letterSpacing: 5, color: "#E8002A" }}>ASTROCORE · {tx.kicker}</div>
        <div style={{ display: "flex", fontSize: card.n.length <= 9 ? 84 : card.n.length <= 13 ? 64 : card.n.length <= 20 ? 48 : 38, fontWeight: 800, lineHeight: 1.05, marginTop: 18, letterSpacing: -2, whiteSpace: "nowrap", overflow: "hidden", maxWidth: 580 }}>{card.n}</div>
        <div style={{ display: "flex", alignItems: "center", marginTop: 22 }}>
          <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 30, fontWeight: 700, color: "#0B0A12", background: "#F5B13B", padding: "6px 16px", borderRadius: 12 }}>LV {lvl}</div>
          <div style={{ display: "flex", marginLeft: 18, fontSize: 24, color: "#C8C4D8" }}>{unlockLabel(lvl, card.g)}</div>
        </div>
        <div style={{ display: "flex", width: 520, height: 10, borderRadius: 10, background: "rgba(255,255,255,.08)", marginTop: 22 }}>
          <div style={{ display: "flex", width: `${pct}%`, height: 10, borderRadius: 10, background: `linear-gradient(90deg, ${card.c}, #F5B13B)` }} />
        </div>
        <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 18, color: "#8A8AAA", marginTop: 10 }}>
          {next === null ? `${card.x} XP · MAX` : `${card.x} / ${next} XP`}
          {card.s >= 2 ? `   ·   ${card.s} ${tx.streak}` : ""}
        </div>
        <div style={{ display: "flex", marginTop: 34 }}>
          {stats.map(([v, l], i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", width: 168, marginRight: 8, padding: "16px 18px", borderRadius: 16, background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.09)" }}>
              <div style={{ display: "flex", fontSize: 44, fontWeight: 800, lineHeight: 1 }}>{fmt(v)}</div>
              <div style={{ display: "flex", fontSize: 18, color: "#8A8AAA", marginTop: 6 }}>{l}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", left: 70, right: 70, bottom: 52, display: "flex", justifyContent: "space-between", fontFamily: "JetBrains Mono", fontSize: 20 }}>
        <div style={{ display: "flex", color: "#F0EDF8" }}>astrocore<span style={{ color: "#E8002A" }}>.one</span></div>
        <div style={{ display: "flex", color: "#6A6A8A" }}>{tx.tagline}</div>
      </div>
    </div>
  )
}

