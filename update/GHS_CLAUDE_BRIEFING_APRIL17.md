# GHS CLAUDE — Full Build Briefing
# Written by: AUT Claude
# Date: 2026-04-17
# Source: GHS_MASTER_TASK_APRIL17.md + codebase audit
# READ THIS ENTIRE FILE BEFORE WRITING ONE LINE OF CODE

---

## WHAT AUT CLAUDE FOUND — CURRENT STATE

### Already Built (do NOT rebuild)
- Story, Chapter, StoryScene models in DB ✅
- Story Bank page.tsx with full tabs ✅
- Story Bank API routes: brainstorm, chapters, scenes, stories ✅
- Kie.ai music adapter at `src/modules/music-provider/providers/kie-ai.adapter.ts` ✅
- KIE_AI_API_KEY already in .env ✅
- Music Provider interface at `src/modules/music-provider/` ✅
- Ideogram V3 Turbo + Quality in ALL 5 planner model lists ✅
- Sidebar at `app/components/Sidebar.tsx` (278 lines) ✅
- Series Wizard at `app/dashboard/series-wizard/page.tsx` ✅

### NOT yet built (your work)
- AITierSelector component (GHS Free / GHS Standard / GHS Pro) ❌
- Gemini Flash TTS via fal.ai ❌
- Ideogram V3 Transparent + Layerize in fal gateway ❌
- Transparent checkbox in generation modals ❌
- Transparent PNGs filter in Asset Library ❌
- Layerize Text editor panel ❌
- Sidebar collapsed to 3 groups ❌
- Story button color fix ❌
- AI Background Studio section ❌

---

## TASK 1 — Hybrid Workflow Formula Applied to ALL Planners

**Henry's rule:** Apply the SEQUENCE, not the code. Each planner's tabs must follow the same logical flow Hybrid uses.

### Current tab sequences found in codebase:

**Movie Planner** (`app/dashboard/movie-planner/page.tsx`)
```
type WorkshopTab = "design" | "story" | "characters" | "scenes" | "screenplay" | "audio" | "assembly" | "overview"
```
Status: Has story → characters → scenes → audio → assembly. ✅ Sequence mostly correct.
**Missing:** Review step before assembly. Add "review" tab between audio and assembly.

**Children Planner** (`app/dashboard/children-planner/page.tsx`)
```
type WorkshopTab = "overview" | "design" | "characters" | "content" | "style" | "screenplay" | "review1" | "preview" | "review2"
```
Status: Has design → characters → content.
**Missing:** "audio" tab with narration timing + highlight sync. Add it between screenplay and review1.
**Required sequence:** Design → Characters → Content → Style → Screenplay → Audio/Narration → Review → Preview

**Music Video Planner** (`app/dashboard/music-video-planner/page.tsx`)
```
type MvTab = "overview" | "song" | "analysis" | "storyboard" | "screenplay" | "captions" | "audio" | "assembly"
```
Status: Song → Analysis → Storyboard → Audio → Assembly. ✅ Good sequence.
**Missing:** No explicit "generation" step between storyboard and audio. Add visual generation status tracker.

**Commercial Planner** (`app/dashboard/commercial-planner/page.tsx`)
```
type WorkshopTab = "overview" | "design" | "brief" | "cast" | "scenes" | "screenplay" | "audio" | "assembly"
```
Status: Already 85% complete per Henry.
**Missing:** Add "publish" step after assembly for Commercial.

**Rule:** Do NOT change existing working pipelines. Add missing steps only where gap exists.

---

## TASK 2 — GHS AI Tier Selector (ALL planners + Story Bank)

### What to build:
One shared React component: `app/components/AITierSelector.tsx`

```tsx
// Display only — never show real AI names
// GHS Free → Ollama phi3/mistral (local)
// GHS Standard → Claude Haiku / GPT-4o-mini
// GHS Pro → Claude Sonnet / Claude Opus
```

### UI spec:
```
[GHS Free]  [GHS Standard ✓]  [GHS Pro]
                               [More Info]
```
- Default: GHS Standard (selected)
- Stores in localStorage key: `ghs_ai_tier` 
- "More Info" opens small popup: "Free uses local AI (no cost). Standard uses lightweight cloud AI. Pro uses our most powerful reasoning engine."
- Never show: Claude, GPT, Haiku, Sonnet, Opus, Ollama

### API route reading:
In any API route that gets `tier` param:
```typescript
// tier: "free" | "standard" | "pro"
// free → try Ollama → fallback to Haiku
// standard → Claude Haiku
// pro → Claude Sonnet
```

