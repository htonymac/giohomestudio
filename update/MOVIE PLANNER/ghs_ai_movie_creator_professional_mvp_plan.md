# GHS AI Movie Creator — Professional MVP Plan

We are continuing GioHomeStudio from an already-working localhost build.

This document is a shared canvas for Henry and Claude Code.

It defines the **MVP build scope** for:

## GHS AI Movie Creator — Professional

This is the **Movie Planner / Movie Creator** side only.
It is completely separate from:
- Music Video
- Music Creator
- Ad / Commercial
- AI Content Creator

This MVP is for **movie-only planning and controlled scene production**.

It should help the user move from:

**rough movie idea -> character selection -> structured movie plan -> scene cards -> sound plan -> generation queue -> basic final assembly**

This is not a random prompt generator.
This is not a commercial builder.
This is not a narrated social-content system.
This is a **movie planning and production assistant**.

---

# 1. MVP Product Promise

The MVP promise is simple:

**Give the user a real movie planning system that can turn a rough story idea into a cast-aware, scene-aware, sound-aware production plan before generation starts.**

The system should feel like:
- an AI producer assistant
- an AI director/planner
- a scene organizer
- a sound-aware story planner

It should not feel like:
- one empty prompt box
- random text-to-video
- ad/commercial logic mixed into story planning
- a weak outline generator with no scene intelligence

---

# 2. Hard MVP Boundaries

## This section is for MOVIE only
Keep these separate entry points in GHS:
- Movie
- Music Video
- Ad / Commercial
- AI Content Creator

Do not mix ad logic into Movie.
Do not place CTA/commercial structure inside Movie.
Do not make Movie depend on ad-builder logic.

## Narrated Story is NOT a movie type
Do not use “Narrated Story” as a main movie type.
Narration belongs under **Storytelling Style**.

## Continue flow must be different from New Movie flow
If user clicks **Continue Existing Movie**, do not ask all setup questions again unless required data is missing.
Load project context and continue from there.

---

# 3. Core MVP Architecture Rule

For MVP, Movie Planner must **not** be built as one-LLM feature.

It must use:

## 2 AI layers
### AI 1 — Primary Planner
The main movie producer/planner AI.

### AI 2 — Reviewer
The checker / critic / logic reviewer.

## 3 basic non-LLM engines
### 1. Continuity Checker — Basic
Checks obvious mismatches and scene-order issues.

### 2. Sound Cue Planner — Basic
Infers scene-by-scene sound, ambience, and music guidance.

### 3. Generation Strategy Selector — Basic
Chooses image / video / image-to-video / hybrid / audio-heavy bridge recommendation per scene.

This is enough for MVP.
Do not build the full later architecture yet.

---

# 4. Main MVP User Paths

## Path 1 — New Movie
Use when the user wants to start a movie from scratch.

### Flow
1. Enter movie idea
2. Choose planning settings
3. Choose saved characters
4. AI builds movie plan draft
5. User reviews and edits
6. Save movie plan
7. Generate scene-by-scene or queue selected scenes
8. Assemble basic final movie

## Path 2 — Continue Existing Movie
Use when the user already has an existing movie project.

### Flow
1. Load existing movie project
2. Load previously selected characters
3. Load saved scenes
4. Load generated assets and missing assets
5. Load audio/music/SFX status if available
6. Open Scene Planner directly
7. AI asks what should happen next:
   - continue planning
   - fix continuity
   - expand missing scenes
   - prepare generation
   - rework sound plan
   - assemble final movie

## Continue rule
If project already has core data:
- do not restart setup from zero
- do not ask genre/style again if already saved
- do not ask character identity again if already assigned
- ask only for missing or inconsistent information

### Example AI continuation prompt
“I found 10 scenes, 2 assigned characters, 1 narration draft, and 6 visual assets. Do you want me to continue scene planning, fix continuity, or prepare generation?”

---

# 5. Planning Model for MVP

Do not use one weak field called only **Movie Type**.
Use these layers even in MVP:

## 1. Story Genre
Defines the story world and emotional logic.

