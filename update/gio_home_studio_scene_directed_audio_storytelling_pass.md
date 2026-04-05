# GioHomeStudio — Scene-Directed Audio Storytelling Pass

We are continuing GioHomeStudio from an already-working localhost build.

This canvas is an instruction document for Claude Code.

The purpose of this pass is to make GioHomeStudio capable of producing **scene-directed emotional audio**, not just simple narration plus background music.

---

## Main goal

Build a controlled **Scene-Directed Audio Storytelling Layer** for Free Mode and Audio Mode.

The system must be able to handle scenes like:
- remembrance
- whisper
- car driving
- emotional talk
- shooting scene tension
- fitting environmental sound
- silence and pauses for emotion

This should work in a way that feels intentional, layered, and cinematic.

The user should not have to manually assemble every single sound.
The system should interpret the scene, build an audio plan, generate or select the right layers, and let the user review and adjust them.

---

## Product principle

This is **not just text-to-speech**.

This is:

**scene-directed audio storytelling**

That means the software must treat a scene as multiple coordinated layers:
- narration
- dialogue
- music
- ambience
- action sounds / Foley
- timing
- ducking
- silence / pauses

---

## The example scene to design around

Use this kind of scene as the design benchmark:

A remembrance scene inside a moving car at night.
A character is whispering emotionally while driving.
There is fear and memory in the voice.
There may be a shooting scene nearby or approaching danger outside.
The sound must fit the emotion, the car setting, and the tension.

### Example elements
- car engine hum
- road movement / tire sound
- interior cabin ambience
- whispering voice
- emotional pauses
- breathing
- soft emotional music bed
- distant or near gunshots
- glass or dashboard vibration
- tension without over-noise

The goal is not noise for noise’s sake.
The goal is **emotionally correct layered sound**.

---

# PASS NAME

**Scene-Directed Audio Storytelling Layer**

---

## Current issue

Right now, GioHomeStudio can generate some voice, music, and media layers, but it is still too simple.

The missing part is that scenes are not being treated as audio-directed dramatic compositions.

Problems to solve:
- one narrator voice is too flat for dramatic scenes
- emotional whisper scenes need special handling
- environment sound is not intentionally planned enough
- action/tension sound is not structured enough
- music must support emotion, not fight dialogue
- narration, dialogue, ambience, and sound effects need timing and mixing rules
- the user needs a better review/edit workflow for scene audio

---

## Important boundaries

- do not break the source-of-truth
- do not rewrite the product idea
- do not remove Runway or Kling selection
- do not remove current working Free Mode flow
- do not expand into posting automation, analytics, billing, auth, calendar, or team features
- do not start full Reel Builder or full Series Mode expansion in this pass
- do not do a giant rewrite
- keep this pass controlled and focused on scene-directed audio storytelling

---

# Part 1 — Scene interpretation layer

Add a structured scene interpretation step under the local supervisor.

When a user submits text, the supervisor should detect:
- emotional tone
- whether narration is needed
- whether dialogue is present
- whether multiple speakers are present
- whether ambience is needed
- whether SFX/action sounds are needed
- whether music is needed
- what type of music is appropriate
- whether silence/pause-heavy delivery is needed
- whether whisper/low-volume speech is needed
- whether this should be audio-only, image+audio, or video+audio

### Scene interpretation outputs
The supervisor should generate a stored scene/audio plan with fields like:
- sceneType
- emotionalTone
- speechStyle
- narrationNeed
- dialogueNeed
- dialogueSpeakerCount
- ambienceNeed
- sfxNeed
- musicNeed
- musicMood
- environmentType
- tensionLevel
- recommendedAudioMode
- duckingPlan
- pauseStrategy
- confidence
- notes

### Example interpretation for remembrance car scene
- sceneType: emotional tension
- emotionalTone: grief + fear + remembrance
- speechStyle: whisper / intimate / shaky
- narrationNeed: true
- dialogueNeed: true
- ambienceNeed: true
- sfxNeed: true
- musicNeed: true
- musicMood: emotional low piano / ambient tension
- environmentType: car interior night drive
- tensionLevel: medium-high
- duckingPlan: voice priority over music and ambience
- pauseStrategy: long emotional pauses

---

# Part 2 — Audio layers model

