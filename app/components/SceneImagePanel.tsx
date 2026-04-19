"use client";

// SceneImagePanel — Reusable structured scene image creation panel
// Used in: Hybrid Planner, Movie Planner, Children Planner, Collab Editor
//
// Per Henry's documents:
// - Character ID chips / buttons for selection
// - When character ID is typed, auto-resolves
// - Upload image / pick from asset library
// - Scene text with character-aware input
// - Mood, location, time of day
// - Generate + Save as Draft buttons

import { useState, useRef, useEffect } from "react";

interface Character {
  id: string;
  characterId: string | null;
  name: string;
  imageUrl?: string | null;
  voiceName?: string | null;
}

interface SceneImagePanelProps {
  sceneId?: string;
  sceneTitle?: string;
  sceneText?: string;
  projectId?: string;
  characters?: Character[];
  selectedCharacterIds?: string[];
  onImageGenerated?: (imageUrl: string) => void;
  onCharacterSelect?: (characterIds: string[]) => void;
  onTextChange?: (text: string) => void;
  compact?: boolean;
}

const surface = "#0e1318";
const s2 = "#080b10";
const border = "#1e2a35";
const muted = "#5a7080";
const accent = "#22c55e";
const purple = "#a855f7";
const blue = "#00d4ff";

export default function SceneImagePanel({
  sceneId,
  sceneTitle,
  sceneText: initialText,
  projectId,
  characters: externalChars,
  selectedCharacterIds: initialSelected,
  onImageGenerated,
  onCharacterSelect,
  onTextChange,
  compact,
}: SceneImagePanelProps) {
  const [text, setText] = useState(initialText || "");
  const [mood, setMood] = useState("");
  const [location, setLocation] = useState("");
  const [timeOfDay, setTimeOfDay] = useState("");
  const [selectedChars, setSelectedChars] = useState<string[]>(initialSelected || []);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [error, setError] = useState("");
  const [characters, setCharacters] = useState<Character[]>(externalChars || []);
  const [uploadedImageUrl, setUploadedImageUrl] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Load characters from DB if not provided
  useEffect(() => {
    if (!externalChars || externalChars.length === 0) {
      fetch("/api/character-voices").then(r => r.json()).then(d => {
        if (d.voices?.length > 0) {
          setCharacters(d.voices.map((v: Record<string, unknown>) => ({
            id: v.id as string,
            characterId: v.characterId as string | null,
            name: v.name as string,
            imageUrl: v.imageUrl as string | null,
            voiceName: v.voiceName as string | null,
          })));
        }
      }).catch(() => {});
    }
  }, [externalChars]);

  // Sync external props
  useEffect(() => { if (initialText) setText(initialText); }, [initialText]);
  useEffect(() => { if (initialSelected) setSelectedChars(initialSelected); }, [initialSelected]);
  useEffect(() => { if (externalChars) setCharacters(externalChars); }, [externalChars]);

  function toggleChar(charId: string) {
    const next = selectedChars.includes(charId) ? selectedChars.filter(id => id !== charId) : [...selectedChars, charId];
    setSelectedChars(next);
    onCharacterSelect?.(next);
  }

  function insertCharToken(char: Character) {
    const token = char.characterId || char.name;
    const el = textRef.current;
    if (el) {
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? el.value.length;
      const before = el.value.substring(0, start);
      const after = el.value.substring(end);
      const newVal = `${before}${token} ${after}`;
      setText(newVal);
      onTextChange?.(newVal);
      setTimeout(() => { el.selectionStart = el.selectionEnd = start + token.length + 1; el.focus(); }, 0);
    }
    if (!selectedChars.includes(char.characterId || char.id)) {
      toggleChar(char.characterId || char.id);
    }
  }

  async function handleUpload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/upload/logo", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) {
        setUploadedImageUrl(data.url);
      }
    } catch { /* ignore */ }
  }

  async function generateSceneImage() {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/hybrid/scene-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sceneId: sceneId || `scene_${Date.now()}`,
          projectId,
          sceneText: text || sceneTitle || "Scene",
          characterIds: selectedChars,
          location: location || undefined,
          mood: mood || undefined,
          timeOfDay: timeOfDay || undefined,
        }),
      });
      const data = await res.json();
      if (data.error === "unresolved_characters") {
        setError(data.message);
      } else if (data.imageUrl || data.imagePath) {
        const url = data.imageUrl || `/api/media/${(data.imagePath || "").replace(/\\/g, "/").replace(/^.*?storage[\\/]?/, "")}`;
        setGeneratedUrl(url);
        onImageGenerated?.(url);
      } else {
        setError("Image generation failed — check API keys");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    }
    setGenerating(false);
  }

  const cardBg = { background: s2, borderRadius: 10, padding: compact ? 10 : 14, border: `1px solid ${border}` };

  return (
    <div style={{ background: surface, borderRadius: 14, padding: compact ? 14 : 20, border: `1px solid ${border}` }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div>
          <p style={{ fontSize: compact ? 12 : 14, fontWeight: 700, color: "#fff" }}>
            {sceneTitle ? `Scene: ${sceneTitle}` : "Scene Image Generator"}
          </p>
          {sceneId && <p style={{ fontSize: 9, color: purple, fontFamily: "monospace" }}>{sceneId}</p>}
        </div>
        {generatedUrl && <span style={{ fontSize: 9, padding: "3px 10px", borderRadius: 20, background: `${accent}15`, color: accent, fontWeight: 600 }}>Image Ready</span>}
      </div>

      {/* Image preview / upload area */}
      <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
        <div style={{ width: compact ? 120 : 180, height: compact ? 80 : 110, borderRadius: 10, overflow: "hidden", background: s2, border: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}
          onClick={() => fileRef.current?.click()}>
          {generatedUrl || uploadedImageUrl ? (
            <img src={generatedUrl || uploadedImageUrl} alt="Scene" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: 20, opacity: 0.3 }}>+</p>
              <p style={{ fontSize: 8, color: muted }}>Upload / Generate</p>
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => { if (e.target.files?.[0]) handleUpload(e.target.files[0]); }} />
        </div>

        {/* Scene text */}
        <div style={{ flex: 1 }}>
          <textarea ref={textRef} value={text} onChange={e => { setText(e.target.value); onTextChange?.(e.target.value); }}
            rows={compact ? 3 : 4}
            placeholder="Describe the scene... Type character ID (e.g. US_TUNDE38BLACK) to auto-include character."
            style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 8, padding: "8px 10px", color: "#fff", fontSize: 11, outline: "none", resize: "vertical", fontFamily: "inherit" }} />
        </div>
      </div>

      {/* Character chips — clickable selection */}
      {characters.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 9, color: muted, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Characters (click to select, double-click to insert ID)</p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
            {characters.map(c => {
              const isSelected = selectedChars.includes(c.characterId || c.id);
              return (
                <button key={c.id}
                  onClick={() => toggleChar(c.characterId || c.id)}
                  onDoubleClick={() => insertCharToken(c)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "5px 12px", borderRadius: 20,
                    border: `1px solid ${isSelected ? purple : border}`,
                    background: isSelected ? `${purple}15` : "transparent",
                    color: isSelected ? purple : muted,
                    fontSize: 10, fontWeight: isSelected ? 600 : 400,
                    cursor: "pointer",
                  }}>
                  {c.imageUrl && <img src={c.imageUrl} alt="" style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover" }} />}
                  {c.name}
                  {c.characterId && <span style={{ fontSize: 8, opacity: 0.7 }}>({c.characterId})</span>}
                </button>
              );
            })}
            <a href="/dashboard/character-voices" target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none" }}>
              <button style={{ padding: "5px 12px", borderRadius: 20, border: `1px dashed ${border}`, background: "transparent", color: accent, fontSize: 10, cursor: "pointer" }}>
                + Create
              </button>
            </a>
          </div>
        </div>
      )}

      {/* Settings row */}
      {!compact && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 8, color: muted, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Mood</p>
            <select value={mood} onChange={e => setMood(e.target.value)}
              style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
              <option value="">Auto</option>
              {["calm", "tense", "joyful", "dark", "heroic", "emotional", "mysterious", "action"].map(m => <option key={m} value={m} style={{ background: surface }}>{m}</option>)}
            </select>
          </div>
          <div>
            <p style={{ fontSize: 8, color: muted, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Location</p>
            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. forest, castle"
              style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 10, outline: "none" }} />
          </div>
          <div>
            <p style={{ fontSize: 8, color: muted, marginBottom: 3, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Time</p>
            <select value={timeOfDay} onChange={e => setTimeOfDay(e.target.value)}
              style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
              <option value="">Auto</option>
              {["dawn", "morning", "afternoon", "golden hour", "dusk", "night", "midnight"].map(t => <option key={t} value={t} style={{ background: surface }}>{t}</option>)}
            </select>
          </div>
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={generateSceneImage} disabled={generating || !text.trim()}
          style={{
            flex: 1, padding: compact ? "8px 14px" : "10px 20px", borderRadius: 10, border: "none",
            background: (generating || !text.trim()) ? "#2a2a40" : `linear-gradient(135deg, ${blue}, #0084ff)`,
            color: "#fff", fontSize: compact ? 11 : 12, fontWeight: 700,
            cursor: (generating || !text.trim()) ? "not-allowed" : "pointer",
          }}>
          {generating ? "Generating..." : "Make Scene Image"}
        </button>
        {uploadedImageUrl && (
          <button onClick={() => { onImageGenerated?.(uploadedImageUrl); }}
            style={{ padding: compact ? "8px 14px" : "10px 20px", borderRadius: 10, border: `1px solid ${accent}30`, background: `${accent}06`, color: accent, fontSize: compact ? 11 : 12, fontWeight: 600, cursor: "pointer" }}>
            Use Uploaded
          </button>
        )}
      </div>

      {/* Error */}
      {error && <p style={{ fontSize: 10, color: "#ef4444", marginTop: 8 }}>{error}</p>}
    </div>
  );
}
