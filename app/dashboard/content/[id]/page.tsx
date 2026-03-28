"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { ContentItem, ContentVersion, ContentStatus } from "@/types/content";

type ProviderTier = "real" | "mock" | "stock" | "fallback";

const PROVIDER_META: Record<string, { label: string; tier: ProviderTier }> = {
  runway:        { label: "Runway (real)",        tier: "real"     },
  kling:         { label: "Kling (real)",         tier: "real"     },
  elevenlabs:    { label: "ElevenLabs (real)",    tier: "real"     },
  kie_ai:        { label: "Kie.ai (real)",        tier: "real"     },
  stock_library: { label: "Stock library",        tier: "stock"    },
  mock_video:    { label: "mock_video (fallback)", tier: "fallback" },
  mock_voice:    { label: "mock_voice (fallback)", tier: "fallback" },
  mock_music:    { label: "mock_music (generated)", tier: "mock"   },
};

const TIER_STYLE: Record<ProviderTier, string> = {
  real:     "bg-green-900/60 text-green-300 border border-green-800",
  stock:    "bg-blue-900/60 text-blue-300 border border-blue-800",
  mock:     "bg-yellow-900/60 text-yellow-300 border border-yellow-800",
  fallback: "bg-orange-900/60 text-orange-300 border border-orange-800",
};

function ProviderBadge({ name }: { name: string | null | undefined }) {
  if (!name) return <span className="text-gray-700 text-xs">—</span>;
  const meta = PROVIDER_META[name] ?? { label: name, tier: "mock" as ProviderTier };
  return (
    <span className={`text-xs px-2 py-0.5 rounded font-mono ${TIER_STYLE[meta.tier]}`}>
      {meta.label}
    </span>
  );
}

function toMediaUrl(p: string | null | undefined): string | null {
  if (!p) return null;
  const clean = p.replace(/\\/g, "/").replace(/^(\.\/|\/)?storage\//, "");
  return `/api/media/${clean}`;
}

function fileExists(url: string | null): Promise<boolean> {
  if (!url) return Promise.resolve(false);
  return fetch(url, { method: "HEAD" }).then((r) => r.ok).catch(() => false);
}

const STATUS_COLORS: Record<ContentStatus, string> = {
  PENDING: "bg-gray-700 text-gray-300",
  ENHANCING: "bg-blue-900 text-blue-300",
  GENERATING_VIDEO: "bg-purple-900 text-purple-300",
  GENERATING_VOICE: "bg-indigo-900 text-indigo-300",
  GENERATING_MUSIC: "bg-pink-900 text-pink-300",
  MERGING: "bg-yellow-900 text-yellow-300",
  IN_REVIEW: "bg-orange-900 text-orange-300",
  APPROVED: "bg-green-900 text-green-300",
  REJECTED: "bg-red-900 text-red-300",
  FAILED: "bg-red-950 text-red-400",
  PUBLISHED: "bg-teal-900 text-teal-300",
  ARCHIVED: "bg-gray-800 text-gray-500",
};

function MediaBlock({
  label,
  url,
  type,
}: {
  label: string;
  url: string | null;
  type: "video" | "audio";
}) {
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!url) { setOk(false); return; }
    fileExists(url).then(setOk);
  }, [url]);

  if (!url) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-gray-600 text-sm">No file recorded</p>
      </div>
    );
  }

  if (ok === null) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-gray-600 text-sm">Checking file...</p>
      </div>
    );
  }

  if (!ok) {
    return (
      <div className="bg-red-950/30 border border-red-900 rounded-xl p-4">
        <p className="text-xs text-red-400 mb-2 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-red-400 text-sm font-medium">File missing on disk</p>
        <p className="text-gray-600 text-xs mt-1 font-mono break-all">{url}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
        <a
          href={url}
          download
          className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
        >
          Download
        </a>
      </div>
      {type === "video" ? (
        <video
          src={url}
          controls
          className="w-full rounded-lg max-h-[480px] bg-black"
          preload="metadata"
        />
      ) : (
        <audio src={url} controls className="w-full" preload="metadata" />
      )}
    </div>
  );
}

