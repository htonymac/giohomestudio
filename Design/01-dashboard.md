# 01 — Dashboard (`/dashboard`)

**This is the reference build.** Every other page reuses the same components; refer back here.

## Page layout

```
<main>
  <TopBar />
  <Hero>        (2 cols on desktop: HeroTitle + ComposeCard)
  <StatsRow />  (4 StatCards)
  <AlertBar />
  <RenderDeck />
  <TwoCol>
    <Panel title="Quick Start"> … 4× QuickStartButton
    <Panel title="Recent Projects"> … 4× ProjectRow
  </TwoCol>
  <ToolsRow />  (4 ToolTiles)
</main>
```

Sidebar + MeshBackground are in `app/layout.tsx`, not here.

## Data wiring

Each section takes typed props — map to your existing hooks:

```ts
type DashboardData = {
  stats: { total: number; pendingReview: number; completed: number; creditSpent: number; }
  activeRenders: RenderJob[];
  recentProjects: Project[];
  creditsLeft: number;
};

type RenderJob = { id: string; title: string; engine: 'Kling'|'Runway'|'Suno'|'FAL'; format: string; duration: string; pct: number; eta: string; frame?: string; thumbVariant: 1|2|3; };
type Project = { id: string; title: string; tag: string; date: string; thumbVariant: 1|2|3|4; };
```

## Page file

```tsx
// app/dashboard/page.tsx
import { ds } from '@/lib/designSystem';
import { TopBar } from '@/components/chrome/TopBar';
import { HeroTitle } from '@/components/hero/HeroTitle';
import { ComposeCard } from '@/components/hero/ComposeCard';
import { StatCard } from '@/components/stats/StatCard';
import { AlertBar } from '@/components/feedback/AlertBar';
import { RenderDeck } from '@/components/render/RenderDeck';
import { Panel } from '@/components/layout/Panel';
import { QuickStartButton } from '@/components/buttons/QuickStartButton';
import { ProjectRow } from '@/components/project/ProjectRow';
import { ToolTile } from '@/components/buttons/ToolTile';
import * as Icon from '@/lib/icons';

export default async function DashboardPage() {
  const data = await getDashboardData(); // your existing fetcher

  return (
    <main style={{ padding:'22px 32px 48px', display:'flex', flexDirection:'column', gap:22, minWidth:0 }}>
      <TopBar className="animate-rise d-1" />
      <section className="animate-rise d-2" style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:22, alignItems:'end' }}>
        <HeroTitle kicker="Studio · Morning shift" title="Make the" italic="impossible" rest="before breakfast." sub="A studio that dreams out loud. Drop a scene, pick a format, roll camera — your reels land below." />
        <ComposeCard defaultPrompt="" onRoll={handleRoll} />
      </section>

      <div className="animate-rise d-3" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
        <StatCard variant="a" label="Total Content" value={data.stats.total} delta="↑ 14" sub="Across all modes" />
        <StatCard variant="b" label="Pending Review" value={data.stats.pendingReview} delta="↑ 9" sub="Needs your approval" />
        <StatCard variant="c" label="Completed" value={data.stats.completed} delta="↑ 8" sub="Approved this cycle" />
        <StatCard variant="d" label="Credit Spent" value={`$${data.stats.creditSpent}`} delta="0%" sub={`Today · ${data.creditsLeft} credits left`} />
      </div>

      <AlertBar className="animate-rise d-4" icon={<Icon.Alert/>} message={<><b>{data.stats.pendingReview} items</b> in Review Queue waiting for your approval</>} cta="Review Now →" href="/dashboard/review" />

      <RenderDeck className="animate-rise d-5" jobs={data.activeRenders} />

      <div className="animate-rise d-6" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
        <Panel title="Quick Start" icon={<Icon.Bolt/>} action="Customize →">
          <QuickStartButton variant="primary" title="Make a Commercial" sub="Slide builder · overlays · brand kit" icon={<Icon.Monitor/>} href="/dashboard/commercial-planner"/>
          <QuickStartButton variant="v2" title="Free Mode — Describe Anything" sub="AI handles the rest" icon={<Icon.Star/>} href="/dashboard/free-mode"/>
          <QuickStartButton variant="v3" title="Browse Templates" sub="Starters · styles · prompts" icon={<Icon.Grid/>} href="/dashboard/templates"/>
          <QuickStartButton variant="v4" title="Open Music Studio" sub="Generate · score · mix" icon={<Icon.Music/>} href="/dashboard/music"/>
        </Panel>
        <Panel title="Recent Projects" icon={<Icon.Clock/>} iconGrad={ds.grad.mint} action="View all →">
          {data.recentProjects.map((p,i)=>(
            <ProjectRow key={p.id} title={p.title} tag={p.tag} date={p.date} thumbVariant={p.thumbVariant} onReview={()=>router.push(`/dashboard/review/${p.id}`)} />
          ))}
        </Panel>
      </div>

      <div className="animate-rise d-7" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        <ToolTile variant="t1" title="Animate Actor" sub="Character motion" icon={<Icon.User/>} href="/dashboard/animate"/>
        <ToolTile variant="t2" title="Asset Library" sub="Stock · uploads · brand" icon={<Icon.Folder/>} href="/dashboard/asset-library"/>
        <ToolTile variant="t3" title="AI Models"     sub="Kling · Runway · FAL"     icon={<Icon.Cpu/>} href="/dashboard/models"/>
        <ToolTile variant="t4" title="Characters"    sub="Voices · looks · casts"    icon={<Icon.Users/>} href="/dashboard/characters"/>
      </div>
    </main>
  );
}
```