### Where to add the selector:
1. Hybrid Planner story expansion
2. Movie Planner story analysis  
3. Children Planner content generation
4. Music Video concept generation
5. Story Bank brainstorm + expansion
6. Series Planner episode generation
7. Any screen with an "AI Expand" / "AI Generate" button

### Routing logic (in `src/lib/llm.ts` or new `src/lib/tier-router.ts`):
```typescript
export function getModelForTier(tier: "free" | "standard" | "pro") {
  if (tier === "free")     return { provider: "ollama", model: "phi3" };
  if (tier === "standard") return { provider: "anthropic", model: "claude-haiku-4-5-20251001" };
  if (tier === "pro")      return { provider: "anthropic", model: "claude-sonnet-4-6" };
  return { provider: "anthropic", model: "claude-haiku-4-5-20251001" }; // default
}
```

---

## TASK 3 — Series Planner: Fix Errors + Simplify Nav

### 3A — Fix errors:
- Open `app/dashboard/series-wizard/page.tsx`
- Check for TypeScript errors, undefined access, missing API routes
- Log every fix to `update/PROBLEM_AND_FIX.md`

### 3B — Simplify Sidebar nav (`app/components/Sidebar.tsx`)

**Current:** Too many items visible at once — Create, 6 planners, tools all visible.

**New structure:**
```
+ Create                          ← always visible
≡ Planner Tools  ▾               ← click/hover expands to show planners
    Hybrid Planner
    Movie Planner
    Children Planner
    Commercial Planner
    Music Video Planner
    Story Bank
··· More  ▾                       ← click/hover shows tools
    Series Planner
    Collab Editor
    Asset Library
    Analytics
    Settings
```

**Implementation:**
- Add state: `plannerExpanded: boolean`, `moreExpanded: boolean`
- Clicking "Planner Tools" toggles plannerExpanded
- Clicking "More" toggles moreExpanded
- On hover (desktop): also expands
- Collapsed state shows only: Create / Planner Tools / More

---

## TASK 4 — Gemini Flash TTS via fal.ai ("GHS Voice Pro")

### What to add:
New TTS option alongside existing Piper TTS.

**Endpoint:** `fal-ai/gemini-flash-tts`
**Uses:** Existing FAL_KEY in .env — no new account.

### Where to add in `src/lib/generation/gateways/fal.ts`:
```typescript
export async function generateSpeechGemini(
  text: string,
  options: { voice?: string; language?: string; speakers?: Array<{name: string; text: string}> } = {}
): Promise<{ audioUrl: string }> {
  // Single speaker mode
  if (!options.speakers) {
    const result = await fal.subscribe("fal-ai/gemini-flash-tts", {
      input: { text, voice: options.voice || "Charon", language: options.language || "en" }
    });
    return { audioUrl: result.data.audio.url };
  }
  // Multi-speaker mode (Bear + Dog in one call)
  const result = await fal.subscribe("fal-ai/gemini-flash-tts", {
    input: { 
      text: options.speakers.map(s => `[${s.name}]: ${s.text}`).join("\n"),
      multi_speaker: true
    }
  });
  return { audioUrl: result.data.audio.url };
}
```

### GHS Branding:
- Piper TTS = **"GHS Voice Free"** (local, no cost)
- Gemini Flash TTS = **"GHS Voice Pro"** (cloud, small cost)
- NEVER show "Gemini" in UI

### Where to add the voice selector:
1. Hybrid Planner Audio tab — narration voice selector
2. Children Planner narration
3. Story Bank narration export
4. Character Voices section — for multi-speaker dialogue (Bear speaks, Dog responds, ONE API call)
5. Series Planner episode audio

### API route to create: `app/api/tts/gemini/route.ts`
- POST: `{ text, voice?, language?, speakers? }`
- Returns: `{ audioUrl }`

---

## TASK 5 — Kie.ai Music Provider (VERIFY + WIRE TO UI)

### Already done:
- Adapter: `src/modules/music-provider/providers/kie-ai.adapter.ts` ✅
- KIE_AI_API_KEY in .env ✅

### What needs verifying:
1. Is KieAiMusicProvider registered in the music provider router?
2. Is there a `/api/music/generate` route that calls the provider?
3. Is there UI in planners to trigger music generation?

### What to check and wire up:
```
app/api/music/         ← check what routes exist here
src/modules/music-provider/   ← check if router exists, registers kie-ai
app/dashboard/hybrid-planner  ← check if music generation calls this
app/dashboard/music-video-planner ← this is primary music source
```

