"use client";

import { useEffect, useState } from "react";
import { ds } from "../../../../lib/designSystem";
import Card from "../../../components/ui/Card";
import ButtonPrimary from "../../../components/ui/ButtonPrimary";

// ── Types ────────────────────────────────────────────────────────────────────

type ThemeId = "classic" | "editorial";

interface ThemeDef {
  id: ThemeId;
  name: string;
  tagline: string;
  badge: string;
  preview: {
    bg: string;
    surface: string;
    text: string;
    text2: string;
    border: string;
    accent: string;
    fontDisplay: string;
    fontMono: string;
  };
}

// ── Theme definitions ────────────────────────────────────────────────────────

const THEMES: ThemeDef[] = [
  {
    id: "classic",
    name: "Classic",
    tagline: "Gold-on-black · high contrast",
    badge: "Signature",
    preview: {
      bg:          "#080810",
      surface:     "#13131f",
      text:        "#e8e8f4",
      text2:       "#8888aa",
      border:      "rgba(255,255,255,0.10)",
      accent:      "#d4a843",
      fontDisplay: "'Space Grotesk', system-ui, sans-serif",
      fontMono:    "'JetBrains Mono', monospace",
    },
  },
  {
    id: "editorial",
    name: "Editorial",
    tagline: "Warm charcoal · editorial pastels",
    badge: "New",
    preview: {
      bg:          "#18161d",
      surface:     "rgba(255,255,255,0.06)",
      text:        "#f2efe8",
      text2:       "#c9c4b8",
      border:      "rgba(242,239,232,0.14)",
      accent:      "#9a8ee0",
      fontDisplay: "'Geist', system-ui, sans-serif",
      fontMono:    "'JetBrains Mono', monospace",
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function setTheme(id: ThemeId) {
  try {
    document.documentElement.dataset.theme = id;
    localStorage.setItem("ghs_theme", id);
  } catch {
    /* ignore SSR / private-mode failures */
  }
}

function readStoredTheme(): ThemeId {
  try {
    const saved = localStorage.getItem("ghs_theme");
    if (saved === "editorial" || saved === "classic") return saved;
  } catch {
    /* noop */
  }
  return "classic";
}

// ── Mini thumbnail ───────────────────────────────────────────────────────────

function ThemeThumbnail({ preview }: { preview: ThemeDef["preview"] }) {
  const editorialMesh = preview.bg === "#18161d";
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        height: 200,
        borderRadius: ds.radius.md,
        background: preview.bg,
        border: `1px solid ${preview.border}`,
        overflow: "hidden",
        fontFamily: preview.fontDisplay,
      }}
    >
      {/* Editorial-only: subtle hint blobs — kept for thumbnail accuracy only */}
      {editorialMesh && (
        <>
          <div style={{ position: "absolute", top: -40, left: -30, width: 180, height: 180, borderRadius: "50%", background: "#c7b8ec", opacity: 0.18, filter: "blur(40px)" }} />
          <div style={{ position: "absolute", bottom: -40, right: -20, width: 160, height: 160, borderRadius: "50%", background: "#d9b8a0", opacity: 0.15, filter: "blur(40px)" }} />
        </>
      )}
      {/* Faux top label */}
      <div style={{ position: "absolute", top: 12, left: 14, fontFamily: preview.fontMono, fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: preview.text2 }}>
        DASHBOARD · PREVIEW
      </div>
      {/* Sample card */}
      <div style={{
        position: "absolute", top: 40, left: 14, right: 14, bottom: 14,
        background: preview.surface, border: `1px solid ${preview.border}`,
        borderRadius: 12, padding: 14,
        display: "flex", flexDirection: "column", gap: 10,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: preview.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Good morning,<br />
          <span style={{ color: preview.accent }}>Henry.</span>
        </div>
        <div style={{ fontSize: 11, color: preview.text2, lineHeight: 1.45 }}>
          4 videos awaiting review · 2 scheduled posts today.
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button type="button" style={{
            padding: "6px 12px", borderRadius: 999,
            background: preview.accent, color: preview.bg,
            border: "none", fontSize: 10, fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase",
            fontFamily: preview.fontDisplay, cursor: "default",
          }}>
            Preview
          </button>
          <span style={{ fontFamily: preview.fontMono, fontSize: 9, color: preview.text2, letterSpacing: "0.14em", textTransform: "uppercase" }}>
            sample · not live
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Page component ──────────────────────────────────────────────────────────

export default function AppearancePage() {
  const [active, setActive] = useState<ThemeId>("classic");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = readStoredTheme();
    setActive(stored);
    setTheme(stored);
    setMounted(true);
  }, []);

  function handleActivate(id: ThemeId) {
    setTheme(id);
    setActive(id);
  }

  return (
    <div style={{ width: "100%", maxWidth: 860, margin: "0 auto", padding: 4, display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Header */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.lilac, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: ds.font.mono, marginBottom: 4 }}>
          Dashboard
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: ds.color.ink, letterSpacing: "-0.03em", margin: 0 }}>
          Appearance
        </h1>
        <p style={{ fontSize: 13, color: ds.color.ink2, marginTop: 4 }}>
          Choose the visual theme GioHomeStudio uses across the dashboard. Your choice is saved to this device.
        </p>
      </div>

      {/* Info banner */}
      <Card padding="12px 16px" radius={ds.radius.md} style={{ borderColor: `${ds.color.lilac}30` }}>
        <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.6, margin: 0 }}>
          <span style={{ fontWeight: 600, color: ds.color.ink }}>Phase A preview.</span>{" "}
          Theme plumbing is live; page-by-page migration lands in later phases. For now,
          switching themes only affects pages that reference the shared design tokens.
        </p>
      </Card>

      {/* Theme grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        {THEMES.map((t) => {
          const isActive = mounted && active === t.id;
          return (
            <Card
              key={t.id}
              padding={18}
              radius={ds.radius.lg}
              style={{
                position: "relative",
                border: isActive ? `2px solid ${ds.color.lilac}` : `1px solid ${ds.color.line}`,
                boxShadow: isActive ? ds.shadow.lift : "none",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}
            >
              {/* Active badge */}
              {isActive && (
                <span style={{
                  position: "absolute", top: 14, right: 14,
                  padding: "3px 10px", borderRadius: ds.radius.pill,
                  background: ds.grad.hero, backgroundSize: ds.grad.heroSize,
                  animation: "btnSweep 6s linear infinite",
                  color: "#fff", fontSize: 10, fontWeight: 700,
                  letterSpacing: "0.08em", textTransform: "uppercase",
                  fontFamily: ds.font.mono,
                }}>
                  Active
                </span>
              )}

              <ThemeThumbnail preview={t.preview} />

              <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: ds.color.ink, letterSpacing: "-0.01em", margin: 0 }}>
                  {t.name}
                </h2>
                <span style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                  padding: "2px 8px", borderRadius: ds.radius.pill,
                  background: `${ds.color.lilac}18`, color: ds.color.lilac,
                  border: `1px solid ${ds.color.lilac}30`,
                  fontFamily: ds.font.mono,
                }}>
                  {t.badge}
                </span>
              </div>
              <p style={{ marginTop: 4, fontSize: 12, color: ds.color.ink2 }}>{t.tagline}</p>

              <ButtonPrimary
                onClick={() => handleActivate(t.id)}
                disabled={isActive}
                style={{ marginTop: 14, width: "100%" }}
              >
                {isActive ? "Currently active" : "Activate"}
              </ButtonPrimary>
            </Card>
          );
        })}
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: ds.color.mute2, paddingBottom: 8 }}>
        Theme choice is stored in{" "}
        <code style={{ fontFamily: ds.font.mono }}>localStorage.ghs_theme</code>{" "}
        on this device. Account-level theme sync will land with billing.
      </p>
    </div>
  );
}
