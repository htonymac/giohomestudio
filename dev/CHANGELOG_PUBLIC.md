# GioHomeStudio — Changelog (Public)

Reverse-chronological commit-grouped record. Internal agent/persona names removed. All technical detail preserved.

---

## 2026-06-03 — 10-fix audit-driven ship (4 commits)

**Trigger:** Full read-only audit of children-planner, `/api/video/assemble`, and the narration/TTS pipeline. Root cause: one interconnected cascade — NOT 8 separate bugs. 39 silent placeholder files on the server confirmed 25% narration failure rate.

### Commits

- **`8ec0831`** — `assemble/route.ts`: Default subtitle font changed from `Arial Black` (not on Linux) to `DejaVu Sans`. Drawtext fallback preset set to `ultrafast` (was: `medium` = 5× slower). ASS-fail log promoted `warn → error`.

- **`57e21db`** — `children-planner/page.tsx`: `perSegmentDuration` now derived from ffprobe-measured audio duration (`_totalNarFromProbe`), not a text-length estimate. All 4 TTS call sites now reject `engine==="placeholder"` responses. `generatePacingNarration()` also sets `narratorAudioUrl` (fixes pacing desync).

- **`c209d55`** — `narrate-piper/route.ts`: Spawn timeout scales to text length `clamp(60s, 10min, text.length * 500ms)`. `generate-narration/route.ts`: Piper fallback now calls `/api/tts` instead of the Windows-only `localhost:5000` daemon.

- **`12c042c`** — `assemble_job_worker.mjs`: Reads `STORAGE_PATH` env (was hardcoded). New endpoints: `GET /api/storage/list`, `DELETE /api/storage/delete`, new page `/dashboard/storage-cleanup` (browse + bulk-delete orphaned audio/scene/temp files).

**Impact summary:**

| Step | Before | After |
|---|---|---|
| ASS subtitle render | Silently fails on missing font → slow drawtext | Succeeds with DejaVu Sans |
| Drawtext fallback | preset=medium = 5–10 min | preset=ultrafast = 30–60s |
| Video/audio length sync | Mismatch → stuck at 99% | Aligned from probed audio |
| Silent placeholder | Shipped to assembly as narration | Rejected with visible error |
| Pacing narration on Linux | Silent 502 (localhost:5000 dead) | Real audio via Piper |

---

## 2026-06-03 — BIB regression #4 + subtitle perf + custom font size picker (5 commits)

- **`8807b18`** — `/api/tts/route.ts`: BIB regression #4. Piper had a hardcoded 30s synthesis timeout. Long stories (3000+ chars) took 60–120s — killed at 30s, fell through silent catch to placeholder branch. Fix: timeout scales `clamp(60_000, 600_000, text.length * 500)` ms. All silent catches replaced with `console.error/warn`. Piper stderr captured in reject message.

- **`bbf4135`** — `assemble/route.ts`: ASS timeout 120s → 600s + explicit `-preset ultrafast` on the ASS encode pass. 98-segment / 400-second videos were timing out on the ASS pass and falling back to the slow chained drawtext path.

- **`c83357d`** — Custom subtitle font size picker. 4 preset pills (Small 36 / Medium 54 / Large 72 / XL 96) + numeric input 18–120. User pick now beats mode preset: `subCfg?.fontSize ?? preset?.size ?? 54`. Default raised 36 → 54.

- **`b528bca`** — `PROBLEM_AND_FIX.md`: BIB #4 root cause + fix + prevention rule recorded.

- **`09cb5e0`** — 24h sprint CHANGELOG entry.

---

## 2026-06-02/03 — 24-hour sprint (29 commits) — children-planner + assembly

### Assembly speed (5 commits)
- `1ba16cc` — Bumper concat stream-copy + ultrafast fallback (~15–30s saved per assembly)
- `2eb32b8` — ASS subtitle path (libass) — 10× faster than chained drawtexts
- `6f383ff` — Scene concat stream-copy + ultrafast fallback (~600s saved on 63-segment videos)
- `9101e87` — Cap scene concurrency at 4 (was: spawn N ffmpegs → empty-reply crash at N>10)
- `495a789` — Probe ACTUAL narrator audio duration with HTMLAudioElement (was: text-length estimate, 50% short)

