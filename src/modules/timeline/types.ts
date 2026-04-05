// Timeline engine — core data structures for GioHomeStudio
// Every output mode (Text to Video, Text to Audio, Images+Audio, Hybrid, Video to Video)
// assembles beats on this shared timeline before rendering.

export type BeatType =
  | "narration"   // spoken narration over video or still
  | "dialogue"    // character dialogue line
  | "image"       // display a still image (for images+audio mode)
  | "video"       // video clip (for text-to-video or hybrid mode)
  | "sfx"         // sound effect trigger
  | "ambience"    // looping background ambience
  | "music"       // music segment
  | "silence"     // intentional pause / breath

export type OutputMode =
  | "text_to_video"    // Full video with AI-generated clips
  | "text_to_audio"    // Audio-only: narration + dialogue + music + SFX
  | "video_to_video"   // Transform/enhance existing video
  | "images_audio"     // Still images synced to narration/music beats
  | "hybrid"           // Key action scenes as video, rest as images+audio
  | "image_to_video"   // Animate a source character image with an action prompt

export interface Beat {
  id: string
  type: BeatType
  /** Start position in milliseconds from timeline start */
  startMs: number
  /** Duration of this beat in milliseconds */
  durationMs: number
  /** Script text — narration or dialogue line */
  text?: string
  /** Speaker name for dialogue beats */
  speakerName?: string
  /** Registered character id for casting consistency */
  characterId?: string
  /** Image generation prompt (for image beats) */
  imagePrompt?: string
  /** SFX event key matching storage/sfx/ filenames, e.g. "thunder", "sword_clash" */
  sfxEvent?: string
  /** Music mood for music beats */
  musicMood?: string
  /** Volume level 0–1 */
  volume?: number
  /** Whether this beat is a high-action moment — used by hybrid mode to decide video vs image */
  isActionBeat?: boolean
  /** Scene emotion detected for this beat */
  emotionalTone?: string
  /** Scene type: interior, exterior, crowd, etc. */
  sceneType?: string
}

export interface Timeline {
  id: string
  outputMode: OutputMode
  /** Total duration in milliseconds */
  totalDurationMs: number
  beats: Beat[]
  /** Characters cast for this timeline */
  castingCharacters?: string[]
  /** Story thread id for series continuity */
  storyThreadId?: string
  createdAt: number
}
