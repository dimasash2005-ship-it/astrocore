"use client"

// "Agent card" button on the agent page: a small tilted holographic card that
// straightens up on hover. Opens the full 3D card (ShareAgentModal).

import AgentStar from "@/components/cosmos/AgentStar"

export default function AgentCardTeaser({ name, color, level, lang, onClick }: {
  name: string; color?: string | null; level: number; lang: "uk" | "en"; onClick: () => void
}) {
  const c = color || "#E8002A"
  return (
    <button className="act" onClick={onClick} style={{ ["--c" as string]: c } as React.CSSProperties}
      aria-label={lang === "uk" ? "Карта агента" : "Agent card"}>
      <style>{CSS}</style>
      <span className="act-card" aria-hidden>
        <span className="act-shine" />
        <AgentStar name={name} color={c} level={level} size={34} tile={false} still />
        <i>LV {level}</i>
      </span>
      <span className="act-tx">
        <b>{lang === "uk" ? "Карта агента" : "Agent card"} <em>✦</em></b>
        <small>{lang === "uk" ? "Зберегти й поширити" : "Save & share"}</small>
      </span>
    </button>
  )
}

const CSS = `
.act { display: inline-flex; align-items: center; gap: 11px; padding: 5px 14px 5px 6px; border-radius: 12px; cursor: pointer; text-align: left;
  background: linear-gradient(135deg, color-mix(in srgb, var(--c) 12%, transparent), rgba(245,177,59,.06));
  border: .5px solid color-mix(in srgb, var(--c) 45%, transparent); transition: transform .2s, box-shadow .2s, border-color .2s; }
.act:hover { transform: translateY(-2px); border-color: #F5B13B; box-shadow: 0 10px 28px rgba(0,0,0,.45), 0 0 22px color-mix(in srgb, var(--c) 30%, transparent); }
.act-card { position: relative; width: 34px; height: 46px; border-radius: 6px; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center;
  background: radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--c) 35%, #0E0C16), #0B0A12 75%);
  border: 1px solid color-mix(in srgb, var(--c) 70%, transparent); transform: rotate(-8deg); transition: transform .3s cubic-bezier(.3,1.5,.5,1);
  box-shadow: 0 4px 12px rgba(0,0,0,.5), 0 0 12px color-mix(in srgb, var(--c) 35%, transparent); }
.act:hover .act-card { transform: rotate(0deg) scale(1.12); }
.act-card i { font: 700 6.5px 'JetBrains Mono', monospace; font-style: normal; color: #F5B13B; margin-top: -4px; }
.act-shine { position: absolute; inset: -40%; background: linear-gradient(115deg, transparent 40%, rgba(255,255,255,.45) 50%, transparent 60%);
  animation: actShine 3.2s ease-in-out infinite; pointer-events: none; }
.act-tx { display: flex; flex-direction: column; gap: 1px; }
.act-tx b { font: 600 13px 'Space Grotesk', system-ui, sans-serif; color: #F0EDF8; } .act-tx em { font-style: normal; color: #F5B13B; }
.act-tx small { font-size: 10.5px; color: #8A8AAA; }
@keyframes actShine { 0%, 55% { transform: translateX(-60%); } 100% { transform: translateX(60%); } }
@media (prefers-reduced-motion: reduce) { .act-shine { animation: none; } }
`
