# GioHomeStudio — Changelog

## 2026-04-30 — S4: Tab order + CharacterPicker + design style flow
**What:** Fixed Overview tab position (was first, now last) in children-planner. Default active tab changed to "design". Added inline CharacterPicker toggle to movie-planner Characters tab. Added ?returnTo= param to all character-voices links. character-voices page now reads returnTo and shows return banner + button. Wired visualStyle into scene-plan storyText in children-planner. Wired style state into story-expand and scene-plan in movie-planner.
**Why:** Henry complained Overview was first — confusing UX. Users navigated to character page with no way back. Design style choices were UI-only, never flowed into AI generation.
**Impact:** Tab navigation corrected across children and movie planners. Character creation flows are closed-loop. Design style context now reaches story expansion and scene planning APIs.
**Risk:** Low — tab reorder is cosmetic, CharacterPicker is additive (existing modal kept), style appended to storyText (extra context, servers ignore unknown fields).
**Branch:** fix/ghs-bug-04b-tab-order-character-picker
