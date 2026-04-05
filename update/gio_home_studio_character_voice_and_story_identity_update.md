# GioHomeStudio Character, Voice, and Story Identity Update

We are continuing GioHomeStudio from an already-working localhost build.

This document is an instruction canvas for Claude Code.
It is based on Henry’s update plus the added storytelling-engine notes.

The purpose is to add a strong **character, voice, image, provider, and preview identity layer** to GioHomeStudio in a way that fits the existing product direction.

This must align with:
- GioHomeStudio as a multi-mode AI storytelling and content production studio
- Free Mode as the main handoff mode
- Text to Audio
- Text to Images + Audio
- Text to Video
- Image to Video
- Video to Video
- Hybrid selective premium action video
- scene planner / timeline assembly
- review / revise / re-merge workflow

Do not treat this as a random feature list.
Treat it as a major **identity and continuity system**.

---

# 1. Main target

The main target is:
- get voice from any dialect where realistically supported
- repeat the same voice in all scenes
- keep voice rhythm and consistency
- get image or video reference
- repeat the same character across scenes
- ensure the character does not keep changing
- allow user to save, reuse, edit, and delete characters and actors
- allow AI to suggest saving strong characters after generation
- let the software work better as a handoff system

This is about **voice identity + character identity + provider-aware generation + finishing control**.

---

# 2. New major system to add

Add a dedicated system called:

## Image and Character

This should become a first-class section inside GioHomeStudio.

Its purpose is to store reusable character images, character packs, and character voice identity for use across:
- movies
- stories
- books
- reels
- ads
- promos
- Free Mode
- Commercial Mode
- later Series Mode

This should not be a temporary modal or hidden option.
It should be a real reusable library.

---

# 3. Character creation workflow

The user should be able to create characters in **two ways**.

## 3.1 Method A — Input and use

The user manually creates a character.

### Flow
1. User opens Image and Character section
2. Clicks Create Character
3. Inputs:
   - name
   - age
   - height
   - gender / presentation
   - culture
   - country / region
   - dialect / language
   - voice type
   - optional appearance notes
4. Uploads one or more images
5. Selects and previews a voice
6. Approves the voice
7. Saves the character

### Purpose
This is the manual clean path for building a strong reusable character profile.

## 3.2 Method B — Save after generation

After an Auto Mode run or strong scene generation, AI should ask the user:

**Do you wish to save this character?**

### Options
- Save main actor
- Save speaking actors only
- Save all actors
- Do not save

### If saved, store
- image reference
- voice choice
- culture / region
- language / dialect
- provider/model used
- appearance notes
- project/movie link
- scene source

This helps when the user starts from Free Mode instead of making characters first.

---

# 4. Character library structure

Each saved character should support:
- character name
- project / movie / book / reel association
- age
- height
- gender / presentation
- culture context
- country / region
- ethnicity or leave as AI decides if user chooses that
- language / dialect
- voice category
- voice quality
- preferred voice ID
- preferred voice provider
- narrator or speaking character flag
- appearance description
- wardrobe / costume notes
- hairstyle notes
- personality notes if useful
- base reference image
- extra reference images
- optional motion reference video
- optional pose pack
- keep-same-character toggle
- status: draft / active / archived

The system must allow the same character to be reused across new scenes and future projects.

---

# 5. Character reference workflow

A strong character continuity workflow must be built.

## Required logic
1. Create one strong base image of the actor/character
2. Add extra reference images where possible
3. Store fixed appearance description
4. Store costume / hairstyle / body notes
5. Reuse these references when generating new scenes

## Stronger version
Support a **Character Pack** system with:
- front portrait
- side portrait
- three-quarter portrait
- full body
- two to five expressions
- fixed look sheet
- optional props
- optional style notes

## Why this matters
This improves:
- image consistency
- video continuity
- image-to-video continuity
- premium action clip continuity
- viewer trust in the same actor/character

---

# 6. Voice identity system

The software must not just let the user choose one random voice per scene.
It must build **voice identity memory**.

## Main rule
If a character speaks in one scene, the same character should use the same approved voice in later scenes unless the user changes it.

## Voice identity must store
- character name
- approved voice ID
- provider
- language / dialect
- accent / region
- voice category
- voice quality
- speech style defaults
- narrator or character role

## Example mapping
- Narrator -> Voice A
- Henry -> Voice B
- Boy -> Voice C
- Mother -> Voice D

Whenever these characters appear again, the same mapping must be reused automatically.

---

# 7. Voice picker and voice demo

Add a proper **voice picker**.

This should behave more like a visual picker / browser than a plain dropdown.

## Voice picker flow
1. User selects:
   - culture / region
   - country
   - language / dialect
   - voice category
   - age feeling
   - voice quality
