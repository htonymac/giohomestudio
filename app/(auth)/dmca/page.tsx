// GioHomeStudio — DMCA / Copyright Takedown Policy v1.0 (2026-04-26)
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

export default function DmcaPage() {
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
          DMCA / Copyright Takedown Procedure
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

        <h2 style={h2Style}>1. Introduction</h2>
        <p style={pStyle}>GioHomeStudio respects the intellectual property rights of others and expects its users to do the same. This policy establishes the procedure for reporting copyright infringement on the GioHomeStudio platform, consistent with the United States Digital Millennium Copyright Act (DMCA), 17 U.S.C. § 512, and the Nigerian Copyright Act 2022.</p>

        <h2 style={h2Style}>2. Designated Copyright Agent</h2>
        <p style={pStyle}>All copyright infringement notices and counter-notices must be sent to:</p>
        <div
          style={{
            background: ds.color.alert,
            border: `1px solid ${ds.color.line2}`,
            borderRadius: ds.radius.xs,
            padding: "12px 16px",
            marginBottom: 16,
          }}
        >
          <p style={{ ...pStyle, marginBottom: 4, fontWeight: 600 }}>GioHomeStudio Copyright Agent</p>
          <p style={{ ...pStyle, marginBottom: 4 }}>Email: legal@giohomestudio.com</p>
          <p style={{ ...pStyle, marginBottom: 0 }}>Subject line: <strong>COPYRIGHT TAKEDOWN NOTICE</strong> (required for routing)</p>
        </div>

        <h2 style={h2Style}>3. Requirements for a Valid Takedown Notice</h2>
        <p style={pStyle}>To be valid under this policy, a takedown notice must include:</p>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          {[
            "Your name, address, telephone number, and email address",
            "A description of the copyrighted work you claim has been infringed",
            "A description of where the infringing material is located on the platform (content ID or URL if available)",
            "A statement that you have a good-faith belief the use is not authorised by the copyright owner, its agent, or the law",
            "A statement under penalty of perjury that the information in the notice is accurate and you are the copyright owner or authorised to act on their behalf",
            "Your electronic or physical signature",
          ].map((item, i) => (
            <li key={i} style={liStyle}>{item}</li>
          ))}
        </ul>

        <h2 style={h2Style}>4. What Happens After a Valid Notice</h2>
        <p style={pStyle}>Upon receiving a valid notice, GioHomeStudio will: (1) promptly remove or disable access to the allegedly infringing content; (2) notify the user who uploaded the content; (3) provide the user with a copy of the notice; and (4) log the action for compliance purposes.</p>
        <p style={pStyle}>GioHomeStudio operates a repeat infringer policy. Users who repeatedly receive valid takedown notices may have their accounts suspended or terminated.</p>

        <h2 style={h2Style}>5. Counter-Notice Procedure</h2>
        <p style={pStyle}>If you believe your content was removed as a result of a mistake or misidentification, you may submit a counter-notice to our Copyright Agent. A valid counter-notice must include your contact details, identification of the removed material, a statement under penalty of perjury that you believe the material was removed by mistake, and your signature.</p>
        <p style={pStyle}>Upon receiving a valid counter-notice, GioHomeStudio may restore the removed material within 10–14 business days unless the complaining party files a court action.</p>

        <h2 style={h2Style}>6. Misuse</h2>
        <p style={pStyle}>Filing a false or bad-faith takedown notice or counter-notice may expose you to liability for damages, including costs and legal fees, under applicable law. GioHomeStudio reserves the right to terminate accounts of repeat bad-faith filers.</p>

        <h2 style={h2Style}>7. Platform Content Responsibilities</h2>
        <p style={pStyle}>GioHomeStudio is a tool provider, not a publisher. All content generated and published through the platform is done so by users acting as publishers of record under these Terms. Users are solely responsible for ensuring all uploaded material and AI-generated output is lawfully used and does not infringe third-party rights.</p>

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
            GioHomeStudio. Respecting intellectual property rights.
          </p>
        </div>
      </div>
    </div>
  );
}
