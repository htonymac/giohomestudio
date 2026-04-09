"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Template {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  preview: string;
  prompt: string;
  settings: {
    mode: string;
    aspectRatio?: string;
    duration?: number;
    voiceEnabled?: boolean;
    musicGenre?: string;
  };
  tags: string[];
  popular?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  "Real Estate": "#f59e0b",
  "Product Ads": "#8b5cf6",
  "Social Media": "#3b82f6",
  "Food & Restaurant": "#ef4444",
  "Entertainment": "#ec4899",
  "Intro / Outro": "#10b981",
};

export default function TemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(d => { setTemplates(d.templates ?? []); setCategories(d.categories ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = templates.filter(t => {
    if (filter && t.category !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.tags.some(tag => tag.includes(search.toLowerCase()))) return false;
    return true;
  });

  const previewTemplate = templates.find(t => t.id === previewId);

  function useTemplate(t: Template) {
    const params = new URLSearchParams();
    params.set("template", t.id);
    params.set("prompt", t.prompt);

    // Route to the correct editor based on template type
    const isImageAd = t.category === "Product Ads" && t.settings.mode === "text_to_image";
    const isFlyer = t.tags.some(tag => ["banner", "flyer", "poster", "ad"].includes(tag)) && t.settings.mode === "text_to_image";

    if (isImageAd || isFlyer) {
      // Image/ad/flyer templates → Ad Image Editor
      if (t.settings.aspectRatio) params.set("ar", t.settings.aspectRatio);
      router.push(`/dashboard/ad-editor?${params}`);
    } else if (t.settings.mode === "text_to_video" || t.settings.mode === "image_to_video" || t.settings.mode === "hybrid") {
      // Video templates → Main Studio with mode pre-set
      params.set("mode", t.settings.mode);
      if (t.settings.aspectRatio) params.set("ar", t.settings.aspectRatio);
      if (t.settings.duration) params.set("dur", String(t.settings.duration));
      router.push(`/dashboard?${params}`);
    } else if (t.settings.mode === "text_to_image") {
      // Other image templates → Main Studio image mode
      params.set("mode", "text_to_image");
      router.push(`/dashboard?${params}`);
    } else {
      // Everything else → Main Studio
      params.set("mode", t.settings.mode);
      if (t.settings.aspectRatio) params.set("ar", t.settings.aspectRatio);
      if (t.settings.duration) params.set("dur", String(t.settings.duration));
      router.push(`/dashboard?${params}`);
    }
  }

  if (loading) return <p style={{ color: "var(--text2)", textAlign: "center", padding: "48px 0" }}>Loading templates...</p>;

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white">Templates</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>
          Ready-to-use templates — pick one, customize the text, and generate. Like CapCut but AI-powered.
        </p>
      </div>

      {/* Search + filters */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search templates..."
          className="flex-1 min-w-[200px] bg-[#1a1a2e] border border-[#2a2a40] text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-[#7c5cfc]"
        />
        <button onClick={() => setFilter("")}
          className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${!filter ? "bg-[#7c5cfc]/20 text-[#b090ff] border border-[#7c5cfc]/40" : "bg-[#1a1a2e] text-[#6060a0] border border-[#2a2a40]"}`}>
          All ({templates.length})
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(f => f === c ? "" : c)}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${filter === c ? "bg-[#7c5cfc]/20 text-[#b090ff] border border-[#7c5cfc]/40" : "bg-[#1a1a2e] text-[#6060a0] border border-[#2a2a40]"}`}>
            {c} ({templates.filter(t => t.category === c).length})
          </button>
        ))}
      </div>

      {/* Popular row */}
      {!filter && !search && (
        <div className="mb-8">
          <p className="text-[10px] font-bold text-[#6060a0] uppercase tracking-widest mb-3">Popular Templates</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {templates.filter(t => t.popular).map(t => (
              <TemplateCard key={t.id} template={t} onPreview={() => setPreviewId(t.id)} onUse={() => useTemplate(t)} featured />
            ))}
          </div>
        </div>
      )}

      {/* All by category */}
      {(filter ? [filter] : categories).map(cat => {
        const items = filtered.filter(t => t.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full" style={{ background: CATEGORY_COLORS[cat] ?? "#7c5cfc" }} />
              <p className="text-xs font-bold text-white">{cat}</p>
              <span className="text-[10px] text-[#404060]">{items.length} templates</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {items.map(t => (
                <TemplateCard key={t.id} template={t} onPreview={() => setPreviewId(t.id)} onUse={() => useTemplate(t)} />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div className="text-center py-16">
          <p className="text-[#6060a0]">No templates match your search</p>
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }} onClick={() => setPreviewId(null)} />
          <div style={{ position: "relative", maxWidth: 560, width: "90%", background: "#12121e", border: "1px solid #2a2a40", borderRadius: 16, overflow: "hidden", boxShadow: "0 32px 80px rgba(0,0,0,0.7)" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e1e30" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 36 }}>{previewTemplate.thumbnail}</span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: "#e0e0f0" }}>{previewTemplate.name}</h3>
                  <p style={{ fontSize: 11, color: "#6060a0" }}>{previewTemplate.category}</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 13, color: "#a0a0c0", lineHeight: 1.6, marginBottom: 16 }}>{previewTemplate.preview}</p>

              <div style={{ background: "#0a0a18", border: "1px solid #1a1a30", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                <p style={{ fontSize: 10, fontWeight: 600, color: "#6060a0", marginBottom: 4 }}>AI PROMPT (editable after you start)</p>
                <p style={{ fontSize: 12, color: "#c0c0e0", lineHeight: 1.5 }}>{previewTemplate.prompt}</p>
              </div>

              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
                {previewTemplate.settings.mode && (
                  <span style={{ fontSize: 10, background: "#1a1a2e", color: "#a080ff", border: "1px solid #2a2a40", borderRadius: 4, padding: "2px 8px" }}>
                    {previewTemplate.settings.mode.replace(/_/g, " ")}
                  </span>
                )}
                {previewTemplate.settings.aspectRatio && (
                  <span style={{ fontSize: 10, background: "#1a1a2e", color: "#6060a0", border: "1px solid #2a2a40", borderRadius: 4, padding: "2px 8px" }}>
                    {previewTemplate.settings.aspectRatio}
                  </span>
                )}
                {previewTemplate.settings.duration && (
                  <span style={{ fontSize: 10, background: "#1a1a2e", color: "#6060a0", border: "1px solid #2a2a40", borderRadius: 4, padding: "2px 8px" }}>
                    {previewTemplate.settings.duration}s
                  </span>
                )}
                {previewTemplate.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, background: "#0e0e1a", color: "#404060", borderRadius: 4, padding: "2px 6px" }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8 }}>
              <button onClick={() => { useTemplate(previewTemplate); setPreviewId(null); }}
                style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#7c5cfc", color: "#fff", fontWeight: 700, fontSize: 13, border: "none", cursor: "pointer" }}>
                Use This Template
              </button>
              <button onClick={() => setPreviewId(null)}
                style={{ padding: "10px 16px", borderRadius: 8, background: "#1a1a2e", color: "#6060a0", fontWeight: 500, fontSize: 13, border: "1px solid #2a2a40", cursor: "pointer" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Template Card ─────────────────────────────────────────────────────────────

function TemplateCard({ template, onPreview, onUse, featured }: { template: Template; onPreview: () => void; onUse: () => void; featured?: boolean }) {
  const catColor = CATEGORY_COLORS[template.category] ?? "#7c5cfc";

  return (
    <div
      className="group relative rounded-xl overflow-hidden transition-all hover:scale-[1.02] cursor-pointer"
      style={{
        background: "#12121e",
        border: featured ? `1px solid ${catColor}40` : "1px solid #1e1e30",
      }}
      onClick={onPreview}
    >
      {/* Thumbnail area */}
      <div style={{
        height: featured ? 100 : 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(135deg, ${catColor}15, ${catColor}05)`,
        fontSize: featured ? 40 : 32,
        position: "relative",
      }}>
        {template.thumbnail}
        {featured && (
          <span style={{ position: "absolute", top: 6, right: 6, fontSize: 8, background: `${catColor}30`, color: catColor, padding: "2px 6px", borderRadius: 4, fontWeight: 700 }}>
            POPULAR
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: "#e0e0f0", marginBottom: 2, lineHeight: 1.2 }}>{template.name}</p>
        <p style={{ fontSize: 10, color: "#6060a0", lineHeight: 1.4, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {template.preview}
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={e => { e.stopPropagation(); onUse(); }}
            style={{ flex: 1, fontSize: 10, padding: "5px", borderRadius: 6, background: "rgba(124,92,252,0.15)", color: "#a089ff", border: "1px solid rgba(124,92,252,0.25)", cursor: "pointer", fontWeight: 600 }}>
            Use
          </button>
          <button onClick={e => { e.stopPropagation(); onPreview(); }}
            style={{ fontSize: 10, padding: "5px 8px", borderRadius: 6, background: "#1a1a2e", color: "#6060a0", border: "1px solid #2a2a40", cursor: "pointer" }}>
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
