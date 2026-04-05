# SPEC: SP-004 — AI VIDEO TRIMMER (INTELLIGENT CUT)
# SPEC ID: SP-004
# FEATURE: AI Video Trimmer — Intelligent Cut (Feature 2 from FEATURE_SPEC_001.md)
# BUILD ORDER: PRIORITY 3 — Build after SP-002 AND SP-003 are complete and tested
# WRITTEN BY: Claude Code — 2026-04-04
# STATUS: Ready to build — waiting for SP-002 and SP-003 to be complete first

---

## WHAT THIS FEATURE DOES (plain English)

GioHomeStudio already has a simple video trimmer in `/dashboard/video-tools`
that just cuts by start/end seconds. That stays untouched.

This feature adds a NEW section — `/dashboard/video-trimmer` — that is completely
different. It lets Henry:
1. Upload any video
2. Give AI a plain-English instruction ("make this a 30-second commercial")
3. AI analyzes the video, produces a trim plan (scene list with cut points)
4. Henry reviews and approves the plan
5. FFmpeg executes the approved plan
6. Result goes to content registry

This is AI-assisted intelligent cutting — not just start/end seconds.

---

## CRITICAL RULE — DO NOT TOUCH THESE:
- `app/dashboard/video-tools/` — Keep the simple trim tool exactly as-is
- `app/api/video-tools/` — Keep as-is
- DO NOT merge this feature into video-tools. It is a SEPARATE section.

---

## WHAT ALREADY EXISTS (do not rebuild these)

- `app/dashboard/video-tools/page.tsx` — Simple trim (start/end seconds) + narration
- `app/api/video-tools/trim/route.ts` — Simple time-based trim
- `app/api/video-tools/narrate/route.ts` — Add narration to video
- `src/modules/ffmpeg/index.ts` — FFmpeg trim, merge, etc. — DO NOT REWRITE
- `src/modules/content-registry/index.ts` — ContentItem CRUD
- `app/components/Sidebar.tsx` — Sidebar navigation

---

## WHAT TO BUILD

### New files to CREATE:

| File | What it contains |
|------|-----------------|
| `app/dashboard/video-trimmer/page.tsx` | New standalone dashboard section. Upload video, give instructions, view AI trim plan, approve and execute. |
| `app/api/video-trimmer/upload/route.ts` | POST — accepts video file upload, saves to temp storage, extracts metadata (duration, resolution, format), returns metadata |
| `app/api/video-trimmer/analyse/route.ts` | POST — accepts video path + user instruction + trim rules, calls AI, returns a structured TrimPlan |
| `app/api/video-trimmer/execute/route.ts` | POST — accepts approved TrimPlan + options, runs FFmpeg multi-segment cut, creates ContentItem, returns contentItemId |
| `src/modules/ffmpeg/trim-plan.ts` | Function to execute a multi-segment TrimPlan using FFmpeg concat filter |

### Files to MODIFY (extend only — never replace):

| File | What changes | What stays the same |
|------|-------------|---------------------|
| `app/components/Sidebar.tsx` | Add "Video Trimmer" nav entry under Create group | All existing nav entries |

