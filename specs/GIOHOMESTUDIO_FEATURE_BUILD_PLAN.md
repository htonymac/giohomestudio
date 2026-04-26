# GIOHOMESTUDIO — MASTER FEATURE BUILD PLAN
# Written by: Claude Code — 2026-04-04
# Purpose: Recovery reference. If anything breaks or gets confused, read this first.
# DO NOT start coding any feature without reading the matching SP-00X spec file.

---

## WHAT THIS DOCUMENT IS

This is the master control document for the next three major features being added
to GioHomeStudio. It tells you:
- What each feature is (plain English)
- The exact build order and why
- Which files in the codebase each feature touches
- What must NOT be changed
- Where to find the detailed spec for each feature

If a session crashes, the context window fills, or something goes wrong mid-build —
stop, come back to this document, read the matching spec, and resume from the
last confirmed checkpoint.

---

## THE THREE FEATURES (in build order)

| Priority | Spec File | Feature Name | Benefit |
|----------|-----------|--------------|---------|
| 1 (BUILD FIRST) | SP-002 | African English Narration Accent System | Every video benefits immediately. Nigerian/Ghanaian/South African voices. |
| 2 (BUILD SECOND) | SP-003 | Animated Text & Image Overlay System | Visual impact. Text and images animate on top of video. |
| 3 (BUILD THIRD) | SP-004 | AI Video Trimmer (Intelligent Cut) | New standalone section. Most complex. Build after pipeline is solid. |

Build one feature completely before starting the next.
Test on localhost before moving on.
Never push to any remote without Henry reviewing the result.

---

## CURRENT CODEBASE STATE (as of 2026-04-04)

### Dashboard pages that already exist (DO NOT REPLACE):
- `/dashboard` — Studio / Free Mode
- `/dashboard/commercial` — Commercial Maker (Mode 1 manual + Mode 2 AI builder)
- `/dashboard/video-tools` — Simple trim (start/end seconds) + Add Narration
- `/dashboard/review` — Review Queue
- `/dashboard/registry` — Content Registry
- `/dashboard/character-voices` — Voice Registry
- `/dashboard/sfx-library` — SFX Library
- `/dashboard/destination-pages` — Destination Pages
- `/dashboard/studio-updates` — Studio Updates
- `/dashboard/settings` — LLM Settings

### API routes that already exist (DO NOT REPLACE):
- `/api/pipeline` — Free Mode generation
- `/api/supervisor` — Orchestration plan
- `/api/voices` — ElevenLabs voice list
- `/api/commercial/projects/*` — Full commercial CRUD
- `/api/video-tools/trim` — Simple time-based trim
- `/api/video-tools/narrate` — Add narration to video
- `/api/character-voices/*` — Character voice registry
- `/api/sfx/*` — SFX library
- `/api/comfyui/status` — ComfyUI health check
- `/api/llm/*` — LLM status and settings

### Key modules that already exist (DO NOT REWRITE — only EXTEND):
- `src/modules/ffmpeg/index.ts` — FFmpeg merge, slideshow, trim, concatenate
- `src/modules/voice-provider/elevenlabs/index.ts` — ElevenLabs TTS (no Voice Design yet)
- `src/modules/voice-provider/mock/index.ts` — Mock voice fallback
- `src/modules/content-registry/index.ts` — ContentItem CRUD
- `src/modules/supervisor/index.ts` — Orchestration + continuation suggestions
- `src/modules/music-provider/` — Music resolution
- `src/modules/comfyui/index.ts` — ComfyUI image generation

### Key state that already exists in the Studio page:
- `voiceId` — ElevenLabs voice ID
- `voiceLanguage` — currently a free text field (used as language tag)
- No accent/locale/delivery controls exist yet — Feature 3 adds them

---

## FEATURE 3 TOUCHES THESE FILES (summary — see SP-002 for full detail)

### NEW files to create:
- `src/modules/voice-provider/elevenlabs/voice-design.ts` — Voice Design API
- `src/modules/voice-provider/accent-profiles.ts` — All accent prompt data
- `app/api/voice-design/preview/route.ts` — Preview endpoint
- `app/api/voice-design/generate/route.ts` — Generate and save voice design
- `app/components/NarrationPanel.tsx` — 11-line narration settings panel (shared)

