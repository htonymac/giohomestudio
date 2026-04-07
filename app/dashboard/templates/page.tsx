"use client";

import { useEffect, useState } from "react";

interface Template {
  id: string;
  name: string;
  icon: string;
  category: string;
  description: string;
  mode: string;
  href: string;
  tags: string[];
  popular?: boolean;
}

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/templates")
      .then(r => r.json())
      .then(d => { setTemplates(d.templates ?? []); setCategories(d.categories ?? []); })
      .finally(() => setLoading(false));
  }, []);

  const filtered = filter ? templates.filter(t => t.category === filter) : templates;

  if (loading) return <p style={{ color: "var(--text2)", textAlign: "center", padding: "48px 0" }}>Loading templates...</p>;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-shimmer">🚀 Templates</h1>
        <p className="text-xs mt-0.5" style={{ color: "var(--text2)" }}>Quick-start with pre-configured content formats — just add your idea</p>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilter("")} className={`btn btn-sm ${!filter ? "btn-primary" : "btn-ghost"}`}>All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`btn btn-sm ${filter === c ? "btn-primary" : "btn-ghost"}`}>{c}</button>
        ))}
      </div>

      {/* Popular section */}
      {!filter && (
        <div className="mb-8">
          <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 12 }}>
            Popular Templates
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {templates.filter(t => t.popular).map(t => (
              <a
                key={t.id}
                href={t.href}
                className="card"
                style={{ textDecoration: "none", position: "relative", overflow: "hidden" }}
              >
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "linear-gradient(90deg, var(--accent), var(--accent-warm), var(--accent3))" }} />
                <div style={{ fontSize: 28, marginBottom: 8 }}>{t.icon}</div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>{t.name}</h3>
                <p style={{ fontSize: 11, color: "var(--text2)", lineHeight: 1.5 }}>{t.description}</p>
                <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                  {t.tags.slice(0, 3).map(tag => (
                    <span key={tag} className="tag tag-purple">{tag}</span>
                  ))}
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* All templates by category */}
      {(filter ? [filter] : categories).map(cat => {
        const items = filtered.filter(t => t.category === cat);
        if (items.length === 0) return null;
        return (
          <div key={cat} className="mb-6">
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: "1.2px", textTransform: "uppercase", color: "var(--text3)", marginBottom: 10 }}>
              {cat}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map(t => (
                <a
                  key={t.id}
                  href={t.href}
                  className="card"
                  style={{ textDecoration: "none", display: "flex", gap: 12, alignItems: "flex-start" }}
                >
                  <span style={{ fontSize: 24, flexShrink: 0 }}>{t.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>{t.name}</h3>
                    <p style={{ fontSize: 10, color: "var(--text2)", lineHeight: 1.5 }}>{t.description}</p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
