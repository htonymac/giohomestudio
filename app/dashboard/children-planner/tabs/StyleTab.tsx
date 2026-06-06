"use client";

// Voice / Visual / Music style tab — AI model picker, narration voice + provider,
// visual style grid, music + music genre grids, Music Library, Sound Effects
// Studio (Freesound + AI SFX), Read-Along settings (conditional), generate-plan
// CTA. Extracted from app/dashboard/children-planner/page.tsx (Wave 2.2, 2026-06-05).

import * as React from "react";
import * as Icon from "../../../components/icons";
import NarrationControls, { type NarrationSettings } from "../../../components/NarrationControls";

// ── Structural types (kept inline; identical shape to parent's locals) ──
type NarrationProvider = "piper" | "fal-narrator" | "elevenlabs" | "karaoke" | "edge-tts" | "gtts" | "gemini" | "fal-f5" | "fal-xtts" | "fal-bark";
export interface FreesoundResult { id: number; name: string; duration: number; license: string; username: string; previewUrl: string; tags: string[] }
export interface MusicAssetLite { id: string }  // only .length is read in this tab
export interface StyleSceneLite { title?: string; visualDescription?: string }
export interface StyleSavedChar { name: string }

type AidMode = "video" | "image";
type SfxStudioSubTab = "freesound" | "ai-sfx";
type HighlightMode = "word" | "sentence" | "line" | "karaoke";
type ReadSpeed = "slow" | "normal" | "fast";

export interface StyleTabProps {
  // Style tokens
  cardStyle: React.CSSProperties;
  labelStyle: React.CSSProperties;
  s2: string;
  border: string;
  muted: string;
  childAccent: string;
  childSafe: string;
  C2: string;
  C4: string;
  // AI Model Picker
  effectiveVideoModelId: string;
  effectiveImageModelId: string;
  setAidMode: (m: AidMode) => void;
  setShowAidPicker: React.Dispatch<React.SetStateAction<boolean>>;
  genSeed: number | null;
  setGenSeed: React.Dispatch<React.SetStateAction<number | null>>;
  // Narration
  NARRATION_STYLES: ReadonlyArray<{ id: string; label: string; desc: string }>;
  narrationStyle: string;
  setNarrationStyle: (id: string) => void;
  effectiveNarrationProvider: NarrationProvider;
  setNarrationProvider: React.Dispatch<React.SetStateAction<NarrationProvider>>;
  patchProjectSettings: (patch: Record<string, unknown>) => Promise<unknown>;
  narrationText: string;
  setNarrationText: (s: string) => void;
  setNarrationSettings: React.Dispatch<React.SetStateAction<Partial<NarrationSettings>>>;
  // Visual style
  VISUAL_STYLES: ReadonlyArray<{ id: string; label: string; colors: string; desc: string }>;
  effectiveProjectStyle: string;
  setVisualStyle: (id: string) => void;
  wordOverlayEnabled: boolean;
  setWordOverlayEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  // Music
  MUSIC_CHOICES: ReadonlyArray<{ id: string; label: string }>;
  MUSIC_GENRES: ReadonlyArray<{ id: string; label: string }>;
  musicChoice: string;
  setMusicChoice: (id: string) => void;
  musicGenre: string;
  setMusicGenre: (id: string) => void;
  // SFX top toggle
  autoSfx: boolean;
  setAutoSfx: React.Dispatch<React.SetStateAction<boolean>>;
  // Music Library
  loadMusicLibrary: () => void | Promise<void>;
  loadingMusic: boolean;
  musicLibrary: MusicAssetLite[];
  aiPickMusic: () => void | Promise<void>;
  aiPickingMusic: boolean;
  selectedMusicName: string;
  selectedMusicUrl: string | null;
  aiMusicPickLog: string;
  // SFX Studio
  soundTab: SfxStudioSubTab;
  setSoundTab: (t: SfxStudioSubTab) => void;
  // Freesound
  fsNoKey: boolean;
  fsQuery: string;
  setFsQuery: React.Dispatch<React.SetStateAction<string>>;
  searchFreesound: () => void | Promise<void>;
  fsSearching: boolean;
  fsResults: FreesoundResult[];
  fsSaved: Set<number>;
  fsSaving: number | null;
  sfxPreviewId: number | string | null;
  setSfxPreviewId: React.Dispatch<React.SetStateAction<number | string | null>>;
  saveFreesound: (sound: FreesoundResult) => void | Promise<void>;
  // AI SFX
  sfxDesc: string;
  setSfxDesc: React.Dispatch<React.SetStateAction<string>>;
  generateElevenLabsSfx: () => void | Promise<void>;
  sfxGenerating: boolean;
  sfxGeneratedUrl: string | null;
  // Story context for auto-suggest
  expandedContent: string;
  textContent: string;
  readAlongText: string;
  childScenes: StyleSceneLite[];
  savedChars: StyleSavedChar[];
  ageGroup: string;
  tone: string;
  // Read-Along
  learningMode: string;
  setReadAlongText: (s: string) => void;
  highlightMode: HighlightMode;
  setHighlightMode: (m: HighlightMode) => void;
  readSpeed: ReadSpeed;
  setReadSpeed: (s: ReadSpeed) => void;
  fontSize: number;
  setFontSize: (n: number) => void;
  highlightColor: string;
  setHighlightColor: (c: string) => void;
  // Plan CTA
  setLastAction: (s: string) => void;
  setPlanning: React.Dispatch<React.SetStateAction<boolean>>;
  planning: boolean;
  setActiveTab: (t: "review1") => void;
}

