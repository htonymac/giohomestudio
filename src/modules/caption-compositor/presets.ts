// Caption Compositor — style presets
// Each preset defines the full visual treatment for a caption card.
// Values are at full render resolution (e.g. 832×1472 for 9:16).

import type { PresetName } from "./types";

export interface CaptionPreset {
  /** CSS gradient for the card background */
  gradient: string;
  /** Headline font stack — system fonts only (no network requests in Playwright) */
  fontStack: string;
  headlineSize: number;
  headlineWeight: string;
  headlineColor: string;
  headlineTransform: "uppercase" | "none";
  headlineLetterSpacing: string;
  headlineLineClamp: number;
  sublineSize: number;
  sublineWeight: string;
  sublineColor: string;
  sublineLetterSpacing: string;
  textShadow: string;
  /** Padding: side, top (inside card, above first text block), bottom */
  padSide: number;
  padTop: number;
  padBottom: number;
  /** Gap between text blocks in px */
  blockGap: number;
  /** Max card height as CSS value — prevents overflow beyond image bounds */
  maxCardHeight: string;
}

export const PRESETS: Record<PresetName, CaptionPreset> = {
  realEstate: {
    gradient: "linear-gradient(to top, rgba(4,6,20,0.96) 0%, rgba(4,6,20,0.82) 55%, transparent 100%)",
    fontStack: '"Arial Black", "Arial", sans-serif',
    headlineSize: 68,
    headlineWeight: "900",
    headlineColor: "#FFFFFF",
    headlineTransform: "uppercase",
    headlineLetterSpacing: "0.025em",
    headlineLineClamp: 2,
    sublineSize: 34,
    sublineWeight: "500",
    sublineColor: "rgba(255,255,255,0.82)",
    sublineLetterSpacing: "0.01em",
    textShadow: "0 3px 14px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,0.8)",
    padSide: 52,
    padTop: 28,
    padBottom: 72,
    blockGap: 14,
    maxCardHeight: "52%",
  },

  luxury: {
    gradient: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.84) 55%, transparent 100%)",
    fontStack: '"Georgia", "Times New Roman", serif',
    headlineSize: 62,
    headlineWeight: "700",
    headlineColor: "#D4AF37",
    headlineTransform: "uppercase",
    headlineLetterSpacing: "0.07em",
    headlineLineClamp: 2,
    sublineSize: 30,
    sublineWeight: "400",
    sublineColor: "rgba(255,255,255,0.80)",
    sublineLetterSpacing: "0.02em",
    textShadow: "0 2px 16px rgba(0,0,0,0.97), 0 0 32px rgba(212,175,55,0.14)",
    padSide: 56,
    padTop: 32,
    padBottom: 76,
    blockGap: 16,
    maxCardHeight: "50%",
  },

  promo: {
    gradient: "linear-gradient(to top, rgba(0,0,0,0.94) 0%, rgba(0,0,0,0.76) 58%, transparent 100%)",
    fontStack: '"Impact", "Arial Black", sans-serif',
    headlineSize: 78,
    headlineWeight: "900",
    headlineColor: "#FBBF24",
    headlineTransform: "uppercase",
    headlineLetterSpacing: "0.01em",
    headlineLineClamp: 2,
    sublineSize: 38,
    sublineWeight: "600",
    sublineColor: "rgba(255,255,255,0.92)",
    sublineLetterSpacing: "0.005em",
    textShadow: "0 4px 18px rgba(0,0,0,0.97), 0 2px 6px rgba(0,0,0,0.85)",
    padSide: 48,
    padTop: 24,
    padBottom: 64,
    blockGap: 12,
    maxCardHeight: "55%",
  },

  minimal: {
    gradient: "linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.48) 65%, transparent 100%)",
    fontStack: '"Arial", "Helvetica", sans-serif',
    headlineSize: 52,
    headlineWeight: "700",
    headlineColor: "#FFFFFF",
    headlineTransform: "none",
    headlineLetterSpacing: "0.01em",
    headlineLineClamp: 3,
    sublineSize: 28,
    sublineWeight: "400",
    sublineColor: "rgba(255,255,255,0.78)",
    sublineLetterSpacing: "0.01em",
    textShadow: "0 2px 12px rgba(0,0,0,0.88)",
    padSide: 52,
    padTop: 24,
    padBottom: 64,
    blockGap: 12,
    maxCardHeight: "45%",
  },

  // Business — clean professional sans, solid high-contrast bar (Henry 2026-06-19).
  business: {
    gradient: "linear-gradient(to top, rgba(10,15,30,0.97) 0%, rgba(10,15,30,0.88) 60%, transparent 100%)",
    fontStack: '"Helvetica Neue", "Arial", sans-serif',
    headlineSize: 60,
    headlineWeight: "800",
    headlineColor: "#FFFFFF",
    headlineTransform: "none",
    headlineLetterSpacing: "0.005em",
    headlineLineClamp: 2,
    sublineSize: 32,
    sublineWeight: "500",
    sublineColor: "rgba(255,255,255,0.85)",
    sublineLetterSpacing: "0.01em",
    textShadow: "0 2px 12px rgba(0,0,0,0.9)",
    padSide: 50,
    padTop: 26,
    padBottom: 68,
    blockGap: 13,
    maxCardHeight: "50%",
  },

  // Corporate — uppercase, blue accent, structured (Henry 2026-06-19).
  corporate: {
    gradient: "linear-gradient(to top, rgba(8,20,45,0.97) 0%, rgba(8,20,45,0.86) 58%, transparent 100%)",
    fontStack: '"Segoe UI", "Arial", sans-serif',
    headlineSize: 58,
    headlineWeight: "700",
    headlineColor: "#5AB0FF",
    headlineTransform: "uppercase",
    headlineLetterSpacing: "0.03em",
    headlineLineClamp: 2,
    sublineSize: 30,
    sublineWeight: "500",
    sublineColor: "rgba(255,255,255,0.82)",
    sublineLetterSpacing: "0.015em",
    textShadow: "0 2px 14px rgba(0,0,0,0.92)",
    padSide: 52,
    padTop: 28,
    padBottom: 70,
    blockGap: 14,
    maxCardHeight: "50%",
  },
};
