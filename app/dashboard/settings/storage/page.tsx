"use client";

// Henry 2026-06-17: front-end storage monitor + finished-video gallery.
// See disk/temp usage, reclaim temp space (Clean temp — safely skips active renders),
// and browse/play finished videos (the planner only shows a video if you watched it finish).

import { useEffect, useState, useCallback, useRef } from "react";

interface StorageInfo {
  disk: { totalGB: number; freeGB: number; usedPct: number | null };
  video: { finishedCount: number; assembledBytes: number; tempBytes: number; tempFolders: number };
  recentVideos: Array<{ name: string; url: string; thumbnailUrl: string | null; sizeMB: number; mtime: number }>;
}

type StorageProviderKind = "local" | "r2";

const GB = (b: number) => (b / 1e9).toFixed(2) + " GB";

export default function StoragePage() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [msg, setMsg] = useState("");

  // Henry 2026-07-17: in-app cloud storage (R2) on/off toggle — no .env edit, no redeploy.
  // See src/lib/storage/index.ts getStorage() for the runtime selection logic.
  const [provider, setProvider] = useState<StorageProviderKind | null>(null);
  const [providerSaving, setProviderSaving] = useState<StorageProviderKind | null>(null);
  const [providerMsg, setProviderMsg] = useState("");

  useEffect(() => {
    fetch("/api/settings/storage").then(r => r.json()).then(d => setProvider(d.provider)).catch(() => {});
  }, []);

  async function switchProvider(next: StorageProviderKind) {
    if (next === provider || providerSaving) return;
    setProviderSaving(next); setProviderMsg("");
    try {
      const r = await fetch("/api/settings/storage", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: next }),
      });
      const d = await r.json();
      if (!r.ok) { setProviderMsg(d.error || "Failed to switch storage provider."); return; }
      setProvider(d.provider);
      setProviderMsg(
        d.provider === "r2"
          ? "Switched to Cloud (R2). New uploads go to R2 immediately — no restart needed."
          : "Switched to Local disk. New uploads go to the server's local disk immediately — no restart needed."
      );
    } catch {
      setProviderMsg("Network error — storage provider unchanged.");
    } finally {
      setProviderSaving(null);
    }
  }
  // Henry 2026-06-17: multi-select for collective delete.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const lastIdxRef = useRef<number | null>(null);
  // Click a checkbox: plain = toggle one; Shift+click = select the whole range from the last click.
  function clickSelect(index: number, name: string, shift: boolean) {
    const vids = info?.recentVideos ?? [];
    if (shift && lastIdxRef.current !== null) {
      const [a, b] = [lastIdxRef.current, index].sort((x, y) => x - y);
      setSelected(prev => { const n = new Set(prev); for (let i = a; i <= b; i++) { const vn = vids[i]?.name; if (vn) n.add(vn); } return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); if (n.has(name)) n.delete(name); else n.add(name); return n; });
    }
    lastIdxRef.current = index;
  }
  const selectAll = () => setSelected(new Set((info?.recentVideos ?? []).map(v => v.name)));
  const clearSel = () => { setSelected(new Set()); lastIdxRef.current = null; };
  async function deleteSelected() {
    const names = Array.from(selected);
    if (names.length === 0) return;
    if (!confirm(`Permanently delete ${names.length} video(s) from the server? This frees disk and cannot be undone.`)) return;
    setBulkDeleting(true); setMsg("");
    try {
      const r = await fetch("/api/admin/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-video", names }) });
      const d = await r.json();
      setMsg(d.ok ? `Deleted ${d.deleted} video(s) — freed ${d.freedMB} MB.` : (d.error || "Delete failed"));
      setInfo(prev => prev ? { ...prev, recentVideos: prev.recentVideos.filter(v => !selected.has(v.name)) } : prev);
      clearSel();
    } catch { setMsg("Bulk delete failed."); }
    setBulkDeleting(false);
  }

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/admin/storage").then(r => r.json()).then(d => { setInfo(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  async function cleanTemp() {
    setCleaning(true); setMsg("");
    try {
      const r = await fetch("/api/admin/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "clean-temp" }) });
      const d = await r.json();
      setMsg(d.ok ? `Cleaned ${d.deleted} leftover render folder(s) — freed ${d.freedMB} MB. Kept ${d.keptActive} active render(s).` : (d.error || "Failed"));
      load();
    } catch { setMsg("Clean failed."); }
    setCleaning(false);
  }

  async function deleteVideo(name: string) {
    if (!confirm(`Permanently delete this video from the server?\n${name}\nThis frees disk space and cannot be undone.`)) return;
    setMsg("");
    try {
      const r = await fetch("/api/admin/storage", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete-video", name }) });
      const d = await r.json();
      setMsg(d.ok ? `Deleted — freed ${d.freedMB} MB.` : (d.error || "Delete failed"));
      // remove from view immediately
      setInfo(prev => prev ? { ...prev, recentVideos: prev.recentVideos.filter(v => v.name !== name) } : prev);
    } catch { setMsg("Delete failed."); }
  }

  const card: React.CSSProperties = { background: "#12101c", border: "1px solid #2a2440", borderRadius: 12, padding: 16 };
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: "#e8e8f0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Storage</h1>
      <p style={{ fontSize: 12, color: "#9a9ab0", marginBottom: 18 }}>Monitor disk usage, clear leftover render scraps, and browse your finished videos.</p>

      <div style={{ ...card, marginBottom: 18 }}>
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>Storage location</p>
        <p style={{ fontSize: 11, color: "#9a9ab0", marginBottom: 12 }}>
          Where new uploads and generated media are written. Switching takes effect immediately — no restart.
          {provider === "r2" && " If Cloudflare R2 credentials aren't set on the server, uploads will fail until they are."}
        </p>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {(["local", "r2"] as const).map(kind => {
            const active = provider === kind;
            const isSavingThis = providerSaving === kind;
            return (
              <button
                key={kind}
                onClick={() => switchProvider(kind)}
                disabled={provider === null || providerSaving !== null}
                style={{
                  padding: "9px 18px", borderRadius: 9, fontSize: 12, fontWeight: 700, cursor: provider === null || providerSaving !== null ? "not-allowed" : "pointer",
                  background: active ? "#7c5cff" : "transparent",
                  color: active ? "#fff" : "#c8c8d8",
                  border: `1px solid ${active ? "#7c5cff" : "#2a2440"}`,
                  opacity: providerSaving !== null && !isSavingThis ? 0.5 : 1,
                }}
              >
                {kind === "local" ? "Local disk" : "Cloud (R2)"}{isSavingThis ? "…" : active ? " (active)" : ""}
              </button>
            );
          })}
          {provider === null && <span style={{ fontSize: 11, color: "#9a9ab0" }}>Loading…</span>}
        </div>
        {providerMsg && <p style={{ fontSize: 11, color: providerMsg.startsWith("Switched") ? "#9be8b4" : "#ff8a8a", marginTop: 10 }}>{providerMsg}</p>}
      </div>

      {loading && <p style={{ color: "#9a9ab0" }}>Loading…</p>}

      {info && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: 12, marginBottom: 16 }}>
            <div style={card}><p style={{ fontSize: 10, color: "#9a9ab0" }}>Disk free</p><p style={{ fontSize: 22, fontWeight: 800 }}>{info.disk.freeGB} GB</p><p style={{ fontSize: 10, color: "#9a9ab0" }}>of {info.disk.totalGB} GB ({info.disk.usedPct}% used)</p></div>
            <div style={card}><p style={{ fontSize: 10, color: "#9a9ab0" }}>Finished videos</p><p style={{ fontSize: 22, fontWeight: 800 }}>{info.video.finishedCount}</p><p style={{ fontSize: 10, color: "#9a9ab0" }}>{GB(info.video.assembledBytes)}</p></div>
            <div style={card}>
              <p style={{ fontSize: 10, color: "#9a9ab0" }}>Render temp (reclaimable)</p>
              <p style={{ fontSize: 22, fontWeight: 800 }}>{GB(info.video.tempBytes)}</p>
              <p style={{ fontSize: 10, color: "#9a9ab0" }}>{info.video.tempFolders} folder(s)</p>
            </div>
          </div>

          <div style={{ ...card, marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 700 }}>Clear render temp</p>
              <p style={{ fontSize: 11, color: "#9a9ab0" }}>Deletes leftover clips from finished renders. Safely skips anything rendering right now (touched in the last hour).</p>
            </div>
            <button onClick={cleanTemp} disabled={cleaning}
              style={{ padding: "9px 18px", borderRadius: 9, border: "none", background: cleaning ? "#444" : "#7c5cff", color: "#fff", fontWeight: 700, fontSize: 12, cursor: cleaning ? "not-allowed" : "pointer" }}>
              {cleaning ? "Cleaning…" : "Clean temp"}
            </button>
          </div>
          {msg && <p style={{ fontSize: 12, color: "#9be8b4", marginBottom: 16 }}>{msg}</p>}

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Your finished videos ({info.recentVideos.length} most recent)</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button onClick={selectAll} style={{ fontSize: 11, color: "#9a9ab0", background: "none", border: "1px solid #2a2440", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Select all</button>
              <button onClick={clearSel} style={{ fontSize: 11, color: "#9a9ab0", background: "none", border: "1px solid #2a2440", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Clear</button>
              <button onClick={deleteSelected} disabled={selected.size === 0 || bulkDeleting}
                style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: selected.size === 0 ? "#3a2a2a" : "#c0392b", border: "none", borderRadius: 6, padding: "4px 12px", cursor: selected.size === 0 ? "not-allowed" : "pointer" }}>
                {bulkDeleting ? "Deleting…" : `Delete selected (${selected.size})`}
              </button>
              <button onClick={load} style={{ fontSize: 11, color: "#9a9ab0", background: "none", border: "1px solid #2a2440", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Refresh</button>
            </div>
          </div>
          <p style={{ fontSize: 10, color: "#9a9ab0", marginBottom: 8 }}>Tick to select. Hold <b>Shift</b> and click to select a range. Then <b>Delete selected</b> removes them from the server.</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12 }}>
            {info.recentVideos.length === 0 && <p style={{ fontSize: 12, color: "#9a9ab0" }}>No finished videos yet.</p>}
            {info.recentVideos.map((v, i) => {
              const isSel = selected.has(v.name);
              return (
              <div key={v.name} style={{ ...card, border: isSel ? "1px solid #7c5cff" : "1px solid #2a2440", background: isSel ? "#1a1430" : "#12101c" }}>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#c8c8d8", marginBottom: 6, cursor: "pointer", userSelect: "none" }}
                  onClick={e => { e.preventDefault(); clickSelect(i, v.name, (e as React.MouseEvent).shiftKey); }}>
                  <input type="checkbox" readOnly checked={isSel} style={{ accentColor: "#7c5cff", cursor: "pointer" }} />
                  Select
                </label>
                <video src={v.url} poster={v.thumbnailUrl ?? undefined} controls preload="none"
                  style={{ width: "100%", borderRadius: 8, background: "#000", aspectRatio: "16/9" }} />
                <p style={{ fontSize: 10, color: "#c8c8d8", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</p>
                <p style={{ fontSize: 9, color: "#8a8aa0", marginTop: 2 }}>{v.mtime ? new Date(v.mtime).toLocaleString() : ""}</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                  <span style={{ fontSize: 9, color: "#9a9ab0" }}>{v.sizeMB} MB</span>
                  <span style={{ display: "flex", gap: 8 }}>
                    <a href={v.url} download style={{ fontSize: 9, color: "#7c5cff", textDecoration: "none" }}>Download</a>
                    <button onClick={() => deleteVideo(v.name)}
                      style={{ fontSize: 9, color: "#ff8a8a", background: "none", border: "1px solid #5a2a2a", borderRadius: 5, padding: "2px 8px", cursor: "pointer", fontWeight: 700 }}>
                      Delete
                    </button>
                  </span>
                </div>
              </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
