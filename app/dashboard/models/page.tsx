"use client";

import { useEffect, useState } from "react";
import { ds } from "../../../lib/designSystem";
import ButtonPrimary from "../../components/ui/ButtonPrimary";
import Card from "../../components/ui/Card";

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

const TIER_BADGE: Record<string, { label: string; color: string; bg: string }> = {
  budget:              { label: "Budget",         color: ds.color.mint,    bg: `${ds.color.mint}18`    },
  budget_fast:         { label: "Budget Fast",    color: ds.color.mint,    bg: `${ds.color.mint}18`    },
  moderate:            { label: "Balanced",       color: ds.color.sky,     bg: `${ds.color.sky}18`     },
  moderate_premium:    { label: "Balanced+",      color: ds.color.sky,     bg: `${ds.color.sky}18`     },
  premium:             { label: "Premium",        color: ds.color.lilac,   bg: `${ds.color.lilac}18`   },
  premium_plus:        { label: "Premium+",       color: ds.color.lilac,   bg: `${ds.color.lilac}18`   },
  budget_video:        { label: "Budget Video",   color: ds.color.mint,    bg: `${ds.color.mint}18`    },
  moderate_video:      { label: "Balanced Video", color: ds.color.sky,     bg: `${ds.color.sky}18`     },
  premium_video:       { label: "Premium Video",  color: ds.color.lilac,   bg: `${ds.color.lilac}18`   },
  premium_video_plus:  { label: "Premium+ Video", color: ds.color.lilac,   bg: `${ds.color.lilac}18`   },
  ultra_premium_video: { label: "Ultra Premium",  color: ds.color.gold,    bg: `${ds.color.gold}18`    },
};