### GHS Branding:
- Show as **"GHS Music"** — never "Kie.ai" or "Suno"
- Fallback: if Kie.ai fails → use stock library

---

## TASK 6 — Ideogram V3 Transparent + Layerize Text

### EXPANDED SCOPE (Henry's instruction: "check other sections where this can be useful")

AUT Claude audit found ALL 5 planners already have Ideogram V3 in their model lists:
- Hybrid Planner ✅ (line 3357 in page.tsx)
- Commercial Planner ✅ (line 140)
- Movie Planner ✅ (line 140)
- Children Planner ✅ (line 44)
- Music Video Planner ✅ (line 42)

**This means: transparent checkbox must appear in ALL 5 planners' generation modals, not just Commercial.**

---

### SESSION 1 — Transparent Background

#### Step 1: Add to fal gateway (`src/lib/generation/gateways/fal.ts`)
```typescript
export async function generateTransparent(prompt: string, options: {
  image_size?: string;
  rendering_speed?: "BALANCED" | "QUALITY" | "SPEED";
  magic_prompt?: "AUTO" | "ON" | "OFF";
} = {}): Promise<{ imageUrl: string; fileName: string }> {
  const result = await fal.subscribe("fal-ai/ideogram/v3/generate-transparent", {
    input: {
      prompt,
      image_size: options.image_size || "square_hd",
      rendering_speed: options.rendering_speed || "BALANCED",
      magic_prompt_option: options.magic_prompt || "AUTO",
    }
  });
  return { 
    imageUrl: result.data.images[0].url,
    fileName: result.data.images[0].file_name 
  };
}
```

#### Step 2: Add to MODEL_REGISTRY (`src/lib/generation/model-registry.ts`)
Add after existing Ideogram V3 entries:
```typescript
{
  id: 'fal_ideogram_v3_transparent',
  display_name: 'Ideogram V3 Transparent',
  provider_name: 'fal.ai',
  gateway: 'fal',
  fal_endpoint: 'fal-ai/ideogram/v3/generate-transparent',
  type: 'image',
  cost_to_henry: 0.030,
  price_to_user: 0.09,
  output_format: 'PNG with transparency',
  tags: ['transparent-background', 'cutout', 'logos', 'products', 'overlays'],
  is_active: true,
}
```

#### Step 3: Add transparent checkbox to ALL 5 planners

In each planner's generation modal/section, when user selects any Ideogram V3 model:
```tsx
{selectedModel.includes("ideogram_v3") && (
  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
    <input type="checkbox" checked={transparentBg} onChange={e => setTransparentBg(e.target.checked)} />
    <span style={{ fontSize: 12, color: "#aaa" }}>
      Transparent Background (PNG) — no background, perfect for overlays
    </span>
  </label>
)}
```

When checked → use `fal_ideogram_v3_transparent` endpoint instead.

#### Step 4: Tag transparent assets in DB
When saving generated image, include `transparent: true` in tags if transparent mode used.
```typescript
// In image generation save logic:
const tags = transparentBg ? ["transparent-background", "png-cutout"] : [];
```

#### Step 5: Asset Library filter (`app/dashboard/assets/page.tsx`)
Add "Transparent PNGs" to the type filter options:
```tsx
const typeFilters = ["", "image", "video", "audio", "transparent"];
// Label: "" → "All", "transparent" → "Transparent PNGs"
```
In the API: filter by tag `transparent-background` when type=transparent.

#### Step 6: Video Tools overlay badge (`app/dashboard/video-tools/page.tsx`)
When user adds image overlay and the image has `transparent: true` tag:
```tsx
{asset.tags?.includes("transparent-background") && (
  <span style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, background: "#22c55e20", color: "#22c55e", border: "1px solid #22c55e40" }}>
    Transparent PNG
  </span>
)}
```

#### WHERE TRANSPARENT IS MOST USEFUL (per planner):
| Planner | Use case |
|---|---|
| Hybrid Planner | Character cutouts placed over scene backgrounds |
| Commercial Planner | Product shots, logo over video frame |
| Movie Planner | Character cutouts, title card graphics |
| Children Planner | Character stickers, illustrated overlays |
| Music Video Planner | Artist cutout over music video frames |
| Asset Library | Filter + reuse across all projects |
| Video Tools | Overlay picker with transparent badge |

---

### SESSION 2 — Layerize Text

