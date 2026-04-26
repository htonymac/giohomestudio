# GioHomeStudio Commercial section update and input

We are continuing GioHomeStudio from an already-working localhost build.

This document is an instruction update for Claude Code.
Its purpose is to integrate the **commercial / ad-making side** of GioHomeStudio into the current product in a way that stays aligned with the existing GioHomeStudio architecture, source-of-truth, Free Mode direction, supervisor logic, review flow, and modular pipeline.

This document is **not** a command to replace the current GioHomeStudio architecture.
It is a controlled commercial-mode update.

---

# 1. Core alignment rule

The uploaded merged commercial document contains useful commercial/ad-builder ideas, but some parts conflict with the current GioHomeStudio direction.

So the rule is:

## Keep
- the strong commercial-maker product ideas
- slide-based promotional video builder logic
- image enhancement ideas
- caption polish ideas
- CTA/end-card ideas
- export format support
- project save / render job tracking concepts
- real estate / product / business promo use cases

## Do not overwrite
- the current GioHomeStudio working localhost build
- the current Next.js/TypeScript application structure unless there is a very strong reason
- the current modular provider system
- the local supervisor/orchestrator direction
- the current Review / revise / re-merge flow
- the existing Free Mode direction
- the current multi-mode architecture

## Important
Commercial capability must become a **mode inside GioHomeStudio**, not a separate replacement product and not a rewrite of the full system.

---

# 2. What Commercial Maker should mean inside GioHomeStudio

Commercial Maker should become GioHomeStudio’s dedicated **commercial production mode** for:
- real estate promo videos
- property marketing
- product ads
- small business promo videos
- image-led promotional reels
- simple branded social media ads

It should use the GioHomeStudio engine and finishing flow, but with a specialised commercial-focused UI and controls.

### Correct positioning
Commercial Maker is not the whole platform.
It is one production mode under GioHomeStudio.

### Correct product definition
Commercial Maker should help the user:
- upload property/product/business images
- create image-led commercial slides or beats
- add captions and polished marketing text
- add branding and CTA
- add music and optional narration
- preview the commercial clearly
- export in social-ready formats
- review, revise, and approve inside the same GioHomeStudio flow

---

# 3. Architecture alignment with existing GioHomeStudio

## 3.1 Keep current app foundation
Do not use this document to replace the current working GioHomeStudio foundation.

Commercial Maker must fit into the existing architecture direction:
- current localhost web app remains the main interface
- current modular workers remain valid
- current provider/fallback logic remains valid
- current review/detail/revise flow remains valid
- current supervisor/orchestrator layer remains valid
- commercial mode should plug into the same asset registry and finishing desk

## 3.2 Commercial mode uses the same shared engine
Commercial Maker should use the common GioHomeStudio flow:

**Interpret -> Plan -> Generate assets -> Sync on timeline -> Review -> Final render**

For commercial jobs, that means:
- interpret uploaded commercial assets and user goal
- plan slide/beat order
- enhance images
- prepare captions / CTA / branding
- add narration if needed
- add soundtrack if needed
- assemble on timeline
- show result in review
- allow revise / replace / re-merge

## 3.3 Local supervisor still matters
Commercial Maker should not be “manual only.”
The local supervisor should still help by:
- reading the commercial intent
- suggesting a commercial structure
- recommending caption style
- suggesting music mood
- deciding whether narration is useful
- suggesting export format
- preparing a commercial plan before assembly

---

# 4. Commercial mode product promise

A user opens Commercial Maker and can build a polished promotional video from images, captions, branding, narration, and music without needing a full AI video generation credit path.

### Key promise
Commercial Maker should be able to produce strong commercial output using:
- uploaded images
- optional uploaded clips
- caption overlays
- enhancement
- branding
- soundtrack
- CTA / end-card
- optional narration
- optional image+audio rhythm
- timeline assembly

### Important rule
Commercial Maker must not depend on Kling or Runway for its core value.
AI video generation can be optional for premium moments only.
The main value should come from strong local/media assembly.

---

# 5. Commercial mode feature groups

## 5.1 Slide / beat builder
Commercial Maker should support a slide-based or beat-based promotional structure.

### Core unit
Each commercial project is built from **slides** or **beats**.
Each one can contain:
- image
- optional short clip
- caption
- optional polished caption version
- enhancement settings
- orientation / fit handling
- optional branding overlay
- optional narration line
- optional timing settings

### Expected behavior
- user can add up to a reasonable number of slides/beats
- each slide appears in a left-side ordered list
- selecting a slide loads it into the editor/preview
- reordering slides should be supported
- missing caption or missing media should be visibly flagged

### Keep aligned with GioHomeStudio
Do not build this as a separate dead-end editor.
These slides/beats must still flow into the shared timeline and review system.

