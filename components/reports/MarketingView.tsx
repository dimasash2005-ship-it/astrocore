// components/reports/MarketingView.tsx
//
// Read-only marketing dashboard of a report: KPI tiles with colour dots, funnel,
// campaigns table and a plain-words summary. No hooks, so it renders on the server
// too (client portal) and inside the editable MarketingLab.

import {
  computeMetrics, effectiveRevenue, funnel, grade, summary, bestWorst, fmtMoney, fmtNum,
  type Marketing, type MetricKey, type Grade,
} from "@/lib/marketing"

type Lang = "uk" | "en"

export const MKT_TX = {
  uk: {
    roi: "ROI", roas: "ROAS", profit: "Прибуток", ctr: "CTR", cpc: "CPC", cpm: "CPM", crLead: "Клік → лід", cpl: "Ціна ліда (CPL)",
    crSale: "Лід → продаж", cpa: "Ціна продажу (CPA)", aov: "Середній чек", epc: "EPC (дохід / клік)",
    g: { good: "добре", ok: "норма", bad: "слабке місце", none: "" } as Record<Grade, string>,
    funnel: "Воронка: де губляться люди", impressions: "Покази", clicks: "Кліки", leads: "Ліди", sales: "Продажі",
    of: "з попереднього етапу", worst: "найбільша втрата", table: "Кампанії / креативи", name: "Назва", spend: "Витрати",
    summary: "Автовисновок", best: "найкраща", worstRow: "найгірша",
    aff: { leads: "Конверсії", sales: "Апруви", crSale: "Апрув", cpl: "Ціна конверсії", cpa: "Ціна апруву", aov: "Payout" },
  },
  en: {
    roi: "ROI", roas: "ROAS", profit: "Profit", ctr: "CTR", cpc: "CPC", cpm: "CPM", crLead: "Click → lead", cpl: "Cost per lead",
    crSale: "Lead → sale", cpa: "Cost per sale", aov: "Avg order", epc: "EPC (revenue / click)",
    g: { good: "good", ok: "ok", bad: "weak spot", none: "" } as Record<Grade, string>,
    funnel: "Funnel: where people drop off", impressions: "Impressions", clicks: "Clicks", leads: "Leads", sales: "Sales",
    of: "of previous step", worst: "biggest loss", table: "Campaigns / creatives", name: "Name", spend: "Spend",
    summary: "Auto summary", best: "best", worstRow: "worst",
    aff: { leads: "Conversions", sales: "Approved", crSale: "Approve rate", cpl: "Cost per conversion", cpa: "Cost per approve", aov: "Payout" },
  },
}

const ORDER: MetricKey[] = ["roi", "roas", "profit", "ctr", "cpc", "cpm", "crLead", "cpl", "crSale", "cpa", "aov", "epc"]
const PCT = new Set<MetricKey>(["roi", "ctr", "crLead", "crSale"])
const MONEY = new Set<MetricKey>(["profit", "cpc", "cpm", "cpl", "cpa", "aov", "epc"])

export function metricLabel(key: MetricKey | "impressions" | "clicks" | "leads" | "sales", m: Pick<Marketing, "channel">, lang: Lang): string {
  const t = MKT_TX[lang]
  if (m.channel === "affiliate" && key in t.aff) return t.aff[key as keyof typeof t.aff]
  return (t as unknown as Record<string, string>)[key] ?? key
}

function fmt(key: MetricKey, v: number, cur: string) {
  if (PCT.has(key)) return `${fmtNum(v, Math.abs(v) < 10 ? 2 : 0)}%`
  if (key === "roas") return `${fmtNum(v, 2)}×`
  if (MONEY.has(key)) return fmtMoney(v, cur)
  return fmtNum(v, 2)
}

