// GioHomeStudio — Coordinator Status API (BUG-01)
// GET /api/hybrid/coordinator-status?projectId=...&plannerType=...
// Returns current stage, per-section status, and supervisor advice.

import { NextRequest, NextResponse } from "next/server";
import { runSupervisor, type SupervisorInput } from "../../../../src/modules/supervisor/index";

type CoordinatorStage = "design" | "story" | "characters" | "sound" | "scenes" | "assembly" | "overview";
type SectionKey = "design" | "story" | "characters" | "sound" | "scenes" | "assembly";

// Stage advancement rules (mirrors the store logic — server-side read)
function getSectionIssues(
  section: SectionKey,
  sectionData?: Record<string, unknown>
): string[] {
  const issues: string[] = [];
  if (!sectionData || !sectionData.complete) {
    issues.push(`${section} not yet marked complete`);
  }
  return issues;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const plannerType = searchParams.get("plannerType") ?? "hybrid";
    const rawPrompt = searchParams.get("prompt") ?? "";

    // Parse any section state passed as query params (optional, for richer advice)
    const designComplete = searchParams.get("designComplete") === "true";
    const storyComplete = searchParams.get("storyComplete") === "true";
    const charactersComplete = searchParams.get("charactersComplete") === "true";
    const soundComplete = searchParams.get("soundComplete") === "true";
    const scenesComplete = searchParams.get("scenesComplete") === "true";
    const assemblyComplete = searchParams.get("assemblyComplete") === "true";

    // Determine current stage from completion state
    let currentStage: CoordinatorStage = "design";
    if (designComplete) currentStage = "story";
    if (storyComplete) currentStage = "characters";
    if (charactersComplete && soundComplete) currentStage = "scenes";
    if (scenesComplete) currentStage = "assembly";
    if (assemblyComplete) currentStage = "overview";

    // Per-section status
    const sections: Record<SectionKey, { complete: boolean; issues: string[] }> = {
      design: { complete: designComplete, issues: designComplete ? [] : ["Choose visual style and format"] },
      story: { complete: storyComplete, issues: storyComplete ? [] : ["Write and expand story text"] },
      characters: { complete: charactersComplete, issues: charactersComplete ? [] : ["Add at least one character"] },
      sound: { complete: soundComplete, issues: soundComplete ? [] : ["Assign voices and music"] },
      scenes: { complete: scenesComplete, issues: scenesComplete ? [] : ["Generate and finalize scenes"] },
      assembly: { complete: assemblyComplete, issues: assemblyComplete ? [] : ["Run video assembly"] },
    };

    // Run supervisor for advice (non-blocking / rule-based)
    let supervisorAdvice = "No specific advice — continue building your project.";
    if (rawPrompt || storyComplete) {
      try {
        const supervisorInput: SupervisorInput = {
          rawPrompt: rawPrompt || `${plannerType} project${projectId ? ` (${projectId})` : ""}`,
        };
        const plan = await runSupervisor(supervisorInput, { blocking: false });
        const adviceParts: string[] = [];
        adviceParts.push(`Content type: ${plan.contentIntent || plannerType}`);
        if (!storyComplete) adviceParts.push("Expand your story to unlock scenes and characters.");
        if (storyComplete && !scenesComplete) adviceParts.push("Generate scenes from your story.");
        if (scenesComplete && !soundComplete) adviceParts.push("Assign voices and music — sound is ready to configure.");
        if (scenesComplete && soundComplete && !assemblyComplete) adviceParts.push("Ready to assemble. Run assembly to create your video.");
        if (assemblyComplete) adviceParts.push("Video assembled. Review in Overview tab.");
        supervisorAdvice = adviceParts.join(" ");
      } catch {
        supervisorAdvice = "Supervisor advice unavailable (Ollama offline — rule-based fallback active).";
      }
    }

    return NextResponse.json({
      projectId: projectId ?? null,
      plannerType,
      currentStage,
      sections,
      supervisorAdvice,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Coordinator status error: ${String(err)}` },
      { status: 500 }
    );
  }
}
