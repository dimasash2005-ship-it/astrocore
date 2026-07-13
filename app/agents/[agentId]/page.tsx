"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft, MessageSquare, Trash2, Save,
  Plus, Clock, Edit3, X, Check, AlertCircle,
  ChevronRight, Bot, Zap,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { chatStore, type ChatSession } from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { AgentTools }     from "@/components/agents/AgentTools"
import { AgentKnowledge } from "@/components/agents/AgentKnowledge"
import { AgentWorkflow }  from "@/components/agents/AgentWorkflow"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

const T = {
  bg:   "#08080F",
  s1:   "#11111C",
  b1:   "rgba(255,255,255,0.10)",
  bRed: "rgba(232,0,42,0.30)",
  t1:   "#F0EDF8",
  t2:   "#C8C4D8",
  t3:   "#A8A4BC",
  t4:   "#585878",
  red:  "#E8002A",
  green:"#22C55E",
}

const AVATAR_COLORS = [
  "#E8002A","#10A37F","#D97757",
  "#4285F4","#8B5CF6","#F59E0B",
  "#06B6D4","#EC4899",
]

// ─── Skill registry (bilingual) ───────────────────────────────────

type Skill = { label: string; prompt: string }

const SKILL_REGISTRY_UK: Record<string, Skill[]> = {
  SEO: [
    { label: "SEO аудит",       prompt: "Зроби детальний SEO аудит для мого сайту. Запитай у мене URL і я надам деталі." },
    { label: "Семантичне ядро", prompt: "Допоможи зібрати семантичне ядро. Запитай нішу, регіон і головні послуги/продукти." },
    { label: "Контент-план",    prompt: "Склади SEO контент-план на наступний місяць. Запитай нішу, цільову аудиторію і цілі." },
    { label: "ТЗ для статті",   prompt: "Склади технічне завдання для SEO-статті. Запитай тему, ключові слова і обсяг." },
    { label: "Аналіз конкурентів", prompt: "Проведи аналіз конкурентів у пошуку. Запитай нішу і основних конкурентів." },
  ],
  SMM: [
    { label: "Контент-план",    prompt: "Склади контент-план для соцмереж на місяць. Запитай платформу, нішу і тон бренду." },
    { label: "Ідеї постів",     prompt: "Дай 10 ідей для постів. Запитай нішу, платформу і поточну аудиторію." },
    { label: "Reels сценарій",  prompt: "Напиши сценарій для Reels/TikTok. Запитай тему, тон і тривалість відео." },
    { label: "Аналіз аудиторії", prompt: "Допоможи описати портрет цільової аудиторії. Запитай нішу і продукт." },
    { label: "Хуки для постів", prompt: "Дай 10 сильних хуків для постів у соцмережах. Запитай нішу і тип контенту." },
  ],
  Sales: [
    { label: "Скрипт продажу",  prompt: "Напиши скрипт продажу. Запитай продукт/послугу, канал і цільову аудиторію." },
    { label: "Обробка заперечень", prompt: "Допоможи з обробкою заперечень. Запитай топ-3 заперечення твоїх клієнтів." },
    { label: "Follow-up лист",  prompt: "Напиши follow-up повідомлення після зустрічі. Запитай контекст і результат зустрічі." },
    { label: "Кваліфікація ліда", prompt: "Допоможи кваліфікувати ліда. Запитай продукт і профіль клієнта." },
    { label: "Pitch для клієнта", prompt: "Напиши elevator pitch для клієнта. Запитай продукт, проблему і цільову аудиторію." },
  ],
  Affiliate: [
    { label: "Аналіз офера",    prompt: "Проаналізуй CPA-офер. Запитай назву офера, вертикаль, умови і гео." },
    { label: "GEO research",    prompt: "Зроби GEO-дослідження для трафіку. Запитай вертикаль і бюджет." },
    { label: "Traffic strategy", prompt: "Розроби стратегію трафіку. Запитай вертикаль, гео і доступні джерела трафіку." },
    { label: "Landing review",  prompt: "Проаналізуй лендінг для affiliate-трафіку. Надай URL або опис лендінгу." },
    { label: "Воронка",         prompt: "Допоможи побудувати воронку для affiliate. Запитай офер, гео і джерело трафіку." },
  ],
  Content: [
    { label: "Структура статті", prompt: "Склади структуру статті. Запитай тему, цільову аудиторію і мету матеріалу." },
    { label: "Перепиши краще",  prompt: "Перепиши мій текст більш професійно. Вставлю текст після твоєї готовності." },
    { label: "Хуки для тексту", prompt: "Дай 10 сильних хуків для мого контенту. Запитай тему і тип контенту." },
    { label: "CTA варіанти",    prompt: "Напиши 5 варіантів CTA для моєї сторінки. Запитай продукт і дію яку хочу." },
    { label: "Email лист",      prompt: "Напиши email для розсилки. Запитай мету, аудиторію і ключовий меседж." },
  ],
  Support: [
    { label: "FAQ відповідь",   prompt: "Допоможи написати відповідь на FAQ. Запитай питання та контекст продукту." },
    { label: "Відповідь клієнту", prompt: "Напиши відповідь незадоволеному клієнту. Опиши ситуацію і скаргу клієнта." },
    { label: "Інструкція",      prompt: "Напиши покрокову інструкцію. Запитай назву продукту і кроки які треба пояснити." },
    { label: "Скрипт підтримки", prompt: "Напиши скрипт для підтримки. Запитай канал комунікації і типову ситуацію." },
  ],
  Analyst: [
    { label: "Ринковий аналіз", prompt: "Проведи ринковий аналіз. Запитай нішу, регіон і задачу дослідження." },
    { label: "SWOT аналіз",     prompt: "Зроби SWOT аналіз. Запитай назву компанії/продукту і контекст." },
    { label: "Аналіз конкурентів", prompt: "Порівняй конкурентів. Запитай нішу і перелік основних конкурентів." },
    { label: "Звіт",            prompt: "Допоможи скласти аналітичний звіт. Запитай дані які є і мету звіту." },
  ],
  "Media Buyer": [
    { label: "Facebook Ads",    prompt: "Допоможи налаштувати Facebook Ads кампанію. Запитай продукт, ціль і бюджет." },
    { label: "Оптимізація",     prompt: "Допоможи оптимізувати рекламу. Запитай поточні метрики і ціль." },
    { label: "Аудиторії",       prompt: "Знайди аудиторії для реклами. Запитай продукт і платформу." },
    { label: "ROAS аналіз",     prompt: "Порахуй і проаналізуй ROAS. Надай поточні дані по витратах і виручці." },
  ],
  Strategy: [
    { label: "GTM стратегія",   prompt: "Розроби go-to-market стратегію. Запитай продукт, ринок і цільову аудиторію." },
    { label: "Масштабування",   prompt: "Допоможи з стратегією масштабування. Запитай поточні показники і ресурси." },
    { label: "SWOT",            prompt: "Зроби стратегічний SWOT аналіз. Запитай контекст і цілі бізнесу." },
    { label: "Конкурентний аналіз", prompt: "Проведи конкурентний аналіз. Запитай ринок і основних конкурентів." },
  ],
  Product: [
    { label: "User Story",      prompt: "Напиши user story. Запитай роль користувача, дію і бажаний результат." },
    { label: "Roadmap",         prompt: "Допоможи скласти продуктовий roadmap. Запитай стадію продукту і пріоритети." },
    { label: "Пріоритизація",   prompt: "Допоможи пріоритизувати задачі за RICE. Опиши список задач і я допоможу." },
    { label: "Product brief",   prompt: "Напиши product brief для фічі. Запитай назву фічі і її мету." },
  ],
}

