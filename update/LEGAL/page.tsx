'use client';

// app/review/page.tsx
// GioHomeStudio — Review Queue
// Every approve action shows a responsibility confirmation before committing.

import { useState, useEffect } from 'react';

interface ContentItem {
  id: string;
  originalInput: string;
  enhancedPrompt?: string;
  mergedOutputPath?: string;
  videoProvider?: string;
  voiceProvider?: string;
  musicProvider?: string;
  status: string;
  createdAt: string;
}

export default function ReviewPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [confirmApprove, setConfirmApprove] = useState(false);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/review');
      const data = await res.json();
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!selected || !confirmApprove) return;
    setActionLoading(true);
    try {
      await fetch(`/api/review/${selected.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setSelected(null);
      setConfirmApprove(false);
      setNotes('');
      await fetchQueue();
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await fetch(`/api/review/${selected.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });
      setSelected(null);
      setNotes('');
      await fetchQueue();
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-zinc-950 text-zinc-100 font-mono">
      {/* Header */}
      <header className="border-b border-zinc-800 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">🎬 GioHomeStudio</h1>
          <p className="text-xs text-zinc-500 mt-0.5">AI Video Content Studio — Phase 1</p>
        </div>
        <nav className="flex gap-6 text-sm text-zinc-400">
          <a href="/dashboard" className="hover:text-white transition-colors">Dashboard</a>
          <span className="text-white border-b border-white pb-0.5">Review Queue</span>
          <a href="/registry" className="hover:text-white transition-colors">Registry</a>
        </nav>
      </header>

      {/* Responsibility banner — always visible on review page */}
      <div className="bg-amber-950/40 border-b border-amber-800/50 px-8 py-3 flex items-center gap-3">
        <span className="text-amber-400 text-sm">⚖️</span>
        <p className="text-amber-300 text-xs leading-relaxed">
          <strong>You are the publisher of record.</strong> By approving any content below,
          you confirm you have personally watched it, verified it is accurate and appropriate,
          and accept full responsibility for its publication. AI-generated content must always
          be reviewed by a human before approval.
        </p>
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Left — Queue list */}
        <div className="w-80 border-r border-zinc-800 overflow-y-auto">
          <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
            <p className="text-xs text-zinc-400 uppercase tracking-widest">Pending Review</p>
            <span className="bg-zinc-800 text-zinc-300 text-xs px-2 py-0.5 rounded-full">
              {items.length}
            </span>
          </div>

          {loading && (
            <p className="text-zinc-500 text-sm px-5 py-4">Loading...</p>
          )}

          {!loading && items.length === 0 && (
            <div className="px-5 py-8 text-center">
              <p className="text-zinc-500 text-sm">No items pending review.</p>
              <a href="/dashboard" className="text-zinc-400 text-xs underline mt-2 inline-block">
                Create new content →
              </a>
            </div>
          )}

          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => { setSelected(item); setConfirmApprove(false); setNotes(''); }}
              className={`px-5 py-4 border-b border-zinc-800 cursor-pointer transition-colors ${
                selected?.id === item.id ? 'bg-zinc-800' : 'hover:bg-zinc-900'
              }`}
            >
              <p className="text-xs text-zinc-200 font-medium mb-1 truncate">
                {item.originalInput.slice(0, 60)}...
              </p>
              <p className="text-xs text-zinc-500">
                {new Date(item.createdAt).toLocaleString()}
              </p>
              <div className="flex gap-1.5 mt-2">
                {item.videoProvider && <Tag label={item.videoProvider} />}
                {item.voiceProvider && <Tag label={item.voiceProvider} />}
                {item.musicProvider && <Tag label={item.musicProvider} />}
              </div>
            </div>
          ))}
        </div>

        {/* Right — Detail & actions */}
        <div className="flex-1 overflow-y-auto">
          {!selected ? (
            <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
              Select an item from the queue to review
            </div>
          ) : (
            <div className="p-8 max-w-2xl">
              <p className="text-xs text-zinc-500 uppercase tracking-widest mb-1">Content ID</p>
              <p className="text-xs font-mono text-zinc-400 mb-6">{selected.id}</p>

              <section className="mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Original Input</p>
                <p className="text-sm text-zinc-200 bg-zinc-900 rounded-lg p-4 leading-relaxed">
                  {selected.originalInput}
                </p>
              </section>

              {selected.enhancedPrompt && (
                <section className="mb-6">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Enhanced Prompt</p>
                  <p className="text-sm text-zinc-300 bg-zinc-900 rounded-lg p-4 leading-relaxed">
                    {selected.enhancedPrompt}
                  </p>
                </section>
              )}

              {/* Video preview */}
              {selected.mergedOutputPath && (
                <section className="mb-6">
                  <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">
                    Merged Output — Watch before approving
                  </p>
                  <video
                    controls
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-900"
                    src={`/api/media?path=${encodeURIComponent(selected.mergedOutputPath)}`}
                  />
                </section>
              )}

              {/* Notes */}
              <section className="mb-6">
                <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">Notes (optional)</p>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Add a note about this review decision..."
                  className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-3 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none resize-none"
                />
              </section>

              {/* Approve confirmation checkbox */}
              <label className="flex items-start gap-3 cursor-pointer mb-6 bg-amber-950/30 border border-amber-800/50 rounded-xl p-4">
                <input
                  type="checkbox"
                  checked={confirmApprove}
                  onChange={(e) => setConfirmApprove(e.target.checked)}
                  className="mt-0.5 accent-emerald-400 w-4 h-4 flex-shrink-0"
                />
                <span className="text-sm text-amber-200 leading-relaxed">
                  I have personally watched this content. I confirm it is accurate, appropriate,
                  and safe to publish. I accept full responsibility as publisher of record.
                </span>
              </label>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={!confirmApprove || actionLoading}
                  className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
                    confirmApprove && !actionLoading
                      ? 'bg-emerald-600 text-white hover:bg-emerald-500'
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  ✅ Approve
                </button>
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 py-3 rounded-xl font-semibold text-sm bg-red-900/50 text-red-300 hover:bg-red-900 border border-red-800 transition-all"
                >
                  ❌ Reject
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function Tag({ label }: { label: string }) {
  return (
    <span className="text-xs bg-zinc-700 text-zinc-300 px-1.5 py-0.5 rounded">
      {label}
    </span>
  );
}
