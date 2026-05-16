// GHS Phase A — Project Settings API (updated 2026-05-14: imageFlipSeconds)
// GET  /api/project/settings?projectId=...   → returns settings or defaults if no row exists
// PATCH /api/project/settings                 → upserts fields, returns merged result

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Default values mirror the Prisma schema defaults exactly
const DEFAULTS = {
  visualStyle: "storybook",
  aspectRatio: "16:9",
  imageModelFamily: "flux",
  imageModelVersion: "auto",
  videoModelFamily: "wan",
  videoModelVersion: "auto",
  soundTier: "ghs-sound",
  narrationProvider: "auto",
  language: "en",
  subtitleEnabled: true,
  subtitleMode: "classic",
  subtitleHighlight: "#34d399",
  llmProvider: "auto",
  faceLockEnabled: true,
  imageFlipSeconds: 3,
  brandLogoUrl: null as string | null,
  brandPrimaryColor: "#a855f7",
  tenantId: null as string | null,
} as const;

type SettingsDefaults = typeof DEFAULTS;

// Shape returned on success
function ok(settings: Record<string, unknown>) {
  return NextResponse.json({ ok: true, settings });
}

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId || projectId.trim() === "") {
    return fail("projectId is required", 400);
  }

  try {
    const row = await prisma.projectSettings.findUnique({
      where: { projectId },
    });

    if (!row) {
      // Return defaults — NEVER throw on missing row
      return ok({
        projectId,
        id: null,
        createdAt: null,
        updatedAt: null,
        ...DEFAULTS,
      });
    }

    return ok(row);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return fail(`Database error: ${message}`, 500);
  }
}

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  let body: Record<string, unknown>;

  try {
    body = await req.json();
  } catch {
    return fail("Invalid JSON body", 400);
  }

  const { projectId, ...fields } = body;

  if (!projectId || typeof projectId !== "string" || projectId.trim() === "") {
    return fail("projectId is required and must be a non-empty string", 400);
  }

  // Strip unknown or protected fields — only allow valid setting keys
  const allowedKeys = new Set<string>([
    "tenantId",
    "visualStyle",
    "aspectRatio",
    "imageModelFamily",
    "imageModelVersion",
    "videoModelFamily",
    "videoModelVersion",
    "soundTier",
    "narrationProvider",
    "language",
    "subtitleEnabled",
    "subtitleMode",
    "subtitleHighlight",
    "llmProvider",
    "faceLockEnabled",
    "imageFlipSeconds",
    "brandLogoUrl",
    "brandPrimaryColor",
  ]);

  const sanitized: Record<string, unknown> = {};
  for (const key of Object.keys(fields)) {
    if (allowedKeys.has(key)) {
      sanitized[key] = fields[key];
    }
  }

  try {
    const result = await prisma.projectSettings.upsert({
      where: { projectId: projectId as string },
      update: sanitized,
      create: {
        projectId: projectId as string,
        ...(DEFAULTS as unknown as Omit<SettingsDefaults, "brandLogoUrl" | "tenantId">),
        brandLogoUrl: null,
        tenantId: null,
        ...sanitized,
      },
    });

    return ok(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return fail(`Database error: ${message}`, 500);
  }
}
