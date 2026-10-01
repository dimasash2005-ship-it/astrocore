import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Analytics } from "@vercel/analytics/react";
import CookieConsent from "@/components/CookieConsent";

const SITE_TITLE = "AstroCore — робочий простір для AI-агента";
const SITE_DESC  = "Памʼять, звіти і галерея для агента OpenClaw. Підключення однією командою.";

export const metadata: Metadata = {
  metadataBase: new URL("https://astrocore.one"),
  title: {
    default: SITE_TITLE,
    template: "%s · AstroCore",
  },
  description: SITE_DESC,
  applicationName: "AstroCore",
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESC,
    url: "https://astrocore.one",
    siteName: "AstroCore",
    locale: "uk_UA",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESC,
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