# GioHomeStudio — Incomplete / Pending Tasks
Updated: 2026-04-08

## COMPLETED THIS SESSION (2026-04-08)

### 1. Fix Image Overlay — Upload Logo
- [x] Image overlay now has UPLOAD button (not just path input)
- [x] Thumbnail preview of uploaded logo
- [x] Works in OverlayPanel for both standalone editor and Commercial

### 2. Fix Overlay Preview Button
- [x] Fixed FFmpeg error code 4294967274 (-22 EINVAL)
- [x] Fixed `-t` arg splitting bug in fluent-ffmpeg
- [x] Fixed enable expressions using absolute times after seek (now time-offset adjusted)
- [x] Load Preset button was working — issue was FFmpeg execution, not preset loading

### 3. Asset Library Improvements
- [x] Already complete: inline popup player, download button, new tab, delete, "Use" button

### 4. Review Queue — Open Video in New Tab
- [x] Converted 3 onClick/router.push to proper `<a>` tags
- [x] Video card, title text, and "View full details" link all support right-click → open in new tab

### 5. DJ Section — Beats & Waveform
- [x] Added WaveformVisualizer component (Web Audio API)
- [x] Waveform bar display with amplitude coloring
- [x] Beat detection with BPM estimate
- [x] Beat pattern indicator strip
- [x] Playback position indicator when track is playing

### 6. Intro Page with Real Videos
- [x] Hero section with background video + gradient overlay
- [x] 6 real demo video cards (hover-to-play) from update/Intro/ files
- [x] Feature grid (7 output modes, 5 voice providers, music, analytics, calendar, publishing)
- [x] CTA sections
- [x] Videos copied to storage/intro/ with clean names

### 7. Image + Motion Transfer Feature
- [x] New tool tab in Video Tools page
- [x] Upload still image + motion reference video UI
- [x] /api/video-tools/motion-transfer API route
- [x] fal.ai and Segmind provider support
- [x] Creates ContentItem, queues async generation

### 8. Digital Intro/Outro Templates
- [x] 25 templates added to /api/templates (13 intros + 12 outros)
- [x] Categories: corporate, gradient, minimal, cinematic, tech, neon, property, social, news, food, fitness, podcast, afrobeats, education, travel, gaming, wedding
- [x] Outro types: subscribe CTA, thank you, contact card, next video, credits roll, discount code, social links, product CTA

