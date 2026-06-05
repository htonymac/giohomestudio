# GioHomeStudio — Problems and Fixes Log (Public)

Bug history in reverse-chronological order. Symptom / root cause / fix / commit / prevention rule.
Check this file **first** before debugging any issue — most failure modes have been seen before.

---

## 2026-06-03 — FIXED (`44e7bca`): Font size path gap + hardcoded studio name + learning-mode voice routing

**Symptoms:**
- Subtitle font size picker had no visible effect on per-scene PNG path.
- Intro/outro title showed a hardcoded studio string that could not be changed.
- Phonics/learning content used a storytelling voice cadence (wrong pacing).

**Root causes:**

1. `app/api/video/assemble/route.ts` called `generateSubtitlePng(text, file, "bottom", 52, subCfg)` at 4 sites with the literal `52` as the `fontsize` positional argument. `subCfg.fontSize` was passed but the function never reached it — the positional arg won. Only the chunked caption path read `subCfg.fontSize` correctly.

2. The studio name `"GIO HOME AI STUDIO"` was hard-coded in 5 separate string literals (intro gen body, outro gen body, screenplay tab preview top, screenplay tab preview footer). No user-editable field existed.

3. `children-planner/page.tsx` had no voice routing based on `learningMode`. Every content type used the same Piper voice regardless of educational vs storytelling intent.

**Fixes:**

1. `app/api/video/assemble/route.ts` — new `perSceneFontSize` variable (~line 165) clamped 18–120, default 52. All 4 `generateSubtitlePng` call sites now pass `perSceneFontSize`.

2. `app/dashboard/children-planner/page.tsx` — new `studioName` state with the original string as default (backward compatible). Editable via input in Story Credits card. Saved via `flushCurrentProject` / restored on load. Injected at all 5 literal sites.

3. New `pickPiperVoice()` routes by `learningMode`:
   - `phonics / word / video_lesson` → `en_GB-alan-medium`
   - `read_along` → `en_US-libritts_r-medium`
   - `storybook / poem / sentence` → `en_US-amy-medium`
   Wired into 3 `/api/tts` body construction sites.

**Prevention:** Any font-size / style setting passed through a function call must be verified as the **actual used argument**, not an earlier positional override.

---

## 2026-06-03 — TAGGED `v2026-06-03-stable` at `f14e9c7`

Snapshot taken after the 10-fix audit ship. Includes all 10 Sonnet audit fixes, action-images fix, `ANDIO_MUST_READ.md`, and `CLAUDE.md` READ-FIRST block. Roll back with `git checkout v2026-06-03-stable`.

---

## 2026-06-03 — FIXED (4 commits `8ec0831`, `57e21db`, `c209d55`, `12c042c`): 10-fix audit-driven ship — assembly stuck at 99% + silent narration + pacing desync

**Symptom:** Assembly stuck at 99% for 10+ minutes. Narration audio silently shipped as a 30-second beep placeholder (`_silent.mp3`). Pacing narration never worked on Linux. Confirmed: 39 silent placeholder files on the live server = 25% failure rate.

**Root causes (one interconnected cascade):**

1. Default ASS subtitle font `Arial Black` is not installed on Linux. `libass` silently fell back to `drawtext` on every assembly.
2. `drawtext` fallback ran at ffmpeg's default `medium` preset — 5× slower than `ultrafast`. 980 `drawtext` filters on long captions = 10-min stall.
3. `perSegmentDuration` was derived from a text-length estimate (~3 words/sec), not the probed audio duration (~1.5–2 words/sec for real TTS). Segments rendered at 30–60s while audio ran 5+ minutes → 99% stuck waiting for a duration that would never arrive.
4. `/api/tts` returns `engine="placeholder"` when all TTS tiers fail — writes a 30s silent `_silent.mp3`. Client treated it as a successful response and stored it as `narratorAudioUrl`.
5. `generatePacingNarration()` set only `pacingAudioUrl`. Main `assembleMovie()` saw `narratorAudioUrl=null`, fired a second TTS call. The pacing timing referred to the first audio; the assembled narration was the second. Desync.
6. `/api/hybrid/narrate-piper` had a hardcoded 120s timeout — same class as the `/api/tts` fix below but missed in that pass.
7. `/api/children/generate-narration` Piper fallback called `http://localhost:5000/tts` — a Windows-only daemon, always 502 on Linux.
8. `scripts/assemble_job_worker.mjs:24` had a hardcoded `STORAGE_PATH` — would silently misroute on env change.

