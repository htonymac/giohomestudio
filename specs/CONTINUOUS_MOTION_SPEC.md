# GIOHOMESTUDIO — CONTINUOUS MOTION PIPELINE SPEC
# File: C:\Users\USER\Desktop\CLAUDE\giohomestudio\specs\CONTINUOUS_MOTION_SPEC.md
# For: Claude Code (technical instruction document)
# Priority: Phase 2 — build after core generation pipeline is stable
# API: fal.ai (existing FAL_KEY) — provider-agnostic architecture
# ================================================================
# READ ENTIRE DOCUMENT BEFORE BUILDING.
# This is the most complex feature in GioHomeStudio.
# Build it incrementally. Test each layer before the next.
# ================================================================

## THE PROBLEM THIS SOLVES

AI video models generate 5-10 seconds at a time.
A real scene like "he runs, jumps off a cliff, falls into water,
lightning strikes" is 15-27 seconds of continuous motion.

If you generate three separate 5-second clips independently,
each one starts fresh — different character pose, different
camera angle, different lighting. The result looks broken.

The fix: each new clip must start from the LAST FRAME of
the previous clip. Same character. Same motion direction.
Same lighting. Same camera. The motion flows.

This is called frame continuation. Every Hollywood studio
does this. GioHomeStudio must do it automatically.

---

## ARCHITECTURE — THREE LAYERS

This system is built provider-agnostic. It works with
Wan, Kling, Runway, Hailuo, Veo, Seedance — any provider
that supports image-to-video. The user can switch providers
per project without breaking the pipeline.

```
LAYER 1 — CONTINUITY ENGINE (provider-independent)
  The brain. Handles segmentation, frame extraction,
  anchor chaining, prompt continuation, assembly.
  Never changes regardless of provider.
  File: backend/video/continuity_engine.js

LAYER 2 — PROVIDER ADAPTERS (one per provider)
  Each adapter wraps one provider's API.
  All adapters expose the same three methods.
  File: backend/video/adapters/[provider].adapter.js

LAYER 3 — PROVIDER ROUTER (picks the right adapter)
  Reads user's selected provider.
  Loads the matching adapter.
  Passes it to the continuity engine.
  File: backend/video/provider_router.js
```

---

## LAYER 1 — CONTINUITY ENGINE

### File: backend/video/continuity_engine.js

This is the core pipeline. It does NOT know which provider
is being used. It only talks to adapters through the
standard interface.

### The Pipeline (step by step)

