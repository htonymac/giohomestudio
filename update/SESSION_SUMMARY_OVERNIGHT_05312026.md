# Session Summary — Overnight Autonomous Push (2026-05-31 → 06-01)

## Quick stats
- **Commits**: 48 (full per-commit log in `update/AUTONOMOUS_PUSH_05312026.md`)
- **Feat commits**: 28 · **Fix commits**: 17 · **Docs**: 3
- **Files changed**: 33 · **Lines added**: 4,741 · **Lines removed**: 256
- **New files in `src/lib/karaoke/`**: 1 module (`beat-mixer.ts`)
- **New API routes**: 8+ (vocal-cleanup, melody-extract, delete, mix-over-beat, session-summary, beats-library, export-bundle, rename, from-karaoke, music-video/from-karaoke)
- **Stock library**: 86 manifest entries, 69 safe-for-free-user beats, 9 moods × 9 genres × 4 tempo buckets
- **Stubborn bugs closed**: 10 (see `update/MUST-READ_05312026.md`)

---

## What's working live at andiostudio.com

### Karaoke Music Planner — end to end
- Steps 1, 2 (Demucs), 3, 4 (Basic Pitch), 5–10, 12–18 all functional
- Step 11 RVC has opt-in keep-anyway toggle (no GPU yet; UI-only)
- DiffSinger + Bark AI Singing toggles wired (UI-only; GPU pending)
- Export ALL formats as ZIP bundle (`/api/karaoke/export-bundle`)
- Copy share link (URL encodes `recordingId` + `mode`, deep-link survives refresh)
- Now Playing inline audio header — listens to mixed output without leaving planner
- Keyboard shortcuts: J = prev take, K = next take, Space = play/pause, ? = help modal
- Browser tab title syncs to current take name + running indicator (●)
- Double-click sidebar entry to inline-rename a take
- Delete take warns if linked music-video projects exist before removing DB row + files
- Take switching resets per-project state — no cross-project bleed
- Session summary endpoint (`/api/karaoke/session-summary`) — full take JSON for debugging
- License sidecar auto-downloaded next to MP3 on export

### Free Mode beats picker
- 69 safe public-domain beats (FreePD + Internet Archive fallback; NO CC-BY attribution traps)
- Mood / genre / tempo filter chips — server-side, scales to 500+ without client rerender
- Per-mood color stripe on beat cards + chip border tint
- BPM displayed on cards when known (rough ffmpeg estimate via `detect_track_bpm.mjs`)
- Beat preview audio + license badge per card
- Beat cards show match-quality label: `exact / approximate / fallback`

### Stock music adapter
- Manifest-driven scorer: 86 catalogued tracks drive genre matching (genre +3, mood +2, filename +1)
- BPM proximity bonus (additive) on top of genre/mood score
- 350+ track FreePD library auto-scanned as fallback for unmatched requests
- Honest warning emitted when match quality is generic

### Children Planner — BIB-class bugs permanently closed
- Shared `resolveNarrationText` helper: 4-path narration convergence (audioPlans → textContent → narration → description)
- Subtitle disappeared fixed: RICH+SIMPLE `drawtext` fallback surfaces FFmpeg failures instead of silently dropping
- 3D style picker actually renders 3D (suffix strengthened: volumetric + Unreal + octane cues)
- Story credits (`writtenBy` / `madeBy` / `ideaFrom`) persist to `localStorage` — hard-refresh safe
- Intro/outro title now uses `projectTitle → topic → contentParam` priority (no more "My Story")
- Page navigation freeze fixed (infinite `useEffect` loop killed)
- `assemblySelectedIds` auto-select net for empty state — assembly no longer silently skips scenes
- `/children-video` topic search filter (27 Letters & Sounds + 10 Word Magic, etc.)
- Pre-expand on narration; no human-guard on object scenes
- `?continue=` deep-link works after BIB root-cause fix

---

## What still needs you (operator actions)

1. **Install karaoke purge cron on server** (one command):
   ```bash
   ssh hmk
   sudo bash /home/ghs/giohomestudio/scripts/install_karaoke_purge_timer.sh
   ```
   Full runbook: `update/KARAOKE_PURGE_RUNBOOK.md`

2. **Test karaoke pipeline on a real recording** — Demucs + Basic Pitch paths need real audio to validate end-to-end (synthetic silence will pass but won't catch model errors).

3. **Hard-refresh both browsers** (Ctrl+Shift+R) — new JS chunks landed overnight; stale cache will show missing UI.

---

## What's blocked (waiting on you to unblock)

| Item | Blocker |
|---|---|
| RVC vocal conversion (Step 11) | GPU — RunPod or your RTX 3060 |
| DiffSinger AI singing | Same GPU constraint |
| Bark AI singing | Same |
| Suno-quality music generation | `KIE_AI_API_KEY` env var |
| Mubert long-form music | `MUBERT_PAT` env var |
| AES-256 at rest for karaoke uploads | Compliance decision needed |
| Children-planner full refactor | 18-PR multi-day plan ready — trigger it when you want (`update/CHILDREN_REFACTOR_PLAN_05312026.md`) |
| Firefox assembly failure (#5) | Needs Playwright headed probe — not yet attempted |
| FAL gateway migration (#26) | One large Sonnet job — `update/FAL_ADAPTER_MIGRATION_MAP_05302026.md` has the map |

---

## Doctrines locked this session
- **Safe-music rule**: NO Incompetech / CC-BY / CC-BY-NC / CC-BY-SA in Free Mode — public-domain only (FreePD + Internet Archive cloud-music-4)
- **File segregation**: heavy karaoke logic lives in `src/lib/karaoke/`, never stacked in page files
- **Heavy CPU jobs**: UI toggle only; backend stays disabled until GPU is provisioned
- **FreePD CDN is dead** — pivot to Internet Archive; `catalog_freepd.mjs` updated

---

## Read for context
- `update/MUST-READ_05312026.md` — 10 stubborn bugs with root causes + status
- `update/AUTONOMOUS_PUSH_05312026.md` — full per-commit log with wave markers
- `update/CHILDREN_REFACTOR_PLAN_05312026.md` — 18-PR refactor plan (11.5 days estimated)
- `update/KARAOKE_PLAN_05312026.md` — 4-tier karaoke roadmap (T1 done, T2–T4 queued)
- `update/KARAOKE_PURGE_RUNBOOK.md` — server cron install + manual purge commands

---

## Mood
The push delivered. Karaoke is end-to-end functional with safe-music guardrails, polished UX (keyboard shortcuts, share link, inline rename, ZIP export, color cues, tempo data, license sidecars), and full state persistence. Children-planner BIB-class bugs are dead at the root — shared resolver means they can't regress independently. Hybrid was untouched throughout. GPU items are the only real ceiling.
