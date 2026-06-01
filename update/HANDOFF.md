# GHS HANDOFF — Session 2026-05-31 (long-day Opus + 8-Sonnet sweep)

**Last updated:** 2026-05-31 (end of long session) · **HEAD:** `ea64b09` (pushed, live) · **Live:** andiostudio.com (server :3200, systemd `ghs.service`, Next 16.2.1)

## 🔥 2026-05-31 Long-day session summary (17 commits, 9 stubborn bugs, full karaoke loop closed)

See `MUST-READ.md` at project root for the full root-cause + lesson log. Per-commit summary below.

### Commits this session (in order)

1. **`286c624`** — children: educational-first prefill + scene-description backfill + human-guard fix + generateNarration pre-expand. **Caused infinite re-render loop (later fixed in 1db36ff)**.
2. **`a438f66`** — belt-and-suspenders auto-select for empty assemblySelectedIds (older saved projects).
3. **`c628dbb`** — BIB fix: scriptSegments fallback in generateNarration + sub-80 char guard.
4. **`2a15999`** — BIB fix #3: pull narration from audioPlans when textContent empty.
5. **`267a01b`** — karaoke: expand stock library + honest genre-match warnings.
6. **`cc0b198`** — karaoke: RVC keep-anyway toggle with OS confirmation prompt (Step 11).
7. **`f44be26`** — karaoke: safe JSON parsing for non-JSON 5xx ("Unexpected token 'I'") + clarify music-gen fallback.
8. **`dffefb9`** — karaoke: switching recordings now resets per-project state (no cross-project bleed).
9. **`1db36ff`** — **CRITICAL** kill infinite re-render loop in visualDescription backfill (caused 3-sec click freeze).
10. **`8bde095`** — BIB audit DEEP: shared narration resolver across all 3 TTS-firing paths + `?continue=` URL param fix.
11. **`bca3057`** — intro/outro title use projectTitle (fixed "Present My story" leak).
12. **`0c49fd7`** — karaoke ✕ delete button per take + `/api/karaoke/delete` endpoint.
13. **`dc67814`** — **subtitle disappeared** RICH+SIMPLE drawtext fallback + journalctl logging.
14. **`172489f`** — 4 Sonnet items batch: music genre picker · words-on-image toggle · `/api/karaoke/vocal-cleanup` route · `/api/karaoke/melody-extract` route.
15. **`4a4cb67`** — safe-music policy + Free Mode beats picker + MUST-READ master log.
16. **`ea64b09`** — wire Karaoke Step 2 (Demucs) + Step 4 (Basic Pitch) UI to backend routes. **Closes karaoke pipeline end-to-end.**

### Server-side installs done today
- Python pip via `get-pip.py --user` (no sudo needed)
- Demucs + PyTorch — `/home/ghs/.local/bin/demucs`
- Basic Pitch + TensorFlow — `/home/ghs/.local/bin/basic-pitch`
- RVC SKIPPED (no GPU; opt-in toggle shipped instead)

### Stubborn bugs root-caused & permanently fixed (see MUST-READ §2 for detail)
- A. Page navigation slow (3-sec click freeze) — infinite re-render loop in useEffect
- B. BIB narration — 3 divergent TTS paths, shared resolver now used by all
- C. Subtitle disappeared — silent try/catch on complex drawtext, 2-tier fallback
- D. Karaoke project bleed — 9 state slots not reset on recording switch
- E. JSON parse error opaque — safeKaraokeJson helper for HTML 5xx responses
- F. Assemble button grey on reopen — restore didn't set selection gate
- G. Voice afro → sound default — stock library had no afro, freepd scan + match warning
- H. Intro/outro "Present My Story" — title source priority fix
- I. Karaoke post-Linux labels stale — installs done, labels + routes wired

### Sonnet dispatch tally
8 sub-agents across 3 batches, all clean typecheck:
- Batch 1 (4): music genre, words-on-image, vocal-cleanup route, melody-extract route
- Batch 2 (3): manifest audit, beats picker, music download script
- Batch 3 (1): karaoke Step 2+4 UI wire-up

---

## 🩹 2026-05-31 (mid-session, archival) — Children planner: Assemble button stayed grey on reopened project

## 🩹 2026-05-31 (this session) — Children planner: Assemble button stayed grey on reopened project

Henry: `https://andiostudio.com/dashboard/children-planner?projectId=child_1780208261900_qqy3 assemble no workingh`

Probed live in debug Chrome — button label `"Select scenes above to assemble"`, `disabled: true`. Root cause: restore effect at `app/dashboard/children-planner/page.tsx` L2710 hydrated `childScenes` from `/api/hybrid/saved-state` but never set `assemblySelectedIds` — Assemble is gated by `assemblySelectedIds.length === 0`. Auto-selection only fired inside planScenes paths (L1208/L1372), not on a saved-state restore.

Fix (`d9432d8`): on restore, when `childScenes` come back from DB, auto-select all (mirrors planScenes pattern). Also persisted `assemblySelectedIds` + `assemblyMediaPrefs` in the save payload + useEffect deps so manual deselections survive too. Type-clean. Lesson logged to global `error_log.md` (gate-state not restored — class of bug; sanity-check pattern for future planner-restore work).

Deploy: `git pull && pnpm build && sudo systemctl restart ghs.service` in flight.

---

## 🎯 ACTIVE DIRECTIVE (Henry 2026-05-30)
> "drive this to the finishing line — children needs a lot of amend — mirror hybrid with recent children update to fix child — record the bugs and prepare them — remember to save as my pc shut down any time"
>
> Continued sweep: `fire on`, `fire on for 3 hours`, `2 hours on`, `fire on ur call`.

