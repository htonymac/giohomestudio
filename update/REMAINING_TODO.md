# GHS — Remaining TODO (open backlog)

**Created 2026-05-28** after closing Henry's render report (PROBLEM_AND_FIX #42–#46, all live on andiostudio.com, HEAD `2b1da63`+).
This is the single place to look for "what's left." Update it as items close. Each item says **who it's blocked on** and the **exact next step**, so any session can pick it up cold.

---

## 🔴 Blocked on Henry (needs an input only he can give)

### 1. Karaoke MAIN full end-to-end on FREE engines
- **State:** Foundation verified ready — `PYTHON_BIN` → venv, `faster_whisper`/`librosa`/`soundfile` import OK, stock music library present (`storage/music/stock/*.mp3`), `generate-music` now defaults to free stock (premium gated, #46 verified).
- **Blocked on:** a real **voice recording fixture** (a short sung/spoken WAV/MP3). Henry to drop one (e.g. into `storage/karaoke/` or via the Creator upload).
- **Exact next step when unblocked:** run upload → `analyze` (whisper+librosa) → `flow-profile` → `polish-lyrics` → `beat-recommend` → `production-brief` → `generate-music` (stock) → `save-mix` → `assemble` → `export`. Confirm each step returns 200 and the flow-lock opens. Watch `analyze` (first whisper run may be slow / model download).

### 2. Phase 3 — cross-scene character face-lock (PuLID)
- **State:** Wrong-character/swap bug is largely resolved (chars render correctly per description). Residual = (a) phantom extra people in multi-char scenes, (b) same character not identical across scenes.
- **Blocked on:** PuLID face-lock needs **PUBLIC image URLs** for the reference portraits. Local `/api/media/...` paths can't feed PuLID → gated on the **R2 storage cutover** (STORAGE_PROVIDER still `local`; see HANDOFF "R2 cleaner DEFERRED to Phase 3 cutover").
- **Exact next step when unblocked:** flip R2 cutover → portraits get public URLs → wire `scene-image` to pass reference image to PuLID/face-lock → gen a multi-scene cast and confirm identity holds scene 1 vs scene 5.

---

## 🟢 Solo (no input needed — agent can do anytime)

### 3. Orphan branch `md-only-backup-2026-05-27`
- Markdown-only snapshot of the repo (*.md, *.MD), excluding all code + secrets. Henry: "dont push .md" → keep it LOCAL (markdown is already safe on `origin/main` via tracked docs).
- **Status:** see bottom of this file (done/pending).

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
