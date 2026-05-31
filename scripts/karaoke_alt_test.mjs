// Henry 2026-05-31: alt karaoke e2e using a different voice fixture + explicit Kie tier
// so user can hear a Suno-generated lyrical track instead of the stock loop.
import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const ROOT = "/home/ghs/giohomestudio";
const envTxt = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
const dbUrl = (envTxt.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

// Pick a different narration WAV — second-to-last for variety
const narrDir = path.join(ROOT, "storage/narration");
const wavs = fs.readdirSync(narrDir).filter(f => /\.wav$/i.test(f)).sort();
const voiceSrc = path.join(narrDir, wavs[Math.floor(wavs.length / 2)]);
if (!fs.existsSync(voiceSrc)) { console.log("no voice"); process.exit(1); }

const id = randomUUID();
const ext = ".wav";
const karaokeDir = path.join(ROOT, "storage/karaoke");
fs.mkdirSync(karaokeDir, { recursive: true });
const destName = `${id}${ext}`;
fs.copyFileSync(voiceSrc, path.join(karaokeDir, destName));
const rec = await prisma.karaokeRecording.create({
  data: { id, userId: "karaoke_alt", fileUrl: `/api/media/karaoke/${destName}`, fileName: "alttest.wav", mode: "A" },
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
    const ok = res.status >= 200 && res.status < 300 && !d.error;
    console.log(`${ok ? "✓" : "✗"} ${name.padEnd(20)} HTTP ${res.status} ${ms}ms ${ok ? "" : "| " + JSON.stringify(d).slice(0, 220)}`);
    return d;
  } catch (e) {
    console.log(`✗ ${name.padEnd(20)} EXC ${(Date.now() - t0)}ms | ${String(e).slice(0, 120)}`);
    return {};
  }
}

try {
  await step("analyze", "analyze", { recordingId: id }, 180000);
  await step("flow-profile", "flow-profile", { recordingId: id });
  const beat = await step("beat-recommend", "beat-recommend", { recordingId: id, mode: "A" });
  const beatFamily = beat?.recommendations?.[0]?.family || beat?.beatFamilies?.[0]?.name;
  await step("production-brief", "production-brief", { recordingId: id, selectedBeatFamily: beatFamily });
  // KEY DIFFERENCE: explicit providerKey="kie" to try the lyrical Suno track via Kie.
  const mus = await step("generate-music (KIE/Suno)", "generate-music", { recordingId: id, providerKey: "kie" }, 180000);
  console.log("   music provider:", mus?.provider, "| url:", mus?.generatedMusicUrl);
  await step("save-mix", "save-mix", { recordingId: id, mixSettings: { vocalVolume: 1.0, musicVolume: 0.45, vocalDelayMs: 0 } });
  const asm = await step("assemble", "assemble", { recordingId: id }, 120000);
  console.log("   mixedOutput:", asm?.mixedOutputUrl || asm?.outputUrl);
  const exp = await step("export", "export", { recordingId: id, format: "mp3" }, 90000);
  console.log("   export:", JSON.stringify(exp).slice(0, 240));
} finally {
  try { fs.unlinkSync(path.join(karaokeDir, destName)); } catch {}
  await prisma.musicGeneration.deleteMany({ where: { userId: "karaoke_alt" } }).catch(() => {});
  await prisma.karaokeRecording.delete({ where: { id } }).catch(() => {});
  await prisma.$disconnect();
}
console.log("DONE");