export default function StyleTab(props: StyleTabProps) {
  const {
    cardStyle, labelStyle, s2, border, muted, childAccent, childSafe, C2, C4,
    effectiveVideoModelId, effectiveImageModelId, setAidMode, setShowAidPicker, genSeed, setGenSeed,
    NARRATION_STYLES, narrationStyle, setNarrationStyle, effectiveNarrationProvider, setNarrationProvider, patchProjectSettings,
    narrationText, setNarrationText, setNarrationSettings,
    VISUAL_STYLES, effectiveProjectStyle, setVisualStyle, wordOverlayEnabled, setWordOverlayEnabled,
    MUSIC_CHOICES, MUSIC_GENRES, musicChoice, setMusicChoice, musicGenre, setMusicGenre,
    autoSfx, setAutoSfx,
    loadMusicLibrary, loadingMusic, musicLibrary, aiPickMusic, aiPickingMusic, selectedMusicName, selectedMusicUrl, aiMusicPickLog,
    soundTab, setSoundTab,
    fsNoKey, fsQuery, setFsQuery, searchFreesound, fsSearching, fsResults, fsSaved, fsSaving, sfxPreviewId, setSfxPreviewId, saveFreesound,
    sfxDesc, setSfxDesc, generateElevenLabsSfx, sfxGenerating, sfxGeneratedUrl,
    expandedContent, textContent, readAlongText, childScenes, savedChars, ageGroup, tone,
    learningMode, setReadAlongText, highlightMode, setHighlightMode, readSpeed, setReadSpeed, fontSize, setFontSize, highlightColor, setHighlightColor,
    setLastAction, setPlanning, planning, setActiveTab,
  } = props;

  return (
    <div style={{ ...cardStyle, padding: 28 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#fff", marginBottom: 16 }}>Voice, Visual & Music</h2>

      {/* AI Model Picker */}
      <div style={{ marginBottom: 20 }}>
        <span style={labelStyle}>AI Generation Models</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={() => { setAidMode("video"); setShowAidPicker(true); }}
            style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.Film style={{ width: 12, height: 12 }} />
            Video Model: <span style={{ color: "#fff" }}>{effectiveVideoModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
          </button>
          <button onClick={() => { setAidMode("image"); setShowAidPicker(true); }}
            style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${childSafe}40`, background: `${childSafe}10`, color: childSafe, fontSize: 11, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
            <Icon.Image style={{ width: 12, height: 12 }} />
            Image Model: <span style={{ color: "#fff" }}>{effectiveImageModelId.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <input type="number" placeholder="Seed (random)" value={genSeed ?? ""}
              onChange={e => {
                const v = e.target.value === "" ? null : parseInt(e.target.value, 10);
                setGenSeed(isNaN(v as number) ? null : v);
              }}
              style={{ width: 110, padding: "5px 8px", borderRadius: 7, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 10, outline: "none" }} />
            <button title="Randomize seed" onClick={() => setGenSeed(Math.floor(Math.random() * 1e9))}
              style={{ padding: "5px 7px", borderRadius: 7, border: `1px solid ${border}`, background: s2, color: "#fff", fontSize: 12, cursor: "pointer", lineHeight: 1 }}>🎲</button>
          </div>
        </div>
      </div>

      {/* Narration style */}
      <p style={labelStyle}>Narration Voice</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6, marginBottom: 20 }}>
        {NARRATION_STYLES.map(n => (
          <button key={n.id} onClick={() => { setNarrationStyle(n.id); setLastAction(`Narration: ${n.label}`); }}
            style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${narrationStyle === n.id ? childAccent : border}`, background: narrationStyle === n.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "left" }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: narrationStyle === n.id ? childAccent : "#fff" }}>{n.label}</p>
            <p style={{ fontSize: 9, color: muted }}>{n.desc}</p>
          </button>
        ))}
      </div>

      {/* Narration provider selector */}
      <p style={labelStyle}>Narration Provider</p>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 14 }}>
        {([
          { id: "piper",       label: "Piper (free)",   color: childSafe },
          { id: "fal-narrator", label: "FAL Narrator",  color: C4 },
          { id: "elevenlabs",  label: "ElevenLabs",     color: C2 },
          { id: "karaoke",     label: "Karaoke",        color: childAccent },
        ] as const).map(p => (
          <button key={p.id} onClick={() => { setNarrationProvider(p.id); patchProjectSettings({ narrationProvider: p.id }).catch(() => {}); }}
            style={{ padding: "7px 14px", borderRadius: 10, border: `1px solid ${effectiveNarrationProvider === p.id ? p.color : border}`,
              background: effectiveNarrationProvider === p.id ? `${p.color}12` : "transparent",
              color: effectiveNarrationProvider === p.id ? p.color : muted, fontSize: 10, fontWeight: 700, cursor: "pointer" }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Narration controls */}
      <div style={{ marginBottom: 20 }}>
        <NarrationControls
          narrationText={narrationText}
          onNarrationChange={setNarrationText}
          onSettingsChange={setNarrationSettings}
          initialSettings={{ mode: "children" }}
          compact
        />
      </div>

      {/* Visual style */}
      <p style={labelStyle}>Visual Style</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 8, marginBottom: 20 }}>
        {VISUAL_STYLES.map(v => {
          const isActive = effectiveProjectStyle === v.id;
          const [c1, c2] = v.colors.split(",").map(s => s.trim());
          return (
            <button key={v.id} onClick={() => { setVisualStyle(v.id); patchProjectSettings({ visualStyle: v.id }).catch(() => {}); setLastAction(`Visual: ${v.label}`); }}
              style={{ padding: "0", borderRadius: 12, border: `2px solid ${isActive ? childAccent : border}`, background: "transparent", cursor: "pointer", overflow: "hidden", transition: "border-color 0.15s" }}>
              <div style={{ height: 36, background: `linear-gradient(135deg, ${c1}, ${c2})` }} />
              <div style={{ padding: "8px 6px", textAlign: "center" }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: isActive ? childAccent : "#fff", marginBottom: 2 }}>{v.label}</p>
                <p style={{ fontSize: 8, color: muted, lineHeight: 1.3 }}>{v.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* word-on-image toggle for letter/word teaching scenes */}
      <label style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: wordOverlayEnabled ? "rgba(167,139,250,0.12)" : "rgba(255,255,255,0.03)", border: `1px solid ${wordOverlayEnabled ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", marginBottom: 20 }}>
        <input type="checkbox" checked={wordOverlayEnabled} onChange={e => setWordOverlayEnabled(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#a78bfa" }} />
        <div style={{ fontSize: 11, color: wordOverlayEnabled ? "#a78bfa" : "#aaa" }}>
          <strong>Words on image</strong>
          <div style={{ fontSize: 9, color: "#7b7b80", marginTop: 2 }}>Burn the teaching word (BAG, APPLE, etc.) onto the generated picture</div>
        </div>
      </label>

      {/* Music */}
      <p style={labelStyle}>Background Music</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 6, marginBottom: 20 }}>
        {MUSIC_CHOICES.map(m => (
          <button key={m.id} onClick={() => { setMusicChoice(m.id); setLastAction(`Music: ${m.label}`); }}
            style={{ padding: "10px 8px", borderRadius: 10, border: `1px solid ${musicChoice === m.id ? childAccent : border}`, background: musicChoice === m.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: musicChoice === m.id ? childAccent : "#fff" }}>{m.label}</p>
          </button>
        ))}
      </div>

      {/* genre picker */}
      <p style={labelStyle}>Music Genre</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6, marginBottom: 20 }}>
        {MUSIC_GENRES.map(g => (
          <button key={g.id} onClick={() => { setMusicGenre(g.id); setLastAction(`Genre: ${g.label}`); }}
            style={{ padding: "10px 8px", borderRadius: 10, border: `1px solid ${musicGenre === g.id ? childAccent : border}`, background: musicGenre === g.id ? `${childAccent}08` : "transparent", cursor: "pointer", textAlign: "center" }}>
            <p style={{ fontSize: 9, fontWeight: 600, color: musicGenre === g.id ? childAccent : "#fff" }}>{g.label}</p>
          </button>
        ))}
      </div>

      <p style={{ fontSize: 9, color: muted, marginBottom: 16 }}>Music is always secondary to narration. Voice stays at 100%, music at 18-35%. Music ducks when narration is active.</p>

      {/* Auto SFX toggle */}
      <div data-testid="auto-sfx-toggle" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderRadius: 12, background: s2, border: `1px solid ${autoSfx ? childAccent + "40" : border}`, marginBottom: 20 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 2 }}>Auto SFX</p>
          <p style={{ fontSize: 9, color: muted }}>AI assigns sound effects to each scene automatically. Only CC0 / CC BY / Public Domain tracks used.</p>
        </div>
        <button data-testid="auto-sfx-btn" onClick={() => { setAutoSfx(v => !v); setLastAction(`Auto SFX: ${!autoSfx ? "ON" : "OFF"}`); }}
          style={{ padding: "7px 18px", borderRadius: 20, border: `1px solid ${autoSfx ? childAccent : border}`, background: autoSfx ? `${childAccent}18` : "transparent", color: autoSfx ? childAccent : muted, fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const, minWidth: 64 }}>
          {autoSfx ? "ON" : "OFF"}
        </button>
      </div>

      {/* Music Library Picker */}
      <p style={labelStyle}>Music Library</p>
      <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 10 }}>
          <button onClick={loadMusicLibrary} disabled={loadingMusic}
            style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${childAccent}`, background: `${childAccent}10`, color: loadingMusic ? muted : childAccent, fontSize: 11, fontWeight: 700, cursor: loadingMusic ? "not-allowed" : "pointer" }}>
            {loadingMusic ? "Loading..." : "Browse Music Library"}
          </button>
          {musicLibrary.length > 0 && (
            <button onClick={aiPickMusic} disabled={aiPickingMusic}
              style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${childSafe}`, background: `${childSafe}10`, color: aiPickingMusic ? muted : childSafe, fontSize: 11, fontWeight: 700, cursor: aiPickingMusic ? "not-allowed" : "pointer" }}>
              {aiPickingMusic ? "Picking..." : "AI Pick Music"}
            </button>
          )}
        </div>
        {selectedMusicName && (
          <div style={{ padding: "8px 12px", borderRadius: 8, background: `${childAccent}12`, border: `1px solid ${childAccent}30`, marginBottom: 8 }}>
            <p style={{ fontSize: 11, color: childAccent, fontWeight: 700 }}>Selected: {selectedMusicName}</p>
            {selectedMusicUrl && <audio src={selectedMusicUrl} controls style={{ width: "100%", height: 28, marginTop: 6 }} />}
          </div>
        )}
        {aiMusicPickLog && <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>{aiMusicPickLog}</p>}
      </div>

      {/* Sound Effects Browser */}
      <p style={labelStyle}>Sound Effects Studio</p>
      <div style={{ background: s2, borderRadius: 12, padding: 14, border: `1px solid ${border}`, marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 4, marginBottom: 12, background: "#0a0d14", borderRadius: 8, padding: 4 }}>
          {([{ id: "freesound" as const, label: "Sound Effects Browser" }, { id: "ai-sfx" as const, label: "AI Audio Studio" }]).map(t => (
            <button key={t.id} onClick={() => setSoundTab(t.id)}
              style={{ flex: 1, padding: "7px 12px", borderRadius: 6, border: "none", background: soundTab === t.id ? childAccent : "transparent", color: soundTab === t.id ? "#000" : muted, fontSize: 11, fontWeight: soundTab === t.id ? 700 : 400, cursor: "pointer" }}>
              {t.label}
            </button>
          ))}
        </div>

        {soundTab === "freesound" && (
          <div>
            {fsNoKey ? (
              <div style={{ padding: "12px 16px", borderRadius: 10, background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", marginBottom: 12 }}>
                <p style={{ fontSize: 12, color: "#ef4444", fontWeight: 600 }}>Freesound API key not configured</p>
                <p style={{ fontSize: 10, color: muted, marginTop: 4 }}>Add FREESOUND_API_KEY to your environment.</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <input value={fsQuery} onChange={e => setFsQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && searchFreesound()} placeholder="Search: birds chirping, water stream, laughter..."
                  style={{ flex: 1, background: "#0a0d14", border: `1px solid ${border}`, borderRadius: 8, padding: "9px 12px", color: "#fff", fontSize: 12, outline: "none" }} />
                <button onClick={() => searchFreesound()} disabled={fsSearching || !fsQuery.trim()}
                  style={{ padding: "9px 16px", borderRadius: 8, border: "none", background: fsSearching ? "#2a2a40" : childAccent, color: "#000", fontSize: 12, fontWeight: 700, cursor: (fsSearching || !fsQuery.trim()) ? "not-allowed" : "pointer" }}>
                  {fsSearching ? "..." : "Search"}
                </button>
              </div>
            )}
            {fsResults.length > 0 && (
              <div style={{ maxHeight: 240, overflowY: "auto" as const, display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {fsResults.map(sound => {
                  const saved = fsSaved.has(sound.id);
                  const saving = fsSaving === sound.id;
                  const previewing = sfxPreviewId === sound.id;
                  return (
                    <div key={sound.id} style={{ background: "#0a0d14", borderRadius: 10, padding: "10px 12px", border: `1px solid ${border}`, display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 11, fontWeight: 600, color: "#fff", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>{sound.name}</p>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const, marginBottom: 4 }}>
                          <span style={{ fontSize: 9, color: muted }}>{sound.duration.toFixed(1)}s</span>
                          <span style={{ fontSize: 9, color: muted }}>by {sound.username}</span>
                          {(sound.tags || []).slice(0, 3).map(tag => <span key={tag} style={{ fontSize: 9, padding: "1px 6px", borderRadius: 8, background: `${childAccent}15`, color: childAccent }}>{tag}</span>)}
                        </div>
                        {previewing && <audio src={sound.previewUrl} autoPlay controls style={{ width: "100%", height: 24 }} />}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => setSfxPreviewId(previewing ? null : sound.id)}
                          style={{ padding: "5px 10px", borderRadius: 6, border: `1px solid ${border}`, background: previewing ? `${childAccent}20` : "transparent", color: previewing ? childAccent : muted, fontSize: 10, cursor: "pointer" }}>
                          {previewing ? "■" : "▶"}
                        </button>
                        <button onClick={() => saveFreesound(sound)} disabled={saved || saving}
                          style={{ padding: "5px 10px", borderRadius: 6, border: "none", background: saved ? `${childSafe}20` : childSafe, color: saved ? childSafe : "#000", fontSize: 10, fontWeight: 700, cursor: (saved || saving) ? "not-allowed" : "pointer" }}>
                          {saving ? "..." : saved ? "Saved" : "Save"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {!fsNoKey && fsResults.length === 0 && !fsSearching && (
              <p style={{ fontSize: 11, color: muted, textAlign: "center" as const }}>Search for child-friendly sound effects above</p>
            )}
          </div>
        )}

        {soundTab === "ai-sfx" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <p style={{ fontSize: 11, color: muted }}>Describe a sound effect and AI generates it for you.</p>
              <button
                onClick={async () => {
                  const story = expandedContent || textContent || readAlongText;
                  if (!story.trim()) { setLastAction("Write your story first, then auto-suggest will read it"); return; }
                  setSfxDesc("Reading your story and scenes...");
                  try {
                    const sceneCtx = childScenes.length > 0
                      ? `\nScenes:\n${childScenes.slice(0, 5).map((s, i) => `Scene ${i + 1}: ${s.title || ""} — ${(s.visualDescription || "").slice(0, 100)}`).join("\n")}`
                      : "";
                    const charCtx = savedChars.length > 0 ? `\nCharacters: ${savedChars.map(c => c.name).join(", ")}` : "";
                    const prompt = `You are a children's video sound designer. Read this story carefully and write ONE specific sound effect description (15-25 words) that matches the actual events and mood in the story. Be specific to what happens — mention characters, actions, settings from the story.\n\nStory: ${story.slice(0, 900)}${sceneCtx}${charCtx}\nStyle: ${effectiveProjectStyle || "children's illustration"}, Age: ${ageGroup || "3-8"}, Tone: ${tone || "playful"}\n\nReply with ONLY the sound effect description. No intro text, no quotes.`;
                    const res = await fetch("/api/llm/chat", { method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ prompt, role: "fast", maxTokens: 80 }) });
                    const d = await res.json();
                    setSfxDesc((d.text || "").replace(/^["']|["']$/g, "").trim());
                  } catch { setSfxDesc(""); setLastAction("Auto-suggest failed — type a description manually"); }
                }}
                style={{ padding: "5px 12px", borderRadius: 8, border: `1px solid ${childAccent}40`, background: `${childAccent}10`, color: childAccent, fontSize: 10, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" as const }}>
                ✨ Auto-suggest from story
              </button>
            </div>
            <textarea value={sfxDesc} onChange={e => setSfxDesc(e.target.value)} rows={3}
              placeholder="e.g. Happy children laughing and playing, gentle bells ringing, magical sparkle sound..."
              style={{ width: "100%", background: "#0a0d14", border: `1px solid ${border}`, borderRadius: 10, padding: "10px 12px", color: "#fff", fontSize: 12, outline: "none", fontFamily: "inherit", resize: "vertical" as const, marginBottom: 8 }} />
            <button onClick={generateElevenLabsSfx} disabled={sfxGenerating || !sfxDesc.trim() || sfxDesc === "AI is reading your story..."}
              style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: (sfxGenerating || !sfxDesc.trim()) ? "#2a2a40" : `linear-gradient(135deg, ${childAccent}, #7c3aed)`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: (sfxGenerating || !sfxDesc.trim()) ? "not-allowed" : "pointer" }}>
              {sfxGenerating ? "Generating sound..." : "Generate Sound Effect"}
            </button>
            {sfxGeneratedUrl && (
              <div style={{ marginTop: 10, padding: "10px 14px", borderRadius: 10, background: `${childAccent}10`, border: `1px solid ${childAccent}25` }}>
                <p style={{ fontSize: 11, color: childAccent, fontWeight: 600, marginBottom: 6 }}>Generated Sound Effect</p>
                <audio src={sfxGeneratedUrl} controls style={{ width: "100%", height: 32 }} />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Read-Along Settings */}
      {learningMode === "read_along" && (
        <div style={{ marginBottom: 20, padding: 18, borderRadius: 14, border: `2px solid ${childAccent}40`, background: `${childAccent}06` }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: childAccent, marginBottom: 14 }}>Read-Along Settings</p>

          <div style={{ marginBottom: 14 }}>
            <p style={labelStyle}>Read-Along Text</p>
            <textarea value={readAlongText} onChange={e => { setReadAlongText(e.target.value); setLastAction("Read-along text updated"); }} rows={4}
              placeholder="Paste the text you want children to read along with narration..."
              style={{ width: "100%", background: s2, border: `1px solid ${border}`, borderRadius: 10, padding: "12px 14px", color: "#fff", fontSize: 13, outline: "none", fontFamily: "inherit", resize: "vertical" }} />
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={labelStyle}>Highlight Mode</p>
            <div style={{ display: "flex", gap: 6 }}>
              {(["word", "sentence", "line", "karaoke"] as const).map(hm => (
                <button key={hm} onClick={() => { setHighlightMode(hm); setLastAction(`Highlight: ${hm}`); }}
                  style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${highlightMode === hm ? childAccent : border}`, background: highlightMode === hm ? `${childAccent}12` : "transparent", color: highlightMode === hm ? childAccent : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                  {hm}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 14 }}>
            <p style={labelStyle}>Read Speed</p>
            <div style={{ display: "flex", gap: 6 }}>
              {(["slow", "normal", "fast"] as const).map(spd => (
                <button key={spd} onClick={() => { setReadSpeed(spd); setLastAction(`Speed: ${spd}`); }}
                  style={{ flex: 1, padding: "8px 6px", borderRadius: 8, border: `1px solid ${readSpeed === spd ? childAccent : border}`, background: readSpeed === spd ? `${childAccent}12` : "transparent", color: readSpeed === spd ? childAccent : "#fff", fontSize: 10, fontWeight: 600, cursor: "pointer", textTransform: "capitalize" as const }}>
                  {spd}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12, marginBottom: 14 }}>
            <div>
              <p style={labelStyle}>Font Size: {fontSize}px</p>
              <input type="range" min={24} max={48} value={fontSize} onChange={e => setFontSize(Number(e.target.value))}
                style={{ width: "100%", accentColor: childAccent }} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 8, color: muted }}>24px</span>
                <span style={{ fontSize: 8, color: muted }}>48px</span>
              </div>
            </div>
            <div>
              <p style={labelStyle}>Highlight Color</p>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input type="color" value={highlightColor} onChange={e => setHighlightColor(e.target.value)}
                  style={{ width: 40, height: 36, borderRadius: 8, border: `1px solid ${border}`, background: "transparent", cursor: "pointer", padding: 2 }} />
                <span style={{ fontSize: 11, color: "#fff", fontFamily: "monospace" }}>{highlightColor}</span>
              </div>
            </div>
          </div>

          {readAlongText && (() => {
            const previewWords = readAlongText.split(/\s+/);
            return (
              <div>
                <p style={labelStyle}>Preview</p>
                <div style={{ background: s2, borderRadius: 10, padding: 16, border: `1px solid ${border}`, lineHeight: 1.6 }}>
                  {previewWords.slice(0, 20).map((word, i) => (
                    <span key={i} style={{ fontSize, fontWeight: 600, color: i === 0 ? "#000" : "#fff", background: i === 0 ? highlightColor : "transparent", padding: i === 0 ? "2px 6px" : "2px 4px", borderRadius: 4, marginRight: 6, display: "inline-block" }}>
                      {word}
                    </span>
                  ))}
                  {previewWords.length > 20 && <span style={{ fontSize: 11, color: muted }}> …</span>}
                </div>
                <p style={{ fontSize: 9, color: muted, marginTop: 6 }}>First word shown highlighted as preview. Actual sync runs during video generation.</p>
              </div>
            );
          })()}
        </div>
      )}

      <button onClick={() => { setPlanning(true); setLastAction("Plan generating..."); setTimeout(() => { setPlanning(false); setLastAction("Plan generated"); setActiveTab("review1"); }, 2000); }}
        disabled={planning || !textContent.trim()}
        style={{ width: "100%", padding: 16, borderRadius: 14, border: "none", background: (planning || !textContent.trim()) ? "#2a2a40" : childAccent, color: "#fff", fontSize: 16, fontWeight: 700, cursor: (planning || !textContent.trim()) ? "not-allowed" : "pointer" }}>
        {planning ? "Child-Safe Planner analyzing..." : !textContent.trim() ? "Enter content first" : "Generate Plan — First Review"}
      </button>
    </div>
  );
}
