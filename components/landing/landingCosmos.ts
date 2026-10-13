// "Live universe" section for the landing page.
// Standalone (like landingTrust): inserts one section before the final CTA, draws the
// living Core with real agents as stars around it, and follows the EN/UA switch.
// Numbers come from /api/public/cosmos and are shown only when they are real and big enough.

type Cosmos = { agents: number; online: number; colors: string[] }

const TEXT = {
  en: {
    eyebrow: "Live universe",
    title: "Every agent is a <em>star</em>",
    sub: "Each agent on AstroCore grows its own star system: the more it works, the more planets it gets. In the centre is the Core that keeps them all running.",
    online: (n: number, total: number) => `<i></i><b>${n}</b> agents online now · <b>${total}</b> in the AstroCore universe`,
    total: (total: number) => `<i></i><b>${total}</b> agents already live in the AstroCore universe`,
    hint: "Each dot is a real agent",
  },
  uk: {
    eyebrow: "Живий всесвіт",
    title: "Кожен агент — це <em>зірка</em>",
    sub: "Кожен агент в AstroCore вирощує свою зоряну систему: що більше він працює, то більше в нього планет. У центрі — Ядро, яке тримає їх усіх у русі.",
    online: (n: number, total: number) => `<i></i><b>${n}</b> ${ukAgents(n)} онлайн зараз · <b>${total}</b> у всесвіті AstroCore`,
    total: (total: number) => `<i></i><b>${total}</b> ${ukAgents(total)} уже ${total % 10 === 1 && total % 100 !== 11 ? "живе" : "живуть"} у всесвіті AstroCore`,
    hint: "Кожна точка — справжній агент",
  },
}

function ukAgents(n: number): string {
  const d = n % 10, h = n % 100
  if (d === 1 && h !== 11) return "агент"
  if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return "агенти"
  return "агентів"
}

type Star = { r: number; a: number; s: number; size: number; color: string; tw: number; big: boolean; on: boolean }

