// GioHomeStudio — Piper TTS Voice Provider
// Local text-to-speech using Piper (https://github.com/rhasspy/piper)
// Runs entirely on CPU, no API keys needed, free forever.
//
// Setup:
//   pip install piper-tts
//   — OR —
//   Download binary from https://github.com/rhasspy/piper/releases
//
// Models are downloaded automatically on first use to storage/piper-models/
// Default voice: "en_US-lessac-medium" (natural female, 16kHz)

import { execFile } from "child_process";
import { promisify } from "util";
import * as path from "path";
import * as fs from "fs";
import { env } from "@/config/env";
import type { IVoiceProvider, VoiceGenerationInput, VoiceGenerationOutput } from "@/types/providers";

const execFileAsync = promisify(execFile);
const FFMPEG_PATH = process.env.FFMPEG_PATH ?? "C:\\ffmpeg\\bin\\ffmpeg.exe";

// Piper voice models — id maps to the ONNX model name used by piper-tts
// Add more from: https://rhasspy.github.io/piper-samples/
const PIPER_VOICES: Array<{ id: string; name: string; lang: string }> = [
  { id: "en_US-lessac-medium",   name: "Lessac (US Female, Natural)",   lang: "en" },
  { id: "en_US-amy-medium",      name: "Amy (US Female, Warm)",         lang: "en" },
  { id: "en_US-ryan-medium",     name: "Ryan (US Male, Clear)",         lang: "en" },
  { id: "en_US-arctic-medium",   name: "Arctic (US Male, Deep)",        lang: "en" },
  { id: "en_GB-alan-medium",     name: "Alan (British Male)",           lang: "en" },
  { id: "en_GB-alba-medium",     name: "Alba (British Female)",         lang: "en" },
];

const DEFAULT_VOICE = "en_US-lessac-medium";

export function getPiperVoices() { return PIPER_VOICES; }

// Check if piper is available
async function findPiper(): Promise<string | null> {
  // Check common locations
  const candidates = [
    process.env.PIPER_PATH,
    "piper",                              // on PATH
    "piper-tts",                          // pip install name
    path.join(env.storagePath, "piper", "piper"),
    path.join(env.storagePath, "piper", "piper.exe"),
  ].filter(Boolean) as string[];

  for (const cmd of candidates) {
    try {
      await execFileAsync(cmd, ["--help"], { timeout: 5000 });
      return cmd;
    } catch {
      // not found, try next
    }
  }

  // Try Python module mode: python -m piper
  try {
    const pythonCmd = process.platform === "win32" ? "python" : "python3";
    await execFileAsync(pythonCmd, ["-m", "piper", "--help"], { timeout: 5000 });
    return `${pythonCmd} -m piper`;
  } catch {
    // not available
  }

  return null;
}

// Download model if not present (piper-tts handles this automatically,
// but we set the data dir so models are stored in our storage folder)
function getModelDir(): string {
  const dir = path.join(env.storagePath, "piper-models");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

class PiperVoiceProvider implements IVoiceProvider {
  readonly name = "piper";
  private piperCmd: string | null = null;
  private checked = false;

  private async ensurePiper(): Promise<string> {
    if (!this.checked) {
      this.piperCmd = await findPiper();
      this.checked = true;
    }
    if (!this.piperCmd) {
      throw new Error("Piper TTS not installed. Run: pip install piper-tts");
    }
    return this.piperCmd;
  }

  async generate(input: VoiceGenerationInput): Promise<VoiceGenerationOutput> {
    let piperCmd: string;
    try {
      piperCmd = await this.ensurePiper();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[Piper] Not available: ${msg}`);
      return { status: "failed", error: msg };
    }

    const voiceModel = input.voiceId ?? DEFAULT_VOICE;
    const modelDir = getModelDir();

    const outputPath = input.outputPath ??
      path.join(env.storagePath, "voice", `piper_${Date.now()}.mp3`);
    const wavPath = outputPath.replace(/\.mp3$/, ".wav");

    const dir = path.dirname(outputPath);
    fs.mkdirSync(dir, { recursive: true });

    console.log(`[Piper] Generating voice: model=${voiceModel}, text=${input.text.length} chars → ${outputPath}`);

    try {
      // Piper reads text from stdin and writes WAV to stdout or file
      const args: string[] = [];
      const isPythonModule = piperCmd.includes("python");

      if (isPythonModule) {
        // python -m piper --model <name> --data-dir <dir> --output_file <path>
        args.push("-m", "piper",
          "--model", voiceModel,
          "--data-dir", modelDir,
          "--output_file", wavPath,
        );
      } else {
        // piper --model <name> --data-dir <dir> --output_file <path>
        args.push(
          "--model", voiceModel,
          "--data-dir", modelDir,
          "--output_file", wavPath,
        );
      }

      // Speed adjustment (piper supports --length_scale: >1 = slower, <1 = faster)
      if (input.speed && input.speed !== 1.0) {
        const lengthScale = 1.0 / input.speed; // invert: speed 1.2 → scale 0.83 (faster)
        args.push("--length_scale", lengthScale.toFixed(2));
      }

      const exe = isPythonModule ? piperCmd.split(" ")[0] : piperCmd;
      const fullArgs = isPythonModule ? [...piperCmd.split(" ").slice(1), ...args] : args;

      // Pipe text via stdin
      await new Promise<void>((resolve, reject) => {
        const proc = execFile(exe, fullArgs, { timeout: 120000 }, (err) => {
          if (err) reject(err);
          else resolve();
        });
        if (proc.stdin) {
          proc.stdin.write(input.text);
          proc.stdin.end();
        }
      });

      // Verify WAV was created
      if (!fs.existsSync(wavPath) || fs.statSync(wavPath).size < 100) {
        return { status: "failed", error: "Piper produced no audio output" };
      }

      // Convert WAV → MP3 via FFmpeg (smaller file, compatible everywhere)
      if (outputPath.endsWith(".mp3")) {
        await execFileAsync(FFMPEG_PATH, [
          "-y", "-i", wavPath,
          "-c:a", "libmp3lame", "-b:a", "128k", "-ar", "44100",
          outputPath,
        ], { timeout: 30000 });

        // Clean up WAV intermediate
        fs.unlinkSync(wavPath);
      } else {
        // If output is WAV, just rename
        fs.renameSync(wavPath, outputPath);
      }

      if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 100) {
        return { status: "failed", error: "FFmpeg MP3 conversion produced no output" };
      }

      console.log(`[Piper] Done → ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
      return { status: "completed", localPath: outputPath };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[Piper] Failed: ${message}`);
      return { status: "failed", error: `Piper TTS failed: ${message}` };
    }
  }

  async listVoices(): Promise<Array<{ id: string; name: string }>> {
    return PIPER_VOICES.map(v => ({ id: v.id, name: v.name }));
  }
}

export const piperVoiceProvider: IVoiceProvider = new PiperVoiceProvider();
