// GioHomeStudio — Privacy Policy
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
          Version 1.0
        </p>

        <h2 style={h2Style}>1. What We Collect</h2>
        <p style={pStyle}>When you create an account, we collect your name, email address, and profile image (if signing in with Google). When you use the platform, we store the media you upload, content you create, and settings you configure.</p>

        <h2 style={h2Style}>2. How We Use Your Data</h2>
        <p style={pStyle}>Your data is used to operate the platform: creating content, storing your projects, connecting your social accounts, and improving the service. We do not sell your data to third parties.</p>

        <h2 style={h2Style}>3. AI Processing</h2>
        <p style={pStyle}>Your prompts, uploaded media, and instructions may be sent to third-party AI services (such as image generation or voice synthesis providers) to create content. These providers process your data according to their own privacy policies.</p>

        <h2 style={h2Style}>4. Connected Accounts</h2>
        <p style={pStyle}>When you connect social media accounts, we store secure access tokens to post on your behalf. We never store your social media passwords. You can disconnect accounts at any time.</p>

        <h2 style={h2Style}>5. Data Storage</h2>
        <p style={pStyle}>Your data is stored in secure databases. Media files are stored on our servers. We use industry-standard security measures to protect your information.</p>

        <h2 style={h2Style}>6. Data Retention</h2>
        <p style={pStyle}>Your content and account data is retained while your account is active. You can request deletion of your account and data at any time. We may retain limited records for legal compliance or abuse prevention.</p>

        <h2 style={h2Style}>7. Your Rights</h2>
        <p style={pStyle}>You have the right to access, correct, or delete your personal data. You can export your content. You can withdraw consent for data processing at any time by closing your account.</p>

        <h2 style={h2Style}>8. Cookies</h2>
        <p style={pStyle}>We use essential cookies for authentication and session management. No third-party tracking cookies are used.</p>

        <h2 style={h2Style}>9. Children</h2>
        <p style={pStyle}>The platform is not intended for users under 18 years of age. We do not knowingly collect data from minors.</p>

        <h2 style={h2Style}>10. Contact</h2>
        <p style={pStyle}>For privacy-related questions or data requests, contact us at the email provided on your account settings page.</p>

        <h2 style={h2Style}>11. Applicable Law</h2>
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
