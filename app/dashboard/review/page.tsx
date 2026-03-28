"use client";

import { useEffect, useState } from "react";
import type { ContentItem } from "@/types/content";

// Convert a local storage path to a browser-accessible /api/media URL.
// e.g. "storage\merged\foo.mp4"  →  "/api/media/merged/foo.mp4"
//      "storage/merged/foo.mp4"  →  "/api/media/merged/foo.mp4"
function toMediaUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  // Normalize backslashes → forward slashes, then strip leading "./" and "storage/"
  const clean = storagePath
    .replace(/\\/g, "/")
    .replace(/^(\.\/|\/)?storage\//, "");
  return `/api/media/${clean}`;
}

function ReviewCard({
  item,
  onAction,
  actionLoading,
}: {
  item: ContentItem;
  onAction: (id: string, action: "approve" | "reject", note?: string) => void;
  actionLoading: string | null;
}) {
  const [note, setNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const videoUrl = toMediaUrl(item.mergedOutputPath);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Video preview */}
      {videoUrl ? (
        <div className="w-full bg-black flex items-center justify-center" style={{ maxHeight: 360 }}>
          <video
            src={videoUrl}
            controls
            className="max-h-[360px] max-w-full"
            preload="metadata"
          />
        </div>
      ) : (
        <div className="w-full h-32 bg-gray-800 flex items-center justify-center text-gray-600 text-sm">
          No merged output available
        </div>
      )}

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 font-mono mb-1">{item.id}</p>
            <p className="text-white font-medium">{item.originalInput}</p>
          </div>
          <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded shrink-0">
            IN_REVIEW
          </span>
        </div>

        {/* Enhanced prompt */}
        {item.enhancedPrompt && (
          <p className="text-gray-400 text-sm mb-3 line-clamp-3">{item.enhancedPrompt}</p>
        )}

        {/* Providers + paths */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 mb-4">
          {item.videoProvider && <span>Video: {item.videoProvider}</span>}
          {item.voiceProvider && <span>Voice: {item.voiceProvider}</span>}
          {item.musicProvider && <span>Music: {item.musicProvider}</span>}
          {item.mergedOutputPath && (
            <a
              href={videoUrl ?? "#"}
              download
              className="text-blue-400 hover:text-blue-300"
            >
              Download merged
            </a>
          )}
        </div>

        <p className="text-xs text-gray-600 mb-4">
          {new Date(item.createdAt).toLocaleString()}
        </p>

        {/* Actions */}
        {showRejectInput ? (
          <div className="space-y-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Rejection reason (optional)"
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-700 resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={() => {
                  onAction(item.id, "reject", note || undefined);
                  setShowRejectInput(false);
                  setNote("");
                }}
                disabled={actionLoading === item.id}
                className="flex-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Confirm Reject
              </button>
              <button
                onClick={() => { setShowRejectInput(false); setNote(""); }}
                className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => onAction(item.id, "approve")}
              disabled={actionLoading === item.id}
              className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              {actionLoading === item.id ? "Processing..." : "Approve"}
            </button>
            <button
              onClick={() => setShowRejectInput(true)}
              disabled={actionLoading === item.id}
              className="flex-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ReviewPage() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchQueue() {
    setLoading(true);
    const res = await fetch("/api/review");
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchQueue(); }, []);

  async function handleAction(id: string, action: "approve" | "reject", note?: string) {
    setActionLoading(id);
    await fetch(`/api/review/${id}/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    await fetchQueue();
    setActionLoading(null);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Review Queue</h1>
        <button
          onClick={fetchQueue}
          className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-1 rounded transition-colors"
        >
          Refresh
        </button>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg">No items pending review.</p>
          <p className="text-sm mt-1">Generate content from the Studio to see it here.</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {items.map((item) => (
          <ReviewCard
            key={item.id}
            item={item}
            onAction={handleAction}
            actionLoading={actionLoading}
          />
        ))}
      </div>
    </div>
  );
}