```
Step 1:  Receive scene data from user
         - full scene prompt (long description)
         - target total duration (e.g. 27 seconds)
         - segment duration preference (e.g. 5 seconds)
         - selected provider
         - seed value (auto-generated or user-provided)
         - continuous_motion: true

Step 2:  MOTION UNIT PLANNER
         Split the long prompt into motion-based segments.
         NOT by sentence. By physical motion beats.
         
         Input: "He ran and jumped over the cliff, falling
         fast toward the water below. Lightning struck
         the sky and thunder roared."
         
         Output:
         [
           { unit: 1, action: "running toward cliff edge", duration: 5 },
           { unit: 2, action: "jumping off cliff", duration: 5 },
           { unit: 3, action: "falling through air toward water", duration: 5 },
           { unit: 4, action: "hitting water with splash, lightning in sky", duration: 5 }
         ]
         
         Use an LLM call (Claude API or local) to intelligently
         split the prompt by physical action, NOT by punctuation.

Step 3:  SEGMENT DURATION PLANNER
         Map motion units to generation blocks based on
         the provider's maximum comfortable duration.
         
         If provider max is 5 sec and total duration is 27 sec:
         Segments: [5, 5, 5, 5, 5, 2]
         
         If provider max is 10 sec and total is 27 sec:
         Segments: [10, 10, 7]

Step 4:  GENERATE SEGMENT 1
         Call adapter.generateFromText(prompt, seed, duration)
         for the first segment only.
         The first segment has no motion anchor — it starts fresh.
         
         Store result: /scene_clips/scene_[id]/clip_001.mp4
         Update job status: segment 1 complete

Step 5:  EXTRACT MOTION ANCHOR
         Use FFmpeg to extract the last frame of clip_001.mp4:
         
         ffmpeg -sseof -0.1 -i clip_001.mp4 -frames:v 1 \
           -q:v 2 /scene_clips/scene_[id]/anchor_001.jpg
         
         Store anchor path in database.
         This frame becomes the starting point for segment 2.

Step 6:  GENERATE SEGMENT 2
         Call adapter.generateFromImage(
           anchorImageUrl,
           continuationPrompt,
           seed,
           duration
         )
         
         The continuation prompt MUST include:
         - "Continue:" prefix
         - Same character description
         - Same camera angle description
         - Next motion action
         
         Example continuation prompt:
         "Continue: same man, same clothing, same camera angle,
         cinematic wide shot — the man jumps off the cliff and
         begins falling toward the ocean below"
         
         Store result: /scene_clips/scene_[id]/clip_002.mp4
         Extract anchor: anchor_002.jpg

Step 7:  REPEAT FOR ALL SEGMENTS
         For each remaining segment:
         - Extract last frame from previous clip
         - Build continuation prompt
         - Call adapter.generateFromImage()
         - Store clip and anchor
         - Update job status

Step 8:  ASSEMBLY
         Once all segments are complete:
         
         Create concat list file:
         file 'clip_001.mp4'
         file 'clip_002.mp4'
         file 'clip_003.mp4'
         ...
         
         Merge with FFmpeg:
         ffmpeg -f concat -safe 0 -i list.txt -c copy \
           /scene_clips/scene_[id]/final_scene.mp4
         
         Store final scene URL in database.
         Send to Review Queue.

Step 9:  AUDIO ATTACHMENT (after visual chain is stable)
         Audio is added AFTER all visual segments are merged.
         Visual continuity first. Audio second.
         Use the Audio-Video Sync Tool from Music Studio.
```

### Continuation Prompt Builder

```javascript
function buildContinuationPrompt(motionUnit, previousPrompt, characterDesc, cameraDesc) {
  return `Continue: ${characterDesc}, ${cameraDesc} — ${motionUnit.action}`;
}

// Example output:
// "Continue: same Nigerian man in dark suit, same cinematic
//  wide shot, same dramatic lighting — the man jumps off
//  the cliff and begins falling toward the ocean below"
```

### Motion Anchor Extraction

```javascript
const { execSync } = require('child_process');

function extractMotionAnchor(clipPath, outputPath) {
  // Extract last frame as high-quality JPEG
  execSync(`ffmpeg -sseof -0.1 -i "${clipPath}" -frames:v 1 -q:v 2 "${outputPath}"`);
  return outputPath;
}
```

### Clip Assembly

```javascript
function assembleClips(clipPaths, outputPath) {
  // Create concat list
  const listContent = clipPaths.map(p => `file '${p}'`).join('\n');
  const listPath = outputPath.replace('.mp4', '_list.txt');
  fs.writeFileSync(listPath, listContent);
  
  // Merge with FFmpeg
  execSync(`ffmpeg -f concat -safe 0 -i "${listPath}" -c copy "${outputPath}"`);
  return outputPath;
}
```

---

## LAYER 2 — PROVIDER ADAPTERS

### Standard Interface (every adapter MUST implement)

```javascript
class VideoProviderAdapter {
  // Generate video from text prompt only (first segment)
  async generateFromText(prompt, seed, durationSeconds) {
    // Returns: { videoUrl, jobId, actualDuration }
  }

  // Generate video from starting image + prompt (continuation)
  async generateFromImage(imageUrl, prompt, seed, durationSeconds) {
    // Returns: { videoUrl, jobId, actualDuration }
  }

  // Report what this provider can do
  getCapabilities() {
    // Returns: {
    //   maxDuration, supportsSeed, supportsImageInput,
    //   costPerSecond, name, quality
    // }
  }
}
```

### Adapter: Wan via fal.ai

