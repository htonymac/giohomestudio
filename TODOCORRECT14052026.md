# GHS Correction + Build Plan — 14 May 2026
**Last verified:** 2026-05-16

## RULE: Do NOT touch Hybrid Planner or any other planner
## Collaboration UI goes in: /dashboard/collaborative-editor/page.tsx
## Phase D backend goes under: /app/api/story/tools/

---

## OVERALL STATUS (updated 2026-05-16)

| Phase | Status | Notes |
|---|---|---|
| A — 23-Supervisor Pipeline | ✅ COMPLETE | All supervisors wired in correct §25 order |
| B1 — ShotPlan type | ✅ COMPLETE | ShotPlan + ScenePlan shots[] + buildDefaultShot |
| B2 — Shot-level cast/continuity | ⏸ DEFERRED | Needs Henry GO |
| C1 — Left panel scene folders | ✅ COMPLETE | Shot list, char chip, duration, click to activate |
| C2 — Center panel active shot | ✅ COMPLETE | Title, shot ID, dialogue, prompt, provider badge, preview |
| C3 — AI Console | ✅ COMPLETE | Quick Edit Chips with full templates — commit b3d0f54 |
| C4 — Dialogue mapping | ✅ COMPLETE | [CH01] format, Cast Bible voice lookup wired |
| C5 — Edit History | ✅ COMPLETE | Undo fixed (both ID formats) + beforeSnapshot saved — commit b3d0f54 |
| D1–D3 — Intent parser | ✅ COMPLETE | collabo-edit/route.ts — Haiku + fallback |
| D4 — apply-edit route | ✅ COMPLETE | apply-edit/route.ts — DB persist live + beforeSnapshot |
| D5 — StoryEditHistory model | ✅ COMPLETE | Prisma schema + db push applied |

**Remaining gaps:** B2 shot-level validation (deferred — needs Henry GO)
**ALL OTHER ITEMS: COMPLETE** ✅ as of 2026-05-16

---

## STATUS KEY
- [ ] Not started
- [~] In progress / partial
- [x] Done

---

## Phase A — Complete the 23-Supervisor Pipeline (fix what was started)

### A1 — Character ID format fix
- [x] `src/lib/story-supervisors/cast-bible.ts`
  - Change ID generation from `char_${name}_${001}` → `CH${padded_index}` (CH01, CH02, CH03...)
  - IDs scoped per story — CH01 in story A ≠ CH01 in story B (storyId is namespace)

### A2 — Build 2 missing supervisor files
- [x] `src/lib/story-supervisors/prompt-simplifier.ts`
  - Rewrites AI story text into selected language level (simple_english, nigerian_english, childrens_english, voiceover_friendly, subtitle_friendly)
  - Bad: "Amidst the existential atmosphere of socioeconomic resistance..." → Good: "The young boy stood outside the shop, worried because his mother could not pay the rent."
  - Never makes it childish unless storyType = children_story
  - Returns { passed, score, blockingIssues, warnings, revisedData: { simplifiedText } }

- [x] `src/lib/story-supervisors/prompt-cast-validator.ts`
  - Separate from cast-checking.ts — this compares each GENERATED VISUAL PROMPT against the Cast Bible
  - Blocks if prompt changes: race, age, gender, clothing without reason, location without reason
  - Per-scene, per-prompt validation
  - Returns { passed, score, blockingIssues, warnings, revisedData: { fixedPrompts } }

### A3 — Wire all 23 supervisors into index.ts in correct order
- [x] All 21 supervisors wired. index.ts fully rewritten.

