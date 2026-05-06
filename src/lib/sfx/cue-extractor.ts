// src/lib/sfx/cue-extractor.ts
// Deterministic + LLM-augmented SFX cue extraction from scene text.
// Keyword pass runs first (cheap, always available).
// LLM pass (Claude Haiku) runs after to catch implicit cues not covered by keywords.
// Results are merged and deduplicated — keyword result wins on collision.

import { callLLM } from "@/lib/llm";

export interface SfxCue {
  cue: string;           // e.g. "car_horn", "footsteps", "crowd_cheer"
  category: string;      // "ambient" | "action" | "nature" | "vehicle" | "human" | "weather"
  confidence: number;    // 0-1
  timing_hint: string;   // "beginning" | "throughout" | "end" | "moment"
  volume: number;        // 0.0-1.0 suggested
  source: "keyword" | "llm";
}

// ── Keyword table ─────────────────────────────────────────────
// Keys are lowercase patterns to search for in the combined text.
// Multiple keys can map to the same cue object.
type CueTemplate = Omit<SfxCue, "source">;

const KEYWORD_MAP: Array<{ patterns: string[]; cue: CueTemplate }> = [
  {
    patterns: ["car horn", "honk", "honking", "hooted", "hoot"],
    cue: { cue: "car_horn", category: "vehicle", confidence: 0.95, timing_hint: "moment", volume: 0.7 },
  },
  {
    patterns: ["footstep", "footsteps", "running", "ran", "walked", "walking", "steps", "pacing", "sprinted", "tiptoe"],
    cue: { cue: "footsteps", category: "human", confidence: 0.85, timing_hint: "throughout", volume: 0.4 },
  },
  {
    patterns: ["scream", "screaming", "screamed", "shriek", "shrieking", "yell", "yelled"],
    cue: { cue: "crowd_scream", category: "human", confidence: 0.9, timing_hint: "moment", volume: 0.8 },
  },
  {
    patterns: ["thunder", "thunderclap", "lightning", "storm", "thunderstorm"],
    cue: { cue: "thunder", category: "weather", confidence: 0.95, timing_hint: "moment", volume: 0.9 },
  },
  {
    patterns: ["rain", "raining", "downpour", "drizzle", "heavy rain"],
    cue: { cue: "rain_ambience", category: "weather", confidence: 0.9, timing_hint: "throughout", volume: 0.5 },
  },
  {
    patterns: ["door slam", "slammed", "slammed the door", "door bang", "door shut"],
    cue: { cue: "door_slam", category: "action", confidence: 0.9, timing_hint: "moment", volume: 0.7 },
  },
  {
    patterns: ["crowd", "people shouting", "busy street", "market", "marketplace", "bazaar"],
    cue: { cue: "crowd_ambience", category: "ambient", confidence: 0.75, timing_hint: "throughout", volume: 0.4 },
  },
  {
    patterns: ["traffic", "busy road", "highway", "freeway", "intersection"],
    cue: { cue: "traffic_ambience", category: "vehicle", confidence: 0.85, timing_hint: "throughout", volume: 0.5 },
  },
  {
    patterns: ["explosion", "explode", "exploded", "detonation", "blast"],
    cue: { cue: "explosion", category: "action", confidence: 0.95, timing_hint: "moment", volume: 1.0 },
  },
  {
    patterns: ["gunshot", "gunfire", "shot fired", "shots fired", "fired his gun", "fired her gun", "gun blast", "pistol"],
    cue: { cue: "gunshot", category: "action", confidence: 0.95, timing_hint: "moment", volume: 0.9 },
  },
  {
    patterns: ["wind", "breeze", "gust", "howling wind", "blowing wind"],
    cue: { cue: "wind", category: "weather", confidence: 0.9, timing_hint: "throughout", volume: 0.4 },
  },
  {
    patterns: ["fire", "burning", "flames", "flame", "bonfire", "campfire", "inferno"],
    cue: { cue: "fire_crackling", category: "nature", confidence: 0.9, timing_hint: "throughout", volume: 0.6 },
  },
  {
    patterns: ["ocean", "sea", "waves", "beach", "seashore", "coastline", "shore"],
    cue: { cue: "ocean_waves", category: "nature", confidence: 0.9, timing_hint: "throughout", volume: 0.5 },
  },
  {
    patterns: ["birds", "bird", "chirping", "birdsong", "tweeting", "flock of birds"],
    cue: { cue: "birds_chirping", category: "nature", confidence: 0.85, timing_hint: "throughout", volume: 0.3 },
  },
  {
    patterns: ["church bell", "bell tower", "bell rang", "bell ringing", "mosque call", "prayer call"],
    cue: { cue: "church_bell", category: "ambient", confidence: 0.85, timing_hint: "moment", volume: 0.6 },
  },
  {
    patterns: ["phone ring", "ringtone", "phone rang", "called him", "called her", "mobile rang", "phone vibrate"],
    cue: { cue: "phone_ringing", category: "ambient", confidence: 0.9, timing_hint: "moment", volume: 0.7 },
  },
  {
    patterns: ["glass break", "glass shatter", "shattered", "smash", "smashing", "crash of glass", "window broke"],
    cue: { cue: "glass_break", category: "action", confidence: 0.95, timing_hint: "moment", volume: 0.8 },
  },
  {
    patterns: ["helicopter", "chopper", "aircraft overhead", "whirring blades"],
    cue: { cue: "helicopter", category: "vehicle", confidence: 0.95, timing_hint: "throughout", volume: 0.7 },
  },
  {
    patterns: ["children playing", "children laugh", "kids playing", "kids shout", "children shout", "playground"],
    cue: { cue: "children_playing", category: "human", confidence: 0.7, timing_hint: "throughout", volume: 0.4 },
  },
  {
    patterns: ["dog bark", "dog barked", "barking dog", "dogs barking"],
    cue: { cue: "dog_bark", category: "nature", confidence: 0.85, timing_hint: "moment", volume: 0.5 },
  },
  {
    patterns: ["siren", "ambulance", "police siren", "fire truck", "emergency vehicle"],
    cue: { cue: "siren", category: "vehicle", confidence: 0.9, timing_hint: "throughout", volume: 0.7 },
  },
  {
    patterns: ["knock", "knocking", "knocked on the door", "door knock", "tap on the door"],
    cue: { cue: "door_knock", category: "action", confidence: 0.85, timing_hint: "moment", volume: 0.6 },
  },
  {
    patterns: ["river", "stream", "flowing water", "waterfall", "creek"],
    cue: { cue: "river_stream", category: "nature", confidence: 0.88, timing_hint: "throughout", volume: 0.4 },
  },
  {
    patterns: ["forest", "jungle", "woods", "deep forest", "dense trees"],
    cue: { cue: "forest_ambience", category: "nature", confidence: 0.8, timing_hint: "throughout", volume: 0.35 },
  },
  {
    patterns: ["punch", "punched", "hit him", "hit her", "fist", "struck", "slapped"],
    cue: { cue: "punch", category: "action", confidence: 0.85, timing_hint: "moment", volume: 0.7 },
  },
  {
    patterns: ["engine", "car engine", "vehicle engine", "motor", "engine roar", "car driving"],
    cue: { cue: "engine_hum", category: "vehicle", confidence: 0.8, timing_hint: "throughout", volume: 0.4 },
  },
  {
    patterns: ["typing", "keyboard", "typing away", "at the computer", "on his laptop", "on her laptop"],
    cue: { cue: "typing", category: "ambient", confidence: 0.75, timing_hint: "throughout", volume: 0.25 },
  },
  {
    patterns: ["sword", "blade", "clang of metal", "clash of swords", "swordfight"],
    cue: { cue: "sword_clash", category: "action", confidence: 0.9, timing_hint: "moment", volume: 0.8 },
  },
  {
    patterns: ["crickets", "cricket", "night insects", "insect hum"],
    cue: { cue: "crickets", category: "nature", confidence: 0.88, timing_hint: "throughout", volume: 0.3 },
  },
  {
    patterns: ["crowd cheer", "cheering crowd", "applause", "clapping", "audience clapping"],
    cue: { cue: "crowd_cheer", category: "human", confidence: 0.88, timing_hint: "moment", volume: 0.75 },
  },
];

