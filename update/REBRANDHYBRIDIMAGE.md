# GHS — Hybrid Image-First Story Design + Children's Pacing Engine
**Spec version:** 1.0 — 2026-05-16
**Status:** SPEC ONLY — not yet built

---

## OVERVIEW

Two separate problems identified on 2026-05-16:

1. **Hybrid**: Story is written as text, images are generated from it — but the text is not *designed for images*. Actions, emotions, and drama get described in narration instead of being shown visually. Result: boring images, story doesn't feel cinematic.

2. **Children**: Children's planner uses the same assembly pipeline as hybrid. This is wrong. Children's narration requires breathing room, word-level pacing, karaoke subtitles, and a completely different timing model. You cannot fix this inside the hybrid flow.

These are two separate build tasks. Neither can borrow from the other.

---

## PART 1 — HYBRID: IMAGE-FIRST STORY STRUCTURING

### The Problem
Current flow:
```
User types idea → Expand with AI → Scene demarcator → Scene descriptions → Image gen
```

The AI expands into a narrative. But narrative writing and *visual script writing* are different things.

Example narrative (what we have):
> "John ran desperately across the burning field, his heart pounding as he searched for his missing son among the flames and smoke."

This is *told*, not *shown*. The image AI generates a generic "man running in fire" — no emotion, no drama, no storytelling.

Example visual script (what we need):
> VISUAL: John frozen at edge of burning field — eyes wide — smoke pouring past him
> BEAT: His hand trembles — he takes one step forward
> NARRATION: "He didn't know if his son was alive."
> VISUAL: Close on his face — jaw tight — tears mixing with ash
> ACTION: He runs — full sprint — into the fire

Each visual moment generates a *specific, emotionally loaded image*. The images carry the story. Narration supports.

---

### Solution: Pre-Expansion Story Structuring Step

**Where it fits in the flow:**
```
User selects Hybrid mode
→ User writes story idea
→ [NEW] "Structure for Visual Storytelling" — AI rewrites idea into tagged visual script
→ Expand with AI Intelligence (now works on tagged script)
→ Scene demarcator reads tags → produces scenes with visual intent
→ Image gen reads visual intent → produces cinematic images
```

**The new step runs BEFORE "Expand with AI Intelligence"** — it is a separate button or auto-runs when user clicks Expand in Hybrid mode.

---

### Visual Story Tags

The structured output uses these tags in scene descriptions:

| Tag | Meaning | Image behavior |
|-----|---------|----------------|
| `[VISUAL]` | This moment MUST be shown. No narration. Image speaks. | High priority image, max detail prompt, no text overlay |
| `[ACTION]` | Character doing something physical — movement, fight, chase, jump | Image shows motion moment, intense camera angle |
| `[BEAT]` | Emotional pause — reaction, silence, realization | Close-up image, minimal motion, emotional expression |
| `[DIALOGUE]` | Character speaking | Image shows character face/expression, subtitle shows dialogue |
| `[NARRATION]` | Narrator speaks over image | Image shows environment or scene, narration plays over |
| `[TRANSITION]` | Scene change — time skip, location change, fade | Establishing shot or wide scene-setter |
| `[ESTABLISH]` | Scene opener — first image of location | Wide shot, sets environment clearly |

---

### How the Scene Demarcator Uses Tags

When `scene-demarcator.ts` receives tagged text, it splits scenes at tag boundaries:
- Each `[VISUAL]` or `[ACTION]` tag = its own scene (short, 2-3s)
- Each `[BEAT]` = its own scene (short pause, 1.5-2s)
- `[DIALOGUE]` groups with adjacent `[VISUAL]` or `[BEAT]`
- `[NARRATION]` = longer scene (3-5s), narration duration drives image flip time
- `[ESTABLISH]` = triggering point for establishing shot

---

### How Image Prompts Change

Current: scene description → image prompt (generic)

New: scene description + tag → image prompt (specific)

| Tag | Prompt adjustment |
|-----|-----------------|
| `[VISUAL]` | Add: "dramatic focal point, cinematic composition, emotional weight" |
| `[ACTION]` | Add: "motion blur, dynamic camera angle, energy, physical tension" |
| `[BEAT]` | Add: "close-up, stillness, emotional expression, soft focus background" |
| `[DIALOGUE]` | Add: "character facing camera, clear facial expression, natural lighting" |
| `[ESTABLISH]` | Add: "wide establishing shot, full environment visible, depth" |

