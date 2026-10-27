// app/manifest.ts
//
// Makes AstroCore installable as an app ("Add to Home screen" / "Install app"):
// it opens full-screen without the browser bar, with its own icon and name.
// Next.js serves this at /manifest.webmanifest and links it in every page.

import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "AstroCore AI",
    short_name: "AstroCore",
    description: "The workspace for your OpenClaw agent: chat, missions, reports and client portals.",
    lang: "uk",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#08080F",
    theme_color: "#08080F",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press the app icon → jump straight to these
    shortcuts: [
      { name: "Новий чат", short_name: "Чат", url: "/chat", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Звіти", short_name: "Звіти", url: "/reports", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Місії", short_name: "Місії", url: "/missions", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  }
}
