"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useGate } from "../../components/PreGenerationGate";
import { useSearchParams } from "next/navigation";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import ButtonPrimary from "../../components/ui/ButtonPrimary";
import NarrationPanel from "../../components/NarrationPanel";
import LayerizePanel, { type LayerizeResult } from "../../components/LayerizePanel";
import NarrationControls, { type NarrationSettings as NarrationControlsSettings } from "../../components/NarrationControls";
import { DEFAULT_NARRATION_SETTINGS, type NarrationSettings } from "@/modules/voice-provider/accent-profiles";
import OverlayPanel from "../../components/OverlayPanel";
import AssetPicker from "../../components/AssetPicker";
import SFXPicker from "../../components/SFXPicker";
import CharacterPicker from "../../components/CharacterPicker";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";
import CaptionPreview from "./CaptionPreview";
import type { PresetName } from "@/modules/caption-compositor/types";
import { safeJson } from "../../../lib/api-utils";

// N1/A8: a stable, human-friendly tracking NUMBER derived from the project id (no DB column needed —
// same id → same number forever). Lets Henry / any AI look up + categorize a video.
function projNumber(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return String(1_000_000_000 + (h % 9_000_000_000));
}
// N1: friendly output filename — "<ProductOrTitle>_<number>.mp4" (sanitised).
function outputFileName(title: string, id: string): string {
  const clean = (title || "ad").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50) || "ad";
  return `${clean}_${projNumber(id)}.mp4`;
}

// Intro/outro card colour themes — "AI auto" lets the LLM pick; the rest are user-chosen.
const CARD_THEMES: Array<{ name: string; colors: { bg1: string; bg2: string; text: string; accent: string } | null }> = [
  { name: "AI auto",      colors: null },
  { name: "Navy/Gold",    colors: { bg1: "#0a1840", bg2: "#1e3a78", text: "#ffffff", accent: "#fbbf24" } },
  { name: "Black/Gold",   colors: { bg1: "#0a0a0a", bg2: "#2a2118", text: "#ffffff", accent: "#d4af37" } },
  { name: "White/Navy",   colors: { bg1: "#f5f5f5", bg2: "#dfe6f0", text: "#0a1840", accent: "#1e3a78" } },
  { name: "Green/Cream",  colors: { bg1: "#0f3d2e", bg2: "#1a5c44", text: "#f5f0e1", accent: "#e8c547" } },
  { name: "Purple/White", colors: { bg1: "#1a0a2e", bg2: "#3d1a6e", text: "#ffffff", accent: "#c9a8ff" } },
];

// ── Types ───────────────────────────────────────────────────────────────────

interface SlideEnhancement {
  preset?: string;
  level?: number;         // 1-100 per-slide
  orientation?: "auto" | "portrait" | "landscape";
  captionPosition?: "top" | "center" | "bottom";
  captionPreset?: PresetName;  // caption compositor style preset
  fontFamily?: string;
  fontSize?: number;
  fontBold?: boolean;
  fontItalic?: boolean;
  fontUnderline?: boolean;
  brightness?: number;    // Smart Enhance Pro: -100 to +100
  contrast?: number;
  saturation?: number;
  tint?: string;
  sharpen?: number;
  blur?: number;
  vignette?: number;
  tone?: string;          // "cinematic" | "warm" | "cool" | "vintage"
  motionPreset?: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down" | "none" | "auto" | "random";
  captionAnimation?: "fade" | "fade-up" | "fly-in-left" | "fly-in-right" | "none";
  fontSizeScale?: number;    // 0.3 – 1.5; default 0.7
  showNarration?: boolean;   // show narration line as subtitle on screen
}

interface CommercialSlide {
  id: string;
  slideOrder: number;
  imagePath: string | null;
  imageFileName: string | null;
  captionOriginal: string | null;
  captionPolished: string | null;
  captionApproved: boolean;
  narrationLine: string | null;
  durationMs: number;
  brandingEnabled: boolean;
  enhancementSettings: SlideEnhancement | null;
  status: string;
}

interface CommercialProject {
  id: string;
  projectName: string;
  aspectRatio: string;
  brandName: string | null;
  tagline: string | null;
  colorAccent: string | null;
  ctaMethod: string | null;
  ctaValue: string | null;
  ctaValueSecondary: string | null;
  ctaLabel: string | null;
  voiceId: string | null;
  voiceLanguage: string | null;
  targetDurationSec: number | null;
  autoDistribute: boolean;
  captionMaxWords: number;
  captionMaxChars: number | null;
  transitionType: string | null;
  transitionDurationSec: number | null;
  globalCaptionPosition: string | null;
  renderQuality: string;
  musicVolume: number;
  narrationVolume: number;
  musicPath: string | null;
  musicSource: string | null;
  enhancementPreset: string | null;
  enhancementLevel: number | null;
  renderStatus: string;
  contentItemId: string | null;
  renderedVideoPath: string | null;
  createdAt: string;
  slides: CommercialSlide[];
}

// ── SC: 5-Tier Sound Model Selector (binding architectural decision) ──────────
const SOUND_TIERS_COMM = [
  { id: "piper_free",      label: "Standard",      subtitle: "Built-in GHS",        cost: "Free",    badge: "DEFAULT" },
  { id: "piper_extended",  label: "Start Plus",    subtitle: "Extended Piper",       cost: "Low",     badge: ""        },
  { id: "ghs_karaoke",     label: "Sound Pro",     subtitle: "GHS Karaoke",          cost: "Mid",     badge: "PRO"     },
  { id: "elevenlabs",      label: "Classic",       subtitle: "ElevenLabs",           cost: "Premium", badge: ""        },
  { id: "gemini",          label: "Premium",       subtitle: "Gemini Audio",         cost: "Highest", badge: "BEST"    },
] as const;
type SoundTierCommId = typeof SOUND_TIERS_COMM[number]["id"];

const ASPECT_DIMS: Record<string, { w: number; h: number; label: string }> = {
  "9:16": { w: 9, h: 16, label: "Reels / TikTok / Shorts" },
  "16:9": { w: 16, h: 9, label: "YouTube / Desktop" },
  "1:1":  { w: 1,  h: 1,  label: "Instagram Feed" },
};

const ENHANCEMENT_PRESETS = [
  { id: "cinematic",    label: "Cinematic",   color: ds.color.lilac },
  { id: "hdr",          label: "HDR",          color: ds.color.pink },
  { id: "natural",      label: "Natural",      color: ds.color.mint },
  { id: "clean_social", label: "Clean Social", color: ds.color.gold },
  { id: "warm_promo",   label: "Warm Promo",  color: ds.color.coral },
];

const MOTION_PRESETS = [
  { id: "random",    label: "Random" },
  { id: "auto",      label: "Cycle" },
  { id: "zoom-in",   label: "Zoom In" },
  { id: "zoom-out",  label: "Zoom Out" },
  { id: "pan-left",  label: "Pan L" },
  { id: "pan-right", label: "Pan R" },
  { id: "pan-up",    label: "Pan Up" },
  { id: "pan-down",  label: "Pan Dn" },
  { id: "none",      label: "Static" },
];

const TRANSITION_TYPES = [
  { id: "none",        label: "None" },
  { id: "fade",        label: "Fade" },
  { id: "slide-left",  label: "Slide L" },
  { id: "slide-right", label: "Slide R" },
  { id: "zoom-in",     label: "Zoom In" },
];

const CAPTION_ANIMATIONS = [
  { id: "fade-up",      label: "Fade Up" },
  { id: "fade",         label: "Fade" },
  { id: "fly-in-left",  label: "Fly In L" },
  { id: "fly-in-right", label: "Fly In R" },
  { id: "none",         label: "Static" },
];

const FONT_FAMILIES = [
  "Inter", "Georgia", "Arial", "Verdana", "Times New Roman", "Trebuchet MS", "Impact",
];

// ── Shared style atoms ───────────────────────────────────────────────────────

const inputCls = "w-full bg-[#1a1a1e] border border-[rgba(255,255,255,0.12)] rounded-lg px-3 py-2 text-white text-sm placeholder-[#55555a] focus:outline-none focus:border-[#a78bfa]";
const labelCls = "block text-xs text-[#7b7b80] mb-1 font-medium";
const sectionCls = "bg-[#151518] border border-[rgba(255,255,255,0.06)] rounded-lg p-3 space-y-3";
const sectionTitle = "text-xs font-semibold text-[#7b7b80] uppercase tracking-widest";

// Shared narration ordering (Henry 2026-06-21): intro text → FIRST slide, content across the
// middle, contact + outro → LAST slide. Used by BOTH "AI Order" and "Caption + Narrate all"
// so the outro never lands at the top. Contact lives ONLY in the outro.
// Resize big photos IN THE BROWSER before upload so the payload is small (the cloudflared tunnel
// upload is slow — ~150KB/s; a 6.5MB photo took ~40s and would time out). Server still stores a
// clean JPEG. Falls back to the original on any failure (HEIC/odd formats). (Henry 2026-06-22)
async function downscaleForUpload(file: File): Promise<{ blob: Blob; name: string }> {
  if (!file.type.startsWith("image/") || file.size < 900_000) return { blob: file, name: file.name };
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new window.Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    const maxDim = 1920;
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || maxDim, img.naturalHeight || maxDim));
    const w = Math.max(1, Math.round((img.naturalWidth || maxDim) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || maxDim) * scale));
    const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) { URL.revokeObjectURL(url); return { blob: file, name: file.name }; }
    ctx.drawImage(img, 0, 0, w, h);
    URL.revokeObjectURL(url);
    const blob = await new Promise<Blob | null>(res => canvas.toBlob(res, "image/jpeg", 0.85));
    if (blob && blob.size > 1000 && blob.size < file.size) return { blob, name: file.name.replace(/\.[^.]+$/, "") + ".jpg" };
    return { blob: file, name: file.name };
  } catch { return { blob: file, name: file.name }; }
}

function buildOrderedNarration(opts: { content: string; introText: string; outroText: string; phone: string; whatsapp: string; website?: string; slideCount: number }): { fullNarration: string; lines: string[] } {
  const { content, introText, outroText, phone, whatsapp, website, slideCount: n } = opts;
  const contactParts: string[] = [];
  if (phone) contactParts.push(`Please contact us at ${phone}`);
  if (whatsapp) contactParts.push(`or WhatsApp ${whatsapp}`);
  if (website) contactParts.push(`or visit ${website}`);
  const contactLine = contactParts.join(" ");
  const builtIntro = (introText || "").trim();
  const builtOutro = [(outroText || "").trim(), contactLine].filter(Boolean).join(". ").replace(/\s+/g, " ").trim();
  const lines: string[] = Array.from({ length: n }, () => "");

  // Image↔narration MATCH (Henry 2026-06-22): if the AI returned per-slide [N] lines, assign them
  // 1:1 so each line describes ITS slide's image. Otherwise spread sentences evenly (fallback).
  const perSlide: Record<number, string> = {};
  let markerCount = 0;
  const markerRe = /\[(\d+)\]\s*([\s\S]*?)(?=\[\d+\]|$)/g;
  let mt: RegExpExecArray | null;
  while ((mt = markerRe.exec(content)) !== null) { const idx = parseInt(mt[1], 10) - 1; if (idx >= 0) { perSlide[idx] = (mt[2] || "").trim().replace(/\s+/g, " "); markerCount++; } }

  if (n > 0 && markerCount >= Math.max(2, Math.ceil(n / 2))) {
    for (let i = 0; i < n; i++) if (perSlide[i]) lines[i] = perSlide[i];
    if (builtIntro) lines[0] = [builtIntro, lines[0]].filter(Boolean).join(" ");
    if (builtOutro) lines[n - 1] = [lines[n - 1], builtOutro].filter(Boolean).join(" ");
  } else if (n > 0) {
    let firstIdx = 0, lastIdx = n - 1;
    if (builtIntro) { lines[0] = builtIntro; firstIdx = 1; }
    if (builtOutro && n >= 2) { lines[n - 1] = builtOutro; lastIdx = n - 2; }
    else if (builtOutro) { lines[0] = [lines[0], builtOutro].filter(Boolean).join(" "); }
    const contentSentences = content.split(/(?<=[.!?])\s+/).filter(Boolean);
    const slots = Math.max(1, lastIdx - firstIdx + 1);
    for (let i = 0; i < contentSentences.length; i++) {
      const slot = firstIdx + Math.min(slots - 1, Math.floor((i * slots) / Math.max(1, contentSentences.length)));
      lines[slot] = lines[slot] ? `${lines[slot]} ${contentSentences[i]}` : contentSentences[i];
    }
  }
  const fullNarration = lines.filter(Boolean).join(" ");
  return { fullNarration, lines };
}

// ── Project List ─────────────────────────────────────────────────────────────

