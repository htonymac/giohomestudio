// POST /api/hybrid/narrate-piper
// Generates narration audio using Piper TTS (local, no cost), ElevenLabs, or
// GHS sound tier dispatch (soundTier field).
//
// voiceProvider values accepted:
//   "piper"          — Piper TTS local (free, GHS Sound tier)
//   "elevenlabs"     — ElevenLabs cloud (ELEVENLABS_API_KEY required)
//   "fal-narrator"   — FAL AI Kokoro standard (FAL_KEY required; GHS Plus / GHS Pro)
//   "fal-narrator-gemini" — FAL AI Kokoro full model (FAL_KEY required)
//   "kie-suno"       — Kie.ai Suno V5 (KIE_AI_API_KEY required; falls back to fal-narrator)
//
// soundTier is a convenience alias:
//   "ghs-sound"    → voiceProvider = "piper",        model = "en_US-lessac-medium"
//   "ghs-plus"     → voiceProvider = "fal-narrator"  (FAL Kokoro cloud TTS)
//   "ghs-pro"      → voiceProvider = "fal-narrator"  (FAL Kokoro + FAL music separately)
//   "ghs-premium"  → voiceProvider = "kie-suno" (falls back to piper if no KIE key)
//
// If the requested Piper model is not found locally it auto-downloads from
// huggingface.co/rhasspy/piper-voices — no HF account required (public repo).
// Set HF_TOKEN in .env to avoid rate-limits or access private models.

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import { elevenLabsVoiceProvider } from "@/modules/voice-provider/elevenlabs";
import { env } from "@/config/env";
import { soundTierToNarrationProvider } from "@/lib/ghs-sound-tiers";
import type { GhsSoundTierId } from "@/lib/ghs-sound-tiers";
import { sanitizeForTTS } from "@/lib/sanitize-text";

// ── HF model registry ─────────────────────────────────────────────────────────
// Each entry: { onnx: HF path, json: HF path }
const HF_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main";

const HF_MODELS: Record<string, { onnx: string; json: string; file: string }> = {
  // ── Male voices ──
  "en_US-lessac-medium":    { file: "en_US-lessac-medium.onnx",         onnx: `${HF_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx`,         json: `${HF_BASE}/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json` },
  "en_US-ryan-high":        { file: "en_US-ryan-high.onnx",             onnx: `${HF_BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx`,                 json: `${HF_BASE}/en/en_US/ryan/high/en_US-ryan-high.onnx.json` },
  "en_US-joe-medium":       { file: "en_US-joe-medium.onnx",            onnx: `${HF_BASE}/en/en_US/joe/medium/en_US-joe-medium.onnx`,               json: `${HF_BASE}/en/en_US/joe/medium/en_US-joe-medium.onnx.json` },
  "en_US-danny-low":        { file: "en_US-danny-low.onnx",             onnx: `${HF_BASE}/en/en_US/danny/low/en_US-danny-low.onnx`,                 json: `${HF_BASE}/en/en_US/danny/low/en_US-danny-low.onnx.json` },
  "en_GB-alan-medium":      { file: "en_GB-alan-medium.onnx",           onnx: `${HF_BASE}/en/en_GB/alan/medium/en_GB-alan-medium.onnx`,             json: `${HF_BASE}/en/en_GB/alan/medium/en_GB-alan-medium.onnx.json` },
  "en_US-libritts-high":    { file: "en_US-libritts_r-medium.onnx",     onnx: `${HF_BASE}/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx`, json: `${HF_BASE}/en/en_US/libritts_r/medium/en_US-libritts_r-medium.onnx.json` },
  // ── Female voices ──
  "en_US-amy-medium":       { file: "en_US-amy-medium.onnx",            onnx: `${HF_BASE}/en/en_US/amy/medium/en_US-amy-medium.onnx`,               json: `${HF_BASE}/en/en_US/amy/medium/en_US-amy-medium.onnx.json` },
  "en_US-hfc_female-medium":{ file: "en_US-hfc_female-medium.onnx",     onnx: `${HF_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx`, json: `${HF_BASE}/en/en_US/hfc_female/medium/en_US-hfc_female-medium.onnx.json` },
  "en_GB-cori-high":        { file: "en_GB-cori-high.onnx",             onnx: `${HF_BASE}/en/en_GB/cori/high/en_GB-cori-high.onnx`,                 json: `${HF_BASE}/en/en_GB/cori/high/en_GB-cori-high.onnx.json` },
  "en_US-kristin-medium":   { file: "en_US-kristin-medium.onnx",        onnx: `${HF_BASE}/en/en_US/kristin/medium/en_US-kristin-medium.onnx`,       json: `${HF_BASE}/en/en_US/kristin/medium/en_US-kristin-medium.onnx.json` },
};

