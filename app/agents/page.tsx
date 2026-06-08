"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  ChevronRight,
  MessageSquare,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

import {
  agentStore,
  chatStore,
  providerStore,
  type Agent,
  type Provider,
} from "@/lib/store";

import { EmptyState } from "@/components/ui/empty-state";
import { AstroButton } from "@/components/ui/astro-button";
import { PageHeader } from "@/components/ui/page-header";

export const AVATAR_COLORS = [
  "#E8002A",
  "#10A37F",
  "#D97757",
  "#4285F4",
  "#8B5CF6",
  "#F59E0B",
  "#06B6D4",
  "#EC4899",
];

function AgentCard({
  agent,
  provider,
  sessionCount,
  onOpen,
  onChat,
  onDelete,
}: {
  agent: Agent;
  provider: Provider | undefined;
  sessionCount: number;
  onOpen: () => void;
  onChat: (event: React.MouseEvent) => void;
  onDelete: (event: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onOpen}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="astro-surface rounded-xl p-5 cursor-pointer transition-all hover:border-[var(--astro-red)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="flex h-11 w-11 items-center justify-center rounded-xl text-sm font-semibold text-white"
            style={{ backgroundColor: agent.avatarColor }}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>

          <div>
            <p className="text-sm font-medium text-[var(--astro-text-primary)]">
              {agent.name}
            </p>

            <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
              {provider
                ? `${provider.name} · ${provider.model}`
                : "Провайдер не знайдено"}
            </p>
          </div>
        </div>

        <div
          className="flex items-center gap-1 transition-opacity"
          style={{ opacity: hovered ? 1 : 0.3 }}
        >
          <button
            onClick={(event) => {
              event.stopPropagation();
              onOpen();
            }}
            className="text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
            title="Налаштування агента"
          >
            <Settings size={15} />
          </button>

          <button
            onClick={onDelete}
            className="text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
            title="Видалити агента"
          >
            <Trash2 size={15} />
          </button>

          <ChevronRight size={15} className="text-[var(--astro-text-muted)]" />
        </div>
      </div>

      {agent.description && (
        <p className="mt-4 text-sm text-[var(--astro-text-secondary)]">
          {agent.description}
        </p>
      )}

      {agent.systemPrompt && (
        <p className="mt-3 line-clamp-2 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3 text-xs text-[var(--astro-text-muted)]">
          {agent.systemPrompt}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {provider && (
          <span className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]">
            {provider.slug}
          </span>
        )}

        <span className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]">
          {sessionCount} чатів
        </span>
      </div>

      <div className="mt-5">
        <AstroButton
          variant="secondary"
          onClick={onChat}
          className="w-full"
        >
          <MessageSquare size={14} />
          Розпочати чат
        </AstroButton>
      </div>
    </div>
  );
}

export default function AgentsPage() {
  const router = useRouter();

  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [providerId, setProviderId] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);
  const [error, setError] = useState("");

  function refresh() {
    const activeProviders = providerStore.getAll().filter((p) => p.isActive);

    setAgents(agentStore.getAll());
    setProviders(activeProviders);

    if (!providerId && activeProviders.length > 0) {
      setProviderId(activeProviders[0].id);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function resetForm() {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setAvatarColor(AVATAR_COLORS[0]);
    setError("");

    const activeProviders = providerStore.getAll().filter((p) => p.isActive);
    setProviderId(activeProviders[0]?.id ?? "");
  }

  function createAgent() {
    if (!name.trim()) {
      setError("Введіть назву агента");
      return;
    }

    if (!providerId) {
      setError("Спочатку додайте активного провайдера в API ключах");
      return;
    }

    const agent = agentStore.add({
      name: name.trim(),
      description: description.trim(),
      providerId,
      systemPrompt: systemPrompt.trim(),
      avatarColor,
    });

    resetForm();
    setShowForm(false);
    refresh();

    router.push(`/agents/${agent.id}`);
  }

  function deleteAgent(id: string) {
    const agent = agents.find((item) => item.id === id);
    const ok = window.confirm(`Видалити агента "${agent?.name ?? ""}"?`);

    if (!ok) return;

    agentStore.remove(id);
    refresh();
  }

  function startChat(event: React.MouseEvent, agent: Agent) {
    event.stopPropagation();

    const session = chatStore.create(agent.id, `Чат з ${agent.name}`);
    router.push(`/chat/${session.id}`);
  }

  function openAgent(agent: Agent) {
    router.push(`/agents/${agent.id}`);
  }

  function getProvider(providerId: string) {
    return providers.find((p) => p.id === providerId);
  }

  function getSessionCount(agentId: string) {
    return chatStore.getAll().filter((session) => session.agentId === agentId)
      .length;
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        title="Агенти"
        description="Створюйте AI агентів для різних задач і підключайте їх до ваших API ключів"
        action={
          <AstroButton
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
          >
            <Plus size={14} />
            Новий агент
          </AstroButton>
        }
      />

      {showForm && (
        <div className="astro-surface rounded-xl p-5 mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)] mb-4">
            Новий агент
          </p>

          <div className="grid gap-4">
            <div>
              <label className="text-xs text-[var(--astro-text-muted)]">
                Назва агента
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Наприклад: Копірайтер, Стратег, Research Agent"
                className="mt-2 w-full rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--astro-text-muted)]">
                Опис
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Коротко — що робить цей агент"
                className="mt-2 w-full rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--astro-text-muted)]">
                Провайдер
              </label>

              {providers.length === 0 ? (
                <div className="mt-2 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
                  Спочатку додайте OpenAI / Claude / Gemini у сторінці API ключів.
                </div>
              ) : (
                <select
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  className="mt-2 w-full rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
                >
                  {providers.map((provider) => (
                    <option key={provider.id} value={provider.id}>
                      {provider.name} · {provider.model}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="text-xs text-[var(--astro-text-muted)]">
                System prompt
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder="Ти — AI агент, який допомагає з..."
                rows={4}
                className="mt-2 w-full resize-none rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm text-[var(--astro-text-primary)] outline-none"
              />
            </div>

            <div>
              <label className="text-xs text-[var(--astro-text-muted)]">
                Колір агента
              </label>

              <div className="mt-2 flex gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setAvatarColor(color)}
                    className="h-8 w-8 rounded-xl"
                    style={{
                      backgroundColor: color,
                      outline:
                        avatarColor === color
                          ? "2px solid white"
                          : "2px solid transparent",
                      outlineOffset: "2px",
                    }}
                  />
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <AstroButton onClick={createAgent}>
                <Plus size={14} />
                Створити агента
              </AstroButton>

              <AstroButton variant="ghost" onClick={() => setShowForm(false)}>
                Скасувати
              </AstroButton>
            </div>
          </div>
        </div>
      )}

      {agents.length === 0 ? (
        <EmptyState
          icon={Bot}
          title="Агентів ще немає"
          description="Створіть першого AI агента і підключіть його до одного з ваших провайдерів"
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {agents.map((agent) => {
            const provider = getProvider(agent.providerId);

            return (
              <AgentCard
                key={agent.id}
                agent={agent}
                provider={provider}
                sessionCount={getSessionCount(agent.id)}
                onOpen={() => openAgent(agent)}
                onChat={(event) => startChat(event, agent)}
                onDelete={(event) => {
                  event.stopPropagation();
                  deleteAgent(agent.id);
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}