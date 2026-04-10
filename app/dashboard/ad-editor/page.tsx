"use client";

import { useState, useRef, useCallback, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";

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
  // type-specific
  content: string;       // text content, image url, cta label
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
  iconType?: string;     // for whatsapp/cta
  pillStyle?: string;    // whatsapp preset
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
  { id: "white", label: "White", color: "#FFFFFF" },
  { id: "beige", label: "Luxury Beige", color: "#F5F0E8" },
  { id: "black", label: "Black Premium", color: "#1A1A1A" },
  { id: "grey", label: "Soft Grey", color: "#E8E8E8" },
  { id: "charcoal", label: "Charcoal", color: "#333333" },
  { id: "cream", label: "Cream", color: "#FFF8E7" },
  { id: "promo_red", label: "Promo Red", color: "#DC2626" },
  { id: "festive_gold", label: "Festive Gold", color: "#D4A843" },
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
  // Product Sale
  { id: "tpl_product_sale", name: "Product Sale", category: "Product", thumbnail: "🛍",
    canvasWidth: 1080, canvasHeight: 1080, background: "#FFFFFF", backgroundFinish: "none",
    layers: [
      { type: "text", position: { x: 40, y: 60 }, size: { width: 1000, height: 80 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "MEGA SALE", style: { fontSize: 64, fontWeight: "bold", color: "#DC2626", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 160 }, size: { width: 1000, height: 50 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Up to 50% OFF all items", style: { fontSize: 24, fontWeight: "normal", color: "#666666", textAlign: "center", opacity: 1 } },
      { type: "price", position: { x: 390, y: 800 }, size: { width: 300, height: 60 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "$15,000", style: { fontSize: 32, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "cta", position: { x: 340, y: 900 }, size: { width: 400, height: 55 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "Shop Now", style: { fontSize: 22, fontWeight: "bold", color: "#FFFFFF", bgColor: "#7c5cfc", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "whatsapp", position: { x: 330, y: 990 }, size: { width: 420, height: 44 }, rotation: 0, zIndex: 6, locked: false, visible: true, content: "+234 800 000 0000", style: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", bgColor: "#25D366", bgRadius: 20, bgPadding: 10, opacity: 1 } },
    ],
  },
  // Fashion Promo
  { id: "tpl_fashion", name: "Fashion Promo", category: "Fashion", thumbnail: "👗",
    canvasWidth: 1080, canvasHeight: 1350, background: "#1A1A1A", backgroundFinish: "matte",
    layers: [
      { type: "text", position: { x: 40, y: 80 }, size: { width: 1000, height: 70 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "NEW COLLECTION", style: { fontSize: 48, fontWeight: "bold", color: "#D4A843", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 170 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Spring / Summer 2026", style: { fontSize: 20, fontWeight: "normal", color: "#999999", textAlign: "center", opacity: 1 } },
      { type: "cta", position: { x: 340, y: 1200 }, size: { width: 400, height: 55 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "Explore Now", style: { fontSize: 20, fontWeight: "bold", color: "#1A1A1A", bgColor: "#D4A843", bgRadius: 8, bgPadding: 14, textAlign: "center", opacity: 1 } },
    ],
  },
  // Real Estate Flyer
  { id: "tpl_realestate", name: "Property Flyer", category: "Real Estate", thumbnail: "🏠",
    canvasWidth: 1080, canvasHeight: 1350, background: "#F5F0E8", backgroundFinish: "matte",
    layers: [
      { type: "text", position: { x: 40, y: 60 }, size: { width: 1000, height: 70 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "LUXURY APARTMENT", style: { fontSize: 44, fontWeight: "bold", color: "#1A1A1A", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 140 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Lekki Phase 1, Lagos", style: { fontSize: 20, fontWeight: "normal", color: "#666", textAlign: "center", opacity: 1 } },
      { type: "price", position: { x: 340, y: 1100 }, size: { width: 400, height: 60 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "$60,000/night", style: { fontSize: 28, fontWeight: "bold", color: "#FFFFFF", bgColor: "#7c5cfc", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "text", position: { x: 40, y: 1180 }, size: { width: 1000, height: 30 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "24/7 Security  •  Smart TV  •  Free WiFi  •  Parking", style: { fontSize: 16, fontWeight: "normal", color: "#555", textAlign: "center", opacity: 1 } },
      { type: "whatsapp", position: { x: 330, y: 1260 }, size: { width: 420, height: 44 }, rotation: 0, zIndex: 6, locked: false, visible: true, content: "+234 800 000 0000", style: { fontSize: 16, fontWeight: "bold", color: "#FFFFFF", bgColor: "#25D366", bgRadius: 20, bgPadding: 10, opacity: 1 } },
    ],
  },
  // Food / Restaurant
  { id: "tpl_food", name: "Food Menu Promo", category: "Food", thumbnail: "🍽",
    canvasWidth: 1080, canvasHeight: 1080, background: "#1a0a00", backgroundFinish: "none",
    layers: [
      { type: "text", position: { x: 40, y: 60 }, size: { width: 1000, height: 70 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "TODAY'S SPECIAL", style: { fontSize: 52, fontWeight: "bold", color: "#f97316", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 150 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Jollof Rice & Grilled Chicken", style: { fontSize: 24, fontWeight: "bold", color: "#FFFFFF", textAlign: "center", opacity: 1 } },
      { type: "price", position: { x: 390, y: 850 }, size: { width: 300, height: 60 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "$3,500", style: { fontSize: 32, fontWeight: "bold", color: "#1a0a00", bgColor: "#f97316", bgRadius: 10, bgPadding: 14, textAlign: "center", opacity: 1, shadow: true } },
      { type: "cta", position: { x: 340, y: 940 }, size: { width: 400, height: 50 }, rotation: 0, zIndex: 5, locked: false, visible: true, content: "Order Now", style: { fontSize: 20, fontWeight: "bold", color: "#FFFFFF", bgColor: "#dc2626", bgRadius: 8, bgPadding: 12, textAlign: "center", opacity: 1 } },
    ],
  },
  // Event Flyer
  { id: "tpl_event", name: "Event Flyer", category: "Event", thumbnail: "🎉",
    canvasWidth: 1080, canvasHeight: 1350, background: "#0f0a2e", backgroundFinish: "none",
    layers: [
      { type: "text", position: { x: 40, y: 80 }, size: { width: 1000, height: 80 }, rotation: 0, zIndex: 2, locked: false, visible: true, content: "LIVE CONCERT", style: { fontSize: 56, fontWeight: "bold", color: "#FFFFFF", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 180 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 3, locked: false, visible: true, content: "Saturday, April 15 • 7PM", style: { fontSize: 22, fontWeight: "normal", color: "#a080ff", textAlign: "center", opacity: 1 } },
      { type: "text", position: { x: 40, y: 240 }, size: { width: 1000, height: 40 }, rotation: 0, zIndex: 4, locked: false, visible: true, content: "Eko Convention Centre, Lagos", style: { fontSize: 18, fontWeight: "normal", color: "#6060a0", textAlign: "center", opacity: 1 } },
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

const panelBg = "#0e0e1a";
const panelBorder = "#1e1e30";
const sectionTitle: React.CSSProperties = { fontSize: 10, fontWeight: 700, color: "#6060a0", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 };
const btnSm: React.CSSProperties = { fontSize: 11, padding: "5px 10px", borderRadius: 6, border: "1px solid #2a2a40", background: "#1a1a2e", color: "#a080ff", cursor: "pointer", fontWeight: 600 };
const inputSm: React.CSSProperties = { width: "100%", fontSize: 12, padding: "5px 8px", borderRadius: 6, border: "1px solid #2a2a40", background: "#1a1a2e", color: "#e0e0f0" };

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdEditorPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: "#6060a0" }}>Loading editor...</div>}><AdEditorInner /></Suspense>;
}

function AdEditorInner() {
  const searchParams = useSearchParams();
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [canvas, setCanvas] = useState<CanvasState>({
    width: 1080,
    height: 1080,
    background: "#FFFFFF",
    backgroundFinish: "none",
    layers: [],
  });

  // ── Project persistence state ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled Ad");
  const [projectList, setProjectList] = useState<ProjectSummary[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
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
  const [bgGradient, setBgGradient] = useState<string | null>(null);
  const [aiMode, setAiMode] = useState<"ad" | "movie" | "banner" | "text_to_image">("ad");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [versionHistory, setVersionHistory] = useState<{ url: string; label: string }[]>([]);

  const selectedLayer = canvas.layers.find(l => l.id === selectedId) ?? null;

  // ── Load project list on mount ──
  useEffect(() => {
    fetch("/api/ad-editor/project").then(r => r.json()).then(d => {
      if (d.projects) setProjectList(d.projects);
    }).catch(() => {});
  }, []);

  // ── Load project from URL ?project=ID ──
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

  // ── Save project to DB ──
  async function saveProject(canvasState?: CanvasState) {
    const c = canvasState ?? canvas;
    if (c.layers.length === 0 && !projectId) return; // don't save empty new projects
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
        // Refresh project list
        fetch("/api/ad-editor/project").then(r => r.json()).then(d => {
          if (d.projects) setProjectList(d.projects);
        }).catch(() => {});
      }
    } catch { /* ignore */ }
    setSaving(false);
  }

  // ── Auto-save (debounced 3s after canvas changes) ──
  useEffect(() => {
    if (canvas.layers.length === 0 && !projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveProject(canvas); }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas, projectName]);

  // ── Load a saved project ──
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

  // ── New project ──
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

  // ── Delete project ──
  async function deleteProject(id: string) {
    try {
      await fetch(`/api/ad-editor/project/${id}`, { method: "DELETE" });
      setProjectList(prev => prev.filter(p => p.id !== id));
      if (projectId === id) newProject();
    } catch { /* ignore */ }
  }

  // ── Background remove ──
  async function handleBgRemove() {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    if (!imgLayer) return;
    setBgRemoving(true);
    try {
      // Fetch the image file, send to bg-remove API
      const imgRes = await fetch(imgLayer.content);
      const blob = await imgRes.blob();
      const fd = new FormData();
      fd.append("file", blob, "image.png");
      if (projectId) fd.append("projectId", projectId);
      const res = await fetch("/api/ad-editor/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (data.outputUrl) {
        updateLayer(imgLayer.id, { content: data.outputUrl });
      }
    } catch { /* ignore */ }
    setBgRemoving(false);
  }

  // ── AI Image Enhancement ──
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

  // ── Load ad template ──
  function loadAdTemplate(tpl: AdTemplate) {
    setCanvas({
      width: tpl.canvasWidth,
      height: tpl.canvasHeight,
      background: tpl.background,
      backgroundFinish: tpl.backgroundFinish,
      layers: tpl.layers.map((l) => ({ ...l, id: nextLayerId(l.type) } as AdLayer)),
    });
    setBgGradient(null);
    setSelectedId(null);
  }

  // ── AI Edit ──
  async function handleAiEdit() {
    if (!aiPrompt.trim()) return;
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
        body: JSON.stringify({ mode: aiMode, prompt: aiPrompt, imageBase64, imageMime, projectId }),
      });
      const data = await res.json();
      if (data.outputUrl) {
        // Save original to version history
        if (imgLayer) {
          setVersionHistory(prev => [...prev, { url: imgLayer.content, label: `v${prev.length + 1}` }]);
        }
        // Add or replace image layer
        if (imgLayer) {
          updateLayer(imgLayer.id, { content: data.outputUrl });
        } else {
          addLayer({
            id: nextLayerId("img"), type: "image",
            position: { x: 40, y: 200 }, size: { width: 600, height: 600 },
            rotation: 0, zIndex: 1, locked: false, visible: true,
            content: data.outputUrl, style: { opacity: 1 },
          });
        }
      } else {
        setAiError(data.error ?? "AI edit failed");
      }
    } catch { setAiError("Network error"); }
    setAiLoading(false);
  }

  // ── Restore version ──
  function restoreVersion(url: string) {
    const imgLayer = canvas.layers.find(l => l.type === "image");
    if (imgLayer) updateLayer(imgLayer.id, { content: url });
  }

  // ── Load template from URL params ──
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
      // Auto-add a product title from the template prompt
      const title = prompt.length > 40 ? prompt.slice(0, 40) + "..." : prompt;
      setCanvas(prev => ({
        ...prev,
        layers: [
          ...prev.layers,
          {
            id: nextLayerId("txt"), type: "text" as const,
            position: { x: 40, y: 40 }, size: { width: 500, height: 80 },
            rotation: 0, zIndex: 1, locked: false, visible: true,
            content: title,
            style: { fontSize: 36, fontWeight: "bold", fontFamily: "Arial", color: "#1A1A1A", textAlign: "center", opacity: 1, shrinkToFit: true },
          },
        ],
      }));
      setTemplateLoaded(true);
    }
  }, [searchParams, templateLoaded]);

  // ── Canvas sizing from crop preset ──
  function applyCrop(preset: CropPreset) {
    setCropPreset(preset);
    const p = CROP_PRESETS.find(c => c.id === preset);
    if (!p?.ratio) return;
    const base = 1080;
    if (p.ratio >= 1) {
      setCanvas(prev => ({ ...prev, width: base, height: Math.round(base / p.ratio!) }));
    } else {
      setCanvas(prev => ({ ...prev, width: Math.round(base * p.ratio!), height: base }));
    }
  }

  // ── Layer helpers ──
  function addLayer(layer: AdLayer) {
    setCanvas(prev => ({ ...prev, layers: [...prev.layers, layer] }));
    setSelectedId(layer.id);
  }

  function updateLayer(id: string, patch: Partial<AdLayer>) {
    setCanvas(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, ...patch } : l),
    }));
  }

  function updateLayerStyle(id: string, patch: Partial<LayerStyle>) {
    setCanvas(prev => ({
      ...prev,
      layers: prev.layers.map(l => l.id === id ? { ...l, style: { ...l.style, ...patch } } : l),
    }));
  }

  function removeLayer(id: string) {
    setCanvas(prev => ({ ...prev, layers: prev.layers.filter(l => l.id !== id) }));
    if (selectedId === id) setSelectedId(null);
  }

  // ── Image upload ──
  async function handleImageUpload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      if (!res.ok) return;
      const data = await res.json();
      const url = `/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
      addLayer({
        id: nextLayerId("img"),
        type: "image",
        position: { x: 40, y: 40 },
        size: { width: 400, height: 400 },
        rotation: 0,
        zIndex: canvas.layers.length + 1,
        locked: false,
        visible: true,
        content: url,
        style: { opacity: 1 },
      });
    } catch { /* ignore */ }
  }

  // ── Add text block ──
  function addTextBlock(text: string, preset?: Partial<LayerStyle>) {
    addLayer({
      id: nextLayerId("txt"),
      type: "text",
      position: { x: 40, y: canvas.height / 2 },
      size: { width: 500, height: 60 },
      rotation: 0,
      zIndex: canvas.layers.length + 1,
      locked: false,
      visible: true,
      content: text,
      style: {
        fontSize: 32, fontWeight: "bold", fontFamily: "Arial", color: "#1A1A1A",
        textAlign: "center", opacity: 1, shrinkToFit: true, ...preset,
      },
    });
  }

  // ── Add WhatsApp block ──
  function addWhatsAppBlock(preset: typeof WHATSAPP_PRESETS[0]) {
    addLayer({
      id: nextLayerId("wa"),
      type: "whatsapp",
      position: { x: 40, y: canvas.height - 100 },
      size: { width: 320, height: 44 },
      rotation: 0,
      zIndex: canvas.layers.length + 1,
      locked: false,
      visible: true,
      content: "+234 800 000 0000",
      style: {
        fontSize: 16, fontWeight: "bold", color: preset.color,
        bgColor: preset.bg, bgRadius: preset.radius, bgPadding: 10,
        opacity: 1, iconType: "whatsapp", pillStyle: preset.id,
      },
    });
  }

  // ── Add CTA badge ──
  function addCTA(label: string) {
    addLayer({
      id: nextLayerId("cta"),
      type: "cta",
      position: { x: canvas.width / 2 - 100, y: canvas.height - 160 },
      size: { width: 200, height: 48 },
      rotation: 0,
      zIndex: canvas.layers.length + 1,
      locked: false,
      visible: true,
      content: label,
      style: {
        fontSize: 18, fontWeight: "bold", color: "#FFFFFF",
        bgColor: "#7c5cfc", bgRadius: 10, bgPadding: 12,
        textAlign: "center", opacity: 1, shadow: true,
      },
    });
  }

  // ── Add Price badge ──
  function addPriceBadge() {
    addLayer({
      id: nextLayerId("price"),
      type: "price",
      position: { x: canvas.width - 240, y: 40 },
      size: { width: 200, height: 50 },
      rotation: 0,
      zIndex: canvas.layers.length + 1,
      locked: false,
      visible: true,
      content: `${currency}25,000`,
      style: {
        fontSize: 28, fontWeight: "bold", color: "#FFFFFF",
        bgColor: "#22c55e", bgRadius: 8, bgPadding: 12,
        textAlign: "center", opacity: 1, shadow: true,
      },
    });
  }

  // ── Drag handling ──
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const scale = rect.width / canvas.width;
    const mx = (e.clientX - rect.left) / scale;
    const my = (e.clientY - rect.top) / scale;

    // Find topmost layer under cursor
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

  // ── Export + auto-save to library ──
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

        // Download to device
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `ad_export_${Date.now()}.${format}`;
        a.click();
        URL.revokeObjectURL(url);

        // Auto-save to asset library
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

  // ── Canvas render scale ──
  const maxCanvasDisplay = 520;
  const displayScale = Math.min(maxCanvasDisplay / canvas.width, maxCanvasDisplay / canvas.height);
  const displayW = canvas.width * displayScale;
  const displayH = canvas.height * displayScale;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 60px)", overflow: "hidden" }}>

      {/* ── PROJECT BAR ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#0a0a16", borderBottom: "1px solid #1e1e30", flexShrink: 0 }}>
        <input
          value={projectName}
          onChange={e => setProjectName(e.target.value)}
          style={{ fontSize: 13, fontWeight: 600, color: "#e0e0f0", background: "transparent", border: "1px solid transparent", borderRadius: 4, padding: "2px 8px", width: 180 }}
          onFocus={e => { e.target.style.borderColor = "#7c5cfc"; }}
          onBlur={e => { e.target.style.borderColor = "transparent"; }}
        />
        <button onClick={() => saveProject()} disabled={saving}
          style={{ ...btnSm, fontSize: 10, background: saving ? "#2a2a40" : "#7c5cfc", color: "#fff", borderColor: "#7c5cfc" }}>
          {saving ? "Saving..." : "Save"}
        </button>
        <button onClick={newProject} style={{ ...btnSm, fontSize: 10 }}>New</button>
        <button onClick={() => setShowProjectPicker(!showProjectPicker)} style={{ ...btnSm, fontSize: 10 }}>
          Projects ({projectList.length})
        </button>
        {lastSaved && <span style={{ fontSize: 9, color: "#404060", marginLeft: "auto" }}>Saved {lastSaved}</span>}
        {projectId && <span style={{ fontSize: 9, color: "#2a2a40", marginLeft: lastSaved ? 8 : "auto" }}>{projectId.slice(0, 8)}...</span>}
      </div>

      {/* ── PROJECT PICKER DROPDOWN ── */}
      {showProjectPicker && (
        <div style={{ background: "#0e0e1a", borderBottom: "1px solid #1e1e30", padding: "8px 14px", maxHeight: 200, overflowY: "auto", flexShrink: 0 }}>
          {projectList.length === 0 && <p style={{ fontSize: 11, color: "#404060" }}>No saved projects yet</p>}
          {projectList.map(p => (
            <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px", borderRadius: 4, marginBottom: 2, background: projectId === p.id ? "rgba(124,92,252,0.1)" : "transparent", cursor: "pointer" }}
              onClick={() => loadProject(p.id)}>
              <div>
                <span style={{ fontSize: 12, color: "#e0e0f0", fontWeight: projectId === p.id ? 700 : 400 }}>{p.name}</span>
                <span style={{ fontSize: 9, color: "#404060", marginLeft: 8 }}>{p.canvasWidth}x{p.canvasHeight} &middot; {p._count.layers} layers</span>
              </div>
              <div style={{ display: "flex", gap: 4 }}>
                <span style={{ fontSize: 9, color: "#303050" }}>{new Date(p.updatedAt).toLocaleDateString()}</span>
                <button onClick={e => { e.stopPropagation(); deleteProject(p.id); }}
                  style={{ fontSize: 9, color: "#f87171", background: "none", border: "none", cursor: "pointer", padding: "0 4px" }}>
                  Del
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

    <div style={{ display: "flex", gap: 0, flex: 1, overflow: "hidden" }}>

      {/* ── LEFT PANEL — Tools ── */}
      <div style={{ width: 240, flexShrink: 0, background: panelBg, borderRight: `1px solid ${panelBorder}`, overflowY: "auto", padding: "16px 14px" }}>
        {/* Templates */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>Ad Templates</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {AD_TEMPLATES.map(t => (
              <button key={t.id} onClick={() => loadAdTemplate(t)}
                title={t.name}
                style={{ ...btnSm, fontSize: 9, padding: "4px 8px", display: "flex", alignItems: "center", gap: 4 }}>
                <span>{t.thumbnail}</span> {t.name}
              </button>
            ))}
          </div>
        </div>

        {/* Upload */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>Image</p>
          <button style={{ ...btnSm, width: "100%", marginBottom: 6 }} onClick={() => fileInputRef.current?.click()}>
            Upload Image
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
        </div>

        {/* Crop */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>Crop / Size</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {CROP_PRESETS.map(p => (
              <button key={p.id} onClick={() => applyCrop(p.id)}
                style={{ ...btnSm, fontSize: 10, padding: "3px 8px", background: cropPreset === p.id ? "rgba(124,92,252,0.2)" : "#1a1a2e", borderColor: cropPreset === p.id ? "#7c5cfc" : "#2a2a40" }}>
                {p.label}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            <input type="number" value={canvas.width} onChange={e => setCanvas(prev => ({ ...prev, width: Number(e.target.value) || 1080 }))} style={{ ...inputSm, width: 70 }} />
            <span style={{ color: "#404060", fontSize: 11, lineHeight: "28px" }}>x</span>
            <input type="number" value={canvas.height} onChange={e => setCanvas(prev => ({ ...prev, height: Number(e.target.value) || 1080 }))} style={{ ...inputSm, width: 70 }} />
          </div>
        </div>

        {/* Background */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>Background</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 6 }}>
            {BG_PRESETS.map(p => (
              <button key={p.id} onClick={() => setCanvas(prev => ({ ...prev, background: p.color }))}
                title={p.label}
                style={{ width: 24, height: 24, borderRadius: 4, border: canvas.background === p.color ? "2px solid #7c5cfc" : "1px solid #2a2a40", background: p.color, cursor: "pointer" }} />
            ))}
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            <input type="color" value={customBg} onChange={e => { setCustomBg(e.target.value); setCanvas(prev => ({ ...prev, background: e.target.value })); }}
              style={{ width: 28, height: 28, border: "none", cursor: "pointer", borderRadius: 4 }} />
            <span style={{ fontSize: 10, color: "#6060a0" }}>Custom</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
            {(["none", "matte", "gloss"] as const).map(f => (
              <button key={f} onClick={() => setCanvas(prev => ({ ...prev, backgroundFinish: f }))}
                style={{ ...btnSm, fontSize: 9, padding: "2px 8px", background: canvas.backgroundFinish === f ? "rgba(124,92,252,0.2)" : "#1a1a2e", borderColor: canvas.backgroundFinish === f ? "#7c5cfc" : "#2a2a40", textTransform: "capitalize" }}>
                {f === "none" ? "Flat" : f}
              </button>
            ))}
          </div>
          {/* Gradients */}
          <p style={{ fontSize: 9, color: "#505070", marginTop: 8, marginBottom: 4 }}>Gradient</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {GRADIENT_PRESETS.map(g => (
              <button key={g.id} onClick={() => { setBgGradient(g.css); setCanvas(prev => ({ ...prev, background: g.css })); }}
                title={g.label}
                style={{ width: 24, height: 24, borderRadius: 4, background: g.css, border: bgGradient === g.css ? "2px solid #7c5cfc" : "1px solid #2a2a40", cursor: "pointer" }} />
            ))}
            <button onClick={() => { setBgGradient(null); }} style={{ ...btnSm, fontSize: 8, padding: "2px 6px" }}>Clear</button>
          </div>
          {/* BG Remove */}
          <button onClick={handleBgRemove} disabled={bgRemoving || !canvas.layers.some(l => l.type === "image")}
            style={{ ...btnSm, width: "100%", marginTop: 8, fontSize: 10, opacity: bgRemoving ? 0.5 : 1 }}>
            {bgRemoving ? "Removing..." : "Remove Background (AI)"}
          </button>
          {/* Studio Shadow */}
          <button onClick={() => {
            const imgLayer = canvas.layers.find(l => l.type === "image");
            if (imgLayer) updateLayerStyle(imgLayer.id, { shadow: true, shadowColor: "rgba(0,0,0,0.3)" });
          }} disabled={!canvas.layers.some(l => l.type === "image")}
            style={{ ...btnSm, width: "100%", marginTop: 4, fontSize: 10 }}>
            + Studio Shadow
          </button>
          {/* AI Enhance */}
          <button onClick={handleEnhance} disabled={enhancing || !canvas.layers.some(l => l.type === "image")}
            style={{ ...btnSm, width: "100%", marginTop: 4, fontSize: 10, background: enhancing ? "#2a2a40" : "#1a1a2e", color: enhancing ? "#6060a0" : "#10b981", borderColor: "#10b98140" }}>
            {enhancing ? "Enhancing..." : "Enhance Image (AI)"}
          </button>
        </div>

        {/* Text */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>Text</p>
          <button style={{ ...btnSm, width: "100%", marginBottom: 4 }} onClick={() => addTextBlock("Product Name")}>+ Product Title</button>
          <button style={{ ...btnSm, width: "100%", marginBottom: 4 }} onClick={() => addTextBlock("Subtitle text", { fontSize: 18, fontWeight: "normal", color: "#666666" })}>+ Subtitle</button>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ ...btnSm, flex: 1 }} onClick={addPriceBadge}>+ Price Badge</button>
            <select value={currency} onChange={e => setCurrency(e.target.value)}
              style={{ fontSize: 11, padding: "5px 6px", borderRadius: 6, border: "1px solid #2a2a40", background: "#1a1a2e", color: "#e0e0f0", cursor: "pointer", width: 52 }}>
              {["$", "€", "£", "₦", "¥", "₹", "R", "GH₵", "KSh", "Fr", "A$", "C$", "zł", "kr", "R$"].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* WhatsApp */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>WhatsApp / Contact</p>
          {WHATSAPP_PRESETS.map(p => (
            <button key={p.id} onClick={() => addWhatsAppBlock(p)}
              style={{ ...btnSm, width: "100%", marginBottom: 3, fontSize: 10 }}>
              {p.label}
            </button>
          ))}
        </div>

        {/* CTA */}
        <div style={{ marginBottom: 16 }}>
          <p style={sectionTitle}>CTA Stickers</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
            {CTA_LABELS.map(l => (
              <button key={l} onClick={() => addCTA(l)} style={{ ...btnSm, fontSize: 9, padding: "3px 7px" }}>{l}</button>
            ))}
          </div>
        </div>

        {/* AI Edit */}
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
                style={{ ...btnSm, fontSize: 9, padding: "3px 7px", background: aiMode === m.id ? "rgba(124,92,252,0.2)" : "#1a1a2e", borderColor: aiMode === m.id ? "#7c5cfc" : "#2a2a40" }}>
                {m.label}
              </button>
            ))}
          </div>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} rows={2}
            placeholder={aiMode === "text_to_image" ? "Describe the image to generate..." : "e.g. remove background, make luxury, add premium lighting..."}
            style={{ ...inputSm, resize: "vertical", marginBottom: 6, fontSize: 11 }} />
          <button onClick={handleAiEdit} disabled={aiLoading || !aiPrompt.trim()}
            style={{ ...btnSm, width: "100%", background: aiLoading ? "#2a2a40" : "#7c5cfc", color: aiLoading ? "#6060a0" : "#fff", borderColor: "#7c5cfc" }}>
            {aiLoading ? "Processing..." : aiMode === "text_to_image" ? "Generate Image" : "Edit with AI"}
          </button>
          {aiError && <p style={{ fontSize: 10, color: "#f87171", marginTop: 4 }}>{aiError}</p>}
        </div>

        {/* Version History */}
        {versionHistory.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <p style={sectionTitle}>Version History</p>
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {versionHistory.map((v, i) => (
                <button key={i} onClick={() => restoreVersion(v.url)}
                  style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 6, border: "1px solid #2a2a40", background: "#0a0a18", overflow: "hidden", cursor: "pointer", padding: 0 }}>
                  <img src={v.url} alt={v.label} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </button>
              ))}
            </div>
            <p style={{ fontSize: 9, color: "#404060", marginTop: 3 }}>Click to restore a previous version</p>
          </div>
        )}

        {/* Export */}
        <div>
          <p style={sectionTitle}>Export</p>
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <button style={{ ...btnSm, flex: 1, background: "#7c5cfc", color: "#fff", borderColor: "#7c5cfc" }}
              onClick={() => handleExport("png")} disabled={exporting}>
              {exporting ? "..." : "PNG"}
            </button>
            <button style={{ ...btnSm, flex: 1 }} onClick={() => handleExport("jpg")} disabled={exporting}>
              JPG
            </button>
          </div>
          <p style={{ fontSize: 9, color: "#505070", marginBottom: 4 }}>Quick Resize & Export</p>
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
                <span style={{ color: "#404060" }}>{p.w}x{p.h}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── CENTER — Canvas ── */}
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: "#080810", overflow: "auto", padding: 20 }}>
        <div style={{ position: "relative" }}>
          {/* Safe zone guides */}
          <div
            ref={canvasContainerRef}
            style={{
              width: displayW,
              height: displayH,
              background: bgGradient ?? canvas.background,
              position: "relative",
              overflow: "hidden",
              cursor: dragging ? "grabbing" : "default",
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
              borderRadius: 2,
              // Finish effect (only for solid colors, not gradients)
              ...(!bgGradient && canvas.backgroundFinish === "gloss" ? { backgroundImage: `linear-gradient(135deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%)` } : {}),
              ...(!bgGradient && canvas.backgroundFinish === "matte" ? { filter: "saturate(0.9) brightness(0.97)" } : {}),
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {/* Safe margin guide */}
            <div style={{ position: "absolute", inset: `${5 * displayScale}%`, border: "1px dashed rgba(124,92,252,0.15)", borderRadius: 2, pointerEvents: "none" }} />

            {/* Layers */}
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
                  outline: isSelected ? "2px solid #7c5cfc" : "none",
                  opacity: layer.style.opacity ?? 1,
                  cursor: layer.locked ? "not-allowed" : "grab",
                  userSelect: "none",
                }}>
                  {/* Image */}
                  {layer.type === "image" && (
                    <img src={layer.content} alt="" style={{
                      width: "100%", height: "100%", objectFit: "contain", pointerEvents: "none",
                      ...(layer.style.shadow ? { filter: `drop-shadow(0 ${8 * s}px ${16 * s}px ${layer.style.shadowColor ?? "rgba(0,0,0,0.3)"})` } : {}),
                    }} draggable={false} />
                  )}

                  {/* Text / Product Title */}
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
                      lineHeight: 1.3,
                      overflow: "hidden",
                      wordBreak: "break-word",
                      boxShadow: layer.style.shadow ? `0 2px 8px rgba(0,0,0,0.2)` : "none",
                      WebkitLineClamp: layer.style.maxLines,
                      display: layer.style.maxLines ? "-webkit-box" : "block",
                      WebkitBoxOrient: layer.style.maxLines ? "vertical" : undefined,
                    }}>
                      {layer.content}
                    </div>
                  )}

                  {/* WhatsApp block */}
                  {layer.type === "whatsapp" && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6 * s, padding: `${(layer.style.bgPadding ?? 8) * s}px ${(layer.style.bgPadding ?? 8) * 1.5 * s}px`,
                      background: layer.style.bgColor ?? "#25D366",
                      borderRadius: (layer.style.bgRadius ?? 20) * s,
                      color: layer.style.color ?? "#fff",
                      fontSize: (layer.style.fontSize ?? 14) * s,
                      fontWeight: layer.style.fontWeight ?? "bold",
                      whiteSpace: "nowrap",
                      width: "fit-content",
                      maxWidth: "100%",
                    }}>
                      <span style={{ fontSize: (layer.style.fontSize ?? 14) * s * 1.2 }}>📱</span>
                      <span>{layer.content}</span>
                    </div>
                  )}

                  {/* CTA badge */}
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

                  {/* Resize handle */}
                  {isSelected && !layer.locked && (
                    <div style={{ position: "absolute", right: -4, bottom: -4, width: 8, height: 8, background: "#7c5cfc", borderRadius: 2, cursor: "nwse-resize" }}
                      onMouseDown={e => {
                        e.stopPropagation();
                        const startX = e.clientX;
                        const startY = e.clientY;
                        const startW = layer.size.width;
                        const startH = layer.size.height;
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
          <p style={{ textAlign: "center", fontSize: 10, color: "#404060", marginTop: 6 }}>{canvas.width} x {canvas.height} px</p>
        </div>
      </div>

      {/* ── RIGHT PANEL — Properties ── */}
      <div style={{ width: 220, flexShrink: 0, background: panelBg, borderLeft: `1px solid ${panelBorder}`, overflowY: "auto", padding: "16px 14px" }}>
        {selectedLayer ? (
          <>
            <p style={sectionTitle}>Properties — {selectedLayer.type}</p>

            {/* Content / text editing */}
            {(selectedLayer.type === "text" || selectedLayer.type === "whatsapp" || selectedLayer.type === "cta" || selectedLayer.type === "price") && (
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "#6060a0" }}>Content</label>
                <textarea value={selectedLayer.content} rows={2}
                  onChange={e => updateLayer(selectedLayer.id, { content: e.target.value })}
                  style={{ ...inputSm, resize: "vertical", marginTop: 4 }} />
              </div>
            )}

            {/* Position */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: "#6060a0" }}>Position</label>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input type="number" value={selectedLayer.position.x} onChange={e => updateLayer(selectedLayer.id, { position: { ...selectedLayer.position, x: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
                <input type="number" value={selectedLayer.position.y} onChange={e => updateLayer(selectedLayer.id, { position: { ...selectedLayer.position, y: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
              </div>
            </div>

            {/* Size */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: "#6060a0" }}>Size</label>
              <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                <input type="number" value={selectedLayer.size.width} onChange={e => updateLayer(selectedLayer.id, { size: { ...selectedLayer.size, width: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
                <input type="number" value={selectedLayer.size.height} onChange={e => updateLayer(selectedLayer.id, { size: { ...selectedLayer.size, height: Number(e.target.value) } })} style={{ ...inputSm, width: 70 }} />
              </div>
            </div>

            {/* Font */}
            {selectedLayer.type !== "image" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6060a0" }}>Font Size</label>
                  <input type="number" value={selectedLayer.style.fontSize ?? 24} min={8} max={200}
                    onChange={e => updateLayerStyle(selectedLayer.id, { fontSize: Number(e.target.value) })}
                    style={{ ...inputSm, width: 70, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6060a0" }}>Color</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input type="color" value={selectedLayer.style.color ?? "#000000"}
                      onChange={e => updateLayerStyle(selectedLayer.id, { color: e.target.value })}
                      style={{ width: 28, height: 28, border: "none", cursor: "pointer" }} />
                    <span style={{ fontSize: 10, color: "#6060a0" }}>{selectedLayer.style.color}</span>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6060a0" }}>Background</label>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                    <input type="color" value={selectedLayer.style.bgColor ?? "#ffffff"}
                      onChange={e => updateLayerStyle(selectedLayer.id, { bgColor: e.target.value })}
                      style={{ width: 28, height: 28, border: "none", cursor: "pointer" }} />
                    <button style={{ ...btnSm, fontSize: 9, padding: "2px 6px" }} onClick={() => updateLayerStyle(selectedLayer.id, { bgColor: undefined })}>None</button>
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6060a0" }}>Align</label>
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {(["left", "center", "right"] as const).map(a => (
                      <button key={a} onClick={() => updateLayerStyle(selectedLayer.id, { textAlign: a })}
                        style={{ ...btnSm, fontSize: 9, padding: "2px 8px", background: selectedLayer.style.textAlign === a ? "rgba(124,92,252,0.2)" : "#1a1a2e" }}>
                        {a}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6060a0" }}>Radius</label>
                  <input type="number" value={selectedLayer.style.bgRadius ?? 0} min={0} max={50}
                    onChange={e => updateLayerStyle(selectedLayer.id, { bgRadius: Number(e.target.value) })}
                    style={{ ...inputSm, width: 60, marginTop: 4 }} />
                </div>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: 10, color: "#6060a0" }}>Padding</label>
                  <input type="number" value={selectedLayer.style.bgPadding ?? 0} min={0} max={40}
                    onChange={e => updateLayerStyle(selectedLayer.id, { bgPadding: Number(e.target.value) })}
                    style={{ ...inputSm, width: 60, marginTop: 4 }} />
                </div>
              </>
            )}

            {/* Opacity */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ fontSize: 10, color: "#6060a0" }}>Opacity: {Math.round((selectedLayer.style.opacity ?? 1) * 100)}%</label>
              <input type="range" min={0} max={1} step={0.05} value={selectedLayer.style.opacity ?? 1}
                onChange={e => updateLayerStyle(selectedLayer.id, { opacity: Number(e.target.value) })}
                style={{ width: "100%", marginTop: 4 }} className="accent-[#7c5cfc]" />
            </div>

            {/* Shadow */}
            <div style={{ marginBottom: 10 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a0a0c0", cursor: "pointer" }}>
                <input type="checkbox" checked={!!selectedLayer.style.shadow}
                  onChange={e => updateLayerStyle(selectedLayer.id, { shadow: e.target.checked })} className="accent-[#7c5cfc]" />
                Shadow
              </label>
            </div>

            {/* Bold */}
            {selectedLayer.type !== "image" && (
              <div style={{ marginBottom: 10 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#a0a0c0", cursor: "pointer" }}>
                  <input type="checkbox" checked={selectedLayer.style.fontWeight === "bold"}
                    onChange={e => updateLayerStyle(selectedLayer.id, { fontWeight: e.target.checked ? "bold" : "normal" })} className="accent-[#7c5cfc]" />
                  Bold
                </label>
              </div>
            )}

            {/* Delete */}
            <button onClick={() => removeLayer(selectedLayer.id)}
              style={{ ...btnSm, width: "100%", color: "#f87171", borderColor: "#4a1a1a", marginTop: 8 }}>
              Delete Layer
            </button>
          </>
        ) : (
          <div style={{ textAlign: "center", paddingTop: 40 }}>
            <p style={{ fontSize: 12, color: "#404060" }}>Select a layer to edit properties</p>
            <p style={{ fontSize: 10, color: "#2a2a40", marginTop: 8 }}>Click any element on the canvas</p>
          </div>
        )}

        {/* Layer list */}
        {canvas.layers.length > 0 && (
          <div style={{ marginTop: 16, borderTop: `1px solid ${panelBorder}`, paddingTop: 12 }}>
            <p style={sectionTitle}>Layers ({canvas.layers.length})</p>
            {[...canvas.layers].sort((a, b) => b.zIndex - a.zIndex).map(l => (
              <div key={l.id} onClick={() => setSelectedId(l.id)}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "4px 6px", borderRadius: 4, marginBottom: 2, cursor: "pointer",
                  background: selectedId === l.id ? "rgba(124,92,252,0.12)" : "transparent",
                  fontSize: 10, color: selectedId === l.id ? "#a080ff" : "#6060a0",
                }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 140 }}>
                  {l.type === "image" ? "Image" : l.content.slice(0, 20)}
                </span>
                <span style={{ fontSize: 8, color: "#404060" }}>{l.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
