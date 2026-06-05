# GioHomeStudio — Key Files Index

Annotated index of the most important source files. Reading order hints are included per section.
Grouped: Pages → API routes → Lib → Config.

---

## Pages

### `app/dashboard/hybrid-planner/page.tsx`
**~13,500 LOC — the largest file in the project. The mature reference planner.**

Owns the full 9-tab Hybrid Planner workflow: Story → Characters → Scenes → Sound → Assembly → Overview → Trends + Screenplay + Establishing Shots. Contains the canonical implementations of: story expansion, character extraction + ethnicity pipeline, scene image generation with PuLID face-lock, narrator/actor audio coordination, establishing shots, subtitle styling, pacing engine, project save/restore, AI chat, and scene QC.

All other planners (Children, Movie, Commercial, Music Video) mirror patterns from this file. **Do not modify without understanding the full state machine and without explicit approval.** Changes here propagate assumptions to 5+ planners.

Read this file before writing any new planner feature. Look at `assembleScenes()` (line ~4400), `restoreState()` (line ~4062), and the `effectiveSubtitleConfig` shim pattern before touching the children planner.

---

### `app/dashboard/children-planner/page.tsx`
**~8,400 LOC — god-file, pending segregation. Children content planner.**

Owns the children video planner: story prefill with AI, educational mode routing, scene board, establishing shots, audio plan, pacing engine, subtitle assembly, and project persistence. Uses `/api/video/assemble` (legacy endpoint) rather than `/api/assembly/execute` (hybrid's endpoint) — this is the single remaining parity gap.

Contains several pattern copies from `hybrid-planner/page.tsx` adapted for children content: age-safe vocabulary, `pickPiperVoice()` by `learningMode`, auto-narration before assembly, `assemblySelectedIds` restore on project load.

Read the hybrid planner first to understand the original pattern, then read this file for the children-specific adaptations.

---

### `app/dashboard/free-mode/page.tsx`
**~3,200 LOC — open-ended chat-driven scene generator.**

Accepts natural-language descriptions, enhances them via LLM, routes to the image/video generation pipeline. Contains `useProjectSettings` integration, per-session state keyed to `sessionId`, and the `HybridModal` component for generation options.

Lighter than the planners — a good entry point for understanding how individual generation calls work before tackling the full planner stack.

---

## API routes

### `app/api/tts/route.ts`
**Single dispatcher for all 9 voice providers.**

Provider cascade order: Piper → Edge-TTS → gTTS → FAL F5-TTS → FAL XTTS → FAL Bark → FAL Gemini TTS → FAL Kokoro → ElevenLabs. Falls back to `engine="placeholder"` (30s silent MP3) if all tiers fail.

Critical rules:
- The placeholder branch must NEVER be silently returned — clients must reject `engine==="placeholder"`.
- Piper timeout scales: `clamp(60_000, 600_000, text.length * 500)` ms.
- Voice resolution uses `PIPER_VOICES_DIR` env first, then a 4-path candidate list.
- Every tier must `console.error` the actual failure reason (no silent `catch {}`).

Read before touching any narration or TTS call site.

---

### `app/api/video/assemble/route.ts`
**Legacy FFmpeg pipeline: scene concat → audio mix → caption overlay → bumper concat.**

Used by children-planner, movie-planner, commercial-planner, and auto-creator. (Hybrid uses `/api/assembly/execute` instead.) Key functions: `generateSubtitlePng()`, `perSceneFontSize` computation, `drawtext` fallback with 12 subtitle modes (`dance_word / rainbow / bubble_pop / big_friendly / mrbeast_single / yellow_sweep / glow_pop / typewriter / highlight / kids / dramatic / social`), narration fallback chain via `fallbackNarrUrl`.

ASS subtitle path uses `DejaVu Sans` as the default font (not `Arial Black` — that is not installed on Linux). ASS timeout is 600s. Drawtext fallback preset is `ultrafast`.

---

### `app/api/assembly/execute/route.ts`
**Hybrid FFmpeg pipeline — the production-quality assembly endpoint.**

Used exclusively by the hybrid planner. Emits NDJSON heartbeats every 25s (to survive Cloudflare's 100s edge timeout). Owns: full ASS subtitle generation with `PlayResX:1920 / PlayResY:1080` header, per-word subtitle animations via `SUBTITLE_PRESETS` map (8 modes + 5 legacy), narrator/actor coordination via `computeNarratorWindows()`, `mapPool` bounded to 4 concurrent ffmpeg processes.

Protected expressions that must not be changed:
- `amix=duration=longest:normalize=0`
- `-stream_loop -1` on video in `final_merge`
- `atrim` ordering
- Windows `fontfile` colon escape pattern

---

### `app/api/free-mode/chat/route.ts`
**Free Mode LLM dispatcher.**

Accepts a user message, routes to the configured LLM provider via `src/lib/llm.ts`, returns an enhanced scene prompt. Entry point for understanding how the LLM routing layer is called in a simple single-turn context before studying the full planner stack.

---

### `app/api/hybrid/scene-image/route.ts`
**Central scene image generation route — FAL FLUX / Segmind / Kling / PuLID.**

Owns the prompt construction pipeline: `resolveCharacterTokens()` → `sanitizeStyleCollisions()` → `extractSceneAction()` → `sanitizeNarrativeJargon()` → model dispatch. PuLID face-lock fires when a portrait URL exists. Anti-bear-head fix lives here (3 sites — use affirmative human descriptions, no "NOT a bear" negations in positives).

Contains `resolvePublicPortraitUrl()` — uploads local `/api/media/...` portraits to FAL CDN for PuLID. FAL CDN URLs expire in ~3h; never store them as persistent URLs.

---

## Lib

### `src/lib/voice-registry.ts`
**Single source of truth for 30 voices across 5 tiers.**

Maps voice IDs to provider, tier, language, gender, and display name. All TTS call sites should look up voice metadata here rather than hard-coding provider-specific values.

---

### `src/lib/ghs-sound-tiers.ts`
**4-tier sound bundle definitions.**

Defines the Standard / Plus / Pro / Premium tier bundles combining narration provider + music source + dialogue engine + lipsync engine. Read before adding new TTS or music providers to understand tier assignment.

---

### `src/lib/generation/gateways/tts.ts`
**TTS gateway scaffold — Phase 1 architecture.**

Defines the typed interface that all TTS provider adapters implement. New providers should implement this interface rather than adding ad-hoc code to `/api/tts/route.ts`.

---

### `src/lib/generation/gateways/fal.ts`
**FAL gateway — all FAL API calls.**

Provides `falCall<T>()`, `falQueue<T>()`, `falFluxSchnell()`, `falFluxDev()`, `falKokoroTts()`, `falBgRemove()`, `falMinimaxMusic()`, `falStableAudio()`, `falAccountStatus()`, and more. 17 of 24 FAL call sites have been migrated here; 7 remain on direct axios (see `update/FAL_ADAPTER_MIGRATION_MAP_05302026.md`).

All new FAL calls must go through this file — never add raw `fetch` or axios calls to FAL in page or route files.

---

### `src/lib/llm.ts`
**Multi-provider LLM router: Claude / GPT / Grok / Ollama / Kie.**

Accepts a `provider` slug and normalizes it to the correct SDK call. Handles: Anthropic with prompt caching, OpenAI, xAI Grok, Ollama (with 300s timeout for large models), and Kie.ai. Falls back Claude → OpenAI → Ollama when a provider fails.

Read before writing any LLM-calling route. Never call `Anthropic()` or `OpenAI()` directly in a route file — use this router.

---

### `src/lib/llm-cache.ts`
**Semantic LLM cache — deterministic hash, 14-day TTL.**

Caches LLM responses keyed on `(provider, model, prompt hash)`. Used by story expansion and scene intelligence to avoid re-running identical LLM calls. Check this file if you see stale generation results after changing a prompt.

---

### `src/lib/user-tier.ts`
**Free / paid / admin tier helper.**

Returns the current user's tier for gating premium features (Max image mode, premium voice tiers, commercial music). All tier checks should go through this helper. Do not gate features on raw `process.env` checks.

---

### `src/lib/assembly-builder.ts`
**Assembly plan builder + narrator/actor coordination.**

Exports `buildAssemblyPlan()` and `computeNarratorWindows()`. The `computeNarratorWindows()` helper is consumed by BOTH the audio duck path in `buildAssemblyPlan` and `buildSubEntries()` in `app/api/assembly/execute/route.ts` — it must stay exported and must not be inlined.

---

### `src/lib/character-resolver.ts`
**Token resolution engine — resolves `[CH01]` tokens to character descriptions.**

`resolveCharacterTokens(sceneText, characterIds)` substitutes character tokens in scene text with their visual descriptions and attaches reference portrait URLs. Used by `scene-image/route.ts` before prompt construction. Read `character-resolver.ts:99` for the implementation — it was fully built but not wired into scene-image until commit `4ba3959`.

---

## Components

### `app/components/VoiceTierSelector.tsx`
**Canonical voice picker UI.**

Used by all planners. Renders tiered voice options with provider labels (shown as branded GHS tiers, never raw model names). Any change to voice tier display must go through this component.

---

### `app/components/SubtitleStyler.tsx`
**Subtitle style configuration UI.**

Renders the 8 subtitle mode buttons (Dance Word / Rainbow / Bubble Pop / Big Friendly / MrBeast Single / Yellow Sweep / Glow Pop / Typewriter) + 5 legacy modes (Highlight / Kids / Dramatic / Social / Minimal) + color pickers + font size picker. State flows through `subtitleConfig` → `effectiveSubtitleConfig` → assembly payload.

---

## Config

### `instrumentation.ts`
**Sentry boot hook.**

Initializes Sentry error tracking on server boot. DSN comes from `SENTRY_DSN` env. If Sentry is not configured, errors are still logged to `console.error` but not collected. Run `pnpm add @sentry/nextjs` if the SDK is missing.

---

### `middleware.ts` (or `proxy.ts`)
**Site-wide cookie lock and auth middleware.**

Enforces session cookie requirements before serving any dashboard route. Check this file if any dashboard page is unexpectedly accessible without authentication, or if cookies are not being set correctly after login.

---

### `prisma/schema.prisma`
**Single source of truth for 64 Prisma models.**

Key model groups:
- User, Session, Account — auth
- ContentItem, AdAsset, SoundAsset, AssemblyRecord — content
- CharacterVoice, CharacterIdentity — character system
- LlmCache — semantic cache (14-day TTL)
- ProjectSettings — per-project settings sync across planners
- hybrid_saved_states, StoryQCProject, StorySupervisorReport — planner persistence + QC
- KaraokeRecording — karaoke session storage (with `purgeAt` for 30-day biometric data expiry)

Run `npx prisma migrate dev` before adding new models. The schema is ahead of committed migrations in the current state.

---

## CI / Deploy

### `.github/workflows/ci.yml`
**CI on push to `main`, `staging`, and all PRs.**

Runs `pnpm install`, `tsc --noEmit`, and optionally the Playwright smoke tests. All pushes must pass typecheck before merging.

---

### `.github/workflows/deploy-staging.yml`
**Auto-deploy on push to `staging` branch.**

Triggers `pnpm build` on the staging server and restarts `ghs.service`. Use `staging` as the integration branch before promoting to production.

---

### `.github/workflows/deploy-prod.yml`
**Auto-deploy on tag matching `v*-stable`.**

Triggers on tags like `v2026-06-03-stable`. Runs `pnpm build`, restarts `ghs.service`, and sends a Telegram notification on success/failure. To deploy to production: push a tag matching `v*-stable`.
