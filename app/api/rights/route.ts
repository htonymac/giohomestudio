// POST /api/rights — Record a rights confirmation
// GET  /api/rights — List confirmations for a project
//
// Called when user confirms rights at point of risk:
// - using third-party faces/likeness
// - cloning/synthesizing voice
// - building endorsement-style content
// - transforming imported third-party media

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { projectId, projectType, confirmationType, confirmationText } = body;

    if (!confirmationType || !confirmationText) {
      return NextResponse.json({ error: "confirmationType and confirmationText required" }, { status: 400 });
    }

    const record = await prisma.rightsConfirmation.create({
      data: {
        projectId: projectId ?? null,
        projectType: projectType ?? null,
        confirmationType,
        confirmationText,
        acceptedVersion: "1.0",
      },
    });

    // Also log to audit trail
    await prisma.auditLog.create({
      data: {
        eventType: "rights_confirmed",
        projectId,
        projectType,
        details: JSON.parse(JSON.stringify({ confirmationType, confirmationText })),
      },
    });

    return NextResponse.json({ ok: true, id: record.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const records = await prisma.rightsConfirmation.findMany({
      where: projectId ? { projectId } : {},
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    return NextResponse.json({ confirmations: records });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
