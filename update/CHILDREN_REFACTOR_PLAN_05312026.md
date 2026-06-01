# GHS Children Planner — Module Segregation Plan

**Target file:** `app/dashboard/children-planner/page.tsx`
**Audit date:** 2026-05-31
**Prepared by:** Sonnet Plan agent (read-only)
**Status:** PLANNING ONLY — no execution this session

---

## 1. Current Shape Audit

| Metric | Count |
|---|---|
| Total lines | 7,394 |
| `useState` declarations | 196 |
| `useEffect` blocks | 8 |
| `async function` declarations (top-level inside component) | 47 |
| `await fetch(` call sites | 70 |
| Render functions defined inside component | 2 (`renderDesign`, `ProgressBar`) |
| Tab render blocks (inline JSX) | 9 |
| Interfaces declared inside the component function | 5 |

### Domain Areas Identified

| Line range | Domain |
|---|---|
| 1-222 | Constants, types, style tokens, `normalizeImageUrl` |
| 223-565 | Component open, URL params, all useState |
| 566-709 | Story expansion: `expandContent`, `extractChildCharacters` |
| 710-1099 | Character registry (11 functions) |
| 1100-1270 | `expandStory` (170-line pipeline) |
| 1271-1300 | `runSceneIntelligence` |
| 1302-1402 | `makeSceneVideo` (SSE streaming) + `startContinuousMotion` |
| 1404-1712 | Scene board (8 functions) |
| 1806-1876 | Per-scene SFX/music + archive/restore |
| 1878-2001 | `runAiSupervisor`, `runPreflight` |
| 2002-2230 | `assembleMovie` (228 lines — largest single function) |
| 2232-2322 | Sound helpers (5 functions) |
| 2324-2410 | Pacing engine (3 functions) |
| 2411-2544 | Narration resolvers + `generateNarration` |
| 2546-2668 | Audio plan + establishing shots (3 functions) |
| 2670-2786 | Children music/content gen |
| 2788-3000 | Project persistence + restore/save effects |
| 3002-3164 | Project list + `prefillPrompt` |
| 3165-3346 | `modifyPrompt` |
| 3347-3594 | `renderDesign()` (247 lines JSX) |
| 3596-3682 | Project management |
| 3683-3698 | `ProgressBar` inline component |
| 3699-7394 | Return JSX: 9 tab render blocks (~3,695 lines) |

---

## 2. Proposed Module Breakdown

### 2A. Lib layer — `src/lib/children/`

1. **`constants.ts`** (~130 lines) — `NARRATION_STYLES`, `MUSIC_CHOICES`, `MUSIC_GENRES`, `VISUAL_STYLES`, `AGE_GROUPS`, `AGE_AUDIENCE`, `LEARNING_MODES`, `MOVIE_*`, `SOUND_TIERS`, `WORKSHOP_TABS`, style tokens
2. **`types.ts`** (~80) — interfaces + `normalizeImageUrl`
3. **`narration-helpers.ts`** (~150) — `getNarrationSourceText`, `resolveNarrationText`, `generateNarration` (pure async, explicit params)
4. **`story-helpers.ts`** (~200) — `expandContent`, `expandStory`, `extractChildCharacters`, `prefillPrompt`, `modifyPrompt`
5. **`character-helpers.ts`** (~280) — 11 character functions
6. **`scene-helpers.ts`** (~300) — scene board ops
7. **`assembly-helpers.ts`** (~280) — `assembleMovie`, `runPreflight`, `runAiSupervisor`, `assemblePacingVideo`, `buildPacingPlan`, `generatePacingNarration`, content/music gen
8. **`sound-helpers.ts`** (~100) — freesound + AI SFX + music library
9. **`project-persistence.ts`** (~200) — data-shape helpers; restore/save effects stay in component
10. **`establishing-shots.ts`** (~80)

### 2B. Component layer — `app/dashboard/children-planner/_components/`

11. **`DesignTab.tsx`** (~300)
12. **`OverviewTab.tsx`** (~330)
13. **`ContentTab.tsx`** (~350)
14. **`SceneBoardTab.tsx`** (~500)
15. **`AssemblyTab.tsx`** (~400)
16. **`CharactersTab.tsx`** (~450)
17. **`SoundTab.tsx`** (~300)
18. **`ScreenplayTab.tsx`** (~200)
19. **`ReviewTabs.tsx`** (~160)

