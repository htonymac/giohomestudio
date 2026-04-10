// POST /api/auto-creator/suggest
// AI-powered content suggestion engine
// Analyzes uploaded media descriptions and returns smart content ideas
// Uses the multi-provider LLM router (Claude → GPT → Grok → Ollama)

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

interface MediaItem {
  name: string;
  type: "image" | "video";
  tags?: string[];     // user-selected or auto-detected tags
  description?: string;
}

const SYSTEM_PROMPT = `You are GHM AI Content Creator — a premium AI content assistant for African creators and business owners.

Your job: analyze the user's uploaded media and their selected platform, then:
1. Detect what activities are shown in the media (e.g. market outing, product photos, event, fashion, food, property)
2. Suggest 4-6 smart content ideas optimized for their chosen platform

Return a JSON object with TWO keys:
- "activities": array of detected activities, each with: "label" (what was detected), "confidence" ("high" or "medium"), "icon" (single emoji)
- "suggestions": array of content ideas, each with:
  - "id": unique short id (e.g. "sug_1")
  - "title": short catchy title (max 8 words)
  - "type": one of "reel", "post", "commercial", "flyer", "story", "ad_video", "recap"
  - "style": one of "classy", "luxury", "hype", "storytelling", "cinematic", "minimalist", "premium_business", "playful", "direct_sales", "spiritual"
  - "description": 1-2 sentence description of what the content would look like
  - "caption_preview": a sample caption with emojis and hashtags, written for the target platform
  - "cta": suggested call-to-action text
  - "music_mood": suggested music mood (e.g. "afrobeats chill", "cinematic", "upbeat pop")
  - "estimated_duration": for video content, suggested seconds (15, 30, 60)

Be creative, relevant, practical. Write like a Nigerian/African social media pro. Optimize format, caption style, and duration for the specific platform.

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation, just the JSON object.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const media: MediaItem[] = body.media ?? [];
    const context: string = body.context ?? "";
    const platform: string = body.platform ?? "";
    const format: string = body.format ?? "";

    if (media.length === 0 && !context) {
      return NextResponse.json({ error: "No media or context provided" }, { status: 400 });
    }

    // Build the prompt
    const mediaDesc = media.map((m, i) =>
      `${i + 1}. ${m.type}: "${m.name}"${m.tags?.length ? ` [tags: ${m.tags.join(", ")}]` : ""}${m.description ? ` — ${m.description}` : ""}`
    ).join("\n");

    const platformInfo = platform ? `\nTarget platform: ${platform}${format ? ` (${format})` : ""}` : "";

    const prompt = `The user uploaded ${media.length} media file(s) today:

${mediaDesc}
${platformInfo}
${context ? `\nUser context: "${context}"` : ""}

First, analyze the filenames and media types to detect what activities the user did today (e.g. market outing, product photos, event, fashion shoot, food, property visit).

Then suggest 4-6 smart content ideas specifically optimized for ${platform || "social media"}${format ? ` (${format} format)` : ""}.

Return a JSON object with "activities" and "suggestions" arrays.`;

    const result = await callLLM(prompt, SYSTEM_PROMPT, {
      role: "creative",
      maxTokens: 1200,
      temperature: 0.7,
    });

    if (!result.ok) {
      // Fallback: generate rule-based suggestions when no LLM is available
      const suggestions = generateFallbackSuggestions(media);
      return NextResponse.json({ suggestions, provider: "rule_based" });
    }

    try {
      // Parse JSON from LLM response (handle potential markdown wrapping)
      let jsonText = result.text;
      // Try object format first (with activities + suggestions)
      const objMatch = jsonText.match(/\{[\s\S]*\}/);
      if (objMatch) {
        const parsed = JSON.parse(objMatch[0]);
        return NextResponse.json({
          activities: parsed.activities ?? [],
          suggestions: parsed.suggestions ?? parsed,
          provider: result.provider,
        });
      }
      // Fall back to array format
      const arrMatch = jsonText.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        const suggestions = JSON.parse(arrMatch[0]);
        return NextResponse.json({ suggestions, provider: result.provider });
      }
      throw new Error("No JSON found");
    } catch {
      const suggestions = generateFallbackSuggestions(media);
      return NextResponse.json({ suggestions, provider: "rule_based_fallback" });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Rule-based fallback when no LLM is available
function generateFallbackSuggestions(media: MediaItem[]) {
  const hasImages = media.some(m => m.type === "image");
  const hasVideos = media.some(m => m.type === "video");
  const tags = media.flatMap(m => m.tags ?? []);

  const suggestions = [];

  if (hasImages) {
    suggestions.push({
      id: "sug_1", title: "Product Showcase Reel", type: "reel", style: "premium_business",
      description: "Turn your images into a sleek product showcase with music and captions.",
      caption_preview: "New arrivals just dropped! Check these out #NewArrivals #Shopping",
      cta: "Shop Now", music_mood: "afrobeats chill", estimated_duration: 15,
    });
    suggestions.push({
      id: "sug_2", title: "Style Post", type: "post", style: "classy",
      description: "Create a polished image post with AI-enhanced visuals and branded caption.",
      caption_preview: "Bringing the energy today. #Style #Lagos",
      cta: "Follow for more", music_mood: "lofi chill", estimated_duration: 0,
    });
    suggestions.push({
      id: "sug_3", title: "Ad Flyer", type: "flyer", style: "hype",
      description: "Generate a promotional flyer with price badges and WhatsApp contact.",
      caption_preview: "Limited offer! Don't miss out #Promo #Deals",
      cta: "Order Now", music_mood: "none", estimated_duration: 0,
    });
  }

  if (hasVideos) {
    suggestions.push({
      id: "sug_4", title: "Event Recap Video", type: "recap", style: "cinematic",
      description: "Combine your video clips into a cinematic recap with transitions and music.",
      caption_preview: "What a day! Highlights from today's activities #Recap #BTS",
      cta: "Watch Full Video", music_mood: "cinematic epic", estimated_duration: 30,
    });
  }

  if (tags.includes("product") || tags.includes("business")) {
    suggestions.push({
      id: "sug_5", title: "Commercial Ad", type: "commercial", style: "premium_business",
      description: "Create a narrated commercial video for your products with professional voiceover.",
      caption_preview: "Quality you can trust. Now available! #Business #Quality",
      cta: "Contact Us", music_mood: "corporate upbeat", estimated_duration: 30,
    });
  }

  if (suggestions.length < 3) {
    suggestions.push({
      id: "sug_6", title: "Lifestyle Story", type: "story", style: "storytelling",
      description: "Share a personal brand moment — AI writes the story, you approve it.",
      caption_preview: "Another day, another blessing. #Grateful #MyJourney",
      cta: "Follow My Journey", music_mood: "inspirational", estimated_duration: 15,
    });
  }

  return suggestions;
}
