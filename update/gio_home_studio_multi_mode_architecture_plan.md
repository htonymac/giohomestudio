# GioHomeStudio — Multi-Mode Architecture Plan

## Core idea

GioHomeStudio should not be treated as many disconnected mini-products.
It should be built as **one AI media assembly engine** with multiple output modes.

The real system flow is:

**Interpret -> Plan -> Generate assets -> Sync on timeline -> Review -> Final render**

That same engine should power all the major modes:
- Text to Video
- Text to Audio
- Video to Video
- Text to Images + Audio
- Text to Video for key action parts + Audio

---

## Product definition

GioHomeStudio is not just a text-to-video app.
It is an **AI-directed storytelling and content assembly system**.

The user should be able to:
- type text
- choose settings
- let AI assemble the work automatically
- review the result
- replace parts if needed
- approve the final output

The system should be modular, provider-based, and handoff-focused.

---

## The correct mental model

Do not think of GioHomeStudio as:
- one page that sends a prompt to Kling
- one page that sends text to ElevenLabs
- one page that randomly merges media

Think of it as:

### 1. A supervisor
A brain that decides what needs to happen.

### 2. A timeline engine
A system that places narration, dialogue, images, clips, music, and sound effects in the right sequence.

### 3. A worker system
Specialized modules that each do one job well.

### 4. A finishing desk
A review area where the user can fix, replace, regenerate, and finalize output without restarting everything.

---

# Part 1 — The five main output modes

## 1. Text to Video

### What it means
The user types text, applies settings, and the software produces a full video in Free Mode based on those settings, using video providers such as Kling, Runway, or other future tools.

### Example use cases
- cinematic story scene
- short promo clip
- ad visual
- emotional storytelling moment
- hero reveal

### Required flow
1. user enters text
2. user selects settings such as:
   - character identity
   - style
   - video type
   - aspect ratio
   - provider
   - duration
   - narration/music preferences
3. supervisor interprets the request
4. prompt enhancement produces structured visual instructions
5. video worker generates clip
6. audio workers generate narration, dialogue, music, and SFX if needed
7. timeline engine merges everything
8. result goes to review

### Important design note
Text to video should not mean “one prompt in, one random clip out.”
It must respect identity, style, culture, voice, sound, and timing.

---

## 2. Text to Audio

### What it means
This has nothing to do with Kling.
The user types text and audio is generated with narration, dialogue, music, and sound effects where needed.
This should be handled mainly by local LLM planning plus voice/audio workers.

### Example use cases
- audiobook
- radio drama
- podcast scene
- narrated story
- spoken ad
- myth/legend storytelling

### Required flow
1. user enters text
2. supervisor decides:
   - narration only?
   - narration + dialogue?
   - narration + music?
   - narration + SFX?
3. script is broken into beats
4. dialogue is separated from narration
5. speaker voices are assigned
6. environment sounds are selected
7. music is selected if needed
8. audio is merged and exported as MP3 or WAV

### Why this matters
This is cheaper than full video and can become one of the strongest parts of GioHomeStudio.

---

## 3. Video to Video

### What it means
The user brings an existing video and the system updates or enhances it.

### Example use cases
- add narration to an existing silent clip
- replace weak music
- improve emotional pacing
- add cinematic sound design
- trim and restructure a raw clip
- convert rough footage into polished content

### Required flow
1. user uploads source video
2. user describes what should change
3. supervisor decides transformation plan
4. system runs one or more of:
   - restyle path
   - trim path
   - subtitle path
   - voiceover path
   - music replacement path
   - SFX enhancement path
5. review page shows transformed result

### Important note
Video to video is transform mode, not just generation mode.

---

## 4. Text to Images + Audio

### What it means
The user inputs text and gets audio with images displaying in real-time rhythm with the narration.
This must not become a random slideshow.

### Example use cases
- storybook mode
- myth narration with image progression
- product explanation with image sequence
- history lesson mode
- low-cost story content

### Required flow
1. user enters text
2. supervisor breaks the story into beats
3. each beat gets:
   - narration segment
   - dialogue if needed
   - image prompt
   - duration
   - optional sound cues
4. image worker generates one image per beat or per scene
5. narration/dialogue is generated
6. timeline engine aligns images exactly to the related narration timing
7. final output becomes audio + timed image sequence

### Important rule
Images must follow the real timing of the audio, not random switching.

---

## 5. Text to Video in key action parts + Audio

### What it means
This is the hybrid storytelling mode.
Not all moments need full video.
Only action or necessary scenes become real video, while other parts use timed images + audio.

### Example use cases
- expensive cinematic story with limited budget
- battle scene only as video, rest as audio+image
- magic reveal as video, setup as stills+voice
- product hero moment as video, explanation as image+audio

### Required flow
1. supervisor breaks the story into beats
2. each beat is classified as:
   - still image beat
   - action video beat
   - narration-only beat
   - dialogue beat
