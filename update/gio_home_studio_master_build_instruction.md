# GioHomeStudio — Master Build Instruction

We are continuing GioHomeStudio from an already-working localhost build.

This document is the **master instruction canvas for Claude Code**.
It merges the major architecture, product logic, Free Mode finalization requirements, supervisor/orchestrator requirements, audio direction requirements, and future-safe mode structure into one controlled plan.

The purpose is not to create random expansion.
The purpose is to build GioHomeStudio in the correct order, with the correct foundation, so the product becomes a true handoff system.

---

# 1. Core product meaning

GioHomeStudio is not just a text-to-video app.
It is an **AI-directed media assembly and storytelling system**.

The user should be able to:
- type prompt or upload source material
- choose settings or use Auto Mode
- let AI assemble the work automatically
- review the result
- replace or regenerate only the wrong parts
- approve the final output

The system should be modular, provider-based, fallback-safe, and handoff-focused.

The product should not depend on one vendor or one provider.
Kling, Runway, local workers, stock assets, and future APIs should all fit into one swappable architecture.

---

# 2. The correct product model

Do not treat GioHomeStudio as disconnected mini-products.
Build it as **one engine with multiple output modes**.

The common flow is:

**Interpret -> Plan -> Generate assets -> Sync on timeline -> Review -> Final render**

That one engine should power all the major modes:
- Text to Video
- Text to Audio
- Video to Video
- Text to Images + Audio
- Text to Video in key action parts + Audio

The real product is:

**AI-directed story and content assembly with multiple output modes.**

---

# 3. Important rules and boundaries

These rules must be respected throughout the build:

- do not break the source-of-truth
- do not rewrite the product idea
- do not remove Kling
- keep Runway and Kling selectable
- keep fallback logic intact
- do not break current working flow
- do not turn the app into random expansion
- do not expand into posting automation, analytics, billing, auth, calendar, or team features unless explicitly asked
- do not merge unrelated product ideas into GioHomeStudio
- do not do a giant architecture rewrite when a controlled extension will work

Also:
- do not design the app around personal ChatGPT/Claude web subscriptions as the backend brain
- if API escalation is added later, it must be optional and provider-based
- the primary orchestration direction should be local LLM supervisor + modular workers + provider adapters + fallback logic

---

# 4. The five major output modes

## 4.1 Text to Video

### Meaning
The user enters text, applies settings, and the software produces a full video based on those settings using providers such as Kling, Runway, or future tools.

### User controls may include
- character identity
- subject type
- visual style
- video type
- aspect ratio
- provider choice
- duration
- narration/music options
- sound effects/environment options
- audio mode

### Flow
1. user enters prompt
2. user selects settings or clicks Auto Mode
3. supervisor interprets request
4. prompt enhancement produces structured visual instructions
5. identity/casting rules are injected
6. video worker generates clip
7. audio workers generate narration, dialogue, music, ambience, and SFX as needed
8. timeline engine assembles layers
9. result goes to Review

### Important rule
Text to video must not mean “one prompt in, one random clip out.”
It must preserve identity, style, culture, timing, and emotional direction.

---

## 4.2 Text to Audio

### Meaning
The user types text and the system outputs audio only.
This has nothing to do with Kling.
It should support narration, dialogue, music, ambience, and SFX.

### Use cases
- audiobook
- radio drama
- emotional storytelling
- myth/legend narration
- spoken advert
- audio trailer

### Flow
1. user enters text
2. supervisor decides:
   - narration only?
   - narration + dialogue?
   - narration + music?
   - narration + SFX?
   - audio-only output?
3. script is split into beats
4. dialogue is separated from narration
5. speaker voices are assigned
6. ambience and SFX are selected
7. music is selected if needed
8. output is rendered as MP3 or WAV
9. result goes to Review

### Strategic importance
This is cheaper than full video and can become one of the strongest parts of GioHomeStudio.

---

## 4.3 Video to Video

### Meaning
The user uploads a source video and the system transforms or enhances it.

### Possible actions
- add narration
- replace voiceover
- replace music
- add SFX
- trim and restructure
- subtitle
- restyle tone
- convert long clip into short version

