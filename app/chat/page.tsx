"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bot,
  ChevronRight,
  Clock,
  MessageSquare,
  Plus,
  Search,
  Trash2,
} from "lucide-react";

import {
  agentStore,
  chatStore,
  providerStore,
  type Agent,
  type ChatSession,
  type Provider,
} from "@/lib/store";

import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { AstroButton } from "@/components/ui/astro-button";

function formatTime(iso: string): string {
  if (!iso) return "";

  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "щойно";
  if (diffMin < 60) return `${diffMin} хв тому`;
  if (diffHour < 24) return `${diffHour} год тому`;
  if (diffDay === 1) return "вчора";
  if (diffDay < 7) return `${diffDay} дні тому`;

  return date.toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
  });
}

function truncate(text: string, max: number): string {
  if (!text) return "";
  return text.length > max ? text.slice(0, max) + "..." : text;
}

type SessionCardProps = {
  session: ChatSession;
  agent: Agent | undefined;
  provider: Provider | undefined;
  onClick: () => void;
  onDelete: () => void;
};

function SessionCard({
  session,
  agent,
  provider,
  onClick,
  onDelete,
}: SessionCardProps) {
  const [hovered, setHovered] = useState(false);

  const lastMessage = session.messages[session.messages.length - 1];
  const lastContent = lastMessage?.content ?? "";
  const lastTime = lastMessage?.createdAt ?? session.createdAt;
  const messageCount = session.messages.length;

  const agentInitial = agent ? agent.name.charAt(0).toUpperCase() : "?";
  const avatarColor = agent?.avatarColor ?? "#444455";

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();

    const ok = window.confirm(`Видалити сесію "${session.title}"?`);

    if (ok) {
      onDelete();
    }
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="flex cursor-pointer items-center gap-3 rounded-xl px-4 py-3.5 transition-all"
      style={{
        backgroundColor: hovered ? "#111116" : "#0E0E14",
        border: `0.5px solid ${hovered ? "#2E2E3C" : "#1A1A24"}`,
      }}
    >
      <div
        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-sm font-medium text-white"
        style={{ backgroundColor: avatarColor }}
      >
        {agentInitial}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-[var(--astro-text-primary)]">
            {session.title}
          </span>

          <span className="flex flex-shrink-0 items-center gap-1 text-[10px] text-[var(--astro-text-muted)]">
            <Clock size={9} />
            {formatTime(lastTime)}
          </span>
        </div>

        <div className="mb-1 flex items-center gap-2">
          {agent && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--astro-text-secondary)]">
              <Bot size={9} />
              {agent.name}
            </span>
          )}

          {provider && (
            <span className="rounded border border-[var(--astro-border-dim)] px-1.5 py-0.5 text-[10px] text-[var(--astro-text-muted)]">
              {provider.model}
            </span>
          )}
        </div>

        <p className="truncate text-xs leading-relaxed text-[var(--astro-text-muted)]">
          {messageCount === 0
            ? "Немає повідомлень"
            : `${lastMessage.role === "user" ? "Ви: " : "AI: "}${truncate(
                lastContent,
                80
              )}`}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center gap-2">
        {messageCount > 0 && (
          <span className="min-w-[20px] rounded-full border border-[var(--astro-border-dim)] px-1.5 py-0.5 text-center text-[10px] text-[var(--astro-text-muted)]">
            {messageCount}
          </span>
        )}

        {hovered ? (
          <button
            onClick={handleDelete}
            className="rounded-md p-1.5 text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
            title="Видалити сесію"
          >
            <Trash2 size={13} />
          </button>
        ) : (
          <ChevronRight size={14} className="text-[var(--astro-border-strong)]" />
        )}
      </div>
    </div>
  );
}

function StatsBar({
  total,
  totalMessages,
}: {
  total: number;
  totalMessages: number;
}) {
  if (total === 0) return null;

  return (
    <div className="mb-4 flex items-center gap-6 rounded-lg border border-[var(--astro-border-dim)] bg-[var(--astro-bg-surface)] px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-[var(--astro-red)]" />
        <span className="text-[10px] text-[var(--astro-text-muted)]">
          Сесій:{" "}
          <span className="text-[var(--astro-text-secondary)]">{total}</span>
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-[var(--astro-text-muted)]" />
        <span className="text-[10px] text-[var(--astro-text-muted)]">
          Повідомлень:{" "}
          <span className="text-[var(--astro-text-secondary)]">
            {totalMessages}
          </span>
        </span>
      </div>
    </div>
  );
}

function SearchInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="relative mb-3">
      <Search
        size={13}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--astro-text-muted)]"
      />

      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Пошук сесій..."
        className="w-full rounded-lg border border-[var(--astro-border-dim)] bg-[var(--astro-bg-surface)] py-2 pl-9 pr-3 text-sm text-[var(--astro-text-primary)] outline-none focus:border-[var(--astro-red)]"
      />

      {value && (
        <button
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[var(--astro-text-muted)]"
        >
          ✕
        </button>
      )}
    </div>
  );
}

