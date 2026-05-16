// Scene Demarcator — breaks story into timed scene objects

import type { SupervisorResult, ScenePlan, ShotPlan, StoryContract, CastBibleEntry } from "./types";

// Build one default shot per scene (Scene = Folder of Shots)
function buildDefaultShot(scene: ScenePlan, shotIndex: number): ShotPlan {
  const speaking = scene.characters?.[0] ?? "";
  const listening = scene.characters?.slice(1) ?? [];
  return {
    shot_id: `SH${String(scene.scene_number).padStart(2, "0")}-${String(shotIndex + 1).padStart(2, "0")}`,
    scene_id: scene.scene_id,
    characters_visible: scene.characters ?? [],
    speaking_character_id: speaking,
    listening_character_ids: listening,
    camera_angle: scene.camera_style ?? "medium shot",
    camera_movement: "slow push-in",
    framing_type: "medium",
    lighting_style: "natural warm light",
    dialogue_line: scene.dialogue ?? "",
    audio_timing: 0,
    sfx_cues: scene.sfx_cues ?? [],
    duration: scene.duration,
    image_prompt: scene.image_prompt,
    video_prompt: scene.video_prompt,
    negative_prompt: scene.negative_prompt,
    provider_recommendation: scene.provider_recommendation,
  };
}

// Words per second for voiceover pacing
function maxWordsForDuration(seconds: number): number {
  // 5s = 12 words, 8s = 20 words, 10s = 25 words (≈ 2.4 words/sec)
  return Math.round(seconds * 2.4);
}

function padSceneId(n: number): string {
  return `scene_${String(n).padStart(3, "0")}`;
}

// ── Haiku AI scene demarcation ────────────────────────────────────────────────

async function callHaikuForScenes(
  storyText: string,
  contract: StoryContract,
  castBible: CastBibleEntry[]
): Promise<ScenePlan[]> {
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const maxWords = maxWordsForDuration(contract.sceneDurationSeconds);
  const castBibleJSON = JSON.stringify(
    castBible.map((c) => ({
      character_id: c.character_id,
      name: c.name,
      ethnicity: c.ethnicity,
      skin_tone: c.skin_tone,
      clothing: c.clothing,
      gender: c.gender,
      age: c.age,
    })),
    null,
    2
  );

  const prompt = `You are a scene demarcator for a video story. Break this story into exactly ${contract.estimatedSceneCount} scenes.

Story: ${storyText}

Contract: country=${contract.country}, culture=${contract.culture}, sceneDuration=${contract.sceneDurationSeconds}s each
Cast Bible: ${castBibleJSON}

Return JSON array of scene objects. Each scene must have ALL these fields:
- scene_id: string (format: scene_001, scene_002...)
- scene_number: integer
- duration: number (= ${contract.sceneDurationSeconds})
- title: string (short scene title)
- summary: string (1-2 sentences)
- characters: string[] (character_id values from Cast Bible)
- location: string
- time_of_day: string (morning/afternoon/evening/night)
- emotion: string (primary emotion of scene)
- visual_prompt: string (concise scene description for image gen)
- image_prompt: string (detailed FLUX-ready prompt, 50-80 words, includes ethnicity/clothing from Cast Bible)
- video_prompt: string (motion description for video gen)
- negative_prompt: string (what to exclude — always include "blurry, distorted, text, watermark" + wrong ethnicities if African cast)
- voiceover_text: string (max ${maxWords} words — the narration for this scene)
- dialogue: string (key spoken line or empty string)
- subtitle_text: string (clean subtitle text)
- subtitle_style: string (= "${contract.subtitleStyle}")
- music_cue: string (music mood description)
- sfx_cues: string[] (sound effects array)
- camera_style: string (e.g., "medium close-up", "wide establishing shot")
- continuity_notes: string[] (notes for next scene continuity)
- provider_recommendation: "image_plus_motion" | "video" | "image_voiceover" | "hybrid"
- provider_reason: string (why this provider was chosen)

Rules:
- visual_prompt MUST match Cast Bible identity (ethnicity, clothing, location)
- negative_prompt MUST exclude wrong ethnicities/locations if story is African/Nigerian
- voiceover_text max ${maxWords} words (scene duration = ${contract.sceneDurationSeconds}s)
- Each scene = one clear visual beat (one location, one action)
- image_prompt: always specify "${castBible[0]?.ethnicity ?? "matching ethnicity"}" skin tone if character appears
- Return ONLY valid JSON array, no markdown, no commentary`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected Haiku response type");
  }

  const raw = content.text
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim();

  const parsed = JSON.parse(raw) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Haiku did not return a JSON array of scenes");
  }

  // Normalize and fill any missing fields
  return (parsed as Record<string, unknown>[]).map((s, idx) => ({
    scene_id: (s["scene_id"] as string) ?? padSceneId(idx + 1),
    scene_number: (s["scene_number"] as number) ?? idx + 1,
    duration: (s["duration"] as number) ?? contract.sceneDurationSeconds,
    title: (s["title"] as string) ?? `Scene ${idx + 1}`,
    summary: (s["summary"] as string) ?? "",
    characters: (s["characters"] as string[]) ?? [],
    location: (s["location"] as string) ?? "unspecified",
    time_of_day: (s["time_of_day"] as string) ?? "daytime",
    emotion: (s["emotion"] as string) ?? "neutral",
    visual_prompt: (s["visual_prompt"] as string) ?? "",
    image_prompt: (s["image_prompt"] as string) ?? "",
    video_prompt: (s["video_prompt"] as string) ?? "",
    negative_prompt:
      (s["negative_prompt"] as string) ??
      "blurry, distorted, text, watermark, white skin, caucasian features",
    voiceover_text: (s["voiceover_text"] as string) ?? "",
    dialogue: (s["dialogue"] as string) ?? "",
    subtitle_text: (s["subtitle_text"] as string) ?? "",
    subtitle_style: (s["subtitle_style"] as string) ?? contract.subtitleStyle,
    music_cue: (s["music_cue"] as string) ?? "ambient background music",
    sfx_cues: (s["sfx_cues"] as string[]) ?? [],
    camera_style: (s["camera_style"] as string) ?? "medium shot",
    continuity_notes: (s["continuity_notes"] as string[]) ?? [],
    provider_recommendation: (s["provider_recommendation"] as ScenePlan["provider_recommendation"]) ?? "image_plus_motion",
    provider_reason: (s["provider_reason"] as string) ?? "default",
  }));
}