## Component specs (paste-ready)

> Each component below should be created as its own file. Exact inline-style blocks. Hover behaviour comes from class names in `animations.css`.

### `<HeroTitle/>`
```tsx
// components/hero/HeroTitle.tsx
import { ds } from '@/lib/designSystem';

type Props = { kicker: string; title: string; italic: string; rest?: string; sub?: string; };

export function HeroTitle({ kicker, title, italic, rest, sub }: Props) {
  return (
    <div>
      <div style={{ fontFamily:ds.font.mono, fontSize:11, fontWeight:700, letterSpacing:'0.24em', color:ds.color.indigo, textTransform:'uppercase', display:'inline-flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <span style={{ width:22, height:2, background:ds.grad.brand, borderRadius:2 }}/>{kicker}
      </div>
      <h1 style={{ fontFamily:ds.font.sans, fontWeight:900, fontSize:'clamp(40px,5.4vw,68px)', lineHeight:0.94, letterSpacing:'-0.045em', color:ds.color.ink }}>
        {title} <em className="type-cursor" style={{ fontFamily:ds.font.serif, fontStyle:'italic', fontWeight:400, letterSpacing:'-0.03em', backgroundImage:'linear-gradient(100deg,#5b4fe0,#a78bfa,#edc786,#e6b285,#5b4fe0)', backgroundSize:'220% 100%', WebkitBackgroundClip:'text', backgroundClip:'text', color:'transparent', animation:'sweep 5s ease-in-out infinite' }}>{italic}</em>
        {rest && <><br/>{rest}</>}
      </h1>
      {sub && <p style={{ marginTop:12, fontSize:15, color:ds.color.ink2, fontWeight:500, maxWidth:'48ch', lineHeight:1.5 }}>{sub}</p>}
    </div>
  );
}
```

### `<ComposeCard/>`
Conic gradient border → inner glass card → typewriter placeholder → chips row + pill CTA.

Port directly from `.compose` / `.compose-in` / `.compose-row` / `.roll` classes in `v9.html`. Typewriter logic is the JS snippet at the bottom of v9.html; reimplement as `useEffect` cycling through 4 prompts.

### `<StatCard/>`
Takes `variant: 'a'|'b'|'c'|'d'`, a `value` that auto-counts up on mount (IntersectionObserver), and a sparkline SVG. The 4 variants map to the 4 gradient schemes in v9.html `.stat.a/.b/.c/.d`.

### `<RenderDeck/>`
Conic-border card containing a header (title + LIVE pill + queue ETA), a 3-col grid of `<RenderJob/>` (progress bar sweeps + scanline thumb + animated %), and a black `<FilmStrip/>` marquee at the bottom.

### `<QuickStartButton/>`
See full code in `00-design-system.md` §5.

### `<ProjectRow/>`
52×52 gradient thumb + title/tag/date + "Review" pill. `hv-nudge hv-sheen` classes + left gradient bar revealing on hover (see `.proj::before` in v9.html).

### `<ToolTile/>`
Tracks mouse for the radial glow via pointermove handler setting `--mx/--my` CSS vars. Same as v9.html's inline JS.

### `<Panel/>`
Glass card with gradient-icon header. `<PanelHead icon action>` supports the "View all →" link.

### `<AlertBar/>`
Warm gradient background + shimmer stripe + gradient CTA pill on the right.

## What to extract from existing dashboard

Run these greps in the repo first so CC doesn't duplicate:
- Any existing `SideBar`, `TopBar`, `StatCard`, `Card` components → replace their internals, keep their prop shape if it's close.
- Existing theme constants → migrate into `ds.color` and delete.
- Any CSS-in-JS theme providers → leave in place for now, just stop reading from them.
