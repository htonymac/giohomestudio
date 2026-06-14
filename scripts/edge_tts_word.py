#!/usr/bin/env python3
"""
Edge-TTS wrapper that emits per-WORD timing as JSON. Used by /api/tts edge-tts
branch to fix subtitle word-highlight desync.

Usage:
    python3 edge_tts_word.py --voice en-US-ChristopherNeural --text "Hello world" \
        --out-audio /tmp/x.mp3 --out-words /tmp/x.json

Outputs JSON shape:
    {"durationMs": 1234, "words": [{"word":"Hello","startMs":0,"endMs":350}, ...]}

Why this instead of `edge-tts --write-subtitles`: the CLI emits sentence-level
VTT (one cue per sentence). The Python SDK exposes per-word boundaries via the
WordBoundary streaming chunks, which is what we actually need for tight
karaoke-style highlight sync.
"""

import argparse
import asyncio
import json
import sys

import edge_tts


async def synthesize(voice: str, text: str, out_audio: str, out_words: str, rate: str = "+0%") -> int:
    # edge-tts 7.x defaults to SentenceBoundary; explicit WordBoundary unlocks
    # per-word timing (which the engine internally knows). Fixed 2026-06-05.
    # rate: speaking speed as a signed percent ("+20%" faster, "-15%" slower).
    # Henry 2026-06-13: restore the narration speed control for Edge voices.
    communicate = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    words = []
    last_end_ms = 0

    with open(out_audio, "wb") as f:
        async for chunk in communicate.stream():
            ctype = chunk.get("type")
            if ctype == "audio":
                f.write(chunk["data"])
            elif ctype == "WordBoundary":
                # offset and duration are in "100-nanosecond units" (ticks of 10MHz).
                # Convert to milliseconds: ms = ticks / 10000.
                start_ms = int(chunk["offset"] / 10000)
                end_ms = start_ms + int(chunk["duration"] / 10000)
                words.append({"word": chunk["text"], "startMs": start_ms, "endMs": end_ms})
                last_end_ms = max(last_end_ms, end_ms)

    with open(out_words, "w", encoding="utf-8") as f:
        json.dump({"durationMs": last_end_ms, "words": words}, f, ensure_ascii=False)
    return 0


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--voice", required=True)
    ap.add_argument("--text", required=True)
    ap.add_argument("--out-audio", required=True)
    ap.add_argument("--out-words", required=True)
    ap.add_argument("--rate", default="+0%")
    args = ap.parse_args()
    try:
        return asyncio.run(synthesize(args.voice, args.text, args.out_audio, args.out_words, args.rate))
    except Exception as e:
        sys.stderr.write(f"edge_tts_word.py error: {e}\n")
        return 1


if __name__ == "__main__":
    sys.exit(main())
