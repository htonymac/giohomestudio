# GHS HANDOFF — Session 18 (Ethnicity Pipeline End-to-End + Subtitle + Face Lock)

**Last updated:** 2026-05-20
**Build:** TSC clean — 0 new errors (pre-existing test error in tests/sound-browser-check.spec.ts only)
**Git:** All committed and pushed to `main`. HEAD = `863b493`.
**Port:** 3200 | **DB:** giohomestudio_db (PostgreSQL + Prisma)

---

## ⚠ CRITICAL — IF FACES STILL WRONG AFTER RESTART

Run this exact sequence (browser was likely caching old client bundle):

```powershell
# 1. Stop dev server (Ctrl+C)
# 2. Delete Next.js build cache
Remove-Item -Recurse -Force .next
# 3. Restart
npm run dev
# 4. Wait for "✓ Ready in ..." in terminal
# 5. In browser, Ctrl+Shift+R (HARD refresh)
# 6. Start a BRAND NEW project (don't reuse old ones — their broken
#    visualDescription is baked into hybrid_saved_states DB rows)
```

Existing broken projects (Twins Guns Hybrid Project with Marcus Cole, Dante Cole,
LIEUTENANT RIVERA showing as white) **cannot be fixed by code** — their character
data is already persisted with `colorDescription: "fair skin"` etc. Either:
- Delete the broken characters one-by-one in Character tab, then re-extract
- OR start a fresh project

Verify the fix works by:
1. Open browser DevTools (F12) → Network tab
2. Click "Expand with AI" in a new project
3. Find `character-extract` response → click → Response tab
4. Look at `characters[0].skinTone` / `colorDescription` / `visualDescription`
5. All three should contain "dark brown..." or whatever ethnicity the story implies

---

## WHAT WAS BUILT THIS SESSION (Session 18) — 13 commits, all on `main`

Each fix removed a specific bug or added a missing data path. None broke
existing functionality. Order matters — earlier fixes are required for later
ones to be reachable.

### 1. `a39b3a3` — Session 17 features (recap)
Beat picker delete buttons, Nollywood skin lock, narrative jargon stripper,
charRefImages portrait used by scene gen, bear-head fix v1, phone negative,
description-first character ordering, anti-stereotype negatives, storyCulture
fallback bug, re-parse script fix.

### 2. `2f6647e` — Face-lock: auto-upload portraits to FAL CDN
**File:** `src/lib/generation/gateways/fal.ts`, `src/lib/generation/selectors/image-provider.ts`
- Added `face_image_url` field to `FalImageRequest`
- `falGenerateImage` now forwards `face_image_url` to FAL API
- `resolvePublicPortraitUrl()` reads local `/api/media/...` portraits from
  disk → uploads to FAL Storage → caches public URL (module-level Map)
- Previously: PuLID never had a public URL to face-lock against. Now it does.

### 3. `2312034` — Bear-head root cause fixed
**File:** `app/api/hybrid/scene-image/route.ts`
Removed `sceneHasAnimal` (regex `/\b(bear|wolf|...)\b/` on scene text). Any
sentence with "bear" as a verb ("cannot bear", "bearing gifts", "unbearable")
matched and **disabled all bear protection** for that scene.
Now: `explicitAnimal = charSpeciesIsAnimal` only (explicit species field).

### 4. `83a965d` — PuLID modelId bypass removed
**File:** `app/api/hybrid/scene-image/route.ts`, `src/lib/generation/selectors/image-provider.ts`
Both files had `&& !modelId` guards on `useIdentityLock`. The hybrid planner
always passes `effectiveImageModelId` (default FLUX), so the guard made PuLID
NEVER activate. Fix:
- `scene-image/route.ts`: `useIdentityLock = hasPhotoImportChar || referenceImageUrls.length > 0`
- `image-provider.ts`: override to PuLID **unless** user picked a non-FLUX model
  (Ideogram with transparent BG etc. — that choice wins)

### 5. `26de934` — Subtitle line-break preservation + surfaced status
**File:** `app/api/assembly/execute/route.ts`, `app/dashboard/hybrid-planner/page.tsx`
- `escDrawtext()` protects `\n` from wrapText BEFORE escaping backslashes
- Added `subtitleStatus` to assembly response: `{ requested, attempted, succeeded, reason, entries, fontUsed }`
- Client surfaces failure reason via `setUiError()` red banner