### Flow
1. user uploads video
2. user describes desired change
3. supervisor decides transform plan
4. system runs the required workers
5. review page shows transformed result

### Important note
This is transform mode, not only generation mode.

---

## 4.4 Text to Images + Audio

### Meaning
The user inputs text and gets audio with images showing in real-time rhythm with narration.
This must not be a random slideshow.

### Flow
1. supervisor breaks story into beats
2. each beat gets:
   - narration segment
   - dialogue if needed
   - image prompt
   - duration
   - optional sound cues
3. image worker generates one image per beat or scene
4. narration/dialogue is generated
5. timeline engine aligns images to the audio timing
6. final output becomes timed image+audio sequence
7. result goes to Review

### Important rule
Images must follow the real timing of the audio.

---

## 4.5 Text to Video in key action parts + Audio

### Meaning
This is the hybrid storytelling mode.
Not every beat needs full video.
Only action or necessary visual moments become real video. Other beats use images and audio.

### Why this matters
This is likely one of the strongest cost-saving modes in the product.

### Flow
1. supervisor breaks story into beats
2. each beat is classified as:
   - narration-only beat
   - still-image beat
   - action-video beat
   - dialogue beat
3. only selected action beats are sent to Kling/Runway
4. still beats use images + audio
5. all beats are assembled on one timeline
6. final output feels cinematic without paying for full-motion video at every second

### User control
User should be able to select or mark important action parts if needed.

---

# 5. The real architectural foundation

## 5.1 Local LLM Supervisor / Director

This is the orchestration brain.

### What it should do
The supervisor should:
- read the user prompt
- read selected controls
- classify the request
- detect the intended output mode
- decide whether video is needed
- decide whether audio-only is enough
- decide whether images are enough
- decide whether dialogue exists
- decide whether narration is needed
- decide whether music is needed
- decide whether ambience/SFX are needed
- decide which provider/module should run
- choose fallback order
- store the plan

### Auto Mode behavior
When the user clicks an Auto Mode button, the supervisor should:
- interpret the request
- map it to a structured plan
- assign workers
- route work automatically
- prepare a job plan before execution

### Orchestration outputs
The supervisor plan should store fields like:
- contentIntent
- inferredMode
- subjectType
- videoType
- visualStyle
- identity/culture hints
- narrationNeed
- dialogueNeed
- musicNeed
- ambienceNeed
- sfxNeed
- aspectRatio
- recommendedVideoProvider
- recommendedVoiceProvider
- recommendedMusicProvider
- fallbackPlan
- confidence
- notes

### Important architecture rule
The product should not depend on personal web subscriptions as backend infrastructure.
The correct direction is:
- local LLM supervisor first
- modular workers second
- optional API escalation later

---

## 5.2 Worker system

The supervisor should assign work to specialized workers.

### Core workers
- Prompt worker
- Script / beat parser
- Identity / casting worker
- Video worker
- Image worker
- Narration worker
- Dialogue voice worker
- Music worker
- Ambience / SFX worker
- Merge / render worker
- Review preparation worker

### Why this matters
Each worker should do one job well.
This avoids one giant messy pipeline that does everything badly.

---

## 5.3 Timeline engine

This is one of the most important foundations.

Without a timeline engine, the system will always feel random.

### What it coordinates
- narration timing
- dialogue placement
- image beat durations
- video segment placement
- music bed timing
- music ducking under speech
- ambience timing
- SFX cue timing
- scene transitions
- final output render

### Example
- 0:00–0:04 narration intro
- 0:02 thunder cue
- 0:04–0:08 image beat 2
- 0:06 dialogue line
- 0:08–0:12 action video clip
- 0:12–0:16 market ambience + narration

### Output
A structured render plan that FFmpeg or future render tools can assemble reliably.

---

## 5.4 Asset registry

Everything should be saved as reusable assets.

### Asset types
- original input
- enhanced prompt
- narration script
- dialogue script
- supervisor plan
- beat structure
- character profiles
- casting/identity settings
- image prompts
- generated images
- generated video clips
- voice files
- dialogue files
- music files
- ambience files
- SFX files
- final merged output
- versions
- provider usage
- notes

