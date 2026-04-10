// GioHomeStudio — Privacy Policy
export default function PrivacyPage() {
  const h2: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: "#e0e0f0", marginTop: 28, marginBottom: 8 };
  const p: React.CSSProperties = { fontSize: 13, color: "#8080b0", lineHeight: 1.8, marginBottom: 10 };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "40px 24px" }}>
      <a href="/" style={{ fontSize: 12, color: "#7c5cfc", textDecoration: "none" }}>&larr; Back to GioHomeStudio</a>

      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#fff", marginTop: 20, marginBottom: 6 }}>
        Privacy Policy
      </h1>
      <p style={{ fontSize: 12, color: "#404060", marginBottom: 32 }}>Version 1.0</p>

      <h2 style={h2}>1. What We Collect</h2>
      <p style={p}>When you create an account, we collect your name, email address, and profile image (if signing in with Google). When you use the platform, we store the media you upload, content you create, and settings you configure.</p>

      <h2 style={h2}>2. How We Use Your Data</h2>
      <p style={p}>Your data is used to operate the platform: creating content, storing your projects, connecting your social accounts, and improving the service. We do not sell your data to third parties.</p>

      <h2 style={h2}>3. AI Processing</h2>
      <p style={p}>Your prompts, uploaded media, and instructions may be sent to third-party AI services (such as image generation or voice synthesis providers) to create content. These providers process your data according to their own privacy policies.</p>

      <h2 style={h2}>4. Connected Accounts</h2>
      <p style={p}>When you connect social media accounts, we store secure access tokens to post on your behalf. We never store your social media passwords. You can disconnect accounts at any time.</p>

      <h2 style={h2}>5. Data Storage</h2>
      <p style={p}>Your data is stored in secure databases. Media files are stored on our servers. We use industry-standard security measures to protect your information.</p>

      <h2 style={h2}>6. Data Retention</h2>
      <p style={p}>Your content and account data is retained while your account is active. You can request deletion of your account and data at any time. We may retain limited records for legal compliance or abuse prevention.</p>

      <h2 style={h2}>7. Your Rights</h2>
      <p style={p}>You have the right to access, correct, or delete your personal data. You can export your content. You can withdraw consent for data processing at any time by closing your account.</p>

      <h2 style={h2}>8. Cookies</h2>
      <p style={p}>We use essential cookies for authentication and session management. No third-party tracking cookies are used.</p>

      <h2 style={h2}>9. Children</h2>
      <p style={p}>The platform is not intended for users under 18 years of age. We do not knowingly collect data from minors.</p>

      <h2 style={h2}>10. Contact</h2>
      <p style={p}>For privacy-related questions or data requests, contact us at the email provided on your account settings page.</p>

      <h2 style={h2}>11. Applicable Law</h2>
      <p style={p}>This policy is governed by the Nigeria Data Protection Act (NDPA) 2023 and applicable Nigerian law.</p>

      <div style={{ borderTop: "1px solid #1e1e30", marginTop: 40, paddingTop: 16 }}>
        <p style={{ fontSize: 11, color: "#303050", lineHeight: 1.8 }}>
          GioHomeStudio respects your privacy. Your data is used to operate the service, not sold to third parties.
        </p>
      </div>
    </div>
  );
}