### Subtitle quality (5 commits)
- `486ec47` — Pacing-aware sync: client ships `pacingEntries[]`, server builds ASS Dialogue from exact ms timings
- `a501dc2` — Kill 2-subtitle overlap (Phase A) + rainbow → drawtext engine routing (Phase C) + project management
- `4cfb224` — Per-scene PNG suppressed when caption/pacingEntries exists; chunked captions slowed 1.6s → 2.4s per chunk
- `300e7d9` — Audio-probed pacing scale (ffprobe → exact stretch ratio) + visible Delete/Export buttons
- `b6195b8` — Chunked caption slowed further: 2.4s → 4.0s per 5-word chunk (1.25 words/sec, comfortable read speed)

### Children planner features (8 commits)
- `b2464db` — Option A: skip auto-expand + TTS when narration already ready + yellow speed tip
- `486ec47` — De-vocabularize button for ages 5–8 (LLM rewrites story for target reading age)
- `45fcfe0` / `6eae854` — De-vocabularize moved inline with modify-buttons row using `prompt()`
- `71d769f` — Image flip rate picker: 0.5s / 1s / 2s / 3s / 5s per beat image
- `d8dbb3c` — Drop Max-toggle gate — multi-beat path fires whenever ticked beats > 1
- `256fe24` — TDZ fix: compute scene narration share BEFORE segmentation loop (was: `ReferenceError` at Assemble click)

### UI / project management (4 commits)
- `a501dc2` — Project Delete + Export (JSON download) per card; new projects persist immediately as OPEN with timestamp titles; DELETE endpoint on `/api/hybrid/saved-state`
- `e4fec04` — Show REAL server heartbeat elapsed time on progress bar (was: client-estimated 95% cap)
- `300e7d9` — Delete/Export buttons rendered at full size
- `cccb563` — Outro layout: compact title-above-credits + AI cast list with Piper voice tag

### Worker durability (6 commits)
- `92c0d88` — Spawn detached worker process (was: Next.js discarding background promises after response → status stuck "running")
- `af7bea1` — Dead-worker detector in `/api/video/job-status` (stale > 3 min → synthetic error)
- `6e370a9` — Worker heartbeat every 8s ("assembling (Xs elapsed)" in status file)
- `e73058c` — Smart probe (1s polls) replaces blind 60s retry wait
- `378982a` — Retry with backoff + `127.0.0.1` — survives service restart race
- `b8e95c1` — UI poll cap 12 min → 20 min + honest stale-worker message

### Build / dev infra (2 commits)
- `55222bd` — `assemble-async` internal fetch hardcoded to `localhost:3200` (was routing through Cloudflare edge)
- `6176a50` / `b42df0d` — Next.js v16 Turbopack chunk bug: switched server from `next start` to `next dev` as workaround. `start:prod` kept as escape hatch.

### Other planner ports (3 commits)
- `2056156` — Movie planner: De-vocabularize button (age 5–18 range)
- `f272330` — Commercial planner: De-vocabularize button (targets `keyMessage`)
- `5f4ab90` — Music-video planner: TODO(pacing) comment (input is lyrics — De-vocab skipped)

### Image gen UI (1 commit)
- `32e450f` — Image gen errors now show HTTP status + full error text; `finally {}` block guarantees button resets on any exit path

---

## 2026-05-31 — Long-day session (17 commits, karaoke loop closed)

