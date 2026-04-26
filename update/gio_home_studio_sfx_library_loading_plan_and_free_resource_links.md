# GioHomeStudio SFX Library Loading Plan and Free Resource Links

We are continuing GioHomeStudio from an already-working localhost build.

This document is an instruction canvas for Claude Code.
Its purpose is to take the current SFX Library work already visible in GioHomeStudio and turn it into a practical, usable, and legally safer loading workflow.

The goal is not to jump into fake fully automatic cinematic sound design.
The goal is to make the current **cue planning + manual/stock sound layer** real, strong, and easy to load.

---

# 1. Core instruction

Use this principle first:

## Controlled rule
For Foley/action sounds like shield, thunder, wind, footsteps, baby cry, gunshots, sword clash, horse gallop, crowd panic, and similar effects, GioHomeStudio should first build and rely on:

- cue planning
- manual / stock SFX layer
- local asset loading
- clear filename mapping
- preview and testing

before trying to claim fully automatic cinematic sound design.

This is the controlled way to make the system real instead of fake.

---

# 2. Current state already visible in the app

The current SFX Library page already shows a real library structure with:
- category tabs
- expected filenames
- automatic script keyword mapping
- a required local storage folder
- missing/available state

The current system already expects files to be placed in:

`storage/sfx/`

And the current library shows these categories and filenames:

## Weather
- thunder -> `thunder.mp3`
- rain_light -> `rain_light.mp3`
- rain_heavy -> `rain_heavy.mp3`
- wind -> `wind.mp3`
- storm -> `storm.mp3`

## Crowd
- crowd_cheer -> `crowd_cheer.mp3`
- crowd_murmur -> `crowd_murmur.mp3`
- crowd_panic -> `crowd_panic.mp3`

## Action
- gunshot -> `gunshot.mp3`
- explosion -> `explosion.mp3`
- sword_clash -> `sword_clash.mp3`
- footsteps -> `footsteps.mp3`
- footsteps_run -> `footsteps_run.mp3`
- fire_crackling -> `fire_crackling.mp3`
- door_creak -> `door_creak.mp3`
- horse_gallop -> `horse_gallop.mp3`

## Nature
- ocean_waves -> `ocean_waves.mp3`
- forest_ambience -> `forest_ambience.mp3`
- river_stream -> `river_stream.mp3`

## Urban
- city_traffic -> `city_traffic.mp3`
- church_bell -> `church_bell.mp3`
- market_noise -> `market_noise.mp3`

## Horror
- horror_sting -> `horror_sting.mp3`
- heartbeat -> `heartbeat.mp3`

## Animal
- dog_bark -> `dog_bark.mp3`

The current page also already supports manual script annotations like:
- `[SFX: thunder]`
- `[SFX: rain_heavy]`
- `[SOUND: crowd_cheer]`

That means the correct next move is to **finish loading and testing this layer**, not replace it with a more confusing system.

---

# 3. Main build goal for this pass

Claude Code should treat this as:

## SFX Library Completion + Loading Workflow Pass

The purpose is:
- make the existing SFX Library truly usable
- help Henry load high-quality SFX fast
- add safer source/resource guidance
- add clickable resource/help links
- improve preview and testing
- strengthen cue planning and script mapping

Do not turn this pass into a giant rewrite.

---

# 4. Free source links to include in the software help area

Add a visible **Free SFX Sources** help card or resource section inside the SFX Library page.
These should be clickable links in the UI.

## Recommended free sources

