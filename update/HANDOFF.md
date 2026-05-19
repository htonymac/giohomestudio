## READ THIS FIRST → `update/HANDOFF_SPECS.md`
Canonical handoff: current state, locked product decisions, what's open, deploy commands, traps. Supersedes the historical chatter below.

---

# GHS HANDOFF — Session 17 (Image Quality + Character Consistency + Beat Picker Fixes)

**Last updated:** 2026-05-19
**Build:** TSC clean — 0 new errors (pre-existing test error only)
**Git:** UNCOMMITTED — session 17 changes across 3 files
**Port:** 3200 | **DB:** giohomestudio_db (PostgreSQL + Prisma)

---

## WHAT WAS BUILT THIS SESSION (Session 17)

### 1. Beat Image Picker — Delete Buttons
**File:** `app/dashboard/hybrid-planner/page.tsx`

Added to BOTH pickers (Scene Board ~line 7713 + Assembly tab ~line 11583):
- **× button per tile** — red circle overlay top-right of each beat image. Splices that index out of `sceneBeatImages[sceneId]` AND `selectedBeatImages[sceneId]`
- **Del Selected button** — removes all ticked images from both arrays
- **Del All button** — wipes all beat images for that scene instantly
- Tiles now wrapped in `position:relative` div to hold the overlay button

### 2. Old Scene Images Contamination Fix
**File:** `app/dashboard/hybrid-planner/page.tsx` line ~1353

When `expandStory()` gets new scene data from API, it now clears:
```typescript
setSceneBeatImages({});
setSelectedBeatImages({});
```
(alongside existing `setSceneImages({})`, `setSceneVideos({})` etc.)

Previously beat images from Story A leaked into Story B because scene IDs (SC01, SC02…) are reused.

### 3. Nollywood / Nigerian Skin Tone Lock
**File:** `app/dashboard/hybrid-planner/page.tsx` — `generateCharacterPortrait()` function

Detects Nigerian/African context when:
- `effectiveStyle === "nollywood"` OR
- `storyCulture`/`storyCountry` contains "nigeri/yoruba/igbo/hausa/lagos/abuja/african"

Injects:
- `skinAnchor` = `"BLACK WEST AFRICAN, dark rich melanated skin, deep brown complexion, African features,"` — placed in `basePrompt` BEFORE the visual description
- `stylePrefix` for nollywood strengthened to include "BLACK WEST AFRICAN character, dark rich melanated skin"
- `negativePrompt` for nollywood: blocks "white skin, light skin, pale skin, European features, Caucasian"

**Only fires when `char.colorDescription`/`char.skinTone` doesn't explicitly say light/fair/pale** — manual overrides respected.

### 4. Era/Culture Lock in Character Portraits (Hybrid Planner)
**File:** `app/dashboard/hybrid-planner/page.tsx` — `generateCharacterPortrait()` function

Added `eraLine` injection (was already in movie-planner + children-planner but was MISSING from hybrid-planner):
```typescript
const eraLine = (storyEra || storyCulture)
  ? `Era: ${[storyEra, storyCulture].filter(Boolean).join(", ")}. Clothing, hairstyle, and accessories MUST reflect this time period and culture exactly.`
  : "";
```
Placed in basePrompt between skinAnchor and character identity block.

### 5. Remove Image Button — Clears All 3 Angles
**File:** `app/dashboard/hybrid-planner/page.tsx` — line ~8675

"Remove Image" button now clears BOTH:
- `char.imageUrl` (main portrait) — was already done
- `charRefImages[char.characterId]` (all 3 angle shots) — **NEW**

Previously clicking Remove Image left the 3 angle thumbnails visible in the card.

Button now also shows when angles exist even if main imageUrl is gone.

### 6. Narrative Jargon Stripper for Scene Image Prompts
**File:** `app/api/hybrid/scene-image/route.ts`

Added `sanitizeNarrativeJargon()` function applied BEFORE style sanitization:
- Strips: "inciting incident", "narrative arc", "character arc", "character development", "plot twist", "backstory", "scene setup", "exposition", "establishing the conflict", etc.
- These screenplay terms confused image models and caused inaccurate scene renders
- Scene description reaches image model as clean visual language only

### 7. Scene Generation Uses Portrait Cache (charRefImages)
**File:** `app/dashboard/hybrid-planner/page.tsx` — `makeSceneImage()`, `makeSceneImageVariations()`, `makeSceneBeatImages()`

All 3 functions now pass the **front-angle portrait** (`charRefImages[c.characterId][0]`) as the reference image URL instead of the single `c.imageUrl`. Falls back to `c.imageUrl` if no angles exist.

