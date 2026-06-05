# GioHomeStudio — Secrets and Environment Variables

Copy `.env.example` to `.env` and fill in your values. Never commit `.env` or `.env.local`.
The app will not boot if required variables are missing — check the Next.js startup log for which variable caused the failure.

All values below are **REDACTED** — this document contains only names, descriptions, and metadata.

---

## Database

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `DATABASE_URL` | YES | PostgreSQL connection string for `giohomestudio_db`. Format: `postgresql://user:pass@host:5432/giohomestudio_db?schema=public`. The `?schema=public` suffix is required by Prisma. Strip it when passing to `pg_dump` directly. | Your PostgreSQL instance. Local dev: `localhost:5432`. Production: Contabo VPS. | HIGH — full DB read/write access |

---

## LLM Providers

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `ANTHROPIC_API_KEY` | Recommended | Claude API key. Used for story expansion, scene QC, character extraction, and all default LLM calls. Falls back to OpenAI when depleted. Key is also readable from `/dashboard/settings` (saves to `storage/llm-settings.json`). | console.anthropic.com | CRIT — generates spend on your account |
| `OPENAI_API_KEY` | Recommended | OpenAI API key. Primary fallback when Anthropic calls fail or credits are depleted. Used for GPT-4o-mini (cheap) and GPT-4o (quality) routing. | platform.openai.com | CRIT |
| `XAI_API_KEY` | Optional | xAI Grok API key. Used when `LLM_PROVIDER=grok` is selected. | console.x.ai | HIGH |
| `OLLAMA_BASE_URL` | Optional | Base URL for local Ollama instance. Default: `http://localhost:11434`. Used for free-tier and offline LLM calls. Timeout is set to 300s for large models. | Your Ollama install | LOW (local only) |
| `LLM_PROVIDER` | Optional | Override default LLM provider slug: `claude`, `openai`, `grok`, `ollama`. Leave empty to use the app's automatic cascade. | — | LOW |

---

## Voice (TTS)

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `ELEVENLABS_API_KEY` | Optional | ElevenLabs API key. Used as the highest-quality TTS tier (Premium tier). Falls back to FAL Kokoro if missing. | elevenlabs.io/app/api-keys | HIGH — generates spend |
| `ELEVENLABS_API_BASE_URL` | Optional | ElevenLabs base URL. Default: `https://api.elevenlabs.io/v1`. Only change for self-hosted or proxy setups. | — | LOW |
| `PIPER_BIN` | Linux/server | Path to the Piper TTS binary. Linux default: `/home/ghs/piper/piper/piper`. Windows default: `C:/Users/USER/piper/piper.exe`. | Built from source or downloaded from piper-tts GitHub releases. | LOW |
| `PIPER_VOICES_DIR` | Linux/server | Directory containing Piper `.onnx` voice model files. Default candidate list scanned if this is not set. Linux production: `/home/ghs/piper/voices`. | Download from piper-tts/piper-voices GitHub releases. | LOW |

---

## Image Generation

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `FAL_KEY` | YES | FAL.ai API key. Covers: FLUX Schnell/Dev image gen, PuLID face-lock, Kokoro TTS, Bark, XTTS, F5-TTS, Gemini TTS, Stable Audio, Minimax Music, BG removal, image-to-image, clarity upscaler, avatar/lip-sync. Single key covers all FAL services. | fal.ai/dashboard | CRIT — generates spend on all FAL services |
| `FAL_BASE_URL` | Optional | FAL queue base URL. Default: `https://queue.fal.run`. | — | LOW |
| `SEGMIND_API_KEY` | Optional | Segmind API key. Used for `segmind_flux` (default image model, ~$0.0004/image) and `segmind_pruna_video`. Free-tier default model. | segmind.com | HIGH |
| `SEGMIND_BASE_URL` | Optional | Segmind API base URL. Default: `https://api.segmind.com/v1`. | — | LOW |
| `IMGUR_CLIENT_ID` | Optional | Imgur anonymous upload client ID. Used by Scene Forge to make portrait images reachable by FAL workers. Falls back to FAL CDN upload if missing (slower). | api.imgur.com/oauth2/addclient | LOW |
| `DEFAULT_IMAGE_MODEL` | Optional | Default image model slug. Default: `segmind_flux`. Options: `segmind_flux`, `fal_flux_dev`, `fal_flux_schnell`, `ideogram_v3`. | — | LOW |
| `COMFYUI_URL` | Optional | Local ComfyUI instance URL. Default: `http://127.0.0.1:8188`. Only used when ComfyUI provider is selected. | — | LOW |
| `COMFYUI_MODEL` | Optional | ComfyUI model filename. Default: `flux1-dev.safetensors`. | — | LOW |
| `COMFYUI_STEPS` | Optional | ComfyUI inference steps. Default: `20`. | — | LOW |

