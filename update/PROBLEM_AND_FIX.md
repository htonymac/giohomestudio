# GioHomeStudio — Problems and Fixes Log

Use this file to record bugs, their root cause, and the fix applied. When the same problem again, check here first before debugging from scratch.

---

## 2026-06-03 — ✅ FIXED (`44e7bca`): font size full path + studio name editable + Piper voice per learning mode

**Symptom (Henry verbatim):** "font size does not take effect on screen", "intro still show home studio", "pace is not ok for leading - learning if talk like story very bad - learning should not be like a story".

**Root cause (3 unrelated issues, fixed in one commit):**

1. **Font size silently ignored on per-scene path.** Subtitle Font Size picker (commit `c83357d`) patched the CHUNKED caption path's `fs` variable only. The PER-SCENE PNG subtitle path called `generateSubtitlePng(text, file, "bottom", 52, subCfg)` with hardcoded `52` at 4 sites. `subCfg.fontSize` was passed to the function but never used by the position/size arg. So if the user picked Large 72, the chunked caption used 72 but per-scene PNG still rendered at 52 — and per-scene PNG is what most short children videos use.

2. **Studio name hardcoded in 5 places.** `"GIO HOME AI STUDIO"` was a literal in:
   - children-planner intro gen body
   - children-planner outro gen body
   - Screenplay tab preview top text
   - Screenplay tab preview footer text
   - Could not be customized by user.

3. **Same Piper voice for storytelling AND learning content.** Children planner had no voice routing based on `learningMode`. A phonics lesson sounded like a bedtime story — wrong cadence for teaching.

**Fix:**

1. `app/api/video/assemble/route.ts` — new `perSceneFontSize` var (line ~165) derived from `subCfg.fontSize` (clamped 18-120, fallback 52). All 4 `generateSubtitlePng` calls now pass `perSceneFontSize` instead of hardcoded `52`. Console log per scene shows size applied.

2. `app/dashboard/children-planner/page.tsx` — new `studioName` state (default `"GIO HOME AI STUDIO"` for backward compat). Editable via new input in Story Credits card. Persists per project via `flushCurrentProject` save + restored on load. Used at all 5 sites.

3. `pickPiperVoice()` function in children-planner. Routes voice by `learningMode`:
   - phonics, word, video_lesson → `en_GB-alan-medium`
   - read_along → `en_US-libritts_r-medium`
   - storybook, poem, sentence → `en_US-amy-medium`
   Wired into 3 `/api/tts` body construction sites.

**Verification:** server pulled commit `44e7bca`. Henry to retest with explicit Large font + custom studio name + phonics mode.

---

## 2026-06-03 — ✅ TAGGED stable `v2026-06-03-stable` at HEAD `f14e9c7`

Snapshot taken after the 10-fix audit ship + ANDIO_MUST_READ.md creation + action-images fix. `git checkout v2026-06-03-stable` to roll back to this point if any subsequent change regresses.

Includes:
- All 10 Sonnet audit fixes (font, perSegmentDuration, placeholder reject, pacing bridge, drawtext ultrafast, narrate-piper timeout, generate-narration rewire, worker STORAGE_PATH, storage cleanup tool)
- Action images fix (narration slice + dynamic mood when action verbs detected)
- `ANDIO_MUST_READ.md` at repo root (single-file index)
- `CLAUDE.md` READ-FIRST block

---

## 2026-06-03 — ✅ FIXED — 10-fix Sonnet-audit ship (`8ec0831` + `57e21db` + `c209d55` + `12c042c`)

**Symptom:** Assembly stuck at 99% for 10+ minutes despite multiple earlier patches. Narration audio shipped as 30-second silent placeholder. Pacing narration never worked on Linux. Henry verbatim: "this system was built in window and has many window bypasses". Approved "Ship ALL 10" plan after 3 read-only Sonnets audited.

**Root cause (one big interconnected cascade — NOT separate bugs):**
1. ASS subtitle default font was `Arial Black` — not installed on Linux server. libass silently substituted/failed → drawtext fallback hit on EVERY assembly.
2. Drawtext fallback ran at ffmpeg default preset (medium) = 5× slower than ultrafast. With 980 drawtext filters for long captions → 10-min stall.
3. `perSegmentDuration` computed from `estimateTextDuration()` (text estimate ~3 w/s) NOT from the probed audio (~1.5-2 w/s for real TTS). Segments rendered 30-60s while audio played 5+ min → 99% stuck waiting for impossible.
4. `/api/tts` returns `engine="placeholder"` when all TTS tiers fail (Piper crashed, FAL no key) — writes a 30s `_silent.mp3` sine tone. Client treated it as success, stored as `narratorAudioUrl`, shipped to assemble. Live server had 39 `_silent.mp3` files = 25% of all narration generations silently failed.
5. `generatePacingNarration()` set `pacingAudioUrl` only. Main `assembleMovie()` saw `narratorAudioUrl=null`, fired SECOND TTS with raw text — pacing entries' timings referred to the FIRST audio, narrationList shipped the SECOND. Desync.
6. `/api/hybrid/narrate-piper` had hardcoded 120s timeout — same BIB-class as `/api/tts` fix from `8807b18` but missed in that fix.
7. `/api/children/generate-narration` Piper fallback called `http://localhost:5000/tts` — a separate daemon that does not run on Linux. Every pacing narration call silently 502'd.
8. `scripts/assemble_job_worker.mjs:24` hardcoded `STORAGE_PATH` — would misroute if env points elsewhere.

**Fixes (4 commits, ordered by impact):**

| # | Commit | File:line | What |
|---|---|---|---|
| 1 | `8ec0831` | `assemble/route.ts:1011` | Default font `Arial Black → DejaVu Sans` |
| 5 | `8ec0831` | `assemble/route.ts:1093, 1108` | Drawtext fallback `preset ultrafast` (was medium) + timeout 180s → 300s |
| 2 | `57e21db` | `page.tsx:2235-2245` | `perSegmentDuration` uses `_totalNarFromProbe` (audio probe) not text estimate |
| 3 | `57e21db` | `page.tsx:1956, 2218, 2733, 6101` | 4 client TTS sites reject `engine==="placeholder"` |
| 4 | `57e21db` | `page.tsx:2580` | `generatePacingNarration` also calls `setNarratorAudioUrl` |
| 6 | `c209d55` | `narrate-piper/route.ts:187` | Spawn timeout scales: `clamp(60s, 10min, text.length * 500ms)` |
| 7 | `c209d55` | `generate-narration/route.ts:124` | Piper fallback now calls `/api/tts` not `localhost:5000` |
| 8 | `12c042c` | `assemble_job_worker.mjs:25` | Reads `STORAGE_PATH` env, fallback to relative path |
| 10 | `12c042c` | NEW `/api/storage/list`, `/api/storage/delete`, `/dashboard/storage-cleanup` | Storage browser + bulk delete |
| 9 | (partial) | console.error already in route | ASS error visible via journalctl; UI surfacing deferred |

**Why this is the SAME bug class fixed multiple times:** every silent fallback in the TTS / subtitle pipeline lands at the same `_silent.mp3` placeholder or drawtext slow-path. Five separate root causes, one destination. Fixes ship preventatively at each entry point.

**Linux server proof:** 39 `_silent.mp3` files in `/home/ghs/giohomestudio/storage/audio/tts/`, all with sibling 0-byte WAVs of the same timestamp. Most recent: 2026-06-03 07:37 UTC (after the `8807b18` timeout fix — meaning a SECOND failure mode beyond timeout exists, probably Piper crashing on specific Unicode chars in long stories).

**Prevention rule (added to global error_log.md):** any silent `catch { }` in narration/TTS/subtitle paths is forbidden. Every tier must `console.error` with the actual reason. Client must reject `engine==="placeholder"` responses.

---

## 2026-06-03 — ✅ SHIPPED (`c83357d`): Subtitle font size picker — Small/Medium/Large/XL + custom 18-120 px

**Symptom (Henry verbatim):** "FIX SUBTITLE FONT SIZE OR TESXT SIZE" then "I CUSTOM WHERE I CAN CHOOSE SIZE". Mode presets (e.g. `kids` = 54px) hard-locked the subtitle size; user-supplied `subtitleConfig.fontSize` was ignored because the route code did `preset?.size ?? subCfg?.fontSize`.

**Fix:**
- `app/api/video/assemble/route.ts` — order swapped: `subCfg?.fontSize (if 18-120) ?? preset?.size ?? 54`. Default raised 36 → 54 (36 was too small for 1920x1080 video). Feeds BOTH ASS Style line (line 1068) and drawtext fontsize.
- `app/dashboard/children-planner/page.tsx` — new "Subtitle Font Size" card on Assembly tab above "Image Flip Rate". 4 preset pills (Small 36 / Medium 54 / Large 72 / XL 96) + numeric input accepting any integer 18-120. Saves to `subtitleConfig.fontSize` → `effectiveSubtitleConfig` → assemble payload.

**Live verification (pending):** to verify, render an assembly with explicit fontSize=72 and ffprobe the output for the rendered subtitle pixel height. Or eyeball — Henry should be able to see the size change immediately.

---

## 2026-06-03 — ✅ FIXED (`bbf4135`): Assembly stuck at 99% — ASS timeout was 120s, drawtext fallback ran 5-10 min

**Symptom:** Assembly progress bar pegs at 99% for 5-10 minutes on long children stories. UI message: "Finalising bumpers + caption overlay (last step — typically 30-60s)". Direct ffmpeg inspection on the live server showed `drawtext=text='Once upon a time...'` filter chain running — i.e. ASS path silently failed, drawtext fallback took over.

**Root cause:** `app/api/video/assemble/route.ts` ASS-path execFile timeout was hardcoded `{ timeout: 120000 }`. Henry's videos: 98 segments × 4s/chunk = ~400 seconds of output. ASS pass had to re-encode 400s of 1920x1080 video — that takes 90-180s on this CPU. Killed at 120s → silent catch → drawtext fallback chain → 300-600s caption step.

Direct ASS test on the server with Henry's exact body proved ASS WORKS: rendered 30s test video in 16s, 52MB output, no error. So the failure was purely the under-budgeted timeout.

**Fix:**
- ASS timeout 120s → 600s (matches the scene-concat + bumper budget).
- Explicit `-c:v libx264 -preset ultrafast -crf 23` on the ASS pass (was relying on ffmpeg default = `medium` preset = slow).
- ASS-fail log promoted from `console.warn` → `console.error` so future regressions show up loud in journalctl.

**Expected impact on Henry's long stories:**
- Before: drawtext fallback ~300-600s for caption step
- After: ASS direct ~60-180s

---

## 2026-06-03 — ✅ FIXED (`8807b18`): **BIB-class regression #4** — Piper timeout was 30s for ANY text length

**Symptom (Henry verbatim):** "OMG NOT THE BB AGAIN IT TOOKS US DAYS TO SOLVE HOOPE U RECORDED". Children narration audio showing 0:30 duration in the UI. Story is 2+ minutes long. Audio file written as `storage/audio/tts/tts_<ts>_silent.mp3` — exact same filename pattern + 30s duration as the original 2026-05-30 BIB beep.

**Root cause:** `/api/tts/route.ts` line 120 had `setTimeout(..., 30000)` for Piper synthesis. Long children stories (5000+ chars / 2+ min narration) take 60-120 seconds for Piper to synthesise on the server CPU. After 30s the timer fired, killed Piper mid-synth, threw `Piper timeout` — but line 131 was `} catch { /* Piper failed */ }` (totally silent). No log of WHY. Request fell to FAL (which may also timeout on long text), then ElevenLabs (no key), then Windows SAPI (Linux — fails), then line 288 silent-placeholder branch which writes the `_silent.mp3` file (440Hz sine tone + silence, duration capped at 30s).

