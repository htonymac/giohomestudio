// GioHomeStudio — Acceptable Use Policy v1.0 (2026-04-26)
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
  marginLeft: 16,
};

export default function AcceptableUsePage() {
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
          Acceptable Use Policy
        </h1>
        <p
          style={{
            fontSize: 12,
            color: ds.color.mute2,
            marginBottom: 36,
            fontFamily: ds.font.mono,
          }}
        >
          Version 1.0 &middot; Effective Date: 2026-04-26
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

        <h2 style={h2Style}>1. Purpose</h2>
        <p style={pStyle}>This Acceptable Use Policy ("AUP") sets the standards of conduct required of all users of the GioHomeStudio platform. It forms part of the Terms of Use and is incorporated by reference. By using the platform, you agree to abide by this AUP in full.</p>
        <p style={pStyle}>GioHomeStudio is an AI-assisted content creation and publishing tool. The power of the platform to generate realistic media — including video, voice, and images of real people — creates a corresponding responsibility to use it ethically, lawfully, and without harm to others.</p>

        <h2 style={h2Style}>2. Absolute Prohibitions</h2>
        <p style={pStyle}>The following are absolutely prohibited at all times, regardless of intent, audience, or claimed artistic or satirical purpose:</p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          {[
            "Creating, uploading, generating, storing, or distributing child sexual abuse material (CSAM) or any sexually exploitative content involving minors",
            "Using the platform to facilitate terrorism, incitement to violence, or funding of terrorist organisations",
            "Generating content that constitutes non-consensual intimate imagery (NCII) or 'revenge porn'",
            "Using the platform to commit fraud or financial crime at scale",
            "Systematic impersonation of another person for deceptive purposes",
          ].map((item, i) => (
            <li key={i} style={liStyle}>{item}</li>
          ))}
        </ul>
        <p style={pStyle}>Violations of absolute prohibitions will result in immediate account termination, permanent ban, and referral to law enforcement where required by law.</p>

        <h2 style={h2Style}>3. Prohibited Content Categories</h2>
        <p style={pStyle}>You must not use the platform to create or distribute content that:</p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          {[
            "Is defamatory or knowingly false about a real person or entity",
            "Infringes copyright, trademark, privacy, publicity, or any other intellectual property right",
            "Promotes or glorifies violence, terrorism, or criminal conduct",
            "Incites hatred or discrimination based on race, ethnicity, religion, gender, sexual orientation, disability, or national origin",
            "Facilitates scams, impersonation, or identity theft",
            "Harasses, blackmails, or threatens another person",
            "Violates any applicable Nigerian law or any law of the jurisdiction where the content is distributed",
            "Violates the policies of any integrated social platform",
          ].map((item, i) => (
            <li key={i} style={liStyle}>{item}</li>
          ))}
        </ul>

        <h2 style={h2Style}>4. Identity, Voice, and Likeness Rules</h2>
        <p style={pStyle}>You must not generate content that uses the real face, voice, name, or identity of any real person without their explicit, verifiable consent. This includes political figures, celebrities, journalists, and private individuals. Satire that could reasonably be mistaken for a genuine statement or event is prohibited without clear labelling.</p>

        <h2 style={h2Style}>5. AI Transparency Requirements</h2>
        <p style={pStyle}>Where destination platforms (YouTube, Instagram, TikTok, Meta, etc.) require disclosure of AI-generated content, you are responsible for making that disclosure. GioHomeStudio may assist with disclosure labelling but cannot guarantee that all platform requirements are met.</p>

        <h2 style={h2Style}>6. Enforcement</h2>
        <p style={pStyle}>GioHomeStudio reserves the right to remove content, suspend, or terminate accounts that violate this AUP, with or without prior notice. Enforcement actions may include content removal, account suspension, account termination, and referral to relevant authorities.</p>

        <h2 style={h2Style}>7. Reporting Violations</h2>
        <p style={pStyle}>To report content or conduct you believe violates this AUP, contact legal@giohomestudio.com with the subject line "AUP VIOLATION REPORT". Include the content ID if available and a description of the violation.</p>

        <h2 style={h2Style}>8. Governing Law</h2>
        <p style={pStyle}>This AUP is governed by the laws of the Federal Republic of Nigeria.</p>

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
            GioHomeStudio. You are responsible for content you approve and publish.
          </p>
        </div>
      </div>
    </div>
  );
}
