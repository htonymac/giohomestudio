// One-off verification: build an assembly from 16 REAL images + intro/outro cards,
// POST to the live assembly endpoint, and report whether any preprocessed clip is
// 0 bytes (the concurrency-overload symptom). Run as ghs on the server.
import fs from "fs";
import path from "path";

const ROOT = "/home/ghs/giohomestudio";
const SCENES = path.join(ROOT, "storage/scenes/unlinked");
const CARDS = path.join(ROOT, "storage/images/cards");

// Collect up to 16 real scene images
const imgs = [];
function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(png|jpe?g|webp)$/i.test(e.name) && fs.statSync(p).size > 2000) imgs.push(p);
    if (imgs.length >= 16) return;
  }
}
walk(SCENES);

const toUrl = (abs) => "/api/media/" + path.relative(path.join(ROOT, "storage"), abs).replace(/\\/g, "/");

// intro + outro cards
const cardFiles = fs.readdirSync(CARDS).sort();
const intro = cardFiles.filter(f => f.startsWith("intro_")).pop();
const outro = cardFiles.filter(f => f.startsWith("outro_")).pop();

const segs = [];
let t = 0;
const push = (src, dur, sid) => { segs.push({ id: `seg_${segs.length}`, type: "image", sourceUrl: src, startTime: t, endTime: t + dur, duration: dur, sceneId: sid, transitionIn: segs.length === 0 ? "fade" : "cut", transitionOut: "cut" }); t += dur; };

if (intro) push("img:" + toUrl(path.join(CARDS, intro)), 5, undefined);
imgs.forEach((p, i) => push(toUrl(p), 3, `SC${String(i + 1).padStart(2, "0")}`));
if (outro) push("img:" + toUrl(path.join(CARDS, outro)), 10, undefined);

const assembly = {
  version: 1, projectId: "concurrencytest", projectType: "hybrid", title: "Concurrency Test",
  totalDuration: t, aspectRatio: "16:9", resolution: { width: 1920, height: 1080 },
  segments: segs, narration: [], music: [], sfx: [], ambience: [], subtitles: [], overlays: [], volumeAutomation: [],
  duckingRules: { narrationPriority: true, musicDuckLevel: 0.08, ambienceDuckLevel: 0.12, sfxDuckLevel: 0.15 },
  exportSettings: { format: "mp4", quality: "standard", includeSubtitles: false, includeWatermark: false, includeCredits: false, subtitleStyle: "none" },
  plannerTier: "standard", soundLicenses: [], rightsConfirmed: true, previewApproved: true, exportApproved: true,
};

console.log(`Built ${segs.length} segments (intro=${!!intro} images=${imgs.length} outro=${!!outro}), totalDuration=${t}s`);

const res = await fetch("http://localhost:3200/api/assembly/execute", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ assembly, skipApprovalCheck: true }),
});

// Parse NDJSON
const text = await res.text();
let result = null;
for (const line of text.split("\n")) {
  const s = line.trim(); if (!s) continue;
  try { const o = JSON.parse(s); if (o.result) result = o.result; } catch {}
}
if (!result) { console.log("NO RESULT. raw tail:", text.slice(-500)); process.exit(1); }

const completed = (result.steps || []).filter(s => s.status === "completed").length;
const skipped = (result.steps || []).filter(s => s.status === "skipped");
console.log("success:", result.success, "| segments assembled:", result.assembly?.segments, "/", segs.length, "| duration:", result.duration);
console.log("steps completed:", completed, "| skipped:", skipped.length, skipped.map(s => s.id).slice(0, 5));
console.log("outputUrl:", result.outputUrl);
