# Story Bank — Full Blueprint
# Planned by: AUT Claude + Henry
# Build by: GHS Claude
# Date: 2026-04-17

---

## What Henry Wants

A full AI-powered story writing workspace where:
- User writes raw story idea
- AI expands it into full story
- User edits verse by verse, chapter by chapter
- AI breaks story into scenes with time durations (5s, 10s, 15s, 30s per scene)
- User can stop halfway, come back, update any chapter
- AI brainstorm assistant available anytime at very low cost
- Scenes feed directly into Hybrid Planner for video production

URL: http://localhost:3200/dashboard/story-bank

---

## What Already Exists

Basic idea storage — title, body, tags, rating, status.
This is the FOUNDATION. Do not delete it. BUILD ON TOP of it.

---

## New Features to Add

### 1. Story Workspace (per story)
When user clicks a story → opens full workspace with tabs:

**Tab 1 — Write**
- Large textarea: user writes raw story (no rules, just write)
- "AI Expand" button → AI takes raw text, returns full expanded story
- User can edit the expanded version directly
- Word count, estimated video duration shown

**Tab 2 — Chapters**
- AI or user splits story into chapters
- Each chapter: title + body text
- Edit any chapter independently
- Add/remove chapters
- Chapter status: draft / ready / locked
- "Save Chapter" button per chapter
- User can stop here and return later — state saved to DB

**Tab 3 — Scenes**
- Per chapter: AI breaks chapter into scenes
- Each scene card shows:
  - Scene number (SC01, SC02...)
  - Scene description
  - Duration input (seconds) — dropdown: 5s / 10s / 15s / 30s / custom
  - Visual style note (optional)
  - Status: planned / ready / sent-to-planner
- "Generate Scenes" button → AI writes scenes from chapter text
- User can edit any scene manually
- Total duration counter (sum of all scene durations)

**Tab 4 — AI Brainstorm**
- Simple chat interface
- User types question or idea
- AI responds
- LOW COST: use Ollama (phi3/mistral) first → fallback to Claude Haiku only
- No GPT-4o here — keep cost near zero
- Chat history saved per story
- Examples of what user can ask:
  - "Make scene 3 more emotional"
  - "Give me 3 alternative endings"
  - "What would happen if Bear meets a wolf instead?"
  - "Make this chapter shorter"

**Tab 5 — Export / Send**
- Send story to Hybrid Planner (creates new project with scenes pre-filled)
- Export as plain text
- Export scene list as JSON
- Copy full story to clipboard

---

## Database Changes Needed

Add to prisma/schema.prisma:

```prisma
model StoryChapter {
  id            String   @id @default(cuid())
  storyId       String
  chapterNumber Int
  title         String   @default("Chapter")
  rawText       String   @default("")
  expandedText  String   @default("")
  status        String   @default("draft")  // draft, ready, locked
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  scenes        StoryScene[]

  @@map("story_chapters")
}

model StoryScene {
  id              String   @id @default(cuid())
  chapterId       String
  sceneOrder      Int
  sceneId         String   // SC01, SC02...
  description     String
  durationSeconds Int      @default(10)
  videoPrompt     String   @default("")
  visualStyle     String   @default("")
  status          String   @default("planned")  // planned, ready, sent-to-planner
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@map("story_scenes")
}
```

Also add to existing StoryIdea model:
```
expandedText  String?   // AI-expanded full story
chapters      StoryChapter[]
brainstormLog Json?     // array of {role, text, timestamp}
```

---

## API Routes Needed

```
POST /api/story-bank/[id]/expand
  → body: { rawText }
  → AI expands story, returns expandedText
  → Model: Claude Haiku (cheap) or Ollama mistral

POST /api/story-bank/[id]/chapters
  → body: { title, rawText, chapterNumber }
  → Creates new chapter

PUT /api/story-bank/[id]/chapters/[chapterId]
  → body: { title?, rawText?, expandedText?, status? }
  → Updates chapter

POST /api/story-bank/[id]/chapters/[chapterId]/scenes
  → body: { chapterText, defaultDuration }
  → AI breaks chapter into scenes with durations
  → Returns array of scene objects
  → Model: Ollama phi3 (free) first → Claude Haiku fallback

POST /api/story-bank/[id]/brainstorm
  → body: { message, history[] }
  → AI chat response
  → Model: Ollama phi3/mistral ONLY (zero cost)
  → Fallback to Claude Haiku if Ollama down

POST /api/story-bank/[id]/send-to-planner
  → Creates new HybridPlanner project
  → Pre-fills: title, story text, scenes with durations
  → Returns redirect URL to hybrid planner
```

---

## UI Style Rules

- Match GioHomeStudio dark theme (same as Hybrid Planner)
- Tabs at top of workspace
- Scene cards in a list (not grid) — easier to read and edit
- Duration dropdown per scene: 5s / 10s / 15s / 30s / Custom
- Chapter list on left sidebar, editor on right (desktop)
- On mobile: chapters collapse, editor full width
- AI responses appear inline — no separate modal
- Autosave every 30 seconds to DB
- Show "Last saved X seconds ago" indicator

---

## Cost Control Rules (IMPORTANT)

| Action | Model to use | Cost |
|---|---|---|
| Story expansion | Claude Haiku | Very low |
| Scene generation | Ollama phi3 first | Free |
| Brainstorm chat | Ollama phi3/mistral | Free |
| Brainstorm fallback | Claude Haiku only | Very low |
| Never use | GPT-4o / Claude Opus | Too expensive for this |

---

## Build Order for GHS Claude

1. Add DB models (StoryChapter, StoryScene) → migrate
2. Build /api/story-bank/[id]/expand route
3. Build /api/story-bank/[id]/chapters routes (CRUD)
4. Build /api/story-bank/[id]/chapters/[id]/scenes route
5. Build /api/story-bank/[id]/brainstorm route (Ollama first)
6. Build /api/story-bank/[id]/send-to-planner route
7. Upgrade story-bank/page.tsx — add workspace tabs on top of existing list
8. Test full flow: write → expand → chapters → scenes → send to planner

---

## Connection to Hybrid Planner

When user clicks "Send to Hybrid Planner":
- Creates new project in hybrid planner
- Pre-fills: title, story idea, expanded story
- Pre-creates scenes with SC01, SC02... and duration from scene cards
- User lands on Hybrid Planner Story tab, ready to generate images

This is the BRIDGE between writing and production.

---

## Notes from Henry

- "I have not written anything about this section" — this is a fresh build
- "I want to trust it with both of you" — AUT Claude planned, GHS Claude builds
- "Very low cost" — Ollama first for all brainstorm, Claude Haiku only for expansion
- "User can stop halfway and update any chapter" — DB save is mandatory, not optional
- "Verse by verse, chapter by chapter" — granular editing, not one big text block
