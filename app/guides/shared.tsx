import Link from "next/link";
// Куди: app/guides/shared.tsx
// Спільна шапка, футер і формат дати для сторінок гайдів.

export function GuidesNav() {
  return (
    <nav className="g-nav">
      <div className="g-wrap g-nav-in">
        <Link href="/" className="g-brand"><span className="g-mark">A</span>Astro<em>Core</em></Link>
        <Link href="/guides" className="g-link">Guides</Link>
        <div className="g-nav-cta">
          <Link href="/login" className="g-link">Sign in</Link>
          <Link href="/register" className="g-btn">Start free</Link>
        </div>
      </div>
    </nav>
  );
}

export function GuidesFooter() {
  return (
    <footer className="g-foot">
      <div className="g-wrap g-foot-in">
        <span>© 2026 AstroCore AI</span>
        <Link href="/">Home</Link><Link href="/guides">Guides</Link><Link href="/terms">Terms</Link><Link href="/privacy-policy">Privacy</Link>
        <a href="https://t.me/AstroCore_Manager" target="_blank" rel="noopener">Telegram</a>
      </div>
    </footer>
  );
}

export function formatDate(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}