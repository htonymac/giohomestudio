# GioHomeStudio — Commercial Maker Build Instructions
# Owner: Henry | Platform: Windows | Version: 2.0
#
# ⚠️ THIS DOCUMENT IS FOR THE COMMERCIAL SESSION ONLY
# DO NOT build Series Mode, Reel Builder, Free Mode, or any other mode
# DO NOT build the full GioHomeStudio platform in this session
# YOUR ONLY JOB in this session = Build Commercial Maker Mode 1 and Mode 2
# NOTHING ELSE
#
# READ THIS ENTIRE FILE BEFORE DOING ANYTHING

---

## ⚠️ CRITICAL RULES — FOLLOW ALWAYS

1. **THIS SESSION IS FOR COMMERCIAL MAKER ONLY.** Do not build Series Mode, Reel Builder, Free Mode, or any other part of GioHomeStudio. Commercial Maker = Mode 1 and Mode 2 only.
2. **Read this entire document first.** Do not start building until you have read every section.
3. **Do not invent features.** Build only what is described here. Nothing more.
4. **Do not skip phases.** Each phase must work end-to-end before the next begins.
5. **Do not ask permission for routine actions.** Fix errors automatically and continue.
6. **Do not change the tech stack.** The stack is defined in Section 3. Do not substitute.
7. **When in doubt — ask Henry.** One short question. Then build.
8. **All content must be editable at every stage** until Henry gives final approval.
9. **Never silently fail.** If something breaks, show Henry exactly what failed and why.

---

## SECTION 1 — WHAT THIS SOFTWARE IS

GioHomeStudio is a video content production and publishing platform that runs on Henry's Windows PC.

Henry uses it to:
- Create professional video commercials from his images, video clips, and property footage
- Build animated series episodes from plain English story descriptions
- Build short-form reels using an emotion vocabulary picker
- Create any video from a free-form description
- Review, approve, and publish videos to social media automatically

**Henry does not write code. Henry speaks plain English. The system does the rest.**

---

## SECTION 2 — WHAT CLAUDE CODE MUST DO

Claude Code is the primary AI brain of this system. Your job is to:

1. Build and maintain the entire GioHomeStudio application
2. Run the video production pipeline
3. Fix errors automatically without stopping
4. Route simple tasks to the local LLM (Mistral via Ollama) to save credits
5. Send Henry alerts when videos are ready for review
6. Handle fallback operations when offline using the offline guide
7. Never go off script — build only what is described in this document

---

## SECTION 3 — TECHNOLOGY STACK — DO NOT CHANGE THIS

| Layer | Technology |
|---|---|
| Web Frontend | Next.js + TypeScript + React + Tailwind CSS |
| Backend API | Python + FastAPI |
| Media Processing | FFmpeg + Pillow + OpenCV |
| Primary AI | Claude Code (you) |
| Secondary AI | Mistral via Ollama (local — use for simple tasks) |
| Voice Generation | ElevenLabs API |
| Music Generation | Suno API |
| Mobile App | React Native (Phase 23 — do not build yet) |
| Database | SQLite |
| Browser Automation | Playwright |
| Social Publishing | Later App API |
| Alerts | Telegram Bot API + Gmail API |
| Version Control | Git + GitHub CLI |
| Deployment | Vercel CLI / Netlify CLI |

---

## SECTION 4 — FOLDER STRUCTURE — CREATE THIS EXACTLY

```
C:/GioHomeStudio/
  ├── web/                        (Next.js + TypeScript frontend)
  ├── backend/                    (Python FastAPI server)
  │   ├── api/
  │   ├── core/
  │   ├── enhancement/            (Pillow/OpenCV image processing)
  │   ├── render/                 (FFmpeg render service)
  │   ├── jobs/                   (Async job queue)
  │   └── models/
  ├── mobile/                     (React Native — DO NOT BUILD YET)
  ├── config/                     (CLAUDE.md, config.json, pipeline.md)
  ├── database/                   (SQLite)
  ├── content/
  │   ├── projects/               (Commercial Maker project files)
  │   ├── stories/                (Series episode stories)
  │   ├── assets/                 (Uploaded images, clips, logos, audio)
  │   ├── scenes/                 (Generated scene files)
  │   ├── output/                 (Assembled video files)
  │   ├── approved/               (Approved final videos)
  │   └── archive/                (Published videos)
  ├── series/                     (Series bibles and character profiles)
  ├── logs/                       (All logs go here)
  └── offline/                    (Offline fallback queue)

C:/Users/Henry/Desktop/offline_fallback_guide.md
```

---

## SECTION 5 — CONTENT MODES — THERE ARE FIVE

Build these five modes and nothing else. Each mode is described fully below.

| Mode | What It Does |
|---|---|
| MODE 1: Commercial Maker (Slide) | Slide-based ad from images + captions + music |
| MODE 2: Commercial Maker (AI Ad) | AI watches uploaded video/images and creates a full ad with narration |
| MODE 3: Series Mode | Full episodes from plain English story |
| MODE 4: Reel Builder | Short-form reels using emotion vocabulary |
| MODE 5: Free Mode | Describe anything — AI builds it |

---

## SECTION 6 — MODE 1: COMMERCIAL MAKER (SLIDE-BASED)

### What It Does
Henry uploads product images, a logo, and audio. The system builds a polished promotional video by assembling the images into slides with captions, effects, voiceover, and music.

### Step-by-Step — Build This Exactly

**Step 1 — Henry uploads content**
- Up to 15 images or video clips
- One logo file
- One audio track (optional)

**Step 2 — Henry fills in project info**
- Product or business name
- One-line description
- Mood: Luxury / Energetic / Calm / Playful / Professional

**Step 3 — Henry arranges slides**
- Drag and drop to reorder
- AI suggests best order based on commercial flow
- Henry can follow suggestion or keep own order

**Step 4 — Per-slide controls (each slide has)**
- Caption text box — Henry types caption here
- Font family selector
- Font size selector
- Bold / Italic toggles
- Orientation: Auto / Portrait / Landscape
- Enhancement: Auto or Manual slider (1 to 100)
- Live thumbnail preview — updates immediately

**Step 5 — Text polish**
- Free mode: punctuation fix, capitalisation fix, spacing cleanup
- Before applying: show original vs polished — Henry approves or rejects

