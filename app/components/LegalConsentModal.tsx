"use client";

// LegalConsentModal — shown to existing users who haven't accepted the 2026-04-26-v1 policy set.
// Wire into any dashboard page: <LegalConsentModal />
// Fetches /api/auth/legal-consent on mount to check status.
// After submit, modal self-dismisses. Shows only once per policy version.

import { useState, useEffect } from "react";
import { ds } from "../../lib/designSystem";
import ButtonPrimary from "./ui/ButtonPrimary";

const LEGAL_VERSION = "2026-04-26-v1";

const LEGAL_DOCS = [
  { label: "Terms of Use",               href: "/terms" },
  { label: "Privacy Policy",             href: "/privacy" },
  { label: "Acceptable Use Policy",      href: "/acceptable-use" },
  { label: "AI Disclosure Policy",       href: "/ai-disclosure" },
  { label: "DMCA / Takedown Procedure",  href: "/dmca" },
  { label: "Cookies Policy",             href: "/cookies" },
  { label: "Sound Licensing Policy",     href: "/sound-licensing" },
];

export default function LegalConsentModal() {
  const [agreed, setAgreed]       = useState(false);
  const [loading, setLoading]     = useState(false);
  const [checking, setChecking]   = useState(true);
  const [needsConsent, setNeedsConsent] = useState(false);
  const [error, setError]         = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [showDocs, setShowDocs]   = useState(false);

  useEffect(() => {
    fetch("/api/auth/legal-consent")
      .then(r => r.json())
      .then(d => {
        setNeedsConsent(d.needsConsent === true);
        setChecking(false);
      })
      .catch(() => setChecking(false));
  }, []);

  // Loading, already accepted, or dismissed — render nothing
  if (checking || !needsConsent || dismissed) return null;

  async function handleAccept() {
    if (!agreed) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/legal-consent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: LEGAL_VERSION }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Failed to save consent");
        setLoading(false);
        return;
      }
      setDismissed(true);
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.75)",
          zIndex: 9998,
        }}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Legal policy update"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px 16px",
        }}
      >
        <div
          style={{
            background: ds.color.card,
            border: `1px solid ${ds.color.line2}`,
            borderRadius: ds.radius.lg,
            padding: "32px 28px",
            width: "100%",
            maxWidth: 480,
            maxHeight: "90vh",
            overflowY: "auto",
          }}
        >
          <h2
            style={{
              fontSize: 18,
              fontWeight: 800,
              color: ds.color.ink,
              marginBottom: 8,
              letterSpacing: "-0.02em",
              fontFamily: ds.font.sans,
            }}
          >
            Updated Legal Policies
          </h2>
          <p
            style={{
              fontSize: 13,
              color: ds.color.ink2,
              lineHeight: 1.7,
              marginBottom: 20,
              fontFamily: ds.font.sans,
            }}
          >
            GioHomeStudio has updated its legal policy set (effective 2026-04-26). Please review and accept to continue using the platform.
          </p>

          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
              fontSize: 12,
              color: ds.color.mute,
              cursor: "pointer",
              lineHeight: 1.6,
              fontFamily: ds.font.sans,
              marginBottom: 8,
            }}
          >
            <input
              type="checkbox"
              checked={agreed}
              onChange={e => setAgreed(e.target.checked)}
              style={{ marginTop: 3, accentColor: ds.color.lilac, flexShrink: 0 }}
            />
            <span>
              I agree to the GHS{" "}
              <a href="/terms" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>Terms of Use</a>,{" "}
              <a href="/privacy" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>Privacy Policy</a>,{" "}
              <a href="/acceptable-use" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>Acceptable Use Policy</a>,{" "}
              <a href="/ai-disclosure" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>AI Disclosure</a>,{" "}
              <a href="/dmca" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>DMCA / Takedown Procedure</a>,{" "}
              <a href="/cookies" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>Cookies Policy</a>, and{" "}
              <a href="/sound-licensing" target="_blank" style={{ color: ds.color.lilac, textDecoration: "none" }}>Sound Licensing Policy</a>.{" "}
              I confirm I am 13+ (18+ for monetisation) and that I will only generate content I have rights to.
            </span>
          </label>

          <button
            type="button"
            onClick={() => setShowDocs(v => !v)}
            style={{
              marginLeft: 20,
              marginBottom: 20,
              background: "none",
              border: "none",
              color: ds.color.mute2,
              fontSize: 11,
              fontFamily: ds.font.mono,
              cursor: "pointer",
              padding: 0,
              textDecoration: "underline",
            }}
          >
            {showDocs ? "Hide documents" : "Show all 7 documents"}
          </button>

          {showDocs && (
            <div
              style={{
                marginLeft: 20,
                marginBottom: 20,
                padding: "10px 12px",
                background: ds.color.wallet,
                border: `1px solid ${ds.color.line}`,
                borderRadius: ds.radius.xs,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              {LEGAL_DOCS.map(doc => (
                <a
                  key={doc.href}
                  href={doc.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    fontSize: 12,
                    color: ds.color.lilac,
                    textDecoration: "none",
                    fontFamily: ds.font.sans,
                  }}
                >
                  {doc.label} &rarr;
                </a>
              ))}
            </div>
          )}

          {error && (
            <p
              style={{
                fontSize: 12,
                color: "#f87171",
                marginBottom: 14,
                fontFamily: ds.font.sans,
              }}
            >
              {error}
            </p>
          )}

          <ButtonPrimary
            type="button"
            disabled={!agreed || loading}
            onClick={handleAccept}
            size="md"
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading ? "Saving..." : "I Agree — Continue"}
          </ButtonPrimary>
        </div>
      </div>
    </>
  );
}
