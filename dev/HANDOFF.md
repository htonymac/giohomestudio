# GioHomeStudio — Developer Handoff

**Last session:** 2026-06-03 (children-planner subtitle/assembly sprint — 34 commits in 24h)
**HEAD:** `52e8d90` — pushed, live, server pulled
**Live URL:** https://andiostudio.com
**Server:** Contabo VPS, systemd `ghs.service`, port 3200, running `next dev` (Turbopack prod-chunk workaround — see below)
**Framework:** Next.js 16.2.1 + Prisma + PostgreSQL (`giohomestudio_db`)

---

## Current state

The last session shipped a subtitle font size picker (`c83357d`) and a full 10-fix audit-driven repair of the assembly + narration pipeline (commits `8ec0831`, `57e21db`, `c209d55`, `12c042c`).

**Where it stopped:** All 10 audit fixes pushed, stable tag `v2026-06-03-stable` applied at `f14e9c7`. Session docs committed at `52e8d90`. Server has all changes pulled.

---

## Active blockers

### 1. ASS subtitle still occasionally falls back to `drawtext`
Timeout was bumped 120s → 600s in `bbf4135`. A direct server test proved ASS renders correctly (30s test in 16s). At least one stuck 99% assembly was still reported **after** the bump — the actual error string was not captured. To diagnose:

```bash
journalctl -u ghs.service -f | grep "\[assemble.subtitle\]"
```

Look for the literal `[assemble.subtitle] ASS FAILED` line to see what is actually killing the ASS path now.

### 2. Scale gap
Current setup: single server, `next dev` mode, no queue. Estimated capacity: 3–5 concurrent assemblies before load avg spikes. Reaching 100 concurrent requires:
- Redis + BullMQ job queue
- Separate worker nodes (or multi-process)
- `next build` / production mode (blocked by Turbopack chunk bug — see below)
- GPU for NVENC hardware encode

Estimated timeline: 5–7 days to 100 concurrent, 2–3 weeks for 1K+.

### 3. Two simultaneous assemblies crash load avg
No client-side guard prevents triggering a second assembly while one is running. Under two concurrent assemblies, load avg hits 17+ and the bumper concat stalls at 99% for 8+ minutes.

**Mitigation needed:** client-side guard "Assembly in progress — cannot start another" + server-side dedup by `projectId`.

---

## Next steps (in priority order)

1. **Tail journalctl** for `[assemble.subtitle]` on the next stuck assembly. Commits `bbf4135` + `4cfb224` added loud logging — should surface the real failure mode.

2. **Verify subtitle font size picker** on a real assembly. Run `ffprobe -show_streams output.mp4` on the result, look at `subtitle` stream metadata, or eyeball the rendered MP4 for pixel height change.

3. **Assembly concurrency guard** — client-side state flag + server-side dedup. ~1–2h.

4. **Turbopack production-build fix** — currently running `next dev` on the server due to a Next.js 16 Turbopack chunk-naming bug in `next start`. `start:prod` script is kept as an escape hatch if a workaround is found.

5. **Children → `/api/assembly/execute` migration** — single remaining children-hybrid parity gap. Children currently uses `/api/video/assemble` (legacy). Migration wires it to the full per-sentence libass timing pipeline. Trigger: `go children assembly migration`. ~3–4h. High risk — single large change.

---

## Deploy procedure

```bash
# On the server (passwordless via sudoers):
sudo systemctl restart ghs.service

# Full deploy from local:
git push origin main
# Then on server:
git pull --ff-only && pnpm build   # ~4–6 min
sudo systemctl restart ghs.service
```

Server runs as `ghs` user. `systemctl {restart,start,stop,status} ghs.service` is available without a password for the `admin` user via `/etc/sudoers.d/ghs-systemctl`.

---

## Server paths

| Resource | Path |
|---|---|
| App root | `/home/ghs/giohomestudio/` |
| Storage | `/home/ghs/giohomestudio/storage/` |
| Piper binary | `/home/ghs/piper/piper/piper` |
| Piper voices | `/home/ghs/piper/voices/*.onnx` |
| Python venv | `/home/ghs/giohomestudio/.venv` (faster-whisper, librosa, soundfile) |
| DB backups | `/home/ghs/backups/` (daily 03:30 cron + R2 offsite) |

---

## Key protected code (do not remove or modify without deep review)

Located in `app/api/assembly/execute/route.ts`:
- `amix=duration=longest:normalize=0` — NEVER change to `duration=first`
- `-stream_loop -1` on video in `final_merge`
- `effectiveNarrDurMs` recovery in `assembleScenes()`
- Windows `fontfile` colon escape (e.g., `C\:/Windows/Fonts/arial.ttf`)

Located in `app/dashboard/hybrid-planner/page.tsx`:
- `analyzeCharacterImage` merge anti-override block
- `assemblySelectedIds.length === 0` gate (must be restored on project load)

Located in `src/lib/assembly-builder.ts`:
- `computeNarratorWindows()` export — consumed by both audio duck path and subtitle coordination path

