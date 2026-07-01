"use client"

import { useState, useEffect } from "react"
import {
  Puzzle, Check, Copy, ExternalLink, Clock,
  BookOpen, MessageSquare, Edit3, Lightbulb,
  Zap, Globe, Code2, Search, Workflow,
} from "lucide-react"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  b1:   "rgba(255,255,255,0.10)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
  green:"#22C55E",
}

const OBSIDIAN_ENDPOINT = "/api/integrations/obsidian/chat"

const OBSIDIAN_FEATURES = [
  { icon: MessageSquare, label: "Ask AstroCore",      desc: "Відправ запит прямо з нотатки"    },
  { icon: Edit3,         label: "Rewrite Selection",  desc: "Перепиши виділений текст"          },
  { icon: BookOpen,      label: "Summarize Note",     desc: "Автоматичний підсумок нотатки"     },
  { icon: Lightbulb,     label: "Explain Selection",  desc: "Поясни виділений фрагмент"         },
  { icon: Zap,           label: "Save to Vault",      desc: "Збережи в AstroCore Vault (скоро)" },
]

const OBSIDIAN_STEPS = [
  "Встанови плагін: скопіюй `manifest.json` і `main.js` з `_integrations/obsidian/` у vault",
  "В Obsidian увімкни плагін: Settings → Community Plugins → AstroCore AI",
  "Переконайся що AstroCore запущено локально (`npm run dev`)",
  "Використовуй Command Palette (`Cmd+P`) → шукай \"AstroCore\"",
]

type Integration = {
  id: string
  name: string
  icon: React.ElementType
  description: string
  status: "active" | "soon"
  color: string
}

const INTEGRATIONS: Integration[] = [
  { id: "vscode",    name: "VS Code",           icon: Code2,     description: "Виклик AstroCore прямо з редактора коду.",           status: "soon",   color: "#007ACC" },
  { id: "browser",   name: "Browser Extension", icon: Globe,     description: "AstroCore в будь-якій вкладці браузера.",            status: "soon",   color: "#F59E0B" },
  { id: "raycast",   name: "Raycast",           icon: Search,    description: "Швидкий доступ через Raycast launcher.",              status: "soon",   color: "#FF6363" },
  { id: "zapier",    name: "Zapier",            icon: Zap,       description: "Автоматизація з тисячами сервісів через Zapier.",    status: "soon",   color: "#FF4A00" },
  { id: "n8n",       name: "n8n",               icon: Workflow,  description: "Self-hosted автоматизація через n8n workflow.",       status: "soon",   color: "#EA4B71" },
  { id: "make",      name: "Make",              icon: Puzzle,    description: "Візуальна автоматизація через Make (Integromat).",   status: "soon",   color: "#6D00CC" },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handle() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handle} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 13px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12,
      background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.06)",
      color: copied ? T.green : T.t2,
      transition: "all 130ms ease",
    }}>
      {copied ? <Check size={13} /> : <Copy size={13} />}
      {copied ? "Скопійовано" : "Копіювати"}
    </button>
  )
}

function IntegrationCard({ integration }: { integration: Integration }) {
  const Icon = integration.icon
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${T.b1}`,
      borderRadius: 14, padding: "18px 18px 16px",
      display: "flex", flexDirection: "column", gap: 12,
      opacity: 0.6,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: `${integration.color}18`,
            border: `0.5px solid ${integration.color}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={17} style={{ color: integration.color }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, color: T.t2 }}>{integration.name}</span>
        </div>
        <div style={{
          display: "flex", alignItems: "center", gap: 5,
          padding: "3px 9px", borderRadius: 20,
          background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)",
          fontSize: 10, color: T.t4, fontWeight: 500,
        }}>
          <Clock size={9} />
          Незабаром
        </div>
      </div>
      <div style={{ fontSize: 12.5, color: T.t4, lineHeight: 1.5 }}>
        {integration.description}
      </div>
    </div>
  )
}

