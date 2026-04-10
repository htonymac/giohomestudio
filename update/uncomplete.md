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

## COMPLETED THIS SESSION (2026-04-08, round 5)

### 22. Ad Editor — Database Persistence (AdProject/AdLayer/AdAsset wiring)
- [x] New API: `POST /api/ad-editor/project` — create or update project with all layers
- [x] New API: `GET /api/ad-editor/project` — list all saved projects (summary)
- [x] New API: `GET /api/ad-editor/project/[id]` — load project with layers + assets
- [x] New API: `DELETE /api/ad-editor/project/[id]` — delete project (cascade deletes layers/assets/jobs)
- [x] Frontend: project name input, Save button, New button, Projects picker dropdown
- [x] Frontend: auto-save (debounced 3s) after every canvas change
- [x] Frontend: load project from URL `?project=ID`
- [x] Frontend: project list with layer count, date, delete button
- [x] AI Edit API now creates `AdAsset` + `AIEditJob` records when `projectId` is provided
- [x] BG Remove API now creates `AdAsset` record when `projectId` is provided
- [x] Frontend passes `projectId` to AI edit and BG remove calls
- [x] Build passes cleanly (TypeScript + Next.js 16.2.1)

---

## COMPLETED THIS SESSION (2026-04-08, round 6)

### 23. Auth + Registration (NextAuth v5)
- [x] Prisma models: User, Account, Session, VerificationToken — pushed to DB
- [x] NextAuth v5 with Google OAuth + email/password credentials
- [x] Registration API: `POST /api/auth/register` with bcrypt password hashing
- [x] Middleware: protects all `/dashboard/*` routes, redirects to `/login`
- [x] `/login` page — Google sign-in button + email/password form (clean, modern)
- [x] `/register` page — Google + email form, terms checkbox ("I agree to Terms and Privacy")
- [x] Terms acceptance stored in User record (termsAcceptedAt + termsVersion)

### 24. Legal Pages + Footer
- [x] `/terms` — clean Terms of Use (13 sections, professional, not scary)
- [x] `/privacy` — Privacy Policy (11 sections, NDPA 2023 compliant)
- [x] Footer on every dashboard page: "AI-assisted content. Human approval required."
- [x] Terms/Privacy links in footer and on registration page

### 25. AI Content Creator — "Hi Boss" Hub (rebuilt properly)
- [x] `/dashboard/auto-creator` — 5-step flow: Platform → Media → Analysis → Ideas → Preview
- [x] Step 1: Platform selection (Instagram, TikTok, YouTube, Facebook, Threads, WhatsApp) with format picker per platform
- [x] Step 2: Media upload with drag-and-drop, thumbnail grid, file names, remove buttons
- [x] Step 3: AI Activity Detection — analyzes media, shows detected activities with confidence
- [x] Step 4: Content suggestions — optimized for selected platform, style-colored cards
- [x] Step 5: Full draft preview — caption, hashtags, voice script, CTA, music, credit estimate, platform tips
- [x] AI Suggestion Engine (`POST /api/auto-creator/suggest`) — multi-provider LLM (Claude/GPT/Grok/Ollama), returns activities + suggestions
- [x] Draft Factory (`POST /api/auto-creator/draft`) — full publication-ready draft
- [x] "Open in Video Studio" and "Open in Ad Editor" buttons
- [x] Progress bar showing current step
- [x] Sidebar label: "AI Content Creator"

### 26. Publishing & Connected Channels
- [x] `/dashboard/publishing` — 3 tabs: Connected Channels, Posting Queue, Manual Export
- [x] 6 channel cards: YouTube, Instagram, TikTok, Facebook, Telegram, WhatsApp
- [x] Connect/disconnect buttons, connection status indicators
- [x] Posting queue with status badges (draft → approved → scheduled → published)
- [x] Manual export section: WhatsApp share, Telegram send, download, copy caption
- [x] Publish confirmation gate before posting

### 27. Sidebar Updated
- [x] Auto Creator added to Studio section
- [x] Publishing added to Publish & Grow section
- [x] Build passes cleanly (106 pages, TypeScript + Next.js 16.2.1)

