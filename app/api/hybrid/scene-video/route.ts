// POST /api/hybrid/scene-video — Animate a scene image into a video clip
// Returns a Server-Sent Events stream so the client can show live progress.
// Events: { type: "progress", percent, message } | { type: "done", videoUrl, ... } | { type: "error", message }

import { NextRequest } from "next/server";

// Allow up to 10 minutes — FAL video models (Wan, Kling, Hailuo) take 2-8 min
export const maxDuration = 600;

import { prisma } from "@/lib/prisma";
import { falGenerateVideo, downloadFalMedia, uploadImageToFal } from "@/lib/generation/gateways/fal";
import { segmindGenerateVideo } from "@/lib/generation/gateways/segmind";
import { runwayGenerateVideo, downloadRunwayVideo } from "@/lib/generation/gateways/runway";
import { muapiGenerateVideo, downloadMuApiVideo } from "@/lib/generation/gateways/muapi";
import { klingGenerateVideo, downloadKlingVideo } from "@/lib/generation/gateways/kling";
import { ModelEntry, getModelById, getDefaultVideoModel } from "@/lib/generation/model-registry";
import { markBroken, pickHealthyAlternative } from "@/lib/provider-health";
import { getMotionStylePrefix } from "@/lib/style-presets";
import { sanitizeStyleCollisions } from "@/lib/style/sanitizer";
import { getLateAnchor } from "@/lib/style/late-anchor";
import { extractMotionAction } from "@/lib/scene/motion-extractor";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";
import * as path from "path";
import * as fs from "fs";

/**
 * tryWithFallback — Phase E.1 provider-health auto-fallback helper for video.
 *
 * Calls generateFn(model). If it throws a provider error (404 / 422 / "model not found"),
 * marks the model broken, picks a healthy alternative in the same family, and retries ONCE.
 * If retry also fails, or no alternative exists, re-throws the original error.
 *
 * @param initialModel - The ModelEntry resolved from the request (or default model)
 * @param generateFn   - Async function that performs the actual generation call, receives
 *                       the active ModelEntry so the caller can use model.endpoint_id etc.
 * @returns The result of generateFn on success.
 * @throws The first provider error if no fallback is available or fallback also fails.
 */
async function tryWithFallback<T>(
  initialModel: ModelEntry,
  generateFn: (model: ModelEntry) => Promise<T>
): Promise<T> {
  try {
    return await generateFn(initialModel);
  } catch (firstErr) {
    const errMsg = firstErr instanceof Error ? firstErr.message : String(firstErr);
    // Only attempt fallback for provider-side failures (not local logic errors)
    const isProviderErr =
      /404|422|not found|unavailable|model.*error|endpoint.*error/i.test(errMsg);
    if (!isProviderErr) throw firstErr;

    markBroken(initialModel.id, errMsg);

    const alt = pickHealthyAlternative(initialModel.family ?? "unknown", initialModel.id);
    if (!alt) {
      console.warn(`[provider-health] No fallback for family=${initialModel.family ?? "unknown"} — surfacing error`);
      throw firstErr;
    }

    console.log(`[provider-health] Retrying ${initialModel.id} → ${alt.id}`);
    try {
      return await generateFn(alt);
    } catch (retryErr) {
      const retryMsg = retryErr instanceof Error ? retryErr.message : String(retryErr);
      markBroken(alt.id, retryMsg);
      console.warn(`[provider-health] Fallback ${alt.id} also failed — surfacing original error`);
      throw firstErr; // Surface the original error so the SSE message is coherent
    }
  }
}

