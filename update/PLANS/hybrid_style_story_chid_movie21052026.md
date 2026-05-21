# PLAN — Port Hybrid Scene Editor Toolset to Movie + Children Planners

**Approved:** 2026-05-21 by Henry
**Status:** APPROVED — save only, do NOT code until further GO
**Filename (Henry's request):** `hybrid_style_story_chid_mivie21052026.md` (typo "mivie" → using "movie")

---

## Background

Henry has been using the Hybrid Planner's scene editor toolbar successfully. The same workflow needs to land in:
1. **Movie Planner** — same toolset, no changes (adult-permissive)
2. **Children Planner** — adapted child-safe toolset

This plan is the source of truth. Implementation will not start until Henry says GO.

---

## Current State (Hybrid — works, do NOT touch)

Scene editor toolbar in `app/dashboard/hybrid-planner/page.tsx` provides:

- **LLM picker:** Auto · Ollama · GPT · Haiku
- **Buttons:**
  - ✨ Polish
  - ➕ Add Action
  - 🔥 Make Intense
  - ❄ Reduce Action
  - 💗 Make Emotional
  - 🌅 Establish
  - ✅ QC
  - ⚙ QC Fix
  - 🪶 Context
  - ❌ Fix Context
- **Ask AI** free-text input → button → custom prompt to LLM
- **Break Scene → N** — splits scene
- **Save / Cancel**

All buttons POST to `/api/hybrid/scene-edit` with different `op` values:
`polish | add_action | intense | reduce_action | emotional | establish | establish_all | break | expand | batch_polish | custom`

Backend already routes all these ops (verified at `app/api/hybrid/scene-edit/route.ts` lines 120-140 and 419-460).

---

## Goal

### Movie Planner
**Same toolset as Hybrid.** No removals, no additions. (Adult content allowed.)

### Children Planner
**Adapted (child-safe) toolset:**

| Keep (same as Hybrid) | Remove from Children | Add to Children |
|---|---|---|
| ✨ Polish | 🔥 Make Intense | 😄 Make Funny |
| ➕ Add Action | ❄ Reduce Action | 🎈 Make Playful |
| 💗 Make Emotional | | 🗡 Make Adventure (gentle excitement) |
| 🌅 Establish | | 🛡 Adult Word Check (scan + flag bad words) |
| ✅ QC, ⚙ QC Fix | | 🔎 Filter Word (user custom blocked list) |
| 🪶 Context, ❌ Fix Context | | 📖 Expand Scene |
| Ask AI · Break Scene · Save/Cancel · LLM picker | | |

Why removed: "Intense" and "Reduce Action" are adult-coded; they don't fit a 3-year-old's story.
Why added: child-mode needs comedy/play/gentle-adventure helpers + adult-word filtering.

---

## Implementation Phases

### Phase A — Movie Planner (~30 min)

- Duplicate Hybrid's scene editor JSX into `app/dashboard/movie-planner/page.tsx`.
- Do **NOT** extract to shared component yet — safer to duplicate first, refactor later when all 3 planners stabilize.
- Wire all buttons to existing `/api/hybrid/scene-edit`.
- No backend changes.
- TypeScript check must pass clean.

### Phase B — Children Planner (~60 min)

- Same toolbar pattern, child-safe button list.
- Wire new buttons to extended `/api/hybrid/scene-edit` (Option 1 below).
- New endpoint for Adult Word Check + Filter Word: `/api/children/word-filter`.
- Pass `childContext` (ageGroup, safetyLevel) to scene-edit so the existing reading-rules apply.

### Phase C — Error Handling

- Each button surfaces red banner with exact API error if call fails.
- 60-second timeout (90s for Ollama).
- Empty AI response → friendly message ("AI returned no change — try a different model"), not crash.
- "Ask AI" free-text input → light sanitize before forwarding to LLM.
- Network failure → retry button shown.

### Phase D — Separate Bug to Investigate AFTER Phases A-C land

Henry reported: "Substitution work on for children, don't break — but substitution doesn't switch."

Investigate: when a character is edited or swapped in Character tab, does scene image regen pick up the new portrait? Trace via:
1. Character edit handler → state update
2. Save to hybrid_saved_states
3. Scene image generation → reads `characterOverrides`
4. PuLID portrait URL — is it cached stale?

This is OUT OF SCOPE for the toolbar plan but tracked here so it isn't forgotten.

---

## API Surface Changes

### PREFERRED: Extend `/api/hybrid/scene-edit`

Add 3 new ops: `funny | playful | adventure`.

Each op:
- Accepts optional `childContext: { ageGroup, safetyLevel }`
- Uses existing per-age vocabulary rules (toddler/preschool/early/older) from earlier work
- System prompt example for `funny`:
  > "Rewrite this scene in a funny, gentle, silly way appropriate for a [ageGroup] child. Use only [N]-letter words. Keep it safe and warm."

One endpoint to maintain. Lower risk than splitting.

### NEW: `/api/children/word-filter`

POST body:
```
{
  sceneText: string,
  customBlockedWords?: string[]
}
```

Returns:
```
{
  flaggedWords: [{ word: "stabbed", replacement: "tapped", position: 42 }, ...],
  cleanedText?: string
}
```

Default block list (adult/violent/scary words) lives in `src/lib/children/word-filter-blocklist.ts`. Built once, reusable across planner + assembly.

---

## Files Affected

| File | Change |
|---|---|
| `app/dashboard/movie-planner/page.tsx` | Add scene editor toolbar |
| `app/dashboard/children-planner/page.tsx` | Add adapted scene editor toolbar |
| `app/api/hybrid/scene-edit/route.ts` | Add 3 new ops (funny/playful/adventure) |
| NEW `app/api/children/word-filter/route.ts` | Adult-word scan + custom filter |
| NEW `src/lib/children/word-filter-blocklist.ts` | Default blocked words + replacements |
| `app/dashboard/hybrid-planner/page.tsx` | **NOT TOUCHED** — risk of regression too high |

---

## Don't Break

- Hybrid scene editor (must remain identical)
- Children substitution flow ("don't break, but doesn't switch" — Phase D, separate)
- All existing scene-edit ops on hybrid (polish/add_action/intense/etc.)
- ElevenLabs narration (commit 73f66b5)
- Music providerKey routing (commit 73f66b5)
- Story Length picker (commit d4ba8a3)
- Age vocabulary rules (commits fbd964a, 73f66b5)
- PuLID face-lock (commits 2f6647e → d53a2f3)
- Bear-head fix (commit 2312034)

---

## Error-Fix Plan (if any phase fails mid-build)

1. **Movie planner toolbar wires wrong** → revert ONLY `movie-planner.tsx`. Hybrid stays untouched.
2. **Children new ops `funny/playful/adventure` fail in scene-edit** → fall back to using existing `custom` op with hardcoded prompts client-side. No backend change needed.
3. **`/api/children/word-filter` endpoint down or broken** → disable the 2 word-related buttons in UI. Rest of toolbar stays functional.
4. **Hybrid scene editor regresses** (shouldn't happen since we don't touch it) → roll back the offending file only. Never roll back unrelated session-recent commits (face-lock, ethnicity, narration fixes).
5. **TypeScript errors in shared types** → revert and either inline-duplicate the type OR fix forward; never bypass `npx tsc --noEmit`.

---

## Verification Plan (before claiming complete)

For each planner:
1. `npx tsc --noEmit` passes clean (no NEW errors)
2. Open planner → create a scene → click each button → verify response
3. Force one button to error (bad LLM call) → verify red banner shows
4. Verify Save persists scene change to project state
5. Verify Cancel discards change

Specifically for Children:
6. Adult Word Check on "Peter stabbed the witch" → flags "stabbed" with replacement
7. Filter Word: add "witch" → next QC flags any "witch" mention
8. Make Funny on a neutral scene → rewrites in playful tone
9. Confirm no Make Intense / Reduce Action button visible

Specifically for Hybrid (regression test):
10. Hybrid scene editor still has all 10 original buttons
11. All hybrid ops still produce expected outputs

---

## Estimated Total Time

~2 hours implementation + ~30 min verification = ~2.5 hours.

---

## Approval Log

- **2026-05-21**: Henry approved plan ("aprroved save dont code yet"). Plan saved to this file. Awaiting GO to start Phase A.

---

## Next Triggers

- "go phase A" → start Movie Planner toolbar
- "go phase B" → start Children Planner toolbar (only after A complete)
- "go all" → run all phases sequentially (A → B → verification)
- "investigate substitution" → start Phase D (separate bug)
