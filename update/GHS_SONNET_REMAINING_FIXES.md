# GHS — Remaining Fixes from Sonnet 40-Item Session

**Status:** Planning only — actionable instructions, do not implement until triggered.
**Context:** Sonnet addressed 21 of 32 items in the ad-editor / video-tools overhaul. This document captures the remaining 11 items (6 partial + 5 not done) with concrete fix instructions.
**Author:** Opus architect · Date: 2026-04-19

---

## Summary of remaining work

**🟡 PARTIAL (6 items)**
- Video Editor pipeline — framework exists but captions/animation/text-overlay wiring not end-to-end
- Video Tools (timeline view) — routes exist but UI integration unverified
- Video Trimmer — routes exist but bg-changer and object-removal UI missing
- Two duplicate items in the list related to video tools (items 29-30)

**❌ NOT DONE (5 items)**
1. Model selector dropdown in Ad Editor (item 9)
2. Clarification AI flow (item 10)
3. AI model name label on generated images (items 7 & 31)
4. CSS — blue text on dark blue backgrounds (item 32)
5. Duplicate: model name visibility across tools (item 38)

---

## Fix 1 — Model selector dropdown in Ad Editor (item 9)

**Where:** `app/dashboard/ad-editor/page.tsx`

**Problem:** users cannot pick which image model runs. The app calls whatever is default; no way to choose Flux, Pruna, Ideogram Transparent, etc.

**Fix:**
1. Read model list from the new `/api/settings/models` endpoint (already built in Phase 1 Finance)
2. Add a compact dropdown at the top of each AI action button (Edit with AI, Generate Background, Transparent PNG)
3. Default selection comes from `getDefaultImageModel()` — i.e. FAL Flux Schnell for general, Pruna for background generation, Ideogram V3 Transparent for transparent PNG
4. Persist user's last choice per action type in localStorage
5. Pass selected `modelId` in the POST body to `/api/ad-editor/ai-edit`, `/api/ad-editor/ideogram-transparent`, and `/api/generation/image`
6. Server routes must look up the model by id and call the correct gateway

**Acceptance:**
- User sees a dropdown next to each AI action
- Choice persists across refresh
- Choice is visible in the UI after generation (see Fix 3)
- Generation routes to the correct provider based on selection

---

## Fix 2 — Clarification AI flow (item 10)

**Where:** `app/dashboard/ad-editor/page.tsx` + new route `app/api/llm/clarify/route.ts`

**Problem:** when user types "generate digital image" the app blindly calls the image generator. There's no step where an LLM asks "what kind of image? what mood? what subject?"

**Fix:**
1. Create `app/api/llm/clarify/route.ts` — accepts `{ prompt, context: "image" | "video" | "bg" }` and returns `{ clarifications: string[], refinedPrompt: string }`
2. The route calls Haiku (free tier) or GPT-mini (free fallback) — never Opus/Sonnet for this lightweight task
3. In ad-editor, before calling image gen: if prompt length < 15 chars OR is a generic phrase like "generate an image" / "digital image" / "background" — intercept and open a clarification modal
4. Modal shows: original prompt, 3-5 clarifying questions (e.g. "Mood? (calm / energetic / cinematic)", "Subject type?"), and an auto-suggested refined prompt
5. User confirms → refined prompt goes to the image generator

**Acceptance:**
- Short / vague prompts trigger modal
- Detailed prompts (>30 chars or specific) skip modal and generate directly
- Haiku is used for clarification (not paid tier)
- User can override and submit original prompt anyway

---

## Fix 3 — AI model name label on generated images (items 7, 31, 38)

**Where:** Ad Editor, Video Trimmer, Video Tools, Video Finishing, Hybrid Planner scene images, Commercial Planner slides

**Problem:** After generating an image/video, the user cannot see which model produced it. This blocks informed decisions (retry with a better model, cost awareness, etc.)

**Fix:**
1. Every generation API response already returns `provider` and some return `modelId`. Standardize the response:
   ```json
   {
     "outputUrl": "...",
     "modelId": "fal_flux_schnell",
     "provider": "fal",
     "costToHenry": 0.003,
     "creditsSpent": 9
   }
   ```
2. Store `modelId` and `creditsSpent` alongside the asset in DB / local state
3. Render a small chip on every generated image/video:
   ```
   [ 🤖 FAL Flux Schnell · 9 credits ]
   ```
4. The chip is clickable: opens a tooltip with "Regenerate with…" showing other models in the same quality tier
5. The chip is visible in Asset Library cards, content detail page, editor canvas, and preview panels

**Acceptance:**
- Every generated output shows its producing model in the UI
- Chip pattern is consistent across all tools
- Clicking chip opens model picker for regeneration

---

## Fix 4 — CSS blue-on-blue readability (item 32)

**Where:** Audit all `text-blue-*` classes on dark backgrounds across dashboard pages

**Problem:** In several dashboard pages, body text or metadata is styled as `text-blue-300` or `text-blue-400` on dark blue (`bg-slate-900`, `bg-indigo-900/40`) panels. Contrast fails WCAG AA.

