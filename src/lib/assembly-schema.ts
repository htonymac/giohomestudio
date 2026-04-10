// GHS Assembly JSON Schema — Source of Truth
//
// AI plans → Assembly JSON → FFmpeg executes deterministically
// Same schema across all model tiers — only planning quality changes
//
// This is the core architecture from the Support Canvas:
// "Assembly JSON becomes source of truth"
// "FFmpeg command builder converts the JSON into deterministic commands"

export interface AssemblySegment {
  id: string;
  type: "video" | "image" | "audio_bridge" | "title_card" | "transition";
  sourceUrl: string;          // path to video/image file
  startTime: number;          // seconds in timeline
  endTime: number;
  duration: number;

  // Image treatment (for image segments)
  imageTreatment?: "static" | "zoom_in" | "zoom_out" | "pan_left" | "pan_right" | "parallax";

  // Transition
  transitionIn?: "cut" | "fade" | "dissolve" | "slide";
  transitionOut?: "cut" | "fade" | "dissolve" | "slide";
  transitionDuration?: number; // seconds
}

export interface NarrationEntry {
  id: string;
  text: string;
  voiceId?: string;
  speakerId?: string;         // character name
  startTime: number;
  endTime: number;
  volume: number;             // 0-1
  speed: number;              // 0.5-2.0
  style?: "normal" | "whisper" | "emotional" | "commanding" | "gentle";
  audioUrl?: string;          // generated audio file
}

export interface MusicEntry {
  id: string;
  sourceUrl: string;          // path to music file
  startTime: number;
  endTime: number;
  volume: number;             // 0-1 (typically 0.15-0.35 for background)
  fadeIn?: number;            // seconds
  fadeOut?: number;
  duckUnderSpeech: boolean;   // true = lower volume when narration is active
  duckLevel?: number;         // volume during ducking (e.g. 0.08)
  licenseType?: string;
  attributionText?: string;
}

export interface SFXEntry {
  id: string;
  event: string;              // SFX event name from library
  sourceUrl: string;
  startTime: number;
  duration: number;
  volume: number;             // 0-1
  loop: boolean;
  category: string;
  licenseType?: string;
}

export interface AmbienceEntry {
  id: string;
  sourceUrl: string;
  startTime: number;
  endTime: number;
  volume: number;             // 0-1 (typically 0.1-0.25)
  loop: boolean;
  fadeIn?: number;
  fadeOut?: number;
  description: string;        // e.g. "car interior night drive"
}

export interface SubtitleEntry {
  id: string;
  text: string;
  startTime: number;
  endTime: number;
  position: "top" | "center" | "bottom";
  fontSize: number;
  fontColor: string;
  backgroundColor?: string;
  style: "normal" | "bold" | "highlight" | "karaoke";
}

export interface OverlayEntry {
  id: string;
  type: "logo" | "text" | "cta" | "watermark";
  content: string;            // text or image URL
  startTime: number;
  endTime: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  opacity: number;
}

export interface VolumeAutomation {
  time: number;
  layer: "narration" | "music" | "sfx" | "ambience" | "original";
  volume: number;             // 0-1
  rampDuration?: number;      // seconds to reach this volume
}

export interface AssemblyJSON {
  version: number;
  projectId: string;
  projectType: string;
  title: string;

  // Timeline
  totalDuration: number;      // seconds
  aspectRatio: "16:9" | "9:16" | "1:1";
  resolution: { width: number; height: number };

  // Layers
  segments: AssemblySegment[];
  narration: NarrationEntry[];
  music: MusicEntry[];
  sfx: SFXEntry[];
  ambience: AmbienceEntry[];
  subtitles: SubtitleEntry[];
  overlays: OverlayEntry[];

  // Volume automation
  volumeAutomation: VolumeAutomation[];

  // Ducking rules
  duckingRules: {
    narrationPriority: boolean;   // true = always duck music/ambience under narration
    musicDuckLevel: number;       // volume when ducking (e.g. 0.08)
    ambienceDuckLevel: number;
    sfxDuckLevel: number;
  };

  // Export settings
  exportSettings: {
    format: "mp4" | "webm" | "mp3" | "wav";
    quality: "draft" | "standard" | "high" | "maximum";
    includeSubtitles: boolean;
    includeWatermark: boolean;
    includeCredits: boolean;
    creditsText?: string;         // auto-generated attribution text
  };

  // Metadata
  plannerTier: "standard" | "pro" | "premium" | "premium_best";
  supervisorTier?: string;
  soundLicenses: Array<{ assetId: string; license: string; attribution?: string }>;
  rightsConfirmed: boolean;
  previewApproved: boolean;
  exportApproved: boolean;
}

// Create empty assembly JSON for a new project
export function createEmptyAssembly(projectId: string, projectType: string, title: string): AssemblyJSON {
  return {
    version: 1,
    projectId,
    projectType,
    title,
    totalDuration: 0,
    aspectRatio: "16:9",
    resolution: { width: 1920, height: 1080 },
    segments: [],
    narration: [],
    music: [],
    sfx: [],
    ambience: [],
    subtitles: [],
    overlays: [],
    volumeAutomation: [],
    duckingRules: {
      narrationPriority: true,
      musicDuckLevel: 0.08,
      ambienceDuckLevel: 0.12,
      sfxDuckLevel: 0.15,
    },
    exportSettings: {
      format: "mp4",
      quality: "standard",
      includeSubtitles: false,
      includeWatermark: false,
      includeCredits: false,
    },
    plannerTier: "standard",
    soundLicenses: [],
    rightsConfirmed: false,
    previewApproved: false,
    exportApproved: false,
  };
}
