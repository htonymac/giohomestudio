// GioHomeStudio — FFmpeg Merge Module
// Merges video + voice + music + optional SFX into a single output file.
// Also provides audio-only merge (voice + music → MP3) and audio concatenation.

import ffmpeg from "fluent-ffmpeg";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import { toFFmpegPath, escapeDrawtext, escapeFontPath, resolveFontFile, cleanupTempFile, wrapCaptionText, isActualFile } from "./utils";

ffmpeg.setFfmpegPath(env.ffmpegPath);
ffmpeg.setFfprobePath(env.ffprobePath);

// ── Private helpers ───────────────────────────────────────────────────────────

// Build filter graph entries for a flat (untimed) SFX mix.
// Caller adds the returned mixLabel to the amix input list.
function buildFlatSFXFilter(
  paths: string[],
  startIdx: number,
  volume: number
): { filters: string[]; mixLabel: string } {
  const filters: string[] = [];
  if (paths.length === 1) {
    filters.push(`[${startIdx}:a]volume=${volume}[sfx]`);
  } else {
    const labels = paths.map((_, i) => `[${startIdx + i}:a]`).join("");
    filters.push(`${labels}amix=inputs=${paths.length}:duration=longest:normalize=0[sfxraw]`);
    filters.push(`[sfxraw]volume=${volume}[sfx]`);
  }
  return { filters, mixLabel: "[sfx]" };
}

// A timed SFX cue — placed at startMs into the output rather than flat-mixed from the start.
// Produced by the beat parser when script contains [SFX:] or [AMBIENCE:] tags with position info.
export interface SFXCue {
  path: string;
  startMs: number;
  volume?: number; // defaults to sfxVolume
}

export interface MergeInput {
  videoPath: string;
  voicePath?: string | null;
  musicPath?: string | null;
  sfxPaths?: string[];      // flat SFX mix (no timing) — used when no beat timeline
  sfxCues?: SFXCue[];       // timed SFX cues from beat parser — takes precedence over sfxPaths
  outputFileName: string;
  musicVolume?: number;     // 0.0 - 1.0, default 0.85
  voiceVolume?: number;     // 0.0 - 1.0, default 1.0
  sfxVolume?: number;       // 0.0 - 1.0, default 0.3 (ambient, under narration)
}

export interface MergeOutput {
  success: boolean;
  outputPath?: string;
  error?: string;
}

// Build the SFX portion of a filter graph from timed cues.
// Each cue is delayed to its startMs using adelay, then all are mixed together.
// Returns { filters, label } to be included in the parent filter graph.
function buildTimedSFXFilter(
  cues: Array<{ path: string; startMs: number; volume?: number }>,
  startInputIdx: number,
  defaultVolume: number
): { filters: string[]; mixLabel: string } {
  const filters: string[] = [];
  const cueLabels: string[] = [];

  cues.forEach((cue, i) => {
    const idx = startInputIdx + i;
    const vol = cue.volume ?? defaultVolume;
    const delayMs = cue.startMs;
    // adelay takes per-channel delay in ms; stereo needs both channels
    filters.push(`[${idx}:a]adelay=${delayMs}|${delayMs},volume=${vol}[sfxcue${i}]`);
    cueLabels.push(`[sfxcue${i}]`);
  });

  if (cueLabels.length === 1) {
    return { filters, mixLabel: cueLabels[0] };
  }
  filters.push(`${cueLabels.join("")}amix=inputs=${cueLabels.length}:duration=longest:normalize=0[sfxmixed]`);
  return { filters, mixLabel: "[sfxmixed]" };
}

