# SPEC: SP-002 — AFRICAN ENGLISH NARRATION ACCENT SYSTEM
# SPEC ID: SP-002
# FEATURE: African English Narration Accent System (Feature 3 from FEATURE_SPEC_001.md)
# BUILD ORDER: PRIORITY 1 — Build this first
# WRITTEN BY: Claude Code — 2026-04-04
# STATUS: Ready to build — waiting for Henry's GO AHEAD

---

## WHAT THIS FEATURE DOES (plain English)

GioHomeStudio currently uses a generic ElevenLabs voice dropdown.
This feature replaces that with a full narration identity system where Henry can
select Nigerian English (Yoruba, Igbo, Hausa, Standard, or Fluent Polished),
Ghanaian English, South African English, British, or American — and the system
auto-builds a precise linguistic prompt for ElevenLabs Voice Design API that
produces a real accent, not a generic one.

The panel shows in every mode: Studio, Commercial, and Video Tools.
Henry never has to re-select his preferred profile between sessions.

---

## WHAT ALREADY EXISTS (do not rebuild these)

- `src/modules/voice-provider/elevenlabs/index.ts` — TTS generation works
- `app/api/voices/route.ts` — returns 21 ElevenLabs voices
- `app/api/voices/preview/route.ts` — voice preview works
- `app/dashboard/page.tsx` — has `voiceId` and `voiceLanguage` state already
- `src/config/env.ts` — has `elevenlabs.apiKey` and `elevenlabs.baseUrl`

---

## WHAT TO BUILD

### New files to CREATE:

| File | What it contains |
|------|-----------------|
| `src/modules/voice-provider/accent-profiles.ts` | All accent profile data: locale codes, sub-accents, speaker profiles, ElevenLabs prompt templates. This is the single source of truth for all accent data. |
| `src/modules/voice-provider/elevenlabs/voice-design.ts` | Functions to call ElevenLabs Voice Design API and Voice Library search. Exported from elevenlabs module. |
| `app/api/voice-design/preview/route.ts` | POST — accepts accent profile settings, calls Voice Design API, returns 3 audio preview URLs for Henry to audition |
| `app/api/voice-design/generate/route.ts` | POST — accepts chosen preview index + profile settings, saves the voice to Henry's ElevenLabs library, returns voiceId |
| `app/api/voice-design/library-search/route.ts` | GET — searches ElevenLabs Voice Library for Nigerian/Ghanaian/South African voices as fallback |
| `app/components/NarrationPanel.tsx` | The 11-line narration settings UI panel. Shared component used across Studio, Commercial, and Video Tools pages. |

### Files to MODIFY (extend only — never replace):

| File | What changes | What stays the same |
|------|-------------|---------------------|
| `app/dashboard/page.tsx` | Add NarrationPanel component below voice dropdown. Add state fields: `accentLocale`, `accentSubtype`, `deliveryStyle`, `voicePacing`, `voiceEmotion`, `voiceCustomInstruction`. Wire to pipeline submit. | All existing generation logic, output mode controls, casting controls |
| `app/dashboard/commercial/page.tsx` | Add NarrationPanel to the commercial render section | All slide management, Mode 2 AI builder, project CRUD |
| `src/modules/voice-provider/elevenlabs/index.ts` | Import and re-export `voiceDesignPreview` and `searchVoiceLibrary` functions | Existing `generate()` and `listVoices()` |
| `src/core/pipeline.ts` | Pass `accentLocale`, `deliveryStyle` into the voice generation step. Use them to build the ElevenLabs TTS prompt if Voice Design was not used. | Full pipeline orchestration logic |
| `prisma/schema.prisma` | Add to ContentItem: `voiceLocale String?`, `voiceAccentSubtype String?`, `voiceDeliveryStyle String?`, `voiceMatchType String?` | All existing fields |

### Files that must NOT be touched:
- `.env` and `.env.local`
- `app/api/voices/route.ts` (existing voice list — keep working)
- `app/api/voices/preview/route.ts` (existing preview — keep working)
- Any commercial slide logic
- Any FFmpeg logic

---

## ACCENT PROFILES DATA (what goes in accent-profiles.ts)

