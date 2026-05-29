# GHS — Remaining TODO (open backlog)

**Single place for "what's left."** Updated 2026-05-28. Each item says who it's blocked on + the exact next step so any session can pick it up cold. All fixes below are LIVE on andiostudio.com.

---

## 🔴 Needs Henry (input only he can give)

### A. Anthropic API credits — DEPLETED
- Every Claude call now auto-falls-back to OpenAI GPT-4o-mini (works, lower quality). Top up whenever for Claude-quality output. Not blocking anything.

### B. Phase 3 — cross-scene character face-lock (PuLID)
- **R2 is NOT needed** (correction 2026-05-29): andiostudio.com already serves `/api/media/` publicly (verified HTTP 200), and `scene-image` now feeds FAL PuLID the **absolute public URL** (`env.appUrl`). Public-URL part = DONE.
- **REAL blocker: FAL is OUT OF MONEY** — live check returned `403 "User is locked. Exhausted balance."` PuLID is a FAL model, so face-lock can't run until Henry **tops up FAL at fal.ai/dashboard/billing**.
- **Exact next step after FAL top-up:** gen a single-char scene (closeup framing → willFaceLock=true) with a portrait → confirm PuLID runs (model id `fal_flux_pulid`) → gen the same character across 2-3 scenes → confirm the face holds.

### C. Provider credit / status — LIVE snapshot 2026-05-29 (re-run `scripts/credit_report.mjs`, ~$0.005/run)
- **Segmind:** ✅ working — **6.91 credits** remaining.
- **ElevenLabs:** ✅ working for TTS (36 voices). Balance not readable — the key lacks the `user_read` permission; enable it on the key and the report will show characters-left.
- **Kling:** ✅ key valid (direct API). No prepaid "balance" number via API — quota shows in the Kling console.
- **FAL:** ❌ **LOCKED — exhausted balance ($0).** Blocks PuLID face-lock + all FAL video/image models. Top up to restore.
- **Anthropic:** depleted (auto-falls back to OpenAI). **OpenAI:** working (the active fallback). **Kie:** key set.

---

## 🟢 Solo (agent can do anytime — no input needed)

### C. Hybrid render browser e2e (human eyeball)
- Everything is component + API verified (assembly 18/18, audio probe, narrator ducking, gray-drop, person-count, anti-fantasy, perf). What's left is one full real render watched end-to-end via AUT (narration audible + ducking + images correct + intro/outro on screen). Best with AUT watching.

### D. Untracked markdown docs (housekeeping)
- `update/PLANS/MASTER_PLAN_05262026.md` + `update/onboarding_ghs_linux_05232026.md` are untracked (not in the md-backup branch). Decide if they belong on main (scan for secrets first), then commit. Minor.

---

## ⚠️ Known residuals — model-adherence limits (NOT clean-fixable on the free image model)
On the current free model (segmind pruna), prompt engineering reduces but can't fully eliminate:
- Single-character scenes can still gain an unrequested extra person.
- A phone occasionally appears in a hand despite the negative.
- Faint distant background figures in busy scenes.
**These improve materially with a stronger paid image model (FAL FLUX-dev/pro) when credits/payment return.** Tracked here so they're not chased as prompt bugs.

---

## 🟡 Bigger product tracks (not started — from project_ghs_production_launch_plan)
Not part of the recent fix sprint; surface only if Henry prioritizes them:
- R2 storage cutover + DB-aware cleaner (also unblocks B above).
- Legal/T&C UI enforcement; payment + credits (Paddle).
- Supervisor/QC API routes (designed in Prisma, no routes yet).
- Other planners parity: Movie / Music-Video / Commercial / Auto Creator / Free Mode bugs.

---

## ✅ Closed 2026-05-28 (verified + live — do not redo)
- #42 assembly ffmpeg concurrency (images/intro/outro) — 18/18, 0 zero-byte.
- #43 mixed-mode narrator restored.
- #44 gray-flash placeholder drop.
- #45 children free-tier LLM (ABC format + length).
- #46 karaoke MAIN = free stock (premium gated).
- #47 assembly perf — 42s→20s (ultrafast clips + concurrency 7 + final_merge copy).
- #48 karaoke LLM steps fall back Claude→OpenAI (Anthropic-depletion resilience).
- #49 karaoke assemble resolves stock-music URL → **full karaoke e2e GREEN**.
- #50 phantom extra people — person-count lock (verified image).
- #51 narrator ducks under actor dialogue (timing unchanged) — verified mix.
- #2  actor-voice ON/OFF toggle (Sound + Assembly tabs).
- #52 scene-image: cameraman gone, young-adult age lock, environment via `location`.
- #53 anti-fantasy guard — "plane wings" renders an aircraft, not an angel (verified).
- Orphan `md-only-backup-2026-05-27` branch (local).
- Regression scripts in `scripts/`: verify_assembly_concurrency, dead_url_test, abc_format_test, length_fill_test, karaoke_main_free_test, karaoke_e2e_test, phantom_people_test, workshop_scene_test, ducking_test, plane_not_angel_test, audio_merge_test.