### MVP genre options
- Children Story
- Short Story
- Action
- African Cinema
- Epic Fantasy
- Historical Drama
- Adventure
- Romance
- Thriller
- Horror
- Comedy
- Sci-Fi
- War
- Crime
- Supernatural
- Survival
- Inspirational

### Special note
For “Game of Thrones type,” the main user-facing genre should be:
- **Epic Fantasy**

Optional hidden/internal tags later:
- dark fantasy
- political fantasy
- royal conflict
- medieval world
- power struggle

## 2. Storytelling Style
Defines how the movie is told.

### MVP options
- Cinematic
- Dialogue Driven
- Narrated
- Voiceover Led
- Minimal Dialogue
- Visual Only
- Documentary Style
- Music Led

## 3. Output Format
Defines the production pipeline and cost strategy.

### MVP options
- Audio Only Movie
- Audio + Image Movie
- Audio + Video + Image Movie
- Video First Movie
- Image-to-Video Hybrid

### Meaning
**Audio Only Movie**
- radio-drama style
- voice and sound-led story

**Audio + Image Movie**
- low-cost visual storytelling
- narrated visual stories
- children stories

**Audio + Video + Image Movie**
- hybrid mode
- use stills for calm scenes
- use video for action scenes

**Video First Movie**
- motion-focused production
- more generated video than images

**Image-to-Video Hybrid**
- generate image first then animate selected scenes
- useful for cost control and continuity

## 4. Production Mode
Defines AI control vs user control.

### MVP options
- AI Generated Movie
- AI + Human Movie
- Manual Assisted Movie

## 5. Planning Depth
Controls detail level.

### MVP options
- Quick Plan
- Smart Plan
- Full Producer Plan

### Meaning
**Quick Plan**
- short outline
- few scenes
- light suggestions

**Smart Plan**
- stronger scene logic
- sound and style suggestions
- usable fast production plan

**Full Producer Plan**
- story summary
- cast assignment
- scene-by-scene timing
- sound plan
- music plan
- visual suggestions
- continuity logic
- generation method per scene

---

# 6. New Movie Intake Screen — MVP

For **New Movie**, ask only what matters.

## Basic inputs
- Movie Title
- One-line Movie Idea
- Expanded Story Description
- Estimated Duration
- Language

## Creative inputs
- Story Genre
- Storytelling Style
- Output Format
- Production Mode
- Planning Depth
- Tone / Mood
- Setting / World
- Intended Audience

## Tone / Mood examples
- emotional
- suspenseful
- heroic
- magical
- dark
- funny
- warm
- tragic
- adventurous
- intense

## Setting / World examples
- modern city
- village
- desert
- mountain snow
- ancient kingdom
- mythic world
- futuristic city
- forest
- war zone

---

# 7. Character Integration — MVP

The Character panel already exists. Movie Creator must use it deeply.

## Character behavior
After movie idea + planning selections, AI should ask:
- Who is the lead?
- Which saved character should be used?
- What role does each character play?

## Role examples
- hero
- heroine
- antihero
- narrator
- villain
- mentor
- side character
- comic relief
- child lead
- warrior
- ruler

## Character source of truth
Use saved character data from the existing Characters section:
- name
- appearance
- role
- speech style
- voice identity
- age feel
- accent
- narrator type if applicable
- linked images/reference assets where available

## Important rule
Do not force the user to re-enter character details if they already exist.
Pull from the saved character profile.

## AI assistance after character selection
Once character is selected, AI should suggest:
- outfit
- props
- age expression
- visual styling
- speech tone
- role fit in story
- alternative casting ideas if user wants options

### Example
If user selects **Tunde** in an action mountain movie, AI can suggest:
- black snow jacket
- gloves
- boots
- helmet or goggles
- red parachute for contrast
- determined facial expression
- strong breathing and tense body movement

---

# 8. AI Layer 1 — Primary Planner

## Role
The Primary Planner should:
- understand the story idea
- classify genre/style/output format
- assign or suggest roles for selected characters
- infer missing production details
- build the first movie plan draft
- break the movie into scenes
- suggest sound, ambience, and music cues
- choose recommended generation type per scene

