// POST /api/hybrid/make-characters — Creates real CharacterVoice DB records from extracted character list
// Takes proposed characters (from story expansion/extraction) and persists them as structured identity objects.
// Each character gets a proper characterId (COUNTRY_NAMEageATTRIBUTE format), DB record, and optionally AI-generated images.
//
// Source of truth: Henry's unified character→scene→image pipeline doctrine (2026-04-12)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Default voice mapping by role type
const VOICE_MAP: Record<string, { voiceId: string; voiceName: string }> = {
  protagonist: { voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam" },
  hero:        { voiceId: "pNInz6obpgDQGcFmaJgB", voiceName: "Adam" },
  heroine:     { voiceId: "EXAVITQu4vr4xnSDxMaL", voiceName: "Sarah" },
  antagonist:  { voiceId: "VR6AewLTigWG4xSOukaG", voiceName: "Arnold" },
  villain:     { voiceId: "VR6AewLTigWG4xSOukaG", voiceName: "Arnold" },
  narrator:    { voiceId: "onwK4e9ZLuTAKqWW03F9", voiceName: "Daniel" },
  supporting:  { voiceId: "TxGEqnHWrfWFTfGW9XjX", voiceName: "Josh" },
  elder:       { voiceId: "yoZ06aMxZJJ28mfd3POQ", voiceName: "Sam" },
  child:       { voiceId: "XrExE9yKIg1WjnnlVkGX", voiceName: "Matilda" },
};

function normalizeRole(role: string): string {
  const r = (role || "").toLowerCase().trim();
  if (["hero", "protagonist", "main", "lead"].includes(r)) return "protagonist";
  if (["heroine", "female lead"].includes(r)) return "heroine";
  if (["villain", "antagonist", "enemy"].includes(r)) return "antagonist";
  if (["narrator", "voice", "voiceover"].includes(r)) return "narrator";
  if (["elder", "old", "wise"].includes(r)) return "elder";
  if (["child", "kid", "young"].includes(r)) return "child";
  return "supporting";
}

function buildCharacterId(char: {
  name: string;
  country?: string;
  age?: string;
  attribute?: string;
}): string {
  const country = (char.country || "XX").substring(0, 2).toUpperCase();
  const name = (char.name || "CHAR").replace(/[^A-Za-z]/g, "").toUpperCase().substring(0, 10);
  const age = (char.age || "30").replace(/\D/g, "") || "30";
  const attr = (char.attribute || "DEFAULT").replace(/[^A-Za-z]/g, "").toUpperCase().substring(0, 8);
  return `${country}_${name}${age}${attr}`;
}

interface ProposedCharacter {
  displayName: string;
  name?: string;
  roleType?: string;
  gender?: string;
  ageRange?: string;
  age?: string;
  country?: string;
  attribute?: string;
  skinTone?: string;
  hairStyle?: string;
  wardrobeStyle?: string;
  speechStyle?: string;
  accentType?: string;
  visualDescription?: string;
  personality?: string;
  culture?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { characters, projectId } = await req.json() as {
      characters: ProposedCharacter[];
      projectId?: string;
    };

    if (!characters || !Array.isArray(characters) || characters.length === 0) {
      return NextResponse.json({ error: "characters array is required" }, { status: 400 });
    }

    const created: Array<{
      id: string;
      characterId: string;
      name: string;
      displayName: string;
      roleType: string;
      gender: string;
      voiceId: string;
      voiceName: string;
      isNew: boolean;
    }> = [];

    for (const char of characters) {
      const name = (char.displayName || char.name || "Character").trim();
      const role = normalizeRole(char.roleType || "supporting");
      const gender = (char.gender || "unknown").toLowerCase();
      const characterId = buildCharacterId({
        name,
        country: char.country,
        age: char.age || char.ageRange,
        attribute: char.attribute || char.skinTone,
      });

      // Check if character already exists (by name or characterId)
      const existing = await prisma.characterVoice.findFirst({
        where: {
          OR: [
            { name },
            { characterId },
          ],
        },
      });

      if (existing) {
        // Update with any new info if needed
        created.push({
          id: existing.id,
          characterId: existing.characterId || characterId,
          name: existing.name,
          displayName: name,
          roleType: role,
          gender,
          voiceId: existing.voiceId || "",
          voiceName: existing.voiceName || "",
          isNew: false,
        });
        continue;
      }

      // Select voice based on role + gender
      let voiceKey = role;
      if (role === "protagonist" && ["female", "girl", "woman"].includes(gender)) {
        voiceKey = "heroine";
      }
      const voice = VOICE_MAP[voiceKey] || VOICE_MAP.supporting;

      // Create in DB
      const record = await prisma.characterVoice.create({
        data: {
          name,
          characterId,
          gender: gender || null,
          role,
          age: char.age || char.ageRange || null,
          visualDescription: char.visualDescription || null,
          personality: char.personality || null,
          wardrobe: char.wardrobeStyle || null,
          hairstyle: char.hairStyle || null,
          culture: char.culture || null,
          country: char.country || null,
          voiceId: voice.voiceId,
          voiceName: voice.voiceName,
          voiceProvider: "elevenlabs",
          defaultSpeechStyle: char.speechStyle || "normal",
          accent: char.accentType || null,
          isNarrator: role === "narrator",
          projectAssociation: projectId || null,
        },
      });

      created.push({
        id: record.id,
        characterId: record.characterId || characterId,
        name: record.name,
        displayName: name,
        roleType: role,
        gender,
        voiceId: record.voiceId || "",
        voiceName: record.voiceName || "",
        isNew: true,
      });
    }

    // Link to project if projectId provided
    if (projectId) {
      try {
        await prisma.hybridProject.update({
          where: { id: projectId },
          data: {
            characterIds: created.map(c => c.characterId),
            status: "CHARACTERS_READY",
          },
        });
      } catch { /* project may not exist yet */ }
    }

    return NextResponse.json({
      success: true,
      characters: created,
      newCount: created.filter(c => c.isNew).length,
      existingCount: created.filter(c => !c.isNew).length,
      total: created.length,
    });
  } catch (err) {
    // Handle unique constraint violation
    if (err instanceof Error && err.message.includes("Unique constraint")) {
      return NextResponse.json({
        error: "A character with this name already exists. Use a different name or import the existing one.",
      }, { status: 409 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create characters" },
      { status: 500 }
    );
  }
}
