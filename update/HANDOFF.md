# GHS HANDOFF — Session 14 (Context Buttons + Subtitle Check Fix + Hybrid Image Spec)

**Last updated:** 2026-05-16
**Build:** `npx tsc --noEmit --skipLibCheck` — 1 pre-existing error in `tests/sound-browser-check.spec.ts`, 0 new errors
**Git:** Committed + pushed to main (commit 731be32)
**New spec:** `update/REBRANDHYBRIDIMAGE.md` — Hybrid image-first story structuring + Children pacing engine
**Push log:** `update/GITPUSHLIST.md` — all today's pushes with timestamp + description

---

## ✅ Done Session 14 (2026-05-16)

### Context Check / Fix Buttons Built
- **Per-scene panel** (line ~9139 in hybrid-planner): Added `📋 Context` + `✏ Fix Context` buttons beside existing QC buttons
  - `checkSceneContext(scene)`: heuristic clarity check — word count, big-word ratio, avg words/sentence. No LLM needed.
  - `fixSceneContext(scene)`: calls `/api/hybrid/scene-edit` with simplification instruction. Updates scene description in place.
  - Per-scene result badge rendered below the button row.
- **Global Story QC panel** (line ~9212): Added `📋 Context Check (All)` + `✏ Fix Context (All)` button row
  - `checkContextAll()`: runs `checkSceneContext` on all scenes
  - `fixContextAll()`: async loop over all scenes — runs `fixSceneContext` sequentially
  - Shows loading state while fixing.
- State: `contextCheckResults: Record<string, {status, note}>` + `fixingContext: boolean` added.

### Renamed: QC Fix button
- Old label "🔧 Fix" → "🔧 QC Fix" — clearer distinction from "✏ Fix Context"

### Check Narration → Subtitle Match — Fixed
- Was calling `/api/free-mode/enhance` with `task: "check"` (wrong endpoint — that route reads `rawPrompt`, not `prompt`, and does prompt enhancement not subtitle checking)
- Replaced with synchronous local check:
  1. Collects narration text same way as `assembleScenes()` (scenes sorted → narrationScript || description)
  2. If no narration → warn "generate narration first"
  3. If subtitle mode is "none" → warn with word count + instruction to enable
  4. If `storyQCResult.supervisorResults["subtitle_style"]` has blocking issues → surfaces first issue
  5. Otherwise → "ok" with word count + active mode + active style

### Dialogue Supervisor — Verified wired
- `src/lib/story-supervisors/index.ts` line 214: `runDialogueVoiceCheck(scenes, castBible, contract)` called
- Result stored as `supervisorResults["dialogue_voice"]`
- All 21 supervisor results stored, passed to `runFinalGatekeeper`
- Dialogue results surface in Story QC panel under supervisor scores

---

## ⚡ NEXT — Two major new build tracks (specced 2026-05-16)

### Track H: Hybrid Image-First Story Structuring
Full spec: `update/REBRANDHYBRIDIMAGE.md` — Part 1

| Phase | Description | Status |
|-------|-------------|--------|
| H1 | `POST /api/hybrid/structure-story` — Haiku rewrites idea as tagged visual script | [ ] |
| H2 | `scene-demarcator.ts` reads `[VISUAL] [ACTION] [BEAT]` tags → scene intent field | [ ] |
| H3 | `scene-prompt-builder.ts` injects tag-specific cinematic modifiers | [ ] |
| H4 | "Structure for Images" button in Hybrid story tab (before Expand) | [ ] |
| H5 | Tag badge on scene cards (VISUAL / ACTION / BEAT / NARRATION) | [ ] |

### Track C: Children's Pacing Engine (COMPLETELY SEPARATE from hybrid)
Full spec: `update/REBRANDHYBRIDIMAGE.md` — Part 2

