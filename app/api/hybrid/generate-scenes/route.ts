// POST /api/hybrid/generate-scenes — Generate actual media per scene
// Takes approved hybrid scenes, generates video/images per scene type,
// then returns URLs for each generated asset.
// This is the "make it real" step — converts planned scenes into actual media.
//
// Source of truth: GHS_HYBRID_MASTER_WORKFLOW.md
// Stage 2 — GENERATE: Per-scene decision (image, video, image-to-video, audio-only)

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

interface GenerationResult {
  sceneId: string;
  status: "generated" | "failed" | "skipped";
  assetUrl?: string;
  error?: string;
  engine?: string;
  duration?: number;
}

export async function POST(req: NextRequest) {
  try {
    const { projectId, sceneIds, model, costPreference } = await req.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId required" }, { status: 400 });
    }

    // Load project with scenes
    const project = await prisma.hybridProject.findUnique({
      where: { id: projectId },
      include: {
        scenes: {
          include: { shots: true },
          orderBy: { orderIndex: "asc" },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    // Filter scenes to generate (all if no sceneIds specified)
    const scenesToGenerate = sceneIds
      ? project.scenes.filter(s => sceneIds.includes(s.id) || sceneIds.includes(s.sceneId))
      : project.scenes;

    // Determine default model based on cost preference
    const defaultModel = model || (
      costPreference === "efficient" ? "wan25" :
      costPreference === "premium" ? "kling3-pro" :
      "hailuo-fast" // balanced default
    );

    const results: GenerationResult[] = [];

    // Update project status
    await prisma.hybridProject.update({
      where: { id: projectId },
      data: { status: "ASSEMBLING" },
    });

    for (const scene of scenesToGenerate) {
      try {
        // Update scene status
        await prisma.hybridScene.update({
          where: { id: scene.id },
          data: { draftState: "generating", status: "in_progress" },
        });

        // Route based on scene type
        let assetUrl: string | null = null;
        let engine = defaultModel;

        if (scene.sceneType === "audio-bridge") {
          // Audio bridge — no visual generation needed, use gradient background
          assetUrl = `bg:linear-gradient(135deg, #22c55e20, #0a0d14, #22c55e10)`;
          engine = "none";
          results.push({ sceneId: scene.sceneId, status: "generated", assetUrl, engine, duration: scene.durationEstimate || 5 });

        } else if (scene.sceneType === "image-led") {
          // Image generation — use fal.ai image model
          const imagePrompt = buildImagePrompt(scene);
          try {
            const res = await fetch(new URL("/api/image/generate", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: imagePrompt, model: "flux-schnell" }),
            });
            const data = await res.json();
            if (data.imageUrl || data.url) {
              assetUrl = data.imageUrl || data.url;
              engine = "flux";
            }
          } catch { /* image gen failed */ }

          if (!assetUrl) {
            // Fallback: gradient with scene title
            assetUrl = `bg:linear-gradient(135deg, #00d4ff20, #0a0d14, #00d4ff10)`;
            engine = "fallback";
          }
          results.push({ sceneId: scene.sceneId, status: "generated", assetUrl, engine, duration: scene.durationEstimate || 5 });

        } else if (scene.sceneType === "video-led" || scene.sceneType === "hybrid") {
          // Video generation — use selected model
          const videoPrompt = buildVideoPrompt(scene);
          try {
            const res = await fetch(new URL("/api/video/generate", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prompt: videoPrompt,
                model: engine,
                aspectRatio: "16:9",
                duration: Math.min(scene.durationEstimate || 5, 10),
              }),
            });
            const data = await res.json();
            if (data.outputUrl) {
              assetUrl = data.outputUrl;
            }
          } catch { /* video gen failed */ }

          if (!assetUrl) {
            assetUrl = `bg:linear-gradient(135deg, #a855f720, #0a0d14, #a855f710)`;
            engine = "fallback";
          }
          results.push({ sceneId: scene.sceneId, status: assetUrl.startsWith("bg:") ? "failed" : "generated", assetUrl, engine, duration: scene.durationEstimate || 5 });

        } else if (scene.sceneType === "image-to-video") {
          // Image first, then animate — two-step process
          const imagePrompt = buildImagePrompt(scene);
          let imageUrl: string | null = null;

          // Step 1: Generate image
          try {
            const imgRes = await fetch(new URL("/api/image/generate", req.url).toString(), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ prompt: imagePrompt, model: "flux-schnell" }),
            });
            const imgData = await imgRes.json();
            if (imgData.imageUrl || imgData.url) imageUrl = imgData.imageUrl || imgData.url;
          } catch { /* image failed */ }

          // Step 2: Animate image (image-to-video)
          if (imageUrl) {
            try {
              const vidRes = await fetch(new URL("/api/video/generate", req.url).toString(), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  prompt: `Animate: ${scene.title}. Subtle camera movement, cinematic feel.`,
                  model: engine,
                  sourceImage: imageUrl,
                  aspectRatio: "16:9",
                }),
              });
              const vidData = await vidRes.json();
              if (vidData.outputUrl) assetUrl = vidData.outputUrl;
            } catch { /* animation failed — use static image */ }
          }

          if (!assetUrl) assetUrl = imageUrl || `bg:linear-gradient(135deg, #f59e0b20, #0a0d14, #f59e0b10)`;
          engine = assetUrl.startsWith("bg:") ? "fallback" : engine;
          results.push({ sceneId: scene.sceneId, status: assetUrl.startsWith("bg:") ? "failed" : "generated", assetUrl, engine, duration: scene.durationEstimate || 5 });
        }

        // Update scene with generated asset
        await prisma.hybridScene.update({
          where: { id: scene.id },
          data: {
            generatedAssetUrl: assetUrl,
            draftState: "generated",
            status: "completed",
          },
        });

      } catch (sceneErr) {
        results.push({
          sceneId: scene.sceneId,
          status: "failed",
          error: sceneErr instanceof Error ? sceneErr.message : "Generation failed",
        });
        await prisma.hybridScene.update({
          where: { id: scene.id },
          data: { draftState: "draft", status: "error" },
        });
      }
    }

    // Update project status
    const allGenerated = results.every(r => r.status === "generated");
    await prisma.hybridProject.update({
      where: { id: projectId },
      data: { status: allGenerated ? "ASSEMBLED" : "DRAFT_REVIEW" },
    });

    return NextResponse.json({
      results,
      generated: results.filter(r => r.status === "generated").length,
      failed: results.filter(r => r.status === "failed").length,
      total: results.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Scene generation failed" },
      { status: 500 }
    );
  }
}

