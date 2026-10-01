import type { MetadataRoute } from "next";

const BASE = "https://astrocore.one";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${BASE}/login`,          lastModified: now, changeFrequency: "monthly", priority: 1 },
    { url: `${BASE}/register`,       lastModified: now, changeFrequency: "monthly", priority: 0.9 },
    { url: `${BASE}/terms`,          lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
    { url: `${BASE}/privacy-policy`, lastModified: now, changeFrequency: "yearly",  priority: 0.3 },
  ];
}