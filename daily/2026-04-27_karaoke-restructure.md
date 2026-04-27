# Daily 2026-04-27 — Karaoke Restructure (per Final Master Canvas)

## Decision

Henry locked the Karaoke architecture per `update/GHS KERAOKE/GHS KARAOKE update.docx` (Final Master System Canvas). This supersedes the earlier MVP layout. Two surfaces, not one:

```
Sidebar group:  Create
└─ Karaoke Music Creator         (entry — input + Mode A-E selector)

Sidebar group:  Planners
└─ Karaoke Music Planner         (workshop — full 18-step pipeline)
```

This mirrors the Hybrid / Movie / Music Video / Commercial pattern: **Create = entry, Planner = workshop.**

## Source-of-truth doc map

| Doc | Role |
|---|---|
| `update/GHS KERAOKE/GHS_KARAOKE_STUDIO_PLAN.md` | TECH — 11-step pipeline + tool choices |
| `update/GHS KERAOKE/GHS Karaoke.docx` | FLOW — 10-step user-side workflow + 5 modes + UX principles |
| `update/GHS KERAOKE/GHS KARAOKE update.docx` | **MASTER** — 18-step system canvas, flow-lock rule, security, modes, provider architecture |
| `update/GHS KERAOKE/GHS KAROKE KERAOKE GEMINI.pdf` | Reference — Gemini's earlier draft |
| (legal) | covered globally via PR #18 — reuse |

Master rule (Final Master Canvas §29):
> Voice is truth. Flow is authority. AI assists. User decides. System executes.

## Architecture per Final Master Canvas

### Surface 1 — Karaoke Music Creator (under Create)

Owns ONLY:
1. **Mode A-E selector** (canvas §4 from Karaoke.docx):
   - Mode A — Voice → Music
   - Mode B — Voice → Karaoke
   - Mode C — Voice → Polished Demo
   - Mode D — Voice → Lyrics + Music
   - Mode E — Voice → Beat Match
2. **Input system** (canvas §3):
   - Browser recording (MediaRecorder + live waveform)
   - Upload file (.mp3/.wav/.m4a/.aac/.ogg/.webm, 50MB max)
   - Pick from Asset Library
   - Recent recordings
   - Paste URL
3. After input + mode picked → routes user to Karaoke Music Planner with `?recordingId=…&mode=A`

### Surface 2 — Karaoke Music Planner (under Planners)

Owns the 18-step workshop (canvas §2):

| Step | What | AI / tool | Status |
|---|---|---|---|
| 1 | Voice Input (already received from Creator) | — | ✅ |
| 2 | Vocal Cleanup | Demucs | ⏸ post-Linux |
| 3 | Audio Analysis | librosa + Whisper | ✅ |
| 4 | Melody Extraction | Spotify Basic Pitch | ⏸ post-Linux |
| 5 | Lyrics Extraction | Whisper | ✅ |
| 6 | Lyrics Intelligence | Claude Haiku 4.5 (5 levels) | ✅ |
| 7 | Flow Profiling (singing/chant/spoken/hum classifier) | librosa + Claude | 🔨 NEW |
| 8 | Beat Recommendation (11 families) | Claude + analysis | 🔨 NEW |
| 9 | Production Brief | Claude | 🔨 NEW |
| 10 | Music Generation | Suno (Kie.ai) / Mubert / Stable Audio | 🔨 NEW (needs keys) |
| 11 | Voice Enhancement | RVC | ⏸ post-Linux |
| 12 | Audio Mixing | Web Audio API | ✅ |
| 13 | Review Interface (waveform + lyrics + previews) | UI | 🔨 NEW |
| 14 | Version Comparison | UI | 🔨 NEW |
| 15 | Final Assembly | FFmpeg | 🔨 NEW (Karaoke-specific) |
| 16 | Export (MP3/WAV/vocal-only/instrumental/karaoke/short clip/hook) | UI + FFmpeg | 🔨 NEW |
| 17 | Video Pipeline (optional → Music Video Planner) | hand-off | 🔨 NEW |
| 18 | Storage Lifecycle (AES-256, TLS 1.3, 30-day purge) | infra | 🔨 NEW |

### Workshop UX expectations