3. only selected action beats are sent to Kling/Runway
4. still beats use image generation
5. all beats are assembled on one timeline
6. narration, dialogue, music, and SFX are merged across the whole piece
7. final output feels cinematic without requiring video generation for every second

### Why this matters
This is likely one of the smartest cost-saving modes in the whole product.

---

# Part 2 — The architecture needed to support all modes

## A. Local LLM Supervisor / Director

This should be the orchestration brain of Free Mode and later other modes.

### What it does
The supervisor should:
- read the user prompt
- read selected controls
- classify the request
- choose the correct output mode
- decide whether video is needed
- decide whether audio-only is enough
- decide whether image beats are enough
- decide whether dialogue exists
- decide whether narration is needed
- decide whether music is needed
- decide whether sound effects are needed
- decide which provider should run
- decide fallback order
- store the plan

### Important architecture rule
The app should not depend on personal web subscriptions as backend infrastructure.
The right structure is:
- local LLM supervisor first
- provider modules second
- optional API escalation later

### Example outputs of the supervisor
The supervisor plan should include fields such as:
- content intent
- inferred mode
- narration need
- dialogue need
- music need
- SFX need
- inferred style
- inferred identity/culture hints
- inferred aspect ratio
- provider recommendation
- fallback plan
- confidence
- notes

---

## B. Timeline Engine

This is one of the most important missing foundations.

Without a timeline engine, the system will always feel random.

### What it should coordinate
- narration start/end times
- dialogue clip placement
- image beat durations
- video segment placement
- music bed timing
- music ducking under speech
- SFX cue timing
- scene transitions
- final output render

### Example timeline
- 0:00–0:05 narration intro
- 0:02 thunder sound
- 0:05–0:10 image beat 2
- 0:07 child dialogue line
- 0:10–0:15 action video clip
- 0:15–0:20 market ambience + narration

### Output of timeline engine
A structured render plan that FFmpeg or later render tools can assemble reliably.

---

## C. Worker System

The supervisor should assign work to specialized workers.

### Minimum workers
- Prompt worker
- Script/beat parser
- Video worker
- Image worker
- Narration worker
- Dialogue voice worker
- Music worker
- SFX worker
- Merge/render worker
- Review preparation worker

### Why this matters
Each worker should do one thing well.
This avoids one giant messy pipeline doing everything badly.

---

## D. Asset Registry

Everything should be saved as assets.

### Asset types to store
- original prompt
- enhanced prompt
- narration script
- dialogue script
- beat structure
- character profiles
- image prompts
- generated images
- generated video clips
- voice files
- dialogue files
- music files
- SFX files
- final merged output
- versions
- notes
- provider usage

### Why this matters
This is what makes review, replace, re-merge, and reuse possible.

---

## E. Review / Finishing Desk

Review must become the actual working desk, not just a display page.

### User should be able to
- preview video/audio
- edit narration script
- replace voice
- replace music
- upload new audio assets
- regenerate only voice
- regenerate only music
- re-merge using same video
- replace image beat
- revise in Studio
- approve
- reject
- keep history

### This is how handoff becomes real
The user should not have to restart the whole process because one voice or music choice is wrong.

---

# Part 3 — Multi-voice dialogue system

## Why this is needed
If a story contains narration plus 2 or 3 speaking people, the software should not read everything in one narrator voice.

### Example
Narrator: “They moved toward the room and opened the door.”
Boy: “Daddy, I am hungry.”
Father: “Let me get you some food.”

This requires at least three voices:
- narrator
- boy
- father

## Required components

### 1. Speaker parser
Detect:
- quoted dialogue
- speaker turns
- named lines
- narration blocks

### 2. Voice assignment system
Assign:
- narrator voice
- character A voice
- character B voice
- character C voice

### 3. Character voice registry
Each character profile should allow:
- name
- age
- gender/voice class
- tone type
- language/dialect
- provider voice ID
- narrator or character flag
- preview sample

### 4. Dialogue render path
Each speaker line becomes its own generated audio segment and is placed on the timeline in sequence.

---

# Part 4 — Language, dialect, and accent support

## Needed direction
Narration should not be English-only forever.

### Important supported categories to plan for
- English
- Nigerian Pidgin
- Yoruba
- Igbo
- Hausa
- plus other supported languages

### Important honesty rule
The UI must distinguish between:
- supported now
- experimental
- unsupported on active provider

Do not pretend dialect support is complete if the provider cannot truly deliver it well.

### Accent/region handling
Voice selection UX should also group options by:
- American
- African
- British
- others

And by category:
- man
- woman
- boy
- girl

And by tone:
- bass
- tenor
- soft
- commanding
- elder
- youthful

---

# Part 5 — Sound effects / environment sound layer

## Why this matters
A narration scene becomes far more believable when the audio layer understands events.

Example:
If narration says:
- thunder cracks
- dust swirls
- shields rise
- warriors march

