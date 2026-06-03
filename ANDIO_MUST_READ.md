# ANDIO — MUST READ INDEX

**Purpose:** ONE entry point for every tough bug we've encountered + every task that isn't fully done. Pointers only — no content duplication. When something breaks, START HERE.

**Project:** AndioStudio (GHS — GioHomeStudio). Live at `https://andiostudio.com` via Linux server (`ssh hmk`, user `ghs`, project at `/home/ghs/giohomestudio`, running `next dev -p 3200`).

---

## 1. WHEN SOMETHING BREAKS — read in this order

1. **`update/PROBLEM_AND_FIX.md`** — every project-side bug with verbatim symptom + root cause + fix commit. Grep for your symptom.
2. **`~/.claude/projects/C--Users-USER/memory/error_log.md`** — global "learned calluses" across ALL Henry's projects. BIB-class bugs live here.
3. **`update/CHANGELOG.md`** — chronological commit-grouped record. Easier scan than git log.
4. **`update/HANDOFF.md`** — current session's where-stopped, blockers, next-steps.

---

## 2. TOUGH RECURRING BUGS — quick pointer

### BIB-class (5 variants, same destination — `_silent.mp3` placeholder)
- **Variant #1-4** — Piper voice path resolution, missing FAL fallback, audioPlans empty, narration-source divergence
  → `update/PROBLEM_AND_FIX.md` line 81 + global `error_log.md` line 780
