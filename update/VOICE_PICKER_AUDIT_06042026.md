# Voice Picker & Sound Tier Audit — 2026-06-04

Read-only audit of every planner's narration / voice / sound-tier UI before the unification rollout.

**Source of truth files (already exist, MUST be reused — do not create parallels):**
- `src/lib/ghs-sound-tiers.ts` — 4-tier unified bundle (narration + music + dialogue + lipsync). The canonical tier definition.
- `app/components/VoiceTierSelector.tsx` — 3-tier voice picker with sub-model dropdown inside each tier (Standard=Piper, Pro=ElevenLabs 8 voices, Premium=Gemini Flash 8 voices).
- `app/components/NarrationControls.tsx` — narration text editor (separate from voice/tier).
- `lib/ghs-ai-tiers.ts` — 3-tier LLM picker (Free/Standard/Pro for Claude/Ollama). Separate concern.

---

## Per-planner state

| Planner | Imports `VoiceTierSelector` | Imports `GHS_SOUND_TIERS` | Imports `NarrationControls` | Current narration UI | Verdict |
|---|---|---|---|---|---|
| **video-trimmer** | ✅ line 5 → mounted line 405 | ❌ | ❌ | Uses canonical VoiceTierSelector | ✅ Reference impl |
| **video-finishing** | ✅ line 6 → mounted line 214 | ❌ | ✅ line 5 → line 332 | VoiceTierSelector + NarrationControls | ✅ Reference impl |
| **video-editor** | ✅ line 7 → mounted line 372 | ❌ | ❌ | VoiceTierSelector only | ✅ Has it |
| **commercial-planner** | ❌ | ✅ line 10 → mounted line 2162 (GHS_SOUND_TIERS.map) | ❌ | Inline render of 4 GHS_SOUND_TIERS cards | ⚠️ Half-canonical — no voice override inside tier |
| **commercial** (separate page) | ❌ | ❌ | ✅ line 11 → mounted line 1994 | NarrationControls only | ⚠️ Missing tier selection |
| **movie-planner** | ❌ | ✅ line 18 → mounted line 3879 | ✅ line 7 → mounted line 4637 | Sound tier cards + NarrationControls | ⚠️ Best of group, still no voice override inside tier |
| **music-video-planner** | ❌ | ✅ line 15 → mounted line 1822 | ✅ line 5 → mounted line 1863 | Sound tier + NarrationControls | ⚠️ Same as movie-planner |
| **series-wizard** | ❌ | ✅ line 10 → mounted line 2213 | ❌ | Sound tier cards | ⚠️ Picker only, no narration text editor |
| **children-planner** | ❌ | ❌ (uses inline 5-tier music list line 147-151) | ✅ line 6 → mounted line 5405 | Inline simple `<select>` Piper/fal-narrator/ElevenLabs (line 7041) + NarrationControls | ❌ **No tier selector, fragmented picker, inline music list** |
| **hybrid-planner** | ❌ | ❌ (uses inline 4-tier sound list line 11030) | ✅ line 7 → mounted line 11401 | Inline GHS-Sound/Plus/Pro/Premium pills, NarrationControls | ⚠️ Labels match canonical but reimplemented |
| **free-mode** | ❌ | ❌ | ❌ | Need to confirm — no imports found | ❌ **Probably no voice picker** |
| **auto-creator** | ❌ | ❌ | ❌ | No imports | ❌ **Probably no voice picker** |
| **karaoke-music-planner** | ❌ | ❌ | ❌ | Has its own GHS Standard/Pro/Karaoke voice tier (Step 6) — different system | ✋ Out of scope (karaoke flow has dedicated voice tier picker) |
| **karaoke-music-creator** | ❌ | ❌ | ❌ | Routing surface only | ✋ Out of scope |
| **scene-forge** | ❌ | ❌ (uses inline 5-tier music list line 435) | ❌ | Inline GHS Standard/Pro/Karaoke/Classic/Premium music tier list | ⚠️ Music tier only, not voice |
| **collaborative-editor** | ❌ | ❌ | ❌ | Not narration-focused | n/a |

