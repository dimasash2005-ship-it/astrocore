// lib/server/report-hooks.ts
//
// Everything that should happen when a new report appears, in one place:
//  1. Notion: auto export (if the user turned it on)
//  2. Telegram: send the report to the user's chat (if connected)
// Both are safe to call for any user: they do nothing when not set up, and never throw.

import { autoExportReport } from "@/lib/server/notion"
import { notifyReportTelegram } from "@/lib/server/telegram"

export async function onReportCreated(userId: string, reportId: string | null | undefined): Promise<void> {
  if (!reportId) return
  await autoExportReport(userId, reportId)       // first, so the Telegram message can include the Notion link
  await notifyReportTelegram(userId, reportId)
}
