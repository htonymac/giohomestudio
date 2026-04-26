// POST /api/music-video/text-to-mv
// Text-to-Music-Video entry flow.
// User types a concept/prompt → Claude generates:
//   - song title
//   - lyrics (verse + chorus)
//   - music video storyboard scenes
//   - song analysis (mood, energy, genre, sections)
//
// This is a real LLM call — no mocks.
//
// Request:  { prompt: string; videoMode?: string; visualStyle?: string }
// Response: { title, lyrics, analysis, storyboard }

import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface StoryboardScene {
  scene: number;
  section: string;
  duration: string;
  prompt: string;
  style: string;
  movement: string;
  caption: string;
  genMethod: string;
  status: string;
}

function errorResponse(msg: string, status = 500) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return errorResponse("ANTHROPIC_API_KEY not set — cannot run text-to-music-video generation.", 503);
  }

  let prompt = "";
  let videoMode = "official";
  let visualStyle = "Cinematic";

  try {
    const body = await req.json();
    prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
    videoMode = typeof body.videoMode === "string" ? body.videoMode : "official";
    visualStyle = typeof body.visualStyle === "string" ? body.visualStyle : "Cinematic";
  } catch {
    return errorResponse("Invalid JSON body.", 400);
  }

  if (!prompt) {
    return errorResponse("prompt is required.", 400);
  }

  try {
    const client = new Anthropic({ apiKey: key });

    const systemPrompt = `You are a music video director and lyricist. Given a user concept, create a complete music video plan.

Return ONLY strict JSON with this exact shape:
{
  "title": "Song Title",
  "lyrics": "Verse 1 lyrics here\\n\\nChorus lyrics here\\n\\nVerse 2 lyrics here\\n\\nChorus lyrics here",
  "analysis": {
    "energy": "high",
    "mood": "emotional",
    "genre": "Pop",
    "sections": "intro, verse, chorus, verse 2, chorus, outro",
    "bpm": 120,
    "danceability": 0.7,
    "cameraStyle": "smooth tracking with dramatic cuts",
    "recommendedModel": "fal_kling_2_5_standard"
  },
  "storyboard": [
    {
      "scene": 1,
      "section": "Intro",
      "duration": "4-6s",
      "prompt": "Detailed visual description for AI video generation",
      "style": "${visualStyle}",
      "movement": "slow zoom in",
      "caption": "Opening lyric line",
      "genMethod": "image-to-video",
      "status": "planned"
    }
  ]
}

Rules:
- Generate 5-8 storyboard scenes covering intro, verse, chorus, bridge, outro
- Each prompt should be specific enough for AI video generation (20-40 words)
- Chorus scenes use "video-led" genMethod, others use "image-to-video"
- videoMode is "${videoMode}" — adjust visual style accordingly
- Keep lyrics authentic and song-like (rhyme scheme, rhythm)
- No markdown, no code fences. JSON only.`;

    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Create a music video for this concept: "${prompt}"`,
        },
      ],
    });

    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text)
      .join("")
      .trim();

    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end === -1) {
      return errorResponse("LLM returned invalid JSON — no object found.");
    }

    const parsed = JSON.parse(text.slice(start, end + 1));

    // Validate essential fields
    const title = typeof parsed.title === "string" ? parsed.title : prompt.slice(0, 40);
    const lyrics = typeof parsed.lyrics === "string" ? parsed.lyrics : "";
    const analysis = parsed.analysis ?? {
      energy: "medium",
      mood: "cinematic",
      genre: "Pop",
      sections: "intro, verse, chorus, outro",
    };
    const storyboard: StoryboardScene[] = Array.isArray(parsed.storyboard)
      ? parsed.storyboard.map((s: Partial<StoryboardScene>, i: number) => ({
          scene: typeof s.scene === "number" ? s.scene : i + 1,
          section: typeof s.section === "string" ? s.section : `Scene ${i + 1}`,
          duration: typeof s.duration === "string" ? s.duration : "4-6s",
          prompt: typeof s.prompt === "string" ? s.prompt : `${visualStyle} scene for ${title}`,
          style: typeof s.style === "string" ? s.style : visualStyle,
          movement: typeof s.movement === "string" ? s.movement : "slow pan",
          caption: typeof s.caption === "string" ? s.caption : "",
          genMethod: typeof s.genMethod === "string" ? s.genMethod : "image-to-video",
          status: "planned",
        }))
      : [];

    return NextResponse.json({ title, lyrics, analysis, storyboard });
  } catch (err) {
    console.error("[text-to-mv] error:", err);
    return errorResponse(`Text-to-MV generation failed: ${String(err)}`);
  }
}