- `286c624` — Children: educational-first prefill + scene description backfill + `generateNarration` pre-expand
- `a438f66` — Belt-and-suspenders auto-select for empty `assemblySelectedIds` on old saved projects
- `c628dbb` — BIB fix: `scriptSegments` fallback in `generateNarration` + sub-80 char guard
- `2a15999` — BIB fix #3: pull narration from `audioPlans` when `textContent` empty
- `267a01b` — Karaoke: expand stock library + honest genre-match warnings
- `cc0b198` — Karaoke: RVC keep-anyway toggle with OS confirmation (Step 11 gate)
- `f44be26` — Karaoke: safe JSON parsing for non-JSON 5xx responses
- `dffefb9` — Karaoke: switching recordings resets per-project state (no cross-project bleed)
- `1db36ff` — **CRITICAL** — kill infinite re-render loop in `visualDescription` backfill (caused 3s click freeze)
- `8bde095` — BIB audit DEEP: shared narration resolver across all 3 TTS-firing paths + `?continue=` URL param fix
- `bca3057` — Intro/outro title uses `projectTitle` (fixed "Present My Story" literal leak)
- `0c49fd7` — Karaoke: delete button per take + `/api/karaoke/delete` endpoint
- `dc67814` — Subtitle disappeared: RICH + SIMPLE drawtext fallback + journalctl logging
- `172489f` — 4 items: music genre picker, words-on-image toggle, `/api/karaoke/vocal-cleanup` route, `/api/karaoke/melody-extract` route
- `4a4cb67` — Safe-music policy + Free Mode beats picker + `MUST-READ.md` master log
- `ea64b09` — Karaoke Steps 2 (Demucs) + 4 (Basic Pitch) wired to server-side routes. Closes karaoke pipeline end-to-end.

**Server installs:** Demucs + PyTorch, Basic Pitch + TensorFlow installed in `/home/ghs/giohomestudio/.venv`. RVC skipped (no GPU).

---

## 2026-05-30 — 29-task sprint (session scorecard: 44 tasks closed total)

**Theme:** Children/hybrid parity sweep, bug burst, FAL adapter migration, DB backup.

### Major fixes
- `6793682` — Children scene-card buttons: `handleChildSceneOp` now auto-regens image after text update
- `1d571d1` — Auto-fire story expansion on URL-param arrival + expanded toddler catalog (+4 content types, +5 curriculum templates)
- `7109fda` — Children LLM model + video/image model URL params now threaded from `/children-video`
- `0b57265` — Auto-generate narration via TTS in assembly path when `narratorAudioUrl` is empty
- `a40b53a` — `/api/video/assemble` caption: respects `subtitleConfig` + staggers 5-word chunks at 1.6s with fade
- `46ae279` — GENESIS BEAR fix: removed bear/animal token pollution from POSITIVE image prompts; tightened negative to 8 affirmative non-human concepts
- `d32b602` — Legacy subtitle modes `kids` / `dramatic` / `social`: added `SUBTITLE_PRESETS` entries (were falling through to default)
- `89b62f9` — Persist pacing fields (`pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl`, `pacingTimingMap`) in saved-state
- `e961c8d` — Children AI Audio Plan panel: mirror hybrid Step 7 (batch narration + music mood + SFX + ambience)
- `4ba3959` — Token Resolution Engine wired into `scene-image/route.ts` (`resolveCharacterTokens` already existed at `character-resolver.ts:99` — was simply never called)
- `6d84b8d` — Establishing Shot 5-mode picker (Off / Minimal / Auto / Cinematic / Epic)
- `4e4a82b` — Children establishing shot mirror: full panel + 5-mode picker + per-scene chips + image render + persistence
- `26953df` — DB R2 offsite backup: `scripts/backup_pg_to_r2.mjs`, daily 03:30 cron, 14-dump rolling window
- `0046a6b` — Children establishing shots now inserted into assembled video (were only stored in state)

### FAL adapter migration (7 commits)
- `f4104fd` — `src/lib/providers/fal.ts` scaffold with `falCall<T>`, `falQueue<T>`, `falFluxSchnell`, `falFluxDev`, `falKokoroTts`, `falAccountStatus`. 3 routes migrated.
- `9b110a9` — 3 more Kokoro callers migrated (6/24 total)
- `c3ba31b` — `falBgRemove()` added; 3 bg-remove routes migrated (9/24)
- `7d07bd3` — `falFluxDevSync`, `falMinimaxMusic`, `falStableAudio` added; music/sfx/portraits migrated (12/24)
- `223da47` — `falFluxImg2Img`, `falGeminiTts`, `falLayerizeText`, `falClarityUpscaler` added (16/24)
- `d9ad289` — Avatar/lip-sync migrated (17/24)

