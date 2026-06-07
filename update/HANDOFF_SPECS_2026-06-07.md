# GHS HANDOFF SPEC — 2026-06-07 (segregation marathon + Free Mode fixes)

> **Audience:** the next agent (Terry on Linux, fresh Claude Code session, or junior dev) who picks up this session.
> **Goal of this doc:** drop you in cold and let you fire on the next thing without reading the entire chat transcript.
> **Pattern:** mirrors `~/.claude/projects/C--Users-USER/memory/feedback_handoff_specs_pattern.md` (9 sections).

---

## 1. Where we stopped

Just opened **PR #45** with the Free Mode "1s/2s per image + persist subtitles + 600s cap + auto-mode-select" fixes. Sourcery review is SKIPPED on this PR (consistent with previous Free Mode PRs); merge gate is your call.

Branch: `fix/free-mode-images-per-second` · PR: https://github.com/htonymac/giohomestudio/pull/45

Henry's last words: "han off with good spec" — that's why this file exists.

---

## 2. Current state of repo / branches

**HEAD on main:** `79c427c refactor(movie-planner): Wave 2.1 — extract CharactersTab (-150 LOC) (#42)`

**Branches (local):**
- `main` — clean, up to date with origin/main
- `fix/free-mode-images-per-second` — has PR #45 open; cherry-picked auto-mode-select (`854162a`) + images-per-second (`3c11a76`)
- `refactor/movie-planner-wave-2` — base for the next movie-planner extractions if you continue there
- `fix/free-mode-narration-music-images-mode-select` — already merged via PR #43, can be deleted

**Local working dir:** `C:\Users\USER\Desktop\CLAUDE\giohomestudio` (Windows, NOT Linux).

**Dev server:** Henry runs `pnpm dev -p 3200`. Hot reload is reliable; Turbopack is stable on the current Next 16.2.1 build.

**Prisma:** local client may go stale after schema bumps. If you see `dailySpend`/`featureFlag does not exist on PrismaClient` in `pnpm tsc`, run `pnpm prisma generate` once.

---

## 3. What just shipped this session

### Children-planner — segregation FULLY COMPLETE (pre-this-session, but context)
- `app/dashboard/children-planner/page.tsx`: **8,402 → 5,226 LOC (-3,176, -38%)** across 12 standalone tabs in `app/dashboard/children-planner/tabs/`.
- PRs #34, #35, #37, #38 + docs #36, #40 + scene-forge type fix #39.

### Movie-planner — segregation Wave 1 + 2.1 MERGED
- 5 tab files extracted: `ScriptTab.tsx`, `OverviewTab.tsx`, `DesignTab.tsx`, `StoryTab.tsx`, `CharactersTab.tsx`
- `_shared-types.ts` for cross-tab shapes (`ScriptSegment` so far)
- `app/dashboard/movie-planner/page.tsx`: **5,107 → ~4,332 LOC (-775, -15.2%)** cumulative
- PRs #41, #42 merged. Live in main.

### Free Mode — multi-fix sprint
Five Henry-reported blockers, all addressed across PR #43 (merged) and PR #45 (open):

1. **No narration audio** — pipeline never called `/api/tts`. Now stitches scene text into one Piper narration; passes `narrationUrl` in assembly payload. ✅ #43
2. **No background music** — was wired but masked by the silent video; now both `narrationUrl` and `musicUrl` ride the payload. ✅ #43
3. **Only 1 image per scene** → `MAX_IMAGES_PER_SCENE = 4`. ✅ #43
4. **Edge-TTS could leak in** → `/api/tts` call hard-codes `provider: "piper"`. ✅ #43
5. **360s test: 1 image + no subtitles** — user-picks `1s | 2s per image` (60-image cap), subtitle text now on EVERY slide, `customDur` cap raised 300 → 600s. ✅ #45 (open)

Also in #45: cherry-picked auto-mode-select (was PR #44, closed-without-merge when base branch was deleted on PR #43 merge).

---

## 4. What's pending

### Tier A — DO BEFORE STARTING NEW SCOPE
- **PR #45 merge** — Henry asked to push when Sourcery is clear. Sourcery is SKIPPED (same pattern as #41–#44 which all merged fine). Mergeable. **Command:** `gh pr merge 45 --repo htonymac/giohomestudio --squash --delete-branch`
- **Henry browser-verify Free Mode** — 360s test with the new picker. Confirm: voice plays, music plays, many distinct shots, captions through whole video, mode banner shows the picked vibe.

