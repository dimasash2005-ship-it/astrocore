"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bot,
  BookOpen,
  Brain,
  Image,
  Key,
  MessageSquare,
  Plus,
  Settings,
} from "lucide-react";

import {
  agentStore,
  chatStore,
  galleryStore,
  providerStore,
  vaultStore,
  type Agent,
  type ChatSession,
  type GalleryItem,
  type Provider,
  type VaultItem,
} from "@/lib/store";

import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import { AstroButton } from "@/components/ui/astro-button";

type MemoryItem = {
  id: string;
  title: string;
  content: string;
  type: string;
  createdAt: string;
};

function loadMemory(): MemoryItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = localStorage.getItem("astro:memory");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function formatDate(iso?: string) {
  if (!iso) return "—";

  return new Date(iso).toLocaleDateString("uk-UA", {
    day: "numeric",
    month: "short",
  });
}

function DashboardCard({
  title,
  value,
  sub,
  href,
  icon: Icon,
}: {
  title: string;
  value: string;
  sub: string;
  href: string;
  icon: any;
}) {
  return (
    <Link
      href={href}
      className="astro-surface rounded-xl p-5 hover:border-[var(--astro-red)] transition-all"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.18em] text-[var(--astro-text-muted)]">
          {title}
        </p>

        <Icon size={17} className="text-[var(--astro-red)]" />
      </div>

      <p className="mt-4 text-3xl font-medium text-[var(--astro-text-primary)]">
        {value}
      </p>

      <p className="mt-1 text-sm text-[var(--astro-text-secondary)]">{sub}</p>
    </Link>
  );
}

