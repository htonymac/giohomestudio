# 04 — Hybrid Planner (`/dashboard/hybrid-planner`)

Your "proven reference pipeline". Stage-based workflow: Story → Characters → Scenes → Audio → Assembly.

## Structural mapping

| Existing element | New treatment |
|---|---|
| Header block with project name + Save | `<HeroTitle/>` + `<PrimaryCTA/>` cluster — keep the "Art Style" dropdown, restyle with `<Select/>` |
| Stage indicator (Story/Characters/Scenes/Audio/Assembly) | New component `<StageStepper/>` — see below |
| Sub-tabs (Story & Draft / Characters / Scene Board / …) | `<TabBar/>` with pill active state using `ds.grad.brand` |
| Yellow "Start by writing…" callout | `<AlertBar/>` with `tone="hint"` (a softer warm gradient) |
| "Your Story" text area | `<ComposeCard/>` — same as Dashboard but with `size="lg"` (taller textarea, no chips) |
| Meta fields (Duration, Audience, Cost, Language, Story AI) | `<FieldGrid/>` — 5-column grid of `<FormRow/>` |

## New component: `<StageStepper/>`

Horizontal pill-stepper. Each stage is a circular node (40×40) with icon + label below. Active stage gets `ds.grad.brand` + `hv-ring` pulse. Connecting line between nodes fills left-to-right as stages complete.

```tsx
type Stage = { key: string; label: string; icon: ReactNode; status: 'pending'|'active'|'done' };
<StageStepper stages={[…]} onSelect={…} />
```

Styling:
- Node (pending): `ds.color.card` bg, `ds.color.line2` border, `ds.color.mute` text
- Node (active): `ds.grad.brand` bg, white icon, animate-pulse, ring
- Node (done): `ds.grad.mint` bg, checkmark icon
- Line: `height:2px`, bg `ds.color.line2`, filled portion `ds.grad.brand`, animates in on state change

## Content area per stage

Each stage renders a different body. Use a shared outer `<Panel/>` with the stage label as title. Inside:

- **Story** → `<ComposeCard size="lg"/>` + `<FieldGrid/>`
- **Characters** → Grid of `<CharacterCard/>` (new — see below)
- **Scene Board** → Horizontal scroll of `<SceneCard/>` (new — 16:9 thumb + title + dialogue preview)
- **Audio & Shots** → Split: `<AudioStrip/>` timeline + `<ShotList/>`
- **Screenplay** → `<Panel/>` with monospace body (`ds.font.mono`, 14px, line-height:1.6)
- **Assembly** → `<RenderDeck/>` full-width

## `<CharacterCard/>`

160×220 portrait card. Top: gradient avatar placeholder (face upload overlay). Bottom: name (Geist 700) + role (mono). On hover: `hv-lift` + reveal small action row (Edit/Duplicate/Delete).

## `<SceneCard/>`

320×180. 16:9 thumb with `ds.grad.coolWarm` bg + scanline overlay. Title strip at bottom. On hover: play-icon overlay.

## Density

Medium. Generous.

## Checklist

- [ ] Stepper transitions use `ds.ease.bounce`
- [ ] Every stage change scrolls to top of `<Panel/>` with smooth behavior
- [ ] Keep existing state machine — just re-skin
- [ ] Empty states use `<EmptyState/>` (spec below): gradient icon 80×80 + title + sub + CTA

## `<EmptyState/>`

```tsx
<EmptyState icon={<Bolt/>} title="Nothing here yet" sub="Write your story idea above to get going" cta={{label:'Start',href:'#'}} />
```

Styling: centered column, 80px gradient icon tile (brand grad), Geist 700 24px title, mute sub, `<PrimaryCTA/>`.
