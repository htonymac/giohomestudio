// POST /api/character-voices/auto-portraits
// Batch-generate portraits for all characters with visualDescription but no imageUrl.
// Returns { queued: number, results: [{id, name, status, imageUrl?, error?}] }

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";

export async function POST(req: NextRequest) {
  const FAL_KEY = process.env.FAL_KEY ?? process.env.FAL_API_KEY;
  if (!FAL_KEY) return NextResponse.json({ error: "FAL_KEY not configured" }, { status: 503 });

  const body = await req.json().catch(() => ({})) as { limit?: number; ids?: string[] };
  const limit = Math.min(body.limit ?? 20, 50);

  const where = body.ids?.length
    ? { id: { in: body.ids }, imageUrl: null }
    : { imageUrl: null, visualDescription: { not: null } };

  const characters = await prisma.characterVoice.findMany({
    where,
    select: { id: true, name: true, visualDescription: true, gender: true, age: true },
    take: limit,
  });

  if (!characters.length) {
    return NextResponse.json({ queued: 0, message: "All characters already have portraits", results: [] });
  }

  const results: { id: string; name: string; status: "ok" | "error"; imageUrl?: string; error?: string }[] = [];

  for (const char of characters) {
    const desc = char.visualDescription?.trim();
    if (!desc) { results.push({ id: char.id, name: char.name, status: "error", error: "No visualDescription" }); continue; }

    const genderHint = char.gender === "female" || char.gender === "girl" ? "female character, "
      : char.gender === "male" || char.gender === "boy" ? "male character, " : "";

    // Henry 2026-06-08: portraits were rendering 8-year-olds as 30-40yo men
    // because the prompt had no age anchor + visualDescription's "8-year-old"
    // text wasn't weighted strongly enough by the diffusion model. Add explicit
    // age tokens for each age bucket. char.age is "child|teen|young_adult|adult|elder".
    const AGE_PORTRAIT_ANCHOR: Record<string, string> = {
      child:       "young child age 6-10, small body, rounded baby face, child proportions, NOT an adult, NOT a teen, no facial hair, no muscular adult build, no mature features",
      teen:        "teenager age 13-17, adolescent face, teen build, NOT an adult, NOT a child",
      young_adult: "young adult in early-to-mid 20s, smooth youthful skin, full dark hair, clean-shaven or light stubble at most, NO grey hair, NO wrinkles, NOT middle-aged",
      adult:       "adult age 30-45, mature face, full adult anatomy",
      elder:       "elderly age 65+, grey or white hair, wrinkled face, aged posture",
    };
    const ageAnchor = char.age && AGE_PORTRAIT_ANCHOR[char.age] ? `, ${AGE_PORTRAIT_ANCHOR[char.age]}` : "";

    // Henry 2026-06-08: also dropped the "looking at camera" anchor. That phrase
    // was forcing posed/headshot output → smiling-into-lens portraits even on
    // action stories. Replaced with neutral expression + 3/4 angle so PuLID
    // face-lock still works for face recognition without dragging the smile
    // into every scene. "clean neutral background" stays so the face isn't
    // distracted by environment when reused as a reference.
    const prompt = `character reference portrait, ${genderHint}${desc}${ageAnchor}, 3/4 angle face, neutral expression, NOT smiling at camera, clean neutral background, photorealistic, high quality, sharp focus on face`;

    try {
      // Migrated to providers/fal adapter (Henry 2026-05-30 task #28).
      const { falFluxDevSync, falFluxSchnell } = await import("@/lib/providers/fal");
      let imgUrl: string | undefined;

      const devR = await falFluxDevSync({
        prompt, imageSize: { width: 512, height: 768 }, numInferenceSteps: 28, guidanceScale: 3.5,
      });
      if (devR.ok) {
        imgUrl = devR.data.images?.[0]?.url;
      } else {
        const schR = await falFluxSchnell({
          prompt, imageSize: { width: 512, height: 768 }, numInferenceSteps: 4,
        });
        if (schR.ok) imgUrl = schR.data.images?.[0]?.url;
      }

      if (!imgUrl) { results.push({ id: char.id, name: char.name, status: "error", error: "No image from FAL" }); continue; }

      const outDir = path.join(env.storagePath, "characters", char.id);
      fs.mkdirSync(outDir, { recursive: true });
      const outFile = path.join(outDir, `portrait_${Date.now()}.jpg`);
      const imgRes = await fetch(imgUrl);
      if (imgRes.ok) await writeMedia(outFile, Buffer.from(await imgRes.arrayBuffer()));

      const relPath = outFile.replace(/\\/g, "/").replace(/^.*?storage\//, "");
      const localUrl = `/api/media/${relPath}`;
      await prisma.characterVoice.update({ where: { id: char.id }, data: { imageUrl: localUrl } });
      results.push({ id: char.id, name: char.name, status: "ok", imageUrl: localUrl });

    } catch (err) {
      results.push({ id: char.id, name: char.name, status: "error", error: err instanceof Error ? err.message : "Unknown" });
    }
  }

  const ok = results.filter(r => r.status === "ok").length;
  return NextResponse.json({ queued: characters.length, generated: ok, failed: results.length - ok, results });
}
