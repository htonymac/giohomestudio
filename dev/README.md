# GioHomeStudio — Developer Orientation

## What is GioHomeStudio?

GioHomeStudio (public brand: **Andio Studio**, live at **andiostudio.com**) is an AI-powered video content studio and publishing control platform. It turns structured creative input into completed video files using a chain of AI services: LLM story expansion, image generation, TTS narration, music, SFX, and FFmpeg assembly. It is not a simple single-video generator — it manages multi-scene projects, characters with persistent identity, subtitle systems, and a full approve/track/publish loop.

## How it runs

| Item | Value |
|---|---|
| Port | **3200** |
| Start command | `pnpm dev -p 3200` (Turbopack dev server — used in production too, see note below) |
| DB | PostgreSQL `giohomestudio_db` on `localhost:5432`, Prisma ORM |
| Live server | Ubuntu 22.04 VPS, user `ghs`, systemd unit `ghs.service`, accessed via Cloudflare Tunnel |
| Package manager | **pnpm** (9.15.0) — do not use npm or yarn |

**Turbopack note:** The app runs `next dev -p 3200` in production (see `package.json` `start` script). `next build` + `next start` is the proper production path but was temporarily deferred due to a Turbopack chunk compilation quirk. A `start:prod` script exists for when that is resolved.

## Cloning and starting locally

```bash
git clone https://github.com/htonymac/giohomestudio.git
cd giohomestudio
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy      # apply all migrations
cp .env.example .env            # fill in values — see SECRETS_AND_ENV.md
pnpm dev -p 3200
```

Open `http://localhost:3200`. The site requires an `andio_access` cookie — set `ACCESS_CODE` in `.env` to a passphrase and visit `http://localhost:3200/unlock` to authenticate.

## Where the code lives

```
app/                      Next.js App Router pages + API routes
  api/                    ~50 API route groups (tts, video, hybrid, children, karaoke, ...)
  dashboard/              Planner pages (hybrid, children, movie, karaoke, commercial, ...)
  components/             Shared React components (AppShell, SubtitleStyler, VoiceTierSelector, ...)
src/
  lib/                    Core logic: voice-registry, ghs-sound-tiers, llm, storage, generation/
prisma/
  schema.prisma           Database schema
  migrations/             Forward-only SQL migrations
scripts/                  Node.js utility scripts (assemble worker, backup, test fixtures)
storage/                  Local media files (dev only — production uses this path on the VPS)
```

## The 7 planners

| Planner | URL | Status |
|---|---|---|
| **Hybrid** | `/dashboard/hybrid-planner` | Mature reference — most complete |
| **Children** | `/dashboard/children-planner` | ~97% parity with Hybrid |
| **Movie** | `/dashboard/movie-planner` | Core features complete |
| **Commercial** | `/dashboard/commercial-planner` | Core features complete |
| **Karaoke Creator/Planner** | `/dashboard/karaoke-music-creator` + `/dashboard/karaoke-music-planner` | 18-step pipeline, GPU-dependent steps marked |
| **Music Video** | `/dashboard/music-video-planner` | Core features complete |
| **Auto Creator** | `/dashboard/auto-creator` | Partial |

**Rule:** Hybrid Planner is the reference implementation. When adding a feature to another planner, mirror the Hybrid pattern — never copy-paste code, adapt it.

## The 5-tier voice system

Voices are never identified by real model name in the UI. The user always sees GHS tier labels:

| User-facing label | Underlying provider |
|---|---|
| GHS Standard | Piper (local CPU, free) |
| GHS Standard+ | Microsoft Edge-TTS (cloud, free) |
| GHS Pro | FAL F5-TTS / XTTS / Bark (paid) |
| GHS Premium | FAL Gemini 2.5 Flash TTS (paid) |
| GHS Best | ElevenLabs Flash / Multilingual (paid) |

Single source of truth: `src/lib/voice-registry.ts`. The `/api/tts` route dispatches to the appropriate provider using a 6-tier fallback chain.

## Key URLs

- Production: https://andiostudio.com
- Unlock page: https://andiostudio.com/unlock
- Storage cleanup: https://andiostudio.com/dashboard/storage-cleanup
- Health check: https://andiostudio.com/api/health
