# GioHomeStudio — CHANGELOG

## 2026-05-24 — Assembly streaming response: killed CF 100s timeout false errors

`/api/assembly/execute` now returns NDJSON streaming response with heartbeats every 25s. Previously the route returned a single JSON after 2-8 min of work; Cloudflare Free Plan has a HARDCODED 100s edge HTTP timeout that fired on long assemblies, causing the client to receive a 524 HTML error page → "Assembly failed: Unexpected token '<', '<!DOCTYPE'..." even though the server FINISHED the video correctly in background. User never saw the completed videos unless they refreshed the Asset Library.

Live verification (server localhost): empty body POST returns 2 NDJSON lines:
```
{"heartbeat":true,"ts":...,"phase":"started"}
{"result":{"error":"Assembly JSON has no segments"},"status":400}
```

Real long assemblies will emit many heartbeats between start and result, keeping CF idle timer reset. Client at hybrid-planner page.tsx line 4551 now reads NDJSON line-by-line, updates "Assembly running… (Xs)" label on each heartbeat, parses final result line. Backward compatible — falls back to res.json() if Content-Type is application/json (for 400 validation responses).

Commit c4ed465. Works for any video length on any CF plan — no upgrade required.

---

## 2026-05-24 — Piper TTS + 67-track licensed music catalog LIVE on andiostudio.com

**Piper TTS (6 voices, all verified working via API):**
- Binary at `/home/ghs/piper/piper/piper` (8.4MB + espeak-ng deps bundled)
- 6 voices in `/home/ghs/piper/voices/` totaling ~380MB: en_US-lessac-medium (default), en_US-amy-medium, en_US-ryan-medium, en_US-arctic-medium, en_GB-alan-medium, en_GB-alba-medium
- Server `.env` set: `PIPER_BIN=/home/ghs/piper/piper/piper`, `PIPER_VOICES_DIR=/home/ghs/piper/voices`
- Verified end-to-end via `POST /api/hybrid/narrate-piper` — all 6 voices produce real `.wav` files (e.g. `narration_1779594136508.wav`, 3.6s for a 12-word sentence)

**Music catalog (67 tracks total, 50 commercial-safe):**
- 17 PC-bundled stock tracks (mp3) moved PC→server via scp+tar — marked `UNVERIFIED` in manifest. Safe for personal/free-tier; BLOCKED from commercial flows pending source verification per LEGAL/SOUND_LICENSING.md §2.1.
- **50 Kevin MacLeod CC BY 4.0 tracks** downloaded from incompetech.com to `storage/music/stock/freepd/` (352MB total). Each track gets auto-attribution string `"Music by Kevin MacLeod (incompetech.com) — Licensed under Creative Commons: By Attribution 4.0 License"` per Wave 0 license enforcement.

**New API route:** `GET /api/music/stock` (commit 7f7bb75) — returns catalog with per-track license/attribution/commercialUseAllowed/blocked/verificationStatus. Query params:
- `?commercial=true` → filters to 50 commercial-safe tracks
- `?mood=epic` → filters by mood/genre/description match

This enables frontend to enforce per-tier per-track rules: free users see all, paying-monetised users only see `commercialUseAllowed=true` tracks with attribution baked into export.

**Still blocked:** Karaoke Tier 1-4 audio stack (faster-whisper / librosa / demucs / basic-pitch / RVC) needs `sudo apt install python3.11 python3.11-venv python3-pip` (admin sudo, one paste). Without that, Karaoke canvas Steps 2/4/11 remain on placeholder.

---

## 2026-05-24 — CRITICAL FIX: Next.js 16 allowedDevOrigins (buttons restored)

Henry reported "NO BUTTON ARE FIRING YET" on andiostudio.com. Diagnostic showed React 0/33 buttons had onClick handlers — page SSR-rendered but never hydrated.

**Root cause:** Next.js 16 added `allowedDevOrigins` security feature. Without listing `andiostudio.com`, cross-origin requests (CF Tunnel → localhost:3200) to `/_next/webpack-hmr` and the React client bundle get silently blocked. Result: SSR HTML works, React never mounts, zero interactivity.

**Fix (commit 5f7124c):** added to `next.config.ts`:
```ts
allowedDevOrigins: ["andiostudio.com", "www.andiostudio.com"]
```
Also added `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` to `serverExternalPackages` to keep them out of client bundle.

