"use client"

// "⏰" popover next to the chat input: your upcoming reminders + cancel.
// Reminders are created by writing "нагадай через 10 хв …" in the chat.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlarmClock, Loader2, X, Send, Repeat as RepeatIcon } from "lucide-react"
import { formatWhen, repeatLabel, safeTz, localParts, type Repeat } from "@/lib/reminders/core"

type Reminder = { id: string; text: string; remind_at: string; repeat: Repeat; timezone: string }

const L = {
  uk: {
    title: "Мої нагадування", emptyT: "Поки тихо", emptyD: "Напиши в чаті, і я нагадаю в Telegram:",
    hint: "Додати: напиши в чаті", cancel: "Скасувати",
    noTg: "Telegram не підключено: нагадування не прийдуть на телефон.", connect: "Підключити", tgOn: "Telegram",
    today: "сьогодні", tomorrow: "завтра", inMin: (n: number) => n <= 0 ? "зараз" : `через ${n} хв`,
    samples: ["нагадай через 10 хв …", "нагадай завтра о 9 …", "нагадай щодня о 8:30 …"],
  },
  en: {
    title: "My reminders", emptyT: "All quiet", emptyD: "Write in the chat and I'll remind you in Telegram:",
    hint: "To add: write in the chat", cancel: "Cancel",
    noTg: "Telegram isn't connected: reminders won't reach your phone.", connect: "Connect", tgOn: "Telegram",
    today: "today", tomorrow: "tomorrow", inMin: (n: number) => n <= 0 ? "now" : `in ${n} min`,
    samples: ["remind me in 10 minutes …", "remind me tomorrow at 9 …", "remind me every day at 8:30 …"],
  },
}

const pad = (n: number) => String(n).padStart(2, "0")

