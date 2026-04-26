// POST /api/registry/bulk-delete
// Body: { ids: string[] }
// Deletes the specified ContentItems from the registry.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteContentItems } from "@/modules/content-registry";

const schema = z.object({ ids: z.array(z.string()).min(1).max(200) });

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "ids must be a non-empty array of strings" }, { status: 400 });
  }
  const { deleted } = await deleteContentItems(parsed.data.ids);
  return NextResponse.json({ deleted });
}
