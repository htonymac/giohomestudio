"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ds } from "../../../lib/designSystem";
import { Folder, Settings, Wand, Mic, Film, Check, X, Plus } from "../../components/icons";
import ModelChip from "../../components/ModelChip";
import { NarrationPreview } from "../../components/NarrationPreview";

// ── Types ────────────────────────────────────────────────────────────────────

type LayerType = "image" | "text" | "whatsapp" | "cta" | "price" | "shape";

interface Position { x: number; y: number; }
interface Size { width: number; height: number; }

interface AdLayer {
  id: string;
  type: LayerType;
  position: Position;
  size: Size;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  content: string;
  style: LayerStyle;
}

interface LayerStyle {
  fontSize?: number;
  fontWeight?: "normal" | "bold";
  fontFamily?: string;
  color?: string;
  bgColor?: string;
  bgPadding?: number;
  bgRadius?: number;
  textAlign?: "left" | "center" | "right";
  opacity?: number;
  shadow?: boolean;
  shadowColor?: string;
  borderColor?: string;
  borderWidth?: number;
  maxLines?: number;
  shrinkToFit?: boolean;
  iconType?: string;
  pillStyle?: string;
}

type CropPreset = "free" | "1:1" | "4:5" | "9:16" | "16:9";

interface CanvasState {
  width: number;
  height: number;
  background: string;
  backgroundFinish: "none" | "matte" | "gloss";
  layers: AdLayer[];
}

// ── Constants ────────────────────────────────────────────────────────────────

const CROP_PRESETS: { id: CropPreset; label: string; ratio?: number }[] = [
  { id: "free", label: "Free" },
  { id: "1:1", label: "1:1 Square", ratio: 1 },
  { id: "4:5", label: "4:5 Portrait", ratio: 4 / 5 },
  { id: "9:16", label: "9:16 Story", ratio: 9 / 16 },
  { id: "16:9", label: "16:9 Banner", ratio: 16 / 9 },
];

const BG_PRESETS = [
  { id: "white",        label: "White",          color: "#FFFFFF" },
  { id: "black",        label: "Black",          color: "#000000" },
  { id: "cream",        label: "Cream",          color: "#FFF8E7" },
  { id: "beige",        label: "Beige",          color: "#F5F0E8" },
  { id: "grey",         label: "Soft Grey",      color: "#E8E8E8" },
  { id: "charcoal",     label: "Charcoal",       color: "#333333" },
  { id: "red",          label: "Red",            color: "#DC2626" },
  { id: "orange",       label: "Orange",         color: "#F97316" },
  { id: "yellow",       label: "Yellow",         color: "#FACC15" },
  { id: "gold",         label: "Gold",           color: "#D4A843" },
  { id: "green",        label: "Green",          color: "#22C55E" },
  { id: "teal",         label: "Teal",           color: "#14B8A6" },
  { id: "sky",          label: "Sky Blue",       color: "#38BDF8" },
  { id: "blue",         label: "Blue",           color: "#2563EB" },
  { id: "navy",         label: "Navy",           color: "#1E3A8A" },
  { id: "purple",       label: "Purple",         color: "#7C3AED" },
  { id: "pink",         label: "Pink",           color: "#EC4899" },
  { id: "rose",         label: "Rose",           color: "#F43F5E" },
  { id: "pastel_pink",  label: "Pastel Pink",    color: "#FBCFE8" },
  { id: "pastel_blue",  label: "Pastel Blue",    color: "#BFDBFE" },
  { id: "pastel_green", label: "Pastel Green",   color: "#BBF7D0" },
  { id: "pastel_yellow",label: "Pastel Yellow",  color: "#FEF08A" },
];

const GRADIENT_PRESETS = [
  { id: "sunset", label: "Sunset", css: "linear-gradient(135deg, #f97316, #ec4899)" },
  { id: "ocean", label: "Ocean", css: "linear-gradient(135deg, #0ea5e9, #6366f1)" },
  { id: "forest", label: "Forest", css: "linear-gradient(135deg, #16a34a, #0d9488)" },
  { id: "royal", label: "Royal", css: "linear-gradient(135deg, #7c3aed, #2563eb)" },
  { id: "gold_black", label: "Gold Premium", css: "linear-gradient(135deg, #1a1a1a, #d4a843)" },
  { id: "soft_pink", label: "Soft Pink", css: "linear-gradient(135deg, #fce7f3, #fdf2f8)" },
  { id: "dark_blue", label: "Dark Blue", css: "linear-gradient(135deg, #0f172a, #1e3a5f)" },
  { id: "warm_cream", label: "Warm Cream", css: "linear-gradient(135deg, #fef3c7, #f5f0e8)" },
];

// ── Ad Templates (JSON-driven) ──────────────────────────────────────────────

interface AdTemplate {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  canvasWidth: number;
  canvasHeight: number;
  background: string;
  backgroundFinish: "none" | "matte" | "gloss";
  layers: Omit<AdLayer, "id">[];
}

