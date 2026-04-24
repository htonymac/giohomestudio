"use client";

import { useState, useRef, useEffect } from "react";
import type { TrimPlan, TrimSegment, TrimRules } from "@/modules/ffmpeg/trim-plan";
import VoiceTierSelector, { type VoiceTierConfig } from "../../components/VoiceTierSelector";
import { ds } from "../../../lib/designSystem";
import { HeroTitle } from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { Image, Film, X, Check, Folder } from "../../components/icons";

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

// ── Shared style tokens ──────────────────────────────────────────────────────

const inputSt: React.CSSProperties = {
  background: ds.color.card,
  color: ds.color.ink,
  border: `1px solid ${ds.color.line2}`,
  borderRadius: ds.radius.sm,
  padding: "10px 12px",
  fontSize: 13,
  width: "100%",
  fontFamily: ds.font.sans,
  outline: "none",
};

const microLabel: React.CSSProperties = {
  fontSize: 10,
  fontFamily: ds.font.mono,
  fontWeight: 700,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: ds.color.mute,
  display: "block",
  marginBottom: 5,
};

const errStyle: React.CSSProperties = { color: ds.color.coral, fontSize: 12, marginTop: 6 };

const badge: React.CSSProperties = {
  fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 4, letterSpacing: 0.5, fontFamily: ds.font.mono,
};

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

  const SIDE_TABS: { id: SideTab; label: string; icon: React.ReactNode; provider: string; cost: string }[] = [
    { id: "trim",          label: "AI Trim",           icon: <Film size={12} />,  provider: "Claude / GPT", cost: "1 credit" },
    { id: "bg_image",      label: "Remove BG (Image)", icon: <Image size={12} />, provider: "Bria RMBG 2.0", cost: "~$0.01" },
    { id: "bg_video",      label: "Remove BG (Video)", icon: <Film size={12} />,  provider: "fal.ai (VEED)", cost: "~$0.10/sec" },
    { id: "object_remove", label: "Remove Object",     icon: <X size={12} />,    provider: "fal.ai Eraser", cost: "~$0.05" },
  ];

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "28px 20px", color: ds.color.ink, fontFamily: ds.font.sans }}>
      {/* Hero */}
      <div style={{ marginBottom: 28 }}>
        <HeroTitle kicker="Studio / Edit" title="AI Video" italic="Trimmer" sub="Trim, clean backgrounds, and remove objects from videos — powered by AI." />
      </div>

      {/* Tool tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
        {SIDE_TABS.map(t => (
          <button key={t.id} onClick={() => setSideTab(t.id)}
            style={{
              padding: "8px 14px", borderRadius: 8, cursor: "pointer", textAlign: "left",
              border: `1px solid ${sideTab === t.id ? ds.color.lilac : ds.color.line2}`,
              background: sideTab === t.id ? "rgba(167,139,250,0.12)" : ds.color.card,
              transition: "all 0.15s",
            }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: sideTab === t.id ? ds.color.lilac : ds.color.ink2, display: "flex", alignItems: "center", gap: 5 }}>
              {t.icon} {t.label}
            </p>
            <p style={{ fontSize: 9, color: sideTab === t.id ? ds.color.lilac + "99" : ds.color.mute2, fontFamily: ds.font.mono }}>
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
            <Card radius={10} padding={24} style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 14 }}>Step 1 — Upload Video</h2>
              <div onClick={() => fileRef.current?.click()}
                style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "40px 20px", textAlign: "center", cursor: "pointer", background: "transparent", fontSize: 13 }}>
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 8, color: ds.color.mute }}><Folder size={28} /></div>
                <p style={{ color: ds.color.ink2 }}>Drop video here or click to upload</p>
                <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 4 }}>MP4, MOV, MKV, WEBM — max 500 MB</p>
              </div>
              <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleUpload} />
              {uploading && <p style={{ color: ds.color.mute, fontSize: 12, marginTop: 8 }}>Uploading and reading metadata…</p>}
              {uploadError && <p style={errStyle}>{uploadError}</p>}
            </Card>
          )}

          {step === "instruct" && meta && (
            <Card radius={10} padding={24} style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 14 }}>Step 2 — Instructions</h2>

              {/* Video info bar */}
              <div style={{ background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 12, color: ds.color.mute, fontFamily: ds.font.mono }}>
                  {fmtSec(meta.durationSec)} · {meta.width}×{meta.height} · {meta.format.toUpperCase()}
                </span>
                <button onClick={() => { setStep("upload"); setTempPath(""); setMeta(null); }}
                  style={{ background: "none", border: "none", color: ds.color.coral, cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                  <X size={12} /> Remove
                </button>
              </div>

              {/* AI Model badge */}
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{ ...badge, background: "rgba(167,139,250,0.12)", color: ds.color.lilac }}>AI: Claude Haiku</span>
                <span style={{ ...badge, background: "rgba(122,224,195,0.12)", color: ds.color.mint }}>FREE</span>
                <span style={{ fontSize: 10, color: ds.color.mute2 }}>Upgrade in settings for better cuts</span>
              </div>

              {/* Instruction + AI polish */}
              <div style={{ marginBottom: 12 }}>
                <label style={microLabel}>Your Instruction</label>
                <textarea value={instruction} onChange={e => { setInstruction(e.target.value); setPolishedInstruction(""); }}
                  rows={3} style={{ ...inputSt, resize: "vertical" }}
                  placeholder='e.g. "Trim this into a 30-second luxury shortlet commercial"' />
                <button onClick={handlePolish} disabled={polishing || !instruction.trim()}
                  style={{ marginTop: 6, fontSize: 10, color: ds.color.sky, background: "none", border: `1px solid ${ds.color.sky}30`, borderRadius: 4, padding: "3px 10px", cursor: "pointer", fontFamily: ds.font.mono }}>
                  {polishing ? "Polishing…" : "AI Polish Prompt"}
                </button>
              </div>

              {polishedInstruction && (
                <Card radius={6} padding="10px 12px" style={{ marginBottom: 12, borderColor: `${ds.color.sky}30` }}>
                  <p style={{ fontSize: 9, color: ds.color.sky, fontWeight: 700, marginBottom: 4, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.12em" }}>AI Polished Instruction</p>
                  <p style={{ fontSize: 12, color: ds.color.ink2, lineHeight: 1.5 }}>{polishedInstruction}</p>
                  <button onClick={() => { setInstruction(polishedInstruction); setPolishedInstruction(""); }}
                    style={{ marginTop: 6, fontSize: 10, color: ds.color.mint, background: "none", border: "none", cursor: "pointer" }}>
                    ← Use this instruction
                  </button>
                </Card>
              )}

              {/* Goal + rules */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={microLabel}>Commercial Goal</label>
                  <select value={rules.commercialGoal} onChange={e => setRules(r => ({ ...r, commercialGoal: e.target.value }))} style={inputSt}>
                    {COMMERCIAL_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label style={microLabel}>Max Scene (sec)</label>
                  <input type="number" min={1} placeholder="no limit" value={rules.maxSceneDurationSec ?? ""}
                    onChange={e => setRules(r => ({ ...r, maxSceneDurationSec: e.target.value ? Number(e.target.value) : undefined }))}
                    style={inputSt} />
                </div>
                <div>
                  <label style={microLabel}>Target (sec)</label>
                  <input type="number" min={1} placeholder="no limit" value={rules.targetDurationSec ?? ""}
                    onChange={e => setRules(r => ({ ...r, targetDurationSec: e.target.value ? Number(e.target.value) : undefined }))}
                    style={inputSt} />
                </div>
              </div>

              <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: ds.color.ink2 }}>
                  <input type="checkbox" checked={rules.allowRepeat} onChange={e => setRules(r => ({ ...r, allowRepeat: e.target.checked }))} />
                  Allow scene repeat
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 12, color: ds.color.ink2 }}>
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
              <ButtonPrimary onClick={handleAnalyse} disabled={analysing || !instruction.trim()}>
                {analysing ? "Analysing with AI…" : "Analyse Video"}
              </ButtonPrimary>
            </Card>
          )}

          {step === "review" && plan && (
            <Card radius={10} padding={24} style={{ marginBottom: 20 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 14 }}>Step 3 — Review AI Trim Plan</h2>

              <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
                {[
                  ["Structure", plan.structure],
                  ["AI Model", plan.aiModel ?? "Claude Haiku"],
                  ["Est. output", `${Math.round(plan.segments.filter(s => kept.has(s.segmentId)).reduce((acc, s) => acc + s.durationSec * (s.repeat ?? 1), 0))}s`],
                  ["Segments", `${kept.size} / ${plan.segments.length} kept`],
                ].map(([l, v]) => (
                  <div key={l} style={{ background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "8px 12px", fontSize: 11 }}>
                    <span style={{ color: ds.color.mute, fontFamily: ds.font.mono }}>{l}: </span>
                    <span style={{ color: ds.color.ink2, fontWeight: 600 }}>{v}</span>
                  </div>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {plan.segments.map((seg, i) => (
                  <div key={seg.segmentId} style={{ border: `1px solid ${kept.has(seg.segmentId) ? ds.color.line2 : "rgba(255,122,69,.2)"}`, borderRadius: 6, padding: "10px 14px", background: kept.has(seg.segmentId) ? ds.color.card : "rgba(255,122,69,.04)", opacity: kept.has(seg.segmentId) ? 1 : 0.55 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: ds.color.ink2 }}>{i + 1}. {seg.label}</span>
                        <span style={{ fontSize: 11, color: ds.color.mute, marginLeft: 10, fontFamily: ds.font.mono }}>
                          {fmtSec(seg.startSec)} – {fmtSec(seg.endSec)} · {seg.durationSec}s
                          {seg.repeat > 1 && <span style={{ color: ds.color.lilac, marginLeft: 6 }}>×{seg.repeat}</span>}
                        </span>
                        <p style={{ fontSize: 11, color: ds.color.mute, marginTop: 4 }}>{seg.note}</p>
                      </div>
                      <button onClick={() => setKept(prev => { const n = new Set(prev); if (n.has(seg.segmentId)) n.delete(seg.segmentId); else n.add(seg.segmentId); return n; })}
                        style={{ border: `1px solid ${kept.has(seg.segmentId) ? ds.color.coral : ds.color.mint}`, borderRadius: 4, padding: "4px 12px", fontSize: 11, cursor: "pointer", background: "none", color: kept.has(seg.segmentId) ? ds.color.coral : ds.color.mint, fontWeight: 700, flexShrink: 0, marginLeft: 12 }}>
                        {kept.has(seg.segmentId) ? "Remove" : "Keep"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {executeError && <p style={{ ...errStyle, marginTop: 12 }}>{executeError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button onClick={() => { setStep("instruct"); setAnalyseError(""); }}
                  style={{ background: "none", color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  ← Re-analyse
                </button>
                <ButtonPrimary onClick={handleExecute} disabled={executing || kept.size === 0}>
                  {executing ? "Cutting video…" : "Approve and Cut"}
                </ButtonPrimary>
              </div>
            </Card>
          )}

          {step === "done" && (
            <Card radius={10} padding={24} style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <Check size={18} style={{ color: ds.color.mint }} />
                <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink }}>Trim Complete</h2>
              </div>
              <p style={{ fontSize: 12, color: ds.color.mute, marginBottom: 20 }}>Your trimmed video is processing. It will appear in the Review Queue shortly.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <ButtonPrimary onClick={() => window.location.href = "/dashboard/review"}>Go to Review Queue</ButtonPrimary>
                {contentItemId && <a href={`/dashboard/content/${contentItemId}`} style={{ border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: ds.color.mute, textDecoration: "none", display: "inline-block" }}>View Content Item</a>}
                <button onClick={() => { setStep("upload"); setTempPath(""); setMeta(null); setPlan(null); setKept(new Set()); setInstruction(""); setPolishedInstruction(""); setContentItemId(""); }}
                  style={{ background: "none", color: ds.color.mute, border: `1px solid ${ds.color.line2}`, borderRadius: 6, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Trim Another
                </button>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ══ TAB: BG Image Removal ══ */}
      {sideTab === "bg_image" && (
        <Card radius={10} padding={24}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 12 }}>Remove Background — Image</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...badge, background: "rgba(122,224,195,0.12)", color: ds.color.mint }}>Bria RMBG 2.0</span>
            <span style={{ ...badge, background: "rgba(124,196,255,0.1)", color: ds.color.sky }}>fal.ai</span>
            <span style={{ fontSize: 10, color: ds.color.mute2 }}>~$0.01 / image · Phase 1</span>
          </div>

          <div onClick={() => bgFileRef.current?.click()} style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {bgFile ? <p style={{ fontSize: 12, color: ds.color.ink2 }}>{bgFile.name} ({(bgFile.size / 1024).toFixed(0)} KB)</p> : <p style={{ fontSize: 12, color: ds.color.mute }}>Click to upload image (JPG, PNG, WebP)</p>}
          </div>
          <input ref={bgFileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setBgFile(e.target.files[0]); setBgResult(null); } }} />

          {bgResult && (
            <Card radius={8} padding={12} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: ds.color.mint, marginBottom: 8 }}>Background removed · {bgResult.provider}</p>
              <img src={bgResult.url} alt="No background" style={{ maxWidth: "100%", borderRadius: 6, border: `1px solid ${ds.color.line2}`, background: "repeating-conic-gradient(#1a1a2e 0% 25%, #0a0a18 0% 50%) 0 0 / 20px 20px" }} />
              <a href={bgResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: ds.color.lilac, textDecoration: "underline" }}>Download PNG</a>
            </Card>
          )}

          {bgError && <p style={errStyle}>{bgError}</p>}
          <ButtonPrimary onClick={handleBgImageRemove} disabled={!bgFile || bgRemoving}>
            {bgRemoving ? "Removing background…" : "Remove Background"}
          </ButtonPrimary>
        </Card>
      )}

      {/* ══ TAB: BG Video Removal ══ */}
      {sideTab === "bg_video" && (
        <Card radius={10} padding={24}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 12 }}>Remove Background — Video</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...badge, background: "rgba(124,196,255,0.1)", color: ds.color.sky }}>fal.ai (VEED pipeline)</span>
            <span style={{ fontSize: 10, color: ds.color.mute2 }}>~$0.10/sec · Phase 2</span>
          </div>

          <div onClick={() => bgVideoFileRef.current?.click()} style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {bgVideoFile ? <p style={{ fontSize: 12, color: ds.color.ink2 }}>{bgVideoFile.name} ({(bgVideoFile.size / 1024 / 1024).toFixed(1)} MB)</p> : <p style={{ fontSize: 12, color: ds.color.mute }}>Click to upload video (MP4, MOV, WebM)</p>}
          </div>
          <input ref={bgVideoFileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setBgVideoFile(e.target.files[0]); setBgVideoResult(null); } }} />

          <div style={{ marginBottom: 12 }}>
            <label style={microLabel}>New Background Color / Description (optional)</label>
            <input value={bgVideoPrompt} onChange={e => setBgVideoPrompt(e.target.value)} placeholder="white, #1a1a2e, transparent..." style={inputSt} />
          </div>

          {bgVideoResult && (
            <Card radius={8} padding={12} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: ds.color.sky, marginBottom: 8 }}>Background removed · {bgVideoResult.provider}</p>
              <video src={bgVideoResult.url} controls style={{ maxWidth: "100%", borderRadius: 6 }} />
              <a href={bgVideoResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: ds.color.lilac, textDecoration: "underline" }}>Download</a>
            </Card>
          )}

          {bgVideoError && <p style={errStyle}>{bgVideoError}</p>}
          <ButtonPrimary onClick={handleBgVideoRemove} disabled={!bgVideoFile || bgVideoRemoving}>
            {bgVideoRemoving ? "Removing background…" : "Remove Video Background"}
          </ButtonPrimary>
        </Card>
      )}

      {/* ══ TAB: Object Removal ══ */}
      {sideTab === "object_remove" && (
        <Card radius={10} padding={24}>
          <h2 style={{ fontSize: 15, fontWeight: 700, color: ds.color.ink, marginBottom: 12 }}>Remove Object from Video</h2>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <span style={{ ...badge, background: "rgba(255,179,71,0.12)", color: ds.color.gold }}>fal.ai Object Eraser</span>
            <span style={{ fontSize: 10, color: ds.color.mute2 }}>~$0.05 / clip</span>
          </div>

          <div onClick={() => objFileRef.current?.click()} style={{ border: `2px dashed ${ds.color.line2}`, borderRadius: 8, padding: "30px 20px", textAlign: "center", cursor: "pointer", marginBottom: 12 }}>
            {objFile ? <p style={{ fontSize: 12, color: ds.color.ink2 }}>{objFile.name} ({(objFile.size / 1024 / 1024).toFixed(1)} MB)</p> : <p style={{ fontSize: 12, color: ds.color.mute }}>Click to upload video</p>}
          </div>
          <input ref={objFileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) { setObjFile(e.target.files[0]); setObjResult(null); } }} />

          <div style={{ marginBottom: 12 }}>
            <label style={microLabel}>What to Remove</label>
            <input value={objPrompt} onChange={e => setObjPrompt(e.target.value)} placeholder="the logo in top right corner, the person walking in background..." style={inputSt} />
            <p style={{ fontSize: 10, color: ds.color.mute2, marginTop: 4 }}>Describe the object clearly. AI will detect and erase it from every frame.</p>
          </div>

          {objResult && (
            <Card radius={8} padding={12} style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, color: ds.color.gold, marginBottom: 8 }}>Object removed · {objResult.provider}</p>
              <video src={objResult.url} controls style={{ maxWidth: "100%", borderRadius: 6 }} />
              <a href={objResult.url} download style={{ display: "inline-block", marginTop: 8, fontSize: 11, color: ds.color.lilac, textDecoration: "underline" }}>Download</a>
            </Card>
          )}

          {objError && <p style={errStyle}>{objError}</p>}
          <ButtonPrimary onClick={handleObjRemove} disabled={!objFile || !objPrompt.trim() || objRemoving}>
            {objRemoving ? "Removing object…" : "Remove Object"}
          </ButtonPrimary>
        </Card>
      )}
    </div>
  );
}

// ── Step Indicator ────────────────────────────────────────────────────────────

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
          <div style={{
            width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700,
            background: i < idx ? ds.color.lilac : i === idx ? "rgba(167,139,250,0.13)" : ds.color.card,
            color: i <= idx ? ds.color.lilac : ds.color.mute2,
            border: `1.5px solid ${i <= idx ? ds.color.lilac : ds.color.line2}`,
          }}>
            {i < idx ? <Check size={10} /> : i + 1}
          </div>
          <span style={{ fontSize: 10, color: i === idx ? ds.color.ink2 : ds.color.mute2, margin: "0 6px", fontFamily: ds.font.mono }}>{s.label}</span>
          {i < steps.length - 1 && <span style={{ color: ds.color.line2, marginRight: 6 }}>—</span>}
        </div>
      ))}
    </div>
  );
}