**Fixes:**

| # | Commit | File:line | Change |
|---|---|---|---|
| 1 | `8ec0831` | `assemble/route.ts:1011` | Font `Arial Black → DejaVu Sans` |
| 5 | `8ec0831` | `assemble/route.ts:1093,1108` | Drawtext preset `ultrafast`; timeout 180s → 300s |
| 2 | `57e21db` | `page.tsx:2235–2245` | `perSegmentDuration` uses `_totalNarFromProbe` (ffprobe) not text estimate |
| 3 | `57e21db` | `page.tsx:1956,2218,2733,6101` | 4 TTS call sites reject `engine==="placeholder"` |
| 4 | `57e21db` | `page.tsx:2580` | `generatePacingNarration` also calls `setNarratorAudioUrl` |
| 6 | `c209d55` | `narrate-piper/route.ts:187` | Spawn timeout scales: `clamp(60s, 10min, text.length * 500ms)` |
| 7 | `c209d55` | `generate-narration/route.ts:124` | Piper fallback calls `/api/tts` not `localhost:5000` |
| 8 | `12c042c` | `assemble_job_worker.mjs:25` | Reads `STORAGE_PATH` env, fallback to relative path |
| 10 | `12c042c` | New routes | `/api/storage/list`, `/api/storage/delete`, `/dashboard/storage-cleanup` |

**Prevention:** No silent `catch {}` blocks in TTS / subtitle / narration paths. Every tier must `console.error` with the actual failure reason. Client must reject `engine==="placeholder"` responses. Add a regression test: POST 3000-char text, assert `engine != placeholder`.

---

## 2026-06-03 — FIXED (`c83357d`): Subtitle font size picker — 4 presets + custom 18–120 px

**Symptom:** Subtitle Font Size picker (Small/Medium/Large/XL) had no visible effect. Mode presets (e.g., `kids` = 54px) locked the subtitle size; user-supplied `subtitleConfig.fontSize` was ignored.

**Root cause:** `app/api/video/assemble/route.ts` resolved font size as `preset?.size ?? subCfg?.fontSize`. The mode preset always won; user choice was only the fallback.

**Fix:** Order swapped: `subCfg?.fontSize (if 18–120) ?? preset?.size ?? 54`. Default raised 36 → 54. Feeds both the ASS Style line (line 1068) and the `drawtext` fallback.

**New UI:** 4 preset pills (Small 36 / Medium 54 / Large 72 / XL 96) + numeric input accepting any integer 18–120. Saved to `subtitleConfig.fontSize` → `effectiveSubtitleConfig` → assemble payload.

---

## 2026-06-03 — FIXED (`bbf4135`): Assembly stuck at 99% — ASS timeout 120s, drawtext fallback ran 5–10 min

**Symptom:** Assembly progress bar pegs at 99% for 5–10 minutes on long videos. FFmpeg was running the `drawtext` filter chain — meaning the faster ASS path had silently failed.

**Root cause:** `app/api/video/assemble/route.ts` ASS-path `execFile` timeout was hardcoded at 120,000ms. A 98-segment / 400-second video takes 90–180s for the ASS encode on a modest CPU. The call was killed at 120s → silent catch → `drawtext` fallback fires → 300–600s caption step.

**Fix:** ASS timeout 120s → 600s. Explicit `-c:v libx264 -preset ultrafast -crf 23` on the ASS pass. ASS-fail log promoted `console.warn → console.error` so regressions are visible in `journalctl`.

---

## 2026-06-03 — FIXED (`8807b18`): BIB-class regression #4 — Piper timeout 30s for any text length

**Symptom:** Children narration audio showed 0:30 duration. Story was 2+ minutes long. Audio file was written as `tts_<ts>_silent.mp3` — the 30s sine placeholder.

