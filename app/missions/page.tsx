"use client"

// Missions: tasks the owner gives an agent. "Run" opens a chat with the agent,
// sends the task automatically, and the finished reply is saved to Reports
// (see the Missions block in app/chat/[sessionId]/page.tsx).
// Scheduled runs (daily / weekly) are stored now and will run automatically
// in the next update.

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Target, Plus, Play, Trash2, MessageSquare, BarChart3, X, Clock, Bot, ArrowRight,
  Newspaper, Tag, Lightbulb, Swords, PenLine, Loader2, Eye, EyeOff, Sparkles, Check, Zap,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"

const T = {
  bg: "#08080F", s1: "#11111C", b1: "rgba(255,255,255,0.09)", bRed: "rgba(232,0,42,0.30)",
  t1: "#F0EDF8", t2: "#D8D4EC", t3: "#BEB8D4", t4: "#6A6A8A",
  red: "#E8002A", green: "#22C55E", amber: "#F59E0B", cyan: "#06B6D4",
}

type Mission = {
  id: string
  agent_id: string | null
  title: string
  instructions: string
  schedule: "manual" | "daily" | "weekly"
  run_time: string | null
  run_weekday: number | null
  status: "scheduled" | "running" | "done" | "failed" | "paused"
  last_run_at: string | null
  last_session_id: string | null
  last_report_id: string | null
  created_at: string
}
type Agent = { id: string; name: string; avatar_color: string | null; provider_id: string | null }

type Draft = { title: string; instructions: string; agent_id: string; schedule: Mission["schedule"]; run_time: string; run_weekday: number }

const TEMPLATES = [
  {
    key: "digest", icon: Newspaper, color: "#06B6D4",
    uk: { title: "Щоденний дайджест", desc: "Головні новини за добу на твою тему",
      text: "Зроби короткий дайджест найважливіших новин за останню добу на тему: [тема].\n5–7 пунктів. У кожному одне речення суті і посилання на джерело. В кінці один висновок: що з цього важливо для мене." },
    en: { title: "Daily digest", desc: "Top news of the day on your topic",
      text: "Make a short digest of the most important news from the last 24 hours on: [topic].\n5–7 points. One sentence each with a link to the source. End with one takeaway: what matters for me." },
  },
  {
    key: "prices", icon: Tag, color: "#22C55E",
    uk: { title: "Моніторинг цін", desc: "Ціни конкурентів у таблиці",
      text: "Перевір актуальні ціни на [товар або послугу] у [магазини або конкуренти].\nЗведи в таблицю: назва, ціна, посилання. Познач, що змінилось і де найвигідніше." },
    en: { title: "Price monitoring", desc: "Competitor prices in a table",
      text: "Check current prices for [product or service] at [stores or competitors].\nPut them in a table: name, price, link. Point out what changed and where it's cheapest." },
  },
  {
    key: "content", icon: Lightbulb, color: "#8B5CF6",
    uk: { title: "Ідеї контенту", desc: "10 ідей постів на тиждень",
      text: "Запропонуй 10 ідей постів для [платформа] на тему [тема].\nДля кожної: заголовок, ключова думка в одне речення і формат (пост, карусель, відео)." },
    en: { title: "Content ideas", desc: "10 post ideas for the week",
      text: "Suggest 10 post ideas for [platform] about [topic].\nFor each: a headline, the key point in one sentence and a format (post, carousel, video)." },
  },
  {
    key: "rivals", icon: Swords, color: "#F59E0B",
    uk: { title: "Огляд конкурентів", desc: "Порівняння 5 конкурентів",
      text: "Знайди 5 конкурентів для [продукт] і порівняй їх: ціна, головні функції, сильні та слабкі сторони.\nТаблиця і короткий висновок: де в нас є перевага." },
    en: { title: "Competitor review", desc: "Compare 5 competitors",
      text: "Find 5 competitors for [product] and compare them: price, key features, strengths and weaknesses.\nA table and a short takeaway: where we have an edge." },
  },
]

// Demo board: shown with the "Example" button so the owner can see how missions
// look while an agent works. Never saved to the database.
function demoMissions(uk: boolean): Mission[] {
  const now = Date.now()
  const iso = (minAgo: number) => new Date(now - minAgo * 60000).toISOString()
  const base = { agent_id: "demo-agent", last_session_id: null, last_report_id: null, run_weekday: null, created_at: iso(3000) }
  return [
    { ...base, id: "demo-1", title: uk ? "Ранковий дайджест про OpenClaw" : "Morning OpenClaw digest",
      instructions: uk ? "Головні новини про OpenClaw і агентів за добу: 5–7 пунктів з посиланнями." : "Top OpenClaw and agent news of the day: 5–7 points with links.",
      schedule: "daily", run_time: "09:00", status: "scheduled", last_run_at: iso(1440) },
    { ...base, id: "demo-2", title: uk ? "Огляд цін конкурентів" : "Competitor price check",
      instructions: uk ? "Ціни на тарифи 5 конкурентів у таблиці, що змінилось за тиждень." : "Plans and prices of 5 competitors in a table, what changed this week.",
      schedule: "weekly", run_time: "10:00", run_weekday: 1, status: "scheduled", last_run_at: null },
    { ...base, id: "demo-3", title: uk ? "Підсумок пошти за тиждень" : "Weekly inbox summary",
      instructions: uk ? "Збери важливі листи за тиждень: хто, про що, що треба зробити." : "Collect important emails of the week: who, what, what to do.",
      schedule: "manual", run_time: null, status: "running", last_run_at: iso(3) },
    { ...base, id: "demo-4", title: uk ? "Тренди в r/LocalLLaMA" : "Trends in r/LocalLLaMA",
      instructions: uk ? "Що обговорюють за тиждень: 5 тем, по одному реченню і посилання." : "What people discuss this week: 5 topics, one line each with a link.",
      schedule: "daily", run_time: "06:00", status: "done", last_run_at: iso(190), last_report_id: "demo" },
    { ...base, id: "demo-5", title: uk ? "Ідеї постів для Threads" : "Post ideas for Threads",
      instructions: uk ? "10 ідей постів про AstroCore: заголовок, думка, формат." : "10 post ideas about AstroCore: headline, point, format.",
      schedule: "manual", run_time: null, status: "done", last_run_at: iso(1500), last_report_id: "demo" },
  ] as Mission[]
}