```javascript
// File: backend/video/adapters/fal_wan.adapter.js

const { fal } = require("@fal-ai/client");

class FalWanAdapter {
  async generateFromText(prompt, seed, durationSeconds) {
    const result = await fal.subscribe("fal-ai/wan-pro/t2v-1.3b", {
      input: {
        prompt,
        seed: seed || undefined,
        num_frames: durationSeconds * 24,  // 24fps
      }
    });
    return { videoUrl: result.data.video.url, jobId: result.requestId };
  }

  async generateFromImage(imageUrl, prompt, seed, durationSeconds) {
    const result = await fal.subscribe("fal-ai/wan-pro/i2v-720p", {
      input: {
        image_url: imageUrl,
        prompt,
        seed: seed || undefined,
        num_frames: durationSeconds * 24,
      }
    });
    return { videoUrl: result.data.video.url, jobId: result.requestId };
  }

  getCapabilities() {
    return {
      name: 'Wan 2.2 Pro',
      maxDuration: 10,
      supportsSeed: true,
      supportsImageInput: true,
      costPerSecond: 0.07,
      quality: 'standard',
    };
  }
}
```

### Adapter: Kling 2.5 via fal.ai

```javascript
// File: backend/video/adapters/fal_kling.adapter.js

class FalKlingAdapter {
  async generateFromText(prompt, seed, durationSeconds) {
    const result = await fal.subscribe("fal-ai/kling-video/v2.5/standard/text-to-video", {
      input: {
        prompt,
        duration: `${durationSeconds}`,
        seed: seed || undefined,
      }
    });
    return { videoUrl: result.data.video.url, jobId: result.requestId };
  }

  async generateFromImage(imageUrl, prompt, seed, durationSeconds) {
    const result = await fal.subscribe("fal-ai/kling-video/v2.5/standard/image-to-video", {
      input: {
        image_url: imageUrl,
        prompt,
        duration: `${durationSeconds}`,
        seed: seed || undefined,
      }
    });
    return { videoUrl: result.data.video.url, jobId: result.requestId };
  }

  getCapabilities() {
    return {
      name: 'Kling 2.5 Standard',
      maxDuration: 10,
      supportsSeed: true,
      supportsImageInput: true,
      costPerSecond: 0.07,
      quality: 'standard',
    };
  }
}
```

### Additional Adapters to Build (same pattern)

```
fal_kling_pro.adapter.js     — Kling 2.5 Pro / 3.0 Pro
fal_hailuo.adapter.js        — Hailuo/MiniMax image-to-video
fal_runway.adapter.js        — Runway Gen-4
fal_veo.adapter.js           — Veo 3.1 (Google)
fal_seedance.adapter.js      — Seedance 2.0 (ByteDance)
```

Each adapter is 50-80 lines. Same three methods. Same pattern.

---

## LAYER 3 — PROVIDER ROUTER

```javascript
// File: backend/video/provider_router.js

const adapters = {
  'wan':           require('./adapters/fal_wan.adapter'),
  'kling_std':     require('./adapters/fal_kling.adapter'),
  'kling_pro':     require('./adapters/fal_kling_pro.adapter'),
  'hailuo':        require('./adapters/fal_hailuo.adapter'),
  'runway':        require('./adapters/fal_runway.adapter'),
  'veo':           require('./adapters/fal_veo.adapter'),
  'seedance':      require('./adapters/fal_seedance.adapter'),
};

function getAdapter(providerKey) {
  const AdapterClass = adapters[providerKey];
  if (!AdapterClass) throw new Error(`Unknown provider: ${providerKey}`);
  return new AdapterClass();
}
```

---

## DATABASE TABLES

