// POST /api/music/upload  (multipart/form-data)
//   file        — the audio file (mp3/wav/m4a/ogg)
//   licenseType — "CC0" | "PIXABAY" | "MIXKIT" | "USER_OWNED" | "PUBLIC_DOMAIN"
//   title?      — display title
//   source?     — where it came from (e.g. "Pixabay", "Mixkit", "Internet Archive", "My own work")
//   sourceUrl?  — the track's page URL (recommended for dispute evidence)
//
// Henry 2026-06-15: royalty-free / user upload path. Saves the file to storage/music/uploads
// and writes a licence record so the track shows in the Music Library with a downloadable
// certificate. HARD RULE: no CC-BY / attribution-required uploads — rejected.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { appendLicenseRecord, type MusicLicenseRecord } from "@/lib/music-license-registry";
import { writeMedia } from "@/lib/storage/writeMedia";

const LICENSE_META: Record<string, { license: string; licenseUrl: string | null; source: string }> = {
  CC0:            { license: "CC0 / Public Domain", licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", source: "CC0 source" },
  PUBLIC_DOMAIN:  { license: "Public Domain",       licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/", source: "Public Domain" },
  PIXABAY:        { license: "Pixabay License",     licenseUrl: "https://pixabay.com/service/license-summary/",       source: "Pixabay" },
  MIXKIT:         { license: "Mixkit License",      licenseUrl: "https://mixkit.co/license/",                         source: "Mixkit" },
  USER_OWNED:     { license: "User-owned / licensed", licenseUrl: null,                                              source: "Uploaded by user" },
};

export async function POST(req: NextRequest) {
  let form: FormData;
  try { form = await req.formData(); } catch { return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 }); }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!/\.(mp3|wav|m4a|ogg)$/i.test(file.name)) return NextResponse.json({ error: "Unsupported audio type (use mp3/wav/m4a/ogg)" }, { status: 400 });

  const licenseType = String(form.get("licenseType") || "").toUpperCase();
  const meta = LICENSE_META[licenseType];
  if (!meta) {
    return NextResponse.json({ error: "licenseType must be one of CC0, PUBLIC_DOMAIN, PIXABAY, MIXKIT, USER_OWNED. CC-BY / attribution-required music is not allowed." }, { status: 400 });
  }

  // Save the file
  const uploadsDir = path.resolve(env.storagePath, "music", "uploads");
  try { fs.mkdirSync(uploadsDir, { recursive: true }); } catch { /* exists */ }
  const ts = Date.now();
  const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-z0-9._-]/gi, "_").slice(0, 60);
  const ext = (file.name.match(/\.[^.]+$/)?.[0] || ".mp3").toLowerCase();
  const filename = `up_${ts}_${safeBase}${ext}`;
  const filePath = path.join(uploadsDir, filename);
  try {
    await writeMedia(filePath, Buffer.from(await file.arrayBuffer()));
  } catch (e) {
    return NextResponse.json({ error: `Failed to save file: ${e instanceof Error ? e.message : String(e)}` }, { status: 500 });
  }

  const title = String(form.get("title") || "").trim() || safeBase.replace(/[_-]+/g, " ");
  const source = String(form.get("source") || "").trim() || meta.source;
  const sourceUrl = String(form.get("sourceUrl") || "").trim() || null;

  const record: MusicLicenseRecord = {
    id: `up_${ts}`,
    title,
    filename,
    source,
    sourceUrl,
    license: meta.license,
    licenseType: licenseType as MusicLicenseRecord["licenseType"],
    licenseUrl: meta.licenseUrl,
    commercialUseAllowed: true,
    attributionRequired: false,
    acquiredAt: new Date(ts).toISOString().slice(0, 10),
    verificationStatus: "user-attested",
    note: "Uploaded by user with attested licence. Keep your own source proof for disputes.",
  };

  try {
    appendLicenseRecord(record);
  } catch (e) {
    // Licence refused (e.g. somehow CC-BY) — remove the saved file to stay clean.
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    return NextResponse.json({ error: e instanceof Error ? e.message : "Licence refused" }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    id: record.id,
    filename,
    url: `/api/media/music/uploads/${filename}`,
    license: record.license,
    licenseCertificate: `/api/music/license?id=${encodeURIComponent(record.id)}&download=1`,
  });
}
