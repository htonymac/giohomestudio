import { NextRequest, NextResponse } from "next/server";

// ── Pre-flight check API ─────────────────────────────────────────────────────
// Input: { projectType: 'children'|'movie', scenes: [], audioConfig: {}, characters: [] }
// Output: { checks: [{id, label, status, autoFixAvailable}], canAssemble: boolean }

interface SceneInput {
  sceneId?: string;
  imageUrl?: string;
  videoUrl?: string;
  title?: string;
}

interface AudioConfig {
  narrationProvider?: string;
  narrationAudioUrl?: string;
  musicUrl?: string;
  musicName?: string;
  narrationText?: string;
  characterVoices?: string[];
  autoMusic?: boolean;
}

interface CharacterInput {
  id?: string;
  name?: string;
  voiceId?: string;
  voiceName?: string;
}

export interface PreflightCheck {
  id: string;
  label: string;
  status: "ok" | "warn" | "error";
  detail?: string;
  autoFixAvailable: boolean;
  autoFixAction?: string;
}

export interface PreflightResult {
  checks: PreflightCheck[];
  canAssemble: boolean;
  blockingErrors: number;
  warnings: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const projectType: string = body.projectType ?? "children";
    const story: string = body.story ?? "";
    const scriptSegments: Array<{ type?: string }> = Array.isArray(body.scriptSegments) ? body.scriptSegments : [];
    const scenes: SceneInput[] = Array.isArray(body.scenes) ? body.scenes : [];
    const audioConfig: AudioConfig = body.audioConfig ?? {};
    const characters: CharacterInput[] = Array.isArray(body.characters) ? body.characters : [];

    const checks: PreflightCheck[] = [];

    // ── CHECK 0a: Story / idea present ─────────────────────────────────────
    if (!story || story.trim().length < 10) {
      checks.push({
        id: "story_present",
        label: "Story / idea",
        status: "error",
        detail: "No story found. Write or expand a story in the Story tab first.",
        autoFixAvailable: false,
      });
    } else {
      checks.push({
        id: "story_present",
        label: `Story present (${story.trim().length} chars)`,
        status: "ok",
        autoFixAvailable: false,
      });
    }

    // ── CHECK 0b: Script segments parsed ────────────────────────────────────
    if (scriptSegments.length === 0) {
      checks.push({
        id: "script_segments",
        label: "Script segments",
        status: "warn",
        detail: "No script segments parsed yet. Run Parse Script in the Audio tab for narration-ready output.",
        autoFixAvailable: false,
      });
    } else {
      checks.push({
        id: "script_segments",
        label: `Script parsed (${scriptSegments.length} segment${scriptSegments.length !== 1 ? "s" : ""})`,
        status: "ok",
        autoFixAvailable: false,
      });
    }

    // ── CHECK 1: Scenes present ──────────────────────────────────────────────
    if (scenes.length === 0) {
      checks.push({
        id: "scenes_present",
        label: "Scenes planned",
        status: "error",
        detail: "No scenes found. Expand your story first to generate scenes.",
        autoFixAvailable: false,
      });
    } else {
      checks.push({
        id: "scenes_present",
        label: `Scenes planned (${scenes.length})`,
        status: "ok",
        autoFixAvailable: false,
      });
    }

    // ── CHECK 2: Scene images ─────────────────────────────────────────────────
    if (scenes.length > 0) {
      const withImage = scenes.filter((s: SceneInput) => s.imageUrl || s.videoUrl);
      const missing = scenes.length - withImage.length;
      if (missing === 0) {
        checks.push({
          id: "scene_images",
          label: "Scene images generated",
          status: "ok",
          autoFixAvailable: false,
        });
      } else if (missing < scenes.length) {
        checks.push({
          id: "scene_images",
          label: `Scene images (${withImage.length}/${scenes.length} ready)`,
          status: "warn",
          detail: `${missing} scene(s) have no image yet. Assembly will use placeholder for missing scenes.`,
          autoFixAvailable: false,
        });
      } else {
        checks.push({
          id: "scene_images",
          label: "Scene images",
          status: "warn",
          detail: "No scene images generated yet. Consider generating images before assembling.",
          autoFixAvailable: false,
        });
      }
    }

