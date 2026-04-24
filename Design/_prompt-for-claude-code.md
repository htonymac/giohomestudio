# Prompt for Claude Code — GioHomeStudio design rollout

Copy-paste the block below into Claude Code after opening your project:

---

I'm rolling out a new design system across every page of GioHomeStudio. **Read these files first, in this order:**

1. `docs/design-handoff/00-design-system.md` — tokens, component rules, swap list, motion rules
2. `docs/design-handoff/lib/designSystem.ts` — design tokens in TS
3. `docs/design-handoff/lib/animations.css` — keyframes + helpers
4. `GioHomeStudio Dashboard v14.html` — the **reference implementation**. Open it in a browser if you can. This is the source of truth for how every page should look and feel.

## What to do

Apply this design system to **every HTML / React / template page** in the project. For each page:

1. **Preserve** content, routes, data flow, and page-specific layout.
2. **Replace** styling, components, and animations to match v14.
3. Use the **swap list** in `00-design-system.md §4` as a mechanical checklist.

## Hard rules (do not violate)

- No `backdrop-filter`, no glass, no blur anywhere.
- No gradient card backgrounds. Cards are solid `#151518` with `1px var(--line)` border.
- The purple→orange gradient (`--btn-a → --btn-d`) is ONLY for: primary CTAs (with animated sweep), hero `<em>` text, the active-nav accent bar, and the brand dot. Never on card surfaces.
- No emoji in UI. Use stroke SVG icons (`stroke-width:1.9`, `fill:none`, `stroke-linecap:round`).
- No yellow/green solid CTAs. Every primary button uses `.btn-primary` (animated gradient sweep).
- Sidebar stays `#0b0b0d`, solid. Nav icon tiles use the `c2..c11` gradient tints from §3.3.
- Motion is tactile only — buttons lift on hover and punch down on press. No ambient loops except the CTA sweep (6s), brand-dot spin (9s), and hero caret blink.
- Typography: Geist sans for UI, Instrument Serif italic for hero `<em>` only, JetBrains Mono for micro-labels.

## Verification

After each page, confirm:
- [ ] Page background = `#0e0e10`, sidebar = `#0b0b0d`, cards = `#151518`
- [ ] No `backdrop-filter` or `filter: blur()` in the stylesheet
- [ ] Primary CTA animates the gradient sweep and has press feedback
- [ ] Sidebar nav items show colored icon tiles and slide-right on hover
- [ ] No emoji in rendered output
- [ ] Fonts loaded: Geist, Instrument Serif, JetBrains Mono

## Reference pages already built in v14 style

- `/GioHomeStudio Dashboard v14.html` (root) — primary reference

## Pages to transform (ask me for the list if you can't find them)

Scan the project tree for `.html`, `.tsx`, `.jsx`, `.vue`, etc. and walk them one at a time. For each page, show me a before/after screenshot if possible before moving to the next.
