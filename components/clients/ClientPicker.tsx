"use client"

// "For client" button on a report: puts the report into a client's portal (or takes it out).
// Usage: <ClientPicker reportId={report.id} clientId={report.client_id} />

import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { Users, Check, Plus, ExternalLink, Loader2, X } from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { useLanguage } from "@/lib/useLanguage"

type C = { id: string; name: string; slug: string; color: string; logo_url: string | null }

export default function ClientPicker({ reportId, clientId }: { reportId: string; clientId?: string | null }) {
  const { language } = useLanguage()
  const uk = language === "uk"
  const [open, setOpen] = useState(false)
  const [list, setList] = useState<C[] | null>(null)
  const [current, setCurrent] = useState<string | null>(clientId ?? null)
  const [busy, setBusy] = useState<string | null>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)

  useEffect(() => { setCurrent(clientId ?? null) }, [clientId])
  useEffect(() => {
    fetch("/api/clients", { cache: "no-store" }).then(r => r.json()).then(d => setList(d.clients ?? [])).catch(() => setList([]))
  }, [])
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    setPos({ top: r.bottom + 8, left: Math.max(12, Math.min(r.left, window.innerWidth - 300)) })
  }, [open])
  useEffect(() => {
    if (!open) return
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    window.addEventListener("keydown", fn)
    return () => window.removeEventListener("keydown", fn)
  }, [open])

  async function pick(id: string | null) {
    setBusy(id ?? "none")
    const { error } = await getSupabase().from("reports").update({ client_id: id }).eq("id", reportId)
    setBusy(null)
    if (!error) { setCurrent(id); setOpen(false) }
    else window.alert(uk ? "Не вдалося зберегти. Перевір, що SQL для клієнтів виконано в Supabase." : "Couldn't save.")
  }

  const cur = list?.find(c => c.id === current)
  return (
    <>
      <button ref={btn} onClick={() => setOpen(o => !o)} className="clp-btn"
        style={{ ["--c" as string]: cur?.color ?? "#8A8AAA" } as React.CSSProperties}>
        <style>{CSS}</style>
        {cur ? <span className="clp-dot" /> : <Users size={13} />}
        {cur ? cur.name : uk ? "Для клієнта" : "For client"}
      </button>
      {open && pos && createPortal(
        <div className="clp-back" onClick={() => setOpen(false)}>
          <style>{CSS}</style>
          <div className="clp" style={{ top: pos.top, left: pos.left }} onClick={e => e.stopPropagation()}>
            <div className="clp-h">{uk ? "Показати в кабінеті клієнта" : "Show in a client portal"}</div>
            {list === null ? <div className="clp-load"><Loader2 size={15} className="clp-spin" /></div> : (
              <>
                {list.map(c => (
                  <button key={c.id} className={`clp-it${current === c.id ? " on" : ""}`} onClick={() => pick(c.id)} style={{ ["--c" as string]: c.color } as React.CSSProperties}>
                    {c.logo_url ? <img src={c.logo_url} alt="" /> : <i>{c.name.charAt(0).toUpperCase()}</i>}
                    <span>{c.name}</span>
                    {busy === c.id ? <Loader2 size={13} className="clp-spin" /> : current === c.id ? <Check size={14} /> : null}
                  </button>
                ))}
                {list.length === 0 && <div className="clp-empty">{uk ? "Клієнтів ще немає." : "No clients yet."}</div>}
                {current && (
                  <button className="clp-it clp-none" onClick={() => pick(null)}>
                    <X size={13} /><span>{uk ? "Прибрати з кабінету" : "Remove from portal"}</span>
                    {busy === "none" && <Loader2 size={13} className="clp-spin" />}
                  </button>
                )}
                <div className="clp-foot">
                  <Link href="/clients"><Plus size={12} /> {uk ? "Новий клієнт" : "New client"}</Link>
                  {cur && <a href={`/c/${cur.slug}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={12} /> {uk ? "Відкрити кабінет" : "Open portal"}</a>}
                </div>
              </>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

const CSS = `
.clp-btn { display: flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 10px; font-size: 12px; cursor: pointer; color: #C8C4D8;
  background: #11111C; border: .5px solid color-mix(in srgb, var(--c) 45%, rgba(255,255,255,.1)); max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.clp-btn:hover { color: #fff; }
.clp-dot { width: 8px; height: 8px; border-radius: 50%; flex: none; background: var(--c); box-shadow: 0 0 8px var(--c); }
.clp-back { position: fixed; inset: 0; z-index: 9400; }
.clp { position: fixed; width: 280px; padding: 8px; border-radius: 14px; display: flex; flex-direction: column; gap: 2px;
  background: linear-gradient(160deg, #16141F, #0F0E18); border: .5px solid rgba(255,255,255,.14); box-shadow: 0 18px 50px rgba(0,0,0,.7); font-family: system-ui, sans-serif; }
.clp-h { padding: 6px 8px 8px; font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #8A8AAA; }
.clp-load { display: grid; place-items: center; padding: 14px; color: #8A8AAA; }
.clp-it { display: flex; align-items: center; gap: 9px; width: 100%; padding: 8px; border-radius: 9px; cursor: pointer; text-align: left; font-size: 13.5px; color: #E8E4F4; background: none; border: none; }
.clp-it:hover { background: rgba(255,255,255,.06); }
.clp-it.on { background: color-mix(in srgb, var(--c) 14%, transparent); }
.clp-it img, .clp-it i { width: 24px; height: 24px; border-radius: 7px; flex: none; object-fit: cover; }
.clp-it i { display: grid; place-items: center; font-style: normal; font-weight: 700; font-size: 12px; color: #fff; background: var(--c); }
.clp-it span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.clp-it svg { color: #22C55E; }
.clp-none { color: #FF6B85; } .clp-none svg { color: #FF6B85; }
.clp-empty { padding: 8px; font-size: 12.5px; color: #8A8AAA; }
.clp-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 6px; padding: 8px 8px 2px; border-top: .5px solid rgba(255,255,255,.08); }
.clp-foot a { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; color: #C8C4D8; text-decoration: none; }
.clp-foot a:hover { color: #fff; }
.clp-spin { animation: clpSpin .8s linear infinite; } @keyframes clpSpin { to { transform: rotate(360deg); } }
`