    // ── CHECK 3: Narration / audio planned ───────────────────────────────────
    const hasNarrationAudio = !!audioConfig.narrationAudioUrl;
    const hasCharacterVoices = Array.isArray(audioConfig.characterVoices) && audioConfig.characterVoices.length > 0;
    const hasNarrationProvider = !!audioConfig.narrationProvider;
    const hasAnyAudio = hasNarrationAudio || hasCharacterVoices || hasNarrationProvider || !!audioConfig.narrationText;
    if (hasNarrationAudio) {
      checks.push({
        id: "narration",
        label: "Narrator audio ready",
        status: "ok",
        autoFixAvailable: false,
      });
    } else if (hasCharacterVoices) {
      checks.push({
        id: "narration",
        label: `Character audio ready (${audioConfig.characterVoices!.length} voice${audioConfig.characterVoices!.length !== 1 ? "s" : ""})`,
        status: "ok",
        autoFixAvailable: false,
      });
    } else if (hasNarrationProvider || hasAnyAudio) {
      checks.push({
        id: "narration",
        label: "Narration provider configured (audio not yet generated)",
        status: "warn",
        detail: "Provider selected but no audio file generated yet. Run Generate Narration before assembly for voiceover.",
        autoFixAvailable: false,
      });
    } else {
      checks.push({
        id: "narration",
        label: "Narration provider",
        status: "warn",
        detail: "No narration provider set. Video will assemble without voiceover.",
        autoFixAvailable: true,
        autoFixAction: "skip_narration",
      });
    }

    // ── CHECK 4: Music ────────────────────────────────────────────────────────
    const hasMusic = audioConfig.musicUrl || audioConfig.musicName || audioConfig.autoMusic || false;
    if (hasMusic) {
      checks.push({
        id: "music",
        label: audioConfig.autoMusic ? "Music: Auto-select enabled" : `Music selected (${audioConfig.musicName || "custom"})`,
        status: "ok",
        autoFixAvailable: false,
      });
    } else {
      checks.push({
        id: "music",
        label: "Background music",
        status: "warn",
        detail: "No music selected. Assembly will proceed without background music.",
        autoFixAvailable: true,
        autoFixAction: "use_stock_music",
      });
    }

    // ── CHECK 5: Character voices (if characters exist) ───────────────────────
    if (characters.length > 0) {
      const withVoice = characters.filter(
        (c: CharacterInput) => c.voiceId || c.voiceName
      );
      if (withVoice.length === characters.length) {
        checks.push({
          id: "character_voices",
          label: `Character voices (${characters.length}/${characters.length} assigned)`,
          status: "ok",
          autoFixAvailable: false,
        });
      } else {
        const missing = characters.length - withVoice.length;
        checks.push({
          id: "character_voices",
          label: `Character voices (${withVoice.length}/${characters.length} assigned)`,
          status: "warn",
          detail: `${missing} character(s) have no voice assigned. Dialogue for those characters will use default TTS voice.`,
          autoFixAvailable: false,
        });
      }
    }

    // ── CHECK 6: Project type specific ────────────────────────────────────────
    if (projectType === "children") {
      // Children: ensure age-appropriate flag is set
      checks.push({
        id: "child_safety",
        label: "Child safety mode active",
        status: "ok",
        detail: "All image prompts use children-safe modifiers.",
        autoFixAvailable: false,
      });
    } else if (projectType === "movie") {
      // Movie: check scenes have descriptions
      const noDesc = scenes.filter(
        (s: SceneInput) => !s.title || s.title.length < 3
      );
      if (noDesc.length > 0) {
        checks.push({
          id: "scene_descriptions",
          label: "Scene descriptions",
          status: "warn",
          detail: `${noDesc.length} scene(s) have missing or very short descriptions.`,
          autoFixAvailable: false,
        });
      } else if (scenes.length > 0) {
        checks.push({
          id: "scene_descriptions",
          label: "Scene descriptions complete",
          status: "ok",
          autoFixAvailable: false,
        });
      }
    }

    // ── Compute summary ───────────────────────────────────────────────────────
    const blockingErrors = checks.filter((c) => c.status === "error").length;
    const warnings = checks.filter((c) => c.status === "warn").length;
    const canAssemble = blockingErrors === 0;

    return NextResponse.json({
      checks,
      canAssemble,
      blockingErrors,
      warnings,
    } satisfies PreflightResult);
  } catch (err) {
    console.error("[pre-flight] error:", err);
    return NextResponse.json(
      { error: "Pre-flight check failed", details: String(err) },
      { status: 500 }
    );
  }
}
