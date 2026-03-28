"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem, ContentStatus } from "@/types/content";

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

export default function RegistryPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentStatus | "">("");

  async function fetchItems() {
    setLoading(true);
    const url = filter ? `/api/registry?status=${filter}` : "/api/registry";
    const res = await fetch(url);
    const data = await res.json();
    setItems(data.items ?? []);
    setLoading(false);
  }

  useEffect(() => { fetchItems(); }, [filter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Content Registry</h1>
        <div className="flex gap-3 items-center">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ContentStatus | "")}
            className="bg-gray-900 border border-gray-700 text-gray-300 text-sm rounded-lg px-3 py-2 focus:outline-none"
          >
            <option value="">All statuses</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="FAILED">Failed</option>
            <option value="PENDING">Pending</option>
            <option value="PUBLISHED">Published</option>
          </select>
          <button
            onClick={fetchItems}
            className="text-sm text-gray-400 hover:text-white border border-gray-700 px-3 py-2 rounded-lg transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading && <p className="text-gray-500">Loading...</p>}

      {!loading && items.length === 0 && (
        <div className="text-center py-16 text-gray-600">
          <p className="text-lg">No content items found.</p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-800">
              <th className="pb-3 pr-4 font-medium">ID</th>
              <th className="pb-3 pr-4 font-medium">Input</th>
              <th className="pb-3 pr-4 font-medium">Status</th>
              <th className="pb-3 pr-4 font-medium">Destination</th>
              <th className="pb-3 pr-4 font-medium">Providers</th>
              <th className="pb-3 pr-4 font-medium">Created</th>
              <th className="pb-3 font-medium">Error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {items.map((item) => (
              <>
                <tr
                  key={item.id}
                  className="text-gray-300 hover:text-white transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/content/${item.id}`)}
                >
                  <td className="py-3 pr-4 font-mono text-xs text-gray-500">{item.id.slice(0, 8)}...</td>
                  <td className="py-3 pr-4 max-w-xs truncate">{item.originalInput}</td>
                  <td className="py-3 pr-4">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-400">
                    {item.destinationPage ? (
                      <span title={item.destinationPage.handle ?? ""}>
                        {item.destinationPage.name}
                        <span className="text-gray-600 ml-1">({item.destinationPage.platform})</span>
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-500">
                    {(() => {
                      const videoDisplay =
                        item.requestedVideoProvider && item.requestedVideoProvider !== item.videoProvider
                          ? `${item.requestedVideoProvider}→${item.videoProvider ?? "?"}`
                          : item.videoProvider;
                      return [videoDisplay, item.voiceProvider, item.musicProvider]
                        .filter(Boolean)
                        .join(" / ") || "—";
                    })()}
                  </td>
                  <td className="py-3 pr-4 text-xs text-gray-500">
                    {new Date(item.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 text-xs">
                    {item.status === "FAILED" && item.notes ? (
                      <span className="text-red-400 font-mono truncate max-w-[180px] block" title={item.notes}>
                        {item.notes.length > 60 ? item.notes.slice(0, 60) + "…" : item.notes}
                      </span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                </tr>

              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
