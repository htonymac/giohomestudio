"use client";

import { useState } from "react";

// ═══════════════════════════════════════════════════════════════════════════
// GHS Scene-Directed Audio Storytelling Panel
//
// From Support Canvas:
// - Scene interpretation: detect emotional tone, speech style, ambience need
// - Audio layers: narration, dialogue, music, ambience, foley/SFX, silence/pause
// - Whisper/emotional voice handling: voice-direction tags
// - Multi-speaker dialogue: narrator + 3 character voices minimum
// - Timeline mixing rules: voice priority, music ducks, SFX doesn't bury dialogue
// - Audio-only mode: MP3/WAV export
// ═══════════════════════════════════════════════════════════════════════════

interface AudioLayer {
  id: string;
  type: "narration" | "dialogue" | "music" | "ambience" | "sfx" | "silence";
  label: string;
  volume: number;
  mute: boolean;
  solo: boolean;
}

interface Speaker {
  id: string;
  name: string;
  voiceTag: string; // whisper, breath-heavy, trembling, intimate, commanding, normal
  voiceId?: string;
}

interface SceneAudioPlan {
  sceneId: number;
  emotionalTone: string;
  speechStyle: string;
  layers: AudioLayer[];
  speakers: Speaker[];
  ambienceDescription: string;
  sfxNeeds: string[];
  musicMood: string;
  silencePauses: Array<{ start: number; duration: number; reason: string }>;
}

const border = "#1e2a35";
const muted = "#5a7080";
const purple = "#a855f7";
const cyan = "#00d4ff";
const green = "#22c55e";
const gold = "#f59e0b";
const red = "#ef4444";

const VOICE_DIRECTION_TAGS = [
  { id: "normal", label: "Normal", desc: "Standard speaking voice" },
  { id: "whisper", label: "Whisper", desc: "Soft, intimate, low volume" },
  { id: "breath-heavy", label: "Breath-Heavy", desc: "Exhausted, running, out of breath" },
  { id: "trembling", label: "Trembling", desc: "Fearful, nervous, shaking" },
  { id: "intimate", label: "Intimate", desc: "Close, personal, romantic" },
  { id: "grieving", label: "Grieving", desc: "Sad, crying, mourning" },
  { id: "fearful", label: "Fearful", desc: "Scared, panicked, small voice" },
  { id: "commanding", label: "Commanding", desc: "Strong, authority, loud" },
  { id: "joyful", label: "Joyful", desc: "Happy, laughing, excited" },
  { id: "angry", label: "Angry", desc: "Furious, shouting, intense" },
];

const EMOTIONAL_TONES = ["calm", "tense", "romantic", "action", "suspense", "joyful", "grieving", "mysterious", "comedic", "horror", "epic", "intimate"];

const DEFAULT_LAYERS: AudioLayer[] = [
  { id: "narration", type: "narration", label: "Narration", volume: 1.0, mute: false, solo: false },
  { id: "dialogue", type: "dialogue", label: "Dialogue", volume: 0.9, mute: false, solo: false },
  { id: "music", type: "music", label: "Music", volume: 0.25, mute: false, solo: false },
  { id: "ambience", type: "ambience", label: "Ambience", volume: 0.15, mute: false, solo: false },
  { id: "sfx", type: "sfx", label: "SFX / Foley", volume: 0.6, mute: false, solo: false },
  { id: "silence", type: "silence", label: "Silence / Pause", volume: 0, mute: false, solo: false },
];

interface AudioStorytellingPanelProps {
  sceneId: number;
  sceneTitle: string;
  sceneDescription: string;
  onPlanChange?: (plan: SceneAudioPlan) => void;
  audioOnly?: boolean; // MP3/WAV export mode
}

