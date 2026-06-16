// GET /api/music/license?id=<trackId|filename>            → JSON license record
// GET /api/music/license?id=<...>&download=1               → downloadable HTML license certificate
//
// Henry 2026-06-15: every piece of music a user puts in a video must carry proof of its
// licence so that, if YouTube/Content-ID flags the video, the user can dispute with a
// downloadable certificate (source + licence + licence URL + date). This endpoint is the
// single place that resolves a track's licence record and renders that certificate.
//
// Resolution order for a track id/filename:
//   1. storage/music/license-registry.json  — AI-generated / karaoke / uploaded tracks
//      (each generation path writes a record here keyed by track id).
//   2. storage/music/stock/manifest.json + storage/music/stock/freepd/manifest.json
//      — library tracks (CC0 Internet Archive, Pixabay, Mixkit, etc.).
// Henry policy: only CC0 / Pixabay / Mixkit are allowed; CC-BY is never served.

import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";

export interface LicenseRecord {
  id: string;
  title: string;
  filename?: string;
  source: string;            // e.g. "Internet Archive (cloud-music collection)"
  sourceUrl?: string | null; // page the track came from
  license: string;           // e.g. "CC0 / Public Domain", "Pixabay License"
  licenseType: string;       // "CC0" | "PIXABAY" | "MIXKIT" | "AI_GENERATED"
  licenseUrl?: string | null;
  commercialUseAllowed: boolean;
  attributionRequired: boolean;
  attribution?: string | null;
  acquiredAt?: string | null;     // ISO date the track was added / generated
  provider?: string | null;       // for AI music: "Stable Audio (fal.ai)" etc.
  model?: string | null;          // for AI music: model name
  verificationStatus?: string;
  note?: string | null;
}

function readJson<T>(file: string, fallback: T): T {
  try { return JSON.parse(fs.readFileSync(file, "utf-8")) as T; } catch { return fallback; }
}

// Normalise a stock-manifest entry into a LicenseRecord.
function fromManifest(e: Record<string, unknown>, dirUrl: string): LicenseRecord {
  return {
    id: String(e.id ?? e.filename ?? ""),
    title: String(e.description ?? e.filename ?? e.id ?? "Untitled track"),
    filename: e.filename ? String(e.filename) : undefined,
    source: String(e.source ?? "GHS library"),
    sourceUrl: (e.sourceUrl as string) ?? null,
    license: String(e.license ?? "UNVERIFIED"),
    licenseType: String(e.licenseType ?? "UNKNOWN"),
    licenseUrl: (e.licenseUrl as string) ?? null,
    commercialUseAllowed: e.commercialUseAllowed === true,
    attributionRequired: e.attributionRequired === true,
    attribution: (e.attribution as string) ?? null,
    acquiredAt: (e.acquiredAt as string) ?? null,
    verificationStatus: String(e.verificationStatus ?? "pending"),
    note: (e.verificationNote as string) ?? null,
    _url: `${dirUrl}/${String(e.filename ?? "")}`,
  } as LicenseRecord & { _url: string };
}

function resolveRecord(idOrName: string): LicenseRecord | null {
  const musicDir = path.resolve(env.storagePath, "music");
  const stockDir = path.join(musicDir, "stock");
  const want = idOrName.replace(/\.(mp3|wav|m4a|ogg)$/i, "");

  // 1. AI / karaoke / uploaded registry
  const registry = readJson<LicenseRecord[]>(path.join(musicDir, "license-registry.json"), []);
  const reg = registry.find(r => r.id === idOrName || r.id === want || r.filename === idOrName);
  if (reg) return reg;

  // 2. Stock manifests
  for (const [dir, urlPrefix] of [
    [stockDir, "/api/media/music/stock"],
    [path.join(stockDir, "freepd"), "/api/media/music/stock/freepd"],
  ] as const) {
    const man = readJson<Array<Record<string, unknown>>>(path.join(dir, "manifest.json"), []);
    const hit = man.find(e => String(e.id) === idOrName || String(e.filename) === idOrName || String(e.filename).replace(/\.[^.]+$/, "") === want);
    if (hit) return fromManifest(hit, urlPrefix);
  }
  return null;
}

function renderCertificate(r: LicenseRecord): string {
  const esc = (s: unknown) => String(s ?? "").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!));
  const row = (k: string, v: unknown) => v ? `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>` : "";
  const commercial = r.commercialUseAllowed ? "Yes — commercial use permitted" : "No — not cleared for commercial use";
  const attr = r.attributionRequired ? `Required: ${esc(r.attribution ?? "(see source)")}` : "Not required";
  return `<!doctype html><html><head><meta charset="utf-8"><title>Music Licence Certificate — ${esc(r.title)}</title>
<style>
 body{font-family:Georgia,serif;max-width:720px;margin:40px auto;padding:0 24px;color:#1a1a1a;line-height:1.5}
 h1{font-size:20px;border-bottom:2px solid #333;padding-bottom:8px}
 .sub{color:#666;font-size:12px;margin-top:-4px}
 table{border-collapse:collapse;width:100%;margin:18px 0}
 th{text-align:left;width:200px;vertical-align:top;padding:6px 10px;color:#444;font-weight:bold}
 td{padding:6px 10px;border-bottom:1px solid #eee}
 a{color:#1a5fb4;word-break:break-all}
 .note{background:#f6f6f2;border-left:3px solid #888;padding:10px 14px;font-size:13px;margin-top:18px}
 .foot{margin-top:24px;font-size:11px;color:#888}
 @media print{body{margin:0}}
</style></head><body>
<h1>Music Licence Certificate</h1>
<div class="sub">AndioStudio — proof of licence for published content</div>
<table>
${row("Track", r.title)}
${row("File", r.filename)}
${row("Source", r.source)}
${row("Source URL", r.sourceUrl)}
${row("Licence", r.license)}
${row("Licence URL", r.licenseUrl)}
${row("Commercial use", commercial)}
${row("Attribution", attr)}
${row("Provider", r.provider)}
${row("Model", r.model)}
${row("Acquired / generated", r.acquiredAt)}
${row("Note", r.note)}
</table>
<div class="note"><b>How to use this:</b> if a platform (e.g. YouTube Content ID) flags a video that uses this track, you can dispute the claim using this certificate as evidence of the track's licence and source. Public-domain / CC0 and Pixabay/Mixkit tracks are free for commercial use; claims on them can be disputed. Keep this certificate with your project records.</div>
<div class="foot">Generated by AndioStudio. This is licence provenance held by the platform and is not legal advice. Verify at the source URL before monetised use.</div>
</body></html>`;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id") || req.nextUrl.searchParams.get("filename");
  if (!id) return NextResponse.json({ error: "id (track id or filename) required" }, { status: 400 });

  const rec = resolveRecord(id);
  if (!rec) {
    return NextResponse.json({ found: false, error: "No licence record for this track. If it was generated or uploaded, the generation path must write a record to license-registry.json." }, { status: 404 });
  }

  if (req.nextUrl.searchParams.get("download") === "1") {
    const safe = (rec.filename || rec.id).replace(/[^a-z0-9._-]/gi, "_");
    return new NextResponse(renderCertificate(rec), {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="licence_${safe}.html"`,
      },
    });
  }

  return NextResponse.json({ found: true, license: rec });
}
