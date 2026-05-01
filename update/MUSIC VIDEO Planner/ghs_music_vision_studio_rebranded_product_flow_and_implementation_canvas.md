# GHS MusicVision Studio — Rebranded Product Flow and Implementation Canvas

## Working Product Name

# GHS MusicVision Studio

**Internal module name:** GHS AI Music Video Creator  
**Current technical route:** `/dashboard/music-video-planner`  
**Product positioning:** a review-first AI music video director inside GioHomeStudio.

## Product Tagline

**Turn any song into a directed music video — with AI planning, FAL-powered scene generation, storyboard control, lyric timing, and final assembly.**

---

# 1. Why This Rebrand Matters

The old name, **GHS AI Music Video Creator**, is understandable but too ordinary. It sounds like a simple generator.

The product should not feel like:
- random slideshow software
- one-click video spam
- plain clip stitching
- uncontrolled prompt-to-video
- a confusing professional editing tool

It should feel like:
- an AI music video director
- a storyboard studio
- a music-to-visual planning engine
- a scene generation and assembly system
- a professional but simple creative workflow

## Recommended Public Name

## GHS MusicVision Studio

This name fits because the product does more than generate clips. It listens to the music, understands the mood, designs the visual direction, creates a storyboard, generates scenes using provider models such as FAL models, and assembles the final video.

## Alternative Names

1. **GHS MusicVision Studio** — recommended
2. **GHS Music Video Director** — clearer but less premium
3. **GHS Song-to-Video Studio** — simple but less brandable
4. **GHS Visual Music Studio** — good but less direct
5. **GHS Music Video Lab** — creative but less polished

Final recommendation: use **GHS MusicVision Studio** as the user-facing name and keep **GHS AI Music Video Creator** as the internal feature description.

---

# 2. Core Product Statement

GHS MusicVision Studio is a dedicated AI music video system inside GioHomeStudio that allows a user to create or import music, let GHS understand the song, generate a visual concept, build a storyboard, create scenes using AI models, preview before spending heavily, and render a complete music video for real use.

The product should support:
- full official music videos
- lyric videos
- audio visualizers
- image-and-music videos
- AI artist performance videos
- dance-style videos
- children learning music videos
- commercial jingle and promo videos
- short teaser cuts for TikTok, Reels, Shorts, WhatsApp, and Telegram

The product should be built around one principle:

## Music must drive the visuals.

Not random prompts. Not random scenes. Not just “upload audio and stitch video.”

The music analysis must guide:
- scene pacing
- camera movement
- visual mood
- color tone
- chorus intensity
- lyric emphasis
- caption timing
- scene duration
- FAL model selection
- final assembly structure

---

# 3. Current Code Workflow From Codex

The current `/dashboard/music-video-planner` already has a real stage-based workflow.

## Existing Planner Tabs

1. Overview
2. Song Input
3. Mode & AI
4. Storyboard
5. Screenplay
6. Captions
7. Audio
8. Assembly

## Existing Actual Flow

```text
Song Input
  ↓
Mode & AI
  ↓
Analyze Song
  ↓
Save / Load Project
  ↓
Generate Storyboard
  ↓
Expand Story / Scene Intelligence
  ↓
Screenplay Generation
  ↓
Captions Editing
  ↓
Audio Selection / Narration / SFX
  ↓
Assembly
```

## Existing Strengths

The current workflow is not useless. It already has important product foundations:

- song input exists
- lyrics input exists
- upload / generate / library source mode exists
- video mode selection exists
- visual style selection exists
- artist name input exists
- song analysis route exists
- project save/load exists
- storyboard generation exists
- scene objects exist
- screenplay generation exists
- screenplay parsing exists
- narration/dialogue segments exist
- scene image/video handling exists
- music library picker exists
- AI music picking exists
- narration controls exist
- SFX/Freesound support exists
- final assembly route exists

## Existing Weaknesses

The current weak areas are:

1. **Caption timing is still lightweight**  
   Lyrics can be edited for timed captions, but there is no strong automatic timestamp engine yet.

2. **No mature beat-sync engine**  
   The product needs a reusable beat/section/timeline module that can drive cuts, motion, caption emphasis, and scene changes.

3. **Script-to-timeline conversion is still weak**  
   Screenplay exists, but it needs stronger conversion into scene-by-scene timeline instructions.

