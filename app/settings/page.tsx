"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Settings, User, Key, Brain, Shield,
  ChevronRight, Activity, Database,
  Trash2, BookOpen, Image as ImageIcon,
  Bot, MessageSquare, AlertCircle, Check,
} from "lucide-react"
import {
  agentStore, chatStore, providerStore,
  vaultStore, galleryStore,
} from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  s2:   "#16162A",
  b1:   "rgba(255,255,255,0.10)",
  b2:   "rgba(255,255,255,0.16)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
  green: "#22C55E",
}

// ─── Setting row ──────────────────────────────────────────────────

function SettingRow({
  icon: Icon,
  label,
  desc,
  action,
  actionLabel,
  actionVariant = "ghost",
  href,
  danger,
}: {
  icon: React.ElementType
  label: string
  desc?: string
  action?: () => void
  actionLabel?: string
  actionVariant?: "ghost" | "danger" | "primary"
  href?: string
  danger?: boolean
}) {
  const router = useRouter()
  const [hov, setHov] = useState(false)

  const actionBg =
    actionVariant === "danger"  ? "rgba(232,0,42,0.10)"     :
    actionVariant === "primary" ? T.red                      :
    "rgba(255,255,255,0.05)"

  const actionBgHov =
    actionVariant === "danger"  ? "rgba(232,0,42,0.20)"     :
    actionVariant === "primary" ? "#FF1A3E"                  :
    "rgba(255,255,255,0.09)"

  const actionColor =
    actionVariant === "danger"  ? "#FF4D6A" :
    actionVariant === "primary" ? "#fff"    :
    T.t2

  const actionBorder =
    actionVariant === "danger"  ? "0.5px solid rgba(232,0,42,0.25)" :
    actionVariant === "primary" ? "none"                              :
    `0.5px solid ${T.b1}`

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={href ? () => router.push(href) : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 14,
        padding: "14px 16px", borderRadius: 10, cursor: href ? "pointer" : "default",
        background: href && hov ? "rgba(255,255,255,0.03)" : "transparent",
        transition: "background 130ms ease",
      }}
    >
      <div style={{
        width: 34, height: 34, borderRadius: 9, flexShrink: 0,
        background: danger ? "rgba(232,0,42,0.09)" : "rgba(255,255,255,0.05)",
        border: danger ? "0.5px solid rgba(232,0,42,0.20)" : "0.5px solid rgba(255,255,255,0.08)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon size={15} style={{ color: danger ? T.red : T.t3, opacity: 0.85 }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: danger ? T.t1 : T.t1 }}>{label}</div>
        {desc && <div style={{ fontSize: 11.5, color: T.t4, marginTop: 2, lineHeight: 1.4 }}>{desc}</div>}
      </div>

      {href && !action && (
        <ChevronRight size={14} style={{ color: hov ? T.t2 : T.t4, flexShrink: 0, transition: "color 130ms ease" }} />
      )}

      {action && actionLabel && (
        <button
          onClick={e => { e.stopPropagation(); action() }}
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "6px 13px", borderRadius: 8, fontSize: 12,
            fontWeight: 500, cursor: "pointer", flexShrink: 0,
            background: actionBg, border: actionBorder, color: actionColor,
            transition: "background 130ms ease",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = actionBgHov }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = actionBg }}
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ─── Settings section card ────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, accent }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  accent?: boolean
}) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.20)" : T.b1}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "13px 16px 11px",
        borderBottom: `0.5px solid ${T.b1}`,
        background: accent ? "rgba(232,0,42,0.04)" : "transparent",
      }}>
        <Icon size={13} style={{ color: accent ? T.red : T.t4, opacity: 0.85 }} />
        <span style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
          {title}
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        {children}
      </div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: "0.5px", background: T.b1, margin: "0 16px" }} />
}

// ─── Stat chip ────────────────────────────────────────────────────

function Chip({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color?: string
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "9px 14px", borderRadius: 9,
      background: T.s1, border: `0.5px solid ${T.b1}`,
    }}>
      <Icon size={13} style={{ color: color ?? T.red, opacity: 0.75 }} />
      <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>
      <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
    </div>
  )
}

// ─── Confirm danger modal ─────────────────────────────────────────

