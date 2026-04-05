"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface SFXEntry {
  event: string;
  filename: string;
  description: string;
  category: string;
  available: boolean;
}

interface SFXSourceNote {
  key: string;
  filename: string;
  sourceSite: string;
  sourceUrl: string;
  attributionNote: string;
  importNote: string;
  safeForAutoMode: boolean;
  qualityRating: "" | "low" | "good" | "excellent";
  updatedAt?: string;
}

type NotesMap = Record<string, SFXSourceNote>;

// ── Constants ────────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  weather: "#60a5fa",
  crowd:   "#f472b6",
  action:  "#fb923c",
  nature:  "#4ade80",
  urban:   "#facc15",
  horror:  "#c084fc",
  animal:  "#34d399",
};
const CATEGORY_ICONS: Record<string, string> = {
  weather: "⛈", crowd: "👥", action: "⚡", nature: "🌿",
  urban: "🏙", horror: "💀", animal: "🐾",
};
const CATEGORY_ORDER = ["weather", "crowd", "action", "nature", "urban", "horror", "animal"];
const SOURCE_SITES = ["Freesound", "Pixabay", "Mixkit", "Sonniss", "Artlist", "Uploaded", "Other"];
const QUALITY_OPTIONS: { value: SFXSourceNote["qualityRating"]; label: string; color: string }[] = [
  { value: "",          label: "Unrated", color: "#3a3a5a" },
  { value: "low",       label: "Low",     color: "#f87171" },
  { value: "good",      label: "Good",    color: "#facc15" },
  { value: "excellent", label: "Excellent",color: "#4ade80" },
];

const FREESOUND_LINKS: Record<string, string> = {
  thunder: "https://freesound.org/search/?q=thunder",
  rain_light: "https://freesound.org/search/?q=light+rain+drizzle",
  rain_heavy: "https://freesound.org/search/?q=heavy+rain+downpour",
  wind: "https://freesound.org/search/?q=howling+wind",
  storm: "https://freesound.org/search/?q=storm+ambience",
  crowd_cheer: "https://freesound.org/search/?q=crowd+cheering",
  crowd_murmur: "https://freesound.org/search/?q=crowd+murmur+background",
  crowd_panic: "https://freesound.org/search/?q=crowd+panic+screaming",
  gunshot: "https://freesound.org/search/?q=gunshot+single",
  explosion: "https://freesound.org/search/?q=explosion+large",
  sword_clash: "https://freesound.org/search/?q=sword+clash+metal",
  footsteps: "https://freesound.org/search/?q=footsteps+walking",
  footsteps_run: "https://freesound.org/search/?q=footsteps+running",
  fire_crackling: "https://freesound.org/search/?q=fire+crackling",
  door_creak: "https://freesound.org/search/?q=door+creak",
  horse_gallop: "https://freesound.org/search/?q=horse+gallop",
  ocean_waves: "https://freesound.org/search/?q=ocean+waves+shore",
  forest_ambience: "https://freesound.org/search/?q=forest+birds+ambience",
  river_stream: "https://freesound.org/search/?q=river+stream+flowing",
  city_traffic: "https://freesound.org/search/?q=city+traffic+urban",
  church_bell: "https://freesound.org/search/?q=church+bell",
  market_noise: "https://freesound.org/search/?q=market+bazaar+crowd",
  horror_sting: "https://freesound.org/search/?q=horror+suspense+sting",
  heartbeat: "https://freesound.org/search/?q=heartbeat+tense",
  dog_bark: "https://freesound.org/search/?q=dog+bark",
};
const PIXABAY_LINKS: Record<string, string> = {
  thunder: "https://pixabay.com/sound-effects/search/thunder/",
  rain_light: "https://pixabay.com/sound-effects/search/rain/",
  rain_heavy: "https://pixabay.com/sound-effects/search/heavy-rain/",
  wind: "https://pixabay.com/sound-effects/search/wind/",
  gunshot: "https://pixabay.com/sound-effects/search/gunshot/",
  footsteps: "https://pixabay.com/sound-effects/search/footsteps/",
  horse_gallop: "https://pixabay.com/sound-effects/search/horse/",
  market_noise: "https://pixabay.com/sound-effects/search/market/",
  heartbeat: "https://pixabay.com/sound-effects/search/heartbeat/",
  explosion: "https://pixabay.com/sound-effects/search/explosion/",
};
const PRIORITY_PACK_1 = [
  "thunder","rain_light","rain_heavy","wind","storm","gunshot","sword_clash",
  "footsteps","footsteps_run","door_creak","market_noise","crowd_murmur","horse_gallop",
  "heartbeat","forest_ambience",
];
const PRIORITY_PACK_2 = [
  "explosion","fire_crackling","crowd_cheer","crowd_panic","city_traffic","church_bell",
  "ocean_waves","river_stream","horror_sting","dog_bark",
];

