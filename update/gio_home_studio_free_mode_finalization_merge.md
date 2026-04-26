# GioHomeStudio Free Mode Finalization Merge

We are continuing GioHomeStudio from an already-working localhost build.

This is a controlled merge of the current Free Mode completion notes. The goal is to finish **Free Mode strongly** before moving to other stages.

Use the attached mock/layout reference as design direction, but do not let it replace the source-of-truth. The goal is to finish Free Mode strongly, not drift into random expansion.

---

## Current confirmed state

Free Mode already has many real working layers:

- provider selection
- supervisor / Preview Plan
- identity controls
- revise flow
- responsive playback
- local/downloaded stock music
- replace voice / replace music / re-merge actions
- narrationScript stored separately from the cinematic prompt
- Free Mode core pipeline exists
- local supervisor / Auto Mode exists
- supervisor can infer plan values and music mood
- narrationScript is stored
- detail page already supports narration editing, upload replacement voice/music, and re-merge

But Free Mode is still not finished enough from the user’s perspective.

---

## Main remaining gap

The biggest remaining weakness is **audio intelligence + finishing workflow**.

Examples:

- voice review and music review are still not strong enough on Review page
- user should be able to upload/replace voice and music on Review page
- user should be able to preview voice/music before finalizing
- narration is still too simple
- multi-speaker dialogue is not handled yet
- environmental / sound-effect logic is not handled yet
- audio-only output mode is not properly finished yet
- Auto Mode needs a stronger orchestration brain for assembling all tools automatically
- voice/music preview before generation is still not built
- Free Mode is close, but the next missing piece is AUDIO DIRECTION, not random feature expansion

---

## Pass name

**Free Mode Finalization + Audio Drama Layer + Local Supervisor Hardening**

Also treat this pass as the **Narrative Audio Director Layer**.

Main goal:

Make Free Mode capable of intelligent audio assembly, not just one narrator voice plus one background track.

---

## Core architecture requirement

Free Mode needs a real orchestration brain.

When the user clicks an Auto Mode button in Free Mode, a **local LLM supervisor** should supervise the assembling of all tools and decide what to run, in what order, and with what settings.

Important design rule:
Do **not** design this around logging into ChatGPT Pro/Plus or Claude Pro/Max as the app backend.
Those may be used manually by the owner outside the product, but the product architecture itself should be built around:

- local LLM orchestration
- provider modules
- optional API connectors
- safe fallback logic

---

## Part 1 — Supervisor / Orchestrator layer

Create or harden a local orchestration module that:

- reads the user prompt
- reads selected controls
- decides the generation plan
- chooses which providers/modules to call
- decides whether to run:
  - prompt enhancement
  - visual identity injection
  - video generation
  - voice generation
  - music generation
  - sound effects / environment audio
  - merge
  - review preparation
- records its decisions

### Auto Mode button

Add or harden a clear button for:

- **Assemble in Auto Mode**

When clicked, the local supervisor should:

- interpret the request
- map the request to a generation plan
- route work automatically
- prepare a structured job plan before execution

### Orchestration outputs

The supervisor should produce and store a plan such as:

- inferred content intent
- inferred subject type
- inferred video type
- inferred visual style
- inferred identity/culture hints
- inferred narration need
- inferred music need
- inferred SFX/environment need
- inferred dialogue vs narration structure
- inferred aspect ratio
- recommended provider choices
- fallback plan
- confidence / notes

### Worker model

Keep the modular pipeline, but make the supervisor assign work to workers like:

- Prompt worker
- Video worker
- Voice worker
- Music worker
- SFX worker
- Merge worker
- Review worker

### API model support

Design this so the local supervisor is primary.
If needed later, the system can optionally escalate some reasoning tasks to:

- OpenAI API
- Anthropic API

This must be API-based and optional, not dependent on personal chat subscriptions.

### Visibility

On review/detail pages, show:

- Auto Mode plan summary
- what the supervisor decided
- what was inferred automatically
- what providers were chosen
- why fallback happened

---

## Part 2 — Audio Director under the supervisor

Add a dedicated audio-planning layer under the local LLM supervisor.

When Auto Mode is used, the supervisor should decide:

- whether this job needs video + voice + music
- whether this job should be audio-only
- whether this job needs dialogue voices
- whether this job needs environment / Foley / action sounds
- when narration should be used
- when dialogue should replace narration
- when music should duck under speech
- when some scenes should be sound-only or narration-only

The AI supervisor should help with:

- deciding if narration is needed
- deciding if music is needed
- deciding if SFX/environment layer is needed
- detecting dialogue vs narration
- inferring likely sound events from story text
- preserving user selections strongly
- coordinating the audio assembly plan

---

## Part 3 — Review page becomes the true audio finishing desk

On Review/detail page, make these editable:

1. narrationScript
2. voice selection
3. music selection
4. narration volume
5. music volume
6. upload replacement voice audio
7. upload replacement music audio
8. regenerate voice only
9. regenerate music only
10. re-merge audio with existing video

Keep version history intact.

On review/detail also show clearly:

- narration script
- detected speakers
- voice assigned to each speaker
- selected dialect/language
- selected music
- selected environment sounds
- cue summary
- audio mode used
- whether final output is mp3 or video+audio
- what the supervisor inferred
- what providers were chosen
- why fallback happened

---

## Part 4 — Audio-only mode

Add / finish a true audio-only output option:

- video + audio
- audio only (mp3 output)
- video only

If audio-only is selected:

