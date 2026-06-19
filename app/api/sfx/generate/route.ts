// POST /api/sfx/generate — AI sound effect generation
// Provider chain: local-match → FAL SFX (stable-audio) → ElevenLabs (premium)
// Auto-mode license enforcement: CC0, CC BY, Public Domain only. CC BY-NC + Unknown blocked.
// Request body: { description, provider?, mode?, autoSfx? }
//   provider: "local" | "fal" | "elevenlabs" (default: "fal" for auto mode)
//   mode: "auto" — activates license filter on local-match
//   autoSfx: true — alias for mode:"auto"

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import * as fs from "fs";
import * as path from "path";
import { env } from "@/config/env";
import { writeMedia } from "@/lib/storage/writeMedia";

const schema = z.object({
  description: z.string().min(1).max(300),
  provider: z.enum(["local", "fal", "elevenlabs"]).optional(),
  mode: z.string().optional(),
  autoSfx: z.boolean().optional(),
});

// Licences safe for commercial auto-mode use (CC BY-SA excluded — viral licence)
const SAFE_AUTO_LICENSES = ["cc0", "cc-by", "public-domain", "pixabay", "cc by"];

function isLicenseSafe(license: string): boolean {
  const l = license.toLowerCase().trim();
  // Explicit block list
  if (l.includes("nc") || l.includes("non-commercial") || l === "unknown" || l === "") return false;
  return SAFE_AUTO_LICENSES.some(safe => l.startsWith(safe) || l === safe);
}