The system should know that this implies:
- thunder sound
- wind swirl sound
- shield/armor movement sound
- footsteps or marching ambience

## Required system

### Audio Events / SFX layer
This should support categories like:
- rain
- storm
- thunder
- wind
- shield clash
- sword fighting
- gunshot
- footsteps/running
- kicks/hits
- horse movement
- baby cry
- crowd/market ambience
- door open/close
- can/object dropping

### What the supervisor should do
- detect likely sound events from story text
- map them to SFX categories
- choose whether environment sound is needed
- store the cue plan

### What the timeline engine should do
Each cue should have:
- label
- category
- approximate timing
- volume
- ducking rule
- loop or one-shot state

### Controlled rollout rule
Start with stock/manual SFX library and cue planning.
Do not try to fake full cinematic automatic sound design before the structured base exists.

---

# Part 6 — Audio-only mode

## Why this matters
Not every story needs video.
Sometimes video is too expensive.
Sometimes the product should output a strong MP3/WAV only.

### Audio-only mode should support
- narration
- dialogue
- music
- environment sound
- review and approval
- export MP3/WAV

### User-visible options should include
- Video + Audio
- Audio Only
- Video Only

### This is a strategic mode
Audio-only mode gives GioHomeStudio a cheaper storytelling path and keeps the product useful even when video credits are low.

---

# Part 7 — Text to Images + Audio rhythm system

## The real challenge
Images must align with narration timing.

### Correct approach
1. supervisor parses story into beats
2. each beat gets a duration
3. audio is segmented accordingly
4. image prompt is generated for each beat
5. images are displayed exactly when those beats occur

### Example
Beat 1: “The villagers gathered outside the sacred hut.”
- duration: 4 seconds
- image 1

Beat 2: “Thunder rolled over the hills.”
- duration: 3 seconds
- image 2
- thunder SFX

Beat 3: “The child opened his eyes.”
- duration: 4 seconds
- image 3
- low rumble SFX

This creates rhythm between image and sound.

---

# Part 8 — Hybrid action mode

## The business value
Full text-to-video for every second is expensive.
Hybrid action mode saves money.

### How it should work
The supervisor decides which beats need real motion video and which beats can stay image-based.

### Beat categories
- narration-only beat
- image beat
- action video beat
- dialogue beat
- transition beat

### Example sequence
- 0:00–0:06 still images + narration
- 0:06–0:10 action video of warriors raising shields
- 0:10–0:18 narration + images
- 0:18–0:22 action video of magical aura rising

This is likely one of the strongest production modes for the product.

---

# Part 9 — Video to video mode

## Needed structure
This mode should update existing videos rather than always generating from scratch.

### User actions may include
- add narration
- replace voice
- replace music
- add SFX
- restyle tone
- trim/re-sequence
- add subtitles
- create short version

### Required review behavior
The user should be able to preview the transformed result and re-merge without redoing unrelated parts.

---

# Part 10 — Recommended build order

## Stage 1 — Finish Free Mode strongly
Focus on:
- supervisor hardening
- review finishing desk
- text to audio
- audio-only export
- multi-voice MVP
- environment/SFX cue planning
- voice/music/SFX preview

## Stage 2 — Text to Images + Audio
Focus on:
- beat parser
- image per beat generation
- timeline-synced visual rhythm
- story slideshow/video output

## Stage 3 — Hybrid action mode
Focus on:
- beat classification
- selective video generation
- mixed media timeline assembly

## Stage 4 — Video to video
Focus on:
- transform workflows
- replace/trim/revoice paths

This order is cheaper, cleaner, and less risky than trying to finish all modes at once.

---

# Part 11 — What the user experience should become

## In Free Mode
The user should be able to:
1. type prompt
2. choose mode or allow auto mode
3. choose settings
4. click Assemble in Auto Mode
5. see the supervisor plan
6. generate assets
7. review output
8. replace only the wrong parts
9. approve final output

## The handoff promise
The user should not need to manually orchestrate every tool.
That is the job of the supervisor and pipeline.

---

# Part 12 — Final strategic truth

The real product is not simply “text to video.”

The real product is:

**AI-directed story and content assembly with multiple output modes.**

That means the architecture should always stay centered on:
- one supervisor
- one timeline engine
- one asset system
- one review desk
- many output modes

That is how GioHomeStudio can cleanly support:
- text to video
- text to audio
- video to video
- text to images + audio
- text to action-video in key parts + audio

without becoming a confused mess.

---

# Part 13 — Immediate next engineering target

The next serious engineering target should be:

## Free Mode Finalization + Narrative Audio Director

This should include:
- stronger supervisor planning
- audio-only mode
- multi-voice dialogue
- SFX/environment cue system
- better review-page editing
- voice/music/SFX preview
- final merge reliability

Once that is strong, the next major stage should be:

## Text to Images + Audio timeline mode

Then after that:

## Hybrid action-video mode

That path gives GioHomeStudio the strongest foundation for the future.