export default function IntegrationsPage() {
  const [pulse, setPulse] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0}10%{opacity:1}90%{opacity:1}100%{transform:translateX(200%);opacity:0}
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{
          position: "relative", padding: "36px 48px 28px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
              borderRadius: 20, padding: "3px 10px", marginBottom: 14,
            }}>
              <span style={{
                width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block",
                opacity: pulse ? 1 : 0.3, transition: "opacity 900ms ease, box-shadow 900ms ease",
                boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
              }} />
              <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Integration Hub · 1 активна
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
              Інтеграції
            </h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
              Підключи AstroCore до твоїх улюблених інструментів
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 48px 56px", maxWidth: 1100 }}>

          {/* ── Obsidian card — active ── */}
          <div style={{
            background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
            border: "1px solid rgba(232,0,42,0.22)",
            borderRadius: 16, overflow: "hidden", marginBottom: 32,
            boxShadow: "0 0 48px rgba(232,0,42,0.06)",
          }}>
            {/* Header */}
            <div style={{
              padding: "20px 24px 16px",
              borderBottom: `0.5px solid ${T.b1}`,
              background: "rgba(232,0,42,0.04)",
              display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 48, height: 48, borderRadius: 14,
                  background: "linear-gradient(145deg,#6C3FA0 0%,#4A2870 100%)",
                  boxShadow: "0 0 20px rgba(108,63,160,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                }}>
                  🔮
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: T.t1, marginBottom: 3 }}>Obsidian</div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "2px 9px", borderRadius: 20,
                    background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.28)",
                    fontSize: 10.5, color: T.green, fontWeight: 600,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, display: "inline-block" }} />
                    MVP Ready
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 8 }}>
                <a href="/_integrations/obsidian/README.md" target="_blank" rel="noopener noreferrer" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 13px", borderRadius: 8,
                  background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`,
                  color: T.t2, fontSize: 12, textDecoration: "none",
                }}>
                  <ExternalLink size={12} /> Документація
                </a>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 24 }}>
              <p style={{ fontSize: 13.5, color: T.t2, lineHeight: 1.65, margin: 0, maxWidth: 640 }}>
                Плагін для Obsidian що дозволяє викликати AstroCore AI прямо з нотаток. Запитуй, переписуй, підсумовуй і отримуй пояснення — без виходу з Obsidian.
              </p>

              {/* Features */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                  Можливості
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px,1fr))", gap: 8 }}>
                  {OBSIDIAN_FEATURES.map(({ icon: Icon, label, desc }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "flex-start", gap: 10,
                      padding: "10px 12px", borderRadius: 10,
                      background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={13} style={{ color: T.red, opacity: 0.8 }} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: T.t1, marginBottom: 2 }}>{label}</div>
                        <div style={{ fontSize: 11, color: T.t4, lineHeight: 1.4 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* API Endpoint */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
                  API Endpoint
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "10px 14px", borderRadius: 10,
                  background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(255,255,255,0.08)",
                }}>
                  <code style={{ fontSize: 13, color: "#7DD3FC", fontFamily: "monospace" }}>
                    {OBSIDIAN_ENDPOINT}
                  </code>
                  <CopyButton text={OBSIDIAN_ENDPOINT} />
                </div>
              </div>

              {/* Install steps */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                  Встановлення
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {OBSIDIAN_STEPS.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
                        background: i === 0 ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.05)",
                        border: `0.5px solid ${i === 0 ? "rgba(232,0,42,0.35)" : "rgba(255,255,255,0.10)"}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 10.5, fontWeight: 700,
                        color: i === 0 ? T.red : T.t4,
                      }}>
                        {i + 1}
                      </div>
                      <p style={{ fontSize: 12.5, color: T.t3, margin: 0, lineHeight: 1.55, paddingTop: 2 }}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Build command */}
              <div style={{
                padding: "12px 16px", borderRadius: 10,
                background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(125,211,252,0.14)",
              }}>
                <div style={{ fontSize: 10, color: T.t4, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Збірка плагіна
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <code style={{ fontSize: 12.5, color: "#7DD3FC", fontFamily: "monospace" }}>
                    cd _integrations/obsidian && npm install && npm run build
                  </code>
                  <CopyButton text="cd _integrations/obsidian && npm install && npm run build" />
                </div>
              </div>
            </div>
          </div>

          {/* Coming soon */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 14 }}>
              Незабаром
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px,1fr))", gap: 12 }}>
              {INTEGRATIONS.map(i => <IntegrationCard key={i.id} integration={i} />)}
            </div>
          </div>

          {/* Bottom note */}
          <div style={{
            marginTop: 32, padding: "14px 18px", borderRadius: 12,
            background: "rgba(255,255,255,0.02)", border: `0.5px solid ${T.b1}`,
            fontSize: 12.5, color: T.t4, lineHeight: 1.65,
          }}>
            💡 Маєш ідею для інтеграції? Всі інтеграції є open-source і лежать в папці{" "}
            <code style={{ color: T.t3, fontFamily: "monospace", fontSize: 12 }}>_integrations/</code>{" "}
            в репозиторії AstroCore.
          </div>
        </div>
      </div>
    </>
  )
}