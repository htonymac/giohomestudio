// GioHomeStudio — Global Coordinator Zustand Store (BUG-01)
// Cross-planner project state with stage advancement guards.
// Advisory layer — tracks completion per section, blocks only assembly without story+scenes.

import { create } from "zustand";
import { persist } from "zustand/middleware";

// ── Types ──────────────────────────────────────────────────────────────────

export type CoordinatorStage =
  | "design"
  | "story"
  | "characters"
  | "sound"
  | "scenes"
  | "assembly"
  | "overview";

export type PlannerType =
  | "hybrid"
  | "children"
  | "movie"
  | "commercial"
  | "free-mode"
  | "music-video"
  | null;

export type SectionKey =
  | "design"
  | "story"
  | "characters"
  | "sound"
  | "scenes"
  | "assembly";

export interface SectionState {
  complete: boolean;
  // design
  visualStyle?: string;
  format?: string;
  // story
  text?: string;
  wordCount?: number;
  // characters
  count?: number;
  // sound
  voicesAssigned?: boolean;
  musicReady?: boolean;
  // scenes
  allImaged?: boolean;
  // assembly
  outputUrl?: string;
}

export interface CoordinatorState {
  projectId: string | null;
  plannerType: PlannerType;
  currentStage: CoordinatorStage;

  // Per-section completion flags + optional metadata
  design: SectionState;
  story: SectionState;
  characters: SectionState;
  sound: SectionState;
  scenes: SectionState;
  assembly: SectionState;

  // Actions
  setProjectId(id: string): void;
  setPlannerType(type: PlannerType): void;
  advanceStage(stage: CoordinatorStage): void;
  markComplete(section: SectionKey, data?: Partial<SectionState>): void;
  markIncomplete(section: SectionKey): void;
  reset(): void;

  // Guard: returns null if OK, or error message string if blocked
  canAdvanceTo(stage: CoordinatorStage): string | null;
}

// ── Default section state ──────────────────────────────────────────────────

const defaultSection = (): SectionState => ({ complete: false });

const defaultState = {
  projectId: null as string | null,
  plannerType: null as PlannerType,
  currentStage: "design" as CoordinatorStage,
  design: defaultSection(),
  story: defaultSection(),
  characters: defaultSection(),
  sound: defaultSection(),
  scenes: defaultSection(),
  assembly: defaultSection(),
};

// ── Stage advancement rules ────────────────────────────────────────────────
// Returns null = OK to advance, string = block reason

function checkCanAdvanceTo(
  stage: CoordinatorStage,
  state: typeof defaultState
): string | null {
  switch (stage) {
    case "design":
      return null; // always allowed

    case "story":
      if (!state.design.complete)
        return "Complete the Design step first — choose a visual style and format.";
      return null;

    case "characters":
      if (!state.story.complete)
        return "Write and expand your story first before adding characters.";
      return null;

    case "sound":
      if (!state.story.complete)
        return "Complete your story first before setting up audio.";
      return null;

    case "scenes":
      if (!state.story.complete)
        return "Expand your story first — scenes are generated from story text.";
      return null;

    case "assembly":
      if (!state.story.complete)
        return "Your story is not complete. Expand your story first.";
      if (!state.scenes.complete)
        return "Generate and finalize your scenes before assembling the video.";
      // Sound incomplete is advisory, not a hard block
      return null;

    case "overview":
      if (!state.assembly.complete)
        return "Assemble your video first to view the overview.";
      return null;

    default:
      return null;
  }
}

// ── Store ──────────────────────────────────────────────────────────────────

export const useCoordinatorStore = create<CoordinatorState>()(
  persist(
    (set, get) => ({
      ...defaultState,

      setProjectId(id: string) {
        set({ projectId: id });
      },

      setPlannerType(type: PlannerType) {
        set({ plannerType: type });
      },

      advanceStage(stage: CoordinatorStage) {
        const block = get().canAdvanceTo(stage);
        if (block) {
          // Guard: silently ignore blocked advances (caller should check first)
          console.warn(`[Coordinator] Blocked advance to "${stage}": ${block}`);
          return;
        }
        set({ currentStage: stage });
      },

      markComplete(section: SectionKey, data?: Partial<SectionState>) {
        set((state) => ({
          [section]: {
            ...state[section],
            ...data,
            complete: true,
          },
        }));
      },

      markIncomplete(section: SectionKey) {
        set((state) => ({
          [section]: {
            ...state[section],
            complete: false,
          },
        }));
      },

      reset() {
        set({ ...defaultState });
      },

      canAdvanceTo(stage: CoordinatorStage): string | null {
        const state = get();
        return checkCanAdvanceTo(stage, {
          projectId: state.projectId,
          plannerType: state.plannerType,
          currentStage: state.currentStage,
          design: state.design,
          story: state.story,
          characters: state.characters,
          sound: state.sound,
          scenes: state.scenes,
          assembly: state.assembly,
        });
      },
    }),
    {
      name: "ghs_coordinator",
      // Only persist data fields, not action functions
      partialize: (state) => ({
        projectId: state.projectId,
        plannerType: state.plannerType,
        currentStage: state.currentStage,
        design: state.design,
        story: state.story,
        characters: state.characters,
        sound: state.sound,
        scenes: state.scenes,
        assembly: state.assembly,
      }),
    }
  )
);

// ── Convenience hook alias ─────────────────────────────────────────────────

export function useCoordinator() {
  return useCoordinatorStore();
}
