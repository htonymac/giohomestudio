# Establishing Shot & Scene Opener System — Full Spec
**GioHomeStudio | Hybrid Planner | Children Story Hybrid**
**Status:** PLANNED — Do not build until Henry triggers
**Date:** 2026-05-15

---

## 1. What This Is

A planning supervisor layer that runs AFTER story expansion and BEFORE image/video generation.

It reads every scene, decides if the viewer needs a cinematic wide shot before the main action begins, generates the establishing shot prompt, and inserts it as the first shot in that scene's shot sequence.

The main scene is NEVER replaced. The establishing shot is a separate clip that plays BEFORE it.

**Result in final video:**
```
[Establishing Shot clip — 4–8s] → [Main Scene clip — 6–10s] → [Establishing Shot] → [Main Scene] → ...
```

---

## 2. Core Establishing Shot Types

| Type ID | Name | When Used |
|---|---|---|
| `opening` | Opening Establishing Shot | First scene of any story/movie. Always. |
| `location` | Location Establishing Shot | Location changes from previous scene. |
| `transition` | Transition Establishing Shot | Moving between acts, times, or emotional chapters. |
| `mood` | Mood Establishing Shot | Mood changes strongly — from calm to tense, joy to grief, etc. |
| `pre_action` | Pre-Action Establishing Shot | Before war, fight, chase, danger, rescue, big event. |
| `exterior_building` | Exterior Building Shot | Character enters important building — palace, school, hospital, home, shop, office. |
| `aerial` | Aerial Establishing Shot | City, village, kingdom, battlefield, island, estate, large crowd. Wide scale needed. |
| `beauty` | Beauty Shot | Luxury, real estate, hotel, paradise, magical landscape, grand reveal. |

---

## 3. Decision Rules

### Add establishing shot WHEN:

1. Story or movie begins (always — `opening` type)
2. Location changes from previous scene
3. Time of day changes (morning → night, day → dusk)
4. Mood shifts strongly (calm → danger, sadness → celebration)
5. War, fight, danger, chase, romance, tragedy, celebration, or major emotional event is about to happen
6. Character enters important building, palace, office, hospital, school, shop, house, battlefield, village, city, or secret location
7. Scene needs cinematic breathing space before action or dialogue
8. Story mode is: cinematic / movie / epic / children story / real estate / commercial / cultural / documentary
9. Story needs geographic or visual context the viewer doesn't have yet

### Do NOT add when:

1. Scene continues in same room/location as previous scene
2. Fast action is already happening and a wide shot would slow it down
3. Very short ad with strict timing
4. Viewer already understands the location (same location used 2+ consecutive scenes)
5. Adding it would make video unnecessarily long
6. Scene is interior monologue or close emotional dialogue with no location shift

### Repeat guard:
- Never use the same establishing shot type for the same location twice in a row.
- If location repeats after a long gap (3+ scenes), it is allowed again.

---

## 4. Mode Levels (User Controlled)

| Mode | Behavior |
|---|---|
| **Off** | No establishing shots inserted anywhere. |
| **Minimal** | Only when location or time of day changes. Opening shot always added. |
| **Auto** | System decides using full ruleset above. Default. |
| **Cinematic** | Aggressive — adds mood shots, pre-action shots, beauty shots. More shots overall. |
| **Epic** | Every major scene gets a long dramatic opener. Longest durations. |

---

## 5. Duration Rules

| Context | Duration |
|---|---|
| Fast transition between scenes | 2–3 seconds |
| Normal establishing shot | 4–6 seconds |
| Cinematic scene opener | 6–8 seconds |
| Epic movie intro | 10–15 seconds |
| Commercial/ad shot | 2–4 seconds |
| **Children story (default)** | **3–4 seconds** |
| Default fallback | 5 seconds |

Mode overrides duration:
- Minimal → always use fast/normal range (2–5s)
- Cinematic → normal/cinematic range (5–8s)
- Epic → cinematic/epic range (8–15s)

---

## 6. Prompt Template

```
"[Tone] [shot type] establishing shot of [location], during [time of day], with [mood], 
showing [important visual details], camera [movement], designed to introduce [next scene purpose]."
```

### Camera movement vocabulary:
- `slow push forward` — drifts gently toward subject (drone closing in)
- `slow pan left` / `slow pan right` — sweeps across landscape
- `gentle tilt up` — reveals tall building or sky
- `gentle tilt down` — reveals ground, entrance, or crowd
- `static wide` — locked frame, no movement (most stable)
- `slow crane up` — rises to reveal scale
- `drift right` — soft floating movement

---

## 7. Prompt Examples by Type

### Opening — Children Story
```
"Warm wide establishing shot of a colorful African village at sunrise, 
small clay houses painted in bright blues and yellows, 
mango trees lining a dusty path, children's laughter faintly heard, 
gentle camera drift right, soft golden morning light, 
designed to open a children's adventure story."
```