### Locale codes (stored in state and DB):
```
en-NG-yoruba      Nigerian English — Yoruba-influenced (Lagos, Southwest)
en-NG-igbo        Nigerian English — Igbo-influenced (Southeast)
en-NG-hausa       Nigerian English — Hausa-influenced (Northern)
en-NG-standard    Nigerian English — Standard (Educated, Formal)
en-NG-polished    Nigerian English — Fluent Polished (TV Presenter / Professional)
en-GH-standard    Ghanaian English — Standard
en-GH-accra       Ghanaian English — Accra (Capital, Urban)
en-ZA-johannesburg  South African English — Johannesburg (Urban Black)
en-ZA-capetown    South African English — Cape Town (Western Cape)
en-GB             British English (Standard RP)
en-US             American English (General American)
custom            Custom (user describes in instruction box)
```

### Speaker profiles (applied to all accents):
```
young_man         Young man (18-28)
young_woman       Young woman (18-28)
adult_man         Adult man (35-55)
adult_woman       Adult woman (35-55)
elderly_man       Elderly man (60+)
elderly_woman     Elderly woman (60+)
```

### Delivery styles:
```
formal            Formal
conversational    Conversational
commercial        Commercial
storytelling      Storytelling
news_anchor       News Anchor
```

### Pacing options:
```
slow / normal / fast
```

### Emotion/energy options:
```
calm / warm / energetic / dramatic / authoritative
```

---

## VOICE DESIGN PROMPT TEMPLATES (what goes in accent-profiles.ts)

These are the exact prompts to send to ElevenLabs Voice Design API.
Do not invent new descriptions — use these exactly, then append the user's custom instruction.

### en-NG-yoruba — Adult Man:
"Nigerian male voice, approximately 40 years old. Nigerian English accent with Yoruba language influence. Syllable-timed rhythm where each syllable is clearly pronounced without reduction. Musical, melodic intonation with level tones on most syllables. TH sounds replaced with T and D. Authoritative, professional delivery. Warm resonant tone. Clear vowels, no vowel reduction. Confident pacing."

### en-NG-yoruba — Young Woman:
"Nigerian female voice, approximately 24 years old. Nigerian English accent with Yoruba language influence. Syllable-timed clear pronunciation. Musical intonation, melodic and warm. L and R sometimes mixed in Yoruba fashion. Energetic, expressive. Clear enunciation of all syllables. Friendly confident tone."

### en-NG-igbo — Young Woman:
"Nigerian female voice, approximately 24 years old. Nigerian English accent with Igbo language influence. Syllable-timed clear pronunciation. High pitch on stressed syllables, melodic quality. Energetic warm delivery. Clear enunciation of all syllables. Musical intonation pattern. Friendly, expressive tone."

### en-NG-hausa — Adult Man:
"Nigerian male voice, approximately 42 years old. Nigerian English accent with Hausa language influence from Northern Nigeria. Emphatic consonants. P sounds can carry F-like quality. Stronger consonant stress. Slightly more formal, measured delivery. Syllable-timed rhythm. Authoritative and deliberate."

### en-NG-standard — Adult Man:
"Nigerian male voice, approximately 45 years old. Standard Nigerian English at educated formal register. Syllable-timed rhythm, every syllable clear. Melodic Nigerian intonation, level tones. Unmistakably Nigerian but internationally intelligible. Professional authoritative delivery. Close to what you hear from Nigerian academics and legal professionals."

### en-NG-polished — Adult Man (TV Presenter / Executive):
"Nigerian male voice, approximately 42 years old. Educated Nigerian English at the highest register — fluent, polished, professional. Syllable-timed rhythm where every syllable is clear and fully pronounced, giving a composed even cadence. Musical Nigerian intonation with level tones, controlled and warm. Consonants crisp and clean. Pure open vowels. Authoritative, confident delivery with warmth. The voice of a Nigerian TV presenter or senior executive. Internationally intelligible but unmistakably Nigerian. No Pidgin influence. No heavy dialect features."

### en-NG-polished — Adult Woman (Professional / Presenter):
"Nigerian female voice, approximately 38 years old. Educated Nigerian English — fluent, articulate, poised. Clear syllable-timed rhythm, every syllable given full weight. Warm musical Nigerian intonation, controlled and professional. Pure vowel sounds, open and clear. Precise consonants. The vocal quality of a Nigerian news anchor or corporate professional. Confident, warm, authoritative. Internationally intelligible but distinctly, proudly Nigerian. No heavy regional dialect. No Pidgin. Composed delivery."

