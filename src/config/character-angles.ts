// Shared angle slot definitions for character reference image system.
// Used by upload-reference, generate-images routes, and the comfyui module.

export const VALID_ANGLES = new Set([
  "front", "three_quarter_left", "three_quarter_right", "profile", "full_body_front",
]);

export const ANGLE_LABELS: Record<string, string> = {
  front:               "Front face",
  three_quarter_left:  "3/4 Left",
  three_quarter_right: "3/4 Right",
  profile:             "Side profile",
  full_body_front:     "Full body",
};
