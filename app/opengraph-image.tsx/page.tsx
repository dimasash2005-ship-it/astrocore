import { ImageResponse } from "next/og"

export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// ── Change to "en" for an English card (Discord / Reddit / X audience) ──
const LANG: "uk" | "en" = "uk"

const COPY = {
  uk: {
    alt: "AstroCore — робочий простір для AI-агента",
    h1a: "Робочий простір",
    h1b: "для ",
    h1c: "AI-агента",
    sub: "Памʼять, звіти й галерея для OpenClaw — в одному місці",
    chips: ["Памʼять", "Звіти", "Галерея", "Чати"],
    cmd: "Підключення однією командою",
    chatQ: "Склади звіт по Threads за тиждень",
    chatA: "Готово — 3 графіки, 12 інсайтів",
    mem: "Памʼять",
    memT: "Тон бренду: коротко, з гумором",
    rep: "Звіт · охоплення",
  },
  en: {
    alt: "AstroCore — the workspace for your AI agent",
    h1a: "The workspace",
    h1b: "for your ",
    h1c: "AI agent",
    sub: "Memory, reports and gallery for OpenClaw — in one place",
    chips: ["Memory", "Reports", "Gallery", "Chats"],
    cmd: "Connect with one command",
    chatQ: "Build a weekly Threads report",
    chatA: "Done — 3 charts, 12 insights",
    mem: "Memory",
    memT: "Brand voice: short, a bit witty",
    rep: "Report · reach",
  },
}[LANG]

export const alt = COPY.alt