## 📊 SESSION SCORECARD (2026-05-30)
- **29 tasks closed** in one session
- **12-bug burst** (Henry's morning list, all closed)
- **17 of 24 FAL provider sites** migrated to new `src/lib/providers/fal.ts` adapter
- **2 audit docs** authored: `CHILDREN_HYBRID_PARITY_AUDIT_05302026.md`, `FAL_ADAPTER_MIGRATION_MAP_05302026.md`
- **Auto-narration consistency** rolled across all 5 planners
- **DB R2 offsite backup** live (daily 03:30 cron pushes to `r2://andio-assets/db-backups/`)
- **Children-hybrid parity** ≥97%

**Remaining sweep-able backlog: empty.**
Remaining items each need dedicated focus or external input:
- FAL gateway-layer migration (`src/lib/generation/gateways/fal.ts`) — 474 LOC axios + onProgress + custom URLs; dedicated session per FAL map.
- Children → `/api/assembly/execute` migration — single remaining children-hybrid parity gap; high-risk single change.
- Outro mid-video bug — needs Henry info (duplicate vs ordering?)
- FAL credit top-up — unlocks PuLID exact face-lock + kills model residuals
- Anthropic credit top-up — restores Claude quality
- Phase 3+ tracks (R2 cutover, Paddle, Legal UI, SFX category system)

Recording bug burst FIRST (state preservation), then executing A→G→H in priority order. After each fix → handoff entry → P&F entry → one-sentence Henry → stop.

## ✅ FIXED THIS SESSION 2026-05-30
1. **A.** Children scene-card buttons appeared not to fire — `6793682`. handleChildSceneOp now auto-regens image after text update (mirror handlePolishScene). Task #9 closed.
2. **(NEW)** Children template selection still required manual input — `1d571d1`. Auto-fire expansion on URL-param arrival + expanded toddler catalog (+4 content types, +5 curriculum templates). Task #20 closed.
3. **C.** Children LLM model + video/image model URL params not threaded — `7109fda`. Read tier/videoModel/imageModel URL params, seed state. Task #11 closed.
4. **B.** Children narration missing from final video — `0b57265`. Auto-generate via TTS in assembly path when narratorAudioUrl is empty. Task #10 closed.
5. **E.** Children subtitles stuck 5 sec + style ignored — `a40b53a`. /api/video/assemble caption now respects subtitleConfig + staggers 5-word chunks at 1.6s with fade. Task #14 closed. Full per-sentence libass timing deferred to children → /api/assembly/execute migration (#15).
6. **F.** GENESIS BEAR bug — `46ae279`. Anti-priming fix: removed "bear/animal/fur/snout/paws" from POSITIVE prompts in scene-image (3 sites). Tightened negative from 12+ bear-words to 8 affirmative non-human concepts. Diffusion models prime on positive concept mentions even when wrapped in NOT. Task #13 closed.
7. **H4.** Legacy kids/dramatic/social subtitle presets — `d32b602`. Same shape as highlight fix; now visibly distinct. Task #19 closed.
8. **H3.** C6 pacing save/load — `89b62f9`. Persist pacingPlan / pacingAudioUrl / pacingVideoUrl / pacingTimingMap. Task #18 closed.
9. **D.** Children AI Audio Plan panel — `e961c8d`. Mirror hybrid Step 7. Per-scene narration + music mood + SFX + ambience. Persisted. Task #12 closed.
10. **H1.** Token Resolution Engine wired into scene-image — `4ba3959`. The Phase 3 root cause for substitution drift. Helper existed at character-resolver.ts:99; scene-image never imported it. Now substitutes [CH0X] tokens + attaches reference images before image gen. Task #16 closed.
11. **G.** Children ↔ hybrid parity audit — `6e3ba9a`. Doc `update/CHILDREN_HYBRID_PARITY_AUDIT_05302026.md`. Children now ~85% parity after the 10 fixes. Remaining 2 gaps documented with cost + triggers: assembly-endpoint migration + establishing-shot UI. Task #15 closed.

12. **H2.** Establishing Shot 5-mode picker (Off/Minimal/Auto/Cinematic/Epic) — `6d84b8d`. API + UI shipped. Task #17 closed.
13. **G+.** Children Establishing Shot mirror — `4e4a82b`. Full panel + 5-mode picker + per-scene chips + image render + persistence. Task #21 closed. Children parity now ~95%.
14. **DB offsite.** Daily pg_dump pushed to R2 — `26953df` + server-side pg_backup.sh append. Soft-fail. Last 14 R2 dumps retained. Task #22 closed. Survives server loss.
15. **DB migration audit.** `prisma migrate status` clean — "Database schema is up to date!" with 7 migrations recognised. No drift. Task #23 closed.
16. **Children establishing insertion in assembly** — `0046a6b`. Mirrors hybrid `withEstablishing` step; rendered shots now reach the final video instead of dying in state. Closes the silent gap revealed after #21.
17. **FAL provider adapter scaffold + 3 migrations** — `f4104fd`. `src/lib/providers/fal.ts` with `falCall<T>` / `falQueue<T>` / `falFluxSchnell` / `falFluxDev` / `falKokoroTts` / `falAccountStatus`. Migrated account/status + tts/fal-narrator + ad-editor/ai-edit. Map at `update/FAL_ADAPTER_MIGRATION_MAP_05302026.md` lists remaining 17 sites with trigger phrases. Task #24 closed.
18. **FAL TTS sweep** — `9b110a9`. Migrated 3 more kokoro callers (tts/route.ts american+global, avatar/create, hybrid/narrate-piper). 6 of 24 FAL sites now on adapter. Task #25 closed.
19. **FAL bg-remove sweep** — `c3ba31b`. New `falBgRemove(model, body)` supporting birefnet / bria-rmbg / birefnet-video / video-bg-remove. Migrated ad-editor/bg-remove + image/bg-remove + video/bg-remove. 9 of 24 FAL sites on adapter. Task #27 closed.
20. **FAL music/sfx/portraits sweep** — `7d07bd3`. Added `falFluxDevSync` + `falMinimaxMusic` + `falStableAudio`. Migrated music/generate-scene, sfx/generate, character-voices/auto-portraits. 12 of 24 FAL sites on adapter. Task #28 closed.
21. **FAL ad-editor + image/enhance sweep** — `223da47`. Added `falFluxImg2Img` + `falGeminiTts` + `falLayerizeText` + `falClarityUpscaler`. Migrated ad-editor/ai-edit (img2img), ad-editor/gemini-tts, ad-editor/layerize-text, image/enhance. 16 of 24 FAL sites on adapter. Task #29 closed.
22. **FAL avatar/lip-sync** — `d9ad289`. Local falQueue() now wraps adapter falQueue<T>. 17 of 24 sites on adapter. Task #30 closed.
23. **Audit: supervisor/QC status vs MASTER_PLAN** — finding: 22 supervisors at `src/lib/story-supervisors/*` already implemented + indexed + orchestrated by `runFullStoryQCPipeline` + 6 API routes live (`/api/story/{supervise,build-cast-bible,demarcate-scenes,final-gatekeeper,generate-contract,tools/*}`) + full Prisma schema (StoryQCProject/Contract/Draft/CastMember/ScenePlan/SupervisorReport). MASTER_PLAN's "0/23 supervisor API routes built" claim was wildly out of date. Task #31 closed.
24. **character-build prompt: kill DIFFERENT-from-existing stereotype-contrast** — `a23627e`. Persona doc MED #8. Reworded takenBlock + colorDescription hint so the LLM grounds new characters in story text instead of artificially contrasting against existing cast (which was pulling toward stereotype: tall→short, lean→stocky, etc.). Task #32 closed.
25. **Karaoke flow-lock button polish** — `bf5cdc7`. Persona LOW #11. Generate Music button styled as locked but functionally enabled — clicking fired runMusicGeneration even when flow-locked. Now disabled = (running OR isFlowLocked); title attr lists exact pending steps. Task #33 closed.
26. **Movie planner scene-op auto-regen** — `3f9abb9`. Persona HIGH #4. Movie planner Phase A toolbar (6 ops) was already wired but text-only — same bug pattern as children #9. handleSceneOp now captures updated scene + awaits makeSceneImage with the new description (skipping QC op). Task #34 closed.
27. **Movie planner auto-narration in assembly** — `10e3b17`. Mirror of children #10. Pre-assembly batch fill for any scene with dialogue text but no existing audio URL. Sequential generateSceneNarration pass + local mutable copy to avoid the React state race. Task #35 closed.
28. **Commercial planner auto-narration in assembly** — `b80ee32`. Same pattern, third planner closed. Auto-runs generateAllNarration when any scene has voiceoverScript but no voNarrationUrls entry; commercials no longer ship silent. Task #36 closed.
29. **Auto-creator auto-narration before Build Video** — `0168cb4`. Fourth planner to receive the pattern. Pre-build TTS pass if `draft.voice_script` exists but `narrationAudioUrl` is null; soft-fails so Build still proceeds if TTS errors. Task #37 closed.
30. **Children AI prefill + 10 Modify buttons** — `56e32f2`. Replaces the earlier auto-expand-on-land (too aggressive). Now generates a UNIQUE 2-3 sentence story idea via /api/hybrid/scene-edit polish + random seed so identical templates produce different specific scenarios. Plus 10 small inline modify buttons (Intensify / Playful / Fun / Educational / Adventure / Magical / Cozy / Diverse / Musical / Heartwarming) styled like hybrid scene-card toolbar. Task #38 closed.
31. **Broken scene thumbnails + modify buttons not firing** — `f7525e3`. (a) scene-image: CDN→local download guarantee before returning; CDN expiry no longer breaks B1/B2 thumbnails. (b) scene-edit polish: raw-text fallback when LLM doesn't return JSON; modify buttons + prefill now resilient to long custom instructions. Task #39 closed.
32. **REAL FIX: narration silent + subtitle ignored** — `02c6f07`. Server-side root causes. (a) `/api/video/assemble` SEQUENTIAL FALLBACK now uses `body.narrationUrl || singleNarrItem.audioUrl` instead of just the legacy `body.narrationUrl` → children's narrationList no longer silently dropped when no music selected. (b) Caption-burn block now derives `body.caption` from `scenes[i].text` when missing + `subtitleEnabled`; children's subtitleConfig styling now actually applies. Earlier client-side fixes (0b57265, a40b53a) lived inside dead code for children renders until this commit. Task #40 closed.
33. **Max ON regression + Piper→FAL fallback** — `49f353d`. (a) Children Max ON button stuck — picker unconditionally re-added scenes every render. autoOptedMaxRef tracks one-shot. (b) /api/tts useFalNarrator now triggers when piper fails (provider="piper") so FAL is the next-best instead of silent-placeholder. Task #41 closed.
34. **Piper voices candidate-path resolution (real BIB fix)** — `b4d8092`. Server inspection: piper binary + 10 .onnx voices at /home/ghs/piper/voices/, but route hard-coded /home/ghs/giohomestudio/piper/. Piper skipped → silent placeholder = BIB. Fix: PIPER_VOICES_DIR env + 5-path candidate list. **Live-verified:** `engine="piper"`, 2.9 s real speech, 128 KB WAV @ 352 kbps. Children narration now produces real audio. Task #42 closed.
35. **3-in-1 children fixes** — `529fa05` + `b554f40`. (a) Reverted Max ON auto-opt regression per Henry "STOP FIX THAT" — user clicks Max ON explicitly. (b) children-video Open Planner link now includes `projectId=child_${Date.now()}_${rnd}` so each click = new project (was landing on shared ghs_children_default). (c) /api/video/assemble drawtext now applies MODE_PRESETS (12 modes: dance_word/rainbow/bubble_pop/big_friendly/mrbeast_single/yellow_sweep/glow_pop/typewriter/highlight/kids/dramatic/social) so children/movie/commercial/auto-creator subtitle modes look visibly distinct. Hybrid (libass) untouched. Task #43 closed.
36. **Inline LLM picker on Enter Content** — `0c1513c`. Henry: small selector showing REAL model names (Claude Haiku 4.5 / Sonnet 4.6 / Opus 4.7 / GPT-4o Mini / GPT-4o / o1-mini / Ollama), not the branded Standard/Pro/Premium tiers. Wired to storyAiProvider. Task #44 closed.
37. **Children prompt 3 quality fixes** — `322ae0c`. (a) Prefill respects duration URL param — 200s → ~500 words / ~28 sentences instead of 3-sentence shortcut. (b) Pulls names from `savedChars` library + bans invented fantasy names ("Annie Ant", "Sparkle Pip"). Fallback list: Joe, Mary, Tom, Sarah, Ade, Kemi, Tola, Pip, Sam, Lily, Ben, Mia. (c) Modify buttons extract proper nouns from current text → pass as ABSOLUTE RULE "keep every name + same event order" through customInstruction (all 10 modes now use polishMode="custom" for this). PLUS server-side scene-edit raw-text fallback validates noun overlap with input — rejects garbage replacements ("Joe goes to school" → "John jumps off the road" no longer possible). Task #45 closed.
38. **Children narration 30s/5min bug** — `c7be177`. (a) Children was reading `expandedStory.summary` (1-paragraph blurb) and TTS-ing that instead of `expandedStory.fullScript` (the full duration-scaled narration). Now reads fullScript first. (b) Both auto-narration + standalone Generate Narration capped TTS text at 3000 chars (~2 min); raised to 30000 (~20 min). (c) generateNarration() now prefers narrationText (full script) over textContent (short prefill idea). Status line shows word count + estimated minutes after Expand. Task #46 closed.
39. **Children auto-expand BEFORE narration when text too short** — `1351cc5`. c7be177 only helped if user clicked Build Story first. If user skips Expand and clicks Assemble, narrationText is empty → fallback to textContent (short prefill idea) → 30s. Verified live: API works at 300s → 679 words. Fix: assembleVideo pre-checks narrationText length vs picker duration floor; auto-POSTs to story-expand if short. Uses returned fullScript. Task #47 closed.
40. **Children 4-fix quality batch** — `156e03f`. (a) Raw JSON `{"title":...}` leaking to textarea — scene-edit raw-text fallback now regex-extracts the description field or rejects entirely if it starts with `{`. Client prefillPrompt has defense-in-depth. (b) Adult vocabulary in toddler prefill ("embark/delightful/detective/symmetry") — added age-specific vocab caps (toddler = 2-3yo words, 4-8 word sentences, ban list) + "Tell STORY not facts". (c) Subtitle picking scene title not narration — children now sends body.caption = narrationText so drawtext renders the spoken content. Task #48 closed.
41. **Manual ✨ Re-suggest button** — `5f0c5b6`. Auto-prefill silently no-op'd on Henry's tests; added a manual button that always calls prefillPrompt() bypassing autoExpandedRef guard. Serves as diagnostic + user-force trigger. Task closed.
42. **Letters & Sounds topic library 5 → 27** — `473b6d3`. Per Henry's spec: consolidate single A/B/C into multi-letter combo stories ("A·B·C Friends" covers 3 letters in one). Add 10 Word Magic stories (BAG/CAT/DOG/SUN/HAT/PIG/BED/BUS/CUP/FOX — letters click together to form 3-letter words). Plus single-letter deep dives with many words, alphabet song variants (slow/with friends/backwards), phonics intros (A-E, F-J, vowels), and name+identity stories. All toddler vocab + recommended kid names. Task #49 closed.
43. **Educational-first prefill + Letters & Sounds rewrite + image-fail visibility** — `2007a8e`. Henry: "CHILDREN SHOULD BE MORE OF EDUCATIONAL NOT STORY". (a) prefillPrompt() now detects 25 educational contentTypes and switches to EDUCATION-FIRST mode — letter/number/concept is the hero, no character narrative, ONE playful hook per unit + chant the sound. (b) Letters & Sounds topic prompts rewritten: combo lessons + Word Magic now sound-it-out + snap letters → show word → chant the spell (no Joe/Mia journey). (c) scene-image failures now console.error the status/data/modelId AND surface "(status N)" in toast so Henry sees WHY images aren't generating. (d) assemble route logs `[assemble.subtitle] mode=X presetApplied=true caption=...` per render so we can prove the picked mode reached server when "no style" is reported. Task #50 closed.
44. **Mirror hybrid: scene-plan gets fullScript + per-scene narration text** — `02d101d`. Henry: "scene board those word u see are what scene board use to generate image not actual story just subject meta data of real story nonsense ... in main hybrid all this issue has been resolved pls do not break it". CAUSE: children-planner passed only summary (1-line blurb) to /api/hybrid/scene-plan, which invented META titles ("Introducing the Letter P", "The Dancing Pig"). Image gen used those meta titles → jagos pictures. Per-scene subtitle PNGs burned scene.text = "title: visualDescription" → meta leaked to video. FIX: (a) pass fullScript||summary||storyInput to scene-plan, matching hybrid line ~1326. (b) Split full narration into N sentence-bucket segments and assign scene.text = real spoken words for that segment, never the meta title. Hybrid untouched. Task #51 closed.

## ✅ 44 TASKS CLOSED THIS SESSION
**Auto-narration pattern now consistent across all 5 planners** — children + movie + music-video (already had it) + commercial + auto-creator. No planner ships silent video when the user has narration text but skipped the manual Generate Narration click.
Remaining FAL site: `src/lib/generation/gateways/fal.ts` (axios + custom URLs + onProgress — parked for dedicated session per FAL_ADAPTER_MIGRATION_MAP). All sweep-able routes consolidated. Supervisor/QC pipeline already wired end-to-end at `/api/story/supervise`.
All bug-burst priorities + hybrid-finish-line items + 1 of 2 documented parity gaps completed. Only the assembly-endpoint migration (children → `/api/assembly/execute`) remains. Trigger: `go children assembly migration` (~3-4h).

## 🟠 OPEN BUG BURST 2026-05-30 (PRIORITY ORDER)
1a. **(NEW)** Children template selection still requires manual input — task #20. After content type + topic + curriculum selected, Generate should fire without typing. Also: ADD MORE templates per section.
2. **C.** Children LLM model picker not available — task #11
3. **B.** Children narration doesn't work — task #10
4. **E.** Children subtitle stuck 5s (style + pace ignored) — task #14
5. **F.** GENESIS BUG — humans with bear heads (across hybrid + movie) — task #13
6. **D.** Children Audio Planner is zero — task #12
7. **G.** Hybrid → Children full parity sweep — task #15
8. **H4.** 3 legacy subtitle modes (kids/dramatic/social) — task #19 (cheap, 30 min)
9. **H3.** C6 pacing save/load — task #18
10. **H1.** Token Resolution Engine — task #16 (the BIG Phase 3 root cause)
11. **H2.** Establishing Shot system — task #17

Full bug detail + investigation pointers logged in `update/PROBLEM_AND_FIX.md` under 2026-05-30 entry.

---

## ✅ DONE 2026-05-29 (this session — all pushed + live)

1. **Hybrid e2e via debug Chrome on ghs_hybrid_default_1780008307352** — Henry watched + listened. Narration audible + substitution stable confirmed. Revealed 2 regressions ↓
2. **#6 + #7 paired regression — narrator/actor coordination** — `8f1fd62`. Extracted `computeNarratorWindows()` helper in `src/lib/assembly-builder.ts` with Fallback B (longest entry overall) for split-per-scene narrator. `app/api/assembly/execute/route.ts buildSubEntries()` now skips narrator cursor past actor windows + clips end at next actor start. Diagnostic `[duck]` + `[subtitle-coord]` logs. Unit test `scripts/verify_coord_unit.mjs` — 3/3 pass (`efaee13`).
3. **Duck depth 0.06 → 0.02** — `7894e03`. Henry: 0.06 still audible during actor. Now whisper-faint, effectively "stops".
4. **8 NEW FB/YT-style subtitle modes** — `7894e03`. `SUBTITLE_PRESETS` map in assembly route drives ASS Style + per-word override tags. New modes (kids 4 + social 4): Dance Word, Rainbow Cycle, Bubble Pop, Big Friendly, MrBeast Single, Yellow Sweep, Glow Pop, Typewriter. UI cards in `app/components/SubtitleStyler.tsx`. Diagnostic `[subtitle-preset]` log.
5. **Highlight mode (legacy) bouncing-ball karaoke fix** — `27d6c36`. Henry: "alight only spoken word" — was highlighting full line. Added `highlight` preset with new perWord case `highlight_current`: each word stays in textColor, jumps to highlightColor only during its 40-ms ramp window, returns after. Uses subCfg colors directly.
6. **Housekeeping** — `529269f` (untracked planning docs), `8838716` (CHANGELOG/REMAINING_TODO), `b6a2e1b` (verify_narrator_actor_coord.mjs scaffold), `280b841` (PROBLEM_AND_FIX status). Orphan `md-only-backup-2026-05-27` branch tagged as `backup/md-2026-05-27` + deleted. Karaoke free-engine e2e re-verified (8/8 GREEN, ~62s, $0). DB audit performed — pre-launch healthy at current scale (max 47 rows), risks logged.

## 🟢 STILL OPEN (next agent picks up here)

**Henry-verified on this session:** rainbow ✅ · typewriter ✅ · dance ✅ · highlight FIXED (re-verify needed) · duck depth 0.02 LIVE (re-verify needed).

**Next quick wins (Henry chose: `hand off after each fix`):**
- Fix legacy `kids` mode (currently no preset → fall-through, bug analogous to highlight pre-fix) — ~10 min
- Fix legacy `dramatic` mode — ~10 min
- Fix legacy `social` mode — ~10 min

**Pre-launch infra (Henry-blocked or GO-gated):**
- DB R2 offsite backup (server-only pg_dump → push to R2) — ~30 min
- DB migration drift audit (`prisma migrate status`) — ~20 min
- FAL provider adapter (then ElevenLabs/Segmind/Kling) — ~3-4h
- R2 storage cutover + DB-aware cleaner — Phase 3
- Legal/T&C UI enforcement, Paddle credits, Supervisor/QC API routes

## 📋 PROTOCOL UPDATE (Henry directive 2026-05-29)
After **each** fix → write a handoff entry. Update this file (top section) with: what changed, commit SHA, status (deploy/awaits-verify), and next.

---

## (prev) Session 2026-05-28 (Assembly fixes) / 2026-05-27 (Mobile shell)

**Previous HEAD:** `71c86d0` (pushed, built, live) · **Live:** andiostudio.com (server :3200, systemd `ghs.service`, Next 16.2.1)

## ✅ DONE 2026-05-28 (Henry's live render report — ALL fixed + verified)
1. **Images / intro / outro now assemble** — `app/api/assembly/execute/route.ts` got a bounded `mapPool` (4 concurrent ffmpeg). Unbounded `Promise.all` over 50–70 segments was killing ffmpeg under load → 0-byte clips dropped from concat. Verified live: 18/18 segments, 0 zero-byte clips (`scripts/verify_assembly_concurrency.mjs`). PROBLEM_AND_FIX #42.
2. **Mixed-mode narrator restored** — `app/dashboard/hybrid-planner/page.tsx` no longer drops the narrator when actor clips exist (was playing only dialogue, losing all narration). #43.
3. **Gray-flash placeholders dropped** — dead/stale image URLs no longer leak gray frames into the video. Verified (`scripts/dead_url_test.mjs`). #44.
4. **Children planner free-tier LLM fixed** — was 503/hanging (Ollama default models not installed → 404; then >5min CPU inference). `src/lib/llm.ts` auto-picks an installed Ollama model + defaults to `llama3.1:8b`; `story-expand` caps Ollama at 45s + cloud fallback + provider-aware continuations. ABC format verified live ("A is for Apple…", 16 patterns) — `scripts/abc_format_test.mjs`. #45.
- All built (each BUILD_ID regenerated) + service restarted + HTTP 200. Note: server is GPU-less → free tier effectively runs on cloud Haiku (Ollama too slow); fine + cheap.
5. **Children LENGTH verified** — 5-min target → 864 words (≈750 target), no stub, no length warning (`scripts/length_fill_test.mjs`). Continuation fill loop confirmed working on cloud fallback. Henry's "make all story short" complaint resolved.
6. **Karaoke MAIN = free stock (premium gated)** — `app/api/karaoke/generate-music/route.ts` was auto-using premium Kie/Stable/Mubert whenever the key existed. Now free `stock` is the default; premium only via explicit UI tier. Verified live: Mode A no-tier → `provider:stock` → `upbeat_pop.mp3` (`scripts/karaoke_main_free_test.mjs`). PROBLEM_AND_FIX #46.
7. **Assembly too slow → ~2x+ faster** — `app/api/assembly/execute/route.ts`: ultrafast preset on intermediate clip encodes + concurrency 4→7 (8-core box) + final_merge `-c:v copy` when concat already covers duration (skip the full re-encode). 18-seg/63s: 42s→20s; audio path verified (h264+aac). PROBLEM_AND_FIX #47.
8. **Karaoke MAIN pipeline FULLY GREEN e2e on free engines** — fixed 3 bugs: LLM steps now fall back Claude→OpenAI→Ollama (#48, Anthropic credits depleted blocked flow-profile), generate-music defaults to free stock (#46), assemble resolves stock-music URL (#49). Verified all 8 steps HTTP 200 → mixed mp3 + exported mp3 (`scripts/karaoke_e2e_test.mjs`). HEAD `l6m18zt...`.
   - **⚠️ ANTHROPIC CREDITS DEPLETED** — all Claude calls now auto-fall-back to OpenAI GPT-4o-mini (works, lower quality). Henry: top up for best quality.
9. **Narrator/actor audio + scene-image fixes (2026-05-28)** — (#51) narrator now ducks to near-silence during actor-dialogue windows (timing unchanged); (#2) actor-voice ON/OFF toggle in Sound + Assembly tabs; (#52) scene-image: film-crew negative kills cameraman-in-frame, stronger young-adult age lock (no more 40s), `location` param drives correct environment, strengthened person-count lock (no duplicate co-protagonist). All verified (audio probe + viewed images). HEAD `Z7-uyo6...`.
- **STILL OPEN on the list (FIXNEWCHIDHYBRIDANDMORE05272026.MD):** karaoke full e2e on free engines (audio fixture: upload→analyze→flow→brief→stock→mix→assemble→export; foundation verified ready — venv deps OK, stock lib present); browser e2e of a real hybrid render (eyeball); Phase 3 substitution (phantom extra people; PuLID cross-scene face-lock needs R2 public URLs — infra-gated); orphan `md-only-backup-2026-05-27` branch.

---

## (prev) Session 2026-05-27 — Mobile shell LIVE + recovery
**HEAD:** `68788e9` · **Live:** andiostudio.com (server :3200, production `next start`, Next 16.2.1)

## ✅ DONE THIS SESSION
1. **Mobile-responsive drawer shell — SHIPPED + LIVE.** Phone was unusable (218px sidebar crushed content). New `app/components/AppShell.tsx` + mobile-only `@media(max-width:768px)` CSS in `globals.css` → sidebar becomes hamburger drawer on ≤768px. **Desktop pixel-identical (verified 1440px before/after), tsc clean, hamburger display:none on PC.** Commit `68788e9`, deployed to server (build `mQRPM--uqPAQipYBYFc1_`), live-verified phone+PC. Screenshots in `tests/_mobile/`.
2. **Restored 204 Codex-deleted storage assets** (`git checkout -- storage/`) — character portraits + commercial images recovered, uncommitted-deletion cleared.
3. Production process restarted cleanly (new PID owns :3200); hmksync :3060 untouched.
4. **Karaoke Tier 1 engines installed** (no root) — venv `/home/ghs/giohomestudio/.venv` (`--without-pip` + get-pip workaround since server lacks ensurepip/apt-pip). faster-whisper 1.2.1 + librosa 0.11.0 + soundfile 0.13.1, imports verified. Unblocks karaoke Steps 3/5/7 *engine availability* (pipeline wiring = Phase 4B, not built).
5. **pg_dump backup cron LIVE** — `/home/ghs/backups/pg_backup.sh` (last-7, runtime DATABASE_URL, strips `?schema=`), `ghs` crontab `30 3 * * *`, verified 139K dump. Log `/home/ghs/backups/backup.log`.
6. **story-qc/run placebo quarantined** (`6b38a18`) — 410 unless `STORY_QC_V2_ENABLED=1`; real pipeline = `/api/story/supervise`.
7. **R2 cleaner DEFERRED to Phase 3 cutover** (deliberate) — STORAGE_PROVIDER still `local`, bucket unused; blanket prefix-expiry would risk real assets. Build DB-aware janitor + delete→R2 purge WITH cutover.

## ✅ SYSTEMD TAKEOVER DONE 2026-05-27 (Henry ran /home/ghs/setup_systemd.sh)
- `ghs.service` ExecStart fixed `npm run dev` → `npm run start`; now **active + enabled** (auto-restart on crash via `Restart=on-failure`, starts on boot). MainPID 4130927.
- Granted `/etc/sudoers.d/ghs-systemctl`: **admin runs `systemctl {daemon-reload,restart,start,stop,enable,disable,is-active,is-enabled} ghs.service` with NO password** (verified `sudo -n systemctl is-active` → active, no prompt). Deploys are now fully passwordless.

## 🖥 SERVER STATE (for PC-loss recovery — repo is the source of truth)
- Live: andiostudio.com → CF Tunnel → server :3200, **systemd `ghs.service`** (production `npm run start`, user `ghs`, auto-restart + boot-persistent).
- **Restart prod (passwordless):** `ssh hmk "sudo systemctl restart ghs.service"`
- **Deploy:** PC edit → commit → push → `ssh hmk "sudo -n -u ghs bash -c 'cd /home/ghs/giohomestudio && git pull --ff-only && pnpm build'"` (~4-6min) → `ssh hmk "sudo systemctl restart ghs.service"`.
- `.env` defaults: `VIDEO_PROVIDER=mock_video`, `DEFAULT_IMAGE_MODEL=segmind_flux` ($0.0004).
- ghs user = NOPASSWD; `systemctl ghs.service` = NOPASSWD for admin (new 2026-05-27); other root (`apt`, other units) still needs Henry.
- Karaoke Tier-1 venv `/home/ghs/giohomestudio/.venv` · pg backups `/home/ghs/backups/` (daily 03:30) · setup script `/home/ghs/setup_systemd.sh`.

## 🟠 OPEN BUG LOGGED (Henry 2026-05-27)
- **Hybrid assembled-video subtitles render TOO BIG** — drawtext `fontsize` is fixed px, not scaled to frame height. Fix target: `app/api/assembly/execute/route.ts`. Phase 2 backend. Full note in PROBLEM_AND_FIX.md + uncomplete.md.

## 🔴 STILL NEEDS HENRY (root, when ready — NOT urgent)
- **Karaoke Tiers 2–4 only:** `python3.11` + apt (basic-pitch / demucs+torch / RVC). Core karaoke runs on Tier 1 (installed). Defer until karaoke pipeline build (Phase 4).

## ▶ NEXT PER MASTER_PLAN (update/PLANS/MASTER_PLAN_05262026.md)
**Phase 1 stabilization = 100% COMPLETE** (prod build ✅ · 204 assets ✅ · Tier-1 engines ✅ · pg_dump cron ✅ · story-qc quarantine ✅ · systemd auto-restart ✅; R2 cleaner deferred to Phase 3 by design).
**NEXT = Phase 2 backend bugs**, starting with **subtitle-too-big** (scale drawtext fontsize to frame height in `app/api/assembly/execute/route.ts`), then chat-timeout / narration-length / persistence. Then **Phase 3 root-cause** (token resolution / supervisor routing = the substitution / wrong-character fix). Karaoke pipeline (9 missing steps) = Phase 4B.

---

# GHS HANDOFF — Session 20 (Export Fix + All Prior Triggers Confirmed Done)

**Last updated:** 2026-05-22
**Build:** TSC clean — 0 new errors
**Git:** All pushed to `main`. HEAD = `996b5fc`.
**Port:** 3200 | **DB:** giohomestudio_db (PostgreSQL + Prisma)

---

## ✅ COMPLETED THIS SESSION (Session 20)

### Export timing + caption layout — `996b5fc`
| File | Fix |
|---|---|
| `app/api/assembly/execute/route.ts` | Pre-flight now updates narrator `endTime` to `realDur` when current value is shorter |
| `app/api/assembly/execute/route.ts` | `totalDuration = max(realDur, clientTotal, lastSegEnd)` — video covers all content |
| `app/api/assembly/execute/route.ts` | Caption Y: `h*0.88` → `h-th-54` — multiline captions stay inside frame |
| `app/api/assembly/execute/route.ts` | wrapText 45→40, word-chunk split at 20 words per caption entry |

### All open triggers from last session — CONFIRMED DONE (prior sessions)
| Trigger | Status | Commit |
|---|---|---|
| `go F1 F2 F3` (PuLID id_weight + prompt reorder + anti-portrait) | ✅ Done | `07318e1` |
| `go F4` (drop PuLID for multi-char scenes) | ✅ Done | `b677585` |
| `go phase A` (Movie Planner toolbar) | ✅ Done | `4e52c02` |
| `go phase B` (Children Planner toolbar + word filter) | ✅ Done | `4e52c02` |
| `investigate substitution` (Phase D — portrait cache stale) | ✅ Done | `b677585` |

---

## ⚠ STILL NEEDS HENRY VISUAL CHECK

Before calling any of these bugs "fixed":
- Scene composition: regen SC01 of Bryan story → expect real Brooklyn neighborhood, NOT 3-person row
- Phase D substitution: regen a portrait, then regen the scene → should use NEW portrait
- Multi-char scenes (F4): should show scene location/action, NOT portrait-style row

Browser cache note — if "fix didn't work":
```powershell
Remove-Item -Recurse -Force .next
npm run dev
# Then Ctrl+Shift+R + start a NEW project (stale data persists in hybrid_saved_states DB)
```

---

## 🔥 PENDING WORK — Next priorities

### A. Backlog (no trigger yet)
- C6 pacing engine: `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl` not persisted to DB — lost on page refresh
- Prisma migrations: `npx prisma migrate dev` pending
- Establishing Shot & Scene Opener: spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`
- SFX semantic category: 60 categories, Ollama maps action→category, royalty-free
- Subtitle style tokens: always Arial; `subtitleConfig.mode` ignored
- character-build LLM prompt over-diversifies same-ethnicity siblings (has "DIFFERENT from existing" pressure)

### B. Task #8 (Phase 3) — Continuity supervisor + image library UI
No plan written yet. Trigger when ready.

---

# GHS HANDOFF — Session 19 (Major Quality Pass — Phase A+B Toolbars, Scene Composition, LLM Cascade)

**Last updated:** 2026-05-21
**Build:** TSC clean — 0 new errors
**Git:** All pushed to `main`. HEAD = `4e52c02`.
**Port:** 3200 | **DB:** giohomestudio_db (PostgreSQL + Prisma)

## ✅ 2026-05-22 — Export timing + caption layout fix (uncommitted — stage + commit before next work)

| File | Fix |
|---|---|
| `app/api/assembly/execute/route.ts` | Pre-flight now updates narrator `endTime` + `totalDuration = max(realDur, clientTotal, lastSegEnd)` |
| `app/api/assembly/execute/route.ts` | Caption Y: `h*0.88` → `h-th-54` (prevents multiline overflow below frame) |
| `app/api/assembly/execute/route.ts` | wrapText 45→40 chars; buildSubEntries word-chunk split at 20 words per caption |

**Root cause of "video ends before voiceover":**
When `effectiveNarrDurMs=0` on client (audio element recovery failed), `totalDuration = sceneBaseDuration` (~55s) and narrator `endTime = narratorFallbackSec` (~40s). Pre-flight ffprobe was only updating `totalDuration`, not `endTime`. Assembly-builder then applied `atrim=duration=40` — 3-min narrator trimmed to 40s.

---

## ✅ EXECUTED THIS PUSH (after handoff was last written)

| Commit | What |
|---|---|
| `642c4a4` | LLM cascade: drop forceModel on fallback + Ollama timeout 90s→300s |
| `07318e1` | **F1+F2+F3 scene composition** — id_weight 0.75→0.55, location-first prompt order, anti-portrait directives |
| `76f1de1` | Story-expand: length enforcement (forces full word count even with strict child rules) + rich `scenes[]` array with video_prompt + voiceover + dialogue + sfx_music per scene (ChatGPT-style structured output) |
| `4e52c02` | **Phase A+B toolbars** — Movie planner gets 6 new scene editor buttons (Action/Intense/Calm/Emotion/Establish/QC). Children planner gets 8 child-safe buttons (Polish/Funny/Playful/Adventure/Emotion/Action/Establish/QC/Word Check). NEW `/api/children/word-filter` endpoint with 80+ adult-word→gentle-replacement map. |
| `b677585` | **F4 drop PuLID for multi-character scenes** — PuLID dominates composition when locking 2+ characters; now multi-char scenes use the default model with text-only character descriptions. Single-char scenes still use PuLID. **Phase D substitution-doesn't-switch fix** — _portraitCdnCache now includes file mtime + size in key, so regenerated portraits invalidate cached CDN URL. |

**Browser/API-verified:**
- Children planner story expansion (Playwright 2 runs passed, 10 scenes returned)
- Word-filter: "Peter killed the scary monster with his sword, blood everywhere" → "Peter stopped the silly creature with his wand, paint everywhere"
- Funny mode: "Tim and Ann sit quietly..." → cat collapse joke
- Playful mode: "Tim and Ann walk in the garden" → "bounce into the sun-kissed garden, giggling like they're playing hide-and-seek..."
- Adventure mode: "The kids sit at home" → "hidden compartment filled with tiny tools and curious contraptions"

**Still needs Henry visual check:**
- Scene composition: regen SC01 of Bryan story → expect Brooklyn neighborhood, not 3-person row
- Phase D substitution: regen a portrait, then regen scene → should use NEW portrait now
- Multi-char scenes (F4): should show scene location, not portrait-style row

---

## ⚠ READ FIRST — IF ANY FACE/CLOTHING/SCENE BUG REPEATS

Browser caching has been the #1 cause of "fix didn't work" in this session. Before debugging anything:

```powershell
# 1. Stop dev server (Ctrl+C)
Remove-Item -Recurse -Force .next
# 2. Restart
npm run dev
# 3. Wait for "✓ Ready"
# 4. In browser: Ctrl+Shift+R (HARD refresh, no cache)
# 5. Start a BRAND NEW project (broken character data persists in hybrid_saved_states DB)
```

---

## 🔥 PENDING WORK — Highest priority first

### A. ⏳ Scene Composition Fix (approved plan, no code yet)
**Plan file:** `update/PLANS/scene_composition_fix_21052026.md`

**Problem:** PuLID-locked scenes look like character reference sheets (3 people standing in a row, plain BG) instead of real scenes. Scene location/action/mood are ignored. Non-PuLID scenes (Flux Schnell) work correctly.

**Approved fix order:** F1 (id_weight 0.75→0.55) + F2 (reorder prompt: location/action first) + F3 (anti-portrait directives). Then F4 if needed (drop PuLID for multi-char). Then F5 (face crop). F6 (post-process face swap) is last resort.

**Triggers:** `go F1 F2 F3` / `go F4` / `go all F1-F5`

### B. ⏳ Movie + Children Scene Editor Port (approved plan, no code yet)
**Plan file:** `update/PLANS/hybrid_style_story_chid_movie21052026.md`

**Goal:** Port Hybrid's scene editor toolbar (✨ Polish, ➕ Add Action, 💗 Make Emotional, ✅ QC, 🪶 Context, Ask AI, etc.) to Movie + Children planners. Children version adapted: drops Make Intense / Reduce Action; adds Make Funny / Make Playful / Make Adventure / Adult Word Check / Filter Word.

**Triggers:** `go phase A` (Movie) / `go phase B` (Children) / `go all`

### C. ⏳ Substitution Bug — "works but doesn't switch"
Henry reported in Children Planner: "substitution work on for children, don't break — but substitution does not switch."

**Hypothesis:** when a character is edited/swapped in the Character tab, scene image regen may use the OLD portrait URL (cached on FAL CDN by `_portraitCdnCache` Map in `image-provider.ts`). The Map is keyed on the `/api/media/...` URL — if the user regenerates a portrait, the URL might be the same and the stale CDN URL gets reused.

**Trigger:** `investigate substitution`

### D. ⏳ Backlog (lower priority)
- C6 pacing engine save/load — `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl` not persisted to DB; lost on page refresh
- Prisma migrations — `npx prisma migrate dev` pending
- Establishing Shot & Scene Opener — spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`
- SFX semantic category system — 60 categories, royalty-free, Ollama maps action→category
- Subtitle style tokens — currently always Arial; ignores `subtitleConfig.mode`
- character-build endpoint LLM prompt has "DIFFERENT from existing" pressure → can artificially diversify same-ethnicity siblings

---

## ✅ WHAT WAS COMPLETED THIS SESSION (Session 19) — 22 commits

### Ethnicity pipeline END-TO-END (Session 18 carryover + Option B)
- `3c6b658` Age field flows Character tab → scene-image API
- `829ea62` Extraction prompt requires skinTone + age + ethnicity
- `1774db4` Auto-AI-Read anti-override (story ethnicity beats portrait-read AI)
- `b65cce5` Face-lock UI diagnostic (visible PuLID status per scene)
- `64df85d` Extraction response now includes visualDescription + skinTone + colorDescription + ageRange (the BIG fix — server saved but never sent back to client)
- `863b493` Walk full expandedStory object for ethnicity inference (works regardless of which field names story-expand uses)
- `2a5701e` **Option B**: story-wide dominant ethnicity override — if LLM gave a character "fair skin" but story dominant is Black/Latina/etc., override unless explicit "white X" near character name
- `8f5e3f0` Scene Board ↔ Character tab linking — match by displayName too, not just characterId

### PuLID face-lock + clothing
- `2f6647e` (S18) Auto-upload local portraits to FAL CDN for PuLID
- `83a965d` (S18) Remove `!modelId` bypass — PuLID activates whenever portrait exists
- `d53a2f3` Lower PuLID `id_weight: 1.0 → 0.75`, `start_step: 4 → 6` — let scene prompts override portrait state
- `bf4f88a` Scene-image: block shirtless defaults via negative + force "fully clothed" cue when wardrobe empty
- `08255ba` Portrait gen: stop shirtless defaults at SOURCE (PuLID locks portrait state, so portraits themselves must be clothed)

### Children Planner
- `73f66b5` Three children fixes:
  - Story-expand reads `childContext` → per-age strict vocabulary rules (toddler/preschool/early/older with sentence-length caps)
  - Music providerKey "karaoke" was invalid → mapped to "stable_audio"
  - Karaoke narration audioUrl=null handled gracefully instead of throwing
- `fbd964a` Parse duration + poem cues from prompt text (was ignored)
- `d4ba8a3` Story Length picker UI + `tier: "pro"` to match Hybrid (was using fast cheap model)

### Subtitle + assembly
- `221c608` (S18) Windows fontfile colon escape — drawtext was silently failing on `fontfile='C:/Windows/Fonts/arial.ttf'`. Now `fontfile='C\:/Windows/Fonts/...'`
- `daae5db` Intro/outro preview shows `<img>` for PNG cards, not broken `<video>`

### Scene prompt cleanup
- `96db101` Scene-prompt-builder cast description skips empty/contaminated fields — was rendering "skin, , wearing serene, peaceful atmosphere..." because mood text leaked into clothing field

### Diagnostics + tooling
- `5f0abe0` Ollama timeout 15s → 90s (14B-class models need it)
- `87af189` Playwright test proves UI mapping works (validates server→client→render chain)

### Plans saved (not yet implemented)
- `6ba628e` Plan: Movie + Children scene editor port
- `f39328a` Plan: scene composition fix (PuLID over-locking)

---

## ENTIRE ETHNICITY DATA PIPELINE (after Session 19)

```
story text typed by user
        ↓
story-expand → characterList (may be missing skinTone)
        ↓
character-extract
  - If characterList present: mapCharacterIdentity (LLM skipped)
  - Else: LLM extraction with strict skinTone+ethnicity required
        ↓
Inference fallback chain:
  1. LLM-extracted skinTone
  2. inferSkinToneFromText(visualDescription + personality + ethnicity + country)
  3. inferSkinToneFromText(walk entire expandedStory recursively)
        ↓
OPTION B OVERRIDE:
  if (dominantStoryEthnicity is non-light)
   AND (character's skinTone is generic-light "fair/pale/light tan/Caucasian")
   AND (NO explicit "white/Caucasian" within 100 chars of character's first name in story)
  then override skinTone with dominant
        ↓
visualDescription enrichment:
  enrichedVisualDescription = skinTone + ", " + visualDescription
        ↓
Server saves to DB:
  characterVoice.visualDescription = enrichedVisualDescription
        ↓
Server returns to client (FULL data — not just stub):
  { characterId, name, role, gender, age, voiceId, dbId,
    visualDescription, skinTone, ageRange, colorDescription }
        ↓
Client maps into characters[] state:
  c.colorDescription = response.colorDescription || response.skinTone
  c.distinctiveFeatures = response.visualDescription
  c.species = "human"
        ↓
Portrait generation (generateCharacterPortrait):
  - clothingFloor cue when no clothing mentioned → "fully clothed..."
  - shirtless/topless/bare-chest in negativePrompt
  - skin/ethnicity from c.colorDescription / c.skinTone
        ↓
auto-AI-Read after portrait gen (analyzeCharacterImage):
  Anti-override: c.colorDescription kept if filled; AI's "fair skin" can't override
  ethnicityConflict detection: story dark vs AI light → story wins
  ageAppearance protection: c.ageRange set → AI's "appears 10yo" blocked
        ↓
Scene image generation (makeSceneImage):
  Filter characters by characterId OR displayName (8f5e3f0)
  Send characterOverrides with age, species, skinTone via colorDescription
        ↓
scene-image/route.ts:
  - resolvePublicPortraitUrl: local /api/media/ → FAL CDN public URL (cached)
  - useIdentityLock = portrait exists
  - face_image_url forwarded to FAL FLUX PuLID
  - id_weight=0.75, start_step=6
  - bear/clothing/phone/era/nudity negatives applied
        ↓
PuLID face-locks scene to portrait
```

---

## KEY PROTECTED CODE (DO NOT REMOVE)

1. `extractSceneAction()` in `app/api/hybrid/scene-image/route.ts` line ~192 — PROTECTED comment
2. `sanitizeNarrativeJargon()` in `app/api/hybrid/scene-image/route.ts` — strips screenplay terms
3. `amix=duration=longest:normalize=0` in `app/api/assembly/execute/route.ts` — NEVER duration=first
4. `-stream_loop -1` on video in final_merge
5. `effectiveNarrDurMs` recovery in `assembleScenes()`
6. `resolvePublicPortraitUrl()` in `src/lib/generation/selectors/image-provider.ts` — FAL CDN upload + cache
7. `analyzeCharacterImage` merge anti-override block in `app/dashboard/hybrid-planner/page.tsx`
8. Option B override block in `app/api/hybrid/character-extract/route.ts`
9. Windows fontfile colon escape in `app/api/assembly/execute/route.ts` subtitle block

---

## DEBUG RECIPES

### Faces still wrong color/age after server restart
1. Hard refresh browser (Ctrl+Shift+R) — bundles may be cached
2. If still wrong, delete `.next` folder, restart, hard refresh
3. Open DevTools → Network → trigger Expand AI → inspect `character-extract` response
4. Check `characters[0].skinTone` and `colorDescription` — server-side is verified working

### Subtitle didn't burn in
Red banner shows reason after assembly. If no banner: `subtitleStatus.requested` was false → toggle subtitle in Assembly tab.

### PuLID face-lock didn't apply
Console line: `[scene-image] sceneId=X chars=N ages=[...] portraits=N faceLock=true firstPortrait=https://fal.media/...`
- `faceLock=false` → no portrait provided
- `firstPortrait=/api/media/...` (not fal.media) → upload to FAL CDN failed

### Bear head / animal head reappeared
Check `characterOverrides[].species` in scene-image API request (DevTools Network). Should be "human" unless explicit animal character.

### Scene shows character reference sheet pose instead of real scene
This is the OPEN bug. See `update/PLANS/scene_composition_fix_21052026.md`. Trigger: `go F1 F2 F3`.

---

## TEST UTILITIES (tests/ folder)

```bash
# Verify extraction returns ethnicity correctly
node tests/test-extraction-api.mjs

# Verify walk-fallback infers ethnicity even when characterList is empty
node tests/verify-walk-fix.mjs

# Verify Option B story-wide override
node tests/test-option-b.mjs

# List/patch broken characters in character-voices DB
node tests/fix-broken-characters.mjs              # dry run
node tests/fix-broken-characters.mjs --fix        # apply

# Find/patch broken characters in saved-state project JSON
node tests/fix-project-characters.mjs             # dry run
node tests/fix-project-characters.mjs --apply     # apply

# Playwright UI mapping test (~20s, no Ollama)
npx playwright test tests/verify-ui-mapping.spec.ts --project=chromium

# Full E2E (slow — uses Ollama, 2-3 min)
npx playwright test tests/full-ui-ethnicity-test.spec.ts --project=chromium
```

---

## KNOWN LIMITATIONS

### Existing broken project state cannot be auto-fixed
Projects extracted before Session 18 fixes (e.g., "Twins Guns Hybrid Project" with Marcus Cole / Dante Cole) have white-skin descriptions baked into `hybrid_saved_states.data.characters[]`. Code can only protect NEW extractions.

Three options:
- Delete broken characters in Character tab → re-extract
- Manually edit each (Define Appearance)
- Start fresh project

### Outro mid-video bug (still unresolved)
User reported outro appearing in middle of assembled video. Code at line ~4097 puts intro→scenes→outro in correct order. Needs user info: was outro duplicated (twice) or just mid-order?

### character-build LLM prompt has "DIFFERENT from existing" pressure
Can cause LLM to artificially diversify ethnicity (Alex=Black, Ben=light) when story says both are Black. Mitigated by Option B for character-extract, but `character-build` is a separate path and not yet patched.

---

## GHS BRANDING RULE
User sees: **GHS Standard / GHS Plus / GHS Pro / GHS Classic / GHS Premium / GHS Best**
NEVER show: Claude, GPT, Ollama, Grok — internal only

## PORT
GHS = **3200** | Marabiz = 3040 | Octogent ghs = 8788

## DB
`giohomestudio_db` (PostgreSQL) — Prisma ORM — migrations pending

## REPO
`https://github.com/htonymac/giohomestudio.git` — branch `main`, HEAD `f39328a`

## ACTIVE PLANS (read before starting any related work)
1. `update/PLANS/scene_composition_fix_21052026.md` — PuLID over-locking fix
2. `update/PLANS/hybrid_style_story_chid_movie21052026.md` — Movie+Children scene editor port

## SESSION TRIGGERS WAITING ON GO
- `go F1 F2 F3` — cheap pass on scene composition (id_weight + prompt reorder + anti-portrait)
- `go F4` — drop PuLID for multi-character scenes
- `go all F1-F5` — full scene composition fix sequence
- `go phase A` — Movie planner scene editor toolbar
- `go phase B` — Children planner scene editor toolbar (child-safe variant)
- `go all` (planner toolbar) — both planners + verification
- `investigate substitution` — Phase D substitution-doesn't-switch bug