export function initCosmos(root: HTMLElement): () => void {
  const finalSec = root.querySelector("section.final")
  if (!finalSec) return () => {}

  const sec = document.createElement("section")
  sec.className = "s cz"
  sec.id = "universe"
  sec.innerHTML =
    '<span class="laser"></span><div class="wrap">' +
    '<div class="head"><span class="eyebrow"></span><h2></h2><p></p></div>' +
    '<div class="cz-stage"><canvas aria-hidden="true"></canvas><div class="cz-count" aria-live="polite"></div><div class="cz-hint"></div></div>' +
    "</div>"
  finalSec.parentElement!.insertBefore(sec, finalSec)

  const canvas = sec.querySelector("canvas") as HTMLCanvasElement
  const ctx = canvas.getContext("2d")!
  const countEl = sec.querySelector(".cz-count") as HTMLElement
  const hintEl = sec.querySelector(".cz-hint") as HTMLElement
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false

  let data: Cosmos | null = null
  let stars: Star[] = []
  let W = 0, H = 0, dpr = 1
  let raf = 0, visible = false, t0 = performance.now()
  let look = { x: 0, y: 0 }, lookT = { x: 0, y: 0 }

  // Faint background dust (not agents).
  const dust = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.1 + 0.3, tw: Math.random() * 6 }))

  function lang(): "en" | "uk" {
    const uk = root.querySelector("#lang-uk")
    return uk && uk.getAttribute("aria-pressed") === "true" ? "uk" : "en"
  }
  function render() {
    const t = TEXT[lang()]
    ;(sec.querySelector(".eyebrow") as HTMLElement).textContent = t.eyebrow
    ;(sec.querySelector("h2") as HTMLElement).innerHTML = t.title
    ;(sec.querySelector(".head p") as HTMLElement).textContent = t.sub
    if (data && data.online >= 3) countEl.innerHTML = t.online(data.online, data.agents)
    else if (data && data.agents >= 10) countEl.innerHTML = t.total(data.agents)
    else countEl.innerHTML = ""
    hintEl.textContent = stars.length ? t.hint : ""
  }

  function buildStars() {
    const colors = data?.colors ?? []
    const span = Math.min(W, H * 2)
    stars = colors.map((color, i) => {
      const r = 70 + Math.pow(Math.random(), 0.8) * (span * 0.5 - 60)
      return {
        r, a: Math.random() * Math.PI * 2, s: (0.05 + Math.random() * 0.06) * (90 / r),
        size: 1.2 + Math.random() * 1.8, color, tw: Math.random() * 6,
        big: Math.random() < 0.08, on: i < (data?.online ?? 0),
      }
    })
  }

  function resize() {
    const box = canvas.parentElement!.getBoundingClientRect()
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    W = box.width; H = box.height
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr)
    canvas.style.width = W + "px"; canvas.style.height = H + "px"
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    buildStars()
    draw(performance.now())
  }

  function drawCore(cx: number, cy: number, now: number) {
    const R = Math.max(22, Math.min(34, W / 30))
    const breath = 1 + Math.sin(now / 900) * 0.04
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 5)
    g.addColorStop(0, "rgba(232,0,42,.55)"); g.addColorStop(1, "rgba(232,0,42,0)")
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R * 5 * breath, 0, Math.PI * 2); ctx.fill()

    const rings = [[2.3, 0.95, -0.32, "rgba(255,77,106,.4)", 9000], [1.85, 0.68, 0.45, "rgba(245,177,59,.55)", 6500], [2.5, 0.42, 1.25, "rgba(255,77,106,.3)", 12000]] as const
    rings.forEach(([rx, ry, rot, col, per], i) => {
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot)
      ctx.strokeStyle = col; ctx.lineWidth = 1
      ctx.beginPath(); ctx.ellipse(0, 0, R * rx, R * ry, 0, 0, Math.PI * 2); ctx.stroke()
      const a = (now / per) * Math.PI * 2 + i * 2
      ctx.fillStyle = i === 1 ? "#F5B13B" : "#fff"
      ctx.beginPath(); ctx.arc(Math.cos(a) * R * rx, Math.sin(a) * R * ry, i === 1 ? 2.6 : 2, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
    })

    const b = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.35, R * 0.1, cx, cy, R)
    b.addColorStop(0, "#FF7A93"); b.addColorStop(0.45, "#E8002A"); b.addColorStop(1, "#36000E")
    ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill()

    look.x += (lookT.x - look.x) * 0.12; look.y += (lookT.y - look.y) * 0.12
    const blink = (now % 5500) > 5250 ? 0.12 : 1
    const px = cx + look.x * R * 0.32, py = cy + look.y * R * 0.32
    ctx.fillStyle = "#050003"
    ctx.beginPath(); ctx.ellipse(px, py, R * 0.37, R * 0.37 * blink, 0, 0, Math.PI * 2); ctx.fill()
    if (blink === 1) { ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.beginPath(); ctx.arc(px + R * 0.13, py - R * 0.15, R * 0.09, 0, Math.PI * 2); ctx.fill() }
    ctx.strokeStyle = "rgba(255,154,174,.45)"; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
  }

  function draw(now: number) {
    const dt = Math.min(64, now - t0); t0 = now
    ctx.clearRect(0, 0, W, H)
    const cx = W / 2, cy = H / 2

    for (const d of dust) {
      ctx.globalAlpha = 0.25 + 0.25 * Math.sin(now / 1400 + d.tw)
      ctx.fillStyle = "#fff"; ctx.fillRect(d.x * W, d.y * H, d.s, d.s)
    }
    ctx.globalAlpha = 1

    const tilt = 0.42
    for (const s of stars) {
      if (!reduce) s.a += s.s * dt / 1000
      const x = cx + Math.cos(s.a) * s.r, y = cy + Math.sin(s.a) * s.r * tilt
      const tw = 0.65 + 0.35 * Math.sin(now / 700 + s.tw)
      const glow = ctx.createRadialGradient(x, y, 0, x, y, s.size * 5)
      glow.addColorStop(0, s.color); glow.addColorStop(1, "rgba(0,0,0,0)")
      ctx.globalAlpha = 0.35 * tw; ctx.fillStyle = glow
      ctx.beginPath(); ctx.arc(x, y, s.size * 5, 0, Math.PI * 2); ctx.fill()
      ctx.globalAlpha = tw; ctx.fillStyle = "#fff"
      ctx.beginPath(); ctx.arc(x, y, s.size * 0.7, 0, Math.PI * 2); ctx.fill()
      if (s.big) {
        ctx.globalAlpha = 0.45; ctx.strokeStyle = s.color; ctx.lineWidth = 0.8
        ctx.beginPath(); ctx.arc(x, y, s.size * 4, 0, Math.PI * 2); ctx.stroke()
      }
      if (s.on) {
        const p = (now / 1800 + s.tw) % 1
        ctx.globalAlpha = 0.6 * (1 - p); ctx.strokeStyle = "#22C55E"; ctx.lineWidth = 1
        ctx.beginPath(); ctx.arc(x, y, s.size * (2 + p * 6), 0, Math.PI * 2); ctx.stroke()
      }
    }
    ctx.globalAlpha = 1
    drawCore(cx, cy, now)
  }

  function loop(now: number) {
    if (!visible) { raf = 0; return }
    draw(now)
    raf = requestAnimationFrame(loop)
  }

  const io = new IntersectionObserver(es => {
    visible = es[0]?.isIntersecting ?? false
    if (visible && !raf && !reduce) { t0 = performance.now(); raf = requestAnimationFrame(loop) }
  }, { rootMargin: "100px" })
  io.observe(canvas)

  const ro = new ResizeObserver(() => resize())
  ro.observe(canvas.parentElement!)

  const onMove = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect()
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 500)
    lookT = { x: (dx / d) * k, y: (dy / d) * k }
    if (reduce) draw(performance.now())
  }
  window.addEventListener("pointermove", onMove, { passive: true })

  const onLang = () => setTimeout(render, 0)
  const btns = [root.querySelector("#lang-en"), root.querySelector("#lang-uk")].filter(Boolean) as Element[]
  btns.forEach(b => b.addEventListener("click", onLang))

  let alive = true
  fetch("/api/public/cosmos")
    .then(r => (r.ok ? r.json() : null))
    .then((d: Cosmos | null) => {
      if (!alive || !d) return
      data = { agents: Number(d.agents) || 0, online: Number(d.online) || 0, colors: Array.isArray(d.colors) ? d.colors.slice(0, 240) : [] }
      buildStars(); render(); draw(performance.now())
    })
    .catch(() => {})

  render()
  resize()

  return () => {
    alive = false
    if (raf) cancelAnimationFrame(raf)
    io.disconnect(); ro.disconnect()
    window.removeEventListener("pointermove", onMove)
    btns.forEach(b => b.removeEventListener("click", onLang))
    sec.remove()
  }
}
