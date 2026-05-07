// subtitle-wrap.ts
// Wraps narration/dialogue text into subtitle-safe line chunks.
//
// Rules (from Henry's spec):
//   Words 1–3 chars  → up to 4 per line   ("I am a cat go")
//   Words 4–6 chars  → up to 3 per line   ("they walked home")
//   Words 7+ chars   → up to 2 per line   ("professor returned")
//   Words 15+ chars  → split with hyphen  ("extraordinarily" → "extraordi-\nnarily")
//   Hard cap: 22 characters per line
//   Max 2 lines displayed at once (one chunk)

const MAX_LINE_CHARS = 22;
const MAX_LINES_PER_CHUNK = 2;

function splitLongWord(word: string): string[] {
  if (word.length <= MAX_LINE_CHARS) return [word];
  // Break at MAX_LINE_CHARS - 1 to leave room for hyphen
  const breakAt = MAX_LINE_CHARS - 1;
  const parts: string[] = [];
  let remaining = word;
  while (remaining.length > MAX_LINE_CHARS) {
    parts.push(remaining.slice(0, breakAt) + "-");
    remaining = remaining.slice(breakAt);
  }
  parts.push(remaining);
  return parts;
}

function maxWordsForLength(wordLen: number): number {
  if (wordLen <= 3) return 4;
  if (wordLen <= 6) return 3;
  return 2;
}

/**
 * Wraps text into subtitle chunks (arrays of lines).
 * Each chunk is what's displayed on screen at one moment.
 * Returns an array of chunks — each chunk is an array of 1-2 lines.
 */
export function wrapSubtitleText(text: string): string[][] {
  const rawWords = text.trim().split(/\s+/).filter(Boolean);
  const words: string[] = [];

  // Expand any extremely long words into hyphen-broken parts
  for (const w of rawWords) {
    const parts = splitLongWord(w);
    words.push(...parts);
  }

  const chunks: string[][] = [];
  let currentLines: string[] = [];
  let currentLine = "";
  let currentLineWordCount = 0;

  function flushLine() {
    if (currentLine.trim()) {
      currentLines.push(currentLine.trim());
      currentLine = "";
      currentLineWordCount = 0;
    }
  }

  function flushChunk() {
    flushLine();
    if (currentLines.length > 0) {
      chunks.push([...currentLines]);
      currentLines = [];
    }
  }

  for (const word of words) {
    const wordLen = word.replace("-", "").length; // don't count hyphen in length
    const maxWords = maxWordsForLength(wordLen);
    const wouldExceedChars = (currentLine + (currentLine ? " " : "") + word).length > MAX_LINE_CHARS;
    const wouldExceedWordCount = currentLineWordCount >= maxWords;

    if (wouldExceedChars || wouldExceedWordCount) {
      flushLine();
      // If we already have MAX_LINES_PER_CHUNK lines, start a new chunk
      if (currentLines.length >= MAX_LINES_PER_CHUNK) {
        flushChunk();
      }
    }

    currentLine = currentLine ? currentLine + " " + word : word;
    currentLineWordCount++;
  }

  flushChunk();
  return chunks;
}

/**
 * Assigns timing to each subtitle chunk based on total audio duration.
 * Returns chunks with startMs and endMs.
 */
export interface TimedSubtitleChunk {
  lines: string[];
  startMs: number;
  endMs: number;
  text: string; // joined lines for display
}

export function assignSubtitleTiming(
  text: string,
  durationMs: number
): TimedSubtitleChunk[] {
  const chunks = wrapSubtitleText(text);
  if (chunks.length === 0) return [];

  const msPerChunk = durationMs / chunks.length;

  return chunks.map((lines, i) => ({
    lines,
    startMs: Math.round(i * msPerChunk),
    endMs: Math.round((i + 1) * msPerChunk),
    text: lines.join("\n"),
  }));
}

/**
 * Converts timed subtitle chunks to SRT format string.
 * SRT is universally supported by FFmpeg and video players.
 */
export function chunksToSRT(chunks: TimedSubtitleChunk[]): string {
  return chunks
    .map((chunk, i) => {
      const start = msToSRTTime(chunk.startMs);
      const end = msToSRTTime(chunk.endMs);
      return `${i + 1}\n${start} --> ${end}\n${chunk.text}\n`;
    })
    .join("\n");
}

function msToTimeParts(ms: number) {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return { h, m, s, millis: ms % 1000 };
}

function msToSRTTime(ms: number): string {
  const { h, m, s, millis } = msToTimeParts(ms);
  return `${pad2(h)}:${pad2(m)}:${pad2(s)},${pad3(millis)}`;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function pad3(n: number) { return String(n).padStart(3, "0"); }

/**
 * Converts timed subtitle chunks to ASS format string.
 * ASS supports custom styling (karaoke, colors, fonts, shadows).
 */
export function chunksToASS(
  chunks: TimedSubtitleChunk[],
  style: "clean" | "bold-pop" | "cinematic" | "nollywood" = "clean"
): string {
  const styleMap = {
    "clean":      "Style: Default,Arial,24,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,2,0,2,10,10,10,0",
    "bold-pop":   "Style: Default,Arial Black,28,&H00FFFFFF,&H000000FF,&H00222222,&H90000000,-1,-1,0,0,100,100,0,0,1,3,0,2,10,10,12,0",
    "cinematic":  "Style: Default,Arial,20,&H00F0F0F0,&H000000FF,&H00000000,&HC0000000,0,0,0,0,100,100,0,0,1,1,2,2,20,20,15,0",
    "nollywood":  "Style: Default,Arial Black,30,&H0000FFFF,&H000000FF,&H00000000,&H90000000,-1,-1,0,0,100,100,0,0,1,3,0,2,10,10,10,0",
  };

  const header = `[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
${styleMap[style]}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  const events = chunks.map(chunk => {
    const start = msToASSTime(chunk.startMs);
    const end = msToASSTime(chunk.endMs);
    const text = chunk.lines.join("\\N"); // ASS newline
    return `Dialogue: 0,${start},${end},Default,,0,0,0,,${text}`;
  }).join("\n");

  return header + events;
}

function msToASSTime(ms: number): string {
  const { h, m, s, millis } = msToTimeParts(ms);
  return `${h}:${pad2(m)}:${(s + millis / 1000).toFixed(2).padStart(5, "0")}`;
}
