// Куди: app/sitemap.ts (замінити весь вміст)
import type { MetadataRoute } from "next";

const BASE = "https://astrocore.one";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/`,         lastModified: now, changeFrequency: "weekly",  priority: 1 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${BASE}/login`,    lastModified: now, changeFrequency: "monthly", priority: 0.6 },
  ];
}