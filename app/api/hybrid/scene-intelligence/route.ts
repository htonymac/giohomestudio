// POST /api/hybrid/scene-intelligence
// Scene Intelligence Pass — the "incubation stage" between story expansion and generation.
//
// Purpose:
//   Reads all scene descriptions in a story and automatically detects the
//   sound environment, ambient layers, and SFX events for each scene.
//   This runs AFTER story expansion and BEFORE image/video generation.
//
// What it produces per scene:
//   - environmentType: city-street | bush-forest | open-market | beach | indoor-room | village | etc.
//   - timeOfDay: morning | midday | afternoon | evening | night | dawn | dusk
//   - weather: clear | rain | fog | storm | wind | humid
//   - ambienceSounds: ["car horns", "traffic", "distant crowd"] or ["crickets", "wind", "owl hoot"]
//   - sfxEvents: specific sounds triggered by actions in the scene
//   - roomTone: overall feel of the acoustic space
//   - energyLevel: calm | tense | chaotic | dramatic | peaceful
//
// Example:
//   Scene: "Ada walks through the Lagos morning market looking for Chidi"
//   → { environmentType: "open-market", timeOfDay: "morning", weather: "humid",
//       ambienceSounds: ["market vendor calls", "motorcycle engines", "crowd chatter",
//                        "chickens clucking", "distant music"], energyLevel: "chaotic" }
//
//   Scene: "Emeka waits alone in the bush at night, listening for footsteps"
//   → { environmentType: "bush-forest", timeOfDay: "night", weather: "clear",
//       ambienceSounds: ["crickets", "wind through trees", "distant owl", "rustling leaves"],
//       energyLevel: "tense" }

import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SceneIntelligenceData {
  sceneId: string;
  environmentType: string;        // "city-street", "bush-forest", "open-market", "beach", "indoor-room", etc.
  timeOfDay: string;              // "morning", "midday", "afternoon", "evening", "night", "dawn", "dusk"
  weather: string;                // "clear", "rain", "fog", "storm", "wind", "humid", "hot-dry"
  indoorOutdoor: "indoor" | "outdoor" | "mixed";
  ambienceSounds: string[];       // ["car horns", "traffic noise", "crowd chatter"] — auto from environment
  sfxEvents: string[];            // ["door slams", "footsteps on gravel", "phone rings at arrival"]
  roomTone: string;               // "busy city street", "quiet village night", "crowded indoor market"
  energyLevel: "calm" | "tense" | "chaotic" | "dramatic" | "peaceful" | "mysterious";
  confidence: "high" | "medium" | "low";
  notes: string;                  // brief explanation of why these sounds were chosen
}

interface SceneInput {
  sceneId: string;
  title: string;
  description: string;
  location?: string;
  timeOfDay?: string;
  mood?: string;
}

// ── Environment → default ambient sounds map ──────────────────────────────────
// Used as fallback when LLM is unavailable or confidence is low
const ENVIRONMENT_AMBIENCE: Record<string, string[]> = {
  "city-street":     ["traffic noise", "car horns", "distant crowd", "footsteps on pavement", "bus engine"],
  "open-market":     ["vendor calls", "crowd chatter", "motorcycles", "clattering stalls", "distant music"],
  "bush-forest":     ["crickets", "wind through trees", "birds chirping", "rustling leaves", "distant frog call"],
  "village":         ["birds", "children playing", "distant drum", "cockerel", "soft wind"],
  "beach":           ["ocean waves", "seagulls", "wind", "distant boat engine", "sand underfoot"],
  "indoor-room":     ["room tone", "air conditioning hum", "distant street noise", "clock ticking"],
  "indoor-market":   ["crowd echo", "vendor calls", "trolleys rolling", "overhead announcement"],
  "night-street":    ["distant traffic", "crickets", "dog bark in distance", "wind", "footsteps"],
  "rain-scene":      ["heavy rain", "thunder rumble", "puddle splash", "rain on roof", "wind gusts"],
  "office":          ["keyboard clicks", "phone rings", "air conditioning", "distant conversation"],
  "church-mosque":   ["echo reverb", "quiet murmur", "soft footsteps", "distant prayer call"],
  "hospital":        ["beeping monitors", "trolley wheels", "hushed voices", "PA announcement"],
  "forest-night":    ["owls", "crickets", "wind", "cracking branch", "distant animal call"],
  "riverbank":       ["flowing water", "frogs", "birds", "wind through grass", "boat knock"],
};

