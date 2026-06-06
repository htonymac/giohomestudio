# ADMIN_TOKEN — what it is, why it exists, when to use it

**Status:** Live in `/home/ghs/giohomestudio/.env` on prod server (2026-06-05).
**Indexed in:** `ANDIO_MUST_READ.md` §2.

---

## What it is

A 64-character hex secret that gates 3 administrator API endpoints on andiostudio.com. **Not a login. Not a user password.** Site browsing still uses the existing `/unlock` cookie flow — that has not changed.

The token lives in one place: the server `.env` file (gitignored, never committed). A copy of the token value should be saved to the maintainer's password manager OR printed and stored physically. Lose it and a new one must be generated.

To view it from your PC:

```powershell
ssh hmk "sudo -n -u ghs grep ^ADMIN_TOKEN= /home/ghs/giohomestudio/.env"
```

That command prints the line `ADMIN_TOKEN=<64-hex>` to your terminal. Copy the value after `=`.

To rotate it:

```bash
NEW=$(openssl rand -hex 32)
ssh hmk "sudo -n -u ghs bash -c 'sed -i \"s/^ADMIN_TOKEN=.*/ADMIN_TOKEN=$NEW/\" /home/ghs/giohomestudio/.env'"
# Restart Next.js process so the new value is loaded.
```

---

## Why it exists

Per the production doctrine (`MUST READ BEFORE APP OR DURING PRODUCT OF APP.txt`, §1):

> "Gate rollouts with feature flags. Launch dark leaf, flag smith, or even a simple JSON config in your database. New feature ships to production behind a flag. You enable it for internal users first, then beta users, then ten percent, then everybody. If something breaks, kill the flag. The code stays deployed, but the feature disappears. No rollback needed."

The doctrine also (§15) warns that "AI generated code almost never handles rate limits properly. You'll get overcharged" — so we need a way to kill a runaway paid feature in seconds, not a code-deploy cycle.

The ADMIN_TOKEN is the gate that protects the kill switches and the cost-observability endpoints from being abused.

**It is a future-emergency lever. With zero users today it does not give the maintainer anything they couldn't already do via SSH. With paid users tomorrow it lets the maintainer kill a runaway $/hour spike from a phone, no laptop or git push required.**

---

## The 3 endpoints it gates

All three accept the token either as `Authorization: Bearer <token>` or `X-Admin-Token: <token>`. Both work the same. A missing/wrong token returns `401 unauthorized`.

### 1. `GET /api/admin/flags` — list every feature flag

Returns a JSON array of every known flag plus any DB-only flags, with current `enabled` state and last-update metadata. Use it to confirm the current kill-switch posture before flipping anything.

```powershell
curl.exe -H "X-Admin-Token: $T" https://andiostudio.com/api/admin/flags
```

### 2. `POST /api/admin/flags` — toggle a flag

Sends a JSON body with `{key, enabled}`. The 5-second in-memory cache means the new value is live across all callers within 5 seconds, no Next.js restart needed.

```powershell
$body = '{"key":"FLAG_FAL_VOICES","enabled":false,"by":"emergency"}'
curl.exe -X POST -H "X-Admin-Token: $T" -H "Content-Type: application/json" `
  -d $body https://andiostudio.com/api/admin/flags
