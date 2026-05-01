# GHS Karaoke Studio — Complete Feature Plan
## Record Your Voice. AI Builds Your Song.
**Version 1.0**

---

## WHAT THIS FEATURE IS

GHS Karaoke Studio lets a user:

1. Record or upload any voice — humming, singing, speaking, whistling, a melody idea
2. GHS analyses it with AI — extracts pitch, tempo, melody, emotion, key
3. User sees a full audio editor — add bass, remove noise, change pitch, add reverb
4. AI assists with lyrics — polish existing lyrics, suggest new ones, improve vocabulary
5. User exports a finished song — their voice, AI-enhanced, professionally produced

The difference from any other tool:
- Works from ANY voice input — even terrible singing
- AI extracts the musical intention behind the voice, not just the sound
- Lyrics assistant is built in — not a separate tool
- Export goes straight into the GHS music video pipeline

---

## THE AI TOOLS THAT LISTEN TO MUSIC

These are real, available tools GHS will use:

### 1. OpenAI Whisper
**What it does:** Transcribes spoken or sung audio to text with timestamps
**Accuracy:** Extremely high — handles accents, Pidgin, Yoruba, mixed language
**Use in GHS:** Transcribes whatever the user records into lyrics with timestamps
**Local or API:** Can run locally (free) or via API

```python
import whisper
model = whisper.load_model("base")
result = model.transcribe("user_recording.mp3", word_timestamps=True)
# Returns: every word with start_time and end_time
# "Lagos" → starts: 2.34s, ends: 2.68s
```

### 2. librosa
**What it does:** Full audio analysis — pitch, tempo, key, energy, beat positions
**Use in GHS:** Extracts musical structure from user's voice recording
**Local:** Runs completely locally, free, no API cost

```python
import librosa
y, sr = librosa.load("user_recording.mp3")
tempo, beats = librosa.beat.beat_track(y=y, sr=sr)
pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
key = librosa.feature.chroma_cqt(y=y, sr=sr)
```

### 3. Spotify Basic Pitch
**What it does:** Converts audio (any audio) to MIDI — extracts the exact melody notes
**Use in GHS:** Turns user's hummed melody into a note sequence that music generators understand
**Open source:** Free to use

```python
from basic_pitch.inference import predict
model_output, midi_data, note_events = predict("user_recording.mp3")
# Returns: exact notes the user sang — C4, D4, E4, G4...
# This melody can be sent to Suno as a melody hint
```

### 4. Demucs (Facebook/Meta Research)
**What it does:** Separates audio into stems — vocals, drums, bass, other
**Use in GHS:** If user records with background noise or music, Demucs isolates the voice
**Open source:** Free

```python
from demucs.apply import apply_model
# Separates: vocals / drums / bass / other
# User records in a noisy room → GHS extracts just the voice
```

### 5. RVC (Retrieval-based Voice Conversion)
**What it does:** Transforms voice quality — cleans up, enhances, changes vocal character
**Use in GHS:** User has a rough voice recording → RVC polishes it to sound professional
**Open source:** Free

### 6. Claude (Anthropic)
**What it does:** Analyses transcribed lyrics, understands meaning, rewrites and enhances
**Use in GHS:** The lyrics intelligence layer — vocabulary improvement, rhyme scheme, flow

---

## THE FULL GHS KARAOKE PIPELINE

```
STEP 1:  User records or uploads voice
STEP 2:  Audio Analysis (Whisper + librosa + Basic Pitch)
         → Transcription, tempo, key, melody notes, emotion
STEP 3:  Vocal Isolation (Demucs)
         → Clean voice separated from any background
STEP 4:  Melody Extraction (Basic Pitch → MIDI)
         → User's hummed melody converted to notes
STEP 5:  Audio Editor — user sees waveform, edits sound
         → Add/remove bass, adjust pitch, reverb, compression, noise reduction
STEP 6:  Lyrics Editor — AI-assisted
         → Transcribed lyrics displayed, user edits
         → AI polishes vocabulary, suggests rhymes, improves flow
STEP 7:  Production Brief Generation
         → GHS builds a music production brief from the analysis
STEP 8:  Music Generation
         → User's melody + brief sent to Suno/Udio
         → Full backing track generated to match user's voice
STEP 9:  Voice Enhancement (RVC optional)
         → Polish user's vocal recording
STEP 10: Final Merge (FFmpeg)
         → User voice + AI backing track combined
STEP 11: Export
         → Finished song file
         → Optional: send to Music Video pipeline
```

