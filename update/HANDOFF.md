# GHS HANDOFF — Session 8/9 (Segregation Plan + Wave A/B + Multi-Image + E2E)

**Last updated:** 2026-05-09 by Opus 4.7 (final handoff at Henry's request)
**Branch:** fix/ghs-pipeline-recovery-may05
**Build:** `npx tsc --noEmit` exit=0 (real source clean; only `.next/dev/types/*` transient warnings — they regenerate)
**Dev server:** localhost:3200 (Henry's HP Omen) | **Debug Chrome:** :9222 (CDP for e2e)
**DB:** giohomestudio_db (Prisma — `project_settings` table live via `db push`; Postgres)

---

## ⚡ AT-A-GLANCE — pickup checklist for next agent

**DONE this session (every item below ships TSC-clean):**
- ✅ Phases A / B / E.1 / F (foundation: ProjectSettings DB+API+hook, helper consolidation, model-health module, registry merge)
- ✅ Phases C.1 → C.7 (all 7 planners migrated to ProjectSettings)
- ✅ Use Max Image opt-in (children + hybrid both views — Scene Board AND Cut A)
- ✅ Wave A (image accumulation + custom N count per scene)
- ✅ Wave B small fixes (modals partial, char separation, voice normalize, parser hardening)
- ✅ MCD tier UI merge in movie-planner Voice tab
- ✅ Lipsync chain upgrade (musetalk + sync-lipsync)
- ✅ SEGREGATION_PLAN.md (~700 lines) + HANDOFF.md (this file)

**LEFT — every item explicitly NOT done in this session:**
1. ❌ Browser-verify each of the 7 planners individually (only hybrid free-tier verified through Expand)
2. ❌ Wave C — multi-image character import (>1 reference image per character)
3. ❌ Wave D — continuity supervisor module attached to GHS Sound tier system (always-ON, depth scales: basic/Haiku/full)
4. ❌ Wave E — wardrobe sidecar (rolls into Wave D supervisor)
5. ❌ Wave F — pre-gen dialogue review UI
6. ❌ Phase D — drop local-state fallbacks (one-line cleanup per planner; gated by #1)
7. ❌ E2E full-path extension — script reaches Expand+Ollama success; needs to follow `Next: Scene Board →` CTAs through Gen Image and Assembly Max
8. ⏸ Phase E.2 — UI badges + cron probe (deferred per Henry default)
9. ⏸ Phase G — white-label tenant model (deferred until customer)
10. Modal scroll-lock pattern audited only on hybrid Preview lightbox; **Terms / AI Chat / legal modals still need same fix** (small carry-over)
11. Wardrobe-continuity bug (suit-out-of-nowhere) — needs Wave D supervisor

**To resume:** start with #2 (Wave C) — small, visible, no dependencies. Skip #1 if you trust the migration; come back to it before #6.

---

---

## 0. ⚡ TL;DR for the next Opus / Sonnet picking this up

If you only read 5 lines, read these:

1. **The architecture migration is DONE through Phase C.7.** All 7 planners read project settings from one DB-backed source via `useProjectSettings(projectId)` hook. Foundation phases A, B, E.1, F are shipped and TSC-clean. Phase D (drop fallbacks) waits for Henry GO + manual browser verify of every planner.
2. **Use Max Image (multi-image assembly) is shipped** in children + hybrid planners with 3-state button (`+ Gen Max` / `Use Max Image` / `Max ON`), inline always-visible thumbnail spread, per-image checkboxes, Select All / Deselect All. Sources unified: Gen Max beats > Gen 4 variants (children) / prevSceneImages variants (hybrid). Custom count input (1-30, default 4).
3. **Image accumulation bug fixed.** Gen Max + Gen Image now APPEND to per-scene pool, never overwrite. Cap 30. Unique scene number per assembly segment so /api/video/assemble's temp-file naming doesn't collide.
4. **Style collision sanitizer + character separation directive** in scene-image, scene-video, generate-portrait, generation/image routes. Bear-with-boy-face fixed. Voice swap fixed via name normalization + parser hardening + alternate-by-index fallback.
5. **MCD tier UI merge** in movie-planner Voice tab: ⓘ More popover per tier shows TTS/lipsync/cost/quality. `🎭 Generate Dialogue` button reads tier and routes provider automatically. Auto-applies lipsync at end of pipeline for tiers that include it.

**Pending work**: Phase D cleanup, Wave C (multi-image character import), Continuity Supervisor (attached to tier system, always-on, depth scales by tier), pre-gen dialogue review UI.

---

## 1. Source-of-truth doc map

| Doc | What's in it |
|---|---|
| `update/HANDOFF.md` (this file) | Live snapshot of session state + resume instructions |
| `update/SEGREGATION_PLAN.md` (~700 lines) | Architectural target, phase-by-phase migration order, function catalog, white-label readiness, Linux migration analysis |
| `update/PROBLEM_AND_FIX.md` | Every bug + cause + fix, dated entries. Every phase logs here |
| `update/RISKS_AND_DECISIONS.md` | Architectural decisions with rollback paths. Tier 3 file list. No-deletion rule |
| `update/CHANGELOG.md` | Per-feature ship log |
| `update/AUDIT_PLAN.md` | Tier 1/2/3 file classification (Tier 3 = NEVER touch) |

---

## 2. ✅ Done in this session (Phase A → Wave B + e2e)

### 2.1 Foundation — Segregation Plan Phases

| Phase | Scope | Files | Status |
|---|---|---|---|
| **A** | ProjectSettings DB + `/api/project/settings` route + `useProjectSettings()` hook | `prisma/schema.prisma`, `app/api/project/settings/route.ts`, `src/hooks/useProjectSettings.ts` | ✅ smoke-tested. PATCH+GET round-trip confirmed. Migrated via `db push` due to pre-existing shadow DB issue with `commercial_projects` table — note for next migrate-dev attempt |
| **B** | Helper consolidation. 5 helpers extracted from 4-6 duplicated copies into `src/lib/<concern>/*` modules | NEW: `src/lib/style/sanitizer.ts`, `src/lib/style/late-anchor.ts`, `src/lib/scene/action-beats.ts`, `src/lib/scene/action-extractor.ts`, `src/lib/scene/motion-extractor.ts`. Edited routes import from new paths. | ✅ **2 silent bugs fixed as side effect** — generate-portrait was missing 5 sanitizer pairs; scene-video lateAnchor was missing storybook style |
| **E.1** | ModelEntry extended (family/version/status/successor/health). 40 entries backfilled with families. `provider-health` module with `markBroken/markHealthy/getModelStatus/pickHealthyAlternative`. `tryWithFallback` wired into scene-video FAL branch. Inline fallback in scene-image. | `src/lib/generation/model-registry.ts`, NEW `src/lib/provider-health/index.ts`, `app/api/hybrid/scene-image/route.ts`, `app/api/hybrid/scene-video/route.ts` | ✅ UI badges + cron probe deferred to E.2 |
| **F** | `aid-model-registry.ts` → re-export shim. AID_VIDEO_MODELS / AID_IMAGE_MODELS schemas preserved for the 5 consumer planners. | `src/lib/aid-model-registry.ts` | ✅ no entries dropped |

### 2.2 Per-Planner ProjectSettings Migration (C.1 → C.7)

All 7 planners now subscribe to `useProjectSettings(projectId || stableId)`. Pattern: `const effectiveX = projectSettings.fieldName ?? localX` for read sites; setters call local state THEN fire-and-forget `patchProjectSettings({field: value}).catch(()=>{})`.

| # | Planner | File | Settings migrated | Notes |
|---|---|---|---|---|
| C.1 | movie-planner | `app/dashboard/movie-planner/page.tsx` | projectStyle, language, soundTier, narrationProvider, selectedVideo/ImageModelId, subtitleConfig | ✅ smoke-tested PATCH+GET. ~28 read sites replaced, 9 setters |
| C.2 | children-planner | `app/dashboard/children-planner/page.tsx` | visualStyle, soundTier, narrationProvider, video/image model, subtitleConfig | ✅ ~40 read sites replaced |
| C.3 | music-video-planner | `app/dashboard/music-video-planner/page.tsx` | projectStyle, soundTier, video/image model, subtitleConfig | ✅ no URL projectId — uses local id, hook activates on save/load |
| C.4 | commercial-planner | `app/dashboard/commercial-planner/page.tsx` | brandVisualStyle, video/image model | ✅ smoke PASS |
| C.5 | free-mode | `app/dashboard/free-mode/page.tsx` | imageStyle, image/video model, musicTier, voiceProvider, llmModel, subtitleStyle | ✅ keyed to sessionId or `"free-mode-default"` |
| C.6 | scene-forge | `app/dashboard/scene-forge/page.tsx` | style, aspect, voice, musicTier, video/image model | ✅ keyed to `SCENE_FORGE_DB_KEY` |
| C.7 | hybrid-planner | `app/dashboard/hybrid-planner/page.tsx` (10,586 lines) | projectStyle, soundTier, language, llmProvider, subtitleConfig, video/image model | ✅ last and biggest. SubtitleConfig type fix mid-flight |

### 2.3 Use Max Image (multi-image assembly opt-in)

End user picks N images per scene. Default 1 (existing behavior). Click `+ Gen Max (~N)` to generate N more, click `Use Max Image (N)` to opt in to the spread. `Max ON (M/N)` shows when active. Each thumb has a checkbox in the always-visible inline picker. Select All / Deselect All shortcuts.

| File | Change |
|---|---|
| `app/dashboard/children-planner/page.tsx` | New states `useMaxImageScenes: Set<sceneId>` + `sceneMaxTarget: Record<sceneId, number>`. New 3-state button. Inline picker always visible when scene has 2+ images. Sources unified: sceneBeatImages > variantUrls. Number input (1-30) for custom count. Persisted to DB. Assembly loop assigns unique sequential scene numbers per beat segment so /api/video/assemble doesn't collide tempfiles. Gen Max APPENDS, never overwrites (cap 30) |
| `app/dashboard/hybrid-planner/page.tsx` | Same pattern. TWO assembly UI blocks updated: (1) Scene Board view at ~line 6263, (2) "Select Scenes for Cut A" view at ~line 9216-9489. Sources unified: sceneBeatImages > sceneImages + prevSceneImages. Inline thumbnail spread added below the row. Modal preview now scroll-locks the body + scrolls to top |
| `app/api/video/assemble/route.ts` | TIER 3 — NOT touched. The fix is in caller (children-planner + hybrid) which now sends unique scene numbers |

### 2.4 Wave A — Image accumulation + custom count

- Gen Max + Gen Image now **APPEND** new images to scene pool, never overwrite (was the "ffff project lost an image" bug)
- Cap 30 per scene to prevent runaway memory
- Custom count input next to "+ Gen Max (~N)" button — user picks N (1-30, default 4)
- `sceneMaxTarget` state added + persisted via existing save effect

### 2.5 Wave B — 4 small fixes

| Fix | File | What |
|---|---|---|
| Character anatomy separation | `app/api/hybrid/scene-image/route.ts` | When 2+ characters with mixed species, prompt explicitly lists each by name + species + "DIFFERENT bodies, do NOT merge". Fixed bear-with-boy-face hybrid bug |
| Hybrid feature negative | same | Added `, human face on animal, animal face on human, hybrid creature, fused characters, character merging, blended anatomy, chimera, anthropomorphic merge, mixed species body` to negative prompt |
| Voice routing | `app/dashboard/movie-planner/page.tsx` | Speaker name normalization (trim + lowercase + strip punctuation). Generic Cast N labels mapped by index. Last-resort fallback alternates by line index instead of always cast[0] |
| Parser hardening | `app/api/dialogue/parse/route.ts` | System prompt now has 7 hard rules including "NEVER swap who said what" + "if unsure, prefer Cast 1/Cast 2 over guessing wrong" |
| Modal scroll | `app/dashboard/hybrid-planner/page.tsx` | Body scroll-lock + window.scrollTo(0,0) on Preview modal open. Restored on close |

### 2.6 MCD tier UI merge (movie-planner Voice tab)

| File | What |
|---|---|
| `src/lib/ghs-sound-tiers.ts` | Each tier now bundles MCD config: `mcdLabel`, `mcdTtsProvider`, `mcdEmotionMode`, `mcdLipsync`, `estCostPer100s`, `quality`, `includes[]`. Plus `soundTierToMCDConfig(tier)` helper |
| `app/dashboard/movie-planner/page.tsx` | ⓘ More popover per tier (z-index 199/200, click-outside to dismiss). `🎭 Generate Dialogue (MCD Standard, ~$0.80/100s)` button label dynamic from tier. Provider in `/api/dialogue/generate` POST routed via tier's `ttsProvider`. Auto-lipsync after dialogue loop when `mcdLipsync !== "off"`. Bridge helper `movieTierToGhsSoundTierId()` maps SOUND_TIERS_MOVIE ids → GhsSoundTierId. Legacy "Generate Per-Line Voices" button kept as transparent/grey/small fallback |

### 2.7 Lipsync route upgrade (separate but related)

| File | What |
|---|---|
| `app/api/avatar/lip-sync/route.ts` | Provider chain reordered: `sync-lipsync` (when `inputIsVideo: true`) → `musetalk` (image+audio) → `wav2lip` → `sadtalker`. Per-tier errors surfaced |

### 2.8 E2E browser verification

| Run | Result |
|---|---|
| `tmp/verify_session8.mjs` (test projects) | API persistence confirmed; UI elements not visible because empty test projects |
| `tmp/verify_session8_real.mjs` (real ghs_children_default project) | Page-load smoke pass |
| `tmp/verify_hybrid_free_v2.mjs` | **Confirmed: Story tab → typing via fill() → Expand with AI Intelligence → Ollama (free tier) returns expanded story successfully**. Workflow gated by sequential CTAs ("Next: Scene Board →") that the script didn't follow. Need extension to test full image-gen + assembly path |

---

## 3. ⏳ Pending — what's NOT done

### 3.1 Architecture phases

| Phase | Status | Trigger |
|---|---|---|
| **D** Drop local-state fallbacks | ⏸ pending | Needs Henry GO + manual browser-verify of every planner |
| **E.2** UI badges (green/yellow/red dot per model) + 6h cron health probe | ⏸ deferred | Per Henry default; nice polish on top of E.1 |
| **G** White-label tenant model + API key auth + per-tenant billing | ⏸ deferred | Trigger when Henry signs/commits to a customer |

### 3.2 Feature waves (from latest pass)

| Wave | Scope | Status |
|---|---|---|
| C | Multi-image character import (>1 reference image per character — better img2img identity) | ⏸ NOT started — Henry asked, not yet built |
| D | Continuity supervisor module | ⏸ NOT started — concept agreed: attach to GHS Sound tier system, always-ON, depth scales by tier (basic for free, Haiku for Plus, full check + auto-fix for Pro/Premium) |
| E (post-Wave-D) | Wardrobe sidecar | ⏸ NOT started — roll into supervisor module |
| F | Pre-gen dialogue review UI (review parsed lines + swap speaker before TTS fires) | ⏸ NOT started — visible improvement on Wave-B parser hardening |

### 3.3 E2E follow-up

- Extend `tmp/verify_hybrid_free_v2.mjs` to click `Next: Scene Board →` CTA after Expand
- Wait for scene cards to render
- Click `Gen Image` (proper button label)
- Wait ~30-60s for free-tier image
- Verify Assembly Max buttons populate
- Click `+ Gen Max (4)` and verify pool fills

---

## 4. 📁 File map — every file touched in this session

### 4.1 New files
- `prisma/schema.prisma` (added `ProjectSettings` model)
- `app/api/project/settings/route.ts` (GET/PATCH)
- `src/hooks/useProjectSettings.ts`
- `src/lib/style/sanitizer.ts` (`sanitizeStyleCollisions`, `getStyleCollisionNegative`)
- `src/lib/style/late-anchor.ts` (`LATE_ANCHOR_MAP`, `getLateAnchor`)
- `src/lib/scene/action-beats.ts` (`splitIntoActionBeats`)
- `src/lib/scene/action-extractor.ts` (`extractSceneAction` — PROTECTED comment preserved)
- `src/lib/scene/motion-extractor.ts` (`extractMotionAction`)
- `src/lib/provider-health/index.ts`
- `update/SEGREGATION_PLAN.md` (~700 lines)
- `tmp/verify_session8.mjs` / `tmp/verify_session8_real.mjs` / `tmp/verify_hybrid_free_v2.mjs` (Playwright e2e drivers)

### 4.2 Modified — API routes
- `app/api/hybrid/scene-image/route.ts` (sanitizer/late-anchor imports + character separation directive + hybrid-features negative)
- `app/api/hybrid/scene-video/route.ts` (sanitizer/late-anchor imports)
- `app/api/character-voices/[id]/generate-portrait/route.ts` (sanitizer)
- `app/api/generation/image/route.ts` (sanitizer)
- `app/api/dialogue/parse/route.ts` (parser hardening — 7 hard rules)
- `app/api/avatar/lip-sync/route.ts` (provider chain reordered)
- `src/lib/generation/model-registry.ts` (40 entries backfilled with family/version/status)
- `src/lib/aid-model-registry.ts` (legacy re-export shim)
- `src/lib/ghs-sound-tiers.ts` (MCD bundle per tier + `soundTierToMCDConfig`)

### 4.3 Modified — planner pages
- `app/dashboard/movie-planner/page.tsx` (Phase C.1 + MCD tier UI + voice routing fix + multi-cast dialogue button + audition + per-scene lip-sync button)
- `app/dashboard/children-planner/page.tsx` (Phase C.2 + Use Max Image opt-in + accumulation + custom N + count input + 3-state button + variant fallback + always-visible spread + Cut A row)
- `app/dashboard/music-video-planner/page.tsx` (Phase C.3)
- `app/dashboard/commercial-planner/page.tsx` (Phase C.4)
- `app/dashboard/free-mode/page.tsx` (Phase C.5)
- `app/dashboard/scene-forge/page.tsx` (Phase C.6)
- `app/dashboard/hybrid-planner/page.tsx` (Phase C.7 + Use Max Image × 2 views — Scene Board + Cut A + always-show + accumulation + 3-state button + modal scroll-lock + variant fallback via prevSceneImages)

### 4.4 Modified — docs
- `update/HANDOFF.md` (this file — overwritten multiple times this session)
- `update/PROBLEM_AND_FIX.md` (10+ entries: STYLE-01..04, CHILDREN-MUSIC-01, CHILDREN-ASSEMBLY-01..02, UX-01, DIALOGUE-01, SCENE-FORGE-01, plus PHASE-A..F and PHASE-C1..C7 entries)
- `update/SEGREGATION_PLAN.md` (status tracker updated as each phase shipped)

---

## 5. 🚦 Hard rules (binding for all future agents)

These rules govern every change. Violation = revert.

1. **No function deletion** without explicit Henry GO logged in `update/RISKS_AND_DECISIONS.md`. Mark `@deprecated` instead.
2. **Tier 3 files NEVER touched**:
   - `app/api/assembly/execute/route.ts`
   - `src/lib/assembly-builder.ts`
   - `src/lib/assembly-schema.ts`
   - `app/api/video/assemble/route.ts`
3. **Backward-compat shim** during every migration. Old code path stays live until new path is verified end-to-end.
4. **TSC clean** (`npx tsc --noEmit` exit=0) before commit.
5. **Each phase logs to `PROBLEM_AND_FIX.md`** with date, what, why, files, rollback path.
6. **No structural change to working planners** without explicit Henry GO. Each planner is a distinct shape — mirror logic, do not merge files.

---

## 6. 🔄 How to resume — exact command sequence

```bash
# 1. Read the live state
cat update/HANDOFF.md            # this file
cat update/SEGREGATION_PLAN.md   # architectural target
cat update/PROBLEM_AND_FIX.md    # bug/fix log

# 2. Verify build still clean
cd C:/Users/USER/Desktop/CLAUDE/giohomestudio
npx tsc --noEmit                 # must exit 0

# 3. Verify ProjectSettings table is live
curl -s "http://localhost:3200/api/project/settings?projectId=resume_check" | python -m json.tool
# Expected: { ok: true, settings: { ...all defaults... } }

# 4. Pick the next pending item from Section 3 of this doc:
#    - Phase D (drop fallbacks) — needs Henry GO
#    - Wave C (multi-image character import)
#    - Wave D/E (continuity supervisor attached to tier)
#    - Wave F (pre-gen dialogue review UI)
#    - E2E full path extension

# 5. Per chosen item:
#    a. Update task list (TaskCreate)
#    b. Make the smallest possible change
#    c. TSC verify
#    d. Append entry to PROBLEM_AND_FIX.md
#    e. Update SEGREGATION_PLAN.md status tracker
```

---

## 7. 🧠 Memory pointers (for `~/.claude/projects/C--Users-USER/memory/`)

These memory files in the global memory dir are relevant for any future GHS session:

- `project_giohomestudio.md` — overall project state
- `project_ghs_full_reference.md` — every planner / route / model
- `project_hybrid_pipeline.md` — hybrid workflow doctrine
- `feedback_doc_system.md` — 14-doc-per-project rule
- `feedback_no_function_deletion.md` — hard rule
- `error_log.md` — Terry's learned calluses (grep before debugging)
- `project_ghs_planner_corrections_apr30.md` — binding planner corrections

---

## 8. 🐛 Known unresolved bugs (from latest user observations)

These were raised but not yet fixed:

| # | Bug | Status |
|---|---|---|
| 1 | Modal popups still occasionally below fold (Preview already fixed; other modals may need same scroll-lock pattern) | partial — Preview lightbox in hybrid done; Terms/AI-Chat/legal-modals not audited |
| 2 | Bear-with-boy-face | ✅ fixed Wave B (character separation directive + hybrid-features negative). Needs re-test on next image gen |
| 3 | Cast A speaks Cast B's lines (voice swap) | ✅ partial Wave B (parser hardening + name normalization + alternate-by-index fallback). Pre-gen review UI (Wave F) would catch the rare cases the parser still mis-tags |
| 4 | Suit out of nowhere (continuity break) | ⏸ NOT fixed — needs wardrobe sidecar (rolled into Wave D continuity supervisor) |

---

## 9. 🎯 Prioritized next actions (recommended)

If a future agent wants to keep moving:

| Priority | Item | Reason |
|---|---|---|
| 1 | **Browser-verify all 7 planners** (open each with `?projectId=resume_test_<planner>`, change a setting, reload, confirm persisted). Then Phase D | Required before dropping fallbacks safely |
| 2 | **Wave C — Multi-image character import** | Henry asked. Single-image upload bottleneck for img2img identity. Modify `app/api/character-voices/[id]/upload-reference/route.ts` to accept array; UI accepts multiple files |
| 3 | **Continuity supervisor module** (Wave D/E) | Hooks into tier system. Per Henry: always ON, depth scales — basic supervisor for ghs-sound (free), Haiku for Plus, full + auto-fix for Pro/Premium. Keep tier-attached, NOT a separate button |
| 4 | **E2E full path extension** | Click `Next: Scene Board →` after Expand, then `Gen Image`, then verify Assembly Max button populates. Confirms the whole free-tier flow end-to-end without touching APIs directly |
| 5 | **Pre-gen dialogue review UI** (Wave F) | Visible parsed lines before TTS fires. Single-click swap speaker tag. Catches rare parser mis-tags |

---

### What was done this session (auto-pipeline by Opus + 5 Sonnet sub-agents)

| Phase | Scope | Status | Notes |
|---|---|---|---|
| A | ProjectSettings DB + `/api/project/settings` route + `useProjectSettings()` hook | ✅ DONE | Smoke-tested. Used `db push` fallback (pre-existing migration shadow DB issue unrelated). |
| B | 5 helpers consolidated (`sanitizeStyleCollisions`, `getLateAnchor`, `getStyleCollisionNegative`, `splitIntoActionBeats`, `extractSceneAction`, `extractMotionAction`) into `src/lib/style/*` and `src/lib/scene/*` | ✅ DONE | **2 silent bugs fixed from drift** — generate-portrait was missing 5 sanitizer pairs; scene-video was missing storybook lateAnchor. |
| E.1 | ModelEntry extended (family/version/status/successor/health). 40 entries backfilled. `src/lib/provider-health/index.ts` created with `markBroken/markHealthy/getModelStatus/pickHealthyAlternative`. `tryWithFallback` wired into scene-video FAL branch. Inline fallback in scene-image. | ✅ DONE | UI badges + cron probe deferred to Phase E.2. |
| F | `aid-model-registry.ts` → re-export shim. AID_VIDEO_MODELS / AID_IMAGE_MODELS schemas preserved for the 5 consumer planners. | ✅ DONE | No model entries dropped. |
| C.1 | Movie planner migrated. ~28 read sites → `effective*` shims, 9 setters augmented with fire-and-forget patch. | ✅ DONE | Smoke PASS — visualStyle change persists across reload. |
| C.2 | Children planner migrated. ~40 read sites replaced across 6 settings. | ✅ DONE | TSC clean. |
| C.3 | Music-video planner migrated. 5 settings, 13 read sites, 7 setters. Note: planner has no URL projectId — uses local `projectId` state, hook activates once project saved/loaded. | ✅ DONE | TSC clean, page 200 OK. |
| C.4 | Commercial planner migrated. 3 settings (visualStyle, video model, image model — others not state in this planner). | ✅ DONE | Smoke PASS. |
| C.5 | Free-mode migration | ✅ DONE (after cap reset) | sessionId-keyed, falls back to "free-mode-default". 7 settings, all setters augmented. |
| C.6 | Scene-forge migration | ✅ DONE | 6 settings keyed to SCENE_FORGE_DB_KEY. |
| C.7 | Hybrid planner migration (10,586 lines) | ✅ DONE | 7 effective* shims, ~38 read sites replaced, all setters augmented. SubtitleConfig type-fix needed mid-flight. |
| Use Max Image opt-in (children) | Per-scene toggle replacing auto-shown beat strip in Assembly | ✅ DONE | Default 1 image. Click `Use Max Image (N)` → reveal beat picker + Select All / Deselect All. Persisted to DB. |
| Use Max Image opt-in (hybrid) | Same pattern ported to hybrid-planner Assembly tab | ✅ DONE | State + DB persistence + assembly loop gated on `useMaxImageScenes.has(sceneId)`. Scene Board strip untouched. |
| MCD tier UI merge (movie-planner Voice tab) | Original paused work resumed and shipped | ✅ DONE | ⓘ More popover per tier, button label shows tier+cost, `/api/dialogue/generate` provider auto-routed from tier, auto-lipsync when tier specifies it (musetalk for plus/pro, sync-lipsync for premium). Legacy button kept as small grey fallback. |
| D | Drop local-state fallbacks | ⏸ Deferred | Needs Henry GO + manual browser verify of all 7 planners first. Per no-deletion rule, prefer @deprecated over removal. |
| E.2 | UI badges + cron probe | ⏸ Deferred | Per Henry default. |
| G | White-label tenant model | ⏸ Deferred | Until Henry signs a customer. |

### Key files added / changed this session

**New:**
- `prisma/schema.prisma` — added `ProjectSettings` model
- `app/api/project/settings/route.ts` — GET / PATCH
- `src/hooks/useProjectSettings.ts` — React hook with defaults + fire-and-forget patch
- `src/lib/style/sanitizer.ts` — `sanitizeStyleCollisions` + `getStyleCollisionNegative`
- `src/lib/style/late-anchor.ts` — `LATE_ANCHOR_MAP` + `getLateAnchor`
- `src/lib/scene/action-beats.ts` — `splitIntoActionBeats`
- `src/lib/scene/action-extractor.ts` — `extractSceneAction` (PROTECTED comment preserved)
- `src/lib/scene/motion-extractor.ts` — `extractMotionAction`
- `src/lib/provider-health/index.ts` — health metadata + auto-fallback helpers
- `update/SEGREGATION_PLAN.md` — single-source-of-truth architecture plan (~700 lines)

**Modified for helper consolidation:**
- `app/api/hybrid/scene-image/route.ts`
- `app/api/hybrid/scene-video/route.ts`
- `app/api/character-voices/[id]/generate-portrait/route.ts`
- `app/api/generation/image/route.ts`
- `app/dashboard/hybrid-planner/page.tsx` (only `splitIntoActionBeats` import — no other refactor)
- `app/dashboard/children-planner/page.tsx` (same — plus full Phase C.2 migration)

**Modified for model registry health:**
- `src/lib/generation/model-registry.ts` (40 entries backfilled with family/version/status)

**Modified for ProjectSettings migration (planners):**
- `app/dashboard/movie-planner/page.tsx` (Phase C.1)
- `app/dashboard/children-planner/page.tsx` (Phase C.2)
- `app/dashboard/music-video-planner/page.tsx` (Phase C.3)
- `app/dashboard/commercial-planner/page.tsx` (Phase C.4)

**Shim:**
- `src/lib/aid-model-registry.ts` — converted to re-export shim (Phase F)

### How to resume

When Henry's cap resets, say "resume" or "go" and I will:
1. Read `update/SEGREGATION_PLAN.md` Section 10 status tracker
2. Spawn Sonnet for **Phase C.5 (free-mode)** — same prompt template as the prior 4 planners
3. Continue C.6 scene-forge → C.7 hybrid → D drop-fallbacks
4. Browser-verify between each
5. Final TSC + Playwright pass

Branch state: clean — every phase TSC verified before commit. No staged uncommitted half-edits.

---

## PRIOR SESSION HANDOFF (Session 7) BELOW
---

## WHAT WAS DONE THIS SESSION

### Gen Max — Per-Scene Action-Beat Images (FEATURE-02)

**What:** Scene board now has "Gen Max (N beats)" button on every scene Image tab.
- `splitIntoActionBeats(text)` splits scene description on sentence breaks + action connectors (then/suddenly/after/before/while etc). Returns up to 6 action beats.
- `makeSceneBeatImages(scene)` calls `/api/hybrid/scene-image` once per beat with that beat's text as `sceneText`, stores results in `sceneBeatImages[sceneId]`.
- UI: Gen Max button shows beat count (e.g. "Gen Max (3 beats)"). Shows progress label "Beat 2/3..." while generating. Beat thumbnails appear below button as a scrollable row after generation. Click any thumbnail → full preview lightbox.
- Assembly expansion: when a scene has `sceneBeatImages[sceneId]` and no video, the assembly loop expands that scene into N segments (one per beat image), each with duration = `sceneDur / N`. Falls back to normal single-segment if only 1 beat or has video.
- Gen Image(1) button unchanged — still generates one image using full description.
- Gen Max appears in both "has image" and "no image" states on the card. Hidden when scene description only has 1 beat.

**Files:**
- `app/dashboard/hybrid-planner/page.tsx`:
  - Lines ~370-374: new state `sceneBeatImages`, `generatingMaxBeats`, `maxBeatsProgress`
  - Lines ~1687-1760: `splitIntoActionBeats()` + `makeSceneBeatImages()` functions
  - Lines ~2814-2870: assemblySegments loop changed from `.map()` to `for` loop with beat expansion
  - Lines ~5413-5445: Gen Max button + beat strip in "has image" Image tab
  - Lines ~5456-5470: Gen Max button in "no image" Image tab

---

### Audio Pipeline — Complete Rewrite (fixes for all silent failures)

All 7 audio bugs fixed this session. Root causes documented in PROBLEM_AND_FIX.md as AUDIO-01 through AUDIO-03.

**AUDIO-01: Piper TTS speaks mojibake aloud**
- Symptom: Narrator says "a circumflex euros" instead of em dash
- Fix: `src/lib/sanitize-text.ts` (NEW) — `sanitizeForTTS()` + `detectTTSArtifacts()`
- Applied at: `app/api/hybrid/narrate-piper/route.ts` L273 (ElevenLabs) + L372 (Piper)
- Status: DONE ✅

**AUDIO-02: Multiple narration tracks all play at t=0 simultaneously**
- Symptom: 1 voice in test, 5 simultaneous voices in assembled video
- Fix: Dedup by audioUrl (Set), sort by startTime, `atrim=duration=N` per track, `duration=longest` in amix
- Files: `src/lib/assembly-builder.ts` — narration mix block + final amix
- Status: DONE ✅

**AUDIO-03: Assembly stops at 4 seconds after hard refresh — "shhhh" sound**
- Symptom: Audio cuts off at 4s with abrupt sibilant sound after every hard page refresh
- Root cause: `narratorAudioDuration` is React state only — resets to 0 on refresh. `totalDuration = sceneBaseDuration` (tiny motionDuration values, e.g. 0.5s × 8 = 4s). FFmpeg gets `-t 4`.
- Fix: `effectiveNarrDurMs` recovery block in `assembleScenes()` — if narratorAudioUrl exists but duration=0, load browser `Audio` element → `onloadedmetadata` → recover duration → update state
- All 3 references to `narratorAudioDuration` in assembly-building section replaced with `effectiveNarrDurMs`
- File: `app/dashboard/hybrid-planner/page.tsx` lines 2512-2529 (recovery block), 2773, 2807, 2818
- Status: DONE ✅

**Music never loops (stops at 34s)**
- Fix: `-stream_loop -1` before `-i` + `atrim=duration=${targetDur}` in prepare_music step
- File: `src/lib/assembly-builder.ts` Step 3
- Status: DONE ✅

**SFX completely missing from all assembled videos**
- Fix: New `mix_sfx` step in assembly-builder + SFX path resolution in execute route + SFX track in final merge
- Files: `src/lib/assembly-builder.ts` Step 4, `app/api/assembly/execute/route.ts`
- Status: DONE ✅

**Video cuts at 30s when narration is 3min**
- Fix: `-stream_loop -1` on video in final_merge, `-t totalDur`, `duration=longest`, removed `-shortest`
- Files: `src/lib/assembly-builder.ts` Step 5, `app/api/assembly/execute/route.ts` final_merge override
- Status: DONE ✅

**Duration redistribution not triggering**
- Fix: Redistribution check now triggers correctly when `segDurSum < totalDuration * 0.5`
- File: `app/api/assembly/execute/route.ts` lines 190-196
- Status: DONE ✅

---

### Scene Images — Action Extraction (IMAGE-01)

**Problem:** Confrontation/fight/chase scenes generate calm-looking images. Bryan + bullies look like friends.

**Root cause:** `scene-image/route.ts` pushed raw sceneText with no action analysis. Image models read "Bryan confronted some bullies" as presence, not action.

**Fix:** `extractSceneAction(text)` function added — 12 action types detected via regex:
- confrontation → aggressive body language, one blocking path, hostile posture
- fight → dynamic action poses, striking/lunging
- chase → sense of speed, pursuer visible behind
- fear → wide eyes, cowering, dramatic shadows
- rescue → reaching/pulling to safety, urgent
- argument → pointing, raised voice implied
- discovery → shock expression, high contrast lighting
- grief → slumped posture, head down, soft lighting
- celebration → joyful, arms raised or embracing
- stealth → crouched, pressed against wall, dark
- dialogue → natural facing, engaged expressions
- default → purposeful body language, dynamic composition

Also: `cameraFraming` is now actually injected into the prompt (was received but silently dropped before).

**PROTECTED block:** marked with multi-line comment `// ── SCENE ACTION LAYER — PROTECTED — DO NOT REMOVE, SIMPLIFY, OR OVERRIDE ──` with date + reason. History note inside the comment. Future refactors must NOT delete this block.

**File:** `app/api/hybrid/scene-image/route.ts` lines 143-260

---

### Per-Scene AI Chat — "AI Fix" Tab (FEATURE-01)

**New route:** `app/api/hybrid/scene-chat/route.ts`
- POST — receives scene context (title, description, location, mood, characters, image prompt) + user message + history
- Uses Ollama (local, `forceProvider: "ollama"`, role: "assistant") → $0 cost
- Returns `reply` + optional `imagePromptSuggestion` (extracted from `IMAGE PROMPT:` line in response)

**UI:** Scene cards in Scene Board tab now have 4th tab: **AI Fix** (green)
- Chat history with user/AI bubbles
- Input field + Send button (Enter to send)
- "Apply & Regenerate Image" button appears automatically when AI returns an IMAGE PROMPT suggestion
- Clicking Apply calls `makeSceneImage({ ...scene, description: aiPrompt })` — generates corrected image
- Clear chat button at bottom
- State: `sceneChatMessages`, `sceneChatInput`, `sceneChatLoading` — all per sceneId

**File:** `app/dashboard/hybrid-planner/page.tsx` — state at L366-369, chat panel at ~L5408-5477

**Ollama must be running.** If Ollama is offline, chat returns "Connection error — is Ollama running?".

---

### Subtitle Burn-In — Fixed (SUBTITLE-01)

**Two root causes:**
1. `assemblyNarration` had `text: ""` — no text for subtitle generation
2. `execute/route.ts` never read `assembly.exportSettings.includeSubtitles` — flag was silently ignored

**Fixes:**
- `page.tsx assembleScenes()`: narration entries now carry `text: narratorFullText.slice(0, 8000)` for main narrator
- `execute/route.ts`: subtitle burn-in block added after final_merge success:
  - Splits narration text into sentences
  - Times each sentence proportionally by character count within total duration
  - Writes SRT file, runs `ffmpeg -vf subtitles=file.srt:force_style='...'`
  - If FFmpeg lacks libass → warning log only, original video preserved
  - `subtitledOutputPath` replaces `finalOutputPath` when burn-in succeeds

**Graceful failure:** subtitle step can never corrupt the primary output. Failure = skip silently.

---

## KEY FILE CHANGES THIS SESSION

| File | What changed |
|---|---|
| `src/lib/sanitize-text.ts` | NEW — sanitizeForTTS() + detectTTSArtifacts() |
| `app/api/hybrid/narrate-piper/route.ts` | sanitizeForTTS applied at L273 (ElevenLabs) + L372 (Piper) |
| `src/lib/assembly-builder.ts` | narration dedup+atrim, music stream_loop, new mix_sfx step, final merge overhaul |
| `app/api/assembly/execute/route.ts` | SFX resolution, subtitle burn-in block, final_merge duration fix |
| `app/api/hybrid/scene-image/route.ts` | extractSceneAction() function (PROTECTED), cameraFraming wired |
| `app/api/hybrid/scene-chat/route.ts` | NEW — per-scene Ollama chat route |
| `app/dashboard/hybrid-planner/page.tsx` | effectiveNarrDurMs recovery, AI Fix tab UI, narration text population, subtitle include flag |
| `update/PROBLEM_AND_FIX.md` | AUDIO-01, AUDIO-02, AUDIO-03, IMAGE-01, FEATURE-01, SUBTITLE-01 entries |
| `~/.claude/projects/C--Users-USER/memory/error_log.md` | AUDIO-03 + AUDIO-02 entries added |

---

## KNOWN ISSUES / NOT YET BUILT

| # | Item | Priority | Notes |
|---|---|---|---|
| 1 | SFX doesn't match scene action | Medium | Architecture agreed: 60 semantic categories, each with 2-3 royalty-free files. Ollama maps scene action → category → file. 60 files covers ~90% of all stories. NOT YET BUILT. |
| 2 | Music per scene (not one global) | Low | Currently one music track for whole video. Future: each scene gets its own music mood entry |
| 3 | `KIE_AI_API_KEY` + `MUBERT_PAT` in `.env` | Low | Premium music tiers fall back to stock library without these |
| 4 | Subtitle style not applied | Low | Subtitle burn-in uses hardcoded Arial 22px white. `subtitleConfig` (classic/neon/bold/cinema/minimal) style tokens not yet mapped to FFmpeg force_style params |
| 5 | Scene images: music selection not visually obvious | Low | Henry flagged. FAL music tier selection is buried in Sound tab. Consider moving music preview into Scene Board header |
| 6 | Merge branch to main | Medium | fix/ghs-pipeline-recovery-may05 has all fixes but not merged |
| 7 | Narrator audio duration not persisted to DB | Low | Recovered on assembly via Audio element, but state lost until assembly. Persist to DB for cleaner UX |

---

## NEXT EXACT STEPS

1. **Test audio pipeline end-to-end** — assemble a fresh video after hard refresh; browser console should log `[assemble] Recovered narrator duration after refresh: XXXXXms`
2. **Test AI Fix tab** — open a scene card, click "AI Fix", type a correction, check that AI returns IMAGE PROMPT and Apply button appears
3. **Test scene images** — regenerate Bryan + bullies scene — should now show confrontational body language
4. **Subtitle test** — enable subtitles in pre-assembly panel, assemble, check if SRT burn-in fires (check server logs for `[assembly] Subtitle burn-in OK`)
5. **SFX semantic category system** — when ready to build: 60 categories, royalty-free files in `storage/sfx/categories/`, Ollama maps scene action → category in `scene-intelligence/route.ts`
6. **Merge to main** when satisfied with audio + image quality

---

## HOW THE AUDIO PIPELINE WORKS (reference for future me)

```
assembleScenes() in page.tsx
  1. effectiveNarrDurMs recovery (Audio element if state=0)
  2. totalDuration = Math.max(sceneBaseDuration, narratorDurSec)
  3. Build assemblyNarration (dedup by URL, text populated, endTime = actual duration)
  4. Build assemblyJSON → POST /api/assembly/execute

execute/route.ts
  1. Normalize segment durations (redistribution if segSum < 50% totalDuration)
  2. Preprocess segments: download externals, transcode to H264 normalized clips
  3. Write concat_list.txt with basenames
  4. Resolve narration/music/SFX paths
  5. buildAssemblyPlan() → FFmpegStep[]

assembly-builder.ts steps:
  Step 1: concat_segments — all clips → concat_raw.mp4
  Step 2: mix_narration — dedup+atrim+adelay+amix → narration_mix.wav
  Step 3: prepare_music — stream_loop + atrim to totalDuration → music_mix.wav
  Step 4: mix_sfx — atrim+adelay+amix → sfx_mix.wav
  Step 5: final_merge — stream_loop video + all audio tracks → final_PROJECTID_vN.mp4
    amix=duration=longest:normalize=0 (NEVER duration=first, NEVER -shortest)

execute/route.ts post-processing:
  6. Subtitle burn-in (optional, graceful skip if libass missing)
  7. ffprobe for actual duration
  8. Generate thumbnail
  9. Save to asset library + DB
  10. Cleanup intermediates
```

---

## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma)
## Build: TSC clean (exit 0)