export default function ContentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [item, setItem] = useState<ContentItem | null>(null);
  const [versions, setVersions] = useState<ContentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [note, setNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [actionDone, setActionDone] = useState<"approved" | "rejected" | null>(null);

  async function fetchItem() {
    const res = await fetch(`/api/registry/${id}`);
    if (!res.ok) { setNotFound(true); setLoading(false); return; }
    const data = await res.json();
    setItem(data.item);
    setVersions(data.versions ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchItem(); }, [id]);

  async function handleApprove() {
    if (!item) return;
    setActionLoading(true);
    await fetch(`/api/review/${item.id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || undefined }),
    });
    setActionDone("approved");
    setActionLoading(false);
    fetchItem();
  }

  async function handleReject() {
    if (!item) return;
    setActionLoading(true);
    await fetch(`/api/review/${item.id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: note || undefined }),
    });
    setActionDone("rejected");
    setActionLoading(false);
    setShowReject(false);
    setNote("");
    fetchItem();
  }

  if (loading) {
    return <div className="text-gray-500 py-16 text-center">Loading...</div>;
  }

  if (notFound || !item) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 text-lg">Content item not found.</p>
        <button onClick={() => router.push("/dashboard/registry")} className="mt-4 text-sm text-blue-400 hover:text-blue-300">
          Back to Registry
        </button>
      </div>
    );
  }

  const mergedUrl = toMediaUrl(item.mergedOutputPath);
  const voiceUrl = toMediaUrl(item.voicePath);
  const musicUrl = toMediaUrl(item.musicPath);

  const isInReview = item.status === "IN_REVIEW";
  const isTerminal = ["APPROVED", "REJECTED", "FAILED", "ARCHIVED", "PUBLISHED"].includes(item.status);

  return (
    <div className="max-w-3xl">
      {/* Back */}
      <button
        onClick={() => router.back()}
        className="text-sm text-gray-500 hover:text-white mb-6 flex items-center gap-1 transition-colors"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-600 font-mono mb-1">{item.id}</p>
          <h1 className="text-xl font-bold text-white break-words">{item.originalInput}</h1>
        </div>
        <span className={`shrink-0 text-xs px-2 py-1 rounded font-medium ${STATUS_COLORS[item.status]}`}>
          {item.status}
        </span>
      </div>

      {/* Post-action banner */}
      {actionDone === "approved" && (
        <div className="bg-green-900/40 border border-green-800 rounded-xl px-4 py-3 mb-6 text-sm text-green-300">
          Approved. This item is still here — view it anytime from the Registry.
        </div>
      )}
      {actionDone === "rejected" && (
        <div className="bg-red-900/40 border border-red-800 rounded-xl px-4 py-3 mb-6 text-sm text-red-300">
          Rejected. This item is still here — view it anytime from the Registry.
        </div>
      )}

      {/* Merged video */}
      <div className="mb-4">
        {item.mergedOutputPath ? (
          <MediaBlock label="Merged Output" url={mergedUrl} type="video" />
        ) : isTerminal ? (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm font-medium">No merged output recorded for this item.</p>
            <p className="text-gray-600 text-xs mt-1">
              The pipeline may have failed during the merge step. Check status and notes below.
            </p>
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1 font-medium uppercase tracking-wide">Merged Output</p>
            <p className="text-gray-500 text-sm">Not yet available — pipeline in progress.</p>
          </div>
        )}
      </div>

      {/* Voice + Music */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <MediaBlock label="Voice Track" url={voiceUrl} type="audio" />
        <MediaBlock label="Music Track" url={musicUrl} type="audio" />
      </div>

      {/* Metadata */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300 mb-4">Details</h2>

        {item.enhancedPrompt && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Enhanced prompt</p>
            <p className="text-gray-300 text-sm leading-relaxed">{item.enhancedPrompt}</p>
          </div>
        )}

        {item.destinationPage && (
          <div>
            <p className="text-xs text-gray-500 mb-1">Destination page</p>
            <p className="text-gray-300 text-sm">
              {item.destinationPage.name}
              <span className="text-gray-600 ml-2">
                ({item.destinationPage.platform}{item.destinationPage.handle ? ` · ${item.destinationPage.handle}` : ""})
              </span>
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">Video</p>
            {item.requestedVideoProvider && item.requestedVideoProvider !== item.videoProvider ? (
              <span className="flex items-center gap-1 flex-wrap">
                <ProviderBadge name={item.requestedVideoProvider} />
                <span className="text-gray-600 text-xs">→ used:</span>
                <ProviderBadge name={item.videoProvider} />
              </span>
            ) : (
              <ProviderBadge name={item.videoProvider} />
            )}
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Voice</p>
            <ProviderBadge name={item.voiceProvider} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Music</p>
            <ProviderBadge name={item.musicProvider} />
          </div>
          {item.durationSeconds && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Duration</p>
              <p className="text-gray-300">{item.durationSeconds}s</p>
            </div>
          )}
        </div>

        {/* Studio controls */}
        {(item.videoQuality || item.videoType || item.visualStyle || item.subjectType) && (
          <div className="pt-2 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-2">Studio controls</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {item.videoQuality && (
                <div>
                  <span className="text-gray-600">Quality </span>
                  <span className="text-gray-300 font-mono">{item.videoQuality}</span>
                </div>
              )}
              {item.videoType && (
                <div>
                  <span className="text-gray-600">Type </span>
                  <span className="text-gray-300 font-mono">{item.videoType.replace("_", " ")}</span>
                </div>
              )}
              {item.visualStyle && (
                <div>
                  <span className="text-gray-600">Style </span>
                  <span className="text-gray-300 font-mono">{item.visualStyle.replace("_", " ")}</span>
                </div>
              )}
              {item.subjectType && (
                <div>
                  <span className="text-gray-600">Subject </span>
                  <span className="text-gray-300 font-mono">{item.subjectType.replace("_", " ")}</span>
                </div>
              )}
              <div>
                <span className="text-gray-600">AI auto </span>
                <span className="text-gray-300 font-mono">{item.aiAutoMode === false ? "off" : "on"}</span>
              </div>
            </div>
            {item.customSubjectDescription && (
              <p className="mt-1 text-gray-400 text-xs italic">"{item.customSubjectDescription}"</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 text-sm pt-1 border-t border-gray-800">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">Created</p>
            <p className="text-gray-400">{new Date(item.createdAt).toLocaleString()}</p>
          </div>
          {item.approvedAt && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Approved</p>
              <p className="text-green-400">{new Date(item.approvedAt).toLocaleString()}</p>
            </div>
          )}
          {item.rejectedAt && (
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Rejected</p>
              <p className="text-red-400">{new Date(item.rejectedAt).toLocaleString()}</p>
            </div>
          )}
        </div>

        {item.notes && (
          <div className="pt-1 border-t border-gray-800">
            <p className="text-xs text-gray-500 mb-1">Notes / error</p>
            <p className="text-red-300 text-xs font-mono whitespace-pre-wrap break-all">{item.notes}</p>
          </div>
        )}
      </div>

      {/* Approve / Reject — only for IN_REVIEW */}
      {isInReview && !actionDone && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Review action</h2>
          {showReject ? (
            <div className="space-y-3">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Rejection reason (optional)"
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-red-700 resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={actionLoading}
                  className="flex-1 bg-red-800 hover:bg-red-700 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                >
                  {actionLoading ? "Rejecting..." : "Confirm Reject"}
                </button>
                <button
                  onClick={() => { setShowReject(false); setNote(""); }}
                  className="px-4 py-2 border border-gray-700 text-gray-400 hover:text-white rounded-lg text-sm transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {actionLoading ? "Approving..." : "Approve"}
              </button>
              <button
                onClick={() => setShowReject(true)}
                disabled={actionLoading}
                className="flex-1 bg-red-900 hover:bg-red-800 disabled:opacity-50 text-white py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Reject
              </button>
            </div>
          )}
        </div>
      )}

      {/* Version history */}
      {versions.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-gray-300 mb-4">Version history</h2>
          <div className="space-y-2">
            {versions.map((v) => (
              <div key={v.id} className="flex items-center gap-3 text-sm text-gray-400">
                <span className="text-gray-600 font-mono text-xs w-6">v{v.versionNumber}</span>
                <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[v.status]}`}>{v.status}</span>
                {v.reason && <span className="text-gray-600 text-xs">{v.reason}</span>}
                <span className="text-gray-700 text-xs ml-auto">{new Date(v.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
