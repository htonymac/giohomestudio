# Commercial Planner (Slide Ad Builder) — Fix Plan (2026-06-19, Henry-requested, 5-Sonnet audit)

**Rule: improve, DO NOT break. Additive. Browser-verify free (no FAL/LLM spend beyond minimum).**

## Henry's asks
1. CENTER board: show ALL slide images cascaded/stacked, ACTIVE slide floated to front (left boxes + right config stay).
2. AI must give an **exotic marketing review** of the image (current AI output is generic/random).
3. New **Rotate** button.
4. **TTS: Edge + ElevenLabs not connected — only Piper. Fix.**
5. Audit ALL buttons + pipes (5 Sonnets) — done below.

## Audit findings + fixes

### A. CENTER cascade + Rotate (audit: center board)
- Data: `project.slides[]` each `imagePath` (ABSOLUTE path); active = `selectedId` (page.tsx:785); `selectedSlide` derived (896). Center renders ONLY selectedSlide at `page.tsx:1476–1511` via `<img src="/api/media/file?path=<abs>">`.
- FIX cascade: replace 1476–1511 — map ALL `project.slides`, render each `imagePath` as an absolutely-positioned stacked layer (same previewStyle dims, horizontal offset per index), `selectedId` one gets high z-index + scale(1.06) + glow + on top; others scaled/dimmed; click a layer → `setSelectedId(s.id)`. Keep CaptionPreview on the active layer only.
- FIX Rotate: new `POST /api/commercial/projects/[id]/slides/[slideId]/rotate` (ffmpeg `transpose=1`, EXIF-strip like image route) → re-writes imagePath; button after Upload (page.tsx:1519). OR client-cycle "rotate which slide is floated" — Henry's sketch = rotate the floated image, so an IMAGE rotate endpoint.

### B. TTS / narration (PRIORITY — "Edge + ElevenLabs not connected, only Piper")
- ROOT (audit config): NarrationControls + NarrationPanel(ElevenLabs) + Piper voice picker selections are UI-state ONLY — never persisted to project nor sent to render. Render reads `project.voiceId` from DB → UI choices ignored → only default (Piper) runs. (page.tsx:812/815/817, 2010-2016, 2742-2800; render sends no body.)
- FIX: persist voice/provider + narration settings to project (patchProject voiceId + a narrationSettings field), and have the render endpoint READ + pass them to the TTS call. (Confirm /api/tts provider chain + Edge impl via pending TTS audit.)
- PENDING: TTS-pipeline audit (a51f5da6) — /api/tts chain, whether Edge TTS is even implemented, ElevenLabs key/call, why chain stops at Piper.

### C. AI "exotic marketing review" + AI quality (audit: AI flows)
- ONLY `read-image` uses real VISION (strongest prompt in codebase) → specific output. Add an **exotic marketing REVIEW** output (vision-based, like read-image) shown on the center board for the active image: critique for marketing (what sells, hook strength, suggested angle) — not just caption/narration.
- enhance-narration "AI Order" CLAIMS to read all images but server IGNORES `imageUrls` payload (page.tsx:2603 sends, route never reads) → behaves like plain enhance. FIX: accept imageUrls, fetch+base64, add as vision content.
- analyze: no vision (filenames only) → generic. build-slides: timestamp filenames → generic. AI Generate Image: hardcoded "real estate photography" prompt regardless of productType. plan-scenes: fixed 5-scene structure ignores category. FIX: feed vision/productType where missing.

### D. Broken image buttons (audit: center + config)
- AI Generate (page.tsx:1520): dead client `import("@prisma/client")` + sets imagePath:null instead of applying result + hardcoded real-estate prompt. FIX: apply returned image path to slide + remove PrismaClient + productType-aware prompt.
- AssetPicker "image" branch (page.tsx:2938-2953): SAME broken pattern (PrismaClient + imagePath:null). FIX: apply selected asset filePath.
- Transparent PNG (page.tsx:1571): stores `storage/<rel>` but DB/media expect ABSOLUTE. FIX: store absolute path.

### E. Other
- Duplicate route drops raw-SQL columns (captionMaxWords/captionMaxChars/transitionType/transitionDurationSec/globalCaptionPosition/renderQuality). FIX: copy them in duplicate.

### WORKING (do NOT touch)
caption/translate/polish, position, style, font/size/B-I-U, narration text, duration, orientation, add/remove/drag-reorder/AI-order/import, projects nav, transitions, render quality, global caption, read-image (vision).

