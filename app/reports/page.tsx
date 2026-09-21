"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Building2, Plus, X, Loader2, ChevronRight,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

type Report = {
  id: string
  user_id: string
  company_name: string
  summary: string | null
  chart_data: unknown
  created_at: string
}

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  s2:   "#16162A",
  b1:   "rgba(255,255,255,0.10)",
  b2:   "rgba(255,255,255,0.16)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
}

function ago(iso: string, lang: Language): string {
  if (!iso) return ""
  const d  = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(d / 60000)
  if (m < 1)  return lang === "uk" ? "щойно" : "just now"
  if (m < 60) return `${m} ${lang === "uk" ? "хв тому" : "min ago"}`
  const h  = Math.floor(m / 60)
  if (h < 24) return `${h} ${lang === "uk" ? "год тому" : "h ago"}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return lang === "uk" ? "вчора" : "yesterday"
  if (dy < 7)  return `${dy}${lang === "uk" ? " дн тому" : "d ago"}`
  const locale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "short" })
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9,
  padding: "9px 12px",
  fontSize: 13,
  color: T.t1,
  outline: "none",
  width: "100%",
}

export default function ReportsPage() {
  const { language } = useLanguage()
  const router = useRouter()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [showNew, setShowNew] = useState(false)
  const [newCompany, setNewCompany] = useState("")
  const [newSummary, setNewSummary] = useState("")
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    setLoading(true)
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setLoading(false); return }
    const { data } = await sb
      .from("reports")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
    setReports((data as Report[]) ?? [])
    setLoading(false)
  }

  async function createReport() {
    if (!newCompany.trim()) return
    setSaving(true)
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setSaving(false); return }
    const { data, error } = await sb.from("reports").insert({
      user_id: user.id,
      company_name: newCompany.trim(),
      summary: newSummary.trim() || null,
    }).select("id").single()
    setSaving(false)
    if (!error) {
      setNewCompany("")
      setNewSummary("")
      setShowNew(false)
      if (data?.id) {
        router.push(`/reports/${data.id}`)
      } else {
        load()
      }
    }
  }

  const tr = {
    title: language === "uk" ? "Звіти" : "Reports",
    subtitle: language === "uk"
      ? "Звіти від агентів по компаніях та аналітиці"
      : "Agent-generated reports by company and analytics",
    newBtn: language === "uk" ? "Новий звіт" : "New report",
    empty: language === "uk" ? "Звітів поки немає" : "No reports yet",
    emptySub: language === "uk"
      ? "Створи перший звіт вручну або дочекайся, поки агент згенерує його сам"
      : "Create your first report manually, or wait for an agent to generate one",
    companyLabel: language === "uk" ? "Назва компанії" : "Company name",
    summaryLabel: language === "uk" ? "Текст звіту" : "Report text",
    cancel: language === "uk" ? "Скасувати" : "Cancel",
    save: language === "uk" ? "Зберегти" : "Save",
  }

  return (
    <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg }}>
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');
        @keyframes astrocore-sweep {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(100%); opacity: 0; }
        }
        .astrocore-reports-sweep {
          position: relative;
          overflow: hidden;
        }
        .astrocore-reports-sweep::after {
          content: "";
          position: absolute;
          top: 0; left: 0;
          width: 40%; height: 100%;
          background: linear-gradient(90deg, transparent, ${T.red}, transparent);
          animation: astrocore-sweep 4s ease-in-out infinite;
        }
        .astrocore-report-card {
          transition: border-color 0.15s, transform 0.15s;
        }
        .astrocore-report-card:hover {
          border-color: ${T.bRed} !important;
          transform: translateY(-1px);
        }
      `}</style>

      <div style={{ padding: "32px 40px 60px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
          <div>
            <h1 style={{
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: 28, fontWeight: 700, color: T.t1, margin: 0,
            }}>
              {tr.title}
            </h1>
            <p style={{ color: T.t3, fontSize: 14, marginTop: 6 }}>{tr.subtitle}</p>
          </div>
          <button
            onClick={() => setShowNew(true)}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              background: T.red, color: "#fff", border: "none",
              borderRadius: 10, padding: "10px 16px",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Plus size={16} /> {tr.newBtn}
          </button>
        </div>

        <div style={{ height: 1, background: T.b1, marginBottom: 28 }} className="astrocore-reports-sweep" />

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 60, color: T.t3 }}>
            <Loader2 size={22} className="animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "60px 20px",
            background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 14,
          }}>
            <Building2 size={28} style={{ color: T.t4, margin: "0 auto 12px" }} />
            <div style={{ color: T.t2, fontSize: 15, fontWeight: 600 }}>{tr.empty}</div>
            <div style={{ color: T.t4, fontSize: 13, marginTop: 6 }}>{tr.emptySub}</div>
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}>
            {reports.map((r) => (
              <div
                key={r.id}
                onClick={() => router.push(`/reports/${r.id}`)}
                className="astrocore-report-card"
                style={{
                  background: T.s1,
                  border: `0.5px solid ${T.b1}`,
                  borderRadius: 14,
                  padding: 18,
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 9,
                      background: T.s2, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Building2 size={16} style={{ color: T.red }} />
                    </div>
                    <div>
                      <div style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 14, fontWeight: 600, color: T.t1,
                      }}>
                        {r.company_name}
                      </div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: T.t4 }}>
                        {ago(r.created_at, language)}
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} style={{ color: T.t4 }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
        }}>
          <div style={{
            background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 16,
            padding: 24, width: 420, maxWidth: "90vw",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 16, fontWeight: 700, color: T.t1 }}>
                {tr.newBtn}
              </div>
              <X size={18} style={{ color: T.t3, cursor: "pointer" }} onClick={() => setShowNew(false)} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: T.t3, marginBottom: 6 }}>{tr.companyLabel}</div>
              <input style={inp} value={newCompany} onChange={(e) => setNewCompany(e.target.value)} />
            </div>

            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 12, color: T.t3, marginBottom: 6 }}>{tr.summaryLabel}</div>
              <textarea
                style={{ ...inp, minHeight: 100, resize: "vertical", fontFamily: "inherit" }}
                value={newSummary}
                onChange={(e) => setNewSummary(e.target.value)}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => setShowNew(false)}
                style={{ background: "transparent", border: `0.5px solid ${T.b1}`, color: T.t2, borderRadius: 9, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}
              >
                {tr.cancel}
              </button>
              <button
                onClick={createReport}
                disabled={saving || !newCompany.trim()}
                style={{ background: T.red, border: "none", color: "#fff", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.6 : 1 }}
              >
                {saving ? "..." : tr.save}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}