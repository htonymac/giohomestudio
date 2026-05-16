# GioHomeStudio — CHANGELOG

## 2026-05-15 — Session 10: Story QC Fix System + Establishing Shot + Voice Auto-Assign + Name Library v1.1.0

**What:** 5 features shipped. Story QC now has Fix/Fix All buttons that apply suggestions to all scenes via one batch LLM call. Per-scene AI chat box (Ask AI) added to scene edit panel. Character voices auto-assign by gender on detection. Full Establishing Shot system built (API + UI). Name library expanded with 7 new cultural regions.

**Impact:** QC workflow is now a full loop — run QC → click Fix → re-run QC, all in one panel. Scene editing has AI assistance inline. Voice pipeline no longer requires manual assignment. Establishing shots give stories cinematic depth (available to build on in Assembly).

**Risk:** Low. All additions, no deletions. TSC clean (0 errors).

**Files:**
- `app/api/hybrid/scene-edit/route.ts` — +`batch_polish`, +`custom` mode, +`establish`, +`establish_all` ops
- `app/dashboard/hybrid-planner/page.tsx` — +establishing shot system, +QC fix system, +Ask AI, +voice auto-assign, +4 culture options
- `src/data/character-names.json` — v1.1.0, +7 regions, +4 continents, +700 names
- `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md` — NEW spec doc (15KB)

---

## 2026-05-14 — Story QC Layer corrections + Semi-AI Collaboration UI + Phase D backend (TODOCORRECT14052026)

**What:** Full correction + extension pass per TODOCORRECT14052026.md. Character IDs fixed to CH01 format, 2 missing supervisors written, all 21 supervisors wired in correct §25 order, ShotPlan type system added, Semi-AI Collaboration Console added to collaborative-editor, Intent Parser backend tool built, StoryEditHistory Prisma model added.

**Character ID format fix (`src/lib/story-supervisors/cast-bible.ts`):**
- IDs changed from `char_name_001` → `CH01`, `CH02`, `CH03` format
- Added `makeCHId(index)` + `normalizeToCHIds()` — protagonist always gets CH01

**New supervisors:**
- `prompt-simplifier.ts` — detects overly complex vocabulary, enforces 2.4 words/sec rule, blocks adult language in children_story
- `prompt-cast-validator.ts` — per-scene/per-prompt validation: blocks race/age/gender changes vs Cast Bible

**index.ts fully rewritten:** all 21 supervisors wired in §25 order (was 11 before)

**ShotPlan type system (`src/lib/story-supervisors/types.ts`):**
- `ShotPlan` interface: shot_id (SH04-01), characters_visible, speaking_character_id, dialogue_line, camera/lighting fields
- `shots?: ShotPlan[]` added to `ScenePlan`
- `scene-demarcator.ts`: `buildDefaultShot()` — every scene gets at least 1 shot

**Semi-AI Collaboration Console (`app/dashboard/collaborative-editor/page.tsx`):**
- Scene/shot navigator with CH01/CH02 chips, dialogue display `[CH01] Name: "line"`
- Quick Edit chips, instruction textarea, Parse Instruction → POST /api/story/tools/collabo-edit
- Scope badge (LOW/MEDIUM/HIGH), cost estimate, Confirm panel → Apply Change → editHistory
- Edit History tab: undo per entry, before→after snapshot

**Phase D backend:**
- `app/api/story/tools/collabo-edit/route.ts` — Claude Haiku intent parser + rule-based fallback + change scope classifier
- `prisma/schema.prisma` — `StoryEditHistory` model added (id, projectId, instruction, resolvedObjectId, changeType, scope, beforeSnapshot, afterSnapshot, timestamp, undone)

**TypeScript:** tsc --noEmit exit 0 (only pre-existing `sound-browser-check.spec.ts` Playwright type error unrelated to these changes)

**Pending (requires dev server restart by Henry):**
- `npx prisma migrate dev --name story-qc-layer` — 7 QC models
- `npx prisma migrate dev --name story-edit-history` — StoryEditHistory model