Front angle chosen because it has the clearest face view — best for models that use image conditioning.

### 8. Animal Head / Bear Head Bug — Fixed (Root Cause Found)
**File:** `app/api/hybrid/scene-image/route.ts`

**Root cause:** Character separation block was doing `ANIMAL_PATTERN.test(visualDescription)` — if ANY character's visual description contained "bear" (e.g. "bear-like strength", "bearing confident posture" from AI analysis), that character was labeled `"[Name] is a bear (bear face, bear body...)"` in the prompt → model drew a bear head.

**Fix:** The per-character species loop NOW uses ONLY the explicit `species` field from `characterOverrides`, never the description text:
```typescript
const isAnimal = ANIMAL_SPECIES.has(ovs);  // was: ovs ? ANIMAL_SPECIES.has(ovs) : ANIMAL_PATTERN.test(desc)
```

Also strengthened negatives: `"bear head, bear face, animal head on human body, animal head replacing human head"`.

Separation block text changed from ALL-CAPS instruction-style to plain language.

### 9. Phone/Smartphone Negative
**File:** `app/api/hybrid/scene-image/route.ts`

Added `phoneNegative` — blocks "holding smartphones, holding phones, staring at phones, mobile phone in hand" unless the scene description explicitly mentions "phone/smartphone/mobile/call/WhatsApp".

Prevents the model from defaulting to "modern scene = everyone has a smartphone" for background extras.

### 10. Character Anti-Stereotype Negatives + Description-First Ordering
**File:** `app/api/hybrid/scene-image/route.ts`

**Description-first ordering:** Character identity block now outputs:
```
"[physical description], wearing: [clothing], hair: [hairstyle] (this character is named Mama Iyabo)"
```
instead of:
```
"MAMA IYABO: [description]"
```
Model processes appearance FIRST, name is just a label — prevents name-driven stereotype bias (e.g. "Mama Iyabo" → old market woman).

**Per-character anti-stereotype negatives built from description:**
- If `age === "young_adult"` or `"adult"` → adds `"old [name], elderly [name], aged [name]"` to negative
- If clothing has no headwrap/gele → adds `"headwrap on [name], gele on [name]"` to negative  
- If description has "slim/thin/slender" → adds `"heavy [name], obese [name], overweight [name]"` to negative

### 11. storyCulture Fallback Bug Fix
**File:** `app/dashboard/hybrid-planner/page.tsx`

Was: `storyCulture: storyCulture || effectiveProjectStyle || undefined`
Fixed: `storyCulture: storyCulture || undefined`

The old code was passing the art style ("nollywood") as the culture value when `storyCulture` was empty, corrupting the era-culture-lock system with wrong data.

### 12. Parse Script / Re-Parse Fix
**File:** `app/dashboard/hybrid-planner/page.tsx` — `parseScript()` function

**Problem:** After first parse + story update, clicking "Re-parse" used stale scene data (Path A ran silently with no visible change, and story text edits were ignored).

**Fix:**
1. On **re-parse** (`scriptSegments.length > 0`): always uses Path B (LLM) so updated `fullScript`/`expandedSummary` is respected
2. On **first parse**: Path A (fast, from scenes) when scenes have content; Path B (LLM) otherwise
3. `setShowScriptReview(false)` at start of parse → panel collapses then re-appears → user gets visual feedback

---

## ⚠️ KNOWN LIMITATIONS (not bugs, just model constraints)

### Character Consistency (Mama Iyabo / face drift)
Mama Iyabo looks different across scenes despite having a portrait. Root cause: standard FAL FLUX doesn't do face-locking from reference images. Only `fal_flux_pulid` (PuLID) does — but PuLID requires a **PUBLIC URL** for the face reference image. Our portraits live at `/api/media/...` (local server) which FAL cannot access.

**What we did:** Description-first ordering + anti-stereotype negatives + identity anchor text. These help significantly but don't fully lock appearance.

**Full fix when ready:** Host portrait images on a CDN/public URL (R2, S3, etc.), then re-enable identity lock for portrait characters:
```typescript
// In scene-image/route.ts generateImage() call:
useIdentityLock: (hasPhotoImportChar || referenceImageUrls.length > 0) && !modelId,
```
Currently this line is commented out / set to `hasPhotoImportChar` only to prevent generation failures.

---

## UNCOMMITTED FILES (Session 17)

```
M  app/dashboard/hybrid-planner/page.tsx
M  app/api/hybrid/scene-image/route.ts
```

