# GHS AI Music Video Creator — Professional MVP Orchestration Plan

We are continuing GioHomeStudio from an already-working localhost build.

This document is a shared canvas for Henry and Claude Code.

It defines the **MVP orchestration plan** for:

## GHS AI Music Video Creator — Professional

This is the **Music Video** side only.
It is separate from:
- Music Creator
- Movie
- Ad / Commercial
- AI Content Creator

This canvas focuses on the MVP system design using:
- **2 AI layers only for MVP**
- **basic non-LLM engines**
- clear visual flow
- strong preview-first workflow
- practical creator + business use

---

# 1. Product Role

GHS AI Music Video Creator is the visual extension of GHS music creation.

It should help a user move from:

**song -> analysis -> concept -> storyboard -> preview -> approval -> render -> export**

This should feel like:
- a music-to-visual storytelling studio
- a structured visual planning tool
- a creator-friendly but premium workflow

Not:
- random video generation
- one LLM prompt box
- plain slideshow maker
- chaotic clip stitching

---

# 2. MVP Product Promise

The MVP promise is simple:

**Create or import a song, let GHS understand the music, choose a visual mode, preview the concept, approve the spend, and render a usable music video or music-backed visual output.**

---

# 3. Core MVP Architecture Rule

For MVP, Music Video Creator must **not** be built as one-LLM feature.

It must use:

## 2 AI layers
### AI 1 — Primary Planner
The main storyboard and concept planner.

### AI 2 — Reviewer
The checker / critic / pacing reviewer.

## Basic non-LLM engines for MVP
### 1. Song Structure & Timing Engine — Basic
Understands rough sections like intro, body, chorus/high points, outro.

### 2. Caption / Lyric Timing Engine — Basic
Handles lyric or caption placement and timing at a usable level.

### 3. Generation Strategy Selector — Basic
Chooses the scene production path:
- image scene
- video scene
- image-to-video scene
- visualizer scene
- hybrid scene

### 4. Safety & Rights Gate — Basic
Checks for risky likeness, unsafe prompts, unauthorized identity use, and children mode safety.

This is enough for MVP.
Do not build the full later architecture yet.

---

# 4. Main MVP Studio Entry Modes

Under Studio -> Music Video, the user should clearly see entry paths such as:
- Audio to Music Video
- Lyric Video
- Visualizer
- Image and Music Video
- Image, Voice, and Music Video
- Commercial Music Video
- AI Artist Performance
- Dance Mode
- Children Music Video

## Important rule
When the user clicks a tile, take them into the correct editing flow.
Do not leave them on a dead static menu.

---

# 5. MVP Scope — Build Now

## Include in MVP
- import audio track or use music created in GHS
- music analysis basics
- visual mode selection
- concept generation
- storyboard generation
- preview-first workflow
- review inbox integration
- credit approval gate
- export to key aspect ratios
- basic narration intro/outro
- safety and rights confirmation

## Core MVP modes
### 1. Official Music Video — Basic
### 2. Lyric Video
### 3. Visualizer
### 4. Image + Music Video
### 5. Commercial Music Video — Basic
### 6. AI Artist Performance — Basic
### 7. Dance Mode — Basic
### 8. Children Music Video — Basic
### 9. Image, Voice, and Music Video — Basic

---

# 6. Keep for Later

These remain later phases:
- Audio to Text and Video deep workflow
- strong connected publishing
- advanced social auto-cuts
- advanced beat-sync engine
- team/campaign features
- very advanced manual timeline editor
- deep collaboration system

These later items should not block MVP.

---

# 7. Main Inputs for MVP

## Required inputs
- song/audio source
- title
- mood
- genre or style direction
- visual mode
- target duration or full track use
- target aspect ratio

## Optional inputs
- artist name
- lyrics
- narration intro/outro text
- one or more images
- approved artist image
- business/commercial objective
- target audience

---

# 8. AI Layer 1 — Primary Planner

## Role
The Primary Planner should:
- analyze the music at a useful level
- suggest the best video mode
- create concept direction
- create storyboard draft
- suggest scene pacing
- suggest caption/lyric handling
- suggest commercial/performance/children framing where applicable
- choose generation type per scene

