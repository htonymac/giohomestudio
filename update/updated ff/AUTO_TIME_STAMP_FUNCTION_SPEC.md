# GHS Auto Time Stamp Function Spec

## Purpose

This document defines the `Auto Time Stamp` function for GioHomeStudio.

It is the planning layer that converts:

- raw story
- long narration script
- scene list
- slide content
- dialogue blocks

into:

- timed beats
- timed scene blocks
- narration timing
- subtitle timing
- shot timing
- assembly-ready timeline data

This is a planning function, not the final renderer.

---

## Core Role

The function exists to solve this problem:

- users may have a strong script but no usable timeline
- narration may be longer or shorter than the planned visuals
- scenes may switch at the wrong moments
- subtitles may not align
- video assembly may feel random instead of intentional

The `Auto Time Stamp` engine should create structured timing before final assembly.

---

## What It Must Do

### 1. Read script content

Inputs may include:

- title
- full narration
- scene summary
- shot list
- dialogue
- target duration
- preferred pacing
- content mode

### 2. Break script into timing units

The function must split content into:

- scenes
- beats
- narration chunks
- dialogue turns
- visual transitions

This split must be based on meaning and action, not only punctuation.

### 3. Estimate timing

For each unit, it should estimate:

- start time
- end time
- duration

Timing should consider:

- narration length
- sentence complexity
- pauses
- emotional weight
- shot transition needs
- user target duration

### 4. Output structured timing plan

The output should support:

- assembly planner
- subtitles
- shot planner
- audio planner
- review UI

---

## Responsibility Split

### Intelligent AI planner

Responsible for:

- understanding the script
- finding beats and transitions
- estimating durations intelligently
- suggesting pacing

### Timestamp engine

Responsible for:

- validating time math
- ensuring no overlaps unless allowed
- ensuring no broken gaps unless intended
- returning clean structured timing objects

### Assembly layer

Responsible for:

- executing the approved timing plan
- placing media/audio/captions according to timestamps

Short form:

- AI decides timing intent
- timestamp engine structures it
- assembly executes it

---

## Functional Modes

### Mode 1 — Narration-first timing

Use when a full narration script already exists.

Flow:

- measure narration text/audio
- split into spoken beats
- align scenes to narration

### Mode 2 — Scene-first timing

Use when scenes already exist but narration is weak or partial.

Flow:

- respect scene order
- assign approximate time windows
- fit narration into scene windows

### Mode 3 — Hybrid timing

Use when both narration and scene plan exist.

Flow:

- align narration and visuals together
- adjust whichever is weaker
- produce one merged timeline

---

## Required Output Shape

Minimum structure:

```json
{
  "projectId": "xyz",
  "totalDuration": 92,
  "segments": [
    {
      "id": "seg_1",
      "type": "scene",
      "title": "Opening",
      "startTime": 0,
      "endTime": 6.2,
      "duration": 6.2,
      "narrationText": "The city woke before sunrise.",
      "visualInstruction": "wide dawn skyline",
      "subtitleText": "The city woke before sunrise."
    }
  ]
}
```

Each segment should be usable by:

- assembly planner
- subtitle layer
- shot planner
- review UI

---

## Placement in Current GHS Architecture

This function belongs between:

- story / narration planning
- assembly planning

Current likely touchpoints:

- `app/api/assembly/plan/route.ts`
- `app/dashboard/hybrid-planner/page.tsx`
- narration generation routes
- screenplay / shot planning routes

Recommended new code ownership:

- helper in `lib/` for timestamp logic
- optional API route for dedicated script-to-timeline generation

Suggested names:

- `lib/auto-timestamp.ts`
- `lib/timeline-intelligence.ts`
- `app/api/timeline/plan/route.ts`

---

## Rules

### Must do

- preserve scene order unless explicitly allowed to rebalance
- keep timeline deterministic after approval
- support narration, subtitles, and assembly together
- expose timing for review before final render

### Must not do

- directly render final video
- silently overwrite approved timings
- depend only on punctuation splitting
- create invalid overlapping timelines by accident

---

## MVP Scope

The first implementation should do only this:

- accept script + scenes + target duration
- split into timed segments
- generate narration timing blocks
- generate subtitle timing blocks
- return assembly-ready JSON

Not MVP:

- advanced adaptive retiming after render
- automatic silence detection from final audio
- full editor drag timeline replacement
- auto soundtrack choreography

---

## Why It Matters

Without this function:

- script flow feels loose
- captions drift
- narration may cut early or end late
- scene changes feel arbitrary
- assembly has structure but not intelligence

With this function:

- story has rhythm
- visuals switch at sensible moments
- narration and captions align
- assembly gets a real timing brain

