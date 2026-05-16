import { NextRequest, NextResponse } from "next/server";
import { runFullStoryQCPipeline } from "@/lib/story-supervisors";
import type { StoryContract, CastBibleEntry, ScenePlan } from "@/lib/story-supervisors/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, contract, castBible, scenes } = body as {
      storyText: string;
      contract: StoryContract;
      castBible?: CastBibleEntry[];
      scenes?: ScenePlan[];
    };

    if (!storyText || typeof storyText !== "string" || storyText.trim().length < 10) {
      return NextResponse.json({ error: "storyText is required (min 10 chars)" }, { status: 400 });
    }
    if (!contract || typeof contract !== "object") {
      return NextResponse.json({ error: "contract object is required" }, { status: 400 });
    }

    const result = await runFullStoryQCPipeline({
      storyText: storyText.trim(),
      contract,
      castBible: castBible ?? [],
      scenes: scenes ?? [],
    });

    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/story/supervise]", err);
    const message = err instanceof Error ? err.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
