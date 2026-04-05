// CaptionPreview — React component that mirrors the HTML caption compositor exactly.
// Uses CSS transform: scale() to show the full-size render scaled to any preview size.
// Preview = export: same CSS rules, same overflow constraints, same layout.

"use client";

import React from "react";
import { PRESETS } from "@/modules/caption-compositor/presets";
import { RENDER_DIMS } from "@/modules/caption-compositor/types";
import type { PresetName, CaptionPosition, AspectRatio } from "@/modules/caption-compositor/types";

interface CaptionPreviewProps {
  captionText: string | null | undefined;
  captionPosition?: CaptionPosition;
  captionPreset?: PresetName;
  fontOverride?: string | null;
  aspectRatio: AspectRatio;
  /** Preview container width in px */
  previewWidth: number;
  /** Preview container height in px */
  previewHeight: number;
}

function parseLines(text: string): { headline: string; sublines: string[] } {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
  return { headline: lines[0] ?? "", sublines: lines.slice(1, 4) };
}

export default function CaptionPreview({
  captionText,
  captionPosition = "bottom",
  captionPreset = "realEstate",
  fontOverride,
  aspectRatio,
  previewWidth,
  previewHeight,
}: CaptionPreviewProps) {
  const text = captionText?.trim();
  if (!text) return null;

  const preset    = PRESETS[captionPreset] ?? PRESETS.realEstate;
  const { w, h }  = RENDER_DIMS[aspectRatio] ?? RENDER_DIMS["9:16"];
  const scale     = previewWidth / w;
  const { headline, sublines } = parseLines(text);

  if (!headline) return null;

  const fontStack = fontOverride ? `"${fontOverride}", ${preset.fontStack}` : preset.fontStack;

  // Match HTML builder gradient logic
  let gradient = preset.gradient;
  if (captionPosition === "top") {
    gradient = preset.gradient.replace("to top", "to bottom");
  } else if (captionPosition === "center") {
    gradient = "rgba(0,0,0,0.78)";
  }

  // Match HTML builder padding logic
  const padTop    = captionPosition === "center" ? 28 : captionPosition === "top" ? preset.padBottom : preset.padTop;
  const padBottom = captionPosition === "center" ? 28 : captionPosition === "top" ? preset.padTop    : preset.padBottom;

  const justifyContent =
    captionPosition === "top" ? "flex-start" :
    captionPosition === "center" ? "center" :
    "flex-end";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      {/* Scale the full render dimensions down to the preview container */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: w,
          height: h,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        {/* Layer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            justifyContent,
          }}
        >
          {/* Card */}
          <div
            style={{
              background: gradient,
              padding: `${padTop}px ${preset.padSide}px ${padBottom}px`,
              maxHeight: preset.maxCardHeight,
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              gap: preset.blockGap,
              flexShrink: 0,
            }}
          >
            {/* Headline */}
            <p
              style={{
                fontFamily: fontStack,
                fontSize: preset.headlineSize,
                fontWeight: preset.headlineWeight,
                color: preset.headlineColor,
                textTransform: preset.headlineTransform,
                letterSpacing: preset.headlineLetterSpacing,
                lineHeight: 1.15,
                wordBreak: "break-word",
                overflow: "hidden",
                display: "-webkit-box",
                WebkitLineClamp: preset.headlineLineClamp,
                WebkitBoxOrient: "vertical",
                textShadow: preset.textShadow,
              }}
            >
              {headline}
            </p>

            {/* Sublines */}
            {sublines.map((sub, i) => (
              <p
                key={i}
                style={{
                  fontFamily: fontStack,
                  fontSize: preset.sublineSize,
                  fontWeight: preset.sublineWeight,
                  color: preset.sublineColor,
                  letterSpacing: preset.sublineLetterSpacing,
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                  overflow: "hidden",
                  whiteSpace: "nowrap",
                  textOverflow: "ellipsis",
                  textShadow: "0 2px 10px rgba(0,0,0,0.85)",
                }}
              >
                {sub}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
