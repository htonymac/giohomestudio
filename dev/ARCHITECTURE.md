# GioHomeStudio — Architecture Reference

## Stack overview

| Layer | Technology |
|---|---|
| Framework | Next.js 16.2.1 + React 19 (App Router, Turbopack) |
| Language | TypeScript 5.7 |
| Database | PostgreSQL + Prisma 5 ORM |
| Package manager | pnpm 9.15 |
| Media processing | FFmpeg (system binary), fluent-ffmpeg wrapper |
| Object storage | Local filesystem (dev + current prod) / Cloudflare R2 (migration pending) |
| TTS | Piper (local), Edge-TTS (cloud), FAL AI (cloud), ElevenLabs (cloud) |
| Image gen | FAL AI (FLUX, Ideogram, PuLID), Segmind, Kie.ai |
| Video gen | Kling AI (direct + via FAL), Runway, FAL Wan/Hailuo/LTX |
| LLM | Anthropic Claude, OpenAI GPT-4o, Grok, Ollama (local) |
| Error tracking | Sentry (`instrumentation.ts` + `sentry.{server,client,edge}.config.ts`) |
| Auth (site lock) | Custom cookie-based gate (`middleware.ts`) |
| Deployment | GitHub Actions → SSH → systemd `ghs.service` on Ubuntu VPS |
| CDN / Tunnel | Cloudflare Tunnel — maps `andiostudio.com` to `localhost:3200` on the server |

---

## 1. Request flow

```
Browser → Cloudflare Tunnel → Next.js App Router (port 3200)
                                       │
                    ┌──────────────────┴───────────────────┐
                    │ middleware.ts                          │
                    │ • Checks andio_access cookie           │
                    │ • Whitelists /_next, /unlock, /api/health
                    │ • Passes internal 127.0.0.1 requests  │
                    └──────────────────┬───────────────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    │ app/api/**/route.ts                   │
                    │ Server Components / Pages             │
                    └───────────────────────────────────────┘
```

`middleware.ts` (root level) is the only auth guard currently. It runs on every non-static request. APIs respond with 401 JSON; page requests redirect to `/unlock`.

**Internal server-to-server calls** (e.g. the assembly worker calling `/api/tts`) come from `127.0.0.1` and bypass the cookie check — this is intentional and documented at `middleware.ts:40`.

---

## 2. Tier system — GHS branding rule (HARD)

Real AI model names are **never** shown to end users. Every picker in every planner shows GHS tier labels only.

### LLM tiers (`lib/ghs-ai-tiers.ts`)

| GHS label | Internal provider |
|---|---|
| GHS Free | Ollama (local, no cost) |
| GHS Standard | Claude Haiku 4.5 |
| GHS Pro | Claude Sonnet 4.6 |

The `ghsTierToProvider()` function at `lib/ghs-ai-tiers.ts:48` is the canonical mapping. The LLM router `src/lib/llm.ts` accepts provider strings in the format `"claude:model-id"`, `"openai:model-id"`, `"ollama"`, `"grok:model-id"`, or `"auto"`.

### Voice tiers (`src/lib/voice-registry.ts`)

All voice definitions live in `VOICE_REGISTRY` (line 46). Every UI picker must import from this file — no hardcoded voice lists in pages. The `VoiceEntry` interface includes: `id`, `displayName`, `provider`, `modelId`, `tier`, `language`, `country`, `gender`, `pricePerMin`.

Tier labels:
- `standard` = Piper (free, local)
- `standard-plus` = Edge-TTS (free, cloud)
- `pro` = FAL F5-TTS / XTTS / Bark
- `premium` = FAL Gemini 2.5 Flash TTS
- `best` = ElevenLabs

### Sound bundle tiers (`src/lib/ghs-sound-tiers.ts`)

Each project-level sound tier bundles four sub-systems: narration TTS, music provider, multi-cast dialogue (MCD) TTS with emotion, and lip-sync model. One selector picks all four. Defined in `GHS_SOUND_TIERS` array (line 17). Tiers: `ghs-sound`, `ghs-plus`, `ghs-pro`, `ghs-premium`, `ghs-best`.

---

## 3. Provider domain split — `src/lib/generation/gateways/`

Each file in `src/lib/generation/gateways/` owns one provider domain. Callers import the gateway function, never raw HTTP:

| File | Covers |
|---|---|
| `fal.ts` | FAL AI — image gen, video gen, TTS (Kokoro/F5/Gemini), lip-sync, bg-remove, upscale. Exports: `falCall<T>`, `falQueue<T>`, `falFluxSchnell`, `falFluxDev`, `falKokoroTts`, `falBgRemove`, `falFluxImg2Img`, etc. |
| `kling.ts` | Kling AI direct API (JWT auth, v2.5 / v1.5) |
| `runway.ts` | Runway Gen-4 direct API |
| `segmind.ts` | Segmind image gen |
| `kie.ts` | Kie.ai (Suno-based music gen + DeepSeek LLM) |
| `tts.ts` | TTS gateway helpers (Piper spawn, Edge-TTS fetch, etc.) |
| `muapi.ts` | MuAPI / SeedDance video gen |

Model metadata (IDs, families, fallback chains) lives in `src/lib/generation/model-registry.ts`. The `src/lib/provider-health/index.ts` module tracks runtime broken/healthy state per model and provides `pickHealthyAlternative(family, excludeId)` for auto-fallback.

---

## 4. LLM router — `src/lib/llm.ts`

Priority chain when `provider="auto"`:
1. Anthropic Claude (key: `ANTHROPIC_API_KEY`) — Haiku fast / Sonnet quality
2. OpenAI GPT (key: `OPENAI_API_KEY`) — gpt-4o-mini fast / gpt-4o quality
3. Grok xAI (key: `XAI_API_KEY`) — grok-3-mini / grok-3
4. Ollama (local, key: none) — model from settings
5. Rule-based fallback — returns empty, caller uses its own fallback

The `SELECTABLE_MODELS` array at `src/lib/llm.ts:44` is what the "Story AI Intelligence" picker in each planner renders. It includes `claude:claude-opus-4-6`, `claude:claude-sonnet-4-6`, `claude:claude-haiku-4-5-20251001`, `openai:gpt-4o`, `openai:o3-mini`, `openai:gpt-4o-mini`, `grok:grok-3`, `grok:grok-3-mini`, and `ollama`.

---

## 5. Storage layer — `src/lib/storage/`

`StorageProvider.ts` defines the interface. Two implementations:
- `LocalFsProvider.ts` — writes to `./storage/` (relative to app root). Active now (`STORAGE_PROVIDER=local`).
- `R2Provider.ts` — Cloudflare R2 via AWS SDK. Wired in but not active (Phase 3 migration pending).

Canonical key prefixes are defined in `STORAGE_PREFIXES` (`StorageProvider.ts:65`): `uploads`, `characters`, `stories`, `generated/images`, `generated/video`, `approved`, `archive`.

All routes **must** use `buildKey(prefix, ...parts)` to construct storage keys — no manual string concatenation.

The active provider is exported from `src/lib/storage/index.ts` and selected by the `STORAGE_PROVIDER` env var.

---

## 6. Database — Prisma schema

Main models in `prisma/schema.prisma`:
- `User` — auth, tier (FREE/STARTER/PRO/PREMIUM), credit balance, Paddle customer ID
- `Subscription` + `CreditTransaction` + `PaddleEvent` — billing ledger
- `hybrid_saved_states` — per-project JSON blob for all planners (shared across Hybrid, Children, Movie, etc.)
- `character_voices` — character identity: name, role, voice ID, portrait, visual description, skin tone
- `StoryQCProject` / `StoryQCContract` / `StoryQCDraft` / `CastMember` / `ScenePlan` / `SupervisorReport` — QC pipeline

Migrations live in `prisma/migrations/` as forward-only `NNNN_*.sql` files. Run `pnpm prisma migrate dev` to apply locally. Run `pnpm prisma migrate deploy` on the server.

---

## 7. API route structure

All routes under `app/api/`. Key ones:

| Route group | Purpose |
|---|---|
| `app/api/tts/route.ts` | 6-tier TTS dispatcher (Piper → Edge-TTS → FAL Kokoro → FAL Gemini → ElevenLabs → placeholder) |
| `app/api/video/assemble/route.ts` | Children/movie/commercial assembly — FFmpeg pipeline, subtitle burn-in, narration mix |
| `app/api/assembly/execute/route.ts` | Hybrid planner assembly — uses libass for subtitles, `assembly-builder.ts` for timing |
| `app/api/hybrid/scene-image/route.ts` | Image generation with character token resolution + style sanitization + PuLID face-lock |
| `app/api/hybrid/scene-video/route.ts` | Video generation with provider fallback |
| `app/api/hybrid/scene-edit/route.ts` | LLM-powered polish / break / expand operations |
| `app/api/hybrid/character-extract/route.ts` | LLM extraction of characters from story text + Option B ethnicity override |
| `app/api/hybrid/saved-state/route.ts` | CRUD for project JSON blobs (used by all planners) |
| `app/api/story/supervise/route.ts` | 23-supervisor QC pipeline via `runFullStoryQCPipeline()` |
| `app/api/storage/list` + `/delete` | Storage browser for audio/TTS/temp cleanup |
| `app/api/health/route.ts` | Health probe — returns 200 if DB reachable |
| `app/api/unlock/route.ts` | Sets `andio_access` cookie after correct `ACCESS_CODE` |