const AD_TEMPLATES: AdTemplate[] = [
  { id: "tpl_product_sale", name: "Product Sale", category: "Product", thumbnail: "Sale",
    canvasWidth: 1080, canvasHeight: 1080, background: "#FFFFFF", backgroundFinish: "none",
    layers: [
      { type: "text", position: { x: 40, y: 60 }, size: { width: 1000, height: 80 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "MEGA SALE", style: { fontSize: 64, fontWeight: "bold", color: "#DC2626", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 160 }, size: { width: 1000, height: 50 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Up to 50% OFF all items", style: { fontSize: 24, fontWeight: "normal", color: "#666666", textAlign: "center", opacity: 1 } },
      { type: "price", position: { x: 390, y: 800 }, size: { width: 300, height: 60 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "$15,000", style: { fontSize: 32, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "cta", position: { x: 340, y: 900 }, size: { width: 400, height: 55 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "Shop Now", style: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF", bgColor: "#7c5cfc", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "whatsapp", position: { x: 330, y: 990 }, size: { width: 420, height: 44 }, rotation: 0, zIndex: 6, locked: false, visible: true, content: "+234 800 000 0000", style: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", bgColor: "#25D366", bgRadius: 20, bgPadding: 10, opacity: 1 } },
    ],
  },
  { id: "tpl_fashion", name: "Fashion Promo", category: "Fashion", thumbnail: "Fashion",
    canvasWidth: 1080, canvasHeight: 1350, background: "#1A1A1A", backgroundFinish: "matte",
    layers: [
      { type: "text", position: { x: 40, y: 80 }, size: { width: 1000, height: 70 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "NEW COLLECTION", style: { fontSize: 48, fontWeight: "bold", color: "#D4A843", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 170 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Spring / Summer 2026", style: { fontSize: 20, fontWeight: "normal", color: "#999999", textAlign: "center", opacity: 1 } },
      { type: "cta", position: { x: 340, y: 1200 }, size: { width: 400, height: 55 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "Explore Now", style: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A", bgColor: "#D4A843", bgRadius: 8, bgPadding: 14, textAlign: "center", opacity: 1 } },
    ],
  },
  { id: "tpl_realestate", name: "Property Flyer", category: "Real Estate", thumbnail: "Property",
    canvasWidth: 1080, canvasHeight: 1350, background: "#F5F0E8", backgroundFinish: "matte",
    layers: [
      { type: "text", position: { x: 40, y: 60 }, size: { width: 1000, height: 70 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "LUXURY APARTMENT", style: { fontSize: 44, fontWeight: "bold", color: "#1A1A1A", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 140 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Downtown, City Centre", style: { fontSize: 20, fontWeight: "normal", color: "#666", textAlign: "center", opacity: 1 } },
      { type: "price", position: { x: 340, y: 1100 }, size: { width: 400, height: 60 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "$60,000/night", style: { fontSize: 28, fontWeight: "bold", color: "#FFFFFF", bgColor: "#7c5cfc", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "text", position: { x: 40, y: 1180 }, size: { width: 1000, height: 30 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "24/7 Security  •  Smart TV  •  Free WiFi  •  Parking", style: { fontSize: 16, fontWeight: "normal", color: "#555", textAlign: "center", opacity: 1 } },
      { type: "whatsapp", position: { x: 330, y: 1260 }, size: { width: 420, height: 44 }, rotation: 0, zIndex: 6, locked: false, visible: true, content: "+234 800 000 0000", style: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", bgColor: "#25D366", bgRadius: 20, bgPadding: 10, opacity: 1 } },
    ],
  },
  { id: "tpl_food", name: "Food Menu Promo", category: "Food", thumbnail: "Food",
    canvasWidth: 1080, canvasHeight: 1080, background: "#1a0a00", backgroundFinish: "none",
    layers: [
      { type: "text", position: { x: 40, y: 60 }, size: { width: 1000, height: 70 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "TODAY'S SPECIAL", style: { fontSize: 52, fontWeight: "bold", color: "#f97316", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 150 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Grilled Chicken & Fresh Salad", style: { fontSize: 24, fontWeight: "bold", color: "#FFFFFF", textAlign: "center", opacity: 1 } },
      { type: "price", position: { x: 390, y: 850 }, size: { width: 300, height: 60 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "$3,500", style: { fontSize: 32, fontWeight: "bold", color: "#1a0a00", bgColor: "#f97316", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "cta", position: { x: 340, y: 940 }, size: { width: 400, height: 50 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "Order Now", style: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF", bgColor: "#dc2626", bgRadius: 8, bgPadding: 12, textAlign: "center", opacity: 1 } },
    ],
  },
  { id: "tpl_event", name: "Event Flyer", category: "Event", thumbnail: "Event",
    canvasWidth: 1080, canvasHeight: 1350, background: "#0f0a2e", backgroundFinish: "none",
    layers: [
      { type: "text", position: { x: 40, y: 80 }, size: { width: 1000, height: 80 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "LIVE CONCERT", style: { fontSize: 56, fontWeight: "bold", color: "#FFFFFF", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 180 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Saturday, April 15 • 7PM", style: { fontSize: 22, fontWeight: "normal", color: "#a080ff", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 240 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "Grand Convention Centre, City Hall", style: { fontSize: 18, fontWeight: "normal", color: "#6060a0", textAlign: "center", opacity: 1 } },
      { type: "cta", position: { x: 290, y: 1200 }, size: { width: 500, height: 55 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "Get Tickets Now", style: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF", bgColor: "#ec4899", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
    ],
  },
];

const WHATSAPP_PRESETS = [
  { id: "green_pill", label: "Green Pill", bg: "#25D366", color: "#FFFFFF", radius: 20 },
  { id: "black_bar", label: "Black Bar", bg: "#1A1A1A", color: "#FFFFFF", radius: 4 },
  { id: "white_card", label: "White Card", bg: "#FFFFFF", color: "#333333", radius: 8 },
  { id: "bottom_strip", label: "Bottom Strip", bg: "#F0F0F0", color: "#333333", radius: 0 },
];

const CTA_LABELS = ["Order Now", "Limited Offer", "New Arrival", "Promo Price", "Call Now", "Available Now", "Shop Now", "Book Now"];

let _layerIdCounter = 0;
function nextLayerId(type: string) { return `${type}_${Date.now()}_${++_layerIdCounter}`; }

// ── Persistence helpers ─────────────────────────────────────────────────────

interface ProjectSummary {
  id: string;
  name: string;
  type: string;
  canvasWidth: number;
  canvasHeight: number;
  updatedAt: string;
  _count: { layers: number };
}

interface DbLayer {
  id: string;
  type: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
  rotation: number;
  zIndex: number;
  locked: boolean;
  visible: boolean;
  content: string;
  style: Record<string, unknown>;
}

function canvasToPayload(canvas: CanvasState, projectId?: string, name?: string) {
  return {
    id: projectId,
    name: name ?? "Untitled Ad",
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    background: canvas.background,
    backgroundFinish: canvas.backgroundFinish,
    layers: canvas.layers.map(l => ({
      type: l.type,
      positionX: l.position.x,
      positionY: l.position.y,
      width: l.size.width,
      height: l.size.height,
      rotation: l.rotation,
      zIndex: l.zIndex,
      locked: l.locked,
      visible: l.visible,
      content: l.content,
      style: l.style as Record<string, unknown>,
    })),
  };
}

function dbLayerToLocal(l: DbLayer): AdLayer {
  return {
    id: l.id,
    type: l.type as LayerType,
    position: { x: l.positionX, y: l.positionY },
    size: { width: l.width, height: l.height },
    rotation: l.rotation,
    zIndex: l.zIndex,
    locked: l.locked,
    visible: l.visible,
    content: l.content,
    style: l.style as LayerStyle,
  };
}

// ── Shared styles ────────────────────────────────────────────────────────────

const panelBg  = ds.color.card;
const panelBorder = ds.color.line;
const sectionTitle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: ds.color.mute,
  textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8,
  fontFamily: ds.font.mono,
};
const btnSm: React.CSSProperties = {
  fontSize: 11, padding: "5px 10px", borderRadius: ds.radius.xs,
  border: `1px solid ${ds.color.line2}`, background: ds.color.paper,
  color: ds.color.lilac, cursor: "pointer", fontWeight: 600,
};
const inputSm: React.CSSProperties = {
  width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: ds.radius.xs,
  border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.ink2,
};

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdEditorPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: ds.color.mute, fontFamily: ds.font.mono }}>Loading editor...</div>}><AdEditorInner /></Suspense>;
}

function AdEditorInner() {
  const searchParams = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [canvas, setCanvas] = useState<CanvasState>({
    width: 1080, height: 1080, background: "#FFFFFF", backgroundFinish: "none", layers: [],
  });

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Ad");
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [cropPreset, setCropPreset] = useState<CropPreset>("1:1");
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [customBg, setCustomBg] = useState("#FFFFFF");
  const [currency, setCurrency] = useState("$");
  const [exporting, setExporting] = useState(false);
  const [templateLoaded, setTemplateLoaded] = useState(false);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [enhancing, setEnhancing] = useState(false);

  const [aiBgPrompt, setAiBgPrompt] = useState("");
  const [aiBgLoading, setAiBgLoading] = useState(false);
  const [aiBgResult, setAiBgResult] = useState<string | null>(null);
  const [aiBgType, setAiBgType] = useState<"ai" | "import" | "white">("ai");
  const bgFileRef = useRef<HTMLInputElement>(null);
  const layerizeFileRef = useRef<HTMLInputElement>(null);

  const [ideogramPrompt, setIdeogramPrompt] = useState("");
  const [ideogramLoading, setIdeogramLoading] = useState(false);

  const [layerizeLoading, setLayerizeLoading] = useState(false);
  const [layerizeResult, setLayerizeResult] = useState<{ background_url?: string; text_containers?: unknown[] } | null>(null);

  const [ttsText, setTtsText] = useState("");
  const [ttsVoice, setTtsVoice] = useState("Aoede");
  const [ttsSpeed, setTtsSpeed] = useState(1.0);
  const [ttsPitch, setTtsPitch] = useState<"low" | "medium" | "high">("medium");
  const [ttsLoading, setTtsLoading] = useState(false);
  const [ttsResult, setTtsResult] = useState<string | null>(null);
  // NarrationPreview subtitle sync — ad-editor uses Gemini TTS which returns no word timings.
  // wordTimings stays null so NarrationPreview renders a static caption strip.
  const ttsWordTimings = null as Array<{ word: string; startMs: number; endMs: number }> | null;
  const [bgGradient, setBgGradient] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"ad" | "movie" | "banner" | "text_to_image">("ad");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [versionHistory, setVersionHistory] = useState<{ url: string; label: string; modelId?: string }[]>([]);
  const [aiBgResultModelId, setAiBgResultModelId] = useState<string | null>(null);
  const [currentImageModelId, setCurrentImageModelId] = useState<string | null>(null);

  const [leftTab, setLeftTab] = useState<"setup" | "ai" | "content" | "audio">("setup");

  const [selectedImageModel, setSelectedImageModel] = useState<string>("fal_flux_schnell");
  const [selectedBgModel, setSelectedBgModel] = useState<string>("segmind_pruna");
  const [availableModels, setAvailableModels] = useState<{ id: string; display_name: string; provider_name: string; type: string; cost_to_henry: number }[]>([]);

  const [clarifyOpen, setClarifyOpen] = useState(false);
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<string[]>([]);
  const [clarifyOriginalPrompt, setClarifyOriginalPrompt] = useState("");
  const [clarifyContinue, setClarifyContinue] = useState<((finalPrompt: string) => void) | null>(null);

  const selectedLayer = canvas.layers.find(l => l.id === selectedId) ?? null;

  useEffect(() => {
    fetch("/api/ad-editor/project").then(r => r.json()).then(d => {
      if (d.projects) setProjectList(d.projects);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/models")
      .then(r => r.json())
      .then(d => setAvailableModels(Array.isArray(d.models) ? d.models : []))
      .catch(() => {});
    try {
      const savedImg = localStorage.getItem("ghs_ad_editor_image_model");
      if (savedImg) setSelectedImageModel(savedImg);
      const savedBg = localStorage.getItem("ghs_ad_editor_bg_model");
      if (savedBg) setSelectedBgModel(savedBg);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem("ghs_ad_editor_image_model", selectedImageModel); } catch { /* ignore */ }
  }, [selectedImageModel]);
  useEffect(() => {
    try { localStorage.setItem("ghs_ad_editor_bg_model", selectedBgModel); } catch { /* ignore */ }
  }, [selectedBgModel]);

  const GENERIC_PROMPT_RE = /^\s*(generate|make|create|draw|design)\s+(a|an|the)?\s*(image|bg|background|picture|pic|photo|scene)\s*\.?\s*$/i;
  async function clarifyPromptIfNeeded(prompt: string, context: "image" | "video" | "bg"): Promise<string | null> {
    const p = prompt.trim();
    if (!p) return prompt;
    const shouldCheck = p.length < 15 || GENERIC_PROMPT_RE.test(p);
    if (!shouldCheck) return prompt;
    try {
      const res = await fetch("/api/llm/clarify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, context }),
      });
      const data = await res.json();
      if (!data?.needsClarification || !Array.isArray(data.clarifications) || data.clarifications.length === 0) {
        return typeof data?.refinedPrompt === "string" && data.refinedPrompt ? data.refinedPrompt : prompt;
      }
      return await new Promise<string | null>((resolve) => {
        setClarifyQuestions(data.clarifications as string[]);
        setClarifyAnswers(new Array((data.clarifications as string[]).length).fill(""));
        setClarifyOriginalPrompt(prompt);
        setClarifyContinue(() => (finalPrompt: string) => {
          setClarifyOpen(false);
          resolve(finalPrompt);
        });
        setClarifyOpen(true);
      });
    } catch {
      return prompt;
    }
  }

  useEffect(() => {
    const pid = searchParams.get("project");
    if (!pid || projectId) return;
    fetch(`/api/ad-editor/project/${pid}`).then(r => r.json()).then(d => {
      if (d.project) {
        setProjectId(d.project.id);
        setProjectName(d.project.name);
        setCanvas({
          width: d.project.canvasWidth,
          height: d.project.canvasHeight,
          background: d.project.background,
          backgroundFinish: d.project.backgroundFinish as "none" | "matte" | "gloss",
          layers: (d.project.layers as DbLayer[]).map(dbLayerToLocal),
        });
        if (d.project.gradient) setBgGradient(d.project.gradient);
      }
    }).catch(() => {});
  }, [searchParams, projectId]);

  async function saveProject(canvasState?: CanvasState) {
    const c = canvasState ?? canvas;
    if (c.layers.length === 0 && !projectId) return;
    setSaving(true);
    try {
      const payload = canvasToPayload(c, projectId ?? undefined, projectName);
      if (bgGradient) (payload as Record<string, unknown>).gradient = bgGradient;
      const res = await fetch("/api/ad-editor/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.project) {
        if (!projectId) setProjectId(data.project.id);
        setLastSaved(new Date().toLocaleTimeString());
        fetch("/api/ad-editor/project").then(r => r.json()).then(d => {
          if (d.projects) setProjectList(d.projects);
        }).catch(() => {});
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  useEffect(() => {
    if (canvas.layers.length === 0 && !projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveProject(canvas); }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, projectName]);

  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/ad-editor/project/${id}`);
      const data = await res.json();
      if (data.project) {
        setProjectId(data.project.id);
        setProjectName(data.project.name);
        setCanvas({
          width: data.project.canvasWidth,
          height: data.project.canvasHeight,
          background: data.project.background,
          backgroundFinish: data.project.backgroundFinish as "none" | "matte" | "gloss",
          layers: (data.project.layers as DbLayer[]).map(dbLayerToLocal),
        });
        setBgGradient(data.project.gradient ?? null);
        setSelectedId(null);
        setVersionHistory([]);
        setShowProjectPicker(false);
      }
    } catch { /* ignore */ }
  }

  function newProject() {
    setProjectId(null);
    setProjectName("Untitled Ad");
    setCanvas({ width: 1080, height: 1080, background: "#FFFFFF", backgroundFinish: "none", layers: [] });
    setBgGradient(null);
    setSelectedId(null);
    setVersionHistory([]);
    setShowProjectPicker(false);
    setLastSaved(null);
  }

  async function deleteProject(id: string) {
    try {
      await fetch(`/api/ad-editor/project/${id}`, { method: "DELETE" });
      setProjectList(prev => prev.filter(p => p.id !== id));
      if (projectId === id) newProject();
    } catch { /* ignore */ }
  }

  async function handleBgRemove() {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    const bgIsUrl = typeof canvas.background === "string" && canvas.background.startsWith("url(");
    const bgUrl = bgIsUrl ? canvas.background.slice(4, -1).replace(/^["']|["']$/g, "") : null;
    if (!imgLayer && !bgUrl) {
      alert("No image to process. Import an image, generate a background, or add an image layer first.");
      return;
    }
    setBgRemoving(true);
    try {
      const sourceUrl = imgLayer?.content ?? bgUrl!;
      const imgRes = await fetch(sourceUrl);
      if (!imgRes.ok) throw new Error("Could not fetch image");
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "image.png");
      if (projectId) fd.append("projectId", projectId);
      const res = await fetch("/api/ad-editor/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.outputUrl) throw new Error(data.error ?? "Background removal failed");
      if (imgLayer) {
        setVersionHistory(prev => [...prev, { url: imgLayer.content, label: `v${prev.length + 1}` }]);
        updateLayer(imgLayer.id, { content: data.outputUrl });
      } else {
        setCanvas(prev => {
          const newLayer: AdLayer = {
            id: `img_${Date.now()}`, type: "image",
            position: { x: 0, y: 0 }, size: { width: prev.width, height: prev.height },
            rotation: 0, zIndex: 0, locked: false, visible: true,
            content: data.outputUrl, style: { opacity: 1 },
          };
          return { ...prev, background: "#FFFFFF", layers: [newLayer, ...prev.layers] };
        });
        setAiBgResult(null);
      }
    } catch (e) {
      alert(`Background removal failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    setBgRemoving(false);
  }

  async function handleEnhance() {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    if (!imgLayer) return;
    setEnhancing(true);
    try {
      const imgRes = await fetch(imgLayer.content);
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "image.png");
      fd.append("mode", "enhance");
      const res = await fetch("/api/image/enhance", { method: "POST", body: fd });
      const data = await res.json();
      if (data.outputUrl) {
        setVersionHistory(prev => [...prev, { url: imgLayer.content, label: `v${prev.length + 1}` }]);
        updateLayer(imgLayer.id, { content: data.outputUrl });
      }
    } catch { /* ignore */ }
    setEnhancing(false);
  }

  async function handleAiBg() {
    if (!aiBgPrompt.trim()) return;
    const clarified = await clarifyPromptIfNeeded(aiBgPrompt, "bg");
    if (clarified === null) return;
    const finalPrompt = clarified || aiBgPrompt;
    setAiBgLoading(true);
    try {
      const res = await fetch("/api/ad-editor/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "text_to_image", prompt: finalPrompt + " background, no text, full scene", projectId, modelId: selectedBgModel }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        setAiBgResult(data.outputUrl);
        setAiBgResultModelId(selectedBgModel);
        setCanvas(prev => ({ ...prev, background: `url(${data.outputUrl})` }));
      } else {
        setAiError(data.error || "Background generation failed — check AI keys/credits.");
      }
    } catch (e) { setAiError(e instanceof Error ? e.message : "Background generation failed"); }
    setAiBgLoading(false);
  }

  async function handleBgImport(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      if (!res.ok) { alert("Upload failed. Please try a smaller image."); return; }
      const data = await res.json();
      const url = `/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
      setAiBgResult(url);
      setCanvas(prev => ({ ...prev, background: `url(${url})` }));
      const hasImageLayer = canvas.layers.some(l => l.type === "image");
      if (hasImageLayer) {
        const doRemove = confirm("You've set a new background. Would you like to AI-remove the old background from your imported image so the new one shows through?");
        if (doRemove) await handleReplaceImageBg();
      }
    } catch {
      alert("Could not import that image. Check file type (JPG/PNG) and try again.");
    }
  }

  async function handleReplaceImageBg() {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    if (!imgLayer) { alert("No image layer found. Import an image first."); return; }
    setBgRemoving(true);
    try {
      const imgRes = await fetch(imgLayer.content);
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "image.png");
      if (projectId) fd.append("projectId", projectId);
      const res = await fetch("/api/ad-editor/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!data.outputUrl) throw new Error(data.error ?? "Bg removal failed");
      setVersionHistory(prev => [...prev, { url: imgLayer.content, label: `v${prev.length + 1}` }]);
      updateLayer(imgLayer.id, { content: data.outputUrl });
    } catch (e) {
      alert(`Replace background failed: ${e instanceof Error ? e.message : "unknown error"}`);
    }
    setBgRemoving(false);
  }

  async function handleIdeogramTransparent() {
    if (!ideogramPrompt.trim()) return;
    const clarified = await clarifyPromptIfNeeded(ideogramPrompt, "image");
    if (clarified === null) return;
    const finalPrompt = clarified || ideogramPrompt;
    setIdeogramLoading(true);
    try {
      const res = await fetch("/api/ad-editor/ideogram-transparent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: finalPrompt, projectId, modelId: selectedImageModel }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        const s = Math.round(canvas.width * 0.9);
        addLayer({
          id: nextLayerId("img"), type: "image",
          position: { x: Math.round((canvas.width - s) / 2), y: Math.round((canvas.height - s) / 2) },
          size: { width: s, height: s },
          rotation: 0, zIndex: canvas.layers.length + 1, locked: false, visible: true,
          content: data.outputUrl, style: { opacity: 1 },
        });
      } else {
        setAiError(data.error || "Transparent PNG generation failed.");
      }
    } catch (e) { setAiError(e instanceof Error ? e.message : "Generation failed"); }
    setIdeogramLoading(false);
  }

  async function handleLayerize() {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    if (!imgLayer) return;
    setLayerizeLoading(true);
    try {
      const res = await fetch("/api/ad-editor/layerize-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_url: imgLayer.content }),
      });
      const data = await res.json();
      if (data.ok) setLayerizeResult(data);
    } catch { /* ignore */ }
    setLayerizeLoading(false);
  }

  async function handleGeminiTts() {
    if (!ttsText.trim()) return;
    setTtsLoading(true);
    try {
      const res = await fetch("/api/ad-editor/gemini-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: ttsText, voice: ttsVoice, speed: ttsSpeed, pitch: ttsPitch, projectId }),
      });
      const data = await res.json();
      if (data.outputUrl) setTtsResult(data.outputUrl);
    } catch { /* ignore */ }
    setTtsLoading(false);
  }

  function loadAdTemplate(tpl: AdTemplate) {
    setCanvas({
      width: tpl.canvasWidth, height: tpl.canvasHeight,
      background: tpl.background, backgroundFinish: tpl.backgroundFinish,
      layers: tpl.layers.map((l) => ({ ...l, id: nextLayerId(l.type) } as AdLayer)),
    });
    setBgGradient(null);
    setSelectedId(null);
  }

  async function handleAiEdit() {
    if (!aiPrompt.trim()) return;
    let promptToUse = aiPrompt;
    if (aiMode === "text_to_image") {
      const clarified = await clarifyPromptIfNeeded(aiPrompt, "image");
      if (clarified === null) return;
      promptToUse = clarified || aiPrompt;
    }
    setAiLoading(true);
    setAiError("");
    try {
      let imageBase64: string | undefined;
      let imageMime: string | undefined;
      const imgLayer = canvas.layers.find(l => l.type === "image");
      if (imgLayer && aiMode !== "text_to_image") {
        const imgRes = await fetch(imgLayer.content);
        const blob = await imgRes.blob();
        imageMime = blob.type;
        const buf = await blob.arrayBuffer();
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      }
      const res = await fetch("/api/ad-editor/ai-edit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: aiMode, prompt: promptToUse, imageBase64, imageMime, projectId, modelId: selectedImageModel }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        const imgLayer2 = canvas.layers.find(l => l.type === "image");
        if (imgLayer2) {
          setVersionHistory(prev => [...prev, { url: imgLayer2.content, label: `v${prev.length + 1}`, modelId: currentImageModelId ?? undefined }]);
          updateLayer(imgLayer2.id, { content: data.outputUrl });
          setCurrentImageModelId(selectedImageModel);
        } else {
          addLayer({
            id: nextLayerId("img"), type: "image",
            position: { x: 40, y: 200 }, size: { width: 600, height: 600 },
            rotation: 0, zIndex: 1, locked: false, visible: true,
            content: data.outputUrl, style: { opacity: 1 },
          });
          setCurrentImageModelId(selectedImageModel);
        }
      } else {
        setAiError(data.error ?? "AI edit failed");
      }
    } catch { setAiError("Network error"); }
    setAiLoading(false);
  }

  function restoreVersion(url: string) {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    if (imgLayer) updateLayer(imgLayer.id, { content: url });
  }

  useEffect(() => {
    if (templateLoaded) return;
    const templateId = searchParams.get("template");
    const prompt = searchParams.get("prompt");
    const ar = searchParams.get("ar");
    if (ar) {
      const preset = CROP_PRESETS.find(c => c.id === ar);
      if (preset?.ratio) {
        setCropPreset(preset.id);
        const base = 1080;
        if (preset.ratio >= 1) setCanvas(prev => ({ ...prev, width: base, height: Math.round(base / preset.ratio!) }));
        else setCanvas(prev => ({ ...prev, width: Math.round(base * preset.ratio!), height: base }));
      }
    }
    if (prompt && templateId) {
      const title = prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt;
      setCanvas(prev => ({
        ...prev,
        layers: [...prev.layers, {
          id: nextLayerId("txt"), type: "text" as const,
          position: { x: 40, y: 40 }, size: { width: 500, height: 80 },
          rotation: 0, zIndex: 1, locked: false, visible: true,
          content: title,
          style: { fontSize: 36, fontWeight: "bold", fontFamily: "Arial", color: "#1A1A1A", textAlign: "center", opacity: 1, shrinkToFit: true },
        }],
      }));
      setTemplateLoaded(true);
    }
  }, [searchParams, templateLoaded]);

  function applyCrop(preset: CropPreset) {
    setCropPreset(preset);
    const p = CROP_PRESETS.find(c => c.id === preset);
    if (!p?.ratio) return;
    const base = 1080;
    if (p.ratio >= 1) setCanvas(prev => ({ ...prev, width: base, height: Math.round(base / p.ratio!) }));
    else setCanvas(prev => ({ ...prev, width: Math.round(base * p.ratio!), height: base }));
  }

  function addLayer(layer: AdLayer) {
    setCanvas(prev => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedId(layer.id);
  }

  function updateLayer(id: string, patch: Partial<AdLayer>) {
    setCanvas(prev => ({ ...prev, layers: prev.layers.map(l => l.id === id ? { ...l, ...patch } : l) }));
  }

  function updateLayerStyle(id: string, patch: Partial<LayerStyle>) {
    setCanvas(prev => ({ ...prev, layers: prev.layers.map(l => l.id === id ? { ...l, style: { ...l.style, ...patch } } : l) }));
  }

  function removeLayer(id: string) {
    setCanvas(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  async function handleImageUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      if (!res.ok) return;
      const data = await res.json();
      const url = `/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
      // Fit the imported image to the canvas (~90%, keep aspect ratio, centered) so it fills the editor.
      const addFitted = (w: number, h: number) => addLayer({
        id: nextLayerId("img"), type: "image",
        position: { x: Math.round((canvas.width - w) / 2), y: Math.round((canvas.height - h) / 2) },
        size: { width: w, height: h },
        rotation: 0, zIndex: canvas.layers.length + 1, locked: false, visible: true,
        content: url, style: { opacity: 1 },
      });
      const probe = new window.Image();
      probe.onload = () => {
        const scale = Math.min((canvas.width * 0.9) / probe.naturalWidth, (canvas.height * 0.9) / probe.naturalHeight, 1);
        addFitted(Math.round(probe.naturalWidth * scale), Math.round(probe.naturalHeight * scale));
      };
      probe.onerror = () => { const s = Math.round(canvas.width * 0.9); addFitted(s, s); };
      probe.src = url;
    } catch { /* ignore */ }
  }

  function addTextBlock(text: string, preset?: Partial<LayerStyle>) {
    addLayer({
      id: nextLayerId("txt"), type: "text",
      position: { x: 40, y: canvas.height / 2 }, size: { width: 500, height: 60 },
      rotation: 0, zIndex: canvas.layers.length + 1, locked: false, visible: true,
      content: text,
      style: { fontSize: 32, fontWeight: "bold", fontFamily: "Arial", color: "#1A1A1A", textAlign: "center", opacity: 1, shrinkToFit: true, ...preset },
    });
  }

  function addWhatsAppBlock(preset: typeof WHATSAPP_PRESETS[0]) {
    addLayer({
      id: nextLayerId("wa"), type: "whatsapp",
      position: { x: 40, y: canvas.height - 100 }, size: { width: 320, height: 44 },
      rotation: 0, zIndex: canvas.layers.length + 1, locked: false, visible: true,
      content: "+234 800 000 0000",
      style: { fontSize: 16, fontWeight: "bold", color: preset.color, bgColor: preset.bg, bgRadius: preset.radius, bgPadding: 10, opacity: 1, iconType: "whatsapp", pillStyle: preset.id },
    });
  }

  function addCTA(label: string) {
    addLayer({
      id: nextLayerId("cta"), type: "cta",
      position: { x: canvas.width / 2 - 100, y: canvas.height - 160 }, size: { width: 200, height: 48 },
      rotation: 0, zIndex: canvas.layers.length + 1, locked: false, visible: true,
      content: label,
      style: { fontSize: 18, fontWeight: "bold", color: "#FFFFFF", bgColor: "#7c5cfc", bgRadius: 10, bgPadding: 12, textAlign: "center", opacity: 1, shadow: true },
    });
  }

  function addPriceBadge() {
    addLayer({
      id: nextLayerId("price"), type: "price",
      position: { x: canvas.width - 240, y: 40 }, size: { width: 200, height: 50 },
      rotation: 0, zIndex: canvas.layers.length + 1, locked: false, visible: true,
      content: `${currency}25,000`,
      style: { fontSize: 28, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e", bgRadius: 8, bgPadding: 12, textAlign: "center", opacity: 1, shadow: true },
    });
  }

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const sorted = [...canvas.layers].sort((a, b) => b.zIndex - a.zIndex);
    for (const layer of sorted) {
      if (layer.locked || !layer.visible) continue;
      if (mx >= layer.position.x && mx <= layer.position.x + layer.size.width &&
          my >= layer.position.y && my <= layer.position.y + layer.size.height) {
        setSelectedId(layer.id);
        setDragging({ id: layer.id, offsetX: mx - layer.position.x, offsetY: my - layer.position.y });
        return;
      }
    }
    setSelectedId(null);
  }, [canvas]);

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;
    const x = Math.max(0, Math.min(canvas.width, mx - dragging.offsetX));
    const y = Math.max(0, Math.min(canvas.height, my - dragging.offsetY));
    updateLayer(dragging.id, { position: { x: Math.round(x), y: Math.round(y) } });
  }, [dragging, canvas.width, canvas.height]);

  const handleCanvasMouseUp = useCallback(() => { setDragging(null); }, []);

  async function handleExport(format: "png" | "jpg") {
    setExporting(true);
    try {
      const res = await fetch("/api/ad-editor/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canvas, format }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = `ad_export_${Date.now()}.${format}`; a.click();
        URL.revokeObjectURL(url);
        const fd = new FormData();
        fd.append("file", new File([blob], `ad_export_${Date.now()}.${format}`, { type: format === "jpg" ? "image/jpeg" : "image/png" }));
        fd.append("type", "image");
        fd.append("name", `Ad Export ${new Date().toLocaleString()}`);
        fd.append("source", "ad_editor");
        fd.append("description", `Exported from Ad Editor — ${canvas.width}x${canvas.height}`);
        fetch("/api/assets", { method: "POST", body: fd }).catch(() => {});
      }
    } catch { /* ignore */ }
    setExporting(false);
  }

  const maxCanvasDisplay = 520;
  const displayScale = Math.min(maxCanvasDisplay / canvas.width, maxCanvasDisplay / canvas.height);
  const displayW = canvas.width * displayScale;
  const displayH = canvas.height * displayScale;

  // ── Left tab icon map ──
  const leftTabs: { id: "setup" | "ai" | "content" | "audio"; label: string; icon: React.ReactNode }[] = [
    { id: "setup",   label: "Setup",   icon: <Settings size={13} color="currentColor" /> },
    { id: "ai",      label: "AI",      icon: <Wand size={13} color="currentColor" /> },
    { id: "content", label: "Content", icon: <Film size={13} color="currentColor" /> },
    { id: "audio",   label: "Audio",   icon: <Mic size={13} color="currentColor" /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", overflow: "hidden" }}>

      {/* ── PROJECT BAR ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: ds.color.sidebar, borderBottom: `1px solid ${ds.color.line}`, flexShrink: 0 }}>
        <input
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink, background: "transparent", border: `1px solid transparent`, borderRadius: ds.radius.xs, padding: "2px 8px", width: 180 }}
          onFocus={e => { e.target.style.borderColor = ds.color.lilac; }}
          onBlur={e => { e.target.style.borderColor = "transparent"; }}
        />
        <button onClick={() => saveProject()} disabled={saving}
          title="Save project to cloud (DB)"
          style={{ ...btnSm, fontSize: 10, background: saving ? ds.color.card : ds.color.lilac, color: saving ? ds.color.mute : "#fff", borderColor: ds.color.lilac }}>
          {saving ? "Saving..." : "Save Project"}
        </button>
        <button onClick={() => handleExport("png")} disabled={exporting}
          title="Download current canvas as PNG"
          style={{ ...btnSm, fontSize: 10, background: exporting ? ds.color.card : ds.color.mint, color: exporting ? ds.color.mute : ds.color.paper, borderColor: ds.color.mint }}>
          {exporting ? "..." : "Download PNG"}
        </button>
        <button onClick={newProject} style={{ ...btnSm, fontSize: 10 }}>New</button>
        <button onClick={() => setShowProjectPicker(!showProjectPicker)} style={{ ...btnSm, fontSize: 10 }}>
          Projects ({projectList.length})
        </button>
        {lastSaved && <span style={{ fontSize: 9, color: ds.color.mute2, marginLeft: "auto", fontFamily: ds.font.mono }}>Saved {lastSaved}</span>}
        {projectId && <span style={{ fontSize: 9, color: ds.color.mute2, marginLeft: lastSaved ? 8 : "auto", fontFamily: ds.font.mono }}>{projectId.slice(0, 8)}...</span>}
      </div>

      {/* ── PROJECT PICKER DROPDOWN ── */}
      {showProjectPicker && (
        <div style={{ background: ds.color.card, borderBottom: `1px solid ${ds.color.line}`, padding: "10px 14px", flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: ds.color.ink, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: ds.font.mono }}>
              All Projects · {projectList.length}
            </span>
            <input
              value={projectFilter}
              onChange={e => setProjectFilter(e.target.value)}
              placeholder="Search projects…"
              style={{ flex: 1, maxWidth: 240, fontSize: 11, background: ds.color.paper, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, padding: "4px 8px", borderRadius: ds.radius.xs, outline: "none" }}
            />
            <button onClick={() => setShowProjectPicker(false)}
              style={{ fontSize: 10, color: ds.color.mute, background: "none", border: `1px solid ${ds.color.line2}`, padding: "3px 8px", borderRadius: ds.radius.xs, cursor: "pointer" }}>
              Close
            </button>
          </div>
          <div style={{ maxHeight: 420, overflowY: "auto", paddingRight: 4, scrollbarColor: `${ds.color.mute2} transparent`, scrollbarWidth: "thin" }}>
            {projectList.length === 0 && <p style={{ fontSize: 11, color: ds.color.mute, padding: "16px 0", textAlign: "center" }}>No saved projects yet. Click <b>Save Project</b> to create one.</p>}
            {projectList
              .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
              .map(p => (
              <div key={p.id}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: ds.radius.xs, marginBottom: 3, background: projectId === p.id ? `${ds.color.lilac}18` : `rgba(255,255,255,0.02)`, cursor: "pointer", border: `1px solid ${projectId === p.id ? `${ds.color.lilac}40` : "transparent"}`, transition: "background 0.1s" }}
                onMouseEnter={e => { if (projectId !== p.id) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                onMouseLeave={e => { if (projectId !== p.id) e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
                onClick={() => loadProject(p.id)}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 12, color: ds.color.ink, fontWeight: projectId === p.id ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                  <div style={{ fontSize: 9, color: ds.color.mute, marginTop: 2, fontFamily: ds.font.mono }}>
                    {p.canvasWidth}×{p.canvasHeight} · {p._count.layers} layers · {new Date(p.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <button onClick={e => { e.stopPropagation(); if (confirm(`Delete project "${p.name}"?`)) deleteProject(p.id); }}
                  style={{ fontSize: 10, color: ds.color.coral, background: `${ds.color.coral}10`, border: `1px solid ${ds.color.coral}30`, cursor: "pointer", padding: "3px 8px", borderRadius: ds.radius.xs, flexShrink: 0, marginLeft: 8 }}>
                  Delete
                </button>
              </div>
            ))}
            {projectList.length > 0 && projectFilter &&
              projectList.filter(p => p.name.toLowerCase().includes(projectFilter.toLowerCase())).length === 0 && (
                <p style={{ fontSize: 11, color: ds.color.mute, padding: "12px 0", textAlign: "center" }}>No projects match &ldquo;{projectFilter}&rdquo;</p>
              )}
          </div>
        </div>
      )}

    <div style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden" }}>

      {/* ── LEFT PANEL ── */}
      <div style={{ width: 240, flexShrink: 0, background: panelBg, borderRight: `1px solid ${panelBorder}`, overflowY: "auto", padding: 0 }}>
        {/* Tab bar */}
        <div style={{ position: "sticky", top: 0, zIndex: 10, background: panelBg, borderBottom: `1px solid ${panelBorder}`, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", height: 36 }}>
          {leftTabs.map(t => (
            <button key={t.id} onClick={() => setLeftTab(t.id)} title={t.label}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
                fontSize: 10, fontWeight: 700, fontFamily: ds.font.mono,
                color: leftTab === t.id ? ds.color.lilac : ds.color.mute,
                background: leftTab === t.id ? `${ds.color.lilac}12` : "transparent",
                borderBottom: leftTab === t.id ? `2px solid ${ds.color.lilac}` : "2px solid transparent",
                borderTop: "none", borderLeft: "none", borderRight: "none",
                cursor: "pointer", padding: 0, transition: "background 0.12s",
              }}>
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div style={{ padding: "16px 14px" }}>

        {/* Templates — SETUP */}
        {leftTab === "setup" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Ad Templates</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {AD_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => loadAdTemplate(t)} title={t.name}
                  style={{ ...btnSm, fontSize: 9, padding: "4px 8px" }}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Upload — SETUP */}
        {leftTab === "setup" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Image</p>
            <button style={{ ...btnSm, width: "100%", marginBottom: 6, display: "flex", alignItems: "center", gap: 6, justifyContent: "center" }}
              onClick={() => fileInputRef.current?.click()}>
              <Plus size={11} color="currentColor" /> Upload Image
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
          </div>
        )}

        {/* Crop — SETUP */}
        {leftTab === "setup" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Crop / Size</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {CROP_PRESETS.map(p => (
                <button key={p.id} onClick={() => applyCrop(p.id)}
                  style={{ ...btnSm, fontSize: 10, padding: "3px 8px", background: cropPreset === p.id ? `${ds.color.lilac}20` : ds.color.paper, borderColor: cropPreset === p.id ? ds.color.lilac : ds.color.line2 }}>
                  {p.label}
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              <input type="number" value={canvas.width} onChange={e => setCanvas(prev => ({ ...prev, width: Number(e.target.value) || 1080 }))} style={{ ...inputSm, width: 70 }} />
              <span style={{ color: ds.color.mute, fontSize: 11, lineHeight: "28px" }}>x</span>
              <input type="number" value={canvas.height} onChange={e => setCanvas(prev => ({ ...prev, height: Number(e.target.value) || 1080 }))} style={{ ...inputSm, width: 70 }} />
            </div>
          </div>
        )}

        {/* Background — SETUP */}
        {leftTab === "setup" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Background — pick a color</p>
            <p style={{ fontSize: 9, color: ds.color.mute, marginBottom: 6, fontFamily: ds.font.mono }}>
              Click any color to apply instantly.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 4, marginBottom: 8 }}>
              {BG_PRESETS.map(p => (
                <button key={p.id} onClick={() => { setBgGradient(null); setAiBgResult(null); setCanvas(prev => ({ ...prev, background: p.color })); }}
                  title={p.label}
                  style={{
                    aspectRatio: "1/1", borderRadius: ds.radius.xs,
                    border: canvas.background === p.color ? `2px solid ${ds.color.lilac}` : p.color === "#FFFFFF" ? "1px solid #444" : `1px solid ${ds.color.line2}`,
                    background: p.color, cursor: "pointer",
                    boxShadow: canvas.background === p.color ? `0 0 0 2px ${ds.color.lilac}40` : "none",
                  }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", padding: "6px 8px", background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs }}>
              <input type="color" value={customBg}
                onChange={e => { setCustomBg(e.target.value); setBgGradient(null); setAiBgResult(null); setCanvas(prev => ({ ...prev, background: e.target.value })); }}
                style={{ width: 32, height: 28, border: "none", cursor: "pointer", borderRadius: 4, background: "none", padding: 0 }} />
              <span style={{ fontSize: 11, color: ds.color.ink2, fontWeight: 600 }}>Pick any color</span>
              <span style={{ fontSize: 9, color: ds.color.mute, marginLeft: "auto", fontFamily: ds.font.mono }}>{customBg}</span>
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
              {(["none", "matte", "gloss"] as const).map(f => (
                <button key={f} onClick={() => setCanvas(prev => ({ ...prev, backgroundFinish: f }))}
                  style={{ ...btnSm, fontSize: 9, padding: "2px 8px", background: canvas.backgroundFinish === f ? `${ds.color.lilac}20` : ds.color.paper, borderColor: canvas.backgroundFinish === f ? ds.color.lilac : ds.color.line2, textTransform: "capitalize" }}>
                  {f === "none" ? "Flat" : f}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 8, marginBottom: 4, fontFamily: ds.font.mono }}>Gradient</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {GRADIENT_PRESETS.map(g => (
                <button key={g.id} onClick={() => { setBgGradient(g.css); setCanvas(prev => ({ ...prev, background: g.css })); }}
                  title={g.label}
                  style={{ width: 24, height: 24, borderRadius: ds.radius.xs, background: g.css, border: bgGradient === g.css ? `2px solid ${ds.color.lilac}` : `1px solid ${ds.color.line2}`, cursor: "pointer" }} />
              ))}
              <button onClick={() => { setBgGradient(null); }} style={{ ...btnSm, fontSize: 8, padding: "2px 6px" }}>Clear</button>
            </div>
            {(() => {
              const hasImageLayer = canvas.layers.some(l => l.type === "image");
              const hasUrlBg = typeof canvas.background === "string" && canvas.background.startsWith("url(");
              const canRemove = hasImageLayer || hasUrlBg;
              return (
                <button onClick={handleBgRemove} disabled={bgRemoving || !canRemove}
                  title={canRemove ? "Removes the background inside the selected image (free, local AI) — then your canvas background shows through" : "Import or generate an image first"}
                  style={{ ...btnSm, width: "100%", marginTop: 8, fontSize: 10, opacity: bgRemoving || !canRemove ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                  <X size={11} color="currentColor" />
                  {bgRemoving ? "Removing…" : "Remove Image Background (free)"}
                </button>
              );
            })()}
            <button onClick={() => {
              const imgLayer = canvas.layers.find(l => l.type === "image");
              if (imgLayer) updateLayerStyle(imgLayer.id, { shadow: true, shadowColor: "rgba(0,0,0,0.3)" });
            }} disabled={!canvas.layers.some(l => l.type === "image")}
              style={{ ...btnSm, width: "100%", marginTop: 4, fontSize: 10 }}>
              + Studio Shadow
            </button>
            <button onClick={handleEnhance} disabled={enhancing || !canvas.layers.some(l => l.type === "image")}
              style={{ ...btnSm, width: "100%", marginTop: 4, fontSize: 10, color: enhancing ? ds.color.mute : ds.color.mint, borderColor: `${ds.color.mint}40` }}>
              {enhancing ? "Enhancing..." : "Enhance Image (AI)"}
            </button>
          </div>
        )}

        {/* Version History — SETUP */}
        {leftTab === "setup" && versionHistory.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Version History</p>
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {versionHistory.map((v, i) => (
                <button key={i} onClick={() => restoreVersion(v.url)} title={v.modelId ? `Generated with ${v.modelId}` : v.label}
                  style={{ flexShrink: 0, width: 44, height: 44, borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, overflow: "hidden", cursor: "pointer", padding: 0, position: "relative" }}>
                  <img src={v.url} alt={v.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  {v.modelId && (
                    <span style={{ position: "absolute", bottom: 1, right: 1, width: 6, height: 6, borderRadius: 999, background: "#7c5cfc", border: "1px solid #0e0e10" }} />
                  )}
                </button>
              ))}
            </div>
            <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 3, fontFamily: ds.font.mono }}>Click to restore. Dot = AI-generated.</p>
          </div>
        )}

        {/* Text — CONTENT */}
        {leftTab === "content" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Text</p>
            <button style={{ ...btnSm, width: "100%", marginBottom: 4 }} onClick={() => addTextBlock("Product Name")}>+ Product Title</button>
            <button style={{ ...btnSm, width: "100%", marginBottom: 4 }} onClick={() => addTextBlock("Subtitle text", { fontSize: 18, fontWeight: "normal", color: "#666666" })}>+ Subtitle</button>
            <div style={{ display: "flex", gap: 4 }}>
              <button style={{ ...btnSm, flex: 1 }} onClick={addPriceBadge}>+ Price Badge</button>
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                style={{ fontSize: 11, padding: "5px 6px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.ink2, cursor: "pointer", width: 52 }}>
                {["$", "€", "£", "₦", "¥", "₹", "R", "GH₵", "KSh", "Fr", "A$", "C$", "zł", "kr", "R$"].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* WhatsApp — CONTENT */}
        {leftTab === "content" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>WhatsApp / Contact</p>
            {WHATSAPP_PRESETS.map(p => (
              <button key={p.id} onClick={() => addWhatsAppBlock(p)}
                style={{ ...btnSm, width: "100%", marginBottom: 3, fontSize: 10 }}>
                {p.label}
              </button>
            ))}
          </div>
        )}

        {/* CTA — CONTENT */}
        {leftTab === "content" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>CTA Stickers</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
              {CTA_LABELS.map(l => (
                <button key={l} onClick={() => addCTA(l)} style={{ ...btnSm, fontSize: 9, padding: "3px 7px" }}>{l}</button>
              ))}
            </div>
          </div>
        )}

        {/* Export — CONTENT */}
        {leftTab === "content" && (
          <div>
            <p style={sectionTitle}>Export</p>
            <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
              <button style={{ ...btnSm, flex: 1, background: ds.color.lilac, color: "#fff", borderColor: ds.color.lilac }}
                onClick={() => handleExport("png")} disabled={exporting}>
                {exporting ? "..." : "PNG"}
              </button>
              <button style={{ ...btnSm, flex: 1 }} onClick={() => handleExport("jpg")} disabled={exporting}>JPG</button>
            </div>
            <p style={{ fontSize: 9, color: ds.color.mute, marginBottom: 4, fontFamily: ds.font.mono }}>Quick Resize & Export</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {[
                { label: "Instagram Post", w: 1080, h: 1080 },
                { label: "Instagram Story", w: 1080, h: 1920 },
                { label: "WhatsApp Status", w: 1080, h: 1920 },
                { label: "Flyer Portrait", w: 1080, h: 1350 },
                { label: "Website Banner", w: 1920, h: 640 },
                { label: "Marketplace", w: 800, h: 800 },
              ].map(p => (
                <button key={p.label} onClick={() => {
                  setCanvas(prev => ({ ...prev, width: p.w, height: p.h }));
                  setTimeout(() => handleExport("png"), 100);
                }} disabled={exporting}
                  style={{ ...btnSm, fontSize: 9, padding: "3px 8px", textAlign: "left", display: "flex", justifyContent: "space-between" }}>
                  <span>{p.label}</span>
                  <span style={{ color: ds.color.mute2, fontFamily: ds.font.mono }}>{p.w}x{p.h}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* AI Image Edit — AI */}
        {leftTab === "ai" && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>AI Image Edit</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginBottom: 6 }}>
              {([
                { id: "ad" as const, label: "For Ad" },
                { id: "movie" as const, label: "Movie" },
                { id: "banner" as const, label: "Banner" },
                { id: "text_to_image" as const, label: "Generate" },
              ]).map(m => (
                <button key={m.id} onClick={() => setAiMode(m.id)}
                  style={{ ...btnSm, fontSize: 9, padding: "3px 7px", background: aiMode === m.id ? `${ds.color.lilac}20` : ds.color.paper, borderColor: aiMode === m.id ? ds.color.lilac : ds.color.line2 }}>
                  {m.label}
                </button>
              ))}
            </div>
            <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2}
              placeholder={aiMode === "text_to_image" ? "Describe the image to generate..." : "e.g. remove background, make luxury, add premium lighting..."}
              style={{ ...inputSm, resize: "vertical", marginBottom: 6, fontSize: 11 }} />
            <label style={{ fontSize: 9, color: ds.color.mute, display: "block", marginBottom: 2, fontFamily: ds.font.mono }}>Model</label>
            <select value={selectedImageModel} onChange={e => setSelectedImageModel(e.target.value)}
              style={{ width: "100%", fontSize: 10, padding: "3px 6px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.gold, marginBottom: 6, cursor: "pointer" }}>
              {availableModels.filter(m => m.type === "image" || m.type === "image_edit").map(m => (
                <option key={m.id} value={m.id}>{m.display_name} — ${m.cost_to_henry.toFixed(3)}</option>
              ))}
              {availableModels.filter(m => m.type === "image" || m.type === "image_edit").length === 0 && (
                <option value={selectedImageModel}>{selectedImageModel}</option>
              )}
            </select>
            <button onClick={handleAiEdit} disabled={aiLoading || !aiPrompt.trim()}
              style={{ ...btnSm, width: "100%", background: aiLoading ? ds.color.card : `${ds.color.lilac}20`, color: aiLoading ? ds.color.mute : ds.color.lilac, borderColor: `${ds.color.lilac}40` }}>
              {aiLoading ? "Processing..." : aiMode === "text_to_image" ? "Generate Image" : "Edit with AI"}
            </button>
            {aiError && <p style={{ fontSize: 10, color: ds.color.coral, marginTop: 4 }}>{aiError}</p>}
          </div>
        )}

        {/* AI Background — AI */}
        {leftTab === "ai" && (
          <div style={{ marginBottom: 16, borderTop: `1px solid ${ds.color.line}`, paddingTop: 14 }}>
            <p style={sectionTitle}>AI Background</p>
            <div style={{ display: "flex", gap: 3, marginBottom: 8 }}>
              {(["ai", "import", "white"] as const).map(t => (
                <button key={t} onClick={() => setAiBgType(t)}
                  style={{ ...btnSm, flex: 1, fontSize: 9, padding: "3px 4px", background: aiBgType === t ? `${ds.color.mint}18` : ds.color.paper, borderColor: aiBgType === t ? ds.color.mint : ds.color.line2, color: aiBgType === t ? ds.color.mint : ds.color.lilac, textTransform: "capitalize" }}>
                  {t === "ai" ? "Generate" : t === "import" ? "Import" : "White"}
                </button>
              ))}
            </div>
            {aiBgType === "ai" && (
              <>
                <textarea value={aiBgPrompt} onChange={e => setAiBgPrompt(e.target.value)} rows={2}
                  placeholder="Describe background scene… e.g. luxury city skyline at sunset"
                  style={{ ...inputSm, resize: "none", marginBottom: 6, fontSize: 11 }} />
                <label style={{ fontSize: 9, color: ds.color.mute, display: "block", marginBottom: 2, fontFamily: ds.font.mono }}>Model</label>
                <select value={selectedBgModel} onChange={e => setSelectedBgModel(e.target.value)}
                  style={{ width: "100%", fontSize: 10, padding: "3px 6px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.gold, marginBottom: 6, cursor: "pointer" }}>
                  {availableModels.filter(m => m.type === "image" || m.type === "image_edit").map(m => (
                    <option key={m.id} value={m.id}>{m.display_name} — ${m.cost_to_henry.toFixed(3)}</option>
                  ))}
                  {availableModels.filter(m => m.type === "image" || m.type === "image_edit").length === 0 && (
                    <option value={selectedBgModel}>{selectedBgModel}</option>
                  )}
                </select>
                <button onClick={handleAiBg} disabled={aiBgLoading || !aiBgPrompt.trim()}
                  style={{ ...btnSm, width: "100%", background: aiBgLoading ? ds.color.card : `${ds.color.mint}18`, color: ds.color.mint, borderColor: `${ds.color.mint}40`, fontWeight: 700 }}>
                  {aiBgLoading ? "Generating…" : "Generate Background"}
                </button>
              </>
            )}
            {aiBgType === "import" && (
              <>
                <p style={{ fontSize: 9, color: ds.color.mute, marginBottom: 6, lineHeight: 1.4, fontFamily: ds.font.mono }}>
                  Upload your own background image (JPG/PNG).
                </p>
                <button style={{ ...btnSm, width: "100%", marginBottom: 4, color: ds.color.sky, borderColor: `${ds.color.sky}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onClick={() => bgFileRef.current?.click()}>
                  <Folder size={11} color="currentColor" /> Upload Background from Device
                </button>
                <input ref={bgFileRef} type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleBgImport(f); e.target.value = ""; }} />
              </>
            )}
            {aiBgType === "white" && (
              <button onClick={() => { setCanvas(prev => ({ ...prev, background: "#FFFFFF" })); setAiBgResult(null); }}
                style={{ ...btnSm, width: "100%", background: "#fff", color: "#000", borderColor: "rgba(255,255,255,0.4)", fontWeight: 700 }}>
                Set White Background
              </button>
            )}
            {aiBgResult && (
              <div style={{ marginTop: 8, borderRadius: ds.radius.xs, overflow: "hidden", border: `1px solid ${ds.color.line2}`, position: "relative" }}>
                <img src={aiBgResult} alt="AI Background" style={{ width: "100%", display: "block", maxHeight: 80, objectFit: "cover" }} />
                <ModelChip modelId={aiBgResultModelId} position="absolute" />
                <button onClick={() => { setAiBgResult(null); setAiBgResultModelId(null); setCanvas(prev => ({ ...prev, background: "#FFFFFF" })); }}
                  style={{ ...btnSm, width: "100%", fontSize: 9, borderRadius: 0 }}>Clear</button>
              </div>
            )}
            {canvas.layers.some(l => l.type === "image") && canvas.background !== "#FFFFFF" && (
              <button onClick={handleReplaceImageBg} disabled={bgRemoving}
                title="AI removes the existing background from your imported image so your new background shows through."
                style={{ ...btnSm, width: "100%", marginTop: 8, fontSize: 10, color: ds.color.gold, borderColor: `${ds.color.gold}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}>
                <Wand size={11} color="currentColor" />
                {bgRemoving ? "Working..." : "Apply Background to Image"}
              </button>
            )}
            <p style={{ fontSize: 9, color: ds.color.mute2, marginTop: 6, lineHeight: 1.4, fontFamily: ds.font.mono }}>
              Tip: Import or generate a background above, then click <b>Apply Background to Image</b>.
            </p>
          </div>
        )}

        {/* Transparent PNG — AI */}
        {leftTab === "ai" && (
          <div style={{ marginBottom: 16, borderTop: `1px solid ${ds.color.line}`, paddingTop: 14 }}>
            <p style={sectionTitle}>Transparent PNG (AI)</p>
            <p style={{ fontSize: 9, color: ds.color.mute, marginBottom: 6, fontFamily: ds.font.mono }}>Generate an object or logo with no background</p>
            <textarea value={ideogramPrompt} onChange={e => setIdeogramPrompt(e.target.value)} rows={2}
              placeholder="e.g. luxury perfume bottle, gold and black, product photo"
              style={{ ...inputSm, resize: "none", marginBottom: 6, fontSize: 11 }} />
            <label style={{ fontSize: 9, color: ds.color.mute, display: "block", marginBottom: 2, fontFamily: ds.font.mono }}>Model</label>
            <select value={selectedImageModel} onChange={e => setSelectedImageModel(e.target.value)}
              style={{ width: "100%", fontSize: 10, padding: "3px 6px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.gold, marginBottom: 6, cursor: "pointer" }}>
              {availableModels.filter(m => m.type === "image" || m.type === "image_edit").map(m => (
                <option key={m.id} value={m.id}>{m.display_name} — ${m.cost_to_henry.toFixed(3)}</option>
              ))}
              {availableModels.filter(m => m.type === "image" || m.type === "image_edit").length === 0 && (
                <option value={selectedImageModel}>{selectedImageModel}</option>
              )}
            </select>
            <button onClick={handleIdeogramTransparent} disabled={ideogramLoading || !ideogramPrompt.trim()}
              style={{ ...btnSm, width: "100%", background: ideogramLoading ? ds.color.card : `${ds.color.lilac}15`, color: ds.color.lilac, borderColor: `${ds.color.lilac}40`, fontWeight: 700 }}>
              {ideogramLoading ? "Generating…" : "Generate Transparent PNG"}
            </button>
          </div>
        )}

        {/* Extract Text Layers — AI */}
        {leftTab === "ai" && (
          <div style={{ marginBottom: 16, borderTop: `1px solid ${ds.color.line}`, paddingTop: 14 }}>
            <p style={sectionTitle}>Extract Text Layers (AI)</p>
            <p style={{ fontSize: 9, color: ds.color.mute, marginBottom: 6, fontFamily: ds.font.mono }}>Upload or use an existing image layer — AI separates text from background</p>
            <button style={{ ...btnSm, width: "100%", marginBottom: 6, color: ds.color.lilac, borderColor: `${ds.color.lilac}40`, display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
              onClick={() => layerizeFileRef.current?.click()}>
              <Folder size={11} color="currentColor" /> Upload Image to Extract
            </button>
            <input ref={layerizeFileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); e.currentTarget.value = ""; }} />
            <button onClick={handleLayerize}
              disabled={layerizeLoading || !canvas.layers.some(l => l.type === "image")}
              style={{ ...btnSm, width: "100%", background: layerizeLoading ? ds.color.card : `${ds.color.sky}15`, color: ds.color.sky, borderColor: `${ds.color.sky}40`, fontWeight: 700 }}>
              {layerizeLoading ? "Analyzing…" : "Extract Text Layers"}
            </button>
            {layerizeResult?.background_url && (
              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 9, color: ds.color.mint, marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}>
                  <Check size={10} color={ds.color.mint} /> Background extracted
                </p>
                <button onClick={() => {
                  if (!layerizeResult.background_url) return;
                  addLayer({
                    id: nextLayerId("img"), type: "image",
                    position: { x: 0, y: 0 }, size: { width: canvas.width, height: canvas.height },
                    rotation: 0, zIndex: 0, locked: false, visible: true,
                    content: layerizeResult.background_url, style: { opacity: 1 },
                  });
                  setLayerizeResult(null);
                }} style={{ ...btnSm, width: "100%", fontSize: 9 }}>Add Background to Canvas</button>
              </div>
            )}
          </div>
        )}

        {/* Voice-Over — AUDIO */}
        {leftTab === "audio" && (
          <div style={{ marginBottom: 16, borderTop: `1px solid ${ds.color.line}`, paddingTop: 14 }}>
            <p style={sectionTitle}>Voice-Over (Gemini TTS)</p>
            <textarea value={ttsText} onChange={e => setTtsText(e.target.value)} rows={3}
              placeholder="Type your ad script here…"
              style={{ ...inputSm, resize: "vertical", marginBottom: 8, fontSize: 11 }} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 }}>
              <div>
                <label style={{ fontSize: 9, color: ds.color.mute, display: "block", marginBottom: 3, fontFamily: ds.font.mono }}>Voice</label>
                <select value={ttsVoice} onChange={e => setTtsVoice(e.target.value)} style={{ ...inputSm, fontSize: 10 }}>
                  {["Zephyr","Puck","Charon","Kore","Fenrir","Leda","Orus","Aoede","Callirrhoe","Autonoe"].map(v => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, color: ds.color.mute, display: "block", marginBottom: 3, fontFamily: ds.font.mono }}>Pitch</label>
                <select value={ttsPitch} onChange={e => setTtsPitch(e.target.value as "low" | "medium" | "high")} style={{ ...inputSm, fontSize: 10 }}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono }}>Speed: {ttsSpeed.toFixed(1)}x</label>
              <input type="range" min={0.5} max={2.0} step={0.1} value={ttsSpeed}
                onChange={e => setTtsSpeed(parseFloat(e.target.value))}
                style={{ width: "100%", marginTop: 4 }} />
            </div>
            <button onClick={handleGeminiTts} disabled={ttsLoading || !ttsText.trim()}
              style={{ ...btnSm, width: "100%", background: ttsLoading ? ds.color.card : `${ds.color.sky}15`, color: ds.color.sky, borderColor: `${ds.color.sky}40`, fontWeight: 700 }}>
              {ttsLoading ? "Generating…" : "Generate Voice-Over"}
            </button>
            {ttsResult && (
              <div style={{ marginTop: 8, background: ds.color.paper, borderRadius: ds.radius.xs, padding: 8, border: `1px solid ${ds.color.line2}` }}>
                <p style={{ fontSize: 9, color: ds.color.mint, marginBottom: 6, display: "flex", alignItems: "center", gap: 4 }}>
                  <Check size={10} color={ds.color.mint} /> Voice-over ready
                </p>
                <NarrationPreview audioUrl={ttsResult} wordTimings={ttsWordTimings} text={ttsText} height={32} />
                <a href={ttsResult} download style={{ display: "block", textAlign: "center", fontSize: 9, color: ds.color.sky, marginTop: 6, textDecoration: "none" }}>
                  Download Audio
                </a>
              </div>
            )}
          </div>
        )}

        </div>
      </div>

      {/* ── CENTER — Canvas (untouched rendering logic) ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: ds.color.paper, overflow: "auto", padding: 20 }}>
        <div style={{ position: "relative" }}>
          <div
            ref={canvasContainerRef}
            style={{
              width: displayW, height: displayH,
              background: bgGradient ?? canvas.background,
              position: "relative", overflow: "hidden",
              cursor: dragging ? "grabbing" : "default",
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              borderRadius: 2,
              ...(!bgGradient && canvas.backgroundFinish === "gloss" ? { backgroundImage: `linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)` } : {}),
              ...(!bgGradient && canvas.backgroundFinish === "matte" ? { filter: "saturate(0.9) brightness(0.97)" } : {}),
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            <div style={{ position: "absolute", inset: `${5 * displayScale}%`, border: `1px dashed ${ds.color.lilac}20`, borderRadius: 2, pointerEvents: "none" }} />

            {canvas.layers.filter(l => l.visible).sort((a, b) => a.zIndex - b.zIndex).map(layer => {
              const s = displayScale;
              const lx = layer.position.x * s;
              const ly = layer.position.y * s;
              const lw = layer.size.width * s;
              const lh = layer.size.height * s;
              const isSelected = selectedId === layer.id;

              return (
                <div key={layer.id} style={{
                  position: "absolute", left: lx, top: ly, width: lw, minHeight: lh,
                  outline: isSelected ? `2px solid ${ds.color.lilac}` : "none",
                  opacity: layer.style.opacity ?? 1,
                  cursor: layer.locked ? "not-allowed" : "grab",
                  userSelect: "none",
                }}>
                  {layer.type === "image" && (
                    <img src={layer.content} alt="" style={{
                      width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none",
                      ...(layer.style.shadow ? { filter: `drop-shadow(0 ${8 * s}px ${16 * s}px ${layer.style.shadowColor ?? "rgba(0,0,0,0.3)"})` } : {}),
                    }} draggable={false} />
                  )}
                  {layer.type === "text" && (
                    <div style={{
                      width: "100%", padding: (layer.style.bgPadding ?? 0) * s,
                      background: layer.style.bgColor ?? "transparent",
                      borderRadius: (layer.style.bgRadius ?? 0) * s,
                      fontSize: (layer.style.fontSize ?? 24) * s,
                      fontWeight: layer.style.fontWeight ?? "normal",
                      fontFamily: layer.style.fontFamily ?? "Arial",
                      color: layer.style.color ?? "#000",
                      textAlign: layer.style.textAlign ?? "left",
                      lineHeight: 1.3, overflow: "hidden", wordBreak: "break-word",
                      boxShadow: layer.style.shadow ? `0 2px 8px rgba(0,0,0,0.2)` : "none",
                      WebkitLineClamp: layer.style.maxLines,
                      display: layer.style.maxLines ? "-webkit-box" : "block",
                      WebkitBoxOrient: layer.style.maxLines ? "vertical" : undefined,
                    }}>
                      {layer.content}
                    </div>
                  )}
                  {layer.type === "whatsapp" && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6 * s,
                      padding: `${(layer.style.bgPadding ?? 8) * s}px ${(layer.style.bgPadding ?? 8) * 1.5 * s}px`,
                      background: layer.style.bgColor ?? "#25D366",
                      borderRadius: (layer.style.bgRadius ?? 20) * s,
                      color: layer.style.color ?? "#fff",
                      fontSize: (layer.style.fontSize ?? 14) * s,
                      fontWeight: layer.style.fontWeight ?? "bold",
                      whiteSpace: "nowrap", width: "fit-content", maxWidth: "100%",
                    }}>
                      <span style={{ fontSize: (layer.style.fontSize ?? 14) * s * 1.2 }}>WA</span>
                      <span>{layer.content}</span>
                    </div>
                  )}
                  {(layer.type === "cta" || layer.type === "price") && (
                    <div style={{
                      width: "100%", height: "100%",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: layer.style.bgColor ?? "#7c5cfc",
                      borderRadius: (layer.style.bgRadius ?? 8) * s,
                      color: layer.style.color ?? "#fff",
                      fontSize: (layer.style.fontSize ?? 16) * s,
                      fontWeight: layer.style.fontWeight ?? "bold",
                      textAlign: "center",
                      padding: `0 ${(layer.style.bgPadding ?? 8) * s}px`,
                      boxShadow: layer.style.shadow ? `0 4px 12px rgba(0,0,0,0.25)` : "none",
                    }}>
                      {layer.content}
                    </div>
                  )}
                  {isSelected && !layer.locked && (
                    <div style={{ position: "absolute", right: -4, bottom: -4, width: 8, height: 8, background: ds.color.lilac, borderRadius: 2, cursor: "nwse-resize" }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        const startX = e.clientX; const startY = e.clientY;
                        const startW = layer.size.width; const startH = layer.size.height;
                        function onMove(ev: MouseEvent) {
                          const dw = (ev.clientX - startX) / displayScale;
                          const dh = (ev.clientY - startY) / displayScale;
                          updateLayer(layer.id, { size: { width: Math.max(40, Math.round(startW + dw)), height: Math.max(20, Math.round(startH + dh)) } });
                        }
                        function onUp() { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); }
                        document.addEventListener("mousemove", onMove);
                        document.addEventListener("mouseup", onUp);
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <p style={{ textAlign: "center", fontSize: 10, color: ds.color.mute, marginTop: 6, fontFamily: ds.font.mono }}>{canvas.width} x {canvas.height} px</p>
        </div>
      </div>

      {/* ── RIGHT PANEL — Properties ── */}
      <div style={{ width: 220, flexShrink: 0, background: panelBg, borderLeft: `1px solid ${panelBorder}`, overflowY: "auto", padding: "16px 14px" }}>
        {selectedLayer ? (
          <>
            <p style={sectionTitle}>Properties — {selectedLayer.type}</p>

            {(selectedLayer.type === "text" || selectedLayer.type === "whatsapp" || selectedLayer.type === "cta" || selectedLayer.type === "price") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Content</label>
                <textarea value={selectedLayer.content} rows={2}
                  onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })}
                  style={{ ...inputSm, resize: "vertical", marginTop: 4 }} />
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Position</label>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input type="number" value={selectedLayer.position.x} onChange={e => updateLayer(selectedLayer.id, { position: { ...selectedLayer.position, x: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
                <input type="number" value={selectedLayer.position.y} onChange={e => updateLayer(selectedLayer.id, { position: { ...selectedLayer.position, y: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
              </div>
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Size</label>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input type="number" value={selectedLayer.size.width} onChange={e => updateLayer(selectedLayer.id, { size: { ...selectedLayer.size, width: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
                <input type="number" value={selectedLayer.size.height} onChange={e => updateLayer(selectedLayer.id, { size: { ...selectedLayer.size, height: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
              </div>
            </div>

            {selectedLayer.type !== "image" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Font Size</label>
                  <input type="number" value={selectedLayer.style.fontSize ?? 24} min={8} max={200}
                    onChange={e => updateLayerStyle(selectedLayer.id, { fontSize: Number(e.target.value) })}
                    style={{ ...inputSm, width: 70, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Color</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input type="color" value={selectedLayer.style.color ?? "#000000"}
                      onChange={e => updateLayerStyle(selectedLayer.id, { color: e.target.value })}
                      style={{ width: 28, height: 28, border: "none", cursor: "pointer" }} />
                    <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>{selectedLayer.style.color}</span>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Background</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input type="color" value={selectedLayer.style.bgColor ?? "#ffffff"}
                      onChange={e => updateLayerStyle(selectedLayer.id, { bgColor: e.target.value })}
                      style={{ width: 28, height: 28, border: "none", cursor: "pointer" }} />
                    <button style={{ ...btnSm, fontSize: 9, padding: "2px 6px" }} onClick={() => updateLayerStyle(selectedLayer.id, { bgColor: undefined })}>None</button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Align</label>
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {(["left", "center", "right"] as const).map(a => (
                      <button key={a} onClick={() => updateLayerStyle(selectedLayer.id, { textAlign: a })}
                        style={{ ...btnSm, fontSize: 9, padding: "2px 8px", background: selectedLayer.style.textAlign === a ? `${ds.color.lilac}20` : ds.color.paper }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Radius</label>
                  <input type="number" value={selectedLayer.style.bgRadius ?? 0} min={0} max={50}
                    onChange={e => updateLayerStyle(selectedLayer.id, { bgRadius: Number(e.target.value) })}
                    style={{ ...inputSm, width: 60, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Padding</label>
                  <input type="number" value={selectedLayer.style.bgPadding ?? 0} min={0} max={40}
                    onChange={e => updateLayerStyle(selectedLayer.id, { bgPadding: Number(e.target.value) })}
                    style={{ ...inputSm, width: 60, marginTop: 4 }} />
                </div>
              </>
            )}

            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Opacity: {Math.round((selectedLayer.style.opacity ?? 1) * 100)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={selectedLayer.style.opacity ?? 1}
                onChange={e => updateLayerStyle(selectedLayer.id, { opacity: Number(e.target.value) })}
                style={{ width: "100%", marginTop: 4 }} className="accent-[#a78bfa]" />
            </div>

            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: ds.color.ink2, cursor: "pointer" }}>
                <input type="checkbox" checked={!!selectedLayer.style.shadow}
                  onChange={e => updateLayerStyle(selectedLayer.id, { shadow: e.target.checked })} className="accent-[#a78bfa]" />
                Shadow
              </label>
            </div>

            {selectedLayer.type !== "image" && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: ds.color.ink2, cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedLayer.style.fontWeight === "bold"}
                    onChange={e => updateLayerStyle(selectedLayer.id, { fontWeight: e.target.checked ? "bold" : "normal" })} className="accent-[#a78bfa]" />
                  Bold
                </label>
              </div>
            )}

            <button onClick={() => removeLayer(selectedLayer.id)}
              style={{ ...btnSm, width: "100%", color: ds.color.coral, borderColor: `${ds.color.coral}30`, marginTop: 8 }}>
              Delete Layer
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <p style={{ fontSize: 12, color: ds.color.mute }}>Select a layer to edit properties</p>
            <p style={{ fontSize: 10, color: ds.color.mute2, marginTop: 8, fontFamily: ds.font.mono }}>Click any element on the canvas</p>
          </div>
        )}

        {canvas.layers.length > 0 && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${panelBorder}`, paddingTop: 12 }}>
            <p style={sectionTitle}>Layers ({canvas.layers.length})</p>
            {[...canvas.layers].sort((a, b) => b.zIndex - a.zIndex).map(l => (
              <div key={l.id} onClick={() => setSelectedId(l.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 6px", borderRadius: ds.radius.xs, marginBottom: 2, cursor: "pointer",
                  background: selectedId === l.id ? `${ds.color.lilac}12` : "transparent",
                  fontSize: 10, color: selectedId === l.id ? ds.color.lilac : ds.color.mute,
                }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140, fontFamily: ds.font.mono }}>
                  {l.type === "image" ? "Image" : l.content.slice(0, 20)}
                </span>
                <span style={{ fontSize: 8, color: ds.color.mute2, fontFamily: ds.font.mono }}>{l.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>

    {/* ── Clarification modal ── */}
    {clarifyOpen && (
      <div style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
      }}
        onClick={() => { setClarifyOpen(false); if (clarifyContinue) clarifyContinue(clarifyOriginalPrompt); }}
      >
        <div onClick={e => e.stopPropagation()}
          style={{
            background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.md,
            padding: 20, maxWidth: 460, width: "100%", boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
          }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink, marginBottom: 4 }}>
            Let&apos;s make this prompt sharper
          </p>
          <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 16, lineHeight: 1.5 }}>
            Answer a couple of these to guide the AI. You can skip anything you don&apos;t care about.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
            {clarifyQuestions.map((q, i) => (
              <div key={i}>
                <label style={{ fontSize: 11, color: ds.color.lilac, fontWeight: 600, display: "block", marginBottom: 4 }}>{q}</label>
                <input
                  value={clarifyAnswers[i] ?? ""}
                  onChange={e => {
                    const next = [...clarifyAnswers];
                    next[i] = e.target.value;
                    setClarifyAnswers(next);
                  }}
                  placeholder="Your answer (optional)…"
                  style={{ width: "100%", fontSize: 12, padding: "7px 10px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: ds.color.paper, color: ds.color.ink, outline: "none" }}
                />
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => { setClarifyOpen(false); if (clarifyContinue) clarifyContinue(clarifyOriginalPrompt); }}
              style={{ fontSize: 11, padding: "6px 14px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, cursor: "pointer", fontWeight: 600 }}>
              Skip
            </button>
            <button onClick={() => {
                const filled = clarifyAnswers.map(a => a.trim()).filter(Boolean);
                const refined = filled.length > 0 ? `${clarifyOriginalPrompt} — ${filled.join(", ")}` : clarifyOriginalPrompt;
                setClarifyOpen(false);
                if (clarifyContinue) clarifyContinue(refined);
              }}
              style={{ fontSize: 11, padding: "6px 14px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.lilac}`, background: ds.color.lilac, color: "#fff", cursor: "pointer", fontWeight: 700 }}>
              Continue
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
