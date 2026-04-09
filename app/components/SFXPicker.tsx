"use client";

import { useEffect, useState, useRef } from "react";

interface SFXItem {
  event: string;
  filename: string;
  description: string;
  category: string;
  available: boolean;
}

interface SFXPickerProps {
  onSelect?: (event: string, path: string) => void;
  compact?: boolean;
}

const CATEGORY_ICONS: Record<string, string> = {
  weather: "🌧", crowd: "👥", action: "💥", nature: "🌿", urban: "🏙",
  horror: "👻", animal: "🐕", vehicle: "🚗", transition: "✨", music: "🎵",
  voice: "🗣", nigerian: "🇳🇬", household: "🏠", tech: "💻", weapon: "⚔", impact: "💢",
};

export default function SFXPicker({ onSelect, compact = false }: SFXPickerProps) {
  const [library, setLibrary] = useState<SFXItem[]>([]);
  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    fetch("/api/sfx")
      .then(r => r.json())
      .then(d => setLibrary((d.library ?? []).filter((s: SFXItem) => s.available)));
  }, []);

  const categories = [...new Set(library.map(s => s.category))];

  const filtered = library.filter(s => {
    if (filter && s.category !== filter) return false;
    if (search && !s.event.includes(search.toLowerCase()) && !s.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  function playSFX(event: string) {
    if (playing === event) {
      audioRef.current?.pause();
      setPlaying(null);
      return;
    }
    if (audioRef.current) { audioRef.current.pause(); }
    const audio = new Audio(`/api/sfx/play?event=${event}`);
    audioRef.current = audio;
    audio.play();
    audio.onended = () => setPlaying(null);
    setPlaying(event);
  }

  function handleSelect(s: SFXItem) {
    onSelect?.(s.event, `storage/sfx/${s.filename}`);
  }

  if (library.length === 0) {
    return <p style={{ fontSize: 11, color: "#404060", padding: 8 }}>Loading SFX...</p>;
  }

  return (
    <div style={{ fontSize: 12 }}>
      {/* Search + filter */}
      <div style={{ display: "flex", gap: 4, marginBottom: 8, flexWrap: "wrap" }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search SFX..."
          style={{ flex: 1, minWidth: 120, background: "#1a1a2e", border: "1px solid #2a2a40", color: "#e0e0f0", fontSize: 11, borderRadius: 6, padding: "4px 8px" }}
        />
        <button onClick={() => setFilter("")}
          style={{ fontSize: 9, padding: "3px 8px", borderRadius: 4, border: `1px solid ${!filter ? "#7c5cfc" : "#2a2a40"}`, background: !filter ? "rgba(124,92,252,0.15)" : "#1a1a2e", color: !filter ? "#a080ff" : "#6060a0", cursor: "pointer" }}>
          All ({library.length})
        </button>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(f => f === c ? "" : c)}
            style={{ fontSize: 9, padding: "3px 6px", borderRadius: 4, border: `1px solid ${filter === c ? "#7c5cfc" : "#2a2a40"}`, background: filter === c ? "rgba(124,92,252,0.15)" : "#1a1a2e", color: filter === c ? "#a080ff" : "#6060a0", cursor: "pointer" }}>
            {CATEGORY_ICONS[c] ?? "🔊"} {c}
          </button>
        ))}
      </div>

      {/* SFX grid */}
      <div style={{ display: "grid", gridTemplateColumns: compact ? "repeat(2, 1fr)" : "repeat(3, 1fr)", gap: 4, maxHeight: compact ? 200 : 320, overflowY: "auto" }}>
        {filtered.map(s => (
          <div key={s.event}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 8px",
              background: playing === s.event ? "rgba(124,92,252,0.12)" : "#0a0a18",
              border: `1px solid ${playing === s.event ? "#7c5cfc" : "#1a1a2e"}`,
              borderRadius: 6, cursor: "pointer", transition: "all 0.1s",
            }}
            onClick={() => playSFX(s.event)}
          >
            <span style={{ fontSize: 10, flexShrink: 0 }}>{playing === s.event ? "⏸" : "▶"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 10, color: "#e0e0f0", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {s.description}
              </p>
              <p style={{ fontSize: 8, color: "#404060" }}>{s.event}</p>
            </div>
            {onSelect && (
              <button
                onClick={e => { e.stopPropagation(); handleSelect(s); }}
                style={{ fontSize: 8, padding: "2px 6px", borderRadius: 3, background: "rgba(124,92,252,0.15)", color: "#a080ff", border: "1px solid rgba(124,92,252,0.25)", cursor: "pointer", flexShrink: 0 }}>
                Use
              </button>
            )}
          </div>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ fontSize: 10, color: "#404060", textAlign: "center", padding: 12 }}>No SFX match</p>
      )}
    </div>
  );
}
