// Cast Bible Generator — extracts/generates character identity objects

import type { SupervisorResult, CastBibleEntry, StoryContract } from "./types";

interface ExistingChar {
  name: string;
  role?: string;
  voiceId?: string;
}

// ── Haiku API call ────────────────────────────────────────────────────────────

async function callHaikuForCastBible(
  storyText: string,
  contract: StoryContract
): Promise<CastBibleEntry[]> {
  // Dynamic import to avoid hard crash when SDK not available
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const prompt = `You are a Cast Bible generator for a video story. Extract all characters from this story and create stable identity objects.

Story: ${storyText}

Contract: country=${contract.country}, culture=${contract.culture}, defaultEthnicity=${contract.defaultCastAssumptions.ethnicity}

For each character, return JSON array of objects with fields:
character_id, name, age, gender, ethnicity, skin_tone, body_type, hair, clothing, role, personality, voice_style, relationship

Rules:
- Default ethnicity = "${contract.defaultCastAssumptions.ethnicity}" unless story explicitly states otherwise
- Use Nigerian/African names if country is Nigeria
- Keep descriptions visual and specific for image generation
- character_id format: CH01 for protagonist, CH02 for second character, CH03 for third, etc. (zero-padded, sequential)
- age: descriptive string like "mid-30s", "early teens", "elderly"
- skin_tone: specific (e.g., "warm dark brown", "deep black", "medium brown")
- body_type: "slim", "athletic", "stocky", "average", etc.
- hair: natural description for image gen
- clothing: culturally appropriate and visually specific
- role: "protagonist", "antagonist", "supporting", "minor"
- personality: 2–3 trait words
- voice_style: "warm baritone", "bright soprano", "raspy alto", etc.
- relationship: relationship to protagonist or "protagonist" if they are the lead
- Return ONLY valid JSON array, no other text, no markdown code blocks`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected Haiku response type");
  }

  // Strip potential markdown code fences
  const raw = content.text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Haiku did not return a JSON array");
  }

  return parsed as CastBibleEntry[];
}

// ── CH-format ID generator ────────────────────────────────────────────────────

function makeCHId(index: number): string {
  return `CH${String(index + 1).padStart(2, "0")}`;
}

// Normalize any character array to use CH01, CH02... IDs in order (protagonist first)
function normalizeToCHIds(chars: CastBibleEntry[]): CastBibleEntry[] {
  // Sort: protagonist first, then antagonist, then by appearance order
  const sorted = [...chars].sort((a, b) => {
    const order: Record<string, number> = { protagonist: 0, antagonist: 1, supporting: 2, minor: 3 };
    return (order[a.role] ?? 4) - (order[b.role] ?? 4);
  });
  return sorted.map((c, i) => ({ ...c, character_id: makeCHId(i) }));
}

// ── Simple fallback extractor ─────────────────────────────────────────────────

