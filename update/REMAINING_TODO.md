# GHS — Remaining TODO (open backlog)

**Single place for "what's left."** Updated 2026-05-28. Each item says who it's blocked on + the exact next step so any session can pick it up cold. All fixes below are LIVE on andiostudio.com.

---

## 🔴 Needs Henry (input only he can give)

### A. Anthropic API credits — DEPLETED
- Every Claude call now auto-falls-back to OpenAI GPT-4o-mini (works, lower quality). Top up whenever for Claude-quality output. Not blocking anything.

### B. Phase 3 — cross-scene character face-lock (PuLID)
- Same character should look identical in scene 1 vs scene 5. Needs PuLID face-lock, which needs **PUBLIC image URLs** for the reference portraits → gated on the **R2 storage cutover** (STORAGE_PROVIDER still `local`).
- **Exact next step when Henry green-lights R2:** flip cutover → portraits get public URLs → wire `scene-image` to feed reference portrait to PuLID → gen a multi-scene cast, confirm identity holds across scenes.

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
