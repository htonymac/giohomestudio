# GHS Scene Intelligence, Character Pipeline, and SFX Architecture

## Clean Clarification for Claude Code

### Purpose
This document clarifies a major architectural gap in GHS.

If a user uploads a **full movie**, **episode**, or **single scene**, GHS should not jump directly into generation.

The software must first perform a structured **analysis and audit pass** that turns the source into usable production data.

That production data then becomes the source of truth for:
- scene generation
- character continuity
- dialogue grouping
- ambience and environment
- weather and setting cues
- sound effects
- music support
- motion cues
- voice identity
- review workflow

This is the missing system that prevents random generation and makes movie/scene workflows coherent.

---

# 1. Core Problem

Right now, there is an architectural gap if the user provides:
- a full movie
- an episode
- a single scene
- script material
- subtitle material
- dialogue/audio material

The gap is this:

If GHS receives large story content and goes straight into generation, the results will likely be weak because the software will not yet have properly structured knowledge of:
- what is happening in each scene
- who is present
- who is speaking
- what the environment sounds like
- what SFX are required
- what ambience is required
- whether rain, traffic, market, animals, room tone, crowd noise, or weather should be present
- whether the same characters should continue across scenes
- whether the user wants to reuse an existing character or build a new one

So the first correction is:

**GHS must first analyze and structure the source before generation begins.**

---

# 2. Core Product Principle

For movie, episode, and scene workflows, the correct order is:

**Input → Audit → Scene Breakdown → Character Detection → SFX/Ambience Planning → Review → Generation**

Not:

**Input → Immediate generation**

This means GHS needs a dedicated intelligence layer between upload and render.

---

# 3. What the Software Should Do First

When a user uploads a full movie, episode, or scene, GHS should do a structured intake.

## Supported Source Inputs
- full movie file
- episode file
- single scene file
- screenplay/script
- subtitle file
- dialogue transcript
- audio track
- cast notes
- user-provided movie information

## First System Action
The system should perform an **audit and analysis pass**.

This is software responsibility, not something the user should have to do manually from scratch.

---

# 4. Scene Intelligence Layer

## Purpose
The Scene Intelligence Layer is the missing engine that reads the uploaded movie/episode/scene and converts it into structured production information.

## It should extract:
- scene boundaries
- sub-scenes / beats
- dialogue groups
- speaker turns
- actions
- movement cues
- setting/environment
- weather clues
- indoor/outdoor condition
- ambient sound needs
- possible SFX needs
- props and object interactions
- characters present
- emotional tone
- continuity requirements
- music/silence suggestions

## Why this matters
Without this layer:
- SFX selection becomes random
- ambience becomes wrong
- scene generation loses context
- character identity becomes unstable
- continuity breaks across scenes
- generated output feels disconnected

---

# 5. Required Scene Breakdown Logic

After analysis, GHS should break the source into structured scene packages.

## Each scene package should include:
- Scene ID
- Scene title
- Scene summary
- Scene order in project
- Characters present
- Dialogue blocks
- Speaker order
- Action blocks
- Environment type
- Time of day
- Weather
- Mood/emotion
- Props/objects involved
- Ambience needs
- SFX needs
- Music need or silence need
- Continuity requirements
- Visual direction notes
- Generation notes

## Example Scene Package
- Scene 03
- Rainy roadside confrontation
- Characters: Tunde, Ada
- Dialogue: argument, pauses, emotional escalation
- Environment: outdoor, roadside, night
- Weather: rain
- Ambience: distant traffic, rain, wet footsteps
- SFX: thunder rumble, clothing movement, car pass-by
- Mood: tension, emotional pressure
- Continuity: both characters must visually match previous scene

This scene package becomes the real source of truth for generation.

---

# 6. Dialogue and Group Conversation Parsing

A strong part of the system must be dialogue understanding.

## GHS should be able to detect:
- who is speaking
- who is replying
- whether two or more people are in conversation
- emotional tone of the conversation
- overlap or interruption points
- pauses and silence moments
- emphasis words or dramatic beats

## Why this matters
Dialogue grouping affects:
- speaker identity
- voice assignment
- subtitle timing
- reaction timing
- environment tone
- SFX intensity
- camera behavior

If the scene has a group conversation, GHS must not treat it like a single-speaker block.
It should preserve group dynamics.

---