The system must model scenes as separate sound layers.

## Required layers

### 1. Narration layer
For narrative explanation or scene framing.

### 2. Dialogue layer
For character speech.
Must support multiple speakers.

### 3. Music layer
For emotional bed, tension, or pacing support.
Must remain underneath speech unless intentionally raised.

### 4. Ambience layer
For environment background such as:
- car interior
- rain
- forest
- market
- village
- room tone
- storm wind

### 5. Foley / action SFX layer
For event-driven sounds such as:
- gunshots
- shield movement
- sword clash
- footsteps
- kicks/hits
- baby cry
- car brake / door / glass movement
- breathing / seat movement / cloth rustle

### 6. Silence / pause layer
This is important.
The system must allow emotional silence and not fill every second with sound.

---

# Part 3 — Whisper and emotional voice handling

A remembrance or emotional scene should not use generic neutral narration.

Add support for voice-direction tags such as:
- whisper
- breath-heavy
- trembling
- intimate
- grieving
- low confidence
- fearful
- commanding whisper
- slow emotional

### Voice-direction controls
At minimum support:
- volume style
- speed
- pause intensity
- emotional style tag
- narrator vs dialogue style

### Example behavior
For a line like:
“I still see her face.”

The voice should be:
- lower volume
- slower pace
- breath-heavy
- pause-sensitive
- emotionally soft

Not loud, robotic, or flat.

---

# Part 4 — Car driving scene support

Add environment support for **moving car scenes**.

### Car ambience categories
- engine hum
- road/tire sound
- cabin vibration
- light dashboard rattle
- passing outside motion
- brake or turn sound if needed

### Interior emotional talk rules
- voices should feel closer / intimate
- ambience should be below dialogue
- music must duck properly
- gunshots or tension sounds should feel external to the car if the script implies distance

### Example scene behavior
For a whispering driver scene:
- car ambience always present at low level
- emotional music enters softly
- whisper dialogue sits in front
- distant gunshots sit behind dialogue
- music ducks when speech starts
- after major line, short silence returns to car ambience only

---

# Part 5 — Shooting scene tension support

Add structured support for tension/action scenes without turning them into noise.

### Supported tension/action categories
- distant gunshot
- near gunshot
- burst fire
- shield movement
- sword clash
- footsteps/running
- heartbeat or tension pulse if appropriate
- glass rattle
- crowd panic
- wind gust / storm crack

### Important rule
SFX must fit the text.
The supervisor should not add random action sounds.
It should infer them only when the story implies them.

### Example cue mapping
- “thunder cracks” -> thunder cue
- “dust swirls” -> wind swirl cue
- “they raised their shields” -> armor / shield movement cue
- “the shot rang out outside the car” -> distant gunshot cue

---

# Part 6 — Multi-speaker dialogue support

Build a practical MVP multi-voice dialogue system.

## Requirements
1. separate narrator voice from character voices
2. detect quoted dialogue or speaker turns
3. allow narrator + character 1 + character 2 + character 3 at minimum
4. if a scene has multiple speakers, do not read everything in narrator voice
5. preserve speaker mapping across revisions when possible

## Character voice registry fields
Each character profile should support:
- character name
- age
- gender / voice class
- voice quality (bass, tenor, soft, youthful, commanding, elder, etc.)
- preferred voice ID
- language / dialect
- narrator flag
- preview sample

## Example
Narrator: “His hands tightened on the steering wheel.”
Boy: “Daddy, I am hungry.”
Father: “Let me get you some food.”

Expected result:
- narrator has one voice
- boy has another voice
- father has another voice
- lines are rendered separately and placed correctly on timeline

---

# Part 7 — Sound effects / environment detection

Add an Audio Events / SFX detection layer.

## Supported sound event families
- rain
- storm
- thunder
- wind
- car ambience
- market ambience
- village ambience
- room tone
- shield clash
- sword fighting
- gunshot
- footsteps / running
- kick / hit / fall
- horse movement
- baby cry
- breathing / stress breath
- door open / close
- object/can dropping

## Supervisor responsibilities
The local supervisor should:
- read script or narration
- detect likely sound events
- map events to supported categories
- create a cue plan
- avoid overloading the scene with too many effects