// ── Piper binary detection ────────────────────────────────────────────────────
function findPiperBinary(): string | null {
  const candidates = [
    process.env.PIPER_BIN,
    "piper",
    "piper.exe",
    path.join(os.homedir(), ".local", "bin", "piper"),
    path.join(os.homedir(), "piper", "piper"),
    path.join(os.homedir(), "piper", "piper.exe"),
    "/usr/local/bin/piper",
    "/usr/bin/piper",
  ].filter(Boolean) as string[];

  for (const c of candidates) {
    try {
      if (fs.existsSync(c)) return c;
    } catch { /* skip */ }
  }
  // Check PATH by trying to resolve "piper" / "piper.exe" via which/where
  try {
    const { execSync } = require("child_process");
    const cmd = process.platform === "win32" ? "where piper.exe 2>nul" : "which piper 2>/dev/null";
    const result = execSync(cmd, { timeout: 3000 }).toString().trim();
    if (result) return result.split("\n")[0].trim();
  } catch { /* not in PATH */ }
  return null;
}

// ── Model directory ───────────────────────────────────────────────────────────
function getModelsDir(): string {
  const dir = process.env.PIPER_MODELS_DIR || path.join(os.homedir(), "piper-models");
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  return dir;
}

// ── Find model locally ────────────────────────────────────────────────────────
function findModelPath(modelName: string): string | null {
  if (process.env.PIPER_MODEL_PATH) return process.env.PIPER_MODEL_PATH;

  const hfEntry = HF_MODELS[modelName];
  const searchDirs = [
    process.env.PIPER_MODELS_DIR,
    path.join(os.homedir(), "piper-models"),
    path.join(os.homedir(), ".local", "share", "piper", "models"),
    path.join(os.homedir(), "piper", "models"),
    "C:\\piper\\models",
    "C:\\Users\\USER\\piper\\models",
  ].filter(Boolean) as string[];

  const fileNames = hfEntry
    ? [hfEntry.file, `${modelName}.onnx`]
    : [`${modelName}.onnx`];

  for (const dir of searchDirs) {
    for (const file of fileNames) {
      const full = path.join(dir, file);
      try { if (fs.existsSync(full)) return full; } catch { /* skip */ }
    }
  }
  return null;
}

// ── Download a single file from HF ───────────────────────────────────────────
async function downloadFile(url: string, destPath: string): Promise<void> {
  const headers: Record<string, string> = { "User-Agent": "GioHomeStudio/1.0" };
  if (process.env.HF_TOKEN) headers["Authorization"] = `Bearer ${process.env.HF_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HF download failed: ${res.status} ${res.statusText} — ${url}`);
  if (!res.body) throw new Error("No response body from HF");

  const tmpPath = `${destPath}.tmp`;
  const writer = fs.createWriteStream(tmpPath);

  const reader = res.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      writer.write(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }

  await new Promise<void>((resolve, reject) => {
    writer.end((err?: Error | null) => (err ? reject(err) : resolve()));
  });

  fs.renameSync(tmpPath, destPath);
}

