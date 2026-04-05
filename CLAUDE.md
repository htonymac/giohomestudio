# GioHomeStudio Master Canvas

## 1. Product Identity

**Product name:** GioHomeStudio  
**Owner:** Henry  
**Platform type:** SaaS content automation platform  
**Core idea:** GioHomeStudio is an AI-powered video content studio and publishing control system that helps a creator or business plan, generate, review, approve, track, and publish videos across multiple pages and platforms from one interface.

GioHomeStudio is not just a video generator. It is a **content operating system**.

It combines:
- AI prompt enhancement
- Video generation workflows
- Review and approval flow
- Publishing controls
- Analytics and repost control
- Multi-page management
- Cost and usage awareness
- Future team and plugin expansion

---

## 2. Core Positioning

Most AI video tools generate one video and stop there.

GioHomeStudio is different because it manages the **full lifecycle of content**:
- idea
- prompt enhancement
- generation
- review
- approval or rejection
- posting
- tracking
- repost decision
- learning for future content

### One-line positioning
**GioHomeStudio is a multi-mode AI content studio that turns ideas into videos, routes them to the right channels, tracks performance, controls reposting, and improves future output using AI advice and analytics.**

---

## 3. Main User Types

### Creator
For reels, shorts, viral clips, storytelling, episodes, fun content, motivational content.

### Business owner
For promo videos, product showcases, announcements, ads, brand content.

### Multi-page operator
For someone managing different YouTube channels, Instagram pages, TikTok accounts, Facebook pages, or niche pages from one dashboard.

### Future agency/team user
For agencies, content teams, assistants, editors, or social media managers handling multiple brands or multiple projects.

---

## 4. Product Goal

The goal of GioHomeStudio is to let a user do all of this from one system:
- create long or short AI videos
- generate content from guided or free input
- manage multiple content types
- assign videos to the right destination pages
- approve or reject results before posting
- prevent messy reposting
- track what worked and what failed
- build a repeatable content machine

---

## 5. Main Content Modes

## 5.1 Series Mode
Used for full episodes or serialized storytelling.

Purpose:
- manage episodes with recurring characters
- preserve world consistency
- keep tone and story flow stable
- support long-form storytelling and episodic production

Features:
- story and episode input
- character profiles
- series settings
- visual style settings
- voice profile links
- story universe / series bible support
- episode tracking

Best for:
- animated series
- narrative stories
- recurring episodic content

## 5.2 Reel Builder Mode
Used for short-form, emotional, targeted content.

Purpose:
- create short clips with strong emotional direction
- rapidly generate reels, shorts, clips, and social-first content

Features:
- emotion selection
- action selection
- tone and pacing controls
- short duration presets
- platform optimization

Best for:
- Instagram Reels
- TikTok videos
- YouTube Shorts
- teaser content
- reaction-driven clips

## 5.3 Free Mode
Used when the user wants to describe anything in plain English and let the system handle the rest.

Purpose:
- allow completely open generation
- remove friction from content creation
- convert casual user input into strong professional prompts

How it works:
1. user types anything
2. GioHomeStudio enhances the prompt using Claude Code or local LLM
3. system adds cinematic language and platform optimization
4. system routes it to the correct generation engine
5. result is created and sent to review flow

Example:
User writes:  
"A cat flying and jumping off a cliff"

System-enhanced prompt becomes something closer to:  
"Cinematic slow motion shot of a white cat with wings soaring through golden sunset sky, approaching dramatic cliff edge, graceful jump, feathers catching light, epic orchestral music building to climax, vertical format, Instagram Reels optimized, photorealistic style."

This is one of the most powerful features because it turns GioHomeStudio from a single-use tool into a broad creative platform.

## 5.4 Template Mode (future)
Used for reusable prebuilt formats.

Examples:
- promo ad template
- quote reel template
- product launch template
- news commentary template
- story recap template

---

## 6. Destination Page System

A major feature of GioHomeStudio is that content is not tied to one social account.

The user can register multiple pages and destinations, such as:
- main YouTube channel
- second YouTube channel
- personal Instagram
- business Instagram
- personal TikTok
- niche TikTok account
- Facebook business page
- Facebook personal page

