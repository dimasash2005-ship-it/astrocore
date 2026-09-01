import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: "AstroCore",
  description: "AI Agent Workspace",
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
        {/* Google tag (gtag.js) */}
        <Script
          async
          src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`}
          strategy="beforeInteractive"
        />
        <Script id="google-analytics" strategy="beforeInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${GA_MEASUREMENT_ID}');
          `}
        </Script>
      </head>
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
      </body>
    </html>
  );
}