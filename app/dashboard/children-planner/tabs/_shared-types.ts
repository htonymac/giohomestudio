// Shared types between page.tsx and extracted tab components.
// Created during Wave 1 of children-planner segregation (2026-06-05).
//
// Centralizing these means parent + child see the SAME type — no variance
// errors from duplicate local re-declarations.

export type SceneRefineAction = "polish" | "upgrade" | "add-detail";
export type SceneOp = "funny" | "playful" | "adventure" | "emotional" | "add_action" | "establish" | "qc";

export interface ChildScene {
  scene: number;
  title?: string;
  visualDescription?: string;
  cameraDirection?: string;
  narration?: string;
}

export interface ScriptSegment {
  type: "narration" | "dialogue";
  speaker?: string;
  text: string;
}
