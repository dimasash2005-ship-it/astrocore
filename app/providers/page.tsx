"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle,
  ChevronDown,
  Eye,
  EyeOff,
  Key,
  Plus,
  Trash2,
  XCircle,
} from "lucide-react";

import { providerStore, type Provider, type ProviderSlug } from "@/lib/store";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AstroButton } from "@/components/ui/astro-button";

const PROVIDERS: Record<
  ProviderSlug,
  {
    label: string;
    color: string;
    placeholder: string;
    models: string[];
  }
> = {
  openai: {
    label: "OpenAI",
    color: "#10A37F",
    placeholder: "sk-...",
    models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
  },
  anthropic: {
    label: "Claude / Anthropic",
    color: "#D97757",
    placeholder: "sk-ant-...",
    models: ["claude-sonnet-4-5", "claude-opus-4-5", "claude-haiku-4-5"],
  },
  google: {
    label: "Google Gemini",
    color: "#4285F4",
    placeholder: "AIza...",
    models: ["gemini-1.5-pro", "gemini-1.5-flash", "gemini-pro"],
  },
  custom: {
    label: "OpenClaw / Custom Agent",
    color: "#8B5CF6",
    placeholder: "secret-token або лишіть пустим",
    models: ["default", "custom-agent", "gpt-4o", "claude-sonnet-4-5"],
  },
};

