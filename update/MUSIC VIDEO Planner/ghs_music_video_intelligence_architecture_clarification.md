# GHS Music Video Intelligence, Dance Planning, and Motion Architecture

## Clean Clarification for Claude Code

### Purpose
This document clarifies the missing intelligence layer in GHS music video planning.

Right now, if a user inputs a song, beat, jingle, lyrics, or other audio and GHS jumps directly into video generation, the result can feel random.

The system needs a structured intelligence layer that understands the music before deciding:
- what kind of video should be made
- what kind of dance fits the song
- what kind of motion fits the beat
- what pacing the cuts should have
- where the chorus needs impact
- whether the video should lean dance, performance, lyric, story, promo, or hybrid

This missing layer is what will make music video generation feel intentional instead of accidental.

---

# 1. Core Problem

There is an architecture gap in the current music video planning.

If GHS receives:
- a full song
- instrumental
- beat
- jingle
- voice + music
- lyrics + music
- audio track for video creation

and goes straight to generation, the output may fail because the software has not yet deeply understood:
- tempo
- beat strength
- energy curve
- structure of the song
- where the chorus hits
- where the bridge calms down
- whether the music is dance-heavy or not
- whether the right visual mode is dance, lyric, story, performance, or commercial
- what type of motion should drive the visuals

So the first correction is:

**GHS must first analyze and structure the music before generation begins.**

---

# 2. Core Product Principle

For music video workflows, the correct order is:

**Audio Input → Music Analysis → Beat Mapping → Dance/Motion Planning → Recommendation Layer → Motionboard → Review → Generation**

Not:

**Audio Input → Immediate random video generation**

This means GHS needs a dedicated music intelligence layer between song input and render.

---

# 3. What the Software Should Do First

When a user inputs music or audio for a music video, GHS should run a structured analysis pass.

## Supported Source Inputs
- generated music from inside GHS
- uploaded full song
- instrumental/beat
- jingle
- narration + music mix
- lyrics + music
- voice + music
- audio selected from existing project

## First System Action
The software should perform a **music intelligence and audit pass**.

This is software responsibility, not something the user should have to break down manually.

---

# 4. Music Video Intelligence Layer

## Purpose
The Music Video Intelligence Layer is the missing engine that reads the uploaded or generated audio and converts it into structured video-planning information.

## It should extract:
- BPM / tempo
- beat pattern and strength
- rhythm profile
- energy level
- emotional tone
- likely genre feel
- intro
- verse
- pre-chorus
- chorus
- bridge
- outro
- drop points
- silence gaps
- emotional spikes
- hook moments
- danceability
- likely performance intensity
- likely commercial vs artistic tone

## Why this matters
Without this layer:
- dance selection becomes random
- scene pacing becomes weak
- cut timing misses important beats
- chorus moments have little impact
- lyric timing may feel off
- camera motion may not match the music
- visual intensity may not match the energy of the song

---

# 5. Required Music Breakdown Logic

After analysis, GHS should build a structured music profile.

## Each music profile should include:
- Project ID
- Song title or temp title
- Audio source
- Duration
- BPM / tempo range
- Genre feel
- Mood/emotional tone
- Energy curve
- Section map
- Beat map
- Hook points
- Drop points
- Danceability score
- Visual mode recommendations
- Motion intensity recommendations
- Caption/lyric notes
- Commercial potential notes
- Generation notes

## Example Music Profile
- Song: “Night Fire”
- Duration: 2:48
- BPM: 108
- Mood: energetic, confident, stylish
- Sections: intro, verse, chorus, verse, chorus, bridge, final chorus, outro
- Danceability: high
- Best fit: dance + performance hybrid
- Motion: medium-fast cut pace, strong chorus emphasis
- Visual style: colorful nightlife energy
- Commercial potential: strong for fashion or lifestyle promo edits

This music profile becomes the source of truth for generation.

---

# 6. Beat Mapping Engine

A strong part of the system must be beat understanding.

## GHS should be able to detect:
- strong beat points
- softer sections
- transitions between musical sections
- build-up moments
- beat drops
- chorus peaks
- repeated hooks
- silence or reduced-intensity moments

## Why this matters
Beat mapping affects:
- cut timing
- scene switching
- camera changes
- motion intensity
- dance emphasis
- lyric reveal timing
- chorus impact
- teaser cut extraction

If the system has no beat map, the video may look disconnected from the music.

---

# 7. Dance and Motion Intelligence Engine

## Core Question
How does GHS intelligently suggest the right dance type, beat feel, and motion style instead of just guessing?

## Required Answer
GHS needs a **Dance and Motion Intelligence Engine**.

This layer should not treat all songs the same.
It should decide what movement family and visual energy best fits the audio.

