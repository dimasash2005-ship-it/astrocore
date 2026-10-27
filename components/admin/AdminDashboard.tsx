"use client"

// components/admin/AdminDashboard.tsx
// The admin panel UI (astrocore.one/admin). Data comes from /api/admin/overview.

import { useCallback, useEffect, useMemo, useState } from "react"
import { RefreshCw, Users, Plug, MessageSquare, Activity, BarChart3, TrendingDown, LifeBuoy, AlertTriangle, Mail, Search, Loader2 } from "lucide-react"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

type Status = "active" | "returning" | "sleeping" | "no_provider" | "no_message" | "stuck_error" | "test" | "admin"
type Row = {
  id: string; email: string; name: string; avatar: string | null; ref: string | null
  createdAt: string; lastActivity: string | null; providers: string[]
  messages: number; okReplies: number; errors: number; reports: number; missions: number; activeDays: number; status: Status
}
type Data = {
  range: string
  kpis: { users: number; newUsers: number; connected: number; gotReply: number; active: number; reports: number; publicReports: number; missions: number }
  funnel: { key: string; value: number }[]
  stuck: Row[]
  users: Row[]
  feedback: { kind: string; message: string; page: string | null; email: string | null; created_at: string }[]
  errors: { email: string; createdAt: string; kind: string; text: string }[]
  feedbackMissing?: boolean
}

const RANGES = [["24h", "24 год"], ["7d", "7 днів"], ["30d", "30 днів"], ["all", "Весь час"]] as const

const FUNNEL_LABEL: Record<string, string> = {
  registered: "Зареєструвались", provider: "Підключили провайдера", wrote: "Написали агенту",
  reply: "Отримали відповідь", report: "Отримали звіт", returned: "Повертались у різні дні",
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  active:      { label: "АКТИВНИЙ",        cls: "grn" },
  returning:   { label: "ПОВЕРТАЄТЬСЯ",     cls: "vio" },
  sleeping:    { label: "СПИТЬ",            cls: "dim" },
  no_provider: { label: "БЕЗ ПРОВАЙДЕРА",   cls: "amb" },
  no_message:  { label: "НЕ НАПИСАВ",       cls: "amb" },
  stuck_error: { label: "ЗАСТРЯГ: ПОМИЛКА", cls: "red" },
  test:        { label: "ТЕСТ",             cls: "dim" },
  admin:       { label: "ТИ",               cls: "red2" },
}

const FB: Record<string, { label: string; cls: string }> = {
  bug: { label: "🐞 ПРОБЛЕМА", cls: "red" }, idea: { label: "💡 ІДЕЯ", cls: "amb" },
  love: { label: "❤️ ПОДОБАЄТЬСЯ", cls: "grn" }, other: { label: "💬 ІНШЕ", cls: "vio" },
}

const ERR_KIND: Record<string, string> = {
  client_only: "сервіс працює лише у своїй програмі", bad_key: "провайдер не прийняв ключ", no_credits: "закінчились кошти",
  rate_limit: "ліміт запитів", model: "невідома модель", bad_url: "неправильна адреса API", unreachable: "сервер недоступний",
  provider_down: "збій у провайдера", not_compatible: "несумісний формат", unknown: "інша помилка",
}

