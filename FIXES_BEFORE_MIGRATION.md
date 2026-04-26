# GioHomeStudio — Fixes Before Linux Migration

All items below must be COMPLETE and TESTED before moving to Linux.
Log every fix to PROBLEM_AND_FIX.md immediately when done.

---

## STATUS KEY
- [ ] Not started
- [~] In progress
- [x] Complete + tested

---

## 1. Character Dialogue — Per-Line Audio (PRIORITY)
- [x] Generate one audio clip per dialogue LINE, not one file per character
- [x] Each clip placed at correct timestamp based on sceneId + lineIndex
- [x] Bear speaks at Bear's scene, Dog speaks at Dog's scene
- [x] `generatePerLineVoices()` produces N clips for N dialogue lines, each with startTime
- [ ] Live test: run assembly, confirm each character voice lands at their scene

**Owner:** GHS Claude
**Files to touch:** `app/dashboard/hybrid-planner/page.tsx` → `generateCharacterVoices()`, `app/api/video/assemble/route.ts`
**Do NOT touch:** `src/lib/assembly-builder.ts`, `app/api/hybrid/check-audio/route.ts` (AUT Claude already fixed these)

---

## 2. Ears Check Verification
- [ ] Run full assembly from browser
- [ ] Status bar shows: `🎧 Ears check — probing audio…` then `✅ Ears: heard narration (Xs) — "..."`
- [ ] faster-whisper returns actual transcript text (not empty)
- [ ] If Whisper fails, status bar shows the actual error — not silence

**Owner:** AUT Claude (code done, needs live test)

---

## 3. Assembly Clean Standard
- [ ] Full assembly from browser produces clean video (no ghost voices from old project)
- [ ] Narrator audible throughout
- [ ] Character voices audible at their scenes
- [ ] Music present but not drowning voices
- [ ] Matches quality of `movie_teddy_dog_restored` file GHS Claude produced

**Owner:** Both Claudes — verify together

---

## 4. Path Audit — Remove All Hardcoded Windows Paths
- [x] Audit every API route for `C:/Users/USER/...` or `C:\\Users\\USER\\...`
- [x] Added to `.env`: `PYTHON_BIN`, `PIPER_BIN` (FFMPEG_PATH/FFPROBE_PATH already existed)
- [x] `check-audio/route.ts` — uses `process.env.PYTHON_BIN` → fallback `python`/`python3`
- [x] `narrate-piper/route.ts` — removed `C:\\Users\\USER\\piper\\piper.exe` hardcode
- [x] `translate/narration/route.ts` — uses `process.env.PIPER_BIN` → homedir fallback
- [x] `tts/route.ts` — uses `process.env.PIPER_BIN` → homedir fallback
- [x] Zero hardcoded `C:/Users/USER` paths remaining
- **Linux migration:** change `.env` values to `python3`, `/usr/local/bin/piper`, `ffmpeg`, `ffprobe`

**Owner:** AUT Claude
**Files to audit:** `app/api/hybrid/check-audio/route.ts`, `app/api/hybrid/narrate-piper/route.ts`, `src/config/env.ts`, all assembly routes

---

## 5. Final Smoke Test — Full Pipeline
- [ ] Open browser at `http://localhost:3200/dashboard/hybrid-planner`
- [ ] Load Teddy & Dog project
- [ ] Console shows: `[restore] Loaded from DB: proj_xxx`
- [ ] Run: Story → Parse → Character Voices → Narration → Music → Assemble
- [ ] Each step completes without error
- [ ] Ears check confirms audio in status bar
- [ ] Video appears in Asset Library
- [ ] Refresh page → DB restores all state (no data lost)

**Owner:** Henry (run the test), both Claudes (fix any failures)

---

## Notes for Linux Migration (after all above done)

When all 5 items are checked, do this before moving:

1. `git commit` everything clean
2. Change `.env` paths to Linux equivalents
3. Test one assembly on Linux
4. If clean → Linux is home base

---

## Files AUT Claude Fixed This Session (DO NOT re-edit without reading first)

| File | What was fixed |
|---|---|
| `src/lib/assembly-builder.ts` | narration_mix.mp3 only referenced when step actually built |
| `app/api/video/assemble/route.ts` | Volume ducking fixed — only first pass ducks bg to 0.35 |
| `app/api/hybrid/check-audio/route.ts` | Python path uses forward slashes, all branches show status |
| `app/dashboard/hybrid-planner/page.tsx` | Auto-pipeline includes character voices, Clear Ghost buttons added |
| `PROBLEM_AND_FIX.md` | Entries 11–16 added |