## It should infer:
- whether the song is dance-heavy
- whether the song is better for performance than dance
- whether the rhythm suggests afrobeat groove, hype cuts, soft sway, worship movement, children repetition, fashion walk, club energy, or simple promo rhythm
- how intense the movement should be
- whether the camera should move aggressively or glide softly
- where full-body dance is appropriate
- where gesture-based movement is better
- where crowd energy should replace solo performance

## Dance/Movement Families GHS Should Support
- Afrobeat groove
- Hype performance
- Romantic slow movement
- Worship expressive movement
- Children repeatable movement
- Fashion rhythm walk
- Club/high-energy cuts
- Animated dance concept
- Crowd dance energy
- Solo performance dance
- Commercial promo movement
- Product showcase rhythm cuts

## Why this matters
Without dance intelligence:
- the wrong dance type may be chosen
- visuals may feel too aggressive for soft songs
- soft songs may get over-edited
- children music may be given adult-style energy
- commercial tracks may be treated like artistic performance pieces

---

# 8. Recommendation Layer

## Purpose
Before generation, GHS should recommend the best video strategy.

## It should show the user:
- best video mode
- best dance mode
- best motion style
- best visual style
- best pacing
- best scene count
- whether narration is useful
- whether lyric mode should be included
- whether the project should be dance, performance, lyric, story, promo, or hybrid

## Example Recommendations
### Example 1: Energetic Afrobeat Song
- Best fit: Dance + performance hybrid
- Dance style: Afrobeat groove
- Scene pacing: medium-fast verse, fast chorus
- Visual style: colorful nightlife / stylish energy
- Output suggestion: full music video + 30-second social cut

### Example 2: Soft Worship Song
- Best fit: lyric + emotional performance
- Dance style: minimal expressive movement
- Motion style: soft glide and slow reveals
- Caption importance: high
- Visual style: spiritual, calm, bright atmosphere

### Example 3: Children ABC Song
- Best fit: children learning music video
- Movement type: simple repetitive gestures
- Motion style: playful but controlled
- Caption style: big and clear
- Visual style: bright, safe, educational

### Example 4: Brand Jingle
- Best fit: commercial promo video
- Dance style: light product rhythm cuts
- Motion style: strong CTA pacing, simple looping energy
- Visual style: clean, direct, branded

---

# 9. Section Planner

The system should not only detect broad structure. It should actively plan by section.

## Required section logic
For each song segment, GHS should understand:
- what part of the song it is
- how much visual energy it needs
- whether dance should intensify or reduce
- whether the captions should dominate
- whether camera movement should shift
- whether the scene should change or remain stable

## Standard section categories
- intro
- verse
- pre-chorus
- chorus
- bridge
- final chorus
- outro

## Why this matters
Different sections require different visual behavior.
A strong chorus should not be treated the same as a quiet bridge.

---

# 10. Motionboard Layer

The music video workflow needs more than a storyboard.
It also needs a **motionboard**.

## Purpose
The motionboard plans how movement evolves through the song.

## It should define:
- where visuals intensify
- where dance enters
- where camera behavior changes
- where chorus highlight moments happen
- where the bridge calms down
- where captions should reduce or increase
- where looping/repetition is useful
- where transitions should hit harder

## Why this matters
A normal storyboard explains scenes.
A motionboard explains energy and movement over time.
Both are needed for music video quality.

---

# 11. Visual Match Engine

Another major need is deciding which visual path fits the song best.

## GHS should score whether the project is best suited for:
- dance video
- performance video
- lyric video
- story video
- commercial promo video
- visualizer
- hybrid mode

## Why this matters
The user may think they want one kind of video, but the song may clearly suit another mode better.
The software should help guide that choice.

---

# 12. Choreography Suggestion Layer

GHS does not need to become a full professional choreography tool first, but it should still suggest meaningful movement logic.

## It should suggest:
- groove type
- movement family
- repetition style
- chorus signature motion
- posture style
- solo vs crowd recommendation
- body focus (full body, upper body, close-up gesture, silhouette)

## Why this matters
Dance should not be a vague button.
It should be a structured recommendation.

---

# 13. Preview and Review Workflow Before Generation

GHS should not go straight from music upload to final render.

## Required Flow
1. ingest music/audio
2. run analysis
3. build structured music profile
4. create beat map
5. create section plan
6. create dance/motion recommendations
7. create motionboard
8. show recommendation layer to user
9. let user approve or adjust
10. proceed to generation

## Review screen should show:
- detected BPM
- energy curve summary
- section breakdown
- dance recommendation
- video mode recommendation
- motion style recommendation
- preview plan
- estimated credits

## Why this matters
This protects against:
- wrong dance type
- poor beat sync
- weak chorus treatment
- wrong pacing
- mismatched visual style
- random movement patterns