## Example
User uploads an afrobeat track and chooses AI Artist Performance.

Planner should infer:
- energy = medium-high
- likely structure = intro / verse / chorus / verse / chorus / outro
- visual mode = performance-led
- scene types = close-up performance / dance cut / wide energy shot / detail shot
- pacing = stronger cuts during chorus
- styling = confident, colorful, modern

## Output from Planner
- video summary
- mode recommendation
- concept direction
- storyboard
- style direction
- scene generation recommendation
- estimated credits

---

# 9. AI Layer 2 — Reviewer

## Role
The Reviewer should:
- check if storyboard is repetitive
- check if pacing is weak
- check if chosen mode does not fit the song
- check if lyric mode is too cluttered
- check if commercial mode is too artistic or unclear
- check if children mode is too fast or visually unsafe
- check if artist performance lacks enough identity consistency
- check if the draft is too expensive for little value

## Example
If Planner creates a lyric video with too many busy cuts, Reviewer can say:
- text readability will suffer
- reduce motion during lyric-heavy lines
- reserve stronger motion for chorus transitions

## Important MVP rule
Reviewer critiques and improves. It should not restart the whole plan from zero.

---

# 10. Non-LLM Engine 1 — Song Structure & Timing Engine (Basic)

## Role
Turn raw music into usable structural timing.

## MVP support
- intro feel
- body / verse-like sections
- high-energy or chorus-like points
- outro/ending
- rough timing windows

This engine does not need full advanced beat intelligence yet.
It just needs to provide useful timing anchors for storyboarding.

---

# 11. Non-LLM Engine 2 — Caption / Lyric Timing Engine (Basic)

## Role
Place lyrics or captions in a usable timed way.

## MVP support
- full lyric display mode
- key line emphasis mode
- subtitle-only mode
- no-text mode

## Controls in MVP
- text position
- font style
- size
- reveal animation basic
- highlight color
- shadow / background strip

This should be good enough for lyric videos, worship content, and short social cuts.

---

# 12. Non-LLM Engine 3 — Generation Strategy Selector (Basic)

## Role
Choose the cheapest or strongest production path scene by scene.

## Scene production types for MVP
- image scene
- video scene
- image-to-video scene
- visualizer scene
- hybrid scene

## Example logic
- calm lyric-heavy section -> image or visualizer scene
- energetic chorus -> video or image-to-video scene
- artist identity shot -> performance-style scene
- low-cost children section -> animation/image-led scene
- commercial jingle outro -> card-based promo ending scene

This is one of the most valuable MVP engines.

---

# 13. Music Analysis — MVP Version

## Analyze for MVP
- duration
- energy level
- emotional tone
- likely genre
- intro / high points / outro feel
- whether lyrics matter strongly
- whether the track feels artistic, commercial, educational, or performance-led

## Output should include
- song profile
- visual mode suggestion
- pacing suggestion
- lyric/caption suggestion
- export suggestion

---

# 14. Concept Draft

After intake, GHS should build a **Music Video Concept Draft**.

## Concept Draft should include
1. Song summary
2. Selected mode
3. Mood / style direction
4. Visual identity
5. Storyboard summary
6. Lyrics/caption strategy
7. Narration intro/outro option if relevant
8. Scene generation recommendation
9. Estimated duration
10. Estimated credits

---

# 15. Storyboard Draft — MVP Version

## Purpose
Break the music into visual sections before rendering.

## Each scene card should include
- Scene Number
- Scene Title
- Scene Purpose
- Target Duration
- Visual Description
- Style / Mood
- Movement Type
- Caption / Lyric behavior
- Source assets if used
- Generation Method
- Status

## Scene statuses
- planned
- preview ready
- approved
- generating
- generated
- needs edit
- blocked

## Editable actions
- edit scene
- change order
- duplicate scene
- shorten scene
- regenerate scene suggestion
- approve scene
- queue scene

---

# 16. Core MVP Video Modes

## 16.1 Official Music Video — Basic
Use for:
- emotional songs
- artistic songs
- worship songs
- cinematic releases

