# GioHomeStudio — Problems and Fixes Log

Use this file to record bugs, their root cause, and the fix applied.
When the same problem appears again, check here first before debugging from scratch.

---

## 0. Smart Builder character not appearing in list (2026-05-02)

**Problem:** Henry creates character via Smart Builder modal at `/dashboard/character-voices`. Character WAS saved to DB (`prisma.characterVoice.create`), but list only refreshed when user clicked "Done — Character Saved" button. Closing with X or clicking away → list looked empty next visit/refresh until reload.
**Root cause:** `handleBuild()` in `app/dashboard/character-voices/page.tsx` SmartBuilderModal called `setResult(data)` after successful POST `/api/character/smart-build`, but `onCreated()` callback (which reloads parent list) was only fired by the explicit Done button click. X close button only called `onClose()` without triggering refresh.
**Fix:** Two edits to `app/dashboard/character-voices/page.tsx`:
- L919 (handleBuild): added `onCreated();` immediately after `setResult(data);` so list refreshes the instant build succeeds
- L955 (X close button): changed onClick to `() => { if (result) onCreated(); onClose(); }` so closing also refreshes if a character was built
**Prevention:** Any modal that creates a DB row must fire parent-refresh callback at the moment of creation success, NOT only on explicit "Done" click. User can close any way they want — DB write already happened.

---

## 1. Narration truncated at 48s (assembly cuts audio short)

**Problem:** Assembled video had narration only for the first 48s, then silence for the remaining 120s+.
**Root cause:** The FFmpeg `amix duration=first` flag means audio ends when the video track ends. When the concatenated scene videos were shorter than the narration (e.g. 48s video + 173s narration), narration got cut.
**Fix:** Added Step 3.5 in `app/api/video/assemble/route.ts`: before mixing audio, check if narration > video + 2s. If so, loop the video with `-stream_loop -1 -t targetDur` to extend it to match narration length.
**Prevention:** Always verify final video duration vs narration duration after assembly.

---

## 2. Scene ID collision — videos mixed between projects

**Problem:** Both Bear Rescue Dog and Teddy & Dog use SC01–SC07 as scene IDs. When Bear Rescue Dog generated new videos on Apr 16, it overwrote the `video-registry.json` entries for SC01, SC03, SC05, SC06. Teddy & Dog then assembled with Bear Rescue Dog's videos.
**Root cause:** `video-registry.json` keyed by bare sceneId (SC01) — shared across all projects.
**Fix (Apr 17):**
1. `app/api/hybrid/scene-video/route.ts` line 324: now writes both `projectId_SC01` (scoped) AND `SC01` (bare, backwards compat).
2. `app/api/hybrid/video-registry/route.ts`: now accepts `?projectId=` param, returns scoped entries first, falls back to bare.
3. For Teddy & Dog: manually injected correct Apr 14-15 video URLs into localStorage project state via Playwright.
**Prevention:** Always use project-scoped keys in video registry. When testing, verify scene thumbnails in Assembly tab match the correct project before clicking Assemble.

---

## 3. Assembly API timeout in browser

**Problem:** Browser assembly "taking forever" — API route had no timeout set, defaulted to 60s.
**Root cause:** Next.js API routes default to 60s for Vercel-style deployments. FFmpeg assembly for 7-9 scenes with image slides takes 3-8 minutes.
**Fix:** Added `export const maxDuration = 900;` to `app/api/video/assemble/route.ts`.
**Prevention:** All heavy FFmpeg routes need explicit `maxDuration` set.

---

## 4. Telegram bot "Unauthorized" / "Bad Request UTF-8"

**Problem:** Node.js send-video script failed with "Unauthorized" then "strings must be encoded in UTF-8".
**Root cause 1:** Wrong bot token hardcoded (old token from memory).
**Root cause 2:** `Buffer.from(str, 'binary')` mangles emoji/UTF-8 text in multipart headers.
**Fix:** Use correct token from `AU AUTOMATION/.env` (`8796698914:AAG...`). Use `Buffer.from(str, 'utf8')`.
**Prevention:** Always read bot token from `.env`, never hardcode. Use utf8 encoding for text parts in multipart.

---

## 5. Bear Rescue Dog video > 50MB Telegram limit

**Problem:** Bear Rescue Dog assembled to 56MB — over Telegram bot's 50MB video limit.
**Fix:** Compress with `ffmpeg -c:v libx264 -b:v 1600k -c:a aac -b:a 128k` → 29MB.
**Prevention:** After assembly, check file size. If >48MB, compress before Telegram send.

---

## 6. Locked video files / FFmpeg process stuck

**Problem:** Some assemblies fail because `.mp4` files are locked by running FFmpeg.
**Fix:** `taskkill /F /IM ffmpeg.exe` to kill all stuck FFmpeg processes. Check `storage/video/temp/` for orphaned temp folders.
**Prevention:** Assembly API cleans temp dir on completion. If a request is cancelled mid-assembly, temp stays. Manual cleanup needed.

---

## 8. Silent audio / no narration in assembled video (sample rate mismatch)

**Problem:** Assembled videos had no narration or music — video was silent or only had raw AI video audio.
**Root cause:** AI-generated videos (Kling, Hailuo) output audio at 96kHz; Piper TTS outputs 22050Hz mono. FFmpeg `amix` silently fails when sample rates differ — catch block keeps `finalPath` unchanged, so narration/music never mixes in.
**Fix:** Added `aresample=44100` before all `amix` inputs in Steps 4, 5, 5b of `app/api/video/assemble/route.ts`.
**Prevention:** Always resample before `amix`. Check assembled video `audioSampleRate` — should be 44100, not 96000.

---

## 9. Music never included in assembly (selectedMusicUrl always null)

**Problem:** Assembly never included music because `selectedMusicUrl` state was null — user had to manually click music in the UI first.
**Fix:** Added auto-music-pick logic in `assembleScenes()` in `page.tsx`: if no music selected, fetch `/api/assets?type=music` and auto-pick a track based on project tone/genre from stock library.
**Prevention:** `selectedMusicUrl` is now always populated before assembly — auto-pick fallback uses stock library if user hasn't manually selected.