### Other fixes (this sprint)
- `a23627e` — character-build prompt: removed "DIFFERENT from existing" pressure (was generating stereotype-contrast characters)
- `bf5cdc7` — Karaoke flow-lock button: disabled when `isFlowLocked`; exact pending steps listed in `title` attribute
- `3f9abb9` — Movie planner scene-op: auto-regen image after text update (same fix as children)
- `10e3b17` — Movie planner: auto-narration before assembly
- `b80ee32` — Commercial planner: auto-narration before assembly
- `0168cb4` — Auto-creator: auto-narration before Build Video

### Children quality fixes (continued)
- `56e32f2` — AI prefill on land: unique 2-3 sentence story via random seed + 10 inline Modify buttons (Intensify / Playful / Fun / Educational / Adventure / Magical / Cozy / Diverse / Musical / Heartwarming)
- `f7525e3` — CDN→local download guarantee for scene images; scene-edit polish: raw-text fallback on non-JSON LLM response
- `02c6f07` — **REAL narration + subtitle fix (server-side root causes)**: sequential fallback now uses `fallbackNarrUrl`; caption derived from `scenes[i].text` when `body.caption` missing
- `49f353d` — Max ON one-shot via `autoOptedMaxRef`; `useFalNarrator` now matches `provider="piper"` for FAL fallback
- `b4d8092` — **Piper BIB fix**: `PIPER_VOICES_DIR` env + 5-path candidate list; live-verified: engine=piper, 2.9s real speech
- `529fa05` / `b554f40` — Reverted Max ON auto-opt; `/children-video` Open Planner link generates new `projectId` per click; `MODE_PRESETS` now applied in `/api/video/assemble` for 12 subtitle modes
- `0c1513c` — Inline LLM picker showing real model names (Claude Haiku 4.5 / Sonnet 4.6 / Opus 4.7 / GPT-4o / etc.)
- `322ae0c` — Children prompt quality: duration-aware prefill word count; pulls character names from `savedChars`; Modify buttons preserve proper nouns via `customInstruction`
- `c7be177` — Children narration reads `expandedStory.fullScript` not `summary`; TTS cap raised 3K → 30K chars
- `1351cc5` — Auto-expand story before assembly when `narrationText` too short for selected duration
- `156e03f` — Raw JSON `{"title":...}` no longer leaks to textarea; toddler vocab caps; subtitle picks `narrationText` not scene title
- `5f0c5b6` — Manual Re-suggest button bypassing `autoExpandedRef` guard
- `473b6d3` — Letters & Sounds topic library expanded 5 → 27 entries
- `2007a8e` — Educational-first prefill mode for 25 educational content types; scene-image failures surface HTTP status in toast
- `02d101d` — Scene plan gets `fullScript` + per-segment narration text (fixes meta-title images and "title: metadata" subtitle leak)

---

## 2026-05-29 — Narrator/actor coordination + 8 subtitle modes

- `8f1fd62` — `computeNarratorWindows()` helper extracted to `assembly-builder.ts`. `buildSubEntries()` in `assembly/execute/route.ts` now skips narrator cursor past actor windows + clips sentence end at next actor start. Diagnostic `[duck]` + `[subtitle-coord]` logs.
- `efaee13` — `scripts/verify_coord_unit.mjs` unit test: 3/3 cases pass.
- `7894e03` — Duck depth 0.06 → 0.02 (narrator whisper-faint during actor). 8 new subtitle modes added to `SUBTITLE_PRESETS` (Dance Word, Rainbow Cycle, Bubble Pop, Big Friendly, MrBeast Single, Yellow Sweep, Glow Pop, Typewriter). `SubtitleStyler` component updated.
- `27d6c36` — Highlight mode (legacy): fixed full-line highlight → per-word bouncing-ball via `highlight_current` perWord case.
- `529269f` — Orphan `md-only-backup-2026-05-27` branch retired (tagged `backup/md-2026-05-27`). Planning docs committed.

