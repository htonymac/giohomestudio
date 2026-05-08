# GioHomeStudio — Problems and Fixes Log

Use this file to record bugs, their root cause, and the fix applied. When the same problem appears again, check here first before debugging from scratch.

---

## 2026-04-30 — BUG-04a/c/f: Children/Movie planner API payload mismatch + JSON parse crash

**Symptom:** Scene plan never generates in children-planner. Music generation silently fails. Any API 500/404 causes `Unexpected token '<', "<!DOCTYPE"... is not valid JSON` crash.

**Root cause:**
- `children-planner/page.tsx` scene-plan call sent `{expandedStory: {summary}, genre, tone, totalScenes, targetDuration}`. Server at `/api/hybrid/scene-plan` expects `{storyText: string, characters: [], costPreference, targetDuration, projectId}`. Server returns 400, 400 response is HTML error page, `.json()` on HTML crashes.
- Music call sent `{mood, duration}`. Server zod schema requires `{prompt: string(min1), durationSeconds: number}`. Returns 400 JSON.
- No content-type guard on any `.json()` call — HTML error pages thrown as parse errors.

**Fix applied (S3, fix/ghs-bug-04-payload-json-guard):**
- Rewrote children-planner scene-plan payload to match server: `{storyText: summary||storyInput, characters: savedChars.map(...), costPreference: "budget", targetDuration, projectId}`.
- Rewrote music payload: `{prompt: "${musicMood} background music for a children's story", durationSeconds: 20}`.
- Created `lib/api-utils.ts` with `safeJson<T>(res, context)` — throws readable error with status code if not 200+JSON. Applied to 6 calls in children-planner + 1 in movie-planner.
- Movie-planner scene-plan payload was already correct; added safeJson guard only.

**Prevention:** Copy payload shape from server route zod schema, not from old UI code. Always use `safeJson()` instead of bare `.json()`.

---

## AUDIO ISSUES

---

### PROBLEM: All character voices play simultaneously at t=1 causing "many sounds" chaos
**Reported:** 2026-04-17  
**Symptom:** Assembled video has all character voices (SCOUT, CLAW, MARTA, PIP, TEDDY) playing at the same time over each other, producing a wall of noise on top of the narrator and music.  
**Root cause:**  
When `scriptSegments` is empty (no parsed script), the assembly code defaults ALL character voice files to `startTime: 1`. Every character's full audio file (which contains ALL their lines concatenated) starts at second 1 simultaneously. With 5 characters × full audio files all starting at t=1 = 5 overlapping tracks = bad mix.  
**Fix applied:**  
Short-term: Set `storyMode: "narration-only"` and `characterAudioUrls: {}` when restoring project state for assembly. This disables character voices until proper per-line timing is implemented.  
**Long-term fix needed:**  
Build per-line audio system: each dialogue line gets its own audio file + calculated start time based on narrator duration for preceding content. Pass as `narrationList` entries with proper `startTime` per line.  
**Prevention:** Never assemble with `storyMode: "mixed"` or `"actors-only"` unless `scriptSegments` is populated with per-line scene IDs and timing.

---

### PROBLEM: Character voice files shared between projects cause wrong audio in assembled video
**Reported:** 2026-04-17  
**Symptom:** Teddy & Dog assembly plays Scout/Claw/Marta voice lines from Bear Rescue project — wrong story dialogue.  
**Root cause:**  
Character IDs (e.g., `XX_SCOUT2VG35`) are reused across projects. The `_draft.wav` file for each character gets overwritten every time that character is voiced in ANY project. So the file always contains the most recent project's lines, not the current project's lines.  
**Fix applied:** Clear `characterAudioUrls` before assembly (narration-only mode). Don't use old draft character files.  
**Long-term fix needed:** Per-project character audio naming: `char_${characterId}_${projectId}_${timestamp}.wav`. Never use `_draft` suffix for character voices.

---

---