---

## STEP 1 — VOICE RECORDING / UPLOAD

**Three input methods:**

**A — Record directly in browser:**
```javascript
// Web Audio API — works in any browser
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream);
recorder.start();
// User sings, hums, speaks their idea
// Visual: live waveform display while recording
```

**B — Upload audio file:**
Accepts: MP3, WAV, M4A, AAC, OGG, WEBM (phone voice notes)
Max size: 50MB

**C — Record on phone, upload to GHS:**
WhatsApp voice note → download → upload to GHS
This is the most realistic workflow for Nigerian users

**What the UI looks like:**
- Large microphone button with pulsing animation when recording
- Live waveform display — user sees their voice as they sing
- Timer showing recording length
- Stop button
- Preview playback before proceeding

---

## STEP 2 — AUDIO ANALYSIS

GHS analyses the recording across six dimensions simultaneously:

```python
import librosa
import whisper
from basic_pitch.inference import predict

def full_audio_analysis(audio_path: str) -> dict:
    y, sr = librosa.load(audio_path)
    
    # 1. Transcription — what did the user say/sing?
    whisper_model = whisper.load_model("base")
    transcription = whisper_model.transcribe(audio_path, word_timestamps=True)
    
    # 2. Tempo and beats
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    
    # 3. Musical key
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_index = chroma.mean(axis=1).argmax()
    keys = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
    detected_key = keys[key_index]
    
    # 4. Pitch contour (is user singing in tune?)
    pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
    
    # 5. Emotion / energy
    rms = librosa.feature.rms(y=y)[0]
    spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    
    # 6. Melody extraction (hum to MIDI)
    _, midi_data, note_events = predict(audio_path)
    
    return {
        "transcription": transcription["text"],
        "word_timestamps": transcription["segments"],
        "tempo_bpm": float(tempo),
        "beat_times": beat_times.tolist(),
        "detected_key": detected_key,
        "note_events": note_events,  # the melody as notes
        "energy_level": float(rms.mean()),
        "brightness": float(spectral_centroid.mean()),
        "duration_seconds": float(len(y) / sr),
        "suggested_genre": suggest_genre(tempo, rms, spectral_centroid),
        "vocal_quality_score": score_vocal_quality(pitches, magnitudes),
    }
```

**What GHS shows the user after analysis:**

```
✅ Analysis complete

Your recording:
  Duration:     1:24
  Tempo:        94 BPM → matches Afrobeats / R&B range
  Key:          A minor
  Energy:       Medium — good for a verse section
  Mood:         Melancholic (based on pitch and tempo)
  Lyrics found: 12 words transcribed
  Melody:       Extracted ✓ — 23 note events detected

Suggested genre: Afrobeats or R&B
Suggested role: This sounds like a verse — want GHS to build a chorus?
```

---

## STEP 3 — VOCAL ISOLATION

If user recorded with background noise (which is extremely common in Nigeria — generators, street noise, market sounds):

```python
from demucs.separate import main as demucs_separate

# Separates: vocals | drums | bass | other
demucs_separate(["--mp3", "--two-stems", "vocals", audio_path])

# Result: clean vocal track isolated from all background noise
clean_vocal_path = f"storage/raw/vocals/{content_id}_vocals.mp3"
```

GHS automatically:
- Detects if background noise is above threshold
- Runs Demucs separation if needed
- Uses the clean vocal for all downstream processing
- Keeps the original in case user prefers it

---

## STEP 4 — MELODY EXTRACTION

Basic Pitch converts the user's humming or singing into actual musical notes:

```python
# User hums: "la la la la-la la la..."
# Basic Pitch outputs:
note_events = [
    {"start": 0.5,  "end": 0.9,  "pitch": 69, "note": "A4", "velocity": 80},
    {"start": 1.0,  "end": 1.4,  "pitch": 71, "note": "B4", "velocity": 75},
    {"start": 1.5,  "end": 1.8,  "pitch": 72, "note": "C5", "velocity": 85},
    # ...
]
```

This melody can then be:
1. Sent to Suno as a melody reference — Suno builds the full song around it
2. Used to check if user's lyrics timing matches the melody
3. Displayed in the editor as a piano roll

