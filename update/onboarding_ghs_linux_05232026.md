# GHS — Linux Onboarding + Architecture + Connect Workflow Plan
**Date:** 2026-05-23
**Author:** Terry (Opus 4.7)
**Mode:** Plan only — no code executed against this plan yet
**Status:** Awaiting Henry GO per-phase

---

## CONTEXT — why this doc exists

Henry brought GHS to Linux server overnight (2026-05-23 06:20 UTC, see `MIGRATION_REPORT.md`). The first migration was a **lift-and-shift dev deployment** — not the canonical migration the project's own plan docs describe. This doc captures:

1. The exact current code state (audited 2026-05-23)
2. The architecture Henry wrote (server / Postgres / R2 / PC / Cloudflare Worker split)
3. The 10-phase plan to bring the Linux deployment up to plan compliance
4. The connect-workflow pattern (`connect ghs` / `connect andio` / `connect hmksync` with dual sessions)
5. The domain plan for `andiostudio.com` (purchased on Namecheap)
6. Open questions awaiting Henry sign-off

**Naming:** keep code/folder/DB/Unix-user as `giohomestudio` / `ghs`. Brand swap to "Andio Studio" is deferred — a separate cosmetic job after migration is stable. Both `connect ghs` and `connect andio` should boot the same persona.

**Domain:** `andiostudio.com` already purchased on Namecheap (2026-05-23). DNS strategy below.

---

## PART 1 — CURRENT CODE STATE (audit 2026-05-23, read-only)

### Prisma models present (no need to recreate — already shipped)
- **Identity/money:** `User`, `Account`, `Session`, `Subscription`, `CreditTransaction`, `PaddleEvent`
- **Asset records:** `ContentItem` (50+ fields, has `videoPath`/`voicePath`/`musicPath`/`mergedOutputPath`), `ContentVersion`, `SoundAsset`, `AdAsset`, `MotionSegment`, `MotionAnchor`, `MusicGeneration`, `KaraokeRecording`, `AssemblyRecord`
- **Job/queue/audit:** `Job`, `ReviewAction`, `AlertLog`, `AuditLog`, `ProviderConfig`
- **Project state:** `ProjectSettings` (added 2026-05-08), `HybridProject`, `HybridSavedState`, `HybridScene`, `HybridShot`, `DialogueLine`, `AudioPlan`, `Story`, `Chapter`, `StoryScene`
- **Story QC:** `StoryQCProject`, `StoryQCContract`, `StoryQCDraft`, `StoryQCCastMember`, `StoryQCScenePlan`, `StoryQCContract`
- **Continuous motion:** `ContinuousScene`, `MotionSegment`, `MotionAnchor`
- **Free Mode:** `FreeModeSession`, `FreeModeMessage`, `FreeModeDailyUsage`, `FreeModeHistory`
- **Misc:** `DestinationPage`, `CharacterVoice`, `ABTest`, `ABVariant`, `EditorProject`, `ContentMemory`, `LearningProgress`, `LayerizedDesign`, `RightsConfirmation`, `StoryIdea`

### What does NOT exist in code today (verified by grep)
- ❌ R2 / AWS-SDK / S3Client — zero hits
- ❌ Signed URL generation code
- ❌ Rate-limit middleware
- ❌ Owner-check helper for asset reads
- ❌ Credit deduction wiring (Finance Phase 2 deferred per `Must Read.md §A1`)
- ❌ Thumbnail / preview generation pipeline
- ❌ Tier-based file size / video duration caps

### How files are saved today (30+ writeFileSync sites)
- Env var: `STORAGE_BASE_PATH=./storage` in `src/config/env.ts:85`
- Write targets:
  - `storage/images/<contentItemId>/*` (`src/core/pipeline.ts:345,376,526,569`)
  - `storage/video/<file>.mp4` (`pipeline.ts:420,445,510,601,619,709`)
  - `storage/voice/<file>` (`pipeline.ts:771`)
  - `storage/merged/<file>` (`src/modules/ffmpeg/index.ts:107,251`)
  - `storage/config/asset-library.json` ← **flat JSON file acting as asset registry**
  - `storage/sfx/`, `storage/music/stock/`
- Provider-direct writes:
  - `src/modules/voice-provider/{elevenlabs,cartesia,fish-audio}/index.ts`
  - `src/modules/video-provider/{fal,segmind}/index.ts`
  - `src/lib/generation/selectors/{image,video}-provider.ts`
  - `src/lib/intelligence-cache.ts`
  - `src/lib/sfx/auto-fetcher.ts`

### PC `storage/` folders (today, 2026-05-23)
```
ad-editor, audio, cache, characters, children, commercial, config,
continuous-motion, fonts, images, intro, karaoke, merged, music,
narration, scenes, series-projects, sfx, test-screenshots
+ ghs-dashboard-mockup.html (loose)
```