// Load only the glyphs we use (keeps the image fast and supports Cyrillic)
// If Google Fonts is unreachable the card still renders with the default font
// instead of failing the whole build.
async function font(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`
    const css = await (await fetch(url)).text()
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/)
    if (!src) return null
    const res = await fetch(src[1])
    return res.ok ? await res.arrayBuffer() : null
  } catch {
    return null
  }
}

const RED = "#E8002A"
const BG = "#08080F"
const MUTED = "#8B86A8"

export default async function Image() {
  const allText = Object.values(COPY).flat().join(" ") + " ASTROCORE.ONE A L >_ · — 0123456789"
  const [regular, bold, mono] = await Promise.all([
    font("Manrope", 500, allText),
    font("Manrope", 800, allText),
    font("JetBrains+Mono", 600, allText),
  ])

  const chipColors = ["#8B5CF6", "#06B6D4", "#EC4899", "#22C55E"]
  const bars = [38, 62, 48, 80, 66, 100, 86]

  return new ImageResponse(
    (
      <div style={{
        width: "100%", height: "100%", display: "flex", position: "relative",
        background: BG, fontFamily: "Manrope", color: "#F0EDF8", overflow: "hidden",
      }}>
        {/* dot grid */}
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, display: "flex",
          backgroundImage: "radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px)", backgroundSize: "28px 28px" }} />
        {/* red glows */}
        <div style={{ position: "absolute", top: -260, right: -180, width: 820, height: 820, borderRadius: 820, display: "flex",
          background: "radial-gradient(circle, rgba(232,0,42,0.30) 0%, rgba(232,0,42,0) 62%)" }} />
        <div style={{ position: "absolute", bottom: -300, left: -200, width: 700, height: 700, borderRadius: 700, display: "flex",
          background: "radial-gradient(circle, rgba(232,0,42,0.12) 0%, rgba(232,0,42,0) 60%)" }} />
        {/* bottom signal line */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 4, display: "flex",
          background: "linear-gradient(90deg, rgba(232,0,42,0) 0%, #E8002A 45%, rgba(232,0,42,0) 100%)" }} />

        {/* ── Left ── */}
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 0 0 76px", width: 680 }}>
          {/* brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 15, display: "flex", alignItems: "center", justifyContent: "center",
              background: "linear-gradient(145deg, #FF1A3E 0%, #9E0019 100%)", boxShadow: "0 0 40px rgba(232,0,42,0.55)",
              fontSize: 30, fontWeight: 800, color: "#fff" }}>A</div>
            <div style={{ fontFamily: "JetBrains Mono", fontSize: 24, color: MUTED, letterSpacing: 4 }}>ASTROCORE.ONE</div>
          </div>

          {/* headline */}
          <div style={{ display: "flex", flexDirection: "column", marginTop: 38, fontSize: 70, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2 }}>
            <div style={{ display: "flex" }}>{COPY.h1a}</div>
            <div style={{ display: "flex" }}>
              <span>{COPY.h1b}</span><span style={{ color: RED }}>{COPY.h1c}</span>
            </div>
          </div>

          <div style={{ display: "flex", fontSize: 27, color: MUTED, marginTop: 24, lineHeight: 1.35, maxWidth: 560 }}>{COPY.sub}</div>

          {/* chips */}
          <div style={{ display: "flex", gap: 10, marginTop: 34 }}>
            {COPY.chips.map((c, i) => (
              <div key={c} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 16px", borderRadius: 12, fontSize: 21,
                background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)", color: "#D8D4EC" }}>
                <div style={{ width: 10, height: 10, borderRadius: 10, background: chipColors[i], display: "flex" }} />
                <span>{c}</span>
              </div>
            ))}
          </div>

          {/* command pill */}
          <div style={{ display: "flex", marginTop: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderRadius: 12,
              background: "rgba(232,0,42,0.10)", border: "1px solid rgba(232,0,42,0.45)" }}>
              <div style={{ fontFamily: "JetBrains Mono", fontSize: 20, color: RED, display: "flex" }}>{">_"}</div>
              <div style={{ fontSize: 21, color: "#F0EDF8", display: "flex" }}>{COPY.cmd}</div>
            </div>
          </div>
        </div>

        {/* ── Right: product preview ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, position: "absolute", right: 64, top: 92, width: 400 }}>
          {/* chat card */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: 20, borderRadius: 20,
            background: "linear-gradient(160deg, #15152A 0%, #0E0E18 100%)", border: "1px solid rgba(232,0,42,0.35)",
            boxShadow: "0 0 50px rgba(232,0,42,0.18)" }}>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", padding: "10px 14px", borderRadius: 14, fontSize: 18, background: "rgba(255,255,255,0.08)", color: "#E4E0F4", maxWidth: 300 }}>{COPY.chatQ}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 34, height: 34, borderRadius: 10, background: RED, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#fff" }}>L</div>
              <div style={{ display: "flex", padding: "10px 14px", borderRadius: 14, fontSize: 18, background: "rgba(232,0,42,0.14)", border: "1px solid rgba(232,0,42,0.3)", color: "#fff" }}>{COPY.chatA}</div>
            </div>
          </div>

          <div style={{ display: "flex", gap: 16 }}>
            {/* memory card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 192, padding: 16, borderRadius: 18,
              background: "linear-gradient(160deg, #13131F 0%, #0E0E18 100%)", border: "1px solid rgba(139,92,246,0.35)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "JetBrains Mono", fontSize: 14, color: "#A78BFA", letterSpacing: 1 }}>
                <div style={{ width: 8, height: 8, borderRadius: 8, background: "#8B5CF6", display: "flex" }} /><span>{COPY.mem.toUpperCase()}</span>
              </div>
              <div style={{ display: "flex", fontSize: 17, color: "#D8D4EC", lineHeight: 1.35 }}>{COPY.memT}</div>
            </div>
            {/* report card */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 192, padding: 16, borderRadius: 18,
              background: "linear-gradient(160deg, #13131F 0%, #0E0E18 100%)", border: "1px solid rgba(6,182,212,0.35)" }}>
              <div style={{ display: "flex", fontFamily: "JetBrains Mono", fontSize: 14, color: "#67E8F9", letterSpacing: 1 }}>{COPY.rep.toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 62 }}>
                {bars.map((h, i) => (
                  <div key={i} style={{ display: "flex", width: 16, height: `${h}%`, borderRadius: 4,
                    background: i === bars.length - 2 ? RED : "rgba(6,182,212,0.55)" }} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        regular ? { name: "Manrope", data: regular, weight: 500 as const, style: "normal" as const } : null,
        bold    ? { name: "Manrope", data: bold,    weight: 800 as const, style: "normal" as const } : null,
        mono    ? { name: "JetBrains Mono", data: mono, weight: 600 as const, style: "normal" as const } : null,
      ].filter((f): f is NonNullable<typeof f> => f !== null),
    },
  )
}