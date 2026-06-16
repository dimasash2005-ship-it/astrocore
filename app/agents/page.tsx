"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import {
  Plus, Bot, Trash2, MessageSquare,
  Settings, Zap, Activity, Sparkles,
} from "lucide-react"
import { getSupabase } from "@/lib/supabase/client"
import { chatStore } from "@/lib/store"
import { SIDEBAR_W } from "@/components/layout/Sidebar"

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

// ─── Agent templates ──────────────────────────────────────────────

type AgentTemplate = {
  name: string
  description: string
  systemPrompt: string
  avatarColor: string
  category: string
  skills: string[]
}

const TEMPLATES: AgentTemplate[] = [
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

function RBtn({ icon: Icon, label, onClick, small }: {
  icon: React.ElementType; label: string; onClick: () => void; small?: boolean
}) {
  return (
    <button onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        background: T.red, color: "#fff",
        border: "none", borderRadius: 9,
        padding: small ? "7px 14px" : "9px 18px",
        fontSize: small ? 12 : 13, fontWeight: 500, cursor: "pointer",
        transition: "background 130ms ease",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "#FF1A3E"; (e.currentTarget as HTMLElement).style.boxShadow = "0 0 22px rgba(232,0,42,0.40)" }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = T.red; (e.currentTarget as HTMLElement).style.boxShadow = "none" }}
    >
      <Icon size={small ? 13 : 14} />{label}
    </button>
  )
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

function CreateAgentModal({ providers, onClose, onCreated }: {
  providers: Provider[]
  onClose: () => void
  onCreated: (id: string) => void
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
  const [activeCategory,   setActiveCategory] = useState("Всі")

  const TABS = ["Всі", "Affiliate", "SEO", "SMM", "Sales", "Content", "Support", "Analyst"]

  const visibleTemplates = activeCategory === "Всі"
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory)

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
    if (!name.trim()) { setError("Введіть назву агента"); return }
    if (!providerId)  { setError("Оберіть провайдера"); return }
    setLoading(true)
    setError("")
    const sb = getSupabase()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setError("Не авторизовано"); setLoading(false); return }

    const { data, error: dbErr } = await sb.from("agents").insert({
      user_id:       user.id,
      name:          name.trim(),
      description:   desc.trim(),
      provider_id:   providerId || null,
      system_prompt: prompt.trim(),
      avatar_color:  color,
    }).select().single()

    if (dbErr || !data) { setError(dbErr?.message ?? "Помилка"); setLoading(false); return }
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
            <div style={{ fontSize: 15, fontWeight: 600, color: T.t1 }}>Новий агент</div>
            <div style={{ fontSize: 10, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em" }}>AI Agent Layer</div>
          </div>
          {!showTemplates && (
            <button onClick={() => setShowTemplates(true)} style={{
              marginLeft: "auto", fontSize: 11.5, color: T.red, background: "none", border: "none",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 5, opacity: 0.8,
            }}>
              <Sparkles size={11} /> Шаблони
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
                  Шаблони агентів
                </span>
              </div>
              <button onClick={() => setShowTemplates(false)} style={{
                fontSize: 11, color: T.t4, background: "none", border: "none", cursor: "pointer",
              }}>
                Пропустити →
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
                Шаблон "{selectedTemplate}" застосовано — можете відредагувати нижче
              </div>
            )}

            <div style={{ height: "0.5px", background: "rgba(255,255,255,0.07)", margin: "16px 0 0" }} />
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Color + preview */}
          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>
              Колір аватара
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
              <span style={{ fontSize: 13, color: T.t2 }}>{name || "Назва агента"}</span>
            </div>
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Назва *
            </label>
            <input value={name} onChange={e => setName(e.target.value)}
              placeholder="Копірайтер, Аналітик, SEO..."
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Опис
            </label>
            <input value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Коротко — що вміє цей агент"
              style={inp}
              onFocus={e => { e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)" }}
              onBlur={e  => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.10)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 10, fontWeight: 600, color: T.t3, textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 5 }}>
              Провайдер *
            </label>
            {providers.length === 0 ? (
              <div style={{
                padding: "9px 12px", borderRadius: 9, fontSize: 12,
                background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)",
                color: "#FF4D6A",
              }}>
                Спочатку додайте API ключ у{" "}
                <a href="/providers" style={{ textDecoration: "underline", color: T.red }}>Провайдерах</a>
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
              Системний промпт
            </label>
            <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Ти — досвідчений AI агент. Відповідай чітко і по суті..."
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
            >Скасувати</button>
            <button onClick={handleCreate} disabled={providers.length === 0 || loading} style={{
              flex: 1, padding: "9px", borderRadius: 9, fontSize: 13, fontWeight: 500,
              cursor: providers.length === 0 || loading ? "not-allowed" : "pointer",
              background: providers.length === 0 || loading ? "rgba(232,0,42,0.3)" : T.red,
              border: "none", color: "#fff",
            }}
              onMouseEnter={e => { if (providers.length > 0 && !loading) (e.currentTarget as HTMLElement).style.background = "#FF1A3E" }}
              onMouseLeave={e => { if (providers.length > 0 && !loading) (e.currentTarget as HTMLElement).style.background = T.red }}
            >{loading ? "Створюємо..." : "Створити агента"}</button>
          </div>
        </div>
      </div>
    </Modal>
  )
}

