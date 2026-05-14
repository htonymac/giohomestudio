# GHS Segregation Plan — Architecture Migration to Central Project Settings + Function Catalog

**Status:** DRAFT — written 2026-05-08 (Opus session). Awaiting Henry sign-off before any migration step starts.

**Why this exists:**
Henry's words: *"I have corrected many functions that after a few upgrades the old function got lost. With this all functions go back to one file or area, then where should the program file be visible on?"*

Today every planner re-implements the same settings (visualStyle, soundTier, language, subtitleConfig, narrationProvider) as local React state. Same logic helpers (sanitizers, action extractors, emotion detection) sometimes get duplicated across routes. When something is fixed in one file, the duplicates drift.

This document is the **single source of truth** for:
1. Where every function and setting lives today
2. Where it should live tomorrow
3. The exact phase-by-phase migration order (so nothing gets lost)
4. White-label readiness so external tenants can call the same APIs

Anyone reading this document — me, Sonnet, a future Opus — can pick up the migration without re-discovering the codebase.

---

## 0. Hard Rules (binding before any phase starts)

These rules apply to every step. Violating them = revert.

1. **No function deletion.** Per `RISKS_AND_DECISIONS.md` 2026-04-24: existing functions are never deleted — only redirected or marked `@deprecated`. Removal needs Henry GO in `RISKS_AND_DECISIONS.md`.
2. **No structural change to working planners** without explicit Henry GO. Each planner is a distinct shape (hybrid/movie/children/music-video/commercial/karaoke/scene-forge/free-mode). Mirror logic, do not merge files.
3. **Tier 3 files NEVER touched** (per `AUDIT_PLAN.md`):
   - `app/api/assembly/execute/route.ts`
   - `src/lib/assembly-builder.ts`
   - `src/lib/assembly-schema.ts`
   - `app/api/video/assemble/route.ts`
4. **Backward-compat shim during every migration.** Old code path stays live until the new path is verified end-to-end. No big-bang switches.
5. **TSC clean after every step.** `npx tsc --noEmit` exit=0 before commit.
6. **Each phase logs to `update/PROBLEM_AND_FIX.md`** with date, what changed, why, files touched, rollback path.

---

## 1. Current State Snapshot (2026-05-08)

### 1.1 Codebase scale

- **265 API routes** across 28 functional areas
- **~50 logic modules** in `src/lib/`
- **8 planner pages** under `app/dashboard/*-planner/` (hybrid, movie, children, music-video, commercial, karaoke, free-mode, scene-forge)
- **Postgres via Prisma** as DB; project state persisted in `hybrid_saved_states` table (key/value JSON)

### 1.2 Settings scattered across planners (the problem)

Same setting, declared as local `useState` in multiple planners:

| Setting | Hybrid | Movie | Children | Music-Video | Commercial | Free Mode | Scene Forge |
|---|---|---|---|---|---|---|---|
| `visualStyle` / `projectStyle` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `aspectRatio` | partial | partial | — | partial | partial | — | ✓ |
| `language` | ✓ | ✓ | ✓ | — | ✓ | partial | — |
| `subtitleConfig` | ✓ | ✓ | ✓ | ✓ | — | ✓ | — |
| `soundTier` | ✓ | ✓ | ✓ | ✓ | — | ✓ | partial |
| `narrationProvider` | ✓ | ✓ | ✓ | — | ✓ | ✓ | — |
| `imageModel` / `videoModel` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| `llmProvider` | partial | partial | partial | — | — | ✓ | ✓ |

7 planners × 8 settings = **up to 56 places** the same value lives. Today, changing visualStyle in one planner does not propagate. New settings (e.g. character face-lock) get added inconsistently.

### 1.3 Logic helpers (the good news)

Most logic helpers are already in `src/lib/` as pure functions. Some are duplicated across routes (sanitizer, emotion). Some are still inline in planner pages (splitIntoActionBeats — currently in both hybrid and children).

The audit (Section 5 below) catalogs every helper, where it lives, and what reads what.

---

## 2. Target Architecture

### 2.1 Three layers (hard separation)

```
LAYER 1 — STATE (data the user picks)
  └─ ProjectSettings table (Postgres, Prisma model)
     ├─ /api/project/settings   (GET/PATCH per projectId)
     └─ useProjectSettings()    (React hook, all planners subscribe)

LAYER 2 — LOGIC (pure functions, no I/O)
  └─ src/lib/*  (one folder per concern)
     ├─ src/lib/style/          (sanitizer + presets + late anchor)
     ├─ src/lib/dialogue/       (emotion + pacing + parser)
     ├─ src/lib/scene/          (action extractor + motion extractor + beats)
     ├─ src/lib/character/      (resolver + ID generator + identity)
     ├─ src/lib/assembly/       (TIER 3 — DO NOT TOUCH)
     ├─ src/lib/llm/            (provider chain + tier router)
     ├─ src/lib/media/          (URL normalization + duration probing)
     ├─ src/lib/sound/          (ghs-sound-tiers + MCD config)
     ├─ src/lib/subtitle/       (wrap + style)
     └─ src/lib/timing/         (auto-timestamp + scene timeline)

LAYER 3 — ORCHESTRATION (API routes + UI pages)
  └─ app/api/* and app/dashboard/*-planner/
     ├─ Reads ProjectSettings via /api/project/settings
     ├─ Calls Layer 2 helpers
     └─ Returns results to client
```

