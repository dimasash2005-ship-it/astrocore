export type ProviderSlug = "openai" | "anthropic" | "google" | "custom";

export type Provider = {
  id: string;
  name: string;
  slug: ProviderSlug;
  apiKey: string;
  model: string;
  isActive: boolean;
  createdAt: string;

  webhookUrl?: string;
  authHeader?: string;
  customHeaders?: string;
};

export type Agent = {
  id: string;
  name: string;
  description: string;
  providerId: string;
  systemPrompt: string;
  avatarColor: string;
  createdAt: string;
};

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export type ChatSession = {
  id: string;
  agentId: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

export type VaultItem = {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source: string;
  createdAt: string;
};

export type GalleryItem = {
  id: string;
  title: string;
  content: string;
  type: "text" | "code" | "image";
  tags: string[];
  createdAt: string;
};

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export const providerStore = {
  getAll(): Provider[] {
    return load<Provider[]>("astro:providers", []);
  },

  add(data: Omit<Provider, "id" | "createdAt">): Provider {
    const providers = providerStore.getAll();

    const provider: Provider = {
      ...data,
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    save("astro:providers", [...providers, provider]);
    return provider;
  },

  update(id: string, data: Partial<Omit<Provider, "id" | "createdAt">>): void {
    save(
      "astro:providers",
      providerStore.getAll().map((provider) =>
        provider.id === id ? { ...provider, ...data } : provider
      )
    );
  },

  remove(id: string): void {
    save(
      "astro:providers",
      providerStore.getAll().filter((p) => p.id !== id)
    );
  },

  toggle(id: string): void {
    save(
      "astro:providers",
      providerStore.getAll().map((p) =>
        p.id === id ? { ...p, isActive: !p.isActive } : p
      )
    );
  },

  getById(id: string): Provider | undefined {
    return providerStore.getAll().find((p) => p.id === id);
  },

  getActive(): Provider[] {
    return providerStore.getAll().filter((p) => p.isActive);
  },
};

export const agentStore = {
  getAll(): Agent[] {
    return load<Agent[]>("astro:agents", []);
  },

  add(data: Omit<Agent, "id" | "createdAt">): Agent {
    const agents = agentStore.getAll();

    const agent: Agent = {
      ...data,
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    save("astro:agents", [...agents, agent]);
    return agent;
  },

  update(id: string, data: Partial<Omit<Agent, "id" | "createdAt">>): void {
    save(
      "astro:agents",
      agentStore.getAll().map((agent) =>
        agent.id === id ? { ...agent, ...data } : agent
      )
    );
  },

  remove(id: string): void {
    save(
      "astro:agents",
      agentStore.getAll().filter((a) => a.id !== id)
    );
  },

  getById(id: string): Agent | undefined {
    return agentStore.getAll().find((a) => a.id === id);
  },
};

export const chatStore = {
  getAll(): ChatSession[] {
    return load<ChatSession[]>("astro:chats", []);
  },

  getById(id: string): ChatSession | undefined {
    return chatStore.getAll().find((s) => s.id === id);
  },

  create(agentId: string, title: string): ChatSession {
    const sessions = chatStore.getAll();
    const now = new Date().toISOString();

    const session: ChatSession = {
      id: uid(),
      agentId,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
    };

    save("astro:chats", [session, ...sessions]);
    return session;
  },

  addMessage(
    sessionId: string,
    msg: Omit<Message, "id" | "createdAt">
  ): Message {
    const message: Message = {
      ...msg,
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    const sessions = chatStore.getAll().map((s) =>
      s.id === sessionId
        ? {
            ...s,
            messages: [...s.messages, message],
            updatedAt: new Date().toISOString(),
          }
        : s
    );

    save("astro:chats", sessions);
    return message;
  },

  updateTitle(id: string, title: string): void {
    save(
      "astro:chats",
      chatStore.getAll().map((s) => (s.id === id ? { ...s, title } : s))
    );
  },

  remove(id: string): void {
    save(
      "astro:chats",
      chatStore.getAll().filter((s) => s.id !== id)
    );
  },

  getStats(sessionId: string): {
    messageCount: number;
    lastMessage: string;
    lastTime: string;
  } {
    const session = chatStore.getById(sessionId);

    if (!session || session.messages.length === 0) {
      return {
        messageCount: 0,
        lastMessage: "Немає повідомлень",
        lastTime: "",
      };
    }

    const last = session.messages[session.messages.length - 1];

    return {
      messageCount: session.messages.length,
      lastMessage: last.content.slice(0, 120),
      lastTime: last.createdAt,
    };
  },
};

export const vaultStore = {
  getAll(): VaultItem[] {
    return load<VaultItem[]>("astro:vault", []);
  },

  add(data: Omit<VaultItem, "id" | "createdAt">): VaultItem {
    const items = vaultStore.getAll();

    const item: VaultItem = {
      ...data,
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    save("astro:vault", [item, ...items]);
    return item;
  },

  remove(id: string): void {
    save(
      "astro:vault",
      vaultStore.getAll().filter((i) => i.id !== id)
    );
  },
};

export const galleryStore = {
  getAll(): GalleryItem[] {
    return load<GalleryItem[]>("astro:gallery", []);
  },

  add(data: Omit<GalleryItem, "id" | "createdAt">): GalleryItem {
    const items = galleryStore.getAll();

    const item: GalleryItem = {
      ...data,
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    save("astro:gallery", [item, ...items]);
    return item;
  },

  remove(id: string): void {
    save(
      "astro:gallery",
      galleryStore.getAll().filter((i) => i.id !== id)
    );
  },
};