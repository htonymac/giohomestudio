# GioHomeStudio (GHS) — Handoff Specs (2026-05-19)

**Primary read-first doc for any agent picking up GHS work.** Locked state, live planners, open tasks, test recipe, deploy, traps, and rules. Read this BEFORE touching code. Update Section 1 after any meaningful ship. Append to Section 7; don't rewrite.

---

## 1. STATE OF THE WORLD as of 2026-05-19

| Surface | Version | URL | Notes |
|---|---|---|---|
| Dev server | active | http://localhost:3200 | `npm run dev` — port 3200 only (DO NOT change) |
| GitHub remote | main | https://github.com/htonymac/giohomestudio.git | HEAD: `2f6647e` (face-lock CDN upload) |
| DB | giohomestudio_db | PostgreSQL via Prisma | Migrations PENDING — `npx prisma migrate dev` not yet run for Sessions 16-17 changes |
| Debug browser | :9222 | http://localhost:9222 | `start_chrome_debug.bat` — used by all Playwright tests |
| Octogent (server) | port 8788 | Contabo VPS | GHS last in server onboard queue — not yet migrated |

### Uncommitted changes (Sessions 16 + 17 — must commit)

```
M  app/dashboard/hybrid-planner/page.tsx
M  app/api/hybrid/scene-image/route.ts
+  app/dashboard/children-planner/page.tsx
+  app/dashboard/movie-planner/page.tsx
+  app/api/hybrid/scene-plan/route.ts
+  app/api/hybrid/story-expand/route.ts
+  src/lib/era-culture-lock.ts
+  src/types/children.ts
+  app/api/children/
+  app/components/ChildrenKaraokeSubtitle.tsx
```

Commit command (copy verbatim):
```bash
git add app/dashboard/hybrid-planner/page.tsx app/api/hybrid/scene-image/route.ts
git add app/dashboard/children-planner/page.tsx app/dashboard/movie-planner/page.tsx
git add app/api/hybrid/scene-plan/route.ts app/api/hybrid/story-expand/route.ts
git add src/lib/era-culture-lock.ts src/types/children.ts
git add app/api/children/ app/components/ChildrenKaraokeSubtitle.tsx
git add update/CHANGELOG.md update/HANDOFF.md
git commit -m "Session 16+17: Era/Culture Lock, Children Pacing C1-C6, beat picker delete, Nollywood skin fix, bear head fix, phone negative, character consistency improvements"
```

### Live planners (all 200 as of 2026-04-27 verification)

| Planner | Route | Status |
|---|---|---|
| Hybrid Planner | `/dashboard/hybrid-planner` | CORE — most active |
| Movie Planner | `/dashboard/movie-planner` | Live |
| Children Video Planner | `/dashboard/children-video` | Live + Pacing Engine C1-C6 (Session 16) |
| Commercial Planner | `/dashboard/commercial-planner` | Live |
| Music Video Planner | `/dashboard/music-video-planner` | Live |
| Series Planner | `/dashboard/series-wizard` | Live |
| Karaoke Creator | `/dashboard/karaoke-music-creator` | Live |
| Karaoke Planner | `/dashboard/karaoke-music-planner` | Live |
| Scene Forge | `/dashboard/scene-forge` | Live |
| Free Mode | `/dashboard/free-mode` | Live |

### Recently shipped

| Session | What |
|---|---|
| Session 17 (2026-05-19) | Beat picker delete buttons, Nollywood skin lock, bear head bug fix, phone negative, description-first ordering, charRefImages in scene gen, re-parse fix, storyCulture fallback bug |
| Session 17 (face-lock) | Auto-upload portraits to FAL CDN — enables PuLID for all characters |
| Session 16 | Era/Culture Lock system (`src/lib/era-culture-lock.ts`), 17 eras, 14 cultures. Children Pacing Engine C1-C6. |
| Session 15 | H-series H1-H5 image-first story structuring |
| Session 14 | v14 design rollout — 51 pages, dark/purple-orange tokens |

---

## 2. LOCKED PRODUCT DECISIONS