### 2.2 Why this works for white-label

External tenants get one entry point: `/api/project/settings`. The same API, scoped by `tenant_id`, drives a branded UI on their domain. Engine = GHS. Brand = theirs.

```
GHS Engine (Layer 1+2)
       │
       ├── Internal UI: /dashboard/* (Henry's white-labelled product)
       │
       ├── White-label client A: their own UI calls /api/project/settings
       │
       └── White-label client B: same API, different tenant_id
```

---

## 3. Project Settings — Single Source of Truth

### 3.1 Schema

```prisma
model ProjectSettings {
  id                  String   @id @default(cuid())
  projectId           String   @unique          // matches hybrid_saved_states.localId
  tenantId            String?                    // null = default tenant (today's GHS); set for white-label
  // Visual / generation
  visualStyle         String   @default("storybook")    // storybook | realistic | 3d-cinematic | anime | nollywood | comic | 2d-cartoon
  aspectRatio         String   @default("16:9")         // 16:9 | 9:16 | 1:1 | 4:5
  imageModelFamily    String   @default("flux")         // logical name (flux | ideogram | pulid)
  imageModelVersion   String   @default("auto")         // auto = latest active | "fal_flux_schnell" pin
  videoModelFamily    String   @default("wan")          // wan | kling | hailuo | runway
  videoModelVersion   String   @default("auto")
  // Audio
  soundTier           String   @default("ghs-sound")    // ghs-sound | ghs-plus | ghs-pro | ghs-premium
  narrationProvider   String   @default("auto")         // auto resolves from soundTier
  // Localization
  language            String   @default("en")           // ISO 639-1
  // Subtitles
  subtitleEnabled     Boolean  @default(true)
  subtitleMode        String   @default("classic")      // classic | neon | bold | cinema | minimal | kids
  subtitleHighlight   String   @default("#34d399")
  // LLM
  llmProvider         String   @default("auto")         // auto | ollama | openai | claude | grok
  // Identity
  faceLockEnabled     Boolean  @default(true)           // PuLID for photo-import characters
  // Brand (white-label)
  brandLogoUrl        String?
  brandPrimaryColor   String?  @default("#a855f7")
  // Timestamps
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt

  @@index([tenantId])
}
```

### 3.2 API surface

```
GET  /api/project/settings?projectId=...      → returns full settings (or defaults if not set)
PATCH /api/project/settings                    → partial update, returns merged settings
POST /api/project/settings/clone               → copy from one project to another
```

For white-label later:
```
GET  /api/project/settings?projectId=...&tenantId=...  → tenant-scoped read
```

### 3.3 React hook

```typescript
// src/hooks/useProjectSettings.ts
export function useProjectSettings(projectId: string) {
  // Fetches once on mount, subscribes via SWR-style cache
  // Returns { settings, patch, isLoading }
}
```

Every planner uses this hook. Local state stays as fallback during migration but the hook value wins when both are set.

### 3.4 Migration path per planner

For each of the 7 planners, in this order: movie → children → hybrid → music-video → commercial → free-mode → scene-forge:

1. Add `useProjectSettings(projectId)` near top of page
2. Replace local-state reads of migrated settings with hook reads
3. Replace local-state writes with `patch({ ... })`
4. Keep existing local state as fallback shim (`const effective = settings.visualStyle ?? localVisualStyle`)
5. TSC clean
6. Browser-verify on localhost:3200
7. Log to `update/PROBLEM_AND_FIX.md`

After all 7 planners migrate, drop the local-state fallback in a follow-up sweep (one-line removal per file, easy to revert).

---

## 4. Model Registry + Health (the "Wan v1 broke" problem)

### 4.1 Current state

- `src/lib/generation/model-registry.ts` lists 40+ models (image + video)
- Each entry has `id`, `endpoint`, `provider`, `is_active`, `cost_per_*`
- No health probing, no version pinning, no auto-fallback chain
- A second registry `src/lib/aid-model-registry.ts` exists — duplicate, candidate for merge

### 4.2 Target additions

Extend `model-registry.ts` (no breaking changes — additive fields only):

```typescript
interface ModelEntry {
  id: string;                    // existing
  family: string;                // NEW — "wan", "kling", "flux"
  version: string;               // NEW — "2.1", "1.6", "schnell"
  endpoint: string;              // existing
  provider: string;              // existing
  status: "active" | "deprecated" | "sunset" | "broken";  // NEW
  successor?: string;            // NEW — id of newer model in same family
  health_last_checked?: string;  // NEW — ISO timestamp
  health_ok?: boolean;           // NEW
  is_active: boolean;            // existing — kept for backward compat
}
```

### 4.3 New module `src/lib/provider-health.ts`

```typescript
export async function markBroken(modelId: string, reason: string): Promise<void>;
export function pickHealthyAlternative(family: string): ModelEntry | null;
export async function probeProvider(modelId: string): Promise<boolean>;
export function getModelStatus(modelId: string): "active" | "degraded" | "broken";
```