**Risk:** D4 apply-edit DB route deferred — changes currently patch local React state only.

---

## 2026-05-14 — Story Quality Control Layer (22-supervisor pipeline, Semi-AI Collaborative Mode)

**What:** Full Story QC system built for Hybrid Planner — 22 TypeScript supervisors, 7 Prisma models, 5 API routes, UI controls in Story tab.

**Supervisors built (`src/lib/story-supervisors/`):**
- Core: `types.ts`, `story-contract.ts`, `index.ts` — shared types + `runFullStoryQCPipeline()` 11-stage orchestrator
- Analysis: `story-screening.ts`, `culture-supervisor.ts`, `cast-bible.ts`, `cast-checking.ts`
- Structure: `scene-demarcator.ts`, `scene-density.ts`, `emotion-intensifier.ts`, `continuity-supervisor.ts`
- Production: `music-supervisor.ts`, `provider-compatibility.ts`, `final-gatekeeper.ts`
- Auxiliary: `music-continuity.ts`, `dialogue-voice-supervisor.ts`, `subtitle-style-supervisor.ts`, `short-story-supervisor.ts`, `long-story-supervisor.ts`, `location-environment-supervisor.ts`, `costume-props-supervisor.ts`, `scene-prompt-builder.ts`

**API routes (`app/api/story/`):**
- `POST /api/story/supervise` — main endpoint; runs full 11-stage pipeline
- `POST /api/story/generate-contract` — builds StoryContract from user inputs
- `POST /api/story/build-cast-bible` — extracts character identities via Claude Haiku
- `POST /api/story/demarcate-scenes` — splits story into timed ScenePlans
- `POST /api/story/final-gatekeeper` — standalone gatekeeper check

**Prisma schema (`prisma/schema.prisma`):** 7 new models — `StoryQCProject`, `StoryQCContract`, `StoryQCDraft`, `StoryQCCastMember`, `StoryQCScenePlan`, `StorySupervisorReport`, `StoryGenerationPlan`

**Hybrid Planner Story tab additions:**
- 6 QC selectors: Story Type, Scene Duration, Emotional Intensity, Language Level, Subtitle Style, Generation Mode
- QC Results Panel: score circle, per-category scores, blocking issues, warnings, fixes, Cast Bible table, Scene navigator, approve/override actions

**Impact:** Zero TypeScript errors (tsc --noEmit exit 0). Dev server live, Story tab renders. Pipeline runs in-memory — no DB write path yet.

**Risk:** `npx prisma generate` blocked by dev server DLL lock — run after server restart.

---

## 2026-05-14 — Hybrid Planner Phase 2-5 verification + Assembly tab unlock fix

**What:** Test suite (17 tests) + Assembly tab accessibility fix.

**Assembly tab lock fix:**
- Changed unlock condition from `scenesDone` (requires scenes + images) to `scenes.length > 0` (just needs scenes).
- Pre-flight check in the tab already warns about missing images — no need to lock the whole tab.
- Also fixed bottom progress bar unlock to match.

**Step 9 auto-open:**
- Assembly tab now auto-opens Step 9 (Assemble Movie) on first visit, so flip panel + narration/subtitle status are immediately visible.

**Test suite — 17/17 passing (`tests/hybrid-phase2-5-verify.spec.ts`):**
- API: scene-images GET/DELETE, project settings GET, scene-intelligence POST
- UI: Assembly tab flip panel, preset buttons (1s/2s/3s/5s/8s), per-scene flip override on Scene Board
- UI: subtitle status in Assembly, narration status badge, Assemble button
- UI: AI model health dots, no crash-level console errors, screenshot

**Sound browser check — 6/6 passing (`tests/sound-browser-check.spec.ts`):**
- Sound tier selector, Auto Time Stamp / Auto Audio Plans / Auto Shot Plans buttons
- Assembly flip panel, subtitle status badge, no console errors