4. **Assembly has two paths**  
   There is a simple slideshow-style path and a stronger music-video path. These should be clarified, not mixed carelessly.

5. **FAL/provider model planning needs structure**  
   The system should not randomly choose models. It needs a provider router that selects the right model type for each scene.

## Blunt Verdict

The current product is already a real planner and assembly workflow. It should not be deleted. It should be upgraded.

The correct move is:

```text
Do not rebuild everything from zero.
Rebrand it.
Clean the flow.
Strengthen intelligence layers.
Add FAL provider routing.
Build a real timeline engine.
Improve preview and approval.
```

---

# 4. New Product Flow — Proper Professional Flow

The new clean flow should be:

```text
1. Start Project
   ↓
2. Music Intake
   ↓
3. Song Intelligence Analysis
   ↓
4. Creative Direction
   ↓
5. Mode Selection
   ↓
6. AI Director Plan
   ↓
7. Storyboard + Timeline
   ↓
8. Scene Generation Plan
   ↓
9. Preview Frames / Preview Clips
   ↓
10. User Review and Approval
   ↓
11. FAL Scene Generation
   ↓
12. Lyrics / Captions / Narration / SFX
   ↓
13. Final Assembly
   ↓
14. Export Versions
   ↓
15. Registry / Review Inbox / Publish Later
```

This is the proper foundation.

---

# 5. User-Facing Journey

## Step 1 — Start Project

User enters Studio and sees:

- Music Studio
- MusicVision Studio

Inside MusicVision Studio, the user can start from:

- existing GHS-generated song
- uploaded MP3/WAV
- beat-only track
- voice + music track
- lyrics + music
- image + music
- commercial jingle
- children song
- saved library song

## Step 2 — Music Intake

User provides:

- song title
- artist name or brand name
- audio file or song selection
- lyrics if available
- optional concept direction
- optional reference style
- intended output format
- target platform

Example target platforms:

- YouTube full video
- TikTok/Reels/Shorts
- WhatsApp status
- Telegram
- brand promo
- church/event promo
- children learning content

## Step 3 — GHS Analyzes The Song

GHS should analyze:

- duration
- tempo
- energy level
- mood
- genre guess
- intro
- verse sections
- chorus/high-energy sections
- bridge/breakdown
- outro
- emotional movement
- lyric themes
- possible visual directions
- best video mode suggestions

The analysis output should create a **Song Intelligence Profile**.

## Step 4 — Creative Direction

GHS suggests 3 to 5 visual directions.

Example:

```text
Option A: Cinematic street story
Option B: Luxury Afrobeats performance
Option C: Dark neon club visualizer
Option D: Lyric video with worship glow
Option E: Commercial promo cut
```

Each direction should show:

- mood
- color palette
- camera style
- scene count
- estimated generation method
- estimated cost/credits
- best output ratio

## Step 5 — User Selects Mode

Core modes:

1. Official Music Video
2. Lyric Video
3. Visualizer
4. Story Music Video
5. AI Artist Performance
6. Dance Mode
7. Image + Music Video
8. Image + Voice + Music Video
9. Commercial Music Promo
10. Children Music Video
11. Short Teaser Cut

## Step 6 — AI Director Plan

This is the heart of the product.

GHS should behave like an AI music video director, not just a generator.

The AI Director should produce:

- final concept title
- one-paragraph concept summary
- scene list
- visual style
- camera movement plan
- color mood
- lyric/caption approach
- performance style
- generation method per scene
- FAL model category per scene
- preview plan
- cost estimate
- safety/rights check

## Step 7 — Storyboard + Timeline

Storyboard must not be just scene descriptions. It should become a structured timeline.

Each scene should store:

```ts
type MusicVideoScene = {
  id: string;
  order: number;
  songSection: 'intro' | 'verse' | 'pre_chorus' | 'chorus' | 'bridge' | 'outro' | 'custom';
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
  scenePurpose: string;
  visualPrompt: string;
  negativePrompt?: string;
  visualStyle: string;
  cameraMovement: string;
  motionIntensity: 'low' | 'medium' | 'high';
  lyricOverlayMode: 'none' | 'key_line' | 'full_lyrics' | 'karaoke';
  captionText?: string;
  generationMethod: 'text_to_video' | 'image_to_video' | 'image_generation' | 'uploaded_media' | 'motion_graphics' | 'hybrid';
  providerPreference: 'fal' | 'mock' | 'local' | 'manual' | 'auto';
  providerModelKey?: string;
  referenceImageId?: string;
  generatedImageUrl?: string;
  generatedVideoUrl?: string;
  status: 'draft' | 'preview_ready' | 'approved' | 'generating' | 'generated' | 'failed' | 'blocked';
};
```

