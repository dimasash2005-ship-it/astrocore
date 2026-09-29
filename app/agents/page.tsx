"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Bot, Trash2, MessageSquare,
  Settings, Zap, Activity, Sparkles,
  Search, X,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { chatStore } from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"
import { useLanguage } from "@/lib/useLanguage"
import type { Language } from "@/lib/language"

const T = {
  bg:    "#08080F",
  s1:    "#11111C",
  s2:    "#16162A",
  s3:    "#0E0E18",
  b1:    "rgba(255,255,255,0.10)",
  b2:    "rgba(255,255,255,0.16)",
  bRed:  "rgba(232,0,42,0.30)",
  t1:    "#F0EDF8",
  t2:    "#C8C4D8",
  t3:    "#A8A4BC",
  t4:    "#585878",
  red:   "#E8002A",
  green: "#22C55E",
}

const COLORS = [
  "#E8002A","#10A37F","#D97757",
  "#4285F4","#8B5CF6","#F59E0B",
  "#06B6D4","#EC4899",
]

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

// ─── Agent templates (bilingual) ──────────────────────────────────

type AgentTemplate = {
  name: string
  description: string
  systemPrompt: string
  avatarColor: string
  category: string
  skills: string[]
}

const TEMPLATES_UK: AgentTemplate[] = [
  {
    name: "SEO Agent",
    description: "Технічне SEO, семантика, кластеризація, аналіз конкурентів",
    avatarColor: "#10A37F",
    category: "SEO",
    skills: ["Семантика", "Технічний SEO", "Кластеризація", "Мета-теги"],
    systemPrompt: `Ти — експертний SEO-спеціаліст. Твоя спеціалізація: технічне SEO, семантичне ядро, кластеризація запитів, аналіз конкурентів і оптимізація контенту для пошукових систем.

ПРАВИЛА:
- Відповідай виключно на питання в межах SEO. Якщо питання виходить за межі (наприклад, запит стосується SMM або продажів), чесно скажи: "Це питання краще поставити SMM-агенту / Sales-агенту."
- Задавай уточнюючі питання перед відповіддю: ніша, регіон, платформа (Google / Bing / інші), поточний трафік і цілі.
- Давай конкретні, actionable рекомендації — не загальні поради, а чіткі кроки з поясненням чому.
- Надавай структуровані відповіді: заголовок, ключові пункти, приклади.
- При роботі з семантикою — завжди розбивай за інтентом (інформаційний / комерційний / навігаційний).
- При аналізі конкурентів — давай конкретні метрики для порівняння.
Мова відповідей: українська.`,
  },
  {
    name: "SMM Agent",
    description: "Контент для соцмереж, стратегія, аналітика та зростання аудиторії",
    avatarColor: "#EC4899",
    category: "SMM",
    skills: ["Instagram", "TikTok", "Контент-план", "Сторітелінг"],
    systemPrompt: `Ти — SMM-стратег і контент-менеджер. Твоя спеціалізація: стратегія соціальних мереж, контент-плани, копірайтинг для постів, Reels, Stories, аналіз охоплень і зростання аудиторії.

ПРАВИЛА:
- Відповідай виключно на питання в межах SMM і соціальних мереж. Якщо запит стосується SEO — перенаправ до SEO-агента. Якщо стосується платного трафіку — до Media Buyer Agent.
- Задавай уточнюючі питання: платформа (Instagram / TikTok / LinkedIn / YouTube), ніша, тон бренду, поточна аудиторія.
- Давай конкретні ідеї для контенту з прикладами заголовків, хуків, структури посту.
- При розробці контент-плану — завжди вказуй частоту публікацій, типи контенту і мету кожного типу.
- Не давай загальних порад. Завжди конкретно і з прикладами.
Мова відповідей: українська.`,
  },
  {
    name: "Content Agent",
    description: "Лонгріди, статті, email-розсилки, скрипти і рекламні тексти",
    avatarColor: "#D97757",
    category: "Content",
    skills: ["Копірайтинг", "Статті", "Email", "Скрипти"],
    systemPrompt: `Ти — професійний контент-маркетолог і копірайтер. Твоя спеціалізація: написання статей, лонгрідів, email-розсилок, рекламних текстів, скриптів і продаючих сторінок.

ПРАВИЛА:
- Відповідай виключно на питання в межах контенту і текстів. SEO-оптимізацію залишай SEO-агенту. Візуальний контент — SMM-агенту.
- Перед написанням завжди уточни: тип контенту, цільова аудиторія, тон (формальний / дружній / агресивний), мета матеріалу і ключові меседжі.
- Давай реальний текстовий контент, а не "поради як написати". Якщо просять статтю — пиши статтю.
- Структуруй відповіді: заголовок, підзаголовки, тіло тексту, CTA.
- При email — завжди включай тему листа, прехедер, тіло, CTA.
Мова відповідей: українська.`,
  },
  {
    name: "Sales Agent",
    description: "Скрипти продажів, обробка заперечень, воронки і CRM-стратегія",
    avatarColor: "#E8002A",
    category: "Sales",
    skills: ["Скрипти", "Заперечення", "Воронки", "CRM"],
    systemPrompt: `Ти — досвідчений спеціаліст з продажів. Твоя спеціалізація: скрипти продажів, обробка заперечень, побудова воронок продажів, CRM-стратегія і техніки закриття угод.

ПРАВИЛА:
- Відповідай виключно на питання в межах продажів і роботи з клієнтами. Якщо питання стосується маркетингу або контенту — перенаправ до відповідного агента.
- Задавай уточнюючі питання: продукт/послуга, цільова аудиторія, канал продажів (телефон / email / особисто / месенджери), середній чек.
- Давай конкретні скрипти і фрази, а не теорію. Якщо просять обробити заперечення — давай конкретні відповіді на конкретні заперечення.
- При роботі з воронками — вказуй конкретні етапи, конверсії і точки відпадання.
Мова відповідей: українська.`,
  },
  {
    name: "Affiliate Agent",
    description: "Партнерський маркетинг, офери, арбітраж трафіку і монетизація",
    avatarColor: "#F59E0B",
    category: "Affiliate",
    skills: ["CPA", "Офери", "Арбітраж", "Монетизація"],
    systemPrompt: `Ти — спеціаліст з партнерського маркетингу і арбітражу трафіку. Твоя спеціалізація: вибір CPA-офферів, аналіз партнерських мереж, стратегії монетизації, налаштування воронок для affiliate-маркетингу.

ПРАВИЛА:
- Відповідай виключно на питання в межах affiliate-маркетингу. Якщо питання стосується платного трафіку (FB Ads, Google Ads) — перенаправ до Media Buyer Agent.
- Задавай уточнюючі питання: гео, вертикаль (нутра / фінанси / гемблінг / e-commerce / інше), бюджет, досвід.
- Давай конкретні рекомендації по офферах, мережах і стратегіях — не загальні поради.
- При виборі офферу — вказуй критерії відбору: EPC, CR, умови виплат, дозволені джерела трафіку.
Мова відповідей: українська.`,
  },
  {
    name: "Support Agent",
    description: "Підтримка клієнтів, FAQ, обробка скарг і сценарії відповідей",
    avatarColor: "#06B6D4",
    category: "Support",
    skills: ["FAQ", "Скарги", "Сценарії", "Онбординг"],
    systemPrompt: `Ти — спеціаліст з клієнтської підтримки. Твоя спеціалізація: розробка сценаріїв підтримки, відповіді на FAQ, обробка скарг і конфліктних ситуацій, онбординг нових клієнтів.

ПРАВИЛА:
- Відповідай виключно на питання в межах клієнтського сервісу. Питання про продажі — до Sales Agent. Питання про продукт — до Product Agent.
- Задавай уточнюючі питання: тип бізнесу, канал підтримки (чат / email / телефон), типові запити клієнтів.
- Давай конкретні шаблони відповідей і сценарії, а не загальні поради.
- При обробці скарг — завжди давай алгоритм: визнання проблеми → вибачення → рішення → профілактика.
Мова відповідей: українська.`,
  },
  {
    name: "Analyst Agent",
    description: "Аналіз даних, звіти, метрики, інсайти і бізнес-аналітика",
    avatarColor: "#4285F4",
    category: "Analyst",
    skills: ["KPI", "Дашборди", "Звіти", "Інсайти"],
    systemPrompt: `Ти — бізнес-аналітик і data analyst. Твоя спеціалізація: аналіз даних, побудова звітів, визначення ключових метрик, пошук інсайтів і рекомендацій на основі даних.

ПРАВИЛА:
- Відповідай виключно на питання в межах аналітики і даних. Стратегічні питання — до Strategy Agent. Маркетингові — до відповідних агентів.
- Задавай уточнюючі питання: які дані є, яка мета аналізу, які рішення потрібно прийняти на основі даних.
- Давай структуровані відповіді: метрика → поточне значення → бенчмарк → інсайт → рекомендація.
- Не інтерпретуй дані без вихідних даних. Якщо даних немає — поясни яких саме даних не вистачає.
- Завжди вказуй обмеження аналізу і можливі похибки.
Мова відповідей: українська.`,
  },
  {
    name: "Media Buyer Agent",
    description: "Facebook Ads, Google Ads, TikTok Ads, оптимізація і масштабування",
    avatarColor: "#8B5CF6",
    category: "SMM",
    skills: ["FB Ads", "Google Ads", "TikTok Ads", "ROAS"],
    systemPrompt: `Ти — спеціаліст з платного трафіку і медіа-байінгу. Твоя спеціалізація: налаштування і оптимізація рекламних кампаній в Facebook Ads, Google Ads, TikTok Ads, аналіз ROAS і масштабування успішних кампаній.

ПРАВИЛА:
- Відповідай виключно на питання в межах платного трафіку. Органічний контент — до SMM Agent. Affiliate — до Affiliate Agent.
- Задавай уточнюючі питання: платформа, бюджет, ціль кампанії (ліди / продажі / охоплення), поточні метрики.
- Давай конкретні налаштування і стратегії: аудиторії, плейсменти, типи кампаній, бюджети.
- При оптимізації — давай чіткі рішення: що вимкнути, що масштабувати і чому.
- Завжди орієнтуйся на ROAS, CPA і LTV, а не на поверхневі метрики.
Мова відповідей: українська.`,
  },
  {
    name: "Product Agent",
    description: "Product management, roadmap, user stories і product strategy",
    avatarColor: "#10A37F",
    category: "Analyst",
    skills: ["Roadmap", "User Stories", "Пріоритизація", "Jobs-to-be-done"],
    systemPrompt: `Ти — досвідчений product manager. Твоя спеціалізація: розробка product strategy, roadmap, user stories, пріоритизація задач, product discovery і product-market fit.

ПРАВИЛА:
- Відповідай виключно на питання в межах product management. Технічні питання — до розробників. Аналітика — до Analyst Agent.
- Задавай уточнюючі питання: стадія продукту, цільова аудиторія, ключові метрики і поточні болі.
- Давай структуровані відповіді у форматі: проблема → рішення → метрики успіху → ризики.
- При пріоритизації — завжди використовуй фреймворки (RICE, ICE, MoSCoW) і пояснюй логіку.
- User stories завжди у форматі: "Як [роль], я хочу [дія], щоб [результат]".
Мова відповідей: українська.`,
  },
  {
    name: "Strategy Agent",
    description: "Бізнес-стратегія, ринковий аналіз, масштабування і конкурентні переваги",
    avatarColor: "#D97757",
    category: "Analyst",
    skills: ["SWOT", "GTM", "Масштабування", "Конкуренти"],
    systemPrompt: `Ти — стратегічний консультант і бізнес-аналітик. Твоя спеціалізація: розробка бізнес-стратегій, аналіз ринку, конкурентний аналіз, go-to-market стратегії і стратегії масштабування.

ПРАВИЛА:
- Відповідай виключно на питання в межах стратегії і бізнес-планування. Операційні питання — до відповідних спеціалістів.
- Задавай уточнюючі питання: стадія бізнесу, ринок, поточні метрики, основні виклики і цілі.
- Давай структуровані стратегічні рекомендації: ситуація → аналіз → варіанти → рекомендація → наступні кроки.
- Використовуй фреймворки (SWOT, Porter's Five Forces, BCG Matrix) і пояснюй як їх застосувати до конкретної ситуації.
- Будь конкретним — не давай загальних порад типу "потрібно покращити маркетинг".
Мова відповідей: українська.`,
  },
]

