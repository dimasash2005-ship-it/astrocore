// Куди: app/guides/posts.ts
// Тут лежать усі статті. Щоб додати нову — скопіюй один об'єкт у масив POSTS і зміни текст.

export type Post = {
    slug: string;          // адреса: astrocore.one/guides/<slug>
    title: string;
    description: string;   // опис для Google (1–2 речення)
    date: string;          // YYYY-MM-DD
    readMinutes: number;
    tag: string;
    html: string;          // текст статті в HTML
  };
  
  export const POSTS: Post[] = [
    {
      slug: "what-is-astrocore",
      title: "What is AstroCore AI? A web workspace for OpenClaw agents",
      description:
        "AstroCore AI is a web workspace for OpenClaw agents. Connect your agent in 3 clicks and manage it in the browser: chat, memory, files and reports, without a terminal or a Telegram bot.",
      date: "2026-10-06",
      readMinutes: 4,
      tag: "Product",
      html: `
  <p><strong>AstroCore AI</strong> (<a href="https://astrocore.one">astrocore.one</a>) is a web workspace for OpenClaw agents. You already have an agent. AstroCore gives it a home in the browser, where you can talk to it, give it tasks and get finished results back.</p>
  
  <p>AstroCore is not another agent and not an AI model. It is the environment around the agent you already run.</p>
  
  <h2>The problem it solves</h2>
  <p>An OpenClaw agent is powerful, but living with it is often messy:</p>
  <ul>
    <li>To talk to it, you SSH into a server or dig through a Telegram bot.</li>
    <li>Results get lost in chat history.</li>
    <li>Context disappears after a restart.</li>
    <li>API keys sit in a <code>.env</code> file you are afraid to touch.</li>
  </ul>
  <p>AstroCore puts all of this into one place.</p>
  
  <h2>What you get</h2>
  <ul>
    <li><strong>Connect in 3 clicks.</strong> Pick the platform, paste your key, launch.</li>
    <li><strong>Chat in the browser.</strong> Text, voice and photos, no terminal.</li>
    <li><strong>Memory</strong> that survives restarts, shared by every tool.</li>
    <li><strong>Reports.</strong> The agent saves finished work with the text, charts and sources in separate tabs, on demand or on a schedule.</li>
    <li><strong>Vault and Gallery</strong> for documents and generated images.</li>
    <li><strong>Forum</strong> to share agents and prompts with other users.</li>
    <li><strong>Integrations</strong> through MCP.</li>
  </ul>
  <p>You can also connect Claude, OpenAI, Gemini or any OpenAI-compatible API, but the main focus is giving OpenClaw agents a proper home.</p>
  
  <h2>How to start</h2>
  <ol>
    <li>Create a free account at <a href="https://astrocore.one/register">astrocore.one/register</a>.</li>
    <li>Connect your OpenClaw agent. You can also install the AstroCore skill from ClawHub so your agent can connect itself:
      <pre><code>openclaw skills install @dimasash2005-ship-it/astrocore</code></pre>
    </li>
    <li>Open the chat and give your agent its first task.</li>
  </ol>
  
  <h2>Pricing</h2>
  <p>AstroCore is free during beta. You pay your own AI provider directly for the tokens you use.</p>
  
  <h2>Privacy and security</h2>
  <p>AstroCore is built in the EU and follows the GDPR. API keys are stored encrypted and used only to call the provider you chose. There are no ads, and your data is never sold.</p>
  
  <h2>Not to be confused with</h2>
  <p>AstroCore AI is unrelated to other projects with a similar name, such as game-decompilation projects. AstroCore AI is software for managing AI agents, available at astrocore.one.</p>
  `,
    },
    {
      slug: "connect-openclaw-agent-to-web-dashboard",
      title: "How to connect your OpenClaw agent to a web dashboard",
      description:
        "A step-by-step guide to connecting an OpenClaw agent to a web dashboard, so you can chat with it, keep its memory and read its reports in the browser instead of a terminal.",
      date: "2026-10-06",
      readMinutes: 5,
      tag: "Guide",
      html: `
  <p>Running an OpenClaw agent on a server is great until you need to actually use it. Most people end up switching between an SSH session, a Telegram bot and a pile of notes. This guide shows how to give your agent a web dashboard instead, using <a href="https://astrocore.one">AstroCore AI</a>.</p>
  
  <h2>What you need</h2>
  <ul>
    <li>A running OpenClaw agent.</li>
    <li>A free AstroCore account.</li>
    <li>About two minutes.</li>
  </ul>
  
  <h2>Step 1. Create an account</h2>
  <p>Go to <a href="https://astrocore.one/register">astrocore.one/register</a> and sign up. AstroCore is free during beta, and no card is needed.</p>
  
  <h2>Step 2. Connect the agent</h2>
  <p>There are two ways to do it.</p>
  <p><strong>From the dashboard.</strong> Open <code>Providers</code>, choose OpenClaw, paste your key and press Launch. That is the whole setup: three clicks.</p>
  <p><strong>From the agent.</strong> Install the AstroCore skill from ClawHub and ask your agent to connect to AstroCore:</p>
  <pre><code>openclaw skills install @dimasash2005-ship-it/astrocore</code></pre>
  <p>The skill teaches the agent how to work inside AstroCore: chat with you, save memory, write reports and add items to the gallery.</p>
  
  <h2>Step 3. Give it a workspace</h2>
  <p>Decide which memory, files and tools your agent can use. Upload documents to the Vault if you want the agent to read and cite them.</p>
  
  <h2>Step 4. Give it the first task</h2>
  <p>Open the chat and ask for something real, for example:</p>
  <blockquote>Every morning, check the news about my competitors and save a short report.</blockquote>
  <p>When the agent finishes, the result lands in <code>Reports</code> with the text, the charts and every source it used in separate tabs.</p>
  
  <h2>Why a dashboard beats a terminal and Telegram</h2>
  <ul>
    <li><strong>Everything in one place.</strong> Chat, memory, files and results live together.</li>
    <li><strong>Results don't get lost.</strong> Reports are saved, searchable and easy to share.</li>
    <li><strong>Memory persists.</strong> The agent keeps context across sessions and restarts.</li>
    <li><strong>No server access needed</strong> for everyday work.</li>
  </ul>
  
  <h2>FAQ</h2>
  <p><strong>Do I need to move my agent?</strong> No. Your agent keeps running where it runs now. AstroCore connects to it.</p>
  <p><strong>Can I use other models too?</strong> Yes. Claude, OpenAI, Gemini and any OpenAI-compatible API can be connected as extra providers.</p>
  <p><strong>Is it free?</strong> Yes, during beta. You only pay your own AI provider.</p>
  `,
    },
  ];
  
  export function getPost(slug: string) {
    return POSTS.find((p) => p.slug === slug);
  }