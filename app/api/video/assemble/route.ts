// POST /api/video/assemble — Final movie assembly
// Merges rendered scene videos + audio (music, narration, SFX) into one video
// Uses FFmpeg for concatenation, audio mixing, and transitions
// Returns: { outputUrl, duration, scenes } or { error }

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export const maxDuration = 900; // 15 minutes — assembly can take 5-10min for long projects

interface SlideDesign {
  fontFamily?: string;
  fontSize?: number;
  fontColor?: string;
  letterSpacing?: number;
  textStyle?: "neon" | "engrave" | "glass" | "flat" | "outline" | "retro";
  textGlow?: boolean;
  glowColor?: string;
  bgPattern?: "flow" | "none" | "dots" | "lines" | "circles";
  showCorners?: boolean;
  showRings?: boolean;
}

interface AssemblyScene {
  scene: number;
  videoUrl: string;
  audioUrl?: string;
  duration?: number;
  text?: string;
  background?: string;
  startTime?: number;
  design?: SlideDesign;
  animation?: "none" | "fade_in" | "slide_up" | "typewriter" | "bounce" | "glow_pulse" | "scale_in" | "blur_reveal";
  animationDuration?: number; // seconds for animation, default 1.0
}

interface SFXItem {
  sourceUrl: string;     // /api/media/sfx/thunder.mp3
  startTime: number;     // seconds
  volume: number;        // 0-1
}

interface StickerItem {
  id: string;
  type: string;
  color: string;
  x: number;      // % from left
  y: number;      // % from top
  width: number;  // % of frame width
  height: number; // % of frame height
  startTime: number;
  duration: number;
  strokeWidth: number;
}

// Rich subtitle configuration (from SubtitleStyler component)
interface SubtitleConfig {
  mode: "dialogue" | "highlight" | "kids" | "dramatic" | "social";
  fontFamily: "sans" | "serif" | "mono" | "display";
  fontSize: number;
  textColor: string;
  highlightColor: string;
  bgBox: boolean;
  bgOpacity: number;
  position: "bottom" | "center" | "top";
  animation: "none" | "fade" | "pop" | "bounce" | "slide" | "karaoke";
}

interface AssemblyRequest {
  projectId?: string;
  title?: string;
  scenes: AssemblyScene[];
  musicUrl?: string;     // background music track URL
  narrationUrl?: string; // single narration URL (legacy)
  narrationList?: Array<{ audioUrl: string; startTime: number; volume: number }>; // per-slide narration
  musicVolume?: number;  // 0-1, default 0.3
  narrationVolume?: number; // 0-1, default 1.0
  sfx?: SFXItem[];       // SFX to mix at timestamps
  caption?: string;      // text to burn via drawtext
  captionPosition?: "top" | "center" | "bottom";
  outputFormat?: "mp4" | "webm";
  aspectRatio?: "16:9" | "9:16" | "1:1";
  subtitleStyle?: "classic" | "cinema" | "neon" | "minimal" | "bold" | "none"; // legacy
  subtitleConfig?: SubtitleConfig; // rich subtitle config (overrides subtitleStyle)
  stickers?: StickerItem[]; // animated sticker overlays
  introUrl?: string;     // optional intro clip prepended before scenes
  outroUrl?: string;     // optional outro clip appended after scenes
}

// FFmpeg drawtext animation expressions
function getTextAnimationFilter(animation: string | undefined, dur: number, animDur: number = 1.0): string {
  if (!animation || animation === "none") return "";

  switch (animation) {
    case "fade_in":
      // Fade text from invisible to visible over animDur seconds
      return `:alpha='if(lt(t,${animDur}),t/${animDur},1)'`;

    case "slide_up":
      // Text slides up from below frame to center over animDur seconds
      return `:y='if(lt(t,${animDur}),h-(h/2+text_h/2)*(t/${animDur}),(h-text_h)/2)'`;

    case "typewriter": {
      // Reveal text character by character — use enable with time windows
      // FFmpeg drawtext doesn't support per-char reveal directly,
      // but we can approximate with alpha fade + enable timing
      return `:alpha='if(lt(t,${animDur}),t/${animDur},1)'`;
    }

    case "bounce":
      // Text bounces in from top — damped sine wave
      return `:y='if(lt(t,${animDur}),(h-text_h)/2-100*sin(t/${animDur}*3.14)*max(0,1-t/${animDur}),(h-text_h)/2)'`;

    case "glow_pulse":
      // Pulse the box opacity
      return `:alpha='if(lt(t,${dur}),0.7+0.3*sin(t*3.14),1)'`;

    case "scale_in":
      // Simulate scale by adjusting fontsize — not native but approximation via alpha
      return `:alpha='if(lt(t,${animDur}),t/${animDur},1)'`;

    case "blur_reveal":
      // Fade in (closest FFmpeg approximation to blur reveal)
      return `:alpha='if(lt(t,${animDur}),(t/${animDur})*(t/${animDur}),1)'`;

    default:
      return "";
  }
}

