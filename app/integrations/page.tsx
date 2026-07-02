"use client"

import { useState, useEffect } from "react"
import {
  Puzzle, Check, Copy, Download, Key,
  Clock, BookOpen, MessageSquare, Edit3,
  Lightbulb, Zap, Globe, Code2, Search,
  Workflow, ExternalLink, AlertCircle, ArrowRight,
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
  amber:"#F59E0B",
}

const ENDPOINT = "https://astrocore.ai/api/integrations/obsidian/chat"

const USER_STEPS = [
  {
    n: "1",
    label: "Завантаж плагін",
    desc: "Один файл. Встанови в Obsidian через Community Plugins.",
    active: true,
  },
  {
    n: "2",
    label: "Згенеруй API ключ",
    desc: "Один клік у налаштуваннях AstroCore.",
    active: false,
  },
  {
    n: "3",
    label: "Встав ключ в Obsidian",
    desc: "Відкрий налаштування плагіна → встав ключ → готово.",
    active: false,
  },
]

const FEATURES = [
  { icon: MessageSquare, label: "Ask AstroCore",     desc: "Запитуй прямо з нотатки"       },
  { icon: Edit3,         label: "Rewrite",           desc: "Перепиши виділений текст"       },
  { icon: BookOpen,      label: "Summarize",         desc: "Підсумок поточної нотатки"      },
  { icon: Lightbulb,     label: "Explain",           desc: "Поясни виділений фрагмент"     },
  { icon: Zap,           label: "Save to Vault",     desc: "Збережи результат (скоро)"      },
]

const COMING_SOON = [
  { id: "vscode",   name: "VS Code",           icon: Code2,    color: "#007ACC", desc: "Виклик AstroCore прямо з редактора коду."       },
  { id: "browser",  name: "Browser Extension", icon: Globe,    color: "#F59E0B", desc: "AstroCore в будь-якій вкладці браузера."        },
  { id: "raycast",  name: "Raycast",           icon: Search,   color: "#FF6363", desc: "Швидкий доступ через Raycast launcher."         },
  { id: "zapier",   name: "Zapier",            icon: Zap,      color: "#FF4A00", desc: "Автоматизація з тисячами сервісів через Zapier."},
  { id: "n8n",      name: "n8n",               icon: Workflow, color: "#EA4B71", desc: "Self-hosted автоматизація через n8n."           },
  { id: "make",     name: "Make",              icon: Puzzle,   color: "#6D00CC", desc: "Візуальна автоматизація через Make."            },
]

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true); setTimeout(() => setCopied(false), 2000)
      })
    }} style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "7px 12px", borderRadius: 8, border: "none",
      cursor: "pointer", fontSize: 12, fontWeight: 500,
      background: copied ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.07)",
      color: copied ? T.green : T.t2, transition: "all 130ms ease",
    }}>
      {copied ? <Check size={12} /> : <Copy size={12} />}
      {copied ? "Скопійовано" : "Копіювати"}
    </button>
  )
}

