# Karaoke — Proper Plan (locked 2026-05-31)

Henry's rules for this plan:
1. **No more "next week" deferrals.** Anything CPU-friendly ships this session.
2. **No heavy installs on the Contabo server.** Anything that would burn 10-20 minutes of CPU per request stays as a UI toggle only — wire the backend WHEN the GPU lands, not before.
3. **No disk waste.** Don't pre-cache models for things that can't run usably.

---

## Tier 1 — ship THIS session (Sonnet-dispatchable, all CPU-safe)

| ID | Item | What it is | Why now |
|---|---|---|---|
| **T1-A** | **Async job queue for slow steps** | Background-job table + `/api/jobs/<id>` polling endpoint. Demucs + Basic Pitch routes return `{ jobId }` immediately, run in worker, UI polls until done. | Today these are SYNC 60-180s requests. User closes the tab → job lost. |
| **T1-B** | **Free Mode record-over-beat mix** | When user picked a beat in the new picker, the recorder now plays the beat in their headphones (Web Audio) + ffmpeg mixes user's voice on top after upload. | Picker UI shipped (4a4cb67); the actual mix-over logic isn't wired. |
| **T1-C** | **Step 18 purge cron** | Daily cron deletes karaoke_recordings rows where `purgeAt < now()` plus all files in storage/karaoke/*/<id>*. Logs each purge. | Compliance — label already says 30-day, no enforcement code. |
| **T1-D** | **Step 17 Music Video handoff** | `Send to Music Video Planner` button POSTs the karaoke output to `/api/music-video/from-karaoke` which mints a Music Video Planner project preloaded with the mixed audio. | UI exists; no wire. |
| **T1-E** | **License badges in export metadata** | When user exports an MP3, ffmpeg `-metadata` tags include `comment="Music: <track>, license: <LICENSE_TAG>"` + a sidecar `.txt` listing all licensed assets. | Legal hygiene before any paid tier. |
| **T1-F** | **Progress bars during long steps** | Each step row reads `job.progress` and renders a thin progress fill. Uses the same polling channel as T1-A. | UX. |

Dispatch order: T1-A first (others depend on it for clean UX), then T1-B…T1-F in parallel via Sonnet.

---

## Tier 2 — UI toggle only, NO backend (heavy CPU jobs)

These get the same treatment as RVC already (`cc0b198`): a checkbox + confirmation dialog warning the user about the time cost. Backend stays off. Wire it later when GPU lands.

| ID | Item | Toggle copy | Backend status |
|---|---|---|---|
| **T2-A** | **RVC Voice Enhancement** (Step 11) | Already shipped: "+10-20 min per 60s on CPU" warning | Not installed. Wire to RunPod/RTX 3060 when GPU lands. |
| **T2-B** | **AI Singing — DiffSinger** (new opt-in mode) | New: "AI sings your lyrics — needs GPU. CPU mode = 5-10 min per 30s. Continue?" | Not installed. Wire after GPU. |
| **T2-C** | **AI Singing — Bark with `♪` lyric tags** | New: "Bark sings melodically — CPU mode ~30s per 13s of audio. Continue?" | Not installed. Wire after GPU. |
| **T2-D** | **Suno-quality music via Kie** (Step 10) | UI already shows "KIE_AI_API_KEY not configured — will use Stock" | Backend exists, just needs key. |

Disk impact of Tier 2 toggle-only = 0 bytes. UI weight = ~30 lines of JSX each.

---

## Tier 3 — defer to GPU-arrival session

Real audio quality upgrades that need GPU to ship at acceptable latency:

| ID | Item | Trigger |
|---|---|---|
| **T3-A** | RVC backend install + route | Henry adds GPU (RunPod / RTX 3060 PC microservice) |
| **T3-B** | DiffSinger backend install + route | Same |
| **T3-C** | Bark backend install + route | Same (Bark works on CPU but 30s/13s is unusably slow for real songs) |
| **T3-D** | Demucs htdemucs_ft (more accurate model) | Same — current htdemucs is good-enough on CPU |
| **T3-E** | RVC voice-clone training UI | Same + 8-12GB VRAM minimum |

---

## Tier 4 — external-blocker items (wait on Henry's actions)

| ID | Item | Blocker |
|---|---|---|
| **T4-A** | Suno lyrical music quality | Henry sets `KIE_AI_API_KEY` env var |
| **T4-B** | Mubert long-form instrumental | Henry sets `MUBERT_PAT` |
| **T4-C** | Real afrobeats / world-genre stems | Source decision — Pixabay scrape OK once Henry chooses curation cadence |
| **T4-D** | Encrypted-at-rest (AES-256) for storage | Compliance decision — encryption library + key management + access patterns |

---

## What this session ships

Six Sonnet sub-agents dispatched in parallel, all bounded scope:

1. **S-Queue**: build `karaoke_jobs` Prisma model + `/api/jobs/<id>` endpoint + refactor `/vocal-cleanup` and `/melody-extract` to enqueue not run-sync
2. **S-Mix**: Free Mode mix-over-beat (Web Audio in browser + ffmpeg amix on server)
3. **S-Purge**: daily cron `node scripts/karaoke_purge.mjs` + systemd timer
4. **S-Handoff**: Step 17 button → `/api/music-video/from-karaoke`
5. **S-Badge**: ffmpeg `-metadata` tags + sidecar .txt on export
6. **S-Progress**: progress polling display + per-step progress bar

---

## What this session does NOT ship (Henry-approved)

- ❌ RVC backend (toggle only — already shipped)
- ❌ DiffSinger backend (toggle only — new this session)
- ❌ Bark backend (toggle only — new this session)
- ❌ Any model download requiring more than a few hundred MB of disk

---

## Acceptance criteria

A user opening Karaoke Music Planner today should be able to:
1. Pick a recording (or upload)
2. Click each step's Run button in order — none of them sync-block the UI
3. See real-time progress for the slow steps (Demucs ~1 min, Basic Pitch ~30s)
4. Generate music via Stock/FAL — works without Kie key
5. Assemble final MP3
6. Export with embedded license tags in metadata
7. Hit "Send to Music Video Planner" and land on a planner project preloaded with the karaoke audio
8. See a "✗" delete button per take, with dependency warning if linked to a Music Video project
9. Tracks purged 30 days after creation automatically

A user opening Karaoke who wants RVC / AI singing sees the toggle + cost warning. Says "yes" → toggle persists. The actual processing stays disabled until GPU is wired. Honest.

---

## End of plan
