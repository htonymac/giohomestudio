"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem } from "@/types/content";

type ProviderTier = "real" | "mock" | "stock" | "fallback";
const PROVIDER_META: Record<string, { label: string; tier: ProviderTier }> = {
  runway:        { label: "Runway",         tier: "real"     },
  kling:         { label: "Kling",          tier: "real"     },
  elevenlabs:    { label: "ElevenLabs",     tier: "real"     },
  kie_ai:        { label: "Kie.ai",         tier: "real"     },
  stock_library: { label: "stock",          tier: "stock"    },
  mock_video:    { label: "mock_video",     tier: "fallback" },
  mock_voice:    { label: "mock_voice",     tier: "fallback" },
  mock_music:    { label: "mock_music",     tier: "mock"     },
};
const TIER_STYLE: Record<ProviderTier, string> = {
  real:     "bg-green-900/60 text-green-300 border border-green-800",
  stock:    "bg-blue-900/60 text-blue-300 border border-blue-800",
  mock:     "bg-yellow-900/60 text-yellow-300 border border-yellow-800",
  fallback: "bg-orange-900/60 text-orange-300 border border-orange-800",
};
function ProviderBadge({ name }: { name: string | null | undefined }) {
  if (!name) return null;
  const meta = PROVIDER_META[name] ?? { label: name, tier: "mock" as ProviderTier };
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded font-mono ${TIER_STYLE[meta.tier]}`}>
      {meta.label}
    </span>
  );
}

function toMediaUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  const clean = p.replace(/\\/g, "/").replace(/^(\.\/|\/)?storage\//, "");
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
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const videoUrl = toMediaUrl(item.mergedOutputPath);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      {/* Video preview — click to open detail */}
      <div
        className="cursor-pointer"
        onClick={() => router.push(`/dashboard/content/${item.id}`)}
        title="Click to open full detail page"
      >
        {videoUrl ? (
          <div className="w-full bg-black flex items-center justify-center" style={{ maxHeight: 280 }}>
            <video
              src={videoUrl}
              className="max-h-[280px] max-w-full pointer-events-none"
              preload="metadata"
            />
          </div>
        ) : (
          <div className="w-full h-24 bg-gray-800 flex items-center justify-center text-gray-500 text-xs">
            {item.mergedOutputPath ? "File missing — click to inspect" : "No merged output yet"}
          </div>
        )}
      </div>

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 font-mono truncate mb-0.5">{item.id}</p>
            <p
              className="text-white font-medium text-sm cursor-pointer hover:text-blue-300 transition-colors"
              onClick={() => router.push(`/dashboard/content/${item.id}`)}
            >
              {item.originalInput}
            </p>
          </div>
          <span className="text-xs bg-orange-900 text-orange-300 px-2 py-0.5 rounded shrink-0">
            IN_REVIEW
          </span>
        </div>

        {/* Destination */}
        {item.destinationPage && (
          <p className="text-xs text-gray-500 mb-2">
            → {item.destinationPage.name}
            <span className="text-gray-700 ml-1">({item.destinationPage.platform})</span>
          </p>
        )}

        {/* Provider badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          <ProviderBadge name={item.videoProvider} />
          <ProviderBadge name={item.voiceProvider} />
          <ProviderBadge name={item.musicProvider} />
        </div>

        {/* View full details link */}
        <button
          onClick={() => router.push(`/dashboard/content/${item.id}`)}
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors mb-3 block"
        >
          View full details, video player, audio tracks →
        </button>

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
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [recentlyActioned, setRecentlyActioned] = useState<{ id: string; action: "approved" | "rejected" }[]>([]);

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
    setRecentlyActioned((prev) => [...prev, { id, action: action === "approve" ? "approved" : "rejected" }]);
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

      {/* Recently actioned — stays visible */}
      {recentlyActioned.length > 0 && (
        <div className="mb-6 space-y-2">
          {recentlyActioned.map(({ id, action }) => (
            <div
              key={id}
              className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm ${
                action === "approved"
                  ? "bg-green-900/30 border-green-800 text-green-300"
                  : "bg-red-900/30 border-red-800 text-red-300"
              }`}
            >
              <span>
                {action === "approved" ? "✓ Approved" : "✗ Rejected"} — <span className="font-mono text-xs">{id.slice(0, 8)}...</span>
              </span>
              <button
                onClick={() => router.push(`/dashboard/content/${id}`)}
                className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
              >
                View details →
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && items.length === 0 && recentlyActioned.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg">No items pending review.</p>
          <p className="text-sm mt-1">Generate content from the Studio to see it here.</p>
        </div>
      )}

      {!loading && items.length === 0 && recentlyActioned.length > 0 && (
        <div className="text-center py-8 text-gray-600">
          <p className="text-sm">Queue is empty. Use the links above to view your actioned items.</p>
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
