// POST /api/story-qc/run
// Body: { projectId, input: SupervisorInput, supervisors?: SupervisorName[] }
// Runs the orchestrator. Returns OrchestratorResult.
//
// Wave 4 Phase A scaffolding (2026-05-23) — replaces the 8 fragmented per-mode
// supervisors with one orchestration brain wrapping 23 designed supervisors.

import { NextRequest, NextResponse } from "next/server";
import { runOrchestrator, buildPlan } from "@/lib/story-qc/orchestrator";
import type { SupervisorInput, SupervisorName } from "@/lib/story-qc/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      projectId?: string;
      input?: SupervisorInput;
      supervisors?: SupervisorName[];
      planOnly?: boolean;
    };

    const projectId = body.projectId ?? body.input?.projectId;
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }
    const input: SupervisorInput = { ...(body.input ?? {}), projectId };

    // Plan-only mode = just preview what would run, no LLM calls
    if (body.planOnly) {
      const plan = buildPlan(input, body.supervisors);
      return NextResponse.json({ plan, projectId });
    }

    const result = await runOrchestrator(input, body.supervisors);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  // Diagnostic: list all registered supervisors
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { allSupervisors } = require("@/lib/story-qc/registry") as typeof import("@/lib/story-qc/registry");
  return NextResponse.json({
    count: allSupervisors().length,
    supervisors: allSupervisors().map(s => ({
      name: s.name,
      description: s.description,
      requires: s.requires,
      blocking: s.blocking,
      tier: s.tier,
      dependsOn: s.dependsOn ?? [],
    })),
  });
}
