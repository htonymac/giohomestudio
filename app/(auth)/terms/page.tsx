// GioHomeStudio — Terms of Use v2.0 (2026-04-26)
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

const liStyle: React.CSSProperties = {
  fontSize: 13,
  color: ds.color.ink2,
  lineHeight: 1.8,
  marginBottom: 6,
  fontFamily: ds.font.sans,
};

export default function TermsPage() {
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
          Terms of Use
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

        <h2 style={h2Style}>1. Platform Identity and Nature</h2>
        <p style={pStyle}>GioHomeStudio (also known as "GHS Auto Creator") is an AI-assisted content creation and publishing platform. It uses third-party AI systems — including but not limited to Anthropic Claude, FAL.ai, Kie.ai, Runway, ElevenLabs, MuAPI, Segmind, and Suno — to produce video, audio, image, and text content based on instructions you enter.</p>
        <p style={pStyle}>The platform is designed as an assisted publishing system, not an autonomous publisher. AI-generated output is inherently probabilistic and may be inaccurate, misleading, or otherwise unsuitable for publication.</p>

        <h2 style={h2Style}>2. You Are the Publisher of Record</h2>
        <p style={pStyle}>When you approve content for publication through this platform, you are the publisher of record for every piece of content you approve and distribute. This is a non-negotiable, foundational position of these Terms.</p>
        <p style={pStyle}>Your responsibilities include reviewing all final content before publication, confirming it is accurate, appropriate, and lawful, and ensuring it does not violate any third-party rights or platform policies. Approving content is a deliberate editorial act equivalent to writing and signing off on that content yourself.</p>
        <p style={pStyle}>The platform shall not publicly post content without a clear human approval action. No draft or generated asset is publication-ready until you have reviewed and affirmatively approved it.</p>

        <h2 style={h2Style}>3. Eligibility</h2>
        <p style={pStyle}>You must be at least 18 years of age to use this platform. Users aged 13–17 may only access the platform with verifiable parental consent and are prohibited from using monetisation features. Users under 13 are strictly prohibited.</p>
        <p style={pStyle}>You agree to provide accurate registration information and are responsible for all activity under your account.</p>

        <h2 style={h2Style}>4. Acceptable Use</h2>
        <p style={pStyle}>You must not use the platform to create, generate, or publish content that is defamatory, fraudulent, deceptive, infringing, sexually exploitative of minors, promoting violence or hatred, or that facilitates impersonation or identity theft. Full prohibited conduct is set out in the Acceptable Use Policy.</p>

        <h2 style={h2Style}>5. Content Ownership and Licensing</h2>
        <p style={pStyle}>You retain all intellectual property rights in materials you upload. You grant GioHomeStudio a limited, non-exclusive, royalty-free licence to host, process, and display your content solely to operate the platform. This licence terminates when you delete the content or close your account.</p>
        <p style={pStyle}>GioHomeStudio does not claim ownership over AI-generated outputs produced from your instructions. As between you and GioHomeStudio, generated outputs are yours subject to applicable law, third-party AI provider terms, and source material rights.</p>

        <h2 style={h2Style}>6. Subscriptions, Credits, and Refunds</h2>
        <p style={pStyle}>Finance Phase 2 (full payment integration) is not yet live. When billing launches: credits are consumed only after you approve a generation or publish action. Consumed credits are non-refundable once generation has commenced. Contact legal@giohomestudio.com within 14 days for billing errors.</p>

        <h2 style={h2Style}>7. Voice, Likeness, and Identity</h2>
        <p style={pStyle}>You must not use the platform to clone, imitate, or commercially exploit the likeness, face, voice, or identity of any real person without lawful authorisation. Voice cloning requires either your own voice or explicit written consent from the voice owner. Prohibited: impersonation, fake endorsements, sexualised content without consent, deepfakes without consent.</p>

        <h2 style={h2Style}>8. Indemnification</h2>
        <p style={pStyle}>You agree to defend, indemnify, and hold harmless GioHomeStudio from all claims, liabilities, and legal fees arising from your content, instructions, publication decisions, breach of these Terms, or infringement of any third-party right.</p>

        <h2 style={h2Style}>9. Limitation of Liability</h2>
        <p style={pStyle}>To the fullest extent permitted by Nigerian law, GioHomeStudio is not liable for indirect, consequential, or punitive damages, or for content you approve and publish. Where liability cannot be excluded, it is limited to amounts you paid in the three months preceding the event.</p>

        <h2 style={h2Style}>10. Data Retention</h2>
        <p style={pStyle}>GioHomeStudio may retain limited records even after deletion for legal compliance, fraud controls, or claims defence. See the Privacy Policy for full details.</p>

        <h2 style={h2Style}>11. Platform Connections</h2>
        <p style={pStyle}>When you connect social accounts, you authorise GioHomeStudio to act on your behalf only after your explicit approval of each item. No passwords are stored. You can disconnect at any time.</p>

        <h2 style={h2Style}>12. Disclaimers</h2>
        <p style={pStyle}>Platform provided as-is. We do not warrant that generation results will be accurate or accepted by destination platforms, or that services will be uninterrupted.</p>

        <h2 style={h2Style}>13. Modifications</h2>
        <p style={pStyle}>We may modify these Terms with 30 days' notice to registered users. Continued use after the effective date constitutes acceptance.</p>

        <h2 style={h2Style}>14. Governing Law</h2>
        <p style={pStyle}>These Terms are governed by the laws of the Federal Republic of Nigeria. Disputes are subject to the exclusive jurisdiction of the Federal High Court of Nigeria.</p>

        <h2 style={h2Style}>15. Contact</h2>
        <p style={pStyle}>Questions: legal@giohomestudio.com</p>

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
            AI-assisted content. Human approval required before posting. You are responsible for content you approve and publish.
          </p>
        </div>
      </div>
    </div>
  );
}