**Why this matters:**
A musician who cannot describe music in technical terms can just hum their idea. GHS translates that hum into something a music generator can work with. The AI literally listens to and understands the musical idea behind the recording.

---

## STEP 5 — AUDIO EDITOR (The main workspace)

This is the heart of the Karaoke Studio. The user sees a professional-looking but easy-to-use audio editing interface.

**What the editor shows:**

**Top section — Waveform display:**
```
[────────────────────────────────────────────]
 User voice waveform with playhead
 Lyric cues shown as coloured markers on timeline
 Beat markers shown as vertical grid lines
[────────────────────────────────────────────]
```

**Middle section — Audio controls (real-time via Web Audio API):**

```
VOICE
├── Volume          [━━━━━━━●━━━] 80%
├── Pitch           [━━━●━━━━━━━] +0 semitones
├── Reverb          [━━●━━━━━━━━] 15% (adds room sound)
└── Noise reduction [━━━━━━━━━●━] ON

BASS BOOST
├── Sub bass (0–80Hz)    [━━━━━●━━━━] +3dB
├── Bass (80–250Hz)      [━━━━━━●━━━] +2dB
└── Low-mid (250–500Hz)  [━━━━━━━━●━] -1dB

PRESENCE
├── Vocals (1–4kHz)      [━━━━━━●━━━] +2dB
├── Air (8–16kHz)        [━━━━━●━━━━] +1dB
└── De-esser             [━━━━━━━━●━] ON

EFFECTS
├── Compression    [OFF / LIGHT / MEDIUM / HEAVY]
├── Autotune       [OFF / SUBTLE / STRONG]
└── Delay          [━━━●━━━━━━━] 15%
```

**All of this is processed in real time using the Web Audio API:**
```javascript
const audioContext = new AudioContext();
const source = audioContext.createMediaElementSource(audioElement);

// Bass boost using BiquadFilter
const bassFilter = audioContext.createBiquadFilter();
bassFilter.type = 'lowshelf';
bassFilter.frequency.value = 200;
bassFilter.gain.value = 3; // +3dB

// Reverb using ConvolverNode
const convolver = audioContext.createConvolver();
convolver.buffer = await loadImpulseResponse('room-reverb.wav');

// Compression
const compressor = audioContext.createDynamicsCompressor();
compressor.threshold.value = -20;
compressor.ratio.value = 4;

// Chain: source → bass → reverb → compressor → destination
source.connect(bassFilter);
bassFilter.connect(convolver);
convolver.connect(compressor);
compressor.connect(audioContext.destination);
```

**User hears changes instantly as they move any slider.**

**Bottom section — Quick preset buttons:**
```
[Natural Voice] [Studio Warm] [Deep Bass] [Bright Pop] 
[Gospel Hall]   [Afrobeats Mix] [R&B Smooth] [Hip Hop]
```

Each preset instantly sets all sliders to a genre-appropriate configuration.

---

## STEP 6 — LYRICS EDITOR WITH AI ASSISTANCE

This is where the intelligence lives.

**What the user sees:**

Left side — their transcribed lyrics displayed line by line:
```
Line 1: "Early morning in this foreign land"     [edit] [ai]
Line 2: "Cold outside I hold my phone"           [edit] [ai]
Line 3: "I scroll through photos every night"    [edit] [ai]
Line 4: "Missing Lagos missing home"             [edit] [ai]
```

Right side — AI suggestions panel.

**When user clicks [ai] on any line, Claude activates:**

```
Original: "Missing Lagos missing home"

AI Suggestions:

1. VOCABULARY UPGRADE:
   "Yearning for Lagos, yearning for home"
   (yearning = stronger emotional word than missing)

2. RHYME IMPROVEMENT:
   "Lagos pulling me alone" 
   (rhymes with 'phone' from line 2 — connects the verse)

3. PIDGIN VERSION:
   "I miss Lagos die, e dey pain my bone"
   (authentic Pidgin — stronger emotion, cultural grounding)

4. POETIC VERSION:
   "My roots keep calling through the phone"
   (metaphor — roots = Lagos, phone = the connection)

5. YOUR LINE KEPT, BETTER FLOW:
   "Missing Lagos, missing home, missing everything I've known"
   (extended for better rhythmic fit with the melody)
```

User picks one or keeps their own. Or they type and ask Claude directly.

**The full AI lyrics interface:**

