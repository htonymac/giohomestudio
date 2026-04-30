# GioHomeStudio — Changelog

## 2026-04-30 — S5: Voice Provider Tiers + ElevenLabs Error Surfacing (BUG-09)
**What:** (A) `/api/tts/route.ts` — added `provider` field routing, explicit ElevenLabs error surfacing (was silent catch), FAL Narrator tier via `fal-ai/kokoro/american-english`, karaoke short-circuit. (B) New `/api/tts/fal-narrator/route.ts` dedicated route. (C) Hybrid-planner Audio tab — permanent narration provider card (`data-testid="narration-provider-card"`) with 4 provider buttons (`data-provider` attrs), `voiceLayers` state (VoiceLayer interface, add/update/remove helpers). (D) Children-planner STYLE & VOICE tab — `narrationProvider` state + 4-button radio. (E) Movie-planner Audio tab — `narrationProvider` state + 4-button radio.
**Why:** BUG-09: ElevenLabs errors were silently swallowed (empty catch L88). No FAL Narrator tier existed. No provider selector UI in any planner. No voiceLayers multi-part voice state.
**Impact:** ElevenLabs errors now surface to caller. FAL Narrator is selectable as mid-tier TTS. All 3 planners have working narration provider selector. voiceLayers up to 4 layers supported.
**Risk:** Low — additive. TTS route retains legacy `engine` field for backward compat. FAL Narrator gated on `FAL_KEY` env var presence.
**Branch:** fix/ghs-bug-09-voice-tiers
**Playwright:** 17/17 PASS, 90s, screenshots C:/tmp/bug-09-*.png

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
