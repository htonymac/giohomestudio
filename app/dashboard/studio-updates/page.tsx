"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────
interface UpdateEntry {
  id: string;
  title: string;
  description: string;
  status: "done" | "in_progress" | "planned" | "suggested" | "postponed";
  category: "sfx" | "voice" | "pipeline" | "ui" | "commercial" | "architecture" | "ai";
  priority: "critical" | "high" | "medium" | "low";
  source: "built" | "update_file" | "ai_suggestion";
  notes?: string;
}

// ── Status / Priority config ────────────────────────
const STATUS_CONFIG = {
  done:        { label: "Done",         color: "#4ade80", bg: "#1a2a1a" },
  in_progress: { label: "In Progress",  color: "#60a5fa", bg: "#1a1a2e" },
  planned:     { label: "Planned",      color: "#facc15", bg: "#2a2010" },
  suggested:   { label: "AI Suggests",  color: "#c084fc", bg: "#1e1a2e" },
  postponed:   { label: "Postponed",    color: "#5a5a7a", bg: "#141420" },
};
const PRIORITY_CONFIG = {
  critical: { label: "Critical", color: "#f87171" },
  high:     { label: "High",     color: "#fb923c" },
  medium:   { label: "Medium",   color: "#facc15" },
  low:      { label: "Low",      color: "#5a5a7a" },
};
const CATEGORY_CONFIG = {
  sfx:          { label: "SFX Library",   icon: "♪", color: "#60a5fa" },
  voice:        { label: "Voice System",  icon: "◉", color: "#f472b6" },
  pipeline:     { label: "Pipeline",      icon: "⚙", color: "#fb923c" },
  ui:           { label: "UI / UX",       icon: "◈", color: "#4ade80" },
  commercial:   { label: "Commercial",    icon: "◐", color: "#c084fc" },
  architecture: { label: "Architecture",  icon: "⬡", color: "#34d399" },
  ai:           { label: "AI / Supervisor",icon: "✦", color: "#facc15" },
};