function Section({
  title,
  href,
  children,
}: {
  title: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <div className="astro-surface rounded-xl p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-medium text-[var(--astro-text-primary)]">
          {title}
        </p>

        <Link href={href} className="text-xs text-[var(--astro-red)]">
          Відкрити
        </Link>
      </div>

      {children}
    </div>
  );
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [vault, setVault] = useState<VaultItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [memory, setMemory] = useState<MemoryItem[]>([]);

  useEffect(() => {
    setAgents(agentStore.getAll());
    setProviders(providerStore.getAll());
    setSessions(chatStore.getAll());
    setVault(vaultStore.getAll());
    setGallery(galleryStore.getAll());
    setMemory(loadMemory());
  }, []);

  const activeProviders = providers.filter((p) => p.isActive);
  const recentSessions = sessions.slice(0, 4);
  const recentVault = vault.slice(0, 3);
  const recentMemory = memory.slice(0, 3);

  return (
    <main className="min-h-screen bg-[var(--astro-bg-base)] text-[var(--astro-text-primary)]">
      <Sidebar />

      <div className="ml-20">
        <Topbar />

        <div className="p-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-8 flex items-start justify-between gap-6">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-[var(--astro-red)]">
                  AstroCore
                </p>

                <h1 className="mt-4 text-5xl font-medium tracking-tight">
                  Центр
                </h1>

                <p className="mt-3 max-w-2xl text-[var(--astro-text-secondary)]">
                  Операційний простір для агентів, чатів, памʼяті та збережених
                  AI-результатів.
                </p>
              </div>

              <div className="flex gap-3">
                <Link href="/agents">
                  <AstroButton>
                    <Plus size={14} />
                    Новий агент
                  </AstroButton>
                </Link>

                <Link href="/providers">
                  <AstroButton variant="secondary">
                    <Key size={14} />
                    API ключі
                  </AstroButton>
                </Link>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-4">
              <DashboardCard
                title="Агенти"
                value={String(agents.length)}
                sub={`${activeProviders.length} активних провайдерів`}
                href="/agents"
                icon={Bot}
              />

              <DashboardCard
                title="Чати"
                value={String(sessions.length)}
                sub={`${sessions.reduce(
                  (sum, s) => sum + s.messages.length,
                  0
                )} повідомлень`}
                href="/chat"
                icon={MessageSquare}
              />

              <DashboardCard
                title="Памʼять"
                value={String(memory.length)}
                sub="контекст для агентів"
                href="/memory"
                icon={Brain}
              />

              <DashboardCard
                title="Сховище"
                value={String(vault.length + gallery.length)}
                sub={`${vault.length} vault · ${gallery.length} gallery`}
                href="/vault"
                icon={BookOpen}
              />
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="col-span-2">
                <Section title="Останні чати" href="/chat">
                  {recentSessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-[var(--astro-border-dim)] p-8 text-center">
                      <MessageSquare
                        size={22}
                        className="mx-auto text-[var(--astro-text-muted)]"
                      />
                      <p className="mt-3 text-sm text-[var(--astro-text-muted)]">
                        Чатів ще немає
                      </p>
                      <Link
                        href="/agents"
                        className="mt-3 inline-block text-xs text-[var(--astro-red)]"
                      >
                        Перейти до агентів
                      </Link>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {recentSessions.map((session) => {
                        const agent = agents.find(
                          (a) => a.id === session.agentId
                        );
                        const last =
                          session.messages[session.messages.length - 1];

                        return (
                          <Link
                            key={session.id}
                            href={`/chat/${session.id}`}
                            className="rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-4 hover:border-[var(--astro-red)] transition-all"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div>
                                <p className="text-sm font-medium">
                                  {session.title}
                                </p>
                                <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
                                  {agent?.name ?? "Агент не знайдений"} ·{" "}
                                  {session.messages.length} повідомлень
                                </p>
                              </div>

                              <p className="text-xs text-[var(--astro-text-muted)]">
                                {formatDate(last?.createdAt ?? session.createdAt)}
                              </p>
                            </div>

                            {last && (
                              <p className="mt-3 line-clamp-1 text-sm text-[var(--astro-text-secondary)]">
                                {last.role === "user" ? "Ви: " : "AI: "}
                                {last.content}
                              </p>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </Section>
              </div>

              <Section title="Провайдери" href="/providers">
                {providers.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[var(--astro-border-dim)] p-6 text-center">
                    <Key
                      size={20}
                      className="mx-auto text-[var(--astro-text-muted)]"
                    />
                    <p className="mt-3 text-sm text-[var(--astro-text-muted)]">
                      API ключів ще немає
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    {providers.slice(0, 4).map((provider) => (
                      <div
                        key={provider.id}
                        className="rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm">{provider.name}</p>
                          <span
                            className={`text-xs ${
                              provider.isActive
                                ? "text-[var(--astro-green)]"
                                : "text-[var(--astro-text-muted)]"
                            }`}
                          >
                            {provider.isActive ? "active" : "off"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
                          {provider.model}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </Section>
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <Section title="Остання памʼять" href="/memory">
                {recentMemory.length === 0 ? (
                  <p className="text-sm text-[var(--astro-text-muted)]">
                    Памʼять ще порожня
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {recentMemory.map((item) => (
                      <Link
                        key={item.id}
                        href="/memory"
                        className="rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3 hover:border-[var(--astro-red)] transition-all"
                      >
                        <p className="text-sm">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--astro-text-muted)]">
                          {item.content}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Сховище" href="/vault">
                {recentVault.length === 0 ? (
                  <p className="text-sm text-[var(--astro-text-muted)]">
                    Збережень ще немає
                  </p>
                ) : (
                  <div className="grid gap-2">
                    {recentVault.map((item) => (
                      <Link
                        key={item.id}
                        href="/vault"
                        className="rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3 hover:border-[var(--astro-red)] transition-all"
                      >
                        <p className="text-sm">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs text-[var(--astro-text-muted)]">
                          {item.content}
                        </p>
                      </Link>
                    ))}
                  </div>
                )}
              </Section>

              <Section title="Швидкі дії" href="/settings">
                <div className="grid gap-2">
                  <Link
                    href="/agents"
                    className="flex items-center gap-3 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3 hover:border-[var(--astro-red)] transition-all"
                  >
                    <Bot size={16} className="text-[var(--astro-red)]" />
                    <span className="text-sm">Керувати агентами</span>
                  </Link>

                  <Link
                    href="/gallery"
                    className="flex items-center gap-3 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3 hover:border-[var(--astro-red)] transition-all"
                  >
                    <Image size={16} className="text-[var(--astro-red)]" />
                    <span className="text-sm">Відкрити галерею</span>
                  </Link>

                  <Link
                    href="/settings"
                    className="flex items-center gap-3 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-3 hover:border-[var(--astro-red)] transition-all"
                  >
                    <Settings size={16} className="text-[var(--astro-red)]" />
                    <span className="text-sm">Налаштування</span>
                  </Link>
                </div>
              </Section>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}