| Decision | Locked | Rule |
|---|---|---|
| Hybrid Planner = CORE planner | Always | All new planner features proved here first. Other planners adapt (not copy) the hybrid pattern. |
| Music per scene | Always | Every scene gets its own music cue. Never one track for whole video. |
| All music = royalty-free | 2026-05-02 | Every tier (Standard→Premium) produces royalty-free audio. Users never copyright-struck. |
| Music tier system | 2026-05-02 | Standard=Piper, Plus=Karaoke, Pro=FAL Stable Audio, Classic=Kie.ai/Suno, Premium=Gemini (UNVERIFIED — DO NOT build) |
| AI Expand doctrine | 2026-05-02 | "Expand with AI Intelligence" → story. "Production Mode" (Button 2) → tagged production brief `[SFX:][MUSIC CUE:][CHARACTER:][CAMERA:]`. DO NOT BUILD production mode until Henry triggers. |
| Free Mode first | Always | Strengthen Free Mode before expanding to new modes. |
| Commercial Mode | On hold | Wait for Henry's explicit trigger. Do not auto-start. |
| GHS branding only | Always | User sees GHS Standard/Plus/Pro/Classic/Premium/Best. NEVER show Claude/GPT/Ollama/Grok. |
| Establishing Shot system | 2026-05-15 | Spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`. 8 types, 5 modes. DO NOT BUILD until Henry says "build establishing shot". |
| Finance Phase 2 | Blocked | Trigger phrase "start Finance Phase 2". Plan at `update/GHS_PAYMENT_BILLING_PLAN.md`. DO NOT auto-start. |
| Karaoke music gen (Step 10) | Skip for now | Stock library fallback sufficient. Needs `KIE_AI_API_KEY` for Suno-quality. |
| Linux migration | Deferred | GHS is LAST in server onboard queue (Marabiz → HMKSync → GioBiz → Giolog → GHS). |
| Identity lock (PuLID) | Partial | `useIdentityLock` = `hasPhotoImportChar` only. Full lock needs public CDN portraits. Re-enable after CDN is wired. |
| amix filter | Locked | ALWAYS `amix=duration=longest:normalize=0`. NEVER `duration=first`. NEVER `-shortest`. |
| `-stream_loop -1` | Locked | Required on video in `final_merge` when narrator > scene duration. |
| `extractSceneAction()` | Protected | In `app/api/hybrid/scene-image/route.ts`. Comment says `// ── SCENE ACTION LAYER — PROTECTED`. Never remove. |

---

## 3. WHAT'S LEFT

### High priority (build-ready)

| Item | Notes |
|---|---|
| Public CDN for portrait images | Portraits at `/api/media/...` are localhost-only → FAL PuLID cannot access. R2 or S3. Enables full character face-lock. |
| C6 pacing engine save/load | `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl` NOT in DB — lost on page refresh. |
| Prisma migrations | `npx prisma migrate dev` — run after CDN and C6 DB columns added. |

### Medium priority (deferred until triggered or unblocked)

| Item | Trigger/Blocker |
|---|---|
| Establishing Shot & Scene Opener system | Henry says "build establishing shot" |
| Finance Phase 2 (credits DB) | Henry says "start Finance Phase 2" |
| SFX semantic category system (60 categories, Ollama) | No trigger yet |
| Subtitle style tokens (beyond Arial 22px white) | TBD |
| Pre-Linux migration verification | 5-item FIXES_BEFORE_MIGRATION.md checklist |

### Post-Linux only (cannot install on Windows Python 3.13)

| Item | Linux install |
|---|---|
| Demucs (vocal cleanup — Karaoke Step 2) | `pip install demucs torch` |
| Basic Pitch (melody → MIDI — Karaoke Step 4) | `pip install basic-pitch` |
| RVC (voice enhancement — Karaoke Step 11) | `git clone Retrieval-based-Voice-Conversion-WebUI` |

### Waiting on keys

| Key | Purpose | Current fallback |
|---|---|---|
| `KIE_AI_API_KEY` | Kie.ai Suno V5 (lyrical music) | Stock library |
| `MUBERT_PAT` | Mubert long instrumental | Stock library |

### Doc backlog

- `update/CHANGELOG.md` — sessions 16/17 not yet appended
- `update/uncomplete.md` — last updated 2026-04-30, needs session 11-17 adds

---

## 4. CANONICAL TEST RECIPE — Hybrid Planner full pipeline

From Henry's live recording (Teddy & Dog project, 2026-04-16). Verify each step completes before the next.

| Step | Action | Pass condition |
|---|---|---|
| 1 | Story & Draft tab → write idea → "Expand with AI Intelligence" | `expandedSummary` populated, scenes appear |
| 2 | Characters tab → Generate Portrait per character | Portrait images shown, no errors |
| 3 | Scene Board → Make Image per scene | Images generated for all scenes |
| 4 | Assembly tab → "Write Screenplay" → "Send to Scenes" | Green checkmark, narration text distributed |
| 5 | Assembly → "Parse Script" | Segment count > 0 (check DevTools: `[parseScript] scenes=N withContent=M`) |
| 6 | Assembly → "Generate Actor Voices" | N/N actors voiced status |
| 7 | Assembly → "Narrator Voice" | Narrator audio duration > 0s |
| 8 | Assembly → select Background Music | Music track selected, not empty |
| 9 | Assembly → "AI Plan Audio + SFX" | "Audio planned" confirmation visible (takes 2-3 min) |
| 10 | Assembly → "Run Pre-Flight Check" | All scenes pass or warn (no ❌ Fail) |
| 11 | Assembly → "Make Video" / "Assemble My Movie" | MP4 file created, size > 0 |
| 12 | After assembly → check Asset Library AND All Content | Video visible in both locations |

