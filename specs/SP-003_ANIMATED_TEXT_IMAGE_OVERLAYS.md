# SPEC: SP-003 — ANIMATED TEXT & IMAGE OVERLAY SYSTEM
# SPEC ID: SP-003
# FEATURE: Animated Text & Image Overlay System (Feature 1 from FEATURE_SPEC_001.md)
# BUILD ORDER: PRIORITY 2 — Build after SP-002 is complete and tested
# WRITTEN BY: Claude Code — 2026-04-04
# STATUS: Ready to build — waiting for SP-002 to be complete first

---

## WHAT THIS FEATURE DOES (plain English)

GioHomeStudio currently has no way to put text or images on top of a video.
This feature adds a collapsible overlay panel that lets Henry:
- Add text layers (commercial copy, headlines, CTAs, contact lines)
- Add image layers (logos, watermarks, property shots)
- Control position, size, animation entrance, timing, and style
- Preview the result (3-second preview clip)
- Apply to the full render

The panel appears in the content detail page and the commercial editor.
Overlays are stored as JSON on the ContentItem.

---

## WHAT ALREADY EXISTS (do not rebuild these)

- `src/modules/ffmpeg/index.ts` — FFmpeg merge, slideshow, trim, concatenate. DO NOT REWRITE.
- `app/dashboard/content/[id]/page.tsx` — Content detail page
- `app/dashboard/commercial/page.tsx` — Commercial editor
- `prisma/schema.prisma` — ContentItem model
- `src/config/env.ts` — storage paths

---

## WHAT TO BUILD

### New files to CREATE:

| File | What it contains |
|------|-----------------|
| `src/modules/ffmpeg/overlay.ts` | FFmpeg filter_complex builder for text and image overlays. Takes a list of OverlayLayer objects, produces a drawtext/overlay filter chain. |
| `app/api/overlays/preview/route.ts` | POST — accepts video path + overlay layers, renders a 3-second preview clip, returns preview URL |
| `app/api/overlays/render/route.ts` | POST — accepts contentItemId + overlay layers, re-renders the full video with overlays applied, updates ContentItem |
| `app/components/OverlayPanel.tsx` | Collapsible overlay editor panel — add/edit/remove text and image layers, preview, apply |

### Files to MODIFY (extend only — never replace):

| File | What changes | What stays the same |
|------|-------------|---------------------|
| `app/dashboard/content/[id]/page.tsx` | Add OverlayPanel below video player | All review controls, approval flow, AI suggestions |
| `app/dashboard/commercial/page.tsx` | Add OverlayPanel to the render section | All slide management, Mode 1 manual, Mode 2 AI builder |
| `prisma/schema.prisma` | Add `overlayLayers Json?` to ContentItem | All existing fields |
| `src/modules/ffmpeg/index.ts` | Import and re-export `applyOverlays` function | All existing functions |

### Files that must NOT be touched:
- `.env` and `.env.local`
- Existing FFmpeg functions (mergeAudio, createSlideshow, trimVideo, etc.)
- Commercial slide logic
- Review / approval flow
- Any auth files

---

## OVERLAY LAYER DATA STRUCTURE

Each overlay layer is one entry in the `overlayLayers` JSON array stored on ContentItem.

### Text Layer:
```typescript
{
  type: "text",
  id: string,            // unique layer ID
  text: string,          // the text to display (multi-line supported with \n)
  position: {
    zone: "top" | "center" | "bottom" | "free",
    x?: number,          // used when zone = "free" (0-100% of width)
    y?: number           // used when zone = "free" (0-100% of height)
  },
  style: {
    fontSize: number,    // e.g. 48
    fontWeight: "normal" | "bold",
    color: string,       // hex e.g. "#FFFFFF"
    bgColor?: string,    // box background e.g. "black@0.5" (semi-transparent)
    shadow: boolean,     // true = drawtext shadowx/shadowy
    outline: boolean     // true = drawtext borderw
  },
  animation: {
    entrance: "none" | "slide_left" | "slide_right" | "slide_top" | "slide_bottom" | "fade_in",
    startSec: number,    // when the text appears (seconds from start)
    durationSec: number  // how long it stays visible
  }
}
```

### Image Layer:
```typescript
{
  type: "image",
  id: string,
  imagePath: string,     // path relative to storage root
  position: {
    zone: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center" | "free",
    x?: number,
    y?: number
  },
  size: {
    width: number,       // pixels
    height: number       // pixels
  },
  animation: {
    entrance: "none" | "slide_left" | "slide_right" | "slide_top" | "slide_bottom" | "fade_in",
    startSec: number,
    durationSec: number
  }
}
```

---

## OVERLAY PANEL UI — OverlayPanel.tsx

Collapsible (collapsed by default). When collapsed: shows layer count in one line.
When expanded:

```
[ + Add Text Layer ]  [ + Add Image Layer ]

--- Layer 1 (text) ----------------------------
Text:        [ luxury shortlet — book 24/7 ]
Position:    [ Top / Center / Bottom / Free ]
Font size:   [ 48 ]  Color: [ #FFFFFF ]
Background:  [ none / dark box ]
Shadow:      [ on/off ]
Animation:   [ None / Slide Left / Slide Right / Slide Top / Slide Bottom / Fade In ]
Start at:    [ 0.5 ] seconds   Duration: [ 3 ] seconds
[ Remove Layer ]

--- Layer 2 (image) ----------------------------
Image:       [ upload or select from library ]
Position:    [ Bottom-Left / Bottom-Right / Top-Left / Top-Right / Center / Free ]
Size:        [ 200 ] x [ 80 ] px
Animation:   [ None / Slide Left / ... ]
Start at:    [ 0 ] seconds   Duration: [ full video ]
[ Remove Layer ]

[ PREVIEW (3 sec) ]    [ APPLY TO VIDEO ]
```

