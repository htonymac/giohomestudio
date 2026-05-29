# GHS / Andio Studio — MASTER PLAN (beginning → end)

**Author:** Terry (Opus 4.7) · **Date:** 2026-05-26
**Status:** PLAN ONLY — no code/server change until Henry GO per phase.
**Live:** https://andiostudio.com (CF Tunnel → Linux server:3200, currently CF-Access private).

---

## 0. PRINCIPLES (binding, apply to every phase)

1. **No function deletion** — redirect/shim/`@deprecated` only. Removal needs Henry GO in `RISKS_AND_DECISIONS.md`.
2. **Tier-3 assembly is frozen** — `app/api/assembly/execute/route.ts`, `assembly-builder.ts`, `assembly-schema.ts`, `app/api/video/assemble/route.ts`. No edits without explicit GO.
3. **TSC clean after every step** (`npx tsc --noEmit` = 0) + `next build` green before any prod deploy.
4. **Branding:** never expose Claude/GPT/Gemini/Ollama/FAL/Suno to users. Show GHS tiers / AI roles only.
5. **Storage:** media → R2; metadata/keys → Postgres. Never blobs in DB. Never move old PC assets to R2. Signed URLs only, private bucket.
6. **Karaoke flow-lock** is mandatory (see Phase 4).
7. **Additive over destructive.** Browser-verify every prod deploy. Log fixes to `PROBLEM_AND_FIX.md`.
8. **"Production" = runtime mode (`next start`), NOT public launch.** They are separate switches (see Phase 1 vs Phase 6).
9. **ComfyUI is dropped** ("no comfy at all") — image gen stays cloud-only (FAL). Ignore migration docs that assume a PC ComfyUI worker.
10. **GHS → "Studio Pro" / Andio rebrand is deferred** until after Linux is stable (Phase 6).

---

## 0b. SCOPE LOCK (Henry directive 2026-05-26) — OVERRIDES conflicting items below

- **BACKEND ONLY.** Do NOT modify buttons, page layout, or any frontend structure. Frontend is well-structured. New buttons/functions ONLY when Henry explicitly asks. Terry's job = backend efficiency + pipeline correctness.
- **Autonomy granted** ("it's your call, no GO"): drive + test + verify autonomously; no waiting for per-phase GO. Still honor: freeze-check, pipe/browser-verify, log fixes to PROBLEM_AND_FIX.md, never touch payments/destructive ops without explicit ok.
- **Generation defaults for testing/driving:**
  - **Images (hybrid): REAL but cheapest** — default **FLUX schnell ($0.0004)**; fallbacks FLUX ($0.004) / Segmind ($0.005).
  - **Video: MOCK** (no real spend) — but **WIRE all video providers** and verify the pipe runs with the mock.
  - **Wire ALL providers; verify pipelines end-to-end** ("check pipes are ok").
- **D1 RESOLVED — STAY on local Postgres. Do NOT migrate to Supabase now.** Rationale: GHS is a server-side Next.js app (server is the DB client) → Supabase RLS adds little; owner-checks already live in code. Prisma already abstracts the DB → Supabase is a clean later swap (point DATABASE_URL at Supabase + migrate) with zero penalty for waiting. Migrating now mixes concerns mid-stabilization for no current benefit (private/single-user, no scale pressure). **Instead: add a local `pg_dump` backup cron** to cover the only real Supabase advantage (managed backups). Revisit Supabase at public multi-user launch.
- **Phase 2 reframed:** keep ONLY backend fixes (subtitle assembly burn-in, narration length / audio-plan tokens, token resolution, supervisor routing, chat timeout, persistence). **DROP frontend items** (FIX 1 button moves, toolbar ports) until Henry asks.

---

## 1. STATE OF TRUTH (what is actually real, 2026-05-26)

**Built & working:** site live; Piper TTS (5–6 voices); 67-track music catalog; NDJSON assembly streaming; Prisma R2/owner fields; Storage abstraction Phases 1–4 scaffolding; the 23-supervisor QC chain (~4,000 LOC) exists.

**Built but mis-running / mis-wired:**
- Server runs **`next dev` (dev mode)**, unsupervised; `ghs.service` is **dead**. (Operational risk.)
- **Hybrid Planner bypasses the 23-supervisor chain** (calls `/api/hybrid/scene-plan` directly).
- **Token Resolution Engine ~5% built** — character tokens never resolve to identity+refs before image gen.

**Stale doc claims corrected:** Karaoke is ~30% (NOT "11/18"); ComfyUI dropped; port 3200 / bucket `andio-assets` (NOT 3001 / `giohomestudio-assets`).

**Open data-loss item:** 204 Codex-deleted `storage/` assets sitting uncommitted (recoverable via `git checkout -- storage/`).

