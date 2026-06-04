# ANDIO — MUST READ INDEX

**Purpose:** ONE entry point for every tough bug we've encountered + every task that isn't fully done. Pointers only — no content duplication. When something breaks, START HERE.

**Project:** AndioStudio (GHS — GioHomeStudio). Live at `https://andiostudio.com` via Linux server (`ssh hmk`, user `ghs`, project at `/home/ghs/giohomestudio`, running `next dev -p 3200`).

---

## 1. WHEN SOMETHING BREAKS — read in this order

1. **`BIG_PROBLEM_ANDIO_FIX.md`** — the 16 architectural / scale / cost / security / lawsuit time bombs with junior-dev explanations + fix code skeletons + execution plan. **READ THIS BEFORE LAUNCH.**
2. **`update/PROBLEM_AND_FIX.md`** — every tactical bug we've already fixed with verbatim symptom + root cause + commit. Grep for your symptom.
3. **`~/.claude/projects/C--Users-USER/memory/error_log.md`** — global "learned calluses" across ALL Henry's projects. BIB-class bugs live here.
4. **`update/CHANGELOG.md`** — chronological commit-grouped record. Easier scan than git log.
5. **`update/HANDOFF.md`** — current session's where-stopped, blockers, next-steps.

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

### Subtitle font size doesn't take effect on video (FIXED `44e7bca`)
- Picker UI worked but only patched the CHUNKED caption path. Per-scene PNG subtitle path had 4 hardcoded `52` values that ignored `subtitleConfig.fontSize`. Now all 4 sites use `perSceneFontSize` derived from `subCfg.fontSize`.
- File: `app/api/video/assemble/route.ts` (search `perSceneFontSize`).

### Intro/outro shows hardcoded "GIO HOME AI STUDIO" (FIXED `44e7bca`)
- 5 hardcoded sites: intro gen, outro gen, Screenplay tab preview x2, Story Credits placeholder.
- Now: `studioName` state with editable input in Story Credits card. Persists per project.
- File: `app/dashboard/children-planner/page.tsx` (search `studioName`).

### Learning mode narration sounded like storytelling, not teacher (FIXED `44e7bca`)
- Was hardcoded "gentle storytelling" voice for ALL modes including phonics/word/video_lesson.
- Now `pickPiperVoice()`:
  - Learning modes (phonics, word, video_lesson) → `en_GB-alan-medium` (British male teacher)
  - read_along → `en_US-libritts_r-medium` (clearer enunciation)
  - Story modes (storybook, poem, sentence) → `en_US-amy-medium` (warm narrator)
- File: `app/dashboard/children-planner/page.tsx` (`pickPiperVoice` function).

### Action images show "smiling people" not action
- Root: scene-image route uses `scene.visualDescription` + `scene.title` but NOT the narration text slice for that scene.
- Henry's complaint 2026-06-03: stories with fight/kick/chase show passive smiling characters.
- Action extractor (`src/lib/scene/action-extractor.ts`) WORKS but only sees the visualDescription text — doesn't see "spin and deliver a kick" if that's in the narration.
- Status: TO FIX — pass scene's narration slice into sceneText for `/api/hybrid/scene-image` body.

---

## 2.5 LAUNCH-BLOCKER TIME BOMBS — read `BIG_PROBLEM_ANDIO_FIX.md`

**16 strategic risks** documented with junior-dev-readable explanations + fix code + verification rules:

| # | Problem | Severity | Effort |
|---|---|---|---|
| 1 | No multi-tenancy (no `tenant_id`) | LAUNCH BLOCKER | 1-2 days |
| 2 | No Row-Level Security in Postgres | LAUNCH BLOCKER | 1 day |
| 3 | Files >4000 lines (children-planner 8359, hybrid 13567) | BLOCKS PROD BUILD | 2-3 days |
| 4 | Single Linux VPS + no queue | FAILS AT >5 USERS | 3-5 days |
| 5 | LLM cost runaway (no semantic cache, no model routing) | $5K SURPRISE BILL RISK | 2 days |
| 6 | **API rate limit apocalypse** (no backoff, no breaker, no budget cap) | KILLS LAUNCH DAY | 2 days |
| 7 | **LEGAL** — no ToS/Privacy/DMCA/AI Policy/COPPA/AUP | LAWSUIT EXPOSURE | 1-2 days |
| 8 | No CDN for video output | BANDWIDTH CAP | 1-2 days |
| 9 | No cost monitoring | BLIND FLYING | 1 day |
| 10 | No audit log | LEGAL DEFENSE GAP | 1 day |
| 11 | Shared access code (single key) | ROTATION PAIN | 3-5 days |
| 12 | No read replicas / no geo routing | LATENCY | 1 week (Phase 4) |
| 13 | No AI semantic cache | OVERLAPS #5 | 2 days |
| 14 | No image cache | OVERLAPS #5 | 1 day |
| 15 | No tests | QUALITY DRIFT | ongoing |
| 16 | No staging environment | NO SAFETY NET | 1 day |

