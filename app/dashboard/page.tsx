"use client";

// app/dashboard/page.tsx — v14 dashboard rewrite (Batch 2)
// Data sources preserved from original page:
//   /api/registry?limit=5&renderedOnly=1  → recentItems, totalCount
//   /api/review                            → reviewCount
//   /api/analytics                         → successCount (completed)
// Studio form (free-mode generation) moved to /dashboard/free-mode
// All emoji removed. Stroke SVG icons from app/components/icons.tsx.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { ds } from "../../lib/designSystem";
import LegalConsentModal from "../components/LegalConsentModal";
import Footer from "../components/Footer";

// Chrome
// TopBar is now provided globally by AppShell — the page-level one was a duplicate.

// Shared display components (batch 2)
import { HeroTitle } from "../components/hero/HeroTitle";
import { ComposeCard } from "../components/hero/ComposeCard";
import { StatCard } from "../components/stats/StatCard";
import { AlertBar } from "../components/feedback/AlertBar";
import { RenderDeck } from "../components/render/RenderDeck";
import { Panel } from "../components/layout/Panel";
import { QuickStartButton } from "../components/buttons/QuickStartButton";
import { ProjectRow } from "../components/project/ProjectRow";
import { ToolTile } from "../components/buttons/ToolTile";

// Icons
import {
  Alert,
  Bolt,
  Monitor,
  Star,
  Grid,
  Music,
  Clock,
  User,
  Folder,
  Cpu,
  Users,
} from "../components/icons";

// ── Types ──────────────────────────────────────────────────────────────────

type RegistryItem = {
  id: string;
  status: string;
  originalInput: string;
  mode: string;
  createdAt: string;
  mergedOutputPath?: string | null;
};

type RenderJobData = {
  id: string;
  title: string;
  engine: "Kling" | "Runway" | "Suno" | "FAL";
  format: string;
  duration: string;
  pct: number;
  eta: string;
  frame?: string;
  thumbVariant: 1 | 2 | 3;
};

// ── Adapter helpers ────────────────────────────────────────────────────────

// Map a registry item to a ProjectRow-compatible shape.
// thumbVariant cycles 1..4 by index position.
function itemToProjectRow(item: RegistryItem, idx: number) {
  const thumbVariant = ((idx % 4) + 1) as 1 | 2 | 3 | 4;
  const dateStr = new Date(item.createdAt).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "2-digit",
  });
  return {
    id: item.id,
    title: item.originalInput?.slice(0, 48) || "Untitled project",
    tag: item.mode ?? "Free",
    date: dateStr,
    thumbVariant,
    href: `/dashboard/content/${item.id}`,
  };
}