### Visual logic
- story-driven or mood-driven scene flow
- moderate scene changes
- cinematic framing
- final usable export

## 16.2 Lyric Video
Use for:
- text-forward songs
- songwriting demos
- worship/gospel songs
- lower-cost official release alternative

### Visual logic
- lyrics clearly readable
- less cluttered background motion
- stronger text emphasis

## 16.3 Visualizer
Use for:
- quick lower-cost audio visuals
- branded YouTube uploads
- beat videos
- simple release visuals

### Visual logic
- waveform / animated background
- rhythm-responsive motion feel
- branding support if needed

## 16.4 Image + Music Video
Use for:
- one or more still images
- poster-to-video flow
- low-cost visual storytelling
- mood visuals

### Visual logic
- image-led sequence
- subtle motion or animated transitions
- caption optional

## 16.5 Commercial Music Video — Basic
Use for:
- product jingles
- property music promo
- fashion promo music
- event or church promo music

### Visual logic
- commercial framing
- CTA ending card option
- brand tone
- shorter sharper structure

## 16.6 AI Artist Performance — Basic
Use for:
- approved artist/performer images
- character platform assets already inside GHS
- performance-style visual identity

### Visual logic
- performance shots
- artist image consistency
- stage/studio/identity framing

Important:
Require rights confirmation for real identifiable people.

## 16.7 Dance Mode — Basic
Use for:
- energetic songs
- afrobeat / party visuals
- social-friendly performance cuts

### Visual logic
- rhythm-led movement feel
- energetic scene pacing
- short visual punch scenes

Important:
This is a **mini/basic** version, not full choreography intelligence.

## 16.8 Children Music Video — Basic
Use for:
- alphabet songs
- counting songs
- phonics songs
- colors / shapes songs
- nursery songs
- animal learning songs

### Visual logic
- bright visuals
- safe pacing
- clear subtitles/lyrics
- simple animation-style scenes
- educational repetition

Important:
This is a **basic animation-style learning mode**, not a huge children platform.

## 16.9 Image, Voice, and Music Video — Basic
Use for:
- guided visual storytelling
- narrated promo/music hybrids
- voice-framed music visuals

### Visual logic
- image-led scenes
- narration intro/outro or guidance
- music-supported pacing

---

# 17. Simple Visual Flow for Music Video MVP

## Flow A — Official Music Video
1. user imports/selects song
2. Planner AI analyzes track
3. Planner builds concept + storyboard
4. Reviewer checks pacing and logic
5. user reviews preview plan
6. approve selected scenes or full render
7. final output renders

## Flow B — Lyric Video
1. user imports song and lyrics
2. Planner AI builds lyric video concept
3. lyric timing engine places text structure
4. Reviewer checks readability and pacing
5. user reviews
6. approve render
7. lyric video output returns

## Flow C — Image + Music Video
1. user selects song
2. user selects one or more images
3. Planner builds image-led scene structure
4. strategy selector chooses image / image-to-video / hybrid per scene
5. user reviews
6. approve render
7. final visual music output returns

## Flow D — AI Artist Performance
1. user selects song
2. user selects approved artist/character image
3. Planner builds performance-based storyboard
4. Reviewer checks consistency and fit
5. user reviews
6. approve render
7. performance-style output returns

## Flow E — Children Music Video
1. user selects children mode
2. user selects song type such as ABC, numbers, phonics, or nursery
3. Planner builds safe bright storyboard
4. Reviewer checks simplicity and child-safe pacing
5. user reviews
6. approve render
7. children music video output returns

---

# 18. Examples

## Example 1 — Afrobeat Performance Video
User selects an upbeat afrobeat track and chooses AI Artist Performance.

System should produce:
- performance-led concept
- stage/street-style mood
- stronger motion in chorus
- artist identity consistency
- short vertical-friendly cut option later

## Example 2 — Worship Lyric Video
User uploads a worship song with lyrics.

System should produce:
- calm glowing lyric visuals
- readable text timing
- emotional light-based scenes
- reduced motion during important lines

## Example 3 — Property Promo Jingle
User uploads a short property jingle and chooses Commercial Music Video.