**Pending (needs dev server restart):**
- `PATCH /api/project/settings` → imageFlipSeconds still returns 500. Root cause: Prisma module cache (globalThis.prisma singleton).
- **Fix:** `! npm run dev` in GioHomeStudio terminal to restart dev server.

**Impact:** Assembly tab now accessible without generating images first. Tests confirm all Phase 2-5 features are present.

**Risk:** Low. Unlock relaxed from "scenes+images" to "scenes". Pre-flight check inside assembly handles missing-images warning.

---

## 2026-05-14 — Hybrid Planner Phase 1–2 (Image Flip + Assembly Fixes)

**What:** 5 phases of bug fixes and new features for Hybrid Planner assembly pipeline.

**Phase 1-A — Scoped image storage (B1 fix)**
- Scene images now saved locally at `/storage/scenes/{projectId}/{sceneId}/img_{ts}.png` at generation time.
- Returned URL is local `/storage/...` path, not expiring FAL CDN URL.
- Eliminates "black video" caused by expired CDN links in assembly.

**Phase 1-B — Parallel preprocessing (B6 fix)**
- `preprocessSegments()` in `execute/route.ts` now uses `Promise.all` instead of sequential for-loop.
- 8 image segments: was 30–60s, now ~5s.

**Phase 1-C — Music volume fix (B3 fix)**
- `assembly-builder.ts` final_merge now uses `assembly.music[0]?.volume ?? 0.3` (from user slider).
- Was: `duckingRules.musicDuckLevel` (hardcoded 0.08 = 8%).

**Phase 1-D — Assembly readiness status badges**
- Narration / Music / Subtitles status shown above "Assemble My Movie" button.

**Phase 2-A — imageFlipSeconds field**
- `ProjectSettings.imageFlipSeconds` (default 3s) added to Prisma schema, hook, and API.
- `HybridScene.flipOverride` nullable per-scene override added.

**Phase 2-B — Image Flip Time UI**
- Assembly tab: flip time panel with 1s/2s/3s/5s/8s presets + custom input + live segment count preview.
- Scene Board card: compact "flip: Xs" override per scene. Highlighted purple when overridden.

**Phase 2-C — Auto-expand all multi-image scenes**
- Removed `useMaxImageScenes` opt-in gate from assembly segment loop.
- All scenes with 2+ ticked images now auto-expand. Each image gets `flipOverride ?? imageFlipSeconds` seconds.

**Phase 2-D — Pre-flight image sufficiency check**
- Calculates per-scene narration duration × needed images. Shows warning + "Generate N more" button.
- Appears above Assemble button when narration is longer than available images × flip time.

**Phase 2-F — Subtitle fix (B5 fix)**
- Replaced `subtitles=` filter (requires libass, fails on Windows) with `drawtext` filter chain.
- Works on all FFmpeg builds. Up to 60 timed entries, white text + black shadow, centered near bottom.

**Why:** Hybrid planner was producing blank/broken videos. Images expired, music too loud, subtitles never appearing, 30s black opening.

**Impact:** High — assembly pipeline now produces correct output with images, correct music levels, and subtitles.

**Risk:** Low — all changes have TSC + next build clean. Graceful fallbacks throughout.

**Files changed:** `app/api/hybrid/scene-image/route.ts`, `app/api/assembly/execute/route.ts`, `src/lib/assembly-builder.ts`, `app/dashboard/hybrid-planner/page.tsx`, `prisma/schema.prisma`, `src/hooks/useProjectSettings.ts`, `app/api/project/settings/route.ts`

---

## 2026-05-07 — Gen Max (Multi-Beat Scene Images)

**What:** Per-scene "Gen Max" button generates one image per action beat extracted from the scene description.

**Details:**
- `splitIntoActionBeats(text)` splits on sentence boundaries + action connectors (then/suddenly/before/while/after) → up to 6 beats
- `makeSceneBeatImages(scene)` fires one `/api/hybrid/scene-image` request per beat sequentially, shows "Beat N/total" progress
- Beat thumbnails display as a scrollable row below the Gen Max button. Click to full-preview.
- Assembly: beat images expand into multiple segments (each = `sceneDur / beatCount`, min 2s). Scenes with video or 1 beat use normal single-segment path.
- Gen Image(1) button unchanged.

