# Opus Decisions for Thompson — running log

## Batch 2 — answers to Q1–Q5

### Q1 — ComposeCard `onRoll` loses prompt on navigate-to-free-mode
**Decision:** ACCEPT as-is. Navigate-and-lose-prompt is fine for this rollout. Wiring `?prompt=` into free-mode is a feature change, not a design change. Logged as follow-up.

### Q2 — Missing tokens `ds.color.indigo` and `ds.grad.brand`
**Decision:** ACCEPT substitution (`indigo` → `lilac`, `brand` → `hero`). Do NOT add aliases to `lib/designSystem.ts` — the v9 doc references were stale. Use the v14 shipped tokens for all future pages too.

### Q3 — `/api/render-queue` endpoint does not exist
**Decision:** ACCEPT empty state. When API ships, wire via `fetch("/api/render-queue")`. No change needed now. Follow-up.

### Q4 — Credit spent hardcoded `$0.00`
**Decision:** ACCEPT. Matches original behavior. Credit-tracking API is a separate project item (Finance Phase 2, per existing handoff `GHS_PAYMENT_BILLING_PLAN.md`). Do not invent.

### Q5 — Dashboard vs studio form split
**Decision:** ACCEPT the split. v14 dashboard = overview only. Studio/generation form lives at `/dashboard/free-mode`. Remove `showHome` toggle. This is the correct v14 interpretation. Users who want to generate click the Compose CTA or navigate to Free Mode.

---

## Standing rules for all future batches

1. **tsconfig aliases:** `@/*` → `./src/*` (do NOT use for app/components). Use relative imports from page files to `app/components/*`. Use `../../lib/designSystem` or `../../../lib/designSystem` depending on depth.

2. **Token substitutions** (v9 → v14):
   - `ds.color.indigo` → `ds.color.lilac`
   - `ds.grad.brand` → `ds.grad.hero`
   - Any other "warm paper" / gold/amber-on-cream reference → discard, use v14 dark tokens

3. **Emoji replacements** (mechanical swaps when you see them):
   | Emoji | Replace with |
   |---|---|
   | ✓ | `<Check/>` icon |
   | ✕ ✗ | `<X/>` icon |
   | ⚠ ⚠️ | `<Alert/>` icon |
   | 🎬 🎥 | `<Film/>` icon |
   | 🎵 🎶 | `<Music/>` icon |
   | 🎙 🎤 | `<Mic/>` icon |
   | 🖼 🏞 | `<Image/>` icon |
   | 📁 📂 | `<Folder/>` icon |
   | ⚙️ 🔧 | `<Settings/>` icon |
   | 🔍 🔎 | `<Search/>` icon |
   | 📝 📄 | (stroke SVG — add if missing) |
   | 💥 | (stroke SVG `Burst` — add if missing) |
   | ✦ ✨ | `<Star/>` icon |
   | 👤 | `<User/>` icon |
   | 👥 | `<Users/>` icon |
   | 📥 📦 | (stroke SVG — add if missing) |
   | ● (solid dot pill) | keep — not an emoji, it's a CSS dot in PillLive |

4. **Missing icons:** If you need an icon not in `app/components/icons.tsx`, ADD it (same stroke spec: viewBox 0 0 24 24, fill none, strokeWidth 1.9, strokeLinecap+join round). Append to the file. Do not import lucide-react or any icon dep.

5. **Solid yellow/green buttons you find on old pages:** always swap to `<ButtonPrimary>` (purple→orange animated sweep). Exception: read-only status badges stay — those are `<PillLive>` with colored dot, not CTAs.

6. **Untouched files:** locked from edits — `app/layout.tsx`, `app/components/Sidebar.tsx`, `app/components/chrome/TopBar.tsx`, `app/globals.css`, `lib/designSystem.ts`, `app/animations.css`, `app/components/icons.tsx` (additions allowed — just never remove or rename icons), `app/components/ui/*`.

7. **Shared display components from batch 2** (`hero/`, `stats/`, `feedback/`, `render/`, `layout/`, `buttons/QuickStartButton`, `buttons/ToolTile`, `project/ProjectRow`) are NOW also locked except for additive prop additions if a page needs new behavior.

8. **Per-page adapter shims:** when old data shape ≠ new component props, add a small adapter at the top of the page file. Do NOT modify the shared component to match stale data shapes.

9. **`@/`-style imports you find in old pages:** convert to relative imports during the rewrite (consistent with existing project style).
