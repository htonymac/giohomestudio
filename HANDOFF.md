# GHS Handoff — 2026-05-02 (Smart Builder auto-refresh fix)

## Done this session
- **Smart Builder character not appearing in list** — fixed `app/dashboard/character-voices/page.tsx` L919 (handleBuild fires `onCreated()` right after `setResult(data)`) + L955 (X close button refreshes if a character was built). Logged in PROBLEM_AND_FIX.md entry #0.
- Dev server confirmed up on port 3200, character-voices page returns 200.
- Port audit clean: 3040=Marabiz, 3050=stale HMKSync local, 3060=HMKSync preview tunnel, 3200=GHS.

## Branch / commit
- Working tree edits only — NOT committed yet. Two-line fix in one file.

## Next exact steps
1. Browser-test: open `http://localhost:3200/dashboard/character-voices`, run Smart Builder, confirm new character shows in list immediately (no Done click needed).
2. If green → commit on a feature branch (`fix/character-voices-auto-refresh`) and merge to main.
3. Resume the broader GHS Apr30 list (`project_ghs_planner_corrections_apr30.md`): tab order, Sound tab 5-tier model selector, scene inline edit, bear fix S1-S12 not merged, slices SA-SE.

## Open from prior sessions (still pending)
- Merge `fix/ghs-db-persistence-pipeline` (was pending Apr 30)
- Items from `project_ghs_session_apr24.md`: model selector in Ad Editor → model name chips → tab reorganization
- Finance Phase 2

---

# GHS Handoff — 2026-04-30 (critical pipeline fixes — branch: fix/ghs-pipeline-critical)

## Completed this session
1. **TASK 1 — Commercial narration (BUG-12 follow-up)**: safeJson on enhance-narration; AI Order section with phone/WhatsApp/intro/outro fields; reads slide imageUrls, builds contact-info narration
2. **TASK 2 — Movie export audio**: assembleMovie() payload now includes narrationList, characterVoices, musicUrl, sfx. Added sceneNarrationAudioUrls state populated by generateSceneNarration()
3. **TASK 3 — ElevenLabs**: confirmed working — key in .env.local, TTS route already has explicit error surfacing. Fixed music-video-planner broken assembly path
4. **TASK 4 — Music video gaps**: assembleMusicVideo() delegated to assembleMovie(); safeJson added; sfx included
5. **TASK 5 — Gen 3 variations**: both hybrid-planner and children-planner have Gen 3 button per scene card; variations function generates 3 images with different seeds; thumbnail strip shown for user to pick active

## Commits on this branch
- `fix(commercial): safeJson guards + narration AI order + intro/outro contact fields`
- `fix(movie-assembly): include narration/voice/SFX in assemble payload`
- `fix(elevenlabs): proper error surfacing + API key validation`
- `feat(scene-board): multi-image variations (3 per scene, user picks)`

## Next exact steps
1. Merge fix/ghs-pipeline-critical to main
2. Browser-verify commercial AI Order, movie export with audio, music-video assembly, Gen 3 buttons
3. Continue: merge fix/ghs-db-persistence-pipeline (still pending from previous session)

---

# GHS Handoff — 2026-04-30 (DB persistence + tab order + supervisor bar)

## Branch: fix/ghs-db-persistence-pipeline

### Completed this session
1. Tab order corrected — all 4 planners now follow binding: Story→Characters→Sound→Scene Board→Assembly→Overview
2. DB persistence added to children-planner + movie-planner (BUG-15 pattern with isRestoringRef)
3. music-video-planner scene-plan payload fixed (storyText vs expandedStory)
4. SupervisorStatusBar component created + wired into hybrid/children/movie planners
5. Build: clean (0 errors)

### In progress / blockers
- Branches S1–S16 are still unmutated on their feature branches (merger decision pending — see project_ghs_planner_corrections_apr30.md)
- This branch (fix/ghs-db-persistence-pipeline) needs to be merged

### Next exact steps
1. Merge fix/ghs-db-persistence-pipeline to main
2. Continue with slice SA (merge S1–S12 to main + bear fix verification)
3. Then slices SB–SE per project_ghs_planner_corrections_apr30.md

---

# GHS Handoff — 2026-04-30 (S16 BUG-01 — MERGED TO MAIN)

## All 17 branches merged. S1–S16 complete.

### S16 files (BUG-01: AI Coordinator)
- `src/modules/coordinator/index.ts` — Zustand coordinator store with persist, canAdvanceTo guard
- `app/components/CoordinatorProvider.tsx` — React wrapper + useCoordinator hook + pathname detection
- `app/layout.tsx` — CoordinatorProvider added to layout tree
- `app/api/hybrid/coordinator-status/route.ts` — GET endpoint for stage/section status + supervisor advice
- `app/dashboard/hybrid-planner/page.tsx` — coordinator guard in assembleScenes (additive, non-breaking)

### Next exact steps
1. Run `npx next build` on merged main to verify zero compilation errors
2. Run Playwright full-coverage suite
3. Push to main and browser-verify live

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