const SKILL_REGISTRY_EN: Record<string, Skill[]> = {
  SEO: [
    { label: "SEO audit",       prompt: "Do a detailed SEO audit of my site. Ask me for the URL and I'll give you the details." },
    { label: "Keyword research", prompt: "Help me build a keyword map. Ask about the niche, region, and main products/services." },
    { label: "Content plan",    prompt: "Put together an SEO content plan for next month. Ask about the niche, target audience, and goals." },
    { label: "Article brief",   prompt: "Write a brief for an SEO article. Ask about the topic, keywords, and length." },
    { label: "Competitor analysis", prompt: "Run a search competitor analysis. Ask about the niche and main competitors." },
  ],
  SMM: [
    { label: "Content plan",    prompt: "Put together a social media content plan for the month. Ask about the platform, niche, and brand tone." },
    { label: "Post ideas",      prompt: "Give me 10 post ideas. Ask about the niche, platform, and current audience." },
    { label: "Reels script",    prompt: "Write a script for Reels/TikTok. Ask about the topic, tone, and video length." },
    { label: "Audience analysis", prompt: "Help me describe the target audience persona. Ask about the niche and product." },
    { label: "Post hooks",      prompt: "Give me 10 strong hooks for social posts. Ask about the niche and content type." },
  ],
  Sales: [
    { label: "Sales script",    prompt: "Write a sales script. Ask about the product/service, channel, and target audience." },
    { label: "Objection handling", prompt: "Help me handle objections. Ask for my top 3 client objections." },
    { label: "Follow-up email", prompt: "Write a follow-up message after a meeting. Ask about the context and meeting outcome." },
    { label: "Lead qualification", prompt: "Help me qualify a lead. Ask about the product and client profile." },
    { label: "Client pitch",    prompt: "Write an elevator pitch for a client. Ask about the product, problem, and target audience." },
  ],
  Affiliate: [
    { label: "Offer analysis",  prompt: "Analyze a CPA offer. Ask for the offer name, vertical, terms, and geo." },
    { label: "GEO research",    prompt: "Do GEO research for traffic. Ask about the vertical and budget." },
    { label: "Traffic strategy", prompt: "Develop a traffic strategy. Ask about the vertical, geo, and available traffic sources." },
    { label: "Landing review",  prompt: "Analyze a landing page for affiliate traffic. Provide the URL or a description of the landing page." },
    { label: "Funnel",          prompt: "Help me build an affiliate funnel. Ask about the offer, geo, and traffic source." },
  ],
  Content: [
    { label: "Article outline", prompt: "Put together an article outline. Ask about the topic, target audience, and goal of the piece." },
    { label: "Rewrite better",  prompt: "Rewrite my text more professionally. I'll paste the text once you're ready." },
    { label: "Content hooks",   prompt: "Give me 10 strong hooks for my content. Ask about the topic and content type." },
    { label: "CTA variants",    prompt: "Write 5 CTA variants for my page. Ask about the product and the action I want." },
    { label: "Email copy",      prompt: "Write an email for a newsletter. Ask about the goal, audience, and key message." },
  ],
  Support: [
    { label: "FAQ answer",      prompt: "Help me write an FAQ answer. Ask about the question and product context." },
    { label: "Reply to client", prompt: "Write a reply to an unhappy client. Describe the situation and the client's complaint." },
    { label: "How-to guide",    prompt: "Write a step-by-step guide. Ask about the product name and steps to explain." },
    { label: "Support script",  prompt: "Write a support script. Ask about the communication channel and typical situation." },
  ],
  Analyst: [
    { label: "Market analysis", prompt: "Run a market analysis. Ask about the niche, region, and research goal." },
    { label: "SWOT analysis",   prompt: "Do a SWOT analysis. Ask for the company/product name and context." },
    { label: "Competitor analysis", prompt: "Compare competitors. Ask about the niche and list of main competitors." },
    { label: "Report",          prompt: "Help me put together an analytical report. Ask what data is available and the report's goal." },
  ],
  "Media Buyer": [
    { label: "Facebook Ads",    prompt: "Help me set up a Facebook Ads campaign. Ask about the product, goal, and budget." },
    { label: "Optimization",    prompt: "Help me optimize the ads. Ask about current metrics and the goal." },
    { label: "Audiences",       prompt: "Find audiences for the ads. Ask about the product and platform." },
    { label: "ROAS analysis",   prompt: "Calculate and analyze ROAS. Provide current spend and revenue data." },
  ],
  Strategy: [
    { label: "GTM strategy",    prompt: "Develop a go-to-market strategy. Ask about the product, market, and target audience." },
    { label: "Scaling",         prompt: "Help me with a scaling strategy. Ask about current metrics and resources." },
    { label: "SWOT",            prompt: "Do a strategic SWOT analysis. Ask about the context and business goals." },
    { label: "Competitive analysis", prompt: "Run a competitive analysis. Ask about the market and main competitors." },
  ],
  Product: [
    { label: "User story",      prompt: "Write a user story. Ask about the user role, action, and desired outcome." },
    { label: "Roadmap",         prompt: "Help me put together a product roadmap. Ask about the product stage and priorities." },
    { label: "Prioritization",  prompt: "Help me prioritize tasks using RICE. Describe the task list and I'll help." },
    { label: "Product brief",   prompt: "Write a product brief for a feature. Ask for the feature name and its goal." },
  ],
}

