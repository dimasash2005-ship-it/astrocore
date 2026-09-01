/**
 * WHERE TO PUT THIS FILE:
 *   app/privacy-policy/page.tsx
 *
 * This makes the policy available at: yourdomain.com/privacy-policy
 * (matches the link used inside CookieConsent.tsx)
 *
 * Content below is copied from privacy-policy.md — edit the [BRACKETED]
 * placeholders with your real company details before publishing.
 * Adjust the className props if your project uses Tailwind/shadcn (components.json
 * in your repo suggests it does) — swap `style={{...}}` for utility classes as needed.
 */

export const metadata = {
    title: "Privacy Policy",
    description: "How Astcor collects, uses, and protects your personal data.",
  };
  
  export default function PrivacyPolicyPage() {
    return (
      <main style={{ maxWidth: 780, margin: "0 auto", padding: "48px 24px", lineHeight: 1.6 }}>
        <h1>Privacy Policy</h1>
        <p style={{ color: "#666" }}>
          <em>Last updated: [DATE]</em>
        </p>
  
        <h2>1. Who We Are</h2>
        <p>
          This Privacy Policy explains how <strong>AstroCore</strong> ("we," "us," or "our"),
          [operated by legal entity / FOP name — fill in once registered],
          collects, uses, discloses, and protects personal information when you use our website
          and AI workspace platform (the "Service"). Contact us at{" "}
          <strong>gbtauent21@outlook.com</strong> or via{" "}
          <a href="https://t.me/AstroCore_Manager" target="_blank" rel="noopener">
            Telegram
          </a>
          .
        </p>
  
        <h2>2. Information We Collect</h2>
        <h3>2.1 Information You Provide</h3>
        <ul>
          <li>Account information: name, email, hashed password, company name</li>
          <li>Contact form data: name, email, message content</li>
          <li>Payment information: billing name/address, last 4 digits of card, transaction history</li>
          <li>Support communications</li>
        </ul>
        <p>We do not store full card numbers — payments are processed by a third-party processor.</p>
  
        <h3>2.2 Information Collected Automatically</h3>
        <ul>
          <li>Device &amp; usage data: IP address, browser, OS, pages visited</li>
          <li>Cookies (see Section 4 and our cookie settings tool)</li>
          <li>Analytics data via [Google Analytics / other tool]</li>
        </ul>
  
        <h2>3. How We Use Your Information</h2>
        <ul>
          <li>Provide and maintain the Service, including your account</li>
          <li>Process payments and manage subscriptions</li>
          <li>Respond to support and contact requests</li>
          <li>Send transactional emails and, if opted in, marketing emails</li>
          <li>Improve the Service via analytics</li>
          <li>Detect and prevent fraud or abuse</li>
          <li>Comply with legal obligations</li>
        </ul>
  
        <h2>4. Cookies</h2>
        <p>
          We use strictly necessary cookies (login, security), analytics cookies, and — if
          applicable — marketing cookies. You can manage these anytime via Cookie Settings.
        </p>
  
        <h2>5. How We Share Your Information</h2>
        <p>We do not sell your personal information. We share it only with:</p>
        <ul>
          <li>Payment processor: [e.g., Stripe]</li>
          <li>Hosting: [e.g., AWS/Google Cloud]</li>
          <li>Analytics: [e.g., Google Analytics]</li>
          <li>Email delivery: [e.g., SendGrid/Postmark]</li>
          <li>Legal authorities, where required by law</li>
        </ul>
  
        <h2>6. International Data Transfers</h2>
        <p>
          Data may be transferred to and processed in countries other than your own, including the
          United States. Transfers of EU/EEA/UK data rely on Standard Contractual Clauses or an
          equivalent safeguard.
        </p>
  
        <h2>7. Data Retention</h2>
        <p>
          We retain personal data as long as your account is active or as needed to provide the
          Service and meet legal obligations, then delete or anonymize it.
        </p>
  
        <h2>8. Your Privacy Rights</h2>
        <h3>8.1 EU / EEA / UK / Switzerland (GDPR)</h3>
        <p>
          You may access, rectify, erase, restrict, or object to processing of your data, request
          portability, withdraw consent, and lodge a complaint with your local supervisory
          authority.
        </p>
  
        <h3>8.2 California Residents (CCPA/CPRA)</h3>
        <p>
          You may know, delete, and correct your personal information, opt out of "sale/sharing"
          (we do not sell or share data), limit use of sensitive personal information, and will not
          be discriminated against for exercising these rights.
        </p>
        <p>
          To exercise any right, email <strong>gbtauent21@outlook.com</strong>. We may verify your
          identity first.
        </p>
  
        <h2>9. Data Security</h2>
        <p>
          We use encryption in transit, access controls, and hashed passwords, though no method is
          100% secure.
        </p>
  
        <h2>10. Children's Privacy</h2>
        <p>The Service is not directed to children under 16.</p>
  
        <h2>11. Third-Party Links</h2>
        <p>We are not responsible for the privacy practices of linked third-party sites.</p>
  
        <h2>12. Changes to This Policy</h2>
        <p>We will update the "Last updated" date and, where required, notify you of material changes.</p>
  
        <h2>13. Contact Us</h2>
        <p>
          AstroCore
          <br />
          [Registered legal address — add once you register as FOP / a legal entity]
          <br />
          Email: gbtauent21@outlook.com
          <br />
          Telegram: @AstroCore_Manager
        </p>
      </main>
    );
  }