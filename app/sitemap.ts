// Куди вставити: app/sitemap.ts (замінити весь вміст)
// Terms і Privacy прибрані — щоб не з'являлись у Google
import type { MetadataRoute } from "next";

const BASE = "https://astrocore.one";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/login`,    lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/register`, lastModified: now, changeFrequency: "monthly", priority: 0.9 },
  ];
}