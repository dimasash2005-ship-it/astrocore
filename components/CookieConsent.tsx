"use client";

/**
 * Cookie consent banner — Next.js App Router client component.
 *
 * WHERE TO PUT THIS FILE:
 *   components/CookieConsent.tsx
 *
 * HOW TO WIRE IT UP:
 *   In app/layout.tsx, import and render it once, right after {children}:
 *
 *     import CookieConsent from "@/components/CookieConsent";
 *     ...
 *     <body>
 *       {children}
 *       <CookieConsent />
 *     </body>
 *
 *   That's it — it renders on every page since layout.tsx wraps the whole app.
 *
 * REOPENING SETTINGS LATER (e.g. a "Cookie Settings" link in your footer/Sidebar):
 *
 *     import { openCookieSettings } from "@/components/CookieConsent";
 *     <button onClick={openCookieSettings}>Cookie Settings</button>
 *
 * GATING ANALYTICS (e.g. inside a GoogleAnalytics.tsx component):
 *
 *     import { onConsent } from "@/components/CookieConsent";
 *     useEffect(() => {
 *       onConsent("analytics", () => {
 *         // load GA / gtag script here
 *       });
 *     }, []);
 */

import { useEffect, useState } from "react";

type Consent = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
};

const COOKIE_NAME = "astcor_cookie_consent";
const COOKIE_MAX_AGE_DAYS = 180;

type Listener = (consent: Consent) => void;
const listeners: Listener[] = [];

// Module-level so it works even before/outside React render (SSR-safe: only touches document in browser).
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[2]) : null;
}

function setCookie(name: string, value: string, days: number) {
  const expires = new Date(Date.now() + days * 864e5).toUTCString();
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
}

function readConsent(): Consent | null {
  const raw = getCookie(COOKIE_NAME);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Consent;
  } catch {
    return null;
  }
}

function writeConsent(consent: Consent) {
  setCookie(COOKIE_NAME, JSON.stringify(consent), COOKIE_MAX_AGE_DAYS);
  listeners.forEach((fn) => fn(consent));
}

/** Run `callback` when `category` is allowed — now if already consented, and again if the visitor changes preference later. */
export function onConsent(category: "analytics" | "marketing", callback: () => void) {
  const current = readConsent();
  if (current && current[category]) callback();
  listeners.push((consent) => {
    if (consent[category]) callback();
  });
}

// Lets any component (e.g. a footer link) reopen the settings modal.
let externalOpenSettings: (() => void) | null = null;
export function openCookieSettings() {
  externalOpenSettings?.();
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    if (!readConsent()) setVisible(true);
    externalOpenSettings = () => {
      const current = readConsent();
      setAnalytics(!!current?.analytics);
      setMarketing(!!current?.marketing);
      setModalOpen(true);
    };
    return () => {
      externalOpenSettings = null;
    };
  }, []);

  const acceptAll = () => {
    writeConsent({ necessary: true, analytics: true, marketing: true });
    setVisible(false);
  };

  const rejectAll = () => {
    writeConsent({ necessary: true, analytics: false, marketing: false });
    setVisible(false);
  };

  const openSettings = () => {
    const current = readConsent();
    setAnalytics(!!current?.analytics);
    setMarketing(!!current?.marketing);
    setModalOpen(true);
  };

  const saveSettings = () => {
    writeConsent({ necessary: true, analytics, marketing });
    setModalOpen(false);
    setVisible(false);
  };

  return (
    <>
      {visible && (
        <div
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 9999,
            width: 260,
            background: "#09090C",
            color: "#EAE6FF",
            padding: "12px 14px",
            borderRadius: 10,
            border: "0.5px solid rgba(232,0,42,0.28)",
            boxShadow: "0 4px 24px rgba(0,0,0,0.5), 0 0 0 0.5px rgba(232,0,42,0.06)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12.5, lineHeight: 1.4, color: "#AEAACF" }}>
              Ми використовуємо cookies.{" "}
              <a href="/privacy-policy" target="_blank" rel="noopener" style={{ color: "#E8002A" }}>
                Детальніше
              </a>
            </p>
            <button
              onClick={rejectAll}
              aria-label="Закрити"
              style={{
                background: "none",
                border: "none",
                color: "#666677",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: 0,
                flexShrink: 0,
              }}
            >
              ×
            </button>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            <button onClick={openSettings} style={btnGhostSmall}>
              Налаштування
            </button>
            <button onClick={acceptAll} style={btnPrimarySmall}>
              Прийняти
            </button>
          </div>
        </div>
      )}

      {modalOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#111116",
              color: "#EAE6FF",
              borderRadius: 12,
              maxWidth: 480,
              width: "90%",
              padding: 24,
              border: "0.5px solid rgba(232,0,42,0.2)",
              boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
            }}
          >
            <h3 style={{ marginTop: 0 }}>Налаштування cookies</h3>

            <CatRow
              title="Необхідні"
              desc="Потрібні для входу, безпеки та роботи сайту. Завжди увімкнені."
              checked
              disabled
            />
            <CatRow
              title="Аналітика"
              desc="Допомагає розуміти, як відвідувачі користуються сайтом."
              checked={analytics}
              onChange={setAnalytics}
            />
            <CatRow
              title="Маркетинг"
              desc="Використовується для оцінки ефективності реклами."
              checked={marketing}
              onChange={setMarketing}
            />

            <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button onClick={() => setModalOpen(false)} style={btnSecondary}>
                Скасувати
              </button>
              <button onClick={saveSettings} style={btnPrimary}>
                Зберегти
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CatRow({
  title,
  desc,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  desc: string;
  checked: boolean;
  disabled?: boolean;
  onChange?: (v: boolean) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-start",
        gap: 12,
        padding: "12px 0",
        borderBottom: "0.5px solid rgba(255,255,255,0.07)",
      }}
    >
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, color: "#EAE6FF" }}>{title}</div>
        <div style={{ fontSize: 13, color: "#888899", marginTop: 2 }}>{desc}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
    </div>
  );
}

const btnPrimary: React.CSSProperties = {
  background: "#E8002A",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  padding: "10px 16px",
  fontSize: 14,
  cursor: "pointer",
  fontWeight: 600,
};
const btnSecondary: React.CSSProperties = {
  ...btnPrimary,
  background: "transparent",
  color: "#EAE6FF",
  border: "0.5px solid rgba(255,255,255,0.2)",
};
const btnGhost: React.CSSProperties = {
  ...btnPrimary,
  background: "transparent",
  color: "#888899",
  textDecoration: "underline",
  padding: "10px 4px",
};

const btnPrimarySmall: React.CSSProperties = {
  background: "#E8002A",
  color: "#fff",
  border: "none",
  borderRadius: 6,
  padding: "6px 10px",
  fontSize: 12,
  cursor: "pointer",
  fontWeight: 600,
  flex: 1,
};
const btnGhostSmall: React.CSSProperties = {
  ...btnPrimarySmall,
  background: "transparent",
  color: "#888899",
  border: "0.5px solid rgba(255,255,255,0.15)",
};