"use client";

import { useEffect, useState } from "react";

interface Asset {
  id: string;
  type: "image" | "video" | "music" | "sfx" | "actor";
  name: string;
  description: string;
  filePath: string;
  tags: string[];
  source: string;
  createdAt: string;
}

interface AssetPickerProps {
  type: "image" | "video" | "music" | "sfx" | "actor";
  open: boolean;
  onClose: () => void;
  onSelect: (asset: Asset) => void;
  title?: string;
}

export default function AssetPicker({ type, open, onClose, onSelect, title }: AssetPickerProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const params = new URLSearchParams({ type });
    if (search) params.set("search", search);
    fetch(`/api/assets?${params}`)
      .then(r => r.json())
      .then(d => setAssets(d.assets ?? []))
      .finally(() => setLoading(false));
  }, [open, type, search]);

  if (!open) return null;

  const TYPE_ICONS: Record<string, string> = { image: "🖼", video: "🎬", music: "🎵", sfx: "💥", actor: "🎭" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-[#12121e] border border-[#2a2a40] rounded-2xl w-[90%] max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#2a2a40]">
          <div className="flex items-center gap-2">
            <span className="text-lg">{TYPE_ICONS[type]}</span>
            <h2 className="text-sm font-semibold text-white">{title ?? `Pick ${type}`}</h2>
          </div>
          <button onClick={onClose} className="text-[#6060a0] hover:text-white text-lg">✕</button>
        </div>

        {/* Search */}
        <div className="px-5 py-2 border-b border-[#1a1a2e]">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${type}s...`}
            className="w-full bg-[#0a0a18] border border-[#2a2a40] text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#7c5cfc]"
          />
        </div>

        {/* Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-[#6060a0] text-center py-8 text-xs">Loading...</p>}

          {!loading && assets.length === 0 && (
            <div className="text-center py-12">
              <p className="text-[#6060a0] text-sm">No {type}s in library yet</p>
              <p className="text-[#404060] text-[10px] mt-1">Generate or upload content first — it saves automatically.</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            {assets.map(a => (
              <button
                key={a.id}
                onClick={() => { onSelect(a); onClose(); }}
                className="bg-[#0a0a18] border border-[#1a1a2e] rounded-lg overflow-hidden hover:border-[#7c5cfc] transition-colors text-left"
              >
                <div className="h-20 bg-[#080818] flex items-center justify-center">
                  {type === "image" || type === "actor" ? (
                    <img src={`/api/media/${a.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{TYPE_ICONS[type]}</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-[10px] text-white truncate">{a.name}</p>
                  <p className="text-[8px] text-[#6060a0] truncate">{a.source}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
