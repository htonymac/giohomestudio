# GHS Auto Content Creator — Full Product Plan
## A GioHomeStudio Mobile Product
**Version 1.0 | Planning Document**

---

## WHAT THIS PRODUCT IS

GHS Auto Content Creator is a mobile-first AI content engine that lives on a user's phone.

It watches the user's photo gallery with permission, picks interesting images automatically or on user request, transforms them into AI-enhanced video or photo content, and sends finished content to the user via WhatsApp or Telegram for review before anything is posted publicly.

The user reviews on their phone, edits if needed, approves, and GHS posts to their connected social accounts automatically.

It is personal. It is automatic. It is safe. It never posts without human approval.

---

## THE CORE LOOP (How it works end to end)

```
User grants photo permission
        ↓
GHS scans gallery for usable images
        ↓
AI analyses each image — detects content type, mood, context
        ↓
GHS suggests content ideas to user
        ↓
User selects an idea (or lets GHS choose automatically)
        ↓
AI enhances image (optional) → generates video or photo content
        ↓
AI writes caption, hashtags, call to action
        ↓
GHS sends finished content to user via WhatsApp or Telegram
        ↓
User reviews on phone — edits text, swaps music, approves or rejects
        ↓
GHS posts to connected social accounts
        ↓
Engagement data comes back → GHS learns what works for this user
```

---

## MODULE 1 — GALLERY ACCESS & IMAGE INTELLIGENCE

### How phone gallery access works
- Android: Uses READ_MEDIA_IMAGES permission (Android 13+) or READ_EXTERNAL_STORAGE
- iOS: Uses PHPhotoLibrary with limited or full access
- React Native: expo-image-picker or expo-media-library handles this cleanly
- User sees a standard OS permission dialog — same as Instagram, WhatsApp, Google Photos
- GHS never uploads raw gallery images to any server without explicit user consent

### What the Image Intelligence module does
When GHS scans a permitted image it runs analysis to detect:

**Content type detection:**
- Single person / group of people
- Outfit / fashion item
- Food or drink
- Product or item
- Landscape or location
- Event (party, wedding, graduation, celebration)
- Workspace or business environment
- Pet or animal

**Quality checks:**
- Is the image sharp enough to use?
- Is the face visible and clear (if person)?
- Is lighting acceptable?
- Is there any nudity or inappropriate content? → HARD BLOCK (see Safety module)

**Mood detection:**
- Happy / celebratory
- Serious / professional
- Relaxed / lifestyle
- Energetic / action

**Context tags:**
- Time of day (from EXIF data)
- Location (from EXIF if permitted — Lagos, Abuja, etc.)
- Camera used
- Date taken

All of this feeds the content suggestion engine.

---

## MODULE 2 — CONTENT SUGGESTION ENGINE

Based on image analysis, GHS suggests content ideas. Examples:

| Image detected | Suggestions offered |
|---|---|
| Person in stylish outfit | "Style post with outfit details" / "Fashion reel with music" / "OOTD carousel" |
| Group at event | "Event recap video" / "Celebration post" / "Tag your crew post" |
| Food on table | "Recipe tease video" / "Restaurant review post" / "Food aesthetic reel" |
| Workspace / desk | "Day in my life clip" / "Business motivation post" / "Behind the scenes" |
| Product / item | "Product showcase video" / "Before/after reveal" / "Unboxing style clip" |
| Landscape / location | "Travel post" / "Location spotlight" / "Mood aesthetic reel" |
| Pet | "Funny pet clip" / "Pet introduction post" / "Cute moment reel" |

User sees suggestion cards. They tap one, or tap "Let GHS choose" for full auto mode.

### AI Image Enhancement (optional step)
Before content creation, GHS can offer to:
- Enhance the image with AI (better lighting, sharper detail, background cleanup)
- Transform the image into an AI art version (painting style, cinematic grade, etc.)
- Generate a completely AI-created image inspired by the original
- Generate an AI avatar version of the user performing an action (e.g. dancing)

