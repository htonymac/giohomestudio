#!/usr/bin/env python3
"""
GHS Karaoke Studio — Tier 1 Audio Analysis
Usage: python karaoke_analyze.py <audio_path>
Output: JSON to stdout. Errors/warnings to stderr.
"""

import sys
import json
import os
import numpy as np

# Force soundfile as primary backend for librosa on Windows (avoids audioread deprecation)
os.environ["AUDIOREAD_CROSSCHECK"] = "1"

# Pre-check soundfile DLL availability (libsndfile missing on some Windows setups)
try:
    import soundfile as _sf_check  # noqa: F401
    SOUNDFILE_AVAILABLE = True
except OSError:
    SOUNDFILE_AVAILABLE = False
    print("[WARN] soundfile backend unavailable (libsndfile DLL not found) — will use librosa fallback", file=sys.stderr)

def suggest_genre(tempo: float, energy: float, brightness: float) -> str:
    """Nigeria-aware genre heuristic from tempo + brightness + energy."""
    bpm = float(tempo)
    # Afrobeats: 85-115 BPM, warm (low brightness)
    if 85 <= bpm <= 115 and brightness < 3000:
        return "Afrobeats"
    # Afrobeats default near 100 BPM
    if 90 <= bpm <= 110:
        return "Afrobeats"
    # R&B: 60-90 BPM
    if 60 <= bpm < 90:
        return "R&B"
    # Hip-Hop: 80-100 BPM + dark (lower brightness)
    if 80 <= bpm <= 100 and brightness < 2000:
        return "Hip-Hop"
    # Pop: 110-130 BPM
    if 110 <= bpm <= 130:
        return "Pop"
    # Cinematic: 60-80 BPM + slow/low energy
    if 60 <= bpm < 80 and energy < 0.05:
        return "Cinematic"
    # Fallback default (Nigeria-biased)
    if bpm >= 80:
        return "Afrobeats"
    return "R&B"


def score_vocal_quality(pitches, magnitudes) -> float:
    """
    Estimate vocal quality 0-1 from pitch stability.
    Higher = more consistent pitch = better quality.
    """
    # Get the dominant pitch at each frame (highest magnitude)
    active_pitches = []
    for t in range(pitches.shape[1]):
        mag = magnitudes[:, t]
        idx = mag.argmax()
        if mag[idx] > 0.01:  # threshold: frame has some signal
            active_pitches.append(float(pitches[idx, t]))

    if len(active_pitches) < 5:
        return 0.5  # not enough data, neutral

    arr = np.array(active_pitches)
    arr = arr[arr > 50]  # filter sub-bass noise
    if len(arr) < 5:
        return 0.5

    # Coefficient of variation: lower = more stable = better score
    mean = float(np.mean(arr))
    std = float(np.std(arr))
    if mean == 0:
        return 0.5
    cv = std / mean
    # Map CV to 0-1: CV=0 -> 1.0, CV=1 -> 0.0
    score = max(0.0, min(1.0, 1.0 - cv))
    return round(score, 3)


