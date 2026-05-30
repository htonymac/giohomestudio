# FAL Provider Adapter — Migration Map (2026-05-30)

`src/lib/providers/fal.ts` is the single chokepoint for every fal.run / queue.fal.run
call. When fal changes their endpoint shape, auth scheme, or response field, the fix
is one file instead of 20+.

## Scaffold landed
- `src/lib/providers/fal.ts` — typed `falCall<T>`, `falQueue<T>`, plus helpers
  `falFluxSchnell`, `falFluxDev`, `falKokoroTts`, `falAccountStatus`. Soft-fails to
  a uniform `FalResult<T>` instead of throwing.

## STATUS UPDATE 2026-05-30 (end of session)

**17 of 24 sites now on the adapter.** Every sweep-able route consolidated. Only
the generation/gateways/fal.ts gateway-layer remains, parked for a dedicated
session per the caveat at the bottom of this doc.

| Route | Helper | Commit |
|---|---|---|
| `account/status` | `falAccountStatus()` | `f4104fd` |
| `tts/fal-narrator` | `falKokoroTts({ variant: "american-english" })` | `f4104fd` |
| `ad-editor/ai-edit` (gen) | `falFluxSchnell()` | `f4104fd` |
| `tts/route.ts` (american) | `falKokoroTts({ variant: "american-english" })` | `9b110a9` |
| `tts/route.ts` (global) | `falKokoroTts({ variant: "global" })` | `9b110a9` |
| `avatar/create` | `falKokoroTts(...)` | `9b110a9` |
| `hybrid/narrate-piper` | `falKokoroTts(...)` | `9b110a9` |
| `ad-editor/bg-remove` | `falBgRemove("birefnet")` | `c3ba31b` |
| `image/bg-remove` (bria + birefnet) | `falBgRemove(...)` | `c3ba31b` |
| `video/bg-remove` (birefnet-video + video-bg-remove) | `falBgRemove(...)` | `c3ba31b` |
| `music/generate-scene` | `falMinimaxMusic(...)` | `7d07bd3` |
| `sfx/generate` | `falStableAudio(...)` | `7d07bd3` |
| `character-voices/auto-portraits` | `falFluxDevSync` + `falFluxSchnell` | `7d07bd3` |
| `ad-editor/ai-edit` (img2img) | `falFluxImg2Img(...)` | `223da47` |
| `ad-editor/gemini-tts` | `falGeminiTts(...)` | `223da47` |
| `ad-editor/layerize-text` | `falLayerizeText(...)` | `223da47` |
| `image/enhance` | `falClarityUpscaler(...)` | `223da47` |
| `avatar/lip-sync` (queue+poll) | local `falQueue()` now wraps adapter `falQueue<T>` | `d9ad289` |

## Still on direct-fetch (1 site remains)

### Image gen
- `app/api/character-voices/auto-portraits/route.ts` (FLUX schnell + dev) → use `falFluxSchnell` / `falFluxDev`
- `app/api/ad-editor/ai-edit/route.ts` (image-to-image FLUX dev — second call) → needs new `falFluxImg2Img` helper (~10 min add)
- `app/api/hybrid/scene-image/route.ts` — routes through `src/lib/generation/selectors/image-provider.ts` already; the underlying gateway at `src/lib/generation/gateways/fal.ts` is the right migration target, not the route itself.

### TTS
- `app/api/tts/route.ts` (2 kokoro calls — american + global) → `falKokoroTts({ variant })`
- `app/api/avatar/create/route.ts` (kokoro american) → `falKokoroTts({ variant: "american-english" })`
- `app/api/hybrid/narrate-piper/route.ts` (kokoro + variant logic) → `falKokoroTts({ variant: ... })`

### Editing / background removal / utility
- `app/api/ad-editor/bg-remove/route.ts` (birefnet queue) → new `falBgRemove` helper (~10 min)
- `app/api/image/bg-remove/route.ts` (bria-rmbg + birefnet queue, 2 calls) → `falBgRemove` overload
- `app/api/image/enhance/route.ts` (clarity-upscaler queue) → new `falUpscale` helper
- `app/api/video/bg-remove/route.ts` (birefnet/video + video-background-removal) → new `falVideoBgRemove`
- `app/api/ad-editor/layerize-text/route.ts` (ideogram v3) → new `falLayerizeText`
- `app/api/ad-editor/gemini-tts/route.ts` (gemini-3.1-flash-tts) → new `falGeminiTts`

### Music + SFX
- `app/api/music/generate-scene/route.ts` (minimax-music) → new `falMinimaxMusic`
- `app/api/sfx/generate/route.ts` (stable-audio) → new `falStableAudio`

### Video / avatar
- `app/api/avatar/lip-sync/route.ts` (queue + status + result polling) → migrate using `falQueue<T>`
- `app/api/video/generate/route.ts` (FAL paths, internal to generation gateway) → upstream gateway migration

### Gateway-layer migration (largest single payoff — DEDICATED SESSION REQUIRED)
- `src/lib/generation/gateways/fal.ts` — this is the actual chokepoint for all the
  routes that route through `generateImage()` (scene-image, video-gen, etc.). Migrating
  it to use the adapter consolidates ~10 indirect call paths in one edit.
- **2026-05-30 investigation finding:** the gateway is 474 LOC using `axios` (not fetch),
  with custom `status_url` / `response_url` returned from the submit response (must be
  honored — constructing them from endpoint breaks Kling 1.6, Wan 2.5, etc.), plus an
  `onProgress` callback for queue-position + in-progress percent reporting.
- Adapter would need: (a) axios-compat surface or full fetch rewrite of the gateway,
  (b) `onProgress` parameter on `falQueue<T>`, (c) ability to use response-supplied
  status/result URLs instead of constructing them.
- Recommendation: skip from "sweep" sessions; trigger `go fal gateway focused` for a
  dedicated session that adds the adapter extensions + does the gateway rewrite +
  e2e tests scene-image, video/generate, lip-sync paths before merging. Estimated 2 h.

## Trigger phrases for future sessions
- `go fal migrate gateway` — migrate `src/lib/generation/gateways/fal.ts` (highest blast radius)
- `go fal migrate tts` — sweep the 3 kokoro-using TTS routes (~30 min)
- `go fal migrate ad-editor` — bg-remove + layerize + gemini-tts + img2img helper adds (~1 h)
- `go fal migrate utility` — image/enhance + video/bg-remove + music + sfx (~1 h)
- `go fal migrate all` — everything above in one session (~3 h)