const WEEKDAYS = {
  uk: ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
}

function ago(iso: string | null, uk: boolean): string {
  if (!iso) return uk ? "ще не запускалась" : "never run"
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return uk ? "щойно" : "just now"
  if (m < 60) return uk ? `${m} хв тому` : `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return uk ? `${h} год тому` : `${h}h ago`
  const d = Math.floor(h / 24)
  if (d === 1) return uk ? "вчора" : "yesterday"
  return new Date(iso).toLocaleDateString(uk ? "uk-UA" : "en-US", { day: "numeric", month: "short" })
}

function scheduleLabel(m: Pick<Mission, "schedule" | "run_time" | "run_weekday">, uk: boolean): string {
  const time = (m.run_time || "09:00").slice(0, 5)
  if (m.schedule === "daily") return uk ? `щодня · ${time}` : `daily · ${time}`
  if (m.schedule === "weekly") {
    const day = WEEKDAYS[uk ? "uk" : "en"][m.run_weekday ?? 1]
    return uk ? `${day} · ${time}` : `${day} · ${time}`
  }
  return uk ? "вручну" : "manual"
}

const EMPTY: Draft = { title: "", instructions: "", agent_id: "", schedule: "manual", run_time: "09:00", run_weekday: 1 }

export default function MissionsPage() {
  const router = useRouter()
  const { language } = useLanguage()
  const uk = language === "uk"

  const [missions, setMissions] = useState<Mission[]>([])
  const [agents, setAgents]     = useState<Agent[]>([])
  const [ready, setReady]       = useState(false)
  const [tableMissing, setTableMissing] = useState(false)
  const [draft, setDraft]       = useState<Draft | null>(null)
  const [saving, setSaving]     = useState(false)
  const [busyId, setBusyId]     = useState<string | null>(null)
  const [error, setError]       = useState("")
  const [demo, setDemo]         = useState(false)

  async function load() {
    const sb = getSupabase()
    const [{ data: m, error: mErr }, { data: a }] = await Promise.all([
      sb.from("missions").select("*").order("created_at", { ascending: false }),
      sb.from("agents").select("id,name,avatar_color,provider_id").order("created_at", { ascending: false }),
    ])
    if (mErr) setTableMissing(true)
    setMissions((m ?? []) as Mission[])
    setAgents((a ?? []) as Agent[])
    setReady(true)

    // Opened from a chat message ("→ Mission"): prefill the form with that text.
    try {
      const params = new URLSearchParams(window.location.search)
      const raw = sessionStorage.getItem("ac_mission_draft")
      if (params.get("new") === "1" && raw) {
        sessionStorage.removeItem("ac_mission_draft")
        const d = JSON.parse(raw) as { text?: string; agentId?: string }
        const text = (d.text || "").trim()
        const firstLine = text.split("\n")[0].replace(/[#*_`>]/g, "").trim()
        const list = (a ?? []) as Agent[]
        setDraft({
          ...EMPTY,
          title: firstLine.length > 60 ? firstLine.slice(0, 57) + "…" : firstLine,
          instructions: text,
          agent_id: list.some(x => x.id === d.agentId) ? (d.agentId as string) : (list[0]?.id ?? ""),
        })
        window.history.replaceState(null, "", "/missions")
      }
    } catch { /* ignore */ }
  }

  useEffect(() => { load() }, [])

  const agentById = useMemo(() => {
    const map: Record<string, Agent> = Object.fromEntries(agents.map(a => [a.id, a]))
    map["demo-agent"] = { id: "demo-agent", name: agents[0]?.name || "Luna", avatar_color: agents[0]?.avatar_color || "#E8002A", provider_id: null }
    return map
  }, [agents])

  const shown = demo ? demoMissions(uk) : missions

  const columns = useMemo(() => ([
    { key: "todo", title: uk ? "Заплановано" : "Scheduled", color: T.t4,
      items: shown.filter(m => m.status === "scheduled" || m.status === "paused") },
    { key: "run", title: uk ? "Виконується" : "Running", color: T.amber,
      items: shown.filter(m => m.status === "running") },
    { key: "done", title: uk ? "Готово" : "Done", color: T.green,
      items: shown.filter(m => m.status === "done" || m.status === "failed") },
  ]), [shown, uk])

  function openNew(tplKey?: string) {
    setError("")
    const tpl = TEMPLATES.find(t => t.key === tplKey)
    const loc = tpl ? (uk ? tpl.uk : tpl.en) : null
    setDraft({ ...EMPTY, title: loc?.title ?? "", instructions: loc?.text ?? "", agent_id: agents[0]?.id ?? "" })
  }

  async function save(runNow: boolean) {
    if (!draft) return
    if (!draft.title.trim() || !draft.instructions.trim()) {
      setError(uk ? "Напиши назву і що саме має зробити агент." : "Add a title and what the agent should do.")
      return
    }
    if (!draft.agent_id) {
      setError(uk ? "Обери агента, який виконає місію." : "Choose the agent that will run this mission.")
      return
    }
    setSaving(true)
    setError("")
    const sb = getSupabase()
    const { data, error: insErr } = await sb.from("missions").insert({
      title: draft.title.trim(),
      instructions: draft.instructions.trim(),
      agent_id: draft.agent_id,
      schedule: draft.schedule,
      run_time: draft.schedule === "manual" ? null : draft.run_time,
      run_weekday: draft.schedule === "weekly" ? draft.run_weekday : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Prague",
    }).select("*").single()
    setSaving(false)
    if (insErr || !data) {
      setError(uk ? "Не вдалося зберегти місію. Спробуй ще раз." : "Couldn't save the mission. Try again.")
      return
    }
    setDraft(null)
    if (runNow) await run(data as Mission)
    else setMissions(prev => [data as Mission, ...prev])
  }

  async function run(m: Mission) {
    if (m.id.startsWith("demo-")) return
    if (!m.agent_id || !agentById[m.agent_id]) {
      setError(uk ? `Агента для «${m.title}» не знайдено. Видали місію і створи заново.` : `The agent for "${m.title}" is gone. Delete the mission and create it again.`)
      return
    }
    setBusyId(m.id)
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setBusyId(null); return }
    const { data: chat, error: chatErr } = await sb.from("chat_sessions")
      .insert({ user_id: user.id, agent_id: m.agent_id, title: `🎯 ${m.title}`.slice(0, 60) })
      .select("id").single()
    if (chatErr || !chat) {
      setBusyId(null)
      setError(uk ? "Не вдалося створити чат для місії." : "Couldn't create a chat for the mission.")
      return
    }
    await sb.from("missions").update({
      status: "running", last_run_at: new Date().toISOString(), last_session_id: chat.id, updated_at: new Date().toISOString(),
    }).eq("id", m.id)
    router.push(`/chat/${chat.id}?mission=${m.id}`)
  }

  async function remove(m: Mission) {
    if (m.id.startsWith("demo-")) return
    setBusyId(m.id)
    await getSupabase().from("missions").delete().eq("id", m.id)
    setMissions(prev => prev.filter(x => x.id !== m.id))
    setBusyId(null)
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes msIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
        @keyframes msSpin { to { transform: rotate(360deg); } }
        @keyframes msRun { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes msScan { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .ms-hero-sweep { animation: msHeroSweep 3s linear infinite; }
        @keyframes msHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .ms-badge-sweep { animation: msBadgeSweep 1.6s linear infinite; }
        @keyframes msBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes msPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(245,158,11,.5); } 50% { box-shadow: 0 0 0 5px rgba(245,158,11,0); } }

        .ms-primary { display: inline-flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .13s, box-shadow .13s, transform .13s; }
        .ms-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        .ms-primary:disabled { opacity: .6; cursor: default; transform: none; box-shadow: none; }
        .ms-ghost { display: inline-flex; align-items: center; gap: 7px; background: rgba(255,255,255,.05); color: ${T.t1}; border: 0.5px solid ${T.b1};
          border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 500; cursor: pointer; font-family: inherit; transition: background .13s; }
        .ms-ghost:hover { background: rgba(255,255,255,.09); }

        .ms-h { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .ms-h span { font-family: 'Space Grotesk', sans-serif; font-size: 14px; font-weight: 600; color: ${T.t1}; }

        .ms-tpls { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; margin-bottom: 30px; }
        @media (max-width: 1300px) { .ms-tpls { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
        @media (max-width: 760px)  { .ms-tpls { grid-template-columns: 1fr 1fr; } }
        .ms-tpl { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 8px; padding: 13px 14px; border-radius: 13px; cursor: pointer; text-align: left; font-family: inherit;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          animation: msIn .4s cubic-bezier(.2,.8,.2,1) both; transition: transform .2s, border-color .2s; }
        .ms-tpl:hover { transform: translateY(-3px); border-color: color-mix(in srgb, var(--c) 45%, transparent); box-shadow: 0 12px 28px rgba(0,0,0,.4); }
        .ms-tpl::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--c), transparent); opacity: .6; transition: opacity .2s; }
        .ms-tpl::after, .ms-card::after { content: ""; position: absolute; right: -30px; top: -30px; width: 90px; height: 90px; border-radius: 50%;
          background: radial-gradient(closest-side, var(--c), transparent); opacity: .08; transition: opacity .25s; pointer-events: none; }
        .ms-tpl:hover::before { opacity: 1; }
        .ms-tpl:hover::after, .ms-card:hover::after { opacity: .2; }
        .ms-tpl i { width: 30px; height: 30px; border-radius: 9px; display: grid; place-items: center;
          background: color-mix(in srgb, var(--c) 14%, transparent); color: var(--c); }
        .ms-tpl b { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 600; color: ${T.t1}; }
        .ms-tpl small { font-size: 11.5px; color: ${T.t4}; line-height: 1.4; }
        .ms-tpl.own { border-style: dashed; }

        .ms-board { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; align-items: start; }
        @media (max-width: 1000px) { .ms-board { grid-template-columns: 1fr; } }
        .ms-col { border-radius: 13px; padding: 10px; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); display: flex; flex-direction: column; gap: 9px; min-height: 140px; }
        .ms-col-h { display: flex; align-items: center; gap: 8px; padding: 4px 4px 2px;
          font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: ${T.t4}; }
        .ms-col-h em { font-style: normal; margin-left: auto; color: ${T.t3}; }
        .ms-dot { width: 7px; height: 7px; border-radius: 50%; }
        .ms-empty { font-size: 12px; color: ${T.t4}; text-align: center; padding: 22px 8px; border: 1px dashed rgba(255,255,255,.07); border-radius: 10px; }

        .ms-card { position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 9px; padding: 13px 14px 12px; border-radius: 13px;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1}; animation: msIn .35s both;
          transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s; }
        .ms-card::before { content: ""; position: absolute; left: 0; top: 12px; bottom: 12px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--c, ${T.red}), transparent); opacity: .55; transition: opacity .2s; }
        .ms-card:hover { transform: translateY(-3px); border-color: rgba(232,0,42,.35);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45); }
        .ms-card:hover::before { opacity: 1; }
        .ms-live { display: inline-flex; align-items: center; gap: 6px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.amber}; }
        .ms-live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: ${T.amber}; animation: msPulse 2s infinite; }
        .ms-card.run { border-color: rgba(245,158,11,.4); }
        .ms-card.fail { border-color: rgba(232,0,42,.35); }
        .ms-card-t { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; font-weight: 600; color: ${T.t1}; line-height: 1.35; }
        .ms-card-d { font-size: 12px; color: ${T.t4}; line-height: 1.45; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .ms-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; }
        .ms-meta span { display: inline-flex; align-items: center; gap: 4px; }
        .ms-av { width: 16px; height: 16px; border-radius: 5px; display: grid; place-items: center; font-size: 9px; font-weight: 700; color: #fff; }
        .ms-acts { display: flex; gap: 6px; flex-wrap: wrap; }
        .ms-act { display: inline-flex; align-items: center; gap: 5px; height: 27px; padding: 0 10px; border-radius: 7px; cursor: pointer; font-family: inherit;
          font-size: 11.5px; font-weight: 500; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.09); color: ${T.t2}; transition: all .15s; }
        .ms-act:hover { background: rgba(255,255,255,.08); color: ${T.t1}; }
        .ms-act.go { background: rgba(232,0,42,.12); border-color: rgba(232,0,42,.35); color: #FF4D6A; }
        .ms-act.go:hover { background: ${T.red}; color: #fff; }
        .ms-act.del { margin-left: auto; padding: 0 8px; color: ${T.t4}; }
        .ms-act.del:hover { color: #FF4D6A; border-color: rgba(232,0,42,.35); }
        .ms-act:disabled { opacity: .5; cursor: default; }
        .ms-runbar { position: absolute; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(245,158,11,.12); overflow: hidden; }
        .ms-runbar::after { content: ""; position: absolute; top: 0; left: -40%; width: 40%; height: 100%; background: ${T.amber}; animation: msRun 1.6s linear infinite; }
        .ms-tag { font-family: 'JetBrains Mono', monospace; font-size: 9px; letter-spacing: .05em; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; }

        .ms-shade { position: fixed; inset: 0; z-index: 200; background: rgba(4,4,10,.7); backdrop-filter: blur(4px); display: grid; place-items: center; padding: 16px; animation: msIn .2s both; }
        .ms-modal { width: min(560px, 100%); max-height: calc(100vh - 32px); overflow: auto; border-radius: 16px; padding: 20px;
          background: linear-gradient(160deg,#121222 0%,#0C0C18 100%); border: 0.5px solid ${T.bRed}; box-shadow: 0 30px 80px rgba(0,0,0,.7); }
        .ms-field { display: flex; flex-direction: column; gap: 6px; margin-bottom: 14px; }
        .ms-field label { font-size: 12px; color: ${T.t3}; font-weight: 500; }
        .ms-input { width: 100%; box-sizing: border-box; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.12); border-radius: 10px;
          padding: 10px 12px; color: ${T.t1}; font-size: 13px; font-family: inherit; outline: none; transition: border-color .15s; }
        .ms-input:focus { border-color: rgba(232,0,42,.5); }
        textarea.ms-input { min-height: 120px; resize: vertical; line-height: 1.5; }
        select.ms-input option { background: #11111C; }
        .ms-seg { display: flex; gap: 4px; padding: 3px; border-radius: 10px; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.08); width: fit-content; }
        .ms-seg button { padding: 6px 12px; border-radius: 7px; border: none; background: transparent; color: ${T.t3}; font-size: 12px; cursor: pointer; font-family: inherit; }
        .ms-seg button.on { background: ${T.red}; color: #fff; }
        .ms-note { font-size: 11.5px; color: ${T.t4}; line-height: 1.5; }
        .ms-err { font-size: 12.5px; color: #FF6B85; background: rgba(232,0,42,.08); border: 0.5px solid rgba(232,0,42,.3); border-radius: 9px; padding: 9px 12px; margin-bottom: 14px; }

        /* ── modal ── */
        .mm { width: min(980px, 100%); max-height: calc(100vh - 32px); display: flex; flex-direction: column; overflow: hidden; border-radius: 18px;
          background: linear-gradient(160deg,#121222 0%,#0B0B16 100%); border: 0.5px solid ${T.bRed};
          box-shadow: 0 40px 100px rgba(0,0,0,.75), 0 0 0 1px rgba(232,0,42,.05), 0 0 60px rgba(232,0,42,.08); animation: msIn .25s both; }
        .mm-head { position: relative; display: flex; align-items: flex-start; gap: 14px; padding: 22px 24px 18px; border-bottom: 0.5px solid ${T.b1};
          background: radial-gradient(ellipse 70% 120% at 0% 0%, rgba(232,0,42,.12), transparent 70%); }
        .mm-icon { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; flex-shrink: 0; color: #fff;
          background: linear-gradient(135deg, #E8002A, #9E001D); box-shadow: 0 0 22px rgba(232,0,42,.45); }
        .mm-head h2 { font-family: 'Space Grotesk', sans-serif; font-size: 21px; font-weight: 600; color: ${T.t1}; margin: 0; letter-spacing: -.01em; }
        .mm-head p { font-size: 12.5px; color: ${T.t3}; margin: 4px 0 0; }
        .mm-x { margin-left: auto; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; cursor: pointer;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.08); color: ${T.t3}; transition: all .15s; }
        .mm-x:hover { background: rgba(232,0,42,.12); color: #fff; border-color: rgba(232,0,42,.35); }
        .mm-body { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 22px; padding: 20px 24px; overflow: auto; }
        @media (max-width: 860px) { .mm-body { grid-template-columns: 1fr; } }
        .mm-form { min-width: 0; }
        .mm-form .ms-field { margin-bottom: 18px; }
        .mm-form .ms-field label { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: ${T.t4}; }
        .mm-title-in { font-family: 'Space Grotesk', sans-serif; font-size: 16px !important; font-weight: 600; padding: 12px 14px !important; }
        .mm-text { min-height: 210px !important; font-size: 14px !important; line-height: 1.6 !important; padding: 13px 14px !important; }
        .mm-under { display: flex; justify-content: space-between; align-items: center; margin-top: 2px; }
        .mm-warn { font-size: 11.5px; color: ${T.amber}; }
        .mm-count { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; }

        .mm-agents { display: flex; flex-wrap: wrap; gap: 8px; }
        .mm-agent { position: relative; display: inline-flex; align-items: center; gap: 9px; padding: 7px 12px 7px 7px; border-radius: 11px; cursor: pointer;
          font-family: inherit; font-size: 13px; color: ${T.t2}; background: rgba(255,255,255,.035); border: 0.5px solid rgba(255,255,255,.1); transition: all .15s; max-width: 100%; }
        .mm-agent:hover { border-color: color-mix(in srgb, var(--c) 50%, transparent); color: ${T.t1}; }
        .mm-agent.on { background: color-mix(in srgb, var(--c) 14%, transparent); border-color: color-mix(in srgb, var(--c) 70%, transparent); color: #fff;
          box-shadow: 0 0 16px color-mix(in srgb, var(--c) 25%, transparent); }
        .mm-av { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; flex-shrink: 0; background: var(--c); color: #fff; font-size: 12px; font-weight: 700; }
        .mm-agent-n { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 220px; }
        .mm-tick { color: #fff; flex-shrink: 0; }

        .mm-sched { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .mm-sch { display: flex; flex-direction: column; align-items: flex-start; gap: 3px; padding: 11px 12px; border-radius: 11px; cursor: pointer; font-family: inherit; text-align: left;
          background: rgba(255,255,255,.035); border: 0.5px solid rgba(255,255,255,.1); color: ${T.t3}; transition: all .15s; }
        .mm-sch b { font-size: 13px; font-weight: 600; color: ${T.t1}; }
        .mm-sch small { font-size: 11px; color: ${T.t4}; }
        .mm-sch:hover { border-color: rgba(232,0,42,.35); }
        .mm-sch.on { background: rgba(232,0,42,.12); border-color: rgba(232,0,42,.55); color: #FF4D6A; box-shadow: 0 0 16px rgba(232,0,42,.15); }

        .mm-side { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
        .mm-box { border-radius: 13px; padding: 13px 14px; background: #0D0D15; border: 0.5px solid rgba(255,255,255,.07); }
        .mm-box-h { display: flex; align-items: center; gap: 7px; margin-bottom: 10px; font-family: 'Space Grotesk', sans-serif; font-size: 13px; font-weight: 600; color: ${T.t1}; }
        .mm-box-h svg { color: ${T.red}; }
        .mm-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .mm-chip { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 8px; cursor: pointer; font-family: inherit; font-size: 12px;
          color: ${T.t2}; background: color-mix(in srgb, var(--c) 8%, transparent); border: 0.5px solid color-mix(in srgb, var(--c) 30%, transparent); transition: all .15s; }
        .mm-chip svg { color: var(--c); }
        .mm-chip:hover { background: color-mix(in srgb, var(--c) 18%, transparent); color: #fff; }
        .mm-preview { border-radius: 10px; padding: 11px 12px; background: rgba(232,0,42,.06); border: 0.5px solid rgba(232,0,42,.22); display: flex; flex-direction: column; gap: 6px; }
        .mm-preview b { font-size: 12.5px; color: ${T.t1}; font-weight: 600; overflow-wrap: anywhere; }
        .mm-preview p { margin: 0; font-size: 12px; color: ${T.t3}; line-height: 1.5; white-space: pre-wrap; overflow-wrap: anywhere;
          display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }
        .mm-preview em { font-style: normal; font-family: 'JetBrains Mono', monospace; font-size: 10px; color: ${T.t4}; }
        .mm-tips { margin: 0; padding-left: 16px; display: flex; flex-direction: column; gap: 6px; font-size: 12px; color: ${T.t3}; line-height: 1.45; }
        .mm-tips li::marker { color: ${T.red}; }
        .mm-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; padding: 14px 24px;
          border-top: 0.5px solid ${T.b1}; background: rgba(8,8,15,.6); }

        @media (prefers-reduced-motion: reduce) { .mm { animation: none; } }
        @media (prefers-reduced-motion: reduce) { .ms-tpl, .ms-card, .ms-shade { animation: none; } .ms-runbar::after { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.035) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "msScan 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* Hero — same structure as the dashboard and chats */}
        <div style={{ position: "relative", padding: "38px 48px 30px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", top: 0, left: 0, right: 0, height: 220, pointerEvents: "none", background: "radial-gradient(ellipse 80% 100% at 50% 0%,rgba(232,0,42,0.07) 0%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 340, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="ms-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 18 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px 4px 10px" }}>
                  <span aria-hidden style={{ position: "relative", width: 20, height: 1.5, borderRadius: 1, background: "rgba(232,0,42,0.25)", overflow: "hidden", display: "inline-block" }}>
                    <span className="ms-badge-sweep" style={{ position: "absolute", top: 0, left: "-40%", width: "40%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)" }} />
                  </span>
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Mission Layer</span>
                </div>
                {demo && (
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.amber, border: "0.5px dashed rgba(245,158,11,.45)", borderRadius: 20, padding: "3px 10px", letterSpacing: "0.06em" }}>
                    {uk ? "ПРИКЛАД · НЕ ЗБЕРІГАЄТЬСЯ" : "EXAMPLE · NOT SAVED"}
                  </span>
                )}
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 32, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                {uk ? "Місії" : "Missions"}
              </h1>
              <p style={{ fontSize: 13, color: T.t3, margin: "8px 0 0" }}>
                {uk
                  ? `Задачі для агентів · ${missions.length} місій · результат зберігається у Звіти`
                  : `Tasks for your agents · ${missions.length} missions · results go to Reports`}
              </p>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button className="ms-ghost" onClick={() => setDemo(v => !v)}>
                {demo ? <EyeOff size={14} /> : <Eye size={14} />} {demo ? (uk ? "Сховати приклад" : "Hide example") : (uk ? "Приклад" : "Example")}
              </button>
              <button className="ms-primary" onClick={() => openNew()} disabled={tableMissing}>
                <Plus size={14} /> {uk ? "Нова місія" : "New mission"}
              </button>
            </div>
          </div>
        </div>

        <div style={{ padding: "26px 48px 60px" }}>
          {tableMissing && (
            <div className="ms-err">
              {uk
                ? "Таблиця місій ще не створена в базі. Виконай SQL для таблиці missions у Supabase і онови сторінку."
                : "The missions table doesn't exist yet. Run the missions SQL in Supabase and reload."}
            </div>
          )}
          {error && !draft && <div className="ms-err">{error}</div>}

          {ready && agents.length === 0 && (
            <button onClick={() => router.push("/providers")} style={{
              width: "100%", display: "flex", alignItems: "center", gap: 12, cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              padding: "12px 16px", borderRadius: 12, marginBottom: 22, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.25)",
            }}>
              <Bot size={14} style={{ color: T.red }} />
              <span style={{ fontSize: 13, color: "#FF4D6A" }}>
                {uk ? "Щоб запускати місії, спершу підключи агента в Провайдерах." : "Connect an agent in Providers to run missions."}
              </span>
              <ArrowRight size={13} style={{ color: T.red, marginLeft: "auto" }} />
            </button>
          )}

          {/* Templates */}
          <div className="ms-h"><Lightbulb size={13} style={{ color: T.red }} /><span>{uk ? "Почни з шаблону" : "Start from a template"}</span></div>
          <div className="ms-tpls">
            {TEMPLATES.map((tpl, i) => {
              const Icon = tpl.icon
              const loc = uk ? tpl.uk : tpl.en
              return (
                <button key={tpl.key} className="ms-tpl" disabled={tableMissing} onClick={() => openNew(tpl.key)}
                  style={{ ["--c" as string]: tpl.color, animationDelay: `${i * 40}ms` } as React.CSSProperties}>
                  <i><Icon size={15} /></i>
                  <b>{loc.title}</b>
                  <small>{loc.desc}</small>
                </button>
              )
            })}
            <button className="ms-tpl own" disabled={tableMissing} onClick={() => openNew()}
              style={{ ["--c" as string]: T.red, animationDelay: "160ms" } as React.CSSProperties}>
              <i><PenLine size={15} /></i>
              <b>{uk ? "Своя місія" : "Your own"}</b>
              <small>{uk ? "Опиши задачу своїми словами" : "Describe the task in your words"}</small>
            </button>
          </div>

          {/* Board */}
          <div className="ms-h"><Target size={13} style={{ color: T.red }} /><span>{uk ? "Дошка місій" : "Mission board"}</span></div>
          <div className="ms-board">
            {columns.map(col => (
              <div key={col.key} className="ms-col">
                <div className="ms-col-h"><span className="ms-dot" style={{ background: col.color }} />{col.title}<em>{col.items.length}</em></div>
                {ready && col.items.length === 0 && (
                  <div className="ms-empty">
                    {col.key === "todo" ? (uk ? "Обери шаблон вище, щоб створити першу місію" : "Pick a template above to create your first mission")
                      : col.key === "run" ? (uk ? "Зараз нічого не виконується" : "Nothing running right now")
                      : (uk ? "Тут з'являться виконані місії" : "Finished missions show up here")}
                  </div>
                )}
                {col.items.map(m => {
                  const ag = m.agent_id ? agentById[m.agent_id] : undefined
                  const busy = busyId === m.id
                  return (
                    <div key={m.id} className={`ms-card${m.status === "running" ? " run" : ""}${m.status === "failed" ? " fail" : ""}`}
                      style={{ ["--c" as string]: m.status === "running" ? T.amber : m.status === "done" ? T.green : (ag?.avatar_color || T.red) } as React.CSSProperties}>
                      {m.status === "running" && <span className="ms-live">{uk ? "агент працює…" : "agent is working…"}</span>}
                      <div className="ms-card-t">{m.title}</div>
                      <div className="ms-card-d">{m.instructions}</div>
                      <div className="ms-meta">
                        <span>
                          <span className="ms-av" style={{ background: ag?.avatar_color || T.red }}>{(ag?.name || "?").charAt(0).toUpperCase()}</span>
                          {ag?.name || (uk ? "агента немає" : "no agent")}
                        </span>
                        <span><Clock size={10} />{scheduleLabel(m, uk)}</span>
                        <span>{ago(m.last_run_at, uk)}</span>
                        {m.status === "failed" && <span className="ms-tag" style={{ color: "#FF4D6A", background: "rgba(232,0,42,.1)" }}>{uk ? "помилка" : "failed"}</span>}
                      </div>
                      <div className="ms-acts">
                        {m.status !== "running" && (
                          <button className="ms-act go" disabled={busy} onClick={() => run(m)}>
                            {busy ? <Loader2 size={11} style={{ animation: "msSpin 1s linear infinite" }} /> : <Play size={11} />}
                            {m.status === "done" || m.status === "failed" ? (uk ? "Ще раз" : "Run again") : (uk ? "Запустити" : "Run")}
                          </button>
                        )}
                        {m.last_session_id && (
                          <button className="ms-act" onClick={() => router.push(`/chat/${m.last_session_id}`)}>
                            <MessageSquare size={11} /> {uk ? "Чат" : "Chat"}
                          </button>
                        )}
                        {m.status === "done" && m.last_report_id && (
                          <button className="ms-act" onClick={() => !demo && router.push("/reports")}>
                            <BarChart3 size={11} /> {uk ? "Звіт" : "Report"}
                          </button>
                        )}
                        <button className="ms-act del" disabled={busy} onClick={() => remove(m)} title={uk ? "Видалити" : "Delete"}>
                          <Trash2 size={12} />
                        </button>
                      </div>
                      {m.status === "running" && <div className="ms-runbar" aria-hidden />}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Create modal */}
      {draft && (
        <div className="ms-shade" onClick={() => !saving && setDraft(null)}>
          <div className="mm" role="dialog" aria-modal="true" aria-labelledby="mm-title" onClick={e => e.stopPropagation()}>
            <div className="mm-head">
              <div className="mm-icon"><Target size={18} /></div>
              <div style={{ minWidth: 0 }}>
                <h2 id="mm-title">{uk ? "Нова місія" : "New mission"}</h2>
                <p>{uk ? "Опиши задачу один раз — агент виконає її, а результат ляже у Звіти." : "Describe the task once — the agent does it and the result lands in Reports."}</p>
              </div>
              <button className="mm-x" onClick={() => setDraft(null)} aria-label="Close"><X size={16} /></button>
            </div>

            <div className="mm-body">
              {/* Left: the form */}
              <div className="mm-form">
                {error && <div className="ms-err">{error}</div>}

                <div className="ms-field">
                  <label htmlFor="ms-title">{uk ? "Назва" : "Title"}</label>
                  <input id="ms-title" className="ms-input mm-title-in" value={draft.title} maxLength={80}
                    placeholder={uk ? "Напр.: Ранковий дайджест про ШІ" : "e.g. Morning AI digest"}
                    onChange={e => setDraft({ ...draft, title: e.target.value })} />
                </div>

                <div className="ms-field">
                  <label>{uk ? "Хто виконає" : "Who runs it"}</label>
                  <div className="mm-agents">
                    {agents.length === 0 && <span className="ms-note">{uk ? "Спершу підключи агента в Провайдерах." : "Connect an agent in Providers first."}</span>}
                    {agents.map(a => {
                      const on = draft.agent_id === a.id
                      return (
                        <button key={a.id} type="button" className={`mm-agent${on ? " on" : ""}`}
                          onClick={() => setDraft({ ...draft, agent_id: a.id })}
                          style={{ ["--c" as string]: a.avatar_color || T.red } as React.CSSProperties}>
                          <span className="mm-av">{a.name.charAt(0).toUpperCase()}</span>
                          <span className="mm-agent-n">{a.name}</span>
                          {on && <Check size={13} className="mm-tick" />}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="ms-field">
                  <label htmlFor="ms-text">{uk ? "Що має зробити агент" : "What the agent should do"}</label>
                  <textarea id="ms-text" className="ms-input mm-text" value={draft.instructions}
                    placeholder={uk ? "Опиши задачу так, як пояснив би людині: що зробити, з чого, в якому форматі." : "Describe it like you would to a person: what to do, from what, in which format."}
                    onChange={e => setDraft({ ...draft, instructions: e.target.value })} />
                  <div className="mm-under">
                    {draft.instructions.includes("[")
                      ? <span className="mm-warn">{uk ? "Заміни слова в [дужках] на своє" : "Replace the words in [brackets]"}</span>
                      : <span />}
                    <span className="mm-count">{draft.instructions.length}</span>
                  </div>
                </div>

                <div className="ms-field">
                  <label>{uk ? "Як часто" : "How often"}</label>
                  <div className="mm-sched">
                    {(["manual", "daily", "weekly"] as const).map(sv => (
                      <button key={sv} type="button" className={`mm-sch${draft.schedule === sv ? " on" : ""}`} onClick={() => setDraft({ ...draft, schedule: sv })}>
                        {sv === "manual" ? <Play size={14} /> : <Clock size={14} />}
                        <b>{sv === "manual" ? (uk ? "Вручну" : "Manual") : sv === "daily" ? (uk ? "Щодня" : "Daily") : (uk ? "Щотижня" : "Weekly")}</b>
                        <small>{sv === "manual" ? (uk ? "коли натиснеш" : "when you press Run") : sv === "daily" ? (uk ? "в один час" : "same time") : (uk ? "раз на тиждень" : "once a week")}</small>
                      </button>
                    ))}
                  </div>
                  {draft.schedule !== "manual" && (
                    <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                      {draft.schedule === "weekly" && (
                        <select id="ms-day" className="ms-input" style={{ width: 120 }} value={draft.run_weekday}
                          onChange={e => setDraft({ ...draft, run_weekday: Number(e.target.value) })}>
                          {WEEKDAYS[uk ? "uk" : "en"].map((d, i) => <option key={d} value={i}>{d}</option>)}
                        </select>
                      )}
                      <input id="ms-time" type="time" className="ms-input" style={{ width: 130 }} value={draft.run_time}
                        onChange={e => setDraft({ ...draft, run_time: e.target.value })} />
                    </div>
                  )}
                  {draft.schedule !== "manual" && (
                    <span className="ms-note" style={{ marginTop: 6 }}>
                      {uk
                        ? "Розклад збережеться. Автозапуск у цей час з'явиться в наступному оновленні, а поки запускай кнопкою."
                        : "The schedule is saved. Automatic runs arrive in the next update; for now, start it with Run."}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: templates, preview, tips */}
              <aside className="mm-side">
                <div className="mm-box">
                  <div className="mm-box-h"><Sparkles size={13} /> {uk ? "Швидкий старт" : "Quick start"}</div>
                  <div className="mm-chips">
                    {TEMPLATES.map(tpl => {
                      const Icon = tpl.icon
                      const loc = uk ? tpl.uk : tpl.en
                      return (
                        <button key={tpl.key} type="button" className="mm-chip" style={{ ["--c" as string]: tpl.color } as React.CSSProperties}
                          onClick={() => setDraft({ ...draft, title: loc.title, instructions: loc.text })}>
                          <Icon size={12} /> {loc.title}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="mm-box">
                  <div className="mm-box-h"><MessageSquare size={13} /> {uk ? "Агент отримає" : "The agent receives"}</div>
                  <div className="mm-preview">
                    <b>🎯 {uk ? "Місія" : "Mission"}: {draft.title || (uk ? "без назви" : "untitled")}</b>
                    <p>{draft.instructions || (uk ? "Тут з'явиться твоя задача…" : "Your task will appear here…")}</p>
                    <em>{uk ? "+ інструкція дати готовий результат у Markdown" : "+ instruction to reply with a finished Markdown result"}</em>
                  </div>
                </div>

                <div className="mm-box">
                  <div className="mm-box-h"><Zap size={13} /> {uk ? "Поради" : "Tips"}</div>
                  <ul className="mm-tips">
                    <li>{uk ? "Пиши конкретно: тема, джерела, скільки пунктів." : "Be specific: topic, sources, how many points."}</li>
                    <li>{uk ? "Вкажи формат: список, таблиця, висновок." : "Say the format: list, table, takeaway."}</li>
                    <li>{uk ? "«Без пошуку в інтернеті» — швидше й дешевше." : "\"No web search\" is faster and cheaper."}</li>
                  </ul>
                </div>
              </aside>
            </div>

            <div className="mm-foot">
              <button className="ms-ghost" disabled={saving} onClick={() => setDraft(null)}>{uk ? "Скасувати" : "Cancel"}</button>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="ms-ghost" disabled={saving} onClick={() => save(false)}>{uk ? "Зберегти" : "Save"}</button>
                <button className="ms-primary" disabled={saving || agents.length === 0} onClick={() => save(true)}>
                  {saving ? <Loader2 size={14} style={{ animation: "msSpin 1s linear infinite" }} /> : <Play size={14} />}
                  {uk ? "Зберегти і запустити" : "Save and run"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}