import { NextRequest, NextResponse } from "next/server";
import { generateCastBible } from "@/lib/story-supervisors/cast-bible";
import type { StoryContract } from "@/lib/story-supervisors/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { storyText, contract, existingChars } = body;

    if (!storyText || !contract) {
      return NextResponse.json({ error: "storyText and contract are required" }, { status: 400 });
    }

    const result = await generateCastBible(
      storyText,
      contract as StoryContract,
      existingChars
    );

    return NextResponse.json(result);
  } catch (err) {
    console.error("build-cast-bible error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
