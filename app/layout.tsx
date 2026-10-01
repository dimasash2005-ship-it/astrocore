import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  metadataBase: new URL("https://astrocore.one"),
  title: {
    default: "AstroCore AI — The Workspace for AI Agents",
    template: "%s — AstroCore AI",
  },
  description:
    "AstroCore AI is an all-in-one workspace for AI agents: chat, agents, memory, reports, storage and integrations with Claude, OpenAI, Gemini and custom providers — in one place.",
  applicationName: "AstroCore AI",
  keywords: ["AstroCore", "AstroCore AI", "AI agents", "AI workspace", "Claude", "OpenAI", "Gemini", "AI reports"],
  openGraph: {
    type: "website",
    url: "https://astrocore.one",
    siteName: "AstroCore AI",
    title: "AstroCore AI — The Workspace for AI Agents",
    description: "Chat, agents, memory, reports and integrations — everything for AI agents in one environment.",
  },
  twitter: {
    card: "summary_large_image",
    title: "AstroCore AI — The Workspace for AI Agents",
    description: "Chat, agents, memory, reports and integrations — everything for AI agents in one environment.",
  },
};

const GA_MEASUREMENT_ID = "G-KGL6PT3NNK";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        style={{
          background: "#08080F",
          minHeight: "100vh",
          color: "#E4E0F4",
        }}
      >
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