### Location — Enter School
```
"Peaceful wide exterior shot of a cheerful Nigerian primary school in the morning, 
students in uniform walking through the gates, 
teachers standing at the entrance, a large tree in the yard, 
slow push forward camera movement, warm and safe atmosphere, 
designed to introduce a school scene in a children's story."
```

### Aerial — City / Kingdom
```
"Cinematic aerial establishing shot of Lagos city at sunset, 
busy expressways, tall glowing buildings, warm orange horizon, 
slow drone movement forward, realistic and atmospheric, 
designed to introduce a modern city scene."
```

### Pre-Action — Before a Chase
```
"Wide establishing shot of a winding forest path at dusk, 
thick trees casting long shadows, a dirt trail disappearing into darkness, 
wind moving through the leaves, camera slow pan left, 
tense uncertain atmosphere, designed to introduce a chase scene."
```

### Exterior Building — Palace
```
"Grand cinematic establishing shot of an ancient African palace on a hill, 
guards standing at the gate, golden sunrise behind the building, 
slow camera push forward, majestic and powerful atmosphere, 
designed to introduce a royal court scene."
```

### Beauty Shot — Magical Landscape
```
"Magical wide establishing shot of a glowing enchanted forest, 
fireflies drifting between ancient trees, soft purple light filtering through leaves, 
a narrow crystal stream running through the center, static wide frame, 
wonder and mystery atmosphere, designed to introduce a magical discovery scene."
```

### Transition — Night Scene After Day
```
"Wide establishing shot of a quiet Nigerian town at night, 
soft lamplight in windows, a dog crossing an empty street, 
stars visible above the rooftops, static wide frame with gentle moonlight, 
peaceful transition atmosphere, designed to move from evening to a late-night scene."
```

---

## 8. Children Story — Special Rules

Children's content gets a modified ruleset because pacing, safety, and color are different.

### Auto mode for children = adjusted defaults:
- Duration cap: max 4 seconds per establishing shot
- No dark/threatening establishing types unless story calls for mild tension
- Allowed types: `opening`, `location`, `exterior_building`, `transition`, `beauty`, `mood` (soft)
- Restricted types (only if story tone allows): `pre_action`, `aerial`
- Forbidden in children mode: gore, war imagery, dark chaos, horror atmosphere

### Children story prompt tone modifiers:
- Replace `cinematic` → `warm` or `magical` or `peaceful`
- Replace `tense` → `curious` or `uncertain` or `adventurous`
- Replace `dramatic` → `exciting` or `wonderful`
- Always add: `child-friendly`, `colorful`, `safe`, `inviting`

### Children story establishing shot triggers — extra rules:
- Every time a child character enters a new world or magical zone → always add `location` or `beauty` shot
- Every time a new friend or creature appears → add `mood` shot (wonder, excitement)
- Every time there is a lesson moment → add `transition` shot (calm, reflective)
- Opening is always warm, wide, bright — never mysterious or threatening

---

## 9. Data Structure

Each scene gets a `shots` array. The establishing shot is always Shot 0 (index 0). The main scene is always Shot 1+.

```typescript
interface EstablishingShot {
  shotRole: "establishing_shot";
  establishingType: "opening" | "location" | "transition" | "mood" | "pre_action" | "exterior_building" | "aerial" | "beauty";
  prompt: string;
  durationSeconds: number;
  cameraMovement: string;
  mood: string;
  purpose: string;
  timeOfDay: string;
  location: string;
  tone: string;
}

interface MainShot {
  shotRole: "main_scene";
  prompt: string;
  durationSeconds: number;
}

interface SceneWithShots {
  sceneId: string;
  title: string;
  description: string;
  location: string;
  timeOfDay: string;
  mood: string;
  shots: Array<EstablishingShot | MainShot>;
  establishingInserted: boolean;
  establishingType?: string;
}
```

---

## 10. Full Flow (Hybrid Planner Integration)

```
[1] User writes story idea
        ↓
[2] AI expands story into scenes (existing expand op)
        ↓
[3] *** ESTABLISHING SHOT SUPERVISOR RUNS ***
    - Reads all scenes in order
    - Compares each scene with previous scene
    - Applies add/don't-add rules
    - Determines establishing type for each scene that needs one
    - Generates establishing shot prompt using template
    - Sets duration based on mode
    - Inserts establishing shot as shots[0] in scene
    - Marks scene: establishingInserted: true/false
        ↓
[4] Scene Board shows shot breakdown per scene
    - Scene card expands to show:
      [Establishing Shot — aerial — 5s] + [Main Scene — 8s]
    - User can delete or regenerate establishing shot per scene
        ↓
[5] Image Generation — runs per shot (not per scene)
    - Shot 0 (establishing): FLUX generates wide/landscape image
    - Shot 1 (main): FLUX generates scene image as normal
        ↓
[6] Video Generation — Wan animates each shot image
    - Establishing shot: slow drift/push camera movement
    - Main scene: normal scene animation
        ↓
[7] Assembly — clips concatenated in order
    [Establishing clip] → [Main Scene clip] → [Establishing clip] → [Main Scene clip] → ...
```

