# GHS — Remaining TODO (open backlog)

**Created 2026-05-28** after closing Henry's render report (PROBLEM_AND_FIX #42–#46, all live on andiostudio.com, HEAD `2b1da63`+).
This is the single place to look for "what's left." Update it as items close. Each item says **who it's blocked on** and the **exact next step**, so any session can pick it up cold.

---

## 🔴 Blocked on Henry (needs an input only he can give)

### 1. Karaoke MAIN full end-to-end on FREE engines — ✅ VERIFIED GREEN 2026-05-28
- **DONE:** full e2e passes on free engines (`scripts/karaoke_e2e_test.mjs`, using an existing narration WAV as the voice fixture): analyze (Whisper+librosa) → flow-profile → beat-recommend → production-brief → generate-music (**stock**, free) → save-mix → assemble (mixed mp3) → export (downloadable mp3). LLM steps fall back to OpenAI (Anthropic credits depleted). PROBLEM_AND_FIX #46/#48/#49.
- **Optional (quality only):** a REAL sung/hummed/rapped voice clip from Henry to confirm analysis handles actual singing (the test used clean TTS narration). Drop a 10–30s mp3/wav anywhere + tell me the path, or record in the Creator.
- **Minor follow-up:** `analyze` returns `tempo: undefined` — check `scripts/karaoke_analyze.py` output keys (production-brief defaults to 90 BPM, non-blocking).
- **⚠️ Henry action:** top up **Anthropic API credits** — depleted. Everything falls back to OpenAI GPT-4o-mini now (works, lower quality than Claude).

### 2. Phase 3 — cross-scene character face-lock (PuLID)
- **State:** Wrong-character/swap bug is largely resolved (chars render correctly per description). Residual = (a) phantom extra people in multi-char scenes, (b) same character not identical across scenes.
- **Blocked on:** PuLID face-lock needs **PUBLIC image URLs** for the reference portraits. Local `/api/media/...` paths can't feed PuLID → gated on the **R2 storage cutover** (STORAGE_PROVIDER still `local`; see HANDOFF "R2 cleaner DEFERRED to Phase 3 cutover").
- **Exact next step when unblocked:** flip R2 cutover → portraits get public URLs → wire `scene-image` to pass reference image to PuLID/face-lock → gen a multi-scene cast and confirm identity holds scene 1 vs scene 5.

---

## 🟢 Solo (no input needed — agent can do anytime)

### 3. Orphan branch `md-only-backup-2026-05-27` — ✅ DONE 2026-05-28
- Created via git plumbing (temp index, never touched working tree/HEAD): **331 tracked .md files, 0 non-markdown**, no code/secrets. Kept **LOCAL** (not pushed, per "dont push .md"). Restore/inspect: `git ls-tree -r --name-only md-only-backup-2026-05-27`.
- NOTE: a few **untracked** markdown docs were NOT in the backup (ls-files = tracked only): `update/PLANS/MASTER_PLAN_05262026.md`, `update/onboarding_ghs_linux_05232026.md`, `FIXNEWCHIDHYBRIDANDMORE05272026.MD` (the last is intentionally local). Henry: decide if MASTER_PLAN + onboarding should be tracked on main (review for secrets first per [[feedback_git_secret_scan]]), then re-run the branch build to include them.

### 4. Hybrid render browser e2e (eyeball)
- Component-verified already (18/18 segs, gray-drop, narrator). An eyeball pass of a full real render (narration audible + images visible + intro/outro on screen) via AUT + a multi-minute render. Best done when AUT is watching.

### 5. Phantom extra people (multi-character scenes)
- Independent of PuLID/R2. A scene with N named characters sometimes renders N+1 people. Candidate fix: tighten the scene prompt with an explicit person-count constraint + "no extra/duplicate people" negative, scoped to scenes with a known small cast. Needs care not to remove intended background crowd.

---

## ✅ Closed 2026-05-28 (for context — do not redo)
- #42 assembly ffmpeg concurrency (images/intro/outro) — bounded pool, verified 18/18.
- #43 mixed-mode narrator restored.
- #44 gray-flash placeholder drop — verified.
- #45 children free-tier LLM (ABC format + length) — verified live.
- #46 karaoke MAIN = free stock (premium gated) — verified live.
- Regression scripts: `scripts/verify_assembly_concurrency.mjs`, `dead_url_test.mjs`, `abc_format_test.mjs`, `length_fill_test.mjs`, `karaoke_main_free_test.mjs`.