When generating content, the user should be able to choose:
- one destination page
- multiple destination pages
- a saved posting group

This turns GioHomeStudio into a real publishing control system.

### Example page registry
- Page 1: GioHomeStudio YouTube
- Page 2: Cat & Fun Content YouTube
- Page 3: Marabiz Instagram
- Page 4: Personal TikTok
- Page 5: GioGo Facebook

---

## 7. Core Workflow Loop

The most important loop in the MVP should be:

**Generate -> Review -> Approve -> Post -> Track -> Learn**

### Step 1: Generate
User selects mode, enters input, selects duration, format, platform, and destination.

### Step 2: Review
System presents generated output, metadata, prompt used, estimated cost, and posting destination.

### Step 3: Approve or reject
User can:
- approve
- reject
- request regeneration
- save draft
- edit prompt and retry

### Step 4: Post
System posts manually or through supported integrations/workflows.

### Step 5: Track
System logs:
- date created
- date approved
- date posted
- platform
- page
- title/caption used
- prompt used
- file version
- performance metrics

### Step 6: Learn
AI adviser and analytics suggest improvements for future content.

---

## 8. Approval and Disapproval Flow

This is a key control layer.

### Purpose
Prevent bad content from being auto-posted and give the owner final control.

### Functions
- notify owner when content is ready
- show preview before posting
- allow approval or rejection
- store rejected versions
- allow regeneration without losing history

### Alert channels
- Telegram
- WhatsApp
- Gmail

### Actions available
- approve now
- reject now
- send back for improvement
- save as draft
- mark for later review

---

## 9. Content Asset Registry

This should become a major system table and repository.

Every content asset should store:
- content ID
- project / series name
- mode used
- destination page
- platform
- status
- original prompt
- enhanced prompt
- title
- caption
- hashtags
- thumbnail
- music used
- voice used
- character used
- duration
- format
- creation date
- approval date
- posting date
- version history
- performance metrics
- repost eligibility

This allows the system to remember why content worked and how it was made.

---

## 10. Emotion and Scene Vocabulary System

This is especially important for Reel Builder Mode and for better storytelling control.

## 10.1 Emotional states
Examples:
- heartbreak
- grief
- longing
- despair
- hope
- joy
- shame
- guilt
- jealousy
- pride
- nostalgia
- loneliness
- forgiveness
- betrayal
- redemption

Each emotion should influence:
- camera style
- pacing
- color tone
- soundtrack style
- facial emphasis
- motion behavior

## 10.2 Action states
Examples:
- chase
- confrontation
- battle
- escape
- ambush
- duel
- pursuit
- sacrifice

Each action state should influence:
- motion intensity
- shot sequence
- transitions
- sound design
- urgency level

This vocabulary engine gives GioHomeStudio more control than plain prompt writing.

---

## 11. AI Adviser System

This should act like a built-in strategic assistant before posting.

### Purpose
Review content before publication and suggest improvements.

### What it can advise on
- better hook
- stronger title
- better caption
- better thumbnail direction
- better posting time
- wrong destination page
- too soon to repost
- emotional mismatch for intended audience
- budget concerns
- platform-specific corrections

### Example output
- “This title is weak for Shorts. Make it more curiosity-driven.”
- “This should go to your fun page, not your business page.”
- “Do not repost this yet. The cooldown period is still active.”
- “This reel is strong visually but needs a more emotional caption.”

---

## 12. Repost Control System

This is important because many creators lose track of what they posted and when.

### Purpose
Prevent bad repost habits and improve reuse strategy.

### Functions
- log where each asset was posted
- prevent duplicate posting too soon
- show repost cooldown
- recommend best time to repost
- suggest alternate caption or thumbnail for repost
- support A/B retesting later

### Repost states
- never posted
- posted recently
- repost eligible
- archived
- expired / low value

---

## 13. Analytics Dashboard

The dashboard should not only show vanity numbers.
It should help with decisions.

### Core analytics
- best performing videos
- best platform for each type of content
- best posting times
- best page for each theme
- approval-to-post conversion rate
- regeneration frequency
- video performance by mode
- cost per output
- repost performance

