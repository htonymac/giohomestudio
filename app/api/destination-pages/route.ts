// GioHomeStudio — GET/POST /api/destination-pages

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  listDestinationPages,
  createDestinationPage,
} from "@/modules/destination-pages";

const VALID_PLATFORMS = ["YOUTUBE", "INSTAGRAM", "TIKTOK", "FACEBOOK", "OTHER"] as const;

const createSchema = z.object({
  name: z.string().min(1, "Name is required"),
  platform: z.enum(VALID_PLATFORMS),
  handle: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET() {
  const pages = await listDestinationPages();
  return NextResponse.json({ pages });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const page = await createDestinationPage(parsed.data);
    return NextResponse.json({ page }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
