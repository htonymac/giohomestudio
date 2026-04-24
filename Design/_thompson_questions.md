# Thompson Questions for Opus — Batch 2

## Q1 — ComposeCard `onRoll` wiring (TODO in ComposeCard.tsx)

**File:** `app/components/hero/ComposeCard.tsx`

The `onRoll` handler in the dashboard page currently does:
```ts
router.push(`/dashboard/free-mode?prompt=${encodeURIComponent(prompt)}`);
```
This navigates away to free-mode and passes the prompt via URL query param. The free-mode page (`app/dashboard/free-mode/`) would need to read `?prompt=` from `useSearchParams` and pre-fill its input. I checked the current free-mode page does read `searchParams` but does NOT read a `?prompt=` param — it reads `?revise=`, `?continue=`, `?characterId=`, `?mode=`.

**Decision needed:** Should I add `?prompt=` reading to free-mode page? Or should the ComposeCard submit directly to `/api/pipeline` from the dashboard? If the latter, which auth/state does it need to thread through?

Currently left as: navigate-and-lose-prompt. Free-mode will open blank.

---

## Q2 — Missing token: `ds.grad.brand` referenced in spec

The spec doc `01-dashboard.md` references `ds.grad.brand` for the kicker line accent and `ds.color.indigo` for kicker text. Neither exists in shipped `lib/designSystem.ts`.

Resolution applied:
- `ds.color.indigo` → `ds.color.lilac` (`#a78bfa`)
- `ds.grad.brand` → `ds.grad.hero` for the kicker line accent

**Confirm this substitution is correct** or update `lib/designSystem.ts` to add these aliases.

---

## Q3 — Active renders API

`activeRenders` prop of `RenderDeck` is always `[]` in the new dashboard. No `/api/render-queue` or equivalent endpoint was found in the codebase. `RenderDeck` renders the empty-state message.

**When the render-queue API exists**, wire it here:
```ts
fetch("/api/render-queue").then(r => r.json()).then(d => setActiveRenders(d.jobs ?? []));
```

---

## Q4 — Credit tracking

`StatCard variant="d"` shows `$0.00` for credit spent — no spend-tracking API found. The original dashboard also hard-coded `$0.00`. Left as-is. Confirm or point to the credits API.

---

## Q5 — Dashboard route vs Studio form

The original `app/dashboard/page.tsx` was a combined page: a collapsible home dashboard + full studio generation form. The new page is **dashboard only** — the studio form is now only in `/dashboard/free-mode`.

The original page had a `showHome` toggle button that switched between the dashboard view and the studio form. That toggle is removed in v14; users should navigate to `/dashboard/free-mode` instead. Confirm this is the correct split.
