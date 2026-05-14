# GHS Hybrid — Fix + Image Flip Plan (2026-05-14)
# DO NOT START until Henry says GO

---

## SECTION 1 — FULL UNDONE/BROKEN INVENTORY

### Active Bugs

| # | Bug | Root cause |
|---|---|---|
| B1 | Video plays with black / no images | FAL CDN URLs expire. Image never saved locally when first generated. |
| B2 | Max ON images never in assembled video | `sceneBeatImages` + `useMaxImageScenes` are React state — wiped on page refresh. |
| B3 | Music louder than narration | `final_merge` uses `duckingRules.musicDuckLevel` (0.08 = 8%) — hardcoded. User slider ignored. |
| B4 | Narration silent in video | Narration audio path fails `fs.existsSync` → step silently skipped. No warning shown. |
| B5 | Subtitles never appear | `exportSettings.includeSubtitles` not wired. `narration[].text` empty. libass not on Windows. |
| B6 | 30-second black before first image | Preprocessing sequential — 8 images × download + transcode = 30-60s before any frame exists. |
| B7 | Image never syncs with narration | No system to match which image shows at which narration line. |
| B8 | Modal dialogs below fold | Terms/AI-Chat/legal modals missing scroll-lock (only Preview lightbox fixed). |
| B9 | Continuity breaks (wardrobe, character anatomy) | No state tracked between scene image generations. Each gen isolated. |

---

### Features Not Built

| # | Feature |
|---|---|
| F1 | Image Flip Time — user sets seconds per image. Full spec below. |
| F2 | SFX semantic category system (60 categories, Ollama routing) |
| F3 | Wave C — multi-image character import |
| F4 | Wave D — Continuity supervisor |
| F5 | Wave E — Wardrobe sidecar |
| F6 | Wave F — Pre-gen dialogue review UI |
| F7 | Subtitle style tokens (cinema/neon/bold not mapped to FFmpeg) |
| F8 | Music per scene (one global track currently) |
| F9 | Narrator audio duration persisted to DB |

---

### Architecture Debt

| # | Item |
|---|---|
| A1 | 34 files uncommitted on main branch |
| A2 | Phase D — drop local-state fallbacks (needs Henry GO + browser verify) |
| A3 | Phase E.2 — model health badges (deferred) |
| A4 | Phase G — white-label tenant (deferred until customer) |

---

## SECTION 2 — IMAGE FLIP TIME FEATURE SPEC

### What it does

User sets one number: flip time in seconds. Every image shows for that many seconds before
cutting to the next. Default = 3 seconds. Range: 1–10 seconds. This is the master clock
that drives narration, images, and subtitles together.

---

### Step 1 — Story written and expanded

Scene descriptions split into action beats via `splitIntoActionBeats()`. Each beat = one
candidate image slot. Beat count stored per scene so system knows how many images are relevant.

---

### Step 2 — Images generated and stored (SCOPED STORAGE)

When Gen Image or Gen Max fires, image saved immediately to project-scoped, scene-scoped
local path. FAL CDN URL used once for initial download only. System works with local paths
from that point forward.

**Storage path structure:**
```
/storage/scenes/{projectSlug}/{sceneId}/img_{timestamp}.jpg
/storage/scenes/{projectSlug}/{sceneId}/beat_0_{timestamp}.jpg
/storage/scenes/{projectSlug}/{sceneId}/beat_1_{timestamp}.jpg
/storage/scenes/{projectSlug}/{sceneId}/beat_2_{timestamp}.jpg
```

Where:
- `{projectSlug}` = human-readable project name slugified (e.g. tow_goat, teddy_and_dog)
  — derived from project title, stored in HybridProject
- `{sceneId}` = scene card identifier (e.g. SC01, SC02) — same ID shown on scene card
- `{timestamp}` = epoch ms at save time — multiple versions kept, never overwritten

**Hard rules:**
- Image in SC01/ can NEVER appear in SC02/. SceneId folder is the hard boundary.
- Execute route only looks inside `{projectSlug}/{sceneId}/` when building segments for that scene.
  Never scans parent or sibling folders.
- Old scene.imageUrl pointing to FAL CDN → archived in scene.prevImageUrls[] on next gen,
  new local path replaces it.

**User-visible organization:**
- Each scene card in Scene Board shows "Saved Images" panel: thumbnails of everything in
  that scene's folder, labeled by beat and timestamp.
- Project-level Image Library drawer: all projects → all scenes → all saved images in
  organized grid. User can preview, delete, or promote any image to "active" for that scene.
- Images attached to HybridScene DB record — persists across refresh, not floating in React state.

**Why this matters:**
- No CDN expiry — assembly always finds the file
- No cross-scene bleed — project Y can never pull images from project X
- User can see, manage, delete their own generated images
- Multiple versions kept — user picks which feeds assembly

---

### Step 3 — User sets flip time