---

### UI Changes for Hybrid Mode

1. **Story tab — before Expand button:**
   Add a "Structure Story for Images" button (or auto-run in Hybrid mode on Expand).
   This calls a new endpoint: `POST /api/hybrid/structure-story`

2. **Scene cards:** Show the tag badge (VISUAL / ACTION / BEAT / NARRATION) on each scene card so user can see the intent.

3. **Image prompt editor:** Show which tag the prompt is derived from, so user understands why it looks the way it does.

---

### New API Endpoint

```
POST /api/hybrid/structure-story
Body: {
  storyIdea: string,
  storyType: string,
  genre: string,
  tone: string,
  targetDuration: number,  // total video seconds
  country: string
}

Returns: {
  ok: boolean,
  structuredScript: string,  // tagged visual script
  sceneCount: number,
  estimatedDuration: number,
  tagBreakdown: {
    visual: number,
    action: number,
    beat: number,
    dialogue: number,
    narration: number
  }
}
```

Uses Claude Haiku with a cinematic writing system prompt. Rewrites the story idea into a scene-by-scene visual script with tags. Does NOT change the story — only adds visual structure.

---

### Execution Plan (when building)

**Phase H1:** Add `structureStory()` function and API endpoint
**Phase H2:** Modify `scene-demarcator.ts` to read tags → produce scene intent field
**Phase H3:** Modify `scene-prompt-builder.ts` to inject tag-based prompt modifiers
**Phase H4:** Add "Structure for Images" button in Hybrid story tab
**Phase H5:** Add tag badge to scene cards

---

## PART 2 — CHILDREN'S HYBRID: SEPARATE PACING ENGINE

### The Problem

Children's planner currently uses the same assembly pipeline as hybrid. Problems:

- TTS talks at adult speed — children can't follow
- Subtitles try to keep up — karaoke highlighting doesn't exist
- Images display for 3-5s — children need to look at and process them
- Educational mode (spelling, counting, reading) is impossible in the current pipeline
- No breathing room between sentences

### Henry's Example — What It Should Feel Like

> Teacher: "The word is FENCE."
> (pause)
> "Let's spell it: F… (pause) E… (pause) N… (pause) C… (pause) E…"
> (pause)
> "FENCE. Now let's read it in a sentence: JOHN JUMPED THE FENCE."
> (image shows John jumping a fence)

This is not a narration flow problem. This is a **timing architecture problem**.

The TTS script must have SSML pauses injected. The subtitle must highlight letter by letter. The image must stay on screen until the word is done. You cannot retrofit this from the adult hybrid engine.

---

### Two Children's Sub-modes

#### Sub-mode 1: Story Mode (narration with breathing room)
Used for: bedtime stories, adventure tales, moral lessons, fables

Rules:
- TTS rate: 0.75x normal speed
- Pause after each sentence: 0.7s
- Pause after each scene: 1.2s
- Images display for minimum 4s (not 2-3s like hybrid)
- Subtitles: word-highlighted (each word highlights as spoken, not whole sentence at once)
- No jump cuts — smooth dissolve between scenes
- Music stays soft (30% volume) under narration

#### Sub-mode 2: Learning Mode (spelling / reading / counting)
Used for: alphabet, words, numbers, sight words, phonics

Rules:
- TTS rate: 0.6x (very deliberate)
- Script structure: `[WORD] → [SPELL] → [SENTENCE]` cycle per word
- Subtitle: letter-by-letter highlight
- Image: shows the word's object/concept for full duration of spelling
- Pause between each letter: 1.5s
- Repeat the full word after spelling: 1s pause then full word
- Pattern per word: 8-15s total

---

### New Data Model: ChildrenPacingPlan

```typescript
interface ChildrenPacingEntry {
  entryId: string
  type: "story_sentence" | "word_intro" | "letter_spell" | "word_repeat" | "sentence_read" | "pause"
  text: string                  // the spoken text
  durationMs: number            // how long this takes
  imageConceptKey: string       // what image to show while this plays
  subtitleHighlightMode: "full" | "word_by_word" | "letter_by_letter" | "none"
  currentWordIndex?: number     // which word is highlighted in word_by_word mode
  currentLetterIndex?: number   // which letter is highlighted in letter_by_letter mode
  ssmlPause?: number            // milliseconds of silence to insert in TTS script
}

interface ChildrenPacingPlan {
  storyId: string
  mode: "story" | "learning"
  entries: ChildrenPacingEntry[]
  totalDurationMs: number
  wordList?: string[]           // for learning mode: list of target words
}
```