function AgentCard({ agent, provider, sessionCount, onChat, onOpen, onDelete }: {
  agent: Agent; provider?: Provider; sessionCount: number
  onChat: (e: React.MouseEvent) => void
  onOpen: () => void
  onDelete: (e: React.MouseEvent) => void
}) {
  return (
    <div onClick={onOpen}
      style={{
        background: "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)",
        border: "0.5px solid rgba(255,255,255,0.09)",
        borderRadius: 14, padding: "18px 18px 14px",
        cursor: "pointer",
        transition: "background 160ms ease, border-color 160ms ease, box-shadow 160ms ease",
        display: "flex", flexDirection: "column", gap: 12,
        position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#14142A 0%,#0F0F1E 100%)"
        el.style.borderColor = "rgba(232,0,42,0.28)"
        el.style.boxShadow = "0 0 28px rgba(232,0,42,0.08)"
        const actions = el.querySelector(".card-actions") as HTMLElement
        if (actions) actions.style.opacity = "1"
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement
        el.style.background = "linear-gradient(160deg,#11111C 0%,#0E0E18 100%)"
        el.style.borderColor = "rgba(255,255,255,0.09)"
        el.style.boxShadow = "none"
        const actions = el.querySelector(".card-actions") as HTMLElement
        if (actions) actions.style.opacity = "0"
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12, flexShrink: 0,
            background: agent.avatar_color ?? T.red,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff",
            boxShadow: `0 0 16px ${agent.avatar_color ?? T.red}40`,
          }}>
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: T.t1, marginBottom: 2 }}>{agent.name}</div>
            {agent.description && (
              <div style={{ fontSize: 11.5, color: T.t3, lineHeight: 1.4 }}>{agent.description}</div>
            )}
          </div>
        </div>

        <div className="card-actions" style={{ display: "flex", gap: 4, opacity: 0, transition: "opacity 150ms ease" }}>
          <button onClick={e => { e.stopPropagation(); onOpen() }}
            style={{ padding: "5px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = T.t1 }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}>
            <Settings size={13} />
          </button>
          <button onClick={onDelete}
            style={{ padding: "5px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: "none", cursor: "pointer", color: T.t3, lineHeight: 0 }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t3 }}>
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {provider ? (
          <>
            <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.05)", border: "0.5px solid rgba(255,255,255,0.09)", color: T.t2 }}>
              {provider.name}
            </span>
            <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", color: T.t3 }}>
              {provider.model}
            </span>
          </>
        ) : (
          <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 6, background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)", color: "#FF4D6A" }}>
            Провайдер не знайдено
          </span>
        )}
        {sessionCount > 0 && (
          <span style={{ fontSize: 10.5, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.07)", color: T.t3, display: "flex", alignItems: "center", gap: 4 }}>
            <MessageSquare size={9} />{sessionCount} сесій
          </span>
        )}
      </div>

      {agent.system_prompt && (
        <div style={{
          fontSize: 11, color: T.t3, lineHeight: 1.5,
          padding: "7px 10px", borderRadius: 8,
          background: "rgba(255,255,255,0.025)", border: "0.5px solid rgba(255,255,255,0.06)",
          fontStyle: "italic",
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
        }}>
          "{agent.system_prompt}"
        </div>
      )}

      <button onClick={onChat} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
        height: 36, borderRadius: 9, fontSize: 12.5, fontWeight: 500,
        background: "rgba(255,255,255,0.04)",
        border: "0.5px solid rgba(255,255,255,0.08)",
        color: T.t2, cursor: "pointer", transition: "all 150ms ease",
      }}
        onMouseEnter={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.20)"
          ;(e.currentTarget as HTMLElement).style.color = "#fff"
          ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.30)"
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"
          ;(e.currentTarget as HTMLElement).style.color = T.t2
          ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,0.08)"
        }}>
        <MessageSquare size={13} />
        Розпочати чат
      </button>
    </div>
  )
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "80px 24px", textAlign: "center",
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 20, marginBottom: 20,
        background: "rgba(232,0,42,0.08)", border: "0.5px solid rgba(232,0,42,0.18)",
        display: "flex", alignItems: "center", justifyContent: "center",
        boxShadow: "0 0 32px rgba(232,0,42,0.08)",
      }}>
        <Bot size={30} style={{ color: T.red, opacity: 0.7 }} />
      </div>
      <div style={{ fontSize: 18, fontWeight: 600, color: T.t1, marginBottom: 8 }}>Агентів ще немає</div>
      <div style={{ fontSize: 13, color: T.t3, lineHeight: 1.6, maxWidth: 320, marginBottom: 24 }}>
        Створіть першого AI агента. Оберіть готовий шаблон або налаштуйте з нуля.
      </div>
      <RBtn icon={Plus} label="Створити агента" onClick={onAdd} />
      <div style={{ marginTop: 16, fontSize: 10.5, color: "#3A3A5A", textTransform: "uppercase", letterSpacing: "0.1em" }}>
        AI Agent Layer · Workspace Agents
      </div>
    </div>
  )
}