---

## 3. State Ownership

Root-only (page.tsx): `activeTab`, `lastAction`, `projectTitle`, `textContent`, `narrationStyle`, `narrationProvider`, `musicChoice`, `musicGenre`, `visualStyle`, `projectStyle`, `sceneStyles`, `narrationSpeed`, `narrationText`, `storyAiProvider`, `screenplay`, `scriptSegments`, `ageGroup`, `safetyLevel`, `storyLengthMin`, `expanding`, `expandingContent`, `expandedContent`, `childScenes`, `audioPlans`, `establishingShotsChild`/`establishingAllChild`/`establishingModeChild`, `sceneVideos`, `sceneImages`, `sceneBeatImages`, `selectedBeatImages`, `useMaxImageScenes`, `assembling`, `assemblySelectedIds`, `assemblyMediaPrefs`, `subtitleConfig`, `writtenBy`, `madeBy`, `ideaFrom`, `soundTier`, `selectedMusicUrl`, `narratorAudioUrl`, `learningMode`, `productionSystem`, `readAlongText`, `generatedVideoUrl`, `generatedMusicUrl`, `savedChars`, `selectedCharIds`, `characters`, `wordOverlayEnabled`, `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl`, `pacingTimingMap`, `storyEra`, `storyCulture`, `uiError`, `setStoryEra`/`setStoryCulture`.

Tab-local: `DesignTab` keeps AID picker state. `ContentTab` keeps `modifyingPrompt`, `prefillingPrompt`, `extractingChars`. `SceneBoardTab` keeps continuous-motion 9 vars, `sceneMaxTarget`, `lightboxImage`, `sceneDurations`, `sceneCharAssignments`, `showArchived`. `AssemblyTab` keeps `preflightResult`/`preflightRunning`, `aiSupervisorRunning`/`aiSupervisorReport`, `assemblyName`, `savedCuts`, `showCutsPanel`, `introUrl`, `outroUrl`, `generatingIntro`, `generatingOutro`, `subtitleMatchResult`. `CharactersTab` keeps 30+ char-specific locals. `SoundTab` keeps freesound/SFX/music-library locals. `ScreenplayTab` keeps screenplay locals. `ReviewTabs` keeps `saving`/`saveError`/`finalVideoUrl`. `OverviewTab` keeps Movie Mode locals.

---

## 4. Migration Order (each step = ONE PR)

### Phase 0 — Foundation
- **0.1** Extract `constants.ts` — pure data, low risk
- **0.2** Extract `types.ts` — interfaces only

### Phase 1 — Pure helpers
- **1.1** Extract `sound-helpers.ts`
- **1.2** Extract `establishing-shots.ts`

### Phase 2 — Character system
- **2.1** Extract `character-helpers.ts` (unfold `genOneShot` closure first)
- **2.2** Create `CharactersTab.tsx`