**Security landmine (dormant):** owner-less assets readable by any authed user (asset routes unwired + CF-Access gated, so not live-exploitable yet).

---

## 2. ROOT CAUSE OF MONTHS OF PAIN

Henry's recurring bugs — **character substitution wrong, actors as posed lineup, wrong/cartoon characters, culture/age ignored, scene-board ignored** — are caused by **two missing integrations, not missing features:**

1. **Token Resolution Engine not built** → typed character tokens don't resolve to identity + reference images before generation → generic/cartoon output.
2. **Hybrid bypasses the 23-supervisor QC chain** → cast/culture/continuity corrections never run on the hybrid path.

Every prior band-aid (PuLID weight tuning, anti-portrait prompts, F1–F5) treats symptoms. The cure is **wiring**, done in Phase 3.

---

# THE PLAN — PHASE BY PHASE

## PHASE 1 — STABILIZE THE LIVE SYSTEM (infra hygiene; ~2–3 h; needs GO + server sudo)

**1A. Server → production build (reversible).**
- Fix the one blocking TS error (`tests/sound-browser-check.spec.ts:18` `hasAttr`) or exclude `tests/` from build tsconfig.
- `pnpm build` → confirm **green** (TSC + lint + build). DO NOT flip until green.
- Repoint `ghs.service` ExecStart `npm run dev` → `next start -p 3200`; kill orphan `next dev` (PID holding :3200); `systemctl restart ghs.service`; confirm it owns :3200 + autostart + restart-on-crash.
- Set `NEXT_PUBLIC_APP_URL=https://andiostudio.com`.
- *Rollback:* flip ExecStart back to `npm run dev`, restart.

**1B. R2 cleaner (Henry-requested) — 3 layers.**
- (a) **R2 native lifecycle rules** on `andio-assets`: auto-delete `tmp/` after 1 day, unconfirmed `generated/` after 30 days; **never** `approved/`.
- (b) **App janitor cron**: purge abandoned `PENDING` `ContentItem` rows + their R2 objects (test videos never confirmed/approved).
- (c) **Delete button purges R2**: today delete handlers only `unlink` local files; route them through `storage.delete(r2Key)` so the existing delete button truly removes the object.

**1C. Restore deleted assets + quarantine dead code.**
- `git checkout -- storage/` (restore 204 Codex-deleted portraits/commercial images). Do NOT commit the deletions.
- Quarantine the `story-qc/` placebo (`src/lib/story-qc/*` + `app/api/story-qc/run`) so nobody wires the placeholder over the real `/api/story/supervise`.

**Exit:** site served by supervised production build, fast + auto-restart; R2 self-cleans; deleted assets restored; placebo neutralized.

---

## PHASE 2 — FIX HENRY'S VISIBLE BUGS (the ready-to-fire plans; ~4 h; PC dev → deploy)

These are already-written plans with GO-triggers. Cheap, high-visibility.

- **FIX 1** — Children planner: move scene-edit + QC/Context buttons OUT of Scene Board → Script & Story tab (story-level).
- **FIX 2** — Subtitles: 60-char drawtext cap → unlimited SRT/libass (subtitles missing on long stories). *(May already be partly shipped per FIX-2 dcd5676 — verify on live.)*
- **FIX 3** — Narration length proportional to scene duration (Children narration too short).
- **FIX 7 + 9 + scene-composition F1–F5** — stop "posed lineup," force mid-action real scenes; strip pose verbs. *(HANDOFF claims F1–F4 shipped; the 22-05 plan re-lists composition as unresolved → treat as OPEN until Henry eyeballs.)*
- **FIX 8** — per-scene AI chat timeout (8s/provider) + explicit error.
- **FIX 4/5/6** — children length retry, persist subtitleConfig+musicVolume, URL normalization.

**Triggers:** `go fix` (all 9) or `go fix N`. **Exit:** the visible day-to-day breakage is gone; sets a clean surface for Phase 3.

---

## PHASE 3 — FIX THE ROOT CAUSE + STORAGE/R2 (highest leverage; ~2–3 days)

**3A. Build the Token Resolution Engine** (Character Phase 4).
- Scan prompts for character tokens → resolve to identity object → attach reference images (upload local portraits to FAL CDN / R2 public-read for PuLID) → assemble final prompt before image/video call.
- *Fixes:* wrong/cartoon characters, substitution-doesn't-switch.

**3B. Route Hybrid through the 23-supervisor chain.**
- At minimum run cast/culture/continuity supervisors before `scene-plan`. Tune the existing pipeline (per-supervisor timeout, parallelize within dep-group, cache by storyHash, `requested?: string[]` to skip irrelevant, surface per-supervisor cost/latency). Do NOT wire the `story-qc/` placebo.
- *Fixes:* culture/age/scene-board ignored; the "30+ supervisor chaos."

