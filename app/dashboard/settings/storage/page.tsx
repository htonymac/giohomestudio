"use client";

// Henry 2026-06-17: front-end storage monitor + finished-video gallery.
// See disk/temp usage, reclaim temp space (Clean temp — safely skips active renders),
// and browse/play finished videos (the planner only shows a video if you watched it finish).

import { useEffect, useState, useCallback } from "react";

interface StorageInfo {
  disk: { totalGB: number; freeGB: number; usedPct: number | null };
  video: { finishedCount: number; assembledBytes: number; tempBytes: number; tempFolders: number };
  recentVideos: Array<{ name: string; url: string; thumbnailUrl: string | null; sizeMB: number; mtime: number }>;
}

const GB = (b: number) => (b / 1e9).toFixed(2) + " GB";

export default function StoragePage() {
  const [info, setInfo] = useState<StorageInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);
  const [msg, setMsg] = useState("");

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

  const card: React.CSSProperties = { background: "#12101c", border: "1px solid #2a2440", borderRadius: 12, padding: 16 };
  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, color: "#e8e8f0" }}>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>Storage</h1>
      <p style={{ fontSize: 12, color: "#9a9ab0", marginBottom: 18 }}>Monitor disk usage, clear leftover render scraps, and browse your finished videos.</p>

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

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700 }}>Your finished videos ({info.recentVideos.length} most recent)</h2>
            <button onClick={load} style={{ fontSize: 11, color: "#9a9ab0", background: "none", border: "1px solid #2a2440", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>Refresh</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 12 }}>
            {info.recentVideos.length === 0 && <p style={{ fontSize: 12, color: "#9a9ab0" }}>No finished videos yet.</p>}
            {info.recentVideos.map(v => (
              <div key={v.name} style={card}>
                <video src={v.url} poster={v.thumbnailUrl ?? undefined} controls preload="none"
                  style={{ width: "100%", borderRadius: 8, background: "#000", aspectRatio: "16/9" }} />
                <p style={{ fontSize: 10, color: "#c8c8d8", marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.name}</p>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 2 }}>
                  <span style={{ fontSize: 9, color: "#9a9ab0" }}>{v.sizeMB} MB</span>
                  <a href={v.url} download style={{ fontSize: 9, color: "#7c5cff", textDecoration: "none" }}>Download</a>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