### 6. `3c6b658` — Age field flows from Character tab to scene gen
**File:** `app/dashboard/hybrid-planner/page.tsx`, `app/api/hybrid/scene-image/route.ts`
**WHY:** Same character appeared as 30yo in scene 1, 60yo in scene 2 — because
`makeSceneImage`, `makeSceneImageVariations`, `makeSceneBeatImages` built
`characterOverrides` WITHOUT including `age`. Server's `c.age` defaulted to
null → no `AGE LOCK` block in prompt → model used name-driven stereotypes.
- All 3 client overrides now send `age: c.ageRange || null`
- Server `ov` type accepts `age?: string | null`
- Server override loop: `if (ov.age) match.age = ov.age`
- Session-only characters get `age: ov.age || null` (was hardcoded null)
- Added diagnostic log:
  `[scene-image] sceneId=X chars=N ages=[...] portraits=N faceLock=true firstPortrait=https://fal.media/...`

### 7. `829ea62` — Extraction prompt requires skinTone + ethnicity inference
**File:** `app/api/hybrid/character-extract/route.ts`
- LLM prompt requires skinTone, age, ethnicity for every character
- Inference table: "Latina" → olive-brown Hispanic, "Black/African" → dark
  brown melanated, "Asian" → fair Asian, etc.
- Server `inferSkinToneFromText()` fallback if LLM returns blank
- Story full-text scan as last-resort dominant ethnic context
- Injects computed skinTone into visualDescription before DB save

### 8. `b65cce5` — Face-lock UI diagnostic
**File:** `app/api/hybrid/scene-image/route.ts`, `app/dashboard/hybrid-planner/page.tsx`
Scene image API response now includes:
```typescript
faceLock: {
  requested: boolean,
  used: boolean,
  modelUsed: string,
  portraitCount: number,
  reason: string,
}
```
Client surfaces in red banner if PuLID requested but didn't activate, green
in lastAction if it did.

### 9. `1774db4` — Auto-AI-Read anti-override
**File:** `app/dashboard/hybrid-planner/page.tsx`
**WHY:** `analyzeCharacterImage()` runs **automatically** after every portrait
generation (line 5275). If the portrait was wrong (white when story said
"dark brown"), AI Read described the wrong portrait and wrote "fair skin"
into colorDescription — overwriting the original story-based ethnicity.

Fix merges with conflict detection:
- Prefers existing colorDescription → story's skinTone → AI's read
- Explicit ethnicity conflict detection: if story says dark and AI says
  light (or vice versa), story wins
- ageAppearance protection: if `c.ageRange` set, AI's "appears 10-12 years
  old" can't override

### 10. `daae5db` — Intro/outro preview shows `<img>` not `<video>`
**File:** `app/dashboard/hybrid-planner/page.tsx`
generate-card API returns PNG `imageUrl`, but preview panels rendered it in
a `<video controls>` tag → "No video with supported format" error.
Now branches on URL extension. Final video pipeline was unaffected (always
handled `img:` prefix correctly in FFmpeg).

### 11. `221c608` — Subtitle Windows fontfile colon escape
**File:** `app/api/assembly/execute/route.ts`
FFmpeg drawtext on Windows requires `\:` escape for the colon in
`fontfile='C:/Windows/Fonts/arial.ttf'` even inside single quotes. The
parser was treating the `:` as a filter param separator. Fix:
```typescript
fontFilePath.replace(/\\/g, "/").replace(/:/g, "\\:")
```
Also bumped surfaced error message from 300 → 1200 chars.

### 12. `64df85d` — Extraction response includes ethnicity (THE one)
**File:** `app/api/hybrid/character-extract/route.ts`, `app/dashboard/hybrid-planner/page.tsx`
**ROOT CAUSE OF ALL THE WHITE-CHARACTER PAIN THIS SESSION:**
Server saved ethnicity to DB but returned only minimal fields to client
(characterId, name, role, gender, age, voiceId, dbId). Client had empty
`skinTone` in React state → portrait gen had no ethnicity in prompt → white
portrait → auto-AI-Read of white portrait → "fair skin" overrode story →
every scene showed white characters.

Fix:
- character-extract response now includes `visualDescription`, `skinTone`,
  `colorDescription`, `ageRange` for every character (new + existing matches)
- TypeScript type for createdCharacters extended
- Client mapping (hybrid-planner.tsx line 1220) populates colorDescription
  from `c.colorDescription || c.skinTone` (was hardcoded empty)
- `distinctiveFeatures` gets visualDescription (was incorrectly stuffed into
  clothingDetails)

### 13. `863b493` — Walk full expandedStory for ethnicity inference
**File:** `app/api/hybrid/character-extract/route.ts`
**WHY:** When story-expand returns a `characterList` with empty `skinTone`,
the LLM call is SKIPPED. The fallback inference only scanned narrow fields
(`fullScript || expandedSummary || idea`), but story-expand uses field
names like `summary`, `narrativeArc`. So the fallback never ran on actual
story text. Fix: walk the entire expandedStory object recursively, collect
every string, run ethnicity regex on the combined text.