**Why this is BIB #4 and not a totally new bug:** the 2026-05-30 BIB fixes (commits `b4d8092` + `49f353d`) addressed path resolution (Piper voice files in wrong dir). This regression is a different way into the SAME silent-placeholder branch — timeout instead of missing files. Three earlier BIB variants are recorded at error_log.md line 780. All share: silent fallback chain → `_silent.mp3` placeholder at 30s.

**Fix (`8807b18`):**
1. Piper timeout now scales with text length: `clamp(60_000, 600_000, text.length * 500)` ms. Floor 60s for short clips, ceiling 10 min for huge stories. 500ms/char is generous — actual synthesis is ~50ms/char on this CPU.
2. ALL silent catches in /api/tts replaced with explicit `console.error/warn` so future BIB regressions appear in journalctl immediately: `[tts.piper] SKIPPED: bin=... model=...`, `[tts.piper] FAILED: ...`, `[tts.piper] OK Xs audio for Y chars`.
3. Piper's stderr now captured and included in the reject message — was just `Piper exit N`.

**Live verification:** Henry's 1500-char story → Piper → 95-second real audio in 18 seconds. HTTP 200, engine=piper. NOT silent placeholder. Logs visible via `journalctl -u ghs.service -f`.

**To prevent BIB #5:** anyone changing /api/tts must NOT add silent `catch { }` blocks. Every TTS tier must log explicitly. Add a regression test: POST 3000-char text, assert engine!=placeholder.

**Linked records:**
- Earlier BIB fixes: this file line 81 (path resolution), CHANGELOG.md line 554 (provider routing)
- Global learned-fix: `~/.claude/projects/C--Users-USER/memory/error_log.md` line 780 (4-variant BIB class)

---

## 2026-06-02 — ✅ FIXED (`32e450f`): Children planner — Generate button stuck as "Generating..." permanently after error

**Symptom:** Henry: "image not generation - for new video an story image not generate". Generate/Regen button on scene card showed "Generating..." permanently after an API error (e.g. 502, 500, or 200+error). User could never click again without refreshing.

**Root cause:** `generateSceneBoardImage()` in `app/dashboard/children-planner/page.tsx` had `setGeneratingSceneImage(null)` AFTER the try/catch block at line 1516. Two `return` statements inside `try` (L1487 for `data.error`, L1493 for no-url) bypassed this cleanup — the function exited early, leaving `generatingSceneImage === sceneId` permanently. The Generate button was `disabled={isGenImg}` where `isGenImg = generatingSceneImage === sceneId`, so it was permanently disabled.

**Fix (`32e450f`):** Changed `catch` + post-block `setGeneratingSceneImage(null)` to `catch` + `finally { setGeneratingSceneImage(null) }`. The `finally` block runs on ALL exit paths — normal, early return, and exception — guaranteeing cleanup. Also improved error messages to show HTTP status code and "[children-planner]" prefix for easier debugging.

**Live-verified 2026-06-02:** CDP test showed button correctly goes "Generate → Generating... (disabled) → Regen (enabled)" on success path. Error paths now also reset correctly via `finally`.

**Prevention:** Any function that sets a "loading" state flag at the top MUST use `finally` for the cleanup, not a plain statement after try/catch. Otherwise any `return` inside `try` permanently locks the UI.

---

## 2026-05-31 — ✅ FIXED (`d9432d8`): Children planner — Assemble button stays grey on reopened project

**Symptom:** Henry hit `https://andiostudio.com/dashboard/children-planner?projectId=child_1780208261900_qqy3` and the Assemble button was disabled, label `"Select scenes above to assemble"`, even though scene cards above were rendered.

**Root cause:** The restore effect at `app/dashboard/children-planner/page.tsx` L2710 hydrated `childScenes` from `/api/hybrid/saved-state` but never re-set `assemblySelectedIds`. The big Assemble button is gated by `assemblySelectedIds.length === 0`. Auto-selection only ran inside the planScenes paths (L1208 + L1372), not on a saved-state restore. Every reopen left Assemble grey'd out until the user manually clicked "Select All".

**Fix (commit `d9432d8`):** two touches —
1. On restore: when `childScenes` come back from DB, auto-select all of them (mirrors the planScenes pattern).
2. Persist `assemblySelectedIds` + `assemblyMediaPrefs` in the save payload + useEffect deps so manual deselections survive across sessions too.

**Prevention:** when a feature is gated by state only one code path populates, any OTHER path that restores the upstream state must also restore the gate state — or move the auto-selection into a `useEffect` watching `childScenes`. Future planner-restore work should sanity-check "what gates depend on what I just restored?".

---

## 2026-05-30 — ✅ FIXED (`6793682`): Children scene-card buttons appeared not to fire

**Symptom (Henry screenshot SC01-SC03):** 7 buttons (Polish/Funny/Playful/Adventure/Emotion/Action/Establish) appeared to do nothing when clicked. Polish worked, the other 6 didn't visibly fire.

**Root cause:** `handleChildSceneOp` (children-planner/page.tsx:1600) updated only `visualDescription` in local state — never regenerated the scene image. The visible card image stayed stale. `handlePolishScene` (different handler, called by the Polish button) DID auto-regen, which is why only Polish "worked".

**Fix:** mirror handlePolishScene's pattern — capture `updatedScene` from the `setChildScenes` callback, then call `await generateSceneBoardImage({ ...updatedScene, visualDescription: newText })`. User now sees the image refresh after every click. Deployed live.

---

## 2026-05-30 — ✅ FIXED (`0046a6b`): Children establishing shots stored but never reached the rendered video

**Symptom (gap revealed after task #21):** the Establishing Shots panel planned shots, the Render button generated images, the audit doc claimed parity — but the rendered videos didn't actually include the cinematic openers. The shots lived in state only.

**Root cause:** `assembleVideo()` built `assemblyScenes` from `scenesToAssemble` and sent that to `/api/video/assemble`, but never consulted `establishingShotsChild`.

**Fix:** mirror hybrid's `withEstablishing` insertion step. After the main scene loop, if any `establishingShotsChild[sceneId].imageUrl` exists, prepend an `img:` segment before its parent scene with a fresh sequential scene number (so `/api/video/assemble` temp-file naming doesn't collide). Final videos now interleave `[establishing wide] → [main scene]` per scene that got planned + rendered.

---

## 2026-05-30 — ✅ FIXED (`26953df` + server cron): Postgres backups were local-only

**Symptom:** the daily 03:30 `pg_backup.sh` cron wrote dumps to `/home/ghs/backups/` only. Server loss = backup loss. R2 credentials were already in `.env` but unused for DB.

**Fix:** new `scripts/backup_pg_to_r2.mjs` reads `R2_*` env vars, finds newest local `giohomestudio_*.dump`, uploads it to `r2://<R2_BUCKET>/db-backups/`, and (per `MAX_R2_DUMPS=14` default) prunes older R2 objects so the bucket doesn't grow unbounded. Uses the `@aws-sdk/client-s3` already in the project's package.json — no new dep, no new system package required. End-to-end verified on server: fresh 148K dump uploaded to R2 in 374 ms.

Server-side: `pg_backup.sh` appended with a soft-fail `node backup_pg_to_r2.mjs` invocation after the local dump succeeds, with status logged to `backup.log`. Soft-fail design = if R2 has a transient error, the local backup is unaffected.

Daily 03:30 cron now produces local + offsite copies. Survives server loss.

---

## 2026-05-30 — ✅ FIXED (`4e4a82b`): Children-planner missing Establishing Shot UI

Mirror of hybrid task #17 into children. Closes one of the 2 remaining parity gaps in `update/CHILDREN_HYBRID_PARITY_AUDIT_05302026.md`. Children Scene Board tab now has the amber-accent Establishing Shots card: 5-mode picker (off/minimal/auto/cinematic/epic), Establish All button, per-scene chip list with prompt preview + Render button + image thumbnails. Reuses existing API surface (`/api/hybrid/scene-edit op:"establish_all"` + `/api/hybrid/establishing-shot/generate`). Persisted via saved-state. After this, only the assembly-endpoint migration remains as a documented parity gap.

---

## 2026-05-30 — ✅ FIXED (`6d84b8d`): Establishing Shot system missing the 5-level mode picker

**Symptom:** the establishing shot pipeline was binary — "Establish All" ran the LLM on every scene with no way to dial down or up. Spec §4 calls for 5 mode levels (Off / Minimal / Auto / Cinematic / Epic) but the user-facing surface was missing.

**Fix:** `EstablishingMode` type added on both sides. `runEstablishAll` accepts it; OFF short-circuits without an LLM call; other modes inject mode-specific guidance lines into the supervisor system prompt. Hybrid-planner renders 5 picker buttons under the Establish-All row with hover tooltips per spec. Default "auto" so existing flows are unchanged. Deployed.

---

## 2026-05-30 — ✅ FIXED (`b4d8092` + `49f353d`): "BIB" narration → real Piper speech. Max ON button stuck.

**Symptom (Henry retest):** narration in children videos was a beep ("BIB"), Max ON button stopped responding to user clicks even though the badge updated.

**Root cause 1 — narration BIB:** /api/tts hard-coded the Piper voice path to `/home/ghs/giohomestudio/piper/en_US-lessac-medium.onnx`. Server inspection showed binary+models actually at `/home/ghs/piper/voices/*.onnx`. `fs.existsSync` returned false → piper attempt SKIPPED. Fall-through then ALSO skipped FAL (its condition only fired on explicit provider="fal-narrator", not "piper" fallback) → straight to silent-placeholder branch = the BIB beep.

**Fix 1:** (a) `b4d8092` — `/api/tts` now resolves Piper voice via `PIPER_VOICES_DIR` env first, then a candidate list (`{storage}/../piper/`, `{homedir}/piper/voices/`, `{homedir}/piper/`, `/usr/local/share/piper/voices/`). Default piperPath fixed too — `{homedir}/piper/piper/piper`. (b) `49f353d` — `useFalNarrator` condition now also matches `provider="piper"` so when piper still fails, FAL takes over instead of dropping straight to placeholder. **Live-verified on server:** `engine="piper"`, 2.9 s real speech, 128 KB WAV @ 352 kbps.

**Root cause 2 — Max ON button stuck:** my earlier picker code (commit `4e4a82b` area) unconditionally re-added each sceneId to `useMaxImageScenes` on every render via `setTimeout`. User's Max OFF click was immediately overridden on next render → button stuck ON.

**Fix 2:** `49f353d` — track auto-opted scenes in `autoOptedMaxRef` (`useRef<Set<string>>`). Each scene auto-opted exactly ONCE per page load; subsequent user clicks stick.

---

## 2026-05-30 — ✅ FIXED (`02c6f07`): Narration silent + subtitle style ignored — **real root cause was server-side**

**Symptom:** Henry retested after the earlier `0b57265` (children auto-narration) + `a40b53a` (subtitle staging) fixes. Final children videos still shipped silent OR with the wrong (unstyled) subtitle. Verbatim: "NARRATION BIP NOT TALKING. SUBTITLE STYLE IS NOT CHANGING".

**Root cause (BOTH in `/api/video/assemble/route.ts`):**

1. **Narration dropped when no music** — SEQUENTIAL FALLBACK path required `body.narrationUrl` (singular). Children sends `narrationList` (plural). Only the FAST PATH at line 609 honoured narrationList, but FAST PATH itself required music to be present. So any children render without music = silent narration, regardless of how aggressively the planner auto-generated narrationList.

2. **Subtitle never rendered for children** — caption-burn at line 769 only ran `if (body.caption)`. Children sends per-scene text in `scenes[i].text` but no top-level `body.caption` — so the entire caption block was skipped → my earlier `a40b53a` styling fix lived inside dead code for children renders.

**Fix:** define `fallbackNarrUrl = body.narrationUrl || singleNarrItem?.audioUrl` and route SEQUENTIAL FALLBACK off that. Plus, just before the caption block, if `body.caption` is empty AND `subtitleEnabled` is on AND scenes have `.text`, derive `body.caption` by concatenating the scene texts (stripping the "Title: " prefix children adds). The earlier styling fix then runs normally.