---

## 2026-05-28 — Assembly fixes + narrator restore + karaoke e2e

- Assembly: `mapPool` (bounded 4 concurrent ffmpeg) replaces unbounded `Promise.all` — 0-byte clip drops eliminated. Verified: 18/18 segments, 0 zero-byte clips.
- Mixed-mode narrator restored in hybrid planner (was dropping narrator when actor clips existed).
- Dead/stale image URLs no longer leak gray frames into video.
- Free-tier LLM fixed: `src/lib/llm.ts` auto-picks installed Ollama model + defaults to `llama3.1:8b`; `story-expand` caps Ollama at 45s with cloud fallback.
- Children story length: 5-min target → 864 words (≈750 target), continuation fill loop confirmed.
- Karaoke main = free stock by default (premium only via explicit UI tier).
- Assembly ~2× faster: ultrafast preset on intermediate encodes + concurrency 4→7 + `-c:v copy` on final merge when codec matches.
- Karaoke e2e: all 8 steps HTTP 200, ~62s, stock music, assembled + exported MP3.
- Narrator duck depth + scene composition improvements: `id_weight` 0.75 → 0.55, location-first prompt order, anti-portrait directives.

---

## 2026-05-27 — Linux production launch + Phase 1 stabilization

- **`68788e9`** — Mobile-responsive drawer shell: new `AppShell.tsx`, `@media(max-width:768px)` hamburger drawer. Desktop pixel-identical.
- Restored 204 Codex-deleted storage assets (`git checkout -- storage/`).
- Production process moved to systemd `ghs.service` (`next start`, user `ghs`, auto-restart + boot-persistent).
- Karaoke Tier 1 engines installed: faster-whisper 1.2.1, librosa 0.11.0, soundfile 0.13.1 in `.venv`.
- `pg_dump` backup cron: daily 03:30, last-7 local dumps, `/home/ghs/backups/`.
- `story-qc/run` placebo quarantined (410 unless `STORY_QC_V2_ENABLED=1`).
- R2 cleaner deferred to Phase 3 (deliberate).
- **`edc44f0`** — Asset delete: moves file to `storage/.trash/` instead of index-only removal.
- **`5796eaf`** — Subtitle PlayResY bug: emit `.ass` with `PlayResX:1920 / PlayResY:1080` header. ASS canvas scaling fixed; FontSize = real pixels.
- **`a42dfac`** — Dashboard mobile: removed duplicate top bar; stat grids stack 2-col on phone.

---

## 2026-05-24 — Piper TTS + licensed music catalog + CF timeout fix

- **`c4ed465`** — `/api/assembly/execute` now returns NDJSON streaming response with 25s heartbeats. Resolves Cloudflare Free Plan 100s edge timeout causing false "Assembly failed" errors on long videos.
- Piper TTS: binary + 6 voices installed on server. Verified end-to-end via `POST /api/hybrid/narrate-piper` (all 6 voices produce real WAV files).
- 67-track licensed music catalog: 17 stock tracks (UNVERIFIED, free-tier only) + 50 Kevin MacLeod CC BY 4.0 tracks. `GET /api/music/stock` endpoint with `?commercial=true` and `?mood=X` filters.
- **`5f7124c`** — `allowedDevOrigins: ["andiostudio.com", "www.andiostudio.com"]` in `next.config.ts`. Fixes React hydration block behind Cloudflare Tunnel (all 33 buttons were non-interactive).

---

## 2026-05-23 — Linux migration + Wave 3/4 scaffolding