| Phase | Description | Status |
|-------|-------------|--------|
| C1 | `ChildrenPacingPlan` type in `src/types/children.ts` | [ ] |
| C2 | `POST /api/children/build-pacing-plan` — Haiku generates word-level timing plan | [ ] |
| C3 | `POST /api/children/generate-narration` — SSML pauses injected, ElevenLabs call | [ ] |
| C4 | Children assembly route — timing-driven not scene-driven | [ ] |
| C5 | Karaoke subtitle renderer — word-by-word + letter-by-letter highlight | [ ] |
| C6 | Wire into children-planner UI | [ ] |

### Remaining TODOCORRECT14052026 gaps
1. **C3 Quick Edit Chips** (collaborative editor) — NOT YET BUILT
2. **C5 Undo button** (collaborative editor) — needs beforeSnapshot in apply-edit — NOT YET BUILT
3. **Subtitle final test** — restart dev server, assemble video, verify subtitles render
4. **B2 shot-level validation** — deferred, needs Henry GO

---

---

---

## ✅ Done Session 12 (2026-05-16)

### Task 1 — Establishing Shot: Generate Image + Wire into Assembly ✅
- `EstablishingShot` interface: added `imageUrl?: string`
- `genEstablishingShotImage(sceneId)`: async function fires `/api/hybrid/establishing-shot/generate` with `{sceneId, shot, provider:"flux-dev"}`, stores `imageUrl` in `establishingShots` state
- Mini-card UI: "🖼 Gen Image" button + 80×45 image preview when `shot.imageUrl` set
- `assembleScenes()`: establishing shots prepended as image segments (`mode:"image"`, `duration:eShot.durationSeconds||3`) before their main scene in `finalSceneListWithEstablishing`

### Task 2 — Modal Scroll-Lock ✅
- `useEffect` in hybrid-planner watching `previewMedia`, `showAidPicker`, `importLibraryOpen`, `showCharacterPicker`, `pendingImportChar`, `showDialogueReview`
- Sets `document.body.style.overflow = "hidden"` when any modal open, clears on close + cleanup

### Task 3 — Voice Cast Bible Wiring ✅
- `generateNarration()` in collaborative-editor: added Cast Bible lookup before TTS calls
- Reads `activeNarr.speakerId` → finds `castTray` member by name match → extracts `voiceName`
- `resolvedVoiceId = characterVoiceName || defaultVoiceId` used for all ElevenLabs calls in function

---

## ⚡ IMMEDIATE — nothing blocking
Commit on `feat/ghs-finishline`. TSC passes (pre-existing execute/route.ts error only). Dev server on :3200.

---
**Dev server:** localhost:3200 (HP Omen) | **Debug Chrome:** :9222
**DB:** giohomestudio_db | **Schema:** `imageFlipSeconds` + `flipOverride` + `lastSeenWardrobe` live

---

## ⚡ IMMEDIATE — nothing blocking
Feature branch committed. Dev server may need restart to pick up new API routes. TSC clean.

---

## ✅ Done Session 11 (2026-05-15)

### Task 1 — Phase C: Collaborative Editor 3-Panel Scene System
- C1: Left panel shots in expanded scene folders. Shows `shot_id` chip, speaking char chip, duration. Click sets `collaboActiveSceneIdx` + `collaboActiveShotIdx`. "Add Shot" button (shows info toast — shots come from Story QC).
- C2: Active Shot Preview at top of Scene tab. Active scene title, shot ID, char chip, `[CH01] "dialogue"` format, image prompt textarea (editable, updates `qcScenes`), provider badge, preview image slot (uses `segment.imageUrl || sourceUrl`, max 240px).
- C3: Apply Change now POSTs to `/api/story/tools/apply-edit` (fire-and-forget) after applying local state change.
- C4: `dialogue_line` and `ownerCharacterId` added to `AssemblySegment` type.
- C5: `editHistory` already tracks all collabo edits chronologically — history tab unchanged (already correct).

### Task 2 — Phase D4: apply-edit route
- `app/api/story/tools/apply-edit/route.ts` — NEW
- POST `{projectId, resolvedEdit, confirmed}` → validates confirmed + clarification_needed → inserts `StoryEditHistory` → returns `{success, historyId}`.

