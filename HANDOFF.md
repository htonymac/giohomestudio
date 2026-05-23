# GHS Handoff — 2026-05-17 (Hybrid subtitle + QC + Parse Script)

## Where we stopped
Session focus: Hybrid Planner subtitle pipeline, QC fix flow, Parse Script per-scene, pre-flight UX.
All TypeScript clean. Dev server needs a HARD restart (kill `next dev`, delete `.next`, restart) — Henry confirmed during testing that HMR was inconsistent on `page.tsx` (12k+ lines).

## What landed today

### `app/components/PreGenerationGate.tsx`
- `minHeight: 420` → `maxHeight: calc(100vh - 48px)` + `overflowY: auto`. Modal no longer forces page scroll on small viewports.

### `app/dashboard/hybrid-planner/page.tsx`
1. **Outro subtitle bleed**: extracted `narratorFallbackSec = Math.max(sceneBaseDuration - introOutroFixed, 1)` and used for narrator `endTime` fallback when `effectiveNarrDurMs === 0`. Old code fell back to `totalDuration` which includes 15s intro+outro → subtitles bled into outro card.
2. **Subtitle gate hardened** (line ~4370): `subtitlesOn = subtitleStyle !== "none" || effectiveSubtitleConfig.mode !== "none"`. Old gate `subtitleStyle !== "none"` failed for saved projects where legacy state was `"none"` but the new mode picker was active. Also coerce `sentSubtitleStyle = "classic"` on the wire when only the new picker is the signal — execute route has its own `if (globalStyle !== "none")` gate that would otherwise re-kill it.
3. **Subtitle text source widened** (line ~4313): each narration entry now falls back to `scriptSegments.find(s => s.audioUrl === n.audioUrl)?.text` when it isn't the master narrator. Per-line FAL/Karaoke narration now carries subtitle text.
4. **`parseScript` rewritten**: Path A — when 2+ scenes have `narrationScript || description`, build one segment per scene directly. Skips LLM. Path B (LLM master-story parse) kept as fallback. Fixes "1 segment for 12 scenes" bug. Logs `[parseScript] scenes=N withContent=M` to DevTools console.
5. **QC fix routing**: added `applyFixDirect` with handlers for `Trim story to under N words` (truncates `expandedSummary` or `idea` directly) and `Change first scene music to "..."` (writes `scene.musicStyle`). Previously both went to LLM `batch_polish` which scrambled descriptions.
6. **Pre-Flight button**: renamed to `▶ Run Pre-Flight Check`, solid purple fill. Old "AI Audio & Audit" text was identical to the section header — looked like a label not a button.
7. **Check Subtitle Sync**: when status warns AND `effectiveSubtitleConfig.mode === "none"`, an inline `Enable Subtitles` button now flips style to classic/dramatic in one click. Replaces fragile `note.includes("Subtitles OFF")` string-match condition.
8. **`applyWordCountFixes` regex**: scene-id capture now accepts curly + straight quotes — `/in\s+scene\s+["""']?([A-Za-z0-9_]+)["""']?/i`. Old regex only matched standard ASCII `"`.
9. **"Trim story" rewritten correctly**: was updating `expandedSummary` — but QC reads `qcStoryText` built by joining each scene's `narrationScript || description`, so the truncation did nothing for re-run QC. Now trims each scene proportionally (ratio = maxW/totalWords, floor 5 words per scene). Joined total drops under the target → STORY_QUALITY blocker clears on re-run.
10. **`fixSceneQC` routes through `applyFixDirect`**: per-scene "🔧 QC Fix" button now applies music/story/word-count fixes directly before falling through to LLM. Matches the global "Fix All" routing.

### `app/api/hybrid/pre-flight/route.ts`
- New warn branch: when `scriptSegments.length < ceil(scenes.length / 2)`, returns `status: "warn"` with label `Script parsed (N segment(s) for M scenes)`. Old code blindly reported `status: "ok"` for any non-zero count.

## Not yet verified by Henry

- **Final MP4 subtitles after clean rebuild** — gate fix is in, but Henry's last test was on a stale dev build. Execute route was NOT modified — still gates on `assembly.exportSettings?.includeSubtitles`. If still missing post-restart, instrument the server log line `[subtitle] font=... style=... entries=N` to see what arrives.
- **Re-parse Script button click** — after restart, DevTools console should log `[parseScript] scenes=N withContent=M`. If silent, build is still stale.