// ── Paragraph-based fallback demarcator ───────────────────────────────────────

function demarcateByParagraphs(
  storyText: string,
  contract: StoryContract,
  castBible: CastBibleEntry[]
): ScenePlan[] {
  const maxWords = maxWordsForDuration(contract.sceneDurationSeconds);
  const defaultEthnicity = castBible[0]?.ethnicity ?? contract.defaultCastAssumptions.ethnicity;
  const allCharIds = castBible.map((c) => c.character_id);

  // Split by paragraphs, filter empty
  const paragraphs = storyText
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 10);

  const targetCount = contract.estimatedSceneCount;

  // If too many paragraphs, group them; if too few, split the longest
  let chunks: string[] = paragraphs;

  if (chunks.length > targetCount) {
    // Merge excess paragraphs into targetCount chunks
    const merged: string[] = [];
    const groupSize = Math.ceil(chunks.length / targetCount);
    for (let i = 0; i < chunks.length; i += groupSize) {
      merged.push(chunks.slice(i, i + groupSize).join(" "));
    }
    chunks = merged.slice(0, targetCount);
  } else if (chunks.length < targetCount) {
    // Pad with sentence splits from the last chunk
    while (chunks.length < targetCount) {
      const longestIdx = chunks.reduce(
        (best, c, i) => (c.length > chunks[best].length ? i : best),
        0
      );
      const sentences = chunks[longestIdx].split(/(?<=[.!?])\s+/);
      if (sentences.length < 2) break; // can't split further
      const mid = Math.ceil(sentences.length / 2);
      chunks.splice(
        longestIdx,
        1,
        sentences.slice(0, mid).join(" "),
        sentences.slice(mid).join(" ")
      );
    }
    chunks = chunks.slice(0, targetCount);
  }

  return chunks.map((chunk, idx): ScenePlan => {
    const words = chunk.split(/\s+/).filter((w) => w.length > 0);
    const voiceoverWords = words.slice(0, maxWords).join(" ");
    const sceneId = padSceneId(idx + 1);

    // Simple emotion heuristic based on position
    let emotion = "neutral";
    const pos = idx / Math.max(chunks.length - 1, 1);
    if (pos < 0.15) emotion = "calm";
    else if (pos < 0.35) emotion = "curious";
    else if (pos < 0.55) emotion = "tense";
    else if (pos < 0.75) emotion = "climactic";
    else if (pos < 0.9) emotion = "hopeful";
    else emotion = "peaceful";

    const negativeBase =
      "blurry, distorted, text overlay, watermark, multiple people unless specified";
    const ethnicityNegation =
      defaultEthnicity.toLowerCase().includes("black") ||
      defaultEthnicity.toLowerCase().includes("african")
        ? ", white skin, caucasian features, european features, asian features"
        : "";

    return {
      scene_id: sceneId,
      scene_number: idx + 1,
      duration: contract.sceneDurationSeconds,
      title: `Scene ${idx + 1}`,
      summary: chunk.slice(0, 120),
      characters: allCharIds.slice(0, 2),
      location: "unspecified location",
      time_of_day: idx === 0 ? "morning" : idx === chunks.length - 1 ? "evening" : "daytime",
      emotion,
      visual_prompt: chunk.slice(0, 200),
      image_prompt:
        `${defaultEthnicity} character in realistic African setting. ${chunk.slice(0, 150)}. ` +
        `Warm natural lighting, cinematic composition.`,
      video_prompt: `Slow natural motion: ${chunk.slice(0, 100)}`,
      negative_prompt: negativeBase + ethnicityNegation,
      voiceover_text: voiceoverWords,
      dialogue: "",
      subtitle_text: voiceoverWords,
      subtitle_style: contract.subtitleStyle,
      music_cue: `${emotion} ambient background`,
      sfx_cues: [],
      camera_style: idx === 0 ? "wide establishing shot" : "medium shot",
      continuity_notes: [],
      provider_recommendation: "image_plus_motion",
      provider_reason: "fallback paragraph split — default to image+motion",
    };
  });
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function demarcateScenes(
  storyText: string,
  contract: StoryContract,
  castBible: CastBibleEntry[]
): Promise<SupervisorResult<{ scenes: ScenePlan[] }>> {
  const blockingIssues: string[] = [];
  const warnings: string[] = [];
  const suggestedFixes: string[] = [];

  let scenes: ScenePlan[] = [];
  let usedAI = false;

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      scenes = await callHaikuForScenes(storyText, contract, castBible);
      usedAI = true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      warnings.push(`AI scene demarcation failed (${msg}). Using paragraph-based fallback.`);
      scenes = demarcateByParagraphs(storyText, contract, castBible);
    }
  } else {
    warnings.push("ANTHROPIC_API_KEY not set. Using paragraph-based scene demarcation.");
    scenes = demarcateByParagraphs(storyText, contract, castBible);
  }

  if (scenes.length === 0) {
    blockingIssues.push("Scene demarcation produced 0 scenes.");
    suggestedFixes.push("Check story text is non-empty and contract has a valid estimatedSceneCount.");
  }

  // Verify scene count vs expected
  if (scenes.length !== contract.estimatedSceneCount) {
    warnings.push(
      `Expected ${contract.estimatedSceneCount} scenes, got ${scenes.length}. ` +
        `This may affect timing and pacing.`
    );
  }

  // Verify each scene has a voiceover_text
  const emptyVoiceover = scenes.filter((s) => !s.voiceover_text.trim());
  if (emptyVoiceover.length > 0) {
    warnings.push(
      `${emptyVoiceover.length} scenes have empty voiceover_text: ` +
        `${emptyVoiceover.map((s) => s.scene_id).join(", ")}.`
    );
  }

  // Attach default shot to each scene (Scene = Folder of Shots)
  scenes = scenes.map(scene => ({
    ...scene,
    shots: scene.shots?.length ? scene.shots : [buildDefaultShot(scene, 0)],
  }));

  const score = blockingIssues.length > 0 ? 0 : warnings.length > 0 ? 80 : 100;
  const passed = blockingIssues.length === 0;

  return {
    passed,
    score,
    blockingIssues,
    warnings,
    suggestedFixes,
    revisedData: { scenes },
    metadata: {
      sceneCount: scenes.length,
      expectedSceneCount: contract.estimatedSceneCount,
      usedAI,
      maxWordsPerScene: maxWordsForDuration(contract.sceneDurationSeconds),
    },
  };
}
