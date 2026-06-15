import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/auth/AuthProvider";

export const metadata: Metadata = {
  title: "AstroCore",
  description: "AI Agent Workspace",
};

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
      </body>
    </html>
  );
}