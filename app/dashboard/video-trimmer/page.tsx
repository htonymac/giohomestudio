"use client";

import { useState, useRef, useEffect } from "react";
import type { TrimPlan, TrimSegment, TrimRules } from "@/modules/ffmpeg/trim-plan";

type Step = "upload" | "instruct" | "review" | "done";

interface VideoMeta {
  durationSec: number;
  width: number;
  height: number;
  format: string;
}

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

export default function VideoTrimmerPage() {
  const [step, setStep]         = useState<Step>("upload");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [tempPath, setTempPath] = useState("");
  const [meta, setMeta]         = useState<VideoMeta | null>(null);

  const [instruction, setInstruction] = useState("");
  const [rules, setRules]             = useState<TrimRules>(DEFAULT_RULES);
  const [analysing, setAnalysing]     = useState(false);
  const [analyseError, setAnalyseError] = useState("");

  const [plan, setPlan]           = useState<TrimPlan | null>(null);
  const [kept, setKept]           = useState<Set<string>>(new Set());
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState("");

  const [contentItemId, setContentItemId] = useState("");
  const fileRef    = useRef<HTMLInputElement>(null);
  const abortRef   = useRef<AbortController | null>(null);

  useEffect(() => () => { abortRef.current?.abort(); }, []);

  // ── Step 1: Upload ──────────────────────────────────────────

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
      const res  = await fetch("/api/video-trimmer/upload", { method: "POST", body: form, signal: abortRef.current.signal });
      const data = await res.json();
      if (!res.ok) { setUploadError(data.error ?? "Upload failed"); return; }
      setTempPath(data.tempPath);
      setMeta(data.metadata);
      setStep("instruct");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setUploadError("Network error during upload");
    } finally {
      setUploading(false);
    }
  }

  // ── Step 2: Analyse ─────────────────────────────────────────

  async function handleAnalyse() {
    if (!instruction.trim()) { setAnalyseError("Please enter an instruction"); return; }
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setAnalyseError("");
    setAnalysing(true);
    try {
      const res  = await fetch("/api/video-trimmer/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath: tempPath, userInstruction: instruction, trimRules: rules, metadata: meta }),
        signal: abortRef.current!.signal,
      });
      const data = await res.json();
      if (!res.ok) { setAnalyseError(data.error ?? "Analysis failed"); return; }
      setPlan(data.plan);
      setKept(new Set(data.plan.segments.map((s: TrimSegment) => s.segmentId)));
      setStep("review");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setAnalyseError("Network error during analysis");
    } finally {
      setAnalysing(false);
    }
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
      const res  = await fetch("/api/video-trimmer/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: tempPath,
          plan: approvedPlan,
          options: { outputName: `trim_${Date.now()}` },
        }),
        signal: abortRef.current!.signal,
      });
      const data = await res.json();
      if (!res.ok) { setExecuteError(data.error ?? "Execution failed"); return; }
      setContentItemId(data.contentItemId);
      setStep("done");
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") setExecuteError("Network error during execution");
    } finally {
      setExecuting(false);
    }
  }

  // ── Render ──────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px", color: "#e5e5e5" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>AI Video Trimmer</h1>
      <p style={{ fontSize: 13, color: "#888", marginBottom: 28 }}>
        Upload a video, give AI an instruction, review the cut plan, then execute.
      </p>

      {/* ── Step indicator ── */}
      <StepIndicator current={step} />

      {/* ── Step 1: Upload ── */}
      {step === "upload" && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Step 1 — Upload Video</h2>
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              border: "2px dashed #333", borderRadius: 8, padding: "40px 24px",
              textAlign: "center", cursor: "pointer", color: "#888",
              background: "#0f0f0f", fontSize: 13,
            }}
          >
            <p style={{ fontSize: 28, marginBottom: 8 }}>⬆</p>
            <p>Drop video here or click to upload</p>
            <p style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Supported: MP4, MOV, MKV, WEBM — max 500 MB</p>
          </div>
          <input ref={fileRef} type="file" accept="video/*" style={{ display: "none" }} onChange={handleUpload} />
          {uploading && <p style={infoStyle}>Uploading and reading metadata…</p>}
          {uploadError && <p style={errorStyle}>{uploadError}</p>}
        </section>
      )}

      {/* ── Step 2: Instructions ── */}
      {step === "instruct" && meta && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Step 2 — Instructions</h2>

          <div style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6, padding: "10px 14px", marginBottom: 18, fontSize: 13, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong style={{ color: "#ccc" }}>Video loaded:</strong>
              <span style={{ color: "#888", marginLeft: 8 }}>
                {fmtSec(meta.durationSec)} long · {meta.width}×{meta.height} · {meta.format.toUpperCase()}
              </span>
            </div>
            <button
              onClick={() => { setStep("upload"); setTempPath(""); setMeta(null); setUploadError(""); }}
              style={{ background: "none", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >✕ Remove</button>
          </div>

          <FieldRow label="Your instruction">
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              rows={3}
              style={{ ...inputStyle, width: "100%", resize: "vertical" }}
              placeholder='e.g. "Trim this into a 30-second luxury shortlet commercial"'
            />
          </FieldRow>

          <p style={{ fontSize: 11, color: "#555", fontWeight: 600, margin: "14px 0 8px", textTransform: "uppercase", letterSpacing: 1 }}>
            Trim Rules
          </p>

          <FieldRow label="Commercial goal">
            <select value={rules.commercialGoal} onChange={e => setRules(r => ({ ...r, commercialGoal: e.target.value }))} style={inputStyle}>
              {COMMERCIAL_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </FieldRow>

          <FieldRow label="Max scene (sec)">
            <input
              type="number" min={1} placeholder="no limit"
              value={rules.maxSceneDurationSec ?? ""}
              onChange={e => setRules(r => ({ ...r, maxSceneDurationSec: e.target.value ? Number(e.target.value) : undefined }))}
              style={{ ...inputStyle, width: 100 }}
            />
          </FieldRow>

          <FieldRow label="Target duration (sec)">
            <input
              type="number" min={1} placeholder="no limit"
              value={rules.targetDurationSec ?? ""}
              onChange={e => setRules(r => ({ ...r, targetDurationSec: e.target.value ? Number(e.target.value) : undefined }))}
              style={{ ...inputStyle, width: 100 }}
            />
          </FieldRow>

          <FieldRow label="Allow repeat">
            <ToggleSwitch checked={rules.allowRepeat} onChange={v => setRules(r => ({ ...r, allowRepeat: v }))} />
          </FieldRow>

          <FieldRow label="Add narration after trim">
            <ToggleSwitch checked={rules.addNarration} onChange={v => setRules(r => ({ ...r, addNarration: v }))} />
          </FieldRow>

          {analyseError && <p style={errorStyle}>{analyseError}</p>}

          <button onClick={handleAnalyse} disabled={analysing || !instruction.trim()} style={primaryBtn}>
            {analysing ? "Analysing with AI…" : "ANALYSE VIDEO"}
          </button>
        </section>
      )}

      {/* ── Step 3: Review Plan ── */}
      {step === "review" && plan && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Step 3 — Review AI Trim Plan</h2>

          <div style={{ display: "flex", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <PlanStat label="Structure" value={plan.structure} />
            <PlanStat label="AI Model" value={plan.aiModel} />
            <PlanStat
              label="Estimated output"
              value={`${Math.round(plan.segments.filter(s => kept.has(s.segmentId)).reduce((acc, s) => acc + s.durationSec * (s.repeat ?? 1), 0))}s`}
            />
            <PlanStat label="Segments kept" value={`${kept.size} / ${plan.segments.length}`} />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {plan.segments.map((seg, i) => (
              <SegmentCard
                key={seg.segmentId}
                seg={seg}
                index={i + 1}
                kept={kept.has(seg.segmentId)}
                onToggle={() => {
                  setKept(prev => {
                    const next = new Set(prev);
                    if (next.has(seg.segmentId)) next.delete(seg.segmentId);
                    else next.add(seg.segmentId);
                    return next;
                  });
                }}
              />
            ))}
          </div>

          {executeError && <p style={{ ...errorStyle, marginTop: 12 }}>{executeError}</p>}

          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            <button onClick={() => { setStep("instruct"); setAnalyseError(""); }} style={ghostBtn}>
              ← Re-analyse
            </button>
            <button onClick={handleExecute} disabled={executing || kept.size === 0} style={primaryBtn}>
              {executing ? "Cutting video…" : "APPROVE AND CUT"}
            </button>
          </div>
        </section>
      )}

      {/* ── Step 4: Done ── */}
      {step === "done" && (
        <section style={cardStyle}>
          <h2 style={sectionTitle}>Trim Complete</h2>
          <p style={{ fontSize: 13, color: "#9090b0", marginBottom: 20 }}>
            Your trimmed video is being processed. It will appear in the Review Queue shortly.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <a href="/dashboard/review" style={{ ...primaryBtn, textDecoration: "none", display: "inline-block" }}>
              Go to Review Queue
            </a>
            {contentItemId && (
              <a href={`/dashboard/content/${contentItemId}`} style={{ ...ghostBtn, textDecoration: "none", display: "inline-block" }}>
                View Content Item
              </a>
            )}
            <button onClick={() => {
              setStep("upload"); setTempPath(""); setMeta(null);
              setPlan(null); setKept(new Set()); setInstruction("");
              setContentItemId(""); setUploadError(""); setAnalyseError(""); setExecuteError("");
            }} style={ghostBtn}>
              Trim Another
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: Step }) {
  const steps: { id: Step; label: string }[] = [
    { id: "upload",   label: "Upload" },
    { id: "instruct", label: "Instructions" },
    { id: "review",   label: "Review Plan" },
    { id: "done",     label: "Done" },
  ];
  const idx = steps.findIndex(s => s.id === current);
  return (
    <div style={{ display: "flex", gap: 0, marginBottom: 28 }}>
      {steps.map((s, i) => {
        const active = i === idx;
        const done   = i < idx;
        return (
          <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 11, fontWeight: 700,
              background: done ? "#7c5cfc" : active ? "#7c5cfc22" : "#1a1a2e",
              color: done || active ? "#7c5cfc" : "#555",
              border: `1.5px solid ${done || active ? "#7c5cfc" : "#2a2a40"}`,
            }}>
              {done ? "✓" : i + 1}
            </div>
            <span style={{ fontSize: 11, color: active ? "#e5e5e5" : "#555", marginLeft: 6, marginRight: 6 }}>{s.label}</span>
            {i < steps.length - 1 && <span style={{ color: "#333", marginRight: 6 }}>—</span>}
          </div>
        );
      })}
    </div>
  );
}

function SegmentCard({ seg, index, kept, onToggle }: { seg: TrimSegment; index: number; kept: boolean; onToggle: () => void }) {
  return (
    <div style={{
      border: `1px solid ${kept ? "#2a2a40" : "#3a1a1a"}`,
      borderRadius: 6, padding: "10px 14px",
      background: kept ? "#0f0f0f" : "#1a0a0a",
      opacity: kept ? 1 : 0.6,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 600, color: kept ? "#ccc" : "#666" }}>
            {index}. {seg.label}
          </span>
          <span style={{ fontSize: 12, color: "#555", marginLeft: 10 }}>
            {fmtSec(seg.startSec)} – {fmtSec(seg.endSec)} · {seg.durationSec}s
            {seg.repeat > 1 && <span style={{ color: "#7c5cfc", marginLeft: 6 }}>×{seg.repeat}</span>}
          </span>
          <p style={{ fontSize: 12, color: "#666", marginTop: 4 }}>{seg.note}</p>
        </div>
        <button
          onClick={onToggle}
          style={{
            border: "1px solid",
            borderColor: kept ? "#f87171" : "#4ade80",
            borderRadius: 4, padding: "3px 10px",
            fontSize: 12, cursor: "pointer", background: "none",
            color: kept ? "#f87171" : "#4ade80",
            fontWeight: 600, flexShrink: 0, marginLeft: 12,
          }}
        >
          {kept ? "Remove" : "Keep"}
        </button>
      </div>
    </div>
  );
}

function PlanStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "#0f0f0f", border: "1px solid #2a2a2a", borderRadius: 6, padding: "8px 14px", fontSize: 12 }}>
      <span style={{ color: "#555" }}>{label}: </span>
      <span style={{ color: "#ccc", fontWeight: 600 }}>{value}</span>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
      <span style={{ fontSize: 12, color: "#888", minWidth: 160 }}>{label}</span>
      {children}
    </div>
  );
}