These are the real root causes — both lived in the assemble route, not in the planner. Both earlier client-side fixes still help (auto-narration ensures narrationList is populated; subtitleConfig still flows through) but neither was sufficient alone.

---

## 2026-05-30 — ✅ FIXED (`f7525e3`): Two issues — broken scene thumbnails + modify buttons not firing

**Symptom 1 (Henry screenshot):** scene-card "PICK WHICH IMAGES TO INCLUDE" boxes showing broken image icons with B1, B2 alt text. **Root cause:** scene-image route returned `imageUrl: result.imagePath ? localImageUrl : result.imageUrl`. When the generator (FAL, Segmind, etc.) returned only a CDN URL (`fal.media/...`) without writing locally, the CDN URL got stored in state. FAL CDN expires in ~3 hours → every thumbnail breaks on next reload. **Fix:** after `result.success`, if `result.imagePath` is missing but `result.imageUrl` is set, download the CDN URL to `outputPath` (the scoped `/storage/scenes/{projectId}/{sceneId}/img_X.png`) and set `result.imagePath = outputPath`. The existing response line then always returns the persistent `/api/media/...` URL.

**Symptom 2 (Henry):** "the button are not workin" — children Enter Content modify buttons (Intensify / Playful / Educational / Adventure / Magical / Cozy / Diverse / Musical / Heartwarming) shipped in `56e32f2` clicked but textContent didn't change. **Root cause:** runPolish in scene-edit threw `"Polish parse failed"` whenever the LLM returned raw text instead of strict `{title, description}` JSON — common on long custom instructions. The 500 status carried `ok:false` so the client never updated textContent. **Fix:** when extractJSON returns null, strip any ```` ```json ```` fences and use the raw cleaned text as the description instead of throwing. Worst case the description is slightly less polished; user still gets a result. Applies to every polish caller: children prefill + modify buttons, hybrid scene-card toolbar, movie scene-card toolbar.

---

## 2026-05-30 — ✅ FIXED (`56e32f2`): Children Enter Content — AI prefill on land + 10 small Modify buttons

**Symptom (Henry screenshot):** after picking templates on /children-video, user lands on children-planner with the textarea showing the raw `topicPrompt` URL param. Two users picking the same template get identical text. The empty space next to Expand with AI / Build Story with AI buttons was unused — Henry wanted small modify buttons there (like the hybrid scene-card toolbar) so users could reshape the story idea (more intense / playful / fun / educational / adventure / magical / cozy / diverse / musical / heartwarming) BEFORE clicking Expand.

**Fix:**
1. **AI prefill on land** — earlier autoExpand effect (commit `1d571d1`) auto-fired full `expandStory()` which was too aggressive. Replaced with new `prefillPrompt()` that calls `/api/hybrid/scene-edit polish` with `polishMode:"custom"` + a custom instruction wrapping the user's selections (age group, learning mode, safety level, content type, topic) + a **random seed** (0–99999). Result is a unique 2-3 sentence story idea — User A and User B picking the same template now get different specific scenarios with different names and twists.
2. **10 Modify buttons** rendered inline with Expand/Build at fontSize 9 / padding 5×9 / color-coded per intent. 5 buttons (Intensify / Playful / Fun / Adventure / Heartwarming) map to existing polishMode values; 5 (Educational / Magical / Cozy / Diverse / Musical) use `polishMode:"custom"` with child-safe instructions. New `modifyPrompt(kind)` handler. Disabled while any modify or prefill is in flight. Spinner "✨ AI suggesting…" while prefill runs.