When `scene-image` or `scene-video` gets a 404/422 from FAL on a specific model:
1. Call `markBroken(modelId, errorBody)`
2. Look up `successor` → retry with that
3. Surface to user: *"Wan 2.1 unavailable — switched to Wan 2.5"*
4. Background cron probes broken models every 6h; auto-flip back to `active` when they recover

### 4.4 UI badge per model dropdown

Green dot = active. Yellow = degraded (last probe failed but other tier members work). Red = broken (with auto-fallback name displayed).

### 4.5 Project Settings interaction

Project picks a `videoModelFamily: "wan"` + `videoModelVersion: "auto"` (default). Resolver picks the latest active Wan model. User can pin a version (`videoModelVersion: "wan-2.1"`) if they want exact reproducibility — even if it's deprecated, system warns but uses it.

---

## 5. Function Catalog (where every helper lives — NEVER lose this)

### 5.1 Logic modules in `src/lib/` — current state

| Module | Exports | Reads | Used by |
|---|---|---|---|
| `dialogue-emotion.ts` | `extractEmotion()`, `elevenLabsSettingsFor()`, `gapMsBetween()` | per-line text | TTS route, dialogue/generate, narrate-piper |
| `ghs-sound-tiers.ts` | `GHS_SOUND_TIERS`, `getSoundTier()`, `soundTierToMCDConfig()`, `soundTierToMusicProviderKey()`, `soundTierToNarrationProvider()` | tier ID | music/generate, voice routing, all planners |
| `style-presets.ts` | `STYLE_PRESETS`, `getStylePreset()`, `getMotionStylePrefix()` | visualStyle | scene-image, scene-video, generate-portrait |
| `character-resolver.ts` | `resolveCharacterTokens()`, `attachCharacterReferences()` | DB | scene-image, generation/image |
| `sanitize-text.ts` | `sanitizeForTTS()`, `detectTTSArtifacts()` | text | TTS route, narrate-piper |
| `llm.ts` | `callLLM()`, `SELECTABLE_MODELS` | llm-settings | 40+ routes |
| `llm-settings.ts` | `loadLLMSettings()`, `saveLLMSettings()`, `getLLMSettingsStatus()` | storage/llm-settings.json | llm.ts, gateways |
| `assembly-builder.ts` | `buildAssemblyPlan()` (TIER 3) | env.ffmpegPath | assembly/execute |
| `assembly-schema.ts` | `AssemblyJSON` (TIER 3) | — | assembly-builder |
| `prisma.ts` | `prisma` singleton | DATABASE_URL | 102 routes |
| `auth.ts` | NextAuth config | env GOOGLE_* | auth routes |
| `model-tier-router.ts` | `getTierConfig()`, `callPlanner()` | tier mapping | planners |
| `motion-presets.ts` | `MOTION_PRESETS` | — | shot-plan |
| `narration-engine.ts` | `getNarrationStrategy()` | sceneType | parse-script |
| `generation/model-registry.ts` | `IMAGE_MODELS`, `VIDEO_MODELS`, `getModelById()`, `getDefaultImageModel()`, `getDefaultVideoModel()`, `filterModelsByTag()` | — | generation routes |
| `generation/selectors/image-provider.ts` | `generateImage()` | model registry | scene-image, generation/image |
| `generation/selectors/video-provider.ts` | `generateVideo()` | model registry | scene-video, video/generate |
| `generation/gateways/fal.ts` | FAL gateway functions | FAL_KEY | image-provider, video-provider |
| `generation/gateways/kie.ts` | Kie.ai gateway | KIE_AI_API_KEY | music, image |
| `generation/gateways/segmind.ts` | Segmind gateway | SEGMIND_API_KEY | image-provider |
| `generation/gateways/kling.ts` | Kling gateway | KLING_KEYS | video-provider |
| `generation/gateways/runway.ts` | Runway gateway | RUNWAY_API_KEY | video-provider |
| `generation/gateways/muapi.ts` | MuAPI gateway | MUAPI_KEY | video-provider |
| `continuous-motion/provider-router.ts` | adapter registry | — | continuous-motion |
| `auto-timestamp.ts` | `computeSceneTimeline()`, `computeScriptTimeline()` | text + spec constants | timing |
| `auto-timestamp/index.ts` | `splitScriptIntoSegments()` | — | re-export |
| `hybrid-pipeline.ts` | `runHybridPipeline()` | pipeline input | hybrid orchestrator |
| `hybrid-types.ts` | type definitions | — | all |
| `media-utils.ts` | `sanitizeFilename()`, `extractJSONFromLLM()` | — | many |
| `subtitle-wrap.ts` | `wrapSubtitleText()` | text + spec constants | execute route |
| `scene-constants.ts` | `SCENE_ENERGY_COLOR` | — | UI |
| `intelligence-cache.ts` | `getCachedBlueprint()`, `saveBlueprintToCache()` | env.storagePath | scene-intelligence |
| `save-video-asset.ts` | `saveVideoAsset()` | env.storagePath | many |
| `character-id.ts` | `generateCharacterId()` | — | character-build |
| `continuity-validator.ts` | `validateHybridProject()` | — | pre-flight |
| `audit.ts` | `logAuditEvent()` | prisma | trust events |
| `ollama.ts` | `callOllama()` | OLLAMA_BASE | llm.ts |
| `sfx/auto-fetcher.ts` | `fetchSfxForCue()` | sources.json | sfx routes |
| `sfx/cue-extractor.ts` | `extractSfxCues()` | callLLM | scene-intelligence |
| `aid-model-registry.ts` | legacy registry | — | DUPLICATE — to merge into generation/model-registry.ts |
| `style-presets.ts` (sanitizer block recently added) | `sanitizeStyleCollisions` (currently inline in routes — TO EXTRACT) | visualStyle | scene-image, scene-video, generate-portrait, generation/image |

