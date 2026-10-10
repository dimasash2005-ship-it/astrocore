// lib/server/provider-errors.ts
//
// Turns raw provider errors ("Custom provider error 400: {...}") into a short,
// human message with a concrete next step. Used by:
//   - app/api/chat/route.ts          → what the user sees in the chat when a reply fails
//   - app/api/providers/test/route.ts → result of the "Test connection" button
//
// Only the wording changes; the technical detail is kept at the end (shortened)
// so problems can still be debugged.

export type Lang = "uk" | "en"

export type ProviderErrorKind =
  | "client_only"     // free tier that only works inside the provider's own app (e.g. OpenCode Zen free models)
  | "bad_key"         // 401 / 403, invalid key
  | "no_credits"      // 402 / quota / billing / insufficient balance
  | "rate_limit"      // 429 without billing words
  | "model"           // model name not accepted
  | "bad_url"         // 404 / 405 / not an OpenAI-compatible endpoint
  | "unreachable"     // DNS, connection refused, timeout
  | "provider_down"   // 5xx
  | "not_compatible"  // replied, but not in a format we understand
  | "unknown"

export type ExplainedError = { kind: ProviderErrorKind; title: string; hint: string; detail: string }

const TEXT: Record<ProviderErrorKind, Record<Lang, { title: string; hint: string }>> = {
  client_only: {
    uk: {
      title: "Цей сервіс приймає запити лише зі своєї власної програми",
      hint: "Так часто працюють безкоштовні тарифи (наприклад, безкоштовні моделі OpenCode): їх не можна підключити до інших платформ. Використай платний API-ключ цього сервісу або підключи OpenRouter, там є безкоштовні моделі, які працюють з AstroCore.",
    },
    en: {
      title: "This service only accepts requests from its own app",
      hint: "Free tiers often work this way (for example OpenCode's free models): they can't be used from other platforms. Use a paid API key for this service, or connect OpenRouter: it has free models that work with AstroCore.",
    },
  },
  bad_key: {
    uk: { title: "Провайдер не прийняв ключ", hint: "Перевір API-ключ у Провайдерах: чи він повний, без пробілів, і чи не видалений у кабінеті сервісу." },
    en: { title: "The provider rejected the key", hint: "Check the API key in Providers: complete, no extra spaces, and not revoked in the service's dashboard." },
  },
  no_credits: {
    uk: { title: "На рахунку провайдера закінчились кошти або ліміт", hint: "Поповни баланс або перевір ліміти в кабінеті сервісу, потім спробуй ще раз." },
    en: { title: "The provider account is out of credits or quota", hint: "Top up the balance or check usage limits in the service's dashboard, then try again." },
  },
  rate_limit: {
    uk: { title: "Забагато запитів до провайдера", hint: "Сервіс тимчасово обмежив запити. Зачекай хвилину й надішли повідомлення ще раз." },
    en: { title: "Too many requests to the provider", hint: "The service is rate-limiting requests. Wait a minute and send the message again." },
  },
  model: {
    uk: { title: "Провайдер не знає такої моделі", hint: "Перевір назву моделі в Провайдерах. Вона має бути точно такою, як у документації сервісу." },
    en: { title: "The provider doesn't recognise this model", hint: "Check the model name in Providers. It must match the service's documentation exactly." },
  },
  bad_url: {
    uk: { title: "За цією адресою немає сумісного API", hint: "Перевір Endpoint URL. Зазвичай він закінчується на /v1 (наприклад, https://openrouter.ai/api/v1). AstroCore підтримує OpenAI-сумісні API." },
    en: { title: "No compatible API at this address", hint: "Check the Endpoint URL. It usually ends with /v1 (for example https://openrouter.ai/api/v1). AstroCore supports OpenAI-compatible APIs." },
  },
  unreachable: {
    uk: { title: "Не вдалося з'єднатися з провайдером", hint: "Сервер не відповідає або адреса неправильна. Якщо це твій OpenClaw-агент, перевір, що сервер увімкнений." },
    en: { title: "Couldn't reach the provider", hint: "The server isn't responding or the address is wrong. If it's your OpenClaw agent, make sure the server is running." },
  },
  provider_down: {
    uk: { title: "У провайдера зараз збій", hint: "Помилка на боці сервісу. Спробуй ще раз за кілька хвилин." },
    en: { title: "The provider is having problems", hint: "The error is on the service's side. Try again in a few minutes." },
  },
  not_compatible: {
    uk: { title: "Провайдер відповів у незнайомому форматі", hint: "AstroCore підтримує OpenAI-сумісні API (формат /v1/chat/completions). Перевір, чи цей сервіс його підтримує." },
    en: { title: "The provider replied in an unknown format", hint: "AstroCore supports OpenAI-compatible APIs (the /v1/chat/completions format). Check that this service supports it." },
  },
  unknown: {
    uk: { title: "Провайдер повернув помилку", hint: "Перевір налаштування в Провайдерах або спробуй ще раз." },
    en: { title: "The provider returned an error", hint: "Check the settings in Providers or try again." },
  },
}

// Ukrainian only for browsers set to Ukrainian; everyone else (English, Czech, German…) gets English.
export function pickLang(acceptLanguage: string | null | undefined): Lang {
  return (acceptLanguage || "").toLowerCase().trim().startsWith("uk") ? "uk" : "en"
}

export function classifyProviderError(raw: string): ProviderErrorKind {
  const s = raw.toLowerCase()
  const status = Number((s.match(/error (\d{3})/) || [])[1] || 0)

  if (/missingsessionid|freetiererror|only be used from within|x-opencode/.test(s)) return "client_only"
  if (/insufficient|quota|credit|billing|balance|payment required/.test(s) || status === 402) return "no_credits"
  if (status === 429 || /rate.?limit|too many requests/.test(s)) return "rate_limit"
  if (status === 401 || /invalid.{0,20}(api.?key|token)|incorrect api key|unauthori[sz]ed|authentication/.test(s)) return "bad_key"
  if (/model.{0,40}(not found|does not exist|not exist|invalid|unknown|not supported)|(unknown|invalid) model|no such model/.test(s)) return "model"
  if (status === 403) return "bad_key"
  if (status === 404 || status === 405 || /non-json|<!doctype|<html/.test(s)) return "bad_url"
  if (status >= 500) return "provider_down"
  if (/timeout|timed out|econnrefused|enotfound|не вдалося з'єднатися|fetch failed|network/.test(s)) return "unreachable"
  if (/no recognizable content|returned no content/.test(s)) return "not_compatible"
  return "unknown"
}

export function explainProviderError(raw: string, lang: Lang): ExplainedError {
  const kind = classifyProviderError(raw)
  const t = TEXT[kind][lang]
  return { kind, title: t.title, hint: t.hint, detail: raw.replace(/\s+/g, " ").slice(0, 220) }
}

// Markdown shown in the chat as the assistant's reply when a request fails.
export function providerErrorMarkdown(raw: string, lang: Lang): string {
  const e = explainProviderError(raw, lang)
  const open = lang === "en" ? "Open Providers" : "Відкрити Провайдери"
  const tech = lang === "en" ? "Technical details" : "Технічні деталі"
  return `⚠️ **${e.title}**\n\n${e.hint}\n\n→ [${open}](/providers)\n\n_${tech}: \`${e.detail.replace(/`/g, "'")}\`_`
}