### Tier B — IN-FLIGHT BUT NOT BLOCKING
- **Movie-planner segregation** — 4 tabs remaining: `scenes` (~355 LOC), `sound` (~819 LOC, biggest), `assembly` (~398 LOC), and any cleanup. Wave 2.2+ branched from `refactor/movie-planner-wave-2` would resume here.
- **Other planner segregations queued (Henry's `fire on and do all` trigger):**
  - `music-video-planner` — 3,226 LOC · 11 tab-blocks · tab-workshop pattern (same as children/movie)
  - `commercial` — 3,679 LOC · NO activeTab blocks · section-based, needs different strategy
  - `collaborative-editor` — 4,820 LOC · NO tabs · real-time collab state — fragile
  - `free-mode` — 3,185 LOC · NO tabs · just got 2 fix PRs; let it stabilize before splitting
  - `hybrid-planner` — **13,567 LOC** · biggest god-file · BLOCKED until Henry says go (CLAUDE.md hard rule)

### Tier C — DEFERRED / NICE-TO-HAVE
- Live deploy of latest main to `andiostudio.com` (manual now per ₦0 GH Actions limit)
- HANDOFF.md update with the Wave 2 movie-planner progress + Free Mode fix log
- CHANGELOG.md entry for today's work

---

## 5. Blockers / risks to know

### Sourcery is SKIPPED on every recent PR
PRs #41–#45 all have Sourcery review status = `SKIPPED`. Could be webhook config, app permissions, or PRs from forks. Per memory `reference_sourcery.md` 2026-06-06 rule: clean Sourcery + 10-min Henry-silent = authorized merge. With SKIPPED status, Henry has been telling me to push anyway when build is green. Treat `SKIPPED` as "no objection" — same as previous PRs that merged fine.

### GH Actions = ₦0 spending limit
No automated CI builds will trigger on push. Local `pnpm tsc --noEmit` is the verification path. Deploys are MANUAL (local `pnpm` / `wrangler` / `firebase`).

### Production secrets mode is ON
- `~/.claude/projects/C--Users-USER/memory/feedback_secrets_phase_production.md` marker exists.
- Never chat-paste a secret value. Never reference values in replies. Redact to `<set>` / `<scrubbed>`.
- Henry rotates all APIs after productionization (deferred).

### Movie-planner Wave 2.2+ branch is stale
The local `refactor/movie-planner-wave-2` branch was the BASE for the merged Wave 2.1. Now that #42 merged, that branch's commits are squashed in main. **Don't try to push from it directly** — start a fresh branch off main for Wave 2.2.

### `pnpm prisma generate` after schema bumps
Local Prisma client can lag. Symptom: `tsc` complains about `prisma.dailySpend` / `prisma.featureFlag`. Run `pnpm prisma generate` then `pnpm tsc --noEmit`. CI auto-runs `prisma generate` before typecheck (so PRs build clean even when local is stale).

### Henry is on Windows
Bash via Git Bash. PowerShell available. **No Linux locally for this work.** Terry (Linux/Octogent) is for cross-project / server-side ops, not for editing `Desktop/CLAUDE/giohomestudio` files.

---

## 6. Next exact steps (paste-ready)

### Step 1 — Merge PR #45
```bash
gh pr merge 45 --repo htonymac/giohomestudio --squash --delete-branch
git checkout main && git pull origin main
```

### Step 2 — Verify Free Mode in browser
With dev server already up at `localhost:3200`:
```bash
curl -sI http://localhost:3200/dashboard/free-mode
```
If 200 → open Chrome (debug port 9222) at `/dashboard/free-mode`, prompt "make a 360-second cinematic story about a hero's journey", click Generate, then click "Generate Hybrid". Verify the modal shows:
- `SECONDS PER IMAGE` picker with `1s / image` and `2s / image` buttons + "≈ N images per scene" estimate
- VOICE dropdown includes `GHS Standard+ → Edge-TTS Nigerian Neural`
- After generation: banner shows "AI selected mode: \<label\>"
- Video plays with voice + music + many distinct shots + captions throughout

### Step 3 — Pick next scope
Choose ONE based on what Henry asks for:
- `merge 45` → already done above
- `continue movie-planner` → branch new from main, extract scenes tab (~355 LOC), pattern from #41/#42 commits
- `split music-video-planner` → start at `app/dashboard/music-video-planner/page.tsx` Wave 1
- `split commercial` → SECTIONAL pattern (no activeTab), read first to plan
- `split hybrid` → BLOCKED unless Henry explicitly says so
- `connect Terry` → hand off to Terry persona on Linux for cross-project ops

### Step 4 — If continuing movie-planner Wave 2.2
```bash
git checkout main && git pull origin main
git checkout -b refactor/movie-planner-wave-2-2
# Find the scenes tab line range:
grep -n '^      {activeTab === "scenes"' app/dashboard/movie-planner/page.tsx
# Read it, extract to tabs/ScenesTab.tsx using the same junior-dev pattern
# as ScriptTab.tsx / OverviewTab.tsx / DesignTab.tsx / StoryTab.tsx / CharactersTab.tsx.
```

The proven pattern across 12 children-planner + 5 movie-planner tabs:
1. New file in `tabs/` with `"use client";` + 15-25 line module docblock
2. Explicit `interface XxxTabProps` with one-line JSDoc per prop
3. State + handlers STAY in parent; tab is pure JSX
4. Style tokens (colors, cardStyle, etc) passed as props
5. Inline-async closures get lifted to parent-owned callback props
6. Use `cast at parent prop-pass` for narrow→wide setter variance (pattern P-2026-06-05)

---

## 7. How to verify a fix without browser

```bash
# Type-check the whole project (no emit, no CI cost)
pnpm tsc --noEmit

# Filter to just the files you touched
pnpm tsc --noEmit 2>&1 | grep -E "free-mode|movie-planner"

# Static-only test of the HybridModal classifier (no UI needed)
# — would need a small Playwright spec; existing tests/full-coverage-*.spec.ts files
# show the pattern.

# Sanity-check what the dev server is currently serving
curl -s http://localhost:3200/dashboard/free-mode | grep -oE 'edge-tts|GHS Standard\+|Gemini Flash' | sort -u
```

---

## 8. Decisions locked this session (don't re-litigate)

| Decision | Why locked | File / line |
|---|---|---|
| Free Mode → Hybrid path forces `provider: "piper"` | Henry: "JUST PIPER" (2026-06-07) | `free-mode/page.tsx` runHybrid TTS call |
| Image-per-scene count is user-pick (1s or 2s), NOT auto-fixed | Henry: "USER SELETE FOR HYBRID" (2026-06-07) | `free-mode/page.tsx` `secondsPerImage` state |
| Subtitle text on EVERY slide, not just first | Henry: 360s test showed no caption (2026-06-07) | `free-mode/page.tsx` assemblyScenes.push text field |
| 60-image-per-scene safety cap | Prevents runaway cost on 600s / 1-scene videos | `free-mode/page.tsx` `IMAGES_PER_SCENE_CAP` |
| Junior-dev readable extractions | Henry: "make sure a junior dev can read this" | every extracted tab has module docblock + JSDoc per prop |
| Hands off Hybrid planner unless explicit `split hybrid` | CLAUDE.md hard rule | — |
| Production secrets mode is ON | Henry triggered 2026-06-06 | memory marker file |

---

## 9. Triggers Henry has used this session (and what they mean)

| Trigger | Action |
|---|---|
| `fire` / `fire on` | continue with the in-flight work — no clarification ping |
| `split <planner>` | start segregation of that planner's god-file page |
| `connect Terry` / `terry go` | switch to Terry persona (Linux server / cross-project) |
| `connect Jason` / `connect Biz` / `connect hmksync` / `connect GHS` | switch to project-specific persona |
| `lock secrets` (NOT used this session — already in production mode) | full at-launch rotation ritual |
| pasted secret value | Phase 2 says don't echo / persist; redact to `<set>` from then on |
| "han off with good spec" | write this document |

---

## End of spec

If something below this line confuses you, default to:
1. Re-read sections 1 + 4 + 6.
2. Ask Henry only if blocked on a destructive / irreversible action.
3. For everything else: pick the lowest-risk move from section 6 and fire.
