import { NextRequest, NextResponse } from "next/server";
import { runSupervisor } from "@/modules/supervisor";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.rawPrompt) return NextResponse.json({ error: "rawPrompt required" }, { status: 400 });

  // blocking=true: tries Ollama (up to 40s), falls back to rule_based
  // blocking=false (default in pipeline): returns rule_based instantly
  const blocking = body.blocking !== false; // API calls are blocking by default
  const plan = await runSupervisor(
    { rawPrompt: body.rawPrompt, overrides: body.overrides },
    { blocking }
  );

  return NextResponse.json({ plan });
}
