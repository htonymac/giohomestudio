# GHS HANDOFF — Session 19 (Children Vocabulary + PuLID Tuning + Scene Composition Plan)

**Last updated:** 2026-05-21
**Build:** TSC clean — 0 new errors (only pre-existing test error in tests/sound-browser-check.spec.ts)
**Git:** All pushed to `main`. HEAD = `f39328a`.
**Port:** 3200 | **DB:** giohomestudio_db (PostgreSQL + Prisma)

---

## ⚠ READ FIRST — IF ANY FACE/CLOTHING/SCENE BUG REPEATS

Browser caching has been the #1 cause of "fix didn't work" in this session. Before debugging anything:

```powershell
# 1. Stop dev server (Ctrl+C)
Remove-Item -Recurse -Force .next
# 2. Restart
npm run dev
# 3. Wait for "✓ Ready"
# 4. In browser: Ctrl+Shift+R (HARD refresh, no cache)
# 5. Start a BRAND NEW project (broken character data persists in hybrid_saved_states DB)
```

---

## 🔥 PENDING WORK — Highest priority first

### A. ⏳ Scene Composition Fix (approved plan, no code yet)
**Plan file:** `update/PLANS/scene_composition_fix_21052026.md`

**Problem:** PuLID-locked scenes look like character reference sheets (3 people standing in a row, plain BG) instead of real scenes. Scene location/action/mood are ignored. Non-PuLID scenes (Flux Schnell) work correctly.

**Approved fix order:** F1 (id_weight 0.75→0.55) + F2 (reorder prompt: location/action first) + F3 (anti-portrait directives). Then F4 if needed (drop PuLID for multi-char). Then F5 (face crop). F6 (post-process face swap) is last resort.

**Triggers:** `go F1 F2 F3` / `go F4` / `go all F1-F5`

### B. ⏳ Movie + Children Scene Editor Port (approved plan, no code yet)
**Plan file:** `update/PLANS/hybrid_style_story_chid_movie21052026.md`

**Goal:** Port Hybrid's scene editor toolbar (✨ Polish, ➕ Add Action, 💗 Make Emotional, ✅ QC, 🪶 Context, Ask AI, etc.) to Movie + Children planners. Children version adapted: drops Make Intense / Reduce Action; adds Make Funny / Make Playful / Make Adventure / Adult Word Check / Filter Word.

**Triggers:** `go phase A` (Movie) / `go phase B` (Children) / `go all`

### C. ⏳ Substitution Bug — "works but doesn't switch"
Henry reported in Children Planner: "substitution work on for children, don't break — but substitution does not switch."

**Hypothesis:** when a character is edited/swapped in the Character tab, scene image regen may use the OLD portrait URL (cached on FAL CDN by `_portraitCdnCache` Map in `image-provider.ts`). The Map is keyed on the `/api/media/...` URL — if the user regenerates a portrait, the URL might be the same and the stale CDN URL gets reused.

**Trigger:** `investigate substitution`

### D. ⏳ Backlog (lower priority)
- C6 pacing engine save/load — `pacingPlan`, `pacingAudioUrl`, `pacingVideoUrl` not persisted to DB; lost on page refresh
- Prisma migrations — `npx prisma migrate dev` pending
- Establishing Shot & Scene Opener — spec at `update/LANDSCAPE SHOT/ESTABLISHING_SHOT_SPEC.md`
- SFX semantic category system — 60 categories, royalty-free, Ollama maps action→category
- Subtitle style tokens — currently always Arial; ignores `subtitleConfig.mode`
- character-build endpoint LLM prompt has "DIFFERENT from existing" pressure → can artificially diversify same-ethnicity siblings

---

## ✅ WHAT WAS COMPLETED THIS SESSION (Session 19) — 22 commits

### Ethnicity pipeline END-TO-END (Session 18 carryover + Option B)
- `3c6b658` Age field flows Character tab → scene-image API
- `829ea62` Extraction prompt requires skinTone + age + ethnicity
- `1774db4` Auto-AI-Read anti-override (story ethnicity beats portrait-read AI)
- `b65cce5` Face-lock UI diagnostic (visible PuLID status per scene)
- `64df85d` Extraction response now includes visualDescription + skinTone + colorDescription + ageRange (the BIG fix — server saved but never sent back to client)
- `863b493` Walk full expandedStory object for ethnicity inference (works regardless of which field names story-expand uses)
- `2a5701e` **Option B**: story-wide dominant ethnicity override — if LLM gave a character "fair skin" but story dominant is Black/Latina/etc., override unless explicit "white X" near character name
- `8f5e3f0` Scene Board ↔ Character tab linking — match by displayName too, not just characterId