---

# 14. Source of Truth Principle

The source of truth for music video generation should not be only the raw song file.

The real source of truth should become:
- structured music profile
- beat map
- section map
- energy curve
- dance/motion recommendation
- visual mode recommendation
- motionboard
- approved style choices

This keeps the system stable and reduces random generation.

---

# 15. Required System Modules

To support this workflow cleanly, GHS needs these modules.

## 1. Music Analysis Engine
Reads the song and detects tempo, energy, emotional tone, structure, and danceability.

## 2. Beat Mapping Engine
Detects beat points, peaks, drops, and timing anchors.

## 3. Section Planner
Maps intro, verse, chorus, bridge, outro, and behavior per section.

## 4. Dance and Motion Intelligence Engine
Suggests movement family, camera behavior, pacing, and intensity.

## 5. Recommendation Layer
Shows the best-fit video mode, dance type, visual style, and preview path.

## 6. Motionboard Engine
Plans movement intensity and visual behavior over time.

## 7. Choreography Suggestion Layer
Suggests groove type and movement patterns in a simplified but useful way.

## 8. Review and Approval Layer
Lets the user adjust and approve before final generation.

---

# 16. Music Video Mode Intelligence

The intelligence layer should help decide how different video modes behave.

## Dance Mode
Needs high beat sensitivity, strong motion planning, and energy-driven cuts.

## Performance Mode
Needs performer focus, gesture timing, and camera mood more than heavy choreography.

## Lyric Mode
Needs strong text timing, lyric readability, and controlled scene changes.

## Story Mode
Needs narrative visual progression and emotional pacing.

## Commercial Promo Mode
Needs CTA-friendly timing, strong rhythm cuts, and brand/product alignment.

## Children Learning Music Mode
Needs simple repetition, safe energy, bright visuals, and clear educational pacing.

---

# 17. Special Note on Children Music Video Planning

Children music video planning should not be treated like adult music planning.

## The intelligence layer should account for:
- slower comprehension needs
- simple repetition
- clear word emphasis
- safer visual pacing
- brighter and simpler motion
- highly readable captions
- repetitive dance/movement gestures
- educational rhythm reinforcement

This is important for alphabet songs, counting songs, phonics songs, and nursery music.

---

# 18. What Claude Code Needs to Think About

This is not just a UI improvement.
It is an architecture question.

Claude Code should think about:
- where music analysis happens
- where beat maps are stored
- how section plans become source of truth
- how the motionboard is represented
- how the recommendation layer reads from the analysis
- how user edits update the approved plan
- how dance mode becomes structured instead of vague
- how this fits inside Studio without making the flow messy

---

# 19. Main Clarification Question for Claude Code

We have the same architecture gap in GHS music video planning that we identified in movie/scene generation.

If a user inputs a song, beat, jingle, lyrics, or audio track, GHS should not jump directly into random music video generation.

I want GHS to do this before generation:

1. Analyze the music and build a structured music profile:
   - BPM / tempo
   - energy level
   - mood
   - genre feel
   - intro / verse / chorus / bridge / outro
   - drop points
   - silence gaps
   - rhythm strength
   - danceability
   - emotional spikes

2. Build a beat map and section map that becomes source-of-truth for music video generation.

3. Add a Dance and Motion Intelligence Engine that suggests:
   - best dance type
   - movement intensity
   - chorus energy
   - cut speed
   - camera motion style
   - whether the track is better for dance, performance, lyric, story, commercial, or hybrid mode

4. Add a recommendation layer that shows the user:
   - best video mode
   - best dance mode
   - best visual style
   - best pacing
   - scene count suggestion
   - preview plan

5. Add a motionboard layer in addition to storyboard:
   - where visuals intensify
   - where dance enters
   - where camera changes
   - where chorus highlight happens
   - where bridge calms down

6. Use this structured analysis as the source of truth for generation instead of sending raw song/audio directly into scene generation.

Main question:
How do we architect this Music Analysis → Beat Map → Dance/Motion Planner → Recommendation Layer → Motionboard → Generation pipeline cleanly inside Studio so music videos stop feeling random and become intelligently matched to the song?

---

# 20. Final Position

The real missing layer is a **Music Video Intelligence Layer**.

That layer must sit between:
**audio input** and **actual generation**

Without it:
- dance will feel random
- beat sync will feel weak
- scene pacing will feel off
- chorus moments will be underused
- lyric timing will suffer
- motion will not match the music properly

With it:
- GHS becomes a more serious music video system
- dance suggestions become meaningful
- beat-driven visuals become more accurate
- motion feels intentional
- review becomes more professional
- the user gets guided instead of guessing everything manually

This is the architecture direction that should be clarified with Claude Code.