// ── Auto-download model from HF if missing ───────────────────────────────────
async function autoDownloadModel(modelName: string): Promise<string> {
  const entry = HF_MODELS[modelName];
  if (!entry) throw new Error(`No HF entry for model "${modelName}". Add it to HF_MODELS in narrate-piper/route.ts`);

  const modelsDir = getModelsDir();
  const onnxPath = path.join(modelsDir, entry.file);
  const jsonPath = `${onnxPath}.json`;

  console.log(`[narrate-piper] Downloading ${modelName} from HF...`);

  // Download .onnx.json first (small, fast) then the model
  if (!fs.existsSync(jsonPath)) {
    console.log(`[narrate-piper] Fetching config: ${entry.json}`);
    await downloadFile(entry.json, jsonPath);
  }

  if (!fs.existsSync(onnxPath)) {
    console.log(`[narrate-piper] Fetching model: ${entry.onnx}`);
    await downloadFile(entry.onnx, onnxPath);
  }

  console.log(`[narrate-piper] Model ready: ${onnxPath}`);
  return onnxPath;
}

// ── Output directory ──────────────────────────────────────────────────────────
function getOutputDir(): string {
  const storage = path.join(process.cwd(), "storage", "narration");
  try { fs.mkdirSync(storage, { recursive: true }); } catch { /* exists */ }
  return storage;
}

// ── Run Piper ─────────────────────────────────────────────────────────────────
function runPiper(piperBin: string, modelPath: string, text: string, outputPath: string, speed: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      "--model", modelPath,
      "--output_file", outputPath,
      "--length_scale", String(1.0 / speed),
    ];

    const proc = spawn(piperBin, args, { timeout: 120000 });
    proc.stdin.write(text);
    proc.stdin.end();

    const stderrChunks: Buffer[] = [];
    proc.stderr?.on("data", (d: Buffer) => stderrChunks.push(d));

    proc.on("close", (code) => {
      if (code === 0 && fs.existsSync(outputPath)) {
        resolve();
      } else {
        const errMsg = Buffer.concat(stderrChunks).toString().slice(0, 500);
        reject(new Error(`Piper exited with code ${code}. ${errMsg}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to start Piper: ${err.message}. Is piper on PATH?`));
    });
  });
}

// ── WAV duration estimate ─────────────────────────────────────────────────────
function estimateWavDuration(filePath: string): number {
  try {
    const buf = Buffer.alloc(44);
    const fd = fs.openSync(filePath, "r");
    fs.readSync(fd, buf, 0, 44, 0);
    fs.closeSync(fd);
    const dataSize = buf.readUInt32LE(40);
    const byteRate = buf.readUInt32LE(28);
    if (byteRate > 0) return Math.round((dataSize / byteRate) * 1000);
  } catch { /* ignore */ }
  return 0;
}