---

## Video Generation

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `VIDEO_PROVIDER` | Optional | Active video provider: `runway`, `kling`, `muapi`, `mock_video`. Default: `mock_video` (no spend). Set to a real provider on production. | — | LOW |
| `RUNWAY_API_KEY` | Optional | Runway Gen-4+ API key for video generation. | runwayml.com/account | HIGH |
| `KLING_ACCESS_KEY` | Optional | Kling AI access key (HMAC signing). Required for Kling video generation. | klingai.com developer console | HIGH |
| `KLING_SECRET_KEY` | Optional | Kling AI secret key (HMAC signing). Paired with `KLING_ACCESS_KEY`. | klingai.com developer console | CRIT — sign requests on your behalf |
| `KLING_API_BASE_URL` | Optional | Kling API base URL. Default: `https://api.klingai.com`. | — | LOW |
| `MUAPI_API_KEY` | Optional | MuAPI (SeeDance 2.0) video generation key. | muapi.ai | HIGH |
| `MUAPI_BASE_URL` | Optional | MuAPI base URL. Default: `https://api.muapi.ai`. | — | LOW |
| `DEFAULT_VIDEO_MODEL` | Optional | Default video model slug. Default: `segmind_pruna_video`. | — | LOW |
| `GENERATION_TIMEOUT_SECONDS` | Optional | Max seconds to wait for any generation API call. Default: `480`. | — | LOW |
| `MAX_RETRIES` | Optional | Max retries on generation API failure. Default: `2`. | — | LOW |

---

## Music

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `MUSIC_PROVIDER` | Optional | Active music provider: `kie_ai`, `stock_library`, `mubert`, `stable_audio`, `manual`. Default: `stock_library` (free, royalty-safe Kevin MacLeod tracks). | — | LOW |
| `KIE_AI_API_KEY` | Optional | Kie.ai API key for Suno V5 lyrical music generation. Without this, music gen falls back to `stock_library`. | kie.ai | HIGH |
| `KIE_AI_API_BASE_URL` | Optional | Kie.ai base URL. Default: `https://api.kie.ai`. | — | LOW |
| `MUBERT_PAT` | Optional | Mubert B2B personal access token. Required for instrumental tracks longer than 47s. Falls back to stock library if missing. | mubert.com/render/pricing (B2B API plan) | HIGH |
| `FREESOUND_API_KEY` | Optional | Freesound.org API key for SFX library search. | freesound.org/apiv2/apply | LOW |

---

