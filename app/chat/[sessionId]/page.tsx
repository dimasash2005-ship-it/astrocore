"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  BookOpen,
  Image,
  Loader2,
  Send,
} from "lucide-react";

import {
  agentStore,
  chatStore,
  galleryStore,
  providerStore,
  vaultStore,
  type Agent,
  type ChatSession,
  type Provider,
} from "@/lib/store";

import { AstroButton } from "@/components/ui/astro-button";

export default function ChatSessionPage() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params.sessionId as string;

  const [session, setSession] = useState<ChatSession | null>(null);
  const [agent, setAgent] = useState<Agent | null>(null);
  const [provider, setProvider] = useState<Provider | null>(null);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState("");
  const [isThinking, setIsThinking] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  function refresh() {
    const foundSession = chatStore.getById(sessionId);

    if (!foundSession) {
      router.push("/chat");
      return;
    }

    const foundAgent = agentStore.getById(foundSession.agentId) ?? null;
    const foundProvider = foundAgent
      ? providerStore.getById(foundAgent.providerId) ?? null
      : null;

    setSession(foundSession);
    setAgent(foundAgent);
    setProvider(foundProvider);
  }

  useEffect(() => {
    refresh();
  }, [sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages, isThinking]);

  async function sendMessage() {
    if (!input.trim() || !session || !agent || !provider || isThinking) return;

    const userText = input.trim();
    const isFirstUserMessage =
      session.messages.filter((message) => message.role === "user").length === 0;

    setInput("");
    setIsThinking(true);

    chatStore.addMessage(session.id, {
      role: "user",
      content: userText,
    });

    if (isFirstUserMessage) {
      const title =
        userText.length > 42 ? `${userText.slice(0, 42)}...` : userText;

      chatStore.updateTitle(session.id, title);
    }

    refresh();

    try {
      const currentSession = chatStore.getById(session.id);

      const messages =
        currentSession?.messages.map((message) => ({
          role: message.role,
          content: message.content,
        })) ?? [];

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: {
            slug: provider.slug,
            apiKey: provider.apiKey,
            model: provider.model,
            webhookUrl: provider.webhookUrl,
            authHeader: provider.authHeader,
            customHeaders: provider.customHeaders,
          },
          messages,
          systemPrompt: agent.systemPrompt,
          memory:
            typeof window !== "undefined"
              ? localStorage.getItem("astro:memory") || "[]"
              : "[]",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        chatStore.addMessage(session.id, {
          role: "assistant",
          content: `Помилка API: ${
            data.error || "невідома помилка"
          }\n\nПеревірте API ключ, billing або webhook провайдера.`,
        });

        refresh();
        return;
      }

      chatStore.addMessage(session.id, {
        role: "assistant",
        content: data.reply,
      });

      refresh();
    } catch (error) {
      console.error(error);

      chatStore.addMessage(session.id, {
        role: "assistant",
        content:
          provider.slug === "custom"
            ? "Помилка підключення до Custom Agent webhook. Перевірте URL, метод POST і формат відповіді { reply: \"...\" }."
            : "Помилка підключення до AI API. Перевірте інтернет, API ключ або billing.",
      });

      refresh();
    } finally {
      setIsThinking(false);
    }
  }

  function saveToVault(content: string) {
    if (!agent) return;

    vaultStore.add({
      title: `Відповідь ${agent.name}`,
      content,
      tags: ["chat", agent.name],
      source: "chat",
    });

    setSaving("vault");
    setTimeout(() => setSaving(""), 1500);
  }

  function saveToGallery(content: string) {
    if (!agent) return;

    galleryStore.add({
      title: `Відповідь ${agent.name}`,
      content,
      type: "text",
      tags: ["chat", agent.name],
    });

    setSaving("gallery");
    setTimeout(() => setSaving(""), 1500);
  }

  if (!session || !agent) {
    return (
      <div className="p-8 text-[var(--astro-text-primary)]">
        Завантаження...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col text-[var(--astro-text-primary)]">
      <header className="flex items-center gap-4 border-b border-[var(--astro-border-dim)] px-6 py-4">
        <button
          onClick={() => router.push("/chat")}
          className="text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
        >
          <ArrowLeft size={18} />
        </button>

        <div
          className="flex h-10 w-10 items-center justify-center rounded-xl text-white"
          style={{ backgroundColor: agent.avatarColor }}
        >
          <Bot size={18} />
        </div>

        <div>
          <p className="text-sm font-medium">{agent.name}</p>
          <p className="text-xs text-[var(--astro-text-muted)]">
            {provider
              ? `${provider.name} · ${provider.model}`
              : "Провайдер не знайдено"}
          </p>
        </div>

        {isThinking && (
          <div className="ml-auto flex items-center gap-2 rounded-xl border border-[var(--astro-border-dim)] px-3 py-2 text-xs text-[var(--astro-text-muted)]">
            <Loader2 size={13} className="animate-spin" />
            Агент думає...
          </div>
        )}

        {saving && !isThinking && (
          <div className="ml-auto rounded-xl border border-[var(--astro-border-dim)] px-3 py-2 text-xs text-[var(--astro-green)]">
            {saving === "vault" ? "Збережено у Сховище" : "Збережено в Галерею"}
          </div>
        )}
      </header>

      <main className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {session.messages.length === 0 && (
            <div className="flex min-h-[60vh] items-center justify-center text-center">
              <div className="max-w-md">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl text-white"
                  style={{ backgroundColor: agent.avatarColor }}
                >
                  <Bot size={22} />
                </div>

                <h2 className="mt-5 text-xl font-medium">
                  Почніть розмову з {agent.name}
                </h2>

                <p className="mt-2 text-sm leading-relaxed text-[var(--astro-text-muted)]">
                  AstroCore передасть агенту його system prompt, памʼять і
                  історію цієї сесії.
                </p>

                {!provider && (
                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-red-400">
                    <AlertCircle size={14} />
                    Провайдера не знайдено
                  </div>
                )}
              </div>
            </div>
          )}

          {session.messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className="group max-w-[75%]">
                <div
                  className="whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed"
                  style={{
                    backgroundColor:
                      message.role === "user"
                        ? "var(--astro-bg-elevated)"
                        : message.content.startsWith("Помилка")
                        ? "rgba(232,0,42,0.08)"
                        : "var(--astro-bg-surface)",
                    border: message.content.startsWith("Помилка")
                      ? "1px solid rgba(232,0,42,0.25)"
                      : message.role === "user"
                      ? "1px solid var(--astro-border-base)"
                      : "1px solid var(--astro-border-dim)",
                    color: message.content.startsWith("Помилка")
                      ? "#FF4D6A"
                      : "var(--astro-text-primary)",
                  }}
                >
                  {message.content}
                </div>

                {message.role === "assistant" &&
                  !message.content.startsWith("Помилка") && (
                    <div className="mt-2 flex gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        onClick={() => saveToVault(message.content)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--astro-border-dim)] px-2 py-1 text-xs text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
                      >
                        <BookOpen size={12} />
                        У сховище
                      </button>

                      <button
                        onClick={() => saveToGallery(message.content)}
                        className="flex items-center gap-1 rounded-lg border border-[var(--astro-border-dim)] px-2 py-1 text-xs text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
                      >
                        <Image size={12} />
                        У галерею
                      </button>
                    </div>
                  )}
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-surface)] px-4 py-3 text-sm text-[var(--astro-text-muted)]">
                <div className="flex items-center gap-2">
                  <Loader2 size={14} className="animate-spin" />
                  {agent.name} формує відповідь...
                </div>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="border-t border-[var(--astro-border-dim)] p-4">
        <div className="mx-auto flex max-w-3xl gap-3">
          <input
            value={input}
            disabled={isThinking}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isThinking) {
                sendMessage();
              }
            }}
            placeholder={
              isThinking
                ? "Очікуємо відповідь агента..."
                : "Напишіть повідомлення..."
            }
            className="flex-1 rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none disabled:opacity-50"
          />

          <AstroButton onClick={sendMessage} disabled={isThinking}>
            {isThinking ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
            {isThinking ? "Очікуємо" : "Надіслати"}
          </AstroButton>
        </div>
      </footer>
    </div>
  );
}