---

## 10. Stale audio from previous project carrying over on project load

**Problem:** Old character audio URLs from a previous project were being used in the new project's assembly because `if (data.characterAudioUrls?.length > 0)` only set state IF the new project had audio — it never cleared old state.
**Fix:** Changed all audio state loads on mount to always-set pattern: `setCharacterAudioUrls(data.characterAudioUrls || {})`, `setNarratorAudioUrl(data.narratorAudioUrl || null)`, etc.
**Prevention:** Always use `setX(data.x || default)` not `if (data.x) setX(data.x)` for audio state on project load.

---

## 7. Teddy & Dog narration only 3.47s

**Problem:** Old narration WAV file `narration_draft.wav` contained only a test sample.
**Fix:** Regenerated via `POST /api/hybrid/narrate-piper` with full story text → 34.5s WAV saved as `narration_teddy_dog_full_wav.wav`.
**Prevention:** Before assembly, verify narration file duration with ffprobe. Should be > 10s for any real story.

---

## 8. Assembled video outputs at 96000 Hz instead of 44100 Hz — narration not audible

**Problem:** Assembled video had `audioSampleRate: "96000"` even after adding `aresample=44100` to all `amix` filter chains. Narration was present but the sample rate mismatch caused playback issues and the fix appeared not to work.
**Root cause:** Step 5d in `app/api/video/assemble/route.ts` — loudnorm pass. FFmpeg's `loudnorm` filter internally upsamples audio to 96kHz for its analysis. Without an explicit `-ar 44100` output spec, the loudnorm pass re-encoded audio at 96kHz, overwriting the correctly-mixed 44100Hz narration track.
**Fix (Apr 17):** Changed the loudnorm step from:
```
"-af", "loudnorm=I=-14:LRA=7:TP=-1.5",
"-c:a", "aac", "-b:a", "192k",
```
to:
```
"-af", "aresample=44100,loudnorm=I=-14:LRA=7:TP=-1.5",
"-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2",
```
**Verification:** `check-audio` API now returns `audioSampleRate: "44100"` on assembled Teddy & Dog video.
**Prevention:** Any FFmpeg step that re-encodes audio must explicitly include `-ar 44100 -ac 2` to prevent rate drift. The loudnorm filter is known to upsample — always pin the output rate after it.

---

## 11. Ears check never showed in status bar after assembly

**Problem:** After assembly completed, the status bar never showed the ears check result (`🎧 Ears check…`). User saw nothing.
**Root cause 1:** `catch {}` swallowed all errors silently — if faster-whisper failed, no message appeared.
**Root cause 2:** The `else` branch (transcript present but short) fell through without setting any status message.
**Root cause 3:** Python path `"C:\\Users\\USER\\..."` used double backslashes in TypeScript string — worked but fragile. Changed to forward slashes `"C:/Users/USER/..."` which work on Windows and remove escape ambiguity.
**Fix:** Rewrote all branches in ears check (`page.tsx` lines ~2035-2060) to always call `setLastAction()`. Changed `catch {}` to `catch (earErr)` showing actual error. Added `!earData.ok`, `!earData.hasAudio`, and whisperError branches.
**File:** `app/dashboard/hybrid-planner/page.tsx`
**Prevention:** Never use empty `catch {}` on user-facing status updates. Always show something.

---

## 12. faster-whisper Python path using backslashes — ENOENT in some contexts

**Problem:** `spawn()` with `"C:\\Users\\USER\\..."` path worked in TypeScript but failed when path was passed through bash/node test contexts due to escape handling differences.
**Fix:** Changed to forward slashes `"C:/Users/USER/AppData/Local/Programs/Python/Python313/python.exe"` — works on Windows in all contexts.
**File:** `app/api/hybrid/check-audio/route.ts`
**Prevention:** Always use forward slashes for file paths in Node.js — Windows accepts them and it avoids escape issues.

---

## 13. assembly-builder.ts — narration_mix.mp3 referenced even when not created (mute video)

**Problem:** `final_merge` step added `narration_mix.mp3` as FFmpeg input whenever `assembly.narration.length > 0`, even if the `mix_narration` step was skipped (because no narration entry had an `audioUrl`). FFmpeg tried to open a file that didn't exist → assembly failed or produced silent video.
**Root cause:** Condition checked array length (`assembly.narration.length > 0`) instead of whether the step was actually built.
**Fix:** Added `narrationStepBuilt = steps.some(s => s.id === "mix_narration")` and `musicStepBuilt = steps.some(s => s.id === "prepare_music")`. Both `final_merge` guards now use step existence, not array length.
**File:** `src/lib/assembly-builder.ts`
**Prevention:** In multi-step FFmpeg pipelines, always guard file references by checking if the step that creates the file was actually added to the plan.

---

## 14. Character voices silent in assembled video (volume ducking kills them)

**Problem:** Assembly included narrator + character voices in `narrationList`, but character voices were inaudible in the final video.
**Root cause:** Sequential mixing loop in `assemble/route.ts` applied `volume=0.35` to the existing audio track on EVERY pass. So: narrator mixed in → bg ducked to 35%. Character voice 1 mixed in → entire mix (including narrator) ducked to 35% again. Result: voices progressively disappear.
**Fix:** Changed ducking logic — only the FIRST pass (narrator over music) ducks background to 0.35. Subsequent passes (character voices) use `bgVol = 1.0` to preserve all previously mixed audio.
**File:** `app/api/video/assemble/route.ts` lines ~610-632
**Prevention:** Sequential audio mixing must only duck music, not previously mixed voice tracks.

---

## 15. Character voices never generated before assembly (auto-pipeline missing step)

**Problem:** Auto-pipeline in `assembleScenes()` ran parse + narration but never ran `generateCharacterVoices()`. Stories with dialogue (Bear talks to Dog) had no character audio at assembly time.
**Fix:** Added auto-run of `generateCharacterVoices()` in the auto-pipeline block — triggers when: characters exist, story has dialogue segments, and no character audio has been generated yet.
**File:** `app/dashboard/hybrid-planner/page.tsx` — `assembleScenes()` auto-pipeline section
**Prevention:** Auto-pipeline must cover all 3 audio types: narrator, character voices, and music. Check all 3 before assembly starts.