Verified working live via direct API test:
```
ALEX skinTone="dark brown skin, African features, melanated"
     colorDesc="dark brown skin, African features, melanated"
BEN  same ✓
```

---

## ENTIRE ETHNICITY DATA PIPELINE (after this session)

```
story text typed by user
        ↓
story-expand → characterList (may be missing skinTone)
        ↓
character-extract
  - If characterList present: mapCharacterIdentity (LLM skipped)
  - Else: LLM extraction with strict skinTone+ethnicity required
        ↓
Fallback inference chain:
  1. LLM-extracted skinTone
  2. inferSkinToneFromText(visualDescription + personality + ethnicity + country)
  3. inferSkinToneFromText(walk entire expandedStory)
        ↓
visualDescription enrichment:
  enrichedVisualDescription = skinTone + ", " + visualDescription
  (only if description doesn't already mention skin/ethnicity terms)
        ↓
Server saves to DB:
  characterVoice.visualDescription = enrichedVisualDescription
        ↓
Server returns to client:
  { characterId, name, role, gender, age, voiceId, dbId,
    visualDescription, skinTone, ageRange, colorDescription }   ← NEW
        ↓
Client maps into characters[] state:
  c.colorDescription = response.colorDescription || response.skinTone
  c.distinctiveFeatures = response.visualDescription
  c.species = "human"
        ↓
Portrait generation:
  generateCharacterPortrait(char) → buildVisualDescription(char) → prompt
  Prompt includes c.colorDescription with "dark brown skin..."
        ↓
Portrait result (may still come out wrong due to model bias)
        ↓
analyzeCharacterImage auto-runs:
  Merge logic preserves c.colorDescription if filled
  Detects ethnicity conflict (story says dark + AI says light)
  Story wins
        ↓
Scene image generation:
  makeSceneImage sends characterOverrides with age, species, etc.
  scene-image/route.ts applies overrides over DB record
  Portrait URL → resolvePublicPortraitUrl() → uploaded to FAL CDN
  useIdentityLock=true → image-provider routes to fal_flux_pulid
  face_image_url forwarded to FAL → PuLID face-locks scene to portrait
```

---

## KNOWN LIMITATIONS / UNFIXED

### A. Existing broken projects can't be auto-fixed
Code can only protect NEW extractions. If a project was created before today's
fixes, its `hybrid_saved_states.data.characters[]` has baked-in wrong
`colorDescription` like "fair skin". Three options:
- Manually edit each broken character (Define Appearance button)
- Delete those characters in Character tab, re-extract (uses new prompt)
- Start a brand new project

### B. Outro mid-video bug (unresolved — needs more info)
User reported outro appearing in middle of assembled video. Code at line
4097 puts intro→scenes→outro in correct order. Likely cause:
- Either an outro image got added as a regular scene (creating 2 outros), OR
- Saved `assemblyOrder` array has outro sceneId mid-array, OR
- Drag-and-drop reorder left it mid-list

**NOT TOUCHED THIS SESSION** — needs user to confirm which scenario.

### C. character-build endpoint not strengthened
`/api/hybrid/character-build` has its own LLM prompt with:
> "be specific and DIFFERENT from existing characters"
This may cause LLM to artificially diversify ethnicity (Alex=Black, Ben=light)
when story says both are Black. Not yet fixed.

### D. Diagnostic tests left in tests/ folder
- `tests/diagnose-ethnicity-bug.spec.ts` — Playwright UI test (flaky on Expand AI timing)
- `tests/verify-ethnicity-e2e.spec.ts` — same, end-to-end
- `tests/test-extraction-api.mjs` — direct API test (works, useful)
- `tests/verify-walk-fix.mjs` — verifies walk fallback (works)
- `tests/fix-broken-characters.mjs` — find/delete broken character-voices
- `tests/fix-project-characters.mjs` — find/patch broken project characters
- `tests/find-marcus-cole.mjs` — search projects for specific char names

These can be deleted or kept as diagnostic harness.

---

## ACTIVE STATE (Era/Culture Lock + Children Pacing — from Session 16)

### Era & Culture Lock — COMPLETE
- `src/lib/era-culture-lock.ts` — `buildFullLock()` + `toStaticFrame()`, 17 eras, 14 cultures
- All 3 planners: `storyEra`/`storyCulture` inputs + era badge
- scene-image: ERA LOCK FIRST in prompt, negative blocker

### Children Pacing Engine — C1-C6 COMPLETE
- `src/types/children.ts`, `app/api/children/build-pacing-plan/`, `generate-narration/`, `assemble/`
- `app/components/ChildrenKaraokeSubtitle.tsx` (4 modes)
- `children-planner.tsx`: buildPacingPlan(), generatePacingNarration(), assemblePacingVideo()