## Important behavior
The user should not need to type every hidden production detail.

### Example
If user writes:
“James shouted Kelvin. Before Kelvin could turn back, he shot him.”

The Planner should infer:
- there may need to be a weapon reveal or implied ready weapon
- Kelvin begins turning in reaction to the voice
- the environment may affect sound design
- tension/silence before the gunshot matters
- an impact/reaction beat may be needed
- a bridge beat may be needed if action feels too sudden

## Output from Planner
- movie summary
- story arc
- cast assignments
- scene list
- sound plan basics
- visual plan basics
- generation recommendations
- possible continuity risks
- missing asset warnings

---

# 9. AI Layer 2 — Reviewer

## Role
The Reviewer should:
- check if the story logic is weak
- check if scenes jump too hard with missing beats
- check if continuity is weak
- check if sound plan is incomplete
- check if a scene references something not planned visually
- check if output format choice is wasteful or weak
- check if cost strategy is poor

## Example
If Planner creates a cliff jump scene with no setup and no landing resolution, Reviewer can say:
- missing jump preparation beat
- missing landing/resolution shot
- need stronger air-rush and parachute deployment sound plan

## Important MVP rule
Reviewer critiques and improves. It should not rewrite everything from zero.

---

# 10. Non-LLM Engine 1 — Continuity Checker (Basic)

## Role
Detect obvious continuity issues.

## MVP checks
- character outfit mismatch
- prop mismatch
- location mismatch
- weather mismatch
- voice mismatch
- scene order logic issues
- obvious missing bridge scene between large story jumps

## Example warnings
- Tunde wears black snow jacket in Scene 1 but red armor in Scene 4 without explanation
- parachute changes color between scenes
- mountain snow becomes desert without transition
- voice accent changes unexpectedly

---

# 11. Non-LLM Engine 2 — Sound Cue Planner (Basic)

## Role
Infer scene-by-scene sound, ambience, and music suggestions.

## MVP audio layers per scene
1. Dialogue / performance voice
2. Narration / voiceover
3. Sound effects
4. Atmosphere / ambience
5. Music cue

## Important product rule
Do not make the user manually invent every sound.
AI should suggest scene-by-scene sound design.

## Example
For a cliff jump scene, Sound Cue Planner should infer:
- wind ambience
- heavy breathing
- snow crunch
- air rush
- parachute snap
- fabric flutter
- landing impact
- music rise / release

## Another example
For a hallway shooting scene, it may infer:
- hallway echo or dry reverb depending on space
- footsteps or shoe scrape
- cloth rustle
- nervous breathing
- gunshot type ambiguity warning if gun type is unknown
- crowd panic only if environment suggests a crowd

---

# 12. Non-LLM Engine 3 — Generation Strategy Selector (Basic)

## Role
Choose the best scene production path.

## Scene production types for MVP
- image scene
- video scene
- image-to-video scene
- audio-only bridge scene
- hybrid scene

## Example cost logic
For **Audio + Video + Image Movie**:
- static talking scenes can be image-based
- high-action scenes can be video-based
- transition scenes can use image-to-video
- narration can carry low-motion moments

## Cost labels in MVP
Per scene, AI can mark recommendation as:
- cheap
- balanced
- premium

---

# 13. Movie Plan Draft — MVP

After intake and character selection, AI should automatically generate a structured **Movie Plan Draft**.

## Draft must include
1. Movie summary
2. Core story arc
3. Character assignments
4. Scene-by-scene breakdown
5. Sound plan
6. Music direction
7. Visual direction
8. Generation strategy
9. Continuity notes
10. Missing asset warnings

---

# 14. Movie Plan Structure — MVP

## A. Movie Summary
A short producer summary of the story.

## B. Story Arc
Simple narrative arc:
- setup
- tension
- climax
- resolution

## C. Scene Breakdown
Every scene should be a structured scene card.

### Each scene card should contain
- Scene Number
- Scene Title
- Scene Goal
- Duration or target length
- Characters in Scene
- Visual Description
- Camera Direction
- Dialogue / Narration
- Sound Effects
- Atmosphere / Ambience
- Music Cue
- Asset Type Recommendation
- Generation Method
- Status

