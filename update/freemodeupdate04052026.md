# Free Mode Update — 2026-05-04
## REVISED v2 — corrections from Henry review

Session recorded by Claude (Sonnet 4.6). No code changes made yet — advice + plan only.

---

## CORRECTIONS to v1 (what I got wrong)

### CORRECTION 1 — Text-to-video / Image-to-video / Motion buttons
**WRONG (v1):** I said these were "likely removed during cleanup" and needed to be restored.
**RIGHT:** These buttons ARE there / should stay exactly as they were. The only thing missing is that all available AI models are not attached to them as options. Fix = add model selector to each button, not rebuild the buttons. Do NOT change the flow.

### CORRECTION 2 — SFX classification should be HIDDEN (automatic)
**WRONG (v1):** I said "show SFX/ambience tags on scene cards so user can see what's matched."
**RIGHT:** Scene classification (mood, ambience, movement, SFX) runs hidden/automatic as designed. User doesn't see classification tags — the system just ACTS on them silently. The bug is that it TALKS about SFX (shows "Match SFX from scene mood") but doesn't actually execute it. Fix = make it work silently, not surface more UI tags.

### CORRECTION 3 — Intro/outro review location
**WRONG (v1):** I said add collapsible card INSIDE the chat message stream.
**RIGHT:** After character / intro / outro is added, show it in a SEPARATE collapsible review box — NOT in the chat thread. This review box sits outside the chat area (e.g., above the input bar), is collapsible/dismissible, and does NOT reduce chat workspace. User clicks to expand and review/edit, collapses it to get full chat space back.

### CORRECTION 4 — Auto intro + audio
**MISSED in v1:** Henry asked to "add auto intro and audio that works with this current input". This means: AI should auto-generate an intro clip/audio based on what the user is building in the chat — not a manual panel. When user types a topic and scenes are generated, AI auto-suggests an intro ("GioHomeStudio presents: [topic title]") that can be accepted or edited. Generates audio for it automatically.

### CORRECTION 5 — Import image from library broken
**MISSED in v1:** The "import image from library" feature (pick an existing image from asset library to use as reference for scene generation or image-to-video) is broken. This is separate from creating a character — it's direct image import.

### CORRECTION 6 — Polish button missing
**MISSED in v1:** Henry explicitly said "add polish button". A polish button should appear:
- On each AI-generated scene card: click "Polish" → AI rewrites that scene description with stronger language, better cinematic detail, same core idea preserved
- On the chat input: a "Polish prompt" button that refines what the user typed before sending
- This matches the per-scene polish already in hybrid-planner (`/api/hybrid/scene-polish`)

---

## 1. Confirmed Bugs

### BUG-FM-01 — Add Character "Create" button unwired (Image #11)
**Root cause:** `createCharacter()` at L655 calls `POST /api/character` — silent `catch { /* ignore */ }` eats errors. If route returns 404/500, button appears dead. Also: code shows a right-side drawer but screenshot shows centred modal — possible second unwired copy of the UI.
**Fix:**
- Verify `/api/character` route exists and returns `{ character: { id, name, ... } }`
- Replace `catch { /* ignore */ }` with `catch(e) { setError(e.message) }`
- After success: character auto-selected and visible in tray immediately

---

### BUG-FM-02 — Hybrid Video stuck + "projectId required" (Image #12)
**Root cause:** `HybridModal` calls `/api/hybrid/assemble` without `projectId`. Route 400s. Also: selected character `imageUrl`s not passed to scene image generation → cartoon output.
**Fix:**
- Add `projectId: \`free_\${Date.now()}\`` to HybridModal fetch payload
- Fetch character data for `selectedCharIds` from `/api/character-voices` before running scenes
- Pass character visualDescription + referenceImageUrl to each scene image prompt (same as hybrid character-resolver)
- Pass `imageModel` from user's selected model (or default `fal_flux_schnell`)
- Do NOT change the step pipeline flow — fix what's passed in, not how steps run

---