# 7. SFX and Ambience Planning Layer

## Core Question
If GHS does not already have the appropriate SFX needed to perform an actual action, where does it get it from?

## Required Answer
GHS needs an **SFX retrieval and generation layer**.

This layer should not depend only on whatever is already inside the app.
It should support fallback steps.

## Required SFX Source Order
### 1. Internal SFX Library
Use the preloaded approved sound bank first.

Examples:
- footsteps
- rain
- wind
- doors
- city ambience
- crowd noise
- market noise
- traffic
- birds
- dogs
- room tone
- office ambience
- street ambience
- water movement
- kitchen sounds
- cloth movement

### 2. Approved External Library Retrieval
If not found internally, GHS should retrieve from approved library sources.

Possible types:
- licensed SFX source
- approved stock library
- approved free sound source
- user-owned uploaded SFX pack

### 3. AI-Generated SFX or Ambience
If no good asset is found, GHS should generate synthetic SFX/ambience from the structured scene description.

Examples:
- rainy market ambience
- tense corridor room tone
- village night crickets
- crowd murmur with distant bus noise

### 4. Low-Confidence Review Flag
If confidence is too low, GHS should not silently guess.
It should flag:
- missing SFX confidence
- possible replacement ambience
- user review required

---

# 8. SFX Responsibility Split

## Software Responsibility
The software should:
- inspect the scene package
- infer likely ambience
- infer likely SFX
- retrieve from internal library first
- retrieve from approved external source second
- generate synthetic ambience/SFX third
- flag uncertain cases for review

## User Responsibility
The user should:
- approve important sound choices where needed
- upload custom SFX if they want something specific
- correct wrong ambience assumptions if necessary
- choose between software suggestion options when confidence is low

This keeps the software intelligent but still controlled.

---

# 9. Character Detection and Character Workflow

Another critical gap is character continuity.

If GHS is generating scenes from movie or episode input, it must know whether the same character should continue or whether a new character should be built.

## Required Character Workflow
When GHS analyzes the uploaded source, it should detect:
- possible cast members
- recurring characters
- character appearances by scene
- visual cues from source material
- role importance
- continuity requirements

## Then the software should ask the user:
- Use same character?
- Import character?
- Let GHS build character?
- Build character from provided information?

## Required Buttons / Actions
- **Build Character**
- **Build from Provided Information**
- **Import Character**
- **Reuse Existing Character**
- **Preview Character**

This should happen early, not after the main generation has already started.

---

# 10. Character Channel / Character Registry

GHS should have a structured character system that acts like a character channel or registry.

## Each character record should include:
- Character ID
- Name
- Role
- Age range
- Gender presentation if relevant
- Face/look reference
- Body type
- Outfit style
- Personality notes
- Voice identity if relevant
- Visual continuity tags
- Scene appearance history
- Relationship notes
- Generation notes

## Why this matters
Character data should feed:
- scene generation
- continuity across scenes
- dialogue identity
- voice selection
- SFX context
- emotional reaction shots
- future scene reuse

Without a character registry, the same character may change randomly during generation.

---

# 11. Character Generation from Provided Information

If the uploaded movie or scene does not provide enough clean character reference, GHS should help build the missing character layer.

## Workflow
1. software detects incomplete character identity
2. right sidebar shows missing information
3. user can provide:
   - name
   - role
   - appearance notes
   - outfit direction
   - age range
   - voice notes
   - behavior notes
4. GHS builds character draft
5. user previews character
6. user approves before scene generation continues

## Important Requirement
Character generation must happen early enough to influence:
- scene planning
- voice identity
- SFX context
- continuity rules
- generation prompts

---

# 12. Right Sidebar / Movie Information Panel

The right sidebar should become a structured movie information and review panel.

## It should show:
- detected cast
- scene metadata
- environment
- weather
- time of day
- mood
- action summary
- ambience suggestions
- SFX suggestions
- continuity notes
- character confidence
- missing information requests

## Sidebar Goals
- reduce hidden assumptions
- let user correct the software early
- keep story information visible during generation
- improve trust and creative control

## Sidebar Example Actions
- Build Character
- Reuse Existing Character
- Import Character
- Confirm Environment
- Replace Suggested SFX
- Approve Scene Package
- Mark for Review

---

# 13. Review Workflow Before Generation

GHS should not push straight into final generation after analysis.