**Step 6 — Enhancement**
- Enhance Like iPhone button — one click
- Per-slide slider: 1 to 100
- Global slider: applies same level to all slides
- Smart Enhance Pro panel: brightness, contrast, saturation, tint, sharpen, blur, vignette, tone
- Presets: Cinematic, HDR, Natural, Clean Social, Warm Promo

**Step 7 — Contact CTA**
- Contact method: WhatsApp / Call / Telegram
- Primary phone number field
- Secondary phone number field (optional)
- CTA overlay added to final slide or end card
- Save as reusable preset

**Step 8 — Audio**
- Upload soundtrack: MP3, WAV, AAC, M4A
- Preview before committing
- Volume slider

**Step 9 — Export settings**
- Format: 16:9 / 9:16 / 1:1
- Output file name
- Output folder destination

**Step 10 — Python render pipeline runs**
- Each slide processed through enhancement (Pillow/OpenCV)
- Caption overlay applied with font settings
- Orientation and padding handled (portrait images NEVER stretched — use blur fill)
- Slides assembled via FFmpeg
- Audio mixed in
- Contact CTA overlay added
- Final MP4 exported
- Success or failure shown clearly

**Step 11 — Live preview (MANDATORY)**
- Center panel shows large live preview
- Updates in real time as Henry makes changes
- What Henry sees in preview = exactly what the export will look like
- This is not optional — build it properly

---

## SECTION 7 — MODE 2: COMMERCIAL MAKER (AI AD — VIDEO TO VIDEO)

### What It Does
Henry uploads a property video, property images, or both. The AI watches the video and analyses the images. The AI then creates a complete professional advertisement with narration, flowing animated text, flowing company name, contact details, and music — without Henry needing to write anything.

### This Is Different From Mode 1
- Mode 1 = Henry builds slide by slide manually
- Mode 2 = Henry uploads raw footage and AI does everything automatically

### Step-by-Step — Build This Exactly

**Step 1 — Henry uploads raw content**
- Property video (MP4, MOV, AVI) — AI will watch this
- Property images (JPG, PNG) — AI will analyse these
- Company logo (optional)
- Henry can upload video only, images only, or both together

**Step 2 — AI analyses the uploaded content**
- If video uploaded: AI watches the full video using computer vision
- AI identifies: property type, rooms visible, features present (pool, garden, balcony, etc.)
- If images uploaded: AI analyses each image for property features
- AI builds a complete understanding of the property before asking Henry anything

**Step 3 — AI asks Henry a short list of questions**

After analysing, AI shows Henry a form with pre-filled answers based on what it saw. Henry corrects or confirms:

```
Property type: [Apartment] ← AI pre-fills this from video analysis
Bedrooms: [2 bed] ← Henry fills this in
Bathrooms: [2 bath] ← Henry fills this in
Key features: [Swimming pool, balcony, fitted kitchen] ← AI pre-fills from analysis
Location area: [Lekki Phase 1] ← Henry fills this in
Price: [₦45,000,000] ← Henry fills this in (optional)
Company name: [Henry Properties] ← Henry fills this in
Contact: WhatsApp / Call / Telegram ← Henry selects
Contact number: [+234...] ← Henry fills this in
Ad tone: Luxury / Professional / Energetic ← Henry selects
Ad duration: 30 seconds / 60 seconds / 90 seconds ← Henry selects
```

**Step 4 — AI generates the ad script automatically**

Based on the analysis and Henry's answers, AI writes a complete narration script. Example:

> "Welcome to this stunning 2-bedroom apartment in the heart of Lekki Phase 1. Featuring a private balcony, sparkling swimming pool, and a fully fitted kitchen — this is luxury living redefined. Contact Henry Properties today on WhatsApp to arrange your viewing."

Henry sees the script and can edit it before production begins.

**Step 5 — AI builds the video ad**

- Source video is cut, trimmed, and sequenced by AI for best flow
- Images are animated with Ken Burns, zoom, and pan effects via FFmpeg
- Flowing animated text overlays appear on screen (property details, price, features)
- Company name animates in at the correct moment (flowing entrance animation)
- Contact details appear on final frame with CTA button style overlay
- Narration voiceover generated via ElevenLabs from the script
- Background music added via Suno or uploaded track
- Color grading applied based on tone selected
- All assembled via FFmpeg into final MP4

**Step 6 — Flowing text and animations — build these exactly**

The AI ad must include these animated text elements:
- Property headline — flies in from left or fades in
- Bedroom/bathroom count — appears with icon
- Key features — scrolls or appears one by one
- Price — bold prominent display (if provided)
- Company name — animated entrance, stays visible
- Contact number and method — final frame overlay with WhatsApp/phone icon
- Call to action text — "Call Now", "Message Us", "Book a Viewing"

All text animations are handled by FFmpeg drawtext filter with motion parameters.

**Step 7 — AI polishes everything before showing Henry**

- AI checks: does the narration match what is visible in the video?
- AI checks: are all property details mentioned in the script?
- AI checks: is the company name and contact clearly visible?
- AI suggests improvements if anything is missing

**Step 8 — Henry previews and approves**

- Henry watches the complete ad
- Henry can edit: script, text overlays, company name, contact, music, voice
- Henry can regenerate any single element without regenerating everything
- Henry approves or disapproves with feedback
- If disapproved — AI fixes specifically what Henry said and regenerates

**Step 9 — Alert and publishing**

- Telegram or Gmail alert sent to Henry when ad is ready
- On approval — sent to Later App for scheduling
- Published to selected social media pages automatically

### Rules for Mode 2
- AI must always analyse the video/images BEFORE asking Henry any questions
- AI pre-fills as much as possible — Henry should fill minimum fields
- Never produce the ad without Henry confirming the details form first
- Company name must always appear in the ad — never skip this
- Contact details must always appear in the ad — never skip this
- If Henry uploads no video and no images — tell Henry to upload content first

---

## SECTION 8 — MODE 3: SERIES MODE

### What It Does
Henry types a story for an episode in plain English. The system breaks it into scenes, assigns emotion/motion vocabulary, handles images per scene, generates voiceover and music, assembles the full episode.

### Step-by-Step

1. Henry types episode story in plain English
2. AI breaks story into scenes — each scene gets a description
3. AI assigns emotion vocabulary to each scene (from the vocabulary list in Section 11)
4. Henry can upload an image per scene OR leave it for AI to describe
5. AI writes a detailed video prompt per scene
6. ElevenLabs generates voiceover from the narration
7. Suno generates background music
8. FFmpeg assembles all scenes into full episode
9. AI Adviser reviews and gives recommendations
10. Henry approves or disapproves