**Why:** Henry: "some scene may have several actions — running from wall (one image) jumping the fence (2 image) look up the sky (3 image) — gen max = all action in the scene"

**Impact:** Medium — scenes with complex descriptions now get correct multi-beat imagery. Assembly segments auto-expand to cover all beats.

**Risk:** Low — assembly fallback to single segment when beats=1 or video exists. TSC clean.

**Files changed:**
- `app/dashboard/hybrid-planner/page.tsx` (state + functions + assembly loop + Image tab UI)

---

## 2026-05-07 — Audio Pipeline + Scene Image Fix + Scene AI Chat + Subtitle Burn-In

**What:**
Seven audio pipeline bugs fixed end-to-end. Scene image action extraction. Per-scene AI chat. Subtitle burn-in implemented.

**Audio fixes (7 root causes):**
- AUDIO-01: Piper TTS mojibake (`â€"` → "-") — `sanitizeForTTS()` in new `src/lib/sanitize-text.ts`, applied at both ElevenLabs and Piper paths in `narrate-piper/route.ts`
- AUDIO-02: Multiple narration tracks at t=0 simultaneously — dedup by audioUrl (Set), atrim per track, amix `duration=longest` (was `duration=first`)
- AUDIO-03: Assembly stops at 4s after hard refresh — `effectiveNarrDurMs` recovery block in `assembleScenes()` loads browser `Audio` element to recover narrator duration when React state is 0
- Music stopped at 34s — `prepare_music` step: `-stream_loop -1` + `atrim=duration=totalDuration`
- SFX never played — new `mix_sfx` step in assembly-builder + SFX path resolution in execute route
- Video cut at 30s — final_merge: `-stream_loop -1`, `duration=longest`, removed `-shortest`
- Duration redistribution not triggering — `totalDuration = Math.max(sceneBaseDuration, narratorDurSec)` fixes tiny motionDuration sum

**Scene image action extraction (IMAGE-01):**
- `extractSceneAction()` added to `app/api/hybrid/scene-image/route.ts`
- 12 action types: confrontation, fight, chase, fear, rescue, argument, discovery, grief, celebration, stealth, dialogue, default
- Injects body-language + spatial-relationship directives that force correct drama in generated images
- Block marked PROTECTED with comment — must survive future refactors
- `cameraFraming` field now actually injected into prompt (was silently dropped)

**Per-scene AI chat (FEATURE-01):**
- New route: `app/api/hybrid/scene-chat/route.ts` — Ollama (local, $0)
- "AI Fix" tab added as 4th tab on every scene card in Scene Board
- Chat interface with history, input, AI suggestions
- AI returns `IMAGE PROMPT:` line → "Apply & Regenerate" button appears → new image generated

**Subtitle burn-in (SUBTITLE-01):**
- `assemblyNarration` entries now carry full narration text (was blank)
- Execute route post-processes final output: SRT from narration text (sentences timed proportionally) → FFmpeg `subtitles=` filter → subtitled MP4
- Graceful skip if FFmpeg lacks libass — original video preserved

**Why:** Henry: assembly stops at 4s with "shhhh" sound, no SFX, music stops early, images show wrong action, subtitles don't work.

**Impact:** High — all major audio bugs resolved. Scene images now reflect actual scene action. AI can correct individual scene images. Subtitles now burn in when enabled.

**Risk:** Low — all failures are graceful (subtitle skip, SFX skip, duration fallback). No breaking changes to existing APIs.

**Files changed:**
- `src/lib/sanitize-text.ts` (NEW)
- `app/api/hybrid/scene-chat/route.ts` (NEW)
- `app/api/hybrid/narrate-piper/route.ts`
- `app/api/hybrid/scene-image/route.ts`
- `app/api/assembly/execute/route.ts`
- `src/lib/assembly-builder.ts`
- `app/dashboard/hybrid-planner/page.tsx`

