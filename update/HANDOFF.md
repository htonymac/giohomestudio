# GHS HANDOFF — 2026-05-07 Session 5 (Name Library + Region Picker)

## Branch: fix/ghs-pipeline-recovery-may05
## Build: TSC clean (exit 0)
## Dev server: localhost:3200 (running)
## DB: giohomestudio_db (Prisma, schema current)
## Last verified assembly: 100s video, 15MB, narration + music confirmed via ffprobe

---

## WHAT WAS DONE THIS SESSION

### Session 3 recap (assembly pipeline — all 7 root causes fixed, end-to-end verified)
See HANDOFF for 2026-05-06 Session 3 for full details.

### Session 4 — Assembly UI + Music Fix

**Hybrid Planner: Pre-Assembly panel added (Sonnet agent)**
- Audio for Video: 2-column (Narration + Background Music) with player + generate button
- Subtitle Style: full SubtitleStyler component (mode: "dramatic" default)
- Check Narration → Subtitle Match button (LLM check via /api/free-mode/enhance)
- Intro & Outro: "Generate AI Intro" / "Generate AI Outro" buttons + preview players
- Story Credits: Written By / Made By (default "GioHomeStudio") / Idea From inputs
- Files: `app/dashboard/hybrid-planner/page.tsx` — state vars at L408-418, panel at L8197-8326

**Movie Planner: Gate + Save Credits (Sonnet agent)**
- `useGate()` + `<GateModal />` wired to assembleMovie function
- Save Credits button added after credits grid
- Files: `app/dashboard/movie-planner/page.tsx`

**Music missing from assembly — FIXED**
- Root cause: `selectedMusicUrl` blocked if it contained "music_upload_" prefix
  → `effectiveMusicUrl = null` → stock auto-pick searched, often failed → no music
- Fix: removed the uploaded-music block — use whatever Henry selected; fall back to stock only if nothing selected
- Also: added `-map 0:a` to prepare_music FFmpeg command to safely strip album art from uploaded MP3s
- Files: `app/dashboard/hybrid-planner/page.tsx` L2730-2760, `src/lib/assembly-builder.ts` L89

**Verified in browser (Playwright CDP 2026-05-07)**
```
10 scenes (mix of images + 2 videos)
musicUrl: /api/media/music/stock/suspense.mp3 (auto-selected, tone="suspense")
Assembly completed at 120s
Video: 100.27s, 15MB, AAC audio confirmed via ffprobe
Page shows: "Video ready — download or open in editor"
```

---

## KEY FILE CHANGES (cumulative since last main merge)

| File | What changed |
|---|---|
| `app/dashboard/hybrid-planner/page.tsx` | Assembly guard fix; pre-assembly panel; music upload unblock; storyRegion state + picker UI |
| `app/dashboard/movie-planner/page.tsx` | Gate modal wired; Save Credits button |
| `app/api/assembly/execute/route.ts` | Full rewrite: download externals, transcode, basename concat, dynamic final_merge |
| `app/api/hybrid/story-expand/route.ts` | nameRegion param, buildNamePool() helper, cultural name injection into prompt |
| `src/data/character-names.json` | NEW — 22 sub-regions, ~2000 culturally authentic names |
| `src/lib/assembly-builder.ts` | .mp3→.wav, aac→pcm_s16le, aresample, -map 0:a for music |
| `update/HANDOFF.md` | This file |

### Session 5 — Name Library + Region Picker

**Name Library built from real-world cultural data**
- File: `src/data/character-names.json`
- 22 sub-regions across 8 continents: Africa(5), Asia(4), Europe(4), N.America(1), Latin America(4), Middle East(2), Oceania(1), Fantasy(1)
- Each sub-region: 40-50 male + 40-50 female names with ethnic/cultural tags
- Total: ~2000 culturally authentic names

**Region Picker UI — Story tab, hybrid planner**
- 8 region buttons with emoji (Africa 🌍 / Asia 🌏 / Europe / N.America / Latin America / Middle East / Oceania / Fantasy ✨)
- One-click toggle — selected region highlighted, click again to clear
- Confirmation text: "AI will use culturally authentic [region] names for unnamed characters"
- State: `storyRegion` (string, empty = no injection)
- File: `app/dashboard/hybrid-planner/page.tsx` — state at L221, UI before AITierSelector

**story-expand API wired to name pool**
- New field: `nameRegion` in request body
- Server reads `src/data/character-names.json`, shuffles pool, picks 8M + 8F names
- Injects two blocks into prompt:
  1. Cultural context: "characters from [continent] ([culture1, culture2, ...])"
  2. Approved name pool: "Male: Emeka, Kofi... Female: Ngozi, Fatou..."
- File: `app/api/hybrid/story-expand/route.ts` — `buildNamePool()` helper + namePoolBlock injection

**Playwright-verified (2026-05-07)**
```
STORY CULTURE label: VISIBLE (CSS uppercase)
All 8 region buttons rendered with emojis
Click Africa → "AI will use culturally authentic africa names for unnamed characters"
TSC: clean (exit 0)
```

---

## KNOWN ISSUES / NOT YET FIXED

| # | Item | Notes |
|---|---|---|
| 1 | Narration timing vs scene changes | Narration startTime in assembly JSON NOT enforced by FFmpeg — all narration plays from t=0. Needs `adelay` filter per track. Complex fix. |
| 2 | Music auto-select picks by tone string match | May pick wrong track if no exact match. Henry should select music in Sound tab before assembling. |
| 3 | `KIE_AI_API_KEY` + `MUBERT_PAT` in `.env` | Premium music falls back to stock. Henry adds manually. |
| 4 | Merge branch to main | fix/ghs-pipeline-recovery-may05 not yet merged |
| 5 | Assembly time ~120s for 10 scenes | Downloads + transcodes. Cache sceneImages to speed up. |
| 6 | Movie Planner credits section: "Movie Credits" not "Story Credits" | Minor label difference vs hybrid planner. Not a bug. |

---

## NEXT EXACT STEPS

1. Henry: test assembled video quality — check if music volume feels right (currently ducked to 8%)
2. Henry: select music in Sound tab before assembling for best results (auto-pick is fallback only)
3. Henry: add `KIE_AI_API_KEY` + `MUBERT_PAT` to `.env` for premium music
4. Merge branch to main when satisfied

---

## Dev server: localhost:3200
## DB: giohomestudio_db (Prisma)
## Build: TSC clean