### Phase 3 — Story expansion
- **3.1** Extract `story-helpers.ts` (use `onPartialResult` callback for `expandStory`'s 3 setter waves)
- **3.2** Create `ContentTab.tsx`

### Phase 4 — Scene system
- **4.1** Extract `scene-helpers.ts` (with `SceneImageConfig` bundle)
- **4.2** Create `SceneBoardTab.tsx` (may need 2 sub-steps — JSX first, state second)

### Phase 5 — Narration
- **5.1** Extract `narration-helpers.ts` — preserves the 4-path convergence shipped in `8bde095` + `4a031a6`

### Phase 6 — Assembly (highest risk, last)
- **6.1** Extract `runPreflight` + `runAiSupervisor`
- **6.2** Extract `assembleMovie` (use `AssemblyContext` bundle)
- **6.3** Create `AssemblyTab.tsx`

### Phase 7 — Remaining tab components
- **7.1** `DesignTab.tsx` — easiest (already a render fn)
- **7.2** `OverviewTab.tsx`
- **7.3** `SoundTab.tsx`
- **7.4** `ScreenplayTab.tsx`
- **7.5** `ReviewTabs.tsx`

---

## 5. Risk Register

| # | Risk | Lines | Severity |
|---|---|---|---|
| 1 | `expandStory` mid-execution state setters across 3 fetches | 1100-1270 | High |
| 2 | `assembleMovie` 30+ state closure + mid-call `resolveNarrationText` | 2002-2230 | **Very High** |
| 3 | `resolveNarrationText` divergence regression (BIB bug returns) | 2411-2495 | **Very High** |
| 4 | `handlePolishScene` + `handleChildSceneOp` both call `generateSceneBoardImage` | 1679-1770 | Medium |
| 5 | `isRestoringRef` + `activeProjectIdRef` colocation (silent state corruption if separated) | 2819-3000 | **Very High** |
| 6 | `characters` array referenced in 8 places — must pass explicit, not via closure | multi | Medium |
| 7 | `writtenBy`/`madeBy`/`ideaFrom` setter wrappers (localStorage) — do NOT extract | 427-450 | N/A — leave in place |
| 8 | `autoOptedMaxRef` + `autoExpandedRef` guard refs — must stay with their useEffects | 3028-3032 | Medium |

---

## 6. Acceptance Criteria (per PR)

Every extraction PR must pass ALL:

- **A.** `npx tsc --noEmit` clean. No new `any` leaks.
- **B.** 8 key flows unbroken: (1) new project → Build Story → scenes appear; (2) Gen Image; (3) Gen Max 8; (4) Assemble; (5) Build All Characters; (6) Generate Narration; (7) save + Ctrl+Shift+R restores state; (8) Load from My Projects.
- **C.** Save useEffect still fires; 2-second debounce respected.
- **D.** `git diff --name-only` includes ZERO files under `app/dashboard/hybrid-planner/` or `app/api/hybrid/`.
- **E.** Backfill useEffect (infinite-loop guard from `1db36ff`) still bails when nothing changed.
- **F.** BIB test: new project, 5-word content, click Assemble — produces >2s audio, not 1s beep.

---

## 7. Anti-Patterns to Avoid

1. Drilling 30 individual props instead of grouping into `AssemblyContext` / `SceneImageConfig` / `CharacterHelperConfig` bags.
2. Moving state into a sub-component that still needs it at the parent. `childScenes` stays at root.
3. Extracting a function and its state in the same PR.
4. Bundling two extractions in one PR. **One extraction = one PR. No exceptions.**
5. Removing the `isRestoringRef.current` guard from the save useEffect.
6. Wrapping the extracted async functions in `useCallback` with stale dependency arrays — convert to pure module functions with explicit params instead.
7. Introducing React Context. Out of scope.
8. Renaming functions during extraction. Names stay identical.

---

## 8. Estimated Timeline

| Phase | PRs | Days | Sessions |
|---|---|---|---|
| 0 | 2 | 0.5 | 1 |
| 1 | 2 | 1 | 1-2 |
| 2 | 2 | 1.5 | 2 |
| 3 | 2 | 1.5 | 2 |
| 4 | 2 | 2 | 2-3 |
| 5 | 1 | 1 | 1-2 |
| 6 | 3 | 2 | 2-3 |
| 7 | 5 | 2 | 3 |
| **Total** | **18 PRs** | **~11.5 days** | **~17 sessions** |

---

## 9. Top 3 Risks (read this every session)

1. **`assembleMovie` (L2002-2230)** closes over 30+ state vars and calls `resolveNarrationText` mid-execution. Incorrect extraction = silent videos on new projects (BIB returns).
2. **`expandStory` (L1100-1270)** makes 3 sequential fetches with setter waves in between. Users see partial UI feedback. Loses progressive feedback if collapsed to single returned object.
3. **`isRestoringRef` + `activeProjectIdRef` colocation (L2819-3000).** If restore and save useEffects get separated from these refs, every page load silently corrupts the project by overwriting restored state with empty defaults.

---

## Residual `page.tsx` after refactor

~1,400 lines. Retains: root-level state, all useEffects, the two guard refs, `flushCurrentProject`, `newProject`, `loadChildProject`, project toolbar JSX, tab bar JSX, `ProgressBar`, Suspense wrapper.

---

## End of plan

This document is **planning only**. No code in this session. Execute one phase at a time across future sessions, validating every acceptance criterion after every PR.