### en-GH-standard — Adult Woman:
"Ghanaian female voice, approximately 45 years old. Ghanaian English accent. Formal, deliberate speech pattern. Syllable-timed with emphasis on syllables that British English would not stress. Rising intonation at end of statements. Clear distinction between V and B sounds. Slightly British-influenced vowels. Dignified, warm, professional delivery."

### en-ZA-johannesburg — Adult Man:
"South African male voice, approximately 38 years old. Black South African English accent from Johannesburg. Deep, full warm voice quality produced toward back of mouth. Syllable-timed rhythm with flat, even pitch pattern. Less melodic than West African English. Crisper consonants. Simplified vowel system with vowel mergers. Confident, grounded delivery."

### Prompt construction rule:
For any accent + speaker profile combination not listed above, the system builds the prompt
from the base template for that locale, adjusts the age and gender description, and appends
the user's custom instruction from Line 9 of the panel.

### Known fallback voice IDs (Voice Library search backup):
- "Olufunmilola" — African Female, Nigerian Accent, Yoruba — Voice ID: `9Dbo4hEvXQ5l7MXGZFQA`
- "NZ The African Man - Nigerian Voice Pro" — Voice ID: `gsyHQ9kWCDIipR26RqQ1`

---

## NARRATION PANEL UI — NarrationPanel.tsx

This component is used in Studio page, Commercial page, and Video Tools page.
It is collapsible. Collapsed by default. User clicks header to expand.
When collapsed shows: current accent name + delivery style in one line.
When expanded shows all 11 lines:

```
Line 1:  Narration ON/OFF        [ toggle — default ON ]
Line 2:  Region / Accent         [ dropdown — 12 options listed above ]
Line 3:  Sub-accent              [ dropdown — changes based on Line 2 ]
Line 4:  Speaker gender          [ Male / Female — radio buttons ]
Line 5:  Speaker age             [ Young (18-28) / Adult (30-55) / Elderly (60+) ]
Line 6:  Delivery style          [ Formal / Conversational / Commercial / Storytelling / News Anchor ]
Line 7:  Pacing                  [ Slow / Normal / Fast ]
Line 8:  Emotion / energy        [ Calm / Warm / Energetic / Dramatic / Authoritative ]
Line 9:  Custom instruction      [ open textarea — appended to prompt ]
Line 10: Voice preview           [ PREVIEW VOICE button — generates 5-second test audio ]
Line 11: Voice source            [ Auto-generate (Voice Design) / Search Library / Use Selected Voice ID ]
```

Sub-accent options per region:
- en-NG: Yoruba-influenced / Igbo-influenced / Hausa-influenced / Standard / Fluent Polished
- en-GH: Standard / Accra (Urban)
- en-ZA: Johannesburg (Urban Black) / Cape Town (Western Cape)
- en-GB, en-US, custom: no sub-accent (sub-accent row hidden)

Match status badge (shown after preview):
- "Exact locale match" — Voice Design produced accent correctly
- "Close regional match" — nearest available
- "Library voice" — using pre-made voice from library
- "Generic fallback" — Voice Design unavailable, using default voice

---

## API ROUTES

### POST /api/voice-design/preview
Input:
```json
{
  "locale": "en-NG-polished",
  "speakerProfile": "adult_man",
  "deliveryStyle": "commercial",
  "pacing": "normal",
  "emotion": "authoritative",
  "customInstruction": "optional extra direction"
}
```
Process:
1. Look up accent profile in accent-profiles.ts
2. Build ElevenLabs Voice Design prompt from profile + speaker + delivery + custom instruction
3. Call ElevenLabs Voice Design API — POST `/v1/text-to-voice/create-previews`
4. Returns 3 audio preview URLs
Output:
```json
{
  "previews": [
    { "previewId": "abc123", "audioUrl": "...", "label": "Variation 1" },
    { "previewId": "def456", "audioUrl": "...", "label": "Variation 2" },
    { "previewId": "ghi789", "audioUrl": "...", "label": "Variation 3" }
  ],
  "promptUsed": "...",
  "locale": "en-NG-polished"
}
```

