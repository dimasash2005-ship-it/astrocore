"use client"

// ─── AstroCore auth intro ─────────────────────────────────────────
//
// Sequence (about 3.5s, plays when the page opens):
//   0.0s  the line-drawn "A" mark flies in on an orbit around the form,
//         drawing itself as it goes, with a soft comet trail
//   1.6s  it lands above the form: the core lights up, a ring pulses,
//         and a lightning web strikes across the left panel
//   1.75s the ASTROCORE AI wordmark appears letter by letter
//   2.5s  the form slides in piece by piece and is ready to use
//
// Respects prefers-reduced-motion: then everything is shown at once.

import { useEffect, useMemo, useState } from "react"

export type IntroPhase = "idle" | "fly" | "strike" | "form" | "done"

// Set to true to play the intro only once per browser tab session.
const PLAY_ONCE_PER_SESSION = false

const T_LAND = 1600
const T_FORM = 2500
const T_DONE = 3800

export function useAuthIntro(): IntroPhase {
  const [phase, setPhase] = useState<IntroPhase>("idle")

  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    let seen = false
    if (PLAY_ONCE_PER_SESSION) {
      try { seen = sessionStorage.getItem("ac_auth_intro") === "1" } catch {}
      try { sessionStorage.setItem("ac_auth_intro", "1") } catch {}
    }
    if (reduce || seen) { setPhase("done"); return }

    setPhase("fly")
    const t1 = setTimeout(() => setPhase("strike"), T_LAND)
    const t2 = setTimeout(() => setPhase("form"),   T_FORM)
    const t3 = setTimeout(() => setPhase("done"),   T_DONE)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  return phase
}

export const hasLanded = (p: IntroPhase) => p === "strike" || p === "form" || p === "done"

// ─── The "A" mark ─────────────────────────────────────────────────
// Placeholder mark; swap the paths for the real AstroCore logo SVG.

function Mark({ className, style }: { className: string; style?: React.CSSProperties }) {
  return (
    <svg className={className} style={style} viewBox="0 0 100 100" aria-hidden>
      <path className="aci-a" pathLength={1} d="M18 86 L50 14 L82 86" />
      <g className="aci-orb-g">
        <ellipse className="aci-orb" pathLength={1} cx="50" cy="58" rx="30" ry="9" transform="rotate(-14 50 58)" />
      </g>
      <circle className="aci-core" cx="50" cy="58" r="5.5" />
    </svg>
  )
}

// ─── Brand block above the form: mark + ASTROCORE AI ──────────────

export function AuthBrandIntro({ phase }: { phase: IntroPhase }) {
  const flying = phase === "fly"
  const landed = hasLanded(phase)
  const cls = `aci-brand${phase === "idle" ? " aci-idle" : ""}${flying ? " aci-fly" : ""}${landed ? " aci-landed" : ""}`

  return (
    <div className={cls}>
      <div className="aci-mark-wrap">
        {flying && [1, 2, 3].map(i => (
          <Mark key={i} className="aci-mark aci-trail"
            style={{ "--d": `${i * 60}ms`, "--o": String(0.4 - i * 0.1) } as React.CSSProperties} />
        ))}
        <Mark className="aci-mark aci-main" />
        <span className="aci-shock" aria-hidden />
      </div>

      <div className="aci-word">
        <div className="aci-letters" role="img" aria-label="AstroCore AI">
          {"ASTROCORE".split("").map((ch, i) => (
            <span key={i} aria-hidden className={i >= 5 ? "aci-red" : undefined}
              style={{ "--i": i } as React.CSSProperties}>{ch}</span>
          ))}
          <span className="aci-ai" aria-hidden>AI</span>
        </div>
        <span className="aci-underline" aria-hidden />
        <div className="aci-tagline">AI workspace · agents · memory</div>
      </div>
    </div>
  )
}

// ─── Lightning web for the left panel ─────────────────────────────
// Place inside a position:relative container, behind the content.
// A bolt drops from the top, and from the impact point a branching
// web of lightning spreads under the whole text, then fades to a
// faint trace.