// ── Dashboard page ─────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();

  // Data fetched from existing API routes
  const [recentItems, setRecentItems] = useState<RegistryItem[]>([]);
  const [reviewCount, setReviewCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [successCount, setSuccessCount] = useState(0);

  // Active renders (the API doesn't expose a render-queue endpoint yet — empty until wired)
  // TODO(@opus): wire /api/render-queue when the endpoint exists.
  const [activeRenders, setActiveRenders] = useState<RenderJobData[]>([]);

  useEffect(() => {
    fetch("/api/registry?limit=5&renderedOnly=1")
      .then((r) => r.json())
      .then((d) => {
        setRecentItems(d.items ?? []);
        setTotalCount(d.total ?? 0);
      })
      .catch(() => {});

    fetch("/api/review")
      .then((r) => r.json())
      .then((d) => { setReviewCount(d.items?.length ?? 0); })
      .catch(() => {});

    fetch("/api/analytics")
      .then((r) => r.json())
      .then((d) => { setSuccessCount(d.summary?.successCount ?? 0); })
      .catch(() => {});
  }, []);

  // ComposeCard handler → navigate to free-mode with pre-filled prompt
  function handleRoll(prompt: string) {
    router.push(`/dashboard/free-mode?prompt=${encodeURIComponent(prompt)}`);
  }

  // Build typed stats object
  const stats = {
    total: totalCount,
    pendingReview: reviewCount,
    completed: successCount,
    creditSpent: 0, // no spend tracking API yet — show 0
  };

  // Adapt recent items → ProjectRow props
  const recentProjects = recentItems.slice(0, 4).map(itemToProjectRow);

  return (
    <>
      <LegalConsentModal />
    <main
      className="stagger"
      style={{
        padding: "22px 32px 48px",
        display: "flex",
        flexDirection: "column",
        gap: 22,
        minWidth: 0,
      }}
    >
      {/* ── Hero: HeroTitle + ComposeCard ─────────────── d-2 */}
      <section
        className="animate-rise d-2 gh-grid-hero"
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 22,
          alignItems: "end",
        }}
      >
        <HeroTitle
          kicker="Studio · Dashboard"
          title="Make the"
          italic="impossible"
          rest="before breakfast."
          sub="A studio that dreams out loud. Drop a scene, pick a format, roll camera — your reels land below."
        />
        <ComposeCard onRoll={handleRoll} />
      </section>

      {/* ── Stats row ─────────────────────────────────── d-3 */}
      <div
        className="animate-rise d-3 gh-grid-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 14,
        }}
      >
        <StatCard
          variant="a"
          label="Total Content"
          value={stats.total}
          delta={stats.total > 0 ? `${stats.total}` : "0"}
          sub="Across all modes"
        />
        <StatCard
          variant="b"
          label="Pending Review"
          value={stats.pendingReview}
          delta={stats.pendingReview > 0 ? `+${stats.pendingReview}` : "0"}
          sub="Needs your approval"
        />
        <StatCard
          variant="c"
          label="Completed"
          value={stats.completed}
          delta={stats.completed > 0 ? `+${stats.completed}` : "0"}
          sub="Approved this cycle"
        />
        <StatCard
          variant="d"
          label="Credit Spent"
          value={`$${stats.creditSpent.toFixed(2)}`}
          delta="0%"
          sub="Today · budget tracked"
        />
      </div>

      {/* ── Alert bar (only shown when review queue has items) ── d-4 */}
      {reviewCount > 0 && (
        <AlertBar
          className="animate-rise d-4"
          icon={<Alert size={16} />}
          message={
            <>
              <b>{reviewCount} item{reviewCount !== 1 ? "s" : ""}</b> in Review Queue waiting for your approval
            </>
          }
          cta="Review Now"
          href="/dashboard/review"
        />
      )}

      {/* AlertBar placeholder when queue empty — keeps d-4 in layout */}
      {reviewCount === 0 && (
        <AlertBar
          className="animate-rise d-4"
          icon={<Alert size={16} />}
          message="Review queue is clear — no items waiting."
          cta="Open Review"
          href="/dashboard/review"
        />
      )}

      {/* ── Render deck ─────────────────────────────────── d-5 */}
      <RenderDeck
        className="animate-rise d-5"
        jobs={activeRenders}
      />

      {/* ── Two-col: Quick Start + Recent Projects ──────── d-6 */}
      <div
        className="animate-rise d-6 gh-grid-2"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 18,
        }}
      >
        <Panel
          title="Quick Start"
          icon={<Bolt size={14} />}
          iconGrad={ds.grad.tile.active}
          action="Customize"
        >
          <QuickStartButton
            variant="primary"
            title="Make a Commercial"
            sub="Slide builder · overlays · brand kit"
            icon={<Monitor size={14} />}
            href="/dashboard/commercial-planner"
          />
          <QuickStartButton
            variant="v2"
            title="Free Mode — Describe Anything"
            sub="AI handles the rest"
            icon={<Star size={14} />}
            href="/dashboard/free-mode"
          />
          <QuickStartButton
            variant="v3"
            title="Browse Templates"
            sub="Starters · styles · prompts"
            icon={<Grid size={14} />}
            href="/dashboard/templates"
          />
          <QuickStartButton
            variant="v4"
            title="Open Music Studio"
            sub="Generate · score · mix"
            icon={<Music size={14} />}
            href="/dashboard/music-studio"
          />
        </Panel>

        <Panel
          title="Recent Projects"
          icon={<Clock size={14} />}
          iconGrad={ds.grad.tile.c4}
          action="View all"
          actionHref="/dashboard/review"
        >
          {recentProjects.length > 0 ? (
            recentProjects.map((p, i) => (
              <ProjectRow
                key={p.id}
                title={p.title}
                tag={p.tag}
                date={p.date}
                thumbVariant={p.thumbVariant}
                href={p.href}
                onReview={() => router.push(`/dashboard/review?highlight=${p.id}`)}
              />
            ))
          ) : (
            <div
              style={{
                padding: "20px 0",
                textAlign: "center",
                color: ds.color.mute,
                fontSize: 12,
                fontFamily: ds.font.sans,
              }}
            >
              No projects yet. Start creating.
            </div>
          )}
        </Panel>
      </div>

      {/* ── Tool tiles row ───────────────────────────────── d-7 */}
      <div
        className="animate-rise d-7 gh-grid-4"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 12,
        }}
      >
        <ToolTile
          variant="t1"
          title="Animate Actor"
          sub="Character motion"
          icon={<User size={16} />}
          href="/dashboard/free-mode?mode=image_to_video"
        />
        <ToolTile
          variant="t2"
          title="Asset Library"
          sub="Stock · uploads · brand"
          icon={<Folder size={16} />}
          href="/dashboard/assets"
        />
        <ToolTile
          variant="t3"
          title="AI Models"
          sub="Kling · Runway · FAL"
          icon={<Cpu size={16} />}
          href="/dashboard/models"
        />
        <ToolTile
          variant="t4"
          title="Characters"
          sub="Voices · looks · casts"
          icon={<Users size={16} />}
          href="/dashboard/character-voices"
        />
      </div>
    </main>
    <Footer />
    </>
  );
}
