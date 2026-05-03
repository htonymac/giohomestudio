"use client";

// SupervisorStatusBar — Cross-section AI consistency checker
// Shows at bottom of every planner tab.
// Reads coordinator state, calls /api/hybrid/coordinator-status,
// shows per-section status and "Fix All" suggestions.

import { useState, useEffect, useCallback } from "react";
import * as Icon from "./icons";

// ── Types ────────────────────────────────────────────────────────────────────

export interface SupervisorSection {
  complete: boolean;
  issues: string[];
}

export interface SupervisorStatus {
  projectId?: string | null;
  plannerType?: string;
  currentStage?: string;
  sections: {
    design: SupervisorSection;
    story: SupervisorSection;
    characters: SupervisorSection;
    sound: SupervisorSection;
    scenes: SupervisorSection;
    assembly: SupervisorSection;
  };
  supervisorAdvice: string;
}

export interface SupervisorStatusBarProps {
  // Section completion state passed from the planner
  plannerType: "hybrid" | "children" | "movie" | "music-video" | "commercial" | "free-mode";
  projectId?: string | null;
  storyComplete?: boolean;
  designComplete?: boolean;
  charactersComplete?: boolean;
  soundComplete?: boolean;
  scenesComplete?: boolean;
  assemblyComplete?: boolean;
  // Optional story text for supervisor advice
  storyText?: string;
  // Callback when user requests auto-fix
  onAutoFix?: (section: string) => void;
  // Next-tab navigation — shown as a prominent button in the bar
  nextTabLabel?: string;   // e.g. "Scene Board"
  onNextTab?: () => void;  // fires setActiveTab(nextId)
  // Compact mode (single line) vs expanded
  compact?: boolean;
}

// ── Section label map ─────────────────────────────────────────────────────────

