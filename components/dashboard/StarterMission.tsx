"use client"

// "Turn on your morning brief" for the dashboard, in two forms:
//  - variant="card"   : big onboarding card (until the first mission exists, "Later" hides it for 7 days)
//  - variant="button" : a header button that opens the same form in a dialog, always available
// Shown when the owner has an OpenClaw agent connected through AstroCore but no
// missions yet. One click creates a daily mission; the cron runs it at that time.
// Hidden after "Later" for 7 days, and for good once any mission exists.

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sunrise, Newspaper, Lightbulb, Swords, ArrowRight, Check, Loader2, X } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/useLanguage"
import { nextRunAt } from "@/lib/missions/schedule"

const DISMISS_KEY = "ac_starter_dismissed_until"

type Agent = { id: string; name: string; avatar_color: string | null }

const DAYS_UK = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]
const DAYS_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const DAYS_UK_LONG = ["у неділю", "у понеділок", "у вівторок", "у середу", "у четвер", "у п'ятницю", "у суботу"]
const DAYS_EN_LONG = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0]

const PRESETS = [
  {
    key: "brief", icon: Newspaper, color: "#06B6D4",
    uk: { label: "Брифінг новин", title: "Ранковий брифінг",
      text: (topic: string) => `Ранковий брифінг: 5–7 найважливіших новин за останню добу на тему «${topic}».\nУ кожному пункті одне речення суті і посилання на джерело. В кінці один висновок: що з цього важливо для мене сьогодні.` },
    en: { label: "News brief", title: "Morning brief",
      text: (topic: string) => `Morning brief: 5–7 most important news from the last 24 hours on "${topic}".\nOne sentence per point with a link to the source. End with one takeaway: what matters for me today.` },
  },
  {
    key: "ideas", icon: Lightbulb, color: "#8B5CF6",
    uk: { label: "Ідеї на день", title: "Ідеї на день",
      text: (topic: string) => `Без пошуку в інтернеті. Дай 5 свіжих ідей на сьогодні на тему «${topic}»: для контенту, продукту або росту.\nДля кожної: заголовок і одне речення, чому це варто зробити.` },
    en: { label: "Ideas for the day", title: "Ideas for the day",
      text: (topic: string) => `No web search. Give me 5 fresh ideas for today on "${topic}": content, product or growth.\nFor each: a headline and one sentence on why it's worth doing.` },
  },
  {
    key: "rivals", icon: Swords, color: "#F59E0B",
    uk: { label: "Що нового в конкурентів", title: "Що нового в конкурентів",
      text: (topic: string) => `Перевір, що нового за добу в конкурентів у сфері «${topic}»: релізи, ціни, гучні новини.\n3–5 пунктів з посиланнями. В кінці: що з цього варто врахувати мені.` },
    en: { label: "Competitor watch", title: "Competitor watch",
      text: (topic: string) => `Check what's new in the last 24 hours with competitors in "${topic}": releases, prices, notable news.\n3–5 points with links. End with what I should take into account.` },
  },
]