```
┌─────────────────────────────────────────────────────┐
│ 🤖 GHS Lyrics AI                                    │
│                                                     │
│ Ask me anything about your lyrics:                  │
│ ┌─────────────────────────────────────────────────┐ │
│ │ "Make line 3 rhyme better with line 4"          │ │
│ └─────────────────────────────────────────────────┘ │
│                                                     │
│ Quick actions:                                      │
│ [Polish all lyrics] [Make it more Pidgin]           │
│ [Improve vocabulary] [Add a chorus]                 │
│ [Write a bridge] [Make it rhyme properly]           │
│ [Translate to Yoruba] [Make it gospel]              │
│ [Simplify for children] [Make it more poetic]       │
└─────────────────────────────────────────────────────┘
```

**Behind the scenes — Claude receives:**

```
System: You are a professional Nigerian music lyricist and songwriter.
You understand Afrobeats, Highlife, Gospel, R&B, and Hip Hop.
You write authentically in English, Pidgin, Yoruba, Igbo, and mixed.
You help users improve their lyrics while keeping their voice and intention.
Never change the core meaning. Offer options, not replacements.

User recording analysis:
- Tempo: 94 BPM
- Key: A minor
- Mood: Melancholic
- Genre suggested: Afrobeats / R&B
- Detected melody: [note events]

Current lyrics:
{user_lyrics}

User request: {user_instruction}
```

**Claude returns structured options — not just one suggestion.**
User always chooses. AI never overwrites without permission.

**Additional lyrics intelligence:**

Syllable counter (lyrics must fit the melody):
```
"Missing Lagos missing home" → 8 syllables
Melody slot in verse 1:     → 8 beats available ✅ Perfect fit

"Yearning for Lagos yearning for the home I love" → 12 syllables
Melody slot in verse 1:     → 8 beats available ❌ Too long
GHS warning: "This line is 4 syllables too long for your melody"
```

Rhyme scheme detector:
```
Current scheme:
Line 1: "...foreign land" (A)
Line 2: "...hold my phone" (B)  
Line 3: "...every night" (C)
Line 4: "...missing home" (B)

Rhyme: ABCB — partial rhyme scheme
AI suggestion: "Consider making line 3 end in a word 
that rhymes with 'land' (A) — hand, stand, understand, 
planned, band — to create ABAB which flows better"
```

---

## STEP 7 — PRODUCTION BRIEF GENERATION

Once the user is happy with their lyrics and audio settings, GHS generates a production brief automatically from the analysis:

```json
{
  "user_tempo": 94,
  "user_key": "A minor",
  "user_melody_notes": ["A4","B4","C5","B4","A4",...],
  "user_mood": "melancholic",
  "refined_lyrics": {
    "verse_1": "Early morning in this foreign land...",
    "chorus": "Lagos Lagos you dey my heart...",
    "verse_2": "...",
    "bridge": "..."
  },
  "production_style": "Mid-tempo Afrobeats. Acoustic guitar lead. Emotional. BPM 94. Key A minor. Build from sparse to full.",
  "vocal_reference": "storage/raw/vocals/{id}_clean.mp3",
  "target_duration": 180
}
```

---

## STEP 8 — MUSIC GENERATION

The production brief is sent to the Music Provider Layer.

**Two modes:**

**Mode A — Backing track only (user keeps their voice):**
```
Generate an instrumental backing track.
BPM: 94. Key: A minor. Style: Mid-tempo Afrobeats.
No vocals. The user will add their own voice on top.
Duration: 180 seconds.
```