### Main free sources
- [Freesound](https://freesound.org/)
- [Pixabay Sound Effects](https://pixabay.com/sound-effects/)
- [Mixkit Sound Effects](https://mixkit.co/free-sound-effects/)
- [Sonniss GameAudioGDC Archive](https://sonniss.com/gameaudiogdc/)
- [Openverse Audio Search](https://openverse.org/audio/)

## Good category-specific quick links

### Freesound search links
- [Thunder search](https://freesound.org/search/?q=thunder)
- [Rain search](https://freesound.org/search/?q=rain)
- [Wind search](https://freesound.org/search/?q=wind)
- [Gunshot search](https://freesound.org/search/?q=gunshot)
- [Sword clash search](https://freesound.org/search/?q=sword+clash)
- [Footsteps search](https://freesound.org/search/?q=footsteps)
- [Horse gallop search](https://freesound.org/search/?q=horse+gallop)
- [Crowd murmur search](https://freesound.org/search/?q=crowd+murmur)
- [Market ambience search](https://freesound.org/search/?q=market+ambience)
- [Heartbeat search](https://freesound.org/search/?q=heartbeat)

### Pixabay quick links
- [Pixabay thunder](https://pixabay.com/sound-effects/search/thunder/)
- [Pixabay rain](https://pixabay.com/sound-effects/search/rain/)
- [Pixabay wind](https://pixabay.com/sound-effects/search/wind/)
- [Pixabay gunshot](https://pixabay.com/sound-effects/search/gunshot/)
- [Pixabay footsteps](https://pixabay.com/sound-effects/search/footsteps/)
- [Pixabay horse](https://pixabay.com/sound-effects/search/horse/)
- [Pixabay market](https://pixabay.com/sound-effects/search/market/)
- [Pixabay heartbeat](https://pixabay.com/sound-effects/search/heartbeat/)

### Mixkit quick links
- [Mixkit cinematic SFX](https://mixkit.co/free-sound-effects/cinematic/)
- [Mixkit horror SFX](https://mixkit.co/free-sound-effects/horror/)
- [Mixkit rain SFX](https://mixkit.co/free-sound-effects/rain/)
- [Mixkit thunder SFX](https://mixkit.co/free-sound-effects/thunder/)
- [Mixkit footsteps SFX](https://mixkit.co/free-sound-effects/footsteps/)
- [Mixkit explosion SFX](https://mixkit.co/free-sound-effects/explosion/)

### Sonniss archive
- [Sonniss GameAudioGDC archive](https://sonniss.com/gameaudiogdc/)
- [Sonniss GDC 2026 bundle](https://gdc.sonniss.com/)

---

# 5. Important source guidance to show in the app

The software help area should explain:

## Recommended practical loading rule
- download good royalty-free files manually
- rename each file exactly to the expected filename
- place them in `storage/sfx/`
- refresh the SFX page
- green state means the file is detected and usable

## Important quality rule
Choose files that are:
- clean
- not too long unless ambience loop is intended
- not overloaded with music if the file is meant to be pure SFX
- easy to loop for ambience if needed
- strong enough to sit under narration without overpowering it

## Good duration guidance
- one-shot effects: 0.5s to 5s
- ambience loops: 10s to 60s
- tension/horror stings: 1s to 6s
- market/city/forest beds: 15s to 60s preferred

---

# 6. Better category guidance for Henry

Add a practical note for what to download first.

## Priority pack 1 — must load first
These should be loaded first because they cover a large amount of story and commercial use:
- thunder.mp3
- rain_light.mp3
- rain_heavy.mp3
- wind.mp3
- storm.mp3
- gunshot.mp3
- sword_clash.mp3
- footsteps.mp3
- footsteps_run.mp3
- door_creak.mp3
- market_noise.mp3
- crowd_murmur.mp3
- horse_gallop.mp3
- heartbeat.mp3
- forest_ambience.mp3

## Priority pack 2 — strong support set
Then load:
- explosion.mp3
- fire_crackling.mp3
- crowd_cheer.mp3
- crowd_panic.mp3
- city_traffic.mp3
- church_bell.mp3
- ocean_waves.mp3
- river_stream.mp3
- horror_sting.mp3
- dog_bark.mp3

This gives the software enough range to begin real cue planning and believable audio layering.

---

# 7. Resource labels by quality and use

Inside the help section, classify sources like this:

## Best for fast loading
- Pixabay
- Mixkit

## Best for variety and niche effects
- Freesound

## Best for large high-quality bundle library
- Sonniss GameAudioGDC

## Best for searching open-license items broadly
- Openverse

This helps Henry know where to go first depending on urgency.

---

# 8. License and usage guidance in the software

Add a small visible warning/help note:

## License guidance
- always check the source license before use
- prefer files that allow commercial use
- track whether attribution is required
- do not treat third-party files as a public redistributable library
- this local SFX vault is for GioHomeStudio’s internal project assembly and rendered outputs

## For Freesound specifically
If possible, add a note that files may have different licenses and should be checked before import.

This should not block loading, but it should make the workflow safer.

---

# 9. Improve the SFX page itself

The current page is already useful, but Claude Code should improve it in practical ways.

## Add these improvements
1. clickable resource/help links at the top
2. quick “copy filename” button for each required file
3. better missing/available indicator
4. preview player for loaded files
5. import notes / source notes field
6. optional attribution note field
7. category counts like:
   - 3/5 weather loaded
   - 4/8 action loaded
8. “priority files first” helper section
9. “safe for auto mode” toggle for each loaded file
10. waveform or duration preview if easy

---

# 10. Auto-mapping and manual cue planning

Do not replace the current mapping idea.
Strengthen it.

## Current good idea
If script contains something like “it was raining heavily,” the system maps it to `rain_heavy`.

That is good and should stay.

## Improve it with two layers
### Layer A — automatic keyword mapping
Examples:
- rain / drizzle -> rain_light
- heavy rain / downpour -> rain_heavy
- thunder / thunderclap -> thunder
- wind / howling wind -> wind
- storm -> storm
- gunshot / shot rang out -> gunshot
- footsteps / walked -> footsteps
- running / sprint -> footsteps_run
- horse / gallop -> horse_gallop
- market / bazaar / busy crowd -> market_noise or crowd_murmur

### Layer B — manual script tags
Keep support for:
- `[SFX: thunder]`
- `[SFX: rain_heavy]`
- `[SOUND: crowd_cheer]`

Also consider adding:
- `[AMBIENCE: market_noise]`
- `[AMBIENCE: forest_ambience]`

This makes the system much more practical and controllable.

---

# 11. Add source tracking to the SFX system

For every loaded file, allow or require simple metadata:
- source site
- source URL if user wants to save it
- attribution required yes/no
- category
- imported date
- approved for auto mode yes/no
- quality rating

This can be simple at first, but it will help later.

---

# 12. Artlist note

Add a separate note in the help area:

## Premium sources note
If Henry has premium licensed sources such as Artlist, those files may be imported manually into the local SFX vault too, but they should be clearly marked as premium/internal-use assets.

Do not build this page around automated downloading from premium sources.
Manual import first.

---

# 13. What Claude Code should build in this pass

## Main objective
Finish the current SFX Library so it becomes easy to load and actually useful.

## Build tasks
1. Keep the current filename-driven library structure
2. Add clickable free resource/help links in the SFX page
3. Add better loading guidance and priority packs
4. Add preview player for loaded files
5. Add source/license note fields where practical
6. Improve auto-mapping + keep manual script tags
7. Add better loaded/missing counters by category
8. Make the page feel like a real loading/control hub, not just a checklist

## Important boundary
Do not jump into a giant AI sound design rewrite in this pass.
Use the current cue planning + stock/manual layer and make it strong first.

---

# 14. Reporting requirements

At the end of this pass, report clearly:
- exact files changed
- whether clickable links were added
- whether preview for loaded SFX works
- whether category counts improved
- whether source/license notes were added
- how automatic keyword mapping works now
- what manual script tags are supported
- what still remains before SFX Library can be called strong

---

# 15. Final purpose

The purpose is simple:

**Use the current SFX Library foundation, load it with real free online resources, make the resource links clickable, strengthen cue planning and filename mapping, and make GioHomeStudio’s stock/manual sound layer truly usable before attempting more advanced automatic cinematic sound design.**

