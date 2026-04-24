"use client";

import { ds } from "../../../lib/designSystem";
import { Card } from "../ui/Card";
import { PillLive } from "../ui/PillLive";
import { RenderJob } from "./RenderJob";
import type { ComponentProps } from "react";

// RenderDeck — card containing render queue header + 3-col job grid + FilmStrip marquee.
// Shows empty state if jobs=[].
// No ambient loops except PillLive dot (handled in PillLive) and CTA sweep.

type RenderJobType = ComponentProps<typeof RenderJob>;

type Props = {
  jobs: RenderJobType[];
  className?: string;
};

// FilmStrip marquee at the bottom (decorative, static frames)
function FilmStrip() {
  const frames = Array.from({ length: 8 }, (_, i) => i);
  const GRADS = [
    "linear-gradient(135deg,#a78bfa,#d17bff)",
    "linear-gradient(135deg,#7ae0c3,#7cc4ff)",
    "linear-gradient(135deg,#ff9a3c,#ffb347)",
    "linear-gradient(135deg,#d17bff,#ff7ab8)",
    "linear-gradient(135deg,#7cc4ff,#a78bfa)",
    "linear-gradient(135deg,#ffb347,#ff7a45)",
    "linear-gradient(135deg,#a78bfa,#ff9a3c)",
    "linear-gradient(135deg,#7ae0c3,#a78bfa)",
  ];

  return (
    <div
      style={{
        marginTop: 16,
        display: "flex",
        gap: 4,
        overflow: "hidden",
        borderRadius: 6,
        background: "#0b0b0d",
        padding: "6px 8px",
        alignItems: "center",
      }}
    >
      {/* Film perforations left */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>

      {/* Frames */}
      <div style={{ display: "flex", gap: 3, flex: 1, overflow: "hidden" }}>
        {frames.map((i) => (
          <div
            key={i}
            style={{
              width: 48,
              height: 36,
              borderRadius: 4,
              background: GRADS[i % GRADS.length],
              flexShrink: 0,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                inset: 0,
                backgroundImage:
                  "repeating-linear-gradient(0deg,rgba(0,0,0,0.15) 0px,rgba(0,0,0,0.15) 1px,transparent 1px,transparent 3px)",
              }}
            />
          </div>
        ))}
      </div>

      {/* Film perforations right */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 2,
              background: "rgba(255,255,255,0.1)",
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function RenderDeck({ jobs, className }: Props) {
  const activeJobs = jobs.slice(0, 3); // max 3 visible

  return (
    <Card className={className} padding={20} radius={18}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          marginBottom: 16,
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: ds.color.ink,
              fontFamily: ds.font.sans,
              letterSpacing: "-0.01em",
            }}
          >
            Render Queue
          </span>
          <PillLive label="Live" />
        </div>

        {jobs.length > 0 && (
          <span
            style={{
              fontFamily: ds.font.mono,
              fontSize: 10,
              color: ds.color.mute,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} queued
          </span>
        )}
      </div>

      {/* Jobs grid or empty state */}
      {activeJobs.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3,1fr)",
            gap: 12,
          }}
        >
          {activeJobs.map((job) => (
            <RenderJob key={job.id} {...job} />
          ))}
        </div>
      ) : (
        <div
          style={{
            padding: "32px 0",
            textAlign: "center",
            color: ds.color.mute,
            fontFamily: ds.font.sans,
            fontSize: 13,
          }}
        >
          No active renders. Start a generation to see progress here.
        </div>
      )}

      {/* FilmStrip */}
      <FilmStrip />
    </Card>
  );
}

export default RenderDeck;
