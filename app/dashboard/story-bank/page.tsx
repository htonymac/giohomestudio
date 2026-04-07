"use client";

import { useEffect, useState } from "react";

interface StoryIdea {
  id: string;
  title: string;
  body: string | null;
  tags: string;
  rating: number;
  mode: string | null;
  platform: string | null;
  status: string;
  usedInContentId: string | null;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  idea:           { label: "Idea",          color: "bg-gray-700 text-gray-300" },
  scripted:       { label: "Scripted",      color: "bg-blue-900 text-blue-300" },
  in_production:  { label: "In Production", color: "bg-purple-900 text-purple-300" },
  used:           { label: "Used",          color: "bg-green-900 text-green-300" },
};

export default function StoryBankPage() {
  const [ideas, setIdeas] = useState<StoryIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", body: "", tags: "", mode: "", platform: "" });
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (search) params.set("search", search);
    params.set("sort", "rating");
    params.set("dir", "desc");
    const res = await fetch(`/api/story-bank?${params}`);
    const data = await res.json();
    setIdeas(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [filter, search]);

  async function handleSave() {
    if (!form.title.trim()) return;
    if (editId) {
      await fetch(`/api/story-bank/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/story-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setShowForm(false);
    setEditId(null);
    setForm({ title: "", body: "", tags: "", mode: "", platform: "" });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this idea?")) return;
    await fetch(`/api/story-bank/${id}`, { method: "DELETE" });
    load();
  }

  async function handleRate(id: string, rating: number) {
    await fetch(`/api/story-bank/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    setIdeas(prev => prev.map(i => i.id === id ? { ...i, rating } : i));
  }

  async function handleStatusChange(id: string, status: string) {
    await fetch(`/api/story-bank/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    load();
  }

  function openEdit(idea: StoryIdea) {
    setForm({ title: idea.title, body: idea.body ?? "", tags: idea.tags, mode: idea.mode ?? "", platform: idea.platform ?? "" });
    setEditId(idea.id);
    setShowForm(true);
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Story Bank</h1>
          <p className="text-sm text-[#6060a0] mt-0.5">Save ideas, rate them, pick the best for production</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditId(null); setForm({ title: "", body: "", tags: "", mode: "", platform: "" }); }}
          className="px-4 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors"
        >
          + New Idea
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search ideas..."
          className="flex-1 bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-600"
        />
        <select value={filter} onChange={e => setFilter(e.target.value)} className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
          <option value="">All</option>
          <option value="idea">Ideas</option>
          <option value="scripted">Scripted</option>
          <option value="in_production">In Production</option>
          <option value="used">Used</option>
        </select>
      </div>

      {/* New/Edit form */}
      {showForm && (
        <div className="mb-6 bg-[#12121e] border border-[#2a2a40] rounded-xl p-4 space-y-3">
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Idea title..."
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-600"
          />
          <textarea
            value={form.body}
            onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
            placeholder="Describe your story idea, script notes, or concept..."
            rows={4}
            className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-indigo-600 resize-vertical"
          />
          <div className="flex gap-2">
            <input
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
              placeholder="Tags (comma-separated)"
              className="flex-1 bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
            />
            <select value={form.mode} onChange={e => setForm(f => ({ ...f, mode: e.target.value }))} className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
              <option value="">Mode</option>
              <option value="FREE">Free</option>
              <option value="COMMERCIAL">Commercial</option>
              <option value="SERIES">Series</option>
            </select>
            <select value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2">
              <option value="">Platform</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="tiktok">TikTok</option>
              <option value="facebook">Facebook</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSave} className="px-4 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm rounded-lg transition-colors">
              {editId ? "Update" : "Save Idea"}
            </button>
            <button onClick={() => { setShowForm(false); setEditId(null); }} className="px-4 py-2 border border-[#2a2a40] text-[#6060a0] hover:text-white text-sm rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-[#6060a0] text-center py-8">Loading...</p>}

      {!loading && ideas.length === 0 && (
        <div className="text-center py-16 border border-dashed border-[#2a2a40] rounded-xl">
          <p className="text-[#6060a0]">No ideas yet. Start collecting!</p>
        </div>
      )}

      {!loading && ideas.length > 0 && (
        <div className="space-y-2">
          {ideas.map(idea => {
            const st = STATUS_LABELS[idea.status] ?? STATUS_LABELS.idea;
            return (
              <div key={idea.id} className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-4 hover:border-[#3a3a60] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-white truncate">{idea.title}</h3>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${st.color}`}>{st.label}</span>
                      {idea.mode && <span className="text-[9px] text-[#6060a0] bg-[#1a1a2e] px-1.5 py-0.5 rounded">{idea.mode}</span>}
                      {idea.platform && <span className="text-[9px] text-[#6060a0] bg-[#1a1a2e] px-1.5 py-0.5 rounded">{idea.platform}</span>}
                    </div>
                    {idea.body && <p className="text-xs text-[#8080b0] mb-1.5 line-clamp-2">{idea.body}</p>}
                    {idea.tags && (
                      <div className="flex flex-wrap gap-1">
                        {idea.tags.split(",").filter(Boolean).map((t, i) => (
                          <span key={i} className="text-[9px] bg-[#7c5cfc]/10 text-[#b090ff] px-1.5 py-0.5 rounded">{t.trim()}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {/* Star rating */}
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(s => (
                        <button key={s} onClick={() => handleRate(idea.id, s === idea.rating ? 0 : s)} className={`text-sm ${s <= idea.rating ? "text-yellow-400" : "text-[#2a2a40] hover:text-yellow-600"}`}>
                          ★
                        </button>
                      ))}
                    </div>
                    {/* Actions */}
                    <div className="flex gap-1">
                      <select
                        value={idea.status}
                        onChange={e => handleStatusChange(idea.id, e.target.value)}
                        className="bg-[#0a0a18] border border-[#2a2a40] text-[10px] text-[#6060a0] rounded px-1 py-0.5"
                      >
                        <option value="idea">Idea</option>
                        <option value="scripted">Scripted</option>
                        <option value="in_production">In Production</option>
                        <option value="used">Used</option>
                      </select>
                      <button onClick={() => openEdit(idea)} className="text-[10px] text-[#6060a0] hover:text-white px-1.5">Edit</button>
                      <button onClick={() => handleDelete(idea.id)} className="text-[10px] text-red-400/50 hover:text-red-400 px-1.5">Del</button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