### POST /api/voice-design/generate
Input:
```json
{
  "previewId": "abc123",
  "voiceName": "GioStudio — Nigerian Polished Man"
}
```
Process:
1. Call ElevenLabs API — POST `/v1/text-to-voice/create-voice-from-preview`
2. Saves the voice to Henry's ElevenLabs Voice Library
3. Returns the new voiceId
Output:
```json
{
  "voiceId": "newVoiceId123",
  "voiceName": "GioStudio — Nigerian Polished Man",
  "saved": true
}
```

### GET /api/voice-design/library-search?query=nigerian
Process:
1. Call ElevenLabs Voice Library search — GET `/v1/voices?search=nigerian`
2. Filter for African/Nigerian/Ghanaian/South African tags
3. Return top 10 results
Output:
```json
{
  "voices": [
    { "voiceId": "...", "name": "...", "labels": { "accent": "Nigerian" }, "previewUrl": "..." }
  ]
}
```

---

## DATABASE CHANGES

Add to ContentItem in prisma/schema.prisma:
```prisma
voiceLocale         String?   // en-NG-polished, en-GH-standard, etc.
voiceAccentSubtype  String?   // yoruba, igbo, hausa, standard, polished
voiceDeliveryStyle  String?   // commercial, storytelling, news_anchor, etc.
voiceMatchType      String?   // exact, close, library, generic
voiceCustomInstruct String?   // user's custom instruction text
```

After schema change: run `npx prisma migrate dev --name add_voice_locale_fields`

---

## PERSISTENT VOICE PROFILE STORAGE

Save Henry's last-used narration settings to:
`storage/config/voice_profiles.json`

Format:
```json
{
  "default": {
    "locale": "en-NG-polished",
    "subtype": "polished",
    "speakerProfile": "adult_man",
    "deliveryStyle": "commercial",
    "pacing": "normal",
    "emotion": "authoritative",
    "voiceId": "savedVoiceId"
  }
}
```

On page load: read this file and pre-fill the NarrationPanel.
On profile change: write to this file automatically.

---

## ELEVENLABS VOICE DESIGN API — Technical Notes

Base URL: `https://api.elevenlabs.io`

Create previews endpoint:
```
POST /v1/text-to-voice/create-previews
Headers: xi-api-key: {apiKey}
Body: {
  "voice_description": "...",
  "text": "Welcome to GioHomeStudio. This is a preview of your selected voice."
}
```
Returns: array of generated_voices with preview_url

Create voice from preview:
```
POST /v1/text-to-voice/create-voice-from-preview
Headers: xi-api-key: {apiKey}
Body: {
  "generated_voice_id": "...",
  "voice_name": "...",
  "voice_description": "..."
}
```
Returns: voice_id of saved voice

Voice Library search:
```
GET /v1/voices?search={query}
Headers: xi-api-key: {apiKey}
```

---

## QUALITY GATES (must all pass before Feature 3 is done)

- [ ] NarrationPanel renders in Studio page without errors
- [ ] NarrationPanel renders in Commercial page without errors
- [ ] Nigerian English — Fluent Polished option exists in the dropdown
- [ ] Selecting an accent and clicking PREVIEW VOICE returns 3 audio previews
- [ ] Audio previews play in the browser
- [ ] Selecting a preview and clicking "Use This Voice" saves a voiceId
- [ ] That voiceId is used in the next generation
- [ ] Voice Library search returns African voices
- [ ] Settings persist after page reload (voice_profiles.json written)
- [ ] `voiceLocale` is stored on the ContentItem after generation
- [ ] Playwright test covers: panel renders, preview API called, locale stored
- [ ] No existing voice dropdown broken
- [ ] No existing generation flow broken

---

## ESCALATION TRIGGERS — Stop and tell Henry if:

- ElevenLabs Voice Design API endpoint returns a different schema than documented
- Voice Design previews sound completely generic despite the prompts
- The ElevenLabs plan does not include Voice Design (requires Creator plan or above)
- Prisma migration fails

---

## SESSION START CHECKLIST

Before writing any code:
1. Read this spec top to bottom
2. Check `src/modules/voice-provider/elevenlabs/index.ts` — confirm it still looks the same as documented above
3. Check `app/dashboard/page.tsx` — confirm `voiceId` and `voiceLanguage` state exists
4. Run `npx tsc --noEmit` — confirm zero TypeScript errors before starting
5. Tell Henry: "Ready to build Feature 3 — African Narration Accents. Starting with accent-profiles.ts"
6. Wait for GO AHEAD