Session 16 files also uncommitted (see previous handoff entry).

**Commit when ready:**
```bash
git add app/dashboard/hybrid-planner/page.tsx app/api/hybrid/scene-image/route.ts
git add app/dashboard/children-planner/page.tsx app/dashboard/movie-planner/page.tsx
git add app/api/hybrid/scene-plan/route.ts app/api/hybrid/story-expand/route.ts
git add src/lib/era-culture-lock.ts src/types/children.ts
git add app/api/children/ app/components/ChildrenKaraokeSubtitle.tsx
git add update/CHANGELOG.md update/HANDOFF.md
git commit -m "Session 16+17: Era/Culture Lock, Children Pacing C1-C6, beat picker delete, Nollywood skin fix, bear head fix, phone negative, character consistency improvements"
```

---

## ACTIVE STATE

### Era & Culture Lock — COMPLETE (Session 16)
- `src/lib/era-culture-lock.ts` — `buildFullLock()` + `toStaticFrame()`, 17 eras, 14 cultures
- All 3 planners: `storyEra`/`storyCulture` inputs + save/load + API wiring + era badge
- scene-image route: ERA LOCK FIRST in prompt, negative blocker

### Children Pacing Engine — COMPLETE (Session 16)
- `src/types/children.ts`, `app/api/children/build-pacing-plan/`, `generate-narration/`, `assemble/`
- `app/components/ChildrenKaraokeSubtitle.tsx` (4 modes: word_by_word, letter_by_letter, full, none)
- `children-planner.tsx`: buildPacingPlan(), generatePacingNarration(), assemblePacingVideo()

### H-Series — COMPLETE (Session 15)
H1-H5 image-first story structuring in hybrid planner (`/api/hybrid/structure-story`)

---

## NEXT STEPS (what to build next)

| Priority | Item | Notes |
|---|---|---|
| HIGH | Establish public CDN for portrait images | Enables full character face-lock via PuLID. Portraits at `/api/media/...` are localhost-only. |
| HIGH | C6 pacing engine save/load | `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl` not persisted to DB — lost on page refresh |
| MED | Prisma migrations | `npx prisma migrate dev` — pending schema changes |
| MED | Establishing Shot & Scene Opener | Spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`. 8 types, 5 modes. Trigger: "build establishing shot" |
| LOW | SFX semantic category system | 60 categories, royalty-free files, Ollama maps action→category |
| LOW | Subtitle style tokens | Currently always Arial 22px white; ignores `subtitleConfig.mode` |

---

## KEY PROTECTED CODE (DO NOT REMOVE OR SIMPLIFY)

1. **`extractSceneAction()` call** in `app/api/hybrid/scene-image/route.ts` — PROTECTED comment in file. Injects body-language/action directives. Lost once, had to re-add.
2. **`amix=duration=longest:normalize=0`** in `app/api/assembly/execute/route.ts` — NEVER duration=first, NEVER -shortest
3. **`-stream_loop -1`** on video in `app/api/assembly/execute/route.ts` final_merge — required when narrator > scene duration
4. **`effectiveNarrDurMs` recovery** in `assembleScenes()` — recovers narrator duration after hard refresh via browser Audio element

---

## HOW TO DEBUG

### Scene images wrong era/culture/skin
1. Check `storyEra` and `storyCulture` state in hybrid planner (Story tab, Era & Culture Lock section)
2. Check character `colorDescription` field — if it says "light skin" from old AI analysis, that overrides the skin anchor. Clear it in Visual Identity Builder
3. The skin anchor only fires for nollywood/Nigerian context. Other styles: set `colorDescription` manually

### Bear head appearing
Now fixed at root. If it reappears: check `characterOverrides[].species` in the scene-image API request (DevTools Network tab). If any character has `species: "bear"` unintentionally, that's the source.

### Characters look different across scenes
Fundamental model limitation. Partial mitigation via description-first + anti-stereotype negatives. Full fix = CDN portraits + PuLID (see Known Limitations above).

### Beat images from old story still showing
Should be fixed (expandStory now clears `sceneBeatImages`). If it happens: click "Start Over" button to hard-reset all state, or manually click "Del All" on each scene's beat picker.

---

## GHS BRANDING RULE
User sees: **GHS Standard / GHS Plus / GHS Pro / GHS Classic / GHS Premium / GHS Best**
NEVER show: Claude, GPT, Ollama, Grok — internal only

## PORT
GHS = **3200** | Marabiz = 3040 | Octogent ghs = 8788

## DB
`giohomestudio_db` (PostgreSQL) — Prisma ORM — migrations pending