### Gap on `ContentItem` for plan compliance
Current `ContentItem` has `videoPath`/`voicePath`/`musicPath` (LOCAL paths) but NO:
- `r2Key` / `objectKey` field
- `visibility` field (private/public)
- `sizeBytes` field
- `previewKey` / `thumbnailKey` for separate thumbnails
- `ownerId` (User relation — needs verification on full schema slice)

---

## PART 2 — HENRY'S WRITTEN ARCHITECTURE (locked target)

### Three-layer split (Henry's words)

| Layer | Role |
|---|---|
| **Server (Contabo VPS)** | brain / state / render control — API + Postgres + FFmpeg orchestration + signed URL gen |
| **Cloudflare R2** | media files only (images / video / audio / approved outputs / archives) |
| **PC** | ComfyUI worker — GPU image generation only |
| **Cloudflare Worker** | OPTIONAL LATER — not required first |

### Where each kind of data goes (Henry's table)

| Thing | Best Place | Why |
|---|---|---|
| Users / accounts | Postgres on server | Small structured data |
| Projects / scenes / scripts | Postgres | Searchable, editable metadata |
| Job status | Postgres | Queue / state tracking |
| Credit balance / payments | Postgres | Needs transaction history |
| Asset records (metadata) | Postgres | Store owner, type, object key, status |
| Actual images / videos / audio | **Cloudflare R2** | Big files should not live in DB |
| Temporary FFmpeg files | Server local disk | Short-lived only, cleanup after render |
| Approved final outputs | R2 `/approved/` | Protected durable media |
| Character refs | R2 `/characters/` | Reusable media |
| Generated scenes | R2 `/generated/images/`, `/generated/video/` | Scalable storage |
| ComfyUI models / cache | PC / local worker | Heavy GPU work stays local |

### Locked rules (Henry's spec)
1. ❌ **Do NOT store media blobs in Postgres** — DB stores keys, files go to R2
2. ❌ **Do NOT expose ComfyUI publicly** — private worker on PC only
3. ❌ **Do NOT use permanent public R2 URLs** for private user files
4. ❌ **Do NOT move existing PC assets to R2** — old assets stay on PC, only NEW assets generated/uploaded post-cutover land in R2
5. ❌ **Do NOT break the current working localhost app**
6. ✅ Private R2 bucket by default
7. ✅ Signed URLs, 5–30 min expiry
8. ✅ Owner check before signing
9. ✅ Rate-limit watch / download per user / IP
10. ✅ Thumbnails / previews separate from full files
11. ✅ Free tier = low-res / watermarked, paid = full-res
12. ✅ Cap file size + video duration per tier
13. ✅ Clean temp files after FFmpeg render
14. ✅ Estimate generation cost → check balance → reserve → run → log actual cost
15. ✅ Cloudflare Worker NOT required for first migration — server-generated signed URLs are enough

### R2 bucket prefix layout (Henry's spec)
```
giohomestudio-assets/  (or andio-assets — naming TBD)
├── uploads/        (user uploads)
├── characters/     (character reference images, reusable)
├── stories/        (story-level assets)
├── generated/
│   ├── images/     (AI-generated stills)
│   └── video/      (AI-generated motion clips)
├── approved/       (durable, protected final outputs)
└── archive/        (cold storage for old/archived assets)
```

### Recommended asset flow (Henry's spec, paraphrased)
1. User uploads or generates media
2. Server creates **asset row in Postgres** first: `{ownerId, projectId, type, status: PENDING, r2Key, sizeBytes, durationSeconds, visibility: 'private'}`
3. File goes to R2 at the row's `r2Key`
4. User opens asset in GHS
5. Server checks: does this user own it? public/private? account allowed? rate-limit OK?
6. Server returns **short-lived signed URL** (15 min default)
7. Browser plays asset directly from R2 via signed URL

### Money/credit safety (Henry's spec)
- **Before generation:** estimate provider cost → calculate user charge → check user credit → reserve/deduct
- **After generation:** log provider used → log actual provider cost → log user charge
- **Watching own asset:** usually free or limited
- **Downloading/exporting high-res:** paid
- **Public sharing:** can have limits or paid tier

---

## PART 3 — 10-PHASE BUILD PLAN

Each phase is independently shippable and verification-gated. Phase dependencies enforced. No phase starts without prior phase verified green.

### Phase 0 — Audit baseline (DONE — see Part 1 above)

### Phase 1 — Storage abstraction (3-4h, PC, code only, ZERO behavior change)
**Goal:** Add a StorageProvider interface so all writes/reads go through one layer. Default = local FS (current behavior preserved). R2 stub for later.

**Files to create:**
- `src/lib/storage/StorageProvider.ts` — interface
  - `put(key: string, buffer: Buffer, mime: string): Promise<void>`
  - `get(key: string): Promise<Buffer>`
  - `delete(key: string): Promise<void>`
  - `signGet(key: string, ttlMin: number): Promise<string>`
  - `signPut(key: string, ttlMin: number, mime: string): Promise<string>`
  - `exists(key: string): Promise<boolean>`