**Phase 1 (must land before public launch):** items 1, 2, 5, 6, 7
**Phase 2 (must land before 100 concurrent users):** items 3, 4, 8, 9, 10
**Phase 3 (before 1K paying users):** items 11, 13, 14, 15, 16
**Phase 4 (1K+):** item 12

Full code skeletons + verification steps + prevention rules for each are in `BIG_PROBLEM_ANDIO_FIX.md`.

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

## 5. COMPLETE FIX INDEX — every shipped commit, grouped by theme

**Save points (tags pushed to origin):**
- `v2026-06-03-stable` at `f14e9c7` — 10-audit fixes + action images + ANDIO_MUST_READ
- `v2026-06-03-stable-2` at `f14e9c7` — same, pre-font-bump snapshot

Roll back to either with `git checkout <tag>`.

**Full per-commit detail:** `update/CHANGELOG.md`. The list below is the INDEX so any future session can find a fix without scanning 60+ commits.

### A. Subtitle pipeline (largest theme — 12 commits)

| Commit | Fix | File:line |
|---|---|---|
| `a501dc2` | Phase A: kill 2-subtitle overlap (per-scene PNG suppressed when caption/pacing exists) | `assemble/route.ts` perSceneSubtitleEnabled |
| `a501dc2` | Phase C: rainbow + typewriter route to drawtext; per-chunk RAINBOW_PALETTE cycling | `assemble/route.ts` colorForChunk |
| `486ec47` | Phase B: client ships `pacingEntries[]`; server builds ASS Dialogue from exact ms timings | `assemble/route.ts:1035`, `page.tsx:2292` |
| `2eb32b8` | ASS subtitle path via libass — 10× faster than chained drawtexts | `assemble/route.ts:987` |
| `4cfb224` | Slow chunked-caption pace 1.6s → 2.4s/chunk | `assemble/route.ts:949` SEC |
| `b6195b8` | Slow chunked further 2.4s → 4.0s/chunk (1.25 w/s comfortable read) | same |
| `300e7d9` | Audio-probed pacing scale (ffprobe narrator → exact stretch ratio) | `assemble/route.ts:1037` |
| `bbf4135` | ASS timeout 120s → 600s + explicit `-preset ultrafast` | `assemble/route.ts:1097` |
| `8ec0831` | Font default `Arial Black` → `DejaVu Sans` (Linux-installed) — KILLS the silent fallback to drawtext | `assemble/route.ts:1011` |
| `8ec0831` | Drawtext fallback `-preset ultrafast` (was medium) + timeout 180→300s | `assemble/route.ts:1093, 1108` |
| `c83357d` | Subtitle font size picker (Small/Medium/Large/XL + numeric input) | `page.tsx` Assembly tab |
| `44e7bca` | Font size applied to per-scene PNG path (was hardcoded 52) | `assemble/route.ts:165` perSceneFontSize |
| `e08eade` + `689f64f` | Max font 120 → 200 + XXL 128 + JUMBO 160 presets | same + UI |

### B. Assembly speed (8 commits)

| Commit | Fix | Impact |
|---|---|---|
| `9101e87` | Cap scene concurrency at 4 (was: spawn N → Empty-reply crash at N>10) | Stops fork-bomb |
| `1ba16cc` | Bumper concat stream-copy + ultrafast fallback | ~15-30s saved |
| `6f383ff` | Scene concat stream-copy + ultrafast fallback | ~600s saved on 63-segment videos |
| `bbf4135` | ASS pass explicit ultrafast preset | ~60-180s instead of 300+ |
| `495a789` | Probe ACTUAL narrator audio with HTMLAudioElement (not text estimate) | Image distribution matches audio |
| `dfa4839` | Children client: cap 7 entries (was 70 — Max+beat explosion) | 10x payload reduction |
| `d8dbb3c` | Drop Max-toggle gate — use ticked beats always | Restores user control |
| `71d769f` | Image flip rate picker (0.5/1/2/3/5s per beat) | User-tunable pace |

### C. Narration / TTS (BIB-class — 6 commits)

| Commit | Fix | BIB # |
|---|---|---|
| `8807b18` | Piper timeout SCALES with text length (was 30s hardcoded for any length) | #4 prevention |
| `c209d55` | `narrate-piper` timeout also scales (was 120s hardcoded) | Hybrid same fix |
| `c209d55` | `/api/children/generate-narration` rewired from `localhost:5000` daemon → `/api/tts` | Pacing narration works on Linux |
| `57e21db` | Client rejects `engine === "placeholder"` at all 4 TTS call sites | #5 prevention |
| `57e21db` | `generatePacingNarration` also sets `narratorAudioUrl` (bridge) | Pacing audio actually used |
| `44e7bca` | `pickPiperVoice()` — learning modes get teacher voice, story modes get narrator voice | Voice quality fit |

### D. Worker durability (7 commits)

| Commit | Fix |
|---|---|
| `92c0d88` | Spawn detached worker process (was: Next.js discarded background promises after response) |
| `55222bd` | `assemble-async` force `localhost:3200` (was sending internal fetch back through Cloudflare) |
| `3ee7bc6` | Fire-and-poll pattern bypasses CF Tunnel 100s edge timeout |
| `378982a` | Retry with backoff + 127.0.0.1 — survives service restart race |
| `e73058c` | Smart probe (1s polls until `/api/health` responds) replaces blind 60s wait |
| `6e370a9` | Worker heartbeat every 8s — status file shows current elapsed sec |
| `af7bea1` | Dead-worker detector in job-status (stale > 3 min → synthetic error) |