### Why this matters
This is what makes review, replace, re-merge, and reuse possible.

---

## 5.5 Review / Finishing Desk

Review must become the true finishing desk, not just a display page.

### User should be able to
- preview video/audio
- edit narration script
- replace voice
- replace music
- upload new audio assets
- regenerate only voice
- regenerate only music
- re-merge using the same video
- replace image beat if relevant
- revise in Studio
- approve
- reject
- keep history

### This is how handoff becomes real
The user should not have to restart the whole process because one voice, music, image, or SFX choice is wrong.

---

# 6. Identity, casting, and character consistency

## 6.1 Identity control

If the user selects African, black, female, or similar visual/identity instructions, the output must preserve that strongly.

### Needed controls
- ethnicity / appearance intent
- gender presentation
- age range
- number of characters
- wardrobe / look
- culture context
- scene setting
- realism level
- camera feel / style

### Important rule
These must not be UI-only.
They must influence prompt enhancement and provider payloads where possible.

---

## 6.2 Character profile foundation

Even before full series mode, the system should have a minimal character profile foundation.

### Character profile fields
- character name
- age
- gender / voice class
- appearance description
- identity/cultural hints
- wardrobe / style notes
- reference image(s)
- preferred voice
- narrator or not
- future-safe identity seed / lock field

### Why this matters
This helps keep a character visually and vocally consistent across related outputs.

---

## 6.3 Reference image support

The user should be able to upload one or more reference images for:
- character/person reference
- product reference
- mood/style reference

### Requirement
The system must state clearly what is real vs partial depending on provider capability.

---

# 7. Free Mode — what it should mean

Free Mode is where the user can type anything and let the system handle the rest.

### Free Mode promise
The user should be able to:
1. type prompt
2. choose settings or use Auto Mode
3. click Assemble in Auto Mode
4. see the supervisor plan
5. generate assets
6. review output
7. replace only the wrong parts
8. approve the final result

### Important truth
Free Mode should become the strongest handoff loop before moving deeply into later modes.

---

# 8. Free Mode Finalization requirements

We need one final strong pass to complete Free Mode before moving heavily into other stages.

## Main remaining weakness
The biggest weakness is **audio intelligence + finishing workflow**.

Examples:
- voice review and music review are not strong enough on Review page
- upload/replace voice and music must be easy on Review page
- preview before finalizing must be better
- narration is still too simple
- multi-speaker dialogue is not finished enough
- environment / SFX logic is not finished enough
- audio-only output must be finished properly

---

## 8.1 Review page becomes the audio finishing desk

On Review/detail page, make these editable:
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
- upload replacement voice audio
- upload replacement music audio
- regenerate voice only
- regenerate music only
- re-merge audio with existing video

### Review page must also show
- original input
- enhanced prompt
- narrationScript actually spoken
- requested provider vs actual provider
- fallback reason if any
- music source used
- ambience/SFX source used
- whether current output contains:
  - real voice
  - uploaded voice
  - stock/pixabay music
  - uploaded music
  - fallback/mock assets
- supervisor plan summary

### Important
Keep version history intact.

---

## 8.2 Audio-only mode

Add or finish a true audio-only output option:
- no video generation
- output MP3 or WAV
- supports narration + dialogue + music + ambience + SFX
- clearly visible in Studio and Review flow

### User-visible options
- Video + Audio
- Audio Only
- Video Only

### Strategic value
Audio-only gives GioHomeStudio a cheaper storytelling path and keeps the product useful when video credits are low.

---

## 8.3 Multi-voice dialogue support

Build a practical MVP dialogue system.

### Requirements
- separate narrator voice from character voices
- detect quoted dialogue or speaker turns
- allow mapping selected characters to different voices
- if story includes 2 or 3 speakers, do not read everything in narrator voice
- allow saved character voice mappings
- support narrator + character 1 + character 2 + character 3 at minimum

### Example
Narrator: “They moved toward the room and opened the door.”
Boy: “Daddy, I am hungry.”
Father: “Let me get you some food.”

The system must not read all of this in one narrator voice.

---