### PROBLEM: Old narrator audio plays on new video (audio bleeding between projects)
**Reported:** 2026-04-17  
**Symptom:** When assembling a new project, the narrator voice from a previous project/session is heard in the output video alongside (or instead of) the new narrator.  
**Root cause:**  
1. `narrate-piper` API generates files named `narration_${projectId || "draft"}.wav`. If the project has no DB ID, it always writes to `narration_draft.wav`.  
2. When a NEW project starts, the old `narration_draft.wav` from the previous project remains on disk.  
3. localStorage restores the old `narratorAudioUrl` on page load (because it saves the URL per project local ID).  
4. Assembly includes this stale URL in the narrationList and mixes it into the new video.  
**Fix applied** (`app/dashboard/hybrid-planner/page.tsx`):  
- Narrator output filename now includes a timestamp: `narration_${projectId || "draft"}_${Date.now()}.wav` — each generation creates a UNIQUE file, never overwriting old ones.  
- Character voice generation also uses timestamp: `char_${characterId}_${projectId || "draft"}_${Date.now()}.wav`  
- Assembly start checks if `narratorAudioUrl` is still accessible via HEAD request — clears stale URL if 404.  
- Story textarea's onChange clears `narratorAudioUrl`, `characterAudioUrls`, and `scriptSegments` when story changes by >50 chars — prevents carrying over audio from a previous story.  
**Prevention:** Always regenerate narrator audio after changing the story text. Audio state is now cleared automatically when story changes significantly.

---

### PROBLEM: Music becomes nearly silent after narration is added
**Reported:** 2026-04-17  
**Symptom:** In the assembled video, background music is barely audible (sounds like <15% volume). Narration is loud but the music backdrop is almost gone.  
**Root cause:**  
In `/api/video/assemble/route.ts` (legacy single narration path), the FFmpeg filter was:  
`[0:a]volume=0.15[va]` — this ducked the background (which already included music at 0.85) to 15% effective, making music ≈12% volume.  
**Fix applied** (`app/api/video/assemble/route.ts`):  
- Legacy narration path: changed `volume=0.15` → `volume=0.30` — music remains audible at 30% while narration is dominant.  
- narrationList path: added `[0:a]volume=0.35[bg]` ducking so background isn't competing at full volume with voices.  
- Music mixing step: scene video audio reduced to `volume=0.5` (from `volume=1`) so background music doesn't fight it.  
**Correct audio hierarchy:** Narration=1.0 (dominant) → Music=0.85 background → Scene ambient=0.5 → SFX=0.5

---

### PROBLEM: Multiple character voices stack without ducking — audio clips/distorts
**Reported:** 2026-04-17  
**Symptom:** When a project has 5+ characters all voiced, the final assembled video has distorted/clipped audio, making voices hard to hear.  
**Root cause:**  
The narrationList path in `/api/video/assemble/route.ts` adds each voice track WITHOUT reducing the background:  
`[0:a][na]amix=inputs=2:normalize=0:duration=first[out]`  
With 5 characters, each iteration adds another 1.0 voice on top of the existing mix. The cumulative volume exceeds safe levels and clips.  
**Fix applied:** Added `[0:a]volume=0.35[bg]` before each amix — each new voice track ducks the existing mix before adding the new voice at `volume=1.0`.  

---

