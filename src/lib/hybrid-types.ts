// GHS Hybrid Pipeline — Master Type Definitions
// Source of truth: update/GHS_HYBRID_MASTER_WORKFLOW.md
// All hybrid production modes must use these types.

// ── Character Identity Object ──
export interface CharacterIdentity {
  characterId: string;        // CH01, CH02... persistent across everything
  displayName: string;
  roleType: "hero" | "villain" | "narrator" | "support" | "elder" | "child" | "comic_relief";
  gender: string;
  ageRange: string;
  height?: string;
  bodyType?: string;
  skinTone?: string;
  hairStyle?: string;
  facialTraits?: string;
  wardrobeStyle?: string;
  speechStyle?: string;
  accentType?: string;
  emotionProfile?: string;
  voiceId?: string;           // ElevenLabs/Piper voice ID
  language: string;
  tags: string[];
  referenceAssetIds: string[];
}

// ── Scene Intelligence Scoring ──
export interface SceneIntelligence {
  motionNeed: "low" | "medium" | "high";
  imageSuitability: number;     // 1-10
  motionNecessity: number;      // 1-10
  recommendedMotionDuration?: number; // seconds
  narrationIntensity: "none" | "low" | "medium" | "high";
  dialogueDensity: "low" | "medium" | "high";
  emotionalWeight: "low" | "medium" | "high";
  costPriority: "efficient" | "balanced" | "premium";
  fullVideoJustification?: string;
  tags: string[]; // narration-heavy, action-heavy, emotion-heavy, transition, montage, reveal, suspense, reflective, payoff
}

// ── Hybrid Scene Types ──
export type HybridSceneType = "image-led" | "video-led" | "image-to-video" | "audio-bridge" | "hybrid";

// ── Scene Object ──
export interface HybridSceneData {
  sceneId: string;              // SC01, SC02...
  title: string;
  orderIndex: number;
  location?: string;
  timeOfDay?: string;
  weather?: string;
  mood?: string;
  characterIds: string[];       // CH01, CH02...
  primarySpeaker?: string;      // CH01
  secondarySpeakers: string[];
  sceneType: HybridSceneType;
  intelligence: SceneIntelligence;
  durationEstimate?: number;    // seconds
  lightingPlan?: string;
  cameraSuggestion?: string;
  soundSuggestion?: string;
  musicSuggestion?: string;
  draftState: "draft" | "reviewed" | "locked" | "generating" | "generated";
  status: "planned" | "in_progress" | "completed" | "error";
  generatedAssetUrl?: string;
  shots: ShotData[];
  dialogueLines: DialogueLineData[];
  audioPlan?: AudioPlanData;
}

// ── Shot Object ──
export interface ShotData {
  shotId: string;               // SH01, SH02...
  sceneId: string;
  orderIndex: number;
  visibleCharacterIds: string[];
  speakingCharacterId?: string;
  listeningCharacterIds: string[];
  cameraAngle?: "close-up" | "medium" | "wide" | "over-the-shoulder" | "establishing" | "macro" | "topdown";
  cameraMovement?: "static" | "pan" | "tilt" | "dolly" | "crane" | "handheld" | "zoom";
  framingType?: "single" | "two-shot" | "group" | "establishing" | "insert";
  lightingStyle?: string;
  dialogueLineId?: string;
  mediaType?: "image" | "video" | "image-to-video";
  plannedDuration?: number;     // seconds
  environmentSfx?: string;
  regenEligible: boolean;
  generatedAssetUrl?: string;
  status: "planned" | "generating" | "generated" | "error";
}

// ── Dialogue Line Object ──
export interface DialogueLineData {
  lineId: string;
  sceneId: string;
  shotId?: string;
  characterId: string;          // CH01 — NEVER unowned
  voiceId?: string;
  lineText: string;
  timingType?: "sync" | "pre-lap" | "post-lap" | "overlap";
  orderIndex: number;
}

// ── Audio Plan Object ──
export interface AudioPlanData {
  audioPlanId: string;
  sceneId: string;
  narrationTrack?: {
    text: string;
    voiceId?: string;
    intensity: "none" | "low" | "medium" | "high";
    style: "descriptive" | "transitional" | "light" | "dramatic" | "children";
  };
  dialogueTracks: Array<{
    characterId: string;
    voiceId?: string;
    lines: string[];
  }>;
  ambienceTracks: Array<{
    description: string;
    volume: number;
    loop: boolean;
  }>;
  sfxTracks: Array<{
    event: string;
    timing: number;   // seconds from scene start
    volume: number;
  }>;
  musicTrack?: {
    mood: string;
    intensity: "low" | "medium" | "high";
    instrument?: string;
    fadeIn?: number;
    fadeOut?: number;
  };
  transitionAudioLogic?: string;
}

// ── Hybrid Project Status ──
export type HybridProjectStatus =
  | "STORY_INPUT"
  | "EXPANDING"
  | "CHARACTERS_READY"
  | "SCENES_READY"
  | "SHOTS_READY"
  | "AUDIO_PLANNED"
  | "DRAFT_REVIEW"
  | "VALIDATED"
  | "ASSEMBLING"
  | "ASSEMBLED"
  | "EXPORTING"
  | "EXPORTED";

// ── Full Hybrid Project ──
export interface HybridProjectData {
  projectId: string;
  title: string;
  storyInput: string;
  expandedStory?: {
    summary: string;
    tone: string;
    pacingDirection: string;
    worldLogic: string;
    emotionLogic: string;
    narrativeArc: string;
    characterList: CharacterIdentity[];
    locationList: Array<{ name: string; description: string }>;
    soundSuggestions: string[];
    moodSuggestions: string[];
    actionPeaks: string[];
    narrationHeavyAreas: string[];
  };
  targetDuration?: string;
  audience?: string;
  language: string;
  costPreference?: "efficient" | "balanced" | "premium";
  narrationPreference?: "heavy" | "balanced" | "minimal";
  tone?: string;
  genre?: string;
  status: HybridProjectStatus;
  characters: CharacterIdentity[];
  scenes: HybridSceneData[];
}

// ── Narration Strategy Result ──
export interface NarrationStrategy {
  intensity: "none" | "low" | "medium" | "high";
  mode: "descriptive" | "transitional" | "light" | "dramatic" | "none";
  tapering: boolean;  // narration reduces as motion takes over
  reason: string;
}

// ── Media Routing Decision ──
export interface MediaRoutingDecision {
  shotId: string;
  sceneId: string;
  engine: "image" | "image-with-motion" | "image-to-video" | "video" | "audio-only";
  provider?: string;  // kling, wan, hailuo, fal, etc.
  estimatedCost: number; // credits
  justification: string;
}

// ── Continuity Validation ──
export interface ValidationError {
  type:
    | "wrong_speaker"
    | "voice_mismatch"
    | "missing_character_ref"
    | "duplicate_character"
    | "scene_order_conflict"
    | "missing_shot"
    | "wardrobe_mismatch"
    | "face_mismatch"
    | "unregistered_character_in_shot"
    | "unowned_dialogue"
    | "missing_audio_plan"
    | "missing_narration";
  sceneId?: string;
  shotId?: string;
  characterId?: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}