---

### New TTS Script Format for Children

Instead of one long narration text, the TTS receives a **structured script with inline SSML pauses**:

Story mode:
```
<speak>
  <prosody rate="slow">
    John looked at the tall fence.
    <break time="700ms"/>
    He had never jumped so high before.
    <break time="700ms"/>
    But today, he had to try.
    <break time="1200ms"/>
  </prosody>
</speak>
```

Learning mode (spelling FENCE):
```
<speak>
  <prosody rate="x-slow">
    The word is... fence.
    <break time="800ms"/>
    Let's spell it.
    <break time="500ms"/>
    F <break time="1500ms"/>
    E <break time="1500ms"/>
    N <break time="1500ms"/>
    C <break time="1500ms"/>
    E <break time="1500ms"/>
    Fence.
    <break time="1000ms"/>
    Now let's read it in a sentence.
    <break time="700ms"/>
    John jumped the fence.
    <break time="1200ms"/>
  </prosody>
</speak>
```

---

### New Assembly Rules for Children

The children assembly route receives a `ChildrenPacingPlan` — not a flat list of scenes + narration.

Assembly steps:
1. For each `ChildrenPacingEntry`:
   - Hold image for `entry.durationMs`
   - Play TTS segment aligned to entry
   - Apply subtitle highlight mode for this entry
2. Subtitle rendering:
   - `word_by_word`: one word highlighted at a time, others dimmed
   - `letter_by_letter`: one letter highlighted, rest dimmed — uses karaoke-style positioning
3. TTS: sent as full SSML block to ElevenLabs (or Piper with pause injection)
4. No FFmpeg subtitle filter — subtitle is rendered as a React overlay during playback (not burned into video initially), or burned with per-word timing entries

---

### New API Endpoints for Children

```
POST /api/children/build-pacing-plan
Body: { storyText, mode: "story" | "learning", wordList?: string[], targetAgeGroup: "2-4" | "5-7" | "8-10" }
Returns: { ok, plan: ChildrenPacingPlan }

POST /api/children/generate-narration
Body: { plan: ChildrenPacingPlan, voiceId }
Returns: { ok, audioUrl, durationMs, timingMap: [{entryId, audioStart, audioEnd}] }

POST /api/children/assemble
Body: { projectId, plan, timingMap, scenes }
Returns: { ok, videoUrl }
```

---

### Execution Plan (when building)

**Phase C1:** Define `ChildrenPacingPlan` type in `src/types/children.ts`
**Phase C2:** Build `/api/children/build-pacing-plan` — Haiku generates the plan from story text
**Phase C3:** Build `/api/children/generate-narration` — injects SSML pauses, calls ElevenLabs
**Phase C4:** Build children assembly route — timing-driven, not scene-driven
**Phase C5:** Build karaoke subtitle renderer (word-by-word + letter-by-letter)
**Phase C6:** Wire into children-planner UI: replace existing narration + assembly buttons

---

## BUILD ORDER (when Henry gives GO)

```
H1 → H2 → H3 → H4 → H5  (Hybrid image-first structuring)
C1 → C2 → C3 → C4 → C5 → C6  (Children pacing engine)
```

These are independent. Can build H series first, then C series.

---

## STATUS TRACKER

| Phase | Description | Status |
|-------|-------------|--------|
| H1 | structure-story API endpoint | [x] commit 07d8c16 |
| H2 | SceneTag type + ScenePlan/HybridScene extensions | [x] commit 07d8c16 |
| H3 | prompt-builder TAG_MODIFIERS | [x] commit 07d8c16 |
| H4 | "Structure for Images" UI button | [x] commit 07d8c16 |
| H5 | Tag badge on scene cards | [x] commit 07d8c16 |
| C1 | ChildrenPacingPlan type | [x] commit pending |
| C2 | build-pacing-plan API | [x] commit pending |
| C3 | children narration with SSML | [x] commit pending |
| C4 | children assembly route | [x] commit pending |
| C5 | karaoke subtitle renderer | [x] commit pending |
| C6 | children-planner UI wiring | [x] commit pending |