### PROBLEM: FAL LTX Video model stuck at 30% — never completes
**Reported:** 2026-04-16 (Henry's session)  
**Symptom:** Any scene using FAL LTX Video for generation hangs at 30% progress and times out at 360 seconds.  
**Root cause:** FAL server timeout / model-specific latency issue with LTX Video endpoint.  
**Fix applied:** FAL LTX Video disabled across all planners. Segmind Pruna set as default video generation model (`segmind_pruna_video`).  
**Status:** Active workaround — re-enable LTX Video if FAL resolves latency.

---

## PROJECT STATE ISSUES

---

### PROBLEM: Teddy & Dog project scenes gone from localStorage after new session
**Reported:** 2026-04-17  
**Symptom:** Opening Hybrid Planner shows "Untitled Hybrid Project" with 0 scenes. The Teddy & Dog project (7 scenes, 5 characters) is not loaded.  
**Root cause:**  
The project's scene/character/audio data is stored in browser localStorage, which gets cleared or replaced between sessions. Only 1 DB project exists ("Untitled Hybrid Project") and it has no scenes saved.  
**Recovery:** Videos are server-side in `storage/video-registry.json` (SC01-SC07). Narration audio is in `storage/narration/`. The project must be reconstructed by re-entering the story and reconnecting to existing assets.  
**Long-term fix needed:** Save ALL project state (scenes, characters, narration URLs, screenplay, script segments) to DB via `/api/hybrid/[id]` on every change — not just to localStorage. This ensures project survives browser clears.

---

### PROBLEM: Assembled video uses old assembled output as a scene source
**Reported:** 2026-04-16  
**Symptom:** If `sceneVideos[sceneId]` gets set to a previously assembled full-movie URL, the new assembly takes the old movie (with its narration baked in) and layers new narration on top — causing double audio.  
**Root cause:** The `sceneVideos` state map in the planner stores video URLs. If any function accidentally writes the assembled movie URL to a scene slot, that scene's audio from the old assembly gets re-included.  
**Prevention:** Assembly outputs are saved to `storage/video/assembled/` (not `storage/scenes/`). Scene generation saves to `storage/scenes/`. They should never overlap. If this happens, check `sceneVideos` state in the browser DevTools console.

---

## PIPELINE FAILURES

---

### PROBLEM: `concat_segments` step skips scenes because videos have no audio stream
**Symptom:** Some scene videos (image→video from FAL) have no audio track. The concat demuxer requires uniform audio, causing the next audio mix step to fail on these scenes.  
**Fix:** `/api/video/assemble/route.ts` now normalizes all scene videos:  
- If no audio stream → adds `anullsrc` silent track before concat  
- All videos normalized to `aac/44100/stereo` format before concat demuxer

---

### PROBLEM: Subtitle PNG overlay fails for certain video sizes
**Symptom:** Scene videos from some providers come at non-standard resolutions (e.g., 1280×720). The overlay fails when the subtitle PNG (always 1920×1080) doesn't match video dimensions.  
**Fix:** Subtitle overlay uses `overlay=0:0:format=auto` which handles size mismatches. Also added fallback: if subtitle overlay fails, assembly continues without subtitles rather than failing entirely.

---

## SERVER / ENVIRONMENT ISSUES

---

### PROBLEM: `FAL_API_KEY` vs `FAL_KEY` env var mismatch
**Reported:** 2026-04-12  
**Symptom:** Video generation silently returns null — no error shown, no video created.  
**Root cause:** FAL SDK reads `FAL_KEY` from env, but `.env` had `FAL_API_KEY`.  
**Fix:** Updated all references to use `FAL_KEY`. Added explicit error throw when FAL key is missing.

---

### PROBLEM: Piper TTS model auto-download fails silently
**Symptom:** "Generating narrator audio" spins and times out with no error message.  
**Root cause:** Piper model (`.onnx` file) not in `~/piper-models/` directory. Auto-download from HuggingFace attempted but failed due to rate limit or network issue.  
**Fix:** `narrate-piper` route now returns `{ ok: false, piperNotInstalled: true }` clearly. Frontend shows "Piper not installed" with install hint instead of generic spinner timeout.

---

### PROBLEM: FFmpeg `drawtext` filter fails — `libfreetype` not compiled in
**Reported:** 2026-04-11  
**Symptom:** Text overlays never appear on assembled videos. No visible error.  
**Root cause:** Local FFmpeg build compiled without `--enable-libfreetype`. `drawtext` filter silently fails.  
**Fix:** Replaced all `drawtext` filters with Sharp+SVG subtitle PNG generation:  
- SVG text rendered via Node.js sharp library → PNG overlay file  
- FFmpeg `overlay=0:0` composites PNG onto video — no font dependency  
- 5 subtitle styles: classic, cinema, neon, minimal, bold

---

*Last updated: 2026-05-07*

---

## 2026-05-07 — AUDIO-01: Piper TTS speaks mojibake aloud ("a circumflex euros")

**Symptom:** Assembled video narrator says phrases like "a circumflex euros", "a circumflex heroes" instead of an em dash or smart quote character.

**Root cause:** Story text contains UTF-8 characters stored as Latin-1 mojibake (e.g., `â€"` = em dash U+2014, `â€™` = right single quote U+2019). `narrate-piper/route.ts` passed `text.trim()` directly to Piper stdin with no sanitization. Piper read `â€"` as three Latin-1 characters and spelled them out phonetically.

**Fix applied:**
- Created `src/lib/sanitize-text.ts` with `sanitizeForTTS(text)`:
  - MOJIBAKE table: replaces `â€"` → `-`, `â€™` → `'`, `â€œ` → `"`, `â€¦` → `...`, `Ã©` → `e`, etc.
  - SMART_PUNCT table: replaces curly quotes, em/en dashes, ellipsis, NBSP, middle dot
  - Strips remaining non-ASCII with `/[^\x00-\x7E]/g`
  - Collapses multi-space artifacts
- Applied `sanitizeForTTS(text.trim())` at `narrate-piper/route.ts:372` (Piper path) and `:273` (ElevenLabs path)

**Prevention:** Any text going into TTS must pass through `sanitizeForTTS` first. Never send raw story text to Piper.

---

## 2026-05-07 — IMAGE-01: Scene images show wrong action (characters stand calmly in confrontation scenes)

**Symptom:** Bryan confronts bullies but image shows them standing casually side by side. Tense scenes look neutral.

**Root cause:** `app/api/hybrid/scene-image/route.ts` line 183 pushed raw `sceneText` only. Image models treat "Bryan confronted some bullies" as presence/setting, not action. No body language, spatial relationship, or tension directives were in the prompt.

**Fix applied:**
- Added `extractSceneAction(text)` function (~50 lines) in scene-image/route.ts
- Detects action type via regex: confrontation, fight, chase, fear, rescue, argument, discovery, sadness, celebration, stealth, dialogue
- Returns precise body-language + spatial-relationship directives per action type
- Injected after raw scene text push, before human-character guard
- Also wired `cameraFraming` into the prompt (was received but never used)
- Block is marked `// ── SCENE ACTION LAYER — PROTECTED — DO NOT REMOVE, SIMPLIFY, OR OVERRIDE ──` with history note

**Files changed:** `app/api/hybrid/scene-image/route.ts` lines 143-260

**Prevention:** The PROTECTED comment block must stay. Future refactors of scene-image MUST preserve `extractSceneAction()` call and both `promptParts.push()` calls after it. If rebuilding the route, search for "SCENE ACTION LAYER" and keep it.

---

## 2026-05-07 — FEATURE-01: Per-scene AI chat for image correction (local Ollama, no cost)

**What was built:**
- `app/api/hybrid/scene-chat/route.ts` — POST endpoint using Ollama (forceProvider: "ollama"). Receives scene context + user message, returns AI reply + optional IMAGE PROMPT suggestion.
- Scene card "AI Fix" tab (4th tab) added to all scene cards in `app/dashboard/hybrid-planner/page.tsx`.
- Chat UI: message history, input field, "Apply & Regenerate Image" button appears when AI returns an IMAGE PROMPT suggestion.

**How it works:**
1. User types "the image is wrong, Bryan should look angry blocking bullies"
2. Ollama reads scene description + characters + current context
3. AI returns corrected image prompt starting with "IMAGE PROMPT:"
4. Button appears — clicking it calls `makeSceneImage()` with AI-suggested description
5. New image generated with corrected prompt

**Cost:** $0 — runs on local Ollama (llama3 or configured OLLAMA_MODEL_ASSISTANT)

---

## 2026-05-07 — SUBTITLE-01: Subtitles never burned in (includeSubtitles flag ignored by execute route)

**Symptom:** Subtitle style selector exists in UI. Subtitles never appear in assembled video.

**Root cause (2 issues):**
1. `assembleScenes()` set `text: ""` on all narration entries — execute route had no text to burn
2. `execute/route.ts` never read `assembly.exportSettings.includeSubtitles` — the flag was completely ignored

**Fix applied:**
- `app/dashboard/hybrid-planner/page.tsx`: narration entries now carry `text: narratorFullText.slice(0,8000)` for main narrator (full story text for proportional timing)
- `app/api/assembly/execute/route.ts`: added subtitle burn-in block after final_merge step:
  - Builds SRT from narration entries (sentences split proportionally by character count)
  - Runs FFmpeg `subtitles=file.srt:force_style='...'` (requires libass)
  - Failure is graceful — original video is kept, subtitle step is skipped with a warning log
  - Subtitled output replaces finalOutputPath when successful

**Prevention:** If refactoring execute route, do NOT remove the subtitle block or merge it with final_merge. Subtitle is a separate post-processing step so failure can't corrupt the primary output.

---

## 2026-05-07 — AUDIO-02: Multiple narration tracks all play simultaneously at t=0 in assembly

**Symptom:** Test audio shows one narrator; assembled video has 3–5 narrators all talking at once.

**Root cause (3 issues in assembly-builder.ts):**
1. No deduplication by `audioUrl` — same WAV file appearing multiple times in `narration[]` gets loaded as N separate `-i` inputs, all playing simultaneously.
2. No `atrim` per track — each WAV plays its full duration regardless of `startTime`/`endTime` window, causing bleed-over.
3. Final merge used `amix=duration=first` — cut audio at the shortest stream (first video segment), chopping remaining narration.

**Fix applied (`src/lib/assembly-builder.ts`):**
- Deduplicate narration entries by `audioUrl` using `Set<string>` before building FFmpeg inputs
- Sort entries by `startTime` for a deterministic manifest
- Per-track `atrim=duration=N` where N = `endTime - startTime`, applied before `adelay`
- Changed final merge `amix=duration=first` → `duration=longest`

**Files changed:**
- `src/lib/sanitize-text.ts` (new)
- `app/api/hybrid/narrate-piper/route.ts` lines 273, 372
- `src/lib/assembly-builder.ts` narration mix block + final amix

**Prevention:** Always deduplicate by URL before building FFmpeg filter graphs. Always `atrim` before `adelay`. Final amix = `duration=longest`, not `duration=first`.

---

## 2026-05-07 — AUDIO-03: Assembly stops at 4 seconds after hard refresh — narrator duration lost

**Symptom:** After a hard page refresh, assembled video stops at ~4 seconds with an abrupt "shhhh" audio cut. Narration, music, and SFX all cut off.

**Root cause:** `narratorAudioDuration` is React state (never persisted to localStorage or DB). After a hard refresh it resets to 0. In `assembleScenes()`:
```
const narratorDurSec = narratorAudioDuration > 0 ? narratorAudioDuration / 1000 : 0;
const totalDuration = Math.max(sceneBaseDuration, narratorDurSec || sceneBaseDuration);
```
With `narratorAudioDuration = 0`, `totalDuration = sceneBaseDuration`. If scenes have tiny `motionDuration` (e.g., 0.5s × 8 scenes = 4s), FFmpeg receives `-t 4`, cutting everything at 4 seconds.

**Fix applied (`app/dashboard/hybrid-planner/page.tsx`):**
Added duration-recovery block in `assembleScenes()` before the assembly JSON is built:
```typescript
let effectiveNarrDurMs = narratorAudioDuration;
if (narratorAudioUrl && effectiveNarrDurMs === 0) {
  effectiveNarrDurMs = await new Promise<number>((resolve) => {
    const audio = new Audio(narratorAudioUrl);
    audio.onloadedmetadata = () => resolve(Math.round(audio.duration * 1000));
    audio.onerror = () => resolve(0);
    setTimeout(() => resolve(0), 8000);
  });
  if (effectiveNarrDurMs > 0) setNarratorAudioDuration(effectiveNarrDurMs);
}
```
All `narratorAudioDuration` references inside the assembly-building section replaced with `effectiveNarrDurMs`.

**Files changed:**
- `app/dashboard/hybrid-planner/page.tsx` — lines 2512-2529 (recovery block), 2773 (totalDuration), 2807 (endTime), 2818 (fallback endTime)

**Prevention:** Any state derived from generated audio (duration, format, etc.) must either be persisted OR re-measured from the file before use. Never trust transient React state for FFmpeg `-t` parameter.

---

## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: FAL_KEY not set in environment | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: FAL_KEY not set in environment


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | image-to-video | FAIL: FAL_KEY not set in environment | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan image-to-video: FAL_KEY not set in environment


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | text-to-video | FAIL: FAL_KEY not set in environment | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std text-to-video: FAL_KEY not set in environment


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL_KEY not set in environment | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL_KEY not set in environment


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /t2v-1.3b not found"} | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: FAL completed but no video URL found: {"detail":"Path /t2v-1.3b not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | image-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /i2v-720p not found"} | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan image-to-video: FAL completed but no video URL found: {"detail":"Path /i2v-720p not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /t2v-1.3b not found"} | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: FAL completed but no video URL found: {"detail":"Path /t2v-1.3b not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | text-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/text-to-vid | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std text-to-video: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/text-to-video not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | image-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /i2v-720p not found"} | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan image-to-video: FAL completed but no video URL found: {"detail":"Path /i2v-720p not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/image-to-vi | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/image-to-video not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | text-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/text-to-vid | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std text-to-video: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/text-to-video not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/image-to-vi | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL completed but no video URL found: {"detail":"Path /v2.5/standard/image-to-video not found"}


---
## Session 1 Smoke Test — 2026-04-26

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | FAIL: SKIPPED — Kling 2.5 via FAL not activated. Check FAL dashboard for Kling credits | — | $0.00 |
| kling_std | image-to-video | FAIL: SKIPPED — Kling 2.5 i2v via FAL not activated. Check FAL dashboard. | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std text-to-video: SKIPPED — Kling 2.5 via FAL not activated. Check FAL dashboard for Kling credits.
- kling_std image-to-video: SKIPPED — Kling 2.5 i2v via FAL not activated. Check FAL dashboard.


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | FAIL: SKIPPED — Kling 2.5 via FAL not activated. Check FAL dashboard for Kling credits | — | $0.00 |
| kling_std | image-to-video | FAIL: SKIPPED — Kling 2.5 i2v via FAL not activated. Check FAL dashboard. | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std text-to-video: SKIPPED — Kling 2.5 via FAL not activated. Check FAL dashboard for Kling credits.
- kling_std image-to-video: SKIPPED — Kling 2.5 i2v via FAL not activated. Check FAL dashboard.


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std text-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"prompt":"A Nigerian man in traditional agbada walks through a sunlit market, cinematic slow motion, wide angle","duration":"5","seed":42,"aspect_ratio":"16:9"}}}]}


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"image_url":"https://storage.googleapis.com/falserverless/gallery/images/stock-photo-1.jpg","prompt":"Continue: same man continues walking, camera follows from behind, market stalls on both sides","duration


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std text-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"prompt":"A Nigerian man in traditional agbada walks through a sunlit market, cinematic slow motion, wide angle","duration":"5","seed":42,"aspect_ratio":"16:9"}}}]}


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std text-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"prompt":"A Nigerian man in traditional agbada walks through a sunlit market, cinematic slow motion, wide angle","duration":"5","seed":42,"aspect_ratio":"16:9"}}}]}


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"image_url":"https://storage.googleapis.com/falserverless/gallery/images/stock-photo-1.jpg","prompt":"Continue: same man continues walking, camera follows from behind, market stalls on both sides","duration


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std text-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"prompt":"A Nigerian man in traditional agbada walks through a sunlit market, cinematic slow motion, wide angle","duration":"5","seed":42,"aspect_ratio":"16:9"}}}]}


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body" | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL completed but no video URL found: {"detail":[{"type":"missing","loc":["body","prompt"],"msg":"Field required","input":{"input":{"image_url":"https://storage.googleapis.com/falserverless/gallery/images/stock-photo-1.jpg","prompt":"Continue: same man continues walking, camera follows from behind, market stalls on both sides","duration


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"loc":["body","image_url"],"ms | — | $0.00 |

