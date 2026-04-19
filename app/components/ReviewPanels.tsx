"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Review Panels — 8 panels before export
//
// From Support Canvas: "No final export without approval through these panels"
//
// Panel 1: Import Summary
// Panel 2: Narration Plan
// Panel 3: Music Plan
// Panel 4: Sound Effects Plan
// Panel 5: Subtitle / Overlay Plan
// Panel 6: Source / License Summary
// Panel 7: Assembly Preview
// Panel 8: Export Settings
// ═══════════════════════════════════════════════════════════════════════════

interface ReviewPanelsProps {
  projectTitle: string;
  segments: Array<{ id: string; type: string; sourceUrl: string; duration: number }>;
  narration: Array<{ id: string; text: string; voiceId?: string; style?: string; startTime: number; endTime: number }>;
  music: Array<{ id: string; sourceUrl: string; volume: number; duckUnderSpeech: boolean; licenseType?: string; attributionText?: string }>;
  sfx: Array<{ id: string; event: string; startTime: number; volume: number; category: string }>;
  subtitles: Array<{ id: string; text: string; startTime: number; endTime: number; position: string }>;
  overlays: Array<{ id: string; type: string; content: string; startTime: number; endTime: number }>;
  soundLicenses: Array<{ assetId: string; license: string; attribution?: string }>;
  rightsConfirmed: boolean;
  previewUrl?: string;
  exportSettings: { format: string; quality: string; includeSubtitles: boolean; includeCredits: boolean; creditsText?: string };
  onApprove: () => void;
  onReject: (reason: string) => void;
}

const surface = "#0e1318";
const border = "#1e2a35";
const muted = "#5a7080";
const green = "#22c55e";
const red = "#ef4444";
const purple = "#a855f7";
const gold = "#f59e0b";

