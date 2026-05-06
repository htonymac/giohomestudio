// GET  /api/free-mode/daily-limits?userKey=...  — returns today's usage
// POST /api/free-mode/daily-limits              — increments a counter
//   body: { userKey, type: "image" | "video" }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createHash } from "crypto";

export const IMAGE_LIMIT = 20;
export const VIDEO_LIMIT = 10;
// Owner / localhost gets unlimited (9999) — no daily cap while developing/testing
const OWNER_IMAGE_LIMIT = 9999;
const OWNER_VIDEO_LIMIT = 9999;

function getToday(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  return (forwarded?.split(",")[0].trim() ?? req.headers.get("x-real-ip") ?? "unknown");
}

function isLocalhost(ip: string): boolean {
  return ip === "127.0.0.1" || ip === "::1" || ip === "localhost" || ip === "unknown";
}

function getUserKeyFromReq(req: NextRequest): string {
  const ip = getClientIp(req);
  return createHash("sha256").update(ip + "-free-mode").digest("hex").slice(0, 32);
}

export async function GET(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isLocalhost(ip)) {
      // Owner / local dev — unlimited
      return NextResponse.json({
        imageCount: 0, videoCount: 0,
        imageLimit: OWNER_IMAGE_LIMIT, videoLimit: OWNER_VIDEO_LIMIT,
        imageRemaining: OWNER_IMAGE_LIMIT, videoRemaining: OWNER_VIDEO_LIMIT,
      });
    }

    const { searchParams } = new URL(req.url);
    const userKey = searchParams.get("userKey") ?? getUserKeyFromReq(req);
    const date    = getToday();

    const usage = await prisma.freeModeDailyUsage.findUnique({
      where: { userKey_date: { userKey, date } },
    });

    return NextResponse.json({
      imageCount: usage?.imageCount ?? 0,
      videoCount: usage?.videoCount ?? 0,
      imageLimit: IMAGE_LIMIT,
      videoLimit: VIDEO_LIMIT,
      imageRemaining: IMAGE_LIMIT - (usage?.imageCount ?? 0),
      videoRemaining: VIDEO_LIMIT - (usage?.videoCount ?? 0),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (isLocalhost(ip)) {
      // Owner — never consume limit, always return max
      return NextResponse.json({
        imageCount: 0, videoCount: 0,
        imageLimit: OWNER_IMAGE_LIMIT, videoLimit: OWNER_VIDEO_LIMIT,
        imageRemaining: OWNER_IMAGE_LIMIT, videoRemaining: OWNER_VIDEO_LIMIT,
      });
    }

    const body    = await req.json();
    const type    = String(body.type ?? "") as "image" | "video";
    const userKey = String(body.userKey ?? getUserKeyFromReq(req));
    const date    = getToday();

    if (type !== "image" && type !== "video") {
      return NextResponse.json({ error: "type must be image or video" }, { status: 400 });
    }

    const existing = await prisma.freeModeDailyUsage.findUnique({
      where: { userKey_date: { userKey, date } },
    });

    const currentCount = type === "image"
      ? (existing?.imageCount ?? 0)
      : (existing?.videoCount ?? 0);

    const limit = type === "image" ? IMAGE_LIMIT : VIDEO_LIMIT;
    if (currentCount >= limit) {
      return NextResponse.json(
        { error: `Daily ${type} limit reached (${limit}/day)`, limitReached: true },
        { status: 429 }
      );
    }

    const updated = await prisma.freeModeDailyUsage.upsert({
      where: { userKey_date: { userKey, date } },
      create: {
        userKey, date,
        imageCount: type === "image" ? 1 : 0,
        videoCount: type === "video" ? 1 : 0,
      },
      update: type === "image"
        ? { imageCount: { increment: 1 } }
        : { videoCount: { increment: 1 } },
    });

    return NextResponse.json({
      imageCount:      updated.imageCount,
      videoCount:      updated.videoCount,
      imageLimit:      IMAGE_LIMIT,
      videoLimit:      VIDEO_LIMIT,
      imageRemaining:  IMAGE_LIMIT - updated.imageCount,
      videoRemaining:  VIDEO_LIMIT - updated.videoCount,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