### Rules
- Henry can edit any scene at any time before final render
- Changing one scene only re-renders that scene — not the whole episode
- Voice and music can be changed without re-rendering the video

---

## SECTION 9 — MODE 4: REEL BUILDER

### What It Does
Henry picks from emotion and scene vocabulary chips. System builds short-form reels from uploaded footage using FFmpeg effects and animations.

### Step-by-Step

1. Henry uploads footage or selects from existing episode scenes
2. Henry picks from vocabulary chips (see Section 11 for full list)
3. Henry sets: number of reels, duration (15s / 30s / 60s), platform format
4. AI translates vocabulary selections into professional FFmpeg assembly instructions
5. FFmpeg builds the reels
6. ElevenLabs adds voiceover if needed
7. Suno adds music
8. YouTube link overlay added if enabled
9. Henry approves or disapproves
10. Published to selected platforms

### Rules
- Henry never writes video prompts — the vocabulary chips do this automatically
- Platform formats handled automatically: 9:16 for TikTok/Reels, 16:9 for YouTube, 1:1 for Feed

---

## SECTION 10 — MODE 5: FREE MODE

### What It Does
Henry describes anything in plain English. No categories, no templates, no restrictions. AI builds it.

### Step-by-Step

1. Henry types any description: "A cat flying off a cliff at sunset" or anything
2. Henry optionally uploads images or video clips to be included
3. Henry sets: duration, format, destination page
4. AI enhances the description into a professional FFmpeg assembly prompt
5. FFmpeg assembles the video using uploaded assets + effects
6. ElevenLabs adds voice if needed
7. Suno adds music
8. Henry approves and publishes

---

## SECTION 11 — EMOTION VOCABULARY — BUILD AS UI SELECTORS

Build all of these as clickable chip selectors in the Reel Builder and Series Mode interfaces. Henry never types these — he clicks them.

| Category | Options |
|---|---|
| Emotional States | Heartbreak, Grief, Longing, Despair, Hope, Joy, Shame, Guilt, Jealousy, Pride, Nostalgia, Loneliness, Forgiveness, Betrayal, Redemption |
| Action States | Chase, Confrontation, Battle, Escape, Ambush, Duel, Pursuit, Sacrifice, Rescue, Collapse, Explosion, Standoff, Surrender, Retaliation, Infiltration |
| Reaction States | Shock, Disbelief, Rage, Silence, Denial, Acceptance, Breakdown, Determination, Numbness, Revelation, Defiance, Resignation, Awakening, Vengeance, Relief |
| Motion Styles | Slow motion, Fast cut, Freeze frame, Flashback, Flash forward, Montage, Close up, Wide shot, Bird eye view, Ground level, Tracking shot, Zoom in, Zoom out, Spin shot, Time lapse |
| Atmosphere | Dark, Cinematic, Raw, Epic, Intimate, Haunting, Tense, Melancholic, Mysterious, Uplifting, Gritty, Dreamlike, Violent, Romantic, Spiritual |
| Character State | Broken, Rising, Determined, Lost, Reborn, Betrayed, Victorious, Sacrificed, Hunted, Powerful, Vulnerable, Conflicted, Transformed, Isolated, Awakened |
| Pacing | Buildup, Climax, Aftermath, Reveal, Twist, Resolution, Cliffhanger, Cold open, Callback, Parallel |

---

## SECTION 12 — EDIT AT ANY STAGE — THIS IS MANDATORY

Henry must be able to edit any element at any stage without losing progress or restarting the full pipeline.

| What Henry Edits | System Does |
|---|---|
| Slide image | Replace image, re-apply enhancement, re-preview |
| Slide caption | Update overlay, offer polish option |
| Font settings | Update live preview immediately |
| Enhancement slider | Re-process image, update preview |
| Orientation mode | Recalculate layout, update preview |
| Commercial script | Re-generate voice only — no video re-render needed |
| Voice style or tone | Re-generate voice only |
| Background music | Re-generate music, re-mix |
| Shot order | Re-sequence, re-render assembly |
| Company name in AI ad | Update text overlay — no full re-render |
| Contact details | Update overlay — no full re-render |
| Ad narration script | Re-generate voice — no full re-render |
| Caption for social media | Update in Later App queue |
| Post date and time | Update in Later App queue |

---

## SECTION 13 — FULL PIPELINE — EVERY STAGE

| Stage | What Happens | Tool |
|---|---|---|
| 1. Upload | Henry uploads images, videos, logo, audio | Interface |
| 2. Analysis | AI analyses all uploaded content | Claude Code + OpenCV |
| 3. Questions | AI asks Henry to confirm property/product details | Interface form |
| 4. Script | AI writes narration script | Claude Code / Local LLM |
| 5. Enhancement | Images processed through Python pipeline | Python + Pillow/OpenCV |
| 6. Text polish | Captions cleaned up — compare before apply | Local LLM |
| 7. Assembly | FFmpeg assembles video with all effects and text | FFmpeg via Python |
| 8. Voice | ElevenLabs generates narration from script | ElevenLabs API |
| 9. Music | Suno or uploaded track added | Suno API / Upload |
| 10. Text overlays | Company name, contact, features animated onto video | FFmpeg drawtext |
| 11. CTA overlay | Contact action added to final frame | FFmpeg |
| 12. AI Adviser | Claude Code analyses video, gives recommendations | Claude Code |
| 13. Alert | Telegram or Gmail alert sent to Henry | Telegram / Gmail API |
| 14. Review | Henry watches video, reads adviser notes | Interface |
| 15. Approval | Henry approves or disapproves with feedback | Interface |
| 16. Publish | Video sent to Later App for scheduling | Later App API |
| 17. Inventory | Record saved to database | SQLite |
| 18. Analytics | Reaction scores pulled from platforms after posting | Platform APIs |

---

## SECTION 14 — FFMPEG EFFECTS — BUILD ALL OF THESE

Use FFmpeg for all video processing. These effects must all be implemented:

- Ken Burns effect — slow cinematic zoom into still images
- Pan left/right across wide shots
- Fade transitions between clips
- Color grading: warm, cold, cinematic, vintage, luxury
- Text overlays with drawtext filter — animated entrance
- Flowing text animation — text slides in from side or fades up
- Company name animation — branded entrance at set timing
- Logo watermark — positioned, timed, with opacity control
- Speed control — slow motion or speed up
- Vignette — darkens edges for cinematic feel
- Audio ducking — music lowers when narration plays
- Beat-synced cuts — cuts timed to music tempo
- Portrait image handling — blur fill background, NEVER stretch
- Subtitle/caption burn-in — text captions on video frames

---

## SECTION 15 — OFFLINE FALLBACK SYSTEM

When Claude Code is not reachable:

1. System detects Claude Code is offline
2. System loads: `C:/Users/Henry/Desktop/offline_fallback_guide.md`
3. Mistral (local LLM) takes over simple tasks
4. Complex tasks are queued for when Claude Code returns
5. Interface shows banner: "Claude Code offline — running on local AI"
6. Telegram alert sent to Henry immediately
7. All actions logged with timestamps
8. When Claude Code returns: reads the absence log, processes queued tasks
9. Interface shows: "Claude Code back online"
10. Telegram alert sent to Henry confirming return

---

## SECTION 16 — ALERT SYSTEM

| Trigger | Alert Channel |
|---|---|
| Video ready for review | Telegram + Gmail |
| Claude Code offline | Telegram — immediate |
| Claude Code back online | Telegram |
| Pipeline error after 3 retries | Telegram + Gmail |
| Publishing confirmed | Telegram |
| Approval deadline approaching | Telegram — urgent |
| API credits running low | Gmail |

---

## SECTION 17 — INVENTORY DATABASE

Every video gets a record with these fields:

- video_id, title, content_type (Commercial/Series/Reel/Free)
- date_created, date_approved, date_posted
- platforms_posted, approval_status
- disapproval_reason, revision_count
- views, likes, shares, comments, performance_score
- ai_adviser_score, repost_count, next_eligible_repost
- file_path, thumbnail_path

---

## SECTION 18 — REPOST CONTROL RULES

- Same video cannot be reposted on same platform within 90 days
- Maximum 4 reposts per video total
- Maximum 3 platforms per video per week
- System blocks automatic repost if rule violated
- System alerts Henry when a video becomes eligible for repost

---

## SECTION 19 — AI ADVISER

Before showing Henry any video for approval, Claude Code must analyse it and report:

- Hook strength — is the first 8 seconds strong enough?
- Pacing — do cuts match platform norms?
- Audio balance — is voice vs music level correct?
- Title / caption strength — score and 3 alternatives
- Best post time — based on Henry's performance history
- Platform optimisation — correct format and length?
- Company name visible — is it clear and readable?
- Contact details visible — can viewers see how to reach Henry?
- Retention prediction — estimated % based on hook and pacing

---

## SECTION 20 — CLAUDE.md FILE — CREATE THIS AT C:/GioHomeStudio/config/CLAUDE.md

```
# GioHomeStudio — Claude Code Standing Instructions
# Owner: Henry | Platform: Windows | Version: 2.0

## Identity
You are the AI engine for GioHomeStudio.
Owner is Henry. Build only what is in the technical document.

## Tech Stack — Do Not Change
- Frontend: Next.js + TypeScript + Tailwind
- Backend: Python + FastAPI
- Media: FFmpeg + Pillow + OpenCV
- Database: SQLite

## Core Rules
- Never ask for approval on routine pipeline actions
- Fix errors automatically and report what was fixed
- Use Local LLM (Mistral) for simple tasks — save Claude credits
- All content editable at every stage until Henry approves
- Render errors always visible — never silently fail
- Portrait images never stretched — use blur fill or padding
- Show original vs polished text before applying any caption change
- Log everything to C:/GioHomeStudio/logs/
- If offline: load C:/Users/Henry/Desktop/offline_fallback_guide.md

## Mode 2 Rules (AI Ad)
- Always analyse the video/images BEFORE asking Henry questions
- Pre-fill the details form from what AI observed
- Company name must always appear in the ad
- Contact details must always appear in the ad
- Never produce an ad without Henry confirming the details form

## Build Order
- Follow the phase plan in Section 21 exactly
- Do not skip phases
- Each phase must work end-to-end before the next begins
- Confirm each phase with Henry before starting the next
```

---

## SECTION 21 — BUILD PHASES — FOLLOW THIS ORDER EXACTLY

| Phase | What to Build | Priority |
|---|---|---|
| Phase 1 | Folder structure, CLAUDE.md, config.json, offline guide | CRITICAL — DO FIRST |
| Phase 2 | Python FastAPI backend — project save, media upload, render job APIs | CRITICAL |
| Phase 3 | Next.js frontend shell — sidebar, navigation, dashboard | CRITICAL |
| Phase 4 | Mode 1: Commercial Maker Slide — upload, slide editor, live preview | CRITICAL |
| Phase 5 | Python render pipeline — FFmpeg MP4 export, portrait-safe, orientation | CRITICAL |
| Phase 6 | Enhancement system — Enhance Like iPhone, per-slide slider, global slider | HIGH |
| Phase 7 | Smart Enhance Pro panel — brightness, contrast, saturation, sharpen, vignette, presets | HIGH |
| Phase 8 | Mode 2: AI Ad Maker — video upload, AI analysis, details form, script, animation | HIGH |
| Phase 9 | Flowing text animations — company name, features, contact, price via FFmpeg | HIGH |
| Phase 10 | Text polish — free cleanup, compare before apply | HIGH |
| Phase 11 | Contact CTA system — WhatsApp/Call/Telegram overlay, preset | HIGH |
| Phase 12 | Audio system — upload, preview, attach to render | HIGH |
| Phase 13 | Render job tracking — progress, success/failure, error display | HIGH |
| Phase 14 | Approval screen — preview, AI Adviser report, approve/disapprove | MEDIUM |
| Phase 15 | Alert system — Telegram and Gmail | MEDIUM |
| Phase 16 | Inventory screen — database view, search, filters | MEDIUM |
| Phase 17 | Mode 3: Series Mode — story input, scene generation, episode builder | MEDIUM |
| Phase 18 | Mode 4: Reel Builder — emotion vocabulary UI, FFmpeg reel generation | MEDIUM |
| Phase 19 | Mode 5: Free Mode — open description, AI enhancement | MEDIUM |
| Phase 20 | Offline fallback — Mistral, absence logging, catch-up | MEDIUM |
| Phase 21 | Multi-page management, Later App publishing | MEDIUM |
| Phase 22 | Analytics, budget tracker, repost rules | LOW |
| Phase 23 | AI Adviser learning system | LOW |
| Phase 24 | SaaS — credit system, subscriptions, multi-user | FUTURE — Month 2 |
| Phase 25 | React Native mobile app | FUTURE — Month 2 |

