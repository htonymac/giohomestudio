# MUST-READ — GHS / andiostudio.com

**Read this BEFORE you write any code in this repo.** It is the truth about what works, what doesn't, what was hard-won, and which dead-ends not to walk into again.

Pointer: this file's primary content lives in `update/MUST-READ_05312026.md` (the dated source of truth). When a newer dated MUST-READ is added, update this pointer.

---

## 1. Hard rules (locked, do not break)

| Rule | Why |
|---|---|
| **DO NOT touch hybrid-planner.** It is the reference implementation. Every other planner mirrors it. Breaking it breaks everything. | Mature, ≥95% complete. |
| **All NEW music must be no-attribution, commercial-safe.** Public domain (CC0, FreePD), Pixabay, Mixkit only. | Henry locked 2026-05-31. |
| **EXCLUDED:** Incompetech / Kevin MacLeod / any CC-BY (attribution required) / any CC-BY-NC (non-commercial only). | Same lock. |
| **Children-planner is monolithic (7,200 lines).** Don't add more state to it lightly. Refactor is a separate planned session. | Multi-day job. |
| **Default narration provider = Piper (free, local).** Piper is a NARRATOR not a singer. Do not use it for karaoke vocals. | Piper has no pitch/rhythm control. |
| **Branding rule:** User-facing tiers show GHS Standard / Plus / Pro / Classic / Premium / Best. NEVER show: Claude, GPT, Ollama, Grok, FAL, Suno (internal only). | Per persona_ghs. |

---

## 2. Stubborn errors fixed today (2026-05-31)

Each entry: symptom → root cause → fix commit. Read this before reinventing the same fix.

### A. "Page navigation slow — 3-second click delay"
- **Symptom:** every click on children-planner took 3 seconds to register; navigation between tabs felt frozen.
- **Root cause:** the `visualDescription` backfill `useEffect` I shipped in `286c624` called `setChildScenes(prev => prev.map(s => ...))`. Even when every scene returned unchanged, `prev.map` produced a NEW array reference. React saw state change → re-render → effect re-runs → setState again → infinite loop. Click events queued behind the loop's microtasks.
- **Fix:** `1db36ff` — compute next array first, track `changed` flag, only call `setChildScenes` when at least one scene actually got a new description.
- **Lesson:** never call `setState(prev => prev.map(...))` from a useEffect without a "changed" guard. The map always returns a new reference.

### B. "BIB" narration (Piper produces 1-second beep instead of full narration)
- **Symptom:** Generate Narration produces a ~1 second WAV that sounds like a beep, instead of a full narration. Only happens on NEW projects; the default "Untitled Children Project" works fine.
- **Root cause:** there were **THREE divergent narration-firing paths** in `app/dashboard/children-planner/page.tsx`, each with a different (and shallower) source-text fallback chain:
  - `generateNarration` (L2382) — only it had full audioPlans fallback after `2a15999`
  - Pre-flight auto-narrate (L1843) — shallow `narrationText || textContent || readAlong`
  - Per-scene inline "Generate" button (L5662) — same shallow chain
- For a NEW project, `narrationText` is empty (state-only, never saved), `textContent` is just the short URL `topicPrompt` (~30-80 chars), `scriptSegments` is empty. The shallow paths sent the 30-char prompt straight to Piper → ~1-second beep WAV.
- **Fix:** `8bde095` — extracted TWO shared helpers:
  - `getNarrationSourceText()`: sync chain `narrationText → textContent → readAlongText → scriptSegments (joined) → audioPlans (joined)`
  - `resolveNarrationText({ minLen })`: async wrapper that auto-expands via `/api/hybrid/story-expand` when result is below the picker-duration character floor.
- All 3 paths now use `resolveNarrationText`. No divergence.
- **Also fixed:** `?continue=` URL param dropped (L2832) — the Continue link from /children-video sent `?continue=child_xxx`, children-planner only read `?projectId=…` → fell back to `ghs_children_default`. Every Continue click loaded the wrong project. Fixed by `urlProjectId = projectId || continue`.
- **Lesson:** when you find ONE BIB fix, audit ALL TTS-firing paths in the same file. Henry's frustration over multiple sessions was 100% caused by divergent paths.

### C. Subtitle disappeared on assembled video
- **Symptom:** narration plays in the assembled MP4, video plays, but no subtitle text appears. Confirmed in two project URLs.
- **Root cause:** the chunked drawtext block in `/api/video/assemble` wrapped a complex `:alpha=` fade expression in ONE silent try/catch. ffmpeg's filtergraph parser occasionally rejected the alpha expression. The catch swallowed the error with no log → bare video.
- **Fix:** `dc67814` — split the filter into TWO builds:
  - **RICH**: existing chunked filter WITH alpha fade-in/out (preferred look)
  - **SIMPLE**: same chunks WITHOUT alpha — much more robust (no complex sub-expression)