This gives Claude Code a clear object shape to build around.

---

# 6. FAL Provider Layer — Important Architecture

GHS should use FAL models through a provider layer, not by hardcoding one model directly into the UI.

## Core Rule

```text
The planner should choose a generation method.
The provider router should choose the model.
The model registry should store provider-specific settings.
```

## Why This Matters

FAL model availability, cost, duration limits, aspect ratios, and strengths can change. GHS should not break when one model changes.

The system should support:

- text-to-video models
- image-to-video models
- image generation models
- video enhancement models
- lip-sync or performance models if available
- upscaling models
- background/remix/utility models
- mock generation for testing

## Recommended Internal Layers

```text
AI Director
  ↓
Scene Planner
  ↓
Generation Method Selector
  ↓
Provider Router
  ↓
FAL Adapter / Mock Adapter / Future Provider Adapter
  ↓
Job Queue
  ↓
Generated Asset Storage
  ↓
Assembly Engine
```

## Provider Registry Shape

```ts
type ProviderModelConfig = {
  id: string;
  provider: 'fal' | 'mock' | 'local' | 'other';
  modelKey: string;
  displayName: string;
  taskType: 'text_to_video' | 'image_to_video' | 'image_generation' | 'video_enhancement' | 'lip_sync' | 'upscale' | 'utility';
  maxDurationSec?: number;
  supportedAspectRatios: Array<'9:16' | '16:9' | '1:1' | '4:5'>;
  supportsReferenceImage: boolean;
  supportsPrompt: boolean;
  supportsNegativePrompt: boolean;
  estimatedCreditCost: number;
  qualityTier: 'draft' | 'standard' | 'premium';
  enabled: boolean;
};
```

## Model Selection Logic

The planner should not say only “use FAL.” It should say:

```text
Scene 1 needs text-to-video, 9:16, cinematic, 5 seconds, medium motion.
Provider router selects the best enabled FAL model for that task.
```

Example model selection categories:

```text
Opening cinematic scene       → text-to-video or image-to-video
Artist performance scene      → image-to-video / performance-capable model
Lyric background scene        → image generation + motion graphics
Dance scene                   → motion-heavy video model
Children learning scene       → image generation + simple animation
Commercial product scene      → image generation + image-to-video
Visualizer                    → local motion graphics / FFmpeg, not expensive AI video
```

## What Claude Code Should Build

Claude Code should create or improve:

```text
/lib/providers/modelRegistry.ts
/lib/providers/falAdapter.ts
/lib/providers/providerRouter.ts
/lib/music-video/scenePlanner.ts
/lib/music-video/timelineEngine.ts
/lib/music-video/creditEstimator.ts
/lib/music-video/safetyRightsGuard.ts
```

Do not place all logic inside the page component.

---

# 7. The Intelligent AI Design Layer

The product needs several intelligence agents or modules.

## 1. Song Intelligence Agent

Purpose: understand the audio and lyrics.

Outputs:

- song profile
- mood
- genre
- energy curve
- section map
- beat/highlight points
- lyric themes
- suggested video modes

## 2. Creative Director Agent

Purpose: create the artistic direction.

Outputs:

- concept title
- story direction
- visual mood
- color palette
- location style
- wardrobe/style cues
- camera direction
- suggested scene count

## 3. Storyboard Agent

Purpose: turn concept into scenes.

Outputs:

- scene list
- scene purpose
- start/end time
- scene prompt
- movement
- caption mode
- generation method

## 4. Timeline Agent

Purpose: make the scenes obey the music.

Outputs:

- scene timing
- cut points
- chorus emphasis
- lyric timestamps
- narration placement
- SFX placement
- beat-sync markers

## 5. Prompt Engineer Agent

Purpose: convert normal scene ideas into proper video prompts.

Outputs:

- text-to-video prompt
- image generation prompt
- image-to-video motion prompt
- negative prompt
- camera instruction
- continuity instruction

## 6. Provider Router Agent

Purpose: choose the right provider/model for each scene.

Outputs:

- provider
- model key
- task type
- aspect ratio
- duration
- cost estimate
- fallback route

