"use client"

import { useState, useEffect } from "react"
import {
  Key, Shield, Zap, Brain, Bot,
  BookOpen, Puzzle, Eye, EyeOff,
  Copy, Check, Plus, Trash2, Clock,
  AlertCircle, Activity, Lock,
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

type Permission = { id: string; icon: React.ElementType; label: string }

const PERMISSIONS: Permission[] = [
  { id: "chat",         icon: Zap,      label: "Chat"         },
  { id: "vault",        icon: BookOpen, label: "Vault"        },
  { id: "memory",       icon: Brain,    label: "Memory"       },
  { id: "agents",       icon: Bot,      label: "Agents"       },
  { id: "integrations", icon: Puzzle,   label: "Integrations" },
]

type MockKey = {
  id: string
  name: string
  masked: string
  created: string
  lastUsed: string | null
  status: "active" | "revoked"
  permissions: string[]
}

const MOCK_KEYS: MockKey[] = [
  {
    id: "1",
    name: "Obsidian Plugin",
    masked: "ac_live_••••••••••••••••••",
    created: "2025-06-01",
    lastUsed: null,
    status: "active",
    permissions: ["chat", "vault", "memory"],
  },
]

function PermBadge({ id }: { id: string }) {
  const p = PERMISSIONS.find(x => x.id === id)
  if (!p) return null
  const Icon = p.icon
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 4,
      fontSize: 10.5, padding: "2px 8px", borderRadius: 5,
      background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)",
      color: T.t3,
    }}>
      <Icon size={10} style={{ color: T.t4 }} />{p.label}
    </span>
  )
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button onClick={() => {
      navigator.clipboard.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1800) })
    }} style={{
      padding: "4px 8px", borderRadius: 6, border: "none", cursor: "pointer", lineHeight: 0,
      background: "none", color: ok ? T.green : T.t4, transition: "color 120ms ease",
    }}>
      {ok ? <Check size={13} /> : <Copy size={13} />}
    </button>
  )
}

function Toast({ msg, onHide }: { msg: string; onHide: () => void }) {
  useEffect(() => { const t = setTimeout(onHide, 3000); return () => clearTimeout(t) }, [onHide])
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
      zIndex: 200, display: "flex", alignItems: "center", gap: 9,
      padding: "10px 18px", borderRadius: 11,
      background: "#0F0F1E", border: "0.5px solid rgba(245,158,11,0.35)",
      boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      fontSize: 13, color: T.amber,
    }}>
      <AlertCircle size={14} style={{ flexShrink: 0 }} />
      {msg}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Card({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.22)" : T.b1}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {children}
    </div>
  )
}