---

## 16. Ghost state contamination — old project images/audio/video showing in new assembly

**Problem:** State from a previous project (old character voices, old scene videos, old scene images) leaked into a new project's assembly because localStorage was not cleared between projects.
**Root cause:** localStorage persists across page refreshes. If state wasn't explicitly reset on project load, old values remained.
**Fix 1 (GHS Claude):** DB-first restore — state now saves to `hybrid_saved_states` table and loads from DB on page load. Each project has its own state keyed by `localId`.
**Fix 2 (AUT Claude):** Added Clear Ghost Images, Clear Ghost Videos (with confirm), Clear Ghost Audio buttons in Scenes tab toolbar. Appear only when that state is present. Files are NOT deleted — only state is cleared.
**File:** `app/dashboard/hybrid-planner/page.tsx` — Scenes tab toolbar
**Prevention:** Use DB-keyed state per project. Never carry audio/video URLs across project boundaries without explicit re-assignment.

---

## 11. Hardcoded Windows paths blocking Linux migration

**Problem:** `check-audio/route.ts`, `narrate-piper/route.ts`, `translate/narration/route.ts`, `tts/route.ts` had hardcoded `C:/Users/USER/...` paths for Python and Piper binaries.
**Root cause:** Paths were written directly into source code during early dev.
**Fix:** Added `PYTHON_BIN` and `PIPER_BIN` to `.env`. All routes now resolve via env var → PATH fallback. On Linux, set `PYTHON_BIN=python3`, `PIPER_BIN=piper`.
**Prevention:** Never hardcode user-specific paths. Always use `process.env.X || "fallback"`.

---

## 17. Series Wizard narration audio generated but never stored

**Problem:** `generateSceneNarration()` called `/api/hybrid/narrate-piper`, got `data.audioUrl` back, showed a success status message — but never saved the URL into scene state. The audio was inaccessible, unplayable, and could not be used in assembly.
**Root cause:** Bug in the success branch — only `setLastAction()` was called, `updateScene()` was never called.
**Fix:** Added `updateScene(scene.sceneId, { narrationAudioUrl: audioUrl })` in the success branch. Added `narrationAudioUrl?: string` field to `SeriesScene` interface. Added inline `<audio>` player under each scene card when audio is present.
**File:** `app/dashboard/series-wizard/page.tsx` line 1069
**Prevention:** Whenever an API returns a URL result, always persist it into state immediately. Never assume setLastAction alone means the data is stored.

---

## 18. Music Studio generate tab silently failing

**Problem:** Music Studio "Generate" tab was calling `/api/music` with `{ description: genPrompt }` but the API schema required `{ prompt: ... }`. Every generation returned 400 Invalid Input silently.
**Root cause:** Wrong field name in fetch body — description vs prompt.
**Fix:** Changed fetch body to `{ prompt: genPrompt, genre, mood, durationSeconds, instrumental, tier, title, lyrics }`.
**File:** `app/dashboard/music-studio/page.tsx`
**Prevention:** Always match client fetch body field names against the API schema exactly. Test with a known-good input after any API change.

---

## 12. Character dialogue — one file per character instead of per-line clips

**Problem:** `generateCharacterVoices()` concatenated all dialogue per character into one audio file, placed at t=first scene. Bear's lines and Dog's lines played at scene 1 start, not at their actual scenes.
**Fix:** Added `generatePerLineVoices()` in page.tsx — generates one Piper TTS clip per dialogue segment. Assembly narrationList uses `seg.sceneId → sceneStartMap` to place each clip at the correct scene. Multiple lines within a scene are distributed evenly across scene duration.
**Prevention:** Always generate per-line clips for dialogue. Per-character concatenation was a temporary workaround.

---

## 19. AITierSelector — named import fails (it is a default export)

**Problem:** `import { AITierSelector } from "../../components/AITierSelector"` causes TS2614 — module has no exported member 'AITierSelector'.
**Root cause:** The component is exported as `export default function AITierSelector`. Named import syntax only works for `export function` or `export const`.
**Fix:** Use `import AITierSelector, { type AITier } from "../../components/AITierSelector"`.
**Files:** Any page that imports AITierSelector — use default import for the component, named import only for types.
**Prevention:** Check export style before importing. Default exports = no braces. Named exports = braces.

---

## 20. API routes cannot import "use client" components

**Problem:** `app/api/avatar/create/route.ts` imported `getModelForTier` from `AITierSelector.tsx`. TypeScript resolved the path but Next.js server routes cannot use client-only modules.
**Root cause:** `AITierSelector.tsx` has `"use client"` at the top. Server-side API routes are forbidden from importing client components.
**Fix:** Inlined `getModelForTier` directly in the API route as a pure function — maps `AITier → { provider, model }`. No import needed.
**Prevention:** Never import from a `"use client"` file in an API route. If a utility function is needed in both client and server, extract it into `lib/` with no client directive.

---

## 21. `@/app/components/...` path alias does not resolve

**Problem:** Import `from "@/app/components/AITierSelector"` caused TS2307 — cannot find module.
**Root cause:** `tsconfig.json` maps `@/*` → `./src/*`, not `./`. So `@/app/` resolves to `src/app/` which does not exist. The correct alias is `@app/*` → `./app/*`.
**Fix:** Use relative path `../../components/AITierSelector` from within `app/` subdirectories, or use `@app/components/AITierSelector` for the named alias.
**Prevention:** Check `tsconfig.json paths` before using `@/` aliases. Do not assume `@/` means project root in this codebase.

---

## 22. DurationPicker import — wrong relative depth

**Problem:** `movie-planner/page.tsx` and `series-wizard/page.tsx` used `../../../components/DurationPicker` (3 levels up) — resolved outside `app/`, causing module-not-found errors.
**Root cause:** Both files sit at `app/dashboard/[page]/page.tsx` — 2 levels from `app/components/`. Three `../` goes above `app/`.
**Fix:** Changed to `../../components/DurationPicker` (2 levels).
**Prevention:** Files at `app/dashboard/*/page.tsx` always use `../../components/` to reach shared components.