- GHS LIVE on Contabo VPS 30, systemd `ghs.service`, port 3200.
- Domain `andiostudio.com` LIVE via Cloudflare Tunnel (apex + www, both 200 OK).
- R2 bucket `andio-assets` created + round-trip tested.
- Git tag `windows-final-2026-05-23` for rollback safety.
- **`5a06c89`** — `src/lib/storage/` abstraction: `StorageProvider` interface + `LocalFsProvider` + `R2Provider`. Prisma fields `ownerId`, `r2Key`, `sizeBytes`, `visibility`, `storageProvider` added to 6 asset models.
- **`0a3e528`** — 23-supervisor orchestrator brain: `src/lib/story-qc/registry.ts` (all 23 supervisors with typed metadata), `orchestrator.ts` (topo-sort + per-tier timeouts + cascade-skip), `app/api/story-qc/run` route.
- FIX 2: Subtitle cap removed — SRT/libass path with drawtext fallback.
- FIX 7: PuLID single-char rich-location drop.

---

## 2026-05-22 — Export timing + caption layout

- `app/api/assembly/execute/route.ts`: pre-flight updates narrator `endTime` to `realDur`. `totalDuration = max(realDur, clientTotal, lastSegEnd)`. Caption Y changed `h*0.88 → h-th-54` (multiline captions stay inside frame). `wrapText` 45→40 chars; word-chunk split at 20 words.

---

## 2026-05-16 — Session 12: Establishing Shot image gen + Assembly wire-in

- `app/dashboard/hybrid-planner/page.tsx`: establishing shot `imageUrl` field + Gen Image button + image preview. Establishing shots with `imageUrl` prepended as short image segments before their scenes in `assembleScenes()`.
- `useEffect` scroll-lock for all modals (prevents body scroll when any overlay is open).
- `generateNarration()` in collaborative-editor now uses `castTray[].voiceName` as `voiceId` for character-specific TTS.

---

## 2026-05-15 — Session 11: Collab Editor 3-panel + subtitle tokens + establishing shot route

- Collaborative editor extended: shot-level scene folders, active shot preview panel, `apply-edit` API wired.
- `app/api/assembly/execute/route.ts`: per-segment `subtitleStyle` override via `getSegmentStyleAt()`.
- `app/api/hybrid/establishing-shot/generate/route.ts` — NEW: FAL FLUX wide establishing shot image gen.
- `src/types/character.ts` — shared `CharacterIdentity` + `ReferenceImage` types.
- `CharacterPicker.tsx` — multi-image thumbnail strip for characters with >1 reference image.
- `app/dashboard/character-voices/page.tsx` — multi-image upload (up to 4 per character, with angle labels).

---

## 2026-05-15 — Session 10: Story QC Fix System + Establishing Shot + Voice Auto-Assign

- Story QC: Fix/Fix All buttons that apply suggestions to all scenes via one batch LLM call.
- Per-scene AI chat (Ask AI) added to scene edit panel.
- Character voices auto-assign by gender on detection.
- Full Establishing Shot system: API + UI, based on spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`.
- Name library expanded: 7 new cultural regions, +700 names.

---

## 2026-05-14 — Story QC Layer (22-supervisor pipeline, Semi-AI Collaborative Mode)

- 22 TypeScript supervisors in `src/lib/story-supervisors/`.
- 7 Prisma models: `StoryQCProject`, `StoryQCContract`, `StoryQCDraft`, `StoryQCCastMember`, `StoryQCScenePlan`, `StorySupervisorReport`, `StoryGenerationPlan`.
- 5 API routes under `app/api/story/`.
- Character IDs standardized: `char_name_001 → CH01 / CH02 / CH03` format.
- `ShotPlan` type system: `shot_id` (SH04-01), `characters_visible`, `speaking_character_id`, `dialogue_line`, camera/lighting fields.
- Semi-AI Collaboration Console in collaborative editor: intent parser, scope badge, edit history with undo.

---

## 2026-05-08 — Phase C: `useProjectSettings` wired into 7 planners

All planners (hybrid, children, movie, commercial, music-video, scene-forge, free-mode) now persist settings (`visualStyle`, `soundTier`, `subtitleConfig`, `videoModelVersion`, `imageModelVersion`, `language`, `llmProvider`, `narrationProvider`) to a central DB-backed `ProjectSettings` model via the `useProjectSettings` hook. Changes in one planner are visible in another for the same `projectId`. Rollback: revert the import + hook call + shim block in each `page.tsx`.