const TEMPLATES_EN: AgentTemplate[] = [
  {
    name: "SEO Agent",
    description: "Technical SEO, keyword research, clustering, competitor analysis",
    avatarColor: "#10A37F",
    category: "SEO",
    skills: ["Keywords", "Technical SEO", "Clustering", "Meta tags"],
    systemPrompt: `You are an expert SEO specialist. Your focus: technical SEO, keyword research, query clustering, competitor analysis, and content optimization for search engines.

RULES:
- Answer only questions within SEO. If a request falls outside that scope (e.g. it's about SMM or sales), say plainly: "That's better suited for the SMM agent / Sales agent."
- Ask clarifying questions before answering: niche, region, platform (Google / Bing / other), current traffic, and goals.
- Give specific, actionable recommendations — not general advice, but clear steps with reasoning.
- Provide structured answers: heading, key points, examples.
- When working with keywords, always break them down by intent (informational / commercial / navigational).
- When analyzing competitors, give concrete metrics for comparison.
Response language: English.`,
  },
  {
    name: "SMM Agent",
    description: "Social media content, strategy, analytics, and audience growth",
    avatarColor: "#EC4899",
    category: "SMM",
    skills: ["Instagram", "TikTok", "Content plan", "Storytelling"],
    systemPrompt: `You are an SMM strategist and content manager. Your focus: social media strategy, content plans, copywriting for posts, Reels, Stories, reach analysis, and audience growth.

RULES:
- Answer only questions within SMM and social media. Route SEO requests to the SEO agent. Route paid traffic requests to the Media Buyer Agent.
- Ask clarifying questions: platform (Instagram / TikTok / LinkedIn / YouTube), niche, brand tone, current audience.
- Give concrete content ideas with example headlines, hooks, and post structure.
- When building a content plan, always specify posting frequency, content types, and the goal of each type.
- Don't give generic advice. Always be concrete and give examples.
Response language: English.`,
  },
  {
    name: "Content Agent",
    description: "Long-form articles, email newsletters, scripts, and ad copy",
    avatarColor: "#D97757",
    category: "Content",
    skills: ["Copywriting", "Articles", "Email", "Scripts"],
    systemPrompt: `You are a professional content marketer and copywriter. Your focus: writing articles, long-form pieces, email newsletters, ad copy, scripts, and sales pages.

RULES:
- Answer only questions within content and copywriting. Leave SEO optimization to the SEO agent. Leave visual content to the SMM agent.
- Before writing, always clarify: content type, target audience, tone (formal / friendly / bold), goal of the piece, and key messages.
- Deliver actual written content, not "tips on how to write it." If asked for an article, write the article.
- Structure answers: headline, subheadings, body copy, CTA.
- For email, always include subject line, preheader, body, and CTA.
Response language: English.`,
  },
  {
    name: "Sales Agent",
    description: "Sales scripts, objection handling, funnels, and CRM strategy",
    avatarColor: "#E8002A",
    category: "Sales",
    skills: ["Scripts", "Objections", "Funnels", "CRM"],
    systemPrompt: `You are an experienced sales specialist. Your focus: sales scripts, objection handling, sales funnel design, CRM strategy, and deal-closing techniques.

RULES:
- Answer only questions within sales and client work. Route marketing or content questions to the appropriate agent.
- Ask clarifying questions: product/service, target audience, sales channel (phone / email / in-person / messengers), average deal size.
- Give concrete scripts and phrases, not theory. If asked to handle objections, give concrete responses to concrete objections.
- When working with funnels, specify concrete stages, conversion rates, and drop-off points.
Response language: English.`,
  },
  {
    name: "Affiliate Agent",
    description: "Affiliate marketing, offers, traffic arbitrage, and monetization",
    avatarColor: "#F59E0B",
    category: "Affiliate",
    skills: ["CPA", "Offers", "Arbitrage", "Monetization"],
    systemPrompt: `You are an affiliate marketing and traffic arbitrage specialist. Your focus: choosing CPA offers, analyzing affiliate networks, monetization strategies, and setting up affiliate funnels.

RULES:
- Answer only questions within affiliate marketing. Route paid-traffic questions (FB Ads, Google Ads) to the Media Buyer Agent.
- Ask clarifying questions: geo, vertical (nutra / finance / gambling / e-commerce / other), budget, experience.
- Give concrete recommendations on offers, networks, and strategies — not generic advice.
- When choosing an offer, specify selection criteria: EPC, CR, payout terms, allowed traffic sources.
Response language: English.`,
  },
  {
    name: "Support Agent",
    description: "Customer support, FAQs, complaint handling, and response scripts",
    avatarColor: "#06B6D4",
    category: "Support",
    skills: ["FAQ", "Complaints", "Scripts", "Onboarding"],
    systemPrompt: `You are a customer support specialist. Your focus: designing support scripts, FAQ answers, handling complaints and conflicts, and onboarding new customers.

RULES:
- Answer only questions within customer service. Route sales questions to the Sales Agent. Route product questions to the Product Agent.
- Ask clarifying questions: business type, support channel (chat / email / phone), typical client requests.
- Give concrete response templates and scripts, not generic advice.
- When handling complaints, always give the algorithm: acknowledge the problem → apologize → solve → prevent recurrence.
Response language: English.`,
  },
  {
    name: "Analyst Agent",
    description: "Data analysis, reports, metrics, insights, and business analytics",
    avatarColor: "#4285F4",
    category: "Analyst",
    skills: ["KPIs", "Dashboards", "Reports", "Insights"],
    systemPrompt: `You are a business analyst and data analyst. Your focus: data analysis, building reports, identifying key metrics, and finding insights and recommendations from data.

RULES:
- Answer only questions within analytics and data. Route strategic questions to the Strategy Agent. Route marketing questions to the appropriate agents.
- Ask clarifying questions: what data is available, what the goal of the analysis is, what decisions need to be made from the data.
- Give structured answers: metric → current value → benchmark → insight → recommendation.
- Don't interpret data without source data. If none is available, explain exactly what data is missing.
- Always state the limitations of the analysis and possible margins of error.
Response language: English.`,
  },
  {
    name: "Media Buyer Agent",
    description: "Facebook Ads, Google Ads, TikTok Ads, optimization, and scaling",
    avatarColor: "#8B5CF6",
    category: "SMM",
    skills: ["FB Ads", "Google Ads", "TikTok Ads", "ROAS"],
    systemPrompt: `You are a paid traffic and media buying specialist. Your focus: setting up and optimizing ad campaigns on Facebook Ads, Google Ads, TikTok Ads, ROAS analysis, and scaling successful campaigns.

RULES:
- Answer only questions within paid traffic. Route organic content to the SMM Agent. Route affiliate questions to the Affiliate Agent.
- Ask clarifying questions: platform, budget, campaign goal (leads / sales / reach), current metrics.
- Give concrete settings and strategies: audiences, placements, campaign types, budgets.
- When optimizing, give clear decisions: what to turn off, what to scale, and why.
- Always focus on ROAS, CPA, and LTV rather than surface-level metrics.
Response language: English.`,
  },
  {
    name: "Product Agent",
    description: "Product management, roadmaps, user stories, and product strategy",
    avatarColor: "#10A37F",
    category: "Analyst",
    skills: ["Roadmap", "User stories", "Prioritization", "Jobs-to-be-done"],
    systemPrompt: `You are an experienced product manager. Your focus: product strategy, roadmaps, user stories, task prioritization, product discovery, and product-market fit.

RULES:
- Answer only questions within product management. Route technical questions to developers. Route analytics to the Analyst Agent.
- Ask clarifying questions: product stage, target audience, key metrics, and current pain points.
- Give structured answers in the format: problem → solution → success metrics → risks.
- When prioritizing, always use frameworks (RICE, ICE, MoSCoW) and explain the reasoning.
- User stories always follow the format: "As a [role], I want [action], so that [outcome]."
Response language: English.`,
  },
  {
    name: "Strategy Agent",
    description: "Business strategy, market analysis, scaling, and competitive advantage",
    avatarColor: "#D97757",
    category: "Analyst",
    skills: ["SWOT", "GTM", "Scaling", "Competitors"],
    systemPrompt: `You are a strategy consultant and business analyst. Your focus: developing business strategies, market analysis, competitive analysis, go-to-market strategies, and scaling strategies.

RULES:
- Answer only questions within strategy and business planning. Route operational questions to the appropriate specialists.
- Ask clarifying questions: business stage, market, current metrics, main challenges, and goals.
- Give structured strategic recommendations: situation → analysis → options → recommendation → next steps.
- Use frameworks (SWOT, Porter's Five Forces, BCG Matrix) and explain how to apply them to the specific situation.
- Be concrete — don't give generic advice like "you need to improve marketing."
Response language: English.`,
  },
]