// ── Fallback intelligence for when LLM is unavailable ────────────────────────
function buildFallbackIntelligence(scene: SceneInput): SceneIntelligenceData {
  const desc = (scene.description + " " + scene.title + " " + (scene.location || "")).toLowerCase();

  // Detect environment from keywords
  let environmentType = "indoor-room";
  if (desc.match(/market|stall|vendor|sell|buy|shop/)) environmentType = "open-market";
  else if (desc.match(/street|road|traffic|city|town|car|bus|taxi/)) environmentType = "city-street";
  else if (desc.match(/bush|forest|tree|jungle|wood/)) environmentType = "bush-forest";
  else if (desc.match(/village|compound|rural|farm/)) environmentType = "village";
  else if (desc.match(/beach|sea|ocean|wave|shore/)) environmentType = "beach";
  else if (desc.match(/river|stream|lake|pond|water/)) environmentType = "riverbank";
  else if (desc.match(/church|mosque|temple|prayer|worship/)) environmentType = "church-mosque";
  else if (desc.match(/hospital|clinic|ward|nurse|doctor/)) environmentType = "hospital";
  else if (desc.match(/office|desk|meeting|conference/)) environmentType = "office";
  else if (desc.match(/night|dark|midnight|stars/)) environmentType = "night-street";
  else if (desc.match(/rain|storm|thunder|wet|drench/)) environmentType = "rain-scene";

  const timeOfDay = scene.timeOfDay
    || (desc.match(/morning|dawn|sunrise|early/) ? "morning"
      : desc.match(/night|dark|midnight|late/) ? "night"
      : desc.match(/evening|sunset|dusk/) ? "evening"
      : "afternoon");

  const weather = desc.match(/rain|storm|thunder|drench/) ? "rain"
    : desc.match(/fog|mist|haze/) ? "fog"
    : desc.match(/wind|breezy|gusty/) ? "wind"
    : "clear";

  const indoorOutdoor: "indoor" | "outdoor" | "mixed" =
    environmentType.startsWith("indoor") || ["office", "hospital", "church-mosque"].includes(environmentType)
      ? "indoor" : "outdoor";

  const energyLevel: SceneIntelligenceData["energyLevel"] =
    desc.match(/fight|chase|run|escape|panic|shout|scream|attack|war/) ? "chaotic"
    : desc.match(/tense|afraid|fear|danger|threat|suspicious|lurk/) ? "tense"
    : desc.match(/cry|sad|grief|mourn|funeral|alone|lost/) ? "dramatic"
    : desc.match(/joy|celebrat|laugh|dance|party|wedding|festival/) ? "chaotic"
    : desc.match(/quiet|still|calm|peace|alone|meditat|pray/) ? "peaceful"
    : desc.match(/dark|shadow|mystery|secret|strange|ghost/) ? "mysterious"
    : "calm";

  const ambienceSounds = ENVIRONMENT_AMBIENCE[environmentType]
    || ENVIRONMENT_AMBIENCE["indoor-room"];

  return {
    sceneId: scene.sceneId,
    environmentType,
    timeOfDay,
    weather,
    indoorOutdoor,
    ambienceSounds,
    sfxEvents: [],
    roomTone: `${timeOfDay} ${environmentType.replace("-", " ")}`,
    energyLevel,
    confidence: "medium",
    notes: "Environment detected from scene description keywords",
  };
}