export async function mergeMedia(input: MergeInput): Promise<MergeOutput> {
  const {
    videoPath,
    voicePath,
    musicPath,
    sfxCues,
    sfxPaths = [],
    outputFileName,
    musicVolume = 0.85,
    voiceVolume = 1.0,
    sfxVolume = 0.3,
  } = input;

  // isActualFile guards against empty strings, ".", relative dirs — fs.existsSync(".")
  // returns true on Windows (CWD is a directory) and path.resolve(".") = project root.
  if (!isActualFile(videoPath)) {
    const abs = videoPath?.trim() ? toFFmpegPath(path.resolve(videoPath)) : "(empty)";
    return { success: false, error: `videoPath is not a file: ${abs}` };
  }

  const outputDir = path.resolve(env.storagePath, "merged");
  fs.mkdirSync(outputDir, { recursive: true });
  const absVideo  = toFFmpegPath(path.resolve(videoPath));
  const absOutput = toFFmpegPath(path.join(outputDir, outputFileName));

  const absVoice = voicePath ? toFFmpegPath(path.resolve(voicePath)) : null;
  const absMusic = musicPath ? toFFmpegPath(path.resolve(musicPath)) : null;

  const hasVoice = !!(absVoice && isActualFile(absVoice));
  const hasMusic = !!(absMusic && isActualFile(absMusic));

  // Prefer timed cues when provided; fall back to flat sfxPaths
  const validCues = (sfxCues ?? []).filter(c => isActualFile(c.path));
  const validSFX = validCues.length > 0 ? [] : sfxPaths.filter(p => isActualFile(p));
  const hasCues = validCues.length > 0;
  const hasFlatSFX = validSFX.length > 0;

  console.log(`[mergeMedia] video=${absVideo} voice=${absVoice ?? "-"} music=${absMusic ?? "-"} output=${absOutput}`);

  return new Promise((resolve) => {
    const cmd = ffmpeg(absVideo);
    cmd.on("start", (cmdStr: string) => console.log(`[mergeMedia] cmd: ${cmdStr}`));

    let inputIdx = 1;
    const voiceIdx = hasVoice ? inputIdx++ : -1;
    const musicIdx = hasMusic ? inputIdx++ : -1;
    const sfxStartIdx = inputIdx;

    if (hasVoice) cmd.input(absVoice!);
    if (hasMusic) {
      // -stream_loop -1 loops music at the demuxer level — zero memory overhead.
      // Two explicit args to avoid fluent-ffmpeg space-splitting ambiguity.
      // -shortest (in outputOptions) caps output to video length.
      cmd.input(absMusic!);
      cmd.inputOptions(['-stream_loop', '-1']);
    }
    if (hasCues) {
      for (const cue of validCues) cmd.input(toFFmpegPath(path.resolve(cue.path)));
    } else {
      for (const sfxPath of validSFX) cmd.input(toFFmpegPath(path.resolve(sfxPath)));
    }

    // Build filter complex
    const filters: string[] = [];
    const mixInputs: string[] = [];

    if (hasVoice) {
      filters.push(`[${voiceIdx}:a]volume=${voiceVolume}[voice]`);
      mixInputs.push("[voice]");
    }
    if (hasMusic) {
      filters.push(`[${musicIdx}:a]volume=${musicVolume}[music]`);
      mixInputs.push("[music]");
    }
    if (hasCues) {
      const { filters: cueFilters, mixLabel } = buildTimedSFXFilter(validCues, sfxStartIdx, sfxVolume);
      filters.push(...cueFilters);
      mixInputs.push(mixLabel);
    } else if (hasFlatSFX) {
      const { filters: sfxFilters, mixLabel } = buildFlatSFXFilter(validSFX, sfxStartIdx, sfxVolume);
      filters.push(...sfxFilters);
      mixInputs.push(mixLabel);
    }

    if (mixInputs.length >= 2) {
      filters.push(`${mixInputs.join("")}amix=inputs=${mixInputs.length}:duration=first:dropout_transition=2:normalize=0[aout]`);
      cmd
        .complexFilter(filters)
        .outputOptions(["-map 0:v", "-map [aout]", "-c:v copy", "-c:a aac", "-shortest"]);
    } else if (mixInputs.length === 1) {
      cmd
        .complexFilter(filters)
        .outputOptions(["-map 0:v", `-map ${mixInputs[0]}`, "-c:v copy", "-c:a aac", "-shortest"]);
    } else {
      cmd.outputOptions(["-c copy"]);
    }

    cmd
      .output(absOutput)
      .on("end", () => resolve({ success: true, outputPath: absOutput }))
      .on("error", (err: Error) => resolve({ success: false, error: err.message }))
      .run();
  });
}

// ── Audio-only merge ──────────────────────────────────────────────────────────
// Combines voice + music (+ optional SFX) into a single MP3 output.
// Used when audioMode = "audio_only" (no video generation).

export interface AudioOnlyMergeInput {
  voicePath?: string | null;
  musicPath?: string | null;
  sfxPaths?: string[];
  sfxCues?: SFXCue[];            // timed SFX cues from beat parser — takes precedence over sfxPaths
  outputFileName: string;        // must end in .mp3 or .wav
  musicVolume?: number;
  voiceVolume?: number;
  sfxVolume?: number;
}

