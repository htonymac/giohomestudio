"use client";

// ModelChip — small pill showing which AI model produced an output.
// Use over generated image/video cards. Pass modelId from the registry; if
// missing, falls back to a neutral "Generated" tag.
//
// Visual: tiny rounded badge with provider color stripe + model name + cost.

import { IMAGE_MODELS, VIDEO_MODELS } from "./ModelPicker";

interface ModelChipProps {
  modelId?: string | null;
  /** Used when modelId is unknown — produces a "Provider · Generated" pill. */
  provider?: string | null;
  size?: "xs" | "sm";
  position?: "static" | "absolute";
}

const PROVIDER_LABEL: Record<string, string> = {
  fal: "FAL",
  muapi: "MUAPI",
  segmind: "Segmind",
  runway: "Runway",
  kling: "Kling",
  kie: "KIE",
};

function inferProvider(token: string): string {
  const lower = token.toLowerCase();
  for (const key in PROVIDER_LABEL) {
    if (lower === key || lower.startsWith(`${key}_`)) return PROVIDER_LABEL[key];
  }
  return "AI";
}

export default function ModelChip({ modelId, provider, size = "xs", position = "absolute" }: ModelChipProps) {
  const id = modelId ?? "";
  const entry =
    IMAGE_MODELS.find(m => m.id === id) ||
    VIDEO_MODELS.find(m => m.id === id) ||
    null;

  if (!entry && !id && !provider) {
    return null;
  }

  const providerLabel = entry
    ? inferProvider(entry.id)
    : id
      ? inferProvider(id)
      : provider
        ? inferProvider(provider)
        : "AI";
  const name = entry?.name ?? (id || "Generated");
  const cost = entry?.cost ?? "";
  const badgeColor = entry?.badgeColor ?? "#7c5cfc";

  const fontSize = size === "xs" ? 9 : 10;
  const padY = size === "xs" ? 2 : 3;
  const padX = size === "xs" ? 5 : 6;

  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize,
    fontWeight: 600,
    padding: `${padY}px ${padX}px`,
    borderRadius: 6,
    background: "rgba(11, 11, 13, 0.85)",
    backdropFilter: "blur(4px)",
    color: "#e8e6e3",
    border: `1px solid ${badgeColor}40`,
    lineHeight: 1.1,
    letterSpacing: 0.2,
    whiteSpace: "nowrap",
    pointerEvents: "none",
    fontFamily: "var(--font-mono, ui-monospace, SFMono-Regular, Menlo, monospace)",
  };

  const positionStyle: React.CSSProperties =
    position === "absolute"
      ? { position: "absolute", top: 6, left: 6, zIndex: 5 }
      : {};

  return (
    <span style={{ ...baseStyle, ...positionStyle }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: badgeColor, flexShrink: 0 }} />
      <span style={{ color: "#a3a09b" }}>{provider}</span>
      <span>·</span>
      <span>{name}</span>
      {cost && (
        <>
          <span style={{ color: "#a3a09b" }}>·</span>
          <span style={{ color: "#a3a09b" }}>{cost}</span>
        </>
      )}
    </span>
  );
}
