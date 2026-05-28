// Karaoke MAIN pipeline e2e on FREE engines. Uses an existing clean narration WAV as the
// "voice" fixture (stands in for Henry's real recording). Runs every step and reports how
// far the free pipeline gets. Each step is non-fatal so we see the full picture.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const ROOT = "/home/ghs/giohomestudio";
const envTxt = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
const dbUrl = (envTxt.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

// pick a clean narration WAV as the voice fixture
const narrDir = path.join(ROOT, "storage/narration");
const voiceSrc = fs.readdirSync(narrDir).filter(f => /\.wav$/i.test(f)).map(f => path.join(narrDir, f)).sort().pop();
if (!voiceSrc) { console.log("NO voice fixture found in storage/narration"); process.exit(1); }

const id = randomUUID();
const ext = ".wav";
const karaokeDir = path.join(ROOT, "storage/karaoke");
fs.mkdirSync(karaokeDir, { recursive: true });
const destName = `${id}${ext}`;
fs.copyFileSync(voiceSrc, path.join(karaokeDir, destName));
const rec = await prisma.karaokeRecording.create({
  data: { id, userId: "karaoke_e2e", fileUrl: `/api/media/karaoke/${destName}`, fileName: "selftest.wav", mode: "A" },
});
console.log("fixture:", path.basename(voiceSrc), "→ recording", id.slice(0, 8));

const BASE = "http://localhost:3200/api/karaoke";
async function step(name, route, body, timeoutMs = 60000) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}/${route}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
    });
    const d = await res.json().catch(() => ({}));
    const ms = Date.now() - t0;
    const ok = res.status >= 200 && res.status < 300 && !d.error && !d.locked;
    console.log(`${ok ? "✓" : "✗"} ${name.padEnd(16)} HTTP ${res.status} ${ms}ms ${ok ? "" : "| " + JSON.stringify(d).slice(0, 160)}`);
    return d;
  } catch (e) {
    console.log(`✗ ${name.padEnd(16)} EXC ${(Date.now() - t0)}ms | ${String(e).slice(0, 120)}`);
    return {};
  }
}

try {
  const an = await step("analyze", "analyze", { recordingId: id }, 180000);
  console.log("   transcript:", (an?.analysis?.transcription || "").slice(0, 60), "| tempo:", an?.analysis?.tempo ?? an?.analysis?.bpm);
  await step("flow-profile", "flow-profile", { recordingId: id });
  const beat = await step("beat-recommend", "beat-recommend", { recordingId: id, mode: "A" });
  const beatFamily = beat?.recommendations?.[0]?.family || beat?.beatFamilies?.[0]?.name || beat?.[0]?.family || undefined;
  await step("production-brief", "production-brief", { recordingId: id, selectedBeatFamily: beatFamily });
  const mus = await step("generate-music", "generate-music", { recordingId: id }, 90000);
  console.log("   music provider:", mus?.provider, "| url:", mus?.generatedMusicUrl);
  await step("save-mix", "save-mix", { recordingId: id, mixSettings: { vocalVolume: 1.0, musicVolume: 0.4, vocalDelayMs: 0 } });
  const asm = await step("assemble", "assemble", { recordingId: id }, 120000);
  console.log("   mixedOutput:", asm?.mixedOutputUrl || asm?.outputUrl);
  const exp = await step("export", "export", { recordingId: id, format: "mp3" }, 90000);
  console.log("   export:", JSON.stringify(exp).slice(0, 160));
} finally {
  // cleanup
  try { fs.unlinkSync(path.join(karaokeDir, destName)); } catch {}
  await prisma.musicGeneration.deleteMany({ where: { userId: "karaoke_e2e" } }).catch(() => {});
  await prisma.karaokeRecording.delete({ where: { id } }).catch(() => {});
  await prisma.$disconnect();
}
console.log("DONE");
