# GioHomeStudio — CHANGELOG

## 2026-04-30 — S4c: AI Cast from Story + Children Scene Board + Pre-assembly Preflight
**What:** (A) Movie-planner Cast tab — AI Cast Generator is now primary action; reads story text via /api/hybrid/character-extract, auto-adds to cast. "Import saved" demoted to secondary link. (B) Children-planner — new "Scene Board" tab added; per-scene cards with editable description, character assignment inline, AI image generation per scene via /api/hybrid/scene-image. generateScenesFromStory() calls scene-plan API. (C) Pre-assembly preflight added to Assembly tab (movie-planner) and Final tab (children-planner) — runs /api/hybrid/pre-flight, shows green/yellow/red checklist.
**Why:** Henry confirmed Cast tab was wrong (Import Existing only shown). Children Scene Board was missing. Both planners lacked any pre-assembly quality gate.
**Impact:** Movie cast generation now works AI-first. Children planner has full hybrid-style scene board. Both planners have preflight review before assemble fires.
**Risk:** Low — all additive. No existing function removed. generateCastFromStory merges to existing savedCharacters (deduplicated). Pre-flight is optional (user can still click assemble without running it).
**Branch:** fix/ghs-s4c-sceneboard-cast-preflight

## 2026-04-30 — S4: Tab order + CharacterPicker + design style flow
**What:** Fixed Overview tab position (was first, now last) in children-planner. Default active tab changed to "design". Added inline CharacterPicker toggle to movie-planner Characters tab. Added ?returnTo= param to all character-voices links. character-voices page now reads returnTo and shows return banner + button. Wired visualStyle into scene-plan storyText in children-planner. Wired style state into story-expand and scene-plan in movie-planner.
**Why:** Henry complained Overview was first — confusing UX. Users navigated to character page with no way back. Design style choices were UI-only, never flowed into AI generation.
**Impact:** Tab navigation corrected across children and movie planners. Character creation flows are closed-loop. Design style context now reaches story expansion and scene planning APIs.
**Risk:** Low — tab reorder is cosmetic, CharacterPicker is additive (existing modal kept), style appended to storyText (extra context, servers ignore unknown fields).
**Branch:** fix/ghs-bug-04b-tab-order-character-picker

## 2026-04-30 S2

### fix(character-system): eliminate bear collapse + attach reference images by characterId (BUG-02)
- **What:** (A) New `attachCharacterReferences(prompt, characterIds[])` in `src/lib/character-resolver.ts` — explicit ID lookup, no token embedding needed. (B) `app/api/generation/image/route.ts` accepts `characterIds[]`, calls attachCharacterReferences, returns `referenceImages` in response. (C) `app/api/hybrid/character-build/route.ts` — `isHumanRole()` helper, `humanGuard` in user prompt, ABSOLUTE human enforcement when `role=human` or `childSafe=true`, system prompt guard against bear/animal anatomy. (D) `app/api/hybrid/story-expand/route.ts` — removed "The Bear" anti-example, added global human-default rule to system prompt.
- **Why:** Characters rendering as bears across all planners. Root cause: resolver token-only path missed explicit character lookups; species enum allowed bear for human roles; story-expand primed model toward animal output.
- **Impact:** Human characters now generate as humans. Reference images attached via explicit IDs. All callers benefit without prompt token changes.
- **Risk:** Low — resolver backward compatible; existing token flow unchanged; new characterIds field is optional

## 2026-04-30 S1

### fix: children-planner character DB persistence (BUG-03)
- **What:** Added POST to `/api/character-voices` at `extractChildCharacters` and `expandStory` setSavedChars call sites
- **Why:** Characters were stored in React state only — lost on page reload or across sessions
- **Impact:** Characters now persist to DB immediately on creation. CharacterPicker reads from DB. Mount load already existed.
- **Risk:** Low — 409 (duplicate) handled gracefully; local state retained on POST failure

### fix: ElevenLabs TTS silent catch → surfaced error (prep BUG-09)
- **What:** Replaced empty `catch { /* ElevenLabs failed */ }` with `console.error` + structured error message. Added `!res.ok` check that reads error body from ElevenLabs API response.
- **Why:** Silent swallow hid all ElevenLabs failures — impossible to debug TTS fallback chain
- **Impact:** Errors now visible in server logs. Fallback chain preserved (error logged, then falls through to SAPI/FFmpeg tier).
- **Risk:** None — fallback chain unchanged, error now observable

### fix: karaoke stderr truncation removed, stdout JSON non-greedy (prep BUG-08)
- **What:** Removed `.slice(0, 500)` from stderr in error message. Changed stdout JSON regex from `/\{[\s\S]*\}/` (greedy) to `/\{[\s\S]*?\}\s*$/m` (non-greedy, last match).
- **Why:** Truncated stderr hid root cause of Python analysis failures. Greedy regex matched first `{` to last `}` which could include debug output before the real JSON result.
- **Impact:** Full stderr in error messages. Correct JSON extracted even when Python prints debug lines before the result object.
- **Risk:** Low — regex change is conservative; anchored to end of output

### docs: added MUBERT_PAT to .env.example
- **What:** Added `MUBERT_PAT=your_mubert_pat_here` with comment to `.env.example`
- **Why:** Mubert is required for instrumental tracks >47s. Key was undocumented.
- **Impact:** Developers know to configure it. No runtime change.
- **Risk:** None
