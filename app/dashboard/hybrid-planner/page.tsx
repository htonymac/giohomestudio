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
import { HeroTitle } from "../../components/hero/HeroTitle";
import * as Icon from "../../components/icons";
import ModelChip from "../../components/ModelChip";
import { useCoordinator } from "../../components/CoordinatorProvider";

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
}

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

type WorkshopTab = "overview" | "scenes" | "characters" | "story" | "audio" | "assembly" | "trends" | "screenplay";

// Tabs ordered to match the production pipeline:
// Story → Characters → Scene Board → Audio & Shots → Assembly → Screenplay → Overview → Trends
const WORKSHOP_TABS: { id: WorkshopTab; label: string; step?: number }[] = [
  { id: "story",      label: "Story & Draft",  step: 1 },
  { id: "characters", label: "Characters",      step: 2 },
  { id: "scenes",     label: "Scene Board",     step: 3 },
  { id: "audio",      label: "Audio & Shots",   step: 4 },
  { id: "screenplay", label: "Screenplay",      step: 5 },
  { id: "assembly",   label: "Assembly",        step: 6 },
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
  const [projectPhase, setProjectPhase] = useState("STORY_INPUT");
  const [lastAction, setLastAction] = useState("Project created");
  const [saving, setSaving] = useState(false);
  // ── Visual Style Lock — controls rendering style for ALL scene image generation ──
  const [projectStyle, setProjectStyle] = useState<string>("3d-cinematic");

  // ── Story ──
  const [idea, setIdea] = useState("");
  const [genre, setGenre] = useState("");
  const [tone, setTone] = useState("");
  const [targetDuration, setTargetDuration] = useState("2-3 min");
  const [customDurationMin, setCustomDurationMin] = useState(5);
  const [customDurationSec, setCustomDurationSec] = useState(0);
  const [audienceType, setAudienceType] = useState("general");
  const [costPreference, setCostPreference] = useState("balanced");
  const [language, setLanguage] = useState("English");
  const [storyAiProvider, setStoryAiProvider] = useState("claude:claude-sonnet-4-6"); // "auto" | "claude:model" | "openai:model" | "grok:model" | "ollama"
  const [lastUsedAiProvider, setLastUsedAiProvider] = useState<string>("");
  const [expanding, setExpanding] = useState(false);
  const [expandedSummary, setExpandedSummary] = useState("");
  const [fullScript, setFullScript] = useState(""); // complete narration script at target duration

  // ── Characters ──
  const [characters, setCharacters] = useState<CharacterIdentity[]>([]);
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
  const [activeSceneCardTab, setActiveSceneCardTab] = useState<Record<string, "image" | "audio" | "video" | null>>({});

  // ── New Scene Duration (user sets seconds) ──
  const [newSceneDuration, setNewSceneDuration] = useState(5);

  // ── Continuous Motion ──────────────────────────────────────────────────────
  const [continuousMotionEnabled, setContinuousMotionEnabled] = useState(false);
  const [cmTotalDuration, setCmTotalDuration] = useState(15);
  const [cmSegmentDuration, setCmSegmentDuration] = useState(5);
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
  const [narratorVoice, setNarratorVoice] = useState<"piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "none">("piper");
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
  interface VoiceLayer { layer: number; providerId: "piper" | "fal-narrator" | "elevenlabs" | "karaoke"; voiceId: string; }
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
  const [soundTab, setSoundTab] = useState<"freesound" | "elevenlabs" | "upload">("freesound");
  const [fsQuery, setFsQuery] = useState("");
  const [fsResults, setFsResults] = useState<Array<{ id: number; name: string; duration: number; license: string; username: string; previewUrl: string; tags: string[] }>>([]);
  const [fsSearching, setFsSearching] = useState(false);
  const [fsSaving, setFsSaving] = useState<number | null>(null);
  const [fsSaved, setFsSaved] = useState<Set<number>>(new Set());
  const [fsNoKey, setFsNoKey] = useState(false);
  const [sfxDesc, setSfxDesc] = useState("");
  const [sfxGenerating, setSfxGenerating] = useState(false);
  const [sfxGeneratedUrl, setSfxGeneratedUrl] = useState<string | null>(null);
  const [sfxPreviewId, setSfxPreviewId] = useState<number | string | null>(null);
  // ── Build-all-characters queue state ──────────────────────────────────────
  const [buildingAllChars, setBuildingAllChars] = useState(false);
  const [buildAllProgress, setBuildAllProgress] = useState<string | null>(null);
  // inline add-one state for Characters tab
  const [charTabName, setCharTabName] = useState("");
  const [charTabCreating, setCharTabCreating] = useState(false);

  // ── Pre-flight check ──────────────────────────────────────────────────────
  interface HybridPreflightCheck { id: string; label: string; status: "ok" | "warn" | "error"; detail?: string; autoFixAvailable: boolean; autoFixAction?: string; }
  const [preflightResult, setPreflightResult] = useState<{ checks: HybridPreflightCheck[]; canAssemble: boolean; blockingErrors: number; warnings: number } | null>(null);
  const [preflightRunning, setPreflightRunning] = useState(false);

  // ── Persistent project storage key (DB-only, no localStorage) ──
  const ACTIVE_PROJ_ID = "ghs_hybrid_default";

  // BUG-15: guard flag — while restoring from DB we must NOT trigger the save effect
  const isRestoringRef = useRef(true);

  // ── Restore full project state — DB only ──
  useEffect(() => {
    let cancelled = false;
    async function restoreState() {
      isRestoringRef.current = true;
      try {
      const activeId = ACTIVE_PROJ_ID;
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
          if (d.sceneImages && Object.keys(d.sceneImages).length > 0) setSceneImages(d.sceneImages);
          const mountValidIds = new Set((d.scenes || []).map((s: { sceneId: string }) => s.sceneId));
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
          if (d.characterPiperVoices && Object.keys(d.characterPiperVoices).length > 0) setCharacterPiperVoices(d.characterPiperVoices);
          if (d.screenplay) setScreenplay(d.screenplay);
          if (d.screenplayAuthor) setScreenplayAuthor(d.screenplayAuthor);
          if (d.scriptSegments?.length > 0) setScriptSegments(d.scriptSegments);
          if (d.musicVolume !== undefined) setMusicVolume(d.musicVolume);
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

  // ── Save full workshop state — DB only ──
  // BUG-15: skip save while restoring — prevents stale state from overwriting fresh DB data
  useEffect(() => {
    if (!activeProjLocalId) return;
    if (isRestoringRef.current) return;
    const data = {
      projectId, projectTitle, projectPhase, idea, genre, tone,
      expandedSummary, fullScript, characters, scenes, sceneImages, sceneVideos, lastAction,
      projectStyle, savedCuts, archivedScenes,
      narratorAudioUrl, selectedMusicUrl, selectedMusicName,
      selectedVideoModelId,
      sceneVideoVersions, sceneIntelligence,
      subtitleStyle, storyMode,
      screenplay, screenplayAuthor, scriptSegments, characterAudioUrls, characterPiperVoices,
      timestamp: Date.now(),
    };
    // DB save (fire-and-forget — don't block UI)
    fetch("/api/hybrid/saved-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ localId: activeProjLocalId, data }),
    }).catch(() => { /* silent on DB error */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProjLocalId, projectId, projectTitle, projectPhase, idea, expandedSummary, fullScript, characters, scenes, sceneImages, sceneVideos, savedCuts, archivedScenes, narratorAudioUrl, selectedMusicUrl, selectedMusicName, subtitleStyle, storyMode, screenplay, screenplayAuthor, scriptSegments, characterAudioUrls, characterPiperVoices]);

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
    }
    // When scenes change (new scene added), add it to selection if assembly tab was already initialized
    if (assemblyInitialized && scenes.length > 0) {
      setSelectedSceneIds(prev => {
        const newIds = scenes.map(s => s.sceneId).filter(id => !prev.includes(id));
        return newIds.length > 0 ? [...prev, ...newIds] : prev;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, scenes.length]);

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
    if (characters.length === 0) return { message: "Story expanded! Go to Characters tab to review extracted characters.", color: purple, targetTab: "characters", buttonLabel: "Go to Characters" };
    if (!charactersMade) return { message: "Characters extracted! Click 'Make Characters' to create their identities and voices.", color: purple, targetTab: "characters", buttonLabel: "Go to Characters" };
    if (charsWithoutImages > 0) return { message: `${charsWithoutImages} character(s) need portraits. Click 'Generate All Portraits' in the Characters tab.`, color: blue, targetTab: "characters", buttonLabel: "Go to Characters" };
    if (totalScenes === 0) return { message: "Characters ready! Go to Scene Board to view and generate scene images.", color: blue, targetTab: "scenes", buttonLabel: "Go to Scenes" };
    if (generatedImages < totalScenes) return { message: `${totalScenes - generatedImages} scene(s) need images. Click 'Generate All Images' in the Scene Board.`, color: blue, targetTab: "scenes", buttonLabel: "Go to Scenes" };
    if (audioProgress < 100) return { message: "All scenes have images! Go to Audio tab to plan narration and music.", color: gold, targetTab: "audio", buttonLabel: "Go to Audio" };
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
          language,
          audience: audienceType,
          costPreference,
          targetDuration: durSeconds,
          targetDurationLabel: durLabel,
          provider: storyAiProvider === "auto" ? undefined : storyAiProvider,
          tier: aiTier,
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
            language,
            tags: [],
            hasVoice: !!(c.voiceId as string),
            hasImage: false,
            // Mark as needing AI build — visual fields empty until user clicks Build
            species: "",
            bodyBuild: "",
            colorDescription: "",
            faceFeatures: "",
            clothingDetails: (c.visualDescription as string) || "",
            accessories: "",
            distinctiveFeatures: "",
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
            voiceId: "", language, tags: [], hasVoice: false, hasImage: false,
            species: "", bodyBuild: "", colorDescription: "", faceFeatures: "",
            clothingDetails: "", accessories: "", distinctiveFeatures: "", ageAppearance: "",
          });
        });
        setCharacters(extractedChars);
        setProjectPhase("CHARACTERS_EXTRACTED");
      }
      setLoadingCharacters(false);

      // ── STEP 3: Scene Breakdown ───────────────────────────────────────────────
      // API requires projectId + expandedStory as string + characters with characterId + displayName + role
      // If no DB projectId, use the lightweight plan endpoint instead
      setLoadingScenes(true);
      const scenePayload = {
        storyText: storySummary,           // full story text for scene planning
        characters: extractedChars.map(c => ({
          characterId: c.characterId,
          displayName: c.displayName,
          role: c.roleType,
        })),
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
          sfx: (s.soundSuggestion as string) || "", ambience: "", motionDuration: (s.durationEstimate as number) || 5,
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
          language,
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
          artStyle: projectStyle,
          language,
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
          language,
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
        language,
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
        body: JSON.stringify({ expandedStory: expandedPayload, language }),
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
              artStyle: projectStyle,
              language,
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
              language, tags: [], hasVoice: !!c.voiceId, hasImage: false,
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
          scenes: scenes.map(s => ({ sceneId: s.sceneId, imageUrl: sceneImages[s.sceneId] || undefined, videoUrl: sceneVideos[s.sceneId] || undefined, title: s.title })),
          audioConfig: { narrationProvider: narratorAudioUrl ? "piper" : undefined, narrationText: expandedSummary || idea, musicUrl: selectedMusicUrl || undefined, musicName: selectedMusicName || undefined },
          characters: characters.map(c => ({ id: c.characterId, name: c.displayName, voiceId: c.voiceId, voiceName: c.voiceId || "" })),
        }),
      });
      const data = await res.json();
      setPreflightResult(data);
    } catch (err) { console.error("preflight error:", err); }
    setPreflightRunning(false);
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

    const sceneChars = characters.filter(c => scene.characterIds?.includes(c.characterId));
    const characterOverrides = sceneChars.map(c => ({
      characterId: c.characterId,
      name: c.displayName,
      visualDescription: buildVisualDescription(c),
      imageUrl: c.imageUrl || null,
      wardrobe: c.clothingDetails || c.wardrobeStyle || null,
      hairstyle: c.hairStyle || null,
    }));
    try {
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: scene.sceneId, projectId, sceneText: `${scene.title}. ${scene.description}`,
          characterIds: scene.characterIds, location: scene.location, mood: scene.mood,
          timeOfDay: scene.timeOfDay, cameraFraming: scene.shots[0]?.framingType,
          projectStyle, characterOverrides,
          modelId: transparentBg && selectedImageModelId.includes("ideogram_v3") ? "fal_ideogram_v3_transparent" : selectedImageModelId,
          transparentBg: transparentBg && selectedImageModelId.includes("ideogram_v3"),
          seed: genSeed !== null ? genSeed : undefined,
        }),
      });
      const data = await res.json();
      clearInterval(progressTimer);
      if (data.error === "unresolved_characters") {
        alert(`Cannot generate: ${data.message}`);
        setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
      } else if (data.imageUrl || data.imagePath) {
        const url = data.imageUrl || `/api/media/${data.imagePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
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
        if (data.model) setSceneImageModels(prev => ({ ...prev, [scene.sceneId]: data.model }));
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
      }
    } catch (err) {
      clearInterval(progressTimer);
      setSceneGenProgress(prev => { const n = { ...prev }; delete n[scene.sceneId]; return n; });
      console.error("makeSceneImage failed:", err);
      setUiError(`Image generation failed for Scene ${scene.scene}. Please try again.`);
    }
    setGeneratingSceneImage(null);
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
      const data = await res.json();
      if (data.polishedText) {
        setScenes(prev => prev.map(s =>
          s.sceneId === sceneId ? { ...s, description: data.polishedText } : s
        ));
        setLastAction(`Scene ${sceneId}: description polished`);
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
          duration: durationSecs ?? scene.motionDuration ?? 5,
          motionDescription: scene.shots[0]?.cameraMovement || "",
          modelId: selectedVideoModelId !== "segmind_pruna_video" ? selectedVideoModelId : undefined,
          seed: genSeed !== null ? genSeed : undefined,
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
    // Use fullScript (scaled to target duration) if available, otherwise summary, then raw idea
    const textToParse = fullScript || expandedSummary || idea;
    if (!textToParse.trim()) { setUiError("Write or expand your story first."); return; }
    setParsingScript(true);
    setLastAction("AI is reading your story and splitting narrator / character dialogue...");
    try {
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
    // BUG-16a: Pass ONLY narrator-typed segments to TTS — dialogue lines are handled
    // separately by character voices. Sending the full script caused narrator audio
    // to cover the entire script including dialogue, creating overlap.
    // scriptSegments use type "narration" for narrator lines (per parse-script API)
    const narratorSegments = scriptSegments.filter(s => s.type === "narration");
    const narrationText = narratorSegments.length > 0
      ? narratorSegments.map(s => s.text).join(" ")
      : (fullScript || expandedSummary || idea);

    if (!narrationText.trim()) { setUiError("No narration text found. Parse your script first."); return; }
    setGeneratingNarration(true);
    setPiperDownloading(false);

    // FAL Narrator and ElevenLabs go directly to /api/tts with the provider field
    if (narratorVoice === "fal-narrator" || narratorVoice === "elevenlabs") {
      setLastAction(`Generating narrator audio via ${narratorVoice === "fal-narrator" ? "FAL Narrator" : "ElevenLabs"}...`);
      try {
        const res = await fetch("/api/tts", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: narrationText,
            provider: narratorVoice,
            speed: narratorPiperSpeed,
          }),
        });
        const data = await res.json();
        if (data.audioUrl) {
          setNarratorAudioUrl(data.audioUrl);
          setLastAction(`Narrator audio ready via ${data.engine || narratorVoice}`);
        } else {
          setUiError(data.error || `${narratorVoice} narration failed`);
        }
      } catch (err) { setUiError("Narration error: " + String(err)); }
      setGeneratingNarration(false);
      return;
    }

    // Karaoke provider — browser SpeechSynthesis (no server call needed)
    if (narratorVoice === "karaoke") {
      setUiError("Karaoke mode uses browser speech synthesis — no audio file generated. Playback happens in-browser only.");
      setGeneratingNarration(false);
      return;
    }

    // Piper (default) — uses existing narrate-piper endpoint
    setLastAction("Generating narrator audio with Piper...");
    try {
      const res = await fetch("/api/hybrid/narrate-piper", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: narrationText,
          model: narratorPiperModel,
          speed: narratorPiperSpeed,
          voiceProvider: narratorVoice,
          provider: narratorVoice,
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
    // ── Coordinator guard (BUG-01): block assembly if story or scenes not complete ──
    const coordinatorBlock = canAdvanceTo("assembly");
    if (coordinatorBlock) {
      setUiError(coordinatorBlock);
      return;
    }
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
      if (!hasPerLineAudio && !hasCharVoices && characters.length > 0 && hasDialogue) {
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

        console.log(`[assemble] ${s.sceneId}: mode=${effectiveMode} video=${videoUrl || "none"} image=${imageUrl ? "yes" : "none"} → ${mediaUrl.slice(0, 60)}`);

        // BUG-16b: subtitle source = full scene narration script, NOT first-N-sentences truncation.
        // Truncation cut subtitles to 1-2 sentences; use fullScript / full narrationScript instead.
        const rawText = s.narrationScript || fullScript || s.description || s.title || "";
        const overlayText = rawText.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim();

        return {
          scene: i + 1,
          videoUrl: mediaUrl,
          imageUrl: imageUrl ?? undefined,
          mode: effectiveMode,
          duration: s.motionDuration || 5,
          text: overlayText,
          animation: "none" as const,
        };
      });

      // ── Generate intro / outro cards ──
      const cardPayload = {
        title: projectTitle,
        author: screenplayAuthor,
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
          const r = await fetch("/api/hybrid/generate-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cardPayload, type: "intro" }) });
          const d = await r.json();
          if (d.ok && d.imageUrl) {
            introScene = { scene: 0, videoUrl: `img:${d.imageUrl}`, duration: 5, text: "", animation: "fade_in" as const };
          }
        } catch { /* best effort */ }
      }

      if (outroEnabled) {
        try {
          const r = await fetch("/api/hybrid/generate-card", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...cardPayload, type: "outro" }) });
          const d = await r.json();
          if (d.ok && d.imageUrl) {
            outroScene = { scene: 999, videoUrl: `img:${d.imageUrl}`, duration: 10, text: "", animation: "fade_in" as const };
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

      // ── Build narrationList — narrator + all character voices with timing ──
      // storyMode controls which audio tracks are included:
      //   narration-only → narrator only, no character voices
      //   actors-only    → character voices only, no narrator
      //   mixed          → both
      const narrationList: Array<{ audioUrl: string; startTime: number; volume: number }> = [];

      // 1. Narrator audio starts at t=0 — only in narration-only or mixed mode
      if (narratorAudioUrl && storyMode !== "actors-only") {
        narrationList.push({ audioUrl: narratorAudioUrl, startTime: 0, volume: 1.0 });
      }

      // 2. Character voice audio — only in actors-only or mixed mode
      // NEW: prefer per-line clips (scriptSegments[].audioUrl) over old per-character files
      const hasPerLineClips = scriptSegments.some(s => s.type === "dialogue" && s.audioUrl);

      // Build scene start map — used for both per-line and fallback systems
      const sceneStartMapForChar: Record<string, number> = {};
      let elapsedForChar = 0;
      for (const s of scenesToAssemble) {
        sceneStartMapForChar[s.sceneId] = elapsedForChar;
        elapsedForChar += (s.motionDuration || 5);
      }

      if (storyMode !== "narration-only") {
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
              narrationList.push({ audioUrl: seg.audioUrl, startTime, volume: 1.5 });
            }
          }
        } else {
          // Fallback: old per-character system (one file per character at scene start)
          const charAudioEntries = Object.entries(characterAudioUrls);
          if (charAudioEntries.length > 0) {
            for (const char of characters) {
              const audioUrl = characterAudioUrls[char.characterId];
              if (!audioUrl) continue;
              const charDialogue = scriptSegments.filter(seg =>
                seg.type === "dialogue" && (
                  seg.characterId === char.characterId ||
                  seg.speaker?.toLowerCase() === char.displayName.toLowerCase() ||
                  seg.speaker?.toLowerCase().includes(char.displayName.toLowerCase().split(" ")[0])
                )
              );
              let startTime = 1;
              if (charDialogue.length > 0) {
                const firstSceneId = charDialogue[0].sceneId;
                if (firstSceneId && sceneStartMapForChar[firstSceneId] !== undefined) {
                  startTime = sceneStartMapForChar[firstSceneId] + 0.5;
                } else {
                  const totalSegs = scriptSegments.length;
                  const lineIdx = charDialogue[0].lineIndex ?? 0;
                  startTime = totalSegs > 0 ? Math.max(0, (lineIdx / totalSegs) * elapsedForChar - 0.5) : 1;
                }
              }
              narrationList.push({ audioUrl, startTime, volume: 1.5 });
            }
          }
        }
      }

      // ── Build SFX list — match scene audioPlan.sfxList to saved SFX in library ──
      const sfxList: Array<{ sourceUrl: string; startTime: number; volume: number }> = [];
      try {
        const sfxAssets = await fetch("/api/assets?type=sfx").then(r => r.json())
          .then(d => (d.assets || []) as Array<{ name: string; filePath: string }>);
        let sfxCursor = 0;
        for (const s of scenesToAssemble) {
          const sceneDur = s.motionDuration || 5;
          const planned = s.audioPlan?.sfxList || [];
          for (let i = 0; i < Math.min(planned.length, 2); i++) {
            const name = planned[i]?.toLowerCase() || "";
            const match = sfxAssets.find(a =>
              a.name.toLowerCase().includes(name) || name.includes(a.name.toLowerCase().split(" ")[0])
            );
            if (match?.filePath) {
              sfxList.push({
                sourceUrl: `/api/media/${match.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`,
                startTime: sfxCursor + i * 1.5,
                volume: 0.5,
              });
            }
          }
          sfxCursor += sceneDur;
        }
      } catch { /* skip SFX on error */ }

      // ── Music selection — always use clean stock library tracks ──
      // Uploaded files (music_upload_*) can contain album art (embedded PNG video stream)
      // or copyrighted material. Always override with a matched stock track.
      const isUploadedFile = selectedMusicUrl?.includes("music_upload_");
      let effectiveMusicUrl = isUploadedFile ? null : selectedMusicUrl;

      if (!effectiveMusicUrl) {
        try {
          const libRes = await fetch("/api/assets?type=music");
          if (libRes.ok) {
            const libData = await libRes.json();
            const tracks = (libData.assets || libData || []) as Array<{ filePath?: string; name?: string; url?: string }>;
            // Filter to stock tracks only (no uploads)
            const stockTracks = tracks.filter(t => t.filePath && !t.filePath.includes("music_upload_"));
            if (stockTracks.length > 0) {
              const toneKey = (tone || genre || "emotional").toLowerCase();
              const pick = stockTracks.find(t => (t.name || "").toLowerCase().includes(toneKey.split(" ")[0]))
                || stockTracks.find(t => /emotional|calm|soft/.test((t.name || "").toLowerCase()))
                || stockTracks[0];
              if (pick?.filePath) {
                effectiveMusicUrl = `/api/media/${pick.filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
                if (isUploadedFile) {
                  console.log(`[assemble] Replaced uploaded music with stock: ${pick.name}`);
                } else {
                  console.log(`[assemble] Auto-selected music: ${pick.name} → ${effectiveMusicUrl}`);
                }
              }
            }
          }
        } catch { /* skip auto-music on error */ }
      }

      // ── Assembly debug manifest — log exactly what files are being used ──
      console.log("[assemble MANIFEST]", JSON.stringify({
        project: projectTitle,
        narrationUrl: narrationList.length > 0 ? narrationList[0]?.audioUrl : narratorAudioUrl,
        narrationTracks: narrationList.length,
        musicUrl: effectiveMusicUrl || "NONE",
        sfxCount: sfxList.length,
        sceneCount: finalSceneList.length,
        subtitleStyle,
      }));

      const res = await fetch("/api/video/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: projectId || activeProjLocalId || undefined,
          title: projectTitle,
          scenes: finalSceneList,
          aspectRatio: "16:9",
          musicUrl: effectiveMusicUrl || undefined,
          musicVolume,
          // Narrator: use narrationList (per-scene timing) if we have char voices, else single URL
          narrationUrl: narrationList.length === 0 ? (narratorAudioUrl || undefined) : undefined,
          narrationList: narrationList.length > 0 ? narrationList : undefined,
          narrationVolume,
          sfx: sfxList.length > 0 ? sfxList : undefined,
          subtitleStyle,
        }),
      });
      const data = await res.json();
      if (data.warning) setUiError(data.warning);
      if (data.outputUrl) {
        setAssembledVideoUrl(data.outputUrl);
        setAssemblyComplete(true);
        setLastAction(`Assembly complete — ${data.duration ? Math.round(data.duration) + "s video ready" : "video ready"}`);
        // Save video URL into the named cut so it persists when user returns
        if (assemblyName.trim()) {
          setSavedCuts(prev => {
            const idx = prev.findIndex(c => c.name === assemblyName);
            const updated = { name: assemblyName, sceneIds: [...selectedSceneIds], order: [...assemblyOrder], videoUrl: data.outputUrl, assembledAt: Date.now() };
            if (idx >= 0) { const a = [...prev]; a[idx] = updated; return a; }
            return [...prev, updated];
          });
        }
        // ── AUTO-EARS: run faster-whisper transcription to confirm narration is audible ──
        try {
          setLastAction("Ears check — probing audio in assembled video…");
          const earRes = await fetch("/api/hybrid/check-audio", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ videoUrl: data.outputUrl }),
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
            const whisperNote = earData.whisperError
              ? ` (Whisper: ${earData.whisperError.slice(0, 60)})`
              : " (Whisper returned nothing)";
            setLastAction(`[!] Ears: audio stream exists${durStr} but transcript empty${whisperNote}`);
          } else {
            setLastAction(`Assembly complete${durStr} — audio OK, codec: ${earData.audioCodec || "?"}`);
          }
        } catch (earErr) {
          setLastAction(`Assembly complete — ears check failed: ${String(earErr).slice(0, 80)}`);
        }

        // Save to asset library
        try {
          await fetch("/api/assets", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title: projectTitle, type: "video", url: data.outputUrl, source: "hybrid-planner", projectId }),
          });
        } catch (saveErr) { console.error("Asset library save failed:", saveErr); }
      } else {
        setAssemblyComplete(true);
        setLastAction("Assembly complete (no video URL returned)");
      }
    } catch (err) { console.error("assembleScenes failed:", err); setUiError("Assembly failed. Please check your scenes and try again."); }
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
          projectStyle,
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
      if (char.ageRange) parts.push(char.ageRange);
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
      // Fill all fields — overwrite empty ones, keep manually-typed ones
      setCharacters(prev => prev.map(c => {
        if (c.characterId !== charId) return c;
        return {
          ...c,
          species:              c.species || a.species || "",
          bodyBuild:            c.bodyBuild || a.bodyBuild || "",
          colorDescription:     c.colorDescription || a.colorDescription || "",
          faceFeatures:         c.faceFeatures || a.faceFeatures || "",
          clothingDetails:      c.clothingDetails || a.clothingDetails || "",
          accessories:          c.accessories || a.accessories || "",
          distinctiveFeatures:  c.distinctiveFeatures || a.distinctiveFeatures || "",
          ageAppearance:        c.ageAppearance || a.ageAppearance || "",
          gender:               c.gender || (a.gender !== "unknown" ? a.gender : ""),
          roleType:             c.roleType || a.suggestedRole || c.roleType,
        };
      }));

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
  async function generateCharacterPortrait(char: CharacterIdentity) {
    setGeneratingPortrait(char.characterId);
    const visualDescFull = buildVisualDescription(char);
    // Truncate to keep total prompt under 3800 chars (well within the 4000 limit)
    const visualDesc = visualDescFull.slice(0, 1200);
    // Build a detailed, specific portrait prompt — not a generic "portrait of X"
    const portraitPrompt = [
      projectStyle === "2d-cartoon"
        ? "2D cartoon illustration, clean bold outlines, flat cel-shaded colors, Disney storybook art style"
        : projectStyle === "anime"
        ? "Anime style illustration, clean linework, detailed character design"
        : projectStyle === "storybook"
        ? "Children's storybook illustration, warm painterly style"
        : "3D animated film, Pixar/DreamWorks quality, volumetric lighting, photorealistic fur textures",
      `CHARACTER ${char.displayName.toUpperCase()} — EXACT FIXED APPEARANCE:`,
      visualDesc || `${char.displayName}, ${char.gender} ${char.ageRange}`,
      "CHARACTER REFERENCE SHEET — front-facing full body portrait, neutral pose, clean background.",
      "Show the character clearly from head to toe. This is the canonical reference image for this character.",
      "Consistent design, professional quality, no background distractions.",
    ].filter(Boolean).join(". ");

    try {
      const res = await fetch("/api/generation/image", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: portraitPrompt,
          negativePrompt: projectStyle === "3d-cinematic"
            ? "2D flat illustration, cartoon drawing, anime, sketch, watercolor, flat colors, clipart"
            : projectStyle === "2d-cartoon"
            ? "3D render, photorealistic, CGI, bokeh"
            : "",
          width: 768, height: 960,
          seed: genSeed !== null ? genSeed : undefined,
        }),
      });
      const d = await res.json();
      if (d.error) {
        setUiError(`Portrait failed: ${d.error}`);
        setGeneratingPortrait(null);
        return;
      }
      // imagePath is a local file path — convert to /api/media/ URL for display
      const url = d.imageUrl || (d.imagePath ? assetToMediaUrl(d.imagePath) : null);
      if (url) {
        setCharacters(prev => prev.map(c =>
          c.characterId === char.characterId
            ? { ...c, imageUrl: url, hasImage: true, imageLocked: false }
            : c
        ));
        setLastAction(`Portrait generated for ${char.displayName} — AI is now reading the image...`);
        analyzeCharacterImage(char.characterId, url);
      } else {
        setUiError(`Portrait generated but image URL missing. Check server logs.`);
      }
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
    const id = activeProjLocalId;
    if (!id) return;
    const data = {
      projectId, projectTitle, projectPhase, idea, genre, tone,
      expandedSummary, characters, scenes, sceneImages, sceneVideos, sceneVideoVersions, lastAction,
      projectStyle, savedCuts, archivedScenes, sceneIntelligence,
      narratorAudioUrl, selectedMusicUrl, selectedMusicName, selectedVideoModelId,
      subtitleStyle, storyMode, screenplay, screenplayAuthor, scriptSegments, characterAudioUrls, characterPiperVoices,
      timestamp: Date.now(),
    };
    try {
      await fetch("/api/hybrid/saved-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ localId: id, data }),
      });
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
      motionDuration: 5,
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
          projectStyle,
          seed: genSeed !== null ? genSeed : undefined,
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

      {/* ── Quick Preview Modal — image or video lightbox ── */}
      {previewMedia && (
        <div onClick={() => setPreviewMedia(null)}
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
            <button onClick={() => setPreviewMedia(null)}
              style={{ position: "absolute", top: 10, right: 10, width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,0.15)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon.X style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>Click outside to close</p>
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
        const activeModelId = isVideo ? selectedVideoModelId : selectedImageModelId;

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
                  const isSelected = selectedVideoModelId === m.id;
                  const styleScore = aidStyle === "all" ? null : m.scores[aidStyle as Exclude<StyleKey,"all">];
                  const styleTag = aidStyle === "2d" ? m.tags2d : aidStyle === "3d" ? m.tags3d : aidStyle === "cartoon" ? m.tagCartoon : aidStyle === "realistic" ? m.tagRealistic : undefined;
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedVideoModelId(m.id); setShowAidPicker(false); }}
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
                  const isSelected = selectedImageModelId === m.id;
                  const isCheapest = m.id === "fal_flux_schnell";
                  const isBest = m.id === "fal_flux_pro_ultra";
                  const netCol = networkColor[m.network] ?? "#888";
                  return (
                    <div key={m.id} onClick={() => { setSelectedImageModelId(m.id); setShowAidPicker(false); }}
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
            <input value={projectTitle} onChange={e => setProjectTitle(e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "8px 14px", color: "#fff", fontSize: 12, width: 200, outline: "none" }}
              placeholder="Movie Title" />
            {/* ── Visual Style Picker — click to see what each style looks like ── */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowStylePicker(p => !p)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: showStylePicker ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10, padding: "6px 10px", cursor: "pointer", color: "#fff" }}>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)" }}>Art Style:</span>
                <span style={{ fontSize: 13 }}>
                  {projectStyle === "3d-cinematic" ? "3D" : projectStyle === "2d-cartoon" ? "2D" : projectStyle === "anime" ? "AN" : projectStyle === "storybook" ? "SB" : "RL"}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700 }}>
                  {projectStyle === "3d-cinematic" ? "3D Cinematic" : projectStyle === "2d-cartoon" ? "2D Cartoon" : projectStyle === "anime" ? "Anime" : projectStyle === "storybook" ? "Storybook" : "Realistic"}
                </span>
                <span style={{ fontSize: 9, color: "rgba(255,255,255,0.4)" }}>▾</span>
              </button>

              {/* Picker panel is rendered at root level (see bottom of component) to escape overflow:hidden on the hero banner */}
            </div>
            <button onClick={async () => {
              // Save current project first — NO work is lost
              await flushCurrentProject();
              // Generate a new project ID
              const newId = `proj_${Date.now()}`;
              setActiveProjLocalId(newId);
              // ── Story & scene state ──
              setProjectId(null); setProjectTitle("Untitled Hybrid Project"); setProjectPhase("STORY_INPUT");
              setIdea(""); setGenre(""); setTone(""); setExpandedSummary(""); setFullScript("");
              setCharacters([]); setCharactersMade(false);
              setScenes([]); setSceneImages({}); setSceneVideos({}); setSceneVideoVersions({});
              setPrevSceneImages({}); setSceneIntelligence({});
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
                            setProjectId(null); setProjectTitle("Untitled Hybrid Project"); setProjectPhase("STORY_INPUT");
                            setIdea(""); setExpandedSummary(""); setCharacters([]); setCharactersMade(false);
                            setScenes([]); setSceneImages({}); setSceneVideos({});
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

      {/* ── Production Pipeline Progress Bar ── */}
      {(() => {
        const steps = [
          { id: "story",      label: "Story",      icon: "1", done: !!idea && !!expandedSummary },
          { id: "characters", label: "Characters",  icon: "2", done: characters.length > 0 },
          { id: "scenes",     label: "Scenes",      icon: "3", done: scenes.length > 0 },
          { id: "audio",      label: "Audio",       icon: "4", done: scenes.some(s => s.audioPlan?.musicMood) },
          { id: "assembly",   label: "Assembly",    icon: "5", done: assemblyReadiness > 50 },
        ];
        const currentStepIndex = steps.findIndex(s => !s.done);
        const activeStepIndex = currentStepIndex === -1 ? steps.length - 1 : currentStepIndex;
        return (
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12, padding: "10px 16px", background: "#080d10", borderRadius: 12, border: `1px solid ${border}`, gap: 0 }}>
            {steps.map((step, i) => {
              const isActive = i === activeStepIndex;
              const isDone = step.done;
              const isLast = i === steps.length - 1;
              const stepColor = isDone ? accent : isActive ? gold : muted;
              return (
                <div key={step.id} style={{ display: "flex", alignItems: "center", flex: 1 }}>
                  <button onClick={() => setActiveTab(step.id as WorkshopTab)}
                    style={{ display: "flex", flexDirection: "column" as const, alignItems: "center", gap: 4, padding: "6px 8px", borderRadius: 8, border: "none", background: isActive ? `${gold}12` : "transparent", cursor: "pointer", flex: 1 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                      background: isDone ? accent : isActive ? `${gold}20` : "#ffffff08",
                      border: `2px solid ${stepColor}`, fontSize: 13 }}>
                      {isDone ? <Icon.Check style={{ width:12, height:12 }} /> : step.icon}
                    </div>
                    <span style={{ fontSize: 9, fontWeight: isActive ? 700 : 500, color: stepColor, whiteSpace: "nowrap" as const }}>{step.label}</span>
                  </button>
                  {!isLast && (
                    <div style={{ height: 2, flex: 1, background: i < activeStepIndex ? accent : "#ffffff10", marginTop: -10, maxWidth: 32 }} />
                  )}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ── Workshop Tab Bar — v14 ── */}
      <div style={{ display: "flex", gap: 0, background: ds.color.card, borderBottom: `1px solid ${ds.color.line}`, overflowX: "auto", marginBottom: 20 }}>
        {WORKSHOP_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 14px", background: "none", border: "none",
                color: isActive ? "#fff" : muted,
                fontWeight: isActive ? 700 : 500, fontSize: 10,
                cursor: "pointer", whiteSpace: "nowrap",
                position: "relative", fontFamily: ds.font.mono,
                textTransform: "uppercase", letterSpacing: "0.08em", minWidth: 80,
              }}>
              {tab.label}
              {tab.step !== undefined && !isActive && (
                <span style={{ marginLeft: 4, fontSize: 8, background: `${purple}22`, color: purple, borderRadius: 8, padding: "1px 5px" }}>{tab.step}</span>
              )}
              {tab.id === "scenes" && scenes.length > 0 && !isActive && (
                <span style={{ marginLeft: 4, fontSize: 8, background: `${accent}22`, color: accent, borderRadius: 8, padding: "1px 5px" }}>{scenes.length}</span>
              )}
              {isActive && (
                <span style={{ position: "absolute", bottom: 0, left: 4, right: 4, height: 2, borderRadius: 2, background: "linear-gradient(90deg, #7c5cfc, #ff7a45)" }} />
              )}
            </button>
          );
        })}
      </div>

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
          <div style={{ ...cardStyle, display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 12 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
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
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
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
                <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 4, background: `${blue}15`, color: blue }}>{projectStyle}</span>
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
              {/* Clear ghost images */}
              {Object.keys(sceneImages).length > 0 && (
                <button
                  onClick={() => { if (confirm("Clear all scene images from this board? Files are NOT deleted.")) setSceneImages({}); }}
                  title="Remove all images from this scene board (does not delete files). Use if old images from another project are showing here."
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
                const hasAudio = !!(scene.audioPlan?.musicMood || scene.audioPlan?.sfxList?.length || scene.narrationScript || selectedMusicUrl);
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
                      const tabs: Array<{ key: "image" | "audio" | "video"; label: string; done: boolean; color: string }> = [
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
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => setPreviewMedia({ url: sceneImages[scene.sceneId], type: "image", title: `${scene.sceneId}: ${scene.title}` })}
                                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                                Full Preview
                              </button>
                              <button onClick={() => makeSceneImage(scene)} disabled={generatingSceneImage === scene.sceneId}
                                style={{ flex: 1, padding: "5px 8px", borderRadius: 6, border: "none", background: generatingSceneImage === scene.sceneId ? "#2a2a40" : "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneImage === scene.sceneId ? "not-allowed" : "pointer" }}>
                                {generatingSceneImage === scene.sceneId ? "Regenerating..." : "Regen"}
                              </button>
                            </div>
                          </>
                        ) : (
                          <div style={{ textAlign: "center", padding: "12px 0" }}>
                            <p style={{ fontSize: 10, color: muted, marginBottom: 8 }}>No image generated yet</p>
                            {selectedImageModelId.includes("ideogram_v3") && (
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginBottom: 8, cursor: "pointer" }}>
                                <input type="checkbox" checked={transparentBg} onChange={e => setTransparentBg(e.target.checked)} />
                                <span style={{ fontSize: 10, color: "#aaa" }}>Transparent Background (PNG)</span>
                              </label>
                            )}
                            <button onClick={() => makeSceneImage(scene)}
                              style={{ padding: "6px 14px", borderRadius: 8, border: "none", background: "linear-gradient(135deg,#00d4ff,#0084ff)", color: "#fff", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                              Generate Image
                            </button>
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
                          {scene.audioPlan?.sfxList?.length ? (
                            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4 }}>
                              {scene.audioPlan.sfxList.map((sfx, i) => (
                                <span key={i} style={{ fontSize: 8, background: `${gold}18`, border: `1px solid ${gold}30`, borderRadius: 4, padding: "2px 6px", color: gold }}>{sfx}</span>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 9, color: muted }}>No SFX planned — run AI Audio Plan to generate</div>
                          )}
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
                            <video src={sceneVideos[scene.sceneId]} controls
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

                    {/* Content */}
                    <div style={{ padding: 14 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{scene.title}</p>
                      <p style={{ fontSize: 10, color: muted, marginBottom: 8, lineHeight: 1.4 }}>{scene.description.substring(0, 80)}{scene.description.length > 80 ? "..." : ""}</p>

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
                      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                        <span style={{ fontSize: 9, color: muted }}>{scene.credits} cr</span>
                        <span style={{ fontSize: 9, color: muted }}>{scene.motionDuration || 5}s</span>
                        {scene.narrationStrength && <span style={{ fontSize: 9, color: gold }}>Narr: {scene.narrationStrength}</span>}
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
                      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                        <button onClick={() => makeSceneImage(scene)} disabled={generatingSceneImage === scene.sceneId}
                          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: "none", background: generatingSceneImage === scene.sceneId ? "#2a2a40" : "linear-gradient(135deg, #00d4ff, #0084ff)", color: "#fff", fontSize: 9, fontWeight: 700, cursor: generatingSceneImage === scene.sceneId ? "not-allowed" : "pointer" }}>
                          {generatingSceneImage === scene.sceneId ? "Generating..." : hasImage ? "Regen Image" : "Make Image"}
                        </button>
                        {hasImage && (
                          <button onClick={() => setPreviewMedia({ url: sceneImages[scene.sceneId], type: "image", title: `${scene.sceneId}: ${scene.title}` })}
                            title="Preview image"
                            style={{ padding: "8px 10px", borderRadius: 8, border: `1px solid ${blue}40`, background: `${blue}10`, color: blue, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>Preview</button>
                        )}
                        <button onClick={() => openLibraryImport(scene.sceneId)}
                          title="Pick an image you already have from Asset Library"
                          style={{ flex: 1, padding: "8px 10px", borderRadius: 8, border: `1px solid ${blue}50`, background: `${blue}10`, color: blue, fontSize: 9, fontWeight: 700, cursor: "pointer" }}>
                          Import
                        </button>
                      </div>

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
                          {generatingSceneVideos.has(scene.sceneId) ? "Making..." : hasVideo ? "New Video" : "Make Video"}
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
                          <a href={`/dashboard/collaborative-editor?mode=ghs_hybrid&sceneId=${scene.sceneId}&from=hybrid-planner`} style={{ textDecoration: "none", display: "flex" }}
                            onClick={() => { /* return state now handled via URL params */ }}>
                            <button style={{ padding: "0 8px", borderRadius: 8, border: `1px solid ${purple}30`, background: `${purple}06`, color: purple, fontSize: 9, fontWeight: 600, cursor: "pointer" }}>
                              Editor
                            </button>
                          </a>
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
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
                      <button
                        onClick={() => generateCharacterPortrait(char)}
                        disabled={isGenerating}
                        style={{ padding: "7px 14px", borderRadius: 8, border: "none", background: isGenerating ? "#2a2a40" : `linear-gradient(135deg, ${blue}, #0084ff)`, color: "#fff", fontSize: 10, fontWeight: 700, cursor: isGenerating ? "not-allowed" : "pointer", opacity: isGenerating ? 0.7 : 1 }}>
                        {isGenerating ? "Generating..." : char.imageUrl ? "Regenerate Portrait" : "Generate Portrait"}
                      </button>
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
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
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
                          {/* Age appearance */}
                          <div>
                            <label style={{ ...labelStyle, fontSize: 9 }}>Age / Posture</label>
                            <input
                              value={char.ageAppearance || ""}
                              onChange={e => setCharacters(prev => prev.map(c => c.characterId === char.characterId ? { ...c, ageAppearance: e.target.value } : c))}
                              placeholder='e.g. "elderly, slightly hunched, wise and warm expression"'
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

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
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
                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ ...inputStyle, fontSize: 11, padding: "8px 10px" }}>
                  {["English", "French", "Spanish", "Portuguese", "Arabic", "Hindi", "Japanese", "Korean", "German", "Italian"].map(l => <option key={l} value={l} style={{ background: surface }}>{l}</option>)}
                </select>
              </div>
              {/* ── Story AI selector (GHS Tier) ── */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <label style={{ ...labelStyle, fontSize: 9, marginBottom: 0 }}>Story AI</label>
                  <button title="Free = Local LLM (no cost) · Standard = Claude Haiku (low cost) · Pro = Claude Sonnet (billed)"
                    style={{ background: "none", border: "none", color: "#5a5a7a", fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1 }}>ⓘ</button>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
                  {([
                    { tier: "free",     label: "GHS Free",     badge: "FREE", color: "#22c55e", provider: "ollama",                      desc: "Local · No cost" },
                    { tier: "standard", label: "GHS Standard", badge: "STD",  color: "#7dd3fc", provider: "claude:claude-haiku-4-5-20251001", desc: "Fast · Low cost" },
                    { tier: "pro",      label: "GHS Pro",      badge: "PRO",  color: "#a855f7", provider: "claude:claude-sonnet-4-6",     desc: "Best quality" },
                  ] as const).map(t => {
                    const isActive = storyAiProvider === t.provider;
                    return (
                      <button key={t.tier} onClick={() => setStoryAiProvider(t.provider)}
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

            <AITierSelector value={aiTier} onChange={setAiTier} compact />

            <button onClick={expandStory} disabled={!idea.trim() || expanding}
              style={{ ...btnPrimary, width: "100%", background: (!idea.trim() || expanding) ? "#2a2a40" : accent, cursor: (!idea.trim() || expanding) ? "not-allowed" : "pointer", marginTop: 10 }}>
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
                  {language !== "English" && <span style={badgeStyle(purple)}>{language}</span>}
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

              {/* Scenes detected */}
              {scenes.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Scene Breakdown</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {scenes.slice(0, 6).map(s => {
                      const typeInfo = SCENE_TYPES.find(t => t.id === s.sceneType);
                      return (
                        <div key={s.sceneId} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", borderRadius: 8, background: "#ffffff05" }}>
                          <span style={{ fontSize: 9, fontFamily: "monospace", color: blue, minWidth: 32 }}>{s.sceneId}</span>
                          <span style={{ fontSize: 11, color: "#fff", flex: 1 }}>{s.title}</span>
                          {s.mood && <span style={badgeStyle(purple)}>{s.mood}</span>}
                          {s.location && <span style={{ fontSize: 8, color: muted }}>{s.location}</span>}
                        </div>
                      );
                    })}
                    {scenes.length > 6 && <p style={{ fontSize: 9, color: muted, padding: "4px 10px" }}>+{scenes.length - 6} more scenes...</p>}
                  </div>
                </div>
              )}

              {/* Next step CTA */}
              <div style={{ display: "flex", gap: 8, paddingTop: 10, borderTop: `1px solid ${border}` }}>
                <button onClick={() => setActiveTab("characters")}
                  style={{ flex: 1, padding: "11px 0", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${purple}, #7c3aed)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                  → Step 2: Build Characters with AI
                </button>
                <button onClick={() => setActiveTab("scenes")}
                  style={{ padding: "11px 18px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>
                  Skip to Scenes
                </button>
              </div>
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

              {/* Narrator voice / provider selector — only shown after Parse Script has run */}
              {scriptSegments.length > 0 && (storyMode === "narration-only" || storyMode === "mixed") && (
                <div style={{ padding: "12px 14px", borderRadius: 10, background: "#ffffff05", border: `1px solid ${border}`, marginBottom: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 6 }}>Narration Provider</p>
                  <p style={{ fontSize: 9, color: muted, marginBottom: 10 }}>Piper = free local. FAL Narrator = cloud AI (requires FAL_KEY). ElevenLabs = premium (requires ELEVENLABS_API_KEY). Karaoke = browser speech.</p>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 12 }}>
                    {([
                      { id: "piper",       label: "Piper (free)",    color: accent },
                      { id: "fal-narrator", label: "FAL Narrator",   color: blue },
                      { id: "elevenlabs",  label: "ElevenLabs",      color: purple },
                      { id: "karaoke",     label: "Karaoke",         color: gold },
                      { id: "none",        label: "None",            color: muted },
                    ] as const).map(v => (
                      <button key={v.id} onClick={() => setNarratorVoice(v.id)}
                        style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${narratorVoice === v.id ? v.color : border}`,
                          background: narratorVoice === v.id ? `${v.color}15` : "transparent",
                          color: narratorVoice === v.id ? v.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        {v.label}
                      </button>
                    ))}
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
                      <p style={{ fontSize: 10, color: gold, fontWeight: 600 }}>Karaoke / Browser Speech</p>
                      <p style={{ fontSize: 9, color: muted, marginTop: 3 }}>Uses the browser Web Speech API (SpeechSynthesis). No API key needed. Playback is in-browser only — no audio file is saved.</p>
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
                      <option value="fal-narrator" style={{ background: surface }}>FAL Narrator</option>
                      <option value="elevenlabs" style={{ background: surface }}>ElevenLabs</option>
                      <option value="karaoke" style={{ background: surface }}>Karaoke</option>
                    </select>
                    <input value={layer.voiceId} onChange={e => updateVoiceLayer(layer.layer, { voiceId: e.target.value })}
                      placeholder={layer.providerId === "piper" ? "en_US-lessac-medium" : layer.providerId === "fal-narrator" ? "af_sky" : "voice-id"}
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
                      <span style={{ fontSize: 10, color: gold }}>Parse your script first</span>
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
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
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

          {/* ── Narration Provider — global selector (always visible in Audio tab) ── */}
          <div style={{ ...cardStyle, borderColor: `${accent}15`, marginBottom: 16 }} data-testid="narration-provider-card">
            <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 6 }}>Narration Provider</p>
            <p style={{ fontSize: 9, color: muted, marginBottom: 10 }}>Piper = free local. FAL Narrator = cloud AI (FAL_KEY). ElevenLabs = premium (ELEVENLABS_API_KEY). Karaoke = browser speech (no file).</p>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              {([
                { id: "piper",       label: "Piper (free)",   color: accent },
                { id: "fal-narrator", label: "FAL Narrator",  color: blue },
                { id: "elevenlabs",  label: "ElevenLabs",     color: purple },
                { id: "karaoke",     label: "Karaoke",        color: gold },
                { id: "none",        label: "None",           color: muted },
              ] as const).map(v => (
                <button key={v.id} onClick={() => setNarratorVoice(v.id)}
                  data-provider={v.id}
                  style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${narratorVoice === v.id ? v.color : border}`,
                    background: narratorVoice === v.id ? `${v.color}15` : "transparent",
                    color: narratorVoice === v.id ? v.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                  {v.label}
                </button>
              ))}
            </div>
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

          {/* ── Sound Browser ──────────────────────────────────────────────── */}
          <div style={{ ...cardStyle, borderColor: `${blue}25`, marginBottom: 20 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: "#fff", marginBottom: 12 }}>Sound Browser</h3>

            {/* Tab row */}
            <div style={{ display: "flex", gap: 4, background: "#ffffff06", borderRadius: 8, padding: 3, marginBottom: 14, width: "fit-content" }}>
              {([
                { id: "freesound",  label: "Freesound Library" },
                { id: "elevenlabs", label: "Generate AI SFX" },
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

                {/* Quick search tags */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
                  {["rain", "wind", "crowd", "footsteps", "fire", "ocean", "birds", "thunder", "door", "engine"].map(tag => (
                    <button key={tag} onClick={() => { setFsQuery(tag); searchFreesound(tag); }}
                      style={{ padding: "3px 10px", borderRadius: 20, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 9, cursor: "pointer", fontWeight: 600 }}>
                      {tag}
                    </button>
                  ))}
                </div>

                {/* Results */}
                {fsResults.length > 0 && (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
                    {fsResults.map(sound => (
                      <div key={sound.id} style={{ padding: "10px 12px", borderRadius: 10, background: s2, border: `1px solid ${border}` }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sound.name}</p>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
                          <span style={{ fontSize: 9, color: muted }}>{sound.duration}s</span>
                          <span style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: sound.license === "CC0" ? `${accent}20` : `${blue}20`, color: sound.license === "CC0" ? accent : blue, fontWeight: 700 }}>{sound.license}</span>
                          <span style={{ fontSize: 9, color: muted }}>by {sound.username}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {/* Preview */}
                          <button onClick={() => setSfxPreviewId(sfxPreviewId === sound.id ? null : sound.id)}
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: `1px solid ${border}`, background: sfxPreviewId === sound.id ? `${blue}20` : "transparent", color: sfxPreviewId === sound.id ? blue : muted, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
                            {sfxPreviewId === sound.id ? "⏹ Stop" : "▶ Preview"}
                          </button>
                          {/* Save */}
                          <button onClick={() => saveFreesound(sound)} disabled={fsSaved.has(sound.id) || fsSaving === sound.id}
                            style={{ flex: 1, padding: "5px 8px", borderRadius: 7, border: "none", background: fsSaved.has(sound.id) ? `${accent}20` : fsSaving === sound.id ? "#2a2a40" : accent, color: fsSaved.has(sound.id) ? accent : "#000", fontSize: 10, cursor: fsSaved.has(sound.id) || fsSaving === sound.id ? "not-allowed" : "pointer", fontWeight: 700 }}>
                            {fsSaved.has(sound.id) ? "Saved" : fsSaving === sound.id ? "Saving..." : "Save"}
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

            {/* ── ELEVENLABS SFX ── */}
            {soundTab === "elevenlabs" && (
              <div>
                <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>Describe any sound in plain English — ElevenLabs generates it (~100 credits per effect). Requires ELEVENLABS_API_KEY.</p>
                <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
                  <input value={sfxDesc} onChange={e => setSfxDesc(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && generateElevenLabsSfx()}
                    placeholder='e.g. "wooden door creaking open slowly", "rain on tin roof", "crowd cheering"'
                    style={{ ...inputStyle, flex: 1, fontSize: 11 }} />
                  <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim()}
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 }}>
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
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Pre-Flight Review</p>
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
              style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${purple}30`, background: preflightRunning ? "#2a2040" : `${purple}10`, color: purple, fontSize: 11, fontWeight: 600, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0 }}>
              {preflightRunning ? "Running pre-flight review..." : "Run Pre-flight Review"}
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

                    {/* Author name */}
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                      <span style={{ fontSize: 11, color: muted, flexShrink: 0, width: 75 }}>Written by:</span>
                      <input
                        type="text"
                        value={screenplayAuthor}
                        onChange={e => setScreenplayAuthor(e.target.value)}
                        placeholder="Enter your name"
                        style={{ ...inputStyle, flex: 1, maxWidth: 260, fontSize: 12, fontWeight: 600 }}
                      />
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 14 }}>
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
                          <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Pre-Flight Review</p>
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
                        style={{ width: "100%", padding: "10px", borderRadius: 10, border: `1px solid ${purple}30`, background: preflightRunning ? "#2a2040" : `${purple}10`, color: purple, fontSize: 11, fontWeight: 600, cursor: preflightRunning ? "not-allowed" : "pointer", marginBottom: preflightResult ? 10 : 0 }}>
                        {preflightRunning ? "Running pre-flight review..." : "Run Pre-flight Review"}
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
                      {assembling ? "Assembling your movie... please wait" : !done2 ? "Complete Step 2 to unlock" : `Assemble My Movie (${selectedSceneIds.length} scenes)`}
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
                          <a href="/dashboard/collaborative-editor?from=hybrid-planner" style={{ flex: 1, textDecoration: "none" }}>
                            <button style={{ ...btnPrimary, width: "100%", background: purple }}>Open in Editor</button>
                          </a>
                          <button onClick={() => setActiveTab("screenplay")}
                            style={{ ...btnPrimary, background: "#2a2a40", border: `1px solid ${purple}40`, color: purple }}>Screenplay</button>
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
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
            ].map(style => {
              const isSelected = projectStyle === style.id;
              return (
                <div key={style.id}
                  onClick={() => { setProjectStyle(style.id); setLastAction(`Art style set to ${style.name}`); setShowStylePicker(false); }}
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
    </div>
  );
}