### Scene status values
- planned
- approved
- generating
- generated
- needs edit
- blocked
- missing asset

## D. Audio Plan
Audio is planned in layers:
1. dialogue / performance voice
2. narration / voiceover
3. sound effects
4. atmosphere / ambience
5. music

## E. Visual Plan
Per scene include:
- setting
- lighting
- weather
- camera angle
- movement
- costume
- key props
- color feel
- transitions

## F. Generation Strategy
Per scene include:
- image scene
- video scene
- image-to-video scene
- audio-only bridge
- hybrid scene

---

# 15. Example — Tunde Cliff Jump Logic

## User idea
“Tunde stands on a snowy cliff, jumps into the air, the wind rushes around him, he spreads his hands, opens a parachute, and glides across the mountains safely.”

## AI should convert this into
### Movie summary
A short cinematic survival-action sequence showing Tunde jumping from a snowy cliff, surviving the fall by opening a parachute, and gliding across a dramatic mountain landscape.

### AI suggestions
- Genre: Action
- Storytelling Style: Cinematic or Minimal Dialogue
- Output Format: Audio + Video + Image Movie
- Production Mode: AI + Human Movie
- Outfit: black snow jacket, gloves, boots, goggles
- Parachute Color: red or red/white for visibility and contrast
- Tone: suspense to triumph
- Setting: icy mountain range, windy day
- Music: rising cinematic tension followed by heroic release

### Example scene plan
**Scene 1 — Mountain Establishing Shot**
- wide snowy mountain view
- Tunde stands near edge
- cold wind ambience
- low suspense music begins
- recommended type: image or slow image-to-video

**Scene 2 — Tension Close-Up**
- close-up on face, hands, boots at edge
- heavy breathing, snow crunch, stronger wind
- tension rises
- recommended type: image-to-video or short video

**Scene 3 — The Jump**
- side shot as Tunde leaps
- snow scatters
- sharp air-rush FX
- recommended type: video scene

**Scene 4 — Freefall**
- Tunde in open air, arms spread
- strong wind rush
- intense score rise
- recommended type: video scene

**Scene 5 — Parachute Pull**
- hand pulls cord
- parachute bursts open
- fabric snap and release sound
- recommended type: video scene

**Scene 6 — Glide Sequence**
- aerial mountain glide
- softer wind + fabric flutter
- heroic music opens up
- recommended type: video or hybrid scene

**Scene 7 — Landing / Resolution**
- landing on snow
- steady recovery
- final cinematic release
- recommended type: image-to-video or hybrid scene

This kind of structured conversion is a core MVP requirement.

---

# 16. Scene Planner — MVP

Movie Plan Draft should feed into a dedicated **Scene Planner** view.

## Purpose
This is where the movie becomes editable and production-ready.

## Each scene card should allow
- edit scene title
- edit scene description
- change duration
- swap character
- change asset type
- add/remove narration
- edit SFX notes
- edit music cue
- mark as approved
- queue for generation
- regenerate scene suggestions

## Useful controls
- move scene up/down
- duplicate scene
- split scene
- merge scenes
- add transition note
- mark continuity lock

---

# 17. Sound & Music Planning — MVP

This must be a serious part of Movie MVP.

## AI should explicitly plan
- jump sound
- wind sound
- parachute pull sound
- landing sound
- footsteps
- fabric flutter
- crowd or nature ambience if relevant
- music rise, drop, release, ending tone

## Audio planning layers per scene
- spoken voice
- narration
- SFX
- ambience
- music cue

## Music guidance examples
- suspense build
- emotional piano
- heroic cinematic swell
- African epic percussion
- children playful rhythm
- dark fantasy choir textures
- adventure pulse

## Important rule
Movie planning must include audio planning in MVP.
What is delayed is only the advanced audio workstation depth, not sound planning itself.

---

# 18. Missing Asset / Production Gap Detection — MVP

AI should warn when the movie plan references something that has no asset or no clear generation step.

## Example warnings
- Scene 3 requires cliff jump motion but no video plan exists
- Scene 5 references parachute opening but no visual setup exists
- Scene 7 needs landing sequence and final resolution shot

