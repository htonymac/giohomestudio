# GHS HANDOFF — 2026-05-06 Session 2 (Pipeline Recovery + Audio Fixes)

## Branch: fix/ghs-pipeline-recovery-may05
## Main merge: b74c0dd (merged earlier today — 41 files, clean)
## Latest commit on branch: 77e8cbc
## Build: TSC clean (exit 0)
## Dev server: localhost:3200 (running, PID 24440)
## DB: giohomestudio_db (Prisma, schema current)

---

## WHAT WAS DONE THIS SESSION (all committed)

### 1 — Branch merged to main (b74c0dd)
All prior work from fix/ghs-pipeline-recovery-may05 merged to main. No conflicts. TSC clean on main after merge. Branch kept alive for ongoing work.

### 2 — Auto SFX per-scene progress indicator (0ee4d60)
- `autoSfxProgress` state added to hybrid-planner
- Progress bar + scene ID shown while Auto SFX runs per scene
- Scene cards now show audio player with AUTO SFX label after run completes

### 3 — Critical pipeline bug: photo-import → PuLID was broken (5edfca4)
**Root cause:** Session-only characters (not yet saved to DB) had `referenceImages: null`. Scene-image route never detected them as photo-import → PuLID was silently skipped, real face not preserved.
**Fix:** hybrid-planner now passes `isPhotoImport: true` flag in character overrides → scene-image route reads from overrides first.
File: `app/dashboard/hybrid-planner/page.tsx` L1487, L1581 + `app/api/hybrid/scene-image/route.ts` L106

### 4 — Children planner hybrid scene board (e64cba0)
`app/dashboard/children-planner/page.tsx` rebuilt with full per-scene cards:
- Editable scene title (500ms debounce) + scene description
- Scene type badge (Video-led / Image-led)
- Per-scene: AI SFX, Scene Music, Continuous Motion toggle, duration picker (5/10/15/20/30s)
- Make Video, Preview lightbox
- Character picker (savedChars + full registry, deduped)
- Soft archive/restore (not permanent delete)

### 5 — SA-SE architectural corrections applied to ALL planners (43c3a45, 3c21d78, 1edee2d)
Hybrid + Movie: already done in prior session.
Series, Commercial, Music Video: done this session.
All planners now have:
- **SD** Tab order: Design → Story → Characters → Sound & SFX → Scene Board → Assembly → Overview
- **SB** Characters tab: hybrid-style inline registry (Build with AI primary, import saved secondary)
- **SC** Sound tab: Parse Script → Voice Layers → Character Voices → 4-tile Sound Tier → Music → SFX
- **SE** Scene inline edit: always-visible textarea with 500ms debounce

### 6 — Per-character portrait model selector — all planners (43c3a45, 77c41e5)
Each character card now has a compact dropdown:
```
Model  [Flux Free ($0.0004) — drafts  ▼]
```
Options: Ideogram Free ($0) / Flux Free ($0.0004) / Flux Schnell ($0.003) / Pruna ($0.005) / Ideogram v3 ($0.02) / Flux Dev ($0.025) / Flux Pro ($0.05) / Face Lock PuLID
- Default: Flux Free (segmind_flux)
- Photo-import characters: auto-defaults to Face Lock (PuLID)
- Applied to: Hybrid, Movie, Children, Series, Commercial planners
- Music Video planner: no portrait UI wired — skipped

State: `charPortraitModel: Record<characterId, modelId>`
Model resolves: overrideArg → per-char selection → auto PuLID for photo-import → backend default

### 7 — Age field fix in Close Builder (56bd726)
**Problem:** "Age / Posture" was one field — model got "young and energetic" not "8 years old".
**Fix:** Split into two separate fields:
- **Age (years) ★** — numeric input → stored as `"8 years old"` in `char.ageRange`
- **Posture / Energy** — separate text field for stance/energy
`buildVisualDescription()` now puts ageRange FIRST (models weight early tokens highest).
Portrait prompt now starts: `"8-year-old child, CHILD NOT ADULT, young face, child body proportions, age 8, ..."`
Negative prompt blocks adult features for children: `"adult, mature face, grown up, aged, 20 years old..."`
File: `app/dashboard/hybrid-planner/page.tsx` L3080 (buildVisualDescription) + L6242 (builder UI)

### 8 — Scene image model selector updated (a49248b, b83d41c)
Added to scene image picker (design unchanged, Nano Banana + all others kept):
- Ideogram Free ($0.00) — added at top
- Flux Free ($0.0004) — added

