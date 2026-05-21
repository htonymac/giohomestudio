# PLAN — Fix Scene Board Showing Portrait Compositions Instead of Real Scenes

**Saved:** 2026-05-21 (Henry approved save, no code yet)
**Status:** PLAN ONLY — awaiting GO trigger
**Related plan:** `update/PLANS/hybrid_style_story_chid_movie21052026.md`

---

## Symptoms (from Henry's screenshot, 2026-05-21)

Henry's "Untitled Hybrid Project" Scene Board shows 7 scenes. Visible behavior:

- **SC01 "Meet the Inventors"** — 3 people standing in a row, plain studio bg, posing. Looks like a character reference sheet. Scene description: "In a vibrant Brooklyn neighborhood..." — NOT visible in image.
- **SC02 "Planning the Flying Machine"** — same row layout. Scene says "cluttered garage with blueprint" — NOT visible.
- **SC04 "Renewed Determination"** — same row layout. Scene says "Inside the garage at night" — NOT visible.
- **SC03 "Community Doubts"** — looks like a real scene with crowd background, action moment. Uses `flux_schnell`, NOT `fal_flux_pulid`.

**Pattern:** every PuLID-locked scene = portrait composition. Every non-PuLID scene = proper scene composition.

Henry's words: "charact image ==== scene board" / "scene board rules 100% ignored - no scenario and more".

---

## Root Cause Hypothesis

PuLID at `id_weight: 0.75` (already lowered from default 1.0) is still locking the **entire portrait composition**, not just the face. It's carrying through:

- Composition (standing in a row, plain background)
- Pose (neutral, hands at sides, no action)
- Crop/framing (full-body studio shot)
- Background style (blank/gray, no environment)

Scene prompts (location, action, mood, time of day) are getting overridden because:

1. PuLID's identity signal is too strong even at 0.75
2. Scene prompts put CHARACTER FIRST → FLUX weights early tokens heavily → portrait language dominates
3. The reference image we send is a FULL-BODY portrait, so PuLID matches the whole composition, not just face

---

## Fix Plan — Cheapest First

### F1 — Lower `id_weight: 0.75 → 0.55` (5 min, LOW risk)
File: `src/lib/generation/gateways/fal.ts`
Change one number. Trades some face consistency for scene composition freedom.

### F2 — Restructure scene prompt token order (15 min, LOW risk)
File: `app/api/hybrid/scene-image/route.ts`

Current token order:
`[Era Lock] → [Style] → [Character identity] → [Scene description] → [Action] → [Settings] → [Quality]`

New order:
`[Era Lock] → [Style] → [LOCATION] → [TIME OF DAY + MOOD] → [SCENE ACTION] → [Character identity] → [Quality]`

FLUX weights early tokens more. Putting location/action FIRST forces the model to compose the SETTING before applying identity. Era stays first (must — era is the absolute world rule).

### F3 — Add anti-portrait directives (10 min, LOW risk)
File: `app/api/hybrid/scene-image/route.ts`

**Positive (add to scene prompt):**
> "cinematic scene shot, environmental composition, background fully visible, wide shot showing setting, action moment, characters integrated into location, NOT a portrait, NOT a character lineup"

**Negative (add to negative prompt):**
> "portrait style, character reference sheet, character lineup, characters standing in a row, plain studio background, blank backdrop, photo studio lighting, neutral pose, posed standing, character sheet"

Conditionalize on style: only add for `realistic` / `nollywood` / `3d-cinematic` styles. Don't fight `storybook` or `cartoon` styles where simpler compositions are OK.

### F4 — Drop PuLID for multi-character scenes (30 min, MEDIUM risk)
File: `app/api/hybrid/scene-image/route.ts` (logic) + `src/lib/generation/selectors/image-provider.ts` (routing)

PuLID only takes ONE `face_image_url` anyway. For scenes with 2+ characters it locks ONE face and the model invents the others — AND carries the portrait composition.

