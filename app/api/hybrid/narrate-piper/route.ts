// POST /api/hybrid/narrate-piper
// Generates narration audio using Piper TTS (local, no cost).
// If the requested model is not found locally it auto-downloads from
// huggingface.co/rhasspy/piper-voices — no HF account required (public repo).
// Set HF_TOKEN in .env to avoid rate-limits or access private models.

import { NextRequest, NextResponse } from "next/server";
import { spawn } from "child_process";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

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
      if (c === "piper" || c === "piper.exe") return c;
      if (fs.existsSync(c)) return c;
    } catch { /* skip */ }
  }
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
      model = "en_US-lessac-medium",
      outputName,
      speed = 1.0,
    } = body as { text?: string; model?: string; outputName?: string; speed?: number };

    if (!text || text.trim().length < 2) {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
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

    await runPiper(piperBin, modelPath, text.trim(), outputPath, speed ?? 1.0);

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
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[narrate-piper] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
