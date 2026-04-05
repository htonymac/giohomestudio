# GioHomeStudio Local Image Backend and Audio Asset Loading Update

We are continuing GioHomeStudio from an already-working localhost build.

This document is an instruction canvas for Claude Code.
It merges:
- local image-generation backend guidance
- Qwen image-generation support
- ComfyUI + Flux / Qwen backend direction
- local sound-effect loading workflow
- asset-diagnostic / downloader-agent guidance
- music storage advice so disk space does not get wasted

The purpose is to make GioHomeStudio stronger locally while staying aligned with the current architecture.

---

# 1. Core correction

Do not confuse:
- text-only local LLMs running in Ollama
with
- image-generation models

Some local models in Ollama are text-only.
But **Qwen-Image is a real image-generation model**, and ComfyUI already has native workflows for:
- Qwen-Image
- Qwen-Image-Edit
- Qwen-Image-2512
- FLUX.1

So GioHomeStudio should be designed to support **local image generation through ComfyUI** as a backend service, not only cloud image/video providers.

---

# 2. Main local image-generation decision

## Correct conclusion
Yes — GioHomeStudio should support a local image backend using **ComfyUI**.

And that backend should be able to route to image models such as:
- FLUX.1
- Qwen-Image
- Qwen-Image-Edit
- Qwen-Image-2512
- later other image-capable models

## Important rule
Do not hardcode the product around only one local image model.
Use the same provider-aware architecture:
- Provider
- Model
- Capability
- Settings

For local image generation, the provider can be something like:
- Local / ComfyUI

Then the model list can show:
- FLUX.1
- Qwen-Image
- Qwen-Image-2512
- Qwen-Image-Edit

Then the capability list should show only valid options per model.

---

# 3. Why this matters for GioHomeStudio

Using a local image backend saves cost for:
- character packs
- reference image generation
- scene stills
- product reference images
- promo poster frames
- text-to-image story beats
- image-to-video source frames

This is especially valuable because GioHomeStudio’s correct long-form storytelling model is not full-motion video everywhere.
The system should rely heavily on:
- narration
- images
- light motion
- selective premium action clips only where needed

So a strong local image backend directly supports the cost-controlled storytelling engine.

---

# 4. Recommended local image backend structure

## Main backend choice
Use **ComfyUI** as the local image backend service.

## Why
ComfyUI already supports official/native workflows for:
- FLUX.1 text-to-image
- Qwen-Image
- Qwen-Image-Edit
- Qwen-Image-2512

That makes it the best local image orchestration layer for GioHomeStudio.

## GioHomeStudio integration direction
GioHomeStudio should not try to become another ComfyUI UI.
Instead:
- GioHomeStudio stays the main product interface
- ComfyUI acts as a backend image worker
- GioHomeStudio sends structured jobs to ComfyUI
- ComfyUI returns generated assets
- GioHomeStudio stores those assets in the asset registry and uses them in the timeline/review flow

---

# 5. Image backend capabilities to support

The local image backend should support these capabilities where the chosen model allows them:

## Text to image
Used for:
- character portraits
- scene stills
- product frames
- environment images

## Image editing
Used for:
- correcting reference images
- changing clothing or props
- text-in-image fixes
- refining saved character packs

## Character pack generation
Used for:
- front portrait
- side portrait
- three-quarter portrait
- full body
- expression pack
- costume sheet

## Story beat images
Used for:
- image scenes in long-form storytelling
- image+audio synchronized beats
- promo/commercial stills

---

# 6. FLUX vs Qwen recommendation inside GioHomeStudio

Do not force one winner globally.
Use a practical recommendation system.

## FLUX.1 is a strong default for
- high-quality general text-to-image
- realistic portraits
- strong local generation workflows
- stable text-to-image use through ComfyUI

## Qwen-Image is a strong option for
- image generation
- precise image editing
- strong text rendering
- newer Qwen image workflows

## Qwen-Image-2512 should be treated as an upgraded local option
- improved realism
- improved human detail
- improved text rendering

## Recommendation rule inside the software
If user asks for:
- realistic character references -> offer FLUX or Qwen-Image-2512
- text-heavy or layout-heavy image -> prefer Qwen-Image family
- image editing / controlled changes -> offer Qwen-Image-Edit

Do not pretend every model is best at everything.

---

# 7. Required UI structure for local image generation

Follow the same correct architecture:

## Step 1 — Provider
- Local / ComfyUI
- Cloud provider options remain available separately

## Step 2 — Model
Only show valid local models that are actually installed/available, such as:
- FLUX.1
- Qwen-Image
- Qwen-Image-2512
- Qwen-Image-Edit

## Step 3 — Capability
Only show valid capabilities for that selected model:
- text to image
- image editing
- character pack
- poster frame
- story beat image

## Step 4 — Settings
Show only settings supported by the selected model/capability:
- aspect ratio
- resolution
- seed
- negative prompt
- reference image
- image count
- character consistency settings if supported

This must stay dynamic, not hardcoded.

---

# 8. Character-pack generation with local image backend

A major use of the local image backend should be **character pack creation**.

## Target
Generate or refine a structured actor reference pack for each main character.

## Character pack outputs
- front portrait
- side portrait
- three-quarter portrait
- full body
- emotion expressions
- clothing/look sheet
- optional props

## Why
This directly supports:
- character continuity
- image-to-video continuity
- text-to-video prompt guidance
- story-commercial use
- promo poster reuse

---

# 9. Sound-effect downloading and loading strategy

The local LLM should not be asked to do everything in one giant step.
Use a controlled system.

## Best architecture
### Layer 1 — local LLM / Ollama
Use it for:
- diagnosis
- prioritization
- search-term planning
- filename validation
- category ranking
- feedback about software mapping