**3C. Finish Storage→R2 (Phases 5/7/9 of the storage plan).**
- Phase 5: route 30+ `fs.writeFileSync` sites through `StorageProvider` (asset-row-first), chunked + verified.
- Phase 7: real tier caps (free 50MB/30s, paid tiers) + auto thumbnail/preview gen.
- Phase 9: cleanup cron + retention (folds into 1B).
- **Close the security landmine:** backfill `ownerId` on legacy assets, delete the transitional "owner-less = any authed user" rule, confirm `sign-get` denies cross-user reads.

**3D. Cutover.** Flip server `STORAGE_PROVIDER=r2` only after 3C green. New assets → R2; old assets stay local (never moved). *Rollback:* flip back to `local`.

**Decision gate D1:** stay on **local Postgres** for now (recommended) vs move metadata to Supabase. Recommend local now; design layer so Supabase is a later swap. Confirm before 3C.

**Exit:** characters/scenes render correctly; QC runs on the real path; assets live in R2 with owner-checked signed URLs, tier caps, auto-cleanup.

---

## PHASE 4 — KARAOKE (full complication)

> **Reality:** ~30% built. ~6 of 18 steps shipped, 3 Linux-blocked, 9 not built. The complication is in 3 layers — **(A) engines aren't installed, (B) 9 pipeline steps aren't built, (C) provider keys + flow-lock + modes + review aren't complete.** Installing engines only revives ~3 steps; the bulk is unbuilt code.

### 4A — Linux audio engine install (server)
**Ground truth (audited 2026-05-26):** server has Python **3.10.12 only** (no 3.11/3.12); **the ghs venv `/home/ghs/giohomestudio/.venv` does NOT exist** → entire Python audio stack missing. ffmpeg ✓. Piper binary + 5–6 voices ✓ (narration works). `sudo -n -u ghs` works (no password); `sudo apt` needs password.

| Tier | Packages | Karaoke step unblocked | Install path |
|---|---|---|---|
| 1 (required) | `faster-whisper`, `librosa`, `soundfile` | Step 3 analysis, Step 5 lyrics, Step 7 flow profiling inputs | **Now, no password** — create venv from 3.10 as ghs user, pip install |
| 2 | `basic-pitch` (TensorFlow) | Step 4 melody → MIDI | Try on 3.10; if TF fails → needs 3.11 |
| 3 | `demucs` + `torch` (CPU, ~5GB) | Step 2 vocal isolation/cleanup | Try on 3.10; heavy download |
| 4 | `RVC` (git clone + requirements) | Step 11 voice enhancement | Last; fragile pinned deps |
| — | `python3.11` + `python3.11-venv` | docs' preferred runtime | **Needs Henry password OR sudoers line** `admin ALL=(ghs) NOPASSWD: ALL` |

**Strategy:** install Tier 1–3 on existing 3.10 first (autonomous, no password). Only escalate to `apt install python3.11` if a tier fails on 3.10. RVC last. After install: set `.env` `PYTHON_BIN=/home/ghs/giohomestudio/.venv/bin/python`; verify each via a round-trip API call.

