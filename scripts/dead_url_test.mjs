// Targeted test: SCDUP scene has a real image + a dead URL → placeholder must DROP.
// SCLONE scene has only a dead URL → placeholder must STAY. Expect 2 segments assembled.
import fs from "fs";
import path from "path";
const ROOT = "/home/ghs/giohomestudio";
const SCENES = path.join(ROOT, "storage/scenes/unlinked");
let real = null;
(function w(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (real) return;
    const p = path.join(d, e.name);
    if (e.isDirectory()) w(p);
    else if (/\.(png|jpe?g)$/i.test(e.name) && fs.statSync(p).size > 2000) real = p;
  }
})(SCENES);
const toUrl = (a) => "/api/media/" + path.relative(path.join(ROOT, "storage"), a);
const dead = "/api/media/scenes/unlinked/DOES_NOT_EXIST/img_000.png";
const seg = (src, sid, i) => ({ id: `seg_${i}`, type: "image", sourceUrl: src, startTime: i * 3, endTime: i * 3 + 3, duration: 3, sceneId: sid, transitionIn: i === 0 ? "fade" : "cut", transitionOut: "cut" });
const segs = [seg(toUrl(real), "SCDUP", 0), seg(dead, "SCDUP", 1), seg(dead, "SCLONE", 2)];
const assembly = { version: 1, projectId: "deadurltest", projectType: "hybrid", title: "Dead URL", totalDuration: 9, aspectRatio: "16:9", resolution: { width: 1920, height: 1080 }, segments: segs, narration: [], music: [], sfx: [], ambience: [], subtitles: [], overlays: [], volumeAutomation: [], duckingRules: { narrationPriority: true, musicDuckLevel: 0.08, ambienceDuckLevel: 0.12, sfxDuckLevel: 0.15 }, exportSettings: { format: "mp4", quality: "standard", includeSubtitles: false, includeWatermark: false, includeCredits: false, subtitleStyle: "none" }, plannerTier: "standard", soundLicenses: [], rightsConfirmed: true, previewApproved: true, exportApproved: true };
const res = await fetch("http://localhost:3200/api/assembly/execute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assembly, skipApprovalCheck: true }) });
const text = await res.text();
let r = null;
for (const l of text.split("\n")) { const s = l.trim(); if (!s) continue; try { const o = JSON.parse(s); if (o.result) r = o.result; } catch {} }
console.log("EXPECT 2 segments (SCDUP keeps real, drops gray; SCLONE keeps gray placeholder)");
console.log("GOT segments assembled:", r?.assembly?.segments, "| success:", r?.success);
