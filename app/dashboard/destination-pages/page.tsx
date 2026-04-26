"use client";

import { useEffect, useState } from "react";
import type { DestinationPage, PagePlatform } from "@/types/content";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

const PLATFORM_OPTIONS: { value: PagePlatform; label: string }[] = [
  { value: "YOUTUBE",   label: "YouTube" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK",    label: "TikTok" },
  { value: "FACEBOOK",  label: "Facebook" },
  { value: "OTHER",     label: "Other" },
];

const PLATFORM_BADGE: Record<PagePlatform, { bg: string; text: string }> = {
  YOUTUBE:   { bg: "#dc262622", text: "#f87171" },
  INSTAGRAM: { bg: "#ec489922", text: "#f9a8d4" },
  TIKTOK:    { bg: `${ds.color.mute2}20`, text: ds.color.ink2 },
  FACEBOOK:  { bg: "#1877f222", text: "#93c5fd" },
  OTHER:     { bg: `${ds.color.mute2}18`, text: ds.color.mute },
};

const EMPTY_FORM = { name: "", platform: "YOUTUBE" as PagePlatform, handle: "", notes: "" };

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: ds.color.card,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm,
  padding: "9px 12px",
  color: ds.color.ink,
  fontSize: 13,
  outline: "none",
  fontFamily: ds.font.sans,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: ds.color.mute,
  marginBottom: 5,
  fontFamily: ds.font.mono,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
};

export default function DestinationPagesPage() {
  const [pages, setPages] = useState<DestinationPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  async function fetchPages() {
    setLoading(true);
    const res = await fetch("/api/destination-pages");
    const data = await res.json();
    setPages(data.pages ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchPages(); }, []);

  function startEdit(page: DestinationPage) {
    setEditingId(page.id);
    setForm({ name: page.name, platform: page.platform, handle: page.handle ?? "", notes: page.notes ?? "" });
    setError("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError("");
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Name is required."); return; }
    setSaving(true);
    setError("");
    const url = editingId ? `/api/destination-pages/${editingId}` : "/api/destination-pages";
    const method = editingId ? "PATCH" : "POST";
    const res = await fetch(url, {
      method, headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.name.trim(), platform: form.platform, handle: form.handle.trim() || undefined, notes: form.notes.trim() || undefined }),
    });
    setSaving(false);
    if (!res.ok) { const d = await res.json(); setError(d.error ?? "Save failed."); return; }
    setEditingId(null);
    setForm(EMPTY_FORM);
    fetchPages();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Any content items assigned to this page will lose their destination.`)) return;
    await fetch(`/api/destination-pages/${id}`, { method: "DELETE" });
    fetchPages();
  }

  const btnPrimary: React.CSSProperties = {
    padding: "9px 18px", borderRadius: ds.radius.sm, border: "none",
    background: `linear-gradient(120deg,${ds.color.btnA},${ds.color.btnB},${ds.color.btnC},${ds.color.btnD},${ds.color.btnA})`,
    backgroundSize: "300% 100%",
    color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer",
    fontFamily: ds.font.sans, opacity: saving ? 0.6 : 1,
  };

  const btnSecondary: React.CSSProperties = {
    padding: "9px 16px", borderRadius: ds.radius.sm,
    border: `1px solid ${ds.color.line2}`,
    background: ds.color.card, color: ds.color.mute,
    fontWeight: 500, fontSize: 13, cursor: "pointer", fontFamily: ds.font.sans,
  };

  return (
    <div style={{ maxWidth: 760, fontFamily: ds.font.sans }}>
      <HeroTitle kicker="Distribution" title="Publishing" italic="Pages" sub="Manage social media channels and platforms for your content" />

      {/* Add / Edit form */}
      <div style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.md, padding: 20, marginBottom: 24 }}>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2, marginBottom: 16 }}>
          {editingId ? "Edit page" : "Add a new page"}
        </h2>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Page name *</label>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. GioHomeStudio YouTube" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Platform *</label>
            <select value={form.platform} onChange={e => setForm({ ...form, platform: e.target.value as PagePlatform })}
              style={{ ...inputStyle, appearance: "none" }}>
              {PLATFORM_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Handle / Username</label>
            <input value={form.handle} onChange={e => setForm({ ...form, handle: e.target.value })}
              placeholder="@username or channel name" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Notes</label>
            <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional description" style={inputStyle} />
          </div>
        </div>

        {error && <p style={{ color: "#f87171", fontSize: 12, marginBottom: 10 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={handleSave} disabled={saving} style={btnPrimary}>
            {saving ? "Saving..." : editingId ? "Save changes" : "Add page"}
          </button>
          {editingId && (
            <button onClick={cancelEdit} style={btnSecondary}>Cancel</button>
          )}
        </div>
      </div>

      {/* Pages list */}
      {loading && <p style={{ color: ds.color.mute, fontSize: 12, fontFamily: ds.font.mono }}>Loading…</p>}

      {!loading && pages.length === 0 && (
        <p style={{ color: ds.color.mute2, fontSize: 13, textAlign: "center", padding: "40px 0" }}>
          No destination pages yet. Add one above.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {pages.map(page => (
          <div key={page.id} style={{
            background: ds.color.card, border: `1px solid ${ds.color.line2}`,
            borderRadius: ds.radius.md, padding: "14px 18px",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                <span style={{ color: ds.color.ink, fontWeight: 600, fontSize: 13 }}>{page.name}</span>
                <span style={{
                  fontSize: 10, padding: "2px 7px", borderRadius: 999, fontWeight: 700,
                  fontFamily: ds.font.mono,
                  background: PLATFORM_BADGE[page.platform]?.bg ?? `${ds.color.mute2}15`,
                  color: PLATFORM_BADGE[page.platform]?.text ?? ds.color.mute,
                }}>
                  {page.platform}
                </span>
                {!page.isActive && (
                  <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 999, background: `${ds.color.mute2}15`, color: ds.color.mute2 }}>Inactive</span>
                )}
              </div>
              {page.handle && <p style={{ fontSize: 11, color: ds.color.mute, margin: 0, fontFamily: ds.font.mono }}>{page.handle}</p>}
              {page.notes && <p style={{ fontSize: 11, color: ds.color.mute2, margin: "2px 0 0" }}>{page.notes}</p>}
            </div>
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button onClick={() => startEdit(page)}
                style={{ fontSize: 11, color: ds.color.mute, border: `1px solid ${ds.color.line2}`, padding: "6px 12px", borderRadius: ds.radius.xs, background: "transparent", cursor: "pointer" }}>
                Edit
              </button>
              <button onClick={() => handleDelete(page.id, page.name)}
                style={{ fontSize: 11, color: "#f87171", border: "1px solid #4a1a1a", padding: "6px 12px", borderRadius: ds.radius.xs, background: "transparent", cursor: "pointer" }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