const SORT_OPTIONS = [
  { id: "price",    label: "Price (low first)",    key: "sort_price_rank",    dir: "asc"  as const },
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

  if (loading) return <p style={{ color: ds.color.mute, textAlign: "center", padding: "48px 0", fontFamily: ds.font.sans }}>Loading models...</p>;

  // Tab pill style
  function tabStyle(active: boolean): React.CSSProperties {
    return {
      padding: "8px 16px", borderRadius: ds.radius.sm, fontSize: 13, fontWeight: 600,
      fontFamily: ds.font.sans, cursor: "pointer", border: "none",
      background: active ? ds.color.lilac : ds.color.card,
      color: active ? "#fff" : ds.color.mute,
      transition: "all .15s",
    };
  }

  // Sort/filter chip style
  function chipStyle(active: boolean): React.CSSProperties {
    return {
      padding: "4px 10px", borderRadius: ds.radius.xs, fontSize: 10, fontWeight: 600,
      fontFamily: ds.font.mono, cursor: "pointer", border: `1px solid ${active ? ds.color.lilac + "60" : ds.color.line2}`,
      background: active ? `${ds.color.lilac}18` : ds.color.card,
      color: active ? ds.color.lilac : ds.color.mute,
      transition: "all .15s",
    };
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 11, fontWeight: 700, color: ds.color.lilac, letterSpacing: "0.18em", textTransform: "uppercase", fontFamily: ds.font.mono, marginBottom: 4 }}>
          AI Studio
        </p>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: ds.color.ink, letterSpacing: "-0.03em", margin: "0 0 4px" }}>
          AI Models
        </h1>
        <p style={{ fontSize: 13, color: ds.color.ink2 }}>Select a model, see trending options, and generate directly</p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={() => setTab("image")} style={tabStyle(tab === "image")}>
          Image Models ({models.filter(m => m.type === "image" || m.type === "image_edit").length})
        </button>
        <button onClick={() => setTab("video")} style={tabStyle(tab === "video")}>
          Video Models ({models.filter(m => m.type === "video").length})
        </button>
      </div>

      {/* Sort + Filter */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Sort:</span>
        {SORT_OPTIONS.map(s => (
          <button key={s.id} onClick={() => setSort(s.id)} style={chipStyle(sort === s.id)}>
            {s.label}
          </button>
        ))}
        <span style={{ width: 1, height: 16, background: ds.color.line2, margin: "0 4px" }} />
        <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>Tier:</span>
        <button onClick={() => setTierFilter("")} style={chipStyle(!tierFilter)}>All</button>
        {tiers.map(t => (
          <button key={t} onClick={() => setTierFilter(t === tierFilter ? "" : t)} style={chipStyle(t === tierFilter)}>
            {TIER_BADGE[t]?.label ?? t}
          </button>
        ))}
      </div>

      {/* Model cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
        {filtered.map(m => {
          const tier = TIER_BADGE[m.quality_tier] ?? { label: m.quality_tier, color: ds.color.mute, bg: ds.color.alert };
          const isDefault = (tab === "image" && defaults.image === m.id) || (tab === "video" && defaults.video === m.id);
          return (
            <Card
              key={m.id}
              padding="14px 16px"
              radius={ds.radius.md}
              style={{
                opacity: m.is_active ? 1 : 0.5,
                border: `1px solid ${m.is_active ? ds.color.line2 : ds.color.line}`,
                transition: "border-color .15s",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                <div>
                  <h3 style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink, margin: 0 }}>{m.display_name}</h3>
                  <p style={{ fontSize: 10, color: ds.color.mute, margin: "2px 0 0" }}>{m.model_manufacturer} via {m.provider_name}</p>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: ds.radius.xs, background: tier.bg, color: tier.color, fontFamily: ds.font.mono }}>{tier.label}</span>
                  {isDefault && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: ds.radius.xs, background: `${ds.color.lilac}18`, color: ds.color.lilac, fontFamily: ds.font.mono }}>Default</span>}
                  {m.is_recommended_default && <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: ds.radius.xs, background: `${ds.color.gold}18`, color: ds.color.gold, fontFamily: ds.font.mono }}>Recommended</span>}
                </div>
              </div>

              <p style={{ fontSize: 10, color: ds.color.ink2, marginBottom: 8, lineHeight: 1.5 }}>{m.best_for}</p>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {m.tags.slice(0, 4).map(t => (
                  <span key={t} style={{ fontSize: 8, background: ds.color.alert, color: ds.color.mute, padding: "2px 6px", borderRadius: ds.radius.xs }}>{t}</span>
                ))}
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4, fontSize: 10, color: ds.color.mute, marginBottom: 12 }}>
                <div><span style={{ color: ds.color.mute2 }}>Cost:</span> <span style={{ color: ds.color.ink, fontFamily: ds.font.mono }}>${m.cost_to_henry}</span></div>
                <div><span style={{ color: ds.color.mute2 }}>Res:</span> <span style={{ color: ds.color.ink }}>{m.resolution}</span></div>
                <div><span style={{ color: ds.color.mute2 }}>Speed:</span> <span style={{ color: ds.color.ink }}>~{m.avg_generation_seconds}s</span></div>
              </div>

              {!m.is_active && m.notes && (
                <p style={{ fontSize: 9, color: ds.color.coral, marginBottom: 8 }}>{m.notes}</p>
              )}

              {m.is_active && (
                <div style={{ display: "flex", gap: 6 }}>
                  <a
                    href={`/dashboard/collaborative-editor?mode=${m.type === "video" ? "text_to_video" : "text_to_video"}&provider=${m.provider_name}`}
                    style={{
                      flex: 1, padding: "6px 10px", borderRadius: ds.radius.xs, fontSize: 10,
                      fontWeight: 700, textAlign: "center", textDecoration: "none",
                      background: ds.grad.hero, backgroundSize: ds.grad.heroSize,
                      animation: "btnSweep 6s linear infinite", color: "#fff",
                    }}
                  >
                    Use in Studio
                  </a>
                  <button
                    disabled={generating === m.id}
                    onClick={() => testGenerate(m.id, m.type)}
                    style={{
                      padding: "6px 12px", borderRadius: ds.radius.xs, fontSize: 10, fontWeight: 600,
                      background: `${ds.color.lilac}18`, color: ds.color.lilac, border: "none", cursor: "pointer",
                      opacity: generating === m.id ? 0.4 : 1, fontFamily: ds.font.sans,
                    }}
                  >
                    {generating === m.id ? "..." : "Test"}
                  </button>
                </div>
              )}

              {genResult?.model === m.id && (
                <div style={{
                  marginTop: 8, padding: 8, borderRadius: ds.radius.xs, fontSize: 10,
                  background: genResult.status === "success" ? `${ds.color.mint}18` : `${ds.color.coral}18`,
                  color: genResult.status === "success" ? ds.color.mint : ds.color.coral,
                }}>
                  {genResult.status === "success" ? `Generated! ${genResult.url ? "Saved to storage" : ""}` : `Failed: ${genResult.error}`}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p style={{ textAlign: "center", color: ds.color.mute2, padding: "48px 0", fontFamily: ds.font.sans }}>No models match current filters</p>
      )}
    </div>
  );
}