#### Step 1: DB table — add to `prisma/schema.prisma`
```prisma
model LayerizedDesign {
  id                String   @id @default(cuid())
  userId            String
  sourceImageUrl    String
  backgroundUrl     String
  textContainers    Json
  overlayHtml       String?
  imageLayers       Json?
  currentTextEdits  Json?
  falSeed           Int?
  projectType       String?  // "commercial" | "movie" | "hybrid" | "music_video" | "children"
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  @@map("layerized_designs")
}
```

Run `npx prisma migrate dev --name add_layerized_designs`

#### Step 2: Add to fal gateway (`src/lib/generation/gateways/fal.ts`)
```typescript
export async function layerizeText(imageUrl: string, options: {
  prompt?: string;
  seed?: number;
} = {}) {
  const result = await fal.subscribe("fal-ai/ideogram/v3/layerize-text", {
    input: {
      image_url: imageUrl,
      prompt: options.prompt || "",
      seed: options.seed || null,
    }
  });
  return result.data;
  // Returns: { image, text_containers, overlay_html, image_layers, seed }
}
```

#### Step 3: API route — `app/api/layerize/route.ts`
```typescript
POST: { imageUrl, prompt? }
→ calls layerizeText()
→ saves to layerized_designs table
→ returns { designId, backgroundUrl, textContainers, overlayHtml }
```

#### Step 4: "Edit Text Layers" button in ALL relevant planners

**Commercial Planner** (primary use case — price/offer changes):
After a generated poster image, add button:
```tsx
<button onClick={() => openLayerize(imageUrl)}>Edit Text Layers</button>
```

**Movie Planner** (title cards, posters):
Same button after scene image generation.

**Music Video Planner** (album art, lyric cards):
Same button after storyboard image generation.

**Hybrid Planner** (scene title overlays, episode cards):
Same button in scene image actions.

**Asset Library** — right-click context menu on any image:
```
View | Download | Edit Text Layers | Attach to Video | Delete
```

#### Step 5: Inline Text Editor Panel (NOT a new page)
When layerize completes, slide open a panel BELOW the current image.

Left: background image (text removed)
Right: editable text fields per layer

```tsx
{layerizeResult && (
  <div style={{ marginTop: 16, display: "flex", gap: 16 }}>
    {/* Left: background preview */}
    <img src={layerizeResult.backgroundUrl} style={{ width: "50%", borderRadius: 8 }} />
    
    {/* Right: text editor */}
    <div style={{ flex: 1 }}>
      {layerizeResult.textContainers.map((container, ci) =>
        container.items.map((item, ii) =>
          item.spans.map((span, si) => (
            <div key={`${ci}-${ii}-${si}`} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 10, color: "#666" }}>{span.style.toUpperCase()}</label>
              <input
                value={userEdits[`${ci}-${ii}-${si}`] ?? span.text}
                onChange={e => updateEdit(`${ci}-${ii}-${si}`, e.target.value)}
                style={{ width: "100%", background: "#0d0d1a", border: "1px solid #333", borderRadius: 6, color: "#fff", padding: "6px 10px" }}
              />
            </div>
          ))
        )
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button onClick={previewComposite}>Preview Changes</button>
        <button onClick={saveNewVersion}>Save New Version</button>
      </div>
    </div>
  </div>
)}
```

#### Step 6: Re-compositing (FREE — no API call)
```typescript
function previewComposite(backgroundUrl, overlayHtml, userEdits) {
  // Replace text in overlay_html with user edits
  let html = overlayHtml;
  Object.entries(userEdits).forEach(([key, value]) => {
    // key = "ci-ii-si", match span by position
    // replace original text with new value
  });
  // Render in canvas or iframe
  // Export as PNG
  // $0.00 — no fal.ai call
}
```

#### WHERE LAYERIZE IS MOST USEFUL:
| Location | Use case |
|---|---|
| Commercial Planner | Price changes, date updates, offer edits — weekly |
| Movie Planner | Title card editing, poster text per episode |
| Music Video Planner | Album art text, lyric card editing |
| Hybrid Planner | Episode title overlays, scene label cards |
| Asset Library | Edit any stored poster/graphic without regenerating |

---

## TASK 7 — Fix Story Button Color

**Problem:** Henry said "that colour is off" for the story/story-bank create button.

**Current state:** Story Bank page already has `#22c55e` green — AUT Claude confirmed at line 407.
BUT the hybrid planner "story" expand button may be using a different color.

**Check these locations:**
1. `app/dashboard/story-bank/page.tsx` line 407 — new story button (already green ✅)
2. `app/dashboard/hybrid-planner/page.tsx` — "AI Expand Story" button color
3. `app/dashboard/` — any other "story" or "Create Story" button

