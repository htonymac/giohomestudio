# GHS Handoff — 2026-05-23 (Linux migration LIVE + 9-fix plan complete)

## Where we stopped
Session focus: Linux migration finished tonight + Henry directed deep-read of all 112 update/ docs to fix months of solo-work blockers. Spawned 5 parallel Explore agents, recorded 7 audit memory files for future sessions. Then ran Wave 0 LITE + Wave 2 (9-fix plan).

## What landed today (2026-05-23)

### Infra (Wave 0 LITE)
- GHS LIVE on Contabo VPS 30 (`/home/ghs/giohomestudio`) — systemd `ghs.service` port 3200
- Domain `andiostudio.com` LIVE via Cloudflare Tunnel — apex + www, both HTTP/2 200
- Cloudflare R2 bucket `andio-assets` created + round-trip tested (PUT/GET/LIST/DELETE all green)
- Server IP hidden behind CF edge — no direct exposure
- `KIE_AI_API_KEY` confirmed on server `.env`
- Git tag `windows-final-2026-05-23` set on `84a06bb` as rollback safety

### Code (Wave 2 — 9-fix plan complete)
Commit `dcd5676` closed the final 2 of 9 fixes:

- **FIX 2** — Subtitle cap REMOVED. `app/api/assembly/execute/route.ts`: writes SRT file with full subEntries (no cap), tries `-vf subtitles=path.srt:force_style='...'` filter (libass — available on Linux), falls back to drawtext-300 chain if libass unavailable. force_style derived from `SubtitleConfig`. Color #rrggbb → libass &Hbbggrr. Children's 40+ min stories will now show subtitles throughout.
- **FIX 7** — PuLID single-char rich-location drop. `app/api/hybrid/scene-image/route.ts`: drops face-lock for single-char scenes when (a) NOT closeup framing AND (b) location text > 20 chars + scene text > 80 chars (or location+mood+timeOfDay all set). Closeup framings preserved. Reduces "character lineup posed for camera" output when scene has detailed location.

### Memory files written (~/.claude/projects/C--Users-USER/memory/)
For all future GHS sessions to boot informed:
- `project_ghs_production_launch_plan_05232026.md` — 🎯 master 5-wave plan, 76-101h total
- `project_ghs_serious_issues_record.md` — 🔥 Henry's 4 flagged blockers with root cause + fix targets
- `project_ghs_planners_hybrid_movie_children.md` — Hybrid 95% / Movie 0% / Children 15% audit
- `project_ghs_music_karaoke_video.md` — Karaoke 11/18 canvas steps built
- `project_ghs_motion_scene_audio.md` — Motion/Scene/Audio + 9-fix plan
- `project_ghs_auto_commercial_freemode.md` — Free Mode 60% + 8 critical bugs FM-01..FM-08
- `project_ghs_story_character_legal_ops.md` — Full 23-supervisor list (Story QC)
- `persona_ghs.md` UPDATED with new boot sequence reading these files first

## Not yet verified by Henry

- **Browser smoke test on andiostudio.com** — FIX 2 SRT subtitles burned into final MP4. Generate a 40+ min children story → assemble → confirm subtitles appear throughout entire MP4. Server log should show `[assembly] Subtitle SRT/libass burn-in OK` (NOT drawtext fallback).
- **FIX 7 effect** — generate a scene with rich location (e.g. "Brooklyn welding workshop at dusk, neon signs, oil drums, hammer noise") + single character. Server log should show `(PuLID dropped — single char + rich location; FIX 7)`. Generated image should show ENVIRONMENT-first composition, character integrated in scene mid-action, not posed.

## Blockers

- `python3.11` install on server requires admin sudo (one-line apt). Until done, Karaoke Tier 2-4 (basic-pitch / demucs / RVC) cannot install. Wave 1 (karaoke complete) blocked on this single apt.
- `Mubert PAT` — Henry must sign up at mubert.com/business. Music Provider Layer falls back to Stock for >47s instrumental without it. Functional but lower quality.
- `systemctl restart ghs.service` requires admin sudo password — needed to pick up `NEXT_PUBLIC_APP_URL=https://andiostudio.com` in `.env` (non-blocking, site serves correctly without).

## Next exact steps

When Henry returns, in order:
1. SSH into Linux, `sudo apt install python3.11 python3.11-venv python3-pip` (one paste, ~30s)
2. SSH `sudo systemctl restart ghs.service` to pick up env
3. Trigger `karaoke go` → Terry executes Wave 1 (Tier 1-4 pip install + 7 missing canvas steps for Karaoke). Pattern B preferred (`sudo -iu ghs -i`, `cd /home/ghs/giohomestudio`, `claude`, `connect andio`).
4. OR trigger `wire supervisors` → Terry executes Wave 4 (build `/api/story-qc/*` for 23 designed supervisors). This is the bigger LLM-chaos fix.
5. OR trigger `storage go` → Terry executes Wave 3 (R2 storage abstraction phases 1, 2, 4, 5, 7, 9, 10). Phase 3 done. Phase 6 removed. Phase 8 deferred.

Full plan in `~/.claude/projects/C--Users-USER/memory/project_ghs_production_launch_plan_05232026.md`.

## Files touched (this session, code only)
**FIX 2 + FIX 7 (Wave 2 finishing):**
- `app/api/assembly/execute/route.ts` — FIX 2 SRT/libass unlimited subtitles + drawtext fallback
- `app/api/hybrid/scene-image/route.ts` — FIX 7 PuLID single-char rich-location drop

**Wave 3 Phase 1 (Storage abstraction):**
- `src/lib/storage/StorageProvider.ts` (interface + canonical prefixes)
- `src/lib/storage/LocalFsProvider.ts` (default — wraps fs.writeFileSync)
- `src/lib/storage/R2Provider.ts` (lazy-required AWS SDK)
- `src/lib/storage/index.ts` (getStorage() factory)

**Wave 3 Phase 2 (Prisma schema):**
- `prisma/schema.prisma` — 7 asset models get `ownerId / r2Key / sizeBytes / visibility / storageProvider`. KaraokeRecording also `mixedR2Key + purgeAt` per canvas §19. Server DB synced via `prisma db push --accept-data-loss`, no data lost.

**Wave 3 Phase 4 (Signed URLs + owner check + rate-limit):**
- `src/lib/rate-limit.ts` (token bucket, in-memory, RateLimitError 429)
- `src/lib/asset-permission.ts` (canRead/canWrite/canDelete + PermissionDeniedError 403)
- `app/api/asset/sign-get/route.ts` (GET ?assetId=X&quality=preview|full)
- `app/api/asset/sign-put/route.ts` (POST creates ContentItem PENDING, returns signed PUT URL, tier file-size cap 413, anonymous 401)
- `app/api/asset/[id]/confirm-upload/route.ts` (POST verifies storage.exists, flips PENDING→IN_REVIEW)

**Wave 4 Phase A (Supervisor orchestrator v2 — see WARNING below):**
- `src/lib/story-qc/types.ts` (typed contracts)
- `src/lib/story-qc/registry.ts` (23 placeholder supervisor definitions)
- `src/lib/story-qc/orchestrator.ts` (buildPlan + runOrchestrator with topo-sort + per-tier timeout + cascade-skip)
- `app/api/story-qc/run/route.ts` (POST runs orchestrator, GET lists 23, planOnly mode)