- Try RICH first. On failure: `console.warn`, try SIMPLE. On second failure: `console.error`. NEVER silently drop.
- **Lesson:** silent try/catch around third-party process invocation (ffmpeg / Demucs / etc.) is always a future bug. At minimum log. Better: two-tier fallback.

### D. Karaoke project bleed (new assemble affects old)
- **Symptom:** "new assemble is affect old they are not separated per project".
- **Root cause:** server-side IS per-project (recordingId-prefixed filenames). The bleed was CLIENT-SIDE. `loadRecording()` hydrated new recording fields but never CLEARED previous state — beatRecs, brief, music, mix, lyrics, exports, selectedBeatFamily, flowProfile all stayed visible from the previous take.
- **Fix:** `dffefb9` — reset 9 client state slots at top of `loadRecording` before re-hydrating from DB.

### E. Karaoke JSON-parse error ("Unexpected token 'I', 'Internal S'...")
- **Symptom:** Flow Profiling + Beat Recommendation surface a JS parser error.
- **Root cause:** server returned an HTML "Internal Server Error" page (callLLM upstream timeout, Anthropic credit fallback edge case). Client called `await res.json()` directly → JSON.parse on HTML → opaque "Unexpected token 'I'" message.
- **Fix:** `f44be26` — `safeKaraokeJson` helper reads text first, tries JSON.parse, on fail returns `{error: "Step: HTTP NNN (server returned non-JSON: <snippet>)"}`. Wired into Steps 7 + 8.
- **Lesson:** every `await res.json()` against an API that might error MUST go through a text-first helper.

### F. Assemble button stays grey on reopened project
- **Symptom:** reopen project → scene cards render but Assemble button shows "Select scenes above to assemble" disabled.
- **Root cause:** restore effect hydrated `childScenes` but never set `assemblySelectedIds`. Auto-selection only ran inside `planScenes` paths, not restore.
- **Fix:** `d9432d8` (initial) + `a438f66` (belt-and-suspenders useEffect that auto-selects when childScenes non-empty AND selection empty AND not restoring).
- **Lesson:** when a feature is gated by state populated by only one code path, EVERY other path that restores the upstream state must also restore the gate state.

### G. "Voice afro, sound default" mismatch
- **Symptom:** Henry's voice classified as afrobeats, generated backing track is generic pop. No warning.
- **Root cause:** stock library had 14 tracks, no afrobeats. Keyword map silently fell back to `upbeat_pop.mp3`. Response said nothing.
- **Fix:** `267a01b` — expanded stock adapter to scan `freepd/` subdir (350+ tracks), classified match quality (exact / approximate / fallback), generate-music response now includes `warning: "Stock library has no <genre> — picked a generic fallback. Switch to Stable Audio or add KIE_AI_API_KEY for vocal Suno-style"` when match isn't exact.

### H. Intro/outro title says "Present My Story"
- **Symptom:** title card always says "My Story" regardless of project.
- **Root cause:** both intro and outro hardcoded `title: contentParam || "My Story"`. `contentParam` is the URL content-type param (e.g. "letters-sounds") — often missing.
- **Fix:** `bca3057` — title priority: `projectTitle (if user-customised)` → `topicParam (URL)` → `contentParam` → `"My Story"` final fallback. The editable input at the top toolbar (L3678) already feeds projectTitle.

### I. Karaoke "post-Linux" stale labels
- **Symptom:** Steps 2, 4, 11 marked "⏸ post-Linux waiting for Linux deploy" — but server IS on Linux.
- **Fix:** `f44be26` (initial relabel) + `cc0b198` (RVC keep-anyway toggle with OS confirmation) — labels now say "server install scheduled" + Step 11 has user-controlled toggle.
- **THEN:** Demucs + Basic Pitch actually installed on server today via `pip install --user demucs torch / basic-pitch tensorflow` (Step 2 and 4 binaries verified working). `172489f` shipped `/api/karaoke/vocal-cleanup` + `/api/karaoke/melody-extract` routes calling these binaries.

---

## 3. Today's safe music policy (2026-05-31 — locked by Henry)

### Sources allowed for new music ingestion

| Source | License | Commercial use | Attribution? |
|---|---|---|---|
| **FreePD** | Public Domain (CC0) | ✅ | ❌ Not required |
| **Pixabay Music** | Pixabay License | ✅ | ❌ Not required |
| **Mixkit** | Mixkit License | ✅ | ❌ Not required |
| **YouTube Audio Library** | YT-free | ✅ on YT only | ❌ Not required (usually) |

### Sources BANNED for new music ingestion

