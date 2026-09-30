// Куди вставити: app/terms/page.tsx
// (якщо в проєкті є папка src — то src/app/terms/page.tsx)
// Сторінка відкриватиметься за адресою https://astrocore.one/terms

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — AstroCore AI",
  description: "The rules for using AstroCore AI.",
};

const CONTACT_EMAIL = "astrocore.one@outlook.cz";
// TODO: впиши своє повне ім'я
const OPERATOR_NAME = "[Your full name]";
const LAST_UPDATED = "30 September 2026";

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 leading-relaxed">
      <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
      <p className="opacity-70 mb-8">Last updated: {LAST_UPDATED}</p>

      <Section title="1. About these terms">
        <p>
          These terms govern your use of AstroCore AI (&quot;AstroCore&quot;, &quot;the
          service&quot;), a workspace for AI agents available at astrocore.one, operated by{" "}
          {OPERATOR_NAME}, Czech Republic. By creating an account or using the service, you
          agree to these terms and to our{" "}
          <a className="underline" href="/privacy-policy">Privacy Policy</a>.
        </p>
      </Section>

      <Section title="2. Your account">
        <ul className="list-disc pl-6 space-y-2">
          <li>You must be at least 16 years old to use AstroCore.</li>
          <li>You are responsible for keeping your sign-in account secure and for all activity under your account.</li>
          <li>Tell us right away at {CONTACT_EMAIL} if you suspect unauthorised access.</li>
        </ul>
      </Section>

      <Section title="3. The service and pricing">
        <p>
          AstroCore is currently provided free of charge and is still in active development.
          Features may be added, changed or removed. We plan to introduce paid plans in the
          future; before any charge applies to you, we will clearly announce the prices and
          conditions, and you will be able to choose whether to continue.
        </p>
      </Section>

      <Section title="4. Your content and API keys">
        <ul className="list-disc pl-6 space-y-2">
          <li>
            You keep all rights to the content you create or upload (chats, agents, reports,
            files, etc.). You give us only the permission needed to store, process and display
            it in order to run the service for you.
          </li>
          <li>
            If you connect your own AI provider API keys, you are responsible for the usage
            and costs on those providers, and for following their terms.
          </li>
          <li>You are responsible for having the right to use any content you upload.</li>
        </ul>
      </Section>

      <Section title="5. Acceptable use">
        <p>You agree not to use AstroCore to:</p>
        <ul className="list-disc pl-6 space-y-1">
          <li>break any law or violate the rights of others;</li>
          <li>create or spread malware, spam, phishing or fraud;</li>
          <li>harass, threaten or harm people;</li>
          <li>attack, overload or try to gain unauthorised access to the service or other systems;</li>
          <li>violate the usage policies of the AI providers you use through the platform;</li>
          <li>resell or copy the service without our permission.</li>
        </ul>
        <p>We may suspend or close accounts that break these rules.</p>
      </Section>

      <Section title="6. AI output">
        <p>
          Agents and chats generate content using third-party AI models. AI output can be
          inaccurate, incomplete or outdated. You are responsible for checking results before
          relying on them, especially for legal, financial, medical or other important
          decisions.
        </p>
      </Section>

      <Section title="7. Our platform">
        <p>
          The AstroCore name, logo, design and software belong to {OPERATOR_NAME}. These terms
          do not give you any rights to them except to use the service as intended.
        </p>
      </Section>

      <Section title="8. Availability and liability">
        <p>
          The service is provided &quot;as is&quot; and &quot;as available&quot;. We do our
          best to keep it running and your data safe, but we cannot guarantee it will always
          be uninterrupted or error-free. Please keep your own copies of important content.
        </p>
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential
          losses, or for loss of data or profits, arising from your use of the service. Nothing
          in these terms limits rights you have as a consumer that cannot be limited by law.
        </p>
      </Section>

      <Section title="9. Ending use">
        <p>
          You can stop using AstroCore and ask us to delete your account at any time by
          emailing {CONTACT_EMAIL}. We may end or suspend access if you seriously or
          repeatedly break these terms, or if we discontinue the service, in which case we will
          try to give reasonable notice.
        </p>
      </Section>

      <Section title="10. Changes to these terms">
        <p>
          We may update these terms as the platform grows (for example when paid plans are
          introduced). We will notify you of significant changes in the app or by email.
          Continuing to use the service after changes take effect means you accept them.
        </p>
      </Section>

      <Section title="11. Law and contact">
        <p>
          These terms are governed by the laws of the Czech Republic, without taking away any
          mandatory consumer protection you have in your own country. Questions:{" "}
          <a className="underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
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