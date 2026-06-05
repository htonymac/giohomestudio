# Children Planner Segregation Plan — 2026-06-05

## Why this exists

`app/dashboard/children-planner/page.tsx` is **8,402 LOC**. It is the single biggest blocker to:
1. Production `next start` (Turbopack chunk corruption at this file size — see `BIG_PROBLEM_ANDIO_FIX.md` time bomb #3)
2. Sane diffing and code review (every PR shows up in this file)
3. Parallelizing work (every voice/AUT/free-mode change touches it)

This plan is the **exact map** a future agent needs to execute the split safely. It is NOT executed by this plan — surgery is deferred until a Playwright regression battery exists for every tab (see trigger `verify children tabs`).

## File anatomy (mapped 2026-06-05)

### Top-level structure
- Lines 1–262 — imports, type defs, constants (NARRATION_STYLES, MUSIC_CHOICES, AGE_AUDIENCE, VISUAL_STYLES, SOUND_TIER_OPTIONS)
- Lines 263–880 — useState declarations (~200 state vars) + URL param reads
- Lines 881–1200 — derived state + effect hooks
- Lines 1200–3680 — handler functions (extractChildCharacters, buildAllStoryCharacters, expandStory, generateNarration, runSceneIntelligence, generateChildrenContent, assembleMovie, ...)
- Lines 3681–4223 — `renderDesign()` shared render function
- Lines 4224–8402 — **JSX tab blocks** (13 tabs)

### 13 tab sections — line ranges + sizes

| # | Tab | Line range | Size (lines) | Risk |
|---|---|---|---|---|
| 1 | `overview` | 4224–4479 | 256 | LOW |
| 2 | `design` | 4480–4484 (calls `renderDesign()`) | 5 (+ 543 in renderDesign) | LOW |
| 3 | `characters` | 4485–4985 | 501 | MEDIUM |
| 4 | `content` (Story) | 4986–5348 | 363 | MEDIUM |
| 5 | `style` | 5349–5726 | 378 | MEDIUM |
| 6 | `review1` | 5727–5784 | 58 | LOW |
| 7 | `preview` | 5785–5845 | 61 | LOW |
| 8 | `assembly` | 5846–6809 | **964** | HIGH |
| 9 | `review2` | 6810–7008 | 199 | LOW |
| 10 | `sound` | 7009–7252 | 244 | MEDIUM |
| 11 | `script` | 7253–7373 | 121 | LOW |
| 12 | `sceneBoard` | 7374–7955 | 582 | HIGH |
| 13 | `screenplay` | 7956–8402 | 447 | MEDIUM |

## Recommended extraction order (LOW-risk first)

### Wave 1 — low-risk tab moves (target: 575 lines out)
1. `review1` (58 lines) → `app/dashboard/children-planner/tabs/Review1Tab.tsx`
2. `preview` (61 lines) → `app/dashboard/children-planner/tabs/PreviewTab.tsx`
3. `script` (121 lines) → `app/dashboard/children-planner/tabs/ScriptTab.tsx`
4. `overview` (256 lines) → `app/dashboard/children-planner/tabs/OverviewTab.tsx`
5. `review2` (199 lines) → `app/dashboard/children-planner/tabs/Review2Tab.tsx`

After Wave 1: page.tsx ≈ 7,700 LOC. Validate via full Playwright battery before Wave 2.

### Wave 2 — medium-risk tab moves
6. `characters` (501) → `tabs/CharactersTab.tsx`
7. `content` (363) → `tabs/StoryTab.tsx`
8. `style` (378) → `tabs/StyleTab.tsx`
9. `sound` (244) → `tabs/SoundTab.tsx`
10. `screenplay` (447) → `tabs/ScreenplayTab.tsx`

After Wave 2: page.tsx ≈ 5,800 LOC.

### Wave 3 — high-risk last
11. `assembly` (964) → `tabs/AssemblyTab.tsx`
12. `sceneBoard` (582) → `tabs/SceneBoardTab.tsx`

After Wave 3: page.tsx ≈ 4,250 LOC (acceptable target).

## Extraction pattern (per tab)

Each tab is a JSX block that READS ~10-40 parent state vars + CALLS ~3-10 handler functions. The extraction pattern:

```tsx
// tabs/Review1Tab.tsx
"use client";
import { Icon } from "@/app/components/icons";

interface Review1TabProps {
  // State READ
  textContent: string;
  styleProgress: number;
  ageParam: string;
  narrationStyle: string;
  effectiveProjectStyle: string;
  musicChoice: string;
  review1Done: boolean;
  generating: boolean;
  generationProgress: string;
  generationError: string | null;
  // Constants
  NARRATION_STYLES: ReadonlyArray<{id: string; label: string}>;
  VISUAL_STYLES: ReadonlyArray<{id: string; label: string}>;
  MUSIC_CHOICES: ReadonlyArray<{id: string; label: string}>;
  // Style tokens
  cardStyle: React.CSSProperties;
  s2: string; border: string; muted: string; childSafe: string;
  // State WRITE
  setReview1Done: (v: boolean) => void;
  setLastAction: (s: string) => void;
  // Action
  generateChildrenContent: () => Promise<void>;
}

export default function Review1Tab(props: Review1TabProps) {
  // JSX copied from page.tsx lines 5728–5779
  return <div>...</div>;
}
```

Then in `page.tsx`:
```tsx
{activeTab === "review1" && <Review1Tab
  textContent={textContent}
  styleProgress={styleProgress}
  /* ...20 props */
/>}
```

### Props discovery method
For each tab, grep the JSX block for:
- `\w+(\.|\[)` patterns to find variable accesses
- Function calls (lowercased identifier with `(`)
- JSX expressions with `{...}`

Cross-reference against the state/handler list above lines 880 in page.tsx.

### Don't extract — keep in parent
- Style tokens (`cardStyle`, `childSafe`, `border`, `muted`, `s2`) — pass as props OR import from a shared `tokens.ts`
- `Icon` from `app/components/icons` — components import directly
- `Card`, `ButtonPrimary`, `HeroTitle`, `NarrationControls`, `VoiceTierSelector` — these are already separate components

## Safety gate before any wave executes

`scripts/verify-children-tabs.mjs` must exist and pass:
1. Land on `/dashboard/children-planner?projectId=<test>` → 200 + tabs render
2. Click each of the 13 tabs → no console error
3. Generate a narration, image, video — assert files appear in storage
4. Run a full assembly job — assert MP4 plays

If this script does not exist, no extraction wave runs.

## What to update after each wave

- `update/PROBLEM_AND_FIX.md` — append the wave's commits + any surprises
- `ANDIO_MUST_READ.md` — update file-size pointer
- `BIG_PROBLEM_ANDIO_FIX.md` time bomb #3 progress section
- `update/CHANGELOG.md`

## Trigger to start

Henry says one of: `split children wave 1` / `split children wave 2` / `split children wave 3`. Each wave runs sequentially; never two waves in one trigger.

## Related: Hybrid planner (13,567 LOC) — even bigger

The same pattern applies to `app/dashboard/hybrid-planner/page.tsx` but Henry's standing rule is **don't touch Hybrid without explicit GO**. The Hybrid segregation plan would mirror this doc — left for a separate `plan hybrid segregation` trigger when the time comes.