export default function StarterMission({ variant = "card" }: { variant?: "card" | "button" }) {
  const router = useRouter()
  const { language } = useLanguage()
  const uk = language === "uk"

  const [agents, setAgents]   = useState<Agent[]>([])
  const [show, setShow]       = useState(false)
  const [preset, setPreset]   = useState("brief")
  const [topic, setTopic]     = useState("")
  const [time, setTime]       = useState("09:00")
  const [agentId, setAgentId] = useState("")
  const [saving, setSaving]   = useState(false)
  const [done, setDone]       = useState<string | null>(null)
  const [error, setError]     = useState("")
  const [open, setOpen]       = useState(false)
  const [freq, setFreq]       = useState<"daily" | "weekly" | "once">("daily")
  const [weekday, setWeekday] = useState(5) // 0=Sun … 6=Sat; Friday by default

  useEffect(() => {
    if (variant === "card") {
      try {
        const until = Number(localStorage.getItem(DISMISS_KEY) || 0)
        if (until > Date.now()) return
      } catch { /* ignore */ }
    }

    const sb = getSupabase()
    ;(async () => {
      const [{ count: missionCount, error: mErr }, { data: providers }, { data: agentRows }] = await Promise.all([
        sb.from("missions").select("id", { count: "exact", head: true }),
        sb.from("providers").select("id, slug, transport"),
        sb.from("agents").select("id, name, avatar_color, provider_id").order("created_at", { ascending: false }),
      ])
      if (mErr) return
      if (variant === "card" && (missionCount ?? 0) > 0) return

      // Scheduled runs work for OpenClaw agents connected through AstroCore.
      const pull = new Set(((providers ?? []) as { id: string; slug: string; transport: string | null }[])
        .filter(p => p.slug === "openclaw" && p.transport === "pull").map(p => p.id))
      const eligible = ((agentRows ?? []) as (Agent & { provider_id: string | null })[])
        .filter(a => a.provider_id && pull.has(a.provider_id))
      if (eligible.length === 0) return

      setAgents(eligible)
      setAgentId(eligible[0].id)
      setShow(true)
    })()
  }, [variant])

  function later() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now() + 7 * 86_400_000)) } catch { /* ignore */ }
    setShow(false)
  }

  async function enable() {
    const p = PRESETS.find(x => x.key === preset)!
    const loc = uk ? p.uk : p.en
    const t = topic.trim() || (uk ? "ШІ та технології" : "AI and technology")
    setSaving(true)
    setError("")
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Prague"
    // "once" = a manual mission with a one-off next_run_at; the cron runs it once and clears it.
    const row = freq === "once"
      ? { schedule: "manual", run_time: null, run_weekday: null, next_run_at: nextRunAt("daily", time, null, tz) }
      : freq === "weekly"
        ? { schedule: "weekly", run_time: time, run_weekday: weekday, next_run_at: nextRunAt("weekly", time, weekday, tz) }
        : { schedule: "daily", run_time: time, run_weekday: null, next_run_at: nextRunAt("daily", time, null, tz) }
    const { error: insErr } = await getSupabase().from("missions").insert({
      title: loc.title,
      instructions: loc.text(t),
      agent_id: agentId,
      timezone: tz,
      ...row,
    })
    setSaving(false)
    if (insErr) {
      setError(uk ? "Не вдалося увімкнути. Спробуй ще раз." : "Couldn't turn it on. Try again.")
      return
    }
    setDone(whenLabel())
  }

  function whenLabel(): string {
    const days = uk ? DAYS_UK_LONG : DAYS_EN_LONG
    if (freq === "once") return uk ? `один раз о ${time}` : `once at ${time}`
    if (freq === "weekly") return uk ? `щотижня, ${days[weekday]} о ${time}` : `every ${days[weekday]} at ${time}`
    return uk ? `щодня о ${time}` : `every day at ${time}`
  }

  if (!show) return null

  const form = done ? (
    <div className="sm-ok">
      <div className="sm-ok-ic"><Check size={18} /></div>
      <div>
        <p className="sm-h">{uk ? "Готово! Місія увімкнена" : "Done! Your mission is on"}</p>
        <p className="sm-p">
          {uk ? `Агент виконуватиме її ${done}, а результат з'являтиметься у Звітах.` : `Your agent runs it ${done} and the result lands in Reports.`}
        </p>
      </div>
      <button className="sm-link" onClick={() => router.push("/missions")}>
        {uk ? "Відкрити Місії" : "Open Missions"} <ArrowRight size={13} />
      </button>
    </div>
  ) : (
    <>
      <div className="sm-top">
        <div className="sm-ic"><Sunrise size={20} /></div>
        <div style={{ minWidth: 0 }}>
          <p className="sm-h">{uk ? "Твій агент на зв'язку. Увімкнути ранкову місію?" : "Your agent is online. Turn on a morning mission?"}</p>
          <p className="sm-p">
            {uk
              ? "Щоранку агент сам виконає задачу і покладе результат у Звіти. Ти просто відкриваєш AstroCore і читаєш."
              : "Every morning your agent does the task on its own and puts the result in Reports. You just open AstroCore and read."}
          </p>
        </div>
        <button className="sm-x" onClick={variant === "button" ? () => setOpen(false) : later} aria-label={uk ? "Закрити" : "Close"}><X size={14} /></button>
      </div>

      <div className="sm-body">
        <div className="sm-presets">
          {PRESETS.map(p => {
            const Icon = p.icon
            return (
              <button key={p.key} type="button" className={`sm-pre${preset === p.key ? " on" : ""}`}
                style={{ ["--c" as string]: p.color } as React.CSSProperties} onClick={() => setPreset(p.key)}>
                <Icon size={13} /> {uk ? p.uk.label : p.en.label}
              </button>
            )
          })}
        </div>

        <div className="sm-freq">
          <span className="sm-lbl">{uk ? "Як часто" : "How often"}</span>
          <div className="sm-seg">
            {([
              ["once",   uk ? "Один раз" : "Once"],
              ["daily",  uk ? "Щодня" : "Every day"],
              ["weekly", uk ? "Щотижня" : "Weekly"],
            ] as const).map(([k, label]) => (
              <button key={k} type="button" className={freq === k ? "on" : ""} onClick={() => setFreq(k)}>{label}</button>
            ))}
          </div>
          {freq === "weekly" && (
            <div className="sm-days" role="group" aria-label={uk ? "День тижня" : "Day of week"}>
              {WEEK_ORDER.map(d => (
                <button key={d} type="button" className={weekday === d ? "on" : ""} onClick={() => setWeekday(d)}>
                  {(uk ? DAYS_UK : DAYS_EN)[d]}
                </button>
              ))}
            </div>
          )}
        </div>

        <textarea id={`sm-topic-${variant}`} className="sm-in sm-topic" value={topic} maxLength={600} rows={1}
          placeholder={uk
            ? "Тема або що саме цікавить: напр. ШІ-агенти, мій бізнес, крипта. Можна детально, поле розтягнеться"
            : "Topic or what exactly you care about: e.g. AI agents, my business, crypto. Write as much as you like"}
          onChange={e => {
            setTopic(e.target.value)
            const el = e.currentTarget
            el.style.height = "auto"
            el.style.height = Math.min(el.scrollHeight, 260) + "px"
          }} />

        <div className="sm-row sm-row-end">
          <input id={`sm-time-${variant}`} type="time" className="sm-in" value={time} onChange={e => setTime(e.target.value)} style={{ width: 110 }} />
          {agents.length > 1 && (
            <select id={`sm-agent-${variant}`} className="sm-in" value={agentId} onChange={e => setAgentId(e.target.value)}>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
          <button className="sm-go" disabled={saving} onClick={enable}>
            {saving ? <Loader2 size={14} style={{ animation: "smSpin 1s linear infinite" }} /> : <Sunrise size={14} />}
            {uk ? "Увімкнути" : "Turn on"}
          </button>
          {variant === "card" && <button className="sm-later" onClick={later}>{uk ? "Пізніше" : "Later"}</button>}
        </div>

        {error
          ? <span className="sm-err">{error}</span>
          : <span className="sm-note">
              {variant === "card"
                ? (uk ? "Змінити чи вимкнути можна будь-коли в Місіях. Цю форму завжди відкриває кнопка «Ранкова місія» вгорі." : "Change or turn it off any time in Missions. The Morning mission button at the top always opens this form.")
                : (uk ? "Змінити чи вимкнути можна будь-коли в розділі Місії." : "Change or turn it off any time in Missions.")}
            </span>}
      </div>
    </>
  )

  return (
    <>
      <style>{STYLES}</style>
      {variant === "card" ? (
        <section className="sm" aria-label={uk ? "Ранкова місія" : "Morning mission"}>{form}</section>
      ) : (
        <>
          <button className="sm-hbtn" onClick={() => { setDone(null); setError(""); setOpen(true) }}>
            <Sunrise size={14} /> {uk ? "Ранкова місія" : "Morning mission"}
          </button>
          {open && (
            <div className="sm-shade" onClick={() => !saving && setOpen(false)}>
              <section className="sm sm-dialog" role="dialog" aria-modal="true"
                aria-label={uk ? "Ранкова місія" : "Morning mission"} onClick={e => e.stopPropagation()}>
                {form}
              </section>
            </div>
          )}
        </>
      )}
    </>
  )
}

const STYLES = `
  .sm { position: relative; overflow: hidden; margin-bottom: 22px; padding: 18px 20px; border-radius: 14px;
    background: linear-gradient(135deg, rgba(232,0,42,.10) 0%, rgba(17,17,28,.95) 45%, #0E0E18 100%);
    border: 0.5px solid rgba(232,0,42,.30); box-shadow: 0 12px 34px rgba(0,0,0,.35); animation: smIn .4s cubic-bezier(.2,.8,.2,1) both; }
  .sm::after { content: ""; position: absolute; right: -60px; top: -60px; width: 220px; height: 220px; border-radius: 50%;
    background: radial-gradient(closest-side, rgba(245,158,11,.18), transparent); pointer-events: none; }
  @keyframes smSpin { to { transform: rotate(360deg); } }
  @keyframes smIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
  .sm-top { position: relative; z-index: 1; display: flex; align-items: flex-start; gap: 14px; }
  .sm-ic { width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; display: grid; place-items: center; color: #fff;
    background: linear-gradient(135deg, #F59E0B, #E8002A); box-shadow: 0 0 20px rgba(245,158,11,.35); }
  .sm-h { font-family: 'Space Grotesk', sans-serif; font-size: 16px; font-weight: 600; color: #F0EDF8; margin: 0; letter-spacing: -.01em; }
  .sm-p { font-size: 12.5px; color: #BEB8D4; margin: 4px 0 0; line-height: 1.5; }
  .sm-x { margin-left: auto; width: 30px; height: 30px; padding: 0; line-height: 0; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
    background: transparent; border: 0.5px solid rgba(255,255,255,.08); color: #6A6A8A; transition: all .15s; }
  .sm-x:hover { color: #fff; border-color: rgba(232,0,42,.35); }
  .sm-body { position: relative; z-index: 1; margin-top: 14px; display: flex; flex-direction: column; gap: 12px; }
  .sm-presets { display: flex; flex-wrap: wrap; gap: 8px; }
  .sm-pre { display: inline-flex; align-items: center; gap: 7px; padding: 8px 12px; border-radius: 10px; cursor: pointer; font-family: inherit;
    font-size: 12.5px; color: #D8D4EC; background: rgba(255,255,255,.035); border: 0.5px solid rgba(255,255,255,.10); transition: all .15s; }
  .sm-pre svg { color: var(--c); }
  .sm-pre:hover { border-color: color-mix(in srgb, var(--c) 50%, transparent); }
  .sm-pre.on { background: color-mix(in srgb, var(--c) 14%, transparent); border-color: color-mix(in srgb, var(--c) 65%, transparent); color: #fff; }
  .sm-row { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .sm-row-end { justify-content: flex-end; }
  .sm-in { background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.12); border-radius: 9px; padding: 8px 11px;
    color: #F0EDF8; font-size: 13px; font-family: inherit; outline: none; transition: border-color .15s; }
  .sm-in:focus { border-color: rgba(232,0,42,.5); }
  .sm-topic { width: 100%; box-sizing: border-box; min-height: 44px; max-height: 260px; resize: none; overflow-y: auto;
    font-size: 13.5px !important; line-height: 1.55; padding: 11px 13px !important; }
  select.sm-in option { background: #11111C; }
  .sm-go { display: inline-flex; align-items: center; gap: 7px; padding: 9px 16px; border-radius: 10px; border: none; cursor: pointer; font-family: inherit;
    font-size: 13px; font-weight: 500; color: #fff; background: #E8002A; transition: background .13s, box-shadow .13s; }
  .sm-go:hover { background: #FF1A3E; box-shadow: 0 0 18px rgba(232,0,42,.35); }
  .sm-go:disabled { opacity: .6; cursor: default; box-shadow: none; }
  .sm-later { background: none; border: none; color: #6A6A8A; font-size: 12.5px; cursor: pointer; font-family: inherit; padding: 8px 6px; }
  .sm-later:hover { color: #D8D4EC; }
  .sm-note { font-size: 11.5px; color: #6A6A8A; }
  .sm-err { font-size: 12px; color: #FF6B85; }
  .sm-ok { position: relative; z-index: 1; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .sm-ok-ic { width: 34px; height: 34px; border-radius: 10px; display: grid; place-items: center; background: rgba(34,197,94,.15); color: #22C55E; flex-shrink: 0; }
  .sm-link { display: inline-flex; align-items: center; gap: 6px; padding: 8px 14px; border-radius: 9px; cursor: pointer; font-family: inherit;
    font-size: 12.5px; color: #F0EDF8; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.1); margin-left: auto; }
  .sm-link:hover { background: rgba(255,255,255,.09); }

  .sm-dialog .sm-h { font-size: 19px; }
  .sm-dialog .sm-p { font-size: 13.5px; }
  .sm-dialog .sm-body { margin-top: 20px; gap: 16px; }
  .sm-dialog .sm-ic { width: 46px; height: 46px; }

  .sm-freq { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
  .sm-lbl { font-family: 'JetBrains Mono', monospace; font-size: 10.5px; letter-spacing: .08em; text-transform: uppercase; color: #6A6A8A; margin-right: 2px; }
  .sm-seg, .sm-days { display: inline-flex; gap: 3px; padding: 3px; border-radius: 10px; background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.08); }
  .sm-seg button, .sm-days button { padding: 6px 12px; border-radius: 7px; border: none; background: transparent; color: #BEB8D4;
    font-size: 12.5px; font-family: inherit; cursor: pointer; transition: background .13s, color .13s; }
  .sm-days button { padding: 6px 9px; min-width: 34px; }
  .sm-seg button:hover, .sm-days button:hover { color: #fff; }
  .sm-seg button.on { background: #E8002A; color: #fff; box-shadow: 0 0 12px rgba(232,0,42,.35); }
  .sm-days button.on { background: rgba(245,158,11,.2); color: #FBBF24; box-shadow: inset 0 0 0 0.5px rgba(245,158,11,.6); }

  /* header button + dialog */
  .sm-hbtn { display: flex; align-items: center; gap: 7px; border-radius: 10px; padding: 9px 16px; font-size: 13px; font-weight: 500;
    font-family: inherit; cursor: pointer; color: #FBBF24; background: rgba(245,158,11,.08); border: 0.5px solid rgba(245,158,11,.35);
    transition: background .13s, box-shadow .13s, transform .13s; }
  .sm-hbtn:hover { background: rgba(245,158,11,.16); box-shadow: 0 0 18px rgba(245,158,11,.25); transform: translateY(-1px); }
  .sm-shade { position: fixed; inset: 0; z-index: 200; display: grid; place-items: center; padding: 16px;
    background: rgba(4,4,10,.7); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: smIn .2s both; }
  .sm-dialog { width: min(860px, 100%); max-height: calc(100vh - 32px); overflow-x: hidden; overflow-y: auto; margin: 0; padding: 28px 30px;
    scrollbar-width: thin; scrollbar-color: rgba(232,0,42,.35) transparent;
    box-shadow: 0 40px 100px rgba(0,0,0,.75), 0 0 60px rgba(232,0,42,.08); }
  @media (prefers-reduced-motion: reduce) { .sm, .sm-shade { animation: none; } }
`