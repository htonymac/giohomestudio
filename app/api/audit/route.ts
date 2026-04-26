// POST /api/audit — Log an audit event
// GET  /api/audit — List audit logs (filterable)
//
// Logs critical trust and assembly events:
// - upload approvals, export approvals
// - rights confirmations
// - sound asset usage with license type
// - attribution generated
// - planner/supervisor tier used
// - assembly status changes

import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const log = await prisma.auditLog.create({
      data: {
        eventType: body.eventType ?? "unknown",
        projectId: body.projectId ?? null,
        projectType: body.projectType ?? null,
        details: body.details ? (body.details as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        soundAssetId: body.soundAssetId ?? null,
        licenseType: body.licenseType ?? null,
        attributionGenerated: body.attributionGenerated ?? null,
        plannerTier: body.plannerTier ?? null,
        supervisorTier: body.supervisorTier ?? null,
        providerUsed: body.providerUsed ?? null,
        assemblyJsonVersion: body.assemblyJsonVersion ?? null,
        previewStatus: body.previewStatus ?? null,
        renderStatus: body.renderStatus ?? null,
        sourceType: body.sourceType ?? null,
        stayedLocal: body.stayedLocal ?? true,
      },
    });

    return NextResponse.json({ ok: true, id: log.id });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const projectId = req.nextUrl.searchParams.get("projectId");
    const eventType = req.nextUrl.searchParams.get("eventType");
    const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50");

    const where: Record<string, unknown> = {};
    if (projectId) where.projectId = projectId;
    if (eventType) where.eventType = eventType;

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: Math.min(limit, 200),
    });

    return NextResponse.json({ logs, count: logs.length });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown" }, { status: 500 });
  }
}