### Task 3 — Subtitle Style Tokens → FFmpeg
- `subtitleStyle?: "neon" | "cinema" | "bold" | "minimal"` added to `AssemblySegment`.
- Execute route: `getSegmentStyleAt(midTime)` finds which segment covers each subtitle entry's midpoint time, uses its `subtitleStyle` override if set, else falls back to global `exportSettings.subtitleStyle`.

### Task 4 — Modal Scroll-Lock
- `useEffect` in collaborative editor: `document.body.style.overflow = "hidden"` when `showImport || showReview || showCharacterPicker || showShortcuts` open. Cleared on close + unmount.

### Task 5 — Establishing Shot Generate Route
- `app/api/hybrid/establishing-shot/generate/route.ts` — NEW
- POST `{sceneId, shot, provider?}` → prepends "Wide establishing shot" → calls FAL FLUX (dev or pro) → returns `{imageUrl}`.

### Task 6 — Wave C: Multi-Image Character Import
- `src/types/character.ts` — NEW: shared `CharacterIdentity` + `ReferenceImage` interfaces.
- `CharacterPicker.tsx`: thumbnail strip shows when `referenceImages.length > 1` (max 4 tiles, 24px, angle label, tooltip).
- `character-voices/page.tsx`: `VoiceForm` extended with "Reference images" section — upload up to 4 (reuses `/api/character-voices/upload-image`), remove button, angle label input, count indicator (N/4).

## ✅ Done this session (2026-05-15)

### 1. Story QC — Fix System
- `fixQCSuggestion(suggestion)` — sends ALL scenes + one QC suggestion as `batch_polish` op → one LLM call, returns all updated scenes. Fast (was N sequential calls).
- `fixAllQCSuggestions()` — loops all `storyQCResult.gatekeeper.suggestedFixes` sequentially.
- **Fix** button per suggestion in QC panel. **Fix All** button at top.
- Green success banner after any fix: `"Fix applied to N scenes — re-run QC to verify"` with Re-run QC button + dismiss X.
- `runStoryQC()` now builds `qcStoryText` from **current scene descriptions** (not original story idea) — fixes "same problem showed up after re-run" bug.
- `setQcFixDoneMsg(null)` at start of each QC run to clear stale banners.

### 2. Per-Scene AI Chat (Ask AI in edit panel)
- `storyEditAiQuery: Record<string, string>` — per-scene free-text input state.
- `polishSceneCustom(scene)` — POSTs `op:"polish"`, `polishMode:"custom"`, `customInstruction: userQuery`.
- Text input + Ask AI button rendered below polish buttons in scene edit panel.
- Enter key triggers the call. While processing: button shows "Thinking…".

### 3. Character Voice Auto-Assign by Gender
- On character detection (both `dedupedChars` and `extractedChars` paths), auto-assigns Piper voice by gender:
  - Female → `en_US-amy-medium`
  - Male narrator → `en_US-libritts-high`
  - Male other → `en_US-ryan-high`
  - Unknown/neutral → `en_US-lessac-medium`
- Never overwrites a voice the user already set (`prev[c.characterId]` check).
- Fixes: characters always defaulting to Lessac regardless of gender.
- Fixes: Generate Per-Line Voices ignoring selections (was because map was always empty).

### 4. Establishing Shot System — NEW FEATURE
**API (`app/api/hybrid/scene-edit/route.ts`):**
- New op types: `"establish"` and `"establish_all"` added to `Op`.
- `EstablishingShot` interface: `type | prompt | durationSeconds | cameraMovement | mood | purpose | location | timeOfDay`.
- `prevScene?: SceneIn` added to `SceneEditRequest`.
- `runEstablish(scene, prevScene, provider)` — analyzes one scene vs prev scene, returns `{ needed, shot }`. Uses 9-rule add / 5-rule don't-add decision system.
- `runEstablishAll(scenes, storyText, provider)` — analyzes full story in one LLM call, returns array of results (one per scene).
- Both handled in POST.

