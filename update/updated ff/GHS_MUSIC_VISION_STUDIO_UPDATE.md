# GHS MusicVision Studio Update

## Purpose

This document updates the music video planner direction using:

- the downloaded `GHS MusicVision Studio` canvas
- the current code workflow
- the `Auto Time Stamp` spec

It is meant as a clean reference copy in `C:\Users\USER\Documents\updated ff`.

---

## Product Name

Public name:

- `GHS MusicVision Studio`

Internal description:

- `GHS AI Music Video Creator`

Current route:

- `/dashboard/music-video-planner`

---

## Core Rule

Do not rebuild the planner from zero.
Upgrade the current planner by strengthening the weak layers.

---

## Current Planner Flow

The code already has:

1. `Overview`
2. `Song Input`
3. `Mode & AI`
4. `Storyboard`
5. `Screenplay`
6. `Captions`
7. `Audio`
8. `Assembly`

Actual workflow:

```text
Song Input
  -> Analyze Song
  -> Storyboard
  -> Screenplay
  -> Captions
  -> Audio
  -> Assembly
```

---

## What Exists Already

- song input
- lyrics input
- video mode selection
- visual style selection
- song analysis route
- project save/load
- storyboard generation
- screenplay generation
- screenplay parsing
- narration/dialogue segmentation
- scene image handling
- scene video handling
- music library picker
- AI music picking
- SFX support
- final assembly paths

---

## What Must Be Added or Strengthened

### 1. Auto Time Stamp AI

This must be included directly in the product direction.

It should handle:

- lyric timing
- narration timing
- scene timing
- subtitle timing
- shot timing
- assembly timeline output

It should use the companion spec:

- `AUTO_TIME_STAMP_FUNCTION_SPEC.md`

### 2. Text-to-Music-Video

This must remain supported.

User should be able to start from:

- lyrics only
- text concept only
- prompt only
- jingle idea
- mood/theme with no uploaded song yet

That means the product supports:

- `Text -> AI Director Plan -> Storyboard -> Timeline -> Preview -> Music/Visual generation path`

### 3. Beat/Section Intelligence

The system should become stronger at:

- intro
- verse
- chorus
- bridge
- outro
- hook emphasis
- energy shifts

### 4. Provider Routing

Provider/model choice must not be random.
Per scene it should consider:

- style
- motion need
- realism vs stylized
- budget
- preview vs final

### 5. Review-First Flow

There must be approval checkpoints before:

- expensive scene generation
- final full assembly

---

## Correct Future Flow

```text
1. Start Project
2. Music Intake
3. Song Intelligence Analysis
4. Creative Direction
5. Mode Selection
6. AI Director Plan
7. Storyboard + Timeline
8. Scene Generation Plan
9. Preview Frames / Preview Clips
10. User Review and Approval
11. FAL Scene Generation
12. Lyrics / Captions / Narration / SFX
13. Final Assembly
14. Export Versions
15. Registry / Review Inbox / Publish Later
```

---

## Blunt Verdict

The current planner is real and useful.
The weak parts are:

- timeline intelligence
- auto timestamping
- stronger script-to-scene conversion
- provider routing clarity
- cleaner review-first checkpoints

So the right job is:

- keep the planner
- rebrand it
- strengthen the intelligence layers
- include Auto Time Stamp AI
- include Text-to-Music-Video

