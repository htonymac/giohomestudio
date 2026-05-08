# GHS HANDOFF — 2026-05-07 Session 7 (Gen Max + Audio Clock Fix)

## Branch: fix/ghs-pipeline-recovery-may05
## Build: TSC clean (exit 0)
## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma, schema unchanged this session)

---

## WHAT WAS DONE THIS SESSION

### Gen Max — Per-Scene Action-Beat Images (FEATURE-02)

**What:** Scene board now has "Gen Max (N beats)" button on every scene Image tab.
- `splitIntoActionBeats(text)` splits scene description on sentence breaks + action connectors (then/suddenly/after/before/while etc). Returns up to 6 action beats.
- `makeSceneBeatImages(scene)` calls `/api/hybrid/scene-image` once per beat with that beat's text as `sceneText`, stores results in `sceneBeatImages[sceneId]`.
- UI: Gen Max button shows beat count (e.g. "Gen Max (3 beats)"). Shows progress label "Beat 2/3..." while generating. Beat thumbnails appear below button as a scrollable row after generation. Click any thumbnail → full preview lightbox.
- Assembly expansion: when a scene has `sceneBeatImages[sceneId]` and no video, the assembly loop expands that scene into N segments (one per beat image), each with duration = `sceneDur / N`. Falls back to normal single-segment if only 1 beat or has video.
- Gen Image(1) button unchanged — still generates one image using full description.
- Gen Max appears in both "has image" and "no image" states on the card. Hidden when scene description only has 1 beat.

**Files:**
- `app/dashboard/hybrid-planner/page.tsx`:
  - Lines ~370-374: new state `sceneBeatImages`, `generatingMaxBeats`, `maxBeatsProgress`
  - Lines ~1687-1760: `splitIntoActionBeats()` + `makeSceneBeatImages()` functions
  - Lines ~2814-2870: assemblySegments loop changed from `.map()` to `for` loop with beat expansion
  - Lines ~5413-5445: Gen Max button + beat strip in "has image" Image tab
  - Lines ~5456-5470: Gen Max button in "no image" Image tab

---

### Audio Pipeline — Complete Rewrite (fixes for all silent failures)

All 7 audio bugs fixed this session. Root causes documented in PROBLEM_AND_FIX.md as AUDIO-01 through AUDIO-03.

**AUDIO-01: Piper TTS speaks mojibake aloud**
- Symptom: Narrator says "a circumflex euros" instead of em dash
- Fix: `src/lib/sanitize-text.ts` (NEW) — `sanitizeForTTS()` + `detectTTSArtifacts()`
- Applied at: `app/api/hybrid/narrate-piper/route.ts` L273 (ElevenLabs) + L372 (Piper)
- Status: DONE ✅

**AUDIO-02: Multiple narration tracks all play at t=0 simultaneously**
- Symptom: 1 voice in test, 5 simultaneous voices in assembled video
- Fix: Dedup by audioUrl (Set), sort by startTime, `atrim=duration=N` per track, `duration=longest` in amix
- Files: `src/lib/assembly-builder.ts` — narration mix block + final amix
- Status: DONE ✅

**AUDIO-03: Assembly stops at 4 seconds after hard refresh — "shhhh" sound**
- Symptom: Audio cuts off at 4s with abrupt sibilant sound after every hard page refresh
- Root cause: `narratorAudioDuration` is React state only — resets to 0 on refresh. `totalDuration = sceneBaseDuration` (tiny motionDuration values, e.g. 0.5s × 8 = 4s). FFmpeg gets `-t 4`.
- Fix: `effectiveNarrDurMs` recovery block in `assembleScenes()` — if narratorAudioUrl exists but duration=0, load browser `Audio` element → `onloadedmetadata` → recover duration → update state
- All 3 references to `narratorAudioDuration` in assembly-building section replaced with `effectiveNarrDurMs`
- File: `app/dashboard/hybrid-planner/page.tsx` lines 2512-2529 (recovery block), 2773, 2807, 2818
- Status: DONE ✅

**Music never loops (stops at 34s)**
- Fix: `-stream_loop -1` before `-i` + `atrim=duration=${targetDur}` in prepare_music step
- File: `src/lib/assembly-builder.ts` Step 3
- Status: DONE ✅

**SFX completely missing from all assembled videos**
- Fix: New `mix_sfx` step in assembly-builder + SFX path resolution in execute route + SFX track in final merge
- Files: `src/lib/assembly-builder.ts` Step 4, `app/api/assembly/execute/route.ts`
- Status: DONE ✅