function getTemplates(lang: Language) {
  return lang === "en" ? TEMPLATES_EN : TEMPLATES_UK
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.75)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
      {children}
    </div>
  )
}

function CreateAgentModal({ providers, onClose, onCreated, t, language }: {
  providers: Provider[]
  onClose: () => void
  onCreated: (id: string) => void
  t: ReturnType<typeof useLanguage>["t"]
  language: Language
}) {
  const [name,             setName]           = useState("")
  const [desc,             setDesc]           = useState("")
  const [providerId,       setProvider]       = useState(providers[0]?.id ?? "")
  const [prompt,           setPrompt]         = useState("")
  const [color,            setColor]          = useState(COLORS[0])
  const [error,            setError]          = useState("")
  const [loading,          setLoading]        = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [showTemplates,    setShowTemplates]  = useState(true)
  const [activeCategory,   setActiveCategory] = useState(t.agents.categoryAll)

  const TEMPLATES = getTemplates(language)
  const TABS = [t.agents.categoryAll, "Affiliate", "SEO", "SMM", "Sales", "Content", "Support", "Analyst"]

  const visibleTemplates = activeCategory === t.agents.categoryAll
    ? TEMPLATES
    : TEMPLATES.filter(tpl => tpl.category === activeCategory)

  const inp: React.CSSProperties = {
    background: "#09090F", border: "0.5px solid rgba(255,255,255,0.10)",
    borderRadius: 9, padding: "9px 12px", fontSize: 13,
    color: T.t1, outline: "none", width: "100%",
  }

  function applyTemplate(tpl: AgentTemplate) {
    setName(tpl.name)
    setDesc(tpl.description)
    setPrompt(tpl.systemPrompt)
    setColor(tpl.avatarColor)
    setSelectedTemplate(tpl.name)
    setShowTemplates(false)
  }

  async function handleCreate() {
    if (!name.trim()) { setError(t.agents.nameEmptyError); return }
    if (!providerId)  { setError(t.agents.providerEmptyError); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError(t.agents.unauthorizedError); setLoading(false); return }

    const { data, error: dbErr } = await sb.from("agents").insert({
      user_id:       user.id,
      name:          name.trim(),
      description:   desc.trim(),
      provider_id:   providerId || null,
      system_prompt: prompt.trim(),
      avatar_color:  color,
    }).select().single()

    if (dbErr || !data) { setError(dbErr?.message ?? t.agents.genericError); setLoading(false); return }
    onCreated(data.id)
    onClose()
  }

  return (
    <Modal onClose={onClose}>
      <div style={{
        width: "100%", maxWidth: showTemplates ? 680 : 460, borderRadius: 16,
        background: "linear-gradient(160deg,#111120 0%,#0C0C18 100%)",
        border: "1px solid rgba(232,0,42,0.22)",
        boxShadow: "0 32px 80px rgba(0,0,0,0.8)",
        padding: "24px 24px 20px",
        maxHeight: "90vh", overflowY: "auto",
        transition: "max-width 200ms ease",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "rgba(232,0,42,0.12)", border: "0.5px solid rgba(232,0,42,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Bot size={16} style={{ color: T.red }} />
          </div>
          <div>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 600, color: T.t1 }}>{t.agents.newAgentModalTitle}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9.5, color: T.t3, textTransform: "uppercase", letterSpacing: "0.06em" }}>AI Agent Layer</div>
          </div>
          {!showTemplates && (
            <button onClick={() => setShowTemplates(true)} style={{
              marginLeft: "auto", fontSize: 11.5, color: T.red, background: "none", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, opacity: 0.8,
            }}>
              <Sparkles size={11} /> {t.agents.templatesLabel}
            </button>
          )}
        </div>

        {/* Templates section */}
        {showTemplates && (
          <div style={{ marginBottom: 18 }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={13} style={{ color: T.red, opacity: 0.8 }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  {t.agents.agentTemplatesLabel}
                </span>
              </div>
              <button onClick={() => setShowTemplates(false)} style={{
                fontSize: 11, color: T.t4, background: "none", border: "none", cursor: "pointer",
              }}>
                {t.agents.skip}
              </button>
            </div>

            {/* Category tabs */}
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {TABS.map(tab => (
                <button key={tab} onClick={() => setActiveCategory(tab)} style={{
                  fontSize: 11, padding: "4px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                  background: activeCategory === tab ? T.red : "rgba(255,255,255,0.05)",
                  color: activeCategory === tab ? "#fff" : T.t3,
                  fontWeight: activeCategory === tab ? 500 : 400,
                  transition: "all 120ms ease",
                }}>
                  {tab}
                </button>
              ))}
            </div>

            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              gap: 8, maxHeight: 200, overflowY: "auto",
            }}>
              {visibleTemplates.map(tpl => {
                const isSelected = selectedTemplate === tpl.name
                return (
                  <button key={tpl.name} onClick={() => applyTemplate(tpl)} style={{
                    display: "flex", flexDirection: "column", gap: 8,
                    padding: "11px 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left",
                    background: isSelected
                      ? `${tpl.avatarColor}14`
                      : "rgba(255,255,255,0.03)",
                    outline: isSelected
                      ? `1px solid ${tpl.avatarColor}55`
                      : "1px solid rgba(255,255,255,0.07)",
                    boxShadow: isSelected ? `0 0 14px ${tpl.avatarColor}18` : "none",
                    transition: "all 130ms ease",
                  }}
                    onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)" }}
                    onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.03)" }}
                  >
                    {/* Avatar + name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background: tpl.avatarColor,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, fontWeight: 700, color: "#fff",
                      }}>
                        {tpl.name.charAt(0)}
                      </div>
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: isSelected ? T.t1 : T.t2 }}>{tpl.name}</div>
                        <div style={{ fontSize: 9.5, color: T.t4, marginTop: 1 }}>{tpl.category}</div>
                      </div>
                    </div>

                    {/* Description */}
                    <div style={{ fontSize: 11, color: T.t4, lineHeight: 1.45 }}>
                      {tpl.description}
                    </div>

                    {/* Skills */}
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {tpl.skills.slice(0, 3).map(s => (
                        <span key={s} style={{
                          fontSize: 9.5, padding: "2px 6px", borderRadius: 4,
                          background: isSelected ? `${tpl.avatarColor}18` : "rgba(255,255,255,0.05)",
                          color: isSelected ? tpl.avatarColor : T.t4,
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </button>
                )
              })}
            </div>

            {selectedTemplate && (
              <div style={{
                marginTop: 10, padding: "7px 12px", borderRadius: 8,
                background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.20)",
                fontSize: 11.5, color: "#FF6B80",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <Sparkles size={11} />
                {t.agents.templateAppliedPrefix}{selectedTemplate}{t.agents.templateAppliedSuffix}
              </div>
            )}

            <div style={{ height: "0.5px", background: "rgba(255,255,255,0.07)", margin: "16px 0 0" }} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Color + preview */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              {t.agentDetail.avatarColor}
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 26, height: 26, borderRadius: 7, background: c, border: "none", cursor: "pointer",
                  outline: color === c ? "2px solid #fff" : "2px solid transparent",
                  outlineOffset: 2,
                }} />
              ))}
            </div>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "8px 12px", borderRadius: 9,
              background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: 9, background: color,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 14, fontWeight: 700, color: "#fff", flexShrink: 0,
              }}>
                {name ? name.charAt(0).toUpperCase() : "A"}
              </div>
              <span style={{ fontSize: 13, color: T.t2 }}>{name || t.agents.nameField}</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              {t.agents.nameRequired}
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder={t.agents.namePlaceholder}
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              {t.agents.description}
            </label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder={t.agents.descPlaceholder}
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              {t.agents.providerRequired}
            </label>
            {providers.length === 0 ? (
              <div style={{
                padding: "9px 12px", borderRadius: 9, fontSize: 12,
                background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)",
                color: "#FF4D6A",
              }}>
                {t.agents.providerFirstAddKeyPrefix}{" "}
                <a href="/providers" style={{ textDecoration: "underline", color: T.red }}>{t.agents.providersLinkLabel}</a>
              </div>
            ) : (
              <select value={providerId} onChange={e => setProvider(e.target.value)}
                style={{ ...inp, cursor: "pointer" }}>
                {providers.map(p => (
                  <option key={p.id} value={p.id} style={{ background: "#111118" }}>
                    {p.name} — {p.model}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              {t.agents.systemPrompt}
            </label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder={t.agents.systemPromptPlaceholder}
              rows={5}
              style={{ ...inp, resize: "vertical", lineHeight: 1.55 }}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: "#FF4D6A", padding: "7px 10px", borderRadius: 7, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.2)" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, paddingTop: 4 }}>
            <button onClick={onClose} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, cursor: "pointer",
              background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.10)",
              color: T.t2,
            }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.08)" }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}
            >{t.agents.cancel}</button>
            <button onClick={handleCreate} disabled={providers.length === 0 || loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              cursor: providers.length === 0 || loading ? "not-allowed" : "pointer",
              background: providers.length === 0 || loading ? "rgba(232,0,42,0.3)" : T.red,
              border: "none", color: "#fff",
            }}
              onMouseEnter={e => { if (providers.length > 0 && !loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (providers.length > 0 && !loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >{loading ? t.agents.creating : t.agents.create}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Agent card (compact, same style as Memory / Vault) ───────────

function AgentCard({ agent, provider, sessionCount, onChat, onOpen, onDelete, t, index }: {
  agent: Agent; provider?: Provider; sessionCount: number
  onChat: (e: React.MouseEvent) => void
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
  t: ReturnType<typeof useLanguage>["t"]
  index: number
}) {
  const color = agent.avatar_color ?? T.red
  return (
    <div
      role="button" tabIndex={0}
      onClick={onOpen}
      onKeyDown={e => { if (e.key === "Enter") onOpen() }}
      className="mem-card"
      style={{ animationDelay: `${Math.min(index, 12) * 40}ms`, ["--ac" as string]: color } as React.CSSProperties}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 11 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: color, display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Space Grotesk', sans-serif", fontSize: 15, fontWeight: 700, color: "#fff",
          boxShadow: `0 0 14px ${color}40`,
        }}>
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="mem-title" style={{ WebkitLineClamp: 1 }}>{agent.name}</div>
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.t4, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {provider ? provider.model : ""}
          </div>
        </div>
        <div className="ag-actions">
          <button title="Settings" onClick={e => { e.stopPropagation(); onOpen() }} className="ag-icon"><Settings size={13} /></button>
          <button title="Delete" onClick={onDelete} className="ag-icon ag-icon-del"><Trash2 size={13} /></button>
        </div>
      </div>

      <div className="mem-preview">
        {agent.description || agent.system_prompt || "—"}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", paddingTop: 14, flexWrap: "wrap" }}>
        {provider
          ? <span className="mem-chip">{provider.name}</span>
          : <span className="mem-chip mem-chip-red">{t.agents.providerNotFound}</span>}
        {sessionCount > 0 && (
          <span className="mem-chip"><MessageSquare size={9} /> {sessionCount} {t.agents.sessionsSuffix}</span>
        )}
        <button onClick={onChat} className="ag-chat">
          <MessageSquare size={12} /> {t.agents.startChat}
        </button>
      </div>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────

function EmptyState({ onAdd, t }: { onAdd: () => void; t: ReturnType<typeof useLanguage>["t"] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "80px 24px", textAlign: "center", width: "100%" }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 32px rgba(232,0,42,0.07)",
      }}>
        <Bot size={30} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>{t.agents.noAgentsYet}</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.65, maxWidth: 360, marginBottom: 28 }}>{t.agents.noAgentsHint}</div>
      <button onClick={onAdd} className="mem-primary"><Plus size={14} /> {t.agents.createAgent}</button>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────

export default function AgentsPage() {
  const router = useRouter()
  const { t, language } = useLanguage()
  const uk = language === "uk"
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [sessions,  setSessions]  = useState<{ agentId: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loaded,    setLoaded]    = useState(false)
  const [search,    setSearch]    = useState("")

  async function refresh() {
    const sb = getSupabase()
    const [{ data: agentsData }, { data: providersData }] = await Promise.all([
      sb.from("agents").select("*").order("created_at", { ascending: true }),
      sb.from("providers").select("id,name,slug,model,is_active"),
    ])
    if (agentsData)    setAgents(agentsData as Agent[])
    if (providersData) setProviders(providersData as Provider[])
    setSessions(chatStore.getAll().map(s => ({ agentId: s.agentId })))
    setLoaded(true)
  }

  useEffect(() => { refresh() }, [])

  function handleChat(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation()
    const session = chatStore.create(agent.id, `${t.agents.chatWithPrefix}${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const agent = agents.find(a => a.id === id)
    if (!agent) return
    if (window.confirm(`${t.agents.deleteConfirmPrefix}${agent.name}${t.agents.deleteConfirmSuffix}`)) {
      await getSupabase().from("agents").delete().eq("id", id)
      refresh()
    }
  }

  function handleCreated(agentId: string) {
    refresh()
    router.push(`/agents/${agentId}`)
  }

  function getProvider(id: string | null) { return providers.find(p => p.id === id) }
  function getSessionCount(id: string) { return sessions.filter(s => s.agentId === id).length }

  const filtered = useMemo(() => {
    if (!search) return agents
    const q = search.toLowerCase()
    return agents.filter(a =>
      a.name.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q) ||
      (a.system_prompt ?? "").toLowerCase().includes(q))
  }, [agents, search])

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
        @keyframes scanline { 0% { transform: translateX(-100%); opacity: 0; } 10% { opacity: 1; } 90% { opacity: 1; } 100% { transform: translateX(200%); opacity: 0; } }
        .astrocore-hero-sweep { animation: astrocoreHeroSweep 3s linear infinite; }
        @keyframes astrocoreHeroSweep { 0% { left: -20%; } 100% { left: 100%; } }
        .astrocore-badge-sweep { animation: astrocoreBadgeSweep 1.6s linear infinite; }
        @keyframes astrocoreBadgeSweep { 0% { left: -40%; } 100% { left: 100%; } }
        @keyframes memIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }

        .mem-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 14px; }
        .mem-card {
          position: relative; display: flex; flex-direction: column; text-align: left; cursor: pointer;
          min-height: 172px; padding: 16px 16px 14px; border-radius: 14px; font-family: inherit;
          background: linear-gradient(160deg,#11111C 0%,#0E0E18 100%); border: 0.5px solid ${T.b1};
          color: ${T.t2}; overflow: hidden; animation: memIn .45s cubic-bezier(.2,.8,.2,1) both;
          transition: transform .2s cubic-bezier(.3,1.4,.5,1), border-color .2s, box-shadow .2s, background .2s;
        }
        .mem-card::before { content: ""; position: absolute; left: 0; top: 14px; bottom: 14px; width: 2px;
          background: linear-gradient(180deg, transparent, var(--ac, ${T.red}), transparent); opacity: .6; transition: opacity .2s; }
        .mem-card:hover { transform: translateY(-3px); border-color: rgba(232,0,42,.35);
          background: linear-gradient(160deg,#15142A 0%,#0F0F1E 100%); box-shadow: 0 14px 34px rgba(0,0,0,.45), 0 0 0 1px rgba(232,0,42,.08); }
        .mem-card:hover::before { opacity: 1; }
        .mem-card:focus-visible { outline: 2px solid ${T.red}; outline-offset: 2px; }
        .mem-title { font-family: 'Space Grotesk', sans-serif; font-size: 14.5px; font-weight: 600; color: ${T.t1};
          line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .mem-arrow { flex-shrink: 0; color: ${T.t4}; opacity: 0; transform: translate(-4px, 4px); transition: all .2s; }
        .mem-card:hover .mem-arrow { opacity: 1; transform: none; color: ${T.red}; }
        .mem-preview { margin-top: 12px; font-size: 12.5px; line-height: 1.6; color: ${T.t3};
          display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .mem-chip { display: inline-flex; align-items: center; gap: 4px; font-family: 'JetBrains Mono', monospace; font-size: 9px;
          padding: 2px 7px; border-radius: 5px; text-transform: uppercase; letter-spacing: .06em;
          color: ${T.t3}; background: rgba(255,255,255,.04); border: 0.5px solid ${T.b1}; }
        .mem-chip-red { color: #FF4D6A; background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.18); }

        .ag-actions { display: flex; gap: 4px; opacity: 0; transition: opacity .15s; }
        .mem-card:hover .ag-actions, .mem-card:focus-within .ag-actions { opacity: 1; }
        .ag-icon { padding: 5px; border-radius: 7px; background: rgba(255,255,255,.06); border: none; cursor: pointer; color: ${T.t3}; line-height: 0; transition: color .12s, background .12s; }
        .ag-icon:hover { color: ${T.t1}; background: rgba(255,255,255,.1); }
        .ag-icon-del:hover { color: #FF4D6A; background: rgba(232,0,42,.12); }
        .ag-chat { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 11px;
          border-radius: 8px; font-size: 11.5px; font-weight: 500; font-family: inherit; cursor: pointer;
          background: rgba(255,255,255,.04); border: 0.5px solid rgba(255,255,255,.09); color: ${T.t2};
          transition: background .15s, color .15s, border-color .15s; }
        .ag-chat:hover { background: ${T.red}; border-color: ${T.red}; color: #fff; box-shadow: 0 0 16px rgba(232,0,42,.35); }

        .mem-new { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; min-height: 172px;
          border-radius: 14px; border: 1px dashed rgba(232,0,42,.3); background: rgba(232,0,42,.03); color: ${T.t3};
          cursor: pointer; font-family: inherit; font-size: 13px; transition: background .2s, border-color .2s, color .2s; }
        .mem-new:hover { background: rgba(232,0,42,.08); border-color: rgba(232,0,42,.55); color: ${T.t1}; }
        .mem-new span { width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: rgba(232,0,42,.12); color: ${T.red}; }

        .mem-primary { display: flex; align-items: center; gap: 7px; background: ${T.red}; color: #fff; border: none; border-radius: 10px;
          padding: 9px 18px; font-size: 13px; font-weight: 500; cursor: pointer; transition: background .13s, box-shadow .13s, transform .13s; }
        .mem-primary:hover { background: #FF1A3E; box-shadow: 0 0 20px rgba(232,0,42,.35); transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { .mem-card { animation: none; } }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W, minHeight: "100vh", background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)", backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{ position: "fixed", top: 0, left: SIDEBAR_W, right: 0, height: 1, background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)", animation: "scanline 6s linear infinite", pointerEvents: "none", zIndex: 10 }} />

        {/* ── Hero ── */}
        <div style={{ position: "relative", padding: "36px 48px 28px", borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden" }}>
          <div aria-hidden style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1.5, background: "rgba(255,255,255,0.06)", overflow: "hidden", pointerEvents: "none" }}>
            <div className="astrocore-hero-sweep" style={{ position: "absolute", top: 0, left: "-20%", width: "20%", height: "100%", background: "linear-gradient(90deg, transparent, #E8002A, transparent)", boxShadow: "0 0 10px rgba(232,0,42,0.85)" }} />
          </div>
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 320, pointerEvents: "none", background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.07) 0%,transparent 70%)" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(232,0,42,0.09)", border: `0.5px solid ${T.bRed}`, borderRadius: 20, padding: "4px 12px", marginBottom: 14 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.06em" }}>Agent Control</span>
              </div>
              <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em" }}>{t.agents.title}</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>{t.agents.subtitle}</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {loaded && providers.length === 0 && (
                <button onClick={() => router.push("/providers")} style={{
                  display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                  padding: "7px 12px", borderRadius: 9, fontSize: 12,
                  background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)", color: "#FF4D6A",
                }}>
                  <Zap size={12} /> {t.agents.addApiKeyLink}
                </button>
              )}
              <button onClick={() => setShowModal(true)} className="mem-primary"><Plus size={14} /> {t.agents.newAgentBtn}</button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        {loaded && agents.length === 0 ? (
          <EmptyState onAdd={() => setShowModal(true)} t={t} />
        ) : (
          <div style={{ padding: "24px 48px 56px" }}>
            {/* stats + search in one row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
              {[
                { label: t.agents.totalAgents,    value: agents.length,    icon: Bot           },
                { label: t.agents.activeSessions, value: sessions.length,  icon: MessageSquare },
                { label: t.agents.providers,      value: providers.length, icon: Activity      },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 14px", borderRadius: 9, background: T.s1, border: `0.5px solid ${T.b1}` }}>
                  <Icon size={13} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 600, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}

              <div style={{ flex: "1 1 260px", display: "flex", alignItems: "center", gap: 10, background: T.s1, border: `0.5px solid ${T.b1}`, borderRadius: 10, padding: "0 14px", height: 38 }}>
                <Search size={14} style={{ color: T.t4, flexShrink: 0 }} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={uk ? "Пошук агентів…" : "Search agents…"}
                  style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 13, color: T.t1 }} />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0 }}><X size={13} /></button>
                )}
              </div>
            </div>

            {search && (
              <div style={{ fontSize: 12, color: T.t4, marginBottom: 14 }}>
                {uk ? `Знайдено ${filtered.length} з ${agents.length}` : `Found ${filtered.length} of ${agents.length}`}
              </div>
            )}

            {filtered.length === 0 && search ? (
              <div style={{ padding: "48px 0", textAlign: "center", fontSize: 13, color: T.t4 }}>{uk ? "Нічого не знайдено" : "Nothing found"}</div>
            ) : (
              <div className="mem-grid">
                {!search && (
                  <button className="mem-new" onClick={() => setShowModal(true)}>
                    <span><Plus size={17} /></span>
                    {t.agents.addAgentTile}
                  </button>
                )}
                {filtered.map((agent, i) => (
                  <AgentCard
                    key={agent.id}
                    index={i}
                    agent={agent}
                    provider={getProvider(agent.provider_id)}
                    sessionCount={getSessionCount(agent.id)}
                    onChat={e => handleChat(e, agent)}
                    onOpen={() => router.push(`/agents/${agent.id}`)}
                    onDelete={e => handleDelete(e, agent.id)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {showModal && (
        <CreateAgentModal
          providers={providers}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
          t={t}
          language={language}
        />
      )}
    </>
  )
}