Located in `app/api/hybrid/scene-image/route.ts`:
- `extractSceneAction()` (~line 192) — PROTECTED comment
- `sanitizeNarrativeJargon()` — strips screenplay terms from image prompts
- `resolvePublicPortraitUrl()` — FAL CDN upload + local cache for PuLID portraits

Located in `src/lib/generation/selectors/image-provider.ts`:
- `resolvePublicPortraitUrl()` — FAL CDN upload + cache
- Option B ethnicity override block in `app/api/hybrid/character-extract/route.ts`

---

## Recurring traps

| Trap | How to recognize | Fix |
|---|---|---|
| BIB-class bug (5 variants) | Narration duration = 30s, file named `tts_<ts>_silent.mp3` | Check `/api/tts` for silent `catch {}` blocks; verify Piper path via `PIPER_VOICES_DIR` env |
| Drawtext fallback slow | Assembly stuck 99% for 5+ min | Check `journalctl` for `[assemble.subtitle] ASS FAILED`; verify `DejaVu Sans` is installed: `fc-list \| grep -i dejavu` |
| Assemble button grey on reopen | Project loaded but Assemble disabled | Restore effect must also set `assemblySelectedIds` when it sets `childScenes` |
| "Fix didn't work" (actually browser cache) | Change deployed but behavior unchanged | `Remove-Item -Recurse -Force .next && npm run dev`, then Ctrl+Shift+R hard refresh, then start a NEW project (stale data in `hybrid_saved_states` DB) |
| FAL CDN URL expiry (~3h) | Scene thumbnails show broken image icons after project reload | `scene-image/route.ts` must download CDN URL to local `outputPath` before returning — never return a raw FAL CDN URL as the persistent URL |
| fail2ban trips at 4+ parallel SSH | SSH connections refused mid-deploy | Limit SSH-heavy parallel operations to 1–2 at a time, or whitelist the originating IP |

---

## Open backlog (no active work)

- **FAL gateway migration:** 7 of 24 FAL API call sites still use direct axios. Remaining sites mapped in `update/FAL_ADAPTER_MIGRATION_MAP_05302026.md`. Trigger: individual site names from the map.
- **R2 storage cutover:** `STORAGE_PROVIDER` is still `local`. R2 bucket `andio-assets` exists and was tested. Phase 3. DB-aware janitor must be built alongside the cutover.
- **Legal / T&C UI enforcement:** spec written, not wired to UI.
- **Paddle credits:** not integrated.
- **SFX semantic category system:** 60 categories designed, not built.
- **Outro mid-video bug:** reported, not reproduced with enough detail. Needs: was outro duplicated or just ordering wrong?
- **Karaoke steps 9/18:** steps 2 (Demucs) and 4 (Basic Pitch) installed on server. Remaining 7 pipeline steps not wired.
- **`prisma migrate dev` pending:** schema is ahead of migrations — run `npx prisma migrate dev` on the server before adding more schema changes.

---

## Session history summary (last 5 sessions)

| Session | Head | Key work |
|---|---|---|
| 2026-06-03 | `52e8d90` | 10-fix audit ship + BIB #4 fix + subtitle font size picker |
| 2026-05-31 | `ea64b09` | 17 commits: karaoke pipeline close, BIB resolver, subtitle disappear fix, 44 total tasks closed |
| 2026-05-29 | `efaee13` | Narrator/actor subtitle coordination + 8 FB/YT subtitle modes + highlight bouncing-ball fix |
| 2026-05-28 | (various) | Assembly concurrency fix, narrator restore, gray-frame drop, karaoke e2e green |
| 2026-05-27 | `68788e9` | Linux production launch: systemd, CF Tunnel, mobile shell, Piper TTS, 67-track music catalog |

---

## Debug recipes

### Faces wrong color / age after server restart
1. Hard refresh (Ctrl+Shift+R)
2. Delete `.next` folder, restart, hard refresh
3. DevTools → Network → trigger Expand AI → inspect `character-extract` response
4. Check `characters[0].skinTone` and `colorDescription`

### Subtitle did not burn in
Red banner in the UI shows the reason. If no banner: `subtitleStatus.requested` was false — toggle subtitle in the Assembly tab.

### PuLID face-lock not applied
Look for console log: `[scene-image] sceneId=X chars=N portraits=N faceLock=true`
- `faceLock=false` → no portrait provided
- `firstPortrait=/api/media/...` (not `fal.media`) → FAL CDN upload failed

### Bear heads / animal heads reappearing
Check `characterOverrides[].species` in the scene-image API request (DevTools Network). Should be `"human"` unless the story explicitly uses an animal character.

---

## Test utilities

```bash
node tests/test-extraction-api.mjs          # verify ethnicity extraction
node tests/verify-walk-fix.mjs              # verify walk-fallback inference
node tests/test-option-b.mjs                # verify ethnicity override
node tests/fix-broken-characters.mjs        # dry-run broken character audit
node tests/fix-broken-characters.mjs --fix  # apply fixes

npx playwright test tests/verify-ui-mapping.spec.ts --project=chromium  # UI mapping (~20s)
npx playwright test tests/full-ui-ethnicity-test.spec.ts --project=chromium  # full e2e (~2–3 min)
```
