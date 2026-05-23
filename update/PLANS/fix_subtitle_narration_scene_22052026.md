# PLAN — Fix subtitle, narration length, scene-board, and toolbar placement

**Date:** 2026-05-22
**Status:** PLAN ONLY — awaiting GO trigger
**Trigger to start:** `go fix` (run all) OR `go fix N` (just one item)

---

## What Henry reported (verbatim, summarized)

1. Children planner narration still SHORT despite picker and prompts
2. Hybrid planner subtitles don't show / don't move with timing
3. Scene Board shows character portrait images, not actual scene composition
4. Hybrid per-scene AI chat slow
5. Audio-plan generates too-short narration
6. **I put the new scene-edit buttons in the WRONG PLACE in Children planner — they are in Scene Board but should be on Script & Story Plan tab (like Hybrid has them on Story → Scene Breakdown)**
7. QC Check and Context Check buttons should NEVER be on Scene Board

---

## CONFIRMED via code inspection

| Issue | Where in code | What's wrong |
|---|---|---|
| Subtitle cap | `app/api/assembly/execute/route.ts:496` | `const capped = subEntries.slice(0, 60);` — drops subtitles after entry #60. Long narration = no late subtitles. |
| Audio-plan narration short | `app/api/hybrid/audio-plan/route.ts:262` | `maxTokens: 120` per scene narration. Hardcoded short. |
| Scene-images URL format | `app/api/hybrid/scene-images/route.ts:47` | Returns `/storage/scenes/...` URLs, but most app expects `/api/media/...` — broken previews. |
| Children toolbar wrong tab | `app/dashboard/children-planner/page.tsx:6185` | Scene-edit buttons (Funny/Playful/QC etc) sit inside Scene Board card. Should be on "Script & Story Plan" tab (`activeTab === "script"` at line 5693). |
| Children length still short | `app/api/hybrid/story-expand/route.ts` | LLM ignores target word count when it decides "story is complete". No post-validation. |
| Subtitle settings not persisted | `app/dashboard/hybrid-planner/page.tsx` | `subtitleConfig` not in save effect; `musicVolume` missing from deps. |
| Scene = character portrait | `app/api/hybrid/scene-image/route.ts` + `image-provider.ts` | PuLID still dominates composition despite F1-F4. |
| Chat slow | `app/api/hybrid/scene-chat/route.ts` | No per-provider timeout. |

---

## FIX PLAN — Numbered, one phase per commit, easy rollback

### FIX 1 — Move children toolbar from Scene Board → Script & Story Plan tab
- **File:** `app/dashboard/children-planner/page.tsx`
- **Move buttons** from line 6185 (Scene Board card) to inside Script & Story Plan tab (around line 5728 where script segments are listed)
- **Per-segment buttons** instead of per-scene:
  - Polish · ✨ · Funny 😄 · Playful 🎈 · Adventure 🗡 · Emotion 💗 · Add Action ➕
  - **REMOVE QC Check + Context Check from per-scene/per-segment** — these are story-level operations, attach them to the parse/regen flow at the TOP of the tab as `Run QC on whole script` and `Fix Context` buttons
- **Word Check** (🛡) — move to TOP of Script tab as "Scan script for adult words"
- Risk: low — pure UI relocation, no logic changes

### FIX 2 — Subtitle cap: 60 → unlimited via SRT file
- **File:** `app/api/assembly/execute/route.ts:496`
- Change from `drawtext` chain (60-cap) to **SRT file + `subtitles=` filter**
- Generate `.srt` file from `narrationWithText` entries (no cap), pass via `-vf subtitles=path.srt`
- Use ASS file format if subtitle styling needed beyond plain SRT
- **Risk: medium** — requires libass / libavfilter subtitles support. If FFmpeg lacks libass, fall back to drawtext but bump cap to 200 (sufficient for ~40min videos)
- Acceptance: full 40-min children's story shows subtitles throughout, not just first portion