| Source | Why banned |
|---|---|
| **Incompetech / Kevin MacLeod** | CC-BY — attribution required (Henry's lock) |
| Any **CC-BY** track | Attribution required |
| Any **CC-BY-NC** track | Non-commercial only — kills paid app path |
| Any **CC-BY-SA** track | Share-alike — incompatible with proprietary use |
| **SoundCloud / YouTube** uploads without explicit license | Unverified |

### Manifest enforcement

`storage/music/stock/manifest.json` now includes per-entry fields:
- `license` (string)
- `attributionRequired` (bool)
- `commercialUseAllowed` (bool)
- `safeForFreeUser` (bool) — the field Free Mode UI filters on
- `verificationStatus` ("verified" | "pending")

Pre-2026-05 bundled tracks (14 entries + 3 normalized) all have `safeForFreeUser: false` until provenance is documented. The 65 `freepd/` files are automatically safe.

### Free Mode UI (Henry's new flow)

Old flow: record voice → AI picks music → often mismatched.
New flow: **show grid of safe beats first → user picks → record over it.**

`GET /api/karaoke/beats-library?safeOnly=1` returns the picker data. The Karaoke Music Creator page renders a grid below the mode picker so users see/preview tracks before recording.

The route ALSO scans `storage/music/stock/freepd/` directly as a fallback so the picker works during the manifest-grow interim.

---

## 4. Server install state (verified 2026-05-31)

| Binary | Path | Status |
|---|---|---|
| Python 3.10 | `/usr/bin/python3` | ✅ |
| pip (user) | `/home/ghs/.local/bin/pip` | ✅ (installed via `get-pip.py --user`) |
| Demucs | `/home/ghs/.local/bin/demucs` | ✅ (Karaoke Step 2) |
| Basic Pitch | `/home/ghs/.local/bin/basic-pitch` | ✅ (Karaoke Step 4) |
| Piper TTS | `/home/ghs/piper/piper/piper` + voices at `/home/ghs/piper/voices/` | ✅ |
| ffmpeg | system | ✅ |
| **RVC** | not installed | ❌ (no GPU — would be 10× slower) |
| **DiffSinger / SoVITS-SVC** | not installed | ❌ (post-GPU work) |

### Decisions on missing installs

- **RVC**: parked until karaoke has users. Plan: run on Henry's RTX 3060 PC or RunPod on-demand, NOT Contabo CPU. UI toggle already shipped (Step 11) — defaults OFF, prompts with cost warning on opt-in.
- **DiffSinger/SoVITS** (real singing voice synthesis): parked. Same GPU constraint. Will be needed if "AI sings" mode ever becomes a feature.

---

## 5. Active doctrines (re-read before relevant work)

- **Hybrid is the reference.** Every children/movie/commercial/auto/karaoke planner mirrors hybrid. When in doubt, look at hybrid first.
- **`narrationText` / `textContent` / `scriptSegments` / `audioPlans` are 4 different narration sources.** Children-planner has a chain (`getNarrationSourceText`) — use it, don't roll your own.
- **Scene-plan needs `fullScript`, not `summary`.** Mirror hybrid line ~1326 (`02d101d`).
- **Scene image: human-guard ONLY fires when `resolvedCharacters.length > 0`.** Object scenes (letters, words) skip the guard (`286c624`).
- **scene-image word overlay**: `{wordOverlay, overlayText}` body params burn the teaching word onto the image via sharp+SVG. Toggle in Design tab.
- **Music genre picker**: `MUSIC_GENRES` in children-planner. `auto` = let mood drive. Passed to `/api/music/generate` as `genre` body param.

---

## 6. Where to find more

| File | Purpose |
|---|---|
| `update/MUST-READ_05312026.md` | This file's full dated source — update there, then mirror here |
| `update/HANDOFF.md` | Per-session handoff entry (where I stopped, what's next) |
| `update/PROBLEM_AND_FIX.md` | Per-bug log: symptom → cause → fix → prevention |
| `update/CHANGELOG.md` | Per-commit changelog |
| `update/CHILDREN_HYBRID_PARITY_AUDIT_05302026.md` | Children vs Hybrid feature parity |
| `update/FAL_ADAPTER_MIGRATION_MAP_05302026.md` | Provider migration tracking |
| `~/.claude/projects/C--Users-USER/memory/persona_ghs.md` | Boot doc — current state snapshot |
| `~/.claude/projects/C--Users-USER/memory/error_log.md` | Global learned-fixes log |

---

## 7. Pending non-trivial items at end of 2026-05-31 session

1. **3D style picker doesn't render 3D** (#3) — style preset routing needs tracing through scene-image
2. **Firefox assembly failure** (#5) — needs Playwright probe in headed Firefox
3. **Image doesn't match narration** (#4) — biggest design problem; scene-image and narration are generated separately
4. **7,200-line children-planner refactor** (#11) — multi-day, separate session, needs plan doc first
5. **Karaoke Step 2 + 4 UI wire-up** — routes shipped (172489f); UI buttons + status display still pending
6. **Music download script** — Sonnet shipped 20-track FreePD downloader but URLs 404 — needs corrected URL pattern OR switch to Pixabay free-music API
7. **Manifest expansion** — 350+ freepd files need explicit manifest entries (currently fallback-scanned by route)
8. **Free-mode "record over chosen beat" mixing** — picker UI shipped; the actual recording-over-beat audio mixing logic is next

---

End of MUST-READ. Edit this file whenever a non-trivial session ends.