---

## 23. TypeScript: implicit `any` on DurationPicker onChange lambda

**Problem:** `onChange={(label) => setDuration(label)}` in movie-planner and series-wizard caused TS7006 — parameter 'label' implicitly has an 'any' type.
**Root cause:** DurationPicker's `onChange` prop is typed as `(label: string, seconds: number) => void` but TypeScript can't infer parameter types in inline lambdas without the explicit annotation in some contexts.
**Fix:** Added explicit type: `onChange={(label: string) => setDuration(label)}`.
**Prevention:** Always annotate inline lambda parameters when passing to component props with union or complex types.

---

## 24. GHS AI branding — real model names in UI

**Problem:** Free Mode showed "Claude Haiku" and "ChatGPT" as model labels. Series Wizard tier had `"premium_best"` with exposed provider names.
**Root cause:** Early implementation used real API provider names directly in the UI.
**Fix:** Replaced all visible labels with GHS tier names only:
- Local LLM → **GHS Free** / Standard
- Haiku → **GHS Pro 1**
- GPT-4o-mini → **GHS Pro 2**
- Sonnet → **GHS Premium**
- Opus → **GHS Best**
Badges: FREE / PRO 1 / PRO 2 / PREMIUM / BEST. Real model names only in backend `llmValue` field, never in UI text.
**Prevention:** Follow `lib/ghs-ai-tiers.ts` doctrine — NEVER expose real model names in any visible UI element.

---

## 25. Scene Forge — FAL lip-sync queue polling pattern

---

## 26. Auto-Creator missing magic chain — lip-sync not wired into flow

**Problem:** Auto Content Creator had narration (TTS) + music + FFmpeg assembly but had NO lip-sync step. The "magic chain" (script → voice → lip-sync → B-roll → music → assembly) was incomplete — it was just a slideshow generator, not a talking-head creator.
**Root cause:** The other Claude session built the draft/suggest/analyze pipeline but missed connecting `avatar/lip-sync` (FAL Hedra) into the auto-creator Step 6.
**Fix (Apr 18):** Added "🎭 Talking Head (Lip-Sync)" card to Step 6 of `app/dashboard/auto-creator/page.tsx`:
- User selects portrait from uploaded images
- Requires narration to be generated first
- Calls `/api/avatar/lip-sync` with portraitUrl + narrationAudioUrl
- On success, inserts the lip-synced video as Scene 1 in media assembly
- Full GHS gradient button with pink/violet glow
**Prevention:** Every mode that claims "magic chain" must explicitly include lip-sync step. Check blueprint: script → TTS → Hedra lip-sync → B-roll (optional) → music → FFmpeg.

---

## 27. Text on screen — no CapCut-style caption burn in GHS

**Problem:** GHS had no way to burn animated word-by-word captions onto videos (the popular TikTok/CapCut style that makes content more engaging). Text overlay designer existed but was manual.
**Root cause:** No Whisper transcription + ASS subtitle pipeline existed in GHS.
**Fix (Apr 18):** Built `/api/video/burn-captions/route.ts`:
1. Downloads video to temp
2. Extracts audio with FFmpeg → sends to OpenAI Whisper with `timestamp_granularities=word`
3. Groups words into 3-word display chunks
4. Generates ASS subtitle file with fade-in animations and 5 style presets (tiktok, bold_white, youtube, neon, minimal)
5. FFmpeg burns ASS onto video with `ass` filter
Also added "📝 Text on Screen" card to Step 7 (Polish) of auto-creator.
**Prevention:** Uses ASS format (not SRT) — ASS supports per-event fade and alignment. FFmpeg path escaping on Windows requires `assPath.replace(':', '\\:')`.

---

## 28. avatar/create route — bad AITierSelector import path

**Problem:** `app/api/avatar/create/route.ts` imported `getModelForTier` from `"../../components/AITierSelector"` — wrong relative path from an API route (resolves to wrong directory).
**Fix (Apr 18):** Linter auto-inlined the AITier type and getModelForTier function directly in the route file — removed the import dependency entirely. Now self-contained.

**Problem (reference):** FAL async jobs return `request_id` immediately, not the result. Polling must hit `{endpoint}/requests/{reqId}/status` then fetch result from `{endpoint}/requests/{reqId}`.
**Pattern used in:** `app/api/avatar/lip-sync/route.ts`
```
POST https://queue.fal.run/{endpoint}     → { request_id }
GET  .../requests/{reqId}/status          → { status: "COMPLETED" | "FAILED" | ... }
GET  .../requests/{reqId}                 → { video: { url } }
```
Result URL extraction: `result.video?.url ?? result.output?.video?.url ?? result.url`
Poll interval: 5s. Max polls: 60 (5 minutes).
**Prevention:** Never assume FAL returns a URL directly — always check for `request_id` first.

---

## 29. Review page — "20 stuck pipeline items" showing completed items

**Problem:** Review page showed all PENDING status content items as "stuck" — including ones that had already completed successfully. Created 20+ false alerts. No way to dismiss them.
**Root cause:** `/api/registry?status=PENDING&limit=20` returns ALL items with PENDING status. The review page treated every result as "stuck". But PENDING is also the initial status right after creation, so in-progress items and leftover failed items were all mixed together.
**Fix (Apr 18):**
1. Added `stuckItems` computed from `pendingItems` filtered by age: only items older than 30 minutes (`Date.now() - new Date(createdAt) > 30min`) are shown as stuck.
2. Added "Dismiss All" button that calls `PATCH /api/content/{id}` with `{ status: "FAILED" }` for each stuck item, then removes them from UI.
**Prevention:** PENDING = in-progress (normal). Never treat all PENDING items as stuck — always filter by age threshold.

---

## 30. Commercial page — invalid Tailwind color `#4040600`

**Problem:** The "↕️ Drag to reorder" hint text and "Add first slide" button in the commercial editor were using `text-[#4040600]` — a 7-character hex color, which is invalid CSS. The color was silently ignored (text rendered in default/inherited color).
**Root cause:** Typo — one extra `0` in the color hex string.
**Fix (Apr 18):** Changed `text-[#4040600]` → `text-[#404060]` in `app/dashboard/commercial/page.tsx` (2 occurrences).