**Fix strategy:**
1. Grep for these offending combinations:
   ```
   grep -rn "text-blue-[234]00\|text-indigo-[234]00\|text-cyan-[234]00" app/dashboard/ | grep -v ".bak"
   ```
2. For each: change to `text-white`, `text-gray-200`, or `text-gold-300` depending on role
3. Add a Stylelint rule or CI check (future) that forbids low-contrast combos
4. Test with browser accessibility DevTools — contrast ratio ≥ 4.5:1 for body text, ≥ 3:1 for large text

**Known offenders (from audit):**
- Hybrid Planner — some section headers
- Content Detail page — metadata rows
- Character Voices — field labels
- Ad Editor — some "AI Background" buttons (per user's own screenshot feedback)
- Video Trimmer — step labels

**Acceptance:**
- No dashboard text has a failed WCAG AA contrast check
- All blue-on-dark-blue combos converted to white / light gray / gold

---

## Fix 5 — Video Editor pipeline (item 18)

**Where:** `app/dashboard/video-editor/page.tsx` + related API routes

**Problem:** Framework exists (import + prompt + caption + animation + text-overlay inputs) but the end-to-end render pipeline isn't wired.

**Fix:**
1. Audit each action button, trace which API route it calls
2. Missing: a unified assembly call that takes the imported video + user prompt + animations + text overlays and produces the final output
3. Wire an intelligent prompt polish step: user types "make the text bigger and add a zoom effect" → Haiku/GPT polishes into a structured plan → FFmpeg executes
4. Animation types to support in first pass: fade-in, slide-from-side, zoom-in, pulse
5. Text overlay: time-based reveal, font selector (Geist / Arial / Impact for brutalist commercial look)

**Acceptance:**
- User imports video, types natural prompt with text/animation instructions
- AI polishes prompt (show the polished version for user confirmation)
- FFmpeg assembles final video with animations + text
- Output is saved to Asset Library

---

## Fix 6 — Video Tools (timeline view, items 25-31)

**Where:** `app/dashboard/video-tools/page.tsx` + new API routes

**Problem:** The "most profitable section" per Henry — still largely empty. Needs a full layered timeline editor.

**Fix plan (multi-session):**
1. Timeline component — horizontal scrollable track view, sections by scene boundaries
2. Per-section actions: text overlay (with bar + timestamp control), background change, object removal
3. Integrations:
   - Image bg remove: Bria RMBG 2.0 via FAL (`fal-ai/bria-rmbg`)
   - Video bg remove: VEED via FAL (`fal-ai/video-background-removal`)
   - Object removal: research FAL's video object removal models — current candidates: `fal-ai/video-object-remover` or similar
   - Motion transfer: FAL has `fal-ai/motion-transfer` — integrate
4. AI suggestions panel: analyzes video, suggests "this scene has noisy background — change it?", "this object blocks the subject — remove it?"
5. All via the fallback ladder (auto-switch if provider fails)

**Scope note:** This is a big feature — 2-4 sessions minimum. Start with 1 capability at a time: first bg-change, ship, then object-removal, ship, etc.

**Acceptance:**
- Timeline view shows scene sections
- User can change background per section
- User can remove objects per section
- AI suggestions visible and actionable
- Results save to Asset Library

---

## Fix 7 — Video Trimmer (items 32-40)

**Where:** `app/dashboard/video-trimmer/page.tsx` + routes

**Problem:** Basic upload → analyze → execute works, but missing bg-changer, object removal, prompt polish, model name display.

**Fix:**
1. Add Bria RMBG 2.0 action — integrates with existing trim flow as a post-processing step
2. Add VEED video bg-removal action — same pattern
3. Add prompt-polish using Haiku (route through the tier router already in place)
4. Add background-changer-by-prompt: user says "make the background a beach at sunset" → AI plans → VEED removes bg → Flux generates new bg → FFmpeg composites
5. Add object removal step
6. Show AI model name on every processed clip (see Fix 3)

**Acceptance:**
- All actions above visible as buttons in the trimmer UI
- Each shows the AI model that will run
- Silent fallback when provider fails (per auto-switch ladder)

---

## Implementation order (priority)

| Order | Fix | Effort |
|-------|-----|--------|
| 1 | Fix 4 — CSS blue-on-blue readability | Small, quick win across all pages |
| 2 | Fix 3 — AI model name label on outputs | Small-medium, high visibility |
| 3 | Fix 1 — Model selector in Ad Editor | Medium, unlocks user control |
| 4 | Fix 2 — Clarification AI flow | Medium, improves prompt quality |
| 5 | Fix 5 — Video Editor pipeline wiring | Large, core feature |
| 6 | Fix 7 — Video Trimmer enhancements | Medium |
| 7 | Fix 6 — Video Tools timeline | Largest, highest revenue potential — split into 4+ sessions |

---

## Relationship to other plans

- Do **Fix 4** before CSS v13 integration (Phase C of theme plan) — else rewrites lose the accessibility gains
- **Fix 3** depends on credit system (Phase 2 of payment plan) — it displays `creditsSpent` which needs the DB layer; can ship with placeholder "— credits" until then
- **Fix 6** (Video Tools) is the **highest profitability** area per Henry — prioritize after Phase 2 payment plan is live so every action is already charge-aware