---

## 8. Auth — site-wide cookie lock

`middleware.ts` (root) implements a pre-route passphrase gate:
- `ACCESS_CODE` env var = the passphrase. If unset, lock is disabled entirely.
- Browser visits `/unlock`, submits passphrase, `/api/unlock` sets `andio_access` cookie.
- Every subsequent request is checked by the middleware.
- `next-auth` is in `package.json` for future per-user auth but is not active as of this writing.

---

## 9. Sentry error tracking

`instrumentation.ts` (root) is the Next.js server boot hook. It imports `sentry.server.config.ts` on `nodejs` runtime and `sentry.edge.config.ts` on `edge` runtime. `sentry.client.config.ts` handles the browser side.

The `onRequestError` export in `instrumentation.ts` catches errors from Server Components and Route Handlers and sends them to Sentry automatically.

**Note:** The Sentry `withSentryConfig` wrapper was removed from `next.config.ts` on 2026-06-05 due to a pnpm hoist issue causing build failures. The SDK itself still runs correctly via `instrumentation.ts`. Re-add the config wrapper when moving to `next build`.

---

## 10. CI/CD — GitHub Actions

Three workflow files in `.github/workflows/`:

| File | Trigger | What it does |
|---|---|---|
| `ci.yml` | Push/PR to `main`, `staging`, `feature/*`, `develop` | pnpm install → Prisma generate → tsc → next build |
| `deploy-staging.yml` | Push to `staging` branch | SSH to server, `git pull`, restart dev server |
| `deploy-prod.yml` | Push of `v*-stable` or `v*-prod` tags (or manual dispatch) | SSH to server, `git checkout <tag>`, pnpm install, restart service, verify `/unlock` responds |

Production deploy steps (manual, SSH):
```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm prisma generate
sudo systemctl restart ghs.service
# verify: curl -sf http://localhost:3200/api/health
```

**Deploy key:** stored in GitHub secret `GHS_DEPLOY_KEY`. Public key at `ghs_deploy_key.pub` in the repo root (tracking it is intentional — the private key lives in GitHub Secrets only).

---

## 11. Assembly pipeline — two paths

GHS has two assembly routes serving different planners:

### `/api/assembly/execute` (Hybrid + Music Video)
Uses `src/lib/assembly-builder.ts` for timing computation. Produces libass `.ass` subtitle files with `PlayResX:1920 / PlayResY:1080` for correct font sizing. Handles narrator/actor audio coordination via `computeNarratorWindows()`. Outputs `_subtitled.mp4`.

### `/api/video/assemble` (Children + Movie + Commercial)
Older route. Does its own FFmpeg concat + drawtext caption chain. Still functional but lacks the full per-sentence libass timing that Hybrid has. Migration of Children → `/api/assembly/execute` is tracked but not yet done.

Both routes spawn FFmpeg via `fluent-ffmpeg` / `execFile`. The assembly worker (`scripts/assemble_job_worker.mjs`) is spawned as a detached process so Next.js doesn't kill it when the HTTP response returns.

---

## 12. Key protected code (do not remove)

These blocks have a `// PROTECTED` comment in source. Do not refactor them away:

| File | What | Why |
|---|---|---|
| `app/api/hybrid/scene-image/route.ts` ~line 192 | `extractSceneAction()` | Extracts action verb before prompt sanitization |
| `app/api/hybrid/scene-image/route.ts` | `sanitizeNarrativeJargon()` | Strips screenplay terms that confuse image models |
| `app/api/assembly/execute/route.ts` | `amix=duration=longest:normalize=0` | Ensures audio doesn't get truncated to shortest track |
| `app/api/assembly/execute/route.ts` | `-stream_loop -1` on video | Required for looping video tracks during mix |
| `src/lib/generation/selectors/image-provider.ts` | `resolvePublicPortraitUrl()` | Uploads local portraits to FAL CDN for PuLID face-lock |
| `app/dashboard/hybrid-planner/page.tsx` | `analyzeCharacterImage` merge anti-override block | Prevents AI's "fair skin" inference from overriding story-specified skin tone |
| `app/api/hybrid/character-extract/route.ts` | Option B override block | Story-dominant ethnicity wins over generic character inference |