Logic: if `resolvedCharacters.length > 1`, set `useIdentityLock: false`, route to default Flux Schnell/Pro. Use rich text character descriptions in prompt instead. Accept face drift on group shots in exchange for proper scene composition.

Keep PuLID for single-character close-up scenes (where it works).

### F5 — Tight face crop before FAL upload (45 min, MEDIUM risk)
File: `src/lib/generation/selectors/image-provider.ts` (`resolvePublicPortraitUrl`)

Currently uploads full-body portrait to FAL. Pre-process: crop to head + shoulders only (use Sharp or face-detection). PuLID only needs the face. Removes "portrait pose" inheritance.

Risk: face detection failure → fallback to full image.

### F6 — Last resort: post-process face swap (4-6h, HIGH effort)
Generate scene WITHOUT PuLID for proper composition. Run a separate face-swap model after (e.g. InsightFace, ReActor) to graft each character's face onto the result. Architectural change — defer unless F1-F5 all fail.

---

## Recommended Execution Order

1. **F1 + F2 + F3 together** (one commit, ~30 min) — pure config + prompt change. Cheapest. Try first.
2. If scenes still look like portraits after restart+regen: **F4** (multi-char → drop PuLID).
3. If F4 isn't enough: **F5** (face crop).
4. F6 only if all else fails.

---

## Verification Plan

After each fix, regen SC01, SC02, SC04 in Henry's project:

| Scene | Expected after fix |
|---|---|
| SC01 Meet the Inventors | Brooklyn neighborhood visible, characters integrated, no row-lineup |
| SC02 Planning the Flying Machine | Cluttered garage interior, blueprint visible on table |
| SC03 Community Doubts | Still works (didn't use PuLID before) |
| SC04 Renewed Determination | Garage at night, lighting reflects "intense focus" mood |

Face consistency target: ~70-80% likeness across scenes (vs 95% currently). Trade-off accepted.

Single-character close-up scenes (PuLID strength shines there): must still work.

---

## Don't Break

- Character portraits themselves (don't touch portrait gen)
- Single-character close-up scenes (PuLID is doing its job there)
- Era/Culture Lock (commit d18f767) — Era must remain FIRST token
- All recent session fixes:
  - face-lock + CDN upload (2f6647e → d53a2f3)
  - ethnicity flow (829ea62 → 64df85d → 863b493 → 2a5701e)
  - Scene Board ↔ Character tab linking (8f5e3f0)
  - Clothing fixes (08255ba)
  - Subtitle Windows fontfile (221c608)
  - Children-planner story length (d4ba8a3)
  - Scene-prompt-builder cast cleanup (96db101)
- The Movie/Children scene-editor port plan (separate, scheduled)

---

## Error Fix Plan

| If | Then |
|---|---|
| F1 over-corrects (faces drift too much) | Raise `id_weight` back to 0.65 (middle ground) |
| F2 breaks era/culture lock | Era stays in position 1; reorder only positions 2-6 |
| F3 negatives leak into cartoon/storybook styles | Conditionalize on `styleId === "realistic" \|\| "nollywood" \|\| "3d-cinematic"` |
| F4 multi-char detection wrong (counts >1 when scene has 1 char + crowd) | Fall back to PuLID if non-PuLID first try produces wrong-looking result |
| F5 face crop fails / face detector errors | Catch + fall back to full-image upload (current behavior) |
| Any TS error | Revert and ask before continuing |
| Hybrid scene editor regresses | Roll back ONLY the offending file, never roll back unrelated commits |

---

## Approval Log

- **2026-05-21**: Henry approved saving plan. No code yet. Awaiting GO trigger.

---

## Next Triggers

- `go F1 F2 F3` → cheapest first pass (lower id_weight + reorder prompt + anti-portrait directives)
- `go F4` → drop PuLID for multi-character scenes
- `go F5` → tight face crop
- `go all F1-F5` → run all sequentially with verification gates
- `investigate substitution` → separate Phase D bug from prior plan
- `go phase A` / `go phase B` → unrelated Movie/Children scene-editor port (separate plan file)
