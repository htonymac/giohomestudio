"use client";

import Link from "next/link";
import { ds } from "../../../lib/designSystem";
import { Card } from "../ui/Card";
import { RenderJob } from "./RenderJob";
import { Plus } from "../icons";
import type { ComponentProps } from "react";

// v15 RenderDeck — header with conditional-pulse LIVE pill, grid of real job cards,
// or a single dashed empty-state card with "Start a generation" CTA.
// No decorative filmstrip marquee.

type RenderJobType = ComponentProps<typeof RenderJob>;

type Props = {
  jobs: RenderJobType[];
  className?: string;
  onStart?: () => void;
  startHref?: string;
};

function LivePill({ active }: { active: boolean }) {
  const color = active ? "#7ae0c3" : ds.color.mute2;
  return (
    <span
      className={active ? "pill-live pulse" : "pill-live"}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        background: ds.color.card,
        border: `1px solid ${color}35`,
        color: active ? "#fff" : ds.color.mute,
        fontFamily: ds.font.mono,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.2em",
        textTransform: "uppercase",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
      Live
    </span>
  );
}

function EmptyState({ href, onStart }: { href?: string; onStart?: () => void }) {
  const content = (
    <div
      style={{
        border: `1.5px dashed ${ds.color.line2}`,
        borderRadius: ds.radius.md,
        padding: "28px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        color: ds.color.mute,
        fontFamily: ds.font.sans,
        fontSize: 13,
        cursor: (href || onStart) ? "pointer" : "default",
        transition: "border-color .2s var(--e-soft), background .2s var(--e-soft)",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(167,139,250,.45)";
        (e.currentTarget as HTMLElement).style.background = "rgba(167,139,250,.04)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "rgba(255,255,255,.12)";
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    >
      <span
        style={{
          width: 40, height: 40, borderRadius: 10,
          display: "grid", placeItems: "center",
          background: "linear-gradient(135deg,#a78bfa,#ff9a3c)",
          color: "#fff", flexShrink: 0,
        }}
      >
        <Plus size={18} />
      </span>
      <span>
        <span style={{ display: "block", color: ds.color.ink, fontWeight: 700, marginBottom: 2 }}>
          No active renders
        </span>
        <span>Start a generation to see progress here.</span>
      </span>
    </div>
  );

  if (href)  return <Link href={href} style={{ textDecoration: "none" }}>{content}</Link>;
  if (onStart) return <button onClick={onStart} style={{ all: "unset", width: "100%" }}>{content}</button>;
  return content;
}

export function RenderDeck({ jobs, className, onStart, startHref = "/dashboard/free-mode" }: Props) {
  const activeJobs = jobs.slice(0, 6);
  const hasActive = activeJobs.some(j => {
    const pct = Math.min(100, Math.max(0, j.pct));
    const st = j.status ?? (pct >= 100 ? "Done" : pct <= 0 ? "Queued" : "Rendering");
    return st === "Rendering";
  });

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
          <LivePill active={hasActive} />
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
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Jobs grid or empty state */}
      {activeJobs.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: 12,
          }}
        >
          {activeJobs.map((job) => (
            <RenderJob key={job.id} {...job} />
          ))}
        </div>
      ) : (
        <EmptyState href={onStart ? undefined : startHref} onStart={onStart} />
      )}
    </Card>
  );
}

export default RenderDeck;
