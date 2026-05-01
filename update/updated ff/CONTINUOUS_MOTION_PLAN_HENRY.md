# GIOHOMESTUDIO — CONTINUOUS MOTION PLAN
# For: Henry (plain English)
# Pair with: CONTINUOUS_MOTION_SPEC.md (Claude Code version)
# ================================================================

## WHAT THIS IS

AI video models can only generate 5-10 seconds at a time.
But real scenes — a man running, jumping off a cliff, falling
into water while lightning strikes — are 15 to 30 seconds long.

If you generate three separate 5-second clips independently,
each one looks completely different. The character changes.
The camera angle changes. The lighting changes. It looks broken.

Continuous Motion fixes this. It makes GioHomeStudio generate
long scenes that look like one unbroken shot by chaining each
clip to the one before it.

---

## HOW IT WORKS — PLAIN ENGLISH

Imagine filming with a real camera. You film 5 seconds,
pause, then continue filming from exactly where you stopped.
The result looks like one continuous shot because the starting
point of each clip matches the end of the previous one.

That is exactly what GioHomeStudio does with AI:

```
Step 1: Generate the first 5 seconds of the scene
Step 2: Take a screenshot of the very last frame
Step 3: Feed that screenshot to the AI as the starting point
Step 4: Generate the next 5 seconds from that exact frame
Step 5: Repeat until the full scene is done
Step 6: Join all clips together with FFmpeg (free)
```

The user never sees any of this. They write their story,
enable Continuous Motion, and press Generate.
GioHomeStudio handles everything automatically.

---

## WHAT THE USER SEES

### Before Generation
```
Scene: Cliff Jump Sequence
Duration: 27 seconds
Continuous Motion: ✓ ON
Provider: Kling 2.5 Standard
Estimated Cost: $1.89

[Generate Continuous Scene]
```

### During Generation
```
Scene: Cliff Jump — 27 seconds

Segment 1: Running to cliff          0-5s    ✅ Done
Segment 2: Jumping off cliff         5-10s   ✅ Done
Segment 3: Falling through air       10-15s  ⏳ Generating...
Segment 4: Falling toward water      15-20s  ⏸ Waiting
Segment 5: Hitting water, splash     20-25s  ⏸ Waiting
Segment 6: Lightning, aftermath      25-27s  ⏸ Waiting

Progress: ██████░░░░░░░░░ 2/6 segments
```

### After Generation
The final 27-second video appears as one continuous scene
in the Review Queue. The user reviews it, approves it,
then adds audio from the Music Studio.

---

## WHY MOTION SPLITTING IS DIFFERENT FROM SENTENCE SPLITTING

If the user writes:
"He ran and jumped over the cliff, falling fast toward
the water below. Lightning struck the sky."

Wrong way to split (by sentence):
- Clip 1: "He ran and jumped over the cliff"
- Clip 2: "falling fast toward the water below"
- Clip 3: "Lightning struck the sky"

Right way to split (by motion):
- Clip 1: Running toward the cliff edge (0-5 sec)
- Clip 2: Jumping off the cliff (5-10 sec)
- Clip 3: Falling through the air (10-15 sec)
- Clip 4: Hitting water with splash (15-20 sec)
- Clip 5: Lightning and aftermath (20-25 sec)

The AI splits by physical movement, not by punctuation.
This keeps the action flowing naturally.

---

## WHICH PROVIDERS WORK WITH THIS

Every provider that supports image-to-video works.
That is all the major ones.

| Provider | Continuation Method | Quality | Cost |
|---|---|---|---|
| Kling 2.5 Standard | Image-to-video + extend | Best | $0.07/sec |
| Kling 3.0 Pro | Image-to-video + extend | Best | $0.07/sec |
| Wan 2.2 (via fal) | Image-to-video | Good | $0.07/sec |
| Hailuo/MiniMax | Image-to-video | Good | $0.49/clip |
| Runway Gen-4 | Image-to-video + extend | Very Good | $0.10/sec |
| Veo 3.1 | Image-to-video | Very Good | $0.15/sec |
| Seedance 2.0 | Image-to-video | Very Good | $0.10/sec |

All are accessed through your single fal.ai API key.
The system is built so you can switch providers per
scene (but not mid-scene — see rules below).

---

## IMPORTANT RULES