### E. Children planner UI (10+ commits)

| Commit | Fix |
|---|---|
| `486ec47` | De-vocabularize for ages 5-8 (LLM rewrites story for target reading age) |
| `45fcfe0` → `6eae854` | De-vocabularize button moved from big card to inline modify-row with `prompt()` |
| `a501dc2` | Project Delete + Export (JSON download) per card |
| `a501dc2` | New projects persist immediately as OPEN with timestamp titles |
| `300e7d9` | Made Delete/Export buttons LARGE (was 8px emoji invisible) |
| `e4fec04` | Show REAL server heartbeat elapsed time on progress bar (was client-estimated 95% cap) |
| `b8e95c1` | UI poll cap 12min → 20min + honest timeout message |
| `cccb563` | Outro layout compact (title close to credits) + AI cast list with Piper voice tag |
| `44e7bca` | Studio Name editable in Story Credits (was hardcoded "GIO HOME AI STUDIO") |
| `f14e9c7` | Action images: pass narration slice + drop "friendly" on action scenes |
| `12c042c` | Storage Cleanup page at `/dashboard/storage-cleanup` (browse + delete files) |
| `256fe24` | TDZ fix — compute scene narration share BEFORE segmentation loop |
| `b2464db` | Option A — skip auto-expand+TTS when narration already ready + yellow speed tip |
| `b8e95c1` + 4 others | Story Credits Written by/Made by/Idea from, localStorage persist, always-visible on Screenplay tab |

### F. Other planner ports (3 commits, Sonnet-shipped)

| Commit | Planner | What |
|---|---|---|
| `2056156` | Movie | De-vocabularize button (ages 5-18) |
| `f272330` | Commercial | De-vocabularize button (targets `keyMessage`) |
| `5f4ab90` | Music-Video | TODO(pacing) comment — input is lyrics, De-vocab skipped |

### G. Image generation (2 commits)

| Commit | Fix |
|---|---|
| `32e450f` | Image gen error messages show full HTTP + body; `finally{}` block prevents stuck Regen button |
| `f14e9c7` | Action images — narration slice + dynamic mood when action verbs detected (see §A row above too) |

### H. Build / dev infra (4 commits)

| Commit | Fix |
|---|---|
| `92c0d88` | Detached worker process for assembly background work |
| `6176a50` → `b42df0d` | Next.js v16 Turbopack chunk 404 — workaround: `npm run start` switched to `next dev`; `start:prod` kept |
| `12c042c` | Worker reads `STORAGE_PATH` env (was hardcoded `../storage` relative) |
| `55222bd` | assemble-async no longer routes internal fetch through Cloudflare |

### I. Project management infra (3 commits)

| Commit | Fix |
|---|---|
| `12c042c` | NEW `/api/storage/list` + `/api/storage/delete` + `/dashboard/storage-cleanup` page (browse + bulk delete) |
| `a501dc2` | DELETE endpoint added to `/api/hybrid/saved-state` |
| `b9c16e0` + `18535be` | This file (`ANDIO_MUST_READ.md`) + READ-FIRST block in `CLAUDE.md` |

### J. Docs (8 commits)

| Commit | What |
|---|---|
| `b9c16e0` | Created this `ANDIO_MUST_READ.md` index |
| `18535be` | `CLAUDE.md` READ-FIRST block points at the 5 critical files |
| `b528bca` | `PROBLEM_AND_FIX.md` BIB regression #4 (Piper 30s timeout) |
| `09cb5e0` | `CHANGELOG.md` 24h session record — 29 commits grouped by theme |
| `d2acb6a` | `CHANGELOG.md` + `PROBLEM_AND_FIX.md` 10-fix audit shipment |
| `3174260` | `PROBLEM_AND_FIX.md` font/studio/voice fix |
| Multiple updates to global `~/.claude/.../memory/error_log.md` BIB #5 prevention rule |

---

## 7. ONE-LINE BOOT FOR FUTURE CLAUDE SESSIONS

If you're a future Claude continuing GHS work, your boot sequence is:
1. Read THIS file first (`ANDIO_MUST_READ.md`).
2. Read `update/HANDOFF.md` to see where the last session stopped.
3. Grep `update/PROBLEM_AND_FIX.md` for any symptom matching the current task before debugging.
4. Use `octogent` (port 8788) over direct SSH when possible — avoids fail2ban.
5. NEVER touch `app/dashboard/hybrid-planner/*` without explicit Henry GO.

**Henry's hard rules:** no silent catches in TTS paths · no hybrid-planner edits · no file-stacking on one side · no destructive ops without confirmation.

---

**File maintainer note:** this file is an INDEX only. When you record a new tough bug or unfinished task, ADD A POINTER here that links to where the full content lives. NEVER copy full content into this file — keep it scannable.
