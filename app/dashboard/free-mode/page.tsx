"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useGate } from "../../components/PreGenerationGate";
import { useSearchParams } from "next/navigation";
import DurationPicker from "../../components/DurationPicker";
import ModelPicker, { VIDEO_MODELS, IMAGE_MODELS } from "../../components/ModelPicker";
import { ds } from "../../../lib/designSystem";

// ── Types ─────────────────────────────────────────────────────────────────────
type OutputMode =
  | "text_to_video" | "text_to_image" | "image_to_video"
  | "images_audio"  | "text_to_audio" | "hybrid"
  | "video_to_video"| "ai_motion";

type MotionSubMode = "image-to-video" | "image-plus-video" | "video-to-video";
type ItemStatus    = "generating" | "done" | "error";
type AIModel       = "haiku" | "gpt_mini";

interface HistoryItem {
  id:             string;
  mode:           OutputMode;
  motionSub?:     MotionSubMode | null;
  rawPrompt:      string;
  enhancedPrompt: string | null;
  aspect:         string;
  duration:       number;
  language:       string;
  style:          string | null;
  audioMode:      string;
  aiModel:        AIModel;
  timestamp:      number;
  status:         ItemStatus;
  resultUrl?:     string | null;
  resultType:     "image" | "job";
  errorMsg?:      string | null;
  uploadedPaths:  string[];
  refImagePaths:  string[];
}

interface EnhanceResult {
  enhanced:   string;
  understood: boolean;
  confidence: "high" | "medium" | "low";
  note:       string | null;
}

const AI_MODELS: { id: AIModel; label: string; badge: string; badgeColor: string; desc: string; icon?: string }[] = [
  { id: "haiku",    label: "GHS Pro 1", badge: "PRO 1", badgeColor: "#3b82f6", desc: "Fast AI — speed optimised, great for most tasks" },
  { id: "gpt_mini", label: "GHS Pro 2", badge: "PRO 2", badgeColor: "#06b6d4", desc: "Smart AI — more creative and varied output" },
];

const MODEL_IDS: Record<AIModel, string> = {
  haiku:    "claude:claude-haiku-4-5-20251001",
  gpt_mini: "openai:gpt-4o-mini",
};

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      "#090c14",
  surface: "#0e1220",
  surf2:   "#131828",
  border:  "#1e2a3a",
  accent:  "#3b82f6",
  accentB: "#6366f1",
  cyan:    "#06b6d4",
  green:   "#22c55e",
  red:     "#ef4444",
  amber:   "#f59e0b",
  purple:  "#a855f7",
  text:    "#ededf5",
  sub:     "#6b6b8a",
  muted:   "#3a3a58",
};

// ── Mode catalogue ─────────────────────────────────────────────────────────────
const MODES: { id: OutputMode; icon?: string; label: string; tag: string; desc: string; uploadType?: "image"|"video"; badge?: string }[] = [
  { id: "text_to_video", label: "Text → Video",  tag: "POPULAR",   desc: "Type any idea. AI writes script, generates visuals, adds voice & music." },
  { id: "text_to_image",  icon: "◈", label: "Text → Image",  tag: "INSTANT",   desc: "Describe what you see. AI renders a high-quality image." },
  { id: "image_to_video", icon: "▷", label: "Image → Video", tag: "ANIMATE",   desc: "Upload a photo. AI brings it to life with smooth motion.", uploadType: "image" },
  { id: "ai_motion",      icon: "⬡", label: "AI Motion",     tag: "CHARACTER", desc: "Place your character into motion. Image → Video, motion transfer.", badge: "NEW" },
  { id: "images_audio",   icon: "◧", label: "Slideshow",     tag: "EASY",      desc: "Upload photos, add narration — AI builds a polished video with music." },
  { id: "text_to_audio",  icon: "◉", label: "Audio Only",    tag: "VOICE",     desc: "Script → professional voiceover + background music. No video." },
  { id: "hybrid", label: "Hybrid",        tag: "SMART",     desc: "AI mixes video clips and animated images. Best quality per dollar." },
  { id: "video_to_video", icon: "↺", label: "Video → Video", tag: "TRANSFORM", desc: "Upload a video, restyle it with AI — new look, same motion.", uploadType: "video" },
];

const MOTION_SUB: { id: MotionSubMode; icon?: string; title: string; color: string }[] = [
  { id: "image-to-video",     title: "Image → Video",         color: ds.color.sky   },
  { id: "image-plus-video", icon: "+", title: "Image + Video → Video", color: ds.color.lilac },
  { id: "video-to-video",     title: "Video → Video",         color: ds.color.sky },
];

const ASPECTS   = [{ v: "9:16", l: "9:16", s: "Reels" }, { v: "16:9", l: "16:9", s: "YouTube" }, { v: "1:1", l: "1:1", s: "Square" }];
const DURATIONS = [{ v: 5, l: "5s" }, { v: 10, l: "10s" }, { v: 15, l: "15s" }, { v: 30, l: "30s" }, { v: 60, l: "1m" }];
const LANGUAGES = [
  { v: "en", l: "English" }, { v: "fr", l: "French" },  { v: "es", l: "Spanish"  },
  { v: "pt", l: "Portugu."}, { v: "de", l: "German"  }, { v: "ar", l: "Arabic"   },
  { v: "hi", l: "Hindi"   }, { v: "zh", l: "Chinese" }, { v: "ja", l: "Japanese" },
  { v: "ko", l: "Korean"  }, { v: "ru", l: "Russian" }, { v: "tr", l: "Turkish"  },
];
const STYLES = ["— Any —","Cinematic","Animated","Realistic","Documentary","Fantasy","Sci-fi","Horror","Comedy","Romance","Action","Nature","Urban"];

function modeLabel(m: OutputMode): string { return MODES.find(x => x.id === m)?.label ?? m; }
function modeIcon(m: OutputMode):  string { return MODES.find(x => x.id === m)?.icon ?? ""; }
function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60)    return "just now";
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

function Pill({ active, onClick, children, color = ds.color.sky }: { active: boolean; onClick: () => void; children: React.ReactNode; color?: string }) {
  return (
    <button onClick={onClick} style={{
      padding: "6px 13px", borderRadius: 8, border: `1px solid ${active ? color + "60" : ds.color.line}`,
      background: active ? `${color}18` : "transparent",
      color: active ? color : ds.color.mute, fontSize: 12, fontWeight: 700,
      cursor: "pointer", whiteSpace: "nowrap", transition: "all 0.15s",
    }}>{children}</button>
  );
}

