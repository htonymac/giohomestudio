// Caption Compositor — type definitions
// Text roles and layout types for the HTML-based commercial caption system.

export type AspectRatio = "9:16" | "16:9" | "1:1";
export type CaptionPosition = "top" | "center" | "bottom";
export type PresetName = "realEstate" | "luxury" | "promo" | "minimal";

/** Output dimensions per aspect ratio — must match createSlideshowStatic DIMS2 */
export const RENDER_DIMS: Record<AspectRatio, { w: number; h: number }> = {
  "9:16":  { w: 832,  h: 1472 },
  "16:9":  { w: 1216, h: 832  },
  "1:1":   { w: 1024, h: 1024 },
};

/** Input to the HTML caption builder */
export interface CaptionRenderInput {
  /** Raw text — newlines create separate text blocks; first line is the headline */
  text: string;
  position: CaptionPosition;
  preset: PresetName;
  /** Optional font override — must be a system font available on Windows */
  fontOverride?: string;
  aspectRatio: AspectRatio;
}

export interface CaptionComposeInput {
  /** Absolute path to the source slide image */
  imagePath: string;
  /** Caption text; null/empty = no caption overlay, returns original image path */
  captionText: string | null | undefined;
  captionPosition?: CaptionPosition;
  captionPreset?: PresetName;
  fontOverride?: string;
  /** Unique identifier used in output filename */
  frameId: string;
  aspectRatio: AspectRatio;
  /** Directory to write composed output PNGs */
  workDir: string;
}

export interface ComposeResult {
  success: boolean;
  outputPath: string;
  error?: string;
}
