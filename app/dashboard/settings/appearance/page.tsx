"use client";

import { useEffect, useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type ThemeId = "classic" | "editorial";

interface ThemeDef {
  id: ThemeId;
  name: string;
  tagline: string;
  badge: string;
  /** Token snapshot used by the mini preview below — kept literal so the
   *  thumbnail is an accurate, self-contained swatch of the theme even
   *  before the user activates it. */
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

// ── Mini thumbnail (shows bg + card + button in the theme's own tokens) ──────

function ThemeThumbnail({ preview }: { preview: ThemeDef["preview"] }) {
  const editorialMesh = preview.bg === "#18161d";
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        height: 200,
        borderRadius: 14,
        background: preview.bg,
        border: `1px solid ${preview.border}`,
        overflow: "hidden",
        fontFamily: preview.fontDisplay,
      }}
    >
      {/* Editorial-only: hint of the mesh blobs, very subtle */}
      {editorialMesh && (
        <>
          <div style={{ position: "absolute", top: -40, left: -30, width: 180, height: 180, borderRadius: "50%", background: "#c7b8ec", opacity: 0.18, filter: "blur(40px)" }} />
          <div style={{ position: "absolute", bottom: -40, right: -20, width: 160, height: 160, borderRadius: "50%", background: "#d9b8a0", opacity: 0.15, filter: "blur(40px)" }} />
        </>
      )}
      {/* Faux top label */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 14,
          fontFamily: preview.fontMono,
          fontSize: 9,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          color: preview.text2,
        }}
      >
        DASHBOARD · PREVIEW
      </div>
      {/* Sample card */}
      <div
        style={{
          position: "absolute",
          top: 40,
          left: 14,
          right: 14,
          bottom: 14,
          background: preview.surface,
          border: `1px solid ${preview.border}`,
          borderRadius: 12,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          backdropFilter: editorialMesh ? "blur(10px)" : undefined,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: preview.text, letterSpacing: "-0.02em", lineHeight: 1.1 }}>
          Good morning,
          <br />
          <span style={{ color: preview.accent }}>Henry.</span>
        </div>
        <div style={{ fontSize: 11, color: preview.text2, lineHeight: 1.45 }}>
          4 videos awaiting review · 2 scheduled posts today.
        </div>
        <div style={{ marginTop: "auto", display: "flex", gap: 8, alignItems: "center" }}>
          <button
            type="button"
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: preview.accent,
              color: preview.bg,
              border: "none",
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontFamily: preview.fontDisplay,
              cursor: "default",
            }}
          >
            Preview
          </button>
          <span
            style={{
              fontFamily: preview.fontMono,
              fontSize: 9,
              color: preview.text2,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
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
    // Also force-apply in case the pre-paint script was blocked
    setTheme(stored);
    setMounted(true);
  }, []);

  function handleActivate(id: ThemeId) {
    setTheme(id);
    setActive(id);
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-1 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: "var(--text)" }}>
          Appearance
        </h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
          Choose the visual theme GioHomeStudio uses across the dashboard. Your choice is saved to this device.
        </p>
      </div>

      {/* Info banner */}
      <div
        style={{
          background: "rgba(123,97,255,0.06)",
          border: "1px solid rgba(123,97,255,0.20)",
          borderRadius: 12,
          padding: "12px 16px",
        }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "var(--text2)" }}>
          <span style={{ fontWeight: 600, color: "var(--text)" }}>Phase A preview.</span>{" "}
          Theme plumbing is live; page-by-page migration lands in later phases. For now,
          switching themes only affects pages that reference the shared design tokens.
        </p>
      </div>

      {/* Theme grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {THEMES.map((t) => {
          const isActive = mounted && active === t.id;
          return (
            <div
              key={t.id}
              style={{
                position: "relative",
                background: "var(--surface2, #18182a)",
                border: isActive
                  ? "2px solid #d4a843"
                  : "1px solid var(--border, rgba(255,255,255,0.08))",
                borderRadius: 16,
                padding: 18,
                transition: "border-color 0.2s, box-shadow 0.2s, transform 0.2s",
                boxShadow: isActive
                  ? "0 0 0 4px rgba(212,168,67,0.12), 0 8px 24px rgba(0,0,0,0.4)"
                  : "0 2px 8px rgba(0,0,0,0.2)",
              }}
            >
              {/* Active badge */}
              {isActive && (
                <span
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    padding: "3px 10px",
                    borderRadius: 999,
                    background: "#d4a843",
                    color: "#080810",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Active
                </span>
              )}

              {/* Thumbnail */}
              <ThemeThumbnail preview={t.preview} />

              {/* Name + tagline */}
              <div style={{ marginTop: 16, display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", letterSpacing: "-0.01em" }}>
                  {t.name}
                </h2>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    borderRadius: 999,
                    background: "rgba(123,97,255,0.15)",
                    color: "#a89bff",
                    border: "1px solid rgba(123,97,255,0.25)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {t.badge}
                </span>
              </div>
              <p style={{ marginTop: 4, fontSize: 12, color: "var(--text2)" }}>{t.tagline}</p>

              {/* Activate button */}
              <button
                type="button"
                onClick={() => handleActivate(t.id)}
                disabled={isActive}
                style={{
                  marginTop: 14,
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 10,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.04em",
                  border: "none",
                  cursor: isActive ? "default" : "pointer",
                  fontFamily: "'Space Grotesk', system-ui, sans-serif",
                  background: isActive
                    ? "rgba(255,255,255,0.04)"
                    : "linear-gradient(135deg, #7b61ff, #9580ff)",
                  color: isActive ? "var(--text2)" : "#fff",
                  boxShadow: isActive ? "none" : "0 6px 18px rgba(123,97,255,0.28)",
                  transition: "all 0.15s ease",
                }}
              >
                {isActive ? "Currently active" : "Activate"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Footnote */}
      <p className="text-center text-[11px]" style={{ color: "var(--text3, #3a3a55)" }}>
        Theme choice is stored in <code style={{ fontFamily: "'JetBrains Mono', monospace" }}>localStorage.ghs_theme</code> on this device.
        Account-level theme sync will land with billing.
      </p>
    </div>
  );
}