// ── Confirm Modal ─────────────────────────────────────────────────────────────
function ConfirmModal({
  rawPrompt, enhance, onConfirm, onEdit,
}: {
  rawPrompt: string;
  enhance: EnhanceResult;
  onConfirm: (prompt: string) => void;
  onEdit: () => void;
}) {
  const isLow  = enhance.confidence === "low" || !enhance.understood;
  const isMed  = enhance.confidence === "medium";
  const [editMode, setEditMode] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState(enhance.enhanced);

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 500,
      background: "rgba(0,0,0,0.72)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 560, borderRadius: 20,
        background: ds.color.card, border: `1px solid ${isLow ? ds.color.gold + "60" : ds.color.line}`,
        boxShadow: `0 24px 80px rgba(0,0,0,0.6)`,
        overflow: "hidden",
        animation: "fadeSlideUp 0.2s ease",
      }}>
        {/* Header */}
        <div style={{
          padding: "18px 24px", borderBottom: `1px solid ${ds.color.line}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: isLow ? `${ds.color.gold}08` : `${ds.color.sky}06`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: isLow ? `${ds.color.gold}20` : `${ds.color.sky}18`,
              border: `1px solid ${isLow ? ds.color.gold + "40" : ds.color.sky + "30"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 17,
            }}>
              {isLow ? "" : isMed ? "◈" : ""}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: ds.color.ink }}>
                {isLow ? "AI wasn't sure — please review" : "Confirm your generation"}
              </div>
              <div style={{ fontSize: 11, color: ds.color.mute, marginTop: 2 }}>
                {isLow ? "Confidence: low — your prompt may be unclear" :
                 isMed ? "Confidence: medium — some assumptions were made" :
                 "Confidence: high — AI understood your intent"}
              </div>
            </div>
          </div>
          <span style={{
            padding: "4px 10px", borderRadius: 6, fontSize: 10, fontWeight: 800, letterSpacing: 0.8,
            background: isLow ? `${ds.color.gold}20` : isMed ? `${ds.color.sky}18` : `${ds.color.mint}15`,
            color: isLow ? ds.color.gold : isMed ? ds.color.sky : ds.color.mint,
            border: `1px solid ${isLow ? ds.color.gold + "40" : isMed ? ds.color.sky + "40" : ds.color.mint + "35"}`,
          }}>
            {enhance.confidence.toUpperCase()}
          </span>
        </div>

        <div style={{ padding: "20px 24px" }}>
          {/* Original prompt */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: ds.color.mute2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
              Your prompt
            </div>
            <div style={{
              padding: "10px 14px", borderRadius: 10,
              background: ds.color.alert, border: `1px solid ${ds.color.line}`,
              fontSize: 13, color: ds.color.mute, lineHeight: 1.6,
            }}>
              {rawPrompt}
            </div>
          </div>

          {/* Enhanced prompt */}
          <div style={{ marginBottom: isLow ? 14 : 20 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: ds.color.mute2, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6, display: "flex", alignItems: "center", gap: 8 }}>
              AI-enhanced prompt
              <button onClick={() => setEditMode(!editMode)} style={{
                padding: "2px 8px", borderRadius: 5, fontSize: 9, fontWeight: 700,
                background: `${ds.color.sky}15`, border: `1px solid ${ds.color.sky}35`, color: ds.color.sky, cursor: "pointer",
              }}>{editMode ? "Done editing" : "Edit"}</button>
            </div>
            {editMode ? (
              <textarea
                value={editedPrompt}
                onChange={e => setEditedPrompt(e.target.value)}
                rows={4}
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: ds.color.alert, border: `1.5px solid ${ds.color.sky}50`,
                  borderRadius: 10, color: ds.color.ink, fontSize: 13, padding: "10px 14px",
                  resize: "vertical", outline: "none", lineHeight: 1.6, fontFamily: "inherit",
                }}
              />
            ) : (
              <div style={{
                padding: "10px 14px", borderRadius: 10,
                background: isLow ? `${ds.color.gold}06` : `${ds.color.sky}06`,
                border: `1px solid ${isLow ? ds.color.gold + "30" : ds.color.sky + "25"}`,
                fontSize: 13, color: ds.color.ink, lineHeight: 1.7,
              }}>
                {editedPrompt}
              </div>
            )}
          </div>

          {/* Note (if medium/low) */}
          {enhance.note && (
            <div style={{
              marginBottom: 16, padding: "10px 14px", borderRadius: 10,
              background: `${ds.color.gold}08`, border: `1px solid ${ds.color.gold}30`,
              fontSize: 12, color: ds.color.gold, lineHeight: 1.6,
            }}>
              {enhance.note}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={onEdit} style={{
              flex: 1, padding: "12px 20px", borderRadius: 12,
              border: `1px solid ${ds.color.line}`, background: "transparent",
              color: ds.color.mute, fontSize: 14, fontWeight: 700, cursor: "pointer",
            }}>← Edit Prompt</button>
            <button onClick={() => onConfirm(editedPrompt)} style={{
              flex: 2, padding: "12px 20px", borderRadius: 12, border: "none",
              background: isLow
                ? `linear-gradient(135deg, ${ds.color.gold}, #f97316)`
                : `linear-gradient(135deg, ${ds.color.sky}, ${ds.color.lilac})`,
              color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer",
              boxShadow: `0 4px 20px ${isLow ? ds.color.gold : ds.color.sky}40`,
            }}>
              {isLow ? "Generate Anyway →" : "Generate →"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History card ───────────────────────────────────────────────────────────────
function HistoryCard({ item, onReuse, onDelete }: { item: HistoryItem; onReuse: () => void; onDelete: () => void }) {
  const isGenerating = item.status === "generating";
  const isDone       = item.status === "done";
  const isError      = item.status === "error";
  const aiM          = AI_MODELS.find(x => x.id === (item.aiModel ?? "haiku"));

  return (
    <div style={{
      padding: "18px 20px", borderRadius: 16, marginBottom: 12,
      background: ds.color.card, border: `1px solid ${
        isGenerating ? ds.color.sky + "40" : isDone ? ds.color.line : isError ? "#ef4444" + "30" : ds.color.line
      }`,
      position: "relative", animation: "fadeSlideUp 0.35s ease",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9,
            background: isGenerating ? `${ds.color.sky}18` : isDone ? `${ds.color.mint}14` : `${"#ef4444"}14`,
            border: `1px solid ${isGenerating ? ds.color.sky + "40" : isDone ? ds.color.mint + "30" : "#ef4444" + "30"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: isGenerating ? ds.color.sky : isDone ? ds.color.mint : "#ef4444",
          }}>
            {isGenerating ? "⏳" : isDone ? "" : ""}
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink }}>{modeLabel(item.mode)}</div>
            <div style={{ fontSize: 10, color: ds.color.mute }}>{timeAgo(item.timestamp)}</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!isGenerating && (
            <button onClick={onReuse} style={{
              padding: "4px 11px", borderRadius: 7, border: `1px solid ${ds.color.line}`,
              background: "transparent", color: ds.color.mute, fontSize: 11, fontWeight: 600, cursor: "pointer",
            }}>↺ Reuse</button>
          )}
          <button onClick={onDelete} style={{
            padding: "4px 9px", borderRadius: 7, border: `1px solid ${ds.color.line}`,
            background: "transparent", color: ds.color.mute2, fontSize: 11, cursor: "pointer",
          }}></button>
        </div>
      </div>

      {/* Show enhanced prompt if different */}
      {item.enhancedPrompt && item.enhancedPrompt !== item.rawPrompt ? (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 10, color: ds.color.mute2, marginBottom: 4, fontWeight: 600 }}>ENHANCED</div>
          <p style={{
            margin: 0, fontSize: 13, lineHeight: 1.6, color: ds.color.ink,
            display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
          }}>{item.enhancedPrompt}</p>
        </div>
      ) : (
        <p style={{
          margin: "0 0 12px", fontSize: 13, lineHeight: 1.6,
          color: item.rawPrompt === "(image animation)" ? ds.color.mute : ds.color.ink,
          fontStyle: item.rawPrompt === "(image animation)" ? "italic" : "normal",
          display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden",
        }}>
          {item.rawPrompt}
        </p>
      )}

      {/* Reference image thumbnails */}
      {item.refImagePaths.length > 0 && (
        <div style={{ display: "flex", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
          {item.refImagePaths.slice(0, 4).map((p, i) => (
            <img key={i} src={`/api/media/file?path=${encodeURIComponent(p)}`} alt=""
              style={{ width: 44, height: 44, borderRadius: 7, objectFit: "cover", border: `1px solid ${ds.color.lilac}40` }} />
          ))}
          {item.refImagePaths.length > 4 && (
            <div style={{ width: 44, height: 44, borderRadius: 7, background: ds.color.alert, border: `1px solid ${ds.color.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: ds.color.mute, fontWeight: 700 }}>
              +{item.refImagePaths.length - 4}
            </div>
          )}
        </div>
      )}

      {/* Tags */}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
        {aiM && (
          <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
            background: `${aiM.badgeColor}15`, color: aiM.badgeColor, border: `1px solid ${aiM.badgeColor}35`,
          }}>{aiM.icon} {aiM.label}</span>
        )}
        {[
          item.aspect !== "9:16" ? item.aspect : null,
          item.duration !== 10 ? `${item.duration}s` : null,
          item.language !== "en" ? item.language.toUpperCase() : null,
          item.style ? item.style : null,
        ].filter(Boolean).map((tag, i) => (
          <span key={i} style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
            background: ds.color.alert, color: ds.color.mute2, border: `1px solid ${ds.color.line}` }}>{tag}</span>
        ))}
        {item.uploadedPaths.length > 0 && (
          <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: 10, fontWeight: 700,
            background: `${ds.color.mint}12`, color: ds.color.mint, border: `1px solid ${ds.color.mint}30` }}>
            {item.uploadedPaths.length} file{item.uploadedPaths.length > 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Status */}
      {isGenerating && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 10, background: `${ds.color.sky}0a`, border: `1px solid ${ds.color.sky}25` }}>
          <span style={{ fontSize: 13, animation: "spin 1.2s linear infinite", display: "inline-block" }}>⏳</span>
          <span style={{ fontSize: 12, color: ds.color.sky, fontWeight: 600 }}>Generating… AI is working on this</span>
        </div>
      )}
      {isDone && item.resultType === "image" && item.resultUrl && (
        <div>
          <img src={item.resultUrl} alt="Generated" style={{ width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 10, border: `1px solid ${ds.color.line}` }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <a href={item.resultUrl} download style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: `${ds.color.sky}18`, border: `1px solid ${ds.color.sky}40`, color: ds.color.sky, textDecoration: "none" }}>⬇ Download</a>
            <a href="/dashboard/assets" style={{ padding: "7px 14px", borderRadius: 8, fontSize: 12, fontWeight: 700, background: "transparent", border: `1px solid ${ds.color.line}`, color: ds.color.mute, textDecoration: "none" }}>Asset Library</a>
          </div>
        </div>
      )}
      {isDone && item.resultType === "job" && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: `${ds.color.mint}0a`, border: `1px solid ${ds.color.mint}25` }}>
          <span style={{ fontSize: 15 }}></span>
          <span style={{ fontSize: 12, color: ds.color.mint, fontWeight: 600 }}>Sent to pipeline</span>
          <a href="/dashboard/review" style={{ marginLeft: "auto", padding: "5px 12px", borderRadius: 7, fontSize: 11, fontWeight: 700, background: `${ds.color.sky}18`, border: `1px solid ${ds.color.sky}40`, color: ds.color.sky, textDecoration: "none" }}>Review Queue →</a>
        </div>
      )}
      {isError && (
        <div style={{ padding: "10px 14px", borderRadius: 10, background: `${"#ef4444"}0a`, border: `1px solid ${"#ef4444"}25` }}>
          <span style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>{item.errorMsg ?? "Generation failed"}</span>
        </div>
      )}
    </div>
  );
}

