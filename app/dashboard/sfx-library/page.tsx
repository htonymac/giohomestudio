"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ds } from "../../../lib/designSystem";
import HeroTitle from "../../components/hero/HeroTitle";
import { Card } from "../../components/ui/Card";
import { ButtonPrimary } from "../../components/ui/ButtonPrimary";
import { Check, Music, Settings } from "../../components/icons";

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
  weather:    ds.color.sky,
  crowd:      ds.color.pink,
  action:     ds.color.coral,
  nature:     ds.color.mint,
  urban:      ds.color.gold,
  horror:     ds.color.magenta,
  animal:     ds.color.mint,
  transition: ds.color.lilac,
  music:      ds.color.magenta,
  voice:      ds.color.coral,
  nigerian:   ds.color.mint,
  household:  ds.color.blue,
  tech:       ds.color.sky,
};

const CATEGORY_ORDER = ["transition", "crowd", "action", "nigerian", "nature", "weather", "urban", "household", "music", "voice", "tech", "horror", "animal"];
const SOURCE_SITES = ["Freesound", "Pixabay", "Mixkit", "Sonniss", "Artlist", "Uploaded", "Other"];
const QUALITY_OPTIONS: { value: SFXSourceNote["qualityRating"]; label: string; color: string }[] = [
  { value: "",          label: "Unrated", color: ds.color.mute2 },
  { value: "low",       label: "Low",     color: "#f87171" },
  { value: "good",      label: "Good",    color: ds.color.gold },
  { value: "excellent", label: "Excellent",color: ds.color.mint },
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
          background: playing ? color : (available ? color : ds.color.mute2),
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

  useEffect(() => { setDraft(note ? { ...blank, ...note } : blank); }, [note?.updatedAt]);

  const set = <K extends keyof SFXSourceNote>(k: K, v: SFXSourceNote[K]) =>
    setDraft(d => ({ ...d, [k]: v }));

  async function handleSave() {
    await onSave(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const inputStyle = {
    background: ds.color.card,
    color: ds.color.ink,
    border: `1px solid ${ds.color.line2}`,
    borderRadius: ds.radius.sm,
    padding: "5px 8px",
    fontSize: 12,
    width: "100%",
    fontFamily: ds.font.sans,
    outline: "none",
  };

  return (
    <div style={{ borderTop: `1px solid ${ds.color.line}`, padding: "14px 16px", background: ds.color.paper }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4, fontFamily: ds.font.mono, letterSpacing: "0.14em", textTransform: "uppercase" }}>Source Site</label>
          <select
            value={draft.sourceSite}
            onChange={e => set("sourceSite", e.target.value)}
            style={inputStyle}
          >
            <option value="">Select source…</option>
            {SOURCE_SITES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4, fontFamily: ds.font.mono, letterSpacing: "0.14em", textTransform: "uppercase" }}>Source URL</label>
          <input
            value={draft.sourceUrl}
            onChange={e => set("sourceUrl", e.target.value)}
            placeholder="https://freesound.org/people/…"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4, fontFamily: ds.font.mono, letterSpacing: "0.14em", textTransform: "uppercase" }}>Attribution Note</label>
          <input
            value={draft.attributionNote}
            onChange={e => set("attributionNote", e.target.value)}
            placeholder="CC0 — no attribution required"
            style={inputStyle}
          />
        </div>

        <div>
          <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 4, fontFamily: ds.font.mono, letterSpacing: "0.14em", textTransform: "uppercase" }}>Import Note</label>
          <input
            value={draft.importNote}
            onChange={e => set("importNote", e.target.value)}
            placeholder="Downloaded 2026-04-01, original: thunder-01.mp3"
            style={inputStyle}
          />
        </div>

        <div style={{ display: "flex", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <div
              onClick={() => set("safeForAutoMode", !draft.safeForAutoMode)}
              style={{
                width: 40, height: 22, borderRadius: 11, position: "relative", cursor: "pointer", flexShrink: 0,
                background: draft.safeForAutoMode ? ds.color.mint : ds.color.mute2,
                transition: "background 0.2s ease",
                border: `1px solid ${draft.safeForAutoMode ? ds.color.mint : ds.color.line2}`,
              }}
            >
              <div style={{
                position: "absolute", top: 2, left: draft.safeForAutoMode ? 20 : 2,
                width: 16, height: 16, borderRadius: "50%", background: ds.color.ink,
                transition: "left 0.2s ease",
              }} />
            </div>
            <div>
              <p style={{ color: draft.safeForAutoMode ? ds.color.mint : ds.color.mute, fontSize: 12, fontWeight: 600 }}>
                {draft.safeForAutoMode ? "Safe for Auto Mode" : "Manual Only"}
              </p>
              <p style={{ color: ds.color.mute2, fontSize: 10, marginTop: 1 }}>
                {draft.safeForAutoMode ? "Supervisor can auto-select this file" : "Only [SFX:] tags can trigger this"}
              </p>
            </div>
          </label>
        </div>

        <div>
          <label style={{ fontSize: 10, color: ds.color.mute, display: "block", marginBottom: 6, fontFamily: ds.font.mono, letterSpacing: "0.14em", textTransform: "uppercase" }}>Quality Rating</label>
          <div style={{ display: "flex", gap: 6 }}>
            {QUALITY_OPTIONS.map(q => (
              <button
                key={q.value}
                onClick={() => set("qualityRating", q.value)}
                style={{
                  background: draft.qualityRating === q.value ? `${q.color}22` : ds.color.card,
                  border: `1px solid ${draft.qualityRating === q.value ? q.color + "66" : ds.color.line2}`,
                  color: draft.qualityRating === q.value ? q.color : ds.color.mute,
                  borderRadius: ds.radius.xs, padding: "4px 10px", fontSize: 11, cursor: "pointer",
                  fontFamily: ds.font.sans,
                }}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {draft.sourceUrl && (
        <div style={{ marginTop: 8 }}>
          <a href={draft.sourceUrl} target="_blank" rel="noopener noreferrer"
            style={{ color: ds.color.sky, fontSize: 11, textDecoration: "none" }}>
            Open source page
          </a>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12 }}>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            background: saved ? `${ds.color.mint}18` : ds.color.card,
            border: `1px solid ${saved ? ds.color.mint : ds.color.line2}`,
            color: saved ? ds.color.mint : ds.color.mute,
            borderRadius: ds.radius.xs, padding: "5px 16px", fontSize: 12, cursor: "pointer",
            opacity: saving ? 0.6 : 1, fontFamily: ds.font.sans,
          }}
        >
          {saving ? "Saving…" : saved ? "Saved" : "Save Notes"}
        </button>
        {note?.updatedAt && (
          <span style={{ color: ds.color.mute2, fontSize: 10, fontFamily: ds.font.mono }}>
            Last updated: {new Date(note.updatedAt).toLocaleDateString()}
          </span>
        )}
      </div>
    </div>
  );
}

// ── SFX Card ─────────────────────────────────────────────────────────────────
function SFXCard({ sfx, note, onCopy, playing, onPlay, onStop, onSaveNote, isSelectMode, onSelect }: {
  sfx: SFXEntry;
  note: SFXSourceNote | undefined;
  onCopy: (filename: string) => void;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  onSaveNote: (draft: SFXSourceNote) => Promise<void>;
  isSelectMode?: boolean;
  onSelect?: (sfx: SFXEntry) => void;
}) {
  const color = CATEGORY_COLORS[sfx.category] ?? ds.color.lilac;
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
    ? QUALITY_OPTIONS.find(q => q.value === note.qualityRating)?.color ?? ds.color.mute2
    : ds.color.mute2;

  return (
    <div style={{
      background: playing ? `${color}0d` : ds.color.card,
      border: `1px solid ${expanded ? color + "33" : (playing ? color + "44" : (sfx.available ? ds.color.line2 : ds.color.line))}`,
      borderRadius: ds.radius.sm, overflow: "hidden", transition: "border-color 0.2s ease",
    }}>
      <div style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, position: "relative" }}>
        {playing && (
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: color, borderRadius: `${ds.radius.sm}px 0 0 ${ds.radius.sm}px` }} />
        )}

        <button
          onClick={sfx.available ? togglePlay : undefined}
          title={sfx.available ? (playing ? "Stop" : "Preview") : "File not loaded"}
          style={{
            width: 34, height: 34, borderRadius: "50%", border: "none",
            cursor: sfx.available ? "pointer" : "default",
            background: sfx.available ? (playing ? color : `${color}20`) : ds.color.mute2,
            color: sfx.available ? (playing ? ds.color.ink : color) : ds.color.mute2,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 11, flexShrink: 0, transition: "all 0.2s ease",
            boxShadow: playing ? `0 0 14px ${color}55` : "none",
          }}
        >
          {playing ? "■" : "▶"}
        </button>

        <Waveform event={sfx.event} color={color} playing={playing} available={sfx.available} />

        <div style={{ minWidth: 130 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: sfx.available ? ds.color.ink : ds.color.mute2, fontSize: 13, fontWeight: 600, fontFamily: ds.font.sans }}>
              {sfx.event}
            </span>
            {sfx.available && <span style={{ width: 6, height: 6, borderRadius: "50%", background: ds.color.mint, boxShadow: `0 0 5px ${ds.color.mint}88`, flexShrink: 0 }} />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
            <p style={{ color: ds.color.mute2, fontSize: 10, fontFamily: ds.font.sans }}>{sfx.description}</p>
            {note?.qualityRating && (
              <span style={{ color: qualityColor, fontSize: 9, background: `${qualityColor}18`, borderRadius: 3, padding: "0 5px", border: `1px solid ${qualityColor}33`, fontFamily: ds.font.mono }}>
                {note.qualityRating}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 160 }}>
          <code style={{ color: sfx.available ? ds.color.sky : ds.color.mute2, fontSize: 11, fontFamily: ds.font.mono }}>{sfx.filename}</code>
          <button
            onClick={() => { navigator.clipboard.writeText(sfx.filename); onCopy(sfx.filename); }}
            title="Copy filename"
            style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: 4, padding: "2px 6px", fontSize: 10, color: ds.color.mute, cursor: "pointer", fontFamily: ds.font.sans }}
          >
            copy
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, minWidth: 90 }}>
          {sfx.available ? (
            <span style={{ color: ds.color.mint, fontSize: 11, fontWeight: 600, fontFamily: ds.font.sans }}>Ready</span>
          ) : (
            <span style={{ color: ds.color.mute, fontSize: 11, fontFamily: ds.font.sans }}>Missing</span>
          )}
          {!sfx.available && freesoundUrl && (
            <a href={freesoundUrl} target="_blank" rel="noopener noreferrer" style={{ color: ds.color.sky, fontSize: 10, textDecoration: "none", fontFamily: ds.font.sans }}>Freesound</a>
          )}
          {!sfx.available && pixabayUrl && (
            <a href={pixabayUrl} target="_blank" rel="noopener noreferrer" style={{ color: ds.color.pink, fontSize: 10, textDecoration: "none", fontFamily: ds.font.sans }}>Pixabay</a>
          )}
        </div>

        <div style={{ minWidth: 50, textAlign: "center" }}>
          {note?.safeForAutoMode ? (
            <span style={{ background: `${ds.color.mint}18`, color: ds.color.mint, fontSize: 9, borderRadius: 4, padding: "2px 6px", border: `1px solid ${ds.color.mint}33`, display: "inline-block", fontFamily: ds.font.mono }}>AUTO</span>
          ) : (
            <span style={{ background: ds.color.card, color: ds.color.mute2, fontSize: 9, borderRadius: 4, padding: "2px 6px", border: `1px solid ${ds.color.line2}`, display: "inline-block", fontFamily: ds.font.mono }}>manual</span>
          )}
        </div>

        {isSelectMode && sfx.available && (
          <ButtonPrimary size="sm" onClick={() => onSelect?.(sfx)}>
            Select
          </ButtonPrimary>
        )}

        {!isSelectMode && (
          <button
            onClick={() => setExpanded(e => !e)}
            title={expanded ? "Collapse source notes" : "Edit source notes"}
            style={{
              background: expanded ? ds.color.card : "transparent",
              border: `1px solid ${expanded ? ds.color.line2 : "transparent"}`,
              borderRadius: ds.radius.xs, padding: "3px 8px", fontSize: 11,
              color: expanded ? ds.color.mute : ds.color.mute2, cursor: "pointer",
              flexShrink: 0, transition: "all 0.15s ease", fontFamily: ds.font.sans,
            }}
          >
            {expanded ? "collapse" : "notes"}
          </button>
        )}
      </div>

      {expanded && (
        <MetadataPanel sfx={sfx} note={note} onSave={handleSaveNote} saving={savingNote} />
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function SFXLibraryPage() {
  return <Suspense fallback={<div style={{ padding: 40, color: ds.color.mute }}>Loading SFX Library...</div>}><SFXLibraryInner /></Suspense>;
}

function SFXLibraryInner() {
  const searchParams = useSearchParams();
  const selectMode = searchParams.get("selectMode");
  const returnTo = searchParams.get("returnTo") || "";
  const isSelectMode = selectMode === "music";

  const [library, setLibrary] = useState<SFXEntry[]>([]);
  const [notes, setNotes] = useState<NotesMap>({});
  const [availableCount, setAvailableCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>(isSelectMode ? "music" : "all");
  const [playingEvent, setPlayingEvent] = useState<string | null>(null);
  const [copied, setCopied] = useState("");
  const [showSources, setShowSources] = useState(false);
  const [showPriority, setShowPriority] = useState(false);
  const [errandLoading, setErrandLoading] = useState(false);
  const [errandResult, setErrandResult] = useState("");

  function selectAndReturn(sfx: SFXEntry) {
    const musicUrl = `/api/sfx/play?event=${sfx.event}`;
    localStorage.setItem("ghs_selected_music", JSON.stringify({
      url: musicUrl, event: sfx.event, filename: sfx.filename,
      category: sfx.category, timestamp: Date.now(),
    }));
    const returnPath = returnTo ? `/dashboard/${returnTo}` : "/dashboard/auto-creator";
    window.location.href = returnPath;
  }

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

  const CATEGORIES = ["weather","crowd","action","nature","urban","horror","animal","vehicle","transition","music","voice","nigerian","household","tech","weapon","impact","movement","children"];
  const isCategory = filter === "all" || CATEGORIES.includes(filter);
  const filtered = filter === "all" ? library : isCategory ? library.filter(s => s.category === filter) : library.filter(s => s.event.includes(filter) || s.description.toLowerCase().includes(filter));
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

  const tabBtn = (active: boolean, onClick: () => void, label: string, count?: string) => (
    <button onClick={onClick} style={{
      background: active ? `${ds.color.lilac}18` : ds.color.card,
      color: active ? ds.color.lilac : ds.color.mute,
      border: `1px solid ${active ? ds.color.lilac + "44" : ds.color.line}`,
      borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer",
      display: "flex", alignItems: "center", gap: 5, fontFamily: ds.font.sans,
      transition: "all 0.15s",
    }}>
      <span style={{ textTransform: "capitalize" }}>{label}</span>
      {count !== undefined && (
        <span style={{
          background: active ? `${ds.color.lilac}22` : ds.color.mute2 + "22",
          color: active ? ds.color.lilac : ds.color.mute2,
          borderRadius: 4, padding: "0 5px", fontSize: 10, fontWeight: 700,
          fontFamily: ds.font.mono,
        }}>{count}</span>
      )}
    </button>
  );

  return (
    <div style={{ maxWidth: 960, fontFamily: ds.font.sans }}>
      {/* ── Hero ── */}
      <div style={{ marginBottom: 28 }}>
        <HeroTitle
          kicker="Sound Effects"
          title="SFX"
          italic="Library"
          sub="Royalty-free sounds for video production — preview, tag, and manage auto-mode eligibility."
        />
        <div style={{ display: "flex", gap: 16, marginTop: 16 }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: availableCount > 0 ? ds.color.mint : ds.color.mute, fontFamily: ds.font.sans }}>{availableCount}</span>
            <span style={{ fontSize: 13, color: ds.color.mute }}> / {totalCount}</span>
            <p style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>loaded</p>
          </div>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: autoSafeCount > 0 ? ds.color.mint : ds.color.mute, fontFamily: ds.font.sans }}>{autoSafeCount}</span>
            <p style={{ fontSize: 10, color: ds.color.mute, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>auto-safe</p>
          </div>
          <button
            onClick={loadLibrary}
            style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: "5px 14px", fontSize: 12, color: ds.color.mute, cursor: "pointer", alignSelf: "flex-start", marginTop: 4 }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Select Mode Banner ── */}
      {isSelectMode && (
        <Card style={{ marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 700, color: ds.color.lilac, marginBottom: 4 }}>Select Music Track</p>
            <p style={{ fontSize: 11, color: ds.color.mute }}>
              Preview and click Select on any track. You will be returned to {returnTo ? returnTo.replace(/-/g, " ") : "the page you came from"}.
            </p>
          </div>
          <a href={returnTo ? `/dashboard/${returnTo}` : "/dashboard/auto-creator"}
            style={{ padding: "8px 16px", borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}`, background: "transparent", color: ds.color.mute, fontSize: 11, textDecoration: "none", cursor: "pointer", flexShrink: 0 }}>
            Cancel
          </a>
        </Card>
      )}

      {/* ── Copied toast ── */}
      {copied && (
        <div style={{ position: "fixed", top: 20, right: 20, background: `${ds.color.mint}18`, border: `1px solid ${ds.color.mint}`, borderRadius: ds.radius.sm, padding: "10px 18px", color: ds.color.mint, fontSize: 13, zIndex: 1000, fontFamily: ds.font.sans }}>
          Copied: {copied}
        </div>
      )}

      {/* ── Auto-mode info ── */}
      <Card style={{ marginBottom: 14, display: "flex", gap: 14, alignItems: "flex-start", padding: 14 }}>
        <Settings size={16} style={{ color: ds.color.mint, flexShrink: 0, marginTop: 2 }} />
        <div>
          <p style={{ color: ds.color.mint, fontSize: 12, fontWeight: 600, marginBottom: 3 }}>How Auto Mode works</p>
          <p style={{ color: ds.color.mute, fontSize: 11, lineHeight: 1.6 }}>
            AI supervisor auto-detects SFX events from your script text (e.g. "it was raining" triggers rain_heavy).
            Only files marked <strong style={{ color: ds.color.mint }}>AUTO</strong> are eligible. Manual <code style={{ fontSize: 10, fontFamily: ds.font.mono }}>[SFX: event]</code> tags always work regardless.
          </p>
        </div>
      </Card>

      {/* ── Free Sources panel ── */}
      <Card style={{ marginBottom: 12, padding: 16 }}>
        <button
          onClick={() => setShowSources(s => !s)}
          style={{ background: "none", border: "none", color: ds.color.ink2, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, padding: 0, width: "100%", textAlign: "left", fontFamily: ds.font.sans }}
        >
          <span style={{ color: ds.color.sky }}>◈</span> Free SFX Sources
          <span style={{ marginLeft: "auto", color: ds.color.mute, fontSize: 11 }}>{showSources ? "▲" : "▼"}</span>
        </button>
        {showSources && (
          <div style={{ marginTop: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
              {[
                { name: "Freesound", tag: "Best variety + CC0", url: "https://freesound.org/", color: ds.color.coral },
                { name: "Pixabay SFX", tag: "Fast + easy", url: "https://pixabay.com/sound-effects/", color: ds.color.pink },
                { name: "Mixkit", tag: "Free, no signup", url: "https://mixkit.co/free-sound-effects/", color: ds.color.mint },
                { name: "Sonniss GDC", tag: "Large bundle", url: "https://sonniss.com/gameaudiogdc/", color: ds.color.magenta },
              ].map(s => (
                <a key={s.name} href={s.url} target="_blank" rel="noopener noreferrer"
                  style={{ background: ds.color.card, border: `1px solid ${s.color}22`, borderRadius: ds.radius.sm, padding: "12px 14px", textDecoration: "none", display: "block" }}>
                  <p style={{ color: s.color, fontSize: 13, fontWeight: 600, fontFamily: ds.font.sans }}>{s.name}</p>
                  <p style={{ color: ds.color.mute, fontSize: 11, marginTop: 2 }}>{s.tag}</p>
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
                  style={{ background: ds.color.card, border: `1px solid ${ds.color.line2}`, borderRadius: 5, padding: "4px 10px", color: ds.color.sky, fontSize: 11, textDecoration: "none", fontFamily: ds.font.sans }}>
                  {label}
                </a>
              ))}
            </div>
            <div style={{ padding: 10, background: ds.color.paper, borderRadius: ds.radius.xs, border: `1px solid ${ds.color.line2}` }}>
              <p style={{ color: ds.color.gold, fontSize: 11, fontWeight: 600, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>License Rule</p>
              <p style={{ color: ds.color.mute, fontSize: 11, marginTop: 3, lineHeight: 1.6 }}>
                Always check each file license. Prefer CC0 or royalty-free commercial-safe.
                Read the license on each file page before marking safeForAutoMode.
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* ── Priority Pack guide ── */}
      <Card style={{ marginBottom: 16, padding: 16 }}>
        <button
          onClick={() => setShowPriority(s => !s)}
          style={{ background: "none", border: "none", color: ds.color.ink2, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, fontWeight: 600, padding: 0, width: "100%", textAlign: "left", fontFamily: ds.font.sans }}
        >
          <span style={{ color: ds.color.coral }}>★</span> Priority Loading Guide
          {missingPack1.length > 0 && (
            <span style={{ background: `${ds.color.coral}22`, color: ds.color.coral, fontSize: 10, borderRadius: 4, padding: "1px 7px", border: `1px solid ${ds.color.coral}44`, fontFamily: ds.font.mono }}>
              {missingPack1.length} Pack 1 missing
            </span>
          )}
          <span style={{ marginLeft: "auto", color: ds.color.mute, fontSize: 11 }}>{showPriority ? "▲" : "▼"}</span>
        </button>
        {showPriority && (
          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            {[
              { label: "Pack 1 — Load First", color: ds.color.coral, events: PRIORITY_PACK_1 },
              { label: "Pack 2 — Support Set", color: ds.color.magenta, events: PRIORITY_PACK_2 },
            ].map(pack => (
              <div key={pack.label} style={{ background: ds.color.paper, border: `1px solid ${pack.color}18`, borderRadius: ds.radius.sm, padding: 14 }}>
                <p style={{ color: pack.color, fontSize: 12, fontWeight: 700, marginBottom: 8, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>{pack.label}</p>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                  {pack.events.map(e => {
                    const found = library.find(s => s.event === e);
                    const safe = notes[e]?.safeForAutoMode;
                    return (
                      <span key={e} style={{
                        background: found?.available ? `${ds.color.mint}18` : ds.color.card,
                        border: `1px solid ${found?.available ? ds.color.mint + "33" : ds.color.line2}`,
                        color: found?.available ? ds.color.mint : ds.color.mute,
                        borderRadius: 4, padding: "2px 7px", fontSize: 10, fontFamily: ds.font.mono,
                      }}>
                        {found?.available ? (safe ? "A " : "") : "○ "}{e}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── LLM assistant ── */}
      <Card style={{ marginBottom: 20, padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <p style={{ color: ds.color.ink2, fontSize: 13, fontWeight: 600, fontFamily: ds.font.sans }}>
              <span style={{ color: ds.color.mint }}>◈</span> AI Download Assistant
            </p>
            <p style={{ color: ds.color.mute, fontSize: 11, marginTop: 2 }}>
              Ask local Ollama to plan which files to download — saves API credits
            </p>
          </div>
          <ButtonPrimary
            onClick={askLLMDownloadPlan}
            disabled={errandLoading || availableCount === totalCount}
            size="sm"
          >
            {errandLoading ? "Planning…" : "Plan My Downloads"}
          </ButtonPrimary>
        </div>
        {errandResult && (
          <div style={{ marginTop: 12, background: ds.color.paper, border: `1px solid ${ds.color.line2}`, borderRadius: ds.radius.xs, padding: 12 }}>
            <p style={{ color: ds.color.mint, fontSize: 11, fontWeight: 600, marginBottom: 6, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>Ollama Plan</p>
            <pre style={{ color: ds.color.ink2, fontSize: 11, whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.7, fontFamily: ds.font.mono }}>{errandResult}</pre>
          </div>
        )}
      </Card>

      {/* ── Quick search links ── */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
        <span style={{ fontSize: 9, color: ds.color.mute, marginRight: 4, lineHeight: "24px", fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>Quick:</span>
        {["thunder", "rain", "wind", "gunshot", "sword", "footsteps", "door", "crowd", "explosion", "car", "dog", "ocean", "fire", "bird", "piano", "whoosh"].map(q => (
          <button key={q} onClick={() => setFilter(q)}
            style={{ fontSize: 9, padding: "3px 10px", borderRadius: 100, border: `1px solid ${filter === q ? ds.color.lilac + "44" : ds.color.line}`, background: filter === q ? `${ds.color.lilac}15` : "transparent", color: filter === q ? ds.color.lilac : ds.color.mute, cursor: "pointer", fontFamily: ds.font.mono }}>
            {q}
          </button>
        ))}
      </div>

      {/* ── Category filter bar ── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {tabBtn(filter === "all", () => setFilter("all"), "All", String(totalCount))}
        {CATEGORY_ORDER.map(cat => {
          const counts = catCounts[cat];
          const active = filter === cat;
          const color = CATEGORY_COLORS[cat];
          return (
            <button key={cat} onClick={() => setFilter(cat)} style={{
              background: active ? `${color}18` : ds.color.card,
              color: active ? color : ds.color.mute,
              border: `1px solid ${active ? color + "44" : ds.color.line}`,
              borderRadius: ds.radius.xs, padding: "5px 12px", fontSize: 12, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, fontFamily: ds.font.sans,
              transition: "all 0.15s",
            }}>
              <span style={{ textTransform: "capitalize" }}>{cat}</span>
              <span style={{
                background: counts.available > 0 ? `${color}22` : ds.color.card,
                color: counts.available > 0 ? color : ds.color.mute2,
                borderRadius: 4, padding: "0 5px", fontSize: 10, fontWeight: 700, fontFamily: ds.font.mono,
              }}>{counts.available}/{counts.total}</span>
            </button>
          );
        })}
      </div>

      {/* ── SFX Cards ── */}
      {loading ? (
        <p style={{ color: ds.color.mute, fontSize: 13, padding: "40px 0", textAlign: "center" }}>Loading library…</p>
      ) : (
        Object.entries(grouped).map(([cat, items]) => (
          <div key={cat} style={{ marginBottom: 26 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ width: 3, height: 14, borderRadius: 2, background: CATEGORY_COLORS[cat] ?? ds.color.lilac, display: "inline-block" }} />
              <span style={{ fontSize: 11, color: CATEGORY_COLORS[cat] ?? ds.color.lilac, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: ds.font.mono }}>
                {cat}
              </span>
              <span style={{ fontSize: 11, color: ds.color.mute2, fontFamily: ds.font.mono }}>{catCounts[cat].available}/{catCounts[cat].total} loaded</span>
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
                  isSelectMode={isSelectMode}
                  onSelect={selectAndReturn}
                />
              ))}
            </div>
          </div>
        ))
      )}

      {/* ── Script Annotation Guide ── */}
      <Card style={{ marginTop: 4, padding: 18 }}>
        <h3 style={{ color: ds.color.mute, fontSize: 13, fontWeight: 600, marginBottom: 10, fontFamily: ds.font.mono, textTransform: "uppercase", letterSpacing: "0.14em" }}>Script Annotations</h3>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div>
            <p style={{ color: ds.color.mute, fontSize: 11, marginBottom: 6 }}>One-shot SFX:</p>
            <pre style={{ background: ds.color.paper, borderRadius: ds.radius.xs, padding: 10, fontSize: 11, color: ds.color.ink2, margin: 0, fontFamily: ds.font.mono }}>
{`[SFX: thunder]
[SFX: gunshot]
[SOUND: crowd_cheer]`}
            </pre>
          </div>
          <div>
            <p style={{ color: ds.color.mute, fontSize: 11, marginBottom: 6 }}>Ambience layers:</p>
            <pre style={{ background: ds.color.paper, borderRadius: ds.radius.xs, padding: 10, fontSize: 11, color: ds.color.ink2, margin: 0, fontFamily: ds.font.mono }}>
{`[AMBIENCE: market_noise]
[AMBIENCE: forest_ambience]
[AMBIENCE: ocean_waves]`}
            </pre>
          </div>
        </div>
        <p style={{ fontSize: 11, color: ds.color.mute2, marginTop: 10, lineHeight: 1.6 }}>
          Manual tags always work regardless of auto-mode setting.
          Auto-detection only uses files marked <strong style={{ color: ds.color.mint }}>AUTO</strong>.
        </p>
      </Card>
    </div>
  );
}