export default function RemindersPopover({ lang }: { lang: "uk" | "en"; onExample?: (text: string) => void }) {
  const tx = L[lang]
  const [list, setList] = useState<Reminder[] | null>(null)
  const [tg, setTg] = useState<boolean | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/reminders", { cache: "no-store" })
      const d = await r.json()
      setList(r.ok ? d.upcoming ?? [] : [])
      if (typeof d.telegramConnected === "boolean") setTg(d.telegramConnected)
    } catch { setList([]) }
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id) }, [])

  async function cancel(r: Reminder) {
    setList(l => l ? l.filter(x => x.id !== r.id) : l)
    await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: "cancelled" }) }).catch(() => {})
  }

  // "сьогодні" / "завтра" / "пт, 16 жовт." for the small line under the time
  function dayLabel(r: Reminder): string {
    const tz = safeTz(r.timezone)
    const at = new Date(r.remind_at)
    const full = formatWhen(at, tz, lang, new Date(now))
    return full.replace(/\s(о|at)\s\d{2}:\d{2}$/, "")
  }

  return (
    <div className="rmp" role="dialog" aria-label={tx.title}>
      <style>{STYLES}</style>
      <div className="rmp-sweep" aria-hidden><i /></div>
      <div className="rmp-glow" aria-hidden />

      <div className="rmp-head">
        <span className="rmp-ico"><AlarmClock size={17} /></span>
        <div className="rmp-ht">
          <b>{tx.title}</b>
          {list && list.length > 0 && <span className="rmp-count">{list.length}</span>}
        </div>
        {tg && <span className="rmp-tg"><span className="rmp-live" /><Send size={11} /> {tx.tgOn}</span>}
      </div>

      {tg === false && (
        <div className="rmp-warn">
          <Send size={14} />
          <span>{tx.noTg}</span>
          <Link href="/integrations">{tx.connect}</Link>
        </div>
      )}

      {list === null ? (
        <div className="rmp-load"><Loader2 size={18} className="rmp-spin" /></div>
      ) : list.length > 0 ? (
        <div className="rmp-list">
          {list.slice(0, 20).map((r, i) => {
            const tz = safeTz(r.timezone)
            const at = new Date(r.remind_at).getTime()
            const p = localParts(at, tz)
            const mins = Math.round((at - now) / 60_000)
            const soon = mins < 60
            return (
              <div key={r.id} className={`rmp-row${soon ? " soon" : ""}`} style={{ animationDelay: `${i * 40}ms` }}>
                <div className="rmp-time">
                  <b>{pad(p.h)}:{pad(p.mi)}</b>
                  <small>{soon ? tx.inMin(mins) : dayLabel(r)}</small>
                </div>
                <div className="rmp-tx">
                  <span className="rmp-text">{r.text}</span>
                  {r.repeat !== "none" && <span className="rmp-rep"><RepeatIcon size={10} /> {repeatLabel(r.repeat, lang)}</span>}
                </div>
                <button className="rmp-x" onClick={() => cancel(r)} title={tx.cancel} aria-label={tx.cancel}><X size={14} /></button>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rmp-empty">
          <div className="rmp-empty-ico"><AlarmClock size={22} /></div>
          <b>{tx.emptyT}</b>
          <span>{tx.emptyD}</span>
          <div className="rmp-samples">{tx.samples.map(s => <code key={s}>{s}</code>)}</div>
        </div>
      )}

      {list && list.length > 0 && (
        <div className="rmp-foot">{tx.hint} <code>{tx.samples[0]}</code></div>
      )}
    </div>
  )
}

const STYLES = `
  @keyframes rmpIn { from { opacity: 0; transform: translateY(8px) scale(.97); } to { opacity: 1; transform: none; } }
  @keyframes rmpRow { from { opacity: 0; transform: translateX(6px); } to { opacity: 1; transform: none; } }
  @keyframes rmpSpin { to { transform: rotate(360deg); } }
  @keyframes rmpSweep { 0% { left: -30%; } 100% { left: 100%; } }
  @keyframes rmpPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(42,171,238,.6); } 50% { box-shadow: 0 0 0 4px rgba(42,171,238,0); } }
  @keyframes rmpRing { 0%,100% { transform: rotate(0); } 15% { transform: rotate(-14deg); } 30% { transform: rotate(11deg); } 45% { transform: rotate(-6deg); } 60% { transform: rotate(0); } }
  .rmp-spin { animation: rmpSpin .8s linear infinite; }

  .rmp { position: absolute; bottom: calc(100% + 12px); right: 0; z-index: 50; width: 420px; max-width: calc(100vw - 24px); max-height: min(520px, 70vh);
    overflow-y: auto; overflow-x: hidden; border-radius: 18px; padding: 16px; display: flex; flex-direction: column; gap: 12px;
    background: linear-gradient(165deg, #191624 0%, #100F1A 55%, #0D0D16 100%); border: 0.5px solid rgba(245,158,11,.32);
    box-shadow: 0 24px 60px rgba(0,0,0,.75), 0 0 0 1px rgba(0,0,0,.4), 0 0 40px rgba(245,158,11,.07);
    animation: rmpIn 180ms cubic-bezier(.2,.9,.3,1.2); scrollbar-width: thin; }
  .rmp-sweep { position: absolute; top: 0; left: 18px; right: 18px; height: 1px; overflow: hidden; background: rgba(245,158,11,.12); }
  .rmp-sweep i { position: absolute; top: 0; left: -30%; width: 30%; height: 100%; background: linear-gradient(90deg, transparent, #F5B13B, transparent); animation: rmpSweep 2.8s linear infinite; }
  .rmp-glow { position: absolute; top: -90px; left: -70px; width: 240px; height: 240px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, rgba(245,158,11,.16), transparent); }

  .rmp-head { position: relative; display: flex; align-items: center; gap: 11px; }
  .rmp-ico { width: 38px; height: 38px; border-radius: 11px; flex: none; display: grid; place-items: center; color: #F5B13B;
    background: rgba(245,158,11,.12); border: 0.5px solid rgba(245,158,11,.35); box-shadow: 0 0 22px rgba(245,158,11,.22); }
  .rmp-ico svg { animation: rmpRing 1.4s ease .15s; transform-origin: 50% 15%; }
  .rmp-ht { flex: 1; min-width: 0; display: flex; align-items: center; gap: 8px; }
  .rmp-ht b { font: 600 16px 'Space Grotesk', sans-serif; color: #F0EDF8; letter-spacing: -.01em; }
  .rmp-count { min-width: 22px; height: 20px; padding: 0 7px; border-radius: 10px; display: inline-grid; place-items: center;
    font: 600 11px 'JetBrains Mono', monospace; color: #F5B13B; background: rgba(245,158,11,.12); border: 0.5px solid rgba(245,158,11,.3); }
  .rmp-tg { flex: none; display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px;
    font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .05em; text-transform: uppercase; color: #5CC4F5;
    background: rgba(42,171,238,.08); border: 0.5px solid rgba(42,171,238,.3); }
  .rmp-live { width: 6px; height: 6px; border-radius: 50%; background: #2AABEE; animation: rmpPulse 2s infinite; }

  .rmp-warn { position: relative; display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px; font-size: 12.5px; line-height: 1.45; color: #C8C4D8;
    background: rgba(42,171,238,.07); border: 0.5px solid rgba(42,171,238,.28); }
  .rmp-warn > svg { color: #5CC4F5; flex: none; }
  .rmp-warn span { flex: 1; }
  .rmp-warn a { flex: none; font-size: 12px; font-weight: 600; color: #fff; text-decoration: none; padding: 6px 11px; border-radius: 8px;
    background: linear-gradient(145deg,#37BBFE,#1E96D6); box-shadow: 0 0 14px rgba(42,171,238,.3); }

  .rmp-load { display: flex; justify-content: center; padding: 22px; color: #A8A4BC; }
  .rmp-list { position: relative; display: flex; flex-direction: column; gap: 8px; }
  .rmp-row { position: relative; display: flex; align-items: center; gap: 14px; padding: 12px 10px 12px 15px; border-radius: 13px; overflow: hidden;
    background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); animation: rmpRow .3s ease both; transition: border-color .2s, background .2s; }
  .rmp-row::before { content: ""; position: absolute; left: 0; top: 10px; bottom: 10px; width: 2px; border-radius: 2px; background: rgba(245,158,11,.45); }
  .rmp-row:hover { background: rgba(255,255,255,.05); border-color: rgba(255,255,255,.14); }
  .rmp-row.soon { background: linear-gradient(100deg, rgba(245,158,11,.10), rgba(245,158,11,.02) 60%); border-color: rgba(245,158,11,.35); }
  .rmp-row.soon::before { background: #F59E0B; box-shadow: 0 0 10px rgba(245,158,11,.8); }
  .rmp-time { width: 78px; flex: none; display: flex; flex-direction: column; gap: 1px; }
  .rmp-time b { font: 600 20px 'JetBrains Mono', monospace; color: #F0EDF8; letter-spacing: -.02em; line-height: 1.1; }
  .rmp-row.soon .rmp-time b { color: #F5B13B; }
  .rmp-time small { font-size: 11px; color: #8A8AAA; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .rmp-row.soon .rmp-time small { color: #F5B13B; font-weight: 600; }
  .rmp-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 5px; }
  .rmp-text { font-size: 14px; line-height: 1.4; color: #F0EDF8; overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
  .rmp-rep { display: inline-flex; align-items: center; gap: 4px; width: fit-content; padding: 2px 8px; border-radius: 20px;
    font: 600 9.5px 'JetBrains Mono', monospace; text-transform: uppercase; letter-spacing: .04em; color: #A78BFA; background: rgba(139,92,246,.12); border: 0.5px solid rgba(139,92,246,.3); }
  .rmp-x { width: 30px; height: 30px; border-radius: 9px; flex: none; display: grid; place-items: center; cursor: pointer; color: #6A6A8A;
    background: transparent; border: 0.5px solid transparent; opacity: .55; transition: all .15s; }
  .rmp-row:hover .rmp-x { opacity: 1; }
  .rmp-x:hover { color: #FF4D6A; border-color: rgba(232,0,42,.4); background: rgba(232,0,42,.1); }

  .rmp-empty { position: relative; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 6px; padding: 14px 6px 6px; }
  .rmp-empty-ico { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; margin-bottom: 4px; color: #F5B13B;
    background: rgba(245,158,11,.08); border: 0.5px dashed rgba(245,158,11,.4); }
  .rmp-empty b { font: 600 15px 'Space Grotesk', sans-serif; color: #F0EDF8; }
  .rmp-empty span { font-size: 12.5px; color: #A8A4BC; }
  .rmp-samples { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; width: 100%; }
  .rmp code, .rmp-samples code { font: 500 12px 'JetBrains Mono', monospace; color: #F5B13B; }
  .rmp-samples code { padding: 8px 12px; border-radius: 10px; text-align: left; background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); }

  .rmp-foot { position: relative; padding-top: 10px; border-top: 0.5px solid rgba(255,255,255,.07); font-size: 11.5px; color: #8A8AAA; }
  .rmp-foot code { margin-left: 4px; padding: 2px 7px; border-radius: 6px; background: rgba(245,158,11,.08); border: 0.5px solid rgba(245,158,11,.22); font-size: 11px; }
  @media (max-width: 560px) { .rmp { right: -46px; } .rmp-time { width: 66px; } .rmp-time b { font-size: 17px; } }
  @media (prefers-reduced-motion: reduce) { .rmp, .rmp-row, .rmp-sweep i, .rmp-ico svg, .rmp-live { animation: none; } }
`