`imageFlipSeconds` stored in `ProjectSettings.imageFlipSeconds`.
`HybridScene.flipOverride` (nullable) — per-scene override.

**Assembly tab (prominent, Step 9):**
```
┌──────────────────────────────────────────────────────┐
│  🖼  IMAGE FLIP TIME                                  │
│  Each image shows for: [ 3 ] seconds                 │
│  12 scenes · 3 images avg · ~108 seconds total       │
│  [ 1s fast cut ]  [ 3s default ]  [ 5s cinematic ]  │
└──────────────────────────────────────────────────────┘
```

**Scene Board card (compact per-scene override):**
Small `flip: 3s ↓` dropdown on each scene card. Overrides global for that scene only.
Useful when one scene needs slow holds while others are fast-cut.

---

### Step 4 — Assembly segment construction (SMART IMAGE COUNT)

System calculates how many images are actually needed based on narration duration and flip
time. The last image NEVER holds indefinitely. If narration is longer than images cover,
system generates more images — it does not silently pad.

**Calculation:**
```
narration_duration_for_scene  = from Piper audio file duration, per scene
flip_time                     = imageFlipSeconds (global or scene override)
images_needed                 = ceil(narration_duration / flip_time)
images_available              = count of local images in /storage/scenes/{proj}/{sceneId}/
images_to_generate            = max(0, images_needed - images_available)
```

**Action density scaling — images_needed also informed by scene length category:**

| Scene narration length | Category | Minimum images |
|---|---|---|
| Under 8 seconds | Mini | 1–2 |
| 8–25 seconds | Medium | 3–5 |
| Over 25 seconds | Max | 6+ |

`images_needed = max(category_min, ceil(narration_duration / flip_time))`

**If images_to_generate > 0:**
System does NOT silently hold last image. Instead:
1. Calculates missing beats (e.g. narration=24s, flip=3s, have 3 images → need 8 → generate 5 more)
2. Calls `splitIntoActionBeats(sceneDescription)` for missing beat texts
3. Shows warning card on that scene in Assembly tab:
   "SC03 needs 5 more images for full narration coverage.
   [Generate Now]  [Hold Last Image — reduced quality]"
