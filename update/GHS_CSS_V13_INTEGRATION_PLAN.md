# GHS CSS v13 — Dark Editorial Integration Plan

**Source file:** `C:\Users\USER\Desktop\CLAUDE\giohomestudio\update\css\GioHomeStudio Dashboard v13.html`
**Status:** Planning only — do not implement until explicitly triggered.
**Author:** Opus architect · Date: 2026-04-19

---

## 1. Executive Summary

Claude Design produced a beautiful **Dark Editorial** design system (warm pastels on deep charcoal, Geist + Instrument Serif typography, mesh-blob backgrounds, conic-gradient accents). The source HTML is **incomplete** and has three categories of issues that must be fixed before it can be adopted as the new GHS theme.

The goal is to:

1. Fix the v13 CSS issues (broken rules, heavy opacity/blur, incomplete sections)
2. Extract the design system into a reusable CSS layer
3. Add a theme toggle in Settings so users can switch between **Classic** (existing gold-accent dashboard) and **Editorial** (v13)
4. Re-theme all GHS pages one-at-a-time, not big-bang

---

## 2. What's in v13 — Design System Snapshot

### 2.1 Aesthetic direction
**Dark Editorial Precision** — warm pastels on a deep charcoal base. Feels more like a magazine spread than a SaaS dashboard. The gradient brand dot, conic-gradient wallet card, and italic serif headings are the anchors.

### 2.2 Palette
```
--paper:      #18161d   // deep charcoal (not black, not navy)
--card:       rgba(255,255,255,0.035)
--ink:        #f2efe8   // warm off-white
--ink-2:      #c9c4b8
--mute:       #857f72
--mute-2:     #625d53
--lilac:      #b8a5e8
--lav:        #c7b8ec
--sky:        #e0cca8   // warm sand
--blue:       #8ea8d1
--indigo:     #9a8ee0
--magenta:    #d9b8a0   // warm clay
--pink:       #d8a8c0
--mint:       #b8cdb0
--gold:       #d4a87a   // warm gold
--coral:      #d9a898
--line:       rgba(242,239,232,0.07)
--line-2:     rgba(242,239,232,0.14)
```

### 2.3 Typography
- Display: **Geist** (900/800 weight, -0.03 to -0.045 letter-spacing)
- Serif accent: **Instrument Serif** (italic, used for italicized words inside headings + placeholder text)
- Mono: **JetBrains Mono** (10-11px, 700 weight, 0.14-0.24em letter-spacing, UPPERCASE for labels)

### 2.4 Key signature elements
1. Animated **conic-gradient brand dot** (G logo spinning)
2. **Mesh blob background** — 5 floating color orbs with heavy blur
3. **Fine grid overlay** with radial mask
4. **Gradient-border wallet card** with conic-gradient animated border
5. **Collapsible nav groups** with animated chevrons + colored icon chips
6. **Stat cards** with counter roll-up, sparkline, and radial glow
7. **Alert bar** with shimmer animation + gold/indigo/magenta blend
8. **Tools grid** with cursor-tracked radial glow (CSS variables for mouse position)
9. **Compose card** with conic-gradient animated border + serif italic placeholder
10. Heavy use of **shine/sweep animations** on hover

---

## 3. Issues Found in v13 (must fix before adoption)

### 3.1 Broken CSS rules
- **Line 288** — `.search` rule has trailing garbage: `...transition:border-color .2s,color .2s,box-shadow .2s}--mute);transition:border-color .2s,box-shadow .2s}` — duplicated fragment after closing brace
- **Line 296** — `.pill-live` rule has duplicate/broken append: `...text-transform:uppercase}t-weight:700;letter-spacing:0.16em;color:var(--ink-2);text-transform:uppercase;backdrop-filter:blur(12px)}` — broken continuation

Fix: clean up these two rules, remove duplicate fragments.

### 3.2 Opacity / blur issues (user's main complaint)
- `.mesh` blobs: `filter:blur(110px)` combined with `opacity:.42` + 5 overlapping colored orbs — background feels washed out and blurry
- Card backgrounds at `rgba(255,255,255,0.035)` — only 3.5% alpha — cards look "empty" on top of the mesh
- `backdrop-filter: blur(28px)` on sidebar — heavy GPU cost + blurs content behind
- White wallet/compose cards (`rgba(255,255,255,0.96)`) on dark bg — intentional contrast but stands out harshly