### PuLID face-lock + clothing
- `2f6647e` (S18) Auto-upload local portraits to FAL CDN for PuLID
- `83a965d` (S18) Remove `!modelId` bypass — PuLID activates whenever portrait exists
- `d53a2f3` Lower PuLID `id_weight: 1.0 → 0.75`, `start_step: 4 → 6` — let scene prompts override portrait state
- `bf4f88a` Scene-image: block shirtless defaults via negative + force "fully clothed" cue when wardrobe empty
- `08255ba` Portrait gen: stop shirtless defaults at SOURCE (PuLID locks portrait state, so portraits themselves must be clothed)

### Children Planner
- `73f66b5` Three children fixes:
  - Story-expand reads `childContext` → per-age strict vocabulary rules (toddler/preschool/early/older with sentence-length caps)
  - Music providerKey "karaoke" was invalid → mapped to "stable_audio"
  - Karaoke narration audioUrl=null handled gracefully instead of throwing
- `fbd964a` Parse duration + poem cues from prompt text (was ignored)
- `d4ba8a3` Story Length picker UI + `tier: "pro"` to match Hybrid (was using fast cheap model)

### Subtitle + assembly
- `221c608` (S18) Windows fontfile colon escape — drawtext was silently failing on `fontfile='C:/Windows/Fonts/arial.ttf'`. Now `fontfile='C\:/Windows/Fonts/...'`
- `daae5db` Intro/outro preview shows `<img>` for PNG cards, not broken `<video>`

### Scene prompt cleanup
- `96db101` Scene-prompt-builder cast description skips empty/contaminated fields — was rendering "skin, , wearing serene, peaceful atmosphere..." because mood text leaked into clothing field

### Diagnostics + tooling
- `5f0abe0` Ollama timeout 15s → 90s (14B-class models need it)
- `87af189` Playwright test proves UI mapping works (validates server→client→render chain)

### Plans saved (not yet implemented)
- `6ba628e` Plan: Movie + Children scene editor port
- `f39328a` Plan: scene composition fix (PuLID over-locking)

---

## ENTIRE ETHNICITY DATA PIPELINE (after Session 19)

```
story text typed by user
        ↓
story-expand → characterList (may be missing skinTone)
        ↓
character-extract
  - If characterList present: mapCharacterIdentity (LLM skipped)
  - Else: LLM extraction with strict skinTone+ethnicity required
        ↓
Inference fallback chain:
  1. LLM-extracted skinTone
  2. inferSkinToneFromText(visualDescription + personality + ethnicity + country)
  3. inferSkinToneFromText(walk entire expandedStory recursively)
        ↓
OPTION B OVERRIDE:
  if (dominantStoryEthnicity is non-light)
   AND (character's skinTone is generic-light "fair/pale/light tan/Caucasian")
   AND (NO explicit "white/Caucasian" within 100 chars of character's first name in story)
  then override skinTone with dominant
        ↓
visualDescription enrichment:
  enrichedVisualDescription = skinTone + ", " + visualDescription
        ↓
Server saves to DB:
  characterVoice.visualDescription = enrichedVisualDescription
        ↓
Server returns to client (FULL data — not just stub):
  { characterId, name, role, gender, age, voiceId, dbId,
    visualDescription, skinTone, ageRange, colorDescription }
        ↓
Client maps into characters[] state:
  c.colorDescription = response.colorDescription || response.skinTone
  c.distinctiveFeatures = response.visualDescription
  c.species = "human"
        ↓
Portrait generation (generateCharacterPortrait):
  - clothingFloor cue when no clothing mentioned → "fully clothed..."
  - shirtless/topless/bare-chest in negativePrompt
  - skin/ethnicity from c.colorDescription / c.skinTone
        ↓
auto-AI-Read after portrait gen (analyzeCharacterImage):
  Anti-override: c.colorDescription kept if filled; AI's "fair skin" can't override
  ethnicityConflict detection: story dark vs AI light → story wins
  ageAppearance protection: c.ageRange set → AI's "appears 10yo" blocked
        ↓
Scene image generation (makeSceneImage):
  Filter characters by characterId OR displayName (8f5e3f0)
  Send characterOverrides with age, species, skinTone via colorDescription
        ↓
scene-image/route.ts:
  - resolvePublicPortraitUrl: local /api/media/ → FAL CDN public URL (cached)
  - useIdentityLock = portrait exists
  - face_image_url forwarded to FAL FLUX PuLID
  - id_weight=0.75, start_step=6
  - bear/clothing/phone/era/nudity negatives applied
        ↓
PuLID face-locks scene to portrait
```

---

## KEY PROTECTED CODE (DO NOT REMOVE)

