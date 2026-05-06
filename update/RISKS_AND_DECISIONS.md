# GioHomeStudio — Risks & Architectural Decisions

Record every significant architectural call here. Required before Phase 1.6 assembly path migration.

---

## 2026-05-05 — Face-lock model: fal_flux_pulid for photo-import characters

**Decision:** When a character has `referenceImages[]` tagged `photo-import`, route image generation to `fal-ai/flux-pulid` (PuLID) instead of default Flux text-to-image.

**Why:** Standard text-to-image ignores the uploaded reference photo entirely. PuLID preserves facial identity by injecting the reference image into the generation process.

**Risk:** MEDIUM
- Requires `FAL_KEY` to be set and FAL account unlocked
- PuLID endpoint (`fal-ai/flux-pulid`) costs $0.05/image vs ~$0.01 for standard
- If FAL account not unlocked, silently falls back to Segmind p-image (no face preservation)
- PuLID requires a public-accessible reference image URL — local `/api/media/` paths return a text-only fallback

**Rollback:** Remove `useIdentityLock` from `scene-image/route.ts` L88 — back to text-to-image for all characters.

**Status:** LIVE (commit 2838df1). No Henry GO required — this is purely additive.

---

## 2026-05-05 — Assembly path: keep /api/video/assemble, defer migration to /api/assembly/execute

**Decision:** Hybrid planner currently calls `/api/video/assemble`. Target is `/api/assembly/execute` (structured AssemblyJSON with proper ducking). Migration is DEFERRED.

**Why deferred:** Response shape differs between the two routes. Migration needs end-to-end test with a real project (audio+video+narration). Premature migration could silently break assembly output.

**Risk if migrated without testing:** HIGH — assembly is the final step; broken output is not easily detected until the MP4 is generated.

**Conditions to proceed with migration (Phase 1.6):**
1. Henry writes GO in this file under "Phase 1.6 GO"
2. Test with Teddy & Dog project (SC04–SC07 videos on disk) — verify MP4 has audio ducking + narration + SFX
3. Old route `/api/video/assemble` NOT deleted until 2 successful test assemblies

**To give GO:** Add a line below: `Phase 1.6 GO: [date] — Henry`

---

## Phase 1.6 GO
*(Henry writes here when ready to migrate assembly path)*

---

## 2026-04-30 — Karaoke Steps 2/4/11 marked ⏸ post-Linux

**Decision:** Demucs (step 2), Basic Pitch (step 4), RVC (step 11) are marked as paused in the UI. They cannot be installed on Python 3.13 / Windows.

**Why:** These packages require PyTorch + Linux for stable operation. Installing on Windows risks breaking the Python environment used for other tools (librosa, soundfile).

**Risk:** LOW for now. These are enhancement steps — the pipeline works without them (step 2 = no vocal isolation, step 4 = no MIDI, step 11 = no voice enhancement). Output quality is reduced but pipeline doesn't fail.

**Rollback path:** None needed — steps are gated behind ⏸ UI badges.

**Conditions to unblock:** Migrate GHS to Contabo VPS (Ubuntu 22.04) per Linux Migration plan.

---

## 2026-04-27 — Karaoke planner split: Creator + Planner (two pages)

**Decision:** Karaoke surface split into `/dashboard/karaoke-music-creator` (input + mode selector) and `/dashboard/karaoke-music-planner` (18-step workshop). NOT a single page.

**Why:** The Creator page handles 5 input methods and 5 mode selections. Collapsing this into the workshop would create a 2000+ line page with deeply nested state. Separation keeps each surface focused.

**Risk:** LOW — both pages exist and are linked. No shared mutable state.

---

## 2026-04-24 — No function deletion rule (cross-project)

**Decision:** Existing functions are never deleted — only call sites are fixed or redirected. Dead functions may be marked `// @deprecated` but not removed.

**Why:** Henry's rule. Removing a function that has an undocumented call site causes silent runtime failures that are hard to trace.

**Enforcement:** Any function removal needs explicit Henry GO in this file.