### 9. Standalone Overlay/Video Editor Page
- [x] Already existed at /dashboard/video-editor
- [x] Enhanced with logo upload button (part of fix #1)

### 10. Series Mode Wizard
- [x] New page /dashboard/series-wizard with 5-step wizard
- [x] Step 1: Series basics (title, genre, tone, audience, platform, aspect ratio, duration, visual style)
- [x] Step 2: Character profiles (name, role, description, traits, voice)
- [x] Step 3: Story bible (world, rules, locations, timeline, events)
- [x] Step 4: Episode planning (title, synopsis, status tracking)
- [x] Step 5: Review & launch summary
- [x] /api/series API (GET list, POST create/update)
- [x] Added to sidebar navigation

---

## COMPLETED THIS SESSION (2026-04-08, round 2)

### 12. Intro Page — correct video assignments
- [x] Commercial: orange juice video (demo-commercial-oj.mp4)
- [x] Story Mode: video_cmnb0vnob (demo-story-mode.mp4)
- [x] Short Reel: video_cmnali6dy (demo-short-reel.mp4)

### 13. Logo click → Intro page
- [x] GioHomeStudio sidebar logo now links to / (intro page)

### 14. Mode descriptions
- [x] Each mode (Text→Video, Text→Image, Text→Audio, Image→Video, Hybrid, Video→Video) now shows full description when selected
- [x] Explains what each mode does, how it works, what it's best for

### 15. DJ Mixer — Live Preview
- [x] LiveMixer component with actual HTML5 Audio playback
- [x] Select tracks per layer, hear them play simultaneously
- [x] Volume and pan controls update live while playing
- [x] Solo / Mute / Unmute per layer
- [x] Preview Mix (play all), Pause, Stop controls
- [x] Master EQ (bass/mid/treble) with visual values
- [x] Mix & Export button wired to /api/music/layer

### 16. Templates — Real visual templates (CapCut-style)
- [x] Rebuilt templates API with 30 real usable templates (5 per category)
- [x] Categories: Real Estate, Product Ads, Social Media, Food & Restaurant, Entertainment, Intro/Outro
- [x] Each template has: thumbnail, preview description, pre-filled AI prompt, mode settings, tags
- [x] Rebuilt templates page: card grid, category filters, search, popular row
- [x] Preview modal shows full prompt, settings, tags
- [x] "Use This Template" button opens studio pre-filled with template prompt + settings
- [x] Visual cards with emoji thumbnails, category color coding

## COMPLETED THIS SESSION (2026-04-08, round 3)

### 17. SFX Library — 48 files generated and preloaded
- [x] 48 SFX MP3 files generated via FFmpeg synthesis into storage/sfx/
- [x] Categories: transitions (whoosh, riser, swoosh, sparkle, pop, snap, ding), music/beats (bass_drop, 808, kick, snare, hi_hat, drum_roll), weather (thunder, rain, heavy_rain, wind), nature (ocean, forest_birds, deep_ambience), urban (city_traffic, siren, bell_church, crowd), horror (suspense_drone, tension_build, heartbeat), tech (click, beep, notification, alarm, camera_shutter, typing, error, static, sci_fi_hum), household (door_knock, phone_ring, coin), vehicle (motor_rev), impact (explosion, boom, rumble, sub_bass_hit)
- [x] All 48 registered in SFX_LIBRARY (src/modules/sfx/index.ts) — total 113 events catalogued

### 18. SFXPicker component — available in all sections
- [x] New reusable SFXPicker component (app/components/SFXPicker.tsx)
- [x] Features: category filter, search, play/pause preview, "Use" button, compact mode
- [x] Imported into: Main Studio (inserts [SFX: event] tag into prompt), Music Studio SFX tab (full library), Video Editor (below overlays), Commercial Maker (below overlays)
- [x] AI auto-detects SFX from script text + user can manually add via picker

---

## COMPLETED THIS SESSION (2026-04-08, round 4)

### 19. Sidebar reorganized — professional layout
- [x] 5 sections: Studio, Editing Tools, Content, Publish & Grow, Billing & Settings
- [x] Each section has colored accent bar (purple/blue/amber/green/grey)
- [x] 11px bold uppercase headers — clearly visible
- [x] Gradient divider lines between sections
- [x] Hover animation on links
- [x] Active state with left border + bold text
- [x] Billing/credits prominent in footer with Top Up button
- [x] Characters, Story Bank, Series under Content
- [x] Publishing, Calendar, Analytics, A/B under Publish & Grow

### 20. Templates → correct editor routing
- [x] Video templates → Main Studio (/dashboard)
- [x] Image/ad/flyer templates → Ad Image Editor (/dashboard/ad-editor)
- [x] Ad editor loads template params from URL (aspect ratio, prompt, template ID)
- [x] Auto-adds template title to canvas on load

### 21. Export auto-saves to Asset Library
- [x] Ad Editor export now downloads to device AND saves to asset library automatically
- [x] Saved with metadata: source=ad_editor, dimensions, timestamp

---

## PRIORITY — BUILD NEXT SESSION

### 11. Ad Image Editor Module (NEW — from update/Images/ docs)
Full plan documented separately. 4 phases:

#### Phase 1 — Canvas Foundation + Text Safety (DONE 2026-04-08)
- [x] New page /dashboard/ad-editor with 3-panel layout (Left tools, Center canvas, Right properties)
- [x] Image import (upload via /api/upload/logo, JPG/PNG/WebP)
- [x] Canvas core (drag layers, resize handles, safe zone guides, scaled preview)
- [x] Crop presets (1:1, 4:5, 9:16, 16:9, free) + custom W x H input
- [x] Product Text Block (word-break wrap, max-lines via WebKit clamp, shrink-to-fit, bg strip, align)
- [x] WhatsApp Block (icon + phone, 4 style presets: green pill, black bar, white card, bottom strip)
- [x] Properties panel (position, size, fontSize, color, bgColor, align, radius, padding, opacity, shadow, bold, delete)
- [x] CTA stickers (8 labels: Order Now, Limited Offer, New Arrival, etc.)
- [x] Price Badge block
- [x] Background presets (8 colors + custom hex picker + matte/gloss/flat finish)
- [x] Layer list panel in right sidebar
- [x] Export API (/api/ad-editor/export) — SVG render + sharp rasterization to PNG/JPG
- [x] Added to sidebar navigation

#### Phase 2 — Background Tools + Templates + CTA (DONE 2026-04-08)
- [x] Background remove API (/api/ad-editor/bg-remove) — fal.ai, Segmind, remove.bg adapters
- [x] 8 gradient presets (sunset, ocean, forest, royal, gold, pink, dark blue, warm cream)
- [x] Studio shadow with drop-shadow filter on images
- [x] 5 JSON-driven ad templates (Product Sale, Fashion, Real Estate, Food, Event)
- [x] Template picker in left panel — one-click loads canvas with pre-built layout

#### Phase 3 — AI Prompt Editing (DONE 2026-04-08)
- [x] LLM planner layer (classifies: bg_remove, bg_replace, outpaint, upscale, inpaint, style_transfer, generate)
- [x] Image engine adapters (fal.ai flux/schnell + flux/dev, Segmind SDXL)
- [x] 4 prompt modes: For Ad, Movie, Banner, Generate
- [x] Prompt input + enhanced prompt auto-generation
- [x] /api/ad-editor/ai-edit API (text-to-image + image-to-image)
- [x] Version History Strip (thumbnails of previous versions, click to restore)
- [x] Canvas reintegration (AI result replaces/adds image layer, remains editable)

#### Phase 4 — Export + Polish (DONE 2026-04-08)
- [x] Export PNG and JPG buttons
- [x] 6 quick resize & export presets: Instagram Post (1080x1080), Instagram Story (1080x1920), WhatsApp Status, Flyer Portrait (1080x1350), Website Banner (1920x640), Marketplace (800x800)
- [x] One-click resize + export (auto-resizes canvas then exports)
- [x] Auto-saves to Asset Library on every export

#### Data Model (DONE 2026-04-08)
- [x] AdProject — id, name, type (AD/BANNER/FLYER/MOVIE_POSTER/EVENT), canvasWidth, canvasHeight, background, backgroundFinish, gradient, templateId
- [x] AdLayer — id, projectId, type, positionX/Y, width, height, rotation, zIndex, locked, visible, content, style (JSON)
- [x] AdAsset — id, projectId, sourceType (upload/ai_edit/ai_generate/library/bg_remove), originalUrl, currentUrl, metadata
- [x] AIEditJob — id, projectId, mode, editType, originalPrompt, enhancedPrompt, provider, inputAssetId, outputAssetId, status (QUEUED/PROCESSING/COMPLETED/FAILED)
- [x] Enums: AdProjectType, AIEditStatus
- [x] Schema validated, db push completed, tables created in PostgreSQL

---

## USER ACTION ITEMS (no code)
- [ ] Email support@fal.ai to unlock account
- [x] Verify Segmind account at segmind.com (DONE — working now)
- [ ] Top up ElevenLabs credits
- [ ] Set YouTube/Facebook/TikTok OAuth credentials (must be done manually by user on each platform)

## FUTURE PHASES (unchanged)
- [ ] SaaS billing/credit deduction system
- [ ] Multi-user auth/permissions
- [ ] Trend/competitor monitor
- [ ] Multi-language dubbing full UI
- [ ] Full 4-step Commercial wizard from mock
