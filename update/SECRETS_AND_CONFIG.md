# GioHomeStudio — Secrets & Config Reference

This file documents every environment variable the app needs, its purpose, and its current status.
Check here before adding new env vars, and update when vars are added or changed.

---

## Database

| Var | Required | Status | Notes |
|---|---|---|---|
| `DATABASE_URL` | YES | Set | PostgreSQL connection. giohomestudio_db on localhost:5432 |

---

## AI Video Generation

| Var | Required | Status | Notes |
|---|---|---|---|
| `KLING_ACCESS_KEY` | YES | Set | Kling AI video gen access key |
| `KLING_SECRET_KEY` | YES | Set | Kling AI video gen secret |
| `KLING_API_BASE_URL` | YES | Set | Default: https://api.klingai.com |

---

## FAL.ai Gateway

| Var | Required | Status | Notes |
|---|---|---|---|
| `FAL_KEY` | YES | Set (unlocked pending) | Covers: Stable Audio (≤47s), image gen (Flux/Ideogram/etc), video gen (Wan/Hailuo/Kling via FAL) |

Note: FAL account unlock pending as of 2026-04-30 (see `video samples/- fal.ai account unlock not yet unl.txt`).

**Face-lock (PuLID):** Also routed through `FAL_KEY`. Model: `fal-ai/flux-pulid`. Activates automatically when character has `referenceImages[]` tagged `photo-import`. Cost: ~$0.05/image. Requires public-accessible image URL — local `/api/media/` paths fall back to text-only generation.

---

## Music Generation

| Var | Required | Status | Notes |
|---|---|---|---|
| `KIE_AI_API_KEY` | For lyrical tracks | NOT SET | Kie.ai Suno V5 for song-style/vocal music. Falls back to stock without it. |
| `MUBERT_PAT` | For tracks >47s | NOT SET | Mubert B2B API for long instrumental tracks. Without this, any track >47s silently falls back to stock library. Get from: https://mubert.com/render/pricing (B2B API plan). |

**BUG-23 note (fixed 2026-04-30 S6):** The >47s branch was unreachable due to dead condition. Now fixed — stock fallback logs a console.warn and returns `fallbackReason` in API response. UI shows info banner when stock fallback triggers.

---

## Voice / TTS

| Var | Required | Status | Notes |
|---|---|---|---|
| `ELEVENLABS_API_KEY` | For ElevenLabs TTS | Set | ElevenLabs voice generation |
| `ELEVENLABS_API_BASE_URL` | YES | Set | Default: https://api.elevenlabs.io/v1 |

---

## Notifications

| Var | Required | Status | Notes |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | For Telegram alerts | Set | Approval flow + AUT alerts |
| `TELEGRAM_CHAT_ID` | For Telegram alerts | Set | Henry's chat ID |

---

## App Config

| Var | Required | Status | Notes |
|---|---|---|---|
| `STORAGE_BASE_PATH` | YES | Set | Default: ./storage — media file storage root |
| `NEXT_PUBLIC_APP_URL` | YES | Set | http://localhost:3200 in dev |
| `NODE_ENV` | YES | Set | development / production |

---

## Music Provider Routing Summary

Auto-routing logic (see `src/modules/music-provider/index.ts`):

| Condition | Provider | Env Required |
|---|---|---|
| hasLyrics=true | Kie.ai | `KIE_AI_API_KEY` |
| hasLyrics=true, no key | Stock library | none |
| instrumental, ≤47s | FAL Stable Audio | `FAL_KEY` |
| instrumental, ≤47s, no FAL | Mubert | `MUBERT_PAT` |
| instrumental, ≤47s, neither | Stock library | none |
| instrumental, >47s | Mubert | `MUBERT_PAT` |
| instrumental, >47s, no Mubert | Stock library (fallback) | none — logs warning |