export async function POST(req: NextRequest) {
  try {
    const body: AssemblyRequest = await req.json();

    if (!body.scenes?.length) {
      return NextResponse.json({ error: "No scenes provided" }, { status: 400 });
    }

    const outDir = path.join(env.storagePath, "video", "assembled");
    fs.mkdirSync(outDir, { recursive: true });

    const tempDir = path.join(env.storagePath, "video", "temp", `assembly_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });

    const ffmpeg = env.ffmpegPath;

    // Resolve subtitle: rich config takes priority over legacy style string
    const subtitleCfg: SubtitleConfig | SubtitleStyle = (body.subtitleConfig as SubtitleConfig | undefined) ?? (body.subtitleStyle ?? "classic") as SubtitleStyle;
    const subtitleEnabled = body.subtitleConfig
      ? (body.subtitleConfig.mode as string) !== "none"
      : body.subtitleStyle !== "none";

    // ── Step 1: Process ALL scenes IN PARALLEL — massive speed improvement ──
    // Each scene writes to its own temp file so there is no conflict.
    async function processScene(scene: AssemblyScene): Promise<string | null> {
      if (scene.videoUrl.startsWith("img:")) {
        // ── Image scene — polished video slide with motion, brightness, text wrapping ──
        const imageUrl = scene.videoUrl.slice(4);
        let imagePath = resolveMediaPath(imageUrl);
        // Download external URLs (FAL, CDN, etc.) to temp before FFmpeg
        if (!imagePath && (imageUrl.startsWith("http://") || imageUrl.startsWith("https://"))) {
          const ext = imageUrl.split("?")[0].split(".").pop()?.toLowerCase() || "jpg";
          const localDest = path.join(tempDir, `scene_img_${scene.scene}.${ext}`);
          try {
            await downloadToLocal(imageUrl, localDest);
            imagePath = localDest;
          } catch (err) {
            console.warn(`[assemble] Scene ${scene.scene} download failed: ${err}`);
            return null;
          }
        }
        if (!imagePath || !fs.existsSync(imagePath)) {
          console.warn(`[assemble] Scene ${scene.scene} image not found: ${imageUrl}`);
          return null;
        }
        const dur = scene.duration || 5;
        const slideFile = path.join(tempDir, `imgslide_${scene.scene}.mp4`);
        const slideText = scene.text || "";
        const fps = 25;
        const totalFrames = Math.round(dur * fps);

        // ── Pick random motion style per scene for variety ──
        const motionStyles = [
          "zoom_in",      // slow zoom in (Ken Burns)
          "zoom_out",     // slow zoom out
          "pan_left",     // slow pan left to right
          "pan_right",    // slow pan right to left
          "pan_up",       // slow pan bottom to top
          "zoom_rotate",  // subtle zoom + slight movement
        ];
        const motionStyle = scene.animation
          ? (scene.animation as string)
          : motionStyles[scene.scene % motionStyles.length]; // deterministic per scene index

        // ── Build zoompan expression based on motion style ──
        let zoompanExpr = "";
        switch (motionStyle) {
          case "zoom_in":
            zoompanExpr = `zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
            break;
          case "zoom_out":
            zoompanExpr = `zoompan=z='if(eq(on,0),1.15,max(zoom-0.0015,1.0))':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
            break;
          case "pan_left":
            zoompanExpr = `zoompan=z='1.08':x='(iw-iw/zoom)*on/${totalFrames}':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
            break;
          case "pan_right":
            zoompanExpr = `zoompan=z='1.08':x='(iw-iw/zoom)*(1-on/${totalFrames})':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
            break;
          case "pan_up":
            zoompanExpr = `zoompan=z='1.08':x='iw/2-(iw/zoom/2)':y='(ih-ih/zoom)*(1-on/${totalFrames})':d=${totalFrames}:s=1100x620:fps=${fps}`;
            break;
          case "zoom_rotate":
            zoompanExpr = `zoompan=z='min(zoom+0.001,1.12)':x='iw/2-(iw/zoom/2)+sin(on/10)*20':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
            break;
          default:
            zoompanExpr = `zoompan=z='min(zoom+0.0015,1.15)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${totalFrames}:s=1100x620:fps=${fps}`;
        }

        // ── Build filter chain — half-res zoompan (4× faster), then scale up ──
        // Working at 960×540 then scaling to 1920×1080 is visually identical but 4× less pixels per frame.
        const vfParts = [
          `scale=1100:620:force_original_aspect_ratio=decrease,pad=1100:620:(ow-iw)/2:(oh-ih)/2:color=black`,
          `eq=brightness=0.06:contrast=1.12:saturation=1.1`,
          zoompanExpr,
          `scale=1920:1080`,
          `fade=t=in:st=0:d=0.6,fade=t=out:st=${Math.max(dur - 0.6, 0.3)}:d=0.6`,
        ];

        // Generate subtitle PNG overlay via Sharp/SVG — bypasses FFmpeg font issues entirely
        let subPngFile: string | null = null;
        if (slideText && subtitleEnabled) {
          const subText = buildSubtitleText(slideText);
          if (subText) {
            subPngFile = path.join(tempDir, `sub_${scene.scene}.png`);
            try { await generateSubtitlePng(subText, subPngFile, "bottom", 52, subtitleCfg); }
            catch { subPngFile = null; }
          }
        }

        try {
          if (subPngFile) {
            // Overlay subtitle PNG on motion slide via filter_complex
            await execFileAsync(ffmpeg, [
              "-loop", "1", "-i", imagePath,
              "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
              "-loop", "1", "-i", subPngFile,
              "-filter_complex",
              `[0:v]${vfParts.join(",")}[base];[base][2:v]overlay=0:0[out]`,
              "-map", "[out]", "-map", "1:a",
              "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
              "-c:a", "aac", "-b:a", "128k",
              "-pix_fmt", "yuv420p",
              "-t", String(dur),
              "-movflags", "+faststart", "-shortest", "-y", slideFile,
            ], { timeout: 120000 });
          } else {
            await execFileAsync(ffmpeg, [
              "-loop", "1", "-i", imagePath,
              "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
              "-vf", vfParts.join(","),
              "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
              "-c:a", "aac", "-b:a", "128k",
              "-pix_fmt", "yuv420p",
              "-t", String(dur),
              "-movflags", "+faststart", "-shortest", "-y", slideFile,
            ], { timeout: 120000 });
          }
          return slideFile;
        } catch {
          // Fallback: simple scale without zoompan or text
          try {
            await execFileAsync(ffmpeg, [
              "-loop", "1", "-i", imagePath,
              "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
              "-vf", "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black,eq=brightness=0.06:contrast=1.1,fade=t=in:st=0:d=0.6,fade=t=out:st=" + Math.max(dur - 0.6, 0.5) + ":d=0.6",
              "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
              "-c:a", "aac", "-b:a", "128k",
              "-pix_fmt", "yuv420p",
              "-t", String(dur),
              "-movflags", "+faststart", "-shortest", "-y", slideFile,
            ], { timeout: 60000 });
            return slideFile;
          } catch (e2) {
            console.error(`[assemble] Image slide ${scene.scene} failed:`, e2);
            return null;
          }
        }
      } else if (scene.videoUrl.startsWith("bg:")) {
        // InvText slide — generate solid color video with text using FFmpeg
        const dur = scene.duration || 5;
        const slideFile = path.join(tempDir, `slide_${scene.scene}.mp4`);
        // Extract the BRIGHTEST color from the gradient for FFmpeg solid bg
        const gradientStr = scene.videoUrl.slice(3);
        const allColors = gradientStr.match(/#([0-9a-fA-F]{6})/g) || [];
        // Pick the brightest color (highest sum of RGB values)
        let bgColor = "7b2cbf";
        let maxBrightness = 0;
        for (const c of allColors) {
          const hex = c.slice(1);
          const r = parseInt(hex.slice(0, 2), 16);
          const g = parseInt(hex.slice(2, 4), 16);
          const b = parseInt(hex.slice(4, 6), 16);
          const brightness = r + g + b;
          if (brightness > maxBrightness) { maxBrightness = brightness; bgColor = hex; }
        }
        // If brightest is still too dark (< 200 sum), use a vivid fallback
        if (maxBrightness < 200) bgColor = "7b2cbf";
        const slideText = scene.text || "";

        // Generate gradient background PNG with sharp, then use FFmpeg drawtext
        const bgImageFile = path.join(tempDir, `bg_${scene.scene}.png`);
          const c1hex = allColors[0] || `#${bgColor}`;
          const c2hex = allColors[1] || c1hex;
          const c3hex = allColors[2] || c2hex;
          try {
            const sharp = (await import("sharp")).default;
            const bgSvg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
              <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="${c1hex}"/><stop offset="50%" stop-color="${c2hex}"/><stop offset="100%" stop-color="${c3hex}"/>
              </linearGradient></defs>
              <rect width="1920" height="1080" fill="url(#bg)"/>
            </svg>`);
            await sharp(bgSvg).png().toFile(bgImageFile);
          } catch {
            await execFileAsync(ffmpeg, ["-f","lavfi","-i",`color=c=0x${bgColor}:s=1920x1080:d=1`,"-frames:v","1","-y",bgImageFile], { timeout: 10000 });
          }

          // ── Text for bg: slide — max 3 words, centered on frame ──
          const bgSubText = buildSubtitleText(slideText);

          // Generate subtitle PNG (centered for bg slides) — Sharp/SVG, no drawtext
          let bgSubPng: string | null = null;
          if (bgSubText && subtitleEnabled) {
            bgSubPng = path.join(tempDir, `bgsub_${scene.scene}.png`);
            try { await generateSubtitlePng(bgSubText, bgSubPng, "center", 64, subtitleCfg); }
            catch { bgSubPng = null; }
          }

          try {
            if (bgSubPng) {
              await execFileAsync(ffmpeg, [
                "-loop", "1", "-i", bgImageFile,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-loop", "1", "-i", bgSubPng,
                "-filter_complex", "[0:v]scale=1920:1080[base];[base][2:v]overlay=0:0[out]",
                "-map", "[out]", "-map", "1:a",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-t", String(dur),
                "-movflags", "+faststart", "-y", slideFile,
              ], { timeout: 60000 });
            } else {
              await execFileAsync(ffmpeg, [
                "-loop", "1", "-i", bgImageFile,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-vf", "scale=1920:1080",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-t", String(dur),
                "-movflags", "+faststart", "-y", slideFile,
              ], { timeout: 60000 });
            }
            return slideFile;
          } catch (slideErr) {
            // Fallback without text
            try {
              await execFileAsync(ffmpeg, [
                "-loop", "1", "-i", bgImageFile,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-vf", "scale=1920:1080",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k",
                "-pix_fmt", "yuv420p",
                "-t", String(dur),
                "-movflags", "+faststart", "-y", slideFile,
              ], { timeout: 60000 });
              return slideFile;
            } catch (e2) {
              console.error(`[assemble] bg slide ${scene.scene} failed:`, e2);
              return null;
            }
          }
        // (drawtext pipeline above handles everything)
      } else {
        let videoPath = resolveMediaPath(scene.videoUrl);
        // Download external video URLs to temp
        if (!videoPath && (scene.videoUrl.startsWith("http://") || scene.videoUrl.startsWith("https://"))) {
          const ext = scene.videoUrl.split("?")[0].split(".").pop()?.toLowerCase() || "mp4";
          const localDest = path.join(tempDir, `scene_vid_${scene.scene}.${ext}`);
          try {
            await downloadToLocal(scene.videoUrl, localDest);
            videoPath = localDest;
          } catch (err) {
            console.warn(`[assemble] Scene ${scene.scene} video download failed: ${err}`);
          }
        }
        if (!videoPath || !fs.existsSync(videoPath)) {
          // Video file not found — fall back to gradient slide (with subtitle if any)
          console.warn(`[assemble] Scene ${scene.scene} video not found (${scene.videoUrl}) — falling back to gradient slide`);
          const dur = scene.duration || 5;
          const slideFile = path.join(tempDir, `bgfallback_${scene.scene}.mp4`);
          const fps = 25;
          const fallbackSubText = buildSubtitleText(scene.text || "");
          let fallbackSubPng: string | null = null;
          if (fallbackSubText && subtitleEnabled) {
            fallbackSubPng = path.join(tempDir, `fbsub_${scene.scene}.png`);
            try { await generateSubtitlePng(fallbackSubText, fallbackSubPng, "bottom", 52, subtitleCfg); }
            catch { fallbackSubPng = null; }
          }
          const fallbackArgs: string[] = [
            "-f", "lavfi", "-i", `color=c=0x0a0d14:s=1920x1080:r=${fps}:d=${dur}`,
            "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
          ];
          if (fallbackSubPng) {
            fallbackArgs.push(
              "-loop", "1", "-i", fallbackSubPng,
              "-filter_complex", "[0:v][2:v]overlay=0:0[out]",
              "-map", "[out]", "-map", "1:a",
            );
          } else {
            fallbackArgs.push("-vf", "scale=1920:1080", "-map", "0:v", "-map", "1:a");
          }
          fallbackArgs.push(
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-c:a", "aac", "-b:a", "128k",
            "-pix_fmt", "yuv420p", "-movflags", "+faststart",
            "-t", String(dur), "-y", slideFile,
          );
          await execFileAsync(ffmpeg, fallbackArgs, { timeout: 60000 });
          return slideFile;
        } else {
          // Video found — normalize audio + apply subtitle PNG overlay in one pass
          const normFile = path.join(tempDir, `norm_${scene.scene}.mp4`);
          const subText = buildSubtitleText(scene.text || "");
          console.log(`[assemble] scene ${scene.scene} subText="${subText.slice(0, 60)}" style="${typeof subtitleCfg === 'object' ? subtitleCfg.mode : subtitleCfg}"`);

          // Generate subtitle PNG via Sharp/SVG — no drawtext font dependency
          let vidSubPng: string | null = null;
          if (subText && subtitleEnabled) {
            vidSubPng = path.join(tempDir, `vsub_${scene.scene}.png`);
            try {
              await generateSubtitlePng(subText, vidSubPng, "bottom", 52, subtitleCfg);
              console.log(`[assemble] scene ${scene.scene} subtitle PNG OK: ${vidSubPng}`);
            } catch (subErr) {
              console.error(`[assemble] scene ${scene.scene} subtitle PNG FAILED:`, subErr);
              vidSubPng = null;
            }
          }

          try {
            const probeResult = await execFileAsync(env.ffprobePath || "ffprobe", [
              "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type",
              "-of", "default=noprint_wrappers=1", videoPath,
            ], { timeout: 10000, encoding: "utf8" } as Parameters<typeof execFileAsync>[2]).catch(() => ({ stdout: "", stderr: "" }));
            const hasAudio = String(probeResult.stdout || "").includes("codec_type=audio");

            // ── Try subtitle overlay first (best quality) ──
            // If overlay fails, fall through to audio-only fix — never return raw video
            // (no-audio raw video breaks the concat demuxer for ALL subsequent scenes).
            if (vidSubPng) {
              const args: string[] = ["-i", videoPath];
              let subInputIdx: number;
              if (!hasAudio) {
                args.push("-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo");
                subInputIdx = 2;
              } else {
                subInputIdx = 1;
              }
              args.push("-loop", "1", "-i", vidSubPng);
              args.push(
                "-filter_complex", `[0:v][${subInputIdx}:v]overlay=0:0:format=auto[out]`,
                "-map", "[out]",
                "-map", hasAudio ? "0:a" : "1:a",
                "-c:v", "libx264", "-preset", "fast", "-crf", "23",
                "-c:a", "aac", "-b:a", "128k", "-pix_fmt", "yuv420p",
                "-shortest", "-movflags", "+faststart", "-y", normFile,
              );
              try {
                await execFileAsync(ffmpeg, args, { timeout: 120000 });
                return normFile;
              } catch {
                console.error(`[assemble] scene ${scene.scene} subtitle overlay failed — continuing with audio fix only`);
                // fall through
              }
            }

            // ── Subtitle skipped or overlay failed — fix audio consistency ──
            if (!hasAudio) {
              await execFileAsync(ffmpeg, [
                "-i", videoPath,
                "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo",
                "-map", "0:v", "-map", "1:a",
                "-c:v", "copy", "-c:a", "aac", "-b:a", "128k",
                "-shortest", "-movflags", "+faststart", "-y", normFile,
              ], { timeout: 60000 });
              return normFile;
            } else {
              // Normalize to consistent aac/44100/stereo — concat demuxer requires uniform audio
              try {
                await execFileAsync(ffmpeg, [
                  "-i", videoPath,
                  "-c:v", "copy",
                  "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
                  "-movflags", "+faststart", "-y", normFile,
                ], { timeout: 60000 });
                return normFile;
              } catch {
                return videoPath; // only if normalization itself fails
              }
            }
          } catch {
            return videoPath; // fallback: use original
          }
        }
      }
    }

    // ── Run ALL scenes in parallel — massive speed improvement ──
    const sceneResults = await Promise.all(body.scenes.map(processScene));
    const sceneFiles = sceneResults.filter((f): f is string => f !== null);
    if (sceneFiles.length === 0) {
      cleanTemp(tempDir);
      return NextResponse.json({ error: "All scenes failed to process" }, { status: 500 });
    }

    // ── Step 2: Concatenate scenes ──
    let concatOutput = path.join(tempDir, "concat_raw.mp4");
    if (sceneFiles.length === 1) {
      // Single scene — just copy
      fs.copyFileSync(sceneFiles[0], concatOutput);
    } else {
      // 2+ scenes — concat demuxer (reliable for same-format files)
      const concatFile = path.join(tempDir, "concat.txt");
      fs.writeFileSync(concatFile, sceneFiles.map(f => `file '${path.resolve(f).replace(/\\/g, "/")}'`).join("\n"));
      try {
        await execFileAsync(ffmpeg, [
          "-f", "concat", "-safe", "0", "-i", concatFile,
          "-c:v", "libx264", "-preset", "fast", "-crf", "23",
          "-c:a", "aac", "-b:a", "128k",
          "-movflags", "+faststart", "-y", concatOutput,
        ], { timeout: 600000 });
      } catch (e2) {
        cleanTemp(tempDir);
        return NextResponse.json({ error: `FFmpeg concat failed: ${e2 instanceof Error ? e2.message : String(e2)}` }, { status: 500 });
      }
    }

    // ── Step 3.5: Extend video to match narration length if narration > video ──
    // Prevents narration from being cut off by duration=first in the amix step.
    // The scene loop makes the story visuals cycle until the narration completes.
    {
      const mainNarrItem = body.narrationList?.find(n => (n.startTime || 0) < 1);
      const singleNarrPath = body.narrationUrl ? resolveMediaPath(body.narrationUrl) : null;
      const checkNarrPath = mainNarrItem ? resolveMediaPath(mainNarrItem.audioUrl) : singleNarrPath;
      if (checkNarrPath && fs.existsSync(checkNarrPath)) {
        try {
          const ffprobeExe = env.ffprobePath || "ffprobe";
          const [narrDurRes, vidDurRes] = await Promise.all([
            execFileAsync(ffprobeExe, ["-v","quiet","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", checkNarrPath], { timeout: 10000, encoding: "utf8" }).catch(() => ({ stdout: "0", stderr: "" })),
            execFileAsync(ffprobeExe, ["-v","quiet","-show_entries","format=duration","-of","default=noprint_wrappers=1:nokey=1", concatOutput], { timeout: 10000, encoding: "utf8" }).catch(() => ({ stdout: "0", stderr: "" })),
          ]);
          const narrDuration = parseFloat(String(narrDurRes.stdout || "0").trim()) || 0;
          const vidDuration  = parseFloat(String(vidDurRes.stdout  || "0").trim()) || 0;
          console.log(`[assemble] narration=${narrDuration.toFixed(1)}s video=${vidDuration.toFixed(1)}s`);
          if (narrDuration > vidDuration + 2) {
            const targetDur = Math.ceil(narrDuration) + 2;
            const extendedOutput = path.join(tempDir, "extended.mp4");
            await execFileAsync(ffmpeg, [
              "-stream_loop", "-1", "-i", concatOutput,
              "-c:v", "libx264", "-preset", "fast", "-crf", "23",
              "-c:a", "aac", "-b:a", "128k",
              "-t", String(targetDur),
              "-movflags", "+faststart", "-y", extendedOutput,
            ], { timeout: 600000 });
            concatOutput = extendedOutput;
            console.log(`[assemble] Extended video to ${targetDur}s to match narration`);
          }
        } catch (extErr) {
          console.error("[assemble] Video extension skipped:", extErr instanceof Error ? extErr.message : extErr);
        }
      }
    }

    // ── Steps 4+5 combined: mix music + narration in ONE FFmpeg pass (2× faster) ──
    // Falls back to sequential passes only when narration has multiple tracks with delays.
    let finalPath = concatOutput;

    const validMusicPath = await resolveOrDownload(body.musicUrl, tempDir, "music");
    const musicVol = body.musicVolume ?? 0.85;

    // Resolve single narration source (narrator at t=0, or single narrationUrl)
    const singleNarrItem = body.narrationList?.length === 1 && (body.narrationList[0].startTime || 0) < 1
      ? body.narrationList[0] : null;
    const rawNarrUrl = singleNarrItem?.audioUrl ?? body.narrationUrl ?? null;
    const singleNarrPath = await resolveOrDownload(rawNarrUrl, tempDir, "narr");
    const narrVol = singleNarrItem?.volume ?? body.narrationVolume ?? 1.0;

    const canCombine = !!(validMusicPath && singleNarrPath);

    if (canCombine) {
      // ── FAST PATH: music + narration in one pass ──
      const combinedOutput = path.join(tempDir, "combined_audio.mp4");
      console.log(`[assemble] Combined pass: music=${validMusicPath} narr=${singleNarrPath}`);
      try {
        await execFileAsync(ffmpeg, [
          "-i", concatOutput,
          "-stream_loop", "-1", "-vn", "-i", validMusicPath!,  // -vn strips any embedded album art / video stream
          "-i", singleNarrPath!,
          // Scene audio ducked to 0.2 (mostly silent for image slides)
          // Music at ~0.3 background level, narration at 1.0 dominant
          "-filter_complex", [
            `[0:a]aresample=44100,volume=0.2[bg]`,
            `[1:a]aresample=44100,volume=${musicVol * 0.35}[mu]`,
            `[2:a]aresample=44100,aformat=channel_layouts=stereo,volume=${narrVol}[na]`,
            `[bg][mu][na]amix=inputs=3:normalize=0:duration=first[out]`,
          ].join(";"),
          "-map", "0:v", "-map", "[out]",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
          "-movflags", "+faststart",
          "-y", combinedOutput,
        ], { timeout: 300000 });
        finalPath = combinedOutput;
      } catch (combErr) {
        console.error("[assemble] Combined pass failed, falling back to sequential:", combErr instanceof Error ? combErr.message.slice(0, 200) : combErr);
        // Fall through to sequential below
      }
    }

    // ── SEQUENTIAL FALLBACK: music only (no narration) ──
    if (finalPath === concatOutput && validMusicPath) {
      const musicOutput = path.join(tempDir, "with_music.mp4");
      try {
        await execFileAsync(ffmpeg, [
          "-i", concatOutput,
          "-stream_loop", "-1", "-vn", "-i", validMusicPath,
          "-filter_complex", `[0:a]aresample=44100,volume=0.5[va];[1:a]aresample=44100,volume=${musicVol}[ma];[va][ma]amix=inputs=2:normalize=0:duration=first[out]`,
          "-map", "0:v", "-map", "[out]",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
          "-movflags", "+faststart", "-y", musicOutput,
        ], { timeout: 300000 });
        finalPath = musicOutput;
      } catch {
        try {
          await execFileAsync(ffmpeg, [
            "-i", concatOutput, "-stream_loop", "-1", "-i", validMusicPath,
            "-map", "0:v", "-map", "1:a",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart", "-y", musicOutput,
          ], { timeout: 300000 });
          finalPath = musicOutput;
        } catch { /* keep concat */ }
      }
    }

    // ── SEQUENTIAL FALLBACK: multi-track narration with delays ──
    const multiNarrItems = !singleNarrItem && body.narrationList && body.narrationList.length > 0
      ? body.narrationList : [];
    for (let ni = 0; ni < multiNarrItems.length; ni++) {
      const narrItem = multiNarrItems[ni];
      const narrPath = await resolveOrDownload(narrItem.audioUrl, tempDir, `narrtrack${ni}`);
      if (!narrPath) continue;
      const narrOutput = path.join(tempDir, `with_narr_${ni}.mp4`);
      const delayMs = Math.round((narrItem.startTime || 0) * 1000);
      const vol = narrItem.volume ?? 1.0;
      // First track (narrator): duck background music to 0.35, voice at full volume
      // Subsequent tracks (character voices): keep existing mix at full volume, add voice on top
      const bgVol = ni === 0 ? 0.35 : 1.0;
      const adelay = delayMs > 0
        ? `aresample=44100,aformat=channel_layouts=stereo,adelay=${delayMs}|${delayMs}`
        : `aresample=44100,aformat=channel_layouts=stereo`;
      try {
        await execFileAsync(ffmpeg, [
          "-i", finalPath, "-i", narrPath,
          "-filter_complex", `[0:a]aresample=44100,volume=${bgVol}[bg];[1:a]${adelay},volume=${vol}[na];[bg][na]amix=inputs=2:normalize=0:duration=first[out]`,
          "-map", "0:v", "-map", "[out]",
          "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
          "-movflags", "+faststart", "-y", narrOutput,
        ], { timeout: 120000 });
        finalPath = narrOutput;
      } catch (narrErr) {
        console.error(`[assemble] narration track ${ni} failed:`, narrErr instanceof Error ? narrErr.message.slice(0, 300) : narrErr);
      }
    }

    // ── SEQUENTIAL FALLBACK: single narrationUrl (no music) ──
    if (!canCombine && !multiNarrItems.length && body.narrationUrl) {
      const narrationPath = await resolveOrDownload(body.narrationUrl, tempDir, "narr_single");
      if (narrationPath) {
        const narrationOutput = path.join(tempDir, "with_narration.mp4");
        const nVol = body.narrationVolume ?? 1.0;
        try {
          await execFileAsync(ffmpeg, [
            "-i", finalPath, "-i", narrationPath,
            "-filter_complex", `[0:a]aresample=44100,volume=0.30[va];[1:a]aresample=44100,aformat=channel_layouts=stereo,volume=${nVol}[na];[va][na]amix=inputs=2:normalize=0:duration=first[out]`,
            "-map", "0:v", "-map", "[out]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-movflags", "+faststart", "-y", narrationOutput,
          ], { timeout: 300000 });
          finalPath = narrationOutput;
        } catch {
          try {
            await execFileAsync(ffmpeg, [
              "-i", finalPath, "-i", narrationPath,
              "-map", "0:v", "-map", "1:a",
              "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
              "-movflags", "+faststart", "-y", narrationOutput,
            ], { timeout: 300000 });
            finalPath = narrationOutput;
          } catch (narrFbErr) {
            console.error(`[assemble] narration fallback failed:`, narrFbErr instanceof Error ? narrFbErr.message.slice(0, 200) : narrFbErr);
          }
        }
      }
    }

    // ── Step 5b: Mix SFX at timestamps if provided ──
    if (body.sfx?.length) {
      for (const sfxItem of body.sfx) {
        const sfxPath = await resolveOrDownload(sfxItem.sourceUrl, tempDir, `sfx_${sfxItem.startTime}`);
        if (!sfxPath) continue;

        const sfxOutput = path.join(tempDir, `with_sfx_${Date.now()}.mp4`);
        const delayMs = Math.round((sfxItem.startTime || 0) * 1000);
        const sfxVol = sfxItem.volume ?? 0.7;

        try {
          await execFileAsync(ffmpeg, [
            "-i", finalPath,
            "-i", sfxPath,
            "-filter_complex",
            `[1:a]aresample=44100,adelay=${delayMs}|${delayMs},volume=${sfxVol}[sfx];[0:a]aresample=44100[bg];[bg][sfx]amix=inputs=2:normalize=0:duration=first[out]`,
            "-map", "0:v", "-map", "[out]",
            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
            "-shortest", "-movflags", "+faststart",
            "-y", sfxOutput,
          ], { timeout: 120000 });
          finalPath = sfxOutput;
        } catch {
          // SFX mix failed — try without delay
          try {
            await execFileAsync(ffmpeg, [
              "-i", finalPath,
              "-i", sfxPath,
              "-filter_complex",
              `[1:a]aresample=44100,volume=${sfxVol}[sfx];[0:a]aresample=44100[bg];[bg][sfx]amix=inputs=2:normalize=0:duration=first[out]`,
              "-map", "0:v", "-map", "[out]",
              "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
              "-shortest", "-y", sfxOutput,
            ], { timeout: 120000 });
            finalPath = sfxOutput;
          } catch { /* skip this SFX */ }
        }
      }
    }

    // ── Step 5c: Burn caption text via drawtext (with fade-in, word-wrapped) ──
    if (body.caption) {
      const captionOutput = path.join(tempDir, "with_caption.mp4");
      const yPos = body.captionPosition === "top" ? "40" : body.captionPosition === "center" ? "(h-text_h)/2" : "h-text_h-60";

      // Word wrap caption: max 50 chars per line, max 3 lines
      const capWords = body.caption.split(/\s+/);
      const capLines: string[] = [];
      let capCur = "";
      for (const w of capWords) {
        if ((capCur + " " + w).trim().length > 50) {
          capLines.push(capCur.trim());
          capCur = w;
          if (capLines.length >= 3) break;
        } else {
          capCur = capCur ? capCur + " " + w : w;
        }
      }
      if (capCur.trim() && capLines.length < 3) capLines.push(capCur.trim());

      const escapedCapLines = capLines.map(l =>
        l.replace(/\\/g, "\\\\").replace(/'/g, "\u2019").replace(/:/g, "\\:").replace(/%/g, "%%")
      );
      const escapedText = escapedCapLines.join("\\n");
      const captionAnim = `:alpha='if(lt(t,0.8),t/0.8,1)'`;
      try {
        await execFileAsync(ffmpeg, [
          "-i", finalPath,
          "-vf", (() => {
            // Henry 2026-05-30: respect subtitleConfig + stagger across video so
            // subtitles don't sit stuck 5 sec at hardcoded fontsize=28 white.
            const subCfg = body.subtitleConfig;
            const fs = subCfg?.fontSize && subCfg.fontSize >= 18 ? Math.min(80, subCfg.fontSize) : 36;
            const txCol = subCfg?.textColor && /^#[0-9a-fA-F]{6}$/.test(subCfg.textColor) ? `0x${subCfg.textColor.slice(1)}` : "white";
            const bgOn = subCfg?.bgBox ?? false;
            const bgOp2 = Math.min(1, Math.max(0, subCfg?.bgOpacity ?? 0.6));
            const bgP = bgOn ? `:box=1:boxcolor=black@${bgOp2.toFixed(2)}:boxborderw=10` : "";
            const allWds = body.caption!.split(/\s+/).filter(Boolean);
            const CHUNK = 5;
            const grp: string[] = [];
            for (let i = 0; i < allWds.length; i += CHUNK) grp.push(allWds.slice(i, i + CHUNK).join(" "));
            const SEC = 1.6;
            const esc2 = (s: string) => s.replace(/\\/g, "\\\\").replace(/'/g, "’").replace(/:/g, "\\:").replace(/%/g, "%%");
            const parts = grp.map((g, idx) => {
              const s0 = idx * SEC;
              const s1 = s0 + SEC + 0.4;
              const enable = `:enable='between(t,${s0.toFixed(2)},${s1.toFixed(2)})'`;
              const fade = `:alpha='if(lt(t-${s0.toFixed(2)},0.25),(t-${s0.toFixed(2)})/0.25,if(gt(t-${s0.toFixed(2)},${(SEC - 0.25).toFixed(2)}),1-(t-${s0.toFixed(2)}-${(SEC - 0.25).toFixed(2)})/0.25,1))'`;
              return `drawtext=text='${esc2(g)}':fontsize=${fs}:fontcolor=${txCol}:borderw=2:bordercolor=black${bgP}:x=(w-text_w)/2:y=${yPos}${enable}${fade}`;
            });
            return parts.length > 0 ? parts.join(",") :
              `drawtext=text='${escapedText}':fontsize=${fs}:fontcolor=${txCol}:borderw=2:bordercolor=black${bgP}:x=(w-text_w)/2:y=${yPos}:line_spacing=10${captionAnim}`;
          })(),
          "-c:a", "copy", "-y", captionOutput,
        ], { timeout: 120000 });
        finalPath = captionOutput;
      } catch { /* drawtext failed — skip caption */ }
    }

    // ── Step 5d: Burn sticker overlays via FFmpeg drawellipse / drawbox ──
    if (body.stickers && body.stickers.length > 0) {
      const stickerOutput = path.join(tempDir, "with_stickers.mp4");
      try {
        // Build a chain of FFmpeg video filters for each sticker
        const stickerFilters: string[] = [];
        for (const stk of body.stickers) {
          // Convert hex color to FFmpeg color format (strip #)
          const ffColor = stk.color.replace("#", "0x") + "CC"; // ~80% opacity
          const enableExpr = `between(t,${stk.startTime},${stk.startTime + stk.duration})`;
          const sw = Math.max(1, Math.round(stk.strokeWidth));

          if (stk.type === "circle") {
            // drawellipse: center x/y, semi-axes a/b
            const cx = `W*${(stk.x + stk.width / 2) / 100}`;
            const cy = `H*${(stk.y + stk.height / 2) / 100}`;
            const ra = `W*${stk.width / 2 / 100}`;
            const rb = `H*${stk.height / 2 / 100}`;
            stickerFilters.push(
              `drawellipse=x=${cx}:y=${cy}:a=${ra}:b=${rb}:color=${ffColor}:t=${sw}:enable='${enableExpr}'`
            );
          } else if (stk.type === "underline") {
            // Horizontal line across the bottom of the region
            const lx = `W*${stk.x / 100}`;
            const ly = `H*${(stk.y + stk.height) / 100}`;
            const lw = `W*${stk.width / 100}`;
            stickerFilters.push(
              `drawbox=x=${lx}:y=${ly}:w=${lw}:h=${sw}:color=${ffColor}:t=fill:enable='${enableExpr}'`
            );
          } else if (stk.type === "arrow_right") {
            // Arrow shaft line
            const lx = `W*${stk.x / 100}`;
            const ly = `H*${(stk.y + stk.height / 2) / 100}`;
            const lw = `W*${stk.width / 100}`;
            stickerFilters.push(
              `drawbox=x=${lx}:y=${ly}:w=${lw}:h=${sw}:color=${ffColor}:t=fill:enable='${enableExpr}'`
            );
          } else if (stk.type === "checkmark") {
            // Two line segments approximated as thin boxes
            const bx = `W*${stk.x / 100}`;
            const by = `H*${(stk.y + stk.height * 0.5) / 100}`;
            const bw = `W*${(stk.width * 0.4) / 100}`;
            const bh = `H*${(stk.height * 0.5) / 100}`;
            stickerFilters.push(
              `drawbox=x=${bx}:y=${by}:w=${bw}:h=${sw}:color=${ffColor}:t=fill:enable='${enableExpr}'`
            );
          } else if (stk.type === "spotlight") {
            // Double ellipse for glow ring effect
            const cx = `W*${(stk.x + stk.width / 2) / 100}`;
            const cy = `H*${(stk.y + stk.height / 2) / 100}`;
            const ra = `W*${stk.width / 2 / 100}`;
            const rb = `H*${stk.height / 2 / 100}`;
            stickerFilters.push(
              `drawellipse=x=${cx}:y=${cy}:a=${ra}:b=${rb}:color=${ffColor}:t=${sw}:enable='${enableExpr}'`
            );
            // Outer ring slightly larger — reuse base ffColor without the opacity suffix
            const ffBase = ffColor.slice(0, -2); // strip the "CC" opacity suffix
            stickerFilters.push(
              `drawellipse=x=${cx}:y=${cy}:a=W*${(stk.width / 2 + 2) / 100}:b=H*${(stk.height / 2 + 2) / 100}:color=${ffBase}44:t=${Math.max(1, sw - 2)}:enable='${enableExpr}'`
            );
          } else {
            // Default: draw bounding box for all other types (star, burst, bracket)
            const bx = `W*${stk.x / 100}`;
            const by = `H*${stk.y / 100}`;
            const bw = `W*${stk.width / 100}`;
            const bh = `H*${stk.height / 100}`;
            stickerFilters.push(
              `drawbox=x=${bx}:y=${by}:w=${bw}:h=${bh}:color=${ffColor}:t=${sw}:enable='${enableExpr}'`
            );
          }
        }

        if (stickerFilters.length > 0) {
          await execFileAsync(env.ffmpegPath, [
            "-i", finalPath,
            "-vf", stickerFilters.join(","),
            "-c:a", "copy",
            "-c:v", "libx264", "-preset", "ultrafast", "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-y", stickerOutput,
          ], { timeout: 180000 });
          finalPath = stickerOutput;
        }
      } catch (err) {
        console.warn("[assemble] Sticker overlay failed, skipping:", err);
        // non-fatal — continue without stickers
      }
    }

    // ── Step 5e: Prepend intro / append outro clips if provided ──
    {
      const introPath = await resolveOrDownload(body.introUrl, tempDir, "intro");
      const outroPath = await resolveOrDownload(body.outroUrl, tempDir, "outro");
      if (introPath || outroPath) {
        const clipParts: string[] = [];
        if (introPath) clipParts.push(introPath);
        clipParts.push(finalPath);
        if (outroPath) clipParts.push(outroPath);

        if (clipParts.length > 1) {
          const withBumpers = path.join(tempDir, "with_bumpers.mp4");
          const bumperConcat = path.join(tempDir, "bumper_concat.txt");
          fs.writeFileSync(bumperConcat, clipParts.map(f => `file '${path.resolve(f).replace(/\\/g, "/")}'`).join("\n"));
          try {
            await execFileAsync(ffmpeg, [
              "-f", "concat", "-safe", "0", "-i", bumperConcat,
              "-c:v", "libx264", "-preset", "fast", "-crf", "23",
              "-c:a", "aac", "-b:a", "192k",
              "-movflags", "+faststart", "-y", withBumpers,
            ], { timeout: 300000 });
            finalPath = withBumpers;
          } catch (bumperErr) {
            console.warn("[assemble] Intro/outro concat failed, skipping:", bumperErr instanceof Error ? bumperErr.message.slice(0, 200) : bumperErr);
          }
        }
      }
    }

    // ── Step 6: Copy final to output directory ──
    const finalFilename = `movie_${body.projectId ?? "export"}_${Date.now()}.mp4`;
    const outputPath = path.join(outDir, finalFilename);
    fs.copyFileSync(finalPath, outputPath);

    // ── Step 7: Get duration with ffprobe ──
    let totalDuration = 0;
    try {
      const { stdout } = await execFileAsync(env.ffprobePath, [
        "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        outputPath,
      ]);
      totalDuration = parseFloat(stdout.trim()) || 0;
    } catch { /* ignore */ }

    // ── Step 8: Auto-save to asset library ──
    try {
      const assetFile = path.join(env.storagePath, "config", "asset-library.json");
      let assets: Array<Record<string, unknown>> = [];
      try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
      assets.unshift({
        id: `movie_${Date.now()}`, type: "video",
        name: body.title ? `Movie: ${body.title}` : `Assembled Movie`,
        description: `${body.scenes.length} scenes, ${Math.round(totalDuration)}s`,
        filePath: outputPath, tags: ["movie", "assembled", "final"],
        source: "movie_planner", createdAt: new Date().toISOString(),
      });
      fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
    } catch { /* best effort */ }

    // ── Step 8b: Also save to Content Registry (All Content page) ──
    try {
      const { createContentItem, updateContentItem, createContentVersion } = await import("@/modules/content-registry");
      const contentItem = await createContentItem({
        originalInput: body.title || "Assembled Video",
        mode: "FREE",
        aiAutoMode: true,
        aspectRatio: body.aspectRatio || "16:9",
        durationSeconds: totalDuration || undefined,
        storyContext: JSON.stringify({
          source: body.projectId?.includes("children") ? "children_planner" : body.projectId?.includes("movie") ? "movie_planner" : "hybrid_planner",
          scenes: body.scenes.length,
          duration: totalDuration,
          hasMusic: !!body.musicUrl,
          hasNarration: !!(body.narrationUrl || body.narrationList?.length),
          hasSfx: !!(body.sfx?.length),
        }),
      });
      // Mark as APPROVED with the output path so it shows in All Content
      await updateContentItem(contentItem.id, {
        status: "APPROVED",
        mergedOutputPath: outputPath,
        durationSeconds: totalDuration || undefined,
      });
      await createContentVersion({
        contentItemId: contentItem.id,
        status: "APPROVED",
        mergedOutputPath: outputPath,
        reason: `Auto-saved from video assembler — ${body.scenes.length} scenes`,
      });
    } catch { /* best effort */ }

    // ── Step 9: Auto-generate thumbnail ──
    let thumbnailUrl: string | null = null;
    try {
      const thumbDir = path.join(env.storagePath, "thumbnails");
      fs.mkdirSync(thumbDir, { recursive: true });
      const thumbPath = path.join(thumbDir, `thumb_${Date.now()}.jpg`);
      // Grab frame at 30% of video duration (usually a good representative frame)
      const thumbTime = Math.max(1, Math.round(totalDuration * 0.3));
      await execFileAsync(env.ffmpegPath, [
        "-ss", String(thumbTime), "-i", outputPath,
        "-vframes", "1", "-vf", "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black",
        "-q:v", "2", "-y", thumbPath,
      ], { timeout: 10000 });
      const thumbRel = thumbPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
      thumbnailUrl = `/api/media/${thumbRel}`;
    } catch { /* thumbnail generation is best-effort */ }

    // ── Cleanup temp ──
    cleanTemp(tempDir);

    // Warn only if narration is present AND video is under 30s (definitely too short)
    const narrationWarning = body.narrationList && body.narrationList.length > 0 && totalDuration < 30
      ? `⚠ Your video is ${Math.round(totalDuration)}s — add more scenes or increase scene durations so narration isn't cut off.`
      : null;

    const relPath = outputPath.replace(/\\/g, "/").replace(/^.*?storage\//, "");
    return NextResponse.json({
      outputUrl: `/api/media/${relPath}`,
      thumbnailUrl,
      duration: totalDuration,
      scenes: body.scenes.length,
      title: body.title ?? "Assembled Movie",
      ...(narrationWarning ? { warning: narrationWarning } : {}),
    });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

// ── Helpers ──

// ── Generate subtitle PNG overlay via Sharp/SVG ──
// Uses Sharp + SVG text rendering — no FFmpeg font dependency, no text_w issues.
// Position: "bottom" = lower-third bar, "center" = vertically centered bar.
// Accepts either legacy SubtitleStyle string OR rich SubtitleConfig object.
type SubtitleStyle = "classic" | "cinema" | "neon" | "minimal" | "bold" | "none";

async function generateSubtitlePng(
  text: string,
  outputPath: string,
  position: "bottom" | "center",
  fontSize: number,
  style: SubtitleStyle | SubtitleConfig = "classic",
): Promise<void> {
  // Resolve config: if style is a string, convert to SubtitleConfig
  const cfg: SubtitleConfig = (typeof style === "object")
    ? style
    : styleStringToConfig(style, position, fontSize);

  if ((cfg.mode as string) === "none") return;

  const sharp = (await import("sharp")).default;
  const W = 1920, H = 1080;
  const fs_px = cfg.fontSize ?? fontSize;
  const lineH = Math.round(fs_px * 1.4);
  const lines = wrapTextIntoLines(text, Math.round(52 * 48 / fs_px));
  const numLines = Math.max(lines.length, 1);
  const boxH = Math.round(lineH * numLines + fs_px * 0.9);
  const pos = cfg.position ?? (position === "center" ? "center" : "bottom");
  const boxY = pos === "center"
    ? Math.round(H / 2 - boxH / 2)
    : pos === "top"
      ? 60
      : H - boxH - 90;
  const firstLineY = boxY + Math.round(fs_px * 0.95 + (boxH - lineH * numLines) / 2);

  const escape = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const fontFamilyMap: Record<string, string> = {
    sans:    "Arial,Helvetica,sans-serif",
    serif:   "Georgia,'Times New Roman',serif",
    mono:    "'Courier New',Courier,monospace",
    display: "'Arial Black',Impact,sans-serif",
  };
  const fontFamily = fontFamilyMap[cfg.fontFamily ?? "sans"] ?? fontFamilyMap.sans;
  const textColor = cfg.textColor ?? "#ffffff";
  const highlightColor = cfg.highlightColor ?? "#f59e0b";
  const bgOpacity = cfg.bgOpacity ?? 0.75;

  const tspans = lines.map((line, i) =>
    `<tspan x="${W / 2}" dy="${i === 0 ? 0 : lineH}">${escape(line)}</tspan>`
  ).join("");

  let svg: string;

  switch (cfg.mode) {
    case "highlight": {
      // Highlight first word of each line in highlight color; rest in textColor
      const hlTspans = lines.map((line, i) => {
        const words = line.split(" ");
        const first = escape(words[0] ?? "");
        const rest = escape(words.slice(1).join(" "));
        return `<tspan x="${W / 2}" dy="${i === 0 ? 0 : lineH}">` +
          `<tspan fill="${highlightColor}" font-weight="900">${first} </tspan>` +
          (rest ? `<tspan fill="${textColor}">${rest}</tspan>` : "") +
          `</tspan>`;
      }).join("");
      const bgFill = cfg.bgBox ? `rgba(0,0,0,${bgOpacity})` : "none";
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <rect x="0" y="${boxY}" width="${W}" height="${boxH}" rx="4" fill="${bgFill}"/>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${fs_px}"
          font-weight="700"
          letter-spacing="1">${hlTspans}</text>
      </svg>`;
      break;
    }

    case "kids": {
      const bgFill = cfg.bgBox ? `rgba(76,29,149,${bgOpacity})` : "none";
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
          <filter id="kidsglow">
            <feGaussianBlur stdDeviation="4" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect x="20" y="${boxY}" width="${W - 40}" height="${boxH}" rx="16" fill="${bgFill}"
          stroke="${highlightColor}" stroke-width="3"/>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${Math.round(fs_px * 1.05)}"
          font-weight="900"
          fill="none"
          stroke="rgba(0,0,0,0.9)"
          stroke-width="6"
          stroke-linejoin="round">${tspans}</text>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${Math.round(fs_px * 1.05)}"
          font-weight="900"
          fill="${highlightColor}"
          filter="url(#kidsglow)">${tspans}</text>
      </svg>`;
      break;
    }

    case "dramatic": {
      const approxTextW = Math.min(lines.reduce((max, l) => Math.max(max, l.length), 0) * fs_px * 0.58 + 80, W - 80);
      const dBoxX = Math.round((W - approxTextW) / 2);
      const bgFill = cfg.bgBox ? `rgba(0,0,0,${bgOpacity})` : "none";
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <rect x="${dBoxX}" y="${boxY}" width="${approxTextW}" height="${boxH}" rx="2" fill="${bgFill}"/>
        <line x1="${dBoxX + 20}" y1="${boxY + 3}" x2="${dBoxX + approxTextW - 20}" y2="${boxY + 3}" stroke="${textColor}" stroke-width="1" stroke-opacity="0.5"/>
        <line x1="${dBoxX + 20}" y1="${boxY + boxH - 3}" x2="${dBoxX + approxTextW - 20}" y2="${boxY + boxH - 3}" stroke="${textColor}" stroke-width="1" stroke-opacity="0.5"/>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${fs_px}"
          font-weight="400"
          fill="${textColor}"
          letter-spacing="5">${tspans}</text>
      </svg>`;
      break;
    }

    case "social": {
      const bgFill = cfg.bgBox ? `rgba(0,0,0,${bgOpacity})` : "none";
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
          <filter id="socialglow">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <rect x="0" y="${boxY}" width="${W}" height="${boxH}" rx="8" fill="${bgFill}"/>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${Math.round(fs_px * 1.1)}"
          font-weight="900"
          fill="none"
          stroke="rgba(0,0,0,0.95)"
          stroke-width="7"
          stroke-linejoin="round"
          letter-spacing="2">${tspans}</text>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${Math.round(fs_px * 1.1)}"
          font-weight="900"
          fill="${textColor}"
          filter="url(#socialglow)"
          letter-spacing="2">${tspans}</text>
      </svg>`;
      break;
    }

    case "dialogue":
    default: {
      const bgFill = cfg.bgBox ? `rgba(0,0,0,${bgOpacity})` : "none";
      svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
        <defs>
          <filter id="txtshadow">
            <feDropShadow dx="2" dy="2" stdDeviation="3" flood-color="black" flood-opacity="0.85"/>
          </filter>
        </defs>
        <rect x="0" y="${boxY}" width="${W}" height="${boxH}" rx="6" fill="${bgFill}"/>
        <text x="${W / 2}" y="${firstLineY}"
          text-anchor="middle"
          font-family="${fontFamily}"
          font-size="${fs_px}"
          font-weight="700"
          fill="${textColor}"
          filter="${cfg.bgBox ? "none" : "url(#txtshadow)"}"
          letter-spacing="1.5">${tspans}</text>
      </svg>`;
      break;
    }
  }

  await sharp(Buffer.from(svg)).png().toFile(outputPath);
}

// Convert legacy SubtitleStyle string → SubtitleConfig
function styleStringToConfig(style: SubtitleStyle, position: "bottom" | "center", fontSize: number): SubtitleConfig {
  const base: SubtitleConfig = {
    mode: "dialogue",
    fontFamily: "sans",
    fontSize,
    textColor: "#ffffff",
    highlightColor: "#f59e0b",
    bgBox: true,
    bgOpacity: 0.75,
    position: position === "center" ? "center" : "bottom",
    animation: "fade",
  };
  switch (style) {
    case "cinema":  return { ...base, mode: "dramatic", fontFamily: "serif",   bgOpacity: 0.82 };
    case "neon":    return { ...base, mode: "social",   textColor: "#00d4ff",  bgOpacity: 0.85 };
    case "minimal": return { ...base, mode: "dialogue", bgBox: false };
    case "bold":    return { ...base, mode: "social",   fontFamily: "display", bgOpacity: 0.7 };
    case "none":    return { ...base, mode: "none" as SubtitleConfig["mode"] };
    case "classic":
    default:        return base;
  }
}

// ── Build safe subtitle lines: wrap full text into lines of ~55 chars ──
function buildSubtitleText(raw: string): string {
  if (!raw) return "";
  // Take first 2 sentences or 200 chars
  const sentenceMatch = raw.trim().match(/^([^.!?]*[.!?]){1,2}/);
  const text = (sentenceMatch ? sentenceMatch[0].trim() : raw.trim().slice(0, 200))
    .replace(/\\/g, "")
    .replace(/'/g, "\u2019")
    .replace(/:/g, " ")
    .replace(/%/g, "pct")
    .replace(/[^\w\s\u2018-\u201f.,!?-]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return text;
}

// ── Wrap text into lines of maxChars each ──
function wrapTextIntoLines(text: string, maxChars = 52): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 3); // max 3 lines
}

function resolveMediaPath(url: string): string | null {
  if (!url) return null;
  // Handle /api/media/... URLs → resolve to storage path
  const match = url.match(/\/api\/media\/(.+)/);
  if (match) {
    return path.join(env.storagePath, match[1].replace(/\//g, path.sep));
  }
  // Handle direct storage paths
  if (fs.existsSync(url)) return url;
  const storagePath = path.join(env.storagePath, url);
  if (fs.existsSync(storagePath)) return storagePath;
  return null;
}

async function downloadToLocal(url: string, destPath: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`Download failed ${res.status}: ${url}`);
  const buf = await res.arrayBuffer();
  fs.writeFileSync(destPath, Buffer.from(buf));
}

async function resolveOrDownload(url: string | undefined | null, tempDir: string, prefix: string): Promise<string | null> {
  if (!url) return null;
  const local = resolveMediaPath(url);
  if (local && fs.existsSync(local)) return local;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    const ext = (url.split("?")[0].split(".").pop()?.toLowerCase() || "mp3").slice(0, 4);
    const dest = path.join(tempDir, `${prefix}_dl_${Date.now()}.${ext}`);
    try {
      await downloadToLocal(url, dest);
      return dest;
    } catch (err) {
      console.warn(`[assemble] resolveOrDownload failed for ${prefix}: ${err}`);
      return null;
    }
  }
  // Relative /api/... URL — fetch from local Next.js server
  if (url.startsWith("/api/") || url.startsWith("/media/")) {
    const port = process.env.PORT || "3200";
    const absoluteUrl = `http://localhost:${port}${url}`;
    const ext = (url.split("?")[0].split(".").pop()?.toLowerCase() || "mp3").slice(0, 4);
    const dest = path.join(tempDir, `${prefix}_local_${Date.now()}.${ext}`);
    try {
      await downloadToLocal(absoluteUrl, dest);
      if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
    } catch (err) {
      console.warn(`[assemble] resolveOrDownload local fetch failed for ${prefix} (${url}): ${err}`);
    }
  }
  return null;
}

function cleanTemp(dir: string) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch { /* ignore */ }
}