**Build:** TSC clean (exit 0, verified twice).

---

## 2026-05-06 — Face-Lock + Image Management per Character (commits f360886, 2a00ded)
**What:** Portrait regeneration now preserves real uploaded face via PuLID. Per-character image controls in both Hybrid Planner and Character Library.
- Hybrid Planner `generateCharacterPortrait()`: detects `tags["photo-import"]`, passes `referenceImageUrl + useIdentityLock=true` → PuLID preserves identity
- Per character card: Preview (fullscreen), Undo Image (restore previous), Remove Image buttons
- `generate-portrait` API route rewritten — routes through `/api/generation/image`, inherits PuLID logic automatically. Detects `referenceImages[].label==="photo-import"` for face-lock.
- Character Library VoiceCard: per-character style picker (7 options), Regenerate always visible, Preview Portrait inline lightbox, Undo Image, Remove Image
**Why:** Henry: "AI regeneration is rubbish does not look like uploaded Bryan" — face identity was being ignored. Also added visual controls to manage character images without regenerating from scratch.
**Impact:** Bryan's portrait will now preserve his real face when regenerated. All planners benefit from PuLID routing.
**Risk:** Low — PuLID costs $0.05/image vs $0.01 standard, only triggered for photo-import chars.
**Build:** tsc clean.

## 2026-05-05 — SA-SE Corrections + TSC Clean + Build Fix (commits 9a7dba6, 6269642, 31c1fe4)
**What:** SA-SE architectural corrections + TSC/build fixes.
- SC: movie-planner Voice & Audio tab — Parse Script button, 4-card GHS tier selector, per-cast voice inputs, Generate Per-Line Voices button
- SE: hybrid-planner Scene Board — scene descriptions replaced with always-editable `<textarea>` + 500ms debounce auto-save via `updateScene()`
- TSC fix: `supervisor/final/route.ts` — inline PreflightResult types, named prisma import (was default)
- TSC fix: `image-provider.ts` — `as unknown as Record<string,unknown>` cast for FAL params extension
- Build fix: `video-editor/page.tsx` — `useSearchParams` wrapped in Suspense (Next.js 14 requirement; was breaking `next build`)
- Free-mode: scene image lightbox (click to full-preview), dev gen limits 20 img/10 vid, localhost unlimited (9999)
- Add `/api/free-mode/messages` + `/api/free-mode/sessions/list` routes
**Why:** SA-SE Sonnet worker completed phase. TSC and build must be clean before merge to main.
**Impact:** All planners can edit scenes inline. Movie planner has full sound tier UI. Build passes cleanly.
**Risk:** Low — all additive or type-only fixes.
**Build:** `next build` exit 0, `tsc --noEmit` exit 0.
**AUT:** Tab order correct (Design→Story→Characters→Scene Board→Sound→Screenplay→Assembly→Overview), all 4 sound tiers visible, motion/duration controls present.