**UI (`app/dashboard/hybrid-planner/page.tsx`):**
- `EstablishingShot` interface + `ESTABLISHING_TYPE_LABEL` lookup map added.
- 3 new state vars: `establishingShots: Record<sceneId, EstablishingShot>`, `establishingSceneId`, `establishingAll`.
- `addEstablishingShot(scene)` — single scene call, reads prev scene from scenes array.
- `addAllEstablishingShots()` — all scenes in one call using `expandedSummary || idea` as storyText.
- **`📷 Establish Shot`** button in per-scene edit panel (amber). Shows type+duration inline if shot exists.
- **`📷 Establish All`** button next to `+ Expand Scenes` (amber). "Analyzing…" while running.
- Amber mini-card above each scene that has an establishing shot: shows type badge, duration, camera movement, prompt text, ✕ to remove.

**8 establishing shot types:** `opening | location | transition | mood | pre_action | exterior_building | aerial | beauty`

**Spec doc:** `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md` (15KB — full flow, data structure, API design, UI patterns, children story rules, prompt templates, build trigger)

**Memory:** `~/.claude/projects/C--Users-USER/memory/project_ghs_establishing_shot.md` — build trigger: "build establishing shot"

### 5. Name Library Expansion (character-names.json v1.1.0)
- 7 new regions added (each 50M + 50F names): `french`, `spanish`, `greek_roman_myth`, `norse_viking_myth`, `celtic_myth`, `aztec_mayan`, `native_american`
- 4 new continent entries: `french_culture 🇫🇷`, `spanish_culture 🇪🇸`, `mythology ⚡`, `indigenous 🌿`
- 4 new entries in `CULTURE_OPTIONS` dropdown in page.tsx
- Total: 12 continents, 29 regions

### 6. scene-edit route — `batch_polish` op (from earlier session, confirmed live)
- `runBatchPolish(scenes, instruction, provider)` — one LLM call for all scenes.
- Used by `fixQCSuggestion()` for speed.

---

## ✅ Completed (previously listed as pending)

| Item | Status |
|---|---|
| Wave C — multi-image character import (>1 ref image per character) | ✅ DONE Session 11 — `ReferenceImage` type, CharacterPicker strip, 4-image upload UI |
| Wave D — Continuity supervisor tier-attached | ✅ DONE — `runContinuityCheck(scenes, castBible, tier?)` tier param live; standard/pro/premium depth scaling |
| Wave E — Wardrobe sidecar | ✅ DONE — `checkWardrobeContinuity()` in continuity-supervisor.ts; fires on premium/premium_best tier |
| Wave F — Pre-gen dialogue review UI | ✅ DONE — `dialogueReview` state in collaborative-editor; approve/reject/edit per shot; "Generate Approved Lines" button |
| Subtitle style tokens per-segment | ✅ DONE Session 11 — `subtitleStyle` on AssemblySegment, `getSegmentStyleAt()` in execute route |
| Establishing Shot → image generation | ✅ DONE Session 11 — `/api/hybrid/establishing-shot/generate` wired to FAL FLUX |
| Modal scroll-lock (collabo editor + hybrid planner) | ✅ DONE Sessions 11–12 |

## ❌ Still pending (not built, needs Henry GO or future session)

| Item | Gate |
|---|---|
| Phase D — drop local-state fallbacks in 7 planners | Needs Henry GO + browser-verify all 7 planners |
| E2E full path: Expand → Scene Board → Gen Image → Assembly | Not done — no code needed, just test run |
| Branch `fix/ghs-pipeline-recovery-may05` not merged to main | Pending Henry GO |
| `KIE_AI_API_KEY` + `MUBERT_PAT` not in `.env` | Henry's call — music tiers fall back to stock library |
| Establishing Shot → Wan animation (timeline slot, slow drift) | Not built — establishing shot image gen done, video animation not wired |
| Modal scroll-lock on Terms / AI Chat / legal modals (non-collab pages) | Partial — collab + hybrid done; other pages still pending |
| Prisma migrations not run | `npx prisma migrate dev --name story-edit-history` pending (needs dev server restart) |
| C3 Quick Edit Chips ([Change Dialogue] [Swap SFX] etc.) | Not built — instruction text box works, chips not added |
| C5 Undo button per edit history entry | Not built — beforeSnapshot not persisted in apply-edit route |
| B2 cast-checking.ts shot-level validation | Deferred — explicitly marked, needs Henry GO |
| B2 continuity-supervisor.ts shot-level tracking | Deferred — explicitly marked, needs Henry GO |

