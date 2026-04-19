# GHS AI Movie Creator — Full Product Spec

## Purpose
Build **AI Movie Creator** inside GioHomeStudio as a **movie-only planning and generation system**.

This is **not** for ads/commercials.
This is **not** the general AI Content Creator.
This is **not** the Music Video tool.

AI Movie Creator should help a user go from:

**rough movie idea → character selection → producer-grade movie plan → scene plan → audio plan → generation queue → final assembly**

The system should behave like an **AI movie producer/director assistant**, not just a prompt box.

---

## Hard Product Boundaries

### This section is for MOVIE only
Keep these as separate entry points in GHS:
- Ad / Commercial
- Music Video
- AI Content Creator

Do **not** mix ad logic into AI Movie Creator.
Do **not** place commercial CTA logic inside Movie.
Do **not** make Movie depend on ad structure.

### Narrated Story is NOT a movie type
Do not use "Narrated Story" as a main movie type.
Narration belongs under **Storytelling Style**.

### Continue flow must be different from New Movie flow
If user clicks **Continue Existing Movie**, do **not** ask all setup questions again unless required data is missing.
Continue should load existing movie context and move directly into planning/recovery/continuity/generation work.

---

# Product Positioning

## What AI Movie Creator should feel like
The tool should feel like:
- a **movie planning system**
- an **AI director layer** above image/audio/video tools
- a **scene and sound organizer**
- a **producer assistant** that suggests useful details and fills gaps intelligently

It should not feel like:
- one empty prompt box
- random generation without planning
- a basic text-to-video shortcut

---

# Main User Paths

## Path 1 — New Movie
Use this when the user wants to start a movie from scratch.

Flow:
1. Enter movie idea
2. Choose planning settings
3. Choose saved characters
4. AI builds movie plan
5. User reviews and edits
6. Save movie plan
7. Generate scene-by-scene or queue all
8. Assemble final output

## Path 2 — Continue Existing Movie
Use this when the user already has an existing movie project.

Flow:
1. Load existing movie project
2. Load previously selected characters
3. Load saved scenes
4. Load generated assets and missing assets
5. Load narration/audio/music/FX status
6. Open Scene Planner directly
7. AI asks what should happen next:
   - continue planning
   - fix continuity
   - expand missing scenes
   - prepare generation
   - rework sound/music
   - assemble final movie

### Continue flow rule
If project already has core data, do not restart the intake process.
Only ask for missing pieces.

Example AI behavior:
> I found 10 scenes, 2 assigned characters, 1 narration draft, and 6 visual assets. Do you want me to continue scene planning, fix continuity, or prepare generation?

---

# Correct Planning Model
Do **not** use one weak field called only **Movie Type**.

Separate the movie planning into these layers:

## 1. Story Genre
This defines the story world and emotional logic.

Options:
- Children Story
- Short Story
- Action
- Western
- African Cinema
- Epic Fantasy
- Mythology
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

### Special note: Game of Thrones type
For "Game of Thrones type", the main user-facing genre should be:
- **Epic Fantasy**

Optional hidden or advanced AI tags:
- dark fantasy
- political fantasy
- royal conflict
- medieval world
- power struggle

## 2. Storytelling Style
This defines how the movie is told.

Options:
- Cinematic
- Dialogue Driven
- Narrated
- Voiceover Led
- Minimal Dialogue
- Visual Only
- Documentary Style
- Music Led

## 3. Output Format
This defines the production pipeline and helps manage cost and generation strategy.

Options:
- Audio Only Movie
- Audio + Image Movie
- Audio + Video + Image Movie
- Video First Movie
- Image-to-Video Hybrid

### Meaning of each format
**Audio Only Movie**
- for radio drama, sound-led stories, voice performance, immersive audio storytelling

**Audio + Image Movie**
- for low-cost story movies, narrated visual stories, children stories, simple scene-based storytelling

**Audio + Video + Image Movie**
- hybrid mode
- use still images for calm/static scenes
- use video for action scenes
- smart balance of quality and cost

**Video First Movie**
- strong motion-focused production
- use more generated video than images

**Image-to-Video Hybrid**
- use image generation first, then animate selected scenes
- useful when cost control and continuity matter

## 4. Production Mode
This defines how much AI controls versus how much the user edits manually.

Options:
- AI Generated Movie
- AI + Human Movie
- Manual Assisted Movie

