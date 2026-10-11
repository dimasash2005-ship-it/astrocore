"use client"

// Shared pieces for the Integrations page:
//  - IntegrationCard: compact card (logo, name, status, chips, actions)
//  - IntegrationDrawer: side panel with the details; a soft glow in the
//    brand's own color opens up behind the logo when the panel opens.

import { useEffect, useState } from "react"
import { createPortal } from "react-dom"
import { X } from "lucide-react"

export function IntegrationCard({
  color, logo, name, desc, on, statusLabel, chips, actions, right, onOpen, delay = 0,
}: {
  color: string
  logo: React.ReactNode
  name: string
  desc: React.ReactNode
  on: boolean
  statusLabel: string
  chips?: React.ReactNode
  actions?: React.ReactNode
  right?: React.ReactNode
  onOpen?: () => void
  delay?: number
}) {
  return (
    <div className={`icd${on ? " on" : ""}`} style={{ ["--c" as string]: color, animationDelay: `${delay}ms` } as React.CSSProperties}>
      <style>{STYLES}</style>
      <div className="icd-top" onClick={onOpen} role={onOpen ? "button" : undefined}>
        <div className="icd-logo">{logo}</div>
        <div className="icd-tx">
          <div className="icd-name">{name}</div>
          <div className="icd-desc">{desc}</div>
        </div>
        <span className={`icd-pill${on ? " on" : ""}`}>{on && <span className="icd-live" />}{statusLabel}</span>
      </div>
      {chips && <div className="icd-chips">{chips}</div>}
      {(actions || right) && (
        <div className="icd-foot">
          {actions}
          {right && <div className="icd-right">{right}</div>}
        </div>
      )}
    </div>
  )
}

export function Chip({ label, children, mono = true, tone }: { label?: string; children: React.ReactNode; mono?: boolean; tone?: "key" }) {
  return (
    <span className={`icd-chip${mono ? " mono" : ""}${tone === "key" ? " key" : ""}`}>
      {label && <i>{label}</i>}{children}
    </span>
  )
}