---

## Findings

### What's already correct
- **`video-trimmer` + `video-finishing` + `video-editor`** are the reference impls of `<VoiceTierSelector>`. They use the canonical 3-tier voice picker with sub-model dropdown.
- **`commercial-planner` + `movie-planner` + `music-video-planner` + `series-wizard`** correctly import `GHS_SOUND_TIERS` from the canonical file. They render 4-tier sound cards (narration + music + lipsync bundle).

### What's broken / inconsistent
1. **Children-planner uses an inline `<select>` (line 7041)** with only 3 options (`piper`, `fal-narrator`, `elevenlabs`). It misses Gemini Premium, all FAL options, and Edge-TTS. **Highest-traffic planner has the WORST voice picker.**
2. **Hybrid-planner reimplements** GHS Sound/Plus/Pro/Premium as inline pills (lines 11030-11033). Labels match canonical but the list is hand-typed. Cannot inherit future tier additions.
3. **Children + Movie + Scene-Forge** each have an inline 5-tier MUSIC list (`piper`/`ghs_karaoke`/`fal_karaoke`/`kie_classic`/`kie_premium`) that DOESN'T match `ghs-sound-tiers.ts`. Three parallel music tier definitions drifting independently.
4. **Free Mode + Auto Creator** appear to have NO voice picker at all. Falls back to whatever default the API hardcodes (Piper).
5. **`VoiceTierSelector` (voice) and `GHS_SOUND_TIERS` (bundle) are not unified.** They're two separate concepts. The voice picker is per-clip; the sound tier is per-project. The voice override pattern Henry described should live INSIDE the sound tier as an optional `voiceProvider` override.

### Already-wired providers
- ✅ **Piper** — `/api/tts` provider="piper", default
- ✅ **ElevenLabs** — `/api/tts` provider="elevenlabs"
- ✅ **fal-narrator** — `/api/tts` provider="fal-narrator" (FAL Kokoro)
- ✅ **Gemini Flash TTS** — `/api/tts/gemini` (separate route, used by Ad Editor + VoiceTierSelector Premium tier)

### Need to wire (Phase 1)
- ❌ **Edge-TTS** (free, Nigerian voices, near-ElevenLabs quality) — pip install on server
- ❌ **gTTS** (free fallback) — pip install
- ❌ **FAL F5-TTS** (~$0.03/min, newest/most expressive)
- ❌ **FAL XTTS-v2** (~$0.04/min, voice cloning)
- ❌ **FAL Bark** (~$0.05/min, character voices)

---

## Recommended scope adjustment

Original Phase 1 said wire 6 providers. Audit shows **Gemini is already wired**. Adjusted:

### Phase 1 — wire 5 NEW providers (not 6)
1. Edge-TTS
2. gTTS
3. FAL F5-TTS
4. FAL XTTS-v2
5. FAL Bark

Time: ~80 min total (vs 90 min original estimate — save 10 min).

### Phase 2 — extend existing components (not rebuild)
- **Modify `VoiceTierSelector.tsx`** to expand sub-model dropdowns:
  - GHS Standard → add Edge-TTS Nigerian + gTTS to the existing Piper voices
  - GHS Pro → add FAL F5-TTS + XTTS + Bark to the existing ElevenLabs voices
  - GHS Premium → keep Gemini (no change)
