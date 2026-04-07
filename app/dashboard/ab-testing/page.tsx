"use client";

import { useEffect, useState } from "react";

interface ABVariant {
  id: string;
  label: string;
  title: string | null;
  caption: string | null;
  hashtags: string | null;
  views: number;
  clicks: number;
  engagement: number;
  isWinner: boolean;
  platform: string | null;
  postUrl: string | null;
}

interface ABTest {
  id: string;
  name: string;
  contentItemId: string;
  status: string;
  winnerVariantId: string | null;
  createdAt: string;
  variants: ABVariant[];
}

export default function ABTestingPage() {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", contentItemId: "", variantA: { title: "", caption: "" }, variantB: { title: "", caption: "" } });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/ab-test");
    const data = await res.json();
    setTests(data.tests ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate() {
    if (!form.name || !form.contentItemId) return;
    await fetch("/api/ab-test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        contentItemId: form.contentItemId,
        variants: [
          { label: "A", title: form.variantA.title || undefined, caption: form.variantA.caption || undefined },
          { label: "B", title: form.variantB.title || undefined, caption: form.variantB.caption || undefined },
        ],
      }),
    });
    setShowCreate(false);
    setForm({ name: "", contentItemId: "", variantA: { title: "", caption: "" }, variantB: { title: "", caption: "" } });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this A/B test?")) return;
    await fetch(`/api/ab-test/${id}`, { method: "DELETE" });
    load();
  }

  async function declareWinner(testId: string, variantId: string) {
    await fetch(`/api/ab-test/${testId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "completed", winnerVariantId: variantId, variantId, isWinner: true }),
    });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">A/B Testing</h1>
          <p className="text-sm text-[#6060a0] mt-0.5">Test different titles, captions, and thumbnails to find what works best</p>
        </div>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm font-semibold rounded-xl transition-colors">
          + New Test
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-5 mb-6 space-y-4">
          <h2 className="text-sm font-semibold text-white">Create A/B Test</h2>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Test name (e.g. Homepage reel — title test)" className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2" />
          <input value={form.contentItemId} onChange={e => setForm(f => ({ ...f, contentItemId: e.target.value }))} placeholder="Content Item ID (from registry)" className="w-full bg-gray-900 border border-gray-700 text-white text-sm rounded-lg px-3 py-2 font-mono" />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <p className="text-xs text-[#7c5cfc] font-semibold">Variant A</p>
              <input value={form.variantA.title} onChange={e => setForm(f => ({ ...f, variantA: { ...f.variantA, title: e.target.value } }))} placeholder="Title A" className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2" />
              <textarea value={form.variantA.caption} onChange={e => setForm(f => ({ ...f, variantA: { ...f.variantA, caption: e.target.value } }))} placeholder="Caption A" rows={2} className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 resize-none" />
            </div>
            <div className="space-y-2">
              <p className="text-xs text-orange-400 font-semibold">Variant B</p>
              <input value={form.variantB.title} onChange={e => setForm(f => ({ ...f, variantB: { ...f.variantB, title: e.target.value } }))} placeholder="Title B" className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2" />
              <textarea value={form.variantB.caption} onChange={e => setForm(f => ({ ...f, variantB: { ...f.variantB, caption: e.target.value } }))} placeholder="Caption B" rows={2} className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded-lg px-3 py-2 resize-none" />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="px-4 py-2 bg-[#7c5cfc] hover:bg-[#9070ff] text-white text-sm rounded-lg">Create Test</button>
            <button onClick={() => setShowCreate(false)} className="px-4 py-2 border border-[#2a2a40] text-[#6060a0] text-sm rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {loading && <p className="text-[#6060a0] text-center py-8">Loading...</p>}

      {!loading && tests.length === 0 && (
        <div className="text-center py-16 border border-dashed border-[#2a2a40] rounded-xl">
          <p className="text-[#6060a0]">No A/B tests yet. Create one to start testing.</p>
        </div>
      )}

      {/* Test list */}
      <div className="space-y-4">
        {tests.map(test => (
          <div key={test.id} className="bg-[#12121e] border border-[#2a2a40] rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">{test.name}</h3>
                <p className="text-[10px] text-[#6060a0] mt-0.5">
                  {test.status === "completed" ? "Completed" : test.status === "paused" ? "Paused" : "Active"}
                  {" · "}{test.variants.length} variants · Created {new Date(test.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium ${
                  test.status === "completed" ? "bg-green-900/40 text-green-400" :
                  test.status === "paused" ? "bg-yellow-900/40 text-yellow-400" :
                  "bg-blue-900/40 text-blue-400"
                }`}>{test.status}</span>
                <button onClick={() => handleDelete(test.id)} className="text-[10px] text-red-400/50 hover:text-red-400">Delete</button>
              </div>
            </div>

            {/* Variants comparison */}
            <div className="grid grid-cols-2 gap-3">
              {test.variants.map(v => {
                const totalVariantViews = Math.max(1, test.variants.reduce((a, x) => a + x.views, 0));
                const viewShare = ((v.views / totalVariantViews) * 100).toFixed(0);
                return (
                  <div key={v.id} className={`rounded-lg p-3 border ${v.isWinner ? "border-green-700/50 bg-green-950/20" : "border-[#1a1a2e] bg-[#0a0a18]"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className={`text-xs font-bold ${v.label === "A" ? "text-[#7c5cfc]" : "text-orange-400"}`}>Variant {v.label}</span>
                      {v.isWinner && <span className="text-[9px] bg-green-900/40 text-green-400 px-1.5 py-0.5 rounded">Winner</span>}
                    </div>
                    {v.title && <p className="text-xs text-white mb-1 font-medium">{v.title}</p>}
                    {v.caption && <p className="text-[10px] text-[#8080b0] mb-2 line-clamp-2">{v.caption}</p>}
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold text-white">{v.views}</p>
                        <p className="text-[9px] text-[#6060a0]">Views</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{v.clicks}</p>
                        <p className="text-[9px] text-[#6060a0]">Clicks</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">{v.engagement.toFixed(1)}%</p>
                        <p className="text-[9px] text-[#6060a0]">Engagement</p>
                      </div>
                    </div>
                    <div className="mt-2 w-full h-1.5 bg-[#1a1a2e] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${v.label === "A" ? "bg-[#7c5cfc]" : "bg-orange-400"}`} style={{ width: `${viewShare}%` }} />
                    </div>
                    {test.status === "active" && !v.isWinner && (
                      <button onClick={() => declareWinner(test.id, v.id)} className="mt-2 w-full py-1 rounded text-[10px] bg-green-900/30 text-green-400 hover:bg-green-900/50 transition-colors">
                        Declare Winner
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