2. System filters voices
3. User previews voices
4. User moves through choices using selector/list/slider if useful
5. System plays sample line
6. User clicks Approve Voice

## Minimum voice categories
- man
- woman
- boy
- girl

## Minimum voice qualities
- bass
- tenor
- soft
- deep
- commanding
- youthful
- elder
- warm
- emotional

## Accent / region groups where realistically supported
- african
- american
- british
- others

## Demo text rule
Do not rely only on “hello 1 2 3” or “test 123”.
Support meaningful preview lines such as:
- “My name is Henry, and this is my voice sample.”
- “I still remember that night.”
- “The rain is falling, but I am still here.”

Also allow a short custom preview sentence if safe.

---

# 8. Narrator profile

Narration should use the same voice-identity system but remain separate from speaking characters when needed.

## Narrator profile fields
- narrator name
- language / dialect
- voice category
- voice quality
- speech style
- preferred voice ID
- provider
- default narration speed
- default narration volume
- emotional narration style if available

This is important because narration voice and character voice are not always the same.

---

# 9. Multi-speaker dialogue continuity

The system must support repeated voices across scenes when different people speak.

## Requirement
If story includes second person or third person dialogue, the software must not read all lines in narrator voice.

## Support at minimum
- narrator
- character 1
- character 2
- character 3

## Character voice registry fields
For each speaking character support:
- name
- age
- gender / voice class
- tone class
- language / dialect
- provider voice ID
- narrator flag
- preview sample

## Dialogue continuity rule
If the same named character appears again later, the same voice should repeat automatically.

---

# 10. Commercial mode voice behavior

Commercial Mode should also use the identity system, but in a simpler way.

## Commercial voice rules
- most commercial projects may only need one speaking voice
- the user should still preview and approve that voice
- the narration voice should remain reusable across the ad project
- if the user later adds testimonial speakers or multiple speakers, the same identity system should still be available

Commercial Mode should not become a disconnected voice system.

---

# 11. Image to Video must be explicitly included

Image to Video should be listed clearly as a supported capability.

Do not hide it under vague wording.

## Supported input examples
- make him walk forward
- make her turn and smile
- make this warrior draw sword
- make this person talk emotionally
- make this photo sing or react

## Image-to-video inputs
- source image
- action prompt
- optional audio/dialogue
- optional motion reference
- provider
- model
- capability

## Review controls
- preview
- regenerate
- replace source image
- change action prompt
- replace voice
- re-merge audio

---

# 12. Performance-driven animation / motion transfer

The software should support performance-driven animation when the chosen provider/model supports it.

## Goal
A user can upload or provide:
- a character reference image/video
- a motion/performance reference video

Then AI transfers that movement to the chosen character.

## Required stored assets
- character pack
- motion reference pack
- chosen provider/model
- capability mode used
- output clip
- fallback notes

## Important rule
Only show this option when the selected provider/model supports it.
Do not fake provider capabilities.

---

# 13. Provider -> Model -> Capability -> Settings logic

The software must not use fake provider structure.

## Wrong structure
Do not show fixed fake options like:
- Gen 1
- Gen 2
- Gen 3
- Gen 4
- Gen 5
for every provider.

That will break quickly because each provider has different naming, models, and capabilities.

## Correct UI flow

### Step 1 — Provider
Examples:
- Runway
- Kling
- Google Veo
- other future providers

### Step 2 — Model
Only show models available for that provider.

### Step 3 — Capability / Mode
Only show capabilities valid for that chosen model.
Examples:
- text to video
- image to video
- video editing
- motion transfer
- lip sync
- audio generation
- character consistency
- storyboard / multi-shot

### Step 4 — Settings
Show settings supported by that selected model and mode:
- duration
- aspect ratio
- resolution
- fps
- reference image
- source video
- audio
- number of outputs
- negative prompt
- seed
- character consistency settings
- start frame / end frame if supported

## Important rule
These options must be dynamic, not hardcoded provider-wide.

---

# 14. AI save-character prompt after auto scene

After one successful auto-generated scene, AI should be able to ask:

**Do you want to save this character for future scenes?**

## Save options
- Save this main actor
- Save speaking actors only
- Save all actors
- Not now

## If user says yes
Store:
- image references
- chosen voice
- culture / country / dialect
- provider/model/capability used
- notes about appearance and style

This makes Auto Mode stronger as a handoff system.

---

# 15. Character reuse for promo and ads

Characters must not be trapped inside one mode.

A saved character should be reusable in:
- Free Mode
- Text to Audio
- Text to Images + Audio
- Text to Video
- Image to Video
- Commercial / promo mode
- later Series Mode
- later Reel Builder

This matters because a saved actor may be used both in story scenes and in promo/trailer materials.

---

# 16. Preview bar / finishing viewer

Add a preview bar viewer like a real media app.