**Critical after any `hybrid-planner/page.tsx` change:** Kill `next dev` → `rm -rf .next` → restart → hard-reload browser (Ctrl+Shift+R). HMR is unreliable on this 12k+ line file.

**After assembly:** Take screenshot of video player + check file size. Report both. Let Henry judge audio/visual quality (AUT cannot play audio).

---

## 5. DEPLOY COMMANDS

GHS runs on localhost — no cloud deploy required for dev. Linux migration TBD.

| What | Command |
|---|---|
| Start dev server | `npm run dev` (port 3200) |
| TypeScript check | `npx tsc --noEmit` — passes even when Next.js build fails |
| Production build check | `npx next build` — REQUIRED after any page-level change |
| Prisma migrate | `npx prisma migrate dev` — run after schema changes |
| Prisma generate | `npx prisma generate` — kill dev server first (owns Prisma client DLL) |
| Start debug Chrome | `C:\Users\USER\Desktop\CLAUDE\start_chrome_debug.bat` (port 9222) |
| Playwright tests | Run against debug Chrome :9222, NOT a new browser |

**Note:** GHS is not on Cloudflare/Vercel. All code runs local (Windows, eventually Linux). Server migration is last in queue.

---

## 6. TRAPS & KNOWN ISSUES

| Symptom | Root cause | Fix |
|---|---|---|
| HMR not picking up `hybrid-planner/page.tsx` changes | 12k+ line file overwhelms Next.js HMR | Cold restart: kill next dev → `rm -rf .next` → restart |
| Bear/animal head appearing on human characters | Old: `ANIMAL_PATTERN.test(visualDescription)` matched words like "bearing" | Fixed Session 17 — uses only explicit `species` field. If recurs: check `characterOverrides[].species` in network request |
| Characters look different across scenes | Standard FAL FLUX has no face-locking | Partial fix: description-first + anti-stereotype negatives. Full fix: CDN portraits + PuLID |
| Beat images from old story still showing in new story | `expandStory()` didn't clear `sceneBeatImages` | Fixed Session 17. If recurs: click "Del All" per scene or "Start Over" |
| `storyCulture` passing art style instead of culture | `storyCulture: storyCulture || effectiveProjectStyle` fallback was wrong | Fixed Session 17 — now `storyCulture || undefined` |
| "1 segment for 12 scenes" after Parse Script | Old Path A failed to detect scene content | Fixed Session 16 — check DevTools `[parseScript] scenes=N withContent=M` after click |
| Subtitles missing from final MP4 | Gate requires `subtitleStyle !== "none"` OR new mode picker active — legacy state collision | Fixed Session 16. If recurs: server log `[subtitle] font=... style=... entries=N` shows what arrived |
| Subtitle text bleeds into outro card | `endTime` fell back to `totalDuration` which includes 15s outro | Fixed Session 16 — `narratorFallbackSec = max(sceneBaseDuration - introOutroFixed, 1)` |
| FFmpeg drawtext fails silently | `libfreetype` not available in FFmpeg build | Run `ffmpeg -filters \| grep drawtext` to verify. Install libfreetype or use subtitles= (libass) |
| `_motion_*.mp4` / `_captioned_*.mp4` accumulating | Intermediate FFmpeg files not cleaned | Cleanup is in render route post-merge. If disk fills: check `storage/video/` for these patterns |
| Locked intermediate files in `storage/video/` | Zombie FFmpeg process holds file | Restart dev server → delete files |
| `npx tsc --noEmit` passes but deploy fails | `useSearchParams()` causes Next.js 16 prerender failure | Always run `npx next build` to verify, not just tsc |
| Piper binary not found | Piper not installed or wrong path | Check `/api/hybrid/narrate-piper` response for `piperNotInstalled` flag |
| FAL LTX Video stuck at 30-50% | FAL server timeout | FAL LTX Video disabled. Use Segmind Pruna as default |
| Fire-and-forget `patchProjectSettings` silently failing | No error surface | Check network tab for PATCH `/api/project-settings/...` status |
| Characters voiced with wrong voice | `castTray[].voiceName` not wired in collaborative-editor pre-Session 12 | Fixed Session 12. If recurs: check `speakerId` lookup in generateNarration() |

---

## 7. RECENT FIX TIMELINE (last 48h, newest first)