## Blockers
None functional. Process blocker: hot reload unreliable on `app/dashboard/hybrid-planner/page.tsx`. Cold-restart after every edit to that file.

## Next exact steps
1. Henry: stop `next dev`, `rm -rf .next`, restart, hard-reload browser (Ctrl+Shift+R).
2. Click Re-parse Script → DevTools console must log `[parseScript] scenes=12 withContent=12`. Segment chip must change 1 → 12.
3. Generate narration → Assemble → confirm subtitles burn into final MP4.
4. Story QC → click Fix on `Trim story to under 300 words` → re-run QC → STORY_QUALITY blocker should clear.
5. If subtitles still missing post-restart: server log will show why drawtext skipped (`narrationWithText.length === 0` means no entry has text; `globalStyle === "none"` means sentSubtitleStyle path didn't coerce).

## Files touched
- `app/components/PreGenerationGate.tsx`
- `app/dashboard/hybrid-planner/page.tsx`
- `app/api/hybrid/pre-flight/route.ts`

## Files read but NOT modified (constraint: don't touch what you don't own)
- `app/api/assembly/execute/route.ts` — subtitle drawtext pipeline lives here; only consumes the assembly JSON we now build correctly
- `app/api/hybrid/parse-script/route.ts` — still used as Path B fallback
- `app/api/hybrid/scene-edit/route.ts` — LLM polish, used by QC fixes that aren't direct-apply
- `src/lib/assembly-schema.ts` — schema unchanged
- `src/lib/ghs-sound-tiers.ts` — unchanged

---

# GHS Handoff — 2026-04-30 (S4c FINAL)

## S4c — Movie Cast AI-first + Children Chars Inline + Preflight All Planners
Branch: `fix/ghs-s4c-sceneboard-cast-preflight`
Commit: fa403c7

**Done:**
- Movie planner Cast tab: "Build Story Characters with AI" primary button + portrait model selector (Flux Schnell/Pruna/Flux Dev) + "Generate Portrait" per card + "or import saved" secondary
- Children planner Characters tab: inline AI-first registry — Build Story Characters with AI, or import saved via CharacterPicker inline, Gen.Portrait, Remove per card. No more navigate-away to character-voices page.
- Hybrid planner Assembly tab: runPreflight() added, Pre-Flight Review section added at top of assembly (always visible — before scenes.length === 0 guard)
- Movie planner Assembly: Pre-Assembly Review already present (confirmed)
- Children planner: Run Pre-flight Review button in Final tab (confirmed)
- Playwright: 9/9 PASS

**Next:** S13 — AI Motion Video SSE guard + Scene Forge lip sync (see uncomplete.md)

---

# GHS Handoff — 2026-04-30 (S3)

## S3 — BUG-04a/c/f payload + JSON guard
Branch: `fix/ghs-bug-04-payload-json-guard`

**Done:**
- children-planner scene-plan: payload rewritten to `{storyText, characters[], costPreference, targetDuration, projectId}`
- children-planner music/generate: `{prompt, durationSeconds}` replaces `{mood, duration}`
- `lib/api-utils.ts` created with `safeJson<T>()` — wraps 6 calls in children-planner + 1 in movie-planner
- TypeScript clean (tsc --noEmit), next build green
- Playwright: no JSON crash, bad payload returns JSON 400 (not HTML)

**Next:** S4 — BUG-04b tab order + character picker (see uncomplete.md)

---

# GHS Handoff — 2026-04-27

## Where we are

Main branch is GREEN. Karaoke Final Master Canvas restructure shipped. All 26 session PRs merged. Zero open PRs. Dev server up at :3200, Chrome debug at :9222.

## Tag for rollback safety
- `windows-final-2026-04-26` — last green build before any Linux migration. `git checkout windows-final-2026-04-26` rolls everything back.

## Today's commits since the tag

```
7e7d1a0  feat(karaoke): Final Master Canvas — Creator + Planner split (#24)
3bf9901  docs(karaoke): lock Final Master Canvas architecture
e66eb29  feat(karaoke): doc-polished flow — voice-first lyrics polish + simple-label audio editor (#23)
2576596  fix(sidebar): multi-open accordion — Karaoke / SFX / etc visible by default
0124f38  fix(karaoke): beat tracking — convert numpy 0-d tempo to float
8073e4f  fix(fal-gateway): send body flat — drop {input:...} wrap
2b60079  fix(continuous-motion): align adapter endpoints to live FAL paths (#22)
01ef6d1  chore(migration): mark FIXES_BEFORE_MIGRATION audit complete + tag drift
3987038  chore(migration): portable ffmpeg fallbacks + Linux migration runbook
ec47f09  fix(music-video-planner): dedupe runAutoTimestamp function
+ many earlier from the session
```

## Live routes (verified 200 just now)

- `/dashboard` — Sidebar shows all 6 groups expanded by default (multi-open fix)
- `/dashboard/karaoke-music-creator` — NEW (Create group). Mode A-E + 5 inputs.
- `/dashboard/karaoke-music-planner` — NEW (Planners group). 18-step workshop with flow lock.
- `/dashboard/karaoke-studio` — redirects to `karaoke-music-creator`
- `/dashboard/hybrid-planner` / `music-video-planner` / `commercial-planner` / `assets` / `ad-editor` — all 200
- `/terms` / `/privacy` / `/dmca` / `/ai-disclosure` / `/cookies` / `/sound-licensing` / `/acceptable-use` — all 200

## Karaoke architecture (locked per Final Master Canvas)

| Surface | Route | Owns |
|---|---|---|
| **Karaoke Music Creator** (Create group) | `/dashboard/karaoke-music-creator` | Mode A-E selector (Voice→Music / Voice→Karaoke / Voice→Polished Demo / Voice→Lyrics+Music / Voice→Beat Match) + 5 inputs (record / upload / asset library / recent / paste URL) |
| **Karaoke Music Planner** (Planners group) | `/dashboard/karaoke-music-planner` | 18-step workshop: Voice Input → Cleanup ⏸ → Analysis → Melody ⏸ → Lyrics → Lyrics AI (5 levels) → Flow Profiling → Beat Recommendation (11 families) → Production Brief → Music Gen → RVC ⏸ → Mixing → Review → Version Compare → FFmpeg Assembly → Export → Optional Video Pipeline → Storage Lifecycle |

Flow LOCK rule: Music Gen disabled until tempo + lyrics + flow + brief all complete.

## In-flight / blocked / waiting

### Waiting on Henry (you)

| Item | Action needed |
|---|---|
| **T4 Finance Phase 2** | Trigger phrase: "start Finance Phase 2" or "build credits" (per Must Read SECTION A1). DO NOT auto-start. |
| **Karaoke music gen — Suno-quality** | Add `KIE_AI_API_KEY` to `.env`. Without it, Music Provider falls back to Stock Library (functional but not Suno). |
| **Karaoke long instrumental** | Add `MUBERT_PAT` to `.env`. Without it, Mubert adapter throws and falls back. |
| **CMF entitlement** | Wan Pro + Kling 2.5 may need fal.ai account credit top-up. Verify at fal.ai dashboard. (Not strictly blocking — Wan v2.5 endpoint works as of PR #22 fix.) |
| **GHS Linux migration** | Per `project_server_setup.md`: GHS is LAST in onboarding queue (Marabiz → HMKSync → GioBiz → Giolog → GHS). Drive via `connect Terry` when earlier projects are stable on Contabo VPS. |

### Post-Linux migration items (cannot install on Python 3.13 Windows)

| Item | Step | Linux command |
|---|---|---|
| Demucs | 2 — Vocal Cleanup | `pip install demucs torch` |
| Spotify Basic Pitch | 4 — Melody → MIDI | `pip install basic-pitch` |
| RVC | 11 — Voice Enhancement | `git clone Retrieval-based-Voice-Conversion-WebUI && pip install -r requirements.txt` |
| Voice similarity model | 21 — Deepfake prevention | TBD |

### On hold

| Task | Status | Why |
|---|---|---|
| T28 9-Thompson coverage test | on hold | Original burst hit Henry's rate limit. Re-run in a single sequential Thompson when ready (less concurrent burn). |

## Known gaps (not blockers, just noted)

- Karaoke Step 2 (Demucs) UI shows ⏸ "post-Linux install" badge — works visually, just no real cleanup happens. Fine until Linux.
- Karaoke Step 4 (Basic Pitch) same.
- Karaoke Step 11 (RVC) same.
- Music gen falls back to Stock Library when no `KIE_AI_API_KEY` — output is real but not Suno-quality.
- Mode B (Voice → Karaoke) Step 10 stub: takes existing song, vocal-extraction is `Demucs vocal_only` which needs Demucs (post-Linux).
- Test infra: `tests/restore-teddy-project.spec.ts` has stale project-restore mechanism. Reassigned to your manual smoke on Linux per FIXES_BEFORE_MIGRATION owner tag.

## Doc system (per Rule 13 — locked 2026-04-24)

| Doc | Purpose | Last touched |
|---|---|---|
| `CHANGELOG.md` | What/why/impact/risk per PR | 2026-04-27 |
| `HANDOFF.md` | Where stopped, in-progress, blockers, next steps (THIS DOC) | 2026-04-27 |
| `update/uncomplete.md` | Running task log + post-Linux + missing keys | 2026-04-27 |
| `update/PROBLEM_AND_FIX.md` | Bug log — check first when symptom recurs | various |
| `daily/2026-04-27_karaoke-restructure.md` | Today's full plan + file list + deferred | 2026-04-27 |
| `LINUX_MIGRATION_RUNBOOK.md` | End-to-end Ubuntu deploy | 2026-04-26 |
| `FIXES_BEFORE_MIGRATION.md` | 5-item checklist + audit notes | 2026-04-26 |
| `URGENT_INSTRUCTIONS.md` | 8-step audio pipeline manual smoke | unchanged |
| `Must Read.md` | Spec index + deferred items + global rules | unchanged |
| `CLAUDE.md` (project root) | §0 Karaoke architecture + product master canvas | 2026-04-27 |

## Servers / processes

- Dev server: `npm run dev` on :3200 (currently up after final restart). Owns Prisma client DLL — kill before any `prisma generate`.
- Chrome debug: `start_chrome_debug.bat` on :9222. Used by Playwright CDP tests.
- Both auto-start when needed; safe to leave running.

## Source-of-truth docs (Karaoke specifically)

- TECH: `update/GHS KERAOKE/GHS_KARAOKE_STUDIO_PLAN.md` — 11-step pipeline + tools
- FLOW: `update/GHS KERAOKE/GHS Karaoke.docx` (extracted: `GHS_Karaoke_extracted.txt`) — 10-step user-side workflow + 5 modes + UX principles
- MASTER: `update/GHS KERAOKE/GHS KARAOKE update.docx` (extracted: `GHS_KARAOKE_update_extracted.txt`) — Final Master System Canvas, 18-step pipeline, locked architecture
- Reference: `update/GHS KERAOKE/GHS KAROKE KERAOKE GEMINI.pdf`

## Rules (preserved)

- Voice = truth. Flow = authority. AI assists. User decides. System executes.
- Music gen MUST NOT start until cleanup + tempo + melody + lyrics + flow profile + brief all complete.
- Lyrics polish: Option 1 is always the user's exact line. Server-enforced. Never auto-overwrite.
- Audio editor opens neutral on "Natural Voice" preset. Reset button always visible.
- 5 intervention levels: improve / simplify / strengthen / rewrite_light / rewrite_full. Default = improve.

## Resume instructions for next session

1. Verify dev still up: `curl http://localhost:3200/dashboard/karaoke-music-creator` (expect 200).
2. If Henry says "start Finance Phase 2": load `update/GHS_PAYMENT_BILLING_PLAN.md` and proceed.
3. If Henry adds Kie.ai key: restart dev server, then test music gen via `/api/karaoke/generate-music` with mode A.
4. If Henry says "run karaoke 100% test": spawn ONE sequential Thompson hitting all 18 steps, not 9 parallel (avoids rate-limit burst).
5. If Henry triggers GHS Linux migration: `connect Terry` and follow `LINUX_MIGRATION_RUNBOOK.md` end-to-end.

## Backlog summary (open tasks)

| ID | Task | Owner |
|---|---|---|
| T4 | Finance Phase 2 — credit DB + deduction | blocked on trigger |
| T28 | Re-run 9-Thompson coverage test | on hold (rate limit) |
| (post-Linux) | Demucs / Basic Pitch / RVC / voice similarity | on Linux deploy |
| (post-keys) | Suno-quality lyrical music gen via Kie.ai | needs KIE_AI_API_KEY |
| (post-keys) | Long instrumentals via Mubert | needs MUBERT_PAT |

Total session shipped: **26 PRs merged + 1 tag pushed.** Karaoke architecture finalized. Migration prep done. Linux migration is the next big move when GHS reaches the front of your queue.

## 2026-05-17 22:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-17 23:52 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ```

## 2026-05-17 23:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ```

## 2026-05-18 00:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ?? storage/scenes/
  ```

## 2026-05-18 01:31 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ```

## 2026-05-18 02:03 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ```

## 2026-05-18 02:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
   M test-results/.last-run.json
  ```

## 2026-05-18 03:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
  ```

## 2026-05-18 03:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M src/lib/assembly-schema.ts
   M src/lib/ghs-sound-tiers.ts
  ```

## 2026-05-18 05:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 05:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 15:38 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 15:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 16:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 16:31 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
  ```

## 2026-05-18 16:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 17:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 18:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:17 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 19:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/components/PreGenerationGate.tsx
   M app/dashboard/character-voices/page.tsx
  ```

## 2026-05-18 20:06 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/api/hybrid/story-expand/route.ts
   M app/components/PreGenerationGate.tsx
  ```

## 2026-05-18 21:46 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6992d21 fix(narration): GHS Plus/Pro now use FAL Kokoro TTS instead of broken karaoke`
- working tree:
  ```
   M CHANGELOG.md
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M app/api/character-voices/[id]/generate-portrait/route.ts
   M app/api/hybrid/narrate-piper/route.ts
   M app/api/hybrid/pre-flight/route.ts
   M app/api/hybrid/scene-image/route.ts
   M app/api/hybrid/scene-plan/route.ts
   M app/api/hybrid/story-expand/route.ts
   M app/components/PreGenerationGate.tsx
  ```

## 2026-05-18 22:58 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-18 23:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-18 23:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-18 23:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:35 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:45 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 03:58 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 04:12 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 15:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 16:53 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d18f767 feat(era-lock+children-pacing): Era/Culture Lock system + Children Pacing Engine C1-C6`
- working tree:
  ```
   M HANDOFF.md
   M app/api/hybrid/scene-image/route.ts
   M app/dashboard/hybrid-planner/page.tsx
   M playwright-report/index.html
   M test-results/.last-run.json
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 21:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2312034 fix(bear-head): remove scene-text animal detection — only explicit species triggers animal mode`
- working tree:
  ```
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 22:15 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `83a965d fix(face-lock): remove modelId bypass — PuLID now activates whenever portrait exists`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-19 22:38 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `26de934 fix(subtitle): preserve line breaks + surface burn-in failures to user`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 01:10 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 01:11 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 01:13 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:02 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:14 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c6b658 fix(scene-image): pass character age from Character tab — fixes age drift across scenes`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:20 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `829ea62 fix(character-extract): require skinTone + age, inject ethnicity into visualDescription`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 02:42 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `829ea62 fix(character-extract): require skinTone + age, inject ethnicity into visualDescription`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 03:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b65cce5 diag(face-lock): surface PuLID status to UI per scene so silent failures are visible`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 03:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `b65cce5 diag(face-lock): surface PuLID status to UI per scene so silent failures are visible`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 03:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1774db4 fix(ai-read): never let portrait-reading AI override story-extracted ethnicity/age`
- working tree:
  ```
   M HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ```

## 2026-05-20 04:18 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1774db4 fix(ai-read): never let portrait-reading AI override story-extracted ethnicity/age`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-20 06:11 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `1774db4 fix(ai-read): never let portrait-reading AI override story-extracted ethnicity/age`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `daae5db fix(assembly): intro/outro preview shows <img> for PNG cards, not <video>`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `221c608 fix(subtitle): escape colon in Windows fontfile path — drawtext was failing silently`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `64df85d fix(character-extract): pipe ethnicity from extraction → React state → portrait prompt`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:37 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `64df85d fix(character-extract): pipe ethnicity from extraction → React state → portrait prompt`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/diagnose-ethnicity-bug-ethnicity-bug-diag-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ?? tests/find-marcus-cole.mjs
  ```

## 2026-05-20 06:50 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `863b493 fix(character-extract): walk entire expandedStory object for ethnicity inference`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 08:26 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `863b493 fix(character-extract): walk entire expandedStory object for ethnicity inference`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 15:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:33 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:34 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:40 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:43 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `3c488b8 docs(handoff): Session 18 comprehensive handoff — 13 commits, full ethnicity pipeline`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 18:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0abe0 fix(ollama): raise default timeout 15s → 90s for local model latency`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-20 22:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0abe0 fix(ollama): raise default timeout 15s → 90s for local model latency`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-21 01:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `5f0abe0 fix(ollama): raise default timeout 15s → 90s for local model latency`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? test-results/verify-ethnicity-e2e-ethnicity-e2e-chromium/
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ```

## 2026-05-21 01:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `87af189 test(ethnicity): Playwright test proves UI mapping works given correct server data`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 01:39 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `87af189 test(ethnicity): Playwright test proves UI mapping works given correct server data`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 01:44 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a5701e fix(character-extract): Option B — story-wide dominant ethnicity override`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 03:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a5701e fix(character-extract): Option B — story-wide dominant ethnicity override`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 03:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `2a5701e fix(character-extract): Option B — story-wide dominant ethnicity override`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 03:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `8f5e3f0 fix(scene-image): match Scene Board characters by displayName too, not just characterId`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 04:49 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `bf4f88a fix(scene-image): block shirtless defaults — characters get clothing override even when PuLID-locked`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:04 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `73f66b5 fix(children-planner): age-appropriate vocabulary + music providerKey + karaoke narration`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:08 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `08255ba fix(portrait): stop shirtless defaults at portrait gen — PuLID locks portrait state`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:16 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d53a2f3 fix(pulid): lower id_weight + delay start_step so scene prompts can override portrait state`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:22 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `96db101 fix(scene-prompt): cast description skips empty/contaminated fields`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 05:28 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d4ba8a3 fix(children-planner): match hybrid story-expand call — Story Length picker + tier:pro`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 15:32 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d4ba8a3 fix(children-planner): match hybrid story-expand call — Story Length picker + tier:pro`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 17:25 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6ba628e docs(plans): approved plan — port Hybrid scene editor to Movie + Children planners`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 17:29 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `6ba628e docs(plans): approved plan — port Hybrid scene editor to Movie + Children planners`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 17:55 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f39328a docs(plans): scene composition fix plan — PuLID locking full portrait composition, not just face`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 22:41 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f3073bb docs(handoff): Session 19 — children vocabulary + PuLID tuning + 2 approved plans waiting`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-21 23:07 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `f3073bb docs(handoff): Session 19 — children vocabulary + PuLID tuning + 2 approved plans waiting`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ?? tests/ethnicity-bug-log.txt
  ?? tests/ethnicity-bug-shot.png
  ?? tests/ethnicity-step1-story-tab.png
  ```

## 2026-05-22 04:47 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `d767ff7 docs(handoff): add Session 19 push log — F1+F2+F3, story-expand rich scenes, Phase A+B toolbars`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-22 18:54 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `94417ac docs(handoff): finished — F4 + Phase D landed, all 3 child-safe ops verified live`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 00:34 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `74f57ee docs(plans): fix plan for Henry's 8 issues — subtitle, narration, scene-board, toolbar placement`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 01:09 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7ecd210 docs(plans): add FIX 9 — characters POSING not ACTING in scenes`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 01:21 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7820ea0 fix(planners): 7 fixes from Henry's frustration log — toolbar, URL, audio, chat, persist, pose, subtitle cap, length`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 01:30 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `7820ea0 fix(planners): 7 fixes from Henry's frustration log — toolbar, URL, audio, chat, persist, pose, subtitle cap, length`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/diagnose-ethnicity-bug.spec.ts
  ```

## 2026-05-23 03:01 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-23 03:14 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 04:19 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 04:24 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M test-results/.last-run.json
   M update/CHANGELOG.md
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-23 05:35 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M test-results/.last-run.json
   M update/CHANGELOG.md
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-23 05:36 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `abb5a8f backup: checkpoint before linux migration`
- working tree:
  ```
   M HANDOFF.md
   M app/api/assembly/execute/route.ts
   M test-results/.last-run.json
   M update/CHANGELOG.md
   M update/HANDOFF.md
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ```

## 2026-05-23 05:42 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `996b5fc fix(assembly): narrator endTime + totalDuration correction + caption layout`
- working tree:
  ```
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ?? tests/e2e-2-story-filled.png
  ```

## 2026-05-23 05:47 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `996b5fc fix(assembly): narrator endTime + totalDuration correction + caption layout`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 05:59 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `996b5fc fix(assembly): narrator endTime + totalDuration correction + caption layout`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```

## 2026-05-23 06:00 UTC — auto-checkpoint (dirty)
- branch: `main`
- HEAD: `de1c0df docs(handoff): Session 20 — export fix committed, all triggers confirmed done`
- working tree:
  ```
   M HANDOFF.md
   M test-results/.last-run.json
  ?? storage/scenes/
  ?? storage/test_narration_mix.mp3
  ?? tests/children-1-landed.png
  ?? tests/children-1-no-textarea.png
  ?? tests/children-2-story-filled.png
  ?? tests/children-3-after-expand.png
  ?? tests/children-verify-report.txt
  ?? tests/e2e-1-story-tab.png
  ```