### Meaning of each mode
**AI Generated Movie**
- AI plans most of the movie automatically
- user mainly reviews and approves

**AI + Human Movie**
- AI does heavy planning and suggestions
- user edits important creative decisions before generation

**Manual Assisted Movie**
- user drives scene design manually
- AI helps with continuity, structure, sound, assets, and generation support

## 5. Planning Depth
This controls how detailed the planning should be.

Options:
- Quick Plan
- Smart Plan
- Full Producer Plan

### Meaning
**Quick Plan**
- short outline
- few scenes
- light suggestions

**Smart Plan**
- better scene logic
- sound and style suggestions
- usable for fast production

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

# New Movie Intake Screen
For **New Movie**, ask only what matters.

## Basic Inputs
- Movie Title
- One-line Movie Idea
- Expanded Story Description
- Estimated Duration
- Language

## Creative Inputs
- Story Genre
- Storytelling Style
- Output Format
- Production Mode
- Planning Depth
- Tone / Mood
- Setting / World
- Intended audience

### Tone / Mood examples
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

### Setting / World examples
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

# Character Integration
The Character panel already exists. AI Movie Creator must use it deeply.

## Character behavior
After movie idea + planning selections, AI should ask:
- Who is the lead?
- Which saved character should be used?
- What role does each character play?

### Role examples
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
- any linked images/reference assets

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

# Core Product Brain: Movie Plan Generator
After intake and character selection, AI should automatically generate a structured **Movie Plan Draft**.

## The draft must include
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

# Movie Plan Structure

## A. Movie Summary
A short producer summary of the story.

## B. Story Arc
Simple narrative arc, such as:
- setup
- tension
- climax
- resolution

For longer movies, later versions may support:
- act 1
- act 2
- act 3

## C. Scene Breakdown
Every scene should be created as a structured scene card.

Each scene card should contain:
- Scene Number
- Scene Title
- Scene Goal
- Start/End or Duration
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
Audio must not be treated as one single thing.
It should be planned in layers.

### Audio layers
1. Dialogue / performance voice
2. Narration / voiceover
3. Sound effects
4. Atmosphere / ambience
5. Music

## E. Visual Plan
Plan the visual side scene by scene.
Include:
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
AI should decide how each scene should be produced.
Possible scene production types:
- image scene
- video scene
- image-to-video scene
- audio-only bridge scene
- hybrid scene

This matters for cost and smart pipeline behavior.

---

# Example: Tunde Cliff Jump Movie Logic
This example should guide the behavior of the system.

## User idea
“Tunde stands on a snowy cliff, jumps into the air, the wind rushes around him, he spreads his hands, opens a parachute, and glides across the mountains safely.”

## AI should convert this into:

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

This kind of structured conversion is a core requirement.

---

# AI Suggestion Engine
The AI should not wait for the user to describe every tiny production detail.
It should intelligently suggest useful details based on the movie idea and character profile.

## AI should suggest things like
- outfit
- costume color
- props
- vehicle/object details
- weather
- lighting
- camera style
- pacing
- sound choices
- music style
- scene order improvements
- stronger opening or ending

## Example
If the movie contains a parachute jump, AI can suggest:
- red parachute for visual clarity
- high wind ambience
- strong whoosh on jump
- tighter close-up before leap
- wider aerial shot after parachute opens

The user can then:
- accept all
- edit selected items
- regenerate suggestions

---

# Continue Existing Movie Behavior
When user selects **Continue Existing Movie**, AI Movie Creator must act like a recovery and production continuation system.

## It should load
- existing movie brief
- existing scene list
- existing cast assignments
- existing audio items
- existing generated assets
- failed/missing scenes
- continuity notes
- generation history if available

## AI should then offer actions like
- continue planning
- fill missing scenes
- refine cast/roles
- update visual direction
- rebuild sound plan
- generate remaining scenes
- reassemble final movie
- fix continuity issues

## Continue rules
- do not restart the user from zero
- do not ask for genre/style again if already saved
- do not ask for character identity again if already assigned
- ask only where information is missing or inconsistent

---

# Scene Planner
Movie Plan Draft should feed into a dedicated **Scene Planner** view.

## Scene Planner purpose
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

# Sound & Music Planning
This must be a serious part of AI Movie Creator.

## The AI should explicitly plan:
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