### Visual outputs
- charts
- graphs
- content ranking tables
- trend summaries

---

## 14. A/B Testing System

Future but highly valuable.

### Purpose
Test variations of the same content.

### Examples
- same video, different title
- same video, different thumbnail
- same video, different caption
- same story clip, different hook

### System behavior
- track each version
- compare engagement
- record winning pattern
- suggest future improvements automatically

---

## 15. Content Calendar

A calendar layer helps planning and visibility.

### Functions
- visual posting schedule
- drag and drop rescheduling
- see gaps in content schedule
- plan episodes or campaigns in advance
- coordinate across multiple pages and platforms

---

## 16. Script Library and Story Bank

The user should be able to store ideas and not lose them.

### Functions
- save raw story ideas
- rate ideas
- tag by series, theme, or platform
- pick ideas later for production
- connect saved ideas to generation workflows

---

## 17. Voice and Character Profile Management

Important for series and recurring content.

### Voice profile functions
- assign specific ElevenLabs voice to a character
- store voice settings
- keep voice consistency between episodes
- create character-level voice memory

### Character profile functions
- character name
- age / type
- voice link
- behavior traits
- clothing / appearance style
- emotional defaults
- role in story universe

---

## 18. Multi-Series Support

The product should eventually support multiple story worlds and multiple content lines.

Each series should have:
- own settings
- own characters
- own voice mappings
- own style rules
- own episode history
- own performance history

This allows one owner to manage different creative brands or story universes inside one system.

---

## 19. Budget Tracker

Very important for a real SaaS and for the owner’s own usage.

### Track costs such as
- Kling usage
- ElevenLabs usage
- Suno usage
- storage cost
- automation cost
- browser automation cost
- user-level usage cost

### Functions
- cost per video
- monthly spend
- alerts near credit limits
- estimated margin per paid user
- usage forecasting

---

## 20. Backup and Version Control

### Needed behavior
- every generated version saved
- rejected version never lost
- rollback available
- prompts and settings saved permanently
- approvals and edits logged

This reduces risk and supports professional work.

---

## 21. Watermark and Intro / Outro System

For creators and businesses with branding needs.

### Functions
- auto logo watermark
- auto intro animation
- auto outro
- subscribe CTA
- product CTA
- brand-level template selection

---

## 22. Trend and Competitor Monitor (future)

### Purpose
Watch what is rising and suggest opportunities.

### Possible functions
- trending topics by niche
- rising keyword ideas
- format suggestions
- competitor pattern observation
- quick-response content recommendations

---

## 23. Multi-Language Support (future)

### Functions
- generate translated scripts
- dub videos into other languages
- map language to regional page/account
- create multiple language versions from one master asset

---

## 24. Collaboration and Permissions (future)

For assistants, editors, managers, or partners.

### Functions
- separate logins
- role permissions
- approval rights
- edit restrictions
- full audit log

---

## 25. Episode Series Bible

This is important for story consistency.

The system should support a story universe document that stores:
- lore
- characters
- timeline
- locations
- rules of the world
- major events

Claude Code and future local assistants should read this so generated episodes stay consistent.

---

## 26. Monetization Tracker (future)

Could eventually track:
- YouTube revenue
- sponsorship income
- subscription income
- paid content income
- per-series earnings
- per-platform earnings

---

## 27. Multi-User SaaS Model

GioHomeStudio is not only a personal creator tool. It can become a SaaS.

### Possible tier structure
#### Free tier
- text-only planning
- no heavy generation on your paid APIs
- limited features

#### Paid tier
- credits system
- usage-based generation
- multi-page support
- analytics
- approval flow

#### Pro / Studio tier
- series mode
- advanced analytics
- team support
- budget controls
- asset library

#### Agency tier
- multiple brands
- multiple users
- advanced controls
- white-label possibilities later

---

## 28. Monitoring and Reliability System

This came through clearly in your concept and matters a lot.

### Functions
- Claude Code presence / absence detection
- offline fallback behavior
- catch-up reporting
- task recovery visibility
- usage and error monitoring