---

## 31. Caption animation math bug — text drifts off screen after slide-up fade

**Problem:** In commercial videos, captions with `fade-up` animation would correctly slide up during the 0.35s animation window, but then continue drifting upward for the rest of the slide duration. By the end of a 5s slide, the caption was ~368px above its correct position (off-screen for bottom captions).
**Root cause:** The y-expression `60*(1-elapsed/fadeDur)` keeps evaluating after `elapsed > fadeDur`, producing increasingly negative y values that shift the caption up beyond the frame.
**Fix (Apr 18):** Changed the expressions in `src/modules/caption-compositor/index.ts` to use `between(t,st,fadeEnd)*...` which returns 0 after the animation window ends, locking the caption at y=0 (correct position) for the rest of the slide. Same fix for `fly-in-left` and `fly-in-right`.
**Prevention:** FFmpeg time expressions in overlay filters must be clamped. `between()` is the correct idiom for animation windows when the expression must evaluate to the "resting" value outside the window.

---

## 32. Music Video Planner — NarrationControls disconnected from assembly

**Problem:** Music Video Planner had a `NarrationControls` UI component and `narrationText` state, but `assembleMovie()` never converted the narration text to audio or passed it to the assembly API. Users could type narration but it had zero effect on the output. Also, no download button existed after assembly — only a video player.
**Root cause:** `assembleMovie()` was built for beat-sync only and narration was added to the Audio tab UI later without wiring it to the assembly pipeline. The `/api/music-video/assemble` route also had no `narrationUrl` parameter.
**Fix (Apr 18):**
1. Added `narrationUrl?: string` to `MvAssembleRequest` interface in `app/api/music-video/assemble/route.ts`
2. Added 3-stream FFmpeg mix: song (ducked to musicVolume) + narration (at 1.0 volume) using `amix=inputs=2:duration=first`
3. In `assembleMovie()` in `app/dashboard/music-video-planner/page.tsx`: if `narrationText.trim()` is non-empty, calls `/api/tts` first to get `narrationUrl`, then passes it to assembly
4. Added download `<a>` button below the assembled video player
**Prevention:** Whenever adding a UI control that feeds into a pipeline, immediately wire it to the pipeline function on the same day. Never leave state variables that are written but never read in the output path.

---

## 33. Scene Forge — new Talking Avatar pipeline (3 files, Apr 18)

**What was built:**
- `app/api/avatar/lip-sync/route.ts` — FAL Hedra character lip-sync with fal-ai/lip-sync fallback
- `app/api/avatar/create/route.ts` — Full 6-step async pipeline: Script (LLM) → Voice (TTS) → Lip-sync (FAL) → B-roll (FAL Wan, optional) → Music (Kie, optional) → FFmpeg assembly
- `app/dashboard/scene-forge/page.tsx` — Full UI: photo drop zone, URL input, 4 styles, duration/format, live step tracker, video playback, history grid

**Key patterns established:**
- Job polling: POST returns `{ jobId }`, UI polls `GET /api/avatar/create?jobId=xxx` every 2.5s
- Steps run async in background via IIFE — pipeline does not block the HTTP response
- B-roll and music run in parallel via `Promise.allSettled`
- `getModelForTier()` inlined in server route — never import `"use client"` components from API routes
- Music mixed at `volume=0.15` under avatar voice to avoid drowning speech

**Prevention:** FAL queue pattern: POST → `request_id` → poll status → fetch result. Never assume sync response.

---

## 34. Children Planner — full CSS/design overhaul (Apr 18)

**Problem:** Children Planner looked identical to every other dark professional planner — dark navy `#0e1318` background, grey muted text, purple corporate accent. No child-friendly visual identity.
**Fix:** Complete design overhaul — "Magical Storybook Studio" theme:
- **Background:** Deep midnight purple gradient `#1a0a38 → #0e1428` (nighttime magical)
- **childAccent:** Changed from corporate purple `#a855f7` → sunshine yellow `#FFD700`
- **New palette:** coral pink `C2 = #FF6B9D`, warm orange `C3 = #FF8C42`, sky blue `C4 = #48CAE4`, teal `childSafe = #00E5CC`
- **Hero header:** Rainbow top bar stripe, 📚 emoji with gold glow, gradient text title, floating stars, mood badge chips
- **Tab bar:** Each tab has its own signature color (yellow/orange/pink/purple/blue/mint/teal/hot pink/lime) with glow shadow on active
- **Stats grid:** Replaced plain text numbers with 4 glowing colored emoji bubbles
- **Cards:** Translucent purple with glowing borders and box-shadow
- **Demo Scene Gallery added** to Overview tab: 5 children images (child_abc.png, child_colors.png, child_counting.png, child_nursery.png, child_story.png) served from `/api/media/demo/` + 5 hover-to-play demo videos below
- **Quick Links:** Colorful bordered tiles replacing plain dark buttons

**File:** `app/dashboard/children-planner/page.tsx`
**Prevention:** Any section targeting children must use warm bright colors, large emoji, playful shapes. Dark corporate defaults are always wrong for children's content.

---

## 35. Dashboard Recent Projects shows FAILED/PENDING junk instead of rendered videos

**Problem:** "Recent Projects" on dashboard homepage showed old FAILED (FREE mode) or stuck PENDING items instead of actual rendered videos, because `/api/registry?limit=5` returned all items sorted by `createdAt` DESC with no status filter — and many FREE mode items had newer `createdAt` dates than commercial renders.
**Root cause:** No filter applied to registry fetch. The most recently *created* items were failed pipeline attempts, not completed renders.
**Fix:**
- Added `renderedOnly` param to `listContentItems()` in `src/modules/content-registry/index.ts`: adds `where.mergedOutputPath = { not: null }` so only items with a video file are returned.
- Added `renderedOnly` query param support to `app/api/registry/route.ts`.
- Changed dashboard fetch to `/api/registry?limit=5&renderedOnly=1`.
- Result: dashboard now shows only successfully rendered videos (COMMERCIAL/FREE mode IN_REVIEW or APPROVED).
**Prevention:** Always filter dashboard "recent" views to rendered content — PENDING/FAILED are noise.

