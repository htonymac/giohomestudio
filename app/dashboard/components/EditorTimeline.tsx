"use client";

// EditorTimeline — a fully self-contained "cut a section out / keep only a
// section / insert a clip or image at the playhead / undo / redo" widget with
// its own video preview + thumbnail filmstrip + draggable START/END handles.
// Droppable into ANY page: it owns its own working-video state + edit history
// internally and only talks to the host page through onChange(videoUrl, videoPath)
// after each successful edit. Built for /dashboard/video-editor (Henry 2026-07-18);
// intended to be reused by video-tools / video-finishing / video-trimmer later.
//
// Engine: /api/editor/trim ("keep"), /api/editor/cut ("cut out"),
// /api/editor/insert (splice clip/image at a timestamp). Uploads for the insert
// row go through /api/upload/video (clips) and /api/upload/logo (images) — NOT
// the same endpoint for both, because /api/upload/logo rejects video mime types.

import { useEffect, useRef, useState } from "react";
import { ds } from "../../../lib/designSystem";
import Card from "../../components/ui/Card";
import { Film } from "../../components/icons";

export interface EditorTimelineProps {
  initialVideoUrl: string | null;
  initialVideoPath: string | null;
  onChange?: (videoUrl: string, videoPath: string) => void;
}

type Snapshot = { videoPath: string; videoUrl: string };