// Phrases to explicitly skip — music/dialogue are not SFX
const SKIP_PATTERNS = ["music playing", "song playing", "he said", "she said", "dialogue", "speaking", "conversation"];

// ── Keyword pass ─────────────────────────────────────────────
function keywordPass(text: string): SfxCue[] {
  const lower = text.toLowerCase();

  // Skip if text is dominated by music/dialogue markers
  const skipMatch = SKIP_PATTERNS.some(p => lower.includes(p));
  void skipMatch; // skip list is advisory — don't block, just avoid music below

  const results: SfxCue[] = [];
  const seen = new Set<string>();

  for (const entry of KEYWORD_MAP) {
    if (seen.has(entry.cue.cue)) continue;
    // Skip music-category cues if explicit music mention
    if (lower.includes("music") && ["drum", "beat", "bass"].some(m => entry.cue.cue.includes(m))) continue;

    const matched = entry.patterns.some(p => lower.includes(p));
    if (matched) {
      results.push({ ...entry.cue, source: "keyword" });
      seen.add(entry.cue.cue);
    }
  }

  return results;
}

// ── LLM pass ─────────────────────────────────────────────────
interface LLMCue {
  cue: string;
  category: string;
  timing_hint: string;
  volume: number;
}

async function llmPass(text: string, alreadyFound: string[]): Promise<SfxCue[]> {
  const skipList = alreadyFound.length > 0
    ? `Already identified SFX (do NOT suggest these again): ${alreadyFound.join(", ")}\n`
    : "";

  const prompt = [
    "Extract sound effects that would be heard in this scene.",
    "Return a JSON array with up to 5 items: [{cue, category, timing_hint, volume}]",
    "Rules:",
    "- cue: snake_case sound name (e.g. crowd_murmur, gravel_crunch, door_creak)",
    "- category: one of ambient|action|nature|vehicle|human|weather",
    "- timing_hint: one of beginning|throughout|end|moment",
    "- volume: 0.0-1.0 float",
    "- Only include non-music sounds (footsteps, ambient, environmental, action sounds)",
    "- Skip music, dialogue, narration",
    `- ${skipList}Return ONLY valid JSON array, no markdown.`,
    "",
    `Scene: ${text.slice(0, 800)}`,
  ].join("\n");

  const result = await callLLM(
    prompt,
    "You are a professional film sound designer. Return only valid JSON arrays.",
    { role: "fast", maxTokens: 400, temperature: 0.3 }
  );

  if (!result.ok) return [];

  try {
    const cleaned = result.text
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/g, "")
      .trim();
    const parsed = JSON.parse(cleaned) as LLMCue[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(item => item.cue && item.category && item.timing_hint && typeof item.volume === "number")
      .filter(item => !["drum", "beat", "music", "song", "melody"].some(m => item.cue.toLowerCase().includes(m)))
      .map(item => ({
        cue: item.cue,
        category: item.category,
        confidence: 0.65,
        timing_hint: item.timing_hint,
        volume: Math.min(1.0, Math.max(0.0, item.volume)),
        source: "llm" as const,
      }));
  } catch {
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────
export async function extractSfxCues(
  sceneDescription: string,
  sceneDialogue?: string,
  sceneAction?: string,
): Promise<SfxCue[]> {
  // Combine all available text
  const combined = [sceneDescription, sceneDialogue, sceneAction]
    .filter(Boolean)
    .join(" ");

  // 1. Keyword pass
  const keywordCues = keywordPass(combined);
  const keywordCueNames = new Set(keywordCues.map(c => c.cue));

  // 2. LLM pass — only if text has content
  let llmCues: SfxCue[] = [];
  if (combined.trim().length > 20) {
    try {
      llmCues = await llmPass(combined, Array.from(keywordCueNames));
    } catch {
      // LLM failure is non-fatal — keyword results still returned
    }
  }

  // 3. Merge: keyword wins on collision, LLM adds new cues only
  const merged: SfxCue[] = [...keywordCues];
  for (const llmCue of llmCues) {
    if (!keywordCueNames.has(llmCue.cue)) {
      merged.push(llmCue);
    }
  }

  // 4. Sort by confidence descending
  merged.sort((a, b) => b.confidence - a.confidence);

  return merged;
}
