// Verify karaoke MAIN pipeline uses FREE stock music by default (not premium Kie),
// even though KIE_AI_API_KEY is set. Creates a flow-lock-complete recording, calls
// generate-music with NO providerKey, asserts provider === "stock" + real audio URL.
import { PrismaClient } from "@prisma/client";
import fs from "fs";

// Load DATABASE_URL from .env (manual run isn't under systemd env)
const envTxt = fs.readFileSync("/home/ghs/giohomestudio/.env", "utf-8");
const dbUrl = (envTxt.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");
const prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } });

const rec = await prisma.karaokeRecording.create({
  data: {
    userId: "test_main_free",
    fileUrl: "/api/media/karaoke/test.wav",
    fileName: "test.wav",
    mode: "A",
    durationSec: 60,
    analysis: { tempo: 90, key: "C major", energy: 0.6 },
    transcript: "test lyrics for the main free pipeline check",
    flowProfile: { voiceType: "singing", cadenceLabel: "smooth", phraseGaps: [], hookCandidates: [] },
    productionBrief: { genre: "Afrobeats", tempo: 90, key: "C major", mood: "energetic", structure: "Verse → Chorus", duration: 60, instructions: "warm groove" },
  },
});

let verdict = "ERROR";
let provider = "?";
let url = "?";
try {
  const res = await fetch("http://localhost:3200/api/karaoke/generate-music", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ recordingId: rec.id }), // NO providerKey → MAIN
    signal: AbortSignal.timeout(60000),
  });
  const d = await res.json();
  provider = d.provider; url = d.generatedMusicUrl;
  verdict = (d.provider === "stock" && d.generatedMusicUrl) ? "MAIN=FREE STOCK ✓" : "WRONG: used " + d.provider;
  console.log("HTTP", res.status, JSON.stringify(d).slice(0, 240));
} finally {
  // cleanup
  await prisma.musicGeneration.deleteMany({ where: { userId: "test_main_free" } }).catch(() => {});
  await prisma.karaokeRecording.delete({ where: { id: rec.id } }).catch(() => {});
  await prisma.$disconnect();
}
console.log("provider:", provider, "| url:", url);
console.log("VERDICT:", verdict);