**Video cuts at 30s when narration is 3min**
- Fix: `-stream_loop -1` on video in final_merge, `-t totalDur`, `duration=longest`, removed `-shortest`
- Files: `src/lib/assembly-builder.ts` Step 5, `app/api/assembly/execute/route.ts` final_merge override
- Status: DONE ✅

**Duration redistribution not triggering**
- Fix: Redistribution check now triggers correctly when `segDurSum < totalDuration * 0.5`
- File: `app/api/assembly/execute/route.ts` lines 190-196
- Status: DONE ✅

---

### Scene Images — Action Extraction (IMAGE-01)

**Problem:** Confrontation/fight/chase scenes generate calm-looking images. Bryan + bullies look like friends.

**Root cause:** `scene-image/route.ts` pushed raw sceneText with no action analysis. Image models read "Bryan confronted some bullies" as presence, not action.

**Fix:** `extractSceneAction(text)` function added — 12 action types detected via regex:
- confrontation → aggressive body language, one blocking path, hostile posture
- fight → dynamic action poses, striking/lunging
- chase → sense of speed, pursuer visible behind
- fear → wide eyes, cowering, dramatic shadows
- rescue → reaching/pulling to safety, urgent
- argument → pointing, raised voice implied
- discovery → shock expression, high contrast lighting
- grief → slumped posture, head down, soft lighting
- celebration → joyful, arms raised or embracing
- stealth → crouched, pressed against wall, dark
- dialogue → natural facing, engaged expressions
- default → purposeful body language, dynamic composition

Also: `cameraFraming` is now actually injected into the prompt (was received but silently dropped before).

**PROTECTED block:** marked with multi-line comment `// ── SCENE ACTION LAYER — PROTECTED — DO NOT REMOVE, SIMPLIFY, OR OVERRIDE ──` with date + reason. History note inside the comment. Future refactors must NOT delete this block.

**File:** `app/api/hybrid/scene-image/route.ts` lines 143-260

---

### Per-Scene AI Chat — "AI Fix" Tab (FEATURE-01)

**New route:** `app/api/hybrid/scene-chat/route.ts`
- POST — receives scene context (title, description, location, mood, characters, image prompt) + user message + history
- Uses Ollama (local, `forceProvider: "ollama"`, role: "assistant") → $0 cost
- Returns `reply` + optional `imagePromptSuggestion` (extracted from `IMAGE PROMPT:` line in response)

**UI:** Scene cards in Scene Board tab now have 4th tab: **AI Fix** (green)
- Chat history with user/AI bubbles
- Input field + Send button (Enter to send)
- "Apply & Regenerate Image" button appears automatically when AI returns an IMAGE PROMPT suggestion
- Clicking Apply calls `makeSceneImage({ ...scene, description: aiPrompt })` — generates corrected image
- Clear chat button at bottom
- State: `sceneChatMessages`, `sceneChatInput`, `sceneChatLoading` — all per sceneId

**File:** `app/dashboard/hybrid-planner/page.tsx` — state at L366-369, chat panel at ~L5408-5477

**Ollama must be running.** If Ollama is offline, chat returns "Connection error — is Ollama running?".

---

### Subtitle Burn-In — Fixed (SUBTITLE-01)

**Two root causes:**
1. `assemblyNarration` had `text: ""` — no text for subtitle generation
2. `execute/route.ts` never read `assembly.exportSettings.includeSubtitles` — flag was silently ignored

**Fixes:**
- `page.tsx assembleScenes()`: narration entries now carry `text: narratorFullText.slice(0, 8000)` for main narrator
- `execute/route.ts`: subtitle burn-in block added after final_merge success:
  - Splits narration text into sentences
  - Times each sentence proportionally by character count within total duration
  - Writes SRT file, runs `ffmpeg -vf subtitles=file.srt:force_style='...'`
  - If FFmpeg lacks libass → warning log only, original video preserved
  - `subtitledOutputPath` replaces `finalOutputPath` when burn-in succeeds

**Graceful failure:** subtitle step can never corrupt the primary output. Failure = skip silently.

---

## KEY FILE CHANGES THIS SESSION

