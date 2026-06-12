"use client";

import { useState, useCallback, useEffect, useRef, Suspense } from "react";
import { useGate } from "../../components/PreGenerationGate";
import { useSearchParams } from "next/navigation";
import CharacterPicker from "../../components/CharacterPicker";
import NarrationControls from "../../components/NarrationControls";
import SceneImagePanel from "../../components/SceneImagePanel";
import type { NarrationSettings } from "../../components/NarrationControls";
import { assetToMediaUrl, type MusicAsset } from "../../utils/mediaUrl";
import AITierSelector, { type AITier } from "../../components/AITierSelector";
import { ds } from "../../../lib/designSystem";
import { safeJson } from "../../../lib/api-utils";
import { HeroTitle } from "../../components/hero/HeroTitle";
import * as Icon from "../../components/icons";
import ModelChip from "../../components/ModelChip";
import { useCoordinator } from "../../components/CoordinatorProvider";
import SupervisorStatusBar from "../../components/SupervisorStatusBar";
import { createEmptyAssembly } from "@/lib/assembly-schema";
import type { AssemblySegment, NarrationEntry, MusicEntry, SFXEntry } from "@/lib/assembly-schema";
import SubtitleStyler, { DEFAULT_SUBTITLE_CONFIG, type SubtitleConfig } from "../../components/SubtitleStyler";
import { estimateTextDuration } from "@/lib/auto-timestamp";
import { splitIntoActionBeats } from "@/lib/scene/action-beats";
import { useProjectSettings } from "@/hooks/useProjectSettings";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Hybrid Planner — PRODUCTION WORKSHOP
//
// This is NOT a wizard. This is the user's production workshop and command
// center per the GHS Planner Workshop Master Canvas (23 sections).
//
// Tabs: Overview | Scene Board | Characters | Story & Draft | Audio & Shots | Assembly
//
// The user can freely switch between any tab. All tabs read the same
// source-of-truth objects. Project persists to DB.
// ═══════════════════════════════════════════════════════════════════════════

// ── Types ──

interface CharacterIdentity {
  characterId: string;
  dbId?: string;       // DB CUID from character-voices — set when imported from registry
  displayName: string;
  roleType: string;
  gender: string;
  ageRange: string;
  skinTone: string;
  hairStyle: string;
  wardrobeStyle: string;
  speechStyle: string;
  accentType: string;
  emotionProfile: string;
  voiceId: string;
  language: string;
  tags: string[];
  imageUrl?: string;
  hasVoice?: boolean;
  hasImage?: boolean;
  // ── Voice character ──
  voiceType?: string;    // "deep", "high", "raspy", "soft", "mid", "childlike", "elderly"
  intonation?: string;   // "calm", "energetic", "dramatic", "whisper", "commanding", "playful", "monotone"
  // ── Visual Identity Builder — precise fields that drive consistent image generation ──
  species?: string;           // "rabbit", "human", "lion", "dog"...
  bodyBuild?: string;         // "large and stocky", "small and petite", "tall and slim"...
  colorDescription?: string;  // "warm grey fur with white belly", "dark brown skin"...
  faceFeatures?: string;      // "round spectacles, kind brown eyes, big round nose"...
  clothingDetails?: string;   // "brown leather vest, brown belt, no shirt"...
  accessories?: string;       // "round glasses, wooden walking stick"...
  distinctiveFeatures?: string; // "very big round belly, fluffy white tail, long floppy ears"...
  ageAppearance?: string;     // "elderly, slightly hunched, wrinkles around eyes"...
  imageLocked?: boolean;      // user approved this portrait as the canonical reference
  visualDescription?: string; // editable visual description stored in DB and used for portrait gen
}

interface ShotObject {
  shotId: string;
  sceneId: string;
  orderIndex: number;
  visibleCharacterIds: string[];
  speakingCharacterId: string;
  cameraAngle: string;
  cameraMovement: string;
  framingType: string;
  lightingStyle: string;
  dialogueLine: string;
  mediaType: string;
  plannedDuration: number;
  environmentSfx: string;
}

interface AudioPlan {
  narrationIntensity: string;
  musicMood: string;
  musicIntensity: string;
  sfxList: string[];
  ambienceList: string[];
  transitionAudio: string;
  musicUrl?: string;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

interface HybridScene {
  sceneId: string;
  scene: number;
  title: string;
  description: string;
  sceneType: "image-led" | "video-led" | "image-to-video" | "audio-bridge" | "hybrid";
  narrationMode: string;
  narrationStrength: string;
  narrationScript: string;
  musicStyle: string;
  musicIntensity: string;
  sfx: string;
  ambience: string;
  motionDuration: number;
  imageTreatment: string;
  credits: number;
  reason: string;
  characterIds: string[];
  dialogueDensity: string;
  emotionalWeight: string;
  location: string;
  timeOfDay: string;
  mood: string;
  shots: ShotObject[];
  audioPlan: AudioPlan;
  costEstimate: number;
  status: "draft" | "approved" | "blocked" | "generating" | "generated";
  flipOverride?: number | null;  // seconds per image for this scene; null = use project imageFlipSeconds
  sceneTag?: "VISUAL" | "ACTION" | "BEAT" | "DIALOGUE" | "NARRATION" | "TRANSITION" | "ESTABLISH";
  imageIntent?: string;
}

interface EstablishingShot {
  type: "opening" | "location" | "transition" | "mood" | "pre_action" | "exterior_building" | "aerial" | "beauty";
  prompt: string;
  durationSeconds: number;
  cameraMovement: string;
  mood: string;
  purpose: string;
  location: string;
  timeOfDay: string;
  imageUrl?: string;
}

const ESTABLISHING_TYPE_LABEL: Record<string, string> = {
  opening: "Opening", location: "Location", transition: "Transition",
  mood: "Mood", pre_action: "Pre-Action", exterior_building: "Exterior",
  aerial: "Aerial", beauty: "Beauty",
};

const SCENE_TYPES = [
  { id: "image-led", label: "Image", color: "#00d4ff", desc: "Still with narration", credits: 1 },
  { id: "video-led", label: "Video", color: "#a855f7", desc: "Full motion", credits: 4 },
  { id: "image-to-video", label: "Img->Vid", color: "#f59e0b", desc: "Subtle motion", credits: 2 },
  { id: "audio-bridge", label: "Audio", color: "#22c55e", desc: "Sound only", credits: 0 },
  { id: "hybrid", label: "Hybrid", color: "#ec4899", desc: "Still->Motion", credits: 2 },
];

const IMAGE_TREATMENTS = ["Static", "Slow Zoom In", "Slow Zoom Out", "Pan Left", "Pan Right", "Parallax", "Light Overlay"];

// ── Colors — v14 ds tokens ──
const surface = ds.color.card;
const s2 = ds.color.paper;
const border = ds.color.line;
const muted = ds.color.mute;
const accent = ds.color.mint;
const purple = ds.color.lilac;
const gold = ds.color.gold;
const red = "#ef4444";
const blue = ds.color.sky;

const cardStyle: React.CSSProperties = { background: surface, border: `1px solid ${border}`, borderRadius: 16, padding: 20, marginBottom: 12 };
const labelStyle: React.CSSProperties = { fontSize: 10, fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8, display: "block" };
const inputStyle: React.CSSProperties = { width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit" };
const btnPrimary: React.CSSProperties = { padding: "12px 24px", borderRadius: 12, border: "none", background: accent, color: "#000", fontSize: 14, fontWeight: 700, cursor: "pointer" };
const badgeStyle = (color: string): React.CSSProperties => ({ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${color}15`, color, fontWeight: 600, display: "inline-block" });

type WorkshopTab = "overview" | "scenes" | "characters" | "story" | "script" | "audio" | "assembly" | "trends" | "screenplay";

// Tabs: straight pipeline — Design → Story → Characters → Scenes → Sound → Screenplay → Assembly → Overview
const WORKSHOP_TABS: { id: WorkshopTab; label: string; step?: number }[] = [
  { id: "script",     label: "Design",          step: 1 },  // style/format/genre selection
  { id: "story",      label: "Story",           step: 2 },
  { id: "characters", label: "Characters",      step: 3 },
  { id: "scenes",     label: "Scene Board",     step: 4 },
  { id: "audio",      label: "Sound & SFX",     step: 5 },
  { id: "screenplay", label: "Screenplay",      step: 6 },
  { id: "assembly",   label: "Assembly",        step: 7 },
  { id: "overview",   label: "Overview" },
  { id: "trends",     label: "Trends" },
];

function defaultAudioPlan(): AudioPlan {
  return { narrationIntensity: "medium", musicMood: "", musicIntensity: "medium", sfxList: [], ambienceList: [], transitionAudio: "" };
}

// SCENE_ENV_ICON removed — env type shown as text label (v14: no emoji)

function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/api/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

export default function HybridPlannerPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: "#5a7080" }}>Loading workshop...</div>}><HybridPlannerInner /></Suspense>;
}

function HybridPlannerInner() {
  const params = useSearchParams();
  const { requireGate, GateModal } = useGate();
  const { canAdvanceTo } = useCoordinator();

  // ── Workshop tab ──
  const [activeTab, setActiveTab] = useState<WorkshopTab>("overview");

  // ── Project ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Hybrid Project");
  // Henry 2026-06-09: tracks whether the user has manually typed in the title
  // input. Once true, the AI movie-title auto-apply stops overwriting (user's
  // choice wins). Reset to false if user clicks the refresh icon — they want AI
  // back. Loaded as false on mount; flips on the input's onChange.
  const [userEditedTitle, setUserEditedTitle] = useState(false);
  const [refreshingTitle, setRefreshingTitle] = useState(false);
  const [projectPhase, setProjectPhase] = useState("STORY_INPUT");
  const [lastAction, setLastAction] = useState("Project created");
  const [saving, setSaving] = useState(false);
  // ── Visual Style Lock — controls rendering style for ALL scene image generation ──
  const [projectStyle, setProjectStyle] = useState<string>("3d-cinematic");
  // ── Per-scene style overrides — keyed by sceneId, falls back to projectStyle ──
  const [sceneStyles, setSceneStyles] = useState<Record<string, string>>({});

  // ── Story ──
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [storyEra, setStoryEra] = useState("");
  const [storyCulture, setStoryCulture] = useState("");
  const [targetDuration, setTargetDuration] = useState("2-3 min");
  const [customDurationMin, setCustomDurationMin] = useState(5);
  const [customDurationSec, setCustomDurationSec] = useState(0);
  const [audienceType, setAudienceType] = useState("general");
  const [costPreference, setCostPreference] = useState("balanced");
  const [language, setLanguage] = useState("English");
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-sonnet-4-6"); // "auto" | "claude:model" | "openai:model" | "grok:model" | "ollama"
  const [lastUsedAiProvider, setLastUsedAiProvider] = useState<string>("");
  const [storyRegion, setStoryRegion] = useState<string>(""); // continent/region for name injection
  // Map the culture/region DROPDOWN (storyRegion) → a culture word era-culture-lock understands,
  // so picking e.g. "American" actually locks that look. Previously the dropdown was NEVER passed
  // to the image culture-lock (only free-text storyCulture was), so selections did nothing and the
  // art style leaked in as ethnicity → the inversion. 2026-05-27 Bug C fix.
  const REGION_TO_CULTURE: Record<string, string> = {
    africa: "african", american: "american", north_america: "american",
    asia: "asian", europe: "european", french_culture: "french",
    spanish_culture: "spanish", latin_america: "latin", middle_east: "arabic",
    bollywood: "bollywood", hollywood: "hollywood",
    oceania: "", mythology: "", indigenous: "", fantasy: "",
  };
  const [expanding, setExpanding] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState("");
  const [fullScript, setFullScript] = useState(""); // complete narration script at target duration

  // ── Characters ──
  const [characters, setCharacters] = useState<CharacterIdentity[]>([]);
  // Per-character AI describe-fields helper state.
  // User types plain-English description → POST /api/hybrid/character-parse → 9 fields populate.
  // 2026-05-10 (Wave I redo) — uses correct CharacterIdentity field names this time.
  const [charAiDraft, setCharAiDraft] = useState<Record<string, string>>({});
  const [charAiBusy, setCharAiBusy] = useState<Set<string>>(new Set());
  const [loadingCharacters, setLoadingCharacters] = useState(false);
  const [charactersMade, setCharactersMade] = useState(false);
  const [makingCharacters, setMakingCharacters] = useState(false);

  // ── Scenes ──
  const [scenes, setScenes] = useState<HybridScene[]>([]);
  const [loadingScenes, setLoadingScenes] = useState(false);
  const [selectedScene, setSelectedScene] = useState<number | null>(null);
  // ── Scene Intelligence (incubation stage) ──
  // Stores per-scene environment + ambient sound data detected automatically after story expansion
  interface SceneIntelligenceData {
    sceneId: string;
    environmentType: string;
    timeOfDay: string;
    weather: string;
    indoorOutdoor: "indoor" | "outdoor" | "mixed";
    ambienceSounds: string[];
    sfxEvents: string[];
    roomTone: string;
    energyLevel: "calm" | "tense" | "chaotic" | "dramatic" | "peaceful" | "mysterious";
    confidence: "high" | "medium" | "low";
    notes: string;
  }
  const [sceneIntelligence, setSceneIntelligence] = useState<Record<string, SceneIntelligenceData>>({});
  const [runningIntelligence, setRunningIntelligence] = useState(false);

  // ── Inline Character Assignment (story tab) ──
  const [charAssignMode, setCharAssignMode] = useState<"manual" | "ai">("manual");
  const [manualCharInputs, setManualCharInputs] = useState<Array<{ id: string; name: string }>>([{ id: "m1", name: "" }]);
  const [aiDetectedNames, setAiDetectedNames] = useState<Array<{ name: string; description: string }>>([]);
  const [detectingChars, setDetectingChars] = useState(false);
  const [inlineCreatingId, setInlineCreatingId] = useState<string | null>(null); // name being created
  const [inlinePreview, setInlinePreview] = useState<CharacterIdentity | null>(null);
  const [showCharAssign, setShowCharAssign] = useState(false);
  // ── Photo import ──
  const [importingFromPhoto, setImportingFromPhoto] = useState(false);
  const [photoImportLog, setPhotoImportLog] = useState("");
  const [photoImportName, setPhotoImportName] = useState("");
  const [photoDragOver, setPhotoDragOver] = useState(false);
  const [sceneImages, setSceneImages] = useState<Record<string, string>>({});
  const [sceneImageModels, setSceneImageModels] = useState<Record<string, string>>({});
  const [generatingSceneImage, setGeneratingSceneImage] = useState<string | null>(null);
  const [polishingScene, setPolishingScene] = useState<string | null>(null);
  const [sceneViewMode, setSceneViewMode] = useState<"grid" | "list">("grid");
  const [expandedSceneId, setExpandedSceneId] = useState<string | null>(null);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: "image" | "video"; title: string } | null>(null);

  // ── Audio ──
  const [loadingAudioPlan, setLoadingAudioPlan] = useState(false);
  const [loadingShotPlan, setLoadingShotPlan] = useState(false);
  const [loadingAutoTimestamp, setLoadingAutoTimestamp] = useState(false);
  const [autoTimestampPlan, setAutoTimestampPlan] = useState<null | { totalDuration: number; segmentCount: number; segments: Array<{ id: string; title: string; startTime: number; endTime: number; duration: number; narrationText: string; subtitleText: string }> }>(null);
  const [narrationSettings, setNarrationSettings] = useState<Record<number, NarrationSettings>>({});
  const [narrationScene, setNarrationScene] = useState<number | null>(null);

  // ── Validation / Assembly ──
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [assembling, setAssembling] = useState(false);
  const [assemblyProgress, setAssemblyProgress] = useState<Record<number, string>>({});
  const [assemblyComplete, setAssemblyComplete] = useState(false);
  const [assembledVideoUrl, setAssembledVideoUrl] = useState<string | null>(null);

  // ── Batch generation ──
  const [batchImageProgress, setBatchImageProgress] = useState<string | null>(null);
  const [batchPortraitProgress, setBatchPortraitProgress] = useState<string | null>(null);

  // ── Error state ──
  const [uiError, setUiError] = useState<string | null>(null);

  // ── Character Picker ──
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  // Rename-on-import: holds registry character + name override before adding to cast
  const [pendingImportChar, setPendingImportChar] = useState<{
    id: string; characterId?: string | null; name: string; imageUrl?: string;
    voiceId?: string; role?: string; gender?: string; age?: string;
    hairstyle?: string; wardrobe?: string; defaultSpeechStyle?: string;
    accent?: string; language?: string;
  } | null>(null);
  const [importNameOverride, setImportNameOverride] = useState("");

  // ── Character Visual Builder — which card is expanded for editing ──
  const [editingCharId, setEditingCharId] = useState<string | null>(null);
  // ── Per-character portrait generation state ──
  const [generatingPortrait, setGeneratingPortrait] = useState<string | null>(null);
  // ── Per-character style override (Realistic / 3D / Cartoon etc.) ──────────
  const [charStyles, setCharStyles] = useState<Record<string, string>>({});
  // 3-angle full-body shots per character — keyed by characterId
  const [charRefImages, setCharRefImages] = useState<Record<string, Array<{url: string; angle: string; label: string}>>>({});
  // ── Per-character img2ai (photo → AI) state ──────────────────────────────
  const [img2aiRunning, setImg2aiRunning] = useState<Set<string>>(new Set());
  // ── Previous character portrait — one undo level per character ───────────
  const [prevCharImages, setPrevCharImages] = useState<Record<string, string>>({});
  // ── Per-character portrait model selector ────────────────────────────────
  const [charPortraitModel, setCharPortraitModel] = useState<Record<string, string>>({});
  // ── Per-character AI vision analysis state ──
  const [analyzingCharacter, setAnalyzingCharacter] = useState<string | null>(null);
  // ── Per-character manual save state ──
  const [savingCharacter, setSavingCharacter] = useState<string | null>(null);
  const [savedCharacter, setSavedCharacter] = useState<string | null>(null);
  // ── Image picker — "borrow" an image from the asset library for a character ──
  const [imagePickerForCharId, setImagePickerForCharId] = useState<string | null>(null);
  const [imagePickerAssets, setImagePickerAssets] = useState<Array<{ id: string; name: string; fileUrl?: string; filePath?: string; thumbnailPath?: string; source?: string }>>([]);
  const [imagePickerLoading, setImagePickerLoading] = useState(false);

  // ── Previous scene image versions — up to 3 per scene, so Regen is safe to try ──
  // When Regen is clicked the current image moves here before being replaced.
  const [prevSceneImages, setPrevSceneImages] = useState<Record<string, string[]>>({});
  // ── Multi-image variations (3×) — sceneId → generating flag ──
  const [generatingVariations, setGeneratingVariations] = useState<Set<string>>(new Set());

  // ── New Scene Creator state ──
  const [newSceneText, setNewSceneText] = useState("");
  const [newSceneLocation, setNewSceneLocation] = useState("");
  const [newSceneMood, setNewSceneMood] = useState("");
  const [newSceneTimeOfDay, setNewSceneTimeOfDay] = useState("");
  const [newSceneCharIds, setNewSceneCharIds] = useState<string[]>([]);
  const [creatingScene, setCreatingScene] = useState(false);

  // ── Scene Videos (sceneId → local video URL) ──
  const [sceneVideos, setSceneVideos] = useState<Record<string, string>>({});
  // All video versions per scene — Make Video ADDS here, never overwrites the active video
  const [sceneVideoVersions, setSceneVideoVersions] = useState<Record<string, string[]>>({});
  const [generatingSceneVideos, setGeneratingSceneVideos] = useState<Set<string>>(new Set());
  // ── AI Model selector for video generation ──
  const [selectedVideoModelId, setSelectedVideoModelId] = useState<string>("segmind_pruna_video");
  const [showAidPicker, setShowAidPicker] = useState(false);
  const [aidMode, setAidMode] = useState<"video" | "image">("video");
  const [aidStyle, setAidStyle] = useState<"all" | "2d" | "3d" | "cartoon" | "realistic">("all");
  const [aidSort, setAidSort] = useState<"cheapest" | "quality" | "expensive">("cheapest");
  const [selectedImageModelId, setSelectedImageModelId] = useState<string>("fal_flux_schnell");
  const [transparentBg, setTransparentBg] = useState(false); // Ideogram V3 transparent PNG mode
  const [genSeed, setGenSeed] = useState<number | null>(null);
  const [aiTier, setAiTier] = useState<AITier>("standard"); // GHS AI tier for story expansion
  // ── Generation progress bars (sceneId → live progress) ──
  const [sceneGenProgress, setSceneGenProgress] = useState<Record<string, { percent: number; message: string; type: "image" | "video" }>>({});
  // ── Scene card review tabs (sceneId → active tab) — null = no tab open ──
  const [activeSceneCardTab, setActiveSceneCardTab] = useState<Record<string, "image" | "audio" | "video" | "chat" | null>>({});
  // ── Per-scene AI chat state ──
  const [sceneChatMessages, setSceneChatMessages] = useState<Record<string, Array<{ role: "user" | "assistant"; content: string }>>>({});
  const [sceneChatInput, setSceneChatInput] = useState<Record<string, string>>({});
  const [sceneChatLoading, setSceneChatLoading] = useState<Set<string>>(new Set());
  // ── AI Chat open state — bottom of scene card, always accessible ──
  const [aiChatOpenScenes, setAiChatOpenScenes] = useState<Set<string>>(new Set());
  // AI Chat LLM provider — "auto" runs the fallback chain (ollama → openai → claude).
  // User can manually pick a single provider to force it.
  const [aiChatProvider, setAiChatProvider] = useState<"auto" | "ollama" | "openai" | "claude">("auto");
  // ── Gen Max — per-scene action-beat images ──
  const [sceneBeatImages, setSceneBeatImages] = useState<Record<string, string[]>>({});
  const [generatingMaxBeats, setGeneratingMaxBeats] = useState<Set<string>>(new Set());
  const [maxBeatsProgress, setMaxBeatsProgress] = useState<Record<string, string>>({});
  // sceneMaxTarget — per-scene custom image count for Gen Max (default 4, range 1-30).
  const [sceneMaxTarget, setSceneMaxTarget] = useState<Record<string, number>>({});
  // selectedBeatImages — per-scene boolean array, one entry per beat image.
  // Default: every beat included (true). User unticks a beat to skip it during assembly.
  // Shape: { "SC01": [true, false, true], "SC02": [true, true] }
  const [selectedBeatImages, setSelectedBeatImages] = useState<Record<string, boolean[]>>({});
  // useMaxImageScenes — set of sceneIds where the user opted-in to "Use Max Image" in Assembly.
  // OFF (default): scene contributes ONE image to the assembled video (scene.imageUrl).
  // ON: scene expands into N segments — one per ticked beat in selectedBeatImages.
  // Per-scene toggle so the user can mix: some scenes 1 image, some scenes multi-beat.
  const [useMaxImageScenes, setUseMaxImageScenes] = useState<Set<string>>(new Set());

  // ── Phase 3-A: Saved locally — per-scene list of /storage/ image URLs ──
  const [sceneLocalImages, setSceneLocalImages] = useState<Record<string, string[]>>({});

  // ── Phase 3-B: Stale image badge — per-scene hash of description at last image gen ──
  const [sceneDescHashes, setSceneDescHashes] = useState<Record<string, string>>({});

  // ── Phase 4-B: Dialogue review modal ──
  const [showDialogueReview, setShowDialogueReview] = useState(false);

  // ── Phase 5-B: Model health — client-side set of recently-broken model IDs ──
  const [brokenModels, setBrokenModels] = useState<Set<string>>(new Set());

  // ── Story tab — Scene Breakdown editing state ──
  // Only ONE scene is in edit mode at a time, identified by sceneId.
  // storyEditedDescription holds the textarea value while editing — committed to scene state on Save.
  const [storyEditingSceneId, setStoryEditingSceneId] = useState<string | null>(null);
  const [storyEditedDescription, setStoryEditedDescription] = useState<string>("");
  // Loading flags so the same scene can't fire two AI calls at once.
  // storyPolishingMode tells which button is busy (default/add_action/intense/reduce_action/emotional).
  const [storyPolishingSceneId, setStoryPolishingSceneId] = useState<string | null>(null);
  const [storyPolishingMode, setStoryPolishingMode] = useState<"default" | "add_action" | "intense" | "reduce_action" | "emotional" | null>(null);
  const [storyEditAiQuery, setStoryEditAiQuery] = useState<Record<string, string>>({});
  const [fixingQC, setFixingQC] = useState(false);
  const [contextCheckResults, setContextCheckResults] = useState<Record<string, { status: "ok" | "warn" | "checking"; note: string }>>({});
  const [fixingContext, setFixingContext] = useState(false);
  const [qcFixDoneMsg, setQcFixDoneMsg] = useState<string | null>(null);
  const [establishingShots, setEstablishingShots] = useState<Record<string, EstablishingShot>>({});
  const [establishingSceneId, setEstablishingSceneId] = useState<string | null>(null);
  const [establishingAll, setEstablishingAll] = useState(false);
  // Henry 2026-05-30 task #17: 5-level mode picker per ESTABLISHING_SHOT_SPEC §4.
  // Off=skip · Minimal=opening + loc/time change only · Auto=full ruleset · Cinematic=aggressive · Epic=every major scene.
  type EstablishingMode = "off" | "minimal" | "auto" | "cinematic" | "epic";
  const [establishingMode, setEstablishingMode] = useState<EstablishingMode>("auto");
  const [storyBreakingSceneId, setStoryBreakingSceneId] = useState<string | null>(null);
  const [storyExpandingScenes, setStoryExpandingScenes] = useState(false);
  const [structuring, setStructuring] = useState(false);
  const [structuredTagBreakdown, setStructuredTagBreakdown] = useState<Record<string, number> | null>(null);
  // LLM provider for all Story-tab AI ops (polish/break/expand). Same model menu as AI Chat.
  const [storyEditProvider, setStoryEditProvider] = useState<"auto" | "ollama" | "openai" | "claude">("auto");

  // ── Story tab — compact dropdowns for Culture / Name Style / Country ──
  // Open flags are stored separately so opening one auto-closes the others.
  // storyCountryQuery powers the free-text "type any country" field inside the country popover.
  const [storyNameStyle, setStoryNameStyle] = useState<string>("");
  const [storyCountry, setStoryCountry] = useState<string>("");
  const [storyCultureOpen, setStoryCultureOpen] = useState(false);
  const [storyNameStyleOpen, setStoryNameStyleOpen] = useState(false);
  const [storyCountryOpen, setStoryCountryOpen] = useState(false);
  const [storyCountryQuery, setStoryCountryQuery] = useState("");

  // ── Story Quality Control Layer ───────────────────────────────────────────
  const [storyType, setStoryType] = useState<string>("short_story");
  const [sceneDurationSec, setSceneDurationSec] = useState<number>(5);
  const [storyEmotionalIntensity, setStoryEmotionalIntensity] = useState<string>("normal");
  const [storyLanguageLevel, setStoryLanguageLevel] = useState<string>("normal_english");
  const [storySubtitleStyle, setStorySubtitleStyle] = useState<string>("normal_movie");
  const [storyGenerationMode, setStoryGenerationMode] = useState<string>("hybrid");
  const [storyQCRunning, setStoryQCRunning] = useState(false);
  const [storyQCResult, setStoryQCResult] = useState<null | {
    gatekeeper: {
      passed: boolean;
      score: number;
      blockingIssues: string[];
      warnings: string[];
      suggestedFixes: string[];
      revisedData?: { scores: Record<string, number>; readyForGeneration: boolean };
    };
    castBible: Array<{ character_id: string; name: string; ethnicity: string; role: string; clothing: string }>;
    scenes: Array<{ scene_id: string; scene_number: number; title: string; duration: number; emotion: string; voiceover_text: string; image_prompt: string; music_cue: string; provider_recommendation: string }>;
    supervisorResults: Record<string, { passed: boolean; score: number; blockingIssues: string[]; warnings: string[] }>;
  }>(null);
  const [storyQCSceneIndex, setStoryQCSceneIndex] = useState<number>(0);

  // ── New Scene Duration (user sets seconds) ──
  const [newSceneDuration, setNewSceneDuration] = useState(5);

  // ── Continuous Motion — per-scene (global toggle kept for legacy) ──────────
  const [continuousMotionEnabled, setContinuousMotionEnabled] = useState(false);
  const [cmTotalDuration, setCmTotalDuration] = useState(15);
  const [cmSegmentDuration, setCmSegmentDuration] = useState(5);
  // Per-scene overrides: { [sceneId]: { enabled, targetSec } }
  const [sceneContinuousMotion, setSceneContinuousMotion] = useState<Record<string, { enabled: boolean; targetSec: number }>>({});
  // Per-scene SFX generation state
  const [generatingSceneSfx, setGeneratingSceneSfx] = useState<Set<string>>(new Set());
  // Per-scene SFX progress label: "Generating SFX 2/3..."
  const [sceneSfxProgress, setSceneSfxProgress] = useState<Record<string, string>>({});
  // Per-scene SFX audio URLs (array — one per generated SFX file)
  const [sceneSfxAudioUrls, setSceneSfxAudioUrls] = useState<Record<string, string[]>>({});
  // Per-scene music loading state
  const [generatingSceneMusic, setGeneratingSceneMusic] = useState<Set<string>>(new Set());
  const [cmProvider, setCmProvider] = useState<"wan" | "kling_std">("wan");
  const [cmRunning, setCmRunning] = useState(false);
  const [cmStatus, setCmStatus] = useState<string | null>(null);
  const [cmSceneId, setCmSceneId] = useState<string | null>(null);
  const [cmFinalVideoUrl, setCmFinalVideoUrl] = useState<string | null>(null);
  const [cmError, setCmError] = useState<string | null>(null);

  // ── Assembly scene selection + reorder ──
  const [selectedSceneIds, setSelectedSceneIds] = useState<string[]>([]);
  const [assemblyOrder, setAssemblyOrder] = useState<string[]>([]);
  const [assemblyInitialized, setAssemblyInitialized] = useState(false);
  // ── Per-scene image/video mode override ──
  // "video" = use generated video, "image" = use still image, undefined = auto (video if available)
  const [sceneModeOverrides, setSceneModeOverrides] = useState<Record<string, "image" | "video">>({});
  // ── Assembly naming + saved cuts ──
  const [assemblyName, setAssemblyName] = useState("Cut A");
  const [openPipelineStep, setOpenPipelineStep] = useState<number>(1);
  const [savedCuts, setSavedCuts] = useState<Array<{ name: string; sceneIds: string[]; order: string[]; videoUrl?: string; assembledAt?: number }>>([]);
  // ── Intro / Outro cards ──
  const [introEnabled, setIntroEnabled] = useState(true);
  const [outroEnabled, setOutroEnabled] = useState(true);
  const [introOutroStyle, setIntroOutroStyle] = useState<"cinematic" | "minimal" | "bold" | "nollywood">("cinematic");
  const [generatingCards, setGeneratingCards] = useState(false);
  const [showCutsPanel, setShowCutsPanel] = useState(false);
  // ── Pre-generated intro/outro URLs (from pre-assembly panel) ──
  const [introUrl, setIntroUrl] = useState<string | null>(null);
  const [outroUrl, setOutroUrl] = useState<string | null>(null);
  const [generatingIntro, setGeneratingIntro] = useState(false);
  const [generatingOutro, setGeneratingOutro] = useState(false);
  // ── Story credits (writtenBy = screenplayAuthor, studio = GioHomeStudio hardcoded) ──
  const [ideaFrom, setIdeaFrom] = useState("");
  // ── Name library — custom names added by user ──
  const [customNameInput, setCustomNameInput] = useState("");
  // ── Subtitle config (full SubtitleStyler state) ──
  const [subtitleConfig, setSubtitleConfig] = useState<SubtitleConfig>({ ...DEFAULT_SUBTITLE_CONFIG, mode: "dramatic" });
  const [subtitleMatchResult, setSubtitleMatchResult] = useState<{ status: "ok" | "warn" | "checking"; note: string } | null>(null);
  // ── Assign position — sceneId being assigned a manual position ──
  const [assigningId, setAssigningId] = useState<string | null>(null);
  // ── AI narration preparation ──
  const [preparingNarration, setPreparingNarration] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  // ── Archived scenes — full scene objects kept so user can restore anytime ──
  const [archivedScenes, setArchivedScenes] = useState<Array<{ scene: HybridScene; imageUrl?: string; videoUrl?: string }>>([]);
  const [showArchivedPanel, setShowArchivedPanel] = useState(false);
  // ── Multi-project management ──
  const [activeProjLocalId, setActiveProjLocalId] = useState<string>("");
  const [projectList, setProjectList] = useState<Array<{
    id: string; title: string; style: string; lastModified: number;
    sceneCount: number; characterCount: number; thumbnail?: string;
  }>>([]);
  const [showProjectSwitcher, setShowProjectSwitcher] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  // ── Vision AI provider preference for character image analysis ──
  // "auto" = try Ollama first → Claude → GPT  |  "ollama" = local only  |  "claude" / "gpt" = cloud only
  const [visionProvider, setVisionProvider] = useState<"auto" | "ollama" | "claude" | "gpt">("auto");
  // ── Hover image preview (fixed position, never clipped) ──
  const [hoverPreview, setHoverPreview] = useState<{ src: string; x: number; y: number } | null>(null);

  // ── Music from asset library ──
  const [musicLibrary, setMusicLibrary] = useState<MusicAsset[]>([]);
  const [loadingMusic, setLoadingMusic] = useState(false);
  const [selectedMusicUrl, setSelectedMusicUrl] = useState<string | null>(null);
  const [selectedMusicName, setSelectedMusicName] = useState<string>("");
  const [showMusicPicker, setShowMusicPicker] = useState(false);
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.7);
  const [narrationVolume, setNarrationVolume] = useState(1.0);
  const [aiPickingMusic, setAiPickingMusic] = useState(false);
  const [aiMusicPickLog, setAiMusicPickLog] = useState<string>("");

  // ── Screenplay ──
  const [screenplay, setScreenplay] = useState<string>("");
  const [generatingScreenplay, setGeneratingScreenplay] = useState(false);
  const [screenplayError, setScreenplayError] = useState<string>("");
  const [screenplayAuthor, setScreenplayAuthor] = useState<string>("");

  // ── Import Images from Library ──
  interface LibraryImageAsset { id: string; name: string; filePath: string; description: string; tags: string[]; source: string }
  const [importLibraryOpen, setImportLibraryOpen] = useState(false);
  const [libraryImages, setLibraryImages] = useState<LibraryImageAsset[]>([]);
  const [loadingLibraryImages, setLoadingLibraryImages] = useState(false);
  // When set to a sceneId, the library picker assigns the selected image to that scene instead of creating a new one
  const [importImageForSceneId, setImportImageForSceneId] = useState<string | null>(null);
  // ── Library inbox — images pushed from Asset Library "Send to Hybrid Planner" ──
  const [libraryInbox, setLibraryInbox] = useState<LibraryImageAsset[]>([]);

  // ── Script / Narration system ──────────────────────────────────────────────
  interface ScriptSegment {
    id: string;
    type: "narration" | "dialogue";
    speaker: string;      // "narrator" | character display name
    text: string;
    lineIndex: number;
    characterId?: string; // matched character ID for dialogue lines
    sceneId?: string;     // which scene this segment belongs to
    audioUrl?: string;    // per-line audio clip (new lip-sync system)
    durationMs?: number | null; // actual measured audio duration (from TTS route)
    estimatedStartMs?: number; // calculated placement time in the final video
  }
  type StoryMode = "narration-only" | "actors-only" | "mixed";
  const [storyMode, setStoryMode] = useState<StoryMode>("mixed");
  // Actor/character voices on-off — user can deactivate actor voices anytime (Sound + Assembly).
  // When false, character dialogue clips are excluded from the assembly (narrator only). 2026-05-28
  const [actorVoicesEnabled, setActorVoicesEnabled] = useState(true);
  const [narratorVoice, setNarratorVoice] = useState<"piper" | "edge-tts" | "fal-narrator" | "fal-narrator-gemini" | "elevenlabs" | "karaoke" | "kie-suno" | "none">("piper");
  // Henry 2026-06-11: Edge-TTS in Hybrid (port of free-mode PR #70). Free Microsoft
  // Neural voices incl. Nigerian; sub-picker mirrors free-mode's 10 regional voices.
  const [edgeTtsVoiceId, setEdgeTtsVoiceId] = useState("en-NG-EzinneNeural");
  // GHS Sound Tier — drives both narration provider and music provider selection
  const [soundTier, setSoundTier] = useState<"ghs-sound" | "ghs-plus" | "ghs-pro" | "ghs-premium">("ghs-sound");
  const [narratorPiperModel, setNarratorPiperModel] = useState("en_US-lessac-medium");
  const [narratorPiperSpeed, setNarratorPiperSpeed] = useState(0.75);
  const [scriptSegments, setScriptSegments] = useState<ScriptSegment[]>([]);
  const [parsingScript, setParsingScript] = useState(false);
  const [showScriptReview, setShowScriptReview] = useState(false);
  const [generatingNarration, setGeneratingNarration] = useState(false);
  const [narratorAudioUrl, setNarratorAudioUrl] = useState<string | null>(null);
  const [narratorAudioDuration, setNarratorAudioDuration] = useState<number>(0);
  const [piperNotInstalled, setPiperNotInstalled] = useState(false);
  const [piperDownloading, setPiperDownloading] = useState(false);
  // ── Voice Layers — multi-part narrator voice stacking ────────────────────
  // Each layer has its own provider + voiceId. Layer 1 = primary narrator.
  // Layers 2+ are secondary (mixing deferred to S14 assembly endpoint wiring).
  interface VoiceLayer { layer: number; providerId: "piper" | "edge-tts" | "fal-narrator" | "fal-narrator-gemini" | "elevenlabs" | "karaoke" | "kie-suno"; voiceId: string; }
  const [voiceLayers, setVoiceLayers] = useState<VoiceLayer[]>([{ layer: 1, providerId: "piper", voiceId: "en_US-lessac-medium" }]);
  function addVoiceLayer() {
    setVoiceLayers(prev => [...prev, { layer: prev.length + 1, providerId: "piper", voiceId: "en_US-lessac-medium" }]);
  }
  function updateVoiceLayer(layer: number, updates: Partial<VoiceLayer>) {
    setVoiceLayers(prev => prev.map(l => l.layer === layer ? { ...l, ...updates } : l));
  }
  function removeVoiceLayer(layer: number) {
    if (layer === 1) return; // can't remove primary
    setVoiceLayers(prev => prev.filter(l => l.layer !== layer).map((l, i) => ({ ...l, layer: i + 1 })));
  }

  // ── Per-character Piper voice assignment ─────────────────────────────────
  // Maps characterId → piper model name (e.g. "en_US-ryan-high")
  const [characterPiperVoices, setCharacterPiperVoices] = useState<Record<string, string>>({});
  // Maps characterId → generated audio URL for their dialogue
  const [characterAudioUrls, setCharacterAudioUrls] = useState<Record<string, string>>({});
  const [generatingCharVoices, setGeneratingCharVoices] = useState(false);
  const [charVoiceLog, setCharVoiceLog] = useState("");
  // ── Subtitle style ────────────────────────────────────────────────────────
  const [subtitleStyle, setSubtitleStyle] = useState<"classic" | "cinema" | "neon" | "minimal" | "bold" | "none">("classic");
  // ── Sound Browser (Audio tab) ─────────────────────────────────────────────
  const [soundTab, setSoundTab] = useState<"freesound" | "ai-sfx" | "upload">("freesound");
  const [fsQuery, setFsQuery] = useState("");
  const [fsResults, setFsResults] = useState<Array<{ id: number; name: string; duration: number; license: string; licenseType?: string; safeForCommercial?: boolean; username: string; previewUrl: string; tags: string[] }>>([]);
  const [fsSearching, setFsSearching] = useState(false);
  const [fsSaving, setFsSaving] = useState<number | null>(null);
  const [fsSaved, setFsSaved] = useState<Set<number>>(new Set());
  const [fsNoKey, setFsNoKey] = useState(false);
  const [sfxDesc, setSfxDesc] = useState("");
  const [sfxGenerating, setSfxGenerating] = useState(false);
  const [sfxGeneratedUrl, setSfxGeneratedUrl] = useState<string | null>(null);
  const [sfxPreviewId, setSfxPreviewId] = useState<number | string | null>(null);
  // ── Auto SFX ──────────────────────────────────────────────────────────────
  const [autoSfx, setAutoSfx] = useState(false);
  const [autoSfxRunning, setAutoSfxRunning] = useState(false);
  const [sceneSfxUrls, setSceneSfxUrls] = useState<Record<string, string>>({});
  const [autoSfxProgress, setAutoSfxProgress] = useState<{ current: number; total: number; sceneId: string } | null>(null);
  // ── Build-all-characters queue state ──────────────────────────────────────
  const [buildingAllChars, setBuildingAllChars] = useState(false);
  const [buildAllProgress, setBuildAllProgress] = useState<string | null>(null);
  // inline add-one state for Characters tab
  const [charTabName, setCharTabName] = useState("");
  const [charTabCreating, setCharTabCreating] = useState(false);

  // ── Pick Faces from SC1 — face-crop portal ──────────────────────────────────
  // WHY: PuLID/img2img keeps scene composition but face identity tokens still
  // drift when there are 2+ characters. Letting the user click each face in SC1
  // and save a 512×512 crop as the character's imageUrl gives subsequent scenes
  // an exact face anchor instead of relying on the diffusion model's memorization.
  interface PickFacesState {
    sceneId: string;        // which scene image is shown (always SC1 = scene.scene===1)
    sceneImageUrl: string;  // /api/media/... URL
    characters: Array<{ characterId: string; displayName: string }>;  // chars to anchor
    currentIdx: number;     // which character we're waiting for the user to click
    // clicks[i] = crop box for characters[i] (null = not yet clicked)
    clicks: Array<{ x: number; y: number } | null>;
    saving: boolean;
    savedCount: number;
    error: string | null;
  }
  const [pickFacesState, setPickFacesState] = useState<PickFacesState | null>(null);
  // Natural (original) dimensions of the SC1 image — needed to convert display
  // coordinates back to original pixel coordinates when sending the crop box.
  const pickFacesImgRef = useRef<HTMLImageElement | null>(null);

  // ── Pre-flight check ──────────────────────────────────────────────────────
  interface HybridPreflightCheck { id: string; label: string; status: "ok" | "warn" | "error"; detail?: string; autoFixAvailable: boolean; autoFixAction?: string; }
  const [preflightResult, setPreflightResult] = useState<{ checks: HybridPreflightCheck[]; canAssemble: boolean; blockingErrors: number; warnings: number } | null>(null);
  const [preflightRunning, setPreflightRunning] = useState(false);

  // ── Persistent project storage key — from URL ?projectId= (no localStorage) ──
  // Each project gets its own UUID in the URL. Refreshing the same URL restores
  // the same project. "New Project" navigates without ?projectId= → fresh UUID.
  const urlProjectId = params.get("projectId");

  // ── ProjectSettings hook — keyed to resolved projectId (fallback to "hybrid-default") ──
  const { settings: projectSettings, patch: patchProjectSettings } =
    useProjectSettings(projectId || urlProjectId || "hybrid-default");

  // ── effective* shims — hook value wins; local state is fallback during migration ──
  const effectiveProjectStyle      = projectSettings.visualStyle ?? projectStyle;
  const effectiveSoundTier         = projectSettings.soundTier ?? soundTier;
  const effectiveSubtitleConfig: SubtitleConfig = projectSettings
    ? { ...subtitleConfig, mode: (projectSettings.subtitleMode ?? subtitleConfig.mode) as SubtitleConfig["mode"], highlightColor: projectSettings.subtitleHighlight ?? subtitleConfig.highlightColor }
    : subtitleConfig;
  const effectiveVideoModelId      = projectSettings.videoModelVersion && projectSettings.videoModelVersion !== "auto" ? projectSettings.videoModelVersion : selectedVideoModelId;
  const effectiveImageModelId      = projectSettings.imageModelVersion && projectSettings.imageModelVersion !== "auto" ? projectSettings.imageModelVersion : selectedImageModelId;
  const effectiveLanguage          = projectSettings.language ?? language;
  const effectiveLlmProvider       = projectSettings.llmProvider ?? aiChatProvider;
  // Image Flip Time — seconds each image shows before cutting to next (Phase 2 2026-05-14)
  const effectiveFlipSeconds       = projectSettings.imageFlipSeconds ?? 3;

  // BUG-15: guard flag — while restoring from DB we must NOT trigger the save effect
  const isRestoringRef = useRef(true);
  // ── SE: per-scene description debounce timers ──
  const sceneDescTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // ── Restore full project state — DB only ──
  useEffect(() => {
    let cancelled = false;
    async function restoreState() {
      isRestoringRef.current = true;
      try {
      // If no projectId in URL, use the default slot (preserves existing saved data).
      // "New Project" generates a fresh ID and pushes it to the URL.
      const activeId = urlProjectId || "ghs_hybrid_default";
      // Use history API directly — no React router re-render, no risk of resetting isRestoringRef
      if (typeof window !== "undefined") {
        const newUrl = `/dashboard/hybrid-planner?projectId=${encodeURIComponent(activeId)}`;
        if (window.location.search !== `?projectId=${encodeURIComponent(activeId)}`) {
          window.history.replaceState(null, "", newUrl);
        }
      }
      setActiveProjLocalId(activeId);

      // Load from DB
      let data: Record<string, unknown> | null = null;
      try {
        const dbRes = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(activeId)}`);
        if (dbRes.ok) {
          const dbData = await dbRes.json();
          if (dbData.found && dbData.data) {
            data = dbData.data as Record<string, unknown>;
            console.log("[restore] Loaded from DB:", activeId);
          }
        }
      } catch { /* DB unavailable — start fresh */ }

      // Guard: if component unmounted while we were fetching, abort state writes
      if (cancelled) return;

      if (data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const d = data as any;
        {
          if (d.projectId) setProjectId(d.projectId);
          if (d.projectTitle) setProjectTitle(d.projectTitle);
          if (d.projectPhase) setProjectPhase(d.projectPhase);
          if (d.idea) setIdea(d.idea);
          if (d.genre) setGenre(d.genre);
          if (d.tone) setTone(d.tone);
          if (d.storyEra) setStoryEra(d.storyEra);
          if (d.storyCulture) setStoryCulture(d.storyCulture);
          if (d.expandedSummary) setExpandedSummary(d.expandedSummary);
          if (d.fullScript) setFullScript(d.fullScript);
          if (d.characters?.length > 0) {
            const seen = new Set<string>();
            const deduped = (d.characters as CharacterIdentity[]).filter((c: CharacterIdentity) => {
              if (seen.has(c.characterId)) return false;
              seen.add(c.characterId);
              return true;
            });
            setCharacters(deduped);
            setCharactersMade(true);
          }
          if (d.scenes?.length > 0) setScenes(d.scenes.map((s: HybridScene) => ({
            ...s,
            characterIds: s.characterIds ?? [],
            credits: s.credits ?? 2,
            sceneType: s.sceneType ?? "image-led",
            audioPlan: s.audioPlan ?? { musicMood: "", musicIntensity: "", narrationStyle: "", narrationIntensity: "", sfxList: [], ambienceList: [] },
          })));
          const mountValidIds = new Set((d.scenes || []).map((s: { sceneId: string }) => s.sceneId));
          if (d.sceneImages && Object.keys(d.sceneImages).length > 0) {
            // Fix legacy /storage/ paths + drop images for scene IDs not in this project
            const fixedImages = Object.fromEntries(
              Object.entries(d.sceneImages as Record<string, string>)
                .filter(([id]) => mountValidIds.has(id))
                .map(([k, v]) => [k, typeof v === "string" && v.startsWith("/storage/") ? `/api/media/${v.slice("/storage/".length)}` : v])
            );
            if (Object.keys(fixedImages).length > 0) setSceneImages(fixedImages);
          }
          if (d.sceneVideos && Object.keys(d.sceneVideos).length > 0) {
            const mountFiltered = Object.fromEntries(
              Object.entries(d.sceneVideos as Record<string, string>).filter(([id]) => mountValidIds.has(id))
            );
            if (Object.keys(mountFiltered).length > 0) setSceneVideos(mountFiltered);
          }
          if (d.sceneVideoVersions && Object.keys(d.sceneVideoVersions).length > 0) {
            const mountFilteredVer = Object.fromEntries(
              Object.entries(d.sceneVideoVersions as Record<string, string[]>).filter(([id]) => mountValidIds.has(id))
            );
            if (Object.keys(mountFilteredVer).length > 0) setSceneVideoVersions(mountFilteredVer);
          }
          if (d.lastAction) setLastAction(d.lastAction);
          if (d.projectStyle) setProjectStyle(d.projectStyle);
          if (d.savedCuts?.length > 0) setSavedCuts(d.savedCuts);
          if (d.archivedScenes?.length > 0) setArchivedScenes(d.archivedScenes);
          setNarratorAudioUrl(d.narratorAudioUrl || null);
          setSelectedMusicUrl(d.selectedMusicUrl || null);
          setSelectedMusicName(d.selectedMusicName || "");
          setCharacterAudioUrls(d.characterAudioUrls || {});
          if (d.selectedVideoModelId) setSelectedVideoModelId(d.selectedVideoModelId);
          if (d.subtitleStyle) setSubtitleStyle(d.subtitleStyle);
          if (d.storyMode) setStoryMode(d.storyMode as "narration-only" | "actors-only" | "mixed");
          if (d.actorVoicesEnabled !== undefined) setActorVoicesEnabled(!!d.actorVoicesEnabled);
          if (d.soundTier && ["ghs-sound", "ghs-plus", "ghs-pro", "ghs-premium"].includes(d.soundTier)) {
            setSoundTier(d.soundTier as "ghs-sound" | "ghs-plus" | "ghs-pro" | "ghs-premium");
          }
          if (d.characterPiperVoices && Object.keys(d.characterPiperVoices).length > 0) setCharacterPiperVoices(d.characterPiperVoices);
          if (d.screenplay) setScreenplay(d.screenplay);
          if (d.screenplayAuthor) setScreenplayAuthor(d.screenplayAuthor);
          if (d.scriptSegments?.length > 0) setScriptSegments(d.scriptSegments);
          if (d.musicVolume !== undefined) setMusicVolume(d.musicVolume);
          // Restore Gen Max beats so they survive a page refresh.
          if (d.sceneBeatImages && Object.keys(d.sceneBeatImages).length > 0) setSceneBeatImages(d.sceneBeatImages);
          if (d.selectedBeatImages && Object.keys(d.selectedBeatImages).length > 0) setSelectedBeatImages(d.selectedBeatImages);
          // Restore which scenes are in "Use Max Image" mode for assembly.
          if (Array.isArray(d.useMaxImageScenes)) setUseMaxImageScenes(new Set(d.useMaxImageScenes));
          // 3-B: Restore stale-image hash map
          if (d.sceneDescHashes && Object.keys(d.sceneDescHashes).length > 0) setSceneDescHashes(d.sceneDescHashes);
          // Restore intro/outro card URLs so assembled video includes them after page refresh
          if (d.introUrl) setIntroUrl(d.introUrl);
          if (d.outroUrl) setOutroUrl(d.outroUrl);
          if (d.introEnabled !== undefined) setIntroEnabled(!!d.introEnabled);
          if (d.outroEnabled !== undefined) setOutroEnabled(!!d.outroEnabled);
          // FIX 5 (2026-05-22): restore subtitle + assembly settings
          if (d.subtitleConfig) setSubtitleConfig(d.subtitleConfig);
          if (typeof d.narratorAudioDuration === "number") setNarratorAudioDuration(d.narratorAudioDuration);
          if (d.sceneModeOverrides && Object.keys(d.sceneModeOverrides).length > 0) setSceneModeOverrides(d.sceneModeOverrides);
          if (d.sceneStyles && Object.keys(d.sceneStyles).length > 0) setSceneStyles(d.sceneStyles);
        }
      }
    } catch (err) { console.error("Project state restore failed:", err); }
    finally {
      // Restore complete — save effect may now write
      isRestoringRef.current = false;
    }
    } // end restoreState
    restoreState();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Gen Max localStorage BACKUP (2026-05-10) ──
  // The DB save is large (50+ KB JSON) and sometimes silently fails for unknown reasons.
  // Henry's Gen Max images keep disappearing on hard refresh. Mirror the 3 critical Gen Max
  // states to localStorage so they survive even if the DB save loses them.
  // Key shape: ghs_hybrid_genmax_<projectId>. Read on mount, written on every state change.
  useEffect(() => {
    if (!activeProjLocalId) return;
    if (isRestoringRef.current) return;
    try {
      const key = `ghs_hybrid_genmax_${activeProjLocalId}`;
      const payload = {
        sceneBeatImages,
        selectedBeatImages,
        useMaxImageScenes: Array.from(useMaxImageScenes),
        sceneMaxTarget,
        savedAt: Date.now(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch { /* localStorage quota or disabled — silent */ }
  }, [activeProjLocalId, sceneBeatImages, selectedBeatImages, useMaxImageScenes, sceneMaxTarget]);

  // Read Gen Max localStorage backup on mount once activeProjLocalId is known.
  // Runs AFTER the DB restore — if DB has data, we keep it; if DB lost it, we recover from local.
  useEffect(() => {
    if (!activeProjLocalId) return;
    try {
      const key = `ghs_hybrid_genmax_${activeProjLocalId}`;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const data = JSON.parse(raw) as {
        sceneBeatImages?: Record<string, string[]>;
        selectedBeatImages?: Record<string, boolean[]>;
        useMaxImageScenes?: string[];
        sceneMaxTarget?: Record<string, number>;
      };
      // Only fill state from local if state is currently empty (DB had nothing).
      if (Object.keys(sceneBeatImages).length === 0 && data.sceneBeatImages && Object.keys(data.sceneBeatImages).length > 0) {
        setSceneBeatImages(data.sceneBeatImages);
        console.log(`[gen-max-backup] restored ${Object.keys(data.sceneBeatImages).length} scenes from localStorage`);
      }
      if (Object.keys(selectedBeatImages).length === 0 && data.selectedBeatImages && Object.keys(data.selectedBeatImages).length > 0) {
        setSelectedBeatImages(data.selectedBeatImages);
      }
      if (useMaxImageScenes.size === 0 && Array.isArray(data.useMaxImageScenes) && data.useMaxImageScenes.length > 0) {
        setUseMaxImageScenes(new Set(data.useMaxImageScenes));
      }
      if (Object.keys(sceneMaxTarget).length === 0 && data.sceneMaxTarget) {
        setSceneMaxTarget(data.sceneMaxTarget);
      }
    } catch { /* corrupt data — ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjLocalId]);

  // ── Save full workshop state — DB only ──
  // BUG-15: skip save while restoring — prevents stale state from overwriting fresh DB data
  useEffect(() => {
    if (!activeProjLocalId) return;
    if (isRestoringRef.current) return;
    const data = {
      projectId, projectTitle, projectPhase, idea, genre, tone, storyEra, storyCulture,
      expandedSummary, fullScript, characters, scenes, sceneImages, sceneVideos, lastAction,
      projectStyle, savedCuts, archivedScenes,
      narratorAudioUrl, selectedMusicUrl, selectedMusicName,
      selectedVideoModelId,
      sceneVideoVersions, sceneIntelligence,
      subtitleStyle, storyMode, soundTier, actorVoicesEnabled,
      screenplay, screenplayAuthor, scriptSegments, characterAudioUrls, characterPiperVoices,
      sceneBeatImages, selectedBeatImages,  // Gen Max beats — persist across refresh
      sceneDescHashes,  // 3-B: persist stale-image hash map across sessions
      introUrl, outroUrl, introEnabled, outroEnabled,  // persist card URLs so refresh doesn't wipe them
      // FIX 5 (2026-05-22): persist subtitle + assembly settings so reload keeps user choices
      subtitleConfig, musicVolume, narratorAudioDuration,
      sceneModeOverrides, sceneStyles,
      // Set serializes as Array via spread — restore reads as Array, hydrates back into Set.
      useMaxImageScenes: Array.from(useMaxImageScenes),
      timestamp: Date.now(),
    };
    // DB save (fire-and-forget — don't block UI)
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: activeProjLocalId, data }),
    }).catch(() => { /* silent on DB error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjLocalId, projectId, projectTitle, projectPhase, idea, genre, tone, projectStyle, expandedSummary, fullScript, characters, scenes, sceneImages, sceneVideos, savedCuts, archivedScenes, narratorAudioUrl, selectedMusicUrl, selectedMusicName, subtitleStyle, storyMode, soundTier, screenplay, screenplayAuthor, scriptSegments, characterAudioUrls, characterPiperVoices, sceneBeatImages, selectedBeatImages, useMaxImageScenes, sceneDescHashes, subtitleConfig, musicVolume, narratorAudioDuration, sceneModeOverrides, sceneStyles]);

  // ── Load project list for "My Projects" panel ──
  useEffect(() => {
    fetch("/api/hybrid/saved-state?list=true")
      .then(r => r.json())
      .then(d => { if (d.projects) setProjectList(d.projects); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const characterId = params.get("characterId");
    if (characterId) {
      fetch("/api/character-voices").then(r => r.json()).then(d => {
        const char = (d.voices || []).find((v: { id: string }) => v.id === characterId);
        if (char) {
          setCharacters(prev => {
            if (prev.some(c => c.characterId === char.characterId || c.displayName === char.name)) return prev;
            return [...prev, {
              characterId: char.characterId || char.id, displayName: char.name, roleType: char.role || "supporting",
              gender: char.gender || "", ageRange: char.age || "", skinTone: "", hairStyle: char.hairstyle || "",
              wardrobeStyle: char.wardrobe || "", speechStyle: char.defaultSpeechStyle || "", accentType: char.accent || "",
              emotionProfile: "", voiceId: char.voiceId || "", language: char.language || "English", tags: [],
              imageUrl: char.imageUrl, hasVoice: !!char.voiceId, hasImage: !!char.imageUrl,
            }];
          });
          setCharactersMade(true);
          // Pre-fill the story idea with the character description so user can start writing immediately
          const desc = char.visualDescription || char.name;
          setIdea(prev => prev || `Story featuring ${char.name}: ${desc}`);
          setActiveTab("story"); // Go to story tab so user can write about the character
          setLastAction(`Character "${char.name}" imported from registry`);
        }
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-select all scenes when entering Assembly tab for the first time ──
  useEffect(() => {
    if (activeTab === "assembly" && scenes.length > 0 && !assemblyInitialized) {
      setSelectedSceneIds(scenes.map(s => s.sceneId));
      setAssemblyInitialized(true);
      setOpenPipelineStep(9); // jump straight to Assemble step so flip panel + status badges are visible
    }
    // When scenes change (new scene added), add it to selection if assembly tab was already initialized
    if (assemblyInitialized && scenes.length > 0) {
      setSelectedSceneIds(prev => {
        const prevSet = new Set(prev);
        const newIds = scenes.map(s => s.sceneId).filter(id => !prevSet.has(id));
        return newIds.length > 0 ? [...prev, ...newIds] : prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scenes.length]);

  // ── Phase 3-A: Auto-load local saved images when scenes tab becomes active ──
  useEffect(() => {
    if (activeTab === "scenes" && projectId && scenes.length > 0) {
      // Load for all scenes that have no local images loaded yet
      for (const scene of scenes) {
        if (!sceneLocalImages[scene.sceneId]) {
          loadSceneLocalImages(scene.sceneId, projectId);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, projectId, scenes.length]);

  // ── Body scroll-lock when any full-screen modal is open ──
  useEffect(() => {
    const anyModal = !!previewMedia || showAidPicker || importLibraryOpen || showCharacterPicker || !!pendingImportChar || showDialogueReview;
    document.body.style.overflow = anyModal ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [previewMedia, showAidPicker, importLibraryOpen, showCharacterPicker, pendingImportChar, showDialogueReview]);

  // ── Drag reorder ──
  const [dragSource, setDragSource] = useState<number | null>(null);

  // ── Derived stats ──
  const totalScenes = scenes.length;
  const draftScenes = scenes.filter(s => s.status === "draft" || !s.status).length;
  const approvedScenes = scenes.filter(s => s.status === "approved").length;
  const blockedScenes = scenes.filter(s => s.status === "blocked").length;
  const generatedImages = Object.keys(sceneImages).length;
  const hybridCredits = scenes.reduce((sum, s) => sum + (s.credits ?? 2), 0);
  const fullVideoCredits = scenes.length * 4;
  const savedCredits = fullVideoCredits - hybridCredits;
  const savingsPercent = fullVideoCredits > 0 ? Math.round((savedCredits / fullVideoCredits) * 100) : 0;

  // ── Progress calculations (real, not fake) ──
  const storyProgress = expandedSummary ? 100 : idea ? 30 : 0;
  const charsWithoutImages = characters.filter(c => !c.imageUrl && !c.hasImage).length;
  const characterProgress = characters.length === 0 ? 0 : !charactersMade ? 30 : charsWithoutImages > 0 ? 60 : 100;
  const sceneProgress = totalScenes === 0 ? 0 : Math.round((generatedImages / totalScenes) * 100);
  const audioProgress = scenes.length === 0 ? 0 : Math.round((scenes.filter(s => s.audioPlan?.musicMood).length / scenes.length) * 100);
  const assemblyReadiness = (storyProgress === 0 || characters.length === 0 || totalScenes === 0) ? 0 : Math.round((storyProgress + characterProgress + sceneProgress + audioProgress) / 4);

  // ── Next Step Guidance Banner ──
  const nextStepBanner: { message: string; color: string; targetTab: WorkshopTab; buttonLabel: string } | null = (() => {
    if (!idea) return { message: "Start by writing your story idea in the Story tab.", color: gold, targetTab: "story", buttonLabel: "Write Story" };
    if (!expandedSummary) return { message: "Your story idea is ready. Click 'Expand with AI' to extract characters and scenes.", color: gold, targetTab: "story", buttonLabel: "Go to Story" };
    if (scriptSegments.length === 0) return { message: "Story expanded! Go to Script tab to parse dialogue and narrator lines.", color: blue, targetTab: "script", buttonLabel: "Go to Script" };
    if (characters.length === 0) return { message: "Script parsed! Go to Characters tab to build character portraits.", color: purple, targetTab: "characters", buttonLabel: "Go to Characters" };
    if (!charactersMade) return { message: "Characters extracted! Click 'Make Characters' to create their identities and voices.", color: purple, targetTab: "characters", buttonLabel: "Go to Characters" };
    if (charsWithoutImages > 0) return { message: `${charsWithoutImages} character(s) need portraits. Click 'Generate All Portraits' in the Characters tab.`, color: blue, targetTab: "characters", buttonLabel: "Go to Characters" };
    if (totalScenes === 0) return { message: "Characters ready! Go to Scene Board to view and generate scene images.", color: blue, targetTab: "scenes", buttonLabel: "Go to Scenes" };
    if (generatedImages < totalScenes) return { message: `${totalScenes - generatedImages} scene(s) need images. Click 'Generate All Images' in the Scene Board.`, color: blue, targetTab: "scenes", buttonLabel: "Go to Scenes" };
    if (audioProgress < 100) return { message: "All scenes have images! Go to Sound tab to plan narration and music.", color: gold, targetTab: "audio", buttonLabel: "Go to Sound" };
    if (assemblyReadiness >= 70) return { message: "Audio planned! Go to Assembly to validate and build your movie.", color: accent, targetTab: "assembly", buttonLabel: "Go to Assembly" };
    return null;
  })();

  // ── Warnings ──
  const warnings: string[] = [];
  if (characters.length === 0 && scenes.length > 0) warnings.push("No characters created yet");
  characters.forEach(c => {
    if (!c.voiceId) warnings.push(`${c.displayName} (${c.characterId}) missing voice`);
    if (!c.imageUrl && !c.hasImage) warnings.push(`${c.displayName} missing portrait image`);
  });
  scenes.forEach(s => {
    if (!sceneImages[s.sceneId] && s.sceneType !== "audio-bridge") warnings.push(`Scene ${s.scene}: "${s.title}" has no image`);
    if ((s.characterIds?.length ?? 0) === 0) warnings.push(`Scene ${s.scene}: no characters assigned`);
    if (!s.audioPlan?.musicMood) warnings.push(`Scene ${s.scene}: no music plan`);
    // Character continuity: check if scene references characters not in registry
    (s.characterIds ?? []).forEach(cid => {
      if (!characters.find(c => c.characterId === cid)) warnings.push(`Scene ${s.scene}: references unknown character ${cid}`);
    });
  });
  // Enforce scene still before video order
  scenes.forEach(s => {
    if ((s.sceneType === "video-led" || s.sceneType === "image-to-video") && !sceneImages[s.sceneId]) {
      warnings.push(`Scene ${s.scene}: needs scene image before video generation`);
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // API Functions
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Parse targetDuration string → seconds ──────────────────────────────────
  function parseDurationToSeconds(dur: string): { seconds: number; label: string } {
    if (dur.startsWith("custom:")) {
      // format: custom:15m30s
      const m = parseInt(dur.match(/(\d+)m/)?.[1] || "0", 10);
      const s = parseInt(dur.match(/(\d+)s/)?.[1] || "0", 10);
      const total = m * 60 + s;
      return { seconds: total, label: `${m > 0 ? m + " min " : ""}${s > 0 ? s + " sec" : ""}`.trim() };
    }
    const map: Record<string, number> = {
      "30-60s":   45,
      "1-2 min":  90,
      "2-3 min":  150,
      "3-5 min":  240,
      "5-10 min": 450,
      "10+ min":  750,
    };
    const labelMap: Record<string, string> = {
      "30-60s":   "~1 min",
      "1-2 min":  "1-2 min",
      "2-3 min":  "2-3 min",
      "3-5 min":  "3-5 min",
      "5-10 min": "5-10 min",
      "10+ min":  "10+ min",
    };
    return { seconds: map[dur] || 150, label: labelMap[dur] || dur };
  }

  // Structure story for images — runs BEFORE expand to tag each moment visually
  async function structureStoryForImages() {
    if (!idea.trim() || structuring) return;
    setStructuring(true);
    setLastAction("Structuring story for visual storytelling…");
    try {
      const { seconds: durSeconds } = parseDurationToSeconds(targetDuration);
      const res = await fetch("/api/hybrid/structure-story", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyIdea: idea.trim(),
          storyType,
          genre,
          tone,
          country: storyCountry,
          targetDuration: durSeconds,
        }),
      });
      const d = await res.json();
      if (!d.ok || !d.structuredScenes) {
        setLastAction(`Structure failed: ${d.error || "unknown"} — continuing with original idea`);
        return;
      }
      // Apply tags to existing scenes or store breakdown for expand step
      setStructuredTagBreakdown(d.tagBreakdown);
      // Rebuild idea with visual structure annotations so expand picks them up
      const taggedLines = (d.structuredScenes as Array<{ tag: string; description: string; imageIntent: string; durationHint: number }>)
        .map((s) => `[${s.tag}] ${s.description}`)
        .join("\n");
      const cinematicIdea = `${idea.trim()}\n\n--- Visual Structure ---\n${taggedLines}`;
      setIdea(cinematicIdea);
      setLastAction(`Story structured: ${d.structuredScenes.length} visual moments tagged (${d.tagBreakdown?.VISUAL || 0} visual, ${d.tagBreakdown?.ACTION || 0} action, ${d.tagBreakdown?.BEAT || 0} beat). Now click Expand.`);
    } catch (err) {
      setLastAction(`Structure error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStructuring(false);
    }
  }

  async function expandStory() {
    if (!idea.trim()) return;
    setExpanding(true);
    setUiError(null);
    setLastAction("AI is reading your story and building the full production plan...");
    try {
      // ── STEP 1: Story Expansion ──────────────────────────────────────────────
      // API expects { storyInput } — NOT { idea }
      const { seconds: durSeconds, label: durLabel } = parseDurationToSeconds(targetDuration);

      const expandRes = await fetch("/api/hybrid/story-expand", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyInput: idea.trim(),
          genre: genre || undefined,
          tone: tone || undefined,
          storyEra: storyEra || undefined,
          storyCulture: (storyCulture || REGION_TO_CULTURE[storyRegion] || undefined),
          language: effectiveLanguage,
          audience: audienceType,
          costPreference,
          targetDuration: durSeconds,
          targetDurationLabel: durLabel,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          tier: aiTier,
          nameRegion: storyRegion || undefined,
          nameStyle: storyNameStyle || undefined,
          country: storyCountry || undefined,
          languageLevel: storyLanguageLevel || undefined,
          storyType: storyType || undefined,
          emotionalIntensity: storyEmotionalIntensity || undefined,
          customNames: (() => {
            try { return JSON.parse(sessionStorage.getItem("ghs_custom_names") || "[]"); } catch { return []; }
          })(),
        }),
      });
      const expandData = await expandRes.json();

      // Handle parse failure (422) — AI responded but JSON was invalid
      if (!expandRes.ok || expandData.ok === false) {
        const errMsg = expandData.error || "Story AI failed. Try again or select a different AI model.";
        setUiError(errMsg);
        setLastAction("Story expansion failed — " + errMsg);
        if (expandData.provider) setLastUsedAiProvider(expandData.provider);
        setExpanding(false);
        return;
      }

      // API returns { ok, expandedStory, provider (which AI actually ran) }
      const expandedObj = expandData.expandedStory || {};
      const storySummary: string = expandedObj.summary || expandData.summary || idea;
      const storyFullScript: string = expandedObj.fullScript || storySummary;
      setExpandedSummary(storySummary);
      if (expandData.provider) setLastUsedAiProvider(expandData.provider);
      setFullScript(storyFullScript);
      // Henry 2026-06-09 (round 2): always auto-apply AI movie title after
      // Expand with AI — user CALLED Expand expecting things to update. Only
      // skip when the current title was the user's own custom edit (tracked
      // via userEditedTitle flag set by the input's onChange). Default and
      // system-set titles like "Andio Hybrid Project" both get replaced.
      const aiTitle = typeof expandedObj.movieTitle === "string" ? expandedObj.movieTitle.trim() : "";
      if (aiTitle && !userEditedTitle) {
        setProjectTitle(aiTitle);
      }
      setProjectPhase("EXPANDED");
      setLastAction("Story expanded — extracting characters...");

      // ── STEP 2: Character Extraction ─────────────────────────────────────────
      // API expects { expandedStory: object } — NOT { story: string }
      setLoadingCharacters(true);
      const charRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: expandedObj,       // ← pass the full object, not a string
          projectId: projectId || undefined,
        }),
      });
      const charData = await charRes.json();

      // API returns { success, characters: [{ name, characterId, role, gender, age, voiceId, voiceName }] }
      // Note: field is "name" not "displayName", and "role" not "roleType"
      const extractedChars: CharacterIdentity[] = [];
      if (charData.characters?.length > 0) {
        charData.characters.forEach((c: Record<string, unknown>, i: number) => {
          extractedChars.push({
            characterId: (c.characterId as string) || `CH${String(i + 1).padStart(2, "0")}`,
            displayName: (c.name as string) || (c.displayName as string) || `Character ${i + 1}`,
            roleType: (c.role as string) || (c.roleType as string) || "supporting",
            gender: (c.gender as string) || "unknown",
            ageRange: (c.age as string) || (c.ageRange as string) || "adult",
            skinTone: (c.skinTone as string) || "",
            hairStyle: "",
            wardrobeStyle: (c.wardrobeStyle as string) || "",
            speechStyle: (c.speechStyle as string) || (c.defaultSpeechStyle as string) || "normal",
            accentType: "",
            emotionProfile: (c.personality as string) || "",
            voiceId: (c.voiceId as string) || "",
            language: effectiveLanguage,
            tags: [],
            hasVoice: !!(c.voiceId as string),
            hasImage: false,
            // Visual fields — populated from extraction (ethnicity + age MUST flow through
            // so portrait gen prompts include them BEFORE auto-AI-Read can override)
            species: "human",
            bodyBuild: "",
            colorDescription: (c.colorDescription as string) || (c.skinTone as string) || "",
            faceFeatures: "",
            clothingDetails: "",
            accessories: "",
            distinctiveFeatures: (c.visualDescription as string) || "",
            ageAppearance: "",
          });
        });
        // Dedup by displayName — prevents duplicate characters if expandStory() is called twice
        const seenNames = new Set<string>();
        const dedupedChars = extractedChars.filter(c => {
          const key = c.displayName.toLowerCase();
          if (seenNames.has(key)) return false;
          seenNames.add(key);
          return true;
        });
        setCharacters(dedupedChars);
        // Auto-assign Piper voices by gender — don't overwrite any the user already picked
        setCharacterPiperVoices(prev => {
          const auto: Record<string, string> = {};
          for (const c of dedupedChars) {
            if (prev[c.characterId]) continue;
            const g = (c.gender || "").toLowerCase();
            if (g === "female") auto[c.characterId] = "en_US-amy-medium";
            else if (g === "male" && /narrat/i.test(c.roleType)) auto[c.characterId] = "en_US-libritts-high";
            else if (g === "male") auto[c.characterId] = "en_US-ryan-high";
            else auto[c.characterId] = "en_US-lessac-medium";
          }
          return { ...auto, ...prev };
        });
        setProjectPhase("CHARACTERS_EXTRACTED");
        setLastAction(`${dedupedChars.length} characters found — breaking story into scenes...`);
      } else if (expandedObj.characterList?.length > 0) {
        // Fallback: use characterList from story expansion if character-extract returned nothing
        expandedObj.characterList.forEach((c: Record<string, unknown>, i: number) => {
          extractedChars.push({
            characterId: `CH${String(i + 1).padStart(2, "0")}`,
            displayName: (c.name as string) || `Character ${i + 1}`,
            roleType: (c.role as string) || "supporting",
            gender: (c.gender as string) || "unknown",
            ageRange: (c.age as string) || "adult",
            skinTone: "", hairStyle: "", wardrobeStyle: "", speechStyle: (c.voiceStyle as string) || "normal",
            accentType: "", emotionProfile: (c.description as string) || "",
            voiceId: "", language: effectiveLanguage, tags: [], hasVoice: false, hasImage: false,
            species: "", bodyBuild: "", colorDescription: "", faceFeatures: "",
            clothingDetails: "", accessories: "", distinctiveFeatures: "", ageAppearance: "",
          });
        });
        setCharacters(extractedChars);
        setCharacterPiperVoices(prev => {
          const auto: Record<string, string> = {};
          for (const c of extractedChars) {
            if (prev[c.characterId]) continue;
            const g = (c.gender || "").toLowerCase();
            if (g === "female") auto[c.characterId] = "en_US-amy-medium";
            else if (g === "male" && /narrat/i.test(c.roleType)) auto[c.characterId] = "en_US-libritts-high";
            else if (g === "male") auto[c.characterId] = "en_US-ryan-high";
            else auto[c.characterId] = "en_US-lessac-medium";
          }
          return { ...auto, ...prev };
        });
        setProjectPhase("CHARACTERS_EXTRACTED");
      }
      setLoadingCharacters(false);

      // ── STEP 3: Scene Breakdown ───────────────────────────────────────────────
      // API requires projectId + expandedStory as string + characters with characterId + displayName + role
      // If no DB projectId, use the lightweight plan endpoint instead
      setLoadingScenes(true);
      // Build name→visual map from AI-expanded story
      const charVisualMap = new Map<string, string>();
      if (Array.isArray(expandedObj.characterList)) {
        for (const ec of expandedObj.characterList) {
          if (ec.name && ec.description) charVisualMap.set(ec.name.toUpperCase(), ec.description);
        }
      }

      const scenePayload = {
        storyText: storyFullScript || storySummary,           // full story text for scene planning
        characters: extractedChars.map(c => ({
          characterId: c.characterId,
          displayName: c.displayName,
          role: c.roleType,
          ageRange: c.ageRange || "adult",
          gender: c.gender || "unknown",
          skinTone: c.skinTone || "",
          visualDescription: charVisualMap.get(c.displayName.toUpperCase()) || "",
        })),
        genre: genre || undefined,
        tone: tone || undefined,
        storyEra: storyEra || undefined,
        storyCulture: (storyCulture || REGION_TO_CULTURE[storyRegion] || undefined),
        costPreference,
        targetDuration,
        projectId: projectId || undefined,
      };

      const sceneRes = await fetch("/api/hybrid/scene-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenePayload),
      });
      const sceneData = await sceneRes.json();

      if (sceneData.scenes?.length > 0) {
        const builtScenes: HybridScene[] = sceneData.scenes.map((s: Record<string, unknown>, i: number) => ({
          sceneId: (s.sceneId as string) || `SC${String(i + 1).padStart(2, "0")}`,
          scene: i + 1,
          title: (s.title as string) || `Scene ${i + 1}`,
          description: (s.description as string) || (s.narrativeDescription as string) || "",
          sceneType: (s.sceneType as string) || "image-led",
          narrationMode: "light", narrationStrength: "medium", narrationScript: "",
          musicStyle: (s.musicSuggestion as string) || "", musicIntensity: "medium",
          sfx: (s.soundSuggestion as string) || "", ambience: "", motionDuration: (s.durationEstimate as number) || sceneDurationSec,
          imageTreatment: "Static",
          credits: SCENE_TYPES.find(t => t.id === (s.sceneType as string))?.credits || 2,
          reason: "", characterIds: (s.characterIds as string[]) || [],
          dialogueDensity: (s.dialogueDensity as string) || "low",
          emotionalWeight: (s.emotionalWeight as string) || "medium",
          location: (s.location as string) || "",
          timeOfDay: (s.timeOfDay as string) || "",
          mood: (s.mood as string) || "",
          shots: [],
          audioPlan: {
            narrationIntensity: (s.narrationIntensity as string) || "medium",
            musicMood: (s.mood as string) || "cinematic",
            musicIntensity: (s.sceneType as string) === "audio-bridge" ? "high" : "medium",
            sfxList: [],
            ambienceList: [],
            transitionAudio: "crossfade",
          },
          costEstimate: 2,
          status: "draft" as const,
        }));
        // Clear old story's media before loading new scenes — scene IDs like SC01 would
        // otherwise map to previous story's videos/images stored under the same keys.
        setSceneVideos({});
        setSceneImages({});
        setSceneVideoVersions({});
        setSceneIntelligence({});
        setSceneBeatImages({});
        setSelectedBeatImages({});
        setScenes(builtScenes);
        setProjectPhase("SCENES_READY");
        setLastAction(`${extractedChars.length} characters · ${builtScenes.length} scenes ready — review below then go to Characters`);

        // Run scene intelligence (incubation stage) in background
        runSceneIntelligence(
          builtScenes.map(s => ({
            sceneId: s.sceneId, title: s.title, description: s.description,
            location: s.location, timeOfDay: s.timeOfDay, mood: s.mood,
          })),
          storySummary
        );

        // Auto-run supervisor QC after expand so culture, cast, continuity, and prompt
        // corrections are applied immediately — without requiring a manual QC button click.
        // Small delay so scene state has settled before QC reads it.
        setTimeout(() => runStoryQC(), 1500);
      } else {
        setLastAction(`Story expanded · ${extractedChars.length} characters ready — scenes will be planned in Characters tab`);
      }
      setLoadingScenes(false);
      setActiveTab("story"); // Stay on Story tab so user sees the full review

    } catch (err) {
      console.error("expandStory failed:", err);
      setUiError("Story expansion failed: " + String(err));
    }
    setExpanding(false);
  }

  // ── Story Quality Control — runs the full supervisor pipeline ──────────────
  async function runStoryQC() {
    if (!expandedSummary && !idea.trim()) return;
    setStoryQCRunning(true);
    setStoryQCResult(null);
    setQcFixDoneMsg(null);
    setLastAction("Story QC running — validating against supervisor pipeline...");
    try {
      // Build duration in seconds from targetDuration string
      let totalSec = 60;
      if (targetDuration === "30-60s") totalSec = 45;
      else if (targetDuration === "1-2 min") totalSec = 90;
      else if (targetDuration === "2-3 min") totalSec = 150;
      else if (targetDuration === "3-5 min") totalSec = 240;
      else if (targetDuration === "5-10 min") totalSec = 450;
      else if (targetDuration === "10+ min") totalSec = 720;
      else if (targetDuration.startsWith("custom:")) {
        const m = parseInt(targetDuration.match(/(\d+)m/)?.[1] || "0");
        const s = parseInt(targetDuration.match(/(\d+)s/)?.[1] || "0");
        totalSec = m * 60 + s;
      }

      const contract = {
        storyId: projectId || `story_${Date.now()}`,
        country: storyCountry || "General",
        culture: storyRegion || "general",
        storyType,
        totalDurationSeconds: totalSec,
        sceneDurationSeconds: sceneDurationSec,
        estimatedSceneCount: Math.max(1, Math.round(totalSec / sceneDurationSec)),
        languageLevel: storyLanguageLevel,
        emotionalIntensity: storyEmotionalIntensity,
        subtitleStyle: storySubtitleStyle,
        generationMode: storyGenerationMode,
        targetAudience: audienceType,
        ageRating: audienceType === "children" ? "G" : "PG",
        defaultCastAssumptions: {
          ethnicity: (storyCountry === "Nigeria" || storyRegion === "africa") ? "Black Nigerian/African" : "context-appropriate",
          countryContext: storyCountry || "General",
          allowWhiteCastOnlyIfUserRequests: true,
        },
        nameStyle: storyNameStyle || undefined,
      };

      // QC text source: prefer current scene content so fixes show on re-run.
      // Scenes with narrationScript/description are more accurate than expandedSummary
      // (which is frozen at expand-time and doesn't reflect QC fixes).
      const scenesHaveContent = scenes.length > 0 &&
        scenes.some(s => (s.narrationScript || s.description || "").trim().length > 20);
      let qcStoryText: string;
      if (scenesHaveContent) {
        qcStoryText = scenes
          .slice().sort((a, b) => a.scene - b.scene)
          .map(s => (s.narrationScript?.trim() || s.description?.trim() || "").replace(/\n+/g, " "))
          .filter(Boolean)
          .join("\n\n");
      } else {
        qcStoryText = expandedSummary || idea;
      }

      // Build full ScenePlan-shaped objects so scene-level supervisors have real data
      const qcScenes = scenes.map(s => ({
        scene_id: s.sceneId,
        scene_number: s.scene,
        title: s.title,
        duration: s.motionDuration || sceneDurationSec,
        summary: s.description || "",
        voiceover_text: s.narrationScript?.trim() || s.description || "",
        characters: s.characterIds || [],
        location: s.location || "unspecified",
        time_of_day: "daytime",
        emotion: s.emotionalWeight || "neutral",
        visual_prompt: s.description || "",
        image_prompt: s.description || "",
        video_prompt: "",
        negative_prompt: "blurry, distorted, text, watermark",
        dialogue: "",
        subtitle_text: s.narrationScript?.trim() || s.description || "",
        subtitle_style: storySubtitleStyle,
        music_cue: s.musicStyle || "ambient",
        sfx_cues: s.sfx ? [s.sfx] : [],
        camera_style: "medium shot",
        continuity_notes: [] as string[],
        provider_recommendation: "image_plus_motion" as const,
        provider_reason: "hybrid planner default",
      }));

      // Build Cast Bible from UI's characters so QC recognises all defined characters.
      // Without this, Stage 4 AI-generates the Cast Bible from story text and misses
      // secondary characters (TAIWO, KEHINDE, etc.) → cast_consistency floods with warnings.
      // buildCharacterLookup maps both character_id AND name (lowercase), so whether
      // s.characterIds contains IDs or display names, the lookup finds them.
      const knownCharIds = new Set(characters.map(c => c.characterId.toLowerCase()));
      const knownCharNames = new Set(characters.map(c => c.displayName.toLowerCase()));
      // Collect scene character IDs that aren't in the formal characters list → add as placeholders
      // AI scene expansion uses display names (e.g. "TAIWO") not UUIDs — these need placeholder entries.
      const extraCharIds = new Set<string>();
      scenes.forEach(s => {
        (s.characterIds || []).forEach(id => {
          if (id && !knownCharIds.has(id.toLowerCase()) && !knownCharNames.has(id.toLowerCase())) {
            extraCharIds.add(id);
          }
        });
      });
      const castBibleFromChars = [
        ...characters.map((c) => ({
          character_id: c.characterId,
          name: c.displayName,
          age: c.ageRange || "adult",
          gender: c.gender || "unknown",
          ethnicity: (c.colorDescription || c.skinTone || "").toLowerCase().includes("dark")
            ? "Black/African" : "context-appropriate",
          skin_tone: c.skinTone || "",
          body_type: c.bodyBuild || "",
          hair: c.hairStyle || "",
          clothing: c.wardrobeStyle || "",
          role: c.roleType || "supporting",
          personality: c.emotionProfile || c.speechStyle || "",
          voice_style: c.speechStyle || "",
          relationship: "",
        })),
        // Placeholder entries for AI-assigned names not yet in the Characters tab
        ...Array.from(extraCharIds).map(id => ({
          character_id: id, name: id,
          age: "adult", gender: "unknown", ethnicity: "context-appropriate",
          skin_tone: "", body_type: "", hair: "", clothing: "",
          role: "supporting", personality: "", voice_style: "", relationship: "",
        })),
      ];

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 90000);
      let res: Response;
      try {
        res = await fetch("/api/story/supervise", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            storyText: qcStoryText,
            contract,
            castBible: castBibleFromChars,
            scenes: qcScenes,
            projectId: projectId || undefined,
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res!.json();
      if (!res!.ok || data.error) {
        setLastAction(`Story QC failed: ${data.error || "Unknown error"}`);
      } else {
        setStoryQCResult(data);
        setStoryQCSceneIndex(0);
        const gatePassed = data.gatekeeper?.passed;
        const score = data.gatekeeper?.score || 0;

        // Apply supervisor-corrected scenes back into the planner.
        // The 23-supervisor chain (culture, cast, continuity, emotion, music, prompt-builder)
        // rewrites image_prompt, voiceover_text, music_cue, and sfx_cues on each scene.
        // Without this merge, those corrections exist only in the QC result panel and are
        // never actually used — which is why supervisors appeared to "do nothing".
        if (Array.isArray(data.scenes) && data.scenes.length > 0) {
          const supervisedMap = new Map<string, Record<string, unknown>>();
          for (const sp of data.scenes as Record<string, unknown>[]) {
            if (sp.scene_id) supervisedMap.set(sp.scene_id as string, sp);
          }
          setScenes(prev => prev.map(hs => {
            const sp = supervisedMap.get(hs.sceneId);
            if (!sp) return hs;
            const newDesc = (sp.image_prompt || sp.visual_prompt) as string | undefined;
            const newNarr = sp.voiceover_text as string | undefined;
            const newMusic = sp.music_cue as string | undefined;
            const newSfx = Array.isArray(sp.sfx_cues) && (sp.sfx_cues as string[]).length > 0
              ? (sp.sfx_cues as string[]).join(", ")
              : undefined;
            return {
              ...hs,
              description:     (newDesc && newDesc.trim())  ? newDesc.trim()  : hs.description,
              narrationScript: (newNarr && newNarr.trim())  ? newNarr.trim()  : hs.narrationScript,
              musicStyle:      (newMusic && newMusic.trim()) ? newMusic.trim() : hs.musicStyle,
              sfx:             newSfx ?? hs.sfx,
            };
          }));
        }

        const applied = data.scenes?.length ?? 0;
        setLastAction(`Story QC complete — Score: ${score}/100 ${gatePassed ? "✓ Passed" : "⚠ Issues found"}${applied > 0 ? ` · ${applied} scenes updated` : ""}`);
      }
    } catch (err) {
      const msg = (err instanceof Error && err.name === "AbortError") ? "QC timed out (90s) — try again" : String(err);
      setLastAction(`Story QC error: ${msg}`);
    } finally {
      setStoryQCRunning(false);
    }
  }

  // ── Scene Intelligence Pass — auto-detects environment + ambient sounds for each scene ──
  // This is the "incubation stage" from the architecture doc:
  // car horns in city scenes, cricket sounds in bush scenes, market chatter in market scenes, etc.
  // Triggered automatically after story expansion. Can also be triggered manually.
  async function runSceneIntelligence(
    scenesInput: Array<{ sceneId: string; title: string; description: string; location?: string; timeOfDay?: string; mood?: string }>,
    storyCtx?: string
  ) {
    if (scenesInput.length === 0) return;
    setRunningIntelligence(true);
    setLastAction("Scene Intelligence running — detecting environments and ambient sounds...");
    try {
      const res = await fetch("/api/hybrid/scene-intelligence", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: scenesInput, storyContext: storyCtx || expandedSummary || idea }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.intelligence)) {
        const map: Record<string, SceneIntelligenceData> = {};
        for (const item of data.intelligence) {
          map[item.sceneId] = item;
        }
        setSceneIntelligence(map);

        // Back-fill ambience, sfx, AND audioPlan from scene intelligence
        setScenes(prev => prev.map(s => {
          const intel = map[s.sceneId];
          if (!intel) return s;
          const intelSfx = intel.sfxEvents?.slice(0, 4) ?? [];
          const intelAmbience = intel.ambienceSounds?.slice(0, 3) ?? [];
          return {
            ...s,
            location: s.location || intel.environmentType.replace(/-/g, " "),
            timeOfDay: s.timeOfDay || intel.timeOfDay,
            mood: s.mood || intel.energyLevel,
            ambience: s.ambience || intelAmbience.join(", "),
            sfx: s.sfx || intelSfx.join(", "),
            // Directly populate audioPlan so scene cards show SFX immediately
            audioPlan: {
              ...(s.audioPlan ?? {}),
              sfxList: s.audioPlan?.sfxList?.length ? s.audioPlan.sfxList : intelSfx,
              ambienceList: s.audioPlan?.ambienceList?.length ? s.audioPlan.ambienceList : intelAmbience,
              musicMood: s.audioPlan?.musicMood || intel.energyLevel || "cinematic",
            },
          };
        }));

        const envSummary = [...new Set(data.intelligence.map((i: SceneIntelligenceData) => i.environmentType))].join(", ");
        setLastAction(`Scene Intelligence complete — detected: ${envSummary}`);
      }
    } catch (err) {
      console.warn("Scene intelligence pass failed (non-critical):", err);
      setLastAction("Scene Intelligence unavailable — environments set to defaults");
    }
    setRunningIntelligence(false);
  }

  // ── Detect character names from story text via AI ──────────────────────────
  async function detectCharactersFromStory() {
    const text = expandedSummary || idea;
    if (!text.trim()) { setUiError("Write or expand your story first."); return; }
    setDetectingChars(true);
    setLastAction("AI scanning story for character names...");
    try {
      // character-extract expects { expandedStory: object } — wrap plain text in summary field
      const res = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expandedStory: { summary: text, characterList: [] },
          language: effectiveLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setUiError(data.error || "Character detection failed");
        setDetectingChars(false);
        return;
      }
      const detected = (data.characters || []).map((c: Record<string, string>) => ({
        name: c.name || c.displayName || "",
        description: c.visualDescription || c.description || "",
      })).filter((c: { name: string }) => c.name.trim());

      if (detected.length === 0) {
        setUiError("No characters found — try expanding your story first for better results.");
        setDetectingChars(false);
        return;
      }

      // Only show names not already in the cast
      const existingNames = characters.map(c => c.displayName.toLowerCase());
      const newOnly = detected.filter((c: { name: string }) => !existingNames.includes(c.name.toLowerCase()));
      setAiDetectedNames(newOnly.length > 0 ? newOnly : detected);
      setLastAction(`AI detected ${detected.length} character(s) in your story`);
    } catch (err) {
      setUiError("Could not detect characters: " + String(err));
    }
    setDetectingChars(false);
  }

  // ── Build a character inline from name + story context ────────────────────
  async function buildCharacterInline(name: string) {
    const text = expandedSummary || idea;
    if (!name.trim() || !text.trim()) return;
    setInlineCreatingId(name);
    setInlinePreview(null);
    try {
      const res = await fetch("/api/hybrid/character-build", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: name,
          storyText: text,
          artStyle: effectiveProjectStyle,
          language: effectiveLanguage,
          // Pass already-built characters so AI makes this one visually distinct
          existingCharacters: characters.map(c => ({
            name: c.displayName,
            species: c.species,
            gender: c.gender,
            colorDescription: c.colorDescription,
          })),
        }),
      });
      const data = await res.json();
      if (data.ok && data.character) {
        const c = data.character;
        const newId = `CH${String(characters.length + 1).padStart(2, "0")}`;
        const built: CharacterIdentity = {
          characterId: newId,
          displayName: c.displayName || name,
          roleType: c.roleType || "supporting",
          gender: c.gender || "unknown",
          ageRange: c.ageRange || "adult",
          skinTone: c.skinTone || "",
          hairStyle: "",
          wardrobeStyle: c.wardrobeStyle || "",
          speechStyle: c.speechStyle || "normal",
          accentType: "",
          emotionProfile: c.emotionProfile || "",
          voiceId: c.voiceId || "",
          voiceType: c.voiceType || "mid",
          intonation: c.intonation || "calm",
          language: effectiveLanguage,
          tags: [],
          hasVoice: !!c.voiceId,
          hasImage: false,
          species: c.species || "",
          bodyBuild: c.bodyBuild || "",
          colorDescription: c.colorDescription || "",
          faceFeatures: c.faceFeatures || "",
          clothingDetails: c.clothingDetails || "",
          accessories: c.accessories || "",
          distinctiveFeatures: c.distinctiveFeatures || "",
          ageAppearance: c.ageAppearance || "",
        };
        setInlinePreview(built);
      } else {
        setLastAction(`Could not build character "${name}" — try again`);
      }
    } catch {
      setLastAction(`Character build failed for "${name}"`);
    }
    setInlineCreatingId(null);
  }

  // ── Import character from a real photo / custom image ────────────────────
  // 1. Upload image  2. Vision AI extracts traits  3. Build CharacterIdentity
  async function importCharacterFromPhoto(file: File, nameOverride?: string) {
    setImportingFromPhoto(true);
    setPhotoImportLog("Uploading image…");
    setInlinePreview(null);
    try {
      // Step 1 — upload image
      const form = new FormData();
      form.append("file", file);
      const uploadRes = await fetch("/api/character-voices/upload-image", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadData.url) throw new Error(uploadData.error || "Upload failed");
      const imageUrl: string = uploadData.url;

      // Step 2 — vision AI extracts visual traits
      setPhotoImportLog("Reading photo with AI vision…");
      const analyzeRes = await fetch("/api/hybrid/analyze-character", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, characterName: nameOverride || "imported", preferredProvider: visionProvider }),
      });
      const analyzeData = await analyzeRes.json();
      if (!analyzeData.ok && !analyzeData.analysis) throw new Error(analyzeData.error || "Vision analysis failed");
      const a = analyzeData.analysis || {};

      // Step 3 — build CharacterIdentity with photo as canonical image
      const newId = `CH${String(characters.length + 1).padStart(2, "0")}_PH`;
      const displayName = nameOverride?.trim() || a.suggestedName || "Imported Character";
      const built: CharacterIdentity = {
        characterId: newId,
        displayName,
        roleType: a.suggestedRole || "supporting",
        gender: a.gender || "unknown",
        ageRange: a.ageAppearance || "adult",
        skinTone: a.colorDescription || "",
        hairStyle: "",
        wardrobeStyle: a.clothingDetails || "",
        speechStyle: "normal",
        accentType: "",
        emotionProfile: a.distinctiveFeatures || "",
        voiceId: "",
        voiceType: "mid",
        intonation: "calm",
        language: effectiveLanguage,
        tags: ["photo-import"],
        hasVoice: false,
        hasImage: true,
        imageUrl,
        imageLocked: true,  // imported photo = locked as canonical reference
        species: a.species || "human",
        bodyBuild: a.bodyBuild || "",
        colorDescription: a.colorDescription || "",
        faceFeatures: a.faceFeatures || "",
        clothingDetails: a.clothingDetails || "",
        accessories: a.accessories || "",
        distinctiveFeatures: a.distinctiveFeatures || "",
        ageAppearance: a.ageAppearance || "",
      };
      setInlinePreview(built);
      setPhotoImportLog(`"${displayName}" ready — click "Add to Cast" to confirm`);
      setPhotoImportName("");
    } catch (err) {
      setPhotoImportLog(`[!] ${err instanceof Error ? err.message : "Import failed"}`);
    }
    setImportingFromPhoto(false);
  }

  // ── Accept inline preview → add to cast + save to character registry ────────
  function acceptInlineCharacter() {
    if (!inlinePreview) return;
    const alreadyExists = characters.some(c => c.characterId === inlinePreview.characterId);
    if (!alreadyExists) {
      setCharacters(prev => [...prev, inlinePreview]);
      setLastAction(`${inlinePreview.displayName} added to cast — saving to registry...`);
      // Auto-save to global character registry (DB) — best effort, non-blocking
      // Photo-imported characters save their image so the same face can be reused
      // across different movies with different names and roles.
      fetch("/api/character-voices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: inlinePreview.displayName,
          characterId: inlinePreview.characterId,
          gender: inlinePreview.gender,
          role: inlinePreview.roleType,
          age: inlinePreview.ageRange,
          voiceId: inlinePreview.voiceId,
          voiceType: inlinePreview.voiceType,
          language: inlinePreview.language,
          imageUrl: inlinePreview.imageUrl || null,
          visualDescription: [
            inlinePreview.species,
            inlinePreview.colorDescription,
            inlinePreview.faceFeatures,
            inlinePreview.clothingDetails,
            inlinePreview.distinctiveFeatures,
          ].filter(Boolean).join(", "),
          defaultSpeechStyle: inlinePreview.speechStyle,
          personality: inlinePreview.emotionProfile,
          keepSameToggle: inlinePreview.imageLocked ?? false,
          attribute: inlinePreview.tags?.includes("photo-import") ? "photo-import" : undefined,
        }),
      }).then(() => setLastAction(
        inlinePreview.tags?.includes("photo-import")
          ? `${inlinePreview.displayName} saved to Character Library — reuse in any movie with a different name`
          : `${inlinePreview.displayName} added to cast & saved to registry`
      )).catch(() => { /* best effort */ });
    }
    setInlinePreview(null);
    setAiDetectedNames(prev => prev.filter(n => n.name.toLowerCase() !== inlinePreview.displayName.toLowerCase()));
  }

  // ── Build ALL story characters via AI in one pass ─────────────────────────
  // Detects character names from story, then builds each one via character-build API.
  // No page navigation — everything inline.
  async function buildAllStoryCharacters() {
    // Use fullScript if available — much richer than the 2-sentence summary
    const storyRichText = fullScript || expandedSummary || idea;
    if (!storyRichText.trim()) { setUiError("Write or expand your story first."); return; }
    setBuildingAllChars(true);
    setBuildAllProgress("Detecting characters from story...");
    try {
      // Step 1 — detect names from the richest text available
      const expandedPayload = expandedSummary
        ? { summary: expandedSummary, characterList: [] }
        : { summary: storyRichText, characterList: [] };
      const detectRes = await fetch("/api/hybrid/character-extract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expandedStory: expandedPayload, language: effectiveLanguage }),
      });
      const detectData = await detectRes.json();
      const detected: Array<{ name: string; description?: string }> = detectData.characters || detectData.names || [];
      if (detected.length === 0) { setUiError("No characters detected in story. Add character names manually below."); setBuildingAllChars(false); setBuildAllProgress(null); return; }

      // Step 2 — build each one via character-build API
      // builtSoFar tracks species/colours of characters built in this pass so each is distinct
      // Pre-seed with characters that are ALREADY fully built (has species + colorDescription)
      const builtSoFar: Array<{ name: string; species?: string; gender?: string; colorDescription?: string }> = [
        ...characters
          .filter(c => c.species && c.colorDescription)
          .map(c => ({ name: c.displayName, species: c.species, gender: c.gender, colorDescription: c.colorDescription })),
      ];
      let built = 0;
      for (const det of detected) {
        const name = det.name || (det as unknown as string);
        if (!name) continue;
        // Only skip if the character is FULLY built (has species + color) — don't skip minimal extractions
        const existingChar = characters.find(c => c.displayName.toLowerCase() === name.toLowerCase());
        const isFullyBuilt = existingChar && existingChar.species && existingChar.colorDescription;
        if (isFullyBuilt) { built++; setBuildAllProgress(`Skipping ${name} (already built) — ${built}/${detected.length}`); continue; }
        setBuildAllProgress(`Building ${name}... (${built + 1}/${detected.length})`);
        try {
          const res = await fetch("/api/hybrid/character-build", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              characterName: name,
              storyText: storyRichText,  // full script — much richer context
              artStyle: effectiveProjectStyle,
              language: effectiveLanguage,
              existingCharacters: builtSoFar,  // grows with each character built
            }),
          });
          const data = await res.json();
          if (data.ok && data.character) {
            const c = data.character;
            const newId = `CH_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
            const builtChar: CharacterIdentity = {
              characterId: newId, displayName: c.displayName || name,
              roleType: c.roleType || "supporting", gender: c.gender || "unknown",
              ageRange: c.ageRange || "adult", skinTone: c.skinTone || "",
              hairStyle: "", wardrobeStyle: c.wardrobeStyle || "",
              speechStyle: c.speechStyle || "normal", accentType: "",
              emotionProfile: c.emotionProfile || "", voiceId: c.voiceId || "",
              voiceType: c.voiceType || "mid", intonation: c.intonation || "calm",
              language: effectiveLanguage, tags: [], hasVoice: !!c.voiceId, hasImage: false,
              species: c.species || "", bodyBuild: c.bodyBuild || "",
              colorDescription: c.colorDescription || "", faceFeatures: c.faceFeatures || "",
              clothingDetails: c.clothingDetails || "", accessories: c.accessories || "",
              distinctiveFeatures: c.distinctiveFeatures || "", ageAppearance: c.ageAppearance || "",
            };
            setCharacters(prev => {
              // If a minimal version of this character exists (from story extraction), REPLACE it with the full build
              const existingIdx = prev.findIndex(x =>
                x.displayName.toLowerCase() === builtChar.displayName.toLowerCase() ||
                x.characterId === builtChar.characterId
              );
              const nextPrev = existingIdx >= 0
                ? prev.map((x, i) => i === existingIdx ? { ...x, ...builtChar, characterId: x.characterId, imageUrl: x.imageUrl } : x)
                : [...prev, builtChar];
              // Auto-save to character registry (best effort)
              fetch("/api/character-voices", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  name: builtChar.displayName, characterId: builtChar.characterId,
                  gender: builtChar.gender, role: builtChar.roleType, age: builtChar.ageRange,
                  voiceId: builtChar.voiceId, voiceType: builtChar.voiceType, language: builtChar.language,
                  visualDescription: [builtChar.species, builtChar.colorDescription, builtChar.clothingDetails].filter(Boolean).join(", "),
                  defaultSpeechStyle: builtChar.speechStyle, personality: builtChar.emotionProfile,
                }),
              }).catch(() => { /* best effort */ });
              return nextPrev;
            });
          }
          // Record this character so the next build knows to be visually distinct
          if (data.ok && data.character) {
            builtSoFar.push({
              name: data.character.displayName || name,
              species: data.character.species,
              gender: data.character.gender,
              colorDescription: data.character.colorDescription,
            });
          }
        } catch { /* skip failed character, continue */ }
        built++;
        if (built < detected.length) await new Promise(r => setTimeout(r, 800)); // brief pause between API calls
      }
      setBuildAllProgress(null);
      setLastAction(`${built} characters built from story — review and approve in Characters tab`);
    } catch (err) { setUiError("Character build failed: " + String(err)); }
    setBuildingAllChars(false);
    setBuildAllProgress(null);
  }

  async function makeCharacters() {
    if (characters.length === 0) return;
    setMakingCharacters(true);
    setLastAction("Creating character identities...");
    try {
      const res = await fetch("/api/hybrid/make-characters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characters: characters.map(c => ({
            displayName: c.displayName, name: c.displayName, roleType: c.roleType,
            gender: c.gender, age: c.ageRange, skinTone: c.skinTone, hairStyle: c.hairStyle,
            wardrobeStyle: c.wardrobeStyle, speechStyle: c.speechStyle,
            visualDescription: `${c.displayName}, ${c.gender || ""} ${c.ageRange || ""}`.trim(),
          })),
          projectId: projectId || undefined,
        }),
      });
      const data = await res.json();
      if (data.characters?.length > 0) {
        setCharacters(prev => prev.map((c, i) => {
          const made = data.characters[i];
          return made ? { ...c, characterId: made.characterId || c.characterId, voiceId: made.voiceId || c.voiceId, hasVoice: !!made.voiceId } : c;
        }));
        setCharactersMade(true);
        setProjectPhase("CHARACTERS_READY");
        setLastAction(`${data.characters.length} characters saved to registry`);
      }
    } catch (err) { console.error("makeCharacters failed:", err); setUiError("Character creation failed. Please try again."); }
    setMakingCharacters(false);
  }

  // ── Run pre-assembly preflight ────────────────────────────────────────────
  async function runPreflight() {
    setPreflightRunning(true);
    try {
      const res = await fetch("/api/hybrid/pre-flight", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectType: "hybrid",
          story: expandedSummary || idea,
          scriptSegments: scriptSegments,
          scenes: scenes.map(s => ({ sceneId: s.sceneId, imageUrl: sceneImages[s.sceneId] || undefined, videoUrl: sceneVideos[s.sceneId] || undefined, title: s.title })),
          audioConfig: { narrationProvider: narratorAudioUrl ? narratorVoice : undefined, narrationAudioUrl: narratorAudioUrl || undefined, narrationText: expandedSummary || idea, musicUrl: selectedMusicUrl || undefined, musicName: selectedMusicName || undefined, characterVoices: Object.keys(characterAudioUrls) },
          characters: characters.map(c => ({ id: c.characterId, name: c.displayName, voiceId: c.voiceId, voiceName: c.voiceId || "" })),
        }),
      });
      const data = await res.json();
      setPreflightResult(data);
    } catch (err) { console.error("preflight error:", err); }
    setPreflightRunning(false);
  }

  // ── Phase 3-B: Simple string hash (djb2 variant) ──────────────────────────
  // Used to detect when scene description changes after last image gen.
  function hashStr(s: string): string {
    let h = 0;
    for (const c of s) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
    return String(h >>> 0);
  }

  // ── Phase 3-A: Load saved local images for a scene ────────────────────────
  async function loadSceneLocalImages(sceneId: string, projId: string) {
    try {
      const res = await fetch(`/api/hybrid/scene-images?projectId=${encodeURIComponent(projId)}&sceneId=${encodeURIComponent(sceneId)}`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.files)) {
        setSceneLocalImages(prev => ({ ...prev, [sceneId]: data.files.map((f: { url: string }) => f.url) }));
      }
    } catch {
      // non-blocking
    }
  }

  async function makeSceneImage(scene: HybridScene) {
    try { await requireGate(); } catch { return; }
    setGeneratingSceneImage(scene.sceneId);
    setLastAction(`Generating image for Scene ${scene.scene}...`);
    setSceneGenProgress(prev => ({ ...prev, [scene.sceneId]: { percent: 3, message: "Starting image generation...", type: "image" } }));

    // Timer-based progress animation for image (no SSE — image gen is fast)
    const startTime = Date.now();
    const estimatedMs = 45000;
    const progressTimer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(88, 3 + (elapsed / estimatedMs) * 85);
      setSceneGenProgress(prev => ({
        ...prev,
        [scene.sceneId]: { percent: pct, message: "Generating image...", type: "image" },
      }));
    }, 600);

    // Match by characterId OR displayName (case-insensitive). Scene-plan AI returns names
    // like "ANDRE", but Character tab has formal IDs like "XX_ANDRE08R35DARKBROW".
    // Without the name fallback, the scene generates without the character's portrait/age/ethnicity.
    const sceneChars = characters.filter(c => scene.characterIds?.some(id => {
      if (!id) return false;
      const idLower = id.toLowerCase();
      return id === c.characterId || idLower === c.displayName.toLowerCase();
    }));
    const characterOverrides = sceneChars.map(c => {
      // Use front-angle portrait (index 0) for PuLID face-lock reference.
      // Front angle has the clearest face view — PuLID extracts face from it best.
      const angles = charRefImages[c.characterId];
      const bestPortraitUrl = angles?.[0]?.url || c.imageUrl || null;
      return {
        characterId: c.characterId,
        name: c.displayName,
        species: c.species || "human",
        age: c.ageRange || null,
        visualDescription: buildVisualDescription(c),
        imageUrl: bestPortraitUrl,
        wardrobe: c.clothingDetails || c.wardrobeStyle || null,
        hairstyle: c.hairStyle || null,
        isPhotoImport: !!(c.tags?.includes("photo-import") && c.imageUrl),
      };
    });
    try {
      // Henry 2026-06-09: cross-scene continuity. For ANY scene that isn't the
      // first, send the earliest already-generated scene image as the identity
      // anchor. Scene-image route's `previousSceneImageUrl` engages face-lock
      // even on multi-char scenes so characters keep the same look across the
      // project. Picks the LOWEST-numbered generated scene as the anchor — that
      // way SC1's look propagates to SC2..SCN, not a chain that drifts.
      const anchorEntry = (() => {
        const entries = Object.entries(sceneImages);
        if (entries.length === 0) return null;
        // Pick the scene with the smallest scene number that isn't this one.
        const sorted = entries
          .map(([sid, url]) => ({ sid, url, num: scenes.find(s => s.sceneId === sid)?.scene ?? 999 }))
          .filter(e => e.sid !== scene.sceneId && !!e.url)
          .sort((a, b) => a.num - b.num);
        return sorted[0]?.url ?? null;
      })();

      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.sceneId, projectId, sceneText: `${scene.title}. ${scene.description}`,
          characterIds: scene.characterIds, location: scene.location, mood: scene.mood,
          timeOfDay: scene.timeOfDay, cameraFraming: scene.shots[0]?.framingType,
          projectStyle: sceneStyles[scene.sceneId] || effectiveProjectStyle, characterOverrides,
          modelId: transparentBg && effectiveImageModelId.includes("ideogram_v3") ? "fal_ideogram_v3_transparent" : effectiveImageModelId,
          transparentBg: transparentBg && effectiveImageModelId.includes("ideogram_v3"),
          seed: genSeed !== null ? genSeed : undefined,
          storyEra: storyEra || undefined,
          storyCulture: (storyCulture || REGION_TO_CULTURE[storyRegion] || undefined),
          previousSceneImageUrl: anchorEntry,
        }),
      });
      const data = await res.json();
      clearInterval(progressTimer);
      if (data.error === "unresolved_characters") {
        // 2026-05-09 — route now SOFT-SKIPS unresolved IDs (no longer 400). This branch only
        // fires for legacy clients hitting an older route. Show non-blocking toast instead of alert().
        setLastAction(`Note: ${data.message || "some characters not in registry — image generated without them"}`);
        setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
      } else if (data.imageUrl || data.imagePath) {
        const url = data.imageUrl || `/api/media/${data.imagePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
        // Surface face-lock diagnostic — so user can see whether the portrait actually locked the face
        if (data.faceLock) {
          const fl = data.faceLock;
          if (fl.requested && !fl.used) {
            setUiError(`Scene ${scene.scene}: Face-lock requested but did NOT apply — model used ${fl.modelUsed} instead of fal_flux_pulid. Portrait may have failed to upload. Faces will drift.`);
          } else if (fl.requested && fl.used) {
            setLastAction(`Scene ${scene.scene} ✓ face-locked to portrait (${fl.modelUsed})`);
          } else {
            setLastAction(`Scene ${scene.scene} done (no portrait → no face-lock — ${fl.reason})`);
          }
        }
        setSceneGenProgress(prev => ({ ...prev, [scene.sceneId]: { percent: 100, message: "Done!", type: "image" } }));
        setTimeout(() => setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; }), 1500);
        setSceneImages(prev => {
          const old = prev[scene.sceneId];
          if (old) {
            setPrevSceneImages(p => {
              const existing = p[scene.sceneId] || [];
              return { ...p, [scene.sceneId]: [old, ...existing].slice(0, 3) };
            });
          }
          return { ...prev, [scene.sceneId]: url };
        });
        // ACCUMULATE — also push into the master Gen Max pool so the assembly picker sees it.
        // Without this, clicking Gen Image after Gen Max overwrites the active slot only and
        // the new image isn't visible in the multi-image spread.
        setSceneBeatImages(prev => {
          const existing = prev[scene.sceneId] || [];
          if (existing.includes(url)) return prev;
          return { ...prev, [scene.sceneId]: [...existing, url].slice(-30) };
        });
        setSelectedBeatImages(prev => {
          const existing = prev[scene.sceneId] || [];
          return { ...prev, [scene.sceneId]: [...existing, true].slice(-30) };
        });
        if (data.model) setSceneImageModels(prev => ({ ...prev, [scene.sceneId]: data.model }));
        // 3-B: Record description hash at time of image gen so stale badge can detect drift
        const descHash = hashStr(scene.description || "");
        setSceneDescHashes(prev => ({ ...prev, [scene.sceneId]: descHash }));
        // 3-A: Reload saved local images for this scene after new image saved
        if (projectId && scene.sceneId) {
          loadSceneLocalImages(scene.sceneId, projectId);
        }
        // 5-B: Clear broken flag for model that just succeeded
        if (data.model) setBrokenModels(prev => { const n = new Set(prev); n.delete(data.model); return n; });
        // New image means old video is stale — clear it so scene board shows the new image
        setSceneVideos(prev => prev[scene.sceneId] ? (({ [scene.sceneId]: _, ...rest }) => rest)(prev) : prev);
        setSceneVideoVersions(prev => prev[scene.sceneId] ? (({ [scene.sceneId]: _, ...rest }) => rest)(prev) : prev);
        updateScene(scene.scene, { status: "generated" as const });
        setLastAction(`Scene ${scene.scene} image ready`);
        fetch("/api/assets", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "image", name: `${projectTitle || "Project"} — ${scene.sceneId}: ${scene.title}`,
            filePath: url, fileUrl: url,
            description: scene.description?.slice(0, 120) || scene.title,
            tags: ["scene-image", "hybrid-planner", scene.sceneId, scene.mood || ""].filter(Boolean),
            source: "hybrid_planner",
          }),
        }).catch(() => {});
        // Save generated image to character profiles (if character has no image yet)
        if (scene.characterIds?.length) {
          fetch("/api/character-voices")
            .then(r => r.json())
            .then((d: { voices?: Array<{ id: string; characterId: string | null; imageUrl: string | null }> }) => {
              const voiceMap = new Map((d.voices || []).map(v => [v.characterId, v]));
              scene.characterIds.forEach(cId => {
                const voice = voiceMap.get(cId);
                if (voice && !voice.imageUrl && voice.id) {
                  fetch(`/api/character-voices/${voice.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrl: url }),
                  }).catch(() => {});
                }
              });
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      clearInterval(progressTimer);
      setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
      console.error("makeSceneImage failed:", err);
      setUiError(`Image generation failed for Scene ${scene.scene}. Please try again.`);
      // 5-B: mark current model as broken so health dot turns red in picker
      setBrokenModels(prev => new Set(prev).add(effectiveImageModelId));
    }
    setGeneratingSceneImage(null);
  }

  // ── Generate 3 image variations for a scene with different seeds ──────────
  async function makeSceneImageVariations(scene: HybridScene) {
    try { await requireGate(); } catch { return; }
    if (generatingVariations.has(scene.sceneId)) return;
    setGeneratingVariations(prev => new Set(prev).add(scene.sceneId));
    setLastAction(`Generating 3 variations for Scene ${scene.scene}...`);

    // Match by characterId OR displayName (case-insensitive). Scene-plan AI returns names
    // like "ANDRE", but Character tab has formal IDs like "XX_ANDRE08R35DARKBROW".
    // Without the name fallback, the scene generates without the character's portrait/age/ethnicity.
    const sceneChars = characters.filter(c => scene.characterIds?.some(id => {
      if (!id) return false;
      const idLower = id.toLowerCase();
      return id === c.characterId || idLower === c.displayName.toLowerCase();
    }));
    const characterOverrides = sceneChars.map(c => {
      const angles = charRefImages[c.characterId];
      const bestPortraitUrl = angles?.[1]?.url || angles?.[0]?.url || c.imageUrl || null;
      return {
        characterId: c.characterId,
        name: c.displayName,
        species: c.species || "human",
        age: c.ageRange || null,
        visualDescription: buildVisualDescription(c),
        imageUrl: bestPortraitUrl,
        wardrobe: c.clothingDetails || c.wardrobeStyle || null,
        hairstyle: c.hairStyle || null,
        isPhotoImport: !!(c.tags?.includes("photo-import") && c.imageUrl),
      };
    });

    const seeds = [Math.floor(Math.random() * 1e9), Math.floor(Math.random() * 1e9), Math.floor(Math.random() * 1e9)];
    const results: string[] = [];

    for (let i = 0; i < 3; i++) {
      try {
        const res = await fetch("/api/hybrid/scene-image", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneId: scene.sceneId, projectId, sceneText: `${scene.title}. ${scene.description}`,
            characterIds: scene.characterIds, location: scene.location, mood: scene.mood,
            timeOfDay: scene.timeOfDay, cameraFraming: scene.shots[0]?.framingType,
            projectStyle: sceneStyles[scene.sceneId] || effectiveProjectStyle, characterOverrides,
            modelId: transparentBg && effectiveImageModelId.includes("ideogram_v3") ? "fal_ideogram_v3_transparent" : effectiveImageModelId,
            transparentBg: transparentBg && effectiveImageModelId.includes("ideogram_v3"),
            seed: seeds[i],
            storyEra: storyEra || undefined,
            storyCulture: (storyCulture || REGION_TO_CULTURE[storyRegion] || undefined),
          }),
        });
        const data = await res.json();
        if (data.imageUrl || data.imagePath) {
          const url = data.imageUrl || `/api/media/${(data.imagePath as string).replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
          results.push(url);
        }
      } catch (err) {
        console.error(`[makeSceneImageVariations] variation ${i + 1} failed:`, err);
      }
    }

    if (results.length > 0) {
      // First result becomes active image; rest go into prevSceneImages as chooseable versions
      const [first, ...rest] = results;
      setSceneImages(prev => {
        const old = prev[scene.sceneId];
        if (old) {
          setPrevSceneImages(p => {
            const existing = p[scene.sceneId] || [];
            return { ...p, [scene.sceneId]: [...rest, old, ...existing].slice(0, 3) };
          });
        } else {
          setPrevSceneImages(p => ({
            ...p,
            [scene.sceneId]: rest.slice(0, 3),
          }));
        }
        return { ...prev, [scene.sceneId]: first };
      });
      updateScene(scene.scene, { status: "generated" as const });
      setLastAction(`Scene ${scene.scene}: ${results.length} variations ready — pick from history below`);
    } else {
      setUiError(`Variation generation failed for Scene ${scene.scene}.`);
    }

    setGeneratingVariations(prev => {
      const n = new Set(prev);
      n.delete(scene.sceneId);
      return n;
    });
  }

  // splitIntoActionBeats imported from @/lib/scene/action-beats (Phase B extraction)

  // ── Gen Max — generate one image per action beat in the scene description ──
  /**
   * makeSceneBeatImages — generate N images for a scene.
   *
   * 2026-05-09 ACCUMULATE FIX (mirrors children-planner):
   *   - Old: replaced sceneBeatImages[sceneId] with new array → second click wiped first run.
   *   - New: APPEND new images to the existing pool. Each click adds more.
   *   - Per-scene custom count via sceneMaxTarget[sceneId] (default 4, cap 30).
   *   - When natural beats < target, fill remainder with seed-varied retries of the full description.
   */
  async function makeSceneBeatImages(scene: HybridScene, countOverride?: number) {
    try { await requireGate(); } catch { return; }
    if (generatingMaxBeats.has(scene.sceneId)) return;

    const fullDesc = `${scene.title}. ${scene.description}`;
    // 2026-05-10 — bumped default from 4 → 8 per Henry's "boring without pictures".
    // User can still override per-scene via sceneMaxTarget input.
    const targetCount = Math.max(1, Math.min(30, countOverride ?? sceneMaxTarget[scene.sceneId] ?? 8));
    const naturalBeats = splitIntoActionBeats(fullDesc);
    // 2026-05-10 UNIQUE PROMPTS — when natural beats run out, append camera-angle / mood variations
    // so the model produces distinct images instead of near-duplicates of fullDesc.
    // 12 angle variations cover most repetition; user requesting >12 unique images is unlikely.
    const ANGLE_VARIATIONS = [
      "wide establishing shot, cinematic frame",
      "close-up, intimate framing",
      "medium shot, balanced composition",
      "low-angle dramatic shot",
      "high-angle overhead view",
      "over-the-shoulder perspective",
      "side profile shot",
      "back view, character moving forward",
      "tight detail shot focused on hands or face",
      "tracking shot, motion blur",
      "atmospheric pull-back showing environment",
      "extreme close-up, eyes only",
    ];
    // Henry 2026-06-11: this legacy list (sentence split + angle variations) is now the
    // FALLBACK only — the storyboard decomposition below replaces it when the LLM is up.
    let promptList: string[] = [];
    for (let i = 0; i < targetCount; i++) {
      if (naturalBeats.length > 1 && i < naturalBeats.length) {
        promptList.push(naturalBeats[i]);
      } else {
        // Out of natural beats — vary by camera angle so each image is distinct.
        const variant = ANGLE_VARIATIONS[i % ANGLE_VARIATIONS.length];
        promptList.push(`${fullDesc}. ${variant}`);
      }
    }

    setGeneratingMaxBeats(prev => new Set(prev).add(scene.sceneId));
    setMaxBeatsProgress(prev => ({ ...prev, [scene.sceneId]: `Image 1/${promptList.length}…` }));
    setLastAction(`Gen Max: generating ${promptList.length} images for Scene ${scene.scene}…`);

    // Match by characterId OR displayName (case-insensitive). Scene-plan AI returns names
    // like "ANDRE", but Character tab has formal IDs like "XX_ANDRE08R35DARKBROW".
    // Without the name fallback, the scene generates without the character's portrait/age/ethnicity.
    const sceneChars = characters.filter(c => scene.characterIds?.some(id => {
      if (!id) return false;
      const idLower = id.toLowerCase();
      return id === c.characterId || idLower === c.displayName.toLowerCase();
    }));
    const characterOverrides = sceneChars.map(c => {
      const angles = charRefImages[c.characterId];
      const bestPortraitUrl = angles?.[1]?.url || angles?.[0]?.url || c.imageUrl || null;
      return {
        characterId: c.characterId,
        name: c.displayName,
        species: c.species || "human",
        age: c.ageRange || null,
        visualDescription: buildVisualDescription(c),
        imageUrl: bestPortraitUrl,
        wardrobe: c.clothingDetails || c.wardrobeStyle || null,
        hairstyle: c.hairStyle || null,
        isPhotoImport: !!(c.tags?.includes("photo-import") && c.imageUrl),
      };
    });

    // ── STORYBOARD DECOMPOSITION (Henry 2026-06-11) ──────────────────────────
    // Think like a human storyboard artist: break the scene's action into targetCount
    // CHRONOLOGICAL frozen instants (boy about to jump → mid-leap → clearing the fence
    // → descending → impact in the mud → sitting muddy), each restating the cast's
    // exact age + wardrobe (stops 8yo → 42yo drift) and the situation-true expression
    // (chased = terrified, never smiling). The legacy promptList above remains the
    // fallback when the decompose LLM chain is down.
    let frameMeta: Array<{ expression: string; camera: string }> | null = null;
    try {
      setMaxBeatsProgress(prev => ({ ...prev, [scene.sceneId]: `Storyboarding ${targetCount} frames…` }));
      const dres = await fetch("/api/hybrid/beat-decompose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneText: fullDesc,
          mood: scene.mood,
          location: scene.location,
          timeOfDay: scene.timeOfDay,
          frameCount: targetCount,
          characters: characterOverrides.map(c => ({
            name: c.name,
            age: c.age,
            species: c.species,
            wardrobe: c.wardrobe,
            visualDescription: (c.visualDescription || "").slice(0, 160),
          })),
        }),
      });
      const ddata = await dres.json();
      if (dres.ok && ddata?.ok && Array.isArray(ddata.frames) && ddata.frames.length > 0) {
        const frames = ddata.frames as Array<{ moment: string; expression?: string; camera?: string }>;
        promptList = frames.map((f, i) =>
          `Storyboard frame ${i + 1} of ${frames.length} — one continuous action shown in chronological sequence. ${f.moment}`);
        frameMeta = frames.map(f => ({ expression: f.expression || "", camera: f.camera || "" }));
        console.log(`[makeSceneBeatImages] storyboard decompose OK — ${frames.length} frames via ${ddata.provider}`);
      } else {
        console.warn(`[makeSceneBeatImages] decompose unavailable (${ddata?.error || dres.status}) — using legacy beat split`);
      }
    } catch (derr) {
      console.warn("[makeSceneBeatImages] decompose threw — using legacy beat split:", derr);
    }

    // 2026-05-10 — single-attempt retry on failure (1 retry per slot) so 8/8 actually delivers.
    // Sequential calls; each scene-image takes 30-60s on FAL. 8 sequential = 4-8 min total.
    // Failures before this fix were silently dropped — now we retry once with a fresh seed.
    const newUrls: string[] = [];
    let actualFailed = 0;
    // Henry 2026-06-09: Gen Max needs the SC1 anchor too. Without it, beat
    // images render without face-lock → characters morph between beats and
    // age looks inconsistent. Pick the same SC1 anchor that single-Regen uses.
    const genMaxAnchor = (() => {
      const entries = Object.entries(sceneImages);
      if (entries.length === 0) return null;
      const sorted = entries
        .map(([sid, url]) => ({ sid, url, num: scenes.find(s => s.sceneId === sid)?.scene ?? 999 }))
        .filter(e => e.sid !== scene.sceneId && !!e.url)
        .sort((a, b) => a.num - b.num);
      return sorted[0]?.url ?? null;
    })();

    async function genOnce(bi: number, retryAttempt: boolean): Promise<string | null> {
      try {
        const res = await fetch("/api/hybrid/scene-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sceneId: `${scene.sceneId}_b${bi}_${Date.now()}_${retryAttempt ? "r" : "a"}`,
            projectId,
            sceneText: promptList[bi],
            characterIds: scene.characterIds,
            location: scene.location,
            mood: scene.mood,
            timeOfDay: scene.timeOfDay,
            // Per-frame camera from the storyboard when available — each instant gets
            // the shot that shows it best, instead of one framing for all beats.
            cameraFraming: frameMeta?.[bi]?.camera || scene.shots[0]?.framingType,
            projectStyle: sceneStyles[scene.sceneId] || effectiveProjectStyle,
            characterOverrides,
            modelId: effectiveImageModelId,
            seed: Math.floor(Math.random() * 1e9),
            storyEra: storyEra || undefined,
            storyCulture: (storyCulture || REGION_TO_CULTURE[storyRegion] || undefined),
            previousSceneImageUrl: genMaxAnchor,
            // Storyboard mode: tells scene-image to keep the frame's action verbs
            // (skip toStaticFrame) and lock the per-instant facial expression.
            actionFrame: !!frameMeta,
            frameExpression: frameMeta?.[bi]?.expression || undefined,
          }),
        });
        if (!res.ok) {
          console.warn(`[makeSceneBeatImages] image ${bi} HTTP ${res.status} ${retryAttempt ? "(retry)" : ""}`);
          return null;
        }
        const data = await res.json();
        if (data.error) {
          console.warn(`[makeSceneBeatImages] image ${bi} server error: ${data.error}`);
          return null;
        }
        if (data.imageUrl || data.imagePath) {
          return data.imageUrl || `/api/media/${data.imagePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
        }
        console.warn(`[makeSceneBeatImages] image ${bi} no url in response`);
        return null;
      } catch (err) {
        console.error(`[makeSceneBeatImages] image ${bi} threw${retryAttempt ? " (retry)" : ""}:`, err);
        return null;
      }
    }
    for (let bi = 0; bi < promptList.length; bi++) {
      setMaxBeatsProgress(prev => ({ ...prev, [scene.sceneId]: `Image ${bi + 1}/${promptList.length}…` }));
      let url = await genOnce(bi, false);
      if (!url) {
        // One retry — different seed, different sceneId tag so any provider cache misses.
        setMaxBeatsProgress(prev => ({ ...prev, [scene.sceneId]: `Image ${bi + 1}/${promptList.length} (retry)…` }));
        url = await genOnce(bi, true);
      }
      if (url) newUrls.push(url);
      else actualFailed++;
    }

    // ACCUMULATE — never wipe existing pool. Cap at 30 to avoid runaway memory.
    setSceneBeatImages(prev => {
      const existing = prev[scene.sceneId] || [];
      const merged = [...existing, ...newUrls].slice(-30);
      return { ...prev, [scene.sceneId]: merged };
    });
    setSelectedBeatImages(prev => {
      const existing = prev[scene.sceneId] || [];
      const additions = newUrls.map(() => true);
      const merged = [...existing, ...additions].slice(-30);
      return { ...prev, [scene.sceneId]: merged };
    });
    setGeneratingMaxBeats(prev => { const n = new Set(prev); n.delete(scene.sceneId); return n; });
    setMaxBeatsProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
    // 2026-05-10 — surface success count vs requested. When fewer land than asked, user knows.
    const failed = promptList.length - newUrls.length;
    if (failed > 0) {
      setLastAction(`Scene ${scene.scene}: +${newUrls.length} of ${promptList.length} images added (${failed} failed — check console)`);
    } else {
      setLastAction(`Scene ${scene.scene}: +${newUrls.length} images added to pool`);
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // STORY TAB — SCENE EDITING HELPERS
  //
  // All three call /api/hybrid/scene-edit with a different `op`:
  //   - polish: tightens ONE scene's description (returns new title + description)
  //   - break:  splits ONE scene into TWO consecutive scenes
  //   - expand: takes ALL scenes + story text and returns a longer ordered list
  //
  // The endpoint is Ollama-backed (free, local). All three preserve the story arc
  // and characters — the AI is instructed never to change the outcome or genre.
  // ════════════════════════════════════════════════════════════════════════

  // Rewrites scene.description per the chosen mode (polish/add action/intense/reduce/emotional).
  // Result lands in storyEditedDescription so the user sees the change in the textarea before
  // committing. They still have to click Save to overwrite the actual scene state.
  //
  // Mode = which button was clicked. Provider = current LLM (auto/ollama/openai/claude).
  async function polishSceneText(
    scene: HybridScene,
    mode: "default" | "add_action" | "intense" | "reduce_action" | "emotional" = "default",
  ): Promise<string | null> {
    if (storyPolishingSceneId === scene.sceneId) return null;
    setStoryPolishingSceneId(scene.sceneId);
    setStoryPolishingMode(mode);
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "polish",
          polishMode: mode,
          provider: effectiveLlmProvider,
          scene: {
            sceneId: scene.sceneId, title: scene.title, description: storyEditedDescription || scene.description,
            location: scene.location, timeOfDay: scene.timeOfDay, mood: scene.mood,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setUiError(`Polish failed (${mode}): ${data.error || "unknown"}`);
        return null;
      }
      const newDesc = data.scene?.description || scene.description;
      setStoryEditedDescription(newDesc);
      const tag = mode === "default" ? "polished" : mode.replace(/_/g, " ");
      setLastAction(`Scene ${scene.scene} ${tag} via ${data.provider || "ai"} — review and Save to commit`);
      return newDesc;
    } catch (err) {
      setUiError(`Polish error: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    } finally {
      setStoryPolishingSceneId(null);
      setStoryPolishingMode(null);
    }
  }

  // AI chat — apply user's free-text instruction to the scene currently being edited.
  async function polishSceneCustom(scene: HybridScene) {
    const query = storyEditAiQuery[scene.sceneId]?.trim();
    if (!query || storyPolishingSceneId === scene.sceneId) return;
    setStoryPolishingSceneId(scene.sceneId);
    setStoryPolishingMode(null);
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "polish",
          polishMode: "custom",
          customInstruction: query,
          provider: effectiveLlmProvider,
          scene: {
            sceneId: scene.sceneId, title: scene.title,
            description: storyEditedDescription || scene.description,
            location: scene.location, timeOfDay: scene.timeOfDay, mood: scene.mood,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok) { setUiError(`AI fix failed: ${data.error || "unknown"}`); return; }
      setStoryEditedDescription(data.scene?.description || scene.description);
      setStoryEditAiQuery(prev => ({ ...prev, [scene.sceneId]: "" }));
      setLastAction(`Scene ${scene.scene} revised — review and Save to commit`);
    } catch (err) {
      setUiError(`AI fix error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStoryPolishingSceneId(null);
    }
  }

  // Apply a single QC suggestion to ALL scenes in one batch LLM call (fast).
  async function fixQCSuggestion(suggestion: string) {
    if (fixingQC || scenes.length === 0) return;
    setFixingQC(true);
    setQcFixDoneMsg(null);
    setLastAction(`QC fix: sending all ${scenes.length} scenes to AI…`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      let res: Response;
      try {
        res = await fetch("/api/hybrid/scene-edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            op: "batch_polish",
            customInstruction: suggestion,
            provider: effectiveLlmProvider,
            scenes: scenes.map(s => ({ sceneId: s.sceneId, title: s.title, description: s.description, location: s.location, timeOfDay: s.timeOfDay, mood: s.mood })),
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res!.json();
      if (data.ok && Array.isArray(data.scenes)) {
        for (const updated of data.scenes) {
          const idx = scenes.findIndex(s => s.sceneId === updated.sceneId);
          if (idx !== -1) updateScene(scenes[idx].scene, { description: updated.description, ...(updated.title ? { title: updated.title } : {}) });
        }
        setQcFixDoneMsg(`Fix applied to ${data.scenes.length} scenes — re-run QC to verify`);
      } else {
        setQcFixDoneMsg(`Fix failed: ${data.error || "unknown"}`);
      }
    } catch (err) {
      const msg = (err instanceof Error && err.name === "AbortError") ? "Fix timed out (60s) — try again" : String(err);
      setQcFixDoneMsg(`Fix error: ${msg}`);
    } finally {
      setFixingQC(false);
    }
  }

  // Direct truncation for word-count violations — guaranteed to pass QC unlike LLM rewrites.
  function applyWordCountFixes(fixes: string[]): number {
    let applied = 0;
    for (const fix of fixes) {
      if (!/trim\s+voiceover/i.test(fix)) continue;
      const maxWordsMatch = fix.match(/to\s+(\d+)\s+words/i);
      // Accept any quote style (", ", ", ') around the scene ID
      const sceneIdMatch = fix.match(/in\s+scene\s+[“”"']?([A-Za-z0-9_]+)[“”"']?/i);
      if (!maxWordsMatch || !sceneIdMatch) continue;
      const maxWords = parseInt(maxWordsMatch[1]);
      const sceneId = sceneIdMatch[1];
      const target = scenes.find(s =>
        s.sceneId === sceneId ||
        `SC${String(s.scene).padStart(2, "0")}` === sceneId
      );
      if (!target) continue;
      // QC checks narrationScript first, then description — truncate both so QC passes.
      const patch: Partial<HybridScene> = {};
      const narr = target.narrationScript?.trim() || "";
      const desc = target.description?.trim() || "";
      const narrWords = narr.split(/\s+/).filter(w => w.length > 0);
      const descWords = desc.split(/\s+/).filter(w => w.length > 0);
      if (narr && narrWords.length > maxWords) {
        patch.narrationScript = narrWords.slice(0, maxWords).join(" ");
      }
      if (descWords.length > maxWords) {
        patch.description = descWords.slice(0, maxWords).join(" ");
      }
      if (Object.keys(patch).length > 0) {
        updateScene(target.scene, patch);
        applied++;
      }
    }
    return applied;
  }

  // Apply ALL QC suggestions: word-count fixes = direct truncation (instant + guaranteed).
  // Other fixes = one combined LLM batch_polish call.
  async function fixAllQCSuggestions() {
    if (!storyQCResult || fixingQC || scenes.length === 0) return;
    setQcFixDoneMsg(null);

    const raw = storyQCResult.gatekeeper.suggestedFixes;

    // Word-count violations: truncate directly, no LLM.
    const wordCountApplied = applyWordCountFixes(raw);

    // Direct-apply music cue changes — don't send to LLM (it would update description instead)
    let directApplied = wordCountApplied;
    const remainingFixes = raw.filter(f => !/trim\s+voiceover/i.test(f));
    const otherFixes = remainingFixes.filter(f => {
      if (/change.*music|music.*change/i.test(f) && applyFixDirect(f)) {
        directApplied++;
        return false;
      }
      return true;
    });
    const seen = new Map<string, string>();
    for (const fix of otherFixes) {
      const base = fix.replace(/\s+(?:in|across)\s+(?:scene\s+)?"?SC\w+"?\.?$/i, "").trim();
      if (!seen.has(base)) {
        seen.set(base, fix.replace(/in scene "SC\w+"/i, "across all scenes"));
      }
    }
    const deduped = Array.from(seen.values());
    const skipped = otherFixes.length - deduped.length;

    let msg = "";
    if (directApplied > 0) msg += `${directApplied} fix(es) applied directly. `;
    if (deduped.length > 0) {
      setLastAction(`Fix All: applied ${directApplied} directly, sending ${deduped.length} other fix(es) to AI…`);
      await fixQCSuggestion(deduped.join(". Also: "));
      msg += `${deduped.length} other fix(es) applied via AI (${skipped} duplicates skipped).`;
    }
    setQcFixDoneMsg(`${msg} — re-run QC to verify`);
  }

  // Route a single suggested fix: try direct field updates first, fall back to LLM.
  // Returns true when handled directly so the caller can skip the LLM path.
  function applyFixDirect(fix: string): boolean {
    // Word-count voiceover — always truncate directly, no LLM needed
    if (/trim\s+voiceover/i.test(fix)) {
      const applied = applyWordCountFixes([fix]);
      setQcFixDoneMsg(applied > 0
        ? "Voiceover trimmed — re-run QC to verify"
        : "Could not parse scene ID — run Fix All instead");
      return true;
    }
    // Story-level word-count trim.
    // Important: QC's "story" is the JOIN of each scene's narrationScript|description
    // (built as qcStoryText at line ~1419). Truncating expandedSummary does NOTHING
    // for QC — we must trim each scene proportionally so the joined total drops.
    // Example fix: "Trim story to under 300 words for short_story."
    if (/trim\s+story/i.test(fix)) {
      const m = fix.match(/(?:under|to)\s+(\d+)\s+words/i);
      const maxW = m ? parseInt(m[1]) : 0;
      if (maxW > 0) {
        const sortedScenes = scenes.slice().sort((a, b) => a.scene - b.scene);
        type SceneRow = { scene: number; field: "narrationScript" | "description"; words: string[] };
        const rows: SceneRow[] = sortedScenes.map(s => {
          const narr = s.narrationScript?.trim() || "";
          const desc = s.description?.trim() || "";
          // Pick the field QC will actually read (narrationScript first, fallback description)
          const field: "narrationScript" | "description" = narr ? "narrationScript" : "description";
          const text = narr || desc;
          return { scene: s.scene, field, words: text.split(/\s+/).filter(Boolean) };
        });
        const totalWords = rows.reduce((sum, r) => sum + r.words.length, 0);
        if (totalWords <= maxW) {
          setQcFixDoneMsg(`Story already under ${maxW} words (${totalWords}) — re-run QC`);
          return true;
        }
        // Trim each scene by the same ratio, with a floor of 5 words per scene
        const ratio = maxW / totalWords;
        for (const r of rows) {
          const newCount = Math.max(5, Math.floor(r.words.length * ratio));
          if (newCount < r.words.length) {
            const trimmed = r.words.slice(0, newCount).join(" ");
            updateScene(r.scene, { [r.field]: trimmed } as Partial<HybridScene>);
          }
        }
        setQcFixDoneMsg(`Story trimmed from ${totalWords} to ~${maxW} words across ${rows.length} scenes — re-run QC to verify`);
        return true;
      }
    }
    // Music cue change — update musicStyle directly on the target scene
    if (/change.*music|music.*change/i.test(fix)) {
      // Extract quoted value: …to "soft ambient…" or similar
      const quoted = fix.match(/to\s+["""']([^"""'\n]{3,80})["""']/i);
      const newStyle = quoted?.[1]?.trim();
      // Target first scene if no specific scene mentioned
      const sceneIdMatch = fix.match(/scene\s+["""']?([A-Za-z0-9_]+)["""']?/i);
      const targetScene = sceneIdMatch
        ? scenes.find(s => s.sceneId === sceneIdMatch[1] || `SC${String(s.scene).padStart(2, "0")}` === sceneIdMatch[1])
        : scenes.slice().sort((a, b) => a.scene - b.scene)[0];
      if (newStyle && targetScene) {
        updateScene(targetScene.scene, { musicStyle: newStyle });
        setQcFixDoneMsg("Music cue updated — re-run QC to verify");
        return true;
      }
    }
    return false;
  }

  // Per-scene QC fix — word-count = direct truncation; others = single LLM polish call.
  async function fixSceneQC(scene: HybridScene) {
    if (!storyQCResult) { setLastAction("Run QC first to generate fix suggestions"); return; }
    const sceneRef = `SC${String(scene.scene).padStart(2, "0")}`;
    const sceneFixes = storyQCResult.gatekeeper.suggestedFixes.filter(f =>
      f.toUpperCase().includes(sceneRef) ||
      f.includes(scene.sceneId) ||
      f.toLowerCase().includes(`scene ${scene.scene}`)
    );
    if (sceneFixes.length === 0) {
      setLastAction(`No QC issues targeting Scene ${scene.scene} — run QC to refresh`);
      return;
    }

    // Word-count fix: direct truncation — guaranteed accurate.
    const wordCountApplied = applyWordCountFixes(sceneFixes);

    // Music / story trim / other direct-apply fixes — handle before LLM.
    let directApplied = wordCountApplied;
    const afterWordCount = sceneFixes.filter(f => !/trim\s+voiceover/i.test(f));
    const llmOnlyFixes: string[] = [];
    for (const f of afterWordCount) {
      if (applyFixDirect(f)) directApplied++;
      else llmOnlyFixes.push(f);
    }

    if (directApplied > 0 && llmOnlyFixes.length === 0) {
      setLastAction(`Scene ${scene.scene}: ${directApplied} fix(es) applied directly — re-run QC to verify`);
      return;
    }

    // Remaining fixes (couldn't apply directly) → send to LLM.
    if (llmOnlyFixes.length === 0) {
      if (directApplied > 0) {
        setLastAction(`Scene ${scene.scene}: ${directApplied} fix(es) applied — re-run QC to verify`);
      } else {
        setLastAction(`No fixable issues for Scene ${scene.scene}`);
      }
      return;
    }

    const instruction = `Fix these QC issues for this scene: ${llmOnlyFixes.join(". ")}`;
    setStoryPolishingSceneId(scene.sceneId);
    setStoryPolishingMode(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      let res: Response;
      try {
        res = await fetch("/api/hybrid/scene-edit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            op: "polish",
            polishMode: "custom",
            customInstruction: instruction,
            provider: effectiveLlmProvider,
            scene: { sceneId: scene.sceneId, title: scene.title, description: scene.description, location: scene.location, timeOfDay: scene.timeOfDay, mood: scene.mood },
          }),
        });
      } finally {
        clearTimeout(timeout);
      }
      const data = await res!.json();
      const newDescription = data.scene?.description || data.description;
      const newTitle = data.scene?.title || data.title;
      if (data.ok && newDescription) {
        updateScene(scene.scene, { description: newDescription, ...(newTitle ? { title: newTitle } : {}) });
        setLastAction(`Scene ${scene.scene} QC fix applied — re-run QC to verify`);
      } else {
        setLastAction(`Scene ${scene.scene} fix failed: ${data.error || "unknown"}`);
      }
    } catch (err) {
      const msg = (err instanceof Error && err.name === "AbortError") ? "timed out (60s)" : String(err);
      setLastAction(`Scene ${scene.scene} fix error: ${msg}`);
    } finally {
      setStoryPolishingSceneId(null);
      setStoryPolishingMode(null);
    }
  }

  // ── Context Check: AI-powered scene clarity check via scene-edit polish op ──
  function checkSceneContext(scene: HybridScene) {
    const text = (scene.narrationScript || scene.description || "").trim();
    if (!text) {
      setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "warn", note: "No description. Add scene detail so AI can generate properly." } }));
      return;
    }
    setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "checking", note: "Checking…" } }));
    const words = text.split(/\s+/).filter(Boolean);
    const bigWords = words.filter(w => w.replace(/[^a-zA-Z]/g, "").length > 10);
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
    const avgWPS = words.length / Math.max(sentences.length, 1);
    if (words.length < 5) {
      setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "warn", note: `Too short (${words.length} words). Add more description.` } }));
    } else if (bigWords.length > words.length * 0.3) {
      setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "warn", note: `${bigWords.length} complex words in ${words.length} total. Click Fix Context to simplify.` } }));
    } else if (avgWPS > 35) {
      setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "warn", note: `Avg ${Math.round(avgWPS)} words/sentence — too dense. Click Fix Context to break up.` } }));
    } else {
      setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "ok", note: `Clear (${words.length} words, ${sentences.length} sentences, avg ${Math.round(avgWPS)} w/s).` } }));
    }
  }

  // ── Context Fix: AI rewrites scene to be simple and understandable ───────────
  async function fixSceneContext(scene: HybridScene) {
    if (storyPolishingSceneId === scene.sceneId) return;
    setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "checking", note: "Rewriting for clarity…" } }));
    setStoryPolishingSceneId(scene.sceneId);
    setStoryPolishingMode(null);
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "polish",
          polishMode: "custom",
          customInstruction: "Rewrite this scene description to be clear, simple, and easy to understand. Use short sentences. Remove jargon and complex words. Any viewer should immediately understand what is happening.",
          provider: effectiveLlmProvider,
          scene: { sceneId: scene.sceneId, title: scene.title, description: scene.description, location: scene.location, timeOfDay: scene.timeOfDay, mood: scene.mood },
        }),
      });
      const data = await res.json();
      const newDescription = data.scene?.description || data.description;
      if (data.ok && newDescription) {
        updateScene(scene.scene, { description: newDescription });
        setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "ok", note: "Fixed — scene is now clearer. Review and save." } }));
        setLastAction(`Scene ${scene.scene} context fixed`);
      } else {
        setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "warn", note: `Fix failed: ${data.error || "unknown"}` } }));
      }
    } catch (err) {
      setContextCheckResults(prev => ({ ...prev, [scene.sceneId]: { status: "warn", note: `Error: ${err instanceof Error ? err.message : String(err)}` } }));
    } finally {
      setStoryPolishingSceneId(null);
      setStoryPolishingMode(null);
    }
  }

  // ── Context Check all scenes (sequential) ───────────────────────────────────
  function checkContextAll() {
    for (const scene of scenes) checkSceneContext(scene);
  }

  // ── Context Fix all scenes (sequential async) ────────────────────────────────
  async function fixContextAll() {
    if (fixingContext || scenes.length === 0) return;
    setFixingContext(true);
    try {
      for (const scene of scenes) await fixSceneContext(scene);
      setLastAction("Context fix applied to all scenes — review changes");
    } finally {
      setFixingContext(false);
    }
  }

  // Add an establishing shot for ONE scene — AI reads scene + prev scene and decides type/prompt.
  async function addEstablishingShot(scene: HybridScene) {
    if (establishingSceneId === scene.sceneId) return;
    setEstablishingSceneId(scene.sceneId);
    try {
      const sceneIdx = scenes.findIndex(s => s.sceneId === scene.sceneId);
      const prev = sceneIdx > 0 ? scenes[sceneIdx - 1] : null;
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "establish",
          provider: effectiveLlmProvider,
          scene: { sceneId: scene.sceneId, title: scene.title, description: scene.description, location: scene.location, timeOfDay: scene.timeOfDay, mood: scene.mood },
          prevScene: prev ? { sceneId: prev.sceneId, title: prev.title, description: prev.description, location: prev.location, timeOfDay: prev.timeOfDay, mood: prev.mood } : undefined,
        }),
      });
      const data = await res.json();
      if (data.ok && data.needed && data.shot) {
        setEstablishingShots(prev2 => ({ ...prev2, [scene.sceneId]: data.shot }));
        setLastAction(`Establishing shot added before Scene ${scene.scene}`);
      } else if (data.ok && !data.needed) {
        setLastAction(`Scene ${scene.scene}: no establishing shot needed`);
      } else {
        setLastAction(`Establishing shot error: ${data.error || "unknown"}`);
      }
    } catch (e) {
      setLastAction(`Establishing shot error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEstablishingSceneId(null);
    }
  }

  // Generate an image for an existing establishing shot via FAL FLUX.
  async function genEstablishingShotImage(sceneId: string) {
    const shot = establishingShots[sceneId];
    if (!shot) return;
    setEstablishingSceneId(sceneId); // reuse existing "generating" state
    try {
      const res = await fetch("/api/hybrid/establishing-shot/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, shot, provider: "flux-dev" }),
      });
      const data = await res.json();
      if (data.imageUrl) {
        setEstablishingShots(prev => ({
          ...prev,
          [sceneId]: { ...prev[sceneId], imageUrl: data.imageUrl },
        }));
        setLastAction(`Establishing shot image ready for ${sceneId}`);
      } else {
        setLastAction(`Establishing shot gen failed: ${data.error || "unknown"}`);
      }
    } catch (e) {
      setLastAction(`Establishing shot gen error: ${String(e)}`);
    } finally {
      setEstablishingSceneId(null);
    }
  }

  // Add establishing shots across ALL scenes in one AI call — reads full story context.
  async function addAllEstablishingShots() {
    if (establishingAll || scenes.length === 0) return;
    setEstablishingAll(true);
    setLastAction("Analyzing all scenes for establishing shots…");
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "establish_all",
          provider: effectiveLlmProvider,
          scenes: scenes.map(s => ({ sceneId: s.sceneId, title: s.title, description: s.description, location: s.location, timeOfDay: s.timeOfDay, mood: s.mood })),
          storyText: expandedSummary || idea,
          establishingMode, // Henry 2026-05-30 task #17
        }),
      });
      const data = await res.json();
      if (data.ok && Array.isArray(data.results)) {
        const newShots: Record<string, EstablishingShot> = {};
        let count = 0;
        for (const result of data.results as Array<{ sceneId: string; needed: boolean; shot: EstablishingShot | null }>) {
          if (result.needed && result.shot) {
            newShots[result.sceneId] = result.shot;
            count++;
          }
        }
        setEstablishingShots(prev => ({ ...prev, ...newShots }));
        setLastAction(`Added ${count} establishing shot${count !== 1 ? "s" : ""} across ${scenes.length} scenes`);
      } else {
        setLastAction(`Establish all error: ${data.error || "unknown"}`);
      }
    } catch (e) {
      setLastAction(`Establish all error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setEstablishingAll(false);
    }
  }

  // Splits one scene into two consecutive scenes at an AI-chosen breakpoint.
  // The resulting halves inherit all unchanged fields (sceneType, motionDuration, etc.)
  // from the original. After insertion we renumber every scene so sceneId stays in sync
  // with array position (SC01, SC02, …). Anything that referenced the old sceneId
  // (sceneImages, sceneVideos, etc.) will shift — that's expected, the user is editing the story.
  async function breakScene(scene: HybridScene) {
    if (storyBreakingSceneId === scene.sceneId) return;
    setStoryBreakingSceneId(scene.sceneId);
    setLastAction(`Breaking Scene ${scene.scene} into 2…`);
    try {
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "break",
          provider: effectiveLlmProvider,
          scene: {
            sceneId: scene.sceneId, title: scene.title, description: scene.description,
            location: scene.location, timeOfDay: scene.timeOfDay, mood: scene.mood,
          },
        }),
      });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.scenes) || data.scenes.length < 2) {
        setUiError(`Break failed: ${data.error || "AI did not return 2 scenes"}`);
        return;
      }
      // Replace original scene with the two halves; renumber the rest
      setScenes(prev => {
        const idx = prev.findIndex(s => s.sceneId === scene.sceneId);
        if (idx < 0) return prev;
        const [a, b] = data.scenes as Array<{ title: string; description: string; location?: string; timeOfDay?: string; mood?: string }>;
        const baseHalf = (suffix: string, half: typeof a, sceneNum: number): HybridScene => ({
          ...scene,
          sceneId: `${scene.sceneId}_${suffix}`,
          scene: sceneNum,
          title: half.title || scene.title,
          description: half.description || scene.description,
          location: half.location || scene.location,
          timeOfDay: half.timeOfDay || scene.timeOfDay,
          mood: half.mood || scene.mood,
        });
        const halves = [baseHalf("a", a, scene.scene), baseHalf("b", b, scene.scene + 1)];
        const next = [...prev.slice(0, idx), ...halves, ...prev.slice(idx + 1)];
        // Renumber and reissue sceneIds for cleanliness
        return next.map((s, i) => ({ ...s, scene: i + 1, sceneId: `SC${String(i + 1).padStart(2, "0")}` }));
      });
      setLastAction(`Scene ${scene.scene} → 2 scenes`);
    } catch (err) {
      setUiError(`Break error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStoryBreakingSceneId(null);
    }
  }

  // Adds in-between beats to the existing scene list. The AI is told to keep the same
  // story arc, characters, and ending — it should fill gaps, not rewrite the story.
  // We try to RE-USE existing scenes (matched by title) so any images/videos already
  // generated for those beats survive the expansion. New beats get default scene fields
  // copied from the first existing scene as a template.
  async function expandSceneList() {
    if (storyExpandingScenes || scenes.length === 0) return;
    setStoryExpandingScenes(true);
    setLastAction(`Expanding ${scenes.length} scenes…`);
    try {
      const storyText = fullScript || expandedSummary || idea || "";
      const res = await fetch("/api/hybrid/scene-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          op: "expand",
          provider: effectiveLlmProvider,
          scenes: scenes.map(s => ({
            sceneId: s.sceneId, title: s.title, description: s.description,
            location: s.location, timeOfDay: s.timeOfDay, mood: s.mood,
          })),
          storyText,
        }),
      });
      const data = await res.json();
      if (!data.ok || !Array.isArray(data.scenes) || data.scenes.length === 0) {
        setUiError(`Expand failed: ${data.error || "AI returned no scenes"}`);
        return;
      }
      setScenes(prev => {
        // Map AI-returned scenes back to HybridScene objects, preserving original where titles match.
        const expanded = data.scenes as Array<{ title: string; description: string; location?: string; timeOfDay?: string; mood?: string }>;
        return expanded.map((es, i) => {
          const sceneNum = i + 1;
          const sceneId = `SC${String(sceneNum).padStart(2, "0")}`;
          // Try to inherit from a previous scene with matching title — preserves images/videos when AI keeps a beat
          const matched = prev.find(p => p.title.trim().toLowerCase() === (es.title || "").trim().toLowerCase());
          if (matched) {
            return { ...matched, scene: sceneNum, sceneId, description: es.description || matched.description, location: es.location || matched.location, timeOfDay: es.timeOfDay || matched.timeOfDay, mood: es.mood || matched.mood };
          }
          // New scene — fill defaults from first existing scene's structural fields
          const tpl = prev[0];
          return {
            sceneId, scene: sceneNum,
            title: es.title || `Scene ${sceneNum}`,
            description: es.description || "",
            sceneType: tpl?.sceneType || "image-led",
            narrationMode: tpl?.narrationMode || "narrator",
            narrationStrength: tpl?.narrationStrength || "medium",
            narrationScript: "",
            musicStyle: tpl?.musicStyle || "",
            musicIntensity: tpl?.musicIntensity || "",
            sfx: "", ambience: "",
            motionDuration: tpl?.motionDuration || sceneDurationSec,
            imageTreatment: tpl?.imageTreatment || "Static",
            credits: tpl?.credits || 1, reason: "AI-expanded",
            characterIds: tpl?.characterIds || [],
            dialogueDensity: tpl?.dialogueDensity || "low",
            emotionalWeight: tpl?.emotionalWeight || "medium",
            location: es.location || tpl?.location || "",
            timeOfDay: es.timeOfDay || tpl?.timeOfDay || "",
            mood: es.mood || tpl?.mood || "",
            shots: [],
            audioPlan: tpl?.audioPlan || { narrationIntensity: "medium", musicMood: "", musicIntensity: "", sfxList: [], ambienceList: [], transitionAudio: "" },
            costEstimate: 0, status: "draft",
          } as HybridScene;
        });
      });
      setLastAction(`Scenes expanded: ${scenes.length} → ${data.scenes.length}`);
    } catch (err) {
      setUiError(`Expand error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setStoryExpandingScenes(false);
    }
  }

  // ── Per-scene AI Generate SFX — reads scene description and auto-plans SFX ──
  async function generateSceneSfx(scene: HybridScene) {
    if (generatingSceneSfx.has(scene.sceneId)) return;
    setGeneratingSceneSfx(prev => new Set(prev).add(scene.sceneId));
    setSceneSfxProgress(prev => ({ ...prev, [scene.sceneId]: "Planning SFX..." }));
    setLastAction(`Generating SFX for Scene ${scene.scene}...`);
    try {
      // Step 1: Use inline mode — pass scenes[] array as required by the API
      const res = await fetch("/api/hybrid/audio-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: [{
            sceneId: scene.sceneId,
            title: scene.title,
            description: scene.description,
            location: scene.location,
            mood: scene.mood,
            sceneType: scene.sceneType || "image-led",
          }],
        }),
      });
      const data = await res.json();
      const sfxList: string[] = data.audioPlans?.[0]?.sfxList || [];
      const ambienceList: string[] = data.audioPlans?.[0]?.ambienceList || scene.audioPlan.ambienceList;

      // Update the scene with planned SFX list regardless of audio gen
      updateScene(scene.scene, {
        audioPlan: { ...scene.audioPlan, sfxList, ambienceList },
      });

      if (sfxList.length === 0) {
        setLastAction(`No SFX detected for Scene ${scene.scene} — try adding more descriptive text`);
        return;
      }

      // Step 2: Generate audio for each SFX cue via /api/sfx/generate
      const audioUrls: string[] = [];
      for (let i = 0; i < sfxList.length; i++) {
        const sfxName = sfxList[i];
        setSceneSfxProgress(prev => ({ ...prev, [scene.sceneId]: `Generating SFX ${i + 1}/${sfxList.length}...` }));
        try {
          const sfxRes = await fetch("/api/sfx/generate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ description: sfxName }),
          });
          const sfxData = await sfxRes.json();
          const url = sfxData.fileUrl || sfxData.url;
          if (url) audioUrls.push(url);
        } catch {
          // skip failed SFX — continue with rest
        }
      }

      // Store generated audio URLs per scene
      if (audioUrls.length > 0) {
        setSceneSfxAudioUrls(prev => ({ ...prev, [scene.sceneId]: audioUrls }));
        // Also store first URL in legacy sceneSfxUrls for backward compat
        setSceneSfxUrls(prev => ({ ...prev, [scene.sceneId]: audioUrls[0] }));
      }

      setLastAction(`SFX ready for Scene ${scene.scene}: ${sfxList.slice(0, 3).join(", ")}${sfxList.length > 3 ? `... +${sfxList.length - 3} more` : ""}${audioUrls.length > 0 ? ` (${audioUrls.length} audio files)` : ""}`);
    } catch (err) {
      setLastAction(`SFX generation failed for Scene ${scene.scene}: ${err instanceof Error ? err.message : "error"}`);
    } finally {
      setGeneratingSceneSfx(prev => { const s = new Set(prev); s.delete(scene.sceneId); return s; });
      setSceneSfxProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
    }
  }

  // ── Scene Polish — improve description text via LLM ───────────────
  async function handlePolishScene(sceneId: string, currentText: string, action: "polish" | "upgrade" | "add-detail") {
    if (!currentText?.trim()) return;
    setPolishingScene(sceneId);
    try {
      const res = await fetch("/api/hybrid/scene-polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sceneId, currentText, action }),
      });
      const data = await safeJson<{ polishedText?: string; error?: string }>(res, "scene-polish");
      const polishedText = data.polishedText;
      if (polishedText) {
        let updatedScene: HybridScene | undefined;
        setScenes(prev => {
          const next = prev.map(s => s.sceneId === sceneId ? { ...s, description: polishedText } : s);
          updatedScene = next.find(s => s.sceneId === sceneId);
          return next;
        });
        setLastAction(`Scene ${sceneId}: polished — regenerating image...`);
        // Auto-regen image with polished description
        if (updatedScene) {
          await makeSceneImage({ ...updatedScene, description: polishedText });
        }
      } else if (data.error) {
        setLastAction(`Polish failed: ${data.error}`);
      }
    } catch (err) {
      console.error("[handlePolishScene] error:", err);
      setLastAction("Scene polish failed — check console");
    } finally {
      setPolishingScene(null);
    }
  }

  async function makeSceneVideo(scene: HybridScene, durationSecs?: number) {
    try { await requireGate(); } catch { return; }
    const existingImage = sceneImages[scene.sceneId];
    if (!existingImage) {
      setUiError(`Scene ${scene.scene} needs an image first. Click "Make Image" before making a video.`);
      return;
    }
    setGeneratingSceneVideos(prev => new Set(prev).add(scene.sceneId));
    setSceneGenProgress(prev => ({ ...prev, [scene.sceneId]: { percent: 2, message: "Connecting...", type: "video" } }));
    setLastAction(`Generating video for Scene ${scene.scene}...`);
    try {
      const response = await fetch("/api/hybrid/scene-video", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.sceneId, projectId,
          sceneText: `${scene.title}. ${scene.description}`,
          imageUrl: existingImage,
          duration: durationSecs ?? (() => {
            const perScene = sceneContinuousMotion[scene.sceneId];
            if (perScene?.enabled) return perScene.targetSec;
            if (continuousMotionEnabled) return 10;
            return scene.motionDuration ?? 5;
          })(),
          motionDescription: scene.shots[0]?.cameraMovement || "",
          modelId: effectiveVideoModelId !== "segmind_pruna_video" ? effectiveVideoModelId : undefined,
          seed: genSeed !== null ? genSeed : undefined,
          projectStyle: effectiveProjectStyle,
        }),
      });

      if (!response.body) throw new Error("No response stream from server");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6)) as Record<string, unknown>;
            if (evt.type === "progress") {
              setSceneGenProgress(prev => ({
                ...prev,
                [scene.sceneId]: { percent: evt.percent as number, message: evt.message as string, type: "video" },
              }));
            } else if (evt.type === "done") {
              const videoUrl = evt.videoUrl as string;
              setSceneGenProgress(prev => ({ ...prev, [scene.sceneId]: { percent: 100, message: "Done!", type: "video" } }));
              setTimeout(() => setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; }), 2000);
              setSceneVideoVersions(prev => ({
                ...prev, [scene.sceneId]: [...(prev[scene.sceneId] || []), videoUrl],
              }));
              setSceneVideos(prev => ({ ...prev, [scene.sceneId]: videoUrl }));
              updateScene(scene.scene, { status: "generated" as const });
              setLastAction(`Scene ${scene.scene} video ready — click ▶ to preview`);
            } else if (evt.type === "error") {
              setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
              setUiError(`Video failed: ${evt.message as string}`);
            }
          } catch { /* skip malformed lines */ }
        }
      }
    } catch (err) {
      setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
      console.error("makeSceneVideo failed:", err);
      setUiError(`Video generation failed for Scene ${scene.scene}.`);
    }
    setGeneratingSceneVideos(prev => { const s = new Set(prev); s.delete(scene.sceneId); return s; });
  }

  // ── Script parser — splits story into narrator + dialogue segments ──────────
  async function parseScript() {
    setParsingScript(true);
    // Collapse the review panel while parsing so user sees work is happening on re-parse
    setShowScriptReview(false);
    setLastAction("Parsing script…");
    try {
      const sortedScenes = scenes.slice().sort((a, b) => a.scene - b.scene);
      const sceneTexts = sortedScenes.map(s => (s.narrationScript || s.description || "").trim());
      const scenesWithContent = sceneTexts.filter(t => t.length > 5).length;

      // Path A: scenes have per-scene narrationScript AND user is on first parse (no existing segments).
      // On re-parse, always use LLM (Path B) so story text edits are respected.
      const isReparsing = scriptSegments.length > 0;
      if (scenesWithContent >= 2 && !isReparsing) {
        const sceneSegments: ScriptSegment[] = sortedScenes
          .map((s, i) => ({
            id: `seg_scene_${s.sceneId}`,
            type: "narration" as const,
            speaker: "narrator",
            text: sceneTexts[i],
            lineIndex: i,
            sceneId: s.sceneId,
          }))
          .filter(seg => seg.text.length > 0);
        setScriptSegments(sceneSegments);
        setStoryMode("narration-only");
        setShowScriptReview(true);
        setLastAction(`Script parsed — ${sceneSegments.length} segments from ${sortedScenes.length} scenes`);
        setParsingScript(false);
        return;
      }

      // Path B: LLM parse — used on first parse when no scenes, AND always on re-parse
      // so story text edits are picked up even after scenes were generated.
      const textToParse = fullScript || expandedSummary || idea;
      if (!textToParse.trim()) {
        setUiError("Write or expand your story first.");
        setParsingScript(false);
        return;
      }
      setLastAction("AI is reading your story and splitting narrator / character dialogue...");
      const res = await fetch("/api/hybrid/parse-script", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storyText: textToParse,
          knownCharacters: characters.map(c => c.displayName),
        }),
      });
      const data = await res.json();
      if (data.ok && data.segments) {
        // Enrich segments with characterId by matching speaker name to character list
        const enriched = (data.segments as ScriptSegment[]).map(seg => {
          if (seg.type === "dialogue" && seg.speaker && seg.speaker !== "narrator") {
            const match = characters.find(c =>
              c.displayName.toLowerCase() === seg.speaker.toLowerCase() ||
              c.characterId.toLowerCase() === seg.speaker.toLowerCase() ||
              seg.speaker.toLowerCase().includes(c.displayName.toLowerCase().split(" ")[0])
            );
            return { ...seg, characterId: match?.characterId };
          }
          return seg;
        });
        setScriptSegments(enriched);
        setStoryMode(data.storyMode || "mixed");
        setShowScriptReview(true);
        setLastAction(`Script parsed — ${data.segments.length} segments (${data.storyMode})`);
      } else {
        setUiError(data.error || "Script parsing failed");
      }
    } catch (err) { setUiError("Script parse error: " + String(err)); }
    setParsingScript(false);
  }

  // ── Narrator audio generation — routes to the selected provider ─────────────
  async function generateNarrationPiper() {
    // Build narration text from all scenes' narrationScript (authoritative — updated by QC and editing).
    // This covers ALL scenes even when scriptSegments only parsed 1 scene.
    // BUG-16a: exclude dialogue segments — dialogue is handled by character voices separately.
    const allScenesNarration = scenes
      .slice().sort((a, b) => a.scene - b.scene)
      .map(s => s.narrationScript || s.description || "")
      .filter(Boolean)
      .join(" ");
    const narratorSegments = scriptSegments.filter(s => s.type === "narration");
    const parsedNarrationText = narratorSegments.map(s => s.text).join(" ");
    const narrationText = allScenesNarration.trim()
      ? allScenesNarration
      : parsedNarrationText.trim()
        ? parsedNarrationText
        : (fullScript || expandedSummary || idea);

    if (!narrationText.trim()) { setUiError("No narration text found. Parse your script first."); return; }
    if (narratorVoice === "none") { setUiError("Narration is set to Off. Select a tier to enable."); return; }
    setGeneratingNarration(true);
    setPiperDownloading(false);

    // FAL Narrator, FAL Pro, ElevenLabs, Edge-TTS, and Kie-Suno go directly to /api/tts with the provider field
    if (narratorVoice === "fal-narrator" || narratorVoice === "fal-narrator-gemini" || narratorVoice === "elevenlabs" || narratorVoice === "kie-suno" || narratorVoice === "edge-tts") {
      const providerLabel = narratorVoice === "fal-narrator" ? "FAL Standard" : narratorVoice === "fal-narrator-gemini" ? "FAL Pro" : narratorVoice === "kie-suno" ? "GHS Premium (Kie Suno)" : narratorVoice === "edge-tts" ? "Edge Neural (free)" : "ElevenLabs";
      setLastAction(`Generating narrator audio via ${providerLabel}...`);
      try {
        const res = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: narrationText,
            provider: narratorVoice,
            speed: narratorPiperSpeed,
            // Edge-TTS regional voice from the sub-picker (free-mode parity)
            voiceId: narratorVoice === "edge-tts" ? edgeTtsVoiceId : undefined,
          }),
        });
        const data = await res.json();
        if (data.audioUrl) {
          setNarratorAudioUrl(data.audioUrl);
          setLastAction(`Narrator audio ready via ${data.engine || narratorVoice}`);
          // Measure duration so assembly clock is correct (these providers don't return durationMs)
          try {
            const dur = await new Promise<number>((resolve) => {
              const a = new Audio(data.audioUrl);
              a.onloadedmetadata = () => resolve(Math.round(a.duration * 1000));
              a.onerror = () => resolve(0);
              setTimeout(() => resolve(0), 8000);
            });
            if (dur > 0) setNarratorAudioDuration(dur);
          } catch { /* ignore — server-side ffprobe fallback handles this */ }
        } else {
          setUiError(data.error || `${narratorVoice} narration failed`);
        }
      } catch (err) { setUiError("Narration error: " + String(err)); }
      setGeneratingNarration(false);
      return;
    }

    // Piper / Karaoke (default) — uses existing narrate-piper endpoint
    setLastAction("Generating narrator audio...");
    try {
      const res = await fetch("/api/hybrid/narrate-piper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: narrationText,
          model: narratorPiperModel,
          speed: narratorPiperSpeed,
          voiceProvider: narratorVoice,
          provider: narratorVoice,
          soundTier: effectiveSoundTier,
          outputName: `narration_${projectId || "draft"}_${Date.now()}`,
        }),
      });
      const data = await res.json();
      if (data.piperNotInstalled) {
        setPiperNotInstalled(true);
        setUiError("Piper binary not installed. See link below.");
      } else if (data.modelNotFound) {
        setUiError(data.error || `Model "${narratorPiperModel}" could not be downloaded. Check internet or HF_TOKEN.`);
      } else if (data.ok && data.audioUrl) {
        setNarratorAudioUrl(data.audioUrl);
        setNarratorAudioDuration(data.durationMs || 0);
        setLastAction(`Narrator audio ready — ${Math.round((data.durationMs || 0) / 1000)}s`);
      } else {
        setUiError(data.error || "Piper narration failed");
      }
    } catch (err) { setUiError("Narration error: " + String(err)); }
    setGeneratingNarration(false);
  }

  // ── Generate per-character dialogue audio with their assigned Piper voice ──
  async function generateCharacterVoices() {
    if (characters.length === 0) {
      setUiError("No characters found. Add characters first.");
      return;
    }

    // ── Build text per character — 4-tier fallback ──
    // Tier 1: matched dialogue segments (ideal — uses speaker name / characterId)
    // Tier 2: unmatched dialogue distributed evenly
    // Tier 3: narration sentences split per character
    // Tier 4: character description or display name as voice sample

    const segForChar = (char: typeof characters[0]) =>
      scriptSegments.filter(s =>
        s.type === "dialogue" && (
          s.characterId === char.characterId ||
          s.speaker?.toLowerCase() === char.displayName.toLowerCase() ||
          s.speaker?.toLowerCase().includes(char.displayName.toLowerCase().split(" ")[0].toLowerCase()) ||
          char.displayName.toLowerCase().includes((s.speaker || "").toLowerCase().split(" ")[0])
        )
      );

    const charsWithDialogue = characters.filter(c => segForChar(c).length > 0);
    const allDialogueSegs = scriptSegments.filter(s => s.type === "dialogue");
    const allNarrSegs = scriptSegments.filter(s => s.type === "narration");
    // Full story text for splitting when no parsed script exists
    const storyText = fullScript || expandedSummary || idea || "";
    const storyWords = storyText.split(/\s+/).filter(Boolean);

    // Build per-character text map
    const charTextMap: Record<string, string> = {};

    if (charsWithDialogue.length > 0) {
      // Tier 1: matched dialogue
      for (const char of characters) {
        const lines = segForChar(char).map(s => s.text).join(" ").trim();
        charTextMap[char.characterId] = lines || char.emotionProfile || `My name is ${char.displayName}.`;
      }
    } else if (allDialogueSegs.length > 0) {
      // Tier 2: unmatched dialogue split evenly
      const chunkSize = Math.ceil(allDialogueSegs.length / Math.max(characters.length, 1));
      for (let i = 0; i < characters.length; i++) {
        const chunk = allDialogueSegs.slice(i * chunkSize, (i + 1) * chunkSize).map(s => s.text).join(" ").trim();
        charTextMap[characters[i].characterId] = chunk || characters[i].emotionProfile || `My name is ${characters[i].displayName}.`;
      }
    } else if (allNarrSegs.length > 0) {
      // Tier 3: narration sentences split among characters
      const chunkSize = Math.ceil(allNarrSegs.length / Math.max(characters.length, 1));
      for (let i = 0; i < characters.length; i++) {
        const chunk = allNarrSegs.slice(i * chunkSize, (i + 1) * chunkSize).map(s => s.text).join(" ").trim();
        charTextMap[characters[i].characterId] = chunk || `My name is ${characters[i].displayName}.`;
      }
    } else if (storyWords.length > 0) {
      // Tier 4: split raw story text among characters
      const chunkSize = Math.ceil(storyWords.length / Math.max(characters.length, 1));
      for (let i = 0; i < characters.length; i++) {
        const chunk = storyWords.slice(i * chunkSize, (i + 1) * chunkSize).join(" ").trim();
        charTextMap[characters[i].characterId] = chunk || `My name is ${characters[i].displayName}.`;
      }
    } else {
      // Ultimate fallback: generate voice sample with character name
      for (const char of characters) {
        charTextMap[char.characterId] = char.emotionProfile || `My name is ${char.displayName}. I am ready.`;
      }
    }

    setGeneratingCharVoices(true);
    setCharVoiceLog("");
    const newUrls: Record<string, string> = { ...characterAudioUrls };
    // Generate voice for EVERY character using charTextMap
    for (const char of characters) {
      const text = charTextMap[char.characterId];
      if (!text?.trim()) continue;
      const piperModel = characterPiperVoices[char.characterId] || "en_US-lessac-medium";
      setCharVoiceLog(`Generating voice for ${char.displayName} (${piperModel})...`);
      try {
        const res = await fetch("/api/hybrid/narrate-piper", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text,
            model: piperModel,
            speed: narratorPiperSpeed,
            outputName: `char_${char.characterId}_${projectId || "draft"}_${Date.now()}`,
          }),
        });
        const data = await res.json();
        if (data.ok && data.audioUrl) {
          newUrls[char.characterId] = data.audioUrl;
          setCharVoiceLog(`${char.displayName} done`);
        } else {
          setCharVoiceLog(`[!] ${char.displayName}: ${data.error || "failed"}`);
        }
      } catch (err) {
        setCharVoiceLog(`[!] ${char.displayName}: ${String(err)}`);
      }
    }
    setCharacterAudioUrls(newUrls);
    const doneCount = Object.keys(newUrls).filter(id => !characterAudioUrls[id]).length + Object.keys(characterAudioUrls).length;
    setCharVoiceLog(`Actor voices ready — ${Object.keys(newUrls).length} character${Object.keys(newUrls).length !== 1 ? "s" : ""}`);
    setGeneratingCharVoices(false);
  }

  // ── Estimate segment start times from character-count proxy ──────────────
  // ~13 chars/sec at Piper speed 0.75; scales linearly with speed setting.
  // Only narration segments advance the narrator clock — dialogue slots are
  // silent gaps in the narrator audio that character clips fill.
  // buildTimings: uses actual durationMs when measured; falls back to text-length estimate.
  // Replaces old estimateSegmentTimings().
  function buildTimings(segments: ScriptSegment[], piperSpeed: number): number[] {
    const charsPerSec = 13 * (piperSpeed / 0.75);
    const startTimes: number[] = [];
    let elapsed = 0;
    for (const seg of segments) {
      startTimes.push(elapsed);
      const durSec = seg.durationMs
        ? seg.durationMs / 1000
        : seg.text.length / charsPerSec;
      elapsed += durSec + (seg.type === "narration" ? 0.3 : 0.2);
    }
    return startTimes;
  }
  // Keep alias so external call sites in assembleScenes / runAutoTimestamp still compile
  // (they're updated below, but alias guards against any missed reference)
  const estimateSegmentTimings = buildTimings;

  // ── Generate per-line dialogue audio (one clip per dialogue segment) ──────
  // Falls back to generateCharacterVoices() if no parsed dialogue segments exist.
  async function generatePerLineVoices() {
    const dialogueSegs = scriptSegments
      .map((s, i) => ({ ...s, idx: i }))
      .filter(s => s.type === "dialogue" && s.text.trim());

    if (dialogueSegs.length === 0) {
      await generateCharacterVoices();
      return;
    }

    setGeneratingCharVoices(true);
    setCharVoiceLog("");
    const updatedSegments = [...scriptSegments];
    const timings = buildTimings(scriptSegments, narratorPiperSpeed);

    for (const seg of dialogueSegs) {
      const char = characters.find(c =>
        c.characterId === seg.characterId ||
        c.displayName.toLowerCase() === (seg.speaker || "").toLowerCase() ||
        c.displayName.toLowerCase().includes((seg.speaker || "").toLowerCase().split(" ")[0])
      );
      const piperModel = char
        ? (characterPiperVoices[char.characterId] || "en_US-lessac-medium")
        : "en_US-lessac-medium";

      setCharVoiceLog(`Generating line ${seg.idx + 1}/${scriptSegments.length}: "${seg.text.slice(0, 40)}…"`);
      try {
        const res = await fetch("/api/hybrid/narrate-piper", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: seg.text,
            model: piperModel,
            speed: narratorPiperSpeed,
            outputName: `line_${seg.idx}_${char?.characterId || "unknown"}_${projectId || "draft"}_${Date.now()}`,
          }),
        });
        const data = await res.json();
        if (data.ok && data.audioUrl) {
          updatedSegments[seg.idx] = {
            ...updatedSegments[seg.idx],
            audioUrl: data.audioUrl,
            durationMs: data.durationMs ?? null,
            estimatedStartMs: Math.round(timings[seg.idx] * 1000),
          };
          setCharVoiceLog(`Line ${seg.idx + 1} done`);
        } else {
          setCharVoiceLog(`[!] Line ${seg.idx + 1}: ${data.error || "failed"}`);
        }
      } catch (err) {
        setCharVoiceLog(`[!] Line ${seg.idx + 1}: ${String(err)}`);
      }
    }

    setScriptSegments(updatedSegments);
    const doneCount = updatedSegments.filter(s => s.audioUrl).length;
    setCharVoiceLog(`Per-line audio ready — ${doneCount} clip${doneCount !== 1 ? "s" : ""}`);
    setGeneratingCharVoices(false);
  }

  // ── Freesound search ──────────────────────────────────────────────────────
  async function searchFreesound(q?: string) {
    const query = q ?? fsQuery;
    if (!query.trim()) return;
    setFsSearching(true);
    setFsResults([]);
    try {
      const res = await fetch(`/api/sfx/freesound?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (data.noKey) { setFsNoKey(true); return; }
      setFsNoKey(false);
      setFsResults(data.results || []);
    } catch { setUiError("Freesound search failed"); }
    finally { setFsSearching(false); }
  }

  async function saveFreesound(sound: { id: number; name: string; previewUrl: string; license: string; username: string; duration: number; tags: string[] }) {
    setFsSaving(sound.id);
    try {
      const res = await fetch("/api/sfx/freesound", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sound),
      });
      const data = await res.json();
      if (data.ok) { setFsSaved(prev => new Set([...prev, sound.id])); setLastAction(`"${sound.name}" saved to SFX library`); }
      else setUiError(data.error || "Save failed");
    } catch { setUiError("Save failed"); }
    finally { setFsSaving(null); }
  }

  async function generateElevenLabsSfx() {
    if (!sfxDesc.trim()) return;
    setSfxGenerating(true);
    setSfxGeneratedUrl(null);
    try {
      const res = await fetch("/api/sfx/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: sfxDesc.trim() }),
      });
      const data = await res.json();
      if (data.fileUrl) { setSfxGeneratedUrl(data.fileUrl); setLastAction(`SFX generated: "${sfxDesc.slice(0, 30)}"`); }
      else setUiError(data.error || "SFX generation failed");
    } catch { setUiError("SFX generation failed"); }
    finally { setSfxGenerating(false); }
  }

  // ── Auto SFX — generate SFX for each scene from its description ───────────
  const autoSfxAbortRef = useRef<AbortController | null>(null);

  async function runAutoSfxForAllScenes() {
    if (scenes.length === 0) { setUiError("No scenes yet — create scenes first."); return; }
    const ctrl = new AbortController();
    autoSfxAbortRef.current = ctrl;
    setAutoSfxRunning(true);
    setAutoSfxProgress(null);
    setLastAction(`Auto SFX: generating for ${scenes.length} scene${scenes.length !== 1 ? "s" : ""}...`);
    const results: Record<string, string> = {};
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      if (ctrl.signal.aborted) break;
      setAutoSfxProgress({ current: i + 1, total: scenes.length, sceneId: scene.sceneId });
      try {
        const prompt = scene.description || scene.title || `scene ${scene.scene}`;
        const res = await fetch("/api/sfx/generate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description: prompt.slice(0, 200), mode: "auto", autoSfx: true }),
          signal: AbortSignal.any([ctrl.signal, AbortSignal.timeout(20000)]),
        });
        const data = await res.json();
        if (data.fileUrl) {
          results[scene.sceneId] = data.fileUrl;
          setLastAction(`Auto SFX: scene ${scene.sceneId} done (${Object.keys(results).length}/${scenes.length})`);
        }
      } catch (e) {
        if ((e as Error).name === "AbortError") break;
        // skip scene on timeout or error
      }
    }
    setSceneSfxUrls(prev => ({ ...prev, ...results }));
    setAutoSfxProgress(null);
    setLastAction(`Auto SFX ${ctrl.signal.aborted ? "cancelled" : "complete"} — ${Object.keys(results).length}/${scenes.length} scenes`);
    setAutoSfxRunning(false);
    autoSfxAbortRef.current = null;
  }

  function cancelAutoSfx() {
    autoSfxAbortRef.current?.abort();
  }

  // ── Continuous Motion — generate a multi-segment chained action video ──────
  async function startContinuousMotion() {
    const prompt = expandedSummary || idea;
    if (!prompt.trim()) { setCmError("Write a story first — Continuous Motion needs a prompt."); return; }
    setCmRunning(true); setCmStatus("Submitting plan..."); setCmError(null); setCmFinalVideoUrl(null); setCmSceneId(null);

    try {
      const res = await fetch("/api/continuous-motion/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: prompt.trim(),
          totalDuration: cmTotalDuration,
          segmentDuration: Math.min(cmSegmentDuration, 10),
          providerKey: cmProvider,
          projectId: projectId || "hybrid_draft",
        }),
      });
      const data = await res.json() as { sceneId?: string; status?: string; finalVideoUrl?: string; error?: string };
      if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);

      const sid = data.sceneId ?? "";
      setCmSceneId(sid);
      setCmStatus(data.status ?? "GENERATING");

      // If already done (synchronous completion), finish immediately
      if (data.status === "COMPLETE" || data.status === "DONE") {
        setCmFinalVideoUrl(data.finalVideoUrl ?? null);
        setCmStatus("DONE");
        setCmRunning(false);
        return;
      }

      // Poll until DONE or FAILED
      if (sid) {
        const poll = setInterval(async () => {
          try {
            const pr = await fetch(`/api/continuous-motion/scene/${sid}`);
            const pd = await pr.json() as { status?: string; finalVideoUrl?: string };
            setCmStatus(pd.status ?? "…");
            if (pd.status === "COMPLETE" || pd.status === "DONE") {
              clearInterval(poll);
              setCmFinalVideoUrl(pd.finalVideoUrl ?? data.finalVideoUrl ?? null);
              setCmStatus("DONE");
              setCmRunning(false);
            } else if (pd.status === "FAILED") {
              clearInterval(poll);
              setCmError("Generation failed. Check logs.");
              setCmRunning(false);
            }
          } catch { /* poll error — keep trying */ }
        }, 3000);
      } else {
        // No sceneId returned — treat as plan-only (no FAL_KEY)
        setCmStatus(data.status ?? "PLANNING");
        setCmRunning(false);
      }
    } catch (err) {
      setCmError(err instanceof Error ? err.message : "Continuous Motion failed");
      setCmRunning(false);
    }
  }

  function useContinuousMotionVideo() {
    if (!cmFinalVideoUrl) return;
    // Save to assembly — find or create a scene slot for the CM video
    const cmSceneKey = "SC_CONTINUOUS";
    setSceneVideos(prev => ({ ...prev, [cmSceneKey]: cmFinalVideoUrl! }));
    setLastAction("Continuous Motion video added to assembly");
  }

  async function generateAudioPlans() {
    setLoadingAudioPlan(true);
    setLastAction("AI is planning SFX, ambience and music for every scene...");
    try {
      // Send scene sfx/ambience hints so LLM has context even if intelligence ran first
      const scenesPayload = scenes.map(s => ({
        sceneId: s.sceneId,
        title: s.title,
        description: s.description,
        location: s.location,
        mood: s.mood,
        sceneType: s.sceneType,
        existingSfxHint: s.sfx || "",
        existingAmbienceHint: s.ambience || "",
      }));
      const res = await fetch("/api/hybrid/audio-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenes: scenesPayload, characters, storyContext: expandedSummary || idea }),
      });
      const data = await res.json();
      setScenes(prev => prev.map(s => {
        const idx = scenes.findIndex(t => t.sceneId === s.sceneId);
        if (idx < 0) return s;
        const plan = data.audioPlans?.[idx];
        if (plan) return { ...s, audioPlan: plan };
        // Fallback: build audioPlan from scene.sfx string if API returned nothing
        const sfxFallback = s.sfx ? s.sfx.split(",").map(x => x.trim()).filter(Boolean) : (s.audioPlan?.sfxList ?? []);
        const ambFallback = s.ambience ? s.ambience.split(",").map(x => x.trim()).filter(Boolean) : (s.audioPlan?.ambienceList ?? []);
        return { ...s, audioPlan: { ...(s.audioPlan ?? {}), sfxList: sfxFallback, ambienceList: ambFallback } };
      }));
      setLastAction("Audio plans ready — SFX and ambience assigned to all scenes");
    } catch (err) {
      console.error("generateAudioPlans failed:", err);
      // Even on error: use scene.sfx strings as fallback so cards show something
      setScenes(prev => prev.map(s => {
        const sfxFallback = s.sfx ? s.sfx.split(",").map(x => x.trim()).filter(Boolean) : (s.audioPlan?.sfxList ?? []);
        const ambFallback = s.ambience ? s.ambience.split(",").map(x => x.trim()).filter(Boolean) : (s.audioPlan?.ambienceList ?? []);
        if (!sfxFallback.length && !ambFallback.length) return s;
        return { ...s, audioPlan: { ...s.audioPlan, sfxList: sfxFallback, ambienceList: ambFallback } };
      }));
      setUiError("AI audio plan failed — using scene intelligence data instead");
    }
    setLoadingAudioPlan(false);
  }

  async function runAutoTimestamp() {
    setLoadingAutoTimestamp(true);
    setLastAction("Auto Time Stamp: building timing plan...");
    try {
      const scriptText = fullScript || expandedSummary || idea;
      const sceneTexts = scenes.map(s => `${s.title}: ${s.description}`);
      const totalDur = scenes.reduce((sum, s) => {
        const shots = s.shots ?? [];
        return sum + (shots.length > 0 ? shots.reduce((a: number, sh: ShotObject) => a + (sh.plannedDuration || 5), 0) : 10);
      }, 0) || 60;

      const res = await fetch("/api/timeline/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          script: scriptText,
          scenes: sceneTexts.length > 0 ? sceneTexts : undefined,
          mode: "hybrid",
          targetDuration: totalDur,
          enrichWithAi: !!process.env.NEXT_PUBLIC_TIMESTAMP_AI_ENRICH,
        }),
      });
      const data = await res.json();
      if (data.plan) {
        setAutoTimestampPlan(data.plan);
        setLastAction(`Auto Time Stamp: ${data.plan.segmentCount} segments, ${data.plan.totalDuration.toFixed(1)}s total`);
      } else {
        setUiError(data.error || "Auto Time Stamp failed");
      }
    } catch (err) {
      console.error("autoTimestamp failed:", err);
      setUiError("Auto Time Stamp failed. Check console.");
    }
    setLoadingAutoTimestamp(false);
  }

  async function generateShotPlans() {
    setLoadingShotPlan(true);
    setLastAction("Generating shot plans...");
    try {
      const res = await fetch("/api/hybrid/shot-plan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenes, characters }) });
      const data = await res.json();
      if (data.shotPlans?.length > 0) setScenes(prev => prev.map((s, i) => ({ ...s, shots: data.shotPlans[i]?.shots || s.shots })));
      setLastAction("Shot plans generated");
    } catch (err) { console.error("generateShotPlans failed:", err); setUiError("Shot plan generation failed. Please try again."); }
    setLoadingShotPlan(false);
  }

  async function runValidation() {
    setValidating(true);
    try {
      const res = await fetch("/api/hybrid/validate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scenes, characters }) });
      const data = await res.json();
      setValidation({ valid: data.valid ?? true, errors: data.errors || [], warnings: data.warnings || [] });
    } catch {
      const errors: string[] = []; const warns: string[] = [];
      scenes.forEach(s => { if (!s.title) errors.push(`Scene ${s.scene}: Missing title`); if ((s.characterIds?.length ?? 0) === 0) warns.push(`Scene ${s.scene}: No characters`); });
      if (characters.length === 0) errors.push("No characters");
      setValidation({ valid: errors.length === 0, errors, warnings: warns });
    }
    setValidating(false);
  }

  async function assembleScenes() {
    // Guard: check actual state — coordinator store is never marked complete by this planner
    const storyReady = !!(fullScript || expandedSummary || idea?.trim());
    if (!storyReady) { setUiError("Write your story first before assembling."); return; }
    if (selectedSceneIds.length === 0) { setUiError("Select at least one scene to assemble."); return; }
    try { await requireGate(); } catch { return; }
    setAssembling(true); setAssemblyComplete(false); setAssembledVideoUrl(null); setUiError(null);
    const progress: Record<number, string> = {};
    scenes.forEach(s => { progress[s.scene] = "queued"; }); setAssemblyProgress({ ...progress });
    try {
      // ── AUTO-PIPELINE: parse → character voices → narration → assemble ──
      // If parse hasn't run yet, run it now
      const storyText = fullScript || expandedSummary || idea;
      if (scriptSegments.length === 0 && storyText.trim()) {
        setLastAction("Auto-running: parsing script before assembly…");
        await parseScript();
        await new Promise(r => setTimeout(r, 400));
      }

      // If characters have no voice audio and story has dialogue, auto-generate per-line clips
      const hasPerLineAudio = scriptSegments.some(s => s.type === "dialogue" && s.audioUrl);
      const hasCharVoices = Object.keys(characterAudioUrls).length > 0;
      const hasDialogue = scriptSegments.some(s => s.type === "dialogue") || storyMode === "mixed" || storyMode === "actors-only";
      if (!hasPerLineAudio && !hasCharVoices && characters.length > 0 && hasDialogue && actorVoicesEnabled) {
        setLastAction("Auto-running: generating per-line character voices before assembly…");
        await generatePerLineVoices();
        await new Promise(r => setTimeout(r, 400));
      }

      // If narrator audio is missing, stop with a clear message instead of auto-generating.
      // Auto-generation adds 30–120s to assembly time and hides the root cause.
      // User should generate narrator voice from the Audio tab (Step 5) first.
      if (!narratorAudioUrl) {
        const narrationText = fullScript || expandedSummary
          || (scriptSegments.length > 0 ? scriptSegments.map(s => s.text).join(" ") : idea);
        if (narrationText.trim()) {
          // Try auto-generate ONLY if we have no narration at all and there's story text
          // Check DB for narratorAudioUrl in case React state hasn't hydrated yet
          let dbNarrUrl: string | null = null;
          try {
            const dbRes = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(activeProjLocalId)}`);
            if (dbRes.ok) {
              const dbData = await dbRes.json();
              if (dbData.found && dbData.data?.narratorAudioUrl) dbNarrUrl = dbData.data.narratorAudioUrl;
            }
          } catch { /* ignore */ }
          if (dbNarrUrl) {
            // DB has the URL but React state hasn't hydrated yet — use it directly
            setNarratorAudioUrl(dbNarrUrl);
            await new Promise(r => setTimeout(r, 200));
          } else {
            // Truly no narration — auto-generate
            setLastAction("Generating narrator voice before assembly…");
            await generateNarrationPiper();
            await new Promise(r => setTimeout(r, 400));
          }
        }
      }

      // ── Guard: verify narrator audio file exists before assembly ──
      // Only clear on definitive 404 — don't clear on network errors (server may just be slow).
      if (narratorAudioUrl) {
        try {
          const headRes = await fetch(narratorAudioUrl, { method: "HEAD" });
          if (headRes.status === 404) {
            setNarratorAudioUrl(null);
            setNarratorAudioDuration(0);
            console.warn("[assemble] Narrator audio file not found (404) — cleared before assembly");
          }
        } catch {
          // Network error — keep URL, let assembly try it
          console.warn("[assemble] Narrator audio HEAD check failed — keeping URL, assembly will try it");
        }
      }
      // ── Recover narrator duration if React state was lost after page refresh ──
      // narratorAudioDuration is not persisted — after refresh it resets to 0.
      // Without this, totalDuration = sceneBaseDuration (tiny motionDuration → 4s), cutting all audio.
      let effectiveNarrDurMs = narratorAudioDuration;
      if (narratorAudioUrl && effectiveNarrDurMs === 0) {
        try {
          effectiveNarrDurMs = await new Promise<number>((resolve) => {
            const audio = new Audio(narratorAudioUrl);
            audio.onloadedmetadata = () => resolve(Math.round(audio.duration * 1000));
            audio.onerror = () => resolve(0);
            setTimeout(() => resolve(0), 8000);
          });
          if (effectiveNarrDurMs > 0) {
            setNarratorAudioDuration(effectiveNarrDurMs);
            console.log(`[assemble] Recovered narrator duration after refresh: ${effectiveNarrDurMs}ms`);
          }
        } catch { /* ignore */ }
      }

      // Mark all scenes as processing then done for visual feedback
      for (const s of scenes) {
        progress[s.scene] = "processing"; setAssemblyProgress({ ...progress });
        // Small delay for visual feedback
        await new Promise(r => setTimeout(r, 200));
        progress[s.scene] = "done"; setAssemblyProgress({ ...progress });
      }

      // Collect all scene sources and call the main assemble endpoint
      // Priority: Wan video (action) → still image (narration slide) → fallback gradient
      // Each scene gets its narration script as the text overlay (screen wrap text)
      // Only assemble the scenes the user has checked — no fallback to "all scenes"
      const scenesToAssemble = assemblyOrder.length > 0
        ? assemblyOrder.map(id => scenes.find(s => s.sceneId === id)).filter(id => id && selectedSceneIds.includes(id.sceneId)).filter(Boolean) as typeof scenes
        : scenes.filter(s => selectedSceneIds.includes(s.sceneId));

      const assembleSceneList = scenesToAssemble.map((s, i) => {
        const videoUrl = sceneVideos[s.sceneId];   // generated video
        // BUG-16c: resolve imageUrl from runtime state (sceneImages is the authoritative store)
        const imageUrl = sceneImages[s.sceneId] ?? null;
        const modeOverride = sceneModeOverrides[s.sceneId]; // user's explicit choice

        // Decide what to use: explicit override > auto (video preferred if available)
        // BUG-16c: when scene has imageUrl and no videoUrl, use image mode (not gradient)
        let mediaUrl: string;
        if (modeOverride === "image") {
          mediaUrl = imageUrl ? `img:${imageUrl}` : (videoUrl || `bg:linear-gradient(135deg,#a855f720,#0a0d14)`);
        } else if (modeOverride === "video") {
          mediaUrl = videoUrl || (imageUrl ? `img:${imageUrl}` : `bg:linear-gradient(135deg,#a855f720,#0a0d14)`);
        } else {
          // Auto: prefer video, fall back to image, last resort gradient
          mediaUrl = videoUrl || (imageUrl ? `img:${imageUrl}` : `bg:linear-gradient(135deg,#a855f720,#0a0d14)`);
        }

        // Derive effective mode for downstream payload
        const effectiveMode = (modeOverride === "image" || (!videoUrl && imageUrl))
          ? "image"
          : (videoUrl ? "video" : "image");

        // scene media resolved

        // BUG-16b: subtitle source = full scene narration script, NOT first-N-sentences truncation.
        // Truncation cut subtitles to 1-2 sentences; use fullScript / full narrationScript instead.
        const rawText = s.narrationScript || fullScript || s.description || s.title || "";
        const overlayText = rawText.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim();

        return {
          scene: i + 1,
          sceneId: s.sceneId,               // REQUIRED: beat images, proportional duration, script matching
          videoUrl: mediaUrl,
          imageUrl: imageUrl ?? undefined,
          mode: effectiveMode,
          duration: s.motionDuration || 5,
          motionDuration: s.motionDuration,
          narrationScript: s.narrationScript || "",
          description: s.description || "",
          title: s.title || "",
          flipOverride: s.flipOverride ?? null,
          text: overlayText,
          animation: "none" as const,
        };
      });

      // ── Generate intro / outro cards ──
      const cardPayload = {
        title: projectTitle,
        author: screenplayAuthor,
        studio: "Andio Studio",
        ideaFrom,
        genre,
        tone,
        style: introOutroStyle,
        cast: characters.slice(0, 10).map(c => ({ name: c.displayName, species: c.species, roleType: c.roleType })),
      };

      let introScene = null;
      let outroScene = null;

      if (introEnabled || outroEnabled) {
        setGeneratingCards(true);
      }

      if (introEnabled) {
        try {
          // Use pre-generated introUrl if available; otherwise generate on-the-fly
          let imageUrl = introUrl;
          if (!imageUrl) {
            const r = await fetch("/api/hybrid/generate-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cardPayload, type: "intro" }) });
            const d = await r.json();
            if (d.ok && d.imageUrl) imageUrl = d.imageUrl;
          }
          if (imageUrl) {
            introScene = { scene: 0, videoUrl: `img:${imageUrl}`, duration: 5, text: "", animation: "fade_in" as const };
          }
        } catch { /* best effort */ }
      }

      if (outroEnabled) {
        try {
          // Use pre-generated outroUrl if available; otherwise generate on-the-fly
          let imageUrl = outroUrl;
          if (!imageUrl) {
            const r = await fetch("/api/hybrid/generate-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cardPayload, type: "outro" }) });
            const d = await r.json();
            if (d.ok && d.imageUrl) imageUrl = d.imageUrl;
          }
          if (imageUrl) {
            outroScene = { scene: 999, videoUrl: `img:${imageUrl}`, duration: 10, text: "", animation: "fade_in" as const };
          }
        } catch { /* best effort */ }
      }

      setGeneratingCards(false);

      // Build final scene list: [intro?] + main scenes (renumbered) + [outro?]
      const finalSceneList = [
        ...(introScene ? [introScene] : []),
        ...assembleSceneList.map((s, i) => ({ ...s, scene: i + 1 + (introScene ? 1 : 0) })),
        ...(outroScene ? [{ ...outroScene, scene: assembleSceneList.length + (introScene ? 2 : 1) }] : []),
      ];

      // ── Prepend establishing shots before their scene ──
      // Each scene with a generated establishing shot imageUrl gets a short image segment inserted before it.
      const withEstablishing: typeof finalSceneList = [];
      for (const seg of finalSceneList) {
        const segSceneId = (seg as { sceneId?: string }).sceneId;
        if (segSceneId && establishingShots[segSceneId]?.imageUrl) {
          const eShot = establishingShots[segSceneId];
          withEstablishing.push({
            scene: (seg as { scene?: number }).scene ? (seg as { scene: number }).scene - 0.5 : -0.5,
            sceneId: `${segSceneId}_establish`,
            videoUrl: "",
            imageUrl: eShot.imageUrl,
            mode: "image" as const,
            duration: eShot.durationSeconds || 3,
            motionDuration: eShot.durationSeconds || 3,
            narrationScript: "",
            description: `Establishing shot: ${eShot.type}`,
            title: `[Establishing] ${eShot.type}`,
            flipOverride: null,
            text: "",
            animation: "none" as const,
          } as typeof finalSceneList[0]);
        }
        withEstablishing.push(seg);
      }
      // Replace finalSceneList reference for assembly — use withEstablishing from here on
      const finalSceneListWithEstablishing = withEstablishing;

      // ── Build narrationList — narrator + all character voices with timing ──
      // storyMode controls which audio tracks are included:
      //   narration-only → narrator only, no character voices
      //   actors-only    → character voices only, no narrator
      //   mixed          → both narrator (narration segments only) + character voices (dialogue segments)
      const narrationList: Array<{ audioUrl: string; startTime: number; volume: number }> = [];

      // 2. Character voice audio — only in actors-only or mixed mode
      // NEW: prefer per-line clips (scriptSegments[].audioUrl) over old per-character files
      const hasPerLineClips = scriptSegments.some(s => s.type === "dialogue" && s.audioUrl);

      // 1. Narrator audio — plays in narration-only AND mixed mode.
      // FIX 2026-05-28 (Henry: "actor voice heard, narration style ignored"):
      // The narrator was previously DROPPED in mixed mode whenever per-line actor clips
      // existed — out of fear of "all voices at once". But the narrator file is built from
      // narration-type text ONLY (generateNarrationPiper → allScenesNarration, which
      // EXCLUDES dialogue per BUG-16a). So narrator (narration passages) and actor clips
      // (dialogue lines) are COMPLEMENTARY, not overlapping. Dropping the narrator meant
      // mixed videos lost ALL narration and played only character dialogue. Keep it.
      if (narratorAudioUrl && storyMode !== "actors-only") {
        narrationList.push({ audioUrl: narratorAudioUrl, startTime: 0, volume: 1.0 });
      }

      // Build scene start map — used for per-line timing
      const sceneStartMapForChar: Record<string, number> = {};
      let elapsedForChar = 0;
      for (const s of scenesToAssemble) {
        sceneStartMapForChar[s.sceneId] = elapsedForChar;
        const narText = scriptSegments.filter(seg => seg.sceneId === s.sceneId && seg.type === "narration").map(seg => seg.text || "").join(" ");
        elapsedForChar += s.motionDuration || estimateTextDuration(narText || s.narrationScript || "") || 5;
      }

      // actorVoicesEnabled gate (2026-05-28): user can deactivate actor/character voices in
      // the Sound or Assembly tab. When off, skip all character dialogue clips → narrator only.
      if (storyMode !== "narration-only" && actorVoicesEnabled) {
        if (hasPerLineClips) {
          // Per-line system: place each clip at its scene's start + position within that scene
          const textTimings = buildTimings(scriptSegments, narratorPiperSpeed);
          for (let i = 0; i < scriptSegments.length; i++) {
            const seg = scriptSegments[i];
            if (seg.type === "dialogue" && seg.audioUrl) {
              let startTime: number;
              if (seg.sceneId && sceneStartMapForChar[seg.sceneId] !== undefined) {
                // Scene-based: Bear speaks at Bear's scene, Dog at Dog's scene
                const sceneStart = sceneStartMapForChar[seg.sceneId];
                const sceneDur = scenesToAssemble.find(s => s.sceneId === seg.sceneId)?.motionDuration || 5;
                const sceneLines = scriptSegments.filter(s => s.sceneId === seg.sceneId && s.type === "dialogue");
                const posInScene = sceneLines.findIndex(s => s.id === seg.id);
                const totalInScene = Math.max(sceneLines.length, 1);
                // Distribute lines evenly within scene (0.5s padding from start, 1s from end)
                startTime = sceneStart + 0.5 + (posInScene / totalInScene) * (sceneDur - 1.5);
              } else {
                // Fall back to text-length estimation
                startTime = seg.estimatedStartMs != null ? seg.estimatedStartMs / 1000 : textTimings[i];
              }
              narrationList.push({ audioUrl: seg.audioUrl, startTime, volume: 1.0 });
            }
          }
        } else {
          // No per-line clips generated yet — narrator-only.
          // characterAudioUrls holds voice SAMPLES ("I am ready" demos), not actual dialogue recordings.
          // Mixing voice samples over a continuous narrator creates cacophony. Leave narrationList as-is.
        }
      }

      // ── Build SFX list — narration is the clock, SFX placed at narrator-proportional timestamps ──
      // Each scene gets its SFX at the proportional position within the total narration duration.
      // This ensures SFX fire when the narrator is speaking about that scene, not based on video clip lengths.
      const sfxList: Array<{ sourceUrl: string; startTime: number; volume: number }> = [];
      try {
        const sfxAssets = await fetch("/api/assets?type=sfx").then(r => r.json())
          .then(d => (d.assets || []) as Array<{ name: string; filePath: string }>);

        // Build per-scene narration text lengths to compute proportional timestamps
        const sceneNarrTexts = scenesToAssemble.map(s => {
          const segText = scriptSegments.filter(seg => seg.sceneId === s.sceneId).map(seg => seg.text || "").join(" ");
          return segText || s.narrationScript || s.description || s.title || "";
        });
        const totalNarrChars = sceneNarrTexts.reduce((sum, t) => sum + t.length, 0) || 1;
        // Use effectiveNarrDurMs (recovered narrator audio duration) as master clock
        // totalDuration is computed later — derive fallback inline from scene list
        const sfxSceneBaseDur = scenesToAssemble.reduce((sum, s) => sum + (s.motionDuration || 5), 0);
        const masterDur = effectiveNarrDurMs > 0 ? effectiveNarrDurMs / 1000 : sfxSceneBaseDur;

        let charsCursor = 0;
        for (let si = 0; si < scenesToAssemble.length; si++) {
          const s = scenesToAssemble[si];
          const sceneText = sceneNarrTexts[si];
          const sceneStart = (charsCursor / totalNarrChars) * masterDur;
          const sceneNarrDur = (sceneText.length / totalNarrChars) * masterDur;
          charsCursor += sceneText.length;

          const planned = s.audioPlan?.sfxList || [];
          for (let i = 0; i < Math.min(planned.length, 2); i++) {
            const name = (planned[i] || "").toLowerCase();
            const match = sfxAssets.find((a: { name: string; filePath: string }) =>
              a.name.toLowerCase().includes(name) || name.includes(a.name.toLowerCase().split(" ")[0])
            );
            if (match?.filePath) {
              // Place first SFX at scene start, second 40% into the scene
              const offset = i === 0 ? 0 : sceneNarrDur * 0.4;
              sfxList.push({
                sourceUrl: `/api/media/${match.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`,
                startTime: Math.round((sceneStart + offset) * 10) / 10,
                volume: 0.45,
              });
            }
          }
        }
      } catch { /* skip SFX on error */ }

      // ── Music selection — use what Henry selected, fall back to tone-matched stock ──
      let effectiveMusicUrl = selectedMusicUrl || null;

      if (!effectiveMusicUrl) {
        try {
          const libRes = await fetch("/api/assets?type=music");
          if (libRes.ok) {
            const libData = await libRes.json();
            const tracks = (libData.assets || libData || []) as Array<{ filePath?: string; name?: string; url?: string; type?: string }>;
            const musicTracks = tracks.filter(t => t.filePath && t.type !== "sfx");
            if (musicTracks.length > 0) {
              const toneKey = (tone || genre || "emotional").toLowerCase();
              const pick = musicTracks.find(t => (t.name || "").toLowerCase().includes(toneKey.split(" ")[0]))
                || musicTracks.find(t => /emotional|calm|soft/.test((t.name || "").toLowerCase()))
                || musicTracks[0];
              if (pick?.filePath) {
                effectiveMusicUrl = `/api/media/${pick.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
                console.log(`[assemble] Auto-selected music: ${pick.name} → ${effectiveMusicUrl}`);
              }
            }
          }
        } catch { /* skip auto-music on error */ }
      }

      // Fallback 3: use first per-scene generated music URL if still no music
      if (!effectiveMusicUrl) {
        const firstSceneMusic = scenesToAssemble.find(s => s.audioPlan?.musicUrl)?.audioPlan;
        if (firstSceneMusic?.musicUrl) {
          effectiveMusicUrl = firstSceneMusic.musicUrl;
          console.log(`[assemble] Using per-scene music as fallback: ${effectiveMusicUrl}`);
        }
      }

      // ── Assembly debug manifest — log exactly what files are being used ──
      console.log("[assemble MANIFEST]", JSON.stringify({
        project: projectTitle,
        narrationUrl: narrationList.length > 0 ? narrationList[0]?.audioUrl : narratorAudioUrl,
        narrationTracks: narrationList.length,
        musicUrl: effectiveMusicUrl || "NONE",
        sfxCount: sfxList.length,
        sceneCount: finalSceneListWithEstablishing.length,
        subtitleStyle,
      }));

      // ── Phase 1.6: Build AssemblyJSON and use /api/assembly/execute ──────────
      const effProjId = projectId || activeProjLocalId || `hybrid_${Date.now()}`;
      // totalDuration = narrator audio + fixed intro/outro card durations.
      // Intro/outro use fixed durations (5s/10s) not narrator proportion.
      const sceneBaseDuration = finalSceneListWithEstablishing.reduce((sum: number, s: { motionDuration?: number; duration?: number }) => sum + (s.motionDuration || s.duration || 5), 0);
      const narratorDurSec = effectiveNarrDurMs > 0 ? effectiveNarrDurMs / 1000 : 0;
      const introOutroFixed = (introScene ? (introScene.duration || 5) : 0) + (outroScene ? (outroScene.duration || 10) : 0);
      const totalDuration = narratorDurSec > 0
        ? narratorDurSec + introOutroFixed   // narrator is clock; add fixed card time
        : Math.max(sceneBaseDuration, narratorDurSec || sceneBaseDuration);

      // Compute per-segment duration from narration proportion (narration is the master clock).
      // Only main scene segments are proportionally scaled — intro/outro use fixed durations.
      // Falls back to motionDuration if no narration text is available (e.g. no script parsed).
      const masterDurForSegs = effectiveNarrDurMs > 0 ? effectiveNarrDurMs / 1000 : totalDuration;
      // Only count main scene chars — intro/outro (no sceneId) have no narration text.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalStoryChars = (finalSceneListWithEstablishing as any[]).reduce((sum: number, s: { sceneId?: string; description?: string; title?: string; narrationScript?: string }) => {
        if (!s.sceneId) return sum;  // skip intro/outro cards
        const segText = scriptSegments.filter(seg => seg.sceneId === s.sceneId).map(seg => seg.text || "").join(" ");
        const text = segText || s.narrationScript || s.description || s.title || "";
        return sum + Math.max(text.length, 20);
      }, 0) as number || 1;

      let segCursor = 0;
      let segIdx = 0;
      const assemblySegments: AssemblySegment[] = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (let si = 0; si < (finalSceneListWithEstablishing as any[]).length; si++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s = (finalSceneListWithEstablishing as any[])[si] as { videoUrl?: string; imageUrl?: string; motionDuration?: number; duration?: number; sceneId?: string; scene?: number; narrationScript?: string; description?: string; title?: string };
        const segText = scriptSegments.filter(seg => seg.sceneId === s.sceneId).map(seg => seg.text || "").join(" ");
        const sceneText = segText || s.narrationScript || s.description || s.title || "";
        const textFraction = Math.max(sceneText.length, 20) / totalStoryChars;
        // Intro/outro cards (no sceneId) keep their fixed duration — don't proportionally scale them.
        // Only main scene segments are scaled by narration proportion.
        const sceneDur = !s.sceneId
          ? (s.duration || 5)
          : effectiveNarrDurMs > 0
            ? Math.max(textFraction * masterDurForSegs, 2)  // minimum 2s per scene
            : (s.motionDuration || s.duration || 5);

        // ── Beat image expansion (P2-C: auto-expand all scenes with 2+ images) ──────────────
        // P2-C 2026-05-14: removed userOptedIntoMax opt-in gate.
        // Any scene with 2+ images now auto-expands. Each image gets sceneFlipSec seconds.
        // sceneFlipSec = scene.flipOverride ?? projectSettings.imageFlipSeconds (default 3s).
        //
        //   allBeatImgs  = Gen Max beats first, then variant pool
        //   beatChecks   = user's checkbox state; undefined = treat as ON
        //   tickedBeats  = images that will appear in assembled video
        //
        // Edge cases:
        //   - 0 ticked → fall back to scene.imageUrl (single image)
        //   - 1 ticked → single-segment at sceneFlipSec
        //   - 2+ ticked → multi-segment, each sceneFlipSec long
        const sceneFlipSec = Math.max(1, (s as {flipOverride?: number | null}).flipOverride ?? effectiveFlipSeconds);
        const genMaxBeats = s.sceneId ? sceneBeatImages[s.sceneId] : null;
        const variantPool = s.sceneId
          ? [sceneImages[s.sceneId], ...(prevSceneImages[s.sceneId] || [])].filter((u): u is string => !!u)
          : [];
        const allBeatImgs = (genMaxBeats && genMaxBeats.length > 1)
          ? genMaxBeats
          : (variantPool.length > 1 ? variantPool : null);
        const beatChecks = s.sceneId ? selectedBeatImages[s.sceneId] : null;
        const tickedBeats = allBeatImgs
          ? allBeatImgs.filter((_, bi) => beatChecks?.[bi] !== false)
          : [];
        // s.mode === "video" means a Wan clip is available; s.videoUrl may still be "img:xxx" for image scenes
        const hasWanVideo = (s as { mode?: string }).mode === "video";
        if (!hasWanVideo && tickedBeats.length > 1) {
          // Multi-image path: each image gets sceneFlipSec seconds exactly
          for (let bi = 0; bi < tickedBeats.length; bi++) {
            assemblySegments.push({
              id: `seg_${segIdx++}`,
              type: "image",
              sourceUrl: tickedBeats[bi],
              startTime: segCursor,
              endTime: segCursor + sceneFlipSec,
              duration: sceneFlipSec,
              sceneId: s.sceneId!,
              transitionIn: assemblySegments.length === 0 ? "fade" : "cut",
              transitionOut: "cut",
            });
            segCursor += sceneFlipSec;
          }
        } else {
          // Single-image / video path.
          // Duration: always sceneDur (narration-proportional) so the image holds for the exact time
          // the narrator speaks about this scene. sceneFlipSec is only for multi-beat flip sequences.
          const singleDur = sceneDur;
          const singleSrc = hasWanVideo
            ? (s.videoUrl || "")
            : ((tickedBeats.length >= 1 ? tickedBeats[0] : "")
                || s.imageUrl
                || (allBeatImgs && allBeatImgs.length > 0 ? allBeatImgs[0] : "")
                || s.videoUrl   // last resort: may be "img:xxx" for image scenes
                || "");
          assemblySegments.push({
            id: `seg_${segIdx++}`,
            type: hasWanVideo ? "video" : "image",
            sourceUrl: singleSrc,
            startTime: segCursor,
            endTime: segCursor + singleDur,
            duration: singleDur,
            sceneId: s.sceneId || `SC${String(si + 1).padStart(2, "0")}`,
            transitionIn: si === 0 ? "fade" : "cut",
            transitionOut: "cut",
          });
          segCursor += singleDur;
        }
      }

      // Deduplicate by audioUrl — blocks same WAV playing twice if user regenerates narration mid-session
      const seenNarrUrls = new Set<string>();
      const dedupNarrationList = narrationList.filter((n: { audioUrl: string }) =>
        !seenNarrUrls.has(n.audioUrl) && seenNarrUrls.add(n.audioUrl)
      );

      // Fallback narrator end-time used when effectiveNarrDurMs is 0 (e.g. after page refresh).
      // Excludes intro/outro card time so subtitles don't bleed into the title cards.
      const narratorFallbackSec = Math.max(sceneBaseDuration - introOutroFixed, 1);

      // Subtitle text must match what was actually sent to TTS (same priority as generateNarrationPiper).
      // Using full story text instead of per-scene narration is the #1 cause of subtitles not matching audio.
      const subtitleAllScenes = scenes
        .slice().sort((a: HybridScene, b: HybridScene) => a.scene - b.scene)
        .map((s: HybridScene) => s.narrationScript || s.description || "")
        .filter(Boolean)
        .join(" ");
      const subtitleParsedNarr = scriptSegments.filter(s => s.type === "narration").map(s => s.text).join(" ");
      const narratorSubtitleText = (
        subtitleAllScenes.trim() || subtitleParsedNarr.trim() || fullScript || expandedSummary || idea || ""
      ).slice(0, 8000);

      const assemblyNarration: NarrationEntry[] = dedupNarrationList.map((n: { audioUrl: string; startTime: number; volume: number }, i: number) => ({
        id: `nar_${i}`,
        // Subtitle text — drawtext needs this. Three sources, in priority:
        //   1. Master narrator audio → full joined story text
        //   2. Per-segment audio (FAL/karaoke split) → that segment's text
        //   3. Character voice without matching segment → empty (no subtitle)
        text: n.audioUrl === narratorAudioUrl
          ? narratorSubtitleText
          : (scriptSegments.find(s => s.audioUrl === n.audioUrl)?.text?.trim() || ""),
        startTime: n.startTime,
        // Main narrator: use measured duration so assembly-builder atrim doesn't cut it short.
        // Per-line character clips are short (<10s each), so a 10s window is safe.
        endTime: n.audioUrl === narratorAudioUrl
          ? (effectiveNarrDurMs > 0 ? n.startTime + effectiveNarrDurMs / 1000 : n.startTime + narratorFallbackSec)
          : n.startTime + 10,
        volume: n.volume ?? narrationVolume ?? 1.0,
        speed: 1.0,
        audioUrl: n.audioUrl,
      }));

      // Fallback: narrationList was empty — add narrator directly if not already covered
      if (assemblyNarration.length === 0 && narratorAudioUrl && !seenNarrUrls.has(narratorAudioUrl)) {
        assemblyNarration.push({
          id: "nar_0", text: narratorSubtitleText, startTime: 0,
          endTime: effectiveNarrDurMs > 0 ? effectiveNarrDurMs / 1000 : narratorFallbackSec,
          volume: narrationVolume ?? 1.0, speed: 1.0, audioUrl: narratorAudioUrl,
        });
      }

      const assemblyMusic: MusicEntry[] = effectiveMusicUrl ? [{
        id: "music_0",
        sourceUrl: effectiveMusicUrl,
        startTime: 0,
        endTime: totalDuration,
        volume: musicVolume ?? 0.3,
        fadeIn: 2,
        fadeOut: 3,
        duckUnderSpeech: true,
        duckLevel: 0.08,
        licenseType: "cc0",
      }] : [];

      const assemblySfx: SFXEntry[] = sfxList.map((s: { sourceUrl: string; startTime: number; volume: number }, i: number) => ({
        id: `sfx_${i}`,
        event: `sfx_${i}`,
        sourceUrl: s.sourceUrl,
        startTime: s.startTime,
        duration: 3,
        volume: s.volume ?? 0.5,
        loop: false,
        category: "auto",
        licenseType: "cc0",
      }));

      // ── Subtitle gate ──
      // Two state values can indicate "subtitles on":
      //   1. subtitleStyle (legacy)  — "classic" | "cinema" | ... | "none"
      //   2. effectiveSubtitleConfig.mode (new picker) — "dramatic" | "highlight" | ... | "none"
      // If EITHER is non-"none", burn in subtitles. Saved projects from earlier
      // builds can have subtitleStyle="none" while the new mode picker is set —
      // gating on subtitleStyle alone caused subtitles to silently skip.
      const subtitlesOn = subtitleStyle !== "none" || effectiveSubtitleConfig.mode !== "none";
      // Execute route also gates on subtitleStyle !== "none" — coerce to "classic"
      // when the new picker is the only signal, so drawtext actually runs.
      const sentSubtitleStyle: "classic" | "cinema" | "neon" | "bold" | "none" =
        subtitleStyle === "none" && subtitlesOn
          ? "classic"
          : (subtitleStyle as "classic" | "cinema" | "neon" | "bold" | "none");

      const assemblyJSON = {
        ...createEmptyAssembly(effProjId, "hybrid", projectTitle),
        totalDuration,
        segments: assemblySegments,
        narration: assemblyNarration,
        music: assemblyMusic,
        sfx: assemblySfx,
        exportSettings: {
          format: "mp4" as const,
          quality: "standard" as const,
          includeSubtitles: subtitlesOn,
          includeWatermark: false,
          includeCredits: false,
          subtitleStyle: sentSubtitleStyle,
          subtitleConfig: subtitlesOn ? effectiveSubtitleConfig : undefined,
        },
        rightsConfirmed: true,
        previewApproved: true,
        exportApproved: true,
      };

      const res = await fetch("/api/assembly/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assembly: assemblyJSON, skipApprovalCheck: true }),
      });
      // FIX (2026-05-24): route now returns NDJSON stream (heartbeats + final {result, status})
      // to defeat CF Free-plan 100s edge timeout on long assemblies. Parse the stream.
      let data: Record<string, unknown> = {};
      let httpStatus: number = res.status;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("ndjson")) {
        if (!res.body) { setUiError("Assembly: no response stream"); return; }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            const t = line.trim();
            if (!t) continue;
            try {
              const obj = JSON.parse(t) as Record<string, unknown>;
              if (obj.heartbeat) {
                // Keep UI alive — update last-action line so user sees progress
                setLastAction(`Assembly running… (${Math.round(((obj.ts as number) - Date.now()) / -1000)}s)`);
                continue;
              }
              if (obj.result) {
                data = obj.result as Record<string, unknown>;
                if (typeof obj.status === "number") httpStatus = obj.status;
              }
            } catch { /* malformed line — skip */ }
          }
        }
        // Drain trailing buf in case the last line wasn't newline-terminated
        const tail = buf.trim();
        if (tail) {
          try {
            const obj = JSON.parse(tail) as Record<string, unknown>;
            if (obj.result) {
              data = obj.result as Record<string, unknown>;
              if (typeof obj.status === "number") httpStatus = obj.status;
            }
          } catch { /* skip */ }
        }
      } else {
        // Legacy / error path — server returned a single JSON (e.g. 400 validation)
        try { data = await res.json() as Record<string, unknown>; } catch { data = { error: `HTTP ${res.status}` }; }
      }
      if (httpStatus >= 400 || data.error) {
        const errMsg = String(data.error ?? `HTTP ${httpStatus}`);
        setUiError(`Assembly failed: ${errMsg}`);
        setLastAction(`Assembly error: ${errMsg}`);
        return;
      }
      const warningStr = typeof data.warning === "string" ? data.warning : null;
      if (warningStr) setUiError(warningStr);
      // Surface subtitle status — silent failures used to leave the user wondering why no captions appeared
      const subStatus = data.subtitleStatus as { requested?: boolean; succeeded?: boolean; reason?: string } | undefined;
      if (subStatus?.requested && !subStatus?.succeeded) {
        const why = subStatus.reason || "unknown reason";
        setUiError(`Subtitles requested but not burned in: ${why}`);
        console.warn("[subtitle] burn-in failed:", subStatus);
      }
      const outputUrl = typeof data.outputUrl === "string" ? data.outputUrl : null;
      const finalDur = typeof data.duration === "number" ? data.duration : 0;
      if (outputUrl) {
        setAssembledVideoUrl(outputUrl);
        setAssemblyComplete(true);
        setLastAction(`Assembly complete — ${finalDur ? Math.round(finalDur) + "s video ready" : "video ready"}`);
        // Save video URL into the named cut so it persists when user returns
        if (assemblyName.trim()) {
          setSavedCuts(prev => {
            const idx = prev.findIndex(c => c.name === assemblyName);
            const updated = { name: assemblyName, sceneIds: [...selectedSceneIds], order: [...assemblyOrder], videoUrl: outputUrl, assembledAt: Date.now() };
            if (idx >= 0) { const a = [...prev]; a[idx] = updated; return a; }
            return [...prev, updated];
          });
        }
        // ── AUTO-EARS: run faster-whisper transcription to confirm narration is audible ──
        try {
          setLastAction("Ears check — probing audio in assembled video…");
          const earRes = await fetch("/api/hybrid/check-audio", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrl: outputUrl }),
          });
          const earData = await earRes.json();
          const durStr = earData.duration ? ` (${Math.round(earData.duration)}s)` : "";
          if (!earData.ok) {
            setLastAction(`[!] Ears: probe failed — ${earData.error || "unknown error"}. Video saved.`);
          } else if (!earData.hasAudio) {
            setLastAction(`[!] Ears: NO AUDIO STREAM found${durStr}. Check assembly narration step.`);
            setUiError("Assembly complete but video has no audio stream. Regenerate narrator voice and reassemble.");
          } else if (earData.transcript && earData.transcript.trim().length > 10) {
            setLastAction(`Ears: heard narration${durStr} — "${earData.transcript.slice(0, 100)}"`);
          } else if (earData.silent || !earData.transcript) {
            // 2026-05-10 — Whisper free model is fragile. Empty transcript when audio stream
            // exists usually means Whisper couldn't transcribe (RAM/format/language), NOT
            // that the audio is silent. Treat as a non-blocking note instead of an error flag.
            const whisperNote = earData.whisperError
              ? ` (Whisper: ${earData.whisperError.slice(0, 60)})`
              : " — likely a Whisper limitation, not silent audio";
            setLastAction(`Assembly complete${durStr} — audio stream OK, transcript skipped${whisperNote}`);
          } else {
            setLastAction(`Assembly complete${durStr} — audio OK, codec: ${earData.audioCodec || "?"}`);
          }
        } catch (earErr) {
          setLastAction(`Assembly complete — ears check failed: ${String(earErr).slice(0, 80)}`);
        }

        // Asset library + Review save is handled server-side in /api/assembly/execute (saveVideoAsset + ContentItem IN_REVIEW)
      } else {
        setAssemblyComplete(true);
        const apiErrMsg = data.error ? `: ${String(data.error)}` : "";
        setUiError(`Assembly API returned no video URL${apiErrMsg}. Check server logs.`);
        setLastAction(`Assembly returned no video${apiErrMsg}`);
      }
    } catch (err) {
      console.error("assembleScenes failed:", err);
      const errMsg = err instanceof Error ? err.message : String(err);
      setUiError(`Assembly failed: ${errMsg}`);
      setLastAction(`Assembly error: ${errMsg.slice(0, 120)}`);
    }
    setAssembling(false);
  }

  // ── Load music from asset library ──
  async function loadMusicLibrary() {
    setLoadingMusic(true);
    try {
      const res = await fetch("/api/assets?type=music");
      const data = await res.json();
      setMusicLibrary((data.assets || data || []).filter((a: MusicAsset) => a.filePath || a.id));
    } catch { /* best effort */ }
    setLoadingMusic(false);
  }

  // ── Parse screenplay into per-scene narration scripts ──
  // Splits the screenplay by INT./EXT. scene headings, extracts action lines + dialogue,
  // and pushes the text into each HybridScene's narrationScript field.
  // The narration pipeline (parse-script → Piper TTS → subtitles) then picks it up.
  const [sendingToScenes, setSendingToScenes] = useState(false);
  const [sendToScenesResult, setSendToScenesResult] = useState<string>("");

  async function sendScreenplayToScenes() {
    if (!screenplay || scenes.length === 0) return;
    setSendingToScenes(true);
    setSendToScenesResult("Sending screenplay to scenes...");

    // Split screenplay into blocks by scene headings (INT. / EXT.)
    const lines = screenplay.split("\n");
    const sceneBlocks: { heading: string; lines: string[] }[] = [];
    let current: { heading: string; lines: string[] } | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed)) {
        if (current) sceneBlocks.push(current);
        current = { heading: trimmed, lines: [] };
      } else if (current) {
        if (trimmed && !/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:|SMASH CUT:|THE END)/.test(trimmed)) {
          current.lines.push(trimmed);
        }
      }
    }
    if (current && current.lines.length > 0) sceneBlocks.push(current);

    if (sceneBlocks.length === 0) {
      setSendToScenesResult("No scene headings (INT./EXT.) found in screenplay.");
      setSendingToScenes(false);
      return;
    }

    // Build updated scenes with narration from screenplay
    let updated = 0;
    const updatedScenes: typeof scenes = [];
    for (let idx = 0; idx < scenes.length; idx++) {
      const scene = scenes[idx];
      const block = sceneBlocks[idx];
      // No matching screenplay block → clear any placeholder text
      if (!block) { updatedScenes.push({ ...scene, narrationScript: "" }); continue; }

      const narrationLines: string[] = [];
      for (let i = 0; i < block.lines.length; i++) {
        const l = block.lines[i];
        if (/^[A-Z][A-Z\s\-'().]+$/.test(l) && l.length < 40) {
          let dialogue = "";
          let j = i + 1;
          while (j < block.lines.length && !/^[A-Z][A-Z\s\-'().]+$/.test(block.lines[j]) && !/^(INT\.|EXT\.)/.test(block.lines[j])) {
            const dl = block.lines[j].trim();
            if (dl && !dl.startsWith("(")) dialogue += (dialogue ? " " : "") + dl;
            j++;
          }
          if (dialogue) narrationLines.push(`${l}: ${dialogue}`);
          i = j - 1;
        } else if (!l.startsWith("(")) {
          narrationLines.push(l);
        }
      }
      const narrationScript = narrationLines.join(" ").slice(0, 1000);
      if (narrationScript) updated++;
      // Clear old placeholder text on scenes that got real content
      updatedScenes.push({ ...scene, narrationScript });
    }
    setScenes(updatedScenes);

    // ── Step 2: Auto-run parse-script so characters are split from narration ──
    setSendToScenesResult(`${updated} scenes updated — now parsing script...`);
    try {
      const fullText = updatedScenes.map(s => s.narrationScript).filter(Boolean).join("\n\n");
      if (fullText.trim()) {
        const parseRes = await fetch("/api/hybrid/parse-script", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storyText: fullText,
            knownCharacters: characters.map(c => c.displayName),
          }),
        });
        const parseData = await parseRes.json();
        if (parseData.ok) {
          const enriched2 = ((parseData.segments || []) as ScriptSegment[]).map(seg => {
            if (seg.type === "dialogue" && seg.speaker && seg.speaker !== "narrator") {
              const match = characters.find(c =>
                c.displayName.toLowerCase() === seg.speaker.toLowerCase() ||
                seg.speaker.toLowerCase().includes(c.displayName.toLowerCase().split(" ")[0])
              );
              return { ...seg, characterId: match?.characterId };
            }
            return seg;
          });
          setScriptSegments(enriched2);
          setStoryMode(parseData.storyMode || "mixed");
          setSendToScenesResult(`Screenplay sent to ${updated} scenes + script parsed (${parseData.segments?.length || 0} lines). Now go to Audio & Shots → AI Narrate to generate voices.`);
        } else {
          setSendToScenesResult(`${updated} scenes updated. Go to Audio & Shots to parse and narrate.`);
        }
      }
    } catch { /* best effort — parse can be done manually */ }

    setSendingToScenes(false);
  }

  // ── Generate Movie Screenplay ──
  async function generateScreenplay() {
    setGeneratingScreenplay(true);
    setScreenplayError("");
    try {
      const res = await fetch("/api/hybrid/screenplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: projectTitle,
          summary: expandedSummary,
          fullScript,
          characters,
          scenes,
          genre,
          tone,
          projectStyle: effectiveProjectStyle,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setScreenplayError(data.error || "Screenplay generation failed.");
      } else {
        setScreenplay(data.screenplay);
      }
    } catch (err) {
      setScreenplayError(err instanceof Error ? err.message : "Screenplay generation failed.");
    }
    setGeneratingScreenplay(false);
  }

  // ── AI auto-select best background music from library ──
  async function aiPickMusic() {
    setAiPickingMusic(true);
    setAiMusicPickLog("Loading music library...");
    try {
      // Ensure library is loaded
      let tracks = musicLibrary;
      if (tracks.length === 0) {
        const res = await fetch("/api/assets?type=music");
        const data = await res.json();
        tracks = (data.assets || data || []).filter((a: MusicAsset) => a.filePath || a.id);
        setMusicLibrary(tracks);
      }
      if (tracks.length === 0) {
        setAiMusicPickLog("No music in library. Add tracks first.");
        setAiPickingMusic(false);
        return;
      }

      // Build story context
      const storyContext = fullScript
        ? fullScript.slice(0, 400)
        : expandedSummary
          ? expandedSummary.slice(0, 400)
          : idea.slice(0, 400);

      const moodTags = scenes.flatMap(s => [s.musicStyle, s.ambience].filter(Boolean)).slice(0, 12).join(", ");
      const trackList = tracks.map((t, i) => `${i + 1}. "${t.name}"${t.tags?.length ? ` [${t.tags.slice(0, 4).join(", ")}]` : ""}`).join("\n");

      setAiMusicPickLog("Asking AI to pick best track...");

      const prompt = `You are a music supervisor for an animated short film. Based on the story and the available music tracks, pick the single best matching background track.

STORY:
${storyContext}

MOOD/STYLE CUES FROM SCENES: ${moodTags || "adventure, warm, emotional"}

AVAILABLE TRACKS:
${trackList}

Reply with ONLY a JSON object like this — no explanation, no markdown:
{"trackNumber": 2, "trackName": "exact track name from the list", "reason": "one sentence why"}`;

      const llmRes = await fetch("/api/llm/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, role: "quality", maxTokens: 200 }),
      });

      if (!llmRes.ok) throw new Error(`LLM error ${llmRes.status}`);
      const llmData = await llmRes.json();
      const raw = (llmData.text || llmData.response || "").trim();

      // Parse JSON from response
      let picked: { trackNumber?: number; trackName?: string; reason?: string } = {};
      try {
        const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
        if (start !== -1 && end > start) picked = JSON.parse(raw.slice(start, end + 1));
      } catch { /* ignore */ }

      // Find matching track by name (case-insensitive) or number
      const match = tracks.find(t => t.name.toLowerCase() === (picked.trackName || "").toLowerCase())
        || (picked.trackNumber ? tracks[picked.trackNumber - 1] : null);

      if (match) {
        const mediaUrl = assetToMediaUrl(match.filePath);
        setSelectedMusicUrl(mediaUrl);
        setSelectedMusicName(match.name);
        setAiMusicPickLog(`Selected: "${match.name}"${picked.reason ? ` — ${picked.reason}` : ""}`);
      } else {
        setAiMusicPickLog(`Could not match track. AI said: ${raw.slice(0, 120)}`);
      }
    } catch (err) {
      setAiMusicPickLog(`AI pick failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    setAiPickingMusic(false);
  }

  // ── Build a precise, unambiguous visual description for a character ──
  // This is used in EVERY scene prompt so the model always generates the same appearance.
  // The more fields filled in, the more consistent the output.
  function buildVisualDescription(char: CharacterIdentity): string {
    const parts: string[] = [];
    // Age FIRST — image generators weight early tokens highest
    if (char.ageRange) parts.push(char.ageRange);
    if (char.species) parts.push(`${char.species}`);
    if (char.bodyBuild) parts.push(char.bodyBuild);
    if (char.ageAppearance) parts.push(char.ageAppearance);
    if (char.colorDescription) parts.push(char.colorDescription);
    if (char.faceFeatures) parts.push(char.faceFeatures);
    if (char.clothingDetails) parts.push(`wearing: ${char.clothingDetails}`);
    if (char.accessories) parts.push(`accessories: ${char.accessories}`);
    if (char.distinctiveFeatures) parts.push(char.distinctiveFeatures);
    // Fallback to legacy fields if new ones empty
    if (parts.length === 0) {
      if (char.skinTone) parts.push(char.skinTone);
      if (char.hairStyle) parts.push(char.hairStyle);
      if (char.wardrobeStyle) parts.push(char.wardrobeStyle);
      if (char.gender) parts.push(char.gender);
    }
    return parts.join(", ");
  }

  // ── AI reads any character image → auto-fills all visual identity fields ──
  // Called automatically after portrait generation and when an image is imported.
  // Provider preference: "auto" tries Ollama → Claude → GPT. User can override via selector.
  async function analyzeCharacterImage(charId: string, imageUrl: string) {
    setAnalyzingCharacter(charId);
    try {
      const res = await fetch("/api/hybrid/analyze-character", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl, characterName: charId, preferredProvider: visionProvider }),
      });

      if (!res.ok) {
        setLastAction(`AI Read Look failed — server error ${res.status}. Check your API keys in AI Settings.`);
        return;
      }

      const data = await res.json();

      // No vision AI configured — tell the user exactly what to do
      if (data.noVisionAvailable) {
        setLastAction(
          visionProvider === "ollama"
            ? `No local vision model found. Install Ollama then run: ollama pull llava`
            : visionProvider === "claude"
            ? `Claude vision unavailable. Add ANTHROPIC_API_KEY in AI Settings.`
            : visionProvider === "gpt"
            ? `GPT vision unavailable. Add OPENAI_API_KEY in AI Settings.`
            : `No vision AI available. Install Ollama + llava, or add ANTHROPIC_API_KEY / OPENAI_API_KEY in AI Settings.`
        );
        return;
      }

      if (!data.success || !data.analysis) {
        setLastAction(`AI Read Look: could not parse image analysis. Try a different Vision AI provider.`);
        return;
      }

      const a = data.analysis;
      // Fill all fields — overwrite empty ones, keep manually-typed ones.
      // CRITICAL: story-extracted skinTone/ageRange are the source of truth — never let
      // the picture-reading AI override them with what the (possibly wrong) portrait shows.
      // Without this, a portrait that came out white would make AI Read write "fair skin"
      // into colorDescription, throwing away the story's "dark brown skin".
      setCharacters(prev => prev.map(c => {
        if (c.characterId !== charId) return c;
        // Detect skin/ethnicity conflict between story (c.skinTone) and AI's read of portrait (a.colorDescription)
        const skinHasEthnicity = (c.skinTone || "").length > 3;
        const aiSaysLight = /\b(fair|pale|light|white|caucasian|tan)\b/i.test(a.colorDescription || "");
        const storySaysDark = /\b(dark|brown|black|melanated|african|nigerian)\b/i.test(c.skinTone || "");
        const aiSaysDark = /\b(dark|brown|black|melanated|african)\b/i.test(a.colorDescription || "");
        const storySaysLight = /\b(fair|pale|light|white|caucasian)\b/i.test(c.skinTone || "");
        const ethnicityConflict = (storySaysDark && aiSaysLight) || (storySaysLight && aiSaysDark);
        return {
          ...c,
          species:              c.species || a.species || "",
          bodyBuild:            c.bodyBuild || a.bodyBuild || "",
          // Prefer existing colorDescription → story's skinTone → AI's read.
          // If AI's read conflicts with story's skin tone, force story to win.
          colorDescription:     c.colorDescription
                                  || (ethnicityConflict ? c.skinTone : (skinHasEthnicity ? c.skinTone : a.colorDescription))
                                  || a.colorDescription
                                  || "",
          faceFeatures:         c.faceFeatures || a.faceFeatures || "",
          clothingDetails:      c.clothingDetails || a.clothingDetails || "",
          accessories:          c.accessories || a.accessories || "",
          distinctiveFeatures:  c.distinctiveFeatures || a.distinctiveFeatures || "",
          // Don't let AI's ageAppearance ("appears 10-12 years old") override a story-set ageRange ("adult")
          ageAppearance:        c.ageAppearance || (c.ageRange ? "" : a.ageAppearance) || "",
          gender:               c.gender || (a.gender !== "unknown" ? a.gender : ""),
          roleType:             c.roleType || a.suggestedRole || c.roleType,
        };
      }));
      if (typeof window !== "undefined") {
        const conflict = /\b(dark|brown|black|melanated|african)\b/i.test(data.analysis.colorDescription || "") !==
          /\b(dark|brown|black|melanated|african)\b/i.test((characters.find(x => x.characterId === charId)?.skinTone) || "");
        if (conflict) {
          console.warn(`[AI Read] Skin tone conflict for ${charId}: story=${characters.find(x => x.characterId === charId)?.skinTone} vs AI-read=${data.analysis.colorDescription}. Story wins.`);
        }
      }

      const providerLabel = data.provider === "ollama-vision" ? "Local (Ollama)" : data.provider === "claude-vision" ? "Claude" : data.provider === "gpt-vision" ? "GPT-4o" : data.provider || "AI";
      const confidence = a.confidence === "high" ? "high confidence" : a.confidence === "medium" ? "medium confidence" : "low confidence";
      setLastAction(`${providerLabel} read the image (${confidence}) — visual fields filled in for ${charId}.`);
    } catch (err) {
      setLastAction(`AI Read Look error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setAnalyzingCharacter(null);
    }
  }

  // ── Manually save a character to the character registry (DB) ────────────────
  // Strategy: POST to create. If 409 (name already exists) → find existing record → PATCH to update.
  async function saveCharacterToRegistry(char: CharacterIdentity) {
    setSavingCharacter(char.characterId);
    setSavedCharacter(null);

    const payload = {
      name: char.displayName,
      characterId: char.characterId,
      gender: char.gender,
      role: char.roleType,
      age: char.ageRange,
      voiceId: char.voiceId || null,
      language: char.language || null,
      imageUrl: char.imageUrl || null,
      visualDescription: [char.species, char.colorDescription, char.clothingDetails, char.distinctiveFeatures].filter(Boolean).join(", ") || null,
      defaultSpeechStyle: char.speechStyle || null,
      personality: char.emotionProfile || null,
    };

    try {
      // Step 1 — try to create
      const createRes = await fetch("/api/character-voices", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (createRes.status === 201 || createRes.ok) {
        // Created fresh
        setSavedCharacter(char.characterId);
        setLastAction(`${char.displayName} saved to Character Registry.`);
        setTimeout(() => setSavedCharacter(null), 3000);
        return;
      }

      if (createRes.status === 409) {
        // Name already exists in DB — find the existing record and update it
        const listRes = await fetch("/api/character-voices");
        if (!listRes.ok) {
          // Can't look up — but character IS already saved, treat as success
          setSavedCharacter(char.characterId);
          setLastAction(`${char.displayName} is already in Character Registry.`);
          setTimeout(() => setSavedCharacter(null), 3000);
          return;
        }

        const listData = await listRes.json();
        const existing = (listData.voices || []).find(
          (v: { name: string; id: string }) =>
            v.name.toUpperCase() === char.displayName.toUpperCase()
        );

        if (existing?.id) {
          // PATCH the existing record with updated fields
          const patchRes = await fetch(`/api/character-voices/${existing.id}`, {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              gender: char.gender || undefined,
              voiceId: char.voiceId || undefined,
              language: char.language || undefined,
              imageUrl: char.imageUrl || undefined,
              visualDescription: payload.visualDescription || undefined,
              defaultSpeechStyle: char.speechStyle || undefined,
              role: char.roleType || undefined,
            }),
          });
          if (patchRes.ok) {
            setSavedCharacter(char.characterId);
            setLastAction(`${char.displayName} updated in Character Registry.`);
            setTimeout(() => setSavedCharacter(null), 3000);
          } else {
            const d = await patchRes.json().catch(() => ({}));
            setLastAction(`Update failed: ${d.error || patchRes.status}`);
          }
        } else {
          // Found 409 but couldn't find record — name likely slightly different case
          setSavedCharacter(char.characterId);
          setLastAction(`${char.displayName} already exists in Character Registry.`);
          setTimeout(() => setSavedCharacter(null), 3000);
        }
        return;
      }

      // Other error
      const errData = await createRes.json().catch(() => ({}));
      setLastAction(`Save failed (${createRes.status}): ${errData.error || "Check DB connection in .env"}`);
    } catch (err) {
      setLastAction(`Save error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSavingCharacter(null);
    }
  }

  // ── Image picker — open asset library to borrow an image for a character ────
  async function openImagePicker(charId: string) {
    setImagePickerForCharId(charId);
    setImagePickerLoading(true);
    setImagePickerAssets([]);
    try {
      // Fetch all image assets + character-voice images
      const [assetsRes, charsRes] = await Promise.all([
        fetch("/api/assets?type=image"),
        fetch("/api/character-voices"),
      ]);

      const combined: Array<{ id: string; name: string; fileUrl?: string; filePath?: string; source?: string }> = [];

      if (assetsRes.ok) {
        const d = await assetsRes.json();
        (d.assets || []).forEach((a: { id: string; name: string; fileUrl?: string; filePath?: string; source?: string }) => {
          if (a.fileUrl || a.filePath) combined.push(a);
        });
      }

      // Also pull images from character registry (so Joe's portrait shows up)
      if (charsRes.ok) {
        const d = await charsRes.json();
        (d.voices || []).forEach((v: { id: string; name: string; imageUrl?: string }) => {
          if (v.imageUrl) {
            combined.push({
              id: `cv_${v.id}`,
              name: v.name,
              fileUrl: v.imageUrl.startsWith("http") || v.imageUrl.startsWith("/api/") ? v.imageUrl : `/api/media/${v.imageUrl.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`,
              source: "character_registry",
            });
          }
        });
      }

      setImagePickerAssets(combined);
    } catch {
      setImagePickerAssets([]);
    }
    setImagePickerLoading(false);
  }

  function assignImageToCharacter(charId: string, imageUrl: string) {
    setCharacters(prev => prev.map(c =>
      c.characterId === charId ? { ...c, imageUrl, hasImage: true, imageLocked: false } : c
    ));
    setImagePickerForCharId(null);
    setLastAction(`Image assigned to ${characters.find(c => c.characterId === charId)?.displayName || charId} — AI is reading the look...`);
    // Auto-analyze the imported image
    analyzeCharacterImage(charId, imageUrl);
  }

  // ── Generate portrait for a character using their full visual description ──
  // Upserts the character to the Character Registry and saves imageUrl + all 3 reference shots.
  // Creates the registry entry if it doesn't exist yet (no dbId) so every planner character
  // is automatically searchable in the main character library after portrait generation.
  async function persistPortraitToRegistry(
    char: CharacterIdentity,
    imageUrl: string,
    refShots?: Array<{url: string; angle: string; label: string}>,
  ) {
    try {
      let targetId = char.dbId;

      if (!targetId) {
        // Character not yet in registry — create it now
        const visualDescription = [char.species, char.colorDescription, char.clothingDetails, char.distinctiveFeatures]
          .filter(Boolean).join(", ") || null;
        const createRes = await fetch("/api/character-voices", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: char.displayName,
            characterId: char.characterId,
            gender: char.gender,
            role: char.roleType,
            age: char.ageRange,
            voiceId: char.voiceId || null,
            language: char.language || null,
            imageUrl,
            visualDescription,
            defaultSpeechStyle: char.speechStyle || null,
            personality: char.emotionProfile || null,
          }),
        });
        if (createRes.ok || createRes.status === 201) {
          const created = await createRes.json().catch(() => ({}));
          targetId = created.id || created.voice?.id || null;
          // Patch the planner character state with the new dbId so future saves are direct
          if (targetId) {
            setCharacters(prev => prev.map(c =>
              c.characterId === char.characterId ? { ...c, dbId: targetId as string } : c
            ));
          }
        } else if (createRes.status === 409) {
          // Already exists — look up the existing id
          const listRes = await fetch("/api/character-voices");
          if (listRes.ok) {
            const listData = await listRes.json();
            const existing = (listData.voices || []).find(
              (v: { name: string; id: string }) => v.name.toUpperCase() === char.displayName.toUpperCase()
            );
            targetId = existing?.id || null;
            if (targetId) {
              setCharacters(prev => prev.map(c =>
                c.characterId === char.characterId ? { ...c, dbId: targetId as string } : c
              ));
            }
          }
        }
      }

      if (!targetId) return; // couldn't resolve id — skip

      // PATCH with imageUrl + referenceImages (the 3 angle shots)
      const patchBody: Record<string, unknown> = { imageUrl };
      if (refShots && refShots.length > 0) patchBody.referenceImages = refShots;

      await fetch(`/api/character-voices/${targetId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patchBody),
      });
    } catch { /* best-effort — never block portrait display on registry failure */ }
  }

  async function generateCharacterPortrait(char: CharacterIdentity, overrideStyle?: string, overrideModelId?: string) {
    setGeneratingPortrait(char.characterId);
    const visualDescFull = buildVisualDescription(char);
    const visualDesc = visualDescFull.slice(0, 1200);
    const effectiveStyle = overrideStyle || charStyles[char.characterId] || effectiveProjectStyle || "3d-cinematic";

    const stylePrefix =
      effectiveStyle === "realistic"
        ? "Ultra-realistic photographic full body shot, cinematic lighting, real person aesthetic, no cartoon or CGI"
        : effectiveStyle === "nollywood"
        ? "Nollywood film full body shot, realistic Nigerian cinema aesthetic, BLACK WEST AFRICAN character, dark rich melanated skin, deep brown complexion, natural warm lighting"
        : effectiveStyle === "2d-cartoon"
        ? "2D cartoon illustration, clean bold outlines, flat cel-shaded colors, Disney storybook art style"
        : effectiveStyle === "anime"
        ? "Anime style illustration, clean linework, detailed character design, Japanese animation quality"
        : effectiveStyle === "storybook"
        ? "Children's storybook illustration, warm painterly style, Pixar short film quality"
        : effectiveStyle === "comic"
        ? "Comic book illustration, bold ink outlines, vibrant flat colors, graphic novel style"
        : "3D animated film, Pixar/DreamWorks quality, volumetric lighting";

    // Build age anchor — age must be FIRST tokens so image models honour it
    const ageRaw = char.ageRange || char.ageAppearance || "";
    const ageNum = parseInt(ageRaw);
    const isChild = ageNum > 0 && ageNum < 18;
    const ageAnchor = ageRaw
      ? isChild
        ? `${ageNum}-year-old child, CHILD NOT ADULT, young face, child body proportions, age ${ageNum},`
        : `${ageRaw},`
      : "";

    const isPhotoImport = char.tags?.includes("photo-import") && !!char.imageUrl;
    const referenceImageUrl = isPhotoImport ? char.imageUrl : undefined;
    const forceIdentityLock = isPhotoImport;
    const effectiveModelId = overrideModelId
      || charPortraitModel[char.characterId]
      || (isPhotoImport ? "fal_flux_pulid" : undefined);

    const negativePrompt = (() => {
      const ageBlock = isChild
        ? "adult, mature face, grown up, aged, wrinkles, 20 years old, 30 years old, man, woman, adult body"
        : "";
      const styleBlock = effectiveStyle === "realistic"
        ? "cartoon, 3D CGI, anime, illustration, sketch, painting, digital art, plastic skin"
        : effectiveStyle === "nollywood"
        ? "cartoon, 3D CGI, anime, illustration, sketch, painting, digital art, plastic skin, white skin, light skin, pale skin, European features, Caucasian"
        : effectiveStyle === "2d-cartoon"
        ? "3D render, photorealistic, CGI, bokeh, realistic"
        : effectiveStyle === "3d-cinematic"
        ? "2D flat illustration, cartoon drawing, anime, sketch, watercolor, flat colors, clipart"
        : "";
      // Anti-shirtless guard — image models default Black male characters to shirtless
      // fitness poses when no clothing is specified. The default clothing line in
      // basePrompt does most of the work; this is the safety net.
      const clothingBlock = "shirtless, bare chested, topless, no shirt, half nude, half naked, naked torso, exposed chest, fitness model pose, gym poster, swimwear, underwear, briefs, speedo, fully nude, just shorts";
      return [ageBlock, styleBlock, clothingBlock, "cropped, cut off, partial body, headshot only"].filter(Boolean).join(", ");
    })();

    // The 3 full-body angle framings — must show the character head to toe
    const ANGLE_SHOTS = [
      { angle: "front",         label: "main",       framing: "FULL BODY front view, standing neutral pose, facing camera, visible from head to toe including feet, clean plain background." },
      { angle: "three-quarter", label: "variation_1", framing: "FULL BODY three-quarter angle view, slight left turn, standing pose, entire body visible from head to feet, clean plain background." },
      { angle: "side",          label: "variation_2", framing: "FULL BODY side profile view, 90-degree turn, standing pose, full height visible from head to feet, clean plain background." },
    ];

    // Nigerian/African context — force dark skin even if colorDescription is empty/wrong
    const isNigerianContext = effectiveStyle === "nollywood"
      || ["nigeri", "nollywood", "yoruba", "igbo", "hausa", "lagos", "abuja", "african"].some(kw =>
        (storyCulture || "").toLowerCase().includes(kw) || (storyCountry || "").toLowerCase().includes(kw));
    const hasExplicitLightSkin = !!(char.colorDescription || char.skinTone || "").toLowerCase().match(/\b(light|fair|pale|white|beige)\b/);
    const skinAnchor = (isNigerianContext && !hasExplicitLightSkin)
      ? "BLACK WEST AFRICAN, dark rich melanated skin, deep brown complexion, African features,"
      : "";

    // Era + culture lock for clothing/setting accuracy
    const eraLine = (storyEra || storyCulture)
      ? `Era: ${[storyEra, storyCulture].filter(Boolean).join(", ")}. Clothing, hairstyle, and accessories MUST reflect this time period and culture exactly.`
      : "";

    // Force a clothing line when the character has no wardrobe/clothing fields set —
    // otherwise the image model defaults Black male characters to shirtless fitness shots,
    // and PuLID then locks every scene to that shirtless body.
    const descLower = (visualDesc || "").toLowerCase();
    const hasClothingMention = /\b(wearing|shirt|jacket|coat|dress|gown|hoodie|sweater|jumper|trouser|pant|jean|skirt|robe|kaftan|outfit|uniform|tunic|suit|blouse|t-shirt|top)\b/i.test(descLower);
    const clothingFloor = hasClothingMention
      ? ""
      : "fully clothed in everyday modest clothing — shirt or top fully covering the torso, jeans or trousers covering the legs.";

    // Build shared base prompt
    const basePrompt = [
      ageAnchor,
      stylePrefix,
      skinAnchor,
      eraLine,
      `CHARACTER ${char.displayName.toUpperCase()} — EXACT FIXED APPEARANCE:`,
      visualDesc || `${char.displayName}, ${char.gender}`,
      clothingFloor,
      "CHARACTER REFERENCE SHEET — consistent design, professional quality, no background distractions.",
    ].filter(Boolean).join(" ");

    try {
      // Generate all 3 angle shots in parallel
      const shotResults = await Promise.all(
        ANGLE_SHOTS.map(shot =>
          fetch("/api/generation/image", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: `${basePrompt} ${shot.framing}`,
              modelId: effectiveModelId,
              negativePrompt,
              referenceImageUrl: referenceImageUrl || undefined,
              useIdentityLock: forceIdentityLock,
              width: 768, height: 1024,
              seed: genSeed !== null ? genSeed : undefined,
            }),
          }).then(r => r.json()).catch(() => null)
        )
      );

      // Resolve URLs
      const shots = ANGLE_SHOTS.map((shot, i) => {
        const d = shotResults[i];
        if (!d || d.error) return null;
        const url = d.imageUrl || (d.imagePath ? assetToMediaUrl(d.imagePath) : null);
        return url ? { url, angle: shot.angle, label: shot.label } : null;
      }).filter((s): s is {url: string; angle: string; label: string} => s !== null);

      const mainShot = shots.find(s => s.label === "main") ?? shots[0] ?? null;

      if (!mainShot) {
        setUiError(`Portrait failed: no images returned. Check generation model and try again.`);
        setGeneratingPortrait(null);
        return;
      }

      // Save old portrait for undo
      if (char.imageUrl) {
        setPrevCharImages(prev => ({ ...prev, [char.characterId]: char.imageUrl! }));
      }

      // Update planner character state: main image + all 3 reference shots
      setCharacters(prev => prev.map(c =>
        c.characterId === char.characterId
          ? { ...c, imageUrl: mainShot.url, hasImage: true, imageLocked: false }
          : c
      ));
      setCharRefImages(prev => ({ ...prev, [char.characterId]: shots }));

      setLastAction(`3 full-body shots generated for ${char.displayName} — saving to registry...`);

      // Auto-save to Character Registry (creates entry if first time, patches if exists)
      persistPortraitToRegistry(char, mainShot.url, shots);

      // Analyse the main portrait to auto-fill visual fields
      analyzeCharacterImage(char.characterId, mainShot.url);

    } catch (err) {
      console.error("Portrait gen failed:", err);
      setUiError(`Portrait generation failed for ${char.displayName}: ${err instanceof Error ? err.message : String(err)}`);
    }
    setGeneratingPortrait(null);
  }

  // ── Archive scene → saves to library + removes from active assembly ──
  // Full scene data is kept in archivedScenes so it can be restored anytime
  async function archiveScene(sceneId: string) {
    const scene = scenes.find(s => s.sceneId === sceneId);
    if (!scene) return;
    const imgUrl = sceneImages[sceneId];
    const vidUrl = sceneVideos[sceneId];
    // Save image to asset library (best effort)
    if (imgUrl) {
      try {
        await fetch("/api/assets", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: "image", name: `${scene.sceneId}: ${scene.title}`,
            description: scene.description.slice(0, 200),
            filePath: imgUrl,
            tags: ["archived", "hybrid", scene.sceneId, projectTitle || ""],
            source: "hybrid-archive",
          }),
        });
      } catch { /* best effort */ }
    }
    // Build old→new ID mapping BEFORE renumbering — critical for remapping images/videos
    // Bug: without this, when SC02 is archived, old SC03 becomes new SC02 in scenes[] but
    // sceneImages still has key "SC03" → new SC02 appears imageless even though it has one.
    const remaining = scenes.filter(s => s.sceneId !== sceneId);
    const idMap: Record<string, string> = {};
    remaining.forEach((s, i) => {
      idMap[s.sceneId] = `SC${String(i + 1).padStart(2, "0")}`;
    });

    // Keep full scene data for restore
    setArchivedScenes(prev => [...prev, { scene, imageUrl: imgUrl, videoUrl: vidUrl }]);
    // Renumber scenes
    setScenes(remaining.map((s, i) => ({ ...s, scene: i + 1, sceneId: `SC${String(i + 1).padStart(2, "0")}` })));
    // Remap selection + assembly order to new IDs
    setSelectedSceneIds(prev => prev.filter(id => id !== sceneId).map(id => idMap[id] ?? id));
    setAssemblyOrder(prev => prev.filter(id => id !== sceneId).map(id => idMap[id] ?? id));
    // Remap sceneImages with new IDs — DO NOT simply delete the archived ID; remap all others
    setSceneImages(prev => {
      const n: Record<string, string> = {};
      for (const [oldId, url] of Object.entries(prev)) {
        if (oldId === sceneId) continue; // this is the archived one — drop it
        const newId = idMap[oldId];
        if (newId) n[newId] = url; // remap to new numbering
      }
      return n;
    });
    setSceneVideos(prev => {
      const n: Record<string, string> = {};
      for (const [oldId, url] of Object.entries(prev)) {
        if (oldId === sceneId) continue;
        const newId = idMap[oldId];
        if (newId) n[newId] = url;
      }
      return n;
    });
    setLastAction(`"${scene.title}" moved to library — restore any time`);
    setShowArchivedPanel(true);
  }

  // ── Restore scene from library back into active assembly ──
  function restoreScene(idx: number) {
    const archived = archivedScenes[idx];
    if (!archived) return;
    const newSceneNum = scenes.length + 1;
    const newSceneId = `SC${String(newSceneNum).padStart(2, "0")}`;
    const restored: HybridScene = { ...archived.scene, scene: newSceneNum, sceneId: newSceneId };
    setScenes(prev => [...prev, restored]);
    setSelectedSceneIds(prev => [...prev, newSceneId]);
    if (archived.imageUrl) setSceneImages(prev => ({ ...prev, [newSceneId]: archived.imageUrl! }));
    if (archived.videoUrl) setSceneVideos(prev => ({ ...prev, [newSceneId]: archived.videoUrl! }));
    setArchivedScenes(prev => prev.filter((_, i) => i !== idx));
    setLastAction(`"${archived.scene.title}" restored to assembly as ${newSceneId}`);
  }

  // ── Write current project state to DB (used before switching/creating) ──
  async function flushCurrentProject() {
    // Fall back to URL param or default slot — never silently skip
    const id = activeProjLocalId
      || (typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("projectId") : null)
      || "ghs_hybrid_default";
    if (!id) return;
    const data = {
      projectId, projectTitle, projectPhase, idea, genre, tone,
      expandedSummary, characters, scenes, sceneImages, sceneVideos, sceneVideoVersions, lastAction,
      projectStyle, savedCuts, archivedScenes, sceneIntelligence,
      narratorAudioUrl, selectedMusicUrl, selectedMusicName, selectedVideoModelId,
      subtitleStyle, storyMode, soundTier, screenplay, screenplayAuthor, scriptSegments, characterAudioUrls, characterPiperVoices,
      // 2026-05-10 fix — these were missing from the manual flush, so clicking Save or switching
      // projects wiped Gen Max state. Now they're included same as the autosave effect.
      sceneBeatImages, selectedBeatImages,
      useMaxImageScenes: Array.from(useMaxImageScenes),
      timestamp: Date.now(),
    };
    try {
      await fetch("/api/hybrid/saved-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId: id, data }),
      });
      // Refresh project list so My Projects panel stays current
      fetch("/api/hybrid/saved-state?list=true")
        .then(r => r.json())
        .then(d => { if (d.projects) setProjectList(d.projects); })
        .catch(() => {});
    } catch { /* silent */ }
  }

  // ── Load a saved project by its local ID ──
  async function loadProject(targetId: string) {
    await flushCurrentProject(); // save current before switching
    try {
      const dbRes = await fetch(`/api/hybrid/saved-state?localId=${encodeURIComponent(targetId)}`);
      if (!dbRes.ok) return;
      const dbData = await dbRes.json();
      if (!dbData.found || !dbData.data) return;
      const data = dbData.data;
      setActiveProjLocalId(targetId);
      window.history.replaceState(null, "", `/dashboard/hybrid-planner?projectId=${encodeURIComponent(targetId)}`);
      setProjectId(data.projectId || null);
      setProjectTitle(data.projectTitle || "Untitled Hybrid Project");
      setProjectPhase(data.projectPhase || "STORY_INPUT");
      setIdea(data.idea || "");
      setGenre(data.genre || "");
      setTone(data.tone || "");
      setExpandedSummary(data.expandedSummary || "");
      if (data.characters?.length > 0) { setCharacters(data.characters); setCharactersMade(true); } else { setCharacters([]); setCharactersMade(false); }
      const loadedScenes = data.scenes || [];
      setScenes(loadedScenes);
      setSceneImages(data.sceneImages || {});
      // Only restore videos for sceneIds that exist in THIS project's scenes.
      const validSceneIds = new Set(loadedScenes.map((s: { sceneId: string }) => s.sceneId));
      const filteredVideos = Object.fromEntries(
        Object.entries((data.sceneVideos || {}) as Record<string, string>).filter(([id]) => validSceneIds.has(id))
      );
      setSceneVideos(filteredVideos);
      const filteredVersions = Object.fromEntries(
        Object.entries((data.sceneVideoVersions || {}) as Record<string, string[]>).filter(([id]) => validSceneIds.has(id))
      );
      setSceneVideoVersions(filteredVersions);
      setLastAction(data.lastAction || "Project loaded");
      if (data.projectStyle) setProjectStyle(data.projectStyle);
      setSavedCuts(data.savedCuts || []);
      setArchivedScenes(data.archivedScenes || []);
      if (data.sceneIntelligence) setSceneIntelligence(data.sceneIntelligence);
      if (data.narratorAudioUrl) setNarratorAudioUrl(data.narratorAudioUrl); else setNarratorAudioUrl(null);
      if (data.selectedMusicUrl) { setSelectedMusicUrl(data.selectedMusicUrl); setSelectedMusicName(data.selectedMusicName || ""); } else { setSelectedMusicUrl(null); setSelectedMusicName(""); }
      if (data.subtitleStyle) setSubtitleStyle(data.subtitleStyle); else setSubtitleStyle("classic");
      if (data.storyMode) setStoryMode(data.storyMode); else setStoryMode("mixed");
      if (data.soundTier && ["ghs-sound", "ghs-plus", "ghs-pro", "ghs-premium"].includes(data.soundTier)) {
        setSoundTier(data.soundTier as "ghs-sound" | "ghs-plus" | "ghs-pro" | "ghs-premium");
      }
      setScreenplay(data.screenplay || "");
      setScreenplayAuthor(data.screenplayAuthor || "");
      setScriptSegments(data.scriptSegments || []);
      setCharacterAudioUrls(data.characterAudioUrls || {});
      setCharacterPiperVoices(data.characterPiperVoices || {});
      setShowScriptReview((data.scriptSegments?.length ?? 0) > 0);
      setSelectedSceneIds([]);
      setAssemblyOrder([]);
      setAssemblyInitialized(false);
      setShowProjectSwitcher(false);
      setLastAction(`Opened: "${data.projectTitle || "Untitled"}"`);
    } catch (err) { console.error("loadProject failed:", err); }
  }

  // ── Load images from asset library for the picker ──
  async function openLibraryImport(forSceneId?: string) {
    setImportImageForSceneId(forSceneId ?? null);
    setImportLibraryOpen(true);
    if (libraryImages.length > 0) return; // already loaded
    setLoadingLibraryImages(true);
    try {
      const res = await fetch("/api/assets?type=image");
      const data = await res.json();
      setLibraryImages(data.assets || []);
    } catch { /* ignore */ }
    setLoadingLibraryImages(false);
  }

  // ── Import a single image from library into assembly as a new scene ──
  function importImageFromLibrary(asset: LibraryImageAsset) {
    const sceneNum = scenes.length + 1;
    const sceneId = `SC${String(sceneNum).padStart(2, "0")}`;
    const imgUrl = assetToMediaUrl(asset.filePath);
    const newScene: HybridScene = {
      sceneId, scene: sceneNum,
      title: asset.name || `Library Image ${sceneNum}`,
      description: asset.description || asset.name || "",
      sceneType: "image-led",
      narrationMode: "full-narration",
      narrationStrength: "medium",
      narrationScript: "",
      musicStyle: "",
      musicIntensity: "medium",
      sfx: "",
      ambience: "",
      motionDuration: sceneDurationSec,
      imageTreatment: "Static",
      credits: 1,
      reason: "Imported from asset library",
      characterIds: [],
      dialogueDensity: "low",
      emotionalWeight: "neutral",
      location: "",
      timeOfDay: "",
      mood: "",
      shots: [],
      audioPlan: defaultAudioPlan(),
      costEstimate: 1,
      status: "generated",
    };
    setScenes(prev => [...prev, newScene]);
    setSceneImages(prev => ({ ...prev, [sceneId]: imgUrl }));
    setSelectedSceneIds(prev => [...prev, sceneId]);
    setLastAction(`"${asset.name}" imported from library as ${sceneId}`);
  }

  // ── AI Prepare Assembly — narrate + plan music/SFX for all selected scenes ──
  async function aiPrepareAssembly() {
    const toPrep = scenes.filter(s => selectedSceneIds.includes(s.sceneId));
    if (toPrep.length === 0) return;
    setPreparingNarration(true);
    setLastAction("AI is reading your story and preparing narration + music...");
    try {
      // Build full story context from all scene descriptions
      const storyContext = [
        projectTitle,
        expandedSummary || idea,
        ...toPrep.map(s => `${s.sceneId}: ${s.title}. ${s.description}`),
      ].join("\n\n");

      // Call audio-plan with full story context — AI narrates each scene
      const res = await fetch("/api/hybrid/audio-plan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenes: toPrep,
          characters,
          storyContext,
          generateNarration: true,
        }),
      });
      const data = await res.json();

      setScenes(prev => prev.map(s => {
        const idx = toPrep.findIndex(t => t.sceneId === s.sceneId);
        if (idx < 0) return s;
        const plan = data.audioPlans?.[idx];
        const narration = plan?.narrationScript || data.narrationScripts?.[idx] || s.narrationScript;
        if (plan) return { ...s, audioPlan: plan, narrationScript: narration };
        // Fallback: at minimum populate sfxList from scene.sfx string
        const sfxFallback = s.sfx ? s.sfx.split(",").map((x: string) => x.trim()).filter(Boolean) : (s.audioPlan?.sfxList ?? []);
        const ambFallback = s.ambience ? s.ambience.split(",").map((x: string) => x.trim()).filter(Boolean) : (s.audioPlan?.ambienceList ?? []);
        return { ...s, audioPlan: { ...(s.audioPlan ?? {}), sfxList: sfxFallback, ambienceList: ambFallback }, narrationScript: narration };
      }));
      setLastAction("AI narration + audio plan ready — review before assembling");
      setReviewMode(true);
    } catch (err) {
      console.error("aiPrepareAssembly failed:", err);
      setUiError("AI preparation failed. You can still assemble manually.");
    }
    setPreparingNarration(false);
  }

  // ── Create Scene Manually (the straight-forward path) ──
  async function createScene() {
    if (!newSceneText.trim()) return;
    setCreatingScene(true);
    setUiError(null);
    const sceneNum = scenes.length + 1;
    const sceneId = `SC${String(sceneNum).padStart(2, "0")}`;
    const charIds = newSceneCharIds.length > 0 ? newSceneCharIds : characters.map(c => c.characterId);

    // Build scene object immediately — visible in board right away
    const newScene: HybridScene = {
      sceneId, scene: sceneNum,
      title: newSceneText.slice(0, 60),
      description: newSceneText,
      sceneType: "hybrid",
      narrationMode: "medium", narrationStrength: "medium", narrationScript: "",
      musicStyle: newSceneMood || "cinematic", musicIntensity: "medium",
      sfx: "", ambience: "", motionDuration: newSceneDuration, imageTreatment: "Static",
      credits: 2, reason: "User created",
      characterIds: charIds,
      dialogueDensity: "low", emotionalWeight: "medium",
      location: newSceneLocation, timeOfDay: newSceneTimeOfDay, mood: newSceneMood,
      shots: [],
      audioPlan: { narrationIntensity: "medium", musicMood: newSceneMood || "cinematic", musicIntensity: "medium", sfxList: [], ambienceList: [], transitionAudio: "crossfade" },
      costEstimate: 2, status: "draft",
    };
    setScenes(prev => [...prev, newScene]);
    setLastAction(`Scene ${sceneId} created — generating image...`);

    // Generate scene image (Pruna via /api/hybrid/scene-image)
    try {
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId, projectId, sceneText: newSceneText,
          characterIds: charIds, location: newSceneLocation,
          mood: newSceneMood, timeOfDay: newSceneTimeOfDay,
          projectStyle: effectiveProjectStyle,
          seed: genSeed !== null ? genSeed : undefined,
          storyEra: storyEra || undefined,
          storyCulture: (storyCulture || REGION_TO_CULTURE[storyRegion] || undefined),
        }),
      });
      const data = await res.json();
      if (data.imageUrl || data.imagePath) {
        const url = data.imageUrl || `/api/media/${data.imagePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
        setSceneImages(prev => ({ ...prev, [sceneId]: url }));
        if (data.model) setSceneImageModels(prev => ({ ...prev, [sceneId]: data.model }));
        setScenes(prev => prev.map(s => s.sceneId === sceneId ? { ...s, status: "generated" as const } : s));
        setLastAction(`Scene ${sceneId} image generated — planning audio...`);
      }
      // Auto-generate audio plan (AI adds SFX, narration, music automatically)
      try {
        const audioRes = await fetch("/api/hybrid/audio-plan", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, sceneId, scenes: [{ ...newScene, characterIds: charIds }] }),
        });
        const audioData = await audioRes.json();
        const plan = audioData.audioPlans?.[0] || audioData.audioPlan;
        if (plan) {
          setScenes(prev => prev.map(s => s.sceneId === sceneId ? { ...s, audioPlan: plan } : s));
        }
      } catch { /* audio plan is best-effort */ }
      setLastAction(`Scene ${sceneId} ready`);
    } catch (err) {
      console.error("createScene failed:", err);
      setUiError(`Scene image generation failed. Scene was saved — click "Regen" to retry.`);
    }
    // Clear form only after generation completes (not before — text stays visible while generating)
    setNewSceneText("");
    setNewSceneLocation("");
    setNewSceneMood("");
    setNewSceneTimeOfDay("");
    setNewSceneCharIds([]);
    setNewSceneDuration(5);
    setCreatingScene(false);
  }

  // ── Helpers ──
  function updateScene(sceneNum: number, patch: Partial<HybridScene>) {
    setScenes(prev => prev.map(s => {
      if (s.scene !== sceneNum) return s;
      const updated = { ...s, ...patch };
      if (patch.sceneType) {
        const typeInfo = SCENE_TYPES.find(t => t.id === patch.sceneType);
        updated.credits = typeInfo?.credits ?? 2;
      }
      return updated;
    }));
  }

  const handleDragStart = useCallback((sceneNum: number) => { setDragSource(sceneNum); }, []);
  const handleDrop = useCallback((targetNum: number) => {
    if (dragSource === null || dragSource === targetNum) return;
    setScenes(prev => {
      const arr = [...prev];
      const srcIdx = arr.findIndex(s => s.scene === dragSource);
      const tgtIdx = arr.findIndex(s => s.scene === targetNum);
      if (srcIdx < 0 || tgtIdx < 0) return prev;
      const [moved] = arr.splice(srcIdx, 1);
      arr.splice(tgtIdx, 0, moved);
      return arr.map((s, i) => ({ ...s, scene: i + 1, sceneId: `SC${String(i + 1).padStart(2, "0")}` }));
    });
    setDragSource(null);
  }, [dragSource]);

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Progress Bar Component ──
  function ProgressBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
      <div style={{ marginBottom: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: muted }}>{label}</span>
          <span style={{ fontSize: 10, fontWeight: 700, color }}>{value}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: border }}>
          <div style={{ width: `${value}%`, height: "100%", borderRadius: 3, background: color, transition: "width 0.5s" }} />
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning style={{ background: ds.color.paper, minHeight: "100vh", padding: "0 32px 60px", fontFamily: ds.font.sans }}>
      <GateModal />

      {/* ── Quick Preview Modal — image or video lightbox.
            Body scroll-lock + scroll-to-top below ensures the modal is always in view
            regardless of where the user was scrolled when they triggered it. */}
      {previewMedia && (() => {
        if (typeof document !== "undefined") {
          // Run once when previewMedia transitions to non-null. The cleanup happens via
          // the close handler restoring overflow when setPreviewMedia(null) is called below.
          if (document.body.style.overflow !== "hidden") {
            document.body.style.overflow = "hidden";
            window.scrollTo({ top: 0, behavior: "auto" });
          }
        }
        return null;
      })()}
      {previewMedia && (
        <div onClick={() => { setPreviewMedia(null); if (typeof document !== "undefined") document.body.style.overflow = ""; }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.92)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", maxWidth: "90vw", maxHeight: "85vh", borderRadius: 12, overflow: "hidden", boxShadow: "0 0 60px rgba(0,0,0,0.8)" }}>
            {previewMedia.type === "video" ? (
              <video src={previewMedia.url} controls autoPlay style={{ maxWidth: "90vw", maxHeight: "80vh", display: "block", borderRadius: 10 }} />
            ) : (
              <img src={previewMedia.url} alt={previewMedia.title} style={{ maxWidth: "90vw", maxHeight: "80vh", display: "block", borderRadius: 10, objectFit: "contain" }} />
            )}
            <div style={{ position: "absolute", top: 10, left: 14, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "4px 10px", fontSize: 11, color: "#fff", fontWeight: 600 }}>
              {previewMedia.title}
            </div>
            <button onClick={() => { setPreviewMedia(null); if (typeof document !== "undefined") document.body.style.overflow = ""; }}
              style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon.X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Click outside to close</p>
        </div>
      )}

      {/* ── Pick Faces from SC1 Modal ──────────────────────────────────────────────
          WHY: Face drift in multi-character scenes can't be solved by text prompts alone.
          This modal lets the user click each character's face in the SC1 image and crops
          it to 512×512, which is then persisted as that character's imageUrl. Subsequent
          scene generation will use these SC1-extracted crops as identity references.
          ───────────────────────────────────────────────────────────────────────────── */}
      {pickFacesState && (
        <div
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,0.94)", zIndex: 9999,
            display: "flex", flexDirection: "column", alignItems: "center",
            justifyContent: "flex-start", overflowY: "auto", padding: "20px 16px 40px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 860, background: "#12121e",
              border: "1px solid #2a2a40", borderRadius: 16, overflow: "hidden",
              boxShadow: "0 0 60px rgba(0,0,0,0.8)",
            }}
          >
            {/* Header */}
            <div style={{ padding: "14px 18px", borderBottom: "1px solid #2a2a40", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Lock Faces from SC1</div>
                <div style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                  Click each character's face in the image below. Each click saves a 256×256 crop as their portrait.
                </div>
              </div>
              <button
                onClick={() => setPickFacesState(null)}
                style={{ width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
              >
                <Icon.X style={{ width: 13, height: 13 }} />
              </button>
            </div>

            {/* Progress indicator — which character to click next */}
            <div style={{ padding: "10px 18px", borderBottom: "1px solid #2a2a40", display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
              {pickFacesState.characters.map((c, i) => {
                const isNext = i === pickFacesState.currentIdx && !pickFacesState.saving;
                const isDone = pickFacesState.clicks[i] !== null;
                return (
                  <div key={c.characterId} style={{
                    padding: "4px 12px", borderRadius: 20, fontSize: 10, fontWeight: 700,
                    border: isNext ? "2px solid #22c55e" : isDone ? "1px solid #22c55e60" : "1px solid #2a2a40",
                    background: isNext ? "#22c55e18" : isDone ? "#22c55e08" : "transparent",
                    color: isNext ? "#22c55e" : isDone ? "#22c55e80" : muted,
                    transition: "all 0.15s",
                  }}>
                    {isDone ? "✓ " : isNext ? "▶ " : ""}{c.displayName}
                  </div>
                );
              })}
            </div>

            {/* Instruction line */}
            {!pickFacesState.saving && pickFacesState.currentIdx < pickFacesState.characters.length && (
              <div style={{ padding: "8px 18px", background: "#22c55e0c", borderBottom: "1px solid #22c55e30", fontSize: 11, color: "#22c55e", fontWeight: 700 }}>
                Now click {pickFacesState.characters[pickFacesState.currentIdx].displayName}'s face in the image below
              </div>
            )}
            {pickFacesState.currentIdx >= pickFacesState.characters.length && !pickFacesState.saving && (
              <div style={{ padding: "8px 18px", background: "#0084ff0c", borderBottom: "1px solid #0084ff30", fontSize: 11, color: "#0084ff", fontWeight: 700 }}>
                All {pickFacesState.characters.length} face{pickFacesState.characters.length > 1 ? "s" : ""} marked. Click "Save Faces" to persist.
              </div>
            )}

            {/* SC1 image — click to record face position */}
            <div style={{ padding: "12px 18px" }}>
              <div style={{ position: "relative" as const, display: "inline-block", width: "100%", maxWidth: 820, lineHeight: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  ref={pickFacesImgRef}
                  src={pickFacesState.sceneImageUrl}
                  alt="SC1 scene"
                  style={{
                    width: "100%", maxHeight: 540, objectFit: "contain", borderRadius: 8,
                    // Show crosshair only while still collecting clicks
                    cursor: pickFacesState.currentIdx < pickFacesState.characters.length && !pickFacesState.saving ? "crosshair" : "default",
                    display: "block",
                  }}
                  onClick={(e) => {
                    if (pickFacesState.currentIdx >= pickFacesState.characters.length) return;
                    if (pickFacesState.saving) return;

                    const img = pickFacesImgRef.current;
                    if (!img) return;

                    // Convert click (display coords) → original image coords.
                    // img.naturalWidth/Height = original px; img.getBoundingClientRect() = display px.
                    const rect = img.getBoundingClientRect();
                    const displayX = e.clientX - rect.left;
                    const displayY = e.clientY - rect.top;
                    const scaleX = img.naturalWidth / rect.width;
                    const scaleY = img.naturalHeight / rect.height;
                    const origX = Math.round(displayX * scaleX);
                    const origY = Math.round(displayY * scaleY);

                    // Record click and advance to next character
                    setPickFacesState(prev => {
                      if (!prev) return prev;
                      const newClicks = [...prev.clicks];
                      newClicks[prev.currentIdx] = { x: origX, y: origY };
                      return { ...prev, clicks: newClicks, currentIdx: prev.currentIdx + 1 };
                    });
                  }}
                />
                {/* Dot markers for already-clicked faces — rendered in DISPLAY space */}
                {pickFacesState.clicks.map((click, i) => {
                  if (!click || !pickFacesImgRef.current) return null;
                  const img = pickFacesImgRef.current;
                  const rect = img.getBoundingClientRect();
                  // Convert original coords back to display percentage for positioning
                  const displayPctX = (click.x / img.naturalWidth) * 100;
                  const displayPctY = (click.y / img.naturalHeight) * 100;
                  return (
                    <div key={i} style={{
                      position: "absolute" as const,
                      left: `${displayPctX}%`, top: `${displayPctY}%`,
                      transform: "translate(-50%, -50%)",
                      width: 28, height: 28, borderRadius: "50%",
                      border: "2px solid #22c55e", background: "rgba(34,197,94,0.3)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, color: "#22c55e",
                      pointerEvents: "none",
                      boxShadow: "0 0 8px #22c55e80",
                    }}>
                      {i + 1}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Error display */}
            {pickFacesState.error && (
              <div style={{ margin: "0 18px 12px", padding: "8px 12px", background: "#ef444420", border: "1px solid #ef444460", borderRadius: 8, fontSize: 10, color: "#ef4444" }}>
                {pickFacesState.error}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ padding: "12px 18px 16px", borderTop: "1px solid #2a2a40", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {/* Allow resetting clicks to start over */}
              {pickFacesState.clicks.some(c => c !== null) && !pickFacesState.saving && (
                <button
                  onClick={() => setPickFacesState(prev => prev ? { ...prev, clicks: prev.characters.map(() => null), currentIdx: 0, error: null } : prev)}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #2a2a40", background: "transparent", color: muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
                >
                  Reset Clicks
                </button>
              )}
              <button
                onClick={() => setPickFacesState(null)}
                style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #2a2a40", background: "transparent", color: muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}
              >
                Cancel
              </button>
              {/* Save button only active when all characters have been clicked */}
              <button
                disabled={pickFacesState.saving || pickFacesState.currentIdx < pickFacesState.characters.length}
                onClick={async () => {
                  if (!pickFacesState) return;

                  setPickFacesState(prev => prev ? { ...prev, saving: true, error: null } : prev);

                  // Crop size: 256px on each side of the click point, clamped by the API.
                  // 256 half-size → 512×512 crop, which is what the auto-portraits route
                  // also saves. Makes all portrait sizes consistent.
                  const HALF = 256;

                  let savedCount = 0;
                  let lastError: string | null = null;

                  for (let i = 0; i < pickFacesState.characters.length; i++) {
                    const click = pickFacesState.clicks[i];
                    const charEntry = pickFacesState.characters[i];
                    if (!click) continue;

                    const cropBox = {
                      x: click.x - HALF,
                      y: click.y - HALF,
                      width: HALF * 2,
                      height: HALF * 2,
                    };

                    try {
                      const res = await fetch("/api/hybrid/character-portrait-from-scene", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          characterId: charEntry.characterId,
                          sceneImageUrl: pickFacesState.sceneImageUrl,
                          cropBox,
                        }),
                      });
                      const data = await res.json() as { imageUrl?: string; error?: string };
                      if (res.ok && data.imageUrl) {
                        // Update local characters state so Characters tab reflects the new portrait immediately
                        setCharacters(prev => prev.map(c =>
                          (c.characterId === charEntry.characterId || c.dbId === charEntry.characterId)
                            ? { ...c, imageUrl: data.imageUrl! }
                            : c
                        ));
                        savedCount++;
                      } else {
                        lastError = data.error ?? `Failed to save ${charEntry.displayName}`;
                      }
                    } catch (err) {
                      lastError = err instanceof Error ? err.message : "Network error";
                    }
                  }

                  if (lastError) {
                    setPickFacesState(prev => prev ? { ...prev, saving: false, savedCount, error: lastError } : prev);
                  } else {
                    // All saved — close modal
                    setPickFacesState(null);
                  }
                }}
                style={{
                  padding: "7px 18px", borderRadius: 8, border: "none",
                  background: (pickFacesState.saving || pickFacesState.currentIdx < pickFacesState.characters.length)
                    ? "#2a2a40"
                    : "linear-gradient(135deg,#22c55e,#16a34a)",
                  color: (pickFacesState.saving || pickFacesState.currentIdx < pickFacesState.characters.length) ? muted : "#fff",
                  fontSize: 10, fontWeight: 700,
                  cursor: (pickFacesState.saving || pickFacesState.currentIdx < pickFacesState.characters.length) ? "not-allowed" : "pointer",
                }}
              >
                {pickFacesState.saving
                  ? `Saving... (${pickFacesState.savedCount}/${pickFacesState.characters.length})`
                  : `Save Faces (${pickFacesState.characters.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Model Picker with Style Adviser ── */}
      {showAidPicker && (() => {
        // ── All model data ──
        const AID_MODELS: Array<{
          id: string; name: string; price: number; network: "Segmind"|"MuAPI"|"FAL"|"Runway"|"Kling";
          res: string; maxSec: number; color: string;
          scores: { "2d": number; "3d": number; cartoon: number; realistic: number };
          tags2d?: string; tags3d?: string; tagCartoon?: string; tagRealistic?: string;
        }> = [
          { id:"segmind_pruna_video",     name:"Pruna P Video",       price:0.005, network:"Segmind", res:"720p",   maxSec:15, color:"#22c55e",
            scores:{"2d":2,"3d":1,"cartoon":3,"realistic":1},
            tags2d:"drafts only", tagCartoon:"budget cartoon draft" },
          // fal_ltx_video REMOVED — times out at 30% consistently. Use Segmind Pruna or Seedance instead.
          { id:"muapi_seedance_lite",    name:"Seedance Lite",       price:0.020, network:"MuAPI",   res:"480p",   maxSec:5,  color:"#6ee7b7",
            scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2},
            tags2d:"cheap Seedance draft", tagCartoon:"cheap animated motion" },
          { id:"fal_wan_lite",           name:"Wan Lite 1.3B",       price:0.025, network:"FAL",     res:"480p",   maxSec:5,  color:"#4ade80",
            scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2},
            tags2d:"budget Wan draft", tagCartoon:"cheap Wan motion" },
          { id:"muapi_wan_v2_1_480p",     name:"Wan 2.1 480p",        price:0.03,  network:"MuAPI",   res:"480p",   maxSec:5,  color:"#34d399",
            scores:{"2d":3,"3d":2,"cartoon":3,"realistic":2},
            tags2d:"cheap 2D draft", tagCartoon:"cheap animated draft" },
          { id:"muapi_seedance_v1_pro",   name:"Seedance 1.0 Pro",    price:0.04,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#4ade80",
            scores:{"2d":4,"3d":2,"cartoon":4,"realistic":2},
            tags2d:"clean flat motion", tagCartoon:"smooth cartoon motion" },
          { id:"muapi_wan_v2_1_720p",     name:"Wan 2.1 720p",        price:0.05,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#2dd4bf",
            scores:{"2d":3,"3d":3,"cartoon":3,"realistic":3},
            tags2d:"solid 2D", tags3d:"budget 3D scenes", tagRealistic:"basic realism" },
          { id:"muapi_seedance_v2",       name:"Seedance 2.0",        price:0.08,  network:"MuAPI",   res:"720p",   maxSec:5,  color:"#38bdf8",
            scores:{"2d":5,"3d":3,"cartoon":5,"realistic":3},
            tags2d:"BEST 2D on MuAPI", tagCartoon:"BEST cartoon on MuAPI", tags3d:"decent 3D" },
          { id:"muapi_seedance_v2_1080p", name:"Seedance 2.0 1080p",  price:0.12,  network:"MuAPI",   res:"1080p",  maxSec:5,  color:"#60a5fa",
            scores:{"2d":5,"3d":4,"cartoon":5,"realistic":4},
            tags2d:"BEST 2D full HD", tagCartoon:"BEST cartoon HD", tags3d:"good 3D detail", tagRealistic:"cinematic realism" },
          { id:"fal_hailuo_standard",     name:"Hailuo Standard",     price:0.05,  network:"FAL",     res:"720p",   maxSec:6,  color:"#a3e635",
            scores:{"2d":3,"3d":3,"cartoon":4,"realistic":2},
            tagCartoon:"expressive cartoon", tags2d:"stylized 2D" },
          { id:"fal_kling_2_5_standard",  name:"Kling 2.5 Standard",  price:0.10,  network:"FAL",     res:"1080p",  maxSec:10, color:"#facc15",
            scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4},
            tags3d:"solid 3D scenes", tagRealistic:"good realism, 10s" },
          { id:"fal_hailuo_pro",          name:"Hailuo Pro",          price:0.15,  network:"FAL",     res:"1080p",  maxSec:6,  color:"#fb923c",
            scores:{"2d":4,"3d":3,"cartoon":5,"realistic":3},
            tagCartoon:"premium cartoon quality", tags2d:"expressive 2D" },
          { id:"fal_wan_pro",             name:"Wan Pro",             price:0.12,  network:"FAL",     res:"1080p",  maxSec:10, color:"#f472b6",
            scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4},
            tags3d:"smooth 3D, 10s", tagRealistic:"natural motion, 10s" },
          { id:"fal_kling_2_5_turbo_pro", name:"Kling 2.5 Turbo",     price:0.20,  network:"FAL",     res:"1080p",  maxSec:10, color:"#a78bfa",
            scores:{"2d":4,"3d":5,"cartoon":3,"realistic":5},
            tags3d:"premium 3D fast", tagRealistic:"high realism, fast" },
          { id:"fal_kling_3_pro",         name:"Kling 3.0 Pro",       price:0.30,  network:"FAL",     res:"1080p",  maxSec:10, color:"#c084fc",
            scores:{"2d":4,"3d":5,"cartoon":4,"realistic":5},
            tags3d:"TOP 3D cinematic", tagRealistic:"TOP realism on FAL", tagCartoon:"cinematic cartoon" },
          { id:"fal_runway_gen4",         name:"Runway Gen-4 (FAL)",  price:0.25,  network:"FAL",     res:"1080p",  maxSec:10, color:"#d946ef",
            scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5},
            tags3d:"cinematic 3D", tagRealistic:"near-photorealistic" },
          { id:"runway_gen4_direct",      name:"Runway Direct ★",     price:0,     network:"Runway",  res:"720p",   maxSec:10, color:"#e879f9",
            scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5},
            tags3d:"YOUR CREDITS — cinematic 3D", tagRealistic:"YOUR CREDITS — best realistic" },
          { id:"kling_direct_v1_5_std",   name:"Kling 1.6 Direct ★",  price:0.045, network:"Kling",   res:"720p",   maxSec:10, color:"#fbbf24",
            scores:{"2d":3,"3d":4,"cartoon":3,"realistic":4},
            tags3d:"direct Kling 3D", tagRealistic:"direct API realism" },
          { id:"kling_direct_v2_5_std",   name:"Kling 2.5 Direct ★",  price:0.10,  network:"Kling",   res:"1080p",  maxSec:10, color:"#f59e0b",
            scores:{"2d":3,"3d":5,"cartoon":3,"realistic":5},
            tags3d:"BEST direct 3D cinematic", tagRealistic:"TOP direct realism, 10s" },
          { id:"kling_direct_v2_5_pro",   name:"Kling 2.5 Pro ★",     price:0.20,  network:"Kling",   res:"1080p",  maxSec:10, color:"#d97706",
            scores:{"2d":4,"3d":5,"cartoon":4,"realistic":5},
            tags3d:"TOP 3D — premium Kling", tagRealistic:"HIGHEST direct realism", tagCartoon:"cinematic cartoon premium" },
        ];

        // ── Style adviser config ──
        type StyleKey = "all"|"2d"|"3d"|"cartoon"|"realistic";
        const ADVISER: Record<StyleKey, { title:string; msg:string; cheapestId:string; bestId:string; bestLabel:string }> = {
          all: {
            title:"All Models",
            msg:"Showing all models sorted by price. MuAPI is 40–58% cheaper than FAL for the same quality tier. Use Segmind for free drafts, MuAPI for budget production, FAL Kling for premium cinematic.",
            cheapestId:"segmind_pruna_video", bestId:"fal_kling_3_pro", bestLabel:"Top Overall",
          },
          "2d": {
            title:"2D / Illustration Style",
            msg:"Seedance 2.0 (MuAPI) is the best model for 2D flat animation — it preserves clean outlines, flat colour fills, and smooth 2D motion. For budget 2D use Seedance 1.0 Pro at $0.04. Avoid Kling and Runway for 2D — they push toward photorealism.",
            cheapestId:"muapi_seedance_v1_pro", bestId:"muapi_seedance_v2_1080p", bestLabel:"Best 2D",
          },
          "3d": {
            title:"3D / Cinematic Style",
            msg:"Kling 2.5 Direct ★ is the best 3D model — direct API, no FAL overhead. Start with Kling 1.6 Direct ($0.045) for budget drafts. Kling 2.5 Pro Direct ($0.20) for final production. Seedance 2.0 1080p (MuAPI) is a cheaper alternative at $0.12.",
            cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_std", bestLabel:"Best 3D Direct",
          },
          cartoon: {
            title:"Cartoon / Animated Style",
            msg:"Seedance 2.0 (MuAPI) at $0.08 is the best cartoon model at this price. Hailuo Pro is the best cartoon on FAL. For cheap cartoon drafts use Seedance 1.0 Pro at $0.04 on MuAPI — 4x cheaper than Hailuo Pro with similar stylized motion.",
            cheapestId:"muapi_seedance_v1_pro", bestId:"fal_hailuo_pro", bestLabel:"Best Cartoon",
          },
          realistic: {
            title:"Realistic / Photorealistic",
            msg:"Kling 2.5 Pro Direct ★ ($0.20) is the most realistic direct API option. Kling 2.5 Direct ★ ($0.10) is best value for realism. Runway Direct uses YOUR Runway credits and is near-photorealistic. Budget option: Kling 1.6 Direct at $0.045.",
            cheapestId:"kling_direct_v1_5_std", bestId:"kling_direct_v2_5_pro", bestLabel:"Most Realistic",
          },
        };

        const adviser = ADVISER[aidStyle];

        // ── Filter + sort models ──
        const qualityScore = (m: typeof AID_MODELS[0]) =>
          aidStyle === "all"
            ? (m.scores["2d"] + m.scores["3d"] + m.scores["cartoon"] + m.scores["realistic"]) / 4
            : m.scores[aidStyle as Exclude<StyleKey,"all">];

        const applySort = (list: typeof AID_MODELS) => {
          if (aidSort === "cheapest")  return [...list].sort((a, b) => a.price - b.price);
          if (aidSort === "expensive") return [...list].sort((a, b) => b.price - a.price);
          // quality: highest score first, tie-break by cheapest
          return [...list].sort((a, b) => {
            const diff = qualityScore(b) - qualityScore(a);
            return diff !== 0 ? diff : a.price - b.price;
          });
        };

        const filteredModels = applySort(
          aidStyle === "all"
            ? AID_MODELS
            : AID_MODELS.filter(m => m.scores[aidStyle as Exclude<StyleKey,"all">] >= 2)
        );

        const cheapestMatch = filteredModels.find(m => m.id === adviser.cheapestId) ?? filteredModels[0];
        const bestMatch = filteredModels.find(m => m.id === adviser.bestId) ?? filteredModels[filteredModels.length - 1];

        // ── Image models ──
        const IMAGE_MODELS_AID = [
          { id:"ideogram_free",        name:"Ideogram Free",      price:0.000, network:"FAL",     res:"1024px", color:"#34d399", desc:"Completely free. Good text rendering via Ideogram v2." },
          { id:"segmind_flux",         name:"Flux Free",          price:0.0004,network:"Segmind", res:"1024px", color:"#6ee7b7", desc:"Cheapest Flux via Segmind. Good for quick drafts." },
          { id:"segmind_pruna",        name:"Pruna P Image",      price:0.005, network:"Segmind", res:"1024px", color:"#22c55e", desc:"Cheapest image. Fast drafts, marketing creatives." },
          { id:"fal_flux_schnell",     name:"Flux Schnell",       price:0.003, network:"FAL",     res:"1024px", color:"#4ade80", desc:"Fastest FAL image. Very cheap, good for quick tests." },
          { id:"fal_flux_dev",         name:"Flux Dev",           price:0.025, network:"FAL",     res:"1024px", color:"#facc15", desc:"Better detail than Schnell. Good balance." },
          { id:"fal_ideogram_v3_turbo",name:"Ideogram v3 Turbo",  price:0.020, network:"FAL",     res:"1024px", color:"#fb923c", desc:"Best text rendering. Great for titles and posters." },
          { id:"fal_seedream",         name:"Seedream",           price:0.020, network:"FAL",     res:"1024px", color:"#38bdf8", desc:"Polished commercial stills. Modern stylized visuals." },
          { id:"fal_nano_banana",      name:"Nano Banana 2",      price:0.030, network:"FAL",     res:"1024px", color:"#a78bfa", desc:"Strong generation + editing. Premium quality." },
          { id:"fal_flux_pro",         name:"Flux Pro",           price:0.050, network:"FAL",     res:"1024px", color:"#c084fc", desc:"Top-tier Flux. Best photorealism for final renders." },
          { id:"fal_ideogram_v3_quality",name:"Ideogram v3 Quality",price:0.040,network:"FAL",   res:"1024px", color:"#d946ef", desc:"High quality text rendering and branded graphics." },
          { id:"fal_recraft_v3",       name:"Recraft v3",         price:0.040, network:"FAL",     res:"1024px", color:"#e879f9", desc:"Design-style product graphics and illustrations." },
          { id:"fal_flux_pro_ultra",   name:"Flux Pro Ultra",     price:0.060, network:"FAL",     res:"2048px", color:"#f472b6", desc:"Highest resolution. Best detail. Print quality." },
        ];

        const networkColor: Record<string,string> = { Segmind:"#22c55e", MuAPI:"#38bdf8", FAL:"#a78bfa", Runway:"#e879f9" };
        const isVideo = aidMode === "video";
        const activeModelId = isVideo ? effectiveVideoModelId : effectiveImageModelId;

        return (
          <div onClick={() => setShowAidPicker(false)}
            style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:9998, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background:"#0d0d20", border:"1px solid #3b2f6e", borderRadius:16, width:500, maxWidth:"96vw", maxHeight:"90vh", display:"flex", flexDirection:"column", boxShadow:"0 0 60px rgba(100,50,200,0.4)" }}>

              {/* Header */}
              <div style={{ padding:"16px 20px 12px", borderBottom:"1px solid #1e1a3a", flexShrink:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#e2d9f3" }}>AI Model Selector</div>
                  <button type="button" onClick={() => setShowAidPicker(false)}
                    style={{ background:"none", border:"none", color:"#666", cursor:"pointer", lineHeight:1, display:"flex", alignItems:"center" }}><Icon.X style={{ width:16, height:16 }} /></button>
                </div>
                {/* VIDEO / IMAGE toggle */}
                <div style={{ display:"flex", gap:0, borderRadius:10, overflow:"hidden", border:"1px solid #2a2456", width:"fit-content" }}>
                  {(["video","image"] as const).map(mode => (
                    <button key={mode} type="button" onClick={() => setAidMode(mode)}
                      style={{
                        padding:"7px 24px", border:"none", cursor:"pointer", fontSize:11, fontWeight:800, letterSpacing:0.5,
                        background: aidMode === mode ? (mode === "video" ? "#7c3aed" : "#0ea5e9") : "#12122a",
                        color: aidMode === mode ? "#fff" : "#5a4f80",
                        transition:"all 0.15s",
                      }}>
                      {mode === "video" ? "VIDEO" : "IMAGE"}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:9, color:"#4a4070", marginTop:6 }}>
                  {isVideo ? "Selecting model for: video generation on scene cards" : "Selecting model for: image generation on scene cards"}
                  {" · "}Active: <span style={{ color: isVideo ? "#c084fc" : "#38bdf8", fontWeight:700 }}>{activeModelId}</span>
                </div>
              </div>

              {/* Style tabs — video only */}
              {isVideo && (
                <div style={{ padding:"10px 20px 0", display:"flex", gap:6, flexShrink:0 }}>
                  {(["all","2d","3d","cartoon","realistic"] as StyleKey[]).map(s => {
                    const labels: Record<StyleKey,string> = { all:"ALL", "2d":"2D", "3d":"3D", cartoon:"CARTOON", realistic:"REALISTIC" };
                    const active = aidStyle === s;
                    return (
                      <button key={s} type="button" onClick={() => setAidStyle(s)}
                        style={{
                          padding:"4px 9px", borderRadius:7, border: active ? "1.5px solid #c084fc" : "1px solid #2a2456",
                          background: active ? "#3b1f6e" : "#12122a", color: active ? "#e2d9f3" : "#6b5fa0",
                          fontSize:9, fontWeight:800, cursor:"pointer", letterSpacing:0.5, transition:"all 0.15s",
                        }}>
                        {labels[s]}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Sort bar — video only */}
              {isVideo && (
                <div style={{ padding:"8px 20px 0", display:"flex", gap:5, alignItems:"center", flexShrink:0 }}>
                  <span style={{ fontSize:8, color:"#3a3060", fontWeight:700, letterSpacing:0.5, marginRight:3 }}>SORT:</span>
                  {([
                    { key:"cheapest",  label:"Cheapest",  col:"#22c55e" },
                    { key:"quality",   label:"Quality",    col:"#c084fc" },
                    { key:"expensive", label:"Premium",    col:"#facc15" },
                  ] as { key: "cheapest"|"quality"|"expensive"; label:string; col:string }[]).map(opt => (
                    <button key={opt.key} type="button" onClick={() => setAidSort(opt.key)}
                      style={{
                        padding:"3px 10px", borderRadius:7, border: aidSort === opt.key ? `1.5px solid ${opt.col}` : "1px solid #2a2456",
                        background: aidSort === opt.key ? `${opt.col}20` : "#12122a",
                        color: aidSort === opt.key ? opt.col : "#4a4070",
                        fontSize:9, fontWeight:700, cursor:"pointer", letterSpacing:0.3, transition:"all 0.12s",
                      }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}

              {/* AI Adviser panel — video only */}
              {isVideo && (
                <div style={{ margin:"10px 20px 0", padding:"11px 14px", borderRadius:10, background:"#0a0820", border:"1px solid #2a1f5a", flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#c084fc", marginBottom:4 }}>{adviser.title}</div>
                  <div style={{ fontSize:9, color:"#a08aba", lineHeight:1.6 }}>{adviser.msg}</div>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #22c55e40" }}>
                      <div style={{ fontSize:8, color:"#22c55e", fontWeight:700, marginBottom:1 }}>CHEAPEST</div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>{cheapestMatch?.name}</div>
                      <div style={{ fontSize:9, color:"#22c55e", fontWeight:700 }}>{cheapestMatch?.price === 0 ? "Runway credits" : `$${cheapestMatch?.price.toFixed(3)}/clip`}</div>
                    </div>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #c084fc40" }}>
                      <div style={{ fontSize:8, color:"#c084fc", fontWeight:700, marginBottom:1 }}>{adviser.bestLabel.toUpperCase()}</div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>{bestMatch?.name}</div>
                      <div style={{ fontSize:9, color:"#c084fc", fontWeight:700 }}>{bestMatch?.price === 0 ? "Runway credits" : `$${bestMatch?.price.toFixed(3)}/clip`}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Image adviser panel */}
              {!isVideo && (
                <div style={{ margin:"10px 20px 0", padding:"11px 14px", borderRadius:10, background:"#0a0820", border:"1px solid #0ea5e940", flexShrink:0 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#38bdf8", marginBottom:4 }}>Image Model Adviser</div>
                  <div style={{ fontSize:9, color:"#a08aba", lineHeight:1.6 }}>
                    Pruna P Image ($0.005) and Flux Schnell ($0.003) are the cheapest — good for quick drafts. For final quality use Flux Pro ($0.05) or Flux Pro Ultra ($0.06) for 2048px. Ideogram v3 is best when your scene has text or titles.
                  </div>
                  <div style={{ display:"flex", gap:8, marginTop:8 }}>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #22c55e40" }}>
                      <div style={{ fontSize:8, color:"#22c55e", fontWeight:700, marginBottom:1 }}>CHEAPEST IMAGE</div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>Flux Schnell</div>
                      <div style={{ fontSize:9, color:"#22c55e", fontWeight:700 }}>$0.003/image · FAL</div>
                    </div>
                    <div style={{ flex:1, background:"#1a1040", borderRadius:8, padding:"6px 10px", border:"1px solid #c084fc40" }}>
                      <div style={{ fontSize:8, color:"#c084fc", fontWeight:700, marginBottom:1 }}>BEST QUALITY</div>
                      <div style={{ fontSize:10, fontWeight:700, color:"#e2d9f3" }}>Flux Pro Ultra</div>
                      <div style={{ fontSize:9, color:"#c084fc", fontWeight:700 }}>$0.060/image · 2048px</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Scrollable model list */}
              <div style={{ overflowY:"auto", padding:"10px 20px 16px", flex:1 }}>
                {isVideo ? filteredModels.map((m, idx) => {
                  const isCheapest = m.id === cheapestMatch?.id;
                  const isBest = m.id === bestMatch?.id;
                  const isSelected = effectiveVideoModelId === m.id;
                  const styleScore = aidStyle === "all" ? null : m.scores[aidStyle as Exclude<StyleKey,"all">];
                  const styleTag = aidStyle === "2d" ? m.tags2d : aidStyle === "3d" ? m.tags3d : aidStyle === "cartoon" ? m.tagCartoon : aidStyle === "realistic" ? m.tagRealistic : undefined;
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedVideoModelId(m.id); patchProjectSettings({ videoModelVersion: m.id }).catch(() => {}); setShowAidPicker(false); }}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"9px 12px", marginBottom:5, borderRadius:10, cursor:"pointer",
                        border: isSelected ? `1.5px solid ${m.color}` : isBest ? `1px solid ${m.color}60` : "1px solid #1e1a3a",
                        background: isSelected ? `${m.color}15` : isBest ? `${m.color}08` : "#0a0820",
                        transition:"all 0.12s",
                      }}>
                      <div style={{ fontSize:9, color:"#3a3060", fontWeight:700, minWidth:16, textAlign:"right", marginRight:8 }}>{idx+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:2 }}>
                          {/* 5-B: model health dot — red if in brokenModels set, green otherwise */}
                          <span title={brokenModels.has(m.id) ? "Recently failed — may be unavailable" : "Healthy"} style={{ fontSize:12, color: brokenModels.has(m.id) ? "#ef4444" : "#22c55e", lineHeight:1 }}>●</span>
                          <span style={{ fontSize:11, fontWeight:700, color:"#e2d9f3" }}>{m.name}</span>
                          <span style={{ fontSize:8, fontWeight:700, background:netCol, color:"#000", borderRadius:3, padding:"1px 5px" }}>{m.network}</span>
                          {isCheapest && <span style={{ fontSize:8, fontWeight:700, background:"#22c55e", color:"#000", borderRadius:3, padding:"1px 5px" }}>CHEAPEST</span>}
                          {isBest && !isCheapest && <span style={{ fontSize:8, fontWeight:700, background:"#c084fc", color:"#000", borderRadius:3, padding:"1px 5px" }}>{adviser.bestLabel.toUpperCase()}</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, color:"#22c55e", fontWeight:700 }}>{m.price === 0 ? "Runway credits" : `$${m.price.toFixed(3)}`}</span>
                          <span style={{ fontSize:9, color:"#4a4070" }}>{m.res} · {m.maxSec}s</span>
                          {styleTag && <span style={{ fontSize:9, color:m.color, fontStyle:"italic" }}>{styleTag}</span>}
                          {styleScore !== null && <span style={{ fontSize:9, color:"#5a4f80" }}>{"★".repeat(styleScore)}{"☆".repeat(5-styleScore)}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign:"right", marginLeft:8 }}>
                        {isSelected ? <div style={{ fontSize:12, color:m.color, fontWeight:700 }}>OK</div> : <div style={{ fontSize:9, color:"#3a3060" }}>select</div>}
                      </div>
                    </div>
                  );
                }) : IMAGE_MODELS_AID.map((m, idx) => {
                  const isSelected = effectiveImageModelId === m.id;
                  const isCheapest = m.id === "fal_flux_schnell";
                  const isBest = m.id === "fal_flux_pro_ultra";
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedImageModelId(m.id); patchProjectSettings({ imageModelVersion: m.id }).catch(() => {}); setShowAidPicker(false); }}
                      style={{
                        display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"9px 12px", marginBottom:5, borderRadius:10, cursor:"pointer",
                        border: isSelected ? `1.5px solid ${m.color}` : "1px solid #1e1a3a",
                        background: isSelected ? `${m.color}15` : "#0a0820",
                        transition:"all 0.12s",
                      }}>
                      <div style={{ fontSize:9, color:"#3a3060", fontWeight:700, minWidth:16, textAlign:"right", marginRight:8 }}>{idx+1}</div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:5, flexWrap:"wrap", marginBottom:2 }}>
                          {/* 5-B: model health dot */}
                          <span title={brokenModels.has(m.id) ? "Recently failed — may be unavailable" : "Healthy"} style={{ fontSize:12, color: brokenModels.has(m.id) ? "#ef4444" : "#22c55e", lineHeight:1 }}>●</span>
                          <span style={{ fontSize:11, fontWeight:700, color:"#e2d9f3" }}>{m.name}</span>
                          <span style={{ fontSize:8, fontWeight:700, background:netCol, color:"#000", borderRadius:3, padding:"1px 5px" }}>{m.network}</span>
                          {isCheapest && <span style={{ fontSize:8, fontWeight:700, background:"#22c55e", color:"#000", borderRadius:3, padding:"1px 5px" }}>CHEAPEST</span>}
                          {isBest && <span style={{ fontSize:8, fontWeight:700, background:"#c084fc", color:"#000", borderRadius:3, padding:"1px 5px" }}>BEST QUALITY</span>}
                        </div>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontSize:10, color:"#22c55e", fontWeight:700 }}>${m.price.toFixed(3)}/img</span>
                          <span style={{ fontSize:9, color:"#4a4070" }}>{m.res}</span>
                          <span style={{ fontSize:9, color:"#5a5080", fontStyle:"italic" }}>{m.desc}</span>
                        </div>
                      </div>
                      <div style={{ textAlign:"right", marginLeft:8 }}>
                        {isSelected ? <div style={{ fontSize:12, color:m.color, fontWeight:700 }}>OK</div> : <div style={{ fontSize:9, color:"#3a3060" }}>select</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Image Picker Modal — borrow an image from asset library / character registry ── */}
      {imagePickerForCharId && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setImagePickerForCharId(null)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 299, }} />
          {/* Panel */}
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", zIndex: 300, background: "#0f1117", border: "1px solid #ffffff18", borderRadius: 16, width: "min(680px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Header */}
            <div style={{ padding: "18px 20px 14px", borderBottom: "1px solid #ffffff10", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Import Image</p>
                <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  Pick an existing image for <strong style={{ color: "#0ea5e9" }}>{characters.find(c => c.characterId === imagePickerForCharId)?.displayName || imagePickerForCharId}</strong> — no generation needed
                </p>
              </div>
              <button onClick={() => setImagePickerForCharId(null)} style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: "0 4px", display: "flex", alignItems: "center" }}><Icon.X style={{ width: 16, height: 16 }} /></button>
            </div>

            {/* Upload from computer */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid #ffffff08", background: "#ffffff04" }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#0ea5e9", display:"flex", alignItems:"center", gap:4 }}><Icon.Folder style={{ width:12, height:12 }} /> Upload from computer</span>
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    // Read as data URL for immediate preview, then assign
                    const reader = new FileReader();
                    reader.onload = ev => {
                      const dataUrl = ev.target?.result as string;
                      if (dataUrl && imagePickerForCharId) assignImageToCharacter(imagePickerForCharId, dataUrl);
                    };
                    reader.readAsDataURL(file);
                  }} />
                <span style={{ fontSize: 9, color: "#666" }}>JPG, PNG, WEBP</span>
              </label>
            </div>

            {/* Grid of existing assets */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {imagePickerLoading ? (
                <p style={{ textAlign: "center", color: "#888", fontSize: 12, padding: 40 }}>Loading assets...</p>
              ) : imagePickerAssets.length === 0 ? (
                <div style={{ textAlign: "center", color: "#666", fontSize: 12, padding: 40 }}>
                  <p>No images found in your library yet.</p>
                  <p style={{ marginTop: 8, fontSize: 10 }}>Generate portrait images first, or upload from computer above.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))", gap: 10 }}>
                  {imagePickerAssets.map(asset => {
                    const displayUrl = asset.fileUrl || (asset.filePath
                      ? `/api/media/${asset.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`
                      : "");
                    if (!displayUrl) return null;
                    return (
                      <div key={asset.id}
                        onClick={() => imagePickerForCharId && assignImageToCharacter(imagePickerForCharId, displayUrl)}
                        style={{ cursor: "pointer", borderRadius: 10, overflow: "hidden", border: "2px solid #ffffff10", transition: "border-color 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = "#0ea5e9")}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = "#ffffff10")}>
                        <img src={displayUrl} alt={asset.name}
                          style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                          onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        <div style={{ padding: "5px 6px", background: "#ffffff06" }}>
                          <p style={{ fontSize: 9, color: "#ccc", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</p>
                          {asset.source === "character_registry" && (
                            <p style={{ fontSize: 8, color: "#7c3aed", marginTop: 1 }}>Character Registry</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* ── Hero Banner — v14 HeroTitle ── */}
      <div style={{ padding: "24px 0 16px", display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <HeroTitle kicker="Production Workshop" title="Hybrid" italic="Planner" sub="Your production control center. Plan, create, review, and assemble." />
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input
                value={projectTitle}
                onChange={e => { setProjectTitle(e.target.value); setUserEditedTitle(true); }}
                onBlur={() => flushCurrentProject()}
                style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, width: 200, outline: "none" }}
                placeholder="Movie Title"
              />
              {/* Refresh title — re-asks the AI for a new movieTitle without re-
                  expanding the whole story. Disabled until expansion has run at
                  least once (otherwise nothing to title). Resets userEditedTitle
                  so the new AI title actually applies. */}
              <button
                onClick={async () => {
                  if (refreshingTitle || !idea.trim()) return;
                  setRefreshingTitle(true);
                  try {
                    const res = await fetch("/api/hybrid/story-expand", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        storyInput: idea,
                        targetDuration: 60, // short — we only need the title
                        provider: storyAiProvider || "auto",
                        // titleOnly hint — the route returns the full JSON anyway,
                        // but a small target keeps the call cheap.
                      }),
                    });
                    const data = await res.json();
                    const newTitle = typeof data?.expandedStory?.movieTitle === "string" ? data.expandedStory.movieTitle.trim() : "";
                    if (newTitle) {
                      setProjectTitle(newTitle);
                      setUserEditedTitle(false);
                      setLastAction(`Title refreshed: ${newTitle}`);
                    } else {
                      setLastAction("Title refresh failed — AI returned no title");
                    }
                  } catch (e) {
                    setLastAction(`Title refresh error: ${e instanceof Error ? e.message : "unknown"}`);
                  } finally {
                    setRefreshingTitle(false);
                  }
                }}
                disabled={refreshingTitle || !idea.trim()}
                title={!idea.trim() ? "Type a story idea first" : refreshingTitle ? "Generating new title..." : "Refresh AI movie title"}
                style={{
                  background: refreshingTitle ? "rgba(124,92,252,0.25)" : "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 10, padding: "8px 10px",
                  color: refreshingTitle ? "#a78bfa" : "#fff",
                  fontSize: 13, cursor: (refreshingTitle || !idea.trim()) ? "not-allowed" : "pointer",
                  opacity: !idea.trim() ? 0.4 : 1,
                }}
              >
                {refreshingTitle ? "⏳" : "🔄"}
              </button>
            </div>
            {/* ── Visual Style Picker — click to see what each style looks like ── */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowStylePicker(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: showStylePicker ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: "#fff" }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>Art Style:</span>
                <span style={{ fontSize: 13 }}>
                  {effectiveProjectStyle === "3d-cinematic" ? "3D" : effectiveProjectStyle === "2d-cartoon" ? "2D" : effectiveProjectStyle === "anime" ? "AN" : effectiveProjectStyle === "storybook" ? "SB" : effectiveProjectStyle === "nollywood" ? "NW" : effectiveProjectStyle === "comic" ? "CB" : "RL"}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {effectiveProjectStyle === "3d-cinematic" ? "3D Cinematic" : effectiveProjectStyle === "2d-cartoon" ? "2D Cartoon" : effectiveProjectStyle === "anime" ? "Anime" : effectiveProjectStyle === "storybook" ? "Storybook" : effectiveProjectStyle === "nollywood" ? "Nollywood" : effectiveProjectStyle === "comic" ? "Comic Book" : "Realistic"}
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>▾</span>
              </button>

              {/* Picker panel is rendered at root level (see bottom of component) to escape overflow:hidden on the hero banner */}
            </div>
            <button onClick={async () => {
              // Save current project first — NO work is lost
              await flushCurrentProject();
              // Generate a new project ID and push it into the URL
              const newId = `proj_${Date.now()}`;
              setActiveProjLocalId(newId);
              window.history.replaceState(null, "", `/dashboard/hybrid-planner?projectId=${encodeURIComponent(newId)}`);
              // ── Story & scene state ──
              setProjectId(null); setProjectTitle("Untitled Hybrid Project"); setProjectPhase("STORY_INPUT");
              setIdea(""); setGenre(""); setTone(""); setExpandedSummary(""); setFullScript("");
              setCharacters([]); setCharactersMade(false);
              setScenes([]); setSceneImages({}); setSceneVideos({}); setSceneVideoVersions({});
              setPrevSceneImages({}); setSceneIntelligence({});
              // 2026-05-10 — Gen Max state also needs to clear, else beat images from previous
              // project leak into the new Scene Board.
              setSceneBeatImages({}); setSelectedBeatImages({});
              setUseMaxImageScenes(new Set());
              setSceneMaxTarget({});
              setSavedCuts([]); setArchivedScenes([]);
              setNewSceneText(""); setNewSceneCharIds([]);
              setSelectedSceneIds([]); setAssemblyOrder([]); setAssemblyInitialized(false);
              // ── Audio & narration state — must be cleared so old audio never bleeds in ──
              setNarratorAudioUrl(null); setNarratorAudioDuration(0);
              setNarrationSettings({}); setNarrationScene(null);
              setCharacterAudioUrls({}); setCharacterPiperVoices({});
              setScriptSegments([]); setShowScriptReview(false);
              setScreenplay(""); setScreenplayAuthor(""); setScreenplayError("");
              setSelectedMusicUrl(null); setSelectedMusicName(""); setAiMusicPickLog("");
              // ── Assembly state ──
              setAssembledVideoUrl(null); setAssemblyComplete(false); setAssemblyProgress({});
              setAssemblyName("Cut A"); setReviewMode(false);
              setSubtitleStyle("classic"); setIntroEnabled(true); setOutroEnabled(true);
              setLastAction("New project started");
              setActiveTab("story");
            }} style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid rgba(255,255,255,0.1)`, background: "transparent", color: "#5a7080", fontSize: 11, cursor: "pointer" }}>
              New Project
            </button>
            <button onClick={() => setShowProjectSwitcher(p => !p)}
              style={{ padding: "8px 14px", borderRadius: 10, border: `1px solid ${gold}40`, background: showProjectSwitcher ? `${gold}15` : `${gold}08`, color: gold, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
              My Projects {projectList.length > 0 ? `(${projectList.length})` : ""}
            </button>
            <button onClick={async () => {
              setSaving(true);
              await flushCurrentProject();
              setLastAction(`"${projectTitle}" saved`);
              setTimeout(() => setSaving(false), 600);
            }}
              style={{ padding: "8px 16px", borderRadius: 10, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", opacity: saving ? 0.6 : 1 }}>
              {saving ? "Saved" : "Save"}
            </button>
        </div>
      </div>

      {/* ── My Projects Switcher Panel ── */}
      {showProjectSwitcher && (
        <div style={{ background: surface, border: `2px solid ${gold}30`, borderRadius: 16, padding: 16, marginBottom: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: gold }}>My Projects — Click a folder to open</p>
            <button onClick={() => setShowProjectSwitcher(false)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer", display:"flex", alignItems:"center", gap:4 }}><Icon.X style={{ width:10, height:10 }} /> Close</button>
          </div>
          {projectList.length === 0 ? (
            <p style={{ fontSize: 11, color: muted }}>No saved projects yet. Your current work will appear here automatically.</p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
              {projectList.sort((a, b) => b.lastModified - a.lastModified).map(proj => {
                const isActive = proj.id === activeProjLocalId;
                return (
                  <div key={proj.id}
                    onClick={() => isActive ? setShowProjectSwitcher(false) : loadProject(proj.id)}
                    style={{ borderRadius: 12, border: `2px solid ${isActive ? gold : border}`, background: isActive ? `${gold}08` : s2, cursor: "pointer", overflow: "hidden", transition: "all 0.15s" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = isActive ? gold : `${gold}60`; (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = isActive ? gold : border; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
                    {/* Thumbnail */}
                    <div style={{ height: 90, background: "#000", overflow: "hidden", position: "relative" }}>
                      {proj.thumbnail
                        ? <img src={proj.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Folder style={{ width: 32, height: 32, opacity: 0.2 }} /></div>
                      }
                      {/* Status badge */}
                      <div style={{ position: "absolute", top: 6, right: 6, fontSize: 8, padding: "2px 8px", borderRadius: 8, background: isActive ? gold : "rgba(0,0,0,0.7)", color: isActive ? "#000" : "#fff", fontWeight: 800 }}>
                        {isActive ? "● OPEN" : "Open →"}
                      </div>
                    </div>
                    {/* Info */}
                    <div style={{ padding: "8px 10px" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: isActive ? gold : "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 4 }}>
                        {proj.title || "Untitled"}
                      </p>
                      <div style={{ display: "flex", gap: 5, marginBottom: 5, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${blue}15`, color: blue }}>{proj.sceneCount} scenes</span>
                        <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${purple}15`, color: purple }}>{proj.characterCount} chars</span>
                        <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${border}`, color: muted }}>{proj.style || "3d-cinematic"}</span>
                      </div>
                      <p style={{ fontSize: 8, color: muted, marginBottom: 6 }}>{new Date(proj.lastModified).toLocaleDateString()} {new Date(proj.lastModified).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                      {/* Delete — available on ALL projects */}
                      <button onClick={e => {
                        e.stopPropagation();
                        if (confirm(`Delete "${proj.title || "Untitled"}"? This cannot be undone.`)) {
                          setProjectList(prev => prev.filter(p => p.id !== proj.id));
                          // If deleting the active project, start a new blank one
                          if (isActive) {
                            const newId = `proj_${Date.now()}`;
                            setActiveProjLocalId(newId);
                            window.history.replaceState(null, "", `/dashboard/hybrid-planner?projectId=${encodeURIComponent(newId)}`);
                            setProjectId(null); setProjectTitle("Untitled Hybrid Project"); setProjectPhase("STORY_INPUT");
                            setIdea(""); setExpandedSummary(""); setCharacters([]); setCharactersMade(false);
                            setScenes([]); setSceneImages({}); setSceneVideos({});
                            // Clear Gen Max state too — prevents prefill from deleted project.
                            setSceneBeatImages({}); setSelectedBeatImages({});
                            setUseMaxImageScenes(new Set());
                            setSceneMaxTarget({});
                            setSavedCuts([]); setArchivedScenes([]);
                            setShowProjectSwitcher(false);
                            setLastAction("Project deleted — new project started");
                          }
                        }
                      }}
                        style={{ width: "100%", padding: "4px 8px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Production Pipeline Progress Bar — ordered, gated ── */}
      {(() => {
        // Completion signals — each section has a clear "done" condition
        const storyDone      = !!(expandedSummary || fullScript);
        const scriptDone     = scriptSegments.length > 0;
        const soundDone      = !!(selectedMusicUrl || narratorAudioUrl || Object.keys(characterAudioUrls).length > 0);
        const charactersDone = characters.length > 0;
        const scenesDone     = scenes.length > 0 && Object.keys(sceneImages).length > 0;
        const assemblyDone   = !!assembledVideoUrl;

        const steps = [
          { id: "story",      label: "Story",      n: 1, done: storyDone,      unlocked: true },
          { id: "script",     label: "Script",      n: 2, done: scriptDone,     unlocked: storyDone },
          { id: "audio",      label: "Sound",       n: 3, done: soundDone,      unlocked: storyDone },
          { id: "characters", label: "Characters",  n: 4, done: charactersDone, unlocked: storyDone },
          { id: "scenes",     label: "Scenes",      n: 5, done: scenesDone,     unlocked: charactersDone },
          { id: "assembly",   label: "Assembly",    n: 6, done: assemblyDone,   unlocked: scenes.length > 0 }, // pre-flight inside assembly handles missing images
        ];
        return (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12, padding: "10px 16px", background: "#080d10", borderRadius: 12, border: `1px solid ${border}`, gap: 0 }}>
            {steps.map((step, i) => {
              const isActive = activeTab === step.id;
              const isDone = step.done;
              const isLocked = !step.unlocked;
              const isLast = i === steps.length - 1;
              const stepColor = isDone ? "#22c55e" : isActive ? gold : isLocked ? "#333" : muted;
              return (
                <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <button
                    onClick={() => {
                      if (isLocked) {
                        const prev = steps[i - 1];
                        setLastAction(`Complete "${prev?.label}" first`);
                        return;
                      }
                      setActiveTab(step.id as WorkshopTab);
                    }}
                    title={isLocked ? `Complete ${steps[i-1]?.label} first` : step.label}
                    style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4, padding: "6px 8px", borderRadius: 8, border: "none", background: isActive ? `${gold}12` : "transparent", cursor: isLocked ? "not-allowed" : "pointer", flex: 1, opacity: isLocked ? 0.4 : 1 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isDone ? "#22c55e" : isActive ? `${gold}20` : "#ffffff08",
                      border: `2px solid ${stepColor}`, fontSize: 13, color: isDone ? "#000" : stepColor, fontWeight: 700 }}>
                      {isDone ? "✓" : step.n}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, color: stepColor, whiteSpace: "nowrap" as const }}>{step.label}</span>
                  </button>
                  {!isLast && (
                    <div style={{ height: 2, flex: 1, background: isDone ? "#22c55e50" : "#ffffff10", marginTop: -10, maxWidth: 32 }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Workshop Tab Bar — v14 ── */}
      {(() => {
        const storyDone      = !!(expandedSummary || fullScript);
        const scriptDone     = scriptSegments.length > 0;
        const soundDone      = !!(selectedMusicUrl || narratorAudioUrl || Object.keys(characterAudioUrls).length > 0);
        const charactersDone = characters.length > 0;
        const scenesDone     = scenes.length > 0 && Object.keys(sceneImages).length > 0;
        const assemblyDone   = !!assembledVideoUrl;
        const tabDone: Record<string, boolean> = {
          story: storyDone, script: scriptDone, audio: soundDone,
          characters: charactersDone, scenes: scenesDone,
          screenplay: scriptDone, assembly: assemblyDone,
          overview: true, trends: true,
        };
        const tabUnlocked: Record<string, boolean> = {
          story: true, script: storyDone, audio: storyDone,
          characters: storyDone, scenes: charactersDone,
          screenplay: scriptDone, assembly: scenes.length > 0, // pre-flight handles missing images — no need to gate on sceneImages
          overview: true, trends: true,
        };
        return (
          <div style={{ display: "flex", gap: 0, background: ds.color.card, borderBottom: `1px solid ${ds.color.line}`, overflowX: "auto", marginBottom: 20 }}>
            {WORKSHOP_TABS.map(tab => {
              const isActive = activeTab === tab.id;
              const isDone = tabDone[tab.id] ?? false;
              const isUnlocked = tabUnlocked[tab.id] ?? true;
              return (
                <button key={tab.id}
                  onClick={() => {
                    if (!isUnlocked) {
                      setLastAction(`Complete previous steps before opening ${tab.label}`);
                      return;
                    }
                    setActiveTab(tab.id);
                  }}
                  style={{
                    padding: "12px 14px", background: "none", border: "none",
                    color: isActive ? "#fff" : isDone ? "#22c55e" : isUnlocked ? muted : "#333",
                    fontWeight: isActive ? 700 : isDone ? 600 : 500, fontSize: 10,
                    cursor: isUnlocked ? "pointer" : "not-allowed",
                    whiteSpace: "nowrap", position: "relative", fontFamily: ds.font.mono,
                    textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 80,
                    opacity: isUnlocked ? 1 : 0.4,
                  }}>
                  {tab.label}
                  {tab.step !== undefined && !isActive && (
                    <span style={{ marginLeft: 4, fontSize: 8, background: isDone ? "#22c55e22" : `${purple}22`, color: isDone ? "#22c55e" : purple, borderRadius: 8, padding: "1px 5px" }}>
                      {isDone ? "✓" : tab.step}
                    </span>
                  )}
                  {tab.id === "scenes" && scenes.length > 0 && !isActive && !isDone && (
                    <span style={{ marginLeft: 4, fontSize: 8, background: `${accent}22`, color: accent, borderRadius: 8, padding: "1px 5px" }}>{scenes.length}</span>
                  )}
                  {isActive && (
                    <span style={{ position: "absolute", bottom: 0, left: 4, right: 4, height: 2, borderRadius: 2, background: "linear-gradient(90deg, #7c5cfc, #ff7a45)" }} />
                  )}
                </button>
              );
            })}
          </div>
        );
      })()}

      {/* ── Error Banner ── */}
      {uiError && (
        <div style={{ background: `${red}12`, border: `1px solid ${red}30`, borderRadius: 12, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <p style={{ fontSize: 12, color: red }}>{uiError}</p>
          <button onClick={() => setUiError(null)} style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 10, cursor: "pointer" }}>Dismiss</button>
        </div>
      )}

      {/* ── Next Step Guidance Banner ── */}
      {nextStepBanner && (
        <div style={{ background: `${nextStepBanner.color}08`, border: `1px solid ${nextStepBanner.color}25`, borderRadius: 12, padding: "10px 16px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Icon.ChevronRight style={{ width: 14, height: 14, color: accent }} />
            <p style={{ fontSize: 12, color: nextStepBanner.color, fontWeight: 600 }}>{nextStepBanner.message}</p>
          </div>
          {nextStepBanner.targetTab !== activeTab && (
            <button onClick={() => setActiveTab(nextStepBanner.targetTab)}
              style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: nextStepBanner.color, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              {nextStepBanner.buttonLabel}
            </button>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* OVERVIEW TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div>
          {/* ── Production Pipeline Checklist ── */}
          <div style={{ ...cardStyle, borderColor: `${gold}20`, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 14, letterSpacing: 0.5 }}>Production Pipeline</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
              {[
                { step: 1, label: "Fix your name", sub: "Screenplay tab -> Written by field", done: !!screenplayAuthor, tab: "screenplay" as WorkshopTab, icon: "1" },
                { step: 2, label: "Write Screenplay", sub: "Screenplay tab -> Write Screenplay button", done: !!screenplay, tab: "screenplay" as WorkshopTab, icon: "2" },
                { step: 3, label: "Send to Scenes + Parse", sub: "Screenplay tab -> Send to Scenes -> (auto-parses)", done: scriptSegments.length > 0, tab: "screenplay" as WorkshopTab, icon: "3" },
                { step: 4, label: "Toggle Intro Card ON", sub: "Assembly tab -> Intro & Outro section", done: introEnabled, tab: "assembly" as WorkshopTab, icon: "4" },
                { step: 5, label: "Toggle Outro / Credits ON", sub: "Assembly tab -> Intro & Outro section", done: outroEnabled, tab: "assembly" as WorkshopTab, icon: "5" },
                { step: 6, label: "AI Narrate + Plan Audio", sub: "Audio & Shots tab -> AI Narrate button", done: scriptSegments.length > 0 && storyMode !== "narration-only", tab: "audio" as WorkshopTab, icon: "6" },
                { step: 7, label: "AI Pick Music", sub: "Assembly tab -> Background Music -> AI Pick", done: !!selectedMusicUrl, tab: "assembly" as WorkshopTab, icon: "7" },
                { step: 8, label: "Assemble Movie", sub: "Assembly tab -> Assemble My Scenes button", done: assemblyComplete, tab: "assembly" as WorkshopTab, icon: "8" },
              ].map(item => (
                <div key={item.step}
                  style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: item.done ? `${accent}08` : s2, border: `1px solid ${item.done ? accent : border}`, cursor: "pointer", transition: "all 0.15s" }}
                  onClick={() => setActiveTab(item.tab)}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: item.done ? accent : `${border}40`, flexShrink: 0 }}>
                    {item.done
                      ? <Icon.Check style={{ width: 13, height: 13, color: "#000" }} />
                      : <span style={{ fontSize: 10, color: muted, fontWeight: 700 }}>{item.step}</span>}
                  </div>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: item.done ? 600 : 500, color: item.done ? accent : "#fff" }}>{item.label}</p>
                    <p style={{ fontSize: 9, color: muted }}>{item.sub}</p>
                  </div>
                  <span style={{ fontSize: 9, color: item.done ? accent : muted, flexShrink: 0 }}>
                    {item.done ? "Done" : "Go"}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Project Status Bar */}
          <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: accent }}>{totalScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Total Scenes</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: gold }}>{draftScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Draft</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: accent }}>{approvedScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Approved</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: red }}>{blockedScenes}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Blocked</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 28, fontWeight: 800, color: purple }}>{characters.length}</p>
              <p style={{ fontSize: 9, color: muted, textTransform: "uppercase", letterSpacing: 1 }}>Characters</p>
            </div>
          </div>

          {/* Progress + Resume side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            {/* Progress */}
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Production Progress</p>
              <ProgressBar label="Story" value={storyProgress} color={accent} />
              <ProgressBar label="Characters" value={characterProgress} color={purple} />
              <ProgressBar label="Scene Images" value={sceneProgress} color={blue} />
              <ProgressBar label="Audio Planning" value={audioProgress} color={gold} />
              <div style={{ borderTop: `1px solid ${border}`, paddingTop: 10, marginTop: 6 }}>
                <ProgressBar label="Assembly Readiness" value={assemblyReadiness} color={assemblyReadiness > 70 ? accent : assemblyReadiness > 40 ? gold : red} />
              </div>
            </div>

            {/* Resume / Where You Stopped */}
            <div style={cardStyle}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 14 }}>Resume & Next Steps</p>
              <div style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}`, marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Last Action</p>
                <p style={{ fontSize: 12, color: "#fff" }}>{lastAction}</p>
              </div>
              <div style={{ background: s2, borderRadius: 10, padding: 12, border: `1px solid ${border}`, marginBottom: 8 }}>
                <p style={{ fontSize: 9, color: gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Phase</p>
                <p style={{ fontSize: 12, color: "#fff" }}>{projectPhase.replace(/_/g, " ")}</p>
              </div>
              {/* Next recommended action */}
              <div style={{ background: `${accent}08`, borderRadius: 10, padding: 12, border: `1px solid ${accent}20` }}>
                <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Next Step</p>
                <p style={{ fontSize: 12, color: "#fff" }}>
                  {nextStepBanner ? nextStepBanner.message : "Ready for assembly!"}
                </p>
                <button onClick={() => {
                  if (nextStepBanner) setActiveTab(nextStepBanner.targetTab);
                  else setActiveTab("assembly");
                }} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: nextStepBanner?.color || accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  {nextStepBanner ? nextStepBanner.buttonLabel : "Go to Assembly"}
                </button>
              </div>
            </div>
          </div>

          {/* Warnings / Blockers */}
          {warnings.length > 0 && (
            <div style={{ ...cardStyle, borderColor: `${gold}30`, background: `${gold}04` }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: gold, marginBottom: 10 }}>Warnings & Blockers ({warnings.length})</p>
              {warnings.slice(0, 8).map((w, i) => {
                // Determine fix link based on warning content
                const fixTab: WorkshopTab = w.includes("voice") || w.includes("portrait") || (w.includes("missing") && !w.startsWith("Scene")) || w.includes("No characters") ? "characters" : w.startsWith("Scene") || w.includes("image") || w.includes("no image") ? "scenes" : w.includes("character") || w.includes("Character") ? "characters" : "overview";
                return (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: `${gold}06`, marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: gold }}>!</span>
                  <p style={{ fontSize: 11, color: gold, flex: 1 }}>{w}</p>
                  <button onClick={() => setActiveTab(fixTab)} style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${gold}30`, background: "transparent", color: gold, fontSize: 8, cursor: "pointer", flexShrink: 0 }}>Fix</button>
                </div>);
              })}
              {warnings.length > 8 && <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>+{warnings.length - 8} more</p>}
            </div>
          )}

          {/* Quick Links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8 }}>
            <button onClick={() => setActiveTab("scenes")} style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${blue}20` }}>
              <Icon.Film style={{ width: 24, height: 24 }} />
              <p style={{ fontSize: 11, color: blue, fontWeight: 600, marginTop: 6 }}>Scene Board</p>
            </button>
            <a href="/dashboard/character-voices" style={{ textDecoration: "none" }}>
              <div style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${purple}20` }}>
                <Icon.User style={{ width: 24, height: 24 }} />
                <p style={{ fontSize: 11, color: purple, fontWeight: 600, marginTop: 6 }}>Character Registry</p>
              </div>
            </a>
            <a href="/dashboard/collaborative-editor?from=hybrid-planner" style={{ textDecoration: "none" }}
              onClick={() => { /* return state now handled via URL params */ }}>
              <div style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${accent}20` }}>
                <Icon.Wand style={{ width: 24, height: 24 }} />
                <p style={{ fontSize: 11, color: accent, fontWeight: 600, marginTop: 6 }}>Open Editor</p>
              </div>
            </a>
            <button onClick={() => setActiveTab("assembly")} style={{ ...cardStyle, cursor: "pointer", textAlign: "center", border: `1px solid ${gold}20` }}>
              <Icon.Bolt style={{ width: 24, height: 24 }} />
              <p style={{ fontSize: 11, color: gold, fontWeight: 600, marginTop: 6 }}>Assembly</p>
            </button>
          </div>

          {/* Cost Summary */}
          {scenes.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              <div style={{ ...cardStyle, textAlign: "center", borderColor: `${accent}20` }}>
                <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Hybrid Cost</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: accent }}>{hybridCredits}</p>
                <p style={{ fontSize: 10, color: muted }}>credits</p>
              </div>
              <div style={{ ...cardStyle, textAlign: "center", borderColor: `${red}15` }}>
                <p style={{ fontSize: 9, color: red, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Full Video</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: red, textDecoration: "line-through", opacity: 0.5 }}>{fullVideoCredits}</p>
                <p style={{ fontSize: 10, color: muted }}>credits</p>
              </div>
              <div style={{ ...cardStyle, textAlign: "center", borderColor: `${accent}20` }}>
                <p style={{ fontSize: 9, color: accent, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>You Save</p>
                <p style={{ fontSize: 32, fontWeight: 800, color: accent }}>{savingsPercent}%</p>
                <p style={{ fontSize: 10, color: accent }}>{savedCredits} credits</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCENE BOARD TAB                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "scenes" && (
        <div>
          {/* ── CONTINUOUS MOTION TOGGLE ──────────────────────────────────── */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: continuousMotionEnabled ? `${accent}50` : `${border}`, background: continuousMotionEnabled ? `${accent}06` : undefined }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input
                type="checkbox"
                checked={continuousMotionEnabled}
                onChange={e => { setContinuousMotionEnabled(e.target.checked); setCmError(null); setCmStatus(null); setCmFinalVideoUrl(null); }}
                style={{ width: 16, height: 16, accentColor: accent }}
              />
              <span style={{ fontSize: 13, fontWeight: 700, color: continuousMotionEnabled ? accent : "#fff" }}>
                Continuous Motion — chain scenes into one seamless action sequence
              </span>
            </label>
            {continuousMotionEnabled && (
              <div style={{ marginTop: 14 }}>
                <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>
                  AI will treat your scenes as one continuous action. Enable this when your story has unbroken physical action (chase, fall, fight, explosion chain).
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 14 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Total Duration (seconds)</label>
                    <input
                      type="number" min={5} max={120} value={cmTotalDuration}
                      onChange={e => setCmTotalDuration(Math.max(5, Number(e.target.value)))}
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Segment Duration (sec, max 10)</label>
                    <input
                      type="number" min={3} max={10} value={cmSegmentDuration}
                      onChange={e => setCmSegmentDuration(Math.min(10, Math.max(3, Number(e.target.value))))}
                      style={{ ...inputStyle, fontSize: 12 }}
                    />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 9 }}>Video Provider</label>
                    <select value={cmProvider} onChange={e => setCmProvider(e.target.value as "wan" | "kling_std")}
                      style={{ ...inputStyle, fontSize: 12 }}>
                      <option value="wan">Wan 2.5</option>
                      <option value="kling_std">Kling Standard</option>
                    </select>
                  </div>
                </div>
                {cmError && (
                  <p style={{ fontSize: 11, color: "#ef4444", marginBottom: 10 }}>{cmError}</p>
                )}
                {cmStatus && cmStatus !== "DONE" && (
                  <p style={{ fontSize: 11, color: accent, marginBottom: 10 }}>
                    Status: {cmStatus}
                    {cmRunning && " — polling every 3s..."}
                  </p>
                )}
                {cmFinalVideoUrl && (
                  <div style={{ marginBottom: 14 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#4ade80", marginBottom: 8 }}>Continuous Motion ready</p>
                    <video src={cmFinalVideoUrl} controls style={{ width: "100%", maxHeight: 260, borderRadius: 8, background: "#000", marginBottom: 8 }} />
                    <button
                      onClick={useContinuousMotionVideo}
                      style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#4ade80", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Use This Video
                    </button>
                  </div>
                )}
                <button
                  onClick={startContinuousMotion}
                  disabled={cmRunning}
                  style={{ width: "100%", padding: "12px 20px", borderRadius: 12, border: "none", background: cmRunning ? "#2a2040" : `linear-gradient(135deg, ${accent}, ${purple})`, color: "#fff", fontSize: 13, fontWeight: 700, cursor: cmRunning ? "not-allowed" : "pointer" }}>
                  {cmRunning ? `Generating… (${cmStatus ?? "starting"})` : "Generate Continuous Motion"}
                </button>
              </div>
            )}
          </div>

          {/* ── CAST PANEL — Characters locked to this project ── */}
          <div style={{ ...cardStyle, marginBottom: 12, borderColor: `${purple}25` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: purple }}>CAST — Project Characters</span>
              <div style={{ display: "flex", gap: 6 }}>
                <a href="/dashboard/character-voices" style={{ textDecoration: "none" }}>
                  <button style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${accent}30`, background: "transparent", color: accent, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                    + Create Character
                  </button>
                </a>
                <button onClick={() => setShowCharacterPicker(true)}
                  style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${purple}40`, background: `${purple}08`, color: purple, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                  Import from Registry
                </button>
              </div>
            </div>
            {characters.length === 0 ? (
              <p style={{ fontSize: 11, color: muted }}>No characters yet. Import from registry or create new.</p>
            ) : (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {characters.map((c, ci) => (
                  <div key={`${c.characterId}_${ci}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: `${purple}12`, border: `1px solid ${purple}30` }}>
                    {c.imageUrl && <img src={normalizeImageUrl(c.imageUrl)} alt="" style={{ width: 20, height: 20, borderRadius: "50%", objectFit: "cover" }} />}
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{c.displayName}</span>
                    <span style={{ fontSize: 9, color: purple, fontFamily: "monospace" }}>{c.characterId}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── CREATE SCENE PANEL — The straight-forward way ── */}
          <div style={{ ...cardStyle, borderColor: `${accent}25`, marginBottom: 16 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: accent, marginBottom: 12 }}>Create New Scene</p>

            {/* Character chips for this scene */}
            {characters.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <span style={{ ...labelStyle, marginBottom: 6 }}>Characters in this scene (click to toggle)</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {characters.map((c, ci) => {
                    const selected = newSceneCharIds.includes(c.characterId) || (newSceneCharIds.length === 0);
                    return (
                      <button key={`${c.characterId}_${ci}`}
                        onClick={() => {
                          setNewSceneCharIds(prev => {
                            const all = characters.map(x => x.characterId);
                            const current = prev.length === 0 ? all : prev;
                            return current.includes(c.characterId) ? current.filter(id => id !== c.characterId) : [...current, c.characterId];
                          });
                        }}
                        style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20, border: `1px solid ${selected ? accent : border}`, background: selected ? `${accent}15` : "transparent", color: selected ? accent : muted, fontSize: 10, cursor: "pointer" }}>
                        {c.imageUrl && <img src={normalizeImageUrl(c.imageUrl)} alt="" style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover" }} />}
                        {c.displayName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scene text */}
            <div style={{ marginBottom: 10 }}>
              <label style={labelStyle}>Scene Description</label>
              <textarea value={newSceneText} onChange={e => setNewSceneText(e.target.value)} rows={3}
                placeholder="Describe the scene. e.g. 'John walks into the marketplace at dawn, looking for his lost sister.'"
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            {/* Scene settings row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 12 }}>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Location (optional)</label>
                <input value={newSceneLocation} onChange={e => setNewSceneLocation(e.target.value)}
                  placeholder="e.g. marketplace, forest" style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Mood (optional)</label>
                <input value={newSceneMood} onChange={e => setNewSceneMood(e.target.value)}
                  placeholder="e.g. tense, joyful, mysterious" style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Time of Day (optional)</label>
                <input value={newSceneTimeOfDay} onChange={e => setNewSceneTimeOfDay(e.target.value)}
                  placeholder="e.g. dawn, midday, night" style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Video Duration (seconds)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input type="range" min={1} max={10} step={1} value={newSceneDuration} onChange={e => setNewSceneDuration(Number(e.target.value))}
                    style={{ flex: 1, accentColor: purple }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: purple, minWidth: 24 }}>{newSceneDuration}s</span>
                </div>
              </div>
            </div>

            <button onClick={createScene} disabled={!newSceneText.trim() || creatingScene}
              style={{ ...btnPrimary, width: "100%", background: (!newSceneText.trim() || creatingScene) ? "#2a2a40" : accent, cursor: (!newSceneText.trim() || creatingScene) ? "not-allowed" : "pointer", fontSize: 13 }}>
              {creatingScene ? "Creating Scene — Generating Image + Audio Plan..." : "Create Scene (Image + AI Audio Plan)"}
            </button>
            {creatingScene && (
              <div style={{ marginTop: 8, padding: "10px 14px", borderRadius: 10, background: `${accent}08`, border: `1px solid ${accent}20` }}>
                <p style={{ fontSize: 11, color: accent, fontWeight: 600, marginBottom: 4 }}>Generating — please wait, do not navigate away</p>
                <p style={{ fontSize: 10, color: muted }}>1. Generating scene image with your character (Pruna)...</p>
                <p style={{ fontSize: 10, color: muted }}>2. AI planning SFX, narration + music automatically...</p>
                <p style={{ fontSize: 10, color: muted }}>3. Scene will appear in the board below when done.</p>
              </div>
            )}
          </div>

          {/* ── Project Folder Summary Card ── */}
          <div style={{ ...cardStyle, borderColor: `${gold}25`, background: `${gold}04`, marginBottom: 12, display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 48, height: 48, borderRadius: 10, background: `${gold}15`, border: `1px solid ${gold}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}><Icon.Folder style={{ width: 28, height: 28 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{projectTitle}</p>
              <div style={{ display: "flex", gap: 8, marginTop: 3, flexWrap: "wrap" }}>
                <span style={{ fontSize: 9, color: blue }}>{totalScenes} scenes</span>
                <span style={{ fontSize: 9, color: purple }}>{characters.length} characters</span>
                {selectedMusicName && <span style={{ fontSize: 9, color: gold }}>{selectedMusicName}</span>}
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${blue}15`, color: blue }}>{effectiveProjectStyle}</span>
                {(storyEra || storyCulture) && (
                  <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: "#fb923c18", color: "#fb923c", fontWeight: 600 }}>
                    {[storyEra, storyCulture].filter(Boolean).join(" · ")}
                  </span>
                )}
                {savedCuts.length > 0 && <span style={{ fontSize: 9, color: gold }}>{savedCuts.length} cut{savedCuts.length !== 1 ? "s" : ""}</span>}
              </div>
            </div>
            <button onClick={() => setShowProjectSwitcher(true)} style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${gold}30`, background: "transparent", color: gold, fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
              Switch Project
            </button>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>{projectTitle} — Scene Board ({totalScenes} scenes)</h2>
              {/* Intelligence status line */}
              {runningIntelligence && (
                <p style={{ fontSize: 10, color: "#4ade80", marginTop: 3 }}>Scene Intelligence running — detecting environments and ambient sounds...</p>
              )}
              {!runningIntelligence && Object.keys(sceneIntelligence).length > 0 && (
                <p style={{ fontSize: 10, color: muted, marginTop: 3 }}>
                  {Object.keys(sceneIntelligence).length} scenes have sound environment data
                  {" · "}{[...new Set(Object.values(sceneIntelligence).map(i => i.environmentType))].slice(0, 3).join(", ")}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {/* Clear ghost images — Henry 2026-06-08: also clears prevSceneImages
                  (the "PREVIOUS VERSIONS" thumbnails). Previous code only cleared
                  the active sceneImages; prevSceneImages kept up to 3 stale URLs
                  per scene that re-appeared in scene-card "previous versions"
                  strip — user clicked "Clear" but ghost images stayed visible. */}
              {(Object.keys(sceneImages).length > 0 || Object.keys(prevSceneImages).length > 0) && (
                <button
                  onClick={() => {
                    if (confirm("Clear all scene images AND previous-version thumbnails from this board? Files are NOT deleted.")) {
                      setSceneImages({});
                      setPrevSceneImages({});
                    }
                  }}
                  title="Remove all images + previous-version thumbnails from this scene board (does not delete files). Use if old images from another project are showing here."
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ef444430", background: "#1a0d0d", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  Clear Ghost Images
                </button>
              )}
              {/* Clear ghost videos — removes any cross-project contamination */}
              {Object.keys(sceneVideos).length > 0 && (
                <button
                  onClick={() => { if (confirm("Clear all scene videos from this board? Files are NOT deleted.")) { setSceneVideos({}); setSceneVideoVersions({}); } }}
                  title="Remove all videos from this scene board (does not delete files). Use if old videos from another project are showing here."
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ef444430", background: "#1a0d0d", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  Clear Ghost Videos
                </button>
              )}
              {/* Clear ghost audio — narrator + music + SFX state */}
              {(narratorAudioUrl || selectedMusicUrl || sfxGeneratedUrl) && (
                <button
                  onClick={() => {
                    if (confirm("Clear narrator voice, selected music, and SFX from this board? Files are NOT deleted.")) {
                      setNarratorAudioUrl(null);
                      setNarratorAudioDuration(0);
                      setSelectedMusicUrl(null);
                      setSelectedMusicName("");
                      setSfxGeneratedUrl(null);
                      setSfxDesc("");
                    }
                  }}
                  title="Remove narrator audio, music selection, and SFX from this session (does not delete files). Use if old audio from another project is leaking into assembly."
                  style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid #ef444430", background: "#1a0d0d", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  Clear Ghost Audio
                </button>
              )}
              {/* Manual re-run of scene intelligence */}
              {scenes.length > 0 && (
                <button
                  disabled={runningIntelligence}
                  onClick={() => runSceneIntelligence(
                    scenes.map(s => ({ sceneId: s.sceneId, title: s.title, description: s.description, location: s.location, timeOfDay: s.timeOfDay, mood: s.mood })),
                    expandedSummary || idea
                  )}
                  title="Re-analyse scene descriptions to detect environments and ambient sounds"
                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid #4ade8030`, background: runningIntelligence ? "#1a2a1a" : "#0d1a0d", color: "#4ade80", fontSize: 10, fontWeight: 700, cursor: runningIntelligence ? "not-allowed" : "pointer", opacity: runningIntelligence ? 0.6 : 1 }}>
                  {runningIntelligence ? "Detecting..." : "Scene Intelligence"}
                </button>
              )}
              {/* Seed control — set a fixed seed to repeat results */}
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  placeholder="Seed (random)"
                  value={genSeed ?? ""}
                  onChange={e => {
                    const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                    setGenSeed(isNaN(v as number) ? null : v);
                  }}
                  style={{ width: 110, padding: "5px 8px", borderRadius: 7, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 10, outline: "none" }}
                />
                <button
                  title="Randomize seed"
                  onClick={() => {
                    const s = Math.floor(Math.random() * 1e9);
                    setGenSeed(s);
                  }}
                  style={{ padding: "5px 7px", borderRadius: 7, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>
                  🎲
                </button>
              </div>
              <button onClick={() => setSceneViewMode("grid")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sceneViewMode === "grid" ? accent : border}`, background: sceneViewMode === "grid" ? `${accent}10` : "transparent", color: sceneViewMode === "grid" ? accent : muted, fontSize: 10, cursor: "pointer" }}>Grid</button>
              <button onClick={() => setSceneViewMode("list")} style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${sceneViewMode === "list" ? accent : border}`, background: sceneViewMode === "list" ? `${accent}10` : "transparent", color: sceneViewMode === "list" ? accent : muted, fontSize: 10, cursor: "pointer" }}>List</button>
              {(() => {
                const pendingScenes = scenes.filter(s => !sceneImages[s.sceneId] && s.sceneType !== "audio-bridge");
                return pendingScenes.length > 0 ? (
                  <button
                    disabled={!!batchImageProgress}
                    onClick={async () => {
                      setUiError(null);
                      let completed = 0;
                      setBatchImageProgress(`0/${pendingScenes.length}`);
                      for (const s of pendingScenes) {
                        try {
                          await makeSceneImage(s);
                          completed++;
                          setBatchImageProgress(`${completed}/${pendingScenes.length}`);
                          // Wait between FAL requests to avoid rate-limiting
                          if (completed < pendingScenes.length) await new Promise(r => setTimeout(r, 3000));
                        } catch (err) {
                          console.error(`Batch image failed for scene ${s.scene}:`, err);
                          // Wait longer after a failure before retrying next scene
                          await new Promise(r => setTimeout(r, 5000));
                        }
                      }
                      setBatchImageProgress(null);
                      setLastAction(`Batch: ${completed}/${pendingScenes.length} images generated`);
                    }}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: batchImageProgress ? "not-allowed" : "pointer", opacity: batchImageProgress ? 0.7 : 1 }}>
                    {batchImageProgress ? `Generating ${batchImageProgress}...` : `Generate All Images (${pendingScenes.length} pending)`}
                  </button>
                ) : null;
              })()}
            </div>
          </div>

          {scenes.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 30, borderColor: `${muted}20` }}>
              <p style={{ fontSize: 13, color: muted }}>No scenes yet. Use the panel above to create your first scene, or go to Story & Draft to expand a full story.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: sceneViewMode === "grid" ? "repeat(auto-fill, minmax(280px, 1fr))" : "1fr", gap: 12 }}>
              {scenes.map(scene => {
                const typeInfo = SCENE_TYPES.find(t => t.id === scene.sceneType);
                const hasImage = !!sceneImages[scene.sceneId];
                const hasVideo = !!sceneVideos[scene.sceneId];
                const hasAudio = !!(scene.audioPlan?.musicMood || scene.audioPlan?.sfxList?.length || scene.narrationScript || selectedMusicUrl || sceneSfxUrls[scene.sceneId]);
                const videoVersionCount = sceneVideoVersions[scene.sceneId]?.length || 0;
                const activeCardTab = activeSceneCardTab[scene.sceneId] ?? null;
                const statusColor = scene.status === "approved" ? accent : scene.status === "blocked" ? red : scene.status === "generated" ? blue : gold;
                const sceneChars = scene.characterIds.map(id => characters.find(c => c.characterId === id)?.displayName || id);
                return (
                  <div key={scene.sceneId} draggable onDragStart={() => handleDragStart(scene.scene)} onDragOver={e => e.preventDefault()} onDrop={() => handleDrop(scene.scene)}
                    style={{ ...cardStyle, padding: 0, overflow: "hidden", opacity: dragSource === scene.scene ? 0.5 : 1, cursor: "grab" }}>
                    {/* Thumbnail — click to quick-preview image */}
                    <div onClick={() => hasImage && setPreviewMedia({ url: sceneImages[scene.sceneId], type: "image", title: `${scene.sceneId}: ${scene.title}` })}
                      style={{ height: 140, background: s2, display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
                        cursor: hasImage ? "zoom-in" : "default",
                        outline: hasVideo ? `2px solid ${purple}` : "none",
                        outlineOffset: -2 }}>
                      {hasImage ? (
                        <img src={sceneImages[scene.sceneId]} alt={scene.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <div style={{ textAlign: "center" }}>
                          <Icon.Image style={{ width: 36, height: 36, opacity: 0.2 }} />
                          <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>No image yet</p>
                        </div>
                      )}
                      {/* Video play overlay — shows when video is ready */}
                      {hasVideo && (
                        <button onClick={e => { e.stopPropagation(); setPreviewMedia({ url: sceneVideos[scene.sceneId], type: "video", title: `${scene.sceneId}: ${scene.title}` }); }}
                          style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 40, height: 40, borderRadius: "50%", border: "none", background: `${purple}cc`, color: "#fff", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 12px ${purple}80` }}>
                          ▶
                        </button>
                      )}
                      {/* Scene number badge */}
                      <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.7)", borderRadius: 8, padding: "3px 10px", fontSize: 10, fontWeight: 700, color: "#fff" }}>
                        {scene.sceneId}
                      </div>
                      {/* Video indicator badge — top right, replaces type badge when video exists */}
                      <div style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}>
                        {hasVideo && <span style={{ ...badgeStyle(purple), background: purple, color: "#fff" }}>Video</span>}
                        {!hasVideo && <span style={badgeStyle(typeInfo?.color || accent)}>{typeInfo?.label || scene.sceneType}</span>}
                      </div>
                      {/* Status badge */}
                      <div style={{ position: "absolute", bottom: 8, right: 8 }}>
                        <span style={badgeStyle(statusColor)}>{scene.status || "draft"}</span>
                      </div>
                      {/* Model chip — bottom-left, only when image has model info */}
                      {hasImage && sceneImageModels[scene.sceneId] && (
                        <div style={{ position: "absolute", bottom: 8, left: 8 }}>
                          <ModelChip modelId={sceneImageModels[scene.sceneId]} size="xs" position="static" />
                        </div>
                      )}
                    </div>

                    {/* Scene Asset Review Tabs — click any tab to open its review panel */}
                    {(() => {
                      const tabs: Array<{ key: "image" | "audio" | "video" | "chat"; label: string; done: boolean; color: string }> = [
                        { key: "image", label: "Image", done: hasImage, color: blue },
                        { key: "audio", label: "Audio", done: hasAudio, color: gold },
                        { key: "video", label: videoVersionCount > 1 ? `Video v${videoVersionCount}` : "Video", done: hasVideo, color: purple },
                      ];
                      return (
                        <div style={{ display: "flex", borderBottom: `1px solid ${border}` }}>
                          {tabs.map((tab, ti) => {
                            const isOpen = activeCardTab === tab.key;
                            return (
                              <button key={tab.key} type="button"
                                onClick={() => setActiveSceneCardTab(prev => ({
                                  ...prev, [scene.sceneId]: isOpen ? null : tab.key,
                                }))}
                                style={{
                                  flex: 1, padding: "7px 4px", display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                                  border: "none", borderRight: ti < 2 ? `1px solid ${border}` : "none",
                                  borderBottom: isOpen ? `2px solid ${tab.color}` : "2px solid transparent",
                                  background: isOpen ? `${tab.color}20` : tab.done ? `${tab.color}08` : "transparent",
                                  cursor: "pointer", transition: "background 0.15s",
                                }}>
                                <span style={{ fontSize: 10, color: tab.done ? tab.color : muted }}>{tab.done ? <Icon.Check style={{ width:10, height:10 }} /> : "·"}</span>
                                <span style={{ fontSize: 9, color: isOpen ? tab.color : tab.done ? tab.color : muted, fontWeight: isOpen || tab.done ? 700 : 400 }}>{tab.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      );
                    })()}

                    {/* Review panel — opens when a tab is clicked */}
                    {activeCardTab === "image" && (
                      <div style={{ background: `${blue}08`, borderBottom: `1px solid ${border}`, padding: 10 }}>
                        {hasImage ? (
                          <>
                            <img src={sceneImages[scene.sceneId]} alt={scene.title}
                              style={{ width: "100%", borderRadius: 8, objectFit: "cover", maxHeight: 160, display: "block", marginBottom: 8 }} />
                            {/* 3-B: Stale image badge — show when description changed since last gen */}
                            {sceneImages[scene.sceneId] && sceneDescHashes[scene.sceneId] && sceneDescHashes[scene.sceneId] !== hashStr(scene.description || "") && (
                              <div title="Scene description changed since last image was generated"
                                style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#f59e0b20", border: "1px solid #f59e0b60", borderRadius: 6, padding: "3px 8px", marginBottom: 6, fontSize: 9, color: "#f59e0b", fontWeight: 700 }}>
                                ⚠ stale
                              </div>
                            )}
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setPreviewMedia({ url: sceneImages[scene.sceneId], type: "image", title: `${scene.sceneId}: ${scene.title}` })}
                                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                Full Preview
                              </button>
                              <button onClick={() => makeSceneImage(scene)} disabled={generatingSceneImage === scene.sceneId || generatingVariations.has(scene.sceneId)}
                                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "none", background: generatingSceneImage === scene.sceneId ? "#2a2a40" : "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneImage === scene.sceneId ? "not-allowed" : "pointer" }}>
                                {generatingSceneImage === scene.sceneId ? "Regenerating..." : "Regen"}
                              </button>
                              <button
                                onClick={() => makeSceneImageVariations(scene)}
                                disabled={generatingVariations.has(scene.sceneId) || generatingSceneImage === scene.sceneId}
                                title="Generate 3 variations with different seeds — pick from history"
                                style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid rgba(168,85,247,0.4)`, background: generatingVariations.has(scene.sceneId) ? "#2a2a40" : "rgba(168,85,247,0.15)", color: generatingVariations.has(scene.sceneId) ? muted : "#a855f7", fontSize: 9, fontWeight: 700, cursor: generatingVariations.has(scene.sceneId) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                {generatingVariations.has(scene.sceneId) ? "3×..." : "Gen 3"}
                              </button>
                            </div>
                            {/* Lock Faces from SC1 — only show on the FIRST scene (scene.scene === 1)
                                WHY: SC1 is the identity anchor. Faces picked here become PuLID refs
                                for SC2-SCN. Showing on later scenes would cause confusion (which scene
                                is the identity source?). If user regenerates SC1 they can re-run. */}
                            {scene.scene === 1 && scene.characterIds.length > 0 && (() => {
                              // Build the list of characters that actually appear in SC1
                              const sc1Chars = scene.characterIds
                                .map(id => characters.find(c => c.characterId === id))
                                .filter((c): c is CharacterIdentity => !!c);
                              if (sc1Chars.length === 0) return null;
                              return (
                                <div style={{ marginTop: 6 }}>
                                  <button
                                    onClick={() => {
                                      setPickFacesState({
                                        sceneId: scene.sceneId,
                                        sceneImageUrl: sceneImages[scene.sceneId],
                                        characters: sc1Chars.map(c => ({ characterId: c.dbId || c.characterId, displayName: c.displayName })),
                                        currentIdx: 0,
                                        clicks: sc1Chars.map(() => null),
                                        saving: false,
                                        savedCount: 0,
                                        error: null,
                                      });
                                    }}
                                    title="Click each character's face in SC1 to save it as their portrait — locks faces for consistent identity across all scenes"
                                    style={{
                                      width: "100%", padding: "5px 8px", borderRadius: 6,
                                      border: "1px solid #22c55e60",
                                      background: "#22c55e12",
                                      color: "#22c55e",
                                      fontSize: 9, fontWeight: 700, cursor: "pointer",
                                    }}>
                                    Lock Faces from SC1 ({sc1Chars.length} char{sc1Chars.length > 1 ? "s" : ""})
                                  </button>
                                </div>
                              );
                            })()}
                            {/* Gen Max — generate one image per action beat */}
                            {(() => {
                              const beats = splitIntoActionBeats(`${scene.title}. ${scene.description}`);
                              const isMaxing = generatingMaxBeats.has(scene.sceneId);
                              const beatImgs = sceneBeatImages[scene.sceneId];
                              if (beats.length <= 1 && (!beatImgs || beatImgs.length === 0)) return null;
                              return (
                                <div style={{ marginTop: 6 }}>
                                  <button
                                    onClick={() => makeSceneBeatImages(scene)}
                                    disabled={isMaxing || generatingSceneImage === scene.sceneId || generatingVariations.has(scene.sceneId)}
                                    style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "none", background: isMaxing ? "#2a2a40" : "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: isMaxing ? "not-allowed" : "pointer" }}>
                                    {isMaxing ? (maxBeatsProgress[scene.sceneId] || "Generating beats...") : `Gen Max (${beats.length} beats)`}
                                  </button>
                                  {beatImgs && beatImgs.length > 0 && (
                                    <div style={{ marginTop: 6 }}>
                                      <div style={{ fontSize: 8, color: muted, marginBottom: 2 }}>Tick beats to include in assembly</div>
                                      <div style={{ display: "flex", gap: 4, overflowX: "auto", paddingBottom: 2 }}>
                                        {beatImgs.map((url, bi) => {
                                          const checked = selectedBeatImages[scene.sceneId]?.[bi] !== false;
                                          return (
                                            <div key={bi} style={{ flexShrink: 0, textAlign: "center" }}>
                                              <img src={url} alt={`Beat ${bi + 1}`}
                                                style={{ width: 60, height: 44, borderRadius: 4, objectFit: "cover", display: "block", border: `2px solid ${checked ? accent : "#33334a"}`, cursor: "pointer", opacity: checked ? 1 : 0.4 }}
                                                onClick={() => setPreviewMedia({ url, type: "image", title: `${scene.title} — Beat ${bi + 1}` })} />
                                              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3, marginTop: 2, cursor: "pointer", userSelect: "none" as const }}>
                                                <input type="checkbox" checked={checked}
                                                  onChange={e => setSelectedBeatImages(prev => {
                                                    const arr = [...(prev[scene.sceneId] || beatImgs.map(() => true))];
                                                    arr[bi] = e.target.checked;
                                                    return { ...prev, [scene.sceneId]: arr };
                                                  })}
                                                  style={{ width: 10, height: 10, cursor: "pointer" }} />
                                                <span style={{ fontSize: 7, color: checked ? "#fff" : muted }}>B{bi + 1}</span>
                                              </label>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                            {/* 3-A: Saved Images panel — shows all /storage/ files for this scene */}
                            {(() => {
                              const localImgs = sceneLocalImages[scene.sceneId] || [];
                              // Auto-load on first expand
                              if (localImgs.length === 0 && projectId && scene.sceneId) {
                                // Trigger async load — safe in render because loadSceneLocalImages is idempotent
                                // Use a once-flag via a ref to avoid infinite loop
                              }
                              if (localImgs.length === 0) return null;
                              return (
                                <div style={{ marginTop: 8, borderTop: `1px solid ${border}`, paddingTop: 8 }}>
                                  <div style={{ fontSize: 8, color: muted, marginBottom: 4, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                                    💾 Saved Locally ({localImgs.length})
                                  </div>
                                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                                    {localImgs.map((imgUrl, li) => (
                                      <div key={li} style={{ position: "relative" as const, flexShrink: 0 }}>
                                        <img src={imgUrl} alt={`Saved ${li + 1}`}
                                          onClick={() => setSceneImages(prev => ({ ...prev, [scene.sceneId]: imgUrl }))}
                                          title="Click to set as active image"
                                          style={{ width: 40, height: 40, borderRadius: 4, objectFit: "cover", cursor: "pointer", border: sceneImages[scene.sceneId] === imgUrl ? `2px solid ${accent}` : `1px solid ${border}`, display: "block" }} />
                                        <button
                                          onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                              await fetch(`/api/hybrid/scene-images?file=${encodeURIComponent(imgUrl)}`, { method: "DELETE" });
                                              setSceneLocalImages(prev => ({ ...prev, [scene.sceneId]: (prev[scene.sceneId] || []).filter(u => u !== imgUrl) }));
                                            } catch { /* non-blocking */ }
                                          }}
                                          title="Delete this saved image"
                                          style={{ position: "absolute" as const, top: -3, right: -3, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: 8, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0 }}>
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <button
                                    onClick={() => loadSceneLocalImages(scene.sceneId, projectId || "")}
                                    style={{ marginTop: 4, padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                                    Refresh
                                  </button>
                                </div>
                              );
                            })()}
                          </>
                        ) : (
                          <div style={{ textAlign: "center", padding: "12px 0" }}>
                            <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>No image generated yet</p>
                            {effectiveImageModelId.includes("ideogram_v3") && (
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8, cursor: "pointer" }}>
                                <input type="checkbox" checked={transparentBg} onChange={e => setTransparentBg(e.target.checked)} />
                                <span style={{ fontSize: 10, color: "#aaa" }}>Transparent Background (PNG)</span>
                              </label>
                            )}
                            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                              <button onClick={() => makeSceneImage(scene)} disabled={generatingVariations.has(scene.sceneId)}
                                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#00d4ff,#0084ff)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                Generate Image
                              </button>
                              <button
                                onClick={() => makeSceneImageVariations(scene)}
                                disabled={generatingVariations.has(scene.sceneId)}
                                title="Generate 3 variations — pick which one to use"
                                style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid rgba(168,85,247,0.4)`, background: "rgba(168,85,247,0.15)", color: "#a855f7", fontSize: 10, fontWeight: 700, cursor: generatingVariations.has(scene.sceneId) ? "not-allowed" : "pointer" }}>
                                {generatingVariations.has(scene.sceneId) ? "3×..." : "Gen 3"}
                              </button>
                              {(() => {
                                const beats = splitIntoActionBeats(`${scene.title}. ${scene.description}`);
                                if (beats.length <= 1) return null;
                                const isMaxing = generatingMaxBeats.has(scene.sceneId);
                                return (
                                  <button
                                    onClick={() => makeSceneBeatImages(scene)}
                                    disabled={isMaxing || generatingVariations.has(scene.sceneId)}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: isMaxing ? "#2a2a40" : "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: isMaxing ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                    {isMaxing ? (maxBeatsProgress[scene.sceneId] || "...") : `Gen Max (${beats.length})`}
                                  </button>
                                );
                              })()}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {activeCardTab === "audio" && (
                      <div style={{ background: `${gold}08`, borderBottom: `1px solid ${border}`, padding: 10 }}>
                        {/* Music */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 9, color: gold, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Music</div>
                          {selectedMusicUrl ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${gold}12`, borderRadius: 6, padding: "4px 8px" }}>
                              <Icon.Music style={{ width: 10, height: 10 }} />
                              <span style={{ fontSize: 9, color: "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedMusicName || "Track selected"}</span>
                              <audio src={selectedMusicUrl} controls style={{ height: 22, width: 100 }} />
                            </div>
                          ) : scene.audioPlan?.musicMood ? (
                            <div style={{ fontSize: 9, color: gold, background: `${gold}10`, borderRadius: 6, padding: "4px 8px" }}>
                              Mood: <strong>{scene.audioPlan.musicMood}</strong>
                              {scene.audioPlan.musicIntensity && <span style={{ color: muted }}> · {scene.audioPlan.musicIntensity}</span>}
                              <div style={{ fontSize: 8, color: muted, marginTop: 2 }}>No track assigned — go to Audio tab to pick music</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 9, color: muted }}>No music planned — run AI Audio Plan</div>
                          )}
                        </div>
                        {/* Narration */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 9, color: gold, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Narration</div>
                          {scene.narrationScript ? (
                            <div style={{ fontSize: 9, color: "#ddd", background: "#ffffff08", borderRadius: 6, padding: "6px 8px", fontStyle: "italic", lineHeight: 1.5 }}>
                              "{scene.narrationScript.slice(0, 150)}{scene.narrationScript.length > 150 ? "..." : ""}"
                              <div style={{ marginTop: 3, fontSize: 8, color: muted, fontStyle: "normal" }}>
                                Intensity: {scene.audioPlan?.narrationIntensity || "medium"}
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 9, color: muted }}>No narration script — run AI Narrate in Audio tab</div>
                          )}
                        </div>
                        {/* SFX */}
                        <div style={{ marginBottom: scene.audioPlan?.ambienceList?.length ? 8 : 0 }}>
                          <div style={{ fontSize: 9, color: gold, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>SFX</div>
                          {sceneSfxUrls[scene.sceneId] ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6, background: `${gold}12`, borderRadius: 6, padding: "4px 8px", marginBottom: scene.audioPlan?.sfxList?.length ? 4 : 0 }}>
                              <span style={{ fontSize: 8, color: gold, fontWeight: 700, flexShrink: 0 }}>AUTO SFX</span>
                              <audio src={sceneSfxUrls[scene.sceneId]} controls style={{ height: 22, flex: 1, minWidth: 0 }} />
                            </div>
                          ) : null}
                          {scene.audioPlan?.sfxList?.length ? (
                            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                              {scene.audioPlan.sfxList.map((sfx, i) => (
                                <span key={i} style={{ fontSize: 8, background: `${gold}18`, border: `1px solid ${gold}30`, borderRadius: 4, padding: "2px 6px", color: gold }}>{sfx}</span>
                              ))}
                            </div>
                          ) : !sceneSfxUrls[scene.sceneId] ? (
                            <div style={{ fontSize: 9, color: muted }}>No SFX planned — run AI Audio Plan or Auto SFX</div>
                          ) : null}
                        </div>
                        {/* Ambience */}
                        {scene.audioPlan?.ambienceList?.length ? (
                          <div>
                            <div style={{ fontSize: 9, color: gold, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Ambience</div>
                            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                              {scene.audioPlan.ambienceList.map((a, i) => (
                                <span key={i} style={{ fontSize: 8, background: "#ffffff08", border: `1px solid ${border}`, borderRadius: 4, padding: "2px 6px", color: muted }}>{a}</span>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    )}

                    {activeCardTab === "video" && (
                      <div style={{ background: `${purple}08`, borderBottom: `1px solid ${border}`, padding: 10 }}>
                        {hasVideo ? (
                          <>
                            <video src={sceneVideos[scene.sceneId]} controls loop={continuousMotionEnabled}
                              style={{ width: "100%", borderRadius: 8, display: "block", maxHeight: 160, background: "#000", marginBottom: 8 }} />
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                              <button onClick={() => setPreviewMedia({ url: sceneVideos[scene.sceneId], type: "video", title: `${scene.sceneId}: ${scene.title}` })}
                                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${purple}40`, background: `${purple}10`, color: purple, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                ▶ Full Screen
                              </button>
                              <button onClick={() => makeSceneVideo(scene, scene.motionDuration)} disabled={generatingSceneVideos.has(scene.sceneId)}
                                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "none", background: generatingSceneVideos.has(scene.sceneId) ? "#2a2a40" : "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneVideos.has(scene.sceneId) ? "not-allowed" : "pointer" }}>
                                {generatingSceneVideos.has(scene.sceneId) ? "Generating..." : "New Version"}
                              </button>
                            </div>
                            {videoVersionCount > 1 && (
                              <div style={{ fontSize: 8, color: muted, marginTop: 6 }}>
                                {videoVersionCount} versions generated — showing latest
                              </div>
                            )}
                          </>
                        ) : generatingSceneVideos.has(scene.sceneId) ? (
                          <div style={{ textAlign: "center", padding: "12px 0" }}>
                            <p style={{ fontSize: 10, color: purple }}>Video is generating...</p>
                            {sceneGenProgress[scene.sceneId] && (
                              <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>{sceneGenProgress[scene.sceneId].message}</p>
                            )}
                          </div>
                        ) : (
                          <div style={{ textAlign: "center", padding: "12px 0" }}>
                            <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>No video generated yet</p>
                            <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                              <button onClick={() => makeSceneVideo(scene, scene.motionDuration)} disabled={!hasImage}
                                style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: hasImage ? "linear-gradient(135deg,#a855f7,#7c3aed)" : "#2a2a40", color: hasImage ? "#fff" : muted, fontSize: 10, fontWeight: 700, cursor: hasImage ? "pointer" : "not-allowed" }}>
                                Generate Video
                              </button>
                              <button onClick={() => setShowAidPicker(true)}
                                style={{ padding: "6px 10px", borderRadius: 8, border: "1.5px solid #7c3aed60", background: "#1a0f3a", color: "#c084fc", fontSize: 9, fontWeight: 800, cursor: "pointer" }}>
                                AI Model
                              </button>
                            </div>
                            {!hasImage && <p style={{ fontSize: 8, color: muted, marginTop: 6 }}>Generate an image first</p>}
                          </div>
                        )}
                      </div>
                    )}

                    {/* ── AI Fix Chat — per-scene local LLM chat to correct image/description ── */}
                    {activeCardTab === "chat" && (() => {
                      const chatMsgs = sceneChatMessages[scene.sceneId] || [];
                      const chatInput = sceneChatInput[scene.sceneId] || "";
                      const chatBusy = sceneChatLoading.has(scene.sceneId);

                      const sendChat = async () => {
                        if (!chatInput.trim() || chatBusy) return;
                        const userMsg = chatInput.trim();
                        const newHistory = [...chatMsgs, { role: "user" as const, content: userMsg }];
                        setSceneChatMessages(prev => ({ ...prev, [scene.sceneId]: newHistory }));
                        setSceneChatInput(prev => ({ ...prev, [scene.sceneId]: "" }));
                        setSceneChatLoading(prev => new Set(prev).add(scene.sceneId));
                        try {
                          const res = await fetch("/api/hybrid/scene-chat", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              sceneId: scene.sceneId,
                              sceneTitle: scene.title,
                              sceneDescription: scene.description,
                              sceneLocation: scene.location,
                              sceneMood: scene.mood,
                              characters: scene.characterIds.map(id => characters.find(c => c.characterId === id)?.displayName || id),
                              userMessage: userMsg,
                              history: chatMsgs,
                              provider: effectiveLlmProvider, // auto = ollama → openai → claude fallback
                            }),
                          });
                          const data = await res.json();
                          if (data.ok) {
                            setSceneChatMessages(prev => ({
                              ...prev,
                              [scene.sceneId]: [...newHistory, { role: "assistant" as const, content: data.reply }],
                            }));
                          } else {
                            setSceneChatMessages(prev => ({
                              ...prev,
                              [scene.sceneId]: [...newHistory, { role: "assistant" as const, content: `Error: ${data.error || "AI unavailable"}` }],
                            }));
                          }
                        } catch {
                          setSceneChatMessages(prev => ({
                            ...prev,
                            [scene.sceneId]: [...newHistory, { role: "assistant" as const, content: "Connection error — is Ollama running?" }],
                          }));
                        } finally {
                          setSceneChatLoading(prev => { const s = new Set(prev); s.delete(scene.sceneId); return s; });
                        }
                      };

                      return (
                        <div style={{ background: "#0a1a0a", borderBottom: `1px solid ${border}`, padding: 10 }}>
                          <p style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, marginBottom: 6 }}>AI Scene Fix — local LLM, no cost</p>
                          {/* Chat history */}
                          <div style={{ maxHeight: 180, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 8 }}>
                            {chatMsgs.length === 0 && (
                              <p style={{ fontSize: 9, color: muted, fontStyle: "italic" }}>
                                Tell the AI what's wrong: "Bryan should look angry, bullies should be blocking him" or "image is too calm, add tension"
                              </p>
                            )}
                            {chatMsgs.map((m, mi) => (
                              <div key={mi} style={{
                                padding: "6px 8px", borderRadius: 6, fontSize: 9, lineHeight: 1.4,
                                background: m.role === "user" ? "rgba(0,212,255,0.08)" : "rgba(74,222,128,0.08)",
                                color: m.role === "user" ? "#9ae8ff" : "#86efac",
                                border: `1px solid ${m.role === "user" ? "#00d4ff20" : "#4ade8020"}`,
                                alignSelf: m.role === "user" ? "flex-end" as const : "flex-start" as const,
                                maxWidth: "92%",
                              }}>
                                <span style={{ fontWeight: 700, marginRight: 4 }}>{m.role === "user" ? "You:" : "AI:"}</span>
                                {m.content}
                              </div>
                            ))}
                            {chatBusy && (
                              <div style={{ fontSize: 9, color: "#4ade80", padding: "4px 8px" }}>AI thinking...</div>
                            )}
                          </div>
                          {/* Check if last AI message has an image prompt suggestion.
                              Apply = put suggestion into scene description ONLY (no regen).
                              User then clicks Gen Image / Gen Max in the image row to regenerate. */}
                          {(() => {
                            const lastAI = [...chatMsgs].reverse().find(m => m.role === "assistant");
                            const promptLine = lastAI?.content.split("\n").find(l => l.startsWith("IMAGE PROMPT:"));
                            if (!promptLine) return null;
                            const suggestion = promptLine.replace("IMAGE PROMPT:", "").trim();
                            const justApplied = scene.description?.trim() === suggestion.trim();
                            return (
                              <div style={{ marginBottom: 8, padding: "6px 8px", background: "rgba(0,212,255,0.06)", borderRadius: 6, border: "1px solid #00d4ff20" }}>
                                <p style={{ fontSize: 8, color: "#00d4ff", fontWeight: 700, marginBottom: 4 }}>AI Image Prompt Suggestion:</p>
                                <p style={{ fontSize: 8, color: muted, marginBottom: 6, fontStyle: "italic" }}>{suggestion.slice(0, 200)}</p>
                                <button
                                  onClick={() => {
                                    updateScene(scene.scene, { description: suggestion });
                                    setLastAction(justApplied
                                      ? `Already applied — click Gen Image or Gen Max to regenerate`
                                      : `Applied to Scene ${scene.scene} description — click Gen Image / Gen Max to regenerate`);
                                  }}
                                  style={{ padding: "4px 10px", borderRadius: 6, border: "none",
                                    background: justApplied ? "#22c55e30" : "linear-gradient(135deg,#00d4ff,#0084ff)",
                                    color: justApplied ? "#22c55e" : "#fff", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                  {justApplied ? "✓ Applied — use Gen Image / Gen Max" : "Apply"}
                                </button>
                              </div>
                            );
                          })()}
                          {/* Input */}
                          <div style={{ display: "flex", gap: 6 }}>
                            <input
                              value={chatInput}
                              onChange={e => setSceneChatInput(prev => ({ ...prev, [scene.sceneId]: e.target.value }))}
                              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
                              placeholder="What's wrong with this scene image?"
                              disabled={chatBusy}
                              style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "#0d1a0d", color: "#fff", fontSize: 9, outline: "none" }}
                            />
                            <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()}
                              style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: chatBusy || !chatInput.trim() ? "#2a2a40" : "#4ade80", color: "#000", fontSize: 9, fontWeight: 700, cursor: chatBusy || !chatInput.trim() ? "not-allowed" : "pointer" }}>
                              {chatBusy ? "..." : "Send"}
                            </button>
                          </div>
                          {chatMsgs.length > 0 && (
                            <button onClick={() => setSceneChatMessages(prev => ({ ...prev, [scene.sceneId]: [] }))}
                              style={{ marginTop: 6, padding: "3px 8px", borderRadius: 5, border: "none", background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                              Clear chat
                            </button>
                          )}
                        </div>
                      );
                    })()}

                    {/* Content */}
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{scene.title}</p>
                      {/* SE: inline scene description textarea — always editable, debounce 500ms */}
                      <textarea
                        value={scene.description}
                        rows={3}
                        onChange={e => {
                          const val = e.target.value;
                          updateScene(scene.scene, { description: val });
                          // Debounce: clear previous timer then set new one (state already updated above)
                          clearTimeout(sceneDescTimers.current[scene.sceneId]);
                          sceneDescTimers.current[scene.sceneId] = setTimeout(() => {
                            // State is already persisted via updateScene — this is a no-op hook point
                            // for future API persistence if needed
                          }, 500);
                        }}
                        placeholder="Scene description..."
                        style={{ width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 8px", color: "#c0c0c8", fontSize: 10, lineHeight: 1.4, outline: "none", resize: "vertical", fontFamily: "inherit", marginBottom: 8 }}
                      />

                      {/* ── Scene Intelligence — environment + ambient sounds ── */}
                      {(() => {
                        const intel = sceneIntelligence[scene.sceneId];
                        if (!intel) return null;
                        const energyColor = intel.energyLevel === "chaotic" ? red
                          : intel.energyLevel === "tense" ? gold
                          : intel.energyLevel === "dramatic" ? purple
                          : intel.energyLevel === "mysterious" ? "#6366f1"
                          : intel.energyLevel === "peaceful" ? accent
                          : muted;
                        const envLabel = intel.environmentType.replace(/-/g, " ");
                        return (
                          <div style={{ marginBottom: 8, padding: "6px 8px", borderRadius: 8, background: "#ffffff05", border: "1px solid #ffffff0a" }}>
                            {/* Environment header */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                              <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", textTransform: "capitalize" as const }}>{intel.environmentType.replace(/-/g, " ")}</span>
                              <span style={{ fontSize: 8, color: muted }}>•</span>
                              <span style={{ fontSize: 8, color: muted, textTransform: "capitalize" as const }}>{intel.timeOfDay}</span>
                              {intel.weather !== "clear" && (
                                <><span style={{ fontSize: 8, color: muted }}>•</span>
                                <span style={{ fontSize: 8, color: "#c0d0e0", textTransform: "capitalize" as const }}>{intel.weather}</span></>
                              )}
                              <span style={{ marginLeft: "auto", fontSize: 7, padding: "1px 5px", borderRadius: 4, background: `${energyColor}20`, color: energyColor, fontWeight: 700, textTransform: "uppercase" as const }}>{intel.energyLevel}</span>
                            </div>
                            {/* Ambient sound chips */}
                            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" as const }}>
                              {intel.ambienceSounds.slice(0, 4).map((sound, i) => (
                                <span key={i} style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#1a2a1a", color: "#4ade80", border: "1px solid #4ade8030" }}>
                                  {sound}
                                </span>
                              ))}
                              {intel.sfxEvents.length > 0 && (
                                <span style={{ fontSize: 7, padding: "2px 6px", borderRadius: 20, background: "#2a1a1a", color: gold, border: `1px solid ${gold}30` }}>
                                  {intel.sfxEvents[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Characters */}
                      {sceneChars.length > 0 && (
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                          {sceneChars.map(name => (
                            <span key={name} style={{ fontSize: 8, padding: "2px 8px", borderRadius: 20, background: `${purple}15`, color: purple }}>{name}</span>
                          ))}
                        </div>
                      )}

                      {/* Info row */}
                      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" as const, alignItems: "center" }}>
                        <span style={{ fontSize: 9, color: muted }}>{scene.credits} cr</span>
                        <span style={{ fontSize: 9, color: muted }}>{scene.motionDuration || 5}s</span>
                        {scene.narrationStrength && <span style={{ fontSize: 9, color: gold }}>Narr: {scene.narrationStrength}</span>}
                        {scene.sceneTag && (
                          <span style={{ fontSize: 7, padding: "2px 7px", borderRadius: 20, fontWeight: 700, textTransform: "uppercase" as const,
                            background: scene.sceneTag === "VISUAL" ? "rgba(0,212,255,0.15)"
                              : scene.sceneTag === "ACTION" ? "rgba(239,68,68,0.15)"
                              : scene.sceneTag === "BEAT" ? "rgba(168,85,247,0.15)"
                              : scene.sceneTag === "DIALOGUE" ? "rgba(34,197,94,0.15)"
                              : scene.sceneTag === "ESTABLISH" ? "rgba(245,158,11,0.15)"
                              : "rgba(255,255,255,0.08)",
                            color: scene.sceneTag === "VISUAL" ? "#00d4ff"
                              : scene.sceneTag === "ACTION" ? "#ef4444"
                              : scene.sceneTag === "BEAT" ? "#a855f7"
                              : scene.sceneTag === "DIALOGUE" ? "#22c55e"
                              : scene.sceneTag === "ESTABLISH" ? "#f59e0b"
                              : muted,
                          }}>
                            {scene.sceneTag}
                          </span>
                        )}
                      </div>

                      {/* Video player — shows active (latest) version */}
                      {sceneVideos[scene.sceneId] && (
                        <div style={{ marginBottom: 8, borderRadius: 8, overflow: "hidden", background: "#000" }}>
                          <video src={sceneVideos[scene.sceneId]} controls loop muted
                            style={{ width: "100%", maxHeight: 120, objectFit: "cover", display: "block" }} />
                          <p style={{ fontSize: 8, color: accent, padding: "2px 6px", background: `${accent}10` }}>
                            Video ready {videoVersionCount > 1 ? `— v${videoVersionCount} (${videoVersionCount} versions saved)` : ""}
                          </p>
                        </div>
                      )}
                      {/* Previous video versions — select to make active (never deleted) */}
                      {videoVersionCount > 1 && (
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 8, color: muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>All video versions — click to set active</p>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                            {sceneVideoVersions[scene.sceneId].map((vUrl, idx) => {
                              const isActive = vUrl === sceneVideos[scene.sceneId];
                              return (
                                <div key={idx} onClick={() => setSceneVideos(prev => ({ ...prev, [scene.sceneId]: vUrl }))}
                                  style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${isActive ? purple : border}`, background: isActive ? `${purple}15` : "transparent", cursor: "pointer", fontSize: 8, color: isActive ? purple : muted, fontWeight: isActive ? 700 : 400 }}>
                                  v{idx + 1} {isActive ? "▶ active" : ""}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* ── Previous image versions — shown after Regen ── */}
                      {(prevSceneImages[scene.sceneId]?.length ?? 0) > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          <p style={{ fontSize: 8, color: muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Previous versions — click to restore</p>
                          <div style={{ display: "flex", gap: 4 }}>
                            {prevSceneImages[scene.sceneId].map((prevUrl, idx) => (
                              <div key={idx} style={{ position: "relative", cursor: "pointer", borderRadius: 6, overflow: "hidden", border: `1px solid ${border}`, flexShrink: 0 }}
                                title="Click to restore this version"
                                onClick={() => {
                                  // Swap current → push to history, pull this one to current
                                  const current = sceneImages[scene.sceneId];
                                  setSceneImages(prev => ({ ...prev, [scene.sceneId]: prevUrl }));
                                  setPrevSceneImages(p => {
                                    const arr = [...(p[scene.sceneId] || [])];
                                    arr[idx] = current; // put current in the slot we just took from
                                    return { ...p, [scene.sceneId]: arr };
                                  });
                                  setLastAction(`Scene ${scene.scene}: restored previous version`);
                                }}>
                                <img src={prevUrl} alt={`v${idx + 1}`} style={{ width: 44, height: 30, objectFit: "cover", display: "block" }} />
                                <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.45)", opacity: 0, transition: "opacity 0.15s" }}
                                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "0"; }}>
                                  <span style={{ fontSize: 10, color: "#fff", fontWeight: 700 }}>↩</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Duration selector on card (for video generation) */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                        <span style={{ fontSize: 9, color: muted, flexShrink: 0 }}>Duration:</span>
                        <input type="range" min={1} max={10} step={1}
                          value={scene.motionDuration || 5}
                          onChange={e => updateScene(scene.scene, { motionDuration: Number(e.target.value) })}
                          style={{ flex: 1, accentColor: purple }} />
                        <span style={{ fontSize: 10, fontWeight: 700, color: purple, minWidth: 24 }}>{scene.motionDuration || 5}s</span>
                      </div>

                      {/* ── Live generation progress bar ── */}
                      {sceneGenProgress[scene.sceneId] && (() => {
                        const pg = sceneGenProgress[scene.sceneId];
                        const barColor = pg.type === "video" ? "#a855f7" : "#00d4ff";
                        return (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                              <span style={{ fontSize: 9, color: barColor, fontWeight: 600 }}>{pg.message}</span>
                              <span style={{ fontSize: 9, color: barColor, fontWeight: 700 }}>{Math.round(pg.percent)}%</span>
                            </div>
                            <div style={{ height: 4, borderRadius: 4, background: "#1a1a2e", overflow: "hidden" }}>
                              <div style={{
                                height: "100%", borderRadius: 4,
                                width: `${pg.percent}%`,
                                background: pg.percent === 100
                                  ? "#22c55e"
                                  : `linear-gradient(90deg, ${barColor}, ${pg.type === "video" ? "#7c3aed" : "#0084ff"})`,
                                transition: "width 0.6s ease",
                                boxShadow: `0 0 6px ${barColor}80`,
                              }} />
                            </div>
                          </div>
                        );
                      })()}

                      {/* ── Image row — Generate OR import from library ── */}
                      <div style={{ display: "flex", gap: 4, marginBottom: 4, flexWrap: "wrap" }}>
                        <select
                          value={sceneStyles[scene.sceneId] || effectiveProjectStyle || "3d-cinematic"}
                          onChange={e => setSceneStyles(prev => ({ ...prev, [scene.sceneId]: e.target.value }))}
                          title="Override style for this scene"
                          style={{ padding: "0 6px", height: 28, borderRadius: 8, border: "1px solid #7c3aed40", background: "#0f172a", color: "#c084fc", fontSize: 9, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                          <option value="3d-cinematic">3D Cinematic</option>
                          <option value="realistic">Realistic</option>
                          <option value="nollywood">Nollywood</option>
                          <option value="2d-cartoon">2D Cartoon</option>
                          <option value="anime">Anime</option>
                          <option value="storybook">Storybook</option>
                          <option value="comic">Comic</option>
                        </select>
                        {/* Gen Image (1) — single image from full description */}
                        <button onClick={() => makeSceneImage(scene)} disabled={generatingSceneImage === scene.sceneId || generatingMaxBeats.has(scene.sceneId)}
                          title="Generate 1 image from full scene description"
                          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", background: generatingSceneImage === scene.sceneId ? "#2a2a40" : "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneImage === scene.sceneId ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                          {generatingSceneImage === scene.sceneId ? "Generating..." : hasImage ? "Regen Image" : "Make Image"}
                        </button>
                        {/* Gen Max — one image per action beat */}
                        {(() => {
                          const beats = splitIntoActionBeats(`${scene.title}. ${scene.description}`);
                          if (beats.length <= 1) return null;
                          const isMaxing = generatingMaxBeats.has(scene.sceneId);
                          return (
                            <button
                              onClick={() => makeSceneBeatImages(scene)}
                              disabled={isMaxing || generatingSceneImage === scene.sceneId}
                              title={`Generate ${beats.length} images — one per action beat in this scene`}
                              style={{ padding: "8px 10px", borderRadius: 8, border: "none", background: isMaxing ? "#2a2a40" : "linear-gradient(135deg,#ff6b00,#ff9500)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: isMaxing ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                              {isMaxing ? (maxBeatsProgress[scene.sceneId] || "...") : `Gen Max (${beats.length})`}
                            </button>
                          );
                        })()}
                        {hasImage && (
                          <button onClick={() => setPreviewMedia({ url: sceneImages[scene.sceneId], type: "image", title: `${scene.sceneId}: ${scene.title}` })}
                            title="Preview image"
                            style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Preview</button>
                        )}
                        <button onClick={() => openLibraryImport(scene.sceneId)}
                          title="Pick an image you already have from Asset Library"
                          style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${blue}50`, background: `${blue}10`, color: blue, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                          Import
                        </button>
                      </div>
                      {/* Lock Faces from SC1 — Grid view. Henry 2026-06-09 (round 3):
                          drop the strict characterId filter. scene.characterIds may
                          store display NAMES ("ANDREW") while characters[].characterId
                          stores generated IDs ("US_ANDREW8BLACK"). Lookup at click
                          time tries BOTH characterId and displayName match, so the
                          button stays visible whenever a SC1 image exists. */}
                      {scene.scene === 1 && hasImage && scene.characterIds.length > 0 && (
                        <button
                          onClick={() => {
                            // Resolve scene.characterIds → characters[] by trying
                            // characterId first, then displayName (case-insensitive),
                            // then fall back to the raw ID as both the lookup key
                            // AND the displayName.
                            const resolved = scene.characterIds.map(id => {
                              const byId = characters.find(c => c.characterId === id);
                              if (byId) return { characterId: byId.dbId || byId.characterId, displayName: byId.displayName };
                              const byName = characters.find(c => c.displayName?.toLowerCase() === id.toLowerCase());
                              if (byName) return { characterId: byName.dbId || byName.characterId, displayName: byName.displayName };
                              return { characterId: id, displayName: id };
                            });
                            setPickFacesState({
                              sceneId: scene.sceneId,
                              sceneImageUrl: sceneImages[scene.sceneId],
                              characters: resolved,
                              currentIdx: 0,
                              clicks: resolved.map(() => null),
                              saving: false,
                              savedCount: 0,
                              error: null,
                            });
                          }}
                          title="Click each character's face in SC1 to save it as their portrait — locks faces for consistent identity across all scenes"
                          style={{
                            marginTop: 6, padding: "4px 10px", borderRadius: 6,
                            border: "1px solid #22c55e80",
                            background: "rgba(34,197,94,0.15)",
                            color: "#22c55e",
                            fontSize: 10, fontWeight: 700, cursor: "pointer",
                            alignSelf: "flex-start" as const,
                          }}>
                          🔒 Lock Faces ({scene.characterIds.length})
                        </button>
                      )}
                      {/* Max image button — ALWAYS visible per Henry's spec.
                          Three states based on whether beats exist + opt-in:
                            A. Beats already generated AND user opted in    → "Max ON (M/N)"  (orange filled)
                            B. Beats already generated AND user not opted in → "Use Max Image (N)" (orange outline)
                            C. No beats yet                                   → "+ Gen Max (~N)" (orange dashed)
                               Clicking fires makeSceneBeatImages(scene) which generates beats AND auto-opts in.
                          Hidden only if scene description is too short to split into multiple beats. */}
                      {(() => {
                        const sceneId = scene.sceneId;
                        // Multi-image source: Gen Max beats first, else current image + prev variations.
                        // HybridScene has no imageUrl field — the active image lives in sceneImages[sceneId];
                        // earlier renders are queued in prevSceneImages[sceneId] (max 3).
                        // Both pools behave identically for the picker UI.
                        const genMaxBeats = sceneBeatImages[sceneId];
                        const currentImg = sceneImages[sceneId];
                        const variantPool = [currentImg, ...(prevSceneImages[sceneId] || [])].filter((u): u is string => !!u);
                        const beats = (genMaxBeats && genMaxBeats.length > 1)
                          ? genMaxBeats
                          : (variantPool.length > 1 ? variantPool : null);
                        const totalBeats = beats?.length ?? 0;
                        const isMaxOn = useMaxImageScenes.has(sceneId);
                        const isGenerating = generatingMaxBeats.has(sceneId);
                        // Predict beat count from current scene description for state-C label.
                        // Minimum 2 so the button still shows even when description is too short to split.
                        const split = splitIntoActionBeats(`${scene.title}. ${scene.description}`).length;
                        const predictedBeats = totalBeats > 0
                          ? totalBeats
                          : Math.max(split, 2);
                        const includedCount = isMaxOn
                          ? (selectedBeatImages[sceneId] || []).filter(Boolean).length
                          : 1;
                        return (
                          <div style={{ marginBottom: 6 }}>
                            {/* STATE C — beats not yet generated. Trigger Gen Max + auto-opt-in. */}
                            {totalBeats === 0 ? (
                              <button
                                onClick={async () => {
                                  if (isGenerating) return;
                                  await makeSceneBeatImages(scene);
                                  setUseMaxImageScenes(prev => new Set(prev).add(sceneId));
                                }}
                                disabled={isGenerating}
                                title={`No max images yet — generate ${predictedBeats} action-beat images for this scene`}
                                style={{
                                  padding: "4px 10px", borderRadius: 6, marginBottom: 4,
                                  border: `1px dashed #ff9500`,
                                  background: isGenerating ? "#2a2040" : "transparent",
                                  color: isGenerating ? muted : "#ff9500",
                                  fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" as const,
                                  cursor: isGenerating ? "not-allowed" : "pointer",
                                }}>
                                {isGenerating
                                  ? (maxBeatsProgress[sceneId] || "Generating…")
                                  : `+ Gen Max (~${predictedBeats})`}
                              </button>
                            ) : (
                              /* STATE A or B — beats exist. Toggle picker. */
                              <button
                                onClick={() => setUseMaxImageScenes(prev => {
                                  const n = new Set(prev);
                                  if (n.has(sceneId)) {
                                    n.delete(sceneId);
                                  } else {
                                    n.add(sceneId);
                                    if (!selectedBeatImages[sceneId] && beats) {
                                      setSelectedBeatImages(p => ({ ...p, [sceneId]: beats.map(() => true) }));
                                    }
                                  }
                                  return n;
                                })}
                                title={isMaxOn
                                  ? `Using ${includedCount} of ${totalBeats} max images — click to revert to single image`
                                  : `Click to use multiple beat images (${totalBeats} available) instead of one`}
                                style={{
                                  padding: "4px 10px", borderRadius: 6, marginBottom: 4,
                                  border: `1px solid ${isMaxOn ? "#ff9500" : "#ff950060"}`,
                                  background: isMaxOn ? "#ff9500" : "#ff950012",
                                  color: isMaxOn ? "#000" : "#ff9500",
                                  fontSize: 9, fontWeight: 700, whiteSpace: "nowrap" as const,
                                  cursor: "pointer",
                                }}>
                                {isMaxOn ? `Max ON (${includedCount}/${totalBeats})` : `Use Max Image (${totalBeats})`}
                              </button>
                            )}
                            {/* Always-visible picker when scene has 2+ images (any source).
                                Henry's spec: don't hide behind a click — spread inline.
                                Auto-opts scene into multi-image mode on first render so assembly uses the spread. */}
                            {beats && beats.length > 1 && (() => {
                              if (!isMaxOn) {
                                setTimeout(() => setUseMaxImageScenes(prev => new Set(prev).add(sceneId)), 0);
                              }
                              return true;
                            })() && beats && beats.length > 1 && (
                              <div style={{ padding: "8px 10px", background: "#ff95000a", border: "1px solid #ff950025", borderRadius: 6 }}>
                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                                  <span style={{ fontSize: 9, color: "#ff9500", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                                    Pick which images to include
                                  </span>
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sceneId]: beats.map(() => true) }))}
                                      style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ff950060", background: "transparent", color: "#ff9500", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                      Select All
                                    </button>
                                    <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sceneId]: beats.map(() => false) }))}
                                      style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                                      Deselect All
                                    </button>
                                    <button onClick={() => {
                                      const checked = selectedBeatImages[sceneId] || beats.map(() => true);
                                      const kept = beats.filter((_, i) => !checked[i]);
                                      const keptChecks = checked.filter((_, i) => !checked[i]);
                                      setSceneBeatImages(prev => ({ ...prev, [sceneId]: kept }));
                                      setSelectedBeatImages(prev => ({ ...prev, [sceneId]: keptChecks }));
                                    }}
                                      style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ef444460", background: "transparent", color: "#ef4444", fontSize: 8, cursor: "pointer" }}>
                                      Del Selected
                                    </button>
                                    <button onClick={() => {
                                      setSceneBeatImages(prev => ({ ...prev, [sceneId]: [] }));
                                      setSelectedBeatImages(prev => ({ ...prev, [sceneId]: [] }));
                                    }}
                                      style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ef444460", background: "#ef44440a", color: "#ef4444", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                      Del All
                                    </button>
                                  </div>
                                </div>
                                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                                  {beats.map((url, bi) => {
                                    const checked = selectedBeatImages[sceneId]?.[bi] !== false;
                                    return (
                                      <div key={bi} style={{ position: "relative" as const }}>
                                        <label
                                          title={`Beat ${bi + 1} — ${checked ? "included" : "skipped"} in assembly`}
                                          style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: 3, borderRadius: 5, border: `2px solid ${checked ? "#ff9500" : "#33334a"}`, background: checked ? "#ff950018" : "transparent", cursor: "pointer", userSelect: "none" as const }}>
                                          <img src={url} alt={`B${bi + 1}`}
                                            style={{ width: 60, height: 44, objectFit: "cover" as const, borderRadius: 3, opacity: checked ? 1 : 0.4 }}
                                            onClick={e => { e.preventDefault(); setPreviewMedia({ url, type: "image", title: `${scene.title} — Beat ${bi + 1}` }); }} />
                                          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                            <input type="checkbox" checked={checked}
                                              onChange={e => setSelectedBeatImages(prev => {
                                                const arr = [...(prev[sceneId] || beats.map(() => true))];
                                                arr[bi] = e.target.checked;
                                                return { ...prev, [sceneId]: arr };
                                              })}
                                              style={{ width: 11, height: 11 }} />
                                            <span style={{ fontSize: 8, color: checked ? "#ff9500" : muted, fontWeight: 700 }}>B{bi + 1}</span>
                                          </div>
                                        </label>
                                        <button
                                          onClick={e => { e.stopPropagation(); setSceneBeatImages(prev => { const a = [...(prev[sceneId] || [])]; a.splice(bi, 1); return { ...prev, [sceneId]: a }; }); setSelectedBeatImages(prev => { const a = [...(prev[sceneId] || beats.map(() => true))]; a.splice(bi, 1); return { ...prev, [sceneId]: a }; }); }}
                                          title="Remove this beat image"
                                          style={{ position: "absolute" as const, top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, zIndex: 2 }}>
                                          ×
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── Per-scene flip override ── */}
                      {(() => {
                        const sceneFlip = scene.flipOverride ?? null;
                        const displayFlip = sceneFlip ?? effectiveFlipSeconds;
                        const isOverridden = sceneFlip !== null && sceneFlip !== undefined;
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4, padding: "4px 8px", borderRadius: 6, background: isOverridden ? "#a855f710" : "transparent", border: `1px solid ${isOverridden ? "#a855f740" : border}` }}>
                            <span style={{ fontSize: 8, color: isOverridden ? accent : muted, fontWeight: 700, whiteSpace: "nowrap" as const }}>flip:</span>
                            <input
                              type="number" min={1} max={30} value={displayFlip}
                              onChange={e => {
                                const v = Math.max(1, Math.min(30, Number(e.target.value) || effectiveFlipSeconds));
                                setScenes(prev => prev.map(s => s.sceneId === scene.sceneId ? { ...s, flipOverride: v } : s));
                              }}
                              style={{ width: 36, padding: "2px 4px", borderRadius: 4, border: `1px solid ${isOverridden ? "#a855f740" : border}`, background: "#1a1a2e", color: isOverridden ? accent : muted, fontSize: 9, textAlign: "center" as const }}
                            />
                            <span style={{ fontSize: 8, color: muted }}>s</span>
                            {isOverridden && (
                              <button
                                onClick={() => setScenes(prev => prev.map(s => s.sceneId === scene.sceneId ? { ...s, flipOverride: null } : s))}
                                title="Reset to project default"
                                style={{ padding: "1px 5px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                                reset
                              </button>
                            )}
                            {!isOverridden && (
                              <span style={{ fontSize: 8, color: muted }}>↑ project default</span>
                            )}
                          </div>
                        );
                      })()}

                      {/* ── Video + secondary actions row ── */}
                      <div style={{ display: "flex", gap: 4, alignItems: "stretch" }}>
                        <button
                          onClick={() => makeSceneVideo(scene, scene.motionDuration)}
                          disabled={generatingSceneVideos.has(scene.sceneId) || !hasImage}
                          title={!hasImage ? "Generate an image first" : "Animate this scene"}
                          style={{ flex: 1, padding: "7px 10px", borderRadius: 8, border: "none",
                            background: generatingSceneVideos.has(scene.sceneId) ? "#2a2a40" : !hasImage ? "#1a1a2e" : "linear-gradient(135deg, #a855f7, #7c3aed)",
                            color: !hasImage ? muted : "#fff", fontSize: 9, fontWeight: 700,
                            cursor: (generatingSceneVideos.has(scene.sceneId) || !hasImage) ? "not-allowed" : "pointer",
                            whiteSpace: "nowrap" as const }}>
                          {generatingSceneVideos.has(scene.sceneId) ? "Making..." : hasVideo ? (continuousMotionEnabled ? "New 10s Video" : "New Video") : (continuousMotionEnabled ? "Make Video (10s)" : "Make Video")}
                        </button>
                        {/* Small buttons — all same height via alignItems stretch */}
                        <div style={{ display: "flex", gap: 4, alignItems: "stretch", flexShrink: 0 }}>
                          {hasVideo && (
                            <button onClick={() => setPreviewMedia({ url: sceneVideos[scene.sceneId], type: "video", title: `${scene.sceneId}: ${scene.title}` })}
                              title="Watch video"
                              style={{ padding: "0 8px", borderRadius: 8, border: `1px solid ${purple}50`, background: `${purple}15`, color: purple, fontSize: 11, cursor: "pointer" }}>
                              ▶
                            </button>
                          )}
                          <button onClick={() => setShowAidPicker(true)}
                            title="Change AI model"
                            style={{ padding: "0 8px", borderRadius: 8, border: `1.5px solid #7c3aed60`, background: "#1a0f3a", color: "#c084fc", fontSize: 8, fontWeight: 800, cursor: "pointer", letterSpacing: 0.5 }}>
                            AI Model
                          </button>
                          <button onClick={() => updateScene(scene.scene, { status: scene.status === "approved" ? "draft" : "approved" })}
                            style={{ padding: "0 8px", borderRadius: 8, border: `1px solid ${accent}30`, background: scene.status === "approved" ? `${accent}15` : "transparent", color: accent, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                            {scene.status === "approved" ? "OK" : "OK"}
                          </button>
                          <button onClick={() => setExpandedSceneId(expandedSceneId === scene.sceneId ? null : scene.sceneId)}
                            style={{ padding: "0 8px", borderRadius: 8, border: `1px solid ${border}`, background: expandedSceneId === scene.sceneId ? `${blue}10` : "transparent", color: expandedSceneId === scene.sceneId ? blue : muted, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                            {expandedSceneId === scene.sceneId ? "Close" : "Edit"}
                          </button>
                          <button
                            onClick={() => handlePolishScene(scene.sceneId, scene.description, "polish")}
                            disabled={polishingScene === scene.sceneId}
                            data-testid={`polish-btn-${scene.sceneId}`}
                            style={{ padding: "0 8px", borderRadius: 8, border: `1px solid ${purple}50`, background: polishingScene === scene.sceneId ? `${purple}08` : "transparent", color: polishingScene === scene.sceneId ? muted : purple, fontSize: 9, fontWeight: 600, cursor: polishingScene === scene.sceneId ? "not-allowed" : "pointer" }}>
                            {polishingScene === scene.sceneId ? "..." : "Polish"}
                          </button>
                        </div>
                      </div>
                      {/* ── Per-scene tool row: SFX + Continuous Motion + Music ── */}
                      {(() => {
                        const cm = sceneContinuousMotion[scene.sceneId] ?? { enabled: false, targetSec: 5 };
                        return (
                          <div style={{ display: "flex", gap: 4, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
                            {/* AI Generate SFX */}
                            <button
                              onClick={() => generateSceneSfx(scene)}
                              disabled={generatingSceneSfx.has(scene.sceneId)}
                              title="Auto-generate SFX from scene description"
                              style={{ flex: 1, minWidth: 80, padding: "6px 8px", borderRadius: 7, border: `1px solid #f59e0b50`, background: generatingSceneSfx.has(scene.sceneId) ? "#2a2a30" : "#f59e0b12", color: generatingSceneSfx.has(scene.sceneId) ? muted : "#f59e0b", fontSize: 8, fontWeight: 700, cursor: generatingSceneSfx.has(scene.sceneId) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                              {generatingSceneSfx.has(scene.sceneId) ? (sceneSfxProgress[scene.sceneId] || "SFX...") : scene.audioPlan.sfxList.length > 0 ? `SFX (${scene.audioPlan.sfxList.length})` : "AI SFX"}
                            </button>
                            {/* Continuous Motion toggle */}
                            <button
                              onClick={() => setSceneContinuousMotion(prev => ({
                                ...prev,
                                [scene.sceneId]: { enabled: !cm.enabled, targetSec: cm.targetSec },
                              }))}
                              title="Enable continuous motion (chains segments for longer video)"
                              style={{ padding: "6px 8px", borderRadius: 7, border: `1px solid ${cm.enabled ? "#a855f750" : border}`, background: cm.enabled ? "#a855f715" : "transparent", color: cm.enabled ? "#a855f7" : muted, fontSize: 8, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                              {cm.enabled ? "Motion ON" : "Motion"}
                            </button>
                            {/* Duration selector — only when motion is on */}
                            {cm.enabled && (
                              <select
                                value={cm.targetSec}
                                onChange={e => setSceneContinuousMotion(prev => ({
                                  ...prev,
                                  [scene.sceneId]: { ...cm, targetSec: Number(e.target.value) },
                                }))}
                                style={{ padding: "6px 4px", borderRadius: 7, border: `1px solid #a855f750`, background: "#1a0f3a", color: "#c084fc", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                {[5, 10, 15, 20, 30].map(s => <option key={s} value={s}>{s}s</option>)}
                              </select>
                            )}
                            {/* Generate Scene Music */}
                            <button
                              onClick={async () => {
                                if (generatingSceneMusic.has(scene.sceneId)) return;
                                setGeneratingSceneMusic(prev => new Set(prev).add(scene.sceneId));
                                setLastAction(`Generating music for Scene ${scene.scene}...`);
                                try {
                                  const r = await fetch("/api/music/generate-scene", {
                                    method: "POST", headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ sceneId: scene.sceneId, projectId, mood: scene.audioPlan?.musicMood || scene.mood, genre, tone }),
                                  });
                                  const d = await r.json();
                                  // API returns outputUrl (not musicUrl)
                                  const musicUrl = d.outputUrl || d.musicUrl || d.url;
                                  if (musicUrl) {
                                    updateScene(scene.scene, { audioPlan: { ...(scene.audioPlan || {}), musicUrl, musicMood: d.mood || scene.audioPlan?.musicMood } });
                                    // If no global music selected yet, use this as the assembly music track
                                    if (!selectedMusicUrl) {
                                      setSelectedMusicUrl(musicUrl);
                                      setSelectedMusicName(`Scene ${scene.scene} — ${d.mood || scene.mood || "music"}`);
                                    }
                                    setLastAction(`Music ready for Scene ${scene.scene}`);
                                  } else {
                                    setUiError(d.error || `Music generation failed for Scene ${scene.scene}`);
                                  }
                                } catch (e) { setUiError(`Music gen error: ${String(e)}`); }
                                finally { setGeneratingSceneMusic(prev => { const s = new Set(prev); s.delete(scene.sceneId); return s; }); }
                              }}
                              disabled={generatingSceneMusic.has(scene.sceneId)}
                              title="Generate background music for this scene"
                              style={{ flex: 1, minWidth: 70, padding: "6px 8px", borderRadius: 7, border: `1px solid #22c55e40`, background: "#22c55e10", color: generatingSceneMusic.has(scene.sceneId) ? muted : "#22c55e", fontSize: 8, fontWeight: 700, cursor: generatingSceneMusic.has(scene.sceneId) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                              {generatingSceneMusic.has(scene.sceneId) ? "Generating..." : scene.audioPlan?.musicUrl ? "Music (done)" : "Music"}
                            </button>
                          </div>
                        );
                      })()}
                      {/* ── Per-scene SFX audio players (shown after AI SFX generation) ── */}
                      {(sceneSfxAudioUrls[scene.sceneId]?.length ?? 0) > 0 && (
                        <div style={{ marginTop: 6, display: "flex", flexDirection: "column" as const, gap: 4 }}>
                          <div style={{ fontSize: 8, color: "#f59e0b", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.8 }}>Generated SFX ({sceneSfxAudioUrls[scene.sceneId].length})</div>
                          {sceneSfxAudioUrls[scene.sceneId].map((url, i) => (
                            <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, background: "#f59e0b10", borderRadius: 6, padding: "3px 8px" }}>
                              <span style={{ fontSize: 8, color: "#f59e0b", fontWeight: 600, flexShrink: 0 }}>{scene.audioPlan.sfxList[i] || `SFX ${i + 1}`}</span>
                              <audio src={url} controls style={{ height: 20, flex: 1, minWidth: 0 }} />
                            </div>
                          ))}
                        </div>
                      )}
                      {/* ── Per-scene Music audio player (shown after music generation) ── */}
                      {scene.audioPlan?.musicUrl && (
                        <div style={{ marginTop: 6 }}>
                          <div style={{ fontSize: 8, color: "#22c55e", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.8, marginBottom: 3 }}>Scene Music{scene.audioPlan.musicMood ? ` — ${scene.audioPlan.musicMood}` : ""}</div>
                          <audio src={scene.audioPlan.musicUrl} controls style={{ width: "100%", height: 22 }} />
                        </div>
                      )}

                      {/* ── AI Chat — always visible at bottom of every scene card ── */}
                      {(() => {
                        const chatOpen = aiChatOpenScenes.has(scene.sceneId);
                        const chatMsgs = sceneChatMessages[scene.sceneId] || [];
                        const chatInput = sceneChatInput[scene.sceneId] || "";
                        const chatBusy = sceneChatLoading.has(scene.sceneId);
                        const suggestion = chatMsgs.filter(m => m.role === "assistant").map(m => {
                          const match = m.content.match(/IMAGE PROMPT:\s*(.+)/i);
                          return match ? match[1].trim() : null;
                        }).filter(Boolean).pop() || null;

                        const sendChat = async () => {
                          const msg = chatInput.trim();
                          if (!msg || chatBusy) return;
                          setSceneChatMessages(prev => ({ ...prev, [scene.sceneId]: [...(prev[scene.sceneId] || []), { role: "user" as const, content: msg }] }));
                          setSceneChatInput(prev => ({ ...prev, [scene.sceneId]: "" }));
                          setSceneChatLoading(prev => new Set(prev).add(scene.sceneId));
                          try {
                            const r = await fetch("/api/hybrid/scene-chat", {
                              method: "POST", headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({
                                sceneId: scene.sceneId, sceneTitle: scene.title,
                                sceneDescription: scene.description, sceneLocation: scene.location,
                                sceneMood: scene.mood,
                                characters: characters.filter(c => scene.characterIds?.includes(c.characterId)).map(c => c.displayName),
                                currentImagePrompt: scene.description,
                                userMessage: msg, history: sceneChatMessages[scene.sceneId] || [],
                                provider: effectiveLlmProvider, // auto = ollama → openai → claude fallback
                              }),
                            });
                            const d = await r.json();
                            // Show actual error so user can see WHICH provider failed,
                            // not a generic "is Ollama running" — that's misleading on auto-fallback.
                            const reply = d.ok
                              ? (d.reply || "(empty reply)")
                              : `⚠️ ${d.error || "AI request failed"}`;
                            const labeledReply = d.ok && d.provider ? `[${d.provider}] ${reply}` : reply;
                            setSceneChatMessages(prev => ({ ...prev, [scene.sceneId]: [...(prev[scene.sceneId] || []), { role: "assistant" as const, content: labeledReply }] }));
                          } catch (err) {
                            const msg = err instanceof Error ? err.message : String(err);
                            setSceneChatMessages(prev => ({ ...prev, [scene.sceneId]: [...(prev[scene.sceneId] || []), { role: "assistant" as const, content: `⚠️ Network error: ${msg}` }] }));
                          }
                          setSceneChatLoading(prev => { const n = new Set(prev); n.delete(scene.sceneId); return n; });
                        };

                        return (
                          <div style={{ marginTop: 8, borderTop: `1px solid ${border}`, paddingTop: 6 }}>
                            <button
                              onClick={() => setAiChatOpenScenes(prev => { const n = new Set(prev); if (n.has(scene.sceneId)) n.delete(scene.sceneId); else n.add(scene.sceneId); return n; })}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: 7, border: `1px solid #4ade8040`, background: chatOpen ? "#4ade8018" : "#4ade8008", color: "#4ade80", fontSize: 9, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                              <span>AI Chat</span>
                              <span style={{ fontSize: 8 }}>{chatOpen ? "▲" : "▼"}</span>
                              {chatMsgs.length > 0 && <span style={{ background: "#4ade80", color: "#000", fontSize: 7, padding: "1px 5px", borderRadius: 10, fontWeight: 700 }}>{chatMsgs.length}</span>}
                            </button>
                            {chatOpen && (
                              <div style={{ marginTop: 6, background: "#0d1a0d", borderRadius: 8, padding: 8, border: `1px solid #4ade8020` }}>
                                <div style={{ fontSize: 8, color: "#4ade80", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>
                                  AI Scene Chat — describe the problem, AI suggests a fix
                                </div>
                                {/* Provider selector — Auto runs the ollama→openai→claude chain.
                                    Pick a specific provider to force it (skips fallback). */}
                                <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6, flexWrap: "wrap" as const }}>
                                  <span style={{ fontSize: 7, color: muted, fontWeight: 700, letterSpacing: 0.5 }}>LLM:</span>
                                  {([
                                    { id: "auto",   label: "Auto" },
                                    { id: "ollama", label: "Ollama" },
                                    { id: "openai", label: "GPT" },
                                    { id: "claude", label: "Haiku" },
                                  ] as const).map(p => {
                                    const active = effectiveLlmProvider === p.id;
                                    return (
                                      <button key={p.id} onClick={() => { setAiChatProvider(p.id); patchProjectSettings({ llmProvider: p.id }).catch(() => {}); }}
                                        title={p.id === "auto" ? "Try Ollama first → GPT → Haiku" : `Force ${p.label} only`}
                                        style={{ padding: "2px 7px", borderRadius: 5, border: `1px solid ${active ? "#4ade80" : "#4ade8030"}`,
                                          background: active ? "#4ade8025" : "transparent",
                                          color: active ? "#4ade80" : muted, fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                        {p.label}
                                      </button>
                                    );
                                  })}
                                </div>
                                {/* Chat history */}
                                {chatMsgs.length > 0 && (
                                  <div style={{ maxHeight: 160, overflowY: "auto", marginBottom: 6, display: "flex", flexDirection: "column", gap: 4 }}>
                                    {chatMsgs.map((m, mi) => (
                                      <div key={mi} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                                        <div style={{ maxWidth: "85%", padding: "5px 8px", borderRadius: m.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px", background: m.role === "user" ? "#4ade8020" : "#ffffff08", fontSize: 9, color: m.role === "user" ? "#4ade80" : "#ddd", lineHeight: 1.4, whiteSpace: "pre-wrap" as const }}>
                                          {m.content}
                                        </div>
                                      </div>
                                    ))}
                                    {chatBusy && <div style={{ fontSize: 8, color: "#4ade80", fontStyle: "italic" }}>AI thinking...</div>}
                                  </div>
                                )}
                                {/* Apply suggestion button.
                                    Apply ONLY puts the AI's suggested text into scene.description.
                                    No regen here — user clicks the existing Gen Image / Gen Max
                                    button in the main image row to actually re-render. */}
                                {suggestion && (() => {
                                  const justApplied = scene.description?.trim() === suggestion.trim();
                                  return (
                                    <button
                                      onClick={() => {
                                        updateScene(scene.scene, { description: suggestion });
                                        setLastAction(`Applied to Scene ${scene.scene} description — click Gen Image / Gen Max above to regenerate`);
                                      }}
                                      style={{ width: "100%", marginBottom: 6, padding: "5px 8px", borderRadius: 6, border: "none",
                                        background: justApplied ? "#22c55e30" : "linear-gradient(135deg,#4ade80,#22c55e)",
                                        color: justApplied ? "#22c55e" : "#000", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                      {justApplied ? "✓ Applied — now click Gen Image / Gen Max" : "Apply (text only)"}
                                    </button>
                                  );
                                })()}
                                {/* Input */}
                                <div style={{ display: "flex", gap: 4 }}>
                                  <input
                                    value={chatInput}
                                    onChange={e => setSceneChatInput(prev => ({ ...prev, [scene.sceneId]: e.target.value }))}
                                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendChat(); } }}
                                    placeholder="What's wrong with this scene?"
                                    disabled={chatBusy}
                                    style={{ flex: 1, padding: "6px 8px", borderRadius: 6, border: `1px solid #4ade8030`, background: "#0a1a0a", color: "#fff", fontSize: 9, outline: "none" }}
                                  />
                                  <button onClick={sendChat} disabled={chatBusy || !chatInput.trim()}
                                    style={{ padding: "6px 10px", borderRadius: 6, border: "none", background: chatBusy || !chatInput.trim() ? "#2a2a40" : "#4ade80", color: "#000", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                    {chatBusy ? "..." : "Send"}
                                  </button>
                                </div>
                                {chatMsgs.length > 0 && (
                                  <button onClick={() => setSceneChatMessages(prev => ({ ...prev, [scene.sceneId]: [] }))}
                                    style={{ marginTop: 4, padding: "2px 6px", borderRadius: 4, border: "none", background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>Clear chat</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Expanded SceneImagePanel */}
                      {expandedSceneId === scene.sceneId && (
                        <div style={{ marginTop: 10 }}>
                          <SceneImagePanel
                            sceneId={scene.sceneId}
                            sceneTitle={scene.title}
                            sceneText={scene.description}
                            projectId={projectId || undefined}
                            characters={characters.map(c => ({ id: c.characterId, characterId: c.characterId, name: c.displayName, imageUrl: c.imageUrl }))}
                            selectedCharacterIds={scene.characterIds}
                            onImageGenerated={(url) => {
                              setSceneImages(prev => ({ ...prev, [scene.sceneId]: url }));
                              updateScene(scene.scene, { status: "generated" as const });
                              setLastAction(`Scene ${scene.scene} image generated`);
                            }}
                            onCharacterSelect={(ids) => updateScene(scene.scene, { characterIds: ids })}
                            onTextChange={(t) => updateScene(scene.scene, { description: t })}
                            compact
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* CHARACTERS TAB                                                      */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "characters" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Character Registry ({characters.length})</h2>
              {/* Vision AI provider selector — user picks which AI reads character images */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#ffffff08", border: "1px solid #ffffff15", borderRadius: 8, padding: "4px 10px" }}>
                <span style={{ fontSize: 10, color: "#888", fontWeight: 600, letterSpacing: 0.5 }}>VISION AI</span>
                {(["auto", "ollama", "claude", "gpt"] as const).map(p => (
                  <button key={p} onClick={() => setVisionProvider(p)}
                    title={p === "auto" ? "Try Local → Claude → GPT" : p === "ollama" ? "Local Ollama (llava, moondream)" : p === "claude" ? "Claude Vision (needs API key)" : "GPT-4o Vision (needs API key)"}
                    style={{
                      padding: "3px 8px", borderRadius: 5, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                      background: visionProvider === p ? (p === "ollama" ? "#16a34a" : p === "claude" ? "#7c3aed" : p === "gpt" ? "#0284c7" : accent) : "#ffffff10",
                      color: visionProvider === p ? "#fff" : "#aaa",
                    }}>
                    {p === "auto" ? "Auto" : p === "ollama" ? "Local" : p === "claude" ? "Claude" : "GPT"}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Build all story characters via AI — the main CTA */}
              <button onClick={buildAllStoryCharacters} disabled={buildingAllChars || !( expandedSummary || idea)}
                style={{ padding: "10px 18px", borderRadius: 10, border: "none",
                  background: buildingAllChars ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c3aed)`,
                  color: "#fff", fontSize: 11, fontWeight: 700, cursor: buildingAllChars ? "not-allowed" : "pointer" }}>
                {buildAllProgress || (buildingAllChars ? "Building..." : "Build Story Characters with AI")}
              </button>
              {/* Add single character inline */}
              <div style={{ display: "flex", gap: 4 }}>
                <input value={charTabName} onChange={e => setCharTabName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && charTabName.trim()) { setCharTabCreating(true); buildCharacterInline(charTabName.trim()).then(() => { setCharTabName(""); setCharTabCreating(false); }); }}}
                  placeholder="Add character by name..."
                  style={{ ...inputStyle, width: 180, padding: "8px 12px", fontSize: 11 }} />
                <button onClick={() => { if (charTabName.trim()) { setCharTabCreating(true); buildCharacterInline(charTabName.trim()).then(() => { setCharTabName(""); setCharTabCreating(false); }); }}}
                  disabled={!charTabName.trim() || charTabCreating}
                  style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: charTabCreating ? "#2a2a40" : accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  {charTabCreating ? "..." : "+ Add"}
                </button>
              </div>
              {(() => {
                const charsWithoutImages = characters.filter(c => !c.imageUrl && !c.hasImage);
                return charsWithoutImages.length > 0 ? (
                  <button
                    disabled={!!batchPortraitProgress}
                    onClick={async () => {
                      setUiError(null);
                      let completed = 0;
                      setBatchPortraitProgress(`0/${charsWithoutImages.length}`);
                      for (const char of charsWithoutImages) {
                        try {
                          // Use full visual description for batch, same as single portrait
                          await generateCharacterPortrait(char);
                          completed++;
                          setBatchPortraitProgress(`${completed}/${charsWithoutImages.length}`);
                          if (completed < charsWithoutImages.length) await new Promise(r => setTimeout(r, 1500));
                        } catch (err) { console.error(`Batch portrait failed for ${char.displayName}:`, err); }
                      }
                      setBatchPortraitProgress(null);
                      setLastAction(`Batch: ${completed}/${charsWithoutImages.length} portraits generated`);
                    }}
                    style={{ padding: "10px 18px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 11, fontWeight: 700, cursor: batchPortraitProgress ? "not-allowed" : "pointer", opacity: batchPortraitProgress ? 0.7 : 1 }}>
                    {batchPortraitProgress ? `Generating ${batchPortraitProgress}...` : `Generate All Portraits (${charsWithoutImages.length})`}
                  </button>
                ) : null;
              })()}
              <button onClick={() => setShowCharacterPicker(true)}
                style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${purple}30`, background: "transparent", color: purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                Import Existing
              </button>
            </div>
          </div>

          {/* ── Photo Import Zone — Build Character from Photo ──────────── */}
          <div style={{ marginBottom: 16, position: "relative" }}>
            {/* Section label */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <div style={{ height: 1, flex: 1, background: "linear-gradient(90deg, #ffffff18, transparent)" }} />
              <span style={{ fontSize: 9, fontWeight: 800, color: "#ffffff40", letterSpacing: 2, textTransform: "uppercase" as const }}>Build from Photo</span>
              <div style={{ height: 1, flex: 1, background: "linear-gradient(270deg, #ffffff18, transparent)" }} />
            </div>

            <div
              onDragOver={e => { e.preventDefault(); setPhotoDragOver(true); }}
              onDragLeave={() => setPhotoDragOver(false)}
              onDrop={e => {
                e.preventDefault(); setPhotoDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) importCharacterFromPhoto(file, photoImportName);
                else setPhotoImportLog("[!] Drop an image file (JPG, PNG, WebP)");
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 0,
                borderRadius: 14,
                overflow: "hidden",
                border: photoDragOver
                  ? `2px solid ${accent}`
                  : importingFromPhoto
                  ? `2px solid ${purple}60`
                  : "2px solid #ffffff14",
                background: "#0d0d1a",
                transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                boxShadow: photoDragOver ? `0 0 24px ${accent}30` : importingFromPhoto ? `0 0 16px ${purple}20` : "none",
              }}>

              {/* Left — drop target visual */}
              <label style={{
                display: "flex", flexDirection: "column" as const, alignItems: "center", justifyContent: "center",
                gap: 6, cursor: importingFromPhoto ? "not-allowed" : "pointer",
                background: photoDragOver
                  ? `linear-gradient(135deg, ${accent}20, ${accent}08)`
                  : importingFromPhoto
                  ? `linear-gradient(135deg, ${purple}15, ${purple}05)`
                  : "linear-gradient(135deg, #ffffff06, #ffffff02)",
                padding: "18px 10px",
                borderRight: "1px solid #ffffff10",
                transition: "background 0.2s ease",
                minHeight: 90,
              }}>
                <div style={{
                  width: 48, height: 48, borderRadius: "50%",
                  border: `2px solid ${photoDragOver ? accent : importingFromPhoto ? purple : "#ffffff25"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22,
                  background: photoDragOver ? `${accent}18` : importingFromPhoto ? `${purple}18` : "#ffffff08",
                  transition: "all 0.25s ease",
                  animation: importingFromPhoto ? "pulse 1.5s ease-in-out infinite" : "none",
                }}>
                  {importingFromPhoto ? "..." : photoDragOver ? "Drop" : "+"}
                </div>
                <span style={{
                  fontSize: 9, fontWeight: 700, color: photoDragOver ? accent : "#ffffff50",
                  textTransform: "uppercase" as const, letterSpacing: 0.8,
                }}>
                  {photoDragOver ? "Drop now" : importingFromPhoto ? "Reading…" : "Drop / Browse"}
                </span>
                <input type="file" accept="image/*" style={{ display: "none" }} disabled={importingFromPhoto}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) importCharacterFromPhoto(file, photoImportName);
                    e.target.value = "";
                  }} />
              </label>

              {/* Right — controls */}
              <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column" as const, justifyContent: "center", gap: 10 }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: "0 0 2px" }}>Import any photo</p>
                  <p style={{ fontSize: 10, color: muted, margin: 0 }}>AI reads the image, extracts visual traits, and builds a full character identity automatically.</p>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={photoImportName}
                    onChange={e => setPhotoImportName(e.target.value)}
                    placeholder="Character name (optional)"
                    style={{ ...inputStyle, flex: 1, padding: "7px 11px", fontSize: 11 }}
                    disabled={importingFromPhoto}
                  />
                  <label style={{
                    padding: "8px 14px", borderRadius: 8, border: "none",
                    background: importingFromPhoto ? "#1a1a2e" : `linear-gradient(135deg, ${accent}, #d97706)`,
                    color: importingFromPhoto ? "#444" : "#000",
                    fontSize: 10, fontWeight: 800, cursor: importingFromPhoto ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap" as const, flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
                  }}>
                    {importingFromPhoto ? "Importing..." : "Choose Photo"}
                    <input type="file" accept="image/*" style={{ display: "none" }} disabled={importingFromPhoto}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) importCharacterFromPhoto(file, photoImportName);
                        e.target.value = "";
                      }} />
                  </label>
                </div>

                {/* Step indicators */}
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  {[
                    { step: "1", label: "Upload", done: importingFromPhoto || !!photoImportLog },
                    { step: "2", label: "AI Reads", done: photoImportLog.includes("Reading") || photoImportLog.startsWith("") },
                    { step: "3", label: "Build", done: photoImportLog.length > 0 && !photoImportLog.startsWith("[!") },
                  ].map(s => (
                    <div key={s.step} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", fontSize: 8, fontWeight: 800,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        background: s.done ? "#22c55e" : "#ffffff12",
                        color: s.done ? "#fff" : "#ffffff40",
                      }}>{s.done ? <Icon.Check style={{ width:8, height:8 }} /> : s.step}</div>
                      <span style={{ fontSize: 9, color: s.done ? "#22c55e" : "#ffffff30", fontWeight: 600 }}>{s.label}</span>
                      {s.step !== "3" && <div style={{ width: 12, height: 1, background: "#ffffff15" }} />}
                    </div>
                  ))}
                  {photoImportLog && (
                    <span style={{
                      marginLeft: "auto", fontSize: 9, fontWeight: 700,
                      color: photoImportLog.startsWith("[!]") ? gold : photoImportLog.length > 20 ? "#22c55e" : accent,
                    }}>{photoImportLog}</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Inline preview card — shown when buildCharacterInline produces a result */}
          {inlinePreview && (
            <div style={{ ...cardStyle, borderColor: inlinePreview.tags?.includes("photo-import") ? `${accent}60` : `${accent}40`, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                {/* Show imported photo thumbnail if available */}
                {inlinePreview.imageUrl ? (
                  <img src={inlinePreview.imageUrl} alt={inlinePreview.displayName}
                    style={{ width: 52, height: 52, borderRadius: 10, objectFit: "cover", border: `2px solid ${accent}40`, flexShrink: 0 }} />
                ) : (
                  <Icon.User style={{ width: 20, height: 20 }} />
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", margin: 0 }}>{inlinePreview.displayName}</p>
                    {inlinePreview.tags?.includes("photo-import") && (
                      <span style={{ fontSize: 9, fontWeight: 700, color: accent, background: `${accent}18`, padding: "2px 6px", borderRadius: 4 }}>FROM PHOTO</span>
                    )}
                  </div>
                  <p style={{ fontSize: 10, color: muted, margin: 0 }}>{inlinePreview.roleType} · {inlinePreview.gender} · {inlinePreview.ageRange} {inlinePreview.species ? `· ${inlinePreview.species}` : ""}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={acceptInlineCharacter}
                    style={{ padding: "8px 20px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 800, cursor: "pointer" }}>Add to Cast</button>
                  {!inlinePreview.tags?.includes("photo-import") && (
                    <button onClick={() => buildCharacterInline(inlinePreview.displayName)}
                      style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                      Rebuild
                    </button>
                  )}
                  <button onClick={() => { setInlinePreview(null); setPhotoImportLog(""); }}
                    style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: red, fontSize: 11, cursor: "pointer" }}><Icon.X style={{ width: 12, height: 12 }} /></button>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, marginBottom: 10 }}>
                {[["Species", inlinePreview.species], ["Build", inlinePreview.bodyBuild], ["Colours", inlinePreview.colorDescription],
                  ["Face", inlinePreview.faceFeatures], ["Clothing", inlinePreview.clothingDetails], ["Distinctive", inlinePreview.distinctiveFeatures]]
                  .filter(([, v]) => v && v !== "not specified").map(([label, value]) => (
                  <div key={label as string} style={{ padding: "6px 8px", borderRadius: 6, background: "#ffffff05" }}>
                    <p style={{ fontSize: 8, color: muted, fontWeight: 600, textTransform: "uppercase" as const, marginBottom: 2 }}>{label}</p>
                    <p style={{ fontSize: 10, color: "#fff" }}>{(value as string).slice(0, 60)}</p>
                  </div>
                ))}
              </div>
              <div style={{ padding: "8px 10px", borderRadius: 8, background: "#0a1a0a", border: `1px solid #4ade8030`, display: "flex", gap: 10, alignItems: "center" }}>
                <Icon.Mic style={{ width: 14, height: 14 }} />
                <p style={{ fontSize: 11, color: "#4ade80" }}>{inlinePreview.voiceType} · {inlinePreview.intonation} · {inlinePreview.speechStyle}</p>
              </div>
            </div>
          )}

          {characters.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <Icon.Users style={{ width: 28, height: 28, color: muted, marginBottom: 12 }} />
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 6 }}>No characters yet</p>
              <p style={{ fontSize: 12, color: muted, marginBottom: 20 }}>
                {(expandedSummary || idea) ? "Your story is ready — click below to let AI build all characters automatically." : "Write your story first, then AI will detect and build all characters for you."}
              </p>
              <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
                {(expandedSummary || idea) && (
                  <button onClick={buildAllStoryCharacters} disabled={buildingAllChars}
                    style={{ ...btnPrimary, background: `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff" }}>
                    {buildAllProgress || "Build Story Characters with AI"}
                  </button>
                )}
                <button onClick={() => setShowCharacterPicker(true)} style={{ ...btnPrimary, background: "transparent", border: `1px solid ${purple}40`, color: purple }}>
                  Import from Registry
                </button>
                {!(expandedSummary || idea) && (
                  <button onClick={() => setActiveTab("story")}
                    style={{ ...btnPrimary, background: "transparent", border: `1px solid ${accent}40`, color: accent }}>
                    ← Go to Story First
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {characters.map(char => {
                const usedInScenes = scenes.filter(s => s.characterIds?.includes(char.characterId));
                const isEditing = editingCharId === char.characterId;
                const isGenerating = generatingPortrait === char.characterId;
                const hasVisual = !!(char.species || char.colorDescription || char.clothingDetails || char.distinctiveFeatures);
                const visualDesc = buildVisualDescription(char);

                return (
                  <div key={char.characterId} style={{ ...cardStyle, borderColor: char.imageLocked ? `${accent}40` : hasVisual ? `${purple}30` : `${border}` }}>
                    {/* ── Top row: portrait + identity + status ── */}
                    <div style={{ display: "flex", gap: 14, marginBottom: 10 }}>
                      {/* Portrait — large enough to see clearly */}
                      <div style={{ position: "relative", width: 80, height: 80, borderRadius: 14, background: `linear-gradient(135deg, ${purple}30, ${blue}10)`, flexShrink: 0, overflow: "hidden", border: char.imageLocked ? `2px solid ${accent}` : `1px solid ${border}` }}>
                        {char.imageUrl
                          ? <img src={normalizeImageUrl(char.imageUrl)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                          : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.User style={{ width: 32, height: 32, color: muted }} /></div>
                        }
                        {char.imageLocked && (
                          <div style={{ position: "absolute", bottom: 2, right: 2, background: accent, borderRadius: 4, padding: "1px 4px", fontSize: 7, color: "#000", fontWeight: 800 }}>LOCKED</div>
                        )}
                      </div>

                      {/* Identity */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2, justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <p style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{char.displayName}</p>
                          {char.imageLocked
                            ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${accent}20`, color: accent, fontWeight: 700 }}>Look Locked</span>
                            : hasVisual
                            ? <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${purple}15`, color: purple, fontWeight: 600 }}>AI-described</span>
                            : char.imageUrl
                            ? <span onClick={() => analyzeCharacterImage(char.characterId, char.imageUrl!)} style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${gold}10`, color: gold, fontWeight: 600, cursor: "pointer" }} title="Click to have AI read this image">Click to AI-read image</span>
                            : <span style={{ fontSize: 8, padding: "2px 7px", borderRadius: 8, background: `${gold}10`, color: gold, fontWeight: 600 }}>Upload image first</span>
                          }
                          </div>
                          <button
                            onClick={() => { if (confirm(`Remove ${char.displayName} from cast?`)) setCharacters(prev => prev.filter(x => x.characterId !== char.characterId)); }}
                            title="Remove character"
                            style={{ background: `${red}15`, border: `1px solid ${red}30`, borderRadius: 6, color: red, fontSize: 10, fontWeight: 700, cursor: "pointer", padding: "3px 9px", flexShrink: 0 }}>
                            × Remove
                          </button>
                        </div>
                        <p style={{ fontSize: 9, fontFamily: "monospace", color: purple, marginBottom: 4 }}>{char.characterId}</p>
                        {/* Visual preview — what gets injected into every scene */}
                        {visualDesc ? (
                          <p style={{ fontSize: 9, color: "#aaa", lineHeight: 1.5, marginBottom: 4, background: `${purple}06`, padding: "4px 6px", borderRadius: 6, border: `1px solid ${purple}15` }}>
                            <span style={{ color: purple, fontWeight: 600 }}>Visual: </span>{visualDesc.slice(0, 120)}{visualDesc.length > 120 ? "..." : ""}
                          </p>
                        ) : (
                          <p style={{ fontSize: 9, color: gold, background: `${gold}08`, padding: "4px 6px", borderRadius: 6, marginBottom: 4 }}>
                            Click "Define Appearance" to describe this character so scenes look consistent.
                          </p>
                        )}
                        {(char.visualDescription !== undefined) && (
                          <textarea
                            value={char.visualDescription ?? ""}
                            onChange={e => {
                              const val = e.target.value;
                              setCharacters(prev => prev.map(c =>
                                c.characterId === char.characterId ? { ...c, visualDescription: val } : c
                              ));
                            }}
                            onBlur={e => {
                              // Persist to character store on blur
                              const val = e.target.value;
                              if (!char.dbId) return;
                              fetch(`/api/character-voices/${char.dbId}`, {
                                method: "PATCH",
                                headers: { "content-type": "application/json" },
                                body: JSON.stringify({ visualDescription: val }),
                              }).catch(() => {});
                            }}
                            placeholder="Visual description — edit to fix AI mistakes..."
                            rows={3}
                            style={{
                              width: "100%", fontSize: 10, color: "#c4b5fd", background: "#0d0621",
                              border: "1px solid #4c1d9540", borderRadius: 6, padding: "6px 8px",
                              resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
                              marginBottom: 8,
                            }}
                          />
                        )}
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          <span style={badgeStyle(purple)}>{char.roleType}</span>
                          {char.gender && <span style={badgeStyle(blue)}>{char.gender}</span>}
                          {usedInScenes.length > 0 && <span style={badgeStyle(accent)}>{usedInScenes.length} scenes</span>}
                          {char.voiceId && <span style={badgeStyle(accent)}>Voice</span>}
                        </div>
                      </div>
                    </div>

                    {/* ── Action buttons ── */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: isEditing ? 12 : 0 }}>
                      <button
                        onClick={() => setEditingCharId(isEditing ? null : char.characterId)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isEditing ? purple : border}`, background: isEditing ? `${purple}15` : "transparent", color: isEditing ? purple : muted, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                        {isEditing ? "Close Builder" : "Define Appearance"}
                      </button>
                      {/* Per-character style picker */}
                      <select
                        value={charStyles[char.characterId] || effectiveProjectStyle || "3d-cinematic"}
                        onChange={e => setCharStyles(prev => ({ ...prev, [char.characterId]: e.target.value }))}
                        title="Style for portrait generation"
                        style={{ padding: "5px 8px", fontSize: 10, borderRadius: 6, border: `1px solid ${border}`, background: "#1a0a3a", color: "#c4b5fd", cursor: "pointer" }}
                      >
                        <option value="3d-cinematic">3D Cinematic</option>
                        <option value="realistic">Realistic</option>
                        <option value="nollywood">Nollywood</option>
                        <option value="2d-cartoon">2D Cartoon</option>
                        <option value="anime">Anime</option>
                        <option value="storybook">Storybook</option>
                        <option value="comic">Comic</option>
                      </select>
                      {/* ── Portrait model selector ── */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: "#64748b", fontWeight: 600, whiteSpace: "nowrap" }}>Model</span>
                        <select
                          value={charPortraitModel[char.characterId] || (char.tags?.includes("photo-import") ? "fal_flux_pulid" : "segmind_flux")}
                          onChange={e => setCharPortraitModel(prev => ({ ...prev, [char.characterId]: e.target.value }))}
                          style={{
                            padding: "4px 8px", borderRadius: 6, fontSize: 10, fontWeight: 600, cursor: "pointer",
                            border: "1px solid #ffffff20", background: "#0f172a", color: "#e2e8f0",
                            outline: "none", flex: 1
                          }}>
                          <option value="ideogram_free">Ideogram Free ($0.00) — free</option>
                          <option value="segmind_flux">Flux Free ($0.0004) — drafts</option>
                          <option value="fal_flux_schnell">Flux Schnell ($0.003) — fast+good</option>
                          <option value="segmind_pruna">Pruna ($0.005) — fast</option>
                          <option value="fal_ideogram_v3_turbo">Ideogram v3 ($0.02) — text/ads</option>
                          <option value="fal_flux_dev">Flux Dev ($0.025) — quality</option>
                          <option value="fal_flux_pro">Flux Pro ($0.05) — best</option>
                          <option value="fal_flux_pulid">Face Lock / PuLID — real photo only</option>
                        </select>
                      </div>
                      <button
                        onClick={() => generateCharacterPortrait(char, charStyles[char.characterId])}
                        disabled={isGenerating}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: isGenerating ? "#2a2a40" : `linear-gradient(135deg, ${blue}, #0084ff)`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.7 : 1 }}>
                        {isGenerating ? "Generating 3 shots…" : char.imageUrl ? "Regen (3 angles)" : "Generate (3 angles)"}
                      </button>
                      {/* 3-angle full-body gallery — own row below all buttons */}
                      {charRefImages[char.characterId]?.length > 0 && (
                        <div style={{ flexBasis: "100%", marginTop: 10, padding: "10px 12px", background: "#0d0621", borderRadius: 8, border: "1px solid #4c1d9530" }}>
                          <p style={{ fontSize: 9, color: "#64748b", fontFamily: "monospace", marginBottom: 6, fontWeight: 600 }}>
                            Full body shots — click to set as main
                          </p>
                          <div style={{ display: "flex", gap: 6 }}>
                            {charRefImages[char.characterId].map((shot, i) => {
                              const isMain = shot.url === char.imageUrl;
                              const ANGLE_NAME: Record<string, string> = { front: "Front", "three-quarter": "3/4", side: "Side" };
                              return (
                                <div key={i} style={{ position: "relative", cursor: "pointer" }}
                                  onClick={() => setCharacters(prev => prev.map(c =>
                                    c.characterId === char.characterId
                                      ? { ...c, imageUrl: shot.url }
                                      : c
                                  ))}
                                  title={`Set as main — ${ANGLE_NAME[shot.angle] || shot.angle}`}>
                                  <img
                                    src={shot.url}
                                    alt={shot.angle}
                                    style={{
                                      width: 56, height: 80, objectFit: "cover", display: "block",
                                      borderRadius: 6,
                                      border: `2px solid ${isMain ? "#a855f7" : "#ffffff20"}`,
                                    }}
                                  />
                                  <span style={{
                                    position: "absolute", bottom: 0, left: 0, right: 0,
                                    background: "rgba(0,0,0,0.7)", color: "#fff",
                                    fontSize: 7, textAlign: "center", padding: "1px 0",
                                    borderBottomLeftRadius: 4, borderBottomRightRadius: 4,
                                  }}>
                                    {isMain ? "✓ MAIN" : (ANGLE_NAME[shot.angle] || shot.angle)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                      {/* AI Read Look — analyses the portrait and auto-fills all visual fields */}
                      {char.imageUrl && (() => {
                        const isAnalyzing = analyzingCharacter === char.characterId;
                        return (
                          <button
                            onClick={() => { if (!isAnalyzing) analyzeCharacterImage(char.characterId, char.imageUrl!); }}
                            disabled={isAnalyzing}
                            title="AI reads the portrait image and auto-fills species, clothing, colors, and all appearance fields"
                            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${purple}40`, background: isAnalyzing ? `${purple}20` : `${purple}08`, color: purple, fontSize: 10, fontWeight: 700, cursor: isAnalyzing ? "wait" : "pointer", opacity: isAnalyzing ? 0.8 : 1 }}>
                            {isAnalyzing ? "Reading image..." : "AI Read Look"}
                          </button>
                        );
                      })()}
                      {/* Photo → AI — convert real photo or existing portrait to AI-styled image */}
                      {(() => {
                        const isRunning = img2aiRunning.has(char.characterId);
                        return (
                          <button
                            onClick={async () => {
                              setImg2aiRunning(prev => new Set(prev).add(char.characterId));
                              // Re-generate with current style, using existing image as a style reference hint in the description
                              const style = charStyles[char.characterId] || effectiveProjectStyle || "realistic";
                              await generateCharacterPortrait(char, style);
                              setImg2aiRunning(prev => { const s = new Set(prev); s.delete(char.characterId); return s; });
                            }}
                            disabled={isRunning}
                            title="Convert this image (real photo or existing portrait) to AI-styled image"
                            style={{
                              padding: "7px 14px", borderRadius: 8,
                              border: `1px solid ${isRunning ? "#6b7280" : "#10b98140"}`,
                              background: isRunning ? "#1a1a2e" : "#10b98108",
                              color: isRunning ? "#6b7280" : "#10b981",
                              fontSize: 10, fontWeight: 700,
                              cursor: isRunning ? "wait" : "pointer",
                            }}
                          >
                            {isRunning ? "Converting..." : "Photo → AI"}
                          </button>
                        );
                      })()}
                      {/* Save Character — manually save to character registry */}
                      {(() => {
                        const isSaving = savingCharacter === char.characterId;
                        const isSaved = savedCharacter === char.characterId;
                        return (
                          <button
                            onClick={() => { if (!isSaving) saveCharacterToRegistry(char); }}
                            disabled={isSaving}
                            title="Save this character to the Character Registry so it can be used in future projects"
                            style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${isSaved ? accent : "#e05c2040"}`, background: isSaved ? `${accent}18` : "#e05c2008", color: isSaved ? accent : "#e05c20", fontSize: 10, fontWeight: 700, cursor: isSaving ? "wait" : "pointer", opacity: isSaving ? 0.7 : 1 }}>
                            {isSaving ? "Saving..." : isSaved ? "Saved!" : "Save Character"}
                          </button>
                        );
                      })()}
                      {/* Import Image — borrow an existing image from asset library / character registry */}
                      <button
                        onClick={() => openImagePicker(char.characterId)}
                        title="Use an existing image from your asset library or another character — no need to generate a new one"
                        style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #0ea5e940", background: "#0ea5e908", color: "#0ea5e9", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Import Image
                      </button>
                      {/* Preview Image — fullscreen lightbox */}
                      {char.imageUrl && (
                        <button
                          onClick={() => setPreviewMedia({ url: char.imageUrl!, type: "image", title: char.displayName })}
                          title="View portrait fullscreen"
                          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #a78bfa40", background: "#a78bfa08", color: "#a78bfa", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          Preview
                        </button>
                      )}
                      {/* Undo Image — restore previous portrait (always shown, grayed when no previous) */}
                      <button
                        onClick={() => {
                          if (!prevCharImages[char.characterId]) return;
                          const prev = prevCharImages[char.characterId];
                          setCharacters(cs => cs.map(c => c.characterId === char.characterId ? { ...c, imageUrl: prev, hasImage: true } : c));
                          setPrevCharImages(p => { const n = { ...p }; delete n[char.characterId]; return n; });
                          setLastAction(`${char.displayName} reverted to previous portrait`);
                        }}
                        title={prevCharImages[char.characterId] ? "Undo — go back to previous portrait" : "No previous image to restore"}
                        disabled={!prevCharImages[char.characterId]}
                        style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${prevCharImages[char.characterId] ? "#f59e0b40" : "#33333340"}`, background: prevCharImages[char.characterId] ? "#f59e0b08" : "transparent", color: prevCharImages[char.characterId] ? "#f59e0b" : "#555", fontSize: 10, fontWeight: 700, cursor: prevCharImages[char.characterId] ? "pointer" : "not-allowed", opacity: prevCharImages[char.characterId] ? 1 : 0.4 }}>
                        Undo Image
                      </button>
                      {/* Remove Image — clear portrait + all 3 angle shots */}
                      {(char.imageUrl || charRefImages[char.characterId]?.length > 0) && (
                        <button
                          onClick={() => {
                            if (char.imageUrl) setPrevCharImages(p => ({ ...p, [char.characterId]: char.imageUrl! }));
                            setCharacters(cs => cs.map(c => c.characterId === char.characterId ? { ...c, imageUrl: undefined, hasImage: false, imageLocked: false } : c));
                            setCharRefImages(prev => { const n = { ...prev }; delete n[char.characterId]; return n; });
                            setLastAction(`${char.displayName} portrait + all angles removed`);
                          }}
                          title="Remove portrait and all 3 angle shots"
                          style={{ padding: "7px 14px", borderRadius: 8, border: "1px solid #ef444440", background: "#ef444408", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          Remove Image
                        </button>
                      )}
                      {char.imageUrl && !char.imageLocked && (
                        <button
                          onClick={() => {
                            setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageLocked: true } : c));
                            setLastAction(`${char.displayName}'s look is LOCKED — all scenes will use this exact appearance`);
                          }}
                          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${accent}40`, background: `${accent}10`, color: accent, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          Lock this Look
                        </button>
                      )}
                      {char.imageLocked && (
                        <button
                          onClick={() => {
                            setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, imageLocked: false } : c));
                            setLastAction(`${char.displayName}'s look unlocked — regenerate to try new looks`);
                          }}
                          style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                          Unlock
                        </button>
                      )}
                    </div>

                    {/* ── Visual Identity Builder — shown when editing ── */}
                    {isEditing && (
                      <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${purple}20` }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: purple, marginBottom: 10 }}>Visual Identity — fill in what makes this character unique</p>
                        {/* AI describe-fields helper. User types plain-English description, AI parses into
                            the 9 structured fields below. Mirrors Scene Edit AI Polish pattern.
                            Field names align with this file's CharacterIdentity interface exactly. */}
                        {(() => {
                          const cid = char.characterId;
                          const draft = charAiDraft[cid] || "";
                          const busy = charAiBusy.has(cid);
                          return (
                            <div style={{ background: "#0d1018", border: `1px dashed ${purple}50`, borderRadius: 10, padding: 10, marginBottom: 12 }}>
                              <p style={{ fontSize: 9, color: purple, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5, marginBottom: 6 }}>
                                ✨ AI describe → fields
                              </p>
                              <textarea
                                value={draft}
                                onChange={e => setCharAiDraft(prev => ({ ...prev, [cid]: e.target.value }))}
                                placeholder={`Describe ${char.displayName || "this character"} in plain English. Example: "11-year-old human boy, slim, light brown skin, curly black hair, navy school uniform with red tie, confident posture, small scar on left cheek."`}
                                rows={3}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "#161624", color: "#fff", fontSize: 11, lineHeight: 1.5, fontFamily: "inherit", resize: "vertical" as const }}
                              />
                              <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                                <button
                                  onClick={async () => {
                                    if (busy || !draft.trim()) return;
                                    setCharAiBusy(prev => new Set(prev).add(cid));
                                    try {
                                      // Send current values as "existing" so AI only overrides what user mentioned.
                                      const existing = {
                                        species: char.species || "",
                                        bodyBuild: char.bodyBuild || "",
                                        colorDescription: char.colorDescription || "",
                                        faceFeatures: char.faceFeatures || "",
                                        clothingDetails: char.clothingDetails || "",
                                        accessories: char.accessories || "",
                                        ageRange: char.ageRange || "",
                                        ageAppearance: char.ageAppearance || "",
                                        distinctiveFeatures: char.distinctiveFeatures || "",
                                      };
                                      const res = await fetch("/api/hybrid/character-parse", {
                                        method: "POST", headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ text: draft, existing, provider: "auto" }),
                                      });
                                      const data = await res.json() as { ok?: boolean; fields?: typeof existing; error?: string; provider?: string };
                                      if (!data.ok || !data.fields) {
                                        setUiError(`Character AI failed: ${data.error || "unknown"}`);
                                        return;
                                      }
                                      // Apply parsed fields to the character record.
                                      const f = data.fields;
                                      setCharacters(prev => prev.map(c => c.characterId === cid ? {
                                        ...c,
                                        species: f.species || c.species,
                                        bodyBuild: f.bodyBuild || c.bodyBuild,
                                        colorDescription: f.colorDescription || c.colorDescription,
                                        faceFeatures: f.faceFeatures || c.faceFeatures,
                                        clothingDetails: f.clothingDetails || c.clothingDetails,
                                        accessories: f.accessories || c.accessories,
                                        ageRange: f.ageRange || c.ageRange,
                                        ageAppearance: f.ageAppearance || c.ageAppearance,
                                        distinctiveFeatures: f.distinctiveFeatures || c.distinctiveFeatures,
                                      } : c));
                                      setLastAction(`Applied AI fields to ${char.displayName} via ${data.provider || "ai"} — review fields below`);
                                    } catch (err) {
                                      setUiError(`Character AI error: ${err instanceof Error ? err.message : "unknown"}`);
                                    } finally {
                                      setCharAiBusy(prev => { const n = new Set(prev); n.delete(cid); return n; });
                                    }
                                  }}
                                  disabled={busy || !draft.trim()}
                                  style={{ padding: "6px 14px", borderRadius: 8, border: "none",
                                    background: (busy || !draft.trim()) ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c3aed)`,
                                    color: "#fff", fontSize: 10, fontWeight: 700, cursor: (busy || !draft.trim()) ? "not-allowed" : "pointer" }}>
                                  {busy ? "AI parsing…" : "✨ Apply via AI"}
                                </button>
                                {draft.trim() && (
                                  <button onClick={() => setCharAiDraft(prev => ({ ...prev, [cid]: "" }))}
                                    style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                                    Clear
                                  </button>
                                )}
                                <span style={{ fontSize: 9, color: muted, marginLeft: "auto" }}>
                                  Fields below populate after Apply
                                </span>
                              </div>
                            </div>
                          );
                        })()}
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 10 }}>
                          {/* Species / Type */}
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Character Type / Species</label>
                            <input
                              value={char.species || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, species: e.target.value } : c))}
                              placeholder='e.g. "rabbit", "human", "lion", "young boy"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Body build */}
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Body Build / Size</label>
                            <input
                              value={char.bodyBuild || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, bodyBuild: e.target.value } : c))}
                              placeholder='e.g. "large and stocky with big round belly", "small and petite"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Color */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Fur / Skin / Color Description</label>
                            <input
                              value={char.colorDescription || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, colorDescription: e.target.value } : c))}
                              placeholder='e.g. "warm grey fur with white belly and chest", "dark brown skin, warm undertones"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Face */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Face & Eyes</label>
                            <input
                              value={char.faceFeatures || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, faceFeatures: e.target.value } : c))}
                              placeholder='e.g. "round wire-rim spectacles, kind dark eyes, big round nose, long floppy ears"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Clothing */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Clothing (be specific)</label>
                            <input
                              value={char.clothingDetails || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, clothingDetails: e.target.value } : c))}
                              placeholder='e.g. "brown leather vest with brass buttons, brown belt, no shirt underneath"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Accessories */}
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Accessories</label>
                            <input
                              value={char.accessories || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, accessories: e.target.value } : c))}
                              placeholder='e.g. "wooden walking cane, small satchel bag"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Age — numeric, feeds ageRange for image gen age anchor */}
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Age (years) <span style={{ color: "#f97316", fontWeight: 800 }}>★</span></label>
                            <input
                              type="number"
                              min={1} max={120}
                              value={char.ageRange ? parseInt(char.ageRange) || "" : ""}
                              onChange={e => {
                                const val = e.target.value;
                                setCharacters(prev => prev.map(c => c.characterId === char.characterId
                                  ? { ...c, ageRange: val ? `${val} years old` : "" }
                                  : c));
                              }}
                              placeholder='e.g. 8'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                            <p style={{ fontSize: 9, color: "#f97316", margin: "3px 0 0", fontWeight: 600 }}>★ Required — image generator uses this to lock the correct age</p>
                          </div>
                          {/* Posture / Energy — separate from age */}
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Posture / Energy</label>
                            <input
                              value={char.ageAppearance || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, ageAppearance: e.target.value } : c))}
                              placeholder='e.g. "standing upright, energetic and confident" or "slightly hunched, calm"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                          {/* Distinctive features */}
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Distinctive Features (anything unique that must appear every time)</label>
                            <input
                              value={char.distinctiveFeatures || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, distinctiveFeatures: e.target.value } : c))}
                              placeholder='e.g. "very big protruding round belly, fluffy white cottontail, walks upright on two legs"'
                              style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }} />
                          </div>
                        </div>
                        {/* Live preview of what gets injected into prompts */}
                        {buildVisualDescription(char) && (
                          <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: `${purple}08`, border: `1px solid ${purple}20` }}>
                            <p style={{ fontSize: 9, color: purple, fontWeight: 600, marginBottom: 2 }}>→ This is what gets injected into every scene prompt:</p>
                            <p style={{ fontSize: 9, color: "#ccc", lineHeight: 1.6, fontStyle: "italic" }}>
                              CHARACTER {char.displayName.toUpperCase()} (EXACT FIXED APPEARANCE): {buildVisualDescription(char)}
                            </p>
                          </div>
                        )}
                        <button
                          onClick={() => { generateCharacterPortrait(char); setEditingCharId(null); }}
                          disabled={isGenerating}
                          style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${blue}, #0084ff)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                          Generate Portrait from This Description →
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Next step CTA — shown when characters are ready ── */}
          {characters.length > 0 && (
            <div style={{ ...cardStyle, borderColor: `${accent}20`, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                    {characters.filter(c => c.voiceType).length}/{characters.length} characters fully built
                  </p>
                  <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                    {characters.filter(c => !c.voiceType).length > 0
                      ? `${characters.filter(c => !c.voiceType).length} still need AI build — click "Build Story Characters with AI" above`
                      : "All characters ready — proceed to Scene Board"}
                  </p>
                </div>
                <button onClick={() => setActiveTab("scenes")}
                  style={{ padding: "11px 22px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${blue}, #0084ff)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                  → Step 3: Scene Board
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* STORY & DRAFT TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "story" && (
        <div>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Your Story</h2>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Story Idea</label>
              <textarea value={idea} onChange={e => setIdea(e.target.value)} rows={5}
                placeholder="Write your story idea. AI will detect genre, emotion, tone, and break it into scenes."
                style={{ ...inputStyle, resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 16 }}>
              {/* ── Duration — preset + custom min/sec ── */}
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Duration</label>
                <select
                  value={targetDuration.startsWith("custom:") ? "custom" : targetDuration}
                  onChange={e => {
                    if (e.target.value === "custom") {
                      setTargetDuration(`custom:${customDurationMin}m${customDurationSec}s`);
                    } else {
                      setTargetDuration(e.target.value);
                    }
                  }}
                  style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  <option value="30-60s"  style={{ background: surface }}>30–60 sec</option>
                  <option value="1-2 min" style={{ background: surface }}>1–2 min (60–120s)</option>
                  <option value="2-3 min" style={{ background: surface }}>2–3 min (120–180s)</option>
                  <option value="3-5 min" style={{ background: surface }}>3–5 min (180–300s)</option>
                  <option value="5-10 min"style={{ background: surface }}>5–10 min (300–600s)</option>
                  <option value="10+ min" style={{ background: surface }}>10+ min (600s+)</option>
                  <option value="custom"  style={{ background: surface }}>Custom…</option>
                </select>
                {/* Custom min/sec inputs */}
                {targetDuration.startsWith("custom:") && (
                  <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
                    <div style={{ flex: 1 }}>
                      <input type="number" min={0} max={180} value={customDurationMin}
                        onChange={e => {
                          const m = Math.max(0, Math.min(180, Number(e.target.value)));
                          setCustomDurationMin(m);
                          setTargetDuration(`custom:${m}m${customDurationSec}s`);
                        }}
                        style={{ ...inputStyle, fontSize: 11, padding: "6px 8px", width: "100%" }} />
                      <span style={{ fontSize: 8, color: muted }}>min</span>
                    </div>
                    <span style={{ color: muted, fontSize: 12, paddingBottom: 14 }}>:</span>
                    <div style={{ flex: 1 }}>
                      <input type="number" min={0} max={59} value={customDurationSec}
                        onChange={e => {
                          const s = Math.max(0, Math.min(59, Number(e.target.value)));
                          setCustomDurationSec(s);
                          setTargetDuration(`custom:${customDurationMin}m${s}s`);
                        }}
                        style={{ ...inputStyle, fontSize: 11, padding: "6px 8px", width: "100%" }} />
                      <span style={{ fontSize: 8, color: muted }}>sec</span>
                    </div>
                    <span style={{ fontSize: 9, color: accent, fontWeight: 700, paddingBottom: 14, whiteSpace: "nowrap" as const }}>
                      = {customDurationMin * 60 + customDurationSec}s
                    </span>
                  </div>
                )}
              </div>

              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Audience</label>
                <select value={audienceType} onChange={e => setAudienceType(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["general", "children", "teens", "adults", "business", "family"].map(a => <option key={a} value={a} style={{ background: surface }}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Cost</label>
                <select value={costPreference} onChange={e => setCostPreference(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["efficient", "balanced", "premium"].map(c => <option key={c} value={c} style={{ background: surface }}>{c}</option>)}
                </select>
              </div>
              <div>
                <label style={{ ...labelStyle, fontSize: 9 }}>Language</label>
                <select value={effectiveLanguage} onChange={e => { setLanguage(e.target.value); patchProjectSettings({ language: e.target.value }).catch(() => {}); }} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["English", "French", "Spanish", "Portuguese", "Arabic", "Hindi", "Japanese", "Korean", "German", "Italian"].map(l => <option key={l} value={l} style={{ background: surface }}>{l}</option>)}
                </select>
              </div>
              {/* ── Story AI selector (GHS Tier) ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <label style={{ ...labelStyle, fontSize: 9, marginBottom: 0 }}>Story AI</label>
                  <button title="Free = Local LLM · Standard = Claude Haiku · Pro = Claude Sonnet · GPT models require OPENAI_API_KEY"
                    style={{ background: "none", border: "none", color: "#5a5a7a", fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1 }}>ⓘ</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 4, marginBottom: 4 }}>
                  {([
                    { badge: "QWEN",   color: "#22c55e", provider: "ollama:qwen2.5:7b",               desc: "Local · Free" },
                    { badge: "HAIKU",  color: "#7dd3fc", provider: "claude:claude-haiku-4-5-20251001", desc: "Fast · Low $" },
                    { badge: "SONNET", color: "#a855f7", provider: "claude:claude-sonnet-4-6",         desc: "Balanced" },
                  ] as const).map(t => {
                    const isActive = storyAiProvider === t.provider;
                    return (
                      <button key={t.badge} onClick={() => setStoryAiProvider(t.provider)}
                        style={{
                          padding: "7px 4px", borderRadius: 8, border: `1px solid ${isActive ? t.color : "#ffffff15"}`,
                          background: isActive ? `${t.color}18` : "#ffffff06", cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: t.color, letterSpacing: "0.5px" }}>{t.badge}</span>
                        <span style={{ fontSize: 8, color: isActive ? "#e0dcff" : "#6060a0", textAlign: "center" as const }}>{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
                {/* GPT row */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 4 }}>
                  {([
                    { badge: "4o MINI", color: "#f59e0b", provider: "openai:gpt-4o-mini", desc: "GPT Fast" },
                    { badge: "GPT-4o",  color: "#fb923c", provider: "openai:gpt-4o",      desc: "GPT Best" },
                    { badge: "o1-mini", color: "#f87171", provider: "openai:o1-mini",      desc: "Reasoning" },
                  ] as const).map(t => {
                    const isActive = storyAiProvider === t.provider;
                    return (
                      <button key={t.badge} onClick={() => setStoryAiProvider(t.provider)}
                        style={{
                          padding: "7px 4px", borderRadius: 8, border: `1px solid ${isActive ? t.color : "#ffffff15"}`,
                          background: isActive ? `${t.color}18` : "#ffffff06", cursor: "pointer",
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                        }}>
                        <span style={{ fontSize: 9, fontWeight: 800, color: t.color, letterSpacing: "0.5px" }}>{t.badge}</span>
                        <span style={{ fontSize: 8, color: isActive ? "#e0dcff" : "#6060a0", textAlign: "center" as const }}>{t.desc}</span>
                      </button>
                    );
                  })}
                </div>
                {lastUsedAiProvider && (
                  <p style={{ fontSize: 8, color: accent, marginTop: 3, fontWeight: 600 }}>
                    Last: {lastUsedAiProvider}
                  </p>
                )}
              </div>
            </div>

            {/* ── Story Culture / Name Style / Country — compact dropdowns ── */}
            <div style={{ marginTop: 12 }}>
              {(() => {
                const CULTURE_OPTIONS = [
                  { id: "africa",         label: "Africa",             emoji: "🌍" },
                  { id: "american",       label: "American",           emoji: "🇺🇸" },
                  { id: "hollywood",      label: "Hollywood / USA",    emoji: "🎬" },
                  { id: "bollywood",      label: "Bollywood / India",  emoji: "🇮🇳" },
                  { id: "asia",           label: "Asia",               emoji: "🌏" },
                  { id: "europe",         label: "Europe",             emoji: "🇪🇺" },
                  { id: "french_culture", label: "French",             emoji: "🇫🇷" },
                  { id: "spanish_culture",label: "Spanish",            emoji: "🇪🇸" },
                  { id: "north_america",  label: "N. America",         emoji: "🌎" },
                  { id: "latin_america",  label: "Latin America",      emoji: "🌎" },
                  { id: "middle_east",    label: "Middle East",        emoji: "🕌" },
                  { id: "oceania",        label: "Oceania",            emoji: "🌏" },
                  { id: "mythology",      label: "Mythology & Legend", emoji: "⚡" },
                  { id: "indigenous",     label: "Indigenous Cultures",emoji: "🌿" },
                  { id: "fantasy",        label: "Fantasy",            emoji: "✨" },
                ] as const;
                const NAME_STYLE_OPTIONS = [
                  { id: "western",  label: "Western (Anglo)" },
                  { id: "african",  label: "African" },
                  { id: "yoruba",   label: "Yoruba" },
                  { id: "igbo",     label: "Igbo" },
                  { id: "hausa",    label: "Hausa" },
                  { id: "nollywood",label: "Nollywood" },
                  { id: "british",  label: "British" },
                  { id: "jamaican", label: "Jamaican" },
                  { id: "american", label: "American" },
                  { id: "asian",    label: "Asian" },
                  { id: "spanish",  label: "Spanish / Latin" },
                  { id: "arabic",   label: "Arabic" },
                  { id: "fantasy",  label: "Fantasy / Invented" },
                ] as const;
                const COUNTRY_LIST = [
                  "Nigeria","Ghana","South Africa","Kenya","Egypt","Morocco","Ethiopia",
                  "United States","United Kingdom","Canada","Mexico","Brazil","Argentina","Jamaica","Cuba",
                  "France","Germany","Spain","Italy","Portugal","Netherlands","Sweden","Ireland",
                  "China","Japan","South Korea","India","Pakistan","Indonesia","Philippines","Thailand","Vietnam",
                  "Saudi Arabia","UAE","Turkey","Iran","Israel",
                  "Australia","New Zealand",
                ];
                const cultureSel = CULTURE_OPTIONS.find(c => c.id === storyRegion);
                const nameSel = NAME_STYLE_OPTIONS.find(n => n.id === storyNameStyle);
                const filteredCountries = storyCountryQuery
                  ? COUNTRY_LIST.filter(c => c.toLowerCase().includes(storyCountryQuery.toLowerCase()))
                  : COUNTRY_LIST;
                const ddBtn = (active: boolean): React.CSSProperties => ({
                  padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${active ? accent : "#ffffff15"}`,
                  background: active ? `${accent}22` : "#ffffff06",
                  color: active ? accent : "#cfcfe2", fontSize: 10, fontWeight: 600,
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6,
                  width: "100%", textAlign: "left" as const,
                });
                const popover: React.CSSProperties = {
                  position: "absolute" as const, zIndex: 50, top: "calc(100% + 4px)", left: 0, right: 0,
                  background: "#0d0d18", border: "1px solid #2a2a40", borderRadius: 8,
                  padding: 4, maxHeight: 240, overflowY: "auto" as const,
                  boxShadow: "0 6px 22px rgba(0,0,0,0.55)",
                };
                const itemBtn = (active: boolean): React.CSSProperties => ({
                  width: "100%", padding: "6px 8px", borderRadius: 6, border: "none",
                  background: active ? `${accent}22` : "transparent",
                  color: active ? accent : "#cfcfe2", fontSize: 10, fontWeight: active ? 700 : 500,
                  cursor: "pointer", textAlign: "left" as const, display: "flex", alignItems: "center", gap: 6,
                });
                return (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                    {/* Culture dropdown */}
                    <div style={{ position: "relative" as const }}>
                      <label style={{ ...labelStyle, fontSize: 9, marginBottom: 4, display: "block" }}>Culture</label>
                      <button onClick={() => { setStoryCultureOpen(o => !o); setStoryNameStyleOpen(false); setStoryCountryOpen(false); }}
                        style={ddBtn(!!storyRegion)}>
                        <span style={{ display: "flex", alignItems: "center", gap: 5, overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>
                          {cultureSel ? <><span>{cultureSel.emoji}</span><span>{cultureSel.label}</span></> : <span style={{ color: muted }}>Select…</span>}
                        </span>
                        <span style={{ fontSize: 8, color: muted }}>▼</span>
                      </button>
                      {storyCultureOpen && (
                        <div style={popover}>
                          {storyRegion && (
                            <button onClick={() => { setStoryRegion(""); setStoryCultureOpen(false); }} style={itemBtn(false)}>
                              <span style={{ color: muted }}>✕</span><span style={{ color: muted }}>Clear</span>
                            </button>
                          )}
                          {CULTURE_OPTIONS.map(c => (
                            <button key={c.id} onClick={() => { setStoryRegion(c.id); setStoryCultureOpen(false); }}
                              style={itemBtn(storyRegion === c.id)}>
                              <span>{c.emoji}</span><span>{c.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Name Style dropdown */}
                    <div style={{ position: "relative" as const }}>
                      <label style={{ ...labelStyle, fontSize: 9, marginBottom: 4, display: "block" }}>Name Style</label>
                      <button onClick={() => { setStoryNameStyleOpen(o => !o); setStoryCultureOpen(false); setStoryCountryOpen(false); }}
                        style={ddBtn(!!storyNameStyle)}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>
                          {nameSel ? nameSel.label : <span style={{ color: muted }}>Select…</span>}
                        </span>
                        <span style={{ fontSize: 8, color: muted }}>▼</span>
                      </button>
                      {storyNameStyleOpen && (
                        <div style={popover}>
                          {storyNameStyle && (
                            <button onClick={() => { setStoryNameStyle(""); setStoryNameStyleOpen(false); }} style={itemBtn(false)}>
                              <span style={{ color: muted }}>✕ Clear</span>
                            </button>
                          )}
                          {NAME_STYLE_OPTIONS.map(n => (
                            <button key={n.id} onClick={() => { setStoryNameStyle(n.id); setStoryNameStyleOpen(false); }}
                              style={itemBtn(storyNameStyle === n.id)}>
                              {n.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Country dropdown w/ free-text */}
                    <div style={{ position: "relative" as const }}>
                      <label style={{ ...labelStyle, fontSize: 9, marginBottom: 4, display: "block" }}>Country</label>
                      <button onClick={() => { setStoryCountryOpen(o => !o); setStoryCultureOpen(false); setStoryNameStyleOpen(false); }}
                        style={ddBtn(!!storyCountry)}>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>
                          {storyCountry || <span style={{ color: muted }}>Any country…</span>}
                        </span>
                        <span style={{ fontSize: 8, color: muted }}>▼</span>
                      </button>
                      {storyCountryOpen && (
                        <div style={popover}>
                          <input
                            value={storyCountryQuery}
                            onChange={e => setStoryCountryQuery(e.target.value)}
                            placeholder="Type any country…"
                            onKeyDown={e => {
                              if (e.key === "Enter" && storyCountryQuery.trim()) {
                                setStoryCountry(storyCountryQuery.trim());
                                setStoryCountryOpen(false);
                                setStoryCountryQuery("");
                              }
                            }}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: 6, border: "1px solid #2a2a40", background: "#161624", color: "#fff", fontSize: 10, marginBottom: 4 }}
                            autoFocus
                          />
                          {storyCountryQuery.trim() && !filteredCountries.some(c => c.toLowerCase() === storyCountryQuery.toLowerCase()) && (
                            <button onClick={() => { setStoryCountry(storyCountryQuery.trim()); setStoryCountryOpen(false); setStoryCountryQuery(""); }}
                              style={itemBtn(false)}>
                              <span style={{ color: accent }}>＋ Use “{storyCountryQuery.trim()}”</span>
                            </button>
                          )}
                          {storyCountry && (
                            <button onClick={() => { setStoryCountry(""); setStoryCountryOpen(false); }} style={itemBtn(false)}>
                              <span style={{ color: muted }}>✕ Clear</span>
                            </button>
                          )}
                          {filteredCountries.map(c => (
                            <button key={c} onClick={() => { setStoryCountry(c); setStoryCountryOpen(false); setStoryCountryQuery(""); }}
                              style={itemBtn(storyCountry === c)}>
                              {c}
                            </button>
                          ))}
                          {filteredCountries.length === 0 && !storyCountryQuery.trim() && (
                            <p style={{ fontSize: 9, color: muted, padding: 6 }}>No matches</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
              {(storyRegion || storyNameStyle || storyCountry) && (
                <p style={{ fontSize: 8, color: "#7dd3fc", marginTop: 6 }}>
                  AI will use {storyCountry || storyRegion?.replace(/_/g, " ") || ""}{storyNameStyle ? ` · ${storyNameStyle} names` : ""}{storyRegion && !storyNameStyle ? ` cultural context` : ""}
                </p>
              )}
              {/* ── Custom name import ── */}
              <div style={{ marginTop: 10, borderTop: `1px solid ${border}`, paddingTop: 10 }}>
                <p style={{ fontSize: 8, color: muted, marginBottom: 6 }}>Add custom names (comma-separated) — injected into next story expansion</p>
                <div style={{ display: "flex", gap: 6 }}>
                  <input
                    value={customNameInput}
                    onChange={e => setCustomNameInput(e.target.value)}
                    placeholder="e.g. Tunde, Amaka, Chidi, Zara..."
                    style={{ ...inputStyle, flex: 1, fontSize: 10, padding: "6px 8px" }}
                  />
                  <button
                    onClick={() => {
                      if (!customNameInput.trim()) return;
                      setStoryRegion(prev => prev); // keep region
                      // Store as a special "custom" region override in sessionStorage so expandStory picks it up
                      const names = customNameInput.split(",").map(n => n.trim()).filter(Boolean);
                      sessionStorage.setItem("ghs_custom_names", JSON.stringify(names));
                      setCustomNameInput("");
                      setLastAction(`✓ ${names.length} custom name${names.length !== 1 ? "s" : ""} saved — will be injected on next Expand`);
                    }}
                    style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                    Add Names
                  </button>
                </div>
                {typeof window !== "undefined" && sessionStorage.getItem("ghs_custom_names") && (
                  <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
                    <p style={{ fontSize: 8, color: "#22c55e" }}>
                      Custom pool: {JSON.parse(sessionStorage.getItem("ghs_custom_names") || "[]").join(", ").slice(0, 80)}
                    </p>
                    <button onClick={() => { sessionStorage.removeItem("ghs_custom_names"); setLastAction("Custom names cleared"); }}
                      style={{ background: "none", border: "none", color: "#5a5a7a", fontSize: 8, cursor: "pointer", padding: 0 }}>×</button>
                  </div>
                )}
              </div>
            </div>

            {/* ── Era & Culture Lock ── */}
            <div style={{ marginTop: 10, borderTop: `1px solid ${border}`, paddingTop: 10 }}>
              <p style={{ fontSize: 9, color: "#fb923c", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>
                Era &amp; Culture Lock
                <span style={{ fontSize: 8, fontWeight: 400, color: muted, marginLeft: 6, textTransform: "none" as const, letterSpacing: 0 }}>
                  — pins all images to the correct time period &amp; culture
                </span>
              </p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 9 }}>Story Era / Year</label>
                  <input
                    value={storyEra}
                    onChange={e => setStoryEra(e.target.value)}
                    placeholder="e.g. 2024, 1819, 899 AD, 300 BC, Today"
                    style={{ ...inputStyle, fontSize: 10, padding: "7px 10px" }}
                  />
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 9 }}>Story Culture / Setting</label>
                  <input
                    value={storyCulture}
                    onChange={e => setStoryCulture(e.target.value)}
                    placeholder="e.g. Contemporary Lagos, Victorian England, Yoruba Kingdom"
                    style={{ ...inputStyle, fontSize: 10, padding: "7px 10px" }}
                  />
                </div>
              </div>
              {(storyEra || storyCulture) && (
                <p style={{ fontSize: 8, color: "#fb923c", marginTop: 5, fontWeight: 600 }}>
                  Lock active — all scene images: {[storyEra, storyCulture].filter(Boolean).join(" · ")}
                </p>
              )}
            </div>

            {/* ── Story QC Intake Settings ── */}
            <div style={{ marginTop: 10, borderTop: `1px solid ${border}`, paddingTop: 10 }}>
              <p style={{ fontSize: 9, color: accent, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Story QC Settings</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, marginBottom: 6 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Story Type</label>
                  <select value={storyType} onChange={e => setStoryType(e.target.value)} style={{ ...inputStyle, fontSize: 10, padding: "6px 8px" }}>
                    {[
                      { v: "short_story", l: "Short Story" },
                      { v: "long_story", l: "Long Story" },
                      { v: "children_story", l: "Children Story" },
                      { v: "movie", l: "Movie" },
                      { v: "ad_commercial", l: "Ad / Commercial" },
                      { v: "skit", l: "Skit" },
                      { v: "moral_lesson", l: "Moral Lesson" },
                      { v: "folklore", l: "Folklore" },
                      { v: "documentary", l: "Documentary" },
                      { v: "faith_story", l: "Faith / Religious" },
                      { v: "educational", l: "Educational" },
                    ].map(o => <option key={o.v} value={o.v} style={{ background: surface }}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Scene Duration</label>
                  <select value={sceneDurationSec} onChange={e => setSceneDurationSec(Number(e.target.value))} style={{ ...inputStyle, fontSize: 10, padding: "6px 8px" }}>
                    {[{ v: 5, l: "5 sec / scene" }, { v: 8, l: "8 sec / scene" }, { v: 10, l: "10 sec / scene" }, { v: 15, l: "15 sec / scene" }, { v: 20, l: "20 sec / scene" }].map(o => (
                      <option key={o.v} value={o.v} style={{ background: surface }}>{o.l}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Emotional Intensity</label>
                  <select value={storyEmotionalIntensity} onChange={e => setStoryEmotionalIntensity(e.target.value)} style={{ ...inputStyle, fontSize: 10, padding: "6px 8px" }}>
                    {[
                      { v: "normal", l: "Normal" },
                      { v: "more_emotional", l: "More Emotional" },
                      { v: "very_emotional", l: "Very Emotional" },
                      { v: "cinematic", l: "Cinematic" },
                      { v: "funny", l: "Funny" },
                      { v: "dark", l: "Dark" },
                      { v: "inspirational", l: "Inspirational" },
                      { v: "suspense", l: "Suspense" },
                      { v: "action_heavy", l: "Action Heavy" },
                    ].map(o => <option key={o.v} value={o.v} style={{ background: surface }}>{o.l}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6 }}>
                <div>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Language Level</label>
                  <select value={storyLanguageLevel} onChange={e => setStoryLanguageLevel(e.target.value)} style={{ ...inputStyle, fontSize: 10, padding: "6px 8px" }}>
                    {[
                      { v: "normal_english", l: "Normal English" },
                      { v: "simple_english", l: "Simple English" },
                      { v: "nigerian_english", l: "Nigerian English" },
                      { v: "childrens_english", l: "Children English" },
                      { v: "voiceover_friendly", l: "Voiceover Friendly" },
                      { v: "subtitle_friendly", l: "Subtitle Friendly" },
                    ].map(o => <option key={o.v} value={o.v} style={{ background: surface }}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Subtitle Style</label>
                  <select value={storySubtitleStyle} onChange={e => {
                    setStorySubtitleStyle(e.target.value);
                    // Sync to assembly subtitle style
                    const map: Record<string, "classic" | "cinema" | "neon" | "minimal" | "bold" | "none"> = {
                      normal_movie: "classic", children_story: "bold", karaoke: "neon",
                      action: "bold", emotional: "cinema", educational: "minimal",
                    };
                    if (map[e.target.value]) setSubtitleStyle(map[e.target.value]);
                  }} style={{ ...inputStyle, fontSize: 10, padding: "6px 8px" }}>
                    {[
                      { v: "normal_movie", l: "Normal Movie" },
                      { v: "children_story", l: "Children Story" },
                      { v: "karaoke", l: "Karaoke / Highlight" },
                      { v: "action", l: "Action" },
                      { v: "emotional", l: "Emotional" },
                      { v: "educational", l: "Educational" },
                    ].map(o => <option key={o.v} value={o.v} style={{ background: surface }}>{o.l}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ ...labelStyle, fontSize: 8 }}>Generation Mode</label>
                  <select value={storyGenerationMode} onChange={e => setStoryGenerationMode(e.target.value)} style={{ ...inputStyle, fontSize: 10, padding: "6px 8px" }}>
                    {[
                      { v: "hybrid", l: "Hybrid (Image + Video + Audio)" },
                      { v: "full_video", l: "Full Video" },
                      { v: "image_storybook", l: "Image Storybook" },
                      { v: "voiceover_story", l: "Voiceover Story" },
                      { v: "children_song", l: "Children Song / Dance" },
                    ].map(o => <option key={o.v} value={o.v} style={{ background: surface }}>{o.l}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <AITierSelector value={aiTier} onChange={setAiTier} compact />

            {/* Structure for Images — hybrid-only pre-step that tags each moment visually */}
            <button onClick={structureStoryForImages} disabled={!idea.trim() || structuring || expanding}
              title="Rewrites your story to make images carry emotions and actions — run before Expand for cinematic results"
              style={{ width: "100%", padding: "10px 20px", borderRadius: 10, border: `1px solid ${accent}40`,
                background: (!idea.trim() || structuring || expanding) ? "#2a2a40" : `${accent}15`,
                color: (!idea.trim() || structuring || expanding) ? muted : accent,
                fontSize: 11, fontWeight: 700, cursor: (!idea.trim() || structuring || expanding) ? "not-allowed" : "pointer", marginTop: 10 }}>
              {structuring ? "Structuring for images…" : "🎬 Structure Story for Images"}
            </button>
            {structuredTagBreakdown && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginTop: 6 }}>
                {Object.entries(structuredTagBreakdown).filter(([, v]) => v > 0).map(([tag, count]) => (
                  <span key={tag} style={{ fontSize: 8, padding: "2px 7px", borderRadius: 20, background: `${accent}15`, color: accent, fontWeight: 700 }}>
                    {tag}: {count}
                  </span>
                ))}
              </div>
            )}
            <button onClick={expandStory} disabled={!idea.trim() || expanding}
              style={{ ...btnPrimary, width: "100%", background: (!idea.trim() || expanding) ? "#2a2a40" : accent, cursor: (!idea.trim() || expanding) ? "not-allowed" : "pointer", marginTop: 8 }}>
              {expanding ? "AI is expanding your story..." : "Expand with AI Intelligence"}
            </button>
          </div>

          {/* ── Story Review — shown after AI expansion ── */}
          {expandedSummary && (
            <div style={{ ...cardStyle, borderColor: `${accent}25` }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: accent }}>Story Expanded</p>
                  {lastUsedAiProvider && (
                    <p style={{ fontSize: 9, color: muted, marginTop: 2 }}>
                      Built by: <span style={{ color: "#0ea5e9", fontWeight: 700 }}>{lastUsedAiProvider}</span>
                    </p>
                  )}
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                  <span style={badgeStyle(accent)}>{characters.length} Actor{characters.length !== 1 ? "s" : ""}</span>
                  <span style={badgeStyle(blue)}>{scenes.length} Scene{scenes.length !== 1 ? "s" : ""}</span>
                  {effectiveLanguage !== "English" && <span style={badgeStyle(purple)}>{effectiveLanguage}</span>}
                  {fullScript && fullScript !== expandedSummary && (
                    <span style={badgeStyle(gold)}>{Math.round(fullScript.split(" ").length / 130)} min script</span>
                  )}
                </div>
              </div>

              {/* Story summary + full script preview */}
              <p style={{ fontSize: 12, color: "rgba(255,255,255,0.85)", lineHeight: 1.7, marginBottom: 10, fontStyle: "italic" }}>{expandedSummary}</p>
              {fullScript && fullScript !== expandedSummary && (
                <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "10px 14px", marginBottom: 14 }}>
                  <p style={{ fontSize: 9, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>
                    Full Script Preview — {fullScript.split(" ").length} words
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", lineHeight: 1.7, whiteSpace: "pre-wrap" as const }}>
                    {fullScript.slice(0, 600)}{fullScript.length > 600 ? "…" : ""}
                  </p>
                </div>
              )}

              {/* Characters detected */}
              {characters.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Detected Actors</p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {characters.map((c, ci) => (
                      <div key={`${c.characterId}_${ci}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 20, background: `${purple}12`, border: `1px solid ${purple}25` }}>
                        <span style={{ fontSize: 9, color: purple, fontFamily: "monospace" }}>{c.characterId}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>{c.displayName}</span>
                        <span style={{ fontSize: 8, color: muted }}>{c.roleType}</span>
                        {c.species && <span style={{ fontSize: 8, color: gold }}>{c.species}</span>}
                        {c.voiceType
                          ? <span style={{ fontSize: 8, color: accent }}>{c.voiceType}</span>
                          : <span style={{ fontSize: 8, color: gold }}>needs AI build</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Scenes detected — editable per-scene cards */}
              {scenes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, margin: 0 }}>
                      Scene Breakdown ({scenes.length})
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={expandSceneList} disabled={storyExpandingScenes}
                        title="AI expands the scene list — adds in-between beats. Same arc, same characters, same ending."
                        style={{ padding: "5px 12px", borderRadius: 8, border: "none",
                          background: storyExpandingScenes ? "#2a2a40" : "linear-gradient(135deg, #ff6b00, #ff9500)",
                          color: "#fff", fontSize: 9, fontWeight: 700, cursor: storyExpandingScenes ? "not-allowed" : "pointer" }}>
                        {storyExpandingScenes ? "Expanding…" : "+ Expand Scenes"}
                      </button>
                      <button onClick={addAllEstablishingShots} disabled={establishingAll || scenes.length === 0}
                        title="AI reads your full story and inserts cinematic establishing shots before scenes that need them."
                        style={{ padding: "5px 12px", borderRadius: 8, border: "none",
                          background: (establishingAll || scenes.length === 0) ? "#2a2a40" : "linear-gradient(135deg, #fbbf24, #d97706)",
                          color: "#000", fontSize: 9, fontWeight: 700, cursor: (establishingAll || scenes.length === 0) ? "not-allowed" : "pointer" }}>
                        {establishingAll ? "Analyzing…" : "📷 Establish All"}
                      </button>
                    </div>
                  </div>
                  {/* ── Establishing Shot Mode Picker (Henry 2026-05-30 task #17) ── */}
                  <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" as const, alignItems: "center" }}>
                    <span style={{ fontSize: 9, color: muted, fontWeight: 700, marginRight: 4 }}>Mode:</span>
                    {(["off", "minimal", "auto", "cinematic", "epic"] as const).map(m => (
                      <button key={m}
                        onClick={() => setEstablishingMode(m)}
                        title={
                          m === "off" ? "No establishing shots at all" :
                          m === "minimal" ? "Opening + location/time changes only" :
                          m === "auto" ? "AI decides — full ruleset" :
                          m === "cinematic" ? "Aggressive: opening, location, mood, pre-action, beauty" :
                          "Every major scene gets a long dramatic opener"
                        }
                        style={{ padding: "3px 9px", borderRadius: 6,
                          border: `1px solid ${establishingMode === m ? "#fbbf24" : "#3d5060"}`,
                          background: establishingMode === m ? "#fbbf2415" : "transparent",
                          color: establishingMode === m ? "#fbbf24" : muted,
                          fontSize: 8, fontWeight: 700, cursor: "pointer", textTransform: "capitalize" as const }}>
                        {m}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {scenes.map(s => {
                      const editing = storyEditingSceneId === s.sceneId;
                      const polishing = storyPolishingSceneId === s.sceneId;
                      const breaking = storyBreakingSceneId === s.sceneId;
                      return (
                        <div key={s.sceneId} style={{ background: editing ? "#0d0d18" : "#ffffff05", border: `1px solid ${editing ? accent + "55" : "transparent"}`, borderRadius: 8, padding: editing ? 10 : 6 }}>
                          {/* Establishing shot mini-card — shown above main scene when present */}
                          {establishingShots[s.sceneId] && (() => {
                            const es = establishingShots[s.sceneId];
                            return (
                              <div style={{ margin: editing ? "-10px -10px 10px -10px" : "-6px -6px 6px -6px", padding: "7px 10px", background: "rgba(251,191,36,0.08)", borderBottom: "1px solid rgba(251,191,36,0.22)", borderRadius: "8px 8px 0 0", display: "flex", alignItems: "flex-start", gap: 8 }}>
                                <span style={{ fontSize: 13, lineHeight: 1 }}>📷</span>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" as const, marginBottom: 2 }}>
                                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase" as const, letterSpacing: 0.5 }}>Establishing Shot</span>
                                    <span style={{ fontSize: 8, color: "#fbbf2490", background: "#ffffff0a", borderRadius: 3, padding: "1px 5px" }}>{ESTABLISHING_TYPE_LABEL[es.type] || es.type}</span>
                                    <span style={{ fontSize: 8, color: "#fbbf2490" }}>{es.durationSeconds}s</span>
                                    <span style={{ fontSize: 8, color: "#fbbf2460" }}>· {es.cameraMovement}</span>
                                  </div>
                                  <p style={{ fontSize: 9, color: "#fbbf2470", margin: 0, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{es.prompt}</p>
                                </div>
                                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                                  {/* Image preview if generated */}
                                  {es.imageUrl && (
                                    <img src={es.imageUrl} alt="Establishing shot" style={{ width: 80, height: 45, objectFit: "cover", borderRadius: 4, border: "1px solid rgba(251,191,36,0.3)" }} />
                                  )}
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <button
                                      onClick={() => genEstablishingShotImage(s.sceneId)}
                                      disabled={establishingSceneId === s.sceneId}
                                      title="Generate image for this establishing shot"
                                      style={{ background: "rgba(251,191,36,0.15)", border: "1px solid rgba(251,191,36,0.3)", color: "#fbbf24", fontSize: 9, cursor: establishingSceneId === s.sceneId ? "not-allowed" : "pointer", padding: "2px 6px", borderRadius: 4, lineHeight: 1.4, whiteSpace: "nowrap" as const }}>
                                      {establishingSceneId === s.sceneId ? "…" : "🖼 Gen Image"}
                                    </button>
                                    <button
                                      onClick={() => setEstablishingShots(prev => { const n = { ...prev }; delete n[s.sceneId]; return n; })}
                                      title="Remove establishing shot"
                                      style={{ background: "transparent", border: "none", color: "#fbbf2460", fontSize: 12, cursor: "pointer", padding: "2px 4px", lineHeight: 1 }}>
                                      ✕
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                          {/* Header row */}
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: editing ? 0 : "2px 4px", marginBottom: editing ? 8 : 0 }}>
                            <span style={{ fontSize: 9, fontFamily: "monospace", color: blue, minWidth: 32 }}>{s.sceneId}</span>
                            <span style={{ fontSize: 11, color: "#fff", flex: 1, fontWeight: 600 }}>{s.title}</span>
                            {s.mood && <span style={badgeStyle(purple)}>{s.mood}</span>}
                            {s.location && <span style={{ fontSize: 8, color: muted }}>{s.location}</span>}
                            {!editing && (
                              <>
                                <button onClick={() => { setStoryEditingSceneId(s.sceneId); setStoryEditedDescription(s.description); }}
                                  style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${blue}40`, background: `${blue}15`, color: blue, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                  Edit
                                </button>
                                <button onClick={() => breakScene(s)} disabled={breaking}
                                  title="Split this scene into 2"
                                  style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${gold}40`, background: breaking ? "#2a2a40" : `${gold}15`, color: gold, fontSize: 9, fontWeight: 700, cursor: breaking ? "not-allowed" : "pointer" }}>
                                  {breaking ? "..." : "Break"}
                                </button>
                              </>
                            )}
                          </div>
                          {/* Description preview when not editing */}
                          {!editing && s.description && (
                            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", padding: "0 4px 2px 44px", lineHeight: 1.5, margin: 0 }}>
                              {s.description.length > 220 ? s.description.slice(0, 220) + "…" : s.description}
                            </p>
                          )}
                          {/* Edit panel */}
                          {editing && (
                            <div>
                              <textarea
                                value={storyEditedDescription}
                                onChange={e => setStoryEditedDescription(e.target.value)}
                                rows={5}
                                style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "#161624", color: "#fff", fontSize: 11, lineHeight: 1.6, fontFamily: "inherit", resize: "vertical" as const }}
                              />

                              {/* LLM selector — same chain as AI Chat. Auto = ollama → openai → claude. */}
                              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, flexWrap: "wrap" as const }}>
                                <span style={{ fontSize: 8, color: muted, fontWeight: 700, letterSpacing: 0.5 }}>LLM:</span>
                                {([
                                  { id: "auto",   label: "Auto" },
                                  { id: "ollama", label: "Ollama" },
                                  { id: "openai", label: "GPT" },
                                  { id: "claude", label: "Haiku" },
                                ] as const).map(p => {
                                  const active = effectiveLlmProvider === p.id;
                                  return (
                                    <button key={p.id} onClick={() => { setStoryEditProvider(p.id); patchProjectSettings({ llmProvider: p.id }).catch(() => {}); }}
                                      title={p.id === "auto" ? "Try Ollama → GPT → Haiku in order" : `Force ${p.label} only`}
                                      style={{ padding: "2px 8px", borderRadius: 5, border: `1px solid ${active ? "#a855f7" : "#a855f730"}`,
                                        background: active ? "#a855f725" : "transparent",
                                        color: active ? "#c084fc" : muted, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                      {p.label}
                                    </button>
                                  );
                                })}
                              </div>

                              {/* Action buttons. Polish modes: default / add_action / intense / reduce_action / emotional.
                                  Each button calls polishSceneText with its mode. While one mode is in flight,
                                  the others are disabled to avoid racing requests. */}
                              <div style={{ display: "flex", gap: 6, marginTop: 6, flexWrap: "wrap" as const }}>
                                {([
                                  { mode: "default" as const,        label: "✨ Polish",        title: "Tighter, more dramatic prose. Same plot.", grad: "linear-gradient(135deg, #a855f7, #7c3aed)" },
                                  { mode: "add_action" as const,     label: "+ Add Action",      title: "Add more action verbs and movement beats", grad: "linear-gradient(135deg, #ff6b00, #ff9500)" },
                                  { mode: "intense" as const,        label: "🔥 Make Intense",   title: "Raise stakes, sharpen tension",            grad: "linear-gradient(135deg, #ef4444, #b91c1c)" },
                                  { mode: "reduce_action" as const,  label: "❄ Reduce Action",   title: "Soften, slow down, more reflective",       grad: "linear-gradient(135deg, #06b6d4, #0891b2)" },
                                  { mode: "emotional" as const,      label: "💜 Make Emotional", title: "Emphasize feelings, internal weight",      grad: "linear-gradient(135deg, #ec4899, #be185d)" },
                                ]).map(b => {
                                  const busy = polishing && storyPolishingMode === b.mode;
                                  return (
                                    <button key={b.mode}
                                      onClick={() => polishSceneText(s, b.mode)}
                                      disabled={polishing}
                                      title={b.title}
                                      style={{ padding: "6px 10px", borderRadius: 8, border: "none",
                                        background: polishing ? "#2a2a40" : b.grad,
                                        color: "#fff", fontSize: 9, fontWeight: 700, cursor: polishing ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                      {busy ? "Working…" : b.label}
                                    </button>
                                  );
                                })}
                                <button
                                  onClick={() => addEstablishingShot(s)}
                                  disabled={!!establishingSceneId}
                                  title="AI inserts a cinematic wide shot before this scene if needed."
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "none",
                                    background: establishingSceneId === s.sceneId ? "#2a2a40" : "linear-gradient(135deg, #fbbf24, #d97706)",
                                    color: "#000", fontSize: 9, fontWeight: 700, cursor: !!establishingSceneId ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                  {establishingSceneId === s.sceneId ? "Analyzing…" : "📷 Establish"}
                                </button>
                                <button
                                  onClick={runStoryQC}
                                  disabled={storyQCRunning || polishing}
                                  title="Run QC check on all scenes"
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "none",
                                    background: storyQCRunning ? "#2a2a40" : "linear-gradient(135deg, #a855f7, #7c3aed)",
                                    color: "#fff", fontSize: 9, fontWeight: 700, cursor: (storyQCRunning || polishing) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                  {storyQCRunning ? "QC…" : "🔍 QC"}
                                </button>
                                <button
                                  onClick={() => fixSceneQC(s)}
                                  disabled={polishing || fixingQC || !storyQCResult}
                                  title={storyQCResult ? "Apply QC fixes targeting this scene" : "Run QC first"}
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "none",
                                    background: (polishing || fixingQC || !storyQCResult) ? "#2a2a40" : "linear-gradient(135deg, #22c55e, #15803d)",
                                    color: "#fff", fontSize: 9, fontWeight: 700, cursor: (polishing || fixingQC || !storyQCResult) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                  🔧 QC Fix
                                </button>
                                <button
                                  onClick={() => checkSceneContext(s)}
                                  disabled={polishing}
                                  title="Check if this scene is clear and easy to understand"
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "none",
                                    background: polishing ? "#2a2a40" : "linear-gradient(135deg, #0ea5e9, #0284c7)",
                                    color: "#fff", fontSize: 9, fontWeight: 700, cursor: polishing ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                  📋 Context
                                </button>
                                <button
                                  onClick={() => fixSceneContext(s)}
                                  disabled={polishing}
                                  title="AI rewrites scene to be clearer and easier to understand"
                                  style={{ padding: "6px 10px", borderRadius: 8, border: "none",
                                    background: polishing ? "#2a2a40" : "linear-gradient(135deg, #f59e0b, #d97706)",
                                    color: "#000", fontSize: 9, fontWeight: 700, cursor: polishing ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                  ✏ Fix Context
                                </button>
                              </div>
                              {/* Context check result for this scene */}
                              {contextCheckResults[s.sceneId] && (
                                <div style={{ marginTop: 4, padding: "5px 10px", borderRadius: 6,
                                  background: contextCheckResults[s.sceneId].status === "ok" ? "rgba(34,197,94,0.08)" : contextCheckResults[s.sceneId].status === "checking" ? "rgba(168,85,247,0.08)" : "rgba(245,158,11,0.10)",
                                  border: `1px solid ${contextCheckResults[s.sceneId].status === "ok" ? "#22c55e" : contextCheckResults[s.sceneId].status === "checking" ? "#a855f7" : "#f59e0b"}30` }}>
                                  <p style={{ fontSize: 9, color: contextCheckResults[s.sceneId].status === "ok" ? "#22c55e" : contextCheckResults[s.sceneId].status === "checking" ? "#a855f7" : "#fbbf24", margin: 0 }}>
                                    {contextCheckResults[s.sceneId].status === "checking" ? "⟳ " : contextCheckResults[s.sceneId].status === "ok" ? "✓ " : "⚠ "}
                                    {contextCheckResults[s.sceneId].note}
                                  </p>
                                </div>
                              )}

                              {/* AI custom instruction — user types free-text, AI rewrites scene */}
                              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                <input
                                  value={storyEditAiQuery[s.sceneId] || ""}
                                  onChange={e => setStoryEditAiQuery(prev => ({ ...prev, [s.sceneId]: e.target.value }))}
                                  onKeyDown={async e => { if (e.key === "Enter" && storyEditAiQuery[s.sceneId]?.trim()) await polishSceneCustom(s); }}
                                  placeholder="Ask AI: make it shorter, add rain, more emotional, change location..."
                                  style={{ ...inputStyle, flex: 1, fontSize: 10, padding: "6px 10px" }}
                                />
                                <button
                                  onClick={() => polishSceneCustom(s)}
                                  disabled={polishing || !storyEditAiQuery[s.sceneId]?.trim()}
                                  style={{ padding: "6px 12px", borderRadius: 8, border: "none", background: (polishing || !storyEditAiQuery[s.sceneId]?.trim()) ? "#2a2a40" : "linear-gradient(135deg, #22c55e, #16a34a)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: (polishing || !storyEditAiQuery[s.sceneId]?.trim()) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                                  {storyPolishingSceneId === s.sceneId && !storyPolishingMode ? "Thinking…" : "Ask AI"}
                                </button>
                              </div>

                              {/* Commit / cancel / break */}
                              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                                <button onClick={() => {
                                    updateScene(s.scene, { description: storyEditedDescription });
                                    setStoryEditingSceneId(null);
                                    setStoryEditedDescription("");
                                    setLastAction(`Scene ${s.scene} saved`);
                                  }}
                                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                                  Save
                                </button>
                                <button onClick={() => { setStoryEditingSceneId(null); setStoryEditedDescription(""); }}
                                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                                  Cancel
                                </button>
                                <button onClick={() => breakScene(s)} disabled={breaking}
                                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${gold}40`, background: breaking ? "#2a2a40" : `${gold}10`, color: gold, fontSize: 10, fontWeight: 700, cursor: breaking ? "not-allowed" : "pointer", marginLeft: "auto" }}>
                                  {breaking ? "Breaking…" : "Break Scene → 2"}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Next step CTA */}
              <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                <button onClick={() => setActiveTab("script")}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${blue}, #0066aa)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  → Step 2: Parse Script
                </button>
                <button onClick={() => setActiveTab("scenes")}
                  style={{ padding: "11px 18px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                  Skip to Scenes
                </button>
              </div>
            </div>
          )}

          {/* ── Story Quality Control Panel ────────────────────────────── */}
          {expandedSummary && (
            <div style={{ ...cardStyle, borderColor: `${accent}30`, background: "rgba(168,85,247,0.04)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: accent }}>Story Quality Control</p>
                  <p style={{ fontSize: 9, color: muted, marginTop: 2 }}>
                    Run supervisor pipeline — validates cast, culture, timing, music, continuity before generation
                  </p>
                </div>
                <button
                  onClick={runStoryQC}
                  disabled={storyQCRunning}
                  style={{
                    padding: "10px 20px", borderRadius: 10, border: "none",
                    background: storyQCRunning ? "#2a2a40" : `linear-gradient(135deg, ${accent}, #7c3aed)`,
                    color: "#fff", fontSize: 11, fontWeight: 700, cursor: storyQCRunning ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap" as const,
                  }}>
                  {storyQCRunning ? "Running QC…" : "Run Story QC"}
                </button>
              </div>
              {/* Context Check / Fix row — all scenes at once */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginBottom: 14, padding: "8px 12px", borderRadius: 8, background: "#ffffff04", border: `1px solid ${border}` }}>
                <p style={{ fontSize: 9, color: muted, margin: 0, alignSelf: "center", flex: 1 }}>Context clarity tools — check if story is easy to understand, then fix:</p>
                <button
                  onClick={checkContextAll}
                  disabled={scenes.length === 0}
                  title="Check all scenes for clarity and understandability"
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none",
                    background: scenes.length === 0 ? "#2a2a40" : "linear-gradient(135deg, #0ea5e9, #0284c7)",
                    color: "#fff", fontSize: 10, fontWeight: 700, cursor: scenes.length === 0 ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                  📋 Context Check (All)
                </button>
                <button
                  onClick={fixContextAll}
                  disabled={fixingContext || scenes.length === 0}
                  title="AI rewrites all scenes to be clearer and simpler"
                  style={{ padding: "6px 14px", borderRadius: 8, border: "none",
                    background: (fixingContext || scenes.length === 0) ? "#2a2a40" : "linear-gradient(135deg, #f59e0b, #d97706)",
                    color: "#000", fontSize: 10, fontWeight: 700, cursor: (fixingContext || scenes.length === 0) ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                  {fixingContext ? "Fixing…" : "✏ Fix Context (All)"}
                </button>
              </div>

              {/* Context check summary — visible in global panel after Context Check (All) */}
              {Object.keys(contextCheckResults).length > 0 && (
                <div style={{ marginBottom: 14, padding: "10px 14px", borderRadius: 8, background: "#ffffff04", border: `1px solid ${border}` }}>
                  <p style={{ fontSize: 9, color: muted, fontWeight: 700, letterSpacing: 0.5, margin: "0 0 8px 0" }}>CONTEXT CHECK RESULTS</p>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                    {scenes.map(sc => {
                      const r = contextCheckResults[sc.sceneId];
                      if (!r) return null;
                      const col = r.status === "ok" ? "#22c55e" : r.status === "checking" ? "#a855f7" : "#f59e0b";
                      return (
                        <div key={sc.sceneId} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 8px", borderRadius: 6, background: `${col}08`, border: `1px solid ${col}25` }}>
                          <span style={{ fontSize: 9, color: col, fontWeight: 700, whiteSpace: "nowrap" as const, minWidth: 60 }}>S{sc.scene}: {r.status === "checking" ? "⟳" : r.status === "ok" ? "✓ OK" : "⚠ WARN"}</span>
                          <span style={{ fontSize: 9, color: "rgba(255,255,255,0.7)", lineHeight: 1.4 }}>{r.note}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <span style={{ fontSize: 9, color: "#22c55e" }}>✓ {Object.values(contextCheckResults).filter(r => r.status === "ok").length} OK</span>
                    <span style={{ fontSize: 9, color: "#f59e0b" }}>⚠ {Object.values(contextCheckResults).filter(r => r.status === "warn").length} need fix</span>
                    <button onClick={() => setContextCheckResults({})} style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>Clear</button>
                  </div>
                </div>
              )}

              {/* Contract summary */}
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
                {[
                  { label: storyType.replace(/_/g, " "), color: accent },
                  { label: `${sceneDurationSec}s/scene`, color: blue },
                  { label: storyEmotionalIntensity.replace(/_/g, " "), color: gold },
                  { label: storyLanguageLevel.replace(/_/g, " "), color: purple },
                  { label: storyGenerationMode.replace(/_/g, " "), color: "#22c55e" },
                  ...(storyCountry ? [{ label: storyCountry, color: "#f472b6" }] : []),
                ].map((b, i) => (
                  <span key={i} style={{ ...badgeStyle(b.color), textTransform: "capitalize" as const }}>{b.label}</span>
                ))}
              </div>

              {/* QC Results */}
              {storyQCResult && (
                <div>
                  {/* Overall score */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, padding: "12px 14px", borderRadius: 10, background: storyQCResult.gatekeeper.passed ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${storyQCResult.gatekeeper.passed ? "#22c55e" : "#ef4444"}30` }}>
                    <div style={{ width: 48, height: 48, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: storyQCResult.gatekeeper.passed ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", fontSize: 18, fontWeight: 800, color: storyQCResult.gatekeeper.passed ? "#22c55e" : "#ef4444", flexShrink: 0 }}>
                      {storyQCResult.gatekeeper.score}
                    </div>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 700, color: storyQCResult.gatekeeper.passed ? "#22c55e" : "#ef4444" }}>
                        {storyQCResult.gatekeeper.passed ? "QC Passed" : "QC Issues Found"}
                      </p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 2 }}>
                        {storyQCResult.gatekeeper.blockingIssues.length} blocking · {storyQCResult.gatekeeper.warnings.length} warnings
                      </p>
                    </div>
                    {storyQCResult.gatekeeper.revisedData?.scores && (
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, marginLeft: "auto" }}>
                        {Object.entries(storyQCResult.gatekeeper.revisedData.scores).map(([key, val]) => (
                          <div key={key} style={{ textAlign: "center" as const }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: (val as number) >= 70 ? "#22c55e" : (val as number) >= 50 ? gold : "#ef4444" }}>{val as number}</div>
                            <div style={{ fontSize: 7, color: muted, textTransform: "capitalize" as const }}>{key.replace(/_/g, " ")}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Blocking issues */}
                  {storyQCResult.gatekeeper.blockingIssues.length > 0 && (
                    <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#ef4444", marginBottom: 6 }}>Blocking Issues</p>
                      {storyQCResult.gatekeeper.blockingIssues.map((issue, i) => (
                        <p key={i} style={{ fontSize: 10, color: "#fca5a5", marginBottom: 3, paddingLeft: 8 }}>• {issue}</p>
                      ))}
                    </div>
                  )}

                  {/* Warnings */}
                  {storyQCResult.gatekeeper.warnings.length > 0 && (
                    <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)" }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: gold, marginBottom: 6 }}>Warnings</p>
                      {storyQCResult.gatekeeper.warnings.map((w, i) => (
                        <p key={i} style={{ fontSize: 10, color: "#fde68a", marginBottom: 3, paddingLeft: 8 }}>⚠ {w}</p>
                      ))}
                    </div>
                  )}

                  {/* Suggested fixes */}
                  {storyQCResult.gatekeeper.suggestedFixes.length > 0 && (
                    <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 8, background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.25)" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: blue, margin: 0 }}>Suggested Fixes</p>
                        <button onClick={fixAllQCSuggestions} disabled={fixingQC || scenes.length === 0}
                          style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: (fixingQC || scenes.length === 0) ? "#2a2a40" : `linear-gradient(135deg, ${blue}, #0066aa)`, color: "#fff", fontSize: 9, fontWeight: 700, cursor: (fixingQC || scenes.length === 0) ? "not-allowed" : "pointer" }}>
                          {fixingQC ? "Fixing…" : "Fix All"}
                        </button>
                      </div>
                      {storyQCResult.gatekeeper.suggestedFixes.map((fix, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                          <p style={{ fontSize: 10, color: "#bfdbfe", flex: 1, margin: 0 }}>→ {fix}</p>
                          <button onClick={() => { if (!applyFixDirect(fix)) fixQCSuggestion(fix); }} disabled={fixingQC || scenes.length === 0}
                            style={{ padding: "2px 8px", borderRadius: 5, border: `1px solid ${blue}40`, background: "transparent", color: blue, fontSize: 9, cursor: (fixingQC || scenes.length === 0) ? "not-allowed" : "pointer", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                            Fix
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Fix-done banner — appears after any Fix button completes */}
                  {qcFixDoneMsg && (
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: "10px 14px", borderRadius: 10, background: "rgba(34,197,94,0.10)", border: "1px solid rgba(34,197,94,0.35)" }}>
                      <span style={{ fontSize: 16 }}>✅</span>
                      <p style={{ fontSize: 11, fontWeight: 600, color: "#22c55e", flex: 1, margin: 0 }}>{qcFixDoneMsg}</p>
                      <button
                        onClick={() => { setQcFixDoneMsg(null); runStoryQC(); }}
                        disabled={storyQCRunning}
                        style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: storyQCRunning ? "#2a2a40" : `linear-gradient(135deg, ${accent}, #7c3aed)`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: storyQCRunning ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                        {storyQCRunning ? "Running…" : "Re-run QC"}
                      </button>
                      <button onClick={() => setQcFixDoneMsg(null)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                        ✕
                      </button>
                    </div>
                  )}

                  {/* Cast Bible */}
                  {storyQCResult.castBible.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Cast Bible ({storyQCResult.castBible.length})</p>
                      <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                        {storyQCResult.castBible.map(c => (
                          <div key={c.character_id} style={{ display: "flex", gap: 8, padding: "6px 10px", borderRadius: 8, background: "#ffffff05", border: "1px solid #ffffff10", alignItems: "flex-start" }}>
                            <span style={{ fontSize: 8, fontFamily: "monospace", color: accent, minWidth: 80, flexShrink: 0 }}>{c.character_id}</span>
                            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", minWidth: 80, flexShrink: 0 }}>{c.name}</span>
                            <span style={{ fontSize: 8, color: purple, flexShrink: 0 }}>{c.role}</span>
                            <span style={{ fontSize: 8, color: muted, flex: 1 }}>{c.ethnicity} · {c.clothing}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Scene Plans */}
                  {storyQCResult.scenes.length > 0 && (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, margin: 0 }}>Scene Plans ({storyQCResult.scenes.length})</p>
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <button onClick={() => setStoryQCSceneIndex(i => Math.max(0, i - 1))} disabled={storyQCSceneIndex === 0}
                            style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: storyQCSceneIndex === 0 ? "not-allowed" : "pointer" }}>←</button>
                          <span style={{ fontSize: 9, color: muted }}>{storyQCSceneIndex + 1} / {storyQCResult.scenes.length}</span>
                          <button onClick={() => setStoryQCSceneIndex(i => Math.min(storyQCResult!.scenes.length - 1, i + 1))} disabled={storyQCSceneIndex >= storyQCResult.scenes.length - 1}
                            style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: storyQCSceneIndex >= storyQCResult.scenes.length - 1 ? "not-allowed" : "pointer" }}>→</button>
                        </div>
                      </div>
                      {(() => {
                        const sc = storyQCResult.scenes[storyQCSceneIndex];
                        if (!sc) return null;
                        return (
                          <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ffffff05", border: `1px solid ${border}` }}>
                            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                              <span style={{ fontSize: 8, fontFamily: "monospace", color: blue }}>{sc.scene_id}</span>
                              <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", flex: 1 }}>{sc.title}</span>
                              <span style={badgeStyle(purple)}>{sc.emotion}</span>
                              <span style={badgeStyle(gold)}>{sc.duration}s</span>
                              <span style={{ fontSize: 8, color: sc.provider_recommendation === "video" ? "#ef4444" : "#22c55e" }}>{sc.provider_recommendation?.replace(/_/g, " ")}</span>
                            </div>
                            {sc.voiceover_text && <p style={{ fontSize: 10, color: "rgba(255,255,255,0.75)", fontStyle: "italic", marginBottom: 4 }}>"{sc.voiceover_text}"</p>}
                            {sc.image_prompt && <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}><strong style={{ color: accent }}>Image:</strong> {sc.image_prompt.slice(0, 180)}{sc.image_prompt.length > 180 ? "…" : ""}</p>}
                            {sc.music_cue && <p style={{ fontSize: 9, color: "#fbbf24" }}>♪ {sc.music_cue}</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                    {storyQCResult.gatekeeper.passed ? (
                      <button
                        onClick={() => {
                          setLastAction("Story QC approved — scenes accepted as QC validated");
                          setActiveTab("scenes");
                        }}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, #22c55e, #16a34a)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        Approved — Continue to Scenes
                      </button>
                    ) : (
                      <button
                        onClick={runStoryQC}
                        disabled={storyQCRunning}
                        style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: storyQCRunning ? "#2a2a40" : `linear-gradient(135deg, ${accent}, #7c3aed)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: storyQCRunning ? "not-allowed" : "pointer" }}>
                        {storyQCRunning ? "Re-running QC…" : "Re-run QC"}
                      </button>
                    )}
                    <button
                      onClick={() => setActiveTab("scenes")}
                      style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                      Continue Anyway
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Narration Setup ─────────────────────────────────────────── */}
          {(expandedSummary || idea.trim()) && (
            <div style={{ ...cardStyle, borderColor: `${blue}20` }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Narration & Script</h3>
                  <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                    {scriptSegments.length > 0
                      ? storyMode === "narration-only" ? "Narrator only — no character dialogue detected"
                        : storyMode === "actors-only" ? "Actors only — no narration passages detected"
                        : `Mixed — ${scriptSegments.filter(s => s.type === "narration").length} narrator + ${scriptSegments.filter(s => s.type === "dialogue").length} dialogue segments`
                      : "Parse Script splits your story into narrator lines vs character dialogue, then lets you generate narration audio with Piper TTS."}
                  </p>
                </div>
                <button onClick={parseScript} disabled={parsingScript}
                  style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const,
                    background: parsingScript ? "#2a2a40" : `linear-gradient(135deg, ${blue}, #0066aa)`, color: "#fff" }}>
                  {parsingScript ? "Parsing..." : scriptSegments.length > 0 ? "Re-parse Script" : "Parse Script"}
                </button>
              </div>

              {/* Story mode badges */}
              {scriptSegments.length > 0 && (
                <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                  {(["narration-only", "actors-only", "mixed"] as const).map(m => (
                    <button key={m} onClick={() => setStoryMode(m)}
                      style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${storyMode === m ? blue : border}`,
                        background: storyMode === m ? `${blue}18` : "transparent",
                        color: storyMode === m ? blue : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      {m === "narration-only" ? "Narrator Only" : m === "actors-only" ? "Actors Only" : "Mixed"}
                    </button>
                  ))}
                </div>
              )}

              {/* Actor voice on/off — deactivate character voices anytime (also in Assembly tab) */}
              {storyMode !== "narration-only" && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "8px 12px", borderRadius: 10, background: "#ffffff05", border: `1px solid ${border}`, marginBottom: 14 }}>
                  <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>🎭 Actor / character voices {actorVoicesEnabled ? "ON" : "OFF (narrator only)"}</span>
                  <button onClick={() => setActorVoicesEnabled(v => !v)}
                    style={{ padding: "4px 14px", borderRadius: 20, border: `1px solid ${actorVoicesEnabled ? blue : border}`,
                      background: actorVoicesEnabled ? `${blue}22` : "transparent",
                      color: actorVoicesEnabled ? blue : muted, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                    {actorVoicesEnabled ? "Deactivate actor voices" : "Activate actor voices"}
                  </button>
                </div>
              )}

              {/* Narrator voice / provider selector — only shown after Parse Script has run */}
              {scriptSegments.length > 0 && (storyMode === "narration-only" || storyMode === "mixed") && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "#ffffff05", border: `1px solid ${border}`, marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Sound Tier</p>
                  <p style={{ fontSize: 9, color: muted, marginBottom: 10 }}>GHS Sound = Piper TTS (free). GHS Plus/Pro = Karaoke pipeline. GHS Premium = Kie Suno V5 (KIE_AI_API_KEY). Set tier in Sound tab for full control.</p>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6, marginBottom: 12 }}>
                    {([
                      { id: "ghs-sound",   label: "GHS Sound",   color: accent },
                      { id: "ghs-plus",    label: "GHS Plus",    color: gold },
                      { id: "ghs-pro",     label: "GHS Pro",     color: blue },
                      { id: "ghs-premium", label: "GHS Premium", color: purple },
                    ] as const).map(tier => (
                      <button key={tier.id}
                        data-tier={tier.id}
                        onClick={() => {
                          setSoundTier(tier.id);
                          patchProjectSettings({ soundTier: tier.id }).catch(() => {});
                          if (tier.id === "ghs-sound") setNarratorVoice("piper");
                          else if (tier.id === "ghs-plus") setNarratorVoice("karaoke");
                          else if (tier.id === "ghs-pro") setNarratorVoice("karaoke");
                          else if (tier.id === "ghs-premium") setNarratorVoice("kie-suno");
                        }}
                        style={{ padding: "7px 6px", borderRadius: 8, border: `1px solid ${effectiveSoundTier === tier.id && narratorVoice !== "none" ? tier.color : border}`,
                          background: effectiveSoundTier === tier.id && narratorVoice !== "none" ? `${tier.color}15` : "transparent",
                          color: effectiveSoundTier === tier.id && narratorVoice !== "none" ? tier.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        {tier.label}
                      </button>
                    ))}
                    <button
                      onClick={() => setNarratorVoice("none")}
                      style={{ padding: "7px 6px", borderRadius: 8, border: `1px solid ${narratorVoice === "none" ? "#ef4444" : border}`,
                        background: narratorVoice === "none" ? "#ef444415" : "transparent",
                        color: narratorVoice === "none" ? "#ef4444" : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      Off
                    </button>
                  </div>

                  {narratorVoice === "piper" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Model</p>
                          <select value={narratorPiperModel} onChange={e => setNarratorPiperModel(e.target.value)}
                            style={{ ...inputStyle, fontSize: 11, padding: "7px 10px" }}>
                            {["en_US-lessac-medium", "en_US-libritts-high", "en_US-amy-medium", "en_US-ryan-high", "en_GB-alan-medium"].map(m => (
                              <option key={m} value={m} style={{ background: surface }}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Speed</p>
                          <input type="number" min={0.5} max={2} step={0.1} value={narratorPiperSpeed}
                            onChange={e => setNarratorPiperSpeed(Number(e.target.value))}
                            style={{ ...inputStyle, width: 64, padding: "7px 10px", fontSize: 11 }} />
                        </div>
                      </div>
                      {piperNotInstalled && (
                        <div style={{ padding: "8px 12px", borderRadius: 8, background: `${gold}10`, border: `1px solid ${gold}30`, marginBottom: 8 }}>
                          <p style={{ fontSize: 10, color: gold, fontWeight: 600 }}>Piper not installed</p>
                          <p style={{ fontSize: 9, color: muted, marginTop: 3 }}>
                            Download from{" "}
                            <a href="https://github.com/rhasspy/piper/releases" target="_blank" rel="noopener noreferrer"
                              style={{ color: blue, textDecoration: "underline" }}>github.com/rhasspy/piper/releases</a>
                            {" "}— add the binary to your PATH or set PIPER_BIN in your .env
                          </p>
                        </div>
                      )}
                      {generatingNarration && (
                        <div style={{ padding: "7px 12px", borderRadius: 8, background: `${blue}10`, border: `1px solid ${blue}25`, marginBottom: 8, fontSize: 10, color: blue }}>
                          {piperDownloading
                            ? "⬇ Downloading model from HuggingFace... (first time only, ~50–100MB)"
                            : "Generating audio..."}
                        </div>
                      )}
                      <button onClick={generateNarrationPiper} disabled={generatingNarration}
                        style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: generatingNarration ? "not-allowed" : "pointer",
                          background: generatingNarration ? "#2a2a40" : accent, color: "#000" }}>
                        {generatingNarration ? "Working..." : narratorAudioUrl ? "Regenerate Narration" : "Generate Narration Audio"}
                      </button>
                    </div>
                  )}

                  {narratorVoice === "fal-narrator" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: `${blue}08`, border: `1px solid ${blue}20` }}>
                      <p style={{ fontSize: 10, color: blue, fontWeight: 600 }}>FAL Narrator (fal-ai/kokoro)</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3, marginBottom: 10 }}>Cloud TTS via FAL AI. Requires FAL_KEY in .env. Natural, expressive voices.</p>
                      <button onClick={generateNarrationPiper} disabled={generatingNarration}
                        style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: generatingNarration ? "not-allowed" : "pointer",
                          background: generatingNarration ? "#2a2a40" : blue, color: "#000" }}>
                        {generatingNarration ? "Working..." : narratorAudioUrl ? "Regenerate (FAL)" : "Generate via FAL Narrator"}
                      </button>
                    </div>
                  )}

                  {narratorVoice === "edge-tts" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: "#34d39908", border: "1px solid #34d39920" }}>
                      <p style={{ fontSize: 10, color: "#34d399", fontWeight: 600 }}>Edge Neural (free) — Microsoft neural voices</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3, marginBottom: 8 }}>Free natural voices including Nigerian. Needs edge-tts installed on the server; falls back to Piper automatically if it fails.</p>
                      {/* Regional voice sub-picker — same 10 voices as free-mode (PR #70) */}
                      <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 10 }}>
                        {[
                          { id: "en-NG-EzinneNeural",   label: "NG · F" },
                          { id: "en-NG-AbeoNeural",     label: "NG · M" },
                          { id: "en-KE-AsiliaNeural",   label: "KE · F" },
                          { id: "en-KE-ChilembaNeural", label: "KE · M" },
                          { id: "en-ZA-LeahNeural",     label: "ZA · F" },
                          { id: "en-ZA-LukeNeural",     label: "ZA · M" },
                          { id: "en-US-AriaNeural",     label: "US · F" },
                          { id: "en-US-GuyNeural",      label: "US · M" },
                          { id: "en-GB-SoniaNeural",    label: "UK · F" },
                          { id: "en-GB-RyanNeural",     label: "UK · M" },
                        ].map(v => (
                          <button key={v.id} type="button" onClick={() => setEdgeTtsVoiceId(v.id)} title={v.id}
                            style={{ padding: "3px 7px", borderRadius: 6, fontSize: 9, fontWeight: 700, cursor: "pointer",
                              border: `1px solid ${edgeTtsVoiceId === v.id ? "#34d399" : border}`,
                              background: edgeTtsVoiceId === v.id ? "#34d39918" : "transparent",
                              color: edgeTtsVoiceId === v.id ? "#34d399" : muted }}>
                            {v.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={generateNarrationPiper} disabled={generatingNarration}
                        style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: generatingNarration ? "not-allowed" : "pointer",
                          background: generatingNarration ? "#2a2a40" : "#34d399", color: "#000" }}>
                        {generatingNarration ? "Working..." : narratorAudioUrl ? "Regenerate (Edge)" : "Generate via Edge Neural"}
                      </button>
                    </div>
                  )}

                  {narratorVoice === "elevenlabs" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: `${purple}08`, border: `1px solid ${purple}20` }}>
                      <p style={{ fontSize: 10, color: purple, fontWeight: 600 }}>ElevenLabs narrator</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3, marginBottom: 10 }}>Uses your ELEVENLABS_API_KEY. Requires the key to be set in .env.</p>
                      <button onClick={generateNarrationPiper} disabled={generatingNarration}
                        style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: generatingNarration ? "not-allowed" : "pointer",
                          background: generatingNarration ? "#2a2a40" : purple, color: "#fff" }}>
                        {generatingNarration ? "Working..." : narratorAudioUrl ? "Regenerate (ElevenLabs)" : "Generate via ElevenLabs"}
                      </button>
                    </div>
                  )}

                  {narratorVoice === "karaoke" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: `${gold}08`, border: `1px solid ${gold}20` }}>
                      <p style={{ fontSize: 10, color: gold, fontWeight: 600 }}>GHS Plus / GHS Pro — Karaoke Pipeline</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3, marginBottom: 10 }}>Uses GHS Karaoke pipeline with FAL Kokoro TTS. Requires FAL_KEY in .env (falls back to Piper if absent). GHS Pro also uses FAL Stable Audio for background music.</p>
                      <button onClick={generateNarrationPiper} disabled={generatingNarration}
                        style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: generatingNarration ? "not-allowed" : "pointer",
                          background: generatingNarration ? "#2a2a40" : gold, color: "#000" }}>
                        {generatingNarration ? "Working..." : narratorAudioUrl ? "Regenerate (Karaoke)" : "Generate via Karaoke"}
                      </button>
                    </div>
                  )}

                  {narratorVoice === "kie-suno" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: `${purple}08`, border: `1px solid ${purple}20` }}>
                      <p style={{ fontSize: 10, color: purple, fontWeight: 600 }}>GHS Premium — Kie Suno V5</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3, marginBottom: 10 }}>
                        Premium AI music via Kie.ai Suno V5. Requires KIE_AI_API_KEY in .env. Narration falls back to Piper (high-quality model) if key is absent. Use /api/music/generate with soundTier=ghs-premium for music generation.
                      </p>
                      <button onClick={generateNarrationPiper} disabled={generatingNarration}
                        style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: generatingNarration ? "not-allowed" : "pointer",
                          background: generatingNarration ? "#2a2a40" : purple, color: "#fff" }}>
                        {generatingNarration ? "Working..." : narratorAudioUrl ? "Regenerate (GHS Premium)" : "Generate via GHS Premium"}
                      </button>
                    </div>
                  )}

                  {narratorVoice === "none" && (
                    <div style={{ padding: "10px 12px", borderRadius: 8, background: "#ef444408", border: "1px solid #ef444430" }}>
                      <p style={{ fontSize: 10, color: "#ef4444", fontWeight: 600 }}>Narration Off</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3 }}>No narrator audio will be generated. Select a tier above to enable narration.</p>
                    </div>
                  )}

                  {/* Narrator audio player */}
                  {narratorAudioUrl && (
                    <div style={{ marginTop: 10, padding: "10px 12px", borderRadius: 8, background: "#0a1a0a", border: `1px solid #4ade8030` }}>
                      <p style={{ fontSize: 9, color: muted, marginBottom: 6, textTransform: "uppercase" as const, letterSpacing: 1 }}>
                        Narrator Audio {narratorAudioDuration > 0 && `— ${Math.round(narratorAudioDuration / 1000)}s`}
                      </p>
                      <audio controls src={narratorAudioUrl} style={{ width: "100%", height: 36 }} />
                    </div>
                  )}
                </div>
              )}

              {/* ── VOICE LAYERS — multi-part narrator stacking ── */}
              <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, background: "#ffffff03", border: `1px solid ${border}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>Voice Layers</p>
                    <p style={{ fontSize: 9, color: muted, marginTop: 2 }}>Layer 1 = primary narrator. Add layers for secondary voice tracks (mixing wired in S14).</p>
                  </div>
                  <button onClick={addVoiceLayer} disabled={voiceLayers.length >= 4}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${accent}40`, background: `${accent}08`, color: accent, fontSize: 10, fontWeight: 700, cursor: voiceLayers.length >= 4 ? "not-allowed" : "pointer", opacity: voiceLayers.length >= 4 ? 0.5 : 1 }}>
                    + Layer
                  </button>
                </div>
                {voiceLayers.map(layer => (
                  <div key={layer.layer} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", borderRadius: 8, background: surface, border: `1px solid ${border}`, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: muted, minWidth: 20 }}>L{layer.layer}</span>
                    <select value={layer.providerId} onChange={e => updateVoiceLayer(layer.layer, { providerId: e.target.value as VoiceLayer["providerId"] })}
                      style={{ ...inputStyle, flex: 1, fontSize: 10, padding: "5px 8px" }}>
                      <option value="piper" style={{ background: surface }}>Piper (free)</option>
                      <option value="edge-tts" style={{ background: surface }}>Edge Neural (free)</option>
                      <option value="fal-narrator" style={{ background: surface }}>FAL Standard</option>
                      <option value="fal-narrator-gemini" style={{ background: surface }}>FAL Pro</option>
                      <option value="elevenlabs" style={{ background: surface }}>ElevenLabs</option>
                      <option value="karaoke" style={{ background: surface }}>Karaoke</option>
                    </select>
                    <input value={layer.voiceId} onChange={e => updateVoiceLayer(layer.layer, { voiceId: e.target.value })}
                      placeholder={layer.providerId === "piper" ? "en_US-lessac-medium" : layer.providerId === "edge-tts" ? "en-NG-EzinneNeural" : layer.providerId === "fal-narrator" ? "af_sky" : layer.providerId === "fal-narrator-gemini" ? "af_sky" : "voice-id"}
                      style={{ ...inputStyle, flex: 2, fontSize: 10, padding: "5px 8px" }} />
                    {layer.layer > 1 && (
                      <button onClick={() => removeVoiceLayer(layer.layer)}
                        style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid #ef444430`, background: "#ef444408", color: red, fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                        X
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* ── CHARACTER VOICES — pick Piper model per character ── */}
              {(storyMode === "mixed" || storyMode === "actors-only") && characters.length > 0 && (
                <div style={{ marginTop: 14, padding: "14px 16px", borderRadius: 12, background: `${purple}08`, border: `1px solid ${purple}25` }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Character Voices</p>
                  <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>
                    Pick a Piper voice for each character. Their dialogue lines will be spoken in their assigned voice when you click Generate.
                  </p>

                  {/* Voice picker per character */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                    {characters.map(char => {
                      const assigned = characterPiperVoices[char.characterId] || "en_US-lessac-medium";
                      const hasAudio = !!characterAudioUrls[char.characterId];
                      const dialogueCount = scriptSegments.filter(s =>
                        s.type === "dialogue" && (
                          s.characterId === char.characterId ||
                          s.speaker?.toLowerCase() === char.displayName.toLowerCase() ||
                          s.speaker?.toLowerCase().includes(char.displayName.toLowerCase().split(" ")[0].toLowerCase())
                        )
                      ).length;
                      return (
                        <div key={char.characterId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 9, background: surface, border: `1px solid ${hasAudio ? purple + "50" : border}` }}>
                          {/* Character icon */}
                          <div style={{ width: 32, height: 32, borderRadius: 8, overflow: "hidden", flexShrink: 0, background: s2 }}>
                            {char.imageUrl
                              ? <img src={char.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                              : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.User style={{ width: 14, height: 14, color: muted }} /></div>
                            }
                          </div>
                          {/* Name + line count */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0 }}>{char.displayName}</p>
                            <p style={{ fontSize: 9, color: muted, margin: 0 }}>{dialogueCount} dialogue line{dialogueCount !== 1 ? "s" : ""}{hasAudio ? " · Audio ready" : ""}</p>
                          </div>
                          {/* Voice selector */}
                          <select
                            value={assigned}
                            onChange={e => setCharacterPiperVoices(prev => ({ ...prev, [char.characterId]: e.target.value }))}
                            style={{ ...inputStyle, fontSize: 10, padding: "5px 8px", minWidth: 160 }}>
                            <option value="en_US-lessac-medium">Lessac (Neutral Male)</option>
                            <option value="en_US-ryan-high">Ryan (Clear Male)</option>
                            <option value="en_US-amy-medium">Amy (Female)</option>
                            <option value="en_US-hfc_female-medium">HFC (Female)</option>
                            <option value="en_GB-alan-medium">Alan (British Male)</option>
                            <option value="en_GB-cori-high">Cori (British Female)</option>
                            <option value="en_US-libritts-high">LibriTTS (Narration)</option>
                          </select>
                          {/* Play if generated */}
                          {hasAudio && (
                            <audio controls src={characterAudioUrls[char.characterId]} style={{ height: 28, width: 120 }} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Generate button */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <button
                      onClick={generatePerLineVoices}
                      disabled={generatingCharVoices || scriptSegments.length === 0}
                      style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: generatingCharVoices ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 11, fontWeight: 700, cursor: generatingCharVoices ? "not-allowed" : "pointer" }}>
                      {generatingCharVoices ? "Generating..." : scriptSegments.some(s => s.type === "dialogue" && s.audioUrl) ? "Regen Per-Line Voices" : "Generate Per-Line Voices"}
                    </button>
                    {scriptSegments.length === 0 && (
                      <span style={{ fontSize: 10, color: gold }}>Parse script first (Script tab)</span>
                    )}
                    {scriptSegments.some(s => s.type === "dialogue" && s.audioUrl) && (
                      <span style={{ fontSize: 10, color: "#22c55e" }}>{scriptSegments.filter(s => s.type === "dialogue" && s.audioUrl).length} per-line clips ready</span>
                    )}
                  </div>
                  {charVoiceLog && (
                    <p style={{ fontSize: 10, color: charVoiceLog.startsWith("[!]") ? gold : charVoiceLog.length > 5 ? "#22c55e" : accent, marginTop: 8 }}>{charVoiceLog}</p>
                  )}
                </div>
              )}

              {/* Script review — segment list */}
              {showScriptReview && scriptSegments.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Script Segments</p>
                    <button onClick={() => setShowScriptReview(false)}
                      style={{ fontSize: 9, color: muted, background: "transparent", border: "none", cursor: "pointer" }}>Hide</button>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                    {scriptSegments.map((seg, i) => {
                      const isNarration = seg.type === "narration";
                      const charColor = isNarration ? blue : purple;
                      const charObj = characters.find(c => c.displayName.toLowerCase() === seg.speaker.toLowerCase());
                      return (
                        <div key={seg.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8,
                          background: isNarration ? `${blue}07` : `${purple}07`,
                          border: `1px solid ${charColor}20` }}>
                          {/* Speaker badge */}
                          <div style={{ flexShrink: 0, minWidth: 64 }}>
                            <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                              background: `${charColor}20`, color: charColor }}>
                              {isNarration ? "NARRATOR" : seg.speaker.toUpperCase()}
                            </span>
                            {charObj?.voiceType && (
                              <p style={{ fontSize: 7, color: muted, marginTop: 3 }}>{charObj.voiceType}</p>
                            )}
                          </div>
                          {/* Text */}
                          <p style={{ fontSize: 11, color: isNarration ? "rgba(255,255,255,0.75)" : "#fff",
                            lineHeight: 1.5, flex: 1, fontStyle: isNarration ? "italic" : "normal" }}>
                            {seg.text}
                          </p>
                          {/* Reassign speaker */}
                          {!isNarration && characters.length > 0 && (
                            <select
                              value={seg.speaker}
                              onChange={e => setScriptSegments(prev => prev.map((s, j) => j === i ? { ...s, speaker: e.target.value } : s))}
                              style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, color: "#fff",
                                fontSize: 9, padding: "2px 6px", cursor: "pointer", flexShrink: 0 }}>
                              {characters.map((c, ci) => <option key={`${c.characterId}_${ci}`} value={c.displayName} style={{ background: surface }}>{c.displayName}</option>)}
                              <option value="Unknown" style={{ background: surface }}>Unknown</option>
                            </select>
                          )}
                          {/* Flip narration ↔ dialogue */}
                          <button
                            onClick={() => setScriptSegments(prev => prev.map((s, j) => j === i
                              ? { ...s, type: s.type === "narration" ? "dialogue" : "narration", speaker: s.type === "narration" ? (characters[0]?.displayName || "Character") : "narrator" }
                              : s))}
                            title="Flip narration ↔ dialogue"
                            style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
                              color: muted, fontSize: 9, padding: "2px 7px", cursor: "pointer", flexShrink: 0 }}>
                            ⇄
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Assign Characters Panel — always visible on story tab ─── */}
          <div style={{ ...cardStyle, borderColor: `${purple}25` }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>Assign Characters</h3>
                  <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                    {characters.length > 0 ? `${characters.length} character(s) in cast` : "Add characters to this story"}
                  </p>
                </div>
                {/* Mode toggle */}
                <div style={{ display: "flex", gap: 4, background: "#ffffff08", borderRadius: 8, padding: 3, flexShrink: 0 }}>
                  {(["manual", "ai"] as const).map(m => (
                    <button key={m} onClick={() => setCharAssignMode(m)}
                      style={{ padding: "5px 14px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                        background: charAssignMode === m ? purple : "transparent",
                        color: charAssignMode === m ? "#fff" : muted }}>
                      {m === "manual" ? "Manual" : "AI Detect"}
                    </button>
                  ))}
                </div>
              </div>

              {/* Cast so far */}
              {characters.length > 0 && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                  {characters.map((c, ci) => (
                    <div key={`${c.characterId}_${ci}`} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px 4px 10px", borderRadius: 20, background: `${purple}12`, border: `1px solid ${purple}30` }}>
                      {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />}
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#fff" }}>{c.displayName}</span>
                      {c.voiceType && <span style={{ fontSize: 8, color: purple }}>{c.voiceType}</span>}
                      {!c.voiceType && <span style={{ fontSize: 8, color: red }}>no voice</span>}
                      <button onClick={() => setCharacters(prev => prev.filter(x => x.characterId !== c.characterId))}
                        title="Remove from cast"
                        style={{ background: "transparent", border: "none", color: muted, fontSize: 11, cursor: "pointer", padding: "0 2px", lineHeight: 1, marginLeft: 2 }}>×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* ─── MANUAL MODE ─── */}
              {charAssignMode === "manual" && (
                <div>
                  {manualCharInputs.map((inp, idx) => (
                    <div key={inp.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <input
                        value={inp.name}
                        onChange={e => setManualCharInputs(prev => prev.map(p => p.id === inp.id ? { ...p, name: e.target.value } : p))}
                        placeholder={`Character name (e.g. Josh, Ada…)`}
                        style={{ ...inputStyle, flex: 1, padding: "8px 12px", fontSize: 12 }}
                        onKeyDown={e => { if (e.key === "Enter" && inp.name.trim()) buildCharacterInline(inp.name.trim()); }}
                      />
                      <button
                        onClick={() => { if (inp.name.trim()) buildCharacterInline(inp.name.trim()); }}
                        disabled={!inp.name.trim() || inlineCreatingId === inp.name}
                        style={{ padding: "8px 14px", borderRadius: 8, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                          background: (!inp.name.trim() || inlineCreatingId === inp.name) ? "#2a2a40" : purple, color: "#fff" }}>
                        {inlineCreatingId === inp.name ? "Building..." : "Create"}
                      </button>
                      <button
                        onClick={() => setShowCharacterPicker(true)}
                        style={{ padding: "8px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", fontSize: 10, fontWeight: 600, color: muted, cursor: "pointer" }}>
                        Import
                      </button>
                      {manualCharInputs.length > 1 && (
                        <button onClick={() => setManualCharInputs(prev => prev.filter(p => p.id !== inp.id))}
                          style={{ padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: red, fontSize: 10, cursor: "pointer" }}><Icon.X style={{ width: 12, height: 12 }} /></button>
                      )}
                    </div>
                  ))}
                  <button onClick={() => setManualCharInputs(prev => [...prev, { id: `m${Date.now()}`, name: "" }])}
                    style={{ fontSize: 10, color: muted, background: "transparent", border: `1px dashed ${border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer" }}>
                    + Add another character
                  </button>
                </div>
              )}

              {/* ─── AI DETECT MODE ─── */}
              {charAssignMode === "ai" && (
                <div>
                  {aiDetectedNames.length === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", borderRadius: 10, background: `${purple}08`, border: `1px solid ${purple}20` }}>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 3 }}>Detect Characters from Story</p>
                        <p style={{ fontSize: 10, color: muted }}>AI scans your story text and lists every character it finds. You then build each one with one click.</p>
                      </div>
                      <button onClick={detectCharactersFromStory} disabled={detectingChars}
                        style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: detectingChars ? "#2a2a40" : purple, color: "#fff", fontSize: 11, fontWeight: 700, cursor: detectingChars ? "not-allowed" : "pointer", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                        {detectingChars ? "Scanning..." : "Detect"}
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                        <p style={{ fontSize: 10, color: muted }}>{aiDetectedNames.length} character(s) found in story — not yet in cast</p>
                        <button onClick={() => setAiDetectedNames([])} style={{ fontSize: 9, color: muted, background: "transparent", border: "none", cursor: "pointer" }}>Clear</button>
                      </div>
                      {aiDetectedNames.map((det, i) => {
                        const alreadyAdded = characters.some(c => c.displayName.toLowerCase() === det.name.toLowerCase());
                        return (
                          <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, background: "#ffffff05", border: `1px solid ${border}`, marginBottom: 6 }}>
                            <div style={{ flex: 1 }}>
                              <p style={{ fontSize: 12, fontWeight: 700, color: alreadyAdded ? accent : "#fff" }}>{det.name} {alreadyAdded && "(added)"}</p>
                              {det.description && <p style={{ fontSize: 9, color: muted, marginTop: 2, lineHeight: 1.4 }}>{det.description.slice(0, 80)}</p>}
                            </div>
                            {!alreadyAdded && (
                              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                                <button onClick={() => buildCharacterInline(det.name)} disabled={inlineCreatingId === det.name}
                                  style={{ padding: "6px 14px", borderRadius: 8, border: "none", fontSize: 10, fontWeight: 700, cursor: inlineCreatingId === det.name ? "not-allowed" : "pointer",
                                    background: inlineCreatingId === det.name ? "#2a2a40" : purple, color: "#fff" }}>
                                  {inlineCreatingId === det.name ? "Building..." : "Create"}
                                </button>
                                <button onClick={() => setShowCharacterPicker(true)}
                                  style={{ padding: "6px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", fontSize: 10, color: muted, cursor: "pointer" }}>
                                  Import
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      <button onClick={detectCharactersFromStory} disabled={detectingChars}
                        style={{ fontSize: 10, color: muted, background: "transparent", border: `1px dashed ${border}`, borderRadius: 8, padding: "6px 14px", cursor: "pointer", marginTop: 6 }}>
                        {detectingChars ? "Re-scanning..." : "Re-scan story"}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* ─── INLINE PREVIEW — appears after Create ─── */}
              {inlinePreview && (
                <div style={{ marginTop: 16, padding: 14, borderRadius: 12, background: `${purple}08`, border: `1px solid ${purple}30` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                    <Icon.User style={{ width: 16, height: 16 }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{inlinePreview.displayName}</p>
                      <p style={{ fontSize: 10, color: muted }}>{inlinePreview.roleType} · {inlinePreview.gender} · {inlinePreview.ageRange}</p>
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={acceptInlineCharacter}
                        style={{ padding: "7px 18px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>Add to Cast</button>
                      <button onClick={() => buildCharacterInline(inlinePreview.displayName)}
                        style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                        Rebuild
                      </button>
                      <button onClick={() => setInlinePreview(null)}
                        style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: red, fontSize: 10, cursor: "pointer" }}><Icon.X style={{ width: 12, height: 12 }} /></button>
                    </div>
                  </div>
                  {/* Profile details */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 8 }}>
                    {[
                      ["Species", inlinePreview.species],
                      ["Build", inlinePreview.bodyBuild],
                      ["Colours", inlinePreview.colorDescription],
                      ["Face", inlinePreview.faceFeatures],
                      ["Clothing", inlinePreview.clothingDetails],
                      ["Accessories", inlinePreview.accessories],
                      ["Distinctive", inlinePreview.distinctiveFeatures],
                    ].filter(([, v]) => v && v !== "not specified" && v !== "none").map(([label, value]) => (
                      <div key={label as string} style={{ padding: "6px 8px", borderRadius: 6, background: "#ffffff05" }}>
                        <p style={{ fontSize: 8, color: muted, fontWeight: 600, textTransform: "uppercase" as const, marginBottom: 2 }}>{label}</p>
                        <p style={{ fontSize: 10, color: "#fff", lineHeight: 1.4 }}>{value}</p>
                      </div>
                    ))}
                  </div>
                  {/* Voice preview */}
                  <div style={{ marginTop: 8, padding: "8px 10px", borderRadius: 8, background: "#0a1a0a", border: `1px solid #4ade8030`, display: "flex", alignItems: "center", gap: 10 }}>
                    <Icon.Mic style={{ width: 14, height: 14 }} />
                    <div>
                      <p style={{ fontSize: 9, color: muted, fontWeight: 600, textTransform: "uppercase" as const }}>Voice Profile</p>
                      <p style={{ fontSize: 11, color: "#4ade80" }}>
                        {inlinePreview.voiceType} voice · {inlinePreview.intonation} · {inlinePreview.speechStyle}
                        {inlinePreview.voiceId && <span style={{ color: muted }}> (voice assigned)</span>}
                        {!inlinePreview.voiceId && <span style={{ color: gold }}> (no ElevenLabs voice — assign in Characters tab)</span>}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

          {/* Draft Zone */}
          <div style={cardStyle}>
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Draft Zone — Unfinished Work</p>
            {scenes.filter(s => s.status === "draft" || !s.status).length > 0 ? (
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>{draftScenes} scenes in draft</p>
                {scenes.filter(s => s.status === "draft" || !s.status).map(s => (
                  <div key={s.sceneId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: s2, marginBottom: 4, border: `1px solid ${border}` }}>
                    <span style={badgeStyle(gold)}>{s.sceneId}</span>
                    <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>{s.title}</p>
                    <span style={{ fontSize: 9, color: muted }}>{sceneImages[s.sceneId] ? "has image" : "no image"}</span>
                    <button onClick={() => { setActiveTab("scenes"); setSelectedScene(s.scene); }}
                      style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: blue, fontSize: 9, cursor: "pointer" }}>Open</button>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ fontSize: 11, color: muted }}>{scenes.length === 0 ? "No scenes created yet." : "All scenes reviewed or approved!"}</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCRIPT TAB — Parse story into segments, edit dialogue, lock script  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "script" && (
        <div>
          <div style={cardStyle}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Script & Scene Breakdown</h2>
            <p style={{ fontSize: 11, color: muted, marginBottom: 18 }}>
              Parse your story into narrator lines and character dialogue. Edit segments, assign speakers, then lock the script before Sound.
            </p>

            {!(expandedSummary || idea.trim()) && (
              <div style={{ padding: "20px 24px", borderRadius: 12, background: `${gold}08`, border: `1px solid ${gold}30`, textAlign: "center" }}>
                <p style={{ fontSize: 13, color: gold, fontWeight: 600, marginBottom: 8 }}>Write your story first</p>
                <p style={{ fontSize: 11, color: muted, marginBottom: 14 }}>Go to the Story tab and write or expand your story idea before parsing.</p>
                <button onClick={() => setActiveTab("story")}
                  style={{ padding: "9px 22px", borderRadius: 10, border: "none", background: gold, color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  Go to Story
                </button>
              </div>
            )}

            {(expandedSummary || idea.trim()) && (
              <div>
                {/* Parse button + status */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                      {scriptSegments.length > 0
                        ? storyMode === "narration-only" ? "Narrator only — no character dialogue detected"
                          : storyMode === "actors-only" ? "Actors only — no narration passages detected"
                          : `Mixed — ${scriptSegments.filter(s => s.type === "narration").length} narrator + ${scriptSegments.filter(s => s.type === "dialogue").length} dialogue segments`
                        : "Ready to parse"}
                    </p>
                    <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>
                      Parse Script splits your story into narrator lines vs character dialogue.
                    </p>
                  </div>
                  <button onClick={parseScript} disabled={parsingScript}
                    style={{ padding: "8px 18px", borderRadius: 10, border: "none", fontSize: 11, fontWeight: 700, cursor: parsingScript ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const,
                      background: parsingScript ? "#2a2a40" : `linear-gradient(135deg, ${blue}, #0066aa)`, color: "#fff" }}>
                    {parsingScript ? "Parsing..." : scriptSegments.length > 0 ? "Re-parse Script" : "Parse Story into Script"}
                  </button>
                </div>

                {/* 4-B: Review Dialogue Lines button */}
                {scriptSegments.filter(s => s.type === "dialogue").length > 0 && (
                  <button
                    onClick={() => setShowDialogueReview(true)}
                    style={{ marginBottom: 10, padding: "7px 16px", borderRadius: 8, border: `1px solid ${border}`, background: "#1a1a30", color: "#ddd", fontSize: 10, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Review Dialogue Lines ({scriptSegments.filter(s => s.type === "dialogue").length})
                  </button>
                )}

                {/* Story mode badges */}
                {scriptSegments.length > 0 && (
                  <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
                    {(["narration-only", "actors-only", "mixed"] as const).map(m => (
                      <button key={m} onClick={() => setStoryMode(m)}
                        style={{ padding: "4px 12px", borderRadius: 20, border: `1px solid ${storyMode === m ? blue : border}`,
                          background: storyMode === m ? `${blue}18` : "transparent",
                          color: storyMode === m ? blue : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        {m === "narration-only" ? "Narrator Only" : m === "actors-only" ? "Actors Only" : "Mixed"}
                      </button>
                    ))}
                  </div>
                )}

                {/* Script segment list */}
                {scriptSegments.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>Script Segments</p>
                    </div>
                    <div style={{ maxHeight: 400, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
                      {scriptSegments.map((seg, i) => {
                        const isNarration = seg.type === "narration";
                        const charColor = isNarration ? blue : purple;
                        const charObj = characters.find(c => c.displayName.toLowerCase() === seg.speaker.toLowerCase());
                        return (
                          <div key={seg.id} style={{ display: "flex", gap: 8, padding: "8px 10px", borderRadius: 8,
                            background: isNarration ? `${blue}07` : `${purple}07`,
                            border: `1px solid ${charColor}20` }}>
                            <div style={{ flexShrink: 0, minWidth: 64 }}>
                              <span style={{ fontSize: 8, fontWeight: 700, padding: "2px 7px", borderRadius: 20,
                                background: `${charColor}20`, color: charColor }}>
                                {isNarration ? "NARRATOR" : seg.speaker.toUpperCase()}
                              </span>
                              {charObj?.voiceType && (
                                <p style={{ fontSize: 7, color: muted, marginTop: 3 }}>{charObj.voiceType}</p>
                              )}
                            </div>
                            <textarea
                              value={seg.text}
                              onChange={e => setScriptSegments(prev => prev.map((s, j) => j === i ? { ...s, text: e.target.value } : s))}
                              rows={2}
                              style={{ ...inputStyle, fontSize: 11, flex: 1, resize: "vertical", fontStyle: isNarration ? "italic" : "normal" }}
                            />
                            {!isNarration && characters.length > 0 && (
                              <select
                                value={seg.speaker}
                                onChange={e => setScriptSegments(prev => prev.map((s, j) => j === i ? { ...s, speaker: e.target.value } : s))}
                                style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, color: "#fff",
                                  fontSize: 9, padding: "2px 6px", cursor: "pointer", flexShrink: 0 }}>
                                {characters.map((c, ci) => <option key={`${c.characterId}_${ci}`} value={c.displayName} style={{ background: surface }}>{c.displayName}</option>)}
                                <option value="Unknown" style={{ background: surface }}>Unknown</option>
                              </select>
                            )}
                            <button
                              onClick={() => setScriptSegments(prev => prev.map((s, j) => j === i
                                ? { ...s, type: s.type === "narration" ? "dialogue" : "narration", speaker: s.type === "narration" ? (characters[0]?.displayName || "Character") : "narrator" }
                                : s))}
                              title="Flip narration / dialogue"
                              style={{ background: "transparent", border: `1px solid ${border}`, borderRadius: 6,
                                color: muted, fontSize: 9, padding: "2px 7px", cursor: "pointer", flexShrink: 0 }}>
                              ⇄
                            </button>
                            <button
                              onClick={() => setScriptSegments(prev => prev.filter((_, j) => j !== i))}
                              title="Delete segment"
                              style={{ background: "transparent", border: `1px solid #ef444430`, borderRadius: 6,
                                color: red, fontSize: 9, padding: "2px 7px", cursor: "pointer", flexShrink: 0 }}>
                              ×
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Lock Script → proceed to Sound */}
                {scriptSegments.length > 0 && (
                  <div style={{ display: "flex", gap: 10, paddingTop: 12, borderTop: `1px solid ${border}` }}>
                    <button
                      onClick={async () => {
                        // Save scriptSegments to DB via saved-state
                        if (projectId) {
                          try {
                            await fetch("/api/hybrid/saved-state", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ projectId, key: "scriptSegments", value: scriptSegments }),
                            });
                          } catch { /* non-blocking */ }
                        }
                        setActiveTab("audio");
                      }}
                      style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${blue}, #0066aa)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                      Lock Script and go to Sound
                    </button>
                  </div>
                )}

                {scriptSegments.length === 0 && (
                  <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: "20px 0" }}>
                    Click "Parse Story into Script" to begin.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* AUDIO & SHOTS TAB                                                   */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "audio" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff" }}>Audio & Shot Planning</h2>
            <div style={{ display: "flex", gap: 8 }}>
              <a href="/dashboard/asset-library" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                <button style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${accent}30`, background: `${accent}06`, color: accent, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Asset Library
                </button>
              </a>
              <button onClick={runAutoTimestamp} disabled={loadingAutoTimestamp}
                style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${"#7c5cfc"}30`, background: `${"#7c5cfc"}08`, color: "#7c5cfc", fontSize: 11, fontWeight: 600, cursor: loadingAutoTimestamp ? "not-allowed" : "pointer" }}>
                {loadingAutoTimestamp ? "Timestamping..." : "Auto Time Stamp"}
              </button>
              <button onClick={generateAudioPlans} disabled={loadingAudioPlan}
                style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${gold}30`, background: `${gold}06`, color: gold, fontSize: 11, fontWeight: 600, cursor: loadingAudioPlan ? "not-allowed" : "pointer" }}>
                {loadingAudioPlan ? "Generating..." : "Auto Audio Plans"}
              </button>
              <button onClick={generateShotPlans} disabled={loadingShotPlan}
                style={{ padding: "10px 18px", borderRadius: 10, border: `1px solid ${purple}30`, background: `${purple}06`, color: purple, fontSize: 11, fontWeight: 600, cursor: loadingShotPlan ? "not-allowed" : "pointer" }}>
                {loadingShotPlan ? "Generating..." : "Auto Shot Plans"}
              </button>
            </div>
          </div>

          {/* ── Sound Tier Selector — 4-tier GHS tier picker (always visible in Sound tab) ── */}
          <div style={{ ...cardStyle, borderColor: `${accent}20`, marginBottom: 16 }} data-testid="sound-tier-card">
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 4 }}>Sound Tier</p>
            <p style={{ fontSize: 9, color: muted, marginBottom: 12 }}>
              Selects narration provider and music generator. GHS Sound = free local. GHS Plus = Karaoke pipeline. GHS Pro = Karaoke + FAL music (FAL_KEY). GHS Premium = Kie Suno V5 (KIE_AI_API_KEY).
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 12 }}>
              {([
                { id: "ghs-sound",   label: "GHS Sound",   sub: "Piper · Free",         color: accent },
                { id: "ghs-plus",    label: "GHS Plus",    sub: "Karaoke · Built-in",   color: gold },
                { id: "ghs-pro",     label: "GHS Pro",     sub: "Karaoke + FAL",        color: blue },
                { id: "ghs-premium", label: "GHS Premium", sub: "Kie Suno V5",          color: purple },
              ] as const).map(tier => (
                <button
                  key={tier.id}
                  data-tier={tier.id}
                  onClick={() => {
                    setSoundTier(tier.id);
                    patchProjectSettings({ soundTier: tier.id }).catch(() => {});
                    // Sync narratorVoice to the tier's narration provider
                    if (tier.id === "ghs-sound") setNarratorVoice("piper");
                    else if (tier.id === "ghs-plus" || tier.id === "ghs-pro") setNarratorVoice("karaoke");
                    else if (tier.id === "ghs-premium") setNarratorVoice("kie-suno");
                  }}
                  style={{
                    padding: "10px 8px",
                    borderRadius: 10,
                    border: `1px solid ${effectiveSoundTier === tier.id ? tier.color : border}`,
                    background: effectiveSoundTier === tier.id ? `${tier.color}18` : "transparent",
                    color: effectiveSoundTier === tier.id ? tier.color : muted,
                    cursor: "pointer",
                    textAlign: "center" as const,
                    display: "flex",
                    flexDirection: "column" as const,
                    alignItems: "center",
                    gap: 3,
                  }}>
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{tier.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.8 }}>{tier.sub}</span>
                </button>
              ))}
            </div>

            {/* Narration Provider — advanced override (collapsed under tier selector) */}
            <details>
              <summary style={{ fontSize: 9, color: muted, cursor: "pointer", marginBottom: 8, userSelect: "none" as const }}>
                Advanced: override narration provider
              </summary>
              <p style={{ fontSize: 9, color: muted, marginBottom: 8, marginTop: 6 }}>Override the tier&apos;s default narration provider. GHS Sound = Piper TTS (free). GHS Plus/Pro = GHS Karaoke. GHS Premium = Kie Suno + Piper fallback. ElevenLabs = premium (ELEVENLABS_API_KEY).</p>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                {([
                  { id: "piper",               label: "Piper TTS",   color: accent },
                  { id: "edge-tts",            label: "Edge Neural (free)", color: "#34d399" },
                  { id: "karaoke",             label: "Karaoke",     color: gold },
                  { id: "kie-suno",            label: "Kie Suno",    color: purple },
                  { id: "fal-narrator",        label: "FAL Standard", color: blue },
                  { id: "fal-narrator-gemini", label: "FAL Pro",     color: "#4ECDC4" },
                  { id: "elevenlabs",          label: "ElevenLabs",  color: "#ff6b6b" },
                  { id: "none",                label: "None",        color: muted },
                ] as const).map(v => (
                  <button key={v.id} onClick={() => setNarratorVoice(v.id)}
                    data-provider={v.id}
                    style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${narratorVoice === v.id ? v.color : border}`,
                      background: narratorVoice === v.id ? `${v.color}15` : "transparent",
                      color: narratorVoice === v.id ? v.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </details>
          </div>

          {/* ── Auto Time Stamp Results ─────────────────────────────────────── */}
          {autoTimestampPlan && (
            <div style={{ ...cardStyle, borderColor: "#7c5cfc40", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  Auto Time Stamp Plan
                  <span style={{ fontSize: 10, color: "#7c5cfc", marginLeft: 10, fontFamily: "var(--font-mono, monospace)" }}>
                    {autoTimestampPlan.segmentCount} segments · {autoTimestampPlan.totalDuration.toFixed(1)}s
                  </span>
                </h3>
                <button onClick={() => setAutoTimestampPlan(null)}
                  style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                  Clear
                </button>
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {autoTimestampPlan.segments.map((seg) => (
                  <div key={seg.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 12px", borderRadius: 8, background: "#7c5cfc08", border: "1px solid #7c5cfc18" }}>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "#7c5cfc", whiteSpace: "nowrap" as const, minWidth: 90 }}>
                      {seg.startTime.toFixed(1)}s – {seg.endTime.toFixed(1)}s
                    </span>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", margin: 0, marginBottom: 2 }}>{seg.title}</p>
                      <p style={{ fontSize: 10, color: muted, margin: 0, lineHeight: 1.4 }}>{seg.narrationText.slice(0, 100)}{seg.narrationText.length > 100 ? "…" : ""}</p>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 9, color: muted, whiteSpace: "nowrap" as const }}>{seg.duration.toFixed(1)}s</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Auto SFX toggle ── */}
          <div data-testid="auto-sfx-toggle" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: surface, border: `1px solid ${autoSfx ? `${blue}40` : border}`, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Auto SFX</p>
              <p style={{ fontSize: 10, color: muted }}>AI picks SFX for each scene from its description. Searches local library first, then FAL stable-audio.</p>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
              {autoSfx && (
                autoSfxRunning ? (
                  <button data-testid="cancel-auto-sfx-btn" onClick={cancelAutoSfx}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "1px solid #ef444440", background: "#ef444410", color: "#ef4444", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                    Cancel SFX
                  </button>
                ) : (
                  <button data-testid="run-auto-sfx-btn" onClick={runAutoSfxForAllScenes} disabled={scenes.length === 0}
                    style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 10, fontWeight: 700, cursor: scenes.length === 0 ? "not-allowed" : "pointer" }}>
                    {`Run Auto SFX (${scenes.length} scenes)`}
                  </button>
                )
              )}
              <button data-testid="auto-sfx-btn" onClick={() => { setAutoSfx(v => !v); setLastAction(`Auto SFX: ${!autoSfx ? "ON" : "OFF"}`); }}
                style={{ padding: "6px 16px", borderRadius: 8, border: `1px solid ${autoSfx ? `${blue}50` : border}`, background: autoSfx ? `${blue}20` : "transparent", color: autoSfx ? blue : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                {autoSfx ? "ON" : "OFF"}
              </button>
            </div>
          </div>
          {autoSfxRunning && autoSfxProgress && (
            <div style={{ marginTop: -8, marginBottom: 16, padding: "8px 16px", borderRadius: 8, background: `${blue}08`, border: `1px solid ${blue}20` }}>
              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 4 }}>
                Processing {autoSfxProgress.sceneId} ({autoSfxProgress.current}/{autoSfxProgress.total})
              </div>
              <div style={{ height: 4, background: "#1e293b", borderRadius: 2 }}>
                <div style={{ height: 4, background: blue, borderRadius: 2, width: `${(autoSfxProgress.current / autoSfxProgress.total) * 100}%`, transition: "width 0.3s" }} />
              </div>
            </div>
          )}

          {/* ── Sound Browser ──────────────────────────────────────────────── */}
          <div style={{ ...cardStyle, borderColor: `${blue}25`, marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Sound Browser</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 8, background: "#16a34a12", border: "1px solid #16a34a30" }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", flexShrink: 0 }} />
                <span style={{ fontSize: 9, color: "#4ade80", fontWeight: 700, fontFamily: "monospace" }}>GHS Inbuilt Library</span>
                <span style={{ fontSize: 9, color: muted }}>— all CC0, safe for commercial use</span>
              </div>
            </div>

            {/* Tab row */}
            <div style={{ display: "flex", gap: 4, background: "#ffffff06", borderRadius: 8, padding: 3, marginBottom: 14, width: "fit-content" }}>
              {([
                { id: "freesound",  label: "Freesound Library" },
                { id: "ai-sfx",    label: "AI Generate SFX" },
                { id: "upload",     label: "Upload Custom" },
              ] as const).map(t => (
                <button key={t.id} onClick={() => setSoundTab(t.id)}
                  style={{ padding: "6px 14px", borderRadius: 6, border: "none", fontSize: 10, fontWeight: 700, cursor: "pointer",
                    background: soundTab === t.id ? blue : "transparent", color: soundTab === t.id ? "#fff" : muted }}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* ── FREESOUND ── */}
            {soundTab === "freesound" && (
              <div>
                {fsNoKey && (
                  <div style={{ padding: "10px 14px", borderRadius: 8, background: `${gold}10`, border: `1px solid ${gold}30`, marginBottom: 12 }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: gold }}>FREESOUND_API_KEY not set</p>
                    <p style={{ fontSize: 10, color: muted, marginTop: 3 }}>
                      Get a free key in 2 min: go to{" "}
                      <a href="https://freesound.org/apiv2/apply/" target="_blank" rel="noopener noreferrer" style={{ color: blue }}>freesound.org/apiv2/apply</a>
                      {" "}→ register → copy your API key → add <code style={{ background: "#fff1", padding: "1px 5px", borderRadius: 3 }}>FREESOUND_API_KEY=your_key</code> to your .env file → restart server.
                    </p>
                  </div>
                )}
                <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                  <input value={fsQuery} onChange={e => setFsQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchFreesound()}
                    placeholder="Search sounds... e.g. rain, footsteps, crowd, thunder"
                    style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
                  <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                    style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: fsSearching ? "#2a2a40" : blue, color: "#fff", fontSize: 11, fontWeight: 700, cursor: fsSearching ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                    {fsSearching ? "Searching..." : "Search"}
                  </button>
                </div>

                {/* Quick search tags — Standard */}
                <div style={{ marginBottom: 6 }}>
                  <p style={{ fontSize: 9, color: muted, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 5 }}>Standard</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                    {["rain", "wind", "crowd", "footsteps", "fire", "ocean", "birds", "thunder", "door", "engine"].map(tag => (
                      <button key={tag} onClick={() => { setFsQuery(tag); searchFreesound(tag); }}
                        style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                {/* Quick search tags — Fun */}
                <div style={{ marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: gold, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 5 }}>Fun</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                    {["cartoon", "boing", "whoosh", "pop", "laugh", "silly", "bounce", "squeak", "comedy", "funny"].map(tag => (
                      <button key={tag} onClick={() => { setFsQuery(tag); searchFreesound(tag); }}
                        style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${gold}40`, background: `${gold}08`, color: gold, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Results */}
                {fsResults.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {fsResults.map(sound => (
                      <div key={sound.id} style={{ padding: "10px 12px", borderRadius: 10, background: s2, border: `1px solid ${border}` }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sound.name}</p>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 9, color: muted }}>{sound.duration}s</span>
                          {sound.licenseType === "CC0" && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#16a34a22", color: "#4ade80", fontWeight: 700 }}>Free</span>
                          )}
                          {sound.licenseType === "CC-BY" && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${blue}22`, color: blue, fontWeight: 700 }}>Attribution</span>
                          )}
                          {(sound.licenseType === "CC-BY-NC" || sound.licenseType === "OTHER") && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: "#dc262622", color: "#f87171", fontWeight: 700, textDecoration: "line-through" }}>Commercial Blocked</span>
                          )}
                          {!sound.licenseType && (
                            <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${blue}20`, color: blue, fontWeight: 700 }}>{sound.license}</span>
                          )}
                          <span style={{ fontSize: 9, color: muted }}>by {sound.username}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {/* Preview */}
                          <button onClick={() => setSfxPreviewId(sfxPreviewId === sound.id ? null : sound.id)}
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: `1px solid ${border}`, background: sfxPreviewId === sound.id ? `${blue}20` : "transparent", color: sfxPreviewId === sound.id ? blue : muted, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                            {sfxPreviewId === sound.id ? "Stop" : "Preview"}
                          </button>
                          {/* Save — blocked for CC BY-NC */}
                          <button
                            onClick={() => sound.safeForCommercial !== false && saveFreesound(sound)}
                            disabled={fsSaved.has(sound.id) || fsSaving === sound.id || sound.safeForCommercial === false}
                            title={sound.safeForCommercial === false ? "CC BY-NC — not safe for commercial use" : undefined}
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: "none", background: sound.safeForCommercial === false ? "#dc262622" : fsSaved.has(sound.id) ? `${accent}20` : fsSaving === sound.id ? "#2a2a40" : accent, color: sound.safeForCommercial === false ? "#f87171" : fsSaved.has(sound.id) ? accent : "#000", fontSize: 10, cursor: (fsSaved.has(sound.id) || fsSaving === sound.id || sound.safeForCommercial === false) ? "not-allowed" : "pointer", fontWeight: 700 }}>
                            {sound.safeForCommercial === false ? "Blocked" : fsSaved.has(sound.id) ? "Saved" : fsSaving === sound.id ? "Saving..." : "Save"}
                          </button>
                        </div>
                        {/* Hidden audio player — plays when preview active */}
                        {sfxPreviewId === sound.id && sound.previewUrl && (
                          <audio autoPlay src={sound.previewUrl} onEnded={() => setSfxPreviewId(null)}
                            style={{ width: "100%", marginTop: 6, height: 24 }} controls />
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {!fsSearching && fsResults.length === 0 && fsQuery && !fsNoKey && (
                  <p style={{ fontSize: 11, color: muted, textAlign: "center", padding: "16px 0" }}>No results — try a different keyword</p>
                )}
              </div>
            )}

            {/* ── AI GENERATE SFX ── */}
            {soundTab === "ai-sfx" && (
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Describe any sound in plain English — AI generates it via FAL stable-audio (free with FAL_KEY) or ElevenLabs (~100 credits per effect).</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={sfxDesc} onChange={e => setSfxDesc(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && generateElevenLabsSfx()}
                    placeholder='e.g. "wooden door creaking open slowly", "rain on tin roof", "crowd cheering"'
                    style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
                  <button onClick={() => { if (!sfxDesc.trim()) { setUiError("Type a sound description first — e.g. 'rain on tin roof'"); return; } generateElevenLabsSfx(); }}
                    disabled={sfxGenerating}
                    style={{ padding: "9px 18px", borderRadius: 10, border: "none", background: sfxGenerating ? "#2a2a40" : purple, color: "#fff", fontSize: 11, fontWeight: 700, cursor: sfxGenerating ? "not-allowed" : "pointer", whiteSpace: "nowrap" as const }}>
                    {sfxGenerating ? "Generating..." : "Generate"}
                  </button>
                </div>
                {/* Quick prompts */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {["door creaking", "glass breaking", "crowd applause", "thunder crack", "fire crackling", "clock ticking", "phone ringing", "car engine"].map(p => (
                    <button key={p} onClick={() => setSfxDesc(p)}
                      style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>
                      {p}
                    </button>
                  ))}
                </div>
                {sfxGeneratedUrl && (
                  <div style={{ padding: "10px 12px", borderRadius: 10, background: `${accent}08`, border: `1px solid ${accent}25` }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: accent, marginBottom: 6 }}>Generated — saved to SFX library</p>
                    <audio src={sfxGeneratedUrl} controls style={{ width: "100%", height: 28 }} />
                  </div>
                )}
              </div>
            )}

            {/* ── CUSTOM UPLOAD ── */}
            {soundTab === "upload" && (
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Upload your own MP3, WAV, OGG or FLAC files. Max 20MB. Saved to your SFX library instantly.</p>
                <label style={{ display: "block", padding: "24px", border: `2px dashed ${border}`, borderRadius: 12, textAlign: "center", cursor: "pointer", background: "#ffffff03" }}>
                  <p style={{ fontSize: 13, color: muted, marginBottom: 6 }}>Click to browse or drag & drop</p>
                  <p style={{ fontSize: 10, color: muted }}>MP3 · WAV · OGG · FLAC · max 20MB</p>
                  <input type="file" accept=".mp3,.wav,.ogg,.flac" multiple style={{ display: "none" }}
                    onChange={async e => {
                      const files = Array.from(e.target.files || []);
                      for (const file of files) {
                        const form = new FormData();
                        form.append("file", file);
                        form.append("name", file.name.replace(/\.[^.]+$/, ""));
                        const res = await fetch("/api/sfx/upload", { method: "POST", body: form });
                        const data = await res.json();
                        if (data.ok) setLastAction(`"${data.name}" uploaded to SFX library`);
                        else setUiError(data.error || "Upload failed");
                      }
                      e.target.value = "";
                    }} />
                </label>
              </div>
            )}
          </div>

          {scenes.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No scenes yet. Create scenes in the Scene Board first.</p>
              <button onClick={() => setActiveTab("scenes")} style={btnPrimary}>Go to Scene Board</button>
            </div>
          ) : scenes.map(scene => {
            const typeInfo = SCENE_TYPES.find(t => t.id === scene.sceneType);
            const isNarrationOpen = narrationScene === scene.scene;
            return (
              <div key={scene.sceneId} style={{ ...cardStyle, borderColor: `${typeInfo?.color || accent}20` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{scene.sceneId}: {scene.title}</p>
                      <span style={badgeStyle(typeInfo?.color || accent)}>{typeInfo?.label}</span>
                    </div>
                  </div>
                  <span style={{ fontSize: 10, color: muted }}>{scene.credits} cr</span>
                </div>

                {/* Audio plan */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 8, marginBottom: 10 }}>
                  <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                    <p style={{ fontSize: 8, color: gold, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Narration</p>
                    <p style={{ fontSize: 10, color: "#fff" }}>{scene.audioPlan?.narrationIntensity}</p>
                  </div>
                  <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                    <p style={{ fontSize: 8, color: purple, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>Music</p>
                    <input value={scene.audioPlan?.musicMood ?? ""} onChange={e => updateScene(scene.scene, { audioPlan: { ...(scene.audioPlan ?? {}), musicMood: e.target.value } })}
                      style={{ ...inputStyle, fontSize: 9, padding: "3px 6px" }} placeholder="e.g. suspense" />
                  </div>
                  <div style={{ background: s2, borderRadius: 8, padding: "8px 10px" }}>
                    <p style={{ fontSize: 8, color: blue, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>SFX</p>
                    <input value={(scene.audioPlan?.sfxList ?? []).join(", ")} onChange={e => updateScene(scene.scene, { audioPlan: { ...(scene.audioPlan ?? {}), sfxList: e.target.value.split(",").map(s => s.trim()).filter(Boolean) } })}
                      style={{ ...inputStyle, fontSize: 9, padding: "3px 6px" }} placeholder="footsteps, wind" />
                  </div>
                </div>

                {/* Narration controls toggle */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => setNarrationScene(isNarrationOpen ? null : scene.scene)}
                    style={{ flex: 1, padding: "8px", borderRadius: 8, border: `1px solid ${gold}20`, background: `${gold}04`, color: gold, fontSize: 10, fontWeight: 600, cursor: "pointer", textAlign: "left" as const }}>
                    {isNarrationOpen ? "Hide Narration Controls" : "Open Narration Controls"}
                  </button>
                  {scene.narrationScript && (
                    <button onClick={() => updateScene(scene.scene, { narrationScript: "" })}
                      style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 9, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                      Clear
                    </button>
                  )}
                </div>
                {isNarrationOpen && (
                  <div style={{ marginTop: 8 }}>
                    <NarrationControls narrationText={scene.narrationScript} onNarrationChange={text => updateScene(scene.scene, { narrationScript: text })}
                      onSettingsChange={settings => setNarrationSettings(prev => ({ ...prev, [scene.scene]: settings }))} initialSettings={narrationSettings[scene.scene]} compact />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* ASSEMBLY TAB                                                        */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "assembly" && (
        <div>
          {/* ── Open Saved Cuts — visible folder of all named cuts ── */}
          {savedCuts.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <button onClick={() => setShowCutsPanel(p => !p)}
                style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 12, border: `1px solid ${gold}30`, background: showCutsPanel ? `${gold}10` : `${gold}06`, color: gold, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Icon.Folder style={{ width: 16, height: 16 }} />
                <span>My Cuts ({savedCuts.length})</span>
                <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap", flex: 1 }}>
                  {savedCuts.map(c => (
                    <span key={c.name} style={{ fontSize: 9, padding: "1px 7px", borderRadius: 8, background: `${gold}20`, color: gold }}>{c.name}</span>
                  ))}
                </div>
                <span style={{ fontSize: 10, color: muted }}>{showCutsPanel ? "▲ Close" : "▼ Open"}</span>
              </button>

              {showCutsPanel && (
                <div style={{ background: surface, border: `1px solid ${gold}25`, borderRadius: 12, padding: 12, marginTop: 4, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                  {savedCuts.map((c, ci) => (
                    <div key={c.name} style={{ background: s2, borderRadius: 10, border: `2px solid ${assemblyName === c.name ? gold : border}`, padding: 10, cursor: "pointer", transition: "all 0.15s" }}
                      onClick={() => { setAssemblyName(c.name); setSelectedSceneIds(c.sceneIds); setAssemblyOrder(c.order); if (c.videoUrl) setAssembledVideoUrl(c.videoUrl); setShowCutsPanel(false); setLastAction(`Loaded cut: "${c.name}"`); }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                        <span style={{ fontSize: 14 }}>{c.videoUrl ? <Icon.Film style={{ width: 14, height: 14 }} /> : <Icon.Grid style={{ width: 14, height: 14 }} />}</span>
                        <p style={{ fontSize: 12, fontWeight: 700, color: assemblyName === c.name ? gold : "#fff", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</p>
                        <button onClick={e => { e.stopPropagation(); if (confirm(`Delete cut "${c.name}"?`)) setSavedCuts(prev => prev.filter((_, i) => i !== ci)); }}
                          style={{ padding: "1px 6px", borderRadius: 4, border: "none", background: "transparent", color: red, cursor: "pointer", display:"flex", alignItems:"center" }}><Icon.X style={{ width: 10, height: 10 }} /></button>
                      </div>
                      <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>{c.sceneIds.length} scene{c.sceneIds.length !== 1 ? "s" : ""}</p>
                      {/* Scene thumbnails */}
                      <div style={{ display: "flex", gap: 3, marginBottom: 6 }}>
                        {c.sceneIds.slice(0, 5).map(id => {
                          const img = sceneImages[id];
                          return (
                            <div key={id} style={{ width: 32, height: 22, borderRadius: 3, overflow: "hidden", background: "#000", flexShrink: 0 }}>
                              {img ? <img src={img} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", background: border }} />}
                            </div>
                          );
                        })}
                        {c.sceneIds.length > 5 && <span style={{ fontSize: 8, color: muted, alignSelf: "center" }}>+{c.sceneIds.length - 5}</span>}
                      </div>
                      {/* Assembled video */}
                      {c.videoUrl && (
                        <div style={{ padding: "4px 8px", borderRadius: 6, background: `${accent}10`, border: `1px solid ${accent}20` }}>
                          <p style={{ fontSize: 8, color: accent, fontWeight: 600 }}>Video assembled{c.assembledAt ? ` · ${new Date(c.assembledAt).toLocaleDateString()}` : ""}</p>
                        </div>
                      )}
                      {assemblyName === c.name && <p style={{ fontSize: 8, color: gold, marginTop: 4, fontWeight: 600 }}>← Currently loaded</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}


          {/* ── Library Panel — always visible when items exist, at top so easy to find ── */}
          {archivedScenes.length > 0 && (
            <div style={{ background: `${gold}08`, border: `2px solid ${gold}30`, borderRadius: 14, padding: 14, marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: gold, marginBottom: 10 }}>
                Library — {archivedScenes.length} scene{archivedScenes.length > 1 ? "s" : ""} waiting — click to bring back
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {archivedScenes.map((a, idx) => (
                  <div key={idx} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: surface, border: `1px solid ${gold}25` }}>
                    {/* Thumbnail */}
                    <div style={{ width: 64, height: 42, borderRadius: 6, overflow: "hidden", background: "#000", flexShrink: 0, cursor: a.imageUrl ? "zoom-in" : "default" }}
                      onMouseEnter={e => { if (a.imageUrl) setHoverPreview({ src: a.imageUrl, x: e.clientX, y: e.clientY }); }}
                      onMouseMove={e => { if (a.imageUrl) setHoverPreview({ src: a.imageUrl, x: e.clientX, y: e.clientY }); }}
                      onMouseLeave={() => setHoverPreview(null)}>
                      {a.imageUrl
                        ? <img src={a.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Film style={{ width: 18, height: 18, opacity: 0.3, color: muted }} /></div>
                      }
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.scene.title}</p>
                      <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
                        {a.imageUrl && <span style={{ fontSize: 8, color: accent }}>Image</span>}
                        {a.videoUrl && <span style={{ fontSize: 8, color: purple }}>Video</span>}
                        <span style={{ fontSize: 8, color: muted }}>{a.scene.sceneType}</span>
                      </div>
                    </div>
                    {/* Restore button — big and obvious */}
                    <button onClick={() => restoreScene(idx)}
                      style={{ padding: "10px 20px", borderRadius: 10, border: "none", background: accent, color: "#000", fontSize: 12, fontWeight: 800, cursor: "pointer", flexShrink: 0 }}>
                      + Add to Assembly
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Pre-Flight AI Review (always visible at top of Assembly) ── */}
          <div data-testid="pre-assembly-review" style={{ background: surface, border: `1px solid ${preflightResult ? (preflightResult.blockingErrors > 0 ? `${red}40` : preflightResult.warnings > 0 ? `${gold}40` : `${accent}40`) : `${purple}30`}`, borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Icon.Star style={{ width: 15, height: 15, color: purple, flexShrink: 0 }} />
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI Audio & Audit</p>
              </div>
              {preflightResult && (
                <div style={{ display: "flex", gap: 6 }}>
                  {preflightResult.blockingErrors > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${red}20`, color: red, fontWeight: 700 }}>{preflightResult.blockingErrors} error{preflightResult.blockingErrors !== 1 ? "s" : ""}</span>}
                  {preflightResult.warnings > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${gold}20`, color: gold, fontWeight: 700 }}>{preflightResult.warnings} warning{preflightResult.warnings !== 1 ? "s" : ""}</span>}
                  {preflightResult.canAssemble && preflightResult.warnings === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${accent}20`, color: accent, fontWeight: 700 }}>Ready</span>}
                </div>
              )}
            </div>
            <button onClick={runPreflight} disabled={preflightRunning}
              style={{ width: "100%", padding: "11px", borderRadius: 10, border: `1px solid ${purple}60`, background: preflightRunning ? "#2a2040" : purple, color: "#fff", fontSize: 12, fontWeight: 700, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0, letterSpacing: "-0.01em" }}>
              {preflightRunning ? "⟳ Running checks…" : "▶ Run Pre-Flight Check"}
            </button>
            {preflightResult && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {preflightResult.checks.map(check => (
                  <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: check.status === "ok" ? `${accent}08` : check.status === "warn" ? `${gold}08` : `${red}08`, border: `1px solid ${check.status === "ok" ? accent : check.status === "warn" ? gold : red}20` }}>
                    <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}</span>
                    <div>
                      <p style={{ fontSize: 11, fontWeight: 600, color: check.status === "ok" ? accent : check.status === "warn" ? gold : red }}>{check.label}</p>
                      {check.detail && <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{check.detail}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {scenes.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: "center", padding: 40 }}>
              <p style={{ fontSize: 14, color: muted, marginBottom: 12 }}>No scenes yet. Go to Scene Board to create scenes first.</p>
              <button onClick={() => setActiveTab("scenes")} style={btnPrimary}>Go to Scene Board</button>
            </div>
          ) : (
            <>
              {/* ── Scene Selection + Reorder ── */}
              <div style={{ ...cardStyle, borderColor: `${accent}20`, marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Select Scenes for "{assemblyName}"</p>
                    <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>Uncheck scenes to exclude. Archive sends image to library — you can re-import any time.</p>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                    <button onClick={() => openLibraryImport()}
                      style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      Import from Library
                    </button>
                    <button onClick={() => setSelectedSceneIds(scenes.map(s => s.sceneId))}
                      style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${accent}30`, background: `${accent}08`, color: accent, fontSize: 10, cursor: "pointer" }}>
                      All
                    </button>
                    <button onClick={() => setSelectedSceneIds([])}
                      style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>
                      None
                    </button>
                  </div>
                </div>

                {/* ── Library Inbox — images pushed via "Send to Hybrid Planner" from asset library ── */}
                {libraryInbox.length > 0 && (
                  <div style={{ marginBottom: 10, padding: "10px 12px", borderRadius: 10, background: `${blue}08`, border: `1px solid ${blue}30` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: blue }}>{libraryInbox.length} image{libraryInbox.length > 1 ? "s" : ""} sent from Asset Library</span>
                      <button onClick={() => setLibraryInbox([])} style={{ marginLeft: "auto", padding: "2px 8px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>Dismiss</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {libraryInbox.map((asset, idx) => {
                        const imgUrl = assetToMediaUrl(asset.filePath);
                        return (
                          <div key={idx} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: surface, border: `1px solid ${blue}25` }}>
                            <div style={{ width: 40, height: 28, borderRadius: 4, overflow: "hidden", background: "#000", flexShrink: 0 }}>
                              <img src={imgUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            </div>
                            <span style={{ fontSize: 10, color: "#ccc", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</span>
                            <button onClick={() => { importImageFromLibrary(asset); setLibraryInbox(prev => prev.filter((_, i) => i !== idx)); }}
                              style={{ padding: "3px 10px", borderRadius: 6, border: "none", background: blue, color: "#000", fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                              + Add
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {(() => {
                  // Build assembly list — selected scenes in order, then unselected at bottom
                  const selected = scenes.filter(s => selectedSceneIds.includes(s.sceneId));
                  const unselected = scenes.filter(s => !selectedSceneIds.includes(s.sceneId));
                  const ordered = assemblyOrder.length > 0
                    ? [...assemblyOrder.map(id => selected.find(s => s.sceneId === id)).filter(Boolean) as typeof scenes, ...selected.filter(s => !assemblyOrder.includes(s.sceneId))]
                    : selected;
                  return [...ordered, ...unselected].map((scene, idx) => {
                    const isSelected = selectedSceneIds.includes(scene.sceneId);
                    const pos = isSelected ? ordered.findIndex(s => s.sceneId === scene.sceneId) + 1 : null;
                    const hasImg = !!sceneImages[scene.sceneId];
                    const hasVid = !!sceneVideos[scene.sceneId];
                    const typeInfo = SCENE_TYPES.find(t => t.id === scene.sceneType);
                    const modeOverride = sceneModeOverrides[scene.sceneId];
                    // Determine what will actually be used in assembly
                    const usingVideo = hasVid && (modeOverride === "video" || (!modeOverride));
                    const usingImage = !usingVideo && hasImg;
                    return (
                      <div key={scene.sceneId} style={{ borderRadius: 10, background: isSelected ? `${accent}06` : s2, border: `1px solid ${isSelected ? accent + "30" : border}`, marginBottom: 6, overflow: "hidden" }}>
                        {/* Main row */}
                        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px" }}>
                        {/* Checkbox */}
                        <input type="checkbox" checked={isSelected}
                          onChange={() => setSelectedSceneIds(prev => isSelected ? prev.filter(id => id !== scene.sceneId) : [...prev, scene.sceneId])}
                          style={{ width: 16, height: 16, cursor: "pointer", accentColor: accent, flexShrink: 0 }} />

                        {/* Position — click to assign a specific number ── */}
                        {isSelected && assigningId === scene.sceneId ? (
                          <input
                            autoFocus
                            type="number" min={1} max={ordered.length}
                            defaultValue={pos ?? 1}
                            onBlur={() => setAssigningId(null)}
                            onKeyDown={e => {
                              if (e.key === "Enter" || e.key === "Escape") {
                                if (e.key === "Enter") {
                                  const newPos = Math.max(1, Math.min(ordered.length, Number((e.target as HTMLInputElement).value)));
                                  setAssemblyOrder(prev => {
                                    const base = prev.length > 0 ? [...prev] : ordered.map(s => s.sceneId);
                                    const from = base.indexOf(scene.sceneId);
                                    if (from < 0) return base;
                                    base.splice(from, 1);
                                    base.splice(newPos - 1, 0, scene.sceneId);
                                    return base;
                                  });
                                }
                                setAssigningId(null);
                              }
                            }}
                            style={{ width: 36, height: 28, borderRadius: 8, border: `2px solid ${accent}`, background: s2, color: accent, fontSize: 12, fontWeight: 800, textAlign: "center", outline: "none", flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            onClick={() => isSelected && setAssigningId(scene.sceneId)}
                            title={isSelected ? "Click to assign position number" : ""}
                            style={{ width: 28, height: 28, borderRadius: 8, background: isSelected ? accent : border, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, cursor: isSelected ? "pointer" : "default" }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: isSelected ? "#000" : muted }}>{pos ?? "·"}</span>
                          </div>
                        )}

                        {/* Scene thumbnail */}
                        <div style={{ width: 48, height: 32, borderRadius: 6, overflow: "hidden", background: s2, flexShrink: 0, cursor: hasImg ? "zoom-in" : "default", position: "relative" }}
                          onMouseEnter={e => { if (hasImg) setHoverPreview({ src: sceneImages[scene.sceneId], x: e.clientX, y: e.clientY }); }}
                          onMouseMove={e => { if (hasImg) setHoverPreview({ src: sceneImages[scene.sceneId], x: e.clientX, y: e.clientY }); }}
                          onMouseLeave={() => setHoverPreview(null)}>
                          {hasImg ? <img src={sceneImages[scene.sceneId]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.Image style={{ width: 12, height: 12, opacity: 0.3 }} /></div>}
                          {hasVid && <div style={{ position: "absolute", bottom: 1, right: 2, fontSize: 8, background: "#000a", borderRadius: 2, padding: "1px 3px", color: "#fff" }}>VID</div>}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 12, fontWeight: 600, color: isSelected ? "#fff" : muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", margin: 0 }}>{scene.sceneId}: {scene.title}</p>
                          <div style={{ display: "flex", gap: 5, marginTop: 2, alignItems: "center" }}>
                            <span style={badgeStyle(typeInfo?.color || accent)}>{typeInfo?.label}</span>
                            {scene.narrationScript && <span style={{ fontSize: 8, color: "#22c55e" }}>Narration</span>}
                          </div>
                          {reviewMode && isSelected && scene.narrationScript && (
                            <p style={{ fontSize: 9, color: muted, marginTop: 3, fontStyle: "italic", lineHeight: 1.4, maxWidth: 400 }}>
                              "{scene.narrationScript.slice(0, 100)}{scene.narrationScript.length > 100 ? "..." : ""}"
                            </p>
                          )}
                        </div>

                        {/* Preview buttons */}
                        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                          {hasImg && (
                            <button onClick={() => setPreviewMedia({ url: sceneImages[scene.sceneId], type: "image", title: `${scene.sceneId}: ${scene.title}` })}
                              title="Preview image" style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${accent}30`, background: `${accent}10`, color: accent, fontSize: 10, cursor: "pointer" }}>Preview</button>
                          )}
                          {hasVid && (
                            <button onClick={() => setPreviewMedia({ url: sceneVideos[scene.sceneId], type: "video", title: `${scene.sceneId}: ${scene.title}` })}
                              title="Watch video" style={{ padding: "4px 8px", borderRadius: 6, border: `1px solid ${purple}40`, background: `${purple}15`, color: purple, fontSize: 10, cursor: "pointer", fontWeight: 700 }}>
                              ▶
                            </button>
                          )}
                          {/* Move to Library */}
                          <button onClick={() => archiveScene(scene.sceneId)}
                            title="Move to library"
                            style={{ padding: "4px 7px", borderRadius: 6, border: `1px solid ${gold}30`, background: `${gold}06`, color: gold, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                            →
                          </button>
                        </div>
                        </div>

                        {/* ── MEDIA SELECTOR ROW — always visible ── */}
                        <div style={{ borderTop: `1px solid ${border}`, padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, background: "#111118" }}>
                          <span style={{ fontSize: 9, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5, flexShrink: 0 }}>USE IN ASSEMBLY:</span>
                          {/* Image option */}
                          <button
                            onClick={() => hasImg && setSceneModeOverrides(prev => ({ ...prev, [scene.sceneId]: "image" }))}
                            disabled={!hasImg}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "5px 12px", borderRadius: 7, border: `2px solid ${usingImage ? accent : border}`,
                              background: usingImage ? `${accent}18` : "transparent",
                              color: usingImage ? accent : hasImg ? muted : "#333",
                              fontSize: 11, fontWeight: usingImage ? 700 : 500,
                              cursor: hasImg ? "pointer" : "not-allowed", transition: "all 0.15s", flexShrink: 0,
                            }}>
                            <Icon.Image style={{ width: 14, height: 14 }} />
                            <span>Image</span>
                            {usingImage && <span style={{ fontSize: 9, background: accent, color: "#000", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>SELECTED</span>}
                            {!hasImg && <span style={{ fontSize: 9, color: "#333" }}>(none)</span>}
                          </button>

                          <span style={{ color: border, fontSize: 14, flexShrink: 0 }}>|</span>

                          {/* Video option */}
                          <button
                            onClick={() => hasVid && setSceneModeOverrides(prev => ({ ...prev, [scene.sceneId]: "video" }))}
                            disabled={!hasVid}
                            style={{
                              display: "flex", alignItems: "center", gap: 5,
                              padding: "5px 12px", borderRadius: 7, border: `2px solid ${usingVideo ? purple : border}`,
                              background: usingVideo ? `${purple}18` : "transparent",
                              color: usingVideo ? purple : hasVid ? muted : "#333",
                              fontSize: 11, fontWeight: usingVideo ? 700 : 500,
                              cursor: hasVid ? "pointer" : "not-allowed", transition: "all 0.15s", flexShrink: 0,
                            }}>
                            <Icon.Film style={{ width: 14, height: 14 }} />
                            <span>Video</span>
                            {usingVideo && <span style={{ fontSize: 9, background: purple, color: "#fff", borderRadius: 4, padding: "1px 5px", fontWeight: 800 }}>SELECTED</span>}
                            {!hasVid && <span style={{ fontSize: 9, color: "#333" }}>(none)</span>}
                          </button>

                          {/* Generate video shortcut if no video yet */}
                          {hasImg && !hasVid && (
                            <button
                              onClick={() => makeSceneVideo(scene)}
                              disabled={generatingSceneVideos.has(scene.sceneId)}
                              style={{ marginLeft: "auto", padding: "5px 10px", borderRadius: 7, border: "none", background: generatingSceneVideos.has(scene.sceneId) ? border : "linear-gradient(135deg,#a855f7,#7c3aed)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: generatingSceneVideos.has(scene.sceneId) ? "not-allowed" : "pointer", flexShrink: 0 }}>
                              {generatingSceneVideos.has(scene.sceneId) ? "Generating..." : "+ Make Video"}
                            </button>
                          )}
                          {hasVid && (
                            <button onClick={() => makeSceneVideo(scene)}
                              disabled={generatingSceneVideos.has(scene.sceneId)}
                              style={{ marginLeft: "auto", padding: "5px 8px", borderRadius: 7, border: `1px solid ${purple}40`, background: "transparent", color: purple, fontSize: 9, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                              {generatingSceneVideos.has(scene.sceneId) ? "..." : "↻ Re-video"}
                            </button>
                          )}

                          {/* Max image controls — same 3-state pattern as the Scene Board view.
                              State A: beats exist + opted-in → "Max ON (M/N)"
                              State B: beats exist + not opted-in → "Use Max Image (N)"
                              State C: no beats yet → "+ Gen Max (~N)" — generates + auto-opts in.
                              Source unified with assembly loop: Gen Max beats first, else current+prev variants. */}
                          {(() => {
                            const sid = scene.sceneId;
                            const genMaxBeats = sceneBeatImages[sid];
                            const currentImg = sceneImages[sid];
                            const variantPool = [currentImg, ...(prevSceneImages[sid] || [])].filter((u): u is string => !!u);
                            const beats = (genMaxBeats && genMaxBeats.length > 1)
                              ? genMaxBeats
                              : (variantPool.length > 1 ? variantPool : null);
                            const totalBeats = beats?.length ?? 0;
                            const isMaxOn = useMaxImageScenes.has(sid);
                            const isGenerating = generatingMaxBeats.has(sid);
                            const split = splitIntoActionBeats(`${scene.title}. ${scene.description}`).length;
                            const predicted = totalBeats > 0 ? totalBeats : Math.max(split, 2);
                            const incl = isMaxOn ? (selectedBeatImages[sid] || []).filter(Boolean).length : 1;
                            // STATE C — no beats yet
                            if (totalBeats === 0) {
                              return (
                                <button onClick={async () => {
                                    if (isGenerating) return;
                                    await makeSceneBeatImages(scene);
                                    setUseMaxImageScenes(prev => new Set(prev).add(sid));
                                  }}
                                  disabled={isGenerating}
                                  title={`Generate ${predicted} action-beat images for this scene`}
                                  style={{ padding: "5px 12px", borderRadius: 7,
                                    border: `1px dashed #ff9500`,
                                    background: isGenerating ? "#2a2040" : "transparent",
                                    color: isGenerating ? muted : "#ff9500",
                                    fontSize: 10, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer",
                                    whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                                  {isGenerating ? (maxBeatsProgress[sid] || "Generating…") : `+ Gen Max (~${predicted})`}
                                </button>
                              );
                            }
                            // STATE A or B — beats already exist; auto-opt-in so picker shows
                            if (!isMaxOn) {
                              setTimeout(() => setUseMaxImageScenes(prev => new Set(prev).add(sid)), 0);
                            }
                            return (
                              <span style={{ padding: "5px 12px", borderRadius: 7,
                                border: `2px solid #ff9500`, background: "#ff9500",
                                color: "#000", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" as const, flexShrink: 0 }}>
                                Max ON ({incl}/{totalBeats})
                              </span>
                            );
                          })()}

                          {/* Live progress bar */}
                          {sceneGenProgress[scene.sceneId] && (() => {
                            const pg = sceneGenProgress[scene.sceneId];
                            const barColor = pg.type === "video" ? purple : accent;
                            return (
                              <div style={{ flex: 1, minWidth: 60 }}>
                                <div style={{ fontSize: 8, color: barColor, marginBottom: 2 }}>{pg.message} {Math.round(pg.percent)}%</div>
                                <div style={{ height: 3, borderRadius: 3, background: "#1a1a2e" }}>
                                  <div style={{ height: "100%", borderRadius: 3, width: `${pg.percent}%`, background: barColor, transition: "width 0.6s" }} />
                                </div>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Inline image spread — always visible when scene has 2+ images.
                            Each thumb has a checkbox; default all ticked. Toggling auto-opts the scene
                            into multi-image mode (handled by the Max button render above). */}
                        {(() => {
                          const sid = scene.sceneId;
                          const genMaxBeats = sceneBeatImages[sid];
                          const currentImg = sceneImages[sid];
                          const variantPool = [currentImg, ...(prevSceneImages[sid] || [])].filter((u): u is string => !!u);
                          const beats = (genMaxBeats && genMaxBeats.length > 1)
                            ? genMaxBeats
                            : (variantPool.length > 1 ? variantPool : null);
                          if (!beats || beats.length <= 1) return null;
                          return (
                            <div style={{ borderTop: `1px solid ${border}`, padding: "6px 12px", background: "#ff95000a" }}>
                              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                                <span style={{ fontSize: 9, color: "#ff9500", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>
                                  Pick which images to include in assembly
                                </span>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sid]: beats.map(() => true) }))}
                                    style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ff950060", background: "transparent", color: "#ff9500", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                    Select All
                                  </button>
                                  <button onClick={() => setSelectedBeatImages(prev => ({ ...prev, [sid]: beats.map(() => false) }))}
                                    style={{ padding: "2px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 8, cursor: "pointer" }}>
                                    Deselect All
                                  </button>
                                  <button onClick={() => {
                                    const checked = selectedBeatImages[sid] || beats.map(() => true);
                                    const kept = beats.filter((_, i) => !checked[i]);
                                    const keptChecks = checked.filter((_, i) => !checked[i]);
                                    setSceneBeatImages(prev => ({ ...prev, [sid]: kept }));
                                    setSelectedBeatImages(prev => ({ ...prev, [sid]: keptChecks }));
                                  }}
                                    style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ef444460", background: "transparent", color: "#ef4444", fontSize: 8, cursor: "pointer" }}>
                                    Del Selected
                                  </button>
                                  <button onClick={() => {
                                    setSceneBeatImages(prev => ({ ...prev, [sid]: [] }));
                                    setSelectedBeatImages(prev => ({ ...prev, [sid]: [] }));
                                  }}
                                    style={{ padding: "2px 8px", borderRadius: 4, border: "1px solid #ef444460", background: "#ef44440a", color: "#ef4444", fontSize: 8, fontWeight: 700, cursor: "pointer" }}>
                                    Del All
                                  </button>
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                                {beats.map((url, bi) => {
                                  const checked = selectedBeatImages[sid]?.[bi] !== false;
                                  return (
                                    <div key={bi} style={{ position: "relative" as const }}>
                                      <label
                                        title={`Image ${bi + 1} — ${checked ? "included" : "skipped"}`}
                                        style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 2, padding: 3, borderRadius: 5, border: `2px solid ${checked ? "#ff9500" : "#33334a"}`, background: checked ? "#ff950018" : "transparent", cursor: "pointer", userSelect: "none" as const }}>
                                        <img src={url} alt={`#${bi + 1}`}
                                          style={{ width: 60, height: 44, objectFit: "cover" as const, borderRadius: 3, opacity: checked ? 1 : 0.4 }}
                                          onClick={e => { e.preventDefault(); setPreviewMedia({ url, type: "image", title: `${scene.title} — Image ${bi + 1}` }); }} />
                                        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                          <input type="checkbox" checked={checked}
                                            onChange={e => setSelectedBeatImages(prev => {
                                              const arr = [...(prev[sid] || beats.map(() => true))];
                                              arr[bi] = e.target.checked;
                                              return { ...prev, [sid]: arr };
                                            })}
                                            style={{ width: 11, height: 11 }} />
                                          <span style={{ fontSize: 8, color: checked ? "#ff9500" : muted, fontWeight: 700 }}>#{bi + 1}</span>
                                        </div>
                                      </label>
                                      <button
                                        onClick={e => { e.stopPropagation(); setSceneBeatImages(prev => { const a = [...(prev[sid] || [])]; a.splice(bi, 1); return { ...prev, [sid]: a }; }); setSelectedBeatImages(prev => { const a = [...(prev[sid] || beats.map(() => true))]; a.splice(bi, 1); return { ...prev, [sid]: a }; }); }}
                                        title="Remove this image"
                                        style={{ position: "absolute" as const, top: -4, right: -4, width: 14, height: 14, borderRadius: "50%", background: "#ef4444", border: "none", color: "#fff", fontSize: 9, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1, padding: 0, zIndex: 2 }}>
                                        ×
                                      </button>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })()}


                        {/* Move ▲▼ + quick Assign button */}
                        {isSelected && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, flexShrink: 0, alignItems: "center" }}>
                            <button onClick={() => {
                              setAssemblyOrder(prev => {
                                const base = prev.length > 0 ? prev : ordered.map(s => s.sceneId);
                                const i = base.indexOf(scene.sceneId);
                                if (i <= 0) return base;
                                const a = [...base]; [a[i-1], a[i]] = [a[i], a[i-1]]; return a;
                              });
                            }} style={{ padding: "1px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>▲</button>
                            <button onClick={() => setAssigningId(scene.sceneId)}
                              style={{ padding: "1px 6px", borderRadius: 4, border: `1px solid ${accent}30`, background: `${accent}08`, color: accent, fontSize: 7, fontWeight: 700, cursor: "pointer", letterSpacing: 0.5 }}>
                              Assign
                            </button>
                            <button onClick={() => {
                              setAssemblyOrder(prev => {
                                const base = prev.length > 0 ? prev : ordered.map(s => s.sceneId);
                                const i = base.indexOf(scene.sceneId);
                                if (i >= base.length - 1) return base;
                                const a = [...base]; [a[i], a[i+1]] = [a[i+1], a[i]]; return a;
                              });
                            }} style={{ padding: "1px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>▼</button>
                          </div>
                        )}
                      </div>
                    );
                  });
                })()}
              </div>


          {/* ══════════════════════════════════════════════════════════
               PRE-ASSEMBLY PANEL — review audio, subtitles, intro/outro
               ══════════════════════════════════════════════════════════ */}
          <div style={{ marginBottom: 16 }}>

            {/* A. Audio for Video */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Audio for Video</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {/* Narration */}
                <div>
                  <p style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Narration</p>
                  {narratorAudioUrl
                    ? <audio controls src={narratorAudioUrl} style={{ width: "100%", height: 32 }} />
                    : <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>Not generated yet</p>}
                  <button onClick={generateNarrationPiper} disabled={generatingNarration || !(fullScript || expandedSummary || idea)}
                    style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", marginTop: 6 }}>
                    {generatingNarration ? "Generating..." : "Generate"}
                  </button>
                </div>
                {/* Background Music */}
                <div>
                  <p style={{ fontSize: 10, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Background Music</p>
                  {selectedMusicUrl
                    ? <audio controls src={selectedMusicUrl} style={{ width: "100%", height: 32 }} />
                    : <p style={{ fontSize: 11, color: muted }}>None selected — go to Sound tab</p>}
                </div>
              </div>
            </div>

            {/* B. Subtitle Style */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <SubtitleStyler value={effectiveSubtitleConfig} onChange={newCfg => {
                setSubtitleConfig(newCfg);
                // Keep legacy subtitleStyle in sync: "none" when off, "classic" as default when on
                if (newCfg.mode === "none") setSubtitleStyle("none");
                else if (subtitleStyle === "none") setSubtitleStyle("classic");
                patchProjectSettings({ subtitleMode: newCfg.mode, subtitleHighlight: newCfg.highlightColor, subtitleEnabled: newCfg.mode !== "none" }).catch(() => {});
              }} accentColor={accent} />
              {/* Check Narration ↔ Subtitle Match */}
              <p style={{ fontSize: 10, color: muted, marginTop: 12, marginBottom: 6 }}>Verify narration text will render as subtitles on the final video.</p>
              <button
                onClick={() => {
                  setSubtitleMatchResult({ status: "checking", note: "Checking…" });
                  const narratorText = scenes
                    .slice().sort((a: HybridScene, b: HybridScene) => a.scene - b.scene)
                    .map((s: HybridScene) => s.narrationScript || s.description || "")
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  const subMode = effectiveSubtitleConfig.mode;
                  if (!narratorText) {
                    setSubtitleMatchResult({ status: "warn", note: "No narration text found. Go to Audio tab → generate narration first." });
                    return;
                  }
                  if (subMode === "none") {
                    const wc = narratorText.split(/\s+/).filter(Boolean).length;
                    setSubtitleMatchResult({ status: "warn", note: `Subtitles OFF — ${wc} words will not render. Click "Enable Subtitles" below.` });
                    return;
                  }
                  const subtitleQC = storyQCResult?.supervisorResults?.["subtitle_style"];
                  if (subtitleQC && !subtitleQC.passed && subtitleQC.blockingIssues.length > 0) {
                    setSubtitleMatchResult({ status: "warn", note: subtitleQC.blockingIssues[0] });
                    return;
                  }
                  const wc = narratorText.split(/\s+/).filter(Boolean).length;
                  setSubtitleMatchResult({ status: "ok", note: `${wc} words · mode: ${subMode} · style: ${subtitleStyle === "none" ? "classic (auto)" : subtitleStyle} — subtitles will render on assembly.` });
                }}
                style={{ padding: "8px 18px", borderRadius: 8, border: `1px solid ${accent}50`, background: `${accent}18`, color: accent, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                ▶ Check Subtitle Sync
              </button>
              {subtitleMatchResult && (
                <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 8, background: subtitleMatchResult.status === "warn" ? `${red}10` : `${accent}10`, border: `1px solid ${subtitleMatchResult.status === "warn" ? red : accent}30` }}>
                  <p style={{ fontSize: 11, color: subtitleMatchResult.status === "warn" ? red : accent }}>{subtitleMatchResult.status === "checking" ? "⟳ " : subtitleMatchResult.status === "warn" ? "⚠ " : "✓ "}{subtitleMatchResult.note.slice(0, 200)}</p>
                  {subtitleMatchResult.status === "warn" && effectiveSubtitleConfig.mode === "none" && (
                    <button
                      onClick={() => {
                        setSubtitleStyle("classic");
                        setSubtitleConfig(prev => ({ ...prev, mode: "dramatic" }));
                        patchProjectSettings({ subtitleMode: "dramatic", subtitleEnabled: true }).catch(() => {});
                        setSubtitleMatchResult({ status: "ok", note: "Subtitles enabled (classic/dramatic). Run check again to confirm." });
                      }}
                      style={{ marginTop: 6, padding: "5px 14px", borderRadius: 6, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                      Enable Subtitles
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* C. Intro & Outro */}
            <div style={{ ...cardStyle, marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Intro &amp; Outro</p>
              <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>AI generates a cinematic title card. Prepended/appended to your video.</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                {/* Intro */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Intro</p>
                  {introUrl
                    ? (/\.(mp4|webm|mov)$/i.test(introUrl)
                        ? <video src={introUrl} controls style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
                        : <img src={introUrl} alt="Intro card" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />)
                    : <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px dashed ${border}`, marginBottom: 8 }}><p style={{ fontSize: 11, color: muted }}>No intro</p></div>}
                  <button onClick={async () => {
                    setGeneratingIntro(true);
                    try {
                      const r = await fetch("/api/hybrid/generate-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "intro", title: projectTitle, author: screenplayAuthor, studio: "Andio Studio", ideaFrom, genre, tone, style: introOutroStyle, cast: characters.slice(0, 10).map(c => ({ name: c.displayName, species: c.species, roleType: c.roleType })) }) });
                      const d = await r.json();
                      if (d.ok && d.imageUrl) setIntroUrl(d.imageUrl); else setLastAction("Intro generation failed");
                    } catch { setLastAction("Intro error"); } finally { setGeneratingIntro(false); }
                  }} disabled={generatingIntro}
                    style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: generatingIntro ? "#2a2040" : purple, color: "#fff", fontSize: 11, fontWeight: 700, cursor: generatingIntro ? "not-allowed" : "pointer" }}>
                    {generatingIntro ? "Generating..." : "Generate AI Intro"}
                  </button>
                </div>
                {/* Outro */}
                <div>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Outro</p>
                  {outroUrl
                    ? (/\.(mp4|webm|mov)$/i.test(outroUrl)
                        ? <video src={outroUrl} controls style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />
                        : <img src={outroUrl} alt="Outro card" style={{ width: "100%", borderRadius: 8, marginBottom: 8 }} />)
                    : <div style={{ height: 80, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 8, border: `1px dashed ${border}`, marginBottom: 8 }}><p style={{ fontSize: 11, color: muted }}>No outro</p></div>}
                  <button onClick={async () => {
                    setGeneratingOutro(true);
                    try {
                      const castList = characters.filter(c => c.voiceId).map(c => ({ name: c.displayName, species: c.species, roleType: c.roleType })).slice(0, 8);
                      const r = await fetch("/api/hybrid/generate-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "outro", title: projectTitle, author: screenplayAuthor, studio: "Andio Studio", ideaFrom, genre, tone, style: introOutroStyle, cast: castList }) });
                      const d = await r.json();
                      if (d.ok && d.imageUrl) setOutroUrl(d.imageUrl); else setLastAction("Outro generation failed");
                    } catch { setLastAction("Outro error"); } finally { setGeneratingOutro(false); }
                  }} disabled={generatingOutro}
                    style={{ width: "100%", padding: "8px", borderRadius: 8, border: "none", background: generatingOutro ? "#2a2040" : accent, color: "#fff", fontSize: 11, fontWeight: 700, cursor: generatingOutro ? "not-allowed" : "pointer" }}>
                    {generatingOutro ? "Generating..." : "Generate AI Outro"}
                  </button>
                </div>
              </div>
            </div>


          </div>

          {/* ══════════════════════════════════════════════════════════
               PRODUCTION PIPELINE — numbered road map
               Each step is always visible. Green circle = done.
               Click a step header to expand/collapse it.
               ══════════════════════════════════════════════════════════ */}
          {(() => {
            // ── Helper: step status badge ──
            const stepDone = (ok: boolean) => (
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, background: ok ? "#22c55e" : `${accent}18`, border: `2px solid ${ok ? "#22c55e" : accent}`, color: ok ? "#000" : accent }}>
                {ok ? <Icon.Check style={{ width:10, height:10 }} /> : null}
              </div>
            );
            const stepNum = (n: number, ok: boolean) => (
              <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 13, background: ok ? "#22c55e" : `${accent}18`, border: `2px solid ${ok ? "#22c55e" : accent}`, color: ok ? "#000" : accent }}>
                {ok ? <Icon.Check style={{ width:10, height:10 }} /> : n}
              </div>
            );
            const stepConnector = (ok: boolean) => (
              <div style={{ width: 2, height: 18, background: ok ? "#22c55e50" : `${border}`, margin: "1px 0 1px 14px" }} />
            );
            const stepBtn = (label: string, onClick: () => void, disabled = false, color: string = accent) => (
              <button onClick={onClick} disabled={disabled} style={{ padding: "8px 18px", borderRadius: 9, border: "none", background: disabled ? "#2a2a40" : `linear-gradient(135deg, ${color}, ${color}cc)`, color: disabled ? muted : "#fff", fontSize: 11, fontWeight: 700, cursor: disabled ? "not-allowed" : "pointer", flexShrink: 0, opacity: disabled ? 0.6 : 1 }}>
                {label}
              </button>
            );
            const stepHeader = (n: number, ok: boolean, icon: string, title: string, sub: string) => (
              <div onClick={() => setOpenPipelineStep(openPipelineStep === n ? 0 : n)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", cursor: "pointer", borderBottom: openPipelineStep === n ? `1px solid ${border}` : "none", userSelect: "none" }}>
                {stepNum(n, ok)}
                <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 12, fontWeight: 800, color: ok ? "#22c55e" : "#fff", margin: 0 }}>Step {n} — {title}</p>
                  <p style={{ fontSize: 9, color: muted, margin: "1px 0 0" }}>{sub}</p>
                </div>
                <span style={{ fontSize: 10, color: muted }}>{openPipelineStep === n ? "▲" : "▼"}</span>
              </div>
            );

            // 9-step pipeline
            const done1 = !!screenplay;                                // Step 1: Write Screenplay
            const done2 = !!(fullScript || expandedSummary);           // Step 2: Story source (mandatory)
            const done3 = scriptSegments.length > 0;                   // Step 3: Parse / Send to Scenes
            const done4 = Object.keys(characterAudioUrls).length > 0;  // Step 4: Actor Voices
            const done5 = !!narratorAudioUrl;                          // Step 5: Narrator Voice
            const done6 = !!selectedMusicUrl;                          // Step 6: Background Music
            const done7 = !!reviewMode;                                // Step 7: AI Audio Plan
            const done8 = true;                                        // Step 8: Settings always available
            const done9 = !!assembledVideoUrl;                         // Step 9: Assemble

            return (
              <div style={{ background: surface, border: `1px solid ${accent}30`, borderRadius: 16, marginBottom: 14, overflow: "hidden" }}>
                {/* Pipeline Header */}
                <div style={{ padding: "14px 18px", background: `${accent}08`, borderBottom: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", margin: 0 }}>Production Pipeline</p>
                    <p style={{ fontSize: 9, color: muted, margin: "2px 0 0" }}>9 steps. Follow the numbers. Green = done. Click a step to open it.</p>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                    <input value={assemblyName} onChange={e => setAssemblyName(e.target.value)}
                      placeholder="Cut name…" style={{ ...inputStyle, fontSize: 11, padding: "6px 10px", width: 110 }} />
                    <button onClick={() => { if (!assemblyName.trim()) return; setSavedCuts(prev => { const ex = prev.findIndex(c => c.name === assemblyName); const cut = { name: assemblyName, sceneIds: [...selectedSceneIds], order: [...assemblyOrder] }; if (ex >= 0) { const a = [...prev]; a[ex] = { ...a[ex], ...cut }; return a; } return [...prev, cut]; }); setLastAction(`Cut "${assemblyName}" saved`); }}
                      style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>Save</button>
                  </div>
                </div>

                {/* ── STEP 1: Write Official Screenplay ── */}
                {stepHeader(1, done1, "1", "Write Screenplay",
                  done1 ? `Screenplay ready — by ${screenplayAuthor || "Unknown"}` : "Enter your name and write the official screenplay"
                )}
                {openPipelineStep === 1 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>
                      GHS writes a full cinematic screenplay from your story. Enter your name as the author, then click Write Screenplay. Once done, click Send to Scenes to distribute it — narration and dialogue will be split automatically.
                    </p>

                    {/* Author name + Idea from */}
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 12 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: muted, flexShrink: 0, width: 75 }}>Written by:</span>
                        <input
                          type="text"
                          value={screenplayAuthor}
                          onChange={e => setScreenplayAuthor(e.target.value)}
                          placeholder="Your name"
                          style={{ ...inputStyle, flex: 1, maxWidth: 260, fontSize: 12, fontWeight: 600 }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 11, color: muted, flexShrink: 0, width: 75 }}>Idea from:</span>
                        <input
                          type="text"
                          value={ideaFrom}
                          onChange={e => setIdeaFrom(e.target.value)}
                          placeholder="Original idea by... (optional)"
                          style={{ ...inputStyle, flex: 1, maxWidth: 260, fontSize: 12 }}
                        />
                      </div>
                      <p style={{ fontSize: 9, color: muted }}>Studio: <span style={{ color: accent }}>Andio Studio</span> (used automatically in intro/outro)</p>
                    </div>

                    {/* Buttons */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      <button
                        onClick={generateScreenplay}
                        disabled={generatingScreenplay || !done2}
                        style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: generatingScreenplay ? "#2a2a40" : `linear-gradient(135deg, ${purple}, #7c3aed)`, color: generatingScreenplay ? muted : "#fff", fontSize: 12, fontWeight: 700, cursor: (generatingScreenplay || !done2) ? "not-allowed" : "pointer", opacity: (!done2 && !generatingScreenplay) ? 0.5 : 1 }}>
                        {generatingScreenplay ? "Writing..." : screenplay ? "Rewrite Screenplay" : "Write Screenplay"}
                      </button>
                      {screenplay && (
                        <button
                          onClick={sendScreenplayToScenes}
                          disabled={sendingToScenes}
                          style={{ padding: "9px 20px", borderRadius: 9, border: "none", background: sendingToScenes ? "#2a2a40" : `linear-gradient(135deg, ${accent}, #0088cc)`, color: sendingToScenes ? muted : "#fff", fontSize: 12, fontWeight: 700, cursor: sendingToScenes ? "not-allowed" : "pointer" }}>
                          {sendingToScenes ? "Sending..." : "Send to Scenes"}
                        </button>
                      )}
                    </div>

                    {!done2 && <p style={{ fontSize: 10, color: gold, marginBottom: 8 }}>Write your story in Step 2 first before generating screenplay.</p>}
                    {screenplayError && <p style={{ fontSize: 11, color: red, marginBottom: 8 }}>{screenplayError}</p>}
                    {sendToScenesResult && <p style={{ fontSize: 10, color: "#22c55e", marginBottom: 8 }}>{sendToScenesResult}</p>}

                    {screenplay && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: 10, color: muted, marginBottom: 5 }}>Screenplay preview:</p>
                        <div style={{ background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px", maxHeight: 120, overflowY: "auto", fontSize: 10, color: "#ccc", lineHeight: 1.7, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
                          {screenplay.slice(0, 500)}{screenplay.length > 500 ? "…" : ""}
                        </div>
                      </div>
                    )}
                    {done1 && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 8 }}>Screenplay ready — move to Step 3 to parse</p>}
                  </div>
                )}

                {stepConnector(done1)}

                {/* ── STEP 2: Story Source (mandatory) ── */}
                {stepHeader(2, done2, "2", "Story Source",
                  done2 ? `${(expandedSummary || fullScript || "").split(/\s+/).filter(Boolean).length} words ready` : "Write or paste your full story — required for everything"
                )}
                {openPipelineStep === 2 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>This is the raw story text. It powers the screenplay, narration, character voices, music mood, and scene descriptions. Write it here or paste it from your notes.</p>
                    <textarea
                      value={expandedSummary || fullScript || ""}
                      onChange={e => {
                        const newText = e.target.value;
                        setExpandedSummary(newText);
                        // Clear stale audio when story changes significantly (>50 chars diff)
                        const prevLen = (expandedSummary || fullScript || "").length;
                        if (Math.abs(newText.length - prevLen) > 50) {
                          setNarratorAudioUrl(null);
                          setNarratorAudioDuration(0);
                          setCharacterAudioUrls({});
                          setScriptSegments([]);
                        }
                      }}
                      placeholder="Write your story here… Once upon a time in a city that never sleeps…"
                      rows={7}
                      style={{ ...inputStyle, width: "100%", fontSize: 11, lineHeight: 1.6, resize: "vertical", boxSizing: "border-box" }}
                    />
                    <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
                      {(expandedSummary || fullScript) && (
                        <span style={{ fontSize: 9, color: muted }}>
                          {(expandedSummary || fullScript || "").split(/\s+/).filter(Boolean).length} words
                        </span>
                      )}
                      {done2 && <span style={{ fontSize: 10, color: "#22c55e", marginLeft: "auto" }}>Story ready — go to Step 1 to write screenplay</span>}
                    </div>
                  </div>
                )}

                {stepConnector(done2)}

                {/* ── STEP 3: Parse Script ── */}
                {stepHeader(3, done3, "3", "Parse Script",
                  done3 ? `${scriptSegments.length} segments (${scriptSegments.filter(s => s.type === "narration").length} narrator · ${scriptSegments.filter(s => s.type === "dialogue").length} dialogue)`
                         : "Split screenplay into narrator lines and character dialogue"
                )}
                {openPipelineStep === 3 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Parsing reads your screenplay and separates narrator text from character dialogue. Run this after Send to Scenes (Step 1) completes.</p>
                    {!done2 ? (
                      <div style={{ padding: "12px 16px", borderRadius: 10, background: `${gold}12`, border: `1px solid ${gold}40`, display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <Icon.Alert style={{ width: 18, height: 18, flexShrink: 0, color: gold }} />
                        <div>
                          <p style={{ fontSize: 11, fontWeight: 700, color: gold, margin: "0 0 3px" }}>Story required first</p>
                          <p style={{ fontSize: 10, color: "#aaa", margin: 0 }}>Complete Step 2 (Story Source) before parsing.</p>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                          {stepBtn(parsingScript ? "Parsing..." : done3 ? "Re-Parse" : "Parse Script", parseScript, parsingScript, accent)}
                          {done3 && (
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, background: `${accent}18`, color: accent }}>{scriptSegments.filter(s => s.type === "narration").length} narrator lines</span>
                              <span style={{ fontSize: 9, padding: "3px 8px", borderRadius: 6, background: `${purple}18`, color: purple }}>{scriptSegments.filter(s => s.type === "dialogue").length} dialogue lines</span>
                            </div>
                          )}
                        </div>
                        {done3 && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 8 }}>Parsed — move to Step 4</p>}
                      </>
                    )}
                  </div>
                )}

                {stepConnector(done2)}

                {/* ── STEP 4: Actor Voices ── */}
                {stepHeader(4, done4, "4", "Actor Voices", done4 ? `${Object.keys(characterAudioUrls).length}/${characters.length} actors voiced` : "Assign a voice to each character")}
                {openPipelineStep === 4 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Assign a Piper voice to each character. GHS needs to know who says what before generating narration. Each character gets their own voice.</p>
                    {characters.length === 0 ? (
                      <p style={{ fontSize: 11, color: gold }}>No characters yet. Add them in the Characters tab first.</p>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                          {characters.map(char => {
                            const hasAudio = !!characterAudioUrls[char.characterId];
                            const assigned = characterPiperVoices[char.characterId] || "en_US-lessac-medium";
                            return (
                              <div key={char.characterId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: hasAudio ? `#22c55e0a` : s2, border: `1px solid ${hasAudio ? "#22c55e30" : border}` }}>
                                {char.imageUrl ? <img src={char.imageUrl} alt="" style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} /> : <div style={{ width: 28, height: 28, borderRadius: "50%", background: purple, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#fff", fontWeight: 700, flexShrink: 0 }}>{char.displayName[0]}</div>}
                                <span style={{ fontSize: 11, fontWeight: 600, color: hasAudio ? "#22c55e" : "#fff", width: 100, flexShrink: 0 }}>{char.displayName}</span>
                                <select value={assigned} onChange={e => setCharacterPiperVoices(prev => ({ ...prev, [char.characterId]: e.target.value }))}
                                  style={{ ...inputStyle, flex: 1, fontSize: 10, padding: "5px 8px" }}>
                                  <optgroup label="Male">
                                    <option value="en_US-lessac-medium">Lessac</option>
                                    <option value="en_US-ryan-high">Ryan (High)</option>
                                    <option value="en_US-joe-medium">Joe (Deep)</option>
                                    <option value="en_US-danny-low">⬛ Danny (Low)</option>
                                    <option value="en_GB-alan-medium">🇬🇧 Alan (British)</option>
                                    <option value="en_US-libritts-high">LibriTTS</option>
                                  </optgroup>
                                  <optgroup label="Female">
                                    <option value="en_US-amy-medium">Amy</option>
                                    <option value="en_US-hfc_female-medium">HFC</option>
                                    <option value="en_GB-cori-high">🇬🇧 Cori (British)</option>
                                    <option value="en_US-kristin-medium">Kristin</option>
                                  </optgroup>
                                </select>
                                {hasAudio && <audio controls src={characterAudioUrls[char.characterId]} style={{ height: 24, width: 100 }} />}
                                {hasAudio && <Icon.Check style={{ width: 10, height: 10, color: "#22c55e" }} />}
                              </div>
                            );
                          })}
                        </div>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          {stepBtn(generatingCharVoices ? "Generating voices..." : scriptSegments.some(s => s.type === "dialogue" && s.audioUrl) ? "Regen Voices" : "Gen Per-Line Voices", generatePerLineVoices, generatingCharVoices, purple)}
                          {charVoiceLog && <span style={{ fontSize: 10, color: "#22c55e" }}>{charVoiceLog}</span>}
                        </div>
                        {done4 && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 8 }}>Per-line clips ready — move to Step 5 for narrator</p>}
                      </>
                    )}
                  </div>
                )}

                {stepConnector(done4)}

                {/* ── STEP 5: Narrator Voice ── */}
                {stepHeader(5, done5, "5", "Narrator Voice", done5 ? `Narrator audio ready (${Math.round(narratorAudioDuration / 1000)}s)` : "Generate narrator voice-over for scene narration")}
                {openPipelineStep === 5 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>The narrator reads your story between the scenes. Choose a voice and click Generate. Piper TTS is free and runs locally.</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                      <select value={narratorPiperModel} onChange={e => setNarratorPiperModel(e.target.value)}
                        style={{ ...inputStyle, fontSize: 11, padding: "7px 10px", flex: 1, minWidth: 180 }}>
                        <optgroup label="Male Voices">
                          <option value="en_US-lessac-medium">Lessac — Neutral Male</option>
                          <option value="en_US-ryan-high">Ryan — Clear Male (High)</option>
                          <option value="en_US-joe-medium">Joe — Deep Male</option>
                          <option value="en_US-danny-low">⬛ Danny — Low Male</option>
                          <option value="en_GB-alan-medium">🇬🇧 Alan — British Male</option>
                          <option value="en_US-libritts-high">LibriTTS — Narration</option>
                        </optgroup>
                        <optgroup label="Female Voices">
                          <option value="en_US-amy-medium">Amy — Female</option>
                          <option value="en_US-hfc_female-medium">HFC — Female</option>
                          <option value="en_GB-cori-high">🇬🇧 Cori — British Female</option>
                          <option value="en_US-kristin-medium">Kristin — Female</option>
                        </optgroup>
                      </select>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 90 }}>
                        <label style={{ fontSize: 9, color: muted }}>Speaking Speed</label>
                        <input type="number" min={0.5} max={2} step={0.05} value={narratorPiperSpeed}
                          onChange={e => setNarratorPiperSpeed(Number(e.target.value))}
                          style={{ ...inputStyle, fontSize: 11, padding: "6px 8px", width: 80 }} />
                      </div>
                      {stepBtn(generatingNarration ? "Generating..." : done5 ? "Regenerate" : "Generate Narrator", generateNarrationPiper, generatingNarration || !done1, accent)}
                    </div>
                    {done5 && <audio controls src={narratorAudioUrl!} style={{ width: "100%", height: 36 }} />}
                    {done5 && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 8 }}>Narrator ready — move to Step 6</p>}
                  </div>
                )}

                {stepConnector(done5)}

                {/* ── STEP 6: Background Music ── */}
                {stepHeader(6, done6, "6", "Background Music", done6 ? `Selected: ${selectedMusicName}` : "Choose or AI-pick a music track for your video")}
                {openPipelineStep === 6 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Music plays under narration. AI Pick chooses the best track based on your story mood.</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
                      <button onClick={aiPickMusic} disabled={aiPickingMusic}
                        style={{ padding: "8px 16px", borderRadius: 9, border: "none", background: aiPickingMusic ? "#2a2a40" : `linear-gradient(135deg, ${gold}, #d97706)`, color: aiPickingMusic ? muted : "#000", fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
                        {aiPickingMusic ? "AI Picking..." : "AI Pick"}
                      </button>
                      <button onClick={() => { setShowMusicPicker(p => !p); if (!showMusicPicker && musicLibrary.length === 0) loadMusicLibrary(); }}
                        style={{ padding: "8px 16px", borderRadius: 9, border: `1px solid ${purple}40`, background: `${purple}10`, color: purple, fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                        {showMusicPicker ? "Close Picker" : "Browse Library"}
                      </button>
                      {done6 && <button onClick={() => { setSelectedMusicUrl(null); setSelectedMusicName(""); setAiMusicPickLog(""); }}
                        style={{ padding: "8px 14px", borderRadius: 9, border: `1px solid ${red}30`, background: "transparent", color: red, fontSize: 11, cursor: "pointer" }}>Remove</button>}
                    </div>
                    {aiMusicPickLog && <p style={{ fontSize: 10, color: aiMusicPickLog.startsWith("Selected:") ? accent : muted, marginBottom: 8 }}>{aiMusicPickLog}</p>}
                    {done6 && (
                      <div style={{ marginBottom: 10 }}>
                        <audio controls src={selectedMusicUrl!} style={{ width: "100%", height: 36 }} />
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                          <span style={{ fontSize: 9, color: muted }}>Music Volume:</span>
                          <input type="range" min={0} max={1} step={0.05} value={musicVolume} onChange={e => setMusicVolume(Number(e.target.value))} style={{ flex: 1, accentColor: purple }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: purple, minWidth: 30 }}>{Math.round(musicVolume * 100)}%</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                          <span style={{ fontSize: 9, color: muted }}>Narration Volume:</span>
                          <input type="range" min={0} max={1.5} step={0.05} value={narrationVolume} onChange={e => setNarrationVolume(Number(e.target.value))} style={{ flex: 1, accentColor: "#06b6d4" }} />
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#06b6d4", minWidth: 30 }}>{Math.round(narrationVolume * 100)}%</span>
                        </div>
                      </div>
                    )}
                    {showMusicPicker && (
                      <div style={{ maxHeight: 280, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4, marginTop: 8 }}>
                        {loadingMusic ? <p style={{ fontSize: 11, color: muted }}>Loading…</p> : musicLibrary.length === 0 ? (
                          <div style={{ textAlign: "center", padding: 14 }}>
                            <p style={{ fontSize: 11, color: muted, marginBottom: 8 }}>No music in library yet.</p>
                            <a href="/dashboard/music-studio" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
                              <button style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 10, cursor: "pointer" }}>AI Generate Music</button>
                            </a>
                          </div>
                        ) : musicLibrary.map(track => {
                          const mediaUrl = assetToMediaUrl(track.filePath);
                          const isSelected = selectedMusicUrl === mediaUrl;
                          return (
                            <div key={track.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", borderRadius: 8, background: isSelected ? `${purple}15` : s2, border: `1px solid ${isSelected ? purple : border}`, cursor: "pointer" }}
                              onClick={() => { setSelectedMusicUrl(mediaUrl); setSelectedMusicName(track.name); setShowMusicPicker(false); }}>
                              <Icon.Music style={{ width: 14, height: 14 }} />
                              <span style={{ fontSize: 11, flex: 1, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{track.name}</span>
                              {isSelected && <span style={{ fontSize: 10, color: purple, fontWeight: 700 }}>Selected</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {done6 && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 6 }}>Music selected — move to Step 7</p>}
                    {!done6 && <p style={{ fontSize: 10, color: muted, marginTop: 6 }}>Optional — you can assemble without music.</p>}
                  </div>
                )}

                {stepConnector(done6)}

                {/* ── STEP 7: AI Audio Plan ── */}
                {stepHeader(7, done7, "7", "AI Audio Plan", done7 ? "Audio planned — narration + music mood + SFX per scene" : "AI reads your scenes and plans narration, music mood, SFX")}
                {openPipelineStep === 7 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>AI scans every scene and writes a narration script, picks a music mood, and suggests SFX. This makes your video sound alive.</p>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {stepBtn(preparingNarration ? "AI is planning..." : done7 ? "Re-run Plan" : "AI Plan Audio + SFX", aiPrepareAssembly, preparingNarration || selectedSceneIds.length === 0, "#a855f7")}
                      {selectedSceneIds.length === 0 && <span style={{ fontSize: 10, color: gold }}>Select scenes below first</span>}
                    </div>
                    {preparingNarration && <p style={{ fontSize: 10, color: purple, marginTop: 8 }}>Reading story → writing narration per scene → planning music + SFX…</p>}
                    {done7 && !preparingNarration && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 8 }}>Audio planned — move to Step 8</p>}
                  </div>
                )}

                {stepConnector(done7)}

                {/* ── STEP 8: Settings ── */}
                {stepHeader(8, done8, "8", "Settings", "Subtitle style, intro & outro cards")}
                {openPipelineStep === 8 && (
                  <div style={{ padding: "14px 18px", borderBottom: `1px solid ${border}` }}>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Subtitle Style</p>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 6, marginBottom: 14 }}>
                      {([
                        { key: "classic", icon: "CL", label: "Classic" },
                        { key: "cinema",  icon: "CI", label: "Cinema" },
                        { key: "neon",    icon: "NE", label: "Neon" },
                        { key: "minimal", icon: "MI", label: "Minimal" },
                        { key: "bold",    icon: "🅱",  label: "Bold" },
                        { key: "none",    icon: "NO", label: "None" },
                      ] as const).map(opt => {
                        const isSel = subtitleStyle === opt.key;
                        return (
                          <div key={opt.key} onClick={() => setSubtitleStyle(opt.key)}
                            style={{ padding: "8px 6px", borderRadius: 9, border: `2px solid ${isSel ? accent : border}`, background: isSel ? `${accent}12` : s2, cursor: "pointer", textAlign: "center" }}>
                            <div style={{ fontSize: 18 }}>{opt.icon}</div>
                            <p style={{ fontSize: 10, fontWeight: 700, color: isSel ? accent : muted, margin: "3px 0 0" }}>{opt.label}</p>
                          </div>
                        );
                      })}
                    </div>
                    <p style={{ fontSize: 11, fontWeight: 700, color: "#fff", marginBottom: 8 }}>Intro &amp; Outro</p>
                    <div style={{ display: "flex", gap: 8 }}>
                      <div onClick={() => setIntroEnabled(p => !p)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: introEnabled ? `${accent}08` : s2, border: `1px solid ${introEnabled ? accent : border}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon.Film style={{ width: 12, height: 12 }} />
                          <p style={{ fontSize: 11, fontWeight: 700, color: introEnabled ? accent : muted, margin: 0 }}>Intro Card</p>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: introEnabled ? accent : muted }}>{introEnabled ? "ON" : "OFF"}</span>
                        </div>
                        <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>Studio name + title before Scene 1 (5s)</p>
                      </div>
                      <div onClick={() => setOutroEnabled(p => !p)} style={{ flex: 1, padding: "10px 12px", borderRadius: 10, background: outroEnabled ? `${purple}08` : s2, border: `1px solid ${outroEnabled ? purple : border}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon.Film style={{ width: 12, height: 12 }} />
                          <p style={{ fontSize: 11, fontWeight: 700, color: outroEnabled ? purple : muted, margin: 0 }}>Outro / Credits</p>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: outroEnabled ? purple : muted }}>{outroEnabled ? "ON" : "OFF"}</span>
                        </div>
                        <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>Rolling credits at end (10s)</p>
                      </div>
                    </div>
                    {/* Intro/outro style */}
                    <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                      {(["cinematic", "minimal", "bold", "nollywood"] as const).map(s => (
                        <button key={s} onClick={() => setIntroOutroStyle(s)}
                          style={{ padding: "4px 10px", borderRadius: 7, border: `1px solid ${introOutroStyle === s ? purple : border}`, background: introOutroStyle === s ? `${purple}20` : "transparent", color: introOutroStyle === s ? purple : muted, fontSize: 9, fontWeight: introOutroStyle === s ? 700 : 400, cursor: "pointer", textTransform: "capitalize" }}>
                          {s}
                        </button>
                      ))}
                    </div>

                    {/* Actor / character voices on-off (mirrors the Sound tab control) */}
                    {storyMode !== "narration-only" && (
                      <div onClick={() => setActorVoicesEnabled(v => !v)} style={{ marginTop: 10, padding: "10px 12px", borderRadius: 10, background: actorVoicesEnabled ? `${blue}08` : s2, border: `1px solid ${actorVoicesEnabled ? blue : border}`, cursor: "pointer" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 13 }}>🎭</span>
                          <p style={{ fontSize: 11, fontWeight: 700, color: actorVoicesEnabled ? blue : muted, margin: 0 }}>Actor / Character Voices</p>
                          <span style={{ marginLeft: "auto", fontSize: 10, color: actorVoicesEnabled ? blue : muted }}>{actorVoicesEnabled ? "ON" : "OFF"}</span>
                        </div>
                        <p style={{ fontSize: 9, color: muted, marginTop: 4 }}>{actorVoicesEnabled ? "Character dialogue voiced by actors; narrator ducks while they speak." : "Off — narrator only, no actor voices."}</p>
                      </div>
                    )}
                  </div>
                )}

                {stepConnector(true)}

                {/* ── STEP 9: Assemble ── */}
                {stepHeader(9, done9, "9", "Assemble Movie", done9 ? "Video ready — download or open in editor" : `Ready to build — ${selectedSceneIds.length} scene${selectedSceneIds.length !== 1 ? "s" : ""} selected`)}
                {openPipelineStep === 9 && (
                  <div style={{ padding: "14px 18px" }}>
                    <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>All your scenes, narration, voices, music, and SFX will be combined into one finished video.</p>
                    {/* Mandatory step guard — need story (step 2) at minimum */}
                    {!done2 && (
                      <div style={{ padding: "14px 16px", borderRadius: 10, background: `${red}10`, border: `1px solid ${red}40`, marginBottom: 14, display: "flex", alignItems: "flex-start", gap: 10 }}>
                        <Icon.Alert style={{ width: 20, height: 20, flexShrink: 0, color: muted }} />
                        <div>
                          <p style={{ fontSize: 12, fontWeight: 800, color: red, margin: "0 0 4px" }}>Story required before assembling</p>
                          <p style={{ fontSize: 10, color: "#aaa", margin: "0 0 8px" }}>Please complete <strong style={{ color: gold }}>Step 2 — Story Source</strong> first. Your story is the foundation of the video.</p>
                          <button onClick={() => setOpenPipelineStep(2)}
                            style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                            Go to Step 2
                          </button>
                        </div>
                      </div>
                    )}
                    {/* Summary row */}
                    <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                      {[
                        { label: "Scenes", value: selectedSceneIds.length, color: accent },
                        { label: "Est. Duration", value: `${scenes.filter(s => selectedSceneIds.includes(s.sceneId)).reduce((n, s) => n + (s.motionDuration || 5), 0)}s`, color: gold },
                        { label: "Actors", value: done4 ? `${Object.keys(characterAudioUrls).length} voices` : "Not yet", color: done4 ? "#22c55e" : muted },
                        { label: "Narrator", value: done5 ? "Ready" : "Not yet", color: done5 ? "#22c55e" : muted },
                        { label: "Music", value: done6 ? selectedMusicName.slice(0, 12) || "OK" : "None", color: done6 ? "#22c55e" : muted },
                      ].map(item => (
                        <div key={item.label} style={{ flex: 1, minWidth: 80, textAlign: "center", padding: "8px 10px", background: s2, borderRadius: 9, border: `1px solid ${border}` }}>
                          <p style={{ fontSize: 15, fontWeight: 800, color: item.color, margin: 0 }}>{item.value}</p>
                          <p style={{ fontSize: 8, color: muted, textTransform: "uppercase", letterSpacing: 0.5, margin: "2px 0 0" }}>{item.label}</p>
                        </div>
                      ))}
                    </div>
                    {/* ── Audio plan review — shows what will be mixed ── */}
                    <div style={{ marginBottom: 12, padding: "10px 12px", borderRadius: 10, background: s2, border: `1px solid ${border}` }}>
                      <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Audio Plan</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#fff" }}>Story Mode</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: accent }}>{storyMode === "narration-only" ? "Narration Only" : storyMode === "actors-only" ? "Actor Voices Only" : "Mixed (Narration + Actors)"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#fff" }}>Narrator</span>
                          <span style={{ fontSize: 11, color: narratorAudioUrl && storyMode !== "actors-only" ? "#22c55e" : muted }}>{narratorAudioUrl && storyMode !== "actors-only" ? "Will play" : narratorAudioUrl ? "Skipped (Actor mode)" : "None"}</span>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#fff" }}>Character Voices</span>
                          <span style={{ fontSize: 11, color: Object.keys(characterAudioUrls).length > 0 && storyMode !== "narration-only" ? "#22c55e" : muted }}>
                            {Object.keys(characterAudioUrls).length > 0 && storyMode !== "narration-only" ? `${Object.keys(characterAudioUrls).length} voice(s)` : Object.keys(characterAudioUrls).length > 0 ? "Skipped (Narration mode)" : "None"}
                          </span>
                        </div>
                      </div>
                      {(narratorAudioUrl || Object.keys(characterAudioUrls).length > 0) && (
                        <button
                          onClick={() => { setNarratorAudioUrl(null); setNarratorAudioDuration(0); setCharacterAudioUrls({}); setScriptSegments([]); setShowScriptReview(false); setLastAction("Narration cleared — ready for fresh assembly"); }}
                          style={{ marginTop: 8, width: "100%", padding: "6px", borderRadius: 7, border: `1px solid ${red}50`, background: `${red}10`, color: red, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                          Clear All Narration & Voices (start fresh)
                        </button>
                      )}
                    </div>

                    {/* ── Pre-Flight AI Review ── */}
                    <div data-testid="pre-assembly-review" style={{ background: surface, border: `1px solid ${preflightResult ? (preflightResult.blockingErrors > 0 ? `${red}40` : preflightResult.warnings > 0 ? `${gold}40` : `${accent}40`) : `${purple}30`}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Icon.Star style={{ width: 15, height: 15, color: purple, flexShrink: 0 }} />
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>AI Audio & Audit</p>
                        </div>
                        {preflightResult && (
                          <div style={{ display: "flex", gap: 6 }}>
                            {preflightResult.blockingErrors > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${red}20`, color: red, fontWeight: 700 }}>{preflightResult.blockingErrors} error{preflightResult.blockingErrors !== 1 ? "s" : ""}</span>}
                            {preflightResult.warnings > 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${gold}20`, color: gold, fontWeight: 700 }}>{preflightResult.warnings} warning{preflightResult.warnings !== 1 ? "s" : ""}</span>}
                            {preflightResult.canAssemble && preflightResult.warnings === 0 && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: `${accent}20`, color: accent, fontWeight: 700 }}>Ready</span>}
                          </div>
                        )}
                      </div>
                      <button onClick={runPreflight} disabled={preflightRunning}
                        style={{ width: "100%", padding: "11px", borderRadius: 10, border: `1px solid ${purple}60`, background: preflightRunning ? "#2a2040" : purple, color: "#fff", fontSize: 12, fontWeight: 700, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0, letterSpacing: "-0.01em" }}>
                        {preflightRunning ? "⟳ Running checks…" : "▶ Run Pre-Flight Check"}
                      </button>
                      {preflightResult && (
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          {preflightResult.checks.map(check => (
                            <div key={check.id} style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "8px 10px", borderRadius: 8, background: check.status === "ok" ? `${accent}08` : check.status === "warn" ? `${gold}08` : `${red}08`, border: `1px solid ${check.status === "ok" ? accent : check.status === "warn" ? gold : red}20` }}>
                              <span style={{ fontSize: 12, flexShrink: 0, marginTop: 1 }}>{check.status === "ok" ? "✓" : check.status === "warn" ? "⚠" : "✗"}</span>
                              <div>
                                <p style={{ fontSize: 11, fontWeight: 600, color: check.status === "ok" ? accent : check.status === "warn" ? gold : red }}>{check.label}</p>
                                {check.detail && <p style={{ fontSize: 10, color: muted, marginTop: 2 }}>{check.detail}</p>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Auto-select all scenes if none selected (edge case recovery) */}
                    {done2 && scenes.length > 0 && selectedSceneIds.length === 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: 10, background: `${gold}10`, border: `1px solid ${gold}30`, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <p style={{ fontSize: 11, color: gold, margin: 0 }}>No scenes selected — select scenes in the panel above or click Select All</p>
                        <button onClick={() => setSelectedSceneIds(scenes.map(s => s.sceneId))}
                          style={{ padding: "5px 14px", borderRadius: 7, border: "none", background: gold, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer", flexShrink: 0, marginLeft: 10 }}>
                          Select All
                        </button>
                      </div>
                    )}

                    {/* 2026-05-10 — Image-count preview panel.
                        Henry's spec: "I need a image pick preview page during assemble to see image
                        count not image but image count via text". Per-scene text-only summary so user
                        verifies what's going into the build before clicking Assemble.
                        Total at the bottom = total assembly segments the video will produce. */}
                    {selectedSceneIds.length > 0 && (() => {
                      const orderedScenes = scenes.filter(s => selectedSceneIds.includes(s.sceneId));
                      // P2-C: count reflects auto-expand (no optedIn gate)
                      const totalStoryCharsPreview = orderedScenes.reduce((sum, s) => {
                        const segText = scriptSegments.filter(seg => seg.sceneId === s.sceneId).map(seg => seg.text || "").join(" ");
                        return sum + Math.max((segText || s.narrationScript || s.description || s.title || "").length, 20);
                      }, 0);
                      const narrDurSec = narratorAudioDuration > 0 ? narratorAudioDuration / 1000 : 0;

                      const rows = orderedScenes.map(s => {
                        const sid = s.sceneId;
                        const allBeats = sceneBeatImages[sid] || [];
                        const varPool = [sceneImages[sid], ...(prevSceneImages[sid] || [])].filter((u): u is string => !!u);
                        const beatPool = allBeats.length > 1 ? allBeats : (varPool.length > 1 ? varPool : null);
                        const ticked = beatPool
                          ? beatPool.filter((_, bi) => selectedBeatImages[sid]?.[bi] !== false).length
                          : 0;
                        const hasVideo = !!sceneVideos[sid];
                        const hasImg = !!sceneImages[sid];
                        const sceneFlipSec = Math.max(1, s.flipOverride ?? effectiveFlipSeconds);
                        // How many images does the narration need for this scene?
                        const segText = scriptSegments.filter(seg => seg.sceneId === sid).map(seg => seg.text || "").join(" ");
                        const sceneChars = Math.max((segText || s.narrationScript || s.description || s.title || "").length, 20);
                        const sceneFrac = totalStoryCharsPreview > 0 ? sceneChars / totalStoryCharsPreview : 0;
                        const sceneNarrSec = narrDurSec > 0 ? sceneFrac * narrDurSec : 0;
                        const imgsNeeded = sceneNarrSec > 0 ? Math.ceil(sceneNarrSec / sceneFlipSec) : 0;
                        let count = 0;
                        let label = "";
                        if (hasVideo) {
                          count = 1; label = "video";
                        } else if (beatPool && ticked > 1) {
                          count = ticked; label = `${ticked} images`;
                        } else if (hasImg) {
                          count = 1; label = "1 image";
                        } else {
                          count = 0; label = "NO MEDIA";
                        }
                        const deficit = !hasVideo && imgsNeeded > 0 ? Math.max(0, imgsNeeded - count) : 0;
                        return { sid, title: s.title, count, label, allBeats: allBeats.length, ticked, imgsNeeded, deficit, sceneFlipSec, scene: s };
                      });
                      const totalSegments = rows.reduce((sum, r) => sum + r.count, 0);
                      const noMedia = rows.filter(r => r.count === 0).length;
                      const totalDeficit = rows.reduce((sum, r) => sum + r.deficit, 0);
                      return (
                        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#ff95000a", border: "1px solid #ff950030", marginBottom: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                            <p style={{ fontSize: 11, fontWeight: 700, color: "#ff9500", margin: 0 }}>
                              📊 Pre-assembly preview — {totalSegments} total segments
                            </p>
                            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                              {noMedia > 0 && (
                                <span style={{ fontSize: 10, color: red, fontWeight: 700 }}>⚠ {noMedia} no media</span>
                              )}
                              {totalDeficit > 0 && (
                                <span style={{ fontSize: 10, color: gold, fontWeight: 700 }}>⚠ {totalDeficit} more images needed</span>
                              )}
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 2, maxHeight: 200, overflowY: "auto" as const, fontFamily: "monospace" as const, fontSize: 10 }}>
                            {rows.map(r => (
                              <div key={r.sid} style={{ display: "flex", gap: 8, color: r.count === 0 ? red : "#ddd" }}>
                                <span style={{ minWidth: 48, color: r.count === 0 ? red : "#ff9500" }}>{r.sid}</span>
                                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>{r.title}</span>
                                <span style={{ color: r.count === 0 ? red : r.count > 1 ? "#ff9500" : muted }}>→ {r.label}</span>
                                {r.deficit > 0 && (
                                  <span style={{ color: gold, fontSize: 9 }}>need +{r.deficit}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {/* ── Phase 2-D: Per-scene image sufficiency check ── */}
                    {narratorAudioDuration > 0 && selectedSceneIds.length > 0 && (() => {
                      const narrSec = narratorAudioDuration / 1000;
                      const selectedScenes = scenes.filter(s => selectedSceneIds.includes(s.sceneId));
                      const totalChars = selectedScenes.reduce((sum, s) => {
                        const segText = scriptSegments.filter(seg => seg.sceneId === s.sceneId).map(seg => seg.text || "").join(" ");
                        return sum + Math.max((segText || s.narrationScript || s.description || s.title || "").length, 20);
                      }, 0);
                      const deficitRows = selectedScenes.map(s => {
                        if (sceneVideos[s.sceneId]) return null;  // video scenes skip
                        const segText = scriptSegments.filter(seg => seg.sceneId === s.sceneId).map(seg => seg.text || "").join(" ");
                        const chars = Math.max((segText || s.narrationScript || s.description || s.title || "").length, 20);
                        const frac = totalChars > 0 ? chars / totalChars : 0;
                        const sceneNarrSec = frac * narrSec;
                        const sceneFlipSec = Math.max(1, s.flipOverride ?? effectiveFlipSeconds);
                        const needed = Math.ceil(sceneNarrSec / sceneFlipSec);
                        const allBeats = sceneBeatImages[s.sceneId] || [];
                        const varPool = [sceneImages[s.sceneId], ...(prevSceneImages[s.sceneId] || [])].filter((u): u is string => !!u);
                        const beatPool = allBeats.length > 1 ? allBeats : (varPool.length > 1 ? varPool : null);
                        const have = beatPool
                          ? beatPool.filter((_, bi) => selectedBeatImages[s.sceneId]?.[bi] !== false).length
                          : (sceneImages[s.sceneId] ? 1 : 0);
                        const deficit = Math.max(0, needed - have);
                        return deficit > 0 ? { sid: s.sceneId, title: s.title, needed, have, deficit, scene: s } : null;
                      }).filter((r): r is NonNullable<typeof r> => r !== null);

                      if (deficitRows.length === 0) return null;
                      return (
                        <div style={{ padding: "10px 14px", borderRadius: 10, background: "#f59e0b08", border: "1px solid #f59e0b30", marginBottom: 10 }}>
                          <p style={{ fontSize: 11, fontWeight: 700, color: gold, margin: "0 0 8px" }}>
                            ⚠ Narration longer than available images — {deficitRows.reduce((s, r) => s + r.deficit, 0)} more images needed
                          </p>
                          <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                            {deficitRows.map(r => (
                              <div key={r.sid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 7, background: "#f59e0b08", border: "1px solid #f59e0b20" }}>
                                <span style={{ fontSize: 10, color: gold, fontWeight: 700, minWidth: 40 }}>{r.sid}</span>
                                <span style={{ fontSize: 10, color: "#ddd", flex: 1, overflow: "hidden", textOverflow: "ellipsis" as const, whiteSpace: "nowrap" as const }}>{r.title}</span>
                                <span style={{ fontSize: 9, color: muted, flexShrink: 0 }}>{r.have}/{r.needed} imgs</span>
                                <button
                                  onClick={async () => {
                                    await makeSceneBeatImages(r.scene, r.deficit);
                                    setUseMaxImageScenes(prev => new Set(prev).add(r.sid));
                                  }}
                                  disabled={generatingMaxBeats.has(r.sid)}
                                  style={{ padding: "3px 8px", borderRadius: 5, border: "none", background: generatingMaxBeats.has(r.sid) ? "#2a2040" : gold, color: generatingMaxBeats.has(r.sid) ? muted : "#000", fontSize: 9, fontWeight: 700, cursor: generatingMaxBeats.has(r.sid) ? "not-allowed" : "pointer", flexShrink: 0, whiteSpace: "nowrap" as const }}>
                                  {generatingMaxBeats.has(r.sid) ? (maxBeatsProgress[r.sid] || "Generating…") : `+ Generate ${r.deficit} more`}
                                </button>
                              </div>
                            ))}
                            <p style={{ fontSize: 9, color: muted, margin: "4px 0 0" }}>
                              Or reduce Image Flip Time above to fit more narration into fewer images.
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                    {/* ── Narration / Audio / Subtitle readiness status ── */}
                    <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, marginBottom: 10 }}>
                      {/* Narration status */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, background: narratorAudioUrl ? "#00cc4408" : "#ff950010", border: `1px solid ${narratorAudioUrl ? "#00cc4430" : "#ff950040"}` }}>
                        <span style={{ fontSize: 13 }}>{narratorAudioUrl ? "✅" : "⚠️"}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: narratorAudioUrl ? "#00cc44" : "#ff9500" }}>
                          {narratorAudioUrl
                            ? `Narration ready${narratorAudioDuration > 0 ? ` · ${Math.round(narratorAudioDuration / 1000)}s` : ""}`
                            : "No narration — will auto-generate before assembly (adds ~30s)"}
                        </span>
                        {narratorAudioUrl && (
                          <span style={{ fontSize: 10, color: muted, marginLeft: "auto" }}>Step 4 ✓</span>
                        )}
                      </div>
                      {/* Music status */}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, background: selectedMusicUrl ? "#00cc4408" : "#ffffff06", border: `1px solid ${selectedMusicUrl ? "#00cc4430" : border}` }}>
                        <span style={{ fontSize: 13 }}>{selectedMusicUrl ? "✅" : "➖"}</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: selectedMusicUrl ? "#00cc44" : muted }}>
                          {selectedMusicUrl ? `Music: ${selectedMusicName || "track selected"}` : "No background music selected (optional)"}
                        </span>
                      </div>
                      {/* Subtitle status — reads effectiveSubtitleConfig.mode (SubtitleStyler source of truth) */}
                      {(() => {
                        const subsOn = effectiveSubtitleConfig.mode !== "none";
                        const subsLabel = subsOn ? `Subtitles: ${effectiveSubtitleConfig.mode}${subtitleStyle !== "none" && subtitleStyle !== "classic" ? ` / ${subtitleStyle}` : ""}` : "Subtitles off";
                        return (
                          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderRadius: 8, background: subsOn ? "#00cc4408" : "#ffffff06", border: `1px solid ${subsOn ? "#00cc4430" : border}` }}>
                            <span style={{ fontSize: 13 }}>{subsOn ? "✅" : "➖"}</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: subsOn ? "#00cc44" : muted }}>{subsLabel}</span>
                          </div>
                        );
                      })()}
                    </div>
                    {/* ── Image Flip Time panel — prominent, above Assemble button ── */}
                    <div style={{ padding: "12px 14px", borderRadius: 10, background: "#a855f708", border: "1px solid #a855f730", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                        <p style={{ fontSize: 11, fontWeight: 700, color: accent, margin: 0 }}>
                          🖼 Image Flip Time — each image shows for {effectiveFlipSeconds}s
                        </p>
                        <span style={{ fontSize: 9, color: muted }}>saved to project</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" as const }}>
                        {[1, 2, 3, 5, 8].map(s => (
                          <button key={s}
                            onClick={() => patchProjectSettings({ imageFlipSeconds: s })}
                            style={{
                              padding: "5px 12px", borderRadius: 6,
                              border: `1px solid ${effectiveFlipSeconds === s ? accent : border}`,
                              background: effectiveFlipSeconds === s ? accent : "transparent",
                              color: effectiveFlipSeconds === s ? "#fff" : muted,
                              fontSize: 10, fontWeight: 700, cursor: "pointer",
                            }}>
                            {s}s{s === 1 ? " fast" : s === 3 ? " default" : s === 5 ? " cinematic" : ""}
                          </button>
                        ))}
                        <label style={{ display: "flex", alignItems: "center", gap: 4, marginLeft: 4 }}>
                          <span style={{ fontSize: 10, color: muted }}>custom:</span>
                          <input
                            type="number" min={1} max={30} value={effectiveFlipSeconds}
                            onChange={e => {
                              const v = Math.max(1, Math.min(30, Number(e.target.value) || 3));
                              patchProjectSettings({ imageFlipSeconds: v });
                            }}
                            style={{ width: 44, padding: "4px 6px", borderRadius: 6, border: `1px solid ${border}`, background: "#1a1a2e", color: "#fff", fontSize: 10, textAlign: "center" as const }}
                          />
                          <span style={{ fontSize: 10, color: muted }}>s</span>
                        </label>
                      </div>
                      {/* Live segment count preview */}
                      {(() => {
                        const imageScenesCount = selectedSceneIds.filter(sid => {
                          const s = scenes.find(sc => sc.sceneId === sid);
                          if (!s) return false;
                          const hasVideo = !!sceneVideos[sid];
                          return !hasVideo;
                        }).length;
                        if (imageScenesCount === 0) return null;
                        const avgImages = (() => {
                          let total = 0;
                          let count = 0;
                          for (const sid of selectedSceneIds) {
                            const beats = sceneBeatImages[sid];
                            const isMaxOn = useMaxImageScenes.has(sid);
                            if (isMaxOn && beats && beats.length > 1) {
                              const ticked = (selectedBeatImages[sid] || []).filter(Boolean).length;
                              total += ticked || 1;
                            } else {
                              total += 1;
                            }
                            count++;
                          }
                          return count > 0 ? (total / count).toFixed(1) : "1";
                        })();
                        const totalImgSegments = (() => {
                          let t = 0;
                          for (const sid of selectedSceneIds) {
                            const beats = sceneBeatImages[sid];
                            const isMaxOn = useMaxImageScenes.has(sid);
                            if (isMaxOn && beats && beats.length > 1) {
                              t += (selectedBeatImages[sid] || []).filter(Boolean).length || 1;
                            } else {
                              t += 1;
                            }
                          }
                          return t;
                        })();
                        const estDur = totalImgSegments * effectiveFlipSeconds;
                        return (
                          <p style={{ fontSize: 9, color: muted, margin: "6px 0 0" }}>
                            {selectedSceneIds.length} scenes · avg {avgImages} images/scene · ~{estDur}s total image duration
                          </p>
                        );
                      })()}
                    </div>
                    <button
                      onClick={() => {
                        if (assemblyOrder.length > 0) {
                          setScenes(prev => {
                            const ordered = [...assemblyOrder.map(id => prev.find(s => s.sceneId === id)).filter(Boolean) as typeof prev, ...prev.filter(s => !assemblyOrder.includes(s.sceneId))];
                            return ordered.map((s, i) => ({ ...s, scene: i + 1, sceneId: `SC${String(i + 1).padStart(2, "0")}` }));
                          });
                        }
                        assembleScenes();
                      }}
                      disabled={assembling || selectedSceneIds.length === 0 || !done2}
                      style={{ width: "100%", padding: "16px", borderRadius: 12, border: "none", background: (assembling || selectedSceneIds.length === 0 || !done2) ? "#2a2a40" : `linear-gradient(135deg, ${accent}, #0088cc)`, color: (assembling || selectedSceneIds.length === 0 || !done2) ? muted : "#fff", fontSize: 15, fontWeight: 800, cursor: (assembling || selectedSceneIds.length === 0 || !done2) ? "not-allowed" : "pointer", marginBottom: 10 }}>
                      {assembling ? "Assembling your movie... please wait" : !done2 ? "Complete Step 2 to unlock" : selectedSceneIds.length === 0 ? "Select scenes above to unlock" : `Assemble My Movie (${selectedSceneIds.length} scenes)`}
                    </button>
                    {/* Live status bar — shows during assembly and ears check */}
                    {(assembling || assemblyComplete) && lastAction && (
                      <div style={{
                        padding: "10px 14px", borderRadius: 10, marginBottom: 8,
                        background: "#0d1020",
                        border: `1px solid ${accent}30`,
                        display: "flex", alignItems: "center", gap: 8,
                      }}>
                        <span style={{ fontSize: 14 }}>
                          "·"
                        </span>
                        <p style={{
                          fontSize: 11, fontWeight: 600, margin: 0,
                          color: accent,
                        }}>{lastAction}</p>
                      </div>
                    )}

                    {/* Assembly progress — scene-by-scene checklist */}
                    {(assembling || assemblyComplete) && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
                        {scenes.filter(s => selectedSceneIds.includes(s.sceneId)).map(scene => {
                          const status = assemblyProgress[scene.scene] || "queued";
                          return (
                            <div key={scene.sceneId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 10px", borderRadius: 7, background: s2, border: `1px solid ${border}` }}>
                              <span style={{ fontSize: 11, color: status === "done" ? "#22c55e" : status === "processing" ? gold : muted }}>{status === "done" ? "Done" : status === "processing" ? "⟳" : "○"}</span>
                              <p style={{ fontSize: 11, color: "#fff", flex: 1 }}>{scene.sceneId}: {scene.title}</p>
                              <span style={{ fontSize: 9, color: muted }}>{status}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {/* Assembled video */}
                    {assembledVideoUrl && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", marginBottom: 8 }}>Movie Ready!</p>
                        <video controls src={assembledVideoUrl} style={{ width: "100%", borderRadius: 12, background: "#000" }} />
                        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                          <a href={assembledVideoUrl} download style={{ flex: 1, textDecoration: "none" }}>
                            <button style={{ ...btnPrimary, width: "100%", background: accent }}>⬇ Download</button>
                          </a>
                          <a href={`/dashboard/video-editor?videoUrl=${encodeURIComponent(assembledVideoUrl)}`} style={{ flex: 1, textDecoration: "none" }}>
                            <button style={{ ...btnPrimary, width: "100%", background: purple }}>Open in Editor</button>
                          </a>
                          <button onClick={() => setActiveTab("screenplay")}
                            style={{ ...btnPrimary, background: "#2a2a40", border: `1px solid ${purple}40`, color: purple }}>Screenplay</button>
                        </div>
                        {/* Quick links to find the video in other parts of GHS */}
                        <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                          <a href="/dashboard/assets?type=video" target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
                            <button style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${accent}30`, background: `${accent}08`, color: accent, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                              View in Asset Library
                            </button>
                          </a>
                          <a href="/dashboard/review" target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
                            <button style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${gold}30`, background: `${gold}08`, color: gold, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                              Review Queue
                            </button>
                          </a>
                          <a href="/dashboard/registry" target="_blank" rel="noopener noreferrer" style={{ flex: 1, textDecoration: "none" }}>
                            <button style={{ width: "100%", padding: "7px 10px", borderRadius: 8, border: `1px solid ${purple}30`, background: `${purple}08`, color: purple, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                              All Content
                            </button>
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SCREENPLAY TAB                                                     */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "screenplay" && (
        <div>
          {/* ── Setup panel — only shown when no screenplay yet ── */}
          {!screenplay && !generatingScreenplay && (
            <div style={{ ...cardStyle, borderColor: `${purple}20`, marginBottom: 16 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Write the Official Screenplay</p>

              {!expandedSummary ? (
                <div style={{ textAlign: "center", padding: "16px 0" }}>
                  <p style={{ fontSize: 11, color: muted, marginBottom: 12 }}>Expand your story first — go to Story & Draft and click "Expand with AI".</p>
                  <button onClick={() => setActiveTab("story")} style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>Go to Story</button>
                </div>
              ) : (
                <>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: muted, flexShrink: 0 }}>Written by:</span>
                    <input
                      type="text"
                      value={screenplayAuthor}
                      onChange={e => setScreenplayAuthor(e.target.value)}
                      placeholder="Enter your name"
                      style={{ flex: 1, background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 13, fontWeight: 600, outline: "none", maxWidth: 280 }}
                    />
                  </div>
                  {screenplayError && <p style={{ fontSize: 11, color: red, marginBottom: 8 }}>{screenplayError}</p>}
                  <button onClick={generateScreenplay}
                    style={{ padding: "10px 28px", borderRadius: 10, border: "none", background: "linear-gradient(135deg, #a855f7, #7c3aed)", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                    Write Screenplay
                  </button>
                </>
              )}
            </div>
          )}

          {/* ── Loading ── */}
          {generatingScreenplay && (
            <div style={{ textAlign: "center", padding: "60px 20px" }}>
              <Icon.Wand style={{ width: 36, height: 36, marginBottom: 12, color: accent }} />
              <p style={{ fontSize: 15, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Writing your screenplay...</p>
              <p style={{ fontSize: 11, color: muted }}>15–30 seconds</p>
            </div>
          )}

          {/* ── Screenplay paper — full clean view ── */}
          {screenplay && !generatingScreenplay && (
            <>
              {/* Minimal toolbar */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: "auto" }}>
                  <span style={{ fontSize: 10, color: muted }}>Written by:</span>
                  <input
                    type="text"
                    value={screenplayAuthor}
                    onChange={e => setScreenplayAuthor(e.target.value)}
                    placeholder="Your name"
                    style={{ background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 12, fontWeight: 600, outline: "none", width: 160 }}
                  />
                </div>
                <button onClick={generateScreenplay}
                  style={{ padding: "7px 14px", borderRadius: 8, border: `1px solid ${purple}40`, background: "transparent", color: purple, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                  Regenerate
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([screenplay], { type: "text/plain" });
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `${projectTitle || "screenplay"}.txt`;
                    a.click();
                  }}
                  style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: accent, color: "#000", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                  Download .txt
                </button>
                <button
                  onClick={sendScreenplayToScenes}
                  disabled={sendingToScenes || scenes.length === 0}
                  style={{ padding: "7px 16px", borderRadius: 8, border: "none", background: sendingToScenes ? `${gold}60` : `linear-gradient(135deg, ${gold}, #d97706)`, color: "#000", fontSize: 11, fontWeight: 700, cursor: sendingToScenes || scenes.length === 0 ? "default" : "pointer", opacity: scenes.length === 0 ? 0.4 : 1 }}>
                  {sendingToScenes ? "Sending..." : "Send to Scenes →"}
                </button>
              </div>

              {/* Send result message */}
              {sendToScenesResult && (
                <div style={{ marginBottom: 12, padding: "8px 14px", borderRadius: 8, background: `${accent}10`, border: `1px solid ${accent}30`, display: "flex", alignItems: "center", gap: 10 }}>
                  <Icon.Check style={{ width: 14, height: 14, color: accent }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 11, color: accent, lineHeight: 1.5 }}>{sendToScenesResult}</p>
                  </div>
                  <button onClick={() => setActiveTab("audio")}
                    style={{ padding: "6px 12px", borderRadius: 7, border: "none", background: accent, color: "#000", fontSize: 10, fontWeight: 700, cursor: "pointer", flexShrink: 0 }}>
                    Go to Audio
                  </button>
                </div>
              )}

              {/* Paper */}
              <div style={{ background: "#fff", borderRadius: 12, padding: "56px 48px", maxWidth: 780, margin: "0 auto", boxShadow: "0 8px 40px rgba(0,0,0,0.5)", fontFamily: "'Courier New', Courier, monospace" }}>

                {/* ── TITLE PAGE ── */}
                <div style={{ textAlign: "center", marginBottom: 56, paddingBottom: 40, borderBottom: "1px solid #ddd" }}>
                  <p style={{ fontSize: 10, color: "#666", letterSpacing: 4, textTransform: "uppercase", marginBottom: 2 }}>GIO HOME AI STUDIO</p>
                  <p style={{ fontSize: 10, color: "#999", marginBottom: 28, letterSpacing: 1 }}>presents</p>
                  <h1 style={{ fontSize: 26, fontWeight: 900, color: "#000", textTransform: "uppercase", letterSpacing: 3, marginBottom: 10, lineHeight: 1.2 }}>
                    {(projectTitle || "UNTITLED").toUpperCase()}
                  </h1>
                  {(genre || tone) && (
                    <p style={{ fontSize: 11, color: "#777", marginBottom: 32, fontStyle: "italic" }}>
                      {[genre, tone].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p style={{ fontSize: 11, color: "#555", marginBottom: 4 }}>Written by</p>
                  <p style={{ fontSize: 16, fontWeight: 700, color: "#000", marginBottom: 28, letterSpacing: 1 }}>
                    {screenplayAuthor || "—"}
                  </p>
                  <p style={{ fontSize: 9, color: "#888", marginBottom: 2 }}>AI Characters &amp; Assets created by</p>
                  <p style={{ fontSize: 11, fontWeight: 700, color: "#444", marginBottom: 32, letterSpacing: 2 }}>GIO HOME AI STUDIO</p>

                  {/* Cast */}
                  {characters.length > 0 && (
                    <div style={{ display: "inline-block", textAlign: "left", minWidth: 300, marginTop: 8 }}>
                      <p style={{ fontSize: 9, fontWeight: 700, color: "#666", letterSpacing: 3, textTransform: "uppercase", marginBottom: 10, borderBottom: "1px solid #eee", paddingBottom: 6 }}>CAST</p>
                      {characters.map(c => (
                        <div key={c.characterId} style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: "#000", minWidth: 90 }}>{c.displayName.toUpperCase()}</span>
                          <span style={{ flex: 1, borderBottom: "1px dotted #ccc", margin: "0 4px 3px" }} />
                          <span style={{ fontSize: 10, color: "#666" }}>{c.species || c.roleType} · {c.roleType}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <p style={{ fontSize: 9, color: "#bbb", marginTop: 28, letterSpacing: 1 }}>
                    © {new Date().getFullYear()} {screenplayAuthor || "GIO HOME AI STUDIO"} / GIO HOME AI STUDIO. All rights reserved.
                  </p>
                </div>

                {/* ── SCREENPLAY BODY ── */}
                <div style={{ color: "#111", fontSize: 12, lineHeight: 2 }}>
                  {screenplay.split("\n").map((line, i) => {
                    const trimmed = line.trim();
                    if (trimmed === "") return <div key={i} style={{ height: 6 }} />;

                    // Scene headings
                    if (/^(INT\.|EXT\.|INT\/EXT\.)/.test(trimmed)) {
                      return <p key={i} style={{ fontWeight: 700, color: "#000", marginTop: 28, marginBottom: 2, letterSpacing: 0.5 }}>{trimmed}</p>;
                    }
                    // Transitions
                    if (/^(FADE IN:|FADE OUT\.|CUT TO:|DISSOLVE TO:|SMASH CUT:)/.test(trimmed)) {
                      return <p key={i} style={{ fontStyle: "italic", color: "#555", marginTop: 16, marginBottom: 4 }}>{trimmed}</p>;
                    }
                    // THE END
                    if (trimmed === "THE END") {
                      return <p key={i} style={{ textAlign: "center", fontWeight: 900, fontSize: 16, color: "#000", marginTop: 40, letterSpacing: 4 }}>THE END</p>;
                    }
                    // Character name (all caps, short)
                    if (/^[A-Z][A-Z\s\-'().]+$/.test(trimmed) && trimmed.length < 40 && !trimmed.startsWith("INT") && !trimmed.startsWith("EXT") && !trimmed.startsWith("FADE") && !trimmed.startsWith("CUT")) {
                      return <p key={i} style={{ fontWeight: 700, color: "#000", marginTop: 20, marginBottom: 0, paddingLeft: "38%" }}>{trimmed}</p>;
                    }
                    // Parentheticals
                    if (trimmed.startsWith("(") && trimmed.endsWith(")")) {
                      return <p key={i} style={{ fontStyle: "italic", color: "#555", paddingLeft: "30%", marginBottom: 0, marginTop: 0 }}>{trimmed}</p>;
                    }
                    // Dialogue (lines after character name — check previous non-empty line)
                    const prevNonEmpty = screenplay.split("\n").slice(0, i).reverse().find(l => l.trim());
                    const isDialogue = prevNonEmpty && (/^[A-Z][A-Z\s\-'().]+$/.test(prevNonEmpty.trim()) || (prevNonEmpty.trim().startsWith("(") && prevNonEmpty.trim().endsWith(")")));
                    if (isDialogue) {
                      return <p key={i} style={{ color: "#222", paddingLeft: "20%", paddingRight: "20%", marginBottom: 0 }}>{line}</p>;
                    }
                    // Action line
                    return <p key={i} style={{ color: "#333", marginBottom: 2 }}>{line}</p>;
                  })}
                </div>

                {/* Footer */}
                <div style={{ marginTop: 56, paddingTop: 20, borderTop: "1px solid #eee", textAlign: "center" }}>
                  <p style={{ fontSize: 8, color: "#ccc", letterSpacing: 2, textTransform: "uppercase" }}>
                    GIO HOME AI STUDIO · AI-GENERATED ASSETS · {screenplayAuthor ? `OWNED BY ${screenplayAuthor.toUpperCase()}` : "ALL RIGHTS RESERVED"}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* TRENDS / ONLINE INTELLIGENCE TAB                                  */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {activeTab === "trends" && (
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Online Intelligence & Trends</h2>
          <p style={{ fontSize: 12, color: muted, marginBottom: 20 }}>Advisory insights to improve your project. AI searches for viral angles, trending topics, and audience attention patterns.</p>

          {/* Trend categories */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 16 }}>
            {[
              { title: "Viral Angles", desc: "What content formats are getting the most engagement right now", icon: "1", color: "#ef4444" },
              { title: "Audience Attention", desc: "Where audience focus is strongest — hooks, pacing, emotional beats", icon: "2", color: accent },
              { title: "Trending Topics", desc: "Rising topics and keywords in your niche and region", icon: "3", color: blue },
              { title: "Hook Suggestions", desc: "Opening patterns that capture attention in the first 3 seconds", icon: "4", color: purple },
              { title: "Culture & Region", desc: "Local cultural signals, language trends, regional content style", icon: "5", color: gold },
              { title: "Content Format", desc: "Which format (reel, story, hybrid, tutorial) performs best now", icon: "6", color: "#ec4899" },
            ].map(t => (
              <div key={t.title} style={{ ...cardStyle, cursor: "pointer", borderColor: `${t.color}20` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 20 }}>{t.icon}</span>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{t.title}</p>
                </div>
                <p style={{ fontSize: 10, color: muted, lineHeight: 1.5 }}>{t.desc}</p>
                <button style={{ marginTop: 10, padding: "6px 14px", borderRadius: 8, border: `1px solid ${t.color}30`, background: `${t.color}06`, color: t.color, fontSize: 10, fontWeight: 600, cursor: "pointer" }}>
                  Search with AI
                </button>
              </div>
            ))}
          </div>

          <div style={{ ...cardStyle, borderColor: `${gold}20`, background: `${gold}04` }}>
            <p style={{ fontSize: 11, color: gold, fontWeight: 600, marginBottom: 6 }}>How Trend Intelligence Works</p>
            <p style={{ fontSize: 10, color: muted, lineHeight: 1.6 }}>
              GHS Standard: Local AI summarizes cached trend data. GHS Pro: Cloud AI searches live data and provides specific recommendations for your project. Trends are advisory only — they suggest improvements but never auto-rewrite your content.
            </p>
          </div>
        </div>
      )}

      {/* ── Import Images from Library Modal ── */}
      {importLibraryOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.75)", }}
          onClick={() => { setImportLibraryOpen(false); setImportImageForSceneId(null); }}>
          <div style={{ width: "100%", maxWidth: 680, maxHeight: "80vh", display: "flex", flexDirection: "column", borderRadius: 18, background: surface, border: `1px solid ${blue}30`, boxShadow: "0 32px 80px rgba(0,0,0,0.8)", overflow: "hidden" }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 10 }}>
              <Icon.Plus style={{ width: 16, height: 16 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Import Image from Asset Library</p>
                <p style={{ fontSize: 10, color: muted }}>
                  {importImageForSceneId
                    ? `Click an image to set it as the scene image for ${importImageForSceneId}`
                    : "Click an image to add it as a new scene in your assembly"}
                </p>
              </div>
              <button onClick={() => { setLibraryImages([]); setLoadingLibraryImages(true); fetch("/api/assets?type=image").then(r => r.json()).then(d => { setLibraryImages(d.assets || []); setLoadingLibraryImages(false); }).catch(() => setLoadingLibraryImages(false)); }}
                style={{ padding: "4px 10px", borderRadius: 6, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer" }}>Refresh</button>
              <button onClick={() => { setImportLibraryOpen(false); setImportImageForSceneId(null); }}
                style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer", display:"flex", alignItems:"center", gap:4 }}><Icon.X style={{ width: 12, height: 12 }} /> Close</button>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
              {loadingLibraryImages ? (
                <p style={{ color: muted, fontSize: 12, textAlign: "center", padding: 40 }}>Loading library images...</p>
              ) : libraryImages.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40 }}>
                  <p style={{ color: muted, fontSize: 12, marginBottom: 12 }}>No images in library yet.</p>
                  <p style={{ color: muted, fontSize: 10 }}>Generate images in the Scene Board, or go to Asset Library to import files.</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
                  {libraryImages.map(asset => {
                    const imgUrl = assetToMediaUrl(asset.filePath);
                    return (
                      <div key={asset.id}
                        onClick={() => {
                          if (importImageForSceneId) {
                            // Assign image to the specific scene — don't create a new scene
                            setSceneImages(prev => ({ ...prev, [importImageForSceneId]: imgUrl }));
                            setLastAction(`Image "${asset.name}" set for ${importImageForSceneId}`);
                          } else {
                            // Original behaviour — add as new scene
                            importImageFromLibrary(asset);
                          }
                          setImportLibraryOpen(false);
                          setImportImageForSceneId(null);
                        }}
                        style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${border}`, cursor: "pointer", transition: "all 0.15s", background: s2 }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = blue; (e.currentTarget as HTMLElement).style.transform = "scale(1.02)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}>
                        <div style={{ height: 110, overflow: "hidden", background: "#000" }}>
                          <img src={imgUrl} alt={asset.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                        <div style={{ padding: "6px 8px" }}>
                          <p style={{ fontSize: 10, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{asset.name}</p>
                          {asset.source && <p style={{ fontSize: 8, color: muted, marginTop: 1 }}>{asset.source}</p>}
                          <div style={{ marginTop: 4, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 4, background: `${blue}15`, color: blue }}>image</span>
                            <span style={{ fontSize: 9, color: blue, fontWeight: 700 }}>
                              {importImageForSceneId ? "Use This →" : "+ Add →"}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Style picker overlay + panel — rendered at root so it escapes overflow:hidden on the hero banner ── */}
      {showStylePicker && (
        <>
          {/* Click-outside overlay */}
          <div style={{ position: "fixed", inset: 0, zIndex: 199 }} onClick={() => setShowStylePicker(false)} />
          {/* Picker panel — fixed position, top-right of header area */}
          <div style={{ position: "fixed", top: 110, right: 32, zIndex: 200, background: "#0e1318", border: "1px solid #1e2a35", borderRadius: 14, padding: 12, width: 340, boxShadow: "0 16px 48px rgba(0,0,0,0.9)" }}
            onClick={e => e.stopPropagation()}>
            <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 10, fontWeight: 600, letterSpacing: 0.5 }}>CHOOSE YOUR VIDEO ART STYLE — applies to all scene images</p>
            {[
              { id: "3d-cinematic", icon: "3D", name: "3D Cinematic", color: "#00d4ff", example: "Like: Toy Story, Moana, Kung Fu Panda", desc: "3D animated movie quality. Characters look like they're from a major animated film. Rich lighting and depth." },
              { id: "2d-cartoon", icon: "2D", name: "2D Cartoon", color: "#f59e0b", example: "Like: SpongeBob, The Simpsons, old Disney", desc: "Flat bold colors with thick outlines. Classic cartoon look. Fun and simple." },
              { id: "anime", icon: "AN", name: "Anime", color: "#a855f7", example: "Like: Naruto, Dragon Ball, My Hero Academia", desc: "Japanese animation style. Big expressive eyes, clean lines, dynamic poses." },
              { id: "storybook", icon: "SB", name: "Storybook", color: "#22c55e", example: "Like: children's picture books, Peppa Pig", desc: "Soft, warm and painterly. Looks like illustrations from a kids' book. Gentle and cozy." },
              { id: "realistic", icon: "RL", name: "Realistic", color: "#ec4899", example: "Like: a real film or Netflix drama", desc: "Photorealistic — looks like an actual photograph or live-action movie scene." },
              { id: "nollywood", icon: "NW", name: "Nollywood", color: "#f97316", example: "Like: Nigerian cinema, African drama films", desc: "Warm African cinema aesthetic. Rich skin tones, vibrant traditional and modern Nigerian fashion, cinematic drama." },
              { id: "comic", icon: "CB", name: "Comic Book", color: "#ef4444", example: "Like: Marvel, DC Comics, superhero action", desc: "Bold ink outlines, halftone shading, dynamic poses. Classic comic book art style." },
            ].map(style => {
              const isSelected = effectiveProjectStyle === style.id;
              return (
                <div key={style.id}
                  onClick={() => {
                    setProjectStyle(style.id);
                    patchProjectSettings({ visualStyle: style.id }).catch(() => {});
                    setLastAction(`Art style set to ${style.name}`);
                    setShowStylePicker(false);
                    // Force-save immediately so style persists even if nothing else changes
                    setTimeout(() => flushCurrentProject(), 100);
                  }}
                  style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", borderRadius: 10, marginBottom: 4, cursor: "pointer", border: `1px solid ${isSelected ? style.color : "transparent"}`, background: isSelected ? `${style.color}10` : "transparent", transition: "all 0.15s" }}
                  onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                  onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                  <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: isSelected ? style.color : "#fff" }}>{style.name}</span>
                      {isSelected && <span style={{ fontSize: 8, padding: "1px 6px", borderRadius: 8, background: style.color, color: "#000", fontWeight: 800 }}>ACTIVE</span>}
                    </div>
                    <p style={{ fontSize: 10, color: style.color, fontWeight: 600, marginBottom: 2 }}>{style.example}</p>
                    <p style={{ fontSize: 9, color: "#5a7080", lineHeight: 1.4 }}>{style.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ── Global Image Hover Preview — fixed position, never clipped ── */}
      {hoverPreview && (
        <div style={{
          position: "fixed",
          left: hoverPreview.x + 16,
          top: Math.min(hoverPreview.y - 90, window.innerHeight - 220),
          zIndex: 9999,
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 12px 48px rgba(0,0,0,0.85)",
          border: `1px solid rgba(255,255,255,0.12)`,
          pointerEvents: "none",
          background: "#000",
        }}>
          <img src={hoverPreview.src} alt="preview"
            style={{ width: 320, height: 180, objectFit: "cover", display: "block" }} />
        </div>
      )}

      {/* ── Character Picker Modal ── */}
      {showCharacterPicker && (
        <div style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)" }}
          onClick={() => setShowCharacterPicker(false)}>
          <div style={{ width: "100%", maxWidth: 480, maxHeight: "80vh", overflowY: "auto", borderRadius: 16, padding: 4 }}
            onClick={e => e.stopPropagation()}>
            <CharacterPicker
              onSelect={(character) => {
                const c = character as unknown as { id: string; characterId?: string | null; name: string; imageUrl?: string; voiceId?: string; role?: string; gender?: string; age?: string; hairstyle?: string; wardrobe?: string; defaultSpeechStyle?: string; accent?: string; language?: string };
                setShowCharacterPicker(false);
                // Stage for rename — one image, different name per movie
                setPendingImportChar(c);
                setImportNameOverride(c.name);
              }}
              onCreateNew={() => { window.location.href = "/dashboard/character-voices"; }}
            />
          </div>
        </div>
      )}

      {/* ── Rename-on-import overlay ── one image, different name per movie ── */}
      {pendingImportChar && (
        <div style={{ position: "fixed", inset: 0, zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.7)" }}
          onClick={() => setPendingImportChar(null)}>
          <div style={{ background: "#13131f", border: `1px solid ${accent}40`, borderRadius: 18, padding: 28, width: 340, boxShadow: `0 0 40px ${accent}20` }}
            onClick={e => e.stopPropagation()}>
            {/* Photo */}
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
              {pendingImportChar.imageUrl ? (
                <img src={pendingImportChar.imageUrl} alt={pendingImportChar.name}
                  style={{ width: 64, height: 64, borderRadius: 12, objectFit: "cover", border: `2px solid ${accent}40` }} />
              ) : (
                <div style={{ width: 64, height: 64, borderRadius: 12, background: `${purple}30`, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon.User style={{ width: 28, height: 28, color: purple }} /></div>
              )}
              <div>
                <p style={{ fontSize: 11, color: muted, margin: 0, fontWeight: 600 }}>CHARACTER LIBRARY</p>
                <p style={{ fontSize: 13, color: "#fff", fontWeight: 700, margin: "2px 0 0" }}>{pendingImportChar.name}</p>
                <p style={{ fontSize: 10, color: muted, margin: 0 }}>{pendingImportChar.role} · {pendingImportChar.gender}</p>
              </div>
            </div>

            {/* Name in this movie */}
            <p style={{ fontSize: 11, color: muted, fontWeight: 600, marginBottom: 6 }}>NAME IN THIS MOVIE</p>
            <input
              autoFocus
              value={importNameOverride}
              onChange={e => setImportNameOverride(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && importNameOverride.trim()) {
                  const c = pendingImportChar;
                  const cid = c.characterId || c.id;
                  const movieName = importNameOverride.trim();
                  setCharacters(prev => {
                    if (prev.some(x => x.characterId === cid)) return prev;
                    return [...prev, {
                      characterId: cid,
                      dbId: c.id,
                      displayName: movieName,
                      roleType: c.role || "supporting",
                      gender: c.gender || "",
                      ageRange: c.age || "",
                      skinTone: "", hairStyle: c.hairstyle || "",
                      wardrobeStyle: c.wardrobe || "",
                      speechStyle: c.defaultSpeechStyle || "",
                      accentType: c.accent || "",
                      emotionProfile: "",
                      voiceId: c.voiceId || "",
                      language: c.language || "English",
                      tags: ["registry-import"],
                      imageUrl: c.imageUrl,
                      imageLocked: !!c.imageUrl,
                      hasVoice: !!c.voiceId,
                      hasImage: !!c.imageUrl,
                    }];
                  });
                  setCharactersMade(true);
                  setLastAction(`"${pendingImportChar.name}" cast as "${movieName}" in this movie`);
                  if (c.imageUrl) analyzeCharacterImage(cid, c.imageUrl);
                  setPendingImportChar(null);
                }
              }}
              placeholder={pendingImportChar.name}
              style={{ ...inputStyle, width: "100%", padding: "10px 14px", fontSize: 14, fontWeight: 700, marginBottom: 14, boxSizing: "border-box" as const }}
            />
            <p style={{ fontSize: 10, color: muted, marginBottom: 16 }}>
              Same image, different name — change per movie. Press Enter or click below.
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => {
                  const c = pendingImportChar;
                  const cid = c.characterId || c.id;
                  const movieName = importNameOverride.trim() || c.name;
                  setCharacters(prev => {
                    if (prev.some(x => x.characterId === cid)) return prev;
                    return [...prev, {
                      characterId: cid,
                      dbId: c.id,
                      displayName: movieName,
                      roleType: c.role || "supporting",
                      gender: c.gender || "",
                      ageRange: c.age || "",
                      skinTone: "", hairStyle: c.hairstyle || "",
                      wardrobeStyle: c.wardrobe || "",
                      speechStyle: c.defaultSpeechStyle || "",
                      accentType: c.accent || "",
                      emotionProfile: "",
                      voiceId: c.voiceId || "",
                      language: c.language || "English",
                      tags: ["registry-import"],
                      imageUrl: c.imageUrl,
                      imageLocked: !!c.imageUrl,
                      hasVoice: !!c.voiceId,
                      hasImage: !!c.imageUrl,
                    }];
                  });
                  setCharactersMade(true);
                  setLastAction(`"${c.name}" cast as "${movieName}" in this movie`);
                  if (c.imageUrl) analyzeCharacterImage(cid, c.imageUrl);
                  setPendingImportChar(null);
                }}
                style={{ flex: 1, padding: "10px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${accent}, #e6b800)`, color: "#000", fontSize: 12, fontWeight: 800, cursor: "pointer" }}>
                Add to This Movie
              </button>
              <button onClick={() => setPendingImportChar(null)}
                style={{ padding: "10px 16px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 12, cursor: "pointer" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase 4-B: Dialogue Review Modal ─────────────────────────────────── */}
      {showDialogueReview && (
        <div onClick={() => setShowDialogueReview(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: "#13131f", border: `1px solid ${border}`, borderRadius: 14, padding: 20, width: "min(600px, 95vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 0 40px rgba(0,0,0,0.6)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Dialogue Lines Review</div>
              <button onClick={() => setShowDialogueReview(false)}
                style={{ background: "transparent", border: "none", color: muted, fontSize: 18, cursor: "pointer", padding: "2px 6px" }}>×</button>
            </div>
            <div style={{ fontSize: 10, color: muted, marginBottom: 12 }}>
              {scriptSegments.filter(s => s.type === "dialogue").length} dialogue lines — review speaker assignments before generating voices
            </div>
            <div style={{ overflowY: "auto", flex: 1, borderRadius: 8, border: `1px solid ${border}`, overflow: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#1a1a2a", position: "sticky", top: 0 }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: muted, fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${border}`, width: "30%" }}>Speaker</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: muted, fontWeight: 600, fontSize: 9, textTransform: "uppercase", letterSpacing: 1, borderBottom: `1px solid ${border}` }}>Line</th>
                  </tr>
                </thead>
                <tbody>
                  {scriptSegments.filter(s => s.type === "dialogue").map((seg, i) => (
                    <tr key={i} style={{ borderBottom: `1px solid ${border}20`, background: i % 2 === 0 ? "transparent" : "#ffffff04" }}>
                      <td style={{ padding: "7px 12px", color: accent, fontWeight: 700, verticalAlign: "top", wordBreak: "break-word" }}>{seg.speaker || "NARRATOR"}</td>
                      <td style={{ padding: "7px 12px", color: "#ddd", lineHeight: 1.5, wordBreak: "break-word" }}>{seg.text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 14, textAlign: "right" }}>
              <button onClick={() => setShowDialogueReview(false)}
                style={{ padding: "8px 20px", borderRadius: 8, border: `1px solid ${border}`, background: "#1a1a2a", color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Supervisor Status Bar ─────────────────────────────────────────── */}
      {(() => {
        // Hybrid tab flow — must match WORKSHOP_TABS order exactly (no offset)
        const FLOW: { id: WorkshopTab; label: string }[] = [
          { id: "script",     label: "Design" },
          { id: "story",      label: "Story" },
          { id: "characters", label: "Characters" },
          { id: "scenes",     label: "Scene Board" },
          { id: "audio",      label: "Sound & SFX" },
          { id: "screenplay", label: "Screenplay" },
          { id: "assembly",   label: "Assembly" },
          { id: "overview",   label: "Overview" },
        ];
        const idx = FLOW.findIndex(t => t.id === activeTab);
        const next = idx >= 0 && idx < FLOW.length - 1 ? FLOW[idx] : null;
        return (
          <SupervisorStatusBar
            plannerType="hybrid"
            projectId={projectId}
            designComplete={!!effectiveProjectStyle}
            storyComplete={!!expandedSummary || !!idea}
            charactersComplete={characters.length > 0}
            soundComplete={!!narratorAudioUrl || scriptSegments.length > 0}
            scenesComplete={scenes.length > 0 && scenes.some(s => sceneImages[s.sceneId])}
            assemblyComplete={!!assembledVideoUrl}
            storyText={expandedSummary || idea}
            nextTabLabel={next?.label}
            onNextTab={next ? () => setActiveTab(FLOW[idx + 1].id) : undefined}
            onAutoFix={(section) => {
              const tabMap: Record<string, WorkshopTab> = {
                design: "story", story: "story", characters: "characters",
                sound: "audio", scenes: "scenes", assembly: "assembly",
              };
              const target = tabMap[section] as WorkshopTab;
              if (target) setActiveTab(target);
            }}
          />
        );
      })()}
    </div>
  );
}