function ToggleSwitch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer",
        background: checked ? "#7c5cfc" : "#2a2a40",
        position: "relative", transition: "background 0.2s",
      }}
    >
      <span style={{
        position: "absolute", top: 3, left: checked ? 20 : 3,
        width: 16, height: 16, borderRadius: "50%", background: "#fff",
        transition: "left 0.2s",
      }} />
    </button>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const cardStyle: React.CSSProperties = {
  background: "#0a0a12", border: "1px solid #2a2a40", borderRadius: 10,
  padding: "24px 24px 20px", marginBottom: 24,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 15, fontWeight: 700, color: "#ccc", marginBottom: 16,
};

const inputStyle: React.CSSProperties = {
  background: "#1a1a1a", color: "#e5e5e5", border: "1px solid #333",
  borderRadius: 4, padding: "5px 9px", fontSize: 12,
};

const primaryBtn: React.CSSProperties = {
  background: "#7c5cfc", color: "#fff", border: "none",
  borderRadius: 6, padding: "8px 20px", fontSize: 13,
  fontWeight: 700, cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "none", color: "#9090b0", border: "1px solid #2a2a40",
  borderRadius: 6, padding: "8px 16px", fontSize: 13,
  fontWeight: 600, cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  color: "#f87171", fontSize: 12, marginTop: 8,
};

const infoStyle: React.CSSProperties = {
  color: "#9090b0", fontSize: 12, marginTop: 8,
};
