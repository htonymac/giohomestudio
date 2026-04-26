# 05 — Asset Library (`/dashboard/asset-library`)

Media browser. Grid-heavy. Performance matters — virtualize if assets > 100.

## Structural mapping

| Existing element | New treatment |
|---|---|
| Filter bar (type / date / tag) | `<FilterBar/>` — horizontal row of `<Chip/>` components (same chips as `<ComposeCard/>`) |
| Search | `<TopBar/>`'s search field, full-width variant `size="lg"` |
| Upload CTA | `<PrimaryCTA/>` with upload icon, top-right |
| Asset grid | `<AssetGrid/>` — CSS grid, `minmax(200px, 1fr)`, gap 12 |
| Asset card | `<AssetCard/>` — new, see below |
| Selection bar (bottom when items selected) | `<ActionBar/>` — sticky bottom `<Panel conicBorder>` |
| Preview modal | `<Modal/>` with `conic-border` wrapping a 16:9 preview area |

## `<AssetCard/>`

Square-ish card (aspect-ratio varies with asset). Structure:

```
┌────────────────┐
│  [thumbnail]   │  ← gradient fallback if no thumb; scanline on hover
│                │
│  ┌──────────┐  │
│  │  TYPE    │  │  ← mono chip, top-left, `ds.grad.coolWarm` per-type
│  └──────────┘  │
│           ⋯    │  ← hover-only actions menu, top-right
├────────────────┤
│  Title         │  ← Geist 600, 13px
│  Duration·MB   │  ← mono 10px muted
└────────────────┘
```

Hover: `hv-lift` + thumb plays if video + `hv-sheen`. Selected: 2px `ds.grad.brand` outline + checkmark in top-right circle.

## Type badges (gradient map)
- Video → `ds.grad.brand`
- Image → `ds.grad.coolWarm`
- Audio → `ds.grad.hot`
- Character → `ds.grad.brandSky`
- Music → `ds.grad.mint`
- SFX → `ds.grad.coolWarm` (with different hue shift)

## Sidebar filter panel (new)

Left of the grid, inside the page (not the app sidebar). `<FilterPanel/>` — collapsible sections:
- Type (checkboxes)
- Duration (range slider)
- Resolution
- Uploaded by (user chips)
- Tags (chip cloud)

Use `<details>` native elements styled to match — each summary is a `<PanelHead/>`.

## `<ActionBar/>` (bottom selection)

Appears only when `selectedCount > 0`. Slides up from bottom with `animate-rise` reversed.

Contains:
- "N selected" mono label (left)
- Action buttons: Add to project / Tag / Download / Delete — each a `<SecondaryCTA/>`
- Primary: "Use in new project" — `<PrimaryCTA/>` right

## Density

Compact grid, generous card. Set `density="compact"` on the filter panel's `<Panel/>` instances.

## Performance

If CC touches render paths:
- Use `<Image/>` from `next/image` for thumbs with `sizes="200px"`
- Virtualize with `react-window` if grid > 200 items (won't be needed under that)
- Debounce search input 200ms

## Checklist

- [ ] Drag-to-upload overlays the grid with a dashed `ds.color.indigo` border + `ds.grad.brand` tinted backdrop
- [ ] Empty state per filter: `<EmptyState/>` (see spec in `04-hybrid-planner.md`)
- [ ] Hover-play videos muted, cap at 3 simultaneous via a ref queue
- [ ] Bulk-select with shift-click + cmd/ctrl-click like Finder
