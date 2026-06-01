"use client";

/**
 * Karaoke Music Planner — Surface 2 (under Planners)
 * Path: /dashboard/karaoke-music-planner
 *
 * 18-step pipeline workshop (canvas §2)
 * Mode-aware step gating
 * Left panel: workshop history of all takes
 * Flow lock: Music Gen disabled until Steps 3+5+7+9 complete
 *
 * Canvas §29: Voice is truth. Flow is authority.
 */

import React, { useState, useCallback, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import type { MixSettings } from "../../components/KaraokeAudioEditor";

const KaraokeAudioEditor = dynamic(() => import("../../components/KaraokeAudioEditor"), { ssr: false });

// ── Types ──────────────────────────────────────────────────────────────────────

type KaraokeMode = "A" | "B" | "C" | "D" | "E";

type StepStatus =
  | "pending"     // not yet run
  | "running"     // in progress
  | "done"        // complete
  | "post_linux"  // blocked — needs Demucs/BasicPitch/RVC
  | "skipped"     // not applicable for this mode
  | "locked"      // flow lock — prerequisite not met
  | "error";      // failed

interface StepState {
  status: StepStatus;
  output?: Record<string, unknown>;
  error?: string;
}

interface Recording {
  id: string;
  fileName: string;
  fileUrl: string;
  durationSec?: number;
  transcript?: string;
  createdAt: string;
  analysis?: Record<string, unknown>;
  mode?: string;
  flowProfile?: FlowProfile;
  productionBrief?: ProductionBrief;
  generatedMusicUrl?: string;
  mixedOutputUrl?: string;
  exportedFiles?: unknown;
}

interface FlowProfile {
  voiceType: string;
  phraseGaps: number[];
  hookCandidates: string[];
  cadenceLabel: string;
}

interface ProductionBrief {
  genre: string;
  tempo: number;
  key: string;
  mood: string;
  structure: string;
  duration: number;
  energyCurve: string;
  selectedBeatFamily: string;
  instructions: string;
}

interface BeatRec {
  rank: number;
  beatFamily: string;
  reasoning: string;
  tempoFit: string;
  energyFit: string;
}

// ── Mode labels ────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<KaraokeMode, string> = {
  A: "Voice → Music — Steps 1–17",
  B: "Voice → Karaoke — Steps 1–9, 12–16 (no music gen)",
  C: "Voice → Polished Demo — Steps 1–17",
  D: "Voice → Lyrics + Music — Steps 1–17 (Lyrics required first)",
  E: "Voice → Beat Match — Steps 1–8 + beat sample",
};

// ── Step definitions ───────────────────────────────────────────────────────────

interface StepDef {
  num: number;
  title: string;
  subtitle: string;
  postLinux?: boolean;
  skipForModes?: KaraokeMode[];
}

const STEP_DEFS: StepDef[] = [
  { num: 1, title: "Voice Input", subtitle: "Received from Karaoke Music Creator" },
  { num: 2, title: "Vocal Cleanup", subtitle: "Demucs — separate vocals from background noise" },
  { num: 3, title: "Audio Analysis", subtitle: "Tempo · Key · Beats · Energy · Mood · Genre (librosa + Whisper)" },
  { num: 4, title: "Melody Extraction", subtitle: "Basic Pitch — voice → MIDI note events" },
  { num: 5, title: "Lyrics Extraction", subtitle: "Whisper transcription with word timestamps" },
  { num: 6, title: "Lyrics Intelligence", subtitle: "5-level AI polish (Claude Haiku) — your line is always option 1" },
  { num: 7, title: "Flow Profiling", subtitle: "Classify voice type · Detect phrase gaps · Hook candidates" },
  { num: 8, title: "Beat Recommendation", subtitle: "Top 3 beat families from 11 options based on your flow" },
  { num: 9, title: "Production Brief", subtitle: "AI builds structured music instructions from all analysis" },
  { num: 10, title: "Music Generation", subtitle: "Without Kie key: Stable Audio (FAL, ≤47s instrumental) or Stock Library (free local mp3) — pipeline still completes. Kie unlocks lyrical Suno-style music." },
  { num: 11, title: "Voice Enhancement", subtitle: "RVC — professional vocal quality polish", postLinux: true },
  { num: 12, title: "Audio Mixing", subtitle: "Voice + music blend controls — Web Audio API" },
  { num: 13, title: "Review Interface", subtitle: "Waveform + lyrics overlay + lyric-time markers" },
  { num: 14, title: "Version Comparison", subtitle: "Compare saved mixes side-by-side" },
  { num: 15, title: "Final Assembly", subtitle: "FFmpeg combines voice + music with ducking" },
  { num: 16, title: "Export", subtitle: "MP3 · WAV · Vocal-only · Instrumental · Karaoke · Short clip · Hook" },
  { num: 17, title: "Music Video Pipeline", subtitle: "Optional — send to Music Video Planner", skipForModes: ["E"] },
  { num: 18, title: "Storage Lifecycle", subtitle: "30-day retention · AES-256 at rest (compliance todo)" },
];

// ── Utility helpers ────────────────────────────────────────────────────────────

// Henry 2026-05-31: read a Response that MIGHT return non-JSON (HTML 5xx, gateway timeout
// page) and produce a clear error instead of letting JSON.parse explode with
// "Unexpected token 'I', 'Internal S'..." — that error message is opaque to users.
async function safeKaraokeJson<T = unknown>(res: Response, step: string): Promise<{ ok: boolean; data?: T; error?: string }> {
  const text = await res.text();
  if (!text.trim()) return { ok: false, error: `${step}: empty response (HTTP ${res.status})` };
  try {
    const data = JSON.parse(text) as T & { error?: string };
    if (res.ok && !data.error) return { ok: true, data };
    return { ok: false, error: data.error || `${step}: HTTP ${res.status}`, data };
  } catch {
    // Non-JSON body — surface HTTP code + first sentence of body so user knows what happened.
    const snippet = text.replace(/<[^>]+>/g, "").trim().slice(0, 160);
    return { ok: false, error: `${step}: HTTP ${res.status} (server returned non-JSON: ${snippet || "no body"})` };
  }
}

function statusBadge(status: StepStatus, postLinux?: boolean): { label: string; color: string; bg: string } {
  if (postLinux || status === "post_linux") {
    return { label: "⏸ post-Linux", color: "#ffb347", bg: "rgba(255,179,71,0.1)" };
  }
  const map: Record<StepStatus, { label: string; color: string; bg: string }> = {
    pending:    { label: "⏳ pending",  color: "#7b7b80", bg: "rgba(255,255,255,0.04)" },
    running:    { label: "🔄 running",  color: "#7cc4ff", bg: "rgba(124,196,255,0.1)" },
    done:       { label: "✅ done",     color: "#7ae0c3", bg: "rgba(122,224,195,0.1)" },
    post_linux: { label: "⏸ post-Linux", color: "#ffb347", bg: "rgba(255,179,71,0.1)" },
    skipped:    { label: "⏭ skipped",  color: "#55555a", bg: "rgba(255,255,255,0.02)" },
    locked:     { label: "🔒 locked",   color: "#ff7a45", bg: "rgba(255,122,69,0.07)" },
    error:      { label: "❌ error",    color: "#ff7a45", bg: "rgba(255,122,69,0.1)" },
  };
  return map[status] || map.pending;
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 6000);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <div
      onClick={onDismiss}
      style={{
        position: "fixed",
        bottom: 32,
        right: 32,
        background: "#1a1a1e",
        border: "1px solid rgba(167,139,250,0.3)",
        borderRadius: 10,
        padding: "12px 20px",
        maxWidth: 400,
        fontSize: 14,
        color: "#c5c5c8",
        fontWeight: 500,
        zIndex: 1000,
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        cursor: "pointer",
        lineHeight: 1.5,
      }}
    >
      {message}
    </div>
  );
}

// ── Inner planner (receives searchParams) ──────────────────────────────────────

function KaraokeMusicPlannerInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qRecordingId = searchParams.get("recordingId");
  const qMode = (searchParams.get("mode") as KaraokeMode) || "A";

  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(qRecordingId);
  const [activeMode, setActiveMode] = useState<KaraokeMode>(qMode);
  const [editingTakeId, setEditingTakeId] = useState<string | null>(null);
  const [editingTakeName, setEditingTakeName] = useState("");

  // Sync URL param → state (handles Next.js hydration race where useState initializes before searchParams resolves)
  useEffect(() => {
    if (qRecordingId && activeRecordingId !== qRecordingId) {
      setActiveRecordingId(qRecordingId);
    }
  }, [qRecordingId, activeRecordingId]);

  // Sync ?mode= URL param → state on hydration race (same pattern as qRecordingId above)
  useEffect(() => {
    const rawMode = searchParams.get("mode");
    if (rawMode && (["A","B","C","D","E"] as string[]).includes(rawMode) && rawMode !== activeMode) {
      setActiveMode(rawMode as KaraokeMode);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Henry 2026-06-01: deep-link URL state for sharing/bookmarking
  // Writes ?recordingId=…&?mode=… back to the URL whenever they change.
  // Uses replaceState (not pushState) so back-button history stays clean.
  // Debounced 200ms to avoid history spam on rapid clicks.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handle = setTimeout(() => {
      const search = new URLSearchParams(window.location.search);
      if (activeRecordingId) search.set("recordingId", activeRecordingId);
      else search.delete("recordingId");
      if (activeMode && activeMode !== "A") search.set("mode", activeMode);
      else search.delete("mode");
      const next = search.toString();
      const url = `/dashboard/karaoke-music-planner${next ? `?${next}` : ""}`;
      if (url !== window.location.pathname + window.location.search) {
        window.history.replaceState(null, "", url);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [activeRecordingId, activeMode]);

  const [recording, setRecording] = useState<Recording | null>(null);
  const [allTakes, setAllTakes] = useState<Recording[]>([]);
  const [steps, setSteps] = useState<Record<number, StepState>>(() => {
    const initial: Record<number, StepState> = {};
    STEP_DEFS.forEach((s) => {
      initial[s.num] = { status: s.postLinux ? "post_linux" : "pending" };
    });
    initial[1] = { status: "done" }; // Voice Input already received
    return initial;
  });

  // Henry 2026-06-01: tab title sync — easy to find a take across many tabs
  useEffect(() => {
    if (typeof document === "undefined") return;
    const baseTitle = "Karaoke Planner";
    const takeName = recording?.fileName || (activeRecordingId ? activeRecordingId.slice(0, 8) : "");
    const anyRunning = Object.values(steps).some(s => s?.status === "running");
    const indicator = anyRunning ? "● " : "";

    const title = takeName
      ? `${indicator}${takeName} — ${baseTitle}`
      : `${indicator}${baseTitle}`;

    document.title = title;

    return () => {
      document.title = baseTitle;
    };
  }, [recording?.fileName, activeRecordingId, steps]);

  const [toastMsg, setToastMsg] = useState("");
  const showToast = useCallback((msg: string) => setToastMsg(msg), []);

  // Step-specific state
  const [musicTier, setMusicTier] = useState<"stock" | "ghs_pro" | "ghs_classic">("stock");
  const [lyricLines, setLyricLines] = useState<{ id: string; text: string }[]>([]);
  const [flowProfile, setFlowProfile] = useState<FlowProfile | null>(null);
  const [beatRecs, setBeatRecs] = useState<BeatRec[]>([]);
  const [selectedBeatFamily, setSelectedBeatFamily] = useState<string>("");
  const [productionBrief, setProductionBrief] = useState<ProductionBrief | null>(null);
  const [briefInstructions, setBriefInstructions] = useState("");
  const [generatedMusicUrl, setGeneratedMusicUrl] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState("mp3");
  const [exportUrls, setExportUrls] = useState<{format: string; url: string; licenseFileUrl?: string}[]>([]);
  // Henry 2026-06-01: ZIP bundle builder state for "Export ALL formats as ZIP" button in Step 16.
  const [bundleBuilding, setBundleBuilding] = useState(false);
  // Henry 2026-05-31: per-user toggle for RVC voice-enhancement. Default OFF since
  // Contabo server has no GPU (CPU mode adds ~10–20 min per recording). Persisted
  // in localStorage so the choice survives reloads.
  const [keepRvc, setKeepRvc] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ghs_karaoke_keep_rvc") === "1";
  });
  // Henry 2026-05-31 — AI Singing toggles (T2-B + T2-C from KARAOKE_PLAN_05312026.md).
  // Backend disabled — this server has no GPU. UI ready for GPU activation later.
  const [keepDiffSinger, setKeepDiffSinger] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ghs_karaoke_keep_diffsinger") === "1";
  });
  const [keepBark, setKeepBark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ghs_karaoke_keep_bark") === "1";
  });
  const [mixedOutputUrl, setMixedOutputUrl] = useState<string | null>(null);

  // Simulated progress bars for Step 2 (Demucs ~1 min) and Step 4 (Basic Pitch ~30s).
  // null = not running; number = 0–100 (stops at 90 until real response arrives).
  const [step2Progress, setStep2Progress] = useState<number | null>(null);
  const [step4Progress, setStep4Progress] = useState<number | null>(null);

  // Keyboard shortcut help overlay (? / /)
  const [showKeyboardHelp, setShowKeyboardHelp] = useState(false);

  // ── Check flow lock ─────────────────────────────────────────────────────────

  const isFlowLocked = useCallback((): boolean => {
    return (
      steps[3]?.status !== "done" ||
      steps[5]?.status !== "done" ||
      steps[7]?.status !== "done" ||
      steps[9]?.status !== "done"
    );
  }, [steps]);

  // ── Load recording + hydrate step state ──────────────────────────────────────

  const loadRecording = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/karaoke/list?userId=anonymous&limit=100`);
      const data = await res.json();
      const recs: Recording[] = data.recordings || [];
      const rec = recs.find((r) => r.id === id);
      if (rec) {
        setRecording(rec);
        if (rec.mode) setActiveMode(rec.mode as KaraokeMode);

        // Henry 2026-05-31: switching recordings was leaving stale per-recording state
        // visible — beatRecs / brief / lyric lines / music / mix / exports / selected
        // beat family all stayed from the PREVIOUS project. Reset them ALL up front,
        // then re-hydrate only the fields the new recording actually has below.
        setFlowProfile(null);
        setBeatRecs([]);
        setSelectedBeatFamily("");
        setProductionBrief(null);
        setBriefInstructions("");
        setGeneratedMusicUrl(null);
        setMixedOutputUrl(null);
        setLyricLines([]);
        setExportUrls([]);

        // Hydrate steps from existing DB data
        const newSteps: Record<number, StepState> = {};
        STEP_DEFS.forEach((s) => {
          newSteps[s.num] = { status: s.postLinux ? "post_linux" : "pending" };
        });
        newSteps[1] = { status: "done" };

        if (rec.analysis) {
          newSteps[3] = { status: "done", output: rec.analysis as Record<string, unknown> };
        }
        if (rec.transcript) {
          newSteps[5] = { status: "done" };
          setLyricLines(
            rec.transcript
              .split(/\n/)
              .map((t, i) => ({ id: `line-${i}`, text: t.trim() }))
              .filter((l) => l.text)
          );
        }

        // Hydrate steps 7, 8, 9, 10, 15 from DB fields
        if (rec.flowProfile) {
          newSteps[7] = { status: "done", output: rec.flowProfile as unknown as Record<string, unknown> };
          setFlowProfile(rec.flowProfile);
        }
        if (rec.productionBrief) {
          newSteps[8] = { status: "done" };
          newSteps[9] = { status: "done", output: rec.productionBrief as unknown as Record<string, unknown> };
          setProductionBrief(rec.productionBrief);
          setBriefInstructions(rec.productionBrief.instructions || "");
        }
        if (rec.generatedMusicUrl) {
          newSteps[10] = { status: "done", output: { url: rec.generatedMusicUrl } };
          setGeneratedMusicUrl(rec.generatedMusicUrl);
        }
        if (rec.mixedOutputUrl) {
          newSteps[15] = { status: "done", output: { url: rec.mixedOutputUrl } };
          setMixedOutputUrl(rec.mixedOutputUrl);
        }

        setSteps(newSteps);
      }
    } catch {
      // silent
    }
  }, []);

  const loadAllTakes = useCallback(async () => {
    try {
      const res = await fetch("/api/karaoke/list?userId=anonymous&limit=20");
      const data = await res.json();
      setAllTakes(data.recordings || []);
    } catch {
      setAllTakes([]);
    }
  }, []);

  useEffect(() => {
    loadAllTakes();
    if (activeRecordingId) {
      loadRecording(activeRecordingId);
    }
  }, [activeRecordingId, loadAllTakes, loadRecording]);

  // ── Auto-restore from localStorage on mount (ghs_karaoke_planner_draft) ────
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("ghs_karaoke_planner_draft");
      if (!raw) return;
      const d = JSON.parse(raw);
      if (d.activeMode !== undefined) setActiveMode(d.activeMode as KaraokeMode);
      if (Array.isArray(d.lyricLines)) setLyricLines(d.lyricLines);
      if (d.flowProfile !== undefined && d.flowProfile !== null) setFlowProfile(d.flowProfile as FlowProfile);
      if (Array.isArray(d.beatRecs)) setBeatRecs(d.beatRecs as BeatRec[]);
      if (d.selectedBeatFamily !== undefined) setSelectedBeatFamily(d.selectedBeatFamily);
      if (d.productionBrief !== undefined && d.productionBrief !== null) setProductionBrief(d.productionBrief as ProductionBrief);
      if (d.briefInstructions !== undefined) setBriefInstructions(d.briefInstructions);
      if (d.generatedMusicUrl !== undefined) setGeneratedMusicUrl(d.generatedMusicUrl);
      if (d.exportFormat !== undefined) setExportFormat(d.exportFormat);
      if (Array.isArray(d.exportUrls)) setExportUrls(d.exportUrls);
      if (d.mixedOutputUrl !== undefined) setMixedOutputUrl(d.mixedOutputUrl);
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save to localStorage (ghs_karaoke_planner_draft) ─────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const draft = {
      activeMode, lyricLines, flowProfile, beatRecs, selectedBeatFamily,
      productionBrief, briefInstructions, generatedMusicUrl, exportFormat,
      exportUrls, mixedOutputUrl,
    };
    try {
      localStorage.setItem("ghs_karaoke_planner_draft", JSON.stringify(draft));
    } catch { /* quota — ignore */ }
  }, [activeMode, lyricLines, flowProfile, beatRecs, selectedBeatFamily, productionBrief, briefInstructions, generatedMusicUrl, exportFormat, exportUrls, mixedOutputUrl]);

  // ── Keyboard shortcuts: J = next take · K = prev take · Space = play/pause · ? = help ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (e: KeyboardEvent) => {
      // Disable when user is typing in a text field
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === "INPUT" || tgt.tagName === "TEXTAREA" || tgt.isContentEditable)) return;

      if (e.key === "j" || e.key === "J") {
        // Next take
        e.preventDefault();
        if (allTakes.length === 0) return;
        const idx = allTakes.findIndex(t => t.id === activeRecordingId);
        const next = allTakes[(idx + 1) % allTakes.length];
        if (next) {
          setActiveRecordingId(next.id);
          setActiveMode((next.mode as KaraokeMode) || "A");
        }
      } else if (e.key === "k" || e.key === "K") {
        // Previous take
        e.preventDefault();
        if (allTakes.length === 0) return;
        const idx = allTakes.findIndex(t => t.id === activeRecordingId);
        const prev = allTakes[(idx - 1 + allTakes.length) % allTakes.length];
        if (prev) {
          setActiveRecordingId(prev.id);
          setActiveMode((prev.mode as KaraokeMode) || "A");
        }
      } else if (e.key === " " && mixedOutputUrl) {
        // Toggle Now Playing audio
        e.preventDefault();
        const audio = document.querySelector<HTMLAudioElement>("audio[src='" + mixedOutputUrl + "']");
        if (audio) {
          if (audio.paused) audio.play().catch(() => {});
          else audio.pause();
        }
      } else if (e.key === "?" || e.key === "/") {
        // Toggle keyboard shortcut help panel
        e.preventDefault();
        setShowKeyboardHelp(s => !s);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [allTakes, activeRecordingId, mixedOutputUrl]);

  const setStepStatus = (num: number, status: StepStatus, output?: Record<string, unknown>, error?: string) => {
    setSteps((prev) => ({ ...prev, [num]: { status, output, error } }));
  };

  // ── Step 3: Audio Analysis ──────────────────────────────────────────────────

  const runAnalysis = useCallback(async () => {
    if (!activeRecordingId) return;
    setStepStatus(3, "running");
    try {
      const res = await fetch("/api/karaoke/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId }),
      });
      const parsed = await safeKaraokeJson<{ recordingId: string; analysis: Record<string, unknown> }>(res, "Audio Analysis");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setStepStatus(3, "done", parsed.data.analysis);

      // Step 5 auto-completes if transcript returned
      if (parsed.data.analysis?.transcription) {
        setStepStatus(5, "done");
        setLyricLines(
          String(parsed.data.analysis.transcription)
            .split(/\n/)
            .map((t, i) => ({ id: `line-${i}`, text: t.trim() }))
            .filter((l) => l.text)
        );
      }

      showToast(`Analysis complete — ${Math.round((parsed.data.analysis?.tempo_bpm as number) || 0)} BPM, ${(parsed.data.analysis?.detected_key as string) || ""}, ${(parsed.data.analysis?.suggested_genre as string) || ""}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Analysis failed";
      setStepStatus(3, "error", undefined, msg);
      showToast(`Analysis error: ${msg}`);
    }
  }, [activeRecordingId, showToast]);

  // ── Step 2: Vocal Cleanup (Demucs) — Henry 2026-05-31 ─────────────────────

  const runVocalCleanup = useCallback(async () => {
    if (!activeRecordingId) return;
    setStepStatus(2, "running");
    // Simulated progress: creeps to 90%, waits for real response, cleared in finally.
    setStep2Progress(0);
    const tick2 = setInterval(() => {
      setStep2Progress(p => {
        if (p === null) return 5;
        if (p >= 90) return p;
        return p + (Math.random() * 3 + 1);
      });
    }, 1000);
    try {
      const res = await fetch("/api/karaoke/vocal-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId }),
      });
      const parsed = await safeKaraokeJson<{ vocalUrl: string; instrumentalUrl: string; tookMs: number }>(res, "Vocal Cleanup");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setStepStatus(2, "done", { vocalUrl: parsed.data.vocalUrl, instrumentalUrl: parsed.data.instrumentalUrl } as unknown as Record<string, unknown>);
      showToast(`Vocal cleanup done (${Math.round(parsed.data.tookMs / 1000)}s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Vocal cleanup failed";
      setStepStatus(2, "error", undefined, msg);
      showToast(`Vocal cleanup error: ${msg}`);
    } finally {
      clearInterval(tick2);
      setStep2Progress(null);
    }
  }, [activeRecordingId, showToast]);

  // ── Step 4: Melody Extraction (Basic Pitch) — Henry 2026-05-31 ────────────

  const runMelodyExtract = useCallback(async () => {
    if (!activeRecordingId) return;
    setStepStatus(4, "running");
    // Simulated progress: faster tick (600ms) — Basic Pitch is ~30s.
    setStep4Progress(0);
    const tick4 = setInterval(() => {
      setStep4Progress(p => {
        if (p === null) return 5;
        if (p >= 90) return p;
        return p + (Math.random() * 3 + 1);
      });
    }, 600);
    try {
      const res = await fetch("/api/karaoke/melody-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId }),
      });
      const parsed = await safeKaraokeJson<{ midiUrl: string; noteCount: number; tookMs: number }>(res, "Melody Extraction");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setStepStatus(4, "done", { midiUrl: parsed.data.midiUrl, noteCount: parsed.data.noteCount } as unknown as Record<string, unknown>);
      showToast(`Melody extracted: ${parsed.data.noteCount} notes (${Math.round(parsed.data.tookMs / 1000)}s)`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Melody extract failed";
      setStepStatus(4, "error", undefined, msg);
      showToast(`Melody extract error: ${msg}`);
    } finally {
      clearInterval(tick4);
      setStep4Progress(null);
    }
  }, [activeRecordingId, showToast]);

  // ── Step 7: Flow Profiling ──────────────────────────────────────────────────

  const runFlowProfile = useCallback(async () => {
    if (!activeRecordingId) return;
    if (steps[3]?.status !== "done") {
      showToast("Run Audio Analysis (Step 3) first.");
      return;
    }
    setStepStatus(7, "running");
    try {
      const res = await fetch("/api/karaoke/flow-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId }),
      });
      const parsed = await safeKaraokeJson<{ flowProfile: FlowProfile }>(res, "Flow Profiling");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setFlowProfile(parsed.data.flowProfile);
      setStepStatus(7, "done", parsed.data.flowProfile as unknown as Record<string, unknown>);
      showToast(`Flow: ${parsed.data.flowProfile.voiceType} — ${parsed.data.flowProfile.cadenceLabel}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Flow profile failed";
      setStepStatus(7, "error", undefined, msg);
      showToast(`Flow error: ${msg}`);
    }
  }, [activeRecordingId, steps, showToast]);

  // ── Step 8: Beat Recommendation ────────────────────────────────────────────

  const runBeatRecommend = useCallback(async () => {
    if (!activeRecordingId) return;
    if (steps[7]?.status !== "done") {
      showToast("Run Flow Profiling (Step 7) first.");
      return;
    }
    setStepStatus(8, "running");
    try {
      const res = await fetch("/api/karaoke/beat-recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId, mode: activeMode }),
      });
      const parsed = await safeKaraokeJson<{ recommendations?: BeatRec[] }>(res, "Beat Recommendation");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setBeatRecs(parsed.data.recommendations || []);
      if (parsed.data.recommendations && parsed.data.recommendations.length > 0) {
        setSelectedBeatFamily(parsed.data.recommendations[0].beatFamily);
      }
      setStepStatus(8, "done");
      showToast(`Top beat: ${parsed.data.recommendations?.[0]?.beatFamily || "Afro Light Groove"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Beat recommendation failed";
      setStepStatus(8, "error", undefined, msg);
      showToast(`Beat error: ${msg}`);
    }
  }, [activeRecordingId, steps, activeMode, showToast]);

  // ── Step 9: Production Brief ────────────────────────────────────────────────

  const runProductionBrief = useCallback(async () => {
    if (!activeRecordingId) return;
    if (steps[8]?.status !== "done" && activeMode !== "E") {
      showToast("Run Beat Recommendation (Step 8) first.");
      return;
    }
    setStepStatus(9, "running");
    try {
      const res = await fetch("/api/karaoke/production-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: activeRecordingId,
          selectedBeatFamily: selectedBeatFamily || "Afro Light Groove",
        }),
      });
      const parsed = await safeKaraokeJson<{ productionBrief: ProductionBrief }>(res, "Production Brief");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      const brief: ProductionBrief = parsed.data.productionBrief;
      setProductionBrief(brief);
      setBriefInstructions(brief.instructions);
      setStepStatus(9, "done");
      showToast(`Production brief built — ${brief.genre}, ${brief.tempo} BPM, ${brief.key}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Brief failed";
      setStepStatus(9, "error", undefined, msg);
      showToast(`Brief error: ${msg}`);
    }
  }, [activeRecordingId, steps, activeMode, selectedBeatFamily, showToast]);

  // ── Step 10: Music Generation ───────────────────────────────────────────────

  const runMusicGeneration = useCallback(async () => {
    if (!activeRecordingId) return;
    if (isFlowLocked()) {
      const missing: string[] = [];
      if (steps[3]?.status !== "done") missing.push("Step 3: Run Analysis");
      if (steps[5]?.status !== "done") missing.push("Step 5: Extract Lyrics (auto after Analysis)");
      if (steps[7]?.status !== "done") missing.push("Step 7: Run Flow Profile");
      if (steps[9]?.status !== "done") missing.push("Step 9: Build Production Brief");
      showToast("Complete first: " + missing.join(" · "));
      return;
    }
    setStepStatus(10, "running");
    try {
      const briefWithOverride = productionBrief
        ? { ...productionBrief, instructions: briefInstructions }
        : undefined;

      const tierProviderMap: Record<"stock" | "ghs_pro" | "ghs_classic", string> = {
        stock: "stock",
        ghs_pro: "stable_audio",
        ghs_classic: "kie",
      };
      const providerKey = tierProviderMap[musicTier];

      const res = await fetch("/api/karaoke/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordingId: activeRecordingId,
          brief: briefWithOverride,
          mode: activeMode,
          providerKey,
        }),
      });
      const parsed = await safeKaraokeJson<{ generatedMusicUrl: string; provider: string; mode: string; locked?: boolean; lockReasons?: string[] }>(res, "Music Generation");
      if (!parsed.ok || !parsed.data) {
        // Check if raw text indicates a lock response — fall back to error path
        throw new Error(parsed.error || "Unknown");
      }
      if (parsed.data.locked) {
        setStepStatus(10, "locked", undefined, parsed.data.lockReasons?.join(", "));
        showToast(`Flow lock: ${parsed.data.lockReasons?.join(" · ")}`);
        return;
      }
      if (!res.ok) throw new Error(parsed.error || "Music generation failed");
      setGeneratedMusicUrl(parsed.data.generatedMusicUrl);
      setStepStatus(10, "done", { provider: parsed.data.provider, url: parsed.data.generatedMusicUrl });
      showToast(`Music generated via ${parsed.data.provider} — ${parsed.data.mode === "B" ? "karaoke mode" : "track ready"}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setStepStatus(10, "error", undefined, msg);
      showToast(`Music gen error: ${msg}`);
    }
  }, [activeRecordingId, isFlowLocked, productionBrief, briefInstructions, activeMode, showToast]);

  // ── Step 15: Final Assembly ─────────────────────────────────────────────────

  const runAssembly = useCallback(async () => {
    if (!activeRecordingId) return;
    if (steps[10]?.status !== "done") {
      showToast("Run Music Generation (Step 10) first.");
      return;
    }
    setStepStatus(15, "running");
    try {
      const res = await fetch("/api/karaoke/assemble", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId }),
      });
      const parsed = await safeKaraokeJson<{ mixedOutputUrl: string }>(res, "Final Assembly");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setMixedOutputUrl(parsed.data.mixedOutputUrl);
      setStepStatus(15, "done", { url: parsed.data.mixedOutputUrl });
      showToast("Final assembly complete — voice + music merged.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Assembly failed";
      setStepStatus(15, "error", undefined, msg);
      showToast(`Assembly error: ${msg}`);
    }
  }, [activeRecordingId, steps, showToast]);

  // ── Step 16: Export ─────────────────────────────────────────────────────────

  const runExport = useCallback(async () => {
    if (!activeRecordingId) return;
    setStepStatus(16, "running");
    try {
      const res = await fetch("/api/karaoke/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingId: activeRecordingId, format: exportFormat }),
      });
      const parsed = await safeKaraokeJson<{ exportedFiles?: { format: string; url: string; licenseFileUrl?: string }[]; downloadUrl: string; format?: string; licenseFileUrl?: string }>(res, "Export");
      if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
      setExportUrls(parsed.data.exportedFiles || []);
      setStepStatus(16, "done", {
        url: parsed.data.downloadUrl,
        format: parsed.data.format ?? "mp3",
        licenseFileUrl: parsed.data.licenseFileUrl,
      } as unknown as Record<string, unknown>);
      showToast(`Export ready: ${exportFormat} — ${parsed.data.downloadUrl}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Export failed";
      setStepStatus(16, "error", undefined, msg);
      showToast(`Export error: ${msg}`);
    }
  }, [activeRecordingId, exportFormat, showToast]);

  // ── Determine step display status (mode-aware) ──────────────────────────────

  const getStepStatus = (stepDef: StepDef): StepStatus => {
    if (stepDef.postLinux) return "post_linux";
    if (stepDef.skipForModes?.includes(activeMode)) return "skipped";
    return steps[stepDef.num]?.status || "pending";
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        display: "flex",
        height: "100%",
        minHeight: "100vh",
        fontFamily: "'Geist', 'Inter', sans-serif",
        color: "#fff",
        background: "#08080a",
      }}
    >
      {toastMsg && <Toast message={toastMsg} onDismiss={() => setToastMsg("")} />}

      {/* ── Left panel: workshop history ──────────────────────────────── */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          background: "#0b0b0d",
        }}
      >
        <div style={{ padding: "16px 14px 10px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 9,
              fontWeight: 700,
              color: "#55555a",
              textTransform: "uppercase",
              letterSpacing: "0.2em",
              fontFamily: "'JetBrains Mono', monospace",
            }}
          >
            Workshop History
          </p>
        </div>

        <button
          onClick={() => router.push("/dashboard/karaoke-music-creator")}
          data-testid="new-take-btn"
          style={{
            margin: "0 10px 8px",
            padding: "8px 12px",
            borderRadius: 7,
            border: "1px solid rgba(167,139,250,0.3)",
            background: "rgba(167,139,250,0.08)",
            color: "#a78bfa",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          + New Take
        </button>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 16px" }}>
          {allTakes.length === 0 && (
            <p style={{ margin: "8px 4px", fontSize: 11, color: "#55555a" }}>No takes yet.</p>
          )}
          {allTakes.map((take) => {
            const isActive = take.id === activeRecordingId;
            // Henry 2026-05-31 (#7): row is now a flex container with a delete button
            // alongside the take label. Click anywhere on the label area selects;
            // click the trash icon opens a confirm dialog and removes the take + files.
            return (
              <div
                key={take.id}
                style={{
                  display: "flex",
                  alignItems: "stretch",
                  marginBottom: 3,
                  borderRadius: 7,
                  border: `1px solid ${isActive ? "rgba(167,139,250,0.3)" : "rgba(255,255,255,0.05)"}`,
                  background: isActive ? "rgba(167,139,250,0.1)" : "transparent",
                  overflow: "hidden",
                }}
              >
                <button
                  data-testid={`take-${take.id}`}
                  onClick={() => {
                    setActiveRecordingId(take.id);
                    setActiveMode((take.mode as KaraokeMode) || "A");
                  }}
                  style={{
                    flex: 1,
                    padding: "8px 10px",
                    border: "none",
                    background: "transparent",
                    color: isActive ? "#a78bfa" : "#7b7b80",
                    fontSize: 11,
                    cursor: "pointer",
                    textAlign: "left",
                    overflow: "hidden",
                  }}
                >
                  {editingTakeId === take.id ? (
                    <input
                      autoFocus
                      value={editingTakeName}
                      onChange={e => setEditingTakeName(e.target.value)}
                      onBlur={async () => {
                        const newName = editingTakeName.trim();
                        if (newName && newName !== take.fileName) {
                          try {
                            const res = await fetch("/api/karaoke/rename", {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ recordingId: take.id, fileName: newName }),
                            });
                            const data = await res.json();
                            if (data.ok) {
                              showToast("Renamed");
                              await loadAllTakes();
                            } else {
                              showToast(`Rename failed: ${data.error || "unknown"}`);
                            }
                          } catch { /* silent */ }
                        }
                        setEditingTakeId(null);
                        setEditingTakeName("");
                      }}
                      onKeyDown={e => {
                        if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); }
                        else if (e.key === "Escape") { setEditingTakeId(null); setEditingTakeName(""); }
                      }}
                      onClick={e => e.stopPropagation()}
                      style={{
                        width: "100%",
                        padding: "2px 4px",
                        background: "rgba(167,139,250,0.10)",
                        border: "1px solid rgba(167,139,250,0.4)",
                        borderRadius: 3,
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 600,
                        outline: "none",
                      }}
                    />
                  ) : (
                    <p
                      onDoubleClick={ev => {
                        ev.stopPropagation();
                        setEditingTakeId(take.id);
                        setEditingTakeName(take.fileName || take.id);
                      }}
                      title="Double-click to rename"
                      style={{ margin: 0, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                      {take.fileName || take.id}
                    </p>
                  )}
                  <p style={{ margin: "2px 0 0", fontSize: 10, color: "#55555a" }}>
                    Mode {take.mode || "?"} · {new Date(take.createdAt).toLocaleDateString()}
                  </p>
                </button>
                <button
                  data-testid={`take-${take.id}-delete`}
                  title="Delete this take + all its files"
                  onClick={async (ev) => {
                    ev.stopPropagation();
                    if (typeof window === "undefined") return;
                    const firstOk = window.confirm(
                      `Delete take "${take.fileName || take.id}"?\n\n` +
                      "This removes the recording, transcript, analysis,\n" +
                      "generated music, mix, and all exports for this take.\n\n" +
                      "Cannot be undone."
                    );
                    if (!firstOk) return;
                    try {
                      const res = await fetch("/api/karaoke/delete", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ recordingId: take.id }),
                      });
                      const data = await res.json();
                      if (res.status === 409 && data.needsForce) {
                        // Take has linked music-video projects — ask user to confirm force-delete.
                        const count = (data.dependencies as string[]).length;
                        const forceOk = window.confirm(
                          `This take is linked to ${count} music-video project${count === 1 ? "" : "s"}.\n\n` +
                          `Deleting it will BREAK those projects (no audio).\n\n` +
                          `Force delete anyway?`
                        );
                        if (!forceOk) {
                          showToast(`Delete cancelled — used by ${count} music-video project${count === 1 ? "" : "s"}`);
                          return;
                        }
                        const forceRes = await fetch("/api/karaoke/delete", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ recordingId: take.id, force: true }),
                        });
                        const forceData = await forceRes.json();
                        if (!forceRes.ok || forceData.error) {
                          showToast(`Force delete failed: ${forceData.error || forceRes.status}`);
                          return;
                        }
                        // Force-delete succeeded — fall through to success path below.
                      } else if (!res.ok || data.error) {
                        showToast(`Delete failed: ${data.error || res.status}`);
                        return;
                      }
                      // Success path (normal delete OR confirmed force-delete).
                      if (isActive) {
                        setActiveRecordingId(null);
                        setRecording(null);
                      }
                      await loadAllTakes();
                      showToast(`Deleted "${take.fileName || take.id}"`);
                    } catch (err) {
                      showToast(`Delete error: ${err instanceof Error ? err.message : "unknown"}`);
                    }
                  }}
                  style={{
                    padding: "0 10px",
                    border: "none",
                    borderLeft: "1px solid rgba(255,255,255,0.05)",
                    background: "transparent",
                    color: "#ff7a45",
                    fontSize: 14,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ── Center: 18-step pipeline ───────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          maxWidth: 800,
        }}
      >
        {/* Karaoke status banner */}
        <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 12, padding: "12px 16px", marginBottom: 0, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 20 }}>🎵</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#f59e0b", marginBottom: 4, margin: "0 0 4px" }}>Karaoke Studio — Setup In Progress</p>
            <p style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5, margin: 0 }}>
              <strong style={{ color: "#d1d5db" }}>Working now:</strong> Voice recording, audio analysis, lyrics extraction, music generation (&#x2264;47s tracks via FAL).<br/>
              <strong style={{ color: "#d1d5db" }}>Coming soon:</strong> Kie.ai/Suno lyrical music, Mubert long-form tracks, vocal isolation, and voice enhancement (requires server migration).<br/>
              For full video production now, use the <strong style={{ color: "#f59e0b" }}>Hybrid Planner</strong> or <strong style={{ color: "#f59e0b" }}>Movie Planner</strong>.
            </p>
          </div>
        </div>

        {/* Header */}
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: "-0.5px",
              background: "linear-gradient(135deg, #a78bfa, #7cc4ff)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Karaoke Music Planner
          </h1>
          {activeRecordingId && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#7b7b80" }}>
              Recording:{" "}
              <span style={{ color: "#c5c5c8" }}>
                {recording?.fileName || activeRecordingId}
              </span>
            </p>
          )}
          {activeRecordingId && (
            <button
              onClick={async () => {
                try {
                  if (typeof navigator !== "undefined" && navigator.clipboard) {
                    await navigator.clipboard.writeText(window.location.href);
                    showToast("Share link copied — paste it anywhere to open this take");
                  } else {
                    const ta = document.createElement("textarea");
                    ta.value = window.location.href;
                    document.body.appendChild(ta);
                    ta.select();
                    document.execCommand("copy");
                    document.body.removeChild(ta);
                    showToast("Share link copied");
                  }
                } catch {
                  showToast("Could not copy — copy the URL bar manually");
                }
              }}
              title="Copy URL of this take for sharing"
              style={{
                marginTop: 8,
                padding: "4px 10px",
                borderRadius: 6,
                background: "rgba(167,139,250,0.08)",
                color: "#a78bfa",
                fontSize: 11,
                border: "1px solid rgba(167,139,250,0.3)",
                cursor: "pointer",
              }}
            >
              📋 Copy share link
            </button>
          )}
          {activeRecordingId && mixedOutputUrl && (
            <div style={{
              marginTop: 10,
              padding: "8px 12px",
              background: "rgba(122,224,195,0.06)",
              border: "1px solid rgba(122,224,195,0.2)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}>
              <span style={{ fontSize: 10, color: "#7ae0c3", fontWeight: 700, letterSpacing: 0.4, textTransform: "uppercase" as const, whiteSpace: "nowrap" }}>
                🎧 Now playing
              </span>
              <audio
                controls
                src={mixedOutputUrl}
                style={{ flex: 1, height: 28, minWidth: 0 }}
              />
            </div>
          )}
          {!activeRecordingId && (
            <p style={{ margin: "6px 0 0", fontSize: 13, color: "#ff7a45" }}>
              No recording loaded.{" "}
              <button
                onClick={() => router.push("/dashboard/karaoke-music-creator")}
                style={{ background: "none", border: "none", color: "#a78bfa", cursor: "pointer", fontSize: 13, padding: 0 }}
              >
                Go to Creator →
              </button>
            </p>
          )}
          {/* Keyboard hint — discoverable without being intrusive */}
          <button
            onClick={() => setShowKeyboardHelp(s => !s)}
            title="Keyboard shortcuts"
            style={{
              marginTop: 10,
              padding: "3px 9px",
              borderRadius: 5,
              background: "transparent",
              border: "1px solid rgba(167,139,250,0.2)",
              color: "#55555a",
              fontSize: 10,
              cursor: "pointer",
              fontFamily: "'JetBrains Mono', monospace",
              letterSpacing: "0.05em",
            }}
          >
            ? for keys
          </button>
        </div>

        {/* Keyboard shortcut help overlay */}
        {showKeyboardHelp && (
          <div
            onClick={() => setShowKeyboardHelp(false)}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{ background: "#1a1a1e", border: "1px solid rgba(167,139,250,0.3)", borderRadius: 12, padding: "20px 26px", color: "#fff", fontSize: 13, minWidth: 280 }}
            >
              <p style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#a78bfa" }}>Keyboard shortcuts</p>
              <table style={{ width: "100%", fontSize: 12, color: "#c5c5c8", borderCollapse: "collapse" }}>
                <tbody>
                  <tr><td style={{ padding: "3px 8px 3px 0", color: "#a78bfa", fontFamily: "monospace" }}>J</td><td>Next take</td></tr>
                  <tr><td style={{ padding: "3px 8px 3px 0", color: "#a78bfa", fontFamily: "monospace" }}>K</td><td>Previous take</td></tr>
                  <tr><td style={{ padding: "3px 8px 3px 0", color: "#a78bfa", fontFamily: "monospace" }}>Space</td><td>Play / pause Now Playing audio</td></tr>
                  <tr><td style={{ padding: "3px 8px 3px 0", color: "#a78bfa", fontFamily: "monospace" }}>?</td><td>Show this panel</td></tr>
                </tbody>
              </table>
              <p style={{ margin: "12px 0 0", fontSize: 10, color: "#7b7b80" }}>Click anywhere to close. Shortcuts disabled while typing in inputs.</p>
            </div>
          </div>
        )}

        {/* Mode banner */}
        <div
          style={{
            padding: "10px 16px",
            background: "rgba(167,139,250,0.07)",
            border: "1px solid rgba(167,139,250,0.18)",
            borderRadius: 8,
            fontSize: 13,
            color: "#a78bfa",
            fontWeight: 600,
          }}
        >
          Mode {activeMode}: {MODE_LABELS[activeMode]}
        </div>

        {/* Flow lock status bar */}
        {activeRecordingId && (
          <div
            data-testid="flow-lock-status"
            style={{
              padding: "10px 16px",
              background: isFlowLocked()
                ? "rgba(255,122,69,0.07)"
                : "rgba(122,224,195,0.07)",
              border: `1px solid ${isFlowLocked() ? "rgba(255,122,69,0.2)" : "rgba(122,224,195,0.2)"}`,
              borderRadius: 8,
              fontSize: 12,
              color: isFlowLocked() ? "#ff7a45" : "#7ae0c3",
            }}
          >
            {isFlowLocked()
              ? "🔒 Flow lock active — complete Steps 3, 5, 7, 9 before Music Generation (Step 10)"
              : "✅ Flow lock cleared — Music Generation ready"}
          </div>
        )}

        {/* ── 18-step list ─────────────────────────────────────────────── */}
        <div
          data-testid="step-list"
          style={{ display: "flex", flexDirection: "column", gap: 10 }}
        >
          {STEP_DEFS.map((stepDef) => {
            const status = getStepStatus(stepDef);
            const badge = statusBadge(status, stepDef.postLinux);
            const stepData = steps[stepDef.num];
            const isSkipped = status === "skipped";
            const isPostLinux = status === "post_linux";

            return (
              <div
                key={stepDef.num}
                data-testid={`step-${stepDef.num}`}
                style={{
                  background: "#0e0e10",
                  border: `1px solid ${status === "done" ? "rgba(122,224,195,0.15)" : status === "error" ? "rgba(255,122,69,0.15)" : "rgba(255,255,255,0.06)"}`,
                  borderRadius: 10,
                  padding: "14px 16px",
                  opacity: isSkipped ? 0.4 : 1,
                }}
              >
                {/* Step header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: status === "done" ? "rgba(122,224,195,0.12)" : "rgba(255,255,255,0.05)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 11,
                      fontWeight: 700,
                      color: status === "done" ? "#7ae0c3" : "#55555a",
                      flexShrink: 0,
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    {stepDef.num}
                  </span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: isSkipped ? "#55555a" : "#c5c5c8" }}>
                      {stepDef.title}
                    </p>
                    <p style={{ margin: "2px 0 0", fontSize: 11, color: "#55555a", lineHeight: 1.4 }}>
                      {stepDef.subtitle}
                    </p>
                  </div>
                  <span
                    data-testid={`step-${stepDef.num}-badge`}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 99,
                      fontSize: 10,
                      fontWeight: 600,
                      color: badge.color,
                      background: badge.bg,
                      fontFamily: "'JetBrains Mono', monospace",
                      flexShrink: 0,
                    }}
                  >
                    {badge.label}
                  </span>
                </div>

                {/* Post-Linux notice */}
                {isPostLinux && (
                  <div
                    data-testid={`step-${stepDef.num}-postlinux`}
                    style={{
                      marginTop: 10,
                      padding: "8px 12px",
                      background: "rgba(255,179,71,0.06)",
                      border: "1px solid rgba(255,179,71,0.18)",
                      borderRadius: 7,
                      fontSize: 11,
                      color: "#ffb347",
                    }}
                  >
                    {stepDef.num === 2 && "Demucs install pending — server install scheduled (Python 3.10 + PyTorch)"}
                    {stepDef.num === 4 && "Basic Pitch install pending — server install scheduled (TensorFlow)"}
                    {stepDef.num === 11 && (
                      <div>
                        <div style={{ marginBottom: 8 }}>
                          RVC voice enhancement is OFF by default — this server has no GPU, so running it would add <strong style={{ color: "#ff8c1a" }}>10–20 minutes</strong> processing per 60-second recording (CPU mode).
                        </div>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 10px", background: keepRvc ? "rgba(255,140,26,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${keepRvc ? "#ff8c1a" : "rgba(255,255,255,0.08)"}`, borderRadius: 6 }}>
                          <input
                            type="checkbox"
                            checked={keepRvc}
                            onChange={e => {
                              // Henry 2026-05-31: prompt on opt-IN so the user reads the
                              // time cost before accepting. Opt-OUT is silent — no friction.
                              if (e.target.checked) {
                                const ok = typeof window !== "undefined" && window.confirm(
                                  "Turn ON RVC voice enhancement?\n\n" +
                                  "This server has NO GPU. Running RVC adds approximately:\n" +
                                  "  • 10–20 minutes per 60-second recording\n" +
                                  "  • 5–10 minutes per 30-second recording\n\n" +
                                  "Your karaoke job will be MUCH slower. Continue?"
                                );
                                if (!ok) return;
                              }
                              setKeepRvc(e.target.checked);
                              if (typeof window !== "undefined") localStorage.setItem("ghs_karaoke_keep_rvc", e.target.checked ? "1" : "0");
                            }}
                            style={{ width: 14, height: 14, accentColor: "#ff8c1a" }}
                          />
                          <div style={{ fontSize: 11, color: keepRvc ? "#ff8c1a" : "#ccc" }}>
                            <strong>Keep RVC ON anyway</strong>
                            {keepRvc && <div style={{ fontSize: 10, color: "#ff8c1a", marginTop: 4 }}>⚠ Expect +10–20 min per 60s recording. Re-toggle anytime — applies on the next karaoke job.</div>}
                            {!keepRvc && <div style={{ fontSize: 10, color: "#7b7b80", marginTop: 4 }}>Step 11 will be skipped. Mixing uses your raw vocal.</div>}
                          </div>
                        </label>
                      </div>
                    )}
                  </div>
                )}

                {/* Error notice */}
                {stepData?.error && (
                  <div style={{ marginTop: 8, padding: "6px 10px", background: "rgba(255,122,69,0.08)", borderRadius: 6, fontSize: 11, color: "#ff7a45" }}>
                    {stepData.error}
                  </div>
                )}

                {/* ── Step-specific output/controls ─────────────────────── */}

                {/* Step 2: Vocal Cleanup (Demucs) — Henry 2026-05-31 */}
                {stepDef.num === 2 && !isPostLinux && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {steps[2]?.status === "done" && steps[2].output && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#7ae0c3" }}>✓ Stems separated</p>
                        <div style={{ display: "grid", gap: 6 }}>
                          <div>
                            <p style={{ margin: 0, fontSize: 10, color: "#7b7b80" }}>Vocals (your voice, isolated)</p>
                            <audio controls src={(steps[2].output as { vocalUrl?: string }).vocalUrl} style={{ width: "100%", height: 28 }} />
                          </div>
                          <div>
                            <p style={{ margin: 0, fontSize: 10, color: "#7b7b80" }}>Instrumental (everything else)</p>
                            <audio controls src={(steps[2].output as { instrumentalUrl?: string }).instrumentalUrl} style={{ width: "100%", height: 28 }} />
                          </div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={runVocalCleanup}
                      disabled={steps[2]?.status === "running"}
                      style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(122,224,195,0.4)", background: steps[2]?.status === "running" ? "rgba(122,224,195,0.05)" : "rgba(122,224,195,0.15)", color: "#7ae0c3", fontSize: 11, fontWeight: 600, cursor: steps[2]?.status === "running" ? "wait" : "pointer" }}
                    >
                      {steps[2]?.status === "running" ? "Running Demucs (~1 min)…" : steps[2]?.status === "done" ? "Re-run Vocal Cleanup" : "Run Vocal Cleanup"}
                    </button>
                    {steps[2]?.status === "running" && step2Progress !== null && (
                      <div style={{ marginTop: 6, height: 4, background: "rgba(122,224,195,0.08)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, step2Progress).toFixed(0)}%`, background: "#7ae0c3", transition: "width 0.5s ease" }} />
                      </div>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: 9, color: "#55555a" }}>
                      Demucs separates your voice from background noise. ~1 minute per 60s recording on CPU.
                    </p>
                  </div>
                )}

                {/* Step 3: Analysis run button + output */}
                {stepDef.num === 3 && !isSkipped && !isPostLinux && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {steps[3]?.status === "done" && steps[3].output && (
                      <div
                        data-testid="analysis-output"
                        style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}
                      >
                        {[
                          ["Tempo", `${Math.round((steps[3].output.tempo_bpm as number) || 0)} BPM`],
                          ["Key", String(steps[3].output.detected_key || "—")],
                          ["Energy", String(steps[3].output.energy_level ? "Medium" : "Low")],
                          ["Mood", String(steps[3].output.mood || "—")],
                          ["Genre", String(steps[3].output.suggested_genre || "—")],
                        ].map(([label, val]) => (
                          <div key={label} style={{ padding: "6px 10px", background: "#151518", borderRadius: 6, border: "1px solid rgba(255,255,255,0.05)" }}>
                            <p style={{ margin: 0, fontSize: 9, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em", fontFamily: "monospace" }}>{label}</p>
                            <p style={{ margin: "2px 0 0", fontSize: 13, fontWeight: 700, color: "#fff" }}>{val}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    {steps[3]?.status !== "done" && (
                      <button
                        data-testid="run-analysis-btn"
                        onClick={runAnalysis}
                        disabled={steps[3]?.status === "running"}
                        style={{
                          padding: "8px 20px",
                          borderRadius: 7,
                          border: "none",
                          background: steps[3]?.status === "running" ? "rgba(124,196,255,0.3)" : "linear-gradient(135deg, #a78bfa, #7cc4ff)",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 13,
                          cursor: steps[3]?.status === "running" ? "not-allowed" : "pointer",
                        }}
                      >
                        {steps[3]?.status === "running" ? "Analysing… (30–60s)" : "Run Analysis"}
                      </button>
                    )}
                  </div>
                )}

                {/* Step 4: Melody Extraction (Basic Pitch) — Henry 2026-05-31 */}
                {stepDef.num === 4 && !isPostLinux && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {steps[4]?.status === "done" && steps[4].output && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#7ae0c3" }}>
                          ✓ MIDI extracted — {(steps[4].output as { noteCount?: number }).noteCount ?? "?"} notes
                        </p>
                        <a
                          href={(steps[4].output as { midiUrl?: string }).midiUrl}
                          download
                          style={{ display: "inline-block", padding: "4px 10px", borderRadius: 6, background: "rgba(167,139,250,0.12)", color: "#a78bfa", fontSize: 11, textDecoration: "none", border: "1px solid rgba(167,139,250,0.3)" }}
                        >
                          Download MIDI
                        </a>
                      </div>
                    )}
                    <button
                      onClick={runMelodyExtract}
                      disabled={steps[4]?.status === "running"}
                      style={{ padding: "6px 14px", borderRadius: 7, border: "1px solid rgba(122,224,195,0.4)", background: steps[4]?.status === "running" ? "rgba(122,224,195,0.05)" : "rgba(122,224,195,0.15)", color: "#7ae0c3", fontSize: 11, fontWeight: 600, cursor: steps[4]?.status === "running" ? "wait" : "pointer" }}
                    >
                      {steps[4]?.status === "running" ? "Running Basic Pitch (~30s)…" : steps[4]?.status === "done" ? "Re-run Melody Extract" : "Run Melody Extraction"}
                    </button>
                    {steps[4]?.status === "running" && step4Progress !== null && (
                      <div style={{ marginTop: 6, height: 4, background: "rgba(122,224,195,0.08)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(100, step4Progress).toFixed(0)}%`, background: "#7ae0c3", transition: "width 0.5s ease" }} />
                      </div>
                    )}
                    <p style={{ margin: "4px 0 0", fontSize: 9, color: "#55555a" }}>
                      Basic Pitch converts your voice to MIDI notes — used to match music key to your singing.
                    </p>
                  </div>
                )}

                {/* Step 5: Lyrics display */}
                {stepDef.num === 5 && steps[5]?.status === "done" && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#7ae0c3" }}>
                      {lyricLines.length} lines transcribed by Whisper
                    </p>
                  </div>
                )}

                {/* Step 6: Lyrics intelligence editor */}
                {stepDef.num === 6 && !isSkipped && activeRecordingId && steps[5]?.status === "done" && (
                  <div
                    data-testid="lyrics-editor"
                    style={{ marginTop: 12 }}
                  >
                    {lyricLines.length === 0 && (
                      <p style={{ margin: 0, fontSize: 12, color: "#7b7b80" }}>
                        No lyrics extracted — audio may be instrumental.
                      </p>
                    )}
                    {lyricLines.slice(0, 6).map((line, idx) => (
                      <div
                        key={line.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "7px 10px",
                          marginBottom: 3,
                          background: "#151518",
                          borderRadius: 6,
                          border: "1px solid rgba(255,255,255,0.05)",
                        }}
                      >
                        <span style={{ fontSize: 10, color: "#55555a", fontFamily: "monospace", minWidth: 16 }}>{idx + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, color: "#c5c5c8" }}>{line.text}</span>
                        <span style={{ fontSize: 10, color: "#a78bfa" }}>line {idx + 1}</span>
                      </div>
                    ))}
                    {lyricLines.length > 6 && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#55555a" }}>
                        +{lyricLines.length - 6} more lines. Use full Karaoke Studio for per-line polish.
                      </p>
                    )}
                  </div>
                )}

                {/* Step 7: Flow profiling */}
                {stepDef.num === 7 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {flowProfile && (
                      <div
                        data-testid="flow-profile-output"
                        style={{
                          padding: "10px 12px",
                          background: "#151518",
                          borderRadius: 7,
                          border: "1px solid rgba(167,139,250,0.12)",
                          marginBottom: 8,
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "#a78bfa" }}>
                          Voice type: {flowProfile.voiceType}
                        </p>
                        <p style={{ margin: "3px 0 0", fontSize: 11, color: "#7b7b80" }}>
                          {flowProfile.cadenceLabel}
                        </p>
                        {flowProfile.hookCandidates?.length > 0 && (
                          <p style={{ margin: "3px 0 0", fontSize: 11, color: "#7b7b80" }}>
                            Hook candidates: {flowProfile.hookCandidates.slice(0, 2).join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                    {steps[7]?.status !== "done" && (
                      <button
                        data-testid="run-flow-profile-btn"
                        onClick={runFlowProfile}
                        disabled={steps[7]?.status === "running" || steps[3]?.status !== "done"}
                        style={{
                          padding: "7px 18px",
                          borderRadius: 7,
                          border: "none",
                          background: steps[7]?.status === "running" ? "rgba(167,139,250,0.3)" : "#a78bfa",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: steps[7]?.status === "running" || steps[3]?.status !== "done" ? "not-allowed" : "pointer",
                          opacity: steps[3]?.status !== "done" ? 0.4 : 1,
                        }}
                      >
                        {steps[7]?.status === "running" ? "Profiling…" : "Run Flow Profile"}
                      </button>
                    )}
                  </div>
                )}

                {/* Step 8: Beat recommendation */}
                {stepDef.num === 8 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {beatRecs.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                        {beatRecs.map((rec) => (
                          <button
                            key={rec.rank}
                            data-testid={`beat-rec-${rec.rank}`}
                            onClick={() => setSelectedBeatFamily(rec.beatFamily)}
                            style={{
                              padding: "8px 12px",
                              borderRadius: 7,
                              border: `1px solid ${selectedBeatFamily === rec.beatFamily ? "#a78bfa" : "rgba(255,255,255,0.07)"}`,
                              background: selectedBeatFamily === rec.beatFamily ? "rgba(167,139,250,0.12)" : "#151518",
                              color: selectedBeatFamily === rec.beatFamily ? "#a78bfa" : "#c5c5c8",
                              cursor: "pointer",
                              textAlign: "left",
                              display: "flex",
                              gap: 10,
                              alignItems: "center",
                            }}
                          >
                            <span style={{ fontSize: 11, color: "#55555a", fontFamily: "monospace", minWidth: 14 }}>#{rec.rank}</span>
                            <span style={{ flex: 1 }}>
                              <span style={{ fontWeight: 700, fontSize: 12 }}>{rec.beatFamily}</span>
                              <span style={{ fontSize: 11, color: "#7b7b80", marginLeft: 8 }}>{rec.reasoning}</span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                    {steps[8]?.status !== "done" && (
                      <button
                        data-testid="run-beat-recommend-btn"
                        onClick={runBeatRecommend}
                        disabled={steps[8]?.status === "running" || steps[7]?.status !== "done"}
                        style={{
                          padding: "7px 18px",
                          borderRadius: 7,
                          border: "none",
                          background: steps[8]?.status === "running" ? "rgba(167,139,250,0.3)" : "#7cc4ff",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: steps[8]?.status === "running" || steps[7]?.status !== "done" ? "not-allowed" : "pointer",
                          opacity: steps[7]?.status !== "done" ? 0.4 : 1,
                        }}
                      >
                        {steps[8]?.status === "running" ? "Recommending…" : "Get Beat Recommendations"}
                      </button>
                    )}
                  </div>
                )}

                {/* Step 9: Production brief */}
                {stepDef.num === 9 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {productionBrief && (
                      <div
                        data-testid="production-brief-output"
                        style={{
                          padding: "12px 14px",
                          background: "#151518",
                          borderRadius: 7,
                          border: "1px solid rgba(255,255,255,0.07)",
                          marginBottom: 10,
                        }}
                      >
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
                          {[
                            ["Genre", productionBrief.genre],
                            ["Tempo", `${productionBrief.tempo} BPM`],
                            ["Key", productionBrief.key],
                            ["Mood", productionBrief.mood],
                          ].map(([l, v]) => (
                            <div key={l} style={{ padding: "4px 8px", background: "#0e0e10", borderRadius: 5, border: "1px solid rgba(255,255,255,0.05)" }}>
                              <p style={{ margin: 0, fontSize: 9, color: "#55555a", textTransform: "uppercase", fontFamily: "monospace" }}>{l}</p>
                              <p style={{ margin: "1px 0 0", fontSize: 12, fontWeight: 700, color: "#fff" }}>{v}</p>
                            </div>
                          ))}
                        </div>
                        <p style={{ margin: "0 0 6px", fontSize: 11, color: "#7b7b80" }}>
                          {productionBrief.structure} · {productionBrief.energyCurve}
                        </p>
                        <textarea
                          value={briefInstructions}
                          onChange={(e) => setBriefInstructions(e.target.value)}
                          placeholder="Production instructions (editable)"
                          style={{
                            width: "100%",
                            padding: "8px 10px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "#0e0e10",
                            color: "#c5c5c8",
                            fontSize: 12,
                            lineHeight: 1.5,
                            resize: "vertical",
                            minHeight: 72,
                            boxSizing: "border-box",
                            fontFamily: "'Geist', sans-serif",
                          }}
                        />
                      </div>
                    )}
                    {steps[9]?.status !== "done" && (
                      <button
                        data-testid="run-production-brief-btn"
                        onClick={runProductionBrief}
                        disabled={steps[9]?.status === "running" || steps[8]?.status !== "done"}
                        style={{
                          padding: "7px 18px",
                          borderRadius: 7,
                          border: "none",
                          background: steps[9]?.status === "running" ? "rgba(167,139,250,0.3)" : "#7ae0c3",
                          color: "#08080a",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: steps[9]?.status === "running" || steps[8]?.status !== "done" ? "not-allowed" : "pointer",
                          opacity: steps[8]?.status !== "done" ? 0.4 : 1,
                        }}
                      >
                        {steps[9]?.status === "running" ? "Building brief…" : "Build Production Brief"}
                      </button>
                    )}
                  </div>
                )}

                {/* Step 10: Music generation (flow-locked) */}
                {stepDef.num === 10 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {generatedMusicUrl && (
                      <div style={{ marginBottom: 10 }}>
                        <p style={{ margin: 0, fontSize: 11, color: "#7ae0c3" }}>
                          Music generated — provider: {steps[10]?.output?.provider as string || "stock"}
                        </p>
                        {generatedMusicUrl !== "none" && (
                          <audio
                            controls
                            src={generatedMusicUrl}
                            style={{ width: "100%", marginTop: 6, borderRadius: 4 }}
                          />
                        )}
                      </div>
                    )}

                    {/* Tier selector */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
                      <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.15em", fontFamily: "'JetBrains Mono', monospace" }}>
                        Music Source
                      </p>

                      {/* GHS Standard */}
                      <button
                        data-testid="music-tier-stock"
                        onClick={() => setMusicTier("stock")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${musicTier === "stock" ? "#a78bfa" : "rgba(255,255,255,0.07)"}`,
                          background: musicTier === "stock" ? "rgba(167,139,250,0.1)" : "#151518",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "stock" ? "#a78bfa" : "#c5c5c8" }}>GHS Standard</p>
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Stock Library — always available</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7ae0c3", fontFamily: "'JetBrains Mono', monospace", background: "rgba(122,224,195,0.08)", border: "1px solid rgba(122,224,195,0.2)", borderRadius: 4, padding: "2px 6px" }}>FREE</span>
                      </button>

                      {/* GHS Pro */}
                      <button
                        data-testid="music-tier-ghs-pro"
                        onClick={() => setMusicTier("ghs_pro")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${musicTier === "ghs_pro" ? "#7cc4ff" : "rgba(255,255,255,0.07)"}`,
                          background: musicTier === "ghs_pro" ? "rgba(124,196,255,0.08)" : "#151518",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_pro" ? "#7cc4ff" : "#c5c5c8" }}>GHS Pro</p>
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>FAL Stable Audio — instrumental, max 47s. Best for Mode E.</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#7cc4ff", fontFamily: "'JetBrains Mono', monospace", background: "rgba(124,196,255,0.08)", border: "1px solid rgba(124,196,255,0.2)", borderRadius: 4, padding: "2px 6px" }}>MID</span>
                      </button>

                      {/* GHS Classic */}
                      <button
                        data-testid="music-tier-ghs-classic"
                        onClick={() => setMusicTier("ghs_classic")}
                        style={{
                          padding: "10px 12px",
                          borderRadius: 8,
                          border: `1px solid ${musicTier === "ghs_classic" ? "#ff9a3c" : "rgba(255,255,255,0.07)"}`,
                          background: musicTier === "ghs_classic" ? "rgba(255,154,60,0.08)" : "#151518",
                          cursor: "pointer",
                          textAlign: "left",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: musicTier === "ghs_classic" ? "#ff9a3c" : "#c5c5c8" }}>GHS Classic</p>
                          <p style={{ margin: "2px 0 0", fontSize: 10, color: "#7b7b80", lineHeight: 1.4 }}>Suno via Kie.ai — full lyrical songs. Best for Modes A / C / D.</p>
                          <p style={{ margin: "4px 0 0", fontSize: 10, color: "#ffb347", lineHeight: 1.4 }}>KIE_AI_API_KEY not configured — will use stock library</p>
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#ff9a3c", fontFamily: "'JetBrains Mono', monospace", background: "rgba(255,154,60,0.08)", border: "1px solid rgba(255,154,60,0.2)", borderRadius: 4, padding: "2px 6px", whiteSpace: "nowrap" }}>PREMIUM</span>
                      </button>
                    </div>

                    <button
                      data-testid="run-music-gen-btn"
                      onClick={runMusicGeneration}
                      // Henry 2026-05-30 persona LOW #11: button styled as locked but didn't
                      // actually disable interaction — clicking fired runMusicGeneration which
                      // bounced server-side. Now disabled when flow-locked too.
                      disabled={steps[10]?.status === "running" || isFlowLocked()}
                      title={isFlowLocked()
                        ? `Pending: ${[
                            steps[3]?.status !== "done"  && "Step 3 (analyze)",
                            steps[5]?.status !== "done"  && "Step 5 (lyrics)",
                            steps[7]?.status !== "done"  && "Step 7 (flow profile)",
                            steps[9]?.status !== "done"  && "Step 9 (production brief)",
                          ].filter(Boolean).join(", ")}`
                        : "Generate music for this karaoke take"}
                      style={{
                        padding: "9px 22px",
                        borderRadius: 7,
                        border: "none",
                        background: isFlowLocked()
                          ? "rgba(255,122,69,0.2)"
                          : steps[10]?.status === "running"
                            ? "rgba(167,139,250,0.3)"
                            : "linear-gradient(135deg, #a78bfa, #ff9a3c)",
                        color: isFlowLocked() ? "#ff7a45" : "#fff",
                        fontWeight: 700,
                        fontSize: 13,
                        cursor: (steps[10]?.status === "running" || isFlowLocked()) ? "not-allowed" : "pointer",
                        opacity: isFlowLocked() ? 0.6 : 1,
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      {isFlowLocked() && <span>🔒</span>}
                      {steps[10]?.status === "running"
                        ? "Generating music…"
                        : isFlowLocked()
                          ? "Generate Music (steps pending)"
                          : "Generate Music"}
                    </button>
                  </div>
                )}

                {/* Step 12: Audio mixing */}
                {stepDef.num === 12 && !isSkipped && activeRecordingId && recording && (
                  <div style={{ marginTop: 12 }}>
                    <Suspense fallback={<p style={{ fontSize: 12, color: "#7b7b80" }}>Loading editor…</p>}>
                      <KaraokeAudioEditor
                        audioUrl={recording.fileUrl || undefined}
                        secondaryAudioUrl={generatedMusicUrl || undefined}
                        recordingId={activeRecordingId}
                        onSave={() => {
                          setStepStatus(12, "done");
                          showToast("Mix settings saved.");
                        }}
                        onToast={showToast}
                      />
                    </Suspense>
                  </div>
                )}

                {/* Step 13: Review interface */}
                {stepDef.num === 13 && !isSkipped && activeRecordingId && recording && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                      {recording.fileUrl && (
                        <div style={{ flex: "1 1 200px" }}>
                          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            Voice Waveform
                          </p>
                          <audio controls src={recording.fileUrl} style={{ width: "100%", borderRadius: 4 }} />
                        </div>
                      )}
                      {generatedMusicUrl && generatedMusicUrl !== "none" && (
                        <div style={{ flex: "1 1 200px" }}>
                          <p style={{ margin: "0 0 4px", fontSize: 11, color: "#55555a", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                            Generated Music
                          </p>
                          <audio controls src={generatedMusicUrl} style={{ width: "100%", borderRadius: 4 }} />
                        </div>
                      )}
                    </div>
                    {lyricLines.length > 0 && (
                      <div style={{ marginTop: 10 }}>
                        <p style={{ margin: "0 0 6px", fontSize: 11, color: "#55555a" }}>Lyrics overlay</p>
                        {lyricLines.slice(0, 4).map((line, idx) => (
                          <p key={line.id} style={{ margin: 0, fontSize: 12, color: "#c5c5c8", lineHeight: 1.8, borderLeft: "2px solid rgba(167,139,250,0.3)", paddingLeft: 8 }}>
                            <span style={{ color: "#55555a", fontFamily: "monospace", fontSize: 10, marginRight: 6 }}>{idx + 1}</span>
                            {line.text}
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Step 14: Version comparison */}
                {stepDef.num === 14 && !isSkipped && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#7b7b80" }}>
                      Previous exports from this session:
                    </p>
                    {exportUrls.length === 0 && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#55555a" }}>No exports yet.</p>
                    )}
                    {exportUrls.map((ex, idx) => (
                      <div key={idx} style={{ marginTop: 4, display: "flex", gap: 8, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#a78bfa", fontFamily: "monospace" }}>{ex.format}</span>
                        <a
                          href={ex.url}
                          download
                          style={{ fontSize: 11, color: "#7cc4ff", textDecoration: "underline" }}
                        >
                          Download
                        </a>
                        {ex.licenseFileUrl && (
                          <a
                            href={ex.licenseFileUrl}
                            download
                            style={{
                              display: "inline-block",
                              padding: "3px 8px",
                              borderRadius: 4,
                              background: "rgba(122,224,195,0.08)",
                              color: "#7ae0c3",
                              fontSize: 10,
                              textDecoration: "none",
                              border: "1px solid rgba(122,224,195,0.25)",
                            }}
                            title="Royalty-free license info for this export"
                          >
                            📜 License info (.txt)
                          </a>
                        )}
                      </div>
                    ))}
                    {activeRecordingId && (
                      <a
                        href={`/api/karaoke/session-summary?recordingId=${activeRecordingId}`}
                        download
                        style={{
                          display: "inline-block",
                          marginTop: 10,
                          padding: "5px 12px",
                          borderRadius: 6,
                          background: "rgba(122,224,195,0.10)",
                          color: "#7ae0c3",
                          fontSize: 11,
                          textDecoration: "none",
                          border: "1px solid rgba(122,224,195,0.3)",
                        }}
                        title="Download full session JSON — pipeline outputs + license"
                      >
                        📦 Download session summary (.json)
                      </a>
                    )}
                  </div>
                )}

                {/* Step 15: Final assembly */}
                {stepDef.num === 15 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    {mixedOutputUrl && (
                      <div style={{ marginBottom: 8 }}>
                        <p style={{ margin: 0, fontSize: 11, color: "#7ae0c3" }}>Assembly complete</p>
                        <audio controls src={mixedOutputUrl} style={{ width: "100%", marginTop: 4, borderRadius: 4 }} />
                      </div>
                    )}
                    <button
                      data-testid="run-assemble-btn"
                      onClick={runAssembly}
                      disabled={steps[15]?.status === "running" || steps[10]?.status !== "done"}
                      style={{
                        padding: "7px 18px",
                        borderRadius: 7,
                        border: "none",
                        background: steps[15]?.status === "running" ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg, #7ae0c3, #7cc4ff)",
                        color: "#08080a",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: steps[15]?.status === "running" || steps[10]?.status !== "done" ? "not-allowed" : "pointer",
                        opacity: steps[10]?.status !== "done" ? 0.4 : 1,
                      }}
                    >
                      {steps[15]?.status === "running" ? "Assembling…" : "Run Final Assembly"}
                    </button>
                  </div>
                )}

                {/* Step 16: Export */}
                {stepDef.num === 16 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                      {["mp3", "wav", "vocal_only", "instrumental_only", "karaoke_lyric_timed", "short_clip", "hook_segment"].map((fmt) => (
                        <button
                          key={fmt}
                          data-testid={`export-format-${fmt}`}
                          onClick={() => setExportFormat(fmt)}
                          style={{
                            padding: "5px 10px",
                            borderRadius: 5,
                            border: `1px solid ${exportFormat === fmt ? "#a78bfa" : "rgba(255,255,255,0.08)"}`,
                            background: exportFormat === fmt ? "rgba(167,139,250,0.12)" : "transparent",
                            color: exportFormat === fmt ? "#a78bfa" : "#7b7b80",
                            fontSize: 11,
                            fontWeight: exportFormat === fmt ? 700 : 500,
                            cursor: "pointer",
                            fontFamily: "'JetBrains Mono', monospace",
                          }}
                        >
                          {fmt}
                        </button>
                      ))}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <button
                        data-testid="run-export-btn"
                        onClick={runExport}
                        disabled={steps[16]?.status === "running"}
                        style={{
                          padding: "7px 18px",
                          borderRadius: 7,
                          border: "none",
                          background: steps[16]?.status === "running" ? "rgba(167,139,250,0.3)" : "#a78bfa",
                          color: "#fff",
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: steps[16]?.status === "running" ? "not-allowed" : "pointer",
                        }}
                      >
                        {steps[16]?.status === "running" ? "Exporting…" : `Export as ${exportFormat}`}
                      </button>
                      {steps[16]?.output && (steps[16].output as { licenseFileUrl?: string }).licenseFileUrl && (
                        <a
                          href={(steps[16].output as { licenseFileUrl?: string }).licenseFileUrl}
                          download
                          style={{
                            display: "inline-block",
                            marginTop: 6, marginLeft: 8,
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "rgba(122,224,195,0.08)",
                            color: "#7ae0c3",
                            fontSize: 10,
                            textDecoration: "none",
                            border: "1px solid rgba(122,224,195,0.25)",
                          }}
                          title="Royalty-free license info for this export"
                        >
                          📜 License info (.txt)
                        </a>
                      )}
                    </div>
                    {/* Henry 2026-06-01: ZIP bundle — one-click "give me everything" for power users */}
                    {activeRecordingId && (
                      <div style={{ marginTop: 10 }}>
                        <button
                          data-testid="export-bundle-btn"
                          disabled={bundleBuilding}
                          onClick={async () => {
                            setBundleBuilding(true);
                            try {
                              const res = await fetch("/api/karaoke/export-bundle", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ recordingId: activeRecordingId }),
                              });
                              const parsed = await safeKaraokeJson<{ bundleUrl: string; includedFormats: string[]; sizeBytes: number }>(res, "Export Bundle");
                              if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
                              const a = document.createElement("a");
                              a.href = parsed.data.bundleUrl;
                              a.download = "";
                              document.body.appendChild(a);
                              a.click();
                              document.body.removeChild(a);
                              showToast(`Bundle: ${parsed.data.includedFormats.length} files, ${Math.round(parsed.data.sizeBytes / 1024 / 1024)} MB`);
                            } catch (err) {
                              showToast(`Bundle error: ${err instanceof Error ? err.message : "unknown"}`);
                            } finally {
                              setBundleBuilding(false);
                            }
                          }}
                          style={{
                            padding: "5px 12px",
                            borderRadius: 6,
                            background: bundleBuilding ? "rgba(167,139,250,0.05)" : "rgba(167,139,250,0.10)",
                            color: "#a78bfa",
                            fontSize: 11,
                            border: "1px solid rgba(167,139,250,0.3)",
                            cursor: bundleBuilding ? "wait" : "pointer",
                          }}
                          title="Bundle all completed exports + license.txt into one ZIP"
                        >
                          {bundleBuilding ? "Bundling…" : "📦 Export ALL formats as ZIP"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 17: Music Video Pipeline */}
                {stepDef.num === 17 && !isSkipped && activeRecordingId && (
                  <div style={{ marginTop: 10 }}>
                    <button
                      data-testid="send-to-mv-planner-btn"
                      onClick={async () => {
                        if (!activeRecordingId) return;
                        setStepStatus(17, "running");
                        try {
                          const res = await fetch("/api/music-video/from-karaoke", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ recordingId: activeRecordingId }),
                          });
                          const parsed = await safeKaraokeJson<{ projectId: string; redirectUrl: string }>(res, "Music Video Handoff");
                          if (!parsed.ok || !parsed.data) throw new Error(parsed.error || "Unknown");
                          setStepStatus(17, "done");
                          showToast(`Music Video project created — opening...`);
                          setTimeout(() => { window.location.href = parsed.data!.redirectUrl; }, 600);
                        } catch (err) {
                          const msg = err instanceof Error ? err.message : "Handoff failed";
                          setStepStatus(17, "error", undefined, msg);
                          showToast(`MV handoff error: ${msg}`);
                        }
                      }}
                      style={{
                        padding: "8px 20px",
                        borderRadius: 7,
                        border: "none",
                        background: steps[17]?.status === "running" ? "rgba(167,139,250,0.3)" : "linear-gradient(135deg, #ff9a3c, #d17bff)",
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: steps[17]?.status === "running" ? "not-allowed" : "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        opacity: steps[17]?.status === "running" ? 0.7 : 1,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polygon points="23 7 16 12 23 17 23 7" />
                        <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
                      </svg>
                      {steps[17]?.status === "running" ? "Creating project…" : "Send to Music Video Planner"}
                    </button>
                  </div>
                )}

                {/* Step 18: Storage lifecycle */}
                {stepDef.num === 18 && (
                  <div style={{ marginTop: 10, padding: "10px 12px", background: "rgba(255,255,255,0.02)", borderRadius: 6 }}>
                    <p style={{ margin: 0, fontSize: 11, color: "#55555a" }}>
                      30-day retention · AES-256 at rest (compliance todo — planned for Linux deploy) · TLS 1.3 in transit
                    </p>
                    {recording && (
                      <p style={{ margin: "4px 0 0", fontSize: 11, color: "#55555a" }}>
                        Created: {new Date(recording.createdAt).toLocaleString()} ·
                        Expires: {new Date(new Date(recording.createdAt).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

// ── Page with Suspense wrapper (required for useSearchParams) ──────────────────

export default function KaraokeMusicPlannerPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: 32, color: "#7b7b80", fontFamily: "'Geist', sans-serif" }}>
        Loading Karaoke Music Planner…
      </div>
    }>
      <KaraokeMusicPlannerInner />
    </Suspense>
  );
}
