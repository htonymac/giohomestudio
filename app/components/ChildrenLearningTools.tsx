"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Children Learning Tools — All children-specific features in one module
//
// 1. Interactive Pause Points — "Can you say it?" pauses
// 2. Parent Voice Option — clone parent's voice for narration
// 3. Export Learning Package — video + word cards + worksheets
// 4. Safety Fingerprint — invisible tag marking child-verified content
// 5. Classroom Mode — teachers generate per-lesson content
// 6. Repetition Engine UI — shows review-due topics
// ═══════════════════════════════════════════════════════════════════════════

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const green = "#22c55e";
const gold = "#f59e0b";
const cyan = "#00d4ff";

// ── 1. Interactive Pause Points ──
interface PausePoint {
  id: string;
  time: number; // seconds
  type: "say_it" | "find_it" | "count_it" | "choose_it" | "clap_it";
  prompt: string; // what to show/ask
  answer?: string; // correct answer
  pauseDuration: number; // seconds to wait
}

const PAUSE_TYPES = [
  { id: "say_it" as const, label: "Can you say it?", icon: "🗣", desc: "Child repeats a word or letter" },
  { id: "find_it" as const, label: "Can you find it?", icon: "🔍", desc: "Child points to something on screen" },
  { id: "count_it" as const, label: "Can you count?", icon: "🔢", desc: "Child counts objects shown" },
  { id: "choose_it" as const, label: "Which one?", icon: "❓", desc: "Child picks the correct answer" },
  { id: "clap_it" as const, label: "Clap along!", icon: "👏", desc: "Child claps syllables or rhythm" },
];

