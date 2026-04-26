# GHS Planner Workshop — Master Canvas

This document defines the Planner layer for GioHomeStudio (GHS).
Saved word-for-word from Henry's instructions (2026-04-12).

## Core Product Position

GHS Planner = the user's production workshop and command center.
The Planner is where structured production work is visible and controllable.

The Planner must feel like a real workshop, not a dead dashboard.

## Relationship to Existing GHS Laws

The Planner must obey and expose the existing GHS source-of-truth rules:
- Characters are structured identity objects, not just text names
- Stories must become scene objects
- Draft first, assembly later
- Scene and shot control must persist
- Narration must change by scene type
- Audio is structural glue
- Character, voice, scene, and shot IDs must remain stable
- Selective regeneration must be supported
- Assembly happens only when the user explicitly triggers it

## Core Planner Screens and Panels

### A. Planner Home / Project Workshop
Project title, type, status, phase, progress summary, scene counts, characters, voices, cost, duration, readiness.

### B. Scene Board
All scenes as cards with: Scene ID, title, order, type, state, characters, motion need, narration, preview, duration, cost, warnings.
Actions: open, edit, open in editor, regenerate, change type, adjust narration, reorder, approve, send back.
Grid view + timeline view.

### C. Draft Zone
All unfinished work visible: story, scene, shot, narration, dialogue, audio, visual drafts, assembly draft state.

### D. Character Section Link Panel
Character registry, create, update, view assets, review continuity, fix references, voice mapping.
Readiness: complete, missing portrait, missing ref set, missing voice, continuity warning.

### E. Editor Section Link Panel
Jump from Planner to Editor for scene/shot/assembly. See which scene is open. See save state.

### F. Online Intelligence / Trend Panel
Viral angles, trending topics, audience attention, market mood, hook suggestions. Advisory only.

### G. Resume / Continue Panel
Last section, last scene, last character, last editor task, last warning, next action.

## Navigation Law
- Planner -> Character -> back (context preserved)
- Planner -> Editor -> back (context preserved)
- Must preserve: project, scene, shot, task, warnings, drafts, board position

## Make Scene Image Entry Points
- Planner Scene Board
- Scene Detail inside Planner
- Collaborative Editor
- Must always know: project, scene, characters, IDs, text, draft/regen

## Scene Image Generation Panel
- Scene ID, title, text, description (editable)
- Available characters as chips/buttons
- Selected characters
- Character ID chips + insert controls
- Mood, location, time of day, style
- Generate + Save as Draft buttons

## AI Authority Model
- Layer A: Local helper for low-risk support
- Layer B: Cloud intelligence for core production
- Layer C: GHS Pro premium reasoning
- Local helper NEVER overrides source-of-truth rules

## Persistent State
Project ID, Story Draft, Characters, Voices, Scenes, Shots, Assets, Timeline, Validation, Trends, Resume Checkpoint.

## Progress Dimensions
Story, Characters, Scenes, Shot planning, Voice mapping, Audio, Visual, Validation, Assembly, Export.

## Apply To
- Hybrid Planner (primary)
- Movie Planner (same technique)
- Children Planner (same technique)