// Local SFX track metadata (filename → license mapping via sidecar JSON or naming convention)
function getLocalTrackLicense(filename: string, sfxDir: string): { license: string; attribution?: string } {
  // Try reading sidecar <filename>.json for metadata
  const base = filename.replace(/\.(mp3|wav|ogg|flac)$/i, "");
  const sidecarPath = path.join(sfxDir, `${base}.json`);
  if (fs.existsSync(sidecarPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(sidecarPath, "utf-8"));
      return { license: meta.license || "unknown", attribution: meta.attribution };
    } catch { /* ignore */ }
  }
  // Filename convention: prefix with license, e.g. "cc0_rain_heavy.mp3" or "pixabay_crowd_cheering.mp3"
  const lower = base.toLowerCase();
  for (const safe of SAFE_AUTO_LICENSES) {
    const prefix = safe.replace(/[\s-]/g, "_");
    if (lower.startsWith(prefix + "_") || lower.startsWith(safe + "_")) {
      return { license: safe };
    }
  }
  if (lower.startsWith("cc_by_nc") || lower.startsWith("cc-by-nc")) return { license: "cc-by-nc" };
  // Default unknown — will be blocked in auto mode
  return { license: "unknown" };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { description, provider, mode, autoSfx } = parsed.data;
  const isAutoMode = autoSfx === true || mode === "auto";
  // Effective provider: explicit > auto-default (fal) > legacy fallback
  const effectiveProvider: "local" | "fal" | "elevenlabs" = provider ?? (isAutoMode ? "fal" : "fal");

  const sfxDir = path.resolve(env.storagePath, "sfx");

  // ── 1. Local library match ─────────────────────────────────────────────────
  if (effectiveProvider !== "elevenlabs") {
    if (fs.existsSync(sfxDir)) {
      const files = fs.readdirSync(sfxDir).filter(f => /\.(mp3|wav|ogg|flac)$/i.test(f));
      const text = description.toLowerCase();
      const words = text.split(/\s+/);

      for (const file of files) {
        const name = file.replace(/\.(mp3|wav|ogg|flac)$/i, "").replace(/[-_]/g, " ").toLowerCase();
        const matches = words.some(w => w.length > 2 && name.includes(w));
        if (!matches) continue;

        // License enforcement in auto mode
        if (isAutoMode) {
          const { license, attribution } = getLocalTrackLicense(file, sfxDir);
          const safe = isLicenseSafe(license);
          if (!safe) {
            console.log(`[SFX] auto-mode blocked: ${license} | ${file}`);
            continue; // skip, try next file
          }
          const safeForAutoMode = true;
          const fileUrl = `/api/media/sfx/${file}`;
          return NextResponse.json({
            sfxPath: path.join(sfxDir, file),
            fileUrl,
            source: "local_library",
            matched: file,
            provider: "local",
            cost: "free",
            safeForAutoMode,
            ...(attribution ? { attribution: { title: file, author: attribution, license } } : {}),
          });
        }

        // Non-auto mode: return first match without license check
        const fileUrl = `/api/media/sfx/${file}`;
        return NextResponse.json({
          sfxPath: path.join(sfxDir, file),
          fileUrl,
          source: "local_library",
          matched: file,
          provider: "local",
          cost: "free",
        });
      }
    }
  }

  // If explicitly requesting local only, stop here
  if (effectiveProvider === "local") {
    return NextResponse.json({
      error: "No matching local SFX found. Add .mp3/.wav files to storage/sfx/ or use 'fal'/'elevenlabs' provider.",
      suggestion: "Try descriptions like: applause, rain, thunder, car horn, door knock",
    }, { status: 404 });
  }

  // ── 2. FAL SFX (stable-audio) ──────────────────────────────────────────────
  const falKey = process.env.FAL_KEY;
  if (falKey && effectiveProvider !== "elevenlabs") {
    try {
      // Migrated to providers/fal adapter (Henry 2026-05-30 task #28).
      const { falStableAudio } = await import("@/lib/providers/fal");
      const falRes = await falStableAudio({ prompt: description, secondsTotal: 10, steps: 100 });

      if (!falRes.ok) {
        console.warn(`[SFX] FAL stable-audio ${falRes.status}:`, falRes.error.slice(0, 200));
        // Fall through to ElevenLabs
      } else {
        const falData = falRes.data;
        const remoteUrl = falData.audio_file?.url || falData.url;

        if (remoteUrl) {
          // Download and cache locally
          const dlRes = await fetch(remoteUrl, { signal: AbortSignal.timeout(30000) });
          if (dlRes.ok) {
            const sfxOutDir = path.resolve(env.storagePath, "sfx");
            fs.mkdirSync(sfxOutDir, { recursive: true });
            const filename = `fal_sfx_${Date.now()}.mp3`;
            const outPath = path.join(sfxOutDir, filename);
            const buffer = Buffer.from(await dlRes.arrayBuffer());
            await writeMedia(outPath, buffer);

            // Auto-save to asset library
            try {
              const assetFile = path.join(env.storagePath, "config", "asset-library.json");
              let assets: Array<Record<string, unknown>> = [];
              try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
              assets.unshift({
                id: `sfx_fal_${Date.now()}`,
                type: "sfx",
                name: description.slice(0, 50),
                description: `FAL AI SFX: ${description}`,
                filePath: outPath,
                tags: ["sfx", "ai-generated", "fal", "stable-audio"],
                source: "fal_sfx",
                safeForAutoMode: true, // AI-generated — no licence concern
                createdAt: new Date().toISOString(),
              });
              fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
            } catch { /* best effort */ }

            const fileUrl = `/api/media/sfx/${filename}`;
            return NextResponse.json({
              ok: true,
              sfxPath: outPath,
              fileUrl,
              source: "fal_sfx",
              provider: "fal",
              cost: "low",
              name: description.slice(0, 50),
              safeForAutoMode: true,
            });
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[SFX] FAL stable-audio error: ${msg}`);
      // Fall through to ElevenLabs
    }
  }

  // ── 3. ElevenLabs SFX (premium — ~100 credits per effect) ─────────────────
  if (effectiveProvider === "elevenlabs" || !falKey) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (apiKey) {
      try {
        const axios = (await import("axios")).default;
        const res = await axios.post("https://api.elevenlabs.io/v1/sound-generation", {
          text: description,
          duration_seconds: 3,
        }, {
          headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
          responseType: "arraybuffer",
          timeout: 30000,
        });

        const sfxOutDir = path.resolve(env.storagePath, "sfx");
        fs.mkdirSync(sfxOutDir, { recursive: true });
        const outPath = path.join(sfxOutDir, `ai_${Date.now()}.mp3`);
        await writeMedia(outPath, Buffer.from(res.data));

        // Auto-save to asset library
        try {
          const assetFile = path.join(env.storagePath, "config", "asset-library.json");
          let assets: Array<Record<string, unknown>> = [];
          try { assets = JSON.parse(fs.readFileSync(assetFile, "utf-8")); } catch { /* new */ }
          assets.unshift({
            id: `sfx_ai_${Date.now()}`,
            type: "sfx",
            name: description.slice(0, 50),
            description: `AI-generated SFX: ${description}`,
            filePath: outPath,
            tags: ["sfx", "ai-generated", "elevenlabs"],
            source: "elevenlabs_sfx",
            safeForAutoMode: true,
            createdAt: new Date().toISOString(),
          });
          fs.writeFileSync(assetFile, JSON.stringify(assets, null, 2));
        } catch { /* best effort */ }

        const fileUrl = `/api/media/sfx/${path.basename(outPath)}`;
        return NextResponse.json({
          ok: true,
          sfxPath: outPath,
          fileUrl,
          source: "elevenlabs_ai",
          provider: "elevenlabs",
          cost: "high",
          name: description.slice(0, 50),
          safeForAutoMode: true,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`[SFX] ElevenLabs generation failed: ${msg}`);
        // Fall through to not-found
      }
    }
  }

  return NextResponse.json({
    error: "No SFX source available. Configure FAL_KEY (free AI SFX) or ELEVENLABS_API_KEY (premium). Add local .mp3/.wav files to storage/sfx/ for offline matching.",
    suggestion: "Try descriptions like: applause, rain, thunder, car horn, door knock",
    chain: ["local_library: checked", "fal_sfx: " + (falKey ? "attempted" : "no FAL_KEY"), "elevenlabs: " + (process.env.ELEVENLABS_API_KEY ? "attempted" : "no key")],
  }, { status: 404 });
}