export default function DeveloperPage() {
  const [pulse,   setPulse]   = useState(false)
  const [toast,   setToast]   = useState("")
  const [keys,    setKeys]    = useState<MockKey[]>(MOCK_KEYS)
  const [reveal,  setReveal]  = useState<Record<string, boolean>>({})

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  function handleGenerate() {
    setToast("API Keys у Beta. Реальна генерація буде доступна незабаром.")
  }

  function handleRevoke(id: string) {
    if (!window.confirm("Відкликати цей ключ? Це незворотно.")) return
    setKeys(prev => prev.map(k => k.id === id ? { ...k, status: "revoked" as const } : k))
  }

  function toggleReveal(id: string) {
    setReveal(prev => ({ ...prev, [id]: !prev[id] }))
  }

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
                Developer Center · Beta
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
              API Keys
            </h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
              Для Obsidian, VS Code, Browser Extension та майбутніх інтеграцій
            </p>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 48px 56px", maxWidth: 860, display: "flex", flexDirection: "column", gap: 28 }}>

          {/* ── API Keys ── */}
          <Section title="API Ключі">
            <Card>
              {/* Card header */}
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "14px 18px 12px", borderBottom: `0.5px solid ${T.b1}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Key size={13} style={{ color: T.red, opacity: 0.75 }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                    {keys.length} {keys.length === 1 ? "ключ" : "ключів"}
                  </span>
                </div>
                <button onClick={handleGenerate} style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                  background: "rgba(232,0,42,0.10)", color: T.red,
                  fontSize: 12.5, fontWeight: 500, transition: "background 130ms ease",
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.18)" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.10)" }}
                >
                  <Plus size={13} /> Generate API Key
                  <span style={{
                    marginLeft: 4, fontSize: 9, padding: "1px 5px", borderRadius: 4,
                    background: "rgba(232,0,42,0.14)", color: "#FF6B6B",
                  }}>Beta</span>
                </button>
              </div>

              {/* Key list */}
              <div style={{ padding: "8px 0" }}>
                {keys.length === 0 ? (
                  <div style={{ padding: "36px 18px", textAlign: "center" }}>
                    <Key size={24} style={{ color: T.t4, opacity: 0.4, margin: "0 auto 12px" }} />
                    <div style={{ fontSize: 13, color: T.t4 }}>API ключів ще немає</div>
                    <div style={{ fontSize: 12, color: T.t4, opacity: 0.6, marginTop: 4 }}>
                      Натисни «Generate API Key» щоб створити перший ключ
                    </div>
                  </div>
                ) : keys.map(k => (
                  <div key={k.id} style={{
                    display: "flex", alignItems: "flex-start", gap: 14,
                    padding: "14px 18px",
                    borderBottom: `0.5px solid ${T.b1}`,
                    opacity: k.status === "revoked" ? 0.45 : 1,
                  }}>
                    {/* Icon */}
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                      background: k.status === "active" ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                      border: `0.5px solid ${k.status === "active" ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.07)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Key size={15} style={{ color: k.status === "active" ? T.green : T.t4 }} />
                    </div>

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: T.t1 }}>{k.name}</span>
                        <span style={{
                          fontSize: 9.5, padding: "2px 7px", borderRadius: 5, fontWeight: 600,
                          background: k.status === "active" ? "rgba(34,197,94,0.10)" : "rgba(255,255,255,0.04)",
                          color: k.status === "active" ? T.green : T.t4,
                          border: `0.5px solid ${k.status === "active" ? "rgba(34,197,94,0.22)" : "rgba(255,255,255,0.08)"}`,
                          textTransform: "uppercase",
                        }}>
                          {k.status === "active" ? "Активний" : "Відкликано"}
                        </span>
                      </div>

                      {/* Masked key */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
                        padding: "6px 10px", borderRadius: 7,
                        background: "rgba(0,0,0,0.3)", border: "0.5px solid rgba(125,211,252,0.12)",
                        width: "fit-content",
                      }}>
                        <code style={{ fontSize: 12, color: reveal[k.id] ? "#7DD3FC" : T.t3, fontFamily: "monospace" }}>
                          {reveal[k.id] ? "ac_live_••••demo_key••••" : k.masked}
                        </code>
                        <button onClick={() => toggleReveal(k.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: "2px" }}>
                          {reveal[k.id] ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                        <CopyBtn text={k.masked} />
                      </div>

                      {/* Meta */}
                      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: T.t4, display: "flex", alignItems: "center", gap: 4 }}>
                          <Clock size={10} /> Створено {k.created}
                        </span>
                        <span style={{ fontSize: 11, color: T.t4 }}>
                          Останнє використання: {k.lastUsed ?? "Ніколи"}
                        </span>
                      </div>

                      {/* Permissions */}
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {k.permissions.map(p => <PermBadge key={p} id={p} />)}
                      </div>
                    </div>

                    {/* Actions */}
                    {k.status === "active" && (
                      <button onClick={() => handleRevoke(k.id)} style={{
                        padding: "6px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: "rgba(255,255,255,0.04)", color: T.t4, fontSize: 11.5,
                        display: "flex", alignItems: "center", gap: 5, flexShrink: 0,
                        transition: "color 120ms ease, background 120ms ease",
                      }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.color = "#FF4D6A"
                          ;(e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)"
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.color = T.t4
                          ;(e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
                        }}
                      >
                        <Trash2 size={12} /> Відкликати
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          {/* ── Permissions ── */}
          <Section title="Дозволи">
            <Card>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontSize: 12.5, color: T.t3, marginBottom: 4, lineHeight: 1.55 }}>
                  При генерації ключа обери дозволи. Рекомендовано давати лише потрібні.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 8 }}>
                  {PERMISSIONS.map(({ id, icon: Icon, label }) => (
                    <div key={id} style={{
                      display: "flex", alignItems: "center", gap: 9,
                      padding: "9px 12px", borderRadius: 9,
                      background: "rgba(255,255,255,0.03)", border: `0.5px solid ${T.b1}`,
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                        background: "rgba(232,0,42,0.09)", border: "0.5px solid rgba(232,0,42,0.20)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Icon size={13} style={{ color: T.red, opacity: 0.75 }} />
                      </div>
                      <span style={{ fontSize: 12.5, color: T.t2 }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </Section>

          {/* ── Usage ── */}
          <Section title="Використання">
            <Card>
              <div style={{ padding: "16px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(180px,1fr))", gap: 14 }}>
                {[
                  { label: "Запити сьогодні",    value: "—",      icon: Activity },
                  { label: "Запити цього місяця", value: "—",      icon: Zap      },
                  { label: "Останній запит",       value: "Ніколи", icon: Clock    },
                  { label: "Поточний план",        value: "Beta",   icon: Shield   },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Icon size={12} style={{ color: T.t4 }} />
                      <span style={{ fontSize: 10.5, color: T.t4 }}>{label}</span>
                    </div>
                    <span style={{ fontSize: 20, fontWeight: 700, color: T.t1, letterSpacing: "-0.03em" }}>{value}</span>
                  </div>
                ))}
              </div>
            </Card>
          </Section>

          {/* ── Security ── */}
          <Section title="Безпека">
            <div style={{
              display: "flex", alignItems: "flex-start", gap: 11,
              padding: "13px 16px", borderRadius: 11,
              background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.20)",
            }}>
              <Lock size={14} style={{ color: T.red, flexShrink: 0, marginTop: 1 }} />
              <div style={{ fontSize: 12.5, color: T.t3, lineHeight: 1.65 }}>
                <strong style={{ color: T.t1 }}>API ключі — це секрет.</strong>{" "}
                Не передавай їх нікому і не публікуй у відкритих репозиторіях.
                Якщо ключ скомпрометований — одразу відкличи його тут. Ми не зберігаємо ключі у відкритому вигляді.
              </div>
            </div>
          </Section>

        </div>
      </div>

      {toast && <Toast msg={toast} onHide={() => setToast("")} />}
    </>
  )
}