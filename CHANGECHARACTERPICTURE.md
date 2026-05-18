# Character Portrait — 3 Shots / 3 Angles Update

**Date:** 2026-05-18
**Files changed:**
- `app/dashboard/hybrid-planner/page.tsx` — `generateCharacterPortrait`, `persistPortraitToRegistry`, gallery UI
- `app/dashboard/children-planner/page.tsx` — `generateCharacterPortrait`, `persistPortraitToRegistry`, gallery UI
- `app/dashboard/movie-planner/page.tsx` — inline portrait generation replaced, gallery UI
- `app/api/character-voices/[id]/generate-portrait/route.ts` — standalone API route (3 shots)
- `app/dashboard/character-voices/page.tsx` — standalone Character Registry page (separate surface)

---

## What Changed

### Before
- "Generate Portrait" produced **1 image** (front-facing portrait only)
- Stored in `characterVoice.imageUrl` — one field, one image
- No angle variation, no choice for the user
- Characters created in planners were NOT auto-saved to the Character Registry

### After
- **"Generate Portrait (3 shots)"** generates **3 FULL BODY images in parallel** — 3 different angles
- All 3 stored in `charRefImages` state per character, and in `characterVoice.referenceImages` DB array
- First shot (front) saved as the main `characterVoice.imageUrl`
- **Characters created in any planner are automatically upserted to the Character Registry**
  - If character has no `dbId` → creates a new CharacterVoice record first
  - If character already exists (409) → uses existing ID
  - Always PATCHes with `{ imageUrl, referenceImages }`

---

## The 3 Shots (ALL PLANNERS)

| Shot | Angle | Label | Framing Directive |
|------|-------|-------|-------------------|
| 1 | Front | `main` | FULL BODY front view, standing neutral pose, facing camera, visible from head to toe including feet |
| 2 | Three-quarter | `variation_1` | FULL BODY three-quarter angle view, slight left turn, standing pose, entire body visible from head to feet |
| 3 | Side profile | `variation_2` | FULL BODY side profile view, 90-degree turn, standing pose, full height visible from head to feet |

Image dimensions: **768 × 1024** (portrait ratio, full body)

---

## DB Storage

```
CharacterVoice.imageUrl          = Shot 1 URL (main portrait)
CharacterVoice.referenceImages   = [
  { url: "...", angle: "front",         label: "main" },
  { url: "...", angle: "three-quarter", label: "variation_1" },
  { url: "...", angle: "side",          label: "variation_2" },
  // photo-import entries preserved if user uploaded a reference photo
]
```

---

## Where This Lives

**Action is in the PLANNERS, not the standalone Character page.**

| Surface | Location |
|---------|----------|
| Hybrid Planner | Characters tab → per-character "Generate Portrait (3 shots)" button |
| Children Planner | Characters tab → per-character "Generate Portrait (3 shots)" button |
| Movie Planner | Cast tab → per-character "Generate Portrait (3 shots)" button |
| Character Registry (`/dashboard/character-voices`) | Separate standalone page — has its own generate-portrait route but uses portrait (not full-body) framings |

---

## UI Changes (All Planners)

- Button reads: **"Generate Portrait (3 shots)"** / **"Regenerate (3 shots)"**
- While generating: **"Generating 3 shots..."**
- After generation, a gallery row shows all 3 shots (56×80px thumbnails)
- Labels: Front / 3/4 View / Side (or MAIN if that shot is the active one)
- **Click any shot to set it as the main portrait** — lilac/purple border highlights the selected main
- Scene board uses `character.imageUrl` → whichever shot is selected as main feeds scene generation

---

## Scene Board Impact

- Scene image generation (`/api/hybrid/scene-image`) uses `character.imageUrl` for face-lock (PuLID)
- User picks the best-angled shot as main → scene board uses that shot as the character reference
- Applies to: **hybrid planner, movie planner, children planner** (all use the same scene-image route)

---

## Why Full Body (Not Portrait)

Full body shots are required because:
1. Scene images need to show characters in action, walking, standing, interacting — not just faces
2. Three angles give the image model a complete spatial reference for the character
3. The scene board can match body proportions, clothing, and full silhouette — not just facial identity