// ── Waveform helper ──────────────────────────────────────────────────────────
function waveformBars(seed: string, count = 36): number[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) & 0xffff;
  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    h = ((h * 1664525) + 1013904223) >>> 0;
    bars.push(12 + (h % 72));
  }
  return bars;
}

// ── Waveform visual ──────────────────────────────────────────────────────────
function Waveform({ event, color, playing, available }: {
  event: string; color: string; playing: boolean; available: boolean;
}) {
  const bars = waveformBars(event);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 1.5, height: 40, flex: 1 }}>
      {bars.map((h, i) => (
        <div key={i} style={{
          width: 3, height: `${h}%`, borderRadius: 2,
          background: playing ? color : (available ? color : "#2a2a40"),
          opacity: playing ? (0.4 + (i % 3) * 0.2) : (available ? 0.45 : 0.18),
          transition: "opacity 0.3s ease",
          animation: playing ? `waveA${(i % 5) + 1} 0.6s ease-in-out infinite alternate` : "none",
          animationDelay: playing ? `${(i * 0.04).toFixed(2)}s` : "0s",
        }} />
      ))}
      <style>{`
        @keyframes waveA1 { to { transform: scaleY(1.9); } }
        @keyframes waveA2 { to { transform: scaleY(0.4); } }
        @keyframes waveA3 { to { transform: scaleY(2.2); } }
        @keyframes waveA4 { to { transform: scaleY(0.6); } }
        @keyframes waveA5 { to { transform: scaleY(1.6); } }
      `}</style>
    </div>
  );
}