const SECTION_LABELS: Record<string, string> = {
  design: "Design",
  story: "Story",
  characters: "Characters",
  sound: "Sound",
  scenes: "Scenes",
  assembly: "Assembly",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SupervisorStatusBar({
  plannerType,
  projectId,
  storyComplete = false,
  designComplete = false,
  charactersComplete = false,
  soundComplete = false,
  scenesComplete = false,
  assemblyComplete = false,
  storyText = "",
  onAutoFix,
  nextTabLabel,
  onNextTab,
  compact = false,
}: SupervisorStatusBarProps) {
  const [status, setStatus] = useState<SupervisorStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        plannerType,
        designComplete: String(designComplete),
        storyComplete: String(storyComplete),
        charactersComplete: String(charactersComplete),
        soundComplete: String(soundComplete),
        scenesComplete: String(scenesComplete),
        assemblyComplete: String(assemblyComplete),
      });
      if (projectId) params.set("projectId", projectId);
      if (storyText) params.set("prompt", storyText.slice(0, 200));

      const res = await fetch(`/api/hybrid/coordinator-status?${params}`);
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
        setLastRefresh(Date.now());
      }
    } catch { /* supervisor offline — silent */ }
    setLoading(false);
  }, [plannerType, projectId, designComplete, storyComplete, charactersComplete, soundComplete, scenesComplete, assemblyComplete, storyText]);

  // Fetch on mount and when completion state changes
  useEffect(() => {
    fetchStatus();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designComplete, storyComplete, charactersComplete, soundComplete, scenesComplete, assemblyComplete]);

  if (!status) {
    return (
      <div style={{
        background: "rgba(10,13,20,0.7)",
        borderTop: "1px solid rgba(90,112,128,0.15)",
        padding: "6px 16px",
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: "#5a7080",
        fontSize: 12,
      }}>
        <Icon.Cpu size={12} />
        {loading ? "AI Supervisor checking pipeline..." : "AI Supervisor offline"}
      </div>
    );
  }

  const sections = status.sections;
  const sectionKeys = Object.keys(sections) as Array<keyof typeof sections>;
  const totalSections = sectionKeys.length;
  const completeSections = sectionKeys.filter(k => sections[k].complete).length;
  const warningSections = sectionKeys.filter(k => !sections[k].complete && sections[k].issues.length > 0);
  const allGreen = completeSections === totalSections;

  // ── Status color ──
  const barColor = allGreen
    ? "#22c55e"
    : warningSections.length > 2
    ? "#ef4444"
    : "#f59e0b";

  return (
    <div
      data-testid="supervisor-status-bar"
      style={{
        background: "rgba(10,13,20,0.95)",
        borderTop: `2px solid ${barColor}30`,
        position: "sticky",
        bottom: 0,
        zIndex: 40,
        fontSize: 12,
      }}
    >
      {/* ── Next Tab Button — prominent CTA to guide users forward ── */}
      {nextTabLabel && onNextTab && (
        <div style={{ padding: "10px 16px", borderBottom: "1px solid rgba(90,112,128,0.15)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <span style={{ color: "#5a7080", fontSize: 12 }}>
            {allGreen ? "All sections ready." : `${totalSections - completeSections} section${totalSections - completeSections !== 1 ? "s" : ""} remaining — you can continue.`}
          </span>
          <button
            onClick={onNextTab}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 22px",
              borderRadius: 10,
              background: "linear-gradient(135deg, #a78bfa, #7c3aed)",
              border: "none",
              color: "#fff",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 0 16px rgba(124,58,237,0.4)",
              flexShrink: 0,
            }}
          >
            Next: {nextTabLabel} →
          </button>
        </div>
      )}

      {/* ── Summary row ── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "6px 16px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded(prev => !prev)}
      >
        <Icon.Cpu size={13} style={{ color: barColor, flexShrink: 0 }} />

        {/* Section pills */}
        <div style={{ display: "flex", gap: 4, flex: 1, flexWrap: "wrap" }}>
          {sectionKeys.map(key => {
            const sec = sections[key];
            const isOk = sec.complete;
            const hasIssues = sec.issues.length > 0;
            return (
              <span
                key={key}
                data-testid={`supervisor-section-${key}`}
                data-status={isOk ? "ok" : hasIssues ? "warn" : "pending"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: isOk
                    ? "rgba(34,197,94,0.12)"
                    : hasIssues
                    ? "rgba(239,68,68,0.12)"
                    : "rgba(90,112,128,0.12)",
                  color: isOk ? "#22c55e" : hasIssues ? "#ef4444" : "#5a7080",
                  border: `1px solid ${isOk ? "#22c55e30" : hasIssues ? "#ef444430" : "#5a708030"}`,
                }}
              >
                {isOk ? "✓" : hasIssues ? "⚠" : "·"}
                {" "}{SECTION_LABELS[key]}
              </span>
            );
          })}
        </div>

        {/* Summary text */}
        <span style={{ color: "#5a7080", whiteSpace: "nowrap" }}>
          {completeSections}/{totalSections} done
        </span>

        {/* Refresh button */}
        <button
          onClick={(e) => { e.stopPropagation(); fetchStatus(); }}
          disabled={loading}
          style={{
            background: "transparent",
            border: "none",
            color: "#5a7080",
            cursor: "pointer",
            padding: "2px 4px",
            borderRadius: 4,
            fontSize: 11,
          }}
          title="Re-check pipeline"
        >
          {loading ? "..." : "↻"}
        </button>

        <Icon.ChevronRight
          size={12}
          style={{
            color: "#5a7080",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
          }}
        />
      </div>

      {/* ── Expanded detail panel ── */}
      {expanded && (
        <div style={{ padding: "8px 16px 12px", borderTop: "1px solid rgba(90,112,128,0.12)" }}>
          {/* Supervisor advice */}
          {status.supervisorAdvice && (
            <div style={{
              color: "#8fa8b8",
              marginBottom: 10,
              padding: "6px 10px",
              background: "rgba(90,112,128,0.08)",
              borderRadius: 6,
              borderLeft: "3px solid #5a7080",
            }}>
              <span style={{ color: "#5a7080", fontWeight: 600, fontSize: 11 }}>AI Supervisor: </span>
              {status.supervisorAdvice}
            </div>
          )}

          {/* Per-section detail */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6 }}>
            {sectionKeys.map(key => {
              const sec = sections[key];
              const isOk = sec.complete;
              return (
                <div
                  key={key}
                  style={{
                    padding: "6px 8px",
                    borderRadius: 6,
                    background: isOk ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)",
                    border: `1px solid ${isOk ? "#22c55e20" : "#ef444420"}`,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
                    <span style={{ color: isOk ? "#22c55e" : "#ef4444", fontSize: 13 }}>
                      {isOk ? "✓" : "✗"}
                    </span>
                    <span style={{ color: isOk ? "#22c55e" : "#c8d8e0", fontWeight: 600, fontSize: 11 }}>
                      {SECTION_LABELS[key]}
                    </span>
                    {onAutoFix && !isOk && (
                      <button
                        onClick={() => onAutoFix(key)}
                        style={{
                          marginLeft: "auto",
                          fontSize: 10,
                          padding: "1px 5px",
                          background: "rgba(168,100,255,0.15)",
                          border: "1px solid rgba(168,100,255,0.3)",
                          borderRadius: 3,
                          color: "#a864ff",
                          cursor: "pointer",
                        }}
                      >
                        Fix
                      </button>
                    )}
                  </div>
                  {sec.issues.length > 0 && (
                    <ul style={{ margin: 0, padding: "0 0 0 14px", color: "#8fa8b8", fontSize: 10 }}>
                      {sec.issues.map((issue, i) => (
                        <li key={i}>{issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>

          {/* Fix All button */}
          {onAutoFix && warningSections.length > 0 && (
            <button
              onClick={() => warningSections.forEach(k => onAutoFix(k))}
              style={{
                marginTop: 8,
                padding: "5px 12px",
                background: "rgba(168,100,255,0.15)",
                border: "1px solid rgba(168,100,255,0.3)",
                borderRadius: 6,
                color: "#a864ff",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Fix All ({warningSections.length} section{warningSections.length !== 1 ? "s" : ""})
            </button>
          )}

          {lastRefresh > 0 && (
            <div style={{ color: "#5a7080", fontSize: 10, marginTop: 6 }}>
              Last check: {new Date(lastRefresh).toLocaleTimeString()}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
