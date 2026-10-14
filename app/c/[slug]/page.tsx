// app/c/[slug]/page.tsx
//
// Public client portal: astrocore.one/c/<slug>
// The client of an agency / marketer sees the reports made for them, in their own colours.
// Optional password. Never shows the owner's chats, memory, other clients or email.

import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import { loadPortal, portalReports, isUnlocked, portalCookie, portalService, excerpt } from "@/lib/server/portal"
import { PTX, portalLang, fmtDate, PortalHeader, PortalFooter, PORTAL_CSS } from "@/components/clients/portalUi"
import PortalGate from "@/components/clients/PortalGate"

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const c = await loadPortal(slug)
  if (!c || !c.is_active) return { title: "AstroCore", robots: { index: false, follow: false } }
  return { title: { absolute: `${c.name} · ${(await portalLang()) === "uk" ? "Кабінет клієнта" : "Client portal"}` }, robots: { index: false, follow: false } }
}

export default async function ClientPortal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const c = await loadPortal(slug)
  if (!c) notFound()
  const t = PTX[await portalLang()]
  const lang = t === PTX.uk ? "uk" : "en"
  const style = { ["--c" as string]: c.color } as React.CSSProperties

  if (!c.is_active) {
    return (
      <main className="cp" style={style}><style>{PORTAL_CSS}</style>
        <div className="cp-wrap"><PortalHeader c={c} t={t} /><div className="cp-empty" style={{ marginTop: 40 }}><b>{t.off}</b>{t.offD}</div></div>
      </main>
    )
  }

  const jar = await cookies()
  if (!isUnlocked(c, jar.get(portalCookie(c.slug))?.value)) {
    return (
      <main className="cp" style={style}><style>{PORTAL_CSS}</style>
        <div className="cp-wrap"><PortalHeader c={c} t={t} /><PortalGate slug={c.slug} lang={lang} /><PortalFooter c={c} t={t} /></div>
      </main>
    )
  }

  const reports = await portalReports(c)
  // Count the visit (best effort).
  await portalService().from("clients").update({ views: (c.views ?? 0) + 1 }).eq("id", c.id).then(() => {}, () => {})

  const monthAgo = Date.now() - 30 * 86_400_000
  const thisMonth = reports.filter(r => Date.parse(r.created_at) > monthAgo).length
  const [first, ...rest] = reports

  return (
    <main className="cp" style={style}>
      <style>{PORTAL_CSS}</style>
      <div className="cp-wrap">
        <PortalHeader c={c} t={t} />
        {c.intro && <p className="cp-intro">{c.intro}</p>}

        <div className="cp-stats">
          <div className="cp-stat"><b>{reports.length}</b><span>{t.reports}</span></div>
          <div className="cp-stat"><b>{thisMonth}</b><span>{t.month}</span></div>
          <div className="cp-stat"><b style={{ fontSize: 17, marginTop: 6 }}>{first ? fmtDate(first.created_at, t) : t.never}</b><span>{t.updated}</span></div>
        </div>

        {!first ? (
          <div className="cp-empty" style={{ marginTop: 30 }}><b>{t.empty}</b>{t.emptyD}</div>
        ) : (
          <>
            <div className="cp-k">{t.latest}</div>
            <Link href={`/c/${c.slug}/r/${first.id}`} className="cp-feat">
              <small>{fmtDate(first.created_at, t, true)}</small>
              <h2>{first.company_name}</h2>
              <p>{excerpt(first.summary, 320)}</p>
              <span className="cp-go">{t.read} →</span>
            </Link>

            {rest.length > 0 && (
              <>
                <div className="cp-k">{t.all}</div>
                <div className="cp-list">
                  {rest.map(r => (
                    <Link key={r.id} href={`/c/${c.slug}/r/${r.id}`} className="cp-row">
                      <span className="cp-date">{fmtDate(r.created_at, t)}</span>
                      <span><b>{r.company_name}</b><p>{excerpt(r.summary, 160)}</p></span>
                      <i>→</i>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
        <PortalFooter c={c} t={t} />
      </div>
    </main>
  )
}
