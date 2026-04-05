"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ContentItem, ContentVersion, ContentStatus } from "@/types/content";
import OverlayPanel from "../../../components/OverlayPanel";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";

// ── Provider badge ───────────────────────────────────────────
type ProviderTier = "real" | "mock" | "stock" | "fallback";
const PROVIDER_META: Record<string, { label: string; tier: ProviderTier }> = {
  runway:        { label: "Runway (real)",          tier: "real"     },
  kling:         { label: "Kling (real)",           tier: "real"     },
  elevenlabs:    { label: "ElevenLabs (real)",      tier: "real"     },
  kie_ai:        { label: "Kie.ai (real)",          tier: "real"     },
  stock_library: { label: "Stock library",          tier: "stock"    },
  mock_video:    { label: "mock_video (fallback)",  tier: "fallback" },
  mock_voice:    { label: "mock_voice (fallback)",  tier: "fallback" },
  mock_music:    { label: "mock_music (generated)", tier: "mock"     },
};
const TIER_STYLE: Record<ProviderTier, string> = {
  real:     "bg-green-900/60 text-green-300 border border-green-800",
  stock:    "bg-blue-900/60 text-blue-300 border border-blue-800",
  mock:     "bg-yellow-900/60 text-yellow-300 border border-yellow-800",
  fallback: "bg-orange-900/60 text-orange-300 border border-orange-800",
};
function ProviderBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-gray-700 text-xs">—</span>;
  const meta = PROVIDER_META[name] ?? { label: name, tier: "mock" as ProviderTier };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${TIER_STYLE[meta.tier]}`}>
      {meta.label}
    </span>
  );
}

// ── Media URL helper ─────────────────────────────────────────
function toMediaUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  const clean = p.replace(/\\/g, "/").replace(/^(\.\/|\/)?storage\//, "");
  return `/api/media/${clean}`;
}

// ── Status colors ────────────────────────────────────────────
const STATUS_COLORS: Record<ContentStatus, string> = {
  PENDING:          "bg-gray-700 text-gray-300",
  ENHANCING:        "bg-blue-900 text-blue-300",
  GENERATING_VIDEO: "bg-purple-900 text-purple-300",
  GENERATING_VOICE: "bg-indigo-900 text-indigo-300",
  GENERATING_MUSIC: "bg-pink-900 text-pink-300",
  MERGING:          "bg-yellow-900 text-yellow-300",
  IN_REVIEW:        "bg-orange-900 text-orange-300",
  APPROVED:         "bg-green-900 text-green-300",
  REJECTED:         "bg-red-900 text-red-300",
  FAILED:           "bg-red-950 text-red-400",
  PUBLISHED:        "bg-teal-900 text-teal-300",
  ARCHIVED:         "bg-gray-800 text-gray-500",
};

// ── Device frame type ────────────────────────────────────────
type DeviceFrame = "phone" | "tablet" | "desktop";

// ── Video Player ─────────────────────────────────────────────
// Aspect-ratio-aware video player with device frame + safe zone overlay + fullscreen.
function VideoPlayer({
  url,
  aspectRatio,
  frame,
  safeZone,
}: {
  url: string;
  aspectRatio: string;
  frame: DeviceFrame;
  safeZone: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // CSS aspect-ratio value
  const arCss = aspectRatio === "16:9" ? "16/9" : aspectRatio === "1:1" ? "1/1" : "9/16";
  const isPortrait = aspectRatio === "9:16" || !aspectRatio;

  function handleFullscreen() {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }

  // ── Video element shared ──────────────────────────────────
  const videoEl = (
    <video
      src={url}
      controls
      className="w-full h-full object-contain bg-black"
      preload="metadata"
    />
  );

  // ── Safe zone overlay (portrait only) ────────────────────
  const safeZoneOverlay = safeZone && isPortrait && (
    <div
      className="absolute pointer-events-none z-10"
      style={{ inset: "8%" }}
    >
      <div className="w-full h-full border border-dashed border-white/25 rounded-sm relative">
        <span className="absolute top-1 left-1 text-[9px] text-white/40 leading-none select-none">
          caption safe
        </span>
      </div>
    </div>
  );

  // ── Phone frame ───────────────────────────────────────────
  if (frame === "phone") {
    return (
      <div ref={containerRef} className="flex justify-center">
        <div
          className="relative bg-gray-800 shadow-2xl"
          style={{ maxWidth: 300, width: "100%", borderRadius: "2rem", padding: "28px 10px 32px" }}
        >
          {/* Notch */}
          <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-16 h-3.5 bg-gray-700 rounded-full" />
          {/* Home indicator */}
          <div className="absolute bottom-[10px] left-1/2 -translate-x-1/2 w-12 h-1.5 bg-gray-600 rounded-full" />
          {/* Screen */}
          <div
            className="relative overflow-hidden bg-black"
            style={{ aspectRatio: arCss, borderRadius: "1rem" }}
          >
            {videoEl}
            {safeZoneOverlay}
            {/* Fullscreen button */}
            <button
              onClick={handleFullscreen}
              className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/80 text-white/70 hover:text-white rounded p-1 transition-colors"
              title="Fullscreen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Tablet frame ──────────────────────────────────────────
  if (frame === "tablet") {
    return (
      <div ref={containerRef} className="flex justify-center">
        <div
          className="relative border-4 border-gray-700 rounded-2xl overflow-hidden shadow-xl bg-black"
          style={{ maxWidth: isPortrait ? 480 : "100%", width: "100%" }}
        >
          <div className="relative" style={{ aspectRatio: arCss }}>
            {videoEl}
            {safeZoneOverlay}
            <button
              onClick={handleFullscreen}
              className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/80 text-white/70 hover:text-white rounded p-1.5 transition-colors"
              title="Fullscreen"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Desktop frame (no chrome) ─────────────────────────────
  // Portrait 9:16: constrain height so it doesn't dominate the page
  // Landscape / square: fill column width
  return (
    <div ref={containerRef}>
      <div
        className="relative overflow-hidden rounded-xl bg-black mx-auto"
        style={
          isPortrait
            ? {
                aspectRatio: arCss,
                maxHeight: "calc(100vh - 220px)",
                maxWidth: "calc((100vh - 220px) * 9 / 16)",
                width: "100%",
              }
            : { aspectRatio: arCss, width: "100%" }
        }
      >
        {videoEl}
        {safeZoneOverlay}
        <button
          onClick={handleFullscreen}
          className="absolute top-2 right-2 z-20 bg-black/50 hover:bg-black/80 text-white/70 hover:text-white rounded p-1.5 transition-colors"
          title="Fullscreen"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Continue This Story panel ────────────────────────────────
interface ContinuationSuggestion {
  id: string;
  label: string;
  description: string;
  storyContext: string;
  promptSeed: string;
  keepCasting: boolean;
  keepVoice: boolean;
}

function ContinueStoryPanel({ item, router }: { item: import("@/types/content").ContentItem; router: ReturnType<typeof useRouter> }) {
  const [suggestions, setSuggestions] = useState<ContinuationSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    if (suggestions.length > 0) return; // already loaded
    setLoading(true);
    try {
      const res = await fetch(`/api/content/${item.id}/suggest-continuation`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [item.id, suggestions.length]);

  function handleOpen() {
    setOpen(o => !o);
    if (!open) load();
  }

  function pickSuggestion(s: ContinuationSuggestion) {
    const params = new URLSearchParams({ continue: item.id });
    if (s.promptSeed) params.set("promptSeed", s.promptSeed);
    router.push(`/dashboard?${params.toString()}`);
  }

  return (
    <div style={{ background: "#12121a", border: "1px solid #2a2a40", borderRadius: 12, overflow: "hidden" }}>
      <button
        onClick={handleOpen}
        style={{ width: "100%", padding: "14px 18px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "none", cursor: "pointer" }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: "#7c5cfc", fontSize: 16 }}>▶</span>
          <span style={{ color: "#c0c0e0", fontWeight: 600, fontSize: 14 }}>Continue This Story</span>
          <span style={{ color: "#5a5a7a", fontSize: 12 }}>— supervisor will suggest what comes next</span>
        </div>
        <span style={{ color: "#5a5a7a", fontSize: 12 }}>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div style={{ borderTop: "1px solid #1a1a30", padding: "16px 18px" }}>
          {loading ? (
            <p style={{ color: "#5a5a7a", fontSize: 13 }}>Supervisor is analysing this scene…</p>
          ) : suggestions.length === 0 ? (
            <p style={{ color: "#5a5a7a", fontSize: 13 }}>No suggestions available.</p>
          ) : (
            <>
              <p style={{ color: "#5a5a7a", fontSize: 12, marginBottom: 12 }}>
                Click a suggestion to continue in the Studio. The supervisor will carry the story context and casting from this scene.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {suggestions.map(s => (
                  <button
                    key={s.id}
                    onClick={() => pickSuggestion(s)}
                    style={{
                      background: "#1a1a2e",
                      border: "1px solid #2a2a40",
                      borderRadius: 8,
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "#7c5cfc")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "#2a2a40")}
                  >
                    <p style={{ color: "#d0d0f0", fontWeight: 500, fontSize: 13, marginBottom: 3 }}>{s.label}</p>
                    <p style={{ color: "#5a5a7a", fontSize: 12 }}>{s.description}</p>
                    <div className="flex gap-2 mt-2">
                      {s.keepCasting && (
                        <span style={{ background: "#1a2a1a", color: "#4ade80", fontSize: 10, borderRadius: 4, padding: "2px 6px", border: "1px solid #2a3a2a" }}>
                          same casting
                        </span>
                      )}
                      {s.keepVoice && (
                        <span style={{ background: "#1a1a2e", color: "#7c5cfc", fontSize: 10, borderRadius: 4, padding: "2px 6px", border: "1px solid #2a2a4a" }}>
                          same voice
                        </span>
                      )}
                      {!s.keepCasting && (
                        <span style={{ background: "#2a1a1a", color: "#f87171", fontSize: 10, borderRadius: 4, padding: "2px 6px", border: "1px solid #3a2a2a" }}>
                          new character
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Audio track (compact) ────────────────────────────────────
function AudioTrack({ label, url, filePath, source }: {
  label: string;
  url: string | null;
  filePath?: string | null;
  source?: string | null;
}) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!url) { setOk(false); return; }
    fetch(url, { method: "HEAD" }).then((r) => setOk(r.ok)).catch(() => setOk(false));
  }, [url]);

  const fileName = filePath ? filePath.split(/[/\\]/).pop() : null;
  const sourceBadge = source ? (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ml-1 ${
      source === "generated" ? "bg-green-950/60 text-green-500" :
      source === "uploaded"  ? "bg-yellow-950/60 text-yellow-500" :
      source === "stock" || source === "pixabay" ? "bg-blue-950/60 text-blue-500" :
      "bg-gray-800 text-gray-600"
    }`}>{source}</span>
  ) : null;

  if (!url || ok === false) {
    return (
      <div className="flex items-center gap-3 text-xs text-gray-600 py-1">
        <span className="w-12 shrink-0 text-gray-700 uppercase tracking-wide">{label}</span>
        <span>{url ? "file missing" : "not generated"}</span>
        {sourceBadge}
      </div>
    );
  }

  if (ok === null) {
    return (
      <div className="flex items-center gap-3 text-xs text-gray-600 py-1">
        <span className="w-12 shrink-0 text-gray-700 uppercase tracking-wide">{label}</span>
        <span>checking...</span>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wide w-12 shrink-0">{label}</span>
        {fileName && <span className="text-xs text-gray-700 font-mono truncate flex-1">{fileName}</span>}
        {sourceBadge}
        <a href={url} download className="text-xs text-blue-400 hover:text-blue-300 shrink-0 transition-colors">↓</a>
      </div>
      <audio src={url} controls className="w-full" preload="metadata" style={{ height: 32 }} />
    </div>
  );
}