// ── POST handler ──────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      text,
      model: modelRaw = "en_US-lessac-medium",
      outputName,
      speed = 1.0,
      voiceProvider: voiceProviderRaw = "piper",
      soundTier,
      voiceId,
      voiceModel,
      language,
    } = body as {
      text?: string;
      model?: string;
      outputName?: string;
      speed?: number;
      voiceProvider?: string;
      soundTier?: string;
      voiceId?: string;
      voiceModel?: string;
      language?: string;
    };

    if (!text || text.trim().length < 2) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // ── Resolve soundTier → voiceProvider + model (overrides explicit fields) ─
    // Callers can pass soundTier directly instead of translating it themselves.
    const VALID_TIERS = ["ghs-sound", "ghs-plus", "ghs-pro", "ghs-premium"];
    let voiceProvider = voiceProviderRaw;
    let model = modelRaw;

    if (soundTier && VALID_TIERS.includes(soundTier)) {
      const resolvedProvider = soundTierToNarrationProvider(soundTier as GhsSoundTierId);
      voiceProvider = resolvedProvider;
      // GHS Sound tier always uses the canonical free model
      if (soundTier === "ghs-sound") {
        model = "en_US-lessac-medium";
      }
    }

    // ── Route to ElevenLabs if requested ──────────────────────────────────────
    if (voiceProvider === "elevenlabs") {
      if (!env.elevenlabs?.apiKey) {
        return NextResponse.json({ ok: false, error: "ELEVENLABS_API_KEY not configured. Add it to .env to use ElevenLabs narration." }, { status: 200 });
      }
      const outDir = getOutputDir();
      const fileName = outputName
        ? `${outputName.replace(/[^a-z0-9_-]/gi, "_")}.mp3`
        : `narration_el_${Date.now()}.mp3`;
      const outputPath = path.join(outDir, fileName);
      try {
        const result = await elevenLabsVoiceProvider.generate({
          text: sanitizeForTTS(text.trim()),
          voiceId: voiceId || undefined,
          voiceModel: voiceModel as import("@/types/providers").ElevenLabsModel | undefined,
          language: language || undefined,
          speed,
          outputPath,
        });
        if (result.status !== "completed" || !result.localPath) {
          return NextResponse.json({ ok: false, error: result.error || "ElevenLabs generation failed" }, { status: 200 });
        }
        const relativePath = path.relative(path.join(process.cwd(), "storage"), result.localPath).replace(/\\/g, "/");
        const audioUrl = `/api/media/${relativePath}`;
        return NextResponse.json({ ok: true, audioUrl, provider: "elevenlabs", outputPath: result.localPath });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return NextResponse.json({ ok: false, error: `ElevenLabs error: ${msg}` }, { status: 200 });
      }
    }

    // ── Route to Kie Suno (GHS Premium) ──────────────────────────────────────
    // Narration via Kie.ai Suno V5. Requires KIE_AI_API_KEY.
    // Falls back to Piper if key is absent (logged as warning).
    if (voiceProvider === "kie-suno") {
      if (!process.env.KIE_AI_API_KEY) {
        console.warn("[narrate-piper] KIE_AI_API_KEY not configured — GHS Premium tier falling back to Piper TTS.");
        voiceProvider = "piper";
        model = "en_US-lessac-medium";
        // Falls through to Piper path below
      } else {
        // Kie.ai Suno V5 is a music/song generation service — it is not a narration TTS.
        // For pure narration use-cases with GHS Premium, we use Piper with the best quality
        // model and note the premium music context in the response so callers know to
        // separately invoke /api/music/generate?soundTier=ghs-premium for background music.
        console.log("[narrate-piper] GHS Premium: Kie Suno is for music gen; routing narration to Piper (high quality). Use /api/music/generate with soundTier=ghs-premium for music.");
        voiceProvider = "piper";
        model = "en_US-libritts-high";
        // Falls through to Piper path below with note in response
      }
    }

    // ── Route to FAL Kokoro (GHS Plus / GHS Pro) ─────────────────────────────
    if (voiceProvider === "fal-narrator" || voiceProvider === "fal-narrator-gemini") {
      if (!process.env.FAL_KEY) {
        return NextResponse.json({ ok: false, error: "FAL_KEY not configured. Add it to .env to use GHS Plus narration." }, { status: 200 });
      }
      try {
        const falEndpoint = voiceProvider === "fal-narrator-gemini"
          ? "https://fal.run/fal-ai/kokoro"
          : "https://fal.run/fal-ai/kokoro/american-english";
        const falRes = await fetch(falEndpoint, {
          method: "POST",
          headers: { "Authorization": `Key ${process.env.FAL_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: sanitizeForTTS(text.trim()), voice: voiceId || "af_sky", speed: speed || 1.0 }),
        });
        if (!falRes.ok) {
          const errBody = await falRes.text();
          throw new Error(`FAL ${falRes.status}: ${errBody.slice(0, 200)}`);
        }
        const falData = await falRes.json() as { audio_url?: string; audio?: { url?: string } };
        const falAudioUrl = falData.audio_url || falData.audio?.url;
        if (!falAudioUrl) throw new Error("FAL returned no audio URL");

        const audioRes = await fetch(falAudioUrl);
        if (!audioRes.ok) throw new Error(`Failed to download FAL audio: ${audioRes.status}`);

        const outDir = getOutputDir();
        const fileName = outputName
          ? `${outputName.replace(/[^a-z0-9_-]/gi, "_")}_fal.mp3`
          : `narration_fal_${Date.now()}.mp3`;
        const outputPath = path.join(outDir, fileName);
        fs.writeFileSync(outputPath, Buffer.from(await audioRes.arrayBuffer()));

        const durationMs = estimateWavDuration(outputPath);
        const relativePath = path.relative(path.join(process.cwd(), "storage"), outputPath).replace(/\\/g, "/");
        const audioUrl = `/api/media/${relativePath}`;
        return NextResponse.json({ ok: true, audioUrl, durationMs, provider: "fal-narrator", model: "kokoro" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[narrate-piper] FAL narrator error:", msg);
        return NextResponse.json({ ok: false, error: `FAL narrator failed: ${msg}` }, { status: 200 });
      }
    }

    // ── Karaoke pipeline fallback (legacy) ────────────────────────────────────
    if (voiceProvider === "karaoke") {
      return NextResponse.json({
        ok: false,
        karaokeMode: true,
        error: "Karaoke provider requires GHS Plus or GHS Pro tier — use GHS Sound for free Piper TTS.",
      }, { status: 200 });
    }

    // 1 — Check Piper binary
    const piperBin = findPiperBinary();
    if (!piperBin) {
      return NextResponse.json({
        ok: false,
        error: "Piper TTS binary not found",
        hint: "Install Piper from https://github.com/rhasspy/piper/releases and add it to PATH, or set PIPER_BIN in .env",
        piperNotInstalled: true,
      }, { status: 200 });
    }

    // 2 — Find model locally; auto-download from HF if missing
    let modelPath = findModelPath(model);
    if (!modelPath) {
      if (!HF_MODELS[model]) {
        return NextResponse.json({
          ok: false,
          error: `Model "${model}" not found locally and has no HF download entry.`,
          hint: `Place ${model}.onnx in ~/piper-models/ or add a HF_MODELS entry in narrate-piper/route.ts`,
          modelNotFound: true,
          requestedModel: model,
          availableForDownload: Object.keys(HF_MODELS),
        }, { status: 200 });
      }

      // Auto-download — this may take 30-90s for the first time (~50-100MB)
      try {
        modelPath = await autoDownloadModel(model);
      } catch (dlErr) {
        const msg = dlErr instanceof Error ? dlErr.message : String(dlErr);
        return NextResponse.json({
          ok: false,
          error: `Auto-download failed: ${msg}`,
          hint: "Check your internet connection or set HF_TOKEN in .env if rate-limited.",
          modelNotFound: true,
          requestedModel: model,
        }, { status: 200 });
      }
    }

    // 3 — Generate audio
    const outDir = getOutputDir();
    const fileName = outputName
      ? `${outputName.replace(/[^a-z0-9_-]/gi, "_")}.wav`
      : `narration_${Date.now()}.wav`;
    const outputPath = path.join(outDir, fileName);

    await runPiper(piperBin, modelPath, sanitizeForTTS(text.trim()), outputPath, speed ?? 1.0);

    const durationMs = estimateWavDuration(outputPath);
    const relativePath = path.relative(path.join(process.cwd(), "storage"), outputPath).replace(/\\/g, "/");
    const audioUrl = `/api/media/${relativePath}`;

    return NextResponse.json({
      ok: true,
      audioUrl,
      durationMs,
      model,
      provider: "piper",
      outputPath,
      ...(soundTier ? { soundTier, resolvedProvider: voiceProvider } : {}),
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[narrate-piper] Error:", msg);
    // ENOENT from spawn = binary not in PATH → surface as piperNotInstalled so UI shows download prompt
    if (msg.includes("ENOENT") || msg.includes("Failed to start Piper")) {
      return NextResponse.json({ ok: false, piperNotInstalled: true, error: msg }, { status: 200 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