Preview renders a 3-second clip (from second 2 to second 5) with overlays applied.
Apply re-renders the full video and updates the ContentItem.

---

## FFMPEG OVERLAY FILTER BUILDER (overlay.ts)

The `buildOverlayFilterComplex` function takes:
- `videoPath: string`
- `layers: OverlayLayer[]`

Returns an object:
```typescript
{
  filterComplex: string,    // the full filter_complex string for FFmpeg
  outputMap: string         // the final output stream label e.g. "[v_out]"
}
```

### Text overlay — drawtext filter:
```
drawtext=text='...'
  :fontsize=48
  :fontcolor=white
  :x=(w-text_w)/2          (centered) or fixed pixel value
  :y=h-100                 (bottom) or fixed pixel value
  :shadowx=2:shadowy=2     (if shadow enabled)
  :borderw=2               (if outline enabled)
  :box=1:boxcolor=black@0.5 (if bgColor set)
  :enable='between(t,startSec,startSec+durationSec)'
```

### Image overlay — overlay filter:
```
[1:v]scale=200:80[logo];
[0:v][logo]overlay=x=10:y=H-h-10:enable='between(t,0,999)'[v_out]
```

### Animation — implemented via FFmpeg expressions:
- `slide_left`: `x=W-(W+text_w)*min(1,(t-startSec)/0.5)` (slides in from right over 0.5s)
- `slide_bottom`: `y=H-(H+text_h)*min(1,(t-startSec)/0.5)`
- `fade_in`: `alpha='min(1,(t-startSec)/0.5)'` (text layers via drawtext alpha)

### Multiple layers:
Chain filters sequentially. Each layer takes the previous output as input.
Label intermediate outputs: `[v1]`, `[v2]`, etc. Final output: `[v_out]`.

---

## API ROUTES

### POST /api/overlays/preview
Input:
```json
{
  "videoPath": "storage/outputs/content_abc/video.mp4",
  "layers": [ ...OverlayLayer[] ],
  "startSec": 2,
  "durationSec": 3
}
```
Process:
1. Build filter_complex from layers
2. FFmpeg: extract 3-second clip WITH overlays applied
3. Save to `storage/previews/overlay_preview_{timestamp}.mp4`
4. Return preview URL

Output:
```json
{
  "previewUrl": "/api/files/previews/overlay_preview_1234567890.mp4"
}
```

### POST /api/overlays/render
Input:
```json
{
  "contentItemId": "abc123",
  "layers": [ ...OverlayLayer[] ]
}
```
Process:
1. Load ContentItem — get video output path
2. Build filter_complex from layers
3. FFmpeg: render full video with overlays applied
4. Save output alongside original (don't overwrite — save as `video_overlay.mp4`)
5. Update ContentItem: set `overlayLayers` JSON, set `outputPath` to new file
6. Return updated contentItemId

Output:
```json
{
  "contentItemId": "abc123",
  "outputPath": "storage/outputs/content_abc/video_overlay.mp4",
  "layerCount": 2
}
```

---

## DATABASE CHANGES

Add to ContentItem in prisma/schema.prisma:
```prisma
overlayLayers   Json?   // array of OverlayLayer objects
```

After schema change: run `npx prisma migrate dev --name add_overlay_layers`

---

## QUALITY GATES (must all pass before Feature 1 is done)

- [ ] OverlayPanel renders in content detail page without errors
- [ ] OverlayPanel renders in commercial page without errors
- [ ] Can add a text layer with text, position, font size, color
- [ ] Can add an image layer with position and size
- [ ] Preview button renders a 3-second clip with overlays visible
- [ ] Preview plays in the browser
- [ ] Apply button re-renders full video with overlays applied
- [ ] overlayLayers JSON is stored on ContentItem after apply
- [ ] Multi-line text works (line breaks preserved)
- [ ] Animation entrance (at least slide_left and fade_in) visible in preview
- [ ] No existing FFmpeg functions broken (slideshow, trim, narrate still work)
- [ ] No existing commercial slide logic broken
- [ ] Playwright test covers: panel renders, preview API called, overlayLayers stored

---

## ESCALATION TRIGGERS — Stop and tell Henry if:

- FFmpeg drawtext font not found on the Windows system (need to specify font path)
- FFmpeg version on the system does not support the overlay filter syntax used
- Image overlay causes FFmpeg to fail on certain video resolutions
- Prisma migration fails

---

## SESSION START CHECKLIST

Before writing any code:
1. Read this spec top to bottom
2. Confirm SP-002 (Feature 3) is fully complete and quality gates all pass
3. Read `src/modules/ffmpeg/index.ts` — understand existing function signatures
4. Read `app/dashboard/content/[id]/page.tsx` — find the right insertion point
5. Run `npx tsc --noEmit` — confirm zero TypeScript errors before starting
6. Tell Henry: "Ready to build Feature 1 — Animated Text & Image Overlays. Starting with overlay.ts"
7. Wait for GO AHEAD