---

## 📁 Files changed this session

| File | What changed |
|---|---|
| `app/api/hybrid/scene-edit/route.ts` | +`batch_polish` op, +`custom` polish mode, +`establish` op, +`establish_all` op, +`EstablishingShot` interface, +`prevScene` field, +`runBatchPolish()`, +`runEstablish()`, +`runEstablishAll()` |
| `app/dashboard/hybrid-planner/page.tsx` | +`EstablishingShot` interface, +3 establishing state vars, +`addEstablishingShot()`, +`addAllEstablishingShots()`, +`fixQCSuggestion()`, +`fixAllQCSuggestions()`, +`polishSceneCustom()`, +voice auto-assign logic, +CULTURE_OPTIONS 4 new entries, +Establish Shot button, +Establish All button, +amber mini-card, +Fix/Fix All buttons, +fix-done banner, +Ask AI input/button |
| `src/data/character-names.json` | v1.1.0 — +7 regions, +4 continents, 700 new names |
| `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md` | NEW — full establishing shot spec (15KB) |
| `~/.claude/projects/C--Users-USER/memory/project_ghs_establishing_shot.md` | NEW — memory entry |
| `~/.claude/projects/C--Users-USER/memory/MEMORY.md` | +establishing shot index entry |

---

## 🔑 Key numbers
- page.tsx: **12,242 lines**
- session net: **+1,715 insertions, −46 deletions** across 13 files
- TypeScript: **0 production errors**

---

## 🎯 Recommended next steps (priority order)

1. **Commit this session's work** — all 13 modified files + 2 new files
2. **Wave C — Multi-image character import** — Henry asked, smallest next visible feature
3. **Wave D — Continuity supervisor** — attach to tier system, always-ON, depth scales (basic/Haiku/full)
4. **Establishing Shot → Assembly integration** — when triggered: establishing shot scenes need their own FLUX image gen (wide/aerial prompt) and Wan animation (slow drift). Stored in `establishingShots` state, already available at assembly time.
5. **Phase D — drop fallbacks** — needs Henry GO first

---

## How to resume

```bash
# 1. Verify build
cd C:/Users/USER/Desktop/CLAUDE/giohomestudio
npx tsc --noEmit                    # must exit 0

# 2. Check server
netstat -ano | findstr ":3200"      # PID should be listening

# 3. Commit if Henry says GO
git add app/api/hybrid/scene-edit/route.ts app/dashboard/hybrid-planner/page.tsx src/data/character-names.json
git commit -m "Session 10: QC fix system, establishing shots, AI chat, voice auto-assign, name library v1.1.0"

# 4. Read spec for next task
cat update/LANDSCAPE\ SHOT/ESTABLISHING_SHOT_SPEC.md    # establishing shot assembly integration
cat update/SEGREGATION_PLAN.md                           # Wave C/D/E/F details
```

---

## Source-of-truth docs
| Doc | Purpose |
|---|---|
| `update/HANDOFF.md` | This file — live session state |
| `update/SEGREGATION_PLAN.md` | Architecture target + phase tracker |
| `update/PROBLEM_AND_FIX.md` | All bugs + fixes log |
| `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md` | Establishing shot full spec |
| `update/CHANGELOG.md` | Per-feature ship log |
| `update/RISKS_AND_DECISIONS.md` | Architectural decisions |

**Dev server:** localhost:3200 | **DB:** giohomestudio_db | **Build:** TSC clean