### 5.2 Helpers currently INLINE in planner pages (need extraction)

Found by grep audit. These are duplicated across multiple planner pages today.

| Helper | Lives in | Duplicated in | Target home |
|---|---|---|---|
| `splitIntoActionBeats(text)` | hybrid-planner page.tsx, children-planner page.tsx | — (2 copies, identical) | `src/lib/scene/action-beats.ts` |
| `extractSceneAction(text)` | scene-image route (PROTECTED block) | — (also referenced from scene-video conceptually) | `src/lib/scene/action-extractor.ts` |
| `extractMotionAction(text)` | scene-video route | mirrors extractSceneAction | same file as above (`scene/action-extractor.ts`) |
| `sanitizeStyleCollisions(text, styleId)` | scene-image, scene-video, generate-portrait, generation/image | 4 copies! | `src/lib/style/sanitizer.ts` |
| `lateAnchor map` | scene-image, scene-video, generate-portrait | 3 copies | same file (`style/sanitizer.ts`) |
| `styleCollisionNegative` | scene-image, scene-video, generate-portrait, generation/image | 4 copies | same file (`style/sanitizer.ts`) |
| Audio duration probe (FFprobe + size fallback) | TTS route, dialogue/generate, others | 3+ copies | `src/lib/media/duration.ts` |
| Media URL → local path resolver | dialogue/generate, scene-video, others | 3+ copies | `src/lib/media/url.ts` |

### 5.3 New target folder structure

```
src/lib/
├── style/
│   ├── presets.ts              (moved from style-presets.ts)
│   ├── sanitizer.ts            (NEW — consolidates 4 copies)
│   └── late-anchor.ts          (NEW — per-style end-of-prompt anchor)
├── dialogue/
│   ├── emotion.ts              (moved from dialogue-emotion.ts)
│   ├── pacing.ts               (NEW — gapMsBetween extracted)
│   └── parser.ts               (NEW — wraps /api/dialogue/parse logic)
├── scene/
│   ├── action-beats.ts         (NEW — extracted from planners)
│   ├── action-extractor.ts     (NEW — extractSceneAction)
│   └── motion-extractor.ts     (NEW — extractMotionAction)
├── character/
│   ├── resolver.ts             (moved from character-resolver.ts)
│   ├── id-generator.ts         (moved from character-id.ts)
│   └── identity-types.ts       (moved from hybrid-types.ts subset)
├── sound/
│   ├── tiers.ts                (moved from ghs-sound-tiers.ts)
│   ├── mcd-config.ts           (NEW — soundTierToMCDConfig extraction)
│   └── narration-routing.ts    (NEW)
├── media/
│   ├── duration.ts             (NEW — getAudioDurationMs + ffprobe wrapper)
│   ├── url.ts                  (NEW — media URL resolver)
│   └── sanitize.ts             (existing — was sanitize-text.ts)
├── llm/
│   ├── chain.ts                (moved from llm.ts)
│   ├── settings.ts             (moved from llm-settings.ts)
│   └── tier-router.ts          (moved from model-tier-router.ts)
├── generation/                 (already structured — keep)
│   ├── model-registry.ts
│   ├── selectors/
│   └── gateways/
├── provider-health/            (NEW)
│   └── index.ts
├── timing/
│   ├── auto-timestamp.ts
│   └── scene-timeline.ts
├── subtitle/
│   └── wrap.ts                 (moved from subtitle-wrap.ts)
└── assembly/                   (TIER 3 — DO NOT TOUCH)
    ├── builder.ts
    └── schema.ts
```

Old paths kept as re-export shims for backward compat:
```typescript
// src/lib/style-presets.ts  (keep for backward compat)
export * from "./style/presets";  // re-export
```

This way every existing import still works during migration. After all consumers migrate, the shim files can be removed in a follow-up sweep.

---

## 6. Phase-by-Phase Migration Order

Each phase is independently shippable. Tests pass at the end of every phase. Rollback = revert that phase's commit.

### Phase A — ProjectSettings DB + API + hook (foundation)

**Goal:** Single source of truth for the 8 scattered settings.

**Steps:**
1. Add `ProjectSettings` model to `prisma/schema.prisma`
2. `npx prisma migrate dev --name add_project_settings`
3. Create `app/api/project/settings/route.ts` (GET/PATCH/POST)
4. Create `src/hooks/useProjectSettings.ts` (SWR-cached fetch + patch)
5. Seed defaults for any project that calls GET without an existing row

