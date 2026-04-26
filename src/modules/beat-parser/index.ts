// Beat parser — converts a story/script text into a structured Beat timeline.
// Supports narration, tagged dialogue, and SFX/ambience annotations.
//
// Supported inline tags in script text:
//   [SFX: sword_clash]          — inserts a sound effect beat
//   [AMBIENCE: market_noise]    — inserts an ambience beat
//   [CHARACTER: Name] line...   — marks a dialogue beat for that character
//   [PAUSE]                     — inserts a silence beat (500 ms)
//   [IMAGE: description]        — inserts an image beat (images+audio mode)
//   [ACTION]                    — marks next narration beat as isActionBeat (hybrid mode)

import { Beat, BeatType, OutputMode, Timeline } from "../timeline/types";

// Rough speaking rate: average narrator pace (words per minute)
const WORDS_PER_MINUTE = 130;
const MS_PER_WORD = (60 / WORDS_PER_MINUTE) * 1000;

// Fixed durations for non-narration beats (ms)
const SFX_DURATION_MS = 2000;
const AMBIENCE_DURATION_MS = 4000;
const IMAGE_DISPLAY_MS = 4000;
const PAUSE_MS = 500;

function estimateDurationMs(text: string): number {
  const wordCount = text.trim().split(/\s+/).filter(Boolean).length;
  // Minimum 1 second per beat even for very short lines
  return Math.max(1000, Math.round(wordCount * MS_PER_WORD));
}

interface ParsedLine {
  type: "sfx" | "ambience" | "dialogue" | "narration" | "pause" | "image" | "action_flag";
  text: string;
  speaker?: string;
  event?: string;
}

function parseLine(raw: string): ParsedLine | null {
  const line = raw.trim();
  if (!line) return null;

  // [SFX: event]
  const sfxMatch = line.match(/^\[SFX:\s*([^\]]+)\]$/i);
  if (sfxMatch) return { type: "sfx", text: "", event: sfxMatch[1].trim() };

  // [AMBIENCE: event]
  const ambiMatch = line.match(/^\[AMBIENCE:\s*([^\]]+)\]$/i);
  if (ambiMatch) return { type: "ambience", text: "", event: ambiMatch[1].trim() };

  // [PAUSE]
  if (/^\[PAUSE\]$/i.test(line)) return { type: "pause", text: "" };

  // [ACTION]
  if (/^\[ACTION\]$/i.test(line)) return { type: "action_flag", text: "" };

  // [IMAGE: description]
  const imageMatch = line.match(/^\[IMAGE:\s*([^\]]+)\]$/i);
  if (imageMatch) return { type: "image", text: imageMatch[1].trim() };

  // [CHARACTER: Name] spoken line
  const charMatch = line.match(/^\[CHARACTER:\s*([^\]]+)\]\s+(.+)$/i);
  if (charMatch) return { type: "dialogue", text: charMatch[2].trim(), speaker: charMatch[1].trim() };

  // Plain text → narration
  return { type: "narration", text: line };
}

export function parseBeats(
  script: string,
  opts: { outputMode?: OutputMode; castingCharacters?: string[]; storyThreadId?: string } = {}
): Timeline {
  const { outputMode = "text_to_video", castingCharacters, storyThreadId } = opts;
  const lines = script.split("\n");

  const beats: Beat[] = [];
  let cursorMs = 0;
  let nextIsAction = false;
  let beatCounter = 0;
  const nextId = () => `beat_${Date.now()}_${++beatCounter}`;

  for (const raw of lines) {
    const parsed = parseLine(raw);
    if (!parsed) continue;

    if (parsed.type === "action_flag") {
      nextIsAction = true;
      continue;
    }

    let beat: Beat;

    switch (parsed.type) {
      case "sfx":
        beat = {
          id: nextId(),
          type: "sfx" as BeatType,
          startMs: cursorMs,
          durationMs: SFX_DURATION_MS,
          sfxEvent: parsed.event,
        };
        // SFX beats run in parallel — don't advance cursor
        break;

      case "ambience":
        beat = {
          id: nextId(),
          type: "ambience" as BeatType,
          startMs: cursorMs,
          durationMs: AMBIENCE_DURATION_MS,
          sfxEvent: parsed.event,
        };
        // Ambience runs in parallel too
        break;

      case "pause":
        beat = {
          id: nextId(),
          type: "silence" as BeatType,
          startMs: cursorMs,
          durationMs: PAUSE_MS,
        };
        cursorMs += PAUSE_MS;
        nextIsAction = false;
        break;

      case "image":
        beat = {
          id: nextId(),
          type: "image" as BeatType,
          startMs: cursorMs,
          durationMs: IMAGE_DISPLAY_MS,
          imagePrompt: parsed.text,
          isActionBeat: nextIsAction,
        };
        cursorMs += IMAGE_DISPLAY_MS;
        nextIsAction = false;
        break;

      case "dialogue":
        beat = {
          id: nextId(),
          type: "dialogue" as BeatType,
          startMs: cursorMs,
          durationMs: estimateDurationMs(parsed.text),
          text: parsed.text,
          speakerName: parsed.speaker,
          isActionBeat: nextIsAction,
        };
        cursorMs += beat.durationMs;
        nextIsAction = false;
        break;

      case "narration":
      default:
        beat = {
          id: nextId(),
          type: "narration" as BeatType,
          startMs: cursorMs,
          durationMs: estimateDurationMs(parsed.text),
          text: parsed.text,
          isActionBeat: nextIsAction,
        };
        cursorMs += beat.durationMs;
        nextIsAction = false;
        break;
    }

    beats.push(beat);
  }

  return {
    id: `tl_${Date.now()}`,
    outputMode,
    totalDurationMs: cursorMs,
    beats,
    castingCharacters,
    storyThreadId,
    createdAt: Date.now(),
  };
}
