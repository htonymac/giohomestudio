import { NextRequest, NextResponse } from "next/server";
import { callLLM } from "@/lib/llm";

// ── Sound / SFX Consistency Supervisor ───────────────────────────────────────
// POST body:
//   { projectId, scenes: [{sceneId, description, mood, sfxList, musicMood}] }
//
// For each scene: calls Claude Haiku to evaluate whether the planned SFX and
// music mood match the scene content. Flags mismatches and suggests missing SFX.
//
// Returns:
//   { pass, scenes: [{sceneId, pass, issues, suggestions}], summary }

interface SceneAudioInput {
  sceneId: string;
  description?: string;
  mood?: string;
  sfxList?: string[];
  musicMood?: string;
}

interface SceneAudioResult {
  sceneId: string;
  pass: boolean;
  issues: string[];
  suggestions: string[];
}

interface SoundCheckBody {
  projectId?: string;
  scenes?: SceneAudioInput[];
}

/** Parse Haiku's response into issues + suggestions arrays */
function parseHaikuResponse(raw: string): { issues: string[]; suggestions: string[] } {
  const issues: string[] = [];
  const suggestions: string[] = [];

  // Try JSON first
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.issues)) issues.push(...parsed.issues.map(String));
      if (Array.isArray(parsed.suggestions)) suggestions.push(...parsed.suggestions.map(String));
      return { issues, suggestions };
    }
  } catch { /* fall through to text parsing */ }

  // Text parsing fallback
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);
  let section: "issues" | "suggestions" | null = null;

  for (const line of lines) {
    if (/issue|mismatch|problem|wrong/i.test(line) && line.length < 60) {
      section = "issues";
      continue;
    }
    if (/suggest|additional|missing|add/i.test(line) && line.length < 60) {
      section = "suggestions";
      continue;
    }

    const cleaned = line.replace(/^[-•*\d.]\s*/, "").trim();
    if (cleaned.length < 5 || cleaned.length > 300) continue;

    if (section === "issues") {
      issues.push(cleaned);
    } else if (section === "suggestions") {
      suggestions.push(cleaned);
    } else {
      // Heuristic: lines with "SFX" or "sound" and action words go to suggestions
      if (/sfx|footstep|ambient|wind|rain|crowd|effect/i.test(cleaned)) {
        suggestions.push(cleaned);
      } else if (/mismatch|missing|wrong|incorrect|inconsistent/i.test(cleaned)) {
        issues.push(cleaned);
      }
    }
  }

  return {
    issues: issues.slice(0, 5),
    suggestions: suggestions.slice(0, 3),
  };
}

async function checkSceneAudio(scene: SceneAudioInput): Promise<SceneAudioResult> {
  const {
    sceneId,
    description = "(no description)",
    mood = "(unspecified)",
    sfxList = [],
    musicMood = "(unspecified)",
  } = scene;

  const sfxSummary = sfxList.length > 0 ? sfxList.join(", ") : "none planned";

  const prompt =
    `You are an audio supervisor for a video production. Evaluate the audio plan for one scene.\n\n` +
    `Scene ID: ${sceneId}\n` +
    `Description: ${description}\n` +
    `Mood: ${mood}\n` +
    `Music mood selected: ${musicMood}\n` +
    `Planned SFX: ${sfxSummary}\n\n` +
    `Tasks:\n` +
    `1. Are the planned SFX appropriate for this scene? Flag any SFX that feel wrong or out-of-place.\n` +
    `2. Does the music mood match the scene mood? Flag if mismatched.\n` +
    `3. Suggest 1-3 additional SFX that are clearly missing (e.g. if scene describes footsteps ` +
    `but no footstep SFX is listed, suggest "footsteps on [surface]"). Only suggest if clearly missing.\n\n` +
    `Return JSON only:\n` +
    `{\n` +
    `  "issues": ["issue 1", "issue 2"],\n` +
    `  "suggestions": ["suggested SFX 1", "suggested SFX 2"]\n` +
    `}\n` +
    `If nothing is wrong and no SFX are obviously missing, return { "issues": [], "suggestions": [] }.`;

  const result = await callLLM(prompt, "You are a professional audio supervisor. Be concise and specific.", {
    role: "fast", // routes to Haiku
    maxTokens: 300,
    temperature: 0.3,
  });

  if (!result.ok) {
    // LLM unavailable — return pass with a note
    return {
      sceneId,
      pass: true,
      issues: [],
      suggestions: [`LLM unavailable (${result.error}) — manual audio review recommended.`],
    };
  }

  const { issues, suggestions } = parseHaikuResponse(result.text);

  return {
    sceneId,
    pass: issues.length === 0,
    issues,
    suggestions,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body: SoundCheckBody = await req.json().catch(() => ({})) as SoundCheckBody;
    const scenes: SceneAudioInput[] = Array.isArray(body.scenes) ? body.scenes : [];

    if (scenes.length === 0) {
      return NextResponse.json({
        pass: true,
        scenes: [],
        summary: "No scenes provided — nothing to check.",
      });
    }

    // Run checks for all scenes (sequential to avoid rate-limit bursts)
    const sceneResults: SceneAudioResult[] = [];
    for (const scene of scenes) {
      const result = await checkSceneAudio(scene);
      sceneResults.push(result);
    }

    const failedScenes = sceneResults.filter((s) => !s.pass);
    const totalIssues = sceneResults.reduce((sum, s) => sum + s.issues.length, 0);
    const totalSuggestions = sceneResults.reduce((sum, s) => sum + s.suggestions.length, 0);
    const overallPass = failedScenes.length === 0;

    const summary = overallPass
      ? `All ${scenes.length} scene(s) pass audio consistency check.${totalSuggestions > 0 ? ` ${totalSuggestions} optional SFX suggestion(s) available.` : ""}`
      : `${failedScenes.length} of ${scenes.length} scene(s) have audio issues (${totalIssues} total). Review flagged scenes before assembly.`;

    return NextResponse.json({
      pass: overallPass,
      scenes: sceneResults,
      summary,
    });
  } catch (err) {
    console.error("[sound-consistency supervisor] error:", err);
    return NextResponse.json(
      { error: "Sound consistency check failed", details: String(err) },
      { status: 500 },
    );
  }
}