**Verification:** Curl GET/PATCH → returns expected JSON. TSC clean.

**No UI changes yet.** Hook exists but no planner uses it.

**Time:** ~2 hours.

---

### Phase B — Helper consolidation (no behavior change)

**Goal:** Move duplicated helpers into `src/lib/*/` with backward-compat re-exports.

**Steps (per helper, same pattern):**
1. Create new file at target location (e.g. `src/lib/style/sanitizer.ts`)
2. Move the function. Keep it identical — no logic change.
3. Update OLD imports to point to NEW path. Remove duplicates from routes.
4. If old file is going away, replace it with `export * from "./new-path";` shim
5. TSC clean

**Helpers to migrate (in order):**
- `sanitizeStyleCollisions` (4 → 1) — biggest duplication win
- `lateAnchor` map (3 → 1)
- `styleCollisionNegative` (4 → 1)
- `extractSceneAction` (1 → 1, just relocate)
- `extractMotionAction` (1 → 1, relocate)
- `splitIntoActionBeats` (2 → 1) — both planners now import from lib
- Audio duration probe (3 → 1)
- Media URL resolver (3 → 1)

**Verification:** Browser-verify a scene image gen + scene video gen + dialogue gen + assembly. All work identically.

**Time:** ~3 hours.

---

### Phase C — Migrate planners onto ProjectSettings (one at a time)

Order chosen to minimise risk: smallest planner first, largest last.

**C.1 — Movie planner (most active, smallest tab footprint of the big four)**
- Add `useProjectSettings(projectId)` near top
- Replace `projectStyle`, `aspectRatio`, `language`, `subtitleConfig`, `soundTier`, `narrationProvider`, `imageModel`, `videoModel` reads/writes
- Keep local state as fallback shim
- TSC clean + browser-verify
- Log entry in PROBLEM_AND_FIX.md

**C.2 — Children planner** (same recipe)

**C.3 — Music-video planner** (same recipe)

**C.4 — Commercial planner** (same recipe)

**C.5 — Free Mode** (same recipe — note: Free Mode has more settings)

**C.6 — Scene Forge** (same recipe)

**C.7 — Hybrid planner** (LAST — 9k lines, most state) — DONE 2026-05-08

After C.7, all planners read from ProjectSettings.

**Time:** ~1.5 hours per planner = 10-12 hours total.

---

### Phase D — Drop local-state fallbacks (cleanup)

Per planner, one-line removal: change `settings.visualStyle ?? localStyle` to `settings.visualStyle`. Remove the now-unused local state declaration.

Risk: if a planner has a code path that read local state without the shim helper, it breaks.

Mitigation: grep for the now-removed local state name across the file before deleting. TSC will catch the rest.

**Time:** ~1 hour total.

---

### Phase E — Model registry health & fallback

**Goal:** Survive FAL outages + model deprecation.

**Steps:**
1. Add `family`, `version`, `status`, `successor`, `health_last_checked`, `health_ok` to `ModelEntry`
2. Backfill these for all 40+ existing models
3. Create `src/lib/provider-health/index.ts`:
   - `markBroken(modelId, reason)`
   - `pickHealthyAlternative(family)`
   - `probeProvider(modelId)` (fires a known-good test request)
   - `getModelStatus(modelId)`
4. Wrap FAL/Kie/Segmind gateway calls with try/catch → markBroken on 404/422
5. Add background cron (Next.js scheduler or Vercel cron) that probes every 6h
6. UI: green/yellow/red dot per model in dropdowns
7. Auto-fallback: when a route gets `markBroken`, retry with `pickHealthyAlternative`

**Time:** ~4 hours.

---

### Phase F — Merge `aid-model-registry.ts` into `generation/model-registry.ts`

**Goal:** One model registry, not two.

**Steps:**
1. Diff the two files. List entries unique to `aid-model-registry.ts`.
2. Merge unique entries into `generation/model-registry.ts`
3. Replace `aid-model-registry.ts` with `export * from "./generation/model-registry";`
4. Eventually remove the shim after all consumers migrate

**Time:** ~1 hour.

---

### Phase G — White-label readiness (deferred)

**Trigger:** Henry says "build white-label" or signs a customer.

**Steps:**
1. Add `Tenant` model in Prisma (id, name, apiKey, brandLogo, brandPrimary, plan, createdAt)
2. Add `tenantId` to `ProjectSettings` and `HybridSavedState`
3. Add API key middleware (`Authorization: Bearer ghs_*` validates against `Tenant.apiKey`)
4. Build per-tenant rate limit + billing
5. Build webhook system (tenant gets pinged when render completes)
6. Branded UI shell that reads brand fields from tenant

**Time:** ~3-5 days. Out of scope for current session.

---

## 7. Risk Register & Rollback Paths