- do not run video generation
- generate final merged mp3/wav output
- keep the same review / approve / revise workflow
- no video generation
- output MP3 or WAV
- supports narration + dialogue + music + environment sound
- clearly visible in Studio and Review flow

---

## Part 5 — Multi-voice dialogue support

Build a practical MVP dialogue system.

Requirements:

1. separate narrator voice from character voices
2. detect quoted dialogue or speaker turns
3. allow mapping selected characters to different voices
4. if story includes 2 or 3 speakers, do not read everything in narrator voice
5. allow saved character voice mappings
6. support narrator + character 1 + character 2 + character 3 at minimum

Required behavior:

- split narration and spoken dialogue
- assign different voices to different speakers
- let user map voice per named character
- preserve those mappings in DB / review
- if no mapping exists, supervisor chooses defaults and shows them clearly

Example behavior:

Narrator: “They moved into the room and opened the door.”  
Boy: “Daddy, I am hungry.”  
Father: “Let me get you some food.”

The system should not read all of this in one narrator voice.

---

## Part 6 — Character voice registry foundation

Allow user to define simple character voice profiles such as:

- character name
- age
- gender / voice type
- tone class (bass, tenor, warm, soft, deep, childlike, commanding, elder, youthful, etc.)
- preferred voice ID/provider
- dialect / language
- narrator or not

Store and reuse this during generation.

---

## Part 7 — Voice categories and language/dialect handling

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
- pidgin english / Nigerian Pidgin
- igbo
- yoruba
- hausa
- and other supported languages

Important:

- if a language/dialect is not truly supported by the active voice provider, show that honestly
- if current provider truly supports it, wire it
- if support is partial, say so clearly
- do not fake support

---

## Part 8 — Sound effects / environment layer

Add an Audio Events / SFX / Foley layer.

Examples of supported categories:

- rain
- storm
- thunder
- wind
- dust / sand swirl
- shield clash
- shield / spear movement
- sword fighting
- sword clash
- gunshot
- footsteps / running
- kicks / hits
- kick / hit / fall
- horse movement
- baby cry / birth
- crowd / market ambience
- crowd murmur
- door open / close
- can/object dropping on ground
- can / object drop

Requirements:

1. AI supervisor should detect likely sound events from narration/script
2. map them to sound-effect categories
3. allow user to turn environment sound on/off
4. allow user to preview or inspect which SFX were selected
5. merge them beneath narration/music using FFmpeg
6. these should be selectable by user
7. and also inferable by the supervisor from the narration text

Examples:

- “thunder cracks” -> thunder sound
- “dust swirls” -> wind / swirl sound
- “shields ready” -> shield / armor movement sound

---

## Part 9 — Sound timing / cue system

The supervisor must be able to create an audio cue plan.

At minimum store:

- cue type
- cue label
- start time or relative scene position
- volume
- ducking behavior
- whether loop/one-shot

This can be simple first version.
Do not attempt a full DAW.
But make it real enough that sound events can be layered intentionally.

---

## Part 10 — Preview before final generation

Build the missing preview layer:

- voice sample preview using a meaningful sentence
- music preview using the actual selected/local file where possible
- character voice preview button
- narration preview button
- preview should exist before full generation, not only after
- show exact file/source for music:
  - stock
  - pixabay
  - uploaded
  - generated
  - fallback

---

## Part 11 — Review page improvements for this layer

On review/detail show clearly:

- narration script
- detected speakers
- voice assigned to each speaker
- selected dialect/language
- selected music
- selected environment sounds
- cue summary
- audio mode used
- whether final output is mp3 or video+audio
- exact file/source for music
- which sounds were selected
- what the supervisor inferred
- what the supervisor decided
- what providers were chosen
- why fallback happened

Also keep these editable:

- narrationScript
- voice selection
- music selection
- narration volume
- music volume
- upload replacement voice audio
- upload replacement music audio
- regenerate voice only
- regenerate music only
- re-merge audio with existing video

Keep version history intact.

---

## Part 12 — Audio Director acceptance tests

Run and report real tests for:

- narration only
- narration + music
- dialogue with 2 speakers
- dialogue with 3 speakers
- audio-only export
- story with environment sounds
- review edit -> re-merge cycle

For each test report:

- what the supervisor inferred
- what voices were assigned
- what sounds were triggered
- whether final merge succeeded
- whether output changed correctly

---

## Important boundaries

- do not break source-of-truth
- do not remove Runway/Kling selection
- do not remove identity controls
- do not remove revise flow
- keep Runway and Kling selectable
- keep fallback logic intact
- do not expand into Reel Builder, Series expansion, posting automation, analytics, billing, auth, calendar, or team features yet
- do not start Reel Builder or full Series Mode expansion yet
- do not do a giant architecture rewrite
- do not do a giant UI redesign
- do not rewrite the product idea
- keep current working flow intact
- keep this as a controlled upgrade to finish Free Mode properly

---

## Reporting requirements

At the end, report clearly:

- exact files changed
- exact DB changes
- what local supervisor actually controls
- what remains manual
- what is now fully editable on Review page
- whether audio-only mode works
- whether multi-voice dialogue works
- how SFX/environment detection works
- what is real vs partial
- which dialects are truly supported
- how future API escalation can plug in safely
- what remains before Free Mode can be declared finished
- how multi-speaker assignment works
- how cue timing works
- what is fully real
- what is partially wired

Stop after implementing and reporting.

---

## Final purpose

The purpose is simple:

**finish Free Mode strongly so we can move on confidently.**