---

## 36. Collaborative Editor — Outro button blocked by Intro dropdown label

**Problem:** In the Collaborative Editor's small list (Scenes panel), clicking "+ Outro" was blocked when the "+ Intro" dropdown was open. The Intro dropdown's `<label>` element (position: absolute, z-index: 20) overlapped the Outro button, intercepting pointer events.
**Root cause:** Intro dropdown uses `position: absolute; z-index: 20` which extends below its container and covers sibling elements (including the Outro button) that had no z-index set.
**Fix:**
1. Added `zIndex: 25` to the Outro container div so it creates a stacking context above the Intro dropdown.
2. Added `data-intro-menu` / `data-outro-menu` attributes to both containers.
3. Added `useEffect` with `document.addEventListener("mousedown")` click-outside handler that closes both menus when clicking anywhere outside them.
**File:** `app/dashboard/collaborative-editor/page.tsx` (lines ~251-266, 1560, 1619)
**Prevention:** Dropdown menus that use `position: absolute` must have a click-outside handler. Sibling elements after a dropdown container should have explicit z-index to avoid being covered.

## 37. Collaborative Editor — Multiple critical bugs + UI overhaul (Apr 18)

**Problems:**
1. `saveVersion` stale closure — always saved old assembly state (the one from the last render)
2. `assemble()` re-edit broken — check `!sourceUrl.startsWith("/api/media/")` was inverted, so assembled segment NEVER got added for normal video/image imports
3. `importFile` useCallback with `[]` deps captured stale `activeSegIdx` and `importMode`
4. Drag-and-drop broken on Firefox — missing `e.dataTransfer.setData('text/plain', ...)` in onDragStart
5. Right panel unreadable — 7-9px fonts throughout, 16 SFX buttons packed together
6. Project title not editable from editor UI
7. "Send to Video" button had no processing feedback

**Root causes:**
1. `saveVersion` was not wrapped in `useCallback` and read `assembly` directly from closure (React state not yet updated when called after `updateAssembly`)
2. The assembled-segment insertion check was `!sourceUrl.startsWith("/api/media/")` but all imported files DO start with `/api/media/`, so the condition was never true for normal imports
3. `useCallback(..., [])` with empty deps freezes all closure variables at component mount
4. HTML5 drag requires `setData` to be called in `dragstart` event for the drag to work in Firefox/Chrome
5. Fonts were 7-9px — below readable threshold on most monitors

**Fixes:**
1. Added `assemblyRef` (useRef + useEffect sync) — `saveVersion` now reads `assemblyRef.current` for always-fresh state
2. Added `activeSegIdxRef` and `importModeRef` — `importFile` uses refs instead of closure values
3. Fixed assemble(): now finds existing `seg_assembled` by ID and updates it, or inserts new one if not found
4. Added `e.dataTransfer.setData("text/plain", String(i))` and `e.dataTransfer.dropEffect = "move"` to drag handlers
5. Increased all right panel fonts to 10-12px, section headers to 12px bold
6. Made project title an editable `<input>` in the top bar (auto-saves on blur)
7. Added `setProcessing(true/false)` and `saveVersion` call to "Animate" (formerly "Send to Video") button

**File:** `app/dashboard/collaborative-editor/page.tsx`
**Prevention:** Always use `useRef` for values that need fresh state in stale-closure contexts. Never check `sourceUrl.startsWith(...)` to determine if a segment is assembled — check `id === "seg_assembled"` instead.


## Karaoke Analysis Error — 2026-04-27T06:48:47.928Z
**Recording:** a0ce3097-37f4-4860-aae4-7c6a3dbcd7ca
**Error:** Python exited with code 1. stderr: C:\Users\USER\Desktop\CLAUDE\giohomestudio\scripts\karaoke_analyze.py:106: UserWarning: PySoundFile failed. Trying audioread instead.
  y, sr = librosa.load(audio_path, sr=None, mono=True)
C:\Users\USER\AppData\Local\Programs\Python\Python313\Lib\site-packages\librosa\core\audio.py:184: FutureWarning: librosa.core.audio.__audioread_load
	Deprecated as of librosa version 0.10.0.
	It will be removed in librosa version 1.0.
  y, sr_native = __audioread_load(path, offset, duration, dtype)

**Stderr:** 


## Karaoke Analysis Error — 2026-04-29T21:44:04.615Z
**Recording:** 7aaea769-9fa9-4339-a49d-4c0d6e21b4fe
**Error:** Python exited with code 1. stderr: C:\Users\USER\Desktop\CLAUDE\giohomestudio\scripts\karaoke_analyze.py:106: UserWarning: PySoundFile failed. Trying audioread instead.
  y, sr = librosa.load(audio_path, sr=None, mono=True)
C:\Users\USER\AppData\Local\Programs\Python\Python313\Lib\site-packages\librosa\core\audio.py:184: FutureWarning: librosa.core.audio.__audioread_load
	Deprecated as of librosa version 0.10.0.
	It will be removed in librosa version 1.0.
  y, sr_native = __audioread_load(path, offset, duration, dtype)

**Stderr:** 


## Karaoke Analysis Error — 2026-05-01T18:19:03.684Z
**Recording:** 7aaea769-9fa9-4339-a49d-4c0d6e21b4fe
**Error:** Python exited with code 1. stderr: [WARN] soundfile read failed: Error opening 'storage\\karaoke\\7aaea769-9fa9-4339-a49d-4c0d6e21b4fe.webm': Format not recognised. � falling back to librosa
C:\Users\USER\Desktop\CLAUDE\giohomestudio\scripts\karaoke_analyze.py:126: UserWarning: PySoundFile failed. Trying audioread instead.
  y, sr = librosa.load(audio_path, sr=None, mono=True)
C:\Users\USER\AppData\Local\Programs\Python\Python313\Lib\site-packages\librosa\core\audio.py:184: FutureWarning: librosa.core.audio.__audioread_load
	Deprecated as of librosa version 0.10.0.
	It will be removed in librosa version 1.0.
  y, sr_native = __audioread_load(path, offset, duration, dtype)