---

## SECTION 22 — CONFIG.json — CREATE AT C:/GioHomeStudio/config/config.json

```json
{
  "owner": "Henry",
  "platform": "windows",
  "version": "2.0",
  "server_port": 3000,
  "database_path": "C:/GioHomeStudio/database/inventory.db",
  "content_root": "C:/GioHomeStudio/content/",
  "offline_guide": "C:/Users/Henry/Desktop/offline_fallback_guide.md",
  "ai": {
    "primary": "claude-code",
    "fallback": "mistral-via-ollama",
    "local_llm_model": "mistral",
    "use_local_for_simple_tasks": true
  },
  "apis": {
    "elevenlabs_key": "SET_IN_ENV",
    "suno_key": "SET_IN_ENV",
    "telegram_bot_token": "SET_IN_ENV",
    "telegram_chat_id": "SET_IN_ENV",
    "gmail_credentials": "SET_IN_ENV",
    "later_app_key": "SET_IN_ENV",
    "github_token": "SET_IN_ENV"
  },
  "alerts": {
    "telegram": true,
    "gmail": true,
    "whatsapp": false
  },
  "repost_rules": {
    "min_days_same_platform": 90,
    "max_reposts_total": 4,
    "max_platforms_per_week": 3
  },
  "youtube_overlay": {
    "enabled": true,
    "channel_url": "SET_BY_HENRY",
    "cta_text": "Watch full episode on YouTube",
    "duration_seconds": 5,
    "position": "bottom_right"
  }
}
```

---

## SECTION 23 — FIRST PROMPT TO START THE BUILD

When Henry starts a new Claude Code session, he will paste this prompt:

> "I am Henry. I have shared the GioHomeStudio Commercial Maker build instructions. This session is for Commercial Maker ONLY — Mode 1 and Mode 2. Do not build anything else. Read the entire document now. Begin Phase 1: create folder structure at C:/GioHomeStudio/, create CLAUDE.md, create config.json, create offline_fallback_guide.md on my Desktop. Confirm completion and tell me what API keys you need before Phase 2. We are building Commercial Maker only."

---

## SECTION 24 — COMPLETE FEATURE LIST

| Feature | Mode | Status |
|---|---|---|
| Slide-based commercial from images — zero generation credits | Mode 1 | Build Phase 4 |
| AI watches uploaded video/images and creates full property ad | Mode 2 | Build Phase 8 |
| AI asks Henry property details and pre-fills from analysis | Mode 2 | Build Phase 8 |
| Flowing animated text — features, price, bedrooms on screen | Mode 2 | Build Phase 9 |
| Flowing animated company name — branded entrance animation | Mode 2 | Build Phase 9 |
| Contact details overlay — WhatsApp/Call/Telegram on final frame | Mode 1 + 2 | Build Phase 11 |
| AI narration script written from property analysis | Mode 2 | Build Phase 8 |
| ElevenLabs voiceover from script | All modes | Build Phase 8 |
| Background music via Suno or uploaded track | All modes | Build Phase 12 |
| Live preview — real time, accurate, mandatory | Mode 1 | Build Phase 4 |
| Enhance Like iPhone — one click | Mode 1 | Build Phase 6 |
| Smart Enhance Pro — full manual panel + presets | Mode 1 | Build Phase 7 |
| Per-slide and global adjustment sliders | Mode 1 | Build Phase 6 |
| Portrait-safe image handling — blur fill, never stretch | All modes | Build Phase 5 |
| Export 16:9 / 9:16 / 1:1 MP4 | All modes | Build Phase 5 |
| Text polish with compare before apply | Mode 1 | Build Phase 10 |
| Full series episodes from plain English story | Mode 3 | Build Phase 17 |
| Emotion vocabulary reel builder | Mode 4 | Build Phase 18 |
| Free form — describe and build anything | Mode 5 | Build Phase 19 |
| AI Adviser pre-approval recommendations | All modes | Build Phase 14 |
| Offline fallback via Mistral | System | Build Phase 20 |
| Telegram and Gmail alerts | System | Build Phase 15 |
| Full inventory and performance tracking | System | Build Phase 16 |
| Auto publishing to social platforms | System | Build Phase 21 |
| Repost control rules | System | Build Phase 22 |
| YouTube link overlay on short-form content | Mode 4 | Build Phase 18 |
| Multi-series and multi-page management | System | Build Phase 21 |
| SaaS subscription model | Platform | Phase 24 — Future |
| React Native mobile app | Mobile | Phase 25 — Future |

---

*End of GioHomeStudio Build Instructions — Version 2.0*
*Owner: Henry | Platform: Windows | Primary Builder: Claude Code*

---

# PART 2 — FREE MODE FINALIZATION + AUDIO DRAMA LAYER
# Version 3.0 — Written April 2026
# Status: BUILT AND LIVE (not future — already implemented)

---

## ⚠️ CRITICAL CORRECTION — TECH STACK (Read Before Anything)

The actual live build does NOT use Python FastAPI as the backend.
The real tech stack is:

| Layer | Technology |
|---|---|
| Frontend + Backend | Next.js 16+ App Router (TypeScript) — full-stack |
| ORM / Database | Prisma + PostgreSQL (local) |
| Media Processing | FFmpeg via fluent-ffmpeg (Node.js) |
| Primary AI | Claude Code (orchestration) |
| Local AI / Supervisor | Ollama — qwen2.5:14b (primary) + phi3 (fast preview) |
| Voice | ElevenLabs API |
| Music | Stock library + Kie.ai + Freesound + Jamendo adapters |
| Video | Runway API + Kling API + mock_video fallback |
| Image Gen | ComfyUI (local Flux.1) |
| Alerts | Telegram Bot API + Gmail API |
| Browser Automation | Playwright |
| Server Port | 3200 |
| Storage | /storage/ (voice/, video/, music/, merged/, sfx/) |