export function IntegrationDrawer({
  open, onClose, color, logo, title, subtitle, children, footer,
}: {
  open: boolean
  onClose: () => void
  color: string
  logo: React.ReactNode
  title: string
  subtitle?: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    window.addEventListener("keydown", onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!mounted || !open) return null
  return createPortal(
    <div className="idr-wrap" style={{ ["--c" as string]: color } as React.CSSProperties}>
      <style>{STYLES}</style>
      <div className="idr-ov" onClick={onClose} />
      <aside className="idr" role="dialog" aria-label={title}>
        <div className="idr-glow" aria-hidden />
        <div className="idr-head">
          <div className="idr-logo">{logo}</div>
          <div style={{ minWidth: 0 }}>
            <div className="idr-title">{title}</div>
            {subtitle && <div className="idr-sub">{subtitle}</div>}
          </div>
          <button className="idr-x" onClick={onClose} aria-label="Close"><X size={15} /></button>
        </div>
        <div className="idr-body">{children}</div>
        {footer && <div className="idr-foot">{footer}</div>}
      </aside>
    </div>,
    document.body,
  )
}

export const STYLES = `
  @keyframes icdIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
  @keyframes icdPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(34,197,94,.55); } 50% { box-shadow: 0 0 0 5px rgba(34,197,94,0); } }
  .icd { position: relative; overflow: hidden; border-radius: 16px; padding: 18px 20px; display: flex; flex-direction: column; gap: 14px; min-width: 0;
    background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid rgba(255,255,255,.10);
    animation: icdIn .45s cubic-bezier(.2,.8,.2,1) both; transition: border-color .25s, box-shadow .25s, transform .25s; }
  .icd.on { border-color: rgba(34,197,94,.22); }
  .icd::before { content: ""; position: absolute; left: 0; top: 16px; bottom: 16px; width: 2px; background: linear-gradient(180deg, transparent, var(--c), transparent); opacity: .7; }
  .icd::after { content: ""; position: absolute; right: -70px; top: -70px; width: 200px; height: 200px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, var(--c), transparent); opacity: .08; transition: opacity .35s, transform .35s; }
  .icd:hover { transform: translateY(-2px); box-shadow: 0 14px 34px rgba(0,0,0,.45); }
  .icd:hover::after { opacity: .2; transform: scale(1.15); }
  .icd-top { position: relative; display: flex; align-items: center; gap: 13px; cursor: pointer; }
  .icd-logo { position: relative; width: 44px; height: 44px; border-radius: 12px; flex: none; display: grid; place-items: center; }
  .icd-logo::before { content: ""; position: absolute; inset: -14px; border-radius: 50%; background: radial-gradient(closest-side, var(--c), transparent);
    opacity: 0; transition: opacity .35s; z-index: 0; }
  .icd:hover .icd-logo::before { opacity: .3; }
  .icd-logo > * { position: relative; z-index: 1; }
  .icd-tx { flex: 1; min-width: 0; }
  .icd-name { font: 600 16px 'Space Grotesk', sans-serif; color: #F0EDF8; }
  .icd-desc { font-size: 12.5px; color: #8C8AA6; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icd-pill { flex: none; display: inline-flex; align-items: center; gap: 6px; font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .05em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 20px; color: #8A8AAA; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.1); }
  .icd-pill.on { color: #22C55E; background: rgba(34,197,94,.1); border-color: rgba(34,197,94,.3); }
  .icd-live { width: 6px; height: 6px; border-radius: 50%; background: #22C55E; animation: icdPulse 2s infinite; }
  .icd-chips { position: relative; display: flex; gap: 8px; flex-wrap: wrap; }
  .icd-chip { display: inline-flex; align-items: center; gap: 6px; max-width: 100%; font-size: 12px; color: #C8C4D8; padding: 6px 10px; border-radius: 9px;
    background: rgba(255,255,255,.035); border: 0.5px solid rgba(255,255,255,.08); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .icd-chip.mono { font: 500 11.5px 'JetBrains Mono', monospace; }
  .icd-chip i { font-style: normal; color: #6A6A8A; }
  .icd-chip.key { color: #7DD3FC; }
  .icd-foot { position: relative; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding-top: 12px; margin-top: auto; border-top: 0.5px solid rgba(255,255,255,.07); }
  .icd-right { margin-left: auto; display: flex; align-items: center; gap: 8px; }

  .ic-btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 13px; border-radius: 9px; font-size: 12.5px; font-weight: 500; font-family: inherit; cursor: pointer;
    text-decoration: none; color: #C8C4D8; background: rgba(255,255,255,.05); border: 0.5px solid rgba(255,255,255,.1); transition: all .15s; white-space: nowrap; }
  .ic-btn:hover:not(:disabled) { background: rgba(255,255,255,.09); color: #F0EDF8; }
  .ic-btn:disabled { opacity: .6; cursor: default; }
  .ic-btn.primary { background: #E8002A; color: #fff; border: none; font-weight: 600; }
  .ic-btn.primary:hover:not(:disabled) { background: #FF1A3E; box-shadow: 0 0 18px rgba(232,0,42,.35); }
  .ic-btn.warn { color: #FF6B85; background: rgba(232,0,42,.06); border-color: rgba(232,0,42,.25); }
  .ic-btn.warn:hover:not(:disabled) { background: rgba(232,0,42,.14); color: #FF8095; }
  .ic-btn.flat { background: transparent; border-color: transparent; color: #8A8AAA; }
  .ic-btn.flat:hover:not(:disabled) { color: #FF4D6A; background: rgba(232,0,42,.06); }
  .ic-note { font: 500 11px 'JetBrains Mono', monospace; color: #6A6A8A; display: inline-flex; align-items: center; gap: 5px; }
  .ic-tgl { display: inline-flex; align-items: center; gap: 8px; padding: 0; background: none; border: none; cursor: pointer; font: inherit; font-size: 12px; color: #8C8AA6; }
  .ic-tgl.on { color: #22C55E; }
  .ic-sw { position: relative; width: 30px; height: 17px; border-radius: 9px; flex: none; background: rgba(255,255,255,.12); transition: background .2s; }
  .ic-sw i { position: absolute; top: 2px; left: 2px; width: 13px; height: 13px; border-radius: 50%; background: #C8C4D8; transition: transform .2s, background .2s; }
  .ic-sw.on { background: #22C55E; box-shadow: 0 0 10px rgba(34,197,94,.35); }
  .ic-sw.on i { transform: translateX(13px); background: #fff; }
  @keyframes icSpin { to { transform: rotate(360deg); } }
  .ic-spin { animation: icSpin .8s linear infinite; }

  /* drawer */
  @keyframes idrFade { from { opacity: 0; } to { opacity: 1; } }
  @keyframes idrSlide { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
  @keyframes idrGlow { 0% { opacity: 0; transform: scale(.25); } 100% { opacity: .26; transform: scale(1); } }
  @keyframes idrLogo { 0% { transform: scale(.8); } 60% { transform: scale(1.06); } 100% { transform: none; } }
  .idr-wrap { position: fixed; inset: 0; z-index: 400; }
  .idr-ov { position: absolute; inset: 0; background: rgba(4,4,10,.62); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); animation: idrFade .2s ease-out; }
  .idr { position: absolute; top: 0; right: 0; bottom: 0; width: 480px; max-width: 100vw; display: flex; flex-direction: column; overflow: hidden;
    background: linear-gradient(170deg, #13131F 0%, #0C0C16 100%); border-left: 0.5px solid color-mix(in srgb, var(--c) 35%, transparent);
    box-shadow: -30px 0 80px rgba(0,0,0,.7); animation: idrSlide .28s cubic-bezier(.2,.9,.3,1); }
  .idr-glow { position: absolute; top: -190px; left: -150px; width: 520px; height: 520px; border-radius: 50%; pointer-events: none;
    background: radial-gradient(closest-side, var(--c), transparent 72%); opacity: 0; animation: idrGlow 1s cubic-bezier(.2,.8,.2,1) .08s forwards; }
  .idr-head { position: relative; display: flex; align-items: center; gap: 13px; padding: 22px 24px 18px; }
  .idr-logo { width: 48px; height: 48px; border-radius: 13px; flex: none; display: grid; place-items: center; animation: idrLogo .5s cubic-bezier(.2,.9,.3,1.3);
    box-shadow: 0 0 34px color-mix(in srgb, var(--c) 45%, transparent); }
  .idr-title { font: 600 19px 'Space Grotesk', sans-serif; color: #F0EDF8; }
  .idr-sub { font-size: 12.5px; color: #8C8AA6; margin-top: 2px; }
  .idr-x { margin-left: auto; width: 32px; height: 32px; border-radius: 9px; display: grid; place-items: center; flex: none; cursor: pointer;
    background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.1); color: #8A8AAA; }
  .idr-x:hover { color: #fff; border-color: rgba(232,0,42,.4); }
  .idr-body { position: relative; flex: 1; overflow-y: auto; padding: 4px 24px 24px; display: flex; flex-direction: column; gap: 18px; }
  .idr-foot { position: relative; display: flex; gap: 8px; flex-wrap: wrap; padding: 14px 24px 20px; border-top: 0.5px solid rgba(255,255,255,.07); background: rgba(8,8,15,.5); }
  .idr-foot .push { margin-left: auto; }

  .idr-label { font: 600 9.5px 'JetBrains Mono', monospace; letter-spacing: .08em; text-transform: uppercase; color: #8A8AAA; margin-bottom: 8px; }
  .idr-field { display: flex; align-items: center; gap: 8px; padding: 11px 13px; border-radius: 10px; background: #0A0A12; border: 0.5px solid rgba(255,255,255,.1);
    font: 600 13px 'JetBrains Mono', monospace; color: #F0EDF8; min-width: 0; }
  .idr-field > span { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .idr-flow { display: flex; align-items: center; padding: 14px; border-radius: 12px; background: rgba(10,10,18,.8); border: 0.5px solid rgba(255,255,255,.08); }
  .idr-node { width: 38px; height: 38px; border-radius: 11px; display: grid; place-items: center; flex: none; font: 800 17px 'Space Grotesk', sans-serif; }
  .idr-node.a { background: rgba(232,0,42,.12); border: 0.5px solid rgba(232,0,42,.35); color: #E8002A; }
  .idr-line { flex: 1; min-width: 20px; height: 2px; margin: 0 10px; border-radius: 2px; background: rgba(255,255,255,.08); }
  @keyframes idrFlow { 0% { background-position: 0 0; } 100% { background-position: 40px 0; } }
  .idr-line.on { background: repeating-linear-gradient(90deg, rgba(34,197,94,.9) 0 7px, transparent 7px 16px); animation: idrFlow 1s linear infinite; }
  .idr-caps { display: flex; flex-direction: column; gap: 10px; }
  .idr-cap { display: flex; gap: 10px; font-size: 13px; color: #C8C4D8; line-height: 1.5; }
  .idr-cap > span { width: 20px; height: 20px; border-radius: 6px; flex: none; display: grid; place-items: center; color: #22C55E;
    background: rgba(34,197,94,.1); border: 0.5px solid rgba(34,197,94,.28); }
  .idr-steps { display: flex; flex-direction: column; }
  .idr-step { position: relative; display: flex; gap: 12px; padding: 0 0 14px; }
  .idr-step:not(:last-child)::before { content: ""; position: absolute; left: 11px; top: 24px; bottom: 2px; width: 1px; background: rgba(232,0,42,.25); }
  .idr-step b { width: 23px; height: 23px; border-radius: 50%; display: grid; place-items: center; flex: none; font: 11px 'JetBrains Mono', monospace;
    color: #E8002A; background: rgba(232,0,42,.1); border: 0.5px solid rgba(232,0,42,.35); }
  .idr-step span { font-size: 12.5px; color: #A8A4BC; line-height: 1.6; padding-top: 2px; }
  .idr-msg { display: flex; align-items: center; gap: 9px; padding: 10px 13px; border-radius: 11px; font-size: 13px; color: #FF8095;
    background: rgba(232,0,42,.07); border: 0.5px solid rgba(232,0,42,.25); }
  .idr-msg.ok { color: #22C55E; background: rgba(34,197,94,.07); border-color: rgba(34,197,94,.25); }
  .idr-msg svg { flex: none; }
  @media (max-width: 640px) { .idr { width: 100vw; } .idr-head, .idr-body, .idr-foot { padding-left: 18px; padding-right: 18px; } }
  @media (prefers-reduced-motion: reduce) { .icd, .idr, .idr-ov, .idr-glow, .idr-logo, .idr-line.on { animation: none; } .idr-glow { opacity: .26; } }
`