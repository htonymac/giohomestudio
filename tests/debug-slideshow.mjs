// Debug: simulate createSlideshow filter graph to inspect what FFmpeg receives
import ffmpeg from "fluent-ffmpeg";
ffmpeg.setFfmpegPath("C:/ffmpeg/bin/ffmpeg.exe");

const images = [
  "storage/commercial/cmnnktr5y001olk8cm1dpsaly/cmnnku4cm001rlk8ceyiv88fl.jpg",
  "storage/commercial/cmnnktr5y001olk8cm1dpsaly/cmnnku4cm001tlk8czsoa9ocp.jpg",
  "storage/commercial/cmnnktr5y001olk8cm1dpsaly/cmnnku4cm001vlk8clkiq7eie.jpg",
];

const durSec = 3;
const ZP_FPS = 12;
const OUT_FPS = 24;
const w = 832, h = 1472;
const pw = Math.round(w * 1.6), ph = Math.round(h * 1.6);

const cmd = ffmpeg();
const segs = [];

images.forEach((img, i) => {
  const src = img.replace(/\\/g, "/");
  const d = Math.max(2, Math.round(durSec * ZP_FPS)); // 36 frames
  cmd.input(src);
  cmd.inputOptions(["-loop", "1", "-t", String(durSec)]);

  // zoom-in KB effect
  const kb = `zoompan=z='1.0+(on/${d})*0.5':x='iw/2-iw/(1.0+(on/${d})*0.5)/2':y='ih/2-ih/(1.0+(on/${d})*0.5)/2':d=${d}:fps=${ZP_FPS}:s=${w}x${h},fps=fps=${OUT_FPS}`;
  const seg = `[${i}:v]scale=${pw}:${ph}:force_original_aspect_ratio=increase:flags=lanczos,crop=${pw}:${ph},${kb},format=yuv420p[v${i}]`;
  segs.push(seg);
});

// concat (no transitions)
segs.push("[v0][v1][v2]concat=n=3:v=1:a=0[outv]");

console.log("=== FILTER GRAPH ===");
console.log(segs.join(";\n"));
console.log("\n=== INPUTS ===");
cmd._inputs.forEach((inp, i) => {
  console.log(`  Input ${i}: ${inp.source} | options: ${JSON.stringify(inp.options?.get?.() || "none")}`);
});

// Actually run it and capture the command
const outPath = "storage/tmp/debug_slideshow_3img.mp4";
cmd
  .complexFilter(segs.join(";"))
  .outputOptions(["-map [outv]", "-c:v libx264", "-crf 26", "-preset fast", "-pix_fmt yuv420p", "-movflags +faststart", "-an"])
  .output(outPath)
  .on("start", (cmdStr) => {
    console.log("\n=== FFMPEG COMMAND ===");
    console.log(cmdStr);
  })
  .on("end", () => {
    console.log("\n=== SUCCESS ===");
    // Probe the output
    ffmpeg.ffprobe(outPath, (err, data) => {
      if (err) { console.error("Probe error:", err); return; }
      console.log("Duration:", data.format.duration, "seconds");
      console.log("Expected: ~9 seconds (3 images x 3s each)");
    });
  })
  .on("error", (err) => {
    console.error("\n=== FAILED ===");
    console.error(err.message);
  })
  .run();
