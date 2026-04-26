# 03 — Commercial Planner (`/dashboard/commercial-planner`)

Slide-based commercial builder. Feels closest to the Dashboard in information architecture, so reuse aggressively.

## Structural mapping

| Existing element | New treatment |
|---|---|
| Page header ("Commercial: X") | `<HeroTitle/>` with `size="md"` — swap italic word for the commercial name |
| Brand kit selector | `<Panel title="Brand Kit" icon={<Palette/>}>` containing `<ColorSwatchRow/>` + `<FontPreview/>` |
| Slide list (left rail) | Vertical stack of mini `<ProjectRow/>` — each slide gets a 40×40 gradient thumb + title + duration |
| Slide editor (center) | 16:9 `<Panel conicBorder>` — the canvas itself |
| Slide properties (right) | Stacked `<Panel size="sm">` cards: Text, Media, Timing, Transition |
| Add-slide CTA | `<QuickStartButton variant="primary"/>` at bottom of slide list |
| Render & Export | `<PrimaryCTA/>` top-right of header, `hv-ring` class |

## New sections to add

1. **Script strip** below the header — horizontal film-strip marquee (reuse `<FilmStrip/>`) where each cell is a slide preview. Clicking scrolls the slide list.
2. **Overlay presets** — grid of 6 `<ToolTile/>` variants: Lower third, Full bleed, Split, Ticker, Logo bug, Caption.

## Component reuses — direct

- `<Sidebar/>`, `<TopBar/>`, `<MeshBackground/>`: identical to Dashboard.
- `<StatCard/>`: one at the top showing "Slides: 6 · Duration: 30s · Est. render: 2m"
- `<AlertBar/>`: use for brand-kit mismatches ("Your logo isn't high-res enough for export")

## Density

Medium. Like Dashboard. Don't use `compact`.

## Checklist

- [ ] Slide list uses virtualized scroll if >20 slides
- [ ] Every slide preview thumb uses one of the 4 `.proj` gradient variants — cycle them
- [ ] Render queue pushes into `<RenderDeck/>` globally, so the bottom of this page renders the same `<RenderDeck/>` as Dashboard
- [ ] Export success → fire a `<Toast/>` (spec in `00-design-system.md`) with `ds.grad.mint`
