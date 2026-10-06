// Куди: app/guides/page.tsx
// Список усіх гайдів: astrocore.one/guides
import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "./posts";
import { GuidesNav, GuidesFooter, formatDate } from "./shared";
import "./guides.css";

export const metadata: Metadata = {
  title: "Guides",
  description: "Guides for OpenClaw agents: how to connect your agent to a web dashboard, get reports, keep memory and manage it without a terminal.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  const posts = [...POSTS].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="ac-guides">
      <GuidesNav />
      <main className="g-wrap">
        <header className="g-head">
          <span className="g-eyebrow">AstroCore Guides</span>
          <h1>Guides for OpenClaw agents</h1>
          <p>How to connect your agent, keep its memory, get reports and manage it in the browser instead of a terminal.</p>
        </header>
        <div className="g-list">
          {posts.map((p) => (
            <Link key={p.slug} href={`/guides/${p.slug}`} className="g-card">
              <span className="g-meta">{p.tag} · {formatDate(p.date)} · {p.readMinutes} min read</span>
              <h2>{p.title}</h2>
              <p>{p.description}</p>
              <span className="g-more">Read guide →</span>
            </Link>
          ))}
        </div>
      </main>
      <GuidesFooter />
    </div>
  );
}