## Cue plan format
At minimum each cue should include:
- cue label
- cue category
- recommended placement
- volume level
- one-shot or loop
- ducking relation
- priority

---

# Part 8 — Timeline and mixing rules

This pass must make audio feel assembled intentionally.

## Timeline responsibilities
The timeline/mix layer should place:
- narration
- dialogue
- music
- ambience
- SFX
- silence gaps

## Mixing rules
- voice must be priority layer
- music ducks under speech
- ambience stays low unless speech is absent
- action SFX must not bury dialogue
- emotional pauses must be preserved
- silence should be allowed where the scene needs it

## Example timeline for remembrance car scene
- 0:00–0:04 car ambience only
- 0:04–0:08 soft music enters
- 0:06–0:10 whisper line 1
- 0:10 distant gunshot
- 0:10–0:13 silence + car ambience only
- 0:13–0:18 emotional line 2
- 0:18 storm/wind swell
- 0:20 closer tension sound if story requires it

The timeline does not need to become a full DAW.
But it must be structured enough to create believable results.

---

# Part 9 — Audio-only mode

This pass must strengthen audio-only output.

## Required behavior
- user can choose audio-only mode
- no video generation runs
- output can be MP3 or WAV
- narration + dialogue + music + ambience + SFX can all be used
- same review/finalization workflow should still apply

This is strategically important because some story content should be audio-first and cheaper than video.

---

# Part 10 — Review page as finishing desk

Make Review/detail page the true finishing desk for scene audio.

## Must be editable on Review/detail
- narrationScript
- dialogue lines if practical
- voice selection
- speaker voice mapping
- music selection
- ambience on/off
- SFX on/off
- narration volume
- music volume
- ambience volume
- SFX volume
- re-merge with current assets

## Must be visible on Review/detail
- scene/audio plan summary
- emotional tone
- speech style
- detected speakers
- assigned voices
- selected music source
- ambience source
- selected SFX categories
- audio mode used
- whether output is audio-only or video+audio
- fallback reasons if any

---

# Part 11 — Preview before full generation

Add preview tools so the user can test direction before final generation.

## Preview items
1. narrator voice preview
2. character voice preview
3. dialogue preview
4. music preview
5. ambience preview
6. SFX preview
7. short combined scene preview if feasible

## Important rule
Preview text should be meaningful.
Do not use “hello 123”.
Use short natural sample lines that reflect the selected mood/style.

Example whisper preview:
“I remember that night… and I still hear the rain.”

---

# Part 12 — Acceptance tests

Do not stop at code changes only.
Run and report real tests.

## Required test scenarios
1. remembrance + whisper scene
2. car interior emotional talk scene
3. car scene + distant gunshots
4. narration only scene
5. dialogue with 2 speakers
6. dialogue with 3 speakers
7. audio-only export
8. ambience off vs on comparison
9. SFX off vs on comparison
10. review edit -> re-merge cycle

## For each test report
- supervisor plan
- detected scene type
- detected sound cues
- voices assigned
- music used
- ambience used
- whether output merged correctly
- whether result feels improved vs old flat narration path

---

# Part 13 — What is in scope vs out of scope

## In scope
- scene interpretation for audio
- whisper/emotional voice handling
- car ambience support
- tension/shooting SFX support
- dialogue voice separation
- ambience/SFX cue planning
- audio-only strengthening
- review-page audio finishing improvements
- preview tools for scene-audio elements

## Out of scope
- posting automation
- analytics
- billing
- auth
- calendar
- team features
- full Reel Builder
- full Series Mode
- giant UI redesign
- giant architecture rewrite

---

# Part 14 — Reporting requirements

At the end, report clearly:
- exact files changed
- exact DB changes
- what the supervisor now controls
- what is fully real vs partial
- how scene interpretation works
- how multi-speaker voice assignment works
- how ambience/SFX detection works
- how the timeline/mixing rules work
- whether audio-only mode is fully usable
- what remains before this scene-directed audio layer can be considered strong

---

# Final instruction

The purpose is simple:

**Make GioHomeStudio capable of producing emotionally correct, layered, scene-directed audio — especially for dramatic scenes like remembrance, whispering in a moving car, emotional dialogue, and nearby shooting tension — without making the user manually assemble everything.**

Stop after implementing this pass and reporting.

