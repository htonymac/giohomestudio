# GHS Continuous Motion and Scene Continuation Plan

## Structured Product Canvas

### Source Context
This canvas restructures the uploaded planning notes about continuous action scenes, motion continuation, frame chaining, planner behavior, and how GHS should handle long scenes without visible breaks. fileciteturn0file0

### Purpose
This document defines how GHS should handle **continuous motion scenes** when a user wants a long action or cinematic sequence that cannot be broken into random unrelated clips.

Examples:
- running and jumping off a cliff
- falling into water
- lightning and thunder during motion
- any action sequence that must feel like one continuous event

The goal is to make GHS understand that these are not separate disconnected clips.
They are **one motion event extended across multiple segments**.

---

# 1. Core Principle

A long action scene is not made by generating random independent clips and joining them.

That breaks:
- motion continuity
- character continuity
- camera continuity
- realism

The correct principle is:

**Do not break the action. Extend the action.**

This means GHS should treat long scenes as:
- one continuous motion event
- divided into segments only for generation practicality
- chained together through continuation logic

---

# 2. Main Clarification

If a user describes a long action like:

> He runs and jumps over a cliff, falls toward the water, lands in the water, lightning strikes, thunder roars

This is not three unrelated scenes.
This is one continuous action sequence that may need multiple generation blocks.

## Correct Interpretation
GHS must understand:
- this is one scene
- it has several motion phases
- each phase continues from the previous phase
- the next generation block must start from the visual and motion state of the previous one

---

# 3. Core Product Concept

The key feature is:

## Continuous Motion Mode
When enabled, GHS should automatically:
- split long motion into usable generation blocks
- preserve frame continuity
- preserve motion direction
- preserve camera continuity
- preserve character identity
- preserve temporal consistency
- merge all segments into one final scene

This should be treated as a serious planner/assembly feature, not a simple generation option.

---

# 4. User Goal

The user may want to create scenes lasting beyond one provider’s comfortable single-generation duration.

Examples:
- 10 seconds
- 15 seconds
- 20 seconds
- 27 seconds

The user should not need to manually solve the technical continuity problem.

GHS should handle this automatically.

---

# 5. Continuous Motion Toggle

GHS should provide a clear setting such as:

- Continuous Motion
- Motion Continuation
- Extend Motion Across Segments

## When the user enables this, GHS should automatically:
1. enable frame chaining
2. store the ending frame of each segment
3. reuse the same visual seed where appropriate
4. preserve camera and character consistency
5. continue prompts in sequence
6. hand the chained result to Assembly for final merge

This should not require the user to manually manage last-frame logic.

---

# 6. Planner Position in GHS

This logic should fit naturally into the existing planner structure:

- Story
- Characters
- Scenes
- Audio
- Assembly

## The main continuation logic belongs in:
- Scenes
- Assembly

### Story
The story defines the overall action.

### Scenes
The scene system breaks that action into motion-based sub-scenes.

### Assembly
Assembly joins all generated motion segments into one final continuous scene.

---

# 7. Story Intake Rule

When the user writes a story and selects Continuous Motion, GHS must not split by sentence only.

It must use **motion-aware splitting**.

## Example story
> He ran and jumped over the cliff, falling fast toward the water below. Lightning struck the sky and thunder roared.

GHS should not treat this as random text blocks.
It should break it into **motion units**.

---

# 8. Motion Unit Planning

GHS should convert the story into motion-based units.

## Example motion units
- running to cliff
- jumping off cliff
- falling through air
- hitting water
- splash and lightning moment

These become:
- sub-scenes
- motion segments
- continuation blocks

## Important Rule
This is not ordinary sentence splitting.
It is motion-based splitting.

---

# 9. Segment Timing Logic

If the provider comfortably generates only short durations, GHS should divide the scene into short segments.

## Example segmentation
For a 15-second action scene:
- Segment 1 = 0–5 sec
- Segment 2 = 5–10 sec
- Segment 3 = 10–15 sec

For a 27-second action scene:
- Segment 1 = 0–5 sec
- Segment 2 = 5–10 sec
- Segment 3 = 10–15 sec
- Segment 4 = 15–20 sec
- Segment 5 = 20–25 sec
- Segment 6 = 25–27 sec

## Important Rule
The segments are not separate scenes in the storytelling sense.
They are generation blocks for one continuous event.

---

# 10. Motion Anchor Concept