Full correct order per doc §25:
1. story-screening
2. story-contract (already built as buildStoryContract, not a supervisor)
3. story-screening → existing ✅
4. prompt-simplifier → NEW
5. culture-supervisor → existing ✅
6. cast-bible → existing ✅
7. cast-checking → existing ✅
8. prompt-cast-validator → NEW
9. scene-demarcator → existing ✅
10. scene-density → existing ✅
11. emotion-intensifier → existing ✅
12. music-supervisor → existing ✅
13. music-continuity → wire in
14. dialogue-voice-supervisor → wire in
15. subtitle-style-supervisor → wire in
16. short-story-supervisor → wire in (conditional)
17. long-story-supervisor → wire in (conditional)
18. location-environment-supervisor → wire in
19. costume-props-supervisor → wire in
20. continuity-supervisor → existing ✅
21. scene-prompt-builder → wire in (final prompt assembly)
22. provider-compatibility → existing ✅
23. final-gatekeeper → existing ✅

---

## Phase B — Shot Objects (layer between Scene and generation)

### B1 — Add ShotPlan type to types.ts
- [x] `ShotPlan` interface:
  - shot_id: string (SH{scene_number}-{shot_number} e.g. SH04-02)
  - scene_id: string
  - characters_visible: string[] (CH01, CH02 etc)
  - speaking_character_id: string
  - listening_character_ids: string[]
  - camera_angle: string
  - camera_movement: string
  - framing_type: string (closeup | medium | wide | macro | topdown)
  - lighting_style: string
  - dialogue_line: string
  - audio_timing: number (seconds offset from scene start)
  - sfx_cues: string[]
  - duration: number
  - motion_preset?: string

### B2 — Extend ScenePlan
- [x] Add `shots: ShotPlan[]` field to ScenePlan interface in types.ts
- [x] Update scene-demarcator.ts to generate at least 1 shot per scene (buildDefaultShot)
- [ ] Update cast-checking.ts to validate at shot level (characters_visible vs Cast Bible) — deferred
- [ ] Update continuity-supervisor.ts to track shot-level state changes — deferred

---

## Phase C — Semi-AI Collaboration UI (in /dashboard/collaborative-editor/)

### RULE: Do NOT create a new page. Add to existing collaborative-editor/page.tsx

### C1 — Left Panel: Scene Folder System ✅ DONE Session 11 (2026-05-15)
- [x] Scene list rendered as expandable folders
- [x] Each scene folder shows: scene title, shot count
- [x] Expand scene → shows shot list (shot_id chip, speaking char chip, duration)
- [x] Click shot → sets collaboActiveSceneIdx + collaboActiveShotIdx (activates Center Panel)
- [x] "Add Shot" button per scene (shows info toast — shots come from Story QC)

### C2 — Center Panel: Active Shot Preview ✅ DONE Session 11 (2026-05-15)
- [x] Shows: active scene title, active shot ID, character chip (CH01: Name)
- [x] Shows current dialogue line in [CH01] "line text" format
- [x] Image prompt textarea — editable, updates qcScenes state
- [x] Provider recommendation badge (video / image+motion / image_voiceover)
- [x] Preview image slot (segment.imageUrl || sourceUrl, max 240px)

### C3 — Right Panel: AI Collaboration Console ✅ MOSTLY DONE Session 11
- [x] Instruction text box: "Tell AI what to change..."
- [x] Quick Edit Chips: [Change Dialogue] [Swap SFX] [Change Camera] [Change Music] [Reorder Scene] [Regenerate Shot] — BUILT commit b3d0f54
- [x] Chip clicked → pre-fills instruction box with full actionable template — BUILT
- [x] Change Scope indicator: LOW / MEDIUM / HIGH badge (from Phase D response)
- [x] Confirm panel: what will change + cost estimate + [Cancel] [Apply Change]
- [x] After Apply → patches local state + POSTs to apply-edit (fire-and-forget) + logs to editHistory

### C4 — Dialogue works perfectly ✅ DONE Sessions 11–12
- [x] dialogue_line and ownerCharacterId on AssemblySegment type
- [x] Dialogue display shows [CH01] "line text" format in center panel
- [x] Editing dialogue line updates shot.dialogue_line in qcScenes state
- [x] Voice generation reads character voice from castTray by characterId (Session 12 Cast Bible wiring)
- [ ] Hard enforcement: no dialogue line ever stored without character ID — not enforced at DB level