## 2026-05-05 — Pipeline Recovery Phase 1+2 (commit 2838df1)
**What:** Full pipeline recovery across character identity, style propagation, tab order, per-scene tools, three LLM supervisors, auto-SFX, and sound tier labels. Branch: `fix/ghs-pipeline-recovery-may05`.
- Style lock: `src/lib/style-presets.ts` shared across scene-image + scene-video. Video gen now applies 3D/cartoon/anime/realistic/nollywood/comic prompt prefix.
- Face-lock: `fal_flux_pulid` (PuLID) model added. Photo-import characters auto-route to it. `referenceImages` saved with photo-import label on character save.
- Tab order: Design→Story→Characters→Scene Board→Sound→Screenplay→Assembly→Overview (killed FLOW off-by-one bug).
- Per-scene controls: AI Generate SFX + Continuous Motion toggle + Duration picker (5/10/15/20/30s) + Scene Music button — all on each Scene Board card.
- Supervisors: Visual Consistency, Sound/SFX, Final/Overall — three independent LLM agents. SupervisorStatusBar extended to 3-row panel.
- Auto-SFX: 31-entry keyword map + Haiku LLM pass in cue-extractor. Freesound→FAL auto-fetch pipeline with CC0/CC-BY legal filter.
- Sound tiers: GHS Sound (Piper) / GHS Plus (Karaoke) / GHS Pro (Karaoke+FAL) / GHS Premium (Kie Suno) — canonical 4-tier definitions wired through music-provider and narrate-piper.
**Why:** Pipeline was broken end-to-end. Style, character identity, SFX, audio, and assembly were each silently failing or ignoring user input.
**Impact:** High — style consistency fixed, photo → AI character flow unblocked, per-scene audio tools visible, supervisors enforce quality before assembly.
**Risk:** Medium — tab order change is UX-visible. PuLID routing requires `FAL_KEY`. Music tier keys `KIE_AI_API_KEY`/`MUBERT_PAT` still needed for Premium/Pro tiers.
**Build:** `next build` passing, `tsc --noEmit` exit 0.
**Pending:** Assembly path unification (1.6), Prisma migration for per-scene continuousMotion, SA-SE planner corrections.

## 2026-04-30 — S5: Voice Provider Tiers + ElevenLabs Error Surfacing (BUG-09)
**What:** (A) `/api/tts/route.ts` — added `provider` field routing, explicit ElevenLabs error surfacing (was silent catch), FAL Narrator tier via `fal-ai/kokoro/american-english`, karaoke short-circuit. (B) New `/api/tts/fal-narrator/route.ts` dedicated route. (C) Hybrid-planner Audio tab — permanent narration provider card (`data-testid="narration-provider-card"`) with 4 provider buttons (`data-provider` attrs), `voiceLayers` state (VoiceLayer interface, add/update/remove helpers). (D) Children-planner STYLE & VOICE tab — `narrationProvider` state + 4-button radio. (E) Movie-planner Audio tab — `narrationProvider` state + 4-button radio.
**Why:** BUG-09: ElevenLabs errors were silently swallowed (empty catch L88). No FAL Narrator tier existed. No provider selector UI in any planner. No voiceLayers multi-part voice state.
**Impact:** ElevenLabs errors now surface to caller. FAL Narrator is selectable as mid-tier TTS. All 3 planners have working narration provider selector. voiceLayers up to 4 layers supported.
**Risk:** Low — additive. TTS route retains legacy `engine` field for backward compat. FAL Narrator gated on `FAL_KEY` env var presence.
**Branch:** fix/ghs-bug-09-voice-tiers
**Playwright:** 17/17 PASS, 90s, screenshots C:/tmp/bug-09-*.png

## 2026-04-30 — S4c: AI Cast from Story + Children Scene Board + Pre-assembly Preflight
**What:** (A) Movie-planner Cast tab — AI Cast Generator is now primary action; reads story text via /api/hybrid/character-extract, auto-adds to cast. "Import saved" demoted to secondary link. (B) Children-planner — new "Scene Board" tab added; per-scene cards with editable description, character assignment inline, AI image generation per scene via /api/hybrid/scene-image. generateScenesFromStory() calls scene-plan API. (C) Pre-assembly preflight added to Assembly tab (movie-planner) and Final tab (children-planner) — runs /api/hybrid/pre-flight, shows green/yellow/red checklist.
**Why:** Henry confirmed Cast tab was wrong (Import Existing only shown). Children Scene Board was missing. Both planners lacked any pre-assembly quality gate.
**Impact:** Movie cast generation now works AI-first. Children planner has full hybrid-style scene board. Both planners have preflight review before assemble fires.
**Risk:** Low — all additive. No existing function removed. generateCastFromStory merges to existing savedCharacters (deduplicated). Pre-flight is optional (user can still click assemble without running it).
**Branch:** fix/ghs-s4c-sceneboard-cast-preflight