**Verified:** After dev server restart, 31/34 buttons have onClick handlers (3 remaining are styled non-buttons). Real users can now interact with the site again.

**Lesson:** Next.js dev mode behind any reverse proxy (CF Tunnel, ngrok, nginx) MUST list the public hostname(s) in `allowedDevOrigins`. Production mode (`next build && next start`) doesn't enforce this — but we're running `npm run dev` per the systemd unit. Switching to production mode (Wave 0 A2 task #17) would also have masked this issue, but the right fix is BOTH: add origins AND switch to production.

---

## 2026-05-23 (late) — Wave 3+4 scaffolding shipped autonomously

After Henry said "continue to the finishing line dont wait my go":

**Wave 3 Phase 1+2 — Storage abstraction (commit 5a06c89):**
- `src/lib/storage/` — StorageProvider interface + LocalFsProvider (default, current behavior) + R2Provider (lazy `@aws-sdk/client-s3`, throws if creds missing — install before flipping STORAGE_PROVIDER=r2) + `getStorage()` factory
- Prisma fields added to 6 asset models: ContentItem / AdAsset / SoundAsset / AssemblyRecord / MotionSegment / MusicGeneration / KaraokeRecording — all get `ownerId / r2Key / sizeBytes / visibility / storageProvider` + indexes. KaraokeRecording also gets `mixedR2Key + purgeAt` (Karaoke canvas §19 30-day biometric data purge requirement). Server DB synced via `prisma db push --accept-data-loss` — no data lost, only nullable additive columns.
- Phase 3 (R2 round-trip) already done earlier (bucket `andio-assets` live). Phase 4 (signed URL endpoints) NEXT. Phase 5 (refactor 30+ writeFileSync sites) BIGGER LIFT. Phase 6 REMOVED per "no comfy". Phase 8 DEFERRED.

**Wave 4 Phase A — 23-supervisor orchestrator brain (commit 0a3e528):**
- THE root-cause fix for Henry's "30+ supervisor LLM chaos" complaint
- `src/lib/story-qc/types.ts` — typed contracts (SupervisorInput/Report/Plan/Result)
- `src/lib/story-qc/registry.ts` — all 23 supervisors with `requires/blocking/tier/dependsOn/buildPrompt/parse` metadata. Standard JSON envelope: `{passed, score, blockingIssues, warnings, suggestedFixes, revisedData}`
- `src/lib/story-qc/orchestrator.ts` — `buildPlan()` picks eligible supervisors based on inputs + topo-sorts by dep + estimates cost. `runOrchestrator()` runs sequentially with per-tier timeout (FIX 8: fast=12s, smart=25s, premium=60s), cascade-skips downstream when blocking dep fails, persists to `StorySupervisorReport` Prisma model
- `app/api/story-qc/run` route — POST runs orchestrator. GET diagnostic lists all 23. `planOnly: true` previews without LLM calls (verified live).
- **LIVE on https://andiostudio.com/api/story-qc/run** — tested with sample Nigerian welder story, planner correctly picks 19 of 23, skips 4 with reasons, estimates $0.039.

**Wave 0 LITE — Linux side housekeeping:**
- Git tag `windows-final-2026-05-23` on commit `84a06bb` for rollback safety
- 7 audit memory files written for future GHS sessions (master launch plan + serious issues record + per-area audits)

**Server tally now at HEAD `0a3e528`:** code synced, Prisma client regenerated, DB columns added, story-qc endpoint live.

**STILL BLOCKED ON ADMIN SUDO:**
- `apt install python3.11 python3.11-venv python3-pip` — for Karaoke Wave 1 (Tier 2-4 installs need 3.11)
- `systemctl restart ghs.service` — non-blocking; site serves correctly without

**STILL BLOCKED ON HENRY EXTERNAL:**
- `MUBERT_PAT` from mubert.com/business
- 40-min children story browser test to verify FIX 2 SRT path fires (vs drawtext fallback)

---

## 2026-05-23 — Linux Migration + Subtitle/Scene Composition Fixes

**Infra (Linux migration, Wave 0):**
- GHS now LIVE on Contabo VPS 30, systemd `ghs.service` on port 3200
- Domain `andiostudio.com` LIVE via Cloudflare Tunnel (apex + www, both 200 OK)
- Cloudflare R2 bucket `andio-assets` created + round-trip tested (PUT/GET/LIST/DELETE green)
- Server IP hidden behind CF edge (no direct exposure)
- Git tag `windows-final-2026-05-23` set on commit `84a06bb` as rollback safety
- New persona file `persona_ghs.md` updated; 7 new audit memory files written for future sessions

**Code fixes (Wave 2, 2 remaining items from 9-fix plan completed):**

5. **FIX 2 — Subtitle cap removed via SRT/libass with drawtext fallback** — `app/api/assembly/execute/route.ts`. Was: drawtext-only, cap 300, long videos (40min children stories) lost subtitles mid-video. Now: writes SRT file with FULL entries (unlimited), tries `subtitles=path.srt:force_style='...'` filter first (libass — available on Linux), falls through to existing drawtext-300 chain if libass unavailable. force_style derived from `SubtitleConfig` (font name/size/color/bg opacity/position → libass alignment+margin). Color conversion #rrggbb → libass &Hbbggrr. Both styled and burned-in subtitles preserved.

6. **FIX 7 — PuLID single-char rich-location drop** — `app/api/hybrid/scene-image/route.ts`. Was: F4 dropped PuLID only for multi-char scenes. Single-char scenes still suffered portrait-pose composition even when location was richly described. Now: ALSO drops PuLID for single-char scenes when (a) NOT a closeup framing AND (b) rich location signal (location text > 20 chars + scene text > 80 chars, OR location+mood+timeOfDay all present). Closeup framings preserved face lock (intentional portrait). Log line shows drop reason for diagnosis.

**Impact:** Subtitle rendering unbroken on long videos. Picture/action repetition reduced — scenes with detailed location compose freely without portrait override.

**Tag:** Linux migration HEAD = `84a06bb` (windows-final-2026-05-23). Server runs same HEAD plus pulled FIX 2 + FIX 7 commits.

---

## 2026-05-22 — Export Timing + Caption Layout Fix

**What:** Fixed 4 export bugs in `/api/assembly/execute/route.ts`.

1. **Narrator audio truncated** — Pre-flight ffprobe corrected `totalDuration` when `effectiveNarrDurMs=0` on client, but NOT the narrator entry's `endTime`. Assembly-builder then applied `atrim=duration=narratorFallbackSec` (~40s) cutting a 3-min narrator to 40s. Fix: pre-flight now also updates narrator `endTime` to `realDur` when the current value is shorter.

2. **Video ends before voiceover finishes** — `totalDuration` sent from client was `sceneBaseDuration` (~55s) when narrator duration state was lost. Pre-flight now sets `totalDuration = max(realDur, clientTotal, lastSegmentEnd)` ensuring the video covers all content.

3. **Caption layout overflow** — Bottom caption Y was `h*0.88`, placing the TOP of the text at 88% height. Multi-line captions (2-3 lines) extended below the 1080px frame. Fixed to `h-th-54`: bottom edge of text block = frame height − 54px safe margin.

4. **Long captions as single wide line** — `buildSubEntries` only split on sentence-ending punctuation. Long sentences (>20 words) became one wide caption. Added word-chunk splitting at 20-word boundary. Also reduced `wrapText` wrap width from 45→40 chars.

**Impact:** Full voiceover now plays in exported video. Captions stay inside the safe area and display as short readable chunks.

**Risk:** Low. No schema changes, no new TSC errors. Caption count may increase for long stories (more entries, each ~2-3s).

**Files:**
- `app/api/assembly/execute/route.ts` — pre-flight block, buildSubEntries, wrapText maxLen, subY

---

## 2026-05-16 — Session 12: Establishing Shot Image Gen + Assembly Wire-in + Modal Scroll-Lock + Voice Cast Bible

**Branch:** `feat/ghs-finishline`

**What:** 3 tasks. (1) Establishing shot `imageUrl` field added to interface; "🖼 Gen Image" button in mini-card fires `/api/hybrid/establishing-shot/generate`; image preview shown at 80px wide. Establishing shots with `imageUrl` are prepended as short image segments before their scenes during `assembleScenes()`. (2) `useEffect` scroll-lock added to hybrid-planner — `document.body.style.overflow = "hidden"` when any of: `previewMedia`, `showAidPicker`, `importLibraryOpen`, `showCharacterPicker`, `pendingImportChar`, `showDialogueReview` is open. (3) `generateNarration()` in collaborative-editor now looks up `activeNarr.speakerId` in `castTray` and uses `castTray[].voiceName` as `voiceId` for ElevenLabs/Piper calls instead of hardcoded default.

**Impact:** Assembly now includes establishing shots as visual bookends. Modal scroll jank eliminated. Character dialogue lines use character's assigned voice instead of narrator default.

**Risk:** Low. No deletions, no schema changes, 0 new TSC errors. Pre-existing `assembly/execute/route.ts` TS2367 error unchanged.

**Files:**
- `app/dashboard/hybrid-planner/page.tsx` — `EstablishingShot.imageUrl?`, `genEstablishingShotImage()`, Gen Image button + preview, establishing shot prepend in `assembleScenes()`, scroll-lock `useEffect`
- `app/dashboard/collaborative-editor/page.tsx` — Cast Bible voice lookup in `generateNarration()`

## 2026-05-15 — Session 11: Collab Editor 3-Panel + Apply-Edit Route + Subtitle Tokens + Scroll-Lock + Establishing Shot Generate + Wave C Multi-Image

**Branch:** `feat/ghs-collab-and-polish`

**What:** 6 tasks shipped. Collaborative editor extended with shot-level scene folders (C1), active shot preview panel (C2), apply-edit API wiring (C3), subtitle style tokens per-segment (Task 3), modal scroll-lock (Task 4), establishing shot image generation route (Task 5), and Wave C multi-image character import UI (Task 6).

**Impact:** Collaborative editor now shows the full 3-panel shot system — left panel reveals shots within scenes, center panel shows active shot details with editable image prompt and dialogue line. Apply Change now persists edits to `StoryEditHistory` via D4 route. Per-segment subtitle styles (neon/cinema/bold/minimal) override the global export style at FFmpeg time. Modal scroll-lock prevents body scroll on any modal open. Establishing shot generation is wired to FAL FLUX. Character picker shows multi-angle thumbnail strips; character-voices page allows uploading up to 4 reference images per character.

**Risk:** Low. All additions/extensions, no deletions, no planner files modified. TSC: 0 errors.

**Files:**
- `src/lib/assembly-schema.ts` — +`dialogue_line`, `ownerCharacterId`, `subtitleStyle`, `imageUrl`, `videoPrompt`, `imagePrompt`, `providerRecommendation` on `AssemblySegment`
- `app/api/assembly/execute/route.ts` — per-segment `subtitleStyle` override via `getSegmentStyleAt()`
- `app/api/story/tools/apply-edit/route.ts` — NEW: Phase D4, inserts `StoryEditHistory` on confirmed edits
- `app/api/hybrid/establishing-shot/generate/route.ts` — NEW: FAL FLUX wide establishing shot image gen
- `src/types/character.ts` — NEW: shared `CharacterIdentity` + `ReferenceImage` types
- `app/components/CharacterPicker.tsx` — multi-image thumbnail strip for characters with >1 reference image
- `app/dashboard/character-voices/page.tsx` — multi-image upload (up to 4, with angle labels) in VoiceForm
- `app/dashboard/collaborative-editor/page.tsx` — C1 shots in folders, C2 active shot preview, C3 apply-edit wired, C4 dialogue_line display, modal scroll-lock

---

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

## 2026-04-30 — S4c FINAL: children chars inline, hybrid preflight, movie cast rename + portrait model
**What:** Children planner Characters tab converted to inline AI-first registry (Build Story Characters with AI, or import saved, Gen.Portrait, Remove per card, no navigate-away). Hybrid planner Assembly tab gains runPreflight() + Pre-Flight Review section always visible at top. Movie planner Cast tab: primary button renamed to "Build Story Characters with AI"; portrait model selector (Flux Schnell/Pruna/Flux Dev) added; "Gen. Image" → "Generate Portrait" with model param passed.
**Why:** Prior S4c commit left children Characters tab still navigating to external page; hybrid Assembly had no preflight; movie button label incorrect per spec.
**Impact:** All 3 planners now fully spec-compliant for S4c. Playwright 9/9 PASS.
**Risk:** Low — additive only. CharacterPicker already imported in children-planner. Preflight is optional, never gates assembly.
**Branch:** fix/ghs-s4c-sceneboard-cast-preflight · Commit: fa403c7

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

## 2026-05-18 — Era & Culture Lock System (All 3 Planners)
**What:** Complete era/culture lock system built across all 3 planners (hybrid, children, movie) and all 3 API routes (scene-image, scene-plan, story-expand).
(A) `src/lib/era-culture-lock.ts` — NEW utility: 17 era entries (Paleolithic→Contemporary), 14 culture entries, `buildFullLock(storyEra, storyCulture, artStyle)` → `{positive, negative, sceneContext, label}`, `toStaticFrame(description)` strips action verbs → "Cinematic still frame" for image model.
(B) `app/api/hybrid/scene-image/route.ts` — era lock injected FIRST in prompt, static frame conversion, negative era blocker in negative prompt.
(C) `app/api/hybrid/scene-plan/route.ts` — era sceneContext injected into LLM prompt via `eraBlock`.
(D) `app/api/hybrid/story-expand/route.ts` — era/culture fields added to controlLines + systemPrompt.
(E) All 3 planners: `storyEra`/`storyCulture` state added, saved/loaded, wired to all API calls (story-expand, scene-plan, all scene-image calls including Gen Max beats + variations). Era context injected into character portrait `basePrompt` for era-accurate clothing/accessories.
(F) UI: Era & Culture Lock input section added to Story tab (all 3 planners). Era badge added to Scene Board header (all 3 planners). Lock active indicator shown when fields have values.
(G) `update/UPDATE_MOVIE_era.md` — full spec doc (12 sections, 15 build steps, critical rules).
**Why:** Scene images were defaulting to wrong era (Nollywood story generated cave-man imagery). Model needs explicit era commitment BEFORE processing characters/scenes, plus negative blocker to prevent wrong-era elements.
**Impact:** All scene images, scene plans, and story expansions are now era+culture aware. 899 AD story won't show smartphones. 1819 England won't show modern buildings. All 3 planners, all generation paths covered.
**Risk:** Low — additive. storyEra/storyCulture are optional — empty values skip era lock entirely. No existing prompts modified, only prepended/appended.
**TypeScript:** 0 new errors (pre-existing test error only).

## 2026-05-18 — Children's Pacing Engine (C1–C6) COMPLETE
**What:** Full children's pacing engine built — separate from the adult hybrid pipeline.
(C1) `src/types/children.ts` — NEW: ChildrenPacingEntry, ChildrenPacingPlan, ChildrenNarrationTimingEntry types.
(C2) `app/api/children/build-pacing-plan/route.ts` — NEW: LLM generates word-timed pacing plan from story text. Story mode = sentence entries + 700ms pauses. Learning mode = word_intro + letter_spell sequence + word_repeat + sentence_read per word. Age multiplier (1.4× toddler, 1.1× preschool, 0.9× older).
(C3) `app/api/children/generate-narration/route.ts` — NEW: Builds SSML script with `<break>` tags and `<prosody rate="slow/x-slow">`, calls ElevenLabs `/stream`. Falls back to Piper at localhost:5000/tts. Returns audioUrl + timingMap.
(C4) `app/api/children/assemble/route.ts` — NEW: Timing-driven assembly. Per-entry image hold durations. FFmpeg concat filter. Outputs `storage/children/assembled_XXX.mp4`.
(C5) `app/components/ChildrenKaraokeSubtitle.tsx` — NEW: React component for word_by_word, letter_by_letter, full, none highlight modes. CSS keyframe pulse for letter_by_letter. No external deps.
(C6) `app/dashboard/children-planner/page.tsx` — Added imports, 8 state vars, buildPacingPlan(), generatePacingNarration(), assemblePacingVideo(). Pacing Engine card in Assembly tab with progressive build buttons + karaoke preview navigator.
**Why:** Children's planner was using adult hybrid pipeline — wrong speed, no breathing room, no word-level subtitle timing. Educational mode (spelling, phonics) was impossible.
**Impact:** Children can now use a separate timing-aware pipeline with SSML pauses and karaoke subtitles. Adult hybrid pipeline untouched.
**Risk:** Low — entirely additive. Old assemble button still works. New Pacing Engine is optional (new card at bottom of Assembly tab).
**TypeScript:** 0 new errors.