The most important continuation object is the **Motion Anchor**.

## Definition
A Motion Anchor is the final frame or end-state image taken from the previous generated segment.

## Purpose
It becomes the starting point for the next segment.

### Example
- Scene segment 1 generates `clip_01.mp4`
- GHS extracts the last frame
- that last frame becomes `motion_anchor_01`
- the next segment starts from that anchor

Without this, continuity breaks.

---

# 11. Last Frame Extraction Rule

After every generated segment, GHS should automatically:
- extract the last frame
- store it as an anchor
- attach it to the next segment request

This step must be automatic.

The user should not have to manage it manually.

---

# 12. Continuation Prompt Logic

The next segment should not start with a fresh unrelated prompt.

GHS should use continuation-aware prompts.

## Continuation prompt patterns
- Continue the motion
- Continue the same action
- Next moment of the same scene
- Continue from previous frame
- Continue the same character motion and camera angle

## Example
Segment 1:
> A man runs toward a cliff edge, cinematic lighting, dramatic motion

Segment 2:
> Continue: the same man jumps off the cliff and begins falling toward the ocean below

Segment 3:
> Continue: the same man hits the water with a large splash, lightning flashing overhead

---

# 13. What Must Stay Stable

For continuous motion to work well, GHS must try to preserve:

## 1. Character Continuity
- same character identity
- same clothing
- same body shape
- same visual appearance

## 2. Camera Continuity
- same angle when needed
- same lens feel
- same direction of movement
- no random re-framing unless intentionally planned

## 3. Lighting Continuity
- same lighting mood
- same time-of-day feel
- weather continuity

## 4. Motion Direction Continuity
- if running forward, do not restart from a random pose
- if falling, continue falling directionally
- if jumping, continue from takeoff into airborne motion

## 5. Seed / Randomness Stability
Where supported, keep the same seed or structured consistency values to reduce random changes.

---

# 14. Continuous Scene vs Broken Scene

GHS must understand the difference.

## Broken Scene Behavior
- fresh start each time
- no anchor frame
- random pose changes
- character drift
- camera drift
- obvious cut feel

## Continuous Scene Behavior
- previous last frame guides next segment
- same motion continues
- same character continues
- same camera logic continues
- merged result feels like one longer scene

---

# 15. Provider Support Strategy

The plan notes refer to tools such as:
- Wan via FAL
- Kling 2.5
- other continuation-friendly systems

## GHS should treat providers like this:

### Wan / FAL
Use segment generation + last-frame continuation pipeline.

### Kling 2.5
Use segment generation + continuation/image-to-video extension pipeline.

### General Rule
Regardless of provider, GHS should own the logic for:
- segment planning
- last-frame extraction
- motion anchor storage
- continuation prompt building
- final assembly

Do not let provider behavior alone define the product logic.

---

# 16. Claude Code’s Responsibility

Claude Code is important here because the user should not see or manage the continuation complexity manually.

## Claude Code should automate:
- scene segmentation
- motion unit creation
- first segment generation request
- last-frame extraction
- next segment request construction
- chaining across all segments
- assembly merge
- audio alignment later

This should feel like one button to the user, not a technical workflow.

---

# 17. Continuous Motion Internal Pipeline

The system should work like this:

1. user writes story
2. user enables Continuous Motion
3. GHS identifies one long motion event
4. GHS converts it into motion units
5. GHS maps motion units into segment durations
6. GHS generates segment 1
7. GHS extracts segment 1 last frame
8. GHS uses that frame as the motion anchor for segment 2
9. GHS repeats until all segments are complete
10. Assembly merges clips into one scene
11. audio and final polish are applied after the visual chain is stable

---

# 18. Scene Board Role

Inside the planner, the Scenes tab should show more than ordinary scene names.

For continuous motion, it should show:
- motion segments
- duration per segment
- anchor relationship
- status of generation
- continuity dependency

## Example display
- Segment 1: running to cliff
- Segment 2: jump begins (depends on Segment 1 anchor)
- Segment 3: falling (depends on Segment 2 anchor)
- Segment 4: splash (depends on Segment 3 anchor)

This makes the logic visible and structured.

---

# 19. Assembly Role

Assembly is not just joining clips blindly.

Assembly should:
- collect all chained clips
- align time sequence correctly
- merge them in order
- preserve continuity
- prepare for sound design and music later

## Important Rule
Sound should come after motion continuity is secured.

The visual chain must be stable first.