This should help the user resolve gaps before or during generation.

---

# 19. Generation Queue — MVP

After planning and approval, scenes move into a production queue.

## Queue behavior
Each scene can be:
- queued individually
- queued in batch
- skipped
- re-generated
- held for manual edit

## Queue metadata per scene
- scene number
- generation method
- character package used
- audio requirements
- visual engine path
- priority
- status

---

# 20. Final Assembly — MVP Basics

After scenes are generated, the system should support basic final assembly.

## Assembly should combine
- generated video scenes
- image-based scenes
- narration
- dialogue
- sound effects
- ambience
- music
- transitions
- subtitles/captions if needed

## Final assembly goals
- maintain scene order
- keep timing under target duration
- preserve basic continuity
- keep audio balanced
- allow final review before export

## Important MVP rule
Final Assembly in MVP should stay basic.
Do not build a giant advanced timeline editor yet.

---

# 21. Recommended Internal Sections / Tabs for MVP

Use a compact structure like:
- Overview
- Cast
- Scenes
- Audio
- Visual
- Generate
- Assemble

This is cleaner than too many tabs.

---

# 22. Simple Visual Flow for Movie MVP

## Flow A — New Movie
1. user enters movie idea
2. user chooses genre/style/format/mode/depth
3. user selects saved characters
4. Planner AI builds movie plan draft
5. Reviewer AI checks logic and gaps
6. user reviews movie summary + scene cards
7. user edits scenes and approves selected ones
8. scenes move into queue
9. basic final assembly happens after generation

## Flow B — Continue Existing Movie
1. user opens existing movie
2. system loads movie brief, cast, scenes, assets, and status
3. AI identifies missing scenes / continuity gaps / unfinished audio plan
4. user chooses whether to continue planning, fix, queue, or assemble
5. project resumes from current state without restarting intake

---

# 23. Main MVP Screens

1. Movie Home / Entry
2. New Movie Setup
3. Continue Existing Movie
4. Movie Brief
5. Cast Selection
6. Scene Planner
7. Audio / Sound Plan
8. Visual Plan
9. Generate Queue
10. Final Assembly
11. Review / Export

---

# 24. MVP Scope — Include Now

## Include in MVP
- New Movie flow
- Continue Existing Movie flow
- Genre / Style / Format / Production Mode / Planning Depth
- Character selection from saved characters
- AI movie plan generation
- Scene cards
- Sound plan
- Music suggestion
- Continuity warnings basic
- Per-scene generation recommendation
- Missing asset warnings basic
- Generation queue
- Final assembly basics

## Keep for later
- storyboard thumbnails
- alternate takes
- advanced timeline editing
- branching story logic
- deep collaboration and approvals
- advanced act-based long film planning
- very deep continuity intelligence

---

# 25. Recommended MVP Build Order

## Phase 1
- Movie entry point
- New Movie flow
- Continue Existing Movie flow
- Character selection
- Planner AI
- Reviewer AI
- Movie plan draft
- Scene cards

## Phase 2
- Continuity Checker Basic
- Sound Cue Planner Basic
- Audio/Visual tabs
- Missing asset warnings basic
- generation recommendation per scene

## Phase 3
- Generation queue
- Final assembly basics
- Review/export handoff

---

# 26. Product Principles to Preserve

1. Producer-first, not prompt-first
2. AI suggests, user approves
3. Existing data should be reused
4. Continue should resume, not restart
5. Plan before generate
6. Scene-by-scene clarity
7. Audio must be first-class
8. Movie only means movie only

---

# 27. Final MVP Statement

**GHS AI Movie Creator — Professional MVP** should turn a rough movie idea into a structured cast-aware, scene-aware, sound-aware movie plan that the user can review, edit, queue, and assemble scene by scene, using a simple but strong 2-AI planning system supported by basic continuity, sound-cue, and generation-strategy engines.

The defining MVP experience should be:

**Enter the movie idea, choose the cast, let GHS build the producer-grade plan, review the scenes and sound, approve the queue, and assemble the movie without chaos.**