- User sees ALL prior takes in a left panel (workshop history list)
- Music previews per take
- Flow status banner: "Cleanup → Analysis → Melody → Lyrics → Flow → Beat → Brief → Music → Mix → Review"
- Flow LOCK: music gen button disabled until tempo + melody + lyrics + flow + brief all complete

## Linux migration items (CANNOT DO ON WINDOWS)

These must wait for Linux deploy per `LINUX_MIGRATION_RUNBOOK.md`:

| Item | Why blocked on Windows | Linux command |
|---|---|---|
| **Demucs** vocal isolation | Pulls torch ~5GB, Python 3.13 compat fragile | `pip install demucs torch` |
| **Spotify Basic Pitch** melody → MIDI | Pulls TensorFlow, Python 3.13 fails | `pip install basic-pitch` |
| **RVC** voice enhancement | GitHub clone + heavy deps | `git clone Retrieval-based-Voice-Conversion-WebUI && pip install -r requirements.txt` |

**These three unlock:** real vocal cleanup (Step 2), real melody capture for Suno melody-conditioning (Step 4), real vocal character polish (Step 11).

Until then: Karaoke Planner runs without these layers — Steps 2/4/11 visibly marked ⏸ in UI.

## Provider keys NOT in .env (you must provision before music gen works)

| Key | Provider | Unlocks |
|---|---|---|
| `KIE_AI_API_KEY` | Kie.ai (Suno V5) | Lyrical music gen with vocals — THE main music engine |
| `MUBERT_PAT` | Mubert B2B | Instrumental long tracks (>47s) |
| `FAL_KEY` | FAL | ✅ already set — covers Stable Audio (≤47s instrumental) |

**Without `KIE_AI_API_KEY`:** Music Provider falls back to Stock Library (existing local mp3s). Functional but not Suno-quality.

## What ships in this round (Thompson task)

1. Sidebar: add "Karaoke Music Creator" under Create + "Karaoke Music Planner" under Planners.
2. New page `app/dashboard/karaoke-music-creator/page.tsx` — Mode A-E selector + 5 input methods. Routes to Planner with query params.
3. New page `app/dashboard/karaoke-music-planner/page.tsx` — full 18-step workshop UI.
4. Existing `/dashboard/karaoke-studio` becomes a redirect → `/dashboard/karaoke-music-creator`.
5. Wire Music Provider Layer (PR #20) to Karaoke Planner Step 10 (Music Generation).
6. Wire FFmpeg merge for Step 15.
7. Wire export Step 16 (5+ output formats).
8. Mode-aware routing in Planner (Mode A vs B vs C vs D vs E gates which steps run).
9. Flow-lock guard: gate Music Gen button on cleanup + analysis + melody + lyrics + flow + brief.
10. Workshop history list (recent takes across all modes).
11. Update CLAUDE.md project root with the new structure.
12. Update `update/uncomplete.md` with current state + post-Linux items.

## Deferred (not in this round)

- Step 2 Demucs (post-Linux)
- Step 4 Basic Pitch (post-Linux)
- Step 11 RVC (post-Linux)
- Step 21 deepfake prevention (Phase 2 — needs voice similarity model)
- Step 25 distributed scaling (Phase 3)

## Files / commits to expect

- New: `app/dashboard/karaoke-music-creator/page.tsx`
- New: `app/dashboard/karaoke-music-planner/page.tsx`
- New: `app/api/karaoke/flow-profile/route.ts`
- New: `app/api/karaoke/beat-recommend/route.ts`
- New: `app/api/karaoke/production-brief/route.ts`
- New: `app/api/karaoke/generate-music/route.ts`
- New: `app/api/karaoke/assemble/route.ts`
- New: `app/api/karaoke/export/route.ts`
- Modified: `app/components/Sidebar.tsx`
- Modified: `app/dashboard/karaoke-studio/page.tsx` (redirect)
- Modified: `prisma/schema.prisma` (add `mode`, `flowProfile`, `productionBrief`, `generatedMusicUrl`, `mixedOutputUrl`, `exportedFiles Json` to KaraokeRecording)

PR title: `feat(karaoke): split Creator + Planner per Final Master Canvas`