[WARN] librosa load also failed: 

**Stderr (full):** 

---

## PHASE-MAX-IMAGE-HYBRID — Use Max Image opt-in ported to hybrid-planner (2026-05-08)

**Feature:** Port "Use Max Image" opt-in UX from children-planner to hybrid-planner Assembly tab.
**Files touched:**
- `app/dashboard/hybrid-planner/page.tsx`

**Changes made:**
1. **State added (line ~386):** `const [useMaxImageScenes, setUseMaxImageScenes] = useState<Set<string>>(new Set())` — sibling to `selectedBeatImages`.
2. **DB restore (line ~719):** Added restore for `sceneBeatImages`, `selectedBeatImages`, and `useMaxImageScenes` (Set hydrated from Array). These were NOT persisted before this change.
3. **DB save payload (line ~754):** Added `sceneBeatImages`, `selectedBeatImages`, `useMaxImageScenes: Array.from(useMaxImageScenes)` + added all three to the `useEffect` deps array.
4. **Assembly loop (line ~3152):** Changed from auto-expand ANY scene with >1 beats to OPT-IN only. Beat expansion now gated behind `useMaxImageScenes.has(s.sceneId)`. Single-image fallback: `userOptedIntoMax && tickedBeats.length === 1 ? tickedBeats[0] : imageUrl : allBeatImgs[0]`.
5. **Assembly tab beat strip (line ~6249):** Replaced old auto-shown beat strip with opt-in pattern: orange "Use Max Image (N)" toggle button + collapsible "Pick which images to include" panel with Select All / Deselect All + per-beat checkboxes. Only visible when `sceneBeatImages[sceneId].length > 1`.

**Scene Board beat strip (line ~5678):** NOT changed — auto-shown for editing, as intended.

**TSC:** `npx tsc --noEmit` exit 0. No errors.
**Rollback:** Revert `useMaxImageScenes` state/persist/assembly-loop/UI changes in `hybrid-planner/page.tsx`. Assembly loop falls back to old auto-expand behavior by removing the `userOptedIntoMax` gate.

---

## MCD-TIER-UI-MERGE (2026-05-08)

**Task:** Merge MCD tier config from `ghs-sound-tiers.ts` into movie-planner Voice tab. ONE tier picker bundles narrator TTS + music + multi-cast dialogue + lipsync. ⓘ More popover per tier. MCD button reads active tier's config automatically. Auto-lipsync after dialogue gen when tier enables it.

**Files touched:**
- `app/dashboard/movie-planner/page.tsx` — all changes

**Changes made:**
1. **Import** (line ~18): Added `getSoundTier`, `soundTierToMCDConfig`, `GhsSoundTierId` from `@/lib/ghs-sound-tiers`.
2. **Mapping helper** (line ~183): Added `movieTierToGhsSoundTierId(id: SoundTierMovieId): GhsSoundTierId` — bridges old SOUND_TIERS_MOVIE ids (`piper`/`ghs_karaoke`/`fal_karaoke`/`kie_classic`/`kie_premium`) to canonical ids (`ghs-sound`/`ghs-plus`/`ghs-pro`/`ghs-premium`).
3. **State** (line ~355): Added `openTierInfo: SoundTierMovieId | null` for popover open/close.
4. **Tier selector popover** (SC Sound Model card): Each tier button now wrapped in `position:relative` div. Small `i` button in top-right corner opens a floating panel showing `mcdLabel`, `quality`, `estCostPer100s`, and `includes[]` bullet list from `getSoundTier()`. Click-outside overlay at z-index 199 closes it.
5. **MCD button — tier-driven provider**: Before dialogue generate loop, calls `soundTierToMCDConfig(movieTierToGhsSoundTierId(effectiveSoundTier))`. Passes `mcdCfg.ttsProvider` as `provider` in the `/api/dialogue/generate` POST body (overrides old `effectiveNarrationProvider`).
6. **Auto-lipsync pass**: After dialogue loop, when `mcdCfg.lipsync !== "off"`, iterates scenes that have BOTH newly-generated dialogue audio AND an existing `sceneVideos[sceneId]`. Fires sequential POSTs to `/api/avatar/lip-sync`. Updates `sceneVideos` state on success, skips (log only) on failure, updates `lastAction` with `Auto-lipsync N/M` progress.
7. **Button label**: Changed from `🎭 Multi-Cast Dialogue` to `🎭 Generate Dialogue (${mcdCfg.label}, ${mcdCfg.estCostPer100s}/100s)`.
8. **Legacy button restyled**: Smaller padding, grey/transparent border, muted color, opacity 0.7, added caption below: "Old single-voice path. Replaced by Multi-Cast above for proper character voices."

**Rollback path:** Revert the 8 edits above in `movie-planner/page.tsx`. No API routes, no DB schema, no other files touched. The old `effectiveNarrationProvider` was the only provider field — restoring its usage in the generate body reverts step 5. Deleting the IIFE wrapper around the MCD button restores step 4-7.

---

## 38. Character voices always default to Lessac regardless of gender (2026-05-15)

**Problem:** Every character in Character Voices section showed "Lessac (Neutral Male)" even for female characters. No other Piper voices (Amy, Ryan, LibriTTS) were ever auto-selected.
**Root cause:** `characterPiperVoices` state starts as empty `{}`. The voice dropdown at line 8938 falls back to `"en_US-lessac-medium"` when no entry exists. No code ever auto-populated the state on character detection — so every character hit the Lessac fallback.
**Fix:** Added auto-assign logic at both character detection call sites (lines 1137 + 1156 in `page.tsx`). After `setCharacters()`, immediately calls `setCharacterPiperVoices(prev => ...)` mapping each character's `gender` field: female → Amy, male narrator → LibriTTS, male → Ryan, unknown → Lessac. Does NOT overwrite entries the user already manually set (uses `{ ...auto, ...prev }` merge order).
**Files:** `app/dashboard/hybrid-planner/page.tsx` — two locations where setCharacters is called in expandStory().
**Prevention:** Any time characters are detected/set, always auto-assign voices. Never leave `characterPiperVoices` empty — it will always fall back to Lessac in the render loop.