**Root cause:** `/api/tts/route.ts` line 120 had `setTimeout(..., 30000)`. Long stories (5000+ chars) take 60–120s for Piper to synthesise on a server CPU. After 30s the timer fired and killed Piper mid-synthesis. The `catch` block was completely silent (`catch { /* Piper failed */ }`). The request fell through all tiers to the silent-placeholder branch at line 288.

**Why BIB #4:** Earlier fixes (commits `b4d8092` + `49f353d`) addressed the **path** to the Piper binary. This is a different entry into the same silent-placeholder branch — timeout instead of missing files.

**Fix (`8807b18`):**
1. Piper timeout scales: `clamp(60_000, 600_000, text.length * 500)` ms.
2. All silent catches in `/api/tts` replaced with explicit `console.error/warn`.
3. Piper stderr captured and included in the reject message.

**Prevention (BIB #5):** anyone changing `/api/tts` must NOT add silent `catch {}` blocks. Add a regression test: POST 3000-char text, assert `engine != placeholder`.

---

## 2026-06-02 — FIXED (`32e450f`): Generate button stuck as "Generating..." permanently after error

**Symptom:** Generate/Regen button on children scene card showed "Generating..." permanently after any API error (502, 500, or 200+error body). The button could not be clicked again without a page refresh.

**Root cause:** `generateSceneBoardImage()` in `app/dashboard/children-planner/page.tsx` had `setGeneratingSceneImage(null)` AFTER the try/catch block. Two `return` statements inside `try` (L1487, L1493) bypassed this cleanup — the function exited early, leaving `generatingSceneImage === sceneId` permanently set.

**Fix (`32e450f`):** Changed post-block cleanup to a `finally {}` block, which runs on all exit paths — normal return, early return, and exception.

**Prevention:** Any function that sets a loading-state flag MUST use `finally` for the cleanup, not a plain statement after try/catch.

---

## 2026-05-31 — FIXED (`d9432d8`): Assemble button stays grey on reopened project

**Symptom:** Assemble button disabled ("Select scenes above to assemble") even though scene cards were rendered on page load.

**Root cause:** Restore effect (`app/dashboard/children-planner/page.tsx` L2710) hydrated `childScenes` from the database but never re-set `assemblySelectedIds`. The Assemble button is gated by `assemblySelectedIds.length === 0`. Auto-selection only ran inside the `planScenes` paths (L1208 + L1372), not on a saved-state restore.

**Fix (`d9432d8`):**
1. On restore, auto-select all `childScenes` (mirrors the `planScenes` pattern).
2. Persist `assemblySelectedIds` + `assemblyMediaPrefs` in the save payload so manual deselections survive across sessions.

**Prevention:** When restoring upstream state, audit "what gate conditions depend on what I just restored?" and restore those too, or move auto-selection into a `useEffect` watching the upstream state.

---

## 2026-05-30 — FIXED (`6793682`): Scene-card modifier buttons appeared to fire nothing

**Symptom:** 7 modifier buttons (Polish / Funny / Playful / Adventure / Emotion / Action / Establish) clicked but produced no visible change. Only Polish "worked".

**Root cause:** `handleChildSceneOp` updated only `visualDescription` in local state — never regenerated the scene image. `handlePolishScene` (used by the Polish button) did auto-regen, which is why only that button appeared to work.

**Fix:** Mirror `handlePolishScene`'s pattern — capture `updatedScene` from the `setChildScenes` callback and call `await generateSceneBoardImage({ ...updatedScene, visualDescription: newText })` after every modifier.

---

## 2026-05-30 — FIXED (`0046a6b`): Establishing shots stored but never reached the rendered video

**Symptom:** Establishing Shot panel planned and rendered shots, but the final assembled video did not include them.

**Root cause:** `assembleVideo()` built `assemblyScenes` from `scenesToAssemble` without consulting `establishingShotsChild`.

**Fix:** Mirror hybrid's `withEstablishing` insertion. After the main scene loop, prepend an `img:` segment before each scene that has a rendered `establishingShotsChild[sceneId].imageUrl`.

---

## 2026-05-30 — FIXED (`26953df` + server cron): Postgres backups were local-only

**Symptom:** Daily 03:30 `pg_backup.sh` cron wrote dumps to `/home/ghs/backups/` only. Server loss = backup loss.

**Fix:** New `scripts/backup_pg_to_r2.mjs` reads `R2_*` env vars, finds the newest local dump, uploads to `r2://<R2_BUCKET>/db-backups/`, and prunes older R2 objects beyond `MAX_R2_DUMPS=14`. `pg_backup.sh` appended with a soft-fail `node backup_pg_to_r2.mjs` invocation. Verified: 148K dump uploaded to R2 in 374ms.

---

## 2026-05-30 — FIXED (`46ae279`): Humans rendered with bear heads (GENESIS BUG — diffusion anti-priming)

**Symptom:** Human characters rendered with bear heads across hybrid and movie planners.

**Root cause (diffusion anti-pattern):** The POSITIVE image prompt contained 5+ references to "bear" / "animal" inside negation phrases ("NOT a bear", "No bear heads"). Diffusion models embed concepts regardless of "NOT" semantics — the model receives "bear bear bear bear" and generates bears.

**Fix (3 surgical edits in `scene-image/route.ts`):**
1. Species description: `"is a human (...NOT an animal, NOT a bear)"` → `"is a fully human person (human face, human body, realistic human anatomy)"`
2. Multi-character header: `"Do NOT replace any character's head with an animal head"` → `"Each character has a fully human face and head with realistic human features"`
3. Late guard: `"...No bear heads, no animal heads..."` → `"Every character is a fully human person with realistic human anatomy"`
4. Bear negative tightened from 12+ bear-words to 8 affirmative non-human concepts.

**Prevention:** Zero "bear" or "animal" tokens in positive prompt for human characters. Use affirmative descriptions, not "NOT X" guards, in diffusion prompts.

---

## 2026-05-30 — FIXED (`b4d8092` + `49f353d`): BIB narration — Piper voice path mismatch

**Symptom:** Narration in children videos was a short beep ("BIB"). Piper was skipped silently.

**Root cause:** `/api/tts` hard-coded the Piper voice path to `/home/ghs/giohomestudio/piper/en_US-lessac-medium.onnx`. Binary and models were actually at `/home/ghs/piper/voices/*.onnx`. `fs.existsSync` returned false → Piper skipped → FAL condition also not triggered → silent placeholder branch = beep.

**Fix:**
- `/api/tts` now resolves Piper voice via `PIPER_VOICES_DIR` env first, then a 4-path candidate list.
- `useFalNarrator` condition now also matches `provider="piper"` so FAL is the next fallback when Piper fails, rather than dropping straight to placeholder.

---

## 2026-05-30 — FIXED (`02c6f07`): Children narration silent + subtitle style ignored — server-side root cause

**Symptom:** Final children videos still shipped silent OR with unstyled subtitle after earlier client-side fixes.

**Root cause (both in `/api/video/assemble/route.ts`):**
1. The SEQUENTIAL FALLBACK path required `body.narrationUrl` (singular). Children sends `narrationList` (plural). Only the FAST PATH honoured `narrationList`, but FAST PATH required music to be present. Any children render without music = silent narration.
2. Caption-burn at line 769 only ran `if (body.caption)`. Children sends per-scene text in `scenes[i].text` but no top-level `body.caption` — the entire caption block was skipped.

**Fix:** Define `fallbackNarrUrl = body.narrationUrl || singleNarrItem?.audioUrl` for the sequential path. Derive `body.caption` from `scenes[i].text` concatenation when empty + `subtitleEnabled` + scenes have `.text`.

---

## 2026-05-27 — FIXED (`edc44f0`): Asset delete button — deleted assets reappear

**Symptom:** Deleting an asset in Asset Library did not stick — the asset reappeared on the next page load.

**Root cause:** `DELETE /api/assets` filtered the asset from `config/asset-library.json`. But `GET /api/assets` auto-seeds assets by scanning `storage/` directories on every request. Since the file remained on disk, the next list re-added it.

**Fix:** DELETE now moves the asset's `filePath` (and `thumbnailPath`) into `storage/.trash/` — out of the scanned dirs so re-seeding cannot pick it up. MOVE not hard-delete (recoverable). Path-guarded to `env.storagePath`. **Follow-up (Phase 3 R2 cutover):** route must delete through `StorageProvider.delete(key)` when `STORAGE_PROVIDER=r2`.

---

## 2026-05-27 — FIXED (`5796eaf`): Hybrid subtitles rendered oversized (PlayResY=288 canvas bug)

**Symptom:** Burned-in caption text dominated the frame on assembled hybrid videos.

**Root cause:** The subtitle path wrote an SRT + `force_style`. FFmpeg's SRT→ASS conversion defaults the script canvas to `PlayResY=288`, so `libass` scaled `FontSize=32` up to the 1080-output frame → `32 × (1080/288) ≈ 120px` captions.

**Fix:** Emit a proper `.ass` file with explicit `PlayResX:1920 / PlayResY:1080` header. `FontSize` now equals real output pixels.

---

## 2026-05-27 — FIXED (`68788e9`): Phone unusable — sidebar crushed content

**Symptom:** On phones, the always-visible 218px sidebar crushed page content into an unusable sliver.

**Root cause:** Desktop-only shell — no mobile breakpoints defined anywhere.

**Fix:** New `app/components/AppShell.tsx` client wrapper. Sidebar becomes a hamburger drawer on ≤768px via `@media(max-width:768px)` CSS in `globals.css`. Desktop render pixel-identical to baseline.

**Prevention:** Any new full-screen shell needs mobile breakpoints from day one.

---

## 2026-05-24 — FIXED (`5f7124c`): All buttons stopped firing (Next.js 16 `allowedDevOrigins`)

**Symptom:** No button onClick handlers were attached after deployment behind a Cloudflare Tunnel. Page SSR-rendered but React never hydrated.

**Root cause:** Next.js 16 added `allowedDevOrigins` security gate. Without listing `andiostudio.com`, cross-origin HMR requests to `/_next/webpack-hmr` were silently blocked — React bundle loaded but event binding never ran.

**Fix (`next.config.ts`):**
```ts
allowedDevOrigins: ["andiostudio.com", "www.andiostudio.com"]
```

**Lesson:** Any Next.js dev server behind a reverse proxy (CF Tunnel, ngrok, nginx) must list the public hostnames in `allowedDevOrigins`. Production mode (`next start`) does not enforce this.

---

## 2026-05-08 — PHASE-C7: `useProjectSettings` wired into hybrid-planner

Settings (`visualStyle`, `soundTier`, `subtitleConfig`, `videoModelVersion`, `imageModelVersion`, `language`, `llmProvider`) were pure local React state. Changes did not persist across reloads or sync between planners.

**Fix:** `useProjectSettings` hook wired into `app/dashboard/hybrid-planner/page.tsx`. 7 `effective*` shims added; 37 read sites replaced; 7 setters augmented with fire-and-forget `patchProjectSettings`. Rollback: revert import, hook call, shim block.

---

## Known open / architectural notes

- **Children → `/api/assembly/execute` migration (deferred):** Children planner currently uses `/api/video/assemble` (legacy). The correct long-term fix is migrating it to `/api/assembly/execute` (hybrid's path, with full per-sentence libass timing tied to narrator audio). Trigger: `go children assembly migration`. Estimated 3–4h.

- **Outro mid-video bug (unresolved):** user reported outro appearing mid-video. Code at line ~4097 puts `[intro → scenes → outro]` in correct order. Needs reproduction details: was outro duplicated or just out of order?

- **Model residuals (bear heads on paid models):** free Segmind model has training biases. Full 100% fix requires paid FLUX-dev/pro per model residuals note.

- **FAL gateway migration (in progress):** 24 FAL API call sites; 17 migrated to `src/lib/providers/fal.ts` adapter as of last session. Remaining 7 tracked in `update/FAL_ADAPTER_MIGRATION_MAP_05302026.md`.
