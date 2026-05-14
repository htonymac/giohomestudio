// POST /api/dialogue/generate
//
// Generate a multi-character dialogue clip in one go.
//
// Input: { lines: [{ speakerId, voiceId, text, emotion? }], provider?, sceneIdHint? }
// Output: { audioUrl, durationMs, perLine: [{ speakerId, audioUrl, emotion, durationMs }] }
//
// What this route does that the plain /api/tts can't:
//   1. Calls TTS per line with the *correct character voice* (per voiceId).
//   2. Auto-detects emotion per line via dialogue-emotion module (or honours per-line override).
//   3. Concats the per-line clips with PROPER PACING:
//        - 80 ms gap when same speaker continues (natural breath)
//        - 220 ms gap when speaker changes (turn-taking beat)
//        - 450 ms gap when sceneChanged is true on the next line (story breath)
//   4. Returns one assembled audio file plus per-line metadata so callers can
//      build subtitles, lip-sync stages, or replay individual lines.
//
// Provider chain matches /api/tts. We just call /api/tts internally per line.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { env } from "@/config/env";
import { extractEmotion, gapMsBetween, type Emotion } from "@/lib/dialogue-emotion";

const execFileAsync = promisify(execFile);

interface DialogueLine {
  speakerId: string;            // character ID or display name
  voiceId?: string;             // ElevenLabs/Piper voice — passed through to /api/tts
  text: string;
  emotion?: Emotion;            // optional override (else auto-detected)
  sceneChanged?: boolean;       // true if this line begins a new scene/section (450 ms gap before)
}

interface DialogueRequest {
  lines: DialogueLine[];
  provider?: string;            // "piper" | "fal-narrator" | "elevenlabs" | "auto"
  speed?: number;
  sceneIdHint?: string;         // used in output filename
}

interface PerLineResult {
  speakerId: string;
  voiceId?: string;
  audioUrl: string | null;
  audioPath?: string;
  emotion: Emotion;
  durationMs: number;
  text: string;
  error?: string;
}

/**
 * Resolve a /api/media/... URL back to a local filesystem path so we can
 * concat the audio with FFmpeg. Mirrors the lookup logic used in execute route.
 */
function resolveMediaPathFromUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return null; // would need download — out of scope here
  if (!url.startsWith("/api/media/")) return null;
  const rel = url.replace(/^\/api\/media\//, "").replace(/^\/+/, "");
  const candidate = path.join(env.storagePath, rel);
  if (fs.existsSync(candidate)) return candidate;
  // Try storage subdirs explicitly
  const alt = path.join(env.storagePath, "audio", "tts", path.basename(rel));
  if (fs.existsSync(alt)) return alt;
  return null;
}

