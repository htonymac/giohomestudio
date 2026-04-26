# Claude Code Command — Overlay/Text System Upgrade + New Reference Ad Video

Use this as the next implementation brief.

---

## Instruction

I have added another ad/reference video in:

`/users/user/claude/giohomestudio/images`

Use that new reference video together with the earlier examples to study:
- the text style
- the caption style
- the overlay behavior
- the reveal pattern
- the pacing
- the sticker/card look
- the placement of text over video

Important:
Before implementing anything, back up the current working stage first.
Do not break the current codebase.
Create a safe restore point before changes.

Backup requirement:
- create a backup branch or snapshot first
- record the current state clearly
- do not overwrite working behavior without rollback safety
- if schema or overlay model changes are needed, do them carefully and document them

---

## Main Goal

Upgrade the overlay/text system in the real video editor so it behaves more like modern social media and property ad reels.

This is not just a UI request.
It must work in:
- the real Video Review page
- the real preview
- the real final compile/export pipeline

Do not build a disconnected prototype.
Extend the real system.

---

## New Input to Use

I added a new reference ad video in `/users/user/claude/giohomestudio/images`.

Please study that video carefully and extract:
- how the headline enters
- how the caption blocks appear
- whether the reveal is typewriter, line-by-line, word-by-word, wipe, staggered, or slide/fade combination
- how the white sticker/card background looks
- spacing and timing between text blocks
- how text sits safely without ugly overlap
- how promo callouts are styled

Use this new reference video as part of the implementation brief, not as a separate idea.
Blend its behavior into the overlay upgrade plan below.

---

## PART 1 — NEW REEL AD LAYOUT PRESET

Build a new reel ad layout preset.

Preset name:
**Top / Media / Bottom**

Structure:
- Top section = headline text
- Middle section = video/image
- Bottom section = caption / CTA / phone / website

Requirements:
- 1080x1920 vertical output
- safe margins
- auto-wrap text
- no overlap
- separate controls for top and bottom text
- preview must match export
- section-based layout engine, not random absolute placement

Make this selectable in the UI as a preset:
**Top / Media / Bottom**

Do not stop at UI only.
Fix the render engine so this works in both preview and final compile/export.

---

## PART 2 — IMPROVE TEXT OVERLAY SYSTEM

Major upgrade needed in text overlay.

Need support for:
- text formatting
- text style presets
- text background cards / sticker-style labels
- text animation
- slide in
- fade in
- fade out
- flow from left
- flow from right
- drag function to drag text to any position
- better text timing controls
- layered text blocks
- word-by-word reveal
- line-by-line reveal
- reusable overlay presets for reels and ads

This must work from the current **Video Review page** where overlays are already edited.

---

## PART 3 — OVERLAY STYLES / ANIMATION MODES

I want the text style to feel like modern property ads and social media promo reels.

Add these overlay animation modes:

### 1. Typewriter Reveal
- text appears character by character
- adjustable typing speed
- optional cursor effect
- optional pause after full text appears

### 2. Word-by-Word Reveal
- each word appears one after another

### 3. Line-by-Line Reveal
- each line appears sequentially
- useful for stacked promo text

### 4. Staggered Reveal
- each text block enters with slight delay
- useful for headline, subheadline, CTA sequence

### 5. Slide In Left
- text enters from the left and settles into position

### 6. Slide In Right
- text enters from the right and settles into position

### 7. Fade In
- text fades into view smoothly

### 8. Fade Out
- text fades away smoothly

### 9. Pop In / Bubble In
- text appears with small scale-up bounce effect

### 10. Wipe Reveal / Mask Reveal
- text looks like it is being uncovered by a moving mask

### 11. Sticker Card Text
- text sits on a white rough card / brush label / sticker background
- supports shadow, padding, rounded corners, rough paper look, or paint-stroke feel

### 12. Callout Text Block
- highlighted background block for promo points like:
  - Smart TV + Netflix
  - 25 minutes from Eko Atlantic
  - 60k/night

Also compare these modes against the newly added reference ad video and implement whichever combination best matches what is actually seen there.

---

## PART 4 — TEXT STYLE CONTROLS

Add controls for:
- font family
- font size
- font weight
- text color
- line height
- letter spacing
- text align
- uppercase toggle
- stroke / outline
- shadow
- background color
- background opacity
- padding
- corner radius
- sticker/card style
- brush style background
- quote style highlight
- multi-line spacing

---

## PART 5 — DRAG / POSITIONING

Add drag support in preview:
- user can drag text anywhere
- snap guides for alignment
- show safe margins
- optional lock-to-grid
- optional free positioning
- keep same final position in export

Need positioning modes:
- free mode
- top anchor
- center anchor
- bottom anchor
- left / center / right alignment anchors

---

## PART 6 — TIMELINE / ANIMATION CONTROLS

Each text overlay should have:
- start time
- end time
- in animation
- out animation
- duration
- delay
- easing
- movement distance for slide effects
- opacity curve
- scale curve for pop/bubble effect

---

## PART 7 — PRESETS / TEMPLATES

Create reusable preset overlay styles like:
- Typewriter Promo
- Bubble Promo
- Sticker Caption
- Brush Label
- Bold CTA
- Lower Third Promo
- Quote Card
- Real Estate Feature Highlight

Also add user-friendly quick templates.
This must be easy for non-technical users making promo/property ads.

---

## PART 8 — VIDEO REVIEW PAGE INTEGRATION

Take overlay editing to the Video Review page where it already exists and expand it there.

On the Video Review page, add:
- add text button
- choose overlay preset/template
- choose animation style
- edit text content
- drag and reposition
- timing controls
- style controls
- duplicate overlay
- delete overlay
- reorder layers
- preview animation before export

Suggested UI sections:
- Content
- Style
- Animation
- Position
- Timing
- Templates

Make the page very user friendly.

---

## PART 9 — ENGINE REQUIREMENT

Do not hack this with random CSS only.

I want a proper overlay model in both preview and export.

Need shared layout/render logic so preview and final compiled video match.

Please refactor overlay rendering into a real system with:
- content
- style
- animation
- position
- timing
- background card
- render bounds
- export-safe measurement

The layout engine and overlay engine should share the same math/measurement logic between:
- editor preview
- review preview
- final compile/export

---

## PART 10 — ACCEPTANCE CRITERIA

Acceptance criteria:
- I can add text from the Video Review page
- I can choose a reveal style
- I can make text appear like typing
- I can make text appear word by word or line by line
- I can drag text in preview
- I can use Top / Media / Bottom preset
- preview matches final export
- text does not overflow unexpectedly
- sections do not overlap
- overlays look like modern social media ad overlays
- system is user friendly
- templates are available for quick use
- the newly added reference ad video is reflected in the implementation style

---

## PART 11 — DELIVERY EXPECTATION

Do this as a real implementation, not a mockup.

Before finishing:
1. review current overlay architecture
2. identify what is preview-only vs export-only
3. back up current working state
4. fix the mismatch
5. implement the new overlay model
6. connect it to the Video Review page
7. test with sample real estate/property ad content
8. test against the new reference ad video in `/users/user/claude/giohomestudio/images`
9. confirm exported output matches preview

Show me:
- files changed
- backup branch/snapshot name
- overlay data model
- UI changes
- animation types added
- how preview/export are kept in sync
- which parts were inspired by the new reference video
- remaining limitations if any

---

## Safety Instruction

Do not rush and do not break working flows.
Back up first.
Implement in controlled steps.
If a risky refactor is needed, isolate it and verify before merging into the main working path.

