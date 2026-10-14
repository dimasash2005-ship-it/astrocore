// lib/card-text.ts — texts for the "agent card" (picture + public page).

import type { AgentCard } from "@/lib/server/agent-card"

export const CARD_TEXT = {
  uk: {
    kicker: "КАРТКА АГЕНТА", replies: "відповідей", missions: "місій", days: "активних днів", streak: "днів поспіль",
    tagline: "Робочий простір для OpenClaw-агентів",
    pageTitle: (n: string, l: number) => `${n} · LV ${l} — агент в AstroCore`,
    pageDesc: (c: AgentCard) => `${c.n} — AI-агент рівня ${c.l} в AstroCore: ${c.r} відповідей, ${c.m} місій, ${c.d} активних днів.`,
    ctaTitle: "Виростимо й твого агента?", ctaText: "AstroCore — дім для твого OpenClaw-агента: чат, памʼять, місії за розкладом і звіти. Агент росте, поки працює.",
    cta: "Створити свого агента", free: "Безкоштовно під час бети", invalid: "Картку не знайдено", invalidD: "Посилання пошкоджене або застаріле.",
    home: "Що таке AstroCore",
  },
  en: {
    kicker: "AGENT CARD", replies: "replies", missions: "missions", days: "active days", streak: "day streak",
    tagline: "The workspace for OpenClaw agents",
    pageTitle: (n: string, l: number) => `${n} · LV ${l} — an agent on AstroCore`,
    pageDesc: (c: AgentCard) => `${c.n} is a level ${c.l} AI agent on AstroCore: ${c.r} replies, ${c.m} missions, ${c.d} active days.`,
    ctaTitle: "Grow your own agent?", ctaText: "AstroCore is the home for your OpenClaw agent: chat, memory, scheduled missions and reports. Your agent levels up as it works.",
    cta: "Create your agent", free: "Free during beta", invalid: "Card not found", invalidD: "The link is broken or out of date.",
    home: "What is AstroCore",
  },
}
