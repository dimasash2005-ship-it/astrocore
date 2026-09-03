"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Settings, User, Key, Brain, Shield,
  ChevronRight, Activity, Database,
  Trash2, BookOpen, Image as ImageIcon,
  Bot, MessageSquare, AlertCircle, Check, Globe,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import { LANGUAGES } from "@/lib/language"

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

// Real Supabase tables (matching every other page in the app) — this
// used to read/clear a stale localStorage-based `lib/store` that had
// nothing to do with the actual data shown on Agents/Chat/Vault/
// Gallery/Memory, so the counts here were wrong and "Clear" didn't
// touch what you actually see elsewhere.
const TABLES = {
  agents:   "agents",
  sessions: "chat_sessions",
  providers:"providers",
  vault:    "vault_items",
  gallery:  "gallery_items",
  memory:   "memory_items",
} as const

type StatsKey = keyof typeof TABLES

async function countTable(table: string, userId: string): Promise<number> {
  const sb = getSupabase()
  const { count } = await sb.from(table).select("id", { count: "exact", head: true }).eq("user_id", userId)
  return count ?? 0
}

async function clearTable(table: string, userId: string): Promise<void> {
  const sb = getSupabase()
  await sb.from(table).delete().eq("user_id", userId)
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
        <div style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{label}</div>
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
// `variant="system"` gets the same grid-textured, mono-caps treatment
// as Dashboard's live-data panels — reserved for "System status" here,
// since that's the one section showing genuine live telemetry. Every
// other section is content/navigation, so it keeps a normal-case
// Space Grotesk title instead of the tracked-uppercase eyebrow every
// section used to share regardless of what it actually contained.

function SectionCard({ title, icon: Icon, children, accent, variant = "content" }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  accent?: boolean
  variant?: "content" | "system"
}) {
  const isSystem = variant === "system"
  return (
    <div style={{
      position: "relative",
      background: isSystem ? "#0A0A10" : "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      backgroundImage: isSystem
        ? "linear-gradient(rgba(255,255,255,0.045) 0.5px, transparent 0.5px), linear-gradient(90deg, rgba(255,255,255,0.045) 0.5px, transparent 0.5px)"
        : undefined,
      backgroundSize: isSystem ? "14px 14px" : undefined,
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.20)" : T.b1}`,
      borderRadius: isSystem ? 10 : 14, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: isSystem ? "11px 16px 10px" : "13px 16px 11px",
        borderBottom: `0.5px solid ${T.b1}`,
        background: accent ? "rgba(232,0,42,0.04)" : isSystem ? "rgba(10,10,16,0.55)" : "transparent",
      }}>
        <Icon size={isSystem ? 12 : 13} style={{ color: accent ? T.red : T.t4, opacity: 0.85 }} />
        <span style={{
          fontFamily: isSystem ? "'JetBrains Mono', monospace" : "'Space Grotesk', sans-serif",
          fontSize: isSystem ? 10 : 13,
          fontWeight: 600,
          color: isSystem ? T.t4 : T.t2,
          textTransform: isSystem ? "uppercase" : "none",
          letterSpacing: isSystem ? "0.07em" : "-0.005em",
        }}>
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

function SectionDivider({ delay = "0s" }: { delay?: string }) {
  return (
    <div aria-hidden style={{
      position: "relative", height: 1.5,
      background: "rgba(255,255,255,0.06)", overflow: "hidden", borderRadius: 1,
    }}>
      <div className="astrocore-hero-sweep" style={{
        position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
        background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
        boxShadow: "0 0 8px rgba(232,0,42,0.75)",
        animationDelay: delay,
      }} />
    </div>
  )
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
      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: T.t1 }}>{value}</span>
      <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
    </div>
  )
}

// ─── Confirm danger modal ─────────────────────────────────────────