// ── SC: 5-Tier Sound Model Selector (binding architectural decision) ──────────
const SOUND_TIERS_FREE = [
  { id: "piper_free",      label: "Standard",  subtitle: "Built-in GHS",  cost: "Free"    },
  { id: "piper_extended",  label: "Start Plus", subtitle: "Extended Piper", cost: "Low"    },
  { id: "ghs_karaoke",     label: "Sound Pro",  subtitle: "GHS Karaoke",   cost: "Mid"     },
  { id: "elevenlabs",      label: "Classic",    subtitle: "ElevenLabs",    cost: "Premium" },
  { id: "gemini",          label: "Premium",    subtitle: "Gemini Audio",  cost: "Highest" },
] as const;
type SoundTierFreeId = typeof SOUND_TIERS_FREE[number]["id"];

// ── Main component ─────────────────────────────────────────────────────────────
function FreeModeInner() {
  const { requireGate, GateModal } = useGate();
  const searchParams = useSearchParams();
  const feedRef      = useRef<HTMLDivElement>(null);
  const textareaRef  = useRef<HTMLTextAreaElement>(null);
  const fileRef      = useRef<HTMLInputElement>(null);
  const refVidRef    = useRef<HTMLInputElement>(null);
  const slideRef     = useRef<HTMLInputElement>(null);
  const refImgRef    = useRef<HTMLInputElement>(null);

  // Form state
  const [mode,       setMode]       = useState<OutputMode>("text_to_video");
  const [motionSub,  setMotionSub]  = useState<MotionSubMode | null>(null);
  const [prompt,     setPrompt]     = useState("");
  const [aspect,     setAspect]     = useState<"9:16"|"16:9"|"1:1">("9:16");
  const [duration,   setDuration]   = useState(10);
  const [language,   setLanguage]   = useState("en");
  const [style,      setStyle]      = useState("");
  const [audioMode,  setAudioMode]  = useState<"voice_music"|"voice_only"|"music_only"|"none">("voice_music");
  const [showAdv,    setShowAdv]    = useState(false);
  const [showModes,  setShowModes]  = useState(false);
  const [aiModel,    setAiModel]    = useState<AIModel>("haiku");
  const [selectedVideoModel, setSelectedVideoModel] = useState<string>(VIDEO_MODELS[2].id); // Seedance 2.0 default
  const [selectedImageModel, setSelectedImageModel] = useState<string>("segmind_flux"); // Segmind Flux default for Free Mode
  // ── SC/SD: Sound model ────────────────────────────────────────────────────
  const [soundTier, setSoundTier] = useState<SoundTierFreeId>("piper_free");

  // Multi-upload state (primary images or single video)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [uploadedPaths, setUploadedPaths] = useState<string[]>([]);
  // Secondary video (ai_motion image+video or video-to-video)
  const [refVideoFile, setRefVideoFile] = useState<File | null>(null);
  const [refVideoPath, setRefVideoPath] = useState("");
  // Slideshow photos
  const [slideFiles, setSlideFiles] = useState<File[]>([]);
  const [slidePaths, setSlidePaths] = useState<string[]>([]);
  // Reference AI images (style/character references)
  const [refImageFiles, setRefImageFiles] = useState<File[]>([]);
  const [refImagePaths, setRefImagePaths] = useState<string[]>([]);

  const [uploading,     setUploading]     = useState(false);
  const [enhancing,     setEnhancing]     = useState(false);
  const [isSubmitting,  setIsSubmitting]  = useState(false);
  const [confirmData,   setConfirmData]   = useState<{ enhance: EnhanceResult; raw: string } | null>(null);
  const [history,       setHistory]       = useState<HistoryItem[]>([]);
  const [histLoaded,    setHistLoaded]    = useState(false);

  // ── localStorage helpers ────────────────────────────────────────
  const LS_KEY = "ghs_free_mode_history";
  const LS_MAX = 50;

  function saveHistoryToLS(items: HistoryItem[]) {
    try {
      // Keep only last LS_MAX items (oldest trimmed)
      const trimmed = items.slice(-LS_MAX);
      localStorage.setItem(LS_KEY, JSON.stringify(trimmed));
    } catch { /* storage full or unavailable — silently skip */ }
  }

  function loadHistoryFromLS(): HistoryItem[] {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }

  // Load history: restore from localStorage immediately, then refresh from DB
  useEffect(() => {
    // Step 1: restore from localStorage for instant display on reload
    const cached = loadHistoryFromLS();
    if (cached.length > 0) setHistory(cached);

    // Step 2: fetch from DB to get authoritative data (may include server-side completions)
    fetch("/api/free-mode/history")
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.items) {
          const dbItems = data.items.map((item: Record<string, unknown>) => ({
            id:             String(item.id),
            mode:           String(item.mode) as OutputMode,
            motionSub:      item.motionSub ? String(item.motionSub) as MotionSubMode : null,
            rawPrompt:      String(item.rawPrompt ?? ""),
            enhancedPrompt: item.enhancedPrompt ? String(item.enhancedPrompt) : null,
            aspect:         String(item.aspect ?? "9:16"),
            duration:       Number(item.duration ?? 10),
            language:       String(item.language ?? "en"),
            style:          item.style ? String(item.style) : null,
            audioMode:      String(item.audioMode ?? "voice_music"),
            aiModel:        String(item.aiModel ?? "haiku") as AIModel,
            timestamp:      item.createdAt ? new Date(item.createdAt as string).getTime() : Date.now(),
            status:         String(item.status ?? "done") as ItemStatus,
            resultUrl:      item.resultUrl ? String(item.resultUrl) : null,
            resultType:     String(item.resultType ?? "job") as "image" | "job",
            errorMsg:       item.errorMsg ? String(item.errorMsg) : null,
            uploadedPaths:  Array.isArray(item.uploadedPaths) ? (item.uploadedPaths as string[]) : [],
            refImagePaths:  Array.isArray(item.refImagePaths) ? (item.refImagePaths as string[]) : [],
          })).reverse(); // DB returns newest first, show oldest first in feed
          setHistory(dbItems);
          saveHistoryToLS(dbItems);
        }
        setHistLoaded(true);
      })
      .catch(() => {
        // DB failed — keep using localStorage data if we have it
        setHistLoaded(true);
      });
  }, []);

  // Persist history to localStorage whenever it changes (after initial load)
  useEffect(() => {
    if (!histLoaded) return; // don't write during the initial load phase
    saveHistoryToLS(history);
  }, [history, histLoaded]);

  // Auto-scroll feed to bottom
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [history.length]);

  // URL param: preset mode
  useEffect(() => {
    const m = searchParams.get("mode") as OutputMode | null;
    if (m && MODES.some(mo => mo.id === m)) setMode(m);
    if (m === "text_to_audio") setAudioMode("none");
  }, [searchParams]);

  function switchMode(m: OutputMode) {
    setMode(m); setMotionSub(null);
    setUploadedFiles([]); setUploadedPaths([]);
    setRefVideoFile(null); setRefVideoPath("");
    setSlideFiles([]); setSlidePaths([]);
    setShowModes(false);
  }

  // Upload a single file to /api/v2v/upload
  async function uploadFile(file: File): Promise<string | null> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/v2v/upload", { method: "POST", body: form }).catch(() => null);
    if (!res?.ok) return null;
    const data = await res.json();
    return data.filePath ?? null;
  }

  // Primary multi-image upload
  async function handlePrimaryUpload(files: FileList) {
    setUploading(true);
    const newFiles = Array.from(files);
    for (const file of newFiles) {
      const path = await uploadFile(file);
      if (path) {
        setUploadedFiles(prev => [...prev, file]);
        setUploadedPaths(prev => [...prev, path]);
      }
    }
    setUploading(false);
  }

  // Reference AI images upload
  async function handleRefImgUpload(files: FileList) {
    setUploading(true);
    const newFiles = Array.from(files);
    for (const file of newFiles) {
      const path = await uploadFile(file);
      if (path) {
        setRefImageFiles(prev => [...prev, file]);
        setRefImagePaths(prev => [...prev, path]);
      }
    }
    setUploading(false);
  }

  async function handleSlideUpload(files: FileList) {
    const newFiles = Array.from(files);
    setSlideFiles(prev => [...prev, ...newFiles]);
    for (const f of newFiles) {
      const path = await uploadFile(f);
      if (path) setSlidePaths(prev => [...prev, path]);
    }
  }

  async function handleRefVideoUpload(file: File) {
    setUploading(true);
    const path = await uploadFile(file);
    if (path) { setRefVideoFile(file); setRefVideoPath(path); }
    setUploading(false);
  }

  function reuseSettings(item: HistoryItem) {
    setMode(item.mode);
    setMotionSub(item.motionSub ?? null);
    setPrompt(item.rawPrompt === "(image animation)" ? "" : item.rawPrompt);
    setAspect(item.aspect as "9:16"|"16:9"|"1:1");
    setDuration(item.duration);
    setLanguage(item.language);
    setStyle(item.style ?? "");
    setAudioMode(item.audioMode as typeof audioMode);
    if (item.aiModel) setAiModel(item.aiModel);
    textareaRef.current?.focus();
  }

  async function deleteItem(id: string) {
    setHistory(prev => {
      const updated = prev.filter(x => x.id !== id);
      saveHistoryToLS(updated);
      return updated;
    });
    await fetch(`/api/free-mode/history/${id}`, { method: "DELETE" }).catch(() => null);
  }

  // Step 1: validate + call enhance → open confirm modal
  async function handleGenerate() {
    try { await requireGate(); } catch { return; }
    const needsPrompt = mode !== "image_to_video" && mode !== "ai_motion";
    if (needsPrompt && !prompt.trim()) return;
    if ((mode === "image_to_video" || mode === "video_to_video") && uploadedPaths.length === 0) return;
    if (mode === "images_audio" && slidePaths.length === 0) return;
    if (mode === "ai_motion" && !motionSub) return;
    if (mode === "ai_motion" && motionSub !== "video-to-video" && uploadedPaths.length === 0) return;
    if (mode === "ai_motion" && motionSub === "video-to-video" && !refVideoPath) return;

    setEnhancing(true);
    try {
      const res  = await fetch("/api/free-mode/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawPrompt: prompt.trim() || "(image animation)", mode }),
      });
      const data: EnhanceResult = res.ok
        ? await res.json()
        : { enhanced: prompt.trim() || "(image animation)", understood: true, confidence: "medium", note: null };
      setConfirmData({ enhance: data, raw: prompt.trim() || "(image animation)" });
    } catch {
      setConfirmData({ enhance: { enhanced: prompt.trim() || "(image animation)", understood: true, confidence: "medium", note: null }, raw: prompt.trim() || "(image animation)" });
    }
    setEnhancing(false);
  }

  // Step 2: user confirms → create DB record → run pipeline in background
  async function handleConfirm(enhancedPrompt: string) {
    if (!confirmData) return;
    setConfirmData(null);
    setIsSubmitting(true);

    // Capture upload state before clearing
    const capUploadedPaths = [...uploadedPaths];
    const capRefVideoPath  = refVideoPath;
    const capSlidePaths    = [...slidePaths];
    const capRefImagePaths = [...refImagePaths];
    const capRaw           = confirmData.raw;

    setPrompt(""); setUploadedFiles([]); setUploadedPaths([]);
    setRefVideoFile(null); setRefVideoPath("");
    setSlideFiles([]); setSlidePaths([]);
    setRefImageFiles([]); setRefImagePaths([]);

    // Create DB record
    const dbRes = await fetch("/api/free-mode/history", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rawPrompt:      capRaw,
        enhancedPrompt,
        mode,
        motionSub,
        aspect,
        duration,
        language,
        style: style || null,
        audioMode,
        aiModel,
        resultType:    mode === "text_to_image" ? "image" : "job",
        uploadedPaths: capUploadedPaths,
        refImagePaths: capRefImagePaths,
      }),
    }).catch(() => null);

    const dbItem = dbRes?.ok ? await dbRes.json() : null;
    const dbId   = dbItem?.id ?? `local-${Date.now()}`;

    const newItem: HistoryItem = {
      id:             dbId,
      mode,
      motionSub,
      rawPrompt:      capRaw,
      enhancedPrompt,
      aspect,
      duration,
      language,
      style:          style || null,
      audioMode,
      aiModel,
      timestamp:      Date.now(),
      status:         "generating",
      resultType:     mode === "text_to_image" ? "image" : "job",
      uploadedPaths:  capUploadedPaths,
      refImagePaths:  capRefImagePaths,
    };

    setHistory(prev => [...prev, newItem]);

    const updateItem = (patch: Partial<HistoryItem>) =>
      setHistory(prev => prev.map(x => x.id === dbId ? { ...x, ...patch } : x));

    const patchDB = (patch: Record<string, unknown>) =>
      fetch(`/api/free-mode/history/${dbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => null);

    // Run generation in background
    try {
      if (mode === "text_to_image") {
        const res = await fetch("/api/generation/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: enhancedPrompt,
            modelId: selectedImageModel,
            referenceImageUrls: capRefImagePaths.length > 0 ? capRefImagePaths : undefined,
            width:  aspect === "16:9" ? 1216 : aspect === "1:1" ? 1024 : 832,
            height: aspect === "16:9" ? 832  : aspect === "1:1" ? 1024 : 1472,
          }),
        });
        const data = await res.json();
        if (res.ok && data.imagePath) {
          const url = `/api/media/file?path=${encodeURIComponent(data.imagePath)}`;
          updateItem({ status: "done", resultUrl: url });
          patchDB({ status: "done", resultUrl: url });
        } else {
          const msg = data.error ?? "Image generation failed";
          updateItem({ status: "error", errorMsg: msg });
          patchDB({ status: "error", errorMsg: msg });
        }
        setIsSubmitting(false);
        return;
      }

      const pipelineMode = mode === "ai_motion"
        ? (motionSub === "video-to-video" ? "video_to_video" : "image_to_video")
        : mode;

      const body: Record<string, unknown> = {
        rawInput:           enhancedPrompt,
        outputMode:         pipelineMode,
        llmModel:           MODEL_IDS[aiModel],
        videoModelId:       selectedVideoModel,
        imageModelId:       selectedImageModel,
        durationSeconds:    duration,
        aspectRatio:        aspect,
        aiAutoMode:         true,
        audioMode:          mode === "text_to_audio" ? "audio_only" : audioMode,
        voiceLanguage:      language,
        visualStyle:        style || undefined,
        referenceImageUrl:  (mode === "image_to_video" || (mode === "ai_motion" && motionSub !== "video-to-video")) && capUploadedPaths.length > 0
          ? capUploadedPaths[0]
          : capRefImagePaths.length > 0 ? capRefImagePaths[0] : undefined,
        sourceVideoPath:    mode === "video_to_video" && capUploadedPaths.length > 0
          ? capUploadedPaths[0]
          : (mode === "ai_motion" && motionSub === "video-to-video" && capRefVideoPath)
          ? capRefVideoPath : undefined,
        referenceVideoPath: mode === "ai_motion" && motionSub === "image-plus-video" && capRefVideoPath ? capRefVideoPath : undefined,
        slideImagePaths:    mode === "images_audio" && capSlidePaths.length > 0 ? capSlidePaths : undefined,
      };

      const res = await fetch("/api/pipeline", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        updateItem({ status: "done", resultUrl: data.contentItemId });
        patchDB({ status: "done", contentItemId: data.contentItemId ?? null });
      } else {
        const data = await res.json().catch(() => ({}));
        const msg = data.error ?? "Generation failed";
        updateItem({ status: "error", errorMsg: msg });
        patchDB({ status: "error", errorMsg: msg });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      updateItem({ status: "error", errorMsg: msg });
      patchDB({ status: "error", errorMsg: msg });
    }
    setIsSubmitting(false);
  }

  const activeModeConfig = MODES.find(m => m.id === mode)!;
  const needsUpload      = !!activeModeConfig.uploadType;
  const showPrimaryUpload = needsUpload || (mode === "ai_motion" && (motionSub === "image-to-video" || motionSub === "image-plus-video"));
  const showSecondaryVid  = mode === "ai_motion" && (motionSub === "image-plus-video" || motionSub === "video-to-video");
  const anyGenerating    = history.some(x => x.status === "generating");
  const canGenerate      = !isSubmitting && !enhancing;

  const placeholder =
    mode === "text_to_video"  ? "Describe your video idea… e.g. A golden retriever runs through a sunflower field at sunset, cinematic slow motion" :
    mode === "text_to_image"  ? "Describe your image… e.g. A futuristic city skyline at night, neon reflections on wet streets, ultra-detailed" :
    mode === "image_to_video" ? "What should happen? (optional — leave blank to auto-animate)" :
    mode === "ai_motion"      ? "Describe the scene or motion (optional)" :
    mode === "images_audio"   ? "What narration should play over your photos?" :
    mode === "text_to_audio"  ? "Write your script or narration here…" :
    mode === "hybrid"         ? "Describe your story — AI decides which scenes use video vs images" :
    "What transformation should AI apply to your video?";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: ds.color.paper, color: ds.color.ink, fontFamily: "ds.font.sans" }}>
      <GateModal />

      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, opacity: 0.03,
        backgroundImage: `linear-gradient(${ds.color.line} 1px, transparent 1px), linear-gradient(90deg, ${ds.color.line} 1px, transparent 1px)`,
        backgroundSize: "48px 48px",
      }} />

      {/* ── Header ── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        borderBottom: `1px solid ${ds.color.line}`, padding: "12px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: ds.color.card,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: "linear-gradient(135deg, #8b5cf6 0%, #ec4899 48%, #f97316 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 900, color: "#fff",
            boxShadow: "0 4px 16px rgba(236,72,153,0.40)",
          }}></div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: ds.color.ink, letterSpacing: -0.4 }}>Free Mode</div>
            <div style={{ fontSize: 10, color: ds.color.mute, letterSpacing: 0.8 }}>
              {!histLoaded ? "Loading history…" :
               history.length > 0 ? `${history.length} generation${history.length > 1 ? "s" : ""}` : "Quick AI generation"}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {history.length > 0 && (
            <button onClick={async () => {
              if (!confirm("Clear all history? This cannot be undone.")) return;
              // Delete from DB in background
              history.forEach(item => fetch(`/api/free-mode/history/${item.id}`, { method: "DELETE" }).catch(() => null));
              // Clear localStorage too
              try { localStorage.removeItem(LS_KEY); } catch { /* ignore */ }
              setHistory([]);
            }} style={{
              padding: "6px 12px", borderRadius: 8, fontSize: 11, fontWeight: 600,
              border: `1px solid ${ds.color.line}`, color: ds.color.mute2, background: "transparent", cursor: "pointer",
            }}>Clear history</button>
          )}
          <a href="/dashboard/hybrid-planner" style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", border: `1px solid ${ds.color.line}`, color: ds.color.mute, background: "transparent" }}>Hybrid</a>
          <a href="/dashboard/review" style={{ padding: "6px 13px", borderRadius: 8, fontSize: 12, fontWeight: 600, textDecoration: "none", background: `${ds.color.sky}18`, border: `1px solid ${ds.color.sky}40`, color: ds.color.sky }}>◈ Review Queue</a>
        </div>
      </div>

      {/* ── History feed ── */}
      <div ref={feedRef} style={{
        flex: 1, overflowY: "auto", position: "relative", zIndex: 1,
        padding: "24px 24px 12px", maxWidth: 820, width: "100%", margin: "0 auto",
        boxSizing: "border-box", scrollBehavior: "smooth",
      }}>
        {history.length === 0 && histLoaded && (
          <div style={{ textAlign: "center", padding: "60px 32px 40px", maxWidth: 560, margin: "0 auto" }}>
            <div style={{ position: "relative", display: "inline-block", marginBottom: 28 }}>
              <div style={{ position: "absolute", inset: -8, borderRadius: 28, background: `radial-gradient(circle, ${ds.color.sky}12 0%, transparent 70%)`, animation: "pulseGlow 3s ease-in-out infinite" }} />
            </div>
            <h2 style={{ fontSize: 24, fontWeight: 900, color: ds.color.ink, marginBottom: 10, letterSpacing: -0.6 }}>What would you like to create?</h2>
            <p style={{ fontSize: 14, color: ds.color.mute, lineHeight: 1.75, marginBottom: 32 }}>
              Type any idea below — video, image, audio, or slideshow.<br />
              AI enhances your prompt automatically. Every generation is saved permanently.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>
              {["A sunset over mountains, cinematic", "A futuristic city at night", "A product showcase, clean studio", "A nature documentary scene"].map(s => (
                <button key={s} onClick={() => setPrompt(s)} style={{
                  padding: "8px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600,
                  border: `1px solid ${ds.color.line}`, background: ds.color.card, color: ds.color.mute, cursor: "pointer",
                }}>{s}</button>
              ))}
            </div>
            <p style={{ fontSize: 11, color: ds.color.mute2 }}>AI enhances your prompt, then you confirm before generating</p>
          </div>
        )}

        {history.map(item => (
          <HistoryCard key={item.id} item={item} onReuse={() => reuseSettings(item)} onDelete={() => deleteItem(item.id)} />
        ))}

        {anyGenerating && (
          <div style={{ textAlign: "center", padding: "8px 0", marginBottom: 8 }}>
            <span style={{ fontSize: 11, color: ds.color.sky, fontWeight: 600, letterSpacing: 0.5 }}>● AI is working…</span>
          </div>
        )}
      </div>

      {/* ── Input panel (sticky bottom) ── */}
      <div style={{
        position: "relative", zIndex: 10, flexShrink: 0,
        borderTop: `1px solid ${ds.color.line}`,
        background: ds.color.card,
        padding: "16px 24px 20px",
      }}>
        <div style={{ maxWidth: 820, margin: "0 auto" }}>

          {/* ── Top bar: Mode + AI model ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {/* Mode selector */}
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowModes(!showModes)} style={{
                display: "flex", alignItems: "center", gap: 8,
                background: ds.color.alert, border: `1px solid ${ds.color.line}`, borderRadius: 10,
                padding: "7px 14px", cursor: "pointer", color: ds.color.ink,
              }}>
                <span style={{ fontSize: 14 }}>{modeIcon(mode)}</span>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{modeLabel(mode)}</span>
                <span style={{ fontSize: 9, color: ds.color.mute, marginLeft: 2 }}>{showModes ? "▲" : "▼"}</span>
              </button>
              {showModes && (
                <div style={{
                  position: "absolute", bottom: "100%", left: 0,
                  background: ds.color.card, border: `1px solid ${ds.color.line}`, borderRadius: 14,
                  padding: 12, marginBottom: 4,
                  display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6,
                  width: 480, zIndex: 20,
                  boxShadow: "0 -8px 40px rgba(0,0,0,0.4)",
                }}>
                  {MODES.map(m => {
                    const active = mode === m.id;
                    return (
                      <button key={m.id} onClick={() => switchMode(m.id)} style={{
                        display: "flex", alignItems: "center", gap: 10,
                        padding: "10px 14px", borderRadius: 10, cursor: "pointer",
                        border: `1px solid ${active ? ds.color.sky + "60" : ds.color.line}`,
                        background: active ? `${ds.color.sky}0e` : "transparent",
                        textAlign: "left",
                      }}>
                        <span style={{ fontSize: 16, color: active ? ds.color.sky : ds.color.mute }}>{m.icon}</span>
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: active ? ds.color.ink : "#c0c0d8" }}>
                            {m.label}
                            {m.badge && <span style={{ marginLeft: 6, fontSize: 8, background: `${ds.color.sky}25`, color: ds.color.sky, padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>{m.badge}</span>}
                          </div>
                          <div style={{ fontSize: 10, color: ds.color.mute }}>{m.tag}</div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

          {/* AI Motion sub-modes */}
          {mode === "ai_motion" && (
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              {MOTION_SUB.map(sm => (
                <button key={sm.id} onClick={() => setMotionSub(sm.id)} style={{
                  padding: "7px 14px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: "pointer",
                  border: `1px solid ${motionSub === sm.id ? sm.color + "60" : ds.color.line}`,
                  background: motionSub === sm.id ? `${sm.color}12` : "transparent",
                  color: motionSub === sm.id ? sm.color : ds.color.mute,
                }}>{sm.icon} {sm.title}</button>
              ))}
            </div>
          )}

          {/* ── Upload zones ── */}
          {(showPrimaryUpload || showSecondaryVid || mode === "images_audio") && (
            <div style={{ marginBottom: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {/* Primary multi-image upload */}
              {showPrimaryUpload && (
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) handlePrimaryUpload(e.dataTransfer.files); }}
                  style={{
                    flex: 1, minWidth: 160,
                    border: `2px dashed ${uploadedFiles.length > 0 ? ds.color.mint : ds.color.line}`,
                    borderRadius: 12, padding: "10px 16px", cursor: "pointer",
                    background: uploadedFiles.length > 0 ? `${ds.color.mint}08` : "transparent",
                    textAlign: "center", transition: "all 0.2s",
                  }}>
                  {uploadedFiles.length > 0 ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                      {uploadedFiles.slice(0, 3).map((f, i) => (
                        <div key={i} style={{ fontSize: 11, color: ds.color.mint, fontWeight: 600 }}>
                          {f.name.slice(0, 14)}…
                        </div>
                      ))}
                      {uploadedFiles.length > 3 && <span style={{ fontSize: 11, color: ds.color.mute }}>+{uploadedFiles.length - 3} more</span>}
                      <button onClick={e => { e.stopPropagation(); setUploadedFiles([]); setUploadedPaths([]); }}
                        style={{ background: "none", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer" }}>Clear</button>
                    </div>
                  ) : (
                    <>
                      <span style={{ fontSize: 18 }}>{uploading ? "⏳" : ""}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ds.color.mute, marginLeft: 8 }}>
                        {uploading ? "Uploading…" : mode === "video_to_video" ? "Upload Video" : "Upload Image(s)"}
                      </span>
                      <div style={{ fontSize: 10, color: ds.color.mute2, marginTop: 3 }}>Click or drag • multiple files OK</div>
                    </>
                  )}
                  <input ref={fileRef} type="file"
                    accept={mode === "video_to_video" ? "video/*" : "image/*"}
                    multiple={mode !== "video_to_video"}
                    style={{ display: "none" }}
                    onChange={e => { if (e.target.files) handlePrimaryUpload(e.target.files); e.target.value = ""; }} />
                </div>
              )}

              {/* Secondary video upload */}
              {showSecondaryVid && (
                <div onClick={() => refVidRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleRefVideoUpload(f); }}
                  style={{
                    flex: 1, minWidth: 160,
                    border: `2px dashed ${refVideoFile ? ds.color.sky : ds.color.line}`,
                    borderRadius: 12, padding: "12px 16px", cursor: "pointer",
                    background: refVideoFile ? `${ds.color.sky}08` : "transparent",
                    textAlign: "center",
                  }}>
                  <span style={{ fontSize: 18 }}>{refVideoFile ? "" : ""}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: refVideoFile ? ds.color.sky : ds.color.mute, marginLeft: 8 }}>
                    {refVideoFile ? refVideoFile.name.slice(0, 20) + "…" : "Reference Video"}
                  </span>
                  {refVideoFile && (
                    <button onClick={e => { e.stopPropagation(); setRefVideoFile(null); setRefVideoPath(""); }}
                      style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer" }}></button>
                  )}
                  <input ref={refVidRef} type="file" accept="video/*" style={{ display: "none" }}
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleRefVideoUpload(f); e.target.value = ""; }} />
                </div>
              )}

              {/* Slideshow multi-upload */}
              {mode === "images_audio" && (
                <div onClick={() => slideRef.current?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => { e.preventDefault(); if (e.dataTransfer.files) handleSlideUpload(e.dataTransfer.files); }}
                  style={{
                    flex: 1, minWidth: 160,
                    border: `2px dashed ${slideFiles.length > 0 ? ds.color.mint : ds.color.line}`,
                    borderRadius: 12, padding: "12px 16px", cursor: "pointer", textAlign: "center",
                    background: slideFiles.length > 0 ? `${ds.color.mint}08` : "transparent",
                  }}>
                  <span style={{ fontSize: 18 }}></span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: slideFiles.length > 0 ? ds.color.mint : ds.color.mute, marginLeft: 8 }}>
                    {slideFiles.length > 0 ? `${slideFiles.length} photo${slideFiles.length > 1 ? "s" : ""}` : "Upload Photos"}
                  </span>
                  {slideFiles.length > 0 && (
                    <button onClick={e => { e.stopPropagation(); setSlideFiles([]); setSlidePaths([]); }}
                      style={{ marginLeft: 8, background: "none", border: "none", color: "#ef4444", fontSize: 11, cursor: "pointer" }}></button>
                  )}
                  <input ref={slideRef} type="file" accept="image/*" multiple style={{ display: "none" }}
                    onChange={e => { if (e.target.files) handleSlideUpload(e.target.files); e.target.value = ""; }} />
                </div>
              )}
            </div>
          )}

          {/* ── Ref image chips (shown when files are attached) ── */}
          {refImageFiles.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {refImageFiles.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, background: `${ds.color.lilac}15`, border: `1px solid ${ds.color.lilac}35`, borderRadius: 20, padding: "4px 10px" }}>
                  <span style={{ fontSize: 10, color: ds.color.lilac, fontWeight: 600 }}>{f.name.slice(0, 18)}{f.name.length > 18 ? "…" : ""}</span>
                  <button onClick={() => {
                    setRefImageFiles(prev => prev.filter((_, j) => j !== i));
                    setRefImagePaths(prev => prev.filter((_, j) => j !== i));
                  }} style={{ background: "none", border: "none", color: ds.color.mute2, fontSize: 11, cursor: "pointer", padding: 0, lineHeight: 1 }}></button>
                </div>
              ))}
            </div>
          )}

          {/* ── Prompt textarea ── */}
          <div style={{ position: "relative", marginBottom: 10 }}>
            {/* "+" attach button — left side, ChatGPT style */}
            <button
              onClick={() => refImgRef.current?.click()}
              title="Attach reference images to guide the AI"
              style={{
                position: "absolute", bottom: 10, left: 10, zIndex: 2,
                width: 30, height: 30, borderRadius: "50%", border: `1.5px solid ${ds.color.line}`,
                background: ds.color.alert, color: "#fff", fontSize: 18, lineHeight: "28px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontWeight: 300, transition: "border-color 0.2s, background 0.2s",
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ds.color.sky; (e.currentTarget as HTMLButtonElement).style.background = `${ds.color.sky}18`; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = ds.color.line; (e.currentTarget as HTMLButtonElement).style.background = ds.color.alert; }}
            >+</button>
            <input ref={refImgRef} type="file" accept="image/*" multiple style={{ display: "none" }}
              onChange={e => { if (e.target.files) handleRefImgUpload(e.target.files); e.target.value = ""; }} />

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleGenerate(); } }}
              placeholder={placeholder}
              rows={3}
              style={{
                width: "100%", boxSizing: "border-box",
                background: ds.color.alert, border: `1.5px solid ${ds.color.line}`, borderRadius: 14,
                color: ds.color.ink, fontSize: 14, padding: "14px 18px 44px 50px",
                resize: "none", outline: "none", lineHeight: 1.7, fontFamily: "inherit",
                transition: "border-color 0.2s",
              }}
              onFocus={e => { (e.target as HTMLTextAreaElement).style.borderColor = ds.color.sky + "80"; }}
              onBlur={e => { (e.target as HTMLTextAreaElement).style.borderColor = ds.color.line; }}
            />
            <button
              onClick={handleGenerate}
              disabled={!canGenerate}
              style={{
                position: "absolute", bottom: 10, right: 10,
                padding: "9px 22px", borderRadius: 9, border: "none",
                background: !canGenerate ? ds.color.alert
                  : "linear-gradient(135deg, #8b5cf6 0%, #ec4899 48%, #f97316 100%)",
                color: !canGenerate ? ds.color.mute : "#fff",
                fontSize: 13, fontWeight: 700, cursor: !canGenerate ? "not-allowed" : "pointer",
                boxShadow: !canGenerate ? "none" : "0 4px 24px rgba(236,72,153,0.50)",
                animation: canGenerate && !enhancing && !isSubmitting ? "shimmerGrad 3s ease-in-out infinite" : "none",
                overflow: "hidden",
              }}>
              {enhancing ? "Enhancing…" : isSubmitting ? "Sending…" : "Generate"}
            </button>
          </div>

          {/* ── Settings row ── */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {mode !== "text_to_image" && (
              <div style={{ minWidth: 160 }}>
                <DurationPicker compact label=""
                  options={DURATIONS.map(d => ({ label: d.l, seconds: d.v }))}
                  value={DURATIONS.find(d => d.v === duration)?.l}
                  onChange={(_, secs) => setDuration(secs)}
                  accentColor={ds.color.sky}
                />
              </div>
            )}

            {/* AI model — right next to duration */}
            <div style={{ display: "flex", background: ds.color.alert, border: `1px solid ${ds.color.line}`, borderRadius: 8, overflow: "hidden", flexShrink: 0 }}>
              {AI_MODELS.map(m => {
                const active = aiModel === m.id;
                return (
                  <button key={m.id} onClick={() => setAiModel(m.id)} title={m.desc} style={{
                    display: "flex", alignItems: "center", gap: 5,
                    padding: "5px 11px", border: "none",
                    background: active ? `${m.badgeColor}18` : "transparent",
                    color: active ? m.badgeColor : ds.color.mute,
                    fontSize: 11, fontWeight: 700, cursor: "pointer",
                    borderRight: m.id === "haiku" ? `1px solid ${ds.color.line}` : "none",
                    transition: "all 0.15s",
                  }}>
                    <span>{m.icon}</span>
                    <span>{m.badge}</span>
                  </button>
                );
              })}
            </div>
            {mode !== "text_to_audio" && (
              <div style={{ display: "flex", background: ds.color.alert, border: `1px solid ${ds.color.line}`, borderRadius: 8, overflow: "hidden" }}>
                {ASPECTS.map(a => (
                  <button key={a.v} onClick={() => setAspect(a.v as "9:16"|"16:9"|"1:1")} title={a.s} style={{
                    padding: "5px 11px", border: "none",
                    background: aspect === a.v ? `${ds.color.sky}20` : "transparent",
                    color: aspect === a.v ? ds.color.sky : ds.color.mute, fontSize: 11, fontWeight: 700, cursor: "pointer",
                  }}>{a.l}</button>
                ))}
              </div>
            )}
            {mode !== "text_to_image" && mode !== "text_to_audio" && (
              <div style={{ display: "flex", background: ds.color.alert, border: `1px solid ${ds.color.line}`, borderRadius: 8, overflow: "hidden" }}>
                {[{ id: "voice_music", l: "V+M" }, { id: "voice_only", l: "Voice" }, { id: "music_only", l: "Music" }, { id: "none", l: "Silent" }].map(a => (
                  <button key={a.id} onClick={() => setAudioMode(a.id as typeof audioMode)} style={{
                    padding: "5px 10px", border: "none",
                    background: audioMode === a.id ? `${ds.color.sky}20` : "transparent",
                    color: audioMode === a.id ? ds.color.sky : ds.color.mute, fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>{a.l}</button>
                ))}
              </div>
            )}
            <button onClick={() => setShowAdv(!showAdv)} style={{
              padding: "5px 11px", borderRadius: 8, border: `1px solid ${ds.color.line}`,
              background: showAdv ? `${ds.color.sky}12` : "transparent",
              color: showAdv ? ds.color.sky : ds.color.mute2, fontSize: 11, cursor: "pointer", fontWeight: 600,
            }}>Adv</button>
          </div>

          {showAdv && (
            <div style={{
              marginTop: 10, padding: "14px 16px", background: ds.color.alert,
              border: `1px solid ${ds.color.line}`, borderRadius: 12,
              display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12,
            }}>
              <div>
                <label style={{ fontSize: 9, fontWeight: 800, color: ds.color.mute2, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)} style={{ width: "100%", background: ds.color.paper, border: `1px solid ${ds.color.line}`, color: ds.color.ink, borderRadius: 7, padding: "7px 9px", fontSize: 12 }}>
                  {LANGUAGES.map(l => <option key={l.v} value={l.v}>{l.l}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 9, fontWeight: 800, color: ds.color.mute2, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Visual Style</label>
                <select value={style} onChange={e => setStyle(e.target.value)} style={{ width: "100%", background: ds.color.paper, border: `1px solid ${ds.color.line}`, color: ds.color.ink, borderRadius: 7, padding: "7px 9px", fontSize: 12 }}>
                  {STYLES.map(s => <option key={s} value={s === "— Any —" ? "" : s}>{s}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 9, fontWeight: 800, color: ds.color.mute2, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Generation Models</label>
                <ModelPicker
                  videoModel={selectedVideoModel}
                  imageModel={selectedImageModel}
                  onVideoChange={setSelectedVideoModel}
                  onImageChange={setSelectedImageModel}
                  accentColor={ds.color.sky}
                  compact
                />
              </div>
              {/* ── SC: 5-Tier Sound Model Selector (binding) ── */}
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={{ fontSize: 9, fontWeight: 800, color: ds.color.mute2, textTransform: "uppercase", letterSpacing: 1, display: "block", marginBottom: 5 }}>Sound Model</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {SOUND_TIERS_FREE.map((tier, idx) => {
                    const active = soundTier === tier.id;
                    return (
                      <button
                        key={tier.id}
                        onClick={() => setSoundTier(tier.id)}
                        title={tier.subtitle}
                        style={{
                          display: "flex", flexDirection: "column", alignItems: "flex-start",
                          padding: "6px 10px", borderRadius: 8, cursor: "pointer", border: "none",
                          background: active ? `${ds.color.sky}18` : ds.color.paper,
                          outline: active ? `1.5px solid ${ds.color.sky}50` : `1px solid ${ds.color.line}`,
                          transition: "all 0.15s",
                          minWidth: 72,
                        }}
                      >
                        <span style={{ fontSize: 9, color: active ? ds.color.sky : ds.color.mute2, fontWeight: 700 }}>{idx + 1}. {tier.label}</span>
                        <span style={{ fontSize: 8, color: active ? ds.color.sky : ds.color.mute2, opacity: 0.7 }}>{tier.cost}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Confirm modal ── */}
      {confirmData && (
        <ConfirmModal
          rawPrompt={confirmData.raw}
          enhance={confirmData.enhance}
          onConfirm={handleConfirm}
          onEdit={() => setConfirmData(null)}
        />
      )}

      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.4; transform: scale(1); }
          50%       { opacity: 0.7; transform: scale(1.08); }
        }
        @keyframes shimmerGrad {
          0%   { box-shadow: 0 4px 24px rgba(236,72,153,0.40); }
          50%  { box-shadow: 0 4px 36px rgba(139,92,246,0.60), 0 0 0 3px rgba(236,72,153,0.15); }
          100% { box-shadow: 0 4px 24px rgba(236,72,153,0.40); }
        }
      `}</style>
    </div>
  );
}

export default function FreeModePageWrapper() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: "100vh", background: "#090c14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#3b82f6", fontSize: 14, fontWeight: 700 }}>Loading Free Mode…</div>
      </div>
    }>
      <FreeModeInner />
    </Suspense>
  );
}
