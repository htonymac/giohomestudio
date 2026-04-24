# Thompson Batch 2 — Summary

## Files Created

| Path | Description |
|---|---|
| `app/components/hero/HeroTitle.tsx` | Kicker pill + Geist 900 hero title + serif italic gradient em + optional sub |
| `app/components/hero/ComposeCard.tsx` | Prompt input card, typewriter placeholder, chip row, ButtonPrimary CTA |
| `app/components/stats/StatCard.tsx` | Dark stat card, count-up via IntersectionObserver, sparkline SVG, 4 variants |
| `app/components/feedback/AlertBar.tsx` | Elevated alert bar, gradient CTA pill Link |
| `app/components/render/RenderJob.tsx` | Individual render job card, progress bar, scanline thumb, animated % |
| `app/components/render/RenderDeck.tsx` | Render queue card, 3-col grid, FilmStrip marquee, empty state |
| `app/components/layout/Panel.tsx` | Generic panel wrapper with gradient-icon header and action link |
| `app/components/buttons/QuickStartButton.tsx` | Full-width tile button, primary=ButtonPrimary, v2/v3/v4=hover-tile divs |
| `app/components/buttons/ToolTile.tsx` | Compact tool tile, mouse-tracked radial glow, 4 variants |
| `app/components/project/ProjectRow.tsx` | Gradient thumb + title/tag/date + Review link, hover nudges 4px right |

## Files Modified

| Path | What changed |
|---|---|
| `app/dashboard/page.tsx` | Full rewrite to v14 layout. Preserved /api/registry, /api/review, /api/analytics data fetches. Replaced v13 inline UI with new components. All emoji removed. |
| `Design/_thompson_log.md` | Appended batch 2 entries |

## Files Deleted

- `app/styles/themes/base.css`
- `app/styles/themes/classic.css`
- `app/styles/themes/editorial.css`

## Deviations from Plan

1. **`@/` alias replaced with relative paths.** The tsconfig `@/*` → `./src/*`, but `lib/` and `app/components/` are not under `src/`. All batch 1 components use relative imports. All new files use relative imports to match existing pattern. No module resolution errors.

2. **`ds.color.indigo` does not exist.** Used `ds.color.lilac` (`#a78bfa`) as closest v14 equivalent. Logged in `_thompson_questions.md Q2`.

3. **`ds.grad.brand` does not exist.** Used `ds.grad.hero` for the kicker accent line. Logged in `_thompson_questions.md Q2`.

4. **AlertBar always shown.** Spec shows AlertBar conditionally. Dashboard renders it in both states (has items → "Review Now" CTA; empty → "queue is clear" message). This avoids layout shift and preserves the `d-4` stagger slot.

5. **`activeRenders` always `[]`.** No render-queue API endpoint found. `RenderDeck` renders empty-state. Logged in `_thompson_questions.md Q3`.

6. **Studio form removed from dashboard/page.tsx.** Original page combined dashboard home + studio generation form in one file with a `showHome` toggle. The v14 spec has them as separate pages. Studio form is in `/dashboard/free-mode`. Logged in `_thompson_questions.md Q5`.

## Data-Adapter Shims Added to dashboard/page.tsx

```ts
// itemToProjectRow — maps RegistryItem → ProjectRow props
// thumbVariant: cycles (idx % 4) + 1 → 1|2|3|4
// date: formatted to "D MMM YY" via toLocaleDateString
// tag: uses item.mode (e.g. "FREE_MODE", "COMMERCIAL")
// href: /dashboard/content/{id}
// title: originalInput sliced to 48 chars, fallback "Untitled project"
```

Credit spent: hard-coded `$0.00` (no API). Delta values derived from raw counts (not historical diffs — no delta API exists).

## Open Questions for Opus

See `Design/_thompson_questions.md` for 5 items:
- Q1: ComposeCard `onRoll` → free-mode integration
- Q2: Missing tokens `ds.color.indigo` and `ds.grad.brand`
- Q3: Render queue API endpoint
- Q4: Credit tracking API
- Q5: Dashboard-vs-studio-form split decision
