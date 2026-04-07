// POST /api/publish — publish a content item to a platform
// GET  /api/publish — list available publishers and their config status

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { telegramPublisher } from "@/modules/publisher/telegram";
import { youtubePublisher } from "@/modules/publisher/youtube";
import type { IPublisher, PublishInput } from "@/modules/publisher/types";

const publishers: IPublisher[] = [telegramPublisher, youtubePublisher];

const publishSchema = z.object({
  contentItemId: z.string(),
  platform:      z.string(),
  title:         z.string().max(200).optional(),
  caption:       z.string().max(5000).optional(),
  tags:          z.array(z.string()).optional(),
  destinationId: z.string().optional(),
});

export async function GET() {
  const platforms = publishers.map(p => ({
    platform: p.platform,
    configured: p.isConfigured(),
  }));
  return NextResponse.json({ platforms });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  const { contentItemId, platform, title, caption, tags, destinationId } = parsed.data;

  // Find the publisher
  const publisher = publishers.find(p => p.platform === platform);
  if (!publisher) {
    return NextResponse.json({ error: `Unknown platform: ${platform}` }, { status: 400 });
  }
  if (!publisher.isConfigured()) {
    return NextResponse.json({ error: `${platform} is not configured. Check Settings.` }, { status: 503 });
  }

  // Get the content item
  const item = await prisma.contentItem.findUnique({
    where: { id: contentItemId },
    select: { mergedOutputPath: true, voicePath: true, originalInput: true, status: true },
  });
  if (!item) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  }

  const mediaPath = item.mergedOutputPath ?? item.voicePath;
  if (!mediaPath) {
    return NextResponse.json({ error: "No output file to publish. Render first." }, { status: 400 });
  }

  const isVideo = mediaPath.endsWith(".mp4");
  const publishTitle = title ?? item.originalInput?.slice(0, 100) ?? "GioHomeStudio Content";
  const publishCaption = caption ?? "";

  const input: PublishInput = {
    contentItemId,
    mediaPath,
    mediaType: isVideo ? "video" : "audio",
    title: publishTitle,
    caption: publishCaption,
    tags,
    destinationId,
  };

  const result = await publisher.publish(input);

  // Log the publish action
  if (result.status === "published") {
    await prisma.alertLog.create({
      data: {
        contentItemId,
        channel: platform.toUpperCase() as "TELEGRAM" | "WHATSAPP" | "GMAIL",
        status: "SENT",
        message: `Published to ${platform}${result.postUrl ? `: ${result.postUrl}` : ""}`,
      },
    }).catch(() => {}); // alertLog may not have all enum values — ignore failures
  }

  return NextResponse.json(result, { status: result.status === "published" ? 200 : 502 });
}