### BUG-FM-03 — SFX stopped working
**Root cause:** `HybridModal` sends `addSfx: true` to `/api/hybrid/assemble` but assemble route no longer forwards this correctly after prior refactors.
**Fix:** Trace `addSfx` flag through `/api/hybrid/assemble/route.ts` → SFX pipeline. Fix forwarding. If SFX route fails, continue silently (no user-visible error needed — SFX is enhancement, not blocker).

---

### BUG-FM-04 — Chat history blank on reload (Image #13)
**Root cause:** Session restore (`GET /api/free-mode/session`) fires on mount. If it returns empty or fails, `messages` stays `[]` — blank screen, no placeholder.
**Fix:**
- Add localStorage backup: on every message change, write to `ghs_free_mode_messages` key
- On mount: try API restore first, fall back to localStorage if API returns empty
- If both empty: show "Start a new conversation below ↓" placeholder (not total blank)

---

### BUG-FM-05 — No AI model selector
**Root cause:** All models hardcoded: video=`wan_2_5_lite`, LLM=`claude-haiku-4-5-20251001`, image=`fal_flux_schnell`. No UI to change.
**Fix:** Add collapsible "⚙ Customize" tray (hidden by default, sits above input bar). When expanded shows:
- **AI Brain:** Haiku (fast, free) / Sonnet (smarter) / Ollama (local, private) / GPT-4o Mini
- **Image model:** Segmind Flux (free) / FLUX Dev / Ideogram / Stable Diffusion XL
- **Video model:** Wan Lite / Wan Pro / Kling Lite / Hailuo / Runway
Picks persist for session. Collapsed by default — one click opens, one click closes.

---