### FIX 3 — Audio-plan narration length proportional to scene
- **File:** `app/api/hybrid/audio-plan/route.ts:262`
- Replace fixed `maxTokens: 120` with scene-length-proportional value:
  - Short scene (<10s) → 120 tokens
  - Medium scene (10-30s) → 300 tokens
  - Long scene (30-60s) → 600 tokens
  - Very long scene (60s+) → 1000 tokens
- Update prompt from "1-2 sentences" to "approximately N sentences matching X-second scene duration"
- PRESERVE existing `scene.narrationScript` if already longer than the new generation
- **Risk: low** — additive change

### FIX 4 — Children length validation + retry
- **File:** `app/api/hybrid/story-expand/route.ts` (after LLM returns)
- After parse: count words in `fullScript`
- If `words < targetWordCount × 0.6` (i.e. less than 60% of target), do ONE retry with stricter prompt: "Previous output was X words; you MUST produce {targetWordCount} words. Continue from where you stopped OR rewrite longer."
- If still short after retry, return with `warning` field surfaced to client
- **Risk: medium** — extra LLM call cost on shortfall (~rare). Add 10s buffer to existing timeout.

### FIX 5 — Persist subtitleConfig + fix musicVolume deps
- **File:** `app/dashboard/hybrid-planner/page.tsx`
- Add `subtitleConfig`, `narratorAudioDuration`, `sceneModeOverrides`, `sceneStyles` to:
  - Save effect payload (the object sent to `/api/hybrid/saved-state`)
  - Load effect (read from response)
  - Save effect dependency list (so React fires save on change)
- Add `musicVolume` to dependency list (currently saved but not in deps → stale save)
- **Risk: low** — pure additive

### FIX 6 — Scene-images URL normalization to /api/media/
- **File:** `app/api/hybrid/scene-images/route.ts:47`
- Return URLs as `/api/media/scenes/...` not `/storage/scenes/...`
- Keep accepting BOTH `/storage/` and `/api/media/` in DELETE handler for backward compat
- Audit `makeSceneImage` response handling to ensure URL is normalized before being stored in `sceneImages` state
- **Risk: low** — string replacement + accept both on input

### FIX 7 — Scene composition: stronger anti-portrait + verify PuLID drop
- **File:** `app/api/hybrid/scene-image/route.ts`
- Verify F4 (PuLID drop for multi-char) is actually firing — add explicit log of when `useIdentityLock = false`
- Increase positive scene-composition prompt weight: move location/action even earlier in token order
- For single-character scenes still using PuLID: **also drop the reference image position** if scene has rich location text — let the model compose freely
- Add `--no-portrait-style` to anti-portrait negative
- **Risk: medium** — could weaken face consistency further. Acceptance: scene shows environment (Brooklyn neighborhood, etc.), characters integrated in scene not posed in row.

### FIX 8 — Scene chat per-provider timeout
- **File:** `app/api/hybrid/scene-chat/route.ts`
- Add 8-second timeout per provider before falling through
- Surface explicit provider error in response when ALL fail (currently silent)
- Use latest chat history when user message is added (use functional setState)
- **Risk: low** — additive

### FIX 9 — STOP "POSING FOR A PICTURE" — actors must ACT
Henry's screenshots show 3-4 actors standing in correct workshop setting but **POSED for a model photo**, not acting in the scene. The bug is two-layered:

a) **Scene description verb pollution.** Story-expand and scene-plan write scenes like *"Malik stands with a warm smile next to Andre"*. The verb "stands" is a POSE not an ACTION. Even with my action-extractor injecting "active scene moment" directive, the literal "stands" in the description dominates the model.

b) **The default fallback in `extractSceneAction()`** says "characters in active scene moment" but doesn't EXPLICITLY block portrait/lineup composition.

**Fix:**
1. **In `src/lib/scene/action-extractor.ts`** — strengthen default fallback:
   - Add: "characters MID-ACTION, captured in motion or mid-gesture, NOT standing still, NOT posing for camera, NOT facing camera in a row, candid documentary-style framing, in the middle of doing something"

