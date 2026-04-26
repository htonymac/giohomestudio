# Commercial Maker — Feature Roadmap

## Status Legend
- ✅ Done
- 🔨 In Progress
- 📋 Planned

---

## PHASE 1 — Motion & Transitions (CURRENT)
> Makes static photos feel like a real TV commercial

### 1.1 Ken Burns Effect (pan & zoom on images)
- [ ] Per-slide motion preset: `zoom-in`, `zoom-out`, `pan-left`, `pan-right`, `pan-up`, `pan-down`, `none`
- [ ] Intensity slider (subtle → dramatic)
- [ ] FFmpeg `zoompan` filter applied at render time
- [ ] Preview indicator in slide thumbnail (motion icon badge)

### 1.2 Slide Transitions
- [ ] Transition type per slide: `fade`, `slide-left`, `slide-right`, `slide-up`, `zoom-in`, `none`
- [ ] Duration slider per transition (0.3s – 1.5s)
- [ ] FFmpeg `xfade` filter between consecutive slides
- [ ] Preview chips in the slide list panel

### 1.3 Caption Animation
- [ ] Caption entry animation: `fade-up`, `fly-in-left`, `fly-in-right`, `typewriter`, `none`
- [ ] Timing offset from slide start (0 – 2s delay)
- [ ] Rendered via Playwright HTML animation → PNG sequence or CSS animation export

---

## PHASE 2 — Visual Overlays & Branding
> Looks like a real Nigerian/African commercial

### 2.1 Logo / Watermark
- [ ] Upload brand logo (PNG with transparency)
- [ ] Position picker: 9-zone grid (top-left, top-center, top-right, mid-left, center, mid-right, bottom-left, bottom-center, bottom-right)
- [ ] Opacity slider
- [ ] Size slider
- [ ] Applied to every slide via FFmpeg overlay filter

### 2.2 Price Badge
- [ ] Toggle "Show price" on any slide
- [ ] Price text input (e.g. ₦5,000 / $29)
- [ ] Style: circle badge, ribbon banner, pill tag
- [ ] Color: accent color from project settings
- [ ] Position: top-right / bottom-left corner

### 2.3 Urgency / Offer Banner
- [ ] Toggle "Show offer banner"
- [ ] Banner text (e.g. "Offer ends Friday!", "50% off today only")
- [ ] Style: top ribbon, bottom ticker, corner sticker
- [ ] Auto-appears on specific slides or all slides

### 2.4 CTA Slide Preview
- [ ] Live preview of the final CTA frame in the editor (currently invisible until render)
- [ ] Shows phone number, WhatsApp icon, brand color
- [ ] Edit CTA directly from preview panel

---

## PHASE 3 — Workflow Speed
> Remove friction from building the ad

### 3.1 Generate All Captions (Bulk)
- [ ] Single button: reads ALL slide images with AI at once
- [ ] Progress indicator per slide
- [ ] Accept/reject panel for all results at once
- [ ] Respects captionMaxWords / captionMaxChars settings

### 3.2 Slide Duplicate
- [ ] Right-click or button: duplicate slide with all settings
- [ ] Duplicated slide inserted directly after original

### 3.3 Bulk Narration from Brief
- [ ] Text area: write one brief for the whole commercial
- [ ] AI splits it into one narration line per slide
- [ ] Accept/reject per slide

### 3.4 Undo (single step)
- [ ] Ctrl+Z undoes last caption / narration text change
- [ ] In-memory only (no DB rollback)

---

## PHASE 4 — Project Polish
> Small things that feel premium

### 4.1 Color Accent Visual Picker
- [ ] Replace hex input with visual color wheel / swatches
- [ ] Live preview on caption style

### 4.2 Aspect Ratio Preview Switch
- [ ] Toggle preview between 9:16 / 16:9 / 1:1 without changing project
- [ ] Visual only — does not affect render

### 4.3 Background Color for Empty Slides
- [ ] Solid color fill when no image uploaded
- [ ] Color picker + pattern selector (solid, gradient, diagonal)

### 4.4 Intro Slide Template
- [ ] Pre-built branded first frame
- [ ] Shows: brand name + tagline + logo
- [ ] Animated in via Ken Burns + caption animation

### 4.5 Re-render Single Slide
- [ ] Re-render just one slide and replace in output
- [ ] Saves time vs full project re-render

---

## PHASE 5 — Analytics & Publishing
> Close the loop after the ad is made

### 5.1 Video Performance Tag
- [ ] After render, tag the video: "Real Estate", "Food", "Fashion" etc.
- [ ] Used to group ads by category in the content list

### 5.2 WhatsApp/Call Preview
- [ ] Show mock phone screen with the ad playing + CTA button
- [ ] Static mock — visual only

---

## Implementation Order
1. 🔨 **Ken Burns (1.1)** — biggest visual impact, FFmpeg zoompan
2. 📋 **Slide Transitions (1.2)** — xfade filter, completes motion story
3. 📋 **Generate All Captions (3.1)** — removes biggest daily friction
4. 📋 **Logo/Watermark (2.1)** — most requested by Nigerian business owners
5. 📋 **Price Badge (2.2)** — direct revenue message on screen
6. 📋 **Slide Duplicate (3.2)** — quick workflow win
7. 📋 **CTA Slide Preview (2.4)** — close the blind spot
8. 📋 **Bulk Narration (3.3)** — saves narration setup time
9. 📋 **Urgency Banner (2.3)** — marketing punch
10. 📋 **Color Picker (4.1)** — small polish