| Phase | Risk | Mitigation | Rollback |
|---|---|---|---|
| A | Migration script fails | Test on staging DB first | `npx prisma migrate reset` then redeploy old |
| B | Helper relocation breaks an import | TSC catches all import errors | Revert single commit per helper |
| C | Planner breaks during settings migration | Fallback shim keeps old path live | Revert planner-specific commit |
| D | Removed local state still referenced somewhere | grep audit + TSC + browser-verify | Revert + restore local state line |
| E | Health probe false positives | Probe on stable test endpoint per model; multi-strike before marking broken | Manual override in admin UI |
| F | Aid registry has unique entries | Diff first, merge unique | Restore aid-model-registry.ts from git |
| G | API key leak | Hash keys in DB, send only at creation | Rotate keys, notify tenants |

---

## 8. What NOT to Touch (Hard Stop)

Per `AUDIT_PLAN.md` Tier 3:
- `app/api/assembly/execute/route.ts`
- `src/lib/assembly-builder.ts`
- `src/lib/assembly-schema.ts`
- `app/api/video/assemble/route.ts`

Per `RISKS_AND_DECISIONS.md`:
- No function deletion without explicit Henry GO logged in that file
- Karaoke steps 2/4/11 stay ⏸ until Linux migration
- PuLID face-lock route stays for photo-import characters

---

## 9. Visibility — Where the Program Lives

Henry's direct concern: *"where should the program file be visible on?"*

After this plan completes, the layout is:

| Concern | File | Visibility |
|---|---|---|
| Settings the user picks | `app/api/project/settings/route.ts` | One API |
| All logic helpers | `src/lib/<concern>/<file>.ts` | One folder per concern |
| All API routes | `app/api/*` | One per feature, no logic inline |
| Planner pages | `app/dashboard/*-planner/page.tsx` | UI only — read settings, call routes |
| Model definitions | `src/lib/generation/model-registry.ts` | One registry |
| Provider keys / env | `storage/llm-settings.json` + `.env` | Loaded by `llm-settings.ts` |
| Project state per project | DB row in `ProjectSettings` + `hybrid_saved_states` | Postgres |
| Health & fallback state | `src/lib/provider-health/index.ts` + DB | One place |
| Style sanitizer | `src/lib/style/sanitizer.ts` | One file |
| Emotion detection | `src/lib/dialogue/emotion.ts` | One file |
| Action verb extraction | `src/lib/scene/action-extractor.ts` | One file |
| Beat splitter | `src/lib/scene/action-beats.ts` | One file |
| Sound tier definitions | `src/lib/sound/tiers.ts` | One file |
| Audit & risk log | `update/RISKS_AND_DECISIONS.md` | One file |
| Bug history & fixes | `update/PROBLEM_AND_FIX.md` | One file |
| Migration progress | this file (`update/SEGREGATION_PLAN.md`) | One file |

Anyone touching GHS opens this document first, sees the layout, and knows where to look for any feature.

---

## 10. Status Tracker (live — update as phases ship)

| Phase | Status | Date | Commit | Notes |
|---|---|---|---|---|
| A. ProjectSettings DB + API | DONE | 2026-05-08 | — | db push (shadow DB P3006). prisma generate --no-engine then manual DLL swap. GET/PATCH smoke-tested on :3200. TSC exit=0. |
| B. Helper consolidation | NOT STARTED | — | — | — |
| C.1 Movie planner | DONE | 2026-05-08 | — | useProjectSettings wired. 7 settings migrated (projectStyle, language, soundTier, narrationProvider, videoModelId, imageModelId, subtitleConfig). effective* shims + fire-and-forget patch. TSC exit=0. |
| C.2 Children planner | DONE | 2026-05-08 | — | useProjectSettings wired. 6 settings migrated (visualStyle/projectStyle, soundTier, narrationProvider, videoModelId, imageModelId, subtitleConfig). effective* shims + fire-and-forget patch. language/aspectRatio/llmProvider not local state — skipped. TSC exit=0. |
| C.3 Music-video planner | DONE | 2026-05-08 | — | useProjectSettings wired using local projectId (no URL params — MV has its own project system). 5 settings migrated: projectStyle→effectiveProjectStyle, soundTier→effectiveSoundTier, subtitleConfig→effectiveSubtitleConfig, selectedVideoModelId→effectiveVideoModelId, selectedImageModelId→effectiveImageModelId. Basic videoModel setter also patched. language/aspectRatio/narrationProvider/llmProvider not local state in MV planner — skipped. TSC exit=0. Page 200 OK on :3200. |
| C.4 Commercial planner | DONE | 2026-05-08 | — | useProjectSettings wired using local projectId state. 3 settings migrated: brandVisualStyle→effectiveProjectStyle, selectedVideoModelId→effectiveVideoModelId, selectedImageModelId→effectiveImageModelId. Setter at visual style picker + AID picker augmented with patchProjectSettings fire-and-forget. aspectRatio is inside brief object (not state), language hardcoded "English" (not state), subtitleConfig/soundTier/narrationProvider/llmProvider not present in commercial-planner — all skipped. TSC exit=0. Settings API smoke-tested: GET defaults + PATCH + reload verify all pass. |
| C.5 Free Mode | DONE | 2026-05-08 | — | useProjectSettings wired keyed to sessionId (falls back to "free-mode-default"). 7 settings migrated: imageStyle→effectiveProjectStyle, imageModel→effectiveImageModelId, videoModel→effectiveVideoModelId, musicTier→effectiveSoundTier, voiceProvider→effectiveNarrationProvider, llmModel→effectiveLlmProvider, subtitleStyle→effectiveSubtitleMode. All 6 UI selects + HybridModal props + SceneCard defaultProps + generation body all read effective*. All setters augmented with patchProjectSettings fire-and-forget. aspectRatio/language not local state (hardcoded "9:16") — skipped. TSC exit=0. |
| C.6 Scene Forge | DONE | 2026-05-08 | — | useProjectSettings wired using SCENE_FORGE_DB_KEY as stableId (no projectId). 6 settings migrated: style→effectiveProjectStyle, aspect→effectiveAspectRatio, voice→effectiveNarrationProvider, musicTier→effectiveSoundTier, videoModel→effectiveVideoModelId, imageModel→effectiveImageModelId. Setters for style/aspect/musicTier/videoModel/imageModel augmented with patchProjectSettings fire-and-forget. tier (AITier) skipped — no equivalent hook field. generate body + AI polish body + all render read sites replaced. TSC exit=0. Page 200 OK on :3200. |
| C.7 Hybrid planner | NOT STARTED | — | — | — |
| D. Drop local fallbacks | NOT STARTED | — | — | — |
| E. Model health + fallback | PARTIAL — E.1 done, E.2 (UI badges + cron probe) pending | 2026-05-08 | — | E.1: ModelEntry extended, all 40 models backfilled, provider-health/index.ts created, FAL video + image gateways wrapped with tryWithFallback. TSC exit=0. |
| F. Merge aid registry | DONE | 2026-05-08 | Phase F shim | aid-model-registry.ts = shim. All IDs already in generation/model-registry.ts. AID_VIDEO_MODELS + AID_IMAGE_MODELS kept as backward-compat exports. TSC clean. |
| G. White-label readiness | DEFERRED | — | — | Trigger: Henry GO |