- `src/lib/storage/LocalFsProvider.ts` — wraps existing `fs.writeFileSync` calls, signGet returns local file path or `/api/media/` URL
- `src/lib/storage/R2Provider.ts` — STUB only; throws `NotImplemented` until Phase 3
- `src/lib/storage/index.ts` — factory: `getStorage()` returns `process.env.STORAGE_PROVIDER === 'r2' ? r2 : local`

**Env var added:**
- `STORAGE_PROVIDER=local` (default everywhere — zero change)

**Verification:**
- `npm run build` clean
- Existing image/video/voice generation flows untouched (no refactor yet — that's Phase 5)
- TSC exit=0

**Risk:** zero — purely additive.

---

### Phase 2 — Asset record schema upgrade (1-2h, Prisma)
**Goal:** Add fields to existing asset models so they can hold R2 keys + ownership + visibility.

**Fields to add to `ContentItem`:**
- `ownerId String?` — User relation (FK)
- `r2Key String?` — object key in R2
- `previewKey String?` — thumbnail key
- `sizeBytes BigInt?`
- `visibility String? @default("private")` — "private" | "public" | "unlisted"
- `storageProvider String? @default("local")` — "local" | "r2"

**Same fields on:** `SoundAsset`, `AdAsset`, `KaraokeRecording`, `MotionSegment`, `MusicGeneration`, `AssemblyRecord` (everywhere binary media lives).

**Migration command:**
- `npx prisma db push --accept-data-loss` on dev DB, then on Linux DB
- Existing rows: `r2Key=NULL`, `storageProvider='local'` → backward compatible
- No data loss (only new nullable fields added)

**Verification:**
- Prisma generate clean
- Existing reads/writes still work (r2Key not yet populated by anything)
- TSC exit=0

**Risk:** low — additive schema change.

---

### Phase 3 — R2 client + bucket + 6 prefixes (2-3h, infra + code)
**Goal:** R2 fully working, round-trip tested. No code consumes it yet.

**Infra steps:**
1. Cloudflare dashboard → R2 → Create bucket: `andio-assets` (preferred fresh name) OR `giohomestudio-assets`
2. R2 API token: Object Read+Write scope, on this bucket only
3. Generate access keys

**Env vars added (server `.env`):**
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET=andio-assets` (or chosen name)
- `R2_PUBLIC_HOSTNAME=` (optional, for public assets later)

**Dependencies:**
- `npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`

**Code:**
- Implement `R2Provider.ts` fully (put, get, delete, signGet, signPut, exists)
- Upload placeholder `.keep` files to create 6 prefixes: `/uploads/`, `/characters/`, `/stories/`, `/generated/images/`, `/generated/video/`, `/approved/`, `/archive/`

**Verification (round-trip test):**
- Put a test PNG → get a signed URL → fetch via signed URL → byte-match original
- Verify private (no permanent public URL works)
- Verify TTL (signed URL expires after stated minutes)

**Risk:** low — R2 isolated, no production write paths use it yet.

---

### Phase 4 — Signed URL endpoint + owner check + rate-limit (2-3h)
**Goal:** Browser-safe asset access through server, never direct R2 credentials in browser.

**New routes:**
- `GET /api/asset/sign-get?assetId=<id>` — checks `asset.ownerId === session.userId` (or visibility=public) → returns signed GET URL with 15-min expiry
- `POST /api/asset/sign-put` — body `{type, projectId, mimeType, sizeBytes}` — creates Asset row in Postgres (status=PENDING_UPLOAD) → returns signed PUT URL + assetId + r2Key
- `POST /api/asset/<id>/confirm-upload` — client calls after successful PUT to flip status PENDING_UPLOAD → READY

**Rate-limit module:**
- `src/lib/rate-limit.ts` — token-bucket per `userId + IP`
- Defaults: 100 sign-get/min, 10 sign-put/min, 60 confirm-upload/min
- Storage: in-memory Map per process (acceptable for single-instance dev; consider Postgres-backed for production multi-instance)

**Owner-check helper:**
- `src/lib/asset-permission.ts`
  - `canRead(asset, session): boolean`
  - `canWrite(asset, session): boolean`
  - `canDelete(asset, session): boolean`

**Verification:**
- Sign-get request for owned asset → 200, signed URL returned
- Sign-get request for other user's asset → 403
- 101 sign-get requests in 60s → 429 on the 101st
- Signed URL works for 15 min, returns 403 after expiry

**Risk:** medium — first auth-gated path, must not leak.

---

### Phase 5 — Asset-row-first pattern refactor (4-5h)
**Goal:** Every existing write site goes through StorageProvider. Asset row in Postgres BEFORE file write. Backward compatible via `STORAGE_PROVIDER=local`.

**Pattern (replaces all `fs.writeFileSync`):**
```ts
// OLD
fs.writeFileSync(path, buffer);

// NEW
const asset = await prisma.contentItem.create({ data: {
  ownerId: session.userId,
  type: 'video',
  status: 'PENDING_UPLOAD',
  r2Key: `generated/video/${cuid()}.mp4`,
  sizeBytes: buffer.length,
  visibility: 'private',
  storageProvider: process.env.STORAGE_PROVIDER ?? 'local',
}});
await storage.put(asset.r2Key, buffer, 'video/mp4');
await prisma.contentItem.update({ where: {id: asset.id}, data: {status: 'READY'} });
```

**Refactor sites (30+ writeFileSync calls):**
- `src/core/pipeline.ts` (10 sites — images, video, slideshow, voice, asset-library.json)
- `src/lib/generation/selectors/{image,video}-provider.ts` (2 sites)
- `src/lib/save-video-asset.ts` — **migrate flat JSON registry → Postgres `ContentItem` rows**
- `src/lib/intelligence-cache.ts` — cache stays LOCAL (not asset), no refactor
- `src/modules/voice-provider/{elevenlabs,cartesia,fish-audio}/` (3 sites)
- `src/modules/video-provider/{fal,segmind,fal-adapter}/` (3 sites)
- `src/modules/ffmpeg/` — temp files stay LOCAL, OUTPUT goes through storage layer
- `src/lib/sfx/auto-fetcher.ts` — SFX library files stay LOCAL (curated, not user assets)

**Decision: NOT refactored (stay local FS):**
- `intelligence-cache.ts` — caches LLM responses, not user assets
- `llm-settings.ts` — config file, not user asset
- `publisher/*/index.ts` — OAuth token files, not user assets
- SFX library `storage/sfx/` — curated stock, not user-generated

**Verification:**
- End-to-end image gen test → asset row appears in Postgres → file appears in R2 (when `STORAGE_PROVIDER=r2`) OR local FS (when `local`)
- Existing flows still work with `STORAGE_PROVIDER=local`
- TSC clean

**Risk:** medium-high — touches 30+ files. Must be done in chunks with verification between.

---

### Phase 6 — PC ComfyUI worker daemon (4-5h, NEW codebase on PC)
**Goal:** Use PC's GPU for ComfyUI image generation while server orchestrates.

**New folder:** `tools/comfyui-worker/` (or separate repo — your call)

**Stack:** Node.js + TypeScript

**Behavior:**
- Polls `GET <server>/api/jobs/pending?provider=comfyui&workerId=<hostname>` every 3-5 seconds
- On job pickup:
  1. Locks job via `PATCH /api/jobs/<id> {status:RUNNING, workerId}`
  2. Calls local `http://127.0.0.1:8188` ComfyUI with job parameters
  3. Waits for ComfyUI to complete (poll status)
  4. Requests signed PUT URL from server: `POST /api/asset/sign-put`
  5. Uploads PNG directly to R2 via signed PUT
  6. Confirms upload: `PATCH /api/jobs/<id> {status:COMPLETE, r2Key}`
- On failure: `PATCH /api/jobs/<id> {status:FAILED, error}` with retry logic (max 2 retries)

**Worker run mode:**
- Windows: NSSM service OR PowerShell startup script
- macOS: launchd plist (later if needed)
- Linux: systemd unit (later if a Linux GPU worker is added)

**Server-side new route:**
- `GET /api/jobs/pending?provider=<provider>&workerId=<id>` — returns oldest PENDING job for that provider
- `PATCH /api/jobs/<id>` — update status, requires workerId match

**Verification:**
- Queue a comfyui job from server (manual Postgres insert OR new admin button)
- PC worker picks it up within 5s
- PNG lands in R2
- DB job row updated to COMPLETE

**Risk:** medium — new component, but isolated from server flows.

---

### Phase 7 — Tier caps + thumbnail/preview generation (3-4h)
**Goal:** Enforce per-tier file size + duration limits. Auto-generate previews for free-tier viewing.

**New table OR config:**
- `src/lib/tiers.ts` — hardcoded for v1:
  ```ts
  TIERS = {
    free: { maxFileSizeBytes: 50_000_000, maxVideoDurationSec: 30, previewQuality: 'low', watermarkRequired: true },
    standard: { maxFileSizeBytes: 500_000_000, maxVideoDurationSec: 180, previewQuality: 'med', watermarkRequired: false },
    pro: { maxFileSizeBytes: 2_000_000_000, maxVideoDurationSec: 600, previewQuality: 'high', watermarkRequired: false },
    premium: { ...no caps... }
  }
  ```
- Eventually move to `Tier` Prisma model + admin UI (Phase G of SEGREGATION)

**Pre-upload check:**
- `/api/asset/sign-put` checks user's tier → rejects if `sizeBytes > tier.maxFileSizeBytes`
- Returns 413 Payload Too Large with clear error

**Post-render thumbnail/preview generation:**
- After FFmpeg renders MP4 → auto-generate:
  - Thumbnail: `ffmpeg -i out.mp4 -vframes 1 thumb.jpg` (single frame at 1s)
  - Low-res preview: `ffmpeg -i out.mp4 -vf scale=480:-1 -crf 28 preview.mp4`
- Store both as separate R2 keys, linked to parent asset via `previewKey`, `thumbnailKey`

**API change:**
- `/api/asset/sign-get?assetId=X&quality=preview|full`
  - `preview` (default) — returns preview key (always allowed)
  - `full` — checks user tier, requires paid OR owner

**Watermark:**
- Free tier downloads/exports get watermark burned in (FFmpeg drawtext or PNG overlay)
- Decide on watermark image + position later

**Verification:**
- Free user uploads 100 MB file → 413 (cap is 50 MB)
- Paid user uploads 500 MB → success
- Free user views their own video → low-res preview served
- Free user tries `quality=full` → 403 (or upgrade prompt)

**Risk:** medium — first business-logic gate on assets.

---

### Phase 8 — Credit-before-generation wiring (2-3h)
**Goal:** No generation runs without reserved credit.

**STATUS:** **DEFERRED** per `Must Read.md §A1` — "Finance Phase 2: trigger phrase 'start Finance Phase 2' or 'build credits'"

**When Henry unlocks:**
- Every generation route (image, video, voice, music, karaoke) flows through:
  ```ts
  const cost = await estimateGenerationCost(model, params);
  const balance = await getCreditBalance(userId);
  if (balance < cost) throw 402;  // Payment Required
  const reservation = await reserveCredit(userId, cost, jobId);
  try {
    const result = await callProvider(...);
    const actualCost = result.providerCost;
    await commitCredit(reservation, actualCost);
    await logUsage(userId, model, actualCost);
    return result;
  } catch (err) {
    await refundCredit(reservation);
    throw err;
  }
  ```
- Tables: `User` ✓, `Subscription` ✓, `CreditTransaction` ✓ — all already in schema
- New helpers: `src/lib/credits/{balance,reserve,commit,refund,estimate}.ts`

**Verification:**
- User with 0 credit tries to generate → 402
- User with 100 credit generates 50-credit operation → success, balance drops to 50
- Generation fails → balance restored to 100

**Risk:** high — touches every paid feature. **DO NOT START** without Henry GO.

---

### Phase 9 — Temp cleanup + retention policy (1-2h)
**Goal:** Server disk doesn't fill from leftover FFmpeg intermediates.

**Cleanup script:** `tools/cleanup-cron.sh`
```bash
#!/bin/bash
# Delete temp files older than 1h
find /home/ghs/giohomestudio/storage/temp -type f -mtime +0.04 -delete
# Delete intermediates older than 24h
find /home/ghs/giohomestudio/storage/intermediates -type f -mtime +1 -delete
# Delete cache older than 7d
find /home/ghs/giohomestudio/storage/cache -type f -mtime +7 -delete
```

**Cron entry (as ghs user):**
```
*/15 * * * * /home/ghs/cleanup-cron.sh >> /home/ghs/cleanup.log 2>&1
```

**R2-side archival policy (long-term):**
- Asset metadata in Postgres tracks `lastAccessedAt`
- Cron job moves assets to `/archive/` prefix after 30 days of no access (cold storage)
- **APPROVED assets are NEVER auto-archived** — checked via `visibility='approved'` or status flag

**Verification:**
- Create test file in `storage/temp/` → wait 30 min → cron runs → file gone
- Create test file in `storage/intermediates/` → still there after 30 min → gone after 25 hrs

**Risk:** low — automated, reversible by stopping cron.

---

### Phase 10 — Cutover runbook (gentle, no asset move)
**Goal:** Flip server `.env` to `STORAGE_PROVIDER=r2`. NEW assets go to R2 + Postgres. Old PC + Linux files stay local untouched.

**Pre-cutover checklist:**
- [ ] Phase 1-7 stable on PC with `STORAGE_PROVIDER=local`
- [ ] R2 round-trip test passing (Phase 3)
- [ ] Signed URL flow tested (Phase 4)
- [ ] At least one image gen + one video gen test through new path on PC
- [ ] Tag PC HEAD as `pre-r2-cutover-2026-XX-XX`

**Cutover steps:**
1. SSH to server, edit `/home/ghs/giohomestudio/.env`:
   - `STORAGE_PROVIDER=r2`
   - Confirm `R2_*` vars set
2. Restart: `sudo systemctl restart ghs.service`
3. Sign in to GHS via browser
4. Generate test image → verify lands in R2 + Postgres row created with r2Key
5. Generate test video → same check
6. Watch journalctl for any errors
7. If issues: flip back to `STORAGE_PROVIDER=local` and revert; investigate

**Post-cutover (NOT in this plan, your call later):**
- After 2-4 weeks of stable R2 usage, optional: script to copy `storage/approved/` from PC → R2 for archival
- Per spec: "dont move any pc asset to r2" — only run this if you decide to

**Verification:**
- New generations on Linux land in R2 ✓
- Old `storage/` files on Linux still readable (`STORAGE_PROVIDER=r2` doesn't break local reads — `LocalFsProvider.get()` still works for legacy paths)
- PC dev still works with `STORAGE_PROVIDER=local`

**Risk:** medium — env flag flip is single point of failure. Have rollback ready.

---

## PART 4 — DEPENDENCIES + ORDERING

```
Phase 0 (audit done)
    ↓
Phase 1 (storage abstraction) ← blocks 5, 6, 7
    ↓
Phase 2 (Prisma schema)       ← blocks 4, 5
    ↓
Phase 3 (R2 wired)  +  Phase 4 (signed URLs + rate-limit + owner check)
    ↓                       ↓
    └────── Phase 5 (refactor write sites) ←─────┘
                       ↓
    ┌──────────────────┼──────────────────┐
    ↓                  ↓                  ↓
Phase 6 (PC worker)   Phase 7 (tier+preview)   Phase 9 (cleanup cron)
                       ↓
                  Phase 8 (credits) — GATED by Henry "start Finance Phase 2"
                       ↓
                  Phase 10 (cutover — flip env flag)
```

**Parallelizable:** Phase 6 (PC worker) can be built anytime after Phase 3.

**Total work to spec compliance:** 22–30 focused hours, spread across ~1 week of focused dev (or 2 weeks with browser verification between phases).

---

## PART 5 — CONNECT WORKFLOW (`connect ghs` / `connect andio` / `connect hmksync`)

### Honest baseline — how Terry did last night's migration
- **One pattern only:** PC Terry session drove Linux via SSH commands (`ssh hmk 'sudo -u ghs ...'` for GHS work, `ssh hmk 'sudo -u hmksync ...'` for HMK work)
- Did NOT open a Claude Code session on Linux
- This is "Terry-on-PC, drives via SSH" — call this **Pattern A**

### Three legitimate patterns

**Pattern A — PC Terry drives Linux via SSH (used last night)**
- One Claude Code window on PC
- `connect ghs` (or `connect andio`) → loads persona → SSH-based commands
- ✅ One agent in head, no SSH terminal management, all sessions on PC
- ❌ No persistent Linux shell, every command is fresh SSH, harder to tail logs

**Pattern B — Open Claude Code ON Linux as project user**
- SSH into Linux as `admin` → `sudo -u ghs -i` → `cd /home/ghs/giohomestudio` → `claude` (installed on server per `00_MASTER_SERVER_PLAN.md §9`)
- Run inside `tmux` for detach/reattach
- ✅ Native disk speed, persistent shell, native log tailing
- ❌ Needs Anthropic key on server, separate from PC Terry

**Pattern C — Hybrid (RECOMMENDED for Henry's use case)**
- Terry on PC = coordinator + light edits + cross-project work
- Per-project Claude on Linux in tmux for heavy in-project work (renders, deep debugging, big refactors)
- Both alive simultaneously, touch different files, no conflict

### Dual concurrent sessions (Henry's question)

**Way 1 — Two PC Claude Code windows**
- Window 1: `connect hmksync` → drives `ssh hmk 'sudo -u hmksync ...'`
- Window 2: `connect ghs` → drives `ssh hmk 'sudo -u ghs ...'`
- Both separate Claude processes on PC. Run in parallel. No risk of cross-contamination — different SSH paths, different working dirs, different DBs.

**Way 2 — Two Linux tmux sessions**
```
tmux new -s hmk       # ssh as admin → sudo -u hmksync -i → cd /home/hmksync/hmksync → claude
Ctrl+B then D          # detach
tmux new -s ghs       # ssh as admin → sudo -u ghs -i → cd /home/ghs/giohomestudio → claude
```
Two Claude processes on Linux, one per tmux pane, detach/reattach from PC or phone.

**Way 3 — Mix (RECOMMENDED)**
- Terry on PC = `connect hmksync` for monitoring + cross-project
- Linux tmux `ghs` = heavy GHS work that benefits from native speed + journal tailing
- Both alive simultaneously, no conflict

### Persona trigger update — add `connect andio` aliases

Edit `~/.claude/CLAUDE.md` trigger table row for GHS to add Andio aliases (keep GHS aliases — backward compat):

```
| connect ghs / connect giohomestudio / /ghs / ghs go / CONTINUE GHS / 
  connect andio / connect andiostudio / /andio / andio go / CONTINUE ANDIO / 
  gio studio
  → (no skill — load persona_ghs.md from memory)
```

`persona_ghs.md` keeps its filename (no rename) but adds at top:
> *"Also known as Andio Studio. Brand swap deferred — code/folder/DB/Unix-user remain `giohomestudio` / `ghs`."*

### Project-user-server SSH command shape (lock per persona)

Each persona's boot doc enforces:

| Persona | SSH-as-user shape |
|---|---|
| ghs / andio | `ssh hmk "sudo -u ghs bash -c 'cd /home/ghs/giohomestudio && <cmd>'"` |
| hmksync | `ssh hmk "sudo -u hmksync bash -c 'cd /home/hmksync/hmksync && <cmd>'"` |
| giobiz | `ssh hmk "sudo -u giobiz bash -c 'cd /home/giobiz/giobiz && <cmd>'"` |
| marabiz | `ssh hmk "sudo -u marabiz bash -c 'cd /home/marabiz/marabiz && <cmd>'"` |

Hard rule from `00_MASTER_SERVER_PLAN.md §5b`: each persona only touches its own home dir. Never touch other projects' homes.

### Concurrent-session safety rules

**Safe combos:**
- ✅ Terry (HMK) on PC + GHS on Linux tmux
- ✅ GHS on PC + HMK on Linux tmux
- ✅ Two PC Claude windows, one per project
- ✅ Two Linux tmux sessions, one per project

**Unsafe combos (will conflict):**
- ❌ Two GHS sessions (PC + Linux) editing the same repo
- ❌ Two HMK sessions (PC + Linux) editing the same repo
- ❌ Any combo where a long-running build is happening and another agent runs the same build

**Lock pattern (already in Terry's skill, extend to project personas):**
- On boot, write `.<project>_active_pid` file with current PID + ISO timestamp
- If file exists with live PID, boot as PASSENGER (read-only mode)
- On exit, delete the lock file
- One persona doc, one writer at a time per project

**Recommend:** add this lock pattern to `persona_ghs.md` and `persona_hmksync.md` boot sections. Currently only Terry has it.

### Octogent role (optional, for headless background dispatch)

Server runs Octogent tentacles per project on ports 8788-8791. Currently:
- `octogent@hmksync.service` on 8791 — running
- `octogent@giobiz.service` on 8790 — running
- `octogent@ghs.service` on 8788 — RESERVED, NOT yet started
- `octogent@marabiz.service` on 8789 — status unclear

Octogent = headless agent runner. When Henry tells Terry "build feature X on GHS overnight", Terry can either:
- Drive directly via SSH (Pattern A above), OR
- POST job to `http://localhost:8788/api/dispatch` and Octogent runs it on the server, Terry polls status

**For overnight autonomous work:** Octogent is better (survives terminal close, easier monitoring).
**For active interactive dev:** direct SSH or Linux tmux is better (faster feedback).

**Not needed for first launch.** Add `octogent@ghs.service` later if you start doing overnight render queues or background batch jobs.

---

## PART 6 — DOMAIN PLAN (`andiostudio.com`, bought on Namecheap)

### Goal
`https://andiostudio.com` → Linux server `localhost:3200` → GHS Next.js dev server.

### Recommended path (Cloudflare Tunnel, ~10 min after DNS propagation)

**Why:** existing cloudflared tunnel already runs on server for octogent UIs (`oct-*.hmksync.com`). Adding one more hostname is ~5 min wiring. Cloudflare manages TLS, hides server IP, gives DDoS protection, no firewall changes needed.

**Step 1 (Henry, Namecheap side):**
1. Cloudflare dashboard → Add a Site → `andiostudio.com` → Free plan → confirm
2. Cloudflare assigns 2 nameservers (e.g. `aaa.ns.cloudflare.com`, `bbb.ns.cloudflare.com`) — note them
3. Namecheap → Domain List → `andiostudio.com` → Manage → Nameservers → Custom DNS → paste both Cloudflare nameservers → save
4. Wait 30 min – 4 hrs for DNS propagation (usually under 1 hr)
5. Cloudflare emails Henry when site is "Active"

**Step 2 (Terry, server side, ~5 min after Step 1 confirmed):**
1. Add hostname to existing tunnel config (`/etc/cloudflared/config.yml` or via dashboard):
   ```yaml
   - hostname: andiostudio.com
     service: http://localhost:3200
   - hostname: www.andiostudio.com
     service: http://localhost:3200
   ```
2. Reload cloudflared: `sudo systemctl reload cloudflared`
3. Cloudflare dashboard → DNS → confirm CNAME records auto-created for tunnel
4. (Optional) Cloudflare Access policy: gate to Henry's email only (same as octogent UIs)
5. Verify: `curl -I https://andiostudio.com` → 200 OK from server

**Step 3 (config in GHS app):**
- Update `/home/ghs/giohomestudio/.env`:
  - `NEXT_PUBLIC_APP_URL=https://andiostudio.com`
- Restart: `sudo systemctl restart ghs.service`

### Alternative path (Nginx + Let's Encrypt — NOT recommended)

- Keep Namecheap DNS, add A record `andiostudio.com → 185.2.100.210`
- Open port 443 in UFW: `sudo ufw allow 443/tcp`
- Nginx server block + Certbot for TLS cert auto-renewal
- More attack surface (server IP exposed), more maintenance (cert renewal, firewall), no CF edge protection

**Reason to use:** only if you don't want Cloudflare in the path (very rare).

---

## PART 7 — OPEN QUESTIONS (need Henry sign-off before action)

### Storage architecture questions
1. **`Asset` table shape:** one new normalized `Asset` table OR add fields to each existing asset model (`ContentItem`, `SoundAsset`, `AdAsset`, `KaraokeRecording`, `MotionSegment`, `MusicGeneration`)?
   - Recommend: add fields to existing models for v1 (less migration risk), consolidate later if pain emerges.
2. **Tier caps location:** hardcode in `src/lib/tiers.ts` OR new `Tier` Prisma model with admin UI?
   - Recommend: hardcode for v1, move to DB when there's a real admin user.
3. **PC ComfyUI worker home:** separate repo (`htonymac/comfyui-worker`) OR new folder inside `giohomestudio/` (`tools/comfyui-worker/`)?
   - Recommend: `tools/comfyui-worker/` inside main repo for v1 (one git history, easier to keep in sync).
4. **R2 bucket name:** `andio-assets` (fresh) OR `giohomestudio-assets` (matches code)?
   - Recommend: `andio-assets` — fresh brand, server-side names stay `giohomestudio`. R2 buckets are user-facing in invoices and dashboard.
5. **Rate-limit storage:** in-memory `Map` (single instance, lost on restart) OR Postgres-backed (survives restart, cluster-safe)?
   - Recommend: in-memory for v1 (single dev instance), Postgres-backed only when scaling to multiple replicas.

### Connect workflow questions
6. **Persona file rename:** keep `persona_ghs.md` filename + add Andio aliases, OR rename to `persona_andio.md`?
   - Recommend: keep filename, add aliases. Rename forces all `[[persona_ghs]]` link updates across memory.
7. **Default Andio session mode:** Pattern A (PC Terry drives) OR Pattern B (Linux tmux) OR your call per-task?
   - Recommend: Pattern C (hybrid) — Pattern A for quick coordination, Pattern B for deep work.
8. **Public access OR Henry-only:** Cloudflare Access (Henry-only, like octogent UIs) OR public with Clerk auth?
   - Recommend: Henry-only via CF Access until product is launch-ready (~1-2 months), then public with Clerk.
9. **Octogent for GHS:** start `octogent@ghs.service` now OR defer until needed?
   - Recommend: defer. Add only when first overnight render queue is needed.

### Cutover questions
10. **PC `giohomestudio` after cutover:** still primary dev OR Linux becomes primary and PC becomes scratch?
    - Recommend: PC stays primary dev for 2-4 weeks observation. Then if Linux stable, optionally flip primary.
11. **DB sync from PC to Linux:** ever do a full data resync, OR start fresh on Linux?
    - Per Henry's last night decision tree: A=start fresh / B=selective rsync / C=full resync. **Not chosen yet.**

---

## PART 8 — IMMEDIATE NEXT ACTIONS (HENRY-SIDE FIRST)

**Today / this session — Henry:**
1. Add `andiostudio.com` to Cloudflare (free plan), note the 2 nameservers
2. Namecheap → switch `andiostudio.com` nameservers to Cloudflare's 2
3. Wait for Cloudflare to email "Active" (under 1 hr typical)
4. Decide on Open Questions above (especially Q4 bucket name, Q6 persona file, Q8 public-vs-Henry-only)

**After Cloudflare reports Active — Terry (with Henry GO):**
1. Add `andiostudio.com` hostname to existing tunnel (5 min)
2. Update GHS `.env` with new `NEXT_PUBLIC_APP_URL`
3. Restart ghs.service
4. Verify `https://andiostudio.com` loads GHS

**Next session — Terry (with Henry GO per phase):**
1. Phase 1 (storage abstraction) on PC
2. Phase 2 (Prisma schema fields) on PC then Linux
3. Phase 3 (R2 bucket + client) on Cloudflare + server
4. Phase 4 (signed URL endpoints + rate-limit)
5. Phase 5 (refactor write sites) — chunked, verified per chunk
6. Phase 6-7 in parallel after Phase 5 done
7. Phase 8 deferred until "start Finance Phase 2"
8. Phase 9 (cleanup cron) anytime
9. Phase 10 (cutover) only after Phase 1-7 verified green

---

## PART 9 — WHAT'S INTENTIONALLY NOT IN THIS PLAN

- Cloudflare Worker for edge asset delivery — Henry's spec says "optional later, not required first"
- Moving existing PC assets to R2 — Henry's spec says "dont move any pc asset to r2"
- Public asset URLs — spec says signed URLs only, always
- Cloudflare Images product — superseded by R2 + own thumbnail generation
- Hot-link / scraping protection beyond rate-limit — later phase if needed
- Brand rename to "Andio Studio" everywhere — separate cosmetic job after stable
- Mobile launch — separate roadmap
- GPU server (Hetzner/Vast.ai for Wan/SVD) — separate infra decision
- SEGREGATION_PLAN.md Phase B/C.7/D/E.2 — pre-existing work tracked separately, NOT in this onboarding plan

---

## CHANGELOG OF THIS DOC
- 2026-05-23 — initial draft by Terry (Opus 4.7) covering audit, 10-phase plan, connect workflow, domain plan
