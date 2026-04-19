# GHS MASTER TASK — April 17 2026
# Planned by: AUT Claude
# Build by: GHS Claude
# Source: Henry's direct instructions
# DO NOT skip any item. Work through in order.

---

## RULE BEFORE STARTING

AUT is watching. Every completed item must be:
1. Tested in browser
2. Logged to PROBLEM_AND_FIX.md if any bug found
3. Marked done in this file

---

## TASK 1 — Hybrid Workflow Formula Applied to ALL Planners

Henry said: "I want hybrid workflow formula used in other sections. I did not say copy hybrid. I said formula."

**Formula = the sequence, not the code.**

The Hybrid sequence is:
```
Story Input → AI Expand → Characters → Scenes → Audio Plan → Assembly → Review → Export
```

Every planner must follow this sequence adapted to its own unique purpose:

| Planner | Their unique sequence |
|---|---|
| Movie Planner | Story → Characters/Cast → Scene Breakdown → Shot Plan → Audio → Assembly → Review |
| Children Planner | Story → Characters → Read-Along Scenes → Narration Timing → Highlight Sync → Assembly |
| Music Video | Song Upload → Song Analysis → Visual Mode → Scene/Beat Map → Generation → Assembly |
| Commercial | Brief → Brand Assets → Script/Scenes → Voiceover → Slides → Assembly → Publish |
| Story Bank | Idea → DNA → World → Characters → Chapters → Scenes → Send to Planner |

**Do NOT change existing working pipelines.**
**Add missing steps where the sequence has gaps.**

Check each planner:
- [ ] Movie Planner — confirm sequence has all steps, add missing ones
- [ ] Children Planner — confirm sequence has all steps, add missing ones
- [ ] Music Video Planner — confirm sequence has all steps, add missing ones
- [ ] Commercial Planner — confirm sequence has all steps (already 85% complete)

---

## TASK 2 — Story Mode AI Tier Selector (ALL planners + Story Bank)

Henry said: "In story mode user must decide which AI to use by grade. Standard, local LLM free, Pro. User only pays for Sonnet and Opus. Do not use AI real names. Use GHS Standard, GHS Free, GHS Pro. Only when user clicks More Information will it say what they are."

**GHS AI Tier System:**

| GHS Label | Real model behind it | Cost to user |
|---|---|---|
| GHS Free | Ollama phi3 / mistral (local) | Free |
| GHS Standard | Claude Haiku / GPT-4o-mini | Low |
| GHS Pro | Claude Sonnet / Claude Opus | Premium |

**UI Rule:**
- Show only: GHS Free / GHS Standard / GHS Pro
- Never show: Claude, GPT, Haiku, Sonnet, Opus, Ollama
- "More Info" button → popup says: "Free uses local AI (no cost). Standard uses lightweight cloud AI. Pro uses our most powerful reasoning engine."
- Default: GHS Standard

**Where to add this selector:**
- Story Bank brainstorm + expansion
- Hybrid Planner story expansion
- Movie Planner story analysis
- Children Planner story generation
- Music Video concept generation
- Any screen where AI generates text/plans

**Implementation:**
- One shared `AITierSelector` component
- Stores selection in localStorage per user
- API routes read `tier` param and route to correct model
- Routing: Free → Ollama → Standard → Haiku → Pro → Sonnet

---

## TASK 3 — Series Planner: Fix Errors + UI

Henry said: "There are some errors in series planner. Check UI. Make it less — user can see only Create, Planner Tools, and More."

**3A — Fix series planner errors:**
- [ ] Open series planner, identify all errors (runtime + UI)
- [ ] Fix each error, log to PROBLEM_AND_FIX.md

**3B — Simplify navigation/sidebar UI:**

Current problem: too many items visible at once.

New rule for sidebar/nav:
```
User sees only:
  + Create
  ≡ Planner Tools  (hover/click → shows: Hybrid / Movie / Children / Commercial / Music Video / Story Bank)
  ··· More          (hover/click → shows: Collab Editor, Series Planner, Asset Library, Analytics, Settings)
```

Planners only appear when user hovers or clicks "Planner Tools".
Other tools appear when user hovers or clicks "More".
This applies to the main sidebar/nav globally — not just series planner.

---

## TASK 4 — Add Gemini 3.1 Flash TTS (fal.ai)

New TTS provider just launched on fal.ai.

**Endpoint:** `fal-ai/gemini-flash-tts` (or check fal.ai for exact endpoint)
**Features:** Natural speech, inline audio tags for performance direction, 70+ languages, native multi-speaker dialogue
**Use existing FAL_KEY — no new account needed**

**Where to add:**
- Voice/TTS selection in ALL planners (alongside Piper TTS)
- Character Voices section (for multi-speaker dialogue — Bear voice + Dog voice in one call)
- Story Bank narration
- Children Planner read-along narration

**GHS Branding:**
- Show as "GHS Voice Pro" or "GHS Multi-Speaker" — not "Gemini TTS"
- Piper = "GHS Voice Free" (local, no cost)
- Gemini TTS = "GHS Voice Pro" (cloud, small cost)

**Multi-speaker feature:**
This is important — Gemini Flash TTS can handle multiple speakers in one API call.
Bear speaks in one voice, Dog speaks in another, all in a single request.
This solves the character dialogue problem cleanly.
Wire this into character voice generation as an option.

---