---

## 11. API Design (Future Route)

**Route:** `POST /api/hybrid/establishing-shot-plan`

**Input:**
```json
{
  "scenes": [...],
  "storyText": "...",
  "mode": "auto" | "minimal" | "cinematic" | "epic" | "off",
  "storyType": "children" | "movie" | "commercial" | "documentary" | "cultural",
  "provider": "auto"
}
```

**Output:**
```json
{
  "ok": true,
  "scenes": [
    {
      "sceneId": "S01",
      "title": "...",
      "shots": [
        {
          "shotRole": "establishing_shot",
          "establishingType": "opening",
          "prompt": "Warm wide establishing shot of...",
          "durationSeconds": 4,
          "cameraMovement": "slow drift right",
          "mood": "warm and inviting",
          "purpose": "introduce the village world to the viewer",
          "location": "Nigerian village",
          "timeOfDay": "sunrise"
        },
        {
          "shotRole": "main_scene",
          "prompt": "...",
          "durationSeconds": 8
        }
      ],
      "establishingInserted": true,
      "establishingType": "opening"
    }
  ]
}
```

---

## 12. UI Controls in Hybrid Planner

### Scene Board Tab — Establishing Shot Mode Selector
```
Establishing Shots: [Off] [Minimal] [Auto ✓] [Cinematic] [Epic]
```
- Persisted to localStorage per project
- Default: Auto

### Per-Scene Shot Card (when establishing inserted)
```
┌─────────────────────────────────────────────┐
│ Scene 1: The Village Morning                │
│                                             │
│ 📷 Shot 1 — Opening Establishing Shot [5s] │
│   aerial · sunrise · warm and inviting     │
│   [Preview Prompt] [Regenerate] [Remove]   │
│                                             │
│ 🎬 Shot 2 — Main Scene [8s]               │
│   Amara runs across the village square...  │
└─────────────────────────────────────────────┘
```

### Controls per establishing shot:
- **Preview Prompt** — shows the full generated prompt in a modal
- **Regenerate** — re-runs the supervisor for just this scene
- **Remove** — deletes the establishing shot, main scene remains
- **Duration override** — slider or input to adjust seconds

---

## 13. Applies To These GHS Modes

| Mode | Establishing Shot Support | Default Mode |
|---|---|---|
| Hybrid Movie | ✅ Full | Cinematic |
| Children Story Hybrid | ✅ Full (children rules) | Auto |
| Movie Creator | ✅ Full | Cinematic |
| Children Story Video | ✅ Full (children rules) | Auto |
| Commercial / Ad Builder | ✅ Limited (no epic) | Minimal |
| Real Estate / Apartment Ads | ✅ Beauty shots only | Auto |
| Documentary Style | ✅ Full | Cinematic |
| Cultural Story Mode | ✅ Full | Auto |

---

## 14. What Establishing Shots Must Never Be

- Filler. Every shot must have a clear reason: show location / show mood / show danger / show scale / show beauty / show time change / prepare viewer before main action.
- A replacement for the main scene.
- Repeated for the same location with no new information.
- Longer than necessary for the story mode.
- In children mode: dark, threatening, war-like, chaotic, or frightening.

---

## 15. Expected Final Output in Scene Planner

```
Scene 1: The Village Wakes Up
  → Shot 1: Opening Establishing Shot [5s] — aerial, sunrise, warm
  → Shot 2: Main Scene [8s] — Amara wakes up, stretches, looks out window

Scene 2: The Market
  → Shot 1: Location Establishing Shot [4s] — exterior wide, busy market, midday
  → Shot 2: Main Scene [7s] — Amara and her mother walk through the market stalls

Scene 3: The Forest Path (continuing from market — same location type, no establishing needed)
  → Shot 1: Main Scene [8s] — they take a shortcut through the edge of the forest

Scene 4: The Old Tree (new magical location)
  → Shot 1: Beauty Shot [5s] — wide magical forest clearing, ancient glowing tree, fireflies
  → Shot 2: Main Scene [9s] — Amara sees the spirit of the tree for the first time

Scene 5: Home at Night (location change + time change)
  → Shot 1: Transition Establishing Shot [4s] — exterior of small home, night, warm lamp glow
  → Shot 2: Main Scene [7s] — family gathers around evening fire
```

---

## 16. Build Trigger

**DO NOT BUILD until Henry says: "build establishing shot" or "build landscape shot system".**

This doc is the complete implementation reference. When triggered:
1. Build `/api/hybrid/establishing-shot-plan/route.ts` from section 11
2. Integrate supervisor call into Hybrid Planner after scene expansion (section 10, step 3)
3. Update scene card UI to show shot breakdown (section 12)
4. Add mode selector to Scene Board tab (section 12)
5. Update image/video generation to loop over `shots[]` not just scenes

---

*Spec locked 2026-05-15. Source: Henry's `LANDSCAPTE SHOT.txt` + planning session.*