// ── Detail section row ───────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-gray-600 w-28 shrink-0 text-xs pt-0.5">{label}</span>
      <div className="text-xs">{children}</div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────
export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [item, setItem] = useState<ContentItem | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [actionDone, setActionDone] = useState<"approved" | "rejected" | null>(null);

  // Preview controls
  const [frame, setFrame] = useState<DeviceFrame>("phone");
  const [safeZone, setSafeZone] = useState(false);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);

  // ── Finishing desk state ──────────────────────────────────
  const [editNarration, setEditNarration] = useState("");
  const [editingNarration, setEditingNarration] = useState(false);
  const [regenVoiceLoading, setRegenVoiceLoading] = useState(false);
  const [regenMusicLoading, setRegenMusicLoading] = useState(false);
  const [remergeLoading, setRemergeLoading] = useState(false);
  const [finishMsg, setFinishMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [musicMoodEdit, setMusicMoodEdit] = useState("");
  const voiceFileRef = useRef<HTMLInputElement>(null);
  const musicFileRef = useRef<HTMLInputElement>(null);
  const [uploadVoiceLoading, setUploadVoiceLoading] = useState(false);
  const [uploadMusicLoading, setUploadMusicLoading] = useState(false);
  const [showSupervisorPlan, setShowSupervisorPlan] = useState(false);

  async function fetchItem() {
    const res = await fetch(`/api/registry/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setItem(data.item);
    setVersions(data.versions ?? []);
    setLoading(false);
    // Default frame based on format
    const ar = data.item?.aspectRatio ?? "9:16";
    setFrame(ar === "16:9" ? "desktop" : "phone");
  }

  useEffect(() => { fetchItem(); }, [id]);

  async function handleApprove() {
    if (!item) return;
    setActionLoading(true);
    await fetch(`/api/review/${item.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || undefined }),
    });
    setActionDone("approved");
    setActionLoading(false);
    fetchItem();
  }

  async function handleReject() {
    if (!item) return;
    setActionLoading(true);
    await fetch(`/api/review/${item.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || undefined }),
    });
    setActionDone("rejected");
    setActionLoading(false);
    setShowReject(false);
    setNote("");
    fetchItem();
  }

  // ── Finishing desk handlers ───────────────────────────────
  function showMsg(type: "ok" | "err", text: string) {
    setFinishMsg({ type, text });
    setTimeout(() => setFinishMsg(null), 4000);
  }

  async function handleRegenVoice() {
    if (!item) return;
    setRegenVoiceLoading(true);
    const narr = editingNarration && editNarration.trim() ? editNarration.trim() : undefined;
    const res = await fetch(`/api/content/${item.id}/regenerate-voice`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ narrationScript: narr }),
    });
    const data = await res.json();
    setRegenVoiceLoading(false);
    if (res.ok) { showMsg("ok", "Voice regenerated"); setEditingNarration(false); fetchItem(); }
    else showMsg("err", data.error ?? "Voice regen failed");
  }

  async function handleRegenMusic() {
    if (!item) return;
    setRegenMusicLoading(true);
    const mood = musicMoodEdit || undefined;
    const res = await fetch(`/api/content/${item.id}/regenerate-music`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood }),
    });
    const data = await res.json();
    setRegenMusicLoading(false);
    if (res.ok) { showMsg("ok", "Music replaced"); fetchItem(); }
    else showMsg("err", data.error ?? "Music regen failed");
  }

  async function handleRemerge() {
    if (!item) return;
    setRemergeLoading(true);
    const res = await fetch(`/api/content/${item.id}/remerge`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    setRemergeLoading(false);
    if (res.ok) { showMsg("ok", "Re-merged successfully"); fetchItem(); }
    else showMsg("err", data.error ?? "Re-merge failed");
  }

  async function handleUploadVoice(file: File) {
    if (!item) return;
    setUploadVoiceLoading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/content/${item.id}/upload-voice`, { method: "POST", body: form });
    const data = await res.json();
    setUploadVoiceLoading(false);
    if (res.ok) { showMsg("ok", "Voice replaced"); fetchItem(); }
    else showMsg("err", data.error ?? "Upload failed");
  }

  async function handleUploadMusic(file: File) {
    if (!item) return;
    setUploadMusicLoading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/content/${item.id}/upload-music`, { method: "POST", body: form });
    const data = await res.json();
    setUploadMusicLoading(false);
    if (res.ok) { showMsg("ok", "Music replaced"); fetchItem(); }
    else showMsg("err", data.error ?? "Upload failed");
  }

  if (loading) return <div className="text-gray-500 py-16 text-center">Loading...</div>;

  if (notFound || !item) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">Content item not found.</p>
        <button onClick={() => router.push("/dashboard/registry")} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
          Back to Registry
        </button>
      </div>
    );
  }

  const mergedUrl = toMediaUrl(item.mergedOutputPath);
  const voiceUrl  = toMediaUrl(item.voicePath);
  const musicUrl  = toMediaUrl(item.musicPath);
  const isInReview = item.status === "IN_REVIEW";
  const isTerminal = ["APPROVED", "REJECTED", "FAILED", "ARCHIVED", "PUBLISHED"].includes(item.status);
  const aspectRatio = (item.aspectRatio as string) ?? "9:16";
  const isPortrait  = aspectRatio === "9:16";

  const frameBtn = (f: DeviceFrame, label: string) => (
    <button
      onClick={() => setFrame(f)}
      className={`px-3 py-1 rounded text-xs font-medium transition-colors border ${
        frame === f
          ? "bg-gray-700 border-gray-600 text-white"
          : "border-gray-800 text-gray-500 hover:text-gray-300 hover:border-gray-700"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="w-full">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-white mb-4 flex items-center gap-1 transition-colors"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-5">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 font-mono mb-1">{item.id}</p>
          <h1 className="text-xl font-bold text-white break-words">{item.originalInput}</h1>
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[item.status]}`}>
          {item.status}
        </span>
      </div>

      {/* Action banners */}
      {actionDone === "approved" && (
        <div className="bg-green-900/40 border border-green-800 rounded-xl px-4 py-3 mb-5 text-sm text-green-300">
          Approved. View anytime from the Registry.
        </div>
      )}
      {actionDone === "rejected" && (
        <div className="bg-red-900/40 border border-red-800 rounded-xl px-4 py-3 mb-5 text-sm text-red-300">
          Rejected. View anytime from the Registry.
        </div>
      )}

      {/* ── Two-column layout: video left, panel right ─────── */}
      <div className="lg:grid lg:gap-8 lg:items-start" style={{ gridTemplateColumns: "1fr 380px" }}>

        {/* ── LEFT: sticky video preview ─────────────────────── */}
        <div className="lg:sticky lg:top-6 mb-6 lg:mb-0">

          {/* Preview toolbar */}
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              {/* Format badge */}
              <span className={`text-xs px-2 py-0.5 rounded font-mono font-semibold ${
                aspectRatio === "9:16"
                  ? "bg-blue-950/60 text-blue-300 border border-blue-800/60"
                  : aspectRatio === "16:9"
                  ? "bg-green-950/60 text-green-300 border border-green-800/60"
                  : "bg-purple-950/60 text-purple-300 border border-purple-800/60"
              }`}>
                {aspectRatio}
                <span className="ml-1 text-[10px] font-normal opacity-70">
                  {aspectRatio === "9:16" ? "Portrait" : aspectRatio === "16:9" ? "Landscape" : "Square"}
                </span>
              </span>
              {/* Device frame switcher */}
              <div className="flex gap-1">
                {frameBtn("phone", "Phone")}
                {frameBtn("tablet", "Tablet")}
                {frameBtn("desktop", "Desktop")}
              </div>
            </div>
            {/* Safe zone toggle (portrait only) */}
            {isPortrait && (
              <button
                onClick={() => setSafeZone((v) => !v)}
                className={`text-xs px-2 py-1 rounded border transition-colors ${
                  safeZone
                    ? "bg-yellow-950/60 border-yellow-800/60 text-yellow-400"
                    : "border-gray-800 text-gray-600 hover:text-gray-400 hover:border-gray-700"
                }`}
              >
                {safeZone ? "Safe zone on" : "Safe zone"}
              </button>
            )}
          </div>

          {/* Video player */}
          {mergedUrl ? (
            <VideoPlayer
              url={mergedUrl}
              aspectRatio={aspectRatio}
              frame={frame}
              safeZone={safeZone}
            />
          ) : isTerminal ? (
            <div className="bg-red-950/30 border border-red-900 rounded-xl p-6 text-center">
              <p className="text-red-400 text-sm font-medium">No merged output recorded.</p>
              <p className="text-gray-600 text-xs mt-1">Pipeline may have failed. Check notes in the panel →</p>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <p className="text-gray-500 text-sm">Pipeline in progress — video not yet available.</p>
              <button
                onClick={fetchItem}
                className="mt-3 text-xs text-blue-400 hover:text-blue-300 transition-colors"
              >
                Refresh status
              </button>
            </div>
          )}

          {/* Audio tracks */}
          <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Audio tracks</p>
            <AudioTrack label="Voice" url={voiceUrl} filePath={item.voicePath} source={item.voiceSource} />
            <AudioTrack label="Music" url={musicUrl} filePath={item.musicPath} source={item.musicSource} />
          </div>

          {/* Download merged */}
          {mergedUrl && (
            <a
              href={mergedUrl}
              download
              className="mt-3 flex items-center justify-center gap-2 w-full text-sm text-gray-400 hover:text-white border border-gray-800 hover:border-gray-600 rounded-xl py-2.5 transition-colors"
            >
              ↓ Download merged output
            </a>
          )}
        </div>

        {/* ── RIGHT: metadata + actions panel ───────────────── */}
        <div className="space-y-4">

          {/* Quick review action — floats at top of panel for IN_REVIEW */}
          {isInReview && !actionDone && (
            <div className="bg-orange-950/30 border border-orange-900/60 rounded-xl p-4">
              <p className="text-xs text-orange-400 font-semibold uppercase tracking-wide mb-3">Pending review</p>
              {showReject ? (
                <div className="space-y-2">
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Rejection reason (optional)"
                    rows={2}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-700 resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleReject}
                      disabled={actionLoading}
                      className="flex-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                    >
                      {actionLoading ? "Rejecting..." : "Confirm Reject"}
                    </button>
                    <button
                      onClick={() => { setShowReject(false); setNote(""); }}
                      className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    {actionLoading ? "Approving..." : "Approve"}
                  </button>
                  <button
                    onClick={() => setShowReject(true)}
                    disabled={actionLoading}
                    className="flex-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Finish message */}
          {finishMsg && (
            <div className={`rounded-xl px-4 py-2.5 text-sm font-medium ${
              finishMsg.type === "ok"
                ? "bg-green-900/40 border border-green-800 text-green-300"
                : "bg-red-900/40 border border-red-800 text-red-300"
            }`}>
              {finishMsg.type === "ok" ? "✓ " : "✗ "}{finishMsg.text}
            </div>
          )}

          {/* ── Finishing Desk ──────────────────────────────── */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Finishing Desk</p>
              <span className="text-xs text-gray-600">Edit · Regenerate · Upload</span>
            </div>

            {/* Narration text */}
            <div className="px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs text-gray-500 font-medium">Narration text</p>
                <button
                  onClick={() => {
                    if (!editingNarration) setEditNarration(item.narrationScript ?? item.originalInput ?? "");
                    setEditingNarration(v => !v);
                  }}
                  className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                >
                  {editingNarration ? "Cancel" : "Edit"}
                </button>
              </div>
              {editingNarration ? (
                <textarea
                  value={editNarration}
                  onChange={e => setEditNarration(e.target.value)}
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-600 resize-none"
                  placeholder="What should be narrated…"
                />
              ) : (
                <p className="text-gray-400 text-xs leading-relaxed italic">
                  &ldquo;{item.narrationScript ?? item.originalInput ?? "No narration text saved."}&rdquo;
                </p>
              )}
            </div>

            {/* Voice controls */}
            <div className="px-4 py-3 border-b border-gray-800/50">
              <p className="text-xs text-gray-500 font-medium mb-2">Voice</p>
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-xs text-gray-600 mr-1">
                  {item.voiceSource ? (
                    <span className={`px-1.5 py-0.5 rounded font-mono ${
                      item.voiceSource === "uploaded" ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/50" :
                      item.voiceSource === "generated" ? "bg-green-950/60 text-green-400 border border-green-900/50" :
                      "bg-gray-800 text-gray-500 border border-gray-700"
                    }`}>{item.voiceSource}</span>
                  ) : null}
                </span>
                <button
                  onClick={handleRegenVoice}
                  disabled={regenVoiceLoading}
                  className="text-xs bg-indigo-900/60 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {regenVoiceLoading ? "Regenerating…" : "↻ Regen voice"}
                </button>
                <button
                  onClick={() => voiceFileRef.current?.click()}
                  disabled={uploadVoiceLoading}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uploadVoiceLoading ? "Uploading…" : "↑ Upload voice"}
                </button>
                <input
                  ref={voiceFileRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadVoice(f); }}
                />
              </div>
            </div>

            {/* Music controls */}
            <div className="px-4 py-3 border-b border-gray-800/50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500 font-medium">Music</p>
                {item.musicPath && (
                  <span className="text-xs text-gray-700 font-mono truncate max-w-[180px]">
                    {item.musicPath.split(/[/\\]/).pop()}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5 flex-wrap mb-2">
                {item.musicSource && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    item.musicSource === "uploaded" ? "bg-yellow-950/60 text-yellow-400 border border-yellow-900/50" :
                    item.musicSource === "stock" || item.musicSource === "pixabay" ? "bg-blue-950/60 text-blue-400 border border-blue-900/50" :
                    "bg-gray-800 text-gray-500 border border-gray-700"
                  }`}>{item.musicSource}</span>
                )}
              </div>
              <div className="flex gap-1.5 items-center flex-wrap">
                <select
                  value={musicMoodEdit}
                  onChange={e => setMusicMoodEdit(e.target.value)}
                  className="text-xs bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:border-indigo-600"
                >
                  <option value="">Keep current mood</option>
                  {["epic","war","calm","emotional","upbeat","dramatic","action","suspense","dance","rain","heavy_rain","nature"].map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                <button
                  onClick={handleRegenMusic}
                  disabled={regenMusicLoading}
                  className="text-xs bg-indigo-900/60 hover:bg-indigo-800/60 text-indigo-300 border border-indigo-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {regenMusicLoading ? "Replacing…" : "↻ Replace music"}
                </button>
                <button
                  onClick={() => musicFileRef.current?.click()}
                  disabled={uploadMusicLoading}
                  className="text-xs bg-gray-800 hover:bg-gray-700 text-gray-400 border border-gray-700 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                >
                  {uploadMusicLoading ? "Uploading…" : "↑ Upload music"}
                </button>
                <input
                  ref={musicFileRef}
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadMusic(f); }}
                />
              </div>
            </div>

            {/* Re-merge */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400 font-medium">Rebuild final video</p>
                  <p className="text-xs text-gray-600 mt-0.5">Re-merge current video + voice + music into new output.</p>
                </div>
                <button
                  onClick={handleRemerge}
                  disabled={remergeLoading}
                  className="text-xs bg-purple-900/60 hover:bg-purple-800/60 text-purple-300 border border-purple-800/60 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                  {remergeLoading ? "Merging…" : "⟳ Re-merge"}
                </button>
              </div>
            </div>
          </div>

          {/* Revise */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-300">Generate a revision</p>
              <p className="text-xs text-gray-600 mt-0.5">Re-open Studio with all settings pre-filled.</p>
            </div>
            <a
              href={`/dashboard?revise=${item.id}`}
              className="shrink-0 bg-indigo-700 hover:bg-indigo-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              Revise →
            </a>
          </div>

          {/* Details card */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Details</p>

            {item.narrationScript && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Narration script <span className="text-gray-700">(what the voice says)</span></p>
                <p className="text-gray-200 text-xs leading-relaxed italic">&ldquo;{item.narrationScript}&rdquo;</p>
              </div>
            )}

            {item.enhancedPrompt && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Video prompt <span className="text-gray-700">(cinematic description for AI)</span></p>
                <p className="text-gray-400 text-xs leading-relaxed">{item.enhancedPrompt}</p>
              </div>
            )}

            {item.destinationPage && (
              <div>
                <p className="text-xs text-gray-500 mb-0.5">Destination</p>
                <p className="text-gray-300 text-xs">
                  {item.destinationPage.name}
                  <span className="text-gray-600 ml-1">
                    ({item.destinationPage.platform}{item.destinationPage.handle ? ` · ${item.destinationPage.handle}` : ""})
                  </span>
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-800">
              <div>
                <p className="text-gray-600 mb-0.5">Video</p>
                {item.requestedVideoProvider && item.requestedVideoProvider !== item.videoProvider ? (
                  <span className="flex items-center gap-1 flex-wrap">
                    <ProviderBadge name={item.requestedVideoProvider} />
                    <span className="text-gray-600">→</span>
                    <ProviderBadge name={item.videoProvider} />
                  </span>
                ) : (
                  <ProviderBadge name={item.videoProvider} />
                )}
              </div>
              <div>
                <p className="text-gray-600 mb-0.5">Voice</p>
                <ProviderBadge name={item.voiceProvider} />
              </div>
              <div>
                <p className="text-gray-600 mb-0.5">Music</p>
                <ProviderBadge name={item.musicProvider} />
              </div>
              <div>
                <p className="text-gray-600 mb-0.5">Format</p>
                <span className="font-mono text-gray-300">{aspectRatio}</span>
                {item.durationSeconds && <span className="text-gray-600 ml-2">{item.durationSeconds}s</span>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-800">
              <div>
                <p className="text-gray-600 mb-0.5">Created</p>
                <p className="text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
              </div>
              {item.approvedAt && (
                <div>
                  <p className="text-gray-600 mb-0.5">Approved</p>
                  <p className="text-green-400">{new Date(item.approvedAt).toLocaleString()}</p>
                </div>
              )}
              {item.rejectedAt && (
                <div>
                  <p className="text-gray-600 mb-0.5">Rejected</p>
                  <p className="text-red-400">{new Date(item.rejectedAt).toLocaleString()}</p>
                </div>
              )}
            </div>

            {item.notes && (
              <div className="pt-2 border-t border-gray-800">
                <p className="text-xs text-gray-500 mb-1">Notes / error</p>
                <p className="text-red-300 text-xs font-mono whitespace-pre-wrap break-all">{item.notes}</p>
              </div>
            )}
          </div>

          {/* Supervisor Plan */}
          {item.supervisorPlan && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowSupervisorPlan(v => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">AI Supervisor Plan</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${
                    (item.supervisorPlan as Record<string,unknown>).supervisedBy === "ollama"
                      ? "bg-green-950/60 text-green-400 border border-green-900/50"
                      : "bg-yellow-950/60 text-yellow-400 border border-yellow-900/50"
                  }`}>
                    {String((item.supervisorPlan as Record<string,unknown>).supervisedBy ?? "rule_based")}
                  </span>
                </div>
                <span className="text-gray-600 text-xs">{showSupervisorPlan ? "▲" : "▼"}</span>
              </button>
              {showSupervisorPlan && (
                <div className="px-4 pb-4 space-y-1.5 text-xs border-t border-gray-800">
                  {(() => {
                    const p = item.supervisorPlan as Record<string,unknown>;
                    const rows: Array<[string, string]> = [
                      ["Intent",        String(p.contentIntent ?? "—")],
                      ["Subject",       String(p.inferredSubjectType ?? "—")],
                      ["Video type",    String(p.inferredVideoType ?? "—")],
                      ["Visual style",  String(p.inferredVisualStyle ?? "—")],
                      ["Aspect ratio",  String(p.inferredAspectRatio ?? "—")],
                      ["Music mood",    String(p.inferredMusicMood ?? "—")],
                      ["Music genre",   String(p.inferredMusicGenre ?? "—")],
                      ["Confidence",    typeof p.confidence === "number" ? `${Math.round((p.confidence as number) * 100)}%` : "—"],
                    ];
                    return rows.map(([label, value]) => (
                      <div key={label} className="flex gap-2 pt-1.5">
                        <span className="text-gray-600 w-24 shrink-0">{label}</span>
                        <span className="text-gray-300">{value}</span>
                      </div>
                    ));
                  })()}

                  {/* Pass B — Scene Audio Director fields + notes (share single p cast) */}
                  {(() => {
                    const p = item.supervisorPlan as Record<string,unknown>;
                    const sceneFields: Array<[string, string | null]> = [
                      ["Scene type",   p.sceneType ? String(p.sceneType) : null],
                      ["Emotion",      p.emotionalTone ? String(p.emotionalTone) : null],
                      ["Speech style", p.speechStyle ? String(p.speechStyle) : null],
                      ["Environment",  p.environmentType ? String(p.environmentType) : null],
                      ["Audio mode",   p.recommendedAudioMode ? String(p.recommendedAudioMode) : null],
                      ["Ducking",      p.duckingPlan ? String(p.duckingPlan) : null],
                      ["Pause",        p.pauseStrategy ? String(p.pauseStrategy) : null],
                    ];
                    const active = sceneFields.filter(([, v]) => v !== null);
                    const hasNotes = Array.isArray(p.notes) && (p.notes as string[]).length > 0;
                    const hasScene = active.length > 0 || p.tensionLevel != null || p.ambienceNeed;
                    return (
                      <>
                        {hasScene && (
                          <div className="pt-2 border-t border-gray-800/60">
                            <p className="text-[10px] uppercase tracking-widest text-gray-700 mb-1.5">Scene Audio Director</p>
                            {active.map(([label, value]) => (
                              <div key={label} className="flex gap-2 pt-1">
                                <span className="text-gray-600 w-24 shrink-0">{label}</span>
                                <span className="text-blue-300/80">{value}</span>
                              </div>
                            ))}
                            {p.tensionLevel != null && (
                              <div className="flex gap-2 pt-1">
                                <span className="text-gray-600 w-24 shrink-0">Tension</span>
                                <span className="text-blue-300/80">
                                  {"▮".repeat(Number(p.tensionLevel))}{"▯".repeat(3 - Number(p.tensionLevel))} {String(p.tensionLevel)}/3
                                </span>
                              </div>
                            )}
                            {!!p.ambienceNeed && (
                              <div className="flex gap-2 pt-1">
                                <span className="text-gray-600 w-24 shrink-0">Ambience</span>
                                <span className="text-green-400/80">recommended</span>
                              </div>
                            )}
                            {Array.isArray(p.inferredSoundEvents) && (p.inferredSoundEvents as string[]).length > 0 && (
                              <div className="pt-1.5 flex flex-wrap gap-1">
                                <span className="text-gray-600 w-24 shrink-0">SFX events</span>
                                <div className="flex flex-wrap gap-1">
                                  {(p.inferredSoundEvents as string[]).map((e) => (
                                    <span key={e} className="px-1.5 py-0.5 rounded font-mono text-[10px] bg-green-950/40 text-green-400 border border-green-900/50">
                                      {e}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        {hasNotes && (
                          <div className="pt-2 border-t border-gray-800/60">
                            <p className="text-gray-600 mb-1">Notes</p>
                            {(p.notes as string[]).map((n, i) => (
                              <p key={i} className="text-gray-500 italic">{n}</p>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {/* Scene Audio Director card — shown when Pass B analysis fields are present */}
          {item.supervisorPlan && (() => {
            const p = item.supervisorPlan as Record<string,unknown>;
            if (!p.sceneType && !p.emotionalTone && !p.speechStyle && !p.recommendedAudioMode) return null;

            const SCENE_COLOR: Record<string, string> = {
              horror: "text-red-400",   action: "text-orange-400", romance: "text-pink-400",
              suspense: "text-yellow-400", climax: "text-purple-400", dialogue: "text-blue-300",
              narration: "text-gray-300", flashback: "text-indigo-400",
            };
            const TONE_EMOJI: Record<string, string> = {
              tense: "😬", sorrowful: "😢", triumphant: "🏆", fearful: "😨",
              joyful: "😊", angry: "😡", neutral: "😐",
            };
            const STYLE_DESCRIPTION: Record<string, string> = {
              whisper: "Soft, intimate — close-mic feel",
              emotional: "Expressive, heartfelt delivery",
              commanding: "Authoritative, bold tone",
              trembling: "Fearful, shaky voice",
              normal: "Balanced, natural delivery",
            };

            const sceneColor = SCENE_COLOR[String(p.sceneType)] ?? "text-gray-300";
            const toneEmoji = TONE_EMOJI[String(p.emotionalTone)] ?? "";

            return (
              <div style={{ background: "#0e0e1a", border: "1px solid #1e1e35", borderRadius: 12, overflow: "hidden" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid #1e1e35" }}>
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#5a5a7a" }}>Scene Audio Director</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#1a2a3a", color: "#60a0d0", border: "1px solid #2a3a4a" }}>
                    Pass B
                  </span>
                </div>
                <div className="px-4 py-3 space-y-3 text-xs">
                  {/* Scene type + tone row */}
                  <div className="flex items-center gap-4">
                    {!!p.sceneType && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Scene type</p>
                        <span className={`font-semibold text-sm ${sceneColor}`}>
                          {String(p.sceneType).charAt(0).toUpperCase() + String(p.sceneType).slice(1)}
                        </span>
                      </div>
                    )}
                    {!!p.emotionalTone && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Emotional tone</p>
                        <span className="text-gray-300">
                          {toneEmoji} {String(p.emotionalTone)}
                        </span>
                      </div>
                    )}
                    {p.tensionLevel != null && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Tension</p>
                        <span className="text-amber-400/80">
                          {"▮".repeat(Number(p.tensionLevel))}{"▯".repeat(3 - Number(p.tensionLevel))} {String(p.tensionLevel)}/3
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Speech style */}
                  {!!p.speechStyle && (
                    <div className="flex items-start gap-3 px-3 py-2 rounded-lg" style={{ background: "#131325", border: "1px solid #1e1e35" }}>
                      <div>
                        <p className="text-gray-600 mb-0.5">Voice direction</p>
                        <p className="font-medium" style={{ color: "#a0b8e0" }}>{String(p.speechStyle)}</p>
                        {STYLE_DESCRIPTION[String(p.speechStyle)] && (
                          <p className="text-gray-600 mt-0.5 italic">{STYLE_DESCRIPTION[String(p.speechStyle)]}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Environment + audio plan row */}
                  <div className="grid grid-cols-2 gap-3">
                    {!!p.environmentType && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Environment</p>
                        <span className="text-gray-400">{String(p.environmentType)}</span>
                      </div>
                    )}
                    {!!p.recommendedAudioMode && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Recommended audio</p>
                        <span className="font-mono text-blue-300/70 text-[11px]">{String(p.recommendedAudioMode).replace(/_/g, " ")}</span>
                      </div>
                    )}
                    {!!p.duckingPlan && p.duckingPlan !== "none" && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Music ducking</p>
                        <span className="text-gray-400">{String(p.duckingPlan)}</span>
                      </div>
                    )}
                    {!!p.pauseStrategy && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Pacing</p>
                        <span className="text-gray-400">{String(p.pauseStrategy).replace(/_/g, " ")}</span>
                      </div>
                    )}
                    {!!p.ambienceNeed && (
                      <div>
                        <p className="text-gray-700 mb-0.5">Ambience</p>
                        <span className="text-green-400/70">recommended</span>
                      </div>
                    )}
                  </div>

                  {/* SFX events */}
                  {Array.isArray(p.inferredSoundEvents) && (p.inferredSoundEvents as string[]).length > 0 && (
                    <div>
                      <p className="text-gray-700 mb-1.5">SFX events detected</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(p.inferredSoundEvents as string[]).map((e) => (
                          <span key={e} className="px-2 py-0.5 rounded font-mono text-[10px]" style={{ background: "#0d1f0d", color: "#4ade80", border: "1px solid #1a3a1a" }}>
                            {e}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Beat Timeline card — shown when beatTimeline is stored in supervisorPlan */}
          {item.supervisorPlan && (() => {
            const p = item.supervisorPlan as Record<string, unknown>;
            const tl = p.beatTimeline as { totalDurationMs?: number; beats?: { id: string; type: string; startMs: number; durationMs: number; text?: string; speakerName?: string; sfxEvent?: string }[] } | undefined;
            if (!tl?.beats?.length) return null;

            const TYPE_COLOR: Record<string, string> = {
              narration: "#60a5fa", dialogue: "#a78bfa", sfx: "#4ade80",
              ambience: "#34d399", music: "#fb923c", silence: "#4b5563",
              image: "#f59e0b", video: "#e879f9",
            };

            return (
              <div style={{ background: "#0e0e1a", border: "1px solid #1e1e35", borderRadius: 12, overflow: "hidden" }}>
                <div className="px-4 py-2.5 flex items-center gap-2" style={{ borderBottom: "1px solid #1e1e35" }}>
                  <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "#5a5a7a" }}>Beat Timeline</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-mono" style={{ background: "#0d1f1a", color: "#4ade80", border: "1px solid #1a3a2a" }}>
                    {tl.beats.length} beats · ~{Math.round((tl.totalDurationMs ?? 0) / 1000)}s
                  </span>
                </div>
                <div className="px-4 py-3">
                  {/* Beat strip */}
                  <div className="flex flex-wrap gap-1">
                    {tl.beats.map((beat) => (
                      <div
                        key={beat.id}
                        title={beat.text ?? beat.sfxEvent ?? beat.type}
                        style={{
                          fontSize: 9, borderRadius: 4, padding: "2px 6px",
                          background: `${TYPE_COLOR[beat.type] ?? "#4b5563"}18`,
                          color: TYPE_COLOR[beat.type] ?? "#9ca3af",
                          border: `1px solid ${TYPE_COLOR[beat.type] ?? "#4b5563"}33`,
                          fontFamily: "monospace",
                        }}
                      >
                        {beat.type === "sfx" ? `♪ ${beat.sfxEvent ?? "sfx"}` :
                         beat.type === "dialogue" ? `💬 ${beat.speakerName ?? "dialogue"}` :
                         beat.type === "silence" ? "…" :
                         `${beat.type} ${Math.round(beat.startMs / 1000)}s`}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Output mode + casting */}
          {(item.outputMode || (Array.isArray(item.castingCharacters) && item.castingCharacters.length > 0)) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Output</p>
              {item.outputMode && (
                <Row label="Mode">
                  <span className="font-mono text-indigo-300">{item.outputMode.replace(/_/g, " ")}</span>
                </Row>
              )}
              {Array.isArray(item.castingCharacters) && item.castingCharacters.length > 0 && (
                <Row label="Cast">
                  <div className="flex flex-wrap gap-1">
                    {item.castingCharacters?.map((c: string) => (
                      <span key={c} className="text-xs px-2 py-0.5 bg-indigo-950/60 border border-indigo-800/50 text-indigo-300 rounded font-mono">{c}</span>
                    ))}
                  </div>
                </Row>
              )}
            </div>
          )}

          {/* Audio settings */}
          {(item.audioMode != null || item.voiceId != null || item.voiceLanguage != null ||
            item.requestedVoiceProvider != null || item.narrationSpeed != null ||
            item.narrationVolume != null || item.musicVolume != null ||
            item.requestedMusicProvider != null || item.musicGenre != null || item.musicRegion != null) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Audio settings</p>
              <Row label="Audio mode">
                <span className="font-mono text-gray-300">{item.audioMode ?? "voice_music"}</span>
                <span className="text-gray-600 ml-2">
                  {item.audioMode === "voice_only" && "→ no music"}
                  {item.audioMode === "music_only" && "→ no voice"}
                  {item.audioMode === "audio_only" && "→ no video, MP3 output"}
                  {(!item.audioMode || item.audioMode === "voice_music") && "→ voice + music"}
                </span>
              </Row>
              <Row label="Voice provider">
                <div className="flex items-center gap-1 flex-wrap">
                  {item.requestedVoiceProvider && (
                    <><span className="font-mono text-gray-400">{item.requestedVoiceProvider}</span><span className="text-gray-600">→</span></>
                  )}
                  <ProviderBadge name={item.voiceProvider} />
                </div>
              </Row>
              <Row label="Voice">
                {item.voiceId
                  ? <span className="font-mono text-gray-300">{item.voiceId}</span>
                  : <span className="text-gray-500">default (Sarah)</span>
                }
              </Row>
              <Row label="Language">
                {item.voiceLanguage
                  ? <span className="font-mono text-gray-300">{item.voiceLanguage}</span>
                  : <span className="text-gray-500">auto-detect</span>
                }
              </Row>
              <Row label="Speed">
                <span className="font-mono text-gray-300">
                  {item.narrationSpeed != null ? `${item.narrationSpeed.toFixed(2)}×` : "1.0×"}
                </span>
              </Row>
              <Row label="Narr. vol.">
                <span className="font-mono text-gray-300">
                  {item.narrationVolume != null ? `${Math.round(item.narrationVolume * 100)}%` : "100%"}
                </span>
              </Row>
              <div className="pt-2 border-t border-gray-800/60 space-y-2">
                <Row label="Music provider">
                  <div className="flex items-center gap-1 flex-wrap">
                    {item.requestedMusicProvider ? (
                      <>
                        <span className="font-mono text-gray-400">{item.requestedMusicProvider}</span>
                        {item.requestedMusicProvider !== item.musicProvider && (
                          <><span className="text-gray-600">→</span><span className="font-mono text-orange-400">{item.musicProvider}</span></>
                        )}
                      </>
                    ) : (
                      <span className="text-gray-500">auto ({item.musicProvider ?? "—"})</span>
                    )}
                  </div>
                </Row>
                <Row label="Genre">
                  {item.musicGenre
                    ? <span className="font-mono text-gray-300">{item.musicGenre.replace("_", "-")}</span>
                    : <span className="text-gray-600">not set</span>
                  }
                </Row>
                <Row label="Region">
                  {item.musicRegion
                    ? <span className="font-mono text-gray-300">{item.musicRegion.replace("_", " ")}</span>
                    : <span className="text-gray-600">global</span>
                  }
                </Row>
                <Row label="Music vol.">
                  <span className="font-mono text-gray-300">
                    {item.musicVolume != null ? `${Math.round(item.musicVolume * 100)}%` : "85%"}
                  </span>
                </Row>
              </div>
            </div>
          )}

          {/* Generation settings */}
          {item.videoQuality != null && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Generation settings</p>
              <Row label="Provider">
                <div className="flex items-center gap-1 flex-wrap">
                  {item.requestedVideoProvider ? (
                    <>
                      <span className="font-mono text-gray-300">{item.requestedVideoProvider}</span>
                      {item.requestedVideoProvider !== item.videoProvider && (
                        <><span className="text-gray-600">→</span><span className="font-mono text-orange-400">{item.videoProvider}</span></>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-500">auto ({item.videoProvider ?? "—"})</span>
                  )}
                </div>
              </Row>
              <Row label="Quality">
                <span className="font-mono text-gray-300">{item.videoQuality ?? "standard"}</span>
                <span className="text-gray-600 ml-2">
                  {item.videoQuality === "draft" && "→ mock used"}
                  {item.videoQuality === "high" && "→ 10s requested"}
                </span>
              </Row>
              <Row label="Type">{item.videoType ? <span className="font-mono text-gray-300">{item.videoType.replace("_", " ")}</span> : <span className="text-gray-600">default</span>}</Row>
              <Row label="Style">{item.visualStyle ? <span className="font-mono text-gray-300">{item.visualStyle.replace("_", " ")}</span> : <span className="text-gray-600">default</span>}</Row>
              <Row label="Subject">
                {item.subjectType ? (
                  <>
                    <span className="font-mono text-gray-300">{item.subjectType.replace("_", " ")}</span>
                    {item.subjectType === "custom_character" && item.customSubjectDescription && (
                      <span className="text-gray-400 ml-2 italic">"{item.customSubjectDescription}"</span>
                    )}
                  </>
                ) : <span className="text-gray-600">not set</span>}
              </Row>
              <Row label="AI auto">
                <span className={`font-mono ${item.aiAutoMode === false ? "text-yellow-400" : "text-green-400"}`}>
                  {item.aiAutoMode === false ? "off" : "on"}
                </span>
              </Row>
            </div>
          )}

          {/* Casting & Identity */}
          {(item.castingEthnicity || item.castingGender || item.castingAge || item.castingCount ||
            item.cultureContext || item.referenceImageUrl) && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Casting & Identity</p>
              {item.castingEthnicity && <Row label="Ethnicity"><span className="font-mono text-indigo-300">{item.castingEthnicity}</span></Row>}
              {item.castingGender && <Row label="Gender"><span className="font-mono text-indigo-300">{item.castingGender}</span></Row>}
              {item.castingAge && <Row label="Age group"><span className="font-mono text-indigo-300">{item.castingAge.replace("_", " ")}</span></Row>}
              {item.castingCount && <Row label="Cast size"><span className="font-mono text-indigo-300">{item.castingCount}</span></Row>}
              {item.cultureContext && <Row label="Culture"><span className="font-mono text-indigo-300">{item.cultureContext}</span></Row>}
              {item.referenceImageUrl && (
                <Row label="Ref image">
                  <a href={item.referenceImageUrl} target="_blank" rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 truncate max-w-[220px] block">
                    {item.referenceImageUrl}
                  </a>
                </Row>
              )}
            </div>
          )}

          {/* ── Text & Image Overlays ───────────────────────── */}
          <OverlayPanel
            videoPath={item.mergedOutputPath ?? item.videoPath ?? null}
            contentItemId={item.id}
            layers={overlayLayers}
            onChange={setOverlayLayers}
            onApplied={() => fetchItem()}
          />

          {/* ── Continue This Story ─────────────────────────── */}
          <ContinueStoryPanel item={item} router={router} />

          {/* Version history */}
          {versions.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Version history</p>
              <div className="space-y-2">
                {versions.map((v) => (
                  <div key={v.id} className="flex items-center gap-3 text-xs text-gray-400">
                    <span className="text-gray-600 font-mono w-6">v{v.versionNumber}</span>
                    <span className={`px-2 py-0.5 rounded ${STATUS_COLORS[v.status]}`}>{v.status}</span>
                    {v.reason && <span className="text-gray-600">{v.reason}</span>}
                    <span className="text-gray-700 ml-auto shrink-0">{new Date(v.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>{/* end RIGHT panel */}
      </div>{/* end two-column grid */}
    </div>
  );
}