export function InteractivePauseEditor({ pauses, onChange, totalDuration }: {
  pauses: PausePoint[];
  onChange: (pauses: PausePoint[]) => void;
  totalDuration: number;
}) {
  const [newType, setNewType] = useState<PausePoint["type"]>("say_it");

  const addPause = () => {
    const pause: PausePoint = {
      id: `pause_${Date.now()}`,
      time: Math.min(totalDuration / 2, 10),
      type: newType,
      prompt: PAUSE_TYPES.find(t => t.id === newType)?.label || "Can you say it?",
      pauseDuration: 5,
    };
    onChange([...pauses, pause]);
  };

  const updatePause = (id: string, changes: Partial<PausePoint>) => {
    onChange(pauses.map(p => p.id === id ? { ...p, ...changes } : p));
  };

  const removePause = (id: string) => onChange(pauses.filter(p => p.id !== id));

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>⏸</span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Interactive Pause Points</p>
        <span style={{ fontSize: 10, color: green }}>{pauses.length} pause(s)</span>
      </div>

      <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>Add moments where the video pauses and asks the child to participate — say a word, count objects, clap along.</p>

      {/* Add new pause */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        {PAUSE_TYPES.map(t => (
          <button key={t.id} onClick={() => setNewType(t.id)}
            style={{ padding: "4px 10px", borderRadius: 8, border: `1px solid ${newType === t.id ? purple : border}`, background: newType === t.id ? `${purple}10` : "transparent", color: newType === t.id ? purple : muted, fontSize: 9, cursor: "pointer" }}>
            {t.icon} {t.label}
          </button>
        ))}
        <button onClick={addPause} style={{ padding: "4px 12px", borderRadius: 8, background: purple, color: "#fff", fontSize: 10, border: "none", cursor: "pointer", fontWeight: 600 }}>+ Add</button>
      </div>

      {/* Pause list */}
      {pauses.map(p => (
        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}`, marginBottom: 4 }}>
          <span style={{ fontSize: 14 }}>{PAUSE_TYPES.find(t => t.id === p.type)?.icon}</span>
          <input value={p.prompt} onChange={e => updatePause(p.id, { prompt: e.target.value })}
            style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 11, outline: "none" }} />
          <span style={{ fontSize: 9, color: muted }}>@{p.time.toFixed(0)}s</span>
          <input type="range" min="0" max={totalDuration} value={p.time} onChange={e => updatePause(p.id, { time: parseFloat(e.target.value) })}
            style={{ width: 60, accentColor: purple }} />
          <span style={{ fontSize: 9, color: muted }}>{p.pauseDuration}s</span>
          <button onClick={() => removePause(p.id)} style={{ fontSize: 10, color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>
      ))}

      <p style={{ fontSize: 8, color: "#3d5060", marginTop: 6 }}>
        FFmpeg inserts a freeze-frame + text overlay at each pause point. Timer countdown shown on screen.
      </p>
    </div>
  );
}

// ── 2. Parent Voice Option ──
export function ParentVoiceUploader({ onVoiceReady }: { onVoiceReady: (voiceUrl: string) => void }) {
  const [uploading, setUploading] = useState(false);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);

  const handleUpload = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) { setVoiceUrl(data.url); onVoiceReady(data.url); }
    } catch { /* upload failed */ }
    setUploading(false);
  };

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>👩‍👧</span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Parent Voice Narration</p>
      </div>
      <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>
        Record or upload a parent/guardian voice sample. GHS will use this voice for narration — children respond better to familiar voices.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <label style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${cyan}30`, background: `${cyan}10`, color: cyan, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {uploading ? "Uploading..." : "Upload Voice Sample"}
          <input type="file" accept="audio/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        </label>
        <button onClick={() => setRecording(!recording)}
          style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${recording ? "#ef4444" : purple}30`, background: recording ? "rgba(239,68,68,0.1)" : `${purple}10`, color: recording ? "#ef4444" : purple, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          {recording ? "Stop Recording" : "Record Now"}
        </button>
      </div>
      {voiceUrl && (
        <div style={{ marginTop: 10 }}>
          <audio src={voiceUrl} controls style={{ width: "100%", height: 32 }} />
          <p style={{ fontSize: 9, color: green, marginTop: 4 }}>Voice sample ready — will be used for narration</p>
        </div>
      )}
      <p style={{ fontSize: 8, color: "#3d5060", marginTop: 8 }}>
        Voice is only used for this project. Read the text prompt aloud (30-60 seconds is enough for voice matching).
      </p>
    </div>
  );
}

// ── 3. Export Learning Package ──
export function LearningPackageExport({ projectTitle, wordsLearned, conceptsCovered }: {
  projectTitle: string;
  wordsLearned: string[];
  conceptsCovered: string[];
}) {
  const [exporting, setExporting] = useState(false);

  const generateWordCards = () => {
    // Generate printable HTML word cards
    const html = `<!DOCTYPE html><html><head><title>${projectTitle} - Word Cards</title>
    <style>body{font-family:sans-serif;margin:0;padding:20px}
    .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
    .card{border:2px solid #7c5cfc;border-radius:16px;padding:24px;text-align:center;page-break-inside:avoid}
    .word{font-size:36px;font-weight:800;color:#333;margin-bottom:8px}
    .hint{font-size:14px;color:#888}
    h1{color:#7c5cfc;margin-bottom:20px}
    @media print{.no-print{display:none}}</style></head>
    <body><h1>${projectTitle} — Word Cards</h1><p class="no-print">Print these cards for hands-on learning!</p>
    <div class="cards">${wordsLearned.map(w => `<div class="card"><div class="word">${w}</div><div class="hint">Can you say "${w}"?</div></div>`).join("")}</div></body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${projectTitle}_word_cards.html`; a.click();
    URL.revokeObjectURL(url);
  };

  const generateWorksheet = () => {
    const html = `<!DOCTYPE html><html><head><title>${projectTitle} - Worksheet</title>
    <style>body{font-family:sans-serif;margin:0;padding:30px;color:#333}
    h1{color:#7c5cfc}h2{color:#555;margin-top:24px}
    .q{padding:12px 0;border-bottom:1px solid #eee;font-size:16px}
    .line{border-bottom:2px dotted #ccc;height:30px;margin:8px 0}
    @media print{.no-print{display:none}}</style></head>
    <body><h1>${projectTitle} — Worksheet</h1><p class="no-print">Print this worksheet!</p>
    <h2>Write the words:</h2>${wordsLearned.slice(0, 10).map(w => `<div class="q">Write: <strong>${w}</strong><div class="line"></div></div>`).join("")}
    <h2>What did you learn?</h2>${conceptsCovered.map(c => `<div class="q">☐ ${c.replace(/_/g, " ")}</div>`).join("")}
    <h2>Draw your favourite part:</h2><div style="border:2px solid #eee;height:200px;border-radius:12px;margin-top:8px"></div>
    </body></html>`;

    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${projectTitle}_worksheet.html`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 16 }}>📦</span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Export Learning Package</p>
      </div>
      <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>
        Download the video plus printable learning materials. Word cards for hands-on practice, worksheets for follow-up.
      </p>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={generateWordCards} disabled={wordsLearned.length === 0}
          style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${gold}30`, background: `${gold}10`, color: gold, fontSize: 11, cursor: wordsLearned.length > 0 ? "pointer" : "not-allowed", fontWeight: 600 }}>
          Word Cards ({wordsLearned.length})
        </button>
        <button onClick={generateWorksheet}
          style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${purple}30`, background: `${purple}10`, color: purple, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          Worksheet
        </button>
        <button style={{ padding: "8px 16px", borderRadius: 10, border: `1px solid ${green}30`, background: `${green}10`, color: green, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>
          Video + Materials ZIP
        </button>
      </div>
    </div>
  );
}

// ── 4. Safety Fingerprint ──
export function SafetyFingerprint({ projectId, verified }: { projectId: string; verified: boolean }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "4px 12px", borderRadius: 100, background: verified ? "rgba(34,197,94,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${verified ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}` }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: verified ? green : "#ef4444" }} />
      <span style={{ fontSize: 9, fontWeight: 600, color: verified ? green : "#ef4444", letterSpacing: 0.5 }}>
        {verified ? "CHILD-VERIFIED" : "NOT VERIFIED"}
      </span>
      <span style={{ fontSize: 8, color: muted }}>ID: {projectId.slice(0, 8)}</span>
    </div>
  );
}

// ── 5. Classroom Mode ──
export function ClassroomModePanel({ onGenerate }: {
  onGenerate: (lesson: { subject: string; topic: string; gradeLevel: string; duration: number; objectives: string[] }) => void;
}) {
  const [subject, setSubject] = useState("mathematics");
  const [topic, setTopic] = useState("");
  const [gradeLevel, setGradeLevel] = useState("grade_1");
  const [duration, setDuration] = useState(10);
  const [objectives, setObjectives] = useState("");

  const SUBJECTS = ["mathematics", "english", "science", "social_studies", "art", "music", "physical_education", "religious_studies", "french", "computer_science"];
  const GRADES = ["pre_primary", "grade_1", "grade_2", "grade_3", "grade_4", "grade_5", "grade_6"];

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 16 }}>🏫</span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Classroom Mode</p>
        <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "rgba(59,130,246,0.1)", color: "#3b82f6", border: "1px solid rgba(59,130,246,0.2)" }}>For Teachers</span>
      </div>
      <p style={{ fontSize: 10, color: muted, marginBottom: 12 }}>
        Generate lesson-specific video content aligned to your curriculum. Enter the topic and learning objectives — AI creates the video lesson.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
        <div>
          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Subject</p>
          <select value={subject} onChange={e => setSubject(e.target.value)}
            style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
            {SUBJECTS.map(s => <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
        </div>
        <div>
          <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Grade Level</p>
          <select value={gradeLevel} onChange={e => setGradeLevel(e.target.value)}
            style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none" }}>
            {GRADES.map(g => <option key={g} value={g}>{g.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>)}
          </select>
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Lesson Topic</p>
        <input value={topic} onChange={e => setTopic(e.target.value)}
          placeholder="e.g. 'Addition of 2-digit numbers' or 'Parts of a plant'"
          style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none" }} />
      </div>

      <div style={{ marginBottom: 10 }}>
        <p style={{ fontSize: 9, color: muted, marginBottom: 4 }}>Learning Objectives (one per line)</p>
        <textarea value={objectives} onChange={e => setObjectives(e.target.value)} rows={3}
          placeholder="Students will be able to:&#10;- Add two 2-digit numbers&#10;- Use carrying/regrouping&#10;- Solve word problems"
          style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <p style={{ fontSize: 9, color: muted }}>Duration: {duration} min</p>
        <input type="range" min="3" max="25" value={duration} onChange={e => setDuration(parseInt(e.target.value))}
          style={{ flex: 1, accentColor: "#3b82f6" }} />
      </div>

      <button onClick={() => onGenerate({
        subject, topic, gradeLevel, duration: duration * 60,
        objectives: objectives.split("\n").map(o => o.replace(/^[-•]\s*/, "").trim()).filter(Boolean),
      })} disabled={!topic.trim()}
        style={{ width: "100%", padding: 12, borderRadius: 10, border: "none", background: topic.trim() ? "#3b82f6" : "#2a2a40", color: "#fff", fontSize: 13, fontWeight: 700, cursor: topic.trim() ? "pointer" : "not-allowed" }}>
        Generate Lesson Video
      </button>
    </div>
  );
}

// ── 6. Repetition Engine UI ──
export function RepetitionReviewCard({ reviewDue, onStartReview }: {
  reviewDue: string[];
  onStartReview: (topics: string[]) => void;
}) {
  if (reviewDue.length === 0) return null;

  return (
    <div style={{ background: "rgba(245,158,11,0.05)", border: "1px solid rgba(245,158,11,0.2)", borderRadius: 12, padding: 16, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16 }}>🔄</span>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Time to Review!</p>
        <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: `${gold}15`, color: gold }}>{reviewDue.length} topic(s)</span>
      </div>
      <p style={{ fontSize: 10, color: muted, marginBottom: 10 }}>
        These topics were taught before. A quick &quot;Remember?&quot; review helps children retain what they learned.
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        {reviewDue.map(t => (
          <span key={t} style={{ fontSize: 10, padding: "3px 10px", borderRadius: 8, background: `${gold}10`, border: `1px solid ${gold}25`, color: gold }}>
            {t.replace(/_/g, " ")}
          </span>
        ))}
      </div>
      <button onClick={() => onStartReview(reviewDue)}
        style={{ padding: "8px 16px", borderRadius: 10, background: gold, color: "#000", fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer" }}>
        Start Review Session
      </button>
    </div>
  );
}
