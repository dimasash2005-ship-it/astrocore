import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import CookieConsent from "@/components/CookieConsent";
import RefTracker from "@/components/analytics/RefTracker";

const DESCRIPTION =
  "AstroCore AI is a web workspace for OpenClaw agents. Connect your OpenClaw agent in 3 clicks and manage it in the browser: chat, memory, files and reports. No terminal, SSH or Telegram bot.";

export const metadata: Metadata = {
  metadataBase: new URL("https://astrocore.one"),
  title: {
    default: "AstroCore AI — The Workspace for OpenClaw Agents",
    template: "%s — AstroCore AI",
  },
  description: DESCRIPTION,
  applicationName: "AstroCore AI",
  keywords: ["AstroCore", "AstroCore AI", "OpenClaw", "OpenClaw dashboard", "OpenClaw agent", "AI agent workspace", "AI agent reports"],
  openGraph: {
    type: "website",
    url: "https://astrocore.one",
    siteName: "AstroCore AI",
    title: "AstroCore AI — The Workspace for OpenClaw Agents",
    description: "Connect your OpenClaw agent in 3 clicks. Chat, memory, files and reports in one place.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AstroCore AI — The Workspace for OpenClaw Agents",
    description: "Connect your OpenClaw agent in 3 clicks. Chat, memory, files and reports in one place.",
  },
};

// Structured data: tells Google and AI assistants exactly what AstroCore is
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://astrocore.one/#org",
      name: "AstroCore AI",
      alternateName: ["AstroCore", "astrocore.one"],
      url: "https://astrocore.one",
      logo: "https://astrocore.one/icon.png",
      email: "astrocore.one@outlook.cz",
      sameAs: [
        "https://clawhub.ai/dimasash2005-ship-it/skills/astrocore",
        "https://t.me/AstroCore_Manager",
        "https://discord.gg/aQevqZxPqc",
      ],
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://astrocore.one/#app",
      name: "AstroCore AI",
      url: "https://astrocore.one",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      publisher: { "@id": "https://astrocore.one/#org" },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Free during beta" },
      featureList: [
        "Connect an OpenClaw agent in 3 clicks",
        "Chat with your agent in the browser",
        "Persistent agent memory",
        "Reports with text, charts and sources",
        "File storage and gallery",
        "MCP integrations",
      ],
    },
  ],
};

const GA_MEASUREMENT_ID = "G-KGL6PT3NNK";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <head>
        {/* Fonts: connect early and load once for the whole app (pages used to @import them separately) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body
        style={{
          background: "#08080F",
          minHeight: "100vh",
          color: "#E4E0F4",
        }}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <RefTracker />
        <AuthProvider>{children}</AuthProvider>
        <CookieConsent />
        <Analytics />

        {/* Google tag (gtag.js) — loaded after the page is interactive */}
        <Script
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </body>
    </html>
  );
}