**Rule:** All story-type action buttons must use `#22c55e` (green) or `linear-gradient(135deg, #22c55e, #16a34a)`.

---

## TASK 8 — AI Background Studio

**Add to:**
1. Commercial Planner image step
2. Image Editor / Video Tools

**Three background tabs:**
1. **Generate** — prompt → AI generates background
2. **Import** — drag-and-drop upload
3. **Solid** — color picker (white, black, custom hex)

**When user has a transparent PNG (from Task 6 Session 1):**
- Place transparent subject over any background
- "Apply Background" button composites them
- Result = professional composite image

**Component:** `app/components/AIBackgroundStudio.tsx`

```tsx
interface AIBackgroundStudioProps {
  subjectImageUrl?: string;    // transparent PNG
  onComposite: (resultUrl: string) => void;
}
```

**API route:** `app/api/background/generate/route.ts`
- POST: `{ prompt, subjectUrl? }`
- Uses existing image generation (Ideogram or FLUX)
- Returns: `{ backgroundUrl }`

**Compositing logic (client side):**
Use HTML Canvas API:
1. Draw background onto canvas
2. Draw transparent PNG subject on top
3. Export canvas as PNG
4. Upload to storage

---

## TASK 9 — Story Bank: Verify + Extend

AUT Claude confirmed Story Bank has significant implementation. Before building more:

**VERIFY first:**
1. Open `http://localhost:3200/dashboard/story-bank`
2. Create a story → confirm DB saves
3. Open workspace → confirm tabs work
4. Test "AI Expand" → confirm API route responds

**What appears to be missing (from blueprint vs codebase):**
- `brainstormLog` field on StoryIdea model (for AI chat history)
- `expandedText` field on StoryIdea model  
- "Send to Hybrid Planner" button wired to create a new hybrid project

**Add to StoryIdea model in schema:**
```prisma
// Add to existing StoryIdea model:
expandedText  String?
brainstormLog Json?   // [{role, content, timestamp}]
```

**Send to Planner API:** `app/api/story-bank/[id]/send-to-planner/route.ts`
```typescript
POST: { plannerId: "hybrid" | "movie" | "children" | "music-video" }
→ Creates new project in target planner
→ Pre-fills: title, idea/story text, scenes with SC01, SC02...
→ Returns: { redirectUrl }
```

---

## BUILD ORDER (priority sequence)

```
1. TASK 7   — Story button color (5 min fix)
2. TASK 3B  — Sidebar simplify (15 min)
3. TASK 3A  — Series planner error fixes (30 min)
4. TASK 2   — AITierSelector component (1 hour)
5. TASK 6 S1 — Ideogram Transparent (2 hours)
6. TASK 4   — Gemini TTS (1 hour)
7. TASK 5   — Verify + wire Kie.ai to UI (30 min)
8. TASK 8   — AI Background Studio (2 hours)
9. TASK 6 S2 — Layerize Text (3 hours)
10. TASK 1  — Workflow formula audit + missing tabs (2 hours)
11. TASK 9  — Story Bank verify + extend (1 hour)
```

---

## LOGGING RULES

After EVERY fix or feature:
1. Test in browser — real test at `http://localhost:3200`
2. Log to `update/PROBLEM_AND_FIX.md` if any bug found
3. Mark item done in `update/GHS_MASTER_TASK_APRIL17.md`

---

## BRANDING RULES (apply everywhere)

From `update/BRANDING/ghs_master_branding_provider_caching_policy.md`:

| What user sees | What it actually is |
|---|---|
| GHS Free | Ollama phi3/mistral (local) |
| GHS Standard | Claude Haiku / GPT-4o-mini |
| GHS Pro | Claude Sonnet / Claude Opus |
| GHS Voice Free | Piper TTS (local) |
| GHS Voice Pro | Gemini Flash TTS (fal.ai) |
| GHS Music | Kie.ai / Suno V5 |
| GHS Multi-Speaker | Gemini Flash TTS multi-speaker mode |

NEVER show: Claude, GPT, Gemini, Grok, Haiku, Sonnet, Opus, Ollama, Kie.ai, Suno, ElevenLabs

---

## AUT CLAUDE ROLE

AUT Claude only intervenes when:
- Build is completely stuck
- Critical error blocking everything
- Henry asks directly

AUT Claude does NOT write code. GHS Claude builds. AUT Claude plans, reviews, reports.
