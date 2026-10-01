import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/login", "/register", "/terms", "/privacy-policy"],
      disallow: ["/api/", "/auth/"],
    },
    sitemap: "https://astrocore.one/sitemap.xml",
  };
}