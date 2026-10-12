"use client"

// Small "⏰" popover next to the chat input: upcoming reminders + cancel.
// Reminders themselves are created by writing "нагадай завтра о 9 …" in the chat.

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { AlarmClock, Loader2, X, Send, Repeat as RepeatIcon } from "lucide-react"
import { formatWhen, repeatLabel, safeTz, type Repeat } from "@/lib/reminders/core"

type Reminder = { id: string; text: string; remind_at: string; repeat: Repeat; timezone: string }

const L = {
  uk: {
    title: "Мої нагадування", empty: "Поки немає нагадувань.",
    hint: "Щоб додати, напиши в чаті: «нагадай через 10 хв …» або «нагадай завтра о 9 …»",
    cancel: "Скасувати", noTg: "Telegram не підключено: нагадування не прийдуть на телефон.",
    connect: "Підключити", tgOn: "Приходять у Telegram",
  },
  en: {
    title: "My reminders", empty: "No reminders yet.",
    hint: "To add one, write in the chat: “remind me in 10 minutes …” or “remind me tomorrow at 9 …”",
    cancel: "Cancel", noTg: "Telegram isn't connected: reminders won't reach your phone.",
    connect: "Connect", tgOn: "Arrive in Telegram",
  },
}

export default function RemindersPopover({ lang }: { lang: "uk" | "en"; onExample?: (text: string) => void }) {
  const tx = L[lang]
  const [list, setList] = useState<Reminder[] | null>(null)
  const [tg, setTg] = useState<boolean | null>(null)

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/reminders", { cache: "no-store" })
      const d = await r.json()
      setList(r.ok ? d.upcoming ?? [] : [])
      if (typeof d.telegramConnected === "boolean") setTg(d.telegramConnected)
    } catch { setList([]) }
  }, [])
  useEffect(() => { load() }, [load])

  async function cancel(r: Reminder) {
    setList(l => l ? l.filter(x => x.id !== r.id) : l)
    await fetch("/api/reminders", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: r.id, status: "cancelled" }) }).catch(() => {})
  }

  return (
    <div className="rmp">
      <style>{STYLES}</style>
      <div className="rmp-head">
        <span className="rmp-ico"><AlarmClock size={14} /></span>
        <b>{tx.title}</b>
        {tg && <span className="rmp-tg"><Send size={10} /> {tx.tgOn}</span>}
      </div>

      {tg === false && (
        <div className="rmp-warn">
          <span>{tx.noTg}</span>
          <Link href="/integrations">{tx.connect}</Link>
        </div>
      )}

      {list === null ? (
        <div className="rmp-load"><Loader2 size={15} className="rmp-spin" /></div>
      ) : list.length > 0 ? (
        <div className="rmp-list">
          {list.slice(0, 20).map(r => (
            <div key={r.id} className="rmp-row">
              <div className="rmp-tx">
                <span className="rmp-when">{formatWhen(new Date(r.remind_at), safeTz(r.timezone), lang)}</span>
                <span className="rmp-text">{r.text}</span>
                {r.repeat !== "none" && <span className="rmp-rep"><RepeatIcon size={9} /> {repeatLabel(r.repeat, lang)}</span>}
              </div>
              <button onClick={() => cancel(r)} title={tx.cancel} aria-label={tx.cancel}><X size={13} /></button>
            </div>
          ))}
        </div>
      ) : (
        <div className="rmp-empty">{tx.empty}</div>
      )}

      <div className="rmp-foot"><small>{tx.hint}</small></div>
    </div>
  )
}

const STYLES = `
  @keyframes rmpIn { from { opacity: 0; transform: translateY(6px) scale(.98); } to { opacity: 1; transform: none; } }
  @keyframes rmpSpin { to { transform: rotate(360deg); } }
  .rmp-spin { animation: rmpSpin .8s linear infinite; }
  .rmp { position: absolute; bottom: calc(100% + 10px); right: 0; z-index: 50; width: 340px; max-width: calc(100vw - 32px); max-height: 420px; overflow-y: auto;
    border-radius: 14px; padding: 12px; display: flex; flex-direction: column; gap: 10px;
    background: linear-gradient(160deg,#16141F 0%,#0F0F1A 100%); border: 0.5px solid rgba(245,158,11,.3);
    box-shadow: 0 18px 50px rgba(0,0,0,.7), 0 0 30px rgba(245,158,11,.06); animation: rmpIn 160ms cubic-bezier(.2,.9,.3,1.2); }
  .rmp-head { display: flex; align-items: center; gap: 8px; }
  .rmp-head b { font: 600 14px 'Space Grotesk', sans-serif; color: #F0EDF8; }
  .rmp-ico { width: 26px; height: 26px; border-radius: 8px; display: grid; place-items: center; color: #F5B13B; background: rgba(245,158,11,.12); border: 0.5px solid rgba(245,158,11,.3); }
  .rmp-tg { margin-left: auto; display: inline-flex; align-items: center; gap: 4px; font: 600 9.5px 'JetBrains Mono', monospace; color: #5CC4F5; text-transform: uppercase; letter-spacing: .04em; }
  .rmp-warn { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; font-size: 11.5px; line-height: 1.4; color: #A8A4BC;
    background: rgba(42,171,238,.06); border: 0.5px solid rgba(42,171,238,.25); }
  .rmp-warn a { flex: none; font-size: 11.5px; font-weight: 600; color: #fff; text-decoration: none; padding: 5px 9px; border-radius: 7px; background: #1E96D6; }
  .rmp-load { display: flex; justify-content: center; padding: 10px; color: #A8A4BC; }
  .rmp-list { display: flex; flex-direction: column; gap: 6px; }
  .rmp-row { display: flex; align-items: flex-start; gap: 8px; padding: 8px 8px 8px 11px; border-radius: 10px; background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); position: relative; }
  .rmp-row::before { content: ""; position: absolute; left: 0; top: 8px; bottom: 8px; width: 2px; border-radius: 2px; background: #F59E0B; opacity: .7; }
  .rmp-tx { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .rmp-when { font: 600 11px 'JetBrains Mono', monospace; color: #F5B13B; }
  .rmp-text { font-size: 13px; color: #F0EDF8; overflow-wrap: anywhere; }
  .rmp-rep { display: inline-flex; align-items: center; gap: 3px; width: fit-content; font: 600 9px 'JetBrains Mono', monospace; text-transform: uppercase; color: #A78BFA; }
  .rmp-row button { width: 24px; height: 24px; border-radius: 7px; flex: none; display: grid; place-items: center; cursor: pointer; color: #6A6A8A; background: none; border: 0.5px solid transparent; }
  .rmp-row button:hover { color: #FF4D6A; border-color: rgba(232,0,42,.35); background: rgba(232,0,42,.08); }
  .rmp-foot { display: flex; flex-direction: column; gap: 5px; padding-top: 8px; border-top: 0.5px solid rgba(255,255,255,.07); }
  .rmp-foot small { font-size: 11px; line-height: 1.5; color: #8A8AAA; }
  .rmp-empty { padding: 10px 2px; font-size: 12.5px; color: #A8A4BC; }
  .rmp-foot button { text-align: left; padding: 6px 9px; border-radius: 8px; cursor: pointer; font: 12px system-ui; font-family: inherit; color: #C8C4D8;
    background: rgba(255,255,255,.03); border: 0.5px solid rgba(255,255,255,.08); transition: all .15s; }
  .rmp-foot button:hover { color: #fff; border-color: rgba(245,158,11,.4); background: rgba(245,158,11,.07); }
  @media (prefers-reduced-motion: reduce) { .rmp { animation: none; } }
`
