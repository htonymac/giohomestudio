// POST /api/auto-creator/save
// Saves a completed auto-creator draft to the Content Registry
// so it appears in Asset Library / All Content / Review Queue.

import { NextRequest, NextResponse } from "next/server";
import { createContentItem } from "@/modules/content-registry";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { draft, suggestion, platform, format, mediaNames, tier } = body;

    if (!draft) {
      return NextResponse.json({ error: "No draft provided" }, { status: 400 });
    }

    // Build the original input from the draft content
    const originalInput = [
      draft.title,
      draft.caption,
      draft.voice_script,
    ].filter(Boolean).join("\n\n");

    // 1. Save to Content Registry (shows in All Content / Registry page)
    const item = await createContentItem({
      originalInput,
      mode: "FREE",
      aiAutoMode: true,
      aspectRatio: draft.aspect_ratio || "9:16",
      narrationScript: draft.voice_script || null,
      musicGenre: draft.music_genre || draft.music_mood || null,
      outputMode: format || null,
      storyContext: JSON.stringify({
        source: "auto-creator",
        suggestion: suggestion ? { id: suggestion.id, title: suggestion.title, type: suggestion.type, style: suggestion.style } : null,
        platform,
        format,
        tier,
        mediaNames: mediaNames || [],
        hashtags: draft.hashtags || [],
        cta: draft.cta || null,
        music_mood: draft.music_mood || null,
        transitions: draft.transitions || [],
        platform_tips: draft.platform_tips || null,
        estimated_credits: draft.estimated_credits || 0,
      }),
    });

    // 2. ALSO save to Asset Library JSON file (shows in Asset Library page)
    try {
      const assetFile = path.join(env.storagePath, "config", "asset-library.json");
      fs.mkdirSync(path.dirname(assetFile), { recursive: true });
      let assets: Array<Record<string, unknown>> = [];
      try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new file */ }

      // Use mergedOutputPath or videoPath if available, otherwise set a content-ref path
      // so Asset Library "Use" button can load by content ID
      const contentFilePath = item.mergedOutputPath || item.videoPath || `/api/content/${item.id}/media`;

      assets.unshift({
        id: `content_${item.id}`,
        type: "video",
        name: draft.title || "AI Content",
        description: (draft.caption || "").slice(0, 200),
        filePath: contentFilePath,
        thumbnailPath: "",
        tags: ["ai-content", "auto-creator", ...(draft.hashtags || []).slice(0, 5)],
        source: "auto-creator",
        provider: "ghs",
        createdAt: new Date().toISOString(),
        metadata: {
          contentId: item.id,
          platform: platform || null,
          voiceScript: draft.voice_script || null,
          musicMood: draft.music_mood || null,
          cta: draft.cta || null,
        },
      });

      fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
    } catch { /* best effort — DB save already succeeded */ }

    return NextResponse.json({
      success: true,
      contentId: item.id,
      message: "Saved to Asset Library & All Content",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[auto-creator/save] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
