// GHS Hybrid Pipeline Orchestrator
// Chains steps 2-13 into one coordinated flow
// Source of truth: update/GHS_HYBRID_MASTER_WORKFLOW.md

import type { HybridProjectStatus } from "./hybrid-types";

const BASE_URL = typeof window !== "undefined"
  ? window.location.origin
  : "http://localhost:3200";

interface PipelineInput {
  storyInput: string;
  genre?: string;
  tone?: string;
  targetDuration?: string;
  language?: string;
  costPreference?: string;
  audience?: string;
}

interface PipelineResult {
  projectId: string;
  status: HybridProjectStatus;
  step: number;
  error?: string;
}

type ProgressCallback = (step: number, total: number, message: string) => void;

async function callAPI(path: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "API call failed" }));
    throw new Error(err.error || `API ${path} failed with status ${res.status}`);
  }
  return res.json();
}

// Run the full hybrid pipeline from story input to draft review
export async function runHybridPipeline(
  input: PipelineInput,
  onProgress?: ProgressCallback
): Promise<PipelineResult> {
  const total = 8;
  let projectId = "";

  try {
    // Step 1: Story Expansion (pipeline step 2)
    onProgress?.(1, total, "Expanding story with AI intelligence...");
    const expansion = await callAPI("/api/hybrid/story-expand", {
      storyInput: input.storyInput,
      genre: input.genre,
      tone: input.tone,
      targetDuration: input.targetDuration,
      language: input.language,
      costPreference: input.costPreference,
      audience: input.audience,
    });

    // For now, use a client-side ID — the individual APIs will create DB records
    projectId = `hybrid_${Date.now()}`;

    // Step 2: Character Extraction (pipeline step 3)
    onProgress?.(2, total, "Extracting and registering characters...");
    const characters = await callAPI("/api/hybrid/character-extract", {
      expandedStory: expansion.expandedStory || expansion,
      projectId,
    });

    // Step 3: Scene Breakdown (pipeline steps 6-8)
    onProgress?.(3, total, "Breaking story into scenes with AI classification...");
    const scenes = await callAPI("/api/hybrid/scene-breakdown", {
      projectId,
      expandedStory: expansion.expandedStory || expansion,
      characters: (characters as { characters?: unknown[] }).characters || [],
    });

    // Step 4: Shot Planning (pipeline step 9)
    onProgress?.(4, total, "Planning shots for each scene...");
    await callAPI("/api/hybrid/shot-plan", {
      projectId,
    });

    // Step 5: Dialogue Mapping (pipeline step 10)
    onProgress?.(5, total, "Mapping dialogue to characters...");
    await callAPI("/api/hybrid/dialogue-map", {
      projectId,
    });

    // Step 6: Audio Planning (pipeline step 12)
    onProgress?.(6, total, "Planning audio layers per scene...");
    await callAPI("/api/hybrid/audio-plan", {
      projectId,
    });

    // Step 7: Validation (pipeline step 17)
    onProgress?.(7, total, "Validating continuity and consistency...");
    const validation = await callAPI("/api/hybrid/validate", {
      projectId,
    });

    // Step 8: Ready for review
    onProgress?.(8, total, "Pipeline complete — ready for review!");

    return {
      projectId,
      status: (validation as { valid?: boolean }).valid ? "VALIDATED" : "DRAFT_REVIEW",
      step: 8,
    };
  } catch (err) {
    return {
      projectId,
      status: "STORY_INPUT",
      step: 0,
      error: err instanceof Error ? err.message : "Pipeline failed",
    };
  }
}

// Run a single pipeline step
export async function runPipelineStep(
  step: number,
  projectId: string,
  data: Record<string, unknown> = {}
): Promise<{ success: boolean; error?: string; result?: unknown }> {
  const stepRoutes: Record<number, string> = {
    2: "/api/hybrid/story-expand",
    3: "/api/hybrid/character-extract",
    6: "/api/hybrid/scene-breakdown",
    9: "/api/hybrid/shot-plan",
    10: "/api/hybrid/dialogue-map",
    12: "/api/hybrid/audio-plan",
    17: "/api/hybrid/validate",
    18: "/api/hybrid/assemble",
  };

  const route = stepRoutes[step];
  if (!route) return { success: false, error: `Unknown step ${step}` };

  try {
    const result = await callAPI(route, { projectId, ...data });
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Step failed" };
  }
}