This matters because the platform should not collapse just because one model, one tool, or one process is temporarily unavailable.

---

## 29. System Design Principle

The system should be built with **plugin architecture**.

Meaning:
- every feature is modular
- new tools can be swapped in later
- existing features can be removed without destroying the whole app
- generation engines can change over time
- models and APIs are replaceable

Example:
If Kling is replaced later, the generation layer should be swappable from configuration rather than requiring a full rebuild.

---

## 30. Suggested Technical Direction

### Front end
- web dashboard
- local host first for internal build and testing
- later hosted SaaS dashboard

### Back end
- modular service architecture
- content asset registry database
- queue-based workflow for generation jobs
- status tracking and notifications

### Core tool integrations
- Claude Code for orchestration and coding support
- local LLM via Ollama / Mistral for enhancement and fallback
- Kling AI for video generation
- ElevenLabs for voice
- Music Provider Layer for soundtrack generation
- FFmpeg for media assembly and post-processing
- Playwright for browser automation and publishing support

### Music Provider Layer
This replaces hard dependence on any single music platform.

The rest of GioHomeStudio should not care which music source is underneath.
The system should call a generic music provider module such as:
- `music_provider = kie_ai`
- `music_provider = mubert`
- `music_provider = stable_audio`
- `music_provider = stock_library`
- `music_provider = manual_upload`

This keeps the main idea intact:
- music remains automated
- the workflow remains fast
- the product still saves time
- Suno-style generation can still be supported through a compatible provider if needed
- the system can switch providers later without breaking the core app

### Recommended internal logic
- if lyrical or song-style output is needed -> use Kie.ai or similar compatible provider
- if cinematic or instrumental background score is needed -> use Mubert / Stable Audio or equivalent
- if provider fails -> use fallback provider automatically
- if all providers fail -> allow manual or stock music fallback without breaking the workflow

### Storage
- generated media
- prompts
- metadata
- versions
- thumbnails
- captions
- logs

## 31. MVP Scope

The MVP should be narrow enough to build, but strong enough to prove value.

### Must keep in MVP
- Free Mode
- Reel Builder Mode
- basic Series Mode support
- destination page selector
- prompt enhancement layer
- Generate -> Review -> Approve -> Post -> Track loop
- content registry
- approval and rejection flow
- repost control basics
- basic analytics
- budget visibility basics

### Delay until later
- full trend monitor
- collaboration roles
- monetization tracker
- advanced A/B engine
- multi-language support
- complex agency tools

---

## 32. Priority Build Order

### Day one / phase one
- core pipeline
- content registry
- approval flow
- alerts
- posting log
- basic destination page system

### Month one / phase two
- thumbnail and caption engine
- analytics dashboard
- content calendar
- stronger Free Mode enhancement

### Month two / phase three
- A/B testing
- multi-series management
- budget tracker expansion
- backup and rollback tools

### Later phases
- multi-language
- collaboration
- monetization tracker
- trend monitor
- advanced SaaS admin controls

---

## 33. What Makes GioHomeStudio Strong

Its strength is not only generation.
Its strength is the combination of:
- creation
- control
- organization
- consistency
- publishing awareness
- platform awareness
- performance memory

This is what makes it potentially more valuable than a simple AI video app.

---

## 34. Brutal Truth

If you try to build everything at once, it will become bloated and stall.

So the rule should be simple:

**Build one loop beautifully before expanding.**

That loop is:
**Generate -> Review -> Approve -> Post -> Track**

If that loop works well, GioHomeStudio already has serious value.
If that loop is weak, all the extra features will become decoration.

---

## 35. Final Definition

**GioHomeStudio is an AI-powered video content studio and publishing control platform that helps users create, review, manage, schedule, post, track, and improve video content across multiple pages, channels, and content types from one system.**

---

## 36. Skills Rules

- After every coding task run /simplify automatically
- Run /security-check before every deployment
- Use /frontend-design before building any new screen
- Use /web-researcher when encountering unknown libraries
- Use /self-healing when any pipeline stage fails
- Use /prompt-engineer before sending prompts to ElevenLabs or Kling