function ConfirmModal({
  title, desc, onConfirm, onClose, cancelLabel, confirmLabel,
}: {
  title: string; desc: string; onConfirm: () => void; onClose: () => void
  cancelLabel: string; confirmLabel: string
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
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{title}</span>
        </div>
        <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, marginBottom: 18 }}>{desc}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>{cancelLabel}</button>
          <button onClick={() => { onConfirm(); onClose() }} style={{
            flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
            background: "rgba(232,0,42,0.15)", border: "0.5px solid rgba(232,0,42,0.30)",
            color: "#FF4D6A", cursor: "pointer",
          }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.25)" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.15)" }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { t, language, setLanguage } = useLanguage()
  const [confirm, setConfirm] = useState<null | { title: string; desc: string; action: () => void }>(null)
  const [cleared, setCleared] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)

  const [stats, setStats] = useState<Record<StatsKey, number>>({
    agents: 0, sessions: 0, providers: 0, vault: 0, gallery: 0, memory: 0,
  })

  const loadStats = useCallback(async (uid: string) => {
    const entries = await Promise.all(
      (Object.entries(TABLES) as [StatsKey, string][]).map(
        async ([key, table]) => [key, await countTable(table, uid)] as const
      )
    )
    setStats(Object.fromEntries(entries) as Record<StatsKey, number>)
  }, [])

  useEffect(() => {
    const sb = getSupabase()
    sb.auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      if (!uid) return
      setUserId(uid)
      loadStats(uid)
    })
  }, [loadStats])

  function showConfirm(title: string, desc: string, action: () => void) {
    setConfirm({ title, desc, action })
  }

  async function handleClear(key: StatsKey, label: string) {
    if (!userId) return
    await clearTable(TABLES[key], userId)
    await loadStats(userId)
    setCleared(label)
    setTimeout(() => setCleared(null), 2500)
  }

  async function handleClearMemoryLocal() {
    // Memory notes made before the migration to memory_items may still
    // live in this localStorage key on some browsers — clearing it
    // alongside the real table keeps both in sync either way.
    localStorage.removeItem("astrocore_memory")
  }

  async function handleResetAll() {
    if (!userId) return
    await Promise.all((Object.values(TABLES) as string[]).map(table => clearTable(table, userId)))
    await handleClearMemoryLocal()
    await loadStats(userId)
    setCleared(t.settings.wholeWorkspaceName)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');

        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(200%); opacity: 0; }
        }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep {
          0%   { left: -40%; }
          100% { left: 100%; }
        }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep {
          0%   { left: -20%; }
          100% { left: 100%; }
        }
        .astrocore-settings-grid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 980px) {
          .astrocore-settings-grid { grid-template-columns: 1fr; }
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
          <div aria-hidden style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5,
            background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none",
          }}>
            <div className="astrocore-hero-sweep" style={{
              position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%",
              background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
              boxShadow: "0 0 10px rgba(232,0,42,0.85)",
            }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
              borderRadius: 20, padding: "4px 12px 4px 10px", marginBottom: 14,
            }}>
              <span aria-hidden style={{
                position: "relative", width: 18, height: 1.5, borderRadius: 1,
                background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block",
              }}>
                <span className="astrocore-badge-sweep" style={{
                  position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%",
                  background: "linear-gradient(90deg, transparent, #E8002A, transparent)",
                }} />
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>
                System Control
              </span>
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>
              {t.sidebar.settings}
            </h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
              {t.settings.subtitleTagline}
            </p>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "24px 48px 56px", maxWidth: 1500 }}>

          {/* System status */}
          <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
            <Chip icon={Bot}           label={t.settings.statAgents}   value={stats.agents}    />
            <Chip icon={MessageSquare} label={t.settings.statChats}     value={stats.sessions}  />
            <Chip icon={Key}           label={t.settings.statProviders} value={stats.providers} />
            <Chip icon={BookOpen}      label={t.settings.statVault}     value={stats.vault}     />
            <Chip icon={ImageIcon}     label={t.settings.statGallery}   value={stats.gallery}   />
            <Chip icon={Brain}         label={t.sidebar.memory}         value={stats.memory}    />
          </div>

          <div style={{ marginBottom: 20 }}>
            <SectionDivider />
          </div>

          {/* Success cleared */}
          {cleared && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: 9, marginBottom: 16,
              background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.22)",
              color: T.green, fontSize: 13,
            }}>
              <Check size={14} /> {cleared} {t.settings.clearedSuffix}
            </div>
          )}

          <div className="astrocore-settings-grid">

            {/* ── Main column: navigation + the heavy data-management block ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <SectionCard title={t.settings.sectionsTitle} icon={Settings}>
                <SettingRow icon={User} label={t.sidebar.account} desc={t.settings.accountDesc} href="/account" />
                <Divider />
                <SettingRow icon={Key} label={t.sidebar.providers} desc={t.settings.providersDesc} href="/providers" />
                <Divider />
                <SettingRow icon={Brain} label={t.sidebar.memory} desc={t.settings.memoryDesc} href="/memory" />
                <Divider />
                <SettingRow icon={BookOpen} label={t.sidebar.vault} desc={t.settings.vaultDesc} href="/vault" />
                <Divider />
                <SettingRow icon={ImageIcon} label={t.sidebar.gallery} desc={t.settings.galleryDesc} href="/gallery" />
                <Divider />
                <SettingRow icon={Key} label={t.settings.devCenterLabel} desc={t.settings.devCenterDesc} href="/settings/developer" />
              </SectionCard>

              <SectionCard title={t.settings.dataManagementTitle} icon={Database} accent>
                <SettingRow
                  icon={Bot}
                  label={t.settings.clearAgentsLabel}
                  desc={`${t.settings.clearAgentsDescPrefix}${stats.agents}${t.settings.clearAgentsDescSuffix}`}
                  action={() => showConfirm(
                    t.settings.clearAgentsConfirmTitle,
                    t.settings.clearAgentsConfirmDesc,
                    () => handleClear("agents", t.settings.agentsName)
                  )}
                  actionLabel={t.settings.clearBtn}
                  actionVariant="danger"
                  danger
                />
                <Divider />
                <SettingRow
                  icon={MessageSquare}
                  label={t.settings.clearChatsLabel}
                  desc={`${t.settings.clearChatsDescPrefix}${stats.sessions}${t.settings.clearChatsDescSuffix}`}
                  action={() => showConfirm(
                    t.settings.clearChatsConfirmTitle,
                    t.settings.clearChatsConfirmDesc,
                    () => handleClear("sessions", t.settings.chatsName)
                  )}
                  actionLabel={t.settings.clearBtn}
                  actionVariant="danger"
                  danger
                />
                <Divider />
                <SettingRow
                  icon={Brain}
                  label={t.settings.clearMemoryLabel}
                  desc={t.settings.clearMemoryDesc}
                  action={() => showConfirm(
                    t.settings.clearMemoryConfirmTitle,
                    t.settings.clearMemoryConfirmDesc,
                    async () => { await handleClear("memory", t.settings.memoryName); await handleClearMemoryLocal() }
                  )}
                  actionLabel={t.settings.clearBtn}
                  actionVariant="danger"
                  danger
                />
                <Divider />
                <SettingRow
                  icon={BookOpen}
                  label={t.settings.clearVaultLabel}
                  desc={`${t.settings.clearVaultDescPrefix}${stats.vault}${t.settings.clearVaultDescSuffix}`}
                  action={() => showConfirm(
                    t.settings.clearVaultConfirmTitle,
                    t.settings.clearVaultConfirmDesc,
                    () => handleClear("vault", t.settings.vaultName)
                  )}
                  actionLabel={t.settings.clearBtn}
                  actionVariant="danger"
                  danger
                />
                <Divider />
                <SettingRow
                  icon={ImageIcon}
                  label={t.settings.clearGalleryLabel}
                  desc={`${t.settings.clearGalleryDescPrefix}${stats.gallery}${t.settings.clearGalleryDescSuffix}`}
                  action={() => showConfirm(
                    t.settings.clearGalleryConfirmTitle,
                    t.settings.clearGalleryConfirmDesc,
                    () => handleClear("gallery", t.settings.galleryName)
                  )}
                  actionLabel={t.settings.clearBtn}
                  actionVariant="danger"
                  danger
                />
                <Divider />
                <SettingRow
                  icon={Trash2}
                  label={t.settings.resetAllLabel}
                  desc={t.settings.resetAllDesc}
                  action={() => showConfirm(
                    t.settings.resetAllConfirmTitle,
                    t.settings.resetAllConfirmDesc,
                    handleResetAll
                  )}
                  actionLabel={t.settings.resetAllBtn}
                  actionVariant="danger"
                  danger
                />
              </SectionCard>
            </div>

            {/* ── Side column: quick settings + read-only info, narrower
                and fixed-width like a utility rail — same pattern as
                the Account page. ── */}
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              <SectionCard title={t.settings.language} icon={Globe}>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: T.t4, lineHeight: 1.5 }}>{t.settings.languageDesc}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {LANGUAGES.map(l => {
                      const active = language === l.code
                      return (
                        <button
                          key={l.code}
                          onClick={() => setLanguage(l.code)}
                          style={{
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                            padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                            background: active ? "rgba(232,0,42,0.14)" : "rgba(255,255,255,0.04)",
                            border: active ? "1px solid rgba(232,0,42,0.35)" : `0.5px solid ${T.b1}`,
                            color: active ? T.t1 : T.t3,
                            fontSize: 13, fontWeight: active ? 600 : 400,
                            transition: "background 130ms ease, border-color 130ms ease, color 130ms ease",
                          }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
                        >
                          <span style={{ fontSize: 16 }}>{l.flag}</span>
                          {l.label}
                          {active && <Check size={13} style={{ color: T.red, marginLeft: 2 }} />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </SectionCard>

              <SectionCard title={t.settings.systemStatusTitle} icon={Activity} variant="system">
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { label: t.settings.aiCoreLabel,       value: t.settings.onlineLabel,         ok: true  },
                    { label: t.settings.localStorageLabel, value: t.settings.availableLabel,       ok: true  },
                    { label: t.settings.providersStatusLabel, value: stats.providers > 0 ? `${stats.providers} ${t.settings.connectedSuffix}` : t.settings.noneLabel,  ok: stats.providers > 0 },
                    { label: t.settings.activeAgentsLabel, value: stats.agents > 0  ? `${stats.agents} ${t.settings.agentsCountSuffix}`  : t.settings.noneLabel,         ok: stats.agents > 0  },
                  ].map(({ label, value, ok }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: T.t2 }}>{label}</span>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10.5, padding: "2px 9px", borderRadius: 5, fontWeight: 600,
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

              <SectionCard title={t.settings.securityTitle} icon={Shield}>
                <div style={{ padding: "12px 16px 6px" }}>
                  <div style={{
                    display: "flex", alignItems: "flex-start", gap: 9,
                    padding: "10px 12px", borderRadius: 9,
                    background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
                    marginBottom: 8,
                  }}>
                    <Shield size={13} style={{ color: T.t4, flexShrink: 0, marginTop: 1 }} />
                    <span style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.55 }}>
                      {t.settings.securityDesc}
                    </span>
                  </div>
                </div>
                <Divider />
                <SettingRow icon={Key} label={t.settings.apiKeysLabel} desc={t.settings.apiKeysDesc} href="/providers" />
              </SectionCard>

              <SectionCard title={t.settings.aboutTitle} icon={Settings}>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {[
                    { label: t.settings.versionLabel,   value: t.settings.versionValue   },
                    { label: t.settings.frameworkLabel, value: "Next.js 16"              },
                    { label: t.settings.storageLabel,   value: t.settings.storageValue   },
                    { label: t.settings.aiLayerLabel,   value: t.settings.aiLayerValue   },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: 13, color: T.t3 }}>{label}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12.5, color: T.t2 }}>{value}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          desc={confirm.desc}
          onConfirm={confirm.action}
          onClose={() => setConfirm(null)}
          cancelLabel={t.settings.confirmCancel}
          confirmLabel={t.settings.confirmConfirm}
        />
      )}
    </>
  )
}