export default function AgentsPage() {
  const router = useRouter()
  const [agents,    setAgents]    = useState<Agent[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [sessions,  setSessions]  = useState<{ agentId: string }[]>([])
  const [showModal, setShowModal] = useState(false)
  const [pulse,     setPulse]     = useState(false)

  useEffect(() => {
    const id = setInterval(() => setPulse(p => !p), 2000)
    return () => clearInterval(id)
  }, [])

  async function refresh() {
    const sb = getSupabase()
    const [{ data: agentsData }, { data: providersData }] = await Promise.all([
      sb.from("agents").select("*").order("created_at", { ascending: true }),
      sb.from("providers").select("id,name,slug,model,is_active"),
    ])
    if (agentsData)   setAgents(agentsData as Agent[])
    if (providersData) setProviders(providersData as Provider[])
    setSessions(chatStore.getAll().map(s => ({ agentId: s.agentId })))
  }

  useEffect(() => { refresh() }, [])

  function handleChat(e: React.MouseEvent, agent: Agent) {
    e.stopPropagation()
    const session = chatStore.create(agent.id, `Чат з ${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const agent = agents.find(a => a.id === id)
    if (!agent) return
    if (window.confirm(`Видалити агента "${agent.name}"?`)) {
      const sb = getSupabase()
      await sb.from("agents").delete().eq("id", id)
      refresh()
    }
  }

  function handleCreated(agentId: string) {
    refresh()
    router.push(`/agents/${agentId}`)
  }

  function getProvider(id: string | null) { return providers.find(p => p.id === id) }
  function getSessionCount(id: string) { return sessions.filter(s => s.agentId === id).length }

  return (
    <>
      <style>{`
        @keyframes scanline {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(100vw); opacity: 0; }
        }
      `}</style>

      <div style={{
        marginLeft: SIDEBAR_W,
        minHeight: "100vh",
        background: T.bg,
        backgroundImage: "radial-gradient(rgba(255,255,255,0.038) 1px,transparent 1px)",
        backgroundSize: "24px 24px",
      }}>
        <div aria-hidden style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 1,
          background: "linear-gradient(90deg,transparent,rgba(232,0,42,0.6),transparent)",
          animation: "scanline 6s linear infinite",
          pointerEvents: "none", zIndex: 10,
        }} />

        {/* Hero */}
        <div style={{
          position: "relative", padding: "36px 48px 30px",
          borderBottom: `0.5px solid ${T.b1}`, overflow: "hidden",
        }}>
          <div aria-hidden style={{ position: "absolute", bottom: -1, left: 0, right: 0, height: 1, background: "linear-gradient(90deg,transparent 0%,rgba(232,0,42,0.50) 40%,rgba(232,0,42,0.50) 60%,transparent 100%)", pointerEvents: "none" }} />
          <div aria-hidden style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: 300, background: "radial-gradient(ellipse 70% 100% at 100% 50%,rgba(232,0,42,0.06) 0%,transparent 70%)", pointerEvents: "none" }} />

          <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "flex-end", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(232,0,42,0.08)", border: `0.5px solid ${T.bRed}`,
                borderRadius: 20, padding: "3px 10px", marginBottom: 14,
              }}>
                <span style={{
                  width: 5, height: 5, borderRadius: "50%", background: T.red, display: "inline-block",
                  opacity: pulse ? 1 : 0.3,
                  transition: "box-shadow 900ms ease, opacity 900ms ease",
                  boxShadow: pulse ? "0 0 6px rgba(232,0,42,1)" : "none",
                }} />
                <span style={{ fontSize: 10, color: T.red, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                  Agent Control · {agents.length} активних
                </span>
              </div>
              <h1 style={{ fontSize: 28, fontWeight: 600, color: T.t1, margin: 0, letterSpacing: "-0.02em", lineHeight: 1.2 }}>Агенти</h1>
              <p style={{ fontSize: 13, color: T.t3, marginTop: 6, marginBottom: 0 }}>
                Workspace Agents · AI Agent Layer · ваші персональні AI помічники
              </p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {providers.length === 0 && (
                <div onClick={() => router.push("/providers")} style={{
                  display: "flex", alignItems: "center", gap: 7, cursor: "pointer",
                  padding: "7px 12px", borderRadius: 9, fontSize: 12,
                  background: "rgba(232,0,42,0.07)", border: "0.5px solid rgba(232,0,42,0.2)", color: "#FF4D6A",
                }}>
                  <Zap size={12} /> Додайте API ключ
                </div>
              )}
              <RBtn icon={Plus} label="Новий агент" onClick={() => setShowModal(true)} />
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "28px 48px 56px", maxWidth: 1560 }}>
          {agents.length > 0 && (
            <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
              {[
                { label: "Всього агентів",  value: agents.length,    icon: Bot           },
                { label: "Активні сесії",   value: sessions.length,  icon: MessageSquare },
                { label: "Провайдери",       value: providers.length, icon: Activity      },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "10px 16px", borderRadius: 10,
                  background: T.s1, border: `0.5px solid ${T.b1}`,
                }}>
                  <Icon size={14} style={{ color: T.red, opacity: 0.7 }} />
                  <span style={{ fontSize: 13, fontWeight: 500, color: T.t1 }}>{value}</span>
                  <span style={{ fontSize: 11, color: T.t3 }}>{label}</span>
                </div>
              ))}
            </div>
          )}

          {agents.length === 0 ? (
            <EmptyState onAdd={() => setShowModal(true)} />
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 14 }}>
              {agents.map(agent => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  provider={getProvider(agent.provider_id)}
                  sessionCount={getSessionCount(agent.id)}
                  onChat={e => handleChat(e, agent)}
                  onOpen={() => router.push(`/agents/${agent.id}`)}
                  onDelete={e => handleDelete(e, agent.id)}
                />
              ))}
              <div onClick={() => setShowModal(true)} style={{
                borderRadius: 14, padding: "18px",
                border: "0.5px dashed rgba(232,0,42,0.22)",
                background: "rgba(232,0,42,0.03)",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8,
                minHeight: 160, transition: "background 150ms ease, border-color 150ms ease",
              }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.07)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.40)"
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.03)"
                  ;(e.currentTarget as HTMLElement).style.borderColor = "rgba(232,0,42,0.22)"
                }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(232,0,42,0.10)", border: "0.5px solid rgba(232,0,42,0.22)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Plus size={18} style={{ color: T.red }} />
                </div>
                <span style={{ fontSize: 12.5, color: T.t3 }}>Додати агента</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <CreateAgentModal
          providers={providers}
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </>
  )
}