The Python / SQLite references in Sections 3, 4, 20, 22 are from the original spec.
They do not match what was built. Use this updated stack for all future work.

---

## SECTION 25 — FREE MODE: WHAT IS ACTUALLY BUILT

Free Mode is the most complete mode in the current build.

### What Henry Does
1. Types any plain English description in the Studio
2. Optionally adjusts 26 controls (duration, format, provider, voice, music, SFX, identity, etc.)
3. Clicks Generate
4. AI supervisor analyses the prompt and builds an OrchestrationPlan
5. Pipeline runs: enhance → video → voice → music → SFX → merge
6. Content goes to Review Queue with full audio editing controls

### What Free Mode Actually Produces
- Full video (Runway / Kling / mock_video fallback)
- Voice narration (ElevenLabs or mock_voice fallback)
- Music track (stock library / Kie.ai / uploaded)
- SFX layer (if events detected from text)
- Merged MP4 or MP3 final output
- Full version history in database

### Output Modes Available (all live)
| Mode | What It Produces |
|---|---|
| Text → Video | AI generates video + narration + music merged into MP4 |
| Text → Audio | Narration + music + SFX merged to MP3/WAV — no video |
| Images + Audio | Still images + narration + music assembled into slideshow MP4 |
| Hybrid | Video for key scenes, images for rest (partial — in progress) |
| Video → Video | Transform an existing video (partial — in progress) |

---

## SECTION 26 — AUDIO DRAMA LAYER (FULLY BUILT)

The audio system has 7 layers. They all exist in the codebase now.

### Layer 1 — Narration Script
- Stored separately from the cinematic video prompt
- `narrationScript` field on ContentItem (not the same as `enhancedPrompt`)
- Editable at any time on both Review page and Content Detail page
- Supports plain prose OR structured multi-speaker dialogue format

### Layer 2 — Voice Generation
- Provider: ElevenLabs (if API key set) or mock_voice fallback
- Models: eleven_multilingual_v2 (quality) / eleven_turbo_v2_5 (speed) / eleven_flash_v2_5 (ultra-fast)
- Speech styles: normal | whisper | emotional | commanding | trembling
- Per-style ElevenLabs presets (stability, style exaggeration, speed modifier)
- Speed control: 0.7 (slow) to 1.2 (fast)
- Volume control: 0.0 to 1.0

### Layer 3 — Music
- Provider abstraction: stock_library → Kie.ai → Freesound → Jamendo → mock
- Music source tracked: stock | pixabay | uploaded | generated | fallback
- Mood detection (12 moods): epic | war | rain | heavy_rain | nature | calm | emotional | action | suspense | dance | upbeat | dramatic
- Genre: cinematic | orchestral | ambient | electronic | acoustic | hip_hop
- Region: global | western | latin | asian | middle_eastern | african
- Volume control: 0.0 to 1.0 (default 0.85)
- Music source shown clearly to Henry in Review UI

### Layer 4 — Multi-Voice Dialogue (MVP)
- Dialogue parser supports: NARRATOR:, JOHN:, JOHN [whisper]:, [SFX: event]
- Speaker turns parsed and assigned to character voice registry
- CharacterVoice DB table: name, gender, toneClass, accent, language, voiceId, isNarrator
- Default voice pool (ElevenLabs free-tier): Sarah (narrator), Adam (male), Elli (female), etc.
- Audio segments concatenated via FFmpeg in order
- Supports: narrator + character 1 + character 2 + character 3 minimum

**How to write multi-speaker dialogue:**
```
NARRATOR: The city was silent when James stepped outside.
JAMES: Something is wrong tonight.
MARY [whisper]: I feel it too. Don't make a sound.
NARRATOR: They both looked up at the dark sky.
[SFX: thunder]
JAMES [commanding]: Run. NOW.
```

### Layer 5 — SFX / Environment
- 27 sound events in the library (drops MP3 into storage/sfx/ to activate)
- Categories: weather | crowd | action | nature | urban | horror | animal | vehicle
- AI supervisor auto-detects events from text (thunder, rain, crowd, gunshots, etc.)
- 89 regex rules covering all common scene types
- SFX can be flat-mixed or timed (beat-parser positions each event)
- FFmpeg adelay filter places each SFX cue at the correct timestamp
- Users can turn SFX off and re-merge from Review page

**Supported SFX events (examples):**
thunder, rain_light, rain_heavy, wind, storm, crowd_cheer, crowd_murmur, crowd_panic,
gunshot, explosion, sword_clash, footsteps, footsteps_run, fire_crackling, door_creak,
horse_gallop, ocean_waves, forest_ambience, river_stream, city_traffic, church_bell,
market_noise, horror_sting, heartbeat, dog_bark, engine_hum, road_noise, cabin_ambience