**Memory + docs:**
- 7 new audit memory files (master launch plan, serious-issues, per-area audits)
- `persona_ghs.md` (refreshed boot sequence)
- `MEMORY.md` (index updated with 🔑 🎯 🔥 markers)
- `error_log.md` (FIX 2 + FIX 7 entries)
- `update/CHANGELOG.md` (Wave 3+4 entries)
- `update/HANDOFF.md` (this file)
- AWS SDK installed on server (`@aws-sdk/client-s3@3.1053.0` + `@aws-sdk/s3-request-presigner@3.1053.0`); PC install blocked on Node 22 cert issue, R2Provider lazy-requires so PC TSC still passes.

## ⚠ ORCHESTRATOR WARNING — DO NOT use /api/story-qc/run for production
The REAL 23-supervisor pipeline already exists at `/api/story/supervise` (calls
`runFullStoryQCPipeline` from `src/lib/story-supervisors/`, 4549 LOC, 23 working
implementations). Hybrid planner already wires it at `page.tsx` line ~1534. Agent-5
audit was incomplete — corrected in `project_ghs_story_character_legal_ops.md`.

`/api/story-qc/run` runs PLACEHOLDER prompts — it's a v2 ALTERNATIVE with cleaner
contracts + plan-only mode + per-tier timeout, NOT yet wired into any planner.

Henry's "30+ supervisor LLM chaos" = TUNE the existing 23 supervisors. Targets:
1. Add per-supervisor timeout in `runFullStoryQCPipeline`
2. Parallelize within dep-group (story_screening + culture_country can run together)
3. Cache by (storyHash, supervisorName)
4. Accept `requested?: string[]` param so callers skip irrelevant supervisors
5. Surface per-supervisor cost + latency in StorySupervisorReport

## Files read but NOT modified
- All 112 docs in `update/` folder (deep-read via 5 parallel Explore agents)
- All 13 karaoke API route source files
- 30+ planner page samples + provider modules
- Prisma schema for StoryQC* models

---

# GHS Handoff — 2026-05-17 (Hybrid subtitle + QC + Parse Script)

## Where we stopped
Session focus: Hybrid Planner subtitle pipeline, QC fix flow, Parse Script per-scene, pre-flight UX.
All TypeScript clean. Dev server needs a HARD restart (kill `next dev`, delete `.next`, restart) — Henry confirmed during testing that HMR was inconsistent on `page.tsx` (12k+ lines).

## What landed today

### `app/components/PreGenerationGate.tsx`
- `minHeight: 420` → `maxHeight: calc(100vh - 48px)` + `overflowY: auto`. Modal no longer forces page scroll on small viewports.

### `app/dashboard/hybrid-planner/page.tsx`
1. **Outro subtitle bleed**: extracted `narratorFallbackSec = Math.max(sceneBaseDuration - introOutroFixed, 1)` and used for narrator `endTime` fallback when `effectiveNarrDurMs === 0`. Old code fell back to `totalDuration` which includes 15s intro+outro → subtitles bled into outro card.
2. **Subtitle gate hardened** (line ~4370): `subtitlesOn = subtitleStyle !== "none" || effectiveSubtitleConfig.mode !== "none"`. Old gate `subtitleStyle !== "none"` failed for saved projects where legacy state was `"none"` but the new mode picker was active. Also coerce `sentSubtitleStyle = "classic"` on the wire when only the new picker is the signal — execute route has its own `if (globalStyle !== "none")` gate that would otherwise re-kill it.
3. **Subtitle text source widened** (line ~4313): each narration entry now falls back to `scriptSegments.find(s => s.audioUrl === n.audioUrl)?.text` when it isn't the master narrator. Per-line FAL/Karaoke narration now carries subtitle text.
4. **`parseScript` rewritten**: Path A — when 2+ scenes have `narrationScript || description`, build one segment per scene directly. Skips LLM. Path B (LLM master-story parse) kept as fallback. Fixes "1 segment for 12 scenes" bug. Logs `[parseScript] scenes=N withContent=M` to DevTools console.
5. **QC fix routing**: added `applyFixDirect` with handlers for `Trim story to under N words` (truncates `expandedSummary` or `idea` directly) and `Change first scene music to "..."` (writes `scene.musicStyle`). Previously both went to LLM `batch_polish` which scrambled descriptions.
6. **Pre-Flight button**: renamed to `▶ Run Pre-Flight Check`, solid purple fill. Old "AI Audio & Audit" text was identical to the section header — looked like a label not a button.
7. **Check Subtitle Sync**: when status warns AND `effectiveSubtitleConfig.mode === "none"`, an inline `Enable Subtitles` button now flips style to classic/dramatic in one click. Replaces fragile `note.includes("Subtitles OFF")` string-match condition.
8. **`applyWordCountFixes` regex**: scene-id capture now accepts curly + straight quotes — `/in\s+scene\s+["""']?([A-Za-z0-9_]+)["""']?/i`. Old regex only matched standard ASCII `"`.
9. **"Trim story" rewritten correctly**: was updating `expandedSummary` — but QC reads `qcStoryText` built by joining each scene's `narrationScript || description`, so the truncation did nothing for re-run QC. Now trims each scene proportionally (ratio = maxW/totalWords, floor 5 words per scene). Joined total drops under the target → STORY_QUALITY blocker clears on re-run.
10. **`fixSceneQC` routes through `applyFixDirect`**: per-scene "🔧 QC Fix" button now applies music/story/word-count fixes directly before falling through to LLM. Matches the global "Fix All" routing.

### `app/api/hybrid/pre-flight/route.ts`
- New warn branch: when `scriptSegments.length < ceil(scenes.length / 2)`, returns `status: "warn"` with label `Script parsed (N segment(s) for M scenes)`. Old code blindly reported `status: "ok"` for any non-zero count.

## Not yet verified by Henry

- **Final MP4 subtitles after clean rebuild** — gate fix is in, but Henry's last test was on a stale dev build. Execute route was NOT modified — still gates on `assembly.exportSettings?.includeSubtitles`. If still missing post-restart, instrument the server log line `[subtitle] font=... style=... entries=N` to see what arrives.
- **Re-parse Script button click** — after restart, DevTools console should log `[parseScript] scenes=N withContent=M`. If silent, build is still stale.

## Blockers
None functional. Process blocker: hot reload unreliable on `app/dashboard/hybrid-planner/page.tsx`. Cold-restart after every edit to that file.