## TASK 5 — Add Kie.ai as Music Provider

Henry provided: `KIE_AI_API=419fde99ae5b0d7d132200fd6c01fb07`

**Add to .env:**
```
KIE_AI_API=419fde99ae5b0d7d132200fd6c01fb07
```

**Add Kie.ai to Music Provider Layer:**
- Create `src/lib/music-providers/kie.ts`
- Expose: `generateMusic(prompt, duration, style)` → returns audio URL
- Add to music provider router alongside existing providers
- GHS branding: show as "GHS Music" — not "Kie.ai"
- Fallback: if Kie.ai fails → use stock library

**Where it appears:**
- Music section in all planners
- Music Video Planner (primary music source)
- Story Bank scene music mood → triggers music generation

**Research needed:**
Check Kie.ai docs for:
- API endpoint format
- Supported parameters (prompt, duration, genre, mood, BPM)
- Output format (MP3/WAV)
- Rate limits

---

## TASK 6 — Ideogram V3 Transparent + Layerize Text

Read the full spec: `C:\Users\USER\Downloads\IDEOGRAM_V3_TRANSPARENT_LAYERIZE (1).md`

This is fully documented. Follow it exactly.

**Session 1 — Transparent Background:**
- [ ] Add `fal_ideogram_v3_transparent` to MODEL_REGISTRY
- [ ] Add `generateTransparent()` to fal gateway
- [ ] Add transparent checkbox to generation modal (Ideogram V3 only)
- [ ] Tag transparent assets: `transparent: true`
- [ ] Add "Transparent PNGs" filter to Asset Library
- [ ] Add transparent badge in Video Tools overlay picker
- [ ] Add to Commercial Maker Step 2

**Session 2 — Layerize Text:**
- [ ] Create `layerized_designs` table in DB
- [ ] Add `layerizeText()` to fal gateway
- [ ] Add "Edit Text Layers" button in Commercial Maker
- [ ] Add "Edit Text Layers" to Asset Library context menu
- [ ] Build inline Text Editor Panel (NOT a new page)
- [ ] Wire "Preview Changes" (free — no API call)
- [ ] Wire "Save New Version"
- [ ] Connect to Review Queue

**Both features use existing FAL_KEY. No new account.**

---

## TASK 7 — Fix Story Button Color

Henry said: "The button for story — change to green or other better colour, that colour is off."

- [ ] Find the story/story-bank create/action button
- [ ] Change to green (#22c55e) or a strong accent colour that fits the dark theme
- [ ] Check contrast — must be readable on dark background
- [ ] Apply UI/UX judgment — if green clashes, use the platform accent color

---

## TASK 8 — Add AI Background Section to Commercial + Image Editor

Henry said: "Add this to image editor to create new section in background with AI — user will see time of background or user can import their own background or can choose white background — make image visible"

**New section: AI Background Studio**

Available in:
- Commercial Planner image step
- Image Editor (collaborative editor or wherever images are edited)

**Three background options:**
1. **AI Generate Background** — user describes background, AI generates it
2. **Import Your Background** — user uploads their own image
3. **White/Solid Color** — user picks solid color (white, black, custom)

**With Transparent PNG integration:**
When user has a transparent PNG (from Task 6):
- They place their transparent subject over any of the 3 background options
- System composites them together
- Result: professional product shot, character card, or thumbnail

**UI:**
- Clean panel below the image canvas
- Three tabs: Generate / Import / Solid
- Generate tab: prompt input + "Generate Background" button
- Import tab: drag-and-drop upload
- Solid tab: color picker
- "Apply Background" button composites final image
- Nice, clean UI — not cluttered

---

## TASK 9 — Story Bank: Full Build

Read: `update/STORY_BANK_MASTER_CANVAS.md` (full 8-layer spec)

Build in this order:
1. DB models (StoryBank, StoryChapter, StoryScene, StoryCharacterArc) → migrate
2. API routes (CRUD + expand + brainstorm + chapters + scenes + send-to-planner)
3. Story list homepage upgrade
4. Story workspace with all 9 tabs
5. AI Brainstorm (Ollama first, Haiku fallback)
6. Send to Planner pipeline (all 4 planners)
7. Draft flow across all sections
8. Quick capture endpoint (for AUT/Telegram)

---

## TASK 10 — Music + Music Video Provider Research

Henry asked for provider recommendations. AUT Claude will handle this research and report back separately. GHS Claude does NOT need to do this research — wait for AUT Claude's report before implementing new music video providers.

---

## GHS BRANDING RULES (apply everywhere)

From `update/BRANDING/ghs_master_branding_provider_caching_policy.md`:

- Never show: Claude, GPT, Gemini, Grok, Haiku, Sonnet, Opus, Ollama
- Show instead: GHS Free / GHS Standard / GHS Pro
- AI roles shown as: AI Story Director / AI Visual Director / AI Music Planner (etc.)
- Only when user clicks "More Info" → reveal underlying model names
- GioHomeStudio is the brand. AI is invisible infrastructure.

---

## AUT MONITORING RULES

AUT Claude is watching. After each task:
1. Test in browser — real test, not just "looks right"
2. Log any bug to PROBLEM_AND_FIX.md immediately
3. Update this file — mark item done
4. Report to Henry via Telegram when a full task is complete

AUT will verify by checking browser and server logs.
Do NOT report done until tested.
