// lib/server/report-hooks.ts
//
// Everything that should happen when a new report appears, in one place:
//  1. Notion: auto export (if the user turned it on)
//  2. Telegram: send the report to the user's chat (if connected)
//  3. Push: notification on the user's phone / browser (if they turned it on)
// Both are safe to call for any user: they do nothing when not set up, and never throw.

import { autoExportReport } from "@/lib/server/notion"
import { notifyReportTelegram } from "@/lib/server/telegram"
import { pushToUser, pushService, pushExcerpt, pushConfigured } from "@/lib/server/push"

export async function onReportCreated(userId: string, reportId: string | null | undefined): Promise<void> {
  if (!reportId) return
  await autoExportReport(userId, reportId)       // first, so the Telegram message can include the Notion link
  await notifyReportTelegram(userId, reportId)
  await notifyReportPush(userId, reportId)
}

async function notifyReportPush(userId: string, reportId: string): Promise<void> {
  if (!pushConfigured()) return
  try {
    const { data: r } = await pushService().from("reports").select("company_name, summary").eq("id", reportId).eq("user_id", userId).maybeSingle()
    if (!r) return
    await pushToUser(userId, {
      title: `📊 ${String(r.company_name || "Report").slice(0, 80)}`,
      body: pushExcerpt(String(r.summary ?? "")) || "…",
      url: `/reports/${reportId}`,
      tag: `report-${reportId}`,
    })
  } catch (err) {
    console.error("[push report]", err instanceof Error ? err.message : err)
  }
}