### Files to MODIFY (extend, not replace):
- `app/dashboard/page.tsx` — Add NarrationPanel component
- `app/dashboard/commercial/page.tsx` — Add NarrationPanel component
- `src/modules/voice-provider/elevenlabs/index.ts` — Import voice design functions
- `prisma/schema.prisma` — Add narration locale/accent fields to ContentItem

### Files that must NOT be touched:
- `.env` and `.env.local`
- Any auth files
- Any existing working API routes (extend only, no replacement)

---

## FEATURE 1 TOUCHES THESE FILES (summary — see SP-003 for full detail)

### NEW files to create:
- `src/modules/ffmpeg/overlay.ts` — FFmpeg overlay filter builder
- `app/api/overlays/preview/route.ts` — 3-second preview render
- `app/api/overlays/render/route.ts` — Full render with overlays
- `app/components/OverlayPanel.tsx` — Collapsible overlay editor panel

### Files to MODIFY:
- `app/dashboard/content/[id]/page.tsx` — Add OverlayPanel to content detail
- `app/dashboard/commercial/page.tsx` — Add OverlayPanel to commercial editor
- `prisma/schema.prisma` — Add overlayLayers JSON field to ContentItem

### Files that must NOT be touched:
- Existing FFmpeg functions (add to the module, never overwrite)
- Commercial slide structure
- Review flow

---

## FEATURE 2 TOUCHES THESE FILES (summary — see SP-004 for full detail)

### NEW files to create:
- `app/dashboard/video-trimmer/page.tsx` — New dashboard section (NOT replacing video-tools)
- `app/api/video-trimmer/upload/route.ts` — Upload + metadata extraction
- `app/api/video-trimmer/analyse/route.ts` — AI analysis → trim plan
- `app/api/video-trimmer/execute/route.ts` — FFmpeg execution of approved plan
- `src/modules/ffmpeg/trim-plan.ts` — Multi-segment trim execution
- `app/components/Sidebar.tsx` — Add "Video Trimmer" nav entry

### Files to MODIFY:
- `app/components/Sidebar.tsx` — Add nav entry only

### Files that must NOT be touched:
- `app/dashboard/video-tools/` — Keep simple trim as-is, never replace
- `app/api/video-tools/` — Keep as-is

---

## GLOBAL RULES (apply to all three features)

1. NEVER replace an existing working feature — only add alongside it
2. NEVER touch .env files
3. NEVER auto-push to GitHub — Henry reviews on localhost first
4. ALWAYS test on localhost before calling a feature complete
5. Build one feature at a time — do not mix Feature 1 and Feature 2 work
6. If a new Prisma field is needed, run `npx prisma migrate dev` after schema change
7. The app runs on port 3200 — always verify on http://localhost:3200
8. After every coding session, run /simplify to check for quality issues
9. Run Playwright tests after each feature: `npx playwright test`

---

## HOW TO RESUME FROM A CRASH OR CONTEXT LOSS

1. Read THIS file (GIOHOMESTUDIO_FEATURE_BUILD_PLAN.md) first
2. Read the spec file for the feature in progress (SP-002, SP-003, or SP-004)
3. Check git status to see what files were changed in the last session
4. Check the Quality Gates checklist in the spec — find the last unchecked box
5. Resume from that checkpoint
6. Do NOT restart from scratch — always build on what was already done

---

## SPEC FILE LOCATIONS

| File | Contents |
|------|----------|
| `specs/GIOHOMESTUDIO_FEATURE_BUILD_PLAN.md` | THIS FILE — master reference |
| `specs/SP-002_AFRICAN_NARRATION_ACCENTS.md` | Feature 3 full spec (build first) |
| `specs/SP-003_ANIMATED_TEXT_IMAGE_OVERLAYS.md` | Feature 1 full spec (build second) — CREATED |
| `specs/SP-004_AI_VIDEO_TRIMMER.md` | Feature 2 full spec (build third) — CREATED |
| `specs/FEATURE_SPEC_001.md` | Henry's original product spec (source of truth) |
| `specs/gio_home_studio_manual_mode_trim_narration_addendum.md` | Henry's addendum (locale rules, manual editor detail) |

---
