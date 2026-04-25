"use client";

import { useEffect, useState } from "react";
import LayerizePanel, { type LayerizeResult } from "../../components/LayerizePanel";
import ModelChip from "../../components/ModelChip";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";

interface Asset {
  id: string;
  type: "image" | "video" | "music" | "sfx" | "actor";
  name: string;
  description: string;
  filePath: string;
  tags: string[];
  source: string;
  provider?: string;
  createdAt: string;
  metadata?: { contentId?: string; mergedOutputPath?: string; videoPath?: string; [key: string]: unknown };
}

const TYPE_ICONS: Record<string, string> = {
  image: "[img]", video: "[vid]", music: "[mus]", sfx: "[sfx]", actor: "[act]",
};

const TYPE_COLORS: Record<string, string> = {
  image: "bg-purple-900/40 text-purple-400",
  video: "bg-blue-900/40 text-blue-400",
  music: "bg-pink-900/40 text-pink-400",
  sfx:   "bg-orange-900/40 text-orange-400",
  actor: "bg-green-900/40 text-green-400",
};

// Resolve asset file path to a usable URL
function assetUrl(filePath: string): string {
  if (!filePath) return "";
  // Already a URL/API path
  if (filePath.startsWith("/api/")) return filePath;
  // Filesystem path — convert to API URL
  const cleaned = filePath.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

// Build the "Use in Studio" href — uses filePath if available, falls back to metadata paths or contentId
function useInStudioHref(a: Asset): string {
  // Try filePath first, then metadata fallbacks (mergedOutputPath, videoPath)
  const effectivePath = a.filePath || a.metadata?.mergedOutputPath || a.metadata?.videoPath || "";
  if (effectivePath) {
    const ref = encodeURIComponent(effectivePath);
    return `/dashboard/collaborative-editor?mode=image_to_video&ref=${ref}`;
  }
  // Last resort: use contentId as a content reference
  const contentId = a.metadata?.contentId || "";
  if (contentId) {
    const ref = encodeURIComponent(`content:${contentId}`);
    return `/dashboard/collaborative-editor?mode=image_to_video&ref=${ref}`;
  }
  return `/dashboard/collaborative-editor`;
}

function sendToHybridPlanner(a: Asset) {
  try {
    const existing = JSON.parse(localStorage.getItem("ghs_hybrid_inbox") || "[]");
    const item = { id: a.id, name: a.name, filePath: a.filePath, description: a.description, tags: a.tags, source: a.source || "asset-library" };
    // Avoid duplicates
    if (!existing.some((x: { id: string }) => x.id === a.id)) existing.push(item);
    localStorage.setItem("ghs_hybrid_inbox", JSON.stringify(existing));
    alert(`"${a.name}" sent to Hybrid Planner inbox.\nOpen Assembly tab to import it.`);
  } catch { alert("Could not send to Hybrid Planner."); }
}

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [transparentOnly, setTransparentOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Asset | null>(null);
  const [layerizeResult, setLayerizeResult] = useState<LayerizeResult | null>(null);
  const [layerizing, setLayerizing] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (typeFilter) params.set("type", typeFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/assets?${params}`);
    const data = await res.json();
    setAssets(data.assets ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [typeFilter, search]);

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 8 }}>
        <HeroTitle kicker="Content Library" title="Asset" italic="Hub" />
        <span style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono, paddingBottom: 4 }}>{assets.length} assets</span>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search assets..."
          style={{ flex: 1, minWidth: 200, background: ds.color.alert, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, fontSize: 13, borderRadius: ds.radius.sm, padding: "8px 12px", outline: "none" }}
        />
        {["", "image", "video", "music", "sfx", "actor"].map(t => (
          <button key={t || "all"} onClick={() => { setTypeFilter(t); setTransparentOnly(false); }} style={{
            padding: "6px 12px", borderRadius: ds.radius.sm, fontSize: 11, fontWeight: 600, cursor: "pointer",
            background: typeFilter === t && !transparentOnly ? `${ds.color.lilac}20` : ds.color.alert,
            color: typeFilter === t && !transparentOnly ? ds.color.lilac : ds.color.mute,
            border: `1px solid ${typeFilter === t && !transparentOnly ? `${ds.color.lilac}50` : ds.color.line2}`,
          }}>
            {t ? `${t.charAt(0).toUpperCase() + t.slice(1)}` : "All"}
          </button>
        ))}
        <button
          onClick={() => { setTransparentOnly(v => !v); setTypeFilter("image"); }}
          style={{
            padding: "6px 12px", borderRadius: ds.radius.sm, fontSize: 11, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
            background: transparentOnly ? `${ds.color.magenta}15` : ds.color.alert,
            color: transparentOnly ? ds.color.magenta : ds.color.mute,
            border: `1px solid ${transparentOnly ? `${ds.color.magenta}40` : ds.color.line2}`,
          }}
          title="Show only transparent PNG assets"
        >
          Transparent PNGs
        </button>
      </div>

      {loading && <p style={{ color: ds.color.mute, textAlign: "center", padding: "32px 0" }}>Loading...</p>}

      {!loading && assets.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0", border: `1px dashed ${ds.color.line2}`, borderRadius: ds.radius.lg }}>
          <p style={{ color: ds.color.mute, fontSize: 16, marginBottom: 8 }}>No assets saved yet</p>
          <p style={{ color: ds.color.mute2, fontSize: 11 }}>Generated images, actors, and trimmed music will appear here for reuse across all modes.</p>
          <p style={{ color: ds.color.mute2, fontSize: 11, marginTop: 4 }}>Generate content from Studio, Commercial Maker, or AI Models — it saves automatically.</p>
        </div>
      )}

      {/* Asset grid */}
      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.filter(a => !transparentOnly || a.tags.includes("transparent-png") || a.tags.includes("transparent")).map(a => (
            <div key={a.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Thumbnail — click to preview popup */}
              <div className="h-32 flex items-center justify-center text-3xl cursor-pointer" style={{ background: "var(--surface3)", position: "relative" }} onClick={() => setPreview(a)}>
                {(a.type === "image" || a.type === "actor") && a.filePath ? (
                  <img src={assetUrl(a.filePath)} alt={a.name} className="w-full h-full object-cover" />
                ) : a.type === "video" && a.filePath ? (
                  <img src={`/api/thumbnail?path=${encodeURIComponent(a.filePath)}`} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  TYPE_ICONS[a.type] ?? "[?]"
                )}
                {a.provider && (a.type === "image" || a.type === "video" || a.type === "actor") && (
                  <ModelChip provider={a.provider} position="absolute" />
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${TYPE_COLORS[a.type] ?? "bg-gray-800 text-gray-400"}`}>
                    {a.type}
                  </span>
                  {(a.tags.includes("transparent-png") || a.tags.includes("transparent")) && (
                    <span className="text-[8px] px-1 py-0.5 rounded font-medium bg-purple-900/30 text-purple-400">Transparent</span>
                  )}
                  {a.source && (
                    <span className="text-[8px] text-[#404060]">{a.source}</span>
                  )}
                </div>
                <p className="text-xs text-white font-medium truncate">{a.name}</p>
                {a.description && <p className="text-[9px] text-[#6060a0] truncate mt-0.5">{a.description}</p>}
                {a.createdAt && (
                  <p className="text-[8px] text-[#404060] mt-0.5">{new Date(a.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</p>
                )}
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {a.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[7px] bg-[#1a1a2e] text-[#6060a0] px-1 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1 mt-2 flex-wrap">
                  {(a.type === "image" || a.type === "actor") && (
                    <button
                      onClick={e => { e.stopPropagation(); sendToHybridPlanner(a); }}
                      className="flex-1 text-center text-[8px] py-1 rounded font-semibold"
                      style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.25)", cursor: "pointer", minWidth: 0 }}
                    >
                      → Planner
                    </button>
                  )}
                  {a.type === "image" && a.filePath && (
                    <button
                      disabled={layerizing === a.id}
                      onClick={async (e) => {
                        e.stopPropagation();
                        setLayerizing(a.id);
                        try {
                          const imgUrl = assetUrl(a.filePath);
                          const res = await fetch("/api/layerize", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ imageUrl: imgUrl }),
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
                          } else {
                            alert(data.error ?? "Layerize failed");
                          }
                        } catch { alert("Failed to extract text layers"); }
                        setLayerizing(null);
                      }}
                      className="text-[8px] py-1 px-2 rounded"
                      style={{ background: "rgba(59,130,246,0.12)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.25)", cursor: "pointer" }}
                      title="Extract editable text layers from this image (free re-compositing)"
                    >
                      {layerizing === a.id ? "..." : "Layers"}
                    </button>
                  )}
                  <a
                    href={useInStudioHref(a)}
                    className="flex-1 text-center text-[8px] py-1 rounded"
                    style={{ background: "rgba(123,97,255,0.15)", color: "#a89bff", border: "1px solid rgba(123,97,255,0.25)", textDecoration: "none" }}
                  >
                    Studio
                  </a>
                  <a
                    href={assetUrl(a.filePath)}
                    download
                    className="text-[8px] py-1 px-2 rounded"
                    style={{ background: "rgba(0,221,181,0.1)", color: "var(--accent3)", border: "1px solid rgba(0,221,181,0.2)", textDecoration: "none" }}
                  >
                    ⬇
                  </a>
                  <a
                    href={assetUrl(a.filePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[8px] py-1 px-2 rounded"
                    style={{ background: "var(--surface3)", color: "var(--text2)", textDecoration: "none" }}
                  >
                    ↗
                  </a>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm("Delete this asset?")) return;
                      await fetch(`/api/assets?id=${a.id}`, { method: "DELETE" });
                      load();
                    }}
                    className="text-[8px] py-1 px-2 rounded"
                    style={{ color: "var(--danger)" }}
                  >
                    Del
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Preview popup modal */}
      {preview && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.82)" }} onClick={() => setPreview(null)} />
          <div style={{ position: "relative", maxWidth: 700, width: "90%", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "pageIn 0.2s ease-out" }}>
            {/* Media */}
            <div style={{ background: "black", maxHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(preview.type === "video") ? (
                <video src={assetUrl(preview.filePath)} controls autoPlay style={{ maxWidth: "100%", maxHeight: 400 }} />
              ) : (preview.type === "image" || preview.type === "actor") ? (
                <img src={assetUrl(preview.filePath)} alt={preview.name} style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }} />
              ) : preview.type === "music" || preview.type === "sfx" ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 13, fontFamily: "monospace", color: ds.color.mute, marginBottom: 12 }}>{preview.type.toUpperCase()}</div>
                  <audio src={assetUrl(preview.filePath)} controls autoPlay style={{ width: "100%" }} />
                </div>
              ) : null}
            </div>
            {/* Info */}
            <div style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{preview.name}</h3>
              {preview.description && <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8 }}>{preview.description}</p>}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href={assetUrl(preview.filePath)} download className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>Download</a>
                <a href={assetUrl(preview.filePath)} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>Open in Tab</a>
                <a href={useInStudioHref(preview)} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>Use in Studio</a>
                {(preview.type === "image" || preview.type === "actor") && (
                  <button onClick={() => { sendToHybridPlanner(preview); setPreview(null); }} className="btn btn-ghost btn-sm" style={{ color: "#00d4ff", borderColor: "rgba(0,212,255,0.3)" }}>→ Hybrid Planner</button>
                )}
                <button onClick={() => setPreview(null)} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Layerize Text Panel */}
      {layerizeResult && (
        <LayerizePanel
          result={layerizeResult}
          onClose={() => setLayerizeResult(null)}
          onSaved={() => setLayerizeResult(null)}
        />
      )}
    </div>
  );
}