### BUG-FM-06 — Text-to-video / Image-to-video / Motion buttons have no model selection
**CLARIFICATION:** These buttons exist (don't remove/rebuild them). They just need model options attached.
**Fix:** When user clicks any of these buttons, show a lightweight model picker inline before firing:
- Text→Video: pick video model (Wan / Kling / Hailuo)
- Image→Video: pick video model + upload image or import from library
- Motion: pick motion model + image source
One-tap "Use default" option skips the picker for users who want fast generation.

---

### BUG-FM-07 — Duration seconds is fixed preset only, no free input
**Fix:** Add `[  ] sec` text input beside the [15s][30s][60s][90s] buttons. Allow 5–300. Clicking a preset fills the input. User can also type any value. Validate: min 5, max 300.

---

### BUG-FM-08 — Import image from library broken
**What it should do:** User clicks an "import from library" option (in the image-to-video button flow or as standalone) → picks an existing image from the asset library → uses it as input for image-to-video or as a scene reference image.
**Fix:** Wire the import picker to `GET /api/media` (or asset library endpoint) → show thumbnail grid → on select, pass the image URL into the generation flow.

---

## 2. Missing Features to Add

### FM-FEAT-01 — Character / Intro / Outro: collapsible review box (outside chat)
After character or intro/outro is added, show a collapsible review bar ABOVE the message input — separate from the chat thread. Shows: character portraits (thumbnails), intro preview, outro preview. User clicks to expand full edit. Collapses to a thin bar so chat workspace is not reduced. NOT inside the message stream.

### FM-FEAT-02 — Audio / SFX / Music model selector
In the "⚙ Customize" tray, add audio section:
- **Music tier:** Standard (Piper TTS) / GHS Pro (Karaoke) / GHS Karaoke (FAL) / Classic (Kie.ai) / Premium (Kie+)
- **SFX:** Auto match (default) / ElevenLabs / Local library
- **Voice/narration:** Piper (free) / FAL narrator / ElevenLabs
These drive all generation in the session. Persist until user changes them.

### FM-FEAT-03 — Auto intro + audio from current chat input
When AI generates scenes from user's topic, auto-suggest an intro:
- AI reads the topic/scenes, generates a short intro text: "GioHomeStudio presents: [title]"
- Offers to generate audio for the intro (TTS, using selected voice model)
- User sees: "Intro suggested: [text] — Accept / Edit / Skip"
- Accepted intro feeds into final assembly as opening segment
This is AUTOMATIC based on what user typed — not a manual form.

### FM-FEAT-04 — Polish button on scene cards + input
- Each AI scene card gets a "✨ Polish" button → calls `/api/hybrid/scene-polish` → returns improved text → replaces scene card text (with undo option)
- The chat input bar gets a "Polish prompt ✨" icon button → sends user's typed text through LLM polish before submitting → shows polished version in input → user confirms or reverts
- Same polish endpoint already exists in hybrid-planner — reuse it

### FM-FEAT-05 — Scene generation uses character images (fix cartoon output)
When `selectedCharIds` is populated, every scene image prompt must include character appearance. Fix in `HybridModal`: before running, fetch characters and build prompt prefix: "Featuring [Name]: [visualDescription]" prepended to each scene prompt. Same pattern as `lib/character-resolver.ts`.

---

## 3. What MUST NOT CHANGE

- Chat-first conversation UI — the entire chat thread layout
- Scene classification flow (mood / environment / genre detection) — works, runs hidden
- Scene cards (image + text + action buttons) — layout and behavior preserved
- The 5-step hybrid pipeline order (timings → images → overlays → SFX → assemble)
- The intro/outro panel components — keep them, just ADD the review bar alongside
- Existing character drawer — keep the slide-in drawer, just fix the Create button error handling
- `saveVideoAsset` on every video completion — non-negotiable
- Message history format (messages[] with scenes[] attached to AI reply)
- All existing action buttons in the scene cards
- SFX classification runs hidden — does NOT surface as visible tags in UI

---

## 4. Implementation Order

| Priority | Item | Complexity |
|---|---|---|
| P1 | BUG-FM-02: projectId + character images in HybridModal | Low |
| P1 | BUG-FM-01: Create button error surfacing | Low |
| P1 | BUG-FM-04: chat history localStorage backup + placeholder | Low |
| P2 | BUG-FM-03: SFX forwarding fix in hybrid/assemble | Medium |
| P2 | BUG-FM-06: model picker on existing gen buttons | Medium |
| P2 | BUG-FM-07: free-input seconds field | Low |
| P2 | BUG-FM-08: import image from library | Medium |
| P3 | BUG-FM-05: Customize tray (model selectors) | Medium |
| P3 | FM-FEAT-02: audio/SFX/music in Customize tray | Low (extends P3) |
| P3 | FM-FEAT-04: Polish button on scenes + input | Low |
| P4 | FM-FEAT-01: collapsible review bar for character/intro/outro | Medium |
| P4 | FM-FEAT-03: auto intro suggestion from topic | Medium |

---

## 5. Files to touch

| File | Change |
|---|---|
| `app/dashboard/free-mode/page.tsx` | All UI fixes and feature additions |
| `app/api/character/route.ts` | Verify works, add better error shape |
| `app/api/hybrid/assemble/route.ts` | Make `projectId` optional (auto-generate if missing) + verify SFX forwarding |
| `app/api/hybrid/scene-polish/route.ts` | Reuse existing — just call from free-mode |
| `app/api/free-mode/session/route.ts` | Verify GET returns messages correctly |

---

## 6. Design doctrine (Henry's rules — binding)

- Even a 7-year-old or 90-year-old can build a video in Free Mode — zero jargon exposed
- All AI/model/technical choices hidden by default under "⚙ Customize" — one click
- Collapsible review bar for character/intro/outro — does NOT reduce chat workspace
- Polish button = one click, result shown inline, undo available
- SFX + scene classification = works hidden, not surfaced as visible tags
- Seconds = free input (+ presets), not locked preset-only
- Import from library = part of the image-to-video flow
- Auto intro = AI suggests it automatically, user accepts/edits/skips
- Nothing removed. Everything additive.

---

*v2 — 2026-05-04. Corrections applied after Henry's second review.*
*Next step: Henry confirms, then "thompson go" to implement.*