function getSkillRegistry(lang: Language) {
  return lang === "en" ? SKILL_REGISTRY_EN : SKILL_REGISTRY_UK
}

function getGenericSkills(lang: Language): Skill[] {
  if (lang === "en") {
    return [
      { label: "Give me a task",  prompt: "Help me with a task. I'll explain exactly what's needed." },
      { label: "Analysis",        prompt: "Run an analysis. Ask for details and I'll provide the information." },
      { label: "Write text",      prompt: "Write text for me. Ask about the topic, audience, and goal." },
      { label: "Advice",          prompt: "Give me expert advice on my situation. I'll describe the context." },
    ]
  }
  return [
    { label: "Поставити задачу",   prompt: "Допоможи мені з задачею. Я поясню що саме потрібно зробити." },
    { label: "Аналіз",            prompt: "Проведи аналіз. Запитай деталі і я надам інформацію." },
    { label: "Написати текст",    prompt: "Напиши текст для мене. Запитай тему, аудиторію і мету." },
    { label: "Порада",            prompt: "Дай експертну пораду по моїй ситуації. Я опишу контекст." },
  ]
}

function getAgentSkills(agentName: string, systemPrompt: string, lang: Language): Skill[] {
  const name = (agentName ?? "").toLowerCase()
  const prompt = (systemPrompt ?? "").toLowerCase()
  const registry = getSkillRegistry(lang)

  for (const [key, skills] of Object.entries(registry)) {
    if (name.includes(key.toLowerCase()) || prompt.includes(key.toLowerCase())) {
      return skills
    }
  }

  return getGenericSkills(lang)
}

