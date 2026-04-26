// GioHomeStudio — Cookies Policy v1.0 (2026-04-26)
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

type CookieRow = {
  name: string;
  purpose: string;
  duration: string;
  canDisable: string;
};

const strictCookies: CookieRow[] = [
  { name: "Session token (server-side)", purpose: "Authenticates your logged-in session", duration: "Session (deleted on logout)", canDisable: "No" },
  { name: "CSRF token", purpose: "Prevents cross-site request forgery attacks", duration: "Session", canDisable: "No" },
  { name: "next-auth.session-token", purpose: "NextAuth.js session management", duration: "30 days (configurable)", canDisable: "No" },
];

const localStorageCookies: CookieRow[] = [
  { name: "ghs_pregen_skip_until", purpose: "Pre-generation rights gate 24h skip preference", duration: "24 hours", canDisable: "Yes — via gate UI" },
  { name: "hybrid_planner_state", purpose: "Hybrid Planner local project state persistence", duration: "Session/until cleared", canDisable: "Yes — via localStorage.clear()" },
];

function CookieTable({ rows }: { rows: CookieRow[] }) {
  return (
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
            {["Name / Token", "Purpose", "Duration", "Can Disable?"].map((h) => (
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
          {rows.map((row, i) => (
            <tr key={i}>
              {[row.name, row.purpose, row.duration, row.canDisable].map((cell, j) => (
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
  );
}

export default function CookiesPage() {
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
          Cookies Policy
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

        <h2 style={h2Style}>1. What Are Cookies?</h2>
        <p style={pStyle}>Cookies are small text files placed on your device when you visit a website or use a web application. They allow the application to remember information about your visit — for example, your login session or preferences.</p>
        <p style={pStyle}>GioHomeStudio also uses similar technologies such as localStorage and sessionStorage that serve comparable functions.</p>

        <h2 style={h2Style}>2. Strictly Necessary Cookies</h2>
        <p style={pStyle}>These cookies are essential for the platform to function. Without them, core services — including login, session management, and security controls — cannot operate. These cookies cannot be disabled.</p>
        <CookieTable rows={strictCookies} />

        <h2 style={h2Style}>3. Preference and Functional Storage</h2>
        <p style={pStyle}>These items are stored in your browser's localStorage or sessionStorage to save your preferences across sessions. They are not transmitted to our servers unless explicitly saved as part of a project.</p>
        <CookieTable rows={localStorageCookies} />

        <h2 style={h2Style}>4. What We Do Not Use</h2>
        <p style={pStyle}>GioHomeStudio does not use: advertising or tracking cookies; third-party analytics cookies (e.g., Google Analytics); social media tracking pixels; or any persistent identifiers for cross-site tracking.</p>

        <h2 style={h2Style}>5. How to Manage Cookies</h2>
        <p style={pStyle}>You can manage or delete cookies through your browser settings. Note that disabling strictly necessary cookies will prevent you from logging in or using core platform features. Most modern browsers allow you to: view cookies currently stored; delete individual cookies; block cookies from specific sites; or set preferences for future cookies.</p>

        <h2 style={h2Style}>6. Changes to This Policy</h2>
        <p style={pStyle}>If we add new cookie types or change how we use existing ones, we will update this policy and notify registered users.</p>

        <h2 style={h2Style}>7. Contact</h2>
        <p style={pStyle}>Cookie-related questions: legal@giohomestudio.com</p>

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
            GioHomeStudio. Essential cookies only. No advertising or tracking cookies.
          </p>
        </div>
      </div>
    </div>
  );
}
