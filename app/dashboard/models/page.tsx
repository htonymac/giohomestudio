"use client";

import { useEffect, useState } from "react";

interface Model {
  id: string;
  display_name: string;
  provider_name: string;
  model_manufacturer: string;
  type: string;
  quality_tier: string;
  cost_to_henry: number;
  price_to_user: number;
  tags: string[];
  strengths: string;
  best_for: string;
  resolution: string;
  max_duration_seconds: number | null;
  avg_generation_seconds: number;
  is_recommended_default: boolean;
  is_active: boolean;
  notes: string;
  sort_price_rank: number;
  sort_quality_rank: number;
  sort_trending_score: number;
  sort_usage_count: number;
}

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  budget:              { label: "Budget",           color: "bg-green-900/40 text-green-400" },
  budget_fast:         { label: "Budget Fast",      color: "bg-green-900/40 text-green-400" },
  moderate:            { label: "Balanced",         color: "bg-blue-900/40 text-blue-400" },
  moderate_premium:    { label: "Balanced+",        color: "bg-blue-900/40 text-blue-400" },
  premium:             { label: "Premium",          color: "bg-purple-900/40 text-purple-400" },
  premium_plus:        { label: "Premium+",         color: "bg-purple-900/40 text-purple-400" },
  budget_video:        { label: "Budget Video",     color: "bg-green-900/40 text-green-400" },
  moderate_video:      { label: "Balanced Video",   color: "bg-blue-900/40 text-blue-400" },
  premium_video:       { label: "Premium Video",    color: "bg-purple-900/40 text-purple-400" },
  premium_video_plus:  { label: "Premium+ Video",   color: "bg-purple-900/40 text-purple-400" },
  ultra_premium_video: { label: "Ultra Premium",    color: "bg-amber-900/40 text-amber-400" },
};

const SORT_OPTIONS = [
  { id: "price",    label: "Price (low first)",    key: "sort_price_rank",    dir: "asc" as const },
  { id: "quality",  label: "Quality (best first)", key: "sort_quality_rank",  dir: "desc" as const },
  { id: "trending", label: "Trending",             key: "sort_trending_score", dir: "desc" as const },
  { id: "used",     label: "Most Used",            key: "sort_usage_count",   dir: "desc" as const },
];