function ComingSoonBadge() {
  return (
    <span style={{
      fontSize: 9.5, padding: "2px 7px", borderRadius: 5, fontWeight: 600,
      background: "rgba(255,255,255,0.05)", color: T.t4,
      border: "0.5px solid rgba(255,255,255,0.08)",
      textTransform: "uppercase", letterSpacing: "0.06em",
    }}>
      Скоро
    </span>
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
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
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
                Integration Hub · Beta
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>Інтеграції</h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
              Використовуй AstroCore в улюблених інструментах
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 48px 56px", maxWidth: 1000 }}>

          {/* ── Obsidian card ── */}
          <div style={{
            background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
            border: "1px solid rgba(232,0,42,0.22)", borderRadius: 16,
            overflow: "hidden", marginBottom: 32,
            boxShadow: "0 0 48px rgba(232,0,42,0.06)",
          }}>

            {/* Header */}
            <div style={{
              padding: "20px 24px 18px", borderBottom: `0.5px solid ${T.b1}`,
              background: "rgba(232,0,42,0.04)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              flexWrap: "wrap", gap: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{
                  width: 50, height: 50, borderRadius: 14, fontSize: 24,
                  background: "linear-gradient(145deg,#6C3FA0 0%,#4A2870 100%)",
                  boxShadow: "0 0 20px rgba(108,63,160,0.35)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>🔮</div>
                <div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: T.t1, marginBottom: 5 }}>Obsidian</div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "2px 9px", borderRadius: 20,
                    background: "rgba(34,197,94,0.10)", border: "0.5px solid rgba(34,197,94,0.25)",
                    fontSize: 10.5, color: T.green, fontWeight: 600,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.green, display: "inline-block" }} />
                    Доступно · MVP Beta
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button disabled title="Скоро" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9, border: "none",
                  background: "rgba(255,255,255,0.05)", color: T.t4,
                  fontSize: 13, fontWeight: 500, cursor: "not-allowed",
                }}>
                  <Download size={14} /> Download Plugin
                  <span style={{ marginLeft: 4, fontSize: 9.5, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: T.t4 }}>Скоро</span>
                </button>

                <button disabled title="Скоро" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9, border: "none",
                  background: "rgba(232,0,42,0.10)", color: "#FF6B6B",
                  fontSize: 13, fontWeight: 500, cursor: "not-allowed",
                }}>
                  <Key size={14} /> Generate API Key
                  <span style={{ marginLeft: 4, fontSize: 9.5, padding: "1px 5px", borderRadius: 4, background: "rgba(232,0,42,0.12)", color: "#FF6B6B" }}>Скоро</span>
                </button>

                <a href="/docs/integrations/obsidian" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "9px 16px", borderRadius: 9,
                  background: "rgba(255,255,255,0.06)", border: `0.5px solid ${T.b1}`,
                  color: T.t2, fontSize: 13, textDecoration: "none",
                }}>
                  <ExternalLink size={14} /> Документація
                </a>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "24px 24px", display: "flex", flexDirection: "column", gap: 28 }}>

              <p style={{ fontSize: 14, color: T.t2, lineHeight: 1.65, margin: 0, maxWidth: 580 }}>
                AstroCore прямо в Obsidian — запитуй AI, переписуй, підсумовуй нотатки і пояснюй тексти, не виходячи з редактора.
              </p>

              {/* 3-step user flow */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 16 }}>
                  Як це працює
                </div>
                <div style={{ display: "flex", gap: 0, flexWrap: "wrap" }}>
                  {USER_STEPS.map((step, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 0 }}>
                      <div style={{
                        display: "flex", flexDirection: "column", gap: 8,
                        padding: "14px 18px", borderRadius: 12,
                        background: step.active ? "rgba(232,0,42,0.08)" : "rgba(255,255,255,0.03)",
                        border: `0.5px solid ${step.active ? "rgba(232,0,42,0.25)" : "rgba(255,255,255,0.07)"}`,
                        minWidth: 180, maxWidth: 220,
                        position: "relative",
                      }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: "50%",
                          background: step.active ? "rgba(232,0,42,0.20)" : "rgba(255,255,255,0.06)",
                          border: `0.5px solid ${step.active ? "rgba(232,0,42,0.40)" : "rgba(255,255,255,0.12)"}`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 12, fontWeight: 700,
                          color: step.active ? T.red : T.t4,
                        }}>
                          {step.n}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 600, color: step.active ? T.t1 : T.t3 }}>{step.label}</div>
                        <div style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.5 }}>{step.desc}</div>
                        {!step.active && (
                          <div style={{ position: "absolute", top: 10, right: 12 }}>
                            <ComingSoonBadge />
                          </div>
                        )}
                      </div>
                      {i < USER_STEPS.length - 1 && (
                        <ArrowRight size={14} style={{ color: T.t4, flexShrink: 0, margin: "0 8px" }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Features */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                  Що вмієш
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {FEATURES.map(({ icon: Icon, label, desc }) => (
                    <div key={label} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", borderRadius: 9,
                      background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
                    }}>
                      <Icon size={13} style={{ color: T.red, opacity: 0.75, flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 500, color: T.t1 }}>{label}</div>
                        <div style={{ fontSize: 10.5, color: T.t4 }}>{desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Endpoint */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 10 }}>
                  API Endpoint
                </div>
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  padding: "11px 16px", borderRadius: 10,
                  background: "rgba(0,0,0,0.35)", border: "0.5px solid rgba(125,211,252,0.14)",
                }}>
                  <code style={{ fontSize: 13, color: "#7DD3FC", fontFamily: "monospace" }}>{ENDPOINT}</code>
                  <CopyBtn text={ENDPOINT} />
                </div>
              </div>

              {/* Beta notice */}
              <div style={{
                display: "flex", alignItems: "flex-start", gap: 10,
                padding: "12px 14px", borderRadius: 10,
                background: "rgba(245,158,11,0.07)", border: "0.5px solid rgba(245,158,11,0.22)",
              }}>
                <AlertCircle size={14} style={{ color: T.amber, flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 12.5, color: "#D4A847", lineHeight: 1.6 }}>
                  <strong style={{ color: T.amber }}>Beta:</strong>{" "}
                  Зараз плагін доступний локально. Публічне завантаження та API ключі — в найближчих оновленнях. Слідкуй за анонсами.
                </div>
              </div>

            </div>
          </div>

          {/* Coming soon */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 14 }}>
              Незабаром
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px,1fr))", gap: 12 }}>
              {COMING_SOON.map(({ id, name, icon: Icon, color, desc }) => (
                <div key={id} style={{
                  background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
                  border: `0.5px solid ${T.b1}`, borderRadius: 14,
                  padding: "16px 18px", opacity: 0.55,
                  display: "flex", flexDirection: "column", gap: 10,
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 9,
                        background: `${color}18`, border: `0.5px solid ${color}30`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={16} style={{ color }} />
                      </div>
                      <span style={{ fontSize: 13.5, fontWeight: 600, color: T.t2 }}>{name}</span>
                    </div>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 20,
                      background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.08)",
                      fontSize: 9.5, color: T.t4,
                    }}>
                      <Clock size={9} /> Скоро
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.5 }}>{desc}</div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}