System should produce:
- premium visual framing
- property-focused scene structure
- CTA ending card option
- short strong promo flow

## Example 4 — ABC Song
User chooses Children Music Video and selects alphabet song.

System should produce:
- bright letter-led visual plan
- simple learning repetition
- safe colors and pacing
- lyric clarity

---

# 19. Narration and Intro/Outro — MVP Version

## Use cases
- introducing the song
- artist announcement
- product promo lead-in
- CTA ending line
- children learning guidance opening

## Voice options
- standard AI voice
- user approved voice if available

Important:
Narration in MVP is support framing, not singing over the track.

---

# 20. Review-First Rule

## Product principle
No heavy render should happen before the user sees a preview plan.

## Approval screen should show
- song source
- selected mode
- mood/style
- storyboard summary
- lyric/caption strategy
- narration option
- estimated duration
- estimated credits
- current balance

User actions:
- approve
- edit plan
- change mode
- regenerate storyboard
- save for later
- cancel

---

# 21. Credit Gate — MVP Version

## Rule
No hidden spend.

## Logic
- preview plan first
- estimated cost visible
- approve before final generation
- if credits are low, request top-up
- log charges clearly

---

# 22. Review Inbox Integration

## Statuses for MVP
- Draft Created
- Storyboard Ready
- Preview Ready
- Awaiting Approval
- Awaiting Credit Top-Up
- Rendering
- Ready to Export
- Failed
- Blocked for Safety
- Blocked for Rights

## Actions
- approve
- reject
- edit storyboard
- change style
- change mode
- change lyrics behavior
- add/remove narration
- regenerate scene
- export

---

# 23. Safety & Rights Rules

The system must block or flag:
- unsafe sexual or exploitative prompts
- unauthorized celebrity or artist cloning
- deceptive impersonation
- unauthorized real-person likeness use
- unsafe children content
- risky voice misuse

## Rights confirmation needed for
- third-party performer images
- artist likeness use
- non-user voice cloning
- brand-owned assets without clear rights

---

# 24. Output Types for MVP

## Main outputs
- full horizontal video
- vertical short/reel version
- square version
- lyric version
- visualizer version
- teaser cut if practical
- WhatsApp status cut if practical

## Optional nice additions
- thumbnail image
- subtitle file
- upload-ready text later

---

# 25. Main MVP Screens

1. Music Video Studio Home
2. New Music Video Project Setup
3. Song Import / Song Selection
4. Music Analysis View
5. Visual Mode Picker
6. Storyboard Editor
7. Lyrics / Captions Editor
8. Narration Setup
9. Preview Panel
10. Review Inbox
11. Export Screen
12. Safety & Rights Notice if needed

---

# 26. Recommended MVP Build Order

## Phase 1
- Music Video section routing
- Audio to Music Video
- Official Music Video basic
- Lyric Video
- Visualizer
- Planner AI
- Reviewer AI
- Storyboard draft flow
- Preview-first screen

## Phase 2
- Image + Music Video
- Generation Strategy Selector Basic
- Caption/Lyric Timing Engine Basic
- Credit approval gate
- Export logic

## Phase 3
- Commercial Music Video basic
- AI Artist Performance basic
- Dance Mode basic
- Children Music Video basic
- Image, Voice, and Music Video basic
- Review Inbox improvements

---

# 27. Product Principles to Preserve

1. Music must drive the visuals
2. Planner-first, not random generation
3. Review before heavy render
4. User approval before major spend
5. Structured storyboard over chaos
6. Artistic + commercial modes can coexist
7. Children mode must stay safe
8. Music video creation should feel inspiring, not stressful

---

# 28. Final MVP Statement

**GHS AI Music Video Creator — Professional MVP** should let a user create or import a song, choose a visual mode, generate a storyboard and preview, approve credit use, and render a usable music video or music-backed visual output using a simple but strong 2-AI orchestration system supported by basic timing, caption, generation-strategy, and safety engines.

The defining MVP experience should be:

**Create or import the music, let GHS understand it, choose how it should look, preview the plan, approve the spend, and get a polished visual output without chaos.**