function ProjectList({ onOpen, onNew }: { onOpen: (p: CommercialProject) => void; onNew: () => void }) {
  const [projects, setProjects] = useState<CommercialProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [duplicating, setDuplicating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  function reload() {
    fetch("/api/commercial/projects").then(r => r.json()).then(setProjects);
  }

  useEffect(() => {
    fetch("/api/commercial/projects")
      .then(r => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full">
      {/* Hero */}
      <HeroTitle kicker="Commercial Studio" title="Commercial" italic="Maker" sub="Create professional ad videos, product promos, and property showcases. Upload images, AI builds the slides, narration, music, and renders." />

      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-3">
          <button onClick={() => onNew()} className="px-5 py-2.5 bg-[#ff6b35] hover:bg-[#ff8555] text-white text-sm font-bold rounded-xl transition-all hover:-translate-y-0.5">
            New Slide Ad
          </button>
          <a href="/dashboard/commercial-planner" className="px-5 py-2.5 text-sm font-semibold rounded-xl transition-colors border border-[#2a2a40] text-[#6060a0] hover:text-white hover:border-[#7c5cfc]/50">
            Open Planner
          </a>
        </div>
        <p className="text-xs" style={{ color: "#5a7080" }}>{projects.length} project{projects.length !== 1 ? "s" : ""}</p>
      </div>

      {/* Sample strip */}
      <div className="flex gap-3 overflow-x-auto mb-8 pb-2">
        {[
          { src: "/api/media/intro/demo-commercial-oj.mp4", title: "Orange Juice Ad", type: "Product" },
          { src: "/api/media/intro/demo-property.mp4", title: "Property Showcase", type: "Real Estate" },
          { src: "/api/media/intro/demo-commercial.mp4", title: "Commercial Demo", type: "Brand" },
        ].map(v => (
          <div key={v.title} className="flex-shrink-0 rounded-xl overflow-hidden cursor-pointer relative" style={{ width: 180, border: "1px solid #1e2a35", background: "#0e1318" }}>
            <video src={v.src} muted loop className="w-full object-cover" style={{ height: 100 }}
              onMouseEnter={e => (e.target as HTMLVideoElement).play()}
              onMouseLeave={e => { const vid = e.target as HTMLVideoElement; vid.pause(); vid.currentTime = 0; }} />
            <span className="absolute top-2 left-2 text-[8px] font-semibold px-1.5 py-0.5 rounded-md" style={{ background: "rgba(255,107,53,0.85)", color: "#fff" }}>{v.type}</span>
            <div className="px-3 py-2">
              <p className="text-xs text-white font-semibold">{v.title}</p>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-[#5a7080] text-sm text-center py-12">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="rounded-2xl p-16 text-center" style={{ background: ds.color.card, border: `1px solid ${ds.color.line}` }}>
          <p className="text-white text-base font-semibold mb-2">No commercial projects yet</p>
          <p className="text-xs mb-6" style={{ color: "#5a7080" }}>Mode 1: Build slide-by-slide &middot; Mode 2: Upload footage, AI does the rest</p>
          <button onClick={onNew} className="px-6 py-3 bg-[#ff6b35] hover:bg-[#ff8555] text-white text-sm font-bold rounded-xl transition-colors">
            Create Your First Commercial
          </button>
        </div>
      ) : (
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {projects.map(p => {
            const ready = p.slides?.filter(s => s.status === "ready").length ?? 0;
            const total = p.slides?.length ?? 0;
            const progress = total > 0 ? Math.round((ready / total) * 100) : 0;
            const statusColor = p.renderStatus === "ready" ? "#22c55e" : p.renderStatus === "rendering" ? "#7c5cfc" : p.renderStatus === "failed" ? "#ef4444" : "#5a7080";
            return (
              <div key={p.id}
                onClick={() => onOpen(p)}
                className="relative rounded-2xl overflow-hidden cursor-pointer transition-all hover:-translate-y-1"
                style={{ background: "#0e1318", border: "1px solid #1e2a35" }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(255,107,53,0.4)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "#1e2a35"; }}>

                {/* Thumbnail area */}
                <div className="h-32 relative" style={{ background: `linear-gradient(135deg, #1a0a0066, #0e1318)` }}>
                  {p.slides?.[0]?.imagePath && (
                    <img src={`/api/media/${(p.slides[0].imagePath as string).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`}
                      alt="" className="absolute inset-0 w-full h-full object-cover opacity-50" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0e1318] via-transparent to-transparent" />

                  {/* Quick play button for ready videos */}
                  {p.renderStatus === "ready" && p.renderedVideoPath && (
                    <button
                      className="absolute inset-0 flex items-center justify-center z-10"
                      onClick={e => { e.stopPropagation(); setPlayingVideo(playingVideo === p.id ? null : p.id); }}>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                        style={{ background: "rgba(34,197,94,0.85)", boxShadow: "0 4px 20px rgba(34,197,94,0.4)" }}>
                        <span className="text-white text-lg ml-0.5">{playingVideo === p.id ? "⏸" : "▶"}</span>
                      </div>
                    </button>
                  )}

                  {/* Status badge */}
                  <span className="absolute top-3 right-3 text-[9px] font-semibold px-2 py-0.5 rounded-full z-20"
                    style={{ background: `${statusColor}20`, color: statusColor, border: `1px solid ${statusColor}30` }}>
                    {p.renderStatus === "ready" ? "Ready" : p.renderStatus === "rendering" ? "Rendering" : p.renderStatus === "failed" ? "Failed" : "Draft"}
                  </span>

                  {/* Slide count badge */}
                  <span className="absolute top-3 left-3 text-[9px] font-medium px-2 py-0.5 rounded-full z-20"
                    style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35" }}>
                    {total} slide{total !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Quick video player — expands when play is clicked */}
                {playingVideo === p.id && p.renderedVideoPath && (
                  <div className="px-3 pb-2" onClick={e => e.stopPropagation()}>
                    <video
                      src={`/api/media/${(p.renderedVideoPath as string).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`}
                      controls autoPlay className="w-full rounded-lg" style={{ maxHeight: 220, background: "#000" }}
                    />
                    <a href={`/api/media/${(p.renderedVideoPath as string).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`}
                      download={outputFileName(p.projectName, p.id)}
                      className="block mt-1.5 text-center text-[10px] font-semibold py-1.5 rounded-lg"
                      style={{ background: "rgba(34,197,94,0.15)", color: "#22c55e", border: "1px solid rgba(34,197,94,0.25)" }}>
                      ⬇ Download — {outputFileName(p.projectName, p.id)}
                    </a>
                  </div>
                )}

                {/* Info */}
                <div className="p-4">
                  <p className="text-white font-bold text-sm mb-0.5">{p.projectName}</p>
                  <p className="text-[9px] mb-0.5 font-mono" style={{ color: "#5a7080" }} title="Project number — use this to look up the video">#{projNumber(p.id)}</p>
                  <p className="text-[10px] mb-1" style={{ color: "#5a7080" }}>{p.aspectRatio} &middot; {ready}/{total} ready</p>
                  <p className="text-[9px] mb-3" style={{ color: "#3d5060" }}>
                    {p.createdAt ? new Date(p.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" }) : ""}
                  </p>

                  {/* Progress bar */}
                  {total > 0 && (
                    <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: "#1e2a35" }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: statusColor }} />
                    </div>
                  )}

                  <div className="flex gap-2">
                    <button className="flex-1 text-[10px] font-semibold py-1.5 rounded-lg transition-colors"
                      style={{ background: "rgba(255,107,53,0.1)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.2)" }}>
                      Open
                    </button>
                    <button
                      title="Duplicate"
                      disabled={duplicating === p.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setDuplicating(p.id);
                        try {
                          const res = await fetch(`/api/commercial/projects/${p.id}/duplicate`, { method: "POST" });
                          if (res.ok) reload();
                        } finally { setDuplicating(null); }
                      }}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ border: "1px solid #1e2a35", color: "#5a7080" }}>
                      {duplicating === p.id ? "..." : "Copy"}
                    </button>
                    <button
                      title="Delete project"
                      disabled={deleting === p.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (!confirm(`Delete "${p.projectName}"?`)) return;
                        setDeleting(p.id);
                        try {
                          await fetch(`/api/commercial/projects/${p.id}`, { method: "DELETE" });
                          reload();
                        } finally { setDeleting(null); }
                      }}
                      className="text-[10px] px-2.5 py-1.5 rounded-lg transition-colors"
                      style={{ border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444" }}>
                      {deleting === p.id ? "..." : "Del"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── New Project Form ──────────────────────────────────────────────────────────

function NewProjectForm({ onCreated, onCancel }: { onCreated: (p: CommercialProject) => void; onCancel: () => void }) {
  const [projectName, setProjectName] = useState("");
  const [aspectRatio, setAspectRatio] = useState<"9:16" | "16:9" | "1:1">("9:16");
  const [brandName, setBrandName]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState("");

  async function handleCreate() {
    if (!projectName.trim()) { setError("Project name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/commercial/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: projectName.trim(), aspectRatio, brandName: brandName.trim() || undefined }),
      });
      if (!res.ok) { setError("Failed to create project"); return; }
      const project: CommercialProject = await res.json();
      project.slides = [];
      onCreated(project);
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onCancel} className="text-[#6060a0] hover:text-white transition-colors text-sm">Back</button>
        <h2 className="text-xl font-bold text-white">New Slide Ad Project</h2>
      </div>
      <div className={`${sectionCls}`}>
        <div>
          <label className={labelCls}>Project name *</label>
          <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. City Property Promo April" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Brand / business name</label>
          <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. GioHomeStudio" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Output format</label>
          <div className="flex gap-2">
            {(["9:16", "16:9", "1:1"] as const).map(ar => (
              <button key={ar} type="button" onClick={() => setAspectRatio(ar)} className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
                aspectRatio === ar ? "bg-[#7c5cfc]/20 border-[#7c5cfc] text-[#b090ff]" : "bg-[#0d0d1a] border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
              }`}>
                <span className="block">{ar}</span>
                <span className="text-[10px] opacity-70 font-normal">{ASPECT_DIMS[ar].label}</span>
              </button>
            ))}
          </div>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button onClick={handleCreate} disabled={saving} className="w-full py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] disabled:bg-[#2a2a40] disabled:text-[#6060a0] text-white text-sm font-semibold rounded-xl transition-colors">
          {saving ? "Creating..." : "Create Project"}
        </button>
      </div>
    </div>
  );
}

// ── Mode 2: AI Ad Builder ─────────────────────────────────────────────────────

const WIZARD_STEPS = ["upload", "form", "script", "render"] as const;
type WizardStep = typeof WIZARD_STEPS[number];

const PRODUCT_TYPES = ["Software / App","Food & Beverage","Real Estate","Fashion & Clothing",
  "Tech / Electronics","Health & Beauty","Auto / Vehicles","Education","Finance / Insurance",
  "Services","Events / Entertainment","Other"];

function AiAdBuilder({ onBack, onOpenProject }: { onBack: () => void; onOpenProject: (p: CommercialProject) => void }) {
  const [step, setStep]             = useState<WizardStep>("upload");
  const [uploading, setUploading]   = useState(false);
  const [analyzing, setAnalyzing]   = useState(false);
  const [building, setBuilding]     = useState(false);
  const [createdProjId, setCreatedProjId] = useState<string | null>(null);
  const [savedFiles, setSavedFiles] = useState<{ name: string; type: string; path: string }[]>([]);
  const [analysis, setAnalysis]     = useState<Record<string, unknown> | null>(null);
  const [warn, setWarn]             = useState("");
  const [script, setScript]         = useState("");
  const [aiModel, setAiModel]       = useState("auto");  // C1: selectable AI model for script generation
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    productType: "", productName: "", features: "", offer: "", price: "",
    website: "", companyName: "", contact: "", contactMethod: "whatsapp",
    tone: "Professional" as "Luxury" | "Professional" | "Energetic" | "Friendly" | "Urgent",
    duration: "30",  // seconds — preset buttons OR any custom value
  });

  function setF(key: string, val: string) { setForm(prev => ({ ...prev, [key]: val })); }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setAnalyzing(true);
    setWarn("");

    try {
      const createRes = await fetch("/api/commercial/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: `AI Ad ${new Date().toLocaleDateString()}`, aspectRatio: "9:16" }),
      });
      if (!createRes.ok) { setWarn("Failed to create project"); return; }
      const proj = await createRes.json() as { id: string };
      setCreatedProjId(proj.id);

      // Upload images ONE AT A TIME (in selection order) so many/large files don't exceed the
      // request body limit — the old single multi-file POST 500'd at 4+ images.
      const fileArr = Array.from(files);
      const collected: typeof savedFiles = [];
      let lastErr = "";
      for (let i = 0; i < fileArr.length; i++) {
        setWarn(`Uploading image ${i + 1} of ${fileArr.length}…`);
        const up = await downscaleForUpload(fileArr[i]);  // shrink in-browser → fast/reliable upload (slow tunnel)
        const fd = new FormData();
        fd.append("files", up.blob, up.name);
        fd.append("saveOnly", "true");
        try {
          const r = await fetch(`/api/commercial/projects/${proj.id}/mode2/analyze`, { method: "POST", body: fd });
          if (!r.ok) {
            const body = await r.text().catch(() => "");
            lastErr = `HTTP ${r.status}${r.status === 401 ? " — session expired, reload & re-enter access code" : r.status === 413 ? " — file too large for the gateway" : ""}${body ? " · " + body.replace(/<[^>]+>/g, " ").trim().slice(0, 120) : ""}`;
            continue;
          }
          const d = await r.json().catch(() => ({})) as { savedFiles?: typeof savedFiles };
          if (d.savedFiles?.length) collected.push(...d.savedFiles);
          else lastErr = "server returned no savedFiles";
        } catch (e) {
          lastErr = `network — ${e instanceof Error ? e.message : String(e)}`;
        }
      }
      setSavedFiles(collected);
      if (collected.length === 0) {
        const f0 = fileArr[0];
        setWarn(`Upload failed — ${lastErr || "unknown"}. (1st file: ${f0?.name ?? "?"}, ${Math.round((f0?.size || 0) / 1024)}KB.) Hard-refresh (Ctrl+Shift+R) or try fewer/smaller images.`);
        return;
      }

      // One cheap analysis pass over the file NAMES only (no image bytes).
      setWarn("Analysing…");
      const res  = await fetch(`/api/commercial/projects/${proj.id}/mode2/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileNames: collected.map(s => s.name) }),
      });
      const data = await safeJson<{ analysis?: Record<string, unknown>; warning?: string }>(res, "commercial-mode2-analyze");

      if (data.analysis) {
        setAnalysis(data.analysis);
        if (data.analysis.productType) setF("productType", data.analysis.productType as string);
        if (data.analysis.productName) setF("productName", data.analysis.productName as string);
        if (data.analysis.features)    setF("features", (data.analysis.features as string[]).join(", "));
        if (data.analysis.adTone)      setF("tone", data.analysis.adTone as typeof form.tone);
      }
      setWarn(data.warning ?? "");
      setStep("form");
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[mode2-analyze] upload/parse error:", reason);
      setWarn(`Upload failed: ${reason}`);
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  }

  async function handleGenerateScript() {
    if (!form.companyName.trim()) { setWarn("Company name is required"); return; }
    setGenerating(true);
    setWarn("");
    try {
      const res  = await fetch(`/api/commercial/projects/${createdProjId}/mode2/generate-script`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, model: aiModel }),
      });
      const data = await safeJson<{ script?: string; error?: string }>(res, "commercial-mode2-generate-script");
      if (res.ok) {
        setScript(data.script ?? "");
        setStep("script");
      } else {
        setWarn(data.error ?? "Script generation failed");
      }
    } catch {
      setWarn("Network error");
    } finally {
      setGenerating(false);
    }
  }

  async function handleBuildAd() {
    if (!createdProjId) { setWarn("Project ID missing. Please restart the flow."); return; }
    setBuilding(true);
    setWarn("");
    try {
      const res  = await fetch(`/api/commercial/projects/${createdProjId}/mode2/build-slides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filePaths: savedFiles.map(f => f.path), script, productName: form.productName, productType: form.productType }),
      });
      type BuildResult = CommercialProject & { slides: CommercialSlide[]; error?: string };
      // safeJson throws on !res.ok, so data here is always a success payload
      const data = await safeJson<BuildResult>(res, "commercial-mode2-build-slides");
      onOpenProject(data);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[mode2-build-slides] error:", reason);
      setWarn(`Build failed: ${reason}`);
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="w-full">
      {/* Hero */}
      <div className="relative rounded-2xl overflow-hidden mb-6" style={{ minHeight: 160, background: "linear-gradient(135deg, rgba(168,85,247,0.08), rgba(8,11,16,0.95))" }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at top right, rgba(168,85,247,0.12), transparent 60%)" }} />
        <div className="relative p-8 flex items-center justify-between">
          <div>
            <button onClick={onBack} className="text-[#5a7080] hover:text-white transition-colors text-xs mb-3 block">← Back to projects</button>
            <div className="flex items-center gap-3 mb-2">
              <span style={{ fontSize: 12, fontFamily: "monospace", color: ds.color.lilac }}>AI</span>
              <div>
                <h2 className="text-2xl font-extrabold text-white" style={{ letterSpacing: "-0.5px" }}>AI Ad Creator</h2>
                <p className="text-xs" style={{ color: "#a855f7" }}>Powered by multi-AI intelligence</p>
              </div>
            </div>
            <p className="text-xs mt-2" style={{ color: "#5a7080", maxWidth: 400, lineHeight: 1.6 }}>
              Upload your product images → AI analyses them → generates voiceover script → builds slides → ready to render. All automatic.
            </p>
          </div>
          <div className="hidden md:flex flex-col gap-2">
            {["Upload", "AI Analysis", "Script", "Build"].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                  style={{ background: WIZARD_STEPS.indexOf(step) >= i ? "rgba(168,85,247,0.2)" : "#1e2a35", color: WIZARD_STEPS.indexOf(step) >= i ? "#a855f7" : "#3d5060", border: `1px solid ${WIZARD_STEPS.indexOf(step) >= i ? "rgba(168,85,247,0.3)" : "#1e2a35"}` }}>
                  {i + 1}
                </div>
                <span className="text-[10px]" style={{ color: WIZARD_STEPS.indexOf(step) >= i ? "#a855f7" : "#3d5060" }}>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile step bar */}
      <div className="flex gap-2 mb-6 md:hidden">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className={`flex-1 h-1.5 rounded-full ${step === s ? "bg-[#a855f7]" : i < WIZARD_STEPS.indexOf(step) ? "bg-[#a855f7]/40" : "bg-[#1e2a35]"}`} />
        ))}
      </div>

      {/* Step indicator */}
      <div className="flex gap-2 mb-6">
        {WIZARD_STEPS.map((s, i) => (
          <div key={s} className={`flex-1 h-1 rounded-full ${step === s ? "bg-[#7c5cfc]" : i < WIZARD_STEPS.indexOf(step) ? "bg-[#7c5cfc]/40" : "bg-[#2a2a40]"}`} />
        ))}
      </div>

      {warn && (
        <div className="mb-4 px-3 py-2 bg-yellow-950/30 border border-yellow-800/40 rounded-lg text-xs text-yellow-400 flex items-center justify-between gap-2">
          <span>{warn}</span>
          <button onClick={() => setWarn("")} className="text-[#6060a0] hover:text-white shrink-0">✕</button>
        </div>
      )}

      {step === "upload" && (
        <div className={sectionCls}>
          <p className={sectionTitle}>Step 1 — Upload product images</p>
          <p className="text-xs text-[#6060a0]">Upload product or promo images (JPG, PNG, WEBP). AI will analyse them and pre-fill the details form. Works for any product or service.</p>
          <div
            className="border-2 border-dashed border-[#2a2a40] hover:border-[#7c5cfc]/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading || analyzing ? (
              <p className="text-[#6060a0] text-sm">{analyzing ? "Analysing with AI…" : "Uploading…"}</p>
            ) : (
              <>
                <p className="text-3xl mb-2">️</p>
                <p className="text-white text-sm font-medium">Click to upload product images</p>
                <p className="text-xs text-[#6060a0] mt-1">JPG · PNG · WEBP — multiple files supported</p>
              </>
            )}
          </div>
          <input ref={fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime" className="hidden" onChange={e => { handleUpload(e.target.files); e.target.value = ""; }} />
        </div>
      )}

      {step === "form" && (
        <div className="space-y-4">
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitle}>Step 2 — Product / ad details</p>
              {analysis && <span className="text-[10px] text-[#7c5cfc] font-medium">AI pre-filled ✅</span>}
            </div>
            <p className="text-xs text-[#6060a0]">️ {savedFiles.length} image{savedFiles.length !== 1 ? "s" : ""} uploaded ✅ — correct any details below.</p>
            {savedFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap my-1">
                {savedFiles.filter(f => f.type === "image").map((f, i) => (
                  <img key={i} src={`/api/media/file?path=${encodeURIComponent(f.path)}`} alt={f.name} title={f.name} className="w-16 h-16 object-cover rounded-lg border border-[#2a2a40]" />
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Product / service type</label>
                <select value={form.productType} onChange={e => setF("productType", e.target.value)} className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                  <option value="">Select…</option>
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Ad tone</label>
                <select value={form.tone} onChange={e => setF("tone", e.target.value)} className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                  {["Luxury","Professional","Energetic","Friendly","Urgent"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>Product / service name</label>
              <input type="text" value={form.productName} onChange={e => setF("productName", e.target.value)} placeholder="e.g. GioStudio Pro · Chef's Special · 3BR Apartment" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>⭐ Key features / benefits</label>
              <textarea
                value={form.features}
                onChange={e => setF("features", e.target.value)}
                rows={3}
                placeholder={"Fast delivery\n✅ 30-day free trial\nNo hidden fees"}
                className={inputCls}
                style={{ resize: "vertical" }}
              />
              <p className="text-[10px] text-[#404060] mt-1">One per line or comma-separated — both work</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Price (optional)</label>
                <input type="text" value={form.price} onChange={e => setF("price", e.target.value)} placeholder="e.g. ₦5,000 / $29/mo" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Special offer (optional)</label>
                <input type="text" value={form.offer} onChange={e => setF("offer", e.target.value)} placeholder="e.g. 50% off this week!" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Website (optional)</label>
              <input type="text" value={form.website} onChange={e => setF("website", e.target.value)} placeholder="e.g. giostudio.com" className={inputCls} />
            </div>
          </div>

          <div className={sectionCls}>
            <p className={sectionTitle}>️ Brand & contact</p>
            <div>
              <label className={labelCls}>Company / brand name *</label>
              <input type="text" value={form.companyName} onChange={e => setF("companyName", e.target.value)} placeholder="e.g. ️ GioHomeStudio" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contact via</label>
                <select value={form.contactMethod} onChange={e => setF("contactMethod", e.target.value)} className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                  {["whatsapp","call","telegram","email","website","DM"].map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Contact detail</label>
                <input type="text" value={form.contact} onChange={e => setF("contact", e.target.value)} placeholder="+234 xxx / @handle / link" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>⏱️ Ad duration</label>
              <div className="flex gap-2">
                {(["15", "30", "60", "90"] as const).map(d => (
                  <button key={d} onClick={() => setF("duration", d)} className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.duration === d ? "bg-[#7c5cfc]/20 border-[#7c5cfc] text-[#b090ff]" : "bg-[#0d0d1a] border-[#2a2a40] text-[#6060a0]"}`}>
                    {d}s
                  </button>
                ))}
              </div>
              <div className="flex gap-2 items-center mt-2">
                <input type="number" min={3} max={600} value={form.duration} onChange={e => setF("duration", e.target.value)} placeholder="custom" className="w-28 bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#7c5cfc]" />
                <span className="text-[10px] text-[#6060a0]">— or type any number of seconds</span>
              </div>
            </div>
          </div>

          <button onClick={handleGenerateScript} disabled={generating} className="w-full py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] disabled:bg-[#2a2a40] disabled:text-[#6060a0] text-white text-sm font-semibold rounded-xl transition-colors">
            {generating ? "Generating script with AI…" : "Generate voiceover script →"}
          </button>
        </div>
      )}

      {step === "script" && (
        <div className="space-y-4">
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitle}>Step 3 — Review voiceover script</p>
              <button onClick={() => setStep("form")} className="text-xs text-[#6060a0] hover:text-white transition-colors">← Edit details</button>
            </div>
            <p className="text-xs text-[#6060a0]">✏️ Edit the script before building. This will be spoken by AI voiceover on the final video.</p>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              rows={8}
              className={`${inputCls} resize-vertical font-sans`}
              placeholder="Voiceover script will appear here…"
            />
            {/* C1: selectable AI model for the script */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#6060a0]">AI model:</span>
              <select value={aiModel} onChange={e => setAiModel(e.target.value)}
                className="flex-1 bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-2 py-1 text-white text-[11px] focus:outline-none focus:border-[#7c5cfc]">
                <option value="auto">Auto — best available</option>
                <option value="claude:claude-haiku-4-5-20251001">Claude Haiku — fast/cheap</option>
                <option value="claude:claude-sonnet-4-6">Claude Sonnet — quality</option>
                <option value="openai:gpt-4o-mini">GPT-4o mini — cheap</option>
                <option value="ollama">Local (Ollama) — free</option>
              </select>
            </div>
            {/* A9: one-tap punch-up — rewrite with strong action verbs (like children/hybrid) */}
            <div className="flex gap-1.5 flex-wrap">
              {[
                { label: "✨ Interesting", style: "more interesting and curiosity-driving — open with a scroll-stopping hook" },
                { label: "🔥 Intense",     style: "more intense and high-energy — bold, urgent, powerful" },
                { label: "💎 Promising",   style: "more promising — paint the dream outcome and benefits vividly" },
                { label: "🤩 Wow",         style: "more wow and jaw-dropping — surprising, exciting, unforgettable" },
              ].map(b => (
                <button key={b.label} disabled={generating || !script.trim()}
                  onClick={async () => {
                    setGenerating(true);
                    try {
                      const res = await fetch(`/api/commercial/projects/${createdProjId}/mode2/generate-script`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ ...form, style: b.style, baseScript: script, model: aiModel }),
                      });
                      const data = await safeJson<{ script?: string; error?: string }>(res, "commercial-mode2-enhance-script");
                      if (res.ok && data.script) setScript(data.script);
                      else setWarn(data.error ?? "Enhance failed");
                    } catch (err) { setWarn(err instanceof Error ? err.message : "Network error"); }
                    finally { setGenerating(false); }
                  }}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/30 disabled:opacity-40 transition-colors">
                  {b.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setGenerating(true);
                  try {
                    const res = await fetch(`/api/commercial/projects/${createdProjId}/mode2/generate-script`, {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ ...form, model: aiModel }),
                    });
                    const data = await safeJson<{ script?: string; error?: string }>(res, "commercial-mode2-regen-script");
                    if (res.ok) setScript(data.script ?? "");
                    else setWarn(data.error ?? "Script regeneration failed");
                  } catch (err) {
                    setWarn(err instanceof Error ? err.message : "Network error regenerating script");
                  } finally {
                    setGenerating(false);
                  }
                }}
                disabled={generating}
                className="flex-1 py-2 bg-[#1a1a2e] border border-[#2a2a40] hover:border-[#7c5cfc]/50 text-[#6060a0] hover:text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {generating ? "⏳ Regenerating…" : "↻ Regenerate"}
              </button>
              <button
                onClick={() => setStep("render")}
                className="flex-1 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-xs font-semibold rounded-lg transition-colors"
              >
                ✅ Confirm script →
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "render" && (
        <div className={sectionCls}>
          <p className={sectionTitle}>Step 4 — Build the ad</p>
          <div className="text-center py-6 space-y-3">
            <p className="text-4xl"></p>
            <p className="text-white font-medium text-sm">Ready to build your ad!</p>
            <p className="text-xs text-[#6060a0]">
              {savedFiles.length} image{savedFiles.length !== 1 ? "s" : ""} · {script.split(" ").length} words · {form.duration}s target
            </p>
            <div className="bg-[#0d0d1a] border border-[#2a2a40] rounded-lg p-3 text-left text-xs text-[#9090c0] leading-relaxed max-h-32 overflow-y-auto">
              {script}
            </div>
            <p className="text-xs text-[#5050b0]">
              ️ One slide per image · script attached · add captions · then hit Render — your ad is live!
            </p>
            <button
              onClick={handleBuildAd}
              disabled={building}
              className="w-full py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] disabled:bg-[#2a2a40] disabled:text-[#6060a0] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {building ? "⏳ Building slides…" : "Build AI Ad →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Commercial Editor (Mode 1) ────────────────────────────────────────────────

function CommercialEditor({ initialProject, onBack, initialCharacterId }: { initialProject: CommercialProject; onBack: () => void; initialCharacterId?: string }) {
  const { requireGate, GateModal } = useGate();
  const [project, setProject]     = useState<CommercialProject>(initialProject);
  const [selectedId, setSelectedId] = useState<string | null>(project.slides[0]?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [batchImporting, setBatchImporting] = useState(false);
  const [aiImageLoading, setAiImageLoading] = useState(false);
  const [aiReview, setAiReview] = useState<{ review: string; provider?: string } | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [captionLoading, setCaptionLoading] = useState(false);
  const [captioningAll, setCaptioningAll] = useState(false);  // one-button: caption every image + narrate all
  // Card inputs persisted on the project (Henry 2026-06-22: stay static across refresh)
  const [titleCardText, setTitleCardText] = useState((initialProject as { titleCardText?: string }).titleCardText ?? "");
  const [titleCardSub, setTitleCardSub] = useState((initialProject as { titleCardSub?: string }).titleCardSub ?? "");
  const [outroCardText, setOutroCardText] = useState((initialProject as { outroCardText?: string }).outroCardText ?? "");
  const [introWebsite, setIntroWebsite] = useState((initialProject as { introWebsite?: string }).introWebsite ?? "");
  const [editScript, setEditScript] = useState<string | null>(null);  // editable narration script (null = synced from slides)
  const [generatingTitleCard, setGeneratingTitleCard] = useState<"intro" | "outro" | null>(null);
  const [importKind, setImportKind] = useState<"intro" | "outro" | null>(null);
  const cardImportRef = useRef<HTMLInputElement>(null);
  const [cardTheme, setCardTheme] = useState(0);  // index into CARD_THEMES (0 = AI auto)
  const [cardFont, setCardFont] = useState("");   // intro/outro card font ("" = bold default)
  const [cardStyle, setCardStyle] = useState<"card" | "on_image" | "ai_banner">("card");  // 3 intro/outro looks
  const [assetPickerOpen, setAssetPickerOpen] = useState<"image" | "music" | null>(null);
  const [renderMsg, setRenderMsg] = useState("");
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [enhancingNarration, setEnhancingNarration] = useState(false);
  const [narrationEnhanceError, setNarrationEnhanceError] = useState<string | null>(null);

  // ── Intro / Outro contact fields (AI Order) ──────────────────────────────
  // Init from the saved project so they survive refresh (persisted via patchProject onBlur) — Henry 2026-06-21.
  const [introPhone, setIntroPhone]       = useState((initialProject as { introPhone?: string }).introPhone ?? "");
  const [introWhatsapp, setIntroWhatsapp] = useState((initialProject as { introWhatsapp?: string }).introWhatsapp ?? "");
  const [introText, setIntroText]         = useState((initialProject as { introText?: string }).introText ?? "");
  const [outroText, setOutroText]         = useState((initialProject as { outroText?: string }).outroText ?? "");
  const [productInfo, setProductInfo]     = useState((initialProject as { productInfo?: string }).productInfo ?? "");  // name / type / specs / location — AI Order uses this over image guesses
  const [aiOrdering, setAiOrdering]       = useState(false);

  // Piper TTS voice selection
  const piperVoices = [
    { id: "en_US-lessac-medium",   name: "Lessac (US Female)" },
    { id: "en_US-amy-medium",      name: "Amy (US Female, Warm)" },
    { id: "en_US-ryan-medium",     name: "Ryan (US Male, Clear)" },
    { id: "en_US-arctic-medium",   name: "Arctic (US Male, Deep)" },
    { id: "en_GB-alan-medium",     name: "Alan (British Male)" },
    { id: "en_GB-alba-medium",     name: "Alba (British Female)" },
  ];
  const [selectedPiperVoice, setSelectedPiperVoice] = useState("en_US-lessac-medium");
  const EDGE_VOICES = [
    { id: "en-US-AriaNeural",   name: "Aria (US Female)" },
    { id: "en-US-GuyNeural",    name: "Guy (US Male)" },
    { id: "en-US-JennyNeural",  name: "Jenny (US Female)" },
    { id: "en-GB-RyanNeural",   name: "Ryan (UK Male)" },
    { id: "en-GB-SoniaNeural",  name: "Sonia (UK Female)" },
    { id: "en-NG-AbeoNeural",   name: "Abeo (Nigerian Male)" },
    { id: "en-NG-EzinneNeural", name: "Ezinne (Nigerian Female)" },
  ];
  const [voiceEngine, setVoiceEngine] = useState<"auto" | "piper" | "edge" | "elevenlabs">("auto");
  const [selectedEdgeVoice, setSelectedEdgeVoice] = useState("en-US-AriaNeural");
  const [piperDemoLoading, setPiperDemoLoading] = useState(false);
  const [piperDemoUrl, setPiperDemoUrl] = useState<string | null>(null);
  const [elevenVoices, setElevenVoices] = useState<Array<{ id: string; name: string; accent?: string; category?: string }>>([]);
  useEffect(() => {
    fetch("/api/voices").then(r => r.json()).then(d => { if (Array.isArray(d?.voices)) setElevenVoices(d.voices); }).catch(() => {});
  }, []);
  const [narrationSettings, setNarrationSettings] = useState<NarrationSettings>(DEFAULT_NARRATION_SETTINGS);
  const [narrationText, setNarrationText] = useState("");
  const [narrationControlsSettings, setNarrationControlsSettings] = useState<NarrationControlsSettings>({ mode: "commercial" } as NarrationControlsSettings);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [layerizeResult, setLayerizeResult] = useState<LayerizeResult | null>(null);
  const [orderSuggestion, setOrderSuggestion] = useState<{ ids: string[]; reasoning: string } | null>(null);
  const [suggestingOrder, setSuggestingOrder] = useState(false);
  const [showSmartPro, setShowSmartPro] = useState(false);
  const [llmReady, setLlmReady]   = useState<boolean | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const dragStateRef = useRef<{ startX: number; startW: number } | null>(null);
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef       = useRef<HTMLInputElement>(null);
  const swipeRef      = useRef<number | null>(null);
  const batchImportRef = useRef<HTMLInputElement>(null);
  const introOutroRef = useRef<HTMLDivElement>(null);
  const musicFileRef  = useRef<HTMLInputElement>(null);
  const [mergedVideoPath, setMergedVideoPath] = useState<string | null>(null);
  const [musicUploading, setMusicUploading] = useState(false);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [musicLibrary, setMusicLibrary] = useState<{ filename: string; label: string; mood: string }[]>([]);
  const [musicPreview, setMusicPreview] = useState<string | null>(null);  // filename being previewed
  const [musicLibraryLoading, setMusicLibraryLoading] = useState(false);
  const [musicDownloadQuery, setMusicDownloadQuery] = useState("");
  const [musicDownloading, setMusicDownloading] = useState(false);
  const [polishState, setPolishState] = useState<{ slideId: string; field: "caption" | "narration"; polished: string; loading: boolean; error?: string } | null>(null);
  const [translateState, setTranslateState] = useState<{ slideId: string; field: "caption" | "narration"; translated: string; loading: boolean; lang: string } | null>(null);
  const [translateLang, setTranslateLang] = useState("fr");
  const [readImageState, setReadImageState] = useState<{ slideId: string; caption: string; narration: string; loading: boolean; error?: string; details?: string[] } | null>(null);
  const [showCharacterPicker, setShowCharacterPicker] = useState(false);
  const [assignedCharacter, setAssignedCharacter] = useState<{ id: string; characterId: string | null; name: string; gender: string | null; age: string | null; country: string | null; culture: string | null; imageUrl: string | null; visualDescription: string | null; voiceId: string | null; voiceName: string | null; voiceProvider: string | null; defaultSpeechStyle: string | null; role: string | null; personality: string | null } | null>(null);
  // ── SD: Model settings ────────────────────────────────────────────────────
  const [soundTier, setSoundTier] = useState<SoundTierCommId>("piper_free");
  const [modelSettings, setModelSettings] = useState({
    storyLLM:        "claude-haiku-4-5",
    charImageModel:  "fal_flux_schnell",
    sceneVideoModel: "kling_1_6_standard",
    soundModel:      "piper_free" as SoundTierCommId,
  });
  const [showModelSettings, setShowModelSettings] = useState(false);

  // Handle characterId passed from character-voices page
  useEffect(() => {
    if (!initialCharacterId) return;
    fetch("/api/character-voices").then(r => r.json()).then(d => {
      const char = (d.voices || []).find((v: { id: string }) => v.id === initialCharacterId);
      if (char) {
        setAssignedCharacter({
          id: char.id, characterId: char.characterId || null, name: char.name,
          gender: char.gender || null, age: char.age || null, country: char.country || null,
          culture: char.culture || null, imageUrl: char.imageUrl || null,
          visualDescription: char.visualDescription || null,
          voiceId: char.voiceId || null, voiceName: char.voiceName || null,
          voiceProvider: null, defaultSpeechStyle: char.defaultSpeechStyle || null,
          role: char.role || null, personality: char.personality || null,
        });
        // If the character has a voice, set it on the project
        if (char.voiceId) {
          setProject(prev => ({ ...prev, voiceId: char.voiceId, voiceLanguage: char.language || prev.voiceLanguage }));
        }
      }
    }).catch(() => {});
  }, [initialCharacterId]);

  useEffect(() => {
    fetch("/api/llm/status")
      .then(r => r.json())
      .then(d => {
        // Any configured provider (including Ollama) means AI features are available.
        const anyReady = d.providers?.claude  === "configured"
          || d.providers?.openai === "configured"
          || d.providers?.grok   === "configured"
          || d.providers?.ollama === "configured";
        setLlmReady(anyReady);
      })
      .catch(() => setLlmReady(false));
  }, []);

  const renderStatus = project.renderStatus === "rendering" ? "rendering"
    : project.renderStatus === "ready"  ? "done"
    : project.renderStatus === "failed" ? "failed"
    : "idle";

  const selectedSlide = project.slides.find(s => s.id === selectedId) ?? null;

  const narrationScriptLines = useMemo(() =>
    project.slides
      .map((s, i) => s.narrationLine?.trim() ? `[Slide ${i + 1}] ${s.narrationLine.trim()}` : null)
      .filter(Boolean) as string[],
    [project.slides]
  );

  // ── Slide list helpers ──────────────────────────────────────────────────
  async function addSlide() {
    const res = await fetch(`/api/commercial/projects/${project.id}/slides`, { method: "POST" });
    if (!res.ok) return;
    const slide: CommercialSlide = await res.json();
    setProject(prev => ({ ...prev, slides: [...prev.slides, slide] }));
    setSelectedId(slide.id);
  }

  // Batch import: one slide per image, InVideo-style.
  // Uses the batch endpoint (?batch=N) to create all slides in one atomic DB transaction,
  // eliminating N sequential round-trips and avoiding slideOrder race conditions.
  async function handleBatchImport(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBatchImporting(true);
    setUploadError("");

    const fileArr = Array.from(files);

    // Create all slides in one request; server assigns sequential slideOrder atomically
    const batchRes = await fetch(
      `/api/commercial/projects/${project.id}/slides?batch=${fileArr.length}`,
      { method: "POST" }
    );
    if (!batchRes.ok) { setBatchImporting(false); return; }
    const createdSlides: CommercialSlide[] = await batchRes.json();

    // Pair each slide with its corresponding file by index (safe — lengths always match here)
    const pairs = createdSlides.map((slide, i) => ({ slide, file: fileArr[i] }));

    if (pairs.length === 0) { setBatchImporting(false); return; }

    // Add all empty slides in one state update
    setProject(prev => ({ ...prev, slides: [...prev.slides, ...pairs.map(p => p.slide)] }));
    setSelectedId(pairs[0].slide.id);

    // Upload images in parallel — use allSettled so one failure doesn't abort the rest
    const settled = await Promise.allSettled(
      pairs.map(async ({ slide, file }) => {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(`/api/commercial/projects/${project.id}/slides/${slide.id}/image`, { method: "POST", body: fd });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${file.name}`);
        return { slideId: slide.id, ...(await res.json() as { imagePath: string; imageFileName: string }) };
      })
    );

    // Surface any per-file failures without hiding the successful ones
    const failed = settled
      .map((r, i) => r.status === "rejected" ? `${pairs[i].file.name}: ${r.reason instanceof Error ? r.reason.message : String(r.reason)}` : null)
      .filter(Boolean) as string[];
    if (failed.length > 0) {
      console.error("[batch-import] upload failures:", failed);
      setUploadError(`${failed.length} file(s) failed to upload: ${failed.join("; ")}`);
    }

    const uploadResults = settled
      .map(r => r.status === "fulfilled" ? r.value : null);

    // Apply all upload results in one state update
    const updates = new Map(uploadResults.filter(Boolean).map(r => [r!.slideId, r!]));
    if (updates.size > 0) {
      setProject(prev => ({
        ...prev,
        slides: prev.slides.map(s => {
          const u = updates.get(s.id);
          return u ? { ...s, imagePath: u.imagePath, imageFileName: u.imageFileName, status: "ready" } : s;
        }),
      }));
    }

    setBatchImporting(false);
  }

  async function deleteSlide(slideId: string) {
    const res = await fetch(`/api/commercial/projects/${project.id}/slides/${slideId}`, { method: "DELETE" });
    if (!res.ok) return;
    const remaining = project.slides.filter(s => s.id !== slideId).map((s, i) => ({ ...s, slideOrder: i + 1 }));
    setProject(prev => ({ ...prev, slides: remaining }));
    setSelectedId(remaining[0]?.id ?? null);
  }

  // ── Drag-and-drop reorder ───────────────────────────────────────────────
  function handleDragStart(slideId: string) {
    setDraggedId(slideId);
  }

  function handleDragOver(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggedId || draggedId === targetId) return;

    const from = project.slides.findIndex(s => s.id === draggedId);
    const to   = project.slides.findIndex(s => s.id === targetId);
    if (from === -1 || to === -1) return;

    const reordered = [...project.slides];
    const [moved]   = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    setProject(prev => ({ ...prev, slides: reordered.map((s, i) => ({ ...s, slideOrder: i + 1 })) }));
  }

  async function handleDrop() {
    if (!draggedId) return;
    setDraggedId(null);
    const res = await fetch(`/api/commercial/projects/${project.id}/slides/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: project.slides.map(s => s.id) }),
    });
    if (!res.ok) console.error("[commercial] reorder failed", res.status);
  }

  // ── AI slide order suggestion ───────────────────────────────────────────
  async function suggestOrder() {
    setSuggestingOrder(true);
    setOrderSuggestion(null);
    try {
      const res  = await fetch(`/api/commercial/projects/${project.id}/suggest-order`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setOrderSuggestion({ ids: data.suggestedOrder, reasoning: data.reasoning });
      }
    } finally {
      setSuggestingOrder(false);
    }
  }

  async function applyOrderSuggestion() {
    if (!orderSuggestion) return;
    const idToSlide = new Map(project.slides.map(s => [s.id, s]));
    const reordered = orderSuggestion.ids.map((id, i) => ({ ...idToSlide.get(id)!, slideOrder: i + 1 }));
    setProject(prev => ({ ...prev, slides: reordered }));
    setOrderSuggestion(null);
    const res = await fetch(`/api/commercial/projects/${project.id}/slides/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map(s => s.id) }),
    });
    if (!res.ok) console.error("[commercial] apply-order reorder failed", res.status);
  }

  // ── Slide field auto-save (debounced 800ms) ─────────────────────────────
  const patchSlide = useCallback((slideId: string, patch: Partial<CommercialSlide>) => {
    setProject(prev => ({
      ...prev,
      slides: prev.slides.map(s => s.id === slideId ? { ...s, ...patch } : s),
    }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const res = await fetch(`/api/commercial/projects/${project.id}/slides/${slideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) console.error("[commercial] slide auto-save failed", res.status);
    }, 800);
  }, [project.id]);

  // Merge-patch enhancementSettings (preserves existing keys)
  const patchSlideEnhancement = useCallback((slideId: string, enh: Partial<SlideEnhancement>) => {
    const slide = project.slides.find(s => s.id === slideId);
    const merged: SlideEnhancement = { ...(slide?.enhancementSettings ?? {}), ...enh };
    patchSlide(slideId, { enhancementSettings: merged });
  }, [project.slides, patchSlide]);

  async function handleTranslateField(slideId: string, field: "caption" | "narration", text: string) {
    setTranslateState({ slideId, field, translated: "", loading: true, lang: translateLang });
    try {
      const res  = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, targetLanguage: translateLang }),
      });
      const data = await safeJson<{ translated?: string; error?: string }>(res, "commercial-translate");
      setTranslateState({ slideId, field, translated: data.translated ?? "", loading: false, lang: translateLang });
    } catch {
      setTranslateState({ slideId, field, translated: "", loading: false, lang: translateLang });
    }
  }

  // ── Project-level PATCH ─────────────────────────────────────────────────
  async function patchProject(data: Record<string, unknown>) {
    setProject(prev => ({ ...prev, ...data }));
    await fetch(`/api/commercial/projects/${project.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
  }

  // ── Panel resize ────────────────────────────────────────────────────────
  function startPanelDrag(e: React.MouseEvent) {
    e.preventDefault();
    dragStateRef.current = { startX: e.clientX, startW: rightPanelWidth };
    const onMove = (mv: MouseEvent) => {
      if (!dragStateRef.current) return;
      const delta = dragStateRef.current.startX - mv.clientX;
      const next = Math.max(240, Math.min(560, dragStateRef.current.startW + delta));
      setRightPanelWidth(next);
    };
    const onUp = () => {
      dragStateRef.current = null;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  // ── Image upload ────────────────────────────────────────────────────────
  async function handleImageUpload(file: File, slideId: string) {
    setUploading(true);
    setUploadError("");
    const form = new FormData();
    form.append("image", file);
    try {
      const res = await fetch(`/api/commercial/projects/${project.id}/slides/${slideId}/image`, { method: "POST", body: form });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(err.error ?? `Upload failed (${res.status})`);
        return;
      }
      const { imagePath, imageFileName } = await res.json();
      setProject(prev => ({
        ...prev,
        slides: prev.slides.map(s => s.id === slideId ? { ...s, imagePath, imageFileName, status: "ready" } : s),
      }));
    } catch {
      setUploadError("Upload failed — check connection.");
    } finally {
      setUploading(false);
    }
  }

  // ── Music upload / remove ────────────────────────────────────────────────
  async function handleMusicUpload(file: File) {
    setMusicUploading(true);
    setUploadError("");
    try {
      const fd = new FormData();
      fd.append("music", file);
      const res  = await fetch(`/api/commercial/projects/${project.id}/music`, { method: "POST", body: fd });
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string };
        setUploadError(err.error ?? `Music upload failed (${res.status})`);
        return;
      }
      const data = await res.json();
      setProject(prev => ({ ...prev, musicPath: data.musicPath, musicSource: "uploaded" }));
    } catch {
      setUploadError("Music upload failed — check connection.");
    } finally {
      setMusicUploading(false);
    }
  }

  async function handleMusicRemove() {
    const res = await fetch(`/api/commercial/projects/${project.id}/music`, { method: "DELETE" });
    if (res.ok) {
      setProject(prev => ({ ...prev, musicPath: null, musicSource: null }));
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      setUploadError(err.error ?? "Failed to remove music");
    }
  }

  // ── Music library ───────────────────────────────────────────────────────
  async function openMusicLibrary() {
    setMusicLibraryLoading(true);
    setShowMusicLibrary(true);
    try {
      const res = await fetch("/api/music/library");
      if (res.ok) {
        const data = await res.json() as { tracks: { filename: string; label: string; mood: string }[] };
        setMusicLibrary(data.tracks ?? []);
      }
    } finally {
      setMusicLibraryLoading(false);
    }
  }

  async function handleMusicFromLibrary(filename: string) {
    const res = await fetch("/api/music/library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id, filename }),
    });
    if (res.ok) {
      const data = await res.json() as { musicPath: string; musicSource: string };
      setProject(prev => ({ ...prev, musicPath: data.musicPath, musicSource: "stock" }));
      setShowMusicLibrary(false);
    } else {
      const err = await res.json().catch(() => ({})) as { error?: string };
      setUploadError(err.error ?? "Failed to select track");
    }
  }

  async function handleMusicDownload(input: string) {
    const trimmed = input.trim();
    if (!trimmed) return;
    setMusicDownloading(true);
    try {
      const isUrl = trimmed.startsWith("http://") || trimmed.startsWith("https://");
      const payload = isUrl
        ? { url: trimmed }
        : { query: trimmed, mood: trimmed.split(" ")[0] };
      const res = await fetch("/api/music/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json() as { filename?: string; label?: string; mood?: string; error?: string };
      if (res.ok && data.filename) {
        setMusicDownloadQuery("");
        // Append to library state — avoids a second round-trip to refetch
        const label = data.filename.replace(/\.(mp3|wav|aac)$/i, "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
        const mood  = data.mood ?? data.filename.split("_")[0] ?? "general";
        setMusicLibrary(prev => [...prev, { filename: data.filename!, label, mood }]);
      } else {
        setUploadError(data.error ?? "Download failed");
      }
    } catch {
      setUploadError("Download failed — check connection");
    } finally {
      setMusicDownloading(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────
  async function handleRender() {
    try { await requireGate(); } catch { return; }
    setRenderMsg("");
    try {
      // Always save voice settings to DB before render — server reads project.voiceId at render time.
      // Do not skip: an empty voiceId intentionally clears any previously saved voice so the default is used.
      await patchProject({
        voiceId:       project.voiceId       || null,
        voiceLanguage: project.voiceLanguage || null,
      });
      setProject(prev => ({ ...prev, renderStatus: "rendering" }));
      const engineVoiceId = voiceEngine === "edge" ? selectedEdgeVoice
        : voiceEngine === "piper" ? selectedPiperVoice
        : (project.voiceId ?? undefined);
      const res  = await fetch(`/api/commercial/projects/${project.id}/render`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ soundTier: voiceEngine, voiceId: engineVoiceId }),
      });
      const data = await res.json();
      if (res.ok) {
        setRenderMsg(data.message ?? "Render started. Check Review when ready.");
        setProject(prev => ({ ...prev, renderStatus: "rendering", contentItemId: data.contentItemId }));
        // Poll until the background render completes or fails
        pollRenderStatus(project.id);
      } else {
        setProject(prev => ({ ...prev, renderStatus: "failed" }));
        setRenderMsg(data.error ?? "Render failed.");
      }
    } catch {
      setProject(prev => ({ ...prev, renderStatus: "failed" }));
      setRenderMsg("Network error");
    }
  }

  const RENDER_STAGES: Record<string, { label: string; pct: number }> = {
    PENDING:           { label: "Starting...",           pct: 5  },
    GENERATING_VIDEO:  { label: "Building slideshow...", pct: 25 },
    GENERATING_VOICE:  { label: "Generating voice...",   pct: 55 },
    GENERATING_MUSIC:  { label: "Resolving music...",    pct: 70 },
    MERGING:           { label: "Merging final video...",pct: 85 },
    IN_REVIEW:         { label: "Complete!",             pct: 100 },
  };
  const [renderProgress, setRenderProgress] = useState<{ stage: string; pct: number } | null>(null);

  async function pollRenderStatus(projectId: string) {
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/commercial/projects/${projectId}`);
        if (!res.ok) break;
        const data = await res.json() as CommercialProject & { mergedOutputPath?: string | null; renderError?: string | null };

        // Poll content item for pipeline stage
        if (data.contentItemId) {
          try {
            const ciRes = await fetch(`/api/registry/${data.contentItemId}`);
            if (ciRes.ok) {
              const ciData = await ciRes.json();
              const status = ciData.item?.status ?? ciData.status;
              const stage = RENDER_STAGES[status];
              if (stage) setRenderProgress({ stage: stage.label, pct: stage.pct });
            }
          } catch { /* ignore */ }
        }

        if (data.renderStatus === "ready") {
          setRenderProgress({ stage: "Complete!", pct: 100 });
          setProject(prev => ({ ...prev, renderStatus: "ready", contentItemId: data.contentItemId ?? prev.contentItemId }));
          setRenderMsg("Render complete! Check Review queue.");
          if (data.mergedOutputPath) setMergedVideoPath(data.mergedOutputPath);
          setTimeout(() => setRenderProgress(null), 3000);
          return;
        }
        if (data.renderStatus === "failed") {
          setRenderProgress(null);
          setProject(prev => ({ ...prev, renderStatus: "failed" }));
          const errDetail = data.renderError ? ` — ${data.renderError}` : "";
          setRenderMsg(`Render failed${errDetail}`);
          return;
        }
      } catch { break; }
    }
    setRenderProgress(null);
  }

  const readyCount = project.slides.filter(s => s.status === "ready").length;
  const canRender  = readyCount > 0 && renderStatus !== "rendering";
  const dims       = ASPECT_DIMS[project.aspectRatio] ?? ASPECT_DIMS["9:16"];

  const previewStyle: React.CSSProperties =
    dims.w < dims.h ? { width: 180, height: Math.round(180 * dims.h / dims.w) }
    : dims.w > dims.h ? { width: 280, height: Math.round(280 * dims.h / dims.w) }
    : { width: 220, height: 220 };


  return (
    <div className="flex flex-col h-full min-h-0" style={{ height: "calc(100vh - 80px)" }}>
      <GateModal />
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-3 flex-shrink-0">
        <button onClick={onBack} className="text-[#6060a0] hover:text-white transition-colors text-sm">← Projects</button>
        <h1 className="text-lg font-bold text-white flex-1 truncate">{project.projectName}</h1>
        <span className="text-xs text-[#6060a0] border border-[#2a2a40] px-2 py-0.5 rounded-full">{project.aspectRatio}</span>
        <button
          onClick={handleRender}
          disabled={!canRender}
          className={`px-4 py-1.5 text-sm font-semibold rounded-xl transition-colors ${
            canRender ? "bg-[#7c5cfc] hover:bg-[#9070ff] text-white" : "bg-[#1a1a2e] text-[#404060] cursor-not-allowed"
          }`}
        >
          {renderStatus === "rendering" ? "⏳ Rendering…" : "Render"}
        </button>
      </div>

      {/* Render progress bar */}
      {renderProgress && (
        <div className="mb-3 px-3 py-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 flex-shrink-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-indigo-300 font-medium">{renderProgress.stage}</span>
            <span className="text-[10px] text-indigo-400/70 font-mono">{renderProgress.pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-indigo-900/50 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${renderProgress.pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Render status banner */}
      {renderMsg && !renderProgress && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs flex-shrink-0 ${
          renderStatus === "done"   ? "bg-green-950/40 border border-green-800/40 text-green-400" :
          renderStatus === "failed" ? "bg-red-950/40 border border-red-800/40 text-red-400" :
          "bg-indigo-950/40 border border-indigo-800/40 text-indigo-400"
        }`}>
          {renderMsg}
          {renderStatus === "done" && project.contentItemId && (
            <a href={`/dashboard/content/${project.contentItemId}`} className="ml-2 underline opacity-70">View in Review →</a>
          )}
        </div>
      )}

      {/* Upload error */}
      {uploadError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-950/40 border border-red-800/40 text-xs text-red-400 flex items-center justify-between flex-shrink-0">
          <span>⚠ {uploadError}</span>
          <button onClick={() => setUploadError("")} className="text-[#6060a0] hover:text-white ml-3">✕</button>
        </div>
      )}

      {/* LLM not configured warning */}
      {llmReady === false && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-orange-950/30 border border-orange-800/40 text-xs text-orange-300 flex items-center justify-between gap-2 flex-shrink-0">
          <span>⚠️ No AI key configured. AI features (Polish &amp; AI-order) need at least GHS Standard running. Go to Settings to configure.</span>
          <a href="/dashboard/settings" className="shrink-0 px-2 py-0.5 bg-[#7c5cfc]/20 border border-[#7c5cfc]/40 text-[#b090ff] rounded-lg font-medium hover:bg-[#7c5cfc]/30 transition-colors whitespace-nowrap">
            ⚙️ Add API key →
          </a>
        </div>
      )}

      {/* Order suggestion banner */}
      {orderSuggestion && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#7c5cfc]/10 border border-[#7c5cfc]/30 text-xs text-[#b090ff] flex-shrink-0 flex items-start justify-between gap-2">
          <span>AI suggests: {orderSuggestion.reasoning}</span>
          <div className="flex gap-2 shrink-0">
            <button onClick={applyOrderSuggestion} className="px-2 py-0.5 bg-[#7c5cfc]/30 hover:bg-[#7c5cfc]/50 rounded text-xs font-medium transition-colors">Apply</button>
            <button onClick={() => setOrderSuggestion(null)} className="text-[#6060a0] hover:text-white transition-colors">✕</button>
          </div>
        </div>
      )}

      {/* Three-panel layout */}
      <div className="flex gap-0 flex-1 min-h-0 overflow-hidden">

        {/* ── LEFT: Slide list (220px) ── */}
        <div className="w-[220px] flex-shrink-0 flex flex-col gap-2 overflow-y-auto pr-1 mr-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-[#6060a0] uppercase tracking-widest">Slides</p>
            <div className="flex items-center gap-2">
              <button
                onClick={suggestOrder}
                disabled={suggestingOrder || project.slides.length < 2}
                title="Ask AI for best slide order"
                className="text-[10px] text-[#7c5cfc] hover:text-[#9070ff] disabled:text-[#3a3a55] transition-colors font-medium"
              >
                {suggestingOrder ? "…" : "AI order"}
              </button>
              <button
                onClick={() => batchImportRef.current?.click()}
                disabled={batchImporting}
                title="Import multiple images — one slide per image"
                className="text-[10px] text-[#5cf5c8] hover:text-[#80ffdc] disabled:text-[#3a3a55] transition-colors font-medium"
              >
                {batchImporting ? "⏳ Importing…" : "⬆ Import"}
              </button>
              <button onClick={addSlide} className="text-xs text-[#7c5cfc] hover:text-[#9070ff] font-medium transition-colors">➕ Add</button>
              <button onClick={() => introOutroRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                title="Add an intro or outro card — type a card (AI colours) or import your own image"
                className="text-[10px] text-[#c9b6ff] hover:text-white font-medium transition-colors">🎬 Intro/Outro</button>
            </div>
          </div>
          <input ref={batchImportRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { handleBatchImport(e.target.files); e.target.value = ""; }} />

          <p className="text-[10px] text-[#404060]">↕️ Drag to reorder</p>

          {project.slides.length === 0 ? (
            <button onClick={addSlide} className="border border-dashed border-[#2a2a40] rounded-lg p-4 text-center text-xs text-[#404060] hover:border-[#7c5cfc]/40 transition-colors">
              ➕ Add first slide
            </button>
          ) : (
            project.slides.map((slide, i) => (
              <div
                key={slide.id}
                draggable
                onDragStart={() => handleDragStart(slide.id)}
                onDragOver={e => handleDragOver(e, slide.id)}
                onDrop={handleDrop}
                onClick={() => setSelectedId(slide.id)}
                className={`w-full text-left rounded-lg border p-2 transition-colors cursor-grab active:cursor-grabbing ${
                  draggedId === slide.id ? "opacity-40 border-[#7c5cfc]/50 bg-[#7c5cfc]/5" :
                  slide.id === selectedId ? "border-[#7c5cfc] bg-[#7c5cfc]/10" :
                  "border-[#2a2a40] bg-[#12121e] hover:border-[#4a4a70]"
                }`}
              >
                <div className="w-full rounded mb-1.5 overflow-hidden bg-[#0d0d1a] flex items-center justify-center" style={{ aspectRatio: project.aspectRatio.replace(":", "/"), maxHeight: 80 }}>
                  {slide.imagePath ? (
                    <img src={`/api/media/file?path=${encodeURIComponent(slide.imagePath)}`} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[#3a3a55] text-[10px]">No image</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-white font-medium truncate">Slide {i + 1}</p>
                  <span className={`text-[10px] ${slide.status === "ready" ? "text-green-500" : "text-[#6060a0]"}`}>
                    {slide.status === "ready" ? "✅" : "⭕"}
                  </span>
                </div>
                {slide.captionOriginal && (
                  <p className="text-[10px] text-[#6060a0] truncate mt-0.5">{slide.captionOriginal}</p>
                )}
              </div>
            ))
          )}
        </div>

        {/* ── CENTER: Preview ── */}
        <div className="flex-1 flex flex-col items-center justify-center bg-[#0d0d1a] rounded-xl border border-[#2a2a40] overflow-hidden">
          {selectedSlide ? (
            <div className="flex flex-col items-center gap-4 p-4 w-full h-full">
              {/* CASCADE: all slides stacked in the center, ACTIVE one floated to front (Henry 2026-06-19) */}
              {/* Book-style swipe: drag / swipe left→next, right→prev; ‹ › arrows too. */}
              <div
                className="relative flex-shrink-0 flex items-center justify-center w-full select-none"
                style={{ height: (previewStyle.height as number) + 70, minHeight: 260 }}
                onTouchStart={e => { swipeRef.current = e.touches[0]?.clientX ?? null; }}
                onTouchEnd={e => {
                  if (swipeRef.current == null) return;
                  const dx = (e.changedTouches[0]?.clientX ?? swipeRef.current) - swipeRef.current; swipeRef.current = null;
                  const ids = project.slides.map(s => s.id); const idx = ids.indexOf(selectedId ?? "");
                  if (dx < -40 && idx < ids.length - 1) setSelectedId(ids[idx + 1]);
                  else if (dx > 40 && idx > 0) setSelectedId(ids[idx - 1]);
                }}
                onMouseDown={e => { swipeRef.current = e.clientX; }}
                onMouseUp={e => {
                  if (swipeRef.current == null) return;
                  const dx = e.clientX - swipeRef.current; swipeRef.current = null;
                  if (Math.abs(dx) < 40) return; // a click — let the layer's onClick select it
                  const ids = project.slides.map(s => s.id); const idx = ids.indexOf(selectedId ?? "");
                  if (dx < 0 && idx < ids.length - 1) setSelectedId(ids[idx + 1]);
                  else if (dx > 0 && idx > 0) setSelectedId(ids[idx - 1]);
                }}
              >
                {project.slides.length > 1 && (
                  <>
                    <button type="button" title="Previous slide"
                      onClick={() => { const ids = project.slides.map(s => s.id); const idx = ids.indexOf(selectedId ?? ""); if (idx > 0) setSelectedId(ids[idx - 1]); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 z-[1000] w-6 h-6 rounded-full bg-black/40 backdrop-blur-md border border-[#7c5cfc]/40 text-[#c9b6ff] text-xs leading-none hover:bg-[#7c5cfc]/40 hover:border-[#7c5cfc] hover:text-white flex items-center justify-center shadow-md transition-all">‹</button>
                    <button type="button" title="Next slide"
                      onClick={() => { const ids = project.slides.map(s => s.id); const idx = ids.indexOf(selectedId ?? ""); if (idx < ids.length - 1) setSelectedId(ids[idx + 1]); }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 z-[1000] w-6 h-6 rounded-full bg-black/40 backdrop-blur-md border border-[#7c5cfc]/40 text-[#c9b6ff] text-xs leading-none hover:bg-[#7c5cfc]/40 hover:border-[#7c5cfc] hover:text-white flex items-center justify-center shadow-md transition-all">›</button>
                  </>
                )}
                {project.slides.map((s, i) => {
                  const isActive = s.id === selectedId;
                  const total = project.slides.length;
                  const pw = (previewStyle.width as number) || 180;
                  const spread = Math.min(pw * 0.62, 760 / Math.max(total, 1));
                  const offset = (i - (total - 1) / 2) * spread;
                  return (
                    <div
                      key={s.id}
                      onClick={() => { if (isActive && !s.imagePath) { fileRef.current?.click(); } else { setSelectedId(s.id); } }}
                      className="absolute rounded-lg bg-black border flex items-center justify-center cursor-pointer transition-all duration-300"
                      style={{
                        width: previewStyle.width,
                        height: previewStyle.height,
                        transform: `translateX(${offset}px) translateY(${isActive ? -12 : 0}px) scale(${isActive ? 1.06 : 0.85})`,
                        zIndex: isActive ? 999 : i + 1,
                        opacity: isActive ? 1 : 0.5,
                        borderColor: isActive ? "#7c5cfc" : "#2a2a40",
                        boxShadow: isActive ? "0 18px 55px rgba(124,92,252,0.55)" : "0 4px 14px rgba(0,0,0,0.45)",
                        overflow: "hidden",
                      }}
                      title={`Slide ${i + 1}${isActive ? " (active)" : ""}`}
                    >
                      {s.imagePath ? (
                        <>
                          <img src={`/api/media/file?path=${encodeURIComponent(s.imagePath)}`} alt={`Slide ${i + 1}`} className="w-full h-full object-cover" />
                          {isActive && (
                            <CaptionPreview
                              captionText={s.captionApproved && s.captionPolished ? s.captionPolished : s.captionOriginal}
                              captionPosition={s.enhancementSettings?.captionPosition ?? "bottom"}
                              captionPreset={(s.enhancementSettings?.captionPreset ?? "realEstate") as PresetName}
                              fontOverride={s.enhancementSettings?.fontFamily ?? null}
                              aspectRatio={(project.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1"}
                              previewWidth={previewStyle.width as number}
                              previewHeight={previewStyle.height as number}
                            />
                          )}
                          {isActive && s.slideOrder === project.slides.length && project.ctaMethod && project.ctaValue && (
                            <div className="absolute top-2 right-2"><span className="text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded font-medium">CTA</span></div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-[#6060a0]">
                          <div className="w-9 h-9 rounded-full bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center text-base">{isActive ? "+" : i + 1}</div>
                          <p className="text-[10px]">{isActive ? "Click to upload" : "No image"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file && selectedSlide) await handleImageUpload(file, selectedSlide.id); e.target.value = ""; }} />

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[#2a2a40] text-[#6060a0] hover:border-[#7c5cfc]/50 hover:text-white transition-colors">
                  {uploading ? "⏳ Uploading…" : selectedSlide.imagePath ? "Replace image" : "Upload image"}
                </button>
                {selectedSlide.imagePath && (
                  <button
                    disabled={aiImageLoading || uploading}
                    onClick={async () => {
                      if (!selectedSlide.imagePath) return;
                      setAiImageLoading(true);
                      try {
                        const res = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/rotate`, { method: "POST" });
                        const data = await res.json();
                        if (res.ok && data.imagePath) {
                          setProject(prev => ({ ...prev, slides: prev.slides.map(s => s.id === selectedSlide.id ? { ...s, imagePath: data.imagePath } : s) }));
                        }
                      } catch { /* ignore */ }
                      setAiImageLoading(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#2a2a40] text-[#6060a0] hover:border-[#7c5cfc]/50 hover:text-white transition-colors disabled:opacity-40"
                    title="Rotate image 90° clockwise"
                  >
                    ↻ Rotate
                  </button>
                )}
                <button
                  disabled={aiImageLoading || !selectedSlide.captionOriginal?.trim()}
                  onClick={async () => {
                    const prompt = selectedSlide.captionOriginal?.trim();
                    if (!prompt) return;
                    setAiImageLoading(true);
                    try {
                      const res = await fetch("/api/generation/image", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt: `${prompt}, professional real estate photography, photorealistic, high quality`, width: 1024, height: 1024 }),
                      });
                      const data = await res.json();
                      if (res.ok && data.imagePath) {
                        // Set the generated image as the slide image
                        const { PrismaClient } = await import("@prisma/client");
                        await patchSlide(selectedSlide.id, { imagePath: null } as never);
                        // Use direct DB update via a helper endpoint would be better,
                        // but for now reload the project
                        await fetch(`/api/commercial/projects/${project.id}`).then(r => r.json()).then(p => {
                          if (p.slides) setProject(prev => ({ ...prev, slides: p.slides }));
                        });
                      }
                    } catch { /* ignore */ }
                    setAiImageLoading(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/25 disabled:opacity-40 transition-colors"
                  title="Generate AI image from caption text"
                >
                  {aiImageLoading ? "Generating…" : "AI Generate"}
                </button>
                <button
                  onClick={() => setAssetPickerOpen("image")}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#7c5cfc]/30 text-[#b090ff] hover:bg-[#7c5cfc]/10 transition-colors"
                >
                  Library
                </button>
                {selectedSlide.imagePath && (
                  <button
                    disabled={captionLoading}
                    onClick={async () => {
                      setCaptionLoading(true);
                      try {
                        const res = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/review-caption`, { method: "POST" });
                        const data = await res.json();
                        if (res.ok && data.caption) {
                          await patchSlide(selectedSlide.id, { captionOriginal: data.caption, captionApproved: false } as never);
                          setProject(prev => ({ ...prev, slides: prev.slides.map(s => s.id === selectedSlide.id ? { ...s, captionOriginal: data.caption, captionApproved: false } : s) }));
                        }
                      } catch { /* ignore */ }
                      setCaptionLoading(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/25 disabled:opacity-40 transition-colors"
                    title="AI writes a nice caption from this image — shows on the slide"
                  >
                    {captionLoading ? "Captioning…" : "✨ Caption"}
                  </button>
                )}
                {project.slides.length > 1 && (
                  <button
                    disabled={captioningAll}
                    onClick={async () => {
                      setCaptioningAll(true);
                      try {
                        // PARALLEL + fast cloud vision (Haiku ~2-3s) so all images caption in seconds, not minutes.
                        const targets = project.slides.filter(s => s.imagePath);
                        await Promise.all(targets.map(async s => {
                          try {
                            const r = await fetch(`/api/commercial/projects/${project.id}/slides/${s.id}/review-caption?fast=1`, { method: "POST" });
                            const d = await r.json().catch(() => ({} as { caption?: string }));
                            if (r.ok && d.caption) {
                              await patchSlide(s.id, { captionOriginal: d.caption, captionApproved: false } as never);
                              setProject(prev => ({ ...prev, slides: prev.slides.map(x => x.id === s.id ? { ...x, captionOriginal: d.caption!, captionApproved: false } : x) }));
                            }
                          } catch { /* skip this one */ }
                        }));
                      } catch { /* ignore */ }
                      setCaptioningAll(false);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#7c5cfc]/30 text-[#c9b6ff] hover:bg-[#7c5cfc]/45 disabled:opacity-40 transition-colors"
                    title="AI captions EVERY image in seconds (fast cloud vision)"
                  >
                    {captioningAll ? "Captioning all…" : "✨ Caption ALL"}
                  </button>
                )}
                {selectedSlide.imagePath && (
                  <button
                    disabled={reviewLoading}
                    onClick={async () => {
                      setReviewLoading(true); setAiReview(null);
                      try {
                        const res = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/review-image`, { method: "POST" });
                        const data = await res.json();
                        setAiReview(res.ok && data.review ? { review: data.review, provider: data.provider } : { review: data.error || "Review unavailable" });
                      } catch { setAiReview({ review: "Review failed — try again" }); }
                      setReviewLoading(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-900/20 text-emerald-300 hover:bg-emerald-900/30 disabled:opacity-40 transition-colors"
                    title="Honest AI marketing critique (hook / sells / weak / angle / fix)"
                  >
                    {reviewLoading ? "Reviewing…" : "📊 Marketing Review"}
                  </button>
                )}
                {aiReview && (
                  <div className="w-full max-w-md mx-auto rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-3 text-left">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-emerald-300">✨ Marketing Review{aiReview.provider ? ` · ${aiReview.provider}` : ""}</span>
                      <button onClick={() => setAiReview(null)} className="text-[10px] text-[#6060a0] hover:text-white">✕</button>
                    </div>
                    <pre className="text-[11px] text-[#c0c0e0] whitespace-pre-wrap font-sans leading-relaxed m-0">{aiReview.review}</pre>
                  </div>
                )}
                <button
                  disabled={aiImageLoading || !selectedSlide.captionOriginal?.trim()}
                  onClick={async () => {
                    const prompt = selectedSlide.captionOriginal?.trim();
                    if (!prompt) return;
                    setAiImageLoading(true);
                    try {
                      const res = await fetch("/api/ad-editor/ideogram-transparent", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ prompt: `${prompt}, product photo, transparent background`, projectId: project.id }),
                      });
                      const data = await res.json();
                      if (data.outputUrl) {
                        await patchSlide(selectedSlide.id, { imagePath: `storage/${data.outputUrl.replace("/api/media/", "")}` } as never);
                        setProject(prev => ({
                          ...prev,
                          slides: prev.slides.map(s => s.id === selectedSlide.id ? { ...s, imagePath: `storage/${data.outputUrl.replace("/api/media/", "")}` } : s),
                        }));
                      }
                    } catch { /* ignore */ }
                    setAiImageLoading(false);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-900/20 text-purple-400 hover:bg-purple-900/30 disabled:opacity-40 transition-colors"
                  title="Generate transparent PNG cutout from caption (Ideogram V3)"
                >
                  ✂️ Transparent PNG
                </button>
                {selectedSlide.imagePath && (
                  <button
                    disabled={aiImageLoading}
                    onClick={async () => {
                      if (!selectedSlide.imagePath) return;
                      setAiImageLoading(true);
                      try {
                        const imgUrl = `/api/media/${selectedSlide.imagePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
                        const res = await fetch("/api/layerize", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ imageUrl: imgUrl, projectType: "commercial", projectId: project.id }),
                        });
                        const data = await res.json();
                        if (data.ok && data.backgroundUrl) {
                          setLayerizeResult({
                            designId: data.designId,
                            backgroundUrl: data.backgroundUrl,
                            textContainers: data.textContainers ?? [],
                            overlayHtml: data.overlayHtml ?? "",
                            sourceImageUrl: imgUrl,
                          });
                        }
                      } catch { /* ignore */ }
                      setAiImageLoading(false);
                    }}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-900/20 text-blue-400 hover:bg-blue-900/30 disabled:opacity-40 transition-colors"
                    title="Extract text layers — edit text without regenerating the image (Ideogram Layerize)"
                  >
                    Edit Text Layers
                  </button>
                )}
                {selectedSlide.imagePath && (
                  <>
                    <button
                      disabled={uploading}
                      onClick={async () => {
                        if (!selectedSlide.imagePath) return;
                        setUploading(true);
                        try {
                          const imgRes = await fetch(`/api/media/${selectedSlide.imagePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`);
                          const blob = await imgRes.blob();
                          const fd = new FormData();
                          fd.append("file", blob, "image.png");
                          fd.append("mode", "enhance");
                          const res = await fetch("/api/image/enhance", { method: "POST", body: fd });
                          const data = await res.json();
                          if (data.outputUrl) {
                            const fullPath = `storage/${data.outputUrl.replace("/api/media/", "")}`;
                            await patchSlide(selectedSlide.id, { imagePath: fullPath });
                          }
                        } catch { /* ignore */ }
                        setUploading(false);
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-emerald-900/40 text-emerald-400/80 hover:text-emerald-300 hover:border-emerald-500/50 transition-colors"
                      title="Enhance image with AI (better lighting, sharper detail)"
                    >
                      {uploading ? "⏳ Enhancing…" : "✨ Enhance"}
                    </button>
                    <button
                      onClick={() => patchSlide(selectedSlide.id, { imagePath: null })}
                      disabled={uploading}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-900/40 text-red-500/60 hover:text-red-400 hover:border-red-500/50 transition-colors"
                      title="Remove image"
                    >️ Clear</button>
                    <button
                      disabled={readImageState?.loading}
                      onClick={async () => {
                        setReadImageState({ slideId: selectedSlide.id, caption: "", narration: "", loading: true });
                        const res = await fetch(
                          `/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/read-image`,
                          { method: "POST" }
                        );
                        const data = await res.json();
                        if (res.ok) {
                          setReadImageState({ slideId: selectedSlide.id, caption: data.caption ?? "", narration: data.narration ?? "", loading: false });
                        } else {
                          setReadImageState({ slideId: selectedSlide.id, caption: "", narration: "", loading: false, error: data.error ?? "Vision AI unavailable", details: data.details });
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-[#7c5cfc]/40 text-[#b090ff] hover:bg-[#7c5cfc]/15 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title="Analyze image and generate caption + narration"
                    >
                      {readImageState?.loading && readImageState.slideId === selectedSlide.id ? "️ Reading…" : "️ Read Image"}
                    </button>
                  </>
                )}
              </div>

              {/* Read Image AI result panel */}
              {readImageState && !readImageState.loading && readImageState.slideId === selectedSlide.id && (
                <div className={`rounded-lg p-3 space-y-2 ${readImageState.error ? "border border-orange-800/40 bg-orange-950/20" : "border border-[#7c5cfc]/30 bg-[#7c5cfc]/5"}`}>
                  {readImageState.error ? (
                    <>
                      <p className="text-[10px] text-orange-400 font-semibold">Vision AI unavailable</p>
                      <p className="text-[10px] text-orange-300/70">{readImageState.error}</p>
                      {readImageState.details && readImageState.details.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {readImageState.details.map((d, i) => (
                            <p key={i} className="text-[9px] text-orange-400/60 font-mono break-all">{d}</p>
                          ))}
                        </div>
                      )}
                      <a href="/dashboard/settings" className="text-[10px] text-[#7c5cfc] underline block">⚙️ Add API key in Settings →</a>
                      <button onClick={() => setReadImageState(null)} className="text-[10px] text-[#6060a0] hover:text-white">Dismiss</button>
                    </>
                  ) : (
                    <>
                      <p className="text-[10px] text-[#7c5cfc] font-semibold uppercase tracking-wider">AI image read</p>
                      {readImageState.caption && (
                        <div>
                          <p className="text-[10px] text-[#6060a0] mb-0.5">Caption</p>
                          <p className="text-xs text-white">{readImageState.caption}</p>
                          <button
                            onClick={() => { if (readImageState.caption) patchSlide(selectedSlide.id, { captionOriginal: readImageState.caption }); }}
                            className="text-[10px] text-[#7c5cfc] hover:underline mt-0.5"
                          >Use as caption</button>
                        </div>
                      )}
                      {readImageState.narration && (
                        <div>
                          <p className="text-[10px] text-[#6060a0] mb-0.5">Narration</p>
                          <p className="text-xs text-white">{readImageState.narration}</p>
                          <button
                            onClick={() => { if (readImageState.narration) patchSlide(selectedSlide.id, { narrationLine: readImageState.narration }); }}
                            className="text-[10px] text-[#7c5cfc] hover:underline mt-0.5"
                          >Use as narration</button>
                        </div>
                      )}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => {
                            const patch: Partial<CommercialSlide> = {};
                            if (readImageState.caption)   patch.captionOriginal = readImageState.caption;
                            if (readImageState.narration) patch.narrationLine   = readImageState.narration;
                            patchSlide(selectedSlide.id, patch);
                            setReadImageState(null);
                          }}
                          className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-green-900/40 border border-green-700/40 text-green-400 hover:bg-green-900/60 transition-colors"
                        >✅ Use both</button>
                        <button onClick={() => setReadImageState(null)} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a2e] border border-[#2a2a40] text-[#6060a0] hover:text-white transition-colors">Dismiss</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <p className="text-[11px] text-[#404060] text-center">{dims.label} · ⏱️ {selectedSlide.durationMs / 1000}s</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[#6060a0] text-sm">Select or add a slide to begin</p>
            </div>
          )}
        </div>

        {/* ── Drag handle ── */}
        <div
          onMouseDown={startPanelDrag}
          style={{ width: 6, flexShrink: 0, cursor: "col-resize", background: "transparent", position: "relative", zIndex: 10 }}
          title="Drag to resize"
          className="hover:bg-[#7c5cfc]/30 transition-colors group"
        >
          <div className="absolute inset-y-0 left-0.5 w-0.5 bg-[#2a2a40] group-hover:bg-[#7c5cfc]/50 transition-colors rounded-full" />
        </div>

        {/* ── RIGHT: Slide + Project settings (resizable) ── */}
        <div className="flex-shrink-0 overflow-y-auto overflow-x-hidden space-y-3 pl-2" style={{ width: rightPanelWidth }}>
          {selectedSlide ? (
            <>
              {/* Slide header */}
              <div className="flex items-center justify-between">
                <p className={sectionTitle}>Slide {selectedSlide.slideOrder}</p>
                <button onClick={() => deleteSlide(selectedSlide.id)} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">️ Remove</button>
              </div>

              {/* Caption */}
              <div className={sectionCls}>
                <div className="flex items-center gap-1.5 justify-between">
                  <p className={sectionTitle}>️ Caption</p>
                  <div className="flex items-center gap-1">
                    <select
                      value={translateLang}
                      onChange={e => setTranslateLang(e.target.value)}
                      className="bg-[#0d0d1a] border border-[#2a2a40] text-[#6060a0] text-[10px] rounded px-1 py-0.5 focus:outline-none"
                    >
                      <option value="fr">French</option>
                      <option value="es">Spanish</option>
                      <option value="pt">Portuguese</option>
                      <option value="de">German</option>
                      <option value="ar">Arabic</option>
                      <option value="hi">Hindi</option>
                      <option value="ja">Japanese</option>
                      <option value="ko">Korean</option>
                      <option value="ru">Russian</option>
                      <option value="sw">Swahili</option>
                      <option value="tr">Turkish</option>
                      <option value="zh">Chinese</option>
                    </select>
                    <button
                      type="button"
                      disabled={!selectedSlide.captionOriginal?.trim() || translateState?.loading}
                      onClick={() => { const t = selectedSlide.captionOriginal?.trim(); if (t) handleTranslateField(selectedSlide.id, "caption", t); }}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {translateState?.loading && translateState.slideId === selectedSlide.id && translateState.field === "caption" ? "…" : "Translate"}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedSlide.captionOriginal?.trim() || polishState?.loading}
                      onClick={async () => {
                        const text = selectedSlide.captionOriginal?.trim();
                        if (!text) return;
                        setPolishState({ slideId: selectedSlide.id, field: "caption", polished: "", loading: true });
                        try {
                        const res  = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/polish`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text, brandName: project.brandName ?? undefined, field: "caption", maxWords: project.captionMaxWords, maxChars: project.captionMaxChars }),
                        });
                        const data = await safeJson<{ polished?: string; error?: string }>(res, "commercial-caption-polish");
                        if (data.error) setPolishState({ slideId: selectedSlide.id, field: "caption", polished: "", loading: false, error: data.error });
                        else setPolishState({ slideId: selectedSlide.id, field: "caption", polished: data.polished ?? "", loading: false });
                        } catch (err) {
                          setPolishState({ slideId: selectedSlide.id, field: "caption", polished: "", loading: false, error: err instanceof Error ? err.message : "Polish request failed" });
                        }
                      }}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {polishState?.loading && polishState.slideId === selectedSlide.id ? "✨ Polishing…" : "✨ Polish"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={selectedSlide.captionOriginal ?? ""}
                  onChange={e => patchSlide(selectedSlide.id, { captionOriginal: e.target.value })}
                  rows={3}
                  placeholder="️ Short punchy headline for this slide…"
                  className={inputCls}
                  style={{ resize: "vertical" }}
                />

                {/* Caption position */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-[#6060a0] mr-1">Position:</span>
                  {(["top", "center", "bottom"] as const).map(pos => (
                    <button key={pos} type="button"
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { captionPosition: pos })}
                      className={`flex-1 py-0.5 rounded text-[10px] border transition-colors capitalize ${
                        (selectedSlide.enhancementSettings?.captionPosition ?? "bottom") === pos
                          ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10"
                          : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                      }`}>{pos}</button>
                  ))}
                </div>

                {/* Caption style preset */}
                <div className="flex flex-wrap items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-[#6060a0] mr-1 flex-shrink-0">Style:</span>
                  {(["realEstate", "luxury", "promo", "minimal", "business", "corporate"] as const).map(p => (
                    <button key={p} type="button"
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { captionPreset: p })}
                      className={`flex-1 py-0.5 rounded text-[9px] border transition-colors truncate ${
                        (selectedSlide.enhancementSettings?.captionPreset ?? "realEstate") === p
                          ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10"
                          : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                      }`}>{({ realEstate: "Real Est.", luxury: "Luxury", promo: "Promo", minimal: "✦ Minimal", business: "Business", corporate: "Corporate" } as Record<string, string>)[p]}</button>
                  ))}
                </div>

                {polishState && !polishState.loading && polishState.slideId === selectedSlide.id && polishState.field === "caption" && (
                  polishState.error ? (
                    <div className="border border-orange-800/40 rounded-lg p-2.5 bg-orange-950/20 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-orange-400 font-semibold">Polish failed</p>
                        <p className="text-[10px] text-orange-300/70 mt-0.5">{polishState.error}</p>
                        <a href="/dashboard/settings" className="text-[10px] text-[#7c5cfc] underline mt-1 block">⚙️ Add API key in Settings →</a>
                      </div>
                      <button onClick={() => setPolishState(null)} className="text-[#6060a0] hover:text-white text-xs mt-0.5">✕</button>
                    </div>
                  ) : polishState.polished ? (
                    <div className="border border-[#7c5cfc]/30 rounded-lg p-2.5 space-y-2 bg-[#7c5cfc]/5">
                      <p className="text-[10px] text-[#7c5cfc] font-semibold uppercase tracking-wider">✨ AI suggestion</p>
                      <p className="text-xs text-white leading-snug">{polishState.polished}</p>
                      <div className="flex gap-2">
                        <button onClick={() => { patchSlide(selectedSlide.id, { captionPolished: polishState.polished, captionApproved: true }); setPolishState(null); }} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-green-900/40 border border-green-700/40 text-green-400 hover:bg-green-900/60 transition-colors">✅ Accept</button>
                        <button onClick={() => setPolishState(null)} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a2e] border border-[#2a2a40] text-[#6060a0] hover:text-white transition-colors">✕ Reject</button>
                      </div>
                    </div>
                  ) : null
                )}
                {translateState && !translateState.loading && translateState.slideId === selectedSlide.id && translateState.field === "caption" && translateState.translated && (
                  <div className="border border-blue-800/30 rounded-lg p-2.5 space-y-2 bg-blue-950/10">
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Translation</p>
                    <p className="text-xs text-white leading-snug">{translateState.translated}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { patchSlide(selectedSlide.id, { captionOriginal: translateState.translated }); setTranslateState(null); }} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-blue-900/40 border border-blue-700/40 text-blue-400 hover:bg-blue-900/60 transition-colors">Use</button>
                      <button onClick={() => setTranslateState(null)} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a2e] border border-[#2a2a40] text-[#6060a0] hover:text-white transition-colors">Dismiss</button>
                    </div>
                  </div>
                )}
                {selectedSlide.captionApproved && selectedSlide.captionPolished && (
                  <p className="text-[10px] text-green-500">✅ Using polished: <span className="italic">{selectedSlide.captionPolished}</span></p>
                )}
              </div>

              {/* Font controls */}
              <div className={sectionCls}>
                <p className={sectionTitle}>Font</p>
                <div>
                  <label className={labelCls}>Font family</label>
                  <select
                    value={selectedSlide.enhancementSettings?.fontFamily ?? "Inter"}
                    onChange={e => patchSlideEnhancement(selectedSlide.id, { fontFamily: e.target.value })}
                    className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-1.5 text-white text-xs focus:outline-none focus:border-[#7c5cfc]"
                  >
                    {FONT_FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1">
                    <label className={labelCls}>Size: {selectedSlide.enhancementSettings?.fontSize ?? 12}px</label>
                    <input
                      type="range" min={8} max={48} step={1}
                      value={selectedSlide.enhancementSettings?.fontSize ?? 12}
                      onChange={e => patchSlideEnhancement(selectedSlide.id, { fontSize: Number(e.target.value) })}
                      className="w-full accent-[#7c5cfc]"
                    />
                  </div>
                  <div className="flex gap-1.5 pb-0.5">
                    <button
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { fontBold: !(selectedSlide.enhancementSettings?.fontBold) })}
                      className={`w-7 h-7 rounded font-bold text-sm border transition-colors ${selectedSlide.enhancementSettings?.fontBold ? "bg-[#7c5cfc]/30 border-[#7c5cfc] text-white" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                    >B</button>
                    <button
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { fontItalic: !(selectedSlide.enhancementSettings?.fontItalic) })}
                      className={`w-7 h-7 rounded italic text-sm border transition-colors ${selectedSlide.enhancementSettings?.fontItalic ? "bg-[#7c5cfc]/30 border-[#7c5cfc] text-white" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                    >I</button>
                    <button
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { fontUnderline: !(selectedSlide.enhancementSettings?.fontUnderline) })}
                      className={`w-7 h-7 rounded underline text-sm border transition-colors ${selectedSlide.enhancementSettings?.fontUnderline ? "bg-[#7c5cfc]/30 border-[#7c5cfc] text-white" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                    >U</button>
                  </div>
                </div>
              </div>

              {/* Narration */}
              <div className={sectionCls}>
                <div className="flex items-center gap-1.5 justify-between">
                  <p className={sectionTitle}>Narration</p>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      disabled={!selectedSlide.narrationLine?.trim() || translateState?.loading}
                      onClick={() => { const t = selectedSlide.narrationLine?.trim(); if (t) handleTranslateField(selectedSlide.id, "narration", t); }}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-900/30 text-blue-400 hover:bg-blue-900/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {translateState?.loading && translateState.slideId === selectedSlide.id && translateState.field === "narration" ? "…" : "Translate"}
                    </button>
                    <button
                      type="button"
                      disabled={!selectedSlide.narrationLine?.trim() || polishState?.loading}
                      onClick={async () => {
                        const text = selectedSlide.narrationLine?.trim();
                        if (!text) return;
                        setPolishState({ slideId: selectedSlide.id, field: "narration", polished: "", loading: true });
                        try {
                        const res  = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/polish`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text, brandName: project.brandName ?? undefined, tone: "warm", field: "narration" }),
                        });
                        const data = await safeJson<{ polished?: string; error?: string }>(res, "commercial-narration-polish");
                        if (data.error) setPolishState({ slideId: selectedSlide.id, field: "narration", polished: "", loading: false, error: data.error });
                        else setPolishState({ slideId: selectedSlide.id, field: "narration", polished: data.polished ?? "", loading: false });
                        } catch (err) {
                          setPolishState({ slideId: selectedSlide.id, field: "narration", polished: "", loading: false, error: err instanceof Error ? err.message : "Polish request failed" });
                        }
                      }}
                      className="text-[10px] font-medium px-2 py-0.5 rounded bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/25 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {polishState?.loading && polishState.slideId === selectedSlide.id && polishState.field === "narration" ? "✨ Polishing…" : "✨ Polish"}
                    </button>
                  </div>
                </div>
                <textarea
                  value={selectedSlide.narrationLine ?? ""}
                  onChange={e => patchSlide(selectedSlide.id, { narrationLine: e.target.value })}
                  rows={2}
                  placeholder="What the narrator says during this slide…"
                  className={inputCls}
                  style={{ resize: "vertical" }}
                />
                {polishState && !polishState.loading && polishState.slideId === selectedSlide.id && polishState.field === "narration" && (
                  polishState.error ? (
                    <div className="border border-orange-800/40 rounded-lg p-2.5 bg-orange-950/20 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-orange-400 font-semibold">Polish failed</p>
                        <p className="text-[10px] text-orange-300/70 mt-0.5">{polishState.error}</p>
                        <a href="/dashboard/settings" className="text-[10px] text-[#7c5cfc] underline mt-1 block">⚙️ Add API key in Settings →</a>
                      </div>
                      <button onClick={() => setPolishState(null)} className="text-[#6060a0] hover:text-white text-xs mt-0.5">✕</button>
                    </div>
                  ) : polishState.polished ? (
                    <div className="border border-[#7c5cfc]/30 rounded-lg p-2.5 space-y-2 bg-[#7c5cfc]/5">
                      <p className="text-[10px] text-[#7c5cfc] font-semibold uppercase tracking-wider">✨ AI suggestion</p>
                      <p className="text-xs text-white leading-snug">{polishState.polished}</p>
                      <div className="flex gap-2">
                        <button onClick={() => { patchSlide(selectedSlide.id, { narrationLine: polishState.polished }); setPolishState(null); }} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-green-900/40 border border-green-700/40 text-green-400 hover:bg-green-900/60 transition-colors">✅ Accept</button>
                        <button onClick={() => setPolishState(null)} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a2e] border border-[#2a2a40] text-[#6060a0] hover:text-white transition-colors">✕ Reject</button>
                      </div>
                    </div>
                  ) : null
                )}
                {translateState && !translateState.loading && translateState.slideId === selectedSlide.id && translateState.field === "narration" && translateState.translated && (
                  <div className="border border-blue-800/30 rounded-lg p-2.5 space-y-2 bg-blue-950/10">
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">Translation</p>
                    <p className="text-xs text-white leading-snug">{translateState.translated}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { patchSlide(selectedSlide.id, { narrationLine: translateState.translated }); setTranslateState(null); }} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-blue-900/40 border border-blue-700/40 text-blue-400 hover:bg-blue-900/60 transition-colors">Use</button>
                      <button onClick={() => setTranslateState(null)} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a2e] border border-[#2a2a40] text-[#6060a0] hover:text-white transition-colors">Dismiss</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Narration Controls — voice, speed, tone, pacing */}
              <NarrationControls
                narrationText={selectedSlide.narrationLine ?? ""}
                onNarrationChange={(text) => patchSlide(selectedSlide.id, { narrationLine: text })}
                onSettingsChange={setNarrationControlsSettings}
                initialSettings={{ mode: "commercial" }}
                compact
              />

              {/* Timing + Orientation */}
              <div className={sectionCls}>
                <p className={sectionTitle}>⏱️ Timing & Orientation</p>
                <div>
                  <label className={labelCls}>⏱️ Duration: {selectedSlide.durationMs / 1000}s</label>
                  <input
                    type="range" min={1000} max={10000} step={500}
                    value={selectedSlide.durationMs}
                    onChange={e => patchSlide(selectedSlide.id, { durationMs: Number(e.target.value) })}
                    className="w-full accent-[#7c5cfc]"
                  />
                  <div className="flex justify-between text-[10px] text-[#404060]"><span>1s</span><span>10s</span></div>
                </div>
                <div>
                  <label className={labelCls}>Orientation</label>
                  <div className="flex gap-1.5">
                    {(["auto", "portrait", "landscape"] as const).map(o => (
                      <button key={o} onClick={() => patchSlideEnhancement(selectedSlide.id, { orientation: o })}
                        className={`flex-1 py-1 rounded-lg text-[10px] font-medium border transition-colors capitalize ${
                          (selectedSlide.enhancementSettings?.orientation ?? "auto") === o
                            ? "bg-[#7c5cfc]/20 border-[#7c5cfc] text-[#b090ff]"
                            : "bg-[#0d0d1a] border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                        }`}>{o}</button>
                    ))}
                  </div>
                  {(selectedSlide.enhancementSettings?.orientation === "portrait") && (
                    <p className="text-[10px] text-[#7c5cfc] mt-1">️ Portrait: blur fill applied — no stretching</p>
                  )}
                </div>
              </div>

              {/* Enhancement */}
              <div className={sectionCls}>
                <div className="flex items-center justify-between">
                  <p className={sectionTitle}>Enhancement</p>
                  <button onClick={() => setShowSmartPro(v => !v)} className="text-[10px] text-[#7c5cfc] hover:text-[#9070ff] transition-colors">
                    {showSmartPro ? "Simple ▲" : "Smart Pro ▼"}
                  </button>
                </div>

                {/* Per-slide preset grid */}
                <div className="grid grid-cols-2 gap-1.5">
                  {ENHANCEMENT_PRESETS.map(ep => (
                    <button key={ep.id} type="button"
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { preset: ep.id })}
                      className={`py-1.5 px-2 rounded-lg text-[11px] font-medium border transition-colors ${
                        selectedSlide.enhancementSettings?.preset === ep.id
                          ? "border-[#7c5cfc] bg-[#7c5cfc]/15 text-[#b090ff]"
                          : "border-[#2a2a40] bg-[#0d0d1a] text-[#6060a0] hover:border-[#4a4a70]"
                      }`}
                    >{ep.label}</button>
                  ))}
                </div>

                {/* Per-slide level slider */}
                <div>
                  <label className={labelCls}>⚡ Per-slide level: {selectedSlide.enhancementSettings?.level ?? 50}</label>
                  <input
                    type="range" min={1} max={100} step={1}
                    value={selectedSlide.enhancementSettings?.level ?? 50}
                    onChange={e => patchSlideEnhancement(selectedSlide.id, { level: Number(e.target.value) })}
                    className="w-full accent-[#7c5cfc]"
                  />
                  <div className="flex justify-between text-[10px] text-[#404060]"><span>1</span><span>100</span></div>
                </div>

                {/* Smart Enhance Pro panel */}
                {showSmartPro && (
                  <div className="border border-[#2a2a40] rounded-lg p-2.5 space-y-2.5 bg-[#0d0d1a]">
                    <p className="text-[10px] text-[#7c5cfc] font-semibold uppercase tracking-wider">⚡ Smart Enhance Pro</p>
                    {(["brightness", "contrast", "saturation", "sharpen", "blur", "vignette"] as const).map(key => (
                      <div key={key}>
                        <label className="text-[10px] text-[#6060a0] capitalize">{key}: {selectedSlide.enhancementSettings?.[key] ?? 0}</label>
                        <input
                          type="range" min={-100} max={100} step={1}
                          value={selectedSlide.enhancementSettings?.[key] ?? 0}
                          onChange={e => patchSlideEnhancement(selectedSlide.id, { [key]: Number(e.target.value) })}
                          className="w-full accent-[#7c5cfc]"
                        />
                      </div>
                    ))}
                    <div>
                      <label className="text-[10px] text-[#6060a0]">Tint</label>
                      <div className="flex gap-1.5 mt-1">
                        {["none","warm","cool","golden","blue"].map(t => (
                          <button key={t} onClick={() => patchSlideEnhancement(selectedSlide.id, { tint: t })}
                            className={`flex-1 py-0.5 rounded text-[10px] border transition-colors capitalize ${(selectedSlide.enhancementSettings?.tint ?? "none") === t ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                          >{t}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6060a0]">Tone</label>
                      <div className="flex gap-1.5 mt-1">
                        {["cinematic","warm","cool","vintage"].map(t => (
                          <button key={t} onClick={() => patchSlideEnhancement(selectedSlide.id, { tone: t })}
                            className={`flex-1 py-0.5 rounded text-[10px] border transition-colors capitalize ${(selectedSlide.enhancementSettings?.tone ?? "") === t ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                          >{t}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Motion & Caption Animation */}
              <div className={sectionCls}>
                <p className={sectionTitle}>Motion & Animation</p>

                {/* Image motion */}
                <div>
                  <label className={labelCls}>️ Image Motion (Ken Burns)</label>
                  <div className="grid grid-cols-4 gap-1">
                    {MOTION_PRESETS.map(mp => (
                      <button key={mp.id} type="button"
                        onClick={() => patchSlideEnhancement(selectedSlide.id, { motionPreset: mp.id as SlideEnhancement["motionPreset"] })}
                        className={`py-1.5 px-1 rounded text-[10px] font-medium border transition-colors text-center leading-tight ${
                          (selectedSlide.enhancementSettings?.motionPreset ?? "auto") === mp.id
                            ? "border-[#7c5cfc] bg-[#7c5cfc]/15 text-[#b090ff]"
                            : "border-[#2a2a40] bg-[#0d0d1a] text-[#6060a0] hover:border-[#4a4a70]"
                        }`}
                      >{mp.label}</button>
                    ))}
                  </div>
                </div>

                {/* Caption animation */}
                <div>
                  <label className={labelCls}>✨ Caption Entry Animation</label>
                  <div className="grid grid-cols-5 gap-1">
                    {CAPTION_ANIMATIONS.map(ca => (
                      <button key={ca.id} type="button"
                        onClick={() => patchSlideEnhancement(selectedSlide.id, { captionAnimation: ca.id as SlideEnhancement["captionAnimation"] })}
                        className={`py-1.5 px-0.5 rounded text-[9px] font-medium border transition-colors text-center leading-tight ${
                          (selectedSlide.enhancementSettings?.captionAnimation ?? "fade-up") === ca.id
                            ? "border-[#7c5cfc] bg-[#7c5cfc]/15 text-[#b090ff]"
                            : "border-[#2a2a40] bg-[#0d0d1a] text-[#6060a0] hover:border-[#4a4a70]"
                        }`}
                      >{ca.label}</button>
                    ))}
                  </div>
                </div>

                {/* Font size scale */}
                <div>
                  <label className={labelCls}>
                    Caption size: {Math.round((selectedSlide.enhancementSettings?.fontSizeScale ?? 0.7) * 100)}%
                  </label>
                  <input
                    type="range" min={0.3} max={1.5} step={0.05}
                    value={selectedSlide.enhancementSettings?.fontSizeScale ?? 0.7}
                    onChange={e => patchSlideEnhancement(selectedSlide.id, { fontSizeScale: Number(e.target.value) })}
                    className="w-full accent-[#7c5cfc]"
                  />
                  <div className="flex justify-between text-[10px] text-[#404060]"><span>30%</span><span>150%</span></div>
                </div>

                {/* Show narration as subtitle */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white font-medium">Show narration on screen</p>
                    <p className="text-[10px] text-[#6060a0]">Displays narration line as subtitle text</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => patchSlideEnhancement(selectedSlide.id, { showNarration: !(selectedSlide.enhancementSettings?.showNarration) })}
                    className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${selectedSlide.enhancementSettings?.showNarration ? "bg-[#7c5cfc]" : "bg-[#2a2a40]"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${selectedSlide.enhancementSettings?.showNarration ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>

              {/* Branding */}
              <div className={`${sectionCls}`}>
                <div className="flex items-center justify-between">
                  <p className={sectionTitle}>✨ Branding overlay</p>
                  <button type="button" onClick={() => patchSlide(selectedSlide.id, { brandingEnabled: !selectedSlide.brandingEnabled })}
                    className={`w-9 h-5 rounded-full transition-colors relative ${selectedSlide.brandingEnabled ? "bg-[#7c5cfc]" : "bg-[#2a2a40]"}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${selectedSlide.brandingEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-xs text-[#404060]">Select a slide to edit</p>
            </div>
          )}

          {/* ── Character ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>Character</p>
            {assignedCharacter ? (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#0d0d1a", border: "1px solid #1e2a35", borderRadius: 10, padding: "8px 10px" }}>
                {assignedCharacter.imageUrl ? (
                  <img src={assignedCharacter.imageUrl} alt={assignedCharacter.name} style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover", border: "1px solid #1e2a35" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: "#1e2a35", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}></div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: "#dde4f0", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{assignedCharacter.name}</p>
                  <p style={{ fontSize: 10, color: "#5a7080", margin: 0 }}>{assignedCharacter.role || assignedCharacter.country || "Character"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAssignedCharacter(null)}
                  style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                >
                  Remove
                </button>
              </div>
            ) : (
              <p style={{ fontSize: 11, color: "#5a7080", margin: 0 }}>No character assigned</p>
            )}
            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
              <button
                type="button"
                onClick={() => window.location.href = "/dashboard/character-voices"}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #a855f7", background: "rgba(168,85,247,0.08)", color: "#a855f7", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.18)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(168,85,247,0.08)"; }}
              >
                + Create Character
              </button>
              <button
                type="button"
                onClick={() => setShowCharacterPicker(true)}
                style={{ flex: 1, padding: "7px 0", borderRadius: 8, border: "1px solid #22c55e", background: "rgba(34,197,94,0.08)", color: "#22c55e", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.18)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(34,197,94,0.08)"; }}
              >
                Assign Character
              </button>
            </div>
          </div>

          {/* ── Project settings ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>⚙️ Project</p>

            <div>
              <label className={labelCls}>️ Brand name</label>
              <input type="text" value={project.brandName ?? ""} onChange={async e => patchProject({ brandName: e.target.value || null })} placeholder="️ Your brand name" className={inputCls} />
            </div>

            {/* Global enhancement level */}
            <div>
              <label className={labelCls}>Global enhancement: {project.enhancementLevel ?? 50}</label>
              <input
                type="range" min={1} max={100} step={1}
                value={project.enhancementLevel ?? 50}
                onChange={e => patchProject({ enhancementLevel: Number(e.target.value) })}
                className="w-full accent-[#7c5cfc]"
              />
              <p className="text-[10px] text-[#404060] mt-0.5">Applied to all slides — override per-slide for fine control</p>
            </div>

            {/* Music selection */}
            <div>
              <label className={labelCls}>Background music</label>
              {project.musicPath ? (
                <div className="flex items-center gap-2 mt-1">
                  <div className="flex-1 min-w-0 bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-xs text-[#b090ff] truncate">
                    {project.musicPath.split(/[\\/]/).pop()}
                    {project.musicSource === "stock" && <span className="ml-1 text-[#6060a0]">(library)</span>}
                  </div>
                  <button
                    type="button"
                    onClick={handleMusicRemove}
                    className="shrink-0 px-3 py-2 rounded-lg border border-red-800/40 text-red-400 hover:bg-red-900/20 text-xs transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="flex gap-1.5 mt-1">
                  <button
                    type="button"
                    disabled={musicUploading}
                    onClick={() => musicFileRef.current?.click()}
                    className="flex-1 py-2 rounded-lg border border-dashed border-[#3a3a60] text-[#6060a0] hover:border-[#7c5cfc] hover:text-[#b090ff] text-xs transition-colors disabled:opacity-40"
                  >
                    {musicUploading ? "⏳ Uploading…" : "⬆️ Upload"}
                  </button>
                  <button
                    type="button"
                    onClick={openMusicLibrary}
                    className="flex-1 py-2 rounded-lg border border-[#3a3a60] text-[#6060a0] hover:border-[#7c5cfc] hover:text-[#b090ff] text-xs transition-colors"
                  >
                    Stock
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssetPickerOpen("music")}
                    className="flex-1 py-2 rounded-lg border border-[#7c5cfc]/30 text-[#b090ff] hover:bg-[#7c5cfc]/10 text-xs transition-colors"
                  >
                    Saved
                  </button>
                </div>
              )}
              <input
                ref={musicFileRef}
                type="file"
                accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/aac"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) { handleMusicUpload(f); e.target.value = ""; } }}
              />

              <p className="text-[8px] text-[#404060] mt-1 leading-relaxed">
                By uploading audio you confirm you own the rights, have a valid commercial license, or it is royalty-free/public domain. Copyrighted songs from Spotify, Apple Music, YouTube, or commercial platforms without a sync license are not permitted. Users are solely responsible for ensuring rights to all uploaded audio.
              </p>

              {/* Music library picker */}
              {showMusicLibrary && (
                <div className="mt-2 border border-[#2a2a40] rounded-lg bg-[#0d0d1a] p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[#7c5cfc] uppercase tracking-wider">Stock library</p>
                    <button onClick={() => setShowMusicLibrary(false)} className="text-[#6060a0] hover:text-white text-xs">✕</button>
                  </div>

                  {musicLibraryLoading ? (
                    <p className="text-[10px] text-[#6060a0]">Loading…</p>
                  ) : musicLibrary.length === 0 ? (
                    <p className="text-[10px] text-[#6060a0]">No stock tracks yet — download some below ⬇️</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {musicLibrary.map(t => {
                        const isPrev = musicPreview === t.filename;
                        return (
                        <div key={t.filename} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#2a2a40] hover:border-[#7c5cfc]/50 transition-colors">
                          <button type="button" onClick={() => setMusicPreview(isPrev ? null : t.filename)} title="Preview track"
                            className="w-6 h-6 shrink-0 rounded-full bg-[#7c5cfc]/20 text-[#b090ff] text-[11px] flex items-center justify-center hover:bg-[#7c5cfc]/35">{isPrev ? "⏸" : "▶"}</button>
                          <span className="text-[9px] px-1 py-0.5 rounded bg-[#2a2a40] text-[#6060a0] capitalize shrink-0">{t.mood}</span>
                          <button type="button" onClick={() => handleMusicFromLibrary(t.filename)} title="Use this track"
                            className="text-[11px] text-white truncate flex-1 text-left hover:text-[#b090ff]">{t.label}</button>
                          {isPrev && <audio src={`/api/media/music/stock/${t.filename}`} controls autoPlay className="h-7 shrink-0" style={{ maxWidth: 140 }} />}
                        </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Download from Pixabay */}
                  <div className="border-t border-[#2a2a40] pt-2 space-y-1.5">
                    <p className="text-[10px] text-[#6060a0]">Search Pixabay (PIXABAY_API_KEY) or paste a direct .mp3 URL :</p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={musicDownloadQuery}
                        onChange={e => setMusicDownloadQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleMusicDownload(musicDownloadQuery); }}
                        placeholder="e.g. cinematic epic  or  https://…/track.mp3"
                        className="flex-1 min-w-0 bg-[#12121e] border border-[#2a2a40] rounded px-2 py-1 text-white text-[11px] placeholder-[#3a3a55] focus:outline-none focus:border-[#7c5cfc]"
                      />
                      <button
                        onClick={() => handleMusicDownload(musicDownloadQuery)}
                        disabled={musicDownloading || !musicDownloadQuery.trim()}
                        className="shrink-0 px-3 py-1 rounded bg-[#7c5cfc]/20 border border-[#7c5cfc]/40 text-[#b090ff] text-[11px] font-medium hover:bg-[#7c5cfc]/30 disabled:opacity-40 transition-colors"
                      >
                        {musicDownloading ? "…" : "Get"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[10px] text-[#404060] mt-0.5">
                {project.musicPath ? `${project.musicSource === "uploaded" ? "Custom" : "Library"} track — mixed with narration at the volume below` : "No music selected — system will auto-generate background music"}
              </p>
            </div>

            {/* Music volume */}
            <div>
              <label className={labelCls}>Music volume: {Math.round(project.musicVolume * 100)}%</label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={project.musicVolume}
                onChange={e => patchProject({ musicVolume: Number(e.target.value) })}
                className="w-full accent-[#7c5cfc]"
              />
            </div>

            {/* Narration volume */}
            <div>
              <label className={labelCls}>Narration volume: {Math.round(project.narrationVolume * 100)}%</label>
              <input
                type="range" min={0} max={2} step={0.05}
                value={project.narrationVolume}
                onChange={e => patchProject({ narrationVolume: Number(e.target.value) })}
                className="w-full accent-[#7c5cfc]"
              />
            </div>

            {/* Total duration + auto-distribute */}
            <div>
              <label className={labelCls}>⏱️ Total commercial duration (seconds)</label>
              <input
                type="number"
                min={5} max={600} step={1}
                value={project.targetDurationSec ?? ""}
                onChange={e => {
                  const val = e.target.value ? Number(e.target.value) : null;
                  // Setting a target duration automatically enables auto-distribute
                  patchProject({ targetDurationSec: val, ...(val ? { autoDistribute: true } : {}) });
                }}
                placeholder="e.g. 30 ⏱️"
                className={inputCls}
              />
              <p className="text-[10px] text-[#404060] mt-0.5">
                ⏱️ Current: {(project.slides.reduce((a, s) => a + s.durationMs, 0) / 1000).toFixed(1)}s across {project.slides.length} slide{project.slides.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-white font-medium">⚡ Auto-distribute time</p>
                <p className="text-[10px] text-[#6060a0]">Divide total duration ✂️ evenly across slides</p>
              </div>
              <button
                type="button"
                onClick={() => patchProject({ autoDistribute: !project.autoDistribute })}
                className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${project.autoDistribute ? "bg-[#7c5cfc]" : "bg-[#2a2a40]"}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${project.autoDistribute ? "translate-x-4" : "translate-x-0.5"}`} />
              </button>
            </div>

            {/* Render Quality */}
            <div className="border border-[#2a2a40] rounded-lg p-3 space-y-2 bg-[#0a0a18]">
              <p className="text-[11px] text-white font-semibold">️ Video Quality</p>
              <p className="text-[10px] text-[#6060a0]">Higher quality = sharper image, longer render time, larger file.</p>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: "draft",    label: "⚡ Draft",    note: "Fast preview" },
                  { id: "standard", label: "Standard", note: "Good balance" },
                  { id: "high",     label: "High",     note: "Sharp + crisp" },
                  { id: "cinema",   label: "Cinema",   note: "Max quality" },
                ].map(q => (
                  <button key={q.id} type="button"
                    onClick={() => patchProject({ renderQuality: q.id })}
                    className={`py-2 px-1 rounded text-center border transition-colors ${
                      (project.renderQuality ?? "standard") === q.id
                        ? "border-[#7c5cfc] bg-[#7c5cfc]/15 text-[#b090ff]"
                        : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                    }`}
                  >
                    <div className="text-[11px] font-semibold">{q.label}</div>
                    <div className="text-[9px] text-[#404060] mt-0.5">{q.note}</div>
                  </button>
                ))}
              </div>
              <div className="text-[10px] text-[#404060] space-y-0.5">
                <p>⚡ Draft — CRF 26, fast encode</p>
                <p>Standard — CRF 20, medium (default)</p>
                <p>High — CRF 16, slow + sharpening</p>
                <p>Cinema — CRF 12, slow + strong sharpening</p>
              </div>
            </div>

            {/* Global Caption Position */}
            <div className="border border-[#2a2a40] rounded-lg p-3 space-y-2 bg-[#0a0a18]">
              <p className="text-[11px] text-white font-semibold">Caption Position — All Slides</p>
              <p className="text-[10px] text-[#6060a0]">Sets caption position on every slide at once. Overrides per-slide setting.</p>
              <div className="flex gap-1.5">
                {[
                  { id: null,       label: "Per-slide" },
                  { id: "top",      label: "⬆️ Top" },
                  { id: "center",   label: "⏺️ Center" },
                  { id: "bottom",   label: "⬇️ Bottom" },
                ].map(opt => (
                  <button key={String(opt.id)} type="button"
                    onClick={() => patchProject({ globalCaptionPosition: opt.id })}
                    className={`flex-1 py-1.5 px-1 rounded text-[10px] border transition-colors text-center ${
                      (project.globalCaptionPosition ?? null) === opt.id
                        ? "border-[#7c5cfc] bg-[#7c5cfc]/15 text-[#b090ff]"
                        : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                    }`}
                  >{opt.label}</button>
                ))}
              </div>
            </div>

            {/* Slide Transitions */}
            <div className="border border-[#2a2a40] rounded-lg p-3 space-y-2 bg-[#0a0a18]">
              <p className="text-[11px] text-white font-semibold">Slide Transitions</p>
              <p className="text-[10px] text-[#6060a0]">Effect between slides when rendering. Motion effects are controlled per-slide above.</p>
              <div className="grid grid-cols-5 gap-1">
                {TRANSITION_TYPES.map(t => (
                  <button key={t.id} type="button"
                    onClick={() => patchProject({ transitionType: t.id === "none" ? null : t.id })}
                    className={`py-1.5 px-1 rounded text-[10px] border transition-colors text-center leading-tight ${
                      (project.transitionType ?? "none") === t.id
                        ? "border-[#7c5cfc] bg-[#7c5cfc]/15 text-[#b090ff]"
                        : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                    }`}
                  >{t.label}</button>
                ))}
              </div>
              {project.transitionType && project.transitionType !== "none" && (
                <div>
                  <label className={labelCls}>⏱️ Transition duration: {(project.transitionDurationSec ?? 0.5).toFixed(1)}s</label>
                  <input
                    type="range" min={0.1} max={1.5} step={0.1}
                    value={project.transitionDurationSec ?? 0.5}
                    onChange={e => patchProject({ transitionDurationSec: Number(e.target.value) })}
                    className="w-full accent-[#7c5cfc]"
                  />
                  <div className="flex justify-between text-[10px] text-[#404060]"><span>0.1s</span><span>1.5s</span></div>
                </div>
              )}
            </div>

            {/* Caption AI limits */}
            <div className="border border-[#2a2a40] rounded-lg p-3 space-y-2 bg-[#0a0a18]">
              <p className="text-[11px] text-white font-semibold">Caption AI limits</p>
              <p className="text-[10px] text-[#6060a0]">AI generates captions up to these limits. Narration is always unlimited.</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelCls}>Max words</label>
                  <input
                    type="number" min={1} max={50}
                    value={project.captionMaxWords ?? 8}
                    onChange={e => patchProject({ captionMaxWords: Math.max(1, Math.min(50, Number(e.target.value) || 8)) })}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>Max chars (optional)</label>
                  <input
                    type="number" min={5} max={300}
                    value={project.captionMaxChars ?? ""}
                    onChange={e => patchProject({ captionMaxChars: e.target.value ? Math.max(5, Math.min(300, Number(e.target.value))) : null })}
                    placeholder="—"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>

            {/* CTA */}
            <div>
              <label className={labelCls}>CTA method</label>
              <select value={project.ctaMethod ?? ""} onChange={async e => patchProject({ ctaMethod: e.target.value || null })}
                className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                <option value="">None</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="call">Call</option>
                <option value="telegram">Telegram</option>
              </select>
            </div>

            {project.ctaMethod && (
              <>
                <div>
                  <label className={labelCls}>Primary contact</label>
                  <input type="text" value={project.ctaValue ?? ""} onChange={async e => patchProject({ ctaValue: e.target.value || null })} placeholder="+234 xxx xxxx / @handle" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Secondary contact (optional)</label>
                  <input type="text" value={project.ctaValueSecondary ?? ""} onChange={async e => patchProject({ ctaValueSecondary: e.target.value || null })} placeholder="+234 xxx xxxx" className={inputCls} />
                </div>
              </>
            )}
          </div>

          {/* ── 🎬 Intro / Outro cards — 2 ways: type a card (AI colours) OR import your own image (Henry 2026-06-20) ── */}
          <div ref={introOutroRef} style={{ border: "2px solid rgba(124,92,252,0.5)", borderRadius: 10, padding: "12px 14px", background: "linear-gradient(180deg,#17101f,#0f0f0f)" }}>
            <p className="text-sm font-bold mb-0.5" style={{ color: "#c9b6ff" }}>🎬 Intro / Outro cards</p>
            <p className="text-[10px] mb-2" style={{ color: "#5a7080" }}>Add a front (intro) or end (outro) card to your ad — two ways:</p>

            {/* WAY 1 — type a card (3 styles) */}
            <p className="text-[10px] font-semibold mb-1" style={{ color: "#b090ff" }}>① Type a card</p>
            <div className="flex gap-1 mb-1">
              {([["card", "Gradient card"], ["on_image", "On my ad image"], ["ai_banner", "AI banner"]] as const).map(([v, lbl]) => (
                <button key={v} type="button" onClick={() => setCardStyle(v)}
                  className={`flex-1 text-[9px] px-1 py-1 rounded border transition-colors ${cardStyle === v ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <p className="text-[9px] mb-2" style={{ color: "#5a7080" }}>{cardStyle === "on_image" ? "Your text prints on the FIRST ad image (intro) / LAST (outro)." : cardStyle === "ai_banner" ? "Free AI banner (no building) behind your text." : "A designed gradient card with your text."}</p>
            <input type="text" value={titleCardText} onChange={e => setTitleCardText(e.target.value)} onBlur={() => patchProject({ titleCardText })} placeholder="Intro card title (e.g. Diolux — 2 Bed Serviced Apartment)" className={inputCls} />
            <input type="text" value={titleCardSub} onChange={e => setTitleCardSub(e.target.value)} onBlur={() => patchProject({ titleCardSub })} placeholder="Subtitle (optional, e.g. Sangotedo · Ajah · Lekki)" className={`${inputCls} mt-2`} />
            <input type="text" value={outroCardText} onChange={e => setOutroCardText(e.target.value)} onBlur={() => patchProject({ outroCardText })} placeholder="Outro card text (e.g. Please call us at 0913… · Thank you)" className={`${inputCls} mt-2`} />
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <span className="text-[10px] mr-1" style={{ color: "#5a7080" }}>Colours:</span>
              {CARD_THEMES.map((t, i) => (
                <button key={t.name} type="button" onClick={() => setCardTheme(i)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${cardTheme === i ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}>
                  {t.name}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1 flex-wrap mt-2">
              <span className="text-[10px] mr-1" style={{ color: "#5a7080" }}>Font:</span>
              {["", "Georgia", "Impact", "Verdana", "Trebuchet MS", "Courier New"].map(f => (
                <button key={f || "default"} type="button" onClick={() => setCardFont(f)}
                  className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${cardFont === f ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                  style={{ fontFamily: f || undefined }}>
                  {f || "Bold"}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              {(["intro", "outro"] as const).map(kind => (
                <button key={kind} type="button" disabled={generatingTitleCard !== null || !((kind === "outro" ? (outroCardText || titleCardText) : titleCardText).trim())}
                  onClick={async () => {
                    setGeneratingTitleCard(kind);
                    try {
                      const res = await fetch(`/api/commercial/projects/${project.id}/title-card`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ text: (kind === "outro" ? (outroCardText.trim() || titleCardText) : titleCardText), subtitle: titleCardSub || undefined, kind, colors: CARD_THEMES[cardTheme].colors ?? undefined, font: cardFont || undefined, style: cardStyle }),
                      });
                      const data = await res.json().catch(() => ({})) as { slide?: (typeof project.slides)[number] };
                      if (res.ok && data.slide) {
                        const newSlide = data.slide;
                        setProject(prev => {
                          let slides = [...prev.slides];
                          if (kind === "intro") { slides = slides.map(s => ({ ...s, slideOrder: (s.slideOrder ?? 0) + 1 })); slides.unshift(newSlide); }
                          else slides.push(newSlide);
                          return { ...prev, slides };
                        });
                        setSelectedId(newSlide.id);
                      }
                    } catch { /* ignore */ }
                    setGeneratingTitleCard(null);
                  }}
                  className="flex-1 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: "rgba(124,92,252,0.18)", color: "#b090ff", border: "1px solid rgba(124,92,252,0.4)" }}>
                  {generatingTitleCard === kind ? "Making card…" : `+ ${kind === "intro" ? "Intro" : "Outro"} card`}
                </button>
              ))}
            </div>

            {/* WAY 2 — import your own image */}
            <p className="text-[10px] font-semibold mt-3 mb-1" style={{ color: "#b090ff" }}>② Import your own image (from PC)</p>
            <input ref={cardImportRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={async e => {
                const f = e.target.files?.[0]; e.target.value = "";
                const k = importKind;
                if (!f || !k) return;
                setGeneratingTitleCard(k);
                try {
                  const fd = new FormData(); fd.append("file", f); fd.append("kind", k);
                  const res = await fetch(`/api/commercial/projects/${project.id}/title-card`, { method: "POST", body: fd });
                  const data = await res.json().catch(() => ({})) as { slide?: (typeof project.slides)[number] };
                  if (res.ok && data.slide) {
                    const ns = data.slide;
                    setProject(prev => { let slides = [...prev.slides]; if (k === "intro") { slides = slides.map(s => ({ ...s, slideOrder: (s.slideOrder ?? 0) + 1 })); slides.unshift(ns); } else slides.push(ns); return { ...prev, slides }; });
                    setSelectedId(ns.id);
                  }
                } catch { /* ignore */ }
                setGeneratingTitleCard(null);
              }} />
            <div className="flex gap-2 mt-1">
              {(["intro", "outro"] as const).map(kind => (
                <button key={kind} type="button" disabled={generatingTitleCard !== null}
                  onClick={() => { setImportKind(kind); cardImportRef.current?.click(); }}
                  className="flex-1 text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-40"
                  style={{ background: "rgba(255,255,255,0.04)", color: "#c0c0e0", border: "1px solid #2a2a40" }}>
                  ⬆ Import {kind === "intro" ? "Intro" : "Outro"} image
                </button>
              ))}
            </div>
          </div>

          {/* ── AI Order — full narration with intro/outro contact ── */}
          <div style={{ border: "1px solid rgba(255,107,53,0.2)", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold" style={{ color: "#ff6b35" }}>AI Order — Full Narration</p>
              <button
                type="button"
                disabled={aiOrdering || project.slides.length === 0}
                onClick={async () => {
                  setAiOrdering(true);
                  setNarrationEnhanceError(null);
                  try {
                    // Step 1: get image URLs from slides
                    const imageUrls = project.slides
                      .filter(s => s.imagePath)
                      .map(s => {
                        const rel = (s.imagePath as string).replace(/\\/g, "/").replace(/^.*?storage\//, "");
                        return `/api/media/${rel}`;
                      });
                    // Step 2: call enhance-narration with image context in payload
                    const res = await fetch(`/api/commercial/projects/${project.id}/enhance-narration`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageUrls, includeImages: true, productInfo: productInfo.trim() || undefined }),
                    });
                    if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
                      const txt = await res.text();
                      setNarrationEnhanceError(`AI Order failed: ${txt.slice(0, 200)}`);
                      setAiOrdering(false);
                      return;
                    }
                    const data = await res.json() as { narration?: string; error?: string };
                    if (data.error) { setNarrationEnhanceError(data.error); setAiOrdering(false); return; }
                    if (data.narration) {
                      // Intelligent ordering: intro first, content in the middle, contact+outro LAST.
                      const { fullNarration, lines } = buildOrderedNarration({ content: data.narration, introText, outroText, phone: introPhone, whatsapp: introWhatsapp, website: introWebsite, slideCount: project.slides.length });
                      await patchProject({ narrationScript: fullNarration });
                      for (let i = 0; i < project.slides.length; i++) {
                        await patchSlide(project.slides[i].id, { narrationLine: lines[i] });
                      }
                    } else {
                      setNarrationEnhanceError("AI Order returned no narration. Add slide content first.");
                    }
                  } catch (err) {
                    setNarrationEnhanceError(err instanceof Error ? err.message : "AI Order failed");
                  }
                  setAiOrdering(false);
                }}
                className="text-[10px] font-semibold px-3 py-1 rounded-lg transition-colors disabled:opacity-40"
                style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.3)" }}
              >
                {aiOrdering ? "Ordering..." : "AI Order"}
              </button>
            </div>
            <p className="text-[10px] mb-2" style={{ color: "#5a7080" }}>
              AI reads all slide images + captions, generates narration, and wraps with your intro/outro contact info.
            </p>
            {/* ONE button: AI reads every uploaded image → writes a caption ON each → narration for the whole ad (Henry 2026-06-20) */}
            <button
              type="button"
              disabled={captioningAll || aiOrdering || project.slides.length === 0}
              onClick={async () => {
                setCaptioningAll(true);
                setNarrationEnhanceError(null);
                try {
                  // 1) Caption EVERY image — PARALLEL + fast cloud vision (seconds, not minutes)
                  await Promise.all(project.slides.filter(s => s.imagePath).map(async s => {
                    try {
                      const r = await fetch(`/api/commercial/projects/${project.id}/slides/${s.id}/review-caption?fast=1`, { method: "POST" });
                      const d = await r.json().catch(() => ({} as { caption?: string }));
                      if (r.ok && d.caption) {
                        await patchSlide(s.id, { captionOriginal: d.caption, captionApproved: false } as never);
                        setProject(prev => ({ ...prev, slides: prev.slides.map(x => x.id === s.id ? { ...x, captionOriginal: d.caption!, captionApproved: false } : x) }));
                      }
                    } catch { /* skip */ }
                  }));
                  // 2) Narration for ALL images (reuses enhance-narration + intro/outro contact)
                  const imageUrls = project.slides.filter(s => s.imagePath).map(s => `/api/media/${(s.imagePath as string).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`);
                  const res = await fetch(`/api/commercial/projects/${project.id}/enhance-narration`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ imageUrls, includeImages: true, productInfo: productInfo.trim() || undefined }),
                  });
                  const data = await res.json().catch(() => ({} as { narration?: string; error?: string }));
                  if (res.ok && data.narration) {
                    // Same intelligent ordering as AI Order: intro first, contact+outro LAST.
                    const { fullNarration, lines } = buildOrderedNarration({ content: data.narration, introText, outroText, phone: introPhone, whatsapp: introWhatsapp, website: introWebsite, slideCount: project.slides.length });
                    await patchProject({ narrationScript: fullNarration });
                    for (let i = 0; i < project.slides.length; i++) {
                      await patchSlide(project.slides[i].id, { narrationLine: lines[i] });
                    }
                  } else {
                    setNarrationEnhanceError(data.error || "Narration step failed — captions still saved.");
                  }
                } catch (err) {
                  setNarrationEnhanceError(err instanceof Error ? err.message : "Caption + Narrate failed");
                }
                setCaptioningAll(false);
              }}
              className="w-full mb-2 text-[11px] font-bold px-3 py-2 rounded-lg transition-colors disabled:opacity-40"
              style={{ background: "rgba(124,92,252,0.18)", color: "#b090ff", border: "1px solid rgba(124,92,252,0.45)" }}
            >
              {captioningAll ? "Reading every image…" : "✨ AI: Caption every image + Narrate all"}
            </button>
            <div className="mb-2">
              <label className={labelCls}>Product / property details (name · type · specs · location)</label>
              <textarea value={productInfo} onChange={e => setProductInfo(e.target.value)} onBlur={() => patchProject({ productInfo })} rows={2}
                placeholder="e.g. Diolux Serviced Apartments · 2-bed apartment · furnished, 24/7 power · Sangotedo, Ajah, Lekki"
                className={inputCls} style={{ resize: "vertical" }} />
              <p className="text-[9px] mt-0.5" style={{ color: "#5a7080" }}>AI Order uses these facts (says the real type like 2-bed apartment, not a guess like duplex).</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <div>
                <label className={labelCls}>Phone number</label>
                <input type="text" value={introPhone} onChange={e => setIntroPhone(e.target.value)} onBlur={() => patchProject({ introPhone })} placeholder="+234 xxx xxxx" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>WhatsApp number</label>
                <input type="text" value={introWhatsapp} onChange={e => setIntroWhatsapp(e.target.value)} onBlur={() => patchProject({ introWhatsapp })} placeholder="+234 xxx xxxx" className={inputCls} />
              </div>
            </div>
            <div className="mb-2">
              <label className={labelCls}>Website / Maps link (optional)</label>
              <input type="text" value={introWebsite} onChange={e => setIntroWebsite(e.target.value)} onBlur={() => patchProject({ introWebsite })} placeholder="e.g. diolux.com or goo.gl/maps/…" className={inputCls} />
            </div>
            <div className="mb-2">
              <label className={labelCls}>Intro text (before narration)</label>
              <input type="text" value={introText} onChange={e => setIntroText(e.target.value)} onBlur={() => patchProject({ introText })} placeholder="e.g. Welcome! Check out our new product." className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Outro text (after narration)</label>
              <input type="text" value={outroText} onChange={e => setOutroText(e.target.value)} onBlur={() => patchProject({ outroText })} placeholder="e.g. Don't miss this offer. Contact us today!" className={inputCls} />
            </div>
          </div>

          {/* Narration script preview + enhance button */}
          <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-[#b090ff]">Narration script</p>
              <button
                type="button"
                disabled={enhancingNarration || project.slides.length === 0}
                onClick={async () => {
                  setEnhancingNarration(true);
                  setNarrationEnhanceError(null);
                  try {
                    const res = await fetch(`/api/commercial/projects/${project.id}/enhance-narration`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productInfo: productInfo.trim() || undefined }) });
                    if (!res.ok || !res.headers.get("content-type")?.includes("json")) {
                      const txt = await res.text();
                      setNarrationEnhanceError(`Narration enhance failed: ${txt.slice(0, 200)}`);
                      setEnhancingNarration(false);
                      return;
                    }
                    const data = await res.json() as { narration?: string; error?: string; provider?: string };
                    if (data.error) { setNarrationEnhanceError(data.error); setEnhancingNarration(false); return; }
                    if (data.narration) {
                      // Intelligent ordering: intro first, content middle, contact+outro LAST.
                      const { fullNarration, lines } = buildOrderedNarration({ content: data.narration, introText, outroText, phone: introPhone, whatsapp: introWhatsapp, website: introWebsite, slideCount: project.slides.length });
                      await patchProject({ narrationScript: fullNarration });
                      for (let i = 0; i < project.slides.length; i++) {
                        await patchSlide(project.slides[i].id, { narrationLine: lines[i] });
                      }
                    } else {
                      setNarrationEnhanceError("No narration returned. Add captions or slide content first.");
                    }
                  } catch (err) {
                    setNarrationEnhanceError(err instanceof Error ? err.message : "Enhance narration failed");
                  }
                  setEnhancingNarration(false);
                }}
                className="text-[10px] font-medium px-3 py-1 rounded-lg bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/30 disabled:opacity-40 transition-colors"
              >
                {enhancingNarration ? "Generating..." : "✨ Enhance Narration"}
              </button>
            </div>
            <p className="text-[10px] text-[#6060a0] mb-2">AI reads all slides, captions, and your ad title to write a cohesive voiceover. Edit per-slide narration lines above.</p>
            {narrationEnhanceError && (
              <div className="flex items-start justify-between gap-2 border border-orange-800/40 rounded-lg p-2 bg-orange-950/20 mb-2">
                <p className="text-[10px] text-orange-300/80">{narrationEnhanceError}</p>
                <button onClick={() => setNarrationEnhanceError(null)} className="text-[#6060a0] hover:text-white text-xs shrink-0">✕</button>
              </div>
            )}
            <textarea
              value={editScript ?? narrationScriptLines.join("\n")}
              onChange={e => setEditScript(e.target.value)}
              rows={10}
              placeholder="Write your OWN narration here (or click ✨ Enhance Narration), then Apply. Tip: keep [Slide N] labels to map a line to a slide; plain text is spread evenly."
              className="w-full text-xs text-[#c0c0e0] leading-snug rounded-lg bg-[#0d0d1a] border border-[#2a2a40] px-2 py-2"
              style={{ resize: "vertical", fontFamily: "inherit" }}
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button type="button" disabled={editScript === null}
                onClick={async () => {
                  const txt = editScript ?? "";
                  const perSlide: Record<number, string> = {};
                  const re = /\[Slide\s+(\d+)\]\s*([\s\S]*?)(?=\[Slide\s+\d+\]|$)/gi;
                  let mt: RegExpExecArray | null; let any = false;
                  while ((mt = re.exec(txt)) !== null) { perSlide[parseInt(mt[1], 10) - 1] = (mt[2] || "").trim(); any = true; }
                  if (!any) {
                    // No [Slide N] labels → treat as free MANUAL narration: spread the prose across slides evenly.
                    const sents = txt.split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(Boolean);
                    const n = project.slides.length;
                    if (!n || !sents.length) { setNarrationEnhanceError("Type some narration first."); return; }
                    const per = Math.max(1, Math.ceil(sents.length / n));
                    for (let i = 0; i < n; i++) perSlide[i] = sents.slice(i * per, (i + 1) * per).join(" ");
                  }
                  for (let i = 0; i < project.slides.length; i++) {
                    if (perSlide[i] !== undefined) await patchSlide(project.slides[i].id, { narrationLine: perSlide[i] } as never);
                  }
                  setProject(prev => ({ ...prev, slides: prev.slides.map((s, i) => perSlide[i] !== undefined ? { ...s, narrationLine: perSlide[i] } : s) }));
                  await patchProject({ narrationScript: project.slides.map((_, i) => perSlide[i] ?? "").filter(Boolean).join(" ") });
                  setEditScript(null);
                }}
                className="text-[10px] font-semibold px-3 py-1 rounded-lg bg-[#22c55e]/15 text-[#4ade80] border border-[#22c55e]/30 hover:bg-[#22c55e]/30 disabled:opacity-40 transition-colors">
                ✓ Apply edits
              </button>
              {editScript !== null && <button type="button" onClick={() => setEditScript(null)} className="text-[10px] text-[#6060a0] hover:text-white">Cancel</button>}
              <span className="text-[9px] text-[#5a7080]">Type your own OR edit the AI's. [Slide N] labels map a line to that slide; plain text spreads evenly. Then Apply.</span>
            </div>
          </div>

          {/* Narrator engine selector (Henry: one dropdown → pick model → that model's voices appear) */}
          <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
            <p className="text-xs font-semibold text-[#b090ff] mb-2">Narrator engine</p>
            <select value={voiceEngine} onChange={e => setVoiceEngine(e.target.value as typeof voiceEngine)}
              className="w-full text-xs rounded-lg bg-[#0d0d1a] border border-[#2a2a40] text-[#c0c0e0] px-2 py-1.5">
              <option value="auto">Auto — best available (default)</option>
              <option value="piper">Local · Piper (free)</option>
              <option value="edge">Edge · Microsoft (free)</option>
              <option value="elevenlabs">Premium · ElevenLabs</option>
            </select>
          </div>

          {/* Piper TTS local voice picker */}
          {(voiceEngine === "auto" || voiceEngine === "piper") && (
          <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
            <p className="text-xs font-semibold text-[#b090ff] mb-2">Local Voice (Piper TTS — free)</p>
            <p className="text-[10px] text-[#6060a0] mb-3">Select a voice for narration. Works offline, no API key needed. Falls back here when ElevenLabs is unavailable.</p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {piperVoices.map(v => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => setSelectedPiperVoice(v.id)}
                  className={`text-left p-2 rounded-lg border text-[11px] transition-colors ${
                    selectedPiperVoice === v.id
                      ? "border-[#7c5cfc] bg-[#7c5cfc]/10 text-[#b090ff]"
                      : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                  }`}
                >
                  <span className="font-medium">{v.name}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <button
                type="button"
                disabled={piperDemoLoading}
                onClick={async () => {
                  setPiperDemoLoading(true);
                  setPiperDemoUrl(null);
                  try {
                    const demoText = narrationScriptLines.length > 0
                      ? narrationScriptLines[0].replace(/^\[Slide \d+\]\s*/, "").slice(0, 150)
                      : "Welcome to our premium property. This spacious apartment features elegant finishes.";
                    const res = await fetch("/api/voices/piper-preview", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ text: demoText, voiceId: selectedPiperVoice }),
                    });
                    if (res.ok) {
                      const blob = await res.blob();
                      setPiperDemoUrl(URL.createObjectURL(blob));
                    }
                  } catch { /* ignore */ }
                  setPiperDemoLoading(false);
                }}
                className="text-[10px] font-medium px-3 py-1.5 rounded-lg bg-green-900/30 border border-green-700/40 text-green-400 hover:bg-green-900/50 disabled:opacity-40 transition-colors"
              >
                {piperDemoLoading ? "Generating..." : "▶ Preview Voice"}
              </button>
              {piperDemoUrl && (
                <audio controls src={piperDemoUrl} className="h-8 flex-1" style={{ maxWidth: 250 }} />
              )}
            </div>
          </div>
          )}

          {/* Edge TTS voices (free Microsoft neural voices) */}
          {voiceEngine === "edge" && (
            <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
              <p className="text-xs font-semibold text-[#b090ff] mb-2">Edge Voice (Microsoft — free)</p>
              <p className="text-[10px] text-[#6060a0] mb-3">Free high-quality neural voices, used at render when selected.</p>
              <div className="grid grid-cols-2 gap-2">
                {EDGE_VOICES.map(v => (
                  <button key={v.id} type="button" onClick={() => setSelectedEdgeVoice(v.id)}
                    className={`text-left p-2 rounded-lg border text-[11px] transition-colors ${selectedEdgeVoice === v.id ? "border-[#7c5cfc] bg-[#7c5cfc]/10 text-[#b090ff]" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}>
                    <span className="font-medium">{v.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ElevenLabs premium voice picker — each is a specific named narrator (Henry: let users pick the voice). Selecting sets project.voiceId, which the render already uses for ElevenLabs. */}
          {voiceEngine === "elevenlabs" && elevenVoices.length > 0 && (
            <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
              <p className="text-xs font-semibold text-[#b090ff] mb-2">Premium Voice (ElevenLabs — pick a narrator)</p>
              <p className="text-[10px] text-[#6060a0] mb-3">Specific premium narrators, used at render when ElevenLabs is available (needs API quota). Falls back to Piper otherwise.</p>
              <div className="grid grid-cols-2 gap-2 max-h-48 overflow-auto">
                {elevenVoices.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => { setProject(prev => ({ ...prev, voiceId: v.id })); patchProject({ voiceId: v.id }); }}
                    className={`text-left p-2 rounded-lg border text-[11px] transition-colors ${
                      project.voiceId === v.id
                        ? "border-[#7c5cfc] bg-[#7c5cfc]/10 text-[#b090ff]"
                        : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                    }`}
                  >
                    <span className="font-medium">{v.name}</span>
                    {(v.accent || v.category) && <span className="block text-[9px] text-[#6060a0]">{[v.category, v.accent].filter(Boolean).join(" · ")}</span>}
                  </button>
                ))}
              </div>
            </div>
          )}

          <NarrationPanel
            value={narrationSettings}
            onChange={setNarrationSettings}
            narrationEnabled={narrationEnabled}
            onNarrationEnabledChange={setNarrationEnabled}
          />

          {renderStatus === "done" && project.contentItemId ? (
            <OverlayPanel
              videoPath={mergedVideoPath}
              contentItemId={project.contentItemId}
              layers={overlayLayers}
              onChange={setOverlayLayers}
              onApplied={() => {}}
            />
          ) : (
            <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#4a4a6a", margin: 0 }}>️ Text & Image Overlays</p>
              <p style={{ fontSize: 11, color: "#3a3a55", marginTop: 4 }}>
                {renderStatus === "rendering" ? "⏳ Overlay available after render completes…" : "Render the project first to unlock overlays."}
              </p>
            </div>
          )}

          {/* ── SC: 5-Tier Sound Model Selector (binding) ── */}
          <div style={{ border: "1px solid #2a2a40", borderRadius: 8, background: "#0f0f0f", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", margin: 0 }}>Sound Model</h3>
              <span style={{ fontSize: 9, color: "#5a5a8a", fontWeight: 700, letterSpacing: 0.8 }}>
                {SOUND_TIERS_COMM.find(t => t.id === soundTier)?.badge || "ACTIVE"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {SOUND_TIERS_COMM.map((tier, idx) => {
                const active = soundTier === tier.id;
                return (
                  <button
                    key={tier.id}
                    onClick={() => { setSoundTier(tier.id); setModelSettings(p => ({ ...p, soundModel: tier.id })); }}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 7, cursor: "pointer", border: "none",
                      background: active ? "rgba(124,92,252,0.15)" : "rgba(255,255,255,0.03)",
                      outline: active ? "1.5px solid rgba(124,92,252,0.5)" : "1px solid rgba(255,255,255,0.06)",
                      transition: "all 0.15s",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                      <span style={{ fontSize: 10, color: active ? "#b090ff" : "#5a5a8a", fontWeight: 700, minWidth: 14 }}>{idx + 1}</span>
                      <span>
                        <span style={{ fontSize: 11, fontWeight: 700, color: active ? "#e0d0ff" : "#c0c0d0", display: "block" }}>{tier.label}</span>
                        <span style={{ fontSize: 9, color: "#5a5a8a" }}>{tier.subtitle}</span>
                      </span>
                    </span>
                    <span style={{
                      fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: 4,
                      background: active ? "rgba(124,92,252,0.25)" : "rgba(255,255,255,0.05)",
                      color: active ? "#b090ff" : "#5a5a8a",
                    }}>{tier.cost}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── SD: Model Settings Panel ── */}
          <div style={{ border: "1px solid #2a2a40", borderRadius: 8, background: "#0f0f0f", padding: "12px 14px" }}>
            <button
              onClick={() => setShowModelSettings(p => !p)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", margin: 0 }}>Model Settings</h3>
              <span style={{ fontSize: 10, color: "#5a5a8a" }}>{showModelSettings ? "▲" : "▼"}</span>
            </button>
            {showModelSettings && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                {/* Story LLM */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 800, color: "#5a5a8a", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Story LLM</label>
                  <select value={modelSettings.storyLLM} onChange={e => setModelSettings(p => ({ ...p, storyLLM: e.target.value }))}
                    style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2a40", color: "#c0c0d0", borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>
                    <option value="claude-haiku-4-5">Haiku 4.5</option>
                    <option value="claude-sonnet-4-5">Sonnet 4.5</option>
                    <option value="claude-opus-4-5">Opus 4.5</option>
                    <option value="gpt-4o-mini">GPT Mini</option>
                    <option value="gpt-4o">GPT-4o</option>
                  </select>
                </div>
                {/* Character Image */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 800, color: "#5a5a8a", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Char Image</label>
                  <select value={modelSettings.charImageModel} onChange={e => setModelSettings(p => ({ ...p, charImageModel: e.target.value }))}
                    style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2a40", color: "#c0c0d0", borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>
                    <option value="fal_flux_schnell">FLUX Schnell</option>
                    <option value="fal_flux_dev">FLUX Dev</option>
                    <option value="pruna_flux">Pruna FLUX</option>
                  </select>
                </div>
                {/* Scene Video */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 800, color: "#5a5a8a", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Scene Video</label>
                  <select value={modelSettings.sceneVideoModel} onChange={e => setModelSettings(p => ({ ...p, sceneVideoModel: e.target.value }))}
                    style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2a40", color: "#c0c0d0", borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>
                    <option value="kling_1_6_standard">Kling 1.6</option>
                    <option value="kling_2_5_pro">Kling 2.5 Pro</option>
                    <option value="runway_gen4">Runway Gen-4</option>
                    <option value="veo2">Veo 2</option>
                    <option value="wan_2_5">Wan 2.5</option>
                  </select>
                </div>
                {/* Sound/SFX */}
                <div>
                  <label style={{ fontSize: 9, fontWeight: 800, color: "#5a5a8a", textTransform: "uppercase", letterSpacing: 0.8, display: "block", marginBottom: 4 }}>Sound/SFX</label>
                  <select value={soundTier} onChange={e => { const v = e.target.value as SoundTierCommId; setSoundTier(v); setModelSettings(p => ({ ...p, soundModel: v })); }}
                    style={{ width: "100%", background: "#0d0d1a", border: "1px solid #2a2a40", color: "#c0c0d0", borderRadius: 6, padding: "5px 8px", fontSize: 11 }}>
                    {SOUND_TIERS_COMM.map(t => <option key={t.id} value={t.id}>{t.label} ({t.cost})</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* SFX Library */}
          <div style={{ border: "1px solid #2a2a40", borderRadius: 8, background: "#0f0f0f", padding: "12px 14px" }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: "#e5e5e5", marginBottom: 6 }}>Sound Effects</h3>
            <SFXPicker compact onSelect={(event) => { console.log(`[Commercial SFX] ${event}`); }} />
          </div>

          <div className="text-center text-[11px] text-[#404060] pb-2">
            {readyCount === project.slides.length && project.slides.length > 0
              ? <span className="text-green-500">✅ All {project.slides.length} slides ready to render!</span>
              : <span>️ {readyCount} of {project.slides.length} slides ready</span>
            }
            {readyCount === 0 && <p>Upload at least one image to render</p>}
          </div>
        </div>
      </div>

      {/* Asset Picker Modal */}
      <AssetPicker
        type={assetPickerOpen ?? "image"}
        open={!!assetPickerOpen}
        onClose={() => setAssetPickerOpen(null)}
        onSelect={async (asset) => {
          if (assetPickerOpen === "image" && selectedSlide) {
            // Set picked image as slide image via DB update
            try {
              const { PrismaClient } = await import("@prisma/client");
              // Use API to update slide image path
              await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imagePath: null }),
              });
              // Reload project to get updated slides
              const res = await fetch(`/api/commercial/projects/${project.id}`);
              const data = await res.json();
              if (data.slides) setProject(prev => ({ ...prev, slides: data.slides }));
            } catch { /* ignore */ }
          } else if (assetPickerOpen === "music") {
            // Set picked music as project music
            patchProject({ musicPath: asset.filePath, musicSource: "library" });
          }
          setAssetPickerOpen(null);
        }}
        title={assetPickerOpen === "image" ? "Pick image for slide" : "Pick music track"}
      />

      {/* Layerize Text Panel */}
      {layerizeResult && (
        <LayerizePanel
          result={layerizeResult}
          onClose={() => setLayerizeResult(null)}
          onSaved={() => setLayerizeResult(null)}
        />
      )}

      {/* Character Picker Modal */}
      {showCharacterPicker && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.82)" }}
          onClick={e => { if (e.target === e.currentTarget) setShowCharacterPicker(false); }}
        >
          <div style={{ width: "100%", maxWidth: 640, maxHeight: "80vh", overflow: "auto", borderRadius: 16, border: "1px solid #1e2a35", background: "#0b0e18", padding: 20, position: "relative" }}>
            <button
              type="button"
              onClick={() => setShowCharacterPicker(false)}
              style={{ position: "absolute", top: 12, right: 14, background: "none", border: "none", color: "#5a7080", fontSize: 18, cursor: "pointer", lineHeight: 1 }}
            >
              ✕
            </button>
            <p style={{ fontSize: 14, fontWeight: 700, color: "#dde4f0", marginBottom: 12 }}>Assign Character</p>
            <CharacterPicker
              onSelect={(character) => { setAssignedCharacter(character); setShowCharacterPicker(false); }}
              onCreateNew={() => { window.location.href = "/dashboard/character-voices"; }}
              selectedId={assignedCharacter?.id}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── AI Video Commercial — Product image → AI video ad ─────────────────────────

const VIDEO_MODELS = [
  { id: "kling3-pro", name: "Kling 3.0 Pro", cost: "4 credits", speed: "2-4 min", quality: "Best", best: "Cinematic product shots" },
  { id: "kling2", name: "Kling 2.0", cost: "2 credits", speed: "1-2 min", quality: "Good", best: "Quick product ads" },
  { id: "hailuo-pro", name: "Hailuo 2.3 Pro", cost: "3 credits", speed: "2-3 min", quality: "High", best: "Creative animation" },
  { id: "hailuo-fast", name: "Hailuo 2.3 Fast", cost: "1 credit", speed: "30-60s", quality: "Draft", best: "Fast previews" },
  { id: "seedance", name: "SeeDance 2.0", cost: "2 credits", speed: "1-2 min", quality: "High", best: "Motion + dance" },
  { id: "wan25", name: "Wan 2.5", cost: "1 credit", speed: "1-2 min", quality: "Good", best: "Budget option" },
];

// ── Scene blueprint type for the 4-step wizard ──
interface CommercialScene {
  id: string;
  purpose: string;        // e.g. "Hook", "Features", "Price", "CTA", "Location"
  prompt: string;
  approved: boolean;
}

function AiVideoCommercial({ onBack }: { onBack: () => void }) {
  const [productImage, setProductImage] = useState<File | null>(null);
  const [productImageUrl, setProductImageUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] = useState("");
  const [tagline, setTagline] = useState("");
  const [ctaText, setCtaText] = useState("Order Now");
  const [whatsapp, setWhatsapp] = useState("");
  const [price, setPrice] = useState("");
  const [selectedModel, setSelectedModel] = useState("kling2");
  const [generating, setGenerating] = useState(false);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [step, setStepRaw] = useState<1 | 2 | 3 | 4>(1);
  // Product identity details
  const [identityLocked, setIdentityLocked] = useState(false);
  const [flavorVariant, setFlavorVariant] = useState("");
  const [packSize, setPackSize] = useState("");
  const [brandColors, setBrandColors] = useState("");
  const [brandColorSwatch1, setBrandColorSwatch1] = useState("#ff0000");
  const [brandColorSwatch2, setBrandColorSwatch2] = useState("#ffd700");
  const [brandStyle, setBrandStyle] = useState("");
  const [allowedClaims, setAllowedClaims] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [videoGenError, setVideoGenError] = useState<string | null>(null);

  // Step 2: AI-planned scenes
  const [plannedScenes, setPlannedScenes] = useState<CommercialScene[]>([]);
  const [planning, setPlanning] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);

  // Step 4: Per-scene generation progress
  const [sceneProgress, setSceneProgress] = useState<Record<string, "pending" | "generating" | "done" | "error">>({});
  const [sceneOutputs, setSceneOutputs] = useState<Record<string, string>>({});

  function setStep(s: 1 | 2 | 3 | 4) {
    if (s !== 1 && step === 1) window.history.pushState({ commercialVideoStep: s }, "", window.location.pathname);
    setStepRaw(s);
  }

  useEffect(() => {
    function handlePop() { setStepRaw(1); }
    window.addEventListener("popstate", handlePop);
    return () => window.removeEventListener("popstate", handlePop);
  }, []);

  const handleUpload = async (file: File) => {
    setProductImage(file);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
      const data = await safeJson<{ url?: string }>(res, "commercial-mode3-upload");
      if (data.url) setProductImageUrl(data.url);
    } catch { /* upload failed — preview-only mode */ }
  };

  // Step 2: AI Planning — generate scene blueprints
  const handlePlanScenes = async () => {
    setPlanning(true);
    setPlanError(null);
    try {
      const res = await fetch("/api/commercial/plan-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          productCategory,
          tagline,
          price,
          ctaText,
          flavorVariant,
          packSize,
          brandColors,
          brandStyle,
          allowedClaims,
        }),
      });

      let data: { scenes?: Array<{ purpose: string; prompt: string }>; error?: string; raw?: string };
      try {
        data = await safeJson<typeof data>(res, "commercial-mode3-plan");
      } catch (parseErr) {
        const reason = parseErr instanceof Error ? parseErr.message : String(parseErr);
        console.error("[commercial-plan-scenes] parse error:", reason);
        setPlanError(`Scene planning failed: ${reason}. Using default scenes.`);
        setPlanning(false);
        const defaultScenes: CommercialScene[] = [
          { id: `scene_0_${Date.now()}`, purpose: "Hook", prompt: `Eye-catching opening shot of ${productName || "product"} with dramatic lighting, slow zoom in, premium feel.`, approved: true },
          { id: `scene_1_${Date.now()}`, purpose: "Features", prompt: `Close-up detail shots of ${productName || "product"} features, smooth camera rotation, highlighting quality and craftsmanship.`, approved: true },
          { id: `scene_2_${Date.now()}`, purpose: "Price Reveal", prompt: `Clean slate reveal showing ${productName || "product"} with price ${price || ""}, elegant typography animation, brand colors.`, approved: true },
          { id: `scene_3_${Date.now()}`, purpose: "CTA", prompt: `Final call to action shot: "${ctaText}" with ${productName || "product"} center frame, ${whatsapp ? "WhatsApp contact visible" : "contact info overlay"}, urgency feel.`, approved: true },
          { id: `scene_4_${Date.now()}`, purpose: "Location/Lifestyle", prompt: `Lifestyle shot showing ${productName || "product"} being used/enjoyed in real-world setting, warm tones, aspirational mood.`, approved: true },
        ];
        setPlannedScenes(defaultScenes);
        setStep(3);
        return;
      }

      if (data.error || !data.scenes?.length) {
        const reason = data.error ?? "No scenes returned";
        console.error("[commercial-plan-scenes] API error:", reason, data.raw ?? "");
        setPlanError(`AI planning returned an error: ${reason}. Using default scenes.`);
        const defaultScenes: CommercialScene[] = [
          { id: `scene_0_${Date.now()}`, purpose: "Hook", prompt: `Eye-catching opening shot of ${productName || "product"} with dramatic lighting, slow zoom in, premium feel.`, approved: true },
          { id: `scene_1_${Date.now()}`, purpose: "Features", prompt: `Close-up detail shots of ${productName || "product"} features, smooth camera rotation, highlighting quality and craftsmanship.`, approved: true },
          { id: `scene_2_${Date.now()}`, purpose: "Price Reveal", prompt: `Clean slate reveal showing ${productName || "product"} with price ${price || ""}, elegant typography animation, brand colors.`, approved: true },
          { id: `scene_3_${Date.now()}`, purpose: "CTA", prompt: `Final call to action shot: "${ctaText}" with ${productName || "product"} center frame, ${whatsapp ? "WhatsApp contact visible" : "contact info overlay"}, urgency feel.`, approved: true },
          { id: `scene_4_${Date.now()}`, purpose: "Location/Lifestyle", prompt: `Lifestyle shot showing ${productName || "product"} being used/enjoyed in real-world setting, warm tones, aspirational mood.`, approved: true },
        ];
        setPlannedScenes(defaultScenes);
        setStep(3);
        setPlanning(false);
        return;
      }

      const scenes: CommercialScene[] = data.scenes.map((s, i) => ({
        id: `scene_${i}_${Date.now()}`,
        purpose: s.purpose || `Scene ${i + 1}`,
        prompt: s.prompt || "",
        approved: true,
      }));
      setPlannedScenes(scenes);
      setStep(3);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.error("[commercial-plan-scenes] network error:", reason);
      setPlanError(`Scene planning failed: ${reason}. Using default scenes.`);
      const defaultScenes: CommercialScene[] = [
        { id: `scene_0_${Date.now()}`, purpose: "Hook", prompt: `Eye-catching opening shot of ${productName || "product"} with dramatic lighting.`, approved: true },
        { id: `scene_1_${Date.now()}`, purpose: "Features", prompt: `Close-up detail shots of ${productName || "product"} features.`, approved: true },
        { id: `scene_2_${Date.now()}`, purpose: "Price Reveal", prompt: `Price reveal for ${productName || "product"}: ${price || "TBD"}.`, approved: true },
        { id: `scene_3_${Date.now()}`, purpose: "CTA", prompt: `Call to action: "${ctaText}" for ${productName || "product"}.`, approved: true },
        { id: `scene_4_${Date.now()}`, purpose: "Location/Lifestyle", prompt: `Lifestyle shot of ${productName || "product"} in use.`, approved: true },
      ];
      setPlannedScenes(defaultScenes);
      setStep(3);
    }
    setPlanning(false);
  };

  // Step 3: Review helpers
  const moveScene = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= plannedScenes.length) return;
    setPlannedScenes(prev => {
      const copy = [...prev];
      [copy[idx], copy[target]] = [copy[target], copy[idx]];
      return copy;
    });
  };

  const deleteScene = (idx: number) => {
    setPlannedScenes(prev => prev.filter((_, i) => i !== idx));
  };

  const updateScenePrompt = (idx: number, prompt: string) => {
    setPlannedScenes(prev => prev.map((s, i) => i === idx ? { ...s, prompt } : s));
  };

  const toggleApproval = (idx: number) => {
    setPlannedScenes(prev => prev.map((s, i) => i === idx ? { ...s, approved: !s.approved } : s));
  };

  // Step 4: Generate approved scenes
  const handleGenerateApproved = async () => {
    const approved = plannedScenes.filter(s => s.approved);
    if (approved.length === 0) return;
    setGenerating(true);
    setVideoGenError(null);

    // Initialize progress
    const progress: Record<string, "pending" | "generating" | "done" | "error"> = {};
    approved.forEach(s => { progress[s.id] = "pending"; });
    setSceneProgress({ ...progress });
    setSceneOutputs({});

    const productDetails = [
      flavorVariant && `Variant: ${flavorVariant}`,
      packSize && `Pack size: ${packSize}`,
      brandColors && `Brand colors: ${brandColors}`,
      brandStyle && `Brand style: ${brandStyle}`,
      allowedClaims && `Claims: ${allowedClaims}`,
    ].filter(Boolean).join(". ");

    const outputs: Record<string, string> = {};

    for (const scene of approved) {
      setSceneProgress(prev => ({ ...prev, [scene.id]: "generating" }));
      try {
        const fullPrompt = `${scene.prompt} Product: ${productName || "product"}. ${productDetails} ${identityLocked ? "IMPORTANT: The product appearance must match the uploaded image exactly." : ""}`;
        const res = await fetch("/api/video/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: fullPrompt,
            model: selectedModel,
            // Pass product image as reference when identity is locked so FAL/Kie
            // can use it as the first-frame / image-to-video reference.
            imageUrl: (identityLocked && productImageUrl) ? productImageUrl : undefined,
            aspectRatio: "16:9",
          }),
        });
        const data = await safeJson<{ outputUrl?: string; videoUrl?: string; url?: string; error?: string }>(res, "commercial-mode3-generate");
        const outputUrl = data.outputUrl ?? data.videoUrl ?? data.url;
        if (outputUrl) {
          outputs[scene.id] = outputUrl;
          setSceneOutputs(prev => ({ ...prev, [scene.id]: outputUrl }));
          setSceneProgress(prev => ({ ...prev, [scene.id]: "done" }));
        } else {
          setSceneProgress(prev => ({ ...prev, [scene.id]: "error" }));
        }
      } catch (err) {
        setSceneProgress(prev => ({ ...prev, [scene.id]: "error" }));
        setVideoGenError(err instanceof Error ? err.message : "Video generation failed");
      }
    }

    // If we have at least one output, set the first as result
    const firstOutput = Object.values(outputs)[0];
    if (firstOutput) {
      setResultUrl(firstOutput);
    } else if (Object.keys(outputs).length === 0) {
      setVideoGenError("All scenes failed to generate. Check your API keys in Settings.");
    }
    setGenerating(false);
  };

  return (
    <div>
      <button onClick={onBack} style={{ fontSize: 11, color: "#5a7080", background: "none", border: "none", cursor: "pointer", marginBottom: 16 }}>← Back to Commercial</button>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 24 }}>
        <span style={{ fontSize: 28 }}></span>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>AI Video Commercial</h2>
          <p style={{ fontSize: 12, color: "#5a7080" }}>Upload your product image → AI generates a video commercial</p>
        </div>
      </div>

      {/* Progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 24 }}>
        {[{ n: 1, l: "Product Info" }, { n: 2, l: "AI Planning" }, { n: 3, l: "Review & Edit" }, { n: 4, l: "Generate" }].map(s => (
          <div key={s.n} style={{ flex: 1 }}>
            <div style={{ height: 4, borderRadius: 2, marginBottom: 6, background: step >= s.n ? "#22c55e" : "#1e2a35" }} />
            <p style={{ fontSize: 9, color: step >= s.n ? "#22c55e" : "#3d5060", fontWeight: step === s.n ? 700 : 400, textAlign: "center" }}>{s.l}</p>
          </div>
        ))}
      </div>

      {/* Step 1: Product info */}
      {step === 1 && (
        <div style={{ background: "#0b0e18", border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />

          <div onClick={() => fileRef.current?.click()}
            style={{ border: `2px dashed ${productImageUrl ? "#22c55e" : "#1e2a35"}`, borderRadius: 14, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 20, background: productImageUrl ? "rgba(34,197,94,0.03)" : "transparent" }}>
            {productImageUrl ? (
              <div style={{ display: "flex", alignItems: "center", gap: 16, justifyContent: "center" }}>
                <img src={productImageUrl} alt="Product" style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 10 }} />
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 13, color: "#fff", fontWeight: 600 }}>{productImage?.name}</p>
                  <p style={{ fontSize: 10, color: "#22c55e" }}>Uploaded — click to change</p>
                </div>
              </div>
            ) : (
              <div>
                <span style={{ fontSize: 36, display: "block", marginBottom: 8 }}></span>
                <p style={{ fontSize: 14, color: "#fff", fontWeight: 600 }}>Upload Product Image</p>
                <p style={{ fontSize: 11, color: "#5a7080" }}>JPG, PNG, WebP — clear product photo works best</p>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Product Name</p>
              <input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. Fresh Mango Juice"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Category</p>
              <input value={productCategory} onChange={e => setProductCategory(e.target.value)} placeholder="e.g. Beverages, Fashion, Tech"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Tagline</p>
              <input value={tagline} onChange={e => setTagline(e.target.value)} placeholder="e.g. Made fresh daily"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 20 }}>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>CTA Text</p>
              <input value={ctaText} onChange={e => setCtaText(e.target.value)} placeholder="Order Now"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>WhatsApp (optional)</p>
              <input value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+234..."
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Price (optional)</p>
              <input value={price} onChange={e => setPrice(e.target.value)} placeholder="e.g. $5.99"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
          </div>

          {/* Extended product identity */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Flavor / Variant</p>
              <input value={flavorVariant} onChange={e => setFlavorVariant(e.target.value)} placeholder="e.g. Original, Spicy, Large"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Pack Size</p>
              <input value={packSize} onChange={e => setPackSize(e.target.value)} placeholder="e.g. 500ml, 1kg, Single"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Brand Colors</p>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input value={brandColors} onChange={e => setBrandColors(e.target.value)} placeholder="e.g. Red + Gold"
                  style={{ flex: 1, background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
                <input type="color" value={brandColorSwatch1} onChange={e => { setBrandColorSwatch1(e.target.value); setBrandColors(prev => { const parts = prev.split("+").map(s => s.trim()).filter(Boolean); parts[0] = e.target.value; return parts.join(" + "); }); }}
                  title="Primary color" style={{ width: 34, height: 34, padding: 2, borderRadius: 8, border: "1px solid #1e2a35", background: "#080b10", cursor: "pointer", flexShrink: 0 }} />
                <input type="color" value={brandColorSwatch2} onChange={e => { setBrandColorSwatch2(e.target.value); setBrandColors(prev => { const parts = prev.split("+").map(s => s.trim()).filter(Boolean); parts[1] = e.target.value; return parts.join(" + "); }); }}
                  title="Secondary color" style={{ width: 34, height: 34, padding: 2, borderRadius: 8, border: "1px solid #1e2a35", background: "#080b10", cursor: "pointer", flexShrink: 0 }} />
              </div>
            </div>
            <div>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Brand Style</p>
              <input value={brandStyle} onChange={e => setBrandStyle(e.target.value)} placeholder="e.g. Premium, Street, Modern"
                style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 4 }}>Allowed Claims</p>
            <input value={allowedClaims} onChange={e => setAllowedClaims(e.target.value)} placeholder="e.g. 100% Natural, No Preservatives, Award Winning"
              style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 10, padding: "10px 14px", color: "#fff", fontSize: 13, outline: "none" }} />
          </div>

          {/* Identity lock confirmation */}
          {productImageUrl && !identityLocked && (
            <div style={{ padding: 16, borderRadius: 12, border: "1px solid rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)", marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#f59e0b", marginBottom: 6 }}>Confirm Product Identity</p>
              <p style={{ fontSize: 10, color: "#5a7080", marginBottom: 10 }}>Lock this product image as the master packshot. AI will generate scenes that maintain this exact look.</p>
              <button onClick={() => setIdentityLocked(true)}
                style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: "#f59e0b", color: "#000", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                Lock Product Identity
              </button>
            </div>
          )}

          {identityLocked && (
            <div style={{ padding: 10, borderRadius: 10, border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.05)", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#22c55e", fontWeight: 700 }}></span>
              <span style={{ fontSize: 11, color: "#22c55e" }}>Product identity locked — AI will maintain this look</span>
              <button onClick={() => setIdentityLocked(false)} style={{ marginLeft: "auto", fontSize: 9, color: "#5a7080", background: "none", border: "none", cursor: "pointer" }}>Unlock</button>
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!productImageUrl}
            style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: productImageUrl ? "#22c55e" : "#2a2a40", color: productImageUrl ? "#000" : "#5a7080", fontSize: 16, fontWeight: 700, cursor: productImageUrl ? "pointer" : "not-allowed" }}>
            Next — AI Planning
          </button>
        </div>
      )}

      {/* Step 2: AI Planning — select model + generate scene blueprint */}
      {step === 2 && (
        <div style={{ background: "#0b0e18", border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 12 }}>AI Planning — Scene Blueprint</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
            {VIDEO_MODELS.map(m => (
              <button key={m.id} onClick={() => setSelectedModel(m.id)}
                style={{ padding: "14px 16px", borderRadius: 12, border: `1px solid ${selectedModel === m.id ? "#22c55e" : "#1e2a35"}`, background: selectedModel === m.id ? "rgba(34,197,94,0.06)" : "transparent", cursor: "pointer", textAlign: "left" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: "#fff" }}>{m.name}</p>
                  <span style={{ fontSize: 10, color: "#22c55e", fontWeight: 600 }}>{m.cost}</span>
                </div>
                <p style={{ fontSize: 10, color: "#5a7080" }}>{m.best} · {m.speed} · {m.quality}</p>
              </button>
            ))}
          </div>

          {/* Preview */}
          {productImageUrl && (
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "#080b10", borderRadius: 12, border: "1px solid #1e2a35", marginBottom: 20 }}>
              <img src={productImageUrl} alt="Product" style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 8 }} />
              <div>
                <p style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>{productName || "Product"}</p>
                <p style={{ fontSize: 10, color: "#5a7080" }}>{tagline} {price ? `· ${price}` : ""} {productCategory ? `· ${productCategory}` : ""}</p>
                <p style={{ fontSize: 9, color: "#22c55e" }}>AI will plan 5 commercial scenes for review</p>
              </div>
            </div>
          )}

          <p style={{ fontSize: 11, color: "#5a7080", marginBottom: 16 }}>AI will generate a 5-scene commercial blueprint (Hook, Features, Price, CTA, Location) based on your product info. You can review and edit each scene before generating.</p>

          {planError && (
            <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.3)", borderRadius: 10, fontSize: 11, color: "#fbbf24" }}>
              {planError}
            </div>
          )}

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(1)} style={{ padding: "14px 24px", borderRadius: 14, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={handlePlanScenes} disabled={planning}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: planning ? "#2a2a40" : "#22c55e", color: planning ? "#5a7080" : "#000", fontSize: 16, fontWeight: 700, cursor: planning ? "not-allowed" : "pointer" }}>
              {planning ? "AI is planning scenes..." : "Generate Scene Blueprint"}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review & Edit — user reviews, edits, reorders planned scenes */}
      {step === 3 && (
        <div style={{ background: "#0b0e18", border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 6 }}>Review & Edit Scenes</p>
          <p style={{ fontSize: 10, color: "#3d5060", marginBottom: 16 }}>Check each scene. Edit prompts, reorder, or remove scenes before generation. Only approved scenes will be rendered.</p>

          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
            {plannedScenes.map((scene, idx) => (
              <div key={scene.id} style={{ border: `1px solid ${scene.approved ? "rgba(34,197,94,0.3)" : "#1e2a35"}`, borderRadius: 12, padding: 16, background: scene.approved ? "rgba(34,197,94,0.03)" : "transparent" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#22c55e", background: "rgba(34,197,94,0.1)", borderRadius: 6, padding: "2px 8px" }}>Scene {idx + 1}</span>
                    <span style={{ fontSize: 11, color: "#fff", fontWeight: 600 }}>{scene.purpose}</span>
                  </div>
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => moveScene(idx, -1)} disabled={idx === 0} title="Move up"
                      style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #1e2a35", background: "transparent", color: idx === 0 ? "#1e2a35" : "#5a7080", cursor: idx === 0 ? "default" : "pointer", fontSize: 12 }}>
                      &#9650;
                    </button>
                    <button onClick={() => moveScene(idx, 1)} disabled={idx === plannedScenes.length - 1} title="Move down"
                      style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid #1e2a35", background: "transparent", color: idx === plannedScenes.length - 1 ? "#1e2a35" : "#5a7080", cursor: idx === plannedScenes.length - 1 ? "default" : "pointer", fontSize: 12 }}>
                      &#9660;
                    </button>
                    <button onClick={() => deleteScene(idx)} title="Delete scene"
                      style={{ width: 28, height: 28, borderRadius: 6, border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", fontSize: 12 }}>
                      &#10005;
                    </button>
                  </div>
                </div>

                <textarea value={scene.prompt} onChange={e => updateScenePrompt(idx, e.target.value)} rows={3}
                  style={{ width: "100%", background: "#080b10", border: "1px solid #1e2a35", borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit", lineHeight: 1.5 }} />

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                    <input type="checkbox" checked={scene.approved} onChange={() => toggleApproval(idx)}
                      style={{ accentColor: "#22c55e", width: 14, height: 14 }} />
                    <span style={{ fontSize: 10, color: scene.approved ? "#22c55e" : "#5a7080" }}>{scene.approved ? "Approved" : "Skipped"}</span>
                  </label>
                  <span style={{ fontSize: 9, color: "#3d5060" }}>{scene.prompt.length} chars</span>
                </div>
              </div>
            ))}
          </div>

          {plannedScenes.length === 0 && (
            <div style={{ textAlign: "center", padding: 24, color: "#5a7080", fontSize: 12 }}>No scenes planned. Go back to regenerate.</div>
          )}

          <div style={{ padding: "10px 14px", borderRadius: 10, background: "#080b10", marginBottom: 16 }}>
            <p style={{ fontSize: 10, color: "#5a7080" }}>
              {plannedScenes.filter(s => s.approved).length} of {plannedScenes.length} scenes approved for generation
              {plannedScenes.filter(s => s.approved).length > 0 && ` · Est. ${plannedScenes.filter(s => s.approved).length * 2}-${plannedScenes.filter(s => s.approved).length * 4} min`}
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStep(2)} style={{ padding: "14px 24px", borderRadius: 14, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 14, cursor: "pointer" }}>Back</button>
            <button onClick={() => { setStep(4); handleGenerateApproved(); }} disabled={plannedScenes.filter(s => s.approved).length === 0}
              style={{ flex: 1, padding: 16, borderRadius: 14, border: "none", background: plannedScenes.filter(s => s.approved).length > 0 ? "#22c55e" : "#2a2a40", color: plannedScenes.filter(s => s.approved).length > 0 ? "#000" : "#5a7080", fontSize: 16, fontWeight: 700, cursor: plannedScenes.filter(s => s.approved).length > 0 ? "pointer" : "not-allowed" }}>
              Generate {plannedScenes.filter(s => s.approved).length} Approved Scenes
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Generate & Assemble — per-scene progress + results */}
      {step === 4 && (
        <div style={{ background: "#0b0e18", border: "1px solid #1e2a35", borderRadius: 16, padding: 24 }}>
          <p style={{ fontSize: 11, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: "#5a7080", marginBottom: 6 }}>Generate & Assemble</p>
          <p style={{ fontSize: 10, color: "#3d5060", marginBottom: 16 }}>Rendering approved scenes. This may take a few minutes per scene.</p>
          {videoGenError && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
              <div>
                <p style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, marginBottom: 2 }}>Generation error</p>
                <p style={{ fontSize: 10, color: "#ef4444", opacity: 0.8 }}>{videoGenError}</p>
              </div>
              <button onClick={() => setVideoGenError(null)} style={{ background: "none", border: "none", color: "#5a7080", cursor: "pointer", fontSize: 14, lineHeight: 1 }}>✕</button>
            </div>
          )}

          {/* Per-scene progress */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
            {plannedScenes.filter(s => s.approved).map((scene, idx) => {
              const status = sceneProgress[scene.id] || "pending";
              const output = sceneOutputs[scene.id];
              const statusColors: Record<string, string> = { pending: "#5a7080", generating: "#f59e0b", done: "#22c55e", error: "#ef4444" };
              const statusLabels: Record<string, string> = { pending: "Queued", generating: "Generating...", done: "Done", error: "Failed" };
              return (
                <div key={scene.id} style={{ border: `1px solid ${statusColors[status]}30`, borderRadius: 10, padding: 14, background: status === "done" ? "rgba(34,197,94,0.03)" : "transparent" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: statusColors[status] }}>Scene {idx + 1}</span>
                      <span style={{ fontSize: 10, color: "#fff" }}>{scene.purpose}</span>
                    </div>
                    <span style={{ fontSize: 9, color: statusColors[status], fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: 1 }}>{statusLabels[status]}</span>
                  </div>
                  {status === "generating" && (
                    <div style={{ height: 3, borderRadius: 2, background: "#1e2a35", overflow: "hidden" }}>
                      <div style={{ width: "60%", height: "100%", background: "#f59e0b", borderRadius: 2, animation: "pulse 1.5s ease-in-out infinite" }} />
                    </div>
                  )}
                  {status === "done" && output && (
                    <div style={{ marginTop: 8 }}>
                      <video src={output} controls style={{ width: "100%", maxHeight: 180, borderRadius: 8 }} />
                    </div>
                  )}
                  {status === "error" && (
                    <p style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>Generation failed for this scene. You can retry from Review step.</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Summary when all done */}
          {!generating && Object.values(sceneProgress).some(s => s === "done") && (
            <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #1e2a35", marginBottom: 20 }}>
              {resultUrl && <video src={resultUrl} controls style={{ width: "100%", maxHeight: 400 }} />}
              <div style={{ padding: "12px 16px", background: "#080b10", display: "flex", gap: 8 }}>
                {resultUrl && <a href={resultUrl} download style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, background: "#22c55e", color: "#000", fontSize: 13, fontWeight: 700, textDecoration: "none" }}>Download</a>}
                <a href="/dashboard/assets" style={{ flex: 1, textAlign: "center", padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", color: "#5a7080", fontSize: 13, textDecoration: "none" }}>Asset Library</a>
                <button onClick={() => { setStep(1); setResultUrl(null); setPlannedScenes([]); setSceneProgress({}); setSceneOutputs({}); }}
                  style={{ flex: 1, padding: "10px 16px", borderRadius: 10, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 13, cursor: "pointer" }}>New Video</button>
              </div>
            </div>
          )}

          {!generating && (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setStep(3)} style={{ padding: "14px 24px", borderRadius: 14, border: "1px solid #1e2a35", background: "transparent", color: "#5a7080", fontSize: 14, cursor: "pointer" }}>Back to Review</button>
              <a href="/dashboard/commercial-planner" style={{ flex: 1, textAlign: "center", padding: "14px 16px", borderRadius: 14, border: "1px solid rgba(168,85,247,0.3)", background: "rgba(168,85,247,0.06)", color: "#a855f7", fontSize: 12, textDecoration: "none", fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center" }}>
                Open Commercial Planner for deeper editing
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View = "list" | "new" | "editor" | "mode2" | "ai_video";

function CommercialPageInner() {
  const searchParams = useSearchParams();
  const characterIdParam = searchParams.get("characterId") ?? "";
  const [view,    setViewRaw]    = useState<View>("list");
  const [project, setProject] = useState<CommercialProject | null>(null);
  // Track which view opened the editor so back navigates correctly (mode2 → back to mode2, not list)
  const [editorSource, setEditorSource] = useState<View>("list");

  // Sidebar click forces page reload (handled in Sidebar component) which resets state

  // Push browser history so back button returns to commercial list, not previous page
  function setView(v: View) {
    if (v !== "list" && view === "list") {
      window.history.pushState({ commercialView: v }, "", window.location.pathname);
    }
    setViewRaw(v);
  }

  // Listen for browser back button
  useEffect(() => {
    function handlePopState() {
      setViewRaw("list");
      setProject(null);
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (view === "new") {
    return (
      <div className="w-full p-1">
        <NewProjectForm onCreated={p => { setProject(p); setView("editor"); }} onCancel={() => setView("list")} />
      </div>
    );
  }

  if (view === "editor" && project) {
    return (
      <div className="w-full p-1">
        <CommercialEditor
          initialProject={project}
          onBack={() => { setProject(null); setView(editorSource === "mode2" ? "mode2" : "list"); }}
          initialCharacterId={characterIdParam || undefined}
        />
      </div>
    );
  }

  if (view === "mode2") {
    return (
      <div className="w-full p-1">
        <AiAdBuilder
          onBack={() => setView("list")}
          onOpenProject={p => { setProject(p); setEditorSource("mode2"); setView("editor"); }}
        />
      </div>
    );
  }

  if (view === "ai_video") {
    return (
      <div className="w-full p-1">
        <AiVideoCommercial onBack={() => setView("list")} />
      </div>
    );
  }

  return (
    <div className="w-full p-1">
      {/* Mode tabs — prominent */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <button className="relative overflow-hidden p-5 rounded-2xl text-left transition-all"
          style={{ background: "linear-gradient(135deg, rgba(255,107,53,0.08), rgba(255,107,53,0.02))", border: "2px solid rgba(255,107,53,0.3)" }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl">️</span>
            <div>
              <p className="text-white font-bold text-sm">Slide Ad Builder</p>
              <p className="text-[10px]" style={{ color: "#ff6b35" }}>Currently viewing</p>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "#5a7080" }}>Build slide-by-slide. Upload images, add narration, music, and captions per slide.</p>
        </button>
        <button onClick={() => setView("mode2")} className="relative overflow-hidden p-5 rounded-2xl text-left transition-all hover:-translate-y-1"
          style={{ background: "linear-gradient(135deg, rgba(168,85,247,0.06), rgba(168,85,247,0.02))", border: "1px solid #1e2a35" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(168,85,247,0.4)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e2a35"; }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl"></span>
            <div>
              <p className="text-white font-bold text-sm">AI Ad Creator</p>
              <p className="text-[10px]" style={{ color: "#a855f7" }}>Upload footage → AI does the rest</p>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "#5a7080" }}>Upload your product images or video. AI analyses, writes script, builds slides, adds narration and music automatically.</p>
        </button>
        <button onClick={() => setView("ai_video")} className="relative overflow-hidden p-5 rounded-2xl text-left transition-all hover:-translate-y-1"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.06), rgba(34,197,94,0.02))", border: "1px solid #1e2a35" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(34,197,94,0.4)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = "#1e2a35"; }}>
          <div className="flex items-center gap-3 mb-2">
            <span className="text-2xl"></span>
            <div>
              <p className="text-white font-bold text-sm">AI Video Commercial</p>
              <p className="text-[10px]" style={{ color: "#22c55e" }}>Product photo → AI video ad</p>
            </div>
          </div>
          <p className="text-[11px]" style={{ color: "#5a7080" }}>Upload your product image. AI generates a professional video commercial with motion, text, and music. Powered by Kling, Runway, Hailuo.</p>
        </button>
      </div>
      <ProjectList
        onOpen={p => {
          fetch(`/api/commercial/projects/${p.id}`).then(r => r.json()).then(full => { setProject(full); setEditorSource("list"); setView("editor"); });
        }}
        onNew={() => setView("new")}
      />
    </div>
  );
}

export default function CommercialPage() {
  return (
    <Suspense fallback={<div style={{ color: "#5a5a7a", padding: 20 }}>Loading...</div>}>
      <CommercialPageInner />
    </Suspense>
  );
}