**SFX file naming: drop MP3 with matching filename into storage/sfx/**
Example: thunder → thunder.mp3, market noise → market_noise.mp3

### Layer 6 — FFmpeg Audio Assembly
All audio mixing is done by FFmpeg via fluent-ffmpeg Node.js:
- `mergeMedia()` — video + voice + music + SFX cues → MP4
- `mergeAudioOnly()` — voice + music + SFX → MP3/WAV (no video)
- `concatenateAudio()` — stitch multi-voice segments in order
- `createSlideshow()` — image sequence → silent video → then add audio
- Filter graph: adelay for timed SFX, amix for multiple audio layers
- Ducking: light (0.6) | heavy (0.4) music reduction under dialogue
- Dropout transition: 2-second smooth fade

### Layer 7 — Supervisor (Local AI Brain)
The supervisor reads every prompt and returns an OrchestrationPlan.
Two modes: blocking (waits for Ollama output) and non-blocking (rule_based instant + Ollama enriches in background).

**What the supervisor decides:**
- Content intent, subject type, video type, visual style, aspect ratio
- Music mood, music genre, narration need, music need
- SFX need + detected sound events
- Dialogue structure (narration_only | dialogue_present | mixed)
- Speaker count (1 = narrator only, 2+ = multi-voice)
- Scene type (dialogue | action | horror | romance | suspense | narration | flashback | climax)
- Emotional tone (neutral | tense | sorrowful | triumphant | fearful | joyful | angry)
- Speech style (normal | whisper | emotional | commanding | trembling)
- Tension level (0-3 scale)
- Environment type (indoor | outdoor | vehicle | underwater | space | crowd)
- Ducking plan (none | light | heavy)
- Recommended audio mode (voice_only | voice_music | voice_sfx_music | full_drama)
- Recommended video provider
- 8 story continuation suggestions (for episodic content)

---

## SECTION 27 — REVIEW PAGE: AUDIO FINISHING DESK

The Review page is the audio finishing desk. Henry can edit every audio parameter before approval.

### What is editable on Review page (per content item):

| Control | Panel | What It Does |
|---|---|---|
| Narration script text | Voice Panel | Edit what the voice says |
| Speech speed (0.7–1.2×) | Voice Panel | Change delivery pace |
| Voice selection | Voice Panel | Filter by man/woman/boy/girl then pick |
| Voice preview / sample | Voice Panel | Audition selected voice before applying |
| Voice language / dialect | Voice Panel | Select from full language list |
| Regenerate voice | Voice Panel | Generate new voice with current settings |
| Upload voice audio | Voice Panel | Replace with custom MP3/WAV file |
| Narration volume | Mix Panel | 0–100% |
| Music volume | Mix Panel | 0–100% |
| Re-merge (new volumes) | Mix Panel | Remerge with adjusted mix levels |
| Music mood | Music Panel | epic/war/rain/calm/emotional/action/suspense etc. |
| Music genre | Music Panel | cinematic/orchestral/ambient/electronic etc. |
| Regenerate music | Music Panel | Fetch new music track from stock library |
| Upload music | Music Panel | Replace with custom MP3/WAV |
| Music source info | Music Panel | Shows: stock / pixabay / uploaded / generated / fallback |
| SFX events detected | SFX Panel | Shows what the supervisor found |
| Remove SFX layer | SFX Panel | Re-merge without SFX |
| Multi-voice structure | Dialogue Panel | Shows speakers, structure, links to Character Voices |
| Re-generate multi-voice | Dialogue Panel | Re-generate with dialogue format |

### What automatically stays safe:
- Version history preserved (ContentVersion table) — every change creates a new version
- Previous voice/music/merged files are not deleted when replaced
- Runway/Kling video selection is not affected by audio editing
- Identity/casting controls are not affected
- Revise flow is not affected

---

## SECTION 28 — VOICE CATEGORIES AND LANGUAGE SUPPORT

### Voice categories (for filter UI)
- man — adult male voices
- woman — adult female voices
- boy — younger male voices
- girl — younger female voices

### Voice quality descriptors
- bass — deep, low, commanding resonance
- tenor — clear mid-range male
- soft — gentle, warm delivery
- commanding — strong, authoritative
- elder — aged, gravelly tone
- youthful — bright, energetic

### Accent regions (where supported by ElevenLabs)
- american
- british
- african
- australian
- neutral

### Language and dialect support — HONEST STATUS

| Language | Official ElevenLabs Support | Notes |
|---|---|---|
| English | YES — eleven_multilingual_v2 | Full support |
| Spanish | YES | Full support |
| French | YES | Full support |
| German | YES | Full support |
| Portuguese | YES | Full support |
| Hindi | YES | Full support |
| Italian | YES | Full support |
| Polish | YES | Full support |
| Arabic | YES | Full support |
| Swahili | YES (eleven_turbo_v2_5) | Supported |
| Yoruba | NO | Partial only — quality varies significantly |
| Igbo | NO | Partial only — quality varies significantly |
| Hausa | NO | Partial only — quality varies significantly |
| Zulu | NO | Partial only — quality varies significantly |
| Nigerian Pidgin | NO | Use English model — best-effort result only |

**Rule: Do not fake language support. Show these honest labels to Henry.**
If the language is not officially supported, show the warning. Still allow generation but explain.

---

## SECTION 29 — AUDIO-ONLY MODE (FULLY BUILT)

Output mode: `text_to_audio`
Audio mode: `audio_only`

### What it does
- Skips video generation entirely (no Runway/Kling API calls)
- Generates: narration + dialogue + music + SFX
- Merges all audio layers into one MP3 or WAV file
- Output file stored in storage/merged/

### When to use
- Podcast-style narration
- Audio story / audio drama
- Music + narration for voiceover work
- Background narration without video
- Cost-saving when video is not needed

### How to trigger
- In Studio → Output Mode → select "Text → Audio"
- Or set `outputMode: "text_to_audio"` in API

### Audio-only output shows in Review as:
- "audio-only" badge on the content card
- Audio player instead of video player where possible
- Same editing controls (voice, music, SFX, volumes) all available

---

## SECTION 30 — DATABASE FIELDS (CURRENT ACTUAL SCHEMA)

All audio control lives in the ContentItem table. These fields exist in Prisma:

```
narrationScript        — natural spoken text (NOT the cinematic prompt)
voiceSource            — "generated" | "uploaded" | "fallback" | "stock" | "manual"
voiceProvider          — resolved provider ("elevenlabs" | "mock_voice")
requestedVoiceProvider — what Henry asked for
voiceId                — ElevenLabs voice ID
voiceLanguage          — ISO 639-1 code (en, es, fr, yo, ig, ha, etc.)
narrationSpeed         — 0.7 to 1.2 (speech rate)
narrationVolume        — 0.0 to 1.0 (voice level in final mix)
musicSource            — "generated" | "uploaded" | "fallback" | "stock" | "pixabay" | "manual"
musicProvider          — resolved provider
requestedMusicProvider — what Henry asked for
musicVolume            — 0.0 to 1.0 (music level in final mix)
musicGenre             — cinematic | orchestral | ambient | electronic | acoustic | hip_hop
musicRegion            — global | western | latin | asian | middle_eastern | african
audioMode              — "voice_music" | "voice_only" | "music_only" | "audio_only"
outputMode             — "text_to_video" | "text_to_audio" | "images_audio" | "hybrid" | "video_to_video"
supervisorPlan         — JSON (OrchestrationPlan from local LLM supervisor)
voicePath              — path to voice file
musicPath              — path to music file
mergedOutputPath       — path to final output
```

CharacterVoice table (multi-voice registry):
```
name                   — character name (unique)
voiceId                — ElevenLabs voice ID
gender                 — "male" | "female" | "boy" | "girl"
toneClass              — "bass" | "tenor" | "soft" | "commanding" | "elder" | "youthful"
accent                 — "american" | "british" | "african" | "nigerian" | "neutral"
language               — "en" | "pidgin" | "yo" | "ig" | "ha" etc.
isNarrator             — boolean
imageUrl               — character reference image
visualDescription      — text description for visual consistency
role                   — "protagonist" | "antagonist" | "narrator" | "supporting" etc.
defaultSpeechStyle     — "normal" | "whisper" | "emotional" | "commanding" | "trembling"
referenceImages        — JSON array [{url, angle, label}]
```

---

## SECTION 31 — PIPELINE STAGES (CURRENT ACTUAL FLOW)

For Free Mode, the pipeline runs these stages in order:

| Stage | What Happens | File |
|---|---|---|
| 1. Input | Henry types prompt, adjusts controls | Studio page |
| 2. Supervisor | Local LLM analyses prompt → OrchestrationPlan | src/modules/supervisor/ |
| 3. Prompt Enhance | Converts to cinematic prompt + narration script | src/modules/prompt-enhancer/ |
| 4. Video Generate | Runway / Kling / mock_video | src/modules/video-provider/ |
| 5. Voice Generate | ElevenLabs → multi-voice if dialogue | src/modules/voice-provider/ + multi-voice/ |
| 6. Music Generate | Stock library / Kie.ai + fallback chain | src/modules/music-provider/ |
| 7. SFX Resolve | Map detected events → local MP3 files | src/modules/sfx/ |
| 8. Beat Parse | Extract timeline from [SFX:] tags in script | src/modules/beat-parser/ |
| 9. FFmpeg Merge | Combine all layers into final output | src/modules/ffmpeg/ |
| 10. Review | Content sent to Review Queue | app/dashboard/review/ |
| 11. Approve/Reject | Henry takes action | app/api/review/ |
| 12. Version History | All changes tracked in ContentVersion | Prisma ContentVersion |

---

## SECTION 32 — API ROUTES (AUDIO)

All routes are under `/api/` and use Next.js App Router.

### Voice
- `GET /api/voices` — List voices with category metadata
- `POST /api/voices/preview` — Generate 5-second voice sample for audition
- `POST /api/content/[id]/regenerate-voice` — Re-generate voice with new settings
- `POST /api/content/[id]/upload-voice` — Replace voice with uploaded file

### Music
- `POST /api/content/[id]/regenerate-music` — Fetch new music track
- `POST /api/content/[id]/upload-music` — Replace music with uploaded file

### Merge
- `POST /api/content/[id]/remerge` — Re-merge video + voice + music with new volumes

### Supervisor
- `POST /api/supervisor` — Get OrchestrationPlan from local LLM (blocking)
- `POST /api/llm-errand` — Send general errand to local Ollama

### SFX
- `GET /api/sfx` — List available SFX events and which files are present

---

## SECTION 33 — WHAT REMAINS BEFORE FREE MODE IS DECLARED FINISHED

### Real but partial (needs completion)
- Timed SFX cues: beat-parser produces timeline but full end-to-end is incomplete in some paths
- Dynamic ducking: supervisor recommends duck level but FFmpeg currently applies static volumes
- Ambience layer: supervisor detects ambienceNeed but no automatic provider/file selection yet
- Pause strategy: supervisor detects but not injected into voice generation

### What is NOT built yet (future stages)
- Reel Builder Mode (emotion vocabulary chips)
- Series Mode (full episodic episodes from story)
- Analytics dashboard
- Content calendar
- Budget tracker
- A/B testing
- Team collaboration / permissions
- Monetization tracker
- Multi-language support (generation, not just UI labels)
- Watermark / intro / outro system
- Continuation story threading (DB field exists, UI partial)
- Commercial Mode Mode 2 video analysis (partial)

### What is SOLID and production-ready
- Free Mode basic workflow (prompt → supervision → pipeline → review → approve/reject)
- Review page as full audio finishing desk (voice/music/SFX/mix controls)
- Multi-voice dialogue generation with character registry
- SFX detection and file-based library
- Audio-only output mode
- Voice categories and honest language support labels
- Stock music with source tracking
- Version history
- Destination page routing
- Telegram + Gmail alerts
- Revise flow (continue from existing item)
- Story continuation suggestions (8 suggestions from supervisor)
- Commercial Maker Mode 1 (slide-based)

---

## SECTION 34 — DEPLOYMENT

GioHomeStudio runs locally on Henry's Windows PC.
Port: 3200
Start: `npm run dev` in C:\Users\USER\Desktop\CLAUDE\giohomestudio\

Database: PostgreSQL (local instance)
Connection string: in .env as DATABASE_URL

Required .env variables:
```
DATABASE_URL=postgresql://...
ELEVENLABS_API_KEY=...
RUNWAY_API_KEY=...
KLING_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_CHAT_ID=...
FFMPEG_PATH=...
FFPROBE_PATH=...
STORAGE_PATH=...
NEXT_PUBLIC_APP_URL=http://localhost:3200
```

Do NOT deploy to Netlify. If cloud hosting is needed, use Cloudflare Pages or Vercel.

---

## SECTION 35 — SKILLS AND CLAUDE CODE RULES (UPDATED)

### After every coding task
- Run /simplify to check for unnecessary complexity
- Do NOT run /simplify for config edits, doc changes, single-line fixes

### Before deploying or pushing
- Run /security-check — applies to API routes, auth flows, DB queries, .env handling

### When building any new UI screen
- Use /frontend-design for layout and accessibility guidance

### When writing prompts for AI APIs
- Use /prompt-engineer before sending prompts to ElevenLabs, Kling, Ollama, or any LLM

### When encountering an unfamiliar library
- Use /wiki-researcher before making assumptions about the API

### When building or configuring MCP tools
- Use /mcp-builder

### Core behavior rules (unchanged)
- Never silently fail — show exact error to Henry
- Use local Ollama for simple tasks — save ElevenLabs / Runway credits
- All content editable at every stage until Henry approves
- Portrait images: blur fill background — NEVER stretch
- Show original vs polished text before applying any cleanup
- Log jobs and errors in the database (Job table)
- If local LLM offline: fall back to rule-based supervisor automatically

---

*End of GioHomeStudio Build Instructions — Version 3.0*
*Owner: Henry | Platform: Windows | Primary Builder: Claude Code*
*Sections 1–24: Original Commercial Maker Spec (Version 2.0)*
*Sections 25–35: Free Mode Finalization + Audio Drama Layer (Version 3.0, April 2026)*
