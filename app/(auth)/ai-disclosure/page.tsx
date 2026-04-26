// GioHomeStudio — AI Disclosure Policy v1.0 (2026-04-26)
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

type ProviderRow = {
  name: string;
  type: string;
  dataTransmitted: string;
  optOut: string;
};

const providers: ProviderRow[] = [
  { name: "Anthropic Claude", type: "LLM / prompt enhancement, planning", dataTransmitted: "Text prompts, story context, captions", optOut: "Yes — privacy.anthropic.com" },
  { name: "FAL.ai", type: "Image and video generation", dataTransmitted: "Text prompts, reference images", optOut: "Yes — fal.ai/privacy" },
  { name: "ElevenLabs", type: "Voice synthesis and cloning", dataTransmitted: "Text, optional voice samples", optOut: "Yes — elevenlabs.io/privacy" },
  { name: "Kie.ai", type: "Music and media generation", dataTransmitted: "Text prompts, style descriptors", optOut: "See kie.ai terms" },
  { name: "Runway", type: "Video generation", dataTransmitted: "Text prompts, images", optOut: "Yes — runwayml.com/privacy" },
  { name: "Suno", type: "Music generation", dataTransmitted: "Text prompts", optOut: "See suno.ai terms" },
  { name: "MuAPI / Segmind", type: "Music / image generation", dataTransmitted: "Text prompts", optOut: "See provider terms" },
];

export default function AiDisclosurePage() {
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
          AI Disclosure Policy
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
        <p style={pStyle}>GioHomeStudio is an AI-powered content creation platform. Every significant generation feature on the platform is powered by one or more third-party AI providers. This AI Disclosure Policy explains which AI providers the platform uses, what user data is transmitted, how output ownership works, and your responsibilities when publishing AI-generated content.</p>

        <h2 style={h2Style}>2. AI Provider Registry</h2>
        <p style={pStyle}>The following AI providers are currently integrated. This list is updated when providers are added or removed:</p>

        <div style={{ overflowX: "auto", marginBottom: 20 }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 12,
              fontFamily: ds.font.sans,
            }}
          >
            <thead>
              <tr>
                {["Provider", "Type", "Data Transmitted", "Opt-Out"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left",
                      padding: "8px 10px",
                      background: ds.color.card,
                      color: ds.color.mute,
                      borderBottom: `1px solid ${ds.color.line2}`,
                      fontFamily: ds.font.mono,
                      fontSize: 11,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {providers.map((row, i) => (
                <tr key={i}>
                  {[row.name, row.type, row.dataTransmitted, row.optOut].map((cell, j) => (
                    <td
                      key={j}
                      style={{
                        padding: "8px 10px",
                        color: ds.color.ink2,
                        borderBottom: `1px solid ${ds.color.line}`,
                        verticalAlign: "top",
                      }}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={h2Style}>3. What We Do Not Do</h2>
        <ul style={{ paddingLeft: 20, margin: "0 0 16px 0" }}>
          {[
            "We do not transmit your uploaded media to AI providers without your instruction to generate content",
            "We do not share your content with providers for purposes unrelated to your generation request",
            "We do not use your content to train our own AI models",
          ].map((item, i) => (
            <li key={i} style={liStyle}>{item}</li>
          ))}
        </ul>

        <h2 style={h2Style}>4. Output Ownership</h2>
        <p style={pStyle}>As between you and GioHomeStudio, AI-generated outputs produced using your instructions are yours, subject to: (a) applicable law in your jurisdiction regarding AI-generated works; (b) third-party AI provider terms — some providers grant broad usage rights, others have specific restrictions; and (c) source material rights — if you upload third-party content without authorisation, outputs may be encumbered. GioHomeStudio makes no guarantee that outputs are exclusively owned by you or free from third-party claims.</p>

        <h2 style={h2Style}>5. Platform Disclosure Requirements</h2>
        <p style={pStyle}>Many destination platforms (YouTube, Meta, TikTok, Instagram, etc.) now require users to disclose AI-generated content. GioHomeStudio may assist with disclosure labelling, but you are responsible for complying with the specific disclosure rules of each platform where you publish. Failure to disclose as required by a destination platform may result in content removal or account action by that platform.</p>

        <h2 style={h2Style}>6. Known AI Limitations</h2>
        <p style={pStyle}>AI-generated content may: be factually inaccurate; reproduce real people's likenesses in unintended ways; contain biases reflecting training data; produce inconsistent results for the same prompt; and fail to meet specific cultural, safety, or quality standards. Always review outputs before publishing.</p>

        <h2 style={h2Style}>7. Contact</h2>
        <p style={pStyle}>AI policy questions: legal@giohomestudio.com</p>

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
            GioHomeStudio. AI-generated content disclosed. Human review required before publishing.
          </p>
        </div>
      </div>
    </div>
  );
}
