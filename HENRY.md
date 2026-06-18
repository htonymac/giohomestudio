# HENRY — check-in / blocked-on-Henry queue (GHS)

Terry writes here when something is genuinely blocked on you. Read on return, clear in a batch.

## ⏸ PARKED — needs Henry

### #2 — BullMQ + Redis queue (concurrency cap ~2) — NEEDS REDIS PASSWORD
- **Status:** Redis IS installed + active on the box (redis-cli 6.0.16), but it requires auth (`NOAUTH`). The GHS `.env` has no `REDIS_*` keys yet, and BullMQ is not installed.
- **Blocked on:** the Redis password (a secret — I won't fetch/print it). To unblock, set on the server in `/home/ghs/giohomestudio/.env`:
  - `REDIS_URL=redis://:<password>@127.0.0.1:6379` (or `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD`)
  - then tell me "redis ready" and I'll install BullMQ, build the queue + worker (concurrency cap 2, retries+backoff, survives restart), wire the ~10 synchronous `/api/video/assemble` planners behind a flag, and verify.
- Until then #2 stays parked; I'm doing the unblocked TODOs (#3 done, then #5/#4/#6).

### #7 — Mara/Cobra subject-object swap — NEEDS YOUR REGEN-CONFIRM
- The handcuff/tackle scene swap fix shipped earlier; needs you to regenerate that scene and confirm it no longer swaps. If it still swaps, I'll escalate to per-scene doer/receiver fields or a 2-image composite.

## ✅ Recently shipped (no action needed)
- **#1 idempotency key** — LIVE (PR #150). Retrying Assemble while a render runs no longer spawns a duplicate ffmpeg job.
- **#3 temp sweeper** — in progress this session (daily orphan-temp cleanup + leak tightened at source).