## 8.4 Voice categories and language/dialect handling

Improve voice selection UX.

### Voice categories
- man
- woman
- boy
- girl

### Voice qualities
- bass
- tenor
- soft
- commanding
- elder
- youthful

### Accent / region categories where realistically supported
- american
- african
- british
- others

### Language / dialect list should include
- english
- pidgin english
- igbo
- yoruba
- hausa
- and other supported languages

### Honesty rule
If a language/dialect is not truly supported by the active provider, show that honestly.
Do not fake support.

---

## 8.5 Preview before final generation

Add preview tools so the user can test direction before full generation.

### Preview items
- narrator voice preview
- character voice preview
- dialogue preview
- music preview
- ambience preview
- SFX preview
- short combined scene preview if feasible

### Important rule
Preview text should be meaningful.
Do not use “hello 123”.
Use natural sample lines that reflect the selected mood/style.

---

# 9. Scene-Directed Audio Storytelling Layer

This is a major missing capability.
The system must be able to produce **scene-directed emotional audio**, not just flat narration plus background music.

## Example target scene
A remembrance scene inside a moving car at night.
A character is whispering emotionally while driving.
There is grief, fear, memory, and maybe nearby shooting tension.
The sound must fit the emotion, the setting, and the tension.

### Example elements
- car engine hum
- road/tire sound
- interior cabin ambience
- whispering voice
- emotional pauses
- breathing
- soft emotional music bed
- distant or near gunshots
- glass or dashboard vibration
- tension without too much noise

### Goal
The goal is not noise for noise’s sake.
The goal is **emotionally correct layered sound**.

---

## 9.1 Scene interpretation layer

Add a structured scene interpretation step under the local supervisor.

### The supervisor should detect
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
- whether output should be audio-only, image+audio, or video+audio

### Scene interpretation outputs
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

## 9.2 Audio layers model

Scenes must be treated as separate coordinated layers.

### Required layers
1. narration layer
2. dialogue layer
3. music layer
4. ambience layer
5. Foley / action SFX layer
6. silence / pause layer

### Important point
The system must allow emotional silence and not fill every second with sound.

---

## 9.3 Whisper and emotional voice handling

A remembrance or emotional scene should not use generic neutral narration.

### Support voice-direction tags such as
- whisper
- breath-heavy
- trembling
- intimate
- grieving
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

### Example line
“I still see her face.”

This should sound:
- lower volume
- slower pace
- breath-heavy
- pause-sensitive
- emotionally soft

Not loud, robotic, or flat.

---

## 9.4 Car driving scene support

Add environment support for moving car scenes.

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
- tension sounds should feel external to the car if the script implies distance

### Example behavior
For a whispering driver scene:
- car ambience is present at low level
- emotional music enters softly
- whisper dialogue sits in front
- distant gunshots sit behind dialogue
- music ducks when speech starts
- after major line, short silence returns to car ambience only

---

## 9.5 Shooting scene tension support

Add structured support for tension/action scenes without turning them into noise.

### Supported categories
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

## 9.6 Sound events / environment detection

Add an Audio Events / SFX detection layer.

### Supported sound event families
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
- object / can dropping

### Supervisor responsibilities
- read the script or narration
- detect likely sound events
- map events to supported categories
- create a cue plan
- avoid overloading the scene with too many effects

### Cue plan format
- cue label
- cue category
- recommended placement
- volume level
- one-shot or loop
- ducking relation
- priority

---

## 9.7 Timeline and mixing rules for scene-audio

The audio must feel assembled intentionally.

### Timeline responsibilities
Place:
- narration
- dialogue
- music
- ambience
- SFX
- silence gaps

### Mixing rules
- voice is priority layer
- music ducks under speech
- ambience stays low unless speech is absent
- action SFX must not bury dialogue
- emotional pauses must be preserved
- silence should be allowed where the scene needs it

### Example remembrance car timeline
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

# 10. Text to images + audio rhythm system

This is important and must not be random.

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
- thunder cue

Beat 3: “The child opened his eyes.”
- duration: 4 seconds
- image 3
- low rumble cue

This creates rhythm between image and sound.

---