---

## 5.2 Live preview
Live preview is mandatory for commercial work.

### Preview should show
- selected image or clip
- caption overlay
- orientation fit
- enhancement effect approximation
- logo/branding if enabled
- CTA/end-card preview where applicable
- safe viewing for selected aspect ratio

### Important rule
The preview must feel safe enough that Henry can trust what he is about to render.

### Alignment rule
This should use GioHomeStudio’s current improved playback/preview logic, not start a second unrelated preview system.

---

## 5.3 Orientation and output format handling
Commercial videos need clean format control.

### Required formats
- 16:9
- 9:16
- 1:1

### Future-safe optional formats
- 4:3
- 3:4

### Important rules
- portrait images must never be stretched
- landscape images must never be squashed
- use blur fill / clean padding / smart framing where needed
- output format and preview format must stay consistent

### Alignment rule
Use the same aspect-ratio-aware logic already built into GioHomeStudio.
Do not create conflicting preview/render behavior.

---

## 5.4 Image enhancement system
Commercial Maker should include strong image enhancement because commercial content often depends more on image polish than AI video generation.

### Commercial enhancement modes
- Auto enhance
- Manual slider
- Presets

### Manual control groups may include
- brightness
- contrast
- saturation
- tint / warmth
- sharpen
- blur/noise reduction
- vignette
- tone mood

### Preset examples
- Cinematic
- HDR
- Natural
- Clean Social
- Warm Promo

### Important alignment note
The enhancement system must fit the GioHomeStudio worker model.
If enhancement is performed locally, integrate it as an enhancement worker or processing step rather than as a completely separate backend philosophy.

---

## 5.5 Caption and text polishing system
Commercial mode needs strong text/caption handling.

### Two levels
1. local/basic polish
   - punctuation cleanup
   - capitalization fix
   - spacing fix
   - basic marketing cleanup
2. AI/pro rewrite
   - stronger marketing tone
   - platform-specific rewrite
   - more persuasive structure

### Important UX requirement
Before applying a caption rewrite, show:
- original text
- proposed polished text
- accept
- reject

### Alignment rule
This should fit the same general review philosophy already present in GioHomeStudio.

---

## 5.6 Music and narration for commercial mode
Commercial videos need stronger, clearer audio controls.

### Music support
Commercial Maker should support:
- uploaded music
- stock/local music
- pixabay/local downloaded music
- generated music if available later

### Music requirements
- preview before commit
- show exact source label
  - uploaded
  - stock
  - pixabay
  - generated
  - fallback
- music volume control
- easy replacement on Review page

### Narration support
Commercial Maker should support optional narration such as:
- property description narration
- product feature narration
- brand/promo voiceover

### Important rule
Commercial narration should use **narrationScript**, not cinematic prompt text.

### Future-safe note
Caption readout and richer voice direction can evolve from the same narrative audio system already planned in GioHomeStudio.

---

## 5.7 CTA / contact overlay system
The merged doc contains a strong CTA idea. Keep it, but align it with GioHomeStudio.

### CTA should support
- WhatsApp
- Call
- Telegram
- Email later
- Messenger later

### CTA data per project
- CTA method
- phone / handle / address / link
- CTA label text
- optional preset
- end-card styling

### CTA placement
- final slide
- branded end-card
- optional lower-third for some commercial formats later

### Reusable preset
Henry should be able to save contact presets and load them quickly.

### Alignment rule
This should be a commercial overlay component inside GioHomeStudio, not a standalone contact subsystem.

---

## 5.8 Branding and end-card
Commercial mode should support basic brand finishing.

### Brand elements
- business name
- logo
- colour accent
- CTA line
- tagline
- end-card layout

### Important rule
This should stay simple and practical first.
Do not turn this into a full template marketplace yet.

---

# 6. Commercial mode should support both slide commercials and ad storytelling

Commercial Maker must not be limited to plain slideshow-only output.
It should support two related commercial paths:

## 6.1 Slide commercial path
Best for:
- real estate listings
- product showcase
- simple business promo
- image-led ads

## 6.2 Story-commercial path
Best for:
- emotional product ad
- hero reveal
- narration-led promo
- mixed image + short action moments

### Important alignment
This story-commercial path should reuse GioHomeStudio’s broader timeline/supervisor/audio foundation.
So commercial mode can grow naturally into:
- text to images + audio commercial
- hybrid commercial with a few action clips
- stronger narration-led ads later

---

# 7. Commercial mode UI direction

Commercial mode should have a focused commercial workspace inside the current GioHomeStudio app.

## Suggested layout
### Left panel
- project info
- slide/beat list
- add/reorder/remove slide
- missing-content markers