### Layer 2 — tool-enabled agent (Claude Code)
Use it for:
- actual browsing/searching
- downloading free files
- renaming files
- saving files in the correct folder
- validating whether files are detected by the app

### Layer 3 — GioHomeStudio
Use it for:
- file presence detection
- filename matching
- cue mapping
- previewing loaded files
- showing missing vs available state

## Important rule
Do not ask the local LLM alone to browse/download/rename/diagnose all at once.
That is one major reason for timeouts.

---

# 10. Controlled SFX library rule

For Foley/action sounds like:
- shield
- thunder
- wind
- footsteps
- baby cry
- gunshot
- sword clash
- horse gallop
- crowd panic
- market ambience

GioHomeStudio should first rely on:
- cue planning
- manual / stock SFX layer
- local asset loading
- filename mapping
- preview and testing

before trying to claim fully automatic cinematic sound design.

This is the controlled way to make the system real instead of fake.

---

# 11. Current local SFX library expectation

The app already expects files in:

`storage/sfx/`

The current filename-driven system should stay.
Claude Code should strengthen it, not replace it.

## Existing expected files include categories such as
### Weather
- thunder.mp3
- rain_light.mp3
- rain_heavy.mp3
- wind.mp3
- storm.mp3

### Crowd
- crowd_cheer.mp3
- crowd_murmur.mp3
- crowd_panic.mp3

### Action
- gunshot.mp3
- explosion.mp3
- sword_clash.mp3
- footsteps.mp3
- footsteps_run.mp3
- fire_crackling.mp3
- door_creak.mp3
- horse_gallop.mp3

### Nature
- ocean_waves.mp3
- forest_ambience.mp3
- river_stream.mp3

### Urban
- city_traffic.mp3
- church_bell.mp3
- market_noise.mp3

### Horror
- horror_sting.mp3
- heartbeat.mp3

### Animal
- dog_bark.mp3

Keep this system and improve the loading workflow around it.

---

# 12. Free online SFX sources to support in the help area

Add clickable help/resource links inside the SFX Library page.

## Main free sources
- Freesound
- Pixabay Sound Effects
- Mixkit Sound Effects
- Sonniss GameAudioGDC archive
- Openverse audio search

## Also keep a premium/internal note
If Henry has premium licensed files from sources like Artlist, allow manual import into the local vault, but do not build automated downloading around premium sources.

---

# 13. Downloader-agent behavior for sounds

Claude Code should be able to instruct the local system or run a controlled loading workflow category by category.

## Required workflow
1. Diagnose missing files first
2. Rank priority order
3. Search free sources category by category
4. Download only good matches
5. Rename exactly to expected filenames
6. Save into `storage/sfx/`
7. Keep a small manifest:
   - filename
   - original title
   - source site
   - source URL
   - quality note
8. Refresh validation
9. Report what is still missing

## Important rule
Do not download everything at once.
Do Weather + Action first, then continue.

---

# 14. Music storage advice

Music is different from SFX.

## Main advice
Do **not** preload huge music libraries locally unless necessary.
That will waste space very quickly.

## Better approach
Use a **curated local music vault**, not a giant dump.

### Recommended strategy
Keep only:
- a small high-quality stock set per mood
- a few loopable beds per mood
- a few region/culture options where important
- a few premium hero tracks if licensed
- user-uploaded music

## Suggested music categories to keep locally
- emotional
- suspense
- heroic
- documentary
- calm
- dark
- war
- ambient
- market / folk / regional if important

## Suggested count rule
Do not keep 500 random music files.
Start with something like:
- 5 to 10 tracks per major mood
- favorite and rate the best ones
- add more only when you actually need them

## Space-saving rule
Preload SFX more aggressively than music.
Music should stay curated and smaller.
SFX is used broadly and repeatedly; music libraries can explode in size fast.

---

# 15. Add music source logic to the software

Claude Code should also improve music handling to reflect this smaller curated strategy.

## Music source buckets
- local curated stock
- pixabay/free
- uploaded
- premium/internal
- generated if available later

## Show source clearly
For each selected music item, show:
- source bucket
- filename
- duration
- mood
- region tag if used
- approved for auto mode yes/no

This helps avoid library chaos.

---

# 16. Suggested next implementation work for Claude Code

## Part A — local image backend support
- add Local / ComfyUI as an image provider
- support FLUX.1 and Qwen-Image family as local image models
- add provider/model/capability/settings UI for local image generation
- allow generated images to flow into character pack, story beats, commercials, and review

## Part B — SFX library loading workflow
- keep current filename-based SFX page
- add clickable source/help links
- add category-by-category loading guidance
- add preview player for loaded SFX
- add better counters and missing/loaded status
- add safe-for-auto-mode tagging

## Part C — downloader/diagnostic split
- local LLM handles planning/diagnosis only
- Claude Code or tool-enabled agent handles actual download/rename/load workflow
- report what is loaded and what is still missing

## Part D — music vault control
- create a small curated local music vault instead of massive preload
- bucket music by mood/source
- show source clearly
- let Henry favorite or approve tracks for auto mode

---

# 17. Reporting requirements

At the end of this pass, report clearly:
- exact files changed
- whether Local / ComfyUI image backend was added or planned correctly
- what local image models are now recognized
- how FLUX vs Qwen image routing works
- whether SFX loading help links were added
- whether preview for loaded SFX works
- how the local LLM vs downloader-agent split works
- what the curated music strategy is
- what still remains before the local asset system can be called strong

---

# 18. Final purpose

The purpose is simple:

**Use ComfyUI as GioHomeStudio’s local image backend for models like FLUX and Qwen-Image, strengthen the current SFX loading workflow with controlled downloader-agent logic, and keep music storage curated so local assets save cost without creating space chaos.**

