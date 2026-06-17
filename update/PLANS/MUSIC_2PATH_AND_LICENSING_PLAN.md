# Music: 2-Path System + License Documentation Plan

**Locked with Henry 2026-06-15.** Triggered by a YouTube Content ID claim on a published
video (background track `epic_orchestral.mp3`). Henry: "make 2 path of music — 1 AI
generated clean, 2 download royalty free user select from where they make video... i
need to know where my AI musics are from and how do I get document for them in case my
user create a video, post, and get flagged."

## Decisions (Henry, 2026-06-15)
- **Path 1 AI engine:** Stable Audio via FAL (FAL_KEY set). Suno toggle later (KIE key empty).
- **Path 2 RF sources:** Pixabay + Internet Archive + Mixkit + Jamendo (Jamendo filtered to CC0/commercial-safe only — Henry bans CC-BY attribution).
- **Placement:** both Hybrid + Free Mode music step.

## The real problem: NO per-track license documentation today
Verified on server 2026-06-15:
- 19 `ia_*` = Internet Archive "cloud-music-4" PUBLIC DOMAIN (CC0). **0 manifest entries** — no source URL, no license link stored.
- ~50 `freepd/` = FreePD.com CC0. **No manifest.** Stock route MISLABELS them as Kevin MacLeod CC-BY (which Henry's locked policy BANS).
- 17 pre-2026 bundled = unknown provenance → **quarantined** to `storage/music/stock/_quarantine_unlicensed/` + pruned from asset library (caused the claim).

Legal reality to encode:
1. CC0/PD does NOT prevent YouTube Content ID claims — you DISPUTE them, and disputes need the **source URL + license URL** as evidence. No stored proof = can't dispute.
2. "AI-generated" ≠ copyright-free. Protection = the generator's commercial-use license/ToS + a record that the user generated it.

## Locked safe-music policy (from AUTONOMOUS_PUSH_05312026.md)
- ✅ CC0 / Public Domain, FreePD, Internet Archive, Pixabay, Mixkit
- ❌ Incompetech / Kevin MacLeod (CC-BY attribution), CC-BY / SA / NC

## Build slices
### Slice 0 — DONE 2026-06-15
- Quarantine 17 unlicensed tracks (files moved + asset-library pruned + catalog filter PR #123).
- Catalog `/api/music/stock` drops non-`verified` + blocked; added youtubeContentIdWarning.

### Slice 1 — License record foundation (NEXT)
- Per-track license schema: `{ filename, source, sourceUrl, license, licenseType, licenseUrl, acquiredAt, commercialUseAllowed, attributionRequired, attribution }`.
- Back-fill manifests: 19 IA (CC0, archive.org collection URL + license URL), 50 FreePD (CC0, freepd.com + CC0 URL). FIX the FreePD CC-BY mislabel → CC0.
- `/api/music/license?track=<id|filename>` returns the record.
- Per-video **Music License Sheet**: when a video is assembled with music, generate a downloadable record (track + source + license + URL + date). Surface a "Download license proof" button.

### Slice 2 — Path 1 AI generate (fix + wire)
- DIAGNOSE: `/api/music/generate` with providerKey `stable_audio` SILENTLY FALLS BACK to stock (returned `ia_soft_ambient.mp3`, providerKey `stock`) despite FAL_KEY set. Find why (adapter error / FAL endpoint / routing) and make it truly generate. Surface generation errors instead of silent stock fallback.
- Store AI license record: provider=Stable Audio (Stability AI / FAL), model, generatedAt, commercial-use ToS URL.

### Slice 3 — Path 2 RF download (search + ingest with proof)
- Unified `/api/music/royalty-free?source=...&q=...` search → returns candidates with license metadata → user picks → download into library WITH full license record.
- Sources: Internet Archive (no key, now), Freesound (key set, filter CC0), Pixabay (needs PIXABAY_API_KEY), Jamendo (needs JAMENDO_CLIENT_ID, filter CC0).
- "MAKE MORE DOWNLOAD" = batch-fetch more safe tracks into the library.

### Slice 4 — UI chooser in both planners
- Music step shows TWO clear paths: "Generate AI Music (unique, copyright-safe)" / "Royalty-Free Library (browse + download)".
- Each selected track shows its license badge + "view license proof".
- Build/prove in Free Mode + Hybrid (Henry: both).

## Keys Henry must add (.env on server)
- `PIXABAY_API_KEY` (free at pixabay.com/api/docs)
- `JAMENDO_CLIENT_ID` (free at developer.jamendo.com)
- (later) `KIE_AI_API_KEY` for Suno premium.

## 2026-06-15 UPDATE — Henry hard rule: NO CC-BY, nothing that can raise an issue
- Read `update/LEGAL/SOUND_LICENSING.md`. Allowed = CC0/PD + Pixabay License + Mixkit License ONLY.
- **DROP Jamendo** from Path 2 — it is overwhelmingly CC-BY (attribution). Creds were supplied
  (stored in server `.env` as JAMENDO_CLIENT_ID/SECRET) but Jamendo stays **PARKED/disabled**
  until/unless a CC0-only or paid-Jamendo-Licensing path is used. Do NOT pull CC-BY tracks.
- **DROP Freesound for MUSIC** — mostly CC-BY. (SFX fetcher keeps its own safeForCommercial filter.)
- **Quarantined the 50 FreePD / Kevin MacLeod tracks** → `_quarantine_ccby/` — CC-BY label + Kevin
  MacLeod is the #1 Content-ID-claimed "free" music. Removed from the served catalog.
- Revised **Path 2 sources = Pixabay + Mixkit + Internet-Archive-CC0 only** (all no-attribution).
- Live library now = 19 Internet Archive PD tracks; each still needs a per-track CC0 source record (Slice 1).
- Pixabay key NOT present in any .env — Henry to create one at pixabay.com → PIXABAY_API_KEY.
- Backfilled to brain (app=ghs): topics `sound-licensing` + `music-copyright-incident`.

## Guardrails
- DO NOT break assembly or Free Mode. Music stays optional; "no music" is a valid safe state.
- Never serve a track without a license record once Slice 1 lands.
