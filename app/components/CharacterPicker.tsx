"use client";

import { useState, useEffect } from "react";
import { parseCharacterId } from "@/lib/character-id";
import type { ReferenceImage } from "@/types/character";

interface Character {
  id: string;
  characterId: string | null;
  name: string;
  gender: string | null;
  age: string | null;
  country: string | null;
  culture: string | null;
  imageUrl: string | null;
  visualDescription: string | null;
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: string | null;
  defaultSpeechStyle: string | null;
  role: string | null;
  personality: string | null;
  wardrobe: string | null;
  hairstyle: string | null;
  accent: string | null;
  language: string | null;
  referenceImages: unknown;
}

/** Parse referenceImages field (Json? from Prisma) into typed array */
function parseRefImages(raw: unknown): ReferenceImage[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter(item => typeof item?.url === "string" && item.url)
    .map(item => ({
      url: item.url as string,
      angle: typeof item.angle === "string" ? item.angle : undefined,
      label: typeof item.label === "string" ? item.label : undefined,
    }))
    .slice(0, 4); // max 4 images
}

interface CharacterPickerProps {
  onSelect: (character: Character) => void;
  onCreateNew?: () => void;
  selectedId?: string;
  compact?: boolean;
}

const s1 = "#0b0e18";
const s2 = "#10141f";
const border = "#1e2a35";
const text = "#dde4f0";
const muted = "#4e6080";
const purple = "#a855f7";
const green = "#22c55e";

/** Normalize raw storage paths to /api/media/ URLs */
function normalizeImageUrl(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("/api/") || url.startsWith("blob:") || url.startsWith("data:")) return url;
  const cleaned = url.replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "");
  return `/api/media/${cleaned}`;
}

export default function CharacterPicker({ onSelect, onCreateNew, selectedId, compact }: CharacterPickerProps) {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/character-voices")
      .then(r => r.json())
      .then(d => { setCharacters(d.voices || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const filtered = characters.filter(c => {
    const q = search.toLowerCase();
    return !q || c.name.toLowerCase().includes(q) || (c.characterId || "").toLowerCase().includes(q) || (c.country || "").toLowerCase().includes(q);
  });

  if (loading) return <div style={{ padding: 12, fontSize: 11, color: muted }}>Loading characters...</div>;

  return (
    <div style={{ background: s1, borderRadius: compact ? 10 : 14, border: `1px solid ${border}`, padding: compact ? 10 : 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <p style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: text }}>Select Character</p>
        {onCreateNew && (
          <button onClick={onCreateNew} style={{ padding: "4px 12px", borderRadius: 6, border: `1px solid ${green}40`, background: `${green}10`, color: green, fontSize: 10, cursor: "pointer", fontWeight: 600 }}>
            + Create New
          </button>
        )}
      </div>

      <input
        type="text"
        placeholder="Search by name, ID, or country..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ width: "100%", padding: "6px 10px", borderRadius: 8, border: `1px solid ${border}`, background: s2, color: text, fontSize: 11, marginBottom: 10, outline: "none" }}
      />

      {filtered.length === 0 && (
        <div style={{ padding: 20, textAlign: "center" }}>
          <p style={{ fontSize: 11, color: muted }}>No characters found</p>
          {onCreateNew && (
            <button onClick={onCreateNew} style={{ marginTop: 8, padding: "6px 14px", borderRadius: 8, border: "none", background: purple, color: "#fff", fontSize: 11, cursor: "pointer" }}>
              Create Character
            </button>
          )}
        </div>
      )}

      <div style={{ maxHeight: compact ? 240 : 360, overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
        {filtered.map(c => {
          const isSelected = selectedId === c.id;
          const isHovered = hoveredId === c.id;
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const parsed = c.characterId ? parseCharacterId(c.characterId) : null;
          const imgSrc = normalizeImageUrl(c.imageUrl);
          const refImages = parseRefImages(c.referenceImages);

          return (
            <div
              key={c.id}
              onClick={() => onSelect(c)}
              onMouseEnter={() => setHoveredId(c.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex", gap: 10, alignItems: "center",
                padding: "10px 12px", borderRadius: 10,
                border: `1px solid ${isSelected ? purple : isHovered ? `${purple}40` : border}`,
                background: isSelected ? `${purple}12` : isHovered ? `${purple}06` : "transparent",
                cursor: "pointer", transition: "all 0.15s", position: "relative",
              }}
            >
              {/* Avatar — shows actual character image */}
              <div style={{
                width: compact ? 44 : 52, height: compact ? 44 : 52,
                borderRadius: 10, overflow: "hidden",
                background: `linear-gradient(135deg, ${purple}30, ${purple}10)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, border: `1px solid ${isSelected ? purple : border}`,
              }}>
                {imgSrc ? (
                  <img src={imgSrc} alt={c.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ fontSize: compact ? 18 : 22 }}>
                    {c.gender === "female" || c.gender === "girl" ? "👩" : c.gender === "boy" || c.gender === "child" ? "🧒" : "👨"}
                  </span>
                )}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: text }}>{c.name}</span>
                  {c.role && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${purple}20`, color: purple }}>{c.role}</span>}
                  {c.voiceId && <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 4, background: `${green}15`, color: green }}>Voice</span>}
                </div>
                <div style={{ fontSize: 9, color: muted, display: "flex", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                  {c.characterId && <span style={{ fontFamily: "monospace", color: `${purple}90` }}>{c.characterId}</span>}
                  {c.age && <span>{c.age}</span>}
                  {c.gender && <span>{c.gender}</span>}
                </div>
                {c.visualDescription && (
                  <p style={{ fontSize: 9, color: muted, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 200 }}>
                    {c.visualDescription}
                  </p>
                )}

                {/* Multi-image thumbnail strip — shows when character has >1 reference image */}
                {refImages.length > 1 && (
                  <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
                    {refImages.map((img, idx) => (
                      <div
                        key={idx}
                        title={img.angle || img.label || `Image ${idx + 1}`}
                        style={{
                          width: 24, height: 24, borderRadius: 4, overflow: "hidden",
                          border: `1px solid ${border}`, flexShrink: 0,
                        }}
                      >
                        <img
                          src={normalizeImageUrl(img.url)}
                          alt={img.label || img.angle || `ref ${idx + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      </div>
                    ))}
                    <span style={{ fontSize: 8, color: muted, alignSelf: "center", marginLeft: 2 }}>
                      {refImages.length} angles
                    </span>
                  </div>
                )}
              </div>

              {/* Selected indicator */}
              {isSelected && (
                <span style={{ fontSize: 10, color: green, fontWeight: 700, flexShrink: 0 }}>✓ Selected</span>
              )}

              {/* Hover preview — full character card */}
              {isHovered && !compact && imgSrc && (
                <div style={{
                  position: "absolute", right: -180, top: 0, width: 160,
                  background: s1, border: `1px solid ${purple}30`, borderRadius: 12, padding: 8,
                  zIndex: 100, pointerEvents: "none",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.7)",
                }}>
                  <img src={imgSrc} alt={c.name} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 8, marginBottom: 6 }} />
                  <p style={{ fontSize: 11, fontWeight: 700, color: text, marginBottom: 2 }}>{c.name}</p>
                  {c.characterId && <p style={{ fontSize: 8, fontFamily: "monospace", color: purple, marginBottom: 4 }}>{c.characterId}</p>}
                  {c.visualDescription && <p style={{ fontSize: 8, color: muted, lineHeight: 1.4 }}>{c.visualDescription.slice(0, 100)}</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
