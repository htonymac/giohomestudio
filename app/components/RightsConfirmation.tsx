"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Rights Confirmation — Popup at point of risk
//
// From Support Canvas:
// "Must be a REAL interaction step, not buried legal text"
// "Block by default: celebrity cloning, fake endorsements, deception"
//
// Types:
// - third_party_face: "I own this or have permission"
// - voice_cloning: "I have permission from voice owner"
// - endorsement: "I have commercial rights"
// - imported_media: "I accept responsibility"
// ═══════════════════════════════════════════════════════════════════════════

interface RightsConfirmationProps {
  type: "third_party_face" | "voice_cloning" | "endorsement" | "imported_media";
  projectId: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const CONFIRMATIONS: Record<string, {
  title: string;
  icon: string;
  warning: string;
  checkboxText: string;
  blockedActions: string[];
}> = {
  third_party_face: {
    title: "Third-Party Face Detected",
    icon: "👤",
    warning: "You are using a real person's likeness in this content. Before proceeding, you must confirm that you have the right to use this person's face, image, or likeness.",
    checkboxText: "I confirm that I own this image or have explicit written permission from the person depicted to use their likeness in this content.",
    blockedActions: [
      "Using celebrity images without license",
      "Creating deepfakes or impersonations",
      "Non-consensual intimate content",
      "Using children's faces without parental consent",
    ],
  },
  voice_cloning: {
    title: "Voice Cloning / Synthesis",
    icon: "🎙",
    warning: "You are cloning or synthesizing a voice that may belong to a real person. Voice cloning without consent is prohibited in many jurisdictions.",
    checkboxText: "I confirm that I have explicit permission from the voice owner to clone, synthesize, or use their voice in this content, or I am using my own voice.",
    blockedActions: [
      "Cloning a celebrity or public figure's voice",
      "Creating fake audio statements",
      "Voice impersonation for deception",
      "Using someone's voice without their knowledge",
    ],
  },
  endorsement: {
    title: "Endorsement / Commercial Content",
    icon: "📢",
    warning: "This content appears to be endorsement-style or commercial promotional content. You must have the commercial rights to use all featured people, brands, and intellectual property.",
    checkboxText: "I confirm that I have the commercial rights to create this content, including rights to any featured persons, brands, logos, and intellectual property.",
    blockedActions: [
      "Fake endorsements (making it look like someone endorses a product they haven't)",
      "Using brand logos without permission",
      "Creating misleading commercial claims",
      "Impersonating official brand communications",
    ],
  },
  imported_media: {
    title: "Imported Third-Party Media",
    icon: "📁",
    warning: "You are importing media that was not created inside GHS. The copyright and usage rights for this media are your responsibility.",
    checkboxText: "I accept full responsibility for the imported media. I confirm I have the right to use, transform, and publish this content, and I understand that GHS cannot verify external media rights.",
    blockedActions: [
      "Using copyrighted content without license",
      "Downloading and re-uploading others' content",
      "Stripping watermarks or attribution",
      "Using stock footage outside its license terms",
    ],
  },
};

const red = "#ef4444";
const green = "#22c55e";
const gold = "#f59e0b";
const purple = "#a855f7";
const border = "#1e2a35";
const muted = "#5a7080";

export default function RightsConfirmation({ type, projectId, onConfirm, onCancel }: RightsConfirmationProps) {
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const config = CONFIRMATIONS[type];

  const handleConfirm = async () => {
    if (!confirmed) return;
    setSaving(true);
    try {
      await fetch("/api/rights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          confirmationType: type,
          acceptedVersion: "1.0",
        }),
      });
      // Also log to audit
      await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventType: "rights_confirmed",
          projectId,
          details: { type, confirmed: true },
        }),
      });
    } catch { /* log failed, still allow */ }
    setSaving(false);
    onConfirm();
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(6,8,16,0.92)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 20, padding: 32, maxWidth: 520, width: "100%" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>{config.icon}</div>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{config.title}</h2>
            <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "rgba(239,68,68,0.1)", color: red, border: "1px solid rgba(239,68,68,0.2)", fontWeight: 600 }}>Rights Confirmation Required</span>
          </div>
        </div>

        {/* Warning */}
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 16, marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: gold, lineHeight: 1.7 }}>{config.warning}</p>
        </div>

        {/* Blocked actions */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: red, marginBottom: 8 }}>Blocked by default</p>
          {config.blockedActions.map(a => (
            <div key={a} style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
              <span style={{ fontSize: 10, color: red }}>✗</span>
              <span style={{ fontSize: 11, color: muted }}>{a}</span>
            </div>
          ))}
        </div>

        {/* Confirmation checkbox */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", padding: "14px 16px", background: confirmed ? "rgba(34,197,94,0.05)" : "#080b10", border: `1px solid ${confirmed ? "rgba(34,197,94,0.3)" : border}`, borderRadius: 12, marginBottom: 20 }}>
          <input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)}
            style={{ accentColor: green, width: 18, height: 18, marginTop: 2, flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: confirmed ? green : "#fff", lineHeight: 1.6 }}>{config.checkboxText}</span>
        </label>

        {/* Actions */}
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleConfirm} disabled={!confirmed || saving}
            style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: confirmed ? green : "#2a2a40", color: confirmed ? "#000" : muted, fontSize: 14, fontWeight: 700, cursor: confirmed ? "pointer" : "not-allowed" }}>
            {saving ? "Saving..." : "Confirm & Continue"}
          </button>
          <button onClick={onCancel}
            style={{ padding: "14px 24px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