// ── Metadata panel (expandable) ──────────────────────────────────────────────
function MetadataPanel({ sfx, note, onSave, saving }: {
  sfx: SFXEntry;
  note: SFXSourceNote | undefined;
  onSave: (draft: SFXSourceNote) => Promise<void>;
  saving: boolean;
}) {
  const blank: SFXSourceNote = {
    key: sfx.event, filename: sfx.filename,
    sourceSite: "", sourceUrl: "", attributionNote: "", importNote: "",
    safeForAutoMode: false, qualityRating: "",
  };
  const [draft, setDraft] = useState<SFXSourceNote>(() => note ? { ...blank, ...note } : blank);
  const [saved, setSaved] = useState(false);

  // Reset draft if note changes from outside (e.g. after save)
  useEffect(() => { setDraft(note ? { ...blank, ...note } : blank); }, [note?.updatedAt]);

  const set = <K extends keyof SFXSourceNote>(k: K, v: SFXSourceNote[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  async function handleSave() {
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div style={{ borderTop: "1px solid #1a1a30", padding: "14px 16px", background: "#0d0d18" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {/* Source site */}
        <div>
          <label style={{ fontSize: 10, color: "#4a4a6a", display: "block", marginBottom: 4 }}>Source Site</label>
          <select
            value={draft.sourceSite}
            onChange={e => set("sourceSite", e.target.value)}
            style={{ background: "#141420", color: "#c0c0d0", border: "1px solid #2a2a3a", borderRadius: 5, padding: "5px 8px", fontSize: 12, width: "100%" }}
          >
            <option value="">Select source…</option>
            {SOURCE_SITES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Source URL */}
        <div>
          <label style={{ fontSize: 10, color: "#4a4a6a", display: "block", marginBottom: 4 }}>Source URL</label>
          <input
            value={draft.sourceUrl}
            onChange={e => set("sourceUrl", e.target.value)}
            placeholder="https://freesound.org/people/…"
            style={{ background: "#141420", color: "#c0c0d0", border: "1px solid #2a2a3a", borderRadius: 5, padding: "5px 8px", fontSize: 12, width: "100%" }}
          />
        </div>

        {/* Attribution note */}
        <div>
          <label style={{ fontSize: 10, color: "#4a4a6a", display: "block", marginBottom: 4 }}>Attribution Note</label>
          <input
            value={draft.attributionNote}
            onChange={e => set("attributionNote", e.target.value)}
            placeholder="CC0 — no attribution required"
            style={{ background: "#141420", color: "#c0c0d0", border: "1px solid #2a2a3a", borderRadius: 5, padding: "5px 8px", fontSize: 12, width: "100%" }}
          />
        </div>

        {/* Import note */}
        <div>
          <label style={{ fontSize: 10, color: "#4a4a6a", display: "block", marginBottom: 4 }}>Import Note</label>
          <input
            value={draft.importNote}
            onChange={e => set("importNote", e.target.value)}
            placeholder="Downloaded 2026-04-01, original: thunder-01.mp3"
            style={{ background: "#141420", color: "#c0c0d0", border: "1px solid #2a2a3a", borderRadius: 5, padding: "5px 8px", fontSize: 12, width: "100%" }}
          />
        </div>

        {/* Safe for auto mode */}
        <div style={{ display: "flex", alignItems: "center" }}>
          <label
            style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}
            title="When ON, the AI supervisor may auto-select this file. When OFF, only manual [SFX: event] tags can trigger it."
          >
            <div
              onClick={() => set("safeForAutoMode", !draft.safeForAutoMode)}
              style={{
                width: 40, height: 22, borderRadius: 11, position: "relative", cursor: "pointer", flexShrink: 0,
                background: draft.safeForAutoMode ? "#4ade80" : "#2a2a40",
                transition: "background 0.2s ease",
                border: `1px solid ${draft.safeForAutoMode ? "#4ade80" : "#3a3a50"}`,
              }}
            >
              <div style={{
                position: "absolute", top: 2, left: draft.safeForAutoMode ? 20 : 2,
                width: 16, height: 16, borderRadius: "50%", background: "#fff",
                transition: "left 0.2s ease",
              }} />
            </div>
            <div>
              <p style={{ color: draft.safeForAutoMode ? "#4ade80" : "#5a5a7a", fontSize: 12, fontWeight: 600 }}>
                {draft.safeForAutoMode ? "Safe for Auto Mode" : "Manual Only"}
              </p>
              <p style={{ color: "#3a3a5a", fontSize: 10, marginTop: 1 }}>
                {draft.safeForAutoMode ? "Supervisor can auto-select this file" : "Only [SFX:] tags can trigger this"}
              </p>
            </div>
          </label>
        </div>

        {/* Quality rating */}
        <div>
          <label style={{ fontSize: 10, color: "#4a4a6a", display: "block", marginBottom: 6 }}>Quality Rating</label>
          <div style={{ display: "flex", gap: 6 }}>
            {QUALITY_OPTIONS.map(q => (
              <button
                key={q.value}
                onClick={() => set("qualityRating", q.value)}
                style={{
                  background: draft.qualityRating === q.value ? `${q.color}22` : "#141420",
                  border: `1px solid ${draft.qualityRating === q.value ? q.color + "66" : "#2a2a3a"}`,
                  color: draft.qualityRating === q.value ? q.color : "#4a4a6a",
                  borderRadius: 5, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Source URL link helper (shows clickable link if URL is set) */}
      {draft.sourceUrl && (
        <div style={{ marginTop: 8 }}>
          <a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: "#60a5fa", fontSize: 11, textDecoration: "none" }}>
            ↗ Open source page
          </a>
        </div>
      )}

      {/* Save row */}
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? "#1a2a1a" : "#1a1a30",
            border: `1px solid ${saved ? "#4ade80" : "#2a2a4a"}`,
            color: saved ? "#4ade80" : "#7070b0",
            borderRadius: 6, padding: "5px 16px", fontSize: 12, cursor: "pointer", opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? "Saving…" : saved ? "✓ Saved" : "Save Notes"}
        </button>
        {note?.updatedAt && (
          <span style={{ color: "#2a2a4a", fontSize: 10 }}>
            Last updated: {new Date(note.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── SFX Card ─────────────────────────────────────────────────────────────────
function SFXCard({ sfx, note, onCopy, playing, onPlay, onStop, onSaveNote }: {
  sfx: SFXEntry;
  note: SFXSourceNote | undefined;
  onCopy: (filename: string) => void;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onSaveNote: (draft: SFXSourceNote) => Promise<void>;
}) {
  const color = CATEGORY_COLORS[sfx.category] ?? "#7c5cfc";
  const freesoundUrl = FREESOUND_LINKS[sfx.event];
  const pixabayUrl = PIXABAY_LINKS[sfx.event];
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const togglePlay = useCallback(() => {
    if (playing) {
      audioRef.current?.pause();
      onStop();
    } else {
      const audio = new Audio(`/api/sfx/play?event=${sfx.event}`);
      audioRef.current = audio;
      audio.onended = onStop;
      audio.onerror = onStop;
      audio.play().catch(onStop);
      onPlay();
    }
  }, [playing, sfx.event, onPlay, onStop]);

  useEffect(() => {
    if (!playing && audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  }, [playing]);

  async function handleSaveNote(draft: SFXSourceNote) {
    setSavingNote(true);
    await onSaveNote(draft);
    setSavingNote(false);
  }

  const qualityColor = note?.qualityRating
    ? QUALITY_OPTIONS.find(q => q.value === note.qualityRating)?.color ?? "#3a3a5a"
    : "#3a3a5a";

  return (
    <div style={{
      background: playing ? `${color}0d` : "#141420",
      border: `1px solid ${expanded ? color + "33" : (playing ? color + "44" : (sfx.available ? "#1e1e38" : "#141420"))}`,
      borderRadius: 10, overflow: "hidden", transition: "border-color 0.2s ease",
    }}>
      {/* ── Main row ── */}
      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        {/* Playing indicator */}
        {playing && (
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: "10px 0 0 10px" }} />
        )}

        {/* Play button */}
        <button
          onClick={sfx.available ? togglePlay : undefined}
          title={sfx.available ? (playing ? "Stop" : "Preview") : "File not loaded"}
          style={{
            width: 34, height: 34, borderRadius: "50%", border: "none",
            cursor: sfx.available ? "pointer" : "default",
            background: sfx.available ? (playing ? color : `${color}20`) : "#1a1a2e",
            color: sfx.available ? (playing ? "#fff" : color) : "#2a2a40",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, flexShrink: 0, transition: "all 0.2s ease",
            boxShadow: playing ? `0 0 14px ${color}55` : "none",
          }}
        >
          {playing ? "■" : "▶"}
        </button>

        {/* Waveform */}
        <Waveform event={sfx.event} color={color} playing={playing} available={sfx.available} />

        {/* Event name + quality badge */}
        <div style={{ minWidth: 130 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: sfx.available ? "#e0e0ff" : "#3a3a5a", fontSize: 13, fontWeight: 600 }}>
              {sfx.event}
            </span>
            {sfx.available && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", boxShadow: "0 0 5px #4ade8088", flexShrink: 0 }} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <p style={{ color: "#3a3a5a", fontSize: 10 }}>{sfx.description}</p>
            {note?.qualityRating && (
              <span style={{ color: qualityColor, fontSize: 9, background: `${qualityColor}18`, borderRadius: 3, padding: "0 5px", border: `1px solid ${qualityColor}33` }}>
                {note.qualityRating}
              </span>
            )}
          </div>
        </div>

        {/* Filename + copy */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 160 }}>
          <code style={{ color: sfx.available ? "#60a5fa" : "#2a2a4a", fontSize: 11 }}>{sfx.filename}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(sfx.filename); onCopy(sfx.filename); }}
            title="Copy filename"
            style={{ background: "#1a1a30", border: "1px solid #2a2a40", borderRadius: 4, padding: "2px 6px", fontSize: 10, color: "#4a4a6a", cursor: "pointer" }}
          >
            📋
          </button>
        </div>

        {/* Status + source links */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 90 }}>
          {sfx.available ? (
            <span style={{ color: "#4ade80", fontSize: 11, fontWeight: 600 }}>✓ Ready</span>
          ) : (
            <span style={{ color: "#3a3a5a", fontSize: 11 }}>Missing</span>
          )}
          {!sfx.available && freesoundUrl && (
            <a href={freesoundUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#60a5fa", fontSize: 10, textDecoration: "none" }}>Freesound →</a>
          )}
          {!sfx.available && pixabayUrl && (
            <a href={pixabayUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#f472b6", fontSize: 10, textDecoration: "none" }}>Pixabay →</a>
          )}
        </div>

        {/* Auto-mode badge */}
        <div style={{ minWidth: 50, textAlign: "center" }}>
          {note?.safeForAutoMode ? (
            <span style={{ background: "#1a2a1a", color: "#4ade80", fontSize: 9, borderRadius: 4, padding: "2px 6px", border: "1px solid #2a4a2a", display: "inline-block" }}>AUTO ✓</span>
          ) : (
            <span style={{ background: "#1a1a2e", color: "#3a3a5a", fontSize: 9, borderRadius: 4, padding: "2px 6px", border: "1px solid #2a2a40", display: "inline-block" }}>manual</span>
          )}
        </div>

        {/* Notes expand toggle */}
        <button
          onClick={() => setExpanded(e => !e)}
          title={expanded ? "Collapse source notes" : "Edit source notes / auto-mode / quality"}
          style={{
            background: expanded ? "#1a1a30" : "transparent",
            border: `1px solid ${expanded ? "#2a2a4a" : "transparent"}`,
            borderRadius: 5, padding: "3px 8px", fontSize: 11,
            color: expanded ? "#7070b0" : "#2a2a4a", cursor: "pointer",
            flexShrink: 0, transition: "all 0.15s ease",
          }}
        >
          {expanded ? "▲" : "✎"}
        </button>
      </div>

      {/* ── Expanded metadata panel ── */}
      {expanded && (
        <MetadataPanel
          sfx={sfx}
          note={note}
          onSave={handleSaveNote}
          saving={savingNote}
        />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SFXLibraryPage() {
  const [library, setLibrary] = useState<SFXEntry[]>([]);
  const [notes, setNotes] = useState<NotesMap>({});
  const [availableCount, setAvailableCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [playingEvent, setPlayingEvent] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [errandLoading, setErrandLoading] = useState(false);
  const [errandResult, setErrandResult] = useState("");

  async function loadLibrary() {
    setLoading(true);
    const [libRes, notesRes] = await Promise.all([
      fetch("/api/sfx").then(r => r.json()),
      fetch("/api/sfx/source-notes").then(r => r.json()).catch(() => ({ notes: {} })),
    ]);
    setLibrary(libRes.library ?? []);
    setAvailableCount(libRes.availableCount ?? 0);
    setTotalCount(libRes.totalCount ?? 0);
    setNotes(notesRes.notes ?? {});
    setLoading(false);
  }

  useEffect(() => { loadLibrary(); }, []);

  const filtered = filter === "all" ? library : library.filter(s => s.category === filter);
  const grouped = CATEGORY_ORDER.reduce<Record<string, SFXEntry[]>>((acc, cat) => {
    const items = filtered.filter(s => s.category === cat);
    if (items.length) acc[cat] = items;
    return acc;
  }, {});
  const catCounts = CATEGORY_ORDER.reduce<Record<string, { total: number; available: number }>>((acc, cat) => {
    const items = library.filter(s => s.category === cat);
    acc[cat] = { total: items.length, available: items.filter(s => s.available).length };
    return acc;
  }, {});

  const autoSafeCount = Object.values(notes).filter(n => n.safeForAutoMode).length;

  function handleCopy(filename: string) {
    setCopied(filename);
    setTimeout(() => setCopied(""), 2000);
  }

  async function handleSaveNote(draft: SFXSourceNote) {
    const res = await fetch("/api/sfx/source-notes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      const data = await res.json();
      setNotes(prev => ({ ...prev, [draft.key]: data.note }));
    }
  }

  async function askLLMDownloadPlan() {
    setErrandLoading(true); setErrandResult("");
    const missing = library.filter(s => !s.available).map(s => s.filename);
    const res = await fetch("/api/llm-errand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        errandType: "download_plan",
        task: `I need to download these ${missing.length} missing SFX files for GioHomeStudio: ${missing.join(", ")}`,
        context: "All files should be royalty-free and safe for commercial use. Preferred sources: Freesound.org (CC0), Pixabay, Mixkit. Files go into storage/sfx/ folder.",
      }),
    });
    const data = await res.json();
    setErrandResult(data.result ?? data.error ?? "No response");
    setErrandLoading(false);
  }

  const missingPack1 = PRIORITY_PACK_1.filter(e => {
    const entry = library.find(s => s.event === e);
    return entry && !entry.available;
  });

  return (
    <div style={{ maxWidth: 960 }}>
      {/* ── Header ── */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-white font-bold" style={{ fontSize: 24 }}>SFX Library</h1>
          <p style={{ fontSize: 13, color: "#5a5a7a", marginTop: 4 }}>
            Drop MP3 files into{" "}
            <code style={{ background: "#1a1a2e", padding: "1px 6px", borderRadius: 3, fontSize: 12 }}>storage/sfx/</code>
            {" "}— click ✎ on any row to add source notes, auto-mode flag, and quality rating.
          </p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: availableCount > 0 ? "#4ade80" : "#3a3a5a" }}>{availableCount}</span>
              <span style={{ fontSize: 13, color: "#3a3a5a" }}>/{totalCount}</span>
              <p style={{ fontSize: 10, color: "#3a3a5a" }}>loaded</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: 26, fontWeight: 800, color: autoSafeCount > 0 ? "#4ade80" : "#3a3a5a" }}>{autoSafeCount}</span>
              <p style={{ fontSize: 10, color: "#3a3a5a" }}>auto-safe</p>
            </div>
          </div>
          <button
            onClick={loadLibrary}
            style={{ background: "#1a1a2e", border: "1px solid #2a2a40", borderRadius: 7, padding: "5px 14px", fontSize: 12, color: "#7070a0", cursor: "pointer" }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* ── Copied toast ── */}
      {copied && (
        <div style={{ position: "fixed", top: 20, right: 20, background: "#1a2a1a", border: "1px solid #4ade80", borderRadius: 8, padding: "10px 18px", color: "#4ade80", fontSize: 13, zIndex: 1000 }}>
          Copied: {copied}
        </div>
      )}

      {/* ── Auto-mode info card ── */}
      <div style={{ background: "#0d130d", border: "1px solid #1a3a1a", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", gap: 14, alignItems: "flex-start" }}>
        <span style={{ color: "#4ade80", fontSize: 16, flexShrink: 0 }}>⚙</span>
        <div>
          <p style={{ color: "#4ade80", fontSize: 12, fontWeight: 600 }}>How Auto Mode works</p>
          <p style={{ color: "#3a5a3a", fontSize: 11, marginTop: 3, lineHeight: 1.6 }}>
            The AI supervisor auto-detects SFX events from your script text (e.g. "it was raining" → rain_heavy).
            Only files with <strong style={{ color: "#4ade80" }}>AUTO ✓</strong> are eligible for auto-selection.
            Files without it are skipped by the supervisor. Manual <code style={{ fontSize: 10 }}>[SFX: event]</code> script
            tags always work regardless of this setting. Click <strong>✎</strong> on any row to configure.
          </p>
        </div>
      </div>

      {/* ── Free Sources panel ── */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 12, padding: 16, marginBottom: 12 }}>
        <button
          onClick={() => setShowSources(s => !s)}
          style={{ background: "none", border: "none", color: "#9090c0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, padding: 0, width: "100%", textAlign: "left" }}
        >
          <span style={{ color: "#60a5fa" }}>◈</span> Free SFX Sources
          <span style={{ marginLeft: "auto", color: "#3a3a5a", fontSize: 11 }}>{showSources ? "▲" : "▼"}</span>
        </button>
        {showSources && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { name: "Freesound", tag: "Best variety + CC0", url: "https://freesound.org/", color: "#fb923c" },
                { name: "Pixabay SFX", tag: "Fast + easy", url: "https://pixabay.com/sound-effects/", color: "#f472b6" },
                { name: "Mixkit", tag: "Free, no signup", url: "https://mixkit.co/free-sound-effects/", color: "#4ade80" },
                { name: "Sonniss GDC", tag: "Large bundle", url: "https://sonniss.com/gameaudiogdc/", color: "#c084fc" },
              ].map(s => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#141420", border: `1px solid ${s.color}22`, borderRadius: 8, padding: "12px 14px", textDecoration: "none", display: "block" }}>
                  <p style={{ color: s.color, fontSize: 13, fontWeight: 600 }}>{s.name}</p>
                  <p style={{ color: "#4a4a6a", fontSize: 11, marginTop: 2 }}>{s.tag}</p>
                </a>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 12 }}>
              {[
                ["Thunder", FREESOUND_LINKS.thunder], ["Rain", FREESOUND_LINKS.rain_light],
                ["Gunshot", FREESOUND_LINKS.gunshot], ["Sword clash", FREESOUND_LINKS.sword_clash],
                ["Footsteps", FREESOUND_LINKS.footsteps], ["Horse gallop", FREESOUND_LINKS.horse_gallop],
                ["Market", FREESOUND_LINKS.market_noise], ["Heartbeat", FREESOUND_LINKS.heartbeat],
                ["Forest", FREESOUND_LINKS.forest_ambience], ["Explosion", FREESOUND_LINKS.explosion],
              ].map(([label, url]) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ background: "#1a1a2e", border: "1px solid #2a2a3a", borderRadius: 5, padding: "4px 10px", color: "#60a5fa", fontSize: 11, textDecoration: "none" }}>
                  {label}
                </a>
              ))}
            </div>
            <div style={{ padding: 10, background: "#1a1a28", borderRadius: 7, border: "1px solid #2a2a40" }}>
              <p style={{ color: "#facc15", fontSize: 11, fontWeight: 600 }}>License Rule</p>
              <p style={{ color: "#5a5a6a", fontSize: 11, marginTop: 3, lineHeight: 1.6 }}>
                Always check each file's license. Prefer CC0 or royalty-free commercial-safe.
                Freesound files vary per upload — read the license on each file page before marking safeForAutoMode.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Priority Pack guide ── */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 12, padding: 16, marginBottom: 16 }}>
        <button
          onClick={() => setShowPriority(s => !s)}
          style={{ background: "none", border: "none", color: "#9090c0", fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, padding: 0, width: "100%", textAlign: "left" }}
        >
          <span style={{ color: "#fb923c" }}>★</span> Priority Loading Guide
          {missingPack1.length > 0 && (
            <span style={{ background: "#fb923c22", color: "#fb923c", fontSize: 10, borderRadius: 4, padding: "1px 7px", border: "1px solid #fb923c44" }}>
              {missingPack1.length} Pack 1 missing
            </span>
          )}
          <span style={{ marginLeft: "auto", color: "#3a3a5a", fontSize: 11 }}>{showPriority ? "▲" : "▼"}</span>
        </button>
        {showPriority && (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Pack 1 — Load First", color: "#fb923c", events: PRIORITY_PACK_1 },
              { label: "Pack 2 — Support Set", color: "#c084fc", events: PRIORITY_PACK_2 },
            ].map(pack => (
              <div key={pack.label} style={{ background: "#141420", border: `1px solid ${pack.color}18`, borderRadius: 8, padding: 14 }}>
                <p style={{ color: pack.color, fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{pack.label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {pack.events.map(e => {
                    const found = library.find(s => s.event === e);
                    const safe = notes[e]?.safeForAutoMode;
                    return (
                      <span key={e} style={{
                        background: found?.available ? "#1a2a1a" : "#1a1a2e",
                        border: `1px solid ${found?.available ? "#2a4a2a" : "#2a2a40"}`,
                        color: found?.available ? "#4ade80" : "#3a3a5a",
                        borderRadius: 4, padding: "2px 7px", fontSize: 10,
                      }}>
                        {found?.available ? (safe ? "✓⚙" : "✓") : "○"} {e}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── LLM assistant ── */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 12, padding: 16, marginBottom: 20 }}>
        <div className="flex items-center justify-between">
          <div>
            <p style={{ color: "#9090c0", fontSize: 13, fontWeight: 600 }}>
              <span style={{ color: "#34d399" }}>⬡</span> AI Download Assistant
            </p>
            <p style={{ color: "#3a3a5a", fontSize: 11, marginTop: 2 }}>
              Ask local Ollama to plan which files to download and from where — saves API credits
            </p>
          </div>
          <button
            onClick={askLLMDownloadPlan}
            disabled={errandLoading || availableCount === totalCount}
            style={{
              background: "#1a2a1a", border: "1px solid #2a4a2a", borderRadius: 7, padding: "7px 16px",
              fontSize: 12, color: "#34d399", cursor: "pointer", opacity: errandLoading ? 0.6 : 1,
            }}
          >
            {errandLoading ? "Planning…" : "Plan My Downloads"}
          </button>
        </div>
        {errandResult && (
          <div style={{ marginTop: 12, background: "#0d0d18", border: "1px solid #1a2a1a", borderRadius: 7, padding: 12 }}>
            <p style={{ color: "#34d399", fontSize: 11, fontWeight: 600, marginBottom: 6 }}>Ollama Plan</p>
            <pre style={{ color: "#9090b0", fontSize: 11, whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.7 }}>{errandResult}</pre>
          </div>
        )}
      </div>

      {/* ── Category filter bar ── */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setFilter("all")} style={{
          background: filter === "all" ? "#7c5cfc22" : "#0f0f1a",
          color: filter === "all" ? "#7c5cfc" : "#5a5a7a",
          border: `1px solid ${filter === "all" ? "#7c5cfc44" : "#1e1e38"}`,
          borderRadius: 7, padding: "5px 14px", fontSize: 12, cursor: "pointer",
        }}>All · {totalCount}</button>
        {CATEGORY_ORDER.map(cat => {
          const counts = catCounts[cat];
          const active = filter === cat;
          const color = CATEGORY_COLORS[cat];
          return (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              background: active ? `${color}18` : "#0f0f1a",
              color: active ? color : "#5a5a7a",
              border: `1px solid ${active ? color + "44" : "#1e1e38"}`,
              borderRadius: 7, padding: "5px 12px", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span>{CATEGORY_ICONS[cat]}</span>
              <span style={{ textTransform: "capitalize" }}>{cat}</span>
              <span style={{
                background: counts.available > 0 ? `${color}22` : "#1a1a2e",
                color: counts.available > 0 ? color : "#2a2a4a",
                borderRadius: 4, padding: "0 5px", fontSize: 10, fontWeight: 700,
              }}>{counts.available}/{counts.total}</span>
            </button>
          );
        })}
      </div>

      {/* ── SFX Cards ── */}
      {loading ? (
        <p style={{ color: "#3a3a5a", fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading library…</p>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 26 }}>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ width: 3, height: 14, borderRadius: 2, background: CATEGORY_COLORS[cat] ?? "#7c5cfc", display: "inline-block" }} />
              <span style={{ fontSize: 11, color: CATEGORY_COLORS[cat] ?? "#7c5cfc", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                {CATEGORY_ICONS[cat]} {cat}
              </span>
              <span style={{ fontSize: 11, color: "#2a2a4a" }}>{catCounts[cat].available}/{catCounts[cat].total} loaded</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {items.map(sfx => (
                <SFXCard
                  key={sfx.event}
                  sfx={sfx}
                  note={notes[sfx.event]}
                  onCopy={handleCopy}
                  playing={playingEvent === sfx.event}
                  onPlay={() => setPlayingEvent(sfx.event)}
                  onStop={() => setPlayingEvent(null)}
                  onSaveNote={handleSaveNote}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Script Annotation Guide ── */}
      <div style={{ background: "#0f0f1a", border: "1px solid #1e1e38", borderRadius: 12, padding: 18, marginTop: 4 }}>
        <h3 style={{ color: "#7070a0", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Script Annotations</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <p style={{ color: "#4a4a6a", fontSize: 11, marginBottom: 6 }}>One-shot SFX:</p>
            <pre style={{ background: "#0d0d18", borderRadius: 6, padding: 10, fontSize: 11, color: "#a0a0c0", margin: 0 }}>
{`[SFX: thunder]
[SFX: gunshot]
[SOUND: crowd_cheer]`}
            </pre>
          </div>
          <div>
            <p style={{ color: "#4a4a6a", fontSize: 11, marginBottom: 6 }}>Ambience layers:</p>
            <pre style={{ background: "#0d0d18", borderRadius: 6, padding: 10, fontSize: 11, color: "#a0a0c0", margin: 0 }}>
{`[AMBIENCE: market_noise]
[AMBIENCE: forest_ambience]
[AMBIENCE: ocean_waves]`}
            </pre>
          </div>
        </div>
        <p style={{ fontSize: 11, color: "#2a2a4a", marginTop: 10 }}>
          Manual tags always work regardless of auto-mode setting.
          Auto-detection from script text only uses files marked <strong style={{ color: "#4ade80" }}>AUTO ✓</strong>.
        </p>
      </div>
    </div>
  );
}
