"use client"

// "Agent card": a collectible-style card of the agent (star system, level, stats).
// Opens with a 3D flip, tilts after the mouse with a holographic shine, flips over on click.
// Buttons: save PNG, share (X / Threads / Telegram or the phone's share sheet), copy link.
// The card itself is drawn with HTML/SVG so it stays sharp; the PNG for social previews
// comes from /api/agents/card.

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { X, Link2, Download, Check, Share2, Loader2, RotateCw } from "lucide-react"
import AgentStar from "@/components/cosmos/AgentStar"
import CoreEye from "@/components/cosmos/CoreEye"
import { useAgentLevels } from "@/lib/useAgentLevels"
import { hashStr, unlockLabel, xpForLevel, MAX_LEVEL } from "@/lib/cosmos"

type Share = { url: string; image: string }

const L = {
  uk: {
    kicker: "КАРТА АГЕНТА", newAgent: "новий агент", replies: "відповідей", missions: "місій", days: "днів", streak: "днів поспіль",
    save: "Зберегти PNG", share: "Поширити", copy: "Посилання", copied: "Скопійовано", flip: "Натисни на карту, щоб перевернути",
    back: "Робочий простір для OpenClaw-агентів", backCta: "Створи свого агента", note: "На карті лише імʼя, рівень і цифри. Чати, памʼять і пошта приватні.",
    post: (n: string, l: number, r: number, m: number) => `Мій AI-агент ${n} вже LV ${l} в AstroCore 🌟\n${r} відповідей · ${m} місій\nА твій агент якого рівня?`,
    wait: "Готуємо посилання…", err: "Не вдалося створити посилання.",
  },
  en: {
    kicker: "AGENT CARD", newAgent: "new agent", replies: "replies", missions: "missions", days: "days", streak: "day streak",
    save: "Save PNG", share: "Share", copy: "Link", copied: "Copied", flip: "Tap the card to flip it",
    back: "The workspace for OpenClaw agents", backCta: "Create your agent", note: "The card only shows the name, level and numbers. Chats, memory and email stay private.",
    post: (n: string, l: number, r: number, m: number) => `My AI agent ${n} just hit LV ${l} on AstroCore 🌟\n${r} replies · ${m} missions\nWhat level is yours?`,
    wait: "Preparing the link…", err: "Couldn't create the link.",
  },
}

