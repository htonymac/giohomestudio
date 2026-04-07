"use client";

import { useEffect, useState } from "react";

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
}

const TYPE_ICONS: Record<string, string> = {
  image: "🖼", video: "🎬", music: "🎵", sfx: "💥", actor: "🎭",
};

const TYPE_COLORS: Record<string, string> = {
  image: "bg-purple-900/40 text-purple-400",
  video: "bg-blue-900/40 text-blue-400",
  music: "bg-pink-900/40 text-pink-400",
  sfx:   "bg-orange-900/40 text-orange-400",
  actor: "bg-green-900/40 text-green-400",
};

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [preview, setPreview] = useState<Asset | null>(null);

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
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">📦 Asset Library</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Reuse generated images, actors, music, and video clips across all modes</p>
        </div>
        <span className="text-xs text-[#6060a0]">{assets.length} assets</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search assets..."
          className="flex-1 min-w-[200px] bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-600"
        />
        {["", "image", "video", "music", "sfx", "actor"].map(t => (
          <button key={t || "all"} onClick={() => setTypeFilter(t)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            typeFilter === t ? "bg-[#7c5cfc]/20 text-[#b090ff] border border-[#7c5cfc]/40" : "bg-[#1a1a2e] text-[#6060a0] border border-[#2a2a40]"
          }`}>
            {t ? `${TYPE_ICONS[t]} ${t.charAt(0).toUpperCase() + t.slice(1)}` : "All"}
          </button>
        ))}
      </div>

      {loading && <p className="text-[#6060a0] text-center py-8">Loading...</p>}

      {!loading && assets.length === 0 && (
        <div className="text-center py-16 border border-dashed border-[#2a2a40] rounded-xl">
          <p className="text-[#6060a0] text-lg mb-2">No assets saved yet</p>
          <p className="text-[#404060] text-xs">Generated images, actors, and trimmed music will appear here for reuse across all modes.</p>
          <p className="text-[#404060] text-xs mt-1">Generate content from Studio, Commercial Maker, or AI Models → it saves automatically.</p>
        </div>
      )}

      {/* Asset grid */}
      {!loading && assets.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {assets.map(a => (
            <div key={a.id} className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Thumbnail — click to preview popup */}
              <div className="h-32 flex items-center justify-center text-3xl cursor-pointer" style={{ background: "var(--surface3)" }} onClick={() => setPreview(a)}>
                {(a.type === "image" || a.type === "actor") && a.filePath ? (
                  <img src={`/api/media/${a.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} alt={a.name} className="w-full h-full object-cover" />
                ) : a.type === "video" && a.filePath ? (
                  <img src={`/api/thumbnail?path=${encodeURIComponent(a.filePath)}`} alt={a.name} className="w-full h-full object-cover" />
                ) : (
                  TYPE_ICONS[a.type] ?? "📁"
                )}
              </div>
              <div className="p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={`text-[8px] px-1 py-0.5 rounded font-medium ${TYPE_COLORS[a.type] ?? "bg-gray-800 text-gray-400"}`}>
                    {a.type}
                  </span>
                  {a.source && (
                    <span className="text-[8px] text-[#404060]">{a.source}</span>
                  )}
                </div>
                <p className="text-xs text-white font-medium truncate">{a.name}</p>
                {a.description && <p className="text-[9px] text-[#6060a0] truncate mt-0.5">{a.description}</p>}
                {a.tags.length > 0 && (
                  <div className="flex flex-wrap gap-0.5 mt-1">
                    {a.tags.slice(0, 3).map(t => (
                      <span key={t} className="text-[7px] bg-[#1a1a2e] text-[#6060a0] px-1 py-0.5 rounded">{t}</span>
                    ))}
                  </div>
                )}
                <div className="flex gap-1 mt-2">
                  <a
                    href={`/dashboard?mode=image_to_video&ref=${encodeURIComponent(a.filePath)}`}
                    className="flex-1 text-center text-[8px] py-1 rounded"
                    style={{ background: "rgba(123,97,255,0.15)", color: "#a89bff", border: "1px solid rgba(123,97,255,0.25)", textDecoration: "none" }}
                  >
                    Use
                  </a>
                  <a
                    href={`/api/media/${a.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`}
                    download
                    className="text-[8px] py-1 px-2 rounded"
                    style={{ background: "rgba(0,221,181,0.1)", color: "var(--accent3)", border: "1px solid rgba(0,221,181,0.2)", textDecoration: "none" }}
                  >
                    ⬇
                  </a>
                  <a
                    href={`/api/media/${a.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`}
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
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setPreview(null)} />
          <div style={{ position: "relative", maxWidth: 700, width: "90%", background: "var(--surface)", border: "1px solid var(--border2)", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)", animation: "pageIn 0.2s ease-out" }}>
            {/* Media */}
            <div style={{ background: "black", maxHeight: 400, display: "flex", alignItems: "center", justifyContent: "center" }}>
              {(preview.type === "video") ? (
                <video src={`/api/media/${preview.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} controls autoPlay style={{ maxWidth: "100%", maxHeight: 400 }} />
              ) : (preview.type === "image" || preview.type === "actor") ? (
                <img src={`/api/media/${preview.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} alt={preview.name} style={{ maxWidth: "100%", maxHeight: 400, objectFit: "contain" }} />
              ) : preview.type === "music" || preview.type === "sfx" ? (
                <div style={{ padding: 40, textAlign: "center" }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>{preview.type === "music" ? "🎵" : "💥"}</div>
                  <audio src={`/api/media/${preview.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} controls autoPlay style={{ width: "100%" }} />
                </div>
              ) : null}
            </div>
            {/* Info */}
            <div style={{ padding: "16px 20px" }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{preview.name}</h3>
              {preview.description && <p style={{ fontSize: 11, color: "var(--text2)", marginBottom: 8 }}>{preview.description}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <a href={`/api/media/${preview.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} download className="btn btn-primary btn-sm" style={{ textDecoration: "none" }}>⬇️ Download</a>
                <a href={`/api/media/${preview.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>↗ Open in Tab</a>
                <a href={`/dashboard?mode=image_to_video&ref=${encodeURIComponent(preview.filePath)}`} className="btn btn-ghost btn-sm" style={{ textDecoration: "none" }}>🎬 Use in Studio</a>
                <button onClick={() => setPreview(null)} className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