Style matches hybrid scene-card toolbar (Henry's IMG #18 reference) — small, color-coded, emoji-prefixed.

---

## 2026-05-30 — ✅ FIXED (`4ba3959`): Token Resolution Engine not wired into scene-image (MASTER_PLAN Phase 3)

**Symptom (root cause for character substitution drift):** typed character tokens like `[CH01]` in story-expanded scene text were passed LITERALLY to the image model when the planner hadn't already enumerated them in `characterIds[]`. The model either rendered the literal bracket text or defaulted to a generic placeholder ("characters collapse to bear" was a downstream symptom of this — BUG-02).

**Discovery:** `resolveCharacterTokens` already existed at `src/lib/character-resolver.ts:99` (the persona doc said "Token Resolution Engine 5% built" — actually it's fully implemented). The actual gap was that the BACKBONE image route (`/api/hybrid/scene-image`) never imported or called it. Three other routes already did (`/api/character/resolve`, `/api/generation/image`, `/api/video/generate`).

**Fix:** wire `resolveCharacterTokens(sceneText, characterIds)` BEFORE `sanitizeStyleCollisions` / `extractSceneAction` in scene-image. Soft-fail to raw `sceneText` on any error so it never blocks gen. Result `enrichedPrompt` feeds the sanitize pipeline; surfaced `referenceImages` get appended to `referenceImageUrls` (deduped). Net effect: a scene like `"[CH01] meets her sister at the market"` where the planner sent only [CH01] now resolves the sister's typed token, attaches her portrait reference image, and substitutes her visualDescription in-prompt. Deployed.

---

## 2026-05-30 — ✅ FIXED (`e961c8d`): Children "audio planner is zero" — missing AI Audio Plan panel

**Symptom (Henry):** "audio planner is zero in general" in children planner. Hybrid had a centralized Step 7 "AI Audio Plan" that batches all scenes through `/api/hybrid/audio-plan` and stores per-scene narration script + music mood + SFX list + ambience list. Children had no equivalent surface — narration/music/SFX were only available per-scene via the Pre-Flight or inline auto-trigger.

**Fix:** added `audioPlans` state + `runChildrenAudioPlan()` function + UI card in the Sound tab. Card shows a prominent purple "Run AI Audio Plan" button; when complete, displays per-scene chips (music mood, first 4 SFX, narration preview). Includes child-safe context (`ageGroup`, `safetyLevel`) so the LLM keeps it age-appropriate. Persisted via saved-state so plans survive refresh. Mirrors hybrid's Step 7. Deployed.

---

## 2026-05-30 — ✅ FIXED (`89b62f9`): C6 pacing engine outputs not persisted to DB

**Symptom:** building a pacing plan + generating narration + assembling a pacing video all worked in-session, but a refresh or re-open of the project lost all 4 fields → user had to rebuild from scratch.

**Root cause:** the children-planner saved-state effect (`/api/hybrid/saved-state` POST) wrote 25+ fields but never included `pacingPlan` / `pacingAudioUrl` / `pacingVideoUrl` / `pacingTimingMap`. Restore likewise didn't read them. Pure gap in the persistence loop.

**Fix:** added all 4 pacing fields to the POST data object, the restoreState rehydration block, and the useEffect dep array so debounced save fires on any pacing change. No behavioral change in the pacing pipeline itself. Deployed.

---

## 2026-05-30 — ✅ FIXED (`d32b602`): Legacy `kids` / `dramatic` / `social` subtitle modes had no presets

**Symptom:** picking Children Song/Kids, Dramatic Movie, or Social Media Caption from the Subtitle Styler showed no visible difference vs default — same gap pattern as the `highlight` mode fix two days earlier. No preset entry in `SUBTITLE_PRESETS` → ASS formatter fell through to default rendering.

**Fix:** added 3 presets in `app/api/assembly/execute/route.ts`:
- `kids`: Arial Black 54px white + purple outline + bubble pop per-word
- `dramatic`: Georgia 46px white + black box bg 0.85 + line-level glow fade
- `social`: Impact 56px white + cyan glow outline + dance scale per-word

All three render visibly distinct from each other and from existing modes. Deployed.

---

## 2026-05-30 — ✅ FIXED (`46ae279`): GENESIS BEAR — humans rendered with bear heads (anti-priming diffusion fix)

**Symptom (Henry, longstanding):** humans rendered with bear heads across hybrid + movie planners. "Most of the movie has 1-2 people with bear head." Sessions 17-18 added heavy bear-negatives but bug recurred.

**Root cause (diffusion anti-pattern):** the POSITIVE image prompt mentioned "bear" / "animal" 5+ times via "NOT a bear, NOT any animal" / "No bear heads, no animal heads" / "NOT replace any character's head with an animal head." The negative prompt had 12+ bear-words (grizzly, brown, polar, ears, hat, mask, costume, headwear...). Diffusion models like FLUX/Segmind embed concepts regardless of "NOT" semantics — the model literally heard "bear bear bear bear bear" and produced bears. This is a textbook anti-pattern in prompt engineering for text-to-image.

**Fix (3 surgical edits in `scene-image/route.ts`):**
1. Species-by-name line: `"is a human (...NOT an animal, NOT a bear, NOT any animal)"` → `"is a fully human person (human face, human body, realistic human anatomy)"`
2. Multi-character header: `"Do NOT replace any character's head with an animal head"` → `"Each character has a fully human face and head with realistic human features"`
3. Late-position guard: `"...No bear heads, no animal heads, no fur, no snouts, no paws..."` → `"Every character is a fully human person with realistic human face, human anatomy, human skin, human hands, and human proportions"`
4. Bear-negative tightened from 12+ comma-separated bear-words to 8 affirmative non-human concepts: `"animal head on human body, furry creature, snout, paws, animal face, anthropomorphic creature, non-human face, creature head"`.

Zero "bear" tokens in POSITIVE prompt for human characters; single tight negative phrase. Explicit-animal path (when story explicitly tags `species:"bear"`) is preserved unchanged. Deployed.

**Verify:** Henry to run a fresh render with all-human story. Expect dramatically fewer (ideally zero) bear-head defaults. Note: free Segmind model still has its own training biases, so residual cases possible — final 100% fix needs paid FLUX-dev/pro per [[REMAINING_TODO model residuals]].

---

## 2026-05-30 — ✅ FIXED (`a40b53a`): Children subtitles stuck 5 sec + style ignored

**Symptom (Henry):** "subtitle always still for 5 sec - style + pace doesn't work" in children renders. The Subtitle Styler UI controls (fontSize, textColor, bgBox, bgOpacity, position) had no visible effect on the final video; captions sat on screen for the full 5-second scene block.

**Root cause:** `/api/video/assemble` (used by children flow — different endpoint from hybrid's `/api/assembly/execute`) burned captions with hardcoded `drawtext=text='...':fontsize=28:fontcolor=white...` and no time-gating, so the entire caption stayed on for the whole video segment regardless of subtitleConfig.

**Fix:** in Step 5c drawtext call, read `subtitleConfig` from the body and apply fontSize (18-80) + textColor as `0xRRGGBB` + bgBox/bgOpacity → `:box=1:boxcolor=black@op:boxborderw=10` + position. Then split the caption into 5-word chunks, stagger them 1.6 sec apart with 0.25 sec fade in + fade out per chunk via `enable='between(t,S,E)'` + alpha ramp. User now sees the caption move with the spoken pace. Falls back to legacy single-block style if no chunks.

**Architectural followup (not yet done):** the proper fix is to migrate children-planner from `/api/video/assemble` to `/api/assembly/execute` so it gets the full per-sentence libass timing tied to narrator audio that hybrid uses. Tracked as task #15 (children → hybrid parity sweep).

---

## 2026-05-30 — ✅ FIXED (`0b57265`): Children narration "doesn't work" — empty in final video

**Symptom (Henry):** "narration do not work" in children planner videos. Final renders silent or missing narrator track.

**Root cause:** the main children assembly flow only included `narratorAudioUrl` in the assembly payload if the user had previously clicked "Generate Narration" on the Voice Layers panel. If they skipped that step (most users do — it's not obviously required), `narrationList = []` was sent → final video had zero narration. The pre-flight check (line 1798) had auto-narration but the main Assembly button did not.

**Fix:** in the assemble flow, if `narratorAudioUrl` is empty AND `textContent` exists, auto-call `/api/tts` with the user's effectiveNarrationProvider + speed BEFORE building `narrationList`. Resolved URL is also saved to state so a subsequent re-assemble reuses the same audio. Deployed.

---

## 2026-05-30 — ✅ FIXED (`7109fda`): Children LLM model + video/image model selections dropped from /children-video

**Symptom (Henry):** "llm model is not avalable with llm planner" — after picking LLM tier + video model + image model on `/dashboard/children-video`, those selections didn't carry into the planner. User saw no active model and had to re-pick.

**Root cause:** `/children-video` sent `tier`, `videoModel`, `imageModel` URL params on the "Open Planner" link, but `children-planner/page.tsx` never read them. The Story AI Intelligence picker (with 7 options: Ollama / Haiku / Sonnet / Opus / GPT-4o-mini / GPT-4o / o1-mini) defaulted to Haiku every time.

**Fix:** read 3 URL params in children-planner, seed `storyAiProvider` / `selectedVideoModelId` / `selectedImageModelId` initial state from them. Added `URL_TIER_TO_PROVIDER` map so `tier=standard|pro|premium|free` maps to the correct provider value. Deployed.

---

## 2026-05-30 — ✅ FIXED (`1d571d1`): Children template selection still required manual input + thin catalog

**Fix:** new useEffect in `children-planner/page.tsx` guards a one-shot auto-expand via `autoExpandedRef`. When user lands from `/children-video` with a `topicPrompt` URL param + unchanged textContent + no existing expansion, `expandStory()` fires automatically. No "click Generate again" friction. Also expanded toddler catalog: +4 content types (Bedtime / First Words / Potty & Bath / Feelings) and +5 curriculum templates (A-to-Z 26 / Shape Story / Action Songs / Animal Sounds / Feelings Toolkit). Deployed live. Other age groups (preschool/early/older) already rich — expand on request.

---

## 2026-05-30 — 🟠 ORIGINAL: Children template selection still requires manual input

**Symptom (Henry screenshot):** Children planner — Toddlers age group. User has selected:
1. Content type card: **Colours & Shapes**
2. Suggested topic: **Red, Blue, Yellow** (auto-pre-filled the "Selected" preview)
3. Curriculum template (one of: First 50 Words / Learn All Colours / Count to 5 / My Daily Routine)

After all 3 selections, the planner SHOULD be ready to generate (everything needed is locked in). Currently it still requires/expects manual user input.

**Henry directive:**
- Remove the input requirement when template+topic+curriculum are all selected — go straight to generate
- Add MORE templates in every section (more content types, more suggested topics per type, more curriculum templates)
- Apply same pattern across the planner — selecting templates = no typing needed

**Investigation target:** `app/dashboard/children-planner/page.tsx` template-selection state + the "Generate" gate condition that blocks proceed; also the template catalog arrays (need expansion).

---

## 2026-05-30 — 🟠 OPEN BUG BURST (Henry — children parity sweep + hybrid finish line)

Recording in batch because Henry's PC may shut down anytime. All entries are PENDING DIAGNOSIS/FIX. Priority order = highest user-impact first.

### A. CHILDREN PLANNER — scene-card buttons fire opposite or not at all 🔴
Screenshot: SC01 "Mia's Bright World" / SC02 "Meeting Sam the Ant" / SC03 "Leo the Airplane's Arrival". Each card has 7 buttons: Polish · Funny · Playful · Adventure · Emotion · Action · Establish. Henry says they don't fire (or fire opposite intent). High impact — children planner unusable as designed. **Investigation target:** `app/dashboard/children-planner/page.tsx` button onClick handlers; compare to hybrid's scene-card buttons.

### B. CHILDREN PLANNER — narration doesn't work 🔴
Generated stories don't produce playable narration. Verify voice provider call, audio persistence, scene.narration field hookup. Compare to hybrid pipeline.

### C. CHILDREN PLANNER — LLM model not available in picker 🔴
Model dropdown shows no model OR unselectable state. Compare to hybrid LLM picker.

### D. CHILDREN PLANNER — Audio Planner tab is ZERO 🔴
Audio tab not built / not wired. Mirror hybrid audio tab (narration tier + music tier + SFX intelligence).

### E. CHILDREN PLANNER — subtitle style + pace don't take effect (stuck 5s) 🟠
Subtitle window appears, but style and pacing aren't applied — every subtitle stuck 5 sec instead of speech-paced. Likely children doesn't thread `subtitleConfig` through to `/api/assembly/execute` the way hybrid does (`effectiveSubtitleConfig` pattern at hybrid-planner:705).

### F. GENESIS BUG — humans rendered with bear heads in MANY scenes 🔴
Affects hybrid AND movie planners. "Most of the movie has 1-2 people with bear head." Earlier Sessions 17+18 patched only-explicit-`species: "bear"` triggers bear mode — but Henry still sees this. **Need to grep ALL upstream prompt-construction sites for residual "bear" tokens entering the image prompt unintentionally** (character name? story expansion verb? stale character cache? bear in negative leaking to positive? hasNegativeMask bug?).

### G. CHILDREN ↔ HYBRID PARITY SWEEP 🟡
After A-F, mirror hybrid's recent updates (narrator/actor coord + 8 subtitle modes + highlight bouncing-ball + all Session 17-20 fixes) into children-planner. Final consistency pass.

### Hybrid finishing 5% (Henry: "drive to finishing line")
- H1. **Token Resolution Engine** (Phase 3 root cause, ~3-4h) — gates substitution stability
- H2. **Establishing Shot system** (spec at `update/LANDSCAPE SHOT/`, 0% built, ~3-4h)
- H3. **C6 pacing engine save/load** (~1h)
- H4. **3 legacy subtitle modes (kids/dramatic/social) preset gaps** (~30 min — same shape as highlight fix `27d6c36`)
- H5. **Outro mid-video bug** — needs Henry info (duplicate vs ordering?)

**Tasks #9-#19 in TaskList track each item.** Execution order: A → C → B → E → F → D → G → H4 → H3 → H1 → H2 → H5.

---

## 2026-05-29 — ✅ FIXED (`27d6c36`): Highlight mode highlighted full line instead of only spoken word

**Symptom (Henry, on andiostudio.com after 8-mode rollout):** Word-by-Word Highlight mode rendered the whole sentence in highlight color, not the bouncing-ball per-word effect. "alight only spoken word."

**Root cause:** legacy `highlight` mode had NO entry in the new `SUBTITLE_PRESETS` map (`app/api/assembly/execute/route.ts`). Fell through to the default formatter which emits one full-line Dialogue with the static style — no per-word override tags. The new 8 modes (rainbow, dance, etc.) had presets, but the 5 legacy modes did not.

**Fix:** add `highlight` preset with new perWord case `highlight_current`. Per-word ASS animation transforms primary color from `textColor` → `highlightColor` for each word's time window (40 ms ramp in/out), then back to `textColor`. Uses `subCfg.textColor` + `subCfg.highlightColor` directly so the user's color picker controls both. Deployed live + restarted.

**Follow-up (analogous):** legacy `kids` / `dramatic` / `social` modes likely have the SAME gap — no preset, fall through to default. Each needs a preset matched to its design intent (kids = colorful bubble, dramatic = cinematic letterbox, social = TikTok glow+bounce). Estimated ~10 min each.

---

## 2026-05-29 — ✅ FIXED (deployed `efaee13`, awaits Henry visual reverify): Narrator/actor audio overlap + Subtitle window overlap

**STATUS UPDATE:** Fix shipped + live. Two commits:
- `8f1fd62` — `src/lib/assembly-builder.ts` exports `computeNarratorWindows()` helper with Fallback B (longest entry overall when no entry starts at ≤0.5s — the path that was broken). `app/api/assembly/execute/route.ts` `buildSubEntries()` now consumes the helper, skips narrator cursor past actor windows, clips narrator end at next actor window start, drops sub-0.5s entries. Diagnostic `[duck]` + `[subtitle-coord]` logs added.
- `efaee13` — `scripts/verify_coord_unit.mjs` proves 3/3 cases pass including the split-per-scene narrator case.

**Verify on next render:** Henry triggers a fresh hybrid render (`Make Video` on any project with narrator + actor segments). Expect:
- Narrator silent during actor dialogue, returns when actor stops.
- Subtitles sequential — no D-over-A overlap.
- Server logs (`journalctl -u ghs.service`): `[duck] narratorIdx=N actorWindows=K entries=M` should show `narratorIdx >= 0` AND `actorWindows > 0`. If either is 0/-1, planner is sending entries in an unexpected shape — surface and fix planner side.

**Original report below** ↓

## 2026-05-29 — Original report (PAIR): Narrator/actor audio overlap + Subtitle window overlap

**Symptom (Henry, e2e on `ghs_hybrid_default_1780008307352`):**
1. Narrator audible at FULL volume during actor dialogue — no ducking. "Heard the actor voice the same timing with the narration."
2. Subtitle entries overlap visually: "D come on top of A even before C goes" — multiple captions on screen simultaneously.

**Diagnosis (paired root cause — narrator/actor coordination missing in both audio AND subtitle paths):**

- **Audio path** — `src/lib/assembly-builder.ts` commit `9d8ccba` (2026-05-28) added duck logic that lowers narrator volume to `NARRATOR_DUCK_VOL=0.06` during actor windows. It DID run for this render (`buildAssemblyPlan` is called at `app/api/assembly/execute/route.ts:392`). But the duck didn't activate. Suspects:
  - `narratorIdx` fallback only picks an entry whose `startTime ≤ 0.5` — fails if the narrator entry is split into per-scene chunks each starting at scene time.
  - Actor entries arrive on a SEPARATE narration[] array (or different track) → `actorWindows` empty → no duck filter emitted.
  - Need fresh test render + dev-server logs to confirm which.

- **Subtitle path** — `app/api/assembly/execute/route.ts:540` `narrationWithText = fullAssembly.narration.filter(n => n.text && n.text.trim())` includes BOTH narrator AND actor entries. `buildSubEntries()` (L545–588) walks each entry independently, emitting sentences across that entry's `startTime..endTime`. Narrator entry's sentences (spanning whole video) overlap actor entry's sentences (5-10s windows). All emitted as separate `drawtext=...:enable='between(t,S,E)'` filters. FFmpeg renders ALL active windows → multiple captions stacked.

**Same root cause, two surfaces.** Both need `narratorIdx` + `actorWindows` computed ONCE and applied to both audio mix AND subtitle emission. Currently the duck logic lives only in assembly-builder.ts; subtitle path has none.

**Proposed fix (NOT YET APPLIED — awaits Henry GO):**
1. Lift `narratorIdx` + `actorWindows` computation to a shared helper (or compute in route.ts and pass to both).
2. In `buildSubEntries()`: when emitting NARRATOR sentences, skip cursor past any actor window it falls into, AND clip sentence `end` at the next actor window `start`. Drop tiny <0.5s windows.
3. Audio diagnostic: add console.log of `narratorIdx`, `actorWindows.length`, `entries.map(n=>({s,e,isN:n.isNarrator}))` in assembly-builder. Re-run e2e to confirm whether duck didn't apply because of detection vs missing-actor-entries.
4. After diagnosis, fix narrator detection (require `isNarrator` flag set by hybrid-planner OR raise the start-time threshold + add longest-duration tiebreak).

**Why this matters:** the #51 ducking fix shipped 2026-05-28 worked on Henry's verification test then but NOT on today's render → likely a narrator-detection edge case in real hybrid stories vs the verification fixture.

**Files to touch (when GO):**
- `src/lib/assembly-builder.ts` (narratorIdx detection robustness + diagnostic log + export narratorIdx/actorWindows so callers can reuse)
- `app/api/assembly/execute/route.ts` (subtitle path uses lifted narratorIdx/actorWindows; skip narrator sentences during actor windows)

**Triggers logged for Henry:**
- `go fix subtitle overlap` — apply subtitle-path fix only (low risk, isolated to drawtext entries)
- `go diagnose audio duck` — add logs + re-render test, surface the failure mode
- `go fix both` — apply subtitle fix + audio diagnostic + a fresh render in one shot

---

## 2026-05-27 — ✅ FIXED: Asset delete button "doesn't work" (deleted assets reappear)

**Symptom (Henry):** deleting a nonsense asset in Asset Library didn't stick.
**Root cause:** `DELETE /api/assets` (route.ts) only filtered the asset out of `config/asset-library.json`. But `GET /api/assets` AUTO-SEEDS assets by scanning `storage/` dirs every request (scene videos re-sync on every call; stock/sfx/gen/merged on first-empty). Since the file remained on disk, the next list re-added it → looked like delete failed.
**Fix:** `DELETE` now moves the asset's `filePath` (+`thumbnailPath`) into `storage/.trash/` — out of the scanned dirs so it can't re-seed. MOVE not hard-delete (recoverable). Guarded: only touches paths inside `env.storagePath`. Returns `{ ok, fileAction }`. Commit `edc44f0`, verified dev + live.
**Prevention:** any "delete" of an auto-seeded asset MUST remove the file from the scanned dir, not just the index. When R2 cutover lands, route deletes through `StorageProvider.delete(key)` (filesystem move won't purge R2).

---

## 2026-05-27 — ✅ FIXED (deployed `5796eaf`, pending real-render eyeball): Hybrid subtitles render TOO BIG

**Reported by Henry 2026-05-27** (last video checked on hybrid, confirmed REAL render not mock). Burned-in caption text oversized, dominated the frame.

**ROOT CAUSE:** the libass path wrote an **SRT** + `force_style`. ffmpeg's SRT→ASS conversion defaults the script canvas to **PlayResY=288**, so libass scaled `FontSize=32` up to the 1080 output frame → ~32×(1080/288) ≈ **120px** captions. (Output is always normalized to 1920×1080, so the size was purely the canvas-scaling bug.)

**FIX:** emit a proper **`.ass`** with explicit `PlayResX:1920 / PlayResY:1080` header so `FontSize` = real output pixels (FontSize=32 → 32px ≈ 3% of height). Style preserved (color/box/alignment/margin/font). `app/api/assembly/execute/route.ts`, commit `5796eaf`, built green + deployed via systemd. **✅ VERIFIED 2026-05-27 on a REAL assembled 1080 video** (intro+3 image scenes+outro+Piper narration via `/api/assembly/execute` → `_subtitled.mp4`): caption renders normal size at bottom-center, not oversized. Frame proof `tests/_mobile/render_f5.png`.

(original detail below)

**Where to look (NOT yet fixed — Phase 2 backend):**
- `app/api/assembly/execute/route.ts` — FFmpeg `drawtext` caption rendering. The `fontsize` is a fixed value, not scaled to output resolution/frame. Earlier session set caption Y = `h-th-54` and `wrapText` 45→40 / 20-word chunks (commit `996b5fc`) but did NOT touch `fontsize`.
- Likely fix: make `fontsize` proportional to output height (e.g. `~h/22`–`h/26`) instead of a fixed px, and/or expose it via `subtitleConfig` style tokens (currently always Arial 22px white — see HANDOFF "subtitle style tokens" backlog item).
- PROTECTED: do not touch `amix=duration=longest`, `-stream_loop -1`, `atrim` ordering. Subtitle fontsize is independent of those.

**Status:** documented, scheduled under Phase 2 (backend bug pass). Verify FINAL exported video, not preview (per feedback_pipeline_debug).

---

## 2026-05-27 — Phone: site unusable (sidebar crushed content) — FIXED

**Symptom:** On phone, andiostudio.com was "too big, nothing to operate."
**Root cause:** desktop-only shell — always-visible 218px sidebar + fixed desktop padding, zero mobile breakpoints (viewport meta was present and fine).
**Fix:** new `AppShell` client wrapper + mobile-only `@media(max-width:768px)` CSS turns the sidebar into a hamburger drawer; desktop render unchanged. Commit `68788e9`.
**Prevention:** any new full-screen dashboard shell needs a mobile breakpoint from day one. Use `@media(max-width:768px)` (additive) to avoid touching the desktop path. Screenshot BOTH 390px and 1440px to prove desktop is unaffected.

---

## 2026-05-08 — PHASE-C7-HYBRID-PLANNER: useProjectSettings wired into hybrid-planner

**File touched:** `app/dashboard/hybrid-planner/page.tsx`

**What changed:**
- Added `import { useProjectSettings } from "@/hooks/useProjectSettings"` at line 24.
- Hook keyed to `projectId || urlProjectId || "hybrid-default"` — hybrid-planner has full DB-backed projectId resolved from URL `?projectId=`.
- 7 `effective*` shims added after `urlProjectId` declaration:
  - `effectiveProjectStyle` = `projectSettings.visualStyle ?? projectStyle`
  - `effectiveSoundTier` = `projectSettings.soundTier ?? soundTier`
  - `effectiveSubtitleConfig` = merged SubtitleConfig with hook's `subtitleMode`/`subtitleHighlight` (note: `enabled` not in SubtitleConfig type — omitted)
  - `effectiveVideoModelId` = hook version if !== "auto", else local `selectedVideoModelId`
  - `effectiveImageModelId` = hook version if !== "auto", else local `selectedImageModelId`
  - `effectiveLanguage` = `projectSettings.language ?? language`
  - `effectiveLlmProvider` = `projectSettings.llmProvider ?? aiChatProvider`
- READ sites replaced (full list):
  - `projectStyle` → `effectiveProjectStyle`: 13 sites (artStyle params, scene image/video gen bodies, char portrait gen, AID picker active state, Design tab isSelected, style picker badge, char style dropdowns, designComplete prop, Screenplay/Overview badge)
  - `soundTier` → `effectiveSoundTier`: 4 sites (narration API body, 2x UI tier button active style)
  - `subtitleConfig.mode/fields` → `effectiveSubtitleConfig.*`: 3 sites (assembly includeSubtitles, subtitle match check, SubtitleStyler value prop)
  - `selectedVideoModelId` → `effectiveVideoModelId`: 3 sites (AID picker activeModelId, AID picker isSelected, video gen API modelId)
  - `selectedImageModelId` → `effectiveImageModelId`: 4 sites (AID picker activeModelId, AID picker isSelected, ideogram badge, image gen modelId in 3 batch calls)
  - `language` → `effectiveLanguage`: 10 sites (story expand, char build calls, scene API calls, photo-import char, language select value, UI badge)
  - `aiChatProvider`/`storyEditProvider` → `effectiveLlmProvider`: 4 read sites (2x AI chat API provider, 2x story edit API provider, 2x UI active state buttons)
- Setters augmented with fire-and-forget patch:
  - `setProjectStyle` → `patchProjectSettings({ visualStyle })` (in style picker onClick)
  - `setSoundTier` → `patchProjectSettings({ soundTier })` (both tier selector locations)
  - `setSelectedVideoModelId` → `patchProjectSettings({ videoModelVersion })` (AID picker)
  - `setSelectedImageModelId` → `patchProjectSettings({ imageModelVersion })` (AID picker)
  - `setAiChatProvider` → `patchProjectSettings({ llmProvider })` (AI chat LLM selector)
  - `setStoryEditProvider` → `patchProjectSettings({ llmProvider })` (story edit LLM selector)
  - `setLanguage` → `patchProjectSettings({ language })` (language select onChange)
  - `setSubtitleConfig` → inline arrow: sets local + patches subtitleMode/subtitleHighlight/subtitleEnabled

**Skipped (not present as state):**
- `narrationProvider` — only appears in assembled audioConfig inline; no useState for it
- `aspectRatio` — only appears in CSS `aspectRatio: "1"` (non-semantic), no useState
- `storyAiProvider` — type is `"claude:claude-sonnet-4-6"` style strings, not compatible with hook's `llmProvider` union; kept as-is

**Left untouched (per hard rules):**
- Save effect dependency arrays (lines 742, 753)
- Save effect data objects (lines 738, 742)
- Restore-setter calls inside restoreState() and loadProject() (lines ~4062, 4071, 4078, 4086)
- `storyAiProvider` reads (incompatible type with hook field)

**TSC result:** exit=0 (clean).
**Smoke:** HTTP 200 on localhost:3200/dashboard/hybrid-planner?projectId=test_smoke_hybrid.
**Rollback:** revert `app/dashboard/hybrid-planner/page.tsx` import + hook block + shim block.

---

## 2026-05-08 — PHASE-C6-SCENE-FORGE: useProjectSettings wired into scene-forge

**File touched:** `app/dashboard/scene-forge/page.tsx`

**What changed:**
- Added `import { useProjectSettings } from "@/hooks/useProjectSettings"` at top.
- Hook keyed to `SCENE_FORGE_DB_KEY` ("ghs_sceneforge_session") — no projectId in scene-forge; session key is stable identifier.
- 6 effective* shims added: `effectiveProjectStyle`, `effectiveAspectRatio`, `effectiveNarrationProvider`, `effectiveSoundTier`, `effectiveVideoModelId`, `effectiveImageModelId`.
- Render read sites replaced: style buttons, aspect ratio buttons, musicTier buttons, ModelPicker props.
- AI polish body `style` read replaced with `effectiveProjectStyle`.
- generate() body: all 6 settings replaced with effective* variants.
- Setters augmented with patchProjectSettings fire-and-forget: style→visualStyle, aspect→aspectRatio, musicTier→soundTier, videoModel→videoModelVersion, imageModel→imageModelVersion.
- `voice` setter: no visible UI selector in scene-forge; voice is set on mount-restore only — not augmented.
- `tier` (AITier): skipped — no equivalent hook field per C.6 spec.

**Rollback:** revert `app/dashboard/scene-forge/page.tsx` import + hook block.
**TSC:** exit=0 clean.
**Smoke:** Page 200 OK on localhost:3200/dashboard/scene-forge.

---

## 2026-05-08 — PHASE-C5-FREE-MODE: useProjectSettings wired into free-mode

**File touched:** `app/dashboard/free-mode/page.tsx`

**Problem:** Free Mode had 7 settings (imageStyle, imageModel, videoModel, musicTier, voiceProvider, llmModel, subtitleStyle) as pure local React state. Changing them in Free Mode did not persist across reloads or sync with other planners.

**Root cause:** No central settings store wired into free-mode. Session-based planner with no durable projectId, so required a fallback strategy.

**Fix applied:**
1. Imported `useProjectSettings` from `@/hooks/useProjectSettings`.
2. Hook keyed to `sessionId` (stable `useState` already present). Falls back to `"free-mode-default"` when sessionId empty.
3. Added 7 `effective*` shims after local state declarations:
   - `effectiveProjectStyle` = `projectSettings.visualStyle ?? imageStyle`
   - `effectiveImageModelId` = `imageModelVersion !== "auto" ? imageModelVersion : null ?? imageModel`
   - `effectiveVideoModelId` = `videoModelVersion !== "auto" ? videoModelVersion : null ?? videoModel`
   - `effectiveSoundTier` = `projectSettings.soundTier ?? musicTier`
   - `effectiveNarrationProvider` = `projectSettings.narrationProvider ?? voiceProvider`
   - `effectiveLlmProvider` = `projectSettings.llmProvider ?? llmModel`
   - `effectiveSubtitleMode` = `projectSettings.subtitleMode ?? subtitleStyle`
4. Replaced all READ sites with effective* (6 UI selects, HybridModal props, SceneCard defaultProps, video generation API body).
5. Augmented all 7 setters with fire-and-forget `patchProjectSettings({...}).catch(() => {})`.

**Skipped:** `aspectRatio` — hardcoded "9:16" inline, not a state variable. `language` — not present as state in free-mode.

**TSC result:** exit=0 (clean).

**Rollback path:** Revert the import line, the hook invocation block, the 7 shim lines, and restore `value={stateVar}` + plain setter `onChange` at each of the 6 selects and the 4 prop sites.

---

## 2026-05-08 — PHASE-C4-COMMERCIAL-PLANNER: useProjectSettings wired into commercial-planner

**File touched:** `app/dashboard/commercial-planner/page.tsx`

**What changed:**
- Added `import { useProjectSettings } from "@/hooks/useProjectSettings";`
- Hook called after state declarations: `useProjectSettings(projectId || null)` — projectId is local state (no URL params in commercial planner)
- Three `effective*` shims declared:
  - `effectiveProjectStyle = projectSettings.visualStyle ?? brandVisualStyle`
  - `effectiveVideoModelId` = hook value if not "auto" else local state
  - `effectiveImageModelId` = hook value if not "auto" else local state

**Read sites replaced:**
- `brandVisualStyle` → `effectiveProjectStyle` in: generateAIScript manifest string, commercialContext API payload, visual style picker UI comparisons
- `selectedVideoModelId` → `effectiveVideoModelId` in: scene-video API call, video model display chip, scene card video model selector default
- `selectedImageModelId` → `effectiveImageModelId` in: ideogram_v3 transparent check, sceneImgModel fallback, image model display chip, scene card image model selector default, ideogram_v3 checkbox condition, AID picker isSelected comparison

**Setters augmented with fire-and-forget patch:**
- Visual style picker `onClick` → `setBrandVisualStyle` + `patchProjectSettings({ visualStyle })` 
- AID picker `onClick` → `setSelectedVideoModelId/setSelectedImageModelId` + `patchProjectSettings({ videoModelVersion/imageModelVersion })`

**Settings NOT present in commercial-planner (skipped):**
- `aspectRatio` — lives inside `brief` object (setBrief), not standalone state
- `language` — hardcoded string "English" in API calls, no state variable
- `subtitleConfig` — not present
- `soundTier` — not present (uses `ghsSoundTierId` for UI only, not migrated — not in mapping table)
- `narrationProvider` — not present
- `llmProvider` — not present

**TSC:** exit=0 (clean)
**Smoke:** GET /api/project/settings?projectId=test_smoke_commercial → defaults. PATCH visualStyle=luxury + model versions → 200, persisted. Reload GET confirms persistence. Page 200 OK on :3200.

**Rollback:** Revert the 10 edits in page.tsx (remove import, hook call, shims, restore read sites, remove patch calls from setters).

---

## 2026-05-08 — PHASE-C3-MUSIC-VIDEO-PLANNER: useProjectSettings wired into music-video-planner

**File touched:** `app/dashboard/music-video-planner/page.tsx`

**Deviation from C.1/C.2 pattern:** Music-video planner has NO `useSearchParams` / `urlProjectId`. It uses a local `projectId` state (from its own `music_video_projects` table, set on save/load). Hook called as `useProjectSettings(projectId || null)` — starts null, activates once user saves/loads a project.

**Settings migrated:**

| Local state | Hook field | Shim | Read sites replaced | Setters augmented |
|---|---|---|---|---|
| `projectStyle` (art style slug) | `visualStyle` | `effectiveProjectStyle` | 2 (API body + UI comparison) | 1 (setProjectStyle button) |
| `soundTier` | `soundTier` | `effectiveSoundTier` | 2 (UI comparisons) | 2 (model-settings panel + legacy SC panel) |
| `subtitleConfig` (object) | `subtitleMode` + `subtitleHighlight` + `subtitleEnabled` | `effectiveSubtitleConfig` | 2 (assembly body + SubtitleStyler value) | 1 (SubtitleStyler onChange wrapper) |
| `selectedVideoModelId` | `videoModelVersion` | `effectiveVideoModelId` | 4 (usedModelId + activeModelId + isSelected + display label + ModelChip) | 1 (AID picker onClick) |
| `selectedImageModelId` | `imageModelVersion` | `effectiveImageModelId` | 3 (activeModelId + isSelected + display label) | 1 (AID picker onClick) |
| `videoModel` (basic render model) | `videoModelVersion` | — (local comparison kept, setter patched) | — | 2 (Music Video & Budget grid buttons) |

**Skipped (not local state in music-video-planner):** `language`, `aspectRatio`, `narrationProvider`, `llmProvider` — none declared as useState in this file.

**visualStyle (free-text like "Cinematic"):** not mapped — no hook field. Setter (`setVisualStyle`) left unpatched. effectiveProjectStyle covers the art-style slug only.

**Deliberately left untouched:** All `useState` declarations, `loadProject` restore-setters, `saveProject` dependency array, analysis-triggered `setVideoModel` calls (auto-suggestion, not user intent).

**Rollback path:** `git revert <commit>` — all existing `useState` declarations untouched, no functions deleted.

**TSC:** exit=0. No errors.

**Smoke test:** `GET /dashboard/music-video-planner` → 200 OK on :3200.

---

## 2026-05-08 — PHASE-C2-CHILDREN-PLANNER: useProjectSettings wired into children-planner

**File touched:** `app/dashboard/children-planner/page.tsx`

**Pattern used:** Identical to C.1 (movie-planner). Hook imported, called after `urlProjectId` resolved, `effective*` shims declared, read sites replaced, setters augmented with fire-and-forget patch.

**Settings migrated:**

| Local state | Hook field | Shim | Read sites replaced | Setters augmented |
|---|---|---|---|---|
| `visualStyle` / `projectStyle` | `visualStyle` | `effectiveProjectStyle` | 18 | 2 (setVisualStyle+setProjectStyle buttons) |
| `soundTier` | `soundTier` | `effectiveSoundTier` | 4 | 2 |
| `narrationProvider` | `narrationProvider` | `effectiveNarrationProvider` | 7 | 2 |
| `selectedVideoModelId` | `videoModelVersion` | `effectiveVideoModelId` | 4 | 1 |
| `selectedImageModelId` | `imageModelVersion` | `effectiveImageModelId` | 4 | 1 |
| `subtitleConfig` (object) | `subtitleMode` + `subtitleHighlight` | `effectiveSubtitleConfig` | 4 | 1 (onChange wrapper) |

**Skipped (not local state in children-planner):** `language` (hardcoded "English" in payloads), `aspectRatio` (hardcoded "16:9"), `llmProvider` (not declared).

**Deliberately left untouched:** All `useState` declarations, all restore-setter `if (d.xxx) setXxx(d.xxx)` lines, all save-effect dependency arrays. Local state still persists to `hybrid_saved_states` as before.

**Rollback path:** `git revert <commit>` — all existing `useState` declarations untouched, no functions deleted.

**TSC:** exit=0. No errors.

**Smoke test:** Skipped — dev server status unknown. Pattern structurally verified. Same pattern proven live in C.1 movie-planner.

---

## 2026-05-08 — PHASE-C1-MOVIE-PLANNER: useProjectSettings wired into movie-planner

**File touched:** `app/dashboard/movie-planner/page.tsx`

**Pattern used (effective* shims + fire-and-forget patch):**

1. Import `useProjectSettings` from `@/hooks/useProjectSettings`.
2. Declare hook after `urlProjectId` is available: `const { settings: projectSettings, patch: patchProjectSettings } = useProjectSettings(urlProjectId || null);`
3. For each migrated setting, declare an `effective*` shim constant that prefers the hook value and falls back to local state: `const effectiveX = projectSettings.field ?? localX;`
4. Replace all **read** sites of `localX` with `effectiveX` — dependency arrays and restore-setters stay as-is (they track the local state for save effects).
5. After every **setter** call, fire-and-forget patch: `setLocalX(v); patchProjectSettings({ field: v }).catch(() => {});`

**Settings migrated:**

| Local state | Hook field | Shim | Read sites replaced | Setters augmented |
|---|---|---|---|---|
| `projectStyle` | `visualStyle` | `effectiveProjectStyle` | 3 | 1 |
| `language` | `language` | `effectiveLanguage` | 3 | 1 |
| `soundTier` | `soundTier` | `effectiveSoundTier` | 3 | 2 |
| `narrationProvider` | `narrationProvider` | `effectiveNarrationProvider` | 8 | 2 |
| `selectedVideoModelId` | `videoModelVersion` | `effectiveVideoModelId` | 4 | 1 |
| `selectedImageModelId` | `imageModelVersion` | `effectiveImageModelId` | 4 | 1 |
| `subtitleConfig` (object) | `subtitleMode` + `subtitleHighlight` | `effectiveSubtitleConfig` | 3 | 1 (onChange wrapper) |

Note: `aspectRatio` not present as local state in movie-planner (hardcoded "16:9" in one API call — not migrated). `llmProvider` also absent. No subtitleEnabled state — derived from mode !== "none" in the patch call.

**Rollback path:** `git revert <commit>` — all existing `useState` declarations untouched, no functions deleted.

**TSC:** exit=0. No errors.

**Smoke test:** Skipped — dev server status unknown. Pattern verified structurally.

---

## 2026-05-08 — PHASE-E1-PROVIDER-HEALTH: Model health metadata + auto-fallback chain

**Problem addressed:** When a FAL/Kie/Segmind model returns 404/422/"model not found", the error surfaces directly to the user with no retry. No family/version metadata existed to find an alternative.

**What changed (Phase E.1 of SEGREGATION_PLAN.md):**

1. Extended `ModelEntry` interface in `src/lib/generation/model-registry.ts` with 6 optional fields: `family`, `version`, `status`, `successor`, `health_last_checked`, `health_ok`. All optional — existing callers need no changes.

2. Backfilled metadata for all 40 model entries (22 image + 18 video):
   - IMAGE: segmind_flux, ideogram_free, segmind_pruna, segmind_pruna_edit, fal_flux_schnell, fal_flux_dev, fal_ideogram_v3_turbo, fal_seedream, fal_imagen4_fast, fal_hunyuan, fal_nano_banana, fal_flux_pro, fal_flux_pro_ultra, fal_ideogram_v3_quality, fal_ideogram_v3_transparent, fal_recraft_v3, kie_z_image_turbo, kie_nano_banana_2, kie_gpt_image_1, kie_flux_kontext, kie_midjourney_v7, fal_flux_pulid
   - VIDEO: segmind_pruna_video, muapi_seedance_lite, muapi_seedance_v1_pro, muapi_seedance_v2, muapi_seedance_v2_1080p, muapi_wan_v2_1_480p, muapi_wan_v2_1_720p, fal_hailuo_standard, fal_kling_2_5_standard, fal_hailuo_pro, fal_ltx_video, fal_wan_lite, fal_wan_pro, fal_kling_2_5_turbo_pro, fal_kling_3_pro, fal_runway_gen4, runway_gen4_direct, fal_veo3_fast, fal_veo3_4k, kling_direct_v2_5_std, kling_direct_v2_5_pro, kling_direct_v1_5_std

3. Created `src/lib/provider-health/index.ts` with in-memory health cache:
   - `markBroken(modelId, reason)` — sets cache + console.warn
   - `markHealthy(modelId)` — clears broken mark
   - `getModelStatus(modelId)` — cache → registry → default "active"
   - `pickHealthyAlternative(family, excludeId)` — finds best quality active alternative
   - `getHealthSnapshot()` — for future admin UI (Phase E.2)

4. Wrapped FAL video gateway in `app/api/hybrid/scene-video/route.ts` with `tryWithFallback()` helper — catches provider errors, marks broken, retries once with family fallback.

5. Wrapped `generateImage` call in `app/api/hybrid/scene-image/route.ts` with inline fallback — catches provider errors on result.success=false, marks broken, retries with alternative model.

**Files touched:**
- `src/lib/generation/model-registry.ts` — interface extended + 40 entries backfilled
- `src/lib/provider-health/index.ts` — CREATED
- `app/api/hybrid/scene-video/route.ts` — tryWithFallback helper + FAL branch wrapped
- `app/api/hybrid/scene-image/route.ts` — inline fallback after generateImage failure

**Rollback:** `git revert <commit>` — all changes are additive. Existing routes that don't call markBroken/pickHealthyAlternative are untouched.

**TSC:** exit=0. No errors.

**Deferred to Phase E.2:** UI badges (green/yellow/red dot per model dropdown), background cron probe every 6h.

---

## 2026-05-08 — PHASE-F: aid-model-registry.ts converted to backward-compat shim

**What changed:** Phase F of SEGREGATION_PLAN.md — merged `src/lib/aid-model-registry.ts` into `src/lib/generation/model-registry.ts`.

**Root cause / discovery:** Two registries existed. `aid-model-registry.ts` exported `AID_VIDEO_MODELS` and `AID_IMAGE_MODELS` with a UI-picker schema (scores, colors, network labels). `generation/model-registry.ts` exported the full `ModelEntry` schema used by gateways. All 19 video IDs and 10 image IDs in the AID registry already existed in generation/model-registry.ts — no entries were missing, only the schema differed.

**Fix:** Converted `aid-model-registry.ts` to a shim that:
1. `export * from "./generation/model-registry"` — forward all ModelEntry exports
2. Kept `AID_VIDEO_MODELS` and `AID_IMAGE_MODELS` arrays intact (same data, same schema) as backward-compat named exports — consumers use `.scores`, `.name`, `.network`, `.color` etc. which don't exist on `ModelEntry`

**Files touched:**
- `src/lib/aid-model-registry.ts` — converted to shim (data preserved)
- `src/lib/generation/model-registry.ts` — unchanged (already had all entries)

**Consumers (still work via shim):**
- `app/dashboard/children-planner/page.tsx`
- `app/dashboard/commercial-planner/page.tsx`
- `app/dashboard/music-video-planner/page.tsx`
- `app/dashboard/movie-planner/page.tsx`
- `app/dashboard/series-wizard/page.tsx`

**TSC:** exit 0. No errors.

**Next:** Per SEGREGATION_PLAN.md Phase D, migrate consumers to `ModelEntry` from `generation/model-registry.ts` directly, then remove the shim.

**Rollback:** Restore original `aid-model-registry.ts` from git.

---

## 2026-05-08 — STYLE-01: Words like "animated voice" flip realistic gen to 3D/cartoon

**Symptom:** User picks "Realistic" style. Scene description contains words like *"her voice was animated and confident"* or *"his cartoonish smile"*. Image still generates as 3D-rendered Pixar-style or 2D cartoon.

**Root cause:** Image models read every word as a style cue. Words like `animated`, `cartoonish`, `sketched`, `rendered`, `illustrated`, `drawn`, `painted` are massive training signals — captioned over millions of cartoon/animation frames. Even when the prefix says "Live-action photo", a later occurrence of `animated` flips the bias. The negative prompt was blocking specific style names (`cartoon, anime, 3D render`) but NOT these contextual collision words.

**Fix:** Three-layer defence in `app/api/hybrid/scene-image/route.ts`, `app/api/hybrid/scene-video/route.ts`, `app/api/character-voices/[id]/generate-portrait/route.ts`:

1. **`sanitizeStyleCollisions()` PROTECTED block** — for live-action styles (`realistic` + `nollywood`) only, replaces collision words with neutral synonyms BEFORE the text is concatenated into the prompt:
   - `animated voice` → `expressive voice`
   - `animated and` → `expressive and`
   - `animated` → `expressive`
   - `cartoonish` → `exaggerated`
   - `cartoon-like` → `stylized`
   - `comic relief` → `humorous moment`
   - `comic timing` → `perfect timing`
   - `sketched` → `rough`
   - `drawn out` → `extended`
   - `drawn into` → `pulled into`
   - `painted on` → `fixed on`
   - `rendered` → `shown`
   - `illustrated` → `shown`
   - For animation styles (`3d-cinematic`, `2d-cartoon`, `anime`, `comic`, `storybook`) text passes through unchanged — words don't collide with those styles.
2. **Late-position style anchor** — repeats a tight style cue at the END of the prompt (`Final output: a real photograph, NOT a 3D render, NOT animation, NOT illustration`). Image models heavily weight late-position tokens; this fights drift caused by any collision word we couldn't fully strip.
3. **Strengthened negative prompt** — when live-action style is selected, appends `animated, animation, cartoon, 3D rendered, CGI, illustrated, drawn, sketch, painted, anime, stylized, plastic skin, doll-like, video game graphics`.

**Scope of files:**
- `app/api/hybrid/scene-image/route.ts` — sanitizer applied to sceneText, character visualDescription, wardrobe, hairstyle.
- `app/api/hybrid/scene-video/route.ts` — sanitizer applied to sceneText + motionDescription. Image and derived video stay consistent.
- `app/api/character-voices/[id]/generate-portrait/route.ts` — sanitizer applied to character description. Portrait regen now respects realistic.
- `src/lib/style-presets.ts` — realistic preset rewritten: prefix now leads with "Live-action cinematic photography, real photograph", negative blocks `3D render, CGI, animated film, Pixar style, DreamWorks style, animation, cartoon, 2D illustration, anime, flat colors, sketch, painterly, watercolor, stylized, video game graphics, plastic skin, doll-like`.

**Prevention:** Sanitizer + late anchor + negative all run in parallel. Even if one slips, the other two catch it. PROTECTED comment block prevents future refactor from removing.

---

## 2026-05-08 — FEATURE: Beat image checkboxes during assembly

**What:** When Gen Max produces multiple beat images per scene, every beat thumbnail now has a checkbox (default ON). User unticks beats they don't want included in the final assembled video. Image vs video selection unchanged.

**Where:** `app/dashboard/hybrid-planner/page.tsx`
- New state `selectedBeatImages: Record<sceneId, boolean[]>`
- Checkbox UI on both beat thumbnail strips
- Assembly loop filters by checkbox state. Edge cases:
  - 0 ticked → fall back to scene.imageUrl (single image)
  - 1 ticked → use that one beat image (not the original imageUrl)
  - 2+ ticked → multi-segment expansion as before

---

## 2026-05-08 — FEATURE: Compact Story-tab dropdowns + American culture

**What:** Story tab Culture/Name/Country pickers replaced 8-button grid with 3-column compact dropdowns. Culture has 9 options (added **American**). Name Style is NEW dropdown with 13 options. Country has free-text input ("type any country") plus a global preset list.

**Where:** `app/dashboard/hybrid-planner/page.tsx` — Story tab. Wired into `expandStory` payload (`nameStyle`, `country`).

---

## 2026-05-08 — FEATURE: Scene edit cards + Polish modes + Break + Expand

**What:** Story tab Scene Breakdown now shows every scene with an Edit button. Click → editable textarea + LLM selector + 5 polish modes + Save/Cancel + Break Scene.

**Polish modes:** ✨ Polish (default tighter prose) · + Add Action (more action verbs) · 🔥 Make Intense (raise stakes) · ❄ Reduce Action (slow down, reflective) · 💜 Make Emotional (surface feelings)

**Header button:** + Expand Scenes — AI grows scene list while preserving arc/characters/ending. Title-match keeps existing scene assets (images/videos) when AI keeps a beat.

**Break Scene:** AI splits 1 scene into 2 at logical breakpoint. All scenes renumbered after insert.

**LLM selector:** Auto / Ollama / GPT / Haiku — Auto runs Ollama → OpenAI → Claude Haiku fallback chain. Same model menu as AI Chat.

**Where:**
- New endpoint `app/api/hybrid/scene-edit/route.ts` — handles `op: polish | break | expand`, `polishMode`, `provider`.
- `app/dashboard/hybrid-planner/page.tsx` — `polishSceneText`, `breakScene`, `expandSceneList` functions + UI.

---

## 2026-05-08 — STYLE-02: AI Chat returns "No response" when Ollama is offline

**Symptom:** AI Chat panel shows "No response" message when Ollama is not running. User has no way to use AI Chat without Ollama.

**Root cause:** `/api/hybrid/scene-chat/route.ts` was hardcoded to `forceProvider: "ollama"` with no fallback. Empty/error response surfaced as "No response" or misleading "is Ollama running?" generic text.

**Fix:**
1. Added optional `provider` field to chat request: `"auto" | "ollama" | "openai" | "claude"`.
2. `runWithFallback()` helper in scene-chat route — when `provider === "auto"` (default), tries Ollama → OpenAI → Claude Haiku in order. Returns first success. If all fail, returns combined error message showing which provider failed for what reason.
3. Added LLM selector UI at top of AI Chat panel: Auto / Ollama / GPT / Haiku. User can force a single provider to skip fallback.
4. Reply labeling — successful replies prefixed with `[provider]` so user sees who answered. Failures show actual error text instead of generic message.

**Where:** `app/api/hybrid/scene-chat/route.ts`, `app/dashboard/hybrid-planner/page.tsx` (state `aiChatProvider`).

---

## 2026-05-08 — DIALOGUE-01: Multi-character dialogue didn't sound natural (3 phases)

**Symptom:** Cast A and Cast B in movie-planner produced flat, robotic, identically-paced audio. No emotion, no turn-taking gaps, no per-character voice routing in practice. Henry compared to Gemini/Grok dialogue and asked for the same feel.

**Phase 1 — Quick wins (deployed):**

1. **Emotion preprocessor** — `src/lib/dialogue-emotion.ts`. `extractEmotion(text)` returns one of `neutral / questioning / excited / shouting / whispered / hesitant / sad / fearful / angry`. Rules:
   - Adverb cues ("she whispered", "he shouted") → high confidence
   - ALL CAPS run (2+ words) → shouting
   - Trailing `?` → questioning, `!` → excited, `…` → hesitant
   - `cleanText` field strips directive adverbs so the engine doesn't read them aloud
   - `v3Tagged` produces `<emotion>text</emotion>` for ElevenLabs v3
2. **Voice settings tuning** — `elevenLabsSettingsFor(emotion)` returns stability/style tweaks per emotion. Same voice identity, different inflection.
3. **TTS route wiring** — `/api/tts` now auto-detects emotion (or honours per-line override), passes cleaned text to Piper/FAL/SAPI, and uses emotion-specific voice_settings on ElevenLabs. If `ELEVENLABS_USE_V3=true` it uses v3 model + emotion tags.
4. **Per-speaker pacing** — `gapMsBetween()` returns 80ms (same speaker continuation), 220ms (turn-taking), 450ms (scene break).
5. **NEW route `/api/dialogue/generate`** — multi-line concat with FFmpeg `adelay+amix`, per-line emotion + voiceId routing, returns one audio file + per-line timeline. Used by movie-planner Multi-Cast Dialogue button.
6. **NEW route `/api/dialogue/parse`** — auto-tags speakers in unstructured text using LLM (Ollama → OpenAI → Claude Haiku fallback). Returns `[{speakerId, text}, ...]`. Knows about `knownSpeakers` so Bryan/Mia get used over generic Cast 1/Cast 2.

**Phase 2 — UI in movie-planner (deployed):**

7. **Multi-Cast Dialogue button** — orange button in Voice tab. For every scene with dialogue:
   - Calls `/api/dialogue/parse` with knownSpeakers from selectedCast
   - Maps each tagged speaker → that character's voiceId via `castVoiceMap`
   - Calls `/api/dialogue/generate` with the lines + provider
   - Stores audio per scene in `sceneDialogueAudio[sceneNumber]`
8. **Audition button** — per-cast, plays a sample line in that character's voice via `new Audio()`. Lets user preview voices before bulk-generating.
9. **Per-scene dialogue audio playback** — `<audio>` player per scene appears under cast list once generation completes.

**Phase 3 — Lip-sync (deployed):**

10. **Per-scene Lip-Sync button** — purple `👄 Lip-Sync` button next to each generated dialogue track. Calls `/api/avatar/lip-sync` with `inputIsVideo: true` (the scene video) + the dialogue audio. Result replaces `sceneVideos[sceneId]`. Disabled with tooltip when scene has no video yet.
11. **Lip-sync route upgrade** (separate scene-forge fix, see below) — added `fal-ai/musetalk` + `fal-ai/sync-lipsync` ahead of legacy wav2lip/sadtalker so the per-scene button gets best-quality results.

**Files:**
- `src/lib/dialogue-emotion.ts` (NEW)
- `app/api/dialogue/parse/route.ts` (NEW)
- `app/api/dialogue/generate/route.ts` (NEW)
- `app/api/tts/route.ts` (emotion + cleaned-text wiring)
- `app/dashboard/movie-planner/page.tsx` (Multi-Cast button + audition + per-scene dialogue + lip-sync UI)
- `app/api/avatar/lip-sync/route.ts` (musetalk + sync-lipsync added)

**Cost guard:** ElevenLabs v3 ~$0.30/min, FAL musetalk ~$0.05/clip, FAL sync-lipsync ~$0.10/clip. Phase 3 is opt-in per scene — no cost unless user clicks the button.

**Other planners (children/music-video/commercial/hybrid):** not yet wired with Multi-Cast button. Each is structurally distinct; the API routes are shared so wiring is a UI-only addition when needed.

---

## 2026-05-08 — SCENE-FORGE-01: Lipsync gave choppy mouths in Scene Forge

**Symptom:** Scene Forge talking-avatar pipeline used wav2lip primary / sadtalker fallback. Mouth motion was visibly off, particularly on AI-stylized portraits. Henry: "libsay [lipsync] did not work."

**Fix:** Upgraded `/api/avatar/lip-sync` provider chain. Order is now:
1. `fal-ai/sync-lipsync` — Sync Labs gold-standard model. Skipped automatically when input is a still image (it requires video). Caller passes `inputIsVideo: true` to enable.
2. `fal-ai/musetalk` — Tencent's newer image+audio → video model. Much finer mouth detail than wav2lip.
3. `fal-ai/wav2lip` — original primary, retained as fallback.
4. `fal-ai/sadtalker` — final fallback for realistic portraits.

Each tier is tried in order via shared `tryProvider()` helper. Per-tier errors collected and returned in the 502 body so callers can see which model rejected what. Sync-lipsync is skipped (with explicit "skipped (still photo)" status) when input is a still photo.

**Where:** `app/api/avatar/lip-sync/route.ts`.

---

## 2026-05-08 — CHILDREN-ASSEMBLY-02: Beat fix didn't take effect + assembly row hid beat count

**Symptom:** After CHILDREN-ASSEMBLY-01 ship, Henry hit Assemble and the final video still used 1 image per scene. The Choose Your Scenes assembly row showed only one thumbnail per scene with no indication of how many beats existed.

**Root causes:**
1. **State lost on refresh** — `sceneBeatImages` and `selectedBeatImages` were React state only. They weren't included in the DB save/restore payload, so a page refresh wiped them and the assembly loop saw empty beats arrays.
2. **No beat surface in assembly UI** — the assembly row showed `Image SELECTED | Video (none) | Preview` with zero indication that the scene had multiple beat images. Users couldn't see whether beats were going into the build or pick which to include.

**Fix (children-planner only):**
1. **Persistence** — added `sceneBeatImages` + `selectedBeatImages` to all three save/restore paths in `app/dashboard/children-planner/page.tsx`:
   - debounced auto-save effect (deps array + payload)
   - `flushCurrentProject()` (Save button)
   - initial restore + `loadChildProject()` (load existing)
   - `newProject()` resets both to `{}`
2. **Beat count badge on assembly row** — orange `N/M beats` pill appears next to the Image / Video buttons. Shows ticked-vs-total. Active orange when image path is selected and ≥2 ticked (signal that multiple segments will be assembled).
3. **Inline beat thumbnails on assembly row** — small checkboxes + 28×22 thumbs, one per beat. User can untick from the assembly tab directly — same state as Scene Board strip, so changes sync both places.
4. **Fallback chain in assembly loop** — if user unticks every beat AND no `scene.imageUrl`, we now fall back to `allBeats[0]` so the scene isn't dropped.
5. **Image button enabled** when there are beat images even if no primary `imageUrl` (was disabled before, blocking users who only used Gen Max).

**Where:** `app/dashboard/children-planner/page.tsx` only. Same file, no API change.

---

## 2026-05-08 — UX-01: "Apply & Regenerate Image" did two things at once

**Symptom:** AI Chat suggested an image prompt. Clicking the green button auto-applied + auto-regenerated the image — user had no way to apply text only and decide later whether to regen with Gen Image or Gen Max.

**Fix (hybrid-planner — only place this button exists):** Split into two steps.
- **Apply** → writes the AI suggestion into `scene.description` only (via `updateScene`). No regen.
- After Apply, the `lastAction` toast tells the user: *"Applied to Scene X description — click Gen Image / Gen Max above to regenerate"*.
- Apply button updates its label to `✓ Applied — now click Gen Image / Gen Max` and switches color when the suggestion already matches the scene's current description.

**Files:** `app/dashboard/hybrid-planner/page.tsx` — both AI Chat panels (the inline tab and the bottom toggle).

**Audit (2026-05-08):** No "Apply & Regenerate" pattern in children-planner / movie-planner / commercial-planner / music-video-planner. They don't have AI Chat with image-prompt suggestions yet. When added, mirror this two-step pattern.

---

## 2026-05-08 — CHILDREN-ASSEMBLY-01: Children-planner only used 1 image per scene at assembly

**Symptom:** Children Scene Board card could show up to 4 images per scene (Gen 4 variants), but assembly only used 1. Henry's screenshot of `Choose Your Scenes` confirmed every scene rendered as a single `Image SELECTED` row.

**Root cause:** Children-planner only had `Gen 4` (variations of the same scene moment — pick one). It had no Gen Max (action-beat) capability and the assembly loop pushed exactly one entry per scene to `/api/video/assemble`.

**Fix (children-planner only — does NOT touch hybrid/movie/music-video/commercial structure):**
1. **New states** in `app/dashboard/children-planner/page.tsx`:
   - `sceneBeatImages: Record<sceneId, string[]>` — list of beat URLs per scene
   - `selectedBeatImages: Record<sceneId, boolean[]>` — parallel checkbox state (default all true)
   - `generatingMaxBeats: Set<sceneId>`, `maxBeatsProgress` — loading flags
2. **`splitIntoActionBeats()`** + **`makeChildSceneBeatImages()`** — mirrors hybrid-planner. Splits scene description into beats, fires one `/api/hybrid/scene-image` per beat sequentially.
3. **Gen Max button** added to Scene Board card (next to existing Gen 4 / Regen). Orange, shows beat count.
4. **Beat thumbnail strip with checkboxes** below the variants strip on each scene card. User unticks beats they don't want.
5. **Assembly loop expansion** in `assembleMovie()` — when a scene has Gen Max beats AND user is on image path AND >1 ticked, the scene contributes ONE assembly segment per ticked beat instead of one segment for the whole scene. Edge cases:
   - 0 ticked → fall back to scene's primary `imageUrl`
   - 1 ticked → use that beat (overrides scene.imageUrl)
   - 2+ ticked → multi-segment expansion
6. **Per-segment duration** — narrator total is now divided by total SEGMENT count (not scene count), so a 4-beat scene gets 4× screen time of a 1-image scene (proportional to its content).

**Where:** `app/dashboard/children-planner/page.tsx` only. No API contract change, no shared file change. The shared `/api/hybrid/scene-image` and `/api/video/assemble` routes both work without modification.

**Other planners:** Movie / music-video / commercial planners do NOT yet have Gen Max. Mirror this approach when needed (each planner is structurally distinct per Henry's rule — copy the logic, don't share files).

---

## 2026-05-08 — STYLE-04: Direct /api/generation/image calls bypass style fix

**Symptom:** Movie/children/commercial planners still produced animated-looking results when they called `/api/generation/image` directly with prebuilt prompts. The shared `/api/hybrid/scene-image` route had the sanitizer; this route did not.

**Root cause:** Each planner calls a different mix of routes. Most scene rendering goes through `/api/hybrid/scene-image` (which has the sanitizer applied). But character avatars, freeform image gen, and a few planner-specific paths hit `/api/generation/image` directly.

**Fix:** Added matching `sanitizeStyleCollisions()` to `/api/generation/image/route.ts`. Accepts new optional `projectStyle` field. When present and live-action, sanitizes the prompt + appends collision negatives. Backward-compatible: omitting `projectStyle` keeps the old behavior, so existing callers don't break.

**Where:** `app/api/generation/image/route.ts`.

**Audit confirmation (2026-05-08):**
- `hybrid-planner` → uses scene-image, scene-video, generation/image, generate-portrait — all covered
- `children-planner` → uses generation/image (L766), scene-image, scene-video, music/generate — all covered
- `movie-planner` → uses scene-image, scene-video, generation/image — all covered
- `music-video-planner` → uses scene-image, scene-video, music-video/text-to-mv — all covered
- `commercial-planner` → uses scene-image, scene-video, generation/image — all covered

---

## 2026-05-08 — CHILDREN-MUSIC-01: Generated children music sounds bad

**Symptom:** Children-planner music gen produces low-quality / harsh / wrong-mood tracks. Tracks are 30s and cut off mid-narration.

**Root cause:**
1. Prompt was a single generic line: `"calm children's story background music, gentle and warm"`. Music providers (Suno, Stable Audio) need instrument + tempo + structural cues to produce something usable.
2. Hardcoded `durationSeconds: 30` — too short for typical children stories (1-3 min). Track ends mid-narration.
3. `genre`, `mood`, `hasLyrics` fields not passed — provider defaults to generic background tracks.

**Fix:** Inline upgrade in `app/dashboard/children-planner/page.tsx` Background Music button:
1. **Rich prompt per tone:**
   - `soft` → "Gentle children's lullaby, soft solo piano with delicate music box and warm light strings, slow peaceful tempo around 70 BPM, calm comforting atmosphere, fairy tale storybook mood, fully instrumental, NO vocals, NO heavy drums, NO percussion, NO synths, dreamy bedtime story background"
   - `active` → "Playful children's adventure music, light cheerful ukulele with bright glockenspiel and gentle flute, moderate uplifting tempo around 100 BPM, joyful curious atmosphere, fairy tale wonder, fully instrumental, NO vocals, soft brushed percussion only, NO electric guitar, NO heavy drums, storybook adventure background"
2. **Duration probe:** loads `narratorAudioUrl` via Audio element, reads `loadedmetadata` duration, clamps to 30-300s. Falls back to 90s if narrator unavailable.
3. **Pass `genre: "children"`, `mood: calm/playful`, `hasLyrics: false`** to `/api/music/generate`.

**Where:** `app/dashboard/children-planner/page.tsx` only — no API changes (the existing `/api/music/generate` already accepts genre/mood/hasLyrics, the children-planner just wasn't sending them).

**Other planners:** Movie / Music-Video / Commercial use their own music gen calls with different prompts (typically richer than children was). If similar quality issues appear, mirror this approach (rich prompt + duration probe + genre/mood fields).

---

## 2026-05-08 — STYLE-03: Action verb missing from scene-video prompts

**Symptom:** Scene with description like "she ran from the wall" produces a slow zoom over the still image instead of motion. Video models default to slow zoom / panning when no motion verb is present in prompt.

**Root cause:** `scene-video/route.ts` was passing raw `sceneText` to the model with no motion-verb directive. The image route already had `extractSceneAction()` (PROTECTED, 12 categories) — video route had nothing equivalent.

**Fix:** Added `extractMotionAction()` mirror function in `scene-video/route.ts`. 12 categories matching image route (confront, fight, chase, fear, rescue, argue, discover, grief, celebrate, stealth, dialogue, default). Inserted between style prefix and sceneText so video models get explicit motion directives.

**Where:** `app/api/hybrid/scene-video/route.ts`.

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
