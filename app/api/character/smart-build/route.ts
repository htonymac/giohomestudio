// POST /api/character/smart-build
// AI-assisted character creation: accepts free prompt or guided fields,
// uses LLM to parse into structured character data, generates reference images,
// and saves to CharacterVoice table.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { callLLM } from "@/lib/llm";
import { generateCharacterId } from "@/lib/character-id";

// ── System prompt for the LLM ────────────────────────────────
const SYSTEM_PROMPT = `You are a character design assistant for an AI video production studio.
Given a character description (either a free prompt or structured fields), produce a JSON object with these exact keys:

{
  "name": "UPPERCASE_SNAKE_NAME",
  "displayName": "Human Readable Name",
  "gender": "male|female|boy|girl|neutral",
  "age": "child|teen|young_adult|adult|elder",
  "species": "human|rabbit|robot|dragon|etc",
  "country": "country name or empty",
  "skinTone": "description of skin/fur color",
  "hairStyle": "hair or head covering description",
  "facialTraits": "face details — eyes, nose, markings",
  "bodyType": "build description",
  "wardrobeStyle": "clothing/outfit description",
  "specialTraits": "unique distinguishing features",
  "personality": "personality traits, comma separated",
  "visualDescription": "Full visual description paragraph for image generation. 2-3 sentences, vivid and specific.",
  "toneClass": "bass|tenor|soft|commanding|elder|youthful|raspy|smooth",
  "accent": "american|british|african|nigerian|naija|neutral|west_african",
  "role": "protagonist|antagonist|narrator|supporting|elder|child|comic_relief",
  "imagePrompts": {
    "front": "Detailed image generation prompt for front portrait view of the character. Include all visual details.",
    "threeQuarter": "Detailed image generation prompt for three-quarter angle view. Include all visual details.",
    "side": "Detailed image generation prompt for side profile view. Include all visual details."
  }
}

Rules:
- name should be a short uppercase snake_case identifier derived from the character (e.g. JON_RABBIT, MAMA_TUNDE)
- displayName should be a natural readable name
- visualDescription must be vivid and complete enough for an AI image generator
- imagePrompts must each be self-contained detailed prompts (don't reference other prompts)
- Each image prompt should start with the angle, then describe the full character appearance
- For non-human characters, species/type should be clear in every image prompt
- toneClass should match the character's likely voice quality
- If country/ethnicity is mentioned, reflect it in accent and visualDescription
- Output ONLY the JSON object, no markdown, no explanation`;

// ── Helper: build user prompt ────────────────────────────────
function buildUserPrompt(body: Record<string, unknown>): string {
  if (body.prompt && typeof body.prompt === "string") {
    return `Create a character from this free description:\n\n"${body.prompt}"`;
  }

  // Guided mode — assemble fields
  const parts: string[] = ["Create a character with these attributes:"];
  const fields = [
    "type", "gender", "age", "ethnicity", "nationality", "skinTone",
    "height", "build", "hair", "face", "clothing", "accessories",
    "species", "colorPattern", "size", "specialFeatures", "personality",
    "style", "material", "era",
  ];
  for (const key of fields) {
    if (body[key] && typeof body[key] === "string") {
      parts.push(`- ${key}: ${body[key]}`);
    }
  }
  return parts.join("\n");
}

// ── Helper: extract JSON from LLM response ──────────────────
function extractJSON(text: string): Record<string, unknown> | null {
  // Try raw parse first
  try { return JSON.parse(text); } catch { /* continue */ }

  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch { /* continue */ }
  }

  // Try finding first { to last }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch { /* continue */ }
  }

  return null;
}

// ── POST handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));

  // Validate: need either prompt or type
  if (!body.prompt && !body.type) {
    return NextResponse.json(
      { error: "Provide either 'prompt' (free mode) or 'type' + fields (guided mode)" },
      { status: 400 }
    );
  }

  // Step 1: Call LLM to parse input into structured character data
  const userPrompt = buildUserPrompt(body);
  const llmResult = await callLLM(userPrompt, SYSTEM_PROMPT, {
    role: "quality",
    maxTokens: 1500,
    temperature: 0.7,
    timeoutMs: 30000,
  });

  if (!llmResult.ok) {
    return NextResponse.json(
      { error: "LLM failed to parse character", detail: llmResult.error },
      { status: 502 }
    );
  }

  const parsed = extractJSON(llmResult.text);
  if (!parsed) {
    return NextResponse.json(
      { error: "LLM returned invalid JSON", raw: llmResult.text.slice(0, 500) },
      { status: 502 }
    );
  }

  // Step 2: Generate character ID
  const characterId = generateCharacterId({
    country: (parsed.country as string) || "",
    name: (parsed.name as string) || "CHARACTER",
    age: (parsed.age as string) || "",
    skinTone: (parsed.skinTone as string) || "",
  });

  // Step 3: Generate reference images (fire and forget — non-blocking)
  const imagePrompts = parsed.imagePrompts as Record<string, string> | undefined;
  const generatedImages: Array<{ angle: string; url: string; label: string }> = [];

  if (imagePrompts) {
    const angles = [
      { key: "front", angle: "front", label: "Front view" },
      { key: "threeQuarter", angle: "three_quarter", label: "3/4 view" },
      { key: "side", angle: "side", label: "Side profile" },
    ];

    const imageResults = await Promise.allSettled(
      angles.map(async (a) => {
        const prompt = imagePrompts[a.key];
        if (!prompt) return null;
        try {
          const imgRes = await fetch(new URL("/api/generation/image", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt,
              width: 768,
              height: 768,
            }),
          });
          if (!imgRes.ok) return null;
          const imgData = await imgRes.json();
          return {
            angle: a.angle,
            url: imgData.url || imgData.imagePath || "",
            label: a.label,
          };
        } catch {
          return null;
        }
      })
    );

    for (const r of imageResults) {
      if (r.status === "fulfilled" && r.value && r.value.url) {
        generatedImages.push(r.value);
      }
    }
  }

  // Step 4: Save to CharacterVoice table
  const charName = ((parsed.name as string) || "AI_CHARACTER").toUpperCase().replace(/[^A-Z0-9_]/g, "_");

  try {
    const voice = await prisma.characterVoice.create({
      data: {
        name: charName,
        characterId,
        gender: (parsed.gender as string) || null,
        toneClass: (parsed.toneClass as string) || null,
        accent: (parsed.accent as string) || null,
        language: "en",
        voiceId: null,
        voiceName: null,
        isNarrator: false,
        notes: `AI Smart Builder | ${(parsed.displayName as string) || ""} | ${(parsed.personality as string) || ""}`,
        imageUrl: generatedImages[0]?.url || null,
        visualDescription: (parsed.visualDescription as string) || null,
        role: (parsed.role as string) || "supporting",
        defaultSpeechStyle: "normal",
        age: (parsed.age as string) || null,
        country: (parsed.country as string) || null,
        personality: (parsed.personality as string) || null,
        wardrobe: (parsed.wardrobeStyle as string) || null,
        hairstyle: (parsed.hairStyle as string) || null,
        referenceImages: generatedImages.length > 0 ? generatedImages : undefined,
      },
    });

    return NextResponse.json({
      voice,
      parsed: {
        ...parsed,
        characterId,
      },
      images: generatedImages,
      provider: llmResult.provider,
    }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: `Character "${charName}" already exists. Use a different name or description.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