4. "Generate Now" → auto-fires Gen Max for missing beats, saves to scoped storage
5. "Hold Last Image" → proceeds with what exists (user's explicit choice, not silent fallback)
6. Make Video button grayed out until every selected scene is resolved

**Segment duration:**
- Segments 1 to N-1: duration = imageFlipSeconds
- Segment N (last): duration = narration_duration - ((N-1) × imageFlipSeconds) — absorbs rounding
- Total scene duration = narration_duration exactly — never cuts narration, never dead silence

---

### Step 5 — Narration-image-subtitle sync pass

After segments built, pure-text alignment pass runs:
1. Scene narration text split into exactly N sentences/phrases (one per segment)
2. Each phrase assigned: { segmentId, text, startTime, endTime }
3. Subtitle for segment i = phrase i, timed to [i × flipTime, (i+1) × flipTime]
4. "John jumps off cliff" text + jump image appear at the same timestamp

No API call, no AI cost. Pure string math at assembly time.

---

### Step 6 — Assembly fires

Each segment:
- sourceUrl = local path /storage/scenes/{proj}/{sceneId}/beat_{i}.jpg
- duration = imageFlipSeconds (or adjusted for last segment)
- subtitleText = narration phrase for that window

FFmpeg: image holds → cut → next image. Narration audio plays continuously.
Subtitles burn in per chunk timing using drawtext filter (no libass dependency).

---

## SECTION 3 — EXECUTION PLAN (PHASES)

### Phase 0 — Commit current state
Commit all 34 uncommitted files on main. No logic changes. Clean starting point.

---

### Phase 1 — Foundation bugs

**P1-A: Scoped image local caching**
`app/api/hybrid/scene-image/route.ts` — after FAL returns URL, download + save to
`/storage/scenes/{projectSlug}/{sceneId}/img_{ts}.jpg`. Return local path. Scene stores
local path, never FAL CDN URL. ProjectSlug derived from project title, slugified, stored
in HybridProject.

**P1-B: Parallel segment preprocessing**
`app/api/assembly/execute/route.ts` — `preprocessSegments()` from sequential for loop to
`Promise.all()`. All downloads + transcodes run concurrently. 8 images: 30s → 5s.

**P1-C: Execute route respects scene-scoped paths**
`resolveMediaPath()` updated to understand `/storage/scenes/{projectSlug}/{sceneId}/`
structure. Segment lookup scoped to correct folder. No cross-project bleed possible.

**P1-D: Narration validation gate**
Assembly tab shows narration status per scene: green = file exists + duration known,
red = missing. Make Video grayed out if any selected scene has no narration file.

**P1-E: Music volume fix**
`src/lib/assembly-builder.ts` line 163 — replace `duckingRules.musicDuckLevel` with
`assembly.music[0]?.volume ?? 0.3`.

---

### Phase 2 — Image Flip Time

**P2-A: imageFlipSeconds + perSceneFlipOverride in schema**
`ProjectSettings` model gets `imageFlipSeconds Int @default(3)`.
`HybridScene` model gets `flipOverride Int?` (null = use global).
`useProjectSettings` hook updated. PATCH endpoint updated.

**P2-B: UI controls (two locations)**
Assembly tab Step 9 — prominent flip time panel with quick-pick buttons
(1s / 3s / 5s) + custom input + live segment count preview.
Scene Board card — compact `flip: Xs ↓` per-scene override control.

**P2-C: Auto-expand all multi-image scenes, no opt-in**
Assembly segment loop — remove `useMaxImageScenes` gate entirely. All local images
for a scene auto-included. Duration per segment = imageFlipSeconds (or scene override).

**P2-D: Images-needed pre-flight check**
Before assembly fires, calculate images_needed per scene. Show warning for scenes that
need more. [Generate Now] / [Hold Last Image] choice per scene. Make Video blocked
until every selected scene is resolved.

**P2-E: Narration-image-subtitle sync pass**
New function `buildSyncedSegments(scene, images, narrationText, imageFlipSeconds)`:
1. Split narrationText into N phrase chunks (one per image)
2. Assign each phrase to its segment with startTime + endTime
3. Return segments with subtitleText field populated
Used for subtitle burn-in timing.

**P2-F: Subtitle fix**
Wire `exportSettings.includeSubtitles` to toggle in page.tsx.
Populate `narration[].text` from sync pass output.
Replace `subtitles=` FFmpeg filter with `drawtext` filter (no libass needed).

---

### Phase 3 — Continuity supervisor

**P3-A: Scoped image library UI**
Scene Board — each scene card has "Saved Images" panel showing thumbnails from its
scoped /storage/ folder.
Project-level Image Library drawer shows all projects → scenes → images in organized grid.

**P3-B: Scene-level keyword supervisor (free tier)**
After Gen Image / Gen Max: extract key action words from scene description, compare to
generation prompt used. If mismatch → yellow ⚠ badge on scene card. No API cost.

**P3-C: Wardrobe tracker (Wave E)**
`CharacterVoice` gets `lastSeenWardrobe String?` field. Every scene image gen that
includes a character reads their last wardrobe from DB, injects into prompt as
continuity instruction: "CONTINUITY: [Name] wearing [last wardrobe]."
Updates record after gen.

**P3-D: Plus/Pro AI supervisor (Wave D)**
Plus: Haiku call checks scene description vs image prompt before gen fires.
Pro/Premium: full Claude check + auto-rewrites prompt if mismatch found.
Both tier-attached, always-ON, depth scales by tier.

---

### Phase 4 — Feature waves

**P4-A: Wave C** — multi-image character reference import
`app/api/character-voices/[id]/upload-reference/route.ts` → accept array of image files,
store all in `CharacterVoice.referenceImages[]`, send all as image_urls to FAL for
consistent img2img identity.

**P4-B: Wave F** — pre-gen dialogue review UI
Before TTS fires for character voices, show review modal: parsed lines + speaker
assignments. One-click swap speaker tag. Catches parser mis-tags before burning credits.

**P4-C: SFX semantic category system**
60-category library in /storage/sfx/categories/.
Ollama call in scene-intelligence/route.ts maps scene action → category → file path.
No new API cost.

---

### Phase 5 — Architecture cleanup

**P5-A: Phase D** — drop local-state fallbacks in all 7 planners
(after Henry GO + browser verify all 7 planners)

**P5-B: Phase E.2** — model health badges (green/yellow/red dot per model)

**P5-C: Subtitle style tokens** — cinema/neon/bold mapped to drawtext params

---

## EXECUTION SUMMARY

```
Phase 0  →  Commit 34 files (no logic change)
Phase 1  →  Image caching scoped + parallel preprocess + narration gate + music fix
Phase 2  →  Image Flip Time: schema → UI → auto-expand → pre-flight check → sync pass → subtitles
Phase 3  →  Continuity supervisor: image library UI + keyword check + wardrobe tracker
Phase 4  →  Feature waves: character refs + dialogue review + SFX categories
Phase 5  →  Architecture: Phase D + E.2 + subtitle styles
```

Each phase TSC clean before next phase starts.
Phase 2 is the high-value delivery — after it ships hybrid is a different product.

---

## NOTES
- imageFlipSeconds already available via useProjectSettings once Phase 2-A ships
- All other planners (movie, series, children, commercial) can adopt same flip system
  in future without re-coding — just call useProjectSettings().imageFlipSeconds
- scoped image storage pattern (/projectSlug/sceneId/) applies to ALL planners,
  not just hybrid
