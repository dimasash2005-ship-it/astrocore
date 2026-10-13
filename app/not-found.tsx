"use client"

// 404: the Core has lost the signal.

import Link from "next/link"
import CoreEye from "@/components/cosmos/CoreEye"
import { useLanguage } from "@/lib/useLanguage"

export default function NotFound() {
  const { language } = useLanguage()
  const uk = language === "uk"
  return (
    <div className="nf">
      <style>{`
        .nf { position: fixed; inset: 0; z-index: 60; display: grid; place-items: center; padding: 24px; background:
          radial-gradient(ellipse 60% 50% at 50% 42%, rgba(232,0,42,.10), transparent 70%), #08080F; color: #F0EDF8; text-align: center; overflow: hidden; }
        .nf::before { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
          background-image: radial-gradient(1px 1px at 12% 22%, #fff, transparent), radial-gradient(1px 1px at 82% 18%, #fff, transparent),
            radial-gradient(1px 1px at 68% 74%, #fff, transparent), radial-gradient(1.5px 1.5px at 24% 80%, #F5B13B, transparent),
            radial-gradient(1px 1px at 46% 12%, #fff, transparent), radial-gradient(1.5px 1.5px at 90% 56%, #5CC4F5, transparent); }
        .nf-in { position: relative; display: flex; flex-direction: column; align-items: center; max-width: 440px; }
        .nf-code { font: 600 11px 'JetBrains Mono', monospace; letter-spacing: .3em; color: #E8002A; margin: 4px 0 10px; }
        .nf h1 { font: 600 26px 'Space Grotesk', sans-serif; margin: 0 0 8px; letter-spacing: -.02em; }
        .nf p { margin: 0 0 22px; color: #A8A4BC; font-size: 14px; line-height: 1.6; }
        .nf-row { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
        .nf a { text-decoration: none; font-size: 13px; font-weight: 500; padding: 9px 18px; border-radius: 9px; transition: all .15s; }
        .nf .p { background: #E8002A; color: #fff; } .nf .p:hover { background: #FF1A3E; box-shadow: 0 0 22px rgba(232,0,42,.45); }
        .nf .g { color: #C8C4D8; border: .5px solid rgba(255,255,255,.14); } .nf .g:hover { color: #fff; border-color: rgba(232,0,42,.4); }
      `}</style>
      <div className="nf-in">
        <CoreEye size={190} track mood="error" title="AstroCore" />
        <div className="nf-code">ERROR 404 · SIGNAL LOST</div>
        <h1>{uk ? "Ядро загубило сигнал" : "The Core lost the signal"}</h1>
        <p>{uk ? "Такої сторінки немає в нашому всесвіті. Можливо, її перенесли або посилання застаріло." : "This page doesn't exist in our universe. It may have moved, or the link is out of date."}</p>
        <div className="nf-row">
          <Link href="/" className="p">{uk ? "На головну" : "Go home"}</Link>
          <Link href="/chat" className="g">{uk ? "До чатів" : "Open chats"}</Link>
        </div>
      </div>
    </div>
  )
}
