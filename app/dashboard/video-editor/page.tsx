"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import OverlayPanel from "../../components/OverlayPanel";
import EditorTimeline from "../components/EditorTimeline";
import SFXPicker from "../../components/SFXPicker";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import type { OverlayLayer } from "@/modules/ffmpeg/overlay";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import Card from "../../components/ui/Card";
import ButtonPrimary from "../../components/ui/ButtonPrimary";
import { Folder, Wand, Film, Music, X, Check } from "../../components/icons";
import ModelChip from "../../components/ModelChip";
import { safeJson } from "../../../lib/api-utils";

function VideoEditorInner() {
  const searchParams = useSearchParams();
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [overlayLayers, setOverlayLayers] = useState<OverlayLayer[]>([]);

  // ── Video-aware timing (text should know how long the video is) ──
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoDims, setVideoDims] = useState({ w: 1920, h: 1080 });
  const [currentTime, setCurrentTime] = useState(0);
  // Default text window = the whole video (rounded to 0.1s); 5s fallback before metadata loads.
  const wholeVideo = videoDuration > 0 ? Math.round(videoDuration * 10) / 10 : 5;

  // The displayed video IMAGE rect inside the <video> element (letterbox/pillarbox aware).
  // Text must be positioned + scaled against THIS rect — not the player box — or a portrait
  // clip renders the preview text over the black side bars at the wrong size.
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoRect, setVideoRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null);
  function measureVideoRect() {
    const v = videoRef.current;
    if (!v || !v.videoWidth || !v.videoHeight) return;
    const cw = v.clientWidth, ch = v.clientHeight;
    const s = Math.min(cw / v.videoWidth, ch / v.videoHeight);
    const w = v.videoWidth * s, h = v.videoHeight * s;
    setVideoRect({ left: (cw - w) / 2, top: (ch - h) / 2, width: w, height: h });
  }
  useEffect(() => {
    window.addEventListener("resize", measureVideoRect);
    return () => window.removeEventListener("resize", measureVideoRect);
  }, []);

  // ── Post-assembly trim / intro / outro (FIX 3) ──
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [introText, setIntroText] = useState("");
  const [introDuration, setIntroDuration] = useState(3);
  const [outroText, setOutroText] = useState("");
  const [outroDuration, setOutroDuration] = useState(3);
  const [trimming, setTrimming] = useState(false);
  const [addingIntro, setAddingIntro] = useState(false);
  const [addingOutro, setAddingOutro] = useState(false);
  const [trimResult, setTrimResult] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<string | null>(null);
  const [aiEditPrompt, setAiEditPrompt] = useState("");
  const [aiEditing, setAiEditing] = useState(false);
  // Product-image outro (Henry: append a branded product card as the outro)
  const [outroImageUrl, setOutroImageUrl] = useState<string | null>(null);
  const [outroImageName, setOutroImageName] = useState("");
  const [uploadingOutroImg, setUploadingOutroImg] = useState(false);
  // Freeze-last-frame outro (Henry: end of the video becomes the outro background + branding)
  const [outroHeadline, setOutroHeadline] = useState("");
  const [outroSubline, setOutroSubline] = useState("");
  // Outro text decoration (overrides Brand Kit for this outro). "" font = Brand Kit default.
  const [outroFont, setOutroFont] = useState("");
  const [outroHeadColor, setOutroHeadColor] = useState("#FFFFFF");
  const [outroSubColor, setOutroSubColor] = useState("#F5D06B");
  const [outroScale, setOutroScale] = useState(1);
  const outroStyle = () => ({ fontFamily: outroFont || undefined, headlineColor: outroHeadColor, sublineColor: outroSubColor, scale: outroScale });

  // ── Trim timeline preview: a thumbnail filmstrip + scrub-on-drag so the user SEES
  //    the exact frame at the cut and can review the kept range (not a blind bar). ──
  const [filmstrip, setFilmstrip] = useState<string[]>([]);
  const [previewingRange, setPreviewingRange] = useState(false);
  const previewStopRef = useRef<number | null>(null);

  // Scrub the visible preview to a timestamp so dragging a handle shows that frame.
  function seekPreview(t: number) {
    const v = videoRef.current;
    if (v && Number.isFinite(t)) { v.pause(); v.currentTime = Math.max(0, Math.min(videoDuration || t, t)); }
  }

  // Play ONLY the kept range [trimStart, trimEnd] so the user can review the result.
  function playKeptRange() {
    const v = videoRef.current;
    if (!v) return;
    if (previewStopRef.current) { window.clearInterval(previewStopRef.current); previewStopRef.current = null; }
    v.currentTime = trimStart;
    v.play().then(() => setPreviewingRange(true)).catch(() => {});
    previewStopRef.current = window.setInterval(() => {
      if (!videoRef.current) return;
      if (videoRef.current.currentTime >= trimEnd) {
        videoRef.current.pause();
        if (previewStopRef.current) { window.clearInterval(previewStopRef.current); previewStopRef.current = null; }
        setPreviewingRange(false);
      }
    }, 120);
  }
  useEffect(() => () => { if (previewStopRef.current) window.clearInterval(previewStopRef.current); }, []);

  // Build a thumbnail filmstrip from the loaded video (offscreen, same-origin so the
  // canvas isn't tainted) — 10 evenly-spaced frames laid across the timeline track.
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

  // Keep the trim window sensible once the real duration is known: default the
  // end handle to the full duration so the timeline shows the whole clip selected.
  useEffect(() => {
    if (videoDuration > 0 && trimEnd === 0) setTrimEnd(Math.round(videoDuration * 10) / 10);
  }, [videoDuration]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load videoUrl from query param (?videoUrl=...)
  useEffect(() => {
    const qv = searchParams.get("videoUrl");
    if (qv) {
      setVideoUrl(decodeURIComponent(qv));
      setVideoPath(decodeURIComponent(qv));
    }
  }, [searchParams]);

  async function handleTrim() {
    if (!videoPath || trimEnd <= trimStart) { setEditMsg("Set valid trim points first"); return; }
    setTrimming(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/trim", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, startSec: trimStart, endSec: trimEnd }),
      });
      const data = await res.json();
      // This is a real edit output, not a project-restore reload — don't let a stale
      // pendingRestoreRef (from a prior project load) apply its trim window here.
      if (data.outputUrl) { pendingRestoreRef.current = null; setTrimResult(data.outputUrl); setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setEditMsg("Trim complete"); }
      else setEditMsg(data.error || "Trim failed");
    } catch (err) { setEditMsg("Trim failed: " + String(err)); }
    setTrimming(false);
  }

  async function handleAddIntro() {
    if (!videoPath || !introText.trim()) { setEditMsg("Set video and intro text first"); return; }
    setAddingIntro(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/add-intro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, text: introText, duration: introDuration }),
      });
      const data = await res.json();
      if (data.outputUrl) { pendingRestoreRef.current = null; setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setEditMsg("Intro added"); }
      else setEditMsg(data.error || "Add intro failed");
    } catch (err) { setEditMsg("Add intro failed: " + String(err)); }
    setAddingIntro(false);
  }

  async function handleAddOutro() {
    if (!videoPath || !outroText.trim()) { setEditMsg("Set video and outro text first"); return; }
    setAddingOutro(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/add-outro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, text: outroText, duration: outroDuration }),
      });
      const data = await res.json();
      if (data.outputUrl) { pendingRestoreRef.current = null; setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setEditMsg("Outro added"); }
      else setEditMsg(data.error || "Add outro failed");
    } catch (err) { setEditMsg("Add outro failed: " + String(err)); }
    setAddingOutro(false);
  }

  async function handleUploadOutroImage(file: File) {
    setUploadingOutroImg(true); setEditMsg(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.filePath) {
        const url = `/api/media/${String(data.filePath).replace(/\\/g, "/").replace(/^.*?storage\//, "")}`;
        setOutroImageUrl(url); setOutroImageName(file.name);
      } else setEditMsg(data.error || "Outro image upload failed");
    } catch (err) { setEditMsg("Outro image upload failed: " + String(err)); }
    setUploadingOutroImg(false);
  }

  async function handleAddOutroImage() {
    if (!videoPath || !outroImageUrl) { setEditMsg("Upload a product image for the outro first"); return; }
    setAddingOutro(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/add-outro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, imageUrl: outroImageUrl, duration: outroDuration, style: outroStyle() }),
      });
      const data = await res.json();
      if (data.outputUrl) { pendingRestoreRef.current = null; setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setTrimResult(data.outputUrl); setEditMsg("Product outro added"); }
      else setEditMsg(data.error || "Add image outro failed");
    } catch (err) { setEditMsg("Add image outro failed: " + String(err)); }
    setAddingOutro(false);
  }

  async function handleAddFreezeOutro() {
    if (!videoPath) { setEditMsg("Upload a video first"); return; }
    if (!outroHeadline.trim() && !outroSubline.trim()) { setEditMsg("Enter outro text (e.g. Call Now …)"); return; }
    setAddingOutro(true); setEditMsg(null);
    try {
      const res = await fetch("/api/editor/add-outro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoUrl: videoPath, useLastFrame: true, headline: outroHeadline, subline: outroSubline, duration: outroDuration, style: outroStyle() }),
      });
      const data = await res.json();
      if (data.outputUrl) { pendingRestoreRef.current = null; setVideoUrl(data.outputUrl); setVideoPath(data.outputUrl); setTrimResult(data.outputUrl); setEditMsg("Outro added — plays at the end; scrub the player to review"); }
      else setEditMsg(data.error || "Add freeze outro failed");
    } catch (err) { setEditMsg("Add freeze outro failed: " + String(err)); }
    setAddingOutro(false);
  }

  async function handleAiEdit() {
    if (!aiEditPrompt.trim() || !videoPath) return;
    setAiEditing(true); setEditMsg(null);
    // Parse the instruction and call the right API
    const inst = aiEditPrompt.toLowerCase();
    try {
      if (inst.includes("trim") || inst.includes("cut") || inst.includes("shorten")) {
        // Extract time range from instruction
        const matches = inst.match(/(\d+)\s*(?:second|sec|s)\b/g);
        if (matches && matches.length >= 2) {
          const start = parseInt(matches[0]);
          const end = parseInt(matches[1]);
          setTrimStart(start); setTrimEnd(end);
          await handleTrim();
        } else setEditMsg("Specify time range: e.g. 'trim from 5s to 30s'");
      } else if (inst.includes("intro")) {
        const textMatch = aiEditPrompt.match(/["']([^"']+)["']/);
        if (textMatch) { setIntroText(textMatch[1]); await handleAddIntro(); }
        else setEditMsg("Specify intro text in quotes: e.g. 'add intro \"My Film\"'");
      } else if (inst.includes("outro")) {
        const textMatch = aiEditPrompt.match(/["']([^"']+)["']/);
        if (textMatch) { setOutroText(textMatch[1]); await handleAddOutro(); }
        else setEditMsg("Specify outro text in quotes: e.g. 'add outro \"Subscribe now\"'");
      } else {
        setEditMsg("Supported: 'trim from Xs to Ys', 'add intro \"text\"', 'add outro \"text\"'");
      }
    } catch (err) { setEditMsg("AI edit failed: " + String(err)); }
    setAiEditing(false);
  }
  const [promptInput, setPromptInput] = useState("");
  const [polishedPrompt, setPolishedPrompt] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [polishError, setPolishError] = useState<string | null>(null);
  // Local-AI (Ollama) assistant — polish/generate/URL-grounded, free, runs while
  // Anthropic + FAL are out of credits. Separate state so it can't stomp the
  // Anthropic "Polish" path above; both write into the same result card.
  const [assisting, setAssisting] = useState(false);
  const [assistError, setAssistError] = useState<string | null>(null);
  const [assistModel, setAssistModel] = useState<string | null>(null);
  const [assistUsedUrl, setAssistUsedUrl] = useState<string | null>(null);
  const [assistCount, setAssistCount] = useState(1);
  const [assistResults, setAssistResults] = useState<string[]>([]);
  const [lastAssistMessage, setLastAssistMessage] = useState("");
  const [voiceTier, setVoiceTier] = useState<VoiceTierConfig>({ tier: "standard" });
  const [captionText, setCaptionText] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ outputUrl: string; contentItemId: string } | null>(null);
  const [exportError, setExportError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Server-side project save/resume (DB) — mirrors Ad Editor's pattern
  //    (app/api/ad-editor/project) so a saved project survives a PC restart. ──
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectName, setProjectName] = useState("Untitled video project");
  const [projectList, setProjectList] = useState<{ id: string; name: string; updatedAt: string }[]>([]);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [projectFilter, setProjectFilter] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The video element resets the trim window to the FULL clip on every onLoadedMetadata
  // (that's correct for a fresh upload). When we load a saved project the <video> src also
  // changes and re-fires onLoadedMetadata, which would silently wipe the restored trim
  // points. This ref carries the restored trim window across that reload so it survives.
  const pendingRestoreRef = useRef<{ trimStart: number; trimEnd: number } | null>(null);

  function buildProjectState() {
    return {
      videoPath, videoUrl, overlayLayers, captionText,
      trimStart, trimEnd, introText, introDuration,
      outroText, outroDuration, outroHeadline, outroSubline, outroImageUrl,
    };
  }

  // Small typed pluckers keep restoreProjectState to one line per field instead of a
  // repeated `typeof state.x === "..." ? state.x : default` ternary for each one.
  const strField = (v: unknown, fallback: string | null = ""): string | null => typeof v === "string" ? v : fallback;
  const numField = (v: unknown, fallback = 0): number => typeof v === "number" ? v : fallback;

  function restoreProjectState(state: Record<string, unknown>) {
    setVideoPath(strField(state.videoPath, null));
    setVideoUrl(strField(state.videoUrl, null));
    setOverlayLayers(Array.isArray(state.overlayLayers) ? (state.overlayLayers as OverlayLayer[]) : []);
    setCaptionText(strField(state.captionText) ?? "");
    const ts = numField(state.trimStart);
    const te = numField(state.trimEnd);
    setTrimStart(ts);
    setTrimEnd(te);
    pendingRestoreRef.current = { trimStart: ts, trimEnd: te };
    setIntroText(strField(state.introText) ?? "");
    setIntroDuration(numField(state.introDuration, 3));
    setOutroText(strField(state.outroText) ?? "");
    setOutroDuration(numField(state.outroDuration, 3));
    setOutroHeadline(strField(state.outroHeadline) ?? "");
    setOutroSubline(strField(state.outroSubline) ?? "");
    setOutroImageUrl(strField(state.outroImageUrl, null));
    setVideoDuration(0);
    setCurrentTime(0);
    setFilmstrip([]);
  }

  async function refreshProjectList() {
    try {
      const res = await fetch("/api/video-editor/project");
      const data = await safeJson<{ projects?: { id: string; name: string; updatedAt: string }[] }>(res, "video-editor project list");
      if (data.projects) setProjectList(data.projects);
    } catch { /* list refresh is a nicety; save/load still work without it */ }
  }

  useEffect(() => { refreshProjectList(); }, []);

  // Load a project from ?project=<id> in the URL (e.g. linked in from Content Registry).
  useEffect(() => {
    const pid = searchParams.get("project");
    if (!pid || projectId) return;
    loadProject(pid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  async function saveProject() {
    setSaving(true);
    try {
      const payload = { id: projectId ?? undefined, name: projectName, state: buildProjectState() };
      const res = await fetch("/api/video-editor/project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await safeJson<{ id?: string; error?: string }>(res, "video-editor save project");
      if (data.id) {
        const isNew = !projectId;
        if (isNew) setProjectId(data.id);
        const savedAt = new Date().toISOString();
        setLastSaved(new Date(savedAt).toLocaleTimeString());
        // Patch the cached list in place instead of refetching it on every autosave —
        // the list only needs this project's name/updatedAt to stay current.
        setProjectList(prev => {
          const entry = { id: data.id!, name: projectName, updatedAt: savedAt };
          const exists = prev.some(p => p.id === data.id);
          return exists ? prev.map(p => (p.id === data.id ? entry : p)) : [entry, ...prev];
        });
      } else if (data.error) {
        setEditMsg(`Save failed: ${data.error}`);
      }
    } catch (err) {
      setEditMsg(`Save failed: ${err instanceof Error ? err.message : "network error"}`);
    }
    setSaving(false);
  }

  // Debounced autosave, same 3s pattern as Ad Editor — only once there's something worth
  // saving (a video loaded, or an existing project already being edited). Depends on the
  // serialized state (not a hand-maintained list of every field) so it can't drift from
  // buildProjectState() as fields are added later.
  const projectStateKey = JSON.stringify(buildProjectState());
  useEffect(() => {
    if (!videoPath && !projectId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { saveProject(); }, 3000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectStateKey, projectName]);

  async function loadProject(id: string) {
    try {
      const res = await fetch(`/api/video-editor/project/${id}`);
      const data = await safeJson<{ project?: { id: string; name: string; state: unknown }; error?: string }>(res, "video-editor load project");
      if (data.project) {
        setProjectId(data.project.id);
        setProjectName(data.project.name);
        restoreProjectState((data.project.state as Record<string, unknown>) ?? {});
        setShowProjectPicker(false);
        setLastSaved(null);
      } else if (data.error) {
        setEditMsg(`Load failed: ${data.error}`);
      }
    } catch (err) {
      setEditMsg(`Load failed: ${err instanceof Error ? err.message : "network error"}`);
    }
  }

  function newProject() {
    pendingRestoreRef.current = null;
    setProjectId(null);
    setProjectName("Untitled video project");
    setVideoPath(null); setVideoUrl(null); setOverlayLayers([]); setCaptionText("");
    setTrimStart(0); setTrimEnd(0); setIntroText(""); setIntroDuration(3);
    setOutroText(""); setOutroDuration(3); setOutroHeadline(""); setOutroSubline("");
    setOutroImageUrl(null); setOutroImageName("");
    setVideoDuration(0); setCurrentTime(0); setFilmstrip([]);
    setShowProjectPicker(false);
    setLastSaved(null);
  }

  async function deleteProject(id: string) {
    try {
      const res = await fetch(`/api/video-editor/project/${id}`, { method: "DELETE" });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(`Delete failed: ${d.error ?? res.status}`); return; }
      setProjectList(prev => prev.filter(p => p.id !== id));
      if (projectId === id) newProject();
    } catch (err) { alert(`Delete failed: ${err instanceof Error ? err.message : "network error"}`); }
  }

  async function handleUpload(file: File) {
    pendingRestoreRef.current = null; // fresh upload — no restored trim window to honor
    setUploading(true);
    setUploadError(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/v2v/upload", { method: "POST", body: fd });
      const data = await res.json();
      // API returns { filePath } — NOT { path }. Reading data.path here broke the whole editor silently.
      if (res.ok && data.filePath) {
        setVideoPath(data.filePath);
        setVideoUrl(`/api/media/${data.filePath.replace(/\\/g, "/").replace(/^.*?storage\//, "")}`);
      } else {
        console.error("[video-editor] upload rejected:", res.status, data.error);
        setUploadError(data.error || `Upload failed (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error("[video-editor] upload failed:", err);
      setUploadError("Upload failed: " + String(err));
    }
    setUploading(false);
  }

  async function handlePolish() {
    if (!promptInput.trim()) return;
    setPolishing(true);
    setPolishError(null);
    setAssistResults([]); // Anthropic polish result renders in its own box below, not the local-AI list
    try {
      const res = await fetch("/api/llm/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptInput }),
      });
      const data = await res.json();
      if (res.ok && data.polishedPrompt) {
        setPolishedPrompt(data.polishedPrompt);
      } else {
        console.error("[video-editor] polish failed:", res.status, data.error);
        setPolishError(data.error || `Polish failed (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error("[video-editor] polish failed:", err);
      setPolishError("Polish failed: " + String(err));
    } finally { setPolishing(false); }
  }

  // messageOverride lets "↻ More" re-run the SAME question that produced the current
  // results (promptInput may have moved on after a "Use this" click on one option).
  async function handleAssist(messageOverride?: string) {
    const msg = (messageOverride ?? promptInput).trim();
    if (!msg) return;
    setLastAssistMessage(msg);
    setAssisting(true);
    setAssistError(null);
    setAssistModel(null);
    setAssistUsedUrl(null);
    try {
      const res = await fetch("/api/llm/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, count: assistCount }),
      });
      const data = await res.json();
      const results: string[] = Array.isArray(data.results) ? data.results : (data.result ? [data.result] : []);
      if (res.ok && results.length > 0) {
        setAssistResults(results);
        setPolishedPrompt(results[0]);
        setAssistModel(data.model || null);
        setAssistUsedUrl(data.usedUrl || null);
      } else {
        console.error("[video-editor] assistant failed:", res.status, data.error);
        setAssistError(data.error || `Local AI failed (HTTP ${res.status})`);
      }
    } catch (err) {
      console.error("[video-editor] assistant failed:", err);
      setAssistError("Local AI failed: " + String(err));
    } finally { setAssisting(false); }
  }

  async function handleExport() {
    if (!videoPath) return;
    setExporting(true);
    setExportError("");
    setExportResult(null);
    // Build caption layer if provided
    const allLayers: OverlayLayer[] = [...overlayLayers];
    if (captionText.trim()) {
      allLayers.push({
        type: "text",
        id: `caption_${Date.now()}`,
        text: captionText,
        position: { zone: "bottom" },
        style: { fontSize: 32, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 },
        animation: { entrance: "fade_in", startSec: 0, durationSec: 9999 },
      });
    }
    try {
      const res = await fetch("/api/overlays/render-direct", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, layers: allLayers, title: polishedPrompt || promptInput || "Video Editor export" }),
      });
      const data = await res.json();
      if (!res.ok) { setExportError(data.error ?? "Export failed"); return; }
      setExportResult({ outputUrl: data.outputUrl, contentItemId: data.contentItemId });
    } catch { setExportError("Network error during export"); } finally { setExporting(false); }
  }

  const microLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: ds.color.mute,
    display: "block",
    marginBottom: 6,
    fontFamily: ds.font.mono,
  };

  const inputSt: React.CSSProperties = {
    background: ds.color.card,
    color: ds.color.ink2,
    border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.xs,
    padding: "8px 12px",
    fontSize: 12,
    width: "100%",
  };

  const ghostBtn: React.CSSProperties = {
    background: "none",
    color: ds.color.mute,
    border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.xs,
    padding: "7px 12px",
    fontSize: 11,
    cursor: "pointer",
    textAlign: "left" as const,
    width: "100%",
  };

  // Inline (non-full-width) variant of ghostBtn for the project bar's row of buttons.
  const btnSm: React.CSSProperties = { ...ghostBtn, width: "auto", textAlign: undefined, color: ds.color.ink2, fontWeight: 600 };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto" }}>
      <HeroTitle
        kicker="Studio / Edit"
        title="Video"
        italic="Editor"
        sub="Import any video — add text overlays, captions, logos, animations — export"
      />

      {/* Badge row */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        <span style={{ fontSize: 9, fontWeight: 700, padding: "2px 8px", borderRadius: ds.radius.xs, background: `${ds.color.lilac}18`, color: ds.color.lilac, fontFamily: ds.font.mono }}>AI: Claude Haiku</span>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: ds.radius.xs, background: `${ds.color.mint}10`, color: ds.color.mint, fontFamily: ds.font.mono }}>OverlayPanel</span>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: ds.radius.xs, background: `${ds.color.gold}10`, color: ds.color.gold, fontFamily: ds.font.mono }}>FFmpeg export</span>
      </div>

      {/* ── Project bar — server-side (DB) save/resume, same pattern as Ad Editor.
           Survives a PC restart because the state lives in the database, not localStorage. ── */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <input
            value={projectName}
            onChange={e => setProjectName(e.target.value)}
            placeholder="Untitled video project"
            style={{ ...inputSt, width: 220 }}
          />
          <ButtonPrimary onClick={saveProject} disabled={saving} style={{ fontSize: 11, padding: "7px 16px", whiteSpace: "nowrap" }}>
            {saving ? "Saving…" : "Save Project"}
          </ButtonPrimary>
          <button onClick={newProject} style={btnSm}>New</button>
          <button onClick={() => setShowProjectPicker(v => !v)} style={btnSm}>
            Projects ({projectList.length})
          </button>
          {lastSaved && <span style={{ fontSize: 9, color: ds.color.mute, marginLeft: "auto", fontFamily: ds.font.mono }}>Saved {lastSaved}</span>}
          {projectId && <span style={{ fontSize: 9, color: ds.color.mute, fontFamily: ds.font.mono, marginLeft: lastSaved ? 0 : "auto" }}>{projectId.slice(0, 8)}…</span>}
        </div>

        {showProjectPicker && (
          <div style={{ marginTop: 12, borderTop: `1px solid ${ds.color.line2}`, paddingTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, gap: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: ds.color.ink, textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: ds.font.mono }}>
                All Projects · {projectList.length}
              </span>
              <input
                value={projectFilter}
                onChange={e => setProjectFilter(e.target.value)}
                placeholder="Search projects…"
                style={{ flex: 1, maxWidth: 240, fontSize: 11, background: ds.color.paper, border: `1px solid ${ds.color.line2}`, color: ds.color.ink, padding: "4px 8px", borderRadius: ds.radius.xs, outline: "none" }}
              />
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
              {projectList.length === 0 && (
                <p style={{ fontSize: 11, color: ds.color.mute, padding: "16px 0", textAlign: "center" }}>
                  No saved projects yet. Click <b>Save Project</b> to create one.
                </p>
              )}
              {projectList
                .filter(p => !projectFilter || p.name.toLowerCase().includes(projectFilter.toLowerCase()))
                .map(p => (
                <div key={p.id}
                  style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 10px", borderRadius: ds.radius.xs, marginBottom: 3, background: projectId === p.id ? `${ds.color.lilac}18` : "rgba(255,255,255,0.02)", cursor: "pointer", border: `1px solid ${projectId === p.id ? `${ds.color.lilac}40` : "transparent"}` }}
                  onClick={() => loadProject(p.id)}
                >
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 12, color: ds.color.ink, fontWeight: projectId === p.id ? 700 : 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</div>
                    <div style={{ fontSize: 9, color: ds.color.mute, marginTop: 2, fontFamily: ds.font.mono }}>{new Date(p.updatedAt).toLocaleString()}</div>
                  </div>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirmDel === p.id) { setConfirmDel(null); deleteProject(p.id); }
                      else { setConfirmDel(p.id); setTimeout(() => setConfirmDel(c => (c === p.id ? null : c)), 3000); }
                    }}
                    style={{ fontSize: 10, color: confirmDel === p.id ? "#fff" : ds.color.coral, background: confirmDel === p.id ? ds.color.coral : `${ds.color.coral}10`, border: `1px solid ${ds.color.coral}30`, cursor: "pointer", padding: "3px 8px", borderRadius: ds.radius.xs, flexShrink: 0, marginLeft: 8, fontWeight: confirmDel === p.id ? 700 : 400 }}
                  >
                    {confirmDel === p.id ? "Confirm?" : "Delete"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* AI Prompt Bar — always visible */}
      <Card style={{ marginBottom: 16 }}>
        <label style={microLabel}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Wand size={11} color={ds.color.lilac} />
            AI Prompt Assistant
          </span>
        </label>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={promptInput}
            onChange={e => { setPromptInput(e.target.value); setPolishedPrompt(""); setAssistResults([]); setAssistError(null); }}
            placeholder='Try: "get info from dioluxapartments.com and write a bottom price line" or "nice overlay prompt for a luxury shortlet"'
            style={{ ...inputSt, flex: 1 }}
          />
          <button
            onClick={() => handleAssist()}
            disabled={assisting || !promptInput.trim()}
            style={{
              whiteSpace: "nowrap", fontSize: 11, fontWeight: 700, padding: "8px 16px",
              borderRadius: ds.radius.xs, border: `1px solid ${ds.color.mint}55`,
              background: `${ds.color.mint}18`, color: ds.color.mint,
              cursor: assisting || !promptInput.trim() ? "not-allowed" : "pointer",
              opacity: assisting || !promptInput.trim() ? 0.5 : 1,
            }}
            title="Free — runs on local AI (Ollama), no credits used"
          >
            {assisting ? "Thinking…" : "Ask AI (local)"}
          </button>
          <ButtonPrimary
            onClick={handlePolish}
            disabled={polishing || !promptInput.trim()}
            style={{ whiteSpace: "nowrap", fontSize: 11, padding: "8px 16px" }}
          >
            {polishing ? "Polishing…" : "Polish"}
          </ButtonPrimary>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
          <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono, letterSpacing: 0.5 }}>SAMPLES</span>
          {[1, 3, 5].map(n => (
            <button
              key={n}
              onClick={() => setAssistCount(n)}
              disabled={assisting}
              style={{
                fontSize: 10, fontWeight: 700, padding: "3px 10px",
                borderRadius: ds.radius.xs, border: `1px solid ${assistCount === n ? ds.color.mint : ds.color.line2}`,
                background: assistCount === n ? `${ds.color.mint}18` : "transparent",
                color: assistCount === n ? ds.color.mint : ds.color.mute,
                cursor: assisting ? "not-allowed" : "pointer",
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 10, color: ds.color.mute, marginTop: 6 }}>
          Local AI (free). Try: &quot;get info from dioluxapartments.com and write a bottom price line&quot; or &quot;nice overlay prompt for a luxury shortlet&quot;.
        </p>
        {polishError && (
          <p style={{ fontSize: 11, color: ds.color.coral, marginTop: 8, fontWeight: 600 }}>{polishError}</p>
        )}
        {assistError && (
          <p style={{ fontSize: 11, color: ds.color.coral, marginTop: 8, fontWeight: 600 }}>{assistError}</p>
        )}
        {assistResults.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
              <p style={{ fontSize: 9, color: ds.color.lilac, fontWeight: 700, fontFamily: ds.font.mono, letterSpacing: 1 }}>
                {assistModel ? `LOCAL AI (${assistModel})` : "AI IMPROVED"}
              </p>
              <button
                onClick={() => handleAssist(lastAssistMessage)}
                disabled={assisting || !lastAssistMessage.trim()}
                style={{
                  fontSize: 10, fontWeight: 600, color: ds.color.mint, background: "none",
                  border: "none", cursor: assisting ? "not-allowed" : "pointer", opacity: assisting ? 0.5 : 1,
                }}
                title="Generate fresh samples for the same request"
              >
                ↻ More
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {assistResults.map((opt, i) => (
                <div key={i} style={{ background: ds.color.paper, borderRadius: ds.radius.xs, padding: "8px 12px", border: `1px solid ${ds.color.line2}` }}>
                  <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.5 }}>{opt}</p>
                  <button
                    onClick={() => { setPromptInput(opt); setPolishedPrompt(""); setAssistResults([]); setAssistModel(null); setAssistUsedUrl(null); }}
                    style={{ marginTop: 5, fontSize: 10, color: ds.color.mint, background: "none", border: "none", cursor: "pointer" }}
                  >
                    Use this
                  </button>
                </div>
              ))}
            </div>
            {assistUsedUrl && (
              <p style={{ fontSize: 10, color: ds.color.mute, marginTop: 4 }}>Used site content from {assistUsedUrl}</p>
            )}
          </div>
        )}
        {assistResults.length === 0 && polishedPrompt && (
          <div style={{ marginTop: 8, background: ds.color.paper, borderRadius: ds.radius.xs, padding: "8px 12px", border: `1px solid ${ds.color.line2}` }}>
            <p style={{ fontSize: 9, color: ds.color.lilac, fontWeight: 700, marginBottom: 4, fontFamily: ds.font.mono, letterSpacing: 1 }}>
              AI IMPROVED
            </p>
            <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.5 }}>{polishedPrompt}</p>
            <button onClick={() => { setPromptInput(polishedPrompt); setPolishedPrompt(""); }}
              style={{ marginTop: 5, fontSize: 10, color: ds.color.mint, background: "none", border: "none", cursor: "pointer" }}>
              Use this
            </button>
          </div>
        )}
      </Card>

      {/* Video import */}
      {!videoPath ? (
        <div
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${ds.color.line2}`,
            borderRadius: ds.radius.lg,
            padding: "60px 40px",
            textAlign: "center",
            cursor: "pointer",
            background: ds.color.paper,
            transition: "border-color 0.2s",
            marginTop: 16,
          }}
          onMouseEnter={e => (e.currentTarget.style.borderColor = ds.color.lilac)}
          onMouseLeave={e => (e.currentTarget.style.borderColor = ds.color.line2)}
        >
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
            <Folder size={40} color={ds.color.mute} />
          </div>
          <p style={{ fontSize: 15, fontWeight: 600, color: ds.color.ink2, marginBottom: 4 }}>
            {uploading ? "Uploading..." : "Drop a video here or click to upload"}
          </p>
          <p style={{ fontSize: 11, color: ds.color.mute, fontFamily: ds.font.mono }}>MP4, MOV, WebM</p>
          {uploadError && (
            <p style={{ fontSize: 12, color: ds.color.coral, marginTop: 10, fontWeight: 600 }}>{uploadError}</p>
          )}
          <input ref={fileRef} type="file" accept="video/mp4,video/quicktime,video/webm" style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); }} />
        </div>
      ) : (
        <div style={{ marginTop: 16 }}>
          {/* Video preview + quick actions */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            {/* Preview — plays the video with a live approximation of the text overlays,
                so you can SEE where the text sits and when it appears/disappears. */}
            <Card padding={0} style={{ overflow: "hidden" }}>
              <div style={{ position: "relative", background: "black" }}>
                <video
                  ref={videoRef}
                  src={videoUrl ?? undefined}
                  controls
                  onLoadedMetadata={e => {
                    const dur = e.currentTarget.duration || 0;
                    setVideoDuration(dur);
                    setVideoDims({ w: e.currentTarget.videoWidth || 1920, h: e.currentTarget.videoHeight || 1080 });
                    requestAnimationFrame(measureVideoRect);
                    // Reset the trim window to the whole new clip — UNLESS a saved project
                    // just restored a specific trim window, in which case honor it instead
                    // (see pendingRestoreRef above the state declarations).
                    const pending = pendingRestoreRef.current;
                    if (pending) {
                      setTrimStart(pending.trimStart);
                      setTrimEnd(pending.trimEnd || Math.round(dur * 10) / 10);
                      pendingRestoreRef.current = null;
                    } else {
                      setTrimStart(0); setTrimEnd(Math.round(dur * 10) / 10);
                    }
                    setFilmstrip([]);
                    if (e.currentTarget.currentSrc) buildFilmstrip(e.currentTarget.currentSrc);
                  }}
                  onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
                  style={{ width: "100%", maxHeight: 380, background: "black", display: "block" }}
                />
                {/* Live overlay preview, drawn inside the ACTUAL video image rect using the
                    same geometry FFmpeg burns with (top=6% of height, bottom=text top at 85%,
                    font px scaled from native video width). */}
                {videoRect && (
                  <div style={{ position: "absolute", left: videoRect.left, top: videoRect.top, width: videoRect.width, height: videoRect.height, pointerEvents: "none", overflow: "hidden" }}>
                    {overlayLayers.filter((l): l is Extract<OverlayLayer, { type: "text" }> => l.type === "text").map(l => {
                      const start = l.animation?.startSec ?? 0;
                      const dur = l.animation?.durationSec ?? 9999;
                      if (currentTime < start || currentTime > start + dur) return null;
                      const scale = videoRect.width / (videoDims.w || 1920);
                      const zone = l.position?.zone ?? "bottom";
                      const pos: React.CSSProperties =
                        zone === "top" ? { top: "6%", left: "50%", transform: "translateX(-50%)" } :
                        zone === "center" ? { top: "50%", left: "50%", transform: "translate(-50%, -50%)" } :
                        zone === "free" ? { top: `${l.position?.y ?? 50}%`, left: `${l.position?.x ?? 50}%`, transform: "translate(-50%, -50%)" } :
                        { top: "85%", left: "50%", transform: "translateX(-50%)" };
                      const bg = l.style?.bgColor ? l.style.bgColor.split("@") : null;
                      const bgAlpha = bg ? Math.min(1, Math.max(0, Number.isFinite(Number(bg[1])) ? Number(bg[1] ?? 1) : 1)) : 1;
                      const bgCss = bg ? `color-mix(in srgb, ${bg[0]} ${Math.round(bgAlpha * 100)}%, transparent)` : undefined;
                      const pad = (l.style?.bgPadding ?? 0) * scale;
                      return (
                        <span key={l.id} style={{
                          position: "absolute", ...pos, whiteSpace: "pre-wrap", textAlign: "center",
                          maxWidth: "96%", lineHeight: 1.15,
                          fontSize: Math.max(6, (l.style?.fontSize ?? 48) * scale),
                          fontWeight: l.style?.fontWeight === "bold" ? 700 : 400,
                          fontStyle: l.style?.italic ? "italic" : "normal",
                          fontFamily: l.style?.fontFamily || "Arial, Helvetica, sans-serif",
                          textTransform: l.style?.uppercase ? "uppercase" : "none",
                          color: l.style?.color ?? "#FFFFFF",
                          textShadow: l.style?.shadow ? `0 ${2 * scale}px ${6 * scale}px rgba(0,0,0,0.8)` : "none",
                          WebkitTextStroke: l.style?.outline ? `${Math.max(0.5, (l.style?.outlineWidth ?? 2) * scale)}px ${l.style?.outlineColor ?? "#000"}` : undefined,
                          background: bgCss,
                          padding: pad ? `${pad / 2}px ${pad}px` : undefined,
                          borderRadius: l.style?.bgRadius ? l.style.bgRadius * scale : undefined,
                        }}>{l.text}</span>
                      );
                    })}
                  </div>
                )}
              </div>
              <div style={{ padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>
                  {videoPath?.split(/[\\/]/).pop()}{videoDuration > 0 ? ` · ${(Math.round(videoDuration * 10) / 10)}s` : ""}
                </span>
                <button
                  onClick={() => { pendingRestoreRef.current = null; setVideoPath(null); setVideoUrl(null); setOverlayLayers([]); setVideoDuration(0); setCurrentTime(0); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}
                >
                  <X size={11} color={ds.color.coral} /> Remove
                </button>
              </div>
            </Card>

            {/* Quick actions + Voice */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Card>
                <h3 style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink2, marginBottom: 10 }}>Quick Add</h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <ButtonPrimary
                    style={{ width: "100%", textAlign: "left", fontSize: 11, padding: "7px 12px" }}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `text_${Date.now()}`, text: "Your Text Here", position: { zone: "bottom" }, style: { fontSize: 48, fontWeight: "bold", color: "#FFFFFF", shadow: true, outline: true, outlineColor: "#000000", outlineWidth: 2 }, animation: { entrance: "fade_in", startSec: 0, durationSec: wholeVideo } }])}
                  >
                    + Add Text Overlay
                  </ButtonPrimary>
                  <button
                    style={ghostBtn}
                    onClick={() => setOverlayLayers(prev => [...prev, { type: "text", id: `headline_${Date.now()}`, text: "HEADLINE", position: { zone: "top" }, style: { fontSize: 56, fontWeight: "bold", color: "#FF0000", outline: true, outlineColor: "#FFFFFF", outlineWidth: 3, shadow: true, uppercase: true }, animation: { entrance: "fade_in", startSec: 0.5, durationSec: Math.max(1, wholeVideo - 0.5) } }])}
                  >
                    + Property Headline (Red)
                  </button>
                  <button
                    style={ghostBtn}
                    onClick={() => { const pStart = Math.min(2, Math.max(0, wholeVideo - 1)); setOverlayLayers(prev => [...prev, { type: "text", id: `price_${Date.now()}`, text: "₦60,000/night", position: { zone: "bottom" }, style: { fontSize: 36, fontWeight: "bold", color: "#FFFFFF", bgColor: "#22c55e@0.9", bgPadding: 14, shadow: false, outline: false }, animation: { entrance: "pop_in", startSec: pStart, durationSec: Math.max(1, wholeVideo - pStart) } }]); }}
                  >
                    + Price Tag
                  </button>
                  <label style={{ ...ghostBtn, display: "block" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Film size={11} color={ds.color.mute} />
                      + Upload Logo / Image
                    </span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={async e => {
                      const file = e.target.files?.[0]; if (!file) return;
                      const fd = new FormData(); fd.append("file", file);
                      const res = await fetch("/api/upload/logo", { method: "POST", body: fd });
                      if (res.ok) { const data = await res.json(); setOverlayLayers(prev => [...prev, { type: "image", id: `img_${Date.now()}`, imagePath: data.filePath, position: { zone: "bottom-right" }, size: { width: 150, height: 60 }, animation: { entrance: "none", startSec: 0, durationSec: 999 } }]); }
                    }} />
                  </label>
                </div>
              </Card>

              {/* Caption */}
              <Card>
                <label style={microLabel}>Caption Text</label>
                <input value={captionText} onChange={e => setCaptionText(e.target.value)} placeholder="Bottom caption to burn into video…" style={inputSt} />
                {captionText.trim() && (
                  <p style={{ fontSize: 10, color: ds.color.mute, marginTop: 4 }}>Shows at the bottom for the whole video{videoDuration > 0 ? ` (${Math.round(videoDuration * 10) / 10}s)` : ""}.</p>
                )}
              </Card>

              {/* Voice */}
              <Card>
                <label style={microLabel}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    <Music size={11} color={ds.color.lilac} />
                    Voice Engine
                  </span>
                </label>
                <VoiceTierSelector value={voiceTier} onChange={setVoiceTier} compact />
              </Card>
            </div>
          </div>

          {/* Full overlay panel */}
          <OverlayPanel videoPath={videoPath} layers={overlayLayers} onChange={setOverlayLayers} onApplied={() => {}} videoDurationSec={videoDuration} />

          {/* SFX Library */}
          <Card style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 12, fontWeight: 700, color: ds.color.ink2, marginBottom: 6 }}>Sound Effects Library</h3>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 10 }}>Browse and preview SFX. Click "Use" to add to your project.</p>
            <SFXPicker onSelect={(event, path) => { console.log(`[SFX] ${event} → ${path}`); }} />
          </Card>

          {/* ── Post-Assembly Tools: AI Edit / Trim Timeline (EditorTimeline) / Intro / Outro (FIX 3) ── */}
          <Card style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2, marginBottom: 12 }}>AI Edit</h3>

            {editMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: trimResult ? `${ds.color.mint}10` : `${ds.color.coral}10`, border: `1px solid ${trimResult ? ds.color.mint : ds.color.coral}30`, fontSize: 11, color: trimResult ? ds.color.mint : ds.color.coral }}>
                {editMsg}
              </div>
            )}

            {/* AI Edit */}
            <label style={microLabel}>AI Edit (natural language)</label>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={aiEditPrompt} onChange={e => setAiEditPrompt(e.target.value)}
                placeholder={"e.g. 'trim from 5s to 30s' or 'add intro \"My Film\"'"}
                style={{ ...inputSt, flex: 1 }}
                onKeyDown={e => e.key === "Enter" && handleAiEdit()} />
              <button onClick={handleAiEdit} disabled={aiEditing || !videoPath}
                style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: aiEditing ? ds.color.card : ds.color.lilac, color: "#000", fontSize: 12, fontWeight: 700, cursor: aiEditing ? "not-allowed" : "pointer", flexShrink: 0 }}>
                {aiEditing ? "Working..." : "Apply"}
              </button>
            </div>
          </Card>

          {/* Cut/keep a section, splice in a clip or image at the playhead, undo/redo —
              fully self-contained, reusable by video-tools/video-finishing/video-trimmer. */}
          <EditorTimeline
            initialVideoUrl={videoUrl}
            initialVideoPath={videoPath}
            onChange={(u, p) => { setVideoUrl(u); setVideoPath(p); }}
          />

          <Card style={{ marginTop: 10 }}>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2, marginBottom: 12 }}>Intro / Outro</h3>
            {editMsg && (
              <div style={{ padding: "8px 12px", borderRadius: 8, marginBottom: 12, background: trimResult ? `${ds.color.mint}10` : `${ds.color.coral}10`, border: `1px solid ${trimResult ? ds.color.mint : ds.color.coral}30`, fontSize: 11, color: trimResult ? ds.color.mint : ds.color.coral }}>
                {editMsg}
              </div>
            )}
            {/* Intro */}
            <label style={microLabel}>Add Intro Card</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, marginBottom: 16, alignItems: "end" }}>
              <input value={introText} onChange={e => setIntroText(e.target.value)} placeholder="Intro text (e.g. A GioHomeStudio Film)" style={inputSt} />
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Seconds</span>
                <input type="number" min={1} max={10} value={introDuration} onChange={e => setIntroDuration(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleAddIntro} disabled={addingIntro || !videoPath}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: addingIntro ? ds.color.card : ds.color.gold, color: "#000", fontSize: 12, fontWeight: 700, cursor: addingIntro ? "not-allowed" : "pointer" }}>
                {addingIntro ? "..." : "Add"}
              </button>
            </div>

            {/* Outro */}
            <label style={microLabel}>Add Outro Card</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, alignItems: "end" }}>
              <input value={outroText} onChange={e => setOutroText(e.target.value)} placeholder="Outro text (e.g. Subscribe now)" style={inputSt} />
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Seconds</span>
                <input type="number" min={1} max={10} value={outroDuration} onChange={e => setOutroDuration(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleAddOutro} disabled={addingOutro || !videoPath}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: addingOutro ? ds.color.card : ds.color.mint, color: "#000", fontSize: 12, fontWeight: 700, cursor: addingOutro ? "not-allowed" : "pointer" }}>
                {addingOutro ? "..." : "Add"}
              </button>
            </div>

            {/* Outro from a product image (branded card) */}
            <label style={{ ...microLabel, marginTop: 16 }}>Add Outro from Product Image</label>
            <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 8 }}>Upload your branded product card (e.g. from Ad Tools) — it's appended as the end screen at your video's size.</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, alignItems: "end" }}>
              <label style={{ ...ghostBtn, display: "flex", alignItems: "center", gap: 6, cursor: uploadingOutroImg ? "wait" : "pointer" }}>
                <Film size={11} color={ds.color.mute} />
                {uploadingOutroImg ? "Uploading…" : outroImageName ? outroImageName.slice(0, 26) : "Choose product image"}
                <input type="file" accept="image/*" style={{ display: "none" }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadOutroImage(f); }} />
              </label>
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Seconds</span>
                <input type="number" min={1} max={15} value={outroDuration} onChange={e => setOutroDuration(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleAddOutroImage} disabled={addingOutro || !videoPath || !outroImageUrl}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: (addingOutro || !outroImageUrl) ? ds.color.card : ds.color.lilac, color: "#000", fontSize: 12, fontWeight: 700, cursor: (addingOutro || !outroImageUrl) ? "not-allowed" : "pointer" }}>
                {addingOutro ? "..." : "Add Image"}
              </button>
            </div>
            {outroImageUrl && (
              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono }}>OUTRO PREVIEW (appended at your video's size)</span>
                <div style={{ marginTop: 6, display: "flex", alignItems: "flex-start", gap: 8 }}>
                  <img src={outroImageUrl} alt="Outro preview" style={{ maxHeight: 140, maxWidth: "60%", borderRadius: 6, border: `1px solid ${ds.color.line2}` }} />
                  <button onClick={() => { setOutroImageUrl(null); setOutroImageName(""); }}
                    style={{ fontSize: 10, color: ds.color.coral, background: "none", border: "none", cursor: "pointer" }}>Remove image</button>
                </div>
              </div>
            )}

            {/* Outro from the END of the video (freeze last frame) + branding — like a commercial end card */}
            <label style={{ ...microLabel, marginTop: 16 }}>Freeze End of Video as Outro (+ text)</label>
            <p style={{ fontSize: 10, color: ds.color.mute, marginBottom: 8 }}>The last frame of your video becomes the outro background, with your text on top — like a commercial end card. No upload needed.</p>
            <div style={{ display: "grid", gap: 8, marginBottom: 8 }}>
              <input value={outroHeadline} onChange={e => setOutroHeadline(e.target.value)} placeholder="Headline — e.g. Call Now 0902 514 7449" style={inputSt} />
              <input value={outroSubline} onChange={e => setOutroSubline(e.target.value)} placeholder="Sub-line — e.g. Sangotedo . Ajah . Lekki" style={inputSt} />
            </div>
            {/* Text decoration for this outro (overrides the Brand Kit) */}
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr auto auto 1.1fr", gap: 8, alignItems: "center", marginBottom: 8 }}>
              <select value={outroFont} onChange={e => setOutroFont(e.target.value)} style={{ ...inputSt, fontSize: 11 }} title="Font">
                <option value="">Brand Kit font</option>
                <option value="Poppins">Poppins</option>
                <option value="Montserrat">Montserrat</option>
                <option value="Bebas Neue">Bebas Neue</option>
                <option value="Anton">Anton</option>
                <option value="Arial">Arial</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: ds.color.mute }} title="Headline colour">Head
                <input type="color" value={outroHeadColor} onChange={e => setOutroHeadColor(e.target.value)} style={{ width: 26, height: 26, border: "none", background: "none", cursor: "pointer" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: ds.color.mute }} title="Sub-line colour">Sub
                <input type="color" value={outroSubColor} onChange={e => setOutroSubColor(e.target.value)} style={{ width: 26, height: 26, border: "none", background: "none", cursor: "pointer" }} />
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 9, color: ds.color.mute }} title="Text size">Size
                <input type="range" min={0.6} max={1.8} step={0.1} value={outroScale} onChange={e => setOutroScale(Number(e.target.value))} style={{ flex: 1 }} />
              </label>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 80px auto", gap: 8, alignItems: "end" }}>
              <span style={{ fontSize: 10, color: ds.color.mute }}>Uses the video's final frame as the background.</span>
              <div>
                <span style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4 }}>Seconds</span>
                <input type="number" min={1} max={15} value={outroDuration} onChange={e => setOutroDuration(Number(e.target.value))} style={inputSt} />
              </div>
              <button onClick={handleAddFreezeOutro} disabled={addingOutro || !videoPath}
                style={{ padding: "8px 14px", borderRadius: 8, border: "none", background: addingOutro ? ds.color.card : ds.color.gold, color: "#000", fontSize: 12, fontWeight: 700, cursor: addingOutro ? "not-allowed" : "pointer" }}>
                {addingOutro ? "..." : "Freeze + Add"}
              </button>
            </div>
          </Card>

          {/* Export / Assembly */}
          <Card style={{ marginTop: 10 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 13, fontWeight: 700, color: ds.color.ink2 }}>Export Video</h3>
              <ModelChip modelId="ffmpeg" provider="FFmpeg" size="xs" position="static" />
            </div>
            <p style={{ fontSize: 11, color: ds.color.mute, marginBottom: 12 }}>Burn all overlays, captions, and animations into the final video.</p>
            <ButtonPrimary onClick={handleExport} disabled={exporting || !videoPath} style={{ width: "100%" }}>
              {exporting ? "Exporting…" : "Export with Overlays"}
            </ButtonPrimary>
            {exportError && <p style={{ fontSize: 11, color: ds.color.coral, marginTop: 8 }}>{exportError}</p>}
            {exportResult && (
              <div style={{ marginTop: 12, background: ds.color.paper, borderRadius: ds.radius.sm, padding: 12, border: `1px solid ${ds.color.line2}` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <Check size={14} color={ds.color.mint} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: ds.color.mint }}>Export complete</span>
                </div>
                <video src={exportResult.outputUrl} controls style={{ width: "100%", borderRadius: ds.radius.xs, background: "black" }} />
                <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                  <a href={exportResult.outputUrl} download style={{ fontSize: 11, color: ds.color.lilac, textDecoration: "underline" }}>Download MP4</a>
                  <a href={`/dashboard/content/${exportResult.contentItemId}`} style={{ fontSize: 11, color: ds.color.mute, textDecoration: "underline" }}>View in registry</a>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

export default function VideoEditorPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: "#aaa" }}>Loading editor…</div>}>
      <VideoEditorInner />
    </Suspense>
  );
}
