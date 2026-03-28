# GioHomeStudio — Phase 1

AI-powered video content studio. Generates video, voice, and music, merges them with FFmpeg, and routes to a review queue.

---

## Prerequisites

- Node.js 18+
- PostgreSQL (local)
- FFmpeg full build at `C:\ffmpeg\bin\` (or set `FFMPEG_PATH` / `FFPROBE_PATH` in `.env`)

---

## Setup

```bash
npm install
# create the database
createdb giohomestudio_db
npx prisma migrate dev --name init
npx prisma generate
```

---

## Environment variables (`.env`)

| Variable | Required | Default | Notes |
|---|---|---|---|
| `DATABASE_URL` | Yes | — | `postgresql://postgres:...@localhost:5432/giohomestudio_db` |
| `KLING_ACCESS_KEY` | No | — | If absent, falls back to mock_video |
| `KLING_SECRET_KEY` | No | — | If absent, falls back to mock_video |
| `ELEVENLABS_API_KEY` | No | — | If absent, falls back to mock_voice |
| `TELEGRAM_BOT_TOKEN` | No | — | Telegram review alerts |
| `TELEGRAM_CHAT_ID` | No | — | Telegram review alerts |
| `MUSIC_PROVIDER` | No | `stock_library` | |
| `STORAGE_BASE_PATH` | No | `./storage` | Root for all generated files |
| `FFMPEG_PATH` | No | `C:\ffmpeg\bin\ffmpeg.exe` | |
| `FFPROBE_PATH` | No | `C:\ffmpeg\bin\ffprobe.exe` | |

---

## Running locally

```bash
npm run dev          # starts on http://localhost:3200
```

---

## Testing

```bash
# Full end-to-end pipeline
npx tsx --env-file=.env scripts/test-pipeline.ts

# Approve + reject flow
npx tsx --env-file=.env scripts/test-review.ts

# FFmpeg merge cases (video-only, +voice, +voice+music)
npx tsx --env-file=.env scripts/test-merge.ts
```

---

## Stock music files

Test tracks live in `storage/music/stock/`. Replace with real tracks before production.

| File | Mood |
|---|---|
| `epic_cinematic.mp3` | epic |
| `calm_ambient.mp3` | calm |
| `emotional_piano.mp3` | emotional |
| `upbeat_pop.mp3` | upbeat |
| `dramatic_orchestral.mp3` | dramatic |
| `default_background.mp3` | fallback |

---

## API endpoints

| Method | Path | Notes |
|---|---|---|
| `POST` | `/api/pipeline` | Start pipeline. Returns `{ contentItemId }` immediately. |
| `GET` | `/api/registry` | List content items. Optional: `?status=IN_REVIEW&limit=20&offset=0` |
| `GET` | `/api/registry/:id` | Single content item |
| `POST` | `/api/review/:id/approve` | Approve item |
| `POST` | `/api/review/:id/reject` | Body: `{ note?: string }` |
| `GET` | `/api/media/[...path]` | Serves local storage files to browser |

---

## Dashboard pages

- `/dashboard/registry` — full content list with status, error expansion
- `/dashboard/review` — video preview, approve / reject with note

---

## Status flow

```
PENDING → ENHANCING → GENERATING_VIDEO → GENERATING_VOICE
→ GENERATING_MUSIC → MERGING → IN_REVIEW → APPROVED / REJECTED
                                                ↑ FAILED (any blocking step)
```

---

## Provider behaviour

| Provider | Real credentials set | Fallback |
|---|---|---|
| Video | Kling (JWT-signed, async poll) | `mock_video` — black video via FFmpeg |
| Voice | ElevenLabs (Sarah voice, free tier) | `mock_voice` — silent audio via FFmpeg |
| Music | `stock_library` (default) | sine-tone test tracks |

Auto-fallback triggers on any Kling or ElevenLabs error (429, 401, DNS, 5xx). Voice and music failures are non-blocking — the pipeline continues without them.

---

## FFmpeg note

fluent-ffmpeg's capability checker misparses newer FFmpeg's ` D d lavfi` format line (the `d` device-type character breaks its regex). The mock video and voice adapters therefore use `child_process.execFile` directly. The main merge module (`src/modules/ffmpeg/index.ts`) uses fluent-ffmpeg normally because it never uses lavfi inputs.

---

## Phase 2 items (not in scope yet)

- Replace stock music with real music generation (Kie.ai, Mubert, etc.)
- BullMQ or similar job queue replacing in-process `processJob`
- CDN / object storage replacing local `./storage`
- Destination page registry and publishing controls
- Analytics dashboard
