"use client";

import { useState, useRef, useEffect } from "react";
import type { TrimPlan, TrimSegment, TrimRules } from "@/modules/ffmpeg/trim-plan";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";

type Step = "upload" | "instruct" | "review" | "done";
type SideTab = "trim" | "bg_image" | "bg_video" | "object_remove";

const COMMERCIAL_GOALS = ["shortlet ad", "product launch", "brand promo", "real estate", "custom"] as const;

const DEFAULT_RULES: TrimRules = {
  allowRepeat: false,
  commercialGoal: "shortlet ad",
  addNarration: false,
  addCaptions: false,
};

function fmtSec(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

interface VideoMeta { durationSec: number; width: number; height: number; format: string; }

// ── AI Prompt Polish ──────────────────────────────────────────────────────────
async function polishPrompt(raw: string, context: string): Promise<string> {
  try {
    const res = await fetch("/api/assembly/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instruction: `Polish and clarify this video editing instruction for professional use. Context: ${context}. Instruction: "${raw}". Return ONLY the improved instruction, no explanation.`,
        assembly: { segments: [], narration: [], music: [], sfx: [], subtitles: [], ambience: [] },
      }),
    });
    const data = await res.json();
    if (data.suggestion || data.instruction) return data.suggestion || data.instruction;
    return raw;
  } catch { return raw; }
}