type Seg = { d: string; depth: number; delay: number; dur: number }

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}

function buildWeb(seed = 7): { bolt: string; web: Seg[] } {
  const r = rng(seed)
  const IX = 560, IY = 290      // impact point in a 1000×1000 space
  const SPEED = 1.9             // units per ms

  // main bolt from the top edge to the impact point
  let x = 640, y = 0
  let bolt = `M${x} ${y}`
  while (y < IY - 30) {
    y += 40 + r() * 40
    x += (r() - 0.55) * 70
    bolt += ` L${x.toFixed(0)} ${Math.min(y, IY).toFixed(0)}`
  }
  bolt += ` L${IX} ${IY}`

  const web: Seg[] = []
  function grow(sx: number, sy: number, angle: number, len: number, depth: number, startDist: number) {
    let px = sx, py = sy, travelled = 0
    let d = `M${px.toFixed(0)} ${py.toFixed(0)}`
    while (travelled < len) {
      const step = 28 + r() * 42
      angle += (r() - 0.5) * 0.9
      px += Math.cos(angle) * step
      py += Math.sin(angle) * step
      travelled += step
      d += ` L${px.toFixed(0)} ${py.toFixed(0)}`
      if (depth < 3 && r() < 0.22) {
        const side = r() < 0.5 ? -1 : 1
        grow(px, py, angle + side * (0.5 + r() * 0.6), len * (0.35 + r() * 0.3), depth + 1, startDist + travelled)
      }
      if (px < -50 || px > 1050 || py < -50 || py > 1050) break
    }
    web.push({ d, depth, delay: startDist / SPEED, dur: Math.max(120, travelled / SPEED) })
  }

  // main arms spreading out and down over the text
  const arms = [Math.PI * 0.55, Math.PI * 0.8, Math.PI * 1.05, Math.PI * 0.3, Math.PI * 0.08, Math.PI * 1.3, Math.PI * 0.68]
  arms.forEach(a => grow(IX, IY, a + (r() - 0.5) * 0.2, 380 + r() * 380, 0, 0))

  return { bolt, web }
}

export function LightningWeb({ active }: { active: boolean }) {
  const { bolt, web } = useMemo(() => buildWeb(7), [])
  if (!active) return null
  return (
    <div className="aci-web-layer" aria-hidden>
      <div className="aci-web-flash" />
      <svg className="aci-web" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        <defs>
          <filter id="aci-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="b" />
            <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g className="aci-web-g" filter="url(#aci-glow)">
          <path className="aci-bolt-main" pathLength={1} d={bolt} vectorEffect="non-scaling-stroke" />
          {web.map((s, i) => (
            <path key={i} className={`aci-web-seg aci-dep${s.depth}`} pathLength={1} d={s.d}
              vectorEffect="non-scaling-stroke"
              style={{ "--wd": `${Math.round(180 + s.delay)}ms`, "--wt": `${Math.round(s.dur)}ms` } as React.CSSProperties} />
          ))}
        </g>
      </svg>
    </div>
  )
}

// ─── Form reveal wrapper ──────────────────────────────────────────
// Each direct child of the form's root slides in one after another.

export function IntroReveal({ phase, children }: { phase: IntroPhase; children: React.ReactNode }) {
  const cls = phase === "form" ? "aci-reveal aci-show"
    : phase === "done" ? "aci-reveal"
    : "aci-reveal aci-hidden"
  return <div className={cls}>{children}</div>
}

// ─── Styles (render once on the page) ─────────────────────────────

export function AuthIntroStyles() {
  return <style>{CSS}</style>
}