| Commit | What |
|---|---|
| `2f6647e` | face-lock: auto-upload portraits to FAL CDN — enables PuLID for all characters |
| `a39b3a3` | Session 17: Beat picker delete, Nollywood skin lock, bear head fix, scene image quality |
| `d18f767` | Era/Culture Lock system + Children Pacing Engine C1-C6 |
| `6992d21` | GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke |
| `0c9d80d` | Piper binary detection + proper piperNotInstalled response |
| `5719305` | docs: GITPUSHLIST May 17 entries |
| `a369d4c` | fix(hybrid): show context check results in global panel |
| `45fbae9` | chore(db): add migration file for QC + EditHistory models |
| `23f7509` | docs: finalize Session 15 — all TODOCORRECT complete |
| `07d8c16` | feat(hybrid): H-series — image-first story structuring |

---

## 8. PERSONA + WORKFLOW RULES

### Henry's testing rules (from CLAUDE.md §14 — NON-NEGOTIABLE)

| Rule | Detail |
|---|---|
| Playwright cadence | After 2 heavy functions → 6 checks. After 4 small functions → 1 check. |
| Minimum test duration | 60 seconds per Playwright test. No 5s smoke tests. |
| After each check | Navigate to Asset Library AND All Content. Verify media is actually there. |
| Real browser only | Playwright vs debug Chrome :9222. Never JS shortcuts, never fake headless. |
| Proof required | Screenshot AND video. Never trust Playwright text output alone. |
| Verify FINAL output | Not mid-stage preview. Assembly MP4 in library, not editor preview. |
| No shells | Every button/slider/dropdown must be wired to a real API. No cosmetic UI. |
| Complete before stop | Finish all tasks in daily_task before stopping. No 15-min breaks mid-task. |

### Pipeline rules

| Rule | Detail |
|---|---|
| amix | `amix=duration=longest:normalize=0` — immutable |
| `-stream_loop -1` | On video in final_merge — immutable |
| `extractSceneAction()` | Protected — never remove or "simplify" |
| `effectiveNarrDurMs` recovery | In `assembleScenes()` — protected |
| No function deletion | Never delete existing functions. Fix call site or workflow only. Removal needs Henry GO via RISKS_AND_DECISIONS. |

### Code quality triggers (from global CLAUDE.md)

- After significant coding: run `/simplify`
- Before deploy: run `/security-check`
- New UI screen: use `frontend-design` skill
- Any prompt sent to Kling/ElevenLabs/FAL: use `prompt-engineer` skill
- Unfamiliar library: use `wiki-researcher` skill

### Memory references

| File | Purpose |
|---|---|
| `~/.claude/projects/C--Users-USER/memory/terry_strict_rules.md` | Terry/Thompson hard rules |
| `~/.claude/projects/C--Users-USER/memory/error_log.md` | Learned fixes — grep FIRST before debugging |
| `~/.claude/projects/C--Users-USER/memory/project_giohomestudio.md` | Live project state (current session) |
| `~/.claude/projects/C--Users-USER/memory/project_ghs_full_reference.md` | All 6 planners, APIs, DB models |
| `~/.claude/projects/C--Users-USER/memory/project_hybrid_all_sections.md` | Every Hybrid tab, state, APIs |
| `~/.claude/projects/C--Users-USER/memory/project_ghs_hybrid_session_recording.md` | Henry's live Assembly session (9 steps) |
| `~/.claude/projects/C--Users-USER/memory/project_ghs_ai_expand_doctrine.md` | Production Mode / tagged expand doctrine |
| `~/.claude/projects/C--Users-USER/memory/project_ghs_music_tiers.md` | Music tier system (Standard→Premium) |
| `~/.claude/projects/C--Users-USER/memory/project_ghs_establishing_shot.md` | Establishing Shot spec (DO NOT BUILD until triggered) |
| `update/PROBLEM_AND_FIX.md` | Bug log — CHECK FIRST before debugging |
| `update/HANDOFF.md` | Session-level handoff (most recent state, updated each session) |
| `update/CHANGELOG.md` | Per-PR changelog |
| `update/uncomplete.md` | Running open-task list |

---

## 9. WHEN IN DOUBT

1. Grep `~/.claude/projects/C--Users-USER/memory/error_log.md` for the symptom — many traps already logged
2. Read `update/PROBLEM_AND_FIX.md` — check before debugging ANY issue
3. Check Section 6 (Traps) above — most recurring issues are catalogued there
4. Stay inside the `giohomestudio` folder — never scan marabiz / hmksync / GioBiz / AU AUTOMATION from this session (Rule 5)
5. If an API call fails twice → do NOT retry blind; read the actual pipeline code, check FFmpeg capabilities, verify final output not just preview

---

**Last updated 2026-05-19 by Sonnet (docs-only task).** Update Section 1 state table + Section 7 timeline after any meaningful ship. Section 2 locked decisions require explicit Henry GO to change.
