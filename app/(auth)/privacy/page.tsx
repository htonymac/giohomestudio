// GioHomeStudio — Privacy Policy v2.0 (2026-04-26)
import { ds } from "../../../lib/designSystem";

const h2Style: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: ds.color.ink,
  marginTop: 28,
  marginBottom: 8,
  fontFamily: ds.font.sans,
  letterSpacing: "-0.01em",
};

const pStyle: React.CSSProperties = {
  fontSize: 13,
  color: ds.color.ink2,
  lineHeight: 1.8,
  marginBottom: 10,
  fontFamily: ds.font.sans,
};

export default function PrivacyPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: ds.color.paper,
        fontFamily: ds.font.sans,
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <a
          href="/"
          style={{
            fontSize: 12,
            color: ds.color.lilac,
            textDecoration: "none",
            fontFamily: ds.font.mono,
          }}
        >
          &larr; Back to GioHomeStudio
        </a>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 800,
            color: ds.color.ink,
            marginTop: 20,
            marginBottom: 6,
            letterSpacing: "-0.03em",
            fontFamily: ds.font.sans,
          }}
        >
          Privacy Policy
        </h1>
        <p
          style={{
            fontSize: 12,
            color: ds.color.mute2,
            marginBottom: 36,
            fontFamily: ds.font.mono,
          }}
        >
          Version 2.0 &middot; Effective Date: 2026-04-26
        </p>

        <div
          style={{
            background: ds.color.alert,
            border: `1px solid ${ds.color.line2}`,
            borderRadius: ds.radius.sm,
            padding: "12px 16px",
            marginBottom: 28,
          }}
        >
          <p style={{ ...pStyle, marginBottom: 0, color: ds.color.mute, fontSize: 12 }}>
            This document is a product legal draft and is not a substitute for advice from a qualified lawyer.
            Contact: legal@giohomestudio.com — Jurisdiction: Federal Republic of Nigeria.
          </p>
        </div>

        <h2 style={h2Style}>1. Introduction</h2>
        <p style={pStyle}>GioHomeStudio is committed to protecting the privacy of its users. This Privacy Policy explains what personal data we collect, why we collect it, how we use it, who we share it with, and your rights over it. It is drafted in compliance with the Nigeria Data Protection Act (NDPA) 2023, the NDPR 2019, and, where applicable, the EU GDPR.</p>

        <h2 style={h2Style}>2. Data We Collect</h2>
        <p style={pStyle}>Account data: your name, email, and profile image (if using Google sign-in). Usage data: media you upload, content you create, prompts you enter, generation logs, and settings. Technical data: IP address, browser/device info, session tokens, and error logs for security and operations.</p>

        <h2 style={h2Style}>3. How We Use Your Data</h2>
        <p style={pStyle}>To operate and deliver the platform, including AI generation, project storage, and social account publishing. To maintain security and prevent fraud. To respond to legal obligations, support requests, or abuse reports. We do not sell your data to third parties.</p>

        <h2 style={h2Style}>4. AI Processing</h2>
        <p style={pStyle}>Your prompts, uploaded media, and instructions may be transmitted to third-party AI providers (including Anthropic Claude, FAL.ai, ElevenLabs, Kie.ai, Runway, and others) to generate content. These providers process your data under their own privacy policies and, where applicable, data processing agreements.</p>

        <h2 style={h2Style}>5. Legal Consent Record</h2>
        <p style={pStyle}>When you register and accept our legal policies, we record a timestamped consent entry including the policy version, date of acceptance, your IP address (for compliance), and your browser/device user-agent. This record is retained for legal compliance purposes.</p>

        <h2 style={h2Style}>6. Connected Accounts</h2>
        <p style={pStyle}>When you connect social media accounts (YouTube, Instagram, TikTok, Facebook, X, and others), we store secure access tokens to post on your behalf. We never store your social media passwords. You can disconnect any account at any time from your account settings.</p>

        <h2 style={h2Style}>7. Data Storage and Security</h2>
        <p style={pStyle}>Your data is stored in secure databases using industry-standard security measures. Media files are stored on platform servers. We implement access controls, encryption, and audit logging for sensitive operations.</p>

        <h2 style={h2Style}>8. Data Retention</h2>
        <p style={pStyle}>Your content and account data is retained while your account is active. You may request deletion at any time. GioHomeStudio may retain limited records for legal compliance, fraud controls, or claim defence even after account closure.</p>

        <h2 style={h2Style}>9. Your Rights</h2>
        <p style={pStyle}>You have the right to access, correct, or delete your personal data. You may export your content. You may withdraw consent by closing your account. To exercise these rights, contact legal@giohomestudio.com.</p>

        <h2 style={h2Style}>10. Cookies and Local Storage</h2>
        <p style={pStyle}>We use essential cookies for authentication and session management. See our Cookies Policy for full details. No third-party tracking or advertising cookies are used.</p>

        <h2 style={h2Style}>11. Children</h2>
        <p style={pStyle}>The platform is not intended for users under 13 years of age. We do not knowingly collect personal data from children under 13. Users aged 13–17 require verified parental consent.</p>

        <h2 style={h2Style}>12. Changes to This Policy</h2>
        <p style={pStyle}>We will notify registered users of material changes 30 days in advance. Continued use after the effective date constitutes acceptance.</p>

        <h2 style={h2Style}>13. Contact</h2>
        <p style={pStyle}>Privacy questions or data requests: legal@giohomestudio.com</p>

        <h2 style={h2Style}>14. Governing Law</h2>
        <p style={pStyle}>This policy is governed by the Nigeria Data Protection Act (NDPA) 2023 and applicable Nigerian law.</p>

        <div
          style={{
            borderTop: `1px solid ${ds.color.line}`,
            marginTop: 40,
            paddingTop: 16,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: ds.color.mute2,
              lineHeight: 1.8,
              fontFamily: ds.font.mono,
            }}
          >
            GioHomeStudio respects your privacy. Your data is used to operate the service, not sold to third parties.
          </p>
        </div>
      </div>
    </div>
  );
}