Full list now: Ideogram Free → Flux Free → Pruna → Flux Schnell → Flux Dev → Ideogram v3 Turbo → Seedream → Nano Banana 2 → Flux Pro → Ideogram v3 Quality → Recraft v3 → Flux Pro Ultra

### 9 — Audio pipeline fixes: narration + music + SFX (46a80e3, 77e8cbc)
**Narration (GHS Plus was broken):**
- Root cause: GHS Plus set `narratorVoice = "karaoke"` → browser speech only, no audio file, assembly got nothing
- Fix (line 6622): GHS Sound → Piper | GHS Plus → Piper | GHS Pro → fal-narrator | GHS Premium → kie-suno

**Music (per-scene button was silent-failing):**
- Root cause: button checked `d.musicUrl` but API returns `d.outputUrl` → always undefined → no URL stored
- Fix: reads `d.outputUrl || d.musicUrl || d.url`, stores in `scene.audioPlan.musicUrl`, shows error if failed
- Added `musicUrl?: string` to AudioPlan interface (line 94)

**SFX (Generate button appeared disabled):**
- Fix: button no longer disabled — shows error "Type a sound description first" if field empty
- Quick prompt chips already available (door creaking, thunder, fire etc.)

---

## WHAT IS NOT DONE

| # | Item | Notes |
|---|---|---|
| 1 | `KIE_AI_API_KEY` + `MUBERT_PAT` in `.env` | GHS Premium music silently falls back to stock. Henry must add manually. |
| 2 | Merge latest branch commits to main | b74c0dd merged earlier. Commits 0ee4d60 → 77e8cbc not yet in main. Merge when ready. |
| 3 | Music Video planner portrait model selector | No portrait generation UI exists — skipped. |
| 4 | AUT verify | Server restart + browser test pending. Buttons added need headed Playwright run. |
| 5 | Series / Commercial: full assembly path | SA-SE done. Assembly pipeline wiring not verified end-to-end for these planners. |

---

## KEY FILE MAP (most touched this session)

| File | What changed |
|---|---|
| `app/dashboard/hybrid-planner/page.tsx` | Age field split, model selector, audio fixes, SFX progress, PuLID fix |
| `app/dashboard/children-planner/page.tsx` | Full hybrid scene board added |
| `app/dashboard/series-wizard/page.tsx` | SA-SE + model selector |
| `app/dashboard/commercial-planner/page.tsx` | SA-SE + model selector |
| `app/dashboard/music-video-planner/page.tsx` | SA-SE (Sound tab renamed, char tab rebuilt) |
| `app/dashboard/movie-planner/page.tsx` | Model selector + default updated |
| `app/api/hybrid/scene-image/route.ts` | photo-import detection from overrides |
| `src/lib/generation/model-registry.ts` | Source of truth for all models + costs |

---

## IMPORTANT RULES FOR NEXT SESSION

1. **Age field** — Character Close Builder now has a numeric Age input. Always fill it for any character. Image generator reads it as first token in prompt.
2. **Face Lock (PuLID)** — Only works when character has a photo-import tag AND `FAL_KEY` is in `.env`. Auto-selected on photo-import chars.
3. **GHS Plus narration** now uses Piper (free, local). Produces a real .wav file that assembly can use.
4. **Scene music** button now stores URL in `scene.audioPlan.musicUrl`. Assembly reads from there.
5. **SFX generate** needs a text description typed first OR click a quick prompt chip.
6. **Model dropdown default** = Flux Free ($0.0004) for all character portraits. Change per character as needed.
7. **Do NOT delete** `/api/video/assemble` old route — kept per doctrine.
8. **Branch**: fix/ghs-pipeline-recovery-may05 still active. Merge to main after next batch.

---

## NEXT EXACT STEPS

1. Add `KIE_AI_API_KEY` + `MUBERT_PAT` to `.env` (Henry only — these are his API keys)
2. AUT verify — restart server, open localhost:3200, test: character portrait generation, Generate Narration Audio, scene Music button, SFX generate
3. Merge branch to main (commits 0ee4d60 → 77e8cbc)
4. Test full Hybrid Planner pipeline end-to-end: Story → Characters → Sound → Scene Board → Assembly

---

## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma)
## Branch: fix/ghs-pipeline-recovery-may05
## Main at: b74c0dd
## Branch tip: 77e8cbc
