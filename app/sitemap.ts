// Куди: app/sitemap.ts (замінити весь вміст)
import type { MetadataRoute } from "next";
import { POSTS } from "./guides/posts";

const BASE = "https://astrocore.one";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`,         lastModified: now, changeFrequency: "weekly",  priority: 1 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/login`,    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/guides`,   lastModified: now, changeFrequency: "weekly",  priority: 0.8 },
    ...POSTS.map((p) => ({ url: `${BASE}/guides/${p.slug}`, lastModified: new Date(p.date), changeFrequency: "monthly" as const, priority: 0.7 })),
  ];
}