### Rule 1 — One Provider Per Scene
When Continuous Motion is on, the user picks one provider
for the entire scene. They cannot switch mid-scene because
different providers produce different visual styles.
Switching would break the character's appearance and lighting.

### Rule 2 — Visual First, Audio Second
Do not attach music, narration, or sound effects until
ALL visual segments are merged and the final scene is stable.
If a segment fails and needs regeneration, any audio attached
earlier would be wasted work.

### Rule 3 — Cost Shows Before Starting
The system calculates total cost before generation begins:
Provider cost per second × total duration = estimated cost.
User confirms before the pipeline starts.
Credit is deducted per segment as each completes — not all at once.

### Rule 4 — Failure Does Not Restart Everything
If segment 4 out of 6 fails, only segment 4 is retried.
Segments 1, 2, and 3 are already done and their clips
are preserved. The user never loses completed work.

---

## HOW THIS CONNECTS TO THE REST OF GIOHOMESTUDIO

```
Story Tab
  User writes the long action description
  ↓
Scene Planner
  User enables Continuous Motion
  Selects provider and duration
  ↓
Motion Unit Planner (automatic)
  AI splits story into motion beats
  ↓
Continuity Engine (automatic)
  Generates segment 1
  Extracts last frame
  Generates segment 2 from that frame
  Repeats for all segments
  ↓
Assembly
  FFmpeg merges all clips into one scene
  ↓
Music Studio — Audio-Video Sync Tool
  User attaches music, narration, SFX
  ↓
Review Queue
  Final scene with audio reviewed
  ↓
Publish
  Approved → Facebook / YouTube / TikTok
```

---

## WHAT 5 THINGS MUST STAY CONSISTENT

For the continuous scene to look real, these five things
must remain the same across all segments:

1. CHARACTER — Same face, clothing, body, appearance
2. CAMERA — Same angle, distance, lens feel
3. LIGHTING — Same mood, time of day, shadows
4. MOTION DIRECTION — If running forward, keep running forward
5. SEED — Same random seed keeps the visual style locked

The system handles all five automatically by:
- Passing the previous last frame as the starting image
- Including character and camera descriptions in every prompt
- Using the same seed value for every segment
- Adding "Continue:" prefix to every continuation prompt

---

## WHAT THIS COSTS

### Example — 27-Second Cliff Jump Scene on Kling 2.5

```
6 segments × 5 seconds each (last segment is 2 sec)
Cost per second: $0.07
Your cost: 27 × $0.07 = $1.89
Charge user: 27 × $0.45 = $12.15
Your profit: $10.26

Plus FFmpeg assembly: $0 (runs on your server)
Plus anchor extraction: $0 (FFmpeg, free)
```

### Example — Same Scene on Wan (cheaper)

```
Your cost: 27 × $0.07 = $1.89
Charge user: 27 × $0.45 = $12.15
Same profit — Wan is same price as Kling for this
```

### Example — Same Scene on Veo 3.1 with Audio (premium)

```
Your cost: 27 × $0.40 = $10.80
Charge user: 27 × $1.20 = $32.40
Your profit: $21.60
Includes native audio — no separate audio step needed
```

---

## WHY THIS MATTERS FOR GIOHOMESTUDIO

No competitor in the Nigerian content creator market offers
automatic scene continuation. CapCut does not do this.
InVideo does not do this. Canva does not do this.

A Mara Tales TV episode with 10 continuous action scenes,
each 15-20 seconds long, can be produced inside GioHomeStudio
without any video editing software, any camera, or any studio.

This is the feature that makes GioHomeStudio a real
production platform — not just a clip generator.

---

## WHEN TO BUILD THIS

This is Phase 2. Build it AFTER:
- Core image generation (Phase 1) ✅
- Core video generation (Phase 1)
- Model selection and credit system (Phase 1)
- Music Studio basics (Phase 1)

Continuous Motion depends on having a working video generation
pipeline first. The continuity engine sits on top of that
pipeline — it does not replace it.

---

## SUMMARY

```
What:      Automatic long-scene generation with no visible breaks
How:       Last frame of each clip becomes starting image for next clip
Provider:  Any provider with image-to-video (all major ones)
Key tool:  FFmpeg for frame extraction and clip assembly (free)
User sees: One button — "Generate Continuous Scene"
System does: Segment, generate, extract, chain, assemble — all automatic
Cost:      Same per-second rate as normal video — no premium
Phase:     Phase 2 — after core video pipeline is stable
```