**Total cost:** $0.00
**Passed:** 0/4
**Output dir:** storage/continuous-motion/test/

### Failures
- kling_std image-to-video: FAL completed but no video URL found: {"detail":[{"loc":["body","image_url"],"msg":"Failed to download the file. Please check if the URL is accessible and try again.","type":"file_download_error","url":"https://docs.fal.ai/errors#file_download_error","input":"https://storage.googleapis.com/falserverless/gallery/images/stock-photo-1.jpg"


---
## Session 1 Smoke Test — 2026-04-27

**Continuous Motion Foundation: 4-clip smoke test**

| Provider | Mode | Status | Output URL | Cost |
|----------|------|--------|------------|------|
| wan | text-to-video | FAIL: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models. | — | $0.00 |
| wan | image-to-video | FAIL: SKIPPED — Wan Pro i2v not activated on FAL account. | — | $0.00 |
| kling_std | text-to-video | PASS | https://v3b.fal.media/files/b/0a97e352/BLzzqp1xH4WL3uiJU-bs3_output.mp4... | $0.35 |
| kling_std | image-to-video | FAIL: FAL completed but no video URL found: {"detail":[{"loc":["body","image_url"],"ms | — | $0.00 |

**Total cost:** $0.35
**Passed:** 1/4
**Output dir:** storage/continuous-motion/test/

### Failures
- wan text-to-video: SKIPPED — Wan Pro not activated on FAL account. Enable at fal.ai/models.
- wan image-to-video: SKIPPED — Wan Pro i2v not activated on FAL account.
- kling_std image-to-video: FAL completed but no video URL found: {"detail":[{"loc":["body","image_url"],"msg":"Failed to download the file. Please check if the URL is accessible and try again.","type":"file_download_error","url":"https://docs.fal.ai/errors#file_download_error","input":"https://upload.wikimedia.org/wikipedia/commons/thumb/3/3a/Cat03.jpg/1280px-Cat
