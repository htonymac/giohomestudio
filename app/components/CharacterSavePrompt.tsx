"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Character Save Prompt
//
// From Support Canvas:
// "AI asks 'Save this character?' after generation"
// "Save main actor / speaking actors / all / none"
//
// Shows after video/image generation when characters are detected.
// Saves to /api/character-voices with full profile.
// ═══════════════════════════════════════════════════════════════════════════

interface DetectedCharacter {
  name: string;
  role: string;
  description: string;
  imageUrl?: string;
  voiceId?: string;
}

interface CharacterSavePromptProps {
  characters: DetectedCharacter[];
  projectId: string;
  onSave: (savedIds: string[]) => void;
  onDismiss: () => void;
}

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const green = "#22c55e";
const gold = "#f59e0b";

export default function CharacterSavePrompt({ characters, projectId, onSave, onDismiss }: CharacterSavePromptProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleChar = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(characters.map(c => c.name)));
  const selectNone = () => setSelected(new Set());
  const selectMainOnly = () => {
    const main = characters.find(c => c.role === "protagonist" || c.role === "hero" || c.role === "main");
    setSelected(main ? new Set([main.name]) : new Set());
  };

  const handleSave = async () => {
    if (selected.size === 0) { onDismiss(); return; }
    setSaving(true);
    const savedIds: string[] = [];

    for (const char of characters.filter(c => selected.has(c.name))) {
      try {
        const res = await fetch("/api/character-voices", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: char.name,
            role: char.role,
            visualDescription: char.description,
            imageUrl: char.imageUrl,
            voiceId: char.voiceId,
            projectAssociation: projectId,
            keepSameToggle: true,
          }),
        });
        const data = await res.json();
        if (data.voice?.id) savedIds.push(data.voice.id);
      } catch { /* save failed for this character */ }
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => onSave(savedIds), 1000);
  };

  if (characters.length === 0) return null;

  return (
    <div style={{ background: "rgba(168,85,247,0.04)", border: "1px solid rgba(168,85,247,0.2)", borderRadius: 14, padding: 20, marginTop: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <span style={{ fontSize: 20 }}>👤</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Save Characters?</p>
          <p style={{ fontSize: 10, color: muted }}>
            {characters.length} character{characters.length > 1 ? "s" : ""} detected. Save them to reuse in future projects with the same appearance and voice.
          </p>
        </div>
      </div>

      {/* Quick select buttons */}
      <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
        <button onClick={selectAll} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${green}30`, background: `${green}10`, color: green, fontSize: 10, cursor: "pointer" }}>Save All</button>
        <button onClick={selectMainOnly} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${purple}30`, background: `${purple}10`, color: purple, fontSize: 10, cursor: "pointer" }}>Main Actor Only</button>
        <button onClick={selectNone} style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 10, cursor: "pointer" }}>None</button>
      </div>

      {/* Character list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {characters.map(c => (
          <label key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", background: selected.has(c.name) ? `${purple}08` : "#080b10", border: `1px solid ${selected.has(c.name) ? purple : border}`, borderRadius: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={selected.has(c.name)} onChange={() => toggleChar(c.name)} style={{ accentColor: purple, width: 16, height: 16 }} />
            {c.imageUrl && <img src={c.imageUrl} alt={c.name} style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} />}
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: selected.has(c.name) ? purple : "#fff" }}>{c.name}</p>
              <p style={{ fontSize: 9, color: muted }}>{c.role} — {c.description.slice(0, 50)}</p>
            </div>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving || saved}
          style={{ flex: 1, padding: 12, borderRadius: 10, border: "none", background: saved ? green : selected.size > 0 ? purple : "#2a2a40", color: "#fff", fontSize: 13, fontWeight: 700, cursor: saving || saved ? "not-allowed" : "pointer" }}>
          {saved ? `Saved ${selected.size} character(s)` : saving ? "Saving..." : selected.size > 0 ? `Save ${selected.size} Character${selected.size > 1 ? "s" : ""}` : "Skip"}
        </button>
        <button onClick={onDismiss} style={{ padding: "12px 20px", borderRadius: 10, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 13, cursor: "pointer" }}>
          Not Now
        </button>
      </div>
    </div>
  );
}