// ── Updates data ────────────────────────────────────
const UPDATES: UpdateEntry[] = [
  // ── DONE ──
  {
    id: "sfx-module",
    title: "SFX Module — 24 sound event slots",
    description: "Core SFX library with weather, crowd, action, nature, urban, horror, animal categories. Files detected from storage/sfx/.",
    status: "done", category: "sfx", priority: "critical", source: "built",
  },
  {
    id: "sfx-page-v1",
    title: "SFX Library Page v1",
    description: "Category filter, available/missing indicators, setup guide, script annotation reference.",
    status: "done", category: "sfx", priority: "high", source: "built",
  },
  {
    id: "sfx-page-v2",
    title: "SFX Library Page v2 — Artlist-inspired redesign",
    description: "Waveform visualizer, preview player (streams local files), per-category counts, copy-filename button, free source links panel, priority pack guide, LLM download assistant.",
    status: "done", category: "sfx", priority: "high", source: "update_file",
  },
  {
    id: "sfx-source-notes",
    title: "SFX Source Notes — Per-file metadata sidecar",
    description: "storage/sfx/sources.json sidecar stores source site, URL, attribution note, import note, safeForAutoMode flag, quality rating per event. GET/PATCH via /api/sfx/source-notes. Expandable ✎ panel on every SFX card.",
    status: "done", category: "sfx", priority: "high", source: "update_file",
  },
  {
    id: "sfx-auto-mode-toggle",
    title: "SFX Auto Mode Toggle — Per-file safe/manual flag",
    description: "Each SFX file can be marked Safe for Auto Mode or Manual Only. Supervisor auto-detected events only use safeForAutoMode=true files. Manual [SFX:] script tags bypass this restriction and always work.",
    status: "done", category: "sfx", priority: "high", source: "update_file",
  },
  {
    id: "sfx-quality-rating",
    title: "SFX Quality Rating — Low / Good / Excellent",
    description: "Per-file quality rating stored in sources.json sidecar. Shown as a badge on each card. Supervisor can prefer higher-rated files in future passes. Default: unrated.",
    status: "done", category: "sfx", priority: "medium", source: "update_file",
  },
  {
    id: "sfx-pipeline-auto-safe",
    title: "Pipeline — Auto vs Manual SFX resolution split",
    description: "resolveAutoSFXPaths() filters by safeForAutoMode before selecting SFX for supervisor-detected events. resolveSFXPaths() used for manual [SFX:] tags (no restriction). Logs show auto-safe count vs manual count.",
    status: "done", category: "pipeline", priority: "high", source: "update_file",
  },
  {
    id: "character-voice-registry",
    title: "Character Voice Registry — CRUD UI + API",
    description: "Full registry to assign ElevenLabs voice IDs to characters. Multi-voice script format guide included.",
    status: "done", category: "voice", priority: "critical", source: "built",
  },
  {
    id: "multi-voice-pipeline",
    title: "Multi-Voice Pipeline",
    description: "Per-speaker ElevenLabs audio generation → FFmpeg concat → single voice track. Dialogue parser supports SPEAKER: \"text\" format.",
    status: "done", category: "pipeline", priority: "critical", source: "built",
  },
  {
    id: "dialogue-parser",
    title: "Dialogue Parser",
    description: "Parses SPEAKER: \"text\", [SFX: event], [SOUND: event] annotations from narration scripts.",
    status: "done", category: "pipeline", priority: "high", source: "built",
  },
  {
    id: "sfx-mixing",
    title: "SFX Auto-Mixing in FFmpeg",
    description: "SFX events resolved from script → mixed at 30% volume beneath narration + music using amix filter.",
    status: "done", category: "pipeline", priority: "high", source: "built",
  },
  {
    id: "audio-only-mode",
    title: "Audio-Only Mode",
    description: "Pipeline skips video generation entirely when audioMode = audio_only. Outputs merged .mp3.",
    status: "done", category: "pipeline", priority: "high", source: "built",
  },
  {
    id: "story-handoff",
    title: "Story Handoff — Eloquent Continuation",
    description: "storyContext, previousContentItemId, storyThreadId on ContentItem. 8 continuation suggestions from supervisor. ?continue=ID URL param, purple banner, suggestion chips, ContinueStoryPanel on detail page.",
    status: "done", category: "pipeline", priority: "high", source: "built",
  },
  {
    id: "nigerian-pidgin-voices",
    title: "Nigerian Pidgin English Narrators — 5 Age Groups",
    description: "Voice profiles for Child, Teen, Young Adult, Adult, Elder narrators in Nigerian Pidgin. Seeder button in Character Voice Registry. Custom voice ID support for Henry's cloned voices.",
    status: "done", category: "voice", priority: "high", source: "update_file",
  },
  {
    id: "llm-errand-api",
    title: "Local LLM Errand API",
    description: "POST /api/llm-errand delegates download planning, research, and file naming tasks to Ollama (phi3:latest). Saves ElevenLabs/Claude API credits. LLM cannot touch codebase.",
    status: "done", category: "ai", priority: "medium", source: "update_file",
  },

  // ── PLANNED ──
  {
    id: "scene-interpretation",
    title: "Scene Interpretation Layer",
    description: "Add sceneType, emotionalTone, speechStyle, tensionLevel, duckingPlan, pauseStrategy to OrchestrationPlan. Supervisor detects scene from script context.",
    status: "planned", category: "ai", priority: "high", source: "update_file",
    notes: "Pass B — from scene-directed audio storytelling update file",
  },
  {
    id: "whisper-voice",
    title: "Whisper / Emotional Voice Direction",
    description: "Map speechStyle: 'whisper' to ElevenLabs stability/style settings. Affect ElevenLabs voice settings per scene.",
    status: "planned", category: "voice", priority: "medium", source: "update_file",
    notes: "Tied to Scene Interpretation Layer",
  },
  {
    id: "audio-director",
    title: "Audio Director Layer",
    description: "After supervisor plan, calculate: narration cue positions, silence windows, music entry/exit, SFX trigger points. Produces timeline data structure for FFmpeg.",
    status: "planned", category: "pipeline", priority: "high", source: "update_file",
    notes: "Pass C — Free Mode Finalization. Foundation for all advanced modes.",
  },
  {
    id: "voice-picker-browser",
    title: "Voice Picker Browser",
    description: "Search/filter voices, preview before assigning to character, approve flow. Provider/model/capability dynamic selector (not hardcoded generation versions).",
    status: "planned", category: "voice", priority: "medium", source: "update_file",
    notes: "Pass D — Character Voice and Story Identity update",
  },
  {
    id: "narrator-profile",
    title: "Narrator Profile System",
    description: "Dedicated narrator slot separate from character voices. Global narrator setting per project.",
    status: "planned", category: "voice", priority: "medium", source: "update_file",
  },
  {
    id: "mode-selector-ui",
    title: "Formal Mode Selector UI",
    description: "Free Mode, Audio Drama, Commercial Maker, Text-to-Images+Audio as selectable modes at Studio entry. Not just settings — explicit mode switching.",
    status: "planned", category: "ui", priority: "high", source: "update_file",
    notes: "Pass E — Multi-Mode Architecture",
  },
  {
    id: "timeline-engine",
    title: "Timeline Engine Foundation",
    description: "Data structure: [{type:'narration', start:0, end:12}, {type:'sfx', ...}]. Produced by Audio Director, consumed by FFmpeg merge.",
    status: "planned", category: "architecture", priority: "high", source: "update_file",
    notes: "Pass E — foundation for beat parser and commercial slides",
  },
  {
    id: "beat-parser",
    title: "Beat Parser — Text to Images + Audio",
    description: "Break narration into beats. Each beat maps to one image slot. Foundation for image-driven storytelling mode.",
    status: "planned", category: "pipeline", priority: "medium", source: "update_file",
  },
  {
    id: "car-ambience-sfx",
    title: "Car Ambience SFX Category",
    description: "Add vehicle category: engine_hum, road_noise, cabin_vibration. 3 new SFX slots.",
    status: "planned", category: "sfx", priority: "low", source: "update_file",
  },

  // ── COMMERCIAL ──
  {
    id: "commercial-mode",
    title: "Commercial Maker Mode",
    description: "Slide/beat builder, image upload per slide, caption polish (before/after compare), enhancement presets (Cinematic/HDR/Natural/Clean Social/Warm Promo), CTA/end-card (WhatsApp/Call/Telegram), branding, soundtrack, optional narration, finishing desk integration.",
    status: "planned", category: "commercial", priority: "high", source: "update_file",
    notes: "Pass F — largest pass. New DB models: CommercialProject, CommercialSlide, RenderJob.",
  },

  // ── AI SUGGESTIONS ──
  {
    id: "suggest-sfx-waveform-real",
    title: "[Suggestion] Real Waveform from Audio File",
    description: "Current waveform is deterministic/decorative. Add Web Audio API analysis on load to show the actual waveform shape from the MP3 file. Would make the library feel significantly more professional.",
    status: "suggested", category: "sfx", priority: "low", source: "ai_suggestion",
    notes: "Requires Web Audio API + canvas rendering on the client. No npm package needed.",
  },
  {
    id: "suggest-sfx-duration",
    title: "[Suggestion] Show SFX Duration on Each Card",
    description: "Add duration metadata (e.g. 3.4s) to each SFX card. Currently invisible. Helps Henry verify quality (one-shot vs ambience loop) without opening the file.",
    status: "suggested", category: "sfx", priority: "medium", source: "ai_suggestion",
    notes: "Requires ffprobe call on load via /api/sfx route. Minimal effort, high value.",
  },
  {
    id: "suggest-ollama-sidecar",
    title: "[Suggestion] Ollama Errand Queue",
    description: "Currently LLM errand is one-off request/response. Add a simple queue so Henry can submit multiple download tasks and review all plans at once.",
    status: "suggested", category: "ai", priority: "low", source: "ai_suggestion",
  },
  {
    id: "suggest-sfx-source-tracker",
    title: "[Suggestion] Per-File Source Tracking (JSON Sidecar)",
    description: "Store source URL, license type, attribution required per SFX file in a local storage/sfx/sources.json. No DB required. Show source info on each card.",
    status: "suggested", category: "sfx", priority: "medium", source: "ai_suggestion",
    notes: "Would make the library audit-safe. Could also export as a license report.",
  },
  {
    id: "suggest-bulk-naming-llm",
    title: "[Suggestion] LLM Bulk Rename Helper",
    description: "Henry downloads files with names like 'freesound_123456__thunder-rumble.mp3'. Add a page where he pastes the downloaded filenames and the LLM suggests which GioHomeStudio filename each one maps to.",
    status: "suggested", category: "ai", priority: "high", source: "ai_suggestion",
    notes: "Saves a lot of manual renaming work. Uses /api/llm-errand with file_naming errand type.",
  },
  {
    id: "suggest-voice-preview-in-registry",
    title: "[Suggestion] Voice Preview Button in Character Registry",
    description: "Add a play button next to each registered character that previews their assigned ElevenLabs voice with a sample sentence. Uses /api/voices/preview already built.",
    status: "suggested", category: "voice", priority: "high", source: "ai_suggestion",
    notes: "/api/voices/preview route is already implemented — just needs UI wiring in character-voices page.",
  },
];

