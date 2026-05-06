# GHS HANDOFF — 2026-05-05 Session (Pipeline Recovery)

## Branch: fix/ghs-pipeline-recovery-may05
## Last commit: 2838df1 — Phase 1-2 pipeline recovery
## Build: PASSING (next build exit 0, tsc exit 0)

---

## What was completed this session

### Phase 1 — Stop The Bleeding (DONE, committed 2838df1)
- **1.1 Style drop fix** — STYLE_PRESETS extracted to `src/lib/style-presets.ts`. `scene-video/route.ts` now injects style prefix. Closes "selected 3D, got real human" leak.
- **1.2/1.3 Face-lock model** — `fal_flux_pulid` added to model-registry. `image-provider.ts` routes to PuLID when `useIdentityLock=true`. `scene-image/route.ts` detects photo-import characters and passes identity lock. `character-voices/route.ts` persists `referenceImages` with photo-import label.
- **1.4 Tab order fixed** — WORKSHOP_TABS + FLOW array now identical and straight: Design→Story→Characters→Scene Board→Sound→Screenplay→Assembly→Overview. Off-by-one FLOW bug killed.
- **1.5 Per-scene controls** — AI Generate SFX button, Continuous Motion toggle + duration picker (5/10/15/20/30s), Generate Scene Music button — all on each Scene Board card. `makeSceneVideo` passes `projectStyle` to scene-video route.

### Phase 2 — Three Supervisors (DONE, committed 2838df1)
- `app/api/supervisor/visual-consistency/route.ts` — vision check: portrait vs photo, scene vs character
- `app/api/supervisor/sound-consistency/route.ts` — SFX + music mood per scene (Haiku)
- `app/api/supervisor/final/route.ts` — pre-flight + LLM final check before assembly
- `SupervisorStatusBar.tsx` — 3-row specialist panel (Visual/Sound/Final)

### Phase 4 — Auto-SFX from story text (DONE, committed 2838df1)
- `src/lib/sfx/cue-extractor.ts` — 31 keyword entries + Claude Haiku LLM pass
- `src/lib/sfx/auto-fetcher.ts` — Freesound→Pixabay→FAL, CC0/CC-BY only
- `app/api/hybrid/audio-plan/route.ts` — cue-extractor runs before LLM

### Sound tiers (DONE, committed 2838df1)
- `src/lib/ghs-sound-tiers.ts` — GHS Sound / GHS Plus / GHS Pro / GHS Premium
- `music/generate/route.ts` + `music-provider/index.ts` — mapped to GHS tier labels
- `narrate-piper/route.ts` — tier routing wired

---

## In Progress (Sonnet worker running)
- SA-SE architectural corrections + S4c cut-off work — Sonnet worker `add09b47c08b79902` running

---

## What is NOT done yet (next session)

### Phase 1.6 — Assembly path unification
- Hybrid planner calls `/api/video/assemble` (line 2667)
- Should migrate to `/api/assembly/execute` (uses structured AssemblyJSON with ducking)
- Risk: response shape differs. Needs careful testing.
- WAIT for Henry GO in `update/RISKS_AND_DECISIONS.md` before deleting old route.

### Phase 3 — Per-scene continuous motion (Prisma migration)
- Need to add `continuousMotion Json?` to `HybridScene` model in `prisma/schema.prisma:930`
- Run `npx prisma migrate dev` after schema change
- UI state is already added (`sceneContinuousMotion` per-scene), just needs DB persistence

### Phase 5 — Music provider keys
- `KIE_AI_API_KEY` and `MUBERT_PAT` still NOT in `.env`
- Without these, GHS Premium (Suno) and Mubert silently fall back to stock
- Henry needs to add these manually

### Phase 6 — All other planners
- Children planner scene board → hybrid-style per-scene cards (S4c)
- Movie planner Cast tab → AI Build primary (SA-SE agent handling)
- Series / Commercial / Music Video planners — pending Phase 6

### S1-S12 merge to main
- All S1-S12 fixes are NOW IN branch `fix/ghs-pipeline-recovery-may05`
- Need Henry to review and merge branch to main
- After merge: `fix/ghs-free-mode-complete` and all S1-S12 branches can be archived

---

## NEXT EXACT STEPS

1. Wait for SA-SE Sonnet worker to finish → review output → commit if TSC passes
2. Start dev server: `npx next dev`
3. AUT verify: open `localhost:3200/dashboard/hybrid-planner`, check:
   - Tab order: Design→Story→Characters→Scene Board→Sound→Screenplay→Assembly→Overview
   - Upload photo test: Characters tab → import photo → confirm face-lock routes to PuLID
   - Per-scene SFX button visible on each scene card
   - Per-scene Continuous Motion toggle visible
4. Add Prisma migration for `continuousMotion Json?` on HybridScene
5. Get Henry to add `KIE_AI_API_KEY` and `MUBERT_PAT` to `.env`
6. Merge branch to main after Henry review

---

## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma)
## Plan: C:\Users\USER\.claude\plans\ghs-andio-studio-wiggly-castle.md
## Branch: fix/ghs-pipeline-recovery-may05