// ── LLM prompt ────────────────────────────────────────────────────────────────
function buildIntelligencePrompt(scenes: SceneInput[], storyContext: string): string {
  const sceneList = scenes.map((s, i) =>
    `Scene ${i + 1} (ID: ${s.sceneId}):
Title: ${s.title}
Description: ${s.description}
${s.location ? `Location hint: ${s.location}` : ""}
${s.timeOfDay ? `Time hint: ${s.timeOfDay}` : ""}
${s.mood ? `Mood hint: ${s.mood}` : ""}`
  ).join("\n\n---\n\n");

  return `You are a professional sound designer and location intelligence system for an AI film studio.

Story context:
"""
${storyContext}
"""

Analyze each scene below and return a JSON array with one entry per scene.
Think about what a real sound designer would hear at that location.

For each scene, detect:
- environmentType: one of: city-street, open-market, indoor-market, bush-forest, village, beach, riverbank, church-mosque, hospital, office, indoor-room, forest-night, night-street, rain-scene, rooftop, car-interior, school, or any other specific environment
- timeOfDay: morning | midday | afternoon | evening | night | dawn | dusk
- weather: clear | rain | fog | storm | wind | humid | hot-dry
- indoorOutdoor: "indoor" | "outdoor" | "mixed"
- ambienceSounds: array of 4-6 specific ambient sounds that would ACTUALLY be heard in this environment (be specific — not "nature sounds" but "crickets chirping", "wind through palm trees", "distant cow bell")
- sfxEvents: array of specific sound events triggered by ACTIONS in the scene description (e.g. "footsteps on gravel as character walks", "door slams when argument ends", "car drives past at tense moment")
- roomTone: one short phrase describing the acoustic environment
- energyLevel: "calm" | "tense" | "chaotic" | "dramatic" | "peaceful" | "mysterious"
- confidence: "high" | "medium" | "low"
- notes: one sentence explaining your sound choices

Scenes:
${sceneList}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "sceneId": "SC01",
    "environmentType": "...",
    "timeOfDay": "...",
    "weather": "...",
    "indoorOutdoor": "...",
    "ambienceSounds": [...],
    "sfxEvents": [...],
    "roomTone": "...",
    "energyLevel": "...",
    "confidence": "...",
    "notes": "..."
  },
  ...
]`;
}

// ── Parse and validate LLM response ──────────────────────────────────────────
function parseIntelligenceResponse(
  raw: string,
  scenes: SceneInput[]
): SceneIntelligenceData[] {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("Not an array");

    return parsed.map((item: Record<string, unknown>, i: number) => ({
      sceneId: (item.sceneId as string) || scenes[i]?.sceneId || `SC${i + 1}`,
      environmentType: (item.environmentType as string) || "indoor-room",
      timeOfDay: (item.timeOfDay as string) || "afternoon",
      weather: (item.weather as string) || "clear",
      indoorOutdoor: (item.indoorOutdoor as "indoor" | "outdoor" | "mixed") || "outdoor",
      ambienceSounds: Array.isArray(item.ambienceSounds) ? item.ambienceSounds as string[] : [],
      sfxEvents: Array.isArray(item.sfxEvents) ? item.sfxEvents as string[] : [],
      roomTone: (item.roomTone as string) || "",
      energyLevel: (item.energyLevel as SceneIntelligenceData["energyLevel"]) || "calm",
      confidence: (item.confidence as "high" | "medium" | "low") || "medium",
      notes: (item.notes as string) || "",
    }));
  } catch {
    // Try to find JSON array within the text
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      try {
        return parseIntelligenceResponse(match[0], scenes);
      } catch { /* fall through */ }
    }
    // Return fallbacks for all scenes
    return scenes.map(s => buildFallbackIntelligence(s));
  }
}

// ── POST handler ─────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenes, storyContext } = body as {
      scenes: SceneInput[];
      storyContext?: string;
    };

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json({ error: "scenes array is required" }, { status: 400 });
    }

    const context = storyContext || "A dramatic story with multiple scenes.";

    // Try LLM-based intelligence first
    const prompt = buildIntelligencePrompt(scenes, context);
    const llmResult = await callLLM(
      prompt,
      "You are a film sound designer. Return only valid JSON arrays. Be specific and realistic about sound environments.",
      { role: "quality" as const, maxTokens: 2000, temperature: 0.4 }
    );

    let intelligence: SceneIntelligenceData[];

    if (llmResult.ok) {
      intelligence = parseIntelligenceResponse(llmResult.text, scenes);
    } else {
      // LLM unavailable — use keyword-based fallback for every scene
      intelligence = scenes.map(s => buildFallbackIntelligence(s));
    }

    // Ensure every scene has an entry (safety guard)
    for (const scene of scenes) {
      if (!intelligence.find(i => i.sceneId === scene.sceneId)) {
        intelligence.push(buildFallbackIntelligence(scene));
      }
    }

    return NextResponse.json({
      ok: true,
      intelligence,
      provider: llmResult.ok ? (llmResult as { provider?: string }).provider ?? "llm" : "fallback",
      sceneCount: intelligence.length,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[scene-intelligence] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
