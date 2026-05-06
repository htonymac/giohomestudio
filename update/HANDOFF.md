# GHS HANDOFF — 2026-05-05 Session (Pipeline Recovery — Complete)

## Branch: fix/ghs-pipeline-recovery-may05
## Last commit: 31c1fe4 — build fix (Suspense)
## Build: PASSING (next build exit 0, tsc exit 0)
## AUT Verify: PASSED (tabs correct, all 4 sound tiers visible, motion/duration controls present)

---

## Completed This Session (all committed)

### Phase 1 — Stop The Bleeding (commit 2838df1)
- **1.1 Style fix** — `src/lib/style-presets.ts` shared. `scene-video` injects style prefix. "Selected 3D, got real human" fixed.
- **1.2/1.3 Face-lock** — `fal_flux_pulid` in model-registry. `image-provider.ts` routes to PuLID on `useIdentityLock=true`. `scene-image` detects photo-import chars. `character-voices` saves `referenceImages` with photo-import label.
- **1.4 Tab order** — Design→Story→Characters→Scene Board→Sound & SFX→Screenplay→Assembly→Overview. Both WORKSHOP_TABS + FLOW arrays aligned.
- **1.5 Per-scene controls** — AI SFX button, Continuous Motion toggle, Duration picker (5/10/15/20/30s), Scene Music button on each Scene Board card.

### Phase 2 — Three Supervisors (commit 2838df1)
- `app/api/supervisor/visual-consistency/route.ts`
- `app/api/supervisor/sound-consistency/route.ts`
- `app/api/supervisor/final/route.ts`
- `SupervisorStatusBar.tsx` → 3-row panel

### Phase 3 — continuousMotion DB field (commit 10c704b)
- `prisma/schema.prisma` — `continuousMotion Json?` added to HybridScene
- Schema synced via `npx prisma db push`

### Phase 4 — Auto-SFX (commit 2838df1)
- `src/lib/sfx/cue-extractor.ts` — 31 keywords + Haiku LLM pass
- `src/lib/sfx/auto-fetcher.ts` — Freesound→Pixabay→FAL, CC0/CC-BY only
- `app/api/hybrid/audio-plan/route.ts` — cue-extractor runs first

### Sound Tiers (commit 2838df1)
- `src/lib/ghs-sound-tiers.ts` — GHS Sound / GHS Plus / GHS Pro / GHS Premium
- Music provider + narrate-piper + hybrid-planner UI all wired

### SA-SE Architectural Corrections (commit 9a7dba6)
- **SC** — movie-planner: Parse Script button, 4-card sound tier selector, per-cast voice IDs, Generate Per-Line Voices
- **SD** — model selectors already present (no change needed)
- **SE** — hybrid-planner Scene Board: scene description now always-editable `<textarea>` with 500ms debounce auto-save
- **SB** — movie Cast tab AI-primary already done

### TSC + Build Fixes (commit 6269642, 31c1fe4)
- `supervisor/final/route.ts` — inline PreflightResult types, named prisma import
- `image-provider.ts` — double-cast `as unknown as Record<string,unknown>` for FAL params
- `video-editor/page.tsx` — Suspense wrapper around `useSearchParams()` (Next.js 14 requirement)
- Free-mode: scene image lightbox, dev limits 20 img / 10 vid, localhost unlimited

---

## What Is NOT Done Yet

### Phase 1.6 — Assembly path unification
- `page.tsx` still calls `/api/video/assemble`
- Target: `/api/assembly/execute` (structured AssemblyJSON with ducking)
- WAIT for Henry GO in `update/RISKS_AND_DECISIONS.md`

### Phase 5 — Music keys
- `KIE_AI_API_KEY` (Kie.ai Suno) and `MUBERT_PAT` NOT in `.env`
- Henry must add manually — without them GHS Premium/Pro silently fall back

### Phase 6 — All other planners
- Children planner: hybrid-style per-scene cards (S4c cut-off)
- Series / Commercial / Music Video planners
- Bear fix (SA) — `character-build/route.ts` human-guard — NOT committed yet

### Bear Fix (SA) — NOT DONE
- `app/api/hybrid/character-build/route.ts` — isHumanRole() helper + humanGuard not yet applied
- Check commit 2838df1 — bear fix was in `story-expand` but `character-build` human guard still missing
- Symptom: characters may still render as bears when role=human is not enforced in character-build

### Merge to main
- Branch `fix/ghs-pipeline-recovery-may05` needs Henry review then merge
- After merge: archive all S1-S12 + free-mode branches

---

## NEXT EXACT STEPS

1. Apply bear fix to `character-build/route.ts` (SA — not done per SA-SE report)
2. Children planner hybrid scene board (S4c cut-off)
3. Get Henry: `KIE_AI_API_KEY` + `MUBERT_PAT` → add to `.env`
4. Get Henry GO on Phase 1.6 assembly path unification in `RISKS_AND_DECISIONS.md`
5. Henry review → merge branch to main

---

## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma)
## Plan: C:\Users\USER\.claude\plans\ghs-andio-studio-wiggly-castle.md
## Branch: fix/ghs-pipeline-recovery-may05
## Commits this session: 2838df1 → 10c704b → 9a7dba6 → 6269642 → 31c1fe4