export default function EditorTimeline({ initialVideoUrl, initialVideoPath, onChange }: EditorTimelineProps) {
  // ── Working video (this component's own copy — synced from props, then
  //    self-managed once the user starts editing) ──
  const [videoPath, setVideoPath] = useState<string | null>(initialVideoPath);
  const [videoUrl, setVideoUrl] = useState<string | null>(initialVideoUrl);
  const lastEmitted = useRef<string | null>(null);

  // Sync from the host page ONLY when the host hands us a genuinely NEW video
  // (fresh upload, project load, or an intro/outro edit done elsewhere on the
  // page) — not when the prop change is just an echo of our OWN last onChange.
  useEffect(() => {
    if (initialVideoPath && initialVideoPath !== lastEmitted.current && initialVideoPath !== videoPath) {
      setVideoPath(initialVideoPath);
      setVideoUrl(initialVideoUrl);
      setEditHistory([]);
      setRedoStack([]);
      setTrimStart(0);
      setTrimEnd(0);
      setFilmstrip([]);
      setEditMsg(null);
      lastEmitted.current = null;
    } else if (!initialVideoPath && videoPath) {
      setVideoPath(null);
      setVideoUrl(null);
      setEditHistory([]);
      setRedoStack([]);
      lastEmitted.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialVideoPath, initialVideoUrl]);

  function emit(url: string, path: string) {
    lastEmitted.current = path;
    onChange?.(url, path);
  }

  // ── Video preview + filmstrip ──
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [filmstrip, setFilmstrip] = useState<string[]>([]);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [dragging, setDragging] = useState<"start" | "end" | null>(null);

  function seekPreview(t: number) {
    const v = videoRef.current;
    if (v && Number.isFinite(t)) { v.pause(); v.currentTime = Math.max(0, Math.min(videoDuration || t, t)); }
  }

  // Offscreen-video thumbnail filmstrip — same technique as the video-editor page.
  async function buildFilmstrip(src: string) {
    try {
      const v = document.createElement("video");
      v.src = src; v.muted = true; v.preload = "auto";
      await new Promise<void>((res, rej) => { v.onloadedmetadata = () => res(); v.onerror = () => rej(new Error("thumb load")); });
      const dur = v.duration || 0;
      if (!dur) return;
      const N = 10;
      const canvas = document.createElement("canvas");
      const cw = 160;
      canvas.width = cw;
      canvas.height = Math.max(40, Math.round(cw * ((v.videoHeight || 9) / (v.videoWidth || 16))));
      const ctx = canvas.getContext("2d");
      const shots: string[] = [];
      for (let i = 0; i < N; i++) {
        const t = (dur * (i + 0.5)) / N;
        await new Promise<void>((res) => { v.onseeked = () => res(); v.currentTime = t; });
        if (ctx) { ctx.drawImage(v, 0, 0, canvas.width, canvas.height); shots.push(canvas.toDataURL("image/jpeg", 0.5)); }
      }
      setFilmstrip(shots);
    } catch { /* filmstrip is a nicety; timeline still works without it */ }
  }

  // ── Edit history (undo/redo) — scoped to THIS component's own ops only:
  //    Keep, Cut, Insert. Intro/outro/AI-edit on the host page are a separate
  //    concern; when they land, the host re-supplies a new initialVideoPath and
  //    the sync effect above treats it as a fresh load (this history resets). ──
  const [editHistory, setEditHistory] = useState<Snapshot[]>([]);
  const [redoStack, setRedoStack] = useState<Snapshot[]>([]);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [working, setWorking] = useState<null | "keep" | "cut" | "insert" | "dewatermark" | "replace">(null);
  const [uploadingClip, setUploadingClip] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // ── Remove-watermark controls (/api/editor/dewatermark) ──
  const [dwCorner, setDwCorner] = useState<"br" | "bl" | "tr" | "tl">("br");
  const [dwMode, setDwMode] = useState<"blur" | "cover">("blur");

  // ── Replace-section uploads (/api/editor/replace) ──
  const [uploadingReplaceClip, setUploadingReplaceClip] = useState(false);
  const [uploadingReplaceImage, setUploadingReplaceImage] = useState(false);

  function pushHistory() {
    if (!videoPath || !videoUrl) return;
    setEditHistory(prev => [...prev, { videoPath, videoUrl }]);
    setRedoStack([]);
  }

  function applyResult(outputUrl: string, msg: string) {
    setVideoPath(outputUrl);
    setVideoUrl(outputUrl);
    setTrimStart(0); setTrimEnd(0); setFilmstrip([]);
    setEditMsg(msg);
    emit(outputUrl, outputUrl);
  }

  function handleUndo() {
    setEditHistory(prev => {
      if (!prev.length || !videoPath || !videoUrl) return prev;
      const last = prev[prev.length - 1];
      setRedoStack(r => [...r, { videoPath, videoUrl }]);
      setVideoPath(last.videoPath);
      setVideoUrl(last.videoUrl);
      setTrimStart(0); setTrimEnd(0); setFilmstrip([]);
      setEditMsg("Undo");
      emit(last.videoUrl, last.videoPath);
      return prev.slice(0, -1);
    });
  }

  function handleRedo() {
    setRedoStack(prev => {
      if (!prev.length || !videoPath || !videoUrl) return prev;
      const last = prev[prev.length - 1];
      setEditHistory(h => [...h, { videoPath, videoUrl }]);
      setVideoPath(last.videoPath);
      setVideoUrl(last.videoUrl);
      setTrimStart(0); setTrimEnd(0); setFilmstrip([]);
      setEditMsg("Redo");
      emit(last.videoUrl, last.videoPath);
      return prev.slice(0, -1);
    });
  }

  // ── Keep-only-section (/api/editor/trim) and cut-section-out (/api/editor/cut) ──
  async function handleKeep() {
    if (!videoPath || trimEnd <= trimStart) { setEditMsg("Set valid start/end points first"); return; }
    pushHistory();
    setWorking("keep"); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/trim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, startSec: trimStart, endSec: trimEnd }),
      });
      const data = await res.json();
      if (data.outputUrl) applyResult(data.outputUrl, "Kept the selected section");
      else setEditMsg(data.error || "Keep failed");
    } catch (err) { setEditMsg("Keep failed: " + String(err)); }
    setWorking(null);
  }

  async function handleCutOut() {
    if (!videoPath || trimEnd <= trimStart) { setEditMsg("Set valid start/end points first"); return; }
    pushHistory();
    setWorking("cut"); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/cut", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, startSec: trimStart, endSec: trimEnd }),
      });
      const data = await res.json();
      if (data.outputUrl) applyResult(data.outputUrl, "Cut the selected section out");
      else setEditMsg(data.error || "Cut failed");
    } catch (err) { setEditMsg("Cut failed: " + String(err)); }
    setWorking(null);
  }

  // ── Insert clip/image at the playhead (/api/editor/insert) ──
  async function insertMediaAtPlayhead(mediaUrl: string, isImage: boolean) {
    if (!videoPath) return;
    pushHistory();
    setWorking("insert"); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/insert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, atSec: currentTime, mediaUrl, isImage, duration: isImage ? 3 : undefined }),
      });
      const data = await res.json();
      if (data.outputUrl) applyResult(data.outputUrl, isImage ? "Image inserted at the playhead" : "Clip inserted at the playhead");
      else setEditMsg(data.error || "Insert failed");
    } catch (err) { setEditMsg("Insert failed: " + String(err)); }
    setWorking(null);
  }

  async function handleInsertClipFile(file: File) {
    setUploadingClip(true); setEditMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/video", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) await insertMediaAtPlayhead(data.url, false);
      else setEditMsg(data.error || "Clip upload failed");
    } catch (err) { setEditMsg("Clip upload failed: " + String(err)); }
    setUploadingClip(false);
  }

  async function handleInsertImageFile(file: File) {
    setUploadingImage(true); setEditMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.filePath) {
        const url = `/api/media/${String(data.filePath).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
        await insertMediaAtPlayhead(url, true);
      } else setEditMsg(data.error || "Image upload failed");
    } catch (err) { setEditMsg("Image upload failed: " + String(err)); }
    setUploadingImage(false);
  }

  // ── Remove watermark at a corner/box (/api/editor/dewatermark) ──
  async function handleDewatermark() {
    if (!videoPath) return;
    pushHistory();
    setWorking("dewatermark"); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/dewatermark", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, corner: dwCorner, mode: dwMode }),
      });
      const data = await res.json();
      if (data.outputUrl) applyResult(data.outputUrl, "Watermark removed");
      else setEditMsg(data.error || "Watermark removal failed");
    } catch (err) { setEditMsg("Watermark removal failed: " + String(err)); }
    setWorking(null);
  }

  // ── Replace the selected [trimStart,trimEnd] section with a clip/image (/api/editor/replace) ──
  async function replaceSectionWithMedia(mediaUrl: string, isImage: boolean) {
    if (!videoPath || trimEnd <= trimStart) { setEditMsg("Set valid start/end points first"); return; }
    pushHistory();
    setWorking("replace"); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/replace", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, startSec: trimStart, endSec: trimEnd, mediaUrl, isImage, duration: isImage ? 3 : undefined }),
      });
      const data = await res.json();
      if (data.outputUrl) applyResult(data.outputUrl, isImage ? "Section replaced with image" : "Section replaced with clip");
      else setEditMsg(data.error || "Replace failed");
    } catch (err) { setEditMsg("Replace failed: " + String(err)); }
    setWorking(null);
  }

  async function handleReplaceClipFile(file: File) {
    setUploadingReplaceClip(true); setEditMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/video", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) await replaceSectionWithMedia(data.url, false);
      else setEditMsg(data.error || "Clip upload failed");
    } catch (err) { setEditMsg("Clip upload failed: " + String(err)); }
    setUploadingReplaceClip(false);
  }

  async function handleReplaceImageFile(file: File) {
    setUploadingReplaceImage(true); setEditMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.filePath) {
        const url = `/api/media/${String(data.filePath).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
        await replaceSectionWithMedia(url, true);
      } else setEditMsg(data.error || "Image upload failed");
    } catch (err) { setEditMsg("Image upload failed: " + String(err)); }
    setUploadingReplaceImage(false);
  }

  // ── Draggable START/END handles on the filmstrip track ──
  function onHandlePointerDown(which: "start" | "end") {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      e.stopPropagation();
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(which);
    };
  }
  function onHandlePointerMove(which: "start" | "end") {
    return (e: React.PointerEvent<HTMLDivElement>) => {
      if (dragging !== which || !trackRef.current || !videoDuration) return;
      const r = trackRef.current.getBoundingClientRect();
      const t = Math.max(0, Math.min(videoDuration, ((e.clientX - r.left) / r.width) * videoDuration));
      if (which === "start") {
        const val = Math.round(Math.min(t, Math.max(0, trimEnd - 0.1)) * 10) / 10;
        setTrimStart(val); seekPreview(val);
      } else {
        const val = Math.round(Math.max(t, trimStart + 0.1) * 10) / 10;
        setTrimEnd(val); seekPreview(val);
      }
    };
  }
  function onHandlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    setDragging(null);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* already released */ }
  }

  const busy = working !== null || uploadingClip || uploadingImage || uploadingReplaceClip || uploadingReplaceImage;

  const microLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, letterSpacing: 1.2, textTransform: "uppercase",
    color: ds.color.mute, display: "block", marginBottom: 6, fontFamily: ds.font.mono,
  };
  const ghostBtn: React.CSSProperties = {
    background: "none", color: ds.color.mute, border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.xs, padding: "7px 12px", fontSize: 11, cursor: "pointer",
    textAlign: "left" as const, width: "100%",
  };
  const solidBtn = (bg: string, disabled: boolean): React.CSSProperties => ({
    flex: 1, padding: "8px 14px", borderRadius: 8, border: "none",
    background: disabled ? ds.color.card : bg, color: "#000", fontSize: 12, fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
  });

  if (!videoPath || !videoUrl) return null;

  return (
    <Card style={{ marginTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2 }}>Trim Timeline</h3>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={handleUndo} disabled={!editHistory.length}
            style={{ ...ghostBtn, width: "auto", padding: "5px 10px", fontSize: 10, opacity: editHistory.length ? 1 : 0.4, cursor: editHistory.length ? "pointer" : "not-allowed" }}>
            ↶ Undo
          </button>
          <button onClick={handleRedo} disabled={!redoStack.length}
            style={{ ...ghostBtn, width: "auto", padding: "5px 10px", fontSize: 10, opacity: redoStack.length ? 1 : 0.4, cursor: redoStack.length ? "pointer" : "not-allowed" }}>
            ↷ Redo
          </button>
        </div>
      </div>

      {editMsg && (
        <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: `${ds.color.mint}10`, border: `1px solid ${ds.color.mint}30`, fontSize: 11, color: ds.color.mint }}>
          {editMsg}
        </div>
      )}

      <video
        ref={videoRef}
        src={videoUrl}
        controls
        onLoadedMetadata={e => {
          const dur = e.currentTarget.duration || 0;
          setVideoDuration(dur);
          setTrimStart(0); setTrimEnd(Math.round(dur * 10) / 10);
          setFilmstrip([]);
          if (e.currentTarget.currentSrc) buildFilmstrip(e.currentTarget.currentSrc);
        }}
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        style={{ width: "100%", maxHeight: 260, background: "black", borderRadius: 8, display: "block", marginBottom: 10 }}
      />

      {videoDuration > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div
            ref={trackRef}
            onClick={e => { const r = e.currentTarget.getBoundingClientRect(); const t = ((e.clientX - r.left) / r.width) * videoDuration; seekPreview(t); }}
            style={{ position: "relative", height: 60, background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}
            title="Click to jump the player to this point"
          >
            <div style={{ position: "absolute", inset: 0, display: "flex" }}>
              {(filmstrip.length ? filmstrip : Array(10).fill("")).map((src: string, i: number) => (
                <div key={i} style={{ flex: 1, backgroundImage: src ? `url(${src})` : undefined, backgroundColor: src ? undefined : ds.color.paper, backgroundSize: "cover", backgroundPosition: "center", borderRight: i < 9 ? `1px solid ${ds.color.line2}55` : undefined }} />
              ))}
            </div>
            {trimStart > 0 && <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: `${(trimStart / videoDuration) * 100}%`, background: "rgba(0,0,0,0.6)" }} />}
            {trimEnd < videoDuration && <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: `${((videoDuration - trimEnd) / videoDuration) * 100}%`, background: "rgba(0,0,0,0.6)" }} />}
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(trimStart / videoDuration) * 100}%`, width: `${(Math.max(0, trimEnd - trimStart) / videoDuration) * 100}%`, boxShadow: `inset 0 0 0 2px ${ds.color.mint}`, pointerEvents: "none" }} />
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${(Math.min(currentTime, videoDuration) / videoDuration) * 100}%`, width: 2, background: ds.color.lilac, boxShadow: "0 0 4px rgba(0,0,0,0.6)" }} />
            <span style={{ position: "absolute", left: 6, bottom: 3, fontSize: 9, fontFamily: ds.font.mono, color: "#fff", textShadow: "0 1px 2px #000" }}>
              select {trimStart.toFixed(1)}–{trimEnd.toFixed(1)}s
            </span>

            {/* Draggable START (green) + END (red) handles */}
            <div
              onPointerDown={onHandlePointerDown("start")}
              onPointerMove={onHandlePointerMove("start")}
              onPointerUp={onHandlePointerUp}
              onClick={e => e.stopPropagation()}
              title="Drag to set start"
              style={{ position: "absolute", top: 0, bottom: 0, left: `${(trimStart / videoDuration) * 100}%`, width: 10, marginLeft: -5, cursor: "ew-resize", background: ds.color.mint, boxShadow: "0 0 4px rgba(0,0,0,0.7)", zIndex: 3, touchAction: "none" }}
            />
            <div
              onPointerDown={onHandlePointerDown("end")}
              onPointerMove={onHandlePointerMove("end")}
              onPointerUp={onHandlePointerUp}
              onClick={e => e.stopPropagation()}
              title="Drag to set end"
              style={{ position: "absolute", top: 0, bottom: 0, left: `${(trimEnd / videoDuration) * 100}%`, width: 10, marginLeft: -5, cursor: "ew-resize", background: ds.color.coral, boxShadow: "0 0 4px rgba(0,0,0,0.7)", zIndex: 3, touchAction: "none" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 8, alignItems: "center", marginTop: 8 }}>
            <span style={{ fontSize: 9, color: ds.color.mint, fontFamily: ds.font.mono }}>START</span>
            <input type="range" min={0} max={videoDuration} step={0.1} value={trimStart}
              onChange={e => { const val = Math.min(Number(e.target.value), Math.max(0, trimEnd - 0.1)); setTrimStart(val); seekPreview(val); }} style={{ width: "100%" }} />
            <span style={{ fontSize: 9, color: ds.color.coral, fontFamily: ds.font.mono }}>END</span>
            <input type="range" min={0} max={videoDuration} step={0.1} value={trimEnd}
              onChange={e => { const val = Math.max(Number(e.target.value), trimStart + 0.1); setTrimEnd(val); seekPreview(val); }} style={{ width: "100%" }} />
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button onClick={handleCutOut} disabled={busy || !videoPath} style={solidBtn(ds.color.coral, busy || !videoPath)}>
          {working === "cut" ? "…" : "✂ Cut this section out"}
        </button>
        <button onClick={handleKeep} disabled={busy || !videoPath} style={solidBtn(ds.color.sky, busy || !videoPath)}>
          {working === "keep" ? "…" : "Keep only this section"}
        </button>
        <label style={{
          ...solidBtn(ds.color.lilac, busy || !videoPath || trimEnd <= trimStart),
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: (busy || !videoPath || trimEnd <= trimStart) ? "not-allowed" : "pointer",
        }}>
          {working === "replace" || uploadingReplaceClip || uploadingReplaceImage ? "…" : "🔁 Replace section"}
          <input
            type="file" accept="video/*,image/*" style={{ display: "none" }}
            disabled={busy || !videoPath || trimEnd <= trimStart}
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) { if (f.type.startsWith("image/")) handleReplaceImageFile(f); else handleReplaceClipFile(f); }
              e.currentTarget.value = "";
            }}
          />
        </label>
      </div>

      <label style={microLabel}>Insert at Playhead ({currentTime.toFixed(1)}s)</label>
      <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 8 }}>Splits the video at the current player position and inserts your clip or image there.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <label style={{ ...ghostBtn, width: "auto", display: "flex", alignItems: "center", gap: 6, cursor: (busy || !videoPath) ? "not-allowed" : "pointer", opacity: (busy || !videoPath) ? 0.5 : 1 }}>
          <Film size={11} color={ds.color.mute} />
          {uploadingClip ? "Uploading…" : "Insert clip"}
          <input type="file" accept="video/*" style={{ display: "none" }} disabled={busy || !videoPath}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleInsertClipFile(f); e.currentTarget.value = ""; }} />
        </label>
        <label style={{ ...ghostBtn, width: "auto", display: "flex", alignItems: "center", gap: 6, cursor: (busy || !videoPath) ? "not-allowed" : "pointer", opacity: (busy || !videoPath) ? 0.5 : 1 }}>
          <Film size={11} color={ds.color.mute} />
          {uploadingImage ? "Uploading…" : "Insert image"}
          <input type="file" accept="image/*" style={{ display: "none" }} disabled={busy || !videoPath}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleInsertImageFile(f); e.currentTarget.value = ""; }} />
        </label>
      </div>

      <label style={{ ...microLabel, marginTop: 16 }}>Remove Watermark</label>
      <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 8 }}>Blurs or paints over a burned-in logo/watermark (e.g. an AI generator's) in one corner of the frame.</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
        {(["br", "bl", "tr", "tl"] as const).map(c => (
          <button key={c} onClick={() => setDwCorner(c)} disabled={busy}
            style={{
              ...ghostBtn, width: "auto", padding: "5px 10px", fontSize: 10,
              borderColor: dwCorner === c ? ds.color.mint : ds.color.line2,
              color: dwCorner === c ? ds.color.mint : ds.color.mute,
              cursor: busy ? "not-allowed" : "pointer",
            }}>
            {c.toUpperCase()}
          </button>
        ))}
        <button onClick={() => setDwMode(m => (m === "blur" ? "cover" : "blur"))} disabled={busy}
          style={{ ...ghostBtn, width: "auto", padding: "5px 10px", fontSize: 10, cursor: busy ? "not-allowed" : "pointer" }}>
          Mode: {dwMode === "blur" ? "Blur" : "Cover"}
        </button>
      </div>
      <button onClick={handleDewatermark} disabled={busy || !videoPath} style={solidBtn(ds.color.mint, busy || !videoPath)}>
        {working === "dewatermark" ? "…" : "Apply watermark removal"}
      </button>
    </Card>
  );
}