export async function mergeAudioOnly(input: AudioOnlyMergeInput): Promise<MergeOutput> {
  const {
    voicePath,
    musicPath,
    sfxCues,
    sfxPaths = [],
    outputFileName,
    musicVolume = 0.85,
    voiceVolume = 1.0,
    sfxVolume = 0.3,
  } = input;

  const absVoice = voicePath ? toFFmpegPath(path.resolve(voicePath)) : null;
  const absMusic = musicPath ? toFFmpegPath(path.resolve(musicPath)) : null;

  const hasVoice = !!(absVoice && fs.existsSync(absVoice));
  const hasMusic = !!(absMusic && fs.existsSync(absMusic));

  // Prefer timed cues when provided; fall back to flat sfxPaths
  const validCues = (sfxCues ?? []).filter(c => fs.existsSync(c.path));
  const validSFX = validCues.length > 0 ? [] : sfxPaths.filter(p => fs.existsSync(p));
  const hasCues = validCues.length > 0;
  const hasFlatSFX = validSFX.length > 0;

  if (!hasVoice && !hasMusic && !hasCues && !hasFlatSFX) {
    return { success: false, error: "No audio sources provided for audio-only merge" };
  }

  const outputDir = path.resolve(env.storagePath, "merged");
  fs.mkdirSync(outputDir, { recursive: true });
  const absOutput = toFFmpegPath(path.join(outputDir, outputFileName));

  const inputs: string[] = [];
  if (hasVoice) inputs.push(absVoice!);
  if (hasMusic) inputs.push(absMusic!);
  if (hasCues) {
    for (const c of validCues) inputs.push(toFFmpegPath(path.resolve(c.path)));
  } else {
    for (const s of validSFX) inputs.push(toFFmpegPath(path.resolve(s)));
  }

  return new Promise((resolve) => {
    const cmd = ffmpeg();
    for (const inp of inputs) cmd.input(inp);

    const filters: string[] = [];
    const mixLabels: string[] = [];
    let i = 0;

    if (hasVoice) {
      filters.push(`[${i++}:a]volume=${voiceVolume}[voice]`);
      mixLabels.push("[voice]");
    }
    if (hasMusic) {
      filters.push(`[${i++}:a]volume=${musicVolume}[music]`);
      mixLabels.push("[music]");
    }
    if (hasCues) {
      const { filters: cueFilters, mixLabel } = buildTimedSFXFilter(validCues, i, sfxVolume);
      filters.push(...cueFilters);
      mixLabels.push(mixLabel);
    } else if (hasFlatSFX) {
      const { filters: sfxFilters, mixLabel } = buildFlatSFXFilter(validSFX, i, sfxVolume);
      filters.push(...sfxFilters);
      mixLabels.push(mixLabel);
    }

    if (mixLabels.length >= 2) {
      filters.push(`${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=2:normalize=0[aout]`);
      cmd.complexFilter(filters).outputOptions(["-map [aout]", "-c:a libmp3lame", "-q:a 2"]);
    } else {
      const label = mixLabels[0];
      cmd.complexFilter(filters).outputOptions([`-map ${label}`, "-c:a libmp3lame", "-q:a 2"]);
    }

    cmd
      .output(absOutput)
      .on("end", () => resolve({ success: true, outputPath: absOutput }))
      .on("error", (err: Error) => resolve({ success: false, error: err.message }))
      .run();
  });
}

// ── Audio concatenation ───────────────────────────────────────────────────────
// Joins multiple audio files end-to-end in order.
// Used to stitch per-speaker dialogue turns into one voice track.

