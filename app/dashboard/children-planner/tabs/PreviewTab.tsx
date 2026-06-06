"use client";

// Preview tab — shows generated preview video + music, lets user regen or
// proceed to Review 2.
// Extracted from app/dashboard/children-planner/page.tsx (Wave 1.2, 2026-06-05).

import * as React from "react";
import * as Icon from "../../../components/icons";

export interface PreviewTabProps {
  // ── State READ ──
  generatedVideoUrl: string;
  generatedMusicUrl: string;
  generating: boolean;
  generationProgress: string;
  musicFallbackReason: string | null;
  // ── Style tokens ──
  cardStyle: React.CSSProperties;
  muted: string;
  s2: string;
  border: string;
  childSafe: string;
  childAccent: string;
  // ── State WRITE / nav ──
  // Narrowed to the only two destinations the tab actually navigates to;
  // matches parent's WorkshopTab union without importing it (avoid cycle).
  setActiveTab: (t: "review1" | "review2") => void;
  setReview1Done: (v: boolean) => void;
  setGeneratedVideoUrl: (s: string) => void;
  setGeneratedMusicUrl: (s: string) => void;
  setLastAction: (s: string) => void;
}

export default function PreviewTab(props: PreviewTabProps) {
  const {
    generatedVideoUrl, generatedMusicUrl, generating, generationProgress, musicFallbackReason,
    cardStyle, muted, s2, border, childSafe, childAccent,
    setActiveTab, setReview1Done, setGeneratedVideoUrl, setGeneratedMusicUrl, setLastAction,
  } = props;

  return (
    <div style={{ ...cardStyle, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Preview Generated</h2>

      {!generatedVideoUrl && !generating ? (
        <div style={{ background: s2, borderRadius: 14, padding: 40, textAlign: "center", border: `1px solid ${border}`, marginBottom: 16 }}>
          <Icon.Film style={{ width: 28, height: 28, color: muted, marginBottom: 8 }} />
          <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>Preview not yet generated</p>
          <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Complete the Safety Review first and click &quot;Generate Preview&quot;</p>
          <button
            onClick={() => setActiveTab("review1")}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: "none", background: childSafe, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
          >
            Go to Review 1
          </button>
        </div>
      ) : (
        <>
          <p style={{ fontSize: 12, color: muted, marginBottom: 16 }}>Review the generated preview carefully. Check visuals, narration, text highlighting, and overall child-safety before final approval.</p>

          <div style={{ background: s2, borderRadius: 14, overflow: "hidden", marginBottom: 16, border: `1px solid ${border}` }}>
            {generatedVideoUrl ? (
              <video src={generatedVideoUrl} controls autoPlay style={{ width: "100%", maxHeight: 400 }} />
            ) : (
              <div style={{ padding: 40, textAlign: "center" }}>
                <Icon.Film style={{ width: 28, height: 28, color: muted, marginBottom: 8 }} />
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>
                  {generating ? (generationProgress || "Generating...") : "Preview not yet generated"}
                </p>
              </div>
            )}
          </div>

          {musicFallbackReason && (
            <div style={{ fontSize: 10, color: "#fbbf24", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", borderRadius: 8, padding: "8px 12px", marginBottom: 10 }}>
              Mubert not configured — using stock library for tracks &gt;47s. Set MUBERT_PAT to enable.
            </div>
          )}
          {generatedMusicUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: s2, border: `1px solid ${border}`, marginBottom: 12 }}>
              <Icon.Music style={{ width: 14, height: 14, flexShrink: 0 }} />
              <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>Background music generated</p>
              <audio src={generatedMusicUrl} controls style={{ height: 28 }} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => { setReview1Done(false); setGeneratedVideoUrl(""); setGeneratedMusicUrl(""); setLastAction("Regenerating preview"); setActiveTab("review1"); }}
              style={{ padding: "14px 24px", borderRadius: 14, border: `1px solid ${border}`, background: "transparent", color: muted, cursor: "pointer" }}
            >
              Regenerate
            </button>
            <button
              onClick={() => { setLastAction("Proceeding to final review"); setActiveTab("review2"); }}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: childAccent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer" }}
            >
              Proceed to Final Review
            </button>
          </div>
        </>
      )}
    </div>
  );
}