- **Variant #5** — Piper 30s hardcoded timeout on long stories
  → `update/PROBLEM_AND_FIX.md` (entry dated 2026-06-03 BIB regression #4)
- **Prevention rule:** any silent `catch { }` in `/api/tts`, `/api/hybrid/narrate-piper`, `/api/children/generate-narration` is forbidden. Every tier must `console.error` explicitly.

### Assembly 99% stuck
- Root cause: `Arial Black` font default not on Linux → libass silently falls back to drawtext slow path; `perSegmentDuration` from text estimate not probed audio → video/audio length mismatch.
  → fixed `8ec0831` + `57e21db`; recorded in `update/PROBLEM_AND_FIX.md` "10-fix Sonnet-audit ship" entry
- File: `app/api/video/assemble/route.ts:1011` (font), `app/dashboard/children-planner/page.tsx:2235-2245` (duration)

### Next.js v16 Turbopack chunk 404
- Production build (`next start`) returns 404 for one specific scene chunk despite the file being on disk.
- Workaround: switched `npm run start` to `next dev` (commit `b42df0d`). `start:prod` kept as escape hatch.
- Real fix needed: split children-planner page (6000+ LOC) into smaller files so Turbopack emits different chunks.
- Blocks: production scaling.

### Cloudflare Tunnel 100s edge timeout
- Long assemblies > 100s used to be killed mid-fetch.
- Fixed: detached worker + fire-and-poll pattern. Worker calls `localhost:3200` not through CF.
- → `update/PROBLEM_AND_FIX.md` "Assembly 3-stage fix journey" + commits `3ee7bc6` `55222bd` `92c0d88`

### fail2ban triggers at 4+ parallel SSH
- Proven mid-session 2026-06-02 when 4 Sonnets ssh'd in parallel. Locks Claude out for ~10-30 min.
- Mitigation: bunch SSH-using agents 1-2 at a time, or whitelist PC IP via sudoers config.

### Action images show "smiling people" not action
- Root: scene-image route uses `scene.visualDescription` + `scene.title` but NOT the narration text slice for that scene.
- Henry's complaint 2026-06-03: stories with fight/kick/chase show passive smiling characters.
- Action extractor (`src/lib/scene/action-extractor.ts`) WORKS but only sees the visualDescription text — doesn't see "spin and deliver a kick" if that's in the narration.
- Status: TO FIX — pass scene's narration slice into sceneText for `/api/hybrid/scene-image` body.

---

## 3. TASKS NOT FULLY IMPLEMENTED — pointer + file

### Production-scale architecture
- **Queue layer (Redis + BullMQ)** for assemblies — NOT built. Required for >5 concurrent users.
- **Separate render worker nodes** — NOT built. Single Linux server is the only renderer.
- **GPU encoding (NVENC)** — NOT built. CPU-bound libx264 is the bottleneck.
- **Production build** — blocked by Turbopack chunk bug (see §2 above).
- → blocks Henry's launch target (3K students + 1K teachers, 20 concurrent).

### Other planners — partial parity with children
- **Movie Planner** — has De-vocabularize button (commit `2056156`) but no pacingEntries flow, no flip-rate, no font-size picker, no probed-audio duration.
  → file: `app/dashboard/movie-planner/page.tsx`
- **Commercial Planner** — same status.
  → file: `app/dashboard/commercial-planner/page.tsx`
- **Music-Video Planner** — TODO(pacing) comment only.
  → file: `app/dashboard/music-video-planner/page.tsx`
- **Karaoke Planner** — uses `/api/karaoke/assemble` (different pipeline). Not in scope of children fixes.

### Pacing 0-entry guard
- If `pacingPlan.entries` exists but all are type=`pause`, the assemble route falls through to chunked timing silently. User has no warning.
- → fix: client warning "Pacing plan has no usable entries (all pauses) — using chunked subtitle timing instead".

### ASS subtitle error surfaced to UI
- Currently logged to `console.error` (`route.ts:1104`), visible only via `journalctl -u ghs.service`.
- Fix 9 of the 10-fix audit ship was deferred. Should write the ASS-failure reason into the job-status file so it appears in the polling UI.

### `_silent.mp3` 0-byte WAV second failure mode
- After commit `8807b18` fixed the Piper 30s timeout, 3 more silent files were created today between 07:34-07:37 UTC.
- Pattern: 0-byte `.wav` sibling to `_silent.mp3` of same timestamp = Piper started, exited with 0 bytes written.
- Hypothesis: Piper crashes on specific text (Unicode, special chars, very long single line).
- Status: NOT investigated. Need to capture stderr output for a failed run.

### Storage Cleanup tool — built BUT
- Live at `/dashboard/storage-cleanup` (commit `12c042c`).
- Missing: auto-find orphans (files not referenced by any project), age-based purge ("delete files older than N days").
- Files: `app/api/storage/list/route.ts`, `app/api/storage/delete/route.ts`, `app/dashboard/storage-cleanup/page.tsx`.

### Pacing Plan persistence and integration
- `pacingPlan` saves to `subtitleConfig` via flushCurrentProject but does NOT save `pacingTimingMap` from prior session.
- Restored only if `d.pacingTimingMap` exists in saved data → most older projects re-build from scratch on reopen.
- File: `app/dashboard/children-planner/page.tsx` (search `setPacingTimingMap`).

### Octogent integration (server-side execution)
- Octogent runs on server at port 8788 for GHS. Lets Claude execute commands without SSH (avoiding fail2ban).
- Henry asked 2026-06-03 why I'm not using it directly.
- Status: not wired into this session's workflow — I've been using direct SSH which triggers fail2ban.
- → file: `Desktop/CLAUDE/AU AUTOMATION/AUT-OCTOGENT.md` (master playbook)

---

## 4. CRITICAL FILES — paths only, read on demand

| Area | File | Notes |
|---|---|---|
| Children planner UI | `app/dashboard/children-planner/page.tsx` | 6000+ LOC — split needed for prod build |
| Hybrid planner (reference) | `app/dashboard/hybrid-planner/page.tsx` | DO NOT TOUCH — Henry's hard rule |
| Assemble route | `app/api/video/assemble/route.ts` | 1500+ LOC, all ffmpeg pipeline |
| TTS route | `app/api/tts/route.ts` | 5-tier fallback chain |
| Hybrid narrate-piper | `app/api/hybrid/narrate-piper/route.ts` | per-scene narration |
| Children generate-narration | `app/api/children/generate-narration/route.ts` | pacing flow |
| Scene image gen | `app/api/hybrid/scene-image/route.ts` | uses action-extractor |
| Action extractor | `src/lib/scene/action-extractor.ts` | PROTECTED block — confrontation/fight/chase/etc patterns |
| Worker | `scripts/assemble_job_worker.mjs` | detached process, polls heartbeat |
| Job status | `app/api/video/job-status/route.ts` | dead-worker detector |
| Env config | `src/config/env.ts` | storagePath, ffmpegPath, fontDir |
| Master plan | `MUST-READ.md` | older root-cause + lesson log |

---

## 5. ONE-LINE BOOT FOR FUTURE CLAUDE SESSIONS

If you're a future Claude continuing GHS work, your boot sequence is:
1. Read THIS file first (`ANDIO_MUST_READ.md`).
2. Read `update/HANDOFF.md` to see where the last session stopped.
3. Grep `update/PROBLEM_AND_FIX.md` for any symptom matching the current task before debugging.
4. Use `octogent` (port 8788) over direct SSH when possible — avoids fail2ban.
5. NEVER touch `app/dashboard/hybrid-planner/*` without explicit Henry GO.

**Henry's hard rules:** no silent catches in TTS paths · no hybrid-planner edits · no file-stacking on one side · no destructive ops without confirmation.

---

**File maintainer note:** this file is an INDEX only. When you record a new tough bug or unfinished task, ADD A POINTER here that links to where the full content lives. NEVER copy full content into this file — keep it scannable.