function AgentFilter({
  agents,
  selected,
  onSelect,
}: {
  agents: Agent[];
  selected: string | null;
  onSelect: (id: string | null) => void;
}) {
  if (agents.length === 0) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <button
        onClick={() => onSelect(null)}
        className="rounded-full px-3 py-1 text-xs font-medium transition-all"
        style={{
          backgroundColor:
            selected === null ? "rgba(232,0,42,0.1)" : "#0E0E14",
          border:
            selected === null
              ? "0.5px solid rgba(232,0,42,0.3)"
              : "0.5px solid #1A1A24",
          color: selected === null ? "#E8002A" : "#444455",
        }}
      >
        Всі
      </button>

      {agents.map((agent) => (
        <button
          key={agent.id}
          onClick={() => onSelect(selected === agent.id ? null : agent.id)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all"
          style={{
            backgroundColor:
              selected === agent.id ? "rgba(232,0,42,0.1)" : "#0E0E14",
            border:
              selected === agent.id
                ? "0.5px solid rgba(232,0,42,0.3)"
                : "0.5px solid #1A1A24",
            color: selected === agent.id ? "#E8002A" : "#444455",
          }}
        >
          <div
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: agent.avatarColor }}
          />
          {agent.name}
        </button>
      ))}
    </div>
  );
}

export default function ChatPage() {
  const router = useRouter();

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [search, setSearch] = useState("");
  const [agentFilter, setAgentFilter] = useState<string | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);

  function refresh() {
    setSessions(chatStore.getAll());
    setAgents(agentStore.getAll());
    setProviders(providerStore.getAll());
  }

  useEffect(() => {
    refresh();
  }, []);

  const filtered = useMemo(() => {
    let result = sessions;

    if (agentFilter) {
      result = result.filter((session) => session.agentId === agentFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();

      result = result.filter((session) => {
        const titleMatch = session.title.toLowerCase().includes(q);

        const messageMatch = session.messages.some((message) =>
          message.content.toLowerCase().includes(q)
        );

        const agent = agents.find((a) => a.id === session.agentId);
        const agentMatch = agent?.name.toLowerCase().includes(q) ?? false;

        return titleMatch || messageMatch || agentMatch;
      });
    }

    return result;
  }, [sessions, search, agentFilter, agents]);

  const agentsWithSessions = useMemo(() => {
    const ids = new Set(sessions.map((session) => session.agentId));
    return agents.filter((agent) => ids.has(agent.id));
  }, [sessions, agents]);

  const totalMessages = useMemo(
    () => sessions.reduce((sum, session) => sum + session.messages.length, 0),
    [sessions]
  );

  function getAgent(agentId: string): Agent | undefined {
    return agents.find((agent) => agent.id === agentId);
  }

  function getProvider(agent: Agent | undefined): Provider | undefined {
    if (!agent) return undefined;
    return providers.find((provider) => provider.id === agent.providerId);
  }

  function handleDelete(id: string) {
    chatStore.remove(id);
    refresh();
  }

  function handleOpen(sessionId: string) {
    router.push(`/chat/${sessionId}`);
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="Чат"
        description="Всі ваші розмови з AI агентами"
        action={
          <AstroButton
            variant="secondary"
            onClick={() => router.push("/agents")}
          >
            <Plus size={13} />
            Новий агент
          </AstroButton>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="Сесій ще немає"
          description="Перейдіть на сторінку Агентів і натисніть «Розпочати чат», щоб почати першу розмову"
          action={
            <AstroButton onClick={() => router.push("/agents")}>
              <Bot size={13} />
              До агентів
            </AstroButton>
          }
        />
      ) : (
        <>
          <StatsBar total={sessions.length} totalMessages={totalMessages} />

          <SearchInput value={search} onChange={setSearch} />

          <AgentFilter
            agents={agentsWithSessions}
            selected={agentFilter}
            onSelect={setAgentFilter}
          />

          {filtered.length === 0 ? (
            <div className="rounded-xl border border-dashed border-[var(--astro-border-dim)] py-12 text-center">
              <p className="text-sm text-[var(--astro-text-muted)]">
                Нічого не знайдено
              </p>

              <button
                onClick={() => {
                  setSearch("");
                  setAgentFilter(null);
                }}
                className="mt-3 text-xs text-[var(--astro-red)]"
              >
                Очистити фільтри
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {(search || agentFilter) && (
                <p className="mb-1 px-1 text-[10px] text-[var(--astro-text-muted)]">
                  Знайдено: {filtered.length} з {sessions.length}
                </p>
              )}

              {filtered.map((session) => {
                const agent = getAgent(session.agentId);
                const provider = getProvider(agent);

                return (
                  <SessionCard
                    key={session.id}
                    session={session}
                    agent={agent}
                    provider={provider}
                    onClick={() => handleOpen(session.id)}
                    onDelete={() => handleDelete(session.id)}
                  />
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}