export default function ReviewPanels(props: ReviewPanelsProps) {
  const [activePanel, setActivePanel] = useState(0);
  const [approvals, setApprovals] = useState<boolean[]>(Array(8).fill(false));
  const allApproved = approvals.every(a => a);

  const toggleApproval = (idx: number) => {
    setApprovals(prev => { const n = [...prev]; n[idx] = !n[idx]; return n; });
  };

  const panels = [
    {
      title: "Import Summary",
      icon: "📥",
      content: (
        <div>
          <p style={{ fontSize: 12, color: "#fff", marginBottom: 8 }}>Project: <strong>{props.projectTitle}</strong></p>
          <p style={{ fontSize: 11, color: muted }}>Total segments: {props.segments.length}</p>
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column" as const, gap: 6 }}>
            {props.segments.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}` }}>
                <span style={{ fontSize: 10, color: purple, fontWeight: 600 }}>{s.type}</span>
                <span style={{ fontSize: 10, color: muted, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{s.sourceUrl || "Not rendered"}</span>
                <span style={{ fontSize: 10, color: "#fff", fontFamily: "monospace" }}>{s.duration}s</span>
              </div>
            ))}
          </div>
          {props.segments.some(s => !s.sourceUrl) && (
            <p style={{ fontSize: 10, color: red, marginTop: 8 }}>⚠ Some segments have no source file. Render them before export.</p>
          )}
        </div>
      ),
    },
    {
      title: "Narration Plan",
      icon: "🎙",
      content: (
        <div>
          <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>{props.narration.length} narration track(s)</p>
          {props.narration.length === 0 ? (
            <p style={{ fontSize: 11, color: gold }}>No narration planned. This is OK for music-only content.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {props.narration.map(n => (
                <div key={n.id} style={{ padding: "8px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}` }}>
                  <p style={{ fontSize: 11, color: "#fff", marginBottom: 4 }}>{n.text.slice(0, 80)}{n.text.length > 80 ? "..." : ""}</p>
                  <div style={{ fontSize: 9, color: muted, display: "flex", gap: 12 }}>
                    <span>Voice: {n.voiceId || "default"}</span>
                    <span>Style: {n.style || "normal"}</span>
                    <span>{n.startTime}s – {n.endTime}s</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Music Plan",
      icon: "🎵",
      content: (
        <div>
          <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>{props.music.length} music track(s)</p>
          {props.music.map(m => (
            <div key={m.id} style={{ padding: "8px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}`, marginBottom: 6 }}>
              <p style={{ fontSize: 11, color: "#fff" }}>Volume: {Math.round(m.volume * 100)}% | Duck: {m.duckUnderSpeech ? "Yes" : "No"}</p>
              {m.licenseType && <p style={{ fontSize: 9, color: m.licenseType === "cc_by" ? gold : green }}>License: {m.licenseType}</p>}
              {m.attributionText && <p style={{ fontSize: 9, color: gold }}>Attribution: {m.attributionText}</p>}
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Sound Effects Plan",
      icon: "💥",
      content: (
        <div>
          <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>{props.sfx.length} SFX event(s)</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6 }}>
            {props.sfx.map(s => (
              <span key={s.id} style={{ fontSize: 10, padding: "4px 10px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.2)", color: gold }}>
                {s.event} @ {s.startTime}s ({s.category})
              </span>
            ))}
          </div>
        </div>
      ),
    },
    {
      title: "Subtitle / Overlay Plan",
      icon: "📝",
      content: (
        <div>
          <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>{props.subtitles.length} subtitle(s) | {props.overlays.length} overlay(s)</p>
          {props.subtitles.map(s => (
            <div key={s.id} style={{ padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}`, marginBottom: 4 }}>
              <p style={{ fontSize: 11, color: "#fff" }}>&quot;{s.text.slice(0, 60)}&quot;</p>
              <p style={{ fontSize: 9, color: muted }}>{s.startTime}s – {s.endTime}s | {s.position}</p>
            </div>
          ))}
          {props.overlays.map(o => (
            <div key={o.id} style={{ padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}`, marginBottom: 4 }}>
              <p style={{ fontSize: 11, color: "#fff" }}>{o.type}: {o.content.slice(0, 40)}</p>
              <p style={{ fontSize: 9, color: muted }}>{o.startTime}s – {o.endTime}s</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      title: "Source / License Summary",
      icon: "📜",
      content: (
        <div>
          <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>{props.soundLicenses.length} licensed asset(s)</p>
          {props.soundLicenses.length === 0 ? (
            <p style={{ fontSize: 11, color: green }}>No third-party licensed assets. All clear.</p>
          ) : (
            <>
              {props.soundLicenses.map((l, i) => (
                <div key={i} style={{ padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${l.license === "cc_by_nc" || l.license === "unknown" ? "rgba(239,68,68,0.3)" : border}`, marginBottom: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 11, color: "#fff" }}>{l.assetId}</span>
                    <span style={{ fontSize: 10, color: l.license === "owned" || l.license === "cc0" ? green : l.license === "cc_by" ? gold : red, fontWeight: 600 }}>{l.license.toUpperCase()}</span>
                  </div>
                  {l.attribution && <p style={{ fontSize: 9, color: gold, marginTop: 2 }}>Credit: {l.attribution}</p>}
                  {(l.license === "cc_by_nc" || l.license === "unknown") && (
                    <p style={{ fontSize: 9, color: red, marginTop: 2 }}>BLOCKED — cannot use in commercial production</p>
                  )}
                </div>
              ))}
              {props.soundLicenses.some(l => l.attribution) && (
                <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
                  <p style={{ fontSize: 10, color: gold, fontWeight: 600, marginBottom: 4 }}>Attribution Text (auto-generated)</p>
                  <p style={{ fontSize: 10, color: muted, lineHeight: 1.6 }}>
                    {props.soundLicenses.filter(l => l.attribution).map(l => l.attribution).join("\n")}
                  </p>
                  <button style={{ fontSize: 9, padding: "3px 10px", borderRadius: 6, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", color: gold, cursor: "pointer", marginTop: 6 }}>
                    Copy Credits
                  </button>
                </div>
              )}
            </>
          )}
          <div style={{ marginTop: 12, padding: "8px 12px", background: props.rightsConfirmed ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)", border: `1px solid ${props.rightsConfirmed ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, borderRadius: 8 }}>
            <p style={{ fontSize: 11, color: props.rightsConfirmed ? green : red, fontWeight: 600 }}>
              Rights: {props.rightsConfirmed ? "✓ Confirmed" : "✗ Not confirmed — confirm rights before export"}
            </p>
          </div>
        </div>
      ),
    },
    {
      title: "Assembly Preview",
      icon: "▶",
      content: (
        <div>
          {props.previewUrl ? (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${border}` }}>
              <video src={props.previewUrl} controls style={{ width: "100%", maxHeight: 300 }} />
              <p style={{ fontSize: 9, color: muted, padding: "6px 10px", background: "#080b10" }}>Draft quality preview. Final render will be higher quality.</p>
            </div>
          ) : (
            <div style={{ textAlign: "center", padding: 30 }}>
              <p style={{ fontSize: 14, color: muted }}>No preview available yet</p>
              <p style={{ fontSize: 10, color: "#3d5060", marginTop: 4 }}>Generate a preview from the Assembly Plan first.</p>
            </div>
          )}
        </div>
      ),
    },
    {
      title: "Export Settings",
      icon: "📦",
      content: (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Format", props.exportSettings.format.toUpperCase()],
              ["Quality", props.exportSettings.quality],
              ["Subtitles", props.exportSettings.includeSubtitles ? "Included" : "Not included"],
              ["Credits", props.exportSettings.includeCredits ? "Included" : "Not included"],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: "8px 12px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}` }}>
                <p style={{ fontSize: 9, color: muted, marginBottom: 2 }}>{label}</p>
                <p style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{value}</p>
              </div>
            ))}
          </div>
          {props.exportSettings.creditsText && (
            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 8 }}>
              <p style={{ fontSize: 10, color: gold, fontWeight: 600, marginBottom: 4 }}>Credits in Export</p>
              <p style={{ fontSize: 10, color: muted, lineHeight: 1.6, whiteSpace: "pre-wrap" as const }}>{props.exportSettings.creditsText}</p>
            </div>
          )}
        </div>
      ),
    },
  ];

  const hasBlockedLicenses = props.soundLicenses.some(l => l.license === "cc_by_nc" || l.license === "unknown");

  return (
    <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Review Before Export</h2>
        <span style={{ fontSize: 10, color: allApproved ? green : gold }}>
          {approvals.filter(Boolean).length}/{panels.length} approved
        </span>
      </div>

      {/* Panel tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, overflowX: "auto" }}>
        {panels.map((p, i) => (
          <button key={i} onClick={() => setActivePanel(i)}
            style={{ padding: "8px 12px", borderRadius: 8, border: `1px solid ${activePanel === i ? purple : border}`, background: activePanel === i ? `${purple}10` : "transparent", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
            <span style={{ fontSize: 12 }}>{p.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 500, color: activePanel === i ? purple : muted }}>{p.title}</span>
            {approvals[i] && <span style={{ fontSize: 10, color: green }}>✓</span>}
          </button>
        ))}
      </div>

      {/* Active panel content */}
      <div style={{ marginBottom: 16 }}>
        {panels[activePanel].content}
      </div>

      {/* Panel approval checkbox */}
      <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", padding: "10px 14px", background: approvals[activePanel] ? "rgba(34,197,94,0.05)" : "#080b10", border: `1px solid ${approvals[activePanel] ? "rgba(34,197,94,0.2)" : border}`, borderRadius: 10, marginBottom: 16 }}>
        <input type="checkbox" checked={approvals[activePanel]} onChange={() => toggleApproval(activePanel)}
          style={{ accentColor: green, width: 16, height: 16 }} />
        <span style={{ fontSize: 12, color: approvals[activePanel] ? green : "#fff", fontWeight: 500 }}>
          I have reviewed {panels[activePanel].title}
        </span>
      </label>

      {/* Final approve/reject */}
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={props.onApprove} disabled={!allApproved || hasBlockedLicenses}
          style={{ flex: 1, padding: 14, borderRadius: 12, border: "none", background: allApproved && !hasBlockedLicenses ? green : "#2a2a40", color: allApproved && !hasBlockedLicenses ? "#000" : muted, fontSize: 14, fontWeight: 700, cursor: allApproved && !hasBlockedLicenses ? "pointer" : "not-allowed" }}>
          {hasBlockedLicenses ? "Blocked — remove CC BY-NC / unknown assets" : allApproved ? "✓ Approve & Export" : `Review all ${panels.length} panels to export`}
        </button>
        <button onClick={() => props.onReject("User rejected during review")}
          style={{ padding: "14px 24px", borderRadius: 12, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 14, cursor: "pointer" }}>
          Reject
        </button>
      </div>
    </div>
  );
}