export async function POST(req: NextRequest) {
  let body: DialogueRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body" }, { status: 400 });
  }

  const lines = Array.isArray(body.lines) ? body.lines : [];
  if (lines.length === 0) {
    return NextResponse.json({ ok: false, error: "lines[] is empty" }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const perLine: PerLineResult[] = [];

  // ── Step 1: generate each line via /api/tts with detected/forced emotion ──
  // Sequential, not parallel — keeps voice provider rate limits happy and
  // makes per-line failures easier to attribute.
  for (const line of lines) {
    if (!line.text?.trim()) {
      perLine.push({
        speakerId: line.speakerId, voiceId: line.voiceId, audioUrl: null,
        emotion: "neutral", durationMs: 0, text: "", error: "empty text",
      });
      continue;
    }

    const detected = extractEmotion(line.text);
    const effectiveEmotion: Emotion = line.emotion || detected.emotion;

    try {
      const ttsRes = await fetch(`${origin}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: line.text,
          voiceId: line.voiceId,
          provider: body.provider,
          speed: body.speed,
          emotion: effectiveEmotion,
        }),
      });
      const ttsData = await ttsRes.json() as {
        audioUrl?: string; durationMs?: number; error?: string; engine?: string;
      };
      if (!ttsRes.ok || ttsData.error || !ttsData.audioUrl) {
        perLine.push({
          speakerId: line.speakerId, voiceId: line.voiceId, audioUrl: null,
          emotion: effectiveEmotion, durationMs: 0, text: line.text,
          error: ttsData.error || `TTS ${ttsRes.status}`,
        });
        continue;
      }
      const audioPath = resolveMediaPathFromUrl(ttsData.audioUrl) || undefined;
      perLine.push({
        speakerId: line.speakerId,
        voiceId: line.voiceId,
        audioUrl: ttsData.audioUrl,
        audioPath,
        emotion: effectiveEmotion,
        durationMs: ttsData.durationMs || 0,
        text: line.text,
      });
    } catch (err) {
      perLine.push({
        speakerId: line.speakerId, voiceId: line.voiceId, audioUrl: null,
        emotion: effectiveEmotion, durationMs: 0, text: line.text,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Filter to lines with a usable local audio path. Lines that came back as
  // remote URLs we couldn't resolve are still returned in perLine but skipped
  // for the concat step.
  const usable = perLine.filter(p => p.audioPath && fs.existsSync(p.audioPath));
  if (usable.length === 0) {
    return NextResponse.json({
      ok: false,
      error: "No lines produced playable audio — see perLine errors",
      perLine,
    }, { status: 502 });
  }

  // ── Step 2: build a concat filtergraph with per-speaker pacing gaps ──
  // We use FFmpeg's filter_complex with adelay+amix rather than concat demuxer
  // because adelay lets us sprinkle exact gaps between segments at the right offsets.
  // Cumulative offset accounting: each line starts at (prev cumulative end + gap).
  //
  // Why amix instead of concat: amix keeps per-line offsets exact; concat would
  // require lossy padding files. amix with normalize=0 preserves source loudness.

  let cumulativeMs = 0;
  let prevSpeakerId: string | null = null;
  type ScheduledLine = { idx: number; startMs: number; durMs: number; speakerId: string };
  const scheduled: ScheduledLine[] = [];
  for (let i = 0; i < usable.length; i++) {
    const line = usable[i];
    // Was this line marked as "new scene"? — caller controls that flag per line.
    const original = lines.find((l, li) =>
      l.speakerId === line.speakerId && l.text === line.text && perLine.indexOf(line) === li
    );
    const sceneChanged = !!original?.sceneChanged && i > 0;
    const gap = i === 0 ? 0 : gapMsBetween(prevSpeakerId, line.speakerId, sceneChanged);
    cumulativeMs += gap;
    scheduled.push({ idx: i, startMs: cumulativeMs, durMs: line.durationMs || 1000, speakerId: line.speakerId });
    cumulativeMs += line.durationMs || 1000;
    prevSpeakerId = line.speakerId;
  }
  const totalMs = cumulativeMs;

  // Output file path — always WAV for clean concat (we transcode to mp3 only
  // if the caller asks; here we keep it generic).
  const outDir = path.join(env.storagePath, "audio", "dialogue");
  fs.mkdirSync(outDir, { recursive: true });
  const sceneTag = (body.sceneIdHint || "scene").replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  const outFile = path.join(outDir, `dialogue_${sceneTag}_${Date.now()}.wav`);

  // Build inputs + filtergraph
  const inputs: string[] = [];
  scheduled.forEach((s) => {
    const line = usable[s.idx];
    inputs.push("-i", line.audioPath!);
  });

  const filterParts: string[] = [];
  scheduled.forEach((s, i) => {
    // adelay applies to BOTH channels — duplicate value works for mono+stereo.
    // aresample=44100,aformat=stereo so all sources match before amix.
    filterParts.push(
      `[${i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay=${s.startMs}|${s.startMs}[a${i}]`
    );
  });
  const amixInputs = scheduled.map((_, i) => `[a${i}]`).join("");
  filterParts.push(
    `${amixInputs}amix=inputs=${scheduled.length}:duration=longest:normalize=0[mix]`
  );
  // Total duration cap so amix doesn't trail off — pad to totalMs/1000 + 0.3s headroom
  const totalSec = (totalMs / 1000 + 0.3).toFixed(2);
  filterParts.push(
    `[mix]apad=whole_dur=${totalSec},atrim=duration=${totalSec}[out]`
  );

  const ffArgs = [
    ...inputs,
    "-filter_complex", filterParts.join(";"),
    "-map", "[out]",
    "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2",
    "-y", outFile,
  ];

  try {
    await execFileAsync(env.ffmpegPath, ffArgs, { timeout: 120000, maxBuffer: 8 * 1024 * 1024 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({
      ok: false,
      error: `FFmpeg concat failed: ${message.slice(0, 400)}`,
      perLine,
    }, { status: 500 });
  }

  if (!fs.existsSync(outFile) || fs.statSync(outFile).size < 1000) {
    return NextResponse.json({
      ok: false,
      error: "FFmpeg produced empty output",
      perLine,
    }, { status: 500 });
  }

  const audioUrl = `/api/media/audio/dialogue/${path.basename(outFile)}`;
  return NextResponse.json({
    ok: true,
    audioUrl,
    durationMs: totalMs,
    perLine,
    timeline: scheduled.map(s => ({ speakerId: s.speakerId, startMs: s.startMs, durMs: s.durMs })),
  });
}
