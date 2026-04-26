"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Sound 3-Bucket Policy Enforcer
//
// From Support Canvas:
// Bucket 1: Owned / GHS-internal → always allowed
// Bucket 2: CC0 → allowed, no attribution needed
// Bucket 3: CC BY → allowed ONLY with auto-attribution
// BLOCKED: CC BY-NC in any commercial flow
// BLOCKED: Unknown license sounds
// "Free to download" ≠ "free to use commercially"
// ═══════════════════════════════════════════════════════════════════════════

interface SoundAsset {
  id: string;
  title: string;
  creatorName?: string;
  sourcePlatform?: string;
  sourceUrl?: string;
  licenseType: "owned" | "cc0" | "cc_by" | "cc_by_nc" | "unknown";
  requiresAttribution: boolean;
  commercialAllowed: boolean;
  attributionText?: string;
}

interface SoundBucketEnforcerProps {
  sounds: SoundAsset[];
  isCommercial: boolean;
  onRemoveSound: (id: string) => void;
  onUpdateLicense: (id: string, license: SoundAsset["licenseType"]) => void;
}

const border = "#1e2a35";
const muted = "#5a7080";
const green = "#22c55e";
const gold = "#f59e0b";
const red = "#ef4444";
const purple = "#a855f7";

const BUCKET_INFO: Record<string, { label: string; color: string; icon: string; allowed: boolean; description: string }> = {
  owned:   { label: "Owned", color: green, icon: "✓", allowed: true, description: "Fully owned or GHS-internal — always allowed" },
  cc0:     { label: "CC0 / Public Domain", color: green, icon: "✓", allowed: true, description: "No attribution required, free for all use" },
  cc_by:   { label: "CC BY", color: gold, icon: "⚠", allowed: true, description: "Allowed with automatic attribution — credits will be generated" },
  cc_by_nc: { label: "CC BY-NC", color: red, icon: "✗", allowed: false, description: "BLOCKED — not allowed in commercial production" },
  unknown: { label: "Unknown License", color: red, icon: "✗", allowed: false, description: "BLOCKED — license must be verified before use" },
};

export default function SoundBucketEnforcer({ sounds, isCommercial, onRemoveSound, onUpdateLicense }: SoundBucketEnforcerProps) {
  const [showCredits, setShowCredits] = useState(false);

  const allowed = sounds.filter(s => BUCKET_INFO[s.licenseType]?.allowed);
  const blocked = sounds.filter(s => !BUCKET_INFO[s.licenseType]?.allowed);
  const needsAttribution = sounds.filter(s => s.licenseType === "cc_by");
  const hasBlocked = blocked.length > 0;

  // Auto-generate attribution text
  const creditsText = needsAttribution
    .map(s => s.attributionText || `"${s.title}" by ${s.creatorName || "Unknown"} (${s.sourcePlatform || "Unknown source"}) — CC BY`)
    .join("\n");

  const copyCredits = () => {
    navigator.clipboard.writeText(creditsText).catch(() => {});
  };

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${hasBlocked ? "rgba(239,68,68,0.3)" : border}`, borderRadius: 14, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔊</span>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Sound License Check</p>
            <p style={{ fontSize: 10, color: muted }}>{sounds.length} sound(s) · {allowed.length} allowed · {blocked.length} blocked</p>
          </div>
        </div>
        {hasBlocked && (
          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 8, background: "rgba(239,68,68,0.1)", color: red, border: "1px solid rgba(239,68,68,0.3)", fontWeight: 600 }}>
            {blocked.length} BLOCKED
          </span>
        )}
      </div>

      {/* Bucket summary */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        {Object.entries(BUCKET_INFO).map(([key, info]) => {
          const count = sounds.filter(s => s.licenseType === key).length;
          if (count === 0) return null;
          return (
            <div key={key} style={{ flex: 1, padding: "8px 10px", borderRadius: 8, background: `${info.color}08`, border: `1px solid ${info.color}25`, textAlign: "center" }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: info.color }}>{count}</p>
              <p style={{ fontSize: 9, color: muted }}>{info.label}</p>
            </div>
          );
        })}
      </div>

      {/* Blocked sounds warning */}
      {hasBlocked && (
        <div style={{ background: "rgba(239,68,68,0.05)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: red, marginBottom: 8 }}>Blocked Sounds — Remove or change license</p>
          {blocked.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: `1px solid rgba(239,68,68,0.1)` }}>
              <div>
                <p style={{ fontSize: 11, color: "#fff" }}>{s.title}</p>
                <p style={{ fontSize: 9, color: red }}>{BUCKET_INFO[s.licenseType]?.description}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <select value={s.licenseType} onChange={e => onUpdateLicense(s.id, e.target.value as SoundAsset["licenseType"])}
                  style={{ background: "#080b10", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
                  <option value="owned">Owned</option>
                  <option value="cc0">CC0</option>
                  <option value="cc_by">CC BY</option>
                  <option value="cc_by_nc">CC BY-NC</option>
                  <option value="unknown">Unknown</option>
                </select>
                <button onClick={() => onRemoveSound(s.id)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: red, fontSize: 10, cursor: "pointer" }}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Allowed sounds */}
      {allowed.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {allowed.map(s => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderBottom: `1px solid ${border}` }}>
              <span style={{ fontSize: 10, color: BUCKET_INFO[s.licenseType]?.color }}>{BUCKET_INFO[s.licenseType]?.icon}</span>
              <span style={{ fontSize: 11, color: "#fff", flex: 1 }}>{s.title}</span>
              <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: `${BUCKET_INFO[s.licenseType]?.color}15`, color: BUCKET_INFO[s.licenseType]?.color }}>
                {BUCKET_INFO[s.licenseType]?.label}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Attribution / Credits */}
      {needsAttribution.length > 0 && (
        <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 10, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: gold }}>Attribution Required ({needsAttribution.length} sound{needsAttribution.length > 1 ? "s" : ""})</p>
            <button onClick={() => setShowCredits(!showCredits)}
              style={{ fontSize: 10, color: gold, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
              {showCredits ? "Hide" : "Show"} Credits
            </button>
          </div>
          {showCredits && (
            <div>
              <pre style={{ fontSize: 10, color: muted, lineHeight: 1.6, whiteSpace: "pre-wrap", margin: 0, background: "#080b10", borderRadius: 8, padding: 10, border: `1px solid ${border}` }}>
                {creditsText}
              </pre>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button onClick={copyCredits}
                  style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.1)", color: gold, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                  Copy Credits
                </button>
                <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                  Include in Export
                </button>
                <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                  Add as End Card
                </button>
                <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                  YouTube Description
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Commercial warning */}
      {isCommercial && (
        <div style={{ padding: "8px 12px", background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.15)", borderRadius: 8, fontSize: 10, color: muted, lineHeight: 1.6 }}>
          <strong style={{ color: purple }}>Commercial production:</strong> Only Owned, CC0, and CC BY (with attribution) sounds are allowed. CC BY-NC and unknown-license sounds are automatically blocked.
          {hasBlocked && <span style={{ color: red, fontWeight: 600 }}> Remove {blocked.length} blocked sound(s) before export.</span>}
        </div>
      )}
    </div>
  );
}
