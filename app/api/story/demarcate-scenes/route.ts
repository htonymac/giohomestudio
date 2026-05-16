import { NextRequest, NextResponse } from "next/server";
import { demarcateScenes } from "@/lib/story-supervisors/scene-demarcator";
import type { StoryContract, CastBibleEntry } from "@/lib/story-supervisors/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, contract, castBible = [] } = body;

    if (!storyText || !contract) {
      return NextResponse.json({ error: "storyText and contract are required" }, { status: 400 });
    }

    const result = await demarcateScenes(
      storyText,
      contract as StoryContract,
      castBible as CastBibleEntry[]
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("demarcate-scenes error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
