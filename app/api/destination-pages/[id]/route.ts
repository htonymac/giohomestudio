// GioHomeStudio — PATCH/DELETE /api/destination-pages/[id]

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  updateDestinationPage,
  deleteDestinationPage,
  getDestinationPage,
} from "@/modules/destination-pages";

const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK", "OTHER"] as const;

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  platform: z.enum(VALID_PLATFORMS).optional(),
  handle: z.string().optional(),
  notes: z.string().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const page = await updateDestinationPage(id, parsed.data);
    return NextResponse.json({ page });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await getDestinationPage(id);
    if (!existing) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    await deleteDestinationPage(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