function ConfirmModal({
  title, desc, onConfirm, onClose,
}: {
  title: string; desc: string; onConfirm: () => void; onClose: () => void
}) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.78)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      <div style={{
        width: "100%", maxWidth: 400, borderRadius: 14,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.28)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
        padding: "22px 22px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
          <AlertCircle size={18} style={{ color: T.red, flexShrink: 0 }} />
          <span style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>{title}</span>
        </div>
        <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, marginBottom: 18 }}>{desc}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>Скасувати</button>
          <button onClick={() => { onConfirm(); onClose() }} style={{
            flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
            background: "rgba(232,0,42,0.15)", border: "0.5px solid rgba(232,0,42,0.30)",
            color: "#FF4D6A", cursor: "pointer",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.25)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.15)" }}
          >Підтвердити</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const [pulse,   setPulse]   = useState(false)
  const [confirm, setConfirm] = useState<null | { title: string; desc: string; action: () => void }>(null)
  const [cleared, setCleared] = useState<string | null>(null)

  const [stats, setStats] = useState({ agents: 0, sessions: 0, providers: 0, vault: 0, gallery: 0 })

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  function loadStats() {
    setStats({
      agents:    agentStore.getAll().length,
      sessions:  chatStore.getAll().length,
      providers: providerStore.getAll().length,
      vault:     vaultStore.getAll().length,
      gallery:   galleryStore.getAll().length,
    })
  }

  useEffect(() => { loadStats() }, [])

  function showConfirm(title: string, desc: string, action: () => void) {
    setConfirm({ title, desc, action })
  }

  function clearData(key: string, label: string, action: () => void) {
    showConfirm(
      `Очистити ${label}?`,
      `Всі ${label.toLowerCase()} будуть видалені назавжди. Це неможливо скасувати.`,
      () => { action(); loadStats(); setCleared(label); setTimeout(() => setCleared(null), 2500) }
    )
  }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>

        {/* scan line */}
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* ── Hero ── */}
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
                width: 5, height: 5, borderRadius: "50%", background: T.red,
                display: "inline-block",
                opacity: pulse ? 1 : 0.3,
                transition: "opacity 900ms ease, box-shadow 900ms ease",
                boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
              }} />
              <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Workspace Online · System Control
              </span>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
              Налаштування
            </h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
              AI Operating Layer · Workspace Settings · System Control
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "24px 48px 56px", maxWidth: 960 }}>

          {/* System status */}
          <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
            <Chip icon={Bot}           label="агентів"   value={stats.agents}    />
            <Chip icon={MessageSquare} label="чатів"     value={stats.sessions}  />
            <Chip icon={Key}           label="провайдерів" value={stats.providers} />
            <Chip icon={BookOpen}      label="у сховищі" value={stats.vault}     />
            <Chip icon={ImageIcon}     label="у галереї" value={stats.gallery}   />
          </div>

          {/* Success cleared */}
          {cleared && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 9, marginBottom: 16,
              background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.22)",
              color: T.green, fontSize: 13,
            }}>
              <Check size={14} /> {cleared} успішно очищено
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* ── Navigation ── */}
            <SectionCard title="Розділи" icon={Settings}>
              <SettingRow
                icon={User}
                label="Акаунт"
                desc="Профіль, аватар, особиста інформація"
                href="/account"
              />
              <Divider />
              <SettingRow
                icon={Key}
                label="Провайдери"
                desc="API ключі, підключені AI моделі"
                href="/providers"
              />
              <Divider />
              <SettingRow
                icon={Brain}
                label="Пам'ять"
                desc="Контекст і знання що інжектуються в агентів"
                href="/memory"
              />
              <Divider />
              <SettingRow
                icon={BookOpen}
                label="Сховище"
                desc="Збережені знання та нотатки"
                href="/vault"
              />
              <Divider />
              <SettingRow
                icon={ImageIcon}
                label="Галерея"
                desc="Збережені виводи AI"
                href="/gallery"
              />
              <Divider />
              <SettingRow
                icon={Key}
                label="Developer Center"
                desc="API Keys, Webhooks, Integrations and Developer tools."
                href="/settings/developer"
              />
            </SectionCard>

            {/* ── System status ── */}
            <SectionCard title="Статус системи" icon={Activity}>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  { label: "AI Core",          value: "Онлайн",         ok: true  },
                  { label: "localStorage",      value: "Доступно",       ok: true  },
                  { label: "Провайдери",        value: stats.providers > 0 ? `${stats.providers} підключено` : "Немає",  ok: stats.providers > 0 },
                  { label: "Активні агенти",    value: stats.agents > 0  ? `${stats.agents} агентів`  : "Немає",         ok: stats.agents > 0  },
                ].map(({ label, value, ok }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: T.t2 }}>{label}</span>
                    <span style={{
                      fontSize: 11.5, padding: "2px 9px", borderRadius: 5, fontWeight: 500,
                      background: ok ? "rgba(34,197,94,0.09)" : "rgba(255,255,255,0.04)",
                      border: `0.5px solid ${ok ? "rgba(34,197,94,0.24)" : "rgba(255,255,255,0.08)"}`,
                      color: ok ? T.green : T.t4,
                    }}>
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* ── Security ── */}
            <SectionCard title="Безпека та приватність" icon={Shield}>
              <div style={{ padding: "12px 16px 6px" }}>
                <div style={{
                  display: "flex", alignItems: "flex-start", gap: 9,
                  padding: "10px 12px", borderRadius: 9,
                  background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
                  marginBottom: 8,
                }}>
                  <Shield size={13} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
                  <span style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.55 }}>
                    Всі дані зберігаються локально у вашому браузері. API ключі, агенти, чати і вся пам'ять — тільки у вашому localStorage. Жодних зовнішніх серверів.
                  </span>
                </div>
              </div>
              <Divider />
              <SettingRow
                icon={Key}
                label="API ключі"
                desc="Перейти до налаштування провайдерів"
                href="/providers"
              />
            </SectionCard>

            {/* ── Data management ── */}
            <SectionCard title="Управління даними" icon={Database} accent>
              <SettingRow
                icon={Bot}
                label="Очистити агентів"
                desc={`Видалити всіх ${stats.agents} агентів назавжди`}
                action={() => clearData("Агенти", "Агенти", () => {
                  agentStore.getAll().forEach(a => agentStore.remove(a.id))
                })}
                actionLabel="Очистити"
                actionVariant="danger"
                danger
              />
              <Divider />
              <SettingRow
                icon={MessageSquare}
                label="Очистити чати"
                desc={`Видалити всі ${stats.sessions} сесії назавжди`}
                action={() => clearData("Чати", "Чати", () => {
                  chatStore.getAll().forEach(s => chatStore.remove(s.id))
                })}
                actionLabel="Очистити"
                actionVariant="danger"
                danger
              />
              <Divider />
              <SettingRow
                icon={Brain}
                label="Очистити пам'ять"
                desc="Видалити весь контекст та знання"
                action={() => clearData("Пам'ять", "Пам'ять", () => {
                  localStorage.removeItem("astrocore_memory")
                })}
                actionLabel="Очистити"
                actionVariant="danger"
                danger
              />
              <Divider />
              <SettingRow
                icon={BookOpen}
                label="Очистити сховище"
                desc={`Видалити всі ${stats.vault} записи`}
                action={() => clearData("Сховище", "Сховище", () => {
                  vaultStore.getAll().forEach(i => vaultStore.remove(i.id))
                })}
                actionLabel="Очистити"
                actionVariant="danger"
                danger
              />
              <Divider />
              <SettingRow
                icon={ImageIcon}
                label="Очистити галерею"
                desc={`Видалити всі ${stats.gallery} виводів`}
                action={() => clearData("Галерея", "Галерея", () => {
                  galleryStore.getAll().forEach(i => galleryStore.remove(i.id))
                })}
                actionLabel="Очистити"
                actionVariant="danger"
                danger
              />
              <Divider />
              <SettingRow
                icon={Trash2}
                label="Скинути всі дані"
                desc="Повністю очистити весь AstroCore workspace"
                action={() => showConfirm(
                  "Скинути весь workspace?",
                  "Всі агенти, чати, провайдери, пам'ять, сховище і галерея будуть видалені. Це неможливо скасувати.",
                  () => {
                    agentStore.getAll().forEach(a => agentStore.remove(a.id))
                    chatStore.getAll().forEach(s => chatStore.remove(s.id))
                    providerStore.getAll().forEach(p => providerStore.remove(p.id))
                    vaultStore.getAll().forEach(i => vaultStore.remove(i.id))
                    galleryStore.getAll().forEach(i => galleryStore.remove(i.id))
                    localStorage.removeItem("astrocore_memory")
                    loadStats()
                    setCleared("Весь workspace")
                  }
                )}
                actionLabel="Скинути все"
                actionVariant="danger"
                danger
              />
            </SectionCard>

            {/* ── About ── */}
            <SectionCard title="Про AstroCore" icon={Settings}>
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "Версія",      value: "0.1.0 Beta"        },
                  { label: "Фреймворк",   value: "Next.js 16"        },
                  { label: "Зберігання",  value: "localStorage"      },
                  { label: "AI Layer",    value: "AstroCore Engine"  },
                ].map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, color: T.t3 }}>{label}</span>
                    <span style={{ fontSize: 13, color: T.t2, fontFamily: "monospace" }}>{value}</span>
                  </div>
                ))}
              </div>
            </SectionCard>

          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          desc={confirm.desc}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
        />
      )}
    </>
  )
}