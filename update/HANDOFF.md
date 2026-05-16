# GHS HANDOFF — Session 10 (Story QC Fix + Establishing Shot + Name Library)

**Last updated:** 2026-05-15
**Build:** `npx tsc --noEmit` exit=0 (zero production errors)
**Dev server:** localhost:3200 (HP Omen) | **Debug Chrome:** :9222
**DB:** giohomestudio_db | **Schema:** `imageFlipSeconds` + `flipOverride` + `lastSeenWardrobe` live

---

## ⚡ IMMEDIATE — nothing blocking
Dev server is running. No restart needed. TSC clean. All session work is uncommitted — commit when Henry gives GO.

---

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

## ❌ Still pending (not built, needs Henry GO or future session)

| Item | Gate |
|---|---|
| Phase D — drop local-state fallbacks in 7 planners | Needs Henry GO + browser-verify all 7 planners |
| Wave C — multi-image character import (>1 ref image per character) | Not started |
| Wave D — Continuity supervisor (tier-attached, always-ON, depth scales by tier) | Not started |
| Wave E — Wardrobe sidecar (rolls into Wave D) | Not started |
| Wave F — Pre-gen dialogue review UI | Not started |
| E2E full path: Expand → Scene Board → Gen Image → Assembly | Not done |
| Branch `fix/ghs-pipeline-recovery-may05` not merged to main | Pending |
| `KIE_AI_API_KEY` + `MUBERT_PAT` not in `.env` | Music tiers fall back to stock library |
| Subtitle style tokens (neon/cinema/bold) not mapped to FFmpeg force_style | Low priority |
| Modal scroll-lock on Terms / AI Chat / legal modals | Only Preview lightbox fixed |
| Establishing Shot → Assembly integration | Designed, not built — establishing shots don't yet generate images or affect video assembly |

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