## R2-flip interaction (LIVE)
read-image + center `/api/media/file` read from disk/abs paths. R2 is flipped — `/api/media/file` already handles r2 (Stage 2a redirect). Commercial slide-image uploads: confirm whether routed to R2 (if so read-image's fs.readFile breaks → route via getStorage). PENDING image-pipe confirm.

### F. Render + music (audit: render/music) — CORE PIPELINE WORKS
Render→Ken-Burns→caption PNG→narration text→LLM polish→voice(ElevenLabs→Piper)→music→ffmpeg merge→ContentItem→poll→display = FULLY WIRED + functional. Uploaded music + stock library work.
COMMERCIAL VOICE PATH = `render/route.ts:262–296` (its OWN ElevenLabs-if-ELEVENLABS_API_KEY-else-Piper) — does NOT use /api/tts. So:
- "only Piper" root cause = (a) ELEVENLABS_API_KEY likely NOT set on server (render tries ElevenLabs→key missing→Piper) [Henry credential], AND (b) the UI Sound Model Selector (5-tier piper_free/piper_extended/ghs_karaoke/elevenlabs/gemini) + NarrationPanel + Piper-picker are COSMETIC (never sent to render — page.tsx:845/815/817/793/2833).
- "Edge TTS not connected" = Edge is NOT in the render voice path AT ALL. Edge-tts is FREE (no key) → add it as a tier (between Piper and ElevenLabs).
- FIX TTS: (1) wire Sound Model Selector + voiceId + narration settings into handleRender's patchProject + render reads them + picks the engine accordingly; (2) add Edge TTS engine to the render voice path (free); (3) ELEVENLABS_API_KEY on server = Henry credential (park if needed).
OTHER render gaps: SFX Picker = console.log stub (page.tsx:2920, render accepts sfxPaths but never populated) → wire or hide. Asset Picker→music: patchProject({musicPath}) but `musicPath` NOT in PATCH updateSchema (.strict) → silent 400 (page.tsx:2956, route.ts:10-36) → FIX: add musicPath to updateSchema.

### TTS dedicated audit (a51f5da6) — DONE. CORRECTIONS:
- `ELEVENLABS_API_KEY` IS set in .env (so the key exists). `/api/tts` route HAS all engines: karaoke(0), **edge-tts(82-152, spawns scripts/edge_tts_word.py)**, gtts(156), FAL voices(205), gemini(236), Piper(253-320), FAL kokoro(329/369), ElevenLabs(405, needs key+FLAG_ELEVENLABS_VOICES), SAPI, placeholder.
- "only Piper" REAL root cause: the UI soundTier/voice selection is NEVER forwarded — `handleRender()` (page.tsx:1244) POSTs with NO body; render runs its OWN hardcoded ElevenLabs→Piper (render/route.ts:263-267). ElevenLabs key present → should run; if it falls to Piper it's a SILENT ElevenLabs failure (401/quota) — render swallows it. Slide preview uses /api/voices/piper-preview (Piper only). NarrationControls never fetches audio.
- Edge-tts: implemented in /api/tts but NO UI sends provider:"edge-tts"; scripts/edge_tts_word.py exists but `edge-tts` pip pkg may be missing on server (Python 3.13). Edge = FREE.
- TTS FIX (best): wire soundTier → handleRender body → render branches on engine (or render calls /api/tts with the chosen provider so ALL engines incl edge work); add explicit ElevenLabs error logging (surface 401/quota instead of silent Piper fallback); add an Edge tier in the UI; `pip install edge-tts` on server (Python 3.13) for the edge engine.

## IMPLEMENTATION ORDER (loop, fresh context per cycle, batch+build-verify+ONE deploy+browser-verify FREE)
P0: (1) CENTER cascade+float (A) + Rotate endpoint+button. (2) TTS: add free Edge engine to render voice path + wire Sound Model Selector/voice into render (F/B). (3) exotic AI marketing review (vision) on center active image (C) + fix enhance-narration imageUrls (C).
P1: broken image buttons — AI Generate + AssetPicker image + Transparent PNG (D); music asset-picker updateSchema + SFX stub (F).
P2: AI quality (analyze/build-slides vision, plan-scenes category, AI-Generate prompt) (C); duplicate columns (E).
Henry credentials (park): ELEVENLABS_API_KEY on server (for ElevenLabs tier).

## Then → AI Ad Creator (next section, same treatment) per Henry.