## Minimum preview/finishing controls
- play / pause
- scrub timeline
- enlarge preview
- full screen preview
- trim in / trim out
- replace voice
- replace image
- replace subtitle or text
- toggle original vs updated version
- jump to selected beat / scene
- re-merge current assets

## Important rule
This should work especially on the Review/detail/finishing pages.
The user must not feel trapped in generation-only flow.

---

# 17. Alignment with storytelling engine

Use the storytelling engine notes to add stronger structure.

## Storytelling principles to keep
GioHomeStudio should not waste credits by generating full-motion AI video for every second.
The stronger approach is:
- narration carries the story
- images carry mood and continuity
- premium action clips carry excitement

## Recommended long-form ratio
- 70–90% = narration + images + light motion
- 10–30% = premium action video clips

## Three viewing modes to respect
- Listen Mode
- Glance Mode
- Hero-Shot Mode

## Scene classification engine should still exist
Each scene should be classified as:
- narration-only scene
- image scene
- light-motion image scene
- premium action scene
- talking-narrator scene
- atmosphere bridge scene

## Character Pack usage should feed into
- image generation
- image-to-video generation
- selected text-to-video generations
- narrator/avatar scenes if needed

This update should strengthen the storytelling engine, not compete with it. fileciteturn23file0

---

# 18. Audio-first + story identity alignment

The identity system must work with the audio-first story engine.

## Text to Audio
The same voices should repeat across scenes for the same named character.

## Text to Image + Audio
Images must remain consistent with saved character pack.

## Text to Video
Premium motion clips should reuse character pack and voice mapping where possible.

## Image to Video
Source character images should preserve character continuity better than open-ended text-only generation.

## Video to Video
If a user is enhancing or restyling a clip, the identity system should still help attach/reuse the correct character and voice identity.

---

# 19. Delete / modify / archive behavior

The software must support full character management.

## Character actions
- Edit character
- Modify image set
- Replace base image
- Replace voice
- Change country / culture / dialect
- Change age or type
- Duplicate character
- Archive character
- Delete character from project
- Delete character permanently

## Bulk actions
- Delete actors by movie/project
- Delete selected actors
- Delete all actors
- Archive all actors in project

This is required because a growing character library becomes useless if it cannot be managed cleanly.

---

# 20. What is realistic now vs harder

## Realistic now
Claude Code should aim to build these as real near-term features:
- Image and Character section
- manual character creation
- save actor after generation
- voice picker with demo
- narrator profile
- repeat same voice across scenes
- character reuse across modes
- image-to-video capability entry
- provider/model/capability/settings dynamic selector
- preview bar / edit bar
- save prominent actors / save all actors
- delete / modify / archive actor

## Harder but future-safe
These can be built with honest limits:
- exact same face in every shot across all providers
- exact same clothes/body in every angle
- perfect dialect coverage for every language
- perfect motion transfer across all providers
- one-click fully automatic actor locking with zero retries

## Honesty rule
Build as:
- real where possible
- partial where provider-limited
- clearly disclosed where support is experimental

---

# 21. Recommended implementation order

## Phase A — Character and Voice Identity Foundation
Build first:
- Image and Character section
- manual character creation
- save actor after generation
- character CRUD
- voice picker + voice demo
- narrator profile
- voice mapping per character

## Phase B — Character Consistency Layer
Then add:
- reference image packs
- keep-same-character toggle
- character lock metadata
- reuse across scenes and modes

## Phase C — Provider Capability Layer
Then add:
- provider selector
- dynamic model selector
- capability selector
- settings panel by chosen model

## Phase D — Image-to-Video and Motion Transfer
Then add:
- image-to-video mode entry
- motion reference upload
- performance-driven animation path
- review + retry flow

## Phase E — Preview / Finishing Bar
Then add:
- preview bar
- trim/cut
- replace voice
- replace image/text
- enlarge
- re-merge

This is the safest order.

---

# 22. Reporting requirements

At the end of this pass, report clearly:
- exact files changed
- exact DB changes
- what the new Image and Character section includes
- how character creation works in both methods
- how voice identity memory works
- how repeat voice across scenes works
- how provider/model/capability/settings logic works
- whether image-to-video is now explicit and usable
- whether motion transfer is real or partial
- how save-character-after-generation works
- how delete/modify/archive behavior works
- what is real vs partial
- what should be next after this identity-system pass

---

# 23. Final purpose

The purpose is simple:

**Make GioHomeStudio capable of saving, reusing, and preserving the same characters, voices, and image/video references across scenes and modes, while giving the user a clean provider-aware workflow and a real finishing/preview system.**

This should strengthen the handoff promise:
- user selects or creates character
- user selects or approves voice
- AI keeps the same identity in future scenes
- user can preview, revise, and reuse without rebuilding everything from scratch

Stop after implementing this pass and reporting.