export const CSS = `
/* brand block */
.aci-brand { display: flex; align-items: center; gap: 14px; margin-bottom: 30px; }
.aci-mark-wrap { position: relative; width: 52px; height: 52px; flex-shrink: 0; }
.aci-mark { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }
.aci-a   { fill: none; stroke: #E8002A; stroke-width: 4; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 0; }
.aci-orb { fill: none; stroke: #F0EDF8; stroke-width: 2; stroke-linecap: round; stroke-dasharray: 1; stroke-dashoffset: 0; opacity: .85; }
.aci-orb-g { transform-origin: 50px 58px; }
.aci-core { fill: #E8002A; transform-origin: 50px 58px; }
.aci-main { filter: drop-shadow(0 0 8px rgba(232,0,42,.5)); }

.aci-idle .aci-mark-wrap, .aci-idle .aci-word { opacity: 0; }
.aci-fly  .aci-main { animation: aci-flight 1.6s cubic-bezier(.45,.05,.25,1) both; }
.aci-fly  .aci-main .aci-a   { animation: aci-draw-in 1.3s cubic-bezier(.6,0,.2,1) .1s both; }
.aci-fly  .aci-main .aci-orb { animation: aci-draw-in 1s cubic-bezier(.6,0,.2,1) .55s both; }
.aci-fly  .aci-core { opacity: 0; }
.aci-trail { opacity: 0; filter: blur(2.5px); animation: aci-trail 1.6s cubic-bezier(.45,.05,.25,1) var(--d) both; }
.aci-landed .aci-core  { animation: aci-core-pop .5s cubic-bezier(.2,1.6,.4,1) both; }
.aci-landed .aci-main  { animation: aci-breathe 3.4s ease-in-out .5s infinite; }
.aci-landed .aci-orb-g { animation: aci-wobble 6s ease-in-out .5s infinite; }

.aci-shock { position: absolute; inset: -6px; border-radius: 50%; border: 1.5px solid rgba(232,0,42,.7); opacity: 0; pointer-events: none; }
.aci-landed .aci-shock { animation: aci-shock .9s ease-out both; }

/* wordmark */
.aci-word { display: flex; flex-direction: column; gap: 5px; position: relative; min-width: 0; }
.aci-letters { display: flex; align-items: center; font-size: clamp(22px, 3.2vw, 30px); font-weight: 800; letter-spacing: .16em; line-height: 1; color: #F0EDF8; }
.aci-letters .aci-red { color: #E8002A; }
.aci-ai {
  margin-left: 10px; font-size: .42em; letter-spacing: .12em; font-weight: 700;
  color: #FF4D6A; border: 1px solid rgba(232,0,42,.5); border-radius: 6px; padding: 4px 6px 3px;
  background: rgba(232,0,42,.10); box-shadow: 0 0 14px rgba(232,0,42,.25);
}
.aci-underline { display: block; height: 1px; width: 100%; background: linear-gradient(90deg, #E8002A, rgba(232,0,42,0)); transform-origin: left; }
.aci-tagline { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 10px; letter-spacing: .2em; text-transform: uppercase; color: #585878; }

.aci-fly .aci-letters span, .aci-fly .aci-tagline { opacity: 0; }
.aci-fly .aci-underline { transform: scaleX(0); }
.aci-landed .aci-letters span:not(.aci-ai) { animation: aci-letter .55s cubic-bezier(.2,.8,.2,1) calc(150ms + var(--i) * 50ms) both; }
.aci-landed .aci-ai        { animation: aci-chip .5s cubic-bezier(.2,1.5,.4,1) .7s both; }
.aci-landed .aci-underline { animation: aci-line .7s cubic-bezier(.7,0,.2,1) .75s both; }
.aci-landed .aci-tagline   { animation: aci-fade .6s ease .9s both; }

@keyframes aci-flight {
  0%   { opacity: 0; transform: translate(300px, 330px) scale(.3) rotate(-40deg); }
  18%  { opacity: 1; transform: translate(340px, 90px) scale(.55) rotate(-20deg); }
  42%  { transform: translate(180px, -90px) scale(.85) rotate(10deg); }
  66%  { transform: translate(-60px, -20px) scale(1.12) rotate(-6deg); }
  84%  { transform: translate(8px, 6px) scale(.95) rotate(2deg); }
  100% { opacity: 1; transform: none; }
}
@keyframes aci-trail {
  0%   { opacity: 0; transform: translate(300px, 330px) scale(.3) rotate(-40deg); }
  18%  { opacity: var(--o); transform: translate(340px, 90px) scale(.55) rotate(-20deg); }
  42%  { transform: translate(180px, -90px) scale(.85) rotate(10deg); }
  66%  { opacity: var(--o); transform: translate(-60px, -20px) scale(1.12) rotate(-6deg); }
  100% { opacity: 0; transform: none; }
}
@keyframes aci-draw-in { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes aci-core-pop { from { opacity: 0; transform: scale(0); } to { opacity: 1; transform: scale(1); } }
@keyframes aci-breathe  { 0%,100% { filter: drop-shadow(0 0 6px rgba(232,0,42,.4)); } 50% { filter: drop-shadow(0 0 14px rgba(232,0,42,.75)); } }
@keyframes aci-wobble   { 0%,100% { transform: rotate(-7deg); } 50% { transform: rotate(7deg); } }
@keyframes aci-shock    { 0% { opacity: .9; transform: scale(.7); } 100% { opacity: 0; transform: scale(2.3); } }
@keyframes aci-letter   { from { opacity: 0; transform: translateY(12px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@keyframes aci-chip     { from { opacity: 0; transform: scale(.4); } to { opacity: 1; transform: none; } }
@keyframes aci-line     { from { transform: scaleX(0); } to { transform: scaleX(1); } }
@keyframes aci-fade     { from { opacity: 0; } to { opacity: 1; } }

/* lightning web */
.aci-web-layer { position: absolute; inset: 0; pointer-events: none; z-index: 0; overflow: hidden; }
.aci-web { position: absolute; inset: 0; width: 100%; height: 100%; }
.aci-web path { fill: none; stroke-linecap: round; stroke-linejoin: round; stroke-dasharray: 1; stroke-dashoffset: 1; }
.aci-bolt-main { stroke: #FFE3E8; stroke-width: 2.4; animation: aci-draw-in .18s ease-out both; }
.aci-web-seg   { stroke: #FF5A74; animation: aci-draw-in var(--wt) linear var(--wd) both; }
.aci-dep0 { stroke-width: 1.6; }
.aci-dep1 { stroke-width: 1.1; opacity: .8; }
.aci-dep2 { stroke-width: .8;  opacity: .6; }
.aci-dep3 { stroke-width: .6;  opacity: .45; }
.aci-web-g { animation: aci-web-life 2.6s ease-out both; }
.aci-web-flash {
  position: absolute; inset: 0;
  background: radial-gradient(ellipse 60% 50% at 56% 29%, rgba(232,0,42,.22), transparent 70%);
  animation: aci-flash 1s ease-out both;
}
@keyframes aci-web-life {
  0%   { opacity: 1; }
  12%  { opacity: .45; }
  20%  { opacity: 1; }
  45%  { opacity: .9; }
  100% { opacity: .07; }
}
@keyframes aci-flash { 0% { opacity: 0; } 10% { opacity: 1; } 100% { opacity: 0; } }

/* word that lights up when the bolt hits */
.aci-lit { animation: aci-lit 1.4s ease-out both; }
@keyframes aci-lit {
  0%   { text-shadow: none; }
  15%  { text-shadow: 0 0 18px rgba(232,0,42,.9), 0 0 2px #fff; }
  100% { text-shadow: 0 0 10px rgba(232,0,42,.25); }
}

/* form reveal */
.aci-reveal.aci-hidden > * > * { opacity: 0; transform: translateY(14px); }
.aci-reveal.aci-show   > * > * { animation: aci-rise .55s cubic-bezier(.2,.8,.2,1) both; }
.aci-reveal.aci-show   > * > *:nth-child(2) { animation-delay: .08s; }
.aci-reveal.aci-show   > * > *:nth-child(3) { animation-delay: .16s; }
.aci-reveal.aci-show   > * > *:nth-child(4) { animation-delay: .24s; }
.aci-reveal.aci-show   > * > *:nth-child(5) { animation-delay: .32s; }
@keyframes aci-rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .aci-brand *, .aci-reveal *, .aci-lit { animation: none !important; }
  .aci-web-layer { display: none; }
  .aci-reveal.aci-hidden > * > * { opacity: 1; transform: none; }
}
`