---

# 20. Audio Later, Not First

The source notes correctly imply that long action scenes should focus on visual continuity first.

After that, GHS can add:
- thunder
- splash
- environment sound
- music
- dialogue

## Important Rule
Do not let audio planning confuse the visual motion-continuation pipeline.
Visual continuity first, audio support second.

---

# 21. Scene Extension Concept

GHS should frame this to the user as **scene extension**, not scene breaking.

This is psychologically and technically better.

## User-facing explanation
The system is not breaking the scene into unrelated pieces.
It is extending the same scene in controlled motion segments.

That concept should shape UI wording and backend architecture.

---

# 22. User Controls That Should Exist

For Continuous Motion mode, the user should be able to control:
- segment duration target
- total scene duration
- camera stability preference
- continuity strictness
- whether AI or user sets scene duration
- whether motion planning is fully automatic or manually refined

## Important Design Question
The system should eventually support two styles:

### Option A — User Sets Duration
The user manually decides segment durations.

### Option B — AI Calculates Duration
The AI decides segment segmentation based on motion complexity.

This decision affects realism and system complexity.

---

# 23. Recommended First Version

For the first build, the cleaner path is:

- user writes story
- user enables Continuous Motion
- user chooses target segment duration (such as 5 sec)
- GHS automatically splits into motion segments
- GHS chains last-frame continuity automatically
- GHS merges clips automatically

This is simpler than starting with deep manual timing tools.

---

# 24. Important Restrictions and Truths

Claude Code should understand these practical limits:

- long action scenes are harder than talking scenes
- motion consistency is harder than static scenes
- providers may drift over long durations
- continuity is improved by chaining, not guaranteed perfectly by magic
- one single very long scene render is often less practical than controlled extension

## Core Rule
The correct method for long action is continuation, not blind single-pass generation.

---

# 25. Required System Modules

To make this feature real, GHS needs:

## 1. Motion Unit Planner
Break story into action-based sub-events.

## 2. Segment Duration Planner
Turn motion units into generation blocks.

## 3. Continuation Prompt Builder
Create continuation-aware prompts for each next segment.

## 4. Motion Anchor Extractor
Automatically extract final frame from each completed segment.

## 5. Anchor Store
Track which next segment depends on which prior segment.

## 6. Continuity Settings Manager
Keep camera/character/lighting/seed continuity where possible.

## 7. Assembly Merger
Combine all chained segments into one final scene.

---

# 26. Source of Truth Principle

The source of truth should not be only the raw story text.

For Continuous Motion mode, the source of truth becomes:
- motion units
- segment plan
- anchor chain
- continuity settings
- provider generation records
- final assembly order

This makes the system stable and structured.

---

# 27. What Claude Code Must Build First

## First Priority
- Continuous Motion toggle
- motion-unit planning logic
- segment duration planning
- last-frame extraction pipeline
- anchor storage
- continuation prompt generation
- chained assembly merge

## Second Priority
- scene board visualization of motion segments
- continuity settings UI
- user control for segment duration vs AI duration

## Third Priority
- more advanced camera/seed stability options
- stronger preview controls
- smarter automatic duration calculation

---

# 28. What Claude Code Must Not Do

- do not treat long action as random clip generation
- do not split only by sentence structure
- do not hide the continuity chain from the system architecture
- do not make the user manually manage frame continuation
- do not let assembly happen without anchor-aware chaining
- do not prioritize audio before the motion chain is stable

---

# 29. Main Clarification for Claude Code

We need GHS to support true continuous motion for long scenes.

If a user writes one long action event, the system should not create unrelated short clips and hope they look continuous.

It should:
1. detect a continuous motion event
2. split it into motion-based segments
3. generate segment 1
4. extract the last frame
5. use that frame as the motion anchor for segment 2
6. repeat for all segments
7. merge all segments through Assembly into one continuous scene

This logic should live mainly in Scenes and Assembly and should be automatic when Continuous Motion is enabled.

Please build this as a structured continuation system, not as random scene splitting.

---

# 30. Final Position

Continuous Motion is one of the most important advanced capabilities in GHS because it allows the system to create longer cinematic action scenes without obvious visual breaks.

If built correctly, GHS will not just generate clips.
It will:
- plan motion
- chain motion
- preserve continuity
- extend scenes intelligently
- assemble them into one stronger final sequence

That is the correct architecture direction for long action and cinematic continuity in GHS.