export async function concatenateAudio(
  audioPaths: string[],
  outputPath: string
): Promise<MergeOutput> {
  const existing = audioPaths.filter(p => fs.existsSync(p));
  if (existing.length === 0) {
    return { success: false, error: "No valid audio files to concatenate" };
  }
  if (existing.length === 1) {
    // Single file — just copy it
    fs.copyFileSync(existing[0], outputPath);
    return { success: true, outputPath };
  }

  const dir = path.dirname(outputPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const listFile = path.resolve(outputPath + ".concat_list.txt");
  const absOut = path.resolve(outputPath);
  fs.writeFileSync(listFile, existing.map(p => `file '${toFFmpegPath(path.resolve(p))}'`).join("\n"));

  return new Promise((resolve) => {
    ffmpeg()
      .input(toFFmpegPath(listFile))
      .inputOptions(["-f concat", "-safe 0"])
      .outputOptions(["-c:a libmp3lame", "-q:a 2"])
      .output(toFFmpegPath(absOut))
      .on("end", () => {
        cleanupTempFile(listFile);
        resolve({ success: true, outputPath: absOut });
      })
      .on("error", (err: Error) => {
        cleanupTempFile(listFile);
        resolve({ success: false, error: err.message });
      })
      .run();
  });
}

// ── Image slideshow ───────────────────────────────────────────────────────────
// Builds a silent MP4 from an ordered list of still images, each held for its
// beat duration. Output is then passed to mergeMedia() to add audio.
// Uses the concat demuxer — requires -safe 0 since paths can be absolute.

export interface SlideshowCaptionStyle {
  fontSize?: number;        // default 36
  fontFamily?: string;      // e.g. "Arial"
  color?: string;           // hex e.g. "#FFFFFF"
  bgColor?: string;         // drawtext boxcolor, e.g. "black@0.5" — "" means no box
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;  // stored but not applied — FFmpeg drawtext has no native underline
  position?: "top" | "center" | "bottom";  // default "bottom"
}

export type MotionPreset = "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down" | "none" | "auto" | "random";
export type TransitionType = "fade" | "slide-left" | "slide-right" | "zoom-in" | "none";

export interface SlideshowFrame {
  imagePath: string;          // absolute path to PNG/JPG
  durationMs: number;         // how long to show this frame
  captionText?: string;       // on-screen overlay text (independent from narration)
  captionStyle?: SlideshowCaptionStyle;
  motionPreset?: MotionPreset; // per-slide Ken Burns preset; "auto" or undefined = cycle; "none" = static
}

// ── Video trim ───────────────────────────────────────────────────────────────
// Cuts a video from startSec to endSec using stream copy (no re-encode).
// Uses input seek (-ss) for speed; output is identical quality to source.

export async function trimVideo(
  inputPath: string,
  outputPath: string,
  startSec: number,
  endSec: number
): Promise<MergeOutput> {
  const absInput  = path.resolve(inputPath);
  const absOutput = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(absOutput), { recursive: true });

  return new Promise((resolve) => {
    ffmpeg()
      .input(toFFmpegPath(absInput))
      .inputOptions([`-ss ${startSec}`])
      .outputOptions([`-t ${endSec - startSec}`, "-c copy", "-movflags +faststart"])
      .output(toFFmpegPath(absOutput))
      .on("end", () => resolve({ success: true, outputPath: absOutput }))
      .on("error", (err: Error) => resolve({ success: false, error: err.message }))
      .run();
  });
}

function buildAnimatedCaption(
  text: string,
  style: SlideshowCaptionStyle | undefined,
): string {
  const fontSize  = style?.fontSize  ?? 36;
  const fontColor = (style?.color ?? "#FFFFFF").replace("#", "0x");
  const bgColor   = style?.bgColor !== undefined ? style.bgColor : "black@0.5";
  const fontFile  = resolveFontFile({
    fontFamily: style?.fontFamily,
    bold:       style?.fontBold,
    italic:     style?.fontItalic,
  });
  const maxChars = Math.max(18, Math.floor(32 * 36 / Math.max(fontSize, 18)));
  const wrapped  = wrapCaptionText(text, maxChars);

  // Use lte()/gt() instead of <= and > — the 2026-03 FFmpeg build broke infix
  // comparison operators inside drawtext option expressions (returns -22 EINVAL).
  const fade  = "lte(t,0.4)*(t/0.4)+gt(t,0.4)";
  const baseY = style?.position === "top"    ? "h*0.06"
              : style?.position === "center" ? "(h-text_h)/2"
              : "h*0.85";
  const yExpr = (style?.position === "top" || style?.position === "center")
    ? baseY
    : `${baseY}+h*0.12*(1-(${fade}))`;

  const parts: string[] = [
    `fontfile=${escapeFontPath(fontFile)}`,
    `text='${escapeDrawtext(wrapped)}'`,
    `fontsize=${fontSize}`,
    `fontcolor=${fontColor}`,
    `alpha='${fade}'`,
    `x=(w-text_w)/2`,
    `y='${yExpr}'`,
    "shadowx=2:shadowy=2:shadowcolor=black@0.6",
    "fix_bounds=1",
  ];
  if (bgColor) parts.push(`box=1:boxcolor=${bgColor}:boxborderw=6`);
  return `drawtext=${parts.join(":")}`;
}