---

## 39. Generate Per-Line Voices — all lines spoken in Lessac even with different voices selected (2026-05-15)

**Problem:** Even after manually selecting different Piper voices per character in the UI, clicking "Generate Per-Line Voices" produced all clips in the same Lessac voice.
**Root cause:** Same root cause as #38 — `characterPiperVoices` was empty `{}` when characters were detected. The UI showed "Lessac" in the dropdown (the hardcoded fallback), and `generatePerLineVoices()` at line 2771 reads `characterPiperVoices[char.characterId] || "en_US-lessac-medium"` — which always resolved to Lessac because the map was empty.
**Fix:** Fix #38 resolves this — once voices are auto-assigned on character detection, `characterPiperVoices` is populated and both the UI and the generate function use the correct voices.
**Prevention:** Voice generation functions must never silently fall back to a default without showing that fallback in the UI. The UI fallback and the generation fallback must be identical.

---

## 40. Scene edit panel — no way to give AI a custom instruction (2026-05-15)

**Problem:** The scene edit panel in the Story tab had 5 predefined polish buttons (Polish, Add Action, Make Intense, Reduce Action, Make Emotional) but no way for the user to type a custom instruction (e.g. "add rain", "make it funnier", "cut to 2 sentences").
**Root cause:** `polishSceneText()` only accepted hardcoded modes. No text input existed in the edit panel UI.
**Fix:**
1. Added `"custom"` mode to `PolishMode` type in `app/api/hybrid/scene-edit/route.ts`. `runPolish()` now accepts `customInstruction?: string` — when mode is "custom", uses the instruction string as the AI goal instead of a predefined intent.
2. Added `storyEditAiQuery: Record<string, string>` state for per-scene query text.
3. Added `polishSceneCustom(scene)` function that reads the query and calls scene-edit API with `polishMode: "custom"`.
4. Added text input + "Ask AI" button row between the action buttons and Save/Cancel in the scene edit panel. Enter key also triggers the AI call.
**Files:** `app/api/hybrid/scene-edit/route.ts`, `app/dashboard/hybrid-planner/page.tsx`.
**Prevention:** Any AI action UI that has predefined modes should also expose a free-text fallback.

---

## 41. Story QC Suggested Fixes — no Fix buttons (2026-05-15)

**Problem:** The QC panel showed "Suggested Fixes" as a plain text list with no way to apply them. User had to manually edit each scene based on the suggestion.
**Root cause:** UI was display-only. No action buttons or handler functions existed.
**Fix:**
1. Added `fixingQC: boolean` state (loading gate).
2. Added `fixQCSuggestion(suggestion)` — loops through all scenes sequentially, calls scene-edit API with `polishMode: "custom"` and the suggestion as `customInstruction`, applies result via `updateScene()`.
3. Added `fixAllQCSuggestions()` — runs all suggestions in sequence by calling `fixQCSuggestion` for each.
4. Updated Suggested Fixes UI: header row now has "Fix All" button; each suggestion row has an individual "Fix" button. Both buttons are disabled when no scenes exist or fix is in progress.
**Files:** `app/dashboard/hybrid-planner/page.tsx`.
**Prevention:** Any AI output that suggests actions must have a clickable "Apply" path. A list of suggestions with no way to act on them is a dead-end UX.

---

## 42. Images / intro / outro not assembled — 0-byte clips from ffmpeg overload (2026-05-28)

**Problem:** Hybrid assembled video showed almost no scene images; intro and outro cards did not display; image display was "bad". Henry's live render (`ghs_hybrid_default_1779995437083`): only `clip_seg_0` (intro) + `clip_seg_1` were valid; segs 2–11 were 6873-byte solid placeholders; segs 12–69 were **0 bytes**.
**Root cause:** `preprocessSegments()` in `app/api/assembly/execute/route.ts` fired one ffmpeg per segment SIMULTANEOUSLY via an unbounded `Promise.all`. A Gen-Max hybrid story expands to 50–70 image segments. 70 concurrent ffmpeg processes saturated the 4-core VPS; most hit the 60s per-clip timeout and were KILLED mid-write → 0-byte output files → rejected by the `>2000` size check → dropped from the concat list. The outro is a high-numbered segment, so it died too → "outro didn't display".
**Fix:** Added a bounded-concurrency `mapPool(items, limit, fn)` worker pool; `preprocessSegments` now runs **4** ffmpeg jobs at a time instead of all at once. 70 images ≈ 30–40s without CPU saturation, so every clip (incl. solid placeholders) finishes.
**Verification:** `scripts/verify_assembly_concurrency.mjs` — 18-segment assembly (intro + 16 real images + outro) → 18/18 assembled, **0 zero-byte clips**, final mp4 2.68MB.
**Prevention:** NEVER fan out N external-process (ffmpeg/whisper/etc.) jobs with unbounded `Promise.all` on the VPS. Cap concurrency to ~core-count. A 0-byte output file is the signature of a killed/timed-out child process — size checks must reject it AND a serial fallback must regenerate it.

---

## 43. Mixed mode plays only actor voices — narrator silently dropped (2026-05-28)

**Problem:** In a "mixed" hybrid story, the assembled video played only character/actor dialogue voices; all narration was missing (Henry: "actor voice was heard, narration style ignored").
**Root cause:** `app/dashboard/hybrid-planner/page.tsx` assembly builder dropped the narrator track entirely when `storyMode === "mixed" && hasPerLineClips` (`skipNarratorDueToActors`), out of a (mistaken) fear of "all voices at once". But the narrator file is generated from narration-type text ONLY (`generateNarrationPiper` → `allScenesNarration`, which excludes dialogue per BUG-16a). Narrator (narration passages) and actor clips (dialogue lines) are COMPLEMENTARY, not overlapping — so dropping the narrator just deleted all narration from mixed videos.
**Fix:** Removed the `skipNarratorDueToActors` gate. Narrator now plays in both narration-only AND mixed mode (only excluded in actors-only). Actor per-line clips still layer on top for dialogue.
**Prevention:** Before muting/dropping an audio track to avoid "overlap", confirm the two tracks actually cover the same text. Here they never did.