## Storage

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `STORAGE_BASE_PATH` | Optional | Local filesystem storage root. Default: `./storage`. Relative to project root. | — | LOW |
| `R2_ACCOUNT_ID` | Optional | Cloudflare R2 account ID. Required when `STORAGE_PROVIDER=r2`. | Cloudflare dashboard → R2 | MED |
| `R2_ACCESS_KEY_ID` | Optional | Cloudflare R2 access key ID. | Cloudflare dashboard → R2 → Manage API tokens | HIGH |
| `R2_SECRET_ACCESS_KEY` | Optional | Cloudflare R2 secret access key. Paired with `R2_ACCESS_KEY_ID`. | Cloudflare dashboard → R2 → Manage API tokens | CRIT |
| `R2_BUCKET` | Optional | R2 bucket name. Production: `andio-assets`. | Cloudflare dashboard | LOW |
| `R2_PUBLIC_DOMAIN` | Optional | Custom domain for R2 public URLs. If set, `/api/media/...` routes are served directly. | Cloudflare R2 public bucket settings | LOW |
| `STORAGE_PROVIDER` | Optional | `local` (default) or `r2`. Switch to `r2` after Phase 3 R2 cutover. | — | LOW |
| `BASE_URL` | Optional | Public base URL of the app. If set, `/api/media/...` served directly (no CDN upload needed). Production: `https://andiostudio.com`. | — | LOW |

---

## Auth

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `AUTH_SECRET` | Future | NextAuth secret for session signing. Not active in current deployment (placeholder). Required before enabling user auth. | Generate: `openssl rand -base64 32` | CRIT — signs all user sessions |
| `NEXTAUTH_SECRET` | Future | Alias for `AUTH_SECRET` used by some NextAuth adapters. Keep in sync. | Same as above | CRIT |

---

## Monitoring

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `SENTRY_DSN` | Optional | Sentry DSN for error tracking. Wired via `instrumentation.ts`. SDK (`@sentry/nextjs`) must be installed. SDK is referenced in package.json but DSN may not be set. | sentry.io → project settings | MED — exposes error logs, not credentials |
| `SENTRY_AUTH_TOKEN` | CI only | Sentry auth token for source map uploads. Used in CI/deploy scripts only, never in runtime `.env`. | sentry.io → settings → auth tokens | HIGH |

---

## Bot / Notifications

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Optional | Telegram bot token. Used for assembly completion notifications and deploy alerts. | @BotFather on Telegram | HIGH — controls bot on behalf of owner |
| `TELEGRAM_CHAT_ID` | Optional | Telegram chat ID to send notifications to. | Send `/getUpdates` to bot API or use @userinfobot | LOW |

---

## FFmpeg / Binary paths

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `FFMPEG_PATH` | Conditional | Path to `ffmpeg` binary. Required on Windows. Linux: `ffmpeg` (system PATH). Windows: `C:\ffmpeg\bin\ffmpeg.exe`. | ffmpeg.org/download.html | LOW |
| `FFPROBE_PATH` | Conditional | Path to `ffprobe` binary. Same source as ffmpeg. Linux: `ffprobe` (system PATH). | ffmpeg.org/download.html | LOW |
| `PYTHON_BIN` | Optional | Path to Python binary. Used by karaoke audio analysis steps. Linux default: `python3`. Windows: full path to Python 3.x executable. | python.org or system package manager | LOW |

---

## App config

| Variable | Required | Description | Where to obtain | Severity if leaked |
|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Optional | Public URL of the app, exposed to the browser. Default: `http://localhost:3200`. Production: `https://andiostudio.com`. | — | LOW |
| `NODE_ENV` | Optional | `development` or `production`. Controls Next.js optimization and error verbosity. | — | LOW |

---

## Notes

- **LLM keys via Settings page:** `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` can alternatively be set through `/dashboard/settings`, which saves to `storage/llm-settings.json`. The Settings page value takes priority over `.env`. If keys appear to be ignored, check `storage/llm-settings.json` first.

- **Missing secret = loud failure:** if a required secret is absent, the relevant API route returns a 500 or 503 with an error message. Check `journalctl -u ghs.service` on the server for startup errors listing missing variables.

- **Production vs dev:** `VIDEO_PROVIDER` defaults to `mock_video` on dev. Set it to `kling` or `runway` on production. `DEFAULT_IMAGE_MODEL` defaults to `segmind_flux` (~$0.0004/image) — this is intentional.

- **Rotation schedule:** all third-party API keys (FAL, Kling, Runway, ElevenLabs, Anthropic, OpenAI) should be rotated every 90 days. Revoke old keys at the provider dashboard before issuing new ones.
