"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { ContentItem, ContentStatus } from "@/types/content";
import HeroTitle from "../../components/hero/HeroTitle";
import { ds } from "../../../lib/designSystem";

const STATUS_COLORS: Record<ContentStatus, { bg: string; text: string }> = {
  PENDING:          { bg: `${ds.color.mute2}20`,   text: ds.color.mute2 },
  ENHANCING:        { bg: `${ds.color.sky}18`,      text: ds.color.sky },
  GENERATING_VIDEO: { bg: `${ds.color.magenta}18`,  text: ds.color.magenta },
  GENERATING_VOICE: { bg: `${ds.color.lilac}18`,    text: ds.color.lilac },
  GENERATING_MUSIC: { bg: `${ds.color.pink}18`,     text: ds.color.pink },
  MERGING:          { bg: `${ds.color.gold}18`,      text: ds.color.gold },
  IN_REVIEW:        { bg: `${ds.color.gold}18`,      text: ds.color.gold },
  APPROVED:         { bg: `${ds.color.mint}18`,      text: ds.color.mint },
  REJECTED:         { bg: "#dc262620",              text: "#dc2626" },
  FAILED:           { bg: "#ef444420",              text: "#ef4444" },
  PUBLISHED:        { bg: `${ds.color.sky}18`,      text: ds.color.sky },
  ARCHIVED:         { bg: `${ds.color.mute2}15`,    text: ds.color.mute2 },
};

const PAGE_SIZE = 25;

const inputStyle: React.CSSProperties = {
  background: ds.color.card,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm,
  color: ds.color.ink,
  fontSize: 13,
  padding: "8px 12px",
  outline: "none",
  fontFamily: ds.font.sans,
};

const btnStyle: React.CSSProperties = {
  fontSize: 12, padding: "7px 12px", borderRadius: ds.radius.sm,
  border: `1px solid ${ds.color.line2}`,
  background: ds.color.card, color: ds.color.mute,
  cursor: "pointer", fontFamily: ds.font.sans,
};