export default function VideoTrimmerPage() {
  const [step, setStep] = useState<Step>("upload");
  const [sideTab, setSideTab] = useState<SideTab>("trim");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [tempPath, setTempPath] = useState("");
  const [meta, setMeta] = useState<VideoMeta | null>(null);

  const [instruction, setInstruction] = useState("");
  const [polishedInstruction, setPolishedInstruction] = useState("");
  const [polishing, setPolishing] = useState(false);
  const [rules, setRules] = useState<TrimRules>(DEFAULT_RULES);
  const [analysing, setAnalysing] = useState(false);
  const [analyseError, setAnalyseError] = useState("");
  const [voiceTier, setVoiceTier] = useState<VoiceTierConfig>({ tier: "standard" });

  const [plan, setPlan] = useState<TrimPlan | null>(null);
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState("");
  const [contentItemId, setContentItemId] = useState("");

  // BG image removal state
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [bgRemoving, setBgRemoving] = useState(false);
  const [bgResult, setBgResult] = useState<{ url: string; provider: string } | null>(null);
  const [bgError, setBgError] = useState("");

  // BG video removal state
  const [bgVideoFile, setBgVideoFile] = useState<File | null>(null);
  const [bgVideoPrompt, setBgVideoPrompt] = useState("");
  const [bgVideoRemoving, setBgVideoRemoving] = useState(false);
  const [bgVideoResult, setBgVideoResult] = useState<{ url: string; provider: string } | null>(null);
  const [bgVideoError, setBgVideoError] = useState("");

  // Object removal state
  const [objFile, setObjFile] = useState<File | null>(null);
  const [objPrompt, setObjPrompt] = useState("");
  const [objRemoving, setObjRemoving] = useState(false);
  const [objResult, setObjResult] = useState<{ url: string; provider: string } | null>(null);
  const [objError, setObjError] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const bgFileRef = useRef<HTMLInputElement>(null);
  const bgVideoFileRef = useRef<HTMLInputElement>(null);
  const objFileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setUploadError("");
    setUploading(true);
    try {
      const form = new FormData();
      form.append("video", file);
      const res = await fetch("/api/video-trimmer/upload", { method: "POST", body: form, signal: abortRef.current.signal });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setTempPath(data.tempPath);
      setMeta(data.metadata);
      setStep("instruct");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setUploadError("Network error during upload");
    } finally { setUploading(false); }
  }

  async function handlePolish() {
    if (!instruction.trim()) return;
    setPolishing(true);
    const result = await polishPrompt(instruction, `goal: ${rules.commercialGoal}, video: ${meta?.durationSec}s`);
    setPolishedInstruction(result);
    setPolishing(false);
  }

  async function handleAnalyse() {
    const finalInstruction = polishedInstruction || instruction;
    if (!finalInstruction.trim()) { setAnalyseError("Please enter an instruction"); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setAnalyseError("");
    setAnalysing(true);
    try {
      const res = await fetch("/api/video-trimmer/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: tempPath, userInstruction: finalInstruction, trimRules: rules, metadata: meta }),
        signal: abortRef.current!.signal,
      });
      const data = await res.json();
      if (!res.ok) { setAnalyseError(data.error ?? "Analysis failed"); return; }
      setPlan(data.plan);
      setKept(new Set(data.plan.segments.map((s: TrimSegment) => s.segmentId)));
      setStep("review");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setAnalyseError("Network error during analysis");
    } finally { setAnalysing(false); }
  }

  async function handleExecute() {
    if (!plan) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    const approvedSegments = plan.segments.filter(s => kept.has(s.segmentId));
    if (approvedSegments.length === 0) { setExecuteError("Keep at least one segment"); return; }
    const approvedPlan: TrimPlan = {
      ...plan,
      segments: approvedSegments,
      outputDuration: approvedSegments.reduce((acc, s) => acc + s.durationSec * (s.repeat ?? 1), 0),
    };
    setExecuteError("");
    setExecuting(true);
    try {
      const res = await fetch("/api/video-trimmer/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: tempPath, plan: approvedPlan, options: { outputName: `trim_${Date.now()}` } }),
        signal: abortRef.current!.signal,
      });
      const data = await res.json();
      if (!res.ok) { setExecuteError(data.error ?? "Execution failed"); return; }
      setContentItemId(data.contentItemId);
      setStep("done");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setExecuteError("Network error during execution");
    } finally { setExecuting(false); }
  }

  async function handleBgImageRemove() {
    if (!bgFile) return;
    setBgError(""); setBgRemoving(true); setBgResult(null);
    const fd = new FormData(); fd.append("file", bgFile);
    try {
      const res = await fetch("/api/image/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setBgError(data.error ?? "Failed"); return; }
      setBgResult({ url: data.outputUrl, provider: data.provider });
    } catch { setBgError("Network error"); } finally { setBgRemoving(false); }
  }

  async function handleBgVideoRemove() {
    if (!bgVideoFile) return;
    setBgVideoError(""); setBgVideoRemoving(true); setBgVideoResult(null);
    const fd = new FormData(); fd.append("file", bgVideoFile);
    if (bgVideoPrompt) fd.append("newBackground", bgVideoPrompt);
    try {
      const res = await fetch("/api/video/bg-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setBgVideoError(data.error ?? "Failed"); return; }
      setBgVideoResult({ url: data.outputUrl, provider: data.provider });
    } catch { setBgVideoError("Network error"); } finally { setBgVideoRemoving(false); }
  }

  async function handleObjRemove() {
    if (!objFile || !objPrompt.trim()) return;
    setObjError(""); setObjRemoving(true); setObjResult(null);
    const fd = new FormData(); fd.append("file", objFile); fd.append("prompt", objPrompt);
    try {
      const res = await fetch("/api/video/object-remove", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) { setObjError(data.error ?? "Failed"); return; }
      setObjResult({ url: data.outputUrl, provider: data.provider });
    } catch { setObjError("Network error"); } finally { setObjRemoving(false); }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const card: React.CSSProperties = { background: "#0a0a12", border: "1px solid #1e2a35", borderRadius: 10, padding: "24px", marginBottom: 20 };
  const title: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#e0e8f0", marginBottom: 14 };
  const input: React.CSSProperties = { background: "#111520", color: "#e0e8f0", border: "1px solid #1e2a35", borderRadius: 6, padding: "7px 11px", fontSize: 12, width: "100%" };
  const primaryBtn: React.CSSProperties = { background: "#7c5cfc", color: "#fff", border: "none", borderRadius: 6, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" };
  const ghostBtn: React.CSSProperties = { background: "none", color: "#8090a0", border: "1px solid #1e2a35", borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const errStyle: React.CSSProperties = { color: "#f87171", fontSize: 12, marginTop: 6 };
  const badge: React.CSSProperties = { fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5 };

  const SIDE_TABS: { id: SideTab; label: string; provider: string; cost: string; color: string }[] = [
    { id: "trim", label: "✂ AI Trim", provider: "Claude / GPT", cost: "1 credit", color: "#7c5cfc" },
    { id: "bg_image", label: "🖼 Remove BG (Image)", provider: "Bria RMBG 2.0", cost: "~$0.01", color: "#22c55e" },
    { id: "bg_video", label: "🎬 Remove BG (Video)", provider: "fal.ai (VEED)", cost: "~$0.10/sec", color: "#00d4ff" },
    { id: "object_remove", label: "🧹 Remove Object", provider: "fal.ai Eraser", cost: "~$0.05", color: "#f59e0b" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px", color: "#e0e8f0" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: "#fff", marginBottom: 4 }}>AI Video Trimmer</h1>
        <p style={{ fontSize: 12, color: "#5a7080" }}>
          Trim, clean backgrounds, and remove objects from videos — powered by AI.
        </p>
      </div>

      {/* Tool tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {SIDE_TABS.map(t => (
          <button key={t.id} onClick={() => setSideTab(t.id)}
            style={{
              padding: "8px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
              border: `1px solid ${sideTab === t.id ? t.color : "#1e2a35"}`,
              background: sideTab === t.id ? `${t.color}12` : "transparent",
            }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: sideTab === t.id ? t.color : "#7a90a0" }}>{t.label}</p>
            <p style={{ fontSize: 9, color: sideTab === t.id ? t.color + "99" : "#3a5060" }}>
              {t.provider} · {t.cost}
            </p>
          </button>
        ))}
      </div>

      {/* ══ TAB: AI Trim ══ */}
      {sideTab === "trim" && (
        <>
          <StepIndicator current={step} />

          {step === "upload" && (
            <section style={card}>
              <h2 style={title}>Step 1 — Upload Video</h2>
              <div onClick={() => fileRef.current?.click()}
                style={{ border: "2px dashed #1e2a35", borderRadius: 8, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: "#080b10", fontSize: 13 }}>
                <p style={{ fontSize: 28, marginBottom: 8 }}>⬆</p>
                <p style={{ color: "#e0e8f0" }}>Drop video here or click to upload</p>
                <p style={{ fontSize: 11, color: "#3a5060", marginTop: 4 }}>MP4, MOV, MKV, WEBM — max 500 MB</p>
              </div>
              <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleUpload} />
              {uploading && <p style={{ color: "#8090a0", fontSize: 12, marginTop: 8 }}>Uploading and reading metadata…</p>}
              {uploadError && <p style={errStyle}>{uploadError}</p>}
            </section>
          )}

          {step === "instruct" && meta && (
            <section style={card}>
              <h2 style={title}>Step 2 — Instructions</h2>

              {/* Video info bar */}
              <div style={{ background: "#080b10", border: "1px solid #1e2a35", borderRadius: 6, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "#8090a0" }}>
                  {fmtSec(meta.durationSec)} · {meta.width}×{meta.height} · {meta.format.toUpperCase()}
                </span>
                <button onClick={() => { setStep("upload"); setTempPath(""); setMeta(null); }} style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 12 }}>✕ Remove</button>
              </div>

              {/* AI Model badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ ...badge, background: "#7c5cfc20", color: "#a080ff" }}>AI: Claude Haiku</span>
                <span style={{ ...badge, background: "#22c55e15", color: "#22c55e" }}>FREE</span>
                <span style={{ fontSize: 10, color: "#3a5060" }}>Upgrade in settings → GHS Pro / Premium for better cuts</span>
              </div>

              {/* Instruction + AI polish */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 10, color: "#5a7080", display: "block", marginBottom: 5 }}>YOUR INSTRUCTION</label>
                <textarea value={instruction} onChange={e => { setInstruction(e.target.value); setPolishedInstruction(""); }}
                  rows={3} style={{ ...input, resize: "vertical" }}
                  placeholder='e.g. "Trim this into a 30-second luxury shortlet commercial"' />
                <button onClick={handlePolish} disabled={polishing || !instruction.trim()}
                  style={{ marginTop: 6, fontSize: 10, color: "#00d4ff", background: "none", border: "1px solid #00d4ff30", borderRadius: 4, padding: "3px 10px", cursor: "pointer" }}>
                  {polishing ? "Polishing…" : "✨ AI Polish Prompt"}
                </button>
              </div>

              {polishedInstruction && (
                <div style={{ background: "#0a1020", border: "1px solid #00d4ff30", borderRadius: 6, padding: "10px 12px", marginBottom: 12 }}>
                  <p style={{ fontSize: 9, color: "#00d4ff", fontWeight: 700, marginBottom: 4 }}>AI POLISHED INSTRUCTION</p>
                  <p style={{ fontSize: 12, color: "#c0d8e8", lineHeight: 1.5 }}>{polishedInstruction}</p>
                  <button onClick={() => { setInstruction(polishedInstruction); setPolishedInstruction(""); }}
                    style={{ marginTop: 6, fontSize: 10, color: "#22c55e", background: "none", border: "none", cursor: "pointer" }}>
                    ← Use this instruction
                  </button>
                </div>
              )}

              {/* Goal + rules */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontSize: 10, color: "#5a7080", display: "block", marginBottom: 4 }}>COMMERCIAL GOAL</label>
                  <select value={rules.commercialGoal} onChange={e => setRules(r => ({ ...r, commercialGoal: e.target.value }))} style={input}>
                    {COMMERCIAL_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#5a7080", display: "block", marginBottom: 4 }}>MAX SCENE (sec)</label>
                  <input type="number" min={1} placeholder="no limit" value={rules.maxSceneDurationSec ?? ""}
                    onChange={e => setRules(r => ({ ...r, maxSceneDurationSec: e.target.value ? Number(e.target.value) : undefined }))}
                    style={input} />
                </div>
                <div>
                  <label style={{ fontSize: 10, color: "#5a7080", display: "block", marginBottom: 4 }}>TARGET (sec)</label>
                  <input type="number" min={1} placeholder="no limit" value={rules.targetDurationSec ?? ""}
                    onChange={e => setRules(r => ({ ...r, targetDurationSec: e.target.value ? Number(e.target.value) : undefined }))}
                    style={input} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#8090a0" }}>
                  <input type="checkbox" checked={rules.allowRepeat} onChange={e => setRules(r => ({ ...r, allowRepeat: e.target.checked }))} />
                  Allow scene repeat
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: "#8090a0" }}>
                  <input type="checkbox" checked={rules.addNarration} onChange={e => setRules(r => ({ ...r, addNarration: e.target.checked }))} />
                  Add narration after trim
                </label>
              </div>

              {rules.addNarration && (
                <div style={{ marginBottom: 14 }}>
                  <VoiceTierSelector value={voiceTier} onChange={setVoiceTier} compact />
                </div>
              )}

              {analyseError && <p style={errStyle}>{analyseError}</p>}
              <button onClick={handleAnalyse} disabled={analysing || !instruction.trim()} style={primaryBtn}>
                {analysing ? "Analysing with AI…" : "ANALYSE VIDEO"}
              </button>
            </section>
          )}

          {step === "review" && plan && (
            <section style={card}>
              <h2 style={title}>Step 3 — Review AI Trim Plan</h2>

              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                  ["Structure", plan.structure],
                  ["AI Model", plan.aiModel ?? "Claude Haiku"],
                  ["Est. output", `${Math.round(plan.segments.filter(s => kept.has(s.segmentId)).reduce((acc, s) => acc + s.durationSec * (s.repeat ?? 1), 0))}s`],
                  ["Segments", `${kept.size} / ${plan.segments.length} kept`],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: "#080b10", border: "1px solid #1e2a35", borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                    <span style={{ color: "#4a6070" }}>{l}: </span>
                    <span style={{ color: "#c0d0e0", fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.segments.map((seg, i) => (
                  <div key={seg.segmentId} style={{ border: `1px solid ${kept.has(seg.segmentId) ? "#1e2a35" : "#3a1a1a"}`, borderRadius: 6, padding: "10px 14px", background: kept.has(seg.segmentId) ? "#080b10" : "#120808", opacity: kept.has(seg.segmentId) ? 1 : 0.55 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#c0d0e0" }}>{i + 1}. {seg.label}</span>
                        <span style={{ fontSize: 11, color: "#4a6070", marginLeft: 10 }}>
                          {fmtSec(seg.startSec)} – {fmtSec(seg.endSec)} · {seg.durationSec}s
                          {seg.repeat > 1 && <span style={{ color: "#7c5cfc", marginLeft: 6 }}>×{seg.repeat}</span>}
                        </span>
                        <p style={{ fontSize: 11, color: "#4a6070", marginTop: 4 }}>{seg.note}</p>
                      </div>
                      <button onClick={() => setKept(prev => { const n = new Set(prev); if (n.has(seg.segmentId)) n.delete(seg.segmentId); else n.add(seg.segmentId); return n; })}
                        style={{ border: `1px solid ${kept.has(seg.segmentId) ? "#f87171" : "#22c55e"}`, borderRadius: 4, padding: "4px 12px", fontSize: 11, cursor: "pointer", background: "none", color: kept.has(seg.segmentId) ? "#f87171" : "#22c55e", fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
                        {kept.has(seg.segmentId) ? "Remove" : "Keep"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {executeError && <p style={{ ...errStyle, marginTop: 12 }}>{executeError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => { setStep("instruct"); setAnalyseError(""); }} style={ghostBtn}>← Re-analyse</button>
                <button onClick={handleExecute} disabled={executing || kept.size === 0} style={primaryBtn}>
                  {executing ? "Cutting video…" : "APPROVE AND CUT"}
                </button>
              </div>
            </section>
          )}

          {step === "done" && (
            <section style={card}>
              <h2 style={title}>✅ Trim Complete</h2>
              <p style={{ fontSize: 12, color: "#8090a0", marginBottom: 20 }}>Your trimmed video is processing. It will appear in the Review Queue shortly.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <a href="/dashboard/review" style={{ ...primaryBtn, textDecoration: "none", display: "inline-block" }}>Go to Review Queue</a>
                {contentItemId && <a href={`/dashboard/content/${contentItemId}`} style={{ ...ghostBtn, textDecoration: "none", display: "inline-block" }}>View Content Item</a>}
                <button onClick={() => { setStep("upload"); setTempPath(""); setMeta(null); setPlan(null); setKept(new Set()); setInstruction(""); setPolishedInstruction(""); setContentItemId(""); }} style={ghostBtn}>Trim Another</button>
              </div>
            </section>
          )}
        </>
      )}

      {/* ══ TAB: BG Image Removal ══ */}
      {sideTab === "bg_image" && (
        <section style={card}>
          <h2 style={title}>Remove Background — Image</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...badge, background: "#22c55e15", color: "#22c55e" }}>Bria RMBG 2.0</span>
            <span style={{ ...badge, background: "#00d4ff10", color: "#00d4ff" }}>fal.ai</span>
            <span style={{ fontSize: 10, color: "#3a5060" }}>~$0.01 / image · Phase 1</span>
          </div>

          <div onClick={() => bgFileRef.current?.click()} style={{ border: "2px dashed #1e2a35", borderRadius: 8, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {bgFile ? (
              <p style={{ fontSize: 12, color: "#c0d0e0" }}>{bgFile.name} ({(bgFile.size / 1024).toFixed(0)} KB)</p>
            ) : (
              <p style={{ fontSize: 12, color: "#4a6070" }}>Click to upload image (JPG, PNG, WebP)</p>
            )}
          </div>
          <input ref={bgFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setBgFile(e.target.files[0]); setBgResult(null); } }} />

          {bgResult && (
            <div style={{ marginBottom: 12, background: "#080b10", borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 10, color: "#22c55e", marginBottom: 8 }}>✓ Background removed · {bgResult.provider}</p>
              <img src={bgResult.url} alt="No background" style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid #1e2a35", background: "repeating-conic-gradient(#1a1a2e 0% 25%, #0a0a18 0% 50%) 0 0 / 20px 20px" }} />
              <a href={bgResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#7c5cfc", textDecoration: "underline" }}>Download PNG</a>
            </div>
          )}

          {bgError && <p style={errStyle}>{bgError}</p>}
          <button onClick={handleBgImageRemove} disabled={!bgFile || bgRemoving} style={{ ...primaryBtn, background: !bgFile || bgRemoving ? "#1e2a35" : "#22c55e", color: !bgFile || bgRemoving ? "#4a6070" : "#000" }}>
            {bgRemoving ? "Removing background…" : "Remove Background"}
          </button>
        </section>
      )}

      {/* ══ TAB: BG Video Removal ══ */}
      {sideTab === "bg_video" && (
        <section style={card}>
          <h2 style={title}>Remove Background — Video</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...badge, background: "#00d4ff10", color: "#00d4ff" }}>fal.ai (VEED pipeline)</span>
            <span style={{ fontSize: 10, color: "#3a5060" }}>~$0.10/sec · Phase 2</span>
          </div>

          <div onClick={() => bgVideoFileRef.current?.click()} style={{ border: "2px dashed #1e2a35", borderRadius: 8, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {bgVideoFile ? (
              <p style={{ fontSize: 12, color: "#c0d0e0" }}>{bgVideoFile.name} ({(bgVideoFile.size / 1024 / 1024).toFixed(1)} MB)</p>
            ) : (
              <p style={{ fontSize: 12, color: "#4a6070" }}>Click to upload video (MP4, MOV, WebM)</p>
            )}
          </div>
          <input ref={bgVideoFileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setBgVideoFile(e.target.files[0]); setBgVideoResult(null); } }} />

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: "#5a7080", display: "block", marginBottom: 5 }}>NEW BACKGROUND COLOR / DESCRIPTION (optional)</label>
            <input value={bgVideoPrompt} onChange={e => setBgVideoPrompt(e.target.value)} placeholder="white, #1a1a2e, transparent..." style={input} />
          </div>

          {bgVideoResult && (
            <div style={{ marginBottom: 12, background: "#080b10", borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 10, color: "#00d4ff", marginBottom: 8 }}>✓ Background removed · {bgVideoResult.provider}</p>
              <video src={bgVideoResult.url} controls style={{ maxWidth: "100%", borderRadius: 6 }} />
              <a href={bgVideoResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#7c5cfc", textDecoration: "underline" }}>Download</a>
            </div>
          )}

          {bgVideoError && <p style={errStyle}>{bgVideoError}</p>}
          <button onClick={handleBgVideoRemove} disabled={!bgVideoFile || bgVideoRemoving} style={{ ...primaryBtn, background: !bgVideoFile || bgVideoRemoving ? "#1e2a35" : "#00d4ff", color: !bgVideoFile || bgVideoRemoving ? "#4a6070" : "#000" }}>
            {bgVideoRemoving ? "Removing background…" : "Remove Video Background"}
          </button>
        </section>
      )}

      {/* ══ TAB: Object Removal ══ */}
      {sideTab === "object_remove" && (
        <section style={card}>
          <h2 style={title}>Remove Object from Video</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...badge, background: "#f59e0b15", color: "#f59e0b" }}>fal.ai Object Eraser</span>
            <span style={{ fontSize: 10, color: "#3a5060" }}>~$0.05 / clip</span>
          </div>

          <div onClick={() => objFileRef.current?.click()} style={{ border: "2px dashed #1e2a35", borderRadius: 8, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {objFile ? (
              <p style={{ fontSize: 12, color: "#c0d0e0" }}>{objFile.name} ({(objFile.size / 1024 / 1024).toFixed(1)} MB)</p>
            ) : (
              <p style={{ fontSize: 12, color: "#4a6070" }}>Click to upload video</p>
            )}
          </div>
          <input ref={objFileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setObjFile(e.target.files[0]); setObjResult(null); } }} />

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 10, color: "#5a7080", display: "block", marginBottom: 5 }}>WHAT TO REMOVE</label>
            <input value={objPrompt} onChange={e => setObjPrompt(e.target.value)} placeholder="the logo in top right corner, the person walking in background..." style={input} />
            <p style={{ fontSize: 10, color: "#3a5060", marginTop: 4 }}>Describe the object clearly. AI will detect and erase it from every frame.</p>
          </div>

          {objResult && (
            <div style={{ marginBottom: 12, background: "#080b10", borderRadius: 8, padding: 12 }}>
              <p style={{ fontSize: 10, color: "#f59e0b", marginBottom: 8 }}>✓ Object removed · {objResult.provider}</p>
              <video src={objResult.url} controls style={{ maxWidth: "100%", borderRadius: 6 }} />
              <a href={objResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: "#7c5cfc", textDecoration: "underline" }}>Download</a>
            </div>
          )}

          {objError && <p style={errStyle}>{objError}</p>}
          <button onClick={handleObjRemove} disabled={!objFile || !objPrompt.trim() || objRemoving} style={{ ...primaryBtn, background: !objFile || !objPrompt.trim() || objRemoving ? "#1e2a35" : "#f59e0b", color: !objFile || !objPrompt.trim() || objRemoving ? "#4a6070" : "#000" }}>
            {objRemoving ? "Removing object…" : "Remove Object"}
          </button>
        </section>
      )}
    </div>
  );
}

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload", label: "Upload" },
    { id: "instruct", label: "Instructions" },
    { id: "review", label: "Review Plan" },
    { id: "done", label: "Done" },
  ];
  const idx = steps.findIndex(s => s.id === current);
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 22 }}>
      {steps.map((s, i) => (
        <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, background: i < idx ? "#7c5cfc" : i === idx ? "#7c5cfc22" : "#1a1a2e", color: i <= idx ? "#a080ff" : "#3a5060", border: `1.5px solid ${i <= idx ? "#7c5cfc" : "#1e2a35"}` }}>
            {i < idx ? "✓" : i + 1}
          </div>
          <span style={{ fontSize: 10, color: i === idx ? "#c0d0e0" : "#3a5060", margin: "0 6px" }}>{s.label}</span>
          {i < steps.length - 1 && <span style={{ color: "#1e2a35", marginRight: 6 }}>—</span>}
        </div>
      ))}
    </div>
  );
}