type Agent = {
  id: string
  user_id: string
  name: string
  description: string
  provider_id: string | null
  system_prompt: string
  avatar_color: string
  created_at: string
}

type Provider = {
  id: string
  name: string
  slug: string
  model: string
  is_active: boolean
}

const inp: React.CSSProperties = {
  background: "#09090F",
  border: "0.5px solid rgba(255,255,255,0.10)",
  borderRadius: 9, padding: "9px 12px",
  fontSize: 13, color: T.t1, outline: "none", width: "100%",
}

function focusBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)"
}
function blurBorder(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)"
}

function formatTime(iso: string, t: ReturnType<typeof useLanguage>["t"], lang: Language): string {
  if (!iso) return ""
  const d = Date.now() - new Date(iso).getTime()
  const m = Math.floor(d / 60000)
  if (m < 1)  return t.agentDetail.timeJustNow
  if (m < 60) return `${m} ${t.agentDetail.timeMinAgo}`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h} ${t.agentDetail.timeHourAgo}`
  const dy = Math.floor(h / 24)
  if (dy === 1) return t.agentDetail.timeYesterday
  if (dy < 7)  return `${dy}${t.agentDetail.timeDaysAgo}`
  const dateLocale = lang === "uk" ? "uk-UA" : "en-US"
  return new Date(iso).toLocaleDateString(dateLocale, { day: "numeric", month: "short" })
}

function Card({ title, icon: Icon, children, action, accent }: {
  title: string; icon: React.ElementType; children: React.ReactNode
  action?: React.ReactNode; accent?: boolean
}) {
  return (
    <div style={{
      background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
      border: `0.5px solid ${accent ? "rgba(232,0,42,0.20)" : T.b1}`,
      borderRadius: 14, overflow: "hidden",
    }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "13px 18px 11px", borderBottom: `0.5px solid ${T.b1}`,
        background: accent ? "rgba(232,0,42,0.04)" : "transparent",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Icon size={13} style={{ color: accent ? T.red : T.t4 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em" }}>
            {title}
          </span>
        </div>
        {action}
      </div>
      <div style={{ padding: "18px 18px" }}>{children}</div>
    </div>
  )
}

function Divider() {
  return <div style={{ height: "0.5px", background: "rgba(255,255,255,0.06)", margin: "12px 0" }} />
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 13, color: T.t2 }}>{value || "—"}</div>
    </div>
  )
}

function EditForm({ agent, providers, onSaved, onCancel, t }: {
  agent: Agent; providers: Provider[]; onSaved: () => void; onCancel: () => void
  t: ReturnType<typeof useLanguage>["t"]
}) {
  const [name,         setName]         = useState(agent.name)
  const [description,  setDescription]  = useState(agent.description ?? "")
  const [providerId,   setProviderId]   = useState(agent.provider_id ?? "")
  const [systemPrompt, setSystemPrompt] = useState(agent.system_prompt ?? "")
  const [avatarColor,  setAvatarColor]  = useState(agent.avatar_color ?? AVATAR_COLORS[0])
  const [saved,        setSaved]        = useState(false)
  const [error,        setError]        = useState("")
  const [loading,      setLoading]      = useState(false)

  async function handleSave() {
    if (!name.trim()) { setError(t.agentDetail.nameEmptyError); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { error: dbErr } = await sb.from("agents").update({
      name:          name.trim(),
      description:   description.trim(),
      provider_id:   providerId || null,
      system_prompt: systemPrompt.trim(),
      avatar_color:  avatarColor,
    }).eq("id", agent.id)

    if (dbErr) { setError(dbErr.message); setLoading(false); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); onSaved() }, 1200)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 8 }}>
          {t.agentDetail.avatarColor}
        </label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          {AVATAR_COLORS.map(c => (
            <button key={c} onClick={() => setAvatarColor(c)} style={{
              width: 28, height: 28, borderRadius: 8, background: c, border: "none", cursor: "pointer",
              outline: avatarColor === c ? "2px solid #fff" : "2px solid transparent", outlineOffset: 2,
            }} />
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 9, background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)" }}>
          <div style={{ width: 34, height: 34, borderRadius: 9, background: avatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
            {name ? name.charAt(0).toUpperCase() : "A"}
          </div>
          <span style={{ fontSize: 13, color: T.t2 }}>{name || t.agentDetail.nameField}</span>
        </div>
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{t.agentDetail.nameRequired}</label>
        <input value={name} onChange={e => setName(e.target.value)} style={inp} onFocus={focusBorder} onBlur={blurBorder} />
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{t.agentDetail.description}</label>
        <input value={description} onChange={e => setDescription(e.target.value)} placeholder={t.agentDetail.descPlaceholder} style={inp} onFocus={focusBorder} onBlur={blurBorder} />
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{t.agentDetail.provider}</label>
        {providers.length === 0 ? (
          <div style={{ padding: "9px 12px", borderRadius: 9, fontSize: 12, background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)", color: "#FF4D6A" }}>
            {t.agentDetail.noProviderText} <a href="/providers" style={{ textDecoration: "underline", color: T.red }}>{t.agentDetail.addApiKeyLink}</a>
          </div>
        ) : (
          <select value={providerId} onChange={e => setProviderId(e.target.value)} style={{ ...inp, cursor: "pointer" }} onFocus={focusBorder} onBlur={blurBorder}>
            <option value="">— {t.agentDetail.notSelected} —</option>
            {providers.map(p => (
              <option key={p.id} value={p.id} style={{ background: "#111118" }}>{p.name} — {p.model}</option>
            ))}
          </select>
        )}
      </div>

      <div>
        <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>{t.agentDetail.systemPrompt}</label>
        <textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
          placeholder={t.agentDetail.systemPromptPlaceholder}
          rows={5} style={{ ...inp, resize: "vertical", lineHeight: 1.6 }}
          onFocus={focusBorder} onBlur={blurBorder} />
        <div style={{ fontSize: 11, color: T.t4, marginTop: 5 }}>{t.agentDetail.systemPromptHint}</div>
      </div>

      {error && (
        <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)", display: "flex", alignItems: "center", gap: 7 }}>
          <AlertCircle size={12} /> {error}
        </div>
      )}
      {saved && (
        <div style={{ fontSize: 12, color: T.green, padding: "7px 10px", borderRadius: 7, background: "rgba(34,197,94,0.08)", border: "0.5px solid rgba(34,197,94,0.22)", display: "flex", alignItems: "center", gap: 7 }}>
          <Check size={12} /> {t.agentDetail.changesSaved}
        </div>
      )}

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer", background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
        >{t.common.cancel}</button>
        <button onClick={handleSave} disabled={loading} style={{
          flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500, cursor: loading ? "not-allowed" : "pointer",
          background: loading ? "rgba(232,0,42,0.3)" : T.red, border: "none", color: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}
          onMouseEnter={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
          onMouseLeave={e => { if (!loading) (e.currentTarget as HTMLElement).style.background = T.red }}
        >
          <Save size={13} /> {loading ? t.agentDetail.saving : t.agentDetail.saveChanges}
        </button>
      </div>
    </div>
  )
}

function SessionList({ sessions, onOpen, onDelete, t, lang }: {
  sessions: ChatSession[]; onOpen: (id: string) => void; onDelete: (id: string) => void
  t: ReturnType<typeof useLanguage>["t"]; lang: Language
}) {
  if (sessions.length === 0) {
    return (
      <div style={{ padding: "20px 0", textAlign: "center" }}>
        <MessageSquare size={22} style={{ color: "#252540", margin: "0 auto 8px" }} />
        <div style={{ fontSize: 12, color: T.t4 }}>{t.agentDetail.noSessionsYet}</div>
        <div style={{ fontSize: 11, color: "#2E2E4A", marginTop: 4 }}>{t.agentDetail.noSessionsHint}</div>
      </div>
    )
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {sessions.map(session => {
        const lastMsg = session.messages[session.messages.length - 1]
        const preview = lastMsg
          ? (lastMsg.role === "user" ? t.agentDetail.youPrefix : t.agentDetail.aiPrefix) + lastMsg.content.slice(0, 72)
          : t.agentDetail.emptySession
        const time = lastMsg?.createdAt ?? session.createdAt
        return (
          <div key={session.id}
            onClick={() => onOpen(session.id)}
            style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 9, cursor: "pointer", background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)", transition: "background 130ms ease" }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.05)"
              const del = (e.currentTarget as HTMLElement).querySelector(".del-btn") as HTMLElement
              if (del) del.style.opacity = "1"
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.025)"
              const del = (e.currentTarget as HTMLElement).querySelector(".del-btn") as HTMLElement
              if (del) del.style.opacity = "0"
            }}
          >
            <MessageSquare size={13} style={{ color: T.t4, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: T.t1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</div>
              <div style={{ fontSize: 11, color: T.t4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginTop: 1 }}>{preview}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: T.t4 }}>
                <Clock size={9} />{formatTime(time, t, lang)}
              </div>
              <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", color: T.t4 }}>
                {session.messages.length}
              </span>
              <button className="del-btn"
                onClick={e => { e.stopPropagation(); if (window.confirm(t.agentDetail.deleteSessionConfirm)) onDelete(session.id) }}
                style={{ opacity: 0, padding: 4, borderRadius: 5, border: "none", background: "none", cursor: "pointer", color: T.t4, lineHeight: 0, transition: "opacity 130ms ease" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
              >
                <Trash2 size={12} />
              </button>
              <ChevronRight size={12} style={{ color: T.t4 }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DangerZone({ agentName, onDelete, t }: { agentName: string; onDelete: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  const [confirming, setConfirming] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const isMatch = inputValue.trim() === agentName.trim()

  if (!confirming) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: T.t1, marginBottom: 3 }}>{t.agentDetail.deleteAgentTitle}</div>
          <div style={{ fontSize: 11.5, color: T.t4 }}>{t.agentDetail.deleteAgentHint}</div>
        </div>
        <button onClick={() => setConfirming(true)} style={{
          display: "flex", alignItems: "center", gap: 6, flexShrink: 0,
          padding: "7px 14px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.22)", color: "#FF4D6A",
        }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.16)" }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)" }}
        >
          <Trash2 size={12} /> {t.agentDetail.delete}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ padding: "12px 14px", borderRadius: 9, background: "rgba(232,0,42,0.06)", border: "0.5px solid rgba(232,0,42,0.20)" }}>
        <div style={{ fontSize: 12, color: "#FF4D6A", marginBottom: 8 }}>{t.agentDetail.confirmDeleteHint}</div>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{agentName}</div>
        <input value={inputValue} onChange={e => setInputValue(e.target.value)}
          placeholder={t.agentDetail.confirmDeletePlaceholder} autoFocus
          style={{ ...inp, borderColor: isMatch ? "rgba(34,197,94,0.4)" : "rgba(232,0,42,0.3)" }} />
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={() => { setConfirming(false); setInputValue("") }} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, cursor: "pointer",
          background: "rgba(255,255,255,0.04)", border: `0.5px solid ${T.b1}`, color: T.t2,
        }}>{t.common.cancel}</button>
        <button onClick={onDelete} disabled={!isMatch} style={{
          flex: 1, padding: "8px", borderRadius: 8, fontSize: 12, fontWeight: 500,
          cursor: isMatch ? "pointer" : "not-allowed",
          background: isMatch ? "rgba(232,0,42,0.15)" : "rgba(255,255,255,0.03)",
          border: `0.5px solid ${isMatch ? "rgba(232,0,42,0.30)" : "rgba(255,255,255,0.06)"}`,
          color: isMatch ? "#FF4D6A" : T.t4,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        }}>
          <Trash2 size={12} /> {t.agentDetail.confirmDelete}
        </button>
      </div>
    </div>
  )
}

export default function AgentDetailPage() {
  const params  = useParams()
  const router  = useRouter()
  const agentId = params.agentId as string
  const { t, language } = useLanguage()

  const [agent,        setAgent]        = useState<Agent | null>(null)
  const [provider,     setProvider]     = useState<Provider | undefined>()
  const [allProviders, setAllProviders] = useState<Provider[]>([])
  const [sessions,     setSessions]     = useState<ChatSession[]>([])
  const [isEditing,    setIsEditing]    = useState(false)
  const [notFound,     setNotFound]     = useState(false)
  const [pulse,        setPulse]        = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  const loadData = useCallback(async () => {
    const sb = getSupabase()
    const [{ data: agentData }, { data: providersData }] = await Promise.all([
      sb.from("agents").select("*").eq("id", agentId).single(),
      sb.from("providers").select("id,name,slug,model,is_active"),
    ])

    if (!agentData) { setNotFound(true); return }
    setAgent(agentData as Agent)
    setAllProviders((providersData ?? []) as Provider[])
    if (agentData.provider_id) {
      setProvider((providersData ?? []).find((p: Provider) => p.id === agentData.provider_id))
    }
    setSessions(chatStore.getAll().filter(s => s.agentId === agentId))
  }, [agentId])

  useEffect(() => { loadData() }, [loadData])

  function handleNewChat() {
    if (!agent) return
    const session = chatStore.create(agent.id, `${t.agentDetail.chatWithPrefix}${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  function handleSaved() { setIsEditing(false); loadData() }
  function handleDeleteSession(id: string) { chatStore.remove(id); loadData() }

  async function handleDeleteAgent() {
    if (!agent) return
    const sb = getSupabase()
    await sb.from("agents").delete().eq("id", agent.id)
    router.push("/agents")
  }

  if (notFound) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", padding: 48 }}>
          <div style={{ width: 64, height: 64, borderRadius: 18, margin: "0 auto 20px", background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <AlertCircle size={26} style={{ color: T.red, opacity: 0.7 }} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.agentDetail.agentNotFound}</div>
          <div style={{ fontSize: 13, color: T.t3, marginBottom: 22 }}>{t.agentDetail.agentNotFoundHint}</div>
          <button onClick={() => router.push("/agents")} style={{
            display: "inline-flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 9, fontSize: 13, cursor: "pointer",
            background: "rgba(255,255,255,0.05)", border: `0.5px solid ${T.b1}`, color: T.t2,
          }}>
            <ArrowLeft size={14} /> {t.agentDetail.backToAgents}
          </button>
        </div>
      </div>
    )
  }

  if (!agent) {
    return (
      <div style={{ marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg, padding: "36px 48px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 760 }}>
          {[120, 280, 200].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: T.s1, border: `0.5px solid ${T.b1}` }} />
          ))}
        </div>
      </div>
    )
  }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%{transform:translateX(-100%);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateX(200%);opacity:0}
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{ position: "relative", padding: "32px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, pointerEvents: "none", background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1 }}>
            <button onClick={() => router.push("/agents")} style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 20,
              fontSize: 12, color: T.t4, background: "none", border: "none", cursor: "pointer",
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t2 }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}
            >
              <ArrowLeft size={13} /> {t.agentDetail.allAgents}
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: 16, flexShrink: 0,
                  background: agent.avatar_color ?? T.red,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, fontWeight: 700, color: "#fff",
                  boxShadow: `0 0 20px ${agent.avatar_color ?? T.red}40`,
                }}>
                  {agent.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                    borderRadius: 20, padding: "2px 8px", marginBottom: 6,
                  }}>
                    <span style={{
                      width: 4, height: 4, borderRadius: "50%", background: T.red, display: "inline-block",
                      opacity: pulse ? 1 : 0.3,
                      transition: "opacity 900ms ease, box-shadow 900ms ease",
                      boxShadow: pulse ? "0 0 5px rgba(232,0,42,1)" : "none",
                    }} />
                    <span style={{ fontSize: 9.5, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                      AI Agent · Active
                    </span>
                  </div>
                  <h1 style={{ fontSize: 24, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{agent.name}</h1>
                  {agent.description && (
                    <p style={{ fontSize: 13, color: T.t3, margin: "4px 0 0" }}>{agent.description}</p>
                  )}
                </div>
              </div>
              <button onClick={handleNewChat} style={{
                display: "flex", alignItems: "center", gap: 7,
                background: T.red, color: "#fff", border: "none",
                borderRadius: 9, padding: "9px 18px",
                fontSize: 13, fontWeight: 500, cursor: "pointer",
              }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red }}
              >
                <Plus size={14} /> {t.agentDetail.newChat}
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "24px 48px 56px", maxWidth: 900 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

            {/* Overview */}
            <div style={{
              background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
              border: `0.5px solid ${T.b1}`, borderRadius: 14, padding: "18px 20px",
              display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20,
            }}>
              <InfoRow label={t.agentDetail.provider} value={provider ? provider.name : t.agentDetail.providerNotFound} />
              <InfoRow label={t.agentDetail.modelLabel}    value={provider ? provider.model : "—"} />
              <InfoRow label={t.agentDetail.sessionsLabel}     value={`${sessions.length} ${t.agentDetail.sessionsSuffix}`} />
            </div>

            {/* Settings */}
            <Card title={t.agentDetail.settingsCard} icon={Bot}
              action={
                !isEditing ? (
                  <button onClick={() => setIsEditing(true)} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", opacity: 0.8,
                  }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8" }}
                  >
                    <Edit3 size={11} /> {t.agentDetail.edit}
                  </button>
                ) : undefined
              }
            >
              {isEditing ? (
                <EditForm agent={agent} providers={allProviders} onSaved={handleSaved} onCancel={() => setIsEditing(false)} t={t} />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 20, height: 20, borderRadius: 5, background: agent.avatar_color ?? T.red, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: T.t3 }}>{agent.avatar_color ?? "—"}</span>
                  </div>
                  <Divider />
                  <InfoRow label={t.agentDetail.nameField} value={agent.name} />
                  <Divider />
                  <InfoRow label={t.agentDetail.description} value={agent.description || "—"} />
                  <Divider />
                  <InfoRow label={t.agentDetail.provider} value={provider ? `${provider.name} — ${provider.model}` : t.agentDetail.providerNotFound} />
                  {agent.system_prompt && (
                    <>
                      <Divider />
                      <div>
                        <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>{t.agentDetail.systemPrompt}</div>
                        <div style={{ fontSize: 12, color: T.t2, lineHeight: 1.65, padding: "10px 12px", borderRadius: 9, background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {agent.system_prompt}
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Card>

            {/* ── Agent Workspace ── */}
            <div style={{
              background: "linear-gradient(160deg,#0F0F1E 0%,#0A0A14 100%)",
              border: "0.5px solid rgba(232,0,42,0.18)", borderRadius: 16, overflow: "hidden",
            }}>
              {/* Workspace header */}
              <div style={{
                padding: "14px 18px 12px",
                borderBottom: "0.5px solid rgba(255,255,255,0.07)",
                background: "rgba(232,0,42,0.04)",
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <Zap size={13} style={{ color: T.red }} />
                <span style={{ fontSize: 11, fontWeight: 700, color: T.red, textTransform: "uppercase", letterSpacing: "0.09em" }}>
                  Agent Workspace
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0 }}>

                {/* Skills */}
                <div style={{ padding: "16px 18px", borderRight: "0.5px solid rgba(255,255,255,0.06)", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                    {t.agentDetail.skills}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {getAgentSkills(agent.name, agent.system_prompt, language).map(skill => (
                      <button key={skill.label}
                        onClick={async () => {
                          const sb = getSupabase()
                          const { data: { user } } = await sb.auth.getUser()
                          if (!user) return
                          const { data } = await sb.from("chat_sessions").insert({
                            user_id: user.id, agent_id: agent.id,
                            title: `${skill.label} — ${agent.name}`,
                          }).select().single()
                          if (!data) return
                          await sb.from("chat_messages").insert({
                            user_id: user.id, session_id: data.id, role: "user", content: skill.prompt,
                          })
                          router.push(`/chat/${data.id}`)
                        }}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                          background: "rgba(232,0,42,0.08)", outline: "0.5px solid rgba(232,0,42,0.20)",
                          color: T.t2, fontSize: 12, fontWeight: 500, transition: "all 120ms ease",
                        }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.20)"
                          ;(e.currentTarget as HTMLElement).style.color = T.t1
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)"
                          ;(e.currentTarget as HTMLElement).style.color = T.t2
                        }}
                      >
                        <Zap size={10} style={{ color: T.red, opacity: 0.7 }} />
                        {skill.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tools */}
                <div style={{ padding: "16px 18px", borderBottom: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                    {t.agentDetail.tools}
                  </div>
                  <AgentTools />
                </div>

                {/* Knowledge */}
                <div style={{ padding: "16px 18px", borderRight: "0.5px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                    {t.agentDetail.knowledge}
                  </div>
                  <AgentKnowledge systemPrompt={agent.system_prompt} />
                </div>

                {/* Workflow */}
                <div style={{ padding: "16px 18px" }}>
                  <div style={{ fontSize: 10, fontWeight: 600, color: T.t4, textTransform: "uppercase", letterSpacing: "0.09em", marginBottom: 12 }}>
                    Workflow
                  </div>
                  <AgentWorkflow agentName={agent.name} />
                </div>
              </div>
            </div>

            {/* Sessions */}
            <Card title={`${t.agentDetail.chatSessions} (${sessions.length})`} icon={MessageSquare}
              action={
                <button onClick={handleNewChat} style={{
                  display: "flex", alignItems: "center", gap: 5,
                  fontSize: 11, color: T.red, background: "none", border: "none", cursor: "pointer", opacity: 0.8,
                }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1" }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8" }}
                >
                  <Plus size={11} /> {t.agentDetail.newChat}
                </button>
              }
            >
              <SessionList sessions={sessions} onOpen={id => router.push(`/chat/${id}`)} onDelete={handleDeleteSession} t={t} lang={language} />
            </Card>

            {/* Danger */}
            <Card title={t.agentDetail.dangerZoneCard} icon={Trash2} accent>
              <DangerZone agentName={agent.name} onDelete={handleDeleteAgent} t={t} />
            </Card>

          </div>
        </div>
      </div>
    </>
  )
}