export default function ModelsPage() {
  const [models, setModels] = useState<Model[]>([]);
  const [defaults, setDefaults] = useState<{ image: string; video: string }>({ image: "", video: "" });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"image" | "video">("image");
  const [sort, setSort] = useState("price");
  const [tierFilter, setTierFilter] = useState("");
  const [generating, setGenerating] = useState<string | null>(null);
  const [genResult, setGenResult] = useState<{ model: string; status: string; url?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch("/api/generation/models?active=false")
      .then(r => r.json())
      .then(d => { setModels(d.models ?? []); setDefaults(d.defaults ?? { image: "", video: "" }); })
      .finally(() => setLoading(false));
  }, []);

  const sortOpt = SORT_OPTIONS.find(s => s.id === sort) ?? SORT_OPTIONS[0];
  const filtered = models
    .filter(m => tab === "image" ? (m.type === "image" || m.type === "image_edit") : m.type === "video")
    .filter(m => !tierFilter || m.quality_tier.includes(tierFilter))
    .sort((a, b) => {
      const ak = a[sortOpt.key as keyof Model] as number;
      const bk = b[sortOpt.key as keyof Model] as number;
      return sortOpt.dir === "asc" ? ak - bk : bk - ak;
    });

  async function testGenerate(modelId: string, type: string) {
    setGenerating(modelId);
    setGenResult(null);
    try {
      const endpoint = type === "video" ? "/api/generation/video" : "/api/generation/image";
      const body = type === "video"
        ? { modelId, prompt: "A beautiful sunset over calm ocean waves, cinematic", duration: 3 }
        : { modelId, prompt: "A modern luxury apartment interior, photorealistic, 8k" };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      setGenResult({
        model: modelId,
        status: res.ok ? "success" : "failed",
        url: data.imagePath ?? data.videoPath ?? data.imageUrl ?? data.videoUrl,
        error: data.error,
      });
    } catch (err) {
      setGenResult({ model: modelId, status: "failed", error: err instanceof Error ? err.message : "Network error" });
    }
    setGenerating(null);
  }

  const tiers = [...new Set(filtered.map(m => m.quality_tier))];

  if (loading) return <p className="text-[#6060a0] text-center py-12">Loading models...</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">🤖 AI Models</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Select a model, see trending options, and generate directly</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab("image")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "image" ? "bg-[#7c5cfc] text-white" : "bg-[#1a1a2e] text-[#6060a0] hover:text-white"}`}>
          Image Models ({models.filter(m => m.type === "image" || m.type === "image_edit").length})
        </button>
        <button onClick={() => setTab("video")} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === "video" ? "bg-[#7c5cfc] text-white" : "bg-[#1a1a2e] text-[#6060a0] hover:text-white"}`}>
          Video Models ({models.filter(m => m.type === "video").length})
        </button>
      </div>

      {/* Sort + Filter */}
      <div className="flex gap-2 mb-4 items-center">
        <span className="text-[10px] text-[#6060a0]">Sort:</span>
        {SORT_OPTIONS.map(s => (
          <button key={s.id} onClick={() => setSort(s.id)} className={`px-2.5 py-1 rounded text-[10px] transition-colors ${sort === s.id ? "bg-[#7c5cfc]/20 text-[#b090ff] border border-[#7c5cfc]/40" : "bg-[#1a1a2e] text-[#6060a0] border border-[#2a2a40]"}`}>
            {s.label}
          </button>
        ))}
        <span className="text-[#2a2a40] mx-1">|</span>
        <span className="text-[10px] text-[#6060a0]">Tier:</span>
        <button onClick={() => setTierFilter("")} className={`px-2 py-1 rounded text-[10px] ${!tierFilter ? "bg-[#7c5cfc]/20 text-[#b090ff]" : "bg-[#1a1a2e] text-[#6060a0]"}`}>All</button>
        {tiers.map(t => (
          <button key={t} onClick={() => setTierFilter(t === tierFilter ? "" : t)} className={`px-2 py-1 rounded text-[10px] ${t === tierFilter ? "bg-[#7c5cfc]/20 text-[#b090ff]" : "bg-[#1a1a2e] text-[#6060a0]"}`}>
            {TIER_BADGE[t]?.label ?? t}
          </button>
        ))}
      </div>

      {/* Model cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.map(m => {
          const tier = TIER_BADGE[m.quality_tier] ?? { label: m.quality_tier, color: "bg-gray-800 text-gray-400" };
          const isDefault = (tab === "image" && defaults.image === m.id) || (tab === "video" && defaults.video === m.id);
          return (
            <div key={m.id} className={`bg-[#12121e] border rounded-xl p-4 transition-colors ${m.is_active ? "border-[#2a2a40] hover:border-[#7c5cfc]/40" : "border-[#1a1a2e] opacity-50"}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h3 className="text-sm font-semibold text-white">{m.display_name}</h3>
                  <p className="text-[10px] text-[#6060a0]">{m.model_manufacturer} via {m.provider_name}</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${tier.color}`}>{tier.label}</span>
                  {isDefault && <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#7c5cfc]/20 text-[#b090ff] font-medium">Default</span>}
                  {m.is_recommended_default && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-400 font-medium">Recommended</span>}
                </div>
              </div>

              <p className="text-[10px] text-[#8080b0] mb-2">{m.best_for}</p>

              <div className="flex flex-wrap gap-1 mb-2">
                {m.tags.slice(0, 4).map(t => (
                  <span key={t} className="text-[8px] bg-[#1a1a2e] text-[#6060a0] px-1.5 py-0.5 rounded">{t}</span>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-2 text-[10px] text-[#6060a0] mb-3">
                <div><span className="text-[#404060]">Cost:</span> <span className="text-white">${m.cost_to_henry}</span></div>
                <div><span className="text-[#404060]">Res:</span> <span className="text-white">{m.resolution}</span></div>
                <div><span className="text-[#404060]">Speed:</span> <span className="text-white">~{m.avg_generation_seconds}s</span></div>
              </div>

              {!m.is_active && m.notes && (
                <p className="text-[9px] text-orange-400/70 mb-2">{m.notes}</p>
              )}

              {m.is_active && (
                <div className="flex gap-1.5">
                  <a
                    href={`/dashboard?mode=${m.type === "video" ? "text_to_video" : "text_to_video"}&provider=${m.provider_name}`}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold text-center transition-colors"
                    style={{ background: "var(--accent, #6c63ff)", color: "white" }}
                  >
                    Use in Studio →
                  </a>
                  <button
                    disabled={generating === m.id}
                    onClick={() => testGenerate(m.id, m.type)}
                    className="py-1.5 px-3 rounded-lg text-[10px] font-medium bg-[#7c5cfc]/15 text-[#b090ff] hover:bg-[#7c5cfc]/25 disabled:opacity-40 transition-colors"
                  >
                    {generating === m.id ? "..." : "Test"}
                  </button>
                </div>
              )}

              {genResult?.model === m.id && (
                <div className={`mt-2 p-2 rounded text-[10px] ${genResult.status === "success" ? "bg-green-950/40 text-green-400" : "bg-red-950/40 text-red-400"}`}>
                  {genResult.status === "success" ? `Generated! ${genResult.url ? "Saved to storage" : ""}` : `Failed: ${genResult.error}`}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-[#404060] py-12">No models match current filters</p>
      )}
    </div>
  );
}