export default function RegistryPage() {
  const router = useRouter();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ContentStatus | "">("");
  const [modeFilter, setModeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filter) params.set("status", filter);
    if (modeFilter) params.set("mode", modeFilter);
    if (search) params.set("search", search);
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(page * PAGE_SIZE));
    const res = await fetch(`/api/registry?${params}`);
    const data = await res.json();
    setItems(data.items ?? []);
    setTotal(data.total ?? 0);
    setSelected(new Set());
    setLoading(false);
  }, [filter, modeFilter, search, page]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const allSelected = items.length > 0 && selected.size === items.length;
  const someSelected = selected.size > 0;

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(items.map(i => i.id)));
  }
  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    if (!someSelected) return;
    const count = selected.size;
    if (!confirm(`Delete ${count} item${count > 1 ? "s" : ""}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch("/api/registry/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected) }),
      });
      await fetchItems();
    } finally {
      setDeleting(false);
    }
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(0);
    setSearch(searchInput);
  }

  const selectStyle: React.CSSProperties = {
    ...inputStyle, padding: "7px 10px", fontSize: 12,
  };

  return (
    <div style={{ fontFamily: ds.font.sans }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
        <HeroTitle kicker="Content Archive" title="All" italic="Content" sub="Every generated image, video, and audio across all modes" />
        <span style={{
          fontSize: 11, padding: "4px 10px", borderRadius: 999,
          background: `${ds.color.lilac}18`, color: ds.color.lilac,
          border: `1px solid ${ds.color.lilac}33`,
          fontFamily: ds.font.mono, fontWeight: 700, alignSelf: "flex-start", marginTop: 8,
        }}>{total} items</span>
      </div>

      {/* Search + filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 6, flex: 1, minWidth: 200 }}>
          <input
            type="text" value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search by input text..."
            style={{ ...inputStyle, flex: 1 }}
          />
          <button type="submit" style={btnStyle}>Search</button>
          {search && (
            <button type="button" onClick={() => { setSearchInput(""); setSearch(""); setPage(0); }}
              style={{ ...btnStyle, color: ds.color.mute2 }}>
              Clear
            </button>
          )}
        </form>

        <select value={modeFilter} onChange={e => { setModeFilter(e.target.value); setPage(0); }} style={selectStyle}>
          <option value="">All modes</option>
          <option value="FREE">Free Mode</option>
          <option value="COMMERCIAL">Commercial</option>
        </select>

        <select value={filter} onChange={e => { setFilter(e.target.value as ContentStatus | ""); setPage(0); }} style={selectStyle}>
          <option value="">All statuses</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="FAILED">Failed</option>
          <option value="PENDING">Pending</option>
          <option value="PUBLISHED">Published</option>
        </select>

        {someSelected && (
          <button onClick={deleteSelected} disabled={deleting}
            style={{ ...btnStyle, background: "#2a0a0a", color: "#f87171", borderColor: "#4a1a1a", opacity: deleting ? 0.5 : 1 }}>
            {deleting ? "Deleting..." : `Delete ${selected.size}`}
          </button>
        )}

        <button onClick={fetchItems} style={btnStyle}>Refresh</button>
      </div>

      {loading && <p style={{ color: ds.color.mute, fontFamily: ds.font.mono, fontSize: 12 }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <div style={{ textAlign: "center", padding: "64px 0" }}>
          <p style={{ fontSize: 16, color: ds.color.mute }}>No content items found.</p>
          {(search || filter || modeFilter) && (
            <button
              onClick={() => { setSearch(""); setSearchInput(""); setFilter(""); setModeFilter(""); setPage(0); }}
              style={{ ...btnStyle, marginTop: 8, color: ds.color.gold, borderColor: `${ds.color.gold}44`, background: `${ds.color.gold}10` }}>
              Clear all filters
            </button>
          )}
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", borderBottom: `1px solid ${ds.color.line2}` }}>
                  {["", "Input", "Mode", "Status", "Destination", "Providers", "Date of Production", "Error"].map((h, i) => (
                    <th key={i} style={{ paddingBottom: 10, paddingRight: i < 7 ? 14 : 0, fontWeight: 600, color: ds.color.mute, fontFamily: ds.font.mono, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", width: i === 0 ? 32 : undefined }}>
                      {i === 0
                        ? <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ accentColor: ds.color.lilac, cursor: "pointer" }} title="Select all" />
                        : h
                      }
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => (
                  <tr key={item.id} style={{
                    borderBottom: `1px solid ${ds.color.line}`,
                    background: selected.has(item.id) ? `${ds.color.lilac}08` : "transparent",
                  }}>
                    <td style={{ padding: "10px 14px 10px 0" }} onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleOne(item.id)} style={{ accentColor: ds.color.lilac, cursor: "pointer" }} />
                    </td>
                    <td style={{ padding: "10px 14px 10px 0", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: ds.color.ink2, cursor: "pointer" }}
                      onClick={() => router.push(`/dashboard/content/${item.id}`)}>
                      {item.originalInput}
                    </td>
                    <td style={{ padding: "10px 14px 10px 0" }}>
                      <span style={{
                        fontSize: 9, fontWeight: 700, padding: "2px 6px", borderRadius: ds.radius.xs,
                        fontFamily: ds.font.mono,
                        background: item.mode === "COMMERCIAL" ? `${ds.color.gold}20` : `${ds.color.sky}18`,
                        color: item.mode === "COMMERCIAL" ? ds.color.gold : ds.color.sky,
                      }}>
                        {item.mode}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px 10px 0" }}>
                      <span style={{
                        padding: "3px 8px", borderRadius: 20, fontSize: 10, fontWeight: 600,
                        fontFamily: ds.font.mono,
                        background: STATUS_COLORS[item.status]?.bg ?? ds.color.mute2,
                        color: STATUS_COLORS[item.status]?.text ?? ds.color.ink,
                      }}>
                        {item.status}
                      </span>
                    </td>
                    <td style={{ padding: "10px 14px 10px 0", fontSize: 11, color: ds.color.mute }}>
                      {item.destinationPage ? (
                        <span title={item.destinationPage.handle ?? ""}>
                          {item.destinationPage.name}
                          <span style={{ color: ds.color.mute2, marginLeft: 4 }}>({item.destinationPage.platform})</span>
                        </span>
                      ) : <span style={{ color: ds.color.mute2 }}>-</span>}
                    </td>
                    <td style={{ padding: "10px 14px 10px 0", fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>
                      {[item.videoProvider, item.voiceProvider, item.musicSource].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td style={{ padding: "10px 14px 10px 0", fontSize: 10, color: ds.color.mute, whiteSpace: "nowrap", fontFamily: ds.font.mono }}>
                      {new Date(item.createdAt).toLocaleDateString()}{" "}
                      <span style={{ color: ds.color.mute2 }}>{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </td>
                    <td style={{ padding: "10px 0" }}>
                      {item.status === "FAILED" && item.notes ? (
                        <span style={{ color: "#f87171", fontFamily: ds.font.mono, fontSize: 10, display: "block", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={item.notes}>
                          {item.notes.length > 50 ? item.notes.slice(0, 50) + "..." : item.notes}
                        </span>
                      ) : <span style={{ color: ds.color.mute2 }}>-</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTop: `1px solid ${ds.color.line2}` }}>
              <span style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono }}>
                Page {page + 1} of {totalPages} ({total} items)
              </span>
              <div style={{ display: "flex", gap: 4 }}>
                <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                  style={{ ...btnStyle, opacity: page === 0 ? 0.3 : 1, fontSize: 11 }}>
                  Prev
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  const p = totalPages <= 7 ? i : Math.max(0, Math.min(totalPages - 7, page - 3)) + i;
                  return (
                    <button key={p} onClick={() => setPage(p)}
                      style={{
                        ...btnStyle, fontSize: 11,
                        borderColor: p === page ? ds.color.lilac : ds.color.line2,
                        background:  p === page ? `${ds.color.lilac}18` : ds.color.card,
                        color:       p === page ? ds.color.lilac : ds.color.mute,
                      }}>
                      {p + 1}
                    </button>
                  );
                })}
                <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                  style={{ ...btnStyle, opacity: page >= totalPages - 1 ? 0.3 : 1, fontSize: 11 }}>
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
