// Verifies narrator/actor coordination fixes (#6 audio duck + #7 subtitle overlap).
// Builds a minimal AssemblyJSON with 1 narrator entry spanning the timeline and
// 1 actor entry mid-timeline, then POSTs to /api/assembly/execute. After render,
// (1) parses journalctl for the [duck] + [subtitle-coord] activation logs,
// (2) ffprobes the output to verify a/v streams, (3) prints whether the duck
// filter was actually emitted in the assembled ffmpeg command.
import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const ROOT = "/home/ghs/giohomestudio";
const BASE = "http://localhost:3200";

// pick first 2 narration WAVs as fixtures
const narrDir = path.join(ROOT, "storage/narration");
const wavs = fs.readdirSync(narrDir).filter(f => /\.wav$/i.test(f)).sort();
if (wavs.length < 2) { console.log("need >=2 narration WAVs in", narrDir); process.exit(1); }
const narratorWav = `${ROOT}/storage/narration/${wavs[0]}`;
const actorWav = `${ROOT}/storage/narration/${wavs[1]}`;

// find one existing scene video to use as a segment
const candidates = [
  `${ROOT}/storage/video/assembly/ghs_hybrid_default_1780008307352/clip_seg_0.mp4`,
];
const segmentVideo = candidates.find(f => fs.existsSync(f));
if (!segmentVideo) { console.log("no segment video fixture available"); process.exit(1); }

const projectId = `verify_coord_${Date.now()}`;
const outDir = `${ROOT}/storage/video/assembly/${projectId}`;
fs.mkdirSync(outDir, { recursive: true });

const assembly = {
  version: 1,
  projectId,
  projectType: "hybrid",
  title: "narrator-actor coord verification",
  totalDuration: 30,
  aspectRatio: "16:9",
  resolution: { width: 1920, height: 1080 },
  segments: [{
    id: "seg1", type: "video", sourceUrl: segmentVideo,
    startTime: 0, endTime: 30, duration: 30,
  }],
  narration: [
    {
      id: "narr1",
      text: "Sentence one of the narrator track. Sentence two of the narrator. Sentence three by the narrator. Sentence four still narrator. Sentence five narrator.",
      startTime: 0, endTime: 30, volume: 1.0, speed: 1.0,
      audioUrl: narratorWav,
      isNarrator: true,                          // explicit flag (the preferred path)
    },
    {
      id: "actor1",
      text: "Actor speaking now in the middle of the timeline.",
      speakerId: "actor1",
      startTime: 12, endTime: 18, volume: 1.0, speed: 1.0,
      audioUrl: actorWav,
    },
  ],
  music: [], sfx: [], ambience: [], subtitles: [], overlays: [],
  volumeAutomation: [],
  duckingRules: { narrationPriority: true, musicDuckLevel: 0.08, ambienceDuckLevel: 0.15, sfxDuckLevel: 0.5 },
  exportSettings: { includeSubtitles: true, subtitleStyle: "classic" },
};

const sinceMark = execSync("date '+%Y-%m-%d %H:%M:%S'").toString().trim();
console.log("project:", projectId);
console.log("posting assembly to", `${BASE}/api/assembly/execute`);

const t0 = Date.now();
const res = await fetch(`${BASE}/api/assembly/execute`, {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ assembly, outputDir: outDir }),
  signal: AbortSignal.timeout(180000),
});
const body = await res.json().catch(() => ({}));
console.log("HTTP", res.status, "in", (Date.now() - t0), "ms");
console.log("response keys:", Object.keys(body).join(","));
if (body?.error) console.log("ERROR:", body.error);
if (body?.outputUrl || body?.finalOutputPath) console.log("output:", body.outputUrl || body.finalOutputPath);

// inspect journalctl for our diagnostic logs since the mark
console.log("\n--- [duck] and [subtitle-coord] log lines since render start ---");
try {
  const logs = execSync(`journalctl --since '${sinceMark}' -u ghs.service -o cat 2>/dev/null | grep -E '\\[duck\\]|\\[subtitle-coord\\]' | head -20`).toString();
  console.log(logs || "(no diagnostic logs captured)");
} catch (e) {
  console.log("journalctl read failed:", String(e).slice(0, 200));
}

// inspect output file
const finalCandidates = fs.readdirSync(outDir).filter(f => /\.mp4$/i.test(f));
if (finalCandidates.length === 0) {
  console.log("\nNo MP4 output produced.");
} else {
  const finalPath = path.join(outDir, finalCandidates.sort().pop());
  console.log("\n--- ffprobe", path.basename(finalPath), "---");
  try {
    const probe = execSync(`ffprobe -v error -show_streams -show_format ${JSON.stringify(finalPath)} 2>&1 | grep -E "^(codec_name|codec_type|duration|width|height|sample_rate|channels|nb_streams)=" | head -20`).toString();
    console.log(probe);
  } catch (e) { console.log("ffprobe failed:", String(e).slice(0, 200)); }
}
console.log("DONE");