## Required Flow
1. ingest uploaded source
2. run audit
3. break into scenes
4. detect characters
5. build scene packages
6. plan SFX and ambience
7. show sidebar/review panel
8. let user approve or correct
9. proceed to generation

## Why this matters
This protects against:
- wrong character design
- wrong ambience
- bad weather assumptions
- poor SFX matching
- broken continuity
- bad dialogue grouping

---

# 14. Recommended System Modules

To support this workflow cleanly, GHS needs these modules.

## 1. Scene Analysis Engine
Reads uploaded source and detects scenes, beats, environment, characters, and action.

## 2. Production Data Builder
Turns analysis into structured scene packages.

## 3. Dialogue Parser
Understands speakers, conversation groups, interruption points, and emotional flow.

## 4. Character Builder / Character Registry
Creates, stores, and reuses character definitions.

## 5. SFX Retrieval Engine
Finds matching SFX and ambience from internal and external libraries.

## 6. SFX / Ambience Generator
Generates synthetic ambience or SFX when retrieval is insufficient.

## 7. Review Sidebar Engine
Displays scene metadata, missing information, and approval actions.

## 8. Continuity Engine
Ensures recurring characters and environments remain consistent across scenes.

---

# 15. Source of Truth Principle

The source of truth for generation should not be only the raw uploaded movie file.

The actual source of truth should become:
- structured scene packages
- approved character records
- approved SFX plan
- approved environment/continuity data

This keeps the system stable and reduces generation chaos.

---

# 16. What Claude Code Needs to Think About

This is not just a UI feature request.
It is a full architecture question.

Claude Code should think about:
- how source ingestion works
- where scene analysis happens
- how structured scene data is stored
- how the sidebar reads and updates scene data
- how characters are created and reused
- how SFX retrieval falls back cleanly
- how confidence scoring works
- how user corrections update the source of truth
- how this fits into current Studio flow without making the system messy

---

# 17. Main Clarification Question for Claude Code

We need to fix a major architecture gap in GHS for movie, episode, and scene-based generation.

If a user uploads a full movie, episode, or single scene, the software should not jump directly into generation. It should first run a strong analysis and audit pipeline.

I want GHS to do this:

1. Ingest the uploaded source:
   - full movie
   - episode
   - scene
   - script
   - subtitle/audio if available

2. Analyze and break it down into structured production data:
   - scenes
   - sub-scenes / beats
   - dialogue groups
   - speaker turns
   - characters present
   - actions
   - environment
   - weather
   - ambience needs
   - SFX needs
   - mood
   - props / objects
   - continuity notes

3. For each scene, build a scene package that becomes source-of-truth for generation:
   - scene summary
   - cast in scene
   - dialogue blocks
   - action blocks
   - ambience
   - required SFX
   - music need
   - visual style notes
   - continuity requirements

4. Add an SFX retrieval/generation layer.
If GHS does not already have the required SFX, it should:
   - first check internal SFX library
   - then check approved external/library sources
   - then use AI-generated SFX/ambience if needed
   - then flag low-confidence cases for user review

5. Add a right sidebar / review panel for movie information:
   - detected cast
   - environment
   - scene metadata
   - mood
   - ambience/SFX suggestions
   - continuity info

6. Add character workflow:
   - if character is detected, user can choose reuse same character
   - or import character
   - or let GHS build character from available information
   - add button options like:
     - Build Character
     - Build from Provided Information
     - Import Character
     - Reuse Existing Character

7. Character generation must happen early enough to inform:
   - scene generation
   - SFX context
   - voice identity
   - continuity across scenes

Main question:
How should we architect this analysis → scene package → character system → SFX retrieval/generation pipeline cleanly inside GHS without breaking the current Studio flow?

I want this planned as a proper system, not as scattered features.

---

# 18. Final Position

The real missing layer is a **Scene Intelligence Layer**.

That layer must sit between:
**user upload** and **actual generation**

Without it:
- SFX will feel random
- ambience will feel wrong
- dialogue understanding will be weak
- characters will break continuity
- scenes will feel disconnected

With it:
- GHS becomes a serious movie/scene generation system
- generation gets the right environment data
- characters remain more stable
- SFX becomes much more relevant
- review becomes more professional
- the user can guide the system without doing all the work manually

This is the architecture direction that should be clarified with Claude Code.