**Recommended adjustments:**
- Reduce mesh blob opacity to 0.15–0.25 max (currently 0.38–0.62)
- Raise card alpha to `rgba(255,255,255,0.06)` for more solid feel
- Reduce backdrop-filter blur from 28px → 14px (performance + less "glassy")
- Make white inline cards (wallet/compose) toggle to a dark-themed alternate where the surface reads `rgba(255,255,255,0.08)` with strong ink text — stops the jarring white-on-dark pop
- Remove the continuous `animation:ring 2s ease-out infinite` on the primary Roll button — constant pulsing is fatiguing. Keep only on initial page load or on hover.

### 3.3 Readability risks
- Stat values use `background-clip:text;color:transparent` (gradient text) — at small sizes becomes illegible. Keep for headline numbers only (46px+). Block for anything under 24px.
- Alert bar uses `color:#6e3e00` and `#4b1f00` (dark brown) against a light-gradient background — works, but check contrast ratio in dark theme context
- Placeholder text in compose card is italic serif gray — beautiful, but if too faint (`--mute-2`) users may not see there's an input

### 3.4 Incomplete sections
The v13 HTML only renders the **dashboard home**. GHS has ~20 pages. Missing:
- Collaborative Editor layout
- Hybrid Planner (story / characters / scenes / audio / assembly / overview)
- Commercial Planner (slides + assembly)
- Content Registry (table view)
- Asset Library (grid view)
- Settings / Finance (already built in Classic theme)
- Review Queue
- Calendar
- Studio Updates
- Characters / Character Voices
- Music Studio / SFX Library
- AI Models
- Ad Editor / Video Editor / Video Trimmer / Video Tools / Video Finishing
- Analytics
- Account / Billing

Each of these needs the v13 design system applied — not a copy/paste, but using the tokens and idioms (card, navi, stat, panel, alert) adapted to each page's needs.

---

## 4. Integration Strategy — 3 Phases

### 4.1 Phase A — Extract design system (no UI change yet)

**Goal:** pull v13 CSS into a reusable layer without breaking current pages.

Steps:
1. Create `app/styles/themes/editorial.css` — holds all v13 tokens, keyframes, utility classes
2. Create `app/styles/themes/classic.css` — the current gold-on-black system tokenized (background `#080810`, surface `#13131f`, gold `#d4a843`, Space Grotesk + JetBrains Mono)
3. Create `app/styles/themes/base.css` — shared resets, layout primitives, typography scale
4. Load the active theme via a CSS variable root class: `<html class="theme-classic">` or `<html class="theme-editorial">`
5. Fix the broken rules identified in §3.1
6. Dial back opacity/blur issues per §3.2

**Exit criteria:**
- Both themes compile and load
- No visual change on existing pages yet
- Theme tokens documented in a simple reference page at `/dashboard/settings/themes/preview`

### 4.2 Phase B — Theme toggle in Settings

**Goal:** let users switch and preview themes live.

Add new page: `app/dashboard/settings/appearance/page.tsx`

Features:
- Two big preview cards: Classic (gold-on-black) vs Editorial (warm-on-charcoal)
- Click to activate → sets `<html class="theme-X">` + persists to localStorage + writes to `user.theme` in DB once user accounts exist
- Live preview: "Preview mode" button — applies theme temporarily for 30s, then reverts, so user can try before committing
- Small callout: "More themes coming soon — Light Mode, High Contrast"

**Exit criteria:**
- User can toggle themes and see every already-migrated page change instantly
- Theme persists across reloads
- Non-migrated pages still render in Classic (graceful degradation)

### 4.3 Phase C — Migrate pages, one at a time

**Order of priority** (highest impact first):

1. **Dashboard home** — match v13 HTML reference
2. **Collaborative Editor** — users spend most time here
3. **Content Registry / All Content** — daily-use control panel
4. **Asset Library** — grid view, highest visual density
5. **Hybrid Planner** — most complex, biggest surface area
6. **Commercial Planner** — slide builder
7. **Ad / Image Editor**
8. **Music Studio + SFX Library**
9. **Video Finishing / Video Editor / Video Trimmer / Video Tools**
10. **Review Queue + Calendar**
11. **Characters + Character Voices**
12. **Analytics + Studio Updates**
13. **Settings (Finance already Classic; add Editorial variant)**
14. **Account + Billing** (built with Phase 3 of payment plan)