## Important product rule
Do not make the user manually invent every sound.
AI should suggest the sound design plan scene-by-scene.

---

# Cost-Aware Production Logic
Because GHS mixes image, video, and audio tools, the planner should help choose cheaper smart paths.

## Example logic
For **Audio + Video + Image Movie**:
- static talking scenes can be image-based
- high-action scenes can be video-based
- transition scenes can use image-to-video
- narration can carry low-motion moments

This is a strong cost-saving and production-strength feature.

## AI should mark recommended generation mode per scene
Examples:
- cheap
- balanced
- premium

Or translate internally into selected engines / workflows later.

---

# Continuity System
AI Movie Creator should help keep the movie consistent.

## Continuity checks should detect
- character outfit changes by mistake
- prop changes by mistake
- location inconsistency
- weather inconsistency
- voice inconsistency
- age/look mismatch
- scene order logic issues
- missing bridge scene between two strong jumps

## Example warnings
- Tunde wears a black jacket in Scene 1 but red armor in Scene 4 without explanation
- the parachute changes color between scenes
- mountain snow becomes desert without transition
- voice accent changes unexpectedly

This adds premium intelligence to the movie workflow.

---

# Missing Asset / Production Gap Detection
AI should warn when the movie plan references something that has no asset or no clear generation step.

## Example warnings
- Scene 3 requires cliff jump motion but no video plan exists
- Scene 5 references parachute opening but no visual setup exists
- Scene 7 needs landing sequence and final resolution shot

AI should help resolve those gaps before or during generation.

---

# Generation Queue
After planning and approval, AI Movie Creator should move scenes into a production queue.

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

# Final Assembly
After scenes are generated, the system should support final assembly logic.

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
- preserve continuity
- keep audio balanced
- allow final review before export

---

# Recommended Internal Sections / Tabs
For AI Movie Creator, use a structure like this:

- Overview
- Movie Brief
- Cast
- Scene Planner
- Sound & Music
- Visual Plan
- Generate Queue
- Final Assembly

Or shorter labels if needed:
- Overview
- Cast
- Scenes
- Audio
- Visual
- Generate
- Assemble

---

# Sidebar / Navigation Recommendation
Since Movie is its own serious tool, it can live as a top-level creative path under Create or Studio.

Recommended top-level entries remain separate:
- Movie
- Music Video
- Ad / Commercial
- AI Content Creator

Inside Movie-related navigation, use:
- Movie Planner
- Cast
- Scene Planner
- Sound & Music
- Asset Library
- Review Queue

---

# UX Principles

## 1. Producer-first, not prompt-first
AI Movie Creator must feel like a structured film planning system.

## 2. AI suggests, user approves
User should not need to invent every tiny detail.
AI should suggest useful production details.

## 3. Existing data should be reused
If a character or movie project already exists, reuse it.

## 4. Continue should resume, not restart
Existing project work must be loaded intelligently.

## 5. Plan before generate
Always structure movie logic before generation where possible.

## 6. Scene-by-scene clarity
The user should always understand what each scene is doing.

## 7. Audio must be first-class
Movie planning must include audio planning, not treat it as an afterthought.

## 8. Movie only means movie only
Do not pollute this section with commercial/ad logic.

---

# MVP Scope Recommendation
Start with a strong MVP, not every advanced filmmaking feature at once.

## MVP should include
- New Movie flow
- Continue Existing Movie flow
- Genre / Style / Format / Production Mode / Planning Depth
- Character selection from saved characters
- AI movie plan generation
- Scene cards
- Sound plan
- Music suggestion
- Continuity warnings
- Per-scene generation recommendation
- Generation queue
- Final assembly basics

## Later versions can expand into
- act-based long film planning
- storyboard thumbnails
- multi-version alternate takes
- advanced timeline editing
- branching stories
- deeper collaboration and approvals

---

# Final Product Summary
AI Movie Creator in GHS should be a **movie-only AI planning and production system** that:
- starts with a rough movie idea
- uses saved characters from the Character panel
- intelligently suggests visuals, sounds, props, and pacing
- creates a producer-grade movie plan
- breaks the movie into structured scenes
- plans audio properly
- helps manage continuity and missing assets
- supports cost-aware generation strategy
- lets the user continue existing movie projects without restarting
- sends approved scenes into generation and final assembly

This should feel like an **AI movie producer/director workflow**, not a generic content generator.

