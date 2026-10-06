// Куди: app/guides/[slug]/page.tsx   (папка називається саме [slug], з квадратними дужками)
// Окрема стаття: astrocore.one/guides/<slug>
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POSTS, getPost } from "../posts";
import { GuidesNav, GuidesFooter, formatDate } from "../shared";
import "../guides.css";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/guides/${post.slug}` },
    openGraph: { type: "article", title: post.title, description: post.description, url: `/guides/${post.slug}` },
  };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.date,
    mainEntityOfPage: `https://astrocore.one/guides/${post.slug}`,
    author: { "@type": "Organization", name: "AstroCore AI", url: "https://astrocore.one" },
    publisher: { "@id": "https://astrocore.one/#org" },
    about: { "@id": "https://astrocore.one/#app" },
  };
  const others = POSTS.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="ac-guides">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <GuidesNav />
      <main className="g-wrap">
        <article className="g-article">
          <Link href="/guides" className="g-back">← All guides</Link>
          <span className="g-meta">{post.tag} · {formatDate(post.date)} · {post.readMinutes} min read</span>
          <h1>{post.title}</h1>
          <p className="g-lead">{post.description}</p>
          <div className="g-body" dangerouslySetInnerHTML={{ __html: post.html }} />
          <aside className="g-cta">
            <h2>Give your OpenClaw agent a home</h2>
            <p>Connect your agent in 3 clicks. Free during beta.</p>
            <Link href="/register" className="g-btn">Start free →</Link>
          </aside>
        </article>
        {others.length > 0 && (
          <section className="g-related">
            <h2>More guides</h2>
            <div className="g-list">
              {others.map((p) => (
                <Link key={p.slug} href={`/guides/${p.slug}`} className="g-card">
                  <span className="g-meta">{p.tag} · {p.readMinutes} min read</span>
                  <h3>{p.title}</h3>
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
      <GuidesFooter />
    </div>
  );
}