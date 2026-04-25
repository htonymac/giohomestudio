# GioHomeStudio — Must Read (Claude Code, before any work)

This file is the index of high-priority specs and rules that MUST be read before touching GHS. Any task that overlaps with one of these features must consult the source doc first.

---

## SECTION A — DEFERRED (do NOT start without explicit Henry signal)

### A1. Finance Phase 2 — credit DB + deduction
- **Plan:** `update/GHS_PAYMENT_BILLING_PLAN.md`
- **Status:** DEFERRED — Henry's special call only.
- **Trigger phrase:** Henry must explicitly say "start Finance Phase 2" or "build credits".
- **Side effect when shipped:** kills the 500 errors on `/dashboard/settings/finance`, unblocks `/dashboard/budget`.
- **Scope:** Prisma models User / CreditBalance / CreditTransaction / Subscription, deduction middleware, wiring into all generation endpoints.
- DO NOT start unprompted.

---

## SECTION B — CONTINUOUS MOTION PIPELINE (Phase 2 — after core stable)

- **Source:** `update/CONTINUOUS MOTION/CONTINUOUS_MOTION_SPEC (1).md`
- **Target file when built:** `specs/CONTINUOUS_MOTION_SPEC.md` (per spec header)
- **Why:** AI video models generate 5-10s clips. Real scenes ("runs, jumps off cliff, falls into water, lightning") need 15-27s of continuous motion. Independent clips look broken (different pose, angle, lighting). Fix: each new clip starts from the LAST FRAME of the previous clip via FFmpeg anchor extraction. Same character, motion direction, lighting, camera. The motion flows.

### Architecture — 3 layers

```
LAYER 1 — CONTINUITY ENGINE        (provider-independent brain)
  backend/video/continuity_engine.js
  Segmentation, frame extraction, anchor chaining, prompt continuation, assembly.

LAYER 2 — PROVIDER ADAPTERS        (one per provider, same 3-method interface)
  backend/video/adapters/[provider].adapter.js
  Methods: generateFromText, generateFromImage, getCapabilities

LAYER 3 — PROVIDER ROUTER          (picks adapter from user choice)
  backend/video/provider_router.js
```

### Pipeline (9 steps in continuity engine)

1. Receive scene data: full prompt, target duration (e.g. 27s), segment duration (e.g. 5s), provider, seed, continuous_motion=true
2. **MOTION UNIT PLANNER** — LLM splits prompt by physical action (NOT punctuation). Output: `[{unit, action, duration}]`
3. **SEGMENT DURATION PLANNER** — map units to provider's max comfortable duration. e.g. 27s with max 5s → `[5,5,5,5,5,2]`
4. **GENERATE SEGMENT 1** — `adapter.generateFromText(prompt, seed, duration)`. Store `clip_001.mp4`.
5. **EXTRACT MOTION ANCHOR** — `ffmpeg -sseof -0.1 -i clip_001.mp4 -frames:v 1 -q:v 2 anchor_001.jpg` (last frame, high quality JPG)
6. **GENERATE SEGMENT 2** — `adapter.generateFromImage(anchor, continuationPrompt, seed, duration)`. Continuation prompt MUST include "Continue:" prefix + same character + same camera angle + next action.
7. **REPEAT FOR ALL SEGMENTS** — extract anchor from previous, build continuation prompt, generate, repeat.
8. **ASSEMBLY** — `ffmpeg -f concat -safe 0 -i list.txt -c copy final_scene.mp4` then send to Review Queue.
9. **AUDIO ATTACHMENT** — only AFTER all visual segments merged. Use Audio-Video Sync Tool from Music Studio.

### Adapters to build (same pattern, ~50-80 lines each)

- `fal_wan.adapter.js` — Wan 2.2 Pro (`fal-ai/wan-pro/t2v-1.3b`, `fal-ai/wan-pro/i2v-720p`)
- `fal_kling.adapter.js` — Kling 2.5 Standard (`fal-ai/kling-video/v2.5/standard/text-to-video`, `image-to-video`)
- `fal_kling_pro.adapter.js` — Kling 2.5 Pro / 3.0 Pro
- `fal_hailuo.adapter.js` — Hailuo/MiniMax i2v
- `fal_runway.adapter.js` — Runway Gen-4
- `fal_veo.adapter.js` — Veo 3.1 (Google)
- `fal_seedance.adapter.js` — Seedance 2.0 (ByteDance)

Standard interface every adapter implements:
```javascript
class VideoProviderAdapter {
  async generateFromText(prompt, seed, durationSeconds)   // → { videoUrl, jobId, actualDuration }
  async generateFromImage(imageUrl, prompt, seed, durationSeconds)
  getCapabilities()  // → { name, maxDuration, supportsSeed, supportsImageInput, costPerSecond, quality }
}
```

### Database tables (3)

- `continuous_scenes` — id, project_id, user_id, full_prompt, total_duration, segment_duration, provider_key, seed, continuous_motion, status (PLANNING/GENERATING/ASSEMBLING/COMPLETE/FAILED), final_video_url
- `motion_segments` — id, scene_id, segment_number, motion_action, continuation_prompt, duration, start/end seconds, anchor_image_url, clip_url, status (PENDING/GENERATING/EXTRACTING/COMPLETE/FAILED), fal_job_id, fal_cost, generation_time
- `motion_anchors` — id, scene_id, segment_number, anchor_image_path, extracted_at

### UI

