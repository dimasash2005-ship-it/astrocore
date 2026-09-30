"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Settings, User, Key, Brain, Shield,
  Activity, Database,
  Trash2, BookOpen, Image as ImageIcon,
  Bot, MessageSquare, AlertCircle, Check, Globe,
  ArrowUpRight, Code2, Loader2,
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

// ─── Confirm danger modal ─────────────────────────────────────────

function ConfirmModal({ title, desc, onConfirm, onClose, cancelLabel, confirmLabel }: {
  title: string; desc: string; onConfirm: () => void | Promise<void>; onClose: () => void
  cancelLabel: string; confirmLabel: string
}) {
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose() }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [onClose, busy])

  async function run() {
    setBusy(true)
    try { await onConfirm() } finally { setBusy(false); onClose() }
  }

  return (
    <div className="st-overlay" onClick={e => { if (e.target === e.currentTarget && !busy) onClose() }}>
      <div className="st-modal">
        <div style={{ width: 42, height: 42, borderRadius: 12, marginBottom: 14, display: "grid", placeItems: "center",
          background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.3)", boxShadow: "0 0 24px rgba(232,0,42,0.18)" }}>
          <AlertCircle size={19} style={{ color: T.red }} />
        </div>
        <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{title}</div>
        <p style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, margin: "0 0 20px" }}>{desc}</p>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} disabled={busy} className="st-btn" style={{ flex: 1, justifyContent: "center" }}>{cancelLabel}</button>
          <button onClick={run} disabled={busy} className="st-btn st-btn-danger-solid" style={{ flex: 1, justifyContent: "center" }}>
            {busy ? <Loader2 size={13} className="st-spin" /> : <Trash2 size={13} />} {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function SettingsPage() {
  const router = useRouter()
  const { t, language, setLanguage } = useLanguage()
  const uk = language === "uk"
  const [confirm, setConfirm] = useState<null | { title: string; desc: string; action: () => void | Promise<void> }>(null)
  const [cleared, setCleared] = useState<string | null>(null)
  const [userId,  setUserId]  = useState<string | null>(null)
  const [ready,   setReady]   = useState(false)

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
    setReady(true)
  }, [])

  useEffect(() => {
    getSupabase().auth.getUser().then(({ data }) => {
      const uid = data?.user?.id
      if (!uid) return
      setUserId(uid)
      loadStats(uid)
    })
  }, [loadStats])

  function showConfirm(title: string, desc: string, action: () => void | Promise<void>) {
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
    localStorage.removeItem("astrocore_memory")
  }

  async function handleResetAll() {
    if (!userId) return
    await Promise.all((Object.values(TABLES) as string[]).map(table => clearTable(table, userId)))
    await handleClearMemoryLocal()
    await loadStats(userId)
    setCleared(t.settings.wholeWorkspaceName)
    setTimeout(() => setCleared(null), 2500)
  }

  const dataRows: { key: StatsKey; icon: React.ElementType; label: string; desc: string; count: number; onClick: () => void }[] = [
    { key: "agents", icon: Bot, label: t.settings.clearAgentsLabel, count: stats.agents,
      desc: `${t.settings.clearAgentsDescPrefix}${stats.agents}${t.settings.clearAgentsDescSuffix}`,
      onClick: () => showConfirm(t.settings.clearAgentsConfirmTitle, t.settings.clearAgentsConfirmDesc, () => handleClear("agents", t.settings.agentsName)) },
    { key: "sessions", icon: MessageSquare, label: t.settings.clearChatsLabel, count: stats.sessions,
      desc: `${t.settings.clearChatsDescPrefix}${stats.sessions}${t.settings.clearChatsDescSuffix}`,
      onClick: () => showConfirm(t.settings.clearChatsConfirmTitle, t.settings.clearChatsConfirmDesc, () => handleClear("sessions", t.settings.chatsName)) },
    { key: "memory", icon: Brain, label: t.settings.clearMemoryLabel, count: stats.memory,
      desc: t.settings.clearMemoryDesc,
      onClick: () => showConfirm(t.settings.clearMemoryConfirmTitle, t.settings.clearMemoryConfirmDesc,
        async () => { await handleClear("memory", t.settings.memoryName); await handleClearMemoryLocal() }) },
    { key: "vault", icon: BookOpen, label: t.settings.clearVaultLabel, count: stats.vault,
      desc: `${t.settings.clearVaultDescPrefix}${stats.vault}${t.settings.clearVaultDescSuffix}`,
      onClick: () => showConfirm(t.settings.clearVaultConfirmTitle, t.settings.clearVaultConfirmDesc, () => handleClear("vault", t.settings.vaultName)) },
    { key: "gallery", icon: ImageIcon, label: t.settings.clearGalleryLabel, count: stats.gallery,
      desc: `${t.settings.clearGalleryDescPrefix}${stats.gallery}${t.settings.clearGalleryDescSuffix}`,
      onClick: () => showConfirm(t.settings.clearGalleryConfirmTitle, t.settings.clearGalleryConfirmDesc, () => handleClear("gallery", t.settings.galleryName)) },
  ]

  const statusRows = [
    { label: t.settings.aiCoreLabel,          value: t.settings.onlineLabel,    ok: true },
    { label: t.settings.localStorageLabel,    value: t.settings.availableLabel, ok: true },
    { label: t.settings.providersStatusLabel, value: stats.providers > 0 ? `${stats.providers} ${t.settings.connectedSuffix}` : t.settings.noneLabel, ok: stats.providers > 0 },
    { label: t.settings.activeAgentsLabel,    value: stats.agents > 0 ? `${stats.agents} ${t.settings.agentsCountSuffix}` : t.settings.noneLabel,          ok: stats.agents > 0 },
  ]

  const sections = [
    { icon: User,  label: t.sidebar.account,         desc: t.settings.accountDesc,   href: "/account",            color: "#E8002A" },
    { icon: Key,   label: t.settings.apiKeysLabel,   desc: t.settings.apiKeysDesc,   href: "/providers",          color: "#4285F4" },
    { icon: Code2, label: t.settings.devCenterLabel, desc: t.settings.devCenterDesc, href: "/settings/developer", color: "#06B6D4" },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes stIn   { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
        @keyframes stFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes stPop  { from { opacity: 0; transform: translateY(10px) scale(.97); } to { opacity: 1; transform: none; } }
        @keyframes stSpin { to { transform: rotate(360deg); } }
        @keyframes stPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.5); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
        .st-spin { animation: stSpin 1s linear infinite; }

        .st-grid { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 24px; align-items: start; }
        .st-side { display: flex; flex-direction: column; gap: 22px; position: sticky; top: 20px; }
        @media (max-width: 1100px) { .st-grid { grid-template-columns: 1fr; } .st-side { position: static; } }
        .st-main { display: flex; flex-direction: column; gap: 28px; min-width: 0; }

        .st-head { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .st-head span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }

        .st-navs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
        @media (max-width: 1300px) { .st-navs { grid-template-columns: 1fr; } }
        .st-nav { position: relative; display: flex; flex-direction: column; gap: 10px; padding: 15px; border-radius: 13px; cursor: pointer;
          text-align: left; font-family: inherit; overflow: hidden; min-height: 116px;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: stIn .45s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s; }
        .st-nav::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--c), transparent); opacity: .5; transition: opacity .2s; }
        .st-nav::after { content: ""; position: absolute; right: -40px; top: -40px; width: 120px; height: 120px; border-radius: 50%;
          background: radial-gradient(closest-side, var(--c), transparent); opacity: .07; transition: opacity .25s; }
        .st-nav:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--c) 45%, transparent);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45); }
        .st-nav:hover::before { opacity: 1; }
        .st-nav:hover::after { opacity: .18; }
        .st-arr { color: ${T.t4}; opacity: 0; transform: translate(-3px,3px); transition: all .2s; }
        .st-nav:hover .st-arr { opacity: 1; transform: none; color: var(--c); }
        .st-ico { width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex-shrink: 0;
          background: color-mix(in srgb, var(--c, ${T.red}) 13%, transparent); border: 0.5px solid color-mix(in srgb, var(--c, ${T.red}) 32%, transparent); color: var(--c, ${T.red}); }
        .st-nav-t { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }
        .st-nav-d { font-size: 12px; color: ${T.t4}; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

        .st-danger { border-radius: 14px; overflow: hidden; background: linear-gradient(160deg,#120C12 0%,#0D0A10 100%);
          border: 0.5px solid rgba(232,0,42,.22); position: relative; }
        .st-danger::after { content: ""; position: absolute; top: -60px; right: -60px; width: 200px; height: 200px; border-radius: 50%;
          background: radial-gradient(closest-side, rgba(232,0,42,.12), transparent); pointer-events: none; }
        .st-drow { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 0.5px solid rgba(255,255,255,.05); transition: background .15s; }
        .st-drow:hover { background: rgba(232,0,42,.04); }
        .st-drow-t { font-size: 13px; font-weight: 500; color: ${T.t1}; }
        .st-drow-d { font-size: 11.5px; color: ${T.t4}; margin-top: 2px; line-height: 1.4; }
        .st-count { font-family: 'JetBrains Mono', monospace; font-size: 11px; font-weight: 600; min-width: 30px; text-align: center; padding: 3px 7px; border-radius: 6px;
          color: ${T.t2}; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.08); }
        .st-reset { position: relative; z-index: 1; display: flex; align-items: center; gap: 14px; padding: 16px; flex-wrap: wrap;
          background: repeating-linear-gradient(135deg, rgba(232,0,42,.05) 0 1px, transparent 1px 8px); }

        .st-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; cursor: pointer;
          font-size: 12px; font-weight: 500; font-family: inherit; flex-shrink: 0;
          background: rgba(255,255,255,.05); border: 0.5px solid ${T.b1}; color: ${T.t2}; transition: all .15s; }
        .st-btn:hover:not(:disabled) { background: rgba(255,255,255,.09); color: ${T.t1}; }
        .st-btn:disabled { opacity: .4; cursor: not-allowed; }
        .st-btn-danger { color: #FF4D6A; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.25); }
        .st-btn-danger:hover:not(:disabled) { background: rgba(232,0,42,.18); color: #FF6B84; border-color: rgba(232,0,42,.45); }
        .st-btn-danger-solid { color: #fff; background: ${T.red}; border-color: ${T.red}; }
        .st-btn-danger-solid:hover:not(:disabled) { background: #FF1A3E; color: #fff; box-shadow: 0 0 18px rgba(232,0,42,.4); }

        .st-panel { border-radius: 13px; overflow: hidden; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .st-kv { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; border-bottom: 0.5px solid rgba(255,255,255,.05); }
        .st-kv:last-child { border-bottom: 0; }
        .st-kv > span:first-child { font-size: 12.5px; color: ${T.t3}; }
        .st-live { width: 7px; height: 7px; border-radius: 50%; background: ${T.green}; animation: stPulse 2s infinite; }

        .st-lang { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
        .st-lang button { position: relative; display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 12px 13px; border-radius: 11px; cursor: pointer;
          font-family: inherit; text-align: left; background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1}; transition: all .15s; }
        .st-lang button:hover { border-color: rgba(255,255,255,.2); }
        .st-lang button.on { border-color: rgba(232,0,42,.5); background: linear-gradient(160deg,rgba(232,0,42,.14) 0%,rgba(232,0,42,.04) 100%); box-shadow: 0 0 20px rgba(232,0,42,.12); }
        .st-lang b { font-family: 'JetBrains Mono', monospace; font-size: 15px; font-weight: 600; color: ${T.t1}; letter-spacing: .04em; }
        .st-lang button.on b { color: ${T.red}; }
        .st-lang small { font-size: 11.5px; color: ${T.t4}; }
        .st-lang .st-check { position: absolute; top: 10px; right: 10px; width: 18px; height: 18px; border-radius: 50%; display: grid; place-items: center; background: ${T.red}; color: #fff; }

        .st-overlay { position: fixed; inset: 0; z-index: 100; display: flex; align-items: center; justify-content: center; padding: 16px;
          background: rgba(4,4,10,.72); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: stFade .18s ease-out; }
        .st-modal { width: 100%; max-width: 400px; border-radius: 16px; padding: 22px;
          background: linear-gradient(160deg,#111120 0%,#0C0C18 100%); border: 0.5px solid rgba(232,0,42,.3);
          box-shadow: 0 30px 80px rgba(0,0,0,.8), 0 0 50px rgba(232,0,42,.08); animation: stPop .24s cubic-bezier(.2,.9,.3,1.2); }
        .st-toast { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%); z-index: 120; display: flex; align-items: center; gap: 8px;
          padding: 10px 16px; border-radius: 11px; font-size: 13px; color: ${T.green};
          background: #0E1A12; border: 0.5px solid rgba(34,197,94,.35); box-shadow: 0 14px 40px rgba(0,0,0,.6); animation: stPop .24s ease-out; }
        @media (prefers-reduced-motion: reduce) { .st-nav, .st-modal { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px 4px 10px", marginBottom: 14 }}>
              <span aria-hidden style={{ position: "relative", width: 18, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                <span className="astrocore-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>System Control</span>
            </div>
            <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.sidebar.settings}</h1>
            <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.settings.subtitleTagline}</p>
          </div>
        </div>

        {/* ── Body ── */}
        <div style={{ padding: "26px 48px 60px" }}>
          <div className="st-grid">
            {/* ── Main column ── */}
            <div className="st-main">

              {/* Account & access */}
              <section>
                <div className="st-head"><Shield size={13} style={{ color: T.red }} /><span>{uk ? "Акаунт і доступ" : "Account & access"}</span></div>
                <div className="st-navs">
                  {sections.map((s, i) => {
                    const Icon = s.icon
                    return (
                      <button key={s.href} className="st-nav" onClick={() => router.push(s.href)}
                        style={{ ["--c" as string]: s.color, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="st-ico"><Icon size={15} /></span>
                          <span className="st-nav-t" style={{ flex: 1 }}>{s.label}</span>
                          <ArrowUpRight size={14} className="st-arr" />
                        </div>
                        <div className="st-nav-d">{s.desc}</div>
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginTop: 10, fontSize: 11.5, color: T.t4, lineHeight: 1.55 }}>
                  <Shield size={12} style={{ flexShrink: 0, marginTop: 2 }} /> {t.settings.securityDesc}
                </div>
              </section>

              {/* Data management */}
              <section>
                <div className="st-head"><Database size={13} style={{ color: T.red }} /><span>{t.settings.dataManagementTitle}</span></div>
                <div className="st-danger">
                  {dataRows.map(r => {
                    const Icon = r.icon
                    return (
                      <div key={r.key} className="st-drow">
                        <span className="st-ico"><Icon size={14} /></span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="st-drow-t">{r.label}</div>
                          <div className="st-drow-d">{r.desc}</div>
                        </div>
                        <span className="st-count">{ready ? r.count : "—"}</span>
                        <button className="st-btn st-btn-danger" onClick={r.onClick} disabled={!userId || r.count === 0}>
                          <Trash2 size={12} /> {t.settings.clearBtn}
                        </button>
                      </div>
                    )
                  })}
                  <div className="st-reset">
                    <span className="st-ico" style={{ width: 36, height: 36 }}><AlertCircle size={16} /></span>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <div className="st-drow-t">{t.settings.resetAllLabel}</div>
                      <div className="st-drow-d">{t.settings.resetAllDesc}</div>
                    </div>
                    <button className="st-btn st-btn-danger-solid" disabled={!userId}
                      onClick={() => showConfirm(t.settings.resetAllConfirmTitle, t.settings.resetAllConfirmDesc, handleResetAll)}>
                      <Trash2 size={12} /> {t.settings.resetAllBtn}
                    </button>
                  </div>
                </div>
              </section>
            </div>

            {/* ── Side column ── */}
            <aside className="st-side">
              <section>
                <div className="st-head"><Globe size={13} style={{ color: T.red }} /><span>{t.settings.language}</span></div>
                <div className="st-lang">
                  {LANGUAGES.map(l => {
                    const active = language === l.code
                    return (
                      <button key={l.code} className={active ? "on" : ""} onClick={() => setLanguage(l.code)}>
                        <b>{l.code === "uk" ? "UA" : l.code.toUpperCase()}</b>
                        <small>{l.flag} {l.label}</small>
                        {active && <span className="st-check"><Check size={11} /></span>}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 11.5, color: T.t4, lineHeight: 1.5, marginTop: 8 }}>{t.settings.languageDesc}</div>
              </section>

              <section>
                <div className="st-head"><Activity size={13} style={{ color: T.red }} /><span>{t.settings.systemStatusTitle}</span></div>
                <div className="st-panel">
                  {statusRows.map(r => (
                    <div key={r.label} className="st-kv">
                      <span>{r.label}</span>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        {r.ok ? <span className="st-live" /> : <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#2E2E4A" }} />}
                        <span style={{
                          fontFamily: "'JetBrains Mono', monospace", fontSize: 10, padding: "2px 8px", borderRadius: 5, fontWeight: 600,
                          background: r.ok ? "rgba(34,197,94,0.09)" : "rgba(255,255,255,0.04)",
                          border: `0.5px solid ${r.ok ? "rgba(34,197,94,0.24)" : "rgba(255,255,255,0.08)"}`,
                          color: r.ok ? T.green : T.t4,
                        }}>{r.value}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </section>

              <section>
                <div className="st-head"><Settings size={13} style={{ color: T.red }} /><span>{t.settings.aboutTitle}</span></div>
                <div className="st-panel">
                  {[
                    { label: t.settings.versionLabel,   value: t.settings.versionValue },
                    { label: t.settings.frameworkLabel, value: "Next.js 16" },
                    { label: t.settings.storageLabel,   value: t.settings.storageValue },
                    { label: t.settings.aiLayerLabel,   value: t.settings.aiLayerValue },
                  ].map(r => (
                    <div key={r.label} className="st-kv">
                      <span>{r.label}</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, color: T.t2 }}>{r.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {cleared && (
        <div className="st-toast"><Check size={14} /> {cleared} {t.settings.clearedSuffix}</div>
      )}

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