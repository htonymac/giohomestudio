// POST /api/auto-creator/draft
// Generates a full content draft from a selected suggestion
// Returns: title, caption, hashtags, CTA, voice script, music direction, credit estimate

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

const SYSTEM_PROMPT = `You are GHM Draft Factory — a professional content creation assistant.

Given a content suggestion and media context, generate a complete publication-ready draft.

Return a JSON object with:
- "title": catchy headline (max 10 words)
- "caption": full caption text (2-4 sentences, engaging, with emojis where natural)
- "hashtags": array of 5-10 relevant hashtags (without #)
- "cta": call-to-action text
- "voice_script": narration script if this is video content (what the voiceover would say, 2-4 sentences, conversational tone)
- "music_mood": specific music direction
- "music_genre": genre suggestion
- "transitions": array of transition types to use (e.g. ["fade", "slide_left", "zoom"])
- "aspect_ratio": recommended format ("9:16" for reels/stories, "1:1" for posts, "16:9" for YouTube)
- "platform_tips": 1 sentence on what makes this work well on the target platform
- "estimated_credits": number (1-10 scale, based on complexity)

Be specific and creative. Write like a Nigerian/African social media pro. Make the caption and script sound natural, not robotic.

IMPORTANT: Return ONLY valid JSON. No markdown wrapping.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { suggestion, mediaNames, context } = body;

    if (!suggestion) {
      return NextResponse.json({ error: "No suggestion provided" }, { status: 400 });
    }

    const prompt = `Generate a full content draft for this idea:

Suggestion: ${JSON.stringify(suggestion)}

Media being used: ${(mediaNames as string[] ?? []).join(", ") || "user uploads"}

${context ? `User context: "${context}"` : ""}

Create a complete, ready-to-review draft. Return ONLY JSON.`;

    const result = await callLLM(prompt, SYSTEM_PROMPT, {
      role: "creative",
      maxTokens: 800,
      temperature: 0.6,
    });

    if (!result.ok) {
      // Fallback draft
      return NextResponse.json({
        draft: {
          title: suggestion.title ?? "Untitled Content",
          caption: suggestion.caption_preview ?? "Check this out!",
          hashtags: ["GioHomeStudio", "ContentCreator", "AI"],
          cta: suggestion.cta ?? "Learn More",
          voice_script: suggestion.description ?? "",
          music_mood: suggestion.music_mood ?? "upbeat",
          music_genre: "afrobeats",
          transitions: ["fade", "slide"],
          aspect_ratio: suggestion.type === "post" || suggestion.type === "flyer" ? "1:1" : "9:16",
          platform_tips: "Post during evening hours for maximum engagement.",
          estimated_credits: 3,
        },
        provider: "rule_based",
      });
    }

    try {
      let jsonText = result.text;
      const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonText = jsonMatch[0];
      const draft = JSON.parse(jsonText);
      return NextResponse.json({ draft, provider: result.provider });
    } catch {
      return NextResponse.json({
        draft: {
          title: suggestion.title, caption: suggestion.caption_preview,
          hashtags: ["GioHomeStudio"], cta: suggestion.cta,
          voice_script: suggestion.description, music_mood: suggestion.music_mood,
          music_genre: "afrobeats", transitions: ["fade"],
          aspect_ratio: "9:16", platform_tips: "Engage your audience with strong visuals.",
          estimated_credits: 3,
        },
        provider: "fallback",
      });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