**Mode B — Full AI production (AI sings user's lyrics):**
```
Generate a full song with AI vocals.
Lyrics: {refined_lyrics}
Voice style: {vocal_style chosen by user}
BPM: 94. Key: A minor.
Try to match this melody: {midi from Basic Pitch}
```

**Suno specifically accepts a melody reference** — it will try to build the song around the notes the user hummed. This is the closest any tool gets to "AI listening to your melody and continuing it."

---

## STEP 9 — VOICE ENHANCEMENT (OPTIONAL)

If user wants to use their own voice in the final track:

```python
# RVC — Retrieval-based Voice Conversion
# Can: clean up voice, add professional quality, change character slightly
# Cannot: make a bad singer sound perfect (autotune in editor does that)

rvc_process(
    input_path="storage/raw/vocals/{id}_clean.mp3",
    model="general_enhance",  # professional vocal quality
    pitch_shift=0,            # keep original pitch unless user changed it
    output_path="storage/raw/vocals/{id}_enhanced.mp3"
)
```

The autotune slider in Step 5 handles pitch correction.
RVC handles overall vocal quality enhancement.

---

## STEP 10 — FINAL MERGE

```python
# FFmpeg merges: enhanced user voice + AI backing track
ffmpeg_merge(
    voice_path="storage/raw/vocals/{id}_enhanced.mp3",
    music_path="storage/raw/music/{id}_backing.mp3",
    output_path="storage/merged/{id}_karaoke_final.mp3",
    voice_volume=0.85,
    music_volume=0.70,
)
```

User can adjust the voice/music balance with a final slider before export.

---

## STEP 11 — EXPORT OPTIONS

```
Export as:
[MP3 — Standard quality]
[WAV — High quality, large file]
[Send to GHS Music Video Pipeline →]
[Share via WhatsApp]
[Post to Instagram]
```

The "Send to Music Video Pipeline" option is the most powerful — it takes the finished Karaoke song and runs it through the full 12-step music video pipeline, generating a complete music video automatically.

---

## THE UI — WHAT THE USER ACTUALLY SEES

Three sections in one page:

**Section 1 — Record**
Large microphone. Live waveform. Timer. Clean and simple.

**Section 2 — Edit** (unlocks after recording)
Left: waveform + timeline with beat markers
Center: audio controls (volume, pitch, bass, reverb, autotune, presets)
Right: lyrics panel with AI suggestions

**Section 3 — Produce** (unlocks after editing)
Choose: backing track only OR full AI production
Pick voice style if AI production
Generate → review → export

---

## WHAT MAKES THIS DIFFERENT FROM COMPETITORS

| Feature | GHS Karaoke | GarageBand | Suno | Udio |
|---|---|---|---|---|
| Record your voice | ✅ | ✅ | ❌ | ❌ |
| AI transcribes lyrics | ✅ | ❌ | ❌ | ❌ |
| AI improves lyrics | ✅ | ❌ | ❌ | ❌ |
| Melody extraction from hum | ✅ | ❌ | ❌ | ❌ |
| Yoruba / Pidgin / Igbo support | ✅ | ❌ | Partial | ❌ |
| Backing track from your melody | ✅ | ❌ | Partial | Partial |
| Bass / reverb / autotune editor | ✅ | ✅ | ❌ | ❌ |
| Sends to music video pipeline | ✅ | ❌ | ❌ | ❌ |
| Works on phone via WhatsApp | ✅ | ❌ | ❌ | ❌ |
| Built for African genres | ✅ | ❌ | ❌ | ❌ |

---

## ENVIRONMENT VARIABLES NEEDED

```env
# Audio analysis (all run locally — no API cost)
WHISPER_MODEL=base           # or "small" for better accuracy
BASIC_PITCH_ENABLED=true
DEMUCS_MODEL=htdemucs        # best quality separation model
RVC_ENABLED=true
RVC_MODEL_PATH=/models/rvc/

# Web Audio (client-side — no env needed)
# Impulse response files for reverb effects
REVERB_PRESETS_DIR=/app/assets/reverb/

# Existing
ANTHROPIC_API_KEY=sk-ant-...  # for lyrics AI
MUSIC_PROVIDER=suno
SUNO_API_KEY=...
```

---

## NEW MODULES NEEDED

| Module | Path | What it does |
|---|---|---|
| Voice Recorder | `src/modules/karaoke/recorder.ts` | Browser recording + upload |
| Audio Analyser | `src/modules/karaoke/analyser.py` | Whisper + librosa + Basic Pitch |
| Vocal Isolator | `src/modules/karaoke/isolator.py` | Demucs separation |
| Melody Extractor | `src/modules/karaoke/melody.py` | Basic Pitch → MIDI |
| Audio Editor | `src/modules/karaoke/editor.ts` | Web Audio API real-time processing |
| Lyrics Intelligence | `src/modules/karaoke/lyrics-ai.ts` | Claude lyrics assistance |
| Voice Enhancer | `src/modules/karaoke/enhancer.py` | RVC voice quality |
| Karaoke Merger | `src/modules/karaoke/merger.ts` | FFmpeg voice + backing merge |

---

*GHS Karaoke Studio — Complete Feature Plan v1.0*
*AI listens. User creates. GHS produces.*
