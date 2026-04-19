import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import AdmZip from "adm-zip";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing character id" }, { status: 400 });
  }

  try {
    const char = await prisma.characterVoice.findUnique({ where: { id } });
    if (!char) {
      return NextResponse.json({ error: "Character not found" }, { status: 404 });
    }

    // Build human-readable description
    const descLines: string[] = [
      `Character: ${char.name}`,
      `Character ID: ${char.characterId || "—"}`,
      `Gender: ${char.gender || "—"}`,
      `Role: ${char.role || "—"}`,
      `Tone: ${char.toneClass || "—"}`,
      `Accent: ${char.accent || "—"}`,
      `Language: ${char.language || "—"}`,
      `Voice: ${char.voiceName || "—"} (${char.voiceId || "no voice ID"})`,
      `Is Narrator: ${char.isNarrator ? "Yes" : "No"}`,
      `Default Speech Style: ${char.defaultSpeechStyle || "normal"}`,
      `Age: ${char.age || "—"}`,
      `Country: ${char.country || "—"}`,
      `Personality: ${char.personality || "—"}`,
      `Culture: ${char.culture || "—"}`,
      "",
      "Visual Description:",
      char.visualDescription || "(none)",
      "",
      "Notes:",
      char.notes || "(none)",
    ];

    // Build structured JSON for re-import
    const characterJson = {
      _format: "GioHomeStudio Character Export",
      _version: "1.0",
      _exportDate: new Date().toISOString(),
      characterId: char.characterId,
      name: char.name,
      gender: char.gender,
      toneClass: char.toneClass,
      accent: char.accent,
      language: char.language,
      voiceId: char.voiceId,
      voiceName: char.voiceName,
      isNarrator: char.isNarrator,
      role: char.role,
      defaultSpeechStyle: char.defaultSpeechStyle,
      visualDescription: char.visualDescription,
      notes: char.notes,
      age: char.age,
      country: char.country,
      personality: char.personality,
      culture: char.culture,
      height: char.height,
      dialect: char.dialect,
      wardrobe: char.wardrobe,
      hairstyle: char.hairstyle,
      voiceProvider: char.voiceProvider,
      // Image filenames (relative to ZIP images/ folder)
      imageFile: char.imageUrl ? "images/portrait.png" : null,
      referenceImageFiles: [] as string[],
    };

    // Create ZIP
    const zip = new AdmZip();

    // Add description.txt
    zip.addFile("description.txt", Buffer.from(descLines.join("\n"), "utf-8"));

    // Collect and download images
    const imageUrls: Array<{ name: string; url: string }> = [];
    if (char.imageUrl) {
      imageUrls.push({ name: "portrait", url: char.imageUrl });
    }
    const refImages = char.referenceImages as Array<{ url?: string; angle?: string; label?: string }> | null;
    if (Array.isArray(refImages)) {
      for (const ref of refImages) {
        if (ref.url) {
          imageUrls.push({ name: ref.angle || ref.label || `ref_${imageUrls.length}`, url: ref.url });
        }
      }
    }

    // Download each image and add to ZIP as actual PNG/JPG files
    for (const img of imageUrls) {
      try {
        // Handle both absolute URLs and /api/media/ relative URLs
        let fetchUrl = img.url;
        if (fetchUrl.startsWith("/")) {
          fetchUrl = `http://localhost:${process.env.PORT || 3200}${fetchUrl}`;
        }
        const resp = await fetch(fetchUrl, { signal: AbortSignal.timeout(15000) });
        if (resp.ok) {
          const buf = Buffer.from(await resp.arrayBuffer());
          const contentType = resp.headers.get("content-type") || "image/png";
          const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
          const cleanName = img.name.replace(/[^a-zA-Z0-9_-]/g, "_");
          const filename = `images/${cleanName}.${ext}`;
          zip.addFile(filename, buf);
          characterJson.referenceImageFiles.push(filename);
        }
      } catch {
        // Skip images that fail to download — add note
      }
    }

    // Add character.json (for re-import)
    zip.addFile("character.json", Buffer.from(JSON.stringify(characterJson, null, 2), "utf-8"));

    // Generate ZIP buffer
    const zipBuffer = zip.toBuffer();
    const safeName = (char.name || "character").replace(/[^a-zA-Z0-9_-]/g, "_");

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeName}_export.zip"`,
        "Content-Length": String(zipBuffer.length),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Character export error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
