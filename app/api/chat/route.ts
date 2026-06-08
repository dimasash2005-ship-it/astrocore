import { NextRequest, NextResponse } from "next/server";

type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ProviderPayload = {
  slug: "openai" | "anthropic" | "google" | "custom";
  apiKey: string;
  model: string;
  webhookUrl?: string;
  authHeader?: string;
  customHeaders?: string;
};

type RequestBody = {
  provider?: ProviderPayload;
  messages?: ChatMessage[];
  systemPrompt?: string;
  memory?: string;

  apiKey?: string;
  model?: string;
  providerSlug?: ProviderPayload["slug"];
};

function buildSystemPrompt(systemPrompt?: string, memory?: string) {
  return `
Ти AI агент всередині AstroCore.

Відповідай українською, чітко і корисно.

Інструкції агента:
${systemPrompt || "Немає окремих інструкцій."}

Памʼять AstroCore:
${memory || "Памʼять поки порожня."}

Використовуй памʼять тільки коли вона релевантна до запиту.
`.trim();
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  finalSystemPrompt: string
) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: finalSystemPrompt,
        },
        ...messages,
      ],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "OpenAI request failed");
  }

  return data.choices?.[0]?.message?.content || "Немає відповіді";
}

async function callAnthropic(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  finalSystemPrompt: string
) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model || "claude-sonnet-4-5",
      max_tokens: 2048,
      system: finalSystemPrompt,
      messages: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Anthropic request failed");
  }

  return data.content?.[0]?.text || "Немає відповіді";
}

async function callGoogle(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  finalSystemPrompt: string
) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${
    model || "gemini-1.5-flash"
  }:generateContent?key=${apiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: finalSystemPrompt }],
      },
      contents: messages
        .filter((message) => message.role !== "system")
        .map((message) => ({
          role: message.role === "assistant" ? "model" : "user",
          parts: [{ text: message.content }],
        })),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || "Google Gemini request failed");
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Немає відповіді";
}

async function callCustomWebhook(
  provider: ProviderPayload,
  messages: ChatMessage[],
  finalSystemPrompt: string,
  memory?: string
) {
  if (!provider.webhookUrl) {
    throw new Error("Webhook URL не вказано для Custom Agent");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-AstroCore-Version": "1.0",
    "X-AstroCore-Timestamp": Date.now().toString(),
  };

  if (provider.apiKey) {
    const headerName = provider.authHeader || "Authorization";
    headers[headerName] =
      headerName === "Authorization" ? `Bearer ${provider.apiKey}` : provider.apiKey;
  }

  if (provider.customHeaders) {
    try {
      const extraHeaders = JSON.parse(provider.customHeaders) as Record<
        string,
        string
      >;

      Object.assign(headers, extraHeaders);
    } catch {
      // ignore invalid custom headers
    }
  }

  const lastUserMessage =
    messages.filter((message) => message.role === "user").at(-1)?.content || "";

  const response = await fetch(provider.webhookUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: lastUserMessage,
      messages,
      systemPrompt: finalSystemPrompt,
      memory: memory || "",
      model: provider.model || "default",
      source: "astrocore",
    }),
    signal: AbortSignal.timeout(30000),
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `OpenClaw відповів помилкою ${response.status}${
        text ? `: ${text.slice(0, 200)}` : ""
      }`
    );
  }

  try {
    const data = JSON.parse(text);

    if (typeof data === "string") return data;
    if (data.reply) return data.reply;
    if (data.message) return data.message;
    if (data.response) return data.response;
    if (data.content) return data.content;

    throw new Error(
      `Невідомий формат відповіді OpenClaw: ${JSON.stringify(data).slice(
        0,
        200
      )}`
    );
  } catch {
    return text;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RequestBody;

    const provider: ProviderPayload =
      body.provider ||
      ({
        slug: body.providerSlug || "openai",
        apiKey: body.apiKey || "",
        model: body.model || "gpt-4o-mini",
      } as ProviderPayload);

    const messages = body.messages || [];
    const finalSystemPrompt = buildSystemPrompt(body.systemPrompt, body.memory);

    if (!provider.slug) {
      return NextResponse.json({ error: "Не вказано провайдера" }, { status: 400 });
    }

    if (!messages.length) {
      return NextResponse.json({ error: "Повідомлення відсутні" }, { status: 400 });
    }

    let reply = "";

    if (provider.slug === "openai") {
      reply = await callOpenAI(provider.apiKey, provider.model, messages, finalSystemPrompt);
    }

    if (provider.slug === "anthropic") {
      reply = await callAnthropic(
        provider.apiKey,
        provider.model,
        messages,
        finalSystemPrompt
      );
    }

    if (provider.slug === "google") {
      reply = await callGoogle(provider.apiKey, provider.model, messages, finalSystemPrompt);
    }

    if (provider.slug === "custom") {
      reply = await callCustomWebhook(provider, messages, finalSystemPrompt, body.memory);
    }

    return NextResponse.json({ reply });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Server error";

    console.error("[AstroCore API]", message);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}