// sanitizeStyleCollisions imported from @/lib/style/sanitizer (Phase B extraction)
// extractMotionAction imported from @/lib/scene/motion-extractor (Phase B extraction)

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    sceneId,
    projectId,
    sceneText,
    imageUrl,
    duration,
    motionDescription,
    modelId,
    seed,
    projectStyle,
  } = body;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: Record<string, unknown>) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        // ── Validate inputs ──
        if (!imageUrl) {
          send({ type: "error", message: "imageUrl is required — generate a scene image first" });
          controller.close();
          return;
        }
        if (!sceneText) {
          send({ type: "error", message: "sceneText is required" });
          controller.close();
          return;
        }

        send({ type: "progress", percent: 3, message: "Resolving model..." });

        // ── Resolve video model ──
        let model = modelId ? getModelById(modelId) : getDefaultVideoModel();
        // Henry 2026-06-12: "video shows 3D while my style is realistic". The default
        // (segmind pruna, $0.005 draft tier) ignores photorealism prompts — it stylizes
        // toward 3D animation no matter what the prompt says. When the project style is
        // realistic/nollywood and the user didn't hand-pick a model, route to a true
        // image-to-video model that PRESERVES the source image's look (the scene image
        // is already realistic — i2v carries that through). Fixed price ~$0.02/clip.
        const wantsRealism = /^(realistic|nollywood)$/i.test(projectStyle || "");
        if (!modelId && wantsRealism && process.env.MUAPI_API_KEY) {
          const realModel = getModelById(process.env.REALISTIC_VIDEO_MODEL || "muapi_seedance_lite");
          if (realModel?.is_active) {
            console.log(`[scene-video] realistic style → ${realModel.id} (draft model stylizes to 3D)`);
            model = realModel;
          }
        }
        if (!model) {
          send({ type: "error", message: `Model not found: ${modelId}` });
          controller.close();
          return;
        }
        if (!model.is_active) {
          send({ type: "error", message: `Model ${model.id} is not active` });
          controller.close();
          return;
        }

        // ── Build motion prompt — style lock FIRST, action directive SECOND ──
        // Video models read sceneText literally — without an action verb directive they
        // default to slow zoom / panning. Mirror image route's extractor so a "fight" or
        // "chase" scene actually animates the action, not a static glide over the still.
        //
        // sceneText is sanitized first so words like "animated voice" don't flip a
        // realistic clip into a cartoon clip. Same rules as scene-image.
        const stylePrefix = getMotionStylePrefix(projectStyle);
        const cleanSceneText = sanitizeStyleCollisions(sceneText || "", projectStyle);
        const motionActionDirective = extractMotionAction(cleanSceneText);
        const promptParts: string[] = [stylePrefix, cleanSceneText, motionActionDirective];
        if (motionDescription) promptParts.push(sanitizeStyleCollisions(motionDescription, projectStyle));
        promptParts.push("Smooth cinematic motion. Consistent characters and environment. Natural movement.");
        // Late-position style anchor — same role as in scene-image: fights drift caused by any
        // collision words we couldn't fully strip.
        // getLateAnchor imported from @/lib/style/late-anchor (Phase B extraction)
        promptParts.push(getLateAnchor(projectStyle || "3d-cinematic"));
        const motionPrompt = promptParts.join(". ");

        const maxDur = model.max_duration_seconds ?? 10;
        const clipDuration = Math.min(Math.max(Number(duration) || 5, 1), maxDur);

        console.log(`[scene-video] ${sceneId} → ${model.id} (${clipDuration}s)`);
        send({ type: "progress", percent: 6, message: `Using ${model.display_name} (${clipDuration}s)...` });

        // ── Resolve image URL ──
        let resolvedImageUrl = imageUrl;
        if (imageUrl.startsWith("/api/media/")) {
          const host = req.headers.get("host") || "localhost:3200";
          const proto = req.headers.get("x-forwarded-proto") || "http";
          resolvedImageUrl = `${proto}://${host}${imageUrl}`;
        }

        // ── Prepare output path ──
        const outputFilename = `scene_${sceneId || "video"}_${Date.now()}.mp4`;
        const outputPath = path.join(env.storagePath, "videos", outputFilename);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });

        // ── Dispatch to gateway ──
        if (model.gateway === "runway") {
          // Runway Direct — uses your Runway.com account credits
          // Runway needs a publicly accessible image URL. Upload to FAL CDN first.
          let runwayImageUrl = resolvedImageUrl;
          try {
            send({ type: "progress", percent: 7, message: "Uploading image for Runway..." });
            const relPath = imageUrl.startsWith("/api/media/")
              ? imageUrl.replace(/^\/api\/media\//, "")
              : null;
            const localImgPath = relPath ? path.join(env.storagePath, relPath.replace(/\//g, path.sep)) : null;
            if (localImgPath && fs.existsSync(localImgPath)) {
              const imgBuffer = fs.readFileSync(localImgPath);
              const ext = path.extname(localImgPath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
              runwayImageUrl = await uploadImageToFal(imgBuffer, mime);
              send({ type: "progress", percent: 12, message: "Image ready — sending to Runway..." });
            }
          } catch (uploadErr) {
            console.warn("[scene-video] Image upload for Runway failed, using resolved URL:", uploadErr);
          }

          const rr = await runwayGenerateVideo(
            {
              model: "gen4_turbo",
              promptText: motionPrompt,
              promptImage: runwayImageUrl,
              duration: (clipDuration <= 5 ? 5 : 10) as 5 | 10,
            },
            (evt) => send({ type: "progress", percent: evt.percent, message: evt.message }),
          );

          if (!rr.success || !rr.videoUrl) {
            send({ type: "error", message: rr.error || "Runway video generation failed" });
            controller.close();
            return;
          }
          send({ type: "progress", percent: 96, message: "Downloading from Runway..." });
          const runwayBuffer = await downloadRunwayVideo(rr.videoUrl);
          send({ type: "progress", percent: 98, message: "Saving video..." });
          await writeMedia(outputPath, runwayBuffer);

        } else if (model.gateway === "muapi") {
          // MuAPI — cheaper alternative for Seedance and Wan models
          // MuAPI needs a publicly accessible image URL — upload to FAL CDN first
          let muapiImageUrl = resolvedImageUrl;
          try {
            send({ type: "progress", percent: 7, message: "Uploading image for MuAPI..." });
            const relPath = imageUrl.startsWith("/api/media/")
              ? imageUrl.replace(/^\/api\/media\//, "")
              : null;
            const localImgPath = relPath ? path.join(env.storagePath, relPath.replace(/\//g, path.sep)) : null;
            if (localImgPath && fs.existsSync(localImgPath)) {
              const imgBuffer = fs.readFileSync(localImgPath);
              const ext = path.extname(localImgPath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
              muapiImageUrl = await uploadImageToFal(imgBuffer, mime);
              send({ type: "progress", percent: 12, message: "Image ready — starting MuAPI generation..." });
            }
          } catch (uploadErr) {
            console.warn("[scene-video] Image upload for MuAPI failed, using resolved URL:", uploadErr);
          }

          const mu = await muapiGenerateVideo(
            {
              endpoint: model.endpoint_id,
              prompt: motionPrompt,
              imageUrl: muapiImageUrl,
              duration: clipDuration,
              // Pass model resolution for Seedance; Wan ignores it (uses aspect_ratio)
              resolution: (model.resolution as "480p" | "720p" | "1080p" | undefined) ?? "720p",
            },
            (evt) => send({ type: "progress", percent: evt.percent, message: evt.message }),
          );

          if (!mu.success || !mu.videoUrl) {
            send({ type: "error", message: mu.error || "MuAPI video generation failed" });
            controller.close();
            return;
          }
          send({ type: "progress", percent: 96, message: "Downloading from MuAPI..." });
          const muBuffer = await downloadMuApiVideo(mu.videoUrl);
          send({ type: "progress", percent: 98, message: "Saving video..." });
          await writeMedia(outputPath, muBuffer);

        } else if (model.gateway === "segmind") {
          send({ type: "progress", percent: 15, message: "Fetching scene image..." });
          let imageBase64 = "";
          try {
            const imgRes = await fetch(resolvedImageUrl);
            const imgBuf = await imgRes.arrayBuffer();
            imageBase64 = Buffer.from(imgBuf).toString("base64");
          } catch {
            send({ type: "error", message: "Could not fetch scene image for Segmind" });
            controller.close();
            return;
          }

          send({ type: "progress", percent: 25, message: "Sending to Segmind — generating video..." });

          // Segmind progress simulation (it doesn't have a queue API)
          let segmindPct = 25;
          const segmindTimer = setInterval(() => {
            segmindPct = Math.min(85, segmindPct + 3);
            send({ type: "progress", percent: segmindPct, message: "Segmind generating video..." });
          }, 3000);

          const sr = await segmindGenerateVideo({
            endpoint: model.endpoint_id,
            prompt: motionPrompt,
            image: imageBase64,
            duration: clipDuration,
          });
          clearInterval(segmindTimer);

          if (!sr.success || !sr.data) {
            send({ type: "error", message: sr.error || "Segmind video failed" });
            controller.close();
            return;
          }
          send({ type: "progress", percent: 90, message: "Saving video..." });
          await writeMedia(outputPath, sr.data);

        } else if (model.gateway === "kling") {
          // Kling Direct — api.klingai.com (no FAL middleman)
          // Kling needs a publicly accessible image URL — upload to FAL CDN first
          let klingImageUrl = resolvedImageUrl;
          try {
            send({ type: "progress", percent: 7, message: "Uploading image for Kling Direct..." });
            const relPath = imageUrl.startsWith("/api/media/")
              ? imageUrl.replace(/^\/api\/media\//, "")
              : null;
            const localImgPath = relPath ? path.join(env.storagePath, relPath.replace(/\//g, path.sep)) : null;
            if (localImgPath && fs.existsSync(localImgPath)) {
              const imgBuffer = fs.readFileSync(localImgPath);
              const ext = path.extname(localImgPath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
              klingImageUrl = await uploadImageToFal(imgBuffer, mime);
              send({ type: "progress", percent: 12, message: "Image ready — starting Kling Direct..." });
            }
          } catch (uploadErr) {
            console.warn("[scene-video] Image upload for Kling failed, using resolved URL:", uploadErr);
          }

          // Map endpoint_id to Kling model name and mode
          // endpoint_id is the actual Kling model name: kling-v1, kling-v1-6, kling-v2-master, etc.
          const isKlingPro = model.id.includes("_pro");
          const klingModelName = model.endpoint_id as
            "kling-v1" | "kling-v1-5" | "kling-v1-6" | "kling-v2-1" | "kling-v2-master";

          const kr = await klingGenerateVideo(
            {
              model: klingModelName,
              prompt: motionPrompt,
              imageUrl: klingImageUrl,
              duration: clipDuration >= 10 ? 10 : 5,
              aspectRatio: "16:9",
              mode: isKlingPro ? "pro" : "std",
            },
            (evt) => send({ type: "progress", percent: evt.percent, message: evt.message }),
          );

          if (!kr.success || !kr.videoUrl) {
            send({ type: "error", message: kr.error || "Kling Direct video generation failed" });
            controller.close();
            return;
          }
          send({ type: "progress", percent: 94, message: "Downloading from Kling..." });
          const klingBuffer = await downloadKlingVideo(kr.videoUrl);
          send({ type: "progress", percent: 97, message: "Saving video..." });
          await writeMedia(outputPath, klingBuffer);

        } else {
          // FAL — upload image to FAL CDN first (FAL can't reach localhost URLs)
          let falImageUrl = resolvedImageUrl;
          try {
            send({ type: "progress", percent: 7, message: "Uploading image to FAL CDN..." });
            // Resolve /api/media/... to a local file path and read it
            const relPath = imageUrl.startsWith("/api/media/")
              ? imageUrl.replace(/^\/api\/media\//, "")
              : null;
            const localImgPath = relPath ? path.join(env.storagePath, relPath.replace(/\//g, path.sep)) : null;
            if (localImgPath && fs.existsSync(localImgPath)) {
              const imgBuffer = fs.readFileSync(localImgPath);
              const ext = path.extname(localImgPath).toLowerCase();
              const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
              falImageUrl = await uploadImageToFal(imgBuffer, mime);
              send({ type: "progress", percent: 12, message: "Image uploaded — starting generation..." });
            }
          } catch (uploadErr) {
            console.warn("[scene-video] FAL image upload failed, falling back to resolved URL:", uploadErr);
            // Keep using resolvedImageUrl as fallback (works if app is publicly accessible)
          }

          // FAL — streams real progress via onProgress callback.
          // Phase E.1: wrapped in tryWithFallback so 404/422 errors auto-retry with a
          // healthy model in the same family. The SSE send() callback is captured via closure.
          const { fr, activeModel } = await tryWithFallback(model, async (m) => {
            const result = await falGenerateVideo(
              { endpoint: m.endpoint_id, prompt: motionPrompt, imageUrl: falImageUrl, duration: clipDuration, ...(seed !== undefined && seed !== null ? { seed: Number(seed) } : {}) },
              (evt) => send({ type: "progress", percent: evt.percent, message: evt.message }),
            );
            return { fr: result, activeModel: m };
          });
          if (!fr.success || !fr.videoUrl) {
            send({ type: "error", message: fr.error || "FAL video generation failed" });
            controller.close();
            return;
          }
          if (activeModel.id !== model.id) {
            send({ type: "progress", percent: 88, message: `Switched to ${activeModel.display_name} (auto-fallback)` });
          }
          send({ type: "progress", percent: 92, message: "Downloading video from FAL..." });
          const videoBuffer = await downloadFalMedia(fr.videoUrl);
          send({ type: "progress", percent: 96, message: "Saving video..." });
          await writeMedia(outputPath, videoBuffer);
        }

        // ── Verify file was saved ──
        const savedOk = fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000;
        console.log(`[scene-video] saved=${savedOk} path=${outputPath} size=${savedOk ? fs.statSync(outputPath).size : 0}`);
        if (!savedOk) {
          send({ type: "error", message: `Video file was not saved correctly at ${outputPath}` });
          controller.close();
          return;
        }

        const localVideoUrl = `/api/media/videos/${outputFilename}`;

        // ── Write to server-side video registry (so any browser can see the video) ──
        try {
          const registryPath = path.join(env.storagePath, "video-registry.json");
          let registry: Record<string, string> = {};
          if (fs.existsSync(registryPath)) {
            try { registry = JSON.parse(fs.readFileSync(registryPath, "utf8")); } catch { /* corrupt — reset */ }
          }
          if (sceneId) {
            // Store with project-scoped key (prevents SC01 collisions across projects)
            const scopedKey = projectId ? `${projectId}_${sceneId}` : sceneId;
            registry[scopedKey] = localVideoUrl;
            // Also keep bare sceneId for backwards compat reads
            registry[sceneId] = localVideoUrl;
          }
          fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
          console.log(`[scene-video] registry updated: ${sceneId} → ${localVideoUrl}`);
        } catch (regErr) {
          console.warn("[scene-video] registry write failed:", regErr);
        }

        // ── Update DB ──
        if (projectId && sceneId) {
          try {
            await prisma.hybridScene.updateMany({
              where: { projectId, OR: [{ id: sceneId }, { sceneId: sceneId }] },
              data: { generatedAssetUrl: localVideoUrl, draftState: "generated", status: "completed" },
            });
          } catch { /* best effort */ }
        }

        // ── Save to asset library (best effort) ──
        try {
          await fetch(new URL("/api/assets", req.url).toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "video",
              name: `Scene Video: ${(sceneText || "").slice(0, 50)}`,
              description: motionPrompt.slice(0, 200),
              filePath: outputPath,
              tags: ["scene-video", "hybrid", model.id],
              source: "scene-video-generation",
              provider: model.provider_name,
            }),
          });
        } catch { /* best effort */ }

        // ── Done ──
        send({
          type: "done",
          videoUrl: localVideoUrl,
          videoPath: outputPath,
          duration: clipDuration,
          model: model.id,
          provider: model.provider_name,
          prompt: motionPrompt,
        });

      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : "Scene video generation failed" });
      } finally {
        try { controller.close(); } catch { /* already closed */ }
      }
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Connection": "keep-alive",
    },
  });
}
