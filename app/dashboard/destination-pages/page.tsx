"use client";

import { useEffect, useState } from "react";
import type { DestinationPage, PagePlatform } from "@/types/content";

const PLATFORM_OPTIONS: { value: PagePlatform; label: string }[] = [
  { value: "YOUTUBE", label: "YouTube" },
  { value: "INSTAGRAM", label: "Instagram" },
  { value: "TIKTOK", label: "TikTok" },
  { value: "FACEBOOK", label: "Facebook" },
  { value: "OTHER", label: "Other" },
];

const PLATFORM_BADGE: Record<PagePlatform, string> = {
  YOUTUBE: "bg-red-900 text-red-300",
  INSTAGRAM: "bg-pink-900 text-pink-300",
  TIKTOK: "bg-gray-800 text-gray-300",
  FACEBOOK: "bg-blue-900 text-blue-300",
  OTHER: "bg-gray-700 text-gray-400",
};

const EMPTY_FORM = { name: "", platform: "YOUTUBE" as PagePlatform, handle: "", notes: "" };

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
    setForm({
      name: page.name,
      platform: page.platform,
      handle: page.handle ?? "",
      notes: page.notes ?? "",
    });
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
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name.trim(),
        platform: form.platform,
        handle: form.handle.trim() || undefined,
        notes: form.notes.trim() || undefined,
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Save failed.");
      return;
    }

    setEditingId(null);
    setForm(EMPTY_FORM);
    fetchPages();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? Any content items assigned to this page will lose their destination.`)) return;
    await fetch(`/api/destination-pages/${id}`, { method: "DELETE" });
    fetchPages();
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Destination Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Manage the channels and pages your content is intended for.</p>
        </div>
      </div>

      {/* Add / Edit form */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">
          {editingId ? "Edit page" : "Add a new page"}
        </h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Page name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. GioHomeStudio YouTube"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Platform *</label>
            <select
              value={form.platform}
              onChange={(e) => setForm({ ...form, platform: e.target.value as PagePlatform })}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-brand-500"
            >
              {PLATFORM_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Handle / Username</label>
            <input
              value={form.handle}
              onChange={(e) => setForm({ ...form, handle: e.target.value })}
              placeholder="@username or channel name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Notes</label>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional description"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {error && <p className="text-red-400 text-xs mb-3">{error}</p>}

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? "Saving..." : editingId ? "Save changes" : "Add page"}
          </button>
          {editingId && (
            <button
              onClick={cancelEdit}
              className="border border-gray-700 text-gray-400 hover:text-white px-4 py-2 rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Pages list */}
      {loading && <p className="text-gray-500 text-sm">Loading...</p>}

      {!loading && pages.length === 0 && (
        <p className="text-gray-600 text-sm text-center py-10">
          No destination pages yet. Add one above.
        </p>
      )}

      <div className="space-y-3">
        {pages.map((page) => (
          <div
            key={page.id}
            className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex items-center gap-4"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-white font-medium">{page.name}</span>
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${PLATFORM_BADGE[page.platform]}`}>
                  {page.platform}
                </span>
                {!page.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-500">Inactive</span>
                )}
              </div>
              {page.handle && <p className="text-gray-500 text-xs">{page.handle}</p>}
              {page.notes && <p className="text-gray-600 text-xs mt-0.5">{page.notes}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => startEdit(page)}
                className="text-xs text-gray-400 hover:text-white border border-gray-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(page.id, page.name)}
                className="text-xs text-red-500 hover:text-red-400 border border-gray-800 hover:border-red-900 px-3 py-1.5 rounded-lg transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