## 7. Safety and Rights Agent

Purpose: block risky uses before generation/export.

Checks:

- unauthorized real-person likeness
- celebrity cloning
- unsafe children visuals
- explicit/sexual prompts
- deceptive impersonation
- brand/IP risks
- voice cloning risks

## 8. Assembly Agent

Purpose: convert scene outputs into the final render plan.

Outputs:

- FFmpeg timeline plan
- clip order
- trim points
- audio mix
- captions
- overlays
- logo/CTA
- export variants

---

# 8. Improved Stage Flow For The UI

The existing tabs are good, but the naming and logic should be made clearer.

## Recommended New Tabs

1. **Start**
2. **Song**
3. **AI Direction**
4. **Storyboard**
5. **Timeline**
6. **Lyrics & Captions**
7. **Visual Generation**
8. **Audio & SFX**
9. **Review**
10. **Render & Export**

## Why Add Timeline Tab?

The current workflow jumps from Storyboard to Screenplay/Captions/Audio. But music videos need a timeline layer.

The Timeline tab should show:

- song waveform if available
- detected sections
- scene blocks
- lyrics blocks
- caption blocks
- narration blocks
- SFX markers
- beat/highlight markers
- export duration

This becomes the missing bridge between storyboard and assembly.

---

# 9. New Clean Workflow For Claude Code

## Current Flow

```text
Song -> Analyze -> Storyboard -> Screenplay -> Captions -> Audio -> Assembly
```

## Improved Flow

```text
Song -> Analyze -> AI Direction -> Storyboard -> Timeline -> Preview -> Generate Scenes -> Captions/Audio -> Assembly -> Export
```

## What Changes

### Keep

- Song Input
- Mode & AI
- Storyboard
- Screenplay
- Captions
- Audio
- Assembly
- Project save/load
- Analyze route
- Assembly route

### Add / Strengthen

- AI Direction object
- Timeline engine
- FAL provider router
- model registry
- automatic timestamp engine
- script-to-timeline converter
- beat/section markers
- preview approval gate
- structured credit estimate

### Do Not Do

- do not delete working route
- do not hardcode one FAL model everywhere
- do not charge credits before approval
- do not let final render happen before preview
- do not merge all tabs into one messy form
- do not create dead menu tiles that lead nowhere

---

# 10. Music Video Modes — Replanned

## MVP Modes To Keep Now

### 1. Official Music Video

For a full visual concept around a song.

Best for:
- artist songs
- gospel songs
- afrobeat songs
- love songs
- cinematic songs
- story songs

Generation method:
- hybrid
- FAL text-to-video
- FAL image-to-video
- uploaded clips if available

### 2. Lyric Video

For timed lyrics, animated text, and mood visuals.

Best for:
- worship songs
- songwriter demos
- emotional songs
- low-cost release videos

Generation method:
- mostly motion graphics
- background image generation
- optional short video loops
- FFmpeg/text overlays

### 3. Visualizer

For audio release videos and beat visuals.

Best for:
- beats
- unreleased songs
- quick YouTube uploads
- low-credit outputs

Generation method:
- local motion graphics
- waveform animation
- background loop
- no need for expensive video generation

### 4. Image + Music Video

For user photos, artist images, product images, fashion images, property images.

Generation method:
- image-to-video
- pan/zoom
- motion graphics
- captions
- transitions

### 5. AI Artist Performance

For approved artist or character images.

Generation method:
- image-to-video
- performance prompts
- stage/studio scenes
- rights confirmation required for real people

### 6. Commercial Music Promo

For jingles, product songs, property songs, church/event songs, brand identity music.

Generation method:
- product images
- text overlays
- short scenes
- CTA ending
- logo overlays

### 7. Children Music Video

For ABC, counting, colors, shapes, nursery music.

Generation method:
- safe image generation
- simple animation
- strong captions
- slow pacing
- no risky prompts

### 8. Dance Mode Basic

For energetic songs.

Generation method:
- dance/performance prompts
- motion-heavy scenes
- short social cuts

---

# 11. Preview-First System

This is non-negotiable.

The user must see the plan before GHS spends heavy credits.

## Preview Should Show

- song title
- artist/brand name
- selected mode
- song mood
- visual concept
- scene count
- scene list
- approximate duration
- generation method per scene
- selected provider/model category
- lyric/caption style
- narration option
- estimated credits
- export formats