### Center panel
- large live preview
- aspect-ratio-aware commercial preview
- selected slide frame preview
- timeline/beat visibility later if needed

### Right panel
- selected slide settings
- caption settings
- enhancement controls
- branding / CTA controls
- narration/music controls

### Important rule
Do not make the screen tiny or cluttered.
The preview must remain important.
Commercial mode should feel clean, usable, and safe.

---

# 8. Commercial mode review and finishing desk

Commercial projects must go through GioHomeStudio’s existing Review / revise / re-merge philosophy.

## On Review/detail page for commercial mode, user should be able to
- preview full commercial
- inspect slide order
- inspect captions
- inspect narrationScript if narration exists
- inspect actual music source
- replace music
- replace narration
- edit CTA/end-card
- edit branding details
- revise back to Commercial Maker with settings prefilled
- re-render without rebuilding unrelated assets
- approve
- reject

### Important rule
Commercial mode must not bypass the finishing desk.
It should fit into it naturally.

---

# 9. Data model alignment

Do not replace the current GioHomeStudio database direction.
Extend it in a controlled way for commercial mode.

## Commercial project fields may include
- mode = commercial
- projectName
- exportFormat
- brandSettings
- ctaSettings
- audioTrackSource
- narrationScript
- enhancementPreset
- globalEnhancementSettings
- slideCount
- renderStatus
- outputPath

## Commercial slide/beat fields may include
- slideOrder
- imagePath
- optionalClipPath
- captionOriginal
- captionPolished
- captionApproved
- fontSettings
- enhancementSettings
- orientationMode
- brandingEnabled
- narrationLine
- duration
- status

## Render tracking should include
- jobId
- projectId
- status
- progressPercent
- startedAt
- completedAt
- outputPath
- errorDetails

### Important rule
Keep render errors visible and debuggable.
Never silently fail.

---

# 10. What from the merged file should be postponed

Some ideas in the merged file are valuable but should **not** be allowed to derail the current build.

## Postpone for later
- full publishing automation as part of this commercial update
- later app integration as part of this pass
- full analytics pull as part of this pass
- mobile app build
- multi-user SaaS layer
- full inventory/performance intelligence rewrite
- using this commercial update to replace the whole app stack
- forcing a Python/FastAPI migration if the current working structure does not require it right now

### Important
Commercial section update should plug into what exists now and improve it, not restart the product.

---

# 11. Build priority for this commercial update

Claude Code should treat this as a controlled commercial-mode extension.

## Recommended order
### Step 1 — Commercial mode structure
- add Commercial Maker as a first-class mode inside GioHomeStudio
- create mode entry point, navigation, and project type handling

### Step 2 — Slide/beat editor
- image upload
- caption per slide
- ordering
- basic preview
- aspect-ratio-safe display

### Step 3 — Enhancement and caption polish
- enhancement controls
- preset system
- compare-before-apply caption polish

### Step 4 — Audio + CTA
- soundtrack upload/preview/replace
- optional narrationScript support
- CTA / end-card fields and preview

### Step 5 — Render + review integration
- render path
- job tracking
- review/detail integration
- revise flow
- approve/reject

### Step 6 — Story-commercial extension
- allow commercial mode to use image+audio rhythm and limited story-commercial logic where it fits

---

# 12. Commercial mode source-of-truth statement

Commercial Maker must be aligned with the true GioHomeStudio direction:
- one product
- multiple modes
- one supervisor direction
- one timeline direction
- one review/finishing desk
- one modular provider/worker architecture

Commercial capability is important, but it must strengthen GioHomeStudio — not split it into two conflicting products.

---

# 13. Instruction to Claude Code

Read this document as a **commercial-mode update**, not as permission to overwrite the current GioHomeStudio foundation.

## What you must do
- extract the best commercial/ad-making ideas from the merged document
- fit them into the current GioHomeStudio architecture
- preserve current working flow
- preserve current review/revise/re-merge direction
- preserve current supervisor/modular direction
- preserve current mode-based product structure

## What you must not do
- do not restart the product around a conflicting stack unless absolutely necessary
- do not replace the current architecture with a separate HMK-style product
- do not derail current Free Mode completion work
- do not expand into unrelated future systems in this pass

## Deliverable expectation
At the end of the commercial update pass, report clearly:
- what commercial features were integrated
- what was adapted to fit GioHomeStudio
- what merged-file ideas were postponed
- exact files changed
- exact DB changes
- how Commercial Maker now fits the existing modes and review flow
- what should be next after this controlled commercial integration

---

# 14. Final purpose

The purpose is simple:

**Make the commercial side of GioHomeStudio strong, practical, and aligned with the real GioHomeStudio system — without breaking the current build or turning the product into a conflicting rewrite.**