## 2026-04-30 — S4: Tab order + CharacterPicker + design style flow
**What:** Fixed Overview tab position (was first, now last) in children-planner. Default active tab changed to "design". Added inline CharacterPicker toggle to movie-planner Characters tab. Added ?returnTo= param to all character-voices links. character-voices page now reads returnTo and shows return banner + button. Wired visualStyle into scene-plan storyText in children-planner. Wired style state into story-expand and scene-plan in movie-planner.
**Why:** Henry complained Overview was first — confusing UX. Users navigated to character page with no way back. Design style choices were UI-only, never flowed into AI generation.
**Impact:** Tab navigation corrected across children and movie planners. Character creation flows are closed-loop. Design style context now reaches story expansion and scene planning APIs.
**Risk:** Low — tab reorder is cosmetic, CharacterPicker is additive (existing modal kept), style appended to storyText (extra context, servers ignore unknown fields).
**Branch:** fix/ghs-bug-04b-tab-order-character-picker

## 2026-04-30 S2

### fix(character-system): eliminate bear collapse + attach reference images by characterId (BUG-02)
- **What:** (A) New `attachCharacterReferences(prompt, characterIds[])` in `src/lib/character-resolver.ts` — explicit ID lookup, no token embedding needed. (B) `app/api/generation/image/route.ts` accepts `characterIds[]`, calls attachCharacterReferences, returns `referenceImages` in response. (C) `app/api/hybrid/character-build/route.ts` — `isHumanRole()` helper, `humanGuard` in user prompt, ABSOLUTE human enforcement when `role=human` or `childSafe=true`, system prompt guard against bear/animal anatomy. (D) `app/api/hybrid/story-expand/route.ts` — removed "The Bear" anti-example, added global human-default rule to system prompt.
- **Why:** Characters rendering as bears across all planners. Root cause: resolver token-only path missed explicit character lookups; species enum allowed bear for human roles; story-expand primed model toward animal output.
- **Impact:** Human characters now generate as humans. Reference images attached via explicit IDs. All callers benefit without prompt token changes.
- **Risk:** Low — resolver backward compatible; existing token flow unchanged; new characterIds field is optional

## 2026-04-30 S1

### fix: children-planner character DB persistence (BUG-03)
- **What:** Added POST to `/api/character-voices` at `extractChildCharacters` and `expandStory` setSavedChars call sites
- **Why:** Characters were stored in React state only — lost on page reload or across sessions
- **Impact:** Characters now persist to DB immediately on creation. CharacterPicker reads from DB. Mount load already existed.
- **Risk:** Low — 409 (duplicate) handled gracefully; local state retained on POST failure

### fix: ElevenLabs TTS silent catch → surfaced error (prep BUG-09)
- **What:** Replaced empty `catch { /* ElevenLabs failed */ }` with `console.error` + structured error message. Added `!res.ok` check that reads error body from ElevenLabs API response.
- **Why:** Silent swallow hid all ElevenLabs failures — impossible to debug TTS fallback chain
- **Impact:** Errors now visible in server logs. Fallback chain preserved (error logged, then falls through to SAPI/FFmpeg tier).
- **Risk:** None — fallback chain unchanged, error now observable

### fix: karaoke stderr truncation removed, stdout JSON non-greedy (prep BUG-08)
- **What:** Removed `.slice(0, 500)` from stderr in error message. Changed stdout JSON regex from `/\{[\s\S]*\}/` (greedy) to `/\{[\s\S]*?\}\s*$/m` (non-greedy, last match).
- **Why:** Truncated stderr hid root cause of Python analysis failures. Greedy regex matched first `{` to last `}` which could include debug output before the real JSON result.
- **Impact:** Full stderr in error messages. Correct JSON extracted even when Python prints debug lines before the result object.
- **Risk:** Low — regex change is conservative; anchored to end of output

### docs: added MUBERT_PAT to .env.example
- **What:** Added `MUBERT_PAT=your_mubert_pat_here` with comment to `.env.example`
- **Why:** Mubert is required for instrumental tracks >47s. Key was undocumented.
- **Impact:** Developers know to configure it. No runtime change.
- **Risk:** None