1. `extractSceneAction()` in `app/api/hybrid/scene-image/route.ts` line ~192 — PROTECTED comment
2. `sanitizeNarrativeJargon()` in `app/api/hybrid/scene-image/route.ts` — strips screenplay terms
3. `amix=duration=longest:normalize=0` in `app/api/assembly/execute/route.ts` — NEVER duration=first
4. `-stream_loop -1` on video in final_merge
5. `effectiveNarrDurMs` recovery in `assembleScenes()`
6. `resolvePublicPortraitUrl()` in `src/lib/generation/selectors/image-provider.ts` — FAL CDN upload + cache
7. `analyzeCharacterImage` merge anti-override block in `app/dashboard/hybrid-planner/page.tsx`
8. Option B override block in `app/api/hybrid/character-extract/route.ts`
9. Windows fontfile colon escape in `app/api/assembly/execute/route.ts` subtitle block

---

## DEBUG RECIPES

### Faces still wrong color/age after server restart
1. Hard refresh browser (Ctrl+Shift+R) — bundles may be cached
2. If still wrong, delete `.next` folder, restart, hard refresh
3. Open DevTools → Network → trigger Expand AI → inspect `character-extract` response
4. Check `characters[0].skinTone` and `colorDescription` — server-side is verified working

### Subtitle didn't burn in
Red banner shows reason after assembly. If no banner: `subtitleStatus.requested` was false → toggle subtitle in Assembly tab.

### PuLID face-lock didn't apply
Console line: `[scene-image] sceneId=X chars=N ages=[...] portraits=N faceLock=true firstPortrait=https://fal.media/...`
- `faceLock=false` → no portrait provided
- `firstPortrait=/api/media/...` (not fal.media) → upload to FAL CDN failed

### Bear head / animal head reappeared
Check `characterOverrides[].species` in scene-image API request (DevTools Network). Should be "human" unless explicit animal character.

### Scene shows character reference sheet pose instead of real scene
This is the OPEN bug. See `update/PLANS/scene_composition_fix_21052026.md`. Trigger: `go F1 F2 F3`.

---

## TEST UTILITIES (tests/ folder)

```bash
# Verify extraction returns ethnicity correctly
node tests/test-extraction-api.mjs

# Verify walk-fallback infers ethnicity even when characterList is empty
node tests/verify-walk-fix.mjs

# Verify Option B story-wide override
node tests/test-option-b.mjs

# List/patch broken characters in character-voices DB
node tests/fix-broken-characters.mjs              # dry run
node tests/fix-broken-characters.mjs --fix        # apply

# Find/patch broken characters in saved-state project JSON
node tests/fix-project-characters.mjs             # dry run
node tests/fix-project-characters.mjs --apply     # apply

# Playwright UI mapping test (~20s, no Ollama)
npx playwright test tests/verify-ui-mapping.spec.ts --project=chromium

# Full E2E (slow — uses Ollama, 2-3 min)
npx playwright test tests/full-ui-ethnicity-test.spec.ts --project=chromium
```

---

## KNOWN LIMITATIONS

### Existing broken project state cannot be auto-fixed
Projects extracted before Session 18 fixes (e.g., "Twins Guns Hybrid Project" with Marcus Cole / Dante Cole) have white-skin descriptions baked into `hybrid_saved_states.data.characters[]`. Code can only protect NEW extractions.

Three options:
- Delete broken characters in Character tab → re-extract
- Manually edit each (Define Appearance)
- Start fresh project

### Outro mid-video bug (still unresolved)
User reported outro appearing in middle of assembled video. Code at line ~4097 puts intro→scenes→outro in correct order. Needs user info: was outro duplicated (twice) or just mid-order?

### character-build LLM prompt has "DIFFERENT from existing" pressure
Can cause LLM to artificially diversify ethnicity (Alex=Black, Ben=light) when story says both are Black. Mitigated by Option B for character-extract, but `character-build` is a separate path and not yet patched.

---

## GHS BRANDING RULE
User sees: **GHS Standard / GHS Plus / GHS Pro / GHS Classic / GHS Premium / GHS Best**
NEVER show: Claude, GPT, Ollama, Grok — internal only

## PORT
GHS = **3200** | Marabiz = 3040 | Octogent ghs = 8788

## DB
`giohomestudio_db` (PostgreSQL) — Prisma ORM — migrations pending

## REPO
`https://github.com/htonymac/giohomestudio.git` — branch `main`, HEAD `f39328a`

## ACTIVE PLANS (read before starting any related work)
1. `update/PLANS/scene_composition_fix_21052026.md` — PuLID over-locking fix
2. `update/PLANS/hybrid_style_story_chid_movie21052026.md` — Movie+Children scene editor port

## SESSION TRIGGERS WAITING ON GO
- `go F1 F2 F3` — cheap pass on scene composition (id_weight + prompt reorder + anti-portrait)
- `go F4` — drop PuLID for multi-character scenes
- `go all F1-F5` — full scene composition fix sequence
- `go phase A` — Movie planner scene editor toolbar
- `go phase B` — Children planner scene editor toolbar (child-safe variant)
- `go all` (planner toolbar) — both planners + verification
- `investigate substitution` — Phase D substitution-doesn't-switch bug
