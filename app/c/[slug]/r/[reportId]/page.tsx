// app/c/[slug]/r/[reportId]/page.tsx
//
// One report inside a client portal. Only reports tagged with this client are shown.

import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { notFound } from "next/navigation"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { loadPortal, isUnlocked, portalCookie, portalService, type PortalReport } from "@/lib/server/portal"
import { PTX, portalLang, fmtDate, PortalHeader, PortalFooter, PORTAL_CSS } from "@/components/clients/portalUi"
import PortalGate from "@/components/clients/PortalGate"

export const dynamic = "force-dynamic"

export async function generateMetadata(): Promise<Metadata> {
  return { robots: { index: false, follow: false } }
}

export default async function PortalReportPage({ params }: { params: Promise<{ slug: string; reportId: string }> }) {
  const { slug, reportId } = await params
  const c = await loadPortal(slug)
  if (!c || !c.is_active || !/^[0-9a-f-]{36}$/i.test(reportId)) notFound()
  const t = PTX[await portalLang()]
  const lang = t === PTX.uk ? "uk" : "en"
  const style = { ["--c" as string]: c.color } as React.CSSProperties

  const jar = await cookies()
  if (!isUnlocked(c, jar.get(portalCookie(c.slug))?.value)) {
    return (
      <main className="cp" style={style}><style>{PORTAL_CSS}</style>
        <div className="cp-wrap"><PortalHeader c={c} t={t} /><PortalGate slug={c.slug} lang={lang} /></div>
      </main>
    )
  }

  const { data } = await portalService().from("reports")
    .select("id, company_name, summary, created_at")
    .eq("id", reportId).eq("client_id", c.id).eq("user_id", c.user_id).maybeSingle()
  const r = data as PortalReport | null
  if (!r) notFound()
  const words = (r.summary ?? "").split(/\s+/).filter(Boolean).length

  return (
    <main className="cp" style={style}>
      <style>{PORTAL_CSS}</style>
      <div className="cp-wrap">
        <PortalHeader c={c} t={t} small />
        <Link href={`/c/${c.slug}`} className="cp-back">← {t.back}</Link>
        <article className="cp-doc">
          <div className="cp-meta">{fmtDate(r.created_at, t, true)} · {Math.max(1, Math.round(words / 200))} {t.min}</div>
          <h1 className="cp-title">{r.company_name}</h1>
          <div className="cp-md">
            <ReactMarkdown remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h2>{children}</h2>,
                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer nofollow">{children}</a>,
                table: ({ children }) => <div className="cp-tbl"><table>{children}</table></div>,
                img: () => null,
              }}>
              {r.summary ?? ""}
            </ReactMarkdown>
          </div>
        </article>
        <PortalFooter c={c} t={t} />
      </div>
    </main>
  )
}