export default function ProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [slug, setSlug] = useState<ProviderSlug>("openai");
  const [model, setModel] = useState(PROVIDERS.openai.models[0]);
  const [apiKey, setApiKey] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [authHeader, setAuthHeader] = useState("Authorization");
  const [customHeaders, setCustomHeaders] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const current = PROVIDERS[slug];
  const isCustom = slug === "custom";

  function refresh() {
    setProviders(providerStore.getAll());
  }

  useEffect(() => {
    refresh();
  }, []);

  function changeProvider(next: ProviderSlug) {
    setSlug(next);
    setModel(PROVIDERS[next].models[0]);
    setApiKey("");
    setWebhookUrl("");
    setCustomHeaders("");
    setAuthHeader("Authorization");
    setError("");
    setSaved(false);
  }

  function isValidJsonObject(value: string) {
    if (!value.trim()) return true;

    try {
      const parsed = JSON.parse(value);
      return typeof parsed === "object" && !Array.isArray(parsed);
    } catch {
      return false;
    }
  }

  function saveProvider() {
    const key = apiKey.trim();
    const url = webhookUrl.trim();

    if (isCustom && !url) {
      setError("Введіть Webhook URL OpenClaw / Custom Agent");
      return;
    }

    if (isCustom && !url.startsWith("http")) {
      setError("Webhook URL має починатися з http або https");
      return;
    }

    if (!isCustom && !key) {
      setError("Введіть API ключ або токен");
      return;
    }

    if (!isCustom && key.length < 8) {
      setError("Ключ виглядає занадто коротким");
      return;
    }

    if (customHeaders && !isValidJsonObject(customHeaders)) {
      setError("Custom Headers мають бути валідним JSON обʼєктом");
      return;
    }

    providerStore.add({
      name: current.label,
      slug,
      apiKey: key,
      model,
      isActive: true,
      webhookUrl: isCustom ? url : undefined,
      authHeader: isCustom ? authHeader : undefined,
      customHeaders: isCustom && customHeaders.trim() ? customHeaders.trim() : undefined,
    });

    setApiKey("");
    setWebhookUrl("");
    setCustomHeaders("");
    setError("");
    setSaved(true);
    refresh();

    setTimeout(() => setSaved(false), 2500);
  }

  function removeProvider(id: string) {
    providerStore.remove(id);
    refresh();
  }

  function toggleProvider(id: string) {
    providerStore.toggle(id);
    refresh();
  }

  return (
    <div className="p-8 max-w-4xl">
      <PageHeader
        title="API Ключі"
        description="Підключіть AI сервіси або OpenClaw агентів. AstroCore буде працювати як один інтерфейс для всіх."
      />

      <div className="astro-surface rounded-xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)] mb-4">
          Додати провайдера
        </p>

        <div className="grid grid-cols-4 gap-3">
          {(Object.keys(PROVIDERS) as ProviderSlug[]).map((item) => (
            <button
              key={item}
              onClick={() => changeProvider(item)}
              className="rounded-xl p-4 text-left border transition-all"
              style={{
                backgroundColor:
                  slug === item ? "rgba(232,0,42,0.08)" : "var(--astro-bg-base)",
                borderColor:
                  slug === item ? "rgba(232,0,42,0.35)" : "var(--astro-border-dim)",
              }}
            >
              <div
                className="h-2 w-2 rounded-full mb-3"
                style={{ backgroundColor: PROVIDERS[item].color }}
              />
              <p className="text-sm text-[var(--astro-text-primary)]">
                {PROVIDERS[item].label}
              </p>
            </button>
          ))}
        </div>

        <div className="mt-5 grid gap-4">
          {isCustom && (
            <div>
              <label className="text-xs text-[var(--astro-text-muted)]">
                Webhook URL агента
              </label>

              <input
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://your-vps.com/api/agent/chat"
                className="mt-2 w-full rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
              />

              <p className="mt-2 text-xs text-[var(--astro-text-muted)]">
                Це endpoint OpenClaw Gateway, який приймає POST і повертає {"{ reply: \"...\" }"}.
              </p>
            </div>
          )}

          <div>
            <label className="text-xs text-[var(--astro-text-muted)]">
              {isCustom ? "Модель / ідентифікатор агента" : "Модель"}
            </label>

            <div className="relative mt-2">
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full appearance-none rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
              >
                {current.models.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--astro-text-muted)]"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-[var(--astro-text-muted)]">
              {isCustom ? "Auth Token optional" : "API ключ / token"}
            </label>

            <div className="relative mt-2">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={current.placeholder}
                className="w-full rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 pr-12 text-sm text-[var(--astro-text-primary)] outline-none"
              />

              <button
                onClick={() => setShowKey(!showKey)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--astro-text-muted)]"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            <p className="mt-2 text-xs text-[var(--astro-text-muted)]">
              {isCustom
                ? "Якщо OpenClaw має захист, токен піде як Authorization: Bearer token."
                : "Поки що ключ зберігається локально у браузері через localStorage."}
            </p>
          </div>

          {isCustom && (
            <div>
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-[var(--astro-red)]"
              >
                {showAdvanced ? "Приховати розширені налаштування" : "Розширені налаштування"}
              </button>

              {showAdvanced && (
                <div className="mt-4 grid gap-4 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-4">
                  <div>
                    <label className="text-xs text-[var(--astro-text-muted)]">
                      Auth Header
                    </label>

                    <input
                      value={authHeader}
                      onChange={(e) => setAuthHeader(e.target.value)}
                      placeholder="Authorization"
                      className="mt-2 w-full rounded-xl bg-[var(--astro-bg-surface)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
                    />

                    <p className="mt-2 text-xs text-[var(--astro-text-muted)]">
                      Наприклад: Authorization, X-Api-Key, X-Token
                    </p>
                  </div>

                  <div>
                    <label className="text-xs text-[var(--astro-text-muted)]">
                      Custom Headers JSON
                    </label>

                    <textarea
                      value={customHeaders}
                      onChange={(e) => setCustomHeaders(e.target.value)}
                      placeholder='{"X-Agent-Id":"main","X-Tenant-Id":"demo"}'
                      rows={3}
                      className="mt-2 w-full resize-none rounded-xl bg-[var(--astro-bg-surface)] border border-[var(--astro-border-base)] px-4 py-3 font-mono text-sm text-[var(--astro-text-primary)] outline-none"
                    />

                    <p className="mt-2 text-xs text-[var(--astro-text-muted)]">
                      Додаткові headers для OpenClaw Gateway.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {saved && (
            <div className="rounded-xl border border-green-900/40 bg-green-950/20 p-3 text-sm text-green-400">
              Провайдера збережено ✅
            </div>
          )}

          <AstroButton onClick={saveProvider}>
            <Plus size={14} />
            Зберегти провайдера
          </AstroButton>
        </div>
      </div>

      <div className="mt-6">
        {providers.length === 0 ? (
          <EmptyState
            icon={Key}
            title="Провайдерів ще немає"
            description="Додайте OpenAI, Claude, Gemini або OpenClaw агента через webhook."
          />
        ) : (
          <div className="grid gap-3">
            {providers.map((provider) => (
              <div
                key={provider.id}
                className="astro-surface rounded-xl p-5 flex items-center justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-[var(--astro-text-primary)]">
                      {provider.name}
                    </p>

                    <span className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]">
                      {provider.model}
                    </span>
                  </div>

                  <p className="mt-2 text-xs font-mono text-[var(--astro-text-muted)]">
                    {provider.slug === "custom"
                      ? provider.webhookUrl || "Webhook не вказано"
                      : `${provider.apiKey.slice(0, 8)}••••••${provider.apiKey.slice(-4)}`}
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleProvider(provider.id)}
                    className="flex items-center gap-1 text-xs"
                    style={{
                      color: provider.isActive
                        ? "var(--astro-green)"
                        : "var(--astro-text-muted)",
                    }}
                  >
                    {provider.isActive ? (
                      <CheckCircle size={15} />
                    ) : (
                      <XCircle size={15} />
                    )}
                    {provider.isActive ? "Активний" : "Вимкнено"}
                  </button>

                  <button
                    onClick={() => removeProvider(provider.id)}
                    className="text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}