User must explicitly approve any AI transformation. Original image is never deleted.

**The dancing / performance feature:**
User taps "Create AI me dancing" → GHS takes their face/likeness from photo → generates an AI video of their likeness performing to a chosen track → sends for review before any posting. This is a powerful viral content feature. Strictly no nudity, strictly face-matched to the verified account owner only.

---

## MODULE 3 — CONTENT CREATION ENGINE

Once user picks a content idea, the pipeline runs:

**Step 1 — Script/Caption Generation**
AI writes: headline, caption body, hashtags, call to action. Tuned to the user's tone (professional, fun, inspirational, etc.) and their niche.

**Step 2 — Video Generation (if video content)**
- Uses existing GioHomeStudio Kling adapter
- Or uses image-to-video (Kling supports this — img2video endpoint)
- For AI dancing: uses a video generation model that supports pose/motion transfer

**Step 3 — Voice Generation (optional)**
- ElevenLabs generates a voiceover from the caption script
- User can pick their preferred voice style

**Step 4 — Music Selection**
- Music Provider Layer picks background music based on mood
- User can swap from suggested tracks

**Step 5 — Merge**
- FFmpeg combines everything into a finished reel or video post

**Step 6 — Delivery to phone**
- Finished content is sent to user via WhatsApp or Telegram (see Delivery module)

---

## MODULE 4 — DELIVERY VIA WHATSAPP / TELEGRAM (No public API needed)

This is the clever part of your idea. Instead of building a complex push notification system, GHS delivers content to the user through messaging apps they already use.

### Telegram delivery (simplest — already built in GioHomeStudio)
- GHS sends the finished video/photo + caption to the user's personal Telegram
- User watches in Telegram, reads the caption
- User replies with a command: "approve", "reject", "edit caption"
- GHS bot receives the reply and acts on it
- No separate app download needed
- Works on any phone

### WhatsApp delivery (slightly more complex but powerful)
**Option A — WhatsApp Business API (official)**
- Requires Meta Business verification
- Sends template messages with media
- More restricted but fully compliant

**Option B — WhatsApp Cloud API via Meta for Developers**
- Free tier available
- User connects their WhatsApp number during onboarding
- GHS sends video + caption as a WhatsApp message
- User replies to approve/reject

**Option C — WhatsApp Web bridge (background boost method you mentioned)**
- Uses whatsapp-web.js (Node.js library)
- Connects via QR code scan — no API approval needed
- GHS runs a persistent WhatsApp Web session on the server
- Sends content directly to user's chat
- Receives replies
- This is the easiest to implement with no API waitlist

**Recommendation:** Start with Telegram (zero friction, already built). Add WhatsApp Web bridge in Phase 2 as an option.

---

## MODULE 5 — REVIEW ON PHONE

When content arrives on Telegram or WhatsApp the user sees:

```
🎬 GHS Content Ready for Review

📸 Image used: [thumbnail]
💡 Content type: Fashion Reel
🎵 Music: Afrobeats Chill Mix
⏱ Duration: 15 seconds

📝 Caption:
"Monday fit check ✨ Starting the week right.
Drop a 🔥 if you love this look!
#LagosStyle #OOTD #FashionNaija"

---
Reply with:
✅ APPROVE — post to all connected accounts
❌ REJECT — discard this content
✏️ EDIT — send me the edited caption
🎵 MUSIC — change the background music
📱 PREVIEW — send me the video file
```

User replies in plain text. The bot reads the reply and acts.

### Edit flow on phone
User replies: `EDIT My caption is: New look just dropped, Lagos you ready? 🔥 #LagosStreet`
GHS updates the caption, regenerates if needed, confirms back to user.

---

## MODULE 6 — SOCIAL ACCOUNT CONNECTION (OAuth)

This is how GHS gets permission to post on behalf of the user.

### Supported platforms and connection method:

| Platform | Connection method | What GHS can do |
|---|---|---|
| Instagram | Meta OAuth 2.0 | Post photos, reels, stories |
| Facebook | Meta OAuth 2.0 | Post to page or profile |
| TikTok | TikTok Login Kit + Content Posting API | Post videos |
| YouTube | Google OAuth 2.0 | Upload videos, Shorts |
| Twitter/X | OAuth 2.0 | Post with media |
| Threads | Meta OAuth (via Instagram) | Post text + media |

### How OAuth connection works for the user
1. User opens GHS settings → "Connect Accounts"
2. Taps "Connect Instagram"
3. GHS opens Instagram's official login page in a browser
4. User logs in with their own Instagram password (GHS never sees it)
5. Instagram asks: "Allow GHS to post on your behalf?" → user taps Allow
6. Instagram sends GHS a secure token
7. GHS stores that token safely and uses it to post
8. User can disconnect any account at any time

No passwords stored. No scraping. Fully official and legal.

---

## MODULE 7 — SAFETY & CONTENT MODERATION (Non-negotiable)

### Nudity and inappropriate content — HARD BLOCK

GHS must never process, store, enhance, or distribute nude or sexually explicit images.

**Detection layers:**
1. On-device pre-scan using a lightweight NSFW detection model before any image leaves the phone
2. Server-side scan using a moderation API (AWS Rekognition, Google Vision, or OpenAI Moderation) on every image uploaded
3. AI-generated content scan — every generated video/image passes through moderation before delivery
4. If any layer flags content as nude, explicit, or CSAM: image is immediately deleted, pipeline is terminated, user is warned, incident is logged

**What triggers a block:**
- Nudity (full or partial)
- Sexual content or suggestion
- CSAM (child safety — immediate block + logging)
- Graphic violence
- Hate symbols

**User experience on block:**
"⚠️ GHS cannot process this image. It does not meet our content standards. Please select a different image."
No further detail given. No image stored.

### AI Dancing / Likeness feature — safety rules
- Only works with images verified to belong to the account owner
- User must confirm: "This is me in this photo"
- No third-party faces used without consent
- No sexualised poses or movements — strictly performance/dance content
- Output always goes to review before any posting

### Identity verification
To use the AI likeness feature or connect posting accounts, user must:
- Verify their phone number
- Confirm they are 18 or older
- Accept the full Terms of Use (see Legal module)

---

## MODULE 8 — EVENT & OCCASION INTELLIGENCE

GHS can detect and suggest content tied to events and occasions:

**Calendar awareness:**
- Nigerian public holidays (Independence Day, Christmas, Eid, etc.)
- User's personal events (birthday detected from profile)
- Global awareness days (World Environment Day, etc.)
- Trending moments (GHS monitors trends on each platform)

**Event-triggered suggestions:**
- "Independence Day is in 3 days — want GHS to create a patriotic post using your Lagos photos?"
- "It's Friday — want a weekend vibe post?"
- "You have photos from what looks like an event — want GHS to create an event recap reel?"

**Business event suggestions (for Marabiz and similar):**
- "Your shop has new inventory photos — want a product launch post?"
- "It's end of month — want GHS to create a business highlight reel?"
- "Your followers engage most on Wednesday evenings — want GHS to schedule something?"

---

## MODULE 9 — USER PROFILE & CONTENT MEMORY

GHS learns from each user over time:

**What it remembers:**
- Content style preferences (funny, professional, inspirational, lifestyle)
- Best performing post types for this account
- Preferred music genres
- Posting schedule that gets best engagement
- Topics and niches that perform well
- Caption style and tone

**What it suggests based on memory:**
- "Your fashion posts get 3x more engagement than food posts — want more fashion content this week?"
- "Reels with Afrobeats music perform best for you — auto-selecting this genre"
- "Your audience is most active at 7pm Lagos time — scheduling this post for then"

---

## MODULE 10 — LEGAL PROTECTION LAYER

### On registration (user must complete all before account is created):