export default function MarketingView({ m, lang, compact }: { m: Marketing; lang: Lang; compact?: boolean }) {
  const t = MKT_TX[lang]
  const rev = effectiveRevenue(m, m.totals)
  const x = computeMetrics(m.totals, rev)
  const keys = ORDER.filter(k => x[k] !== null)
  const f = funnel(m.totals)
  const max = f.steps[0]?.value || 1
  const bw = bestWorst(m)
  const lines = summary(m, lang)

  return (
    <div className={`mkv${compact ? " compact" : ""}`}>
      <style>{MKT_CSS}</style>
      {keys.length > 0 && (
        <div className="mkv-kpis">
          {keys.map(k => {
            const g = grade(k, x[k], m, x)
            return (
              <div key={k} className={`mkv-kpi g-${g}`}>
                <small>{metricLabel(k, m, lang)}</small>
                <b>{fmt(k, x[k]!, m.currency)}</b>
                {g !== "none" && <em>{t.g[g]}</em>}
              </div>
            )
          })}
        </div>
      )}

      {lines.length > 0 && (
        <div className="mkv-sum">
          <span>🤖 {t.summary}</span>
          {lines.map((l, i) => <p key={i}>{l}</p>)}
        </div>
      )}

      {f.steps.length >= 2 && (
        <div className="mkv-card">
          <div className="mkv-k">{t.funnel}</div>
          <div className="mkv-fun">
            {f.steps.map((s, i) => (
              <div key={s.key}>
                {i > 0 && (
                  <div className={`mkv-drop${f.worst === i ? " worst" : ""}`}>
                    ↓ {fmtNum(s.rateFromPrev ?? 0, (s.rateFromPrev ?? 0) < 10 ? 1 : 0)}% {t.of}{f.worst === i ? ` · ${t.worst}` : ""}
                  </div>
                )}
                <div className="mkv-bar" style={{ width: `${Math.max(14, Math.pow(s.value / max, 0.28) * 100)}%` }}>
                  <span>{metricLabel(s.key, m, lang)}</span><b>{fmtNum(s.value)}</b>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {m.rows.length >= 2 && (
        <div className="mkv-card">
          <div className="mkv-k">{t.table}</div>
          <div className="mkv-tbl">
            <table>
              <thead><tr>
                <th>{t.name}</th><th>{t.spend}</th><th>CTR</th><th>{metricLabel("cpl", m, lang)}</th><th>ROAS</th>
              </tr></thead>
              <tbody>
                {m.rows.map((r, i) => {
                  const rx = computeMetrics(r, effectiveRevenue(m, r))
                  const cls = bw.best === i ? "best" : bw.worst === i ? "worst" : ""
                  return (
                    <tr key={i} className={cls}>
                      <td>{bw.best === i ? "🏆 " : bw.worst === i ? "⚠️ " : ""}{r.name}</td>
                      <td>{fmtMoney(r.spend, m.currency)}</td>
                      <td>{rx.ctr !== null ? `${fmtNum(rx.ctr, 2)}%` : "—"}</td>
                      <td>{rx.cpl !== null ? fmtMoney(rx.cpl, m.currency) : "—"}</td>
                      <td>{rx.roas !== null ? `${fmtNum(rx.roas, 2)}×` : "—"}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export const MKT_CSS = `
.mkv { --mk: var(--c, #E8002A); display: flex; flex-direction: column; gap: 14px; font-family: 'Space Grotesk', system-ui, sans-serif; color: #F0EDF8; }
.mkv-kpis { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.mkv-kpi { position: relative; display: flex; flex-direction: column; gap: 3px; padding: 13px 14px; border-radius: 13px; background: rgba(255,255,255,.03); border: .5px solid rgba(255,255,255,.09); }
.mkv-kpi::after { content: ""; position: absolute; top: 13px; right: 12px; width: 8px; height: 8px; border-radius: 50%; background: var(--d, transparent); box-shadow: 0 0 9px var(--d, transparent); }
.mkv-kpi small { font: 600 10px 'JetBrains Mono', monospace; letter-spacing: .06em; text-transform: uppercase; color: #8A8AAA; padding-right: 14px; }
.mkv-kpi b { font-size: 22px; letter-spacing: -.01em; line-height: 1.15; }
.mkv-kpi em { font-style: normal; font-size: 11.5px; color: var(--d); }
.mkv-kpi.g-good { --d: #22C55E; } .mkv-kpi.g-ok { --d: #F5B13B; } .mkv-kpi.g-bad { --d: #FF4D6A; border-color: rgba(255,77,106,.3); }
.mkv-sum { padding: 14px 16px; border-radius: 14px; background: linear-gradient(120deg, rgba(139,92,246,.12), color-mix(in srgb, var(--mk) 8%, transparent)); border: .5px solid rgba(139,92,246,.35); }
.mkv-sum span { display: block; font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .1em; text-transform: uppercase; color: #C4B5FD; margin-bottom: 6px; }
.mkv-sum p { margin: 3px 0; font-size: 14px; line-height: 1.55; color: #E8E4F4; }
.mkv-card { padding: 16px 18px; border-radius: 14px; background: rgba(255,255,255,.025); border: .5px solid rgba(255,255,255,.09); }
.mkv-k { font: 600 10.5px 'JetBrains Mono', monospace; letter-spacing: .12em; text-transform: uppercase; color: #8A8AAA; margin-bottom: 12px; }
.mkv-fun { display: flex; flex-direction: column; gap: 6px; }
.mkv-bar { height: 34px; border-radius: 9px; display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 0 12px; box-sizing: border-box;
  background: linear-gradient(90deg, color-mix(in srgb, var(--mk) 75%, transparent), color-mix(in srgb, var(--mk) 22%, transparent)); font-size: 13px; white-space: nowrap; }
.mkv-bar b { font-family: 'JetBrains Mono', monospace; }
.mkv-drop { font: 500 11.5px 'JetBrains Mono', monospace; color: #8A8AAA; padding: 2px 0 2px 12px; }
.mkv-drop.worst { color: #FF6B85; }
.mkv-tbl { overflow-x: auto; }
.mkv table { width: 100%; border-collapse: collapse; font-size: 13px; }
.mkv th { text-align: left; font-weight: 500; color: #8A8AAA; padding: 8px 10px; border-bottom: .5px solid rgba(255,255,255,.1); white-space: nowrap; }
.mkv td { padding: 9px 10px; border-bottom: .5px solid rgba(255,255,255,.05); font-family: 'JetBrains Mono', monospace; font-size: 12.5px; white-space: nowrap; }
.mkv td:first-child { font-family: inherit; font-size: 13px; white-space: normal; }
.mkv tr.best td { background: rgba(34,197,94,.08); } .mkv tr.worst td { background: rgba(232,0,42,.08); }
.mkv.compact .mkv-kpis { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); }
`
