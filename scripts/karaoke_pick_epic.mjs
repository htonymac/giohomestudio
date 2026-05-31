import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const ROOT = "/home/ghs/giohomestudio";
const envTxt = fs.readFileSync(path.join(ROOT, ".env"), "utf-8");
const dbUrl = (envTxt.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const wavs = fs.readdirSync(path.join(ROOT, "storage/narration")).filter(f => /\.wav$/i.test(f)).sort();
const voiceSrc = path.join(ROOT, "storage/narration", wavs[3] || wavs[0]);
const id = randomUUID();
const destName = id + ".wav";
fs.copyFileSync(voiceSrc, path.join(ROOT, "storage/karaoke", destName));
await prisma.karaokeRecording.create({ data: { id, userId: "karaoke_pick", fileUrl: `/api/media/karaoke/${destName}`, fileName: "pick.wav", mode: "A" } });
console.log("fixture:", path.basename(voiceSrc));

const BASE = "http://localhost:3200/api/karaoke";
const post = async (r, b) => {
  const x = await fetch(`${BASE}/${r}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b), signal: AbortSignal.timeout(180000) });
  return { status: x.status, data: await x.json().catch(() => ({})) };
};

try {
  await post("analyze", { recordingId: id });
  await post("flow-profile", { recordingId: id });
  await post("beat-recommend", { recordingId: id, mode: "A" });
  await post("production-brief", { recordingId: id, selectedBeatFamily: "cinematic" });
  // Custom brief with EPIC keywords so stock adapter picks epic/dramatic track instead of upbeat
  const mus = await post("generate-music", {
    recordingId: id,
    brief: { genre: "epic cinematic dramatic orchestral war battle heroic", mood: "epic", tempo: 110 },
  });
  console.log("music:", mus.data?.generatedMusicUrl, "| provider:", mus.data?.provider);
  await post("save-mix", { recordingId: id, mixSettings: { vocalVolume: 1.0, musicVolume: 0.5, vocalDelayMs: 0 } });
  const asm = await post("assemble", { recordingId: id });
  const exp = await post("export", { recordingId: id, format: "mp3" });
  console.log("mix:", asm.data?.mixedOutputUrl);
  console.log("export:", exp.data?.downloadUrl);
} finally {
  try { fs.unlinkSync(path.join(ROOT, "storage/karaoke", destName)); } catch {}
  await prisma.musicGeneration.deleteMany({ where: { userId: "karaoke_pick" } }).catch(() => {});
  await prisma.karaokeRecording.delete({ where: { id } }).catch(() => {});
  await prisma.$disconnect();
}