### 4B — Build the 9 missing pipeline steps
Engines installed ≠ pipeline done. Still to build:
- **Step 7 Flow Profiling** — classify singing/chanting/spoken/humming + phrase/pause/hook detection (librosa + Claude). *Gates mode routing.*
- **Step 8 Beat Recommendation** — pick 1 of 11 beat families (Afro Light/Dance, Trap, Drill, Soft Piano, Worship, Acoustic, Children, Cinematic, Jingle, Club).
- **Step 9 Production Brief** — structured JSON (genre/tempo/key/mood/structure/energy) sent to providers (never raw guess).
- **Step 10 Music Generation wiring** — call Music Provider Layer (Kie.ai Suno → Mubert → Stable Audio → Stock). Plumbing (PR #20) exists; karaoke flow doesn't call it yet.
- **Step 13 Review interface** — waveform, lyrics editor, beat/music/voice preview, approval.
- **Step 14 Version comparison** — compare beats/mixes/lyric versions, select final.
- **Step 15 Final assembly** — FFmpeg merge enhanced voice + music, align timing.
- **Step 16 Export variants** — MP3/WAV/vocal-only/instrumental/karaoke/short-clip/hook.
- **Step 17 Optional video handoff** + **Step 18 Storage lifecycle** (AES-256 + 30-day auto-purge — biometric data, mandatory).

### 4C — Provider keys
- `KIE_AI_API_KEY` ✅ already on server (Suno lyrical).
- `MUBERT_PAT` ❌ — Henry must sign up at mubert.com/business (>47s instrumental). Non-blocking (falls back to Stable Audio/Stock).
- `FAL_KEY` ✅ (Stable Audio ≤47s).

### 4D — Flow-lock + surfaces + modes (the gates)
- **Flow-lock (mandatory):** music gen MUST NOT start until tempo + melody (or marked unavailable) + lyrics + flow + brief all complete. UI button disabled until satisfied. Enforce server-side.
- **Two surfaces:** Creator (`/karaoke-music-creator`: Mode A–E + 5 inputs) routes to Planner (`/karaoke-music-planner`: 18-step workshop). Selector + planner UI are in-flight — finish both.
- **5 modes:** A Voice→Music, B Voice→Karaoke, C Voice→Polished Demo, D Voice→Lyrics+Music, E Voice→Beat Match. Each gates which steps run.
- **Security:** voice = biometric → AES-256 + TLS, 30-day max retention, auto-purge, no training without consent, no impersonation.

**Karaoke complication summary:** dependency chain is **sudoers/3.11 (maybe) → venv + Tier 1–4 install → build steps 7–10 → flow-lock gate → build steps 13–18 → wire modes A–E + two surfaces → MUBERT key for full quality.** Realistic effort: install ~1–2 h (if 3.10 works) or +1 h with 3.11; build steps 7–18 ≈ 4–6 focused sessions. **Gated on the sudoers/password decision (D3).**

---

## PHASE 5 — EXPANSION (all trigger-gated; do NOT auto-build)

| Feature | Trigger | Notes |
|---|---|---|
| Free Mode bug pass | (Henry's call) | 8 bugs FM-01..08 + features (model selector, polish, library import, char-image scene gen). **Free Mode finishes before other modes** per Henry's rule. |
| Establishing Shot system | `build establishing shot` | 8 types / 5 modes / children rules; spec ready. |
| Continuous Motion | session phrases | 7 adapters (Wan/Kling/Runway/Hailuo/Veo/Seedance), FAL endpoints; needs FAL entitlement. |
| Auto Content Creator (mobile) | explicit GO | React Native, gallery→content→WhatsApp/Telegram review. Future. |
| Semi-Auto collab mode | explicit GO | Change-planner + targeted re-render. After Free Mode. |
| Music Video / MusicVision Studio | explicit GO | Strengthen existing planner (auto-timestamp, beat sync, review-first). |
| Commercial section | explicit GO | 5-phase (Ken Burns → overlays → bulk → polish → analytics). |
| Story Bank | explicit GO | 8-layer creative engine + send-to-planner. |

---

## PHASE 6 — LAUNCH-READINESS GATES (before opening to real users)

1. **Security:** owner backfill done; cross-user reads denied; rate-limits live.
2. **Legal enforced in UI** (currently authored, not wired): AI disclosure label, sound-licensing attribution baked into exports, voice/deepfake consent gates, 3-strike, DMCA agent, political-content disclosure.
3. **Payment/credits (Finance Phase 2)** — Paddle MoR + credit DB + deduction middleware + PPP pricing + auto-switch fallback ladder. Trigger: `start Finance Phase 2`. Without this, public users burn FAL/Kie/ElevenLabs spend uncapped.
4. **Branding rebrand** GHS → "Studio Pro" inside Andio consumer platform (Watch/Music/marketplace, creators keep 70%). Cosmetic, separate clean branch.
5. **Access flip** CF-Access (Henry-only) → public + Clerk (Decision D2).

---

## CROSS-CUTTING DECISIONS STILL OWED
- **D1 — RESOLVED 2026-05-26: stay LOCAL Postgres, do NOT migrate to Supabase now** (see §0b). Add `pg_dump` backup cron instead.
- **D2 — Public access model** (CF-Access vs Clerk). Gates Phase 6.
- **D3 — Karaoke sudoers/password** (one-line `admin ALL=(ghs) NOPASSWD: ALL`, or paste password, or stay on 3.10 + autonomous). Gates Phase 4A escalation.

## VERIFICATIONS OWED (cheap, silent)
- Are H1–H5 image-first phases on `main`? (marked done "commit pending", absent from CHANGELOG)
- Is Era-Lock shipped or just spec?
- Did composition F1–F4 truly land vs 22-05 plan saying still-open?

## RECOMMENDED SEQUENCE
**Phase 1 (today)** → **Phase 2 (visible bugs)** → **Phase 3 (root cause + storage)** → **Phase 4 (karaoke, on D3)** → **Phase 5 (triggered)** → **Phase 6 (launch gates).**
Production *mode* now (Phase 1). Public *launch* only after Phase 6.