// Maps our TransitionType to FFmpeg xfade filter transition names
const XFADE_MAP: Record<string, string> = {
  "fade":        "fade",
  "slide-left":  "slideleft",
  "slide-right": "slideright",
  "zoom-in":     "zoomin",
};

export type RenderQuality = "draft" | "standard" | "high" | "cinema";

/** CRF + preset + optional sharpening unsharp filter per quality level */
const QUALITY_ENCODE: Record<RenderQuality, { crf: number; preset: string; unsharp: string }> = {
  draft:    { crf: 26, preset: "fast",   unsharp: "" },
  standard: { crf: 20, preset: "medium", unsharp: "" },
  high:     { crf: 16, preset: "slow",   unsharp: ",unsharp=3:3:0.8:3:3:0" },
  cinema:   { crf: 12, preset: "slow",   unsharp: ",unsharp=5:5:1.2:3:3:0" },
};

export async function createSlideshow(
  frames: SlideshowFrame[],
  outputPath: string,
  aspectRatio: "9:16" | "16:9" | "1:1" = "9:16",
  opts: {
    skipKenBurns?: boolean;
    transitionType?: TransitionType;
    transitionDurationSec?: number;
    /** Quality for this specific encode pass. "lossless" = CRF 0 for lossless intermediate */
    quality?: RenderQuality | "lossless";
  } = {}
): Promise<MergeOutput> {
  // isActualFile rejects empty strings, ".", and directories — fs.existsSync passes for dirs
  // which would let path.resolve(".") = project root reach FFmpeg → exit -13 (EACCES).
  const valid = frames.filter(f => isActualFile(f.imagePath));
  if (valid.length === 0) {
    const rejected = frames.map(f => `${f.imagePath}(exists=${fs.existsSync(f.imagePath ?? "")})`).join(", ");
    console.error(`[createSlideshow] No valid image files. Frames: ${rejected}`);
    return { success: false, error: "No valid image frames for slideshow" };
  }

  const dir = path.dirname(outputPath);
  fs.mkdirSync(dir, { recursive: true });
  const absOut = toFFmpegPath(path.resolve(outputPath));

  // Resolve encode settings
  const qualityKey = (!opts.quality || opts.quality === "lossless") ? null : opts.quality;
  const enc = qualityKey ? QUALITY_ENCODE[qualityKey] : QUALITY_ENCODE.standard;
  const encodeOpts = opts.quality === "lossless"
    ? ["-c:v libx264", "-crf 0", "-preset ultrafast"]
    : [`-crf ${enc.crf}`, `-preset ${enc.preset}`, "-c:v libx264"];

  if (opts.skipKenBurns) {
    const DIMS2: Record<string, { w: number; h: number }> = {
      "9:16": { w: 832, h: 1472 }, "16:9": { w: 1216, h: 832 }, "1:1": { w: 1024, h: 1024 },
    };
    const { w: w2, h: h2 } = DIMS2[aspectRatio] ?? DIMS2["9:16"];
    return createSlideshowStatic(valid, absOut, w2, h2, encodeOpts);
  }

  const DIMS: Record<string, { w: number; h: number }> = {
    "9:16": { w: 832,  h: 1472 },
    "16:9": { w: 1216, h: 832  },
    "1:1":  { w: 1024, h: 1024 },
  };
  const { w, h } = DIMS[aspectRatio] ?? DIMS["9:16"];
  const OUT_FPS = 24;
  // zoompan runs at half rate then upsamples — 2× faster with no visible quality loss.
  const ZP_FPS = 12;
  // Pre-scale 60 % larger than output so zoompan always has pixels to work with at max zoom (1.5×).
  const pw = Math.round(w * 1.6);
  const ph = Math.round(h * 1.6);

  // 'on' = output frame index, 'd' = total frames — no function-call commas → no parse errors.
  // zoompan outputs at ZP_FPS; fps filter upsamples to OUT_FPS.
  type KBFn = (d: number) => string;
  const KB: KBFn[] = [
    // zoom-in: 1.0 → 1.5 (centred)
    d => `zoompan=z='1.0+(on/${d})*0.5':x='iw/2-iw/(1.0+(on/${d})*0.5)/2':y='ih/2-ih/(1.0+(on/${d})*0.5)/2':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`,
    // zoom-out: 1.5 → 1.0 (centred)
    d => `zoompan=z='1.5-(on/${d})*0.5':x='iw/2-iw/(1.5-(on/${d})*0.5)/2':y='ih/2-ih/(1.5-(on/${d})*0.5)/2':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`,
    // pan left → right (z=1.2)
    d => `zoompan=z=1.2:x='(iw-iw/1.2)*on/${d}':y='ih/2-ih/1.2/2':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`,
    // pan right → left (z=1.2)
    d => `zoompan=z=1.2:x='(iw-iw/1.2)*(1-on/${d})':y='ih/2-ih/1.2/2':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`,
    // pan top → bottom (z=1.2)
    d => `zoompan=z=1.2:x='iw/2-iw/1.2/2':y='(ih-ih/1.2)*on/${d}':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`,
    // pan bottom → top (z=1.2)
    d => `zoompan=z=1.2:x='iw/2-iw/1.2/2':y='(ih-ih/1.2)*(1-on/${d})':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`,
  ];

  // Static Ken Burns preset: zoompan with z=1.0 and no movement
  const kbStatic = (d: number) =>
    `zoompan=z=1.0:x='iw/2-iw/2':y='ih/2-ih/2':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`;

  // Map motionPreset string to the correct KB function
  const KB_NAMED: Record<string, KBFn> = {
    "zoom-in":  KB[0],
    "zoom-out": KB[1],
    "pan-left": KB[2],
    "pan-right": KB[3],
    "pan-up":   KB[4],
    "pan-down": KB[5],
    "none":     kbStatic,
  };

  const cmd     = ffmpeg();
  const segs: string[] = [];

  valid.forEach((f, i) => {
    const src    = toFFmpegPath(path.resolve(f.imagePath));
    const durSec = f.durationMs / 1000;
    const d      = Math.max(2, Math.round(durSec * ZP_FPS));

    // Each image is a looped still; -loop 1 + -t constrain its duration.
    cmd.input(src);
    cmd.inputOptions(["-loop", "1", "-t", String(durSec)]);

    // Pick KB function:
    //   named preset → specific function
    //   "random"     → random pick from KB[] each frame (no repeats until all used — Fisher-Yates shuffle)
    //   "auto"/undef → cycle through KB[] in order
    const preset = f.motionPreset;
    let kbFn: KBFn;
    if (preset && preset !== "auto" && preset !== "random" && KB_NAMED[preset]) {
      kbFn = KB_NAMED[preset];
    } else if (preset === "random") {
      kbFn = KB[Math.floor(Math.random() * KB.length)];
    } else {
      kbFn = KB[i % KB.length];
    }

    // Scale to pre-zoom size (lanczos = sharper than default bilinear) → Ken Burns → upsample → format → optional sharpening → optional caption → label
    let seg = `[${i}:v]scale=${pw}:${ph}:force_original_aspect_ratio=increase:flags=lanczos,crop=${pw}:${ph},${kbFn(d)},format=yuv420p${enc.unsharp}`;
    if (f.captionText?.trim()) {
      seg += `,${buildAnimatedCaption(f.captionText.trim(), f.captionStyle)}`;
    }
    seg += `[v${i}]`;
    segs.push(seg);
  });

  // Build concat or xfade transition chain
  const tType = opts.transitionType;
  if (tType && tType !== "none" && valid.length >= 2) {
    // Clamp transition duration so it never exceeds 90% of the shortest slide
    const minDurSec = Math.min(...valid.map(f => f.durationMs / 1000));
    const tDur = Math.min(opts.transitionDurationSec ?? 0.5, minDurSec * 0.9);
    const xfadeName = XFADE_MAP[tType] ?? "fade";

    // Compute per-transition offsets (relative to cumulative start of chain)
    // offset[i] = sum(d[0..i]) - (i+1)*tDur
    let cumulSec = 0;
    const xfadeOffsets: number[] = [];
    valid.forEach((f, i) => {
      cumulSec += f.durationMs / 1000;
      if (i < valid.length - 1) {
        xfadeOffsets.push(Math.max(0.05, cumulSec - (i + 1) * tDur));
      }
    });

    // Chain: [v0][v1]xfade=...offset=o0[x1]; [x1][v2]xfade=...offset=o1[x2]; ...
    let prevLabel = "[v0]";
    for (let i = 1; i < valid.length; i++) {
      const outLabel = i === valid.length - 1 ? "[outv]" : `[x${i}]`;
      segs.push(`${prevLabel}[v${i}]xfade=transition=${xfadeName}:duration=${tDur.toFixed(3)}:offset=${xfadeOffsets[i - 1].toFixed(3)}${outLabel}`);
      prevLabel = outLabel;
    }
  } else {
    segs.push(`${valid.map((_, i) => `[v${i}]`).join("")}concat=n=${valid.length}:v=1:a=0[outv]`);
  }

  const imgList = valid.map((f, i) => `[${i}]${toFFmpegPath(path.resolve(f.imagePath))}`).join(" ");
  console.log(`[createSlideshow] ${valid.length} frames → ${absOut} | inputs: ${imgList}`);

  return new Promise((resolve) => {
    cmd
      .on("start", (cmdStr: string) => console.log(`[createSlideshow] cmd: ${cmdStr}`))
      .complexFilter(segs.join(";"))
      .outputOptions(["-map [outv]", ...encodeOpts, "-movflags +faststart", "-an"])
      .output(absOut)
      .on("end",  () => resolve({ success: true, outputPath: absOut }))
      .on("error", (err: Error) => {
        console.warn(`[createSlideshow] Ken Burns failed (${err.message}) — falling back to static slideshow`);
        createSlideshowStatic(valid, absOut, w, h, encodeOpts).then(resolve);
      })
      .run();
  });
}

