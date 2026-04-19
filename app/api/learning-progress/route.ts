// GET  /api/learning-progress — list progress records (optionally filtered by ageGroup/contentType)
// POST /api/learning-progress — create or update learning progress
//
// Powers: Learning Memory, Repetition Engine, Curriculum Continuity
// Tracks what was taught, suggests next topic, flags review-due items

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const ageGroup = req.nextUrl.searchParams.get("ageGroup");
  const contentType = req.nextUrl.searchParams.get("contentType");
  const childName = req.nextUrl.searchParams.get("childName");

  const where: Record<string, string> = {};
  if (ageGroup) where.ageGroup = ageGroup;
  if (contentType) where.contentType = contentType;
  if (childName) where.childName = childName;

  const records = await prisma.learningProgress.findMany({
    where,
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ records });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      id, childName, ageGroup, contentType, language, secondLanguage,
      topicsCovered, wordsLearned, conceptsMastered,
      currentLevel, nextSuggested, curriculumId, curriculumStep,
      newTopics, newWords, newConcepts, // append mode
    } = body;

    if (!ageGroup || !contentType) {
      return NextResponse.json({ error: "ageGroup and contentType required" }, { status: 400 });
    }

    // Update existing record
    if (id) {
      const existing = await prisma.learningProgress.findUnique({ where: { id } });
      if (!existing) return NextResponse.json({ error: "Record not found" }, { status: 404 });

      // Merge new topics/words/concepts with existing
      const existingTopics = (existing.topicsCovered as string[]) || [];
      const existingWords = (existing.wordsLearned as string[]) || [];
      const existingConcepts = (existing.conceptsMastered as string[]) || [];
      const existingReviewDue = (existing.reviewDue as string[]) || [];

      const mergedTopics = [...new Set([...existingTopics, ...(newTopics || topicsCovered || [])])];
      const mergedWords = [...new Set([...existingWords, ...(newWords || wordsLearned || [])])];
      const mergedConcepts = [...new Set([...existingConcepts, ...(newConcepts || conceptsMastered || [])])];

      // Repetition engine: topics from 3+ sessions ago that haven't been reviewed → review due
      const oldTopics = existingTopics.filter(t => !mergedTopics.slice(-5).includes(t));
      const reviewDue = [...new Set([...existingReviewDue, ...oldTopics])].slice(0, 10);

      const updated = await prisma.learningProgress.update({
        where: { id },
        data: {
          topicsCovered: mergedTopics,
          wordsLearned: mergedWords,
          conceptsMastered: mergedConcepts,
          currentLevel: currentLevel ?? existing.currentLevel,
          totalSessions: existing.totalSessions + 1,
          lastSessionDate: new Date(),
          nextSuggested: nextSuggested ?? null,
          reviewDue,
          curriculumStep: curriculumStep ?? existing.curriculumStep,
        },
      });

      return NextResponse.json({
        record: updated,
        reviewDueCount: reviewDue.length,
        suggestion: nextSuggested || suggestNext(mergedTopics, contentType, ageGroup),
      });
    }

    // Create new record
    const record = await prisma.learningProgress.create({
      data: {
        childName: childName || null,
        ageGroup,
        contentType,
        language: language || "en",
        secondLanguage: secondLanguage || null,
        topicsCovered: topicsCovered || [],
        wordsLearned: wordsLearned || [],
        conceptsMastered: conceptsMastered || [],
        currentLevel: currentLevel || 1,
        totalSessions: 1,
        lastSessionDate: new Date(),
        nextSuggested: nextSuggested || null,
        curriculumId: curriculumId || null,
        curriculumStep: curriculumStep || 0,
      },
    });

    return NextResponse.json({ record }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}

// ── Suggest next topic based on what's been covered ──
function suggestNext(covered: string[], contentType: string, ageGroup: string): string {
  const PROGRESSIONS: Record<string, Record<string, string[]>> = {
    toddler: {
      "letters-sounds": ["letter_A", "letter_B", "letter_C", "letter_D", "letter_E", "letter_F", "letter_G", "letter_H", "letter_I", "letter_J", "letter_K", "letter_L", "letter_M", "letter_N", "letter_O", "letter_P", "letter_Q", "letter_R", "letter_S", "letter_T", "letter_U", "letter_V", "letter_W", "letter_X", "letter_Y", "letter_Z"],
      "numbers-counting": ["count_1", "count_2", "count_3", "count_4", "count_5"],
      "colours-shapes": ["red", "blue", "yellow", "green", "orange", "purple", "circle", "square", "triangle"],
    },
    preschool: {
      phonics: ["cvc_at", "cvc_in", "cvc_og", "cvc_up", "cvc_en", "sight_the", "sight_is", "sight_a", "blends_sh", "blends_ch", "blends_th"],
      "early-maths": ["count_10", "count_20", "add_simple", "subtract_simple", "shapes_2d", "patterns_ab"],
    },
    early: {
      "reading-writing": ["digraphs", "long_vowels", "sentences", "paragraphs", "creative_writing"],
      mathematics: ["times_2", "times_5", "times_10", "fractions_half", "fractions_quarter", "time_oclock", "money_coins"],
    },
    older: {
      "advanced-maths": ["fractions_decimals", "percentages", "algebra_intro", "area_perimeter", "statistics"],
      "science-engineering": ["circuits", "forces", "space", "evolution", "design_challenge"],
    },
  };

  const progression = PROGRESSIONS[ageGroup]?.[contentType] || [];
  const next = progression.find(t => !covered.includes(t));
  return next ? `Next: ${next.replace(/_/g, " ")}` : "All topics covered — try review mode!";
}