### 28. AI Content Creator — Session Recovery
- [x] localStorage saves session on every step change (platform, format, activities, suggestions, draft)
- [x] On page load, detects saved session < 24hrs old, shows "Resume" / "Start Fresh" banner
- [x] Restores: platform, format, activities, suggestions, draft, step position
- [x] Media files need re-upload (browser can't persist File objects)
- [x] Session cleared when user completes flow (sends to Studio or Ad Editor)

---

## COMPLETED THIS SESSION (2026-04-08, round 7)

### 29. AI Content Creator — EXIF + Vision Analysis + Caption Editing
- [x] EXIF data reading from uploaded images (date taken, location, camera) via `exifr` library
- [x] EXIF shown in media grid (date, camera model, GPS coordinates)
- [x] EXIF passed to AI suggestion engine for better activity detection
- [x] Server-side image analysis API (`POST /api/auto-creator/analyze`) — uploads actual images to vision AI
- [x] Vision providers: OpenAI GPT-4o-mini vision → Claude Haiku vision → filename fallback
- [x] Returns detected activities + per-image analysis (content_type, mood, quality, description)
- [x] Caption editing in draft preview — caption, hashtags, voice script, CTA all editable
- [x] localStorage session recovery — resume banner, session cleared on flow completion

### 30. Image Enhancement (AI) — API + 3 sections
- [x] Enhancement API: `POST /api/image/enhance` — fal.ai clarity-upscaler → Segmind img2img fallback
- [x] Supports modes: enhance, upscale, cleanup
- [x] Ad Editor: "Enhance Image (AI)" button below Studio Shadow — saves to version history
- [x] Commercial Maker: "Enhance" button on each slide image — replaces slide image with enhanced version
- [x] AI Content Creator: "Enhance" button on each media thumbnail in draft step — replaces in-memory file
- [x] Build passes cleanly (108 pages)

---

## PRIORITY — BUILD NEXT

### 31. Music Generation — Dual Tier (Standard + Premium)
- [x] Rewrote `/api/music/generate` with two AI tiers + stock fallback
- [x] Standard: fal.ai MiniMax Music 2.0 ($0.03/song) — full songs with vocals + lyrics or instrumental
- [x] Premium: Kie.ai Suno V5 (credit-based, 5000 free on signup) — highest quality, custom mode, style control
- [x] Fallback: stock library mood matching (always free)
- [x] Request supports: prompt, lyrics, genre, mood, duration, instrumental flag, tier selection, title
- [x] Auto-saves generated music to asset library
- [x] Kie.ai adapter fully implemented with async polling (submit job → poll every 5s → download result)
- [x] Updated MusicGenerationInput/Output interfaces with style, title, lyrics, instrumental, outputUrl, metadata
- [x] Build passes cleanly (108 pages)

---

### 32. Music & Video Studio — Full Hub Page (MVP Phase 1A)
- [x] `/dashboard/music-video` — 2-tab hub: Music Studio + Music Video Studio
- [x] Music Studio tab: 6 mode cards (Text→Music, Image→Music, Voice→Music, Image+Voice→Music, Music+Animation, Audio→Video)
- [x] Children's Music section: 6 modes (ABC, Numbers, Animals, Colours, Nursery, Custom) — supports English, Yoruba, Igbo, Hausa, Pidgin
- [x] Music Video Studio tab: 6 mode cards (Full Music Video, Bring Your Song, Image Music Video, AI Artist Performance, Lyric Video, Short Teaser)
- [x] Feature highlights grid (Beat-Synced Cuts, Song Generation, Scene Planning, Lyric Overlay, African Genres, Platform Cuts)
- [x] All 18 modes have slide-up edit panels with dynamic form fields matching HTML design
- [x] Form types: textarea, text input, select dropdown, pill selector, upload zone (single + multi)
- [x] Music generation wired to `/api/music/generate` with Standard/Premium tier selector
- [x] Inline audio player shows after music is generated — user listens before proceeding
- [x] Storyboard generation via LLM — creates 5-scene plan with purpose, duration, prompt, style, movement
- [x] Storyboard preview with "Approve & Render" gate (credits only charged after approval)
- [x] "Open in Music Editor" button routes to existing Music & DJ page
- [x] Card design: colour-coded (cyan/orange/purple/green/gold/pink), hover animations, tag badges
- [x] Blended style: HTML's premium card layout + existing dashboard purple accent
- [x] Sidebar: "Music & Video Studio" added to Studio section
- [x] Build passes cleanly (109 pages)

---

### 33. Video Model Selector — User choice + AI suggestion
- [x] 6 video AI models available: Kling 3.0 Pro, Kling 2.0, Hailuo 2.3 Pro, Hailuo 2.3 Fast, Runway Gen-3, Kling Direct
- [x] Each model shows: name, provider, cost, speed, quality, best-for description, badges
- [x] AI auto-suggests best model per mode (cinematic→Kling Pro, lyric→Hailuo Fast, etc.)
- [x] User can override and pick any model
- [x] Cost estimate calculated: scenes × model cost = total
- [x] "Approve & Render" button shows selected model name
- [x] Build passes cleanly (109 pages)

---

## COMPLETED (2026-04-09, round 8)

### 34. Full Sidebar Reorganization
- [x] 6 sidebar sections: Create, Planners, Tools, Content, Publish & Grow, Billing & Settings
- [x] Create section: Create, AI Content Creator, Movie & Series, Music & Music Video, Short Video, Viral Video, Commercial
- [x] Planners section: Movie & Series Planner, Music Video Planner, Commercial Planner
- [x] Tools section: Video Editor, Ad/Image Editor, Video Trimmer, Music & DJ, SFX Library
- [x] Content section: Review Queue, All Content, Asset Library, Characters, Story Bank, Series Wizard, Templates (moved here)
- [x] Publish & Grow: Publishing, Channel Pages, Calendar, Analytics, A/B Testing

### 35. Movie & Series Creator page
- [x] `/dashboard/movie-creator` — 4 entry cards: New Movie Project, Continue Existing, Create Series, Manage Characters
- [x] Routes to Movie Planner, Series Wizard, Characters pages

### 36. Movie & Series Planner — Phase 1 (the brain)
- [x] `/dashboard/movie-planner` — Full 6-step multi-AI cinematic planning system
- [x] Step 1: Story basics (title, idea, expanded story, duration, language)
- [x] Step 2: 4 planning layers from docs — Genre (19 options), Storytelling Style (8), Output Format (5 with radio buttons + descriptions), Production Mode (3), Planning Depth (3), Tone (12), Setting (15)
- [x] Step 3: Character selection from saved Characters page — select cast, assign roles (12 role types)
- [x] Step 4: Multi-AI planning animation — shows AI Layer 1 (Planner), AI Layer 2 (Reviewer), non-LLM engines
- [x] Step 5: Full movie blueprint — summary, story arc (setup/tension/climax/resolution), sound plan, music direction, visual direction, reviewer notes, continuity warnings, missing asset alerts
- [x] Step 5: Expandable scene cards — each shows: title, goal, duration, characters, visual description, camera direction, dialogue, SFX, ambience, music cue, generation method (color-coded), cost label
- [x] Step 6: Generation queue with per-scene checkboxes, credit estimate, "Start Rendering" button
- [x] AI cinematic expansion: short input → full blueprint (environment, emotion, movement, sound, camera)
- [x] Generation methods per scene: image, video, image-to-video, audio-only, hybrid — each color-coded
- [x] Cost labels per scene: cheap (green), balanced (yellow), premium (red)

### 37. Short Video Creator
- [x] `/dashboard/short-video` — quick 15-60s video creation, no deep planning
- [x] Prompt input, duration selector, format selector
- [x] Links to planners for deeper work

### 38. Viral Video Creator
- [x] `/dashboard/viral-video` — trend-driven content
- [x] Prompt input, viral style picker (POV, Before/After, Reaction, Challenge, etc.), platform selector
- [x] 10 viral style options

### 39. Planner redirects
- [x] Music Video Planner → redirects to Music & Video Studio hub
- [x] Commercial Planner → redirects to Commercial Maker
- [x] Build passes cleanly (115 pages)

---

## PRIORITY — BUILD NEXT

### 40. Prisma Movie Models + Project API
- [x] MovieProject model: title, idea, genre, style, format, productionMode, storyArc, soundPlan, cast, scenes relation
- [x] MovieScene model: scene, title, goal, duration, characters, visualDescription, cameraDirection, dialogue, soundEffects, ambience, musicCue, generationMethod, costLabel, status, generatedAssetUrl
- [x] MovieStatus enum: DRAFT → PLANNING → SCENES_READY → RENDERING → RENDERED → ASSEMBLED → EXPORTED
- [x] `POST/GET /api/movie-planner/project` — create/update/list movie projects with all scenes
- [x] `GET/DELETE /api/movie-planner/project/[id]` — load/delete with cascade
- [x] DB pushed, Prisma client generated

### 41. Video Generation API
- [x] `POST /api/video/generate` — core rendering engine
- [x] fal.ai models: Kling 3.0 Pro, Kling 2.0, Hailuo 2.3 Pro, Hailuo 2.3 Fast
- [x] Runway Gen-3 via direct API with polling
- [x] Kling Direct API with JWT auth + polling
- [x] Auto-saves generated videos to asset library
- [x] Accepts: prompt, model ID, optional source image, aspect ratio

### 42. Movie Planner — Save/Load/Continue/Edit/Render
- [x] Save project to DB (auto-saves after AI planning)
- [x] Project bar: title, Save button, Projects picker
- [x] Continue Existing Movie: load project list, click to load, resumes at correct step
- [x] Delete projects
- [x] Scene editing: editable fields (visual, camera, SFX, ambience, music, dialogue, duration)
- [x] Scene controls: move up/down, duplicate, delete
- [x] Render single scene: calls /api/video/generate with selected model
- [x] Generated asset preview: video player in expanded scene card
- [x] Generation queue (Step 6): video model selector (6 models), per-scene render buttons, render all, cost estimate
- [x] Scene status tracking: planned → generating → generated / needs_edit

### 43. Dedicated Music Video Planner
- [x] `/dashboard/music-video-planner` — full 5-step planner (not redirect anymore)
- [x] Step 1: Song input (upload/generate/library), title, lyrics, audio player
- [x] Step 2: Video mode (8 modes), visual style (12 options), artist name
- [x] Step 3: AI song analysis — energy, mood, genre, sections, visual suggestions
- [x] Step 4: Storyboard — 6 editable scenes, section labels, editable prompts and captions
- [x] Step 5: Render queue — model selector, per-scene render, render all button
- [x] Scenes individually renderable with status tracking
- [x] Build passes cleanly (117 pages)

---

### 44. FFmpeg Final Assembly API + UI
- [x] `POST /api/video/assemble` — merges rendered scene videos into one final movie
- [x] FFmpeg concat (copy mode, falls back to re-encode if codecs differ)
- [x] Music mixing: overlays background music track at configurable volume (default 0.3)
- [x] Narration mixing: overlays voiceover on top of video + music
- [x] Auto-detects and resolves /api/media/ URLs to storage paths
- [x] Gets final duration via ffprobe
- [x] Auto-saves final movie to Asset Library with metadata
- [x] Temp file cleanup after assembly
- [x] Movie Planner: "Assemble Final Movie" button appears after scenes are rendered, shows video player for result, re-assemble option
- [x] Music Video Planner: "Assemble Scenes + Music" button, merges with uploaded song, video player for result
- [x] Build passes cleanly (118 pages)

---

### 45. Page Visual Upgrades
- [x] AI Content Creator: background video hero, gradient platform cards with hover, "X formats" label
- [x] Short Video Creator: background video hero, sample video strip, content type grid (6 types), music mood pills, duration/format selectors
- [x] Viral Video: already upgraded in previous round (sample strip, 3-step flow, content type → model → music)
- [x] Movie Creator: already upgraded (background video, sample strip, hover effects)

### 46. Multi-AI Scene Intelligence Architecture
- [x] `POST /api/movie-planner/analyze` — the brain: 3 AI layers + 3 non-LLM engines
- [x] AI Layer 1 (Story Director): Claude Sonnet / GPT-4o — expands short idea into full cinematic scenes with emotion, movement, dialogue, camera
- [x] AI Layer 2 (Technical Director): GPT / Grok — adds exact SFX, ambience, weather effects, props, spatial audio, movement timing
- [x] AI Layer 3 (Quality Reviewer): Grok / Claude — validates logic, finds missing beats, continuity issues, pacing problems
- [x] Each AI layer tries preferred provider first, falls back to others (Claude → OpenAI → Grok → Ollama)
- [x] Non-LLM Engine 1: Continuity Checker — detects character appearance/disappearance, environment jumps, weather changes
- [x] Non-LLM Engine 2: SFX Resolver — matches scene needs to internal 48 SFX library with fuzzy keyword matching, flags missing for AI generation
- [x] Non-LLM Engine 3: Generation Strategy Selector — assigns image/video/hybrid/audio-only per scene based on action, pacing, format choice
- [x] Movie Planner wired to use analyze API instead of basic LLM
- [x] Planning loading screen shows all 3 AI layers with spinning indicators + 3 non-LLM engine badges
- [x] Review notes merged from all sources (AI review + continuity + SFX + cast)

### 47. SFX Retrieval API
- [x] `POST /api/sfx/resolve` — SFX resolution chain
- [x] Source 1: Internal library (48 SFX, direct keyword match)
- [x] Source 2: Fuzzy keyword mapping (footsteps → click, gunshot → explosion, breathing → deep_ambience)
- [x] Source 3: Flag for AI generation or external retrieval (Freesound)
- [x] Returns confidence: high / medium / low per SFX need
- [x] Stats: total, high_confidence, medium_confidence, needs_generation

### 48. SeeDance 2.0 (ByteDance) added to video generation
- [x] Added to fal.ai model list in /api/video/generate
- [x] Endpoint: fal-ai/bytedance/seedance-2.0/text-to-video
- [x] Available in Viral Video content type selector (Dance / Motion category)
- [x] Build passes cleanly (120 pages)

---

### 49. Fix All Page Layouts — Full Width
- [x] Removed maxWidth + margin:auto centering from ALL pages: auto-creator, movie-creator, music-video, music-video-planner, publishing, short-video, viral-video, movie-planner
- [x] Pages now use full available width of content area

### 50. Commercial Page Redesign
- [x] Background video hero with gradient overlay (demo-commercial-oj.mp4)
- [x] "Commercial Studio" badge, professional header text
- [x] Sample video strip (Orange Juice Ad, Property Showcase, Commercial Demo) with hover-to-play
- [x] New Slide Ad + Open Planner buttons
- [x] Empty state redesign with large icon and descriptive text
- [x] Removed old max-w-2xl centering

### 51. Movie Planner Right Sidebar — Intelligence Panel
- [x] Step 5 now has 2-column layout: scenes (left) + intelligence sidebar (right)
- [x] Detected Cast panel: shows all characters found across scenes, scene count per character, Build/Import/Reuse buttons
- [x] Environment panel: shows visual description per scene
- [x] Sound & SFX panel: shows sound plan summary, flags missing SFX count
- [x] Continuity panel: shows all continuity warnings from AI + non-LLM engine
- [x] Music Direction panel
- [x] AI Systems Used panel: shows which providers were used (Story/Technical/Review)

### 52. Wire Short Video + Viral Video to Real Generation
- [x] Viral Video: calls /api/video/generate with selected model → /api/music/generate if music requested → /api/video/assemble to merge → video player result with download
- [x] Short Video: calls /api/video/generate (hailuo-fast) → /api/music/generate if mood selected → /api/video/assemble → video player with download
- [x] Both show result video player with Download + Asset Library buttons
- [x] Both handle "No Music" option correctly
- [x] Build passes cleanly (120 pages)

---

### 53. Smart Provider Routing — DONE
- [x] Rewrote `/api/video/generate` with dual-provider routing (fal.ai + Kie.ai)
- [x] Kie.ai video: POST /api/v1/jobs/createTask + GET /api/v1/jobs/recordInfo polling
- [x] Pricing intelligence auto-selects cheapest provider per model:
  - Kling 2.x → Kie.ai first ($0.125/5s, 50% cheaper than fal.ai $0.25)
  - Kling 3.0 Pro → fal.ai first ($0.50/5s, 37% cheaper than Kie.ai $0.80)
  - SeeDance 2.0 → fal.ai (only live provider, $0.26/5s)
  - Hailuo → fal.ai only
- [x] Auto-fallback: if cheapest provider fails, tries next provider automatically
- [x] Movie Planner model selector updated: shows cost, provider ("via Kie.ai"), "Best price" green badge
- [x] SeeDance 2.0 added to model selector
- [x] Build passes cleanly (120 pages)

---

### 55. Music Video Planner — Narration System
- [x] Narration intro/outro fields in Step 2 (mode selection)
- [x] Intro voiceover + Outro voiceover text inputs
- [x] Voice type selector: No Narration / AI Voice / My Voice

### 56. Music Video Intelligence Layer — 7 Engines
- [x] `POST /api/music-video/analyze` — full intelligence pipeline
- [x] Engine 1: Music Analysis (AI) — BPM, energy, mood, genre, danceability, commercial potential, emotional spikes
- [x] Engine 2: Beat Mapping (non-AI) — generates beat points, cut points, bar markers from BPM + sections
- [x] Engine 3: Section Planner (from AI analysis) — intro/verse/chorus/bridge/outro with energy levels
- [x] Engine 4: Dance & Motion Intelligence (AI) — dance family, movement intensity, camera style, chorus energy, body focus, solo vs crowd
- [x] Engine 5: Recommendation Layer (non-AI) — best video mode, dance type, pacing, suggested AI model, output formats, scene count
- [x] Engine 6: Motionboard (non-AI) — energy curve per section, visual intensity, dance presence, camera motion, caption behavior, transition style
- [x] Engine 7: Review data package — everything bundled for user approval
- [x] Music Video Planner wired to intelligence API — analysis step now shows BPM, danceability %, dance style, camera, suggested model, pacing
- [x] Auto-selects recommended AI model based on content type

### 57. Wan 2.5 + Categorized AI Model Selector
- [x] Wan 2.5 and Wan 2.5 Pro added to video generation API
- [x] GET /api/video/generate returns categorized model catalog: Animation & Budget, Music Video & Dance, Movie & Cinematic, Commercial & Product, Children & Educational
- [x] Each category shows relevant models with cost, provider, badge, best-for description
- [x] Music Video Planner render queue: 2-tier model selector (Music Video & Dance + Budget & Animation) with provider and badge labels
- [x] Movie Planner model selector updated with costs and "via" provider labels

### 58. GHS Branding Policy Applied
- [x] Removed "Claude / GPT / Grok" from Movie Planner sidebar → replaced with "AI Story Director", "AI Technical Director", "AI Quality Reviewer"
- [x] Loading screen: "AI 1: Story Director" → "AI Story Director" (no numbered providers)
- [x] Rendering model names (Kling, SeeDance, Hailuo, Wan) remain visible — users choose these
- [x] Model selectors still show categories (Cheapest, Best Quality, Dance Expert, etc.)
- [x] Intelligence layer = hidden brains, Render layer = visible machines

### 59. Intelligence Cache System
- [x] `src/lib/intelligence-cache.ts` — reusable skeleton caching
- [x] Cache key: type + genre + mood + energy + style + format (hashed to filename)
- [x] 7-day TTL, hit counter, auto-cleanup of expired entries
- [x] Movie Planner analyze API: caches generation strategy + SFX patterns + continuity rules
- [x] Music Video analyze API: caches dance intelligence + recommendations + motionboard template
- [x] Rule enforced: ONLY skeletons cached, NEVER final personalized outputs
- [x] Formula: Cached Blueprint + Live Personalization = Unique Result
- [x] `getCacheStats()` for monitoring (total entries, total hits, oldest age)

---

### 60. Global Language Support
- [x] All language selectors updated across Movie Planner, Music Video hub, Music Video Planner
- [x] Now includes: English (US), English (UK), English (AU), French, Spanish, Portuguese, Arabic, Hindi, Mandarin, Yoruba, Igbo, Hausa, Pidgin, Twi, Swahili, Zulu, Amharic, German, Italian, Japanese, Korean, Mixed
- [x] Removed Nigeria-only language lists

### 61. Currency Selector for Ad/Price Editor
- [x] Currency dropdown in Ad Editor next to Price Badge button
- [x] 15 currencies: $, €, £, ₦, ¥, ₹, R, GH₵, KSh, Fr, A$, C$, zł, kr, R$
- [x] Price badge uses selected currency
- [x] Template prices changed from ₦ to $ (neutral default)

### 62. Voice Recording (MediaRecorder API)
- [x] AI Content Creator draft step: 3-mode voice picker (No Narration / AI Voice / My Voice)
- [x] "My Voice" mode: live recording interface with MediaRecorder API
- [x] Record button with pulsing red animation while recording
- [x] Stop → audio player appears with recorded voice
- [x] Re-record and "Use this recording" buttons
- [x] Upload voice file alternative (audio/* file picker)
- [x] Build passes cleanly (121 pages)

---

### 63. Lyric Overlay Engine
- [x] `POST /api/lyric-overlay` — generates timed lyric entries from lyrics text + duration
- [x] AI-powered timing (uses LLM for intelligent line spacing)
- [x] Fallback: even distribution with section detection ([verse], [chorus] markers)
- [x] Returns: JSON timing array + SRT subtitle format
- [x] Emphasis detection: chorus/hook lines marked bold/glow
- [x] Styles: normal, bold, glow, large per line

### 64. Commercial Music Promo Controls
- [x] Music Video Planner: commercial-specific controls appear when "Commercial Music Promo" mode selected
- [x] CTA text, WhatsApp/contact number, website, logo upload
- [x] Toggle checkboxes: Show CTA Card, Show WhatsApp, Show Logo, Show Website
- [x] Orange-themed panel with promo branding

### 65. Credit Approval Gate
- [x] AI Content Creator: credit panel shows estimated credits + user balance (50 credits placeholder)
- [x] Green balance indicator with "Top up credits" link to /dashboard/budget
- [x] "Credits charged only after you approve" messaging

### 66. Before/After Enhancement Preview
- [x] AI Content Creator: saves original URL before enhancing
- [x] "B/A" toggle button appears after enhancement — swaps between original and enhanced
- [x] "Re-enhance" label if already enhanced
- [x] Build passes (122 pages)

### 67. Commercial Project Cards — Delete, Preview, Date
- [x] Delete button with confirmation dialog
- [x] Video preview: hover-to-play on rendered videos, click for inline player
- [x] Created date shown (formatted: "Apr 3, 2026, 02:30 PM")
- [x] Play button overlay on thumbnails for ready videos

### 68. Credits System (UI) — replaced all dollar signs
- [x] All model selectors show credits not dollars (1-4 credits/scene)
- [x] Cost estimates in credits (e.g. "5 scenes × 2 credits = 10 credits")
- [x] Music: "Standard — 1 credit/song", "Premium — 3 credits/song"
- [x] API returns credits instead of dollar amounts
- [x] Removed provider names from default user view

### 69. Movie Creator Page — Hybrid Front and Center
- [x] Two main cards: "Text to Video Movie" (4 credits/scene) vs "Hybrid Movie — RECOMMENDED SAVE 50-75%" (1-2 credits/scene)
- [x] Hybrid card shows green recommended badge, 3 mini cards (Images/Video/Audio), "Learn more" button
- [x] Learn More expandable: cost comparison (40 vs 12 credits), 5 scene type explanations
- [x] Sample videos: Hybrid section (green border) + Full Video section (purple)
- [x] Hybrid click pre-selects format=audio_video_image in Movie Planner URL

### 70. Commercial Quick Video Preview Fixed
- [x] API now fetches rendered video from ContentItem.mergedOutputPath
- [x] Green play button on project cards for ready videos
- [x] Click play → inline video player expands with controls + autoplay
- [x] Fixed back navigation: browser back returns to commercial list (pushState + popstate listener)

### 71. Music Video Save to DB
- [x] Prisma model: MusicVideoProject (title, songTitle, lyrics, videoMode, visualStyle, musicProfile, storyboard, motionboard)
- [x] API: POST/GET /api/music-video/project, GET/DELETE /api/music-video/project/[id]
- [x] Music Video Planner: project bar with Save button + project list picker
- [x] Load existing projects: resumes at correct step
- [x] Auto-save after storyboard generation
- [x] DB pushed, Prisma client generated
- [x] Build passes (123 pages)

### 72. Demo Videos Built
- [x] Hybrid movie demo (37s) — 10 image scenes + 2 video clips with Ken Burns zoom
- [x] Image-only movie demo (30s) — 10 images with slow zoom
- [x] Added to Asset Library + Movie Creator sample strip
- [x] Shows cost comparison: Full Video 48 credits vs Hybrid 12 credits (75% savings)

### CRITICAL — NOT DONE (from user documents, must be built)

### 73. Hybrid Movie Format — Properly Implemented
- [x] 4 production formats with badges, costs, and detailed explanations:
  - Hybrid Movie (RECOMMENDED, 1-2 credits/scene, green badge)
  - Full Video Movie (PREMIUM, 4 credits/scene, purple badge)
  - Image-Led Narrated Movie (BUDGET, 1 credit/scene, yellow badge)
  - Audio Only Movie (FREE, 0 credits/scene, cyan badge)
- [x] Each format shows: cost, badge, description, and expanded detail when selected
- [x] Movie Creator page: two big cards (Full Video vs Hybrid) with sample videos and cost comparison
- [x] Pre-selects format when user clicks Hybrid from Movie Creator page

### 74. Music Intelligence Per Scene
- [x] Technical AI now plans 5 audio layers per scene: dialogue, narration, SFX, ambience, music
- [x] Returns per scene: music_style, music_intensity, narration_need, narration_type, audio_layers object
- [x] Scene cards show 3 intelligence panels: Scene Type + Narration Mode/Strength + Music Style/Intensity
- [x] Narration auto-adapts: image scenes = "[Auto-narration needed — descriptive]", video scenes = empty, bridges = strong

### 75. Series Planner — moved to correct section
- [x] Moved from Content to Planners section in sidebar
- [x] Renamed from "Series Wizard" to "Series Planner"
- [x] Page title updated
- [x] Movie Planner label simplified to "Movie Planner" (Series is separate)

### 76. AI Children Video — Dedicated Child-Safe Mode
- [x] `/dashboard/children-video` — entry page under CREATE with two branches: Children Video + Children Hybrid
- [x] Children Video = animated, active (ABC, phonics, counting, mini movies)
- [x] Children Hybrid = storybook read-along (poems, 3-letter words, bedtime stories) — RECOMMENDED
- [x] 12 content types: ABC, Phonics, Word Learning, 3-Letter Words, Word Families, Counting, Shapes/Colors, Storybook, Poem, Nursery Rhyme, Children Movie, Educational Lesson
- [x] Age-based auto-configuration: Toddlers (2-3) / Pre-school (3-5) / Early School (5-8) / Older Kids (8-12) — auto-sets word difficulty, pacing, visuals, music
- [x] Multi-language bilingual learning: 18 languages — English↔Spanish, English↔Yoruba, English↔Hindi, etc. Shows word in both languages simultaneously
- [x] Curriculum templates: Learn to Read in 30 Days, Alphabet in 5 Songs, Numbers in 10 Episodes, Phonics in 20 Lessons, Bilingual Words in 15 Episodes
- [x] Child-Safe Mode badge + safety notice on every page
- [x] Sample videos strip with hover-to-play (Hybrid + Video badges)
- [x] Sidebar: "AI Children Video" under Create section

### 77. Child Video Planner — 2-Stage Mandatory Review
- [x] `/dashboard/children-planner` — dedicated planner page under Planners
- [x] 5-step flow: Content Input → Voice/Visual/Music → REVIEW 1 → Preview → REVIEW 2
- [x] Step 1: Text input with content-specific placeholders, Soft/Active energy toggle, bilingual notice
- [x] Step 2: 5 narration styles (Gentle Reader, Teacher, Fun, Calm Bedtime, Classroom), 4 visual styles, 8 music choices
- [x] Music rule enforced: narration always priority, music at 18-35%, ducks during voice
- [x] Step 3: FIRST REVIEW (mandatory) — checks content interpretation, age fit, narration style, visual plan, word difficulty, music suitability
- [x] Step 4: Preview — generated content shown for inspection
- [x] Step 5: SECOND REVIEW (mandatory) — checks final visuals, characters, text sync, narration clarity, music fit, background safety
- [x] Both reviews require checkbox confirmation: "I have reviewed... I confirm appropriate for children"
- [x] Cannot proceed without completing each review
- [x] Green progress bars for review steps to distinguish from regular steps
- [x] Sidebar: "Child Video Planner" under Planners section
- [x] Build passes (126 pages)

### Concepts added by AI (not in original docs):
- [x] Age-based auto-configuration — single selection configures everything
- [x] Multi-language bilingual pairs — 18 world languages, shows both translations
- [x] Curriculum templates — pre-built learning paths (30-day reading, etc.)
- [ ] Learning Progress Memory — track what was taught, continue from where left off (future)
- [ ] Repetition Engine — auto-insert "Remember?" review scenes (future)
- [ ] Interactive Pause Points — "Can you say it?" pauses in video (future)
- [ ] Parent Voice Option — clone parent's voice for narration (future)
- [ ] Export Learning Package — video + printable word cards + worksheets (future)
- [ ] Safety Fingerprint — invisible tag marking content as child-verified (future)
- [ ] Classroom Mode — teachers generate per-lesson content (future)

### 78. Per-Scene Music Generation
- [x] `POST /api/music/generate-scene` — generates music segment matching scene mood
- [x] Mood→music mapping: suspense, heroic, emotional, action, calm, dark, joyful, romantic, mystery, children, african, cinematic, transition
- [x] Adjusts prompt by scene type: image-led = "subtle bed", video-led = "drives action", bridge = "atmospheric"
- [x] Intensity levels: low, medium, high
- [x] 1 credit per scene music generation

### 79. Music Volume + Image Treatment UI in Scene Cards
- [x] Music volume selector per scene: Off / Low (15%) / Med (30%) / High (50%)
- [x] Auto-hint: "Image scene — music can be louder" vs "Video scene — music should be lower"
- [x] Image treatment selector: Static, Zoom In, Zoom Out, Pan, Parallax
- [x] Shows current AI-selected treatment

### 80. SFX Freesound Integration
- [x] SFX resolve API now searches Freesound when internal library has no match
- [x] Chain: Internal (58 SFX) → Fuzzy keyword → Freesound API → Flag for AI generation
- [x] Requires FREESOUND_API_KEY in .env (free account at freesound.org)

### 81. Intelligence Tiers Exposed to User
- [x] Movie Planner Step 2: "AI Intelligence Tier" selector with 3 tiers
- [x] Standard (FREE): 1 AI system, basic planning
- [x] Smart (1 credit, RECOMMENDED): 2 AI systems — Story Director + Quality Reviewer
- [x] Premium (3 credits): 3 AI systems — Story + Technical + Quality
- [x] Each tier shows: cost, badge, description, expanded detail when selected

### 82. Narration Auto-Generation API
- [x] `POST /api/narration/generate` — LLM writes narration text per scene
- [x] Adapts by scene type: image-led = rich descriptive, video-led = minimal/none, bridge = strong transitional
- [x] Returns: narrationText, narrationStyle, estimatedDuration, speakingPace
- [x] "AI Write Narration for This Scene" button in Movie Planner scene cards
- [x] Fallback narration if LLM fails

### 83. Demo Content Generated
- [x] 9 AI images via fal.ai Flux (children ABC, counting, colors, story, nursery + warrior, kingdom, face, landscape)
- [x] 2 music tracks via fal.ai MiniMax (children ABC song + epic cinematic score)
- [x] 5 per-scene narrations via Piper TTS (slowed 40% for children pacing)
- [x] Children final demo: 5 scenes with text overlay + slow narration + background music (22s)
- [x] Movie hybrid demo: AI images + video clips + epic score + narration (14s)
- [x] 10 new SFX: sword_clash, snake_hiss, footstep_gravel, wood_crack, water_splash, fire_crackling, horse_gallop, children_laugh, school_bell, page_turn
- [x] SFX duplicate key "explosion" fixed → "explosion_blast"
- [x] Total SFX: 58 files
- [x] Build passes (128 pages)

---

## FROM GHS SUPPORT CANVAS — MUST BUILD (Protection + Sound + Assembly + Legal)

### Video Finishing Studio — Separate Workflow (NOT built)
- [ ] Import existing video → analyze → plan layers → review → approve → assemble → export
- [ ] One shared assembly engine underneath all entry points (Video Tools, Music Tools, Content)
- [ ] Video Analyzer: reads imported video, extracts duration, audio presence, silence areas, cuts, speech areas
- [ ] Assembly Planner: plans narration/music/SFX/subtitle/overlay timing
- [ ] Audio Balance Planner: narration priority, music ducking, ambience support, SFX emphasis
- [ ] Sound Source Resolver: user sound → local vault → CC0 → CC BY → generation → review fallback
- [ ] FFmpeg Assembly Engine: deterministic execution from Assembly JSON

### Assembly JSON Schema — Source of Truth (NOT built)
- [ ] Structured assembly schema expressing: video segments, image segments, narration in/out timings, music in/out, SFX placements, ambience layers, subtitle timings, text overlay timings, logo placement, fade in/out, transitions, volume automation, ducking rules, export targets, aspect ratio variants
- [ ] Planner AI produces Assembly JSON → Supervisor AI checks → FFmpeg builder executes
- [ ] Same JSON contract across all model tiers — only planning quality changes, execution stays deterministic
- [ ] Preview render from JSON before final render
- [ ] Assembly Record: project_id, assembly_json_version, planner_model_tier, supervisor_model_tier, preview_status, render_status

### Sound 3-Bucket Policy — STRICT (NOT enforced in code)
- [ ] Bucket 1: Fully owned / custom-created / GHS-internal sounds — always allowed
- [ ] Bucket 2: CC0 sounds — allowed, tracked but no attribution required
- [ ] Bucket 3: CC BY sounds — allowed ONLY with automatic attribution support
- [ ] BLOCK: CC BY-NC in ANY commercial production flow
- [ ] BLOCK: Unknown-license sounds from entering production
- [ ] BLOCK: "Free to download" ≠ "free to use commercially" — must be enforced
- [ ] Every sound asset stores: asset_id, title, creator_name, source_platform, source_url, license_type, requires_attribution, commercial_allowed, attribution_text, local_filename, usage_bucket, tags, duration

### Attribution System — MUST be a feature not a note (NOT built)
- [ ] Per-sound license metadata stored in DB
- [ ] Auto-generate project sound credits block from all CC BY sounds used
- [ ] Copy Credits button
- [ ] Show Attribution button
- [ ] Include Credits in Export option
- [ ] Optional end-card credits for videos
- [ ] Optional description-ready credits text for YouTube/social
- [ ] Project Sound Usage Record: project_id, asset_id, usage_type, attribution_included, commercial_context, export_eligible

### Audit Logging — Trust & Accountability (NOT built)
- [ ] Log: source type (uploaded/generated/imported)
- [ ] Log: whether media stayed local or was uploaded
- [ ] Log: upload approval timestamp
- [ ] Log: export approval timestamp
- [ ] Log: risky-action confirmation state
- [ ] Log: rights-confirmation version accepted
- [ ] Log: sound assets used + license type
- [ ] Log: attribution text generated
- [ ] Log: planner tier used + supervisor tier used
- [ ] Log: provider used
- [ ] Log: assembly JSON version
- [ ] Log: preview status + final render status
- [ ] Rights Confirmation Record: user_id, project_id, confirmation_type, accepted_version, timestamp

### Rights Confirmation at Point of Risk (NOT built)
- [ ] Popup when using third-party faces: "I own this or have permission"
- [ ] Popup when cloning/synthesizing voice: "I have permission from voice owner"
- [ ] Popup when building endorsement-style content: "I have commercial rights"
- [ ] Popup when transforming imported third-party media: "I accept responsibility"
- [ ] Must be a REAL interaction step, not buried legal text
- [ ] Block by default: celebrity cloning, third-party voice cloning without confirmation, fake endorsements, "make this person say..." deception, non-consensual intimate edits, child-risk content

### Model Tiers — 4 Levels (PARTIAL — needs proper API routing)
- [ ] GHS Standard: local LLM (Ollama) — free, rough drafts, basic planning
- [ ] GHS Pro: smaller hosted models (GPT-4o-mini, Claude Haiku) — 1 credit, better planning
- [ ] GHS Premium: top production models (GPT-4o, Claude Sonnet) — 3 credits, strong planning
- [ ] GHS Premium Best: highest reasoning (GPT-5.4, Claude Opus) — 5 credits, best supervision
- [ ] FFmpeg execution MUST stay deterministic across ALL tiers
- [ ] Local LLM must NOT be hidden default for all assembly intelligence
- [ ] Pro/Premium/Premium Best must route to hosted providers
- [ ] User sees tier choice, NOT provider names

### Expanded Sound Vault — MUCH bigger (PARTIAL — 58 exists, needs 200+)
- [ ] Priority sounds to add: piano hits, soft piano beds, various whooshes, risers, impacts, wind variants, rain variants, thunder, footsteps (wood/carpet/gravel/concrete), crowd ambience variants, market ambience, city ambience, village ambience, office room tone, keyboard/typing, cloth movement, paper movement, water splash variants, kitchen sounds, doors (open/close/slam), vehicle pass-bys, school ambience, classroom ambience, educational playful sounds, children learning support sounds
- [ ] Do NOT use live generation for ordinary sounds that can be preloaded
- [ ] Preloaded sounds should be properly tagged and searchable

### User Messaging — Sound Ownership (NOT added)
- [ ] Add to Terms: "Custom-generated sound created inside GHS may be used by the customer subject to GHS terms and any applicable third-party provider terms. For imported third-party sounds, the customer is responsible for complying with applicable license, attribution, and usage restrictions. GHS may provide attribution assistance, but the customer remains responsible for lawful final use."
- [ ] Do NOT promise "no one can penalize them" or "they fully own everything"

### Review Panels Before Export (NOT built as unified system)
- [ ] Panel 1: Import Summary
- [ ] Panel 2: Narration Plan
- [ ] Panel 3: Music Plan
- [ ] Panel 4: Sound Effects Plan
- [ ] Panel 5: Subtitle / Overlay Plan
- [ ] Panel 6: Source / License Summary
- [ ] Panel 7: Assembly Preview
- [ ] Panel 8: Export Settings
- [ ] No final export without approval through these panels

### Narration as First-Class System (PARTIAL)
- [ ] Language selection per narration
- [ ] Voice choice (standard AI / user voice / brand voice)
- [ ] Speed, tone, pacing, emphasis control
- [ ] Start/stop/pause points planned in timeline
- [ ] Interaction with music (ducking rules)
- [ ] Interaction with SFX (emphasis points)
- [ ] Subtitle alignment
- [ ] Narration decisions visible during review BEFORE rendering
- [ ] Educational / commercial / story / explainer narration modes

### Scene-Directed Audio Storytelling Layer (from gio_home_studio_scene_directed_audio_storytelling_pass.md)
- [ ] Scene interpretation: detect emotional tone, speech style, ambience need, SFX need, music need, whisper/low-volume need
- [ ] Audio layers model: narration, dialogue, music, ambience, foley/SFX, silence/pause — as separate controllable layers
- [ ] Whisper and emotional voice handling: voice-direction tags (whisper, breath-heavy, trembling, intimate, grieving, fearful)
- [ ] Voice-direction controls: volume style, speed, pause intensity, emotional style tag
- [ ] Car driving scene ambience support: engine hum, road/tire, cabin vibration, dashboard rattle
- [ ] Shooting/tension scene support: distant/near gunshot, burst fire, sword clash, shield movement, heartbeat pulse
- [ ] SFX must fit the text — supervisor infers from story, not random
- [ ] Multi-speaker dialogue: narrator + character 1 + character 2 + character 3 minimum
- [ ] Character voice registry: name, age, gender, voice quality, preferred voice ID, language/dialect
- [ ] Timeline and mixing rules: voice priority, music ducks under speech, SFX doesn't bury dialogue, silence preserved
- [ ] Audio-only mode: MP3/WAV export, no video generation, same review workflow
- [ ] Review page as finishing desk: editable narration, dialogue, voice selection, music, ambience, SFX, volumes
- [ ] Preview tools: narrator voice, character voice, dialogue, music, ambience, SFX previews before full generation

### SFX Library Loading Plan (from gio_home_studio_sfx_library_loading_plan_and_free_resource_links.md)
- [ ] Free SFX Sources help card in SFX Library page: Freesound, Pixabay, Mixkit, Sonniss, Openverse links
- [ ] Category-specific quick search links (thunder, rain, wind, gunshot, sword, footsteps, etc.)
- [ ] Loading guidance: download → rename to expected filename → place in storage/sfx/ → refresh
- [ ] Quality rules: clean, not too long, not overloaded with music, good for looping
- [ ] Duration guidance: one-shot 0.5-5s, ambience 10-60s, tension 1-6s, beds 15-60s
- [ ] Priority Pack 1 (must load): thunder, rain_light, rain_heavy, wind, storm, gunshot, sword_clash, footsteps, footsteps_run, door_creak, market_noise, crowd_murmur, horse_gallop, heartbeat, forest_ambience
- [ ] Priority Pack 2: explosion, fire_crackling, crowd_cheer, crowd_panic, city_traffic, church_bell, ocean_waves, river_stream, horror_sting, dog_bark

### Character Voice and Story Identity (from gio_home_studio_character_voice_and_story_identity_update.md)
- [ ] Character creation Method A: manual create with name, age, height, gender, culture, country, dialect, voice type, images, voice preview
- [ ] Character creation Method B: AI asks "Save this character?" after generation — save main actor / speaking actors / all / none
- [ ] Character library: full profile with name, project association, voice ID, voice provider, appearance, wardrobe, hairstyle, personality, reference images, motion reference, pose pack, keep-same toggle
- [ ] Character Pack system: front portrait, side portrait, three-quarter, full body, expressions, fixed look sheet
- [ ] Character continuity: reuse same character across scenes and projects, fixed appearance description
- [ ] Voice identity persistence: same voice repeated across all scenes, dialect/language preserved

### Multi-Mode Architecture (from gio_home_studio_multi_mode_architecture_plan.md)
- [ ] One shared AI media assembly engine powering all modes (not disconnected mini-products)
- [ ] Core flow: Interpret → Plan → Generate assets → Sync on timeline → Review → Final render
- [ ] Text to Audio mode: audiobook, radio drama, podcast, narrated story — cheaper than video
- [ ] Supervisor system: brain that decides what needs to happen per scene
- [ ] Timeline engine: places narration, dialogue, images, clips, music, SFX in correct sequence
- [ ] Finishing desk: review area where user fixes/replaces/regenerates without restarting everything

### Overlay/Text System Upgrade (from claude_code_overlay_upgrade_command.md)
- [ ] Modern social media overlay style: text reveal, caption behavior, sticker/card look
- [ ] Study reference videos for pacing and placement patterns
- [ ] Must work in actual video rendering, not just preview

### Product Controls BEFORE Automation
- [ ] Rights confirmation flows before risky actions
- [ ] Sound license metadata before production
- [ ] Attribution generation before export
- [ ] Approval gating before final render
- [ ] Review-first export always
- [ ] These are FOUNDATIONAL, not a future "compliance layer"

---

### Later — AI Content Creator
- [ ] Content Memory (learn preferred styles, tones, platforms over time)
- [ ] Event/occasion awareness (Nigerian holidays, trending days, user birthdays)
- [ ] Telegram bot delivery — send draft to phone for review via Telegram
- [ ] WhatsApp delivery — send content to user's WhatsApp for mobile review

---

## USER ACTION ITEMS (no code)
- [ ] Email support@fal.ai to unlock account
- [x] Verify Segmind account at segmind.com (DONE — working now)
- [ ] Top up ElevenLabs credits
- [ ] Set YouTube/Facebook/TikTok OAuth credentials (must be done manually by user on each platform)

## ENV SETUP NEEDED (for new features)
- [ ] Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (Google Cloud Console → OAuth 2.0)
- [ ] Set AUTH_SECRET in .env (run: `npx auth secret`)
- [ ] Set NEXTAUTH_URL=http://localhost:3200 in .env

## FUTURE PHASES
- [ ] SaaS billing/credit deduction system
- [ ] Safety/NSFW detection layer on media upload
- [ ] Content Memory (learn user preferences over time)
- [ ] Event/occasion awareness calendar
- [ ] Telegram bot delivery for review
- [ ] WhatsApp Web bridge for content delivery
- [ ] Multi-user auth/permissions
- [ ] Trend/competitor monitor
- [ ] Multi-language dubbing full UI
- [ ] Full 4-step Commercial wizard from mock
- [ ] Mobile app (React Native)
