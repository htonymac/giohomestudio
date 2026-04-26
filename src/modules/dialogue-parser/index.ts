// GioHomeStudio — Dialogue Parser
//
// Detects multi-speaker dialogue in narration scripts and splits them
// into ordered speaker turns for multi-voice audio generation.
//
// Supported input formats:
//   NARRATOR: text                   → narrator turn (no quotes needed)
//   JOHN: "I'm going home."          → character dialogue
//   John: "I'm going home."          → title-case also accepted
//   JOHN [whisper]: "text"           → character dialogue with voice direction
//   [WHISPER: text]                  → narrator whisper (inline voice direction block)
//   [EMOTIONAL: text]                → emotional delivery block
//   [COMMANDING: text]               → commanding delivery block
//   [TREMBLING: text]                → trembling/fearful delivery block
//   [SFX: thunder]                   → sound effect annotation (extracted separately)
//   [SOUND: thunder]                 → alternate SFX annotation form
//   [VOICE_DIRECTION: whisper]       → sets scene-level default voice direction
//   Regular paragraph text           → treated as narrator turn in mixed scripts

import type { SpeechStyle } from "@/types/providers";
import { SPEECH_STYLE_VALUES } from "@/types/providers";

export interface DialogueTurn {
  speaker: string;           // e.g. "NARRATOR", "JOHN", "MARY"
  text: string;              // spoken text (quotes stripped)
  isNarrator: boolean;
  sfxHints: string[];        // SFX events mentioned inline: [SFX: thunder]
  speechStyle?: SpeechStyle; // voice performance direction for this turn
}

export interface ParsedScript {
  turns: DialogueTurn[];
  speakers: string[];        // unique speaker names (excluding NARRATOR)
  hasSFX: boolean;
  sfxEvents: string[];       // all SFX events found in the script
  isMultiVoice: boolean;
}

// SFX annotation: [SFX: thunder] or [SOUND: rain_heavy]
const SFX_ANNOTATION = /\[(?:SFX|SOUND|FX):\s*([^\]]+)\]/gi;

// Voice direction block: [WHISPER: text] [EMOTIONAL: text] etc.
// These wrap narration text with a speechStyle applied to the whole block.
const VOICE_DIRECTION_BLOCK = /^\[(WHISPER|EMOTIONAL|COMMANDING|TREMBLING):\s*(.+?)\]$/i;

// Scene-level voice direction: [VOICE_DIRECTION: whisper]
const SCENE_VOICE_DIRECTION = /^\[VOICE_DIRECTION:\s*(\w+)\]$/i;