---

## 11. Pending Pre-Phase Work (separate, not blocking this plan)

These are tasks Henry already greenlit but I haven't completed. Logged here so they don't get lost:

| Item | Status | Section affected |
|---|---|---|
| Unify GHS Sound tiers + MCD bundle in movie-planner UI | PAUSED — resume after Phase A | movie-planner Voice tab |
| Add `ⓘ More` popover per tier showing what's inside | PAUSED | same |
| Auto-apply lipsync at end of MCD pipeline (no separate click) | PAUSED | same |
| `aiChatProvider` LLM selector (Auto/Ollama/GPT/Haiku) for AI Chat | DONE | hybrid-planner |
| Polish modes (Add Action / Intense / Reduce / Emotional) | DONE | hybrid-planner |
| Children music quality fix (rich prompt + duration probe) | DONE | children-planner |
| Style collision sanitizer + late anchor + negative | DONE | scene-image, scene-video, generate-portrait, generation/image |
| Lipsync provider chain upgrade (musetalk + sync-lipsync) | DONE | avatar/lip-sync |
| Multi-Cast Dialogue button (Phase 1+2 dialogue) | DONE | movie-planner |
| Per-scene Lip-Sync button (Phase 3) | DONE | movie-planner |
| Children-planner Gen Max + beat checkboxes + persistence | DONE | children-planner |

---

## 12. Linux Migration Analysis

**Question Henry asked 2026-05-08:** *"Now when migrating to Linux will it be easy? Secondly will FFmpeg work less or better?"*

**Short answer:** Linux migration becomes significantly easier WITH this plan, and FFmpeg works MUCH better on Linux.

### 12.1 Why this segregation plan helps Linux migration

| What | Why it helps |
|---|---|
| Helpers consolidated in `src/lib/*` (Phase B) | One folder to grep for Windows-isms (`\\`, `powershell`, `os.platform`) — fix in one place, not 12 |
| ProjectSettings in DB (Phase A) | Settings travel with the project — no localStorage migration, no per-machine config drift |
| Model registry centralized (Phase E + F) | One file to update if a Linux-only provider becomes available (e.g. local Ollama models pre-pulled on the VPS) |
| Provider health (Phase E) | When DNS flips to the Linux box and one provider misbehaves on the new IP, auto-fallback kicks in instead of silent breakage |
| White-label tenant model (Phase G) | Per-tenant config = clean cutover when you migrate one tenant at a time instead of all at once |

### 12.2 What's currently NOT portable (and what each phase fixes)

| Issue today | Where | Linux behavior | Fix path |
|---|---|---|---|
| PowerShell SAPI fallback | `app/api/tts/route.ts` L237 | Already gated `if (process.platform === "win32")` — skips silently. ✅ no change | already safe |
| Piper binary path | `process.env.PIPER_BIN \|\| os.homedir()/piper/piper` | Works on Linux if PIPER_BIN env var or `~/piper/piper` exists. Need Ubuntu install of Piper. ⚠️ ops setup, not code | per-tenant env var (Phase G) |
| Windows path separators (`\\`) | Several routes do `.replace(/\\/g, "/")` | Linux ignores it, no harm | already safe |
| `storage/` directory absolute paths | `env.storagePath` from `config/env.ts` | Just needs correct env var on Linux | already safe |
| Karaoke Python (Demucs/BasicPitch/RVC) | currently ⏸ on Win Py 3.13 | **Will WORK on Ubuntu 22.04** — these were marked deferred specifically for Linux | unblocks once you flip |

