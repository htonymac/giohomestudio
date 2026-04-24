"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

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
  "Real Estate":       ds.color.gold,
  "Product Ads":       ds.color.lilac,
  "Social Media":      ds.color.sky,
  "Food & Restaurant": ds.color.coral,
  "Entertainment":     ds.color.pink,
  "Intro / Outro":     ds.color.mint,
};

const inputStyle: React.CSSProperties = {
  flex: 1, minWidth: 200,
  background: ds.color.card,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm,
  color: ds.color.ink,
  fontSize: 13, padding: "8px 12px",
  outline: "none", fontFamily: ds.font.sans,
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
    const isImageAd = t.category === "Product Ads" && t.settings.mode === "text_to_image";
    const isFlyer = t.tags.some(tag => ["banner", "flyer", "poster", "ad"].includes(tag)) && t.settings.mode === "text_to_image";
    if (isImageAd || isFlyer) {
      if (t.settings.aspectRatio) params.set("ar", t.settings.aspectRatio);
      router.push(`/dashboard/ad-editor?${params}`);
    } else if (t.settings.mode === "text_to_video" || t.settings.mode === "image_to_video" || t.settings.mode === "hybrid") {
      params.set("mode", t.settings.mode);
      if (t.settings.aspectRatio) params.set("ar", t.settings.aspectRatio);
      if (t.settings.duration) params.set("dur", String(t.settings.duration));
      router.push(`/dashboard?${params}`);
    } else if (t.settings.mode === "text_to_image") {
      params.set("mode", "text_to_image");
      router.push(`/dashboard?${params}`);
    } else {
      params.set("mode", t.settings.mode);
      if (t.settings.aspectRatio) params.set("ar", t.settings.aspectRatio);
      if (t.settings.duration) params.set("dur", String(t.settings.duration));
      router.push(`/dashboard?${params}`);
    }
  }

  if (loading) return (
    <p style={{ color: ds.color.mute, textAlign: "center", padding: "48px 0", fontFamily: ds.font.mono, fontSize: 12 }}>
      Loading templates…
    </p>
  );

  const filterBtn = (active: boolean, label: string, onClick: () => void) => (
    <button onClick={onClick} style={{
      padding: "7px 12px", borderRadius: ds.radius.sm, fontSize: 11, fontWeight: 600, cursor: "pointer",
      fontFamily: ds.font.sans,
      background: active ? `${ds.color.lilac}18` : ds.color.card,
      color:      active ? ds.color.lilac : ds.color.mute,
      border:     active ? `1px solid ${ds.color.lilac}44` : `1px solid ${ds.color.line2}`,
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ maxWidth: 1100, fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Quick Start" title="Content" italic="Templates" sub="Ready-to-use templates — pick one, customize, and generate" />

      {/* Search + filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search templates..."
          style={inputStyle} />
        {filterBtn(!filter, `All (${templates.length})`, () => setFilter(""))}
        {categories.map(c => filterBtn(
          filter === c,
          `${c} (${templates.filter(t => t.category === c).length})`,
          () => setFilter(f => f === c ? "" : c),
        ))}
      </div>

      {/* Popular row */}
      {!filter && !search && (
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: ds.color.mute, textTransform: "uppercase", letterSpacing: "0.14em", fontFamily: ds.font.mono, marginBottom: 12 }}>
            Popular Templates
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
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
          <div key={cat} style={{ marginBottom: 28 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: CATEGORY_COLORS[cat] ?? ds.color.lilac }} />
              <p style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink, margin: 0 }}>{cat}</p>
              <span style={{ fontSize: 10, color: ds.color.mute2, fontFamily: ds.font.mono }}>{items.length} templates</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 12 }}>
              {items.map(t => (
                <TemplateCard key={t.id} template={t} onPreview={() => setPreviewId(t.id)} onUse={() => useTemplate(t)} />
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <p style={{ color: ds.color.mute, fontSize: 14 }}>No templates match your search</p>
        </div>
      )}

      {/* Preview modal */}
      {previewTemplate && (
        <div style={{ position: "fixed", inset: 0, zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.75)" }} onClick={() => setPreviewId(null)} />
          <div style={{
            position: "relative", maxWidth: 560, width: "90%",
            background: ds.color.card,
            border: `1px solid ${ds.color.line2}`,
            borderRadius: ds.radius.lg, overflow: "hidden",
            boxShadow: ds.shadow.pop,
          }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${ds.color.line2}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: ds.radius.sm, background: `${CATEGORY_COLORS[previewTemplate.category] ?? ds.color.lilac}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, border: `1px solid ${CATEGORY_COLORS[previewTemplate.category] ?? ds.color.lilac}33` }}>
                  {previewTemplate.thumbnail}
                </div>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: ds.color.ink, margin: 0 }}>{previewTemplate.name}</h3>
                  <p style={{ fontSize: 11, color: ds.color.mute, margin: 0 }}>{previewTemplate.category}</p>
                </div>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: "16px 24px" }}>
              <p style={{ fontSize: 13, color: ds.color.mute, lineHeight: 1.6, marginBottom: 14 }}>{previewTemplate.preview}</p>
              <div style={{ background: ds.color.paper, border: `1px solid ${ds.color.line}`, borderRadius: ds.radius.sm, padding: 12, marginBottom: 14 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: ds.color.mute, fontFamily: ds.font.mono, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.1em" }}>AI PROMPT (editable after you start)</p>
                <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.5 }}>{previewTemplate.prompt}</p>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {previewTemplate.settings.mode && (
                  <span style={{ fontSize: 10, background: ds.color.alert, color: ds.color.lilac, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: "2px 8px", fontFamily: ds.font.mono }}>
                    {previewTemplate.settings.mode.replace(/_/g, " ")}
                  </span>
                )}
                {previewTemplate.settings.aspectRatio && (
                  <span style={{ fontSize: 10, background: ds.color.alert, color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: "2px 8px", fontFamily: ds.font.mono }}>
                    {previewTemplate.settings.aspectRatio}
                  </span>
                )}
                {previewTemplate.settings.duration && (
                  <span style={{ fontSize: 10, background: ds.color.alert, color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: "2px 8px", fontFamily: ds.font.mono }}>
                    {previewTemplate.settings.duration}s
                  </span>
                )}
                {previewTemplate.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 10, background: ds.color.paper, color: ds.color.mute2, borderRadius: ds.radius.xs, padding: "2px 6px", fontFamily: ds.font.mono }}>
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: "12px 24px 20px", display: "flex", gap: 8 }}>
              <button
                onClick={() => { useTemplate(previewTemplate); setPreviewId(null); }}
                style={{
                  flex: 1, padding: "10px", borderRadius: ds.radius.sm, border: "none", cursor: "pointer",
                  background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
                  backgroundSize: "300% 100%",
                  color: "#fff", fontWeight: 700, fontSize: 13, fontFamily: ds.font.sans,
                }}>
                Use This Template
              </button>
              <button
                onClick={() => setPreviewId(null)}
                style={{ padding: "10px 16px", borderRadius: ds.radius.sm, background: ds.color.paper, color: ds.color.mute, fontWeight: 500, fontSize: 13, border: `1px solid ${ds.color.line2}`, cursor: "pointer", fontFamily: ds.font.sans }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({ template, onPreview, onUse, featured }: { template: Template; onPreview: () => void; onUse: () => void; featured?: boolean }) {
  const catColor = CATEGORY_COLORS[template.category] ?? ds.color.lilac;

  return (
    <div
      onClick={onPreview}
      style={{
        background: ds.color.card,
        border: featured ? `1px solid ${catColor}44` : `1px solid ${ds.color.line}`,
        borderRadius: ds.radius.md,
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1.02)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = "scale(1)"; }}
    >
      {/* Thumbnail area — gradient tint, no emoji fontSize bloat */}
      <div style={{
        height: featured ? 100 : 80,
        display: "flex", alignItems: "center", justifyContent: "center",
        background: `linear-gradient(135deg, ${catColor}18, ${catColor}08)`,
        fontSize: featured ? 40 : 32, position: "relative",
      }}>
        {template.thumbnail}
        {featured && (
          <span style={{
            position: "absolute", top: 6, right: 6, fontSize: 8,
            background: `${catColor}30`, color: catColor, padding: "2px 6px",
            borderRadius: ds.radius.xs, fontWeight: 700, fontFamily: ds.font.mono, letterSpacing: "0.08em",
          }}>
            POPULAR
          </span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "10px 12px" }}>
        <p style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink, marginBottom: 2, lineHeight: 1.2 }}>{template.name}</p>
        <p style={{
          fontSize: 10, color: ds.color.mute, lineHeight: 1.4, marginBottom: 8,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {template.preview}
        </p>
        <div style={{ display: "flex", gap: 4 }}>
          <button
            onClick={e => { e.stopPropagation(); onUse(); }}
            style={{
              flex: 1, fontSize: 10, padding: "5px", borderRadius: ds.radius.xs,
              background: `${ds.color.lilac}18`, color: ds.color.lilac,
              border: `1px solid ${ds.color.lilac}33`, cursor: "pointer", fontWeight: 600,
              fontFamily: ds.font.sans,
            }}>
            Use
          </button>
          <button
            onClick={e => { e.stopPropagation(); onPreview(); }}
            style={{
              fontSize: 10, padding: "5px 8px", borderRadius: ds.radius.xs,
              background: ds.color.paper, color: ds.color.mute,
              border: `1px solid ${ds.color.line}`, cursor: "pointer",
              fontFamily: ds.font.sans,
            }}>
            Preview
          </button>
        </div>
      </div>
    </div>
  );
}