**Per-page migration steps:**
1. Create an Editorial-themed sibling component OR add CSS class variants gated by `html.theme-editorial` selectors
2. Use design tokens — never hardcode colors, always reference `var(--lilac)` etc.
3. Verify Classic theme still works (regression test via Playwright)
4. Ship, get Henry's visual OK, move to next page

---

## 5. Toggle UX — What Henry Wants

**Settings → Appearance** page shows 3 options (extendable later):

```
┌─────────────────┬─────────────────┬─────────────────┐
│  ☒ Classic      │    Editorial    │  Light (soon)   │
│  Gold on black  │  Warm charcoal  │  [locked]       │
│  [preview img]  │  [preview img]  │                 │
│                 │                 │                 │
│   [Activate]    │   [Activate]    │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

Also expose a **quick toggle** in the topbar — a small sun/moon/palette icon that cycles through available themes without leaving the page.

---

## 6. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Editorial theme's mesh-blob bg has GPU cost on low-end devices | Detect `prefers-reduced-motion` — disable mesh animations. On mobile, replace with static gradient. |
| White cards (wallet/compose) look jarring on dark — user complaint | Create dark-alt variants; pick via a secondary toggle "High contrast: on/off" |
| Geist + Instrument Serif adds ~150KB font load | Subset fonts to Latin characters only; preload critical weights |
| Per-page migration takes many sessions | Ship Classic fixes first (stable), migrate pages in priority order, accept that some pages stay Classic for months |
| Broken CSS rules in v13 source bleed into prod | Linter (Stylelint) added to CI — blocks builds with malformed CSS |
| Users on mobile get blurry/washed bg | Separate mobile-first rule set that drops mesh blobs in favor of subtle static gradient |

---

## 7. Open Design Questions (for Henry to answer before Phase C)

1. Do we want a **true light mode** later, or stick to two dark themes (Classic + Editorial)?
2. Should the theme toggle be **per-user** (stored in DB) or **per-device** (localStorage only)?
3. Wallet card background: keep **warm white** (Editorial's signature) or create a **dark-alt**?
4. Mesh blob bg: **keep** the animated floating orbs or **static** gradient mesh?
5. Brand dot (spinning conic G logo): **adopt** or **simplify** for performance?
6. Stat counter roll-up animation: **keep** on every page load, or **only first visit**?

---

## 8. Implementation Checklist (when triggered)

### Phase A (design-system extract)
- [ ] Create `app/styles/themes/base.css`
- [ ] Create `app/styles/themes/classic.css`
- [ ] Create `app/styles/themes/editorial.css` (port v13 with §3 fixes)
- [ ] Wire theme class on `<html>` via a client component
- [ ] Add a preview-only page at `/dashboard/settings/themes/preview`
- [ ] Stylelint CI rule added
- [ ] Commit + push

### Phase B (toggle UI)
- [ ] Create `/dashboard/settings/appearance/page.tsx`
- [ ] Add topbar quick-toggle
- [ ] Persist in localStorage (DB later)
- [ ] Playwright test: toggle → reload → theme persists
- [ ] Commit + push

### Phase C (per-page migrations)
- [ ] Dashboard home (reference v13 HTML 1:1)
- [ ] Collaborative Editor (biggest file, plan carefully)
- [ ] Remaining 18 pages — one per session, verify no regression each time

**Do not** attempt all pages in one session. Quality > speed. Regression is worse than no change.

---

## 9. Acceptance Criteria

When Phase C is complete:
- User can toggle between Classic and Editorial themes in Settings → Appearance
- Every dashboard page respects the active theme
- No Playwright tests broken from existing feature tests
- No console CSS errors
- Mobile (≤768px) usable in both themes
- Lighthouse performance ≥ 85 in both themes
- `prefers-reduced-motion` honored in both themes
- Henry has visually approved each migrated page

---

## 10. Relationship to Other Plans

- **GHS_PAYMENT_BILLING_PLAN.md** — unrelated, proceeds in parallel
- **GHS_SONNET_REMAINING_FIXES.md** — should complete before Phase C page migrations begin, since page rewrites would re-introduce fixed bugs
- **Finance & Growth page** (already live) — Phase A will extract its current styles into `classic.css`; Phase C will later add an Editorial variant
