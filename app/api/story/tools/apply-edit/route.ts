// app/api/story/tools/apply-edit/route.ts
// Phase D4 — Persist a confirmed collabo-edit resolution to StoryEditHistory
//
// POST { projectId, resolvedEdit: CollaboEditResult, confirmed: boolean }
// - if !confirmed → 400
// - if clarification_needed → 400 with specific_question
// - insert StoryEditHistory record → return { success: true, historyId }

import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Matches the IntentResult shape returned by /api/story/tools/collabo-edit
export interface CollaboEditResult {
  action: string;
  target_type: string;
  target_id: string;
  payload: Record<string, unknown>;
  scope: "low" | "medium" | "high";
  requiresRegeneration: boolean;
  estimatedCost: number;
  clarification_needed?: boolean;
  specific_question?: string;
}

interface ApplyEditBody {
  projectId: string;
  resolvedEdit: CollaboEditResult;
  confirmed: boolean;
}

export async function POST(req: NextRequest) {
  try {
    const body: ApplyEditBody = await req.json();
    const { projectId, resolvedEdit, confirmed } = body;

    if (!projectId || !resolvedEdit) {
      return NextResponse.json(
        { error: "Missing required fields: projectId, resolvedEdit" },
        { status: 400 }
      );
    }

    if (!confirmed) {
      return NextResponse.json(
        { error: "Edit not confirmed. Set confirmed: true to apply." },
        { status: 400 }
      );
    }

    if (resolvedEdit.clarification_needed) {
      return NextResponse.json(
        {
          error: "Clarification needed before applying edit.",
          specific_question: resolvedEdit.specific_question ?? "Please clarify your instruction.",
        },
        { status: 400 }
      );
    }

    // Build a human-readable instruction summary from the resolved edit
    const instruction = `${resolvedEdit.action} on ${resolvedEdit.target_type} ${resolvedEdit.target_id}`;
    const changeType = resolvedEdit.action;
    const scope = resolvedEdit.scope.toUpperCase();

    // Insert into StoryEditHistory
    const record = await prisma.storyEditHistory.create({
      data: {
        projectId,
        instruction,
        resolvedObjectId: resolvedEdit.target_id,
        changeType,
        scope,
        afterSnapshot: resolvedEdit.payload as object,
        undone: false,
      },
    });

    return NextResponse.json({ success: true, historyId: record.id });
  } catch (err) {
    console.error("[apply-edit] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
