# GHS Codebase Audit Plan

## Rules (apply to every simplification)
- "Simplify this without breaking functionality"
- "Rewrite this so a junior dev can understand it"
- "Remove all unnecessary code and explain what you cut"
- "Make this as short as possible while keeping it readable"

## Tiers

### Tier 1 — Safe to simplify (write allowed after Henry approves hit list)
- `app/api/**/*.ts` — pure route functions, no shared state
- `src/lib/**/*.ts` — utilities, builders
- `app/components/**/*.tsx` — isolated UI components

### Tier 2 — Read-only audit only (selective fixes only, no mass rewrite)
- `app/dashboard/hybrid-planner/page.tsx` — 9k lines, working
- `app/dashboard/movie-planner/page.tsx` — working + gate wired
- `app/dashboard/commercial-planner/page.tsx`
- `app/dashboard/children-planner/page.tsx`
- `app/dashboard/series-wizard/page.tsx`
- `app/dashboard/music-video-planner/page.tsx`

### Tier 3 — DO NOT TOUCH (deterministic pipeline, any change = broken video)
- `app/api/assembly/execute/route.ts`
- `src/lib/assembly-builder.ts`
- `src/lib/assembly-schema.ts`
- `app/api/video/assemble/route.ts`

## Audit Agent Output Format (per file)
```
FILE: path/to/file.ts
LINES: N
COMPLEXITY HOTSPOTS: [function names + line numbers > 50 lines or deep nesting]
DEAD CODE: [unused exports, unreachable branches, commented-out blocks]
DUPLICATED LOGIC: [patterns repeated 3+ times that can be extracted]
QUICK WINS: [safe simplifications, estimated line savings]
RISK: low | medium | high
RECOMMENDATION: simplify now | selective fix | audit only | skip
```

## Status
- [ ] Audit launched
- [ ] Reports collected
- [ ] Hit list approved by Henry
- [ ] Simplifications applied
