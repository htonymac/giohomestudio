// GET  /api/ab-test — list all A/B tests
// POST /api/ab-test — create a new test with variants

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

const createSchema = z.object({
  name: z.string().min(1).max(200),
  contentItemId: z.string(),
  variants: z.array(z.object({
    label: z.string().max(10),
    title: z.string().max(200).optional(),
    caption: z.string().max(2000).optional(),
    hashtags: z.string().max(500).optional(),
  })).min(2).max(5),
});

export async function GET() {
  const tests = await db.aBTest.findMany({
    orderBy: { createdAt: "desc" },
    include: { variants: true },
    take: 50,
  });
  return NextResponse.json({ tests });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { name, contentItemId, variants } = parsed.data;

  const test = await db.aBTest.create({
    data: {
      name,
      contentItemId,
      variants: {
        create: variants.map(v => ({
          label: v.label,
          title: v.title,
          caption: v.caption,
          hashtags: v.hashtags,
        })),
      },
    },
    include: { variants: true },
  });

  return NextResponse.json(test, { status: 201 });
}