### H-Series — COMPLETE (Session 15)
H1-H5 image-first story structuring in hybrid planner

---

## NEXT STEPS (priority order)

| Priority | Item | Notes |
|---|---|---|
| HIGH | Verify Session 18 fixes work after `.next` deletion + hard refresh | The verify-walk-fix test confirms server-side, but user-side stale bundle may mask the fix |
| HIGH | Outro mid-video bug | Need user confirmation: did outro appear twice or just mid-array? |
| HIGH | C6 pacing engine save/load | `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl` not persisted to DB — lost on page refresh |
| MED  | Strengthen `character-build` prompt | Same ethnicity inference + remove "DIFFERENT from existing" pressure when story implies same race |
| MED  | "Re-extract from story" button | One-click fix for broken existing characters without losing other project state |
| MED  | Prisma migrations | `npx prisma migrate dev` — pending schema changes |
| MED  | Establishing Shot & Scene Opener | Spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`. 8 types, 5 modes |
| LOW  | SFX semantic category system | 60 categories, royalty-free, Ollama maps action→category |
| LOW  | Subtitle style tokens | Currently always Arial; ignores `subtitleConfig.mode` |

---

## KEY PROTECTED CODE (DO NOT REMOVE)

1. **`extractSceneAction()`** in `app/api/hybrid/scene-image/route.ts` line 192 — PROTECTED comment. Injects body-language/action directives.
2. **`sanitizeNarrativeJargon()`** in `app/api/hybrid/scene-image/route.ts` line 179 — strips screenplay terms before image prompt.
3. **`amix=duration=longest:normalize=0`** in `app/api/assembly/execute/route.ts` — NEVER duration=first, NEVER -shortest.
4. **`-stream_loop -1`** on video in final_merge — required when narrator > scene duration.
5. **`effectiveNarrDurMs` recovery** in `assembleScenes()` — recovers narrator duration after hard refresh via browser Audio element.
6. **PuLID auto-upload** in `image-provider.ts` `resolvePublicPortraitUrl()` — FAL needs public URLs.
7. **AI-Read anti-override** in `analyzeCharacterImage()` merge — preserves story ethnicity over portrait read.

---

## HOW TO DEBUG

### Faces still wrong color/age after restart
1. Delete `.next` folder, restart, hard refresh (Ctrl+Shift+R)
2. Open DevTools → Network tab → trigger Expand AI
3. Inspect `character-extract` response → `characters[0].skinTone` / `colorDescription`
4. If those fields are populated correctly → React state hydration bug (try a brand new project)
5. If those fields are empty → server hasn't picked up new code (the `.next` step didn't work)

### Subtitle didn't burn in
Look at the red banner at top of page after assembly. The reason is printed
(format: `"Subtitles requested but not burned in: <exact reason>"`).
- "drawtext failed: ..." → escape issue, check the chain sample
- "narration entries have no .text field" → client didn't send text
- "subtitled file produced but empty or missing" → FFmpeg silent failure

### PuLID face-lock not firing
Each scene image generation now writes a console log:
```
[scene-image] sceneId=SC01 chars=1 ages=[adult] portraits=1 faceLock=true firstPortrait=https://fal.media/...
```
If `faceLock=false` → no portrait was provided
If `firstPortrait=/api/media/...` (not `fal.media`) → upload to FAL CDN failed

### Bear head reappeared
Check `characterOverrides[].species` in the scene-image API request (DevTools
Network tab). If any character has `species: "bear"` unintentionally, that's
the source. Sanitize the character's species field.

---

## TEST UTILITIES (tests/ folder)

```bash
# Verify extraction returns ethnicity correctly
node tests/test-extraction-api.mjs

# Verify walk-fallback infers ethnicity from story even when characterList is empty
node tests/verify-walk-fix.mjs

# List/patch broken characters in character-voices DB
node tests/fix-broken-characters.mjs        # dry run
node tests/fix-broken-characters.mjs --fix  # apply

# Find/patch broken characters in saved-state project JSON
node tests/fix-project-characters.mjs       # dry run
node tests/fix-project-characters.mjs --apply  # apply

# E2E Playwright (flaky on Expand AI button timing)
npx playwright test tests/verify-ethnicity-e2e.spec.ts --project=chromium
```

---

## GHS BRANDING RULE
User sees: **GHS Standard / GHS Plus / GHS Pro / GHS Classic / GHS Premium / GHS Best**
NEVER show: Claude, GPT, Ollama, Grok — internal only

## PORT
GHS = **3200** | Marabiz = 3040 | Octogent ghs = 8788

## DB
`giohomestudio_db` (PostgreSQL) — Prisma ORM — migrations pending

## REPO
`https://github.com/htonymac/giohomestudio.git` — branch `main`, HEAD `863b493`