2. **In `app/api/hybrid/scene-image/route.ts`** — strip pose verbs from scene text BEFORE building prompt:
   - Replace "stands with X smile" → "is mid-action, X smile on face"
   - Replace "stands next to" → "moves alongside"
   - Replace "sits" → "is seated working on"
   - Replace "poses" → "is engaged in"
   - Add to negative: "posed photo, model pose, fashion pose, looking at camera, facing camera, lineup, standing still, portrait composition"

3. **In `app/api/hybrid/story-expand/route.ts`** — instruct LLM to write scenes in ACTION verbs:
   - Update scene schema instruction: *"video_prompt MUST start with what characters are DOING (action verb in present continuous), not what they look like. 'Malik welds a wing onto the machine while Andre holds it steady' NOT 'Malik stands smiling next to Andre'."*

**Risk: medium** — could break extractSceneAction's other branches if regex collides. Test all 12+ keyword branches still match.

**Acceptance:** Beat 7 / Beat 8 should show ONE character mid-action (welding, lifting, drawing) with others ACTIVELY doing something else — NOT a 3-person front-facing lineup.

---

## ORDER OF EXECUTION (cheapest → riskiest)

1. **FIX 1** Toolbar move (UI relocation) — 30 min
2. **FIX 6** URL normalization — 15 min
3. **FIX 3** Audio-plan length proportional — 15 min
4. **FIX 8** Chat timeout — 10 min
5. **FIX 5** Persist subtitleConfig + musicVolume deps — 15 min
6. **FIX 9** Stop posing — pose-verb strip + action-extractor default + story-expand schema — 30 min
7. **FIX 2** Subtitle cap → SRT — 45 min
8. **FIX 4** Children length validation + retry — 30 min
9. **FIX 7** Scene composition further hardening — 30 min

Total: ~3.5 hours focused work.

---

## DON'T TOUCH

- Hybrid planner Story → Scene Breakdown toolbar (Henry confirmed this is CORRECT location)
- All recent session commits (LLM cascade, length enforcement, Phase A+B toolbars on Movie planner, F4, Phase D, word-filter API)
- Era/Culture Lock, audio pipeline rules
- Character extraction Option B
- Auto-AI-Read anti-override

---

## ERROR-FIX PLAN

| If | Then |
|---|---|
| FIX 1 breaks Scene Board | Revert just children-planner.tsx |
| FIX 2 SRT fails (no libass) | Fall back to drawtext with cap raised to 200 |
| FIX 4 retry timeout/cost too high | Cap to 1 retry max; surface warning to user |
| FIX 7 face drift becomes worse | Raise id_weight back to 0.65 |
| Any TS error | Revert and ask before continuing |

---

## ACCEPTANCE CHECKS

After all fixes:
1. ✅ Children planner Scene Board has NO scene-edit buttons (just visual/regen/preview)
2. ✅ Children planner Script & Story Plan tab has Polish/Funny/Playful/Adventure/Emotion/Action buttons per segment
3. ✅ Children planner top has "Scan script for adult words" + "Run QC" + "Context Check"  buttons
4. ✅ Movie planner Story/Script tab has scene-edit buttons (NOT Scene Board)
5. ✅ Hybrid planner unchanged — buttons stay in Story → Scene Breakdown
6. ✅ Children 40-min story produces actual long narration (>2000 words for 40 min target, or retry with warning surfaced)
7. ✅ Hybrid assembled video shows subtitles throughout entire video (not just first 60 entries)
8. ✅ Scene Board thumbnails are actual scene compositions (location visible, characters integrated)
9. ✅ Scene-image URLs all `/api/media/...` form
10. ✅ Saved + reloaded project keeps subtitle settings
11. ✅ TSC clean

---

## Approval log

- **2026-05-22**: Plan written from Henry's frustration log + code inspection. Awaiting `go fix` to start.