def detect_mood(energy: float, tempo: float, brightness: float) -> str:
    """Simple mood heuristic."""
    if energy > 0.1 and tempo > 110:
        return "Energetic"
    if energy > 0.08 and brightness > 3500:
        return "Upbeat"
    if energy < 0.04 and tempo < 80:
        return "Melancholic"
    if energy < 0.05:
        return "Calm"
    if tempo > 100:
        return "Groovy"
    return "Neutral"


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "Usage: karaoke_analyze.py <audio_path>"}))
        sys.exit(1)

    audio_path = sys.argv[1]
    if not os.path.exists(audio_path):
        print(json.dumps({"error": f"File not found: {audio_path}"}))
        sys.exit(1)

    try:
        import librosa
    except ImportError as e:
        print(json.dumps({"error": f"Missing required dependency: {e}"}))
        sys.exit(1)

    # ── Load audio — soundfile → librosa → audioread fallback chain ─────────
    try:
        if SOUNDFILE_AVAILABLE:
            try:
                import soundfile as sf
                y, sr = sf.read(audio_path, dtype='float32', always_2d=False)
                if y.ndim > 1:
                    y = y.mean(axis=1)  # stereo → mono
                print("[INFO] Audio loaded via soundfile backend", file=sys.stderr)
            except Exception as sf_err:
                print(f"[WARN] soundfile read failed: {sf_err} — falling back to librosa", file=sys.stderr)
                try:
                    y, sr = librosa.load(audio_path, sr=None, mono=True)
                    print("[INFO] Audio loaded via librosa backend", file=sys.stderr)
                except Exception as lb_err:
                    print(f"[WARN] librosa load also failed: {lb_err}", file=sys.stderr)
                    raise
        else:
            # soundfile DLL missing — go straight to librosa
            try:
                y, sr = librosa.load(audio_path, sr=None, mono=True)
                print("[INFO] Audio loaded via librosa backend (soundfile unavailable)", file=sys.stderr)
            except Exception as lb_err:
                print(f"[WARN] librosa load failed: {lb_err}", file=sys.stderr)
                raise
    except Exception as e:
        print(json.dumps({"error": f"Failed to load audio: {e}"}))
        sys.exit(1)

    duration_seconds = float(len(y) / sr)

    # ── Tempo and beats ─────────────────────────────────────────────────────
    try:
        tempo_result = librosa.beat.beat_track(y=y, sr=sr)
        if hasattr(tempo_result, 'bpm'):
            tempo_raw = tempo_result.bpm
            beat_frames = tempo_result.beats
        else:
            tempo_raw, beat_frames = tempo_result
        # tempo may be a 0-d / 1-d numpy array in librosa 0.11+ — convert via .item() / asarray.
        tempo = float(np.asarray(tempo_raw).flatten()[0])
        beat_times = librosa.frames_to_time(beat_frames, sr=sr).tolist()
    except Exception as e:
        print(f"[WARN] Beat tracking failed: {e}", file=sys.stderr)
        tempo = 90.0
        beat_times = []

    # ── Key detection ────────────────────────────────────────────────────────
    try:
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_index = int(chroma.mean(axis=1).argmax())
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_note = key_names[key_index]
        # Simple major/minor determination via spectral roll-off
        # Lower spectral centroid relative to key tends toward minor — use a rough heuristic
        spectral_centroid_mean = float(librosa.feature.spectral_centroid(y=y, sr=sr).mean())
        # Heuristic: bright (high SC) → major, dark (low SC) → minor
        mode = "major" if spectral_centroid_mean > 2500 else "minor"
        detected_key = f"{key_note} {mode}"
    except Exception as e:
        print(f"[WARN] Key detection failed: {e}", file=sys.stderr)
        detected_key = "Unknown"
        spectral_centroid_mean = 2000.0

    # ── Energy ───────────────────────────────────────────────────────────────
    try:
        rms = librosa.feature.rms(y=y)[0]
        energy_level = float(rms.mean())
    except Exception as e:
        print(f"[WARN] Energy calc failed: {e}", file=sys.stderr)
        energy_level = 0.05

    # ── Brightness — reuse spectral_centroid already computed in key block ──
    brightness = spectral_centroid_mean

    # ── Pitch / vocal quality ────────────────────────────────────────────────
    try:
        pitches, magnitudes = librosa.piptrack(y=y, sr=sr)
        vocal_quality_score = score_vocal_quality(pitches, magnitudes)
    except Exception as e:
        print(f"[WARN] Pitch analysis failed: {e}", file=sys.stderr)
        vocal_quality_score = 0.5

    # ── Transcription with faster-whisper ───────────────────────────────────
    transcription = ""
    word_timestamps = []
    try:
        from faster_whisper import WhisperModel
        model_size = os.environ.get("WHISPER_MODEL", "base")
        print(f"[INFO] Loading Whisper model: {model_size}", file=sys.stderr)
        whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
        segments, info = whisper_model.transcribe(audio_path, word_timestamps=True)
        words = []
        text_parts = []
        for segment in segments:
            text_parts.append(segment.text.strip())
            if segment.words:
                for w in segment.words:
                    words.append({
                        "word": w.word.strip(),
                        "start": round(float(w.start), 3),
                        "end": round(float(w.end), 3),
                    })
        transcription = " ".join(text_parts).strip()
        word_timestamps = words
        print(f"[INFO] Transcription complete: {len(words)} words", file=sys.stderr)
    except ImportError:
        print("[WARN] faster-whisper not installed — transcription skipped", file=sys.stderr)
        transcription = ""
        word_timestamps = []
    except Exception as e:
        print(f"[WARN] Transcription failed: {e}", file=sys.stderr)
        transcription = ""
        word_timestamps = []

    # ── Basic Pitch (optional — stub if not installed) ───────────────────────
    # basic-pitch not installed — skipping melody extraction
    print("[INFO] basic-pitch not installed — skipping melody extraction", file=sys.stderr)

    # ── Genre and mood ───────────────────────────────────────────────────────
    suggested_genre = suggest_genre(tempo, energy_level, brightness)
    mood = detect_mood(energy_level, tempo, brightness)

    # ── Output ───────────────────────────────────────────────────────────────
    result = {
        "transcription": transcription,
        "word_timestamps": word_timestamps,
        "tempo_bpm": round(tempo, 2),
        "beat_times": [round(t, 3) for t in beat_times[:100]],  # cap at 100 beats
        "detected_key": detected_key,
        "energy_level": round(energy_level, 6),
        "brightness": round(brightness, 2),
        "duration_seconds": round(duration_seconds, 3),
        "suggested_genre": suggested_genre,
        "vocal_quality_score": vocal_quality_score,
        "mood": mood,
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception as _top_exc:
        import traceback as _tb
        print(json.dumps({"error": str(_top_exc), "traceback": _tb.format_exc()}))
        sys.exit(1)
