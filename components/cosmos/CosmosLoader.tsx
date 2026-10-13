"use client"

// Loading screen: a galaxy that grows out of the Core like a neural network.
// Stars appear along spiral arms, link up with their neighbours, and signals
// fire along the links like neurons. The living Core sits in the middle.

import { useEffect, useRef, useState } from "react"
import CoreEye from "@/components/cosmos/CoreEye"
import "./cosmos.css"

type Props = { fullscreen?: boolean; exiting?: boolean; delay?: number }

type Node = { r: number; a: number; t0: number; size: number; color: string; links: number[] }
type Pulse = { from: number; to: number; p: number; speed: number }

const COLORS = ["#E8002A", "#FF4D6A", "#FF4D6A", "#F5B13B", "#A78BFA", "#5CC4F5", "#ECE9F5", "#ECE9F5"]
const STATUS = {
  uk: ["Запускаємо ядро", "З'єднуємо агентів", "Синхронізуємо пам'ять", "Майже готово"],
  en: ["Starting the core", "Connecting agents", "Syncing memory", "Almost there"],
}

function readLang(): "uk" | "en" {
  try { return window.localStorage.getItem("astrocore_language") === "uk" ? "uk" : "en" } catch { return "en" }
}

export default function CosmosLoader({ fullscreen = true, exiting = false, delay = 0 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [lang, setLang] = useState<"uk" | "en">("en")
  const [step, setStep] = useState(0)

  useEffect(() => { setLang(readLang()) }, [])
  useEffect(() => {
    const t = setInterval(() => setStep(s => Math.min(s + 1, STATUS.en.length - 1)), 900)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

    let W = 0, H = 0, R = 0, raf = 0
    let nodes: Node[] = []
    let inner: number[] = []
    const pulses: Pulse[] = []
    const start = performance.now()
    let last = start, spin = 0, spawnAcc = 0

    function build() {
      const N = W < 600 ? 70 : 110
      const arms = 3
      nodes = []
      for (let i = 0; i < N; i++) {
        const t = i / N
        const arm = i % arms
        const r = R * (0.16 + 0.84 * Math.pow(t, 0.85)) + (Math.random() - 0.5) * R * 0.08
        const a = (arm * Math.PI * 2) / arms + t * 3.4 + (Math.random() - 0.5) * 0.5
        nodes.push({ r, a, t0: 120 + t * 1300, size: 1 + Math.random() * 1.8 + (Math.random() < 0.08 ? 1.6 : 0), color: COLORS[(Math.random() * COLORS.length) | 0], links: [] })
      }
      // Each star links to its 2 closest earlier stars: the network grows outward from the Core.
      const pos = nodes.map(n => [Math.cos(n.a) * n.r, Math.sin(n.a) * n.r])
      for (let i = 0; i < nodes.length; i++) {
        const near: [number, number][] = []
        for (let j = 0; j < i; j++) near.push([j, Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])])
        near.sort((x, y) => x[1] - y[1])
        const k = nodes[i].r < R * 0.3 ? 1 : 2
        for (const [j] of near.slice(0, k)) { nodes[i].links.push(j); nodes[j].links.push(i) }
        if (nodes[i].r < R * 0.3) nodes[i].links.push(-1) // -1 = the Core
      }
      inner = nodes.map((n, i) => (n.links.includes(-1) ? i : -1)).filter(i => i >= 0)
    }

    function resize() {
      const box = canvas!.parentElement!.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = box.width; H = box.height
      R = Math.min(W * 0.48, H * 0.62, 520)
      canvas!.width = Math.round(W * dpr); canvas!.height = Math.round(H * dpr)
      canvas!.style.width = W + "px"; canvas!.style.height = H + "px"
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      build()
    }

    const TILT = 0.62
    function xy(i: number, cx: number, cy: number): [number, number] {
      if (i < 0) return [cx, cy]
      const n = nodes[i], a = n.a + spin
      return [cx + Math.cos(a) * n.r, cy + Math.sin(a) * n.r * TILT]
    }

    function frame(now: number) {
      const dt = Math.min(50, now - last); last = now
      const el = now - start
      if (!reduce) spin += dt * 0.00005
      const cx = W / 2, cy = H / 2
      ctx!.clearRect(0, 0, W, H)

      // links
      ctx!.lineWidth = 0.7
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        for (const j of n.links) {
          if (j > i) continue
          const t1 = Math.max(n.t0, j < 0 ? 0 : nodes[j].t0)
          const k = Math.min(1, Math.max(0, (el - t1) / 380))
          if (k <= 0) continue
          const [x1, y1] = xy(j, cx, cy), [x2, y2] = xy(i, cx, cy)
          ctx!.strokeStyle = `rgba(255,77,106,${0.16 * k})`
          ctx!.beginPath(); ctx!.moveTo(x1, y1); ctx!.lineTo(x1 + (x2 - x1) * k, y1 + (y2 - y1) * k); ctx!.stroke()
        }
      }

      // stars
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i]
        const k = Math.min(1, Math.max(0, (el - n.t0) / 300))
        if (k <= 0) continue
        const [x, y] = xy(i, cx, cy)
        const tw = 0.7 + 0.3 * Math.sin(now / 600 + n.r)
        const g = ctx!.createRadialGradient(x, y, 0, x, y, n.size * 6)
        g.addColorStop(0, n.color); g.addColorStop(1, "rgba(0,0,0,0)")
        ctx!.globalAlpha = 0.45 * k * tw; ctx!.fillStyle = g
        ctx!.beginPath(); ctx!.arc(x, y, n.size * 6, 0, Math.PI * 2); ctx!.fill()
        ctx!.globalAlpha = k; ctx!.fillStyle = "#fff"
        ctx!.beginPath(); ctx!.arc(x, y, n.size * 0.75 * (k < 1 ? 1 + (1 - k) * 1.5 : 1), 0, Math.PI * 2); ctx!.fill()
      }
      ctx!.globalAlpha = 1

      // neuron signals: start at the Core and travel outward, sometimes chaining on
      if (!reduce && el > 500) {
        spawnAcc += dt
        while (spawnAcc > 70 && pulses.length < 28) {
          spawnAcc -= 70
          if (inner.length) pulses.push({ from: -1, to: inner[(Math.random() * inner.length) | 0], p: 0, speed: 0.0016 + Math.random() * 0.0014 })
        }
        for (let q = pulses.length - 1; q >= 0; q--) {
          const ps = pulses[q]
          ps.p += ps.speed * dt
          const [x1, y1] = xy(ps.from, cx, cy), [x2, y2] = xy(ps.to, cx, cy)
          const x = x1 + (x2 - x1) * Math.min(ps.p, 1), y = y1 + (y2 - y1) * Math.min(ps.p, 1)
          const tx = x1 + (x2 - x1) * Math.max(0, ps.p - 0.25), ty = y1 + (y2 - y1) * Math.max(0, ps.p - 0.25)
          const grad = ctx!.createLinearGradient(tx, ty, x, y)
          grad.addColorStop(0, "rgba(245,177,59,0)"); grad.addColorStop(1, "rgba(255,214,140,.95)")
          ctx!.strokeStyle = grad; ctx!.lineWidth = 1.6
          ctx!.beginPath(); ctx!.moveTo(tx, ty); ctx!.lineTo(x, y); ctx!.stroke()
          ctx!.fillStyle = "#FFE7B0"; ctx!.beginPath(); ctx!.arc(x, y, 1.8, 0, Math.PI * 2); ctx!.fill()
          if (ps.p >= 1) {
            pulses.splice(q, 1)
            const outward = nodes[ps.to].links.filter(j => j >= 0 && nodes[j].r > nodes[ps.to].r)
            if (outward.length && Math.random() < 0.82) {
              pulses.push({ from: ps.to, to: outward[(Math.random() * outward.length) | 0], p: 0, speed: ps.speed })
            }
          }
        }
      }

      raf = requestAnimationFrame(frame)
    }

    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas.parentElement!)
    raf = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [])

  const tx = STATUS[lang === "uk" ? "uk" : "en"]
  return (
    <div className={`acl${fullscreen ? " acl-full" : ""}${exiting ? " acl-out" : ""}`} style={{ animationDelay: `${delay}ms` }}
      role="status" aria-label={tx[step]}>
      <canvas ref={ref} aria-hidden />
      <div className="acl-core"><CoreEye size={fullscreen ? 128 : 104} mood="thinking" /></div>
      <div className="acl-tx">
        <b>ASTRO<span>CORE</span></b>
        <small key={step}>{tx[step]}<i>.</i><i>.</i><i>.</i></small>
      </div>
    </div>
  )
}