## Next exact steps
1. Henry: stop `next dev`, `rm -rf .next`, restart, hard-reload browser (Ctrl+Shift+R).
2. Click Re-parse Script → DevTools console must log `[parseScript] scenes=12 withContent=12`. Segment chip must change 1 → 12.
3. Generate narration → Assemble → confirm subtitles burn into final MP4.
4. Story QC → click Fix on `Trim story to under 300 words` → re-run QC → STORY_QUALITY blocker should clear.
5. If subtitles still missing post-restart: server log will show why drawtext skipped (`narrationWithText.length === 0` means no entry has text; `globalStyle === "none"` means sentSubtitleStyle path didn't coerce).

## Files touched
- `app/components/PreGenerationGate.tsx`
- `app/dashboard/hybrid-planner/page.tsx`
- `app/api/hybrid/pre-flight/route.ts`

## Files read but NOT modified (constraint: don't touch what you don't own)
- `app/api/assembly/execute/route.ts` — subtitle drawtext pipeline lives here; only consumes the assembly JSON we now build correctly
- `app/api/hybrid/parse-script/route.ts` — still used as Path B fallback
- `app/api/hybrid/scene-edit/route.ts` — LLM polish, used by QC fixes that aren't direct-apply
- `src/lib/assembly-schema.ts` — schema unchanged
- `src/lib/ghs-sound-tiers.ts` — unchanged

---

# GHS Handoff — 2026-04-30 (S4c FINAL)

## S4c — Movie Cast AI-first + Children Chars Inline + Preflight All Planners
Branch: `fix/ghs-s4c-sceneboard-cast-preflight`
Commit: fa403c7

**Done:**
- Movie planner Cast tab: "Build Story Characters with AI" primary button + portrait model selector (Flux Schnell/Pruna/Flux Dev) + "Generate Portrait" per card + "or import saved" secondary
- Children planner Characters tab: inline AI-first registry — Build Story Characters with AI, or import saved via CharacterPicker inline, Gen.Portrait, Remove per card. No more navigate-away to character-voices page.
- Hybrid planner Assembly tab: runPreflight() added, Pre-Flight Review section added at top of assembly (always visible — before scenes.length === 0 guard)
- Movie planner Assembly: Pre-Assembly Review already present (confirmed)
- Children planner: Run Pre-flight Review button in Final tab (confirmed)
- Playwright: 9/9 PASS

**Next:** S13 — AI Motion Video SSE guard + Scene Forge lip sync (see uncomplete.md)

---

# GHS Handoff — 2026-04-30 (S3)

## S3 — BUG-04a/c/f payload + JSON guard
Branch: `fix/ghs-bug-04-payload-json-guard`

**Done:**
- children-planner scene-plan: payload rewritten to `{storyText, characters[], costPreference, targetDuration, projectId}`
- children-planner music/generate: `{prompt, durationSeconds}` replaces `{mood, duration}`
- `lib/api-utils.ts` created with `safeJson<T>()` — wraps 6 calls in children-planner + 1 in movie-planner
- TypeScript clean (tsc --noEmit), next build green
- Playwright: no JSON crash, bad payload returns JSON 400 (not HTML)

**Next:** S4 — BUG-04b tab order + character picker (see uncomplete.md)

---

# GHS Handoff — 2026-04-27

## Where we are

Main branch is GREEN. Karaoke Final Master Canvas restructure shipped. All 26 session PRs merged. Zero open PRs. Dev server up at :3200, Chrome debug at :9222.

## Tag for rollback safety
- `windows-final-2026-04-26` — last green build before any Linux migration. `git checkout windows-final-2026-04-26` rolls everything back.

## Today's commits since the tag

```
7e7d1a0  feat(karaoke): Final Master Canvas — Creator + Planner split (#24)
3bf9901  docs(karaoke): lock Final Master Canvas architecture
e66eb29  feat(karaoke): doc-polished flow — voice-first lyrics polish + simple-label audio editor (#23)
2576596  fix(sidebar): multi-open accordion — Karaoke / SFX / etc visible by default
0124f38  fix(karaoke): beat tracking — convert numpy 0-d tempo to float
8073e4f  fix(fal-gateway): send body flat — drop {input:...} wrap
2b60079  fix(continuous-motion): align adapter endpoints to live FAL paths (#22)
01ef6d1  chore(migration): mark FIXES_BEFORE_MIGRATION audit complete + tag drift
3987038  chore(migration): portable ffmpeg fallbacks + Linux migration runbook
ec47f09  fix(music-video-planner): dedupe runAutoTimestamp function
+ many earlier from the session
```

## Live routes (verified 200 just now)

- `/dashboard` — Sidebar shows all 6 groups expanded by default (multi-open fix)
- `/dashboard/karaoke-music-creator` — NEW (Create group). Mode A-E + 5 inputs.
- `/dashboard/karaoke-music-planner` — NEW (Planners group). 18-step workshop with flow lock.
- `/dashboard/karaoke-studio` — redirects to `karaoke-music-creator`
- `/dashboard/hybrid-planner` / `music-video-planner` / `commercial-planner` / `assets` / `ad-editor` — all 200
- `/terms` / `/privacy` / `/dmca` / `/ai-disclosure` / `/cookies` / `/sound-licensing` / `/acceptable-use` — all 200

## Karaoke architecture (locked per Final Master Canvas)

| Surface | Route | Owns |
|---|---|---|
| **Karaoke Music Creator** (Create group) | `/dashboard/karaoke-music-creator` | Mode A-E selector (Voice→Music / Voice→Karaoke / Voice→Polished Demo / Voice→Lyrics+Music / Voice→Beat Match) + 5 inputs (record / upload / asset library / recent / paste URL) |
| **Karaoke Music Planner** (Planners group) | `/dashboard/karaoke-music-planner` | 18-step workshop: Voice Input → Cleanup ⏸ → Analysis → Melody ⏸ → Lyrics → Lyrics AI (5 levels) → Flow Profiling → Beat Recommendation (11 families) → Production Brief → Music Gen → RVC ⏸ → Mixing → Review → Version Compare → FFmpeg Assembly → Export → Optional Video Pipeline → Storage Lifecycle |

Flow LOCK rule: Music Gen disabled until tempo + lyrics + flow + brief all complete.

## In-flight / blocked / waiting

### Waiting on Henry (you)

| Item | Action needed |
|---|---|
| **T4 Finance Phase 2** | Trigger phrase: "start Finance Phase 2" or "build credits" (per Must Read SECTION A1). DO NOT auto-start. |
| **Karaoke music gen — Suno-quality** | Add `KIE_AI_API_KEY` to `.env`. Without it, Music Provider falls back to Stock Library (functional but not Suno). |
| **Karaoke long instrumental** | Add `MUBERT_PAT` to `.env`. Without it, Mubert adapter throws and falls back. |
| **CMF entitlement** | Wan Pro + Kling 2.5 may need fal.ai account credit top-up. Verify at fal.ai dashboard. (Not strictly blocking — Wan v2.5 endpoint works as of PR #22 fix.) |
| **GHS Linux migration** | Per `project_server_setup.md`: GHS is LAST in onboarding queue (Marabiz → HMKSync → GioBiz → Giolog → GHS). Drive via `connect Terry` when earlier projects are stable on Contabo VPS. |

### Post-Linux migration items (cannot install on Python 3.13 Windows)

| Item | Step | Linux command |
|---|---|---|
| Demucs | 2 — Vocal Cleanup | `pip install demucs torch` |
| Spotify Basic Pitch | 4 — Melody → MIDI | `pip install basic-pitch` |
| RVC | 11 — Voice Enhancement | `git clone Retrieval-based-Voice-Conversion-WebUI && pip install -r requirements.txt` |
| Voice similarity model | 21 — Deepfake prevention | TBD |

### On hold

| Task | Status | Why |
|---|---|---|
| T28 9-Thompson coverage test | on hold | Original burst hit Henry's rate limit. Re-run in a single sequential Thompson when ready (less concurrent burn). |

## Known gaps (not blockers, just noted)

- Karaoke Step 2 (Demucs) UI shows ⏸ "post-Linux install" badge — works visually, just no real cleanup happens. Fine until Linux.
- Karaoke Step 4 (Basic Pitch) same.
- Karaoke Step 11 (RVC) same.
- Music gen falls back to Stock Library when no `KIE_AI_API_KEY` — output is real but not Suno-quality.
- Mode B (Voice → Karaoke) Step 10 stub: takes existing song, vocal-extraction is `Demucs vocal_only` which needs Demucs (post-Linux).
- Test infra: `tests/restore-teddy-project.spec.ts` has stale project-restore mechanism. Reassigned to your manual smoke on Linux per FIXES_BEFORE_MIGRATION owner tag.

## Doc system (per Rule 13 — locked 2026-04-24)

| Doc | Purpose | Last touched |
|---|---|---|
| `CHANGELOG.md` | What/why/impact/risk per PR | 2026-04-27 |
| `HANDOFF.md` | Where stopped, in-progress, blockers, next steps (THIS DOC) | 2026-04-27 |
| `update/uncomplete.md` | Running task log + post-Linux + missing keys | 2026-04-27 |
| `update/PROBLEM_AND_FIX.md` | Bug log — check first when symptom recurs | various |
| `daily/2026-04-27_karaoke-restructure.md` | Today's full plan + file list + deferred | 2026-04-27 |
| `LINUX_MIGRATION_RUNBOOK.md` | End-to-end Ubuntu deploy | 2026-04-26 |
| `FIXES_BEFORE_MIGRATION.md` | 5-item checklist + audit notes | 2026-04-26 |
| `URGENT_INSTRUCTIONS.md` | 8-step audio pipeline manual smoke | unchanged |
| `Must Read.md` | Spec index + deferred items + global rules | unchanged |
| `CLAUDE.md` (project root) | §0 Karaoke architecture + product master canvas | 2026-04-27 |

## Servers / processes

- Dev server: `npm run dev` on :3200 (currently up after final restart). Owns Prisma client DLL — kill before any `prisma generate`.
- Chrome debug: `start_chrome_debug.bat` on :9222. Used by Playwright CDP tests.
- Both auto-start when needed; safe to leave running.

## Source-of-truth docs (Karaoke specifically)

- TECH: `update/GHS KERAOKE/GHS_KARAOKE_STUDIO_PLAN.md` — 11-step pipeline + tools
- FLOW: `update/GHS KERAOKE/GHS Karaoke.docx` (extracted: `GHS_Karaoke_extracted.txt`) — 10-step user-side workflow + 5 modes + UX principles
- MASTER: `update/GHS KERAOKE/GHS KARAOKE update.docx` (extracted: `GHS_KARAOKE_update_extracted.txt`) — Final Master System Canvas, 18-step pipeline, locked architecture
- Reference: `update/GHS KERAOKE/GHS KAROKE KERAOKE GEMINI.pdf`

## Rules (preserved)

- Voice = truth. Flow = authority. AI assists. User decides. System executes.
- Music gen MUST NOT start until cleanup + tempo + melody + lyrics + flow profile + brief all complete.
- Lyrics polish: Option 1 is always the user's exact line. Server-enforced. Never auto-overwrite.
- Audio editor opens neutral on "Natural Voice" preset. Reset button always visible.
- 5 intervention levels: improve / simplify / strengthen / rewrite_light / rewrite_full. Default = improve.

## Resume instructions for next session

1. Verify dev still up: `curl http://localhost:3200/dashboard/karaoke-music-creator` (expect 200).
2. If Henry says "start Finance Phase 2": load `update/GHS_PAYMENT_BILLING_PLAN.md` and proceed.
3. If Henry adds Kie.ai key: restart dev server, then test music gen via `/api/karaoke/generate-music` with mode A.
4. If Henry says "run karaoke 100% test": spawn ONE sequential Thompson hitting all 18 steps, not 9 parallel (avoids rate-limit burst).
5. If Henry triggers GHS Linux migration: `connect Terry` and follow `LINUX_MIGRATION_RUNBOOK.md` end-to-end.

## Backlog summary (open tasks)

| ID | Task | Owner |
|---|---|---|
| T4 | Finance Phase 2 — credit DB + deduction | blocked on trigger |
| T28 | Re-run 9-Thompson coverage test | on hold (rate limit) |
| (post-Linux) | Demucs / Basic Pitch / RVC / voice similarity | on Linux deploy |
| (post-keys) | Suno-quality lyrical music gen via Kie.ai | needs KIE_AI_API_KEY |
| (post-keys) | Long instrumentals via Mubert | needs MUBERT_PAT |

Total session shipped: **26 PRs merged + 1 tag pushed.** Karaoke architecture finalized. Migration prep done. Linux migration is the next big move when GHS reaches the front of your queue.

## 2026-05-17 22:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-17 23:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ```

## 2026-05-17 23:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ```

## 2026-05-18 00:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ```

## 2026-05-18 01:31 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ```

## 2026-05-18 02:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ```

## 2026-05-18 02:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ```

## 2026-05-18 03:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
  ```

## 2026-05-18 03:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
  ```

## 2026-05-18 05:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 05:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 15:38 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 15:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 16:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 16:31 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 16:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 17:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 18:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 20:06 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/api/hybrid/story-expand/route.ts
   M app/components/PreGenerationGate.tsx
  ```

## 2026-05-18 21:46 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/api/hybrid/story-expand/route.ts
   M app/components/PreGenerationGate.tsx
  ```

## 2026-05-18 22:58 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-18 23:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-18 23:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-18 23:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:35 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:58 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 04:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 15:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 16:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 21:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2312034 fix(bear-head): remove scene-text animal detection — only explicit species triggers animal mode`
- working tree:
  ```
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 22:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `83a965d fix(face-lock): remove modelId bypass — PuLID now activates whenever portrait exists`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 22:38 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `26de934 fix(subtitle): preserve line breaks + surface burn-in failures to user`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 01:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 01:11 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 01:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:14 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:20 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `829ea62 fix(character-extract): require skinTone + age, inject ethnicity into visualDescription`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:42 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `829ea62 fix(character-extract): require skinTone + age, inject ethnicity into visualDescription`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 03:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b65cce5 diag(face-lock): surface PuLID status to UI per scene so silent failures are visible`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 03:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b65cce5 diag(face-lock): surface PuLID status to UI per scene so silent failures are visible`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 03:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1774db4 fix(ai-read): never let portrait-reading AI override story-extracted ethnicity/age`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 04:18 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1774db4 fix(ai-read): never let portrait-reading AI override story-extracted ethnicity/age`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-20 06:11 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1774db4 fix(ai-read): never let portrait-reading AI override story-extracted ethnicity/age`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `daae5db fix(assembly): intro/outro preview shows <img> for PNG cards, not <video>`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `221c608 fix(subtitle): escape colon in Windows fontfile path — drawtext was failing silently`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `64df85d fix(character-extract): pipe ethnicity from extraction → React state → portrait prompt`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:37 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `64df85d fix(character-extract): pipe ethnicity from extraction → React state → portrait prompt`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:50 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `863b493 fix(character-extract): walk entire expandedStory object for ethnicity inference`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 08:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `863b493 fix(character-extract): walk entire expandedStory object for ethnicity inference`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 15:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:34 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0abe0 fix(ollama): raise default timeout 15s → 90s for local model latency`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 22:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0abe0 fix(ollama): raise default timeout 15s → 90s for local model latency`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-21 01:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0abe0 fix(ollama): raise default timeout 15s → 90s for local model latency`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-21 01:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `87af189 test(ethnicity): Playwright test proves UI mapping works given correct server data`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 01:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `87af189 test(ethnicity): Playwright test proves UI mapping works given correct server data`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 01:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a5701e fix(character-extract): Option B — story-wide dominant ethnicity override`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 03:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a5701e fix(character-extract): Option B — story-wide dominant ethnicity override`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 03:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a5701e fix(character-extract): Option B — story-wide dominant ethnicity override`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 03:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8f5e3f0 fix(scene-image): match Scene Board characters by displayName too, not just characterId`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 04:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `bf4f88a fix(scene-image): block shirtless defaults — characters get clothing override even when PuLID-locked`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:04 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `73f66b5 fix(children-planner): age-appropriate vocabulary + music providerKey + karaoke narration`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:08 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `08255ba fix(portrait): stop shirtless defaults at portrait gen — PuLID locks portrait state`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d53a2f3 fix(pulid): lower id_weight + delay start_step so scene prompts can override portrait state`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `96db101 fix(scene-prompt): cast description skips empty/contaminated fields`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d4ba8a3 fix(children-planner): match hybrid story-expand call — Story Length picker + tier:pro`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 15:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d4ba8a3 fix(children-planner): match hybrid story-expand call — Story Length picker + tier:pro`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 17:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6ba628e docs(plans): approved plan — port Hybrid scene editor to Movie + Children planners`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 17:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6ba628e docs(plans): approved plan — port Hybrid scene editor to Movie + Children planners`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 17:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f39328a docs(plans): scene composition fix plan — PuLID locking full portrait composition, not just face`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 22:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f3073bb docs(handoff): Session 19 — children vocabulary + PuLID tuning + 2 approved plans waiting`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 23:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f3073bb docs(handoff): Session 19 — children vocabulary + PuLID tuning + 2 approved plans waiting`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-22 04:47 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d767ff7 docs(handoff): add Session 19 push log — F1+F2+F3, story-expand rich scenes, Phase A+B toolbars`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-22 18:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `94417ac docs(handoff): finished — F4 + Phase D landed, all 3 child-safe ops verified live`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 00:34 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `74f57ee docs(plans): fix plan for Henry's 8 issues — subtitle, narration, scene-board, toolbar placement`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 01:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7ecd210 docs(plans): add FIX 9 — characters POSING not ACTING in scenes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 01:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7820ea0 fix(planners): 7 fixes from Henry's frustration log — toolbar, URL, audio, chat, persist, pose, subtitle cap, length`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 01:30 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7820ea0 fix(planners): 7 fixes from Henry's frustration log — toolbar, URL, audio, chat, persist, pose, subtitle cap, length`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 03:01 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-23 03:14 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 04:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 04:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M test-results/.last-run.json
   M update/CHANGELOG.md
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-23 05:35 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M test-results/.last-run.json
   M update/CHANGELOG.md
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-23 05:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M test-results/.last-run.json
   M update/CHANGELOG.md
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-23 05:42 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `996b5fc fix(assembly): narrator endTime + totalDuration correction + caption layout`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-23 05:47 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `996b5fc fix(assembly): narrator endTime + totalDuration correction + caption layout`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 05:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `996b5fc fix(assembly): narrator endTime + totalDuration correction + caption layout`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 06:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `de1c0df docs(handoff): Session 20 — export fix committed, all triggers confirmed done`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-23 18:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:46 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:47 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:48 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 18:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:18 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 19:56 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 21:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 21:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 22:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 22:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 22:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:05 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:31 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 23:57 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 00:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 00:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `84a06bb checkpoint: HANDOFF before linux migration 2026-05-23T0603Z`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 01:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1f17fd8 docs(handoff,changelog): 2026-05-23 Linux migration + 9-fix plan complete`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-24 01:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1ba0205 docs(changelog): Wave 3+4 scaffolding shipped autonomously 2026-05-23`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 02:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `267a6c7 chore(deps): add @aws-sdk/client-s3 + s3-request-presigner to package.json`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-24 03:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `267a6c7 chore(deps): add @aws-sdk/client-s3 + s3-request-presigner to package.json`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 03:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f7124c fix(next.config): add andiostudio.com to allowedDevOrigins — restore button interactivity`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 03:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3094e0f docs(changelog): allowedDevOrigins fix recorded — verified 31/34 buttons restored`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 03:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7f7bb75 feat(music): GET /api/music/stock licensed catalog + manifest for 17 bundled tracks`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 03:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7f7bb75 feat(music): GET /api/music/stock licensed catalog + manifest for 17 bundled tracks`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 03:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 04:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 04:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 04:48 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 05:04 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 05:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 05:23 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `099af35 docs(changelog): Piper TTS + 50 CC BY music tracks LIVE on andiostudio.com`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 06:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `c4ed465 fix(assembly): NDJSON streaming response — defeats CF Free-plan 100s timeout`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 06:30 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-24 09:01 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-27 00:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 00:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 02:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 02:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 02:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 03:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 03:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 03:30 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 03:48 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 04:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 06:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   M src/core/pipeline.ts
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
  ```

## 2026-05-27 06:56 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   M src/core/pipeline.ts
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
  ```

## 2026-05-27 06:58 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   M src/core/pipeline.ts
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
  ```

## 2026-05-27 07:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dddf7a9 docs(changelog): assembly streaming response landed (commit c4ed465)`
- working tree:
  ```
   M HANDOFF.md
   M src/core/pipeline.ts
   M src/lib/generation/gateways/segmind.ts
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
  ```

## 2026-05-27 07:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `054659b fix(build): restore green production build + wire mock-video switch`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 07:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `054659b fix(build): restore green production build + wire mock-video switch`
- working tree:
  ```
   M HANDOFF.md
   D storage/characters/cmoffuo5a0008vrdvyvh7oln4/portrait_1777754781832.jpg
   D storage/characters/cmoffuo5k0009vrdve2dbib7d/portrait_1777754786011.jpg
   D storage/characters/cmoffuo5q000avrdv6j41epa2/portrait_1777754788678.jpg
   D storage/characters/cmohu8s6f0000tzgwwwvbmm7j/portrait_1777754791426.jpg
   D storage/characters/cmohu8s730001tzgw3u41hwqi/portrait_1777754793795.jpg
   D storage/characters/cmohu8s7h0002tzgw0tbrs2o6/portrait_1777754796186.jpg
   D storage/characters/cmohu8s7w0003tzgwmuyeuclp/portrait_1777754798993.jpg
   D storage/characters/cmohu8s8p0004tzgw1ccp438e/portrait_1777754801553.jpg
   D storage/characters/cmoiwlurg000atzgwynvbkw4k/portrait_1777754804173.jpg
  ```

## 2026-05-27 14:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `054659b fix(build): restore green production build + wire mock-video switch`
- working tree:
  ```
   M HANDOFF.md
   M app/globals.css
   M app/layout.tsx
   M test-results/.last-run.json
  ?? app/components/AppShell.tsx
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-05-27 16:31 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `0875b13 docs: mobile shell shipped + 204-asset recovery + subtitle-too-big bug logged (2026-05-27)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 17:08 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `205c597 docs: Phase 1 stabilization complete — karaoke Tier1 engines, pg_dump cron, story-qc quarantine, R2 deferral + server-state recovery notes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 17:57 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `205c597 docs: Phase 1 stabilization complete — karaoke Tier1 engines, pg_dump cron, story-qc quarantine, R2 deferral + server-state recovery notes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 18:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `205c597 docs: Phase 1 stabilization complete — karaoke Tier1 engines, pg_dump cron, story-qc quarantine, R2 deferral + server-state recovery notes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 18:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `205c597 docs: Phase 1 stabilization complete — karaoke Tier1 engines, pg_dump cron, story-qc quarantine, R2 deferral + server-state recovery notes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 20:50 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `9773b87 docs: asset delete button fixed (move to .trash, no more reappearing)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 21:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ebe4cbd docs: dashboard mobile fix (dup topbar + grid overflow) live`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 21:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ebe4cbd docs: dashboard mobile fix (dup topbar + grid overflow) live`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-27 23:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `a1e9f3e docs: subtitle fix VERIFIED on real assembled render (not just synthetic)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-28 00:14 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `135dd32 fix(children+hybrid): content modes do their real format, length mandate, culture de-inversion + Hollywood`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 01:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `135dd32 fix(children+hybrid): content modes do their real format, length mandate, culture de-inversion + Hollywood`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 01:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `719625a fix(children): iterative length expansion — continuation passes fill long story requests`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 02:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `719625a fix(children): iterative length expansion — continuation passes fill long story requests`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 02:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `bbf0337 fix(culture): strip era 'For African settings' clause for non-African cultures`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 03:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `99c0d06 fix(build): drop regex /s dotAll flag (unsupported at TS target) — use [\s\S] — restores production build`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 03:56 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `fc3704a fix(hybrid+music-video): grids fluid at any width (auto-fit minmax); fixed layout grids preserved`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 18:30 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3f6b2cf fix(gate): portal the pre-generation modal to body so it centers (transformed ancestor broke fixed positioning)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 18:51 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1d1ac44 fix(assembly): missing-image scenes get a solid placeholder too (extract solidPlaceholderClip helper)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 19:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6b39bd0 fix(llm): free tier no longer 503s — Ollama auto-picks an installed model + story-expand falls back to cloud`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 20:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `71c86d0 fix(story-expand): cap free-tier Ollama at 45s + fall back to cloud — CPU-only host took >5min on llama3.1:8b (children planner hung). Continuations follow the provider that answered.`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 20:05 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `71c86d0 fix(story-expand): cap free-tier Ollama at 45s + fall back to cloud — CPU-only host took >5min on llama3.1:8b (children planner hung). Continuations follow the provider that answered.`
- working tree:
  ```
   M HANDOFF.md
   M scripts/abc_format_test.mjs
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ```

## 2026-05-28 20:08 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `53ec66e docs: children-planner free-tier LLM fix verified (#45) + ABC format live-confirmed; handoff/changelog updated`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/length_fill_test.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ```

## 2026-05-28 20:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `56c24cc docs+test: karaoke MAIN free-stock verified (#46) — premium gating confirmed live`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 20:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `02f743a perf(assembly): ~3-4x faster — ultrafast preset on intermediate clip encodes + concurrency 4->7 (8-core box)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 20:38 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d4a455b perf(assembly): skip final_merge video re-encode when concat already covers target — copy instead of stream_loop+libx264. Removes a full-video pass on long videos (the main remaining cost)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 20:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d4a455b perf(assembly): skip final_merge video re-encode when concat already covers target — copy instead of stream_loop+libx264. Removes a full-video pass on long videos (the main remaining cost)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/audio_merge_test.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ```

## 2026-05-28 20:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `4ba9320 docs+test: assembly perf verified (#47) — 42s->20s, audio path probed (h264+aac); handoff updated`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 22:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `4ba9320 docs+test: assembly perf verified (#47) — 42s->20s, audio path probed (h264+aac); handoff updated`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/karaoke_e2e_test.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ```

## 2026-05-28 22:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ee2debe fix(karaoke): LLM steps fall back Claude->OpenAI->Ollama — were direct Anthropic calls that 500'd when credits depleted, blocking the whole pipeline at flow-profile`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 23:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `86465f9 fix(karaoke): assemble resolves /api/media/music/stock/*.mp3 — resolveFilePath was karaoke-only, broke stock backing track ('Cannot resolve path')`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 23:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `bd95f49 docs: karaoke MAIN pipeline verified GREEN e2e on free engines (#48 LLM fallback, #49 assemble path); flag Anthropic credit depletion`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-28 23:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b834407 fix(scene-image): person-count lock + extra-people negative — stops phantom/duplicate people in multi-character scenes (2-char scene was rendering 3). Scoped to known small casts, skipped for crowd scenes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
   M update/REMAINING_TODO.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/phantom_people_test.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-05-28 23:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3eb2910 docs: karaoke tempo is fine (tempo_bpm correctly detected+consumed) — was a test-display artifact, not a bug`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 00:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `19a3d3e feat(hybrid): actor-voice on/off toggle in Sound + Assembly tabs (#2) — deactivate character voices anytime (narrator only); gated + persisted`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/ducking_test.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ```

## 2026-05-29 00:08 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `075a7ac docs+test: narrator ducking (#51) + actor-voice toggle (#2) + scene-image cameraman/age/env/count (#52) — all verified`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 02:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `075a7ac docs+test: narrator ducking (#51) + actor-voice toggle (#2) + scene-image cameraman/age/env/count (#52) — all verified`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 03:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d47fffe fix(image): systemic anti-fantasy guard — non-fantasy stories no longer render angel/fairy wings, halos, divine glow from ambiguous words (plane 'wings' -> angel). Shared getAntiFantasyNegative() in scene-image + establishing-shot`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/plane_not_angel_test.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ```

## 2026-05-29 03:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `9d4f9c7 docs+test: anti-fantasy guard verified (#53) — model plane renders as aircraft not angel wings`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 03:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `18def52 docs: refresh REMAINING_TODO to current state (12 fixes closed; what's left = R2/Phase3 + browser e2e + model residuals)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 03:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f4ba078 docs: live provider credit snapshot (Segmind 6.91, FAL locked/exhausted, ElevenLabs TTS ok, Kling valid); face-lock blocker corrected to FAL top-up (not R2)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 04:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `99ee613 docs: face-lock free seed path documented; FAL=premium-later; record no-lazy-API/free-first principle`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-29 22:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `280b841 docs: mark #6+#7 fixed (efaee13) + CHANGELOG explanation`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 00:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `280b841 docs: mark #6+#7 fixed (efaee13) + CHANGELOG explanation`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 00:48 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `280b841 docs: mark #6+#7 fixed (efaee13) + CHANGELOG explanation`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 02:23 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `280b841 docs: mark #6+#7 fixed (efaee13) + CHANGELOG explanation`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 02:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `280b841 docs: mark #6+#7 fixed (efaee13) + CHANGELOG explanation`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 02:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `280b841 docs: mark #6+#7 fixed (efaee13) + CHANGELOG explanation`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 02:46 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7894e03 feat(subtitle): 8 FB/YT-style per-word animated modes + duck depth 0.02`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 04:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `27d6c36 fix(subtitle): highlight mode now spotlights ONLY the spoken word, not full line`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 04:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b4f774f docs(p&f): log highlight bouncing-ball fix (27d6c36)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 05:06 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b4f774f docs(p&f): log highlight bouncing-ball fix (27d6c36)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 14:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7c4bd6b docs: handoff for auto-expand + template catalog fix (1d571d1)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 15:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ff91d86 docs: handoff #14 children subtitle staging (a40b53a)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 16:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `c18b875 docs: handoff #15 parity audit (6e3ba9a) — children at 85% parity`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 20:11 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `21de508 docs: handoff #33 karaoke flow-lock button (bf5cdc7) — 25 fixes shipped`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 20:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `21de508 docs: handoff #33 karaoke flow-lock button (bf5cdc7) — 25 fixes shipped`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 20:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `45336df docs: session scorecard 2026-05-30 — 29 closed, sweep backlog empty`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 22:23 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `0d10933 docs: handoff #38 children prefill + 10 modify buttons (56e32f2)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 22:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `37fadb9 docs: handoff #39 broken thumbnails + modify buttons (f7525e3)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 23:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `37fadb9 docs: handoff #39 broken thumbnails + modify buttons (f7525e3)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 23:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `9223748 docs: handoff #40 real narration+subtitle server fix (02c6f07)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-30 23:57 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `bbfa6a3 docs: handoff #41+#42 Max ON + Piper resolution (49f353d + b4d8092)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 00:57 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `c2cc065 docs: handoff #43 children fixes (529fa05 + b554f40)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 01:37 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6de9506 docs: handoff #44 inline LLM picker (0c1513c)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 01:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `528c79e docs: handoff #45 children prompt quality (322ae0c)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 02:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `528c79e docs: handoff #45 children prompt quality (322ae0c)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 02:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `528c79e docs: handoff #45 children prompt quality (322ae0c)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 02:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8479d1e test: karaoke epic-brief test for Henry listen`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 02:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `162104d docs: handoff #47 children auto-expand before narration (1351cc5)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 03:51 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `988ae71 docs: handoff #48 children 4-fix quality (156e03f)`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 04:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0c5b6 fix(children): add manual ✨ Re-suggest button — auto-prefill silently no-op'd`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 04:37 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `824b74c docs: handoff #49 Letters & Sounds 5→27 topics (473b6d3) + #5f0c5b6 manual re-suggest`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-31 04:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8596323 docs: handoff #50 educational-first + image-fail visibility (2007a8e)`
- working tree:
  ```
   M HANDOFF.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-31 06:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `41d4c5a docs: handoff #51 mirror hybrid — fullScript + per-scene narration (02d101d)`
- working tree:
  ```
   M HANDOFF.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ```

## 2026-05-31 08:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d9432d8 fix(children-planner): assemble button stayed grey on reopen — auto-select scenes from restored state + persist selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 08:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d9432d8 fix(children-planner): assemble button stayed grey on reopen — auto-select scenes from restored state + persist selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 17:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d9432d8 fix(children-planner): assemble button stayed grey on reopen — auto-select scenes from restored state + persist selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 17:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d9432d8 fix(children-planner): assemble button stayed grey on reopen — auto-select scenes from restored state + persist selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 17:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d9432d8 fix(children-planner): assemble button stayed grey on reopen — auto-select scenes from restored state + persist selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 17:46 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `a438f66 fix(children-planner): belt-and-suspenders auto-select net for empty assemblySelectedIds`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 20:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `286c624 fix(children): 3 image+narration fixes — descriptions backfilled, no human-guard on object scenes, pre-expand on narration`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 20:35 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f44be26 fix(karaoke): safe JSON parsing for non-JSON 5xx + clarify music gen fallback`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 21:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a15999 fix(children): pull narration from audioPlans when textContent is empty (BIB fix #3)`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:18 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `267a01b fix(karaoke): expand stock library + honest match-quality reporting`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:51 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:51 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 22:56 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1db36ff fix(children-planner): kill infinite re-render loop in visualDescription backfill`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 23:06 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `cc0b198 feat(karaoke): RVC keep-anyway toggle with OS confirmation prompt`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 23:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `cc0b198 feat(karaoke): RVC keep-anyway toggle with OS confirmation prompt`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-05-31 23:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8bde095 fix(children-planner): BIB audit deep — shared narration resolver + ?continue= fix`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 00:05 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8bde095 fix(children-planner): BIB audit deep — shared narration resolver + ?continue= fix`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 00:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dc67814 fix(assemble): subtitle disappeared (#1) — surface drawtext failures + simple fallback`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 00:37 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dc67814 fix(assemble): subtitle disappeared (#1) — surface drawtext failures + simple fallback`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 00:58 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `172489f feat: 4 Sonnet-dispatched items — music genre picker, word-on-image, demucs/basic-pitch routes`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 01:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `172489f feat: 4 Sonnet-dispatched items — music genre picker, word-on-image, demucs/basic-pitch routes`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 01:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `172489f feat: 4 Sonnet-dispatched items — music genre picker, word-on-image, demucs/basic-pitch routes`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 01:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `172489f feat: 4 Sonnet-dispatched items — music genre picker, word-on-image, demucs/basic-pitch routes`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 02:14 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `4a4cb67 feat(karaoke + docs): safe music policy + Free Mode beats picker + MUST-READ master log`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 02:30 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ea64b09 feat(karaoke): wire Step 2 (Demucs) + Step 4 (Basic Pitch) UI to backend routes`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/HANDOFF.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 03:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6adc321 fix(scripts): pivot music download to Internet Archive cloud-music-4 (FreePD dead) + HANDOFF update`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 04:27 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6adc321 fix(scripts): pivot music download to Internet Archive cloud-music-4 (FreePD dead) + HANDOFF update`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 04:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6adc321 fix(scripts): pivot music download to Internet Archive cloud-music-4 (FreePD dead) + HANDOFF update`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 04:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `09cca38 feat(karaoke): T1-C purge cron + T1-D Music Video handoff route`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 04:57 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `09cca38 feat(karaoke): T1-C purge cron + T1-D Music Video handoff route`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 05:27 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `4a031a6 fix(children-planner): assembleMovie now uses shared resolveNarrationText helper`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 06:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `4a031a6 fix(children-planner): assembleMovie now uses shared resolveNarrationText helper`
- working tree:
  ```
   M HANDOFF.md
   M app/dashboard/karaoke-music-planner/page.tsx
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 06:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `0142e4a fix(karaoke): wire safeKaraokeJson to Steps 9/10/15/16 + Demucs --segment 10`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 06:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `62da4e3 feat(children-planner): Story Credits persist to localStorage (hard-refresh safe)`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 06:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `62da4e3 feat(children-planner): Story Credits persist to localStorage (hard-refresh safe)`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 06:42 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `62da4e3 feat(children-planner): Story Credits persist to localStorage (hard-refresh safe)`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 06:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7544684 feat(stock): catalog_freepd.mjs script — adds explicit manifest entries for the freepd subdir with mood/genre per file`
- working tree:
  ```
   M HANDOFF.md
   M app/dashboard/children-planner/page.tsx
   M app/dashboard/karaoke-music-creator/page.tsx
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? app/api/karaoke/mix-over-beat/
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? src/lib/karaoke/
  ```

## 2026-06-01 06:56 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ac7a23c docs: autonomous-push state log — running commit list + queue + safe-music policy + server install state`
- working tree:
  ```
   M HANDOFF.md
   M app/api/karaoke/delete/route.ts
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 07:06 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `11f717d docs(plan): children-planner 7,394-line refactor PLAN — 18 PRs, 11.5 days, 17 sessions`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `82c76d0 feat(karaoke export): surface license sidecar download next to MP3`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:20 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ab50f23 feat: children-video topic search filter + karaoke deep-link URL state`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `29d2a71 feat(music): manifest-driven stock scorer — 86 cataloged tracks now drive genre matching`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f4728a7 feat(karaoke): /api/karaoke/session-summary — full take JSON archive download`
- working tree:
  ```
   M HANDOFF.md
   M app/api/karaoke/beats-library/route.ts
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 07:38 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `71661e3 feat(karaoke beats-library): mood + genre query params + meta block`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8bfb747 feat(karaoke picker): server-side mood/genre filter wire — chip rows stay stable`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:50 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7fc67b1 fix(style): 3d-cinematic suffix strengthened — volumetric + Unreal + octane cues`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 07:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6dc296b feat(stock): detect_track_bpm.mjs — rough BPM estimation via ffmpeg silencedetect`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:05 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b0b54cf fix(karaoke): Step 3 Audio Analysis converted to safeKaraokeJson`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b0b54cf fix(karaoke): Step 3 Audio Analysis converted to safeKaraokeJson`
- working tree:
  ```
   M HANDOFF.md
   M src/modules/music-provider/adapters/stock.adapter.ts
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-01 08:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `e71d972 feat(music): stock scorer now considers BPM proximity (additive bonus)`
- working tree:
  ```
   M HANDOFF.md
   M app/api/karaoke/beats-library/route.ts
   M app/dashboard/karaoke-music-creator/page.tsx
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-06-01 08:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `fb26d4e feat(karaoke): beats picker tempo filter + BPM display`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:20 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `14c4e12 feat(karaoke): 📋 Copy share link button on planner header`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:27 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `c9440ab feat(karaoke): 🎧 Now playing header bar — inline audio of mixed output`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5b8bc6f docs: append wave 4 commits to AUTONOMOUS_PUSH log + 3D fall-through entry to MUST-READ`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7b2af47 feat(karaoke): keyboard shortcuts — J/K next/prev take, Space play/pause, ? for help`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 08:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `31f2b68 feat(karaoke): 📦 Export ALL formats as ZIP — bundle endpoint + Step 16 button`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 16:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `31f2b68 feat(karaoke): 📦 Export ALL formats as ZIP — bundle endpoint + Step 16 button`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 16:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8519c21 feat(karaoke): inline rename of takes via double-click in sidebar`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 16:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ffa90fa feat(karaoke): browser tab title syncs to current take + running indicator`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 16:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `ab28a9b docs: end-of-session overnight summary — single-page orientation for Henry`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 16:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `96f92d4 feat(karaoke): ⋮ kebab menu per take — Rename + Copy ID + (Duplicate soon)`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 16:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `cc40b66 feat(children-video): ← Back to age groups link to reset selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 17:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `cc40b66 feat(children-video): ← Back to age groups link to reset selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 21:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `cc40b66 feat(children-video): ← Back to age groups link to reset selection`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 21:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3ee7bc6 fix(children assemble): fire-and-poll pattern — bypass Cloudflare Tunnel 100s timeout`
- working tree:
  ```

## 2026-06-01 21:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `fe8b69c fix(children Story Credits): unify Screenplay 'Written by' with Story Credits writtenBy`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 23:06 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `e4f2505 feat(children Screenplay): all 3 Story Credits inputs (Written by / Made by / Idea from)`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 23:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8a5e7de fix(children Screenplay): Story Credits now ALWAYS visible on Screenplay tab`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 23:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8a5e7de fix(children Screenplay): Story Credits now ALWAYS visible on Screenplay tab`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-01 23:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `55222bd fix(assemble-async): force localhost — was sending internal fetch back through Cloudflare`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 00:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `55222bd fix(assemble-async): force localhost — was sending internal fetch back through Cloudflare`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 00:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3f4f3c5 feat(children assemble): visible progress bar (0..100%) + red error box`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 00:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `92c0d88 fix(assemble-async): spawn detached worker process — Next.js was discarding bg promises`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 00:35 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `92c0d88 fix(assemble-async): spawn detached worker process — Next.js was discarding bg promises`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 00:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `378982a fix(assemble worker): retry with backoff + 127.0.0.1 — survives service restart race`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 01:01 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `e73058c perf(assemble worker): smart probe replaces blind 60s retry wait`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 01:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8295d87 perf(children) Option B: pre-render scene MP4 with Ken Burns on image gen`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:18 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8295d87 perf(children) Option B: pre-render scene MP4 with Ken Burns on image gen`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:42 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 02:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `af7bea1 fix(assemble): dead-worker detector — stop UI from sitting at 95% forever`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 03:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dfa4839 fix(children): no more multi-beat explosion — 7 scenes = 7 entries, not 70`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 03:23 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dfa4839 fix(children): no more multi-beat explosion — 7 scenes = 7 entries, not 70`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 03:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dfa4839 fix(children): no more multi-beat explosion — 7 scenes = 7 entries, not 70`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 03:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dfa4839 fix(children): no more multi-beat explosion — 7 scenes = 7 entries, not 70`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 03:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dfa4839 fix(children): no more multi-beat explosion — 7 scenes = 7 entries, not 70`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ?? tests/children-1-landed.png
  ```

## 2026-06-02 04:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `dfa4839 fix(children): no more multi-beat explosion — 7 scenes = 7 entries, not 70`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/_tmp_page_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-06-02 05:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b42df0d WORKAROUND: switch start to next dev — sidestep Turbopack v16 chunk bug`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/_tmp_page_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-06-02 05:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b42df0d WORKAROUND: switch start to next dev — sidestep Turbopack v16 chunk bug`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/_tmp_page_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-06-02 05:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7cd69b8 fix(children): remove dead /api/scene/prerender call`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/_tmp_page_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-06-02 05:56 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6e370a9 fix(assemble worker): heartbeat every 8s while assembling`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 14:48 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `e4fec04 fix(children UI): show REAL server heartbeat elapsed, not client estimate`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 14:50 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `e4fec04 fix(children UI): show REAL server heartbeat elapsed, not client estimate`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 15:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2eb32b8 perf(assemble): ASS subtitle path — 10x faster than chained drawtexts`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 18:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2eb32b8 perf(assemble): ASS subtitle path — 10x faster than chained drawtexts`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 19:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `a501dc2 fix(subtitle+projects): kill 2-subtitle overlap, restore rainbow, project mgmt`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 19:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `45fcfe0 ui(children): De-vocarize card — high-visibility prominent placement`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 20:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6eae854 ui(children): move De-vocabularize into modify row, prompt() for age`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 20:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6eae854 ui(children): move De-vocabularize into modify row, prompt() for age`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-02 21:04 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6eae854 ui(children): move De-vocabularize into modify row, prompt() for age`
- working tree:
  ```
   M HANDOFF.md
   M update/CHANGELOG.md
   M update/PROBLEM_AND_FIX.md
  ?? FIXNEWCHIDHYBRIDANDMORE05272026.MD
  ?? pnpm-lock.yaml
  ?? scripts/_tmp_clean_check.mjs
  ?? scripts/probe-children-assemble.mjs
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/_mobile/
  ```

## 2026-06-06 02:12 UTC — auto-checkpoint (dirty)
- branch: `fix/freemode-narration-ui-comprehensive`
- HEAD: `747b526 fix(free-mode+ui): scene-card voice picker + brighter muted UI + auto-batch image gen`
- working tree:
  ```
   M app/api/generation/image/route.ts
   M app/api/generation/video/route.ts
  ```

## 2026-06-06 02:59 UTC — auto-checkpoint (new-commit)
- branch: `docs/wave1-segregation-log`
- HEAD: `00331e0 docs: log Wave 1 segregation results + TS variance pattern`

## 2026-06-06 03:01 UTC — auto-checkpoint (dirty)
- branch: `docs/wave1-segregation-log`
- HEAD: `00331e0 docs: log Wave 1 segregation results + TS variance pattern`
- working tree:
  ```
   M HANDOFF.md
  ```

## 2026-06-07 05:29 UTC — auto-checkpoint (new-commit)
- branch: `refactor/movie-planner-wave-2`
- HEAD: `dfc81e9 refactor(movie-planner): Wave 2.1 — extract CharactersTab (-150 LOC)`

## 2026-06-07 07:26 UTC — auto-checkpoint (new-commit)
- branch: `fix/free-mode-images-per-second`
- HEAD: `3c11a76 fix(free-mode): user-pick seconds-per-image + subtitles persist + 600s cap`
