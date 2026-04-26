# 02 — Collaborative Editor (`/dashboard/collaborative-editor`)

Video editor surface. Goal: apply the design system without breaking the edit pipeline.

## Structural mapping

| Existing element | New treatment |
|---|---|
| Top chrome (project name, save, export) | Reuse `<TopBar/>` — add a `<ProjectTitle/>` slot variant |
| Left tool rail (Cut/Trim/SFX/etc.) | Vertical column of `<ToolTile/>` with `orientation="icon-only"` — 48×48 tiles |
| Center canvas (video preview) | Wrap in a `<Panel>` with gradient-conic border (`.conic-border`), no header |
| Right inspector (properties) | `<Panel title="Inspector">` with compact density — use `size="sm"` variant (12px body, 14px title) |
| Bottom timeline | Custom but styled with `ds.color.card` background + `ds.color.line` dividers, tracks get `background: ds.grad.coolWarm` slices |
| Playhead | 2px vertical line, `background: ds.grad.brand`, with top triangle marker |
| Clip blocks | Use `<ProjectRow/>` thumb pattern (gradient fill + scanline) at mini scale |

## New affordances to add

1. **Live "Saving…" pill** in top right — reuse `<AlertBar/>` styling in mini form (24px height, pill radius, `ds.grad.mint`).
2. **Render button** — `<PrimaryCTA/>` with `hv-ring` class (pulsing glow) and `hv-sheen`.
3. **Active user avatars** (collab cursors) — reuse `.avatar` from Sidebar's `<MeCard/>`, sized 24×24, with gradient outline ring.

## Animations specific to this page

- **Timeline scroll**: horizontal scroll container with inertia; no custom JS, just `overflow-x:auto` + `scroll-snap-type:x proximity` on clip blocks.
- **Playhead drag**: cursor becomes `ew-resize`; scale the playhead `1.3x` on drag via state class.
- **Clip hover**: `hv-lift` (subtle, translate-y: -2px only — smaller than dashboard stat cards).

## Density rules

Editor is information-dense. Override defaults:
- Body font size: 12px (not 14)
- Panel padding: 12px (not 18–22)
- Gap between sections: 12px (not 22)

Pass `density="compact"` to `<Panel/>` to get this.

## What CC should leave alone

- ffmpeg / media pipeline
- Any DnD/drag libraries already in use
- Canvas sizing math
- Hotkeys

## Checklist

- [ ] Replace background with `<MeshBackground/>` (but reduce opacity to 0.4 — editor needs less noise)
- [ ] Swap all buttons to `<PrimaryCTA/>` / `<SecondaryCTA/>` / `<IconButton/>`
- [ ] Timeline tracks use `ds.grad.coolWarm` for video, `ds.grad.hot` for audio, `ds.grad.mint` for captions
- [ ] Inspector rows use `<FormRow/>` (spec in `00-design-system.md`) — 12px mono label, 14px sans value
- [ ] All modals use `<Panel/>` with `conic-border` + backdrop blur
