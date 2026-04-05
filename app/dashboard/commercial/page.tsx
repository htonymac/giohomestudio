"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import NarrationPanel from "../../components/NarrationPanel";
import { DEFAULT_NARRATION_SETTINGS, type NarrationSettings } from "@/modules/voice-provider/accent-profiles";
import OverlayPanel from "../../components/OverlayPanel";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";
import CaptionPreview from "./CaptionPreview";
import type { PresetName } from "@/modules/caption-compositor/types";

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
  motionPreset?: "zoom-in" | "zoom-out" | "pan-left" | "pan-right" | "pan-up" | "pan-down" | "none" | "auto";
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
  musicVolume: number;
  narrationVolume: number;
  musicPath: string | null;
  musicSource: string | null;
  enhancementPreset: string | null;
  enhancementLevel: number | null;
  renderStatus: string;
  contentItemId: string | null;
  slides: CommercialSlide[];
}

const ASPECT_DIMS: Record<string, { w: number; h: number; label: string }> = {
  "9:16": { w: 9, h: 16, label: "Reels / TikTok / Shorts" },
  "16:9": { w: 16, h: 9, label: "YouTube / Desktop" },
  "1:1":  { w: 1,  h: 1,  label: "Instagram Feed" },
};

const ENHANCEMENT_PRESETS = [
  { id: "cinematic",    label: "🎬 Cinematic",   color: "#7c5cfc" },
  { id: "hdr",          label: "⚡ HDR",          color: "#fc5c7d" },
  { id: "natural",      label: "🌿 Natural",      color: "#5cf5c8" },
  { id: "clean_social", label: "📱 Clean Social", color: "#fcb75c" },
  { id: "warm_promo",   label: "🔥 Warm Promo",  color: "#fc7d5c" },
];

const MOTION_PRESETS = [
  { id: "auto",      label: "🔄 Auto" },
  { id: "zoom-in",   label: "🔍 Zoom In" },
  { id: "zoom-out",  label: "🔎 Zoom Out" },
  { id: "pan-left",  label: "⬅️ Pan L" },
  { id: "pan-right", label: "➡️ Pan R" },
  { id: "pan-up",    label: "⬆️ Pan Up" },
  { id: "pan-down",  label: "⬇️ Pan Dn" },
  { id: "none",      label: "⏸️ Static" },
];

const TRANSITION_TYPES = [
  { id: "none",        label: "⏸️ None" },
  { id: "fade",        label: "🌫️ Fade" },
  { id: "slide-left",  label: "⬅️ Slide" },
  { id: "slide-right", label: "➡️ Slide" },
  { id: "zoom-in",     label: "🔍 Zoom" },
];

const FONT_FAMILIES = [
  "Inter", "Georgia", "Arial", "Verdana", "Times New Roman", "Trebuchet MS", "Impact",
];

// ── Shared style atoms ───────────────────────────────────────────────────────

const inputCls = "w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm placeholder-[#3a3a55] focus:outline-none focus:border-[#7c5cfc]";
const labelCls = "block text-xs text-[#6060a0] mb-1 font-medium";
const sectionCls = "bg-[#12121e] border border-[#2a2a40] rounded-lg p-3 space-y-3";
const sectionTitle = "text-xs font-semibold text-[#6060a0] uppercase tracking-widest";

// ── Project List ─────────────────────────────────────────────────────────────