- **Modify `ghs-sound-tiers.ts`** to add optional `voiceProviderOverride` field per tier, so users can pick a specific voice INSIDE their chosen sound tier (matches Henry's "still edit Piper" intent).

Time: ~45 min.

### Phase 3 — mount canonical components on planners that lack them
**Priority order (high traffic → low):**
1. **children-planner** — replace inline `<select>` at line 7041 with `<VoiceTierSelector>`. Also import `GHS_SOUND_TIERS` to replace inline music list at line 147-151. (~25 min)
2. **hybrid-planner** — replace inline pills (line 11030) with `GHS_SOUND_TIERS.map`. (~15 min)
3. **scene-forge** — replace inline music tier list (line 435) with `GHS_SOUND_TIERS.map`. (~15 min)
4. **free-mode** — add `<VoiceTierSelector>` (no current picker). (~10 min)
5. **auto-creator** — add `<VoiceTierSelector>`. (~10 min)
6. **commercial** (the separate /commercial page, not /commercial-planner) — add sound tier picker. (~10 min)

Time: ~85 min total.

### Phase 3.5 — staging environment (NEW, was missing)
- staging branch + Next.js port 3201 + CF Tunnel staging.andiostudio.com
- Run from `~/giohomestudio-staging/` clone
- Same DB (giohomestudio_db) for now — split later when paid users land
- 30 min setup, $0 cost

### Phase 4 — tier gating (UNCHANGED, still blocking)
Free vs Paid user. PAID tiers locked behind upgrade CTA. Daily $ cap per user on FAL spend. Cost preview before Generate.
Time: ~30 min.

### Phase 5 — Playwright tests per-planner
Time: ~45 min.

### Phase 6 — Docs + memory
Time: ~15 min.

**Revised total: ~4.5 hours** (was 5.5).

---

## Files to touch (precise list)

### Source-of-truth files (extend)
- `src/lib/ghs-sound-tiers.ts` — add `voiceProviderOverride` field
- `app/components/VoiceTierSelector.tsx` — expand sub-model lists per tier

### API routes (add branches)
- `app/api/tts/route.ts` — add edge-tts, gtts, fal-f5, fal-xtts, fal-bark branches with Piper fallback on failure

### Planner mounts (replace inline UI)
- `app/dashboard/children-planner/page.tsx` — lines 147-151 (music tier inline list) + line 7041 (voice select)
- `app/dashboard/hybrid-planner/page.tsx` — lines 11030-11033 (inline sound pills)
- `app/dashboard/scene-forge/page.tsx` — lines 435-439 (inline music tier)
- `app/dashboard/free-mode/page.tsx` — add picker (no current narration UI)
- `app/dashboard/auto-creator/page.tsx` — add picker
- `app/dashboard/commercial/page.tsx` — add sound tier (already has NarrationControls)

### Tier gating (new file)
- `app/lib/tier-gate.ts` — `canUseVoiceTier(user, tier)` helper
- `app/components/VoiceTierSelector.tsx` — accept `userTier` prop, lock PAID tiers behind upgrade CTA

### Server setup (staging)
- `~/giohomestudio-staging/` clone on server
- `scripts/deploy-staging.sh` — pull staging branch, build, restart port 3201
- New CF Tunnel hostname mapping

---

## Risks

| Risk | Mitigation |
|---|---|
| Modifying `VoiceTierSelector.tsx` breaks 3 existing reference impls (video-trimmer/finishing/editor) | Phase 5 includes regression Playwright on those 3 planners FIRST |
| Children-planner inline music list deletion strands localStorage state | Add migration shim: read old tier id → map to new GHS_SOUND_TIERS id |
| Hybrid planner inline pills change breaks Hybrid (Henry's hard rule "DON'T BREAK HYBRID") | Hybrid changes go to staging ONLY first. Henry tests on staging.andiostudio.com before main merge. |
| FAL credits burned by free users | Phase 4 tier gating ships in SAME commit as Phase 1 FAL routes go live |
| Edge-TTS endpoint closure | Cache audio, fall back to Piper, label "experimental" |

---

## Authorization needed before Phase 1

Henry to confirm:
1. ✅ Lock 8-phase plan (DONE — tasks #87-#95 created)
2. ⏸ Approve the per-planner mount order above (children → hybrid → scene-forge → free → auto → commercial)
3. ⏸ Approve tier naming map (GHS Standard adds Edge-TTS; GHS Pro adds FAL F5/XTTS/Bark; GHS Premium keeps Gemini)
4. ⏸ Approve staging insertion at Phase 3.5
5. ⏸ Approve fall-back behavior: ANY voice provider failure → automatic Piper fallback + `console.error` (no silent fail)