function extractCharactersSimple(
  storyText: string,
  contract: StoryContract,
  existingChars: ExistingChar[]
): CastBibleEntry[] {
  const results: CastBibleEntry[] = [];

  // If caller provided known characters, use those as seeds
  for (const ec of existingChars) {
    results.push({
      character_id: makeCHId(results.length),
      name: ec.name,
      age: "adult",
      gender: "unknown",
      ethnicity: contract.defaultCastAssumptions.ethnicity,
      skin_tone: "dark brown",
      body_type: "average",
      hair: "short natural black hair",
      clothing: "traditional African attire",
      role: ec.role ?? "supporting",
      personality: "determined, caring",
      voice_style: "clear, warm",
      relationship: ec.role === "protagonist" ? "protagonist" : "supporting character",
    });
  }

  if (results.length > 0) return results;

  // Regex-based name extraction: capitalized words not at sentence start
  // Look for proper nouns that appear more than once (likely character names)
  const words = storyText.split(/\s+/);
  const capitalizedCounts: Record<string, number> = {};

  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[^a-zA-Z]/g, "");
    if (
      word.length > 2 &&
      /^[A-Z]/.test(word) &&
      i > 0 && // not first word of text
      !/^(The|A|An|In|On|At|By|From|With|And|But|Or|So|As|If|He|She|It|We|You|They|I|His|Her|Their|Our|This|That|These|Those|When|Where|Who|What|How|Why|Once|Then|After|Before|During|While|One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|Mr|Mrs|Ms|Dr|Chief)$/.test(word)
    ) {
      capitalizedCounts[word] = (capitalizedCounts[word] ?? 0) + 1;
    }
  }

  // Characters appear at least twice
  const candidateNames = Object.entries(capitalizedCounts)
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8) // max 8 characters from simple extraction
    .map(([name]) => name);

  for (let idx = 0; idx < candidateNames.length; idx++) {
    const name = candidateNames[idx];
    results.push({
      character_id: makeCHId(results.length),
      name,
      age: "adult",
      gender: "unknown",
      ethnicity: contract.defaultCastAssumptions.ethnicity,
      skin_tone: "dark brown",
      body_type: "average",
      hair: "short natural black hair",
      clothing: "everyday African clothing",
      role: idx === 0 ? "protagonist" : "supporting",
      personality: "determined, thoughtful",
      voice_style: "clear, natural",
      relationship: idx === 0 ? "protagonist" : `relationship to ${candidateNames[0]}`,
    });
  }

  // If absolutely nothing found, create a generic protagonist
  if (results.length === 0) {
    results.push({
      character_id: "CH01",
      name: "Protagonist",
      age: "adult",
      gender: "unknown",
      ethnicity: contract.defaultCastAssumptions.ethnicity,
      skin_tone: "dark brown",
      body_type: "average",
      hair: "short natural black hair",
      clothing: "everyday African clothing",
      role: "protagonist",
      personality: "determined, resilient",
      voice_style: "clear, warm",
      relationship: "protagonist",
    });
  }

  return results;
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateCastBible(
  storyText: string,
  contract: StoryContract,
  existingChars: ExistingChar[] = []
): Promise<SupervisorResult<{ castBible: CastBibleEntry[] }>> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  let castBible: CastBibleEntry[] = [];
  let usedAI = false;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      castBible = normalizeToCHIds(await callHaikuForCastBible(storyText, contract));
      usedAI = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`AI cast extraction failed (${msg}). Falling back to simple extraction.`);
      castBible = extractCharactersSimple(storyText, contract, existingChars);
    }
  } else {
    warnings.push("ANTHROPIC_API_KEY not set. Using simple character extraction.");
    castBible = extractCharactersSimple(storyText, contract, existingChars);
  }

  // Merge with existingChars: preserve voiceId and known fields
  if (existingChars.length > 0 && usedAI) {
    for (const existing of existingChars) {
      const match = castBible.find(
        (c) => c.name.toLowerCase() === existing.name.toLowerCase()
      );
      if (!match) {
        warnings.push(
          `Character "${existing.name}" was provided but not found in AI extraction. ` +
            `It may be unnamed in the story.`
        );
      }
    }
  }

  // Validation: ensure no character violates Nigerian/African cast rule
  if (contract.defaultCastAssumptions.allowWhiteCastOnlyIfUserRequests) {
    for (const c of castBible) {
      const ethLower = c.ethnicity.toLowerCase();
      const isForeigner = ["tourist", "foreigner", "expatriate", "international"].some((r) =>
        c.role.toLowerCase().includes(r)
      );
      if (
        (ethLower.includes("white") || ethLower.includes("caucasian")) &&
        !isForeigner
      ) {
        warnings.push(
          `Character "${c.name}" extracted with ethnicity "${c.ethnicity}". ` +
            `Overriding to ${contract.defaultCastAssumptions.ethnicity} per contract.`
        );
        c.ethnicity = contract.defaultCastAssumptions.ethnicity;
        c.skin_tone = "warm dark brown";
        if (c.hair.toLowerCase().includes("blonde")) {
          c.hair = "short natural black hair";
        }
      }
    }
  }

  if (castBible.length === 0) {
    blockingIssues.push("No characters could be extracted from the story.");
    suggestedFixes.push("Ensure the story references named characters at least twice.");
  }

  const score = blockingIssues.length > 0 ? 0 : warnings.length > 0 ? 75 : 100;
  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { castBible },
    metadata: {
      characterCount: castBible.length,
      usedAI,
      country: contract.country,
      defaultEthnicity: contract.defaultCastAssumptions.ethnicity,
    },
  };
}