- **Scene Settings** — Continuous Motion toggle, Scene Duration input, Segment Duration dropdown, Provider dropdown (locked when toggle on), Estimated Cost display, Estimated Segments count
- **Scene Board** — segment chain visualization with anchor links, per-segment status (✅/⏳/⏸), progress bar, Pause/Cancel/Preview buttons
- **Assembly Tab** — merged preview, timeline w/ segment boundaries, "Add Audio" button (only after visual stable), Export

### CRITICAL RULES

1. **Provider Lock Per Scene** — once first segment generates, lock provider dropdown. Different providers = different visual styles → break continuity.
2. **Seed Consistency** — same seed for every segment in a scene. If provider lacks seed support, rely on motion anchor.
3. **Sequential Generation Only** — strict dependency chain. No parallel within one scene.
4. **Audio After Visual** — never generate/attach audio until all visual segments merged.
5. **Failure Recovery** — retry failed segment up to 2 times. If still fails, mark scene FAILED at that segment. Allow regenerate from there onward, NEVER regenerate completed segments. Refund only failed segments.
6. **Credit Calculation** — show total estimated cost before start. Confirm. Deduct per segment as each completes.

### Build order — 5 sessions

```
Session 1: Foundation
  [ ] DB tables (continuous_scenes, motion_segments, motion_anchors)
  [ ] provider_router.js
  [ ] fal_wan.adapter.js
  [ ] fal_kling.adapter.js
  [ ] Test: one clip from text via each adapter
  [ ] Test: one clip from image via each adapter
  [ ] Show Henry both results

Session 2: Continuity Engine
  [ ] continuity_engine.js
  [ ] extractMotionAnchor() (FFmpeg)
  [ ] buildContinuationPrompt()
  [ ] assembleClips() (FFmpeg concat)
  [ ] Test: 3-segment chain on Wan — verify anchor extraction
  [ ] Test: merged output looks continuous
  [ ] Show Henry 15-second result

Session 3: Motion Unit Planner
  [ ] Motion unit splitting logic
  [ ] Claude API or local LLM splits long prompts by action
  [ ] Segment duration planner
  [ ] Test: 27-second story → verify segment plan
  [ ] Show Henry the breakdown

Session 4: UI Integration
  [ ] Continuous Motion toggle in Scene Settings
  [ ] Segment visualization in Scene Board
  [ ] Provider lock when Continuous Motion on
  [ ] Cost estimation display
  [ ] Progress indicator during generation
  [ ] Connect assembly output to Review Queue
  [ ] "Add Audio" button post-assembly
  [ ] Show Henry full end-to-end workflow

Session 5: Remaining Adapters
  [ ] fal_kling_pro.adapter.js
  [ ] fal_hailuo.adapter.js
  [ ] fal_veo.adapter.js
  [ ] fal_seedance.adapter.js
  [ ] Test each with 3-segment continuation
  [ ] Push to GitHub after Henry approves
```

### Connections to existing GHS

- **Review Queue** — final assembled scene only (NOT individual segments)
- **Music Studio** — "Add Audio" opens Audio-Video Sync Tool
- **Credit System** — log per segment to generation_log (model_id, provider, cost_to_henry, user_charged, profit, scene_id, segment_number)
- **Model Registry** — provider selector reads same MODEL_REGISTRY from registry.js. Only VIDEO models with `supportsImageInput: true` available.

### WHAT NOT TO DO

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

---

## SECTION C — Other deferred / spec-required reads

These specs in `update/` must be read before touching their feature areas. Listed for triage; build order depends on Henry's call.

- **AI Content Creator** — `update/GHS AUTO CONTENT CREATOR/ghm_auto_content_creator_professional_master_plan.md` + magic layer blueprint
- **Children Hybrid Story Planner MVP** — `update/CHILDREN/ghs_children_hybrid_story_planner_read_along_mvp_master_canvas (1).md`
- **Movie Planner advanced** — `update/MOVIE PLANNER/ghs_ai_movie_creator_professional_mvp_plan.md` + scene intelligence
- **Music Video Intelligence** — `update/MUSIC VIDEO Planner/ghs_music_video_intelligence_architecture_clarification.md`
- **Story Bank** — `update/STORY_BANK_MASTER_CANVAS.md` + blueprint
- **Semi-AI Collab Editor full rebuild** — `update/SEMIT AUTO MODE/ghs_semi_ai_collaboration_mode_master_canvas.md`
- **Video Finishing legal safeguards** — `update/Ghs Support Canvas/ghs_support_canvas_video_finishing_legal_safeguards_sound_licensing_narration_and_assembly.md`
- **Master branding + provider caching policy** — `update/BRANDING/ghs_master_branding_provider_caching_policy.md`
- **Legal framework + ToU** — `update/LEGAL/ghs_legal_framework.md`, `TERMS_OF_USE-1.md`

---

## SECTION D — Always-on rules (must consult before any debug/edit)

- **`update/PROBLEM_AND_FIX.md`** — log of every fixed bug + root cause + fix. CHECK FIRST when symptoms reappear.
- **`FIXES_BEFORE_MIGRATION.md`** — 5 verification tasks blocking Linux migration. All must pass live before server move.
- **`URGENT_INSTRUCTIONS.md`** — 8-step audio pipeline test (Check Audio → Screenplay → Parser → Parse → Narration → Music → Audio Plan → Assemble).
- **`update/uncomplete.md`** — running task log. Append every completed task + leave open ones marked `[ ]`.
- **GHS branding** — never expose Claude/GPT/Ollama/Grok names to user. Only GHS Standard/Pro/Premium/Best.
