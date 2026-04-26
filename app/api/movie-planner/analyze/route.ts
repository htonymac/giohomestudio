// POST /api/movie-planner/analyze
// Scene Intelligence Layer — Multi-AI Cinematic Expansion
//
// 3 AI layers (uses different providers for diversity of thinking):
//   AI 1: Primary Story AI — expands short input into full cinematic detail
//   AI 2: Technical Scene AI — adds physical realism, SFX triggers, environment
//   AI 3: Quality Review AI — validates logic, finds gaps, improves pacing
//
// 3 Non-LLM engines (pure code logic):
//   1. Continuity Checker — compares characters/settings across scenes
//   2. SFX Resolver — matches scene needs to library
//   3. Generation Strategy — assigns image/video/hybrid per scene
//
// Input: script/idea text, genre, style, format, characters
// Output: full scene packages with dialogue, SFX, ambience, camera, generation method

import { NextRequest, NextResponse } from "next/server";
import { loadLLMSettings } from "@/lib/llm-settings";
import { makeCacheKey, getCached, setCache } from "@/lib/intelligence-cache";

// ── AI Layer 1: Primary Story AI ────────────────────────────────────────────

const STORY_AI_SYSTEM = `You are a professional movie director and screenwriter. Your job is to expand short, simple scene descriptions into FULL cinematic blueprints.

When a user writes something simple like "the man killed the big snake," you must expand it into:
- Full physical movement (how the man approached, his stance, his breathing)
- Emotional state (fear, determination, anger)
- Environmental detail (where this happens, lighting, weather, time of day)
- Props and objects (what weapon, what's nearby, the snake's size and behavior)
- Sound design (what the audience should hear at each moment)
- Camera direction (shot type, movement, angle)
- Pacing (slow tension build vs quick action)
- Dialogue or internal monologue if relevant

Think like a producer who must give a crew EVERY detail they need to shoot the scene.

Return a JSON object with:
{
  "scenes": [{
    "scene": 1,
    "title": "Scene title",
    "summary": "Full cinematic description (3-5 sentences)",
    "characters": ["Character names"],
    "dialogue": "Any spoken words",
    "actions": "Detailed physical movement and behavior",
    "environment": "Setting, lighting, weather, time",
    "mood": "Emotional tone",
    "camera": "Shot types and movement",
    "pacing": "Fast/slow/building",
    "duration": "estimated seconds"
  }]
}

Return ONLY valid JSON.`;

// ── AI Layer 2: Technical Scene AI ──────────────────────────────────────────

const TECHNICAL_AI_SYSTEM = `You are a technical director and foley artist for film production. Given a cinematic scene blueprint, your job is to add PHYSICAL REALISM and SOUND DESIGN.

For each scene, you must determine:
- Exact sound effects needed (e.g. "revolver click" not just "gun sound")
- Ambient sounds (rain intensity, traffic type, crowd size, room echo)
- Environmental physics (how sound travels in this space)
- Object interactions (fabric rustle, metal clang, wood crack)
- Weather effects on sound and visuals
- Movement timing (footsteps pace, breathing rate)
- Props specification (weapon type, vehicle type, furniture)
- Distance and spatial audio (close/far, left/right)

For each scene, plan ALL 5 audio layers:
1. Dialogue/voice — who speaks, tone, volume
2. Narration — should this scene have narration? How strong? (image scenes = strong narration, video scenes = minimal/none)
3. SFX — exact sound effects with timing
4. Ambience — continuous background sounds
5. Music — specific music style, intensity, instrument family, mood change

Return a JSON object with:
{
  "scenes": [{
    "scene": 1,
    "sfx_needed": ["specific sound effect 1", "specific sound effect 2"],
    "ambience": "detailed ambient sound description",
    "weather_effects": "how weather affects the scene",
    "props_detail": "specific prop descriptions",
    "movement_timing": "pace and timing details",
    "spatial_audio": "distance and positioning notes",
    "music_cue": "what music should do here",
    "music_style": "e.g. suspense build, emotional piano, heroic swell, African percussion",
    "music_intensity": "low/medium/high",
    "narration_need": "strong/medium/light/none",
    "narration_type": "descriptive/emotional/transitional/none",
    "audio_layers": {
      "dialogue": "description of any spoken words",
      "narration": "what the narrator should say for this scene",
      "sfx": "layered sound effects",
      "ambience": "continuous background",
      "music": "specific music direction"
    }
  }]
}

Return ONLY valid JSON.`;