// Speaker with inline direction: JOHN [whisper]: "text"
const SPEAKER_WITH_DIRECTION = /^([A-Z][A-Z\s\-']{0,24})\s+\[(\w+)\]:\s*[""]?(.+?)[""]?\s*$/;
const SPEAKER_WITH_DIRECTION_RELAXED = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+\[(\w+)\]:\s*[""]?(.+?)[""]?\s*$/;

// Speaker label patterns
// Matches: JOHN: "text" | John: "text" | JOHN: text | NARRATOR: text
const SPEAKER_LINE = /^([A-Z][A-Z\s\-']{0,24}):\s*[""]?(.+?)[""]?\s*$/;
const SPEAKER_LINE_RELAXED = /^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*):\s*[""]?(.+?)[""]?\s*$/;

const NARRATOR_NAMES = new Set(["NARRATOR", "NARR", "VOICE", "VOICEOVER", "VO", "DESCRIPTION"]);

function parseSpeechStyle(raw: string): SpeechStyle | undefined {
  const lower = raw.toLowerCase().trim();
  return (SPEECH_STYLE_VALUES as readonly string[]).includes(lower)
    ? (lower as SpeechStyle)
    : undefined;
}

function isNarratorSpeaker(name: string): boolean {
  return NARRATOR_NAMES.has(name.toUpperCase().trim());
}

function extractSFX(text: string): { clean: string; sfx: string[] } {
  const sfx: string[] = [];
  const clean = text.replace(SFX_ANNOTATION, (_, event) => {
    sfx.push(event.trim().toLowerCase().replace(/\s+/g, "_"));
    return "";
  }).trim();
  return { clean, sfx };
}

export function parseDialogueScript(script: string): ParsedScript {
  const lines = script.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
  const turns: DialogueTurn[] = [];
  const speakerSet = new Set<string>();
  const allSFX: string[] = [];

  for (const line of lines) {
    // ── Scene-level voice direction (no turn produced) ──────────────────────
    // [VOICE_DIRECTION: whisper]
    const sceneDirectionMatch = SCENE_VOICE_DIRECTION.exec(line);
    if (sceneDirectionMatch) {
      // No turn — this is a document-level annotation. Skip silently.
      continue;
    }

    // ── Voice direction block ────────────────────────────────────────────────
    // [WHISPER: text] [EMOTIONAL: text] etc.
    const directionBlockMatch = VOICE_DIRECTION_BLOCK.exec(line);
    if (directionBlockMatch) {
      const rawStyle = directionBlockMatch[1];
      const blockText = directionBlockMatch[2].trim();
      const { clean, sfx } = extractSFX(blockText);
      if (!clean) continue;
      allSFX.push(...sfx);
      const speechStyle = parseSpeechStyle(rawStyle);
      turns.push({ speaker: "NARRATOR", text: clean, isNarrator: true, sfxHints: sfx, speechStyle });
      continue;
    }

    // ── SFX-only line ────────────────────────────────────────────────────────
    // [SFX: thunder]
    if (/^\[(?:SFX|SOUND|FX):/i.test(line)) {
      const { sfx } = extractSFX(line);
      allSFX.push(...sfx);
      if (turns.length > 0) {
        turns[turns.length - 1].sfxHints.push(...sfx);
      } else {
        turns.push({ speaker: "NARRATOR", text: "", isNarrator: true, sfxHints: sfx });
      }
      continue;
    }

    // ── Speaker with inline direction ────────────────────────────────────────
    // JOHN [whisper]: "text"  or  John [emotional]: text
    let dirMatch = SPEAKER_WITH_DIRECTION.exec(line);
    if (!dirMatch) dirMatch = SPEAKER_WITH_DIRECTION_RELAXED.exec(line);

    if (dirMatch) {
      const speaker = dirMatch[1].trim().toUpperCase();
      const speechStyle = parseSpeechStyle(dirMatch[2]);
      const { clean: rawText, sfx } = extractSFX(dirMatch[3]);
      const text = rawText.replace(/^[""\s]+|[""\s]+$/g, "").trim();
      if (!text) continue;
      allSFX.push(...sfx);
      const isNarrator = isNarratorSpeaker(speaker);
      if (!isNarrator) speakerSet.add(speaker);
      turns.push({ speaker, text, isNarrator, sfxHints: sfx, speechStyle });
      continue;
    }

    // ── Standard speaker line ────────────────────────────────────────────────
    // JOHN: "text"  or  John: "text"
    let match = SPEAKER_LINE.exec(line);
    if (!match) match = SPEAKER_LINE_RELAXED.exec(line);

    if (match) {
      const speaker = match[1].trim().toUpperCase();
      const { clean: rawText, sfx } = extractSFX(match[2]);
      const text = rawText.replace(/^[""\s]+|[""\s]+$/g, "").trim();

      if (!text) continue;

      allSFX.push(...sfx);
      const isNarrator = isNarratorSpeaker(speaker);
      if (!isNarrator) speakerSet.add(speaker);

      turns.push({ speaker, text, isNarrator, sfxHints: sfx });
    } else {
      // Plain paragraph — treat as narrator narration
      const { clean, sfx } = extractSFX(line);
      if (!clean) continue;

      allSFX.push(...sfx);
      turns.push({ speaker: "NARRATOR", text: clean, isNarrator: true, sfxHints: sfx });
    }
  }

  // Merge consecutive same-speaker turns for efficiency
  // Only merge if same speaker AND same speechStyle AND no SFX hints
  const merged: DialogueTurn[] = [];
  for (const turn of turns) {
    const prev = merged[merged.length - 1];
    if (
      prev &&
      prev.speaker === turn.speaker &&
      turn.sfxHints.length === 0 &&
      prev.speechStyle === turn.speechStyle
    ) {
      prev.text += " " + turn.text;
    } else {
      merged.push({ ...turn });
    }
  }

  return {
    turns: merged,
    speakers: Array.from(speakerSet),
    hasSFX: allSFX.length > 0,
    sfxEvents: [...new Set(allSFX)],
    isMultiVoice: speakerSet.size > 0,
  };
}

// Build a plain narration string from turns (for when multi-voice is not available)
export function flattenScriptToNarration(parsed: ParsedScript): string {
  return parsed.turns
    .filter(t => t.text.trim())
    .map(t => t.text)
    .join(" ");
}