```sql
-- Scenes with continuous motion data
CREATE TABLE continuous_scenes (
  id SERIAL PRIMARY KEY,
  project_id INT NOT NULL,
  user_id INT NOT NULL,
  full_prompt TEXT NOT NULL,
  total_duration_seconds INT NOT NULL,
  segment_duration_seconds INT DEFAULT 5,
  provider_key VARCHAR(50) NOT NULL,
  seed INT,
  continuous_motion BOOLEAN DEFAULT true,
  status VARCHAR(30) DEFAULT 'PLANNING',
    -- PLANNING | GENERATING | ASSEMBLING | COMPLETE | FAILED
  final_video_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Individual motion segments within a scene
CREATE TABLE motion_segments (
  id SERIAL PRIMARY KEY,
  scene_id INT NOT NULL REFERENCES continuous_scenes(id),
  segment_number INT NOT NULL,
  motion_action TEXT NOT NULL,
  continuation_prompt TEXT NOT NULL,
  duration_seconds INT NOT NULL,
  start_time_seconds INT NOT NULL,
  end_time_seconds INT NOT NULL,
  anchor_image_url TEXT,         -- last frame of PREVIOUS segment
  clip_url TEXT,                 -- generated clip URL
  status VARCHAR(30) DEFAULT 'PENDING',
    -- PENDING | GENERATING | EXTRACTING | COMPLETE | FAILED
  fal_job_id VARCHAR(200),
  fal_cost DECIMAL(10,4),
  generation_time_seconds INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Motion anchors (last frames)
CREATE TABLE motion_anchors (
  id SERIAL PRIMARY KEY,
  scene_id INT NOT NULL,
  segment_number INT NOT NULL,
  anchor_image_path TEXT NOT NULL,
  extracted_at TIMESTAMP DEFAULT NOW()
);
```

---

## WHERE TO ADD IN THE UI

### Scene Planner — Continuous Motion Toggle

```
┌─────────────────────────────────────────────────────────┐
│  Scene Settings                                         │
│                                                         │
│  Scene Duration:  [27] seconds                          │
│                                                         │
│  [✓] Continuous Motion                                  │
│      Extend motion across segments automatically.       │
│      No visible breaks between clips.                   │
│                                                         │
│  Segment Duration:  [5 sec ▼]                          │
│                                                         │
│  Provider:  [Kling 2.5 Standard ▼]                     │
│  ⚠ Provider locked for this scene when Continuous       │
│    Motion is enabled. Switch per scene, not mid-scene.  │
│                                                         │
│  Estimated Cost: $0.07/sec × 27 sec = $1.89            │
│  Estimated Segments: 6                                  │
│                                                         │
│              [Generate Continuous Scene]                 │
└─────────────────────────────────────────────────────────┘
```

### Scene Board — Segment Visualization

When Continuous Motion is enabled, the Scenes tab shows
the motion segment chain:

```
┌─────────────────────────────────────────────────────────┐
│ Scene: Cliff Jump — 27 seconds — Continuous Motion ✓   │
│                                                         │
│ Seg 1: Running to cliff          0-5s    ✅ Complete    │
│   ↓ anchor_001.jpg                                     │
│ Seg 2: Jumping off cliff         5-10s   ✅ Complete    │
│   ↓ anchor_002.jpg                                     │
│ Seg 3: Falling through air       10-15s  ⏳ Generating  │
│   ↓ (waiting for anchor)                               │
│ Seg 4: Falling toward water      15-20s  ⏸ Pending     │
│   ↓                                                    │
│ Seg 5: Hitting water, splash     20-25s  ⏸ Pending     │
│   ↓                                                    │
│ Seg 6: Lightning, aftermath      25-27s  ⏸ Pending     │
│                                                         │
│ Progress: ██████░░░░░░░░░ 2/6 segments                 │
│                                                         │
│ [Pause] [Cancel] [Preview Completed]                   │
└─────────────────────────────────────────────────────────┘
```

Each segment shows its dependency on the previous anchor.
User can see the chain visually.

### Assembly Tab

Assembly receives all completed segments and shows:
- Merged preview player
- Timeline with segment boundaries marked
- "Add Audio" button (only after visual chain is stable)
- Export button

---

## CRITICAL RULES FOR CLAUDE CODE

### Rule 1 — Provider Lock Per Scene
When Continuous Motion is enabled, the user MUST stay on
one provider for the entire scene. Different providers
produce different visual styles — switching mid-scene
breaks character and lighting continuity.
Enforce this in the UI: lock the provider dropdown after
the first segment generates.

### Rule 2 — Seed Consistency
Pass the SAME seed value to every segment in a scene.
If the provider does not support seed (check getCapabilities),
rely on the motion anchor frame for continuity instead.