### Files that must NOT be touched:
- `.env` and `.env.local`
- `app/dashboard/video-tools/` (simple trim — keep working)
- `app/api/video-tools/` (simple trim API — keep working)
- `src/modules/ffmpeg/index.ts` (only add new file trim-plan.ts, don't modify index)
- Any auth files

---

## TRIM PLAN DATA STRUCTURE

The AI produces a TrimPlan. This is the contract between AI analysis and FFmpeg execution.

```typescript
interface TrimSegment {
  segmentId: string,         // e.g. "seg_1"
  label: string,             // e.g. "Hook", "Product Shot", "CTA"
  startSec: number,          // cut in point
  endSec: number,            // cut out point
  durationSec: number,       // endSec - startSec
  repeat: number,            // 1 = play once, 2 = repeat once, etc.
  note: string               // AI's reason for keeping this segment
}

interface TrimPlan {
  planId: string,
  originalDuration: number,  // seconds
  outputDuration: number,    // total seconds of all segments
  segments: TrimSegment[],
  structure: string,         // e.g. "hook → product → CTA"
  aiModel: string,           // which AI produced this plan
  userInstruction: string,   // original plain-English instruction
  trimRules: TrimRules       // the rules passed in
}

interface TrimRules {
  maxSceneDurationSec?: number,   // max seconds per scene
  allowRepeat: boolean,           // can AI repeat a segment?
  commercialGoal: string,         // e.g. "shortlet ad", "product launch"
  targetDurationSec?: number,     // desired total output length
  addNarration: boolean,          // add narration after trim?
  addCaptions: boolean            // add captions? (future)
}
```

---

## AI ANALYSIS PROMPT (what /analyse sends to AI)

The analyse route builds a structured prompt:

```
You are an intelligent video editor helping create a commercial from an uploaded video.

Video metadata:
- Duration: {durationSec} seconds
- Resolution: {width}x{height}

User instruction: "{userInstruction}"

Trim rules:
- Max scene duration: {maxSceneDurationSec} seconds (or "no limit")
- Allow scene repeat: {allowRepeat}
- Commercial goal: {commercialGoal}
- Target output duration: {targetDurationSec} seconds (or "no limit")

Your task:
Analyze this video and produce a TrimPlan as a JSON object.
Return ONLY the JSON. No explanation before or after.

The JSON must match this schema:
{
  "planId": "plan_<timestamp>",
  "segments": [
    {
      "segmentId": "seg_1",
      "label": "Hook",
      "startSec": 0,
      "endSec": 4,
      "durationSec": 4,
      "repeat": 1,
      "note": "Strong opening shot, grabs attention"
    }
  ],
  "structure": "hook → main → CTA",
  "outputDuration": <total seconds>
}

Rules:
- Segments must not overlap
- startSec and endSec must be within 0 to {durationSec}
- If repeat > 1, count that segment's duration multiple times in outputDuration
- Prefer hook-first, CTA-last commercial structure
- Do not create segments shorter than 1 second
```

---

## VIDEO TRIMMER PAGE UI — video-trimmer/page.tsx

### Step 1 — Upload
```
[ Drop video here or click to upload ]
Supported: MP4, MOV, MKV — max 500MB

[ Once uploaded shows: ]
File: apartment_tour.mp4
Duration: 3 min 42 sec
Resolution: 1920x1080
```

### Step 2 — Instructions
```
AI Provider:    [ Local LLM / OpenAI / Anthropic ]

Your instruction:
[ textarea ]
e.g. "Trim this into a 30-second luxury shortlet commercial"

--- Trim Rules ---
Commercial goal:           [ shortlet ad / product launch / brand promo / custom ]
Max scene duration:        [ __ ] seconds  (blank = no limit)
Target output duration:    [ __ ] seconds  (blank = no limit)
Allow scene repeat:        [ Yes / No ]
Add narration after trim:  [ Yes / No ]

[ ANALYSE VIDEO ]
```

### Step 3 — Review Plan
```
AI Trim Plan
Structure: hook → property → amenities → CTA
Estimated output: 28 seconds

Segment 1: Hook (0:00 – 0:04) — 4 sec
"Strong entrance shot of building exterior"
[ Keep ] [ Remove ]

Segment 2: Property Tour (0:12 – 0:22) — 10 sec
"Best interior room shots, high value"
[ Keep ] [ Remove ]

Segment 3: Amenities (0:45 – 0:55) — 10 sec
"Pool and gym shots, shows premium quality"
[ Keep ] [ Remove ]

Segment 4: CTA (2:30 – 2:34) — 4 sec  [REPEAT x2]
"Strong closing contact shot"
[ Keep ] [ Remove ]

[ APPROVE AND CUT ]
```

### Step 4 — Result
```
Trim complete.
Output: 28 seconds — Commercial Cut

[ View in Content Registry ]  [ Go to Review Queue ]
```

---

## FFMPEG MULTI-SEGMENT EXECUTION (trim-plan.ts)

The `executeTrimPlan` function:
- Input: `videoPath: string`, `plan: TrimPlan`, `outputPath: string`
- For each segment in the plan (with repeat), trim that segment to a temp file
- Concatenate all temp files into final output using FFmpeg concat demuxer
- Clean up temp files
- Return `{ success: boolean, outputPath: string }`

### Pattern:
```typescript
// Step 1: Trim each segment to a temp file
for (const seg of expandedSegments) {
  await trimVideo(inputPath, tempPath, seg.startSec, seg.endSec);
}

// Step 2: Write concat list file
const concatList = tempPaths.map(p => `file '${p}'`).join('\n');
fs.writeFileSync(concatListPath, concatList);

// Step 3: FFmpeg concat
ffmpeg()
  .input(concatListPath)
  .inputOptions(["-f concat", "-safe 0"])
  .outputOptions(["-c copy"])
  .output(toFFmpegPath(absOutput))
  .run();
```

`expandedSegments` = flatten repeat counts (if repeat=2, that segment appears twice in the list).

---

## API ROUTES

### POST /api/video-trimmer/upload
Input: multipart/form-data with `video` file
Process:
1. Save to `storage/uploads/trimmer/{filename}`
2. Use ffprobe (via fluent-ffmpeg's `.ffprobe()`) to extract duration, width, height, format
3. Return metadata

Output:
```json
{
  "tempPath": "storage/uploads/trimmer/abc123_apartment_tour.mp4",
  "metadata": {
    "durationSec": 222,
    "width": 1920,
    "height": 1080,
    "format": "mp4"
  }
}
```

### POST /api/video-trimmer/analyse
Input:
```json
{
  "videoPath": "storage/uploads/trimmer/abc123_apartment_tour.mp4",
  "userInstruction": "Trim this into a 30-second luxury shortlet commercial",
  "trimRules": {
    "maxSceneDurationSec": 10,
    "allowRepeat": true,
    "commercialGoal": "shortlet ad",
    "targetDurationSec": 30,
    "addNarration": false,
    "addCaptions": false
  },
  "aiProvider": "local"
}
```
Process:
1. Build AI prompt from metadata + instruction + rules
2. Call LLM (local Ollama or OpenAI or Anthropic based on `aiProvider`)
3. Parse JSON from response
4. Return TrimPlan

Output:
```json
{
  "plan": { ...TrimPlan... },
  "promptUsed": "...",
  "aiProvider": "local"
}
```

### POST /api/video-trimmer/execute
Input:
```json
{
  "videoPath": "storage/uploads/trimmer/abc123_apartment_tour.mp4",
  "plan": { ...TrimPlan... },
  "options": {
    "outputName": "apartment_commercial_cut"
  }
}
```
Process:
1. Call `executeTrimPlan()` from `src/modules/ffmpeg/trim-plan.ts`
2. Create ContentItem with output path + trim metadata
3. Clean up upload temp file
4. Return contentItemId

Output:
```json
{
  "contentItemId": "...",
  "outputPath": "storage/outputs/trimmer/...",
  "outputDurationSec": 28
}
```

---

## SIDEBAR CHANGE

In `app/components/Sidebar.tsx`, add one nav entry:
```typescript
{ href: "/dashboard/video-trimmer", label: "Video Trimmer (AI)", icon: "🎬" }
```
Place it below "Video Tools" in the Create group.

---

## AI PROVIDER ROUTING

The analyse route uses the same LLM pattern as `/api/supervisor`:
- `aiProvider: "local"` → call local Ollama endpoint from `src/config/env.ts`
- `aiProvider: "openai"` → call OpenAI if key configured
- `aiProvider: "anthropic"` → call Anthropic if key configured

Use whichever LLM module already exists in the codebase. Do not create a new one.

---

## QUALITY GATES (must all pass before Feature 2 is done)

- [ ] `/dashboard/video-trimmer` page loads without errors
- [ ] "Video Trimmer (AI)" appears in sidebar — separate from "Video Tools"
- [ ] Video upload works and returns duration + resolution
- [ ] Local LLM produces a valid TrimPlan JSON
- [ ] TrimPlan displays correctly in the review UI
- [ ] User can remove a segment before approving
- [ ] Approve and Cut executes FFmpeg and produces a trimmed video
- [ ] ContentItem created and appears in content registry
- [ ] Simple trim in `/dashboard/video-tools` still works unchanged
- [ ] Upload temp file cleaned up after execution
- [ ] Playwright test covers: page loads, upload, plan review UI renders
- [ ] No existing video-tools route broken

---

## ESCALATION TRIGGERS — Stop and tell Henry if:

- Local LLM consistently returns malformed JSON that cannot be parsed
- ffprobe is not available in the FFmpeg installation (needed for metadata extraction)
- Multi-segment concat produces audio/video sync issues
- Upload files over 100MB cause server timeout
- The LLM plan contains segment times outside the video's actual duration

---

## SESSION START CHECKLIST

Before writing any code:
1. Read this spec top to bottom
2. Confirm SP-002 (Feature 3) AND SP-003 (Feature 1) are fully complete and tested
3. Read `app/dashboard/video-tools/page.tsx` — understand simple trim so you don't accidentally duplicate it
4. Read `src/modules/ffmpeg/index.ts` — understand `trimVideo()` function signature (you'll reuse it)
5. Run `npx tsc --noEmit` — confirm zero TypeScript errors before starting
6. Tell Henry: "Ready to build Feature 2 — AI Video Trimmer. Starting with upload route."
7. Wait for GO AHEAD
