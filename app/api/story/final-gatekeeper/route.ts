import { NextRequest, NextResponse } from "next/server";
import { runFinalGatekeeper } from "@/lib/story-supervisors/final-gatekeeper";
import type { StoryContract, ScenePlan, SupervisorResult } from "@/lib/story-supervisors/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { supervisorResults, scenes, contract } = body as {
      supervisorResults: SupervisorResult[];
      scenes: ScenePlan[];
      contract: StoryContract;
    };

    if (!Array.isArray(supervisorResults) || supervisorResults.length === 0) {
      return NextResponse.json({ error: "supervisorResults array is required" }, { status: 400 });
    }
    if (!Array.isArray(scenes)) {
      return NextResponse.json({ error: "scenes array is required" }, { status: 400 });
    }
    if (!contract) {
      return NextResponse.json({ error: "contract is required" }, { status: 400 });
    }

    const result = runFinalGatekeeper(supervisorResults, scenes, contract);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/story/final-gatekeeper]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
