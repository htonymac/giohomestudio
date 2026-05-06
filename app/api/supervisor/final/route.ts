import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { callLLM } from "@/lib/llm";
import type { PreflightResult } from "@/app/api/hybrid/pre-flight/route";

// ── Final / Overall Supervisor ────────────────────────────────────────────────
// POST body: { projectId }
//
// Steps:
//   1. Call /api/hybrid/pre-flight internally with the project's current state
//   2. If pre-flight has blocking errors (canAssemble === false), return immediately
//   3. Otherwise call Claude Sonnet for a final quality check on the project summary
//   4. Return { canAssemble, preFlightResult, llmCheck, summary }

interface LLMCheck {
  pass: boolean;
  warnings: string[];
  blockers: string[];
}

interface FinalSupervisorResult {
  canAssemble: boolean;
  preFlightResult: PreflightResult;
  llmCheck: LLMCheck;
  summary: string;
}

/** Parse LLM response into blockers + warnings */
function parseLLMCheck(raw: string): LLMCheck {
  // Try JSON first
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      const blockers: string[] = Array.isArray(parsed.blockers)
        ? parsed.blockers.map(String)
        : [];
      const warnings: string[] = Array.isArray(parsed.warnings)
        ? parsed.warnings.map(String)
        : [];
      return { pass: blockers.length === 0, warnings, blockers };
    }
  } catch { /* fall through */ }

  // Text parsing fallback
  const blockers: string[] = [];
  const warnings: string[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let section: "blockers" | "warnings" | null = null;

  for (const line of lines) {
    if (/blocker|critical|must.fix|cannot.assemble/i.test(line) && line.length < 80) {
      section = "blockers";
      continue;
    }
    if (/warning|suggest|consider|recommend/i.test(line) && line.length < 80) {
      section = "warnings";
      continue;
    }
    const cleaned = line.replace(/^[-•*\d.]\s*/, "").trim();
    if (cleaned.length < 5 || cleaned.length > 300) continue;
    if (section === "blockers") blockers.push(cleaned);
    else if (section === "warnings") warnings.push(cleaned);
  }

  return { pass: blockers.length === 0, warnings, blockers };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { projectId?: string };
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    // ── Step 1: Load project from DB ──────────────────────────────────────────
    const project = await prisma.hybridProject.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          include: { audioPlan: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: `Project not found: ${projectId}` }, { status: 404 });
    }

    // ── Step 2: Call pre-flight ───────────────────────────────────────────────
    // Build the pre-flight payload from actual DB state
    const scenesForPreflight = project.scenes.map((s) => ({
      sceneId: s.sceneId,
      imageUrl: s.generatedAssetUrl ?? undefined,
      title: s.title,
    }));

    const preflightPayload = {
      projectType: project.audience === "children" ? "children" : "movie",
      story: project.storyInput,
      scenes: scenesForPreflight,
      audioConfig: {
        autoMusic: true, // assume auto music as default
      },
      characters: [],
    };

    // Determine base URL for internal fetch
    const host = req.headers.get("host") ?? "localhost:3200";
    const protocol = host.startsWith("localhost") ? "http" : "https";
    const baseUrl = `${protocol}://${host}`;

    let preFlightResult: PreflightResult;

    try {
      const pfRes = await fetch(`${baseUrl}/api/hybrid/pre-flight`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(preflightPayload),
        signal: AbortSignal.timeout(15000),
      });

      if (!pfRes.ok) {
        throw new Error(`Pre-flight HTTP ${pfRes.status}`);
      }

      preFlightResult = await pfRes.json() as PreflightResult;
    } catch (pfErr) {
      // Pre-flight call failed — construct a synthetic result
      console.error("[final supervisor] pre-flight call failed:", pfErr);
      preFlightResult = {
        checks: [
          {
            id: "preflight_unreachable",
            label: "Pre-flight check",
            status: "warn",
            detail: `Could not reach pre-flight: ${String(pfErr)}`,
            autoFixAvailable: false,
          },
        ],
        canAssemble: true, // don't block on infra failure
        blockingErrors: 0,
        warnings: 1,
      };
    }

    // ── Step 3: If pre-flight has critical blockers, return early ─────────────
    if (!preFlightResult.canAssemble) {
      const blockerDetails = preFlightResult.checks
        .filter((c) => c.status === "error")
        .map((c) => c.detail ?? c.label);

      return NextResponse.json({
        canAssemble: false,
        preFlightResult,
        llmCheck: {
          pass: false,
          warnings: [],
          blockers: blockerDetails,
        },
        summary:
          `Pre-flight check failed with ${preFlightResult.blockingErrors} blocking error(s). ` +
          `Fix these before assembly: ${blockerDetails.join("; ")}`,
      } satisfies FinalSupervisorResult);
    }

    // ── Step 4: LLM quality check ─────────────────────────────────────────────
    const sceneCount = project.scenes.length;
    const withImage = project.scenes.filter((s) => s.generatedAssetUrl).length;
    const withAudioPlan = project.scenes.filter((s) => s.audioPlan).length;
    const characterCount = (project.characterIds ?? []).length;
    const pfWarnings = preFlightResult.checks
      .filter((c) => c.status === "warn")
      .map((c) => `- ${c.label}${c.detail ? `: ${c.detail}` : ""}`)
      .join("\n");

    const llmPrompt =
      `You are a final quality supervisor for an AI video project. ` +
      `Review the project state below and flag any issues that should be resolved before assembly.\n\n` +
      `Project: "${project.title}"\n` +
      `Story length: ${project.storyInput?.length ?? 0} characters\n` +
      `Scenes: ${sceneCount} total, ${withImage} with images (${sceneCount - withImage} missing)\n` +
      `Characters: ${characterCount}\n` +
      `Audio plans: ${withAudioPlan}/${sceneCount} scenes have audio plans\n` +
      `Language: ${project.language ?? "English"}\n` +
      `Audience: ${project.audience ?? "general"}\n` +
      `Pre-flight warnings:\n${pfWarnings || "  (none)"}\n\n` +
      `Identify:\n` +
      `- BLOCKERS: critical issues that will cause assembly to fail or produce unusable output\n` +
      `- WARNINGS: quality issues that should ideally be fixed but won't block assembly\n\n` +
      `Return JSON only:\n` +
      `{\n` +
      `  "blockers": ["blocker 1"],\n` +
      `  "warnings": ["warning 1", "warning 2"]\n` +
      `}\n` +
      `If everything looks good, return { "blockers": [], "warnings": [] }.`;

    const llmRes = await callLLM(
      llmPrompt,
      "You are a professional video production quality supervisor. Be concise and actionable.",
      { role: "quality", maxTokens: 400, temperature: 0.2 },
    );

    let llmCheck: LLMCheck;
    if (llmRes.ok) {
      llmCheck = parseLLMCheck(llmRes.text);
    } else {
      console.warn("[final supervisor] LLM check failed:", llmRes.error);
      llmCheck = {
        pass: true,
        warnings: [`LLM check unavailable (${llmRes.error}) — manual review recommended.`],
        blockers: [],
      };
    }

    // ── Step 5: Compose final result ──────────────────────────────────────────
    const canAssemble = preFlightResult.canAssemble && llmCheck.pass;

    let summary: string;
    if (canAssemble) {
      summary =
        `Project ready for assembly. ` +
        `${sceneCount} scenes, ${withImage} with images. ` +
        (llmCheck.warnings.length > 0
          ? `${llmCheck.warnings.length} optional improvement(s) available.`
          : "All checks passed.");
    } else {
      const allBlockers = [...llmCheck.blockers];
      summary =
        `Assembly blocked. ${allBlockers.length} critical issue(s): ${allBlockers.slice(0, 3).join("; ")}.`;
    }

    return NextResponse.json({
      canAssemble,
      preFlightResult,
      llmCheck,
      summary,
    } satisfies FinalSupervisorResult);
  } catch (err) {
    console.error("[final supervisor] error:", err);
    return NextResponse.json(
      { error: "Final supervisor check failed", details: String(err) },
      { status: 500 },
    );
  }
}