export default function ShareAgentModal({ agentId, name, color, lang, onClose }: {
  agentId: string; name: string; color?: string | null; lang: "uk" | "en"; onClose: () => void
}) {
  const tx = L[lang]
  const lv = useAgentLevels().levelOf(agentId)
  const c = color || "#E8002A"
  const [share, setShare] = useState<Share | null>(null)
  const [err, setErr] = useState(false)
  const [done, setDone] = useState(false)
  const [socials, setSocials] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const [mounted, setMounted] = useState(false)
  const tiltRef = useRef<HTMLDivElement>(null)

  useEffect(() => { setMounted(true) }, [])
  useEffect(() => {
    let alive = true
    fetch("/api/agents/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) })
      .then(async r => { const d = await r.json().catch(() => ({})); if (!alive) return; if (r.ok && d.url) setShare(d as Share); else setErr(true) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [agentId])
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", fn)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", fn); document.body.style.overflow = prev }
  }, [onClose])

  // Tilt + holographic shine after the pointer.
  function onMove(e: React.PointerEvent) {
    const el = tiltRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height
    el.style.setProperty("--ry", `${(x - 0.5) * 22}deg`)
    el.style.setProperty("--rx", `${(0.5 - y) * 18}deg`)
    el.style.setProperty("--mx", `${x * 100}%`)
    el.style.setProperty("--my", `${y * 100}%`)
  }
  function onLeave() {
    const el = tiltRef.current
    if (!el) return
    el.style.setProperty("--ry", "0deg"); el.style.setProperty("--rx", "0deg")
  }

  const text = tx.post(name, lv.level, lv.replies, lv.missions)
  async function copyLink() {
    if (!share) return
    try { await navigator.clipboard.writeText(share.url); setDone(true); setTimeout(() => setDone(false), 1800) } catch { /* ignore */ }
  }
  async function save() {
    if (!share) return
    try {
      const blob = await (await fetch(share.image)).blob()
      const a = document.createElement("a")
      a.href = URL.createObjectURL(blob)
      a.download = `${name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase() || "agent"}-lv${lv.level}.png`
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 2000)
    } catch { window.open(share.image, "_blank") }
  }
  async function shareIt() {
    if (!share) return
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share && window.matchMedia("(pointer: coarse)").matches) {
      try { await nav.share({ title: name, text, url: share.url }); return } catch { /* cancelled */ }
    }
    setSocials(s => !s)
  }

  const next = lv.level < MAX_LEVEL ? xpForLevel(lv.level + 1) : null
  const base = xpForLevel(lv.level)
  const pct = next === null ? 100 : Math.max(4, Math.min(100, Math.round(((lv.xp - base) / (next - base)) * 100)))
  const serial = String(hashStr(agentId) % 10000).padStart(4, "0")
  const label = lv.level <= 1 ? tx.newAgent : unlockLabel(lv.level, lang)

  if (!mounted) return null
  return createPortal(
    <div className="acm" onClick={onClose} style={{ ["--c" as string]: c } as React.CSSProperties}>
      <style>{CSS}</style>
      <button className="acm-x" onClick={onClose} aria-label="Close"><X size={16} /></button>

      <div className="acm-in" onClick={e => e.stopPropagation()}>
        <div className="acm-stage" onPointerMove={onMove} onPointerLeave={onLeave}>
          <div className="acm-tilt" ref={tiltRef}>
            <div className="acm-enter">
            <div className={`acm-card${flipped ? " flipped" : ""}`} onClick={() => setFlipped(f => !f)} role="img" aria-label={`${name} · LV ${lv.level}`}>
              {/* front */}
              <div className="acm-face acm-front">
                <div className="acm-foil" />
                <div className="acm-top"><span>ASTRO<b>CORE</b></span><em>{tx.kicker} · #{serial}</em></div>
                <div className="acm-art">
                  <AgentStar name={name} color={c} level={lv.level} streak={lv.streak} size={200} tile={false} />
                </div>
                <div className="acm-name" style={{ fontSize: name.length > 12 ? 24 : 32 }}>{name}</div>
                <div className="acm-lv"><b>LV {lv.level}</b><span>{label}</span></div>
                <div className="acm-bar"><i style={{ width: `${pct}%` }} /></div>
                <div className="acm-xp">{next === null ? `${lv.xp} XP · MAX` : `${lv.xp} / ${next} XP`}{lv.streak >= 2 ? ` · 🔥 ${lv.streak} ${tx.streak}` : ""}</div>
                <div className="acm-stats">
                  <div><b>{lv.replies}</b><span>{tx.replies}</span></div>
                  <div><b>{lv.missions}</b><span>{tx.missions}</span></div>
                  <div><b>{lv.days}</b><span>{tx.days}</span></div>
                </div>
                <div className="acm-foot"><span>astrocore<b>.one</b></span><span>✦</span></div>
              </div>
              {/* back */}
              <div className="acm-face acm-back">
                <div className="acm-foil" />
                <div className="acm-ring r1" /><div className="acm-ring r2" />
                <CoreEye size={150} />
                <div className="acm-bname">ASTRO<b>CORE</b></div>
                <div className="acm-bsub">{tx.back}</div>
                <div className="acm-bcta">{tx.backCta} → astrocore.one</div>
              </div>
            </div>
            </div>
          </div>
        </div>

        <div className="acm-hint"><RotateCw size={11} /> {tx.flip}</div>

        <div className="acm-btns">
          <button onClick={save} disabled={!share}><Download size={15} />{tx.save}</button>
          <button className="pri" onClick={shareIt} disabled={!share}>{share ? <Share2 size={15} /> : <Loader2 size={15} className="acm-spin" />}{tx.share}</button>
          <button onClick={copyLink} disabled={!share}>{done ? <Check size={15} /> : <Link2 size={15} />}{done ? tx.copied : tx.copy}</button>
        </div>

        {socials && share && (
          <div className="acm-soc">
            <a href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(share.url)}`} target="_blank" rel="noopener noreferrer" style={{ background: "#000" }}>𝕏</a>
            <a href={`https://www.threads.net/intent/post?text=${encodeURIComponent(`${text}\n${share.url}`)}`} target="_blank" rel="noopener noreferrer" style={{ background: "#141414" }}>Threads</a>
            <a href={`https://t.me/share/url?url=${encodeURIComponent(share.url)}&text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer" style={{ background: "#229ED9" }}>Telegram</a>
          </div>
        )}
        <p className="acm-note">{err ? tx.err : !share ? tx.wait : tx.note}</p>
      </div>
    </div>,
    document.body,
  )
}

const CSS = `
.acm { position: fixed; inset: 0; z-index: 9500; display: grid; place-items: center; padding: 16px; overflow-y: auto;
  background: radial-gradient(circle at 50% 42%, color-mix(in srgb, var(--c) 22%, transparent), transparent 55%), rgba(4,4,10,.86);
  backdrop-filter: blur(8px); animation: acmFade .25s ease-out; }
.acm-x { position: fixed; top: 18px; right: 18px; width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; cursor: pointer;
  color: #C8C4D8; background: rgba(255,255,255,.06); border: .5px solid rgba(255,255,255,.14); z-index: 2; }
.acm-x:hover { color: #fff; background: rgba(255,255,255,.1); }
.acm-in { display: flex; flex-direction: column; align-items: center; gap: 14px; width: 100%; max-width: 420px; }
.acm-stage { perspective: 1100px; padding: 10px; }
.acm-tilt { --rx: 0deg; --ry: 0deg; --mx: 50%; --my: 30%; transform: rotateX(var(--rx)) rotateY(var(--ry)); transition: transform .18s ease-out; transform-style: preserve-3d; }
.acm-enter { transform-style: preserve-3d; animation: acmFlipIn 1.1s cubic-bezier(.2,.9,.25,1.05) both; }
.acm-card { position: relative; width: 320px; height: 470px; transform-style: preserve-3d; cursor: pointer; transition: transform .7s cubic-bezier(.3,1.3,.4,1); }
.acm-card.flipped { transform: rotateY(180deg); }
.acm-face { position: absolute; inset: 0; border-radius: 22px; overflow: hidden; backface-visibility: hidden; -webkit-backface-visibility: hidden;
  background: radial-gradient(circle at 50% 28%, color-mix(in srgb, var(--c) 30%, #0E0C16) 0%, #0B0A12 58%), #0B0A12;
  border: 1px solid color-mix(in srgb, var(--c) 55%, transparent);
  box-shadow: 0 30px 80px rgba(0,0,0,.7), 0 0 50px color-mix(in srgb, var(--c) 28%, transparent), inset 0 0 0 4px rgba(255,255,255,.025); }
.acm-front { display: flex; flex-direction: column; align-items: center; padding: 16px 18px 14px; color: #F0EDF8; font-family: 'Space Grotesk', system-ui, sans-serif; }
.acm-back { transform: rotateY(180deg); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; text-align: center; padding: 24px; color: #F0EDF8; }
.acm-foil { position: absolute; inset: 0; pointer-events: none; mix-blend-mode: color-dodge; opacity: .5;
  background: radial-gradient(circle at var(--mx) var(--my), rgba(255,255,255,.35), transparent 38%),
    linear-gradient(115deg, transparent 20%, rgba(255,77,106,.22) 35%, rgba(92,196,245,.22) 45%, rgba(245,177,59,.22) 55%, transparent 70%);
  background-size: 100% 100%, 220% 220%; background-position: center, var(--mx) var(--my); }
.acm-top { width: 100%; display: flex; justify-content: space-between; align-items: center; font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .12em; }
.acm-top span { color: #F0EDF8; letter-spacing: .3em; } .acm-top span b { color: #E8002A; font-weight: 600; }
.acm-top em { font-style: normal; color: #8A8AAA; }
.acm-art { position: relative; width: 100%; height: 200px; margin: 8px 0 4px; display: grid; place-items: center; border-radius: 14px;
  background: repeating-linear-gradient(0deg, rgba(255,255,255,.035) 0 1px, transparent 1px 20px), repeating-linear-gradient(90deg, rgba(255,255,255,.035) 0 1px, transparent 1px 20px);
  border: .5px solid rgba(255,255,255,.07); }
.acm-name { font-weight: 700; letter-spacing: -.02em; line-height: 1.1; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.acm-lv { display: flex; align-items: center; gap: 9px; margin-top: 6px; }
.acm-lv b { font: 700 13px 'JetBrains Mono', monospace; color: #0B0A12; background: #F5B13B; padding: 3px 9px; border-radius: 7px; box-shadow: 0 0 14px rgba(245,177,59,.45); }
.acm-lv span { font-size: 12.5px; color: #C8C4D8; }
.acm-bar { width: 100%; height: 5px; border-radius: 5px; background: rgba(255,255,255,.08); margin-top: 12px; overflow: hidden; }
.acm-bar i { display: block; height: 100%; border-radius: 5px; background: linear-gradient(90deg, var(--c), #F5B13B); }
.acm-xp { align-self: flex-start; margin-top: 5px; font: 500 10.5px 'JetBrains Mono', monospace; color: #8A8AAA; }
.acm-stats { width: 100%; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; margin-top: 10px; }
.acm-stats div { display: flex; flex-direction: column; align-items: center; padding: 8px 4px; border-radius: 10px; background: rgba(255,255,255,.04); border: .5px solid rgba(255,255,255,.08); }
.acm-stats b { font-size: 19px; line-height: 1.1; } .acm-stats span { font-size: 10.5px; color: #8A8AAA; }
.acm-foot { width: 100%; margin-top: auto; display: flex; justify-content: space-between; font: 500 10.5px 'JetBrains Mono', monospace; color: #8A8AAA; padding-top: 8px; }
.acm-foot b { color: #E8002A; font-weight: 500; }
.acm-ring { position: absolute; left: 50%; top: 44%; border-radius: 50%; border: 1px dashed color-mix(in srgb, var(--c) 45%, transparent); transform: translate(-50%, -50%); animation: acmSpin 30s linear infinite; }
.acm-ring.r1 { width: 230px; height: 230px; } .acm-ring.r2 { width: 290px; height: 290px; animation-direction: reverse; animation-duration: 45s; }
.acm-bname { font: 600 15px 'JetBrains Mono', monospace; letter-spacing: .45em; margin-top: 8px; } .acm-bname b { color: #E8002A; font-weight: 600; }
.acm-bsub { font-size: 12.5px; color: #A8A4BC; }
.acm-bcta { margin-top: 10px; font: 500 11px 'JetBrains Mono', monospace; color: #F5B13B; }
.acm-hint { display: flex; align-items: center; gap: 6px; font: 500 11px 'JetBrains Mono', monospace; color: #6A6A8A; }
.acm-btns { display: grid; grid-template-columns: 1fr 1.15fr 1fr; gap: 8px; width: 100%; }
.acm-btns button { display: flex; align-items: center; justify-content: center; gap: 7px; padding: 12px 8px; border-radius: 12px; cursor: pointer;
  white-space: nowrap; font: 600 13px 'Space Grotesk', system-ui, sans-serif; color: #E8E4F4; background: rgba(255,255,255,.06); border: .5px solid rgba(255,255,255,.14); transition: all .15s; }
.acm-btns button:hover:not(:disabled) { background: rgba(255,255,255,.1); transform: translateY(-1px); }
.acm-btns button.pri { color: #fff; background: #E8002A; border-color: #E8002A; box-shadow: 0 0 24px rgba(232,0,42,.4); }
.acm-btns button.pri:hover:not(:disabled) { background: #FF1A3E; }
.acm-btns button:disabled { opacity: .5; cursor: default; }
.acm-soc { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; width: 100%; animation: acmFade .2s ease-out; }
.acm-soc a { display: flex; align-items: center; justify-content: center; padding: 10px; border-radius: 11px; color: #fff; text-decoration: none;
  font: 600 13px 'Space Grotesk', system-ui, sans-serif; border: .5px solid rgba(255,255,255,.16); }
.acm-soc a:hover { filter: brightness(1.2); }
.acm-note { margin: 0; font-size: 11.5px; color: #6A6A8A; text-align: center; line-height: 1.5; }
.acm-spin { animation: acmSpin .8s linear infinite; }
@keyframes acmFade { from { opacity: 0; } }
@keyframes acmFlipIn {
  0% { opacity: 0; transform: translateY(60px) rotateY(-200deg) rotateX(20deg) scale(.55); }
  55% { opacity: 1; transform: translateY(-6px) rotateY(18deg) rotateX(-4deg) scale(1.04); }
  100% { opacity: 1; transform: none; } }
@keyframes acmSpin { to { transform: translate(-50%, -50%) rotate(360deg); } }
.acm-spin { animation-name: acmSpinIcon; } @keyframes acmSpinIcon { to { transform: rotate(360deg); } }
@media (max-width: 420px) { .acm-card { width: 290px; height: 440px; } .acm-art { height: 180px; } }
@media (prefers-reduced-motion: reduce) { .acm-enter { animation: none; } .acm-ring { animation: none; } .acm-tilt { transition: none; } }
`