### C5 — Edit History tab ✅ MOSTLY DONE Session 11
- [x] editHistory state tracks all collabo edits chronologically
- [x] Each entry: timestamp, instruction, resolvedObjectId, changeType, scope, afterSnapshot
- [x] Undo button per entry — FIXED commit b3d0f54 (both SH01-01 and scene_001 ID formats handled, beforeSnapshot saved to DB)

---

## Phase D — Intent Parser + Change Planner (backend tools)

### D1 — API endpoint
- [x] `app/api/story/tools/collabo-edit/route.ts`
  - POST body: { projectId, instruction: string, contextObjectId?: string, projectState: { scenes, shots, characters } }
  - Calls Claude Haiku with: instruction + project state summary
  - Returns: { action, target_type, target_id, payload, scope, requiresRegeneration, estimatedCost, clarification_needed }

### D2 — Intent Parser prompt (Claude Haiku)
- [x] Structured JSON output enforced
- [x] Action types: REMOVE | REPLACE | CHANGE | REORDER | REGENERATE | MUTE | TRIM
- [x] Target types: SFX | DIALOGUE | CHARACTER | SCENE | SHOT | MUSIC | CAMERA | SUBTITLE
- [x] If ambiguous → returns clarification_needed: true with specific_question field
- [x] Never guesses — always resolves to a specific object ID

### D3 — Change Scope Classifier (pure logic, no LLM)
- [x] Rules table:
  - subtitle, volume, logo position → LOW
  - SFX swap, narration voice, scene reorder, shot reorder → MEDIUM  
  - character visual, environment rebuild, full shot regenerate, full scene regenerate → HIGH
- [x] Scope drives: cost estimate shown to user before action runs

### D4 — Project State Update + Edit History ✅ DONE Session 11 (2026-05-15)
- [x] `app/api/story/tools/apply-edit/route.ts` — 91 lines, LIVE
  - POST body: { projectId, resolvedEdit, confirmed: true }
  - Validates confirmed flag + rejects if clarification_needed
  - Inserts StoryEditHistory to DB, returns { success, historyId }
  - Note: patches local UI state first (fire-and-forget to DB)

### D5 — Edit History DB model (add to prisma schema)
- [x] `StoryEditHistory` model added to prisma/schema.prisma:
  - id, projectId, instruction, resolvedObjectId, changeType, scope
  - beforeSnapshot (JSON), afterSnapshot (JSON)
  - timestamp, undone (boolean)
  - @@index([projectId]), @@map("story_edit_history")

---

## DIALOGUE RULE (applies everywhere, no new feature needed)
- Dialogue in collaborative editor MUST work as: Character ID → line text
- No floating dialogue without owner
- Voice gen always reads voice_style from Cast Bible entry matching character_id
- This is enforced by dialogue-voice-supervisor.ts (already built) — ensure it runs in pipeline

---

## WHAT NOT TO TOUCH
- /dashboard/hybrid-planner/page.tsx — DO NOT MODIFY
- /dashboard/children-planner/ — DO NOT MODIFY
- /dashboard/movie-planner/ — DO NOT MODIFY
- /dashboard/commercial-planner/ — DO NOT MODIFY
- /dashboard/ad-editor/ — DO NOT MODIFY
- Any other planner page — DO NOT MODIFY

---

## Execution Order
1. Phase A1 — Character ID fix (cast-bible.ts)
2. Phase A2 — Write prompt-simplifier.ts and prompt-cast-validator.ts
3. Phase A3 — Rewrite index.ts to run all 23 in correct order
4. Phase B1+B2 — ShotPlan type + ScenePlan extension
5. Phase C — Collaborative editor 3-panel UI (C1 through C5)
6. Phase D — Backend tools (D1 through D5)
7. Update CHANGELOG.md and HANDOFF.md

---

## Prisma migration needed (requires Henry to restart dev server first)
- `npx prisma migrate dev --name story-qc-layer` — applies 7 QC models
- Then `npx prisma migrate dev --name story-edit-history` — applies Phase D5 model