// ── AI Layer 3: Quality Review AI ───────────────────────────────────────────

const REVIEW_AI_SYSTEM = `You are a film quality reviewer and continuity supervisor. Given a complete scene blueprint with story and technical details, your job is to:

1. Find MISSING BEATS — scenes that jump too fast without setup or transition
2. Find LOGIC GAPS — things that don't make physical or emotional sense
3. Find CONTINUITY ISSUES — character outfit changes, weather shifts, prop inconsistencies
4. Find PACING PROBLEMS — scenes that are too rushed or too slow
5. Suggest IMPROVEMENTS — better camera angles, stronger emotional beats, missing reactions

Return a JSON object with:
{
  "score": 0-100,
  "issues": [{ "scene": 1, "type": "missing_beat|logic_gap|continuity|pacing", "description": "what's wrong", "fix": "how to fix it" }],
  "improvements": [{ "scene": 1, "suggestion": "what would make this better" }],
  "missing_scenes": ["description of scene that should be added between existing scenes"],
  "overall_notes": "general quality assessment"
}

Return ONLY valid JSON.`;

// ── Provider caller helper ──────────────────────────────────────────────────

async function callAI(
  prompt: string,
  system: string,
  preferredProvider: "claude" | "openai" | "grok" | "ollama" | "any",
  maxTokens: number = 1500,
): Promise<{ text: string; provider: string } | null> {
  const settings = loadLLMSettings();

  // Build provider-specific callers
  const callers: Array<{ name: string; fn: () => Promise<string | null> }> = [];

  // Claude
  if (settings.ANTHROPIC_API_KEY) {
    callers.push({
      name: "claude",
      fn: async () => {
        const Anthropic = (await import("@anthropic-ai/sdk")).default;
        const client = new Anthropic({ apiKey: settings.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: maxTokens,
          system,
          messages: [{ role: "user", content: prompt }],
        });
        return (msg.content[0] as { text: string })?.text?.trim() ?? null;
      },
    });
  }

  // OpenAI
  if (settings.OPENAI_API_KEY) {
    callers.push({
      name: "openai",
      fn: async () => {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: settings.OPENAI_API_KEY });
        const res = await client.chat.completions.create({
          model: "gpt-4o",
          max_tokens: maxTokens,
          temperature: 0.5,
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        });
        return res.choices[0]?.message?.content?.trim() ?? null;
      },
    });
  }

  // Grok (xAI)
  if (settings.XAI_API_KEY) {
    callers.push({
      name: "grok",
      fn: async () => {
        const { default: OpenAI } = await import("openai");
        const client = new OpenAI({ apiKey: settings.XAI_API_KEY, baseURL: "https://api.x.ai/v1" });
        const res = await client.chat.completions.create({
          model: "grok-3",
          max_tokens: maxTokens,
          temperature: 0.5,
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
        });
        return res.choices[0]?.message?.content?.trim() ?? null;
      },
    });
  }

  // Ollama
  const ollamaBase = settings.OLLAMA_BASE_URL || "http://localhost:11434";
  callers.push({
    name: "ollama",
    fn: async () => {
      const res = await fetch(`${ollamaBase}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: settings.OLLAMA_MODEL_QUALITY || "qwen2.5:14b",
          messages: [{ role: "system", content: system }, { role: "user", content: prompt }],
          stream: false,
          options: { temperature: 0.5, num_predict: maxTokens },
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data?.message?.content?.trim() ?? null;
    },
  });

  // Try preferred provider first, then others
  if (preferredProvider !== "any") {
    const preferred = callers.find(c => c.name === preferredProvider);
    if (preferred) {
      try {
        const text = await preferred.fn();
        if (text) return { text, provider: preferred.name };
      } catch { /* try next */ }
    }
  }

  // Try all remaining
  for (const caller of callers) {
    if (preferredProvider !== "any" && caller.name === preferredProvider) continue;
    try {
      const text = await caller.fn();
      if (text) return { text, provider: caller.name };
    } catch { /* try next */ }
  }

  return null;
}

function parseJSON(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ── Non-LLM Engine 1: Continuity Checker ────────────────────────────────────

function checkContinuity(scenes: Array<Record<string, unknown>>): string[] {
  const issues: string[] = [];
  const characters = new Set<string>();
  let lastEnvironment = "";
  let lastWeather = "";

  for (const scene of scenes) {
    const chars = (scene.characters as string[]) ?? [];
    const env = (scene.environment as string) ?? "";
    const weather = (scene.weather_effects as string) ?? "";

    // Check if characters appear/disappear without explanation
    for (const c of chars) {
      if (!characters.has(c) && characters.size > 0) {
        issues.push(`Scene ${scene.scene}: New character "${c}" appears — needs introduction`);
      }
      characters.add(c);
    }

    // Check environment jumps
    if (lastEnvironment && env && !env.includes(lastEnvironment.split(",")[0]) && !lastEnvironment.includes(env.split(",")[0])) {
      issues.push(`Scene ${scene.scene}: Environment changed from "${lastEnvironment.slice(0, 30)}" to "${env.slice(0, 30)}" — needs transition`);
    }

    // Check weather jumps
    if (lastWeather && weather && lastWeather !== weather) {
      issues.push(`Scene ${scene.scene}: Weather changed from "${lastWeather}" to "${weather}" — is this intentional?`);
    }

    if (env) lastEnvironment = env;
    if (weather) lastWeather = weather;
  }

  return issues;
}

// ── Non-LLM Engine 2: SFX Resolver ──────────────────────────────────────────

const INTERNAL_SFX: Record<string, string[]> = {
  footsteps: ["footstep_walk", "footstep_run"],
  rain: ["rain", "heavy_rain"],
  wind: ["wind"],
  thunder: ["thunder"],
  door: ["door_knock"],
  gun: ["explosion"],
  crowd: ["crowd"],
  traffic: ["city_traffic"],
  birds: ["forest_birds"],
  ocean: ["ocean"],
  heartbeat: ["heartbeat"],
  typing: ["typing"],
  notification: ["notification"],
  bell: ["bell_church"],
  siren: ["siren"],
  breathing: ["deep_ambience"],
  impact: ["boom", "sub_bass_hit"],
  whoosh: ["whoosh", "swoosh"],
  click: ["click"],
  snap: ["snap"],
};

function resolveSFX(sfxNeeded: string[]): Array<{ need: string; source: string; match: string; confidence: string }> {
  return sfxNeeded.map(need => {
    const lower = need.toLowerCase();
    for (const [key, files] of Object.entries(INTERNAL_SFX)) {
      if (lower.includes(key)) {
        return { need, source: "internal", match: files[0], confidence: "high" };
      }
    }
    // Check partial matches
    for (const [key, files] of Object.entries(INTERNAL_SFX)) {
      if (key.includes(lower.split(" ")[0]) || lower.split(" ").some(w => key.includes(w))) {
        return { need, source: "internal", match: files[0], confidence: "medium" };
      }
    }
    return { need, source: "needs_generation", match: "", confidence: "low" };
  });
}

// ── Non-LLM Engine 3: Hybrid Scene Intelligence (Core GHS Doctrine) ─────────
//
// MASTER RULE: Not every scene should be video. Not every scene should be still.
//   Images → Setup & Emotion (cheap, narration-heavy)
//   Video → Action & Movement (premium, narration-minimal)
//   Audio → Continuity & Life (always present)
//
// Narration changes by scene type:
//   Image scene: rich, descriptive, world-building
//   Video scene: minimal or none — motion speaks
//   Audio bridge: strongest narration — guides viewer

interface HybridStrategy {
  sceneType: "image-led" | "video-led" | "image-to-video" | "audio-bridge" | "hybrid";
  generationMethod: string;
  costLabel: "efficient" | "balanced" | "premium";
  credits: number;
  motionNeed: "none" | "low" | "medium" | "high";
  motionDuration: number;  // seconds of video needed (0 for image scenes)
  narrationMode: "descriptive" | "light" | "none" | "transitional" | "emotional";
  narrationStrength: "strong" | "medium" | "minimal" | "none";
  reason: string;
  imageTreatment?: string;  // pan, zoom, parallax, static
}

function assignGenerationStrategy(
  scene: Record<string, unknown>,
  outputFormat: string,
): HybridStrategy {
  const pacing = ((scene.pacing as string) ?? "").toLowerCase();
  const actions = ((scene.actions as string) ?? "").toLowerCase();
  const mood = ((scene.mood as string) ?? "").toLowerCase();
  const summary = ((scene.summary as string) ?? "").toLowerCase();
  const dialogue = (scene.dialogue as string) ?? "";

  // Detect scene characteristics
  const ACTION_WORDS = ["run", "fight", "chase", "jump", "attack", "fall", "hit", "shoot", "throw", "grab", "escape", "crash", "explode", "kick", "punch", "dodge", "climb", "swing", "dive"];
  const CALM_WORDS = ["slow", "calm", "quiet", "peaceful", "still", "pause", "wait", "stand", "sit", "reflect", "think", "stare", "gaze", "rest"];
  const EMOTION_WORDS = ["cry", "tear", "smile", "laugh", "fear", "anger", "love", "grief", "joy", "pain", "shock", "surprise"];

  const hasAction = ACTION_WORDS.some(w => actions.includes(w) || summary.includes(w));
  const isCalm = CALM_WORDS.some(w => pacing.includes(w) || mood.includes(w) || summary.includes(w));
  const isEmotional = EMOTION_WORDS.some(w => mood.includes(w) || summary.includes(w));
  const hasDialogue = dialogue.length > 20;
  const isFast = pacing.includes("fast") || pacing.includes("intense") || pacing.includes("quick");
  const isIntro = summary.includes("opening") || summary.includes("intro") || summary.includes("establish");
  const isOutro = summary.includes("ending") || summary.includes("outro") || summary.includes("closing") || summary.includes("resolution");
  const isTransition = summary.includes("transition") || summary.includes("bridge") || summary.includes("meanwhile");

  // ── Audio Only format ──
  if (outputFormat === "audio_only") {
    return {
      sceneType: "audio-bridge", generationMethod: "audio-only", costLabel: "efficient", credits: 0,
      motionNeed: "none", motionDuration: 0,
      narrationMode: "descriptive", narrationStrength: "strong",
      reason: "Audio-only format — narration and sound carry the scene",
    };
  }

  // ── Audio + Image format (cheapest visual) ──
  if (outputFormat === "audio_image") {
    return {
      sceneType: "image-led", generationMethod: "image", costLabel: "efficient", credits: 1,
      motionNeed: "none", motionDuration: 0,
      narrationMode: "descriptive", narrationStrength: "strong",
      reason: "Image-led format — narration describes what the viewer sees",
      imageTreatment: isEmotional ? "slow zoom" : isIntro ? "pan" : "static",
    };
  }

  // ── Transition / Bridge ──
  if (isTransition) {
    return {
      sceneType: "audio-bridge", generationMethod: "audio-only", costLabel: "efficient", credits: 0,
      motionNeed: "none", motionDuration: 0,
      narrationMode: "transitional", narrationStrength: "strong",
      reason: "Bridge scene — audio guides transition, saves credits",
    };
  }

  // ── High Action — MUST be video ──
  if (hasAction && isFast) {
    return {
      sceneType: "video-led", generationMethod: "video", costLabel: "premium", credits: 4,
      motionNeed: "high", motionDuration: 10,
      narrationMode: "none", narrationStrength: "none",
      reason: "High action scene — motion and sound tell the story, not narration",
    };
  }

  // ── Moderate Action — short video burst ──
  if (hasAction && !isFast) {
    return {
      sceneType: "hybrid", generationMethod: "image-to-video", costLabel: "balanced", credits: 2,
      motionNeed: "medium", motionDuration: 5,
      narrationMode: "light", narrationStrength: "minimal",
      reason: "Moderate action — 5s motion burst, narration minimal",
    };
  }

  // ── Video First format — everything gets video ──
  if (outputFormat === "video_first") {
    return {
      sceneType: "video-led", generationMethod: "video", costLabel: "premium", credits: 4,
      motionNeed: "high", motionDuration: 10,
      narrationMode: isCalm ? "light" : "none", narrationStrength: isCalm ? "medium" : "none",
      reason: "Video-first format — full motion for every scene",
    };
  }

  // ── Emotional scene — image with strong narration ──
  if (isEmotional && isCalm) {
    return {
      sceneType: "image-led", generationMethod: "image", costLabel: "efficient", credits: 1,
      motionNeed: "low", motionDuration: 0,
      narrationMode: "emotional", narrationStrength: "strong",
      reason: "Emotional pause — still frame with rich narration is more powerful than motion",
      imageTreatment: "slow zoom",
    };
  }

  // ── Dialogue scene — image with pan ──
  if (hasDialogue && !hasAction) {
    return {
      sceneType: "image-led", generationMethod: "image", costLabel: "efficient", credits: 1,
      motionNeed: "low", motionDuration: 0,
      narrationMode: "descriptive", narrationStrength: "medium",
      reason: "Dialogue scene — characters talking, image + voice is sufficient",
      imageTreatment: "parallax",
    };
  }

  // ── Intro/outro — image-to-video ──
  if (isIntro || isOutro) {
    return {
      sceneType: "image-to-video", generationMethod: "image-to-video", costLabel: "balanced", credits: 2,
      motionNeed: "low", motionDuration: 5,
      narrationMode: isIntro ? "descriptive" : "emotional", narrationStrength: "medium",
      reason: `${isIntro ? "Opening" : "Closing"} scene — subtle motion to draw viewer in/out`,
      imageTreatment: isIntro ? "slow zoom in" : "slow zoom out",
    };
  }

  // ── Default: hybrid balanced ──
  return {
    sceneType: "hybrid", generationMethod: "image-to-video", costLabel: "balanced", credits: 2,
    motionNeed: "medium", motionDuration: 5,
    narrationMode: "light", narrationStrength: "medium",
    reason: "Standard scene — moderate motion with supporting narration",
  };
}

// ── Main Handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idea, expandedStory, genre, style, format, tone, setting, characters, language } = body;

    if (!idea) return NextResponse.json({ error: "Movie idea required" }, { status: 400 });

    // ═══ Check intelligence cache for reusable skeleton ═══
    const cacheKey = makeCacheKey({ type: "movie", genre, mood: tone, style, format });
    const cached = getCached(cacheKey);
    // Cache provides reusable skeleton (scene structure, SFX patterns, camera grammar)
    // but final scenes are always personalized with the user's specific idea + characters

    const fullInput = [
      idea,
      expandedStory && `More details: ${expandedStory}`,
      genre && `Genre: ${genre}`,
      style && `Style: ${style}`,
      tone && `Tone: ${tone}`,
      setting && `Setting: ${setting}`,
      language && `Language: ${language}`,
      characters?.length && `Characters: ${JSON.stringify(characters)}`,
    ].filter(Boolean).join("\n");

    // ═══ AI LAYER 1: Primary Story AI ═══
    const storyResult = await callAI(
      `Expand this movie idea into 5-8 detailed cinematic scenes:\n\n${fullInput}`,
      STORY_AI_SYSTEM,
      "claude", // prefer Claude for creative writing
      2000,
    );

    let storyScenes: Array<Record<string, unknown>> = [];
    if (storyResult) {
      const parsed = parseJSON(storyResult.text);
      if (parsed?.scenes) storyScenes = parsed.scenes as Array<Record<string, unknown>>;
    }

    // Fallback if AI 1 fails
    if (storyScenes.length === 0) {
      storyScenes = [
        { scene: 1, title: "Opening", summary: idea, characters: [], dialogue: "", actions: idea, environment: setting ?? "Unknown", mood: tone ?? "dramatic", camera: "Establishing wide shot", pacing: "slow build", duration: "30s" },
        { scene: 2, title: "Development", summary: "Story develops", characters: [], dialogue: "", actions: "Character actions", environment: setting ?? "Unknown", mood: tone ?? "dramatic", camera: "Medium shots", pacing: "building", duration: "45s" },
        { scene: 3, title: "Climax", summary: "Peak moment", characters: [], dialogue: "", actions: "Climactic action", environment: setting ?? "Unknown", mood: "intense", camera: "Close-ups, dynamic", pacing: "fast", duration: "30s" },
        { scene: 4, title: "Resolution", summary: "Aftermath", characters: [], dialogue: "", actions: "Resolution", environment: setting ?? "Unknown", mood: "reflective", camera: "Wide pull-back", pacing: "slow", duration: "20s" },
      ];
    }

    // ═══ AI LAYER 2: Technical Scene AI ═══
    const technicalResult = await callAI(
      `Add technical production details to these scenes. Focus on EXACT sound effects, ambience, weather, props, movement timing, and spatial audio:\n\n${JSON.stringify(storyScenes)}`,
      TECHNICAL_AI_SYSTEM,
      "openai", // prefer GPT for technical analysis
      1500,
    );

    let technicalData: Array<Record<string, unknown>> = [];
    if (technicalResult) {
      const parsed = parseJSON(technicalResult.text);
      if (parsed?.scenes) technicalData = parsed.scenes as Array<Record<string, unknown>>;
    }

    // ═══ Merge Story + Technical into Scene Packages (Hybrid Doctrine) ═══
    const mergedScenes = storyScenes.map((story, i) => {
      const tech = technicalData.find(t => t.scene === story.scene) ?? technicalData[i] ?? {};
      const strategy = assignGenerationStrategy(story, format ?? "audio_video_image");
      return {
        ...story,
        sfx_needed: (tech.sfx_needed as string[]) ?? [],
        ambience: (tech.ambience as string) ?? "",
        weather_effects: (tech.weather_effects as string) ?? "",
        props_detail: (tech.props_detail as string) ?? "",
        movement_timing: (tech.movement_timing as string) ?? "",
        spatial_audio: (tech.spatial_audio as string) ?? "",
        music_cue: (tech.music_cue as string) ?? "",
        music_style: (tech.music_style as string) ?? "",
        music_intensity: (tech.music_intensity as string) ?? "medium",
        narration_need: (tech.narration_need as string) ?? "",
        narration_type: (tech.narration_type as string) ?? "",
        audio_layers: tech.audio_layers ?? null,
        // Hybrid intelligence
        sceneType: strategy.sceneType,
        generationMethod: strategy.generationMethod,
        costLabel: strategy.costLabel,
        credits: strategy.credits,
        motionNeed: strategy.motionNeed,
        motionDuration: strategy.motionDuration,
        // Narration: use Technical AI suggestion if available, otherwise use Hybrid strategy
        narrationMode: (tech.narration_type as string) || strategy.narrationMode,
        narrationStrength: (tech.narration_need as string) || strategy.narrationStrength,
        // Generate narration text for image scenes (strong narration needed)
        narrationScript: strategy.sceneType === "image-led" || strategy.sceneType === "audio-bridge"
          ? `[Auto-narration needed — ${strategy.narrationMode}: describe the scene for the viewer]`
          : strategy.sceneType === "video-led" ? "" : "[Light narration — support only]",
        hybridReason: strategy.reason,
        imageTreatment: strategy.imageTreatment,
        status: "planned",
      };
    });

    // ═══ Cost comparison: Hybrid vs Full Video ═══
    const hybridCredits = mergedScenes.reduce((sum, s) => sum + (s.credits ?? 2), 0);
    const fullVideoCredits = mergedScenes.length * 4; // if every scene was premium video
    const savedCredits = fullVideoCredits - hybridCredits;
    const imageScenes = mergedScenes.filter(s => s.sceneType === "image-led").length;
    const videoScenes = mergedScenes.filter(s => s.sceneType === "video-led").length;
    const hybridScenes = mergedScenes.filter(s => s.sceneType === "hybrid" || s.sceneType === "image-to-video").length;
    const bridgeScenes = mergedScenes.filter(s => s.sceneType === "audio-bridge").length;

    // ═══ AI LAYER 3: Quality Review ═══
    const reviewResult = await callAI(
      `Review this movie blueprint for quality. Find missing beats, logic gaps, continuity issues, and pacing problems:\n\n${JSON.stringify(mergedScenes)}`,
      REVIEW_AI_SYSTEM,
      "grok", // prefer Grok for critical review (different perspective)
      800,
    );

    let reviewData: Record<string, unknown> = { score: 70, issues: [], improvements: [], missing_scenes: [], overall_notes: "Review pending" };
    if (reviewResult) {
      const parsed = parseJSON(reviewResult.text);
      if (parsed) reviewData = parsed;
    }

    // ═══ Non-LLM Engine 1: Continuity Check ═══
    const continuityIssues = checkContinuity(mergedScenes);

    // ═══ Non-LLM Engine 2: SFX Resolution ═══
    const allSfxNeeds = mergedScenes.flatMap(s => (s.sfx_needed as string[]) ?? []);
    const sfxResolution = resolveSFX(allSfxNeeds);
    const missingSfx = sfxResolution.filter(s => s.confidence === "low");

    // ═══ Cache reusable skeleton (NOT the personalized scenes) ═══
    if (!cached) {
      setCache(cacheKey, {
        generationStrategy: mergedScenes.map(s => ({ generationMethod: s.generationMethod, costLabel: s.costLabel })),
        sfxPatterns: allSfxNeeds,
        continuityRules: continuityIssues,
      });
    }

    return NextResponse.json({
      scenes: mergedScenes,
      cached: !!cached,
      review: reviewData,
      continuityIssues,
      sfxResolution,
      missingSfx,
      // Hybrid cost intelligence
      costComparison: {
        hybridCredits,
        fullVideoCredits,
        savedCredits,
        savingsPercent: Math.round((savedCredits / fullVideoCredits) * 100),
        breakdown: { imageScenes, videoScenes, hybridScenes, bridgeScenes },
      },
      providers: {
        storyDirector: storyResult?.provider ?? "fallback",
        technicalDirector: technicalResult?.provider ?? "fallback",
        qualityReviewer: reviewResult?.provider ?? "fallback",
      },
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