function ProjectList({ onOpen, onNew }: { onOpen: (p: CommercialProject) => void; onNew: () => void }) {
  const [projects, setProjects] = useState<CommercialProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/commercial/projects")
      .then(r => r.json())
      .then(setProjects)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">🎬 Commercial Maker</h1>
          <p className="text-sm text-[#6060a0] mt-0.5">📣 Image-led promotional videos — upload your photos, build the ad</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => onNew()} className="px-4 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors">
            🚀 New Slide Ad
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-[#4040600] text-sm text-center py-12">Loading projects…</p>
      ) : projects.length === 0 ? (
        <div className="border border-dashed border-[#2a2a40] rounded-xl p-12 text-center">
          <p className="text-[#6060a0] text-sm mb-1">✨ No commercial projects yet</p>
          <p className="text-[#4040600] text-xs mb-4">🖼️ Mode 1: Build slide-by-slide · 🤖 Mode 2: Upload footage, AI does the rest</p>
          <button onClick={onNew} className="px-4 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors">
            🚀 Create first Slide Ad
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map(p => {
            const ready = p.slides?.filter(s => s.status === "ready").length ?? 0;
            const total = p.slides?.length ?? 0;
            return (
              <button key={p.id} onClick={() => onOpen(p)} className="w-full text-left p-4 bg-[#12121e] border border-[#2a2a40] hover:border-[#7c5cfc]/50 rounded-xl transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-semibold">{p.projectName}</p>
                    <p className="text-xs text-[#6060a0] mt-0.5">
                      {p.aspectRatio} · {total} slide{total !== 1 ? "s" : ""}{total > 0 ? ` (${ready} ready)` : ""}
                    </p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    p.renderStatus === "ready"     ? "bg-green-900/40 text-green-400" :
                    p.renderStatus === "rendering" ? "bg-indigo-900/40 text-indigo-400" :
                    p.renderStatus === "failed"    ? "bg-red-900/40 text-red-400" :
                    "bg-[#1a1a2e] text-[#6060a0]"
                  }`}>
                    {p.renderStatus === "ready" ? "✅ ready" : p.renderStatus === "rendering" ? "⏳ rendering" : p.renderStatus === "failed" ? "❌ failed" : "📝 draft"}
                  </span>
                </div>
              </button>
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
        <button onClick={onCancel} className="text-[#6060a0] hover:text-white transition-colors text-sm">← Back</button>
        <h2 className="text-xl font-bold text-white">🎬 New Slide Ad Project</h2>
      </div>
      <div className={`${sectionCls}`}>
        <div>
          <label className={labelCls}>📋 Project name *</label>
          <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. 🏠 Lagos Property Promo April" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>🏷️ Brand / business name</label>
          <input type="text" value={brandName} onChange={e => setBrandName(e.target.value)} placeholder="e.g. ✨ GioHomeStudio" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>📐 Output format</label>
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
          {saving ? "⏳ Creating…" : "🚀 Create Project"}
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
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    productType: "", productName: "", features: "", offer: "", price: "",
    website: "", companyName: "", contact: "", contactMethod: "whatsapp",
    tone: "Professional" as "Luxury" | "Professional" | "Energetic" | "Friendly" | "Urgent",
    duration: "30" as "15" | "30" | "60" | "90",
  });

  function setF(key: string, val: string) { setForm(prev => ({ ...prev, [key]: val })); }

  async function handleUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setAnalyzing(true);
    setWarn("");

    const fd = new FormData();
    for (const f of Array.from(files)) fd.append("files", f);

    try {
      const createRes = await fetch("/api/commercial/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectName: `AI Ad ${new Date().toLocaleDateString()}`, aspectRatio: "9:16" }),
      });
      if (!createRes.ok) { setWarn("Failed to create project"); return; }
      const proj = await createRes.json() as { id: string };
      setCreatedProjId(proj.id);

      const res  = await fetch(`/api/commercial/projects/${proj.id}/mode2/analyze`, { method: "POST", body: fd });
      const data = await res.json() as { savedFiles?: typeof savedFiles; analysis?: Record<string, unknown>; warning?: string };

      setSavedFiles(data.savedFiles ?? []);
      if (data.analysis) {
        setAnalysis(data.analysis);
        if (data.analysis.productType) setF("productType", data.analysis.productType as string);
        if (data.analysis.productName) setF("productName", data.analysis.productName as string);
        if (data.analysis.features)    setF("features", (data.analysis.features as string[]).join(", "));
        if (data.analysis.adTone)      setF("tone", data.analysis.adTone as typeof form.tone);
      }
      setWarn(data.warning ?? "");
      setStep("form");
    } catch {
      setWarn("Upload failed. Check connection.");
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
        body: JSON.stringify(form),
      });
      const data = await res.json() as { script?: string; error?: string };
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
        body: JSON.stringify({ filePaths: savedFiles.map(f => f.path), script }),
      });
      type BuildResult = CommercialProject & { slides: CommercialSlide[]; error?: string };
      const data = await res.json() as BuildResult;
      if (!res.ok) { setWarn(data.error ?? "Build failed"); return; }
      onOpenProject(data);
    } catch {
      setWarn("Network error during build");
    } finally {
      setBuilding(false);
    }
  }

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="text-[#6060a0] hover:text-white transition-colors text-sm">← Back</button>
        <div>
          <h2 className="text-xl font-bold text-white">🤖 AI Ad Builder</h2>
          <p className="text-xs text-[#6060a0]">📸 Upload images → 🧠 AI analyses → 📝 generates script → 🚀 opens editor ready to render</p>
        </div>
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
          <p className={sectionTitle}>📸 Step 1 — Upload product images</p>
          <p className="text-xs text-[#6060a0]">Upload product or promo images (JPG, PNG, WEBP). 🤖 AI will analyse them and pre-fill the details form. Works for any product or service.</p>
          <div
            className="border-2 border-dashed border-[#2a2a40] hover:border-[#7c5cfc]/50 rounded-xl p-10 text-center cursor-pointer transition-colors"
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading || analyzing ? (
              <p className="text-[#6060a0] text-sm">{analyzing ? "Analysing with AI…" : "Uploading…"}</p>
            ) : (
              <>
                <p className="text-3xl mb-2">🖼️</p>
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
              <p className={sectionTitle}>🛒 Step 2 — Product / ad details</p>
              {analysis && <span className="text-[10px] text-[#7c5cfc] font-medium">🤖 AI pre-filled ✅</span>}
            </div>
            <p className="text-xs text-[#6060a0]">🖼️ {savedFiles.length} image{savedFiles.length !== 1 ? "s" : ""} uploaded ✅ — correct any details below.</p>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>🛒 Product / service type</label>
                <select value={form.productType} onChange={e => setF("productType", e.target.value)} className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                  <option value="">Select…</option>
                  {PRODUCT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>🎭 Ad tone</label>
                <select value={form.tone} onChange={e => setF("tone", e.target.value)} className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                  {["Luxury","Professional","Energetic","Friendly","Urgent"].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={labelCls}>🎯 Product / service name</label>
              <input type="text" value={form.productName} onChange={e => setF("productName", e.target.value)} placeholder="e.g. 🎯 GioStudio Pro · 🍛 Mama's Jollof · 🏠 3BR Apartment" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>⭐ Key features / benefits</label>
              <textarea
                value={form.features}
                onChange={e => setF("features", e.target.value)}
                rows={3}
                placeholder={"🚚 Fast delivery\n✅ 30-day free trial\n💯 No hidden fees"}
                className={inputCls}
                style={{ resize: "vertical" }}
              />
              <p className="text-[10px] text-[#404060] mt-1">💡 One per line or comma-separated — both work</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>💰 Price (optional)</label>
                <input type="text" value={form.price} onChange={e => setF("price", e.target.value)} placeholder="e.g. 💰 ₦5,000 / $29/mo" className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>🔥 Special offer (optional)</label>
                <input type="text" value={form.offer} onChange={e => setF("offer", e.target.value)} placeholder="e.g. 🔥 50% off this week!" className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>🌐 Website (optional)</label>
              <input type="text" value={form.website} onChange={e => setF("website", e.target.value)} placeholder="e.g. 🌐 giostudio.com" className={inputCls} />
            </div>
          </div>

          <div className={sectionCls}>
            <p className={sectionTitle}>🏷️ Brand & contact</p>
            <div>
              <label className={labelCls}>🏢 Company / brand name *</label>
              <input type="text" value={form.companyName} onChange={e => setF("companyName", e.target.value)} placeholder="e.g. 🏷️ GioHomeStudio" className={inputCls} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>📲 Contact via</label>
                <select value={form.contactMethod} onChange={e => setF("contactMethod", e.target.value)} className="w-full bg-[#0d0d1a] border border-[#2a2a40] rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#7c5cfc]">
                  {["whatsapp","call","telegram","email","website","DM"].map(m => <option key={m} value={m} className="capitalize">{m.charAt(0).toUpperCase() + m.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>📞 Contact detail</label>
                <input type="text" value={form.contact} onChange={e => setF("contact", e.target.value)} placeholder="📞 +234 xxx / @handle / link" className={inputCls} />
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
            </div>
          </div>

          <button onClick={handleGenerateScript} disabled={generating} className="w-full py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] disabled:bg-[#2a2a40] disabled:text-[#6060a0] text-white text-sm font-semibold rounded-xl transition-colors">
            {generating ? "🧠 Generating script with AI…" : "🎤 Generate voiceover script →"}
          </button>
        </div>
      )}

      {step === "script" && (
        <div className="space-y-4">
          <div className={sectionCls}>
            <div className="flex items-center justify-between">
              <p className={sectionTitle}>🎤 Step 3 — Review voiceover script</p>
              <button onClick={() => setStep("form")} className="text-xs text-[#6060a0] hover:text-white transition-colors">← Edit details</button>
            </div>
            <p className="text-xs text-[#6060a0]">✏️ Edit the script before building. This will be 🎤 spoken by AI voiceover on the final video.</p>
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              rows={8}
              className={`${inputCls} resize-vertical font-sans`}
              placeholder="🎤 Voiceover script will appear here…"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setGenerating(true);
                  const res = await fetch(`/api/commercial/projects/${createdProjId}/mode2/generate-script`, {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(form),
                  });
                  const data = await res.json() as { script?: string };
                  if (res.ok) setScript(data.script ?? "");
                  setGenerating(false);
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
          <p className={sectionTitle}>🚀 Step 4 — Build the ad</p>
          <div className="text-center py-6 space-y-3">
            <p className="text-4xl">🎬</p>
            <p className="text-white font-medium text-sm">🎯 Ready to build your ad!</p>
            <p className="text-xs text-[#6060a0]">
              {savedFiles.length} image{savedFiles.length !== 1 ? "s" : ""} · {script.split(" ").length} words · {form.duration}s target
            </p>
            <div className="bg-[#0d0d1a] border border-[#2a2a40] rounded-lg p-3 text-left text-xs text-[#9090c0] leading-relaxed max-h-32 overflow-y-auto">
              {script}
            </div>
            <p className="text-xs text-[#5050b0]">
              🖼️ One slide per image · 📝 script attached · 🎨 add captions · then hit 🚀 Render — your ad is live!
            </p>
            <button
              onClick={handleBuildAd}
              disabled={building}
              className="w-full py-2.5 bg-[#7c5cfc] hover:bg-[#9070ff] disabled:bg-[#2a2a40] disabled:text-[#6060a0] text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {building ? "⏳ Building slides…" : "🎬 Build AI Ad →"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Commercial Editor (Mode 1) ────────────────────────────────────────────────

function CommercialEditor({ initialProject, onBack }: { initialProject: CommercialProject; onBack: () => void }) {
  const [project, setProject]     = useState<CommercialProject>(initialProject);
  const [selectedId, setSelectedId] = useState<string | null>(project.slides[0]?.id ?? null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [batchImporting, setBatchImporting] = useState(false);
  const [renderMsg, setRenderMsg] = useState("");
  const [narrationEnabled, setNarrationEnabled] = useState(true);
  const [narrationSettings, setNarrationSettings] = useState<NarrationSettings>(DEFAULT_NARRATION_SETTINGS);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [orderSuggestion, setOrderSuggestion] = useState<{ ids: string[]; reasoning: string } | null>(null);
  const [suggestingOrder, setSuggestingOrder] = useState(false);
  const [showSmartPro, setShowSmartPro] = useState(false);
  const [llmReady, setLlmReady]   = useState<boolean | null>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const dragStateRef = useRef<{ startX: number; startW: number } | null>(null);
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef       = useRef<HTMLInputElement>(null);
  const batchImportRef = useRef<HTMLInputElement>(null);
  const musicFileRef  = useRef<HTMLInputElement>(null);
  const [mergedVideoPath, setMergedVideoPath] = useState<string | null>(null);
  const [musicUploading, setMusicUploading] = useState(false);
  const [showMusicLibrary, setShowMusicLibrary] = useState(false);
  const [musicLibrary, setMusicLibrary] = useState<{ filename: string; label: string; mood: string }[]>([]);
  const [musicLibraryLoading, setMusicLibraryLoading] = useState(false);
  const [musicDownloadQuery, setMusicDownloadQuery] = useState("");
  const [musicDownloading, setMusicDownloading] = useState(false);
  const [polishState, setPolishState] = useState<{ slideId: string; field: "caption" | "narration"; polished: string; loading: boolean; error?: string } | null>(null);
  const [translateState, setTranslateState] = useState<{ slideId: string; field: "caption" | "narration"; translated: string; loading: boolean; lang: string } | null>(null);
  const [translateLang, setTranslateLang] = useState("fr");
  const [readImageState, setReadImageState] = useState<{ slideId: string; caption: string; narration: string; loading: boolean; error?: string; details?: string[] } | null>(null);

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

    // Upload images in parallel — each pair carries its own file reference
    const uploadResults = await Promise.all(
      pairs.map(async ({ slide, file }) => {
        const fd = new FormData();
        fd.append("image", file);
        const res = await fetch(`/api/commercial/projects/${project.id}/slides/${slide.id}/image`, { method: "POST", body: fd });
        if (!res.ok) return null;
        return { slideId: slide.id, ...(await res.json() as { imagePath: string; imageFileName: string }) };
      })
    );

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
    // Persist new order to server
    await fetch(`/api/commercial/projects/${project.id}/slides/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: project.slides.map(s => s.id) }),
    });
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
    await fetch(`/api/commercial/projects/${project.id}/slides/reorder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: reordered.map(s => s.id) }),
    });
  }

  // ── Slide field auto-save (debounced 800ms) ─────────────────────────────
  const patchSlide = useCallback((slideId: string, patch: Partial<CommercialSlide>) => {
    setProject(prev => ({
      ...prev,
      slides: prev.slides.map(s => s.id === slideId ? { ...s, ...patch } : s),
    }));
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      await fetch(`/api/commercial/projects/${project.id}/slides/${slideId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
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
    const res  = await fetch("/api/translate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLanguage: translateLang }),
    });
    const data = await res.json();
    setTranslateState({ slideId, field, translated: data.translated ?? "", loading: false, lang: translateLang });
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
    setRenderMsg("");
    try {
      // Always save voice settings to DB before render — server reads project.voiceId at render time.
      // Do not skip: an empty voiceId intentionally clears any previously saved voice so the default is used.
      await patchProject({
        voiceId:       narrationSettings.voiceId       || null,
        voiceLanguage: narrationSettings.voiceLanguage || null,
      });
      setProject(prev => ({ ...prev, renderStatus: "rendering" }));
      const res  = await fetch(`/api/commercial/projects/${project.id}/render`, { method: "POST" });
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

  async function pollRenderStatus(projectId: string) {
    const maxAttempts = 60; // 5 minutes max
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 5000));
      try {
        const res = await fetch(`/api/commercial/projects/${projectId}`);
        if (!res.ok) break;
        const data = await res.json() as CommercialProject & { mergedOutputPath?: string | null };
        if (data.renderStatus === "ready") {
          setProject(prev => ({ ...prev, renderStatus: "ready", contentItemId: data.contentItemId ?? prev.contentItemId }));
          setRenderMsg("Render complete! Check Review queue.");
          if (data.mergedOutputPath) setMergedVideoPath(data.mergedOutputPath);
          return;
        }
        if (data.renderStatus === "failed") {
          setProject(prev => ({ ...prev, renderStatus: "failed" }));
          setRenderMsg("Render failed. Check server logs or try again.");
          return;
        }
      } catch { break; }
    }
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
          {renderStatus === "rendering" ? "⏳ Rendering…" : "🚀 Render"}
        </button>
      </div>

      {/* Render status banner */}
      {renderMsg && (
        <div className={`mb-3 px-3 py-2 rounded-lg text-xs flex-shrink-0 ${
          renderStatus === "done"   ? "bg-green-950/40 border border-green-800/40 text-green-400" :
          renderStatus === "failed" ? "bg-red-950/40 border border-red-800/40 text-red-400" :
          "bg-indigo-950/40 border border-indigo-800/40 text-indigo-400"
        }`}>
          {renderMsg}
          {renderStatus === "done" && project.contentItemId && (
            <a href={`/dashboard/content/${project.contentItemId}`} className="ml-2 underline opacity-70">🎬 View in Review →</a>
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
          <span>⚠️ No cloud AI key found. ✨ Polish &amp; 🤖 AI-order use Ollama (local). If Ollama is not running, these will fail.</span>
          <a href="/dashboard/settings" className="shrink-0 px-2 py-0.5 bg-[#7c5cfc]/20 border border-[#7c5cfc]/40 text-[#b090ff] rounded-lg font-medium hover:bg-[#7c5cfc]/30 transition-colors whitespace-nowrap">
            ⚙️ Add API key →
          </a>
        </div>
      )}

      {/* Order suggestion banner */}
      {orderSuggestion && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-[#7c5cfc]/10 border border-[#7c5cfc]/30 text-xs text-[#b090ff] flex-shrink-0 flex items-start justify-between gap-2">
          <span>💡 AI suggests: {orderSuggestion.reasoning}</span>
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
                {suggestingOrder ? "🧠…" : "🤖 AI order"}
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
            </div>
          </div>
          <input ref={batchImportRef} type="file" multiple accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => { handleBatchImport(e.target.files); e.target.value = ""; }} />

          <p className="text-[10px] text-[#4040600]">↕️ Drag to reorder</p>

          {project.slides.length === 0 ? (
            <button onClick={addSlide} className="border border-dashed border-[#2a2a40] rounded-lg p-4 text-center text-xs text-[#4040600] hover:border-[#7c5cfc]/40 transition-colors">
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
              <div className="relative rounded-lg bg-black border border-[#2a2a40] flex-shrink-0 flex items-center justify-center" style={{ ...previewStyle, overflow: "hidden" }}>
                {selectedSlide.imagePath ? (
                  <>
                    <img
                      src={`/api/media/file?path=${encodeURIComponent(selectedSlide.imagePath)}`}
                      alt="Slide preview"
                      className="w-full h-full object-cover"
                    />
                    {/* CaptionPreview mirrors the compositor HTML exactly — same CSS rules, same overflow constraints.
                        Uses CSS transform:scale so preview matches export at any size. */}
                    <CaptionPreview
                      captionText={
                        selectedSlide.captionApproved && selectedSlide.captionPolished
                          ? selectedSlide.captionPolished
                          : selectedSlide.captionOriginal
                      }
                      captionPosition={selectedSlide.enhancementSettings?.captionPosition ?? "bottom"}
                      captionPreset={(selectedSlide.enhancementSettings?.captionPreset ?? "realEstate") as PresetName}
                      fontOverride={selectedSlide.enhancementSettings?.fontFamily ?? null}
                      aspectRatio={(project.aspectRatio ?? "9:16") as "9:16" | "16:9" | "1:1"}
                      previewWidth={previewStyle.width as number}
                      previewHeight={previewStyle.height as number}
                    />
                    {/* CTA badge indicator on last slide */}
                    {selectedSlide.slideOrder === project.slides.length && project.ctaMethod && project.ctaValue && (
                      <div className="absolute top-2 right-2">
                        <span className="text-[9px] bg-black/70 text-white px-1.5 py-0.5 rounded font-medium">📣 CTA</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 cursor-pointer w-full h-full items-center justify-center" onClick={() => fileRef.current?.click()}>
                    <div className="w-10 h-10 rounded-full bg-[#1a1a2e] border border-[#2a2a40] flex items-center justify-center text-[#6060a0] text-lg">+</div>
                    <p className="text-xs text-[#6060a0]">📸 Click to upload image</p>
                  </div>
                )}
              </div>

              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={async e => { const file = e.target.files?.[0]; if (file && selectedSlide) await handleImageUpload(file, selectedSlide.id); e.target.value = ""; }} />

              <div className="flex items-center gap-2 flex-wrap justify-center">
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="px-4 py-1.5 text-xs font-medium rounded-lg border border-[#2a2a40] text-[#6060a0] hover:border-[#7c5cfc]/50 hover:text-white transition-colors">
                  {uploading ? "⏳ Uploading…" : selectedSlide.imagePath ? "🔄 Replace image" : "📸 Upload image"}
                </button>
                {selectedSlide.imagePath && (
                  <>
                    <button
                      onClick={() => patchSlide(selectedSlide.id, { imagePath: null })}
                      disabled={uploading}
                      className="px-3 py-1.5 text-xs font-medium rounded-lg border border-red-900/40 text-red-500/60 hover:text-red-400 hover:border-red-500/50 transition-colors"
                      title="Remove image"
                    >🗑️ Clear</button>
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
                      title="🤖 Analyze image and generate caption + narration"
                    >
                      {readImageState?.loading && readImageState.slideId === selectedSlide.id ? "👁️ Reading…" : "👁️ Read Image"}
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
                      <p className="text-[10px] text-[#7c5cfc] font-semibold uppercase tracking-wider">🤖 AI image read</p>
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

              <p className="text-[11px] text-[#404060] text-center">📐 {dims.label} · ⏱️ {selectedSlide.durationMs / 1000}s</p>
            </div>
          ) : (
            <div className="text-center">
              <p className="text-[#6060a0] text-sm">👈 Select or add a slide to begin</p>
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
                <button onClick={() => deleteSlide(selectedSlide.id)} className="text-xs text-red-500/60 hover:text-red-400 transition-colors">🗑️ Remove</button>
              </div>

              {/* Caption */}
              <div className={sectionCls}>
                <div className="flex items-center gap-1.5 justify-between">
                  <p className={sectionTitle}>🏷️ Caption</p>
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
                      <option value="yo">Yoruba</option>
                      <option value="ha">Hausa</option>
                      <option value="ig">Igbo</option>
                      <option value="sw">Swahili</option>
                      <option value="pcm">Pidgin</option>
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
                        const res  = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/polish`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text, brandName: project.brandName ?? undefined, field: "caption", maxWords: project.captionMaxWords, maxChars: project.captionMaxChars }),
                        });
                        const data = await res.json();
                        if (res.ok) setPolishState({ slideId: selectedSlide.id, field: "caption", polished: data.polished, loading: false });
                        else setPolishState({ slideId: selectedSlide.id, field: "caption", polished: "", loading: false, error: data.error ?? "LLM unavailable" });
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
                  placeholder="🏷️ Short punchy headline for this slide…"
                  className={inputCls}
                  style={{ resize: "vertical" }}
                />

                {/* Caption position */}
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-[#6060a0] mr-1">📍 Position:</span>
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
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-[#6060a0] mr-1 flex-shrink-0">🎨 Style:</span>
                  {(["realEstate", "luxury", "promo", "minimal"] as const).map(p => (
                    <button key={p} type="button"
                      onClick={() => patchSlideEnhancement(selectedSlide.id, { captionPreset: p })}
                      className={`flex-1 py-0.5 rounded text-[9px] border transition-colors truncate ${
                        (selectedSlide.enhancementSettings?.captionPreset ?? "realEstate") === p
                          ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10"
                          : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"
                      }`}>{p === "realEstate" ? "🏠 Real Est." : p === "luxury" ? "💎 Luxury" : p === "promo" ? "🔥 Promo" : "✦ Minimal"}</button>
                  ))}
                </div>

                {polishState && !polishState.loading && polishState.slideId === selectedSlide.id && polishState.field === "caption" && (
                  polishState.error ? (
                    <div className="border border-orange-800/40 rounded-lg p-2.5 bg-orange-950/20 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-orange-400 font-semibold">AI not configured</p>
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
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">🌐 Translation</p>
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
                <p className={sectionTitle}>🔤 Font</p>
                <div>
                  <label className={labelCls}>🔤 Font family</label>
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
                    <label className={labelCls}>📏 Size: {selectedSlide.enhancementSettings?.fontSize ?? 12}px</label>
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
                  <p className={sectionTitle}>🎤 Narration</p>
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
                        const res  = await fetch(`/api/commercial/projects/${project.id}/slides/${selectedSlide.id}/polish`, {
                          method: "POST", headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ text, brandName: project.brandName ?? undefined, tone: "warm", field: "narration" }),
                        });
                        const data = await res.json();
                        if (res.ok) setPolishState({ slideId: selectedSlide.id, field: "narration", polished: data.polished, loading: false });
                        else setPolishState({ slideId: selectedSlide.id, field: "narration", polished: "", loading: false, error: data.error ?? "LLM unavailable" });
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
                  placeholder="🎤 What the narrator says during this slide…"
                  className={inputCls}
                  style={{ resize: "vertical" }}
                />
                {polishState && !polishState.loading && polishState.slideId === selectedSlide.id && polishState.field === "narration" && (
                  polishState.error ? (
                    <div className="border border-orange-800/40 rounded-lg p-2.5 bg-orange-950/20 flex items-start justify-between gap-2">
                      <div>
                        <p className="text-[10px] text-orange-400 font-semibold">AI not configured</p>
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
                    <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">🌐 Translation</p>
                    <p className="text-xs text-white leading-snug">{translateState.translated}</p>
                    <div className="flex gap-2">
                      <button onClick={() => { patchSlide(selectedSlide.id, { narrationLine: translateState.translated }); setTranslateState(null); }} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-blue-900/40 border border-blue-700/40 text-blue-400 hover:bg-blue-900/60 transition-colors">Use</button>
                      <button onClick={() => setTranslateState(null)} className="flex-1 py-1 rounded-lg text-[11px] font-medium bg-[#1a1a2e] border border-[#2a2a40] text-[#6060a0] hover:text-white transition-colors">Dismiss</button>
                    </div>
                  </div>
                )}
              </div>

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
                  <label className={labelCls}>📐 Orientation</label>
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
                    <p className="text-[10px] text-[#7c5cfc] mt-1">🖼️ Portrait: blur fill applied — no stretching</p>
                  )}
                </div>
              </div>

              {/* Enhancement */}
              <div className={sectionCls}>
                <div className="flex items-center justify-between">
                  <p className={sectionTitle}>🎨 Enhancement</p>
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
                      <label className="text-[10px] text-[#6060a0]">🌈 Tint</label>
                      <div className="flex gap-1.5 mt-1">
                        {["none","warm","cool","golden","blue"].map(t => (
                          <button key={t} onClick={() => patchSlideEnhancement(selectedSlide.id, { tint: t })}
                            className={`flex-1 py-0.5 rounded text-[10px] border transition-colors capitalize ${(selectedSlide.enhancementSettings?.tint ?? "none") === t ? "border-[#7c5cfc] text-[#b090ff] bg-[#7c5cfc]/10" : "border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70]"}`}
                          >{t}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] text-[#6060a0]">🎭 Tone</label>
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

              {/* Motion Preset */}
              <div className={sectionCls}>
                <p className={sectionTitle}>🎬 Motion Effect</p>
                <p className="text-[10px] text-[#404060]">Per-slide Ken Burns motion. Auto = cycles through all effects.</p>
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
              <p className="text-xs text-[#404060]">👆 Select a slide to edit</p>
            </div>
          )}

          {/* ── Project settings ── */}
          <div className={sectionCls}>
            <p className={sectionTitle}>⚙️ Project</p>

            <div>
              <label className={labelCls}>🏷️ Brand name</label>
              <input type="text" value={project.brandName ?? ""} onChange={async e => patchProject({ brandName: e.target.value || null })} placeholder="🏷️ Your brand name" className={inputCls} />
            </div>

            {/* Global enhancement level */}
            <div>
              <label className={labelCls}>🎨 Global enhancement: {project.enhancementLevel ?? 50}</label>
              <input
                type="range" min={1} max={100} step={1}
                value={project.enhancementLevel ?? 50}
                onChange={e => patchProject({ enhancementLevel: Number(e.target.value) })}
                className="w-full accent-[#7c5cfc]"
              />
              <p className="text-[10px] text-[#404060] mt-0.5">🎨 Applied to all slides — override per-slide for fine control</p>
            </div>

            {/* Music selection */}
            <div>
              <label className={labelCls}>🎵 Background music</label>
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
                    📚 Library
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

              {/* Music library picker */}
              {showMusicLibrary && (
                <div className="mt-2 border border-[#2a2a40] rounded-lg bg-[#0d0d1a] p-2.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold text-[#7c5cfc] uppercase tracking-wider">🎵 Stock library</p>
                    <button onClick={() => setShowMusicLibrary(false)} className="text-[#6060a0] hover:text-white text-xs">✕</button>
                  </div>

                  {musicLibraryLoading ? (
                    <p className="text-[10px] text-[#6060a0]">Loading…</p>
                  ) : musicLibrary.length === 0 ? (
                    <p className="text-[10px] text-[#6060a0]">🎵 No stock tracks yet — download some below ⬇️</p>
                  ) : (
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {musicLibrary.map(t => (
                        <button
                          key={t.filename}
                          onClick={() => handleMusicFromLibrary(t.filename)}
                          className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg border border-[#2a2a40] hover:border-[#7c5cfc]/50 hover:bg-[#7c5cfc]/5 transition-colors"
                        >
                          <span className="text-[9px] px-1 py-0.5 rounded bg-[#2a2a40] text-[#6060a0] capitalize shrink-0">{t.mood}</span>
                          <span className="text-[11px] text-white truncate">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Download from Pixabay */}
                  <div className="border-t border-[#2a2a40] pt-2 space-y-1.5">
                    <p className="text-[10px] text-[#6060a0]">🔍 Search Pixabay (PIXABAY_API_KEY) or paste a direct .mp3 URL 🎵:</p>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={musicDownloadQuery}
                        onChange={e => setMusicDownloadQuery(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleMusicDownload(musicDownloadQuery); }}
                        placeholder="🎵 e.g. cinematic epic  or  https://…/track.mp3"
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
                {project.musicPath ? `🎵 ${project.musicSource === "uploaded" ? "Custom" : "Library"} track — mixed with narration at the volume below` : "🎵 No music selected — system will auto-generate background music"}
              </p>
            </div>

            {/* Music volume */}
            <div>
              <label className={labelCls}>🎵 Music volume: {Math.round(project.musicVolume * 100)}%</label>
              <input
                type="range" min={0} max={1} step={0.05}
                value={project.musicVolume}
                onChange={e => patchProject({ musicVolume: Number(e.target.value) })}
                className="w-full accent-[#7c5cfc]"
              />
            </div>

            {/* Narration volume */}
            <div>
              <label className={labelCls}>🎤 Narration volume: {Math.round(project.narrationVolume * 100)}%</label>
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
                onChange={e => patchProject({ targetDurationSec: e.target.value ? Number(e.target.value) : null })}
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

            {/* Slide Transitions */}
            <div className="border border-[#2a2a40] rounded-lg p-3 space-y-2 bg-[#0a0a18]">
              <p className="text-[11px] text-white font-semibold">🎬 Slide Transitions</p>
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
              <p className="text-[11px] text-white font-semibold">🤖 Caption AI limits</p>
              <p className="text-[10px] text-[#6060a0]">AI generates captions up to these limits. 🎤 Narration is always unlimited.</p>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className={labelCls}>🔢 Max words</label>
                  <input
                    type="number" min={1} max={50}
                    value={project.captionMaxWords ?? 8}
                    onChange={e => patchProject({ captionMaxWords: Math.max(1, Math.min(50, Number(e.target.value) || 8)) })}
                    className={inputCls}
                  />
                </div>
                <div className="flex-1">
                  <label className={labelCls}>🔡 Max chars (optional)</label>
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
              <label className={labelCls}>📣 CTA method</label>
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
                  <label className={labelCls}>📞 Primary contact</label>
                  <input type="text" value={project.ctaValue ?? ""} onChange={async e => patchProject({ ctaValue: e.target.value || null })} placeholder="📞 +234 xxx xxxx / @handle" className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>📱 Secondary contact (optional)</label>
                  <input type="text" value={project.ctaValueSecondary ?? ""} onChange={async e => patchProject({ ctaValueSecondary: e.target.value || null })} placeholder="📞 +234 xxx xxxx" className={inputCls} />
                </div>
              </>
            )}
          </div>

          {/* Narration script preview */}
          {narrationScriptLines.length > 0 && (
            <div style={{ border: "1px solid #2a2a40", borderRadius: 8, padding: "10px 14px", background: "#0f0f0f" }}>
              <p className="text-xs font-semibold text-[#b090ff] mb-2">🎤 Narration script (assembled)</p>
              <p className="text-[10px] text-[#6060a0] mb-2">🎤 This is exactly what the narrator will speak during render. ✏️ Edit each slide&apos;s narration line above.</p>
              <div className="space-y-1">
                {narrationScriptLines.map((line, i) => (
                  <p key={i} className="text-xs text-[#c0c0e0] leading-snug">{line}</p>
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
              <p style={{ fontSize: 13, fontWeight: 600, color: "#4a4a6a", margin: 0 }}>🖊️ Text & Image Overlays</p>
              <p style={{ fontSize: 11, color: "#3a3a55", marginTop: 4 }}>
                {renderStatus === "rendering" ? "⏳ Overlay available after render completes…" : "🚀 Render the project first to unlock overlays."}
              </p>
            </div>
          )}

          <div className="text-center text-[11px] text-[#404060] pb-2">
            {readyCount === project.slides.length && project.slides.length > 0
              ? <span className="text-green-500">✅ All {project.slides.length} slides ready to render!</span>
              : <span>🖼️ {readyCount} of {project.slides.length} slides ready</span>
            }
            {readyCount === 0 && <p>📸 Upload at least one image to render</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View = "list" | "new" | "editor" | "mode2";

export default function CommercialPage() {
  const [view,    setView]    = useState<View>("list");
  const [project, setProject] = useState<CommercialProject | null>(null);

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
        <CommercialEditor initialProject={project} onBack={() => { setProject(null); setView("list"); }} />
      </div>
    );
  }

  if (view === "mode2") {
    return (
      <div className="w-full p-1">
        <AiAdBuilder
          onBack={() => setView("list")}
          onOpenProject={p => { setProject(p); setView("editor"); }}
        />
      </div>
    );
  }

  return (
    <div className="w-full p-1">
      {/* Mode tabs */}
      <div className="flex gap-2 mb-4 max-w-2xl mx-auto">
        <button className="text-xs px-3 py-1.5 bg-[#7c5cfc]/20 border border-[#7c5cfc]/50 text-[#b090ff] rounded-lg font-medium">
          🖼️ Mode 1 — Slide Ad
        </button>
        <button onClick={() => setView("mode2")} className="text-xs px-3 py-1.5 bg-[#12121e] border border-[#2a2a40] text-[#6060a0] hover:border-[#4a4a70] hover:text-white rounded-lg font-medium transition-colors">
          🤖 Mode 2 — AI Ad ✨
        </button>
      </div>
      <ProjectList
        onOpen={p => {
          fetch(`/api/commercial/projects/${p.id}`).then(r => r.json()).then(full => { setProject(full); setView("editor"); });
        }}
        onNew={() => setView("new")}
      />
    </div>
  );
}