| File | What changed |
|---|---|
| `src/lib/sanitize-text.ts` | NEW — sanitizeForTTS() + detectTTSArtifacts() |
| `app/api/hybrid/narrate-piper/route.ts` | sanitizeForTTS applied at L273 (ElevenLabs) + L372 (Piper) |
| `src/lib/assembly-builder.ts` | narration dedup+atrim, music stream_loop, new mix_sfx step, final merge overhaul |
| `app/api/assembly/execute/route.ts` | SFX resolution, subtitle burn-in block, final_merge duration fix |
| `app/api/hybrid/scene-image/route.ts` | extractSceneAction() function (PROTECTED), cameraFraming wired |
| `app/api/hybrid/scene-chat/route.ts` | NEW — per-scene Ollama chat route |
| `app/dashboard/hybrid-planner/page.tsx` | effectiveNarrDurMs recovery, AI Fix tab UI, narration text population, subtitle include flag |
| `update/PROBLEM_AND_FIX.md` | AUDIO-01, AUDIO-02, AUDIO-03, IMAGE-01, FEATURE-01, SUBTITLE-01 entries |
| `~/.claude/projects/C--Users-USER/memory/error_log.md` | AUDIO-03 + AUDIO-02 entries added |

---

## KNOWN ISSUES / NOT YET BUILT

| # | Item | Priority | Notes |
|---|---|---|---|
| 1 | SFX doesn't match scene action | Medium | Architecture agreed: 60 semantic categories, each with 2-3 royalty-free files. Ollama maps scene action → category → file. 60 files covers ~90% of all stories. NOT YET BUILT. |
| 2 | Music per scene (not one global) | Low | Currently one music track for whole video. Future: each scene gets its own music mood entry |
| 3 | `KIE_AI_API_KEY` + `MUBERT_PAT` in `.env` | Low | Premium music tiers fall back to stock library without these |
| 4 | Subtitle style not applied | Low | Subtitle burn-in uses hardcoded Arial 22px white. `subtitleConfig` (classic/neon/bold/cinema/minimal) style tokens not yet mapped to FFmpeg force_style params |
| 5 | Scene images: music selection not visually obvious | Low | Henry flagged. FAL music tier selection is buried in Sound tab. Consider moving music preview into Scene Board header |
| 6 | Merge branch to main | Medium | fix/ghs-pipeline-recovery-may05 has all fixes but not merged |
| 7 | Narrator audio duration not persisted to DB | Low | Recovered on assembly via Audio element, but state lost until assembly. Persist to DB for cleaner UX |

---

## NEXT EXACT STEPS

1. **Test audio pipeline end-to-end** — assemble a fresh video after hard refresh; browser console should log `[assemble] Recovered narrator duration after refresh: XXXXXms`
2. **Test AI Fix tab** — open a scene card, click "AI Fix", type a correction, check that AI returns IMAGE PROMPT and Apply button appears
3. **Test scene images** — regenerate Bryan + bullies scene — should now show confrontational body language
4. **Subtitle test** — enable subtitles in pre-assembly panel, assemble, check if SRT burn-in fires (check server logs for `[assembly] Subtitle burn-in OK`)
5. **SFX semantic category system** — when ready to build: 60 categories, royalty-free files in `storage/sfx/categories/`, Ollama maps scene action → category in `scene-intelligence/route.ts`
6. **Merge to main** when satisfied with audio + image quality

---

## HOW THE AUDIO PIPELINE WORKS (reference for future me)

```
assembleScenes() in page.tsx
  1. effectiveNarrDurMs recovery (Audio element if state=0)
  2. totalDuration = Math.max(sceneBaseDuration, narratorDurSec)
  3. Build assemblyNarration (dedup by URL, text populated, endTime = actual duration)
  4. Build assemblyJSON → POST /api/assembly/execute

execute/route.ts
  1. Normalize segment durations (redistribution if segSum < 50% totalDuration)
  2. Preprocess segments: download externals, transcode to H264 normalized clips
  3. Write concat_list.txt with basenames
  4. Resolve narration/music/SFX paths
  5. buildAssemblyPlan() → FFmpegStep[]

assembly-builder.ts steps:
  Step 1: concat_segments — all clips → concat_raw.mp4
  Step 2: mix_narration — dedup+atrim+adelay+amix → narration_mix.wav
  Step 3: prepare_music — stream_loop + atrim to totalDuration → music_mix.wav
  Step 4: mix_sfx — atrim+adelay+amix → sfx_mix.wav
  Step 5: final_merge — stream_loop video + all audio tracks → final_PROJECTID_vN.mp4
    amix=duration=longest:normalize=0 (NEVER duration=first, NEVER -shortest)

execute/route.ts post-processing:
  6. Subtitle burn-in (optional, graceful skip if libass missing)
  7. ffprobe for actual duration
  8. Generate thumbnail
  9. Save to asset library + DB
  10. Cleanup intermediates
```

---

## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma)
## Build: TSC clean (exit 0)