### Rule 3 — Sequential Generation Only
Segments MUST generate in order. Segment 3 cannot start
until segment 2's anchor is extracted. This is a strict
dependency chain — no parallel generation within one scene.

### Rule 4 — Audio After Visual
Do NOT attempt to generate or attach audio until ALL
visual segments are merged. Visual continuity first.
Audio attachment second. This prevents wasted audio
work on scenes that need visual re-generation.

### Rule 5 — Failure Recovery
If a segment fails:
- Retry that segment up to 2 times
- If still fails: mark scene as FAILED at that segment
- Allow user to regenerate from that segment onward
- Do NOT regenerate already-completed segments
- Refund credit for failed segments only

### Rule 6 — Credit Calculation
Show total estimated cost BEFORE generation starts:
  cost = provider.costPerSecond × totalDuration
User must confirm total cost before the pipeline begins.
Deduct credit per segment as each completes (not all at once).

---

## CONNECTION TO EXISTING GHS SYSTEMS

### Connection to Review Queue
The final assembled scene (not individual segments) goes
to Review Queue for approval. Individual segments are
internal pipeline artifacts — users review the final result.

### Connection to Music Studio
After visual assembly is complete, the "Add Audio" button
opens the Audio-Video Sync Tool from Music Studio.
User selects music, narration, or SFX to layer over the
continuous scene.

### Connection to Credit System
Each segment generation logs to generation_log with:
- model_id, provider, cost_to_henry, user_charged, profit
- scene_id and segment_number for traceability

### Connection to AI Models
The provider selector in Continuous Motion uses the same
MODEL_REGISTRY from registry.js. Only VIDEO models with
supportsImageInput: true are available for selection.

---

## BUILD ORDER

```
Session 1: Foundation
  [ ] Create database tables
  [ ] Create provider_router.js
  [ ] Create fal_wan.adapter.js
  [ ] Create fal_kling.adapter.js
  [ ] Test: generate one clip from text via each adapter
  [ ] Test: generate one clip from image via each adapter
  [ ] Show Henry both results

Session 2: Continuity Engine
  [ ] Create continuity_engine.js
  [ ] Build extractMotionAnchor() function (FFmpeg)
  [ ] Build buildContinuationPrompt() function
  [ ] Build assembleClips() function (FFmpeg concat)
  [ ] Test: 3-segment chain on Wan — verify anchor extraction
  [ ] Test: merged output looks continuous
  [ ] Show Henry the 15-second result

Session 3: Motion Unit Planner
  [ ] Build motion unit splitting logic
  [ ] Use Claude API or local LLM to split long prompts
  [ ] Build segment duration planner
  [ ] Test: give it a 27-second story, verify segment plan
  [ ] Show Henry the segment breakdown

Session 4: UI Integration
  [ ] Add Continuous Motion toggle to Scene Settings
  [ ] Build segment visualization in Scene Board
  [ ] Add provider lock when Continuous Motion is on
  [ ] Wire cost estimation display
  [ ] Wire progress indicator during generation
  [ ] Connect assembly output to Review Queue
  [ ] Add "Add Audio" button post-assembly
  [ ] Show Henry full end-to-end workflow

Session 5: Remaining Adapters
  [ ] Add fal_kling_pro.adapter.js
  [ ] Add fal_hailuo.adapter.js
  [ ] Add fal_veo.adapter.js
  [ ] Add fal_seedance.adapter.js
  [ ] Test each adapter with 3-segment continuation
  [ ] Push to GitHub after Henry approves
```

---

## WHAT NOT TO DO

```
DO NOT generate segments in parallel — strict sequential order
DO NOT split prompts by sentence — split by motion action
DO NOT allow provider switching mid-scene
DO NOT attach audio before visual chain is complete
DO NOT show individual segments in Review Queue — only final
DO NOT skip anchor extraction between segments
DO NOT hardcode any provider logic in the continuity engine
DO NOT charge full scene cost upfront — charge per segment
DO NOT regenerate completed segments on failure — only failed ones
```