**Screen 1 — Age verification**
"I confirm I am 18 years of age or older."
[Checkbox — required]

**Screen 2 — Identity confirmation**
"I confirm that all images I submit belong to me or I have explicit written permission from the subject to use them for commercial content creation and publication."
[Checkbox — required]

**Screen 3 — Content responsibility**
Full terms displayed. User must scroll to bottom before checkbox activates.
"I understand that I am the publisher of record for all content I approve and post using GHS. I accept full legal responsibility for all published content regardless of whether it was created by AI. I will personally review all content before approving it for publication."
[Checkbox — required]

**Screen 4 — Prohibited content declaration**
"I will not submit nude images, images of minors in inappropriate contexts, images of other people without their consent, or any content designed to harass, defame, or harm any person. I understand that GHS will permanently block my account if prohibited content is detected."
[Checkbox — required]

**Screen 5 — AI content disclosure**
"I understand that content created by GHS is AI-generated. I accept responsibility for disclosing AI involvement where required by the platform I am posting to (e.g. Instagram AI label requirements)."
[Checkbox — required]

Only after all five screens are completed does the account activate.

### Persistent legal notice (shown on every session):
Small footer on every screen:
*"GHS creates AI-assisted content. You are the publisher of record. Review all content before approving. Full Terms of Use apply."*

### On every approve action:
Before any content is posted, user must confirm:
"I have reviewed this content. It is accurate, appropriate, and I accept responsibility for its publication."
[Must tap confirm — cannot be skipped]

---

## TECHNICAL ARCHITECTURE

### Phase 1 (GioHomeStudio desktop — already built)
- Next.js + TypeScript server
- Prisma + PostgreSQL
- Local file storage
- Kling, ElevenLabs, FFmpeg, Telegram adapters
- Review/approve flow
- Content registry

### Phase 2 (GHS Auto Creator — mobile)
- React Native app (Expo)
- Connects to GioHomeStudio server via REST API
- Gallery access via expo-media-library
- Image upload to GHS server
- WhatsApp Web bridge (whatsapp-web.js)
- NSFW detection (on-device + server)
- OAuth connection for social accounts

### Phase 3 (Intelligence layer)
- Content memory and learning per user
- Event and occasion calendar awareness
- Engagement analytics from connected platforms
- Trend monitoring
- Optimal posting time prediction

### Phase 4 (Scale)
- Multi-user SaaS (other creators can use GHS)
- Subscription billing
- Creator marketplace
- African creator network

---

## WHAT MAKES THIS DIFFERENT FROM COMPETITORS

| Feature | GHS Auto Creator | Canva | Later | Buffer |
|---|---|---|---|---|
| Works from your own photos | ✅ | ❌ | ❌ | ❌ |
| AI video generation | ✅ | Partial | ❌ | ❌ |
| AI voice narration | ✅ | ❌ | ❌ | ❌ |
| Deliver via WhatsApp/Telegram | ✅ | ❌ | ❌ | ❌ |
| Review on phone before posting | ✅ | ❌ | ❌ | ❌ |
| AI dancing / likeness | ✅ | ❌ | ❌ | ❌ |
| Event-aware suggestions | ✅ | ❌ | Partial | Partial |
| Built for African creators | ✅ | ❌ | ❌ | ❌ |
| Nudity detection hard block | ✅ | N/A | N/A | N/A |

---

## NEXT BUILD STEPS (In order)

1. Complete GioHomeStudio Phase 1 (desktop pipeline — in progress)
2. Build the REST API layer so a mobile app can talk to GHS server
3. Build React Native app skeleton with gallery permission flow
4. Build image intelligence module (content type detection)
5. Build content suggestion engine
6. Connect WhatsApp Web bridge
7. Build OAuth social account connection
8. Add NSFW detection layer
9. Build legal registration flow with all five screens
10. Build event/occasion awareness module
11. Add content memory and learning

---

*GHS Auto Content Creator — Plan v1.0*
*Built on GioHomeStudio Phase 1 foundation*