// Fallback: plain concat-demuxer slideshow with static drawtext captions.
function createSlideshowStatic(
  frames: SlideshowFrame[],
  absOut: string,
  w: number,
  h: number,
  encodeOpts: string[] = ["-c:v libx264", "-crf 20", "-preset medium"],
): Promise<MergeOutput> {
  const listFile = absOut + ".fallback.txt";
  const lines: string[] = [];
  let vf = `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:black,fps=24,format=yuv420p`;

  // Build concat list + per-slide caption overlays in one pass.
  // gte()/lte() instead of >= and <= — infix comparison operators are broken in the 2026-03 FFmpeg build.
  let tSec = 0;
  for (const f of frames) {
    lines.push(`file '${toFFmpegPath(path.resolve(f.imagePath))}'`);
    lines.push(`duration ${(f.durationMs / 1000).toFixed(3)}`);
    const startSec = tSec;
    tSec += f.durationMs / 1000;
    if (f.captionText?.trim()) {
      const wrapped  = wrapCaptionText(f.captionText.trim());
      const escaped  = escapeDrawtext(wrapped);
      const fontFile = resolveFontFile({ fontFamily: f.captionStyle?.fontFamily, bold: f.captionStyle?.fontBold, italic: f.captionStyle?.fontItalic });
      const fontSize = f.captionStyle?.fontSize ?? 28;
      const pos      = f.captionStyle?.position ?? "bottom";
      const yExpr    = pos === "top" ? "h*0.06" : pos === "center" ? "(h-text_h)/2" : "h*0.85";
      vf += `,drawtext=fontfile='${escapeFontPath(fontFile)}':text='${escaped}':fontsize=${fontSize}:fontcolor=white:borderw=2:bordercolor=black:x=(w-text_w)/2:y=${yExpr}:enable='gte(t,${startSec.toFixed(3)})*lte(t,${tSec.toFixed(3)})'`;
    }
  }
  // Concat demuxer requires the last entry repeated without duration (signals EOF).
  lines.push(`file '${toFFmpegPath(path.resolve(frames[frames.length - 1].imagePath))}'`);

  try {
    fs.writeFileSync(listFile, lines.join("\n"));
  } catch (err) {
    return Promise.resolve({ success: false, error: `Failed to write concat list: ${err}` });
  }

  return new Promise((resolve) => {
    ffmpeg()
      .input(toFFmpegPath(listFile))
      .inputOptions(["-f concat", "-safe 0"])
      .videoFilter(vf)
      .outputOptions([...encodeOpts, "-movflags +faststart", "-an"])
      .output(absOut)
      .on("end",  () => { cleanupTempFile(listFile); resolve({ success: true, outputPath: absOut }); })
      .on("error", (err: Error) => { cleanupTempFile(listFile); resolve({ success: false, error: err.message }); })
      .run();
  });
}
