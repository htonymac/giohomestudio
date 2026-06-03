"use client";
// Henry 2026-06-03 (Sonnet audit Fix #10): Storage Cleanup page.
// Browse files under storage/<folder>/ — see size + date, delete individual
// files or whole folders. Linked from the children-planner top bar.

import { useState, useEffect } from "react";

type StorageFile = { name: string; path: string; size: number; sizeHuman: string; mtime: number; ext: string };
type FolderData = { folder: string; fileCount: number; totalSize: number; totalSizeHuman: string; files: StorageFile[]; truncated?: boolean };

export default function StorageCleanupPage() {
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState<string | null>(null);
  const [data, setData] = useState<FolderData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetch("/api/storage/list")
      .then(r => r.json())
      .then(d => setFolders(d.folders || []))
      .catch(() => setFolders([]));
  }, []);

  async function loadFolder(folder: string) {
    setActiveFolder(folder);
    setLoading(true);
    setStatus("");
    try {
      const r = await fetch(`/api/storage/list?folder=${encodeURIComponent(folder)}`);
      const d = await r.json() as FolderData;
      setData(d);
    } catch (e) {
      setStatus(`Load error: ${(e as Error).message}`);
    }
    setLoading(false);
  }

  async function deleteFile(filePath: string) {
    if (!activeFolder) return;
    if (!window.confirm(`Delete "${filePath}"? This cannot be undone.`)) return;
    setStatus("Deleting…");
    try {
      const r = await fetch(`/api/storage/delete?folder=${encodeURIComponent(activeFolder)}&path=${encodeURIComponent(filePath)}`, { method: "DELETE" });
      const d = await r.json();
      if (r.ok) {
        setStatus(`Deleted (${d.freedBytes} bytes freed).`);
        loadFolder(activeFolder);
      } else {
        setStatus(`Delete failed: ${d.error || `HTTP ${r.status}`}`);
      }
    } catch (e) {
      setStatus(`Delete error: ${(e as Error).message}`);
    }
  }

  async function deleteAll() {
    if (!activeFolder) return;
    if (!window.confirm(`Delete ALL ${data?.fileCount || 0} files in "${activeFolder}"? This cannot be undone.`)) return;
    setStatus("Bulk deleting…");
    try {
      const r = await fetch(`/api/storage/delete?folder=${encodeURIComponent(activeFolder)}&all=1`, { method: "DELETE" });
      const d = await r.json();
      if (r.ok) {
        setStatus(`Deleted ${d.deleted} files (${(d.freedBytes / 1024 / 1024).toFixed(1)} MB freed).`);
        loadFolder(activeFolder);
      } else {
        setStatus(`Bulk delete failed: ${d.error || `HTTP ${r.status}`}`);
      }
    } catch (e) {
      setStatus(`Bulk delete error: ${(e as Error).message}`);
    }
  }

  return (
    <div style={{ background: "#0e0e10", minHeight: "100vh", padding: "32px", color: "#fff", fontFamily: "system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4 }}>Storage Cleanup</h1>
        <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 24 }}>
          See files under storage/, delete individual files or whole folders. Safe — only files in the allow-list folders can be deleted.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
          {/* Folder list */}
          <div style={{ background: "#151518", border: "1px solid #ffffff15", borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24", textTransform: "uppercase" as const, letterSpacing: 1, marginBottom: 8 }}>Folders</p>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
              {folders.map(f => (
                <button
                  key={f}
                  onClick={() => loadFolder(f)}
                  style={{
                    textAlign: "left" as const,
                    padding: "8px 10px",
                    borderRadius: 6,
                    border: `1px solid ${activeFolder === f ? "#fbbf24" : "#ffffff15"}`,
                    background: activeFolder === f ? "#fbbf2415" : "transparent",
                    color: activeFolder === f ? "#fbbf24" : "#fff",
                    fontSize: 11, fontWeight: 600, cursor: "pointer",
                  }}>
                  {f}
                </button>
              ))}
            </div>
          </div>

          {/* File list */}
          <div style={{ background: "#151518", border: "1px solid #ffffff15", borderRadius: 10, padding: 16, minHeight: 400 }}>
            {!activeFolder ? (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>Pick a folder on the left to see its files.</p>
            ) : loading ? (
              <p style={{ fontSize: 13, color: "#9ca3af" }}>Loading…</p>
            ) : data ? (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap" as const, gap: 8 }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700 }}>{activeFolder}</p>
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>
                      {data.fileCount} files · {data.totalSizeHuman} {data.truncated && "(showing top 500)"}
                    </p>
                  </div>
                  <button
                    onClick={deleteAll}
                    disabled={!data.fileCount}
                    style={{
                      padding: "8px 14px", borderRadius: 6, border: "1px solid #e05353",
                      background: "#e0535320", color: "#ff8a8a", fontSize: 11, fontWeight: 800,
                      cursor: data.fileCount ? "pointer" : "not-allowed",
                      opacity: data.fileCount ? 1 : 0.5,
                    }}>
                    Delete All in Folder
                  </button>
                </div>
                {status && <p style={{ fontSize: 11, color: "#fbbf24", marginBottom: 10 }}>{status}</p>}
                <div style={{ display: "flex", flexDirection: "column" as const, gap: 4, maxHeight: "60vh", overflowY: "auto" as const }}>
                  {data.files.length === 0 && <p style={{ fontSize: 11, color: "#9ca3af" }}>Folder is empty.</p>}
                  {data.files.map(f => (
                    <div key={f.path}
                      style={{ display: "grid", gridTemplateColumns: "1fr 100px 140px 80px", gap: 8, padding: "6px 8px", borderRadius: 4, background: "#0e0e10", fontSize: 11, alignItems: "center" }}>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, color: "#fff" }} title={f.path}>{f.path}</span>
                      <span style={{ color: "#9ca3af", textAlign: "right" as const }}>{f.sizeHuman}</span>
                      <span style={{ color: "#9ca3af", fontSize: 10 }}>{new Date(f.mtime).toLocaleString()}</span>
                      <button
                        onClick={() => deleteFile(f.path)}
                        style={{ padding: "4px 8px", borderRadius: 4, border: "1px solid #e0535340", background: "transparent", color: "#ff8a8a", fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        </div>

        <p style={{ marginTop: 16, fontSize: 10, color: "#9ca3af" }}>
          <a href="/dashboard/children-planner" style={{ color: "#fbbf24" }}>← Back to Children Planner</a>
        </p>
      </div>
    </div>
  );
}