// Build a structured image prompt from scene data
function buildImagePrompt(scene: {
  title: string;
  location?: string | null;
  timeOfDay?: string | null;
  weather?: string | null;
  mood?: string | null;
  lightingPlan?: string | null;
  cameraSuggestion?: string | null;
}): string {
  const parts = [scene.title];
  if (scene.location) parts.push(`Location: ${scene.location}`);
  if (scene.timeOfDay) parts.push(`Time: ${scene.timeOfDay}`);
  if (scene.weather) parts.push(`Weather: ${scene.weather}`);
  if (scene.mood) parts.push(`Mood: ${scene.mood}`);
  if (scene.lightingPlan) parts.push(`Lighting: ${scene.lightingPlan}`);
  if (scene.cameraSuggestion) parts.push(`Camera: ${scene.cameraSuggestion}`);
  parts.push("Professional cinematic quality, detailed, sharp focus");
  return parts.join(". ");
}

// Build a structured video prompt from scene data
function buildVideoPrompt(scene: {
  title: string;
  location?: string | null;
  timeOfDay?: string | null;
  weather?: string | null;
  mood?: string | null;
  lightingPlan?: string | null;
  cameraSuggestion?: string | null;
}): string {
  const parts = [scene.title];
  if (scene.location) parts.push(`Environment: ${scene.location}`);
  if (scene.timeOfDay) parts.push(scene.timeOfDay);
  if (scene.weather) parts.push(scene.weather);
  if (scene.mood) parts.push(`${scene.mood} atmosphere`);
  if (scene.lightingPlan) parts.push(`${scene.lightingPlan} lighting`);
  if (scene.cameraSuggestion) parts.push(`${scene.cameraSuggestion} camera`);
  parts.push("Cinematic quality, smooth motion, professional production");
  return parts.join(", ");
}
