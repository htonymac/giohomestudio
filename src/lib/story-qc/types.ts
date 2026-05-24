// Story QC supervisor types — Wave 4 Phase A (2026-05-23).
// All 23 supervisors share this contract. Orchestrator routes inputs → registered supervisor → typed report.

export type SupervisorName =
  | "story_intake_profiler"
  | "story_contract_generator"
  | "story_screening"
  | "prompt_simplifier"
  | "culture_country"
  | "cast_bible_generator"
  | "cast_checking"
  | "prompt_vs_cast_consistency"
  | "scene_demarcator_timing"
  | "scene_density"
  | "emotion_intensifier"
  | "music_and_sound"
  | "music_continuity"
  | "dialogue_and_voice"
  | "subtitle_style"
  | "short_story"
  | "long_story"
  | "location_and_environment"
  | "costume_and_props"
  | "continuity"
  | "scene_prompt_builder"
  | "ai_provider_compatibility"
  | "final_assembly_gatekeeper";

export type SupervisorTier = "fast" | "smart" | "premium";

/** Input passed to a supervisor — a slice of project state plus context. */
export interface SupervisorInput {
  projectId: string;
  /** Always present: the current story text. */
  story?: string;
  /** Optional structured data the supervisor may read. */
  scenes?: Array<{ id?: string; title?: string; description?: string; durationSec?: number }>;
  characters?: Array<{ id?: string; name?: string; description?: string; voice?: string }>;
  music?: Array<{ sceneId?: string; genre?: string; mood?: string; durationSec?: number }>;
  subtitleConfig?: Record<string, unknown>;
  era?: string;
  culture?: string;
  language?: string;
  genre?: string;
  targetDurationSec?: number;
  draftHash?: string; // for change-detection / cache reuse
}

/** Output every supervisor returns. Mirrors StorySupervisorReport Prisma model. */
export interface SupervisorReport {
  supervisorName: SupervisorName;
  passed: boolean;
  score: number; // 0-100
  blockingIssues: string[];
  warnings: string[];
  suggestedFixes: string[];
  revisedData?: Record<string, unknown>; // supervisor-specific (e.g. cast_bible_generator returns the cast)
  runAt: string; // ISO timestamp
  durationMs?: number;
  modelUsed?: string;
}

export interface OrchestratorPlan {
  /** Which supervisors will run, in dependency order. */
  toRun: SupervisorName[];
  /** Supervisors skipped because their preconditions aren't met. */
  skipped: Array<{ name: SupervisorName; reason: string }>;
  /** Estimated total cost in USD (best-effort). */
  estimatedCostUsd: number;
}

export interface OrchestratorResult {
  projectId: string;
  draftHash: string;
  plan: OrchestratorPlan;
  reports: SupervisorReport[];
  /** Overall pass = every blocking supervisor passed. Non-blocking warns don't fail. */
  overallPassed: boolean;
  /** Aggregated blocking issues across all supervisors. */
  blockingIssues: string[];
  /** Aggregated warnings across all supervisors. */
  warnings: string[];
  /** Aggregated suggested fixes. */
  suggestedFixes: string[];
  ranAt: string;
  totalDurationMs: number;
}

/** A registered supervisor definition. */
export interface SupervisorDef {
  name: SupervisorName;
  description: string;
  /** Project fields this supervisor needs to do its job. If any required input is missing, supervisor is skipped. */
  requires: Array<keyof SupervisorInput>;
  /** If true, a failed/blocked report fails the overall orchestration. False = warning only. */
  blocking: boolean;
  /** LLM tier — controls cost vs quality. Most supervisors use "fast"; complex ones use "smart". */
  tier: SupervisorTier;
  /** Other supervisors that must complete BEFORE this one. */
  dependsOn?: SupervisorName[];
  /** Custom skip predicate. If returns a string reason, supervisor is skipped. */
  shouldSkip?: (input: SupervisorInput) => string | null;
  /** Build the LLM prompt. Pure function — no IO. */
  buildPrompt(input: SupervisorInput): { system: string; user: string };
  /** Parse LLM response → typed report. Catch parse errors and surface as warnings. */
  parse(rawText: string, input: SupervisorInput): Omit<SupervisorReport, "supervisorName" | "runAt" | "durationMs" | "modelUsed">;
}