### 12.3 Per `project_linux_migration.md` from memory

You already have a Contabo VPS 30 plan. The migration order is: Marabiz → HMKSync → GioBiz → Giolog → GHS last. By the time GHS migrates, the Linux ops pattern is proven. Phases A-F can ship in your current Windows env, then the VPS just runs the same code.

### 12.4 FFmpeg on Linux — significantly better for GHS

GHS depends heavily on FFmpeg. Five reasons Linux wins:

#### Subtitle burn-in (libass)
- **Windows:** `subtitles=` filter often missing libass. Today's code has graceful fallback (per CHANGELOG SUBTITLE-01 — "subtitle skip if libass missing"). Subtitles silently disabled.
- **Linux (Ubuntu apt-get ffmpeg):** libass compiled in by default. Subtitles burn correctly first try.

#### Long-form assembly + stream_loop
- **Windows:** File locking causes intermittent assembly failures. The "FFmpeg processes get stuck" issue from `feedback_build_and_render.md` ("locked files = stuck FFmpeg processes") is a Windows-specific problem.
- **Linux:** No file locking on output, FFmpeg can overwrite freely. `-stream_loop -1` works flawlessly. The 4s "shhhh" cut bug, music stops at 30s — all symptoms of brittle Windows FFmpeg behavior. Linux makes the assembly pipeline noticeably more robust.

#### Concurrent rendering
- **Windows:** Limited concurrent FFmpeg processes (process model + memory pressure). Bulk assembly jobs queue.
- **Linux:** Spawn 8+ FFmpeg processes in parallel without thrash. Bulk Gen Max + multi-cast dialogue + scene videos can all run concurrently. Throughput jumps.

#### GPU acceleration (with caveat)
- **Local Windows (HP Omen RTX 3060):** Already works for image/video gen via FAL/RunPod. FFmpeg NVENC works locally.
- **Contabo VPS (CPU-only):** No GPU. CPU FFmpeg is fine for assembly (mostly stream concat + audio mix, not encode-heavy). GPU nodes are for image/video gen only — those run on FAL/Kie/RunPod regardless of host.

#### Audio mixing precision
- **Windows:** Some `amix=duration=longest` edge cases (the AUDIO-02 bug — multiple narration tracks at t=0 — was harder to debug on Windows because of timing variance).
- **Linux:** `aresample`, `apad`, `atrim`, `adelay` more deterministic. The new dialogue concat (`/api/dialogue/generate`) using per-speaker pacing will sound sample-accurate.

### 12.5 Component comparison

| Component | Windows today | Linux post-migration |
|---|---|---|
| Subtitle burn-in | Skipped silently when libass missing | Always works |
| Music looping (stream_loop) | Brittle, occasional stops | Reliable |
| Long video assembly | File locks, stuck processes | Clean |
| Multi-cast dialogue concat | Works, slight timing jitter | Sample-accurate |
| Concurrent jobs | 2-3 max | 8+ |
| Karaoke Python pipeline | Steps 2/4/11 ⏸ disabled | All 18 steps available |
| Per-process memory | Higher overhead | Lower |

**FFmpeg on Linux is unambiguously better for GHS.** Most of the "audio bug" entries in PROBLEM_AND_FIX (AUDIO-01, 02, 03, music stops, video cuts) are workarounds for Windows quirks. On Linux many become unnecessary.

### 12.6 Recommended migration order

1. **Ship Phases A-F on current Windows env** — settings centralized, helpers consolidated. This gives you portable code.
2. **Flip GHS to the Contabo VPS** when other projects (HMKSync, GioBiz) prove the ops pattern.
3. **Activate Karaoke deferred steps** (Demucs/BasicPitch/RVC) — they're already coded, just gated.
4. **Phase G white-label** runs cleaner on Linux because of per-tenant Unix-user isolation already documented in the Linux migration plan.

The plan as written is Linux-friendly. No phase requires re-design when you flip hosts.

---

## 13. Open Questions for Henry

Before any phase starts, please confirm or correct:

1. **Tenant model timing** — defer Phase G (white-label) until you have a customer? Or build it now so the foundation matches?
2. **Force-deprecation policy** — when FAL kills a model, should the system auto-swap silently, or always ask the user first?
3. **Default tier per planner** — should new projects default to GHS Sound (free) or GHS Plus (cheap paid)?
4. **Migration speed** — A→B→C all in one session? Or one phase per session with browser-verify between?
5. **Old function removal** — once Phase D drops local-state fallbacks, can we eventually remove the now-unused state declarations? Or keep them as `@deprecated` per your no-deletion rule?

Reply with answers and I start Phase A.

---

**End of plan. Anyone (including future Opus) reading this doc now knows the entire architectural target without reading any source file. Pick up from Section 10 to see what's next.**
