// POST /api/content/[id]/suggest-continuation
// Analyses a completed content item and returns smart continuation suggestions
// the user can click to continue the story in the Studio.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateContinuationSuggestions } from "@/modules/supervisor";
import type { OrchestrationPlan } from "@/modules/supervisor";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const item = await prisma.contentItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const plan = item.supervisorPlan as OrchestrationPlan | null;

  const suggestions = generateContinuationSuggestions(
    item.originalInput,
    item.narrationScript,
    plan,
    item.castingEthnicity,
    item.castingGender,
  );

  // Include the source item's key settings so the Studio can pre-fill them
  const sourceSettings = {
    castingEthnicity:  item.castingEthnicity,
    castingGender:     item.castingGender,
    castingAge:        item.castingAge,
    castingCount:      item.castingCount,
    cultureContext:    item.cultureContext,
    aspectRatio:       item.aspectRatio,
    visualStyle:       item.visualStyle,
    videoType:         item.videoType,
    voiceId:           item.voiceId,
    voiceLanguage:     item.voiceLanguage,
    audioMode:         item.audioMode,
    musicMood:         (plan?.inferredMusicMood as string) ?? undefined,
    storyThreadId:     item.storyThreadId ?? item.id,  // create a new thread if first scene
    previousItemInput: item.originalInput.slice(0, 100),
  };

  return NextResponse.json({ suggestions, sourceSettings });
}