# 11. Product/ad image-led generation

The system should also support product/image-led creation in a future-safe way.

### User should be able to
- upload product image
- use image as reference
- generate narration that describes the product
- create video or image+audio output aligned with ad/product workflow

### Important
This should fit the same engine, not become a separate disconnected app.

---

# 12. Video provider, voice provider, and music provider logic

## 12.1 Video providers
- Runway and Kling must remain selectable
- fallback logic must remain intact
- if credits or provider failure cause fallback, show the reason honestly

## 12.2 Voice provider logic
- voice preview should be available
- multi-speaker mapping should be supported
- if provider auth/support is limited, show that honestly

## 12.3 Music provider logic
- stock / pixabay / uploaded / generated / fallback sources should be labeled clearly
- preview should use actual selected/local file where possible
- if the selected category has no matching file, show the reason

---

# 13. UI / screen logic

## 13.1 General principle
The screen should not feel like a messy debug page.
It should feel like a professional creation and finishing environment.

## 13.2 Video preview behavior
- preview must be aspect-ratio-aware
- preserve source aspect ratio
- support 9:16, 16:9, 1:1, and future-safe formats
- let the user preview how it looks on phone/tablet/desktop
- keep the player area visually important

## 13.3 Studio page
- keep layout wider and cleaner
- use compact format selectors where practical
- put advanced controls under collapsible sections where needed
- preserve usability over decoration

## 13.4 Review/detail page
This page must feel like the finishing desk.
The user should be able to inspect, preview, edit, replace, regenerate, and finalize without confusion.

---

# 14. Acceptance tests that matter

Do not stop at code changes only.
Run and report real tests.

## Required test families
1. text to video basic
2. text to audio basic
3. image+audio beat sync
4. hybrid action-video mode basic
5. narration only scene
6. narration + music scene
7. dialogue with 2 speakers
8. dialogue with 3 speakers
9. remembrance + whisper scene
10. car interior emotional talk scene
11. car scene + distant gunshots
12. ambience off vs on comparison
13. SFX off vs on comparison
14. upload replacement music on Review page
15. upload replacement voice on Review page
16. regenerate voice only
17. regenerate music only
18. re-merge with existing video
19. audio-only export
20. revise to Studio without losing history

## For each test report
- supervisor plan
- requested providers
- actual providers used
- detected scene/audio cues
- voices assigned
- music used
- ambience/SFX used
- whether merge succeeded
- whether result changed correctly
- fallback reason if any
- final item status

---

# 15. Reporting requirements

At the end of any controlled pass, report clearly:
- exact files changed
- exact DB changes
- what the supervisor now controls
- what remains manual
- what is fully real vs partial
- how scene interpretation works
- how multi-speaker voice assignment works
- how ambience/SFX detection works
- how timeline/mixing rules work
- whether audio-only mode is fully usable
- whether Review page editing is fully usable
- which languages/dialects are truly supported
- which provider limitations still exist
- what remains before Free Mode can be declared finished

---

# 16. Recommended build order from here

## Stage 1 — Finish Free Mode strongly
Focus on:
- supervisor hardening
- review finishing desk
- text to audio
- audio-only export
- multi-voice MVP
- ambience/SFX cue planning
- voice/music/SFX preview
- final merge reliability

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

## Stage 4 — Video to Video
Focus on:
- transform workflows
- replace/trim/revoice paths

## Stage 5 — Deeper series continuity and advanced episodic features
Only after the above are solid.

---

# 17. Final build instruction

The product goal is handoff:

**user types prompt + selects controls or uses Auto Mode + AI assembles the work automatically + user reviews and fixes only the wrong parts + user approves final output**

That is the foundation.

So the immediate build priority is:

## Free Mode Finalization + Narrative Audio Director + Multi-Mode Future-Safe Foundation

Build the foundation correctly now.
Do not drift into unrelated expansion.
Do not fake support.
Do not hide fallback reasons.
Do not break the current working flow.

The purpose is simple:

**Finish Free Mode strongly, make the audio/story assembly intelligent, and keep the architecture correct so GioHomeStudio can expand cleanly into all major modes afterward.**