```

The 7 known flags (all default `true`):

| Flag | What killing it does |
|---|---|
| `FLAG_FAL_VOICES` | FAL F5/XTTS/Bark/Gemini fall back to Piper. Stops FAL voice spend. |
| `FLAG_ELEVENLABS_VOICES` | ElevenLabs falls back to Piper. Stops EL spend. |
| `FLAG_VIDEO_ASSEMBLY` | `/api/video/assemble` returns 503. New videos can't be made. |
| `FLAG_FREEMODE` | `/api/free-mode/chat` returns 503. Free Mode disabled. |
| `FLAG_HYBRID` | Reserved — wired when Hybrid planner gets a kill switch later. |
| `FLAG_LLM_CACHE` | Cache lookups bypassed (debug only). |
| `FLAG_NEW_USER_SIGNUPS` | Reserved — wired when auth/signup ships. |

### 3. `GET /api/admin/cost` — observability dashboard

Returns a single JSON snapshot:

- `llmCache.rows` + `totalHits` + top 10 most-hit prompts (which queries the cache caught)
- `dailySpend.today` — total cents + active users + top 10 spenders (truncated user keys, no leak)
- `dailySpend.last7Days` — per-day rollup
- `circuitBreakers.fal/elevenlabs/kling` — state of each (closed/half-open/open)
- `flags` — current state of all flags

Used to spot: cache hit rate trending down, rogue user, breaker stuck OPEN, forgotten flag flip.

```powershell
curl.exe -H "X-Admin-Token: $T" https://andiostudio.com/api/admin/cost | ConvertFrom-Json
```

### 4. `GET /api/admin/sentry-test?kind=capture` — verify Sentry

Fires a controlled error to confirm the Sentry SDK + DSN round-trip works. Two modes via `?kind=`:

- `capture` — calls `Sentry.captureException` directly. Returns the Sentry event ID.
- `throw` — throws an error caught by `instrumentation.ts` onRequestError hook.

```powershell
curl.exe -H "X-Admin-Token: $T" "https://andiostudio.com/api/admin/sentry-test?kind=capture"
```

Then visit `https://sentry.io/organizations/henmac/issues` and look for an event tagged `sentry-test-<timestamp>` within ~30 seconds.

---

## When to actually use it

The token gives nothing user-facing today. Its value materializes when one of these scenarios hits:

| Scenario | What you do |
|---|---|
| Sentry alerts: `FAL_BUDGET_EXCEEDED` spiking on one user | `POST /api/admin/flags` to flip `FLAG_FAL_VOICES` to false. Spend stops in 5 seconds. |
| Assembly is wedged after a bad code push, customers complaining | Flip `FLAG_VIDEO_ASSEMBLY` to false → 503 with retry-after. Users see "temporarily disabled". Push fix. Flip back. |
| Need to confirm cache is still doing its job | `GET /api/admin/cost` and read `llmCache.totalHits`. Compare against yesterday. |
| Worried Sentry stopped working after a deploy | `GET /api/admin/sentry-test?kind=capture` → check dashboard. |
| Free Mode is being abused (one IP hammering /chat) | Flip `FLAG_FREEMODE` to false while you add rate limiting. |

If none of those scenarios are happening, you do not need the token. Park it.

---

## Security notes

- **Never commit the token.** `.env` and `.env.local` are gitignored. The file `ENV TOKEN.txt` on the Windows desktop is also outside git.
- **Never paste the token in chat, screenshots, or PRs.** Treat it like a credit card number.
- **The token grants kill-switch power.** Anyone who has it can disable production features. Rotate it if it leaks.
- **The DSN + the ADMIN_TOKEN are different.** The Sentry DSN is safe to expose publicly (per Sentry design); the ADMIN_TOKEN is not.
- **No expiration.** Rotate manually when you have reason to suspect a leak or every ~180 days as hygiene.

---

## Related files

- `src/lib/feature-flags.ts` — flag dispatcher + 5-sec cache
- `app/api/admin/flags/route.ts` — toggle endpoint
- `app/api/admin/cost/route.ts` — observability endpoint
- `app/api/admin/sentry-test/route.ts` — verify endpoint
- `src/lib/llm-cache.ts` — what fills `llmCache.totalHits`
- `src/lib/rate-limit-defense.ts` — owns `falBreaker.state` etc.
- `prisma/schema.prisma` — `FeatureFlag`, `LlmCache`, `DailySpend` tables
- `MUST READ BEFORE APP OR DURING PRODUCT OF APP.txt` (Windows Documents) — the doctrine §1 that motivated this