export default function AudioStorytellingPanel({ sceneId, sceneTitle, sceneDescription, onPlanChange, audioOnly }: AudioStorytellingPanelProps) {
  const [emotionalTone, setEmotionalTone] = useState("calm");
  const [layers, setLayers] = useState<AudioLayer[]>(DEFAULT_LAYERS);
  const [speakers, setSpeakers] = useState<Speaker[]>([
    { id: "narrator", name: "Narrator", voiceTag: "normal" },
  ]);
  const [newSpeakerName, setNewSpeakerName] = useState("");
  const [ambienceDesc, setAmbienceDesc] = useState("");
  const [musicMood, setMusicMood] = useState("cinematic");
  const [expanded, setExpanded] = useState(true);

  const updateLayer = (id: string, changes: Partial<AudioLayer>) => {
    setLayers(prev => prev.map(l => l.id === id ? { ...l, ...changes } : l));
  };

  const addSpeaker = () => {
    if (!newSpeakerName.trim()) return;
    setSpeakers(prev => [...prev, { id: `speaker_${Date.now()}`, name: newSpeakerName.trim(), voiceTag: "normal" }]);
    setNewSpeakerName("");
  };

  const removeSpeaker = (id: string) => {
    if (id === "narrator") return; // narrator can't be removed
    setSpeakers(prev => prev.filter(s => s.id !== id));
  };

  const updateSpeakerTag = (id: string, tag: string) => {
    setSpeakers(prev => prev.map(s => s.id === id ? { ...s, voiceTag: tag } : s));
  };

  const layerColors: Record<string, string> = { narration: cyan, dialogue: purple, music: green, ambience: "#3b82f6", sfx: gold, silence: "#6b7280" };

  return (
    <div style={{ background: "#0b0e18", border: `1px solid ${border}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 16 }}>🎧</span>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Audio Storytelling — Scene {sceneId}</p>
            <p style={{ fontSize: 10, color: muted }}>{sceneTitle}</p>
          </div>
          {audioOnly && <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 6, background: "rgba(0,212,255,0.1)", color: cyan, border: `1px solid ${cyan}30` }}>Audio-Only Mode</span>}
        </div>
        <button onClick={() => setExpanded(!expanded)} style={{ fontSize: 10, color: muted, background: "none", border: "none", cursor: "pointer" }}>
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>

      {expanded && (
        <div style={{ padding: 16 }}>
          {/* Emotional Tone */}
          <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Scene Emotional Tone</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 16 }}>
            {EMOTIONAL_TONES.map(t => (
              <button key={t} onClick={() => setEmotionalTone(t)}
                style={{ padding: "4px 12px", borderRadius: 100, border: `1px solid ${emotionalTone === t ? purple : border}`, background: emotionalTone === t ? `${purple}10` : "transparent", color: emotionalTone === t ? purple : muted, fontSize: 10, cursor: "pointer", textTransform: "capitalize" as const }}>
                {t}
              </button>
            ))}
          </div>

          {/* Audio Layers — mixer style */}
          <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Audio Layers</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 16 }}>
            {layers.map(l => (
              <div key={l.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${l.mute ? "rgba(239,68,68,0.2)" : border}` }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: layerColors[l.type] || muted, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: l.mute ? red : "#fff", fontWeight: 500, width: 80 }}>{l.label}</span>
                <input type="range" min="0" max="100" value={l.volume * 100} disabled={l.mute}
                  onChange={e => updateLayer(l.id, { volume: parseInt(e.target.value) / 100 })}
                  style={{ flex: 1, accentColor: layerColors[l.type] || purple }} />
                <span style={{ fontSize: 9, color: muted, fontFamily: "monospace", width: 30 }}>{Math.round(l.volume * 100)}%</span>
                <button onClick={() => updateLayer(l.id, { mute: !l.mute })}
                  style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${l.mute ? "rgba(239,68,68,0.3)" : border}`, background: l.mute ? "rgba(239,68,68,0.1)" : "transparent", color: l.mute ? red : muted, cursor: "pointer" }}>
                  {l.mute ? "M" : "M"}
                </button>
                <button onClick={() => updateLayer(l.id, { solo: !l.solo })}
                  style={{ fontSize: 9, padding: "2px 6px", borderRadius: 4, border: `1px solid ${l.solo ? "rgba(245,158,11,0.3)" : border}`, background: l.solo ? "rgba(245,158,11,0.1)" : "transparent", color: l.solo ? gold : muted, cursor: "pointer" }}>
                  S
                </button>
              </div>
            ))}
          </div>

          {/* Mixing Rules */}
          <div style={{ padding: "10px 12px", background: "rgba(0,212,255,0.03)", border: "1px solid rgba(0,212,255,0.15)", borderRadius: 10, marginBottom: 16, fontSize: 10, color: muted, lineHeight: 1.6 }}>
            <p style={{ fontWeight: 600, color: cyan, marginBottom: 4 }}>Mixing Rules (auto-applied)</p>
            Voice has priority — music ducks under speech. SFX never buries dialogue. Silence is preserved where planned. Ambience is continuous but lowered during speech.
          </div>

          {/* Multi-Speaker Dialogue */}
          <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 8 }}>Speakers ({speakers.length})</p>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 6, marginBottom: 10 }}>
            {speakers.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 10px", background: "#080b10", borderRadius: 8, border: `1px solid ${border}` }}>
                <span style={{ fontSize: 12 }}>👤</span>
                <span style={{ fontSize: 11, color: "#fff", fontWeight: 500, width: 80 }}>{s.name}</span>
                <select value={s.voiceTag} onChange={e => updateSpeakerTag(s.id, e.target.value)}
                  style={{ flex: 1, background: "#060810", border: `1px solid ${border}`, borderRadius: 6, padding: "4px 8px", color: "#fff", fontSize: 10, outline: "none" }}>
                  {VOICE_DIRECTION_TAGS.map(t => (
                    <option key={t.id} value={t.id}>{t.label} — {t.desc}</option>
                  ))}
                </select>
                {s.id !== "narrator" && (
                  <button onClick={() => removeSpeaker(s.id)} style={{ fontSize: 10, color: red, background: "none", border: "none", cursor: "pointer" }}>✕</button>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newSpeakerName} onChange={e => setNewSpeakerName(e.target.value)}
              placeholder="Add character name..."
              onKeyDown={e => { if (e.key === "Enter") addSpeaker(); }}
              style={{ flex: 1, background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "6px 10px", color: "#fff", fontSize: 11, outline: "none" }} />
            <button onClick={addSpeaker} disabled={!newSpeakerName.trim()}
              style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${purple}`, background: `${purple}10`, color: purple, fontSize: 11, cursor: newSpeakerName.trim() ? "pointer" : "not-allowed" }}>
              + Add
            </button>
          </div>

          {/* Ambience */}
          <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6, marginTop: 14 }}>Ambience Description</p>
          <input value={ambienceDesc} onChange={e => setAmbienceDesc(e.target.value)}
            placeholder="e.g. 'car interior, night, engine hum, rain on windshield' or 'busy market, voices, music in distance'"
            style={{ width: "100%", background: "#080b10", border: `1px solid ${border}`, borderRadius: 8, padding: "8px 12px", color: "#fff", fontSize: 11, outline: "none", marginBottom: 10 }} />

          {/* Music Mood */}
          <p style={{ fontSize: 9, fontWeight: 500, letterSpacing: 1.5, textTransform: "uppercase" as const, color: muted, marginBottom: 6 }}>Music Mood</p>
          <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 4, marginBottom: 16 }}>
            {["cinematic", "suspense", "emotional", "action", "calm", "heroic", "dark", "joyful", "romantic", "children", "african", "none"].map(m => (
              <button key={m} onClick={() => setMusicMood(m)}
                style={{ padding: "4px 10px", borderRadius: 100, border: `1px solid ${musicMood === m ? green : border}`, background: musicMood === m ? `${green}10` : "transparent", color: musicMood === m ? green : muted, fontSize: 10, cursor: "pointer", textTransform: "capitalize" as const }}>
                {m}
              </button>
            ))}
          </div>

          {/* Audio-Only Export */}
          {audioOnly && (
            <div style={{ padding: "12px 14px", background: "rgba(0,212,255,0.05)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: 10 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: cyan, marginBottom: 4 }}>Audio-Only Export</p>
              <p style={{ fontSize: 10, color: muted }}>No video will be generated. Output will be MP3 or WAV. Same review workflow applies — narration, dialogue, music, ambience, SFX all assembled by FFmpeg.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${cyan}`, background: `${cyan}10`, color: cyan, fontSize: 11, cursor: "pointer" }}>Export MP3</button>
                <button style={{ padding: "6px 14px", borderRadius: 8, border: `1px solid ${border}`, background: "transparent", color: muted, fontSize: 11, cursor: "pointer" }}>Export WAV</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