function ago(iso: string | null): string {
  if (!iso) return "—"
  const d = Date.now() - Date.parse(iso)
  const m = Math.round(d / 60000)
  if (m < 60) return `${Math.max(m, 1)} хв тому`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} год тому`
  const days = Math.round(h / 24)
  if (days < 7) return `${days} дн тому`
  return new Date(iso).toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
}

// Ready-made email for people who got stuck, opened in your mail app.
function mailto(r: Row): string {
  const first = r.name.split(" ")[0]
  const t: Record<string, [string, string]> = {
    stuck_error: ["AstroCore: бачу, що агент тобі не відповів",
      `Привіт, ${first}!\n\nЯ Діма, роблю AstroCore. Бачу, що коли ти писав агенту, сталася помилка і він не відповів. Вибач за це!\n\nНапиши, будь ласка, який провайдер ти підключав, і я допоможу налаштувати. Найпростіше: підключити свого OpenClaw-агента (Провайдери → «Підключити OpenClaw-агента») або ключ OpenRouter (Провайдери → Custom → «OpenRouter»).\n\nДіма, AstroCore\nhttps://astrocore.one`],
    no_provider: ["AstroCore: допомогти підключити агента?",
      `Привіт, ${first}!\n\nЯ Діма, роблю AstroCore. Дякую, що зареєструвався! Бачу, що ти ще не підключив агента чи модель. Якщо щось незрозуміло або не вийшло, напиши, допоможу за 5 хвилин.\n\nНайшвидше: Провайдери → «Підключити OpenClaw-агента» (одна команда) або Custom → «OpenRouter».\n\nДіма, AstroCore\nhttps://astrocore.one`],
    no_message: ["AstroCore: твій агент готовий, з чого почати?",
      `Привіт, ${first}!\n\nЯ Діма з AstroCore. Бачу, що ти вже підключив провайдера, супер! Спробуй дати агенту першу задачу в Чаті, наприклад: «Зроби короткий огляд новин про AI-агентів за тиждень». Результат можна зберегти у Звіти.\n\nЯкщо щось не так, просто відповідай на цей лист.\n\nДіма, AstroCore`],
  }
  const [subject, body] = t[r.status] ?? ["AstroCore", `Привіт, ${first}!`]
  return `mailto:${r.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function Avatar({ r }: { r: Row }) {
  const colors = ["#E8002A", "#7B61FF", "#06B6D4", "#22C55E", "#F59E0B", "#EC4899"]
  const c = colors[(r.email.charCodeAt(0) || 0) % colors.length]
  return r.avatar
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={r.avatar} alt="" className="acp-av" referrerPolicy="no-referrer" />
    : <span className="acp-av" style={{ background: c }}>{(r.name[0] ?? "?").toUpperCase()}</span>
}

export default function AdminDashboard() {
  const [range, setRange] = useState("7d")
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState("")
  const [q, setQ] = useState("")

  const load = useCallback(async (r: string) => {
    setLoading(true); setErr("")
    try {
      const res = await fetch(`/api/admin/overview?range=${r}`, { cache: "no-store" })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setData(json)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load(range) }, [range, load])

  const users = useMemo(() => {
    const list = data?.users ?? []
    const s = q.trim().toLowerCase()
    return s ? list.filter(u => u.email.toLowerCase().includes(s) || u.name.toLowerCase().includes(s)) : list
  }, [data, q])

  const k = data?.kpis
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)
  const top = data?.funnel[0]?.value ?? 0

  return (
    <>
      <style>{`
        .acp { margin-left: ${SIDEBAR_W}; min-height: 100vh; background: #08080F; color: #F0EDF8;
          background-image: radial-gradient(rgba(255,255,255,.035) 1px, transparent 1px); background-size: 24px 24px; }
        .acp-hero { position: relative; padding: 30px 44px 24px; border-bottom: 0.5px solid rgba(255,255,255,.09);
          background: radial-gradient(ellipse 60% 100% at 20% 0%, rgba(232,0,42,.08), transparent 70%);
          display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
        .acp-hero::after { content: ""; position: absolute; left: 0; bottom: -1px; width: 380px; height: 1px; background: linear-gradient(90deg, transparent, #E8002A, transparent); }
        .acp-badge { display: inline-flex; align-items: center; gap: 8px; font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .08em; color: #FF2A4A;
          border: 0.5px solid rgba(232,0,42,.35); background: rgba(232,0,42,.08); padding: 4px 11px; border-radius: 999px; }
        .acp-badge b { width: 16px; height: 1.5px; background: #FF2A4A; }
        .acp h1 { font-family: 'Space Grotesk', sans-serif; font-size: 30px; font-weight: 600; letter-spacing: -.02em; margin: 12px 0 0; }
        .acp-sub { color: #A8A4BC; font-size: 13.5px; margin-top: 5px; }
        .acp-tools { display: flex; gap: 8px; align-items: center; }
        .acp-seg { display: flex; gap: 2px; padding: 3px; border: 0.5px solid rgba(255,255,255,.1); border-radius: 10px; background: #0C0C15; }
        .acp-seg button { font: 600 11px 'JetBrains Mono', monospace; padding: 6px 11px; border-radius: 7px; border: 0; cursor: pointer; background: transparent; color: #8A8AAA; }
        .acp-seg button.on { background: #E8002A; color: #fff; }
        .acp-ibtn { width: 34px; height: 34px; border-radius: 9px; display: grid; place-items: center; cursor: pointer; color: #C8C4D8;
          background: #0C0C15; border: 0.5px solid rgba(255,255,255,.1); }
        .acp-ibtn:hover { color: #fff; border-color: rgba(232,0,42,.4); }
        .acp-body { padding: 24px 44px 60px; display: grid; gap: 20px; }
        .acp-kpis { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 12px; }
        .acp-kpi { position: relative; border: 0.5px solid rgba(255,255,255,.09); border-radius: 14px; padding: 14px 16px 14px 18px; overflow: hidden;
          background: linear-gradient(160deg,#11111C,#0E0E18); }
        .acp-kpi::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 3px; border-radius: 0 3px 3px 0; background: var(--c); }
        .acp-kpi::after { content: ""; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%; background: radial-gradient(closest-side, var(--c), transparent); opacity: .14; }
        .acp-kpi small { display: flex; align-items: center; gap: 6px; font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .1em; color: #8A8AAA; text-transform: uppercase; }
        .acp-kpi b { display: block; font: 600 30px 'Space Grotesk', sans-serif; margin-top: 6px; letter-spacing: -.02em; }
        .acp-kpi em { font-style: normal; font-size: 11.5px; color: #8A8AAA; }
        .acp-grid { display: grid; grid-template-columns: 1.25fr 1fr; gap: 18px; }
        .acp-grid.eq { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .acp-card { border: 0.5px solid rgba(255,255,255,.09); border-radius: 16px; background: #0F0F19; padding: 18px; min-width: 0; }
        .acp-card h3 { font-family: 'Space Grotesk', sans-serif; font-size: 15px; font-weight: 600; margin: 0; display: flex; align-items: center; gap: 9px; }
        .acp-card h3 .ic { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; background: rgba(232,0,42,.12); color: #FF4D6A; }
        .acp-card h3 .more { margin-left: auto; font: 500 11.5px Inter, sans-serif; color: #8A8AAA; }
        .acp-fun { display: grid; gap: 10px; margin-top: 16px; }
        .acp-fr { display: grid; grid-template-columns: 200px 1fr 60px; align-items: center; gap: 12px; font-size: 13px; color: #C8C4D8; }
        .acp-bar { height: 26px; border-radius: 7px; background: rgba(255,255,255,.04); overflow: hidden; }
        .acp-bar i { display: flex; align-items: center; height: 100%; min-width: 34px; border-radius: 7px; background: linear-gradient(90deg,#E8002A,#FF5A72);
          font: 600 11px 'JetBrains Mono', monospace; color: #fff; padding-left: 9px; font-style: normal; transition: width .5s cubic-bezier(.2,.8,.2,1); }
        .acp-fr .n { font: 600 13px 'JetBrains Mono', monospace; text-align: right; color: #F0EDF8; }
        .acp-tip { margin-top: 14px; padding: 10px 12px; border-radius: 10px; border: 0.5px solid rgba(245,158,11,.3); background: rgba(245,158,11,.06); font-size: 12.5px; color: #FCD38D; }
        .acp-tbl { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12.5px; }
        .acp-tbl th { font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #8A8AAA; text-align: left; padding: 7px 8px; border-bottom: 0.5px solid rgba(255,255,255,.09); white-space: nowrap; }
        .acp-tbl td { padding: 9px 8px; border-bottom: 0.5px solid rgba(255,255,255,.05); color: #C8C4D8; vertical-align: middle; }
        .acp-tbl tr:last-child td { border-bottom: 0; }
        .acp-scroll { overflow-x: auto; }
        .acp-u { display: flex; align-items: center; gap: 9px; color: #F0EDF8; min-width: 0; }
        .acp-u small { display: block; color: #8A8AAA; font-size: 11px; }
        .acp-av { width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; font: 600 11.5px Inter, sans-serif; color: #fff; flex-shrink: 0; object-fit: cover; }
        .acp-pill { display: inline-block; font: 600 9.5px 'JetBrains Mono', monospace; padding: 3px 7px; border-radius: 5px; letter-spacing: .04em; border: 0.5px solid; white-space: nowrap; }
        .acp-pill.red { color: #FF6A80; border-color: rgba(232,0,42,.4); background: rgba(232,0,42,.08); }
        .acp-pill.red2 { color: #fff; border-color: #E8002A; background: #E8002A; }
        .acp-pill.amb { color: #FCD38D; border-color: rgba(245,158,11,.4); background: rgba(245,158,11,.08); }
        .acp-pill.grn { color: #86EFAC; border-color: rgba(34,197,94,.4); background: rgba(34,197,94,.08); }
        .acp-pill.vio { color: #C4B5FD; border-color: rgba(167,139,250,.4); background: rgba(167,139,250,.08); }
        .acp-pill.dim { color: #8A8AAA; border-color: rgba(255,255,255,.15); background: rgba(255,255,255,.03); }
        .acp-mail { display: inline-flex; align-items: center; gap: 5px; font: 600 11px Inter, sans-serif; padding: 6px 10px; border-radius: 7px; color: #fff; background: #E8002A; text-decoration: none; white-space: nowrap; }
        .acp-mail:hover { background: #FF1A3E; }
        .acp-mono { font-family: 'JetBrains Mono', monospace; font-size: 11.5px; color: #8A8AAA; white-space: nowrap; }
        .acp-list { display: grid; gap: 9px; margin-top: 12px; }
        .acp-fb { border: 0.5px solid rgba(255,255,255,.08); border-radius: 11px; padding: 10px 12px; background: #11111A; }
        .acp-fb .t { display: flex; align-items: center; gap: 8px; font-size: 11.5px; color: #8A8AAA; flex-wrap: wrap; }
        .acp-fb p { font-size: 13px; color: #F0EDF8; margin: 6px 0 0; line-height: 1.45; white-space: pre-wrap; word-break: break-word; }
        .acp-er { display: flex; gap: 10px; align-items: flex-start; padding: 9px 11px; border-radius: 10px; border: 0.5px solid rgba(232,0,42,.22); background: rgba(232,0,42,.04); font-size: 12.5px; }
        .acp-er svg { color: #FF6A80; flex-shrink: 0; margin-top: 1px; }
        .acp-er b { color: #F0EDF8; font-weight: 600; }
        .acp-er small { display: block; color: #8A8AAA; font: 500 11px 'JetBrains Mono', monospace; margin-top: 3px; word-break: break-all; }
        .acp-empty { padding: 18px; text-align: center; color: #8A8AAA; font-size: 12.5px; border: 0.5px dashed rgba(255,255,255,.1); border-radius: 10px; margin-top: 12px; }
        .acp-search { display: flex; align-items: center; gap: 7px; margin-left: auto; padding: 6px 10px; border-radius: 9px; background: #0A0A12; border: 0.5px solid rgba(255,255,255,.1); }
        .acp-search input { background: transparent; border: 0; outline: none; color: #F0EDF8; font-size: 12.5px; width: 180px; font-family: inherit; }
        .acp-spin { animation: acpSpin .8s linear infinite; } @keyframes acpSpin { to { transform: rotate(360deg) } }
        @media (max-width: 1200px) { .acp-kpis { grid-template-columns: repeat(3, minmax(0,1fr)); } .acp-grid, .acp-grid.eq { grid-template-columns: minmax(0, 1fr); } }
        @media (max-width: 640px) {
          .acp-hero { padding: 22px 16px 18px; } .acp-body { padding: 18px 16px 48px; }
          .acp-kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); } .acp-fr { grid-template-columns: minmax(0, 1fr); gap: 4px; } .acp-fr .n { text-align: left; }
          .acp-search input { width: 120px; }
        }
      `}</style>

      <main className="acp">
        <div className="acp-hero">
          <div>
            <span className="acp-badge"><b />CONTROL ROOM · ТІЛЬКИ ДЛЯ ТЕБЕ</span>
            <h1>Адмін-панель</h1>
            <div className="acp-sub">Хто прийшов, хто застряг, що пишуть і що зламалось</div>
          </div>
          <div className="acp-tools">
            <div className="acp-seg">
              {RANGES.map(([v, l]) => <button key={v} className={range === v ? "on" : ""} onClick={() => setRange(v)}>{l}</button>)}
            </div>
            <button className="acp-ibtn" onClick={() => load(range)} title="Оновити" aria-label="Оновити">
              {loading ? <Loader2 size={15} className="acp-spin" /> : <RefreshCw size={15} />}
            </button>
          </div>
        </div>

        <div className="acp-body">
          {err && <div className="acp-er"><AlertTriangle size={14} /><div><b>Не вдалося завантажити:</b> {err}</div></div>}

          {/* KPIs */}
          <div className="acp-kpis">
            <div className="acp-kpi" style={{ ["--c" as string]: "#E8002A" } as React.CSSProperties}>
              <small><Users size={11} />Користувачі</small><b>{k?.users ?? "—"}</b>
              <em style={{ color: k?.newUsers ? "#22C55E" : undefined }}>{range === "all" ? "усього" : `+${k?.newUsers ?? 0} нових`}</em>
            </div>
            <div className="acp-kpi" style={{ ["--c" as string]: "#A78BFA" } as React.CSSProperties}>
              <small><Plug size={11} />Підключили агента</small><b>{k?.connected ?? "—"}</b><em>{k ? `${pct(k.connected, k.users)}% від усіх` : ""}</em>
            </div>
            <div className="acp-kpi" style={{ ["--c" as string]: "#06B6D4" } as React.CSSProperties}>
              <small><MessageSquare size={11} />Отримали відповідь</small><b>{k?.gotReply ?? "—"}</b><em>{k ? `${pct(k.gotReply, k.users)}%` : ""}</em>
            </div>
            <div className="acp-kpi" style={{ ["--c" as string]: "#22C55E" } as React.CSSProperties}>
              <small><Activity size={11} />Активні</small><b>{k?.active ?? "—"}</b><em>за обраний період</em>
            </div>
            <div className="acp-kpi" style={{ ["--c" as string]: "#F59E0B" } as React.CSSProperties}>
              <small><BarChart3 size={11} />Звіти · Місії</small><b>{k ? `${k.reports} · ${k.missions}` : "—"}</b><em>публічних: {k?.publicReports ?? 0}</em>
            </div>
          </div>

          <div className="acp-grid">
            {/* Funnel */}
            <div className="acp-card">
              <h3><span className="ic"><TrendingDown size={14} /></span>Воронка: де люди відпадають<span className="more">{range === "all" ? "усі" : "зареєстровані за період"}</span></h3>
              <div className="acp-fun">
                {(data?.funnel ?? []).map((f, i, arr) => {
                  const p = pct(f.value, top)
                  const drop = i > 0 ? arr[i - 1].value - f.value : 0
                  return (
                    <div className="acp-fr" key={f.key}>
                      {FUNNEL_LABEL[f.key]}
                      <div className="acp-bar"><i style={{ width: `${Math.max(p, top ? 6 : 0)}%` }}>{p}%</i></div>
                      <span className="n">{f.value}{drop > 0 && <span style={{ color: "#FF6A80", fontSize: 10.5, marginLeft: 5 }}>−{drop}</span>}</span>
                    </div>
                  )
                })}
                {data && top === 0 && <div className="acp-empty">За цей період нових реєстрацій немає</div>}
              </div>
              {data && top > 0 && (() => {
                const f = data.funnel
                let worst = 1
                for (let i = 1; i < f.length; i++) if (f[i - 1].value - f[i].value > f[worst - 1].value - f[worst].value) worst = i
                const d = f[worst - 1].value - f[worst].value
                return d > 0 ? <div className="acp-tip">💡 Найбільше людей відпадає між «{FUNNEL_LABEL[f[worst - 1].key]}» і «{FUNNEL_LABEL[f[worst].key]}» (−{d}).</div> : null
              })()}
            </div>

            {/* Stuck */}
            <div className="acp-card">
              <h3><span className="ic">🧗</span>Застрягли, варто написати<span className="more">{data?.stuck.length ?? 0}</span></h3>
              {data && data.stuck.length === 0 ? <div className="acp-empty">Ніхто не застряг 🎉</div> : (
                <div className="acp-scroll">
                  <table className="acp-tbl">
                    <thead><tr><th>Людина</th><th>Де застряг</th><th>Коли</th><th /></tr></thead>
                    <tbody>
                      {(data?.stuck ?? []).map(r => (
                        <tr key={r.id}>
                          <td><div className="acp-u"><Avatar r={r} /><div style={{ minWidth: 0 }}>{r.name}<small>{r.email}</small></div></div></td>
                          <td><span className={`acp-pill ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                          <td className="acp-mono">{ago(r.lastActivity ?? r.createdAt)}</td>
                          <td><a className="acp-mail" href={mailto(r)}><Mail size={12} />Написати</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="acp-grid eq">
            {/* Feedback */}
            <div className="acp-card">
              <h3><span className="ic"><LifeBuoy size={14} /></span>Відгуки з «Допомоги»<span className="more">останні {data?.feedback.length ?? 0}</span></h3>
              {data?.feedbackMissing ? <div className="acp-empty">Таблиця feedback ще не створена (запусти supabase-feedback.sql)</div>
                : data && data.feedback.length === 0 ? <div className="acp-empty">Поки ніхто не писав</div> : (
                <div className="acp-list">
                  {(data?.feedback ?? []).map((f, i) => (
                    <div className="acp-fb" key={i}>
                      <div className="t">
                        <span className={`acp-pill ${(FB[f.kind] ?? FB.other).cls}`}>{(FB[f.kind] ?? FB.other).label}</span>
                        {f.email} · {f.page ?? "—"} · {ago(f.created_at)}
                      </div>
                      <p>{f.message}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Errors */}
            <div className="acp-card">
              <h3><span className="ic"><AlertTriangle size={14} /></span>Останні помилки агентів<span className="more">коли агент не відповів</span></h3>
              {data && data.errors.length === 0 ? <div className="acp-empty">Помилок немає 🎉</div> : (
                <div className="acp-list">
                  {(data?.errors ?? []).map((e, i) => (
                    <div className="acp-er" key={i}>
                      <AlertTriangle size={14} />
                      <div style={{ minWidth: 0 }}>
                        <b>{ERR_KIND[e.kind] ?? e.kind}</b>
                        <small>{e.email || "—"} · {ago(e.createdAt)}</small>
                        <small style={{ color: "#A8A4BC" }}>{e.text}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Users */}
          <div className="acp-card">
            <h3>
              <span className="ic"><Users size={14} /></span>Усі користувачі
              <span className="acp-search"><Search size={13} color="#8A8AAA" /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Пошук: ім'я або пошта" /></span>
            </h3>
            <div className="acp-scroll">
              <table className="acp-tbl">
                <thead><tr><th>Людина</th><th>Звідки</th><th>Провайдери</th><th>Повідомлень</th><th>Відповідей</th><th>Звітів</th><th>Реєстрація</th><th>Активність</th><th>Статус</th></tr></thead>
                <tbody>
                  {users.map(r => (
                    <tr key={r.id}>
                      <td><div className="acp-u"><Avatar r={r} /><div style={{ minWidth: 0 }}>{r.name}<small>{r.email}</small></div></div></td>
                      <td className="acp-mono">{r.ref ? `ref: ${r.ref}` : "direct"}</td>
                      <td>{r.providers.length ? r.providers.join(", ") : "—"}</td>
                      <td className="acp-mono">{r.messages}</td>
                      <td className="acp-mono">{r.okReplies}{r.errors > 0 && <span style={{ color: "#FF6A80" }}> · {r.errors} пом.</span>}</td>
                      <td className="acp-mono">{r.reports}</td>
                      <td className="acp-mono">{ago(r.createdAt)}</td>
                      <td className="acp-mono">{ago(r.lastActivity)}</td>
                      <td><span className={`acp-pill ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!loading && users.length === 0 && <div className="acp-empty">Нікого не знайдено</div>}
            </div>
          </div>
        </div>
      </main>
    </>
  )
}