## Preview Types

### Low-Cost Preview

- storyboard cards
- AI-generated still frames
- placeholder videos
- mock clips
- local motion preview

### Final Render

- full FAL scene generation
- final scene assembly
- final captions
- final audio mix
- export variants

## Credit Rule

```text
Preview can be low-cost.
Final render must require approval.
No hidden deduction.
Every charge should be logged.
```

---

# 12. Timeline Engine — The Missing Core

This is the most important technical upgrade.

## Purpose

The timeline engine converts song analysis, storyboard, screenplay, lyrics, captions, narration, SFX, and generated clips into one renderable plan.

## Timeline Object

```ts
type MusicVideoTimeline = {
  projectId: string;
  songDurationSec: number;
  aspectRatio: '9:16' | '16:9' | '1:1' | '4:5';
  sections: SongSection[];
  scenes: MusicVideoScene[];
  captions: CaptionSegment[];
  narration: NarrationSegment[];
  sfx: SfxSegment[];
  overlays: OverlaySegment[];
  renderSettings: RenderSettings;
};
```

## Section Object

```ts
type SongSection = {
  id: string;
  label: 'intro' | 'verse' | 'chorus' | 'bridge' | 'outro' | 'custom';
  startTimeSec: number;
  endTimeSec: number;
  energy: 'low' | 'medium' | 'high';
  mood: string;
};
```

## Caption Segment Object

```ts
type CaptionSegment = {
  id: string;
  startTimeSec: number;
  endTimeSec: number;
  text: string;
  style: 'subtitle' | 'lyric' | 'karaoke' | 'highlight';
  position: 'top' | 'middle' | 'bottom';
};
```

## Timeline Engine Must Do

- prevent scenes from exceeding song duration
- align scene lengths to music sections
- align captions to lyrics
- align narration intro/outro without covering vocals badly
- place strongest visuals on chorus/high-energy sections
- allow short teaser extraction
- allow multiple export ratios
- produce FFmpeg-ready instructions

---

# 13. Script-To-Timeline Converter

The current screenplay system should not just create text. It should push useful timing back into the storyboard.

## What It Should Convert

From screenplay:

```text
Scene description
Narration
Dialogue
Action
Emotion
Camera instruction
```

Into timeline:

```text
scene purpose
start/end time
visual prompt
caption/narration segment
generation method
camera movement
```

## Example

Screenplay text:

```text
Verse 1: The artist walks alone through a quiet Lagos street at night, thinking about the pain behind the song.
```

Timeline result:

```text
Scene 2
Section: Verse 1
Start: 0:18
End: 0:35
Prompt: cinematic Lagos night street, solo artist walking slowly, reflective emotion, soft street lights, realistic music video style
Camera: slow tracking shot
Motion: medium
Caption: optional key lyric line
Generation: text-to-video or image-to-video
```

---

# 14. Caption and Timestamp Engine

The caption system should become stronger.

## Current Problem

Captions are editable, but the system is not yet a strong automatic timestamp engine.

## MVP Upgrade

Add a caption timing engine that supports:

- manual lyrics paste
- auto line splitting
- basic timing across song duration
- chorus emphasis
- key-line mode
- full lyric mode
- karaoke mode later
- caption style presets
- export subtitle file later

## Caption Modes

1. No Captions
2. Key Lyric Lines
3. Full Lyrics
4. Chorus Only
5. Karaoke Style
6. Commercial Text Overlay
7. Children Learning Captions

## Children Mode Caption Rule

Children content must have clear, large, slow captions.

---

# 15. Assembly Strategy

Current assembly has two paths:

1. `assembleMusicVideo()` → simpler slideshow-style path posting to `/api/hybrid/assemble`
2. `assembleMovie()` → stronger music-video path posting to `/api/music-video/assemble`

## Recommendation

Rename and clarify the assembly paths.

### Simple Assembly Path

Use for:
- visualizer
- lyric video
- image + music
- low-cost preview
- slideshow-like outputs

Suggested name:

```text
assembleSimpleMusicVideo()
```

### Director Assembly Path

Use for:
- official music video
- storyboard scenes
- FAL-generated scenes
- full timeline render
- final approved output

Suggested name:

```text
assembleDirectedMusicVideo()
```

## Do Not Confuse Them

The product can keep both. But the UI must know when to use each.

---

# 16. UI Replan

The uploaded HTML direction is visually useful because it already separates Music Studio and Music Video Studio.

## Recommended Studio Home Structure

### Top Tabs

- Music Studio
- MusicVision Studio

### Music Studio Cards

- Text to Music
- Lyrics to Music
- Image to Music
- Voice to Music
- Image + Voice to Music

### MusicVision Studio Cards

- Audio to Music Video
- Full Music Video
- Image Music Video
- AI Artist Performance
- Lyric Video
- Visualizer
- Short Teaser Cut
- Commercial Music Promo
- Children Music Video
- Dance Mode

## UI Rule

Every card must open a real editor state.

No dead cards.  
No static menu.  
No card that looks clickable but does nothing.

---

# 17. Data Model Additions

## Music Video Project

```ts
type MusicVideoProject = {
  id: string;
  title: string;
  artistName?: string;
  sourceMode: 'upload' | 'generate' | 'library';
  audioUrl?: string;
  lyrics?: string;
  selectedMode: MusicVideoMode;
  visualStyle: string;
  analysis?: SongAnalysis;
  aiDirection?: AiDirection;
  storyboard: MusicVideoScene[];
  timeline?: MusicVideoTimeline;
  captions: CaptionSegment[];
  narration: NarrationSegment[];
  sfx: SfxSegment[];
  providerJobs: ProviderJob[];
  reviewStatus: ReviewStatus;
  creditEstimate?: CreditEstimate;
  finalExports: ExportAsset[];
  createdAt: string;
  updatedAt: string;
};
```

## AI Direction

```ts
type AiDirection = {
  conceptTitle: string;
  conceptSummary: string;
  mood: string;
  colorMood: string;
  visualStyle: string;
  cameraLanguage: string;
  sceneStrategy: string;
  captionStrategy: string;
  generationStrategy: 'simple' | 'ai_video' | 'image_to_video' | 'hybrid';
  recommendedAspectRatios: Array<'9:16' | '16:9' | '1:1' | '4:5'>;
};
```

## Provider Job

```ts
type ProviderJob = {
  id: string;
  projectId: string;
  sceneId?: string;
  provider: 'fal' | 'mock' | 'local' | 'other';
  modelKey: string;
  taskType: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
  creditCostEstimate: number;
  creditCostFinal?: number;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};
```

---

# 18. API Route Replan

Keep existing routes where possible, but clean the architecture.

## Existing Routes To Preserve

```text
/api/music-video/analyze
/api/music-video/project
/api/music-video/project/[id]
/api/music-video/assemble
/api/hybrid/assemble
```

## Recommended New Routes

```text
/api/music-video/direct
/api/music-video/storyboard
/api/music-video/timeline
/api/music-video/preview
/api/music-video/generate-scene
/api/music-video/provider-job
/api/music-video/caption-timing
/api/music-video/credit-estimate
/api/music-video/safety-check
```

## Route Purposes

### `/api/music-video/direct`

Creates the AI Director plan.

### `/api/music-video/storyboard`

Creates or regenerates storyboard scenes.

### `/api/music-video/timeline`

Converts storyboard + song sections + lyrics into timeline.

### `/api/music-video/preview`

Creates low-cost preview frames/cards/clips.

### `/api/music-video/generate-scene`

Generates one scene using provider router.

### `/api/music-video/provider-job`

Tracks FAL/mock/local generation jobs.

### `/api/music-video/caption-timing`

Creates caption segments from lyrics and song structure.

### `/api/music-video/credit-estimate`

Estimates credits before approval.

### `/api/music-video/safety-check`

Runs rights and safety checks before generation/export.

---

# 19. Practical MVP Build Order

## Phase 1A — Clean Product Foundation

Build or improve:

- rebrand UI to MusicVision Studio
- keep existing planner route
- clean Studio entry cards
- ensure each card opens correct editor state
- preserve project save/load
- improve mode selection
- improve visual style selection
- add AI Direction object
- add preview-first wording

## Phase 1B — Intelligence Layer

Build:

- stronger song analysis output
- AI Director plan
- storyboard scene schema upgrade
- basic timeline engine
- script-to-timeline converter
- caption timing engine MVP

## Phase 1C — FAL Provider Layer

Build:

- model registry
- provider router
- FAL adapter
- mock adapter fallback
- provider job tracking
- per-scene provider selection
- error handling and retries

## Phase 1D — Preview and Approval

Build:

- preview cards
- preview frames/clips
- credit estimate
- approval gate
- review status updates
- low-balance handling
- no hidden deduction

## Phase 1E — Final Assembly

Build:

- timeline-to-FFmpeg render plan
- directed music video assembly
- lyric/caption overlay
- narration intro/outro
- SFX placement
- export variants

---

# 20. What To Tell Claude Code Clearly

Claude Code should not be told “make music video better.” That is too vague.

Use this instruction:

```text
Rebrand and restructure the current /dashboard/music-video-planner into GHS MusicVision Studio without deleting the working workflow.

Keep the existing Song Input, Mode & AI, Storyboard, Screenplay, Captions, Audio, and Assembly foundations.

Add a cleaner AI Director flow:
Song -> Analyze -> AI Direction -> Storyboard -> Timeline -> Preview -> Scene Generation -> Captions/Audio -> Assembly -> Export.

Create a provider-agnostic model layer for FAL and future providers. Do not hardcode one model into the UI.

Add a model registry, provider router, FAL adapter, mock fallback, scene generation jobs, and credit estimation.

Strengthen the weak areas identified by Codex: automatic lyric/narration timestamps, script-to-timeline conversion, and reusable beat/timeline sync.

Preserve the preview-first rule: no expensive final render before user review and approval.
```

---

# 21. Prompt For Claude Code

Copy and send this to Claude Code:

```text
We are upgrading the current GioHomeStudio music video planner into a cleaner product called GHS MusicVision Studio.

Current route:
/dashboard/music-video-planner

Current workflow already exists:
Overview -> Song Input -> Mode & AI -> Storyboard -> Screenplay -> Captions -> Audio -> Assembly.

Do not delete this working planner. Rebrand and strengthen it.

New target workflow:
Song -> Analyze -> AI Direction -> Storyboard -> Timeline -> Preview -> Scene Generation -> Captions/Audio -> Assembly -> Export.

Main goals:
1. Rebrand the user-facing feature as GHS MusicVision Studio.
2. Keep the existing planner foundations.
3. Add a proper AI Director layer that creates concept title, concept summary, mood, color style, camera language, scene strategy, caption strategy, and generation strategy.
4. Add a Timeline Engine that maps song sections, scenes, lyrics, captions, narration, SFX, overlays, and render settings into one structured timeline object.
5. Add or prepare a provider-agnostic model layer for FAL models and future providers.
6. Do not hardcode one FAL model directly inside the UI.
7. Create model registry, provider router, FAL adapter, mock adapter fallback, and provider job tracking.
8. Strengthen weak areas: lyric/narration auto timestamps, script-to-timeline conversion, reusable beat/section sync logic.
9. Preserve preview-first logic: storyboard and preview before final credit-heavy rendering.
10. Keep both assembly paths but clarify them:
   - simple assembly for lyric/video/visualizer/image flows
   - directed assembly for full storyboard music videos.

Files/modules to consider creating or improving:
/lib/providers/modelRegistry.ts
/lib/providers/providerRouter.ts
/lib/providers/falAdapter.ts
/lib/providers/mockAdapter.ts
/lib/music-video/aiDirector.ts
/lib/music-video/scenePlanner.ts
/lib/music-video/timelineEngine.ts
/lib/music-video/captionTiming.ts
/lib/music-video/scriptToTimeline.ts
/lib/music-video/creditEstimator.ts
/lib/music-video/safetyRightsGuard.ts

New route ideas:
/api/music-video/direct
/api/music-video/storyboard
/api/music-video/timeline
/api/music-video/preview
/api/music-video/generate-scene
/api/music-video/provider-job
/api/music-video/caption-timing
/api/music-video/credit-estimate
/api/music-video/safety-check

Important product rules:
- Music must drive the visuals.
- Preview before heavy rendering.
- User approval before major credit spend.
- No hidden deductions.
- Do not create dead Studio cards.
- Every mode card should open the correct editor flow.
- The system must block unsafe content, unauthorized likeness use, unauthorized voice imitation, and risky children visual concepts.

Please inspect the current implementation first, then make a safe implementation plan before modifying code.
```

---

# 22. Final Product Principle

GHS MusicVision Studio should not be a random AI video button.

It should be:

```text
A music-aware AI director that turns songs into structured visual stories, generates the right scenes with the right provider models, lets the user approve before spending, and renders usable music videos for real platforms.
```

This is the correct direction.