// ── Component ───────────────────────────────────────
export default function StudioUpdatesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = UPDATES.filter(u => {
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (categoryFilter !== "all" && u.category !== categoryFilter) return false;
    return true;
  });

  const donCount    = UPDATES.filter(u => u.status === "done").length;
  const totalCount  = UPDATES.length;
  const plannedCount = UPDATES.filter(u => u.status === "planned").length;
  const suggestCount = UPDATES.filter(u => u.status === "suggested").length;

  return (
    <div style={{ maxWidth: 920 }}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-white font-bold" style={{ fontSize: 24 }}>Studio Updates</h1>
          <p style={{ fontSize: 13, color: "#5a5a7a", marginTop: 4 }}>
            Live roadmap — what is built, what is coming, and Claude Code suggestions.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "Built", value: donCount, color: "#4ade80" },
            { label: "Planned", value: plannedCount, color: "#facc15" },
            { label: "AI Suggests", value: suggestCount, color: "#c084fc" },
          ].map(s => (
            <div key={s.label} style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 8, padding: "10px 16px", textAlign: "center" }}>
              <p style={{ color: s.color, fontSize: 22, fontWeight: 800 }}>{s.value}</p>
              <p style={{ color: "#3a3a5a", fontSize: 10 }}>{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
        <div className="flex justify-between mb-2">
          <span style={{ color: "#4a4a6a", fontSize: 12 }}>Overall progress</span>
          <span style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>{Math.round((donCount / totalCount) * 100)}%</span>
        </div>
        <div style={{ background: "#141420", borderRadius: 4, height: 6, overflow: "hidden" }}>
          <div style={{ background: "linear-gradient(90deg, #4ade80, #60a5fa)", height: "100%", width: `${(donCount / totalCount) * 100}%`, borderRadius: 4, transition: "width 0.5s ease" }} />
        </div>
        <p style={{ color: "#2a2a4a", fontSize: 11, marginTop: 8 }}>
          {donCount} of {totalCount} update items completed · {plannedCount} in plan · {suggestCount} suggestions from Claude Code
        </p>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 5 }}>
          {["all", "done", "planned", "suggested", "postponed"].map(s => {
            const cfg = s === "all" ? null : STATUS_CONFIG[s as keyof typeof STATUS_CONFIG];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                style={{
                  background: statusFilter === s ? (cfg?.bg ?? "#1a1a2e") : "#0f0f1a",
                  border: `1px solid ${statusFilter === s ? (cfg?.color ?? "#7c5cfc") + "44" : "#1e1e38"}`,
                  color: statusFilter === s ? (cfg?.color ?? "#7c5cfc") : "#4a4a6a",
                  borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {s === "all" ? "All Status" : cfg?.label ?? s}
              </button>
            );
          })}
        </div>
        <div style={{ width: 1, background: "#1e1e38" }} />
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          <button
            onClick={() => setCategoryFilter("all")}
            style={{
              background: categoryFilter === "all" ? "#1a1a2e" : "#0f0f1a",
              border: `1px solid ${categoryFilter === "all" ? "#7c5cfc44" : "#1e1e38"}`,
              color: categoryFilter === "all" ? "#7c5cfc" : "#4a4a6a",
              borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer",
            }}
          >All Categories</button>
          {Object.entries(CATEGORY_CONFIG).map(([k, cfg]) => (
            <button
              key={k}
              onClick={() => setCategoryFilter(k)}
              style={{
                background: categoryFilter === k ? `${cfg.color}15` : "#0f0f1a",
                border: `1px solid ${categoryFilter === k ? cfg.color + "44" : "#1e1e38"}`,
                color: categoryFilter === k ? cfg.color : "#4a4a6a",
                borderRadius: 6, padding: "4px 12px", fontSize: 11, cursor: "pointer",
              }}
            >
              {cfg.icon} {cfg.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Update list ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {filtered.map(u => {
          const statusCfg = STATUS_CONFIG[u.status];
          const priCfg = PRIORITY_CONFIG[u.priority];
          const catCfg = CATEGORY_CONFIG[u.category];
          const expanded = expandedId === u.id;

          return (
            <div
              key={u.id}
              style={{
                background: u.status === "done" ? "#0d130d" : u.status === "suggested" ? "#100f1a" : "#0f0f1a",
                border: `1px solid ${expanded ? statusCfg.color + "44" : "#1a1a2a"}`,
                borderRadius: 10,
                overflow: "hidden",
                transition: "border-color 0.2s ease",
              }}
            >
              <button
                onClick={() => setExpandedId(expanded ? null : u.id)}
                style={{ background: "none", border: "none", width: "100%", padding: "14px 18px", cursor: "pointer", textAlign: "left" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Status badge */}
                  <span style={{
                    background: statusCfg.bg, color: statusCfg.color, fontSize: 10,
                    borderRadius: 4, padding: "2px 7px", border: `1px solid ${statusCfg.color}33`,
                    flexShrink: 0, fontWeight: 600,
                  }}>{statusCfg.label}</span>

                  {/* Category */}
                  <span style={{ color: catCfg.color, fontSize: 11, flexShrink: 0 }}>
                    {catCfg.icon} {catCfg.label}
                  </span>

                  {/* Title */}
                  <span style={{ color: u.status === "done" ? "#c0c0d0" : "#e0e0f0", fontSize: 13, fontWeight: u.status === "done" ? 400 : 500, flex: 1 }}>
                    {u.title}
                  </span>

                  {/* Priority */}
                  <span style={{ color: priCfg.color, fontSize: 10, flexShrink: 0 }}>{priCfg.label}</span>

                  {/* Source */}
                  {u.source === "ai_suggestion" && (
                    <span style={{ background: "#1e1a2e", color: "#c084fc", fontSize: 10, borderRadius: 4, padding: "1px 6px", border: "1px solid #c084fc33" }}>
                      AI
                    </span>
                  )}

                  <span style={{ color: "#2a2a4a", fontSize: 11 }}>{expanded ? "▲" : "▼"}</span>
                </div>
              </button>

              {expanded && (
                <div style={{ padding: "4px 18px 16px", borderTop: "1px solid #1a1a2a" }}>
                  <p style={{ color: "#7070a0", fontSize: 12, lineHeight: 1.6, marginBottom: u.notes ? 10 : 0 }}>
                    {u.description}
                  </p>
                  {u.notes && (
                    <p style={{ color: "#4a4a6a", fontSize: 11, background: "#0d0d18", borderRadius: 6, padding: "8px 12px", marginTop: 8 }}>
                      Note: {u.notes}
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p style={{ color: "#2a2a4a", fontSize: 13, textAlign: "center", padding: "40px 0" }}>No items match current filter.</p>
      )}
    </div>
  );
}
