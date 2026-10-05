// Куди вставити: app/privacy-policy/page.tsx
// ЗАМІНИ весь старий вміст цього файлу на цей код.
// Сторінка відкривається за адресою https://astrocore.one/privacy-policy
// (саме на неї веде посилання з CookieConsent.tsx)

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — AstroCore AI",
  description: "How AstroCore AI collects, uses and protects your data.",
  robots: { index: false, follow: true },
};

const CONTACT_EMAIL = "astrocore.one@outlook.cz";
// TODO: впиши своє повне ім'я — за GDPR має бути вказано, хто відповідає за дані
const OPERATOR_NAME = "[Your full name]";
const LAST_UPDATED = "30 September 2026";

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
      <p className="opacity-70 mb-8">Last updated: {LAST_UPDATED}</p>

      <Section title="1. Who we are">
        <p>
          AstroCore AI (&quot;AstroCore&quot;, &quot;we&quot;, &quot;us&quot;) is a workspace
          for AI agents available at astrocore.one. It is operated by {OPERATOR_NAME}, an
          individual based in the Czech Republic, who acts as the data controller for the
          personal data described in this policy.
        </p>
        <p>
          Contact for any privacy question or request:{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or
          Telegram{" "}
          <a className="underline" href="https://t.me/AstroCore_Manager" target="_blank" rel="noopener">
            @AstroCore_Manager
          </a>
        </p>
      </Section>

      <Section title="2. What data we collect">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <b>Account data:</b> when you sign in (for example with GitHub), we receive your
            name, username, email address and profile picture.
          </li>
          <li>
            <b>Content you create:</b> chats, agents, memory entries, reports, files in
            Storage and Gallery, forum posts, settings and anything else you enter into the
            platform.
          </li>
          <li>
            <b>Provider API keys:</b> if you connect your own AI provider keys, we store
            them encrypted and use them only to send your requests to that provider.
          </li>
          <li>
            <b>Technical data:</b> IP address, browser and device type, logs and basic usage
            and performance statistics needed to run and secure the service.
          </li>
          <li>
            <b>Analytics data:</b> if you allow analytics cookies, Google Analytics collects
            information about how you use the site (pages visited, approximate location,
            device and browser) so we can improve AstroCore.
          </li>
        </ul>
      </Section>

      <Section title="3. Why we use it (legal basis)">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            <b>To provide the service</b> — create your account, run your agents, store your
            content (performance of a contract, GDPR Art. 6(1)(b)).
          </li>
          <li>
            <b>To keep the platform secure and working</b> — prevent abuse and fix bugs
            (legitimate interest, Art. 6(1)(f)).
          </li>
          <li>
            <b>To understand how the site is used</b> through Google Analytics — only if you
            accept analytics cookies (consent, Art. 6(1)(a)).
          </li>
          <li>
            <b>To contact you</b> about important changes to the service or these terms
            (legitimate interest / contract).
          </li>
          <li>
            <b>To meet legal obligations</b>, including future billing and accounting once
            paid plans are introduced (Art. 6(1)(c)).
          </li>
        </ul>
        <p>We do not sell your personal data and do not use it for advertising.</p>
      </Section>

      <Section title="4. AI providers">
        <p>
          When you use an agent or chat, the content of your request is sent to the AI
          provider you selected (for example Anthropic, OpenAI or others) so it can generate
          a response. That provider processes your data under its own terms and privacy
          policy. Please do not submit sensitive personal data (health, financial, ID
          numbers, etc.) unless you are comfortable with it being processed by that provider.
        </p>
      </Section>

      <Section title="5. Service providers we use">
        <ul className="list-disc pl-6 space-y-2">
          <li><b>Vercel</b> — hosting, domain and performance analytics.</li>
          <li><b>Supabase</b> — database, authentication and file storage.</li>
          <li><b>GitHub</b> — sign-in (OAuth).</li>
          <li><b>Google Analytics</b> (Google Ireland Ltd.) — website usage statistics, only with your consent.</li>
          <li><b>The AI providers</b> you connect (see section 4).</li>
        </ul>
        <p>
          Some of these providers are located in the United States. Where data is transferred
          outside the EU/EEA, it is protected by the providers&apos; safeguards such as the
          EU Standard Contractual Clauses or the EU–US Data Privacy Framework.
        </p>
      </Section>

      <Section title="6. Cookies">
        <p>
          We use cookies that are strictly necessary for the platform to work, such as keeping
          you signed in. Analytics cookies from Google Analytics are used only if you
          allow them in the cookie banner, and you can change your choice at any time via
          Cookie Settings. We do not use advertising cookies.
        </p>
      </Section>

      <Section title="7. How long we keep data">
        <p>
          We keep your account and content while your account is active. If you delete your
          account or ask us to delete your data, we delete it within 30 days, except where we
          must keep certain records by law. Technical logs are kept only for a limited period.
        </p>
      </Section>

      <Section title="8. Your rights">
        <p>Under the GDPR you have the right to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>access the personal data we hold about you;</li>
          <li>correct inaccurate data;</li>
          <li>have your data deleted;</li>
          <li>receive your data in a portable format;</li>
          <li>object to or restrict certain processing;</li>
          <li>withdraw consent where processing is based on consent.</li>
        </ul>
        <p>
          To use any of these rights, email{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. You
          can also file a complaint with the Czech data protection authority, the Office for
          Personal Data Protection (ÚOOÚ, uoou.gov.cz), or the authority in your own country.
        </p>
      </Section>

      <Section title="9. Security">
        <p>
          We use encryption in transit (HTTPS), encrypt stored provider API keys and limit
          access to data. No system is 100% secure, so please use a strong password for your
          sign-in account and enable two-factor authentication.
        </p>
      </Section>

      <Section title="10. Children">
        <p>
          AstroCore is not intended for anyone under 16. We do not knowingly collect data
          from children.
        </p>
      </Section>

      <Section title="11. Changes">
        <p>
          We may update this policy as the platform grows. If changes are significant, we
          will notify you in the app or by email. The date at